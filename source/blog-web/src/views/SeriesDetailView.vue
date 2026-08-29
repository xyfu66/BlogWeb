<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useBlogStore } from '@/stores/blog'
import TagBadge from '@/components/TagBadge.vue'
import { usePostNavigation } from '@/composables/usePostNavigation'

const props = defineProps<{
  slug: string
}>()

const router = useRouter()
const blogStore = useBlogStore()
const { navigateToPost } = usePostNavigation()

const series = computed(() => {
  return blogStore.getSeriesBySlug(props.slug)
})

const otherSeriesList = computed(() => {
  return blogStore.seriesList.filter((s) => s.slug !== props.slug)
})

const totalReadingTime = computed(() => {
  if (!series.value) return 0
  return series.value.posts.reduce((sum, p) => sum + (p.readingTime || 0), 0)
})

watch(
  () => series.value?.name,
  (name) => {
    if (name) {
      document.title = `专栏: ${name} | BlogWeb`
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="series-detail-view">
    <div class="bl-container">
      <!-- Breadcrumb & Back -->
      <nav class="series-nav-bar">
        <button class="back-button" @click="router.push('/series')">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          专栏合集列表
        </button>
        <div class="breadcrumb-trail">
          <router-link to="/">首页</router-link>
          <span class="divider">/</span>
          <router-link to="/series">专栏合集</router-link>
          <span class="divider">/</span>
          <span class="current-title">{{ series?.name || slug }}</span>
        </div>
      </nav>

      <!-- Not Found State -->
      <div v-if="!series" class="empty-state bl-card">
        <div class="empty-icon">⚠️</div>
        <h3>未找到该专栏合集</h3>
        <p>专栏 "{{ slug }}" 不存在或已被移除。</p>
        <router-link to="/series" class="back-home-link">
          返回专栏列表 &rarr;
        </router-link>
      </div>

      <!-- Main Series Detail Layout -->
      <div v-else class="series-detail-layout">
        <!-- Main Roadmap Column -->
        <main class="roadmap-column">
          <!-- Hero Card -->
          <div class="series-hero-card bl-card">
            <div class="hero-header-row">
              <div class="series-pill">
                <span class="dot"></span>
                专栏连载 · 共 {{ series.postsCount }} 篇
              </div>
              <time class="hero-date">最近更新：{{ series.updatedAt }}</time>
            </div>

            <h1 class="hero-title">{{ series.name }}</h1>
            <p v-if="series.description" class="hero-desc">
              {{ series.description }}
            </p>

            <div class="hero-tags">
              <TagBadge
                v-for="tag in series.tags"
                :key="tag"
                :tag="tag"
              />
            </div>
          </div>

          <!-- Chapters Roadmap Timeline -->
          <div class="roadmap-section">
            <div class="roadmap-title-row">
              <h2 class="roadmap-title">章节路线图 (Roadmap)</h2>
              <span class="roadmap-count">{{ series.posts.length }} 篇章节</span>
            </div>

            <div class="timeline-container">
              <div
                v-for="(chapter, idx) in series.posts"
                :key="chapter.slug"
                class="timeline-item bl-card"
                :class="{ 'is-external': !!chapter.link }"
                @click="navigateToPost(chapter)"
              >
                <!-- Chapter Part Node -->
                <div class="chapter-node">
                  <div class="part-badge">
                    {{ String(chapter.series?.part ?? idx + 1).padStart(2, '0') }}
                  </div>
                  <div v-if="idx < series.posts.length - 1" class="node-line"></div>
                </div>

                <!-- Chapter Content -->
                <div class="chapter-body">
                  <div class="chapter-meta">
                    <time class="meta-date">
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      {{ chapter.date }}
                    </time>
                    <span class="meta-dot">•</span>
                    <span v-if="chapter.link" class="external-pill">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                      微信公众号
                    </span>
                    <span v-else class="meta-time">约 {{ chapter.readingTime }} 分钟</span>
                  </div>

                  <h3 class="chapter-title">
                    <a
                      :href="chapter.link || `/me/blog/post/${chapter.slug}`"
                      :target="chapter.link ? '_blank' : '_self'"
                      rel="noopener noreferrer"
                      @click.prevent="navigateToPost(chapter)"
                    >
                      {{ chapter.title }}
                      <svg v-if="chapter.link" class="ext-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </a>
                  </h3>

                  <p class="chapter-summary">{{ chapter.summary }}</p>

                  <div class="chapter-footer">
                    <div class="chapter-tags">
                      <TagBadge
                        v-for="tag in chapter.tags"
                        :key="tag"
                        :tag="tag"
                        @click.stop
                      />
                    </div>

                    <span class="read-action">
                      {{ chapter.link ? '打开原文' : '阅读正文' }} &rarr;
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <!-- Sidebar Column -->
        <aside class="sidebar-column">
          <!-- Series Stats Box -->
          <div class="stats-box bl-card">
            <h3 class="box-title">专栏概况</h3>
            <div class="stats-grid">
              <div class="stat-box-item">
                <span class="stat-val">{{ series.postsCount }}</span>
                <span class="stat-lbl">包含章节</span>
              </div>
              <div class="stat-box-item">
                <span class="stat-val">{{ totalReadingTime }}m</span>
                <span class="stat-lbl">总阅读时长</span>
              </div>
              <div class="stat-box-item">
                <span class="stat-val">{{ series.tags.length }}</span>
                <span class="stat-lbl">涉及标签</span>
              </div>
            </div>
          </div>

          <!-- Other Series Recommendations -->
          <div v-if="otherSeriesList.length > 0" class="other-series-box bl-card">
            <h3 class="box-title">更多专栏</h3>
            <div class="other-series-list">
              <router-link
                v-for="s in otherSeriesList"
                :key="s.slug"
                :to="{ name: 'series-detail', params: { slug: s.slug } }"
                class="other-series-item"
              >
                <span class="other-name">{{ s.name }}</span>
                <span class="other-count">{{ s.postsCount }} 篇</span>
              </router-link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.series-detail-view {
  padding: 2rem 0 5rem;
}

.series-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  font-size: 0.875rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bl-bg-secondary);
  border: 1px solid var(--bl-border);
  color: var(--bl-text-secondary);
  padding: 0.4rem 0.8rem;
  border-radius: var(--bl-radius-sm);
  cursor: pointer;
  font-size: 0.875rem;
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.back-button:hover {
  color: var(--bl-accent);
  border-color: var(--bl-accent);
  background: var(--bl-surface-hover);
}

.breadcrumb-trail {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--bl-text-muted);
}

.breadcrumb-trail a {
  color: var(--bl-text-secondary);
  transition: color var(--bl-dur-fast) var(--bl-ease);
}

.breadcrumb-trail a:hover {
  color: var(--bl-accent);
}

.current-title {
  color: var(--bl-text);
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.series-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 2rem;
  align-items: start;
}

/* Hero Card */
.series-hero-card {
  padding: 2.25rem;
  margin-bottom: 2.5rem;
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.08), rgba(188, 140, 255, 0.05));
  border: 1px solid rgba(88, 166, 255, 0.25);
  position: relative;
}

.hero-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.series-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--bl-accent);
  background: var(--bl-accent-soft);
  padding: 0.25rem 0.75rem;
  border-radius: var(--bl-radius-full);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bl-accent);
}

.hero-date {
  font-size: 0.8125rem;
  color: var(--bl-text-muted);
}

.hero-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
  line-height: 1.3;
  margin-bottom: 1rem;
  letter-spacing: -0.02em;
}

.hero-desc {
  font-size: 1.05rem;
  color: var(--bl-text-secondary);
  line-height: 1.7;
  margin-bottom: 1.5rem;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Roadmap Section */
.roadmap-section {
  display: flex;
  flex-direction: column;
}

.roadmap-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.roadmap-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
}

.roadmap-count {
  font-size: 0.875rem;
  color: var(--bl-text-muted);
}

.timeline-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.timeline-item {
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  cursor: pointer;
  transition: all var(--bl-dur-normal) var(--bl-ease);
  position: relative;
}

.timeline-item:hover {
  transform: translateY(-2px);
  border-color: var(--bl-border-hover);
  box-shadow: var(--bl-shadow-md);
}

.chapter-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

.part-badge {
  width: 42px;
  height: 42px;
  border-radius: var(--bl-radius-md);
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.2), rgba(188, 140, 255, 0.15));
  border: 1px solid rgba(88, 166, 255, 0.35);
  color: var(--bl-accent);
  font-family: var(--bl-font-mono);
  font-size: 1.125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--bl-shadow-sm);
}

.node-line {
  flex: 1;
  width: 2px;
  background: var(--bl-border);
  margin-top: 0.75rem;
}

.chapter-body {
  flex: 1;
  min-width: 0;
}

.chapter-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--bl-text-muted);
  margin-bottom: 0.4rem;
}

.meta-date {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.external-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--bl-accent-green);
  font-weight: 500;
}

.chapter-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 0.6rem;
  line-height: 1.4;
}

.chapter-title a {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--bl-text-highlight);
  transition: color var(--bl-dur-fast) var(--bl-ease);
}

.ext-icon {
  opacity: 0.7;
}

.timeline-item:hover .chapter-title a {
  color: var(--bl-accent);
}

.chapter-summary {
  font-size: 0.9rem;
  color: var(--bl-text-secondary);
  line-height: 1.6;
  margin-bottom: 1rem;
}

.chapter-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.chapter-tags {
  display: flex;
  gap: 0.4rem;
}

.read-action {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--bl-accent);
  transition: transform var(--bl-dur-fast) var(--bl-ease);
}

.timeline-item:hover .read-action {
  transform: translateX(4px);
}

/* Sidebar Box */
.sidebar-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-box,
.other-series-box {
  padding: 1.5rem;
}

.box-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bl-border);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  text-align: center;
}

.stat-box-item {
  display: flex;
  flex-direction: column;
  background: var(--bl-bg-secondary);
  padding: 0.75rem 0.5rem;
  border-radius: var(--bl-radius-sm);
}

.stat-val {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--bl-accent);
}

.stat-lbl {
  font-size: 0.75rem;
  color: var(--bl-text-muted);
  margin-top: 0.25rem;
}

.other-series-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.other-series-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border-radius: var(--bl-radius-sm);
  background: var(--bl-bg-secondary);
  color: var(--bl-text-secondary);
  font-size: 0.875rem;
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.other-series-item:hover {
  background: var(--bl-surface-hover);
  color: var(--bl-accent);
}

.other-count {
  font-size: 0.75rem;
  color: var(--bl-text-muted);
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

@media (max-width: 900px) {
  .series-detail-layout {
    grid-template-columns: 1fr;
  }

  .sidebar-column {
    order: 2;
  }

  .hero-title {
    font-size: 1.75rem;
  }
}
</style>
