# -*- coding: utf-8 -*-
"""
wechat_api.py: 微信公众号 API 客户端（access_token、图片上传、素材上传与草稿箱提交）
"""
import os
import json
import time
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional
import requests
from dotenv import load_dotenv
from PIL import Image

CURRENT_DIR = Path(__file__).resolve().parent
TOKEN_CACHE_FILE = CURRENT_DIR / "token_cache.json"
# SVG 转换中间文件统一存入工具目录的缓存中，不污染源码仓库
SVG_CACHE_DIR = CURRENT_DIR / "formula_cache" / "svg_converted"

# 加载 .env 变量
ENV_FILE = CURRENT_DIR / ".env"
if ENV_FILE.is_file():
    load_dotenv(ENV_FILE)

def get_config() -> Dict[str, str]:
    """获取配置字典"""
    app_id = os.getenv("WECHAT_APP_ID", "").strip()
    app_secret = os.getenv("WECHAT_APP_SECRET", "").strip()
    author = os.getenv("WECHAT_AUTHOR", "").strip()
    base_url = os.getenv("BLOG_BASE_URL", "https://bitvortex.vip").strip()
    return {
        "app_id": app_id,
        "app_secret": app_secret,
        "author": author,
        "base_url": base_url,
    }

class WeChatClient:
    def __init__(self, app_id: Optional[str] = None, app_secret: Optional[str] = None):
        cfg = get_config()
        self.app_id = app_id or cfg["app_id"]
        self.app_secret = app_secret or cfg["app_secret"]
        self.author = cfg["author"]
        self.base_url = cfg["base_url"]

    def _validate_credentials(self):
        if not self.app_id or not self.app_secret or "your_appid" in self.app_id:
            raise ValueError(
                "请先在 deploy/wechat/.env 中配置真实的 WECHAT_APP_ID 和 WECHAT_APP_SECRET！\n"
                "参考模板：deploy/wechat/.env.example"
            )

    def get_access_token(self, force_refresh: bool = False) -> str:
        """
        获取公众号有效 access_token（自动维护 2 小时缓存）
        """
        self._validate_credentials()

        now = time.time()
        if not force_refresh and TOKEN_CACHE_FILE.is_file():
            try:
                data = json.loads(TOKEN_CACHE_FILE.read_text(encoding="utf-8"))
                token = data.get("access_token")
                expires_at = data.get("expires_at", 0)
                # 预留 5 分钟缓冲期
                if token and now < (expires_at - 300):
                    return token
            except Exception:
                pass

        # 重新请求 access_token
        url = "https://api.weixin.qq.com/cgi-bin/token"
        params = {
            "grant_type": "client_credential",
            "appid": self.app_id,
            "secret": self.app_secret,
        }
        resp = requests.get(url, params=params, timeout=15)
        resp_data = resp.json()

        if "access_token" not in resp_data:
            err_code = resp_data.get("errcode")
            err_msg = resp_data.get("errmsg", "")
            if err_code == 40164:
                raise RuntimeError(
                    f"微信接口拒绝（IP未在白名单）：{err_msg}\n"
                    "请登录微信公众平台 -> 开发接口设置 -> IP白名单，添加当前机器外网IP。"
                )
            raise RuntimeError(f"获取 access_token 失败 [{err_code}]: {err_msg}")

        access_token = resp_data["access_token"]
        expires_in = resp_data.get("expires_in", 7200)

        # 写入本地缓存
        TOKEN_CACHE_FILE.write_text(
            json.dumps({
                "access_token": access_token,
                "expires_at": now + expires_in
            }, indent=2),
            encoding="utf-8"
        )
        return access_token

    def prepare_image_for_wechat(self, image_path: Path, max_size_bytes: int = 1000 * 1024) -> Path:
        """
        检查并预处理图片：
        1. 若为 SVG，转换为 PNG（输出到 formula_cache/svg_converted/ 避免污染源码）
        2. 若超出最大体积（默认1MB），进行尺寸与质量等比例压缩
        """
        # 1. 矢量图 SVG 转换（输出到工具目录缓存，不改动 public/ 目录下的源码）
        if image_path.suffix.lower() == ".svg":
            SVG_CACHE_DIR.mkdir(parents=True, exist_ok=True)
            converted_png = SVG_CACHE_DIR / (image_path.stem + ".png")
            if not converted_png.is_file() or converted_png.stat().st_size < 100:
                npx_cmd = shutil.which("npx")
                if npx_cmd:
                    cmd = [
                        npx_cmd,
                        "-y",
                        "@resvg/resvg-js-cli",
                        "--background",
                        "#ffffff",
                        str(image_path),
                        str(converted_png),
                    ]
                    try:
                        subprocess.run(cmd, check=True, capture_output=True, shell=(os.name == "nt"))
                    except Exception as e:
                        print(f"[警告] SVG 转换失败 {image_path}: {e}")
            if converted_png.is_file():
                image_path = converted_png

        # 2. 检查图片大小与格式
        if image_path.stat().st_size <= max_size_bytes:
            return image_path

        # 3. 压缩过大图片
        compressed_path = CURRENT_DIR / "formula_cache" / f"comp_{image_path.name}"
        if compressed_path.suffix.lower() not in [".jpg", ".jpeg", ".png"]:
            compressed_path = compressed_path.with_suffix(".jpg")

        with Image.open(image_path) as img:
            # 限制最大宽高度为 1920
            img.thumbnail((1920, 1920), Image.Resampling.LANCZOS)
            if img.mode in ("RGBA", "P") and compressed_path.suffix.lower() in [".jpg", ".jpeg"]:
                img = img.convert("RGB")
            
            # 尝试质量 85 压缩
            img.save(str(compressed_path), quality=85, optimize=True)
            if compressed_path.stat().st_size > max_size_bytes:
                img.save(str(compressed_path), quality=70, optimize=True)

        return compressed_path

    def upload_article_image(self, image_path: Path) -> str:
        """
        上传图文消息内的图片（media/uploadimg），获取微信服务器生成的永久 URL
        注意：该接口不占用公众平台素材库上限
        """
        token = self.get_access_token()
        url = f"https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token={token}"

        clean_path = self.prepare_image_for_wechat(image_path, max_size_bytes=1024 * 1024)
        
        mime_type = "image/png" if clean_path.suffix.lower() == ".png" else "image/jpeg"
        with open(clean_path, "rb") as f:
            files = {
                "media": (clean_path.name, f, mime_type)
            }
            resp = requests.post(url, files=files, timeout=30)
            data = resp.json()

        if "url" not in data:
            raise RuntimeError(f"上传图文内图片失败 [{data.get('errcode')}]: {data.get('errmsg')}")

        return data["url"]

    def upload_thumb_material(self, image_path: Path) -> str:
        """
        上传封面图素材并返回 thumb_media_id。
        对个人订阅号：
          - 优先使用 material/add_material?type=image（永久素材）
          - 若权限不足（errcode==40007/48001），降级到 media/upload?type=thumb
        微信草稿符 thumb_media_id 需要的是 image 类型的 media_id，
        而非 thumb 类型，请勿混淤。
        """
        token = self.get_access_token()
        clean_path = self.prepare_image_for_wechat(image_path, max_size_bytes=2 * 1024 * 1024)
        mime_type = "image/png" if clean_path.suffix.lower() == ".png" else "image/jpeg"

        # 尝试 1： 永久素材 material/add_material?type=image
        perm_url = f"https://api.weixin.qq.com/cgi-bin/material/add_material?access_token={token}&type=image"
        try:
            with open(clean_path, "rb") as f:
                files = {"media": (clean_path.name, f, mime_type)}
                resp = requests.post(perm_url, files=files, timeout=30)
                data = resp.json()
            if "media_id" in data:
                return data["media_id"]
            err_code = data.get("errcode", 0)
            if err_code not in (40007, 48001, 44004):
                # 非权限类错误，不尝试降级
                raise RuntimeError(f"永久素材上传失败: [{err_code}] {data.get('errmsg')}")
            print(f"[提示] 永久素材接口权限不足 ({err_code})，尝试降级到临时素材...")
        except RuntimeError:
            raise
        except Exception as e:
            print(f"[提示] 永久素材请求异常: {e}，尝试降级...")

        # 降级尝试 2： 临时素材 media/upload?type=thumb
        # 注意: thumb 类型素材返回的 thumb_media_id，若实际接口不支持可继续尝试 type=image
        temp_url = f"https://api.weixin.qq.com/cgi-bin/media/upload?access_token={token}&type=image"
        with open(clean_path, "rb") as f:
            files = {"media": (clean_path.name, f, mime_type)}
            resp = requests.post(temp_url, files=files, timeout=30)
            data = resp.json()
        if "media_id" in data:
            return data["media_id"]

        raise RuntimeError(f"封面图素材上传失败: [{data.get('errcode')}] {data.get('errmsg')}")

    def add_draft(
        self,
        title: str,
        content_html: str,
        thumb_media_id: str,
        digest: str = "",
        author: Optional[str] = None
    ) -> str:
        """
        将文章提交至微信公众号草稿箱（draft/add）
        返回生成的草稿 media_id
        """
        token = self.get_access_token()
        url = f"https://api.weixin.qq.com/cgi-bin/draft/add?access_token={token}"

        # 截断摘要至 120 字
        clean_digest = (digest or "").strip()[:120]
        article_item = {
            "title": title[:64],  # 微信标题上限 64 字符
            "author": author if author is not None else self.author,
            "digest": clean_digest,
            "content": content_html,
            "thumb_media_id": thumb_media_id,
            "need_open_comment": 0,
            "only_fans_can_comment": 0
        }

        payload = {"articles": [article_item]}
        payload_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")

        resp = requests.post(
            url,
            data=payload_bytes,
            headers={"Content-Type": "application/json; charset=utf-8"},
            timeout=30
        )
        data = resp.json()

        if "media_id" not in data:
            raise RuntimeError(f"提交草稿箱失败 [{data.get('errcode')}]: {data.get('errmsg')}")

        return data["media_id"]

if __name__ == "__main__":
    client = WeChatClient()
    print("WeChatClient 初始化成功，配置为:", client.app_id or "(未配置)")
