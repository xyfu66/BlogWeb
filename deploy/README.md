# BlogWeb 自动化部署指南

本文档为 `BlogWeb` 个人博客系统的标准部署操作指南，按步骤说明环境准备、服务端初始化、Nginx 配置、日常发布与应急回滚流程。

---

## 目录
1. [前置准备](#一前置准备)
2. [第一步：环境预检 (Preflight)](#第一步环境预检-preflight)
3. [第二步：首次上线（服务端初始化与 Nginx 配置）](#第二步首次上线服务端初始化与-nginx-配置)
4. [第三步：日常代码发布](#第三步日常代码发布)
5. [第四步：应急故障回滚](#第四步应急故障回滚)
6. [附录：脚本退出码定义](#附录脚本退出码定义)

---

## 一、前置准备

### 1. 本机工具链要求 (Windows)
- 安装 **Node.js 20+** 与 **npm**。
- 安装 **OpenSSH 客户端**（系统 PATH 中已包含 `ssh` 与 `scp`）。
- 配置 SSH 免密登录（部署脚本启用 `BatchMode=yes`，不支持交互式输入密码）。

### 2. 初始化部署配置文件
在项目根目录复制并创建配置文件：
```powershell
Copy-Item .\deploy\.env.example .\deploy\.env
```

编辑 `deploy/.env`，填写实际服务器信息：
```ini
# SSH 连接信息
SSH_HOST=your.server.com
SSH_USER=deploy
SSH_PORT=22
SSH_KEY=~/.ssh/id_ed25519

# 宿主机静态目录
REMOTE_BLOG_DIR=/var/www/me/blog
```

---

## 第一步：环境预检 (Preflight)

在正式发布前，运行独立检测脚本，验证本地工具链、`deploy/.env` 参数、SSH 免密握手及远端目录权限：

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\preflight.ps1
```

> **通过标准**：所有检测项均显示 `[PASS]` 即可继续下一步。

---

## 第二步：首次上线（服务端初始化与 Nginx 配置）

首次上线时，SSH 登录服务器完成一次性初始化配置。

### 1. 创建静态托管目录与权限分配
```bash
# 创建生产目录与暂存目录
sudo mkdir -p /var/www/me/blog /var/www/me/blog.staging

# 分配属主给 deploy 用户，组设为 www-data
sudo chown -R deploy:www-data /var/www/me
sudo chmod -R 755 /var/www/me
```

### 2. 宿主机 Nginx 配置

在服务器对应的站点配置文件中（如 `/etc/nginx/sites-available/` 或 `/etc/nginx/conf.d/` 对应的 `server` 块内），添加如下 location 块：

```nginx
# 个人博客静态托管 (/me/blog/)
location ^~ /me/blog/ {
    alias /var/www/me/blog/;
    try_files $uri $uri/ /me/blog/index.html;

    # 前端构建产物长效缓存 (30 天)
    location ^~ /me/blog/assets/ {
        alias /var/www/me/blog/assets/;
        expires 30d;
        add_header Cache-Control "public, no-transform, immutable";
        access_log off;
    }

    # 入口 HTML 严禁缓存，确保版本即时生效
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

### 3. 测试语法并重载 Nginx
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 第三步：日常代码发布

日常代码迭代发布**无需修改或重启 Nginx**，由 `deploy` 账号在本地执行一键自动化发布。

### 1. 预检演练 (DryRun)
预览打包与远程文件传输流程，不执行实际修改：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1 -DryRun
```

### 2. 正式一键发布
自动执行：Preflight 环境自检 → 本地打包构建 → SCP 上传暂存区 → 毫秒级原子替换：
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1
```

### 3. 可选快捷参数
```powershell
# 仅发布既有产物，跳过本地 npm build
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1 -SkipBuild

# 跳过前置网络与依赖检查
powershell -ExecutionPolicy Bypass -File .\deploy\deploy-blog.ps1 -SkipPreflight
```

---

## 第四步：应急故障回滚

若新版本上线后出现异常，可立即通过服务器保留的 `.bak` 历史备份秒级恢复：

```bash
# SSH 登录服务器执行
sudo rm -rf /var/www/me/blog.broken
sudo mv /var/www/me/blog /var/www/me/blog.broken
sudo mv /var/www/me/blog.bak /var/www/me/blog
```

---

## 附录：脚本退出码定义

| 退出码 | 标识 | 说明 |
|:---|:---|:---|
| `10` | `ExitPreflight` | 前置检查失败（缺少 `deploy/.env`、必填配置缺失或工具缺失） |
| `20` | `ExitBuild` | 本地前端构建失败（`npm install` / `npm run build` 报错） |
| `30` | `ExitDeploy` | 远程部署失败（SSH / SCP 连接失败或原子替换命令异常） |
