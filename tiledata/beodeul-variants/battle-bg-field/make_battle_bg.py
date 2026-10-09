# 버들항 웨이브 5 — 전투 배경 필드 6장 다시 만들기.   python3 make_battle_bg.py [slug ...]
# 장소마다 bg_<장소>.py 를 따로 실행한다(장소마다 복사한 그림 모듈 이름이 겹치므로 프로세스를 나눈다).
# 그다음 compare-ref.png(배경 | 배경 2배 | 원 지도 2배), check-overlay.png(가짜 전투원 겹침), 규격 검사(640x360·불투명·색 ≤96).
import os, sys, subprocess
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import bgkit as K

# slug, 스크립트, 배경 2배 크롭(x, y), 원 지도 2배 크롭(x, y) — 크롭 크기 160x180(→ 320x360)
PLACES = [
    ('plains-highroad', 'bg_plains.py', (440, 60), (540, 140)),
    ('ancient-forest', 'bg_forest.py', (220, 60), (720, 40)),
    ('ice-age-field', 'bg_ice.py', (420, 50), (680, 90)),
    ('desert-pyramid', 'bg_desert.py', (200, 40), (560, 130)),
    ('volcano-field', 'bg_volcano.py', (240, 20), (480, 40)),
    ('swamp-dungeon', 'bg_swamp.py', (250, 70), (740, 210)),
]


def run(slugs):
    for slug, script, _, _ in PLACES:
        if slugs and slug not in slugs: continue
        r = subprocess.run([sys.executable, os.path.join(HERE, script)], cwd=HERE, capture_output=True, text=True)
        print((r.stdout.strip().splitlines() or ['?'])[-1] if r.returncode == 0 else f'{slug} FAILED\n{r.stderr[-2000:]}')
        if r.returncode: sys.exit(1)


def check():
    ok = True
    for slug, *_ in PLACES:
        im = Image.open(os.path.join(HERE, slug + '.png'))
        a = np.array(im.convert('RGBA'))
        n = K.ncolors(im)
        good = im.size == (640, 360) and a[..., 3].min() == 255 and n <= 96
        ok &= good
        print(f'{slug:18s} {im.size} mode={im.mode} alpha_min={a[..., 3].min()} colors={n} {"OK" if good else "FAIL"}')
    return ok


def compare_ref():
    rows = []
    for slug, _, (bx, by), (mx, my) in PLACES:
        bg = Image.open(os.path.join(HERE, slug + '.png')).convert('RGB')
        mp = Image.open(os.path.join(K.VROOT, slug, 'render-1x.png')).convert('RGB')
        row = Image.new('RGB', (640 + 320 + 320 + 12, 360 + 14), (24, 24, 30))
        row.paste(bg, (0, 14))
        row.paste(bg.crop((bx, by, bx + 160, by + 180)).resize((320, 360), Image.NEAREST), (646, 14))
        row.paste(mp.crop((mx, my, mx + 160, my + 180)).resize((320, 360), Image.NEAREST), (972, 14))
        d = ImageDraw.Draw(row)
        d.text((4, 1), f'{slug}  battle bg 1x', fill=(230, 230, 230))
        d.text((650, 1), 'battle bg 2x', fill=(230, 230, 230))
        d.text((976, 1), f'map {slug}/render-1x 2x', fill=(230, 230, 230))
        rows.append(row)
    out = Image.new('RGB', (rows[0].width, sum(r.height for r in rows)), (24, 24, 30))
    y = 0
    for r in rows: out.paste(r, (0, y)); y += r.height
    out.save(os.path.join(HERE, 'compare-ref.png'))
    return out.size


ENEMIES = [(150, 214), (232, 252), (144, 282)]                   # 48x48 왼쪽 위 좌표
ALLIES = [(420, 202), (480, 234), (432, 266), (500, 288)]


def overlay():
    tiles = []
    for slug, *_ in PLACES:
        im = Image.open(os.path.join(HERE, slug + '.png')).convert('RGBA')
        ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
        for (x, y) in ENEMIES: d.rectangle((x, y, x + 47, y + 47), fill=(255, 60, 60, 110), outline=(255, 80, 80, 255))
        for (x, y) in ALLIES: d.rectangle((x, y, x + 47, y + 47), fill=(60, 140, 255, 110), outline=(80, 160, 255, 255))
        x0, y0, x1, y1 = K.BATTLE
        d.rectangle((x0, y0, x1, y1), outline=(255, 255, 0, 200))
        d.rectangle((0, 340, 639, 359), fill=(10, 10, 20, 170))
        d.line((0, K.HORIZON, 639, K.HORIZON), fill=(255, 255, 255, 90))
        d.text((4, 344), slug + '  (yellow = battler zone, dark = HUD)', fill=(255, 255, 255, 255))
        tiles.append(Image.alpha_composite(im, ov).convert('RGB'))
    out = Image.new('RGB', (1280 + 8, 1080 + 16), (24, 24, 30))
    for i, t in enumerate(tiles):
        out.paste(t, ((i % 2) * 648, (i // 2) * 368))
    out.save(os.path.join(HERE, 'check-overlay.png'))
    return out.size


if __name__ == '__main__':
    slugs = sys.argv[1:]
    run(slugs)
    ok = check()
    print('compare-ref.png', compare_ref())
    print('check-overlay.png', overlay())
    sys.exit(0 if ok else 1)
