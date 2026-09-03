import type { BlogPostMeta, SeriesMeta } from '../types/post.ts'

/**
 * 日期降序比较器（最新日期排在最前）
 * 使用 Date.parse 避免高频实例化 Date 对象，零堆内存分配
 */
export function compareDateDesc(dateA?: string, dateB?: string): number {
  const timeA = dateA ? Date.parse(dateA) || 0 : 0
  const timeB = dateB ? Date.parse(dateB) || 0 : 0
  return timeB - timeA
}

/**
 * 可选数值降序比较器（数值越大越靠前；有值优先于无值）
 * 遵循确定性裁决，消除分散在各处的判空样板代码
 */
export function compareOptionalDesc(a?: number | null, b?: number | null): number {
  const hasA = a !== undefined && a !== null
  const hasB = b !== undefined && b !== null
  if (hasA && hasB) {
    return b - a
  }
  if (hasA) return -1
  if (hasB) return 1
  return 0
}

/**
 * 同一合集内部章节序号比较（降序：最新发表的章节排在前面）
 */
export function compareSameSeriesPartDesc(a: BlogPostMeta, b: BlogPostMeta): number {
  if (a.series?.slug && b.series?.slug && a.series.slug === b.series.slug) {
    return (b.series.part ?? 0) - (a.series.part ?? 0)
  }
  return 0
}

/**
 * 跨类别文章分类比较（未设显式权重时，独立专题文章排在合集之前，防止长合集垄断首页）
 */
export function compareCategory(a: BlogPostMeta, b: BlogPostMeta): number {
  const isSeriesA = !!a.series?.slug
  const isSeriesB = !!b.series?.slug
  if (isSeriesA !== isSeriesB) {
    return isSeriesA ? 1 : -1
  }
  return 0
}

/**
 * 全局文章复合比较器（工业级短路比较器链）
 * 严格遵循 6 级确定性规则：
 * 1. 发布时间 date 降序
 * 2. 文章级权重 order 降序
 * 3. 同一合集内按章节 part 降序
 * 4. 不同合集间按合集 series.order 降序
 * 5. 跨类别同日发布：独立文章排在合集之前
 * 6. 确定性稳定兜底：按 slug 字母升序
 */
export function comparePosts(a: BlogPostMeta, b: BlogPostMeta): number {
  return (
    compareDateDesc(a.date, b.date) ||
    compareOptionalDesc(a.order, b.order) ||
    compareSameSeriesPartDesc(a, b) ||
    compareOptionalDesc(a.series?.order, b.series?.order) ||
    compareCategory(a, b) ||
    a.slug.localeCompare(b.slug)
  )
}

/**
 * 专栏合集复合比较器（工业级比较器链）
 * 1. 权重 order 降序
 * 2. 最新更新时间 updatedAt 降序
 * 3. 确定性稳定兜底：按 slug 字母升序
 */
export function compareSeries(a: SeriesMeta, b: SeriesMeta): number {
  return (
    compareOptionalDesc(a.order, b.order) ||
    compareDateDesc(a.updatedAt, b.updatedAt) ||
    a.slug.localeCompare(b.slug)
  )
}
