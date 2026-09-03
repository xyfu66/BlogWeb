# -*- coding: utf-8 -*-
"""
formula_renderer.py: 将 LaTeX 数学公式（行内 $...$ 和块级 $$...$$）本地渲染为高精度透明 PNG 图片
"""
import os
import re
import hashlib
from pathlib import Path
from typing import Optional

import matplotlib
matplotlib.use("Agg")  # 强制无头模式
import matplotlib.pyplot as plt

# 字体配置：兼容中英文字符与数学符号
matplotlib.rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei', 'PingFang SC', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False
matplotlib.rcParams['mathtext.fontset'] = 'custom'
matplotlib.rcParams['mathtext.rm'] = 'Microsoft YaHei'
matplotlib.rcParams['mathtext.it'] = 'Microsoft YaHei:italic'
matplotlib.rcParams['mathtext.bf'] = 'Microsoft YaHei:bold'

CURRENT_DIR = Path(__file__).resolve().parent
CACHE_DIR = CURRENT_DIR / "formula_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def sanitize_latex(latex_str: str) -> str:
    """
    清洗并规范化 Markdown 中的 LaTeX 公式，提升 matplotlib mathtext 兼容性
    """
    s = latex_str.strip()
    # 移除外层包裹的 $ 或 $$
    if s.startswith("$$") and s.endswith("$$"):
        s = s[2:-2].strip()
    elif s.startswith("$") and s.endswith("$"):
        s = s[1:-1].strip()

    # 将常用 LaTeX 宏替换为 mathtext 支持的标准语法
    # 1. \text{...} -> \mathrm{...}
    s = re.sub(r'\\text\{([^}]+)\}', r'\\mathrm{\1}', s)
    # 2. \textbf{...} -> \mathbf{...}
    s = re.sub(r'\\textbf\{([^}]+)\}', r'\\mathbf{\1}', s)
    # 3. \boldsymbol{...} -> \mathbf{...}
    s = re.sub(r'\\boldsymbol\{([^}]+)\}', r'\\mathbf{\1}', s)
    # 4. \bm{...} -> \mathbf{...}
    s = re.sub(r'\\bm\{([^}]+)\}', r'\\mathbf{\1}', s)
    # 5. \left. 和 \right. 替换
    s = s.replace(r'\left.', '').replace(r'\right.', '')
    
    return s

def render_latex_to_png(latex_code: str, is_display: bool = False) -> Optional[Path]:
    """
    渲染单个公式为 PNG 图片，使用 MD5 进行结果缓存
    返回生成的 PNG 图片绝对路径
    """
    cleaned_code = sanitize_latex(latex_code)
    if not cleaned_code:
        return None

    # 计算缓存 key
    mode_str = "display" if is_display else "inline"
    cache_key = hashlib.md5(f"{mode_str}:{cleaned_code}".encode("utf-8")).hexdigest()
    output_path = CACHE_DIR / f"{cache_key}.png"

    # 若缓存存在且文件有效，直接复用
    if output_path.is_file() and output_path.stat().st_size > 100:
        return output_path

    # 参数微调
    fontsize = 16 if is_display else 13
    dpi = 220
    text_color = "#24292f"  # 深灰黑色，适配微信白色阅读背景

    figs_to_close = []
    try:
        fig = plt.figure(figsize=(0.1, 0.1), dpi=dpi)
        figs_to_close.append(fig)
        # 加上数学模式定界符
        math_text = f"${cleaned_code}$"
        t = plt.text(
            0, 0, math_text,
            fontsize=fontsize,
            color=text_color,
            verticalalignment='center',
            horizontalalignment='left'
        )
        plt.axis("off")

        # 触发渲染并获取真实外包矩形
        fig.canvas.draw()
        renderer = fig.canvas.get_renderer()
        bbox = t.get_window_extent(renderer=renderer)
        bbox_inches = bbox.transformed(fig.dpi_scale_trans.inverted())

        # 增加微量内边距
        pad_inches = 0.04 if is_display else 0.02
        fig.savefig(
            str(output_path),
            dpi=dpi,
            bbox_inches=bbox_inches,
            transparent=True,
            pad_inches=pad_inches
        )
        return output_path

    except Exception:
        # 如果 mathtext 严格模式解析失败，尝试纯文本兜底
        try:
            fallback_fig = plt.figure(figsize=(0.1, 0.1), dpi=dpi)
            figs_to_close.append(fallback_fig)
            t = plt.text(
                0, 0, cleaned_code,
                fontsize=fontsize,
                color=text_color,
                verticalalignment='center',
                horizontalalignment='left',
                fontfamily='monospace'
            )
            plt.axis("off")
            fallback_fig.canvas.draw()
            renderer = fallback_fig.canvas.get_renderer()
            bbox = t.get_window_extent(renderer=renderer)
            bbox_inches = bbox.transformed(fallback_fig.dpi_scale_trans.inverted())
            fallback_fig.savefig(
                str(output_path),
                dpi=dpi,
                bbox_inches=bbox_inches,
                transparent=True,
                pad_inches=0.03
            )
            return output_path
        except Exception as e2:
            print(f"[警告] 公式渲染失败: {latex_code[:40]}... (错误: {e2})")
            return None
    finally:
        for f in figs_to_close:
            plt.close(f)

if __name__ == "__main__":
    # 测试常规行内与块级公式
    t1 = render_latex_to_png(r"\mu + \sigma \times \epsilon", is_display=False)
    t2 = render_latex_to_png(r"p(z|x) = \frac{p(x|z) \cdot p(z)}{p(x)}", is_display=True)
    t3 = render_latex_to_png(r"1024 \times 1024 \times 3 (\text{红、绿、蓝三原色}) = 3,145,728 \text{ 个数值！}", is_display=True)
    print("测试渲染完成:")
    print("  行内:", t1)
    print("  块级:", t2)
    print("  中文公式:", t3)
