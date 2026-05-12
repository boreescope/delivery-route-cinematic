# 배달 동선 시각화 대시보드 — Spec

## 한 줄 요약
PM이 CSV를 업로드하면 배달 경로를 다양한 레이어(경로, Arc, Heatmap, Hexbin 등)로 시각화하는 React 대시보드.

## 기술 스택
- React 18 + TypeScript
- MapLibre GL JS (지도 렌더링)
- deck.gl (시각화 레이어)
- CARTO 타일 (배경 지도, 무료)
- Vite (빌드)
- Zustand (상태 관리, 가벼움)

## 핵심 기능

### 1. 데이터 입력
- CSV 드래그앤드롭 업로드
- 컬럼 자동 감지 (위도/경도 컬럼 매핑)
- 샘플 데이터 내장 (첫 접속 시 데모용)

### 2. 시각화 레이어 (on/off 토글)
- **Route** — OSRM 라우팅 실제 도로 경로 + 애니메이션 (delivery_viewer.html 방식)
- **Arc** — 매장→고객 직선 연결
- **Point** — 매장/고객 위치 점
- **Heatmap** — 배달 밀집도
- **Hexbin** — 육각형 집계 (건수/평균 소요시간)
- **Cluster** — 포인트 군집화
- **Trip** — 시간 기반 경로 애니메이션 (deck.gl TripsLayer)

### 3. 필터
- 시간대 슬라이더 (0~24시)
- 소요시간 범위
- 거리 범위
- 지역 필터 (시군구)

### 4. 스타일/테마
- 지도 배경: DarkMatter / Positron / Voyager
- 레이어 색상 팔레트 선택
- 투명도/두께 조절

### 5. UI 구성
- 좌측: 레이어 패널 (토글 + 설정)
- 우측 상단: 쿼리 빌더 (기존 delivery_viewer 방식)
- 하단: 시간 필터 슬라이더
- 중앙: 지도 (전체 화면)

### 6. 기타
- 현재 설정 JSON export/import (프리셋)
- 호버 툴팁 (건별 정보)
- 클릭 시 경로 하이라이트 + 리플레이

## 데이터 형식 (CSV)
```
ord_no, shop_lat, shop_lon, dlvry_lat, dlvry_lon, pick_up_date, hand_over_date
```
기존 delivery_viewer.html과 동일한 포맷.

## 폴더 구조 (예상)
```
react_dashboard/
├── public/
│   └── sample_data.csv
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── store/           ← Zustand 상태
│   ├── components/
│   │   ├── Map.tsx      ← MapLibre + deck.gl
│   │   ├── LayerPanel.tsx
│   │   ├── FilterPanel.tsx
│   │   ├── QueryBuilder.tsx
│   │   └── FileUpload.tsx
│   ├── layers/          ← deck.gl 레이어 정의
│   │   ├── RouteLayer.ts
│   │   ├── ArcLayer.ts
│   │   ├── HeatmapLayer.ts
│   │   ├── HexbinLayer.ts
│   │   ├── PointLayer.ts
│   │   ├── ClusterLayer.ts
│   │   └── TripLayer.ts
│   ├── utils/
│   │   ├── csv.ts
│   │   ├── osrm.ts
│   │   └── colors.ts
│   └── types.ts
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

## 구현 순서 (Tasks)

### Task 1: 프로젝트 초기화
- Vite + React + TypeScript 세팅
- MapLibre + deck.gl 설치
- 기본 전체화면 지도 렌더링 (CARTO DarkMatter)

### Task 2: 데이터 레이어 — CSV 업로드 + Point/Arc
- CSV 파싱 + 컬럼 자동 감지
- Point 레이어 (매장/고객)
- Arc 레이어 (매장→고객)
- 레이어 패널 (on/off 토글)

### Task 3: 데이터 레이어 — Heatmap/Hexbin/Cluster
- HeatmapLayer
- HexagonLayer
- ClusterLayer (IconClusterLayer)

### Task 4: Route 레이어 (OSRM)
- OSRM 라우팅 연동
- 경로 애니메이션 (delivery_viewer 방식 포팅)
- 호버/클릭 인터랙션

### Task 5: 필터 + 테마 + 프리셋
- 시간대/소요시간/거리 필터
- 지도 테마 변경
- 설정 JSON export/import
- 쿼리 빌더

## 참고
- 기존 구현: `/delivery_viewer.html` (Leaflet + deck.gl, vanilla JS)
- kepler.gl 리서치: `/kepler/` (참고용)
- 배포: 추후 Static Web 배포 그룹 (사내 플랫폼)
