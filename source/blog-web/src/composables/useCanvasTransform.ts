import { ref, computed, onScopeDispose } from 'vue'
import type { TransformState } from '@/types/lightbox'

export interface CanvasTransformOptions {
  minScale?: number
  maxScale?: number
  scaleStep?: number
  initialScale?: number
}

interface PointerInfo {
  id: number
  x: number
  y: number
}

export function useCanvasTransform(options: CanvasTransformOptions = {}) {
  const minScale = options.minScale ?? 0.2
  const maxScale = options.maxScale ?? 6.0
  const scaleStep = options.scaleStep ?? 0.25
  const initialScale = options.initialScale ?? 1.0

  const transform = ref<TransformState>({
    scale: initialScale,
    translateX: 0,
    translateY: 0,
    rotate: 0,
  })

  const isDragging = ref(false)
  const enableTransition = ref(false)
  const activePointers = new Map<number, PointerInfo>()
  let initialPinchDistance = 0
  let initialPinchScale = 1.0
  const dragStart = { x: 0, y: 0, initialTranslateX: 0, initialTranslateY: 0 }
  let rafId: number | null = null

  const transformStyle = computed(() => {
    const { scale, translateX, translateY, rotate } = transform.value
    return {
      transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale}) rotate(${rotate}deg)`,
      transformOrigin: 'center center',
      willChange: 'transform',
      transition: enableTransition.value && !isDragging.value
        ? 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
        : 'none',
    }
  })

  const zoomPercent = computed(() => Math.round(transform.value.scale * 100))

  function clampScale(val: number): number {
    return Math.max(minScale, Math.min(maxScale, Number(val.toFixed(2))))
  }

  function zoomIn() {
    enableTransition.value = true
    transform.value.scale = clampScale(transform.value.scale + scaleStep)
  }

  function zoomOut() {
    enableTransition.value = true
    transform.value.scale = clampScale(transform.value.scale - scaleStep)
  }

  function setScale(targetScale: number) {
    enableTransition.value = true
    transform.value.scale = clampScale(targetScale)
  }

  function rotateClockwise() {
    enableTransition.value = true
    transform.value.rotate = (transform.value.rotate + 90) % 360
  }

  function reset(newScale?: number) {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    enableTransition.value = false
    transform.value = {
      scale: newScale !== undefined ? clampScale(newScale) : initialScale,
      translateX: 0,
      translateY: 0,
      rotate: 0,
    }
    isDragging.value = false
    activePointers.clear()
    setTimeout(() => {
      enableTransition.value = true
    }, 50)
  }

  function toggleActualSize(fitScale = 1.0) {
    enableTransition.value = true
    if (Math.abs(transform.value.scale - fitScale) < 0.05) {
      transform.value.scale = Math.abs(fitScale - 1.0) < 0.05 ? 1.8 : 1.0
    } else {
      transform.value.scale = fitScale
      transform.value.translateX = 0
      transform.value.translateY = 0
    }
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.15 : -0.15
    const newScale = clampScale(transform.value.scale + delta)
    transform.value.scale = newScale
  }

  function getDistance(p1: PointerInfo, p2: PointerInfo): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y)
  }

  function handlePointerDown(e: PointerEvent) {
    // 支持主按键(0) 或 触控输入
    if (e.pointerType === 'mouse' && e.button !== 0) return

    activePointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY })

    const target = e.currentTarget as HTMLElement
    if (target?.setPointerCapture) {
      try {
        target.setPointerCapture(e.pointerId)
      } catch (_) {}
    }

    if (activePointers.size === 1) {
      isDragging.value = true
      dragStart.x = e.clientX
      dragStart.y = e.clientY
      dragStart.initialTranslateX = transform.value.translateX
      dragStart.initialTranslateY = transform.value.translateY
    } else if (activePointers.size === 2) {
      // 双指捏合缩放模式
      isDragging.value = true
      const [p1, p2] = Array.from(activePointers.values())
      initialPinchDistance = getDistance(p1, p2)
      initialPinchScale = transform.value.scale
    }
  }

  function handlePointerMove(e: PointerEvent) {
    if (!activePointers.has(e.pointerId)) return

    activePointers.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY })

    if (activePointers.size === 2) {
      // 双指捏合计算
      const [p1, p2] = Array.from(activePointers.values())
      const currentDistance = getDistance(p1, p2)
      if (initialPinchDistance > 0) {
        const factor = currentDistance / initialPinchDistance
        if (rafId) cancelAnimationFrame(rafId)
        rafId = requestAnimationFrame(() => {
          transform.value.scale = clampScale(initialPinchScale * factor)
        })
      }
      return
    }

    if (activePointers.size === 1 && isDragging.value) {
      const dx = e.clientX - dragStart.x
      const dy = e.clientY - dragStart.y

      if (rafId) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        transform.value.translateX = dragStart.initialTranslateX + dx
        transform.value.translateY = dragStart.initialTranslateY + dy
      })
    }
  }

  function handlePointerUp(e: PointerEvent) {
    activePointers.delete(e.pointerId)

    const target = e.currentTarget as HTMLElement
    if (target?.hasPointerCapture && target.hasPointerCapture(e.pointerId)) {
      try {
        target.releasePointerCapture(e.pointerId)
      } catch (_) {}
    }

    if (activePointers.size === 0) {
      isDragging.value = false
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
    } else if (activePointers.size === 1) {
      // 从双指切回单指平移
      const remaining = Array.from(activePointers.values())[0]
      dragStart.x = remaining.x
      dragStart.y = remaining.y
      dragStart.initialTranslateX = transform.value.translateX
      dragStart.initialTranslateY = transform.value.translateY
    }
  }

  function handlePointerCancel(e: PointerEvent) {
    handlePointerUp(e)
  }

  function handleDoubleClick() {
    if (transform.value.scale > 1.2) {
      reset()
    } else {
      transform.value.scale = 1.8
    }
  }

  function pan(dx: number, dy: number) {
    transform.value.translateX += dx
    transform.value.translateY += dy
  }

  onScopeDispose(() => {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  })

  return {
    transform,
    transformStyle,
    isDragging,
    zoomPercent,
    zoomIn,
    zoomOut,
    setScale,
    rotateClockwise,
    reset,
    toggleActualSize,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleDoubleClick,
    pan,
  }
}
