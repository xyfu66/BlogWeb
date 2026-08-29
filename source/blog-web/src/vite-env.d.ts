/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module 'virtual:blog-posts' {
  import type { BlogPostMeta } from '@/types/post'
  export const posts: BlogPostMeta[]
  export default posts
}
