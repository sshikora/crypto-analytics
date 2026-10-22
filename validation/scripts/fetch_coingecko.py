"""Fetch a fixed daily price sample from CoinGecko, the same source the backend uses.

Run once; the CSV is committed so fixtures stay reproducible.
    uv run scripts/fetch_coingecko.py bitcoin 2026-10-21
"""

import csv
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def main(coin_id: str, end_date: str) -> None:
    api_key = os.environ.get("COINGECKO_API_KEY", "")
    is_pro = bool(api_key) and not api_key.startswith("CG-")
    base = "https://pro-api.coingecko.com/api/v3" if is_pro else "https://api.coingecko.com/api/v3"
    url = f"{base}/coins/{coin_id}/market_chart?vs_currency=usd&days=365&interval=daily"
    request = urllib.request.Request(url, headers={"accept": "application/json"})
    if api_key:
        request.add_header("x-cg-pro-api-key" if is_pro else "x-cg-demo-api-key", api_key)

    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)

    end = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
    end_ms = int(end.timestamp() * 1000)
    # Keep only midnight-UTC closes up to the end date; the API appends a live intraday point.
    rows = [(ts, price) for ts, price in payload["prices"] if ts <= end_ms and ts % 86_400_000 == 0]

    out = Path(__file__).resolve().parent.parent / "data" / f"{coin_id}_usd_daily.csv"
    with out.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "timestamp_ms", "price_usd"])
        for ts, price in rows:
            date = datetime.fromtimestamp(ts / 1000, tz=timezone.utc).date().isoformat()
            writer.writerow([date, ts, repr(price)])
    print(f"wrote {len(rows)} rows to {out}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
