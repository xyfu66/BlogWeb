# `public/` 公共静态资产宿主目录规范

## 1. 架构定位
本目录存放**脱离 Vite 编译流水线、原样直通复制（Verbatim Copy）到构建产物根目录（`dist/`）的静态资源**。在此目录下的文件不会经历任何语法解析、内容哈希重命名或代码压缩。

---

## 2. 适合存放在此的内容
- ✅ **浏览器底层协议与 SEO 契约文件**：
  - `favicon.svg`、`favicon.ico`
  - `robots.txt`、`sitemap.xml`、`manifest.json`、`CNAME` 等。
  - **为什么必须放这里**：外部搜索引擎爬虫与浏览器内核使用固定硬编码 URL 探测这些资源（例如 `GET /robots.txt`）。若加入构建哈希（如 `/robots.7e9a.txt`），将直接导致外部请求全部 404 崩溃。
- ✅ **博客文章富文本配图（`images/` 子目录）**：
  - 例如 `images/vae/` 下的专栏技术配图。
  - Markdown 内容属于动态文本，不是 ESM 模块；存放在 `public/images/` 可以提供稳定的静态访问路径，同时便于未来平滑迁移至独立对象存储（如 OSS / S3）或独立 CDN。
- ✅ **超大独立媒体与离线资产**：
  - 几百 MB 的演示视频、离线模型权重、预编译 Worker 脚本等不需要打包器参与的资源。

---

## 3. 引用范式与路径规则
- **HTML 入口中**：直接书写绝对路径，如 `<link rel="icon" type="image/svg+xml" href="/me/blog/favicon.svg" />`。
- **Markdown 文章中**：统一书写解耦路径 `![描述](/images/xxx/yyy.png)`。
  - 项目内置的 Markdown 渲染解析器已配置基准路径注入机制，会自动与 Vite 的 `import.meta.env.BASE_URL` 动态融合，无需在文章内部硬编码 `/me/blog/`。

---

## 4. 严禁存放在此的内容
- ❌ **组件私有 UI 资源与头像**：如 Vue 组件渲染需要的默认头像、操作图标、背景装饰图（必须放在 `src/assets/`，以享受不可变长效哈希缓存与缺失编译拦截）。
- ❌ **全局或局部 CSS 样式文件**（必须放在 `src/assets/styles/`）。
