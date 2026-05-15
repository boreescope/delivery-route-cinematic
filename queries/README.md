# 배달동선 리서치 — 쿼리 모음

자주 사용하는 쿼리를 `.sql` 파일로 관리합니다.
Kiro에서 Trino MCP를 통해 직접 실행하거나, `trino_utils.py`로 자동화할 수 있습니다.

## 파일 목록

| 파일 | 설명 |
|------|------|
| `delivery_by_region.sql` | 지역별 배달 데이터 조회 |
| `hourly_stats.sql` | 시간대별 배달 통계 |
| `data_freshness.sql` | 데이터 적재 지연 확인 |
| `top_routes.sql` | 인기 배달 경로 (매장→배달지) |

## 사용법

### Kiro MCP (대화형)
```
"송파구 오늘 11~14시 배달 데이터 500건 조회해줘"
→ Trino MCP가 자동으로 쿼리 실행
```

### CLI
```bash
python trino_utils.py --region 송파구 --hours 11-14 --limit 500
```

### Python
```python
from trino_utils import TrinoClient, get_region_code

client = TrinoClient(user="jinsol", password="...")
code, rtype = get_region_code("송파구")
df = client.query_delivery(region=code, region_type=rtype, hours=(11, 14))
```
