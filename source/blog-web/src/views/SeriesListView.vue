<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBlogStore } from '@/stores/blog'
import TagBadge from '@/components/TagBadge.vue'
import { usePostNavigation } from '@/composables/usePostNavigation'

const router = useRouter()
const blogStore = useBlogStore()
const { navigateToPost } = usePostNavigation()

const seriesList = computed(() => blogStore.seriesList)

function goToSeries(slug: string) {
  router.push({ name: 'series-detail', params: { slug } })
}
</script>

<template>
  <div class="series-list-view">
    <!-- Hero Banner -->
    <section class="series-hero">
      <div class="bl-container">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="series-icon">📚</span>
            Curated Collections
          </div>
          <h1 class="hero-title">专栏与系列合集</h1>
          <p class="hero-subtitle">
            系统性梳理核心技术专题，从零到一构建完整知识体系。
          </p>
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <div class="bl-container series-container">
      <div v-if="seriesList.length === 0" class="empty-state bl-card">
        <div class="empty-icon">📁</div>
        <h3>暂无专栏合集</h3>
        <p>博主正在精心整理系列文章，敬请期待！</p>
        <router-link to="/" class="back-home-link">
          返回首页查看全部文章 &rarr;
        </router-link>
      </div>

      <div v-else class="series-grid">
        <div
          v-for="series in seriesList"
          :key="series.slug"
          class="series-card bl-card"
          @click="goToSeries(series.slug)"
        >
          <div class="card-glow"></div>

          <!-- Series Header -->
          <div class="series-card-header">
            <div class="series-meta-top">
              <span class="series-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                专栏连载
              </span>
              <span class="series-count-pill">共 {{ series.postsCount }} 篇</span>
            </div>

            <h2 class="series-title">{{ series.name }}</h2>
            <p v-if="series.description" class="series-desc">{{ series.description }}</p>
          </div>

          <!-- Chapters Roadmap Preview -->
          <div class="chapters-preview">
            <div class="preview-title">章节概览</div>
            <ul class="preview-list">
              <li
                v-for="(chapter, idx) in series.posts"
                :key="chapter.slug"
                class="chapter-item"
                @click.stop="navigateToPost(chapter)"
              >
                <span class="chapter-idx">{{ String((chapter.series?.part ?? idx + 1)).padStart(2, '0') }}</span>
                <span class="chapter-name">{{ chapter.title }}</span>
                <span v-if="chapter.link" class="external-tag">公众号</span>
              </li>
            </ul>
          </div>

          <!-- Series Card Footer -->
          <div class="series-card-footer">
            <div class="series-tags">
              <TagBadge
                v-for="tag in series.tags.slice(0, 3)"
                :key="tag"
                :tag="tag"
                @click.stop
              />
            </div>

            <div class="enter-btn">
              进入专栏
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.series-list-view {
  padding-bottom: 5rem;
}

.series-hero {
  padding: 3.5rem 0 2.5rem;
  background: radial-gradient(circle at 50% -20%, rgba(88, 166, 255, 0.15), transparent 70%);
  border-bottom: 1px solid var(--bl-border);
  margin-bottom: 2.5rem;
}

.hero-content {
  max-width: 760px;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  background: var(--bl-accent-soft);
  color: var(--bl-accent);
  border: 1px solid rgba(88, 166, 255, 0.25);
  border-radius: var(--bl-radius-full);
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.hero-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
  line-height: 1.3;
  margin-bottom: 0.75rem;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 1.125rem;
  color: var(--bl-text-secondary);
  line-height: 1.6;
}

.series-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(480px, 1fr));
  gap: 2rem;
}

.series-card {
  padding: 2rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  transition: transform var(--bl-dur-normal) var(--bl-ease), border-color var(--bl-dur-normal) var(--bl-ease), box-shadow var(--bl-dur-normal) var(--bl-ease);
}

.series-card:hover {
  transform: translateY(-4px);
  border-color: var(--bl-border-hover);
  box-shadow: var(--bl-shadow-glow);
}

.series-card-header {
  margin-bottom: 1.5rem;
}

.series-meta-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
}

.series-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--bl-accent);
  background: var(--bl-accent-soft);
  padding: 0.25rem 0.65rem;
  border-radius: var(--bl-radius-full);
}

.series-count-pill {
  font-size: 0.8125rem;
  color: var(--bl-text-muted);
  background: var(--bl-bg-tertiary);
  padding: 0.2rem 0.6rem;
  border-radius: var(--bl-radius-sm);
  font-weight: 500;
}

.series-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
  line-height: 1.4;
  margin-bottom: 0.6rem;
  transition: color var(--bl-dur-fast) var(--bl-ease);
}

.series-card:hover .series-title {
  color: var(--bl-accent);
}

.series-desc {
  font-size: 0.9375rem;
  color: var(--bl-text-secondary);
  line-height: 1.6;
}

/* Chapters Preview */
.chapters-preview {
  background: var(--bl-bg-secondary);
  border: 1px solid var(--bl-border);
  border-radius: var(--bl-radius-md);
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  flex: 1;
}

.preview-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bl-text-muted);
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.preview-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.chapter-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0.5rem;
  border-radius: var(--bl-radius-sm);
  transition: background var(--bl-dur-fast) var(--bl-ease);
  cursor: pointer;
}

.chapter-item:hover {
  background: var(--bl-surface-hover);
}

.chapter-idx {
  font-size: 0.75rem;
  font-family: var(--bl-font-mono);
  font-weight: 700;
  color: var(--bl-accent);
  background: var(--bl-accent-soft);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  flex-shrink: 0;
}

.chapter-name {
  font-size: 0.875rem;
  color: var(--bl-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.chapter-item:hover .chapter-name {
  color: var(--bl-accent);
}

.external-tag {
  font-size: 0.7rem;
  color: var(--bl-accent-green);
  background: var(--bl-accent-green-soft);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  flex-shrink: 0;
}

/* Footer */
.series-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--bl-border);
  flex-wrap: wrap;
}

.series-tags {
  display: flex;
  gap: 0.4rem;
}

.enter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--bl-accent);
  transition: gap var(--bl-dur-fast) var(--bl-ease);
}

.series-card:hover .enter-btn {
  gap: 0.55rem;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--bl-text-secondary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.back-home-link {
  display: inline-block;
  margin-top: 1.25rem;
  color: var(--bl-accent);
  font-weight: 500;
}

@media (max-width: 768px) {
  .series-grid {
    grid-template-columns: 1fr;
  }

  .series-card {
    padding: 1.5rem;
  }

  .hero-title {
    font-size: 1.75rem;
  }
}
</style>
