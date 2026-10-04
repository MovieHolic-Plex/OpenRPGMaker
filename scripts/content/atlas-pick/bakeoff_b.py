#!/usr/bin/env python3
"""품질 비교전 B 조 — 오사카식 길모퉁이, 32px 칸 손 도트(pxgrid).
캔버스는 (램프, 단) 두 배열이다. 그라디언트·노이즈 함수는 쓰지 않는다: 모든 명암은 빛 방향 규칙(왼쪽 위)으로 손이 놓는다.
도형 헬퍼(사각·타원)는 좌표를 내가 정해 준 자리에만 칠한다. 결과: scene.png(1024x768) + scene.pxg(@cell 32) + scene-x1.5.png.
  python3 scripts/content/atlas-pick/bakeoff_b.py
"""
import os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata/atlas-pick/bakeoff/b-32px')
PAL = os.path.join(ROOT, 'tiledata/atlas-pick/palette/modern3.pal')

W, H = 1024, 768
RAMPS = {}; ORDER = []
for ln in open(PAL, encoding='utf-8'):
    m = re.match(r'@rampc\s+(\S+)\s+(.*)', ln.strip())
    if m:
        RAMPS[m.group(1)] = [tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) for h in re.findall(r'#([0-9a-fA-F]{6})', m.group(2))]
        ORDER.append(m.group(1))
RID = {n: i for i, n in enumerate(ORDER)}
RP = np.full((H, W), -1, dtype=np.int16)   # -1 = 비어 있음
TN = np.zeros((H, W), dtype=np.int16)


def cl(r, t):
    return max(0, min(len(RAMPS[r]) - 1, t))


def px(x, y, r, t):
    if 0 <= x < W and 0 <= y < H:
        RP[y, x] = RID[r]; TN[y, x] = cl(r, t)


def fill(x, y, w, h, r, t):
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    RP[y0:y1, x0:x1] = RID[r]; TN[y0:y1, x0:x1] = cl(r, t)


def shade(x, y, w, h, dt):
    """같은 램프 안에서 단만 옮긴다(그림자·빛). 비어 있는 칸은 건드리지 않는다."""
    x0, y0, x1, y1 = max(0, x), max(0, y), min(W, x + w), min(H, y + h)
    if x1 <= x0 or y1 <= y0:
        return
    sub = RP[y0:y1, x0:x1]; tn = TN[y0:y1, x0:x1]
    for name, rid in RID.items():
        m = sub == rid
        if m.any():
            tn[m] = np.clip(tn[m] + dt, 0, len(RAMPS[name]) - 1)


def pat(x, y, rows, leg, sc=1):
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch in leg and leg[ch] is not None:
                r, t = leg[ch]
                for a in range(sc):
                    for b in range(sc):
                        px(x + i * sc + a, y + j * sc + b, r, t)


def ellipse(cx, cy, rx, ry, r, t, ymax=None):
    for y in range(int(cy - ry), (int(cy + ry) if ymax is None else ymax) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1.0:
                px(x, y, r, t)


def outlined(fn, *a, **k):
    """물건 하나를 그린 뒤, 그 물건 몸(램프가 바뀐 픽셀)의 바깥 1칸에 먹선(sumi)을 두른다. 바닥 그림자(같은 램프 단 옮김)는 몸이 아니라서 선을 안 두른다."""
    r0, t0 = RP.copy(), TN.copy()
    fn(*a, **k)
    body = (RP != r0)
    n = np.zeros_like(body)
    n[1:, :] |= body[:-1, :]; n[:-1, :] |= body[1:, :]; n[:, 1:] |= body[:, :-1]; n[:, :-1] |= body[:, 1:]
    o = n & ~body
    RP[o] = RID['sumi']; TN[o] = 1


def outline_box(x, y, w, h, r='sumi', t=1):
    fill(x, y, w, 1, r, t); fill(x, y + h - 1, w, 1, r, t); fill(x, y, 1, h, r, t); fill(x + w - 1, y, 1, h, r, t)


# ---------------------------------------------------------------- 글자 (7x8 손 도트, 2배로 찍는다)
GLYPH = {
 'ロ': ["#######", "#.....#", "#.....#", "#.....#", "#.....#", "#.....#", "#######", "......."],
 'ー': [".......", ".......", ".......", "#######", "#######", ".......", ".......", "......."],
 'ト': ["..#....", "..#....", "..#....", "..###..", "..#.##.", "..#....", "..#....", "..#...."],
 'ホ': ["...#...", "...#...", "#######", "...#...", ".#.#.#.", "#..#..#", "...#...", "...#..."],
 'テ': [".#####.", ".......", "#######", "...#...", "...#...", "...#...", "..#....", ".#....."],
 'ル': ["..#...#", "..#...#", "..#..#.", "#.#..#.", "#.#..#.", "#.#.#..", "#.##...", "#.#...."],
 'ラ': [".#####.", ".......", ".......", "#######", ".....#.", "....#..", "..##...", "##....."],
 'メ': ["....#..", "...#...", "#..#...", ".###...", "..##...", ".#..#..", "#....#.", "......#"],
 'ン': ["#......", ".#.....", ".......", ".....#.", "....#..", "...#...", ".##....", "#......"],
 '2': [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#....", "#####"],
 '4': ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#.", "...#."],
 'H': ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#", "#...#"],
}


def text(x, y, s, r, t, sc=2, gap=2, sh=None):
    """sh=(램프,단): 글자 오른쪽 아래 1칸 그림자."""
    cx = x
    for ch in s:
        g = GLYPH[ch]
        if sh:
            pat(cx + 1, y + 1, g, {'#': sh}, sc)
        pat(cx, y, g, {'#': (r, t)}, sc)
        cx += len(g[0]) * sc + gap
    return cx - gap


def text_w(s, sc=2, gap=2):
    return sum(len(GLYPH[c][0]) * sc for c in s) + gap * (len(s) - 1)


# ---------------------------------------------------------------- 재질 헬퍼
def brick(x, y, w, h, r, base, tw=16, th=8, var=None):
    """타일·벽돌: 줄마다 반 칸 어긋난 손 무늬. 이음매 base-2, 윗변·왼변 base+1. var = 손으로 정한 타일별 단 옮김 표. 영역 밖은 안 칠한다."""
    var = var or [0, 0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 0, 0, 1, -1, 0, 0, 1, 0, -1, 0, 0, 1]
    for j in range(h):
        row = j // th; ry = j % th
        off = (tw // 2) if row % 2 else 0
        for i in range(w):
            ii = i + off; col = ii // tw; rx = ii % tw
            k = var[(col * 5 + row * 3) % len(var)]
            if ry == th - 1 or rx == tw - 1:
                t = base - 2
            elif ry == 0 or rx == 0:
                t = base + k + 1
            else:
                t = base + k
                if k >= 1 and rx in (2, 3) and ry in (2, 3):
                    t += 1                                   # 유약 반짝
                if k <= -1 and rx > tw - 6 and ry > th - 4:
                    t -= 1                                   # 어두운 타일은 오른쪽 아래가 더
                if k == 0 and rx == tw - 3 and ry == 2:
                    t -= 1                                   # 손 얼룩 한 점
            px(x + i, y + j, r, t)


def window(x, y, w, h, wr, wt, curtain=None, refl=0, bars=False, glass='garasu', blind=0):
    """창: 위 4px 그늘·왼 2px 그늘, 문턱 +2 로 4px 돌출, 밑에 3px 그림자. w,h = 유리 바깥 크기."""
    # 벽 속 들어간 자리(그림자 틀)
    fill(x - 3, y - 4, w + 6, h + 4, wr, wt - 3)
    # 문턱(밝게, 앞으로 돌출) + 아래 그림자
    fill(x - 5, y + h, w + 10, 3, 'conc', 5)
    fill(x - 5, y + h + 3, w + 10, 2, 'conc', 3)
    fill(x - 4, y + h + 5, w + 8, 3, wr, wt - 2)
    fill(x - 3, y + h + 8, w + 6, 1, wr, wt - 1)
    # 알루미늄 틀
    fill(x, y, w, h, 'tekko', 4)
    fill(x, y, w, 1, 'tekko', 5); fill(x, y, 1, h, 'tekko', 5)
    fill(x, y + h - 1, w, 1, 'tekko', 2); fill(x + w - 1, y, 1, h, 'tekko', 2)
    # 유리
    gx, gy, gw, gh = x + 2, y + 2, w - 4, h - 4
    fill(gx, gy, gw, gh, glass, 3)
    fill(gx, gy + gh * 2 // 3, gw, gh - gh * 2 // 3, glass, 2)      # 아래로 어두워지는 유리
    fill(gx, gy + gh * 2 // 3, gw, 1, glass, 4)
    # 대각 반사 띠(왼쪽 위 → 오른쪽 아래로 넘어가는 밝은 줄)
    for k, tone, wd in ((refl, 5, 3), (refl + 6, 5, 1), (refl + 17, 4, 2)):
        for j in range(gh):
            xx = gx + k + (gh - 1 - j)
            for dx in range(wd):
                if gx <= xx + dx < gx + gw:
                    px(xx + dx, gy + j, glass, tone)
    # 위·왼 깊이 그늘
    fill(gx, gy, gw, 4, glass, 1); fill(gx, gy + 4, gw, 1, glass, 2)
    fill(gx, gy, 2, gh, glass, 1)
    # 문살 (가운데 세로 + 위 가로 한 줄)
    mx = x + w // 2
    fill(mx - 1, y, 3, h, 'tekko', 4); fill(mx - 1, y, 1, h, 'tekko', 5); fill(mx + 1, y, 1, h, 'tekko', 2)
    fill(x, y + h // 3, w, 2, 'tekko', 4); fill(x, y + h // 3, w, 1, 'tekko', 5)
    if blind:   # 반쯤 내린 롤 블라인드: 가로 줄, 아래 막대
        fill(gx, gy + 4, gw, blind, 'shiro', 3)
        for j in range(gy + 6, gy + 4 + blind, 3):
            fill(gx, j, gw, 1, 'shiro', 2)
        fill(gx, gy + 4, gw, 1, 'shiro', 4)
        fill(gx, gy + 4 + blind, gw, 2, 'tekko', 3); fill(gx, gy + 4 + blind, gw, 1, 'tekko', 5)
        fill(mx + 3 if False else gx + gw // 2 - 1, gy + 4 + blind + 2, 2, 4, 'tekko', 4)   # 당김끈
    elif curtain:
        cr, ct = curtain
        cx0 = gx + gw - gw // 3
        fill(cx0, gy + 5, gx + gw - cx0, gh - 5, cr, ct)
        for i in range(cx0, gx + gw, 5):      # 주름: 넓은 그늘 + 좁은 밝은 줄, 아래로 갈수록 벌어진다
            fill(i, gy + 5, 2, gh - 5, cr, ct - 1)
            fill(i + 2, gy + 5, 1, gh - 5, cr, ct + 1)
            fill(i + 1, gy + gh - 4, 3, 3, cr, ct - 1)
        fill(cx0, gy + 5, gx + gw - cx0, 1, cr, ct + 1)
        fill(cx0 - 3, gy + 5, 3, gh - 5, cr, ct - 1)   # 묶은 자락
        fill(cx0 - 3, gy + 5, 1, gh - 5, cr, ct + 1)
    else:       # 방 안 실루엣(선반·화분 한 점)
        fill(gx + 5, gy + gh - 9, 12, 8, glass, 1); fill(gx + 5, gy + gh - 9, 12, 1, glass, 2)
        fill(gx + 9, gy + gh - 14, 4, 5, 'midori', 1)
    if bars:   # 베란다 난간(창 앞 아래쪽)
        by = y + h - 12
        fill(x - 4, by, w + 8, 3, 'tekko', 5); fill(x - 4, by + 3, w + 8, 1, 'tekko', 3)
        for i in range(x - 3, x + w + 4, 6):
            fill(i, by + 4, 2, 12, 'tekko', 3); fill(i, by + 4, 1, 12, 'tekko', 5)
        fill(x - 4, by + 15, w + 8, 3, 'tekko', 4)
        fill(x - 4, by + 18, w + 8, 3, 'conc', 2)   # 난간 그림자가 벽에 떨어진다


def aircon(x, y, w=36, h=26, ramp='shiro'):
    """실외기: 윗면 +2, 앞 0, 오른쪽 옆 -2, 팬 격자."""
    fill(x, y, w, h, ramp, 3)
    fill(x, y, w, 4, ramp, 4); fill(x, y, w, 1, ramp, 4)
    fill(x + w - 4, y + 4, 4, h - 4, ramp, 1)
    fill(x, y + h - 2, w, 2, ramp, 1)
    cx, cy = x + (w - 4) // 2, y + 4 + (h - 8) // 2
    ellipse(cx, cy, 8, 8, 'tekko', 2)
    ellipse(cx, cy, 6, 6, 'tekko', 3)
    fill(cx - 6, cy - 1, 12, 2, 'tekko', 5); fill(cx - 1, cy - 6, 2, 12, 'tekko', 5)
    ellipse(cx, cy, 2, 2, 'tekko', 1)
    fill(x, y + 4, 1, h - 6, ramp, 4)
    fill(x + 2, y + h, w - 2, 3, 'conc', 2)   # 발밑 그림자


def shadow_wall(x, y, w, h, dt=-2):
    shade(x, y, w, h, dt)


# ================================================================ 장면
SPECK = [(1, 2, -1), (5, 1, 1), (9, 4, -1), (13, 3, 1), (3, 7, 1), (7, 9, -1), (11, 8, 1), (14, 11, -1), (2, 12, -1),
         (6, 14, 1), (10, 13, -1), (15, 6, -1), (4, 4, 0), (8, 5, 1)]


def ground():
    fill(0, 0, W, H, 'tairu', 1)
    # 도로: 어두운 아스팔트 + 손 무늬 자갈
    fill(0, 560, W, 208, 'yoru', 3)
    for ty in range(560, H, 16):
        for tx in range(0, W, 16):
            sh = ((tx // 16) * 5 + (ty // 16) * 3) % 4
            for dx, dy, dt in SPECK:
                if (dx + dy + sh) % 3 == 0:
                    px(tx + (dx + sh * 3) % 16, ty + (dy + sh * 5) % 16, 'yoru', 3 + dt)
    # 아스팔트 이어붙임 자국 두 줄과 타이어 자국 두 띠
    fill(0, 604, W, 2, 'yoru', 2); fill(0, 730, W, 2, 'yoru', 2)
    fill(0, 716, W, 9, 'yoru', 2); fill(0, 716, W, 1, 'yoru', 3); fill(0, 742, W, 5, 'yoru', 2)
    fill(0, 632, W, 8, 'yoru', 2)
    # 보도: 32x16 블록, 줄마다 반 칸 어긋남
    brick(0, 440, 548, 108, 'hodo', 4, tw=32, th=16, var=[0, 0, 1, 0, -1, 0, 0, 1, 0, 0, -1, 0, 1, 0])
    brick(548, 424, W - 548, 124, 'hodo', 4, tw=32, th=16, var=[0, 1, 0, 0, -1, 0, 1, 0, 0, 0, -1, 0, 0, 1])
    # 커브(연석): 윗면 +2, 앞면 0, 도로에 3px 그림자
    fill(0, 548, W, 6, 'hodo', 6); fill(0, 548, W, 1, 'hodo', 6)
    fill(0, 554, W, 6, 'hodo', 4); fill(0, 559, W, 1, 'hodo', 3)
    for x in range(0, W, 64):    # 연석 이음
        fill(x, 548, 1, 12, 'hodo', 2)
    fill(0, 560, W, 3, 'yoru', 1)
    # 점자 유도 블록(노랑) 보도 가운데를 가로지른다
    fill(0, 492, W, 12, 'kii', 3)
    for x in range(0, W, 8):
        for yy in (494, 500):
            fill(x + 2, yy, 4, 4, 'kii', 4); px(x + 2, yy, 'kii', 4); fill(x + 5, yy + 3, 1, 1, 'kii', 1)
    fill(0, 492, W, 1, 'kii', 4); fill(0, 503, W, 1, 'kii', 1)
    # 도로 표시: 가장자리 실선, 중앙 점선, 횡단보도(차 진행 방향으로 긴 줄무늬)
    fill(0, 566, W, 4, 'shiro', 2)
    for x in range(0, W, 128):
        if not (x + 64 > 640 and x < 800):
            fill(x + 8, 690, 64, 5, 'shiro', 3); fill(x + 8, 690, 64, 1, 'shiro', 4)
    for k in range(9):
        yy = 578 + k * 20
        fill(660, yy, 124, 10, 'shiro', 3); fill(660, yy, 124, 2, 'shiro', 4); fill(660, yy + 9, 124, 1, 'shiro', 1)
        for cx in (668, 694, 733, 760): px(cx, yy + 4, 'shiro', 2); px(cx + 1, yy + 4, 'shiro', 2); px(cx + 9, yy + 6, 'yoru', 3)
    fill(636, 566, 4, 190, 'shiro', 2)  # 정지선 비슷한 실선(횡단보도 옆)
    fill(636, 566, 4, 1, 'shiro', 3)
    wear()


def crack(pts, r='yoru', t=1):
    """손으로 찍은 꺾은선 균열: 점 목록 사이를 한 칸씩 잇는다."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            px(x0 + (x1 - x0) * i // max(n, 1), y0 + (y1 - y0) * i // max(n, 1), r, t)


def wear():
    """낡음: 아스팔트 보수 패치·균열·연석 가장자리 이빨·배수구 쪽 얼룩·건물 밑 그림자(빛은 왼쪽 위 → 그림자는 오른쪽 아래)."""
    # 보수 패치: 사각형, 바탕보다 밝은 단(+1)에 윗변 -1 얇은 선, 가장자리 이빨
    for (x, y, w, h) in ((372, 640, 96, 34), (846, 700, 70, 26), (60, 736, 58, 22)):
        fill(x, y, w, h, 'yoru', 4)
        fill(x, y, w, 1, 'yoru', 2); fill(x, y + h - 1, w, 1, 'yoru', 2); fill(x, y, 1, h, 'yoru', 2); fill(x + w - 1, y, 1, h, 'yoru', 2)
        for k in range(x + 3, x + w - 3, 11):
            px(k, y + 3, 'yoru', 5); px(k + 4, y + h - 5, 'yoru', 2)
        for k in range(x + 2, x + w - 2, 7):
            px(k, y - 1, 'yoru', 4); px(k + 3, y + h, 'yoru', 4)
    crack([(560, 606), (566, 612), (564, 620), (572, 626), (578, 630)])
    crack([(912, 664), (920, 668), (926, 676), (938, 680), (944, 690), (952, 694)])
    crack([(220, 686), (228, 690), (234, 700), (244, 704)], 'yoru', 1)
    crack([(160, 750), (170, 748), (178, 754), (190, 752)])
    # 횡단보도 흰선의 닳은 자리(바탕 색 알갱이 뜯김)
    for k in range(9):
        yy = 578 + k * 20
        for dx in (12, 47, 71, 98):
            fill(660 + dx, yy + 2 + (k * 3 + dx) % 5, 3, 2, 'shiro', 1)
    # 연석 아래 도로 쪽 물때·자갈: 가장자리 이빨
    for x in range(0, W, 5):
        h = (x * 7 + x // 5) % 4
        if h == 1: px(x, 563, 'yoru', 2)
        if h == 2: px(x, 564, 'yoru', 2); px(x + 1, 563, 'yoru', 2)
        if h == 3 and x % 15 == 0: px(x, 566, 'yoru', 4)
    # 연석 앞면 손 때: 밝은 조각
    for x in range(20, W, 47):
        fill(x, 550, 6, 2, 'hodo', 6)
    # 보도 이음새에 낀 이끼·때
    for x, y in ((214, 456), (222, 471), (405, 519), (597, 470), (744, 456), (860, 522), (300, 536), (930, 498)):
        fill(x, y, 6, 2, 'midori', 0); px(x + 1, y - 1, 'midori', 1); px(x + 4, y + 2, 'midori', 0)
    # 건물 밑 그림자(왼쪽 위 빛): 벽에서 보도로 번진 -2단 띠, 오른쪽 끝은 비스듬히 끝난다
    for k in range(12):
        shade(0, 440 + k, 548 - (0 if k < 8 else k * 2), 1, -2 if k < 8 else -1)
    for k in range(14):
        shade(548, 424 + k, W - 548, 1, -2 if k < 9 else -1)


def roof_top(x, y, w, h, tone_far=4):
    """옥상 윗면: 방수 바닥(+2), 안쪽 난간 앞면, 배수구, 손 이음."""
    fill(x, y, w, h, 'conc', 5)
    for i in range(0, w, 32):   # 방수 시트 이음
        fill(x + i, y + 14, 1, h - 14, 'conc', 4)
    for j in range(24, h, 24):
        fill(x, y + j, w, 1, 'conc', 4)
    # 먼 쪽 난간: 윗면 +2, 안쪽 앞면 0, 바닥에 떨어지는 그림자
    fill(x, y, w, 5, 'conc', 6)
    fill(x, y + 5, w, 12, 'conc', 4)
    fill(x, y + 5, w, 1, 'conc', 5)
    fill(x, y + 17, w, 5, 'conc', 3)
    fill(x, y + 22, w, 3, 'conc', 4)


def cap_slab(x, w, top):
    """지붕 처마 슬래브: 윗면 +2 (5px), 앞면 +1 (9px), 아래 -2 그림자 3px."""
    fill(x, top, w, 5, 'conc', 6)
    fill(x, top + 5, w, 9, 'conc', 5)
    fill(x, top + 5, w, 1, 'conc', 6)
    fill(x, top + 13, w, 1, 'conc', 4)


def floor_slab(x, w, y):
    """층 슬래브(y = 바닥선): 위 2px 밝음, 앞 5px, 아래 3px 그림자."""
    fill(x, y - 8, w, 2, 'conc', 6)
    fill(x, y - 6, w, 5, 'conc', 5)
    fill(x, y - 1, w, 1, 'conc', 4)


def water_tank(x, y):
    """옥상 물탱크: 나무통 + 철 띠 + 원뿔 뚜껑 + 철 다리."""
    for i in range(0, 8):   # 다리
        pass
    fill(x + 4, y + 52, 4, 30, 'tekko', 3); fill(x + 4, y + 52, 1, 30, 'tekko', 5)
    fill(x + 56, y + 52, 4, 30, 'tekko', 2)
    fill(x + 30, y + 52, 4, 30, 'tekko', 3)
    fill(x + 4, y + 66, 56, 2, 'tekko', 4)
    fill(x - 2, y + 50, 68, 5, 'tekko', 4); fill(x - 2, y + 50, 68, 1, 'tekko', 5)
    # 통몸(원통을 세로 줄 조각으로: 왼쪽 밝고 오른쪽 어둡다)
    tones = [5, 5, 5, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1]
    for i in range(60):
        t = tones[min(19, i // 3)]
        fill(x + 2 + i, y + 12, 1, 38, 'ita', t)
    for j in (18, 30, 42):   # 철 띠
        fill(x + 2, y + j, 60, 2, 'tekko', 3); fill(x + 2, y + j, 60, 1, 'tekko', 4)
        fill(x + 44, y + j, 18, 2, 'tekko', 2)
    for i in range(6, 60, 7):    # 판자 홈
        fill(x + 2 + i, y + 12, 1, 38, 'ita', 2 if i < 40 else 1)
    # 원뿔 뚜껑
    for j in range(12):
        w = 60 - j * 4
        fill(x + 2 + j * 2, y + j, w, 1, 'tekko', 5 - (j > 8))
        fill(x + 2 + j * 2 + w - 8, y + j, 8, 1, 'tekko', 3)
    fill(x + 26, y - 4, 6, 6, 'tekko', 4); fill(x + 26, y - 4, 6, 1, 'tekko', 5)
    fill(x + 2, y + 50, 60, 4, 'ita', 1)
    fill(x + 4, y + 82, 60, 4, 'conc', 3)   # 발밑 그림자


def railing(x, y, w, h=18, posts=24):
    """옥상 난간: 윗 파이프 +2, 세로살, 아랫 파이프, 바닥 그림자."""
    fill(x, y, w, 3, 'tekko', 5); fill(x, y + 3, w, 1, 'tekko', 3)
    fill(x, y + h // 2, w, 2, 'tekko', 4)
    for i in range(0, w, 8):
        fill(x + i, y + 4, 2, h - 4, 'tekko', 3); fill(x + i, y + 4, 1, h - 4, 'tekko', 5)
    for i in range(0, w, posts):
        fill(x + i, y, 4, h, 'tekko', 4); fill(x + i, y, 1, h, 'tekko', 5); fill(x + i + 3, y, 1, h, 'tekko', 2)
    fill(x, y + h, w, 3, 'tekko', 2)
    fill(x + 3, y + h + 3, w, 2, 'conc', 3)


def right_building():
    X0, X1 = 572, 996            # 정면 폭
    top, base = 144, 424
    # ---- 뒤 경관(먼 옥상들): 흐린 톤
    fill(572, 0, 452, 56, 'conc', 2)
    for i in range(0, 452, 76):
        fill(572 + i, 8, 60, 48, 'conc', 3); fill(572 + i, 8, 60, 4, 'conc', 4); fill(572 + i + 56, 8, 4, 48, 'conc', 1)
    for i in range(20, 452, 120):
        fill(572 + i, 24, 20, 4, 'tekko', 2)
    fill(572, 52, 452, 4, 'conc', 1)
    for i in range(0, 452, 76):      # 먼 건물 창 줄: 어두운 유리 알갱이
        for jx in range(6, 50, 10):
            fill(572 + i + jx, 34, 6, 5, 'garasu', 1); px(572 + i + jx, 34, 'garasu', 3)
        fill(572 + i, 8, 1, 48, 'conc', 5)
    # ---- 옥상 윗면
    roof_top(572, 56, 452, 88)
    # 옥상 소품: 물탱크, 실외기, 난간, 환기관
    water_tank(716, 62)
    for ax in (846, 892):
        aircon(ax, 100, 40, 28)
    fill(946, 90, 10, 34, 'tekko', 3); fill(946, 90, 10, 3, 'tekko', 5); fill(946, 90, 1, 34, 'tekko', 5)   # 환기관
    fill(940, 86, 22, 5, 'tekko', 4); fill(940, 86, 22, 1, 'tekko', 5)
    fill(950, 124, 10, 4, 'conc', 3)
    # 옥상 출입 해치, 채광창 없음 — 배관과 배수 얼룩
    fill(612, 84, 46, 24, 'conc', 6); fill(612, 84, 46, 3, 'conc', 6)
    fill(612, 87, 46, 21, 'conc', 4); fill(612, 87, 46, 1, 'conc', 6); fill(650, 87, 8, 21, 'conc', 2)
    fill(628, 94, 12, 14, 'tekko', 3); fill(628, 94, 12, 1, 'tekko', 5); fill(628, 94, 1, 14, 'tekko', 5)
    fill(612, 108, 50, 3, 'conc', 3)
    fill(846, 92, 112, 4, 'tekko', 3); fill(846, 92, 112, 1, 'tekko', 5); fill(846, 96, 112, 2, 'conc', 3)
    for lx in (846, 890, 934):
        fill(lx, 90, 3, 8, 'tekko', 4)
    ellipse(780, 122, 14, 4, 'conc', 3); ellipse(778, 121, 8, 2, 'conc', 2)
    railing(600, 116, 220, 20, 28)
    railing(836, 122, 130, 16, 28)
    # 옥상 문(탑옥) 그늘 바닥
    # ---- 처마 슬래브
    cap_slab(572, 452, 136)
    # ---- 정면 벽: 콘크리트 패널
    fill(X0, top + 6, X1 - X0, base - top - 6, 'conc', 4)
    for px0 in range(X0, X1, 106):    # 패널 이음(왼 밝은 줄 + 어두운 홈)
        fill(px0, top + 6, 1, base - top - 6, 'conc', 2); fill(px0 + 1, top + 6, 1, base - top - 6, 'conc', 5)
    # 수직 핀(창 사이 돌출 기둥): 왼쪽 밝고 오른쪽 그늘, 옆에 떨어지는 그림자
    for c in range(3):
        fx = 674 + c * 96
        fill(fx, top + 6, 12, 190, 'conc', 5); fill(fx, top + 6, 2, 190, 'conc', 6); fill(fx + 9, top + 6, 3, 190, 'conc', 3)
        fill(fx + 12, top + 6, 3, 190, 'conc', 3)
    # 패널 표면 손 얼룩: 창 밑에서 흘러내린 물때
    stains = [(614, 200), (712, 204), (808, 197), (906, 203), (612, 264), (710, 268), (808, 262), (904, 266)]
    for sx, sy in stains:
        for k in range(3):
            fill(sx + k * 14, sy, 2, 18 + k * 6, 'conc', 3)
    fill(X0, 230, X1 - X0, 1, 'conc', 3)
    # 층 슬래브
    for k, fy in enumerate((208, 272, 336)):
        floor_slab(X0, X1 - X0, fy)
        fill(X0, fy, X1 - X0, 3, 'conc', 2)
        fill(X0, fy + 3, X1 - X0, 2, 'conc', 3)
        fill(X0, fy + 5, X1 - X0, 10, 'conc', 3); fill(X0, fy + 15, X1 - X0, 1, 'conc', 2)   # 창 아래 스팬드럴 띠
    # 창: 3층 x 4
    for k, (wy) in enumerate((166, 230, 294)):
        for c in range(4):
            wx = 600 + c * 96
            cur = [('kinari', 3), None, ('shiro', 3), ('kinari', 2)][(c + k) % 4]
            window(wx, wy, 64, 34, 'conc', 4, curtain=cur, refl=6 + ((c * 9 + k * 5) % 12), bars=(k == 1 and c in (0, 2)), glass=('kii' if (k, c) in ((1, 3), (2, 1)) else 'garasu'), blind=[0, 0, 14, 0, 20, 0, 0][(c * 3 + k * 2) % 7] if cur is None else 0)
    # 실외기(베란다 쪽)
    aircon(716, 246, 34, 24, 'shiro'); aircon(892, 182, 34, 24, 'shiro')
    # ---- 1층: 안쪽으로 들어간 상점층(그림자 띠)
    fill(X0, 336, X1 - X0, 88, 'conc', 3)
    fill(X0, 336, X1 - X0, 88, 'conc', 3)
    # 1층: 로비 유리문
    fill(620, 356, 96, 68, 'tekko', 4)
    fill(624, 362, 88, 62, 'garasu', 2)
    fill(624, 362, 88, 5, 'garasu', 1)
    fill(666, 362, 3, 62, 'tekko', 4); fill(666, 362, 1, 62, 'tekko', 5)
    for k in range(2):
        for j in range(30):
            xx = 630 + k * 46 + (30 - j)
            fill(xx, 368 + j, 5, 1, 'garasu', 4)
    fill(660, 392, 4, 14, 'tekko', 5); fill(672, 392, 4, 14, 'tekko', 5)     # 손잡이
    fill(624, 408, 88, 4, 'garasu', 1)
    fill(620, 424 - 2, 96, 2, 'conc', 5)
    # 인터폰 판
    fill(724, 372, 14, 24, 'tekko', 3); fill(724, 372, 14, 1, 'tekko', 5); fill(724, 372, 1, 24, 'tekko', 5)
    fill(727, 376, 8, 6, 'midori', 3); fill(727, 376, 8, 1, 'midori', 4)
    for j in range(3):
        fill(727, 386 + j * 4, 3, 2, 'shiro', 3); fill(732, 386 + j * 4, 3, 2, 'shiro', 2)
    # 셔터(주차장): 가로 홈
    fill(760, 352, 116, 72, 'tekko', 4)
    for j in range(0, 72, 6):
        fill(760, 352 + j, 116, 1, 'tekko', 5); fill(760, 352 + j + 1, 116, 4, 'tekko', 4); fill(760, 352 + j + 5, 116, 1, 'tekko', 2)
    fill(760, 352, 6, 72, 'tekko', 3); fill(870, 352, 6, 72, 'tekko', 2)
    fill(808, 410, 20, 6, 'tekko', 2); fill(808, 410, 20, 1, 'tekko', 5); fill(814, 412, 8, 2, 'yoru', 2)
    fill(760, 352, 116, 10, 'tekko', 2)   # 셔터 박스
    # 작은 격자창(철망)
    fill(896, 366, 60, 40, 'tekko', 3)
    fill(898, 368, 56, 36, 'garasu', 1)
    for i in range(0, 56, 7):
        fill(898 + i, 368, 2, 36, 'tekko', 3)
    for j in range(0, 36, 9):
        fill(898, 368 + j, 56, 2, 'tekko', 3)
    # 1층 천장 밑 그림자(안쪽 8칸) + 기둥 그림자
    fill(X0, 336, X1 - X0, 5, 'conc', 1)
    shade(X0, 341, X1 - X0, 8, -2)
    fill(X0, 349, X1 - X0, 3, 'conc', 2)
    fill(X0, 336, 8, 88, 'conc', 2)
    # 1층 바닥 걸레받이
    fill(X0, 420, X1 - X0, 4, 'conc', 2)
    # ---- 배수관과 계량기
    fill(584, 150, 6, 274, 'tekko', 3); fill(584, 150, 2, 274, 'tekko', 5); fill(588, 150, 2, 274, 'tekko', 2)
    for j in range(160, 424, 48):
        fill(582, j, 10, 4, 'tekko', 4); fill(582, j, 10, 1, 'tekko', 5)
    fill(740, 380, 14, 18, 'tekko', 2); fill(741, 381, 12, 16, 'tekko', 3)   # 계량기 함
    px(746, 388, 'kii', 3)
    # ---- 왼쪽 건물이 드리우는 그림자(왼쪽 28px, 위쪽 넓게)
    for i, (wd, hh) in enumerate(((30, 70), (24, 60), (18, 60), (12, 60), (8, 30))):   # 계단식으로 좁아지는 그림자
        y0 = top + 6 + sum(h for _, h in ((30, 70), (24, 60), (18, 60), (12, 60), (8, 30))[:i])
        shade(X0, y0, wd, hh if y0 + hh <= base else base - y0, -2)
        shade(X0 + wd, y0, 6, hh if y0 + hh <= base else base - y0, -1)
    for yy in range(56, 144):
        shade(X0, yy, 38 - (yy - 56) // 3, 1, -2)      # 왼쪽 건물 옥상이 드리우는 비스듬한 그림자
    # ---- 오른쪽 옆면(그늘 -2)
    fill(996, 136, 28, 288, 'conc', 2)
    fill(996, 136, 28, 5, 'conc', 4)
    fill(996, 136, 1, 288, 'conc', 1)
    for j in range(150, 424, 64):
        fill(1004, j, 14, 30, 'garasu', 1); fill(1004, j, 14, 2, 'garasu', 0); fill(1004, j, 2, 30, 'garasu', 0)
        fill(1002, j + 30, 18, 3, 'conc', 3)
    fill(996, 418, 28, 6, 'conc', 1)
    # ---- 세로 간판(빨강·흰 판넬 3칸, 벽에서 튀어나옴): 그림자는 오른쪽·아래
    sx, sy = 962, 150
    fill(sx + 5, sy + 4, 32, 140, 'conc', 1)      # 벽에 떨어진 그림자(오른쪽·아래)
    fill(sx, sy, 32, 140, 'aka', 3)
    fill(sx, sy, 32, 3, 'aka', 4); fill(sx, sy, 2, 140, 'aka', 4)
    fill(sx + 30, sy, 2, 140, 'aka', 1); fill(sx, sy + 137, 32, 3, 'aka', 1)
    for i, ch in enumerate('ホテル'):
        py = sy + 6 + i * 44
        fill(sx + 4, py, 24, 40, 'shiro', 3); fill(sx + 4, py, 24, 2, 'shiro', 4); fill(sx + 4, py + 39, 24, 1, 'shiro', 1)
        fill(sx + 27, py, 1, 40, 'shiro', 2)
        pat(sx + 9, py + 12, GLYPH[ch], {'#': ('aka', 1)}, 2)
    fill(sx + 12, sy - 8, 8, 8, 'tekko', 3)   # 고정 금구
    fill(sx + 12, sy + 140, 8, 6, 'tekko', 2)


def left_building():
    X1 = 548
    # ---- 옥상 윗면 (y8..)
    roof_top(0, 8, X1, 88)
    # 계단실(탑옥): 윗면 +2, 앞면 0, 오른쪽 그림자
    fill(36, 44, 118, 8, 'conc', 6); fill(36, 52, 118, 36, 'conc', 4); fill(36, 52, 118, 1, 'conc', 5)
    fill(36, 88, 118, 3, 'conc', 2)
    fill(154, 52, 12, 36, 'conc', 3)
    fill(150, 88, 24, 4, 'conc', 3)   # 발밑 그림자
    fill(46, 60, 22, 28, 'tekko', 3); fill(46, 60, 22, 1, 'tekko', 5); fill(46, 60, 1, 28, 'tekko', 5)
    fill(50, 64, 14, 22, 'tekko', 4); fill(60, 74, 3, 4, 'tekko', 5)
    fill(94, 62, 40, 16, 'tekko', 3)
    for i in range(0, 40, 4): fill(94 + i, 62, 2, 16, 'tekko', 2)   # 환기 루버
    fill(94, 62, 40, 1, 'tekko', 5)
    # 실외기 셋, 안테나
    for ax in (232, 282, 340):
        aircon(ax, 56, 40, 28)
    fill(432, 30, 4, 60, 'tekko', 4); fill(432, 30, 1, 60, 'tekko', 5)
    fill(420, 38, 28, 3, 'tekko', 4); fill(424, 48, 20, 3, 'tekko', 4); fill(426, 58, 16, 3, 'tekko', 4)
    fill(430, 90, 8, 3, 'tekko', 2)
    fill(176, 62, 44, 24, 'tekko', 4); fill(176, 62, 44, 2, 'tekko', 5); fill(176, 62, 2, 24, 'tekko', 5)     # 채광창
    fill(180, 66, 36, 16, 'garasu', 3); fill(180, 66, 36, 4, 'garasu', 1)
    for k in range(3):
        fill(186 + k * 9, 70, 2, 12, 'garasu', 5)
    fill(198, 66, 2, 16, 'tekko', 4); fill(176, 86, 46, 3, 'conc', 3)
    fill(392, 46, 10, 40, 'tekko', 3); fill(392, 46, 2, 40, 'tekko', 5); fill(400, 46, 2, 40, 'tekko', 1)     # 환기 굴뚝
    fill(388, 42, 18, 6, 'tekko', 4); fill(388, 42, 18, 1, 'tekko', 5)
    fill(388, 86, 22, 3, 'conc', 3)
    railing(0, 76, 226, 20, 28)
    railing(380, 76, 168, 20, 28)
    # ---- 처마 슬래브 + 정면 타일벽
    cap_slab(0, X1, 88)
    top, base = 96, 440
    brick(0, top + 6, X1, 352 - top - 6, 'renga', 4, tw=16, th=8)
    # 층 슬래브(콘크리트 띠)
    for k in range(1, 5):
        fy = 96 + 64 * k
        fill(0, fy - 8, X1, 2, 'conc', 6)
        fill(0, fy - 6, X1, 5, 'conc', 5)
        fill(0, fy - 1, X1, 1, 'conc', 3)
        fill(0, fy, X1, 3, 'renga', 1)         # 슬래브 밑 3px 그림자
        fill(0, fy + 3, X1, 3, 'renga', 2)
    # 창: 4층 x 4
    for k in range(4):
        wy = 96 + 64 * k + 14
        for c in range(4):
            wx = 22 + c * 122
            cur = [None, ('kinari', 3), ('shiro', 3), None, ('kinari', 2)][(c * 2 + k) % 5]
            window(wx, wy, 76, 34, 'renga', 4, curtain=cur, refl=4 + ((c * 11 + k * 7) % 14), bars=(k in (1, 2) and c in (1, 3)), glass=('kii' if (k, c) in ((2, 2), (0, 0)) else 'garasu'), blind=[0, 0, 16, 0, 0, 22][(c * 2 + k * 5) % 6] if cur is None else 0)
    # 실외기: 4층 베란다 옆
    aircon(0 + 6, 0 + 0, 0, 0) if False else None
    aircon(104, 250, 0, 0) if False else None
    # 세로 간판(핑크): 벽에서 튀어나와 오른쪽 아래로 그림자
    sx, sy = 514, 118
    fill(sx + 5, sy + 4, 26, 126, 'renga', 0)
    fill(sx, sy, 26, 126, 'pinku', 2); fill(sx, sy, 26, 2, 'pinku', 4); fill(sx, sy, 2, 126, 'pinku', 4)
    fill(sx + 24, sy, 2, 126, 'pinku', 0); fill(sx, sy + 124, 26, 2, 'pinku', 0)
    for i, ch in enumerate('ルート'):
        py = sy + 6 + i * 40
        fill(sx + 3, py, 20, 36, 'shiro', 3); fill(sx + 3, py, 20, 1, 'shiro', 4); fill(sx + 3, py + 35, 20, 1, 'shiro', 1)
        pat(sx + 6, py + 9, GLYPH[ch], {'#': ('pinku', 0)}, 2)
    fill(sx + 10, sy - 6, 6, 6, 'tekko', 3)
    # 배수관
    fill(500, 100, 6, 252, 'tekko', 3); fill(500, 100, 2, 252, 'tekko', 5); fill(504, 100, 2, 252, 'tekko', 2)
    for j in range(108, 352, 40):
        fill(498, j, 10, 4, 'tekko', 4); fill(498, j, 10, 1, 'tekko', 5)
    # 위에서 흘러내린 물때 (창 밑)
    for k in range(3):
        for c in (0, 2, 3):
            fill(22 + c * 122 + 20 + k * 20, 96 + 64 * k + 48, 2, 10, 'renga', 3)
    # ---- 1층: 안으로 16px 들어간 상점 (슬래브 그림자)
    fill(0, 352, X1, 88, 'renga', 2)
    # 편의점 x0..300
    fill(0, 358, 300, 34, 'shiro', 3)
    fill(0, 358, 300, 3, 'sora', 3); fill(0, 361, 300, 3, 'sora', 2)
    fill(0, 384, 300, 3, 'midori', 3); fill(0, 387, 300, 3, 'midori', 2)
    fill(0, 364, 300, 20, 'shiro', 3); fill(0, 364, 300, 1, 'shiro', 4)
    w = text_w('ロート')
    text(28, 366, 'ロート', 'midori', 1, 2, 3, sh=('shiro', 1))
    tx = 28 + w + 14
    text(tx, 366, '24', 'sora', 1, 2, 3); text(tx + text_w('24') + 3, 366, 'H', 'sora', 1, 2, 3)
    ellipse(240, 374, 12, 8, 'aka', 3); ellipse(238, 372, 8, 5, 'aka', 4)
    fill(0, 390, 300, 3, 'tekko', 2)
    # 유리 진열창(안쪽 선반과 상품)
    fill(0, 394, 300, 42, 'tekko', 4)
    fill(4, 398, 292, 36, 'kinari', 3)
    fill(4, 398, 292, 6, 'kinari', 4)     # 천장 조명
    for i in range(10, 292, 36):
        fill(i, 399, 20, 3, 'shiro', 4)
    shelf = [('aka', 'kii', 'sora', 'midori'), ('daidai', 'shiro', 'pinku', 'kii'), ('sora', 'aka', 'midori', 'shiro')]
    for j in range(3):
        sy = 406 + j * 10
        fill(4, sy + 7, 292, 2, 'ita', 3)
        for i in range(10, 176, 6):
            rr = shelf[j][(i // 6) % 4]
            fill(4 + i, sy, 4, 7, rr, 3); fill(4 + i, sy, 4, 1, rr, 4); fill(4 + i + 3, sy, 1, 7, rr, 1)
    fill(4, 398, 292, 36, 'kinari', 3) if False else None
    # 오른쪽 냉장고 진열대와 유리 반사
    fill(184, 400, 4, 34, 'tekko', 4); fill(60, 434, 236, 2, 'tekko', 3)
    for k in range(0, 292, 70):
        for j in range(30):
            xx = 12 + k + (30 - j)
            fill(xx, 400 + j, 4, 1, 'garasu', 5)
            fill(xx + 5, 400 + j, 2, 1, 'garasu', 4)
    fill(4, 398, 292, 4, 'tekko', 2)
    # 자동문 (두 쪽)
    fill(190, 394, 62, 44, 'tekko', 4); fill(192, 398, 28, 40, 'garasu', 3); fill(222, 398, 28, 40, 'garasu', 3)
    fill(192, 398, 28, 4, 'garasu', 1); fill(222, 398, 28, 4, 'garasu', 1)
    fill(219, 394, 4, 44, 'tekko', 5)
    fill(215, 412, 3, 12, 'tekko', 5); fill(224, 412, 3, 12, 'tekko', 5)
    for j in range(24):
        fill(194 + (24 - j), 400 + j, 3, 1, 'garasu', 5); fill(224 + (24 - j), 400 + j, 3, 1, 'garasu', 5)
    # 문 옆 광고 포스터
    fill(262, 396, 30, 36, 'kii', 3); fill(262, 396, 30, 2, 'kii', 4); fill(262, 396, 2, 36, 'kii', 4)
    fill(268, 402, 18, 10, 'aka', 3); fill(268, 416, 18, 3, 'aka', 2); fill(268, 422, 12, 3, 'kon', 2)
    # 편의점 밑 접합·문턱
    fill(0, 436, 300, 4, 'conc', 4); fill(0, 436, 300, 1, 'conc', 6)
    # 식당 x300..548 (나무 격자문 + 노렌)
    fill(300, 352, 248, 88, 'ita', 2)
    # 작은 기와 차양
    fill(300, 356, 248, 5, 'kawara', 5); fill(300, 356, 248, 1, 'kawara', 6)
    fill(300, 361, 248, 11, 'kawara', 3)
    for i in range(300, 548, 8):
        fill(i, 361, 1, 11, 'kawara', 2); fill(i + 1, 361, 1, 11, 'kawara', 4)
    fill(300, 372, 248, 3, 'kawara', 1)
    fill(300, 375, 248, 3, 'ita', 1)
    # 문틀·격자 미닫이 x336..420
    fill(334, 380, 92, 60, 'ita', 4)
    fill(334, 380, 92, 3, 'ita', 5); fill(334, 380, 3, 60, 'ita', 5); fill(423, 380, 3, 60, 'ita', 2)
    fill(338, 386, 84, 54, 'kinari', 2)
    for i in range(338, 422, 14):
        fill(i, 386, 2, 54, 'ita', 3); fill(i, 386, 1, 54, 'ita', 5)
    for j in range(386, 440, 14):
        fill(338, j, 84, 2, 'ita', 3)
    fill(338, 386, 84, 4, 'kinari', 1)
    # 노렌 (곤색, 세 갈래, 흰 글씨)
    fill(330, 388, 100, 4, 'ita', 2)
    fill(330, 388, 100, 1, 'ita', 5)
    for k, ch in enumerate('ラーメン'):
        nx = 336 + k * 23
        fill(nx, 392, 21, 40, 'kon', 2)
        fill(nx, 392, 2, 40, 'kon', 3)
        fill(nx + 19, 392, 2, 40, 'kon', 1)
        fill(nx, 392, 21, 2, 'kon', 1)
        fill(nx, 430, 21, 2, 'kon', 1)
        fill(nx + 9, 432, 3, 3, 'kon', 1)      # 늘어진 자락 그림자
        pat(nx + 3, 398, GLYPH[ch], {'#': ('shiro', 4)}, 2)
        # 붉은 초롱
    fill(438, 388, 3, 10, 'tekko', 3)
    ellipse(440, 411, 11, 14, 'aka', 3)
    ellipse(438, 408, 7, 10, 'aka', 4)
    fill(430, 396, 20, 2, 'yoru', 2); fill(430, 425, 20, 2, 'yoru', 2)
    for j in (404, 411, 418): fill(431, j, 18, 1, 'aka', 2)
    fill(447, 400, 3, 22, 'aka', 1)
    fill(437, 405, 6, 12, 'kii', 4)
    # 작은 격자창과 메뉴판
    fill(464, 388, 70, 42, 'ita', 4)
    fill(464, 388, 70, 3, 'ita', 5)
    fill(468, 394, 62, 36, 'kinari', 3)
    for i in range(468, 530, 8): fill(i, 394, 3, 36, 'ita', 3); fill(i, 394, 1, 36, 'ita', 5)
    fill(468, 394, 62, 5, 'kinari', 1)
    fill(464, 430, 70, 4, 'conc', 5); fill(464, 434, 70, 3, 'renga', 1)
    fill(478, 404, 32, 20, 'kokuban', 3); outline_box(477, 403, 34, 22, 'ita', 3)
    for j, ww in enumerate((20, 24, 16)):
        fill(482, 408 + j * 5, ww, 2, 'shiro', 4)
    # 식당 발치
    fill(300, 436, 248, 4, 'conc', 4); fill(300, 436, 248, 1, 'conc', 6)
    # 1층 슬래브 아래 짙은 그림자(들어간 상점층)
    shade(0, 352, X1, 12, -2)
    fill(0, 352, X1, 3, 'renga', 0)
    # ---- 오른쪽 옆면(-2): 앞으로 튀어나온 5층 건물의 그늘진 옆면
    fill(548, 88, 24, 352, 'renga', 2)
    brick(548, 96, 24, 344, 'renga', 2, tw=12, th=8, var=[0, 0, -1, 0, 0])
    fill(548, 88, 24, 8, 'conc', 4)
    fill(548, 88, 24, 2, 'conc', 5)
    fill(548, 88, 1, 352, 'renga', 1)
    for j in range(110, 352, 64):
        fill(554, j, 12, 30, 'garasu', 1); fill(554, j, 12, 3, 'garasu', 0); fill(554, j, 2, 30, 'garasu', 0)
        fill(552, j + 30, 16, 3, 'conc', 2)
    fill(548, 352, 24, 88, 'renga', 1)
    # 땅에 떨어지는 건물 그림자(보도)
    shade(0, 440, 572, 10, -2)
    shade(0, 450, 572, 6, -1)
    shade(572, 424, 480, 6, -2)
    shade(572, 430, 480, 4, -1)


# ================================================================ 보도 위 물건
def guardrail():
    """연석 위 가드레일: 윗 파이프 +2, 가로 파이프, 기둥 + 발밑 그림자. 횡단보도 자리(660..784)는 비운다."""
    for (a, b) in ((0, 652), (792, W)):
        # 두 줄 가로 파이프(윗줄 밝음 / 아랫줄 그늘)
        fill(a, 526, b - a, 4, 'tekko', 5); fill(a, 526, b - a, 1, 'tekko', 6); fill(a, 529, b - a, 1, 'tekko', 3)
        fill(a, 538, b - a, 3, 'tekko', 4); fill(a, 538, b - a, 1, 'tekko', 5); fill(a, 540, b - a, 1, 'tekko', 2)
        for x in range(a + 4, b - 4, 7):     # 두 파이프 사이 가는 세로살
            fill(x, 530, 1, 8, 'tekko', 3); px(x, 530, 'tekko', 4)
        for x in range(a + 12, b - 6, 60):
            fill(x, 522, 6, 28, 'tekko', 4); fill(x, 522, 2, 28, 'tekko', 5); fill(x + 4, 522, 2, 28, 'tekko', 2)
            fill(x - 1, 522, 8, 3, 'tekko', 5)
            fill(x - 2, 549, 10, 3, 'tekko', 2)
            fill(x + 4, 552, 12, 2, 'hodo', 1)       # 오른쪽 아래로 떨어지는 발밑 그림자
        fill(a, 550, b - a, 2, 'hodo', 2)


LEAF = ["..##..#.", ".###.##.", "..#..#..", "#..##..#", "###..###", ".#..###.", "..##.#..", "#..#..##"]   # 손으로 정한 잎 알갱이 8x8


def leafy(cx, cy, rx, ry):
    """수관 덩이 하나: 어두운 바탕 → 왼쪽 위로 밝아지는 면 → 잎 알갱이(+1). 맨 밖 테두리는 그늘."""
    for y in range(int(cy - ry), int(cy + ry) + 1):
        for x in range(int(cx - rx), int(cx + rx) + 1):
            u = (x + .5 - cx) / rx; v = (y + .5 - cy) / ry
            if u * u + v * v > 1.0:
                continue
            light = -(u + v) / 2
            t = 3 if light > .42 else 2 if light > .0 else 1 if light > -.38 else 0
            if v > .72 and u > -.2:
                t = 0
            if LEAF[y % 8][(x + (y // 8) * 3) % 8] == '#' and light > .3:
                t = min(t + 1, 4) if (x + y) % 5 == 0 else t
            elif LEAF[y % 8][(x + (y // 8) * 3) % 8] == '#' and t >= 1 and light < 0:
                t -= 1
            px(x, y, 'midori' if t > 0 or (x + y) % 3 else 'ki', max(t, 0) if t > 0 or (x + y) % 3 else 1)


def tree(cx, foot):
    """가로수. 줄기는 밑변과 같은 폭(8px), 수관은 손으로 놓은 덩이 여럿(뒤→앞), 밝은 쪽은 왼쪽 위."""
    fill(cx - 22, foot - 6, 44, 10, 'soil', 2); fill(cx - 22, foot - 6, 44, 2, 'soil', 3)
    fill(cx - 22, foot + 2, 44, 3, 'soil', 1)
    fill(cx - 24, foot - 8, 48, 3, 'conc', 5); fill(cx - 24, foot - 5, 48, 2, 'conc', 3)
    fill(cx - 24, foot + 1, 48, 4, 'conc', 4)
    for j in range(36):
        fill(cx - 4, foot - 8 - j, 8, 1, 'soil', 3)
        px(cx - 4, foot - 8 - j, 'soil', 4); px(cx - 3, foot - 8 - j, 'soil', 4)
        px(cx + 2, foot - 8 - j, 'soil', 1); px(cx + 3, foot - 8 - j, 'soil', 0)
        if j % 6 == 2: px(cx - 1, foot - 8 - j, 'soil', 2); px(cx, foot - 7 - j, 'soil', 2)
    for j in range(10):     # 가지 두 갈래
        fill(cx - 5 - j, foot - 46 - j, 4, 3, 'soil', 3); fill(cx + 3 + j, foot - 50 - j, 4, 3, 'soil', 2)
    clumps = [(0, -106, 21, 17), (-22, -90, 19, 16), (22, -88, 20, 16), (-30, -66, 17, 14), (31, -66, 17, 14), (0, -84, 24, 19),
              (-15, -62, 18, 13), (17, -60, 18, 13)]
    for dx, dy, rx, ry in clumps:
        leafy(cx + dx, foot + dy, rx, ry)
    fill(cx - 8, foot - 44, 22, 3, 'midori', 0)          # 줄기 위 수관 밑 그늘
    fill(cx + 8, foot + 5, 44, 5, 'hodo', 2)
    fill(cx + 4, foot + 10, 38, 3, 'hodo', 2)
    fill(cx - 22, foot + 6, 24, 3, 'hodo', 2)


def vending(x, foot, ramp, label):
    """자판기 32x52. 앞면 +0, 왼쪽 윗 모서리 하이라이트, 투명 진열창(음료 캔 줄), 취출구, 동전 투입구."""
    top = foot - 52
    fill(x + 2, foot, 34, 3, 'hodo', 2)            # 아래 그림자 (오른쪽으로 길게)
    fill(x + 30, foot - 6, 8, 8, 'hodo', 2)
    fill(x, top, 32, 52, ramp, 3)
    fill(x, top, 32, 2, ramp, 4); fill(x, top, 2, 52, ramp, 4)
    fill(x + 30, top, 2, 52, ramp, 1); fill(x, foot - 2, 32, 2, ramp, 1)
    fill(x + 3, top + 4, 26, 6, 'shiro', 3); fill(x + 3, top + 4, 26, 1, 'shiro', 4)
    fill(x + 5, top + 6, 8, 2, ramp, 2); fill(x + 15, top + 6, 12, 2, 'kon', 2)
    # 진열창
    fill(x + 3, top + 12, 20, 24, 'tekko', 1)
    fill(x + 4, top + 13, 18, 22, 'garasu', 1)
    cols = ['aka', 'sora', 'kii', 'midori', 'daidai', 'shiro']
    for j in range(3):
        for i in range(4):
            c = cols[(i * 2 + j * 3 + (1 if ramp == 'sora' else 0)) % 6]
            fill(x + 5 + i * 4, top + 15 + j * 7, 3, 5, c, 3); px(x + 5 + i * 4, top + 15 + j * 7, c, 4)
        fill(x + 4, top + 21 + j * 7, 18, 1, 'garasu', 0)
    for k in range(10):
        px(x + 5 + k, top + 13 + k, 'garasu', 4) if k % 2 == 0 else None
    # 조작부(버튼 열)
    fill(x + 24, top + 12, 5, 24, 'tekko', 2)
    for j in range(4):
        fill(x + 25, top + 14 + j * 5, 3, 3, 'shiro', 4 if j != 1 else 3)
    px(x + 26, top + 38, 'aka', 4)
    fill(x + 24, top + 38, 5, 3, 'tekko', 4)    # 동전 투입구
    px(x + 26, top + 39, 'yoru', 1)
    # 취출구
    fill(x + 4, foot - 12, 24, 8, 'yoru', 2); fill(x + 4, foot - 12, 24, 1, 'yoru', 1); fill(x + 4, foot - 5, 24, 1, 'tekko', 4)
    fill(x + 6, foot - 8, 10, 1, 'yoru', 1)
    # 바닥 걸레받이
    fill(x + 1, foot - 1, 30, 1, 'yoru', 2)


def lamp(x, foot):
    """가로등: 기둥은 왼쪽 밝음, 팔이 오른쪽(차도)으로 뻗고 머리등, 발밑 받침."""
    fill(x - 2, foot - 4, 16, 6, 'tekko', 3); fill(x - 2, foot - 4, 16, 1, 'tekko', 5); fill(x + 12, foot - 4, 2, 6, 'tekko', 1)
    fill(x + 14, foot + 2, 14, 3, 'hodo', 2)
    fill(x + 2, foot - 128, 8, 124, 'tekko', 3)
    fill(x + 2, foot - 128, 2, 124, 'tekko', 5); fill(x + 8, foot - 128, 2, 124, 'tekko', 1)
    fill(x + 1, foot - 60, 10, 3, 'tekko', 4)
    fill(x + 1, foot - 100, 10, 3, 'tekko', 4)
    # 팔: 곡선으로 위로 꺾여 차도 쪽으로
    fill(x + 2, foot - 132, 8, 6, 'tekko', 4)
    for i in range(0, 34):
        yy = foot - 136 - (i // 8)
        fill(x + 8 + i, yy, 1, 5, 'tekko', 3)
        px(x + 8 + i, yy, 'tekko', 5)
    fill(x + 36, foot - 142, 26, 8, 'tekko', 3); fill(x + 36, foot - 142, 26, 2, 'tekko', 5)
    fill(x + 38, foot - 134, 24, 5, 'kii', 2); fill(x + 38, foot - 134, 24, 1, 'kii', 4)
    fill(x + 40, foot - 129, 20, 2, 'kii', 4)
    # 머리등 그림자는 앞건물 벽에 없음 — 대신 전선 없이 깨끗하게 둔다


def manhole(cx, cy):
    ellipse(cx, cy, 24, 11, 'yoru', 1)
    ellipse(cx, cy, 22, 9, 'tekko', 3)
    ellipse(cx - 1, cy - 1, 19, 7, 'tekko', 2)
    for i in range(-14, 16, 6):
        fill(cx + i - 1, cy - 6, 3, 12, 'tekko', 3)
        fill(cx + i - 1, cy - 6, 1, 12, 'tekko', 4)
    fill(cx - 15, cy - 1, 30, 2, 'tekko', 4)
    fill(cx - 15, cy + 1, 30, 1, 'tekko', 1)
    ellipse(cx, cy, 24, 11, 'yoru', 1) if False else None
    fill(cx - 12, cy + 7, 24, 2, 'tekko', 5)


def traffic_light(x, foot):
    """신호등: 기둥, 왼쪽(차도)으로 나온 수평 팔, 가로 3구 등. 초록 점등."""
    fill(x - 2, foot - 4, 18, 8, 'tekko', 3); fill(x - 2, foot - 4, 18, 1, 'tekko', 5); fill(x + 12, foot - 4, 4, 8, 'tekko', 1)
    fill(x + 16, foot + 4, 14, 3, 'hodo', 2)
    fill(x + 3, foot - 190, 10, 186, 'tekko', 3)
    fill(x + 3, foot - 190, 3, 186, 'tekko', 5); fill(x + 11, foot - 190, 2, 186, 'tekko', 1)
    for j in range(foot - 180, foot - 20, 40):
        fill(x + 2, j, 12, 3, 'tekko', 4)
    # 수평 팔
    ax = x - 100
    fill(ax, foot - 196, 108, 8, 'tekko', 3); fill(ax, foot - 196, 108, 2, 'tekko', 5); fill(ax, foot - 189, 108, 1, 'tekko', 1)
    # 신호 머리
    hx, hy = ax + 6, foot - 224
    fill(hx + 4, hy + 34, 84, 6, 'yoru', 1)
    fill(hx, hy, 92, 34, 'tekko', 2)
    fill(hx, hy, 92, 2, 'tekko', 4); fill(hx, hy, 2, 34, 'tekko', 4)
    fill(hx + 90, hy, 2, 34, 'tekko', 0); fill(hx, hy + 32, 92, 2, 'tekko', 0)
    cols = [('aka', 1), ('kii', 1), ('midori', 4)]
    for i, (c, t) in enumerate(cols):
        cx = hx + 16 + i * 30
        ellipse(cx, hy + 17, 12, 12, 'yoru', 0)
        ellipse(cx, hy + 17, 10, 10, c, t)
        if i == 2:
            ellipse(cx, hy + 17, 10, 10, 'midori', 3)
            ellipse(cx - 1, hy + 16, 6, 6, 'midori', 4)
            fill(cx - 5, hy + 10, 3, 2, 'shiro', 3)
        else:
            fill(cx - 5, hy + 9, 3, 2, c, 2)
        # 후드
        fill(cx - 12, hy - 5, 24, 5, 'tekko', 2); fill(cx - 12, hy - 5, 24, 1, 'tekko', 4)
    # 보행자 신호(작은 상자, 기둥 쪽)
    fill(x - 14, foot - 150, 18, 26, 'tekko', 2); fill(x - 14, foot - 150, 18, 2, 'tekko', 4); fill(x - 14, foot - 150, 2, 26, 'tekko', 4)
    fill(x - 11, foot - 146, 12, 8, 'aka', 2); fill(x - 11, foot - 146, 12, 1, 'aka', 3)
    fill(x - 11, foot - 135, 12, 8, 'sora', 1)
    fill(x - 8, foot - 133, 6, 4, 'midori', 4)
    fill(x + 4, foot - 124, 10, 4, 'tekko', 4)
    fill(x + 18, foot + 5, 20, 3, 'hodo', 2)


def taxi(x, y):
    """택시(옆면): 노랑 몸통, 지붕 위 표시등, 창 두 개, 바퀴 둘. x,y = 좌상단(약 152x56)."""
    w = 152
    fill(x - 6, y + 56, w + 16, 5, 'yoru', 1)                        # 바닥 그림자
    fill(x + 14, y + 50, w - 20, 6, 'yoru', 1)
    # 차체 하부
    fill(x, y + 24, w, 28, 'kii', 3)
    fill(x, y + 24, w, 3, 'kii', 4); fill(x, y + 24, 3, 28, 'kii', 4)
    fill(x + w - 4, y + 24, 4, 28, 'kii', 1); fill(x, y + 46, w, 6, 'kii', 1)
    fill(x + 3, y + 38, w - 6, 2, 'kii', 2)                          # 캐릭터 라인
    fill(x + 3, y + 36, w - 6, 1, 'kii', 4)
    # 후드(앞) 오른쪽 낮게, 트렁크(뒤) 왼쪽
    fill(x + w - 32, y + 16, 32, 10, 'kii', 3); fill(x + w - 32, y + 16, 32, 2, 'kii', 4)
    fill(x, y + 18, 26, 8, 'kii', 3); fill(x, y + 18, 26, 2, 'kii', 4)
    # 캐빈
    for j in range(16):
        fill(x + 26 + j, y + 8 + (15 - j) // 1 * 0 + 16 - 16 + 0, 0, 0, 'kii', 3)
    fill(x + 30, y + 4, 84, 20, 'kii', 3)
    fill(x + 30, y + 4, 84, 2, 'kii', 4)
    for j in range(8):      # 앞 유리 기둥 경사(오른쪽)
        fill(x + 114 + j * 2, y + 12 + j * 1, 2, 12 - j, 'kii', 3)
    for j in range(6):
        fill(x + 22 + j * 1, y + 18 + j, 8 - j, 1, 'kii', 3)
    # 창
    fill(x + 34, y + 8, 34, 14, 'garasu', 2); fill(x + 72, y + 8, 38, 14, 'garasu', 2)
    fill(x + 34, y + 8, 34, 3, 'garasu', 1); fill(x + 72, y + 8, 38, 3, 'garasu', 1)
    fill(x + 34, y + 8, 3, 14, 'garasu', 1); fill(x + 72, y + 8, 3, 14, 'garasu', 1)
    for k in range(3):
        fill(x + 40 + k * 8, y + 12 + k, 3, 8 - k, 'garasu', 5)
        fill(x + 78 + k * 8, y + 12 + k, 3, 8 - k, 'garasu', 5)
    fill(x + 68, y + 6, 4, 18, 'kii', 2)                             # B필러
    fill(x + 44, y + 12, 14, 10, 'yoru', 1)                          # 승객 실루엣
    fill(x + 46, y + 8, 10, 6, 'yoru', 1)
    # 표시등(지붕 위)
    fill(x + 60, y - 4, 26, 8, 'shiro', 3); fill(x + 60, y - 4, 26, 2, 'shiro', 4); fill(x + 60, y + 2, 26, 2, 'shiro', 1)
    fill(x + 64, y - 2, 8, 4, 'aka', 3)
    # 문 손잡이·문 틈새
    fill(x + 64, y + 26, 2, 22, 'kii', 1); fill(x + 108, y + 26, 2, 22, 'kii', 1)
    fill(x + 54, y + 30, 8, 2, 'kii', 1); fill(x + 96, y + 30, 8, 2, 'kii', 1)
    # 문짝 옆 광고띠
    fill(x + 72, y + 38, 30, 6, 'shiro', 3); fill(x + 74, y + 40, 26, 2, 'aka', 2)
    # 헤드라이트·테일램프
    fill(x + w - 5, y + 30, 5, 8, 'shiro', 4); fill(x, y + 30, 4, 8, 'aka', 2)
    fill(x + w - 4, y + 44, 4, 4, 'kii', 4)
    # 범퍼
    fill(x - 1, y + 46, 10, 6, 'tekko', 4); fill(x + w - 8, y + 46, 9, 6, 'tekko', 4)
    fill(x - 1, y + 46, 10, 1, 'tekko', 5)
    # 바퀴: 앞뒤. 타이어 -어둠, 휠캡 회색
    for wx in (x + 24, x + 108):
        ellipse(wx + 11, y + 52, 19, 19, 'yoru', 0, ymax=y + 51)      # 바퀴 아치(몸통 안쪽 어둠)
        ellipse(wx + 11, y + 52, 15, 15, 'yoru', 0)
        ellipse(wx + 11, y + 52, 13, 13, 'yoru', 1)
        ellipse(wx + 11, y + 52, 8, 8, 'tekko', 3)
        ellipse(wx + 10, y + 51, 5, 5, 'tekko', 5)
        px(wx + 11, y + 52, 'tekko', 2)
        fill(wx - 6, y + 34, 34, 2, 'kii', 1) if False else None
    # 바퀴 아치 가림(몸통 아래 조금)
    fill(x + 8, y + 50, 6, 4, 'yoru', 1)


def hero(x, foot):
    """32x48 서 있는 주인공(정면). 머리 12px, 어두운 머리카락, 재킷 파랑(sora), 바지 kon, 신발 sumi."""
    top = foot - 48
    ellipse(x + 16, foot + 1, 12, 3, 'hodo', 1)        # 발밑 그림자
    fill(x + 20, foot, 14, 2, 'hodo', 1)
    # 다리·신발
    fill(x + 9, top + 32, 6, 12, 'kon', 2); fill(x + 17, top + 32, 6, 12, 'kon', 2)
    fill(x + 9, top + 32, 2, 12, 'kon', 3); fill(x + 17, top + 32, 2, 12, 'kon', 3)
    fill(x + 21, top + 32, 2, 12, 'kon', 1)
    fill(x + 8, top + 44, 8, 4, 'sumi', 1); fill(x + 16, top + 44, 8, 4, 'sumi', 1)
    fill(x + 8, top + 44, 8, 1, 'sumi', 2); fill(x + 16, top + 44, 8, 1, 'sumi', 2)
    # 몸통
    fill(x + 7, top + 18, 18, 16, 'sora', 2)
    fill(x + 7, top + 18, 3, 16, 'sora', 3); fill(x + 7, top + 18, 18, 2, 'sora', 3)
    fill(x + 22, top + 18, 3, 16, 'sora', 1); fill(x + 7, top + 32, 18, 2, 'sora', 1)
    fill(x + 15, top + 20, 2, 12, 'sora', 1)          # 지퍼
    fill(x + 13, top + 18, 6, 3, 'shiro', 3)          # 안에 받친 셔츠
    # 팔
    fill(x + 3, top + 19, 4, 13, 'sora', 3); fill(x + 3, top + 19, 1, 13, 'sora', 4); fill(x + 3, top + 32, 4, 3, 'yuka', 3)
    fill(x + 25, top + 19, 4, 13, 'sora', 1); fill(x + 25, top + 32, 4, 3, 'yuka', 2)
    # 머리
    ellipse(x + 16, top + 9, 8, 9, 'yuka', 3)
    fill(x + 10, top + 8, 12, 7, 'yuka', 3)
    fill(x + 10, top + 8, 2, 7, 'yuka', 4); fill(x + 20, top + 8, 2, 7, 'yuka', 2)
    fill(x + 12, top + 14, 8, 3, 'yuka', 2)
    # 머리카락
    fill(x + 8, top + 1, 16, 6, 'yoru', 2); fill(x + 7, top + 3, 3, 9, 'yoru', 2); fill(x + 22, top + 3, 3, 9, 'yoru', 1)
    fill(x + 10, top, 10, 2, 'yoru', 3); fill(x + 11, top + 6, 10, 2, 'yoru', 2); fill(x + 10, top + 1, 4, 1, 'yoru', 4)
    # 눈·입
    fill(x + 12, top + 10, 2, 3, 'sumi', 1); fill(x + 18, top + 10, 2, 3, 'sumi', 1)
    px(x + 12, top + 10, 'shiro', 4); px(x + 18, top + 10, 'shiro', 4)
    fill(x + 15, top + 14, 2, 1, 'aka', 1)
    # 가방 끈
    fill(x + 10, top + 18, 2, 14, 'ki', 1)


# ================================================================ 조립
def build():
    ground()
    # 뒤 → 앞
    left_building()
    right_building()
    # 건물 바닥과 보도 사이 접지 그림자는 각 함수에서 처리
    manhole(480, 724)
    outlined(taxi, 150, 604)
    guardrail()
    outlined(vending, 316, 486, 'aka', 'A')
    outlined(tree, 536, 512)
    outlined(lamp, 612, 516)
    outlined(vending, 728, 486, 'sora', 'B')
    outlined(hero, 668, 520)
    outlined(tree, 856, 512)
    outlined(traffic_light, 990, 528)


# ================================================================ 내보내기
def compose_rgb():
    img = np.zeros((H, W, 3), dtype=np.uint8)
    img[:] = (255, 0, 255)
    for name, rid in RID.items():
        m = RP == rid
        if m.any():
            arr = np.array(RAMPS[name], dtype=np.uint8)
            img[m] = arr[TN[m]]
    return img


def emit_pxg(path):
    """@cell 32 픽셀 그리드. 램프 글자(@mat) + 단 글자(@tblock). 빈 칸 '.'"""
    letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    used = sorted(set(int(v) for v in np.unique(RP) if v >= 0))
    let = {rid: letters[i] for i, rid in enumerate(used)}
    T = '0123456789abcde'
    out = [f'@size {W} {H}', '@cell 32', '@palette palette.pal', '@layer main']
    for rid in used:
        out.append(f'@mat {let[rid]} {ORDER[rid]} 0')
    out.append('@mblock 0 0')
    for y in range(H):
        out.append(''.join('.' if RP[y, x] < 0 else let[int(RP[y, x])] for x in range(W)))
    out.append('@tblock 0 0')
    for y in range(H):
        out.append(''.join('.' if RP[y, x] < 0 else T[int(TN[y, x])] for x in range(W)))
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')


def main():
    os.makedirs(OUT, exist_ok=True)
    build()
    rgb = compose_rgb()
    im = Image.fromarray(rgb, 'RGB')
    im.save(os.path.join(OUT, 'scene.png'))
    im.resize((int(W * 1.5), int(H * 1.5)), Image.NEAREST).save(os.path.join(OUT, 'scene-x1.5.png'))
    emit_pxg(os.path.join(OUT, 'scene.pxg'))
    print('empty px:', int((RP < 0).sum()))


if __name__ == '__main__':
    main()
