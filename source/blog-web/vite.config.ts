import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { blogPostsPlugin } from './vite/plugins/blog-posts.ts'

// https://vite.dev/config/
export default defineConfig({
  base: '/me/blog/',
  plugins: [blogPostsPlugin(), vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 8201,
  },
})
