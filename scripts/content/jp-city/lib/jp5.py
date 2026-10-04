"""일본 상가 거리 v1 — 평지붕 잡거빌딩 + 육교 + 횡단보도. 16px, modern3, 3/4(윗면+앞면). Actor1 비교."""
import os, sys, random, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jpenv
import numpy as np
from PIL import Image
from modern_style_bible_proof import K, Cv, hero
import post, tune, jp
from jp import chochin, noren, vsign, ac_unit, pole, wires, slide_door
from props import vending2 as vending, bike2 as bike
from jp3 import shade, hashira, ishidai, door_bay

W, H = 440, 430
ROAD0, ROAD1 = 314, 366
OX = 188                      # 육교 x
def fill(c, x, y, w, h, col): c.R(x, y, w, h, col)

def roof(c, x, y, w, T, seed=0, sign=None):
    """평지붕 윗면 T: 뒤 파라펫 안쪽 면 + 바닥(방수 이음) + 실외기/물탱크 + 앞 파라펫 코핑."""
    c.R(x, y, w, T, K('hodo', 3)); c.R(x, y, w, 5, K('hodo', 4)); c.HL(x, y, w, K('conc', 5)); c.HL(x, y + 5, w, K('hodo', 1))
    for j in range(y + 7, y + T - 6): c.HL(x + 1, j, w - 2, K('hodo', 3 if (j - y) % 7 else 2))
    for i in range(x + 8, x + w, 14): c.VL(i, y + 7, T - 13, K('hodo', 2))
    ac_unit(c, x + 6, y + 6) if w > 60 else None
    if w > 70: c.R(x + w - 26, y + 7, 12, 8, K('tairu', 2)); c.HL(x + w - 26, y + 7, 12, K('tairu', 4)); c.R(x + w - 14, y + 9, 2, 8, K('conc', 0))
    c.HL(x, y + T - 5, w, K('conc', 5)); c.R(x, y + T - 4, w, 2, K('conc', 4)); c.HL(x, y + T - 2, w, K('conc', 2)); c.HL(x, y + T - 1, w, K('hodo', 0))
    shade(c, x, y + T, w, 3, -1)

def billboard(c, x, base, w, h, col, txt_cols):
    """옥상 간판(다리 달린 판): 앞면 판 + 윗면 + 다리 + 흰 글자 블록."""
    c.R(x + 3, base - 6, 2, 6, K('tekko', 1)); c.R(x + w - 5, base - 6, 2, 6, K('tekko', 1))
    c.R(x, base - 6 - h, w, 2, K(col, 4)); c.R(x, base - 4 - h, w, h, K(col, 1)); c.VL(x, base - 4 - h, h, K(col, 3)); c.VL(x + w - 1, base - 4 - h, h, K(col, -1)); c.HL(x, base - 5, w, K(col, -2))
    xx = x + 4
    for k, n in enumerate((5, 3, 6, 4, 5, 3, 6)):
        if xx + n > x + w - 4: break
        c.R(xx, base - 2 - h + 3, n, h - 6, K(txt_cols[k % len(txt_cols)], 3)); c.HL(xx, base - 2 - h + 3, n, K(txt_cols[k % len(txt_cols)], 4)); xx += n + 2
    for k in range(w): c.P(x + 2 + k, base, K('hodo', 0))

def window_pair(c, x, y, w, lit, ac=False):
    for i in range(2):
        wx = x + i * (w // 2)
        c.R(wx + 2, y, w // 2 - 4, 14, K('ita', -3)); c.R(wx + 3, y + 1, w // 2 - 6, 12, K('mado', 1) if (lit >> i) & 1 else K('garasu', 1)); c.R(wx + 3, y + 1, w // 2 - 6, 3, K('mado', 0) if (lit >> i) & 1 else K('garasu', 0))
        c.VL(wx + w // 4, y + 1, 12, K('tekko', 1)); 
        for k in range(4): c.P(wx + 5 + k, y + 10 - k, K('garasu', 4))
        c.R(wx + 1, y + 14, w // 2 - 2, 2, K('shiro', 3)); c.HL(wx + 1, y + 16, w // 2 - 2, K('hodo', -1))
    if ac: ac_unit(c, x + w // 2 - 7, y + 17)

def zakkyo(Wd, floors, wall, awn, seed, sign=None, vcol=('aka', 'sora', 'kii'), shop='shutter', bb=None):
    head = 26 if bb else 6
    FH = 36; T = 26; G = 52
    Hh = head + T + floors * FH + G
    c = Cv(Wd, Hh)
    roof(c, 0, head, Wd, T)
    if bb: billboard(c, 6, head + 8, Wd - 24, 14, bb[0], bb[1])
    y = head + T
    for f in range(floors):
        fy = y + f * FH
        c.R(0, fy, Wd, FH, K(wall, 1))
        if wall in ('hodo', 'conc'):
            for j in range(fy + 4, fy + FH, 6): c.HL(0, j, Wd, K(wall, 0))
        c.VL(0, fy, FH, K(wall, 2)); c.VL(Wd - 1, fy, FH, K(wall, -1))
        shade(c, 0, fy, Wd, 4, -1, (wall, 'hodo', 'conc', 'kinari', 'shiro'))
        c.R(0, fy + FH - 4, Wd, 4, K('conc', 4)); c.HL(0, fy + FH - 4, Wd, K('shiro', 4)); c.HL(0, fy + FH - 1, Wd, K('conc', 0))   # 층 슬래브
        nwin = max(1, (Wd - 26) // 36)
        for k in range(nwin):
            window_pair(c, 6 + k * 36, fy + 9, 32, (seed + f * 3 + k) % 4, ac=((seed + f + k) % 3 == 0))
    # 세로 간판 줄 (오른쪽 끝, 층마다)
    vx = Wd - 14
    for f in range(floors):
        fy = y + f * FH
        col = vcol[(f + seed) % len(vcol)]
        c.R(vx + 1, fy + 5, 11, FH - 12, K(col, 1)); c.VL(vx + 1, fy + 5, FH - 12, K(col, 3)); c.VL(vx + 11, fy + 5, FH - 12, K(col, -1)); c.R(vx + 2, fy + 3, 11, 2, K(col, 4)); c.HL(vx + 1, fy + FH - 7, 11, K(col, -2))
        for j in range(fy + 8, fy + FH - 10, 6): c.R(vx + 4, j, 6, 3, K('shiro', 3)); c.HL(vx + 4, j, 6, K('shiro', 4))
        for j in range(FH - 6): c.P(vx + 12, fy + 6 + j, K('hodo', -1)) if j % 2 == 0 else None
    # 1층
    gy = y + floors * FH
    c.R(0, gy, Wd, G, K('hodo', 2))
    for j in range(gy + 3, gy + G, 5): c.HL(0, j, Wd, K('hodo', 1))
    shade(c, 0, gy, Wd, 5, -1, ('hodo',)); shade(c, 0, gy, Wd, 2, -1, ('hodo',))
    # 어닝(텐트): 윗면 + 앞 + 물결
    ay = gy + 6
    for i in range(2, Wd - 2):
        s = ((i - 2) // 6) % 2
        c.R(i, ay, 1, 4, K(awn, 4 if s else 3)); c.R(i, ay + 4, 1, 5, K('shiro', 3) if s else K(awn, 2))
        c.P(i, ay + 9, K('shiro', 1) if s else K(awn, 0))
        if ((i - 2) % 6) in (2, 3): c.P(i, ay + 10, K('hodo', -2))
    shade(c, 2, ay + 11, Wd - 4, 3, -2, ('hodo',))
    sy = gy + 22; sh = G - 22 - 6
    if shop == 'shutter':
        c.R(5, sy, Wd - 38, sh, K('tekko', -2))
        for j in range(sy + 1, sy + sh, 3): c.HL(6, j, Wd - 40, K('tekko', 2)); c.HL(6, j + 1, Wd - 40, K('tekko', 1))
    else:
        c.R(5, sy - 2, Wd - 38, sh + 2, K('tekko', -2)); c.R(7, sy, Wd - 42, sh, K('mado', 1)); c.R(7, sy, Wd - 42, 3, K('mado', 0))
        for i in range(12, Wd - 38, 14): c.R(i, sy + 10, 8, 2, K('ita', 1)); c.VL(i + 3, sy + 12, sh - 12, K('ita', -2)); c.R(i + 1, sy + 7, 3, 3, K('aka', 2)); c.R(i + 5, sy + 7, 3, 3, K('kii', 2))
        for i in range(20, Wd - 38, 18): c.VL(i, sy, sh, K('tekko', 1))
        for k in range(8): c.P(10 + k, sy + sh - 3 - k, K('mado', 4))
    # 입구문(칸 격자)
    door_bay(c, Wd - 30, 24, gy + G - 3, 30, None)
    c.R(0, gy + G - 6, Wd, 6, K('hodo', 3)); c.HL(0, gy + G - 6, Wd, K('hodo', 5)); c.HL(0, gy + G - 1, Wd, K('hodo', -1))
    return c

def put(sc, cv, x, yb, thr=True):
    a = tune.ink(post.contour(cv.a), edge=3, inner=2, soft=1)
    y = yb - cv.h
    for j in range(a.shape[0]):
        for i in range(a.shape[1]):
            if a[j, i, 3] and 0 <= x + i < sc.w and 0 <= y + j < sc.h: sc.a[y + j, x + i] = a[j, i]
    # 바닥 그림자(앞 3행 + 오른쪽 5열)
    for j in range(3):
        for i in range(cv.w + 5):
            px, py = x + i, yb + j
            if 0 <= px < sc.w and py < sc.h and sc.a[py, px, 3]: sc.a[py, px, :3] = post.step(sc.a[py, px], -2)
    return y

def road(sc):
    for y in range(ROAD0, ROAD1):
        for x in range(sc.w): sc.P(x, y, K('yoru', 1) if (x * 7 + y * 13) % 17 else K('yoru', 2))
    for x in range(sc.w):
        sc.P(x, ROAD0, K('hodo', 5)); sc.P(x, ROAD0 + 1, K('hodo', 3)); sc.P(x, ROAD0 + 2, K('yoru', -1))
        sc.P(x, ROAD1 - 1, K('hodo', 5)); sc.P(x, ROAD1 - 2, K('hodo', 3)); sc.P(x, ROAD1 - 3, K('yoru', -1))
    for x in range(6, sc.w, 36):                                   # 중앙 점선(노랑이 아니라 백색: 일본 일반도로)
        sc.R(x, (ROAD0 + ROAD1) // 2 - 1, 20, 2, K('shiro', 3))
    for x in range(OX - 14, OX + 46, 10):                          # 횡단보도
        sc.R(x, ROAD0 + 6, 5, ROAD1 - ROAD0 - 12, K('shiro', 3)); sc.VL(x, ROAD0 + 6, ROAD1 - ROAD0 - 12, K('shiro', 4)); sc.VL(x + 4, ROAD0 + 6, ROAD1 - ROAD0 - 12, K('shiro', 1))
    for x in range(OX - 22, OX - 17): pass
    sc.R(OX - 22, ROAD0 + 6, 2, ROAD1 - ROAD0 - 12, K('kii', 2))   # 정지선 옆 노랑 띠

def sidewalk(sc, y0, y1, tone=1):
    for y in range(y0, y1):
        for x in range(sc.w):
            sc.P(x, y, K('hodo', tone + 1))
            if x % 16 == 0 or (y - y0) % 16 == 0: sc.P(x, y, K('hodo', tone - 1))
            elif x % 16 == 1 or (y - y0) % 16 == 1: sc.P(x, y, K('hodo', tone + 2))
    for x in range(sc.w):                                          # 점자블록 띠
        if x % 4 < 2: sc.P(x, y0 + 8, K('kii', 2)); sc.P(x, y0 + 9, K('kii', 1))
        else: sc.P(x, y0 + 8, K('kii', 3)); sc.P(x, y0 + 9, K('kii', 2))

def guardrail(sc, x0, x1, y):
    for x in range(x0, x1):
        sc.P(x, y - 8, K('shiro', 4)); sc.P(x, y - 7, K('shiro', 3)); sc.P(x, y - 6, K('tekko', 1))
        sc.P(x, y - 3, K('shiro', 3)); sc.P(x, y - 2, K('tekko', 1))
    for x in range(x0 + 2, x1, 24):
        sc.R(x, y - 9, 3, 10, K('shiro', 3)); sc.VL(x, y - 9, 10, K('shiro', 5)); sc.VL(x + 2, y - 9, 10, K('tekko', 0)); sc.R(x - 1, y - 11, 5, 2, K('shiro', 4))
        sc.R(x + 4, y + 1, 4, 1, K('hodo', -1)); sc.P(x + 1, y - 5, K('aka', 3))
    for x in range(x0, x1): sc.P(x + 2, y + 1, K('hodo', 0)) if x % 2 == 0 else None

def signal(sc, x, base):
    sc.R(x, base - 56, 3, 56, K('tekko', 2)); sc.VL(x, base - 56, 56, K('tekko', 4)); sc.VL(x + 2, base - 56, 56, K('tekko', 0))
    sc.R(x - 14, base - 58, 18, 3, K('tekko', 2)); sc.HL(x - 14, base - 58, 18, K('tekko', 4))
    sc.R(x - 14, base - 55, 16, 8, K('tekko', -2)); sc.R(x - 12, base - 53, 4, 4, K('aka', 3)); sc.R(x - 7, base - 53, 4, 4, K('kii', 1)); sc.R(x - 2, base - 53, 4, 4, K('midori', 4))
    sc.R(x - 14, base - 46, 14, 2, K('tekko', 1)); sc.R(x + 4, base - 40, 8, 10, K('tekko', -2)); sc.R(x + 5, base - 39, 6, 4, K('midori', 3)); sc.R(x + 5, base - 34, 6, 3, K('aka', 2))
    sc.R(x - 1, base - 3, 5, 3, K('hodo', 5)); sc.HL(x - 1, base, 7, K('hodo', -1))

def roadsign(sc, x, base):
    sc.R(x, base - 48, 2, 48, K('tekko', 3)); sc.VL(x, base - 48, 48, K('tekko', 5))
    for j in range(-9, 10):
        for i in range(-9, 10):
            d = i * i + j * j
            if d <= 81: sc.P(x + 1 + i, base - 56 + j, K('sora', 2) if d > 49 else K('sora', 1))
    sc.R(x - 4, base - 58, 10, 3, K('shiro', 3)); sc.R(x - 2, base - 54, 6, 3, K('shiro', 3)); sc.R(x - 4, base - 51, 10, 3, K('aka', 2))
    sc.HL(x - 1, base, 4, K('hodo', -1))

def overpass(sc):
    """육교(歩道橋): 도로를 가로지르는 데크. 3/4: 데크 윗면(걷는 면) 얇게 + 앞면 보(두꺼움) + 난간 + 교각 2개 + 양끝 계단(앞으로 내려옴)."""
    x0 = 150; x1 = 330; deckY = ROAD0 - 76          # 데크 앞면 상단 y
    # 데크 윗면(뒤쪽 보이는 면) — 건물 앞 공중
    for y in range(deckY - 14, deckY):
        for x in range(x0, x1): sc.P(x, y, K('hodo', 4 if y > deckY - 3 else 3) if (x // 4 + y // 4) % 2 == 0 else K('hodo', 3))
    # 뒤 난간(윗면 쪽)
    sc.R(x0, deckY - 22, x1 - x0, 3, K('tekko', 3)); sc.HL(x0, deckY - 22, x1 - x0, K('midori', 3))
    for x in range(x0 + 2, x1, 8): sc.R(x, deckY - 19, 2, 5, K('tekko', 1))
    # 앞면 보
    sc.R(x0, deckY, x1 - x0, 16, K('hodo', 2)); sc.HL(x0, deckY, x1 - x0, K('shiro', 4)); sc.HL(x0, deckY + 1, x1 - x0, K('hodo', 5))
    sc.R(x0, deckY + 11, x1 - x0, 5, K('hodo', 1)); sc.HL(x0, deckY + 15, x1 - x0, K('hodo', -1))
    for x in range(x0 + 12, x1, 22): sc.VL(x, deckY + 2, 9, K('hodo', 1))
    # 앞 난간(그린 철제 난간 + 상판 + 격자)
    sc.R(x0 - 2, deckY - 6, x1 - x0 + 4, 3, K('midori', 3)); sc.HL(x0 - 2, deckY - 6, x1 - x0 + 4, K('midori', 3)); sc.HL(x0 - 2, deckY - 4, x1 - x0 + 4, K('midori', 1))
    for x in range(x0, x1, 4): sc.VL(x, deckY - 3, 3, K('midori', 2))
    # 교각 2개
    for px in (x0 + 24, x1 - 31):
        py0 = deckY + 16; py1 = ROAD1 + 12
        sc.R(px, py0, 7, py1 - py0, K('hodo', 3)); sc.VL(px, py0, py1 - py0, K('hodo', 5)); sc.VL(px + 6, py0, py1 - py0, K('hodo', 0))
        sc.R(px - 1, py1 - 2, 9, 3, K('hodo', 4)); sc.HL(px - 1, py1 + 1, 9, K('hodo', -1))
        for k in range(10): sc.HL(px + 7 + k // 2, py1 + 1 + k // 3, 1, K('yoru', -1))
        for j in range(py1 + 1, py1 + 4): sc.HL(px + 1, j, 14, K('yoru', -1)) if False else None
    # 데크 아래 그림자(도로에 눕는 띠)
    for y in range(ROAD0 + 4, ROAD0 + 18):
        for x in range(x0 + 6, x1 - 6):
            if sc.a[y, x, 3]: sc.a[y, x, :3] = post.step(sc.a[y, x], -1)
    # 양끝 계단: 오른쪽 끝은 앞(남쪽)으로 내려오는 직선 계단
    sx = x1 - 22; sy0 = deckY + 16; sy1 = ROAD1 + 44; w = 24
    for y in range(sy0, sy1):
        r = (y - sy0) % 6
        for xx in range(w):
            edge = xx < 3 or xx >= w - 3
            sc.P(sx + xx, y, K('midori', 1) if edge else (K('shiro', 3) if r < 3 else K('hodo', 1)))
        if r == 0:
            for xx in range(3, w - 3): sc.P(sx + xx, y, K('shiro', 5))
        if r == 3:
            for xx in range(3, w - 3): sc.P(sx + xx, y, K('hodo', 0))
    for xx in range(w + 6): sc.P(sx + 2 + xx, sy1, K('hodo', -1)); sc.P(sx + 3 + xx, sy1 + 1, K('hodo', -1)) if xx % 2 == 0 else None
    sc.R(sx - 1, sy0, 3, sy1 - sy0, K('midori', 2)); sc.R(sx + w - 2, sy0, 3, sy1 - sy0, K('midori', 0))
    # 왼쪽 끝 계단(대칭, 뒤로 올라가는 모습 대신 앞 면): 같은 형태
    sx2 = x0 - 2; 
    for y in range(sy0, sy1):
        r = (y - sy0) % 6
        for xx in range(w):
            edge = xx < 3 or xx >= w - 3
            sc.P(sx2 + xx, y, K('midori', 1) if edge else (K('shiro', 3) if r < 3 else K('hodo', 1)))
        if r == 0:
            for xx in range(3, w - 3): sc.P(sx2 + xx, y, K('shiro', 5))
        if r == 3:
            for xx in range(3, w - 3): sc.P(sx2 + xx, y, K('hodo', 0))
    for xx in range(w + 6): sc.P(sx2 + 2 + xx, sy1, K('hodo', -1))
    sc.R(sx2 - 1, sy0, 3, sy1 - sy0, K('midori', 2)); sc.R(sx2 + w - 2, sy0, 3, sy1 - sy0, K('midori', 0))

def build():
    sc = Cv(W, H)
    for y in range(0, 140):
        for x in range(W): sc.P(x, y, K('garasu', 5 - y // 30))
    for x0, w0, h0 in ((0, 50, 70), (60, 34, 90), (170, 60, 60), (260, 44, 84), (330, 58, 66), (396, 44, 78)):                # 먼 건물 실루엣
        sc.R(x0, 150 - h0 + 10, w0, h0, K('tairu', 3)); sc.R(x0, 150 - h0 + 10, w0, 2, K('tairu', 4))
        for j in range(150 - h0 + 18, 160, 9):
            for i in range(x0 + 4, x0 + w0 - 4, 8): sc.R(i, j, 3, 4, K('tairu', 1))
    sc.R(0, 160, W, ROAD0 - 160, K('hodo', 1))
    bl = [(zakkyo(84, 4, 'kinari', 'aka', 1, vcol=('aka', 'sora', 'kii'), bb=('aka', ('shiro', 'kii'))), 4),
          (zakkyo(64, 3, 'hodo', 'sora', 2, vcol=('sora', 'midori', 'aka'), shop='glass'), 92),
          (zakkyo(88, 5, 'shiro', 'midori', 3, vcol=('kii', 'aka', 'sora'), bb=('sora', ('shiro', 'kii', 'aka'))), 246)]
    ground = ROAD0 - 18
    sidewalk(sc, ground - 2, ROAD0, 1)
    # 오른쪽 뒤: 작은 가게 + 마지막 건물
    bl.append((zakkyo(72, 2, 'kinari', 'daidai', 4, vcol=('midori', 'aka'), shop='glass'), 340))
    bl.append((zakkyo(88, 3, 'conc', 'kii', 5, vcol=('daidai', 'sora', 'midori'), shop='glass'), 156))
    for cv, x in bl: put(sc, cv, x, ground)
    road(sc)
    sidewalk(sc, ROAD1, H, 1)
    sc.R(0, ROAD0 - 14, 0, 0, K('hodo', 1))
    sidewalk_n = None
    # 북쪽 인도(건물 앞) 점자블록은 건물 앞 짧게
    guardrail(sc, 0, W, ROAD0 - 1)
    guardrail(sc, 0, OX - 14, ROAD1 + 24); guardrail(sc, OX + 54, W, ROAD1 + 24)
    vending(sc, 98, ground + 12, 'aka'); vending(sc, 272, ground + 12, 'sora'); vending(sc, 316, ground + 12, 'midori'); bike(sc, 232, ground + 13); bike(sc, 18, ground + 13, 'midori'); bike(sc, 352, ground + 13, 'sora')
    signal(sc, 118, ROAD1 + 22); roadsign(sc, OX + 92, ROAD1 + 22); pole(sc, 420, ROAD1 + 24, top=40)
    wires(sc, [-10, 420, 450], 40, sag=6, n=3); wires(sc, [-10, 420], 50, sag=5, n=2, col=K('tekko', 0))
    return sc

if __name__ == '__main__':
    os.makedirs('out', exist_ok=True)
    sc = build(); im = sc.img(); im.save('out/jp5.png')
