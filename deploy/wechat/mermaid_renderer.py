# -*- coding: utf-8 -*-
"""
mermaid_renderer.py: 将 Mermaid 图表代码块渲染为 PNG 图片，支持缓存与多级降级
"""
import os
import base64
import hashlib
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional
import requests

CURRENT_DIR = Path(__file__).resolve().parent
CACHE_DIR = CURRENT_DIR / "mermaid_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def render_mermaid_to_png(mermaid_code: str) -> Optional[Path]:
    """
    渲染 Mermaid 图表代码为高清晰度 PNG 图片
    策略：
    1. 优先检查本地 MD5 缓存
    2. 尝试 mermaid.ink 云端微服务（速度快、排版标准、白底抗锯齿）
    3. 尝试本地 npx @mermaid-js/mermaid-cli (mmdc)
    4. 失败返回 None，由上层以标准代码块优雅展示
    """
    code = mermaid_code.strip()
    if not code:
        return None

    cache_key = hashlib.md5(code.encode("utf-8")).hexdigest()
    output_path = CACHE_DIR / f"{cache_key}.png"

    if output_path.is_file() and output_path.stat().st_size > 200:
        return output_path

    # Tier 1: 尝试 mermaid.ink
    try:
        graph_bytes = code.encode("utf-8")
        base64_str = base64.urlsafe_b64encode(graph_bytes).decode("ascii")
        url = f"https://mermaid.ink/img/{base64_str}?bgColor=white"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=15)
        if resp.status_code == 200 and len(resp.content) > 200:
            output_path.write_bytes(resp.content)
            return output_path
    except Exception as e:
        print(f"[提示] mermaid.ink 渲染未完成 ({e})，尝试本地引擎...")

    # Tier 2: 尝试本地 npx @mermaid-js/mermaid-cli
    npx_cmd = shutil.which("npx")
    if npx_cmd:
        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            input_mmd = tmp_path / "chart.mmd"
            tmp_out_png = tmp_path / "chart.png"
            input_mmd.write_text(code, encoding="utf-8")

            cmd = [
                npx_cmd,
                "-y",
                "@mermaid-js/mermaid-cli",
                "-i",
                str(input_mmd),
                "-o",
                str(tmp_out_png),
                "--backgroundColor",
                "white",
            ]
            try:
                res = subprocess.run(
                    cmd,
                    capture_output=True,
                    timeout=30,
                    text=True,
                    shell=(os.name == "nt")
                )
                if res.returncode == 0 and tmp_out_png.is_file():
                    shutil.copyfile(tmp_out_png, output_path)
                    return output_path
            except Exception as e:
                print(f"[提示] 本地 mmdc 渲染失败: {e}")

    print(f"[警告] Mermaid 图表无法转为图片，将降级为代码块展示: {code[:30]}...")
    return None

if __name__ == "__main__":
    sample = """
    flowchart LR
        A[开始] --> B{判断}
        B -- 是 --> C[结束]
        B -- 否 --> A
    """
    res = render_mermaid_to_png(sample)
    print("Mermaid 渲染结果:", res)
