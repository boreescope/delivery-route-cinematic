"""배달동선 실시간 API 서버

프론트에서 /api/poll 호출 → 즉시 Trino 쿼리 → JSON 반환
프론트에서 /api/status 호출 → 마지막 폴링 상태 반환

사용법:
    python api_server.py          # 포트 8000
    python api_server.py --port 8001
"""

import json
import os
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse

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

# Secret 파일 마운트 지원 (/mnt/secrets/trino-user, /mnt/secrets/trino-password)
_secret_dir = Path("/mnt/secrets")
if not TRINO_USER and (_secret_dir / "trino-user").exists():
    TRINO_USER = (_secret_dir / "trino-user").read_text().strip()
if not TRINO_PASSWORD and (_secret_dir / "trino-password").exists():
    TRINO_PASSWORD = (_secret_dir / "trino-password").read_text().strip()

QUERY_TEMPLATE = """
SELECT
    ord_no,
    event,
    log_ts,
    CAST(json_extract_scalar(details, '$.shopLocation.latitude') AS DOUBLE) AS shop_lat,
    CAST(json_extract_scalar(details, '$.shopLocation.longitude') AS DOUBLE) AS shop_lon,
    CAST(json_extract_scalar(details, '$.customerLocation.latitude') AS DOUBLE) AS dlvry_lat,
    CAST(json_extract_scalar(details, '$.customerLocation.longitude') AS DOUBLE) AS dlvry_lon,
    json_extract_scalar(details, '$.deliveryMethod') AS delivery_method,
    json_extract_scalar(details, '$.isSingle') AS is_single
FROM raw_log.serverlog_delivery_status_change
WHERE log_ts BETWEEN (CURRENT_TIMESTAMP - INTERVAL '{minutes}' MINUTE) AT TIME ZONE 'Asia/Seoul'
                 AND CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul'
  AND event IN ('PICKUP_COMPLETED', 'DELIVERY_COMPLETED')
  AND json_extract_scalar(details, '$.shopLocation.latitude') IS NOT NULL
  AND json_extract_scalar(details, '$.customerLocation.latitude') IS NOT NULL
  AND CAST(json_extract_scalar(details, '$.shopLocation.latitude') AS DOUBLE) BETWEEN 37.42 AND 37.70
  AND CAST(json_extract_scalar(details, '$.shopLocation.longitude') AS DOUBLE) BETWEEN 126.76 AND 127.18
LIMIT {limit}
"""

# 캐시 (같은 요청 반복 방지)
_cache = {"data": None, "ts": 0}
CACHE_TTL = 60  # 1분 이내 재요청은 캐시 반환


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


def fetch_data(minutes: int = 30, limit: int = 100000) -> dict:
    now = time.time()
    if _cache["data"] and (now - _cache["ts"]) < CACHE_TTL:
        return _cache["data"]

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(QUERY_TEMPLATE.format(minutes=minutes, limit=limit))
        columns = [desc[0] for desc in cur.description]
        rows = cur.fetchall()
        raw = [dict(zip(columns, row)) for row in rows]
    finally:
        conn.close()

    # ord_no별 그룹핑
    orders: dict = {}
    for d in raw:
        if not d["shop_lat"] or not d["dlvry_lat"]:
            continue
        ono = d["ord_no"]
        if ono not in orders:
            orders[ono] = {
                "ord_no": ono,
                "shop_lat": d["shop_lat"],
                "shop_lon": d["shop_lon"],
                "dlvry_lat": d["dlvry_lat"],
                "dlvry_lon": d["dlvry_lon"],
                "delivery_method": d["delivery_method"],
                "is_single": d["is_single"] == "true",
                "pickup_ms": None,
                "completed_ms": None,
            }
        ts_ms = (
            int(d["log_ts"].timestamp() * 1000)
            if hasattr(d["log_ts"], "timestamp")
            else None
        )
        if d["event"] == "PICKUP_COMPLETED":
            orders[ono]["pickup_ms"] = ts_ms
        elif d["event"] == "DELIVERY_COMPLETED":
            orders[ono]["completed_ms"] = ts_ms

    # pickup이 있는 건만 반환
    deliveries = [v for v in orders.values() if v["pickup_ms"]]

    kst = timezone(timedelta(hours=9))
    output = {
        "updated_at": datetime.now(kst).isoformat(),
        "count": len(deliveries),
        "deliveries": deliveries,
    }

    _cache["data"] = output
    _cache["ts"] = now
    return output


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/poll":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            try:
                data = fetch_data()
                self.wfile.write(
                    json.dumps(data, ensure_ascii=False, default=str).encode()
                )
            except Exception as e:
                err = {"error": f"{type(e).__name__}: {e}"}
                self.wfile.write(json.dumps(err).encode())

        elif path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            status = {
                "cache_age": int(time.time() - _cache["ts"]) if _cache["ts"] else None,
                "cached_count": _cache["data"]["count"] if _cache["data"] else 0,
            }
            self.wfile.write(json.dumps(status).encode())

        elif path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"status":"ok"}')

        else:
            # 정적 파일 서빙 (React 빌드 결과물)
            self._serve_static(path)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.end_headers()

    def _serve_static(self, path: str):
        """React 빌드 결과물 서빙 (SPA fallback 포함)"""
        static_dir = Path(__file__).parent / "static"
        if path == "/":
            path = "/index.html"
        file_path = static_dir / path.lstrip("/")

        # SPA fallback: 파일 없으면 index.html
        if not file_path.exists() or not file_path.is_file():
            file_path = static_dir / "index.html"

        if not file_path.exists():
            self.send_response(404)
            self.end_headers()
            return

        # MIME type
        ext = file_path.suffix.lower()
        mime_map = {
            ".html": "text/html",
            ".js": "application/javascript",
            ".css": "text/css",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".ico": "image/x-icon",
            ".woff2": "font/woff2",
            ".woff": "font/woff",
            ".ttf": "font/ttf",
        }
        content_type = mime_map.get(ext, "application/octet-stream")

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.end_headers()
        self.wfile.write(file_path.read_bytes())

    def log_message(self, format, *args):
        kst = timezone(timedelta(hours=9))
        now = datetime.now(kst).strftime("%H:%M:%S")
        print(f"[{now}] {args[0]}")


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def main():
    import argparse

    parser = argparse.ArgumentParser(description="배달동선 실시간 API 서버")
    parser.add_argument("--port", type=int, default=8000, help="포트 (기본 8000)")
    args = parser.parse_args()

    server = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    print(f"🚀 API 서버 시작: http://localhost:{args.port}")
    print("   /api/poll   — Trino 쿼리 실행 + JSON 반환")
    print("   /api/status — 캐시 상태")
    print("   중지: Ctrl+C")
    server.serve_forever()


if __name__ == "__main__":
    main()
