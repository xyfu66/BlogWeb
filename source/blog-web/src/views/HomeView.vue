<script setup lang="ts">
import { ref, computed } from 'vue'
import { useBlogStore } from '@/stores/blog'
import PostCard from '@/components/PostCard.vue'
import TagCloud from '@/components/TagCloud.vue'

const blogStore = useBlogStore()
const currentPage = ref(1)
const pageSize = ref(6)

const totalPosts = computed(() => blogStore.posts.length)

const paginatedPosts = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return blogStore.posts.slice(start, start + pageSize.value)
})

function handlePageChange(page: number) {
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="home-view">
    <!-- Hero Section -->
    <section class="home-hero">
      <div class="bl-container">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="pulse-dot"></span>
            Tech, Code & Architecture
          </div>
          <h1 class="hero-title">
            探索技术深度，记录思考与实践
          </h1>
          <p class="hero-subtitle">
            专注于现代前端工程化、分布式系统架构与音频算法工程。欢迎交流与探讨。
          </p>
        </div>
      </div>
    </section>

    <!-- Main Content Area -->
    <div class="bl-container main-layout">
      <!-- Article List Column -->
      <main class="posts-column">
        <div class="section-title-bar">
          <h2 class="section-title">最新文章</h2>
          <span class="posts-count">共 {{ totalPosts }} 篇文章</span>
        </div>

        <div v-if="paginatedPosts.length === 0" class="empty-state bl-card">
          <div class="empty-icon">📝</div>
          <h3>暂无文章</h3>
          <p>新内容正在撰写中，敬请期待！</p>
        </div>

        <div v-else class="posts-list">
          <PostCard
            v-for="post in paginatedPosts"
            :key="post.slug"
            :post="post"
            class="animate-fade-in"
          />
        </div>

        <!-- Pagination -->
        <el-pagination
          v-if="totalPosts > pageSize"
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="totalPosts"
          layout="prev, pager, next"
          background
          @current-change="handlePageChange"
        />
      </main>

      <!-- Sidebar Column -->
      <aside class="sidebar-column">
        <!-- Author Profile Card -->
        <div class="author-card bl-card">
          <div class="author-avatar">
            <div class="avatar-inner">BV</div>
          </div>
          <h3 class="author-name">BitVortex Tech</h3>
          <p class="author-bio">
            全栈与系统架构工程师，热衷于构建高性能 Web 应用与极致用户体验。
          </p>
          <div class="author-stats">
            <div class="stat-item">
              <span class="stat-num">{{ totalPosts }}</span>
              <span class="stat-label">文章</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-num">{{ blogStore.seriesList.length }}</span>
              <span class="stat-label">专栏</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-num">{{ blogStore.tags.length }}</span>
              <span class="stat-label">标签</span>
            </div>
          </div>
          <router-link to="/about" class="author-about-btn">
            了解更多关于我 &rarr;
          </router-link>
        </div>

        <!-- Featured Series Widget -->
        <div v-if="blogStore.seriesList.length > 0" class="series-widget bl-card">
          <div class="widget-header">
            <div class="widget-title">
              <span class="widget-icon">📚</span>
              精选专栏
            </div>
            <router-link to="/series" class="widget-more">全部 &rarr;</router-link>
          </div>
          <div class="widget-series-list">
            <router-link
              v-for="s in blogStore.seriesList"
              :key="s.slug"
              :to="{ name: 'series-detail', params: { slug: s.slug } }"
              class="widget-series-item"
            >
              <div class="item-name">{{ s.name }}</div>
              <div class="item-meta">
                <span class="item-count">共 {{ s.postsCount }} 篇</span>
                <span class="item-arrow">&rarr;</span>
              </div>
            </router-link>
          </div>
        </div>

        <!-- Tag Cloud -->
        <TagCloud />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.home-hero {
  padding: 4rem 0 3rem;
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
  margin-bottom: 1.25rem;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: var(--bl-accent);
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(88, 166, 255, 0.7);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(88, 166, 255, 0.7);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(88, 166, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(88, 166, 255, 0);
  }
}

.hero-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
  line-height: 1.25;
  margin-bottom: 1rem;
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 1.125rem;
  color: var(--bl-text-secondary);
  line-height: 1.6;
}

.main-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 2rem;
  padding-bottom: 4rem;
}

.section-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
}

.posts-count {
  font-size: 0.875rem;
  color: var(--bl-text-muted);
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

/* Author Card */
.sidebar-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.author-card {
  padding: 1.5rem;
  text-align: center;
}

.author-avatar {
  display: inline-flex;
  margin-bottom: 1rem;
}

.avatar-inner {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #58a6ff, #bc8cff);
  color: #0d1117;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.25rem;
  box-shadow: var(--bl-shadow-glow);
}

.author-name {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 0.5rem;
}

.author-bio {
  font-size: 0.875rem;
  color: var(--bl-text-secondary);
  line-height: 1.6;
  margin-bottom: 1.25rem;
}

.author-stats {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--bl-border);
  border-bottom: 1px solid var(--bl-border);
  margin-bottom: 1.25rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--bl-text-muted);
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: var(--bl-border);
}

.author-about-btn {
  display: inline-block;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--bl-accent);
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.author-about-btn:hover {
  color: var(--bl-accent-hover);
  text-decoration: underline;
}

/* Featured Series Widget */
.series-widget {
  padding: 1.25rem 1.5rem;
}

.widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bl-border);
}

.widget-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
}

.widget-icon {
  font-size: 1rem;
}

.widget-more {
  font-size: 0.8125rem;
  color: var(--bl-accent);
  font-weight: 500;
  transition: color var(--bl-dur-fast) var(--bl-ease);
}

.widget-more:hover {
  color: var(--bl-accent-hover);
}

.widget-series-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.widget-series-item {
  display: block;
  padding: 0.75rem;
  background: var(--bl-bg-secondary);
  border: 1px solid var(--bl-border);
  border-radius: var(--bl-radius-sm);
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.widget-series-item:hover {
  border-color: var(--bl-accent);
  background: var(--bl-surface-hover);
  transform: translateX(2px);
}

.item-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 0.35rem;
  line-height: 1.4;
}

.widget-series-item:hover .item-name {
  color: var(--bl-accent);
}

.item-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--bl-text-muted);
}

.item-arrow {
  color: var(--bl-accent);
  transition: transform var(--bl-dur-fast) var(--bl-ease);
}

.widget-series-item:hover .item-arrow {
  transform: translateX(2px);
}

@media (max-width: 900px) {
  .main-layout {
    grid-template-columns: 1fr;
  }

  .sidebar-column {
    order: 2;
  }

  .hero-title {
    font-size: 1.85rem;
  }
}
</style>
