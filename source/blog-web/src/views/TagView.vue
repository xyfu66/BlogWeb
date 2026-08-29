<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBlogStore } from '@/stores/blog'
import PostCard from '@/components/PostCard.vue'
import TagCloud from '@/components/TagCloud.vue'

const props = defineProps<{
  tag: string
}>()

const router = useRouter()
const blogStore = useBlogStore()

const matchingPosts = computed(() => {
  return blogStore.posts.filter((p) => p.tags && p.tags.includes(props.tag))
})

watch(
  () => props.tag,
  (newTag) => {
    blogStore.setActiveTag(newTag)
    document.title = `标签: #${newTag} | BlogWeb`
  },
  { immediate: true },
)

onMounted(() => {
  blogStore.setActiveTag(props.tag)
})

function clearFilter() {
  blogStore.setActiveTag(null)
  router.push('/')
}
</script>

<template>
  <div class="tag-view">
    <!-- Tag Header Banner -->
    <section class="tag-header-banner">
      <div class="bl-container">
        <div class="header-inner">
          <div class="tag-indicator">
            <span class="hash-icon">#</span>
            <h1 class="tag-name">{{ tag }}</h1>
            <span class="tag-post-count">{{ matchingPosts.length }} 篇文章</span>
          </div>

          <button class="clear-filter-btn" @click="clearFilter">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            清除过滤
          </button>
        </div>
      </div>
    </section>

    <!-- Tag Layout -->
    <div class="bl-container tag-layout">
      <main class="posts-column">
        <div v-if="matchingPosts.length === 0" class="empty-state bl-card">
          <div class="empty-icon">🏷️</div>
          <h3>未找到该标签下的文章</h3>
          <p>当前标签 "#{{ tag }}" 暂无关联文章。</p>
          <router-link to="/" class="back-home-link">
            返回首页查看全部文章 &rarr;
          </router-link>
        </div>

        <div v-else class="posts-list">
          <PostCard
            v-for="post in matchingPosts"
            :key="post.slug"
            :post="post"
            class="animate-fade-in"
          />
        </div>
      </main>

      <aside class="sidebar-column">
        <TagCloud :active-tag="tag" />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.tag-header-banner {
  padding: 3rem 0 2rem;
  background: radial-gradient(circle at 50% -20%, rgba(188, 140, 255, 0.15), transparent 70%);
  border-bottom: 1px solid var(--bl-border);
  margin-bottom: 2rem;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.tag-indicator {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
}

.hash-icon {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--bl-accent-purple);
}

.tag-name {
  font-size: 2rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
}

.tag-post-count {
  font-size: 0.9375rem;
  color: var(--bl-text-secondary);
}

.clear-filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.85rem;
  background: var(--bl-bg-secondary);
  border: 1px solid var(--bl-border);
  border-radius: var(--bl-radius-sm);
  color: var(--bl-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.clear-filter-btn:hover {
  color: var(--bl-text-highlight);
  border-color: var(--bl-text-secondary);
  background: var(--bl-surface-hover);
}

.tag-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 2rem;
  padding-bottom: 4rem;
}

.posts-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.empty-state {
  text-align: center;
  padding: 3rem 1.5rem;
  color: var(--bl-text-secondary);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.75rem;
}

.empty-state h3 {
  color: var(--bl-text-highlight);
  margin-bottom: 0.5rem;
}

.back-home-link {
  display: inline-block;
  margin-top: 1rem;
  color: var(--bl-accent);
  font-weight: 500;
}

.sidebar-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

@media (max-width: 900px) {
  .tag-layout {
    grid-template-columns: 1fr;
  }

  .sidebar-column {
    order: 2;
  }

  .tag-name {
    font-size: 1.6rem;
  }
}
</style>
