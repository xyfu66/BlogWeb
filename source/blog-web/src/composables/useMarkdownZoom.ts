import { nextTick, type Ref } from 'vue'
import { useImageLightbox } from '@/composables/useImageLightbox'

export function useMarkdownZoom() {
  const { openSvg, openImage } = useImageLightbox()

  /**
   * 查找图表或图片前最近的语义标题作为标题提示
   */
  function findPrecedingTitle(element: HTMLElement): string {
    let prev = element.previousElementSibling
    while (prev) {
      if (/^H[1-6]$/i.test(prev.tagName)) {
        return prev.textContent?.trim() || ''
      }
      prev = prev.previousElementSibling
    }
    return ''
  }

  /**
   * 为 Mermaid 容器注入符合现代 UI 规范的悬浮毛玻璃放大触发器
   */
  function enhanceDiagrams(container: HTMLElement) {
    const diagrams = container.querySelectorAll<HTMLElement>('.mermaid-diagram')
    diagrams.forEach((diag) => {
      if (diag.querySelector('.diagram-zoom-btn')) return

      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'diagram-zoom-btn'
      btn.setAttribute('aria-label', '放大查看图例')
      btn.setAttribute('title', '点击放大查看 (支持滚轮缩放与平移)')
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        <span>全屏放大</span>
      `
      diag.appendChild(btn)
    })
  }

  /**
   * 为 Markdown 文章图片注入悬浮放大触发器
   */
  function enhanceImages(container: HTMLElement) {
    const images = container.querySelectorAll<HTMLImageElement>('.markdown-body img')
    images.forEach((img) => {
      if (img.classList.contains('zoomable-img')) return
      img.classList.add('zoomable-img')
      img.setAttribute('title', img.getAttribute('title') || '点击放大查看')

      // 如果图片未被 wrapper 包裹，则为其创建相对定位的容器
      const parent = img.parentElement
      if (parent && !parent.classList.contains('img-zoom-wrapper')) {
        const wrapper = document.createElement('div')
        wrapper.className = 'img-zoom-wrapper'
        parent.insertBefore(wrapper, img)
        wrapper.appendChild(img)

        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'img-zoom-btn'
        btn.setAttribute('aria-label', '放大查看图片')
        btn.setAttribute('title', '点击放大图片')
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <span>放大</span>
        `
        wrapper.appendChild(btn)
      }
    })
  }

  /**
   * 容器级单一事件委托 (Event Delegation)
   */
  function handleContainerClick(e: MouseEvent) {
    const target = e.target as HTMLElement
    if (!target) return

    // 1. 点击 Mermaid 放大按钮或 Mermaid 图例本身
    const diagramZoomBtn = target.closest<HTMLElement>('.diagram-zoom-btn')
    const diagramContainer = target.closest<HTMLElement>('.mermaid-diagram')

    if (diagramZoomBtn || (diagramContainer && !target.closest('a'))) {
      if (!diagramContainer) return
      const svg = diagramContainer.querySelector('svg')
      if (svg) {
        e.preventDefault()
        e.stopPropagation()
        const title = findPrecedingTitle(diagramContainer) || '架构流程图例'

        // 克隆 SVG 节点
        const clonedSvg = svg.cloneNode(true) as SVGElement

        // 提取 viewBox 宽高作为 SVG 固有尺寸
        const viewBoxAttr = svg.getAttribute('viewBox')
        let vbWidth = 0
        let vbHeight = 0

        if (viewBoxAttr) {
          const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number)
          if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
            vbWidth = parts[2]
            vbHeight = parts[3]
          }
        }

        if (!vbWidth || !vbHeight) {
          const rect = svg.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            vbWidth = Math.round(rect.width)
            vbHeight = Math.round(rect.height)
            clonedSvg.setAttribute('viewBox', `0 0 ${vbWidth} ${vbHeight}`)
          }
        }

        if (vbWidth > 0 && vbHeight > 0) {
          clonedSvg.setAttribute('width', String(vbWidth))
          clonedSvg.setAttribute('height', String(vbHeight))
          clonedSvg.style.display = 'block'
          clonedSvg.style.width = `${vbWidth}px`
          clonedSvg.style.height = `${vbHeight}px`
          clonedSvg.style.maxWidth = 'none'
          clonedSvg.style.maxHeight = 'none'
          clonedSvg.style.overflow = 'visible'
        }

        clonedSvg.style.backgroundColor = 'transparent'

        openSvg(clonedSvg.outerHTML, title, vbWidth, vbHeight)
        return
      }
    }

    // 2. 点击图片放大按钮或图片本身
    const imgZoomBtn = target.closest<HTMLElement>('.img-zoom-btn')
    const clickedImg = target.closest<HTMLImageElement>('img.zoomable-img')

    if (imgZoomBtn || clickedImg) {
      const wrapper = target.closest<HTMLElement>('.img-zoom-wrapper')
      const img = clickedImg || (wrapper ? wrapper.querySelector<HTMLImageElement>('img') : null)
      if (img && img.src) {
        e.preventDefault()
        e.stopPropagation()
        const title = img.alt || (wrapper ? findPrecedingTitle(wrapper) : '') || '图片预览'
        openImage(img.src, img.alt, title)
        return
      }
    }
  }

  /**
   * 在 Markdown 渲染完成和 Mermaid 图表生成后执行增强
   */
  async function refresh(containerOrRef: HTMLElement | Ref<HTMLElement | null> | null) {
    await nextTick()
    const container = containerOrRef && 'value' in containerOrRef ? containerOrRef.value : containerOrRef
    if (!container) return

    enhanceDiagrams(container)
    enhanceImages(container)
  }

  return {
    refresh,
    handleContainerClick,
  }
}
