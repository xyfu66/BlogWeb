<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useBlogStore } from '@/stores/blog'
import { renderMarkdownToSafeHtml, extractToc, type TocItem } from '@/utils/markdown'
import TagBadge from '@/components/TagBadge.vue'
import { usePostNavigation } from '@/composables/usePostNavigation'
import { useMarkdownZoom } from '@/composables/useMarkdownZoom'
import mermaid from 'mermaid'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  themeVariables: {
    darkMode: true,
    background: '#0d1117',
    mainBkg: '#161b22',
    nodeBorder: '#58a6ff',
    nodeTextColor: '#f0f6fc',
    lineColor: '#58a6ff',
    textColor: '#f0f6fc',
    primaryColor: '#1f2937',
    primaryBorderColor: '#58a6ff',
    primaryTextColor: '#f0f6fc',
    secondaryColor: '#161b22',
    secondaryBorderColor: '#bc8cff',
    secondaryTextColor: '#f0f6fc',
    tertiaryColor: '#0b0e14',
    tertiaryBorderColor: '#3fb950',
    tertiaryTextColor: '#f0f6fc',
    noteBkgColor: '#161b22',
    noteTextColor: '#f0f6fc',
    noteBorderColor: '#bc8cff',
    actorBkg: '#161b22',
    actorBorder: '#58a6ff',
    actorTextColor: '#f0f6fc',
    actorLineColor: '#58a6ff',
    signalColor: '#f0f6fc',
    signalTextColor: '#f0f6fc',
    labelBoxBkgColor: '#161b22',
    labelBoxBorderColor: '#58a6ff',
    labelTextColor: '#f0f6fc',
    loopTextColor: '#bc8cff',
  },
})

const props = defineProps<{
  slug: string
}>()

const router = useRouter()
const blogStore = useBlogStore()
const { navigateToPost } = usePostNavigation()
const { refresh: refreshZoomEnhancements, handleContainerClick } = useMarkdownZoom()

const articleRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const rawMarkdown = ref('')
const htmlContent = ref('')
const tocList = ref<TocItem[]>([])
const isSeriesChapterDrawerOpen = ref(false)

const post = computed(() => {
  return blogStore.getPostBySlug(props.slug)
})

// 专栏上下文
const seriesContext = computed(() => {
  return blogStore.getPostSeriesContext(props.slug)
})

// 全局上一篇 / 下一篇导航
const currentIndex = computed(() => {
  return blogStore.posts.findIndex((p) => p.slug === props.slug)
})

const prevPost = computed(() => {
  if (seriesContext.value) {
    return seriesContext.value.prevInSeries
  }
  if (currentIndex.value > 0) {
    return blogStore.posts[currentIndex.value - 1]
  }
  return null
})

const nextPost = computed(() => {
  if (seriesContext.value) {
    return seriesContext.value.nextInSeries
  }
  if (currentIndex.value >= 0 && currentIndex.value < blogStore.posts.length - 1) {
    return blogStore.posts[currentIndex.value + 1]
  }
  return null
})

async function renderMermaidDiagrams() {
  await nextTick()
  // 确保 DOM 已经完全挂载在文档树中
  const containers = document.querySelectorAll<HTMLElement>('.post-article .mermaid-diagram')
  if (!containers || containers.length === 0) return

  for (let i = 0; i < containers.length; i++) {
    const container = containers[i]
    if (container.querySelector('svg')) continue

    const pre = container.querySelector('pre.mermaid')
    const code = (pre ? pre.textContent : container.textContent)?.trim() || ''
    if (!code) continue

    const id = `mermaid-svg-${Date.now()}-${i}-${Math.floor(Math.random() * 10000)}`
    try {
      const cleanCode = code
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")

      const { svg, bindFunctions } = await mermaid.render(id, cleanCode)
      container.innerHTML = svg
      bindFunctions?.(container)
    } catch (err) {
      console.warn(`Mermaid render failed for diagram #${i}:`, err)
      if (pre) {
        pre.setAttribute('data-processed', 'true')
        pre.classList.add('mermaid-error')
      }
    }
  }
}

async function fetchContent() {
  loading.value = true
  error.value = null
  try {
    const raw = await blogStore.loadPostContent(props.slug)
    rawMarkdown.value = raw
    htmlContent.value = renderMarkdownToSafeHtml(raw)
    tocList.value = extractToc(raw)

    if (post.value?.title) {
      document.title = `${post.value.title} | BlogWeb`
    }
  } catch (err: any) {
    error.value = err.message || '文章加载失败'
  } finally {
    // 必须在 loading 设为 false 后，Vue 才会将 .post-article 挂载到 DOM 中
    loading.value = false
    await nextTick()
    await renderMermaidDiagrams()
    await refreshZoomEnhancements(articleRef)
  }
}

watch(
  () => [htmlContent.value, loading.value],
  async ([html, isLoading]) => {
    if (html && !isLoading) {
      await nextTick()
      await renderMermaidDiagrams()
      await refreshZoomEnhancements(articleRef)
    }
  },
)

watch(
  () => props.slug,
  () => {
    fetchContent()
    isSeriesChapterDrawerOpen.value = false
    window.scrollTo({ top: 0, behavior: 'smooth' })
  },
)

onMounted(() => {
  fetchContent()
})
</script>

<template>
  <div class="post-detail-view">
    <div class="bl-container">
      <!-- Top Navigation / Breadcrumb -->
      <nav class="post-nav-bar">
        <button class="back-button" @click="router.back()">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          返回上一页
        </button>
        <div class="breadcrumb-trail">
          <router-link to="/">首页</router-link>
          <span class="divider">/</span>
          <template v-if="seriesContext">
            <router-link to="/series">专栏合集</router-link>
            <span class="divider">/</span>
            <router-link :to="{ name: 'series-detail', params: { slug: seriesContext.series.slug } }">
              {{ seriesContext.series.name }}
            </router-link>
            <span class="divider">/</span>
          </template>
          <span class="current-title">{{ post?.title || slug }}</span>
        </div>
      </nav>

      <!-- Loading & Error States -->
      <div v-if="loading" class="state-container bl-card">
        <div class="loading-spinner"></div>
        <p>正在载入文章内容...</p>
      </div>

      <div v-else-if="error" class="state-container bl-card error-state">
        <div class="error-icon">⚠️</div>
        <h3>加载文章失败</h3>
        <p>{{ error }}</p>
        <button class="retry-button" @click="fetchContent">重试</button>
      </div>

      <!-- Main Post Content Layout -->
      <div v-else-if="post" class="post-layout">
        <article ref="articleRef" class="post-article bl-card" @click="handleContainerClick">
          <!-- Article Header -->
          <header class="article-header">
            <div class="header-meta">
              <time class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                {{ post.date }}
              </time>
              <span class="meta-dot">•</span>
              <span class="meta-item">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                约 {{ post.readingTime }} 分钟阅读
              </span>
            </div>

            <h1 class="article-title">{{ post.title }}</h1>

            <div class="article-tags">
              <TagBadge
                v-for="tag in post.tags"
                :key="tag"
                :tag="tag"
              />
            </div>
          </header>

          <!-- Series Callout Box (if post belongs to series) -->
          <div v-if="seriesContext" class="series-callout">
            <div class="callout-header">
              <div class="callout-left">
                <div class="callout-badge">
                  <span class="badge-icon">📚</span>
                  <span>专栏连载</span>
                </div>
                <div class="callout-info">
                  <router-link
                    :to="{ name: 'series-detail', params: { slug: seriesContext.series.slug } }"
                    class="callout-title"
                  >
                    《{{ seriesContext.series.name }}》
                  </router-link>
                  <span class="callout-progress">
                    第 {{ seriesContext.currentPart }} 篇 / 共 {{ seriesContext.totalParts }} 篇
                  </span>
                </div>
              </div>

              <div class="callout-right">
                <button
                  class="chapter-toggle-btn"
                  @click="isSeriesChapterDrawerOpen = !isSeriesChapterDrawerOpen"
                >
                  <span>{{ isSeriesChapterDrawerOpen ? '收起目录' : '章节目录' }}</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    :class="{ 'rotate-icon': isSeriesChapterDrawerOpen }"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Expandable Chapters Drawer -->
            <div v-if="isSeriesChapterDrawerOpen" class="callout-chapters">
              <div
                v-for="(chap, idx) in seriesContext.chapters"
                :key="chap.slug"
                class="callout-chap-item"
                :class="{ 'is-current': chap.slug === slug }"
                @click="navigateToPost(chap)"
              >
                <span class="chap-idx">{{ String(chap.series?.part ?? idx + 1).padStart(2, '0') }}</span>
                <span class="chap-text">{{ chap.title }}</span>
                <span v-if="chap.slug === slug" class="current-pill">正在阅读</span>
                <span v-else-if="chap.link" class="ext-pill">微信原文</span>
              </div>
            </div>
          </div>

          <!-- Rendered Markdown Body -->
          <div class="markdown-body" v-html="htmlContent"></div>

          <!-- Article Footer Navigation -->
          <footer class="article-footer">
            <div class="nav-prev-next">
              <div
                v-if="prevPost"
                class="post-nav-card prev-card"
                @click="navigateToPost(prevPost)"
              >
                <span class="nav-label">
                  &larr; {{ seriesContext ? '专栏上一讲' : '上一篇' }}
                </span>
                <span class="nav-title">{{ prevPost.title }}</span>
              </div>
              <div v-else class="post-nav-placeholder"></div>

              <div
                v-if="nextPost"
                class="post-nav-card next-card"
                @click="navigateToPost(nextPost)"
              >
                <span class="nav-label">
                  {{ seriesContext ? '专栏下一篇' : '下一篇' }} &rarr;
                </span>
                <span class="nav-title">{{ nextPost.title }}</span>
              </div>
            </div>
          </footer>
        </article>

        <!-- Right Sticky Table of Contents -->
        <aside v-if="tocList.length > 0" class="toc-sidebar">
          <div class="toc-card bl-card">
            <h3 class="toc-title">目录导航</h3>
            <nav class="toc-nav">
              <a
                v-for="item in tocList"
                :key="item.id"
                :href="`#${item.id}`"
                class="toc-link"
                :class="`level-${item.level}`"
              >
                {{ item.text }}
              </a>
            </nav>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<style scoped>
.post-detail-view {
  padding: 2rem 0 4rem;
}

.post-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
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

.state-container {
  padding: 4rem 2rem;
  text-align: center;
  color: var(--bl-text-secondary);
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid var(--bl-border);
  border-top-color: var(--bl-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state .error-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
}

.retry-button {
  margin-top: 1rem;
  padding: 0.45rem 1.25rem;
  background: var(--bl-accent);
  color: #0d1117;
  border: none;
  border-radius: var(--bl-radius-sm);
  font-weight: 600;
  cursor: pointer;
}

/* Post Layout */
.post-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 2rem;
  align-items: start;
}

.post-article {
  padding: 2.5rem;
}

.article-header {
  margin-bottom: 2.5rem;
  padding-bottom: 1.75rem;
  border-bottom: 1px solid var(--bl-border);
}

.header-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--bl-text-muted);
  margin-bottom: 0.75rem;
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.article-title {
  font-size: 2.25rem;
  font-weight: 700;
  color: var(--bl-text-highlight);
  line-height: 1.3;
  margin-bottom: 1.25rem;
  letter-spacing: -0.02em;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* Series Callout */
.series-callout {
  background: linear-gradient(135deg, rgba(88, 166, 255, 0.08), rgba(188, 140, 255, 0.06));
  border: 1px solid rgba(88, 166, 255, 0.25);
  border-radius: var(--bl-radius-md);
  padding: 1.25rem 1.5rem;
  margin-bottom: 2rem;
}

.callout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.callout-left {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  flex-wrap: wrap;
}

.callout-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--bl-accent-soft);
  color: var(--bl-accent);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: var(--bl-radius-full);
}

.badge-icon {
  font-size: 0.8125rem;
}

.callout-info {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.callout-title {
  font-weight: 700;
  color: var(--bl-text-highlight);
  font-size: 1rem;
  transition: color var(--bl-dur-fast) var(--bl-ease);
}

.callout-title:hover {
  color: var(--bl-accent);
}

.callout-progress {
  font-size: 0.8125rem;
  color: var(--bl-accent-purple);
  font-weight: 500;
  background: var(--bl-accent-purple-soft);
  padding: 0.15rem 0.5rem;
  border-radius: var(--bl-radius-full);
}

.chapter-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--bl-bg-secondary);
  border: 1px solid var(--bl-border);
  color: var(--bl-text-secondary);
  font-size: 0.8125rem;
  padding: 0.35rem 0.75rem;
  border-radius: var(--bl-radius-sm);
  cursor: pointer;
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.chapter-toggle-btn:hover {
  color: var(--bl-text-highlight);
  border-color: var(--bl-accent);
  background: var(--bl-surface-hover);
}

.rotate-icon {
  transform: rotate(180deg);
  transition: transform var(--bl-dur-fast) var(--bl-ease);
}

.callout-chapters {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(88, 166, 255, 0.15);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.callout-chap-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--bl-radius-sm);
  cursor: pointer;
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.callout-chap-item:hover {
  background: var(--bl-surface-hover);
}

.callout-chap-item.is-current {
  background: var(--bl-accent-soft);
}

.chap-idx {
  font-family: var(--bl-font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--bl-accent);
  width: 22px;
}

.chap-text {
  font-size: 0.875rem;
  color: var(--bl-text);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.callout-chap-item:hover .chap-text {
  color: var(--bl-accent);
}

.current-pill {
  font-size: 0.7rem;
  color: var(--bl-accent);
  background: rgba(88, 166, 255, 0.2);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-weight: 600;
}

.ext-pill {
  font-size: 0.7rem;
  color: var(--bl-accent-green);
  background: var(--bl-accent-green-soft);
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

/* Prev / Next Nav */
.article-footer {
  margin-top: 3.5rem;
  padding-top: 2rem;
  border-top: 1px solid var(--bl-border);
}

.nav-prev-next {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}

.post-nav-card {
  display: flex;
  flex-direction: column;
  padding: 1rem 1.25rem;
  background: var(--bl-bg-secondary);
  border: 1px solid var(--bl-border);
  border-radius: var(--bl-radius-md);
  transition: all var(--bl-dur-fast) var(--bl-ease);
}

.post-nav-card:hover {
  border-color: var(--bl-accent);
  background: var(--bl-surface-hover);
}

.nav-label {
  font-size: 0.75rem;
  color: var(--bl-accent);
  margin-bottom: 0.35rem;
  font-weight: 500;
}

.nav-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.next-card {
  text-align: right;
}

/* TOC Sidebar */
.toc-sidebar {
  position: sticky;
  top: calc(var(--bl-header-height) + 1.5rem);
}

.toc-card {
  padding: 1.25rem;
  max-height: calc(100vh - var(--bl-header-height) - 4rem);
  overflow-y: auto;
}

.toc-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--bl-text-highlight);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bl-border);
}

.toc-nav {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.toc-link {
  font-size: 0.8125rem;
  color: var(--bl-text-secondary);
  line-height: 1.4;
  transition: color var(--bl-dur-fast) var(--bl-ease);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toc-link:hover {
  color: var(--bl-accent);
}

.toc-link.level-1 {
  font-weight: 600;
}

.toc-link.level-2 {
  padding-left: 0.5rem;
}

.toc-link.level-3 {
  padding-left: 1rem;
  font-size: 0.75rem;
}

.toc-link.level-4 {
  padding-left: 1.5rem;
  font-size: 0.75rem;
}

@media (max-width: 900px) {
  .post-layout {
    grid-template-columns: 1fr;
  }

  .toc-sidebar {
    display: none;
  }

  .post-article {
    padding: 1.5rem;
  }

  .article-title {
    font-size: 1.65rem;
  }

  .nav-prev-next {
    grid-template-columns: 1fr;
  }

  .next-card {
    text-align: left;
  }
}
</style>
