<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSearch } from '@/composables/useSearch'
import TagBadge from '@/components/TagBadge.vue'

const route = useRoute()
const router = useRouter()
const { searchQuery, searchResults } = useSearch()
const localInput = ref('')

function syncFromQuery() {
  const q = (route.query.q as string) || ''
  searchQuery.value = q
  localInput.value = q
  if (q) {
    document.title = `搜索: ${q} | BlogWeb`
  }
}

function handleSearchSubmit() {
  const q = localInput.value.trim()
  searchQuery.value = q
  router.replace({ name: 'search', query: q ? { q } : {} })
}

function selectPost(slug: string) {
  router.push({ name: 'post-detail', params: { slug } })
}

watch(() => route.query.q, syncFromQuery)

onMounted(() => {
  syncFromQuery()
})
</script>

<template>
  <div class="search-view">
    <!-- Search Header -->
    <section class="search-header-section">
      <div class="bl-container">
        <div class="search-box-wrap">
          <h1 class="search-page-title">全文检索</h1>
          <form class="search-form" @submit.prevent="handleSearchSubmit">
            <div class="input-container bl-card">
              <svg class="search-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input
                v-model="localInput"
                type="text"
                placeholder="输入关键词进行搜索..."
                class="search-input"
                autofocus
              />
              <button type="submit" class="search-button">
                搜索
              </button>
            </div>
          </form>

          <div v-if="searchQuery.trim()" class="search-summary-text">
            搜索 "<span class="query-keyword">{{ searchQuery }}</span>"，找到
            <strong>{{ searchResults.length }}</strong> 篇相关文章
          </div>
        </div>
      </div>
    </section>

    <!-- Results List -->
    <div class="bl-container results-container">
      <div v-if="!searchQuery.trim()" class="empty-prompt bl-card">
        <div class="prompt-icon">🔍</div>
        <h3>请输入关键词</h3>
        <p>支持按文章标题、摘要、标签或技术关键词进行实时检索</p>
      </div>

      <div v-else-if="searchResults.length === 0" class="empty-prompt bl-card">
        <div class="prompt-icon">🧐</div>
        <h3>未找到相关文章</h3>
        <p>尝试使用更通用的技术词汇，或浏览标签云寻找相关内容</p>
        <router-link to="/" class="home-btn">返回首页</router-link>
      </div>

      <div v-else class="results-list">
        <article
          v-for="item in searchResults"
          :key="item.post.slug"
          class="result-item bl-card animate-fade-in"
          @click="selectPost(item.post.slug)"
        >
          <div class="item-meta">
            <time>{{ item.post.date }}</time>
            <span>•</span>
            <span>约 {{ item.post.readingTime }} 分钟阅读</span>
          </div>

          <h2 class="item-title" v-html="item.highlightedTitle"></h2>

          <p class="item-summary" v-html="item.highlightedSummary"></p>

          <div class="item-tags">
            <TagBadge
              v-for="tag in item.post.tags"
              :key="tag"
              :tag="tag"
              :active="item.matchedTags.includes(tag)"
            />
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-header-section {
  padding: 3.5rem 0 2.5rem;
  background: radial-gradient(circle at 50% -20%, rgba(88, 166, 255, 0.12), transparent 70%);
  border-bottom: 1px solid var(--bl-border);
  margin-bottom: 2.5rem;
}

.search-box-wrap {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
}

.search-page-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
  margin-bottom: 1.5rem;
}

.search-form {
  margin-bottom: 1rem;
}

.input-container {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 1.25rem;
  border-radius: var(--bl-radius-full);
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
  font-size: 1.0625rem;
  outline: none;
}

.search-input::placeholder {
  color: var(--bl-text-muted);
}

.search-button {
  padding: 0.6rem 1.5rem;
  background: var(--bl-accent);
  color: #0d1117;
  border: none;
  border-radius: var(--bl-radius-full);
  font-weight: 600;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.search-button:hover {
  background: var(--bl-accent-hover);
  transform: translateY(-1px);
}

.search-summary-text {
  font-size: 0.9375rem;
  color: var(--bl-text-secondary);
}

.query-keyword {
  color: var(--bl-accent);
  font-weight: 600;
}

.results-container {
  max-width: 820px;
  padding-bottom: 4rem;
}

.empty-prompt {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--bl-text-secondary);
}

.prompt-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.empty-prompt h3 {
  color: var(--bl-text-highlight);
  margin-bottom: 0.5rem;
}

.home-btn {
  display: inline-block;
  margin-top: 1.25rem;
  padding: 0.45rem 1.25rem;
  background: var(--bl-bg-secondary);
  border: 1px solid var(--bl-border);
  border-radius: var(--bl-radius-sm);
  color: var(--bl-accent);
  font-weight: 500;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.result-item {
  padding: 1.75rem;
  cursor: pointer;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--bl-text-muted);
  margin-bottom: 0.5rem;
}

.item-title {
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 0.75rem;
  transition: color var(--bl-dur-fast) var(--bl-ease);
}

.result-item:hover .item-title {
  color: var(--bl-accent);
}

.item-summary {
  font-size: 0.9375rem;
  color: var(--bl-text-secondary);
  line-height: 1.6;
  margin-bottom: 1.25rem;
}

.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>
