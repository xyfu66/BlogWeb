# -*- coding: utf-8 -*-
"""
fields.py: 文章元数据字段规范化工具

职责边界：纯函数、无 I/O、不依赖业务编排。
供 scanner（解析入库）与 comparator（排序裁决）共用。
"""
from typing import Any, Optional


def normalize_date(value: Any) -> str:
    """统一为 YYYY-MM-DD；兼容 YAML 将 date 解析为 date/datetime 的情况。"""
    if value is None or value == "":
        return ""
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            pass
    text = str(value).strip()
    # 截取前 10 位以兼容 "2026-08-30 00:00:00" / ISO 时间戳
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return text


def coerce_optional_number(value: Any) -> Optional[float]:
    """将 part/order 规范为数值；无法解析则视为未设置。"""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            if text.isdigit() or (text[0] == "-" and text[1:].isdigit()):
                return int(text)
            return float(text)
        except ValueError:
            return None
    return None


def date_key(value: Optional[str]) -> str:
    """排序用日期键；缺失时落到纪元，保证可比较。"""
    return value or "1970-01-01"


def part_key(value: Any) -> float:
    """章节序号键：有值用原值，缺失置于末尾（对齐博客 loader 的 part ?? 999）。"""
    num = coerce_optional_number(value)
    return num if num is not None else 999
