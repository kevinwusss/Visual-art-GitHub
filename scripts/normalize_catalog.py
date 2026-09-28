"""
商品库归一化：为多币种价格补充人民币参考值。

商品来自不同国家的买手店（¥ / € / £ / $），筛选与排序需要统一口径。
这里按固定近似汇率换算成 priceCny 并保留原始价格与币种，
界面同时显示原价与人民币参考值（汇率是固定的近似值，不做实时汇率）。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:  # noqa: BLE001
    pass

# 固定近似汇率（仅用于参考价展示与筛选统一口径）
RATES = {
    "CNY": 1.0,
    "EUR": 8.2,
    "USD": 7.2,
    "GBP": 9.3,
    "HKD": 0.92,
    "JPY": 0.048,
    "KRW": 0.0053,
}


def main() -> None:
    path = Path("data/catalog.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    converted = 0
    for product in data["products"]:
        price = product.get("price")
        currency = (product.get("currency") or "CNY").upper()
        product["currency"] = currency
        if isinstance(price, (int, float)) and price > 0:
            rate = RATES.get(currency, 1.0)
            product["priceCny"] = int(round(price * rate))
            if currency != "CNY":
                converted += 1
        else:
            product["priceCny"] = None

    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    cny = [p["priceCny"] for p in data["products"] if p.get("priceCny")]
    print(f"共 {len(data['products'])} 件，其中外币换算 {converted} 件")
    print(f"人民币参考价区间: ¥{min(cny)} – ¥{max(cny)}")
    by_currency: dict[str, int] = {}
    for product in data["products"]:
        by_currency[product["currency"]] = by_currency.get(product["currency"], 0) + 1
    print("币种分布:", by_currency)


if __name__ == "__main__":
    main()
