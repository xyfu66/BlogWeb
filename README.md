# BlogWeb

个人博客工程仓库，包含个人博客前端应用 `blog-web` 及独立的自动化部署脚本。

## 目录结构

```
BlogWeb/
├── .gitignore
├── README.md
├── deploy/                # 轻量部署脚本与环境配置示例
│   ├── .env.example
│   └── deploy-blog.ps1
├── doc/                   # 项目文档与规划
└── source/
    └── blog-web/          # Vue 3 + Vite + TypeScript 前端工程
```

## 技术栈

- **框架**: Vue 3 (`^3.5.39`) + Vite (`^8.1.1`) + TypeScript (`~6.0.2`)
- **UI 库**: Element Plus (`^2.14.3`)
- **路由**: Vue Router (`^5.2.0`, HTML5 History 模式, base: `/me/blog/`)
- **状态管理**: Pinia (`^4.0.2`)
- **内容渲染**: Marked (`^18.0.11`) + DOMPurify (`^3.4.12`)
- **文章加载**: 构建期 Vite 插件提取 Frontmatter 元数据 + 运行时懒加载正文

## 本地开发

```bash
cd source/blog-web
npm install   # 或 npm ci
npm run dev
```

默认开发端口为 `http://localhost:8040/me/blog/`。

## 构建与类型检查

```bash
cd source/blog-web
npm run build
```

## 自动化部署

部署脚本位于 `deploy/` 目录：

1. 复制 `deploy/.env.example` 为 `deploy/.env` 并填写远程服务器 SSH 与路径信息。
2. 在 PowerShell 中执行部署：

```powershell
# 预检演练 (DryRun)
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1 -DryRun

# 正式发布
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1
```
