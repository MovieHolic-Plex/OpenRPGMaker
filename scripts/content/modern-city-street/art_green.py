#!/usr/bin/env python3
"""modern_city 거리 녹지 — 큰 가로수·공원 나무·철쭉 덤불·잔디 변형을 코드 손 도트로 그린다(2026-10-14 quality-b).

버들항 v6 화풍 문법(빛은 좌상, 잎 덩이마다 명암 5~7단, 덩이 사이 짙은 골, 윤곽은 순검정·남색 잉크가 아니라 짙은 녹색,
땅 그림자, 잔디는 짧은 풀 획·짙은 풀 덩이)을 modern4 팔레트의 덧붙인 램프(lawn·canopy·grove·ginkgo·bark·azalea)로 옮겼다.
생성 이미지·트레이싱 없음. 덩이 위치는 손으로 적은 좌표, 명암은 덩이 중심에서의 방향으로 계산한다.

  python3 scripts/content/modern-city-street/art_green.py OUT.png   # 8배 미리보기
"""
import os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'modern-chipset'))
import palette as PAL   # noqa: E402

_R = {name: [tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) for c in cols] for name, _ch, cols, _d in PAL.build()}
LAWN, CAN, GROVE, GINK, BARK, AZA, WHITE, AMBER, INK, LEAF = (_R[k] for k in ('lawn', 'canopy', 'grove', 'ginkgo', 'bark', 'azalea', 'white', 'amber', 'ink', 'leaf'))
SHADOW = (11, 18, 36, 90)          # 팔레트 `~` 바닥 그림자(반투명)
LIGHT = np.array([-0.62, -0.78])   # 빛 = 좌상


def h32(*v):
    """결정적 화소 해시 0..1 (그림이 매번 같다)."""
    x = 2166136261
    for n in v:
        x = ((x ^ (int(n) & 0xffffffff)) * 16777619) & 0xffffffff
    x ^= x >> 13; x = (x * 0x5bd1e995) & 0xffffffff; x ^= x >> 15
    return x / 4294967296.0


def canvas(w, h): return np.zeros((h, w, 4), np.uint8)


def put(a, x, y, c):
    if 0 <= y < a.shape[0] and 0 <= x < a.shape[1]:
        a[y, x] = (*c[:3], c[3] if len(c) > 3 else 255)


def ellipse_shadow(a, cx, cy, rx, ry):
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            d = ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2
            if a[y, x, 3] == 0 and (d <= 0.72 or (d <= 1 and (x + y) % 2 == 0)): a[y, x] = SHADOW


# ---------------------------------------------------------------- 수관(잎 덩이 합집합)
def crown(a, clumps, ramp, outline_dark, outline_lite, seed, crease=None, speck=0.26, hi=None, sun=None):
    """clumps = [(cx, cy, r)] 뒤→앞 순서(앞 = 나중). ramp = 어두운→밝은 램프(5~7단).
    덩이마다 중심에서의 방향·높이로 단을 고르고, 잎 점(해시)으로 한 단씩 흔든다. 덩이 경계(앞 덩이 아래·오른쪽)는 짙은 골,
    합집합 바깥 윤곽은 아래·오른쪽 = outline_dark, 위·왼쪽 = outline_lite(선택 윤곽)."""
    H, W = a.shape[:2]
    own = -np.ones((H, W), int)
    for i, (cx, cy, r) in enumerate(clumps):
        for y in range(H):
            for x in range(W):
                dx, dy = x + .5 - cx, (y + .5 - cy) * 1.08
                # 잎 덩이 가장자리를 톱니처럼(둥근 공이 아니라 잎 뭉치)
                rr = r * (0.9 + 0.2 * h32(seed, i, int(np.degrees(np.arctan2(dy, dx))) // 25))
                if dx * dx + dy * dy <= rr * rr: own[y, x] = i
    leaf = np.zeros((H, W), int)      # 0 = 틈, 1 = 잎 몸, 2 = 잎 밝은 끝, 3 = 잎 아랫가
    for gy in range(-1, H // 3 + 2):
        for gx in range(-1, W // 3 + 2):
            hx = h32(seed + 7, gx, gy); hy = h32(seed + 8, gx, gy)
            lx = gx * 3 + (gy % 2) + int(hx * 3) - 1; ly = gy * 3 + int(hy * 3) - 1
            big = h32(seed + 6, gx, gy) < 0.45
            pts = [(0, 0), (1, 0), (0, 1), (1, 1)] + ([(2, 0), (2, 1), (1, 2)] if big else [])
            for dx, dy in pts:
                X, Y = lx + dx, ly + dy
                if 0 <= X < W and 0 <= Y < H:
                    leaf[Y, X] = 2 if (dx, dy) == (0, 0) else 3 if dy == max(p[1] for p in pts) and dx >= 1 else max(leaf[Y, X], 1)
    n = len(ramp); top = min(cy - r for cx, cy, r in clumps); bot = max(cy + r for cx, cy, r in clumps)
    crease = crease or ramp[0]
    for y in range(H):
        for x in range(W):
            i = own[y, x]
            if i < 0: continue
            cx, cy, r = clumps[i]
            off = np.array([x + .5 - cx, y + .5 - cy]) / r
            lit = float(np.dot(off, LIGHT))                      # +1 = 빛 쪽
            dist = float(np.hypot(*off))
            v = 0.58 + 0.6 * lit * min(1.0, dist * 1.3) - 0.36 * ((y - top) / max(1, bot - top)) ** 1.2
            # 잎 결: 흩뿌린 작은 잎(2~3화소) 사이로 짙은 바탕이 보인다 — 잎 좌상 화소가 밝고, 잎 밖 틈은 어둡다(버들항 수관의 잎 점)
            lf = leaf[y, x]
            if lf == 0: v -= 0.30
            elif lf == 2: v += 0.24
            elif lf == 3: v -= 0.10
            j = h32(seed, x, y)
            if j < speck * 0.4: v += 0.18
            elif j > 1 - speck * 0.4: v -= 0.18
            # 앞 덩이 경계 = 골(뒤 덩이와 맞닿는 아래·오른쪽 가장자리)
            for nx, ny in ((x + 1, y), (x, y + 1), (x + 1, y + 1)):
                if 0 <= nx < W and 0 <= ny < H and own[ny, nx] >= 0 and own[ny, nx] < i and lit < 0.35:
                    v = -1; break
            for nx, ny in ((x - 1, y), (x, y - 1)):
                if 0 <= nx < W and 0 <= ny < H and own[ny, nx] > i: v = min(v, 0.12)   # 앞 덩이 밑에 깔린 그늘
            lvl = int(np.clip(round(v * (n - 1)), 0, n - 1))
            c = crease if v < 0 else ramp[lvl]
            if sun and v > 0.9 and h32(seed + 9, x // 2, y) < 0.45: c = sun     # 햇빛 받은 잎 끝(노란 기)
            put(a, x, y, c)
    # 덩이 꼭대기 하이라이트(좌상 2~3화소)
    for i, (cx, cy, r) in enumerate(clumps):
        hx, hy = int(cx - r * 0.42), int(cy - r * 0.55)
        for dx, dy in ((0, 0), (1, 0), (0, 1)) if r >= 4 else ((0, 0),):
            if 0 <= hy + dy < H and 0 <= hx + dx < W and own[hy + dy, hx + dx] == i: put(a, hx + dx, hy + dy, hi or ramp[-1])
    # 바깥 윤곽(선택 윤곽)
    inside = own >= 0
    for y in range(H):
        for x in range(W):
            if not inside[y, x]: continue
            nb = [(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            edge = [(nx, ny) for nx, ny in nb if not (0 <= nx < W and 0 <= ny < H and inside[ny, nx])]
            if not edge: continue
            down_right = any(nx > x or ny > y for nx, ny in edge)
            put(a, x, y, outline_dark if down_right else outline_lite)
    return own


def trunk(a, x0, y0, y1, w, flare=2, ramp=None):
    """줄기(x0 = 왼쪽, y0..y1) — 왼쪽이 밝고 오른쪽이 어둡다, 밑동은 뿌리로 벌어진다, 윤곽은 bark[0]."""
    ramp = ramp or BARK
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        ext = int(round(flare * max(0, t - 0.6) / 0.4))
        xa, xb = x0 - ext, x0 + w - 1 + ext
        for x in range(xa, xb + 1):
            if x in (xa, xb): c = ramp[0]
            else:
                u = (x - xa) / max(1, xb - xa)
                c = ramp[3] if u < 0.34 else ramp[2] if u < 0.67 else ramp[1]
                if h32(7, x, y) < 0.12: c = ramp[4] if u < 0.5 else ramp[0]   # 껍질 결
            put(a, x, y, c)
    put(a, x0 - flare - 1, y1, ramp[0]); put(a, x0 + w + flare, y1, ramp[0])


def branch_glimpse(a, pts):
    for x, y in pts: put(a, x, y, BARK[1])


# ---------------------------------------------------------------- 그림들
def keyaki(variant='a'):
    """느티나무 가로수 3×4칸(48×64) — 둥근 부채꼴 수관, 잎 덩이 9~10개, 짧은 줄기, 땅 그림자."""
    a = canvas(48, 64)
    ellipse_shadow(a, 27, 57, 18, 5.4)
    trunk(a, 22, 38, 58, 5, flare=2)
    branch_glimpse(a, [(21, 39), (20, 38), (28, 39), (29, 37), (24, 36)])
    if variant == 'a':
        cl = [(10, 31, 9), (38, 31, 9), (24, 17, 11), (12, 18, 9), (36, 17, 9), (24, 33, 9), (17, 25, 9), (31, 25, 9), (24, 8, 7)]
    else:
        cl = [(10, 29, 9), (38, 32, 9), (22, 16, 11), (34, 15, 9), (13, 16, 8), (26, 33, 9), (15, 32, 8), (31, 24, 9), (19, 7, 6), (30, 8, 6)]
    crown(a, cl, CAN, GROVE[0], GROVE[2], seed=11 if variant == 'a' else 12, crease=GROVE[1], sun=LAWN[6])
    return a


def ginkgo_big():
    """은행나무 가로수(가을) 3×4칸 — 위로 선 달걀꼴, 노란 잎 덩이, 줄기 위 가지."""
    a = canvas(48, 64)
    ellipse_shadow(a, 27, 57, 14, 4.8)
    trunk(a, 22, 40, 58, 4, flare=2)
    branch_glimpse(a, [(21, 40), (27, 39), (24, 37)])
    cl = [(17, 35, 8), (31, 35, 8), (24, 26, 10), (15, 25, 8), (33, 25, 8), (24, 15, 9), (17, 15, 7), (31, 15, 7), (24, 6, 6), (24, 37, 7)]
    crown(a, cl, GINK, BARK[1], GINK[3], seed=21, crease=GINK[0], hi=AMBER[4], sun=AMBER[4])
    # 떨어진 잎(그림자 위 몇 점)
    for x, y in ((13, 58), (37, 56), (34, 60), (16, 61), (40, 59)): put(a, x, y, GINK[3])
    return a


def park_tree():
    """공원 큰 나무 4×5칸(64×80) — 넓은 수관(덩이 13개), 굵은 줄기, 넓은 그림자."""
    a = canvas(64, 80)
    ellipse_shadow(a, 36, 71, 24, 6.5)
    trunk(a, 29, 52, 74, 7, flare=3)
    branch_glimpse(a, [(28, 51), (26, 50), (37, 51), (39, 49), (32, 47)])
    cl = [(11, 40, 10), (53, 40, 10), (32, 24, 14), (13, 24, 11), (51, 24, 11), (23, 43, 11), (42, 43, 11), (32, 10, 10), (19, 11, 8), (45, 11, 8),
          (21, 31, 11), (43, 31, 11), (32, 42, 10)]
    crown(a, cl, CAN, GROVE[0], GROVE[2], seed=31, crease=GROVE[1], sun=LAWN[6])
    return a


def azalea(flower=True):
    """철쭉 덤불 2×2칸(32×32) — 낮은 둥근 덤불, 꽃(분홍) 점."""
    a = canvas(32, 32)
    ellipse_shadow(a, 18, 27, 14, 4)
    cl = [(8, 20, 6), (24, 20, 6), (16, 15, 7), (11, 13, 5), (21, 12, 5), (16, 22, 6)]
    own = crown(a, cl, CAN[1:6], GROVE[0], GROVE[2], seed=41 if flower else 42, crease=GROVE[1], speck=0.2)
    if flower:
        used = []
        for y in range(2, 30):
            for x in range(2, 30):
                if own[y, x] >= 0 and own[y + 1, x] >= 0 and own[y, x + 1] >= 0 and h32(43, x, y) < 0.09 and all(abs(x - u) + abs(y - v) > 3 for u, v in used):
                    used.append((x, y)); lit = (x + y) < 34
                    put(a, x, y, AZA[4] if lit else AZA[2]); put(a, x + 1, y, AZA[2] if lit else AZA[1]); put(a, x, y + 1, AZA[1] if lit else AZA[0])
    return a


# ---------------------------------------------------------------- 잔디 16×16
def lawn(kind, seed):
    """잔디 칸. kind: base(짧은 풀 획) · tuft(짙은 풀 덩이) · clover(흰 토끼풀 꽃) · dandelion(노란 꽃)."""
    a = canvas(16, 16)
    a[:, :] = (*LAWN[3], 255)
    # 바탕 디더(한 단 위·아래를 드문드문) — 단색 판이 아니게
    for y in range(16):
        for x in range(16):
            j = h32(seed, x, y)
            if j < 0.06: put(a, x, y, LAWN[2])
            elif j > 0.955: put(a, x, y, LAWN[4])
    # 짧은 풀 획: 아래 짙은 화소 + 위 밝은 끝(빛 좌상) — 칸 가장자리를 넘지 않게
    k = 0
    for y in range(1, 16):
        for x in range(16):
            if h32(seed + 1, x, y) < 0.055:
                put(a, x, y, LAWN[1]); put(a, x, y - 1, LAWN[5]); k += 1
                if h32(seed + 2, x, y) < 0.35 and x > 0: put(a, x - 1, y - 1, LAWN[4])
    if kind == 'tuft':
        cx, cy = 5 + int(h32(seed, 9) * 6), 6 + int(h32(seed, 10) * 5)
        for y in range(16):
            for x in range(16):
                rr = 1 + 0.35 * (h32(seed + 5, x // 2, y // 2) - 0.5)
                d = ((x + .5 - cx) / 4.8) ** 2 + ((y + .5 - cy) / 3.2) ** 2
                if d <= rr:
                    up = y < cy - 1
                    put(a, x, y, LAWN[2] if up and h32(seed + 4, x, y) < 0.5 else LAWN[1] if d < 0.5 * rr else LAWN[0])
        for dx in (-3, -1, 2):      # 덩이 위로 솟은 풀잎(밝은 끝)
            put(a, cx + dx, cy - 4, LAWN[5]); put(a, cx + dx, cy - 3, LAWN[4])
    if kind == 'clover':
        for x, y in ((4, 5), (11, 9), (7, 12)):
            x += int(h32(seed, x) * 2); y += int(h32(seed, y) * 2)
            put(a, x, y, WHITE[1]); put(a, x + 1, y, WHITE[0]); put(a, x, y + 1, LAWN[1])
    if kind == 'dandelion':
        for x, y in ((3, 4), (12, 7), (8, 12)):
            put(a, x, y, AMBER[1]); put(a, x - 1, y, AMBER[0]); put(a, x, y - 1, AMBER[3]); put(a, x, y + 1, LAWN[0])
    return a


PIECES = [
    # id, 한국어, kind(object-gate), 칸 폭, 칸 높이, 그리개
    ('mc-prop-keyaki-a', '느티나무 가로수(큰 수관)', 'organic', 3, 4, lambda: keyaki('a')),
    ('mc-prop-keyaki-b', '느티나무 가로수(큰 수관, 변형)', 'organic', 3, 4, lambda: keyaki('b')),
    ('mc-prop-ginkgo-big-a', '은행나무 가로수(가을, 큰 수관)', 'organic', 3, 4, ginkgo_big),
    ('mc-prop-park-tree-a', '공원 큰 나무', 'organic', 4, 5, park_tree),
    ('mc-prop-azalea-a', '철쭉 덤불(꽃)', 'organic', 2, 2, lambda: azalea(True)),
    ('mc-prop-azalea-b', '철쭉 덤불(잎)', 'organic', 2, 2, lambda: azalea(False)),
]
LAWNS = [('base', 101), ('base', 211), ('base', 307), ('base', 401), ('tuft', 503), ('tuft', 601), ('clover', 701), ('dandelion', 809)]
LAWN_KO = dict(base='잔디', tuft='잔디(짙은 풀 덩이)', clover='잔디(토끼풀 꽃)', dandelion='잔디(민들레)')


def lawn_cells():
    return [(f'{k}-{s}', LAWN_KO[k], lawn(k, s)) for k, s in LAWNS]


def piece_images():
    return [(pid, ko, kind, w, h, Image.fromarray(fn(), 'RGBA')) for pid, ko, kind, w, h, fn in PIECES]


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/qb-mc/green8.png'
    ims = piece_images(); S = 6
    W = sum(im.width * S + 16 for *_r, im in ims) + 16
    sheet = Image.new('RGBA', (max(W, 8 * (16 * S + 8)), 80 * S + 32 + 16 * S * 2 + 24), (72, 78, 86, 255))
    x = 16
    for *_r, im in ims: sheet.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, 16)); x += im.width * S + 16
    y = 80 * S + 32
    for i, (_n, _k, im) in enumerate(lawn_cells()):
        t = Image.fromarray(im, 'RGBA'); tile = Image.new('RGBA', (32, 32))
        for dx in (0, 16):
            for dy in (0, 16): tile.paste(t, (dx, dy))
        sheet.alpha_composite(tile.resize((32 * S, 32 * S), Image.NEAREST), (16 + i * (32 * S + 8), y))
    sheet.save(out); print(out, sheet.size)
