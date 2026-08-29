<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { BlogPostMeta } from '@/types/post'
import TagBadge from './TagBadge.vue'

const props = defineProps<{
  post: BlogPostMeta
}>()

const router = useRouter()

function goToDetail() {
  router.push({ name: 'post-detail', params: { slug: props.post.slug } })
}
</script>

<template>
  <article class="post-card bl-card" @click="goToDetail">
    <header class="card-header">
      <div class="card-meta">
        <time class="meta-item date">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          {{ post.date }}
        </time>

        <span class="meta-divider">•</span>

        <span class="meta-item reading-time">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          约 {{ post.readingTime }} 分钟阅读
        </span>
      </div>

      <h2 class="post-title">
        <a :href="`/me/blog/post/${post.slug}`" @click.prevent="goToDetail">
          {{ post.title }}
        </a>
      </h2>
    </header>

    <p class="post-summary">
      {{ post.summary }}
    </p>

    <footer class="card-footer">
      <div class="tags-list">
        <TagBadge
          v-for="tag in post.tags"
          :key="tag"
          :tag="tag"
        />
      </div>

      <span class="read-more">
        阅读正文
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </span>
    </footer>
  </article>
</template>

<style scoped>
.post-card {
  padding: 1.75rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.post-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 4px;
  height: 0;
  background: var(--bl-accent);
  transition: height var(--bl-dur-normal) var(--bl-ease);
}

.post-card:hover::before {
  height: 100%;
}

.card-header {
  margin-bottom: 0.75rem;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--bl-text-muted);
  margin-bottom: 0.5rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.meta-divider {
  color: var(--bl-border);
}

.post-title {
  font-size: 1.35rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--bl-text-highlight);
  transition: color var(--bl-dur-fast) var(--bl-ease);
}

.post-title a:hover,
.post-card:hover .post-title {
  color: var(--bl-accent);
}

.post-summary {
  color: var(--bl-text-secondary);
  font-size: 0.9375rem;
  line-height: 1.7;
  margin-bottom: 1.25rem;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--bl-border);
  flex-wrap: wrap;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.read-more {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bl-accent);
  transition: gap var(--bl-dur-fast) var(--bl-ease);
}

.post-card:hover .read-more {
  gap: 0.55rem;
}
</style>
