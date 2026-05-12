"""MapLibre 6종 개별 캡처."""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).parent
OUT = ROOT / "screenshots"
OUT.mkdir(exist_ok=True)

MAPLIBRE = [
    "maplibre_01_liberty",
    "maplibre_02_bright",
    "maplibre_03_positron",
    "maplibre_04_3d_buildings",
    "maplibre_05_dark",
    "maplibre_06_watercolor",
]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        for name in MAPLIBRE:
            ctx = await browser.new_context(
                viewport={"width": 1200, "height": 900}, device_scale_factor=2
            )
            page = await ctx.new_page()
            try:
                file_path = ROOT / "demos" / f"{name}.html"
                await page.goto(
                    f"file://{file_path}", wait_until="networkidle", timeout=30000
                )
                await page.wait_for_timeout(6000)  # 타일 로딩 대기
                out = OUT / f"{name}.png"
                await page.screenshot(path=str(out))
                print(f"[✓] {out.name}")
            except Exception as e:
                print(f"[x] {name}: {e}")
            await ctx.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
