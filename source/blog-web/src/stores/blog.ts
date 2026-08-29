import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { BlogPostMeta, TagCount, SeriesMeta } from '@/types/post'
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

  // 计算专栏 / 系列合集列表
  const seriesList = computed<SeriesMeta[]>(() => {
    const map = new Map<string, SeriesMeta>()

    for (const post of posts.value) {
      if (!post.series?.slug || !post.series?.name) continue

      const slug = post.series.slug
      if (!map.has(slug)) {
        map.set(slug, {
          slug,
          name: post.series.name,
          description: post.series.description || '',
          postsCount: 0,
          posts: [],
          tags: [],
          updatedAt: post.date,
        })
      }

      const series = map.get(slug)!
      series.posts.push(post)
      if (post.series.description && !series.description) {
        series.description = post.series.description
      }
      if (post.date > series.updatedAt) {
        series.updatedAt = post.date
      }
      // 聚合标签
      for (const t of post.tags || []) {
        if (!series.tags.includes(t)) {
          series.tags.push(t)
        }
      }
    }

    const result = Array.from(map.values())
    for (const item of result) {
      item.postsCount = item.posts.length
      // 按章节序号或日期排序（正序）
      item.posts.sort((a, b) => {
        const partA = a.series?.part ?? 999
        const partB = b.series?.part ?? 999
        if (partA !== partB) return partA - partB
        return new Date(a.date).getTime() - new Date(b.date).getTime()
      })
    }

    return result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  })

  function getPostBySlug(slug: string): BlogPostMeta | undefined {
    return posts.value.find((p) => p.slug === slug)
  }

  function getSeriesBySlug(slug: string): SeriesMeta | undefined {
    return seriesList.value.find((s) => s.slug === slug)
  }

  /**
   * 获取指定文章在所属专栏中的上下文与导航信息
   */
  function getPostSeriesContext(postSlug: string) {
    const post = getPostBySlug(postSlug)
    if (!post?.series?.slug) return null

    const series = getSeriesBySlug(post.series.slug)
    if (!series) return null

    const currentIndex = series.posts.findIndex((p) => p.slug === postSlug)
    if (currentIndex === -1) return null

    return {
      series,
      currentPost: post,
      currentIndex,
      currentPart: post.series.part ?? (currentIndex + 1),
      totalParts: series.postsCount,
      prevInSeries: currentIndex > 0 ? series.posts[currentIndex - 1] : null,
      nextInSeries: currentIndex < series.posts.length - 1 ? series.posts[currentIndex + 1] : null,
      chapters: series.posts,
    }
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
    seriesList,
    activeTag,
    filteredPosts,
    getPostBySlug,
    getSeriesBySlug,
    getPostSeriesContext,
    setActiveTag,
    loadPostContent,
  }
})
