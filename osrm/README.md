# OSRM 로컬 서버

배달 경로 라우팅용 로컬 OSRM 서버.

## 설치 (1회)

```bash
cd osrm

# 한국 지도 다운로드 (~200MB)
curl -O https://download.geofabrik.de/asia/south-korea-latest.osm.pbf

# 전처리 (5~10분 소요)
docker run -t -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/south-korea-latest.osm.pbf
docker run -t -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-partition /data/south-korea-latest.osrm
docker run -t -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-customize /data/south-korea-latest.osrm
```

## 서버 시작

```bash
docker run -d --name osrm -p 5000:5000 -v $(pwd):/data ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/south-korea-latest.osrm
```

## 테스트

```bash
curl "http://localhost:5000/route/v1/driving/127.0,37.5;127.1,37.5?overview=false"
```

## 중지/재시작

```bash
docker stop osrm
docker start osrm
```
