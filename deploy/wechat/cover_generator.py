# -*- coding: utf-8 -*-
"""
cover_generator.py: 为微信草稿生成 2.35:1 居中标题封面图
"""
from __future__ import annotations

import platform
from pathlib import Path
from typing import List, Optional, Tuple

from PIL import Image, ImageDraw, ImageFont

# 微信头条封面常用比例 2.35:1；略高于 900×383 以便清晰上传后再压缩
COVER_WIDTH = 1200
COVER_HEIGHT = 510

# 中心安全区（次条/列表 1:1 裁切时仍可读）
SAFE_RATIO = 0.72
MAX_TITLE_FONT = 64
MIN_TITLE_FONT = 28
SUBTITLE_FONT = 26
LINE_SPACING = 1.25

_FONT_CANDIDATES_WIN = [
    r"C:\Windows\Fonts\msyhbd.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    r"C:\Windows\Fonts\simsun.ttc",
]
_FONT_CANDIDATES_MAC = [
    "/System/Library/Fonts/PingFang.ttc",
    "/Library/Fonts/Arial Unicode.ttf",
    "/System/Library/Fonts/STHeiti Medium.ttc",
]
_FONT_CANDIDATES_LINUX = [
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
]


def _font_candidates() -> List[str]:
    system = platform.system()
    if system == "Windows":
        return list(_FONT_CANDIDATES_WIN)
    if system == "Darwin":
        return list(_FONT_CANDIDATES_MAC)
    return list(_FONT_CANDIDATES_LINUX)


def resolve_chinese_font_path() -> Path:
    """解析可用的中文字体路径；找不到则抛错（不静默回退）。"""
    for path_str in _font_candidates():
        p = Path(path_str)
        if p.is_file():
            return p
    searched = ", ".join(_font_candidates())
    raise FileNotFoundError(
        "未找到可用的中文字体，无法生成封面标题图。"
        f" 已尝试: {searched}"
    )


def _load_font(size: int, font_path: Path) -> ImageFont.FreeTypeFont:
    # TTC 集合字体：index=0 通常可用
    try:
        return ImageFont.truetype(str(font_path), size=size, index=0)
    except OSError:
        return ImageFont.truetype(str(font_path), size=size)


def _text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont) -> float:
    bbox = draw.textbbox((0, 0), text, font=font)
    return float(bbox[2] - bbox[0])


def _wrap_line(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: float) -> List[str]:
    """按像素宽度折行；优先在空格/标点处断行，否则按字符断。"""
    text = text.strip()
    if not text:
        return []
    if _text_width(draw, text, font) <= max_width:
        return [text]

    break_chars = set(" ，、。；：！？,.!?;:/\u3000-—")
    lines: List[str] = []
    buf = ""
    for ch in text:
        trial = buf + ch
        if _text_width(draw, trial, font) <= max_width:
            buf = trial
            continue
        if not buf:
            lines.append(ch)
            buf = ""
            continue
        # 尽量在断点处切
        cut = len(buf)
        for i in range(len(buf) - 1, -1, -1):
            if buf[i] in break_chars:
                cut = i + 1
                break
        if cut < len(buf) and cut > 0:
            lines.append(buf[:cut].rstrip())
            buf = buf[cut:].lstrip() + ch
        else:
            lines.append(buf)
            buf = ch
    if buf:
        lines.append(buf)
    return lines


def _wrap_title(
    draw: ImageDraw.ImageDraw,
    title: str,
    font: ImageFont.ImageFont,
    max_width: float,
    max_lines: int = 4,
) -> List[str]:
    raw_lines = _wrap_line(draw, title, font, max_width)
    if len(raw_lines) <= max_lines:
        return raw_lines
    # 超出行数时合并末尾并加省略号
    kept = raw_lines[: max_lines - 1]
    rest = "".join(raw_lines[max_lines - 1 :])
    ellipsis = "…"
    while rest and _text_width(draw, rest + ellipsis, font) > max_width:
        rest = rest[:-1]
    kept.append((rest + ellipsis) if rest else ellipsis)
    return kept


def _fit_title_font(
    draw: ImageDraw.ImageDraw,
    title: str,
    font_path: Path,
    max_width: float,
    max_height: float,
) -> Tuple[ImageFont.FreeTypeFont, List[str], int]:
    """二分字号，使标题折行后落入安全区。"""
    lo, hi = MIN_TITLE_FONT, MAX_TITLE_FONT
    best_font = _load_font(MIN_TITLE_FONT, font_path)
    best_lines = _wrap_title(draw, title, best_font, max_width)
    best_size = MIN_TITLE_FONT

    while lo <= hi:
        mid = (lo + hi) // 2
        font = _load_font(mid, font_path)
        lines = _wrap_title(draw, title, font, max_width)
        line_h = mid * LINE_SPACING
        total_h = line_h * len(lines)
        if total_h <= max_height and all(_text_width(draw, ln, font) <= max_width for ln in lines):
            best_font, best_lines, best_size = font, lines, mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best_font, best_lines, best_size


def _draw_background(img: Image.Image) -> None:
    """深色渐变 + 轻微对角几何纹理。"""
    w, h = img.size
    base = Image.new("RGB", (w, h))
    pixels = base.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        r = int(15 + (28 - 15) * t)
        g = int(23 + (41 - 23) * t)
        b = int(42 + (58 - 42) * t)
        for x in range(w):
            sx = x / max(w - 1, 1)
            pixels[x, y] = (
                min(255, r + int(8 * sx)),
                min(255, g + int(6 * (1 - sx))),
                min(255, b + int(10 * sx)),
            )

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    accent = (94, 234, 212, 28)
    for i in range(-h, w, 48):
        od.line([(i, 0), (i + h, h)], fill=accent, width=1)
    od.ellipse([-120, -80, 420, 280], fill=(56, 189, 248, 36))
    od.ellipse([w - 380, h - 220, w + 80, h + 80], fill=(45, 212, 191, 28))

    composed = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
    img.paste(composed)


def generate_cover_image(
    *,
    title: str,
    slug: str,
    series_name: Optional[str] = None,
    out_dir: Optional[Path] = None,
) -> Path:
    """
    生成居中标题封面 JPG，写入 out_dir/{slug}.jpg 并返回路径。
    """
    title = (title or "").strip() or "未命名文章"
    slug = (slug or "untitled").strip() or "untitled"
    # 文件名安全
    safe_slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in slug).strip("-") or "untitled"

    if out_dir is None:
        out_dir = Path(__file__).resolve().parent / ".cache" / "covers"
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{safe_slug}.jpg"

    font_path = resolve_chinese_font_path()
    img = Image.new("RGB", (COVER_WIDTH, COVER_HEIGHT), (15, 23, 42))
    _draw_background(img)
    draw = ImageDraw.Draw(img)

    safe_w = COVER_WIDTH * SAFE_RATIO
    max_text_width = safe_w * 0.92
    subtitle = (series_name or "").strip()
    subtitle_reserve = (SUBTITLE_FONT * 1.6 + 24) if subtitle else 0
    max_title_height = COVER_HEIGHT * 0.55 - subtitle_reserve

    title_font, lines, title_size = _fit_title_font(
        draw, title, font_path, max_text_width, max_title_height
    )

    line_height = title_size * LINE_SPACING
    block_h = line_height * len(lines) + subtitle_reserve
    cx = COVER_WIDTH / 2
    cy = COVER_HEIGHT / 2
    start_y = cy - block_h / 2 + line_height / 2

    stroke_fill = (15, 23, 42)
    text_fill = (248, 250, 252)

    for i, line in enumerate(lines):
        y = start_y + i * line_height
        draw.text(
            (cx, y),
            line,
            font=title_font,
            fill=text_fill,
            anchor="mm",
            stroke_width=3,
            stroke_fill=stroke_fill,
        )

    if subtitle:
        sub_font = _load_font(SUBTITLE_FONT, font_path)
        sub_y = start_y + len(lines) * line_height + 8
        # 副标题也限制在安全宽度内
        sub_lines = _wrap_title(draw, subtitle, sub_font, max_text_width, max_lines=2)
        for j, sl in enumerate(sub_lines):
            draw.text(
                (cx, sub_y + j * SUBTITLE_FONT * 1.3),
                sl,
                font=sub_font,
                fill=(148, 163, 184),
                anchor="mm",
                stroke_width=2,
                stroke_fill=stroke_fill,
            )

    # 底部品牌细标
    brand_font = _load_font(18, font_path)
    draw.text(
        (cx, COVER_HEIGHT - 28),
        "BitVortex",
        font=brand_font,
        fill=(100, 116, 139),
        anchor="mm",
    )

    img.save(out_path, format="JPEG", quality=90, optimize=True)
    return out_path


if __name__ == "__main__":
    # 快速自检
    p = generate_cover_image(
        title="企业级 AI-OCR #1：架构选型与 Java 21 落地实践指南",
        slug="enterprise-ai-ocr-part-1-architecture-java21",
        series_name="企业级 AI-OCR",
    )
    print(p)
