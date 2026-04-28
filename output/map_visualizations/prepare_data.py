"""실제 배달 CSV → demos/data.json (최소 필드, 타임스탬프는 상대 시간(분)로 변환)."""

import csv
import json
from datetime import datetime
from pathlib import Path

SRC = Path("/Users/jinsol/Downloads/서울전체.csv")
OUT = Path(__file__).parent / "demos" / "data.json"

rows = []
with SRC.open() as f:
    r = csv.DictReader(f)
    for row in r:
        try:
            sl = float(row["shop_lat"])
            sn = float(row["shop_lon"])
            dl = float(row["dlvry_lat"])
            dn = float(row["dlvry_lon"])
        except (ValueError, KeyError):
            continue
        # 서울 바운딩 박스 필터
        if not (37.40 < sl < 37.72 and 126.75 < sn < 127.20):
            continue
        if not (37.40 < dl < 37.72 and 126.75 < dn < 127.20):
            continue
        try:
            pt = datetime.fromisoformat(row["pick_up_date"].split(".")[0])
            ht = datetime.fromisoformat(row["hand_over_date"].split(".")[0])
        except (ValueError, KeyError):
            continue
        rows.append(
            {
                "s": [round(sn, 6), round(sl, 6)],
                "d": [round(dn, 6), round(dl, 6)],
                "pt": pt.isoformat(),
                "ht": ht.isoformat(),
                "dur": int((ht - pt).total_seconds()),
            }
        )

# 시간 0점을 최소 pt로
if rows:
    t0 = min(datetime.fromisoformat(r["pt"]) for r in rows)
    for r in rows:
        r["t0"] = int((datetime.fromisoformat(r["pt"]) - t0).total_seconds())
        del r["pt"]
        del r["ht"]

OUT.write_text(json.dumps(rows, separators=(",", ":"), ensure_ascii=False))
print(f"[✓] {len(rows)} rows → {OUT}  ({OUT.stat().st_size / 1024:.1f} KB)")
