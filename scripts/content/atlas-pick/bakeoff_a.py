#!/usr/bin/env python3
"""품질 비교전 A조 — 16px 손도트 정밀. 오사카풍 길모퉁이 한 장면(512×384 px = 32×24칸), modern3 램프만.
  python3 scripts/content/atlas-pick/bakeoff_a.py     # tiledata/atlas-pick/bakeoff/a-16px/{scene,scene-x3}.png + scene.pxg + parts/*.pxg
규칙(modern-style-bible.md): 반투명·보간·난수·그라데이션 없음. 그림자 = 같은 램프의 낮은 단(dim). 빛은 왼쪽 위.
글자 격자(rows)로 한 화소씩 놓은 조각은 STAMPS 에 이름을 붙여 parts/*.pxg 로도 내보낸다."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from modern3_check import load_pal
from pxg_emit import emit
from common import BASE

RAMPS = load_pal()
OUT = os.path.join(BASE, 'bakeoff', 'a-16px')
W, H = 512, 384
OWNER = {}
for _n, _r in RAMPS.items():
    for _i, _c in enumerate(_r): OWNER.setdefault(_c, (_n, _i))

def K(name, t):
    r = RAMPS[name]; mid = len(r) // 2
    return r[max(0, min(len(r) - 1, mid + t))]
def rgb(h): return ((h >> 16) & 255, (h >> 8) & 255, h & 255)

class Cv:
    def __init__(s, w, h):
        s.w, s.h = w, h; s.a = np.zeros((h, w, 4), np.uint8)
    def P(s, x, y, c):
        if 0 <= x < s.w and 0 <= y < s.h and c is not None: s.a[y, x] = (*rgb(c), 255)
    def R(s, x, y, w, h, c):
        for j in range(h):
            for i in range(w): s.P(x + i, y + j, c)
    def HL(s, x, y, w, c): s.R(x, y, w, 1, c)
    def VL(s, x, y, h, c): s.R(x, y, 1, h, c)
    def get(s, x, y):
        p = s.a[y, x]; return (int(p[0]) << 16) | (int(p[1]) << 8) | int(p[2])
    def dim(s, x, y, w, h, n):
        """영역 안 모든 화소를 자기 램프의 n 단 아래로(그림자 굽기). 램프 밖 색은 그대로."""
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.w and 0 <= j < s.h and s.a[j, i, 3]:
                    o = OWNER.get(s.get(i, j))
                    if o: s.P(i, j, RAMPS[o[0]][max(0, o[1] - n)])
    def lift(s, x, y, w, h, n):
        for j in range(y, y + h):
            for i in range(x, x + w):
                if 0 <= i < s.w and 0 <= j < s.h and s.a[j, i, 3]:
                    o = OWNER.get(s.get(i, j))
                    if o: s.P(i, j, RAMPS[o[0]][min(len(RAMPS[o[0]]) - 1, o[1] + n)])
    def save(s, p):
        os.makedirs(os.path.dirname(p), exist_ok=True); Image.fromarray(s.a, 'RGBA').save(p)
    def img(s): return Image.fromarray(s.a, 'RGBA')


# ───────────────────────── 글자 격자 조각 ─────────────────────────
PARTS = {}          # 이름 → (x, y, w, h) : scene 에서 잘라 parts/*.pxg 로 내보낼 영역

def rows_put(c, x, y, rows, leg):
    """글자 격자를 한 화소씩 놓는다. leg: 글자 → (램프, 단). '.' 은 건너뜀."""
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '.' or ch == ' ': continue
            r, t = leg[ch]; c.P(x + i, y + j, K(r, t))

# 가나 글자(손 도트, 7×7 안팎, 획 1px)
GLYPH = {
 'ミ': ['.####...', '....##..', '........', '.####...', '....##..', '........', '.#####..'],
 'ニ': ['.#####..', '........', '........', '........', '........', '........', '#######.'],
 'マ': ['#######.', '.....##.', '....##..', '..####..', '.##.##..', '....##..', '...##...'],
 'ー': ['........', '........', '........', '#######.', '........', '........', '........'],
 'ト': ['.##.....', '.##.....', '.###....', '.##.##..', '.##..##.', '.##.....', '.##.....'],
 'ラ': ['.#####.', '.......', '#######', '.....#.', '....#..', '...#...', '.##....'],
 'メ': ['.....#.', '.....#.', '.#..#..', '..###..', '...#...', '..#.#..', '.#...#.'],
 'ン': ['.#.....', '..#....', '.......', '......#', '.....#.', '....#..', '###....'],
 'め': ['...#....', '.#.#.##.', '#..##..#', '#.#.#..#', '#.#.#..#', '#..#..#.', '.##.###.', '........'],
 'し': ['.#.....', '.#.....', '.#.....', '.#.....', '.#.....', '.#....#', '.##..##.', '..####..'],
}
def glyph(c, x, y, ch, col, sh=None):
    g = GLYPH[ch]
    if sh is not None:
        for j, row in enumerate(g):
            for i, v in enumerate(row):
                if v == '#': c.P(x + i + 1, y + j + 1, sh)
    for j, row in enumerate(g):
        for i, v in enumerate(row):
            if v == '#': c.P(x + i, y + j, col)

# ───────────────────────── 재료 ─────────────────────────
def tile_wall(c, x, y, w, h, mat, var, tw=16, th=8):
    """타일 외벽: 타일마다 단이 다르고(var 손글자 순환), 줄눈 -1, 각 타일 윗줄에 +1 빛띠 반 칸."""
    c.R(x, y, w, h, K(mat, 0))
    for jr, j in enumerate(range(0, h, th)):
        off = (tw // 2) if jr % 2 else 0
        for ti, i0 in enumerate(range(-off, w, tw)):
            v = var[(jr * 3 + ti * 2) % len(var)]
            t = {'+': 1, '-': -1, '.': 0}[v]
            for jj in range(1, th):
                for ii in range(1, tw):
                    if 0 <= i0 + ii < w and j + jj < h: c.P(x + i0 + ii, y + j + jj, K(mat, t))
            if 0 <= i0 + 1 < w and j + 1 < h:               # 타일 왼쪽 위 모서리 반짝 1줄
                for ii in range(1, 6):
                    if i0 + ii < w: c.P(x + i0 + ii, y + j + 1, K(mat, t + 1))
            if 0 <= i0 < w: c.VL(x + i0, y + j, min(th, h - j), K(mat, -1))
        c.HL(x, y + j, w, K(mat, -1))
    c.VL(x, y, h, K(mat, 1))

def panel_wall(c, x, y, w, h, mat, var, pw=32):
    """콘크리트 패널: 이음 -1 + 오른쪽 +1, 패널마다 단 다름."""
    c.R(x, y, w, h, K(mat, 0))
    for pi, i0 in enumerate(range(0, w, pw)):
        t = {'+': 1, '-': -1, '.': 0}[var[pi % len(var)]]
        if t: c.R(x + i0 + 2, y, min(pw, w - i0) - 2, h, K(mat, t))
        c.VL(x + i0, y, h, K(mat, -1))
        if i0 + 1 < w: c.VL(x + i0 + 1, y, h, K(mat, 1))
    c.VL(x, y, h, K(mat, 1))

def streak(c, x, y, h, w=2, n=1):
    """빗물 때: 폭 w 줄을 n 단 낮춤, 끝은 반 폭."""
    c.dim(x, y, w, h, n); c.dim(x + (w // 2 if w > 1 else 0), y + h, max(1, w // 2), 2, n)

def slab(c, x, y, w, mat, shadow=True):
    c.HL(x, y, w, K(mat, 2)); c.R(x, y + 1, w, 2, K(mat, 1)); c.HL(x, y + 3, w, K(mat, -2)); c.VL(x, y, 4, K(mat, 3))
    if shadow:
        c.dim(x, y + 4, w, 2, 2); c.dim(x, y + 6, w, 1, 1)

def pillar(c, x, y, h, mat='conc'):
    """튀어나온 기둥: 앞 4px(+2,+1,+1,0) + 옆면 2px(-2). 위 끝 +3 1px."""
    for i, t in enumerate((2, 1, 1, 0)): c.VL(x + i, y, h, K(mat, t))
    c.VL(x + 4, y, h, K(mat, -2)); c.VL(x + 5, y, h, K(mat, -3))
    c.HL(x, y, 4, K(mat, 3))

# ───────────────────────── 창 ─────────────────────────
def sill(c, x, y, w=16):
    """창턱: 윗면 +3 · 앞 +1 · 아랫모서리 -2, 좌우 1px 튀어나옴 + 벽 그림자 2px(-2)/1px(-1)."""
    c.HL(x - 1, y, w + 2, K('conc', 3)); c.HL(x - 1, y + 1, w + 2, K('conc', 1)); c.HL(x - 1, y + 2, w + 2, K('conc', -2))
    c.dim(x, y + 3, w, 2, 2); c.dim(x, y + 5, w, 1, 1)

def window(c, x, y, kind='sky', ac=False):
    """창 16×14 + 턱. kind: sky(하늘 반사) · curtain(커튼) · lit(불 켜짐) · blind(블라인드) · plant(화분)."""
    c.R(x, y, 16, 14, K('tekko', -2))
    tones = [-3, -2, -1, 0, 0, 0, 0, -1, -1, -2, -2, -2]                # 유리 12줄(위 2줄 그늘)
    for r in range(12):
        for i in range(14):
            t = tones[r]
            if i == 0: t -= 1
            c.P(x + 1 + i, y + 1 + r, K('garasu', max(-3, t)))
    if kind == 'sky':
        for r in range(2, 10):
            for base in (1, 8):
                cc = base + 5 - (r - 2)
                for k, t in enumerate((3, 2)):
                    if base <= cc + k < base + 6 + (0 if base == 1 else 0) and 1 <= cc + k <= 14: c.P(x + cc + k, y + 1 + r, K('garasu', t))
    elif kind == 'curtain':
        for r in range(2, 12):
            for i in range(1, 7):
                c.P(x + i, y + 1 + r, K('kinari', 1 if (i % 3) else 2 if i == 1 else -1))
            for i in range(9, 14):
                c.P(x + i, y + 1 + r, K('kinari', 0 if (i % 3) else -1))
        c.R(x + 7, y + 3, 2, 10, K('garasu', -2))
    elif kind == 'lit':
        for r in range(2, 12):
            for i in range(1, 15):
                if i in (7, 8): continue
                c.P(x + i, y + 1 + r, K('mado', 1 if r < 8 else 0))
        c.R(x + 3, y + 8, 3, 4, K('soil', -1)); c.R(x + 10, y + 6, 3, 6, K('pinku', -1)); c.HL(x + 10, y + 6, 3, K('pinku', 0))
    elif kind == 'blind':
        for r in range(2, 12):
            for i in range(1, 15):
                if i in (7, 8): continue
                c.P(x + i, y + 1 + r, K('kinari', -1 if r % 2 else 0))
    elif kind == 'plant':
        c.R(x + 3, y + 9, 4, 4, K('daidai', -1)); c.HL(x + 3, y + 9, 4, K('daidai', 0))
        for (dx, dy) in ((3, 6), (4, 5), (5, 4), (6, 5), (4, 7), (6, 7), (2, 7), (5, 6)): c.P(x + dx, y + dy, K('midori', 1))
        c.P(x + 5, y + 5, K('midori', 2)); c.P(x + 4, y + 6, K('midori', 0))
    c.VL(x + 7, y + 1, 12, K('tekko', 1)); c.VL(x + 8, y + 1, 12, K('tekko', -1))       # 미닫이 세로대
    c.HL(x, y, 16, K('tekko', 0)); c.VL(x, y, 14, K('tekko', 1))
    sill(c, x, y + 14)
    if ac:
        c.R(x + 3, y + 8, 10, 6, K('tekko', 1)); c.HL(x + 3, y + 8, 10, K('tekko', 3)); c.R(x + 5, y + 9, 5, 4, K('tekko', -1)); c.P(x + 7, y + 10, K('tekko', -2)); c.HL(x + 3, y + 13, 10, K('tekko', -2))

def balcony(c, x, y, wall_mat='renga', laundry=False, ac=False):
    """발코니 폭 24, 몸통 높이 28(슬래브 밑 y 부터). 미닫이 유리 · 난간(가로대 + 세로살) · 아래 판넬 · 오른쪽 옆면."""
    # 미닫이 유리
    c.R(x, y + 4, 24, 20, K('tekko', -2))
    for r in range(18):
        for i in range(22):
            t = [-3, -2, -1, -1, 0, 0, 0, 0, 0, -1, -1, -1, -2, -2, -2, -2, -3, -3][r]
            c.P(x + 1 + i, y + 5 + r, K('garasu', t - (1 if i == 0 else 0)))
    for r in range(2, 9):
        for base in (1, 13):
            cc = base + 6 - (r - 2)
            for k, t in enumerate((3, 2)):
                if base <= cc + k < base + 8: c.P(x + cc + k, y + 5 + r, K('garasu', t))
    c.VL(x + 11, y + 5, 18, K('tekko', 1)); c.VL(x + 12, y + 5, 18, K('tekko', -1))
    # 빨래(난간 뒤)
    if laundry:
        c.HL(x + 1, y + 8, 22, K('tekko', 2))
        for (dx, col, w) in ((2, ('shiro', 0), 4), (7, ('pinku', 1), 4), (13, ('sora', 1), 5), (19, ('shiro', -1), 3)):
            c.R(x + dx, y + 9, w, 8, K(*col)); c.VL(x + dx + w - 1, y + 9, 8, K(col[0], col[1] - 1)); c.HL(x + dx, y + 9, w, K(col[0], col[1] + 1))
    # 난간
    c.HL(x - 1, y + 14, 26, K('tekko', 3)); c.HL(x - 1, y + 15, 26, K('tekko', 1))
    for i in range(0, 24, 3): c.VL(x + i, y + 16, 5, K('tekko', 0)); c.VL(x + i + 1, y + 16, 5, K('tekko', -2))
    # 아래 판넬 + 바닥 슬래브 앞 모서리
    c.R(x - 1, y + 21, 26, 5, K('conc', 0)); c.HL(x - 1, y + 21, 26, K('conc', 2)); c.HL(x - 1, y + 25, 26, K('conc', -2)); c.VL(x - 1, y + 21, 5, K('conc', 1))
    c.R(x + 25, y + 14, 3, 12, K('conc', -2)); c.VL(x + 27, y + 14, 12, K('conc', -3))     # 오른쪽 옆면
    if ac:
        c.R(x + 15, y + 15, 8, 6, K('tekko', 1)); c.HL(x + 15, y + 15, 8, K('tekko', 3)); c.R(x + 17, y + 16, 4, 4, K('tekko', -1)); c.HL(x + 15, y + 20, 8, K('tekko', -2))
    c.dim(x - 1, y + 26, 28, 2, 2)

# 증명 파일의 사람·차·자판기·신호·나무는 가져다 쓰되(호출이 c.P/R/HL/VL 뿐), 라운드마다 여기서 덮어쓴다.
import modern_style_bible_proof as _mp
hero_p, car_p, vending_p, signal_p, tree_p = _mp.hero, _mp.car, _mp.vending, _mp.signal, _mp.tree

# ───────────────────────── 배경 ─────────────────────────
def sky(c):
    c.R(0, 0, W, 60, K('sora', 2))
    for (x, y, w) in ((60, 4, 22), (140, 10, 18), (300, 3, 26), (420, 6, 20)):
        c.R(x + 2, y, w - 4, 1, K('shiro', 2)); c.R(x, y + 1, w, 3, K('shiro', 2)); c.R(x + 2, y + 4, w - 6, 1, K('shiro', 0))
        c.R(x + 4, y + 2, 4, 1, K('shiro', 1))
    # 뒤쪽 저층 스카이라인(낮은 대비 · 창점은 손 좌표)
    for (x, w, top, m) in ((244, 40, 14, 'tairu'), (284, 30, 20, 'tekko'), (314, 44, 10, 'tairu'), (358, 26, 22, 'tekko'), (384, 50, 6, 'tairu'),
                            (434, 34, 18, 'tekko'), (468, 44, 12, 'tairu')):
        c.R(x, top, w, 32 - top, K(m, -1)); c.HL(x, top, w, K(m, 1)); c.VL(x, top, 32 - top, K(m, 0))
        for wy in range(top + 4, 28, 6):
            for wx in range(x + 4, x + w - 3, 8): c.R(wx, wy, 3, 3, K('garasu', -1 if (wx + wy) % 3 else 1))
    c.R(0, 20, 16, 200, K('tairu', -2)); c.VL(15, 20, 190, K('tairu', -3))                  # 왼쪽 골목 안쪽
    c.R(3, 34, 4, 6, K('mado', -1)); c.HL(3, 34, 4, K('mado', 1)); c.VL(9, 60, 130, K('tekko', -1)); c.VL(10, 60, 130, K('tekko', -3))

def sidewalk(c):
    base = ((204, 16 + 0),)
    pat = '.+.-+..-.+-..+.-'         # 손으로 정한 순환(블록 단)
    for r in range(0, 5):
        y = 204 + 16 * r - (8 if r == 0 else 0)
        h = 16 if r else 8
        yy = 204 + 16 * r
        for k in range(-1, 33):
            x = k * 16 + (8 if r % 2 else 0)
            v = pat[(r * 5 + k * 3) % 16]; t = {'+': 1, '-': -1, '.': 0}[v]
            c.R(x, yy, 16, 16, K('hodo', t))
            c.HL(x, yy, 16, K('hodo', t + 1) if t < 2 else K('hodo', 3)); c.VL(x, yy, 16, K('hodo', t + 1) if t < 2 else K('hodo', 3))     # 왼쪽·위 반사면
            c.HL(x + 1, yy + 15, 15, K('hodo', t - 1)); c.VL(x + 15, yy + 1, 15, K('hodo', t - 1))                                       # 오른쪽·아래 줄눈
    for (cx, cy) in ((37, 213), (70, 236), (118, 221), (171, 250), (203, 228), (285, 210), (330, 244), (365, 222), (441, 232), (466, 252)):
        c.P(cx, cy, K('hodo', -2)); c.P(cx + 1, cy, K('hodo', -2)); c.P(cx + 1, cy + 1, K('hodo', -1)); c.P(cx - 1, cy, K('hodo', 2))
    # B 앞 보도 위 윗단(y196~204)
    c.R(244, 196, 268, 8, K('hodo', 1)); c.HL(244, 196, 268, K('hodo', 3)); c.HL(244, 203, 268, K('hodo', -1))
    # 연석
    for y, t in zip(range(268, 276), (3, 2, 1, 1, 0, -1, -2, -3)): c.HL(0, y, W, K('hodo', t))
    for x in range(0, W, 24): c.VL(x, 269, 5, K('hodo', -1))

def road(c):
    c.R(0, 276, W, 108, K('yoru', 0))
    # 타이어 자국 · 마모(손 좌표)
    for (x, y, w, h, t) in ((20, 300, 140, 6, -1), (20, 312, 140, 5, 1), (200, 300, 60, 6, 1), (340, 296, 170, 7, -1), (340, 312, 170, 5, 1),
                            (30, 350, 220, 8, -1), (30, 362, 220, 4, 1), (350, 348, 150, 8, 1), (350, 364, 150, 5, -1)):
        c.R(x, y, w, h, K('yoru', t))
    for (x, y) in ((70, 340), (110, 296), (170, 372), (420, 330), (470, 300), (60, 285)):
        for k in range(9): c.P(x + k, y + (k * 3) % 5 - 2 + (1 if k > 5 else 0), K('yoru', -3))     # 균열
    # 중앙선(점선) — 횡단보도 구간 건너뜀
    for x in range(0, W, 40):
        if 260 < x < 340: continue
        c.R(x, 331, 24, 3, K('kinari', 1)); c.HL(x, 331, 24, K('kinari', 3)); c.HL(x, 334, 24, K('kinari', -2))
    # 횡단보도: 교통 방향과 나란한 흰 띠 6개(8px 띠 + 8px 틈), 폭 56
    for k in range(6):
        y = 284 + 16 * k
        c.R(272, y, 56, 8, K('shiro', 1)); c.HL(272, y, 56, K('shiro', 3)); c.HL(272, y + 7, 56, K('shiro', -1))
        for (dx, dy) in ((5, 2), (6, 2), (17, 5), (18, 5), (29, 1), (41, 4), (42, 4), (50, 2)): c.P(272 + dx + (k * 7) % 5, y + dy, K('shiro', -1))
    # 맨홀 · 배수구 · 화살표
    c.R(232, 351, 16, 7, K('yoru', -2)); c.HL(233, 350, 14, K('yoru', -2)); c.HL(233, 358, 14, K('yoru', -2)); c.HL(232, 351, 16, K('yoru', 2))
    for k in range(3): c.HL(235, 353 + k * 2, 10, K('yoru', 1 if k != 1 else -3))
    for k in range(5): c.VL(400 + k * 3, 277, 2, K('yoru', -3))
    for i, w in enumerate((1, 3, 5, 7, 9)): c.HL(400 + 8 - w // 2, 356 + i, w, K('kinari', 0))
    c.R(407, 361, 3, 10, K('kinari', 0)); c.VL(407, 361, 10, K('kinari', 1))


def road_extra(c):
    """아스팔트 골재(2화소 덩이) · 보수 자국 · 배수 홈 · 정지선 그늘."""
    for j in range(0, 100, 6):
        for i in range(0, W, 10):
            x = (i + (j * 7) % 10 + (j // 6) * 3) % W; y = 282 + j
            if 270 < x < 334 and y < 380: continue
            t = 1 if ((x // 10 + j // 6) % 3 == 0) else -1
            if 0 <= y < H - 1: c.P(x, y, K('yoru', t)); c.P(x + 1, y, K('yoru', t))
    # 보수 패치(사각 + 실란트 선)
    c.R(392, 306, 40, 14, K('yoru', 1)); c.HL(392, 306, 40, K('yoru', -2)); c.HL(392, 320, 40, K('yoru', -2)); c.VL(392, 306, 14, K('yoru', -2)); c.VL(431, 306, 14, K('yoru', -2))
    c.HL(393, 307, 38, K('yoru', 2)); c.HL(400, 313, 24, K('yoru', 2))
    # 연석 밑 배수 홈(gutter) 2px -3 + 배수구 격자
    c.HL(0, 277, W, K('yoru', -3)); c.HL(0, 278, W, K('yoru', -2))
    for gx in (60, 300):
        c.R(gx, 277, 20, 4, K('yoru', -3)); [c.VL(gx + 2 + k * 3, 277, 4, K('yoru', 1)) for k in range(6)]
    # 횡단보도 앞 정지선
    c.R(336, 282, 3, 98, K('shiro', 0)); c.VL(336, 282, 98, K('shiro', 2)); c.dim(340, 282, 2, 98, 1)

# ───────────────────────── 옥상 소품 ─────────────────────────
def ac_unit(c, x, y, w=20):
    """실외기 w×12: 앞 0 · 윗면 +3 · 왼쪽 +2 · 팬 원 2개 · 오른쪽 그림자."""
    c.R(x, y, w, 12, K('tekko', 1)); c.HL(x, y, w, K('tekko', 3)); c.HL(x, y + 1, w, K('tekko', 2)); c.VL(x, y, 12, K('tekko', 2))
    for fx in range(x + 3, x + w - 6, 9):
        c.R(fx, y + 3, 7, 7, K('tekko', -1)); c.R(fx + 1, y + 2, 5, 9, K('tekko', -1)); c.R(fx + 1, y + 4, 5, 5, K('tekko', 0))
        c.R(fx + 2, y + 5, 3, 3, K('tekko', -2)); c.P(fx + 3, y + 6, K('tekko', 1))
        c.VL(fx + 3, y + 3, 7, K('tekko', -2)); c.HL(fx + 1, y + 6, 5, K('tekko', -2))
    c.HL(x, y + 11, w, K('tekko', -2)); c.VL(x + w - 1, y + 2, 10, K('tekko', -2))
    c.HL(x + 1, y + 12, w, K('hodo', -2)); c.HL(x + 2, y + 13, w - 1, K('hodo', -1))

def rail(c, x, y, w, h=8):
    """난간: 위 가로대 +3 · 세로살 2px 간격 · 밑대 -1 · 기둥 8칸마다."""
    c.HL(x, y, w, K('tekko', 3)); c.HL(x, y + 1, w, K('tekko', 1)); c.HL(x, y + h - 1, w, K('tekko', -1))
    for i in range(0, w, 3): c.VL(x + i, y + 2, h - 3, K('tekko', 0)); 
    for i in range(0, w + 1, 8): c.VL(min(x + i, x + w - 2), y, h, K('tekko', 2)); c.VL(min(x + i, x + w - 2) + 1, y + 1, h - 1, K('tekko', -2))

def water_tank(c, x, y):
    """물탱크: 강철 다리 + 원통(왼쪽 밝고 오른쪽 어둡게 4단 세로 띠 + 가로 띠 2) + 뚜껑."""
    for lx in (x + 2, x + 26): c.VL(lx, y + 22, 14, K('tekko', 1)); c.VL(lx + 1, y + 22, 14, K('tekko', -2))
    c.HL(x + 2, y + 28, 26, K('tekko', 0)); 
    for k in range(0, 24): c.P(x + 3 + k, y + 24 + (k % 2) * 3, K('tekko', -1))
    bands = (2, 3, 2, 1, 1, 0, 0, -1, -1, -2, -2, -3)
    for i in range(30):
        t = bands[min(11, i * 12 // 30)]
        c.VL(x + i, y + 6, 18, K('conc', t))
    c.HL(x + 1, y + 5, 28, K('conc', 3)); c.HL(x + 3, y + 4, 24, K('conc', 2)); c.HL(x + 8, y + 3, 14, K('conc', 1))
    for by in (y + 10, y + 17): c.HL(x, by, 30, K('tekko', -1)); c.HL(x, by + 1, 30, K('tekko', 1) if False else K('conc', -2))
    c.HL(x, y + 24, 30, K('conc', -3)); c.HL(x + 2, y + 25, 28, K('hodo', -2))
    c.VL(x + 22, y, 4, K('tekko', 1)); c.HL(x + 20, y, 5, K('tekko', 2))

def antenna(c, x, y):
    c.VL(x, y, 26, K('tekko', 1)); c.VL(x + 1, y, 26, K('tekko', -1))
    for i, (dy, w) in enumerate(((2, 12), (7, 10), (12, 8), (17, 6))):
        c.HL(x - w // 2 + 1, y + dy, w, K('tekko', 3 - i % 2)); c.HL(x - w // 2 + 1, y + dy + 1, w, K('tekko', -1))

# ───────────────────────── 건물 A (타일 외벽, 튀어나옴) ─────────────────────────
A_L, A_R, A_SIDE = 16, 232, 244
A_FLOORS = ((28, 32), (64, 28), (96, 28), (128, 28))
TILE_VAR = '.+-..+.--+..-+.+.-..+-.+.'
# 층별 5칸 구성: W2 창 둘 / B 발코니 / W1 창 하나 / 문자열 = 종류 순환
A_BAYS = [
    ['W2', 'W2', 'W1', 'W2', 'B'],
    ['W1', 'B', 'W2', 'W1', 'W2'],
    ['W2', 'W1', 'B', 'W2', 'W1'],
    ['B', 'W2', 'W2', 'W1', 'W2'],
]
KINDS = ['sky', 'sky', 'curtain', 'sky', 'lit', 'sky', 'blind', 'sky', 'plant', 'sky', 'curtain', 'sky', 'sky', 'lit', 'sky', 'blind']

def building_a(c):
    # 몸통
    tile_wall(c, A_L, 28, A_R - A_L, 176, 'renga', TILE_VAR)
    # 옥상 뒤 파라펫 + 지붕 바닥 + 앞 슬래브
    c.R(A_L, 8, A_R - A_L, 4, K('conc', 0)); c.HL(A_L, 8, A_R - A_L, K('conc', 3)); c.HL(A_L, 9, A_R - A_L, K('conc', 2)); c.HL(A_L, 11, A_R - A_L, K('conc', -2))
    c.R(A_L, 12, A_R - A_L, 12, K('hodo', 1))
    for (x, y, w, h) in ((30, 15, 18, 5), (110, 13, 12, 6), (150, 18, 26, 4), (196, 14, 14, 5)): c.R(x, y, w, h, K('hodo', 0)); c.HL(x, y, w, K('hodo', 2))
    c.dim(A_L, 12, A_R - A_L, 3, 1)                                          # 파라펫 그림자
    # 옥상 시설: 계단탑 · 실외기 셋 · 안테나
    c.R(40, 6, 46, 12, K('conc', 0)); c.HL(40, 6, 46, K('conc', 3)); c.HL(40, 7, 46, K('conc', 2)); c.HL(40, 17, 46, K('conc', -2)); c.VL(40, 6, 12, K('conc', 1)); c.VL(85, 7, 11, K('conc', -2))
    c.R(52, 10, 12, 8, K('tekko', 1)); c.HL(52, 10, 12, K('tekko', 3)); c.R(53, 11, 10, 7, K('tekko', -1)); c.VL(58, 11, 7, K('tekko', -3))  # 철문
    ac_unit(c, 100, 10); ac_unit(c, 124, 12, 20); ac_unit(c, 182, 12, 20)
    antenna(c, 214, 0)
    for (x, y) in ((92, 20), (146, 20)): c.HL(x, y, 6, K('tekko', 0))
    # 앞 슬래브(4px) 다섯 줄
    for sy in (24, 60, 92, 124, 156): slab(c, A_L, sy, A_R - A_L, 'conc')
    rail(c, A_L + 2, 16, A_R - A_L - 4, 8)                                    # 옥상 난간(앞 슬래브 바로 뒤)
    # 각 층
    for fi, (top, h) in enumerate(A_FLOORS):
        for bi in range(5):
            bx = 22 + 40 * bi; kind = A_BAYS[fi][bi]; k0 = (fi * 5 + bi) * 2
            wy = top + (7 if h == 32 else 5)
            if kind == 'W2':
                window(c, bx + 1, wy, KINDS[k0 % len(KINDS)]); window(c, bx + 19, wy, KINDS[(k0 + 1) % len(KINDS)], ac=(bi == 1 and fi == 1))
            elif kind == 'W1':
                window(c, bx + 9, wy, KINDS[k0 % len(KINDS)], ac=(fi == 2 and bi == 4))
            else:
                balcony(c, bx + 4, top - (0 if h == 32 else 0), laundry=(fi in (1, 3)), ac=(fi == 2))
    # 기둥(튀어나온) — 슬래브 사이 구간에만
    for k in range(6):
        px = A_L + 40 * k
        for (top, h) in A_FLOORS: pillar(c, px, top, h)
    # 오른쪽 모서리 벽띠 · 우수관
    c.VL(226, 28, 176, K('tekko', 1)); c.VL(227, 28, 176, K('tekko', -1))
    for y in range(40, 200, 24): c.HL(225, y, 4, K('tekko', 3)); c.HL(225, y + 1, 4, K('tekko', -2))
    # 옆면(그늘: 각 재료 -2)
    c.R(A_R, 8, A_SIDE - A_R, 196, K('renga', -2)); c.VL(A_R, 28, 176, K('renga', -1))
    for y in range(28, 204, 8): c.HL(A_R, y, 12, K('renga', -3))
    c.R(A_R, 8, 12, 20, K('conc', -2)); c.HL(A_R, 24, 12, K('conc', -3))
    for sy in (24, 60, 92, 124, 156): c.R(A_R, sy, 12, 4, K('conc', -3)); c.HL(A_R, sy, 12, K('conc', -2))
    c.R(A_R, 4, 12, 4, K('conc', -3))
    # 슬래브 밑 그림자 → 왼쪽 골목 쪽 벽
    # 빗물 때(기둥·창턱 아래)
    for (x, y, h) in ((30, 88, 24), (74, 122, 22), (140, 56, 6), (112, 152, 18), (184, 120, 20), (66, 62, 12), (204, 62, 14)):
        c.dim(x, y, 2, h, 1)

# ───────────────────────── 편의점 ─────────────────────────
GOODS = {'r': ('aka', 0), 'y': ('kii', 0), 'g': ('midori', 0), 'b': ('sora', 0), 'o': ('daidai', 0), 'p': ('pinku', 0), 'w': ('shiro', 0), 'k': ('kon', 1), 'n': ('kinari', -1), 't': ('ita', 0)}
SHELF_ROWS = ['rryyggbbwwooppkkrrggyyttbbnnwwrryyooggbbkkppwwnnrryyggoobbwwttppkk',
              'gg..rrbbwwyy..oorrkkggppnnbbwwyyrrtt..ggooppbbkkrrwwyy..ggooppbb',
              'wwyyrrbboogg..kkppnnrryybbggttwwoo..rrppggyykkbbnnwwrroo..yybbgg']

def convenience(c):
    x0, x1 = 22, 190
    # 후퇴 벽(그늘) + 간판 띠
    c.R(A_L, 156, A_R - A_L, 48, K('conc', 0)); c.R(A_L, 160, A_R - A_L, 44, K('conc', -1))
    c.dim(A_L, 160, A_R - A_L, 2, 1)
    # 간판띠(앞으로 튀어나옴): 초록 윗띠 · 흰 몸 · 초록 밑띠
    c.R(A_L, 160, A_R - A_L, 16, K('shiro', 0)); c.HL(A_L, 160, A_R - A_L, K('shiro', 3)); c.HL(A_L, 161, A_R - A_L, K('shiro', 2))
    c.R(A_L, 162, A_R - A_L, 3, K('midori', 0)); c.HL(A_L, 162, A_R - A_L, K('midori', 2)); c.HL(A_L, 164, A_R - A_L, K('midori', -1))
    c.R(A_L, 172, A_R - A_L, 4, K('midori', -1)); c.HL(A_L, 172, A_R - A_L, K('midori', 1)); c.HL(A_L, 175, A_R - A_L, K('midori', -3))
    c.VL(A_L, 160, 16, K('shiro', 3)); c.VL(A_R - 1, 160, 16, K('shiro', -2))
    c.R(A_L + 2, 162, 8, 3, K('kii', 1)); c.R(A_L + 2, 172, 8, 3, K('kii', 1)) if False else None
    for i, ch in enumerate('ミニマート'):
        glyph(c, 34 + i * 12, 165, ch, K('midori', -3)); glyph(c, 34 + i * 12, 166, ch, K('midori', -3)) if ch in 'ー' else (glyph(c, 34 + i * 12, 164, ch, K('midori', -3)) if False else None)
    # 로고 원(왼쪽)
    for j, row in enumerate(('..###..', '.#aaa#.', '#aabaa#', '#abbba#', '#aabaa#', '.#aaa#.', '..###..')):
        for i, ch in enumerate(row):
            if ch == '#': c.P(22 + i, 164 + j - 0, K('midori', -3))
            elif ch == 'a': c.P(22 + i, 164 + j, K('kii', 1))
            elif ch == 'b': c.P(22 + i, 164 + j, K('aka', 0))
    c.dim(A_L, 176, A_R - A_L, 3, 2); c.dim(A_L, 179, A_R - A_L, 2, 1)         # 간판 밑 그림자(가장 깊은 곳부터)
    # 유리 진열창
    c.R(x0, 178, 108, 22, K('tekko', -2))
    for j in range(20):
        for i in range(106):
            t = 0 if j > 3 else -1; c.P(x0 + 1 + i, 179 + j, K('garasu', -1 if j < 2 else 0 if j < 14 else -1))
    for r in range(3):
        y = 182 + r * 6
        c.HL(x0 + 1, y + 5, 106, K('tekko', 2)); c.HL(x0 + 1, y + 6, 106, K('tekko', -2))
        for i, ch in enumerate(SHELF_ROWS[r][:53]):
            if ch == '.': continue
            m, t = GOODS[ch]; gx = x0 + 2 + i * 2
            c.R(gx, y + 1, 2, 4, K(m, t)); c.P(gx, y + 1, K(m, t + 2)); c.P(gx + 1, y + 4, K(m, t - 1))
    # 유리 반사 띠(대각) + 세로 창틀
    for (bx, len_) in ((30, 18), (60, 14), (88, 20)):
        for k in range(len_):
            c.P(x0 + bx + k, 197 - k, K('garasu', 2)); c.P(x0 + bx + k + 1, 197 - k, K('garasu', 1))
    for vx in (x0, x0 + 36, x0 + 72, x0 + 107): c.VL(vx, 178, 22, K('tekko', 0)); c.VL(vx + 1, 178, 22, K('tekko', 2) if vx == x0 else K('tekko', -2))
    # 자동문(두 짝)
    dx = 132
    c.R(dx, 178, 34, 22, K('tekko', -2))
    for j in range(20):
        for i in range(32): c.P(dx + 1 + i, 179 + j, K('garasu', 1 if j < 2 else 0 if j < 15 else -1))
    for (k0, k1) in ((0, 15), (16, 31)):
        c.R(dx + 1 + k0, 179, 1, 20, K('tekko', 2)); c.R(dx + 1 + k1 - 1, 179, 1, 20, K('tekko', -2))
    c.VL(dx + 16, 178, 22, K('tekko', -3)); c.VL(dx + 17, 178, 22, K('tekko', -1))
    c.R(dx + 13, 188, 2, 8, K('tekko', 3)); c.R(dx + 19, 188, 2, 8, K('tekko', 3))
    for k in range(6): c.P(dx + 4 + k, 183 + k // 2 * 0 + (5 - k), K('garasu', 3))
    c.R(dx + 22, 190, 5, 3, K('aka', 0)); c.R(dx + 3, 176, 8, 2, K('kii', 1))      # 자동문 표지
    # 포스터 창
    c.R(170, 178, 20, 22, K('tekko', -2)); c.R(171, 179, 18, 20, K('garasu', 0))
    c.R(173, 181, 6, 8, K('aka', 1)); c.R(180, 181, 6, 8, K('kii', 1)); c.R(173, 190, 13, 7, K('shiro', 1)); c.HL(174, 192, 8, K('aka', -1)); c.HL(174, 194, 10, K('sora', -1))
    c.VL(170, 178, 22, K('tekko', 2)); c.VL(189, 178, 22, K('tekko', -2))
    # 밑 받침 + 아래 그림자
    c.R(x0, 200, 168, 4, K('hodo', 0)); c.HL(x0, 200, 168, K('hodo', 3)); c.HL(x0, 203, 168, K('hodo', -2))
    # 오른쪽: 주택 현관
    c.R(194, 176, 24, 28, K('conc', -1)); c.R(197, 178, 16, 26, K('ita', -1)); c.HL(197, 178, 16, K('ita', 2)); c.VL(197, 178, 26, K('ita', 1)); c.VL(212, 178, 26, K('ita', -2))
    c.R(200, 182, 10, 8, K('garasu', -1)); c.HL(200, 182, 10, K('garasu', 1)); c.R(200, 193, 10, 8, K('ita', -2)); c.HL(200, 193, 10, K('ita', 0))
    c.R(209, 194, 2, 3, K('kii', 1))
    c.R(198, 174, 18, 3, K('conc', 1)); c.HL(198, 174, 18, K('conc', 3)); c.HL(198, 176, 18, K('conc', -2))
    for j in range(2):
        for i in range(3): c.R(220 + i * 4, 182 + j * 6, 3, 5, K('tekko', 1)); c.HL(220 + i * 4, 182 + j * 6, 3, K('tekko', 3)); c.P(222 + i * 4, 186 + j * 6, K('kii', 1))
    c.R(218, 202, 14, 2, K('hodo', -2))

# ───────────────────────── 건물 B (콘크리트, 물러남) ─────────────────────────
B_L, B_R, B_SIDE = 244, 496, 512
B_FLOORS = ((48, 28), (80, 28), (112, 28))
PANEL_VAR = '.-+..-.+-..+.-.'

def building_b(c):
    panel_wall(c, B_L, 28, B_R - B_L, 168, 'conc', PANEL_VAR)
    c.R(B_L, 28, B_R - B_L, 4, K('conc', 1)); c.HL(B_L, 28, B_R - B_L, K('conc', 3)); c.HL(B_L, 31, B_R - B_L, K('conc', -2))
    c.R(B_L, 32, B_R - B_L, 12, K('hodo', 0)); c.HL(B_L, 32, B_R - B_L, K('hodo', -2))
    for (x, y, w, h) in ((262, 36, 24, 5), (330, 34, 14, 6)): c.R(x, y, w, h, K('hodo', -1)); c.HL(x, y, w, K('hodo', 1))
    water_tank(c, 440, 8)
    ac_unit(c, 268, 26, 20); ac_unit(c, 300, 28, 20)
    c.R(340, 22, 20, 14, K('conc', 0)); c.HL(340, 22, 20, K('conc', 3)); c.HL(340, 23, 20, K('conc', 2)); c.HL(340, 35, 20, K('conc', -2)); c.R(346, 26, 8, 10, K('tekko', -1)); c.HL(346, 26, 8, K('tekko', 1))
    for sy in (44, 76, 108, 140): slab(c, B_L, sy, B_R - B_L, 'conc')
    rail(c, B_L + 2, 36, B_R - B_L - 4, 8)
    for fi, (top, h) in enumerate(B_FLOORS):
        for pi in range(7):
            px = B_L + 32 * pi
            k0 = (fi * 7 + pi)
            if (fi, pi) in ((1, 3), (0, 5), (2, 1)):        # 리본창(가로로 긴 창)
                window(c, px + 4, top + 5, KINDS[(k0 * 3) % len(KINDS)]); window(c, px + 4 + 18, top + 5, KINDS[(k0 * 3 + 1) % len(KINDS)])
            else:
                window(c, px + 8, top + 5, KINDS[(k0 * 3 + 1) % len(KINDS)], ac=((fi + pi) % 5 == 2))
    # 패널 사이 배관 · 계량기
    c.R(462, 152, 10, 14, K('tekko', 0)); c.HL(462, 152, 10, K('tekko', 3)); c.R(464, 155, 6, 9, K('garasu', -1)); c.HL(462, 165, 10, K('tekko', -2))
    for i in range(3): c.HL(478, 156 + i * 4, 12, K('tekko', 1 if i % 2 == 0 else -1)); c.HL(478, 157 + i * 4, 12, K('tekko', -3))
    # 오른쪽 옆면
    c.R(B_R, 28, B_SIDE - B_R, 172, K('conc', -2)); c.VL(B_R, 28, 172, K('conc', -1)); c.HL(B_R, 32, 16, K('conc', -3))
    for sy in (44, 76, 108, 140): c.R(B_R, sy, 16, 4, K('conc', -3)); c.HL(B_R, sy, 16, K('conc', -2))
    for (top, h) in B_FLOORS: window(c, B_R + 1, top + 5, 'sky') if False else None
    # A 그림자(12px: 8 → -2, 4 → -1)
    for (top, h) in ((28, 172),): pass
    c.dim(B_L, 32, 8, 168, 2); c.dim(B_L + 8, 32, 4, 168, 1)
    # 빗물 때
    for (x, y, h) in ((300, 74, 14), (352, 106, 12), (400, 138, 10), (300, 108, 16), (452, 74, 12)): c.dim(x, y, 2, h, 1)

# ───────────────────────── 식당 ─────────────────────────
def restaurant(c):
    x0, x1 = 264, 344
    c.R(x0, 148, x1 - x0, 48, K('conc', -2)); c.R(x0, 156, x1 - x0, 40, K('conc', -3))        # 후퇴 벽(깊은 그늘)
    # 기와 차양(경사)
    for k in range(9):
        y = 148 + k; c.HL(x0 - 4 + (0 if k < 7 else 1), y, x1 - x0 + 8 - (0 if k < 7 else 2), K('kawara', 2 - k // 3 * 1 if k < 6 else -2))
    for x in range(x0 - 4, x1 + 4, 6): c.VL(x, 149, 6, K('kawara', -2)); c.P(x + 1, 149, K('kawara', 3))
    c.HL(x0 - 4, 148, x1 - x0 + 8, K('kawara', 3)); c.HL(x0 - 3, 157, x1 - x0 + 6, K('kawara', -3))
    c.dim(x0, 158, x1 - x0, 3, 2); c.dim(x0, 161, x1 - x0, 2, 1)
    # 나무 간판
    c.R(x0 + 14, 160, 52, 14, K('ita', -1)); c.HL(x0 + 14, 160, 52, K('ita', 2)); c.VL(x0 + 14, 160, 14, K('ita', 1)); c.HL(x0 + 14, 173, 52, K('ita', -3)); c.VL(x0 + 65, 160, 14, K('ita', -2))
    for i, ch in enumerate('めし'): glyph(c, x0 + 26 + i * 14, 164, ch, K('kinari', 2), K('ita', -3))
    for k in range(4): c.P(x0 + 18 + k * 12, 174 + (k % 2), K('tekko', 0))              # 걸이 못
    # 노렌(4폭, 슬릿, 흰 단, 원 문양)
    for k in range(4):
        px = x0 + 18 + k * 11
        c.R(px, 176, 10, 16, K('kon', 0)); c.HL(px, 176, 10, K('kon', 2)); c.VL(px, 176, 16, K('kon', 1)); c.VL(px + 9, 176, 16, K('kon', -2))
        c.HL(px, 190, 10, K('shiro', 1)); c.HL(px, 191, 10, K('shiro', -1))
        for j in range(8): c.P(px + 4 + (j % 2), 179 + j, K('kon', -1))               # 천 주름
        c.dim(px + 2, 191, 8, 1, 1)
    c.R(x0 + 15, 173, 44, 2, K('tekko', 0)); c.HL(x0 + 15, 173, 44, K('tekko', 2))       # 봉
    for i, row in enumerate(('..##..', '.#..#.', '#....#', '#....#', '.#..#.', '..##..')):
        for j, ch in enumerate(row):
            if ch == '#': c.P(x0 + 27 + j, 181 + i, K('shiro', 1)); c.P(x0 + 38 + j, 181 + i, K('shiro', 1))
    # 등롱 · 격자창 · 입간판 · 화분
    c.R(x0 + 2, 166, 8, 12, K('aka', 0)); c.HL(x0 + 2, 166, 8, K('aka', -2)); c.HL(x0 + 2, 177, 8, K('aka', -2)); c.VL(x0 + 2, 167, 10, K('aka', 2)); c.VL(x0 + 9, 167, 10, K('aka', -1)); c.HL(x0 + 3, 170, 6, K('aka', -1)); c.HL(x0 + 3, 173, 6, K('aka', -1))
    c.P(x0 + 5, 168, K('aka', 3)); c.VL(x0 + 5, 162, 4, K('tekko', 0))
    c.R(x0 + 68, 178, 10, 14, K('ita', -2)); c.R(x0 + 69, 179, 8, 12, K('mado', 0)); c.VL(x0 + 72, 179, 12, K('ita', 0)); c.HL(x0 + 69, 184, 8, K('ita', 0)); c.HL(x0 + 69, 188, 8, K('ita', 0)); c.HL(x0 + 68, 178, 10, K('ita', 2))
    c.R(x0 + 60, 180, 4, 3, K('shiro', 0))
    c.R(x1 - 6, 186, 14, 10, K('ita', 0)); c.HL(x1 - 6, 186, 14, K('ita', 2)); c.R(x1 - 4, 188, 10, 6, K('kokuban', 0)); c.HL(x1 - 3, 190, 6, K('shiro', 2)); c.HL(x1 - 3, 192, 4, K('shiro', 1)); c.VL(x1 - 6, 186, 10, K('ita', 1)); c.HL(x1 - 6, 195, 14, K('ita', -3))
    for (px, pc) in ((x0 - 4, 'midori'), (x0 + 60, 'daidai')):
        c.R(px, 190, 8, 6, K('daidai', -1)); c.HL(px, 190, 8, K('daidai', 1)); c.HL(px, 195, 8, K('daidai', -3)); c.VL(px + 7, 191, 5, K('daidai', -2))
        for (dx, dy) in ((1, 187), (2, 185), (3, 184), (4, 186), (5, 187), (2, 188), (5, 189)): c.P(px + dx, dy, K('midori', 1))
        c.P(px + 3, 185, K('midori', 3)); c.P(px + 2, 187, K('midori', 0))
    c.R(x0 - 2, 196, 88, 4, K('hodo', 0)); c.HL(x0 - 2, 196, 88, K('hodo', 3))
    # 현관 (주택 입구)
    c.R(356, 152, 32, 44, K('conc', -2)); c.R(358, 154, 28, 42, K('tekko', -1)); c.HL(358, 154, 28, K('tekko', 2)); c.VL(358, 154, 42, K('tekko', 1))
    c.R(361, 158, 22, 34, K('garasu', -1)); c.HL(361, 158, 22, K('garasu', 1))
    for r in range(4, 14): c.P(361 + 3 + (r - 4), 158 + r, K('garasu', 3))
    c.VL(371, 158, 34, K('tekko', -2)); c.VL(372, 158, 34, K('tekko', 1))
    c.R(388, 170, 6, 8, K('tekko', 1)); c.HL(388, 170, 6, K('tekko', 3)); c.R(389, 172, 4, 2, K('garasu', 1)); c.P(390, 175, K('kii', 1)); c.P(391, 175, K('midori', 1))
    c.dim(356, 152, 32, 3, 2)

# ───────────────────────── 세로 간판 ─────────────────────────
def vsign(c, x, y):
    h = 54
    c.R(x - 8, y + 8, 8, 2, K('tekko', 1)); c.HL(x - 8, y + 8, 8, K('tekko', 3)); c.HL(x - 8, y + 10, 8, K('tekko', -2))     # 고정대
    c.R(x, y, 16, h, K('aka', 0)); c.R(x + 2, y + 2, 12, h - 4, K('shiro', 1)); c.R(x + 3, y + 3, 10, h - 6, K('aka', 1))
    c.HL(x, y, 16, K('aka', 2)); c.VL(x, y, h, K('aka', 2)); c.VL(x + 15, y, h, K('aka', -2)); c.HL(x, y + h - 1, 16, K('aka', -3))
    c.HL(x + 2, y + 2, 12, K('shiro', 3)); c.VL(x + 2, y + 2, h - 4, K('shiro', 3)); c.VL(x + 13, y + 3, h - 6, K('shiro', -1))
    for j, row in enumerate(('..###..', '.#####.', '#######', '#.....#', '.#####.')):
        for i, ch in enumerate(row):
            if ch == '#': c.P(x + 4 + i, y + 5 + j, K('shiro', 3) if j < 3 else K('shiro', 1))
    c.R(x + 4, y + 10, 8, 2, K('kii', 1))
    for i, ch in enumerate('ラーメン'): glyph(c, x + 4, y + 14 + i * 9 - (1 if ch == 'ー' else 0), ch, K('shiro', 3), K('aka', -2))
    c.R(x + 16, y + 2, 3, h - 2, K('aka', -2)); c.VL(x + 18, y + 2, h - 2, K('aka', -3))                      # 옆면
    c.dim(x + 3, y + h, 16, 3, 1)

# ───────────────────────── 가로수 · 가로등 · 가드레일 ─────────────────────────
def tree_pit(c, cx):
    c.R(cx - 10, 248, 20, 8, K('tekko', -1)); c.HL(cx - 10, 248, 20, K('tekko', 2)); c.R(cx - 8, 250, 16, 4, K('hodo', -2))
    for i in range(0, 16, 3): c.VL(cx - 8 + i, 250, 4, K('tekko', 1))
    c.dim(cx - 10, 256, 20, 2, 2)

def shadow_ellipse(c, cx, cy, rx, ry, n=2):
    for j in range(-ry, ry + 1):
        for i in range(-rx, rx + 1):
            if (i * i) * ry * ry + (j * j) * rx * rx <= rx * rx * ry * ry: c.dim(cx + i, cy + j, 1, 1, n)

def streetlight(c, x, y0):
    c.R(x, y0, 2, 112, K('tekko', 1)); c.VL(x, y0, 112, K('tekko', 3)); c.VL(x + 1, y0, 112, K('tekko', -2))
    c.HL(x - 12, y0, 14, K('tekko', 1)); c.HL(x - 12, y0, 14, K('tekko', 3)); c.R(x - 14, y0 + 1, 8, 3, K('tekko', -1)); c.HL(x - 14, y0 + 1, 8, K('kinari', 3))
    c.R(x - 3, y0 + 100, 8, 12, K('tekko', 0)); c.HL(x - 3, y0 + 100, 8, K('tekko', 2)); c.VL(x + 4, y0 + 101, 11, K('tekko', -2))

def guardrail(c, x0, x1):
    for x in range(x0, x1, 24):
        c.R(x, 252, 2, 16, K('tekko', 1)); c.VL(x, 252, 16, K('tekko', 3)); c.VL(x + 1, 252, 16, K('tekko', -2)); c.R(x - 1, 252, 4, 2, K('tekko', 3))
    for (y, h) in ((254, 2), (261, 2)):
        c.R(x0, y, x1 - x0, h, K('tekko', 1)); c.HL(x0, y, x1 - x0, K('tekko', 3)); c.HL(x0, y + h, x1 - x0, K('tekko', -2))
    c.dim(x0, 268, x1 - x0, 1, 1)

def bicycle(c, x, y):
    for wx in (x, x + 20):
        for j in range(-6, 7):
            for i in range(-6, 7):
                d = i * i + j * j
                if 25 <= d <= 42: c.P(wx + 6 + i, y + 6 + j, K('sumi', 2))
        c.P(wx + 6, y + 6, K('tekko', 2))
    for (a, b, w2, hh) in ((6, 6, 14, 1),): c.HL(x + a, y + 4, 14, K('tekko', 1))
    for k in range(8): c.P(x + 6 + k, y + 6 - k // 2, K('aka', 0)); c.P(x + 26 - k, y + 6 - k // 2, K('aka', -1))
    c.HL(x + 4, y + 1, 5, K('sumi', 2)); c.HL(x + 22, y - 1, 4, K('tekko', 2)); c.R(x + 8, y + 1, 2, 3, K('aka', 1))

# ═════════════════════ 1라운드: 자리표시 소품을 손으로 다시 ═════════════════════
def obox(c, x, y, w, h, fill, edge):
    c.R(x, y, w, h, edge); c.R(x + 1, y + 1, w - 2, h - 2, fill)

def hero_p(c, x, y):
    O = K('sumi', -1); H = K('tekko', -3); h = K('tekko', -1); g = K('tekko', 0)
    s = K('daidai', 2); S = K('daidai', 1); e = K('sumi', 0); ch = K('aka', 0)
    j = K('sora', -1); J = K('sora', 0); d = K('sora', -2); w = K('shiro', 1); p = K('kon', 1); P = K('kon', 0); sh = K('shiro', 0); SH = K('shiro', -1)
    rows = [
        '.....OOOOOO.....', '....OhhgHHHO....', '...OhhgHHHHHO...', '...OHHHHHHHHO...', '...OHHsssssHO...', '...OsssssssSO...',
        '...OsesssesSO...', '...OssschsssO...'[:16], '....OssssSSO....', '.....OSSSSO.....', '...OOjjwwjjOO...', '..OjjJjwwjjjjO..',
        '.OjJJjjjjjjjjdO.', '.OjJjjjjjjjjjdO.', '.OjjjjjjjjjjddO.', '.OsjjjjjjjjjdsO.', '.OSOddddddddOSO.', '..OO.OppppO.OO..',
        '...OppppPPPPO...', '...OpppO.PPPO...', '...OpppO.PPPO...', '...OpppO.PPPO...', '...OwwwO.SHSHO..'[:16], '...OOOOO.OOOO...']
    cm = {'O': O, 'H': H, 'h': h, 'g': g, 's': s, 'S': S, 'e': e, 'c': ch, 'j': j, 'J': J, 'd': d, 'w': w, 'p': p, 'P': P}
    rows[18] = '...OpppppPPPPO...'[:16]
    rows[22] = '...OwwwO.OSHHO...'[:16]
    for jj, r in enumerate(rows):
        r = r.ljust(16, '.')[:16]
        for i, chh in enumerate(r):
            if chh in cm: c.P(x + i, y + jj, cm[chh])
    for (i, jj) in ((4, 22), (5, 22), (6, 22), (10, 22), (11, 22), (12, 22)): c.P(x + i, y + jj, K('shiro', 1 if i < 8 else 0))

def _lobes():
    return ((16, 15, 13), (7, 22, 8), (25, 22, 8), (16, 7, 8), (16, 27, 7), (9, 12, 7), (23, 12, 7))

def tree_p(c, x, y):
    lobes = _lobes()
    owner = {}
    for j in range(0, 40):
        for i in range(0, 34):
            best = None
            for k, (lx, ly, r) in enumerate(lobes):
                dd = (i - lx) ** 2 + (j - ly) ** 2
                if dd <= r * r:
                    depth = r - dd ** 0.5
                    if best is None or depth > best[0] + (0.0): best = (depth, k)
            if best: owner[(i, j)] = best[1]
    for (i, j), k in owner.items():
        lx, ly, r = lobes[k]
        n = ((i - lx) + (j - ly)) / (r * 1.5)
        t = 3 if n < -0.85 else 2 if n < -0.5 else 1 if n < -0.05 else 0 if n < 0.35 else -1 if n < 0.65 else -2
        edge = any(owner.get((i + a, j + b), -1) == -1 for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        seam = any(owner.get((i + a, j + b), k) != k and lobes[owner[(i + a, j + b)]][1] > ly for a, b in ((0, 1), (1, 0), (-1, 0), (0, -1)))
        if edge: t = -3
        elif seam: t = min(t, 0) - 1
        elif any(owner.get((i + a, j + b), -1) == -1 for a, b in ((1, 1), (-1, 1), (1, -1), (-1, -1))): t = min(t, 0) - 1
        c.P(x + i, y + j, K('ki', t))
    # 잎덩이 하이라이트 반달(각 덩이 왼쪽 위)
    for (lx, ly, r) in lobes[:4]:
        for a in range(-r + 3, -2):
            b = -int((r * r - (a + 2) ** 2) ** 0.5) + 3
            if (lx + a, ly + b) in owner and owner[(lx + a, ly + b)] is not None and (a % 3 != 1): c.P(x + lx + a, y + ly + b, K('ki', 3))
    # 줄기(밑변 = 4px) · 가지가 수관 속으로
    tx = x + 14
    c.R(tx, y + 34, 4, 14, K('ita', -1)); c.VL(tx, y + 34, 14, K('ita', 1)); c.VL(tx + 1, y + 34, 14, K('ita', 0)); c.VL(tx + 3, y + 34, 14, K('ita', -3))
    c.R(tx - 1, y + 44, 6, 4, K('ita', -1)); c.VL(tx - 1, y + 44, 4, K('ita', 1)); c.VL(tx + 4, y + 44, 4, K('ita', -3)); c.HL(tx - 1, y + 47, 6, K('ita', -3))
    for k in range(6): c.P(tx + 1 + (k % 2), y + 36 + k * 2, K('ita', 2))
    c.P(tx - 1, y + 33, K('ita', -2)); c.P(tx + 4, y + 32, K('ita', -2))
    c.R(tx, y + 33, 4, 1, K('ki', -3))

def vending_p(c, x, y, m='sora'):
    O = K('sumi', -1)
    obox(c, x, y, 16, 26, K(m, 0), O)
    c.HL(x + 1, y + 1, 14, K(m, 2)); c.VL(x + 1, y + 2, 23, K(m, 1)); c.VL(x + 14, y + 2, 23, K(m, -2))
    c.R(x + 2, y + 2, 12, 2, K('shiro', 0)); c.HL(x + 3, y + 2, 4, K('aka', 0)); c.HL(x + 8, y + 3, 4, K('sora', -1))      # 상단 로고띠
    obox(c, x + 2, y + 5, 12, 12, K('garasu', -2), K('sumi', 0))
    cols = ('aka', 'kii', 'midori', 'daidai', 'sora')
    for r in range(3):
        for k in range(4):
            mm = cols[(k + r * 2) % 5]
            c.R(x + 3 + k * 3, y + 6 + r * 4, 2, 3, K(mm, 1)); c.P(x + 3 + k * 3, y + 6 + r * 4, K(mm, 3)); c.P(x + 4 + k * 3, y + 8 + r * 4, K(mm, -1))
        c.HL(x + 3, y + 9 + r * 4, 10, K('tekko', 1)) if r < 2 else None
    for k in range(3): c.P(x + 3 + k * 3, y + 10, K('kinari', 2))
    c.P(x + 12, y + 5, K('garasu', 3)); c.P(x + 11, y + 6, K('garasu', 1)); c.P(x + 10, y + 7, K('garasu', 1))
    c.R(x + 3, y + 18, 3, 2, K('tekko', -1)); c.HL(x + 3, y + 18, 3, K('tekko', 2)); c.P(x + 4, y + 19, K('kii', 2))
    c.R(x + 8, y + 18, 5, 1, K('kinari', 1)); c.HL(x + 8, y + 20, 5, K('midori', 0))
    obox(c, x + 3, y + 21, 10, 4, K('sumi', 0), O); c.HL(x + 4, y + 22, 8, K('tekko', -1))
    c.HL(x + 1, y + 25, 14, K(m, -3))

def signal_p(c, x, y):
    O = K('sumi', -1)
    c.R(x + 12, y + 8, 3, 38, K('tekko', 0)); c.VL(x + 12, y + 8, 38, K('tekko', 2)); c.VL(x + 14, y + 8, 38, K('tekko', -2)); c.VL(x + 11, y + 8, 38, O)
    c.R(x + 9, y + 44, 9, 4, K('tekko', -1)); c.HL(x + 9, y + 44, 9, K('tekko', 2)); c.HL(x + 9, y + 47, 9, O)
    obox(c, x, y, 16, 8, K('tekko', -1), O); c.HL(x + 1, y + 1, 14, K('tekko', 1))
    for k, (m, t) in enumerate((('aka', -2), ('kii', -2), ('midori', 2))):
        lx = x + 2 + k * 4
        c.R(lx, y + 2, 3, 4, K('sumi', 0)); c.R(lx, y + 3, 3, 3, K(m, t)); c.HL(lx, y + 2, 3, K('tekko', -3))
        if m == 'midori': c.P(lx + 1, y + 3, K('midori', 3)); c.P(lx, y + 3, K('midori', 3)); c.P(lx + 2, y + 5, K('midori', 0))
    c.HL(x, y + 8, 16, K('tekko', -3))
    obox(c, x + 6, y + 16, 8, 10, K('tekko', -1), O); c.R(x + 8, y + 18, 4, 3, K('aka', 1)); c.P(x + 9, y + 19, K('aka', 3)); c.R(x + 8, y + 22, 4, 2, K('sumi', 0))
    c.R(x + 7, y + 27, 6, 2, K('tekko', 0)); c.HL(x + 7, y + 27, 6, K('tekko', 2))
    c.R(x + 6, y + 9, 6, 1, K('tekko', 0))

def car_p(c, x, y, col='kii'):
    O = K('sumi', -1)
    # 그림자 위 바퀴 · 몸통 아웃라인
    c.R(x + 4, y + 13, 48, 3, O)
    for r in range(11):                                                  # 캐빈(사다리꼴)
        xl = x + 19 - (r * 6) // 10; xr = x + 39 + (r * 6) // 10
        c.HL(xl, y + 2 + r, xr - xl + 1, O)
        c.HL(xl + 1, y + 3 + r, xr - xl - 1, K(col, 0)) if r < 10 else None
    c.R(x + 1, y + 11, 54, 12, O)
    c.R(x + 2, y + 12, 52, 10, K(col, 0)); c.HL(x + 2, y + 12, 52, K(col, 3)); c.HL(x + 2, y + 13, 52, K(col, 2))
    c.R(x + 2, y + 19, 52, 3, K(col, -2)); c.HL(x + 2, y + 18, 52, K(col, -1))
    c.VL(x + 2, y + 12, 8, K(col, 3)); c.VL(x + 53, y + 12, 8, K(col, -2))
    # 유리(두 장) + B필러 + 반사 대각
    for (gx, gw) in ((x + 16, 13), (x + 31, 13)):
        c.R(gx, y + 4, gw, 7, K('garasu', -1)); c.HL(gx, y + 4, gw, K('garasu', -3)); c.HL(gx, y + 5, gw, K('garasu', -2))
        for k in range(4): c.P(gx + 2 + k * 2, y + 9 - k, K('garasu', 3)); c.P(gx + 3 + k * 2, y + 9 - k, K('garasu', 2))
    c.R(x + 29, y + 4, 2, 7, K(col, -1)); c.VL(x + 29, y + 4, 7, K(col, 1))
    # 사이드 몰딩 · 문선 · 손잡이
    c.HL(x + 4, y + 16, 48, K(col, -1)); c.VL(x + 30, y + 12, 10, K(col, -2)); c.VL(x + 15, y + 12, 10, K(col, -2)); c.VL(x + 44, y + 12, 10, K(col, -2))
    c.HL(x + 24, y + 14, 4, K('sumi', 1)); c.HL(x + 37, y + 14, 4, K('sumi', 1))
    # 표지등(안돈) · 전후 램프 · 범퍼 · 번호판
    obox(c, x + 24, y - 1, 9, 4, K('shiro', 1), O); c.HL(x + 25, y + 1, 7, K('kii', 0)); c.P(x + 26, y, K('aka', 0)); c.P(x + 29, y, K('aka', 0))
    c.R(x + 2, y + 14, 3, 3, K('shiro', 3)); c.P(x + 2, y + 14, K('kii', 3)); c.R(x + 51, y + 14, 3, 3, K('aka', 1)); c.P(x + 53, y + 14, K('aka', 3))
    c.R(x + 1, y + 20, 5, 2, K('tekko', 1)); c.R(x + 50, y + 20, 5, 2, K('tekko', 0)); c.R(x + 22, y + 19, 12, 3, K('shiro', 1)); c.HL(x + 22, y + 19, 12, K('shiro', 3))
    # 바퀴(아치 + 휠)
    for wx in (x + 5, x + 40):
        c.R(wx - 1, y + 17, 14, 7, O); c.R(wx, y + 16, 12, 8, O)
        c.R(wx + 1, y + 18, 10, 6, K('yoru', -3)); c.R(wx + 2, y + 19, 8, 5, K('sumi', 0)); c.R(wx + 4, y + 20, 4, 3, K('tekko', 2)); c.P(wx + 5, y + 21, K('tekko', 3)); c.P(wx + 6, y + 21, K('tekko', 3))
        c.HL(wx + 1, y + 24, 10, O)
    # 지붕 윗면 하이라이트 · 앞 유리 기둥
    c.HL(x + 20, y + 3, 19, K(col, 3)); c.HL(x + 21, y + 4, 17, K(col, 2))

def bicycle(c, x, y):
    O = K('sumi', -1)
    for wx in (x, x + 18):
        for j in range(-6, 7):
            for i in range(-6, 7):
                dd = i * i + j * j
                if 27 <= dd <= 38: c.P(wx + 6 + i, y + 6 + j, O)
                elif dd <= 4: c.P(wx + 6 + i, y + 6 + j, K('tekko', 2))
        for (a, b) in ((0, -4), (0, 4), (-4, 0), (4, 0)): c.P(wx + 6 + a // 2, y + 6 + b // 2, K('tekko', 0))
    fr = K('aka', -1)
    for k in range(9): c.P(x + 6 + k, y + 6 - (k * 5) // 9, fr)
    for k in range(7): c.P(x + 6 + k // 2 * 0 + k, y + 6 - 5, fr) if False else None
    c.HL(x + 10, y + 1, 8, fr); c.VL(x + 10, y + 1, 5, K('aka', -2)); c.HL(x + 18, y + 6, 1, fr)
    for k in range(7): c.P(x + 18 - k, y + 1 + (k * 5) // 7, K('aka', 1))
    c.HL(x + 7, y - 1, 6, O); c.HL(x + 17, y - 1, 4, K('tekko', 2)); c.VL(x + 18, y - 1, 3, K('tekko', 1)); c.P(x + 12, y + 8, K('kii', 1))
    c.R(x + 20, y + 4, 4, 2, K('tekko', 0))                                                    # 바구니 아님: 앞 짐받이
    c.HL(x + 1, y + 13, 14, K('hodo', -2)); c.HL(x + 18, y + 13, 14, K('hodo', -2))

def guardrail(c, x0, x1):
    O = K('sumi', -1)
    for y, h in ((253, 3), (262, 3)):
        c.R(x0, y, x1 - x0, h, K('tekko', 0)); c.HL(x0, y, x1 - x0, K('tekko', 3)); c.HL(x0, y + h - 1, x1 - x0, K('tekko', -2)); c.HL(x0, y + h, x1 - x0, K('conc', -3))
    for x in range(x0 + 4, x1 - 8, 24):                                 # 장식 패널(살대 + 원)
        c.R(x + 3, 256, 16, 6, K('hodo', -1)); c.HL(x + 3, 256, 16, K('hodo', -3))
        for k in range(4): c.VL(x + 5 + k * 4, 256, 6, K('tekko', 2 if k % 2 == 0 else 0)); c.P(x + 5 + k * 4, 256, K('tekko', 3))
        c.R(x + 9, 257, 4, 4, K('tekko', 0)); c.P(x + 10, 258, K('tekko', 3)); c.HL(x + 9, 260, 4, K('tekko', -2))
    for x in range(x0, x1 - 2, 24):                                     # 기둥 + 뚜껑
        c.R(x, 250, 5, 19, K('tekko', 1)); c.VL(x, 250, 19, K('tekko', 3)); c.VL(x + 1, 250, 19, K('tekko', 2)); c.VL(x + 4, 250, 19, K('tekko', -2)); c.VL(x - 1, 251, 18, O)
        c.R(x - 1, 249, 7, 3, K('tekko', 2)); c.HL(x - 1, 249, 7, K('tekko', 3)); c.HL(x - 1, 251, 7, K('tekko', -2))
        c.HL(x - 1, 268, 7, K('conc', -3))
    c.dim(x0, 269, x1 - x0, 1, 1)

# ───────────────────────── 조립 ─────────────────────────
def scene(rnd=0):
    c = Cv(W, H)
    sky(c); road(c); road_extra(c); sidewalk(c)
    building_b(c); restaurant(c)
    building_a(c); convenience(c)
    vsign(c, 232, 66)
    # A 밑 보도 그림자(4px -2 + 2px -1)
    c.dim(A_L, 204, A_SIDE - A_L + 8, 4, 2); c.dim(A_L, 208, A_SIDE - A_L + 8, 2, 1)
    c.dim(B_L, 200, B_R - B_L, 3, 1)
    # 가드레일 · 연석 위 소품
    guardrail(c, 4, 262); guardrail(c, 342, 470)
    tree_pit(c, 96); tree_pit(c, 392)
    bicycle(c, 26, 214)
    tree_p(c, 80, 200); tree_p(c, 376, 200)
    streetlight(c, 236, 140)
    vending_p(c, 420, 184, 'sora'); vending_p(c, 438, 184, 'aka')
    c.dim(420, 210, 34, 3, 2)
    c.dim(146, 238, 22, 4, 1); c.dim(148, 239, 18, 3, 2)
    hero_p(c, 150, 216)
    # 신호등
    signal_p(c, 484, 216)
    # 택시(윗차선)
    car_p(c, 150, 296, 'kii')
    c.dim(150, 320, 58, 3, 2)
    return c

PART_BOX = {'hero': (144, 208, 32, 32), 'street-tree': (72, 192, 48, 64), 'convenience': (16, 152, 224, 64),
            'vending': (416, 176, 48, 48), 'taxi': (144, 288, 64, 48), 'signal': (480, 208, 32, 64),
            'ramen-shop': (256, 144, 112, 64), 'vertical-sign': (224, 64, 32, 64)}  # 16 의 배수(pxgrid 요구)

def to_pxg(im, box, title):
    """완성 장면의 한 영역을 램프 열쇠(@mat/@tblock) .pxg 로 옮겨 적는다(색은 OWNER 역조회, 손대지 않음)."""
    x0, y0, w, h = box
    a = np.array(im)
    keys, legend, rows = {}, {}, []
    for j in range(y0, y0 + h):
        row = ''
        for i in range(x0, x0 + w):
            p = a[j, i]
            if p[3] == 0: row += '.'; continue
            o = OWNER[(int(p[0]) << 16) | (int(p[1]) << 8) | int(p[2])]
            if o not in keys:
                keys[o] = chr(0x100 + len(keys)); legend[keys[o]] = o
            row += keys[o]
        rows.append(row)
    return emit(rows, legend, title)

def write_pxg(c):
    im = c.img(); pd = os.path.join(OUT, 'parts'); os.makedirs(pd, exist_ok=True)
    open(os.path.join(OUT, 'scene.pxg'), 'w', encoding='utf-8').write(to_pxg(im, (0, 0, W, H), 'bakeoff A 16px scene'))
    for n, b in PART_BOX.items():
        open(os.path.join(pd, n + '.pxg'), 'w', encoding='utf-8').write(to_pxg(im, b, 'bakeoff A part ' + n))

def main():
    c = scene()
    os.makedirs(OUT, exist_ok=True)
    c.save(os.path.join(OUT, 'scene.png'))
    im = c.img(); im.resize((W * 3, H * 3), Image.NEAREST).save(os.path.join(OUT, 'scene-x3.png'))
    write_pxg(c)
    print('saved', OUT)

if __name__ == '__main__':
    main()
