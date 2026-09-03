import { marked, type TokenizerExtension, type RendererExtension, type Tokens } from 'marked'
import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify'
import katex from 'katex'

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

const blockMath: TokenizerExtension & RendererExtension = {
  name: 'blockMath',
  level: 'block',
  start(src: string) {
    return src.indexOf('$$')
  },
  tokenizer(src: string) {
    const match = src.match(/^\$\$([\s\S]+?)\$\$(?:\n+|$)/)
    if (match) {
      return {
        type: 'blockMath',
        raw: match[0],
        text: match[1].trim(),
      }
    }
  },
  renderer(token: Tokens.Generic) {
    try {
      const mathHtml = katex.renderToString(token.text, {
        displayMode: true,
        throwOnError: false,
      })
      return `<div class="katex-block-wrapper">${mathHtml}</div>\n`
    } catch (err) {
      console.warn('KaTeX block render error:', err)
      return `<div class="katex-block-wrapper"><pre class="katex-error">${escapeHtml(token.text)}</pre></div>\n`
    }
  },
}

const inlineMath: TokenizerExtension & RendererExtension = {
  name: 'inlineMath',
  level: 'inline',
  start(src: string) {
    let index = src.indexOf('$')
    while (index !== -1) {
      if (index === 0 || src[index - 1] !== '\\') {
        return index
      }
      index = src.indexOf('$', index + 1)
    }
    return -1
  },
  tokenizer(src: string) {
    // 1. 优先匹配行内或段落内双美元符 $$...$$（比如段落内部展示公式，或末尾带有引号/标点的场景）
    const matchDouble = src.match(/^\$\$((?:\\.|[^$\\])+?)\$\$/)
    if (matchDouble) {
      return {
        type: 'inlineMath',
        raw: matchDouble[0],
        text: matchDouble[1].trim(),
        displayMode: true,
      }
    }

    // 2. 匹配单美元符 $...$
    const matchSingle = src.match(/^\$(?!\$)((?:\\.|[^$\\\n])+?)\$/)
    if (matchSingle) {
      return {
        type: 'inlineMath',
        raw: matchSingle[0],
        text: matchSingle[1].trim(),
        displayMode: false,
      }
    }
  },
  renderer(token: Tokens.Generic) {
    try {
      const isDisplay = Boolean(token.displayMode)
      const mathHtml = katex.renderToString(token.text, {
        displayMode: isDisplay,
        throwOnError: false,
      })
      if (isDisplay) {
        return `<span class="katex-display-inline">${mathHtml}</span>`
      }
      return mathHtml
    } catch (err) {
      console.warn('KaTeX inline render error:', err)
      return `<code class="katex-error">${escapeHtml(token.text)}</code>`
    }
  },
}

marked.use({
  extensions: [blockMath, inlineMath],
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
    // MathML elements for KaTeX rendering
    'math',
    'semantics',
    'annotation',
    'annotation-xml',
    'mrow',
    'mo',
    'mi',
    'mn',
    'msup',
    'msub',
    'msubsup',
    'mfrac',
    'mspace',
    'mover',
    'munder',
    'munderover',
    'mtable',
    'mtr',
    'mtd',
    'mtext',
    'msqrt',
    'mroot',
    'mpadded',
    'mphantom',
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
    // KaTeX & MathML attributes
    'aria-hidden',
    'aria-label',
    'display',
    'mathvariant',
    'mathsize',
    'columnalign',
    'rowspacing',
    'columnspacing',
    'linethickness',
    'accent',
    'accentunder',
    'fence',
    'separator',
    'stretchy',
    'symmetric',
    'lspace',
    'rspace',
    'largeop',
    'movablelimits',
    'encoding',
  ],
  ALLOW_DATA_ATTR: true,
  RETURN_TRUSTED_TYPE: false,
}

/**
 * 针对 Markdown 语法的严谨鲁棒性预处理器
 * 解决 CommonMark / GFM 规范中 CJK 汉字与中英文标点紧邻时加粗定界符无法闭合的问题，
 * 以及加粗内部首尾意外留白导致的解析失效。
 * 同时保护代码块与数学公式块免受二次修改干扰。
 */
export function preprocessMarkdown(markdown: string): string {
  if (!markdown) return ''

  // 1. 保护代码块与数学公式块，避免它们内部的字符被 Markdown 语法预处理误伤
  const protectedBlocks: { placeholder: string; content: string }[] = []
  let placeholderIndex = 0

  const pushPlaceholder = (match: string, type: string) => {
    const placeholder = `@@@MARKDOWN_${type}_${placeholderIndex++}@@@`
    protectedBlocks.push({ placeholder, content: match })
    return placeholder
  }

  // 1.1 保护多行代码块 ```...```
  let text = markdown.replace(/(```[\s\S]*?```)/g, (match) => pushPlaceholder(match, 'CODE_BLOCK'))

  // 1.2 保护行内代码 `...`
  text = text.replace(/(`[^`\n]+`)/g, (match) => pushPlaceholder(match, 'INLINE_CODE'))

  // 1.3 保护块级数学公式 $$...$$
  text = text.replace(/(\$\$[\s\S]+?\$\$)/g, (match) => pushPlaceholder(match, 'BLOCK_MATH'))

  // 1.4 保护行内数学公式 $...$
  text = text.replace(/(?<!\\)\$(?!\$)((?:\\.|[^$\\\n])+?)\$/g, (match) => pushPlaceholder(match, 'INLINE_MATH'))

  // 2. 精确匹配加粗定界符 **...**
  // 规则：匹配内部不含连续双星号的加粗内容（允许单个星号，如 /assets/*.js），并进行 CJK 标点边缘和空格修正
  const isPunctuationOrSymbol = (ch: string) => /[\p{P}\p{S}]/u.test(ch)
  const isLetterOrDigit = (ch: string) => /[\p{L}\p{N}\u4e00-\u9fa5]/u.test(ch)

  text = text.replace(/(?<!\*)\*\*((?:\*(?!\*)|[^\*\r\n])+?)\*\*(?!\*)/gu, (match, inner, offset, fullText) => {
    const cleanInner = inner.trim()
    if (!cleanInner) return match

    let prefix = ''
    let suffix = ''

    const charBefore = offset > 0 ? fullText[offset - 1] : ''
    const charAfter = offset + match.length < fullText.length ? fullText[offset + match.length] : ''

    const firstChar = cleanInner[0]
    const lastChar = cleanInner[cleanInner.length - 1]

    // 如果内部以标点结尾，且外部紧跟字母/汉字 -> 外部补充空格
    if (isPunctuationOrSymbol(lastChar) && isLetterOrDigit(charAfter)) {
      suffix = ' '
    }

    // 如果内部以标点开头，且外部前面紧随字母/汉字 -> 前面补充空格
    if (isPunctuationOrSymbol(firstChar) && isLetterOrDigit(charBefore)) {
      prefix = ' '
    }

    return `${prefix}**${cleanInner}**${suffix}`
  })

  // 3. 逆序完整还原受保护的代码块与数学公式（使用函数返回值，避免 $$ 被 JS replace 当作转义符而丢失一个 $）
  for (let i = protectedBlocks.length - 1; i >= 0; i--) {
    text = text.replace(protectedBlocks[i].placeholder, () => protectedBlocks[i].content)
  }

  return text
}

/**
 * 将 Markdown 渲染为消毒后的安全 HTML
 */
export function renderMarkdownToSafeHtml(markdown: string): string {
  const source = markdown.trim()
  if (!source) return ''

  const preprocessed = preprocessMarkdown(source)
  const rawHtml = marked.parse(preprocessed, { async: false }) as string

  let clean = rawHtml
  if (typeof DOMPurify?.sanitize === 'function') {
    clean = DOMPurify.sanitize(rawHtml, CONTENT_HTML_PURIFY) as string
  } else if (typeof (DOMPurify as any)?.default?.sanitize === 'function') {
    clean = (DOMPurify as any).default.sanitize(rawHtml, CONTENT_HTML_PURIFY) as string
  }

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
