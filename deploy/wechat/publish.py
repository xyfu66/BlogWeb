# -*- coding: utf-8 -*-
"""
publish.py: 微信公众号文章交互式发布与本地效果预览主入口
"""
import os
import sys
import json
import argparse
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

# 确保控制台支持 UTF-8 打印
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

CURRENT_DIR = Path(__file__).resolve().parent
PREVIEW_DIR = CURRENT_DIR / "preview"
PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
AUDIT_LOG_FILE = CURRENT_DIR / "publish-audit.jsonl"
COVER_CACHE_DIR = CURRENT_DIR / ".cache" / "covers"

from scanner import scan_all_posts
from converter import WeChatArticleConverter
from cover_generator import generate_cover_image
from wechat_api import WeChatClient, get_config

def print_banner():
    print("=" * 70)
    print(" 🚀 BitVortex 博客 -> 微信公众号草稿箱发布工具")
    print("=" * 70)

def list_posts(posts):
    print(f"\n📚 博客文章库中共有 {len(posts)} 篇文章（时间升序；同系列连续且按章节序）：\n")
    for i, p in enumerate(posts, 1):
        series_info = f" [专栏: {p['series_name']}]" if p.get('series_name') else ""
        date_str = p.get('date') or "无日期"
        print(f"  {i:2d}. [{date_str}] {p['title']}{series_info}")
    print()

def record_audit_log(post: Dict[str, Any], media_id: str):
    """记录发布审计日志"""
    entry = {
        "timestamp": datetime.now().isoformat(),
        "operator": os.getenv("USERNAME", "operator"),
        "title": post.get("title"),
        "slug": post.get("slug"),
        "file_path": post.get("file_path"),
        "media_id": media_id,
    }
    with open(AUDIT_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")

def resolve_cover_image(selected_post: Dict[str, Any], cover_arg: Optional[str]) -> Path:
    """--cover 优先；否则按标题生成居中封面图。"""
    if cover_arg:
        c_path = Path(cover_arg).resolve()
        if c_path.is_file():
            print(f"  🖼️  封面图: [手动指定] {c_path}")
            return c_path
        print(f"[警告] 指定的封面图文件不存在: {cover_arg}，将改为程序生成标题封面")

    try:
        path = generate_cover_image(
            title=selected_post.get("title") or "未命名文章",
            slug=selected_post.get("slug") or "untitled",
            series_name=selected_post.get("series_name"),
            out_dir=COVER_CACHE_DIR,
        )
    except Exception as e:
        print(f"\n❌ 生成封面标题图失败: {e}")
        sys.exit(1)
    print(f"  🖼️  封面图: [程序生成标题封面] {path}")
    return path


def main():
    parser = argparse.ArgumentParser(description="BlogWeb 微信公众号发布工具")
    parser.add_argument("--preview", action="store_true", help="仅生成本地 HTML 预览文件并在浏览器打开，不调用微信 API")
    parser.add_argument("--list", action="store_true", help="仅列出文章库目录")
    parser.add_argument("--post", type=str, help="指定文章序号或 slug（如 1 或 vae-part-1-intuitive-guide）")
    parser.add_argument("--cover", type=str, help="显式指定封面图本地路径")
    parser.add_argument("--dry-run", action="store_true", help="空跑校验逻辑，不执行真实网络上传")
    args = parser.parse_args()

    print_banner()

    posts = scan_all_posts()
    if not posts:
        print("[错误] 未扫描到任何博客文章，请检查 source/blog-web/src/posts 目录！")
        sys.exit(1)

    if args.list:
        list_posts(posts)
        sys.exit(0)

    # 确定选中的文章
    selected_post: Optional[Dict[str, Any]] = None
    if args.post:
        if args.post.isdigit():
            idx = int(args.post)
            if 1 <= idx <= len(posts):
                selected_post = posts[idx - 1]
        if not selected_post:
            for p in posts:
                if p.get("slug") == args.post or args.post in p.get("file_name", ""):
                    selected_post = p
                    break
        if not selected_post:
            print(f"[错误] 未找到对应参数 --post '{args.post}' 的文章！")
            sys.exit(1)
    else:
        list_posts(posts)
        while True:
            choice = input(f"请输入要发布的文章序号 (1-{len(posts)}，输入 q 退出): ").strip()
            if choice.lower() in ("q", "quit", "exit"):
                print("已取消操作。")
                sys.exit(0)
            if choice.isdigit() and 1 <= int(choice) <= len(posts):
                selected_post = posts[int(choice) - 1]
                break
            print("输入有误，请输入有效的文章序号！")

    print("\n" + "-" * 70)
    print("【已选择目标文章】")
    print(f"  📌 标题: {selected_post.get('title')}")
    print(f"  📅 日期: {selected_post.get('date')}")
    if selected_post.get("series_name"):
        print(f"  📚 专栏: {selected_post.get('series_name')}")
    print(f"  🏷️  标签: {', '.join(selected_post.get('tags', []))}")
    print(f"  📝 摘要: {selected_post.get('summary')}")
    print(f"  📁 路径: {selected_post.get('file_path')}")
    print("-" * 70)

    cover_image_path = resolve_cover_image(selected_post, args.cover)

    # 本地预览模式
    if args.preview:
        print("\n🔍 正在生成本地排版预览文件 (Preview Mode)...")
        converter = WeChatArticleConverter(is_preview=True)
        html_content = converter.convert_markdown(selected_post)
        
        preview_file = PREVIEW_DIR / f"{selected_post['slug']}.html"
        preview_file.write_text(html_content, encoding="utf-8")
        print(f"✅ 预览文件已成功生成！")
        print(f"   路径: {preview_file}")
        print(f"   封面: {cover_image_path}")
        
        # 尝试使用系统默认浏览器打开
        try:
            webbrowser.open(preview_file.as_uri())
            print("   已尝试在默认浏览器中为您打开预览。")
        except Exception as e:
            print(f"   (未能自动调起浏览器: {e})")
        sys.exit(0)

    if args.dry_run:
        print("\n[DryRun] 工具可用性验证通过：")
        print(f"  - 扫描文章库：{len(posts)} 篇文章可用")
        print(f"  - 已选文章：《{selected_post['title']}》")
        print(f"  - 封面图：{cover_image_path}")
        print("  - 注意：未向微信服务器发起任何网络请求")
        sys.exit(0)

    # 正式发布模式：检查微信凭证
    cfg = get_config()
    if not cfg["app_id"] or not cfg["app_secret"] or "your_appid" in cfg["app_id"]:
        print("\n❌ 未配置微信公众号 API 凭证！")
        print("   请在 deploy/wechat/.env 中填写真实的 WECHAT_APP_ID 和 WECHAT_APP_SECRET。")
        print("   您可以复制 deploy/wechat/.env.example 作为模板进行配置。")
        print("   提示：您可以先添加参数 --preview 测试本地转换排版效果。\n")
        sys.exit(1)

    # 确认发布
    confirm = input(f"\n确认将《{selected_post['title']}》推送至微信订阅号草稿箱？(y/N): ").strip().lower()
    if confirm not in ("y", "yes"):
        print("用户已取消发布。")
        sys.exit(0)

    print("\n⏳ 正在连接微信公众平台并执行转换发布流水线...")
    client = WeChatClient()

    # 1. 验证凭证获取 access_token
    try:
        token = client.get_access_token()
        print("  🔑 [1/4] 成功获取/验证微信 Access Token")
    except Exception as e:
        print(f"\n❌ 获取 Access Token 失败: {e}")
        sys.exit(1)

    # 2. 上传封面图
    thumb_media_id = ""
    if cover_image_path and cover_image_path.is_file():
        try:
            print(f"  🖼️  [2/4] 正在上传封面素材: {cover_image_path.name} ...")
            thumb_media_id = client.upload_thumb_material(cover_image_path)
            print(f"      封面素材已上传，Thumb Media ID: {thumb_media_id}")
        except Exception as e:
            print(f"\n❌ 上传封面素材失败: {e}")
            sys.exit(1)
    else:
        print("\n❌ 缺少封面图，微信公众号草稿箱必须提供封面图！")
        sys.exit(1)

    # 3. 转换正文并上传图文内公式、图表和图片
    try:
        print("  🎨 [3/4] 正在转换正文 Markdown 并上传公式/图表/图片...")
        converter = WeChatArticleConverter(client=client, is_preview=False)
        article_html = converter.convert_markdown(selected_post)
        print("      图文混排排版与全内联样式渲染完成")
    except Exception as e:
        print(f"\n❌ 正文转换/图片上传异常: {e}")
        sys.exit(1)

    # 4. 提交至草稿箱
    try:
        print("  📦 [4/4] 正在将文章写入微信草稿箱 (draft/add)...")
        draft_media_id = client.add_draft(
            title=selected_post["title"],
            content_html=article_html,
            thumb_media_id=thumb_media_id,
            digest=selected_post.get("summary", ""),
        )
    except Exception as e:
        print(f"\n❌ 提交草稿箱失败: {e}")
        sys.exit(1)

    # 记录审计日志
    record_audit_log(selected_post, draft_media_id)

    print("\n" + "=" * 70)
    print(" 🎉 [发布成功] 文章已安全推送到微信公众号草稿箱！")
    print(f"  📄 标题: 《{selected_post['title']}》")
    print(f"  🆔 草稿 Media ID: {draft_media_id}")
    print("  👉 下一步操作指引：")
    print("     1. 请电脑登录微信公众平台：https://mp.weixin.qq.com/")
    print("     2. 点击左侧导航栏【草稿箱】")
    print("     3. 审阅文章排版与公式，确认无误后点击群发/发布！")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
