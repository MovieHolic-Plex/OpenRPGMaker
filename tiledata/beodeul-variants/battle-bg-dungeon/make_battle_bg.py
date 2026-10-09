# 버들항 웨이브 5 — 전투 배경 던전 6장 재생성 + QA 시트.
#   python3 make_battle_bg.py            # 6장 모두 다시 그리고 compare-ref.png · check-overlay.png · _qa/qa.txt 를 쓴다
#   python3 make_battle_bg.py rock-cave   # 한 장만 다시 그리고 QA 시트는 전체로 다시 만든다
#   python3 make_battle_bg.py --sheets    # 그림은 그대로 두고 QA 시트만
# 장소마다 그림 함수 모듈 이름이 겹치므로(dprops·mul·PER 등) 배경 한 장 = 프로세스 하나(bg_<장소>.py)로 돌린다.
import os, sys, subprocess, json
import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(HERE, '..'))
# 배경 슬러그 → (생성 스크립트, 같은 장소 맵 렌더, 비교 크롭 상자)
BGS = [
    ('rock-cave', 'bg_rock_cave.py', 'rock-cave', (20, 0, 380, 360)),
    ('mine-shaft', 'bg_mine_shaft.py', 'mine-tunnels', (40, 140, 400, 500)),
    ('dark-fortress', 'bg_dark_fortress.py', 'dark-fortress', (268, 40, 628, 400)),
    ('tower-interior', 'bg_tower_interior.py', 'tower-interior', (580, 30, 940, 390)),
    ('mountain-fortress', 'bg_mountain_fortress.py', 'mountain-fortress', (396, 40, 756, 400)),
    ('castle-catacombs', 'bg_castle_catacombs.py', 'castle-catacombs', (30, 20, 390, 380)),
]
SAFE = (120, 190, 560, 330)
ENEMY = [(140, 196), (226, 236), (140, 276)]
ALLY = [(424, 196), (456, 230), (488, 262), (512, 282)]


def run(slug):
    for s, script, _, _ in BGS:
        if s == slug:
            r = subprocess.run([sys.executable, os.path.join(HERE, script)], cwd=HERE, capture_output=True, text=True, timeout=600)
            if r.returncode: raise SystemExit(f'{slug}: {r.stderr[-800:]}')
            print(r.stdout.strip())


def lum(a): return a[..., 0] * .30 + a[..., 1] * .59 + a[..., 2] * .11


def check(slug):
    im = Image.open(os.path.join(HERE, slug + '.png'))
    a = np.array(im.convert('RGBA'))
    rgb = a[..., :3].astype(np.float32)
    x0, y0, x1, y1 = SAFE
    reg = lum(rgb[y0:y1, x0:x1])
    med = float(np.median(reg))
    bright = int((reg > med + 70).sum())                       # 바닥보다 훨씬 밝은 점(배틀러 자리)
    return dict(slug=slug, size=list(im.size), mode=im.mode, opaque=bool((a[..., 3] == 255).all()),
                colors=len(np.unique(a[..., :3].reshape(-1, 3), axis=0)), safe_median_lum=round(med, 1), safe_bright_px=bright)


def label(dr, x, y, t, fill=(255, 255, 255)):
    dr.rectangle((x, y, x + 6 * len(t) + 4, y + 11), fill=(0, 0, 0)); dr.text((x + 2, y), t, fill=fill)


def compare_sheet():
    """한 줄 = [전투 배경 640x360 | 같은 장소 맵 렌더 크롭 360x360], 둘 다 원 배율(1x). 아래 2x 확대 띠: 배경 바닥·벽 | 맵 같은 재질."""
    rows = []
    for slug, _, place, box in BGS:
        bg = Image.open(os.path.join(HERE, slug + '.png')).convert('RGB')
        mp = Image.open(os.path.join(VAR, place, 'render-1x.png')).convert('RGB').crop(box)
        row = Image.new('RGB', (640 + 8 + 360, 360 + 4 + 160), (255, 0, 255))
        row.paste(bg, (0, 0)); row.paste(mp, (648, 0))
        # 2x 확대: 배경의 벽 밑(지평선 둘레) 160x80 과 맵의 같은 크기 조각
        z1 = bg.crop((40, 120, 290, 200)).resize((500, 160), Image.NEAREST)
        z2 = mp.crop((60, 100, 314, 180)).resize((508, 160), Image.NEAREST)
        row.paste(z1, (0, 364)); row.paste(z2, (500, 364))
        dr = ImageDraw.Draw(row)
        label(dr, 4, 4, f'{slug}.png (battle bg 1x)'); label(dr, 652, 4, f'{place}/render-1x crop')
        label(dr, 4, 368, 'bg 2x'); label(dr, 504, 368, 'map 2x')
        rows.append(row)
    W = rows[0].width; H = sum(r.height + 6 for r in rows)
    sh = Image.new('RGB', (W, H), (30, 30, 34)); y = 0
    for r in rows: sh.paste(r, (0, y)); y += r.height + 6
    sh.save(os.path.join(HERE, 'compare-ref.png'))


def overlay_sheet():
    """가짜 전투원(적 3 왼쪽 빨강, 아군 4 오른쪽 아래 파랑, 48x48 반투명) + 배틀러 자리 상자 + 아래 20px HUD 띠."""
    tiles = []
    for slug, _, _, _ in BGS:
        bg = Image.open(os.path.join(HERE, slug + '.png')).convert('RGBA')
        ov = Image.new('RGBA', bg.size, (0, 0, 0, 0)); dr = ImageDraw.Draw(ov)
        for (x, y) in ENEMY: dr.rectangle((x, y, x + 47, y + 47), fill=(230, 40, 40, 110), outline=(255, 80, 80, 255))
        for (x, y) in ALLY: dr.rectangle((x, y, x + 47, y + 47), fill=(40, 110, 240, 110), outline=(90, 160, 255, 255))
        dr.rectangle(SAFE, outline=(255, 255, 0, 200))
        dr.rectangle((0, 340, 639, 359), fill=(0, 0, 0, 150))
        t = Image.alpha_composite(bg, ov).convert('RGB')
        label(ImageDraw.Draw(t), 4, 4, slug)
        tiles.append(t)
    sh = Image.new('RGB', (640 * 2 + 8, 360 * 3 + 16), (30, 30, 34))
    for i, t in enumerate(tiles): sh.paste(t, ((i % 2) * 648, (i // 2) * 368))
    sh.save(os.path.join(HERE, 'check-overlay.png'))


if __name__ == '__main__':
    want = [] if sys.argv[1:] == ['--sheets'] else (sys.argv[1:] or [b[0] for b in BGS])
    for s in want: run(s)
    compare_sheet(); overlay_sheet()
    os.makedirs(os.path.join(HERE, '_qa'), exist_ok=True)
    res = [check(b[0]) for b in BGS]
    with open(os.path.join(HERE, '_qa', 'qa.txt'), 'w') as f:
        for r in res: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    for r in res: print(r)
