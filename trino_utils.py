"""배달동선 리서치 — Trino 쿼리 자동화 유틸리티

사용법:
    from trino_utils import TrinoClient

    client = TrinoClient()  # 환경변수 또는 직접 인증
    df = client.query_delivery(date="2026-05-15", region="11680", hours=(11, 14), limit=500)
"""

import csv
import os
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pandas as pd
from trino.dbapi import connect
from trino.auth import BasicAuthentication


class TrinoClient:
    """배달동선 프로젝트용 Trino 클라이언트"""

    def __init__(
        self,
        host: str = "trino-auth.emr.ds.woowa.in",
        port: int = 443,
        catalog: str = "hive_zeppelin",
        schema: str = "sbbi",
        user: Optional[str] = None,
        password: Optional[str] = None,
    ):
        self.host = host
        self.port = port
        self.catalog = catalog
        self.schema = schema
        self.user = user or os.environ.get("TRINO_USER", "")
        self.password = password or os.environ.get("TRINO_PASSWORD", "")

    def _connect(self):
        kwargs = {
            "host": self.host,
            "port": self.port,
            "catalog": self.catalog,
            "schema": self.schema,
            "http_scheme": "https",
        }
        if self.user and self.password:
            kwargs["user"] = self.user
            kwargs["auth"] = BasicAuthentication(self.user, self.password)
        elif self.user:
            kwargs["user"] = self.user
        return connect(**kwargs)

    def execute(self, sql: str) -> pd.DataFrame:
        """SQL 실행 → DataFrame 반환"""
        conn = self._connect()
        try:
            cur = conn.cursor()
            cur.execute(sql)
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]
            return pd.DataFrame(rows, columns=columns)
        finally:
            conn.close()

    def query_delivery(
        self,
        date: str = None,
        region: str = None,
        region_type: str = "rgn2",
        hours: tuple[int, int] = (0, 23),
        limit: int = 1000,
    ) -> pd.DataFrame:
        """배달 데이터 조회

        Args:
            date: 조회 날짜 (YYYY-MM-DD). 기본: 오늘
            region: 지역 코드 (시군구 또는 광역시도)
            region_type: "rgn1" (광역시도) 또는 "rgn2" (시군구)
            hours: (시작시, 종료시) 튜플
            limit: 최대 건수
        """
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        conditions = [
            f"part_date = '{date}'",
            f"HOUR(pick_up_date) BETWEEN {hours[0]} AND {hours[1]}",
            "pick_up_date IS NOT NULL",
            "hand_over_date IS NOT NULL",
        ]

        if region:
            col = "dlvry_rgn1_cd" if region_type == "rgn1" else "dlvry_rgn2_cd"
            conditions.append(f"{col} = '{region}'")

        where = " AND ".join(conditions)

        sql = f"""
SELECT ord_no, shop_lat, shop_lon, dlvry_lat, dlvry_lon,
       pick_up_date, hand_over_date
FROM sbbi.bm_delivery_time_period
WHERE {where}
LIMIT {limit}
"""
        return self.execute(sql)

    def query_delivery_stats(
        self,
        date: str = None,
        region: str = None,
        region_type: str = "rgn2",
    ) -> pd.DataFrame:
        """시간대별 배달 통계"""
        if date is None:
            date = datetime.now().strftime("%Y-%m-%d")

        region_filter = ""
        if region:
            col = "dlvry_rgn1_cd" if region_type == "rgn1" else "dlvry_rgn2_cd"
            region_filter = f"AND {col} = '{region}'"

        sql = f"""
SELECT
    HOUR(pick_up_date) as hour,
    COUNT(*) as delivery_count,
    AVG(DATE_DIFF('minute', pick_up_date, hand_over_date)) as avg_delivery_min
FROM sbbi.bm_delivery_time_period
WHERE part_date = '{date}'
  AND pick_up_date IS NOT NULL
  AND hand_over_date IS NOT NULL
  {region_filter}
GROUP BY HOUR(pick_up_date)
ORDER BY hour
"""
        return self.execute(sql)

    def check_data_freshness(self) -> pd.DataFrame:
        """데이터 적재 지연 확인"""
        sql = """
SELECT
    MAX(pick_up_date) as latest_data,
    CURRENT_TIMESTAMP as now,
    DATE_DIFF('minute', MAX(pick_up_date), CURRENT_TIMESTAMP) as delay_minutes
FROM sbbi.bm_delivery_time_period
WHERE part_date = CURRENT_DATE
"""
        return self.execute(sql)

    def save_csv(
        self, df: pd.DataFrame, filename: str, output_dir: str = "output"
    ) -> Path:
        """DataFrame을 CSV로 저장"""
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / filename
        df.to_csv(path, index=False)
        return path


# ─── 지역 코드 매핑 ─────────────────────────────────────
REGION_CODES = {
    # 서울 구별 코드 (시군구)
    "강남구": "11680",
    "강동구": "11740",
    "강북구": "11305",
    "강서구": "11500",
    "관악구": "11620",
    "광진구": "11215",
    "구로구": "11530",
    "금천구": "11545",
    "노원구": "11350",
    "도봉구": "11320",
    "동대문구": "11230",
    "동작구": "11590",
    "마포구": "11440",
    "서대문구": "11410",
    "서초구": "11650",
    "성동구": "11200",
    "성북구": "11290",
    "송파구": "11710",
    "양천구": "11470",
    "영등포구": "11560",
    "용산구": "11170",
    "은평구": "11380",
    "종로구": "11110",
    "중구": "11140",
    "중랑구": "11260",
    # 광역시도 코드
    "서울": "11",
    "부산": "26",
    "대구": "27",
    "인천": "28",
    "광주": "29",
    "대전": "30",
    "울산": "31",
    "경기": "41",
}


def get_region_code(name: str) -> tuple[str, str]:
    """지역명 → (코드, 타입) 반환

    Returns:
        (code, "rgn1" or "rgn2")
    """
    code = REGION_CODES.get(name)
    if code is None:
        raise ValueError(
            f"알 수 없는 지역: {name}. 사용 가능: {list(REGION_CODES.keys())}"
        )
    return (code, "rgn1" if len(code) == 2 else "rgn2")


# ─── CLI ────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="배달동선 Trino 쿼리")
    parser.add_argument("--date", default=None, help="조회 날짜 (YYYY-MM-DD)")
    parser.add_argument("--region", default="송파구", help="지역명 (예: 송파구, 서울)")
    parser.add_argument("--hours", default="11-14", help="시간 범위 (예: 11-14)")
    parser.add_argument("--limit", type=int, default=1000, help="최대 건수")
    parser.add_argument("--output", default="output", help="출력 디렉토리")
    parser.add_argument("--user", default=None, help="AD 계정 ID")
    parser.add_argument("--password", default=None, help="AD 계정 비밀번호")
    args = parser.parse_args()

    hours = tuple(int(h) for h in args.hours.split("-"))
    code, rtype = get_region_code(args.region)

    client = TrinoClient(user=args.user, password=args.password)
    print(
        f"쿼리 실행: {args.region}({code}), {args.date or '오늘'}, {hours[0]}~{hours[1]}시"
    )

    df = client.query_delivery(
        date=args.date,
        region=code,
        region_type=rtype,
        hours=hours,
        limit=args.limit,
    )

    filename = f"delivery_{args.region}_{args.date or 'today'}.csv"
    path = client.save_csv(df, filename, args.output)
    print(f"완료! {len(df)}건 → {path}")
