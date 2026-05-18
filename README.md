# 배달 동선 시각화 대시보드

서울 전역의 배달 동선을 준실시간으로 지도에 시각화합니다.

## 두 가지 뷰어

| 뷰어 | 설명 | 실행 방법 |
|------|------|-----------|
| `delivery_viewer.html` | CSV 업로드 → 경로 애니메이션 (초기 버전) | 로컬 서버로 열기 |
| `react_dashboard/` | 실시간 데이터 폴링 → dot 이동 | `python start.py` |

## 빠른 시작

### 1. 환경 설정

```bash
# Python 의존성
pip install trino

# Node.js 의존성
cd react_dashboard && npm install && cd ..
```

### 2. Trino 인증 설정

프로젝트 루트에 `.env` 파일 생성:

```bash
# .env (gitignore됨)
TRINO_USER=본인AD계정
TRINO_PASSWORD=비밀번호
```

### 3. 실행

```bash
# 원클릭 (OSRM + React + API 서버 + 브라우저)
python start.py
```

또는 수동:

```bash
# 터미널 1: OSRM 서버 (Docker 필요)
docker start osrm

# 터미널 2: API 서버
python api_server.py

# 터미널 3: React dev 서버
cd react_dashboard && npm run dev
```

### 4. delivery_viewer.html (초기 버전)

```bash
python -m http.server 8080
# http://localhost:8080/delivery_viewer.html
```

## OSRM 서버 최초 설치

Docker Desktop 필요. 상세: `osrm/README.md`

```bash
cd osrm
curl -L -o south-korea-latest.osm.pbf https://download.geofabrik.de/asia/south-korea-latest.osm.pbf
docker run --platform linux/amd64 -t -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/south-korea-latest.osm.pbf
docker run --platform linux/amd64 -t -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-partition /data/south-korea-latest.osrm
docker run --platform linux/amd64 -t -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-customize /data/south-korea-latest.osrm
docker run --platform linux/amd64 -d --name osrm -p 5001:5000 -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/south-korea-latest.osrm
```

## 배포

- 도메인: `deliveryroute-graphic.betawoowa.in`
- 이미지: `wcr.baemin.in/creative-ai-delivery-route/delivery-route-web`
- GitLab: https://git.baemin.in/jinsol/dev_delivery_route
