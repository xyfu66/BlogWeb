<script setup lang="ts">
import { watch, onMounted, onUnmounted, nextTick, ref } from 'vue'
import { useImageLightbox } from '@/composables/useImageLightbox'
import { useCanvasTransform } from '@/composables/useCanvasTransform'

const { state, close } = useImageLightbox()
const {
  transformStyle,
  isDragging,
  zoomPercent,
  zoomIn,
  zoomOut,
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
} = useCanvasTransform({
  minScale: 0.2,
  maxScale: 6.0,
  scaleStep: 0.25,
})

const modalContainerRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLElement | null>(null)
let lastActiveElement: HTMLElement | null = null
let originalPaddingRight = ''

function handleKeyDown(e: KeyboardEvent) {
  if (!state.value.isOpen) return

  // Focus Trap - Tab Key Cycle
  if (e.key === 'Tab' && modalContainerRef.value) {
    const focusable = modalContainerRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex="0"]',
    )
    if (focusable.length > 0) {
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
        return
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
        return
      }
    }
  }

  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      close()
      break
    case '+':
    case '=':
      e.preventDefault()
      zoomIn()
      break
    case '-':
    case '_':
      e.preventDefault()
      zoomOut()
      break
    case '0':
      e.preventDefault()
      reset()
      break
    case 'r':
    case 'R':
      e.preventDefault()
      rotateClockwise()
      break
    case 'ArrowLeft':
      e.preventDefault()
      pan(40, 0)
      break
    case 'ArrowRight':
      e.preventDefault()
      pan(-40, 0)
      break
    case 'ArrowUp':
      e.preventDefault()
      pan(0, 40)
      break
    case 'ArrowDown':
      e.preventDefault()
      pan(0, -40)
      break
  }
}

function downloadCurrentItem() {
  const item = state.value.activeItem
  if (!item) return

  if (item.type === 'svg' && item.svgContent) {
    const blob = new Blob([item.svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.title ? item.title.replace(/[^\w\u4e00-\u9fa5]+/g, '_') : 'diagram'}.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } else if (item.type === 'image' && item.src) {
    const a = document.createElement('a')
    a.href = item.src
    a.download = item.title || 'image'
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

function handleBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget && !isDragging.value) {
    close()
  }
}

function lockBodyScroll() {
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
  originalPaddingRight = document.body.style.paddingRight
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`
  }
  document.body.style.overflow = 'hidden'
}

function computeInitialFitScale(): number {
  const item = state.value.activeItem
  if (!item) return 1.0

  if (item.type === 'svg' && item.naturalWidth && item.naturalHeight) {
    const screenW = window.innerWidth * 0.88
    const screenH = window.innerHeight * 0.78
    const cardPaddingW = 80 // 2.5rem * 2
    const cardPaddingH = 80
    const totalW = item.naturalWidth + cardPaddingW
    const totalH = item.naturalHeight + cardPaddingH
    const scale = Math.min(1.0, screenW / totalW, screenH / totalH)
    return Math.max(0.2, Number(scale.toFixed(2)))
  }
  return 1.0
}

function handleResetClick() {
  reset(computeInitialFitScale())
}

function handleToggleActualSizeClick() {
  toggleActualSize(computeInitialFitScale())
}

function unlockBodyScroll() {
  document.body.style.overflow = ''
  document.body.style.paddingRight = originalPaddingRight
}

watch(
  () => state.value.isOpen,
  (isOpen) => {
    if (isOpen) {
      lastActiveElement = document.activeElement as HTMLElement | null
      lockBodyScroll()
      const fitScale = computeInitialFitScale()
      reset(fitScale)
      window.addEventListener('keydown', handleKeyDown)
      nextTick(() => {
        canvasRef.value?.focus()
      })
    } else {
      unlockBodyScroll()
      window.removeEventListener('keydown', handleKeyDown)
      reset()
      if (lastActiveElement) {
        lastActiveElement.focus()
      }
    }
  },
)

onMounted(() => {
  if (state.value.isOpen) {
    window.addEventListener('keydown', handleKeyDown)
  }
})

onUnmounted(() => {
  unlockBodyScroll()
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="bl-lightbox-fade">
      <div
        v-if="state.isOpen && state.activeItem"
        ref="modalContainerRef"
        class="bl-lightbox-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="state.activeItem.title || '图片与图表查看器'"
        @click="handleBackdropClick"
      >
        <!-- Top Navigation & Header Bar -->
        <header class="lightbox-header">
          <div class="header-left">
            <span class="header-type-icon">
              <svg v-if="state.activeItem.type === 'svg'" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                <polyline points="2 17 12 22 22 17"></polyline>
                <polyline points="2 12 12 17 22 12"></polyline>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
            </span>
            <h3 class="header-title">{{ state.activeItem.title || (state.activeItem.type === 'svg' ? '架构流程图例' : '图片预览') }}</h3>
          </div>

          <div class="header-right">
            <div class="shortcut-hints">
              <span class="hint-pill"><kbd>ESC</kbd> 退出</span>
              <span class="hint-pill"><kbd>滚轮 / 捏合</kbd> 缩放</span>
              <span class="hint-pill"><kbd>拖拽</kbd> 平移</span>
            </div>

            <button
              class="lightbox-close-btn"
              aria-label="关闭查看器"
              title="关闭 (Esc)"
              @click="close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <!-- Viewport Canvas -->
        <main
          ref="canvasRef"
          tabindex="-1"
          class="lightbox-viewport"
          :class="{ 'is-dragging': isDragging }"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointercancel="handlePointerCancel"
          @wheel="handleWheel"
          @dblclick="handleDoubleClick"
        >
          <div
            class="lightbox-canvas-content"
            :style="transformStyle"
          >
            <!-- SVG Vector Diagram Mode -->
            <div
              v-if="state.activeItem.type === 'svg'"
              class="lightbox-svg-container"
              v-html="state.activeItem.svgContent"
            ></div>

            <!-- Standard Image Mode -->
            <img
              v-else-if="state.activeItem.type === 'image'"
              :src="state.activeItem.src"
              :alt="state.activeItem.alt || '放大预览'"
              class="lightbox-image-target"
              draggable="false"
            />
          </div>
        </main>

        <!-- Floating Glassmorphic Toolbar -->
        <footer class="lightbox-toolbar-wrapper">
          <nav class="lightbox-toolbar" aria-label="查看器工具栏">
            <!-- Zoom Out -->
            <button
              class="tool-btn"
              title="缩小 (-)"
              aria-label="缩小"
              @click="zoomOut"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>

            <!-- Zoom Percent Badge (Click to reset) -->
            <button
              class="tool-btn scale-badge-btn"
              title="点击重置缩放"
              aria-label="缩放百分比"
              @click="handleResetClick"
            >
              {{ zoomPercent }}%
            </button>

            <!-- Zoom In -->
            <button
              class="tool-btn"
              title="放大 (+)"
              aria-label="放大"
              @click="zoomIn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="11" y1="8" x2="11" y2="14"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </button>

            <span class="tool-divider"></span>

            <!-- Actual Size / Fit Toggle -->
            <button
              class="tool-btn"
              title="自适应屏幕 / 1:1 原尺寸切换"
              aria-label="切换原尺寸"
              @click="handleToggleActualSizeClick"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>

            <!-- Rotate 90 deg -->
            <button
              class="tool-btn"
              title="顺时针旋转 90° (R)"
              aria-label="顺时针旋转"
              @click="rotateClockwise"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
              </svg>
            </button>

            <!-- Reset -->
            <button
              class="tool-btn"
              title="居中重置 (0)"
              aria-label="重置"
              @click="handleResetClick"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
            </button>

            <span class="tool-divider"></span>

            <!-- Download Export -->
            <button
              class="tool-btn"
              :title="state.activeItem.type === 'svg' ? '导出高清 SVG 矢量图' : '下载图片'"
              aria-label="导出下载"
              @click="downloadCurrentItem"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </nav>
        </footer>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.bl-lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  flex-direction: column;
  background: rgba(10, 14, 20, 0.88);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  user-select: none;
  touch-action: none;
  overflow: hidden;
}

/* Header */
.lightbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.75rem;
  background: linear-gradient(180deg, rgba(13, 17, 23, 0.85) 0%, rgba(13, 17, 23, 0) 100%);
  z-index: 10;
  pointer-events: auto;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.header-type-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bl-accent, #58a6ff);
  background: var(--bl-accent-soft, rgba(88, 166, 255, 0.12));
  padding: 0.4rem;
  border-radius: var(--bl-radius-sm, 6px);
  border: 1px solid rgba(88, 166, 255, 0.2);
}

.header-title {
  font-size: 1rem;
  font-weight: 600;
  color: #f0f6fc;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.shortcut-hints {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hint-pill {
  font-size: 0.75rem;
  color: #8b949e;
  background: rgba(255, 255, 255, 0.05);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.hint-pill kbd {
  font-family: var(--bl-font-mono, monospace);
  color: #c9d1d9;
  font-weight: 600;
}

.lightbox-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #c9d1d9;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.lightbox-close-btn:hover {
  background: rgba(255, 75, 75, 0.25);
  border-color: rgba(255, 75, 75, 0.5);
  color: #ff7b72;
  transform: scale(1.05);
}

/* Viewport Canvas */
.lightbox-viewport {
  flex: 1;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  outline: none;
  overflow: hidden;
  position: relative;
}

.lightbox-viewport.is-dragging {
  cursor: grabbing;
}

.lightbox-canvas-content {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  user-select: none;
}

/* SVG rendering */
.lightbox-svg-container {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, rgba(22, 27, 34, 0.98), rgba(13, 17, 23, 0.99));
  padding: 2.25rem 2.5rem;
  border-radius: var(--bl-radius-lg, 14px);
  border: 1px solid rgba(88, 166, 255, 0.35);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75), 0 0 35px rgba(88, 166, 255, 0.15);
  width: fit-content;
  height: fit-content;
  box-sizing: border-box;
}

.lightbox-svg-container :deep(svg) {
  display: block;
  margin: 0 auto;
  overflow: visible;
}

.lightbox-svg-container :deep(.mermaid) {
  display: flex;
  justify-content: center;
  width: 100%;
}

.lightbox-svg-container :deep(text),
.lightbox-svg-container :deep(span),
.lightbox-svg-container :deep(div) {
  color: #f0f6fc;
}

/* Image rendering */
.lightbox-image-target {
  display: block;
  max-width: 85vw;
  max-height: 75vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

/* Bottom Floating Toolbar */
.lightbox-toolbar-wrapper {
  position: absolute;
  bottom: 2rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: 20;
}

.lightbox-toolbar {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.75rem;
  background: rgba(22, 27, 34, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(88, 166, 255, 0.25);
  border-radius: 9999px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 20px rgba(88, 166, 255, 0.15);
}

.tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: transparent;
  border: none;
  color: #c9d1d9;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.tool-btn:hover {
  background: rgba(88, 166, 255, 0.18);
  color: #58a6ff;
  transform: translateY(-1px);
}

.tool-btn:active {
  transform: translateY(1px);
}

.scale-badge-btn {
  width: auto;
  padding: 0 0.6rem;
  border-radius: 9999px;
  font-family: var(--bl-font-mono, monospace);
  font-size: 0.8125rem;
  font-weight: 600;
  color: #58a6ff;
}

.tool-divider {
  width: 1px;
  height: 18px;
  background: rgba(240, 246, 252, 0.15);
  margin: 0 0.2rem;
}

/* Modal Transition */
.bl-lightbox-fade-enter-active,
.bl-lightbox-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.bl-lightbox-fade-enter-from,
.bl-lightbox-fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .shortcut-hints {
    display: none;
  }
  .lightbox-header {
    padding: 0.75rem 1rem;
  }
  .lightbox-toolbar-wrapper {
    bottom: 1.25rem;
  }
}
</style>
