# 석조 유럽 시가지 전투 배경(640x360, 낮·흐림 한 장) — WAVE-BRIEF-3 A 절 규약. 다시 돌리면 같은 그림.   python3 make_battle_bg.py
# 위 ~45% = 흐린 하늘 띠(4색) + 손으로 찍은 구름 덩이 + 건너편 건물 줄(이 팩의 건물 키트를 줄여 옅은 대기색으로 밀어 원경으로).
# 지평선 y≈172 = 건너편 보도 연석. 아래 = 회색 포석 차도(ground-setts 결) — 가운데(x120~560, y190~330)는 비운다.
# 양쪽 가장자리: 왼쪽 쌍등 가로등·가로수·파라솔 식탁, 오른쪽 광고 기둥·통·꽃 수레. 산출: battle-bg.png, check-overlay.png
import os, sys
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
import eq_kit as KT
from eq_base import *
import eq_ground as GR
from PIL import ImageDraw

W, Hh = 640, 360; HOR = 176
SKY = [hx('#5d6672'), hx('#6a737e'), hx('#77808a'), hx('#848c95')]
CLOUD = [hx('#8d949c'), hx('#7f868f'), hx('#6f7680')]
HAZE = np.array(hx('#7a828c'), np.float64)

def hazed(im, k):
    a = np.array(im).astype(np.float64); a[..., :3] = a[..., :3] * (1 - k) + HAZE * k
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8), 'RGBA')

def cloud(px, cx, cy, w, h, seed):
    """손으로 찍은 구름 덩이: 아랫변 평평, 위는 둥근 혹 다섯, 아래 한 줄 그늘(밝은 윗면)."""
    bumps = [(cx - w * 0.38 + w * 0.76 * i / 4 + 6 * H(i, 1, seed), cy - h * (0.35 + 0.35 * H(i, 2, seed)), h * (0.45 + 0.35 * H(i, 3, seed))) for i in range(5)]
    for y in range(int(cy - h * 1.6), int(cy + 2)):
        for x in range(int(cx - w / 2 - 4), int(cx + w / 2 + 4)):
            inside = abs(x - cx) < w / 2 and cy - h * 0.45 <= y <= cy
            for (bx, by, r) in bumps:
                if math.hypot(x - bx, (y - by) * 1.3) < r: inside = True
            if inside and 0 <= x < W and 0 <= y < Hh:
                px[x, y] = (CLOUD[2] if y >= cy - 1 else (CLOUD[1] if y > cy - h * 0.7 else CLOUD[0])) + (255,)

def main():
    im = Image.new('RGBA', (W, Hh), SKY[0] + (255,)); px = im.load()
    for y in range(HOR):
        t = min(3, y // 40)
        for x in range(W):
            c = SKY[t]
            if y % 40 == 0 and y and (x + y) % 2: c = SKY[t - 1]
            px[x, y] = c + (255,)
    for (cx, cy, w, h, sd) in ((70, 34, 90, 26, 1), (290, 26, 110, 30, 2), (520, 40, 96, 26, 3), (410, 64, 56, 18, 4)):
        cloud(px, cx, cy, w, h, sd)
    # 원경: 건너편 건물 줄(맨사르드 지붕선이 하늘을 톱니처럼 자른다)
    far = Image.new('RGBA', (W, Hh)); x = -24
    row = ['low-shop', 'townhouse-wide', 'warehouse', 'cobbler', 'inn', 'low-shop', 'townhouse-corner', 'bakery', 'warehouse', 'low-shop', 'apothecary']
    for i, n in enumerate(row):                                              # 원 크기(정수 배) — 줄이지 않는다
        s = KT.img(n)
        far.alpha_composite(hazed(s, 0.2), (x, HOR - s.height + 2)); x += s.width
        if x > W: break
    im.alpha_composite(far)
    px = im.load()
    # 바닥: 건너편 보도(판석 띠) + 연석 + 포석 차도
    Y, X = np.mgrid[0:Hh - HOR, 0:W]
    floor = GR.setts(X, Y)
    flag = GR.flagstone(X, Y)
    floor[:14] = flag[:14]
    fl = arr_img(floor)
    im.alpha_composite(fl, (0, HOR))
    px = im.load()
    for x in range(W):
        px[x, HOR + 14] = TRIM[5] + (255,); px[x, HOR + 15] = TRIM[3] + (255,); px[x, HOR + 16] = COB[1] + (255,)
        for y in (HOR, HOR + 1): q = px[x, y]; px[x, y] = tuple(int(v * 0.7) for v in q[:3]) + (255,)
    # 웅덩이 덩이(가장자리, 오토타일 칸 그대로 이어 붙임)
    pud = GR.autotile_puddle(); lv = GR.autotile_leaves()
    def stamp(sheet, cells, ox, oy):
        S = set(cells)
        for (cx, cy) in cells:
            n = (1 if (cx, cy - 1) in S else 0) | (2 if (cx + 1, cy) in S else 0) | (4 if (cx, cy + 1) in S else 0) | (8 if (cx - 1, cy) in S else 0)
            im.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (ox + cx * 16, oy + cy * 16))
    stamp(pud, [(0, 0), (1, 0), (2, 0), (3, 0), (1, 1), (2, 1)], 20, 296)
    stamp(pud, [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1)], 572, 300)
    stamp(lv, [(0, 0), (1, 0), (0, 1), (1, 1), (2, 1)], 8, 216)
    def put(name, x, ybot, flip=False):
        s = KT.img(name)
        if flip: s = s.transpose(Image.FLIP_LEFT_RIGHT)
        im.alpha_composite(s, (x, ybot - s.height))
    # 왼쪽 가장자리
    put('tree-street', 4, 236); put('lamp-double', 76, 212); put('parasol-table', -6, 330); put('bollard', 100, 260)
    put('drain-grate', 60, 300); put('leaves-scatter', 90, 300)
    # 오른쪽 가장자리
    put('advert-column', 574, 220); put('barrels-stack', 600, 246); put('flower-cart', 584, 296); put('lamp-double', 548, 208)
    put('crate', 616, 330); put('pigeons', 540, 310); put('manhole', 300, 344)
    out = im.convert('RGB').quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out.save(OUT + '/battle-bg.png')
    chk = out.convert('RGBA'); lay = Image.new('RGBA', chk.size); d = ImageDraw.Draw(lay)
    for (x, y) in ((150, 214), (210, 262), (150, 290)):
        d.rectangle((x, y, x + 47, y + 47), fill=(220, 40, 40, 110), outline=(255, 80, 80, 255))
    for (x, y) in ((430, 200), (470, 236), (430, 272), (490, 300)):
        d.rectangle((x, y, x + 47, y + 47), fill=(40, 120, 220, 110), outline=(90, 160, 255, 255))
    d.rectangle((120, 190, 560, 330), outline=(255, 255, 0, 180))
    d.line((0, 340, W, 340), fill=(255, 255, 0, 160))
    chk.alpha_composite(lay); chk.convert('RGB').save(OUT + '/check-overlay.png')
    a = np.array(out); print(out.size, 'colors', len(np.unique(a.reshape(-1, 3), axis=0)), 'alpha-free RGB')

if __name__ == '__main__':
    main()
