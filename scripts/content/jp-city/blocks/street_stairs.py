#!/usr/bin/env python3
"""jp_city 블록 `street_stairs` — 거리 계단 손 도트(육교 곧은 계단·육교 상판·옆 계단 한 쌍·벽 사다리). 계약: ../CONTRACT.md
  python3 scripts/content/jp-city/blocks/street_stairs.py        # selftest + tiledata/jp-city/blocks/street_stairs/*.png (+ _gate/ 관문 사본)

구조만 말로 받아 우리 손으로 그렸다(남의 시트를 보거나 베끼지 않았다). modern3 지원 램프만(K), 윤곽 sumi, 빛 왼쪽 위, 정면 고정 3/4.
높이 문법(이 블록 공통): 육교 상판 = 지면에서 12px 솟은 판. 상판 윗면은 2줄(16..47), 앞면(거더) 48..59, 59 = 윤곽, 60.. 투명(땅).
  - 곧은 계단(2×8): 0줄 = 먼 쪽 난간, 1·2줄 = 층계참(쇠 그레이팅), 3..7줄 = 계단 13단(북으로 오른다). 남쪽 맨 아래 줄로만 들어선다.
    가운데 손잡이가 두 갈래 길을 가른다 → 계단 칸은 위·아래로만 움직인다(옆으로 못 나감). 층계참 한쪽이 상판 쪽으로 트였다(-e: 동, -w: 서).
  - 상판(2×4, 가로 반복): 0줄 북 난간(막힘) · 1·2줄 바닥(걷는다) · 2줄 위에 남 난간 덧그림(★, 사람 뒤로) · 3줄 거더 앞면(막힘).
  - 옆 계단(3×4): 단마다 세로 판, 바깥 끝이 낮고 안쪽(상판 쪽)이 높다. 단 윗면은 높이만큼 위로 올라 그린다(땅 닿는 선 60 이 일정).
    -l = 서쪽 낮은 끝에서 들어서 동쪽으로 오른다(솟은 단의 서쪽 면에 붙는다), -r = 거울(동쪽에서 들어서 서쪽으로).
  - 벽 사다리(1×3): 건물 벽 위 4층(위 덧그림)에 찍는다. 맨 아래 칸으로만 들어서 위·아래로만 움직인다.
칸 통행 방향(dirs)은 굽기가 passability 에 그대로 싣는다(bake_jp.py: 칸 info 의 dirs)."""
import os, sys, json, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
import numpy as np                                        # noqa: E402
from PIL import Image                                     # noqa: E402
from lib_blocks_lines.core import check_cell, ROOT        # noqa: E402
from house_kit import K, OL, Cv                           # noqa: E402

BLOCK = 'street_stairs'
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', BLOCK)
UD = dict(up=True, down=True, left=False, right=False)        # 위·아래로만
ALL = dict(up=True, down=True, left=True, right=True)
P = []

# 높이 문법
DECK_TOP, DECK_BOT, FACE_BOT = 16, 47, 59                     # 상판 윗면 16..47 · 거더 앞면 48..59(59 윤곽)
ELEV = 12


def piece(id_, name, w, h, kind, tags=(), rules='', desc='', repeat=None, role='prop', snap='floor', contract=None, layer4=False):
    """base(c)·top(c) 두 그림 + 칸 통행 표 cells{(x,y): (pc, dirs|None)} 를 돌려주는 함수에 붙인다."""
    def deco(fn):
        P.append(dict(id=id_, name=name, w=w, h=h, kind=kind, make=fn, tags=list(tags), rules=rules, desc=desc, repeat=repeat,
                      role=role, snap=snap, contract=contract, layer4=layer4))
        return fn
    return deco


def rnd(x, y, s=0):
    """좌표 해시(난수 대신, 같은 입력이면 같은 그림)."""
    v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791)
    return (v ^ (v >> 13)) & 0xffff


# ─────────────────────────── 공용 부품 ───────────────────────────
def rail_ns(c, x, y0, y1, end_face=True, mat='tekko', top_cap=False):
    """남북으로 달리는 난간(3px 폭): 바깥 윤곽 · 손스침 윗면(밝음) · 안쪽 그늘. 8px 마다 기둥머리.
    end_face: 남쪽 끝(y1) 12px 는 기둥 앞면(어둡게 세운 면)으로 — 3/4 에서 난간 끝이 땅까지 내려선다."""
    face0 = y1 - 11 if end_face else y1 + 1
    if top_cap:                                                   # 트인 쪽: 난간이 계단 머리에서 시작 — 기둥머리 마개
        c.HL(x, y0 - 1, 3, OL); c.P(x, y0, OL); c.P(x + 1, y0, K('shiro', 2)); c.P(x + 2, y0, K(mat, 2))
        y0 += 1
    for y in range(y0, y1 + 1):
        if y >= face0:
            c.P(x, y, OL); c.P(x + 1, y, K(mat, 0)); c.P(x + 2, y, K(mat, -2))
        else:
            c.P(x, y, OL); c.P(x + 1, y, K(mat, 3)); c.P(x + 2, y, K(mat, 1))
    for y in range(y0 + 3, face0 - 2, 8):                        # 기둥머리(손스침 위 마디)
        c.P(x + 1, y, K('shiro', 2)); c.P(x + 2, y, K(mat, 2)); c.P(x + 2, y + 1, K(mat, -1))
    if end_face:
        c.P(x + 1, face0, K(mat, 3)); c.P(x + 2, face0, K(mat, 1))   # 기둥 머리(손스침 끝 마개)
        c.HL(x, y1, 3, OL)


def rail_ew(c, x0, x1, ybase, mat='tekko', kick=True, post_every=16, post_off=0, dense=False):
    """동서로 달리는 난간(앞에서 본 입면이 아니라 3/4: 손스침은 바닥선에서 12px 위).
    ybase = 난간이 선 바닥선(이 줄에 걸레받이 아랫선). 손스침 ybase-12..-10, 살 ybase-9..-3, 걸레받이 ybase-2..ybase."""
    hy = ybase - 12
    c.HL(x0, hy - 1, x1 - x0 + 1, OL)
    c.HL(x0, hy, x1 - x0 + 1, K(mat, 3)); c.HL(x0, hy + 1, x1 - x0 + 1, K(mat, 1)); c.HL(x0, hy + 2, x1 - x0 + 1, K(mat, -1))
    c.HL(x0, hy + 3, x1 - x0 + 1, OL)
    for x in range(x0, x1 + 1):
        if (x - x0 - post_off) % post_every in (0, 1):            # 기둥(2px, 왼쪽 빛)
            c.VL(x, hy + 4, ybase - hy - 4 - (2 if kick else 0), K(mat, 2) if (x - x0 - post_off) % post_every == 0 else K(mat, -1))
        elif (x % 2 == 0) if dense else (x % 3 == 0):             # 살(dense: 2px 마다 어두운 살 — 앞 난간이 바닥보다 어둡게 읽힌다)
            c.VL(x, hy + 4, ybase - hy - 4 - (2 if kick else 0), K(mat, -1) if dense else K(mat, 0))
    if kick:
        c.HL(x0, ybase - 2, x1 - x0 + 1, K(mat, 1)); c.HL(x0, ybase - 1, x1 - x0 + 1, K(mat, -1)); c.HL(x0, ybase, x1 - x0 + 1, OL)
        for x in range(x0 + 5, x1 + 1, 13): c.P(x, ybase - 1, K('renga', -1))      # 걸레받이 녹 점


def grating(c, x0, y0, x1, y1):
    """쇠 그레이팅 바닥(판): 중간 회색 판 위에 동서로 달리는 받침살 — 3px 마다 어두운 틈 1px · 빛 받은 살 윗면 1px · 살 몸 1px.
    16px 마다 남북 연결살(밝은 1px 띠). 틈에 흙 몇 점. 바닥으로 읽히게 밝은 쪽이 주조, 가장 어두운 색은 틈에만."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            r = (y - y0) % 3
            col = K('tekko', 0) if r == 0 else K('tekko', 3) if r == 1 else K('tekko', 2)
            if x % 16 == 8 and r != 0: col = K('tekko', 1)
            c.P(x, y, col)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if (y - y0) % 3 == 0 and rnd(x, y, 9) % 19 == 0: c.P(x, y, K('soil', 0))   # 틈에 낀 흙
            elif (y - y0) % 3 == 2 and rnd(x, y, 4) % 29 == 0: c.P(x, y, K('tekko', 1))  # 닳은 살


def _lift_row0(base, top):
    """0줄은 위층 그림만 쓴다: 1층 그림의 0줄을 위층 밑에 깔아 합치고 1층 0줄은 비운다."""
    b0 = Image.fromarray(base.a[0:16].copy(), 'RGBA'); b0.alpha_composite(Image.fromarray(top.a[0:16].copy(), 'RGBA'))
    top.a[0:16] = np.array(b0); base.a[0:16] = 0


def tactile(c, x0, y0, w):
    """점형 경고 블록 띠(3줄): 호박색 바탕 + 돋은 점(빛 왼쪽 위)."""
    c.R(x0, y0, w, 3, K('mado', 0)); c.HL(x0, y0 + 2, w, K('mado', -1))
    for x in range(x0 + 1, x0 + w - 1, 3):
        c.P(x, y0, K('mado', 2)); c.P(x, y0 + 1, K('mado', -2))


# ─────────────────────────── 1) 곧은 계단(육교) 2×8 ───────────────────────────
LANES = ((3, 13), (18, 28))                                       # 두 갈래 길(양끝 포함)
STEP_TOP, STEP_BOT, NSTEP = 48, 127, 13


def step_bounds():
    """13단의 [위, 아래] (아래가 남·가까운 단부터). 단 높이 6~7px."""
    b = [128 - round(k * 80 / NSTEP) for k in range(NSTEP + 1)]
    return [(b[k + 1], b[k] - 1) for k in range(NSTEP)]


def stair_flight(c):
    """13단 계단 몸(두 갈래). 단마다 아래 2줄 챌판(남향 앞면, 어둡게) + 디딤판 윗면(앞 모서리 밝은 코, 미끄럼막이 줄, 뒤쪽 그늘)."""
    for k, (top, bot) in enumerate(step_bounds()):
        far = 1 if k < 3 else 0                                   # 맨 아래(가까운) 3단은 한 단 어둡게 — 위로 갈수록 밝아 오르는 쪽이 읽힌다
        for (lx0, lx1) in LANES:
            c.R(lx0, bot - 1, lx1 - lx0 + 1, 2, K('conc', -1 - far))           # 챌판
            c.HL(lx0, bot, lx1 - lx0 + 1, K('conc', -2 - far))                  # 챌판 밑(그늘)
            c.HL(lx0, bot - 2, lx1 - lx0 + 1, K('conc', 3 - far))               # 디딤 코(빛)
            for y in range(top, bot - 2):
                c.HL(lx0, y, lx1 - lx0 + 1, K('conc', 2 - far) if y > top else K('conc', 0 - far))
            for x in range(lx0 + 1, lx1, 2): c.P(x, bot - 3, K('conc', 0 - far))        # 미끄럼막이 홈
            mid = (lx0 + lx1) // 2                                # 닳은 가운데(발자국 얼룩)
            for dx in (-2, -1, 0, 1, 2):
                if rnd(mid + dx, top + k, 5) % 3 == 0 and bot - 3 > top: c.P(mid + dx, top + 1 + (rnd(dx, k) % max(1, bot - 4 - top)), K('conc', 1 - far))
            c.P(lx0, bot - 2, K('conc', 2 - far)); c.P(lx1, bot - 2, K('conc', 1 - far))
    # 맨 아래 디딤 코 = 호박색 미끄럼막이(남쪽에서 첫 단이 보인다)
    t0, b0 = step_bounds()[0]
    for (lx0, lx1) in LANES: c.HL(lx0, b0 - 3, lx1 - lx0 + 1, K('mado', 2)); c.HL(lx0, b0 - 2, lx1 - lx0 + 1, K('mado', 0))
    c.HL(3, STEP_BOT, 26, OL)                                      # 땅 닿는 선


def center_rail(c, y0, y1):
    """가운데 손잡이(관): x14 그늘 · 15 빛 · 16 몸 · 17 윤곽. 16px 마다 기둥. 남쪽 끝 12px 은 기둥 앞면."""
    face0 = y1 - 11
    for y in range(y0, y1 + 1):
        if y >= face0:
            c.P(14, y, OL); c.P(15, y, K('tekko', 1)); c.P(16, y, K('tekko', -1)); c.P(17, y, OL)
        else:
            c.P(14, y, K('tekko', -2)); c.P(15, y, K('tekko', 3)); c.P(16, y, K('tekko', 0)); c.P(17, y, OL)
    for y in range(y0 + 6, face0 - 2, 16):
        c.P(15, y, K('shiro', 2)); c.P(16, y, K('tekko', 2)); c.P(16, y + 1, K('tekko', -2))
    c.P(15, face0, K('shiro', 2)); c.P(16, face0, K('tekko', 2)); c.HL(14, y1, 4, OL)
    c.P(16, y1 - 4, K('renga', -1)); c.P(15, y1 - 2, K('renga', 0))                     # 기둥 밑 녹


def landing_floor(c, open_side):
    """층계참(1·2줄 + 0줄 아래 3px): 쇠 그레이팅 + 테두리 앵글 + 계단 머리 경고 블록."""
    x0 = 0 if open_side == 'w' else 3
    x1 = 31 if open_side == 'e' else 28
    grating(c, x0, 13, x1, 47)
    c.HL(x0, 46, x1 - x0 + 1, K('tekko', 2)); c.HL(x0, 47, x1 - x0 + 1, K('tekko', -1))   # 계단 머리 앵글(코)
    for (lx0, lx1) in LANES: tactile(c, lx0, 41, lx1 - lx0 + 1)


def overpass_stair(open_side):
    def make():
        base, top = Cv(32, 128), Cv(32, 128)
        landing_floor(base, open_side)
        stair_flight(base)
        center_rail(base, 40, STEP_BOT)
        # 옆 난간: 막힌 쪽은 0줄부터, 트인 쪽은 계단(3줄)부터.
        rail_ns(base, 0, 2 if open_side != 'w' else 48, STEP_BOT, top_cap=open_side == 'w')
        rail_ns(base, 29, 2 if open_side != 'e' else 48, STEP_BOT, top_cap=open_side == 'e')
        # 0줄 먼 쪽 난간(위층, 막힘): 바닥선 14. 막힌 쪽 귀퉁이까지, 트인 쪽은 칸 끝까지.
        rx0 = 0 if open_side == 'w' else 3
        rx1 = 31 if open_side == 'e' else 28
        grating(top, rx0, 13, rx1, 15)
        rail_ew(top, rx0, rx1, 14, post_off=(0 if open_side == 'w' else 13))
        _lift_row0(base, top)
        cells = {}
        for x in range(2):
            cells[(x, 0)] = ('solid', None)
            for y in (1, 2):                                      # 층계참: 막힌 쪽 옆으로 못 나감
                d = dict(ALL)
                if x == 0 and open_side != 'w': d['left'] = False
                if x == 1 and open_side != 'e': d['right'] = False
                if x == 0 and open_side == 'e': pass
                cells[(x, y)] = ('floor', d)
            for y in range(3, 8): cells[(x, y)] = ('floor', dict(UD))
        return base, top, cells
    return make


for side, ko, sx in (('e', '동', 2), ('w', '서', -1)):
    piece('overpass-stair-' + side, f'육교 계단(곧은 계단 13단·층계참, 상판은 {ko}쪽)', 2, 8, 'structure',
          tags=['육교', '계단', '歩道橋', '층계참', '난간', '역'], role='prop', snap='floor',
          desc=f'남쪽에서 북으로 오르는 2칸 폭 육교 계단: 가운데 손잡이로 두 갈래, 13단, 양옆 난간, 꼭대기 2×3 층계참(쇠 그레이팅, 먼 쪽 난간). 층계참 {ko}쪽이 트여 육교 상판(jp-overpass-deck-*)과 이어진다.',
          rules=f'맨 아래 줄(7줄) 바로 남쪽 두 칸이 들어서는 바닥이다(비워 둔다). 계단 칸은 위·아래로만 걷는다(옆 난간·가운데 손잡이). '
                f'층계참 {ko}쪽 칸에 상판 키트(jp-overpass-deck-red/green, 2×4)를 같은 윗줄(0줄)에 맞춰 이어 붙인다. 반대쪽 끝에는 거울 계단(jp-overpass-stair-{"w" if side == "e" else "e"})을 붙여 육교를 완성한다. '
                f'같은 맵 안에서 오르내린다(층 이동 이벤트 없음). 상판·층계참 밑으로는 지나갈 수 없다(밑 도로는 끊긴다).',
          contract=dict(leads='same', side='S', mode='walk', trigger=[], approach=[[0, 8], [1, 8]], exit=[[sx, 1], [sx, 2]],
                        why=f'육교 곧은 계단 — 남쪽 맨 아래 두 칸으로 들어서 층계참({ko}쪽 상판)으로 이어진다'))(overpass_stair(side))


# ─────────────────────────── 2) 육교 상판 2×4 (가로 반복) ───────────────────────────
DECK_MAT = {'red': 'kawara', 'green': 'kokuban'}


def deck_floor(c, mat):
    """상판 바닥 13..47: 칠한 강판 바닥. 4px 격자 미끄럼막이 돌기(왼쪽 위 빛) · 가운데 걷는 길이 바래 밝다 · 북쪽 난간 밑 그늘 · 32px 마다 신축 이음 · 남쪽 콘크리트 턱."""
    b = 0 if mat == 'kawara' else 1
    for y in range(13, 48):
        worn = 24 <= y <= 38
        for x in range(32):
            col = K(mat, b + (1 if worn and rnd(x, y, 17) % 7 == 0 else 0))
            if (x % 4, y % 4) == (1, 1): col = K(mat, b + 1)          # 돌기 윗면
            elif (x % 4, y % 4) == (2, 2) and not worn: col = K(mat, b - 1)   # 돌기 그늘(닳은 길은 지워짐)
            c.P(x, y, col)
    c.HL(0, 13, 32, K(mat, b - 2)); c.HL(0, 14, 32, K(mat, b - 2)); c.HL(0, 15, 32, K(mat, b - 1))   # 북 난간 밑 그늘
    for x, y in ((9, 27), (23, 33), (14, 36)): c.P(x, y, K(mat, b - 2)); c.P(x + 1, y, K(mat, b - 1))   # 긁힘
    c.HL(0, 44, 32, K(mat, b - 1)); c.HL(0, 45, 32, K('conc', 2)); c.HL(0, 46, 32, K('conc', 1)); c.HL(0, 47, 32, OL)   # 남쪽 턱 + 바닥 끝 윤곽


def girder(c, y0=48):
    """상판 앞면: 갓 입술(밝음) → 거더 웹(중간 회색 강판, 8px 마다 어두운 세로 보강재·볼트 줄) → 아래 플랜지 그늘 → 윤곽(57).
    그 밑 2px 은 비워(상판 밑 허공으로 땅이 보인다) 60..62 에 땅에 진 상판 그늘 띠."""
    c.HL(0, y0, 32, K('conc', 2)); c.HL(0, y0 + 1, 32, K('conc', 0))
    for y in range(y0 + 2, y0 + 8):
        c.HL(0, y, 32, K('tekko', 2) if y == y0 + 2 else K('tekko', 1) if y < y0 + 6 else K('tekko', 0))
    for x in range(4, 32, 8):                                     # 세로 보강재(왼쪽 빛·오른쪽 그늘)
        c.VL(x, y0 + 2, 6, K('tekko', 3)); c.VL(x + 1, y0 + 2, 6, K('tekko', -1))
    for x in range(1, 32, 4): c.P(x, y0 + 3, K('tekko', 0))       # 볼트 줄
    c.P(19, y0 + 5, K('renga', -1)); c.P(19, y0 + 6, K('renga', -2))   # 녹물 한 점
    c.HL(0, y0 + 8, 32, K('tekko', -2)); c.HL(0, y0 + 9, 32, OL)
    c.HL(0, 60, 32, K('yoru', -2)); c.HL(0, 61, 32, K('yoru', -3)); c.HL(0, 62, 32, K('yoru', -2))   # 땅에 진 상판 그늘(2px 떨어져)


def deck(var):
    def make():
        mat = DECK_MAT[var]
        base, top = Cv(32, 64), Cv(32, 64)
        deck_floor(base, mat)
        # 0줄(북 난간 + 바닥 3px)은 위층으로
        rail_ew(top, 0, 31, 14, post_off=3)
        _lift_row0(base, top)
        # 2줄 남 난간(★, 사람 뒤로): 바닥선 47, 살이 촘촘하고 어둡다
        rail_ew(top, 0, 31, 47, post_off=3, dense=True)
        girder(top)
        cells = {}
        for x in range(2):
            cells[(x, 0)] = ('solid', None)
            cells[(x, 1)] = ('floor', dict(ALL))
            cells[(x, 2)] = ('floor', dict(ALL))                  # 1층 바닥(걷는다)
            cells[(x, 3)] = ('solid', None)
        return base, top, cells, {(x, 2): 'star' for x in range(2)}
    return make


for var, ko in (('red', '붉은 갈색'), ('green', '녹색')):
    piece('overpass-deck-' + var, f'육교 상판({ko} 바닥, 2×4 가로 반복)', 2, 4, 'structure', repeat='x', role='prop',
          tags=['육교', '상판', '歩道橋', '다리', '난간'],
          desc=f'육교 상판 한 마디: 북쪽 난간 · {ko} 미끄럼막이 바닥 2줄 · 남쪽 난간(사람 뒤로 지나감) · 앞면 거더. 지면에서 솟은 다리 위 길.',
          rules='육교 계단(jp-overpass-stair-e)의 층계참 동쪽 칸에서 시작해 같은 윗줄(0줄)로 가로로 이어 붙이고, 끝에 거울 계단(jp-overpass-stair-w) 또는 옆 계단(jp-side-stair-r)을 붙인다. '
                '1·2줄을 걷는다. 0줄(북 난간)·3줄(거더)은 막힘. 밑(도로)으로는 지나갈 수 없다 — 육교가 지나는 열은 차도가 끊긴다.')(deck(var))


# ─────────────────────────── 3) 옆 계단 한 쌍 3×4 ───────────────────────────
NS = 6                                                            # 단 수(8px 폭)


SIDE_E = (3, 6, 8, 11, 14, 16)                                   # 단 높이(px) — 맨 안쪽 = 단상·상판 높이 16


def side_stair(hand):
    """옆 계단 3×2(단상 jp-stage-platform 의 2·3줄과 같은 줄): 0줄 = 걷는 줄(동서로만), 1줄 = 단 앞면(막힘).
    hand 'l': 서쪽 바깥 끝이 낮고 동쪽(안쪽)으로 오른다. 'r': 거울(빛은 그대로 왼쪽 위).
    단 i(바깥 0 → 안쪽 5) 높이 e: 디딤 윗면 4px 띠(뒤 모서리 → 밝은 판 → 앞 코), 그 밑 1px 코 그늘 + 앞면(남향 그늘)이 땅(31)까지.
    맨 안쪽 단의 디딤 띠 아랫줄 = 단상 바닥 남쪽 끝(15), 앞면 16..30 = 단상 앞면과 같은 높이. 북쪽 모서리에 기둥 선 경사 손스침."""
    def make():
        c = Cv(48, 32)
        L = hand == 'l'
        band_top = {}
        for i, e in enumerate(SIDE_E):
            x_lo = i * 8 if L else 40 - i * 8
            bb = 15 + 16 - e                                       # 디딤 띠 아랫줄(앞 코)
            bt = bb - 3
            band_top[i] = bt
            for x in range(x_lo, x_lo + 8):
                c.P(x, bt, K('conc', 0)); c.P(x, bt + 1, K('conc', 2)); c.P(x, bt + 2, K('conc', 2)); c.P(x, bb, K('conc', 3))
                for y in range(bb + 1, 31):
                    col = K('conc', -3) if y == bb + 1 else K('conc', -1) if y < bb + 4 else K('conc', -2)
                    if rnd(x, y, 41) % 17 == 0: col = K('conc', -3)
                    c.P(x, y, col)
                c.P(x, 31, OL)
            for x in range(x_lo + 1, x_lo + 7, 2): c.P(x, bt + 1, K('conc', 1))          # 미끄럼막이 홈
            mx = x_lo + 3 + (i % 2)                                  # 닳은 자국(발 딛는 곳)
            c.P(mx, bt + 2, K('conc', 3))
            if i == 0:                                               # 바깥 첫 단 = 들어서는 곳: 노란 코 2줄
                for x in range(x_lo, x_lo + 8): c.P(x, bb - 1, K('mado', 2)); c.P(x, bb, K('mado', 0))
            if i > 0:                                                # 챌판: 높은 단의 낮은 쪽 세로 모서리(빛 쪽 L 은 밝게, 그늘 쪽 R 은 어둡게)
                ex = x_lo if L else x_lo + 7
                for y in range(bt, band_top[i - 1]):
                    c.P(ex, y, K('conc', 1) if L else K('conc', -2))
                c.P(ex, bt, OL)
            c.HL(x_lo, bt - 1, 8, OL)                                # 뒤(북) 모서리 윤곽
        ox = 0 if L else 47
        for y in range(band_top[0] + 4, 31): c.P(ox, y, OL)          # 바깥 끝: 앞면만 윤곽(디딤 띠는 열어 둔다 — 들어서는 쪽)
        ix = 47 if L else 0                                          # 안쪽 끝(단상과 붙는 쪽) 윤곽 없음
        # 북쪽 경사 손스침: 바깥 끝 15 → 안쪽 끝 2(단상 손스침 높이), 단마다 기둥
        def hy(x):
            t = x / 47 if L else (47 - x) / 47
            return round(15 - 13 * t)
        for x in range(48):
            y = hy(x)
            c.P(x, y - 1, OL); c.P(x, y, K('tekko', 3)); c.P(x, y + 1, K('tekko', 0)); c.P(x, y + 2, OL)
        for i in range(len(SIDE_E)):
            px = i * 8 + 3 if L else 44 - i * 8
            for y in range(hy(px) + 3, band_top[i] - 1):
                c.P(px, y, K('tekko', 2)); c.P(px + 1, y, K('tekko', -1))
            c.P(px, band_top[i] - 1, OL); c.P(px + 1, band_top[i] - 1, OL)
        LR = dict(up=False, down=False, left=True, right=True)
        cells = {}
        for x in range(3):
            cells[(x, 0)] = ('flat', dict(LR))
            cells[(x, 1)] = ('solid', None)
        return None, c, cells
    return make


for hand, ko, side, ap, ex in (('l', '왼쪽(서쪽에서 들어서 동쪽으로 오름)', 'W', [[-1, 0]], [[3, 0]]),
                               ('r', '오른쪽(동쪽에서 들어서 서쪽으로 오름)', 'E', [[3, 0]], [[-1, 0]])):
    low, high = ('서', '동') if hand == 'l' else ('동', '서')
    piece('side-stair-' + hand, f'옆 계단 {ko}', 3, 2, 'structure', role='prop',
          tags=['계단', '옆 계단', '단', '무대', '단상', '콘크리트'],
          desc=f'옆에서 오르는 콘크리트 계단 6단: 단마다 밝은 디딤 띠 + 그 밑 어두운 앞면, {low}쪽 바깥 끝이 낮고 {high}쪽 안쪽으로 높아진다(맨 안쪽 단 = 단상 높이). 북쪽 모서리에 경사 손스침, 맨 바깥 단 코는 노랑.',
          rules=f'단상(jp-stage-platform, 2×4)의 {low}쪽 끝에 붙인다: 키트 0줄 = 단상 2줄(남쪽 바닥 줄), 키트 1줄 = 단상 3줄(앞면). {high}쪽 끝이 단상에 닿는다. '
                f'0줄 {low}쪽 바깥 한 칸이 들어서는 바닥이다. 0줄은 {low}↔{high}로만 걷는다(남북으로 못 나간다). 1줄(앞면)은 막힘. '
                f'짝(jp-side-stair-{"r" if hand == "l" else "l"})을 반대쪽 끝에 붙이면 양쪽에서 오르는 단상이 된다.',
          contract=dict(leads='same', side=side, mode='walk', trigger=[], approach=ap, exit=ex,
                        why=f'옆 계단 — {low}쪽 낮은 끝으로 들어서 {high}쪽 단상으로 오른다'))(side_stair(hand))


# ─────────────────────────── 3b) 단상 2×4 (가로 반복) ───────────────────────────
def stage():
    """단상(솟은 마당·무대): 0줄 북 난간(막힘) · 1·2줄 나무 마루 바닥(걷는다) · 3줄 옹벽 앞면(막힘, 높이 16 — 옆 계단 맨 안쪽 단과 같다)."""
    def make():
        base, top = Cv(32, 64), Cv(32, 64)
        for y in range(13, 48):                                   # 나무 마루: 동서로 달리는 널(4px: 빛 1 · 몸 2 · 틈 1), 널 끝 이음은 엇갈림
            r = (y - 13) % 4; row = (y - 13) // 4
            for x in range(32):
                col = K('ita', 2) if r == 0 else K('ita', 1) if r < 3 else K('ita', -2)
                if r != 3 and (x + row * 11) % 24 == 0: col = K('ita', -1)        # 널 이음
                elif r in (1, 2) and rnd(x, y, 51) % 11 == 0: col = K('ita', 0)   # 나뭇결
                base.P(x, y, col)
        for x, y in ((5, 26), (21, 34), (13, 41)): base.P(x, y, K('ita', -2)); base.P(x + 1, y, K('ita', 0))   # 못 자국
        base.HL(0, 13, 32, K('ita', -3)); base.HL(0, 14, 32, K('ita', -2))   # 북 난간 밑 그늘
        base.HL(0, 46, 32, K('conc', 3)); base.HL(0, 47, 32, K('conc', 2))     # 앞 갓돌(밝음)
        rail_ew(top, 0, 31, 14, post_off=3)
        _lift_row0(base, top)
        for y in range(48, 63):                                   # 옹벽 앞면: 콘크리트 블록(16×5 엇갈림), 아래로 어둡게, 물 자국
            row = (y - 48) // 5
            for x in range(32):
                xx = (x + (8 if row % 2 else 0)) % 16
                col = K('conc', -1) if y < 53 else K('conc', -2)
                if (y - 48) % 5 == 4 or xx == 15: col = K('conc', -3)
                elif (y - 48) % 5 == 0 and y > 48: col = K('conc', 0) if y < 53 else K('conc', -1)
                top.P(x, y, col)
        top.HL(0, 48, 32, K('conc', -3))                          # 갓돌 밑 그늘
        for x, y0 in ((6, 50), (23, 54)):
            for j in range(4): top.P(x, y0 + j, K('yoru', 0))      # 물 자국
        top.HL(0, 63, 32, OL)
        cells = {}
        for x in range(2):
            cells[(x, 0)] = ('solid', None)
            cells[(x, 1)] = ('floor', dict(ALL))
            cells[(x, 2)] = ('floor', dict(ALL))
            cells[(x, 3)] = ('solid', None)
        return base, top, cells
    return make


piece('stage-platform', '단상(솟은 마당·무대, 2×4 가로 반복)', 2, 4, 'structure', repeat='x', role='prop',
      tags=['단', '단상', '무대', '광장', '옹벽', '콘크리트'],
      desc='지면에서 한 칸 높이 솟은 단상(무대): 북쪽 난간 · 나무 마루 바닥 2줄 · 앞면 콘크리트 옹벽(블록 줄눈). 옆 계단 한 쌍(jp-side-stair-l/r)으로 오른다.',
      rules='가로로 이어 붙인다. 서쪽 끝에 jp-side-stair-l, 동쪽 끝에 jp-side-stair-r 을 키트 0줄 = 단상 2줄로 맞춰 붙인다. 1·2줄을 걷는다. 0줄(난간)·3줄(옹벽)은 막힘.')(stage())


# ─────────────────────────── 4) 벽 사다리 1×3 ───────────────────────────
def ladder():
    def make():
        c = Cv(16, 48)
        for x0 in (3, 11):                                        # 옆 레일: 바깥 윤곽 · 빛 1px · 짙은 몸 (기존 터널 사다리처럼 짙게)
            for y in range(1, 46):
                c.P(x0 - 1, y, OL); c.P(x0, y, K('tekko', 1)); c.P(x0 + 1, y, K('tekko', -2)); c.P(x0 + 2, y, OL)
                if y % 3 == 0: c.P(x0 + 2, y + 1, K('yoru', -1))     # 벽에 진 레일 그림자(점선, 오른쪽 아래)
        for x in range(2, 14): c.P(x, 0, OL)                       # 꼭대기 굽은 손잡이(지붕 난간 너머로)
        c.HL(3, 1, 10, K('tekko', 2)); c.HL(4, 2, 8, K('tekko', -1))
        for y in range(6, 41, 5):                                  # 디딤봉: 위 빛 · 아래 그늘, 사이는 비워 벽이 보인다
            c.HL(5, y, 6, K('tekko', 3)); c.HL(5, y + 1, 6, K('tekko', -1))
            c.P(7, y, K('shiro', 2))                               # 닳아 반짝이는 가운데
            c.HL(6, y + 2, 5, K('yoru', -1))                       # 벽에 진 디딤봉 그림자
        for y in (12, 28):                                         # 벽 받침쇠
            for x0 in (1, 14): c.P(x0, y, K('tekko', 1)); c.P(x0, y + 1, OL)
        for x, y in ((3, 20), (12, 34), (11, 15)): c.P(x, y, K('renga', -1))      # 녹
        for y in (43, 44):                                         # 발 받침판 = 노랑·검정 빗금 띠(2줄)
            for x in range(2, 14): c.P(x, y, K('mado', 2) if ((x + y) // 2) % 2 == 0 else K('sumi', 1))
        c.HL(2, 45, 12, K('tekko', -2)); c.HL(2, 46, 12, OL)
        c.HL(1, 47, 14, K('yoru', -2))
        cells = {(0, 0): ('flat', dict(UD)), (0, 1): ('flat', dict(UD)), (0, 2): ('flat', dict(UD))}
        return None, c, cells
    return make


piece('wall-ladder', '벽 사다리(쇠, 1×3)', 1, 3, 'wall_mounted', role='prop', snap='wall', layer4=True,
      tags=['사다리', '벽', '옥상', '쇠', '점검'],
      desc='건물 벽에 붙인 쇠 사다리: 두 레일·디딤봉 8개·벽 받침쇠, 꼭대기는 지붕 난간 위로 굽은 손잡이, 발밑에 노랑·검정 경고 띠.',
      rules='건물 남쪽 벽 위에 4층(위 덧그림)으로 찍는다(3층에 찍으면 벽 그림을 지운다). 맨 아래 칸이 지면 줄(건물 맨 아래 줄)이고 그 바로 남쪽 칸이 들어서는 바닥이다. '
            '사다리 칸은 위·아래로만 움직인다. 옥상 맵으로 가는 이동 이벤트는 맨 아래 칸에.',
      contract=dict(leads='up', side='S', mode='walk', trigger=[[0, 2]], approach=[[0, 3]],
                    why='벽 사다리 — 맨 아래 칸으로만 들어서 위(옥상)로'))(ladder())


# ─────────────────────────── 칸 자르기 · 키트 ───────────────────────────
_CACHE = {}


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; sprites = {}
    for p in P:
        out = p['make']()
        base, top, spec = out[0], out[1], out[2]
        top_pc = out[3] if len(out) > 3 else {}
        R, C = p['h'], p['w']
        grid = [[None] * C for _ in range(R)]
        bgrid = [[None] * C for _ in range(R)] if base is not None else None

        def put(t, pc, dirs, cx, cy, layer):
            t = t.copy(); t[t[:, :, 3] == 0] = 0
            key = (t.tobytes(), pc, json.dumps(dirs, sort_keys=True) if dirs else '')
            if key in seen: return seen[key]
            local = '%s/%s%d.%d' % (p['id'], 'g' if layer == 'base' else '', cx, cy)
            info = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s 칸 (%d,%d)' % (p['name'], cx, cy),
                        desc='[거리 계단] %s 의 일부. 키트 jp-%s 로 통째로 놓는다.' % (p['name'], p['id']), tags=list(p['tags']))
            if dirs and dirs != ALL: info['dirs'] = dict(dirs)
            cells[local] = info; seen[key] = local
            return local

        for cy in range(R):
            for cx in range(C):
                pc, dirs = spec[(cx, cy)]
                if base is not None:
                    tb = base.a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
                    if tb[:, :, 3].any():
                        assert tb[:, :, 3].all(), ('1층 칸은 불투명이어야 한다', p['id'], cx, cy)
                        bgrid[cy][cx] = put(tb, 'floor', dirs, cx, cy, 'base')
                tt = top.a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16]
                if tt[:, :, 3].any():
                    tpc = top_pc.get((cx, cy), pc if pc != 'floor' else 'star')
                    grid[cy][cx] = put(tt, tpc, dirs if tpc in ('flat',) else None, cx, cy, 'top')
                elif bgrid is None or bgrid[cy][cx] is None:
                    raise AssertionError(('빈 칸', p['id'], cx, cy))
        spr = Cv(C * 16, R * 16)
        if base is not None: spr.a[:] = base.a
        im = Image.fromarray(spr.a, 'RGBA'); im.alpha_composite(Image.fromarray(top.a, 'RGBA')); sprites[p['id']] = np.array(im)
        ai = dict(snap=p['snap'], tags=list(p['tags']), description=p['desc'] + ' 손 도트(modern3, 빛 왼쪽 위, 정면 고정 3/4).',
                  placementRules=p['rules'], repeatability='repeat' if p['repeat'] else 'fixed', growthAxis=p['repeat'],
                  anchor=dict(dx=0, dy=R - 1), access=[], role=p['role'])
        kit = dict(id='jp-' + p['id'], name=p['name'], grid=grid, parts=[], ai=ai)
        if bgrid is not None: kit['base'] = bgrid
        kits.append(kit)
    groups = [dict(id='jp:street-stairs', name='거리 계단(육교·옆 계단·벽 사다리)', role='prop', defaultLayer='upper',
                   cells=list(cells.keys()), desc='육교 곧은 계단·상판·옆 계단 한 쌍·벽 사다리의 칸. 낱칸으로 칠하지 않는다.',
                   rules='키트(jp-overpass-*·jp-side-stair-*·jp-wall-ladder)로 통째로 찍는다.')]
    _CACHE['r'] = (cells, groups, kits, sprites)
    return _CACHE['r']


NOTES = ('거리 계단 %d키트: 육교 곧은 계단(-e/-w, 2×8) + 상판(붉은 갈색·녹색, 2×4 가로 반복) + 옆 계단 한 쌍(-l/-r, 3×4) + 벽 사다리(1×3, 4층). '
         '높이 문법: 상판 = 지면에서 12px, 윗면 2줄 + 거더 앞면 1줄. 계단 칸은 위·아래로만(dirs), 옆 계단 1·2줄은 투명 덧그림(flat). '
         '한계: 육교 밑 통행 없음(차도가 끊긴다) · 그림자는 땅 칸에 따로 없다.')


def build():
    cells, groups, kits, _ = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': groups, 'kits': kits, 'notes': NOTES % len(kits)}


def kinds():
    """object-gate 종류(키트 id → kind)."""
    return {'jp-' + p['id']: p['kind'] for p in P}


def contracts():
    """계단 입구 계약 덮어쓰기(tiledata/stairs/overrides.json 의 jp_city 항목 정본)."""
    return {'jp-' + p['id']: p['contract'] for p in P if p.get('contract')}


def kit_image(kid, bg=None):
    cells, groups, kits, sprites = _finalize()
    a = sprites[kid[3:] if kid.startswith('jp-') else kid]
    im = Image.fromarray(a, 'RGBA')
    if bg is None: return im
    out = Image.new('RGBA', im.size, bg); out.alpha_composite(im); return out


def render_all():
    os.makedirs(os.path.join(OUTDIR, '_gate'), exist_ok=True)
    cells, groups, kits, sprites = _finalize()
    for p in P:
        im = Image.fromarray(sprites[p['id']], 'RGBA')
        im.save(os.path.join(OUTDIR, '_gate', 'jp-' + p['id'] + '.png'))          # 관문 사본(투명 배경)
        bg = Image.new('RGBA', im.size, (104, 103, 122, 255)); bg.alpha_composite(im)
        bg.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(OUTDIR, 'jp-%s-x4.png' % p['id']))
    json.dump(kinds(), open(os.path.join(OUTDIR, '_gate', 'kinds.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return len(P)


def selftest():
    cells, groups, kits, sprites = _finalize()
    out = []
    for k, c in cells.items():
        for m in check_cell(c['img']): out.append('(a) %s: %s' % (k, m))
        if c['pc'] not in ('floor', 'flat', 'solid', 'star'): out.append('(a) %s: pc %s' % (k, c['pc']))
        if c['pc'] in ('floor',) and not np.array(c['img'])[:, :, 3].all(): out.append('(a) %s: floor 인데 투명' % k)
    ids = [k['id'] for k in kits]
    if len(ids) != len(set(ids)): out.append('(e) kit id 중복')
    n = render_all()
    for m in out: print(m)
    print('%s: kits %d, cells %d, png %d, 실패 %d' % (BLOCK, len(kits), len(cells), n, len(out)))
    return len(out)


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
