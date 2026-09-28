"""
买手店商品库抓取（Scrapling）。

背景：发现页此前只能借用搜索引擎的图片索引——图片与商品不对应、没有价格、
数量也少。这里用 Scrapling 抓取支持服务端渲染的高端零售站点（连卡佛 Lane
Crawford，schema.org 微数据完整），得到「品牌 / 商品名 / 价格 / 主图 / 商品链接」
四要素齐全的真实商品，供发现页与品牌墙使用。

用法：
    .\\.scrape-venv\\Scripts\\python.exe scripts\\scrape_catalog.py --pages 2
输出：data/catalog.json

合规：仅抓取公开商品列表页，控制频率（默认每请求间隔 1.2 秒），不使用代理或绕过登录。
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

from scrapling.fetchers import Fetcher
from scrapling.parser import Selector

try:  # Windows 控制台默认 GBK，中文与 ¥ 会报错
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

BASE = "https://www.lanecrawford.com.cn"

# 父分类页：从这里自动发现子分类，避免硬编码可能失效的 slug
PARENTS = [
    "/category/catd000129/women/clothing/",
    "/category/catd000075/women/shoes/",
    "/category/catd000042/women/bags/",
    "/category/catd000128/women/accessories/",
    "/category/catd000129/men/clothing/",
    "/category/catd000083/men/shoes/",
    "/category/catd000042/men/bags/",
]

# 子分类 slug 关键词 → 我们的分类
CATEGORY_RULES = [
    ("Outerwear", ["coat", "jacket", "blazer", "trench", "down", "parka", "gilet", "outerwear"]),
    ("Tops", ["shirt", "knitwear", "sweater", "top", "t-shirt", "tee", "polo", "hoodie", "sweatshirt"]),
    ("Bottoms", ["trouser", "pant", "jean", "skirt", "short", "denim"]),
    ("Dresses", ["dress", "gown"]),
    ("Shoes", ["shoe", "sneaker", "boot", "flat", "heel", "loafer", "sandal", "pump"]),
    ("Bags", ["bag", "tote", "clutch", "backpack", "luggage"]),
    ("Accessories", ["scarf", "scarv", "belt", "hat", "cap", "sunglass", "eyewear", "glove", "tie", "jewel", "watch"]),
]


def classify(slug: str) -> str | None:
    lowered = slug.lower()
    for category, keywords in CATEGORY_RULES:
        if any(keyword in lowered for keyword in keywords):
            return category
    return None


def parse_products(html: str, category: str) -> list[dict]:
    page = Selector(html)
    items: list[dict] = []
    for node in page.css("li.product-item"):
        product_id = (node.attrib.get("data-productid") or "").strip()
        if not product_id:
            continue
        brand = (node.css("h2[itemprop='brand'] span[itemprop='name']::text").get() or "").strip()
        name = " ".join((node.css("h3[itemprop='name']::text").get() or "").split())
        price_text = (
            node.css("span.sale-price::text").get()
            or node.css("span.price::text").get()
            or node.css("span[itemprop='price']::text").get()
            or ""
        ).strip()
        image = (node.css("meta[itemprop='image']::attr(content)").get() or "").strip()
        if not image:
            image = (
                node.css("img.plp-index::attr(data-img)").get()
                or node.css("img.plp-index::attr(data-src)").get()
                or ""
            )
        href = (node.css("a.product-images::attr(href)").get() or "").strip()
        if not href:
            href = (node.css("meta[itemprop='url']::attr(content)").get() or "").strip()
        colors = [
            value.strip()
            for value in node.css("div.product-colors__list span::attr(title)").getall()
            if value and value.strip()
        ]
        badge = " ".join((node.css("span.item-badge::text").get() or "").split())

        digits = "".join(ch for ch in price_text if ch.isdigit())
        price = int(digits) if digits else None
        if not name or not image:
            continue

        items.append(
            {
                "id": product_id,
                "brand": brand,
                "name": name,
                "price": price,
                "currency": "CNY",
                "image": image,
                "url": urljoin(BASE, href) if href else "",
                "category": category,
                "retailer": "连卡佛 Lane Crawford",
                "colors": colors[:3],
                "badge": badge,
            }
        )
    return items


def fetch(url: str, timeout: int = 40) -> str | None:
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=timeout)
        return page.html_content
    except Exception as error:  # noqa: BLE001
        print(f"    ! 抓取失败 {url} → {error}")
        return None


def discover_subcategories(delay: float) -> dict[str, str]:
    """从父分类页发现子分类链接：{url: category}"""
    found: dict[str, str] = {}
    for parent in PARENTS:
        html = fetch(BASE + parent)
        if not html:
            time.sleep(delay)
            continue
        page = Selector(html)
        for href in page.css("a::attr(href)").getall():
            if not href or "/category/" not in href or "#" in href:
                continue
            if "/women/" not in href and "/men/" not in href:
                continue
            slug = href.rstrip("/").split("/")[-1]
            category = classify(slug)
            if not category:
                continue
            url = urljoin(BASE, href.split("#")[0])
            found[url] = category
        print(f"  发现子分类：{parent} → 累计 {len(found)}")
        time.sleep(delay)
    return found


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=2, help="每个子分类抓取页数")
    parser.add_argument("--delay", type=float, default=1.2, help="请求间隔（秒）")
    parser.add_argument("--out", default="data/catalog.json")
    args = parser.parse_args()

    print("① 发现子分类…")
    subcategories = discover_subcategories(args.delay)
    print(f"  共 {len(subcategories)} 个子分类")

    collected: dict[str, dict] = {}
    print("② 抓取商品…")
    for url, category in subcategories.items():
        for page_no in range(1, args.pages + 1):
            target = url if page_no == 1 else f"{url}?page={page_no}"
            html = fetch(target)
            if not html:
                time.sleep(args.delay)
                continue
            items = parse_products(html, category)
            fresh = 0
            for item in items:
                if item["id"] in collected:
                    continue
                collected[item["id"]] = item
                fresh += 1
            print(f"  {category:<11} {url.split('/')[-2]:<22} p{page_no}: +{fresh}（总 {len(collected)}）")
            time.sleep(args.delay)

    products = list(collected.values())
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(
            {
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
                "source": "Lane Crawford 连卡佛",
                "count": len(products),
                "products": products,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )

    by_category: dict[str, int] = {}
    by_brand: dict[str, int] = {}
    for item in products:
        by_category[item["category"]] = by_category.get(item["category"], 0) + 1
        if item["brand"]:
            by_brand[item["brand"]] = by_brand.get(item["brand"], 0) + 1
    print(f"\n共 {len(products)} 件 → {out_path}")
    print("分类:", by_category)
    print("品牌 Top12:", sorted(by_brand.items(), key=lambda kv: -kv[1])[:12])
    priced = [item for item in products if item["price"]]
    if priced:
        prices = sorted(item["price"] for item in priced)
        print(f"价格区间: ¥{prices[0]}–¥{prices[-1]}（{len(priced)} 件有价格）")


if __name__ == "__main__":
    main()
