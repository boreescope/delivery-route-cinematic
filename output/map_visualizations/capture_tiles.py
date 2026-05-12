"""타일 12종 개별 캡처."""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).parent
OUT = ROOT / "screenshots"
OUT.mkdir(exist_ok=True)

TILES = [
    "tile_01_osm",
    "tile_02_positron",
    "tile_03_darkmatter",
    "tile_04_voyager",
    "tile_05_esri_street",
    "tile_06_esri_terrain",
    "tile_07_esri_physical",
    "tile_08_esri_imagery",
    "tile_09_esri_topo",
    "tile_10_opentopo",
    "tile_11_esri_gray",
    "tile_12_cyclosm",
]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for name in TILES:
            ctx = await browser.new_context(
                viewport={"width": 1200, "height": 900}, device_scale_factor=2
            )
            page = await ctx.new_page()
            try:
                await page.goto(
                    f"http://127.0.0.1:8765/{name}.html",
                    wait_until="domcontentloaded",
                    timeout=15000,
                )
                await page.wait_for_timeout(4500)
                out = OUT / f"{name}.png"
                await page.screenshot(path=str(out))
                print(f"[\u2713] {out.name}")
            except Exception as e:
                print(f"[x] {name}: {e}")
            await ctx.close()
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
