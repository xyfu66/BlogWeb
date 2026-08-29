import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/series',
    name: 'series-list',
    component: () => import('@/views/SeriesListView.vue'),
    meta: { title: '专栏合集' },
  },
  {
    path: '/series/:slug',
    name: 'series-detail',
    component: () => import('@/views/SeriesDetailView.vue'),
    props: true,
    meta: { title: '专栏详情' },
  },
  {
    path: '/post/:slug',
    name: 'post-detail',
    component: () => import('@/views/PostView.vue'),
    props: true,
    meta: { title: '文章详情' },
  },
  {
    path: '/tag/:tag',
    name: 'tag-filter',
    component: () => import('@/views/TagView.vue'),
    props: true,
    meta: { title: '标签文章' },
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchView.vue'),
    props: true,
    meta: { title: '搜索结果' },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('@/views/AboutView.vue'),
    meta: { title: '关于我' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) {
      return savedPosition
    }
    return { top: 0 }
  },
})

router.afterEach((to) => {
  const baseTitle = 'BlogWeb - 个人技术博客'
  if (to.meta?.title) {
    document.title = `${to.meta.title} | ${baseTitle}`
  } else {
    document.title = baseTitle
  }
})

export default router
