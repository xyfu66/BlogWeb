<script setup lang="ts">
import { useBlogStore } from '@/stores/blog'
import TagBadge from './TagBadge.vue'

defineProps<{
  activeTag?: string | null
}>()

const blogStore = useBlogStore()
</script>

<template>
  <aside class="tag-cloud-card bl-card">
    <div class="card-header">
      <div class="header-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
      </div>
      <h3 class="card-title">热门标签</h3>
    </div>

    <div v-if="blogStore.tags.length === 0" class="empty-tags">
      暂无标签
    </div>

    <div v-else class="tags-container">
      <TagBadge
        v-for="item in blogStore.tags"
        :key="item.name"
        :tag="item.name"
        :count="item.count"
        :active="activeTag === item.name"
      />
    </div>
  </aside>
</template>

<style scoped>
.tag-cloud-card {
  padding: 1.25rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--bl-border);
}

.header-icon {
  color: var(--bl-accent);
  display: flex;
  align-items: center;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
}

.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.empty-tags {
  color: var(--bl-text-muted);
  font-size: 0.875rem;
  text-align: center;
  padding: 1rem 0;
}
</style>
