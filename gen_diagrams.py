"""Gemini로 데이터 파이프라인 다이어그램 생성"""

import os
from pathlib import Path

from google import genai
from google.genai import types

# .env 로드
for env_path in [
    Path.home() / ".kiro" / "secrets" / ".env",
    Path.home() / ".claude" / "secrets" / ".env",
]:
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())
        break

client = genai.Client(api_key=os.environ["GEMINI_API_KEY_TEAM"])

OUTPUT_DIR = Path(__file__).parent / "output" / "diagrams"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def generate_image(prompt: str, filename: str):
    """Gemini로 이미지 생성 후 저장"""
    print(f"생성 중: {filename}...")
    response = client.models.generate_content(
        model="gemini-3.1-flash-image-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )
    for part in response.candidates[0].content.parts:
        if part.inline_data:
            path = OUTPUT_DIR / filename
            path.write_bytes(part.inline_data.data)
            print(f"  ✅ {path} ({len(part.inline_data.data)} bytes)")
            return path
    print("  ❌ 이미지 생성 실패")
    return None


# 1. 데이터 파이프라인 흐름도
pipeline_prompt = """깔끔하고 모던한 인포그래픽 다이어그램을 만들어줘.
어두운 배경(#1a1a2e)에 네온 강조색(시안, 초록, 주황) 사용.

위에서 아래로 흐르는 5단계 스토리를 보여줘. 각 단계 사이에 화살표.

① 라이더가 매장에서 음식을 픽업 (바이크 아이콘)
   "픽업 완료" 버튼 누름

   ↓ (~2-5분 지연)

② 사내 데이터베이스에 기록됨 (DB 아이콘)
   서울 지역, 30분치 데이터 보관

   ↓ (브라우저에서 "시작" 클릭)

③ API 서버가 DB에서 가져옴 (서버 아이콘)
   "이 주문은 여기서 출발해서 여기로 갑니다"
   좌표 + 시각 정보 전달

   ↓

④ OSRM에게 도로 경로 질문 (지도 아이콘)
   "이 두 점 사이 실제 도로 경로 알려줘"
   → 경로 좌표 배열 + 예상 소요시간 반환

   ↓

⑤ 지도에 dot이 나타나서 경로를 따라 이동 (지도 위 dot)
   실제 배달 시간에 맞춰 천천히 움직임
   5분 후 → 다시 ②부터 반복 (새 주문 추가)

모든 텍스트는 한국어.
스타일: 미니멀, 아이콘 + 짧은 설명, 세로 흐름.
크기: 800x1000px 세로형.
"""

# 2. OSRM 배율 + scale 조정 예시
scale_prompt = """깔끔한 인포그래픽을 만들어줘. 배달 애니메이션 타이밍이 어떻게 동작하는지 보여주는 거야.
어두운 배경(#1a1a2e)에 네온 색상 사용.

두 가지 시나리오를 나란히 보여줘:

[왼쪽 - 신규 job (완료 데이터 없음)]
타임라인 바:
- 픽업 시각: 19:00
- OSRM 예상: 3분 (자동차 기준)
- 실제 추정: 3 × 3 = 9분
- dot이 경로를 따라 9분간 이동
- 예상 도착: 19:09

[오른쪽 - 완료된 job (다음 폴링에서 완료 데이터 수신)]
타임라인 바:
- 픽업 시각: 19:00
- 처음엔 OSRM × 3 = 9분으로 애니메이션
- t+5분 폴링 시: 실제 완료시각 = 19:07 (실제: 7분)
- Scale 조정: 남은 경로를 실제 완료 시각에 맞게 압축
- dot이 정확히 19:07에 도착

[하단 - 범례]
- 초록 dot = 현재 이동 중
- 파란 선 = 완료된 경로
- 주황 점선 = 남은 예상 경로
- "×3" 배지로 배율 표시

스타일: 깔끔한 타임라인 다이어그램, 가로 바, 모노스페이스 타임스탬프.
모든 텍스트는 한국어로 작성.
크기: 1200x600px 가로형.
"""

if __name__ == "__main__":
    p1 = generate_image(pipeline_prompt, "pipeline_flow.png")
    p2 = generate_image(scale_prompt, "osrm_scale.png")
    print("\n완료!")
    if p1:
        print(f"  1. {p1}")
    if p2:
        print(f"  2. {p2}")
