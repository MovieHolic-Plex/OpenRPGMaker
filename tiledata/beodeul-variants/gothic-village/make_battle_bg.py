# 고딕 마을 전투 배경(640x360, 낮·흐림 한 장) — WAVE-BRIEF-3 A 절 규약. 다시 돌리면 같은 그림.   python3 make_battle_bg.py
# 위 ~45% = 흐린 하늘 띠(4색) + 손으로 찍은 구름 덩이 + 안개 속 마을 지붕선·첨탑(키트 조각을 안개색으로 밀어 원경으로).
# 지평선 y≈170 = 묘지 쇠 울타리·돌담 줄. 아래 = 젖은 자갈 광장 바닥(ground-mudcobble 결) — 가운데(x120~560, y190~330)는 비운다.
# 양쪽 가장자리: 왼쪽 가로등·까마귀 고목, 오른쪽 비석·우물. 산출: battle-bg.png, check-overlay.png
import os, sys
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
import gv_kit as KT
from gv_kit import *
import gv_ground as GR, gv_auto as AU
from PIL import ImageDraw

W, Hh = 640, 360
SKY = [hx('#7d8590'), hx('#8a929c'), hx('#979ea7'), hx('#a3a9b1')]
CLOUD = [hx('#6a727e'), hx('#747c88'), hx('#5e6672')]

def fogged(im, k):
    """원경: 불투명 화소를 안개색 쪽으로 k 만큼 민다(단 하나의 섞기라 명암 순위는 남는다)."""
    a = np.array(im).astype(np.float64); f = np.array(FOG[2], np.float64)
    a[..., :3] = a[..., :3] * (1 - k) + f * k
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8), 'RGBA')

def cloud(px, cx, cy, w, h, seed):
    """손으로 찍은 구름 덩이: 아랫변 평평, 위는 둥근 혹 3~5개, 아래 한 줄 그늘."""
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
    for y in range(176):                                                     # 하늘 띠 4색(위 어둡고 지평선 쪽 밝게) + 띠 경계 디더 한 줄
        t = min(3, y // 44)
        for x in range(W):
            c = SKY[t]
            if y % 44 == 0 and y and (x + y) % 2: c = SKY[t - 1]
            px[x, y] = c + (255,)
    for (cx, cy, w, h, sd) in ((90, 44, 110, 22, 1), (330, 30, 140, 24, 2), (540, 52, 120, 20, 3), (450, 96, 80, 16, 4), (150, 104, 70, 14, 5)):
        cloud(px, cx, cy, w, h, sd)
    # 원경: 안개 속 마을 지붕선(키트 집들) + 첨탑 교회 — 아랫부분은 안개 띠가 덮는다
    far = Image.new('RGBA', (W, Hh))
    row = [('house-gable-small', -10), ('house-cross-gable', 40), ('house-gable-tall', 140), ('church-spire', 230), ('house-gable-wide', 360),
           ('house-crooked', 432), ('house-stair', 470), ('house-gable-tall', 560), ('cottage-gable', 612)]
    for (n, x) in row:
        s = KT.pad16(KT.img(n))
        k = 0.42 if n == 'church-spire' else 0.55
        sc = 0.6 if n == 'church-spire' else 0.72
        s = s.resize((int(s.width * sc), int(s.height * sc)), Image.NEAREST)
        far.alpha_composite(fogged(s, k), (x, 176 - s.height + (10 if n == 'church-spire' else 18)))
    im.alpha_composite(far)
    px = im.load()
    for y in range(146, 178):                                                # 낮게 깔린 안개 띠(2색 디더, 아래로 짙어짐)
        for x in range(W):
            f = (y - 146) / 32.0
            if H(x // 2, y, 31) < 0.25 + 0.75 * f: px[x, y] = (FOG[2] if f < 0.6 else FOG[1]) + (255,)
    # 바닥: 젖은 자갈 광장(ground-mudcobble 결을 세계 좌표로) + 가장자리 시든 풀·진창·이슬 풀
    Y, X = np.mgrid[0:Hh - 176, 0:W]
    cob = GR.mudcobble(X, Y)
    grass = GR.deadgrass(X, Y)
    flag = GR.churchflag(X, Y)
    floor = cob.copy()
    for yy in range(Hh - 176):
        for xx in range(W):
            d = min(xx, W - 1 - xx)
            lim = 70 + 28 * vnoise(xx, yy, 9.0, 41) - yy * 0.25
            if d < lim: floor[yy, xx] = grass[yy, xx]
            elif d > lim + 40 + 12 * vnoise(xx, yy, 7.0, 42): floor[yy, xx] = flag[yy, xx] * 0.9
    fl = Image.fromarray(np.dstack([np.clip(np.rint(floor), 0, 255).astype(np.uint8), np.full(floor.shape[:2], 255, np.uint8)]), 'RGBA')
    im.alpha_composite(fl, (0, 176))
    px = im.load()
    for x in range(W):                                                       # 지평선 아래 그늘 두 줄(바닥이 원경 뒤에서 시작)
        for y in (176, 177): q = px[x, y]; px[x, y] = tuple(int(v * 0.72) for v in q[:3]) + (255,)
    # 진창·이슬 풀 덩이(가장자리, 오토타일 칸 그대로 이어 붙임)
    mire = AU.autotile_mire(); dew = AU.autotile_dewgrass(); leaf = AU.autotile_leafbone()
    def stamp(sheet, cells, ox, oy):
        S = set(cells)
        for (cx, cy) in cells:
            n = (1 if (cx, cy - 1) in S else 0) | (2 if (cx + 1, cy) in S else 0) | (4 if (cx, cy + 1) in S else 0) | (8 if (cx - 1, cy) in S else 0)
            im.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (ox + cx * 16, oy + cy * 16))
    stamp(dew, [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (0, 2), (1, 2), (2, 1), (0, 3)], 0, 200)
    stamp(leaf, [(0, 0), (1, 0), (0, 1), (1, 1), (2, 1), (1, 2)], 560, 232)
    stamp(mire, [(0, 0), (1, 0), (2, 0), (1, 1), (2, 1)], 578, 300)
    stamp(mire, [(0, 0), (1, 0), (0, 1), (1, 1)], 40, 300)
    stamp(dew, [(0, 0), (1, 0), (2, 0), (1, 1), (2, 1), (2, 2)], 580, 186)
    # 지평선 줄: 쇠 울타리(가운데 틈) — 키 낮은 물체라 배틀러 머리 위로 올라오지 않는다
    fence = AU.autotile_ironfence()
    for i in range(40):
        if 15 <= i <= 24: continue
        n = (2 if i + 1 < 40 and not (15 <= i + 1 <= 24) else 0) | (8 if i > 0 and not (15 <= i - 1 <= 24) else 0)
        im.alpha_composite(fence.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (i * 16, 166))
    # 양쪽 가장자리 물체(가운데 비움)
    def put(name, x, ybot, flip=False):
        s = KT.pad16(KT.img(name))
        if flip: s = s.transpose(Image.FLIP_LEFT_RIGHT)
        im.alpha_composite(s, (x, ybot - s.height))
    put('dead-tree-crows', -6, 262); put('lamppost-gas', 64, 238); put('tomb-cross-stone', 30, 300); put('crow-post', 96, 214)
    put('dead-tree-large', 590, 250, flip=True); put('tomb-obelisk', 566, 214); put('tomb-cracked', 600, 296); put('cross-crooked', 618, 330)
    put('lamppost-gas', 560, 330); put('tomb-broken', 12, 340); put('leaves-scatter', 100, 300); put('bones-scatter', 548, 280)
    put('fog-bank', 0, 186); put('fog-bank', 594, 196, True)
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
