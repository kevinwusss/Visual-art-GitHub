"""
抓取时尚媒体文章卡片（Scrapling）——首页"秀场 / 杂志"版块的真实内容源。

此前这两块用的是搜索引擎图片：图片能显示，但点进去的页面未必是同一篇内容，
品牌也常常对不上。这里改为直接抓媒体的文章列表，得到
「标题 + 主图 + 文章链接」三元组，三者天然一致；抓取时同时校验图片可达，
取不到图或取不到标题的文章直接丢弃。

用法：
    .\\.scrape-venv\\Scripts\\python.exe scripts\\scrape_editorial.py
输出：data/editorial.json
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from scrapling.fetchers import Fetcher
from scrapling.parser import Selector

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

SOURCES = [
    {"name": "HYPEBEAST", "url": "https://hypebeast.cn/fashion", "home": "https://hypebeast.cn"},
    {"name": "NOWRE", "url": "https://www.nowre.com/", "home": "https://www.nowre.com"},
    # 秀场／时尚大片：这两家是服务端渲染，图片来自各自的媒体 CDN
    {"name": "VOGUE FRANCE", "url": "https://www.vogue.fr/mode", "home": "https://www.vogue.fr", "topic": "runway"},
    {"name": "ELLE RUNWAY", "url": "https://www.elle.com/runway/", "home": "https://www.elle.com", "topic": "runway"},
]

RUNWAY_KEYS = ["时装周", "秀场", "runway", "fashion week", "巴黎", "米兰", "男装周", "高定", "fashion-show"]
STREET_KEYS = ["街拍", "street style", "street-style", "穿搭", "造型"]


def classify(title: str, url: str) -> str:
    haystack = f"{title} {url}".lower()
    if any(key in haystack for key in RUNWAY_KEYS):
        return "runway"
    if any(key in haystack for key in STREET_KEYS):
        return "street"
    return "magazine"


def image_ok(url: str) -> bool:
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=12)
        return page.status == 200 and "image" in (page.headers.get("content-type") or "")
    except Exception:  # noqa: BLE001
        return False


def main() -> None:
    cards: dict[str, dict] = {}
    for source in SOURCES:
        try:
            page = Fetcher.get(source["url"], stealthy_headers=True, timeout=45)
        except Exception as error:  # noqa: BLE001
            print(f"  {source['name']} {source['url']} 失败：{error}")
            continue

        sel = Selector(page.html_content)
        found = 0
        for anchor in sel.css("a"):
            href = (anchor.attrib.get("href") or "").strip()
            if not href:
                continue
            if href.startswith("/"):
                href = source["home"] + href
            if not href.startswith("http") or "hypebeast" in href and "/20" not in href and "nowre" in href and "/post/" not in href:
                # 只保留文章级链接
                if "/20" not in href and "/post/" not in href:
                    continue
            img = anchor.css("img::attr(src)").get() or anchor.css("img::attr(data-src)").get() or ""
            title = (
                anchor.css("img::attr(alt)").get()
                or anchor.css("h2::text").get()
                or anchor.css("h3::text").get()
                or ""
            ).strip()
            if not img or len(title) < 8:
                continue
            if img.startswith("data:"):
                continue
            if any(bad in img.lower() for bad in ["logo", "avatar", "icon", "sprite", "placeholder"]):
                continue
            if href in cards:
                continue
            cards[href] = {
                "id": f"media-{len(cards)}",
                "title": title,
                "image": img,
                "url": href,
                "source": source["name"],
                "topic": source.get("topic") or classify(title, href)
            }
            found += 1
            if found >= 40:
                break
        print(f"  {source['name']} {source['url']} → +{found}（累计 {len(cards)}）")
        time.sleep(1.2)

    # 校验图片可达性：不达标的文章直接丢弃（宁缺毋滥）
    verified: list[dict] = []
    for card in cards.values():
        if image_ok(card["image"]):
            verified.append(card)
        time.sleep(0.2)

    by_topic: dict[str, int] = {}
    for card in verified:
        by_topic[card["topic"]] = by_topic.get(card["topic"], 0) + 1

    out_path = Path("data/editorial.json")
    out_path.write_text(
        json.dumps(
            {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "count": len(verified),
                "cards": verified,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"\n可用文章 {len(verified)} 篇（抓取 {len(cards)}，剔除图片不可达）→ {out_path}")
    print("主题分布:", by_topic)


if __name__ == "__main__":
    main()
