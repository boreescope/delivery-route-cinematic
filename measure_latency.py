"""raw_log 적재 지연 측정 — 1분마다 30회 (30분간)

최신 PICKUP_COMPLETED의 log_ts와 현재 시각의 차이를 기록.
"""

import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from trino.dbapi import connect
from trino.auth import BasicAuthentication

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

QUERY = """
SELECT 
    MAX(log_ts) as latest_log,
    COUNT(*) as cnt_1min
FROM raw_log.serverlog_delivery_status_change
WHERE log_ts BETWEEN (CURRENT_TIMESTAMP - INTERVAL '1' MINUTE) AT TIME ZONE 'Asia/Seoul'
                 AND CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul'
  AND event = 'PICKUP_COMPLETED'
  AND CAST(json_extract_scalar(details, '$.shopLocation.latitude') AS DOUBLE) BETWEEN 37.42 AND 37.70
LIMIT 1
"""


def measure_once():
    conn = connect(
        host="trino-auth.emr.ds.woowa.in",
        port=443,
        catalog="hive_zeppelin",
        schema="raw_log",
        http_scheme="https",
        user=os.environ["TRINO_USER"],
        auth=BasicAuthentication(
            os.environ["TRINO_USER"], os.environ["TRINO_PASSWORD"]
        ),
    )
    try:
        cur = conn.cursor()
        cur.execute(QUERY)
        row = cur.fetchone()
        return row  # (latest_log, cnt_1min)
    finally:
        conn.close()


def main():
    kst = timezone(timedelta(hours=9))
    print("시각(KST) | 최신log_ts | 지연(초) | 1분간건수")
    print("-" * 60)

    results = []
    for i in range(30):
        now = datetime.now(kst)
        try:
            latest_log, cnt = measure_once()
            if latest_log:
                # latest_log는 KST인데 +00:00 표기 → 그냥 숫자만 비교
                # now는 KST → UTC로 변환해서 비교
                now_utc = now.astimezone(timezone.utc)
                # latest_log의 시/분/초를 KST로 해석
                delay = (now_utc - latest_log).total_seconds()
                # 음수면 KST 표기 문제 → +9시간
                if delay < -3600:
                    delay += 9 * 3600
                results.append(delay)
                print(
                    f"{now.strftime('%H:%M:%S')} | "
                    f"{str(latest_log)[:19]} | "
                    f"{delay:6.0f}초 ({delay / 60:.1f}분) | "
                    f"{cnt}건"
                )
            else:
                print(f"{now.strftime('%H:%M:%S')} | 데이터 없음")
        except Exception as e:
            print(f"{now.strftime('%H:%M:%S')} | 에러: {e}")

        if i < 29:
            time.sleep(60)

    if results:
        print("\n" + "=" * 60)
        print(
            f"평균 지연: {sum(results) / len(results):.0f}초 ({sum(results) / len(results) / 60:.1f}분)"
        )
        print(f"최소: {min(results):.0f}초, 최대: {max(results):.0f}초")
        print(f"중앙값: {sorted(results)[len(results) // 2]:.0f}초")


if __name__ == "__main__":
    main()
