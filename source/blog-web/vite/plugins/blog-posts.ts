import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface BlogPostMeta {
  slug: string
  title: string
  date: string
  tags: string[]
  summary: string
  readingTime: number
  link?: string
}

const VIRTUAL_MODULE_ID = 'virtual:blog-posts'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

function parseFrontmatter(rawContent: string, defaultSlug: string): { meta: BlogPostMeta; body: string } {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  let title = defaultSlug
  let date = new Date().toISOString().slice(0, 10)
  let tags: string[] = []
  let slug = defaultSlug
  let summary = ''
  let link: string | undefined = undefined
  let body = rawContent

  if (match) {
    const yamlBlock = match[1]
    body = match[2]

    const lines = yamlBlock.split(/\r?\n/)
    for (const line of lines) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).trim()
      let value = line.slice(colonIdx + 1).trim()

      // Strip outer quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }

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
            .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
            .filter(Boolean)
        } else if (value) {
          tags = [value]
        }
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
