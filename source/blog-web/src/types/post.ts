/**
 * 文章归属合集元信息
 */
export interface PostSeriesInfo {
  /** 合集显示名称 */
  name: string
  /** 合集唯一标识符（目录名） */
  slug: string
  /** 章节/分卷序号（正整数，越大代表越新的章节） */
  part?: number
  /** 所属合集全局权重（数值越大越优先） */
  order?: number
  /** 合集简要概述 */
  description?: string
}

/**
 * 博客文章核心元数据
 */
export interface BlogPostMeta {
  /** 文章唯一标识符（通常为文件名无扩展名） */
  slug: string
  /** 文章主标题 */
  title: string
  /** 发布日期（支持 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss） */
  date: string
  /** 分类标签列表 */
  tags: string[]
  /** 文章纯文本摘要 */
  summary: string
  /** 预估阅读耗时（分钟） */
  readingTime: number
  /** 外部跳转链接（若有） */
  link?: string
  /** 关联专栏信息（若归属于某个合集） */
  series?: PostSeriesInfo
  /** 文章显式权重（用于人工置顶或同日冲突提权，数值越大越靠前） */
  order?: number
}

/**
 * 专栏合集静态配置定义（series.json / meta.json）
 */
export interface SeriesConfig {
  /** 合集 Slug 标识 */
  slug: string
  /** 合集名称 */
  name: string
  /** 合集详细描述 */
  description?: string
  /** 合集全局排序权重（降序，数值越大越靠前） */
  order?: number
  /** 封面图路径 */
  cover?: string
  /** 专栏标签列表 */
  tags?: string[]
}

/**
 * 运行时聚合后的专栏完整元信息
 */
export interface SeriesMeta {
  /** 合集 Slug 标识 */
  slug: string
  /** 合集名称 */
  name: string
  /** 合集描述 */
  description?: string
  /** 封面图路径 */
  cover?: string
  /** 合集排序权重 */
  order?: number
  /** 专栏下文章总数 */
  postsCount: number
  /** 章节列表（按 Part 正序排列，便于线性阅读） */
  posts: BlogPostMeta[]
  /** 聚合标签 */
  tags: string[]
  /** 最新更新日期（YYYY-MM-DD） */
  updatedAt: string
}

export type PostNavigationTarget = Pick<BlogPostMeta, 'slug' | 'link'>

export interface TagCount {
  name: string
  count: number
}

export interface SearchResultItem {
  post: BlogPostMeta
  highlightedTitle: string
  highlightedSummary: string
  matchedTags: string[]
}

