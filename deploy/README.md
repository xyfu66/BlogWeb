# BlogWeb 个人博客自动化部署说明书

本项目为 **BlogWeb (个人技术博客)** 的 DevOps 编排层（L0）：通过 SSH/SCP 实现 Vue 3 SPA 前端工程的独立自动化构建、传输与零停机原子热切换。

---

## 部署模型与架构定位

- **域名与路径**：单域名子路径 `https://<domain>/me/blog/`（如 `bitvortex.vip/me/blog/`）
- **静态目录**：`/var/www/me/blog`（父根 `/var/www`，配合 `root /var/www; try_files $uri $uri/ /me/blog/index.html;`）
- **网关归属**：宿主机 Nginx 网关由主工程 `CorpWeb` 统一集中维护并渲染（SoT）；`BlogWeb` 前端静态代码日常发布完全独立，互不干扰。

---

## 配置文件体系

| 配置文件 | 归属层级 | 说明 |
|:---|:---|:---|
| `deploy/.env` | L0 编排层 | 本机维护。包含 SSH 目标、端口、私钥路径及远端目录。**已 gitignore**。 |
| `deploy/nginx/sites.env` | L4 边缘层 | 宿主机 Nginx 绑机变量。Preflight 会安全同步至远端。**已 gitignore**。 |

### 快速初始化配置
```powershell
Copy-Item .\deploy\.env.example .\deploy\.env
Copy-Item .\deploy\nginx\sites.env.example .\deploy\nginx\sites.env
```
> 编辑 `deploy/.env`，核对 `SSH_HOST`、`SSH_USER` 与 `REMOTE_BLOG_DIR`（默认 `/var/www/me/blog`）。

---

## 首次上线

### 第 1 步 — 服务端初始化 (Ubuntu)

```bash
# 1. 克隆代码仓库至服务器
sudo mkdir -p /opt/BlogWeb
git clone https://github.com/xyfu66/BlogWeb.git /opt/BlogWeb
sudo chown -R deploy:deploy /opt/BlogWeb

# 2. 创建静态生产与暂存目录并赋权
sudo mkdir -p /var/www/me/blog /var/www/me/blog.staging
sudo chown -R deploy:www-data /var/www/me
sudo chmod -R 755 /var/www/me
```

### 第 2 步 — Nginx 路由生效

- **推荐方式（通过 CorpWeb 统一网关）**：
  在服务器执行 `CorpWeb` 的网关安装脚本（已自动集成 `/me/blog/` 规则）：
  ```bash
  sudo bash /opt/CorpWeb/deploy/scripts/remote/install-nginx-sites.sh
  ```
- **备用方式（手动追加）**：
  将 `deploy/nginx/blog.conf` 中的 location 块追加至 `/etc/nginx/sites-available/corp-mss.conf` 的 443 server 块内，并执行：
  ```bash
  sudo nginx -t && sudo systemctl reload nginx
  ```

---

## 日常发布

日常更新文章或前端代码**无需修改或重启 Nginx**，在本地 Windows 执行：

```powershell
# 一键完成：前置预检 -> 远程 Git 对齐 -> 本机构建 -> 暂存上传 -> 毫秒级原子热切换 -> 健康探活 -> 审计记录
powershell -ExecutionPolicy Bypass -File .\deploy\scripts\deploy-all.ps1
```

### 常用可选参数
```powershell
# 仅空跑预览，不执行实际构建与传输
.\deploy\scripts\deploy-all.ps1 -DryRun

# 跳过本地 npm build，直接发布 dist/ 现有产物
.\deploy\scripts\deploy-blog.ps1 -SkipBuild

# 跳过远程 Git Pull
.\deploy\scripts\deploy-all.ps1 -SkipGitPull
```

---

## 故障排查与应急回滚

若新版本发布后存在异常，可使用每次部署自动保留的 `.bak` 快照实现秒级回滚：

```bash
# SSH 登录服务器执行
sudo rm -rf /var/www/me/blog.broken
sudo mv /var/www/me/blog /var/www/me/blog.broken
sudo mv /var/www/me/blog.bak /var/www/me/blog
```

---

## 退出码定义

| 退出码 | 标识 | 说明 |
|:---|:---|:---|
| `10` | `ExitPreflight` | 前置检查失败（缺少命令行依赖、`.env` 缺失、SSH 密钥不可达、存在占位符） |
| `20` | `ExitBuild` | 本地前端构建失败（`npm run build` 报错或缺少 `dist/index.html`） |
| `30` | `ExitDeploy` | 远程部署阶段失败（SSH 异常或原子切换脚本退出） |
| `40` | `ExitHealth` | 服务健康探活失败（无法读取入口页面标记） |
| `50` | `ExitScp` | SCP 文件传输阶段失败 |
