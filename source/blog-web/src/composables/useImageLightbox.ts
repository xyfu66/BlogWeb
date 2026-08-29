import { ref, readonly } from 'vue'
import type { LightboxItem, LightboxState } from '@/types/lightbox'

const state = ref<LightboxState>({
  isOpen: false,
  activeItem: null,
})

export function useImageLightbox() {
  function open(item: LightboxItem) {
    state.value = {
      isOpen: true,
      activeItem: item,
    }
  }

  function openImage(src: string, alt?: string, title?: string) {
    open({
      type: 'image',
      src,
      alt: alt || '',
      title: title || alt || '图片预览',
    })
  }

  function openSvg(svgContent: string, title?: string) {
    open({
      type: 'svg',
      svgContent,
      title: title || '架构流程图例',
    })
  }

  function close() {
    state.value = {
      isOpen: false,
      activeItem: null,
    }
  }

  return {
    state: readonly(state),
    open,
    openImage,
    openSvg,
    close,
  }
}
