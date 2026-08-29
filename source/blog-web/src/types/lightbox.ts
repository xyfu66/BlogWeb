export type LightboxContentType = 'image' | 'svg' | 'html'

export interface LightboxItem {
  id?: string
  type: LightboxContentType
  src?: string
  alt?: string
  title?: string
  svgContent?: string
  naturalWidth?: number
  naturalHeight?: number
}

export interface TransformState {
  scale: number
  translateX: number
  translateY: number
  rotate: number
}

export interface LightboxState {
  isOpen: boolean
  activeItem: LightboxItem | null
}

export interface LightboxOptions {
  minScale?: number
  maxScale?: number
  scaleStep?: number
  enableKeyboard?: boolean
  enableWheel?: boolean
  enableRotate?: boolean
  enableDownload?: boolean
}
