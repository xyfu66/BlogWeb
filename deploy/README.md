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

### 2. 宿主机 Nginx 配置规范（模块化与防污染）

在同一域名下存在多个兄弟工程（如企业门户、个人博客等）时，为了**杜绝配置污染、防止全局正则劫持，并支持自动化安全发布**，推荐采用 **模块化 Snippet** 架构。

#### 架构要点：
1. **模块化解耦**：宿主机主 server 块只保留通用配置，通过 `include /etc/nginx/snippets/*.conf;` 动态引入各子项目。
2. **防正则劫持 (`^~`)**：博客路由使用 `location ^~ /me/blog/`，强制在匹配该前缀后停止向下查找任何顶层正则规则（如兄弟工程可能定义的 `location ~* \.(js|css)`），彻底实现作用域隔离。
3. **日常发布与 Nginx 解耦**：代码日常发布（`deploy-blog.ps1`）仅操作静态目录（原子替换），**无需修改或 reload Nginx**；仅在首次上线或路由规则变更时使用 `configure-nginx.ps1`。

#### A. 方式一：本地一键自动化配置 Nginx (推荐)

本地执行自动化脚本，将 `deploy/nginx/blog.conf` 安全推送至服务器，并在远端自动执行 `nginx -t` 测试与平滑重载（**若语法测试不通过将自动回滚，绝不破坏现有兄弟工程**）：

```powershell
# 1. 预检演练 (预览远程路径与执行脚本)
powershell -ExecutionPolicy Bypass -File .\deploy\configure-nginx.ps1 -DryRun

# 2. 正式一键同步并热重载 Nginx
powershell -ExecutionPolicy Bypass -File .\deploy\configure-nginx.ps1

# 3. 仅推送配置并语法检查，不触发 reload
powershell -ExecutionPolicy Bypass -File .\deploy\configure-nginx.ps1 -SkipReload
```

#### B. 方式二：手动配置说明

##### ① 宿主机主 Server 块设置
在主站点配置文件（如 `/etc/nginx/sites-available/your-domain.conf`）中添加 include：
```nginx
server {
    listen 443 ssl http2;
    server_name your.server.com;

    # ... SSL 及全局 gzip 配置 ...

    # 引入所有子模块的独立 location 片段
    include /etc/nginx/snippets/*.conf;

    # 根域名默认门户 (例如 CorpWeb)
    location / {
        root /var/www/corp;
        try_files $uri $uri/ /index.html;
    }
}
```

##### ② 博客独立片段配置 (`/etc/nginx/snippets/blog-web.conf`)
即工程内 `deploy/nginx/blog.conf` 的内容：
```nginx
# 使用 ^~ 彻底防止被其他兄弟工程的全局正则 location 劫持
location ^~ /me/blog/ {
    alias /var/www/me/blog/;
    try_files $uri $uri/ /me/blog/index.html;

    # 1. 前端构建产物 (Vite hash assets) 长效长缓存 (30 天)
    # 使用 ^~ 前缀匹配并显式指定 alias，彻底避免 Nginx 嵌套正则无法继承 alias 的已知陷阱
    location ^~ /me/blog/assets/ {
        alias /var/www/me/blog/assets/;
        expires 30d;
        add_header Cache-Control "public, no-transform, immutable";
        access_log off;
    }

    # 2. SPA 入口 HTML 严禁缓存，确保版本即时生效并追加标准安全响应头
    location = /me/blog/index.html {
        alias /var/www/me/blog/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        expires 0;
    }
}
```

#### C. 服务端权限配置建议 (Sudoers 最小权限)
若 `deploy` 用户为非 root 账号，为支持自动化配置与安全重载，可在服务器 `/etc/sudoers.d/deploy` 中配置最小白名单：
```sudoers
deploy ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t, /bin/systemctl reload nginx, /usr/bin/mkdir -p /etc/nginx/snippets*, /usr/bin/cp /tmp/blog-web.conf.tmp /etc/nginx/snippets/*
```

---

## 环境与连通性前置检查 (Preflight)

在发布前或首次初始化后，可执行独立前置检测脚本快速排查环境隐患：
```powershell
# 执行本地工具链、deploy/.env、SSH 免密及远端目标目录的综合体检
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\preflight.ps1
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
自动执行：环境 Preflight 检查 → 依赖检测/安装 → 本地 `npm run build` 打包 → SCP 上传至 `.staging` → 远程原子替换 → 设置权限：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1
```

### 3. 跳过构建或跳过前检 (可选参数)
```powershell
# 跳过本地 build，仅发布既有产物
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1 -SkipBuild

# 跳过前置网络与依赖检查
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1 -SkipPreflight
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
