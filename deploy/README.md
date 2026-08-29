# BlogWeb 自动化部署指南

本文档为 `BlogWeb` 个人博客系统的标准部署与运维指南，按步骤说明环境准备、服务端初始化、多工程共存下的 Nginx 挂载、日常无感发布与应急回滚流程。

---

## 目录
1. [多工程共存架构与部署模型](#一多工程共存架构与部署模型)
2. [前置准备](#二前置准备)
3. [第一步：环境预检 (Preflight)](#第一步环境预检-preflight)
4. [第二步：首次上线（服务端初始化与 Nginx 挂载）](#第二步首次上线服务端初始化与-nginx-挂载)
5. [第三步：日常代码发布](#第三步日常代码发布)
6. [第四步：应急故障回滚](#第四步应急故障回滚)
7. [附录：目录结构](#附录目录结构)
8. [附录：脚本退出码定义](#附录脚本退出码定义)

---

## 一、多工程共存架构与部署模型

本项目部署于主域名（`bitvortex.vip`）宿主机体系下，与兄弟工程协同共存：

### 1. 宿主机 Host 与路由拓扑

| Host / 路径 | 归属工程 | 运行方式 | 生产托管路径 / 上游 |
|:---|:---|:---|:---|
| `https://<domain>/` | **CorpWeb**（企业官网） | 纯静态 | `/var/www/corp` |
| `https://www.<domain>/` | - | Nginx 301 | 跳转至 apex，保留 path/query |
| `https://<domain>/mss/` | **MusicStringStudioPro**（公开官网） | 纯静态 SPA | `/var/www/mss` |
| `https://<domain>/mss/api/` | **MusicStringStudioPro**（核心 API） | Docker Compose | 反代至 `127.0.0.1:8005` |
| `https://<domain>/mss/storage/` | **MusicStringStudioPro**（公共静态存储） | Docker Compose | 反代至 `127.0.0.1:8005` |
| `https://<domain>/me/blog/` | **BlogWeb**（本工程：个人博客） | 纯静态 SPA | `/var/www/me/blog` |
| `https://mss-admin.<domain>/` | **MusicStringStudioPro**（运营后台） | 独立子域静态 SPA | `/var/www/mss-admin` |

### 2. 宿主机 Nginx 站点架构

服务器端 `/etc/nginx/sites-available/` 管理两个核心站点配置：
- **`corp-mss.conf`**（主站点）：负责 apex 及 `www` 域名下的所有产品挂载（CorpWeb、MSS 官网及 API、BlogWeb 博客）。
- **`mss-admin.conf`**（子域站点）：负责 `mss-admin` 子域名的运营管理后台。

### 3. 发布隔离与互不影响原则

```text
[ 本机构建 ]  npm run build (生成 source/blog-web/dist)
     │
     ▼ (SCP 传输，仅写入专属暂存区)
[ 远端暂存 ]  /var/www/me/blog.staging
     │
     ▼ (执行 remote/static-atomic-swap.sh，毫秒级原子重命名)
[ 正式目录 ]  /var/www/me/blog （旧版本自动移至 /var/www/me/blog.bak）
```

- **目录完全物理隔离**：各工程分别独占专属发布目录（`/var/www/me/blog`），互不重叠。
- **发布过程零重启 Nginx**：日常代码发布依靠原子目录重命名完成热切换，**无需 reload/restart Nginx**，不中断任何正在进行的 HTTP / WebSocket 连接。
- **配置只读保护**：已由 Certbot 配置 Let's Encrypt 证书的主站点配置（`corp-mss.conf`）在首次挂载后即固化，日常发布不触碰任何 Nginx 配置文件。

---

## 二、前置准备

### 1. 本机工具链要求 (Windows)
- 安装 **Node.js 20+** 与 **npm**。
- 安装 **OpenSSH 客户端**（系统 PATH 中已包含 `ssh` 与 `scp`）。
- 配置 SSH 免密登录（部署脚本启用 `BatchMode=yes`，不支持交互式输入密码）。

```powershell
# 验证免密连通性（必须返回 ok 且无密码提示输入）
ssh -i $env:USERPROFILE\.ssh\id_ed25519 -o BatchMode=yes deploy@bitvortex.vip echo ok
```

### 2. 配置文件分域与权责

本项目沿用与兄弟工程一致的**两层配置分域**规范：

| 配置文件 | 归属层级 | 权责说明 |
|:---|:---|:---|
| `deploy/.env` | L0 编排层 | 本机维护。包含 SSH 目标、端口、私钥路径、发布目标路径及分支。**已 gitignore，严禁提交**。 |
| `deploy/nginx/sites.env` | L4 边缘层 | 宿主机 Nginx 绑机变量（域名 `BLOG_DOMAIN`、父根目录等）。Preflight 会安全同步至远端。**已 gitignore，严禁提交**。 |

#### 快速初始化配置文件
```powershell
# 1. 复制本地编排配置
Copy-Item .\deploy\.env.example .\deploy\.env

# 2. 复制边缘 Nginx 环境变量
Copy-Item .\deploy\nginx\sites.env.example .\deploy\nginx\sites.env
```

编辑 `deploy/.env`，填写实际服务器信息。

编辑 `deploy/nginx/sites.env`，填写宿主机绑机信息。

---

## 第一步：环境预检 (Preflight)

在正式发布前，运行独立检测脚本，验证本地工具链、`deploy/.env` 参数、SSH 免密握手及远端目录权限：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\preflight.ps1
```

> **通过标准**：所有检测项均显示 `[OK]` 即可继续下一步。

Preflight 同时会将 `deploy/nginx/sites.env` 安全同步至远端 `<REMOTE_REPO_ROOT>/deploy/nginx/sites.env`（权限设为 `600`）。

---

## 第二步：首次上线（服务端初始化与 Nginx 挂载）

首次上线时，SSH 登录服务器，按以下顺序完成一次性初始化。

### 1. 克隆项目仓库至服务器
```bash
sudo mkdir -p /opt/BlogWeb
sudo chown deploy:deploy /opt/BlogWeb
git clone https://github.com/xyfu66/BlogWeb.git /opt/BlogWeb
```

### 2. 创建静态托管目录与权限分配
```bash
# 创建生产目录与暂存目录
sudo mkdir -p /var/www/me/blog /var/www/me/blog.staging

# 属主归 deploy 用户，组设为 www-data，确保 Nginx 可读且流水线免密操作
sudo chown -R deploy:www-data /var/www/me
sudo chmod -R 755 /var/www/me
```

### 3. 宿主机 Nginx 挂载配置

> [!CAUTION]
> **严禁直接覆盖远端 Nginx 配置**：远端 `/etc/nginx/sites-available/corp-mss.conf` 已通过 Certbot 配置了 Let's Encrypt 证书路径。**请勿执行全量重置脚本**，只需将本项目的 location 规则追加挂载到已有配置中。

在服务器 `/etc/nginx/sites-available/corp-mss.conf` 的 `server { listen 443 ssl; ... }` 块内追加以下 location 规则（参考 `deploy/nginx/blog.conf.template`）：

```nginx
    # ==============================================================================
    # 个人博客系统 (/me/blog/) - 宿主机子路径 SPA 挂载
    # ==============================================================================

    # 1. 自动补全末尾斜杠（访问 /me/blog 时 301 重定向至 /me/blog/，避免被根路径 location / 拦截）
    location = /me/blog {
        return 301 /me/blog/$is_args$args;
    }

    # 2. 静态资产长效缓存 (Vite hash assets，30 天不可变缓存)
    location ~* /me/blog/assets/.*\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?)$ {
        root /var/www;
        expires 30d;
        add_header Cache-Control "public, no-transform, immutable";
        access_log off;
    }

    # 3. SPA 入口 index.html 防缓存（显式补齐安全响应头，修复 Nginx add_header 继承断层）
    location = /me/blog/index.html {
        root /var/www;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        expires 0;
    }

    # 4. 个人博客 SPA 路由分发 (dist 部署于 /var/www/me/blog；root 取父根 /var/www)
    location /me/blog/ {
        root /var/www;
        try_files $uri $uri/ /me/blog/index.html;
    }
```

> [!NOTE]
> **设计原理**：
> - **采用 `root /var/www;`**：请求 `/me/blog/post/1` 时，Nginx 将 URI 追加到 root 后自然寻址 `/var/www/me/blog/post/1`，完全规避 `alias` 与 `try_files` 的已知 Bug。
> - **补齐安全响应头**：Nginx 在 location 块内声明 `add_header` 时会丢弃父级 server 块的继承，必须在 `location = /me/blog/index.html` 显式重申安全响应头。

### 4. 测试语法并重载 Nginx
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 第三步：日常代码发布

日常代码迭代发布**无需修改或重启 Nginx**，在本地执行发布脚本即可。

### 1. 一键全流程发布（推荐）
自动执行完整流水线：Preflight → 远程 Git Pull → 本地构建 → SCP 上传暂存区 → 原子热替换 → 健康检查 → 审计日志：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\deploy-all.ps1
```

### 2. 预检演练 (DryRun)
预览完整流程，不执行任何实际修改：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\deploy-all.ps1 -DryRun
```

### 3. 单独部署博客（跳过 Preflight / Git Pull / 审计）
适用于已确认环境无误、只需快速推送构建产物的场景：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\deploy-blog.ps1
```

### 4. 可选快捷参数
```powershell
# 跳过本地 npm build，直接发布 dist/ 下的已有产物
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\deploy-blog.ps1 -SkipBuild

# 跳过远程 Git Pull（服务器已手动同步时使用）
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\deploy-all.ps1 -SkipGitPull
```

---

## 第四步：应急故障回滚

若新版本上线后出现异常，可通过每次部署自动保留的 `.bak` 快照秒级恢复：

```bash
# SSH 登录服务器执行
# 1. 清除上次遗留的 broken 副本（若存在）
sudo rm -rf /var/www/me/blog.broken
# 2. 将当前异常版本标记为 broken
sudo mv /var/www/me/blog /var/www/me/blog.broken
# 3. 将上一版本快照恢复为生产目录
sudo mv /var/www/me/blog.bak /var/www/me/blog
```

---

## 附录：目录结构

```
deploy/
├── .env                             # L0 编排层：SSH + 路径配置（gitignore）
├── .env.example                     # L0 配置模板（可提交）
├── .gitignore
├── README.md
├── nginx/
│   ├── blog.conf                    # Nginx location 参考配置（硬编码，供快速查阅）
│   ├── blog.conf.template           # Nginx location 配置模板（含 ${VAR} 占位符，规范用法）
│   ├── sites.env                    # L4 边缘层：宿主机绑机变量（gitignore）
│   └── sites.env.example            # L4 配置模板（可提交）
├── scripts/
│   ├── lib/
│   │   ├── common.ps1               # 本地公共函数库（SSH/SCP/审计/配置加载）
│   │   └── common.sh                # 远程公共函数库（deploy_log / deploy_fail）
│   ├── remote/
│   │   ├── static-atomic-swap.sh    # 远程原子替换脚本
│   │   └── health-check.sh          # 远程健康检查脚本
│   ├── preflight.ps1                # 预检脚本（工具链 / SSH / 权限 / sites.env 同步）
│   ├── deploy-blog.ps1              # 博客构建 + 部署脚本
│   └── deploy-all.ps1               # 顶层编排入口（推荐使用）
└── artifacts/                       # 部署产物与审计日志（gitignore）
    └── deploy-audit.jsonl
```

---

## 附录：脚本退出码定义

| 退出码 | 标识 | 说明 |
|:---|:---|:---|
| `10` | `ExitPreflight` | 前置检查失败（缺少配置文件、必填键缺失或本地工具缺失） |
| `20` | `ExitBuild` | 本地前端构建失败（`npm install` / `npm run build` 报错） |
| `30` | `ExitDeploy` | 远程部署失败（SSH 连接失败或原子替换命令异常） |
| `40` | `ExitHealth` | 部署后健康检查失败 |
| `50` | `ExitScp` | SCP 文件传输失败 |
