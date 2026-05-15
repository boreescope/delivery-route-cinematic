# 배달동선 데이터 — 쿼리 자동화 리서치 정리

## 목표
매장→배달지 경로를 실시간으로 지도에 시각화하는 대시보드 구축.
보유 데이터: 매장 좌표, 배달지 좌표, 주문 시각, 도착 시간 (제플린 쿼리로 추출).

---

## 1. 실시간 데이터 소스

### A. SQS — 라이더 실시간 위치
- **큐**: `delivery-trace-rider-location-queue`
- **데이터**: 라이더 GPS 좌표 (위도/경도), 배달번호, 라이더ID
- **주기**: ~1초
- **방식**: API 호출이 아님. SQS Consumer가 큐를 Polling하여 메시지 수신
- **흐름**: 라이더 앱 → SNS Topic → SQS Queue → Consumer

### B. Kafka — 배달 위치 이벤트
- **토픽**: `delivery-location-logs` (streamId)
- **데이터**: eventType `DeliveryLocation`, 픽업지/전달지 H3 인덱스 (Level 5~12)
- **발행 시점**: 배달 완료 또는 취소 시
- **방식**: Kafka Consumer가 Topic 구독
- **처리**: Starrocks에서 실시간 입수 → Iceberg 테이블 적재

### C. 비교

| 항목 | SQS | Kafka |
|------|-----|-------|
| 수신 방식 | Consumer (Pull) | Consumer (Subscribe) |
| API 호출? | ❌ | ❌ |
| 실시간성 | ~1초 | 이벤트 발생 시점 |
| 전달 | 1:1 (한 명만 받음) | 1:N (여러 명 동시) |
| 메시지 삭제 | 읽으면 삭제 | 계속 보관 |

---

## 2. 데이터 지연 시간 (실시간성)

**핵심: 제플린 쿼리는 진짜 실시간이 아님**

```
실제 주문 발생
  ↓ (실시간)
운영 DB (RDS)
  ↓ (5~30분 지연) ← 병목
데이터 웨어하우스 (Hive/Iceberg)
  ↓ (제플린 쿼리)
대시보드
```

### 테이블별 지연

| 테이블 유형 | 지연 | 예시 |
|------------|------|------|
| 실시간 (raw_log) | 1~5분 | `raw_log.serverlog_delivery_status_change` |
| 배치 (시간) | 30분~1시간 | `market.bm_order` |
| 배치 (일) | 수 시간 | `dsdw.order_master` |

### 지연 확인 쿼리
```sql
-- 실시간 테이블
SELECT MAX(log_ts) as latest, NOW() as now,
       TIMESTAMPDIFF(MINUTE, MAX(log_ts), NOW()) as delay_min
FROM raw_log.serverlog_delivery_status_change;

-- 배치 테이블
SELECT MAX(order_time) as latest, NOW() as now,
       TIMESTAMPDIFF(MINUTE, MAX(order_time), NOW()) as delay_min
FROM dsdw.order_master WHERE order_date = CURRENT_DATE;
```

---

## 3. 제플린 API 호출

제플린 REST API는 존재하지만 **대시보드용으로 비권장**:
- 쿼리 실행 시간 느림 (수십 초~수 분)
- 동시 실행 제한
- 타임아웃 위험

**대안**: Airflow로 캐시 테이블 생성 → 대시보드에서 캐시 조회

---

## 4. 구현 옵션 비교

| 옵션 | 지연 | 난이도 | 권한 신청 |
|------|------|--------|-----------|
| 제플린 수동 쿼리 + Folium | 5~10분 | 쉬움 | 불필요 |
| **Airflow 캐시 + Streamlit (권장)** | 10~15분 | 중간 | 스키마 권한 |
| Kafka 실시간 스트리밍 | 1~5초 | 어려움 | Kafka + 개인정보 승인 |
| 서비스 API 직접 호출 | ~1초 | 어려움 | API + 개인정보 승인 |

---

## 5. 현재 사용 중인 쿼리

`delivery_viewer.html`의 쿼리 빌더가 생성하는 쿼리:

```sql
SELECT ord_no, shop_lat, shop_lon, dlvry_lat, dlvry_lon, pick_up_date, hand_over_date
FROM sbbi.bm_delivery_time_period
WHERE part_date = '{날짜}'
  AND dlvry_rgn1_cd = '{광역시도코드}'   -- 또는 dlvry_rgn2_cd = '{시군구코드}'
  AND HOUR(pick_up_date) BETWEEN {시작시} AND {종료시}
  AND pick_up_date IS NOT NULL
  AND hand_over_date IS NOT NULL
LIMIT {건수}
```

**테이블**: `sbbi.bm_delivery_time_period`
**컬럼**: ord_no, shop_lat, shop_lon, dlvry_lat, dlvry_lon, pick_up_date, hand_over_date
**필터**: part_date, dlvry_rgn1_cd/dlvry_rgn2_cd, HOUR(pick_up_date)

### 이 테이블의 적재 주기 확인 방법
```sql
-- 제플린에서 실행
SELECT MAX(pick_up_date) as latest, NOW() as now,
       TIMESTAMPDIFF(MINUTE, MAX(pick_up_date), NOW()) as delay_min
FROM sbbi.bm_delivery_time_period
WHERE part_date = CURRENT_DATE;
```

> `sbbi.*` 테이블은 보통 **시간 배치 (30분~1시간 지연)** 수준.
> 이 지연이 허용 가능하면 Airflow 캐시 방식으로 충분.

---

## 6. 권장 방안: Airflow 캐시 테이블

### DAG 코드 (실제 작동 버전)

```python
from airflow import DAG
from airflow.providers.trino.operators.trino import TrinoOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'jinsol',
    'depends_on_past': False,
    'start_date': datetime(2026, 4, 28),
    'email_on_failure': True,
    'email': ['jinsol@woowahan.com'],
    'retries': 2,
    'retry_delay': timedelta(minutes=2),
}

with DAG(
    dag_id='delivery_dashboard_cache_v1',
    default_args=default_args,
    description='배달 현황 집계 캐시 (10분마다)',
    schedule_interval='*/10 * * * *',
    catchup=False,
    tags=['dashboard', 'delivery', 'cache']
) as dag:

    update_cache = TrinoOperator(
        task_id='update_delivery_cache',
        trino_conn_id='trino_default',
        sql="""
        INSERT INTO your_team_schema.delivery_dashboard_cache
        SELECT
            json_extract_scalar(data, '$.pickupH3Index.level5') as region_h3,
            COUNT(*) as delivery_count,
            CURRENT_TIMESTAMP as updated_at
        FROM raw_log.serverlog_delivery_status_change
        WHERE date(log_ts) = CURRENT_DATE
          AND log_ts >= NOW() - INTERVAL '1' HOUR
          AND json_extract_scalar(data, '$.status') IN (
              'DELIVERING', 'PICKUP_PREPARE_REQUESTED',
              'STORE_ARRIVED', 'PICKED_UP'
          )
        GROUP BY json_extract_scalar(data, '$.pickupH3Index.level5')
        """
    )

    cleanup = TrinoOperator(
        task_id='cleanup_old_cache',
        trino_conn_id='trino_default',
        sql="""
        DELETE FROM your_team_schema.delivery_dashboard_cache
        WHERE updated_at < NOW() - INTERVAL '1' DAY
        """
    )

    update_cache >> cleanup
```

### 캐시 테이블 DDL
```sql
CREATE TABLE IF NOT EXISTS your_team_schema.delivery_dashboard_cache (
    region_h3 VARCHAR,
    delivery_count BIGINT,
    updated_at TIMESTAMP
) WITH (format = 'PARQUET');
```

### 대시보드 조회
```python
df = pd.read_sql("""
    SELECT region_h3, delivery_count, updated_at
    FROM your_team_schema.delivery_dashboard_cache
    WHERE updated_at >= NOW() - INTERVAL '15' MINUTE
    ORDER BY delivery_count DESC
""", engine)
```

---

## 6. H3 인덱스 개념

지구를 육각형으로 나눈 각 조각의 고유 ID. Level로 크기 조절.

| Level | 크기 | 비유 |
|-------|------|------|
| 5 | ~252 km² | 구(區) 단위 |
| 7 | ~5 km² | 동네 (역삼동) |
| 9 | ~0.1 km² | 아파트 단지 |
| 12 | ~0.0009 km² | 건물 하나 |

```python
import h3

# 위경도 → H3
h3_index = h3.geo_to_h3(37.4979, 127.0276, 7)  # "87283473fffffff"

# H3 → 위경도
lat, lng = h3.h3_to_geo(h3_index)

# 이웃 찾기
neighbors = h3.k_ring(h3_index, 1)
```

### 서울 필터링
```python
SEOUL_H3_LEVEL5 = [
    "85283473fffffff",  # 강남구
    "85283477fffffff",  # 서초구
    "8528347bfffffff",  # 송파구
    # ... 25개 구
]

def is_seoul(event):
    return event['pickupH3Index']['level5'] in SEOUL_H3_LEVEL5
```

---

## 7. 보안/개인정보 검토

### 안전한 방식 (승인 쉬움)
- H3 Level 5~7 집계 데이터만 사용
- 라이더 ID/이름 없음
- 개별 주문이 아닌 지역별 통계

### 위험한 방식 (승인 어려움)
- 실시간 라이더 위치 추적
- 라이더 이름/ID + 위치 매핑
- 개인 동선 추적

### 승인 필요 시 문의처
- 개인정보: `#support-개인정보` 또는 `#support-정보보호`
- 데이터거버넌스: `#support-데이터서비스실-개발`

---

## 8. 사전 신청 필요 여부

| 항목 | 신청 필요? | 방법 |
|------|-----------|------|
| DAG 기본 구조 | ❌ | 직접 코드 작성 |
| 쿼리 작성 | ❌ | 제플린에서 테스트 |
| Airflow Connection | ❌ | 기본 제공 (`trino_default`) |
| 캐시 테이블 생성 | ⚠️ 경우에 따라 | 팀 스키마 있으면 불필요 |
| 스키마 쓰기 권한 | ✅ 필수 | JIRA DATAAUTH |
| 스키마 생성 (없는 경우) | ✅ | `#support-데이터거버넌스` |

### 스키마 쓰기 권한 신청
- JIRA: `DATAAUTH` → [TRINO] 스키마쓰기권한요청
- 링크: https://cloud.jira.woowa.in/jira/software/c/projects/DATAAUTH/form/414
- 필요 정보: 부서명, 이름, email, AD계정, 스키마명, 사유, 사용기간
- **직속조직장 승인 필요**

### 스키마 생성 신청 (팀 스키마 없는 경우)
- 슬랙: `#support-데이터거버넌스`
- 또는 JIRA `DATAAUTH` → [TRINO] 스키마 생성 요청
- 소요: 3~5일

---

## 9. Kafka/SQS 접근 권한

### SQS
- AWS 계정 접근: https://auth-admin.baemin.in/projects/199/authority-request
- SQS 큐 접근: `#support-cloudinfra`에 문의
- 가이드: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/112736666

### Kafka `delivery-location-logs` 구독 절차

#### Step 1: 시스템 계정 생성
- 토픽 매니저 접속: https://console.woowa.in/topic-manager
- 좌측 메뉴 → "시스템 계정" 클릭
- 실제 Consumer 애플리케이션이 사용할 IAM Role로 생성
- ⚠️ 브로커 시스템 계정(예: `xxx-kafka:prod`)이 아닌, 실제 앱 Role로 생성

#### Step 2: 토픽 권한 신청
- 토픽 매니저 → "시스템 권한 신청" → "토픽 권한 신청하기"
- 클라이언트 유형: **Consumer** 선택
- 대상 토픽: `delivery-location-logs`
- 생성한 시스템 계정 선택
- 승인 대기: 토픽 관리자 + 카프카서비스파트

#### Step 3: 개인정보 승인
- H3 집계 데이터만 사용 → 개인정보 이슈 적어 승인 쉬움
- 원본 위경도 필요 시 → 별도 개인정보 처리 승인 필요
- 신청 시 "H3 집계 데이터만 사용" 목적 명시

#### Step 4: VPN 연결
- 사내 카프카 클러스터는 VPN 필수
- VPN 설정: `#support-woowanet` 채널 문의

#### Step 5: Consumer 인프라
- 기존 팀 서버/EKS 있으면 거기에 Consumer 추가
- 신규 필요 시: `#support-cloudinfra`에서 AWS 계정 신청 → EKS/EC2 구성

#### Step 6: 보안 클러스터 인증 설정 (클라이언트 측)

2025-01-01 이후 신규 클러스터는 보안 설정 기본 적용. 기존 클러스터도 전환 중.

**인증 흐름:**
1. 시스템 계정 발급 (Step 1에서 완료)
2. 토픽 권한 신청 (Step 2에서 완료)
3. 클라이언트에 인증 설정 적용:

```properties
# client.properties (Consumer용)
security.protocol=SASL_PLAINTEXT
sasl.mechanism=PLAIN
sasl.jaas.config=org.apache.kafka.common.security.plain.PlainLoginModule required \
  username="발급받은-계정" \
  password="발급받은-비밀번호";
```

**권한 신청 시 필요 정보 (Consumer):**
- 카프카 클러스터 이름
- 카프카 클러스터 존(Zone)
- 토픽 이름: `delivery-location-logs`
- 계정 이름 (시스템 계정)
- 컨슈머 그룹 이름
- 토픽 소유자 승인 내역

> ⚠️ 스트림즈/커넥터 클라이언트는 아직 미지원. Consumer/Producer만 가능.

#### 카프카 적용 시 필수 확인사항

**컨슈머 설정:**
- 수동 커밋 사용 (`enable.auto.commit=false`) — 재처리 범위 산정 용이
- 멱등성 고려 — At least once 방식이라 중복 발생 가능
- `max.poll.records` (기본 500건) / `max.poll.interval.ms` (기본 5분) 조정
  - 외부 시스템 연동이나 메시지 크기 큰 경우 리밸런싱 방지 위해 조정 필요
- LAG 모니터링 구성 필수

**토픽 관리:**
- 메시지 유지 기간: 기본 1일 (1일 지나면 복구 불가)
- 파티션 수: 운영 권장 12개, 늘릴 때 3의 배수로
- 메시지 키: 카디널리티 높은 값 (주문번호 등)

**프로듀서 설정 (참고):**
- 압축 코덱: 클러스터 2.8.2 → `zstd` 권장

#### 참고 문서
- 토픽 권한 신청 가이드: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/112796818
- 보안 클러스터 사용 가이드: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/424185152
- 카프카 적용 시 필수 확인: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/112770130

#### 문의 채널
- 카프카: `#support-kafka`
- 인프라: `#support-cloudinfra`
- 딜리버리 데이터: `#wg-딜리버리x라이더-개발`

### 연결 정보
```
SQS:
  큐: delivery-trace-rider-location-queue
  리전: ap-northeast-2
  인증: IAM Role (IRSA) 또는 Access Key

Kafka:
  베타: xxx-kafka.platform.betabaemin.in:9093
  운영: xxx-kafka.platform.baemin.in:9093
  인증: SASL_PLAINTEXT / PLAIN
```

### 로컬 테스트
- VPN 연결 필수
- Kafka 테스트:
```bash
kafka-console-consumer \
  --bootstrap-server xxx-kafka.platform.betabaemin.in:9093 \
  --topic delivery-location-logs \
  --consumer.config client.properties
```

---

## 10. 데이터 스키마 (예상)

### SQS 메시지 (라이더 위치)
```json
{
  "riderId": "12345",
  "deliveryId": "20260428-ABCD1234",
  "latitude": 37.5665,
  "longitude": 126.9780,
  "timestamp": "2026-04-28T12:00:00Z",
  "deliveryStatus": "DELIVERING"
}
```

### Kafka 이벤트 (배달 위치)
```json
{
  "eventType": "DeliveryLocation",
  "deliveryId": "20260428-ABCD1234",
  "pickupH3Index": {
    "level5": "85283473fffffff",
    "level7": "87283473fffffff",
    "level9": "89283473fffffff",
    "level12": "8c283473fffffff"
  },
  "deliveryH3Index": {
    "level5": "85283477fffffff",
    "level7": "87283477fffffff",
    "level9": "89283477fffffff",
    "level12": "8c283477fffffff"
  },
  "timestamp": "2026-04-28T12:00:00Z"
}
```

---

## 11. 최단 경로 계산 (외부 라이브러리)

### OSRM (무료, 권장)
```python
import requests

def get_route(start_lat, start_lng, end_lat, end_lng):
    url = f"http://router.project-osrm.org/route/v1/driving/{start_lng},{start_lat};{end_lng},{end_lat}"
    params = {"overview": "full", "geometries": "geojson"}
    resp = requests.get(url, params=params).json()
    if resp['code'] == 'Ok':
        route = resp['routes'][0]
        return {
            'distance': route['distance'],       # 미터
            'duration': route['duration'],       # 초
            'geometry': route['geometry']['coordinates']
        }
```

### Haversine (직선 거리, 간단)
```python
from math import radians, cos, sin, asin, sqrt

def haversine(lat1, lng1, lat2, lng2):
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    return 6371 * 2 * asin(sqrt(a))  # km
```

---

## 12. 추천 실행 플랜

### 1주 프로토타입 (신청 불필요)

| Day | 작업 |
|-----|------|
| 1 | temp 스키마로 캐시 테이블 테스트 |
| 2-3 | DAG 작성 + 제플린 쿼리 검증 |
| 4-5 | 대시보드 구축 (Folium/Streamlit) |
| 6-7 | 데모 및 피드백 |

### 운영 환경 (병렬 진행)

| Week | 작업 |
|------|------|
| 1 | 스키마 생성 신청 (`#support-데이터거버넌스`) |
| 2 | 스키마 쓰기 권한 신청 (JIRA DATAAUTH) |
| 3 | 운영 테이블 생성 |
| 4 | DAG 마이그레이션 (temp → 운영) |

---

## 13. Trino CLI 로컬 실행 가이드

### 설치

```bash
# Trino CLI JAR 다운로드
curl -o trino https://repo1.maven.org/maven2/io/trino/trino-cli/435/trino-cli-435-executable.jar
chmod +x trino
```

> Java 11+ 필요. 없으면: `brew install openjdk@11`

### 접속 (VPN 필수)

```bash
./trino --server https://trino-gateway-auth.ds.woowa.in \
        --user jinsol@woowa.in \
        --catalog hive \
        --schema sbbi
```

- 실행하면 브라우저가 열리면서 사내 AD 인증 페이지로 이동
- 로그인 완료 후 CLI에서 쿼리 실행 가능

### 쿼리 실행

```bash
# 대화형
./trino --server https://trino-gateway-auth.ds.woowa.in --user jinsol@woowa.in

# 파일 실행
./trino --server https://trino-gateway-auth.ds.woowa.in \
        --user jinsol@woowa.in \
        --file query.sql

# CSV 출력
./trino --server https://trino-gateway-auth.ds.woowa.in \
        --user jinsol@woowa.in \
        --output-format CSV \
        --file query.sql > result.csv
```

### 유용한 명령어

```sql
SHOW CATALOGS;
SHOW SCHEMAS FROM hive;
SHOW TABLES FROM sbbi;
DESCRIBE sbbi.bm_delivery_time_period;
```

### 트러블슈팅
- 인증 에러: 터미널에 표시된 URL을 브라우저에 직접 붙여넣기
- VPN 확인: `ping trino-gateway-auth.ds.woowa.in`
- Trino UI: https://trino-gateway-auth.ds.woowa.in/ui/

---
- 배달현황 지도 구현: https://cloud.wiki.woowa.in/wiki/spaces/BMAPPDEV/pages/1104741477
- Kafka 보안 클러스터: https://cloud.wiki.woowa.in/wiki/x/QI1IGQ
- 토픽 매니저 사용법: https://cloud.wiki.woowa.in/wiki/x/Suu4Bg
- AWS 권한 신청: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/112736666
- 데이터카탈로그: https://datacatalog.woowa.in/

## 참고 문서
- 배달현황 지도 구현: https://cloud.wiki.woowa.in/wiki/spaces/BMAPPDEV/pages/1104741477
- Kafka 보안 클러스터: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/424185152
- 카프카 적용 시 필수 확인: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/112770130
- 토픽 권한 신청: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/112796818
- AWS 권한 신청: https://cloud.wiki.woowa.in/wiki/spaces/TECHSTANDARD/pages/112736666
- 데이터카탈로그: https://datacatalog.woowa.in/
- Trino CLI 공식 문서: https://trino.io/docs/current/client/cli.html
