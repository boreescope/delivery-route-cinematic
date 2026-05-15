"""배달동선 대시보드 원클릭 실행

실행: python start.py

자동으로:
1. OSRM Docker 컨테이너 시작 (이미 있으면 재시작)
2. React dev server 시작 (npm run dev)
3. Trino poller 시작 (5분 간격)
4. 브라우저 열기
"""

import subprocess
import sys
import time
import webbrowser
from pathlib import Path

ROOT = Path(__file__).parent
REACT_DIR = ROOT / "react_dashboard"
VENV_PYTHON = Path.home() / "Desktop" / "Codes" / ".venv" / "bin" / "python"


def run(cmd, **kwargs):
    """명령 실행 (출력 표시)"""
    print(f"  → {cmd}")
    return subprocess.run(cmd, shell=True, **kwargs)


def start_osrm():
    """OSRM Docker 컨테이너 시작"""
    print("\n🗺️  OSRM 서버 확인...")
    result = subprocess.run(
        "docker ps --filter name=osrm --format '{{.Status}}'",
        shell=True,
        capture_output=True,
        text=True,
    )
    if "Up" in result.stdout:
        print("  ✅ 이미 실행 중")
        return

    # 중지된 컨테이너 시작 시도
    result = run("docker start osrm", capture_output=True, text=True)
    if result.returncode == 0:
        print("  ✅ 컨테이너 재시작")
        return

    # 컨테이너 없으면 새로 생성
    osrm_dir = ROOT / "osrm"
    if not (osrm_dir / "south-korea-latest.osrm").exists():
        print("  ❌ OSRM 데이터 없음. osrm/README.md 참고하여 전처리 먼저 실행하세요.")
        sys.exit(1)

    run(
        f"docker run --platform linux/amd64 -d --name osrm -p 5001:5000 "
        f'-v "{osrm_dir}":/data ghcr.io/project-osrm/osrm-backend '
        f"osrm-routed --algorithm mld /data/south-korea-latest.osrm"
    )
    print("  ✅ 새 컨테이너 시작")


def start_react():
    """React dev server 시작 (백그라운드)"""
    print("\n⚛️  React dev server 시작...")
    proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=REACT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    # dev server URL 감지
    for line in proc.stdout:
        if "Local:" in line or "localhost" in line:
            url = line.strip().split()[-1]
            print(f"  ✅ {url}")
            return proc, url
        if proc.poll() is not None:
            break
    # fallback
    print("  ✅ http://localhost:5173 (추정)")
    return proc, "http://localhost:5173"


def start_poller():
    """Trino poller 시작 (백그라운드)"""
    print("\n📡 Trino poller 시작 (5분 간격, 서울)...")
    proc = subprocess.Popen(
        [
            str(VENV_PYTHON),
            str(ROOT / "trino_poller.py"),
            "--loop",
            "--interval",
            "300",
            "--minutes",
            "60",
        ],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    # 첫 폴링 결과 대기
    for line in proc.stdout:
        print(f"  {line.strip()}")
        if "✅" in line or "❌" in line:
            break
    return proc


def main():
    print("🛵 배달동선 대시보드 시작")
    print("=" * 40)

    start_osrm()
    time.sleep(1)

    react_proc, url = start_react()
    time.sleep(2)

    poller_proc = start_poller()

    print(f"\n🌐 브라우저 열기: {url}")
    webbrowser.open(url)

    print("\n" + "=" * 40)
    print("✅ 모든 서비스 실행 중")
    print("   종료: Ctrl+C")
    print("=" * 40)

    try:
        while True:
            # poller 출력 계속 표시
            line = poller_proc.stdout.readline()
            if line:
                print(f"  [poller] {line.strip()}")
            time.sleep(0.1)
    except KeyboardInterrupt:
        print("\n\n🛑 종료 중...")
        poller_proc.terminate()
        react_proc.terminate()
        print("  ✅ poller 종료")
        print("  ✅ react 종료")
        print("  💡 OSRM은 계속 실행 중 (docker stop osrm 으로 종료)")


if __name__ == "__main__":
    main()
