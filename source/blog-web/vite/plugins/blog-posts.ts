import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface PostSeriesInfo {
  name: string
  slug: string
  part?: number
  description?: string
}

export interface BlogPostMeta {
  slug: string
  title: string
  date: string
  tags: string[]
  summary: string
  readingTime: number
  link?: string
  series?: PostSeriesInfo
}

const VIRTUAL_MODULE_ID = 'virtual:blog-posts'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

function cleanQuotes(str: string): string {
  let val = str.trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  return val
}

function parseFrontmatter(rawContent: string, defaultSlug: string): { meta: BlogPostMeta; body: string } {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  let title = defaultSlug
  let date = new Date().toISOString().slice(0, 10)
  let tags: string[] = []
  let slug = defaultSlug
  let summary = ''
  let link: string | undefined = undefined
  let series: PostSeriesInfo | undefined = undefined
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

      // Check indentation for nested series block
      if (inSeriesBlock && (line.startsWith(' ') || line.startsWith('\t'))) {
        const colonIdx = trimmedLine.indexOf(':')
        if (colonIdx !== -1) {
          const subKey = trimmedLine.slice(0, colonIdx).trim()
          let subVal = cleanQuotes(trimmedLine.slice(colonIdx + 1))
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
      let value = cleanQuotes(line.slice(colonIdx + 1))

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

    if (seriesTemp.name) {
      const seriesSlug = seriesTemp.slug || seriesTemp.name.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '')
      series = {
        name: seriesTemp.name,
        slug: seriesSlug,
        part: seriesTemp.part,
        ...(seriesTemp.description ? { description: seriesTemp.description } : {}),
      }
    }
  }

  if (!summary) {
    const plainText = body.replace(/#+\s+/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
    summary = plainText.slice(0, 140) + (plainText.length > 140 ? '...' : '')
  }

  const charCount = body.replace(/\s+/g, '').length
  const readingTime = Math.max(1, Math.ceil(charCount / 300))

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

function loadAllPosts(postsDir: string): BlogPostMeta[] {
  if (!fs.existsSync(postsDir)) {
    return []
  }

  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md'))
  const posts: BlogPostMeta[] = []

  for (const file of files) {
    const filePath = path.join(postsDir, file)
    const rawContent = fs.readFileSync(filePath, 'utf-8')
    const defaultSlug = path.basename(file, '.md')
    const { meta } = parseFrontmatter(rawContent, defaultSlug)
    posts.push(meta)
  }

  posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return posts
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
        const posts = loadAllPosts(postsDir)
        return `export const posts = ${JSON.stringify(posts, null, 2)};\nexport default posts;`
      }
    },
    handleHotUpdate({ file, server }) {
      if (file.includes('src/posts') && file.endsWith('.md')) {
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
