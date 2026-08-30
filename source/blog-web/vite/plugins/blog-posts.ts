import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type {
  BlogPostMeta,
  PostSeriesInfo,
  SeriesConfig,
  SeriesMeta,
} from '../../src/types/post.ts'

export type { BlogPostMeta, PostSeriesInfo, SeriesConfig, SeriesMeta }

const VIRTUAL_MODULE_ID = 'virtual:blog-posts'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

/**
 * 清除字符串首尾的双引号与单引号
 */
function cleanQuotes(str: string): string {
  let val = str.trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  return val
}

/**
 * 工业级 Markdown 纯文本摘要生成器
 * 过滤代码块、图片、行内标记与 HTML，提取语义纯文本
 */
function generateCleanSummary(body: string, maxLength = 160): string {
  const plainText = body
    .replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g, '')
    .replace(/\x60[^\x60]+\x60/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/#+\s+/g, '')
    .replace(/[*_~\x60>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (plainText.length <= maxLength) {
    return plainText
  }
  return plainText.slice(0, maxLength) + '...'
}

/**
 * 国际化多语言精准阅读时长计算（中英混合智能加权）
 * 中文字符按 300 字/分钟，西文字词按 200 词/分钟
 */
function calculateReadingTime(rawContent: string): number {
  const cleaned = rawContent
    .replace(/\x60\x60\x60[\s\S]*?\x60\x60\x60/g, '')
    .replace(/<[^>]+>/g, '')

  const cjkMatches = cleaned.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) || []
  const nonCjkText = cleaned.replace(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, ' ')
  const words = nonCjkText.trim().split(/\s+/).filter(Boolean)

  const cjkCount = cjkMatches.length
  const wordCount = words.length

  const minutes = cjkCount / 300 + wordCount / 200
  return Math.max(1, Math.ceil(minutes))
}

/**
 * 从文件名中提取章节序号（如 01-xxx, part-1, xxx-1 等）
 */
function extractPartFromFilename(filename: string): number | undefined {
  const base = path.basename(filename, '.md')
  const match = base.match(/(?:part[-_]?(\d+)|^(\d+)[-_]|[-_](\d+)$)/i)
  if (match) {
    const num = match[1] || match[2] || match[3]
    if (num) return parseInt(num, 10)
  }
  return undefined
}

/**
 * 解析 Markdown 文件的 Frontmatter YAML 元数据与正文
 */
function parseFrontmatter(
  rawContent: string,
  defaultSlug: string,
  parentSeriesConfig?: SeriesConfig,
): { meta: BlogPostMeta; body: string } {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  let title = defaultSlug
  let date = new Date().toISOString().slice(0, 10)
  let tags: string[] = []
  let slug = defaultSlug
  let summary = ''
  let link: string | undefined = undefined
  let series: PostSeriesInfo | undefined = undefined
  let explicitPart: number | undefined = undefined
  let body = rawContent

  if (match) {
    const yamlBlock = match[1]
    body = match[2]

    const lines = yamlBlock.split(/\r?\n/)
    let inSeriesBlock = false
    const seriesTemp: Partial<PostSeriesInfo> = {}

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine || trimmedLine.startsWith('#')) continue

      // 解析缩进的嵌套 series 声明
      if (inSeriesBlock && (line.startsWith(' ') || line.startsWith('\t'))) {
        const colonIdx = trimmedLine.indexOf(':')
        if (colonIdx !== -1) {
          const subKey = trimmedLine.slice(0, colonIdx).trim()
          const subVal = cleanQuotes(trimmedLine.slice(colonIdx + 1))
          if (subKey === 'name' || subKey === 'title') {
            seriesTemp.name = subVal
          } else if (subKey === 'slug') {
            seriesTemp.slug = subVal
          } else if (subKey === 'part' || subKey === 'order' || subKey === 'index') {
            seriesTemp.part = parseInt(subVal, 10) || undefined
          } else if (subKey === 'description' || subKey === 'desc' || subKey === 'summary') {
            seriesTemp.description = subVal
          }
        }
        continue
      } else {
        inSeriesBlock = false
      }

      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      const value = cleanQuotes(line.slice(colonIdx + 1))

      if (key === 'title') {
        title = value
      } else if (key === 'date') {
        date = value
      } else if (key === 'slug') {
        slug = value
      } else if (key === 'summary') {
        summary = value
      } else if (key === 'link' || key === 'external_url' || key === 'url' || key === 'source_url') {
        link = value
      } else if (key === 'part' || key === 'order') {
        explicitPart = parseInt(value, 10) || undefined
      } else if (key === 'tags') {
        if (value.startsWith('[') && value.endsWith(']')) {
          tags = value
            .slice(1, -1)
            .split(',')
            .map((t) => cleanQuotes(t.trim()))
            .filter(Boolean)
        } else if (value) {
          tags = [value]
        }
      } else if (key === 'series') {
        if (value) {
          seriesTemp.name = value
        } else {
          inSeriesBlock = true
        }
      } else if (key === 'series_name') {
        seriesTemp.name = value
      } else if (key === 'series_slug') {
        seriesTemp.slug = value
      } else if (key === 'series_part' || key === 'series_order') {
        seriesTemp.part = parseInt(value, 10) || undefined
      } else if (key === 'series_description') {
        seriesTemp.description = value
      }
    }

    if (seriesTemp.name || seriesTemp.slug) {
      const seriesSlug =
        seriesTemp.slug ||
        seriesTemp.name?.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') ||
        'series'
      series = {
        name: seriesTemp.name || seriesSlug,
        slug: seriesSlug,
        part: seriesTemp.part ?? explicitPart,
        ...(seriesTemp.description ? { description: seriesTemp.description } : {}),
      }
    }
  }

  // 若文章归属于专栏目录，则以所属专栏配置进行上下文注入与融合
  if (parentSeriesConfig) {
    const filePart = explicitPart ?? series?.part ?? extractPartFromFilename(defaultSlug)
    series = {
      name: parentSeriesConfig.name,
      slug: parentSeriesConfig.slug,
      part: filePart,
      ...(parentSeriesConfig.description ? { description: parentSeriesConfig.description } : {}),
    }
  }

  // 若无显式摘要，自动生成纯文本摘要
  if (!summary) {
    summary = generateCleanSummary(body)
  }

  // 国际化精准阅读耗时
  const readingTime = calculateReadingTime(body)

  return {
    meta: {
      slug,
      title,
      date,
      tags,
      summary,
      readingTime,
      ...(link ? { link } : {}),
      ...(series ? { series } : {}),
    },
    body,
  }
}

/**
 * 核心数据加载与关系编排引擎
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

      // 章节按 Part (1, 2, 3...) 正序排列
      chapterPosts.sort((a, b) => {
        const partA = a.series?.part ?? 999
        const partB = b.series?.part ?? 999
        if (partA !== partB) return partA - partB
        return new Date(a.date).getTime() - new Date(b.date).getTime()
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

  // 专栏排序：order 升序 -> updatedAt 降序
  const seriesList = Array.from(seriesMap.values()).sort((a, b) => {
    const orderA = a.order ?? 999
    const orderB = b.order ?? 999
    if (orderA !== orderB) return orderA - orderB
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  // 全局文章排序：date 降序
  allPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return { posts: allPosts, seriesList }
}

export function blogPostsPlugin(): Plugin {
  let rootDir = ''

  return {
    name: 'vite-plugin-blog-posts',
    configResolved(config) {
      rootDir = config.root || fileURLToPath(new URL('../..', import.meta.url))
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const postsDir = path.resolve(rootDir, 'src/posts')
        const { posts, seriesList } = loadBlogData(postsDir)
        return `export const posts = ${JSON.stringify(posts, null, 2)};\nexport const seriesList = ${JSON.stringify(seriesList, null, 2)};\nexport default posts;`
      }
    },
    handleHotUpdate({ file, server }) {
      if (
        file.includes('src/posts') &&
        (file.endsWith('.md') || file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml'))
      ) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
          server.ws.send({
            type: 'full-reload',
          })
        }
      }
    },
  }
}
