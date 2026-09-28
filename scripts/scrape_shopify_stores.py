"""
抓取 Shopify 买手店与品牌官网的公开商品数据（/products.json）。

连卡佛覆盖不到的品牌在这些店里能补上（Stone Island、Acne Studios、Jil Sander、
Rick Owens、Gucci 等）。该接口无需登录、不绕过任何风控。

用法:
    .\\.scrape-venv\\Scripts\\python.exe scripts\\scrape_shopify_stores.py --max-pages 8
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

from scrapling.fetchers import Fetcher

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

STORES = [
    {"name": "Antonioli", "domain": "https://www.antonioli.eu", "currency": "EUR"},
    {"name": "Kith", "domain": "https://kith.com", "currency": "USD"},
    {"name": "Peggs & Son", "domain": "https://www.peggsandson.com", "currency": "GBP"},
    {"name": "Oi Polloi", "domain": "https://www.oipolloi.com", "currency": "GBP"},
    {"name": "Voo Berlin", "domain": "https://www.vooberlin.com", "currency": "EUR"},
    {"name": "Darklands", "domain": "https://www.darklands.fr", "currency": "EUR"},
    {"name": "Fear of God", "domain": "https://fearofgod.com", "currency": "USD"},
    {"name": "A-COLD-WALL*", "domain": "https://www.acoldwall.com", "currency": "GBP"},
    {"name": "The Webster", "domain": "https://www.thewebster.com", "currency": "USD"},
    {"name": "Union LA", "domain": "https://store.unionlosangeles.com", "currency": "USD"},
    {"name": "Bodega", "domain": "https://shop.bdgastore.com", "currency": "USD"},
    {"name": "Notre", "domain": "https://www.notre-shop.com", "currency": "USD"},
    {"name": "Feature", "domain": "https://feature.com", "currency": "USD"},
    {"name": "Xhibition", "domain": "https://xhibition.co", "currency": "USD"},
    {"name": "Kirna Zabete", "domain": "https://www.kirnazabete.com", "currency": "USD"},
    {"name": "Biffi", "domain": "https://www.biffi.com", "currency": "EUR"},
    {"name": "Studious", "domain": "https://www.studious-online.com", "currency": "JPY"},
    {"name": "United Arrows", "domain": "https://shop.united-arrows.co.jp", "currency": "JPY"},
    {"name": "Beaker", "domain": "https://www.beaker.co.kr", "currency": "KRW"},
]

CATEGORY_RULES = [
    ("Outerwear", ["coat", "jacket", "parka", "blouson", "trench", "puffer", "gilet"]),
    ("Bottoms", ["pant", "trouser", "jean", "short", "cargo", "denim"]),
    ("Shoes", ["shoe", "sneaker", "boot", "loafer", "sandal", "runner", "trainer"]),
    ("Bags", ["bag", "tote", "backpack", "clutch", "pouch", "luggage"]),
    ("Accessories", ["cap", "hat", "beanie", "scarf", "belt", "sock", "sunglass", "glove", "wallet", "jewel", "watch"]),
    ("Dresses", ["dress", "gown", "skirt"]),
    ("Tops", ["shirt", "tee", "knit", "sweater", "hoodie", "sweatshirt", "polo", "top", "vest"]),
]


def classify(*parts: str) -> str:
    haystack = " ".join(part for part in parts if part).lower()
    for category, keywords in CATEGORY_RULES:
        if any(keyword in haystack for keyword in keywords):
            return category
    return "Tops"


COLOR_WORDS = [
    "black","white","grey","gray","charcoal","navy","blue","light blue","royal blue","green","olive","khaki",
    "beige","cream","ivory","sand","tan","camel","brown","chocolate","burgundy","red","orange","yellow",
    "pink","purple","lilac","violet","silver","gold","metallic","multi","natural","ecru","stone","taupe",
    "black","graphite","gunmetal","rust","forest","moss","teal","aqua","indigo","denim","bordeaux",
    "黑","白","灰","炭","米","棕","驼","蓝","绿","红","黄","粉","紫","银","金","卡其","多色"
]


def looks_like_color(text: str) -> bool:
    lowered = text.lower()
    return any(word in lowered for word in COLOR_WORDS)


def extract_colors(product: dict) -> list[str]:
    """
    取颜色：优先用 Shopify 的 Color 选项；没有则从标题/变体名里按颜色词表提取
    （Antonioli、Kith 这类店只给尺码，颜色藏在标题里）。
    """
    colors: list[str] = []
    for option in product.get("options") or []:
        name = str(option.get("name") or "").lower()
        if any(key in name for key in ["color", "colour", "颜色"]):
            for value in option.get("values") or []:
                text = str(value).strip()
                if text and text.lower() not in {"default", "default title"}:
                    colors.append(text)
    if not colors:
        title = str(product.get("title") or "")
        for token in title.replace(" - ", " / ").replace("–", "/").split("/"):
            text = token.strip(" -–|,")
            if text and looks_like_color(text) and len(text) <= 24:
                colors.append(text)
    if not colors:
        for variant in (product.get("variants") or [])[:8]:
            text = str(variant.get("title") or "").strip()
            if text and looks_like_color(text) and len(text) <= 24:
                colors.append(text)
    seen: list[str] = []
    for color in colors:
        if color and color not in seen:
            seen.append(color)
    return seen[:4]


def fetch_json(url: str) -> dict | None:
    try:
        page = Fetcher.get(url, stealthy_headers=True, timeout=45)
        payload = json.loads(page.body.decode("utf-8", errors="replace"))
        return payload if isinstance(payload, dict) else None
    except Exception as error:  # noqa: BLE001
        print(f"    ! {url} -> {error}")
        return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-pages", type=int, default=8)
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--catalog", default="data/catalog.json")
    parser.add_argument("--only", default="", help="只抓这些店（逗号分隔的店名关键字）")
    args = parser.parse_args()

    stores = STORES
    if args.only.strip():
        wanted = [name.strip().lower() for name in args.only.split(",") if name.strip()]
        stores = [store for store in STORES if any(w in store["name"].lower() for w in wanted)]
        print("定向重试:", ", ".join(store["name"] for store in stores))

    catalog_path = Path(args.catalog)
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    collected: dict[str, dict] = {item["id"]: item for item in data["products"]}
    before = len(collected)

    for store in stores:
        added = 0
        for page_no in range(1, args.max_pages + 1):
            url = f"{store['domain']}/products.json?limit=250&page={page_no}"
            payload = fetch_json(url)
            products = (payload or {}).get("products") or []
            if not products:
                break
            for product in products:
                title = (product.get("title") or "").strip()
                handle = product.get("handle") or ""
                images = product.get("images") or []
                variants = product.get("variants") or []
                if not title or not images or not variants:
                    continue
                product_id = f"shop-{store['name'].split()[0].lower()}-{product.get('id')}"
                colors = extract_colors(product)
                existing = collected.get(product_id)
                if existing is not None:
                    # 老数据缺颜色时补上（重跑即可补全）
                    if not existing.get("colors") and colors:
                        existing["colors"] = colors
                        added += 1
                    continue
                try:
                    price = round(float(str(variants[0].get("price") or "")))
                except ValueError:
                    price = None
                vendor = (product.get("vendor") or store["name"]).strip()
                tags = product.get("tags") or []
                collected[product_id] = {
                    "id": product_id,
                    "brand": vendor,
                    "name": title,
                    "price": price,
                    "currency": store["currency"],
                    "image": images[0].get("src", ""),
                    "url": f"{store['domain']}/products/{handle}",
                    "category": classify(title, product.get("product_type") or "", " ".join(tags)),
                    "retailer": store["name"],
                    "colors": colors,
                    "badge": "",
                }
                added += 1
            time.sleep(args.delay)
        print(f"  {store['name']:<14} +{added} (total {len(collected)})")

    products = list(collected.values())
    data["products"] = products
    data["count"] = len(products)
    data["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S")
    catalog_path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    by_brand: dict[str, int] = {}
    by_retailer: dict[str, int] = {}
    for item in products:
        by_brand[item["brand"]] = by_brand.get(item["brand"], 0) + 1
        by_retailer[item["retailer"]] = by_retailer.get(item["retailer"], 0) + 1
    print(f"\n新增 {len(products) - before} 件，共 {len(products)} 件 -> {catalog_path}")
    print("渠道:", dict(sorted(by_retailer.items(), key=lambda kv: -kv[1])[:8]))
    print("品牌 Top15:", sorted(by_brand.items(), key=lambda kv: -kv[1])[:15])


if __name__ == "__main__":
    main()
