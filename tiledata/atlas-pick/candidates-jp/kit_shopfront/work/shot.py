# 고르는 화면 킷 항목 스크린샷(감독자 확인용). python3 …/shot.py OUTDIR
import sys
from playwright.sync_api import sync_playwright
out = sys.argv[1]
with sync_playwright() as p:
    import glob; exe = sorted(glob.glob('/home/main/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))[-1]
    b = p.chromium.launch(executable_path=exe, args=['--disable-features=NetworkChangeDetection', '--disable-background-networking'])
    pg = b.new_page(viewport={'width': 1500, 'height': 1000})
    pg.goto('http://mdc-server:18303/#jp'); pg.wait_for_timeout(1200)
    pg.click('nav .it[data-id="kit_shopfront"]'); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{out}/kit-a.png')
    pg.check('#fWalk'); pg.wait_for_timeout(1500)
    pg.locator('.kcard').screenshot(path=f'{out}/kit-walk.png')
    pg.click('.kcard details summary'); pg.wait_for_timeout(800)
    bad = pg.evaluate("() => [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src)")
    pg.check('#fMoved'); pg.uncheck('#fHas'); pg.wait_for_timeout(500)
    moved = pg.locator('nav .it.moved').count()
    pg.click('nav .it[data-id="konbini_front"]'); pg.wait_for_timeout(1000)
    pg.screenshot(path=f'{out}/moved.png')
    pg.click('nav .it[data-id="vending_drink"]'); pg.wait_for_timeout(1000)
    pg.screenshot(path=f'{out}/resized.png')
    print('broken images', bad, 'moved rows', moved)
    b.close()
