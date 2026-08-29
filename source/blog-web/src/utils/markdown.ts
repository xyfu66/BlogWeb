import { marked } from 'marked'
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify'

marked.setOptions({
  gfm: true,
  breaks: false,
})

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

marked.use({
  renderer: {
    code(token: any) {
      const text = typeof token === 'string' ? token : token.text || ''
      const lang = typeof token === 'object' ? token.lang : ''

      if (lang === 'mermaid') {
        // 输出供 mermaid.js 客户端渲染的专用容器，进行实体转义防止 HTML 解析器破坏图表语法
        return `<div class="mermaid-diagram"><pre class="mermaid">${escapeHtml(text)}</pre></div>`
      }
      return false
    },
  },
})

const CONTENT_HTML_PURIFY: DomPurifyConfig = {
  ALLOWED_TAGS: [
    'div',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'b',
    'strong',
    'em',
    'i',
    'ul',
    'ol',
    'li',
    'a',
    'br',
    'span',
    'code',
    'pre',
    'hr',
    'blockquote',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'img',
    'mark',
    'del',
    'svg',
    'g',
    'path',
    'rect',
    'circle',
    'line',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'defs',
    'marker',
    'style',
    'foreignObject',
    'desc',
    'title',
    'clipPath',
    'linearGradient',
    'radialGradient',
    'stop',
    'use',
  ],
  ALLOWED_ATTR: [
    'href',
    'title',
    'target',
    'rel',
    'src',
    'alt',
    'class',
    'id',
    'style',
    'viewBox',
    'xmlns',
    'd',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'stroke-linecap',
    'stroke-linejoin',
    'transform',
    'points',
    'marker-end',
    'marker-start',
    'text-anchor',
    'dominant-baseline',
    'font-size',
    'font-family',
    'font-weight',
    'width',
    'height',
    'x',
    'y',
    'x1',
    'y1',
    'x2',
    'y2',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'opacity',
    'data-id',
  ],
  ALLOW_DATA_ATTR: true,
  RETURN_TRUSTED_TYPE: false,
}

/**
 * 将 Markdown 渲染为消毒后的安全 HTML
 */
export function renderMarkdownToSafeHtml(markdown: string): string {
  const source = markdown.trim()
  if (!source) return ''

  const rawHtml = marked.parse(source, { async: false }) as string
  const clean = DOMPurify.sanitize(rawHtml, CONTENT_HTML_PURIFY) as string
  return hardenExternalLinks(clean)
}

/**
 * 提取 Markdown 正文中的标题目录 (Table of Contents)
 */
export interface TocItem {
  id: string
  text: string
  level: number
}

export function extractToc(markdown: string): TocItem[] {
  const headingRegex = /^(#{1,4})\s+(.+)$/gm
  const toc: TocItem[] = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length
    const text = match[2].trim().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    const id = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')

    toc.push({ id: id || `heading-${toc.length}`, text, level })
  }

  return toc
}

/**
 * 对外链自动补充 target="_blank" 和 rel="noopener noreferrer"
 */
function hardenExternalLinks(html: string): string {
  if (typeof window === 'undefined') return html
  const doc = new DOMParser().parseFromString(`<div id="root">${html}</div>`, 'text/html')
  const root = doc.getElementById('root')
  if (!root) return html

  root.querySelectorAll('a[href]').forEach((anchor) => {
    const href = anchor.getAttribute('href') || ''
    if (/^https?:/i.test(href)) {
      anchor.setAttribute('target', '_blank')
      anchor.setAttribute('rel', 'noopener noreferrer')
    }
  })

  // 为标题补充 slug id
  root.querySelectorAll('h1, h2, h3, h4').forEach((heading) => {
    const text = heading.textContent || ''
    const id = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
      .replace(/^-+|-+$/g, '')
    if (id && !heading.getAttribute('id')) {
      heading.setAttribute('id', id)
    }
  })

  return root.innerHTML
}
