# `src/assets/` 模块化资产目录规范

## 1. 架构定位
本目录存放**与前端应用源码深度绑定的模块化资产（Module Graph Assets）**。所有存放在此目录中的文件均会被纳入 **Vite / Rollup 构建依赖图谱** 中进行语法分析与优化处理。

---

## 2. 适合存放在此的内容
- ✅ **Vue 业务组件 UI 资产**：如用户头像（`avatar.svg`）、系统 LOGO、操作图标、空状态插画。
- ✅ **全局与主题样式表**：如 `styles/main.css`、`styles/variables.css`、`styles/markdown.css`。
- ✅ **自定义字体与徽标**：如 `.woff2` 字体文件。

---

## 3. 核心工程优势
1. **编译期强类型依赖校验**：
   - 必须通过 ESM 显式导入（如 `import defaultAvatar from '@/assets/avatar.svg'`）或在 CSS 中使用 `url()` 引用。
   - 文件重命名或被删除时，TypeScript / Vite 在构建阶段立即报错阻断，**从根源上杜绝生产环境 404**。
2. **不可变长效强缓存（Content-Hash Cache Busting）**：
   - 打包构建时，Vite 会根据文件内容计算哈希值（如 `avatar.8a9f2c.svg`）。
   - 生产环境中可安全配置 `Cache-Control: max-age=31536000, immutable`，实现极致静态加速，且一旦文件修改必定产生新哈希，彻底解决用户端版本缓存脏数据。
3. **自动化打包优化**：
   - 小于内联阈值（默认 4KB）的资源会自动转化为 Base64 Data URL 内联到代码中，减少 HTTP 请求往返。
4. **Tree-shaking 孤岛清理**：
   - 未被任何组件或代码引用的资产，打包时自动被剔除，不会污染发布包。

---

## 4. 严禁存放在此的内容
- ❌ **外部协议契约文件**：如 `favicon.svg`、`robots.txt`、`sitemap.xml` 等必须通过固定根路径直接访问的文件（必须放在 `public/`）。
- ❌ **博客文章动态插图**：如 Markdown 专栏中的大图与时序架构图（应放在 `public/images/`）。
