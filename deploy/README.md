# BlogWeb 自动化部署指南

本文档提供 `BlogWeb` (个人博客系统 `blog-web`) 的完整自动化部署规范、服务端基础设施初始化、Nginx 配置建议及故障回滚方案。

---

## 架构与部署原理

```
[本地 Windows 开发机]
  1. npm ci && npm run build (生成 source/blog-web/dist)
  2. scp 上传至远程服务器暂存目录 (/var/www/me/blog.staging)
  3. SSH 触发远端毫秒级原子重命名 (Atomic Swap)
         ↓
[远程 Linux 服务器 (Nginx)]
  /var/www/me/blog.staging  ───(mv)───>  /var/www/me/blog (线上生产目录)
                                                │
                                               (mv 备份至 /var/www/me/blog.bak)
```

| 部署机制 | 说明 |
|:---|:---|
| **构建隔离** | 在本地或 CI 完成 TypeScript 编译与 Vite 打包，不在生产服务器安装 Node.js 构建环境 |
| **原子热替换** | 先将打包产物全量上传至 `.staging` 目录，验证完整后通过 Linux 文件系统原子重命名 (`mv`) 替换生产目录，实现**零停机时间 (Zero-downtime)** |
| **即时回滚** | 每次发布自动保留上一版本至 `.bak` 目录，遇到突发异常可秒级还原 |
| **路由前缀** | 博客前端基于 `/me/blog/` 子路径构建，与宿主机企业/门户站点共用 Nginx 基础设施 |

---

## 本机前置要求 (Windows)

在执行发布之前，请确保本地 Windows 开发机满足以下工具链条件：

### 1. 命令行工具
- **OpenSSH 客户端**：系统中已安装 `ssh` 与 `scp` 并已加入系统环境变量 PATH。
- **PowerShell 5.1+** (Windows 自带或 PowerShell 7)。
- **Node.js 20+** 与 **npm**。

### 2. SSH 免密登录配置
部署脚本内部严格启用了 `BatchMode=yes`，**不支持交互式输入密码**。本地私钥必须完成免密配对：
```powershell
# 验证免密连通性 (必须返回 ok 且无任何密码提示输入)
ssh -i $env:USERPROFILE\.ssh\id_ed25519 -o BatchMode=yes deploy@your-server-ip echo ok
```

---

## 配置文件说明

部署配置统一由 `deploy/.env` 维护（**已 gitignore，严禁提交到代码仓库**）。

### 1. 快速初始化
```powershell
Copy-Item .\deploy\.env.example .\deploy\.env
```

### 2. 配置项定义 (`deploy/.env`)

```ini
# SSH 连接目标
SSH_HOST=your.server.com          # 服务器 IP 或域名
SSH_USER=deploy                   # 具有目录操作权限的非 root 用户
SSH_PORT=22                       # SSH 端口（默认 22）
SSH_KEY=~/.ssh/id_ed25519         # 本机 SSH 私钥绝对路径或 ~ 路径

# 个人博客静态托管目录（宿主机 Nginx 目录；非 Docker）
REMOTE_BLOG_DIR=/var/www/me/blog
```

---

## 首次上线：服务端初始化

如服务器尚未配置 Nginx 站点或目录权限，请按以下步骤执行初始化（以 Ubuntu/Debian 为例）：

### 1. 创建静态发布目录与属主配置

在远程服务器上执行：
```bash
# 创建生产目录、暂存目录
sudo mkdir -p /var/www/me/blog /var/www/me/blog.staging

# 将属主赋予 deploy 用户，组设为 www-data（使 Nginx 可读，发布脚本可写）
sudo chown -R deploy:www-data /var/www/me
sudo chmod -R 755 /var/www/me
```

### 2. 宿主机 Nginx 配置建议

在服务器 `/etc/nginx/sites-available/` 对应的站点配置文件中（或主 server 块内），添加如下 location 块：

```nginx
# 个人博客静态托管 (/me/blog/)
location /me/blog/ {
    alias /var/www/me/blog/;
    try_files $uri $uri/ /me/blog/index.html;

    # 静态带 hash 资源长缓存 (30 天)
    location ~* /me/blog/.*\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform, immutable";
        access_log off;
    }

    # 入口 HTML 严禁缓存，确保版本更新即时生效
    location = /me/blog/index.html {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        expires 0;
    }
}
```

测试并重载 Nginx：
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 日常发布流程

所有发布命令均在**本地项目根目录**通过 PowerShell 执行。

### 1. 预检演练 (DryRun)
在不进行实际编译与远程文件传输的情况下，预览所有 SSH / SCP 命令及目标路径：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1 -DryRun
```

### 2. 正式一键发布
自动执行：依赖检测/安装 → 本地 `npm run build` 打包 → SCP 上传至 `.staging` → 远程原子替换 → 设置权限：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1
```

### 3. 跳过本地构建 (仅发布产物)
若本地已经完成 `npm run build` 且 `source/blog-web/dist` 已存在，可跳过构建直接发布：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1 -SkipBuild
```

---

## 故障排查与应急回滚

若新版本发布后线上出现非预期异常或页面空白，可立即通过远程保留的 `.bak` 历史备份实施秒级回滚。

### 毫秒级应急回滚命令
SSH 登录服务器后直接执行：
```bash
# 将当前异常版本移开，迅速换回上一版本 .bak
sudo rm -rf /var/www/me/blog.broken
sudo mv /var/www/me/blog /var/www/me/blog.broken
sudo mv /var/www/me/blog.bak /var/www/me/blog
```

---

## 脚本退出码定义

| 退出码 | 标识 | 说明 |
|:---|:---|:---|
| `10` | `ExitPreflight` | 前置检查失败（缺少 `deploy/.env` 或缺少 `SSH_HOST`/`SSH_USER`/`REMOTE_BLOG_DIR` 必需参数） |
| `20` | `ExitBuild` | 本地前端构建失败（`npm install`/`npm run build` 报错或缺少 `dist/index.html`） |
| `30` | `ExitDeploy` | 远程部署阶段失败（SSH 执行失败、SCP 传输失败或原子替换脚本异常） |
