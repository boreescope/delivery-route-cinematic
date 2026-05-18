# 배달 동선 그래픽 로직 (delivery_viewer.html)

## 개요
OSRM 경로 좌표 배열을 받아서 "플레이체" 스타일의 애니메이션 경로를 그리는 로직.
단순 선이 아니라 **선 구간 + 점 구간**이 랜덤하게 혼합되어 실제 이동 궤적처럼 보임.

## 핵심 구성요소

### 1. 세그먼트 빌더 (`buildSegments`)
OSRM 경로 좌표 배열을 "선 구간"과 "점 구간"으로 분할.

```
입력: [coord0, coord1, coord2, ..., coordN] (OSRM 경로)
출력: [{type:'line', coords:[...]}, {type:'dots', coords:[...]}, ...]
```

**로직:**
- 좌표를 순회하면서 랜덤하게 구간 분할
- 기본적으로 `line` (연속 선) 구간으로 진행
- `BREAK_PROB = 0.02` (2%) 확률로 `dots` (점) 구간으로 전환
- 선 구간 최대 길이: `MAX_LINE_LEN = 50` 좌표
- 점 구간 길이: 2~7 좌표

### 2. 점 구간 보간 (`interpolateDots`)
두 좌표 사이를 보간하여 점 배열 생성. 혼잡도에 따라 간격 조절.

```
입력: from좌표, to좌표, congestion(0~1)
출력: [점1, 점2, ...] (보간된 점 배열)
```

**로직:**
- 두 점 사이 거리 계산 (미터 근사)
- `baseGap = 8 + random * 12` (기본 간격 8~20m)
- 혼잡도가 높으면 간격 좁힘: `gap = baseGap * (1 - congestion * 0.85)`
- 각 점에 미세한 랜덤 지터 적용 (직선 방지)

### 3. 경로 오프셋 (`offsetCoords`)
같은 경로가 겹치지 않도록 전체 좌표에 랜덤 오프셋 적용.

```
dx = (random - 0.5) * 0.0003  (~15m)
dy = (random - 0.5) * 0.0003
모든 좌표에 동일한 오프셋 적용
```

### 4. 애니메이션 (`animateRouteInternal`)
세그먼트별로 순차 애니메이션.

**선 구간:**
- `requestAnimationFrame`으로 점진적으로 path 좌표 추가
- duration에 비례하여 속도 결정
- 화면에 선이 "그려지는" 효과

**점 구간:**
- 각 점을 시간에 맞춰 하나씩 추가
- duration의 1.5배 시간 사용 (점 구간은 느리게)

**공통:**
- 시작점: 큰 dot (ENDPOINT_RADIUS = 4.5px)
- 끝점: 큰 dot (배달 도착 시 추가)
- 중간 점: 작은 dot (DOT_RADIUS = 2.5px)

## deck.gl 레이어 구성

| 레이어 | 역할 | 데이터 |
|--------|------|--------|
| PathLayer (outline) | 외곽선 (어두운 배경) | pathData |
| PathLayer (main) | 메인 경로 선 | pathData |
| ScatterplotLayer (dots) | 중간 점들 | dotData |
| ScatterplotLayer (endpoints) | 시작/끝 점 | endpointData |

## 스타일 상수

```javascript
const PATH_WIDTH = 5        // 선 두께 (px)
const DOT_RADIUS = 2.5      // 중간 점 크기 (px)
const ENDPOINT_RADIUS = 4.5 // 시작/끝 점 크기 (px)
const OUTLINE_ADD = 3       // 외곽선 추가 두께
const BREAK_PROB = 0.02     // 점 구간 전환 확률
const MAX_LINE_LEN = 50     // 선 구간 최대 좌표 수
```

## 색상 팔레트

60색 파스텔/네온 팔레트에서 랜덤 선택. 테마별 오버라이드:
- `default`: 랜덤 팔레트
- `rainbow`: HSL 균등 분배
- `mint`: 단일 색상 (#0CEFD3)

## 인터랙션

### 호버
- 해당 groupId의 경로 하이라이트 (밝게)
- 나머지 경로 어둡게 (opacity 160/255)
- 툴팁 표시

### 클릭
- 해당 경로 리플레이 (기존 데이터 제거 → 재애니메이션)

## 줌 스케일링
줌 레벨에 따라 선 두께/점 크기 조절:
```javascript
const sc = Math.pow(2, (zoom - 14) * 0.4)
// zoom 14 기준 1x, 줌인하면 커지고 줌아웃하면 작아짐
```

## 성능 최적화

- **throttle**: deck.gl 업데이트 최소 30ms 간격
- **visibility guard**: 탭 비활성 시 업데이트 스킵
- **탭 복귀**: `_skipAnimation = true` → 진행 중 애니메이션 즉시 완료
- **generation ID**: 새 데이터 로드 시 이전 애니메이션 전부 중단

## React 대시보드와의 차이

| 항목 | delivery_viewer.html | react_dashboard |
|------|---------------------|-----------------|
| 렌더링 | 세그먼트 애니메이션 (선+점 혼합) | 단순 PathLayer + 이동 dot |
| 스타일 | 플레이체 (dash+dot) | 깔끔한 단선 |
| 시간 | CSV 기반 재생 | 실시간 progress 계산 |
| 인터랙션 | 호버/클릭/리플레이 | 호버만 |
