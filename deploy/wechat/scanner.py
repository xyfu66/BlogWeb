# -*- coding: utf-8 -*-
"""
scanner.py: 扫描并解析 BlogWeb 博客文章（包括普通文章与专栏系列文章）
"""
import os
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
import yaml

# 项目根目录与博客文章根目录定位
CURRENT_DIR = Path(__file__).resolve().parent
BLOG_ROOT = CURRENT_DIR.parent.parent
POSTS_DIR = BLOG_ROOT / "source" / "blog-web" / "src" / "posts"
PUBLIC_IMAGES_DIR = BLOG_ROOT / "source" / "blog-web" / "public" / "images"

def parse_markdown_file(file_path: Path) -> Optional[Dict[str, Any]]:
    """
    解析单个 Markdown 文件的 YAML frontmatter 及正文内容
    """
    try:
        content = file_path.read_text(encoding="utf-8")
    except Exception as e:
        print(f"[警告] 无法读取文件 {file_path}: {e}")
        return None

    # 匹配顶部 YAML Frontmatter: ---\n...\n---
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
    date = str(frontmatter.get("date") or "")
    tags = frontmatter.get("tags") or []
    slug = str(frontmatter.get("slug") or file_path.stem)
    summary = str(frontmatter.get("summary") or "")
    part = frontmatter.get("part")

    return {
        "file_path": str(file_path),
        "file_name": file_path.name,
        "title": title,
        "date": date,
        "tags": tags if isinstance(tags, list) else [str(tags)],
        "slug": slug,
        "summary": summary,
        "part": part,
        "body": body,
    }

def scan_all_posts() -> List[Dict[str, Any]]:
    """
    递归扫描所有文章，返回排序后的文章列表
    """
    posts: List[Dict[str, Any]] = []

    # 1. 扫描单篇常规文章: src/posts/articles/*.md
    articles_dir = POSTS_DIR / "articles"
    if articles_dir.is_dir():
        for f in articles_dir.glob("*.md"):
            item = parse_markdown_file(f)
            if item:
                item["category"] = "单篇精选"
                item["series_name"] = None
                posts.append(item)

    # 2. 扫描专栏系列文章: src/posts/series/<series-slug>/*.md
    series_dir = POSTS_DIR / "series"
    if series_dir.is_dir():
        for s_folder in series_dir.iterdir():
            if not s_folder.is_dir():
                continue
            
            # 读取 series.json 获取系列名称
            series_name = s_folder.name
            series_json = s_folder / "series.json"
            if series_json.is_file():
                try:
                    s_data = json.loads(series_json.read_text(encoding="utf-8"))
                    series_name = s_data.get("name") or series_name
                except Exception as e:
                    print(f"[警告] series.json 解析失败 {series_json}: {e}")

            for f in s_folder.glob("*.md"):
                item = parse_markdown_file(f)
                if item:
                    item["category"] = "专栏系列"
                    item["series_name"] = series_name
                    posts.append(item)

    # 排序：优先按发布日期 date 倒序（最新在前），日期相同按 part 正序
    def sort_key(p: Dict[str, Any]):
        d = p.get("date") or "1970-01-01"
        pt = p.get("part") if isinstance(p.get("part"), (int, float)) else 999
        return (d, -pt)

    posts.sort(key=sort_key, reverse=True)
    return posts

if __name__ == "__main__":
    items = scan_all_posts()
    print(f"共发现 {len(items)} 篇文章：")
    for i, p in enumerate(items, 1):
        series_tag = f" [{p['series_name']}]" if p['series_name'] else ""
        print(f"  {i:2d}. [{p['date']}] {p['title']}{series_tag}")
