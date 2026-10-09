# 목골 구시가 전투 배경(640x360, 낮·맑음 한 장) — WAVE-BRIEF-3 A 절 규약. 다시 돌리면 같은 그림.   python3 make_battle_bg.py
# 위 ~45% = 하늘 띠(4색) + 손으로 찍은 구름 덩이 + 광장 건너편 목골집 줄(키트 그림 그대로, 하늘빛으로 한 번 섞어 거리감).
# 지평선 y≈176 = 집 줄 아래 연석. 아래 = 광장 바닥(벽돌 포장 가운데, 양쪽 큰 포석·자갈) — 가운데(x120~560, y190~330)는 비운다.
# 양쪽 가장자리 물체: 왼쪽 가로수·쌍 가로등·꽃 통, 오른쪽 좌판·통 더미·벤치. 산출: battle-bg.png, check-overlay.png
import os, sys
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
import eq_kit as KT
from eq_kit import *
import eq_ground as GR, eq_auto as AU
from PIL import ImageDraw

W, Hh = 640, 360; HZ = 176
SKY = [hx('#7fa6c8'), hx('#93b6d2'), hx('#a8c6dc'), hx('#bcd4e4')]
CLOUD = [hx('#e6eef2'), hx('#d2dee6'), hx('#b4c6d4')]

def cloud(px, cx, cy, w, h, seed):
    """손으로 찍은 구름 덩이: 아랫변 평평, 위는 둥근 혹 3~5개, 아래 한 줄 그늘."""
    bumps = [(cx - w * 0.38 + w * 0.76 * i / 4 + 6 * H(i, 1, seed), cy - h * (0.35 + 0.35 * H(i, 2, seed)), h * (0.45 + 0.35 * H(i, 3, seed))) for i in range(5)]
    for y in range(int(cy - h * 1.6), int(cy + 2)):
        for x in range(int(cx - w / 2 - 4), int(cx + w / 2 + 4)):
            inside = abs(x - cx) < w / 2 and cy - h * 0.45 <= y <= cy
            for (bx, by, r) in bumps:
                if math.hypot(x - bx, (y - by) * 1.3) < r: inside = True
            if inside and 0 <= x < W and 0 <= y < Hh:
                px[x, y] = (CLOUD[2] if y >= cy - 1 else (CLOUD[1] if y > cy - h * 0.6 else CLOUD[0])) + (255,)

def hazed(im, k):
    a = np.array(im).astype(np.float64); f = np.array(SKY[2], np.float64)
    a[..., :3] = a[..., :3] * (1 - k) + f * k
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8), 'RGBA')

def main():
    im = Image.new('RGBA', (W, Hh), SKY[0] + (255,)); px = im.load()
    for y in range(HZ):
        t = min(3, y // 30)
        for x in range(W):
            c = SKY[t]
            if y % 30 == 0 and y and (x + y) % 2: c = SKY[t - 1]
            px[x, y] = c + (255,)
    for (cx, cy, w, h, sd) in ((80, 34, 110, 20, 1), (300, 22, 130, 22, 2), (520, 40, 120, 18, 3)):
        cloud(px, cx, cy, w, h, sd)
    # 광장 건너편 집 줄(키트 그대로, 바닥을 지평선에) — 성당 종탑이 가운데 뒤에서 솟는다
    row = [('house-gable-wide', -20), ('house-gable-narrow', 76), ('house-eave-dormer', 124), ('chapel', 220), ('house-gable-tall', 348),
           ('guild-hall', 412), ('house-gable-oriel', 540), ('house-gable-narrow', 620)]
    far = Image.new('RGBA', (W, Hh)); fp = far.load()
    for y in range(110, HZ + 4):                                         # 집 사이 골목 안쪽(어두운 뒤 벽·그늘) — 하늘이 땅까지 비치지 않게
        for x in range(W): fp[x, y] = (STN[2] if (y // 4 + x // 8) % 2 else STN[1]) + (255,)
    for (n, x) in row:
        s = pad16(KT.img(n)); far.alpha_composite(s, (x, HZ + 4 - s.height))
    im.alpha_composite(hazed(far, 0.22))
    # 바닥: 가운데 벽돌 포장, 양쪽으로 큰 포석 → 자갈(세계 좌표 결 그대로)
    Y, X = np.mgrid[0:Hh - HZ, 0:W]
    brick = GR.brickpave(X, Y); setts = GR.setts(X, Y); cob = GR.cobble(X, Y)
    floor = brick.copy(); reg = np.zeros(floor.shape[:2], int)
    for yy in range(Hh - HZ):
        for xx in range(W):
            d = min(xx, W - 1 - xx)
            lim = 92 + yy * 0.12                                              # 벽돌 포장 가장자리(곧은 연석, 앞으로 조금 넓어짐)
            if d < lim - 48: floor[yy, xx] = cob[yy, xx]; reg[yy, xx] = 2
            elif d < lim: floor[yy, xx] = setts[yy, xx]; reg[yy, xx] = 1
    edge = (reg == 0) & ((np.roll(reg, 1, 1) != 0) | (np.roll(reg, -1, 1) != 0) | (np.roll(reg, 2, 1) != 0) | (np.roll(reg, -2, 1) != 0))
    floor[edge] = GR.OCHRE[4]
    floor = grade_arr(floor)
    fl = Image.fromarray(np.dstack([np.clip(np.rint(floor), 0, 255).astype(np.uint8), np.full(floor.shape[:2], 255, np.uint8)]), 'RGBA')
    im.alpha_composite(fl, (0, HZ))
    px = im.load()
    for x in range(W):                                                   # 집 줄 밑 연석(황갈) + 그늘 한 줄
        px[x, HZ] = tuple(int(v) for v in grade_arr(GR.OCHRE[5][None, None])[0, 0]) + (255,)
        px[x, HZ + 1] = tuple(int(v) for v in grade_arr(GR.OCHRE[3][None, None])[0, 0]) + (255,)
        for y in (HZ + 2, HZ + 3): q = px[x, y]; px[x, y] = tuple(int(v * 0.72) for v in q[:3]) + (255,)
    # 웅덩이·이끼 덩이(가장자리, 오토타일 칸 그대로 이어 붙임)
    def stamp(sheet, cells, ox, oy):
        S = set(cells)
        for (cx, cy) in cells:
            n = (1 if (cx, cy - 1) in S else 0) | (2 if (cx + 1, cy) in S else 0) | (4 if (cx, cy + 1) in S else 0) | (8 if (cx - 1, cy) in S else 0)
            im.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (ox + cx * 16, oy + cy * 16))
    stamp(AU.autotile('autotile-puddle'), [(0, 0), (1, 0), (1, 1), (2, 1)], 40, 300)
    stamp(AU.autotile('autotile-mossy'), [(0, 0), (1, 0), (0, 1), (1, 1), (2, 1)], 560, 196)
    stamp(AU.autotile('autotile-leaves'), [(0, 0), (1, 0), (0, 1)], 16, 220)
    # 양쪽 가장자리 물체(가운데 비움)
    def put(name, x, ybot):
        s = pad16(KT.img(name)); im.alpha_composite(s, (x, ybot - s.height))
    put('street-tree', -8, 250); put('lamp-double', 60, 214); put('flower-tub-red', 8, 300); put('bollard', 96, 200); put('barrels', 0, 350)
    put('stall-green', 580, 262); put('barrels', 600, 330); put('bench', 572, 214); put('lamp-single', 548, 214); put('flower-tub-yellow', 616, 346)
    out = im.convert('RGB').quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out.save(OUT + '/battle-bg.png')
    chk = out.convert('RGBA'); lay = Image.new('RGBA', chk.size); d = ImageDraw.Draw(lay)
    for (x, y) in ((150, 214), (210, 262), (150, 290)):                       # 적 셋(왼쪽)
        d.rectangle((x, y, x + 47, y + 47), fill=(220, 40, 40, 110), outline=(255, 80, 80, 255))
    for (x, y) in ((430, 200), (470, 236), (430, 272), (490, 300)):           # 아군 넷(오른쪽 아래)
        d.rectangle((x, y, x + 47, y + 47), fill=(40, 120, 220, 110), outline=(90, 160, 255, 255))
    d.rectangle((120, 190, 560, 330), outline=(255, 255, 0, 180))
    d.line((0, 340, W, 340), fill=(255, 255, 0, 160))
    chk.alpha_composite(lay); chk.convert('RGB').save(OUT + '/check-overlay.png')
    a = np.array(out); print(out.size, 'colors', len(np.unique(a.reshape(-1, 3), axis=0)))

if __name__ == '__main__':
    main()
