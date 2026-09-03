import type { Plugin } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBlogData } from './loader.ts'

export type { BlogPostMeta, PostSeriesInfo, SeriesConfig, SeriesMeta } from '../../src/types/post.ts'
export { loadBlogData } from './loader.ts'
export {
  compareDateDesc,
  compareOptionalDesc,
  compareSameSeriesPartDesc,
  compareCategory,
  comparePosts,
  compareSeries,
} from '../../src/utils/comparator.ts'
export {
  cleanQuotes,
  generateCleanSummary,
  calculateReadingTime,
  extractPartFromFilename,
  parseFrontmatter,
} from './parser.ts'

const VIRTUAL_MODULE_ID = 'virtual:blog-posts'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

/**
 * Vite 博客数据注入插件（薄适配器模式）
 * 专职负责 Vite 虚拟模块解析、代码生成与 HMR 缓存失效，
 * 数据加载、解析与排序算法已解耦至 loader、parser 与 comparator 模块。
 */
export function blogPostsPlugin(): Plugin {
  let rootDir = ''

  return {
    name: 'vite-plugin-blog-posts',
    configResolved(config) {
      rootDir = config.root || fileURLToPath(new URL('../..', import.meta.url))
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID
      }
    },
    load(id) {
      if (id === RESOLVED_VIRTUAL_MODULE_ID) {
        const postsDir = path.resolve(rootDir, 'src/posts')
        const { posts, seriesList } = loadBlogData(postsDir)
        return `export const posts = ${JSON.stringify(posts, null, 2)};\nexport const seriesList = ${JSON.stringify(seriesList, null, 2)};\nexport default posts;`
      }
    },
    handleHotUpdate({ file, server }) {
      const normalized = file.replace(/\\/g, '/')
      if (
        normalized.includes('/src/posts/') &&
        /\.(md|json|yaml|yml)$/i.test(normalized)
      ) {
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
        if (mod) {
          server.moduleGraph.invalidateModule(mod)
          server.ws.send({
            type: 'full-reload',
          })
        }
      }
    },
  }
}
