"""
按品牌补抓商品（Scrapling）。

发现页/品牌墙需要"图 = 品牌 = 商品页"三者一致。分类页覆盖的品牌有限，
这里直接从连卡佛的 /designers/ 品牌索引里找出我们品牌清单对应的品牌页，
按品牌抓取商品并合并进 data/catalog.json。

用法：
    .\\.scrape-venv\\Scripts\\python.exe scripts\\scrape_brands.py --pages 2
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from scrapling.fetchers import Fetcher
from scrapling.parser import Selector

from scrape_catalog import BASE, fetch, parse_products

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

# 用户指定的品牌 → 品牌页 slug 关键词（用于在品牌索引里定位）
WANTED = {
    "Balenciaga": ["balenciaga"],
    "Louis Vuitton": ["louis-vuitton"],
    "Lanvin": ["lanvin"],
    "Raf Simons": ["raf-simons"],
    "Acne Studios": ["acne-studios"],
    "Dior": ["dior"],
    "Thom Browne": ["thom-browne"],
    "Prada": ["prada"],
    "Zegna": ["zegna"],
    "Loewe": ["loewe"],
    "Celine": ["celine"],
    "Hermès": ["hermes"],
    "Bottega Veneta": ["bottega-veneta"],
    "Saint Laurent": ["saint-laurent"],
    "Stone Island": ["stone-island"],
    "Fear of God": ["fear-of-god"],
    "Arc'teryx": ["arcteryx", "arc-teryx"],
    "Supreme": ["supreme"],
    "The North Face": ["the-north-face", "north-face"],
    "A-COLD-WALL*": ["a-cold-wall"],
    "Loro Piana": ["loro-piana"],
    "Brunello Cucinelli": ["brunello-cucinelli"],
    "Colombo": ["colombo"],
    "Boggi Milano": ["boggi"],
    "Moncler": ["moncler"],
    "Miu Miu": ["miu-miu"],
    "Sacai": ["sacai"],
    "Dries Van Noten": ["dries-van-noten"],
    "Ann Demeulemeester": ["ann-demeulemeester"],
    "Maison Margiela": ["maison-margiela"],
    "The Row": ["the-row"],
    "Lemaire": ["lemaire"],
    "Toteme": ["toteme"],
    "Theory": ["theory"],
    "Jil Sander": ["jil-sander"],
}


def brand_pages() -> dict[str, list[str]]:
    """返回 {品牌名: [品牌页 URL, ...]}"""
    html = fetch(BASE + "/designers/", timeout=60)
    if not html:
        return {}
    page = Selector(html)
    hrefs = [
        href
        for href in page.css("a::attr(href)").getall()
        if href and href.startswith("/brand/") and ("/women/" in href or "/men/" in href)
    ]
    found: dict[str, list[str]] = {}
    for brand, slugs in WANTED.items():
        urls = []
        for href in hrefs:
            slug = href.strip("/").split("/")[2] if len(href.strip("/").split("/")) > 2 else ""
            if any(slug == wanted or slug.startswith(wanted) for wanted in slugs):
                urls.append(BASE + href)
        if urls:
            found[brand] = sorted(set(urls))
    return found


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=2, help="每个品牌页抓取页数")
    parser.add_argument("--delay", type=float, default=1.2)
    parser.add_argument("--catalog", default="data/catalog.json")
    args = parser.parse_args()

    catalog_path = Path(args.catalog)
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    collected: dict[str, dict] = {item["id"]: item for item in data["products"]}
    before = len(collected)

    pages = brand_pages()
    print(f"匹配到 {len(pages)} / {len(WANTED)} 个品牌页")
    missing = [name for name in WANTED if name not in pages]
    if missing:
        print("  未在连卡佛找到：", "、".join(missing))

    for brand, urls in pages.items():
        for url in urls:
            for page_no in range(1, args.pages + 1):
                target = url if page_no == 1 else f"{url}?page={page_no}"
                html = fetch(target)
                if not html:
                    time.sleep(args.delay)
                    continue
                items = parse_products(html, "Brand")
                fresh = 0
                for item in items:
                    if item["id"] in collected:
                        continue
                    # 品牌页上的商品品牌以页面为准（更准确）
                    item["brand"] = item["brand"] or brand
                    collected[item["id"]] = item
                    fresh += 1
                print(f"  {brand:<20} {url.split('/')[-2]:<6} p{page_no}: +{fresh}（总 {len(collected)}）")
                time.sleep(args.delay)

    products = list(collected.values())
    data["products"] = products
    data["count"] = len(products)
    data["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    catalog_path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    by_brand: dict[str, int] = {}
    for item in products:
        by_brand[item["brand"]] = by_brand.get(item["brand"], 0) + 1
    print(f"\n新增 {len(products) - before} 件，共 {len(products)} 件")
    hit = [(name, by_brand.get(name.upper(), by_brand.get(name, 0))) for name in WANTED]
    print("品牌覆盖：", "、".join(f"{name}:{count}" for name, count in hit if count))
    print("仍无商品：", "、".join(name for name, count in hit if not count) or "无")


if __name__ == "__main__":
    main()
