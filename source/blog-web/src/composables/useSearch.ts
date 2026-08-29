import { ref, computed } from 'vue'
import { useBlogStore } from '@/stores/blog'
import type { SearchResultItem } from '@/types/post'

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function highlightText(text: string, query: string): string {
  if (!query.trim() || !text) return text
  const regex = new RegExp(`(${escapeRegExp(query.trim())})`, 'gi')
  return text.replace(regex, '<mark class="bl-highlight">$1</mark>')
}

export function useSearch() {
  const blogStore = useBlogStore()
  const searchQuery = ref('')

  const searchResults = computed<SearchResultItem[]>(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return []

    const results: SearchResultItem[] = []

    for (const post of blogStore.posts) {
      const matchTitle = post.title.toLowerCase().includes(query)
      const matchSummary = post.summary.toLowerCase().includes(query)
      const matchedTags = (post.tags || []).filter((t) => t.toLowerCase().includes(query))

      if (matchTitle || matchSummary || matchedTags.length > 0) {
        results.push({
          post,
          highlightedTitle: highlightText(post.title, query),
          highlightedSummary: highlightText(post.summary, query),
          matchedTags,
        })
      }
    }

    return results
  })

  return {
    searchQuery,
    searchResults,
    highlightText,
  }
}
