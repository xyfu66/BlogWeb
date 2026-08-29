export interface BlogPostMeta {
  slug: string
  title: string
  date: string
  tags: string[]
  summary: string
  readingTime: number
}

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
