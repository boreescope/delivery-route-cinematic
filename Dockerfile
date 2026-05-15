# Stage 1: React 빌드
FROM wcr.baemin.in/dockerhub/node:20-slim AS frontend
WORKDIR /app
COPY react_dashboard/package.json react_dashboard/package-lock.json ./
RUN npm ci
COPY react_dashboard/ ./
RUN npm run build

# Stage 2: Python API 서버
FROM wcr.baemin.in/dockerhub/python:3.11-slim
WORKDIR /app

# Python 의존성
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# React 빌드 결과물
COPY --from=frontend /app/dist ./static

# API 서버
COPY api_server.py ./

EXPOSE 8080
CMD ["python", "api_server.py", "--port", "8080"]
