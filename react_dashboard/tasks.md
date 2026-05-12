# Tasks — 배달 동선 시각화 대시보드

spec: /Users/jinsol/Documents/리서치_260410_배달동선/react_dashboard/spec.md

## Task 1: 프로젝트 초기화 [pending]

- [x] 1.1: Vite + React + TypeScript 프로젝트 생성 (`react_dashboard/` 내부)
- [x] 1.2: MapLibre GL JS + deck.gl + Zustand 설치
- [x] 1.3: 기본 전체화면 지도 렌더링 (CARTO DarkMatter 타일)
- [x] 1.4: 폴더 구조 세팅 (components/, layers/, store/, utils/, types.ts)
- [ ] 1.5: 개발 서버 실행 확인 (vite dev)

## Task 2: CSV 업로드 + Point/Arc 레이어 [pending]
depends: [1]

- [ ] 2.1: CSV 드래그앤드롭 업로드 컴포넌트 (FileUpload.tsx)
- [ ] 2.2: CSV 파싱 + 위도/경도 컬럼 자동 감지 (utils/csv.ts)
- [ ] 2.3: Zustand 스토어 설계 (데이터, 레이어 상태, 필터)
- [ ] 2.4: PointLayer 구현 (매장/고객 위치 점)
- [ ] 2.5: ArcLayer 구현 (매장→고객 직선 연결)
- [ ] 2.6: LayerPanel 컴포넌트 (레이어 on/off 토글)
- [ ] 2.7: 샘플 데이터 내장 (public/sample_data.csv) + 첫 접속 시 자동 로드
- [ ] 2.8: 호버 툴팁 (건별 정보 표시)

## Task 3: Heatmap/Hexbin/Cluster 레이어 [pending]
depends: [2]

- [ ] 3.1: HeatmapLayer 구현 (배달 밀집도)
- [ ] 3.2: HexagonLayer 구현 (건수/평균 소요시간 집계)
- [ ] 3.3: ClusterLayer 구현 (포인트 군집화)
- [ ] 3.4: LayerPanel에 새 레이어 토글 추가
- [ ] 3.5: 레이어별 설정 (투명도/두께/색상) 조절 UI

## Task 4: Route 레이어 — delivery_viewer 동선 로직 포팅 [pending]
depends: [2]

- [ ] 4.1: OSRM 라우팅 API 연동 + 캐시 (utils/osrm.ts) — delivery_viewer의 getRoute/routeCache 패턴 포팅
- [ ] 4.2: 세그먼트 빌더 (utils/segments.ts) — buildSegments, interpolateDots, offsetCoords 로직 포팅 (선/점 혼합 표현)
- [ ] 4.3: RouteLayer 구현 — PathLayer(선 구간) + ScatterplotLayer(점 구간) + 엔드포인트(가게/배달지) 통합 렌더링
- [ ] 4.4: 경로 애니메이션 엔진 — animateRouteInternal 포팅 (점진적 경로 그리기, rAF 기반, 탭 비활성 시 즉시 완료)
- [ ] 4.5: 호버/클릭 인터랙션 — 그룹 기반 하이라이트 + 클릭 시 리플레이 (replayRoute)
- [ ] 4.6: 플레이바 컨트롤 — 재생/역재생/속도 조절/시크바 (하단 고정)
- [ ] 4.7: TripLayer 구현 (deck.gl TripsLayer — 시간 기반 경로 애니메이션, 별도 모드)

## Task 5: 필터 + 테마 + 프리셋 [pending]
depends: [3, 4]

- [ ] 5.1: 시간대 슬라이더 (0~24시) 필터
- [ ] 5.2: 소요시간/거리 범위 필터
- [ ] 5.3: 지역 필터 (시군구)
- [ ] 5.4: 지도 테마 변경 (DarkMatter / Positron / Voyager)
- [ ] 5.5: 레이어 색상 팔레트 선택
- [ ] 5.6: 설정 JSON export/import (프리셋)
- [ ] 5.7: 쿼리 빌더 (QueryBuilder.tsx) — delivery_viewer의 지역(광역시/도+시군구) + 날짜 + 시간대 + LIMIT 기반 SQL 생성 로직 포팅
