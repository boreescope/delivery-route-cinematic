"""배달동선 실시간 폴러

5분마다 raw_log.serverlog_delivery_status_change에서
최근 완료된 배달 데이터를 가져와 output/realtime.json으로 저장.

사용법:
    python trino_poller.py                  # 1회 실행
    python trino_poller.py --loop           # 5분 간격 반복
    python trino_poller.py --interval 60    # 1분 간격 반복
    python trino_poller.py --minutes 10     # 최근 10분 데이터
"""

import json
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from trino.dbapi import connect
from trino.auth import BasicAuthentication

# .env 로드
for env_path in [
    Path.home() / ".kiro" / "secrets" / ".env",
    Path.home() / ".claude" / "secrets" / ".env",
]:
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())
        break

TRINO_HOST = os.environ.get("TRINO_HOST", "trino-auth.emr.ds.woowa.in")
TRINO_PORT = int(os.environ.get("TRINO_PORT", "443"))
TRINO_USER = os.environ.get("TRINO_USER", "")
TRINO_PASSWORD = os.environ.get("TRINO_PASSWORD", "")

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_FILE = OUTPUT_DIR / "realtime.json"

QUERY_TEMPLATE = """
SELECT
    ord_no,
    CAST(json_extract_scalar(details, '$.shopLocation.latitude') AS DOUBLE) AS shop_lat,
    CAST(json_extract_scalar(details, '$.shopLocation.longitude') AS DOUBLE) AS shop_lon,
    CAST(json_extract_scalar(details, '$.customerLocation.latitude') AS DOUBLE) AS dlvry_lat,
    CAST(json_extract_scalar(details, '$.customerLocation.longitude') AS DOUBLE) AS dlvry_lon,
    json_extract_scalar(details, '$.deliveryMethod') AS delivery_method,
    CAST(json_extract_scalar(details, '$.expectedDeliveryTime') AS INTEGER) AS expected_min,
    json_extract_scalar(details, '$.isSingle') AS is_single,
    json_extract_scalar(details, '$.agencyId') AS agency_id,
    CAST(json_extract_scalar(details, '$.expectedPickupDate') AS BIGINT) AS pickup_ts_ms,
    log_ts AS completed_ts
FROM raw_log.serverlog_delivery_status_change
WHERE log_ts BETWEEN (CURRENT_TIMESTAMP - INTERVAL '{minutes}' MINUTE) AT TIME ZONE 'Asia/Seoul'
                 AND CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul'
  AND event = 'DELIVERY_COMPLETED'
  AND json_extract_scalar(details, '$.shopLocation.latitude') IS NOT NULL
  AND json_extract_scalar(details, '$.customerLocation.latitude') IS NOT NULL
  AND json_extract_scalar(details, '$.expectedPickupDate') IS NOT NULL
LIMIT {limit}
"""


def get_connection():
    return connect(
        host=TRINO_HOST,
        port=TRINO_PORT,
        catalog="hive_zeppelin",
        schema="raw_log",
        http_scheme="https",
        user=TRINO_USER,
        auth=BasicAuthentication(TRINO_USER, TRINO_PASSWORD),
    )


def fetch_realtime(minutes: int = 5, limit: int = 5000) -> list[dict]:
    """최근 N분간 완료된 배달 데이터 조회"""
    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(QUERY_TEMPLATE.format(minutes=minutes, limit=limit))
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        return [dict(zip(columns, row)) for row in rows]
    finally:
        conn.close()


def save_json(data: list[dict]):
    """결과를 JSON으로 저장 (delivery_viewer.html이 읽을 형식)"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # viewer가 기대하는 CSV 호환 형식으로 변환
    kst = timezone(timedelta(hours=9))
    output = {
        "updated_at": datetime.now(kst).isoformat(),
        "count": len(data),
        "deliveries": [
            {
                "ord_no": d["ord_no"],
                "shop_lat": d["shop_lat"],
                "shop_lon": d["shop_lon"],
                "dlvry_lat": d["dlvry_lat"],
                "dlvry_lon": d["dlvry_lon"],
                "delivery_method": d["delivery_method"],
                "expected_min": d["expected_min"],
                "is_single": d["is_single"] == "true",
                "agency_id": d["agency_id"],
                "pickup_ts_ms": d["pickup_ts_ms"],
                "completed_ts": str(d["completed_ts"]),
            }
            for d in data
            if d["shop_lat"] and d["dlvry_lat"]
        ],
    }

    OUTPUT_FILE.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    return output["count"]


def poll_once(minutes: int = 5, limit: int = 5000):
    """1회 폴링"""
    kst = timezone(timedelta(hours=9))
    now = datetime.now(kst).strftime("%H:%M:%S")
    print(
        f"[{now}] 쿼리 실행 (최근 {minutes}분, limit {limit})...", end=" ", flush=True
    )
    try:
        data = fetch_realtime(minutes, limit)
        count = save_json(data)
        print(f"✅ {count}건 → {OUTPUT_FILE}")
    except Exception as e:
        print(f"❌ {type(e).__name__}: {e}")


def main():
    import argparse

    parser = argparse.ArgumentParser(description="배달동선 실시간 폴러")
    parser.add_argument("--loop", action="store_true", help="반복 실행")
    parser.add_argument(
        "--interval", type=int, default=300, help="폴링 간격 (초, 기본 300)"
    )
    parser.add_argument(
        "--minutes", type=int, default=60, help="조회 범위 (분, 기본 60)"
    )
    parser.add_argument("--limit", type=int, default=5000, help="최대 건수 (기본 5000)")
    args = parser.parse_args()

    if args.loop:
        print(f"🔄 실시간 폴링 시작 (간격: {args.interval}초, 범위: {args.minutes}분)")
        print(f"   출력: {OUTPUT_FILE}")
        print("   중지: Ctrl+C")
        print()
        while True:
            poll_once(args.minutes, args.limit)
            time.sleep(args.interval)
    else:
        poll_once(args.minutes, args.limit)


if __name__ == "__main__":
    main()
