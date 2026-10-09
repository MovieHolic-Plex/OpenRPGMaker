# 녹청 지붕 저택가 전투 배경(640x360, 낮·흐림 한 장) — WAVE-BRIEF-3 A 절 규약. 다시 돌리면 같은 그림.   python3 make_battle_bg.py
# 위 ~45% = 늦겨울 흐린 하늘 띠(4색) + 손으로 찍은 구름 덩이 + 녹청 지붕 크림 석조 저택 줄(키트 건물을 줄여 하늘빛으로 조금 밀어 원경).
# 지평선 y≈170 = 크림 보도 판석 띠 + 낮은 돌 받침 쇠 난간(가운데 틈). 아래 = 둥근 자갈 광장(ground-cobble 결) — 가운데(x120~560, y190~330) 비움.
# 양쪽 가장자리: 왼쪽 세 등 가로등·가로수·화단·녹는 눈, 오른쪽 세워 둔 마차·가로등·눈 더미·웅덩이. 산출: battle-bg.png, check-overlay.png
import os, sys
OUT = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, OUT)
import vq_kit as KT
from vq_base import *
from vq_base import _h
import vq_ground as GR, vq_auto as AU
from PIL import ImageDraw

W, Hh = 640, 360
SKYB = [SKY[2], SKY[3], SKY[4], SKY[5]]
CLOUD = [SKY[6], SKY[5], SKY[3]]

def hazed(im, k, col=None):
    """원경: 불투명 화소를 하늘빛 쪽으로 k 만큼 민다(한 번 섞기라 명암 순위는 남는다)."""
    a = np.array(im).astype(np.float64); f = np.array(col or SKY[4], np.float64)
    a[..., :3] = a[..., :3] * (1 - k) + f * k
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8), 'RGBA')

def cloud(px, cx, cy, w, h, seed):
    """손으로 찍은 구름 덩이: 아랫변 평평, 위는 둥근 혹 3~5개, 아래 한 줄 그늘."""
    bumps = [(cx - w * .38 + w * .76 * i / 4 + 6 * H(i, 1, seed), cy - h * (.35 + .35 * H(i, 2, seed)), h * (.45 + .35 * H(i, 3, seed))) for i in range(5)]
    for y in range(int(cy - h * 1.6), int(cy + 2)):
        for x in range(int(cx - w / 2 - 4), int(cx + w / 2 + 4)):
            inside = abs(x - cx) < w / 2 and cy - h * .45 <= y <= cy
            for (bx, by, r) in bumps:
                if math.hypot(x - bx, (y - by) * 1.3) < r: inside = True
            if inside and 0 <= x < W and 0 <= y < Hh:
                px[x, y] = (CLOUD[2] if y >= cy - 1 else (CLOUD[1] if y > cy - h * .7 else CLOUD[0])) + (255,)

def main():
    im = Image.new('RGBA', (W, Hh), SKYB[0] + (255,)); px = im.load()
    for y in range(176):                                                     # 하늘 띠 4색(위 어둡고 지평선 쪽 밝게) + 띠 경계 디더 한 줄
        t = min(3, y // 44)
        for x in range(W):
            c = SKYB[t]
            if y % 44 == 0 and y and (x + y) % 2: c = SKYB[t - 1]
            px[x, y] = c + (255,)
    for (cx, cy, w, h, sd) in ((96, 40, 120, 20, 1), (340, 26, 150, 22, 2), (560, 46, 110, 18, 3), (460, 90, 80, 14, 4), (200, 92, 70, 12, 5)):
        cloud(px, cx, cy, w, h, sd)
    # 원경: 녹청 지붕 저택 두 줄(뒤 줄 작고 흐리게, 앞 줄은 벽을 맞대고 골목 틈만) — 바닥선 y168
    far = Image.new('RGBA', (W, Hh))
    def row(names, sc, k, ybot, x0, gaps):
        x = x0; i = 0
        while x < W:
            n = names[i % len(names)]; i += 1
            s_ = pad16(KT.img(n)); s_ = s_.resize((int(s_.width * sc), int(s_.height * sc)), Image.NEAREST)
            far.alpha_composite(hazed(s_, k), (x, ybot - s_.height)); x += s_.width + gaps[i % len(gaps)]
    row(['mansion-grand', 'townhouse-pair', 'mansion-turret', 'townhouse-narrow', 'mansion-grand', 'townhouse-balcony', 'townhouse-pair'],
        .5, .5, 150, -20, (0, 6, 0, 0, 10, 0))
    row(['townhouse-pair', 'shop-awning', 'townhouse-narrow', 'mansion-grand', 'house-gable-end', 'townhouse-balcony', 'mansion-turret', 'coach-house'],
        .66, .22, 168, -24, (0, 8, 0, 0, 0, 10, 0))
    im.alpha_composite(far)
    px = im.load()
    for y in range(160, 172):                                                # 저택 줄 앞 건너편 길(어두운 자갈 띠)
        for x in range(W):
            if px[x, y][:3] in [tuple(c) for c in SKYB] or y >= 168:
                px[x, y] = (COB[3] if (x // 3 + y) % 4 else COB[2]) + (255,)
    # 바닥: 둥근 자갈 광장(세계 좌표) + 지평선 쪽 판석 보도 띠
    Y, X = np.mgrid[0:Hh - 172, 0:W]
    floor = GR.cobble(X, Y)
    flag = GR.flagstone(X, Y)
    floor[:14] = flag[:14]
    fl = img_of(floor)
    im.alpha_composite(fl, (0, 172))
    px = im.load()
    for x in range(W):                                                       # 지평선 아래 그늘 두 줄
        for y in (172, 173): q = px[x, y]; px[x, y] = tuple(int(v * .7) for v in q[:3]) + (255,)
    def stamp(sheet, cells, ox, oy):
        S = set(cells)
        for (cx, cy) in cells:
            n = (1 if (cx, cy - 1) in S else 0) | (2 if (cx + 1, cy) in S else 0) | (4 if (cx, cy + 1) in S else 0) | (8 if (cx - 1, cy) in S else 0)
            im.alpha_composite(sheet.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (ox + cx * 16, oy + cy * 16))
    slush = AU.sheet('autotile-slush'); pud = AU.sheet('autotile-puddle'); moss = AU.sheet('autotile-moss')
    stamp(slush, [(0, 0), (1, 0), (2, 0), (3, 0), (0, 1), (1, 1), (2, 1), (0, 2)], 0, 196)
    stamp(slush, [(1, 0), (2, 0), (0, 1), (1, 1), (2, 1), (2, 2)], 580, 300)
    stamp(pud, [(0, 0), (1, 0), (2, 0), (1, 1), (2, 1)], 560, 222)
    stamp(pud, [(0, 0), (1, 0), (0, 1)], 30, 292)
    stamp(moss, [(0, 0), (1, 0), (0, 1)], 0, 320)
    # 지평선 줄: 낮은 돌 받침 쇠 난간(가운데 틈) — 키 낮아 배틀러 머리 위로 올라오지 않는다
    rail = AU.sheet('autotile-ironrail')
    for i in range(40):
        if 14 <= i <= 25: continue
        n = (2 if i + 1 < 40 and not (14 <= i + 1 <= 25) else 0) | (8 if i > 0 and not (14 <= i - 1 <= 25) else 0)
        im.alpha_composite(rail.crop(((n % 4) * 16, (n // 4) * 16, (n % 4) * 16 + 16, (n // 4) * 16 + 16)), (i * 16, 172))
    # 양쪽 가장자리 물체(가운데 비움)
    def put(name, x, ybot, flip=False):
        s = pad16(KT.img(name))
        if flip: s = s.transpose(Image.FLIP_LEFT_RIGHT)
        im.alpha_composite(s, (x, ybot - s.height))
    put('street-tree', -10, 250); put('lamp-triple', 70, 262); put('planter-box', 18, 282); put('bench-iron', 76, 318)
    put('urn-planter', 100, 222); put('bollard', 112, 300)
    put('carriage', 586, 270, flip=True); put('lamp-triple', 552, 236); put('snow-heap', 600, 222); put('barrel', 534, 330)
    put('street-tree', 612, 346); put('bollard', 528, 292); put('leaves-wet', 20, 236); put('manhole', 470, 340)
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
    a = np.array(out); print(out.size, 'colors', len(np.unique(a.reshape(-1, 3), axis=0)), 'alpha-free')

if __name__ == '__main__':
    main()
