<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSearch } from '@/composables/useSearch'
import { usePostNavigation } from '@/composables/usePostNavigation'
import type { PostNavigationTarget } from '@/types/post'

const router = useRouter()
const { searchQuery, searchResults } = useSearch()
const { navigateToPost } = usePostNavigation()
const isFocused = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)

function handleInput() {
  // searchResults computed reactive updates automatically
}

function handleEnter() {
  if (!searchQuery.value.trim()) return
  const q = searchQuery.value.trim()
  isFocused.value = false
  inputRef.value?.blur()
  router.push({ name: 'search', query: { q } })
}

function selectPost(post: PostNavigationTarget) {
  isFocused.value = false
  searchQuery.value = ''
  navigateToPost(post)
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isFocused.value = false
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    inputRef.value?.focus()
    isFocused.value = true
  } else if (e.key === 'Escape') {
    isFocused.value = false
    inputRef.value?.blur()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<template>
  <div ref="containerRef" class="search-bar-container">
    <div class="search-input-wrapper" :class="{ 'is-focused': isFocused }">
      <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>

      <input
        ref="inputRef"
        v-model="searchQuery"
        type="text"
        placeholder="搜索文章、标签或摘要..."
        class="search-input"
        @focus="isFocused = true"
        @input="handleInput"
        @keydown.enter="handleEnter"
      />

      <kbd class="shortcut-badge">Ctrl K</kbd>
    </div>

    <!-- 实时预览下拉浮层 -->
    <transition name="dropdown-fade">
      <div v-if="isFocused && searchQuery.trim()" class="search-dropdown bl-card">
        <div v-if="searchResults.length === 0" class="dropdown-empty">
          未找到与 "<span class="query-highlight">{{ searchQuery }}</span>" 相关的文章
        </div>

        <div v-else class="dropdown-list">
          <div class="dropdown-header">
            找到 {{ searchResults.length }} 篇相关文章
          </div>

          <div
            v-for="item in searchResults.slice(0, 5)"
            :key="item.post.slug"
            class="dropdown-item"
            @click="selectPost(item.post)"
          >
            <div class="item-title" v-html="item.highlightedTitle"></div>
            <div class="item-summary" v-html="item.highlightedSummary"></div>
            <div class="item-meta">
              <span class="item-date">{{ item.post.date }}</span>
              <div class="item-tags">
                <span v-for="tag in item.post.tags.slice(0, 3)" :key="tag" class="meta-tag">
                  #{{ tag }}
                </span>
              </div>
            </div>
          </div>

          <div class="dropdown-footer" @click="handleEnter">
            查看全部搜索结果 &rarr;
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.search-bar-container {
  position: relative;
  width: 100%;
  max-width: 320px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--bl-bg-secondary);
  border: 1px solid var(--bl-border);
  border-radius: var(--bl-radius-full);
  padding: 0.35rem 0.75rem 0.35rem 0.85rem;
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.search-input-wrapper.is-focused {
  border-color: var(--bl-accent);
  box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.2);
  background: var(--bl-bg);
}

.search-icon {
  color: var(--bl-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--bl-text);
  font-size: 0.875rem;
  outline: none;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--bl-text-muted);
}

.shortcut-badge {
  font-size: 0.7rem;
  color: var(--bl-text-muted);
  background: var(--bl-bg-tertiary);
  border: 1px solid var(--bl-border);
  border-radius: 4px;
  padding: 0.15rem 0.35rem;
  font-family: var(--bl-font-mono);
  user-select: none;
}

/* 下拉框 */
.search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: -60px;
  max-height: 420px;
  overflow-y: auto;
  z-index: 100;
  padding: 0.5rem;
  background: #161b22;
  border: 1px solid var(--bl-border-hover);
  box-shadow: var(--bl-shadow-lg);
}

@media (max-width: 768px) {
  .search-dropdown {
    right: 0;
  }
}

.dropdown-empty {
  padding: 1.5rem;
  text-align: center;
  color: var(--bl-text-secondary);
  font-size: 0.875rem;
}

.query-highlight {
  color: var(--bl-accent);
}

.dropdown-header {
  font-size: 0.75rem;
  color: var(--bl-text-muted);
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--bl-border);
  margin-bottom: 0.25rem;
}

.dropdown-item {
  padding: 0.6rem 0.75rem;
  border-radius: var(--bl-radius-sm);
  cursor: pointer;
  transition: background var(--bl-dur-fast) var(--bl-ease);
}

.dropdown-item:hover {
  background: var(--bl-bg-tertiary);
}

.item-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 0.25rem;
}

.item-summary {
  font-size: 0.75rem;
  color: var(--bl-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 0.35rem;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.7rem;
  color: var(--bl-text-muted);
}

.item-tags {
  display: flex;
  gap: 0.35rem;
}

.meta-tag {
  color: var(--bl-accent);
}

.dropdown-footer {
  padding: 0.6rem;
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--bl-accent);
  border-top: 1px solid var(--bl-border);
  cursor: pointer;
  margin-top: 0.25rem;
  border-radius: var(--bl-radius-sm);
  transition: background var(--bl-dur-fast) var(--bl-ease);
}

.dropdown-footer:hover {
  background: var(--bl-accent-soft);
}

/* Animations */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
