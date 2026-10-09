# 자연 숲 마당 전투 배경(640x360, 낮·맑음 한 장). WAVE-BRIEF-3 A 절 규약:
#   위 ~45% = 수관 틈으로 보이는 푸른 하늘·구름 → 먼 수관 줄(옅음) → 짙은 수관 벽 → 붉은 줄기 벽(2배, 숲 빈터 북쪽 가장자리), 지평선 y≈176.
#   아래 = 3/4 바닥(이 장소의 풀 표본 + 맨땅 길 얼룩 + 짙은 풀숲 오토타일 그대로). 배틀러 자리(x120~560, y190~330)는 비우고
#   물체(큰 나무·어린 전나무·낙엽 덤불·오두막 모서리·바위)는 양쪽 가장자리·뒤에만. 맨 아래 20px 는 HUD 가림.
#   하늘은 단색 띠 4개 + 체크 디더 경계 + 손 구름 덩이(bleak-moor mb_battle 의 sky/cloud 식 사본), 96색 이하·불투명.
import os, sys, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from nfc_base import *
from px2 import _hash
import nfc_ground as G, nfc_auto as A, nfc_veg as V, nfc_struct as T

W, H, HZ = 640, 360, 176
CA = R7('nfcan'); SK = PAL['nfsky']


def sky(a, bands):
    y0 = 0
    for i, (ye, c) in enumerate(bands):
        a[y0:ye, :, :3] = hx(c); y0 = ye
    xs = np.arange(W)
    for i in range(len(bands) - 1):
        ye = bands[i][0]; nxt = hx(bands[i + 1][1])
        a[ye - 1, (xs + ye) % 2 == 0, :3] = nxt
        a[ye - 2, (xs + ye) % 4 == 0, :3] = nxt


def cloud(a, cx, cy, w, h, ramp, seed):
    """손 구름 덩이: 윗변 둥근 혹, 밑변 납작, 혹마다 왼쪽 위 밝다. ramp 4색(밑 그늘·그늘·몸·밝음)."""
    Y, X = np.mgrid[0:H, 0:W]
    rng = np.random.RandomState(seed); k = max(3, int(w / max(6, h * 0.9)))
    m = np.zeros((H, W), bool); tone = np.full((H, W), 2, int); lobes = []
    for i in range(k):
        t = (i + 0.5) / k; env = math.sin(math.pi * (0.08 + 0.84 * t)) ** 0.8
        r = max(3.0, h * env * rng.uniform(0.6, 1.0)); bx = cx - w / 2 + t * w + rng.uniform(-2, 2)
        lobes.append((bx, r)); m |= ((X - bx) ** 2 + ((Y - (cy - r * 0.55)) * 1.05) ** 2) <= r * r
    m |= (Y <= cy) & (Y >= cy - max(2, h * 0.3)) & (np.abs(X - cx) <= w / 2); m &= Y <= cy
    for bx, r in lobes:
        by = cy - r * 0.55
        inl = ((X - bx) ** 2 + (Y - by) ** 2) <= r * r
        d = ((X - (bx - r * 0.35)) ** 2 + (Y - (by - r * 0.45)) ** 2) / (r * r)
        tone = np.where(inl & (d < 0.3), np.maximum(tone, 3), tone)
    tone = np.where(Y >= cy - max(1, int(h * 0.16)), 1, tone); tone = np.where(Y == cy, 0, tone)
    for t in range(4): a[m & (tone == t), :3] = hx(ramp[t])


def n1(x, sc, seed):
    x = np.asarray(x, float) / sc; i = np.floor(x).astype(np.int64); f = x - i; f = f * f * (3 - 2 * f)
    return np.array([_hash(int(v), 0, seed) for v in i.ravel()]).reshape(i.shape) * (1 - f) + np.array([_hash(int(v) + 1, 0, seed) for v in i.ravel()]).reshape(i.shape) * f


def canopy_band(a, ybot, amp, seed, t_rim, t_body, lobe_r=10, fill_to=0):
    """옆에서 본 수관 줄: 아래 끝이 둥근 잎 덩이(반원)로 굽이치고, 덩이마다 테가 밝고 위로 갈수록 짙다(잎 비늘 결)."""
    xs = np.arange(W)
    k = 0; x = -lobe_r
    lobes = []
    while x < W + lobe_r:
        r = lobe_r * (0.7 + 0.6 * _hash(k, 1, seed)); cy = ybot - r - amp * _hash(k, 2, seed)
        lobes.append((x, cy, r)); x += r * 1.35; k += 1
    for y in range(fill_to, ybot + 2):
        for x in range(W):
            best = None
            for (lx, ly, r) in lobes:
                if abs(x - lx) > r + 1: continue
                d = math.hypot((x + 0.5 - lx) / r, (y + 0.5 - ly) / r)
                if d <= 1 or y < ly:
                    dep = (1 - d) * r if y >= ly else r + (ly - y)
                    if best is None or dep < best: best = dep
            if best is None: continue
            t = t_rim - best * 0.30 + A.SCALE[y % 16, x % 16] * 0.9 + (A.LEAFN[y % 16, x % 16] - 0.5) * 0.6
            t = int(round(max(t_body, min(6, t))))
            a[y, x, :3] = CA[t]


def scale2(im): return im.resize((im.width * 2, im.height * 2), Image.NEAREST)
def place(img, im, x, ybot): img.alpha_composite(im, (int(x), int(ybot - im.height)))


def backdrop():
    a = np.zeros((H, W, 4), np.uint8); a[..., 3] = 255
    sky(a, [(18, SK[3]), (40, SK[4]), (62, SK[5]), (90, SK[5])])
    CL = [SK[3], SK[4], SK[5], SK[6]]
    cloud(a, 120, 30, 150, 14, CL, 41); cloud(a, 470, 40, 130, 12, CL, 43)
    canopy_band(a, 78, 18, 3, 5.0, 3, lobe_r=12)                          # 먼 수관 줄(옅은 회록)
    canopy_band(a, 118, 26, 7, 4.6, 0, lobe_r=15)                         # 가까운 짙은 수관 벽(속 검정)
    img = Image.fromarray(a, 'RGBA')
    # 붉은 줄기 벽(2배): 수관 밑에서 지평선까지
    tw = scale2(V.trunk_wall())
    for x in range(0, W, tw.width): img.alpha_composite(tw.crop((0, 18, tw.width, tw.height)), (x, HZ - (tw.height - 18) + 4))
    a = np.array(img)
    canopy_band(a, 112, 20, 11, 4.4, 0, lobe_r=13, fill_to=60)            # 수관 테가 줄기 윗부분을 덮는다
    return Image.fromarray(a, 'RGBA')


def floor():
    """전투 바닥(40x12칸 = 640x192, y 176~368): 맨 바탕(풀·풀 포기 많은 풀) → 오토타일 덩이(맨땅 길 얼룩·짙은 풀숲) — 데모 맵과 같은 순서."""
    CW, CH = 40, 12
    gr = G.ground_grass(); tu = G.ground_grass_tufty(); sh = G.ground_grass_shade()
    im = Image.new('RGBA', (CW * 16, CH * 16))
    for y in range(CH):
        for x in range(CW):
            src = tu if ((x * 7 + y * 3) % 11 < 4) else gr
            if y == 0: src = sh
            im.alpha_composite(src.crop(((x % 3) * 16, (y % 3) * 16, (x % 3) * 16 + 16, (y % 3) * 16 + 16)), (x * 16, y * 16))
    def ell(cx, cy, rx, ry, sd):
        return {(x, y) for y in range(CH) for x in range(CW) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 + 0.5 * (_hash(x, y, sd) - 0.5)}
    dirt = ell(20, 6.2, 11.5, 3.2, 1) | {(x, y) for x in range(CW) for y in range(CH) if abs(x - (20 + 2.0 * math.sin(y / 2.5))) < 1.3}
    tall = ell(2.5, 3.0, 4.2, 2.6, 2) | ell(37.5, 4.0, 4.0, 2.6, 3) | ell(4.0, 10.0, 3.0, 1.6, 4) | ell(36.0, 10.5, 3.0, 1.4, 5)
    tall -= dirt
    for cells, shh in ((dirt, A.dirt_sheet()), (tall, A.tall_sheet())):
        on = lambda x, y, c=cells: (x, y) in c or ((x < 0 or x >= CW) and c is tall)
        for (x, y) in cells: im.alpha_composite(cell_of(shh, nb_code(on, x, y)), (x * 16, y * 16))
    return im


def build():
    img = backdrop()
    img.alpha_composite(floor(), (0, HZ))
    a = np.array(img); a[HZ, :, :3] = (np.array(a[HZ, :, :3], float) * 0.7).astype(np.uint8); img = Image.fromarray(a, 'RGBA')
    cab = T.cabin()
    objs = [('cabin', cab, -54, 214), ('big', V.big_tree(1111, True), 576, 262), ('pine', V.pine_young(), 90, 200), ('pine', V.pine_young(1411, 26), 520, 196),
            ('pmid', V.pine_mid(), 596, 200), ('aut', V.autumn_shrub_l(), 70, 240), ('aut', V.autumn_shrub_s(), 556, 214), ('rock', V.rock_l(), 4, 300),
            ('bush', V.bush_round(), 600, 318), ('barrel', T.barrel_stack(), 52, 214), ('crate', T.crate(), 70, 214), ('rock', V.rock_s(), 104, 330),
            ('flower', V.starflower(), 40, 330), ('flower', V.starflower(1822, False), 580, 336), ('fern', V.fern(), 96, 292), ('sapl', V.sapling(), 548, 300),
            ('stump', V.stump(), 612, 340), ('tuft', V.grass_tuft_l(), 12, 346)]
    for (nm, im, x, yb) in sorted(objs, key=lambda o: o[3]): place(img, im, x, yb)
    a = np.array(img); a[340:, :, :3] = (a[340:, :, :3].astype(float) * 0.55).astype(np.uint8)
    out = Image.fromarray(a, 'RGBA').convert('RGB').quantize(colors=96, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    return out


def overlay(bg):
    """가짜 전투원 표식: 적 3(왼쪽), 아군 4(오른쪽 아래), 각 48x48 반투명 사각 + 배틀러 자리 노란 테."""
    from PIL import ImageDraw
    o = bg.convert('RGBA'); d = Image.new('RGBA', o.size); dd = ImageDraw.Draw(d)
    for (x, y) in ((150, 200), (220, 236), (150, 272)):
        dd.rectangle((x, y, x + 47, y + 47), fill=(220, 60, 60, 110), outline=(255, 120, 120, 255))
    for (x, y) in ((430, 206), (470, 238), (430, 270), (500, 280)):
        dd.rectangle((x, y, x + 47, y + 47), fill=(60, 120, 230, 110), outline=(130, 180, 255, 255))
    dd.rectangle((120, 190, 560, 330), outline=(255, 255, 0, 255))
    o.alpha_composite(d); return o.convert('RGB')


if __name__ == '__main__':
    bg = build()
    bg.save(os.path.join(HERE, 'battle-bg.png'))
    overlay(bg).save(os.path.join(HERE, 'check-overlay.png'))
    a = np.array(bg); print(bg.size, bg.mode, len(np.unique(a.reshape(-1, 3), axis=0)))
