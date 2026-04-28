#!/usr/bin/env python
"""각 데모 HTML을 Playwright로 열어서 PNG 스크린샷 저장."""

import asyncio
import os
import threading
import http.server
import socketserver
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).parent
DEMOS = ROOT / "demos"
OUT = ROOT / "screenshots"
OUT.mkdir(exist_ok=True)

PORT = 8765


def start_server():
    os.chdir(DEMOS)
    handler = http.server.SimpleHTTPRequestHandler
    # 로그 죽임
    handler.log_message = lambda *a, **k: None
    with socketserver.TCPServer(("127.0.0.1", PORT), handler) as httpd:
        httpd.serve_forever()


# (파일, 대기시간ms)
TARGETS = [
    ("00_tile_catalog.html", 5000),
    ("01_arc.html", 4500),
    ("02_trips.html", 6500),
    ("03_heatmap.html", 4500),
    ("04_h3.html", 4500),
    ("05_hex3d.html", 5500),
    ("06_scatter.html", 4000),
    ("07_choropleth.html", 7000),
    ("08_isochrone.html", 4500),
    ("09_voronoi.html", 4500),
    ("10_gpsdrawing.html", 4500),
    ("11_particles.html", 6000),
    ("12_network.html", 4500),
    ("13_cartogram.html", 7000),
    ("14_deadzone.html", 4500),
]


async def shoot(page, name, wait_ms):
    url = f"http://127.0.0.1:{PORT}/{name}"
    print(f"[.] {name}")
    await page.goto(url, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(wait_ms)
    out_path = OUT / name.replace(".html", ".png")
    await page.screenshot(path=str(out_path), full_page=False)
    print(f"[✓] {out_path.name}")


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for fname, wait in TARGETS:
            if "00_tile_catalog" in fname:
                vp = {"width": 1400, "height": 1400}
            else:
                vp = {"width": 1400, "height": 900}
            context = await browser.new_context(viewport=vp, device_scale_factor=2)
            page = await context.new_page()
            page.on(
                "console",
                lambda msg: (
                    print(f"    [{msg.type}] {msg.text[:120]}")
                    if msg.type in ("error", "warning")
                    else None
                ),
            )
            try:
                await shoot(page, fname, wait)
            except Exception as e:
                print(f"[x] {fname}: {e}")
            await context.close()
        await browser.close()


if __name__ == "__main__":
    t = threading.Thread(target=start_server, daemon=True)
    t.start()
    import time

    time.sleep(0.5)
    asyncio.run(main())
