# -*- coding: utf-8 -*-
"""
comparator.py: 发布选择器文章排序比较器

对偶于博客前端 source/blog-web/src/utils/comparator.ts（Feed 降序），
本模块面向 CLI 编号选择做升序编排，并保证同系列连续。

职责边界：只做比较与排序，不扫描文件系统、不解析 Markdown。
"""
from functools import cmp_to_key
from typing import Any, Dict, List, Optional

from fields import date_key, part_key


def compare_optional_asc(a: Optional[float], b: Optional[float]) -> int:
    """数值升序；有值优先于无值（对偶于博客 compareOptionalDesc）。"""
    has_a = a is not None
    has_b = b is not None
    if has_a and has_b:
        return (a > b) - (a < b)
    if has_a:
        return -1
    if has_b:
        return 1
    return 0


def compare_same_series_part_asc(a: Dict[str, Any], b: Dict[str, Any]) -> int:
    """同一合集内按章节 part 升序（与 sort_series_chapters 规则一致）。"""
    slug_a = a.get("series_slug")
    slug_b = b.get("series_slug")
    if slug_a and slug_b and slug_a == slug_b:
        part_a = part_key(a.get("part"))
        part_b = part_key(b.get("part"))
        return (part_a > part_b) - (part_a < part_b)
    return 0


def compare_category(a: Dict[str, Any], b: Dict[str, Any]) -> int:
    """跨类别：独立文章排在合集之前（对齐博客 compareCategory）。"""
    is_series_a = bool(a.get("series_slug"))
    is_series_b = bool(b.get("series_slug"))
    if is_series_a != is_series_b:
        return 1 if is_series_a else -1
    return 0


def compare_posts_asc(a: Dict[str, Any], b: Dict[str, Any]) -> int:
    """
    发布选择器升序比较器 —— 对偶于博客前端 comparePosts（降序 Feed）。

    短路链：
    1. 发布时间 date 升序
    2. 文章级权重 order 升序
    3. 同一合集内按章节 part 升序
    4. 不同合集间按合集 series_order 升序
    5. 跨类别同日：独立文章排在合集之前
    6. 确定性兜底：slug 字母升序
    """
    date_cmp = (date_key(a.get("date")) > date_key(b.get("date"))) - (
        date_key(a.get("date")) < date_key(b.get("date"))
    )
    if date_cmp:
        return date_cmp

    order_cmp = compare_optional_asc(a.get("order"), b.get("order"))
    if order_cmp:
        return order_cmp

    part_cmp = compare_same_series_part_asc(a, b)
    if part_cmp:
        return part_cmp

    series_order_cmp = compare_optional_asc(a.get("series_order"), b.get("series_order"))
    if series_order_cmp:
        return series_order_cmp

    category_cmp = compare_category(a, b)
    if category_cmp:
        return category_cmp

    slug_a = a.get("slug") or ""
    slug_b = b.get("slug") or ""
    return (slug_a > slug_b) - (slug_a < slug_b)


def sort_series_chapters(chapters: List[Dict[str, Any]]) -> None:
    """专栏内按 part 升序，再按日期升序（对齐博客 loader 章节 TOC）。"""
    chapters.sort(
        key=lambda p: (part_key(p.get("part")), date_key(p.get("date")), p.get("slug") or "")
    )


def sort_posts_for_picker(posts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    CLI 发布选择器排序：
    - 同系列聚合为连续块，块内 part 升序，避免连载章节被打散
    - 系列块锚点取最新章节日期，近期连载靠近列表尾部
    - 独立文章与系列块再按 compare_posts_asc 的时间升序规则交织
    """
    series_groups: Dict[str, List[Dict[str, Any]]] = {}
    standalones: List[Dict[str, Any]] = []

    for post in posts:
        series_slug = post.get("series_slug")
        if series_slug:
            series_groups.setdefault(series_slug, []).append(post)
        else:
            standalones.append(post)

    blocks: List[Dict[str, Any]] = []

    for chapters in series_groups.values():
        sort_series_chapters(chapters)
        anchor = max((date_key(p.get("date")) for p in chapters), default="1970-01-01")
        representative = {
            "date": anchor,
            "order": None,
            "part": None,
            "series_slug": chapters[0].get("series_slug"),
            "series_order": chapters[0].get("series_order"),
            "slug": chapters[0].get("series_slug") or chapters[0].get("slug") or "",
        }
        blocks.append({"kind": "series", "rep": representative, "posts": chapters})

    for post in standalones:
        blocks.append({"kind": "single", "rep": post, "posts": [post]})

    blocks.sort(key=cmp_to_key(lambda x, y: compare_posts_asc(x["rep"], y["rep"])))

    ordered: List[Dict[str, Any]] = []
    for block in blocks:
        ordered.extend(block["posts"])
    return ordered
