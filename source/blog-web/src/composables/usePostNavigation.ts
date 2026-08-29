import { useRouter } from 'vue-router'
import type { PostNavigationTarget } from '@/types/post'

/**
 * 文章导航统一 Composable
 * 封装内链路由跳转与外链新标签页打开逻辑，实现单一数据源与行为对齐
 */
export function usePostNavigation() {
  const router = useRouter()

  function navigateToPost(post: PostNavigationTarget) {
    if (post.link) {
      window.open(post.link, '_blank', 'noopener,noreferrer')
    } else {
      router.push({ name: 'post-detail', params: { slug: post.slug } })
    }
  }

  return {
    navigateToPost,
  }
}
