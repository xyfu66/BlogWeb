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

export interface SeriesMeta {
  slug: string
  name: string
  description?: string
  postsCount: number
  posts: BlogPostMeta[]
  tags: string[]
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

