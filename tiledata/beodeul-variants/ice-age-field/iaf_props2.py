# 빙하기 설원 보정 패스 — 눈밭 한가운데를 채울 이름 붙일 수 있는 소품 8종(손 도트, 버들항 팔레트·px2 볼륨 페인터·pz.fin 윤곽). 결정적.
# 3/4 시점: 윗면 + 앞면, 옆면 없음, 빛 왼쪽 위. 눈 위에 솟은 것들이라 밑동마다 눈 더미와 바람 반대쪽(동·남) 푸른 그늘.
import math
import numpy as np
from PIL import Image
from iaf_base import C, RGB, F, put, blank, hash2, _hash, SN, IC
from parts5b import lump
from vprops import snowcap
from iaf_pieces import _bone_seg, _blob
from iaf_props import _pole


def _scoop(px, W, H, cx, cy, rx, ry, a=110):
    """바람이 깎은 눈 오목(물체 동·남쪽 반달 그늘) — 투명 칸에만, 반투명."""
    for y in range(H):
        for x in range(W):
            d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
            if 0.55 < d <= 1 and px[x, y][3] == 0 and (x + 0.5 > cx - rx * 0.3):
                px[x, y] = SN[3] + (a,) if d < 0.8 else SN[4] + (a,)


# ================================================================ 바위 머리 · 바위 턱
def _rockslab(c, x0, yt, w, dT, hF, seed=1, snow=True):
    """모난 바위 덩이(3/4): 윗면 dT 행(눈 덮임 6·5) + 앞면 hF 행(돌 4 → 오른쪽 2열 2, 세로 금, 아랫줄 한 단 어둡다).
    윗가장자리는 칸마다 ±1 들쭉날쭉, 양 모서리는 깎였다."""
    c.new()
    for x in range(x0, x0 + w):
        k = x - x0
        jt = int(hash2(x, 1, seed) * 2) - (1 if k in (0, w - 1) else 0) * -1
        cham = 2 if k in (0, w - 1) else (1 if k in (1, w - 2) else 0)
        y_top = yt + jt + cham
        for y in range(y_top, yt + dT + hF):
            if y < yt + dT + (1 if hash2(x, 2, seed) > 0.6 else 0):
                if snow: c.tone(x, y, 'snow', 6 if (k < w * 0.6 and y < yt + dT - 1) else 5)
                else: c.tone(x, y, 'stone', 5)
            else:
                t = 4 if k < w * 0.45 else (3 if k < w - 2 else 2)
                if y >= yt + dT + hF - 1: t -= 1
                if hash2(x, 3, seed) > 0.82 and y > yt + dT: t = 1                     # 세로 금
                c.tone(x, y, 'stone', max(1, t))


def rock_heads(seed=1):
    """눈 밖으로 머리만 내민 모난 바위 셋(2x1 장식, 걷기): 윗면 눈, 앞면 회색 돌, 밑동은 눈 더미에 묻혔고 동쪽에 바람 오목 그늘."""
    W, H = 32, 16
    c = C(W, H, seed=701 + seed)
    for i, (x0, yt, w, dT, hF) in enumerate(((2, 4, 10, 3, 7), (13, 2, 8, 3, 8), (22, 7, 7, 2, 5))):
        c.group(1 + i); _rockslab(c, x0, yt, w, dT, hF, seed + i)
    c.group(9)
    for (cx, w) in ((7, 7), (17, 6), (26, 5)): lump(c, cx, 11, w, 1.4, 2, 'snow', top=6, front=(5, 4), seed=cx, tex=0.05)
    im = F(c, 0.64); px = im.load()
    _scoop(px, W, H, 19, 12, 15, 4.0, 90)
    return im


def rock_outcrop(seed=1):
    """눈벌판을 뚫고 솟은 바위 턱(3x2): 뒤로 갈수록 높은 모난 바위 판 다섯이 층져 솟았다 — 판마다 윗면 눈, 앞면 돌 결·세로 금,
    바람 쪽(왼) 서리 깃, 동쪽 바람 오목, 밑동 눈 더미. 밑줄 3칸 막힘, 위 걷기+가림."""
    W, H = 48, 32
    c = C(W, H, seed=711 + seed); c.shadow(26, 28.5, 21, 2.4, 80)
    for i, (x0, yt, w, dT, hF) in enumerate(((12, 2, 13, 4, 14), (25, 7, 11, 4, 11), (3, 9, 11, 3, 11), (33, 13, 10, 3, 8), (17, 14, 12, 3, 9))):
        c.group(1 + i); _rockslab(c, x0, yt, w, dT, hF, seed * 7 + i)
    c.group(9); lump(c, 24, 24, 21, 2.0, 3, 'snow', top=6, front=(5, 4), seed=seed, tex=0.05)
    im = F(c, 0.64); px = im.load()
    for y in range(4, 26):                                                      # 왼쪽 서리 깃
        for x in range(1, W):
            if px[x, y][3] > 200 and px[x - 1, y][3] < 200 and hash2(x, y, seed) > 0.45:
                put(px, W, H, x - 1, y, SN[6]); break
    _scoop(px, W, H, 30, 26, 19, 5.0, 90)
    return im


# ================================================================ 얼어붙은 덤불
def frozen_bush(seed=1):
    """얼어붙은 덤불(2x2): 밑동에서 갈라져 뻗은 잔가지 덤불이 얼음에 덮였다 — 가지 왼쪽마다 흰 상고대, 끝에 맺힌 얼음 방울,
    가지 사이 걸린 눈 뭉치, 밑동 눈 더미. 밑줄 2칸 막힘."""
    W, H = 32, 32
    c = C(W, H, seed=721 + seed); c.shadow(16, 28.5, 12, 2.0, 90)
    rs = np.random.default_rng(seed + 5)
    tips = []
    for i in range(9):
        a = math.pi * (0.22 + 0.56 * i / 8) + rs.uniform(-0.08, 0.08)
        L = rs.uniform(17, 25) * (0.75 + 0.25 * math.sin(i * 1.7 + 0.5))
        bx = 16 + rs.uniform(-2, 2); by = 27
        mx = bx - math.cos(a) * L * 0.55; my = by - math.sin(a) * L * 0.55
        tx = bx - math.cos(a) * L + rs.uniform(-2, 2); ty = by - math.sin(a) * L
        c.group(1 + i)
        _pole(c, bx, by, mx, my, 1.4, 'bark', seed + i, lit=4, dark=2)
        _pole(c, mx, my, tx, ty, 0.8, 'bark', seed + i, lit=4, dark=2)
        sx = mx + (tx - mx) * 0.4; sy = my + (ty - my) * 0.4                       # 곁가지
        _pole(c, sx, sy, sx - math.cos(a + 0.7) * 5, sy - math.sin(a + 0.7) * 5, 0.5, 'bark', seed + i, lit=4, dark=2)
        tips.append((tx, ty))
    c.group(20); lump(c, 16, 23, 10, 2.0, 3, 'snow', top=6, front=(5, 4), seed=seed, tex=0.05)
    im = F(c, 0.66); px = im.load()
    src = im.copy().load()
    for y in range(1, H - 6):                                                   # 상고대: 가지 왼쪽·윗면에 흰 깃, 반투명 얼음 덧씌움
        for x in range(1, W - 1):
            a = src[x, y]
            if a[3] < 200 or sum(a[:3]) > 600: continue
            if src[x - 1, y][3] < 100 and _hash(x, y, 7) > 0.3: put(px, W, H, x - 1, y, SN[6] if _hash(x, y, 8) > 0.4 else IC[5])
            if src[x, y - 1][3] < 100 and _hash(x, y, 9) > 0.35: put(px, W, H, x, y - 1, SN[6])
            elif _hash(x, y, 11) > 0.8: put(px, W, H, x, y, IC[4])
    for (tx, ty) in tips:                                                       # 끝 얼음 방울
        x, y = int(tx), int(ty)
        put(px, W, H, x, y, IC[6]); put(px, W, H, x, y + 1, IC[4])
    for (cx, cy, r) in ((10, 12, 2.8), (21, 9, 2.4), (16, 16, 2.6), (24, 17, 2.0)):          # 가지 사이 걸린 눈 뭉치
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                d = ((x + 0.5 - cx) / (r * 1.3)) ** 2 + ((y + 0.5 - cy) / r) ** 2
                if d <= 1: put(px, W, H, x, y, SN[6] if y < cy else (SN[5] if d < 0.7 else SN[3]))
    return im


# ================================================================ 설피 발자국(장식, 걷기)
def snowshoe_trail(seed=1):
    """설피(눈신) 발자국 줄(3x1 장식, 걷기): 사람이 신은 둥근 눈신 자국이 좌우 엇갈려 사선으로 이어진다 — 오목 안 윗벽 그늘·아랫벽 밝음,
    눈신 격자 무늬 흔적, 발끝 쪽으로 튄 눈. 짐승 발자국(tracks_beast)과 다른 사람 자국."""
    W, H = 48, 16
    im = blank(W, H); px = im.load()
    for i in range(6):
        cx = 4 + i * 7.6; cy = 10.5 - i * 1.0 + (2.2 if i % 2 else -0.4)
        for y in range(H):
            for x in range(W):
                dx = (x + 0.5 - cx) / 2.3; dy = (y + 0.5 - cy) / 3.2
                d = dx * dx + dy * dy
                if d <= 1:
                    c = SN[3] if dy < -0.25 else SN[4]
                    if (x + y) % 3 == 0 and -0.6 < dy < 0.6 and abs(dx) < 0.7: c = SN[3]   # 눈신 격자 흔적
                    put(px, W, H, x, y, c)
                elif d <= 1.7 and dy > 0.2: put(px, W, H, x, y, SN[6])              # 아랫벽 턱 밝음
        put(px, W, H, int(cx + 2), int(cy - 4), SN[6]); put(px, W, H, int(cx + 3), int(cy - 3), SN[5])   # 발끝에 튄 눈
    return im


# ================================================================ 얼음 기둥
def ice_pillar(seed=1):
    """얼음 기둥(1x3): 땅에서 솟은 반투명한 굵은 얼음 기둥 — 깎인 면(왼 밝음·가운데 흰 결·오른 그늘), 갇힌 기포, 가로 금,
    꼭대기 눈 모자, 밑동 얼음 둔덕과 눈. 밑동 1칸만 막힘, 위 걷기+가림."""
    W, H = 16, 48
    c = C(W, H, seed=731 + seed); c.shadow(8, 45.5, 6.5, 1.8, 100)
    c.group(1)
    for y in range(3, 44):
        f = (y - 3) / 41.0
        half = 3.6 + 1.4 * f + 0.5 * math.sin(y / 5.0 + seed)
        cx = 8 + 0.6 * math.sin(y / 9.0 + seed)
        for x in range(int(cx - half) - 1, int(cx + half) + 2):
            u = (x + 0.5 - cx) / half
            if abs(u) > 1: continue
            t = 5 if u < -0.5 else (6 if u < -0.15 else (4 if u < 0.35 else (3 if u < 0.75 else 2)))
            if y < 6: t = min(6, t + 1)
            c.tone(x, y, 'ice', t)
    for (y0, L, x0) in ((14, 5, 5), (27, 4, 8), (35, 5, 6)):                    # 가로 금
        for j in range(L):
            if c.m[y0 + j // 3][x0 + j]: c.tone(x0 + j, y0 + j // 3, 'ice', 1); c.tone(x0 + j, y0 + j // 3 + 1, 'ice', 5)
    for (x, y) in ((7, 10), (9, 19), (6, 24), (8, 31), (10, 38)): c.tone(x, y, 'ice', 6)   # 갇힌 기포
    c.group(2); lump(c, 8, 39, 7.5, 2.0, 3, 'ice', top=5, front=(4, 3), seed=seed, tex=0.1)
    c.group(3); lump(c, 8, 42, 7.0, 1.6, 2, 'snow', top=6, front=(5, 4), seed=seed + 1, tex=0.05)
    return snowcap(F(c, 0.7), 3, seed + 3)


# ================================================================ 서 있는 매머드 뼈대
def mammoth_skeleton(seed=1):
    """선 채로 언 거대 짐승 뼈대(5x4): 등혹 위로 굽은 등뼈와 가시 돌기, 늘어진 갈비(먼 쪽 어둡다), 네 다리뼈(먼 다리 어둡다),
    골반, 앞으로 숙인 머리뼈와 크게 휜 엄니 한 쌍, 뼈 위 눈, 발치 눈 더미. 밑줄(발) 막힘, 위 걷기+가림."""
    W, H = 80, 64
    c = C(W, H, seed=741 + seed); c.shadow(40, 60.5, 33, 2.6, 80)
    def dim(g, k=2):
        for y in range(c.h):
            for x in range(c.w):
                if c.id[y][x] == c.nid and c.fix[y][x] is not None: c.fix[y][x] = max(1, c.fix[y][x] - k)
    # 먼 쪽 다리(어둡게)
    for i, (hx, hy, fx) in enumerate(((22, 30, 25), (52, 28, 56))):
        c.group(10 + i); _bone_seg(c, [(hx + 3, hy), (hx + 4, hy + 13), (fx + 2, hy + 21), (fx + 2, 57)], [2.4, 2.0, 1.8, 2.0], 'bone', 10 + i); dim(c)
    # 먼 쪽 갈비
    spine = [(10, 30), (18, 24), (28, 20), (40, 15), (50, 14), (58, 18), (63, 24)]
    for i, sx in enumerate((26, 32, 38, 44, 50)):
        sy = 22 - (sx - 26) * 0.18
        c.group(20 + i); _bone_seg(c, [(sx + 2, sy), (sx + 7, sy + 8), (sx + 7, sy + 17), (sx + 4, sy + 21)], [1.4, 1.3, 1.1, 0.9], 'bone', 20 + i); dim(c)
    # 엄니(먼 쪽)
    c.group(30); _bone_seg(c, [(64, 33), (70, 41), (76, 39), (78, 31), (75, 24)], [2.0, 1.9, 1.6, 1.1, 0.7], 'tusk', 30); dim(c)
    # 등뼈 + 돌기, 골반, 꼬리
    c.group(1); _bone_seg(c, spine, [2.2, 2.6, 2.8, 3.0, 2.8, 2.4, 2.2], 'bone', 1)
    for i, (x, y) in enumerate(spine[1:-1]):
        _bone_seg(c, [(x, y - 1), (x - 1, y - 4 - (2 if 2 <= i <= 3 else 0))], [1.3, 0.8], 'bone', 40 + i)
    c.group(2); c.ellipsoid(17, 28, 6.5, 5, 'bone', amb=0.25, bump=0.3)
    c.tone(16, 28, 'bone', 1); c.tone(17, 28, 'bone', 1); c.tone(16, 29, 'bone', 2)
    _bone_seg(c, [(10, 30), (5, 35), (3, 40)], [1.4, 1.0, 0.7], 'bone', 3)
    # 가까운 쪽 갈비
    for i, sx in enumerate((24, 30, 36, 42, 48, 54)):
        sy = 23 - (sx - 24) * 0.2
        L = 1.0 - abs(i - 2.5) * 0.07
        c.group(50 + i); _bone_seg(c, [(sx, sy + 1), (sx - 4 * L, sy + 9), (sx - 4 * L, sy + 19 * L), (sx - 1, sy + 24 * L)], [1.9, 1.7, 1.5, 1.2], 'bone', 50 + i)
    # 가까운 쪽 다리
    for i, (hx, hy, fx) in enumerate(((17, 31, 18), (48, 27, 50))):
        c.group(60 + i); _bone_seg(c, [(hx, hy), (hx + 1, hy + 13), (fx, hy + 21), (fx, 58)], [3.0, 2.4, 2.1, 2.4], 'bone', 60 + i)
        c.ellipsoid(hx + 0.5, hy + 13, 2.6, 2.0, 'bone', amb=0.3)               # 무릎
    # 머리뼈(앞으로 숙였다) + 가까운 엄니
    c.group(70); c.ellipsoid(64, 26, 7.5, 7, 'bone', amb=0.25, bump=0.3, bsc=3)
    c.ellipsoid(67, 32, 4.2, 4.0, 'bone', amb=0.25, bias=-0.05)
    for (x, y) in ((63, 25), (64, 25), (63, 26), (68, 31), (69, 31), (68, 32)): c.tone(x, y, 'bone', 1)
    c.group(71); _bone_seg(c, [(65, 35), (69, 45), (76, 46), (79, 38), (77, 29)], [2.6, 2.4, 2.0, 1.4, 0.8], 'tusk', 71)
    # 발치 눈 더미
    c.group(80)
    for (cx, w) in ((19, 8), (27, 6), (51, 8), (58, 6)):
        lump(c, cx, 53, w, 2.0, 3, 'snow', top=6, front=(5, 4), seed=cx, tex=0.05)
    im = F(c, 0.64)
    return snowcap(im, 2, seed + 7)


# ================================================================ 돌무지 · 꽂힌 창
def cairn_spear(seed=1):
    """사냥꾼 돌무지와 꽂힌 창(1x2): 납작한 돌 다섯을 쌓은 무지(돌마다 윗면 눈), 기울여 꽂은 나무 창에 돌 촉과 가죽 끈, 밑동 눈. 밑동 칸만 막힘."""
    W, H = 16, 32
    c = C(W, H, seed=751 + seed); c.shadow(8, 29.5, 6, 1.6, 90)
    c.group(1); _pole(c, 11, 28, 13, 4, 0.8, 'wood', seed, lit=5, dark=2)
    c.group(2)
    for (x, y) in ((13, 3), (13, 2), (14, 2), (13, 1), (14, 1), (13, 0)): c.tone(x, y, 'stone', 4 if x == 13 else 2)
    for (x, y) in ((12, 6), (11, 7), (11, 8), (10, 9), (10, 10), (11, 11)): c.tone(x, y, 'hide', 4 if y < 9 else 3)
    for i, (cx, cy, rx, ry) in enumerate(((7, 26, 5.5, 2.6), (7.5, 22.5, 4.6, 2.3), (6.5, 19.2, 4.0, 2.0), (7.5, 16.2, 3.2, 1.8), (7, 13.6, 2.3, 1.5))):
        c.group(10 + i); c.ellipsoid(cx, cy, rx, ry, 'stone', amb=0.2, bias=0.03 * (i % 2), bump=0.5, bsc=2)
    c.group(20); lump(c, 8, 26, 7.5, 1.6, 2, 'snow', top=6, front=(5, 4), seed=seed, tex=0.05)
    return snowcap(F(c, 0.66), 1, seed + 1)


# ================================================================ 얼음 낚시 구멍
def ice_fishing_hole(seed=1):
    """얼음 낚시 구멍(1x1): 언 연못·호수 얼음에 뚫은 둥근 구멍 — 짙은 찬 물(가장자리 살얼음), 깨서 쌓아 둔 얼음 조각 테,
    구멍 곁에 꽂은 짧은 낚싯대 막대와 늘어진 줄. 칸 막힘(빠지는 구멍)."""
    W, H = 16, 16
    im = blank(W, H); px = im.load()
    cx, cy = 7.5, 10.0
    for y in range(H):
        for x in range(W):
            d = ((x + 0.5 - cx) / 4.6) ** 2 + ((y + 0.5 - cy) / 3.2) ** 2
            if d <= 1:
                c = RGB('cwater', 0) if (y + 0.5 < cy - 1.0) else (RGB('cwater', 1) if d < 0.55 else RGB('cwater', 2))
                if d > 0.75 and y + 0.5 > cy: c = RGB('ice', 4)                     # 아래 턱 살얼음(밝음)
                put(px, W, H, x, y, c)
            elif d <= 1.9:
                t = 6 if (y + 0.5 < cy and x + 0.5 < cx + 1) else (5 if y + 0.5 < cy + 1.5 else 3)
                if hash2(x, y, seed) > 0.72: t = max(2, t - 2)
                put(px, W, H, x, y, RGB('ice', t))
            elif d <= 2.3 and y + 0.5 > cy:
                put(px, W, H, x, y, RGB('ice', 2))
    for (x, y) in ((1, 7), (2, 6), (13, 12), (14, 11), (12, 6)):                  # 깨낸 얼음 조각
        put(px, W, H, x, y, IC[6]); put(px, W, H, x, y + 1, IC[3])
    for j in range(8): put(px, W, H, 13 - j // 3, 2 + j, RGB('wood', 5 if j < 4 else 4))   # 낚싯대 막대
    put(px, W, H, 14, 2, RGB('wood', 3))
    for j in range(6): put(px, W, H, 9 - j // 3, 3 + j, RGB('frgr', 5))          # 늘어진 줄
    return im
