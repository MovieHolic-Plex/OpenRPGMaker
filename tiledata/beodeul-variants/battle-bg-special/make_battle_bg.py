# 버들항 웨이브 5 — 전투 배경 특수 7장. 다시 돌리면 같은 그림이 나온다.
#   python3 make_battle_bg.py            → 7장 <slug>.png + compare-ref.png + check-overlay.png (+ 규격 검사 출력)
#   python3 make_battle_bg.py ghost-train → 한 장만 다시
# 장소마다 그 장소 폴더의 그림 모듈 복사본(src/<장소>/, vendor.py 로 만든다)을 따로 된 프로세스에서 부른다
# (장소 모듈이 공용 램프 표를 실행 중에 늘리므로 한 프로세스에 섞지 않는다).
import os, sys, subprocess
from PIL import Image, ImageDraw
ME = os.path.dirname(os.path.abspath(__file__))
VAR = os.path.abspath(os.path.join(ME, '..'))
SLUGS = ['ghost-train', 'opera-stage', 'veldt-coliseum', 'cultist-tower', 'desert-castle', 'prehistoric-village', 'wasteland-world']
# 비교용 맵 render-1x 크롭(1배 320×180, 2배로 늘려 배경 옆에 놓는다)
CROP = {'ghost-train': (380, 140), 'opera-stage': (120, 50), 'veldt-coliseum': (740, 60), 'cultist-tower': (1060, 300),
        'desert-castle': (60, 230), 'prehistoric-village': (480, 0), 'wasteland-world': (480, 300)}

def build(slugs):
    if not os.path.isdir(os.path.join(ME, 'src')):
        subprocess.run([sys.executable, os.path.join(ME, 'vendor.py')], check=True)
    for s in slugs:
        subprocess.run([sys.executable, os.path.join(ME, 'bg_' + s.replace('-', '_') + '.py')], check=True, cwd=ME)

def check():
    bad = []
    for s in SLUGS:
        im = Image.open(os.path.join(ME, s + '.png'))
        a = im.convert('RGBA'); n = len(im.convert('RGB').getcolors(1 << 20))
        opaque = a.getextrema()[3][0] == 255
        ok = im.size == (640, 360) and opaque and n <= 96
        print(f'{s:20s} {im.size} mode={im.mode} opaque={opaque} colors={n} {"OK" if ok else "FAIL"}')
        if not ok: bad.append(s)
    return bad

def compare_ref():
    W, H, G = 640, 360, 8
    out = Image.new('RGB', (W * 2 + G * 3, (H + 22) * len(SLUGS) + G), (24, 22, 28)); d = ImageDraw.Draw(out)
    for i, s in enumerate(SLUGS):
        y = G + i * (H + 22)
        d.text((G, y), f'{s}  battle bg 640x360 (1x canvas x2)', fill=(230, 230, 230))
        d.text((G * 2 + W, y), f'{s}/render-1x.png crop {CROP[s]} x2', fill=(230, 230, 230))
        out.paste(Image.open(os.path.join(ME, s + '.png')).convert('RGB'), (G, y + 14))
        m = Image.open(os.path.join(VAR, s, 'render-1x.png')).convert('RGB')
        x0, y0 = CROP[s]
        out.paste(m.crop((x0, y0, x0 + 320, y0 + 180)).resize((W, H), Image.NEAREST), (G * 2 + W, y + 14))
    out.save(os.path.join(ME, 'compare-ref.png'))

def overlay():
    W, H, G = 640, 360, 8
    out = Image.new('RGB', (W * 2 + G * 3, (H + G) * 4 + G), (24, 22, 28))
    ENEMY = [(150, 200), (230, 250), (140, 280)]                      # 왼쪽 적 3
    ALLY = [(420, 210), (470, 245), (520, 280), (440, 290)]           # 오른쪽 아래 아군 4
    for i, s in enumerate(SLUGS):
        im = Image.open(os.path.join(ME, s + '.png')).convert('RGBA')
        lay = Image.new('RGBA', im.size); d = ImageDraw.Draw(lay)
        d.rectangle((120, 190, 560, 330), outline=(255, 255, 0, 160))          # 배틀러 자리
        d.rectangle((0, 340, 639, 359), fill=(0, 0, 0, 150))                    # HUD 가림
        for (x, y) in ENEMY: d.rectangle((x - 24, y - 24, x + 24, y + 24), fill=(255, 60, 60, 110), outline=(255, 80, 80, 255))
        for (x, y) in ALLY: d.rectangle((x - 24, y - 24, x + 24, y + 24), fill=(60, 140, 255, 110), outline=(90, 160, 255, 255))
        im.alpha_composite(lay)
        out.paste(im.convert('RGB'), (G + (i % 2) * (W + G), G + (i // 2) * (H + G)))
    out.save(os.path.join(ME, 'check-overlay.png'))

if __name__ == '__main__':
    only = [a for a in sys.argv[1:] if a in SLUGS]
    build(only or SLUGS)
    bad = check(); compare_ref(); overlay()
    print('compare-ref.png, check-overlay.png', '— FAIL: ' + ', '.join(bad) if bad else '— all OK')
