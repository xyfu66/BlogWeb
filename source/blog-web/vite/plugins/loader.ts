import fs from 'node:fs'
import path from 'node:path'
import type { BlogPostMeta, SeriesConfig, SeriesMeta } from '../../src/types/post.ts'
import { parseFrontmatter } from './parser.ts'
import { comparePosts, compareSeries, compareDateDesc } from '../../src/utils/comparator.ts'

/**
 * 博客数据编排引擎
 * 严格按照 articles/ 独立文章与 series/[slug]/ 专栏合集包规范进行分层扫描与结构化注入
 */
export function loadBlogData(postsDir: string): { posts: BlogPostMeta[]; seriesList: SeriesMeta[] } {
  if (!fs.existsSync(postsDir)) {
    return { posts: [], seriesList: [] }
  }

  const allPosts: BlogPostMeta[] = []
  const seriesMap = new Map<string, SeriesMeta>()

  // 1. 扫描专栏目录规范：src/posts/series/<series-slug>/
  const seriesRootDir = path.join(postsDir, 'series')
  if (fs.existsSync(seriesRootDir)) {
    const seriesEntries = fs.readdirSync(seriesRootDir, { withFileTypes: true })
    for (const entry of seriesEntries) {
      if (!entry.isDirectory()) continue

      const seriesDir = path.join(seriesRootDir, entry.name)
      const configPath = fs.existsSync(path.join(seriesDir, 'series.json'))
        ? path.join(seriesDir, 'series.json')
        : fs.existsSync(path.join(seriesDir, 'meta.json'))
          ? path.join(seriesDir, 'meta.json')
          : null

      let seriesConfig: SeriesConfig = {
        slug: entry.name,
        name: entry.name,
      }

      if (configPath) {
        try {
          const configJson = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          seriesConfig = { ...seriesConfig, ...configJson }
        } catch (err) {
          console.error(`[blog-posts-plugin] Failed to parse series metadata at ${configPath}:`, err)
        }
      }

      const chapterFiles = fs.readdirSync(seriesDir).filter((f) => f.endsWith('.md'))
      const chapterPosts: BlogPostMeta[] = []

      for (const file of chapterFiles) {
        const filePath = path.join(seriesDir, file)
        const rawContent = fs.readFileSync(filePath, 'utf-8')
        const defaultSlug = path.basename(file, '.md')
        const { meta } = parseFrontmatter(rawContent, defaultSlug, seriesConfig)
        chapterPosts.push(meta)
        allPosts.push(meta)
      }

      // 章节按 Part (1, 2, 3...) 正序排列，便于读者顺序阅读
      chapterPosts.sort((a, b) => {
        const partA = a.series?.part ?? 999
        const partB = b.series?.part ?? 999
        if (partA !== partB) return partA - partB
        return compareDateDesc(b.date, a.date)
      })

      // 聚合专栏标签与最新更新时间
      const tagsSet = new Set<string>(seriesConfig.tags || [])
      let latestDate = '1970-01-01'
      for (const p of chapterPosts) {
        for (const t of p.tags || []) {
          tagsSet.add(t)
        }
        if (p.date > latestDate) {
          latestDate = p.date
        }
      }

      seriesMap.set(seriesConfig.slug, {
        slug: seriesConfig.slug,
        name: seriesConfig.name,
        description: seriesConfig.description,
        cover: seriesConfig.cover,
        order: seriesConfig.order,
        postsCount: chapterPosts.length,
        posts: chapterPosts,
        tags: Array.from(tagsSet),
        updatedAt: latestDate === '1970-01-01' ? new Date().toISOString().slice(0, 10) : latestDate,
      })
    }
  }

  // 2. 扫描独立普通文章目录规范：src/posts/articles/*.md
  const articlesDir = path.join(postsDir, 'articles')
  if (fs.existsSync(articlesDir)) {
    const articleFiles = fs.readdirSync(articlesDir).filter((f) => f.endsWith('.md'))
    for (const file of articleFiles) {
      const filePath = path.join(articlesDir, file)
      const rawContent = fs.readFileSync(filePath, 'utf-8')
      const defaultSlug = path.basename(file, '.md')
      const { meta } = parseFrontmatter(rawContent, defaultSlug)
      allPosts.push(meta)
    }
  }

  // 3. 容错扫描：根目录散落的普通文章（src/posts/*.md）
  const rootEntries = fs.readdirSync(postsDir, { withFileTypes: true })
  for (const entry of rootEntries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const filePath = path.join(postsDir, entry.name)
      const rawContent = fs.readFileSync(filePath, 'utf-8')
      const defaultSlug = path.basename(entry.name, '.md')
      const { meta } = parseFrontmatter(rawContent, defaultSlug)
      allPosts.push(meta)
    }
  }

  // 专栏排序：委托纯函数比较器
  const seriesList = Array.from(seriesMap.values()).sort(compareSeries)

  // 全局文章排序：委托工业级短路比较器链
  allPosts.sort(comparePosts)

  return { posts: allPosts, seriesList }
}
