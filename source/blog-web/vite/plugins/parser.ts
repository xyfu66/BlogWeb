import path from 'node:path'
import type {
  BlogPostMeta,
  PostSeriesInfo,
  SeriesConfig,
} from '../../src/types/post.ts'

/**
 * 清除字符串首尾的双引号与单引号
 */
export function cleanQuotes(str: string): string {
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
export function generateCleanSummary(body: string, maxLength = 160): string {
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
export function calculateReadingTime(rawContent: string): number {
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
export function extractPartFromFilename(filename: string): number | undefined {
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
export function parseFrontmatter(
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
  let explicitOrder: number | undefined = undefined
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
          } else if (subKey === 'part' || subKey === 'index') {
            seriesTemp.part = parseInt(subVal, 10) || undefined
          } else if (subKey === 'order') {
            seriesTemp.order = parseInt(subVal, 10) || undefined
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
      } else if (key === 'part') {
        explicitPart = parseInt(value, 10) || undefined
      } else if (key === 'order' || key === 'priority') {
        explicitOrder = parseInt(value, 10) || undefined
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
      } else if (key === 'series_part') {
        seriesTemp.part = parseInt(value, 10) || undefined
      } else if (key === 'series_order') {
        seriesTemp.order = parseInt(value, 10) || undefined
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
        ...(seriesTemp.order !== undefined ? { order: seriesTemp.order } : {}),
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
      order: parentSeriesConfig.order,
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
      ...(explicitOrder !== undefined ? { order: explicitOrder } : {}),
      ...(link ? { link } : {}),
      ...(series ? { series } : {}),
    },
    body,
  }
}
