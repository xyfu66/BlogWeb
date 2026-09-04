# -*- coding: utf-8 -*-
"""
scanner.py: 扫描并解析 BlogWeb 博客文章（普通文章与专栏系列）

职责边界：文件系统发现、Frontmatter 解析、元数据装配。
排序策略委托 comparator；字段规范化委托 fields。
"""
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import yaml

from comparator import sort_posts_for_picker
from fields import coerce_optional_number, normalize_date

# 项目根目录与博客文章根目录定位
CURRENT_DIR = Path(__file__).resolve().parent
BLOG_ROOT = CURRENT_DIR.parent.parent
POSTS_DIR = BLOG_ROOT / "source" / "blog-web" / "src" / "posts"
PUBLIC_IMAGES_DIR = BLOG_ROOT / "source" / "blog-web" / "public" / "images"


def parse_markdown_file(file_path: Path) -> Optional[Dict[str, Any]]:
    """解析单个 Markdown 文件的 YAML frontmatter 及正文内容。"""
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"[警告] 无法读取文件 {file_path}: {e}")
        return None

    pattern = re.compile(r"^---\s*\n(.*?)\n---\s*\n(.*)$", re.DOTALL)
    match = pattern.match(content)

    frontmatter: Dict[str, Any] = {}
    body = content
    if match:
        yaml_text = match.group(1)
        body = match.group(2)
        try:
            parsed = yaml.safe_load(yaml_text)
            if isinstance(parsed, dict):
                frontmatter = parsed
        except Exception as e:
            print(f"[警告] YAML 解析错误 {file_path}: {e}")

    title = frontmatter.get("title") or file_path.stem
    date = normalize_date(frontmatter.get("date"))
    tags = frontmatter.get("tags") or []
    slug = str(frontmatter.get("slug") or file_path.stem)
    summary = str(frontmatter.get("summary") or "")
    part = coerce_optional_number(frontmatter.get("part"))
    order = coerce_optional_number(
        frontmatter.get("order", frontmatter.get("priority"))
    )

    return {
        "file_path": str(file_path),
        "file_name": file_path.name,
        "title": title,
        "date": date,
        "tags": tags if isinstance(tags, list) else [str(tags)],
        "slug": slug,
        "summary": summary,
        "part": part,
        "order": order,
        "body": body,
    }


def scan_all_posts() -> List[Dict[str, Any]]:
    """
    递归扫描所有文章，并按发布选择器规则排序后返回。
    """
    posts: List[Dict[str, Any]] = []

    # 1. 单篇常规文章: src/posts/articles/*.md
    articles_dir = POSTS_DIR / "articles"
    if articles_dir.is_dir():
        for f in articles_dir.glob("*.md"):
            item = parse_markdown_file(f)
            if item:
                item["category"] = "单篇精选"
                item["series_name"] = None
                item["series_slug"] = None
                item["series_order"] = None
                posts.append(item)

    # 2. 专栏系列: src/posts/series/<series-slug>/*.md
    series_dir = POSTS_DIR / "series"
    if series_dir.is_dir():
        for s_folder in series_dir.iterdir():
            if not s_folder.is_dir():
                continue

            series_slug = s_folder.name
            series_name = s_folder.name
            series_order = None
            series_json = s_folder / "series.json"
            meta_json = s_folder / "meta.json"
            config_path = series_json if series_json.is_file() else (
                meta_json if meta_json.is_file() else None
            )
            if config_path is not None:
                try:
                    s_data = json.loads(config_path.read_text(encoding="utf-8"))
                    series_name = s_data.get("name") or series_name
                    series_slug = s_data.get("slug") or series_slug
                    series_order = coerce_optional_number(s_data.get("order"))
                except Exception as e:
                    print(f"[警告] 系列元数据解析失败 {config_path}: {e}")

            for f in s_folder.glob("*.md"):
                item = parse_markdown_file(f)
                if item:
                    item["category"] = "专栏系列"
                    item["series_name"] = series_name
                    item["series_slug"] = series_slug
                    item["series_order"] = series_order
                    posts.append(item)

    return sort_posts_for_picker(posts)


if __name__ == "__main__":
    items = scan_all_posts()
    print(f"共发现 {len(items)} 篇文章：")
    for i, p in enumerate(items, 1):
        series_tag = f" [{p['series_name']}]" if p.get("series_name") else ""
        print(f"  {i:2d}. [{p['date']}] {p['title']}{series_tag}")
