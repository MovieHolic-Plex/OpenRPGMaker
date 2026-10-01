"""월드맵 설계 데모 7단계 — 3/4 시점 랜드마크 7종 (손 도트 + 원본 성 모듈 재조립).

3/4 계약(modern-style-bible §10): 모든 구조 = 윗면 T + 앞면 F, 옆면 없음, 빛은 왼쪽 위.
 · 탑·성벽은 원본 EasyRPG World 어두운 성(20,10)의 탑/벽 모듈을 그대로 잘라 쓴다(ext2_castle.py).
 · 새로 그리는 면은 원본 문법을 따른다: 1px 어두운 테두리(111618) · 4~5단 명암 · 체크 디더 · 가로 줄눈 · 이끼 · 바닥 그림자.
 · 계단은 윗면 띠(tread)와 챌판(riser)이 번갈아 나온다.
생성 이미지·트레이싱 없음(좌표는 전부 손으로 적은 것).
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from landmarks_v6 import C, KEY, OUT, H, hx, STONE, SAND, LEAF, GRASS, BARK, ICE, WATER, ROCKB, CRYS  # noqa: E402
import ext2_castle as EC  # noqa: E402
from wm_ext2_lib import is_key  # noqa: E402

PALE, PALE2 = hx('aac3b5'), hx('8ca9a3')
MOSS, MOSS2 = hx('77693c'), hx('675144')
S = STONE  # 0 2a2833 · 1 363540 · 2 493f59 · 3 515567 · 4 66648b · 5 78739c · 6 9a95bd
SH = (17, 22, 24)


def chk(c):
    return ((c.X + c.Y) & 1) == 0


def blit(c, a, x, y):
    h, w = a.shape[:2]
    m = ~is_key(a)
    for yy in range(h):
        for xx in range(w):
            if m[yy, xx] and 0 <= y + yy < c.h and 0 <= x + xx < c.w:
                c.px[y + yy, x + xx] = a[yy, xx]
                c.m[y + yy, x + xx] = True


def cut(a, prof, cracks=(), moss=True, seed=1):
    """모듈 윗부분을 들쭉날쭉 부순다. prof[x] = 남기는 첫 행. 부러진 윗면(T)을 밝은 돌 2행으로 그린다."""
    o = a.copy()
    h, w = a.shape[:2]
    for x in range(w):
        p = prof[min(x, len(prof) - 1)]
        for y in range(p):
            o[y, x] = KEY
        if p < h:
            o[p, x] = S[6] if x % 3 else S[5]          # 부러진 윗면
            if p + 1 < h:
                o[p + 1, x] = S[5] if (x + p) % 2 else S[4]
    for (x, y0, n) in cracks:
        for k in range(n):
            if y0 + k < h and not is_key(o[y0 + k, x]):
                o[y0 + k, x] = S[1]
    if moss:
        for x in range(w):
            p = prof[min(x, len(prof) - 1)]
            if p + 2 < h and H(x, p, seed) > .62:
                o[p + 2, x] = MOSS if H(x, p, seed + 1) > .4 else MOSS2
    return o


def stairs(c, cx, y0, widths, tread=(S[6], S[5]), riser=(S[3], S[2])):
    """3/4 계단: 윗면 띠(밝음) 1행 + 챌판 1행(어두움)이 번갈아, 아래로 갈수록 넓어진다."""
    y = y0
    for w in widths:
        x0 = cx - w // 2
        for x in range(x0, x0 + w):
            c.dot(x, y, tread[0] if x < cx else tread[1])
            c.dot(x, y + 1, riser[0] if x < cx else riser[1])
        y += 2
    return y


def shadow(c, mk, col=SH, every=2):
    """바닥 그림자: 체크 디더(반투명 느낌)."""
    sel = mk & chk(c) & ~c.m
    c.px[sel] = col
    c.m |= sel


def face(c, x0, y0, x1, y1, ramp, seed=1, rowh=3, joint=True, top_shadow=True, lo=None):
    """앞면(F): 왼쪽 밝고 오른쪽 어두운 평면 + 체크 디더 + 가로 줄눈. ramp 는 7단(어둠→밝음)."""
    w = x1 - x0 + 1
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            u = (x - x0) / max(w - 1, 1)
            if u < .16:
                i = 5
            elif u < .42:
                i = 4
            elif u < .58:
                i = 4 if (x + y) & 1 else 3
            elif u < .84:
                i = 3
            else:
                i = 2
            if x == x1:
                i = 2
            elif x == x1 - 1 and w > 5:
                i = 3
            if joint and (y - y0) % rowh == rowh - 1 and H(x // 2, y, seed) > .22:
                i = max(i - 1, 1)
            elif H(x, y, seed + 3) > .93:
                i = min(i + 1, 6)
            if top_shadow and y == y0:
                i = max(i - 2, 1)
            c.dot(x, y, ramp[i])


def top_face(c, x0, y0, x1, y1, ramp, inset=1):
    """윗면(T): 밝은 평면, 뒤쪽 행은 안으로 1px 들어간 사다리꼴. 오른쪽 끝은 한 단 어둡다."""
    for y in range(y0, y1 + 1):
        ins = inset if y == y0 else 0
        for x in range(x0 + ins, x1 - ins + 1):
            i = 6 if x < x0 + (x1 - x0) * .55 else 5
            if x >= x1 - 2:
                i = 4
            if y == y1:
                i = max(i - 1, 3)
            c.dot(x, y, ramp[i])


# ----------------------------------------------------------------------------------------------------------
def giant_tower():
    c = C(2, 4)
    core = EC.fat_tower(2)              # 14×47
    fl, fr = EC.tower('L', 0), EC.tower('R', 0)   # 9×29
    base = 57
    blit(c, fl, 0, base - fl.shape[0] + 0)
    blit(c, fr, 23, base - fr.shape[0] + 0)
    blit(c, core, 9, base - core.shape[0] + 0)
    # 윗쪽: 떠 있는 수정(3/4 각기둥: 윗면 + 왼쪽 밝은 면 + 오른쪽 어두운 면)
    cx = 15
    pts_top = [(cx, 0), (cx + 3, 2), (cx, 4), (cx - 3, 2)]
    c.put(c.poly(pts_top), CRYS[4])
    c.put(c.poly([(cx - 3, 2), (cx, 4), (cx, 11), (cx - 3, 8)]), CRYS[2])
    c.put(c.poly([(cx, 4), (cx + 3, 2), (cx + 3, 8), (cx, 11)]), CRYS[1])
    for (x, y, k) in ((cx - 1, 6, 3), (cx - 2, 5, 4), (cx, 1, 4), (cx + 1, 2, 3)):
        c.dot(x, y, CRYS[k])
    c.dot(cx + 2, 6, CRYS[0]); c.dot(cx + 2, 7, CRYS[0])
    for (x, y) in ((cx - 6, 4), (cx + 6, 5), (cx - 4, 9), (cx + 5, 10)):   # 빛 알갱이
        c.dot(x, y, CRYS[4] if H(x, y) > .5 else CRYS[3])
    # 앞 계단(윗면 띠 + 챌판)
    stairs(c, 16, 57, [10, 14, 18])
    c.outline()
    return c.px


# ----------------------------------------------------------------------------------------------------------
def ruined_city():
    c = C(4, 3)
    W, Hh = c.w, c.h
    # 바닥판(윗면 T): 돌 광장 + 금 간 포석
    plate = c.ell(32, 41, 31, 6)
    t = 0.55 - .18 * ((c.X - 32) / 31.0) - .25 * ((c.Y - 35) / 12.0)
    c.paint(plate, [S[2], S[3], S[4], S[5]], t)
    for (x, y) in ((8, 41), (20, 43), (37, 44), (50, 41), (57, 43), (27, 39), (44, 39)):
        for k in range(4):
            c.dot(x + k, y + (k // 2), S[1])
    # 뒤줄: 부러진 둥근 탑 · 성채 벽 · 키 큰 탑 (원본 모듈). 윗면은 계단식으로 부서진다.
    t1 = cut(EC.fat_tower(0), [9, 9, 9, 7, 7, 7, 7, 10, 10, 5, 5, 5, 11, 11], cracks=[(3, 14, 6), (10, 15, 5)], seed=2)
    blit(c, t1, 3, 40 - 31)
    kw = EC.wall_hstretch(EC.keep_wall(1), 3)     # 26 열
    kw = cut(kw, [11, 11, 11, 11, 8, 8, 8, 8, 8, 19, 19, 19, 19, 16, 16, 12, 12, 12, 12, 9, 9, 9, 13, 13, 13, 13],
             cracks=[(7, 10, 7), (20, 12, 5)], seed=4)
    blit(c, kw, 17, 40 - kw.shape[0] + 0)
    t2 = cut(EC.tower('R', 1), [15, 15, 13, 13, 12, 12, 14, 14, 16, 16], cracks=[(4, 16, 7)], seed=6)
    blit(c, t2, 50, 40 - t2.shape[0] + 3)
    # 앞줄: 낮은 벽 조각(구멍 난 채) — 왼쪽 끝과 문루
    a = cut(EC.low_wall(14), [6, 6, 6, 4, 4, 4, 9, 9, 9, 7, 7, 7, 10, 10], cracks=[(5, 8, 5)], seed=8)
    blit(c, a, 0, 47 - a.shape[0] + 0)
    g = cut(EC.low_wall(14), [4, 4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4], seed=11)
    blit(c, g, 25, 44 - g.shape[0] + 0)
    stairs(c, 32, 44, [8, 12])
    # 무너진 돌덩이(윗면+앞면 블록 4개)
    for (x, y, w, h) in ((16, 44, 5, 3), (23, 46, 4, 2), (42, 45, 5, 3), (60, 43, 3, 2), (0, 44, 3, 2)):
        top_face(c, x, y, x + w - 1, y, S, inset=0)
        face(c, x, y + 1, x + w - 1, y + h - 1, S, seed=x, joint=False, top_shadow=False)
    # 잡초·이끼
    for x in range(0, 64):
        for y in range(36, 48):
            if c.m[y, x] and H(x, y, 21) > .965:
                c.dot(x, y, MOSS if H(x, y, 22) > .5 else MOSS2)
    c.outline()
    return c.px


# ----------------------------------------------------------------------------------------------------------
def desert_temple():
    c = C(3, 3)
    P = SAND
    # 바닥 그림자(오른쪽 아래, 체크 디더)
    sh = c.poly([(6, 46), (44, 46), (47, 43), (40, 43)])
    shadow(c, sh, P[0])
    # 층 3개: 앞면 F + 윗면 T (아래에서 위로). 앞면은 모래벽돌 결, 윗면은 밝은 평면.
    tiers = [(4, 43, 41, 46, 38), (9, 38, 34, 41, 29), (14, 33, 25, 28, 20)]  # (x0, x1, 앞면 y0.. 생략)
    spec = [  # x0, x1, fy0, fy1, ty0
        (4, 43, 41, 46, 38),
        (9, 38, 32, 37, 29),
        (14, 33, 23, 28, 20),
    ]
    for x0, x1, fy0, fy1, ty0 in spec:
        face(c, x0, fy0, x1, fy1, P, seed=x0, rowh=3)
        top_face(c, x0, ty0, x1, fy0 - 1, P)
    # 층 앞면의 상형문자 띠(작은 네모 무늬)
    for x0, x1, fy0, fy1, ty0 in spec[1:]:
        for x in range(x0 + 2, x1 - 1, 3):
            c.dot(x, fy0 + 2, P[1]); c.dot(x + 1, fy0 + 2, P[1])
    # 사당(맨 위): 앞면 + 문 + 지붕 윗면 + 첨탑
    face(c, 18, 13, 29, 19, P, seed=5, rowh=3)
    top_face(c, 16, 9, 31, 12, P, inset=2)
    c.put(c.poly([(24, 1), (28, 7), (20, 7)]), P[5])
    c.put(c.poly([(24, 1), (28, 7), (25, 7)]), P[3])
    c.dot(24, 2, P[6]); c.dot(23, 4, P[6]); c.dot(22, 5, P[6])
    c.put(c.rect(22, 14, 25, 19), P[0])                # 문
    c.dot(22, 13, P[6]); c.dot(23, 13, P[6]); c.dot(24, 13, P[5]); c.dot(25, 13, P[5])
    # 앞 계단: 층마다 윗면 띠와 챌판이 번갈아 (가운데 폭 8)
    for (y0, y1) in ((20, 22), (29, 31), (38, 40)):    # 윗면 구간: 계단 윗면 band
        for x in range(20, 28):
            c.dot(x, y0, P[6] if x < 24 else P[5]); c.dot(x, y0 + 1, P[5] if x < 24 else P[4])
            c.dot(x, y0 + 2, P[6] if x < 24 else P[5])
    for (y0, y1) in ((23, 28), (32, 37), (41, 46)):    # 앞면 구간: 챌판+윗면 띠 교대
        for y in range(y0, y1 + 1):
            for x in range(20, 28):
                riser = (y - y0) % 2 == 1
                c.dot(x, y, (P[3] if x < 24 else P[2]) if riser else (P[6] if x < 24 else P[5]))
    for y in list(range(23, 29)) + list(range(32, 38)) + list(range(41, 47)):   # 계단 양옆 난간 그림자
        c.dot(19, y, P[1]); c.dot(28, y, P[1])
    # 양옆 오벨리스크: 앞면 + 작은 피라미드 윗면
    for x0 in (0, 44):
        face(c, x0, 19, x0 + 3, 40, P, seed=x0 + 2, rowh=4)
        c.put(c.poly([(x0, 19), (x0 + 3, 19), (x0 + 2, 14), (x0 + 1, 14)]), P[5])
        c.dot(x0 + 1, 15, P[6]); c.dot(x0, 18, P[6]); c.dot(x0 + 3, 17, P[3])
        c.put(c.rect(x0, 41, x0 + 3, 42), P[4])
    c.outline()
    return c.px


# ----------------------------------------------------------------------------------------------------------
def stone_circle():
    c = C(2, 2)
    # 잔디판(윗면)
    disc = c.ell(16, 22, 15, 8)
    t = .62 - .28 * ((c.X - 16) / 15.0) * .5 - .25 * ((c.Y - 14) / 16.0)
    c.paint(disc, [GRASS[0], GRASS[1], GRASS[2], GRASS[3]], t)
    # 돌 그림자(오른쪽 아래)
    stones = []   # (cx, baseY, w, h)
    import math
    for k in range(7):
        a = math.pi * (0.15 + 2 * k / 7.0) + .25
        stones.append((16 + 11.5 * math.cos(a), 21 + 5.2 * math.sin(a), 4 if math.sin(a) < 0 else 5, 7 if math.sin(a) < 0 else 10))
    stones.sort(key=lambda s: s[1])
    for (cx, by, w, h) in stones:
        x0, by = int(round(cx)) - w // 2, int(round(by))
        sh = c.poly([(x0 + 1, by), (x0 + w + 6, by + 2), (x0 + w + 4, by + 4), (x0 - 1, by + 2)])
        shadow(c, sh & disc, GRASS[0])
    # 뒤쪽 한 쌍은 얹은 돌(트릴리톤)
    for (cx, by, w, h) in stones:
        x0, by = int(round(cx)) - w // 2, int(round(by))
        y0 = by - h + 1
        face(c, x0, y0 + 2, x0 + w - 1, by, S, seed=x0, rowh=4)
        c.put(c.poly([(x0, y0 + 2), (x0 + w - 1, y0 + 2), (x0 + w - 2, y0), (x0 + 1, y0)]), S[6])
        c.dot(x0 + w - 1, y0 + 2, S[4])
        c.dot(x0, by, MOSS); c.dot(x0 + 1, by - 1, MOSS2); c.dot(x0 + w - 1, by, MOSS2)
        c.dot(x0 + 1, y0 + 3, S[6])
    # 가운데 룬석(청록 결정 + 윗면)
    c.put(c.poly([(16, 10), (19, 12), (16, 14), (13, 12)]), CRYS[4])
    c.put(c.poly([(13, 12), (16, 14), (16, 22), (13, 20)]), CRYS[2])
    c.put(c.poly([(16, 14), (19, 12), (19, 20), (16, 22)]), CRYS[1])
    c.dot(15, 16, CRYS[4]); c.dot(14, 14, CRYS[3]); c.dot(17, 17, CRYS[0])
    for (x, y) in ((11, 9), (21, 10), (10, 17), (22, 18)):
        c.dot(x, y, CRYS[3])
    c.outline()
    return c.px


# ----------------------------------------------------------------------------------------------------------
def crater_lake():
    c = C(3, 3)
    R = ROCKB   # 0 2a1408 · 1 4a2a18 · 2 6a3c24 · 3 8a5234 · 4 a8683c · 5 c88c58
    cx, cy, rx, ry, dep = 24, 21, 22, 15, 8
    top = c.ell(cx, cy, rx, ry)
    lower = c.ell(cx, cy + dep, rx, ry)
    body = top | lower | c.rect(cx - rx, cy, cx + rx, cy + dep)
    front = body & ~top
    # 앞면 F: 기둥 명암(왼쪽 밝음, 오른쪽 어두움) + 세로 금
    u = (c.X - (cx - rx)) / (2.0 * rx)
    tf = .86 - .8 * u + .06 * (H(c.X // 2, 0, 3) - .5)
    c.paint(front, [R[1], R[2], R[3], R[4], R[5]], tf)
    for x in range(cx - rx + 3, cx + rx - 2, 5):
        ys, = np.nonzero(front[:, x])
        for y in ys[::1]:
            if y > cy + ry * .55 and H(x, y, 5) > .15:
                c.dot(x + (y // 4) % 2, y, R[0])
    # 윗면 T(테): 왼쪽 위가 밝다
    hollow = c.ell(cx, cy + 1, 16, 10)
    ring = top & ~hollow
    tt = .7 + .35 * (-(c.X - cx) / float(rx)) * .7 + .3 * (-(c.Y - cy) / float(ry)) * .7
    c.paint(ring, [R[2], R[3], R[4], R[5]], tt * .8)
    for (x, y, w) in ((8, 13, 4), (13, 8, 3), (20, 5, 4), (30, 6, 3), (38, 9, 4), (42, 18, 3), (6, 22, 3), (39, 26, 4), (30, 34, 3), (14, 34, 4)):
        c.put(c.rect(x, y, x + w - 1, y + 1), R[5])
        c.dot(x + w - 1, y + 1, R[3]); c.dot(x, y + 1, R[4])
    # 안쪽: 먼 안벽(앞을 향한 면, 어둡다) + 물
    water = c.ell(cx, cy + 4, 13, 7)
    wall = hollow & ~water
    tw = .45 - .28 * ((c.Y - (cy - 9)) / 10.0) + .25 * (-(c.X - cx) / 16.0)
    c.paint(wall, [R[0], R[1], R[2], R[3]], tw)
    for x in range(cx - 13, cx + 14, 3):
        for y in range(cy - 9, cy - 1):
            if wall[y, x] and H(x, y, 9) > .3:
                c.dot(x, y, R[0])
    tt2 = .34 + .45 * ((c.Y - (cy - 3)) / 14.0) + .12 * ((c.X - cx) / 14.0)
    c.paint(water, WATER, np.clip(tt2, 0, 1))
    shore = water & ~c.ell(cx, cy + 4, 12, 6)
    c.put(shore, WATER[3])
    for (x, y, w) in ((15, 22, 4), (26, 24, 5), (20, 27, 3), (30, 21, 3)):
        for k in range(w):
            c.dot(x + k, y, WATER[4])
    c.dot(32, 28, WATER[3])
    # 작은 바위섬 + 결정
    c.put(c.rect(22, 25, 25, 26), R[3]); c.dot(22, 26, R[2]); c.dot(25, 26, R[1])
    c.put(c.poly([(23, 21), (24, 21), (25, 25), (22, 25)]), CRYS[2]); c.dot(23, 22, CRYS[4]); c.dot(24, 23, CRYS[1])
    c.outline()
    # 바닥 그림자
    sh = c.ell(cx + 3, cy + dep + 3, rx - 1, 6)
    shadow(c, sh, SH)
    return c.px


# ----------------------------------------------------------------------------------------------------------
def giant_tree():
    c = C(3, 3)
    L = LEAF
    B = BARK
    # 바닥 그림자
    shadow(c, c.ell(28, 44, 20, 4), L[0])
    # 줄기: 앞면(기둥 명암) + 세로 홈 + 뿌리 벌어짐
    tr = c.poly([(19, 26), (31, 26), (33, 40), (36, 45), (16, 45), (18, 40)])
    u = (c.X - 18) / 16.0
    c.paint(tr, [B[0], B[1], B[2], B[3], B[4]], .9 - .75 * u + .05 * (H(c.X, c.Y // 3, 7) - .5))
    for x, y0, y1 in ((22, 28, 42), (26, 30, 43), (29, 28, 41)):
        for y in range(y0, y1):
            if tr[y, x]:
                c.dot(x, y, B[0])
    c.dot(21, 34, B[4]); c.dot(20, 38, B[4]); c.dot(21, 30, B[4])
    # 줄기 속 구멍 문 + 계단 2단
    c.put(c.poly([(24, 34), (28, 34), (28, 42), (24, 42)]), B[0])
    c.put(c.rect(24, 33, 28, 33), B[2])
    c.dot(24, 34, B[2]); c.dot(28, 34, B[2])
    for k, y in enumerate((42, 44)):
        for x in range(23 - k, 30 + k):
            c.dot(x, y, B[4] if x < 26 else B[3]); c.dot(x, y + 1, B[2] if x < 26 else B[1]) if y + 1 < 46 else None
    # 수관: 겹친 덩이를 뒤에서 앞으로, 각 덩이는 4단 명암 + 오른쪽 아래 어두운 테
    lumps = [(10, 14, 10, 9), (38, 14, 10, 9), (24, 8, 13, 8), (6, 24, 8, 7), (42, 24, 8, 7),
             (16, 20, 11, 9), (33, 20, 11, 9), (24, 18, 12, 9), (24, 26, 18, 6)]
    for (cx, cy, rx, ry) in lumps:
        m = c.ell(cx, cy, rx, ry)
        d = np.sqrt(((c.X - (cx - rx * .28)) / float(rx)) ** 2 + ((c.Y - (cy - ry * .3)) / float(ry)) ** 2)
        t = np.clip(0.96 - .62 * d, 0, 1)
        c.paint(m, [L[1], L[2], L[3], L[4], L[5]], t)
        rim = m & ~c.ell(cx - 1, cy - 1, rx - 1, ry - 1)
        c.put(rim & (c.X > cx) & (c.Y > cy), L[0])
    # 잎 뭉치 하이라이트 점
    for (x, y) in ((12, 8), (20, 4), (30, 5), (36, 9), (8, 18), (42, 17), (18, 13), (28, 12), (14, 22), (34, 22), (24, 23)):
        c.dot(x, y, L[6]); c.dot(x + 1, y, L[5])
    for (x, y) in ((9, 24), (26, 28), (40, 26), (18, 27), (33, 28)):
        c.dot(x, y, L[0]); c.dot(x + 1, y, L[1])
    c.outline()
    return c.px


# ----------------------------------------------------------------------------------------------------------
def sky_island():
    c = C(5, 3)
    R = ROCKB
    # 윗면 T: 잔디 타원
    top = c.ell(40, 14, 37, 9)
    # 아랫면 F: 원뿔형 바위 (윗 타원 아랫반 ~ 끝점), 기둥 명암
    cone = c.poly([(3, 15), (77, 15), (62, 28), (52, 38), (44, 46), (37, 46), (30, 38), (20, 28)])
    body = cone | top
    front = cone & ~top
    u = (c.X - 3) / 74.0
    tf = .88 - .8 * u + .05 * (H(c.X // 2, c.Y // 2, 4) - .5)
    c.paint(front, [R[0], R[1], R[2], R[3], R[4], R[5]], tf)
    # 지층 호(가로) + 세로 금: 끝점으로 모인다
    for k, y in enumerate((20, 25, 31, 37)):
        for x in range(0, 80):
            if front[y + int(abs(x - 40) ** 1.6 / 30.0), x] if 0 <= y + int(abs(x - 40) ** 1.6 / 30.0) < 48 else False:
                yy = y + int(abs(x - 40) ** 1.6 / 30.0)
                if (x + k) % 3 != 0:
                    c.dot(x, yy, R[1])
    for x0 in (12, 22, 32, 44, 54, 66):
        for y in range(18, 44):
            x = int(40 + (x0 - 40) * (1 - (y - 18) / 30.0 * 0.96))
            if 0 <= x < 80 and front[y, x] and H(x, y, 3) > .25:
                c.dot(x, y, R[0])
    # 윗면 테의 잔디 립: 앞면 위로 덮는 잔디 + 흙 줄
    lip = top & ~c.ell(40, 12, 37, 8)
    c.put(lip, GRASS[1])
    for x in range(4, 77, 3):
        ys, = np.nonzero(top[:, x]); y = ys.max()
        c.dot(x, y + 1, GRASS[1] if front[y + 1, x] else GRASS[0]); c.dot(x + 1, y + 2, R[3]) if front[y + 2, x + 1] else None
    g = c.ell(40, 12, 36, 8)
    t = .55 + .25 * (-(c.X - 40) / 36.0) + .25 * (-(c.Y - 12) / 8.0)
    c.paint(g, GRASS, np.clip(t, 0, 1))
    # 숲 덩이 + 작은 사당(앞면 + 윗면 + 문)
    for (cx, cy, r) in ((14, 10, 4), (22, 8, 3), (60, 9, 4), (68, 11, 3), (50, 7, 3)):
        m = c.ell(cx, cy, r, r - 1)
        c.paint(m, [LEAF[1], LEAF[2], LEAF[3], LEAF[4], LEAF[5]], np.clip(.8 - .14 * ((c.X - cx + 1) ** 2 + (c.Y - cy + 1) ** 2) ** .5, 0, 1))
        c.put(m & (c.X > cx) & (c.Y > cy), LEAF[0])
        c.put(c.rect(cx - 1, cy + r - 1, cx, cy + r), BARK[2])
    face(c, 33, 10, 43, 16, S, seed=3, rowh=3)
    top_face(c, 32, 7, 44, 9, S, inset=1)
    c.put(c.rect(37, 12, 39, 16), S[0]); c.dot(37, 11, S[6]); c.dot(38, 11, S[5]); c.dot(39, 11, S[5])
    # 폭포: 윗면 오른쪽 가장자리에서 아래로
    for y in range(17, 40):
        x = 66 - (y - 17) // 4
        if front[y, x]:
            c.dot(x, y, WATER[4] if (y // 2) % 2 else WATER[3]); c.dot(x + 1, y, WATER[2])
    # 바닥 결정 조각
    for (x0, y0, hh) in ((34, 40, 7), (42, 42, 5)):
        c.put(c.poly([(x0, y0), (x0 + 4, y0), (x0 + 2, y0 + hh)]), CRYS[2])
        c.put(c.poly([(x0 + 2, y0), (x0 + 4, y0), (x0 + 2, y0 + hh)]), CRYS[1])
        c.dot(x0 + 1, y0 + 1, CRYS[4])
    c.outline()
    return c.px


LANDMARKS = [
    ('sky_island', sky_island, 5, 3, '천공섬 — 떠 있는 대륙'),
    ('giant_tower', giant_tower, 2, 4, '거대한 탑'),
    ('ruined_city', ruined_city, 4, 3, '폐허 도시'),
    ('giant_tree', giant_tree, 3, 3, '거목'),
    ('crater_lake', crater_lake, 3, 3, '분화구 호수'),
    ('desert_temple', desert_temple, 3, 3, '사막 신전'),
    ('stone_circle', stone_circle, 2, 2, '고대 돌원'),
]
