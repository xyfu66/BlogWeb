import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BlogPostMeta, TagCount } from '@/types/post'
import defaultPosts from 'virtual:blog-posts'

// 动态载入所有 markdown 源码
const markdownFiles = import.meta.glob('../posts/*.md', { query: '?raw', import: 'default' })

export const useBlogStore = defineStore('blog', () => {
  const posts = ref<BlogPostMeta[]>(defaultPosts || [])
  const activeTag = ref<string | null>(null)
  const contentCache = ref<Record<string, string>>({})

  // 计算标签云列表及各标签文章数
  const tags = computed<TagCount[]>(() => {
    const map = new Map<string, number>()
    for (const post of posts.value) {
      if (post.tags && Array.isArray(post.tags)) {
        for (const tag of post.tags) {
          const trimmed = tag.trim()
          if (trimmed) {
            map.set(trimmed, (map.get(trimmed) || 0) + 1)
          }
        }
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  })

  // 按标签过滤后的文章列表
  const filteredPosts = computed<BlogPostMeta[]>(() => {
    if (!activeTag.value) return posts.value
    return posts.value.filter((p) => p.tags && p.tags.includes(activeTag.value!))
  })

  function getPostBySlug(slug: string): BlogPostMeta | undefined {
    return posts.value.find((p) => p.slug === slug)
  }

  function setActiveTag(tag: string | null) {
    activeTag.value = tag
  }

  /**
   * 懒加载指定 slug 文章的 Markdown 源码
   */
  async function loadPostContent(slug: string): Promise<string> {
    if (contentCache.value[slug]) {
      return contentCache.value[slug]
    }

    // 寻找匹配文件
    for (const [filePath, loader] of Object.entries(markdownFiles)) {
      const fileName = filePath.split('/').pop()?.replace('.md', '')
      const post = posts.value.find((p) => p.slug === slug)
      const targetMatch = post?.slug === slug && (fileName === slug || filePath.includes(slug))

      if (targetMatch || fileName === slug) {
        try {
          const raw = (await loader()) as string
          // 移除 frontmatter YAML 头
          const cleanContent = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
          contentCache.value[slug] = cleanContent
          return cleanContent
        } catch (err) {
          console.error(`Failed to load markdown content for slug: ${slug}`, err)
          throw err
        }
      }
    }

    throw new Error(`Post with slug "${slug}" not found in markdown files.`)
  }

  return {
    posts,
    tags,
    activeTag,
    filteredPosts,
    getPostBySlug,
    setActiveTag,
    loadPostContent,
  }
})
