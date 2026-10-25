#!/usr/bin/env python3
"""jp_city 블록 `street_stairs` — 거리 계단 손 도트(육교 곧은 계단·육교 상판·옆 계단 한 쌍·단상·벽 사다리). 계약: ../CONTRACT.md
  python3 scripts/content/jp-city/blocks/street_stairs.py        # selftest + tiledata/jp-city/blocks/street_stairs/*.png (+ _gate/ 관문 사본·조립 그림)

우리 손으로 그렸다. 사용자가 보여 준 상용 견본(워터마크)은 구조(비례·디딤/챌판 명암·난간 짜임·쇠망 층계참)만 참고했고 화소·색은 쓰지 않았다.
modern3 지원 램프만(K), 윤곽 sumi, 빛 왼쪽 위, 정면 고정 3/4.
  - 곧은 계단(2×8): 0줄 = 먼 쪽 난간, 1·2줄 = 층계참(마름모 쇠망), 3..7줄 = 계단 13단(북으로 오른다). 남쪽 맨 아래 줄로만 들어선다.
    가운데 손잡이가 두 갈래 길을 가른다 → 계단 칸은 위·아래로만 움직인다. 층계참 한쪽이 상판 쪽으로 트였다(-e: 동, -w: 서).
  - 상판(2×6, 가로 반복): 0줄 북 난간(막힘) · 1·2줄 바닥(동서로 걷는다, 2줄에서 남쪽으로 못 내려선다) · 2줄 위 남 난간 덧그림 · 3줄 거더 · 4·5줄 쇠 기둥과 도로 그늘(덧그림, 밑 칸은 걷는다).
  - 옆 계단(3×2): 콘크리트 판 4단(폭 12px), 디딤 면 깊이는 같고 판 전체가 단 높이(4·8·12·16px)만큼 올라선다. 0줄 = 걷는 줄(동서로만), 1줄 = 앞면(막힘).
    -l = 서쪽 낮은 끝에서 들어서 동쪽으로 오른다, -r = 거울(동쪽에서 들어서 서쪽으로). 단상(2×4) 2줄에 붙는다.
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
    face0 = y1 - 5 if end_face else y1 + 1
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
        elif (x % 3 == 0):                                        # 살(쇠 회색, dense 는 앞 난간이라 한 단계 밝게)
            c.VL(x, hy + 4, ybase - hy - 4 - (2 if kick else 0), K(mat, 1) if dense else K(mat, 0))
    if kick:
        c.HL(x0, ybase - 2, x1 - x0 + 1, K(mat, 1)); c.HL(x0, ybase - 1, x1 - x0 + 1, K(mat, -1)); c.HL(x0, ybase, x1 - x0 + 1, OL)
        for x in range(x0 + 5, x1 + 1, 13): c.P(x, ybase - 1, K('renga', -1))      # 걸레받이 녹 점


def grating(c, x0, y0, x1, y1):
    """층계참 쇠 망 바닥: 어두운 판 위에 마름모 격자(6px 주기 대각 살, 빛 받은 살 윗면). 살 교차점은 한 단계 더 밝다.
    가장 어두운 색은 마름모 속 구멍에만 — 밑이 빈 쇠망으로 읽힌다. 틈에 흙 몇 점."""
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            a_, b_ = (x + y) % 6 == 0, (x - y) % 6 == 0
            u = (x + y) % 6 == 1 or (x - y) % 6 == 1                  # 살 바로 아래(남) = 살 그늘
            col = K('conc', 2) if a_ and b_ else K('tekko', 3) if a_ else K('tekko', 2) if b_ else K('tekko', -1) if u else K('tekko', 0)
            c.P(x, y, col)
            if not (a_ or b_) and rnd(x, y, 9) % 173 == 0: c.P(x, y, K('soil', 0))


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
    """13단 계단 몸(두 갈래). 한 단(6~7px) = 위에서 아래로: 디딤판 윗면(밝은 따뜻한 회색, 뒤 1px 은 한 단계 어둡게) · 흰 디딤 코 1px · 어두운 챌판 2px.
    밝은 디딤판과 어두운 챌판이 1배에서도 줄무늬로 갈려 '단'이 선다. 바깥 옆판(왼쪽)·가운데 손잡이가 디딤판 왼끝에 1px 그늘을 드리워 옆판 두께가 보인다.
    먼 단(위쪽 3단)은 디딤판을 한 단계 어둡게 — 멀어지며 오른다."""
    for k, (top, bot) in enumerate(step_bounds()):
        far = 1 if k >= NSTEP - 3 else 0
        for (lx0, lx1) in LANES:
            w = lx1 - lx0 + 1
            for y in range(top, bot - 3): c.HL(lx0, y, w, K('conc', 2 - far) if y == top else K('shiro', 0 - far))   # 디딤판 윗면(평평한 밝은 회색, 맨 윗줄 한 단계 어둡게)
            c.HL(lx0, bot - 3, w, K('shiro', 2))                                  # 디딤 코(흰 빛 1줄)
            c.HL(lx0, bot - 2, w, K('conc', -1)); c.HL(lx0, bot - 1, w, K('conc', -2))   # 챌판(남향 앞면, 중간·어두운 회색 2줄)
            c.HL(lx0, bot, w, K('sumi', 1))                                       # 챌판 밑 = 아랫단 디딤판과 만나는 짙은 선
            for y in range(top, bot - 2): c.P(lx0, y, K('conc', 0))              # 옆판 그늘(왼끝 1px)
    t0, b0 = step_bounds()[0]
    for (lx0, lx1) in LANES: c.HL(lx0, b0 - 4, lx1 - lx0 + 1, K('mado', 1)); c.HL(lx0, b0 - 3, lx1 - lx0 + 1, K('mado', 2))   # 첫 단 코 = 호박색
    c.HL(3, STEP_BOT, 26, OL)                                      # 땅 닿는 선


def center_rail(c, y0, y1):
    """가운데 손잡이(관): x14 그늘 · 15 빛 · 16 몸 · 17 윤곽. 16px 마다 기둥. 남쪽 끝 12px 은 기둥 앞면."""
    face0 = y1 - 5
    for y in range(y0, y1 + 1):
        if y >= face0:
            c.P(14, y, OL); c.P(15, y, K('tekko', 1)); c.P(16, y, K('tekko', -1)); c.P(17, y, OL)
        else:
            c.P(14, y, K('tekko', -2)); c.P(15, y, K('tekko', 3)); c.P(16, y, K('tekko', 0)); c.P(17, y, OL)
    for y in range(y0 + 6, face0 - 2, 13):                        # 두 단마다 기둥(마디: 빛 + 밑 그늘)
        c.P(14, y, OL); c.P(15, y, K('shiro', 2)); c.P(16, y, K('tekko', 2)); c.P(14, y + 1, OL); c.P(16, y + 1, K('tekko', -2))
    c.P(15, face0, K('shiro', 2)); c.P(16, face0, K('tekko', 2)); c.HL(14, y1, 4, OL)
    c.P(16, y1 - 4, K('renga', -1)); c.P(15, y1 - 2, K('renga', 0))                     # 기둥 밑 녹


def landing_floor(c, open_side):
    """층계참(1·2줄 + 0줄 아래 3px): 쇠 그레이팅 + 테두리 앵글 + 계단 머리 경고 블록."""
    x0 = 0 if open_side == 'w' else 3
    x1 = 31 if open_side == 'e' else 28
    grating(c, x0, 13, x1, 43)
    w = x1 - x0 + 1
    c.HL(x0, 13, w, K('conc', 1)); c.HL(x0, 14, w, K('conc', -1))                        # 먼 난간 밑 턱
    c.HL(x0, 44, w, K('conc', 3)); c.HL(x0, 45, w, K('conc', 2))                          # 계단 머리 콘크리트 테(밝음)
    c.HL(x0, 46, w, K('shiro', 1)); c.HL(x0, 47, w, K('tekko', -2))                      # 머리 코 + 첫 내림 그늘
    for (lx0, lx1) in LANES: tactile(c, lx0, 41, lx1 - lx0 + 1)


def overpass_stair(open_side):
    def make():
        base, top = Cv(32, 128), Cv(32, 128)
        landing_floor(base, open_side)
        stair_flight(base)
        center_rail(base, 40, STEP_BOT)
        # 옆 난간: 막힌 쪽은 0줄부터, 트인 쪽은 계단(3줄)부터.
        rail_ns(base, 0, 2 if open_side != 'w' else 57, STEP_BOT, top_cap=open_side == 'w')
        rail_ns(base, 29, 2 if open_side != 'e' else 57, STEP_BOT, top_cap=open_side == 'e')
        # 트인 쪽 모서리(층계참 남쪽 끝 = 상판 거더와 같은 높이): 거더 앞면을 3px 이어 그려 층계참이 상판과 같은 높이로 솟아 보이게.
        gx = 29 if open_side == 'e' else 0
        for x in range(gx, gx + 3):
            base.P(x, 48, K('conc', 3)); base.P(x, 49, K('conc', 1))
            for y in (50, 51, 52): base.P(x, y, K('tekko', 2) if y == 50 else K('tekko', 1))
            base.P(x, 53, K('tekko', 0)); base.P(x, 54, K('tekko', -1)); base.P(x, 55, K('tekko', -2)); base.P(x, 56, OL)
        # 옆판 안쪽 면(계단 쪽으로 보이는 옆판 두께): 아래 끝 0px → 층계참 밑 2px 로 자란다 — 위로 갈수록 높다.
        for y in range(STEP_TOP, STEP_BOT):
            wdt = round(2 * (STEP_BOT - y) / (STEP_BOT - STEP_TOP))
            for k in range(wdt):
                base.P(3 + k, y, K('conc', -2) if k == 0 else K('conc', -1))
                base.P(28 - k, y, K('conc', -1) if k == 0 else K('conc', 0))
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
    piece('overpass-stair-' + side, f'올라가는 육교 계단(남쪽에서 들어서 북쪽을 보고 13단, 도착 층계참→{ko}쪽 상판)', 2, 8, 'structure',
          tags=['육교', '계단', '歩道橋', '층계참', '난간', '역'], role='prop', snap='floor',
          desc=f'올라가는 계단(같은 맵 안). 들어서는 쪽: 남쪽(맨 아래 줄 바로 남쪽 두 칸). 오를 때 북쪽(위)을 보고 걷는다. 도착: 꼭대기 층계참 → {ko}쪽 육교 상판. 내려올 때는 남쪽(아래)을 보고 같은 길로 내려와 계단 앞 두 칸에 선다. 2칸 폭 육교 계단: 가운데 손잡이로 두 갈래, 13단, 양옆 난간, 꼭대기 2×3 층계참(쇠 그레이팅, 먼 쪽 난간). 층계참 {ko}쪽이 트여 육교 상판(jp-overpass-deck-*)과 이어진다.',
          rules=f'맨 아래 줄(7줄) 바로 남쪽 두 칸이 들어서는 바닥이다(비워 둔다). 계단 칸은 위·아래로만 걷는다(옆 난간·가운데 손잡이). '
                f'층계참 {ko}쪽 칸에 상판 키트(jp-overpass-deck-red, 2×6)를 같은 윗줄(0줄)에 맞춰 이어 붙인다. 반대쪽 끝에는 거울 계단(jp-overpass-stair-{"w" if side == "e" else "e"})을 붙여 육교를 완성한다. '
                f'같은 맵 안에서 오르내린다(층 이동 이벤트 없음). 상판·층계참 밑으로는 지나갈 수 없다(밑 도로는 끊긴다).',
          contract=dict(leads='same', side='S', mode='walk', trigger=[], approach=[[0, 8], [1, 8]], exit=[[sx, 1], [sx, 2]],
                        why=f'육교 곧은 계단 — 남쪽 맨 아래 두 칸으로 들어서 층계참({ko}쪽 상판)으로 이어진다'))(overpass_stair(side))


# ─────────────────────────── 2) 육교 상판 2×4 (가로 반복) ───────────────────────────
DECK_MAT = {'red': 'kawara', 'green': 'kokuban'}


def deck_floor(c, mat):
    """상판 바닥 13..47: 칠한 강판 바닥 — 4px 격자로 도드라진 미끄럼막이 돌기(빛 받은 윗점 + 오른쪽 아래 그늘점, 위에서 본 판).
    가운데 걷는 길(26..37)은 돌기가 닳아 바탕이 한 단계 밝고 그늘점이 옅다. 북쪽 난간 밑 그늘(2단) · 남쪽 콘크리트 턱. 무작위 얼룩은 두지 않는다."""
    b = 0 if mat == 'kawara' else 1
    for y in range(13, 48):
        worn = 25 <= y <= 32
        for x in range(32):
            col = K(mat, b + 1) if worn else K(mat, b)
            if worn: col = K(mat, b + 2) if (x % 8, y) == (5, 29) else col                    # 닳은 길: 돌기가 거의 지워진 밝은 띠
            elif (x % 4, y % 4) == (1, 1): col = K(mat, b + 2)                                 # 돌기 윗점(빛)
            elif (x % 4, y % 4) == (2, 2): col = K(mat, b - 1)                                 # 돌기 그늘점
            c.P(x, y, col)
    c.HL(0, 13, 32, K(mat, b - 2)); c.HL(0, 14, 32, K(mat, b - 2)); c.HL(0, 15, 32, K(mat, b - 1))   # 북 난간 밑 그늘
    c.HL(0, 44, 32, K(mat, b - 1)); c.HL(0, 45, 32, K('conc', 2)); c.HL(0, 46, 32, K('conc', 1)); c.HL(0, 47, 32, OL)   # 남쪽 턱 + 바닥 끝 윤곽


def girder(c, y0=48):
    """상판 앞면(3줄 48..): 갓 입술(밝음 2) → 거더 웹(강판 4, 8px 마다 세로 보강재·볼트 줄) → 아래 플랜지 · 밑면 윤곽(56).
    그 밑 57..95(두 칸 남짓)는 비워 상판 밑 허공으로 도로가 보이고(높이), 가운데에 쇠 기둥 하나가 땅(95)까지 선다.
    땅에 진 상판 그늘 = 기둥 발치 둘레 86..93 한 톤 띠 + 위·아래 끝 망점(오른쪽 아래로 비낀 그늘)."""
    c.HL(0, y0, 32, K('conc', 3)); c.HL(0, y0 + 1, 32, K('conc', 1))
    for y in range(y0 + 2, y0 + 6):
        c.HL(0, y, 32, K('tekko', 2) if y == y0 + 2 else K('tekko', 1) if y < y0 + 5 else K('tekko', 0))
    for x in range(4, 32, 8):                                     # 세로 보강재(왼쪽 빛·오른쪽 그늘)
        c.VL(x, y0 + 2, 4, K('tekko', 3)); c.VL(x + 1, y0 + 2, 4, K('tekko', -1))
    for x in range(1, 32, 4): c.P(x, y0 + 3, K('tekko', 0))       # 볼트 줄
    c.P(19, y0 + 4, K('renga', -1))                                # 녹물 한 점
    c.HL(0, y0 + 6, 32, K('tekko', -1)); c.HL(0, y0 + 7, 32, K('tekko', -2)); c.HL(0, y0 + 8, 32, OL)   # 아래 플랜지 · 밑면 윤곽
    for y in range(86, 94): c.HL(0, y, 32, K('tekko', -1))        # 땅 그늘 띠(곧은 가장자리, 한 톤)
    for y in range(y0 + 9, 96):                                   # 가운데 쇠 기둥(빛 · 몸 · 그늘 + 윤곽)
        c.P(13, y, OL); c.P(14, y, K('tekko', 3)); c.P(15, y, K('tekko', 2)); c.P(16, y, K('tekko', 0)); c.P(17, y, K('tekko', -2)); c.P(18, y, OL)
    c.HL(12, 94, 8, K('conc', 1)); c.HL(12, 95, 8, OL); c.P(12, 94, OL); c.P(19, 94, OL)   # 기둥 받침


def deck(var):
    def make():
        mat = DECK_MAT[var]
        base, top = Cv(32, 96), Cv(32, 96)
        deck_floor(base, mat)
        # 0줄(북 난간 + 바닥 3px)은 위층으로
        rail_ew(top, 0, 31, 14, post_off=3)
        _lift_row0(base, top)
        # 2줄 남 난간(★, 사람 뒤로): 바닥선 47, 쇠 회색 살
        rail_ew(top, 0, 31, 47, post_off=3, dense=True)
        girder(top)
        cells = {}
        for x in range(2):
            cells[(x, 0)] = ('solid', None)
            cells[(x, 1)] = ('floor', dict(ALL))
            cells[(x, 2)] = ('floor', dict(up=True, down=False, left=True, right=True))   # 상판 남쪽 줄: 남쪽(밑 도로)으로 내려서지 못한다
            for y in (3, 4, 5): cells[(x, y)] = ('star', None)    # 거더·기둥·그늘 덧그림 — 밑 도로 칸은 걷는다(사람 뒤로 겹친다)
        return base, top, cells, {(x, 2): 'star' for x in range(2)}
    return make


# 녹색 바닥 변형(kokuban)은 3/4 관문 독립 눈이 조립 그림을 「정면 입면」으로 12/12 거부해(2026-10-22, 여러 차례) 이번 판에서 뺐다 — 붉은 갈색만.
for var, ko in (('red', '붉은 갈색'),):
    piece('overpass-deck-' + var, f'육교 상판({ko} 바닥, 2×6 가로 반복)', 2, 6, 'structure', repeat='x', role='prop',
          tags=['육교', '상판', '歩道橋', '다리', '난간'],
          desc=f'육교 상판 한 마디(같은 맵 안의 높은 길): 북쪽 난간 · {ko} 미끄럼막이 바닥 2줄 · 남쪽 난간(사람 뒤로 지나감) · 앞면 거더 · 그 밑 두 칸 높이의 쇠 기둥과 도로에 진 그늘. 동서로 걷는다.',
          rules='육교 계단(jp-overpass-stair-e)의 층계참 동쪽 칸에서 시작해 같은 윗줄(0줄)로 가로로 이어 붙이고, 끝에 거울 계단(jp-overpass-stair-w)을 붙인다. '
                '1·2줄을 동서로 걷는다(2줄에서 남쪽으로 내려서지 못한다). 0줄(북 난간)은 막힘. 3~5줄은 거더·기둥 덧그림이라 밑 도로 칸은 걷되, 육교 줄(0~2줄)을 남북으로 가로지르지는 못한다 — 차도는 육교 줄에서 끊긴다.')(deck(var))


# ─────────────────────────── 3) 옆 계단 한 쌍 3×4 ───────────────────────────
NS = 4                                                            # 단 수(12px 폭)
SW = 48 // NS


SIDE_E = (4, 8, 12, 16)                                          # 단 높이(px) — 맨 안쪽 = 단상·상판 높이 16


def side_stair(hand):
    """옆 계단 3×2(단상 jp-stage-platform 의 2·3줄과 같은 줄): 0줄 = 걷는 줄(동서로만), 1줄 = 단 앞면(막힘).
    hand 'l': 서쪽 바깥 끝이 낮고 동쪽(안쪽)으로 오른다. 'r': 거울(빛은 그대로 왼쪽 위).
    단 i(바깥 0 → 안쪽 5) = 폭 8px 세로 판 하나: 높이 e 만큼 솟은 디딤 면(남북 16px 깊이, 위에서 본 밝은 면) + 그 밑 남향 앞면(e px, 어둡게).
    디딤 면 y = 16-e .. 31-e, 앞 코 31-e(흰 빛), 앞면 32-e .. 30, 땅 윤곽 31. 맨 안쪽 단(e=16) 디딤 면 = 0줄 전체 = 단상 남쪽 마루 줄, 앞면 = 단상 옹벽과 같은 높이.
    판마다 왼쪽 1px 빛 · 오른쪽 1px 그늘 · 바깥 윤곽 → 높이가 다른 판들이 계단처럼 층져 보인다(위에서 본 옆 계단)."""
    def make():
        c = Cv(48, 32)
        L = hand == 'l'
        spans = []
        for i, e in enumerate(SIDE_E):
            x0 = i * SW if L else 48 - SW - i * SW
            x1 = x0 + SW - 1
            nb = 31 - e; pt = nb - 14                              # 앞 코 = 땅(31)에서 단 높이 e 만큼 위, 디딤 면 = 그 위 14줄(모든 단 같은 깊이 — 판 전체가 높이만큼 올라선다)
            hi = (i < len(SIDE_E) - 1)                                 # 더 높은 이웃 판이 있다(L: 동, R: 서)
            for x in range(x0, x1 + 1):
                for y in range(pt, nb + 1):                            # 디딤 면: 한 톤 평평한 회색 + 북쪽 끝 빛 캡 1줄 + 그 밑 그늘 1줄 + 왼쪽 1px 빛
                    d = y - pt
                    col = K('shiro', 1) if d == 0 else K('conc', 0) if d == 1 else K('conc', 1)
                    if d > 1 and x0 + 1 < x < x1:                       # 콘크리트 골재 잔점(드문드문, 줄무늬 없이)
                        r_ = rnd(x, y, 91 + i) % 11
                        if r_ == 0: col = K('conc', 2)
                        elif r_ == 1: col = K('conc', 0)
                    if d == nb - pt - 1: col = K('conc', 0)                # 코 바로 위 한 줄 그늘(판 두께)
                    if x == x0 + 1 and d > 0: col = K('conc', 2)
                    if not L and i < len(SIDE_E) - 1 and x0 < x <= x0 + 2 and d > 0: col = K('conc', 0)   # R: 서쪽(더 높은) 이웃 판이 드리운 그늘
                    c.P(x, y, col)
                if x0 < x < x1: c.P(x, nb + 1, K('mado', 2) if rnd(x, i, 77) % 7 else K('conc', 0))   # 앞면 맨 윗줄 = 노란 미끄럼막이 코(이 빠진 자리 몇 점)
                for y in range(nb + 2, 31):                            # 앞면(남향) = 단상 옹벽과 같은 블록 줄눈(5px 단), 돌마다 바탕 톤
                    dd = y - nb - 1
                    ry = (y - 16) % 5; brow = (y - 16) // 5
                    col = K('conc', -3) if rnd(i, brow, 75) % 3 else K('conc', -2)   # 돌마다 바탕 톤(두 가지, 디딤 면과 가장 큰 대비)
                    if ry == 4: col = K('sumi', 1)                                   # 줄눈
                    elif ry == 0: col = K('conc', -2) if col == K('conc', -3) else K('conc', -1)   # 돌 윗모서리 빛
                    if dd == 1: col = K('sumi', 1)                                   # 코 밑 그늘(밝은 디딤 · 어두운 앞면의 꺾임)
                    c.P(x, y, col)
                c.P(x, pt - 1, OL); c.P(x, 31, OL)                     # 뒤 모서리 · 땅 윤곽
            for y in range(pt - 1, 32): c.P(x0, y, OL); c.P(x1, y, OL)  # 판 윤곽(양옆) — 이웃 판과 맞닿은 쪽은 아래에서 이음매로 바꾼다
            spans.append((x0, x1, pt, nb))
        for i in range(len(spans) - 1):                                # 맞닿은 두 열: 동쪽 열 = 짙은 윤곽(판 가름), 서쪽 열 = 디딤 면 빛(빛 왼쪽 위)
            a0, a1, apt, anb = spans[i] if L else spans[i + 1]         # 서쪽 판
            b0, b1, bpt, bnb = spans[i + 1] if L else spans[i]         # 동쪽 판
            for y in range(max(apt, bpt), 31):
                c.P(a1, y, OL)                                         # 서쪽 판 동쪽 모서리 = 윤곽
                if y > bnb: c.P(b0, y, K('conc', -1))                 # 동쪽 판 서쪽 끝(앞면만 한 단계 밝게) — 디딤 면은 그대로
        LR = dict(up=False, down=False, left=True, right=True)
        cells = {}
        for x in range(3):
            cells[(x, 0)] = ('flat', dict(LR))
            cells[(x, 1)] = ('solid', None)
        return None, c, cells
    return make


for hand, ko, side, ap, ex in (('l', '왼쪽(서쪽에서 들어서 동쪽을 보고 오름, 도착 단상)', 'W', [[-1, 0]], [[3, 0]]),
                               ('r', '오른쪽(동쪽에서 들어서 서쪽을 보고 오름, 도착 단상)', 'E', [[3, 0]], [[-1, 0]])):
    low, high = ('서', '동') if hand == 'l' else ('동', '서')
    piece('side-stair-' + hand, f'올라가는 옆 계단 {ko}', 3, 2, 'structure', role='prop',
          tags=['계단', '옆 계단', '단', '무대', '단상', '콘크리트'],
          desc=f'올라가는 계단(같은 맵 안, 옆으로 오른다). 들어서는 쪽: {low}쪽(0줄 {low}쪽 바깥 한 칸). 오를 때 {high}쪽을 보고 걷는다. 도착: {high}쪽 끝 단상 마루(같은 줄). 내려올 때는 {low}쪽을 보고 내려와 바깥 칸에 선다. 콘크리트 판 4단: 폭 12px 판마다 위에서 본 밝은 디딤 면 + 그 밑 블록 줄눈 앞면, {low}쪽 바깥 판이 낮고 {high}쪽 안쪽 판으로 높아진다(맨 안쪽 판 = 단상 높이). 맨 바깥 단 코는 노랑.',
          rules=f'단상(jp-stage-platform, 2×4)의 {low}쪽 끝에 붙인다: 키트 0줄 = 단상 2줄(남쪽 바닥 줄), 키트 1줄 = 단상 3줄(앞면). {high}쪽 끝이 단상에 닿는다. '
                f'0줄 {low}쪽 바깥 한 칸이 들어서는 바닥이다. 0줄은 {low}↔{high}로만 걷는다(남북으로 못 나간다). 1줄(앞면)은 막힘. '
                f'짝(jp-side-stair-{"r" if hand == "l" else "l"})을 반대쪽 끝에 붙이면 양쪽에서 오르는 단상이 된다.',
          contract=dict(leads='same', side=side, mode='walk', trigger=[], approach=ap, exit=ex,
                        why=f'옆 계단 — {low}쪽 낮은 끝으로 들어서 {high}쪽 단상으로 오른다'))(side_stair(hand))


# ─────────────────────────── 3b) 단상 2×4 (가로 반복) ───────────────────────────
def stage():
    """단상(솟은 마당·무대): 0..2줄 나무 마루 바닥(위에서 본 윗면 3줄, 걷는다; 0줄은 북쪽으로 못 나간다) · 3줄 옹벽 앞면(막힘, 높이 16 — 옆 계단 맨 안쪽 단과 같다).
    뒤 모서리는 윤곽 한 줄(0)과 그 밑 그늘 두 줄. 마루 널은 동서로 달린다(4px: 빛 1 · 몸 2 · 틈 1, 이음 엇갈림). 앞 갓돌(밝은 회색) 밑으로 옹벽."""
    def make():
        base, top = Cv(32, 64), Cv(32, 64)
        for y in range(1, 48):
            r = (y - 1) % 4; row = (y - 1) // 4
            for x in range(32):
                seg = (x + row * 11) // 24                                         # 널 한 장(이음 사이)마다 바탕 톤이 조금씩 다르다
                tb = (1, 0, 1, 2, 0, 1)[(rnd(seg, row, 71)) % 6]
                col = K('ita', min(3, tb + 1)) if r == 0 else K('ita', tb) if r < 3 else K('ita', -2)
                if r != 3 and (x + row * 11) % 24 == 0: col = K('ita', -1)         # 널 이음
                elif r != 3 and (x + row * 11) % 24 == 1: col = K('ita', 3) if r == 0 else K('ita', 2)   # 이음 옆 널 끝 빛
                elif r == 2 and rnd(x, y, 53) % 31 == 0: col = K('ita', -1)       # 옹이
                elif r in (1, 2) and rnd(x, y, 51) % 19 == 0: col = K('ita', 0)    # 나뭇결(성기게)
                elif r == 1 and rnd(x, y, 52) % 23 == 0: col = K('ita', 3)         # 결 빛
                base.P(x, y, col)
        base.HL(0, 0, 32, OL); base.HL(0, 1, 32, K('ita', -3)); base.HL(0, 2, 32, K('ita', -1))   # 뒤 모서리 윤곽 · 그늘
        base.HL(0, 44, 32, K('ita', -1)); base.HL(0, 45, 32, K('conc', 2)); base.HL(0, 46, 32, K('conc', 3)); base.HL(0, 47, 32, K('conc', 1))   # 마루 끝 그늘 · 앞 갓돌
        for y in range(48, 63):                                   # 옹벽 앞면: 콘크리트 블록(16×5 엇갈림), 돌마다 왼쪽 위 빛 · 오른쪽 아래 그늘
            row = (y - 48) // 5; ry = (y - 48) % 5
            for x in range(32):
                xx = (x + (8 if row % 2 else 0)) % 16
                blk = (x + (8 if row % 2 else 0)) // 16
                col = K('conc', (-1, 0, -1, -2)[rnd(blk, row, 73) % 4] if y < 53 else (-2, -1, -2)[rnd(blk, row, 74) % 3])   # 돌마다 바탕 톤
                if ry == 4 or xx == 15: col = K('conc', -3)                          # 줄눈
                elif ry == 0 or xx == 0: col = K('conc', 0) if y < 53 else K('conc', -1)   # 돌 윗·왼 모서리 빛
                elif ry == 3 or xx == 14: col = K('conc', -2) if y < 53 else K('conc', -3) if ry == 3 and y > 58 else K('conc', -2)
                if ry in (1, 2) and 1 < xx < 14:
                    r_ = rnd(x, y, 61) % 11
                    if r_ == 0: col = K('conc', 0)
                    elif r_ == 1: col = K('conc', -3)
                    elif r_ == 2 and y < 53: col = K('conc', 1)
                top.P(x, y, col)
        top.HL(0, 48, 32, K('conc', -3))                          # 갓돌 밑 그늘
        for x, y0 in ((6, 50), (23, 54)):
            for j in range(4): top.P(x, y0 + j, K('yoru', 0))      # 물 자국
        top.HL(0, 63, 32, OL)
        cells = {}
        for x in range(2):
            cells[(x, 0)] = ('floor', dict(up=False, down=True, left=True, right=True))   # 뒤 모서리: 북쪽으로 떨어지지 않는다
            cells[(x, 1)] = ('floor', dict(ALL))
            cells[(x, 2)] = ('floor', dict(ALL))
            cells[(x, 3)] = ('solid', None)
        return base, top, cells
    return make


piece('stage-platform', '단상(솟은 마당·무대, 2×4 가로 반복)', 2, 4, 'structure', repeat='x', role='prop',
      tags=['단', '단상', '무대', '광장', '옹벽', '콘크리트'],
      desc='지면에서 한 칸 높이 솟은 단상(무대, 같은 맵 안): 나무 마루 바닥 3줄(동서 널, 뒤 모서리 윤곽) · 앞면 콘크리트 옹벽(블록 줄눈). 옆 계단 한 쌍(jp-side-stair-l/r)으로 오르내린다.',
      rules='가로로 이어 붙인다. 서쪽 끝에 jp-side-stair-l, 동쪽 끝에 jp-side-stair-r 을 키트 0줄 = 단상 2줄로 맞춰 붙인다. 0~2줄을 걷는다(0줄에서 북쪽으로는 못 나간다). 3줄(옹벽)은 막힘. 단상 북쪽 칸에는 벽·건물 등 막힌 것을 둔다.')(stage())


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
        for y in (43, 44):                                         # 발 받침판 = 노랑·검정 빗금 띠(2줄)
            for x in range(2, 14): c.P(x, y, K('mado', 2) if ((x + y) // 2) % 2 == 0 else K('sumi', 1))
        c.HL(2, 45, 12, K('tekko', -2)); c.HL(2, 46, 12, OL)
        c.HL(1, 47, 14, K('yoru', -2))
        cells = {(0, 0): ('flat', dict(UD)), (0, 1): ('flat', dict(UD)), (0, 2): ('flat', dict(UD))}
        return None, c, cells
    return make


piece('wall-ladder', '올라가는 벽 사다리(쇠 1×3, 남쪽에서 들어서 북쪽 벽을 보고 오름, 도착 옥상 맵)', 1, 3, 'wall_mounted', role='prop', snap='wall', layer4=True,
      tags=['사다리', '벽', '옥상', '쇠', '점검'],
      desc='올라가는 사다리(옥상 등 다른 맵으로). 들어서는 쪽: 남쪽(맨 아래 칸 바로 남쪽 칸). 오를 때 북쪽(벽)을 본다. 도착: 이동 이벤트가 정한 옥상 맵 칸, 사다리를 등지고 남쪽을 본다. 건물 벽에 붙인 쇠 사다리: 두 레일·디딤봉 7개·벽 받침쇠, 꼭대기는 지붕 난간 위로 굽은 손잡이, 발밑에 노랑·검정 경고 띠.',
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


NOTES = ('거리 계단 %d키트: 육교 곧은 계단(-e/-w, 2×8) + 상판(붉은 갈색, 2×6 가로 반복, 거더·쇠 기둥·도로 그늘) + 옆 계단 한 쌍(-l/-r, 3×2, 콘크리트 판 4단) + 단상(2×4 가로 반복) + 벽 사다리(1×3, 4층). '
         '높이 문법: 상판·단상 = 지면에서 16px, 윗면은 제 칸 줄, 앞면(거더·옹벽)은 그 밑 줄. 계단 칸은 위·아래로만, 옆 계단 0줄은 동서로만(dirs). '
         '3/4 관문: 부품은 조립 그림(육교·단상)이 덮는다(_gate/assembled.json). 한계: 육교 줄은 남북으로 못 지난다(차도가 끊긴다).')


def build():
    cells, groups, kits, _ = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': groups, 'kits': kits, 'notes': NOTES % len(kits)}


# 조립 그림(3/4 관문용): 상판·단상·옆 계단·곧은 계단은 혼자서는 다리·단상 전체의 윗면+앞면을 보일 수 없는 부품이라,
# 실제로 찍는 그대로 합친 조립 그림(kind structure, 같은 판정자·같은 기준)이 통과해야 덮인다. 부품을 한 화소라도 다시 그리면
# 조립 그림이 부품을 화소 그대로 품지 않게 되어 덮임이 풀린다(gate_rooms.covering 이 _gate/assembled.json 을 읽는다).
ASSEMBLIES = {   # (폭, 높이, [(부품, x, y)]) — 투명 배경(땅 없이 부품만)
    'jp-overpass-assembled-red': (8, 8, [('overpass-stair-e', 0, 0), ('overpass-deck-red', 2, 0), ('overpass-deck-red', 4, 0), ('overpass-stair-w', 6, 0)]),
    'jp-stage-assembled': (10, 4, [('side-stair-l', 0, 2), ('stage-platform', 3, 0), ('stage-platform', 5, 0), ('side-stair-r', 7, 2)]),
}


def kinds():
    """object-gate 종류(키트 id → kind). 벽 사다리만 혼자 판정, 나머지는 조립 그림이 덮는 부품(part). 조립 그림 = structure."""
    out = {'jp-' + p['id']: ('part' if p['id'] != 'wall-ladder' else p['kind']) for p in P}
    out.update({a: 'structure' for a in ASSEMBLIES})
    return out


def assembly_image(aid):
    w, h, parts = ASSEMBLIES[aid]
    im = Image.new('RGBA', (w * 16, h * 16))
    for pid, x, y in parts: im.alpha_composite(kit_image(pid), (x * 16, y * 16))
    return im


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
    man = {}
    for aid, (w, h, parts) in ASSEMBLIES.items():
        ap = os.path.join(OUTDIR, '_gate', aid + '.png'); assembly_image(aid).save(ap)
        for pid, x, y in parts:
            key = '%s::jp-%s' % (aid, pid)
            if key not in man: man[key] = dict(png=os.path.relpath(ap, ROOT), part='jp-' + pid, block=BLOCK, x=x * 16, y=y * 16, source=aid)
    json.dump(man, open(os.path.join(OUTDIR, '_gate', 'assembled.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
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
