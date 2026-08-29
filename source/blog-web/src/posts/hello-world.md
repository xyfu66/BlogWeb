---
title: "个人技术博客的架构设计与实现"
date: "2026-08-29"
tags: ["架构", "Vue3", "Vite", "工程化"]
slug: "hello-world"
summary: "记录本博客的工程架构选型与设计理念：基于 Vue 3 + Vite + TypeScript 技术栈，通过构建期虚拟模块实现无后端纯静态 Markdown 博客渲染，并与兄弟工程共享部署基础设施。"
---

# 个人技术博客的架构设计与实现

欢迎来到我的个人技术博客。这是博客的第一篇正式文章，记录这套纯静态、高性能博客系统的设计背景与工程实现细节。

---

## 为什么选择无后端架构？

在设计个人博客时，经常面临 **动态 CMS（如 WordPress/Ghost）** 与 **静态生成（SSG/SPA）** 的权衡：

1. **零维护成本**：无需运行额外的后端服务进程或数据库实例，避免数据库注入与安全漏洞。
2. **极速响应与防缓存**：HTML 与静态资源托管于 Nginx，利用 HTTP 缓存机制与原子文件替换达到毫秒级首屏加载。
3. **与兄弟工程共存**：博客作为 `bitvortex.vip` 域名下的 `/me/blog/` 子路径，通过 Nginx 反向代理与现有站点共用。

---

## 核心技术选型

| 维度 | 选型 | 优势与原因 |
|---|---|---|
| 核心框架 | **Vue 3.5 + TypeScript** | 组合式 API，严格类型安全，与 MSS portal 对齐 |
| 构建工具 | **Vite 8** | 毫秒级冷启动，灵活的自定义插件系统 |
| Markdown 渲染 | **Marked 18 + DOMPurify** | 高性能 Markdown 解析与严密 XSS 消毒 |
| 状态管理 | **Pinia 4** | 结构化管理文章列表、当前活跃标签与缓存 |
| UI 体系 | **Element Plus + 自研 CSS 变量** | 现代深色暗调主题，玻璃态磨砂质感 |

---

## 构建期虚拟模块机制

为了在无需后端 API 的情况下高效管理文章列表，我们在 Vite 中编写了自定义插件 `vite-plugin-blog-posts`：

```typescript
// vite/plugins/blog-posts.ts
export function blogPostsPlugin(): Plugin {
  return {
    name: 'vite-plugin-blog-posts',
    resolveId(id) {
      if (id === 'virtual:blog-posts') return '\0virtual:blog-posts'
    },
    load(id) {
      if (id === '\0virtual:blog-posts') {
        const posts = loadAllPosts('src/posts')
        return `export const posts = ${JSON.stringify(posts)}; export default posts;`
      }
    },
  }
}
```

前端只需简单通过 `import posts from 'virtual:blog-posts'` 即可直接获取按发布时间排序的文章元数据列表。

而具体文章的正文 Markdown，则在用户点击进入文章详情时通过 `import.meta.glob` 懒加载载入，确保首屏体积极其轻量。

---

## 零停机原子静态部署

博客继承了 BitVortex 体系的自动化发布流水线：

1. 本地通过 PowerShell 脚本完成 TypeScript 编译与 Vite 构建。
2. 构建产物通过 `scp` 上传至远程服务器的临时 Staging 目录（`/var/www/me/blog.staging`）。
3. 远程执行 `static-atomic-swap.sh`，利用 Linux `mv` 的原子性瞬间完成版本切换：

```bash
# static-atomic-swap.sh 核心逻辑
rm -rf /var/www/me/blog.bak
if [[ -d /var/www/me/blog ]]; then
  mv /var/www/me/blog /var/www/me/blog.bak
fi
mv /var/www/me/blog.staging /var/www/me/blog
chmod -R u=rwX,go=rX /var/www/me/blog
```

这确保了即使在高并发访问期间，用户也不会遭遇 404 或静态资源加载不完整的尴尬局面。

---

## 结语

技术是一场持续探索的旅程。在这片小天地里，我将继续记录更多系统架构、工程实践以及音频算法领域的思考与实践。感谢阅读！
