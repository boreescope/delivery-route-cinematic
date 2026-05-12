"""타일 이미지를 Figma MCP에 업로드하고 imageHash를 수집한 뒤 use_figma로 fill 적용."""

import asyncio
import json
import subprocess
from pathlib import Path

import httpx

# nodeId → 파일명 매핑 (01은 이미 완료)
CARDS = [
    ("2082:16", "tile_02_positron"),
    ("2082:22", "tile_03_darkmatter"),
    ("2082:28", "tile_04_voyager"),
    ("2082:34", "tile_05_esri_street"),
    ("2082:40", "tile_08_esri_imagery"),
    ("2082:46", "tile_09_esri_topo"),
    ("2082:52", "tile_10_opentopo"),
    ("2082:58", "tile_11_esri_gray"),
]

SS = Path(__file__).parent / "screenshots"
FILE_KEY = "6ajn0dUPT26Hnh7eZWGLH4"
MCP_BASE = "https://mcp.figma.com/mcp/upload"


def get_upload_url() -> str:
    """upload_assets MCP 툴 호출 → submitUrl 반환 (curl로 직접 호출)."""
    # MCP 서버에 직접 HTTP 요청
    resp = httpx.post(
        "https://mcp.figma.com/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "upload_assets",
                "arguments": {"fileKey": FILE_KEY, "count": 1},
            },
        },
        timeout=15,
    )
    data = resp.json()
    uploads = json.loads(data["result"]["content"][0]["text"])["uploads"]
    return uploads[0]["submitUrl"]


async def upload_one(node_id: str, filename: str) -> tuple[str, str]:
    """1장 업로드 → (nodeId, imageHash)."""
    img_path = SS / f"{filename}.png"
    async with httpx.AsyncClient(timeout=30) as client:
        with open(img_path, "rb") as f:
            resp = await client.post(
                get_upload_url(),
                files={"file": (img_path.name, f, "image/png")},
            )
    data = resp.json()
    if not data.get("success"):
        raise RuntimeError(f"Upload failed for {filename}: {data}")
    print(f"  [{filename}] hash={data['imageHash'][:12]}...")
    return node_id, data["imageHash"]


async def main():
    print("Uploading tiles...")
    results = []
    for node_id, filename in CARDS:
        try:
            nid, h = await upload_one(node_id, filename)
            results.append((nid, h))
        except Exception as e:
            print(f"  ERROR {filename}: {e}")

    print(f"\nGot {len(results)} hashes. Applying fills via use_figma...")

    # JS 코드 생성
    assignments = "\n".join(f"  applyFill('{nid}', '{h}');" for nid, h in results)
    js = f"""
const page = figma.root.children.find(p => p.id === '0:1');
await figma.setCurrentPageAsync(page);
function applyFill(id, hash) {{
  const n = page.findOne(x => x.id === id);
  if (!n) {{ console.error('not found: ' + id); return; }}
  n.fills = [{{type:'IMAGE', scaleMode:'FILL', imageHash: hash}}];
}}
{assignments}
return {{applied: {len(results)}}};
"""

    # use_figma 호출 (subprocess로 MCP 직접 호출 대신 결과 출력)
    print("JS to run in use_figma:")
    print(js)
    print("\nHashes collected:")
    for nid, h in results:
        print(f"  {nid}: {h}")


if __name__ == "__main__":
    asyncio.run(main())
