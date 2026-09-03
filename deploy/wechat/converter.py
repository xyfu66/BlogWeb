# -*- coding: utf-8 -*-
"""
converter.py: 将 Markdown 博客正文转换为微信公众号兼容的高保真、全内联样式富文本 HTML
支持：
- 行内与块级 LaTeX 公式（matplotlib 高清 PNG 渲染与上传）
- Mermaid 流程图与时序图（渲染为 PNG 图片）
- 站内图片 /images/... 自动本地寻址与自动压缩（SVG 自动转 PNG）
- GitHub / VitePress 风格告示块 (> [!NOTE/TIP/WARNING/CAUTION/IMPORTANT])
- GFM 表格、代码高亮暗黑容器、引用块、列表及标题精美排版
"""
import os
import re
import html
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

import markdown_it
from markdown_it import MarkdownIt

from scanner import CURRENT_DIR, BLOG_ROOT, PUBLIC_IMAGES_DIR
from formula_renderer import render_latex_to_png
from mermaid_renderer import render_mermaid_to_png
from wechat_api import WeChatClient

def find_local_image_path(src: str, md_file_path: Optional[str] = None) -> Optional[Path]:
    """
    智能解析 Markdown 中的图片路径：
    1. /images/... -> source/blog-web/public/images/...
    2. /me/blog/images/... -> source/blog-web/public/images/...
    3. 相对文章所在目录的相对路径
    """
    clean_src = src.strip()
    if clean_src.startswith("http://") or clean_src.startswith("https://"):
        return None  # 外部网络图片

    # 处理站内绝对路径 /me/blog/images/... 或 /images/...
    if clean_src.startswith("/me/blog/images/"):
        rel_sub = clean_src[len("/me/blog/images/"):]
        p = PUBLIC_IMAGES_DIR / rel_sub
        if p.is_file():
            return p
    elif clean_src.startswith("/images/"):
        rel_sub = clean_src[len("/images/"):]
        p = PUBLIC_IMAGES_DIR / rel_sub
        if p.is_file():
            return p
    elif clean_src.startswith("/"):
        p = BLOG_ROOT / "source" / "blog-web" / "public" / clean_src.lstrip("/")
        if p.is_file():
            return p

    # 处理相对路径（相对于 Markdown 文件）
    if md_file_path:
        md_dir = Path(md_file_path).parent
        rel_p = (md_dir / clean_src).resolve()
        if rel_p.is_file():
            return rel_p

    return None

def extract_first_image(markdown_body: str, md_file_path: Optional[str] = None) -> Optional[Path]:
    """
    提取 Markdown 文章中出现的首张图片本地路径（用于微信封面图）
    """
    img_pattern = re.compile(r'!\[.*?\]\((.*?)\)')
    for match in img_pattern.finditer(markdown_body):
        src = match.group(1).split()[0].strip().strip('"').strip("'")
        local_path = find_local_image_path(src, md_file_path)
        if local_path and local_path.is_file():
            return local_path
    return None

def preprocess_cjk_bold(text: str) -> str:
    """
    解决 CommonMark 中 CJK 汉字与中英文标点紧邻时加粗定界符 ** 无法正确闭合的问题
    例如：**“死记硬背的偏科生”**
    """
    def bold_replace(match):
        inner = match.group(1).strip()
        if not inner:
            return match.group(0)
        return f"<strong>{inner}</strong>"

    # 匹配不含换行和多余星号的加粗块
    return re.sub(r'(?<!\*)\*\*((?:\*(?!\*)|[^\*\r\n])+?)\*\*(?!\*)', bold_replace, text)

def preprocess_alert_blocks(markdown_text: str) -> str:
    """
    将 GitHub / VitePress 告示块 (> [!NOTE/TIP/WARNING/CAUTION/IMPORTANT]) 转换为特殊标记
    """
    lines = markdown_text.splitlines()
    new_lines = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # 匹配告示块起始: > [!NOTE] 或 > [!TIP] 等
        match = re.match(r"^>\s*\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*$", line, re.IGNORECASE)
        if match:
            alert_type = match.group(1).upper()
            alert_lines = []
            i += 1
            while i < len(lines) and (lines[i].startswith(">") or lines[i].strip() == ""):
                content_line = re.sub(r"^>\s?", "", lines[i])
                alert_lines.append(content_line)
                i += 1
            alert_content = "\n".join(alert_lines).strip()
            # 替换为自定义 HTML 占位
            new_lines.append(f"<!--WECHAT_ALERT_{alert_type}-->\n{alert_content}\n<!--/WECHAT_ALERT-->")
            continue
        new_lines.append(line)
        i += 1

    return "\n".join(new_lines)

def apply_inline_styles(html_content: str) -> str:
    """
    微信不支持外部 CSS 及 <style> 标签，将所有核心排版标签注入优雅的内联 CSS 样式
    设计语言：现代极客、字距通透、色彩克制、专业排版
    """
    # H1
    h1_style = (
        'font-size: 21px; font-weight: 800; color: #0f172a; '
        'border-bottom: 2px solid #07C160; padding-bottom: 8px; '
        'margin: 28px 0 16px; line-height: 1.45; letter-spacing: -0.01em;'
    )
    html_content = re.sub(r'<h1(?:\s+[^>]*)?>(.*?)</h1>', f'<h1 style="{h1_style}">\\1</h1>', html_content, flags=re.DOTALL)

    # H2
    h2_style = (
        'font-size: 18px; font-weight: 700; color: #0f172a; '
        'border-left: 4px solid #07C160; padding-left: 10px; '
        'margin: 24px 0 12px; line-height: 1.4;'
    )
    html_content = re.sub(r'<h2(?:\s+[^>]*)?>(.*?)</h2>', f'<h2 style="{h2_style}">\\1</h2>', html_content, flags=re.DOTALL)

    # H3
    h3_style = (
        'font-size: 16px; font-weight: 700; color: #1e293b; '
        'margin: 20px 0 10px; line-height: 1.4;'
    )
    html_content = re.sub(r'<h3(?:\s+[^>]*)?>(.*?)</h3>', f'<h3 style="{h3_style}">\\1</h3>', html_content, flags=re.DOTALL)

    # Paragraphs (仅对不带 style 的 p 添加)
    p_style = (
        'font-size: 15px; color: #24292f; line-height: 1.8; '
        'margin: 14px 0; letter-spacing: 0.02em; word-break: break-word;'
    )
    html_content = re.sub(r'<p>(.*?)</p>', f'<p style="{p_style}">\\1</p>', html_content, flags=re.DOTALL)

    # Bold
    html_content = re.sub(r'<strong>(.*?)</strong>', r'<strong style="font-weight: 700; color: #0f172a;">\1</strong>', html_content)
    html_content = re.sub(r'<b>(.*?)</b>', r'<b style="font-weight: 700; color: #0f172a;">\1</b>', html_content)

    # Inline Code
    code_style = (
        'background-color: #f6f8fa; color: #cf222e; padding: 2px 6px; '
        'border-radius: 4px; font-size: 13px; font-family: Consolas, Monaco, monospace; '
        'border: 1px solid #eaeef2;'
    )
    html_content = re.sub(r'<code>([^<]+)</code>', f'<code style="{code_style}">\\1</code>', html_content)

    # Pre / Code blocks
    pre_style = (
        'background: #1e1e1e; color: #d4d4d4; padding: 14px 16px; '
        'border-radius: 8px; font-size: 13px; font-family: Consolas, Monaco, monospace; '
        'line-height: 1.6; overflow-x: auto; margin: 16px 0; border: 1px solid #333;'
    )
    html_content = re.sub(r'<pre(?:\s+[^>]*)?>\s*<code(?:\s+[^>]*)?>(.*?)</code>\s*</pre>',
                          f'<pre style="{pre_style}"><code>\\1</code></pre>', html_content, flags=re.DOTALL)

    # Blockquotes
    bq_style = (
        'margin: 14px 0; padding: 10px 16px; background: #f8fafc; '
        'border-left: 4px solid #cbd5e1; color: #475569; font-size: 14px; '
        'line-height: 1.75; font-style: normal;'
    )
    html_content = re.sub(r'<blockquote>(.*?)</blockquote>', f'<blockquote style="{bq_style}">\\1</blockquote>', html_content, flags=re.DOTALL)

    # Tables
    table_style = 'border-collapse: collapse; width: 100%; margin: 18px 0; font-size: 14px; color: #24292f; border: 1px solid #d0d7de;'
    th_style = 'background-color: #f6f8fa; font-weight: 700; padding: 8px 12px; border: 1px solid #d0d7de; text-align: left;'
    td_style = 'padding: 8px 12px; border: 1px solid #d0d7de; line-height: 1.6;'

    html_content = re.sub(r'<table>', f'<table style="{table_style}">', html_content)
    html_content = re.sub(r'<th>', f'<th style="{th_style}">', html_content)
    html_content = re.sub(r'<td>', f'<td style="{td_style}">', html_content)

    # Lists
    ul_style = 'margin: 12px 0; padding-left: 24px; font-size: 15px; line-height: 1.8; color: #24292f;'
    ol_style = 'margin: 12px 0; padding-left: 24px; font-size: 15px; line-height: 1.8; color: #24292f;'
    li_style = 'margin: 4px 0;'

    html_content = re.sub(r'<ul>', f'<ul style="{ul_style}">', html_content)
    html_content = re.sub(r'<ol>', f'<ol style="{ol_style}">', html_content)
    html_content = re.sub(r'<li>', f'<li style="{li_style}">', html_content)

    # HR
    hr_style = 'border: none; border-top: 1px dashed #d0d7de; margin: 24px 0;'
    html_content = re.sub(r'<hr\s*/?>', f'<hr style="{hr_style}" />', html_content)

    return html_content

def format_alert_box(alert_type: str, inner_markdown: str, md_renderer: MarkdownIt) -> str:
    """渲染微信样式的警示与提示块"""
    alert_configs = {
        "NOTE": ("#f0f7ff", "#0969da", "📝 注意 (Note)"),
        "TIP": ("#f6fbf7", "#1a7f37", "💡 提示 (Tip)"),
        "WARNING": ("#fffbeb", "#d97706", "⚠️ 警告 (Warning)"),
        "CAUTION": ("#fff5f5", "#cf222e", "🚨 谨慎 (Caution)"),
        "IMPORTANT": ("#fbf7fe", "#8250df", "📌 重点 (Important)"),
    }
    bg_color, border_color, title_text = alert_configs.get(
        alert_type, ("#f8fafc", "#64748b", "ℹ️ 提示")
    )

    rendered_inner = md_renderer.render(inner_markdown)
    # 去除首尾外层多余的 <p> 标签边距
    rendered_inner = re.sub(r'<p style="[^"]*">(.*?)</p>', r'<div style="margin: 4px 0;">\1</div>', rendered_inner)
    rendered_inner = re.sub(r'<p>(.*?)</p>', r'<div style="margin: 4px 0;">\1</div>', rendered_inner)

    return (
        f'<section style="margin: 16px 0; padding: 12px 16px; background-color: {bg_color}; '
        f'border-left: 4px solid {border_color}; border-radius: 0 6px 6px 0; color: #1f2328; '
        f'font-size: 14px; line-height: 1.7;">'
        f'<div style="font-weight: 700; color: {border_color}; margin-bottom: 6px;">{title_text}</div>'
        f'<div>{rendered_inner}</div>'
        f'</section>'
    )

class WeChatArticleConverter:
    def __init__(self, client: Optional[WeChatClient] = None, is_preview: bool = False):
        self.client = client
        self.is_preview = is_preview
        self.uploaded_images_cache: Dict[str, str] = {}
        self.md_parser = (
            MarkdownIt("default", {"html": True, "breaks": False, "linkify": False})
            .enable("table")
            .enable("strikethrough")
        )

    def _resolve_image_url(self, local_path: Path) -> str:
        """根据本地图片路径获取上传后的微信 URL 或预览路径"""
        path_str = str(local_path.resolve())
        if path_str in self.uploaded_images_cache:
            return self.uploaded_images_cache[path_str]

        if self.is_preview:
            # 预览模式：使用绝对路径文件 URL，本地浏览器可直接渲染
            file_url = local_path.resolve().as_uri()
            self.uploaded_images_cache[path_str] = file_url
            return file_url

        if not self.client:
            raise RuntimeError("发布模式下必须提供有效的 WeChatClient！")

        print(f"  [上传微信] 正在上传图片: {local_path.name} ...")
        wechat_url = self.client.upload_article_image(local_path)
        self.uploaded_images_cache[path_str] = wechat_url
        return wechat_url

    def convert_markdown(self, post_item: Dict[str, Any]) -> str:
        """
        完整文章转换管线：
        1. 保护与提取 Mermaid 图表
        2. 保护与提取 LaTeX 公式（行内 & 块级）
        3. 转换 GitHub Alert 块
        4. MarkdownIt 生成 HTML
        5. 替换普通图片（上传并转为微信 CDN URL）
        6. 渲染并替换 Mermaid 图表
        7. 渲染并替换 LaTeX 公式
        8. 注入微信全内联排版样式
        9. 注入顶部专属元信息卡片与文末签名
        """
        raw_body = post_item["body"]
        md_file_path = post_item.get("file_path")

        # 1. 保护与提取 Mermaid 图表
        mermaid_placeholders: List[Tuple[str, str]] = []
        def mermaid_sub(match):
            placeholder = f"<!--WECHAT_MERMAID_PLACEHOLDER_{len(mermaid_placeholders)}-->"
            mermaid_code = match.group(1).strip()
            mermaid_placeholders.append((placeholder, mermaid_code))
            return placeholder

        content = re.sub(r'```mermaid\s*\n([\s\S]*?)```', mermaid_sub, raw_body)

        # 2. 保护与提取 LaTeX 数学公式
        # 2.1 块级公式 $$...$$
        block_math_placeholders: List[Tuple[str, str]] = []
        def block_math_sub(match):
            placeholder = f"<!--WECHAT_BLOCK_MATH_PLACEHOLDER_{len(block_math_placeholders)}-->"
            formula = match.group(1).strip()
            block_math_placeholders.append((placeholder, formula))
            return placeholder

        content = re.sub(r'\$\$([\s\S]+?)\$\$', block_math_sub, content)

        # 2.2 行内公式 $...$（排除连续两个$$，允许转义 \$）
        inline_math_placeholders: List[Tuple[str, str]] = []
        def inline_math_sub(match):
            placeholder = f"<!--WECHAT_INLINE_MATH_PLACEHOLDER_{len(inline_math_placeholders)}-->"
            formula = match.group(1).strip()
            inline_math_placeholders.append((placeholder, formula))
            return placeholder

        content = re.sub(r'(?<!\\)\$(?!\$)((?:\\.|[^$\\\n])+?)\$', inline_math_sub, content)

        # 3. 预处理 Alert 提示块
        content = preprocess_alert_blocks(content)

        # 3.1 修复 CJK 标点相邻加粗
        content = preprocess_cjk_bold(content)

        # 4. 标准 Markdown 解析为 HTML
        html_out = self.md_parser.render(content)

        # 5. 处理并替换普通 <img> 标签中的图片路径
        def img_sub(match):
            full_tag = match.group(0)
            src_match = re.search(r'src=["\'](.*?)["\']', full_tag)
            alt_match = re.search(r'alt=["\'](.*?)["\']', full_tag)
            if not src_match:
                return full_tag

            raw_src = src_match.group(1)
            alt_text = alt_match.group(1) if alt_match else ""

            local_path = find_local_image_path(raw_src, md_file_path)
            if local_path and local_path.is_file():
                final_url = self._resolve_image_url(local_path)
                alt_caption = f'<span style="display:block; font-size:12px; color:#8c8c8c; margin-top:6px; text-align:center;">{html.escape(alt_text)}</span>' if alt_text else ''
                return (
                    f'<section style="text-align: center; margin: 18px 0;">'
                    f'<img src="{final_url}" alt="{html.escape(alt_text)}" style="display: block; max-width: 100%; margin: 0 auto; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);" />'
                    f'{alt_caption}'
                    f'</section>'
                )
            return full_tag

        html_out = re.sub(r'<img[^>]+>', img_sub, html_out)

        # 6. 替换并渲染 Mermaid 图表
        for placeholder, mmd_code in mermaid_placeholders:
            png_path = render_mermaid_to_png(mmd_code)
            if png_path and png_path.is_file():
                img_url = self._resolve_image_url(png_path)
                replacement = (
                    f'<section style="text-align: center; margin: 18px 0; overflow-x: auto;">'
                    f'<img src="{img_url}" alt="Mermaid 图表" style="display: block; max-width: 100%; margin: 0 auto; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);" />'
                    f'</section>'
                )
            else:
                # 优雅降级为代码块
                replacement = (
                    f'<pre style="background: #f6f8fa; padding: 12px 16px; border-radius: 6px; font-size: 12px; color: #24292f; border: 1px solid #d0d7de; overflow-x: auto;">'
                    f'<code>{html.escape(mmd_code)}</code></pre>'
                )
            html_out = html_out.replace(placeholder, replacement)

        # 7. 替换并渲染 LaTeX 公式
        # 7.1 块级公式
        for placeholder, formula in block_math_placeholders:
            math_png = render_latex_to_png(formula, is_display=True)
            if math_png and math_png.is_file():
                img_url = self._resolve_image_url(math_png)
                replacement = (
                    f'<section style="text-align: center; margin: 16px 0; overflow-x: auto;">'
                    f'<img src="{img_url}" alt="公式" style="display: inline-block; max-width: 92%; margin: 0 auto; border: none;" />'
                    f'</section>'
                )
            else:
                replacement = f'<section style="text-align: center; margin: 12px 0; font-family: monospace;">$${html.escape(formula)}$$</section>'
            html_out = html_out.replace(placeholder, replacement)

        # 7.2 行内公式
        for placeholder, formula in inline_math_placeholders:
            math_png = render_latex_to_png(formula, is_display=False)
            if math_png and math_png.is_file():
                img_url = self._resolve_image_url(math_png)
                replacement = f'<img src="{img_url}" alt="公式" style="display: inline-block; vertical-align: middle; height: 1.35em; max-height: 28px; margin: 0 2px; border: none;" />'
            else:
                replacement = f'<code style="background:#f6f8fa; padding:2px 4px;">${html.escape(formula)}$</code>'
            html_out = html_out.replace(placeholder, replacement)

        # 8. 替换 Alert 提示块
        alert_pattern = re.compile(r'<!--WECHAT_ALERT_([A-Z]+)-->([\s\S]*?)<!--/WECHAT_ALERT-->')
        def alert_replace(match):
            a_type = match.group(1)
            a_content = match.group(2).strip()
            return format_alert_box(a_type, a_content, self.md_parser)

        html_out = alert_pattern.sub(alert_replace, html_out)

        # 9. 注入微信全内联排版样式
        styled_body = apply_inline_styles(html_out)

        # 10. 拼接精美的文首卡片与文末签名
        final_html = self._assemble_full_article(post_item, styled_body)
        return final_html

    def _assemble_full_article(self, post: Dict[str, Any], body_html: str) -> str:
        """拼接文章顶部元信息导读卡片与文章尾部引导"""
        title = post.get("title", "")
        date_str = post.get("date", "")
        series_name = post.get("series_name")
        summary = post.get("summary", "")
        tags = post.get("tags", [])

        # 专栏系列徽章
        series_badge = ""
        if series_name:
            series_badge = (
                f'<div style="display: inline-block; background-color: #07C160; color: #ffffff; '
                f'font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; margin-bottom: 8px;">'
                f'📚 专栏：{html.escape(series_name)}'
                f'</div>'
            )

        # 摘要导读卡片
        summary_card = ""
        if summary:
            summary_card = (
                f'<section style="margin: 16px 0 24px; padding: 14px 18px; background-color: #f8fafc; '
                f'border-radius: 8px; border-left: 4px solid #07C160; font-size: 14px; color: #475569; line-height: 1.7;">'
                f'<span style="font-weight: 700; color: #0f172a;">导读：</span>{html.escape(summary)}'
                f'</section>'
            )

        # 标签列表
        tag_badges = "".join([
            f'<span style="display: inline-block; background: #f1f5f9; color: #475569; font-size: 11px; '
            f'padding: 2px 8px; border-radius: 4px; margin-right: 6px; margin-bottom: 4px;">#{html.escape(t)}</span>'
            for t in tags
        ])

        header_section = (
            f'<section style="margin-bottom: 20px;">'
            f'{series_badge}'
            f'<div style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">'
            f'<span>📅 发布时间：{date_str}</span>'
            f'</div>'
            f'<div style="margin-bottom: 14px;">{tag_badges}</div>'
            f'{summary_card}'
            f'</section>'
        )

        footer_section = (
            f'<section style="margin-top: 36px; padding-top: 20px; border-top: 1px dashed #cbd5e1; text-align: center;">'
            f'<div style="font-size: 14px; font-weight: 700; color: #1e293b; margin-bottom: 6px;">'
            f'感谢阅读 · BitVortex 个人技术博客'
            f'</div>'
            f'<div style="font-size: 12px; color: #64748b; line-height: 1.6;">'
            f'本文同步发表于个人博客，持续分享深度学习、架构设计与系统工程实践。'
            f'</div>'
            f'</section>'
        )

        return (
            f'<div style="max-width: 677px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, '
            f'\'Segoe UI\', Roboto, \'PingFang SC\', \'Hiragino Sans GB\', \'Microsoft YaHei\', sans-serif; '
            f'color: #24292f; background-color: #ffffff; padding: 12px 6px;">'
            f'{header_section}'
            f'{body_html}'
            f'{footer_section}'
            f'</div>'
        )

if __name__ == "__main__":
    from scanner import scan_all_posts
    posts = scan_all_posts()
    vae_part1 = next((p for p in posts if "vae-part-1" in p["slug"]), posts[0])
    
    converter = WeChatArticleConverter(is_preview=True)
    res_html = converter.convert_markdown(vae_part1)
    
    out_preview = CURRENT_DIR / "preview_test.html"
    out_preview.write_text(res_html, encoding="utf-8")
    print("成功转换测试文章:", vae_part1["title"])
    print("预览 HTML 文件保存在:", out_preview)
