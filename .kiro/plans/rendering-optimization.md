# 렌더링 전략 개선 계획

## 현재 문제

1. **레이어 폭발**: 그룹(경로)당 4개 레이어 (outline, path, dot, endpoint) → 500건이면 ~2000개 레이어. deck.gl은 레이어 수에 비례해서 느려짐
2. **매 프레임 전체 재구성**: `updateDeckLayers()`가 호출될 때마다 전체 데이터를 그룹별로 분류 → Map 생성 → sort → 2000개 레이어 new 생성
3. **탭 복귀 폭주**: `requestAnimationFrame` 콜백이 탭 비활성 중 멈췄다가 복귀 시 한꺼번에 실행. 각 콜백이 `scheduleDeckUpdate()` 호출 → 한 프레임에 수십 개 애니메이션이 동시에 데이터 push + 레이어 재구성

## 개선 전략

### A. 레이어 통합 (가장 큰 임팩트)

그룹별 레이어 → 타입별 통합 레이어 4개로 축소:
- `PathLayer` (outline) — 전체 pathData
- `PathLayer` (fill) — 전체 pathData
- `ScatterplotLayer` (dots) — 전체 dotData
- `ScatterplotLayer` (endpoints) — 전체 endpointData

하이라이트(hover/click)는 `getColor`/`getWidth`의 accessor에서 `groupId` 비교로 이미 처리 중이므로 통합해도 동작 동일. `updateTriggers`만 잘 걸어주면 됨.

그룹 z-order(생성 순서)는 현재 레이어 순서로 구현되어 있는데, 통합하면 데이터 배열 내 순서로 자연스럽게 유지됨 (먼저 push된 데이터가 먼저 그려짐).

### B. 업데이트 throttle 강화

현재 `scheduleDeckUpdate`는 `requestAnimationFrame` 1회 debounce인데, 탭 복귀 시 rAF 콜백이 한꺼번에 실행되면서 `updateDeckLayers`가 여러 번 호출될 수 있음.

- 최소 간격 throttle 추가 (예: 30ms)
- `document.hidden` 체크: 탭 비활성 중에는 deck 업데이트 스킵, 복귀 시 1회만 실행

### C. 탭 복귀 시 애니메이션 즉시 완료

`visibilitychange` 이벤트 감지 → 탭 복귀 시 진행 중인 모든 애니메이션을 즉시 완료 상태로 전환. 이렇게 하면 복귀 후 수십 개 rAF 루프가 돌지 않고 한 번에 최종 상태로 점프.

## 구현 순서

1. `updateDeckLayers()` 리팩터: 그룹별 레이어 → 타입별 4개 통합 레이어
2. `scheduleDeckUpdate()` throttle 강화 + `document.hidden` 가드
3. `visibilitychange` 핸들러: 탭 복귀 시 진행 중 애니메이션 즉시 완료
