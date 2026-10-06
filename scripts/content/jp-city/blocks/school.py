"""jp_city 블록 `school` — 손 도트 小学校 교정(校庭 흙 바닥·트랙 선·철봉·조례대·국기 게양대·수영장·체육 창고·百葉箱·사육장·화단·축구 골대·
자전거 보관대·二宮金次郎像·정글짐·운제·타이어 놀이·방구망·나팔꽃 화분). 계약: ../CONTRACT.md
근거: tiledata/jp-city/research/03-building-types-dimensions.md(학교 층고·교정), 화풍은 street_hand·houses 와 같다(modern3, sumi 윤곽, 빛 왼쪽 위, 정면 고정 3/4).
바닥 그림(ground) 은 1층(키트 base: floor·solidfloor), 서 있는 것(draw) 은 3층(키트 grid: solid·star). 트랙 선은 투명 덧그림(flat, 2층).
  python3 scripts/content/jp-city/blocks/school.py        # selftest + tiledata/jp-city/blocks/school/*.png
"""
import os, sys, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..')); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'houses'))
import numpy as np                                        # noqa: E402
from PIL import Image                                     # noqa: E402
from lib_blocks_lines.core import check_cell, ROOT        # noqa: E402
import shop_parts as SP                                   # noqa: E402
from house_kit import K, OL, Cv                           # noqa: E402

BLOCK = 'school'
OUTDIR = os.path.join(ROOT, 'tiledata', 'jp-city', 'blocks', 'school')
P = []


def prop(id_, name, w, h, solid=(), other='star', tags=(), rules='', ground=None, ground_solid=(), role='prop', repeat=None):
    """draw = 3층 그림(없으면 None), ground = 1층 바닥 그림(floor, ground_solid 칸은 solidfloor). other='flat' 이면 draw 칸이 투명 덧그림."""
    def deco(fn):
        P.append(dict(id=id_, name=name, w=w, h=h, draw=fn, solid=list(solid), other=other, tags=list(tags), rules=rules,
                      ground=ground, ground_solid=list(ground_solid), role=role, repeat=repeat))
        return fn
    return deco


def shadow(c, x, y, w):
    c.HL(x, y, w, K('soil', 0)); c.HL(x + 1, y + 1, w - 2, K('yuka', -1))


def pipe_v(c, x, y0, y1, m='tekko', t=1, w=2):
    """세로 쇠파이프(왼쪽 빛·오른쪽 어둠·윤곽)."""
    c.R(x, y0, w, y1 - y0, K(m, t)); c.VL(x, y0, y1 - y0, K(m, t + 1)); c.VL(x + w - 1, y0, y1 - y0, K(m, t - 2))
    c.VL(x - 1, y0, y1 - y0, OL); c.VL(x + w, y0, y1 - y0, OL)


def pipe_h(c, x0, x1, y, m='tekko', t=2):
    c.HL(x0, y, x1 - x0, K(m, t)); c.HL(x0, y + 1, x1 - x0, K(m, t - 2)); c.HL(x0, y - 1, x1 - x0, OL); c.HL(x0, y + 2, x1 - x0, OL)


# ─────────────────────────── 바닥 ───────────────────────────
def _ground_tile(c, x0, y0, w, h, seed=0):
    """校庭 흙(다진 모래흙): soil 0 바탕 + 좌표 해시로 흩은 밝은·어두운 알갱이. 16 주기라 이어 깔아도 이음새가 없다."""
    c.R(x0, y0, w, h, K('yuka', 1))
    for y in range(h):
        for x in range(w):
            hsh = ((x0 + x) % 16 * 73856093 ^ (y0 + y) % 16 * 19349663 ^ seed * 83492791) & 0xffff
            if hsh % 29 == 0: c.P(x0 + x, y0 + y, K('yuka', 0))
            elif hsh % 37 == 0: c.P(x0 + x, y0 + y, K('yuka', 2))
            elif hsh % 113 == 0: c.P(x0 + x, y0 + y, K('soil', 2))


for _i in range(3):
    def _mkg(i):
        def _g(c): _ground_tile(c, 0, 0, 16, 16, seed=i)
        return _g
    prop(f'school-ground-{"abc"[_i]}', f'校庭 다진 흙 바닥 {"ABC"[_i]}', 1, 1, tags=['학교', '교정', '바닥'], ground=_mkg(_i), role='terrain',
         rules='학교 운동장·교정 바닥(1층). A·B·C 를 섞어 깔면 반복이 덜 보인다. 걸을 수 있다.')(None)


# ─────────────────────────── 트랙 선(투명 덧그림) ───────────────────────────
def _stadium(c, cx0, cx1, cy, r, col, gap=0):
    """두 반원 + 직선 두 줄. 분필 끊김: 좌표 해시로 1/9 화소를 비운다."""
    def put(x, y):
        if ((x * 7 + y * 13 + gap) % 9) != 0: c.P(x, y, col)
    for x in range(cx0, cx1 + 1): put(x, cy - r); put(x, cy + r)
    import math
    n = int(math.pi * r * 2)
    for k in range(n + 1):
        a = math.pi / 2 + math.pi * k / n
        put(int(round(cx0 + r * math.cos(a))), int(round(cy - r * math.sin(a))))
        put(int(round(cx1 - r * math.cos(a))), int(round(cy - r * math.sin(a))))


@prop('school-track', '운동장 트랙 흰 선(200m 두 줄·출발선)', 24, 12, other='flat', tags=['학교', '운동장', '트랙'],
      rules='校庭 흙 바닥 위 2층(투명 덧그림). 키트 왼쪽 위 = 트랙 바깥 사각의 왼쪽 위. 가운데는 비어 있다(축구 골대·조례대를 둘 수 있다). 걸을 수 있다.')
def _track(c):
    col = K('shiro', 1)
    _stadium(c, 96, 287, 96, 88, col); _stadium(c, 96, 287, 96, 70, col, gap=4)
    for y in range(26, 44): c.P(192, 8 + y - 26 + 0, None)
    for y in range(8, 27): c.P(191, y, col); c.P(192, y, col)                       # 출발·결승선(위 직선 위)
    for k in range(4): c.HL(186, 10 + k * 4, 3, col)                                # 출발 순서 눈금


@prop('school-track-l', '운동장 트랙 흰 선(큰 판 30×15)', 30, 15, other='flat', tags=['학교', '운동장', '트랙'],
      rules='校庭 흙 바닥 위 2층(투명 덧그림). 넓은 운동장용. 키트 왼쪽 위 = 트랙 바깥 사각 왼쪽 위. 안쪽 양 끝에 골대 한 쌍을 둔다. 걸을 수 있다.')
def _track_l(c):
    col = K('shiro', 1)
    _stadium(c, 120, 359, 120, 112, col); _stadium(c, 120, 359, 120, 92, col, gap=4)
    for y in range(8, 29): c.P(239, y, col); c.P(240, y, col)
    for k in range(5): c.HL(234, 10 + k * 4, 3, col)


# ─────────────────────────── 놀이·체육 기구 ───────────────────────────
@prop('tetsubo', '鉄棒 철봉(높이 셋)', 5, 2, solid=[(i, 1) for i in range(5)], tags=['학교', '철봉', '체육'],
      rules='교정 가장자리(교사 앞·담 곁). 아래 줄 전부 막힘. 낮은 쪽이 왼쪽.')
def _tetsubo(c):
    posts = (4, 28, 52, 76); tops = (17, 11, 5); cols = ('sora', 'kii', 'aka')
    for i, px in enumerate(posts):
        top = tops[min(i, 2)] if i < 3 else tops[2]
        top = min(tops[max(0, i - 1)], tops[min(i, 2)])
        pipe_v(c, px, top - 1, 30, cols[min(i, 2)], 1, 3)
        c.R(px - 2, 29, 7, 2, K('conc', 0)); c.HL(px - 2, 29, 7, K('conc', 2))
    for i in range(3):
        pipe_h(c, posts[i] + 3, posts[i + 1], tops[i], 'tekko', 3)
    shadow(c, 2, 31, 78)


@prop('chorei-dai', '朝礼台 조례대', 3, 2, solid=[(0, 1), (1, 1), (2, 1)], tags=['학교', '조례대'],
      rules='운동장 북쪽 가운데(교사 앞), 트랙을 바라본다. 아래 줄 막힘.')
def _chorei(c):
    m = 'sora'
    c.R(2, 6, 38, 6, K(m, 2)); c.HL(2, 6, 38, K('shiro', 2)); c.HL(2, 11, 38, K(m, 0))                         # 윗면(판)
    c.R(2, 12, 38, 4, K(m, 0)); c.HL(2, 15, 38, K(m, -2))                                                     # 앞 판 두께
    for px in (3, 19, 35): pipe_v(c, px, 16, 30, m, 0, 3)                                                       # 다리
    for k in range(10): c.P(7 + k, 17 + k, K(m, -1)); c.P(31 - k, 17 + k, K(m, -1))                           # 가새
    for j in range(4):                                                                                       # 오른쪽 계단
        c.R(40 + j * 0, 12 + j * 4, 6, 2, K('tekko', 2)); c.HL(40, 13 + j * 4, 6, K('tekko', 0))
    c.VL(46, 10, 21, K('tekko', 1)); c.VL(47, 10, 21, OL)
    c.HL(1, 5, 40, OL); c.VL(1, 5, 11, OL); c.VL(40, 5, 7, OL); c.HL(1, 16, 39, OL)
    shadow(c, 2, 31, 44)


@prop('flagpoles', '国旗掲揚台 게양대 셋(가운데 국기)', 3, 6, solid=[(0, 5), (1, 5), (2, 5)], tags=['학교', '국기', '게양대'],
      rules='교사 앞·운동장 북쪽 모퉁이. 받침(아래 줄)만 막힘.')
def _flags(c):
    c.R(1, 86, 46, 8, K('conc', 1)); c.HL(1, 86, 46, K('conc', 3)); c.HL(1, 93, 46, K('conc', -2)); c.HL(0, 85, 48, OL); c.VL(0, 85, 9, OL); c.VL(47, 85, 9, OL)
    for px, top in ((8, 14), (23, 4), (38, 14)):
        c.VL(px, top, 86 - top, K('shiro', 2)); c.VL(px + 1, top, 86 - top, K('conc', 0)); c.VL(px - 1, top, 86 - top, OL); c.VL(px + 2, top, 86 - top, OL)
        c.R(px - 1, top - 2, 4, 2, K('kii', 2)); c.HL(px - 1, top - 3, 4, OL)                                      # 꼭지 구슬
    # 가운데 국기(흰 바탕 붉은 원), 오른쪽 교기(감색 + 금 표장)
    c.R(25, 6, 16, 11, K('shiro', 2)); c.HL(25, 16, 16, K('shiro', 0))
    for j in range(-3, 4):
        for i in range(-3, 4):
            if i * i + j * j <= 10: c.P(33 + i, 11 + j, K('aka', 1))
    c.VL(41, 6, 11, OL); c.HL(25, 5, 17, OL); c.HL(25, 17, 17, OL)
    c.R(40, 16, 7, 9, K('kon', 0)); c.R(42, 18, 3, 3, K('kii', 2)); c.VL(47, 16, 9, OL); c.HL(40, 15, 8, OL); c.HL(40, 25, 8, OL)
    for y in range(20, 84, 9): c.P(10, y, K('tekko', -1)); c.P(25, y - 4, K('tekko', -1))                         # 줄
    shadow(c, 2, 94, 44)


@prop('jungle-gym', 'ジャングルジム 정글짐', 3, 4, solid=[(x, y) for x in range(3) for y in (2, 3)], tags=['학교', '놀이', '정글짐'],
      rules='교정·공원 놀이 구역. 아래 두 줄(앞면) 막힘, 위 두 줄(윗면·뒤)은 뒤로 지나간다.')
def _jungle(c):
    cols = ('aka', 'kii', 'sora', 'midori')
    X = (4, 17, 30, 43); TOP, FRONT, BOT = 10, 30, 62           # 윗면은 TOP~FRONT(뒤로 갈수록 위), 앞면은 FRONT~BOT
    for k, x in enumerate(X):                                   # 윗면 깊이선(뒤로 뻗은 대) — 앞 기둥과 같은 x
        c.VL(x, TOP, FRONT - TOP, K(cols[(k + 1) % 4], 2)); c.VL(x + 1, TOP, FRONT - TOP, K(cols[(k + 1) % 4], 0)); c.VL(x - 1, TOP, FRONT - TOP, OL); c.VL(x + 2, TOP, FRONT - TOP, OL)
    for k, y in enumerate((TOP, TOP + 10, FRONT)):              # 윗면 가로대(뒤·가운데·앞)
        pipe_h(c, 3, 46, y, cols[k % 4], 2)
    for k, y in enumerate((FRONT + 10, FRONT + 21)):            # 앞면 가로대
        pipe_h(c, 3, 46, y, cols[(k + 2) % 4], 1)
    for k, x in enumerate(X):                                   # 앞면 기둥
        pipe_v(c, x, FRONT, BOT, cols[(k + 1) % 4], 1, 2)
    shadow(c, 2, BOT, 46)


@prop('unte', '雲梯 운제(구름사다리)', 5, 2, solid=[(0, 1), (4, 1)], tags=['학교', '놀이', '운제'],
      rules='교정 놀이 구역. 양 끝 기둥 칸만 막힘(가운데 밑은 지나간다 — 사다리가 머리 위).')
def _unte(c):
    for px in (5, 72):
        pipe_v(c, px, 6, 30, 'midori', 1, 3)
        for j in range(10, 28, 5): c.HL(px - 4, j, 4, K('tekko', 2)); c.HL(px + 3, j, 4, K('tekko', 2))    # 오르는 발판
    pipe_h(c, 2, 78, 5, 'kii', 2); pipe_h(c, 2, 78, 10, 'kii', 1)
    for x in range(10, 72, 6): c.VL(x, 6, 4, K('tekko', 3)); c.VL(x + 1, 6, 4, K('tekko', 0))
    shadow(c, 2, 31, 76)


@prop('tires', 'タイヤ跳び 반쯤 묻은 타이어 줄', 4, 1, solid=[(i, 0) for i in range(4)], tags=['학교', '놀이', '타이어'],
      rules='교정 가장자리. 막힘.')
def _tires(c):
    cols = ('aka', 'kii', 'sora', 'midori', 'aka', 'kii')
    for k in range(6):
        x = 2 + k * 10; h = 8 + (k % 3) * 2; y = 14 - h
        c.R(x, y, 9, h, K('tekko', -2)); c.R(x + 2, y + 2, 5, h - 2, K('soil', -1))
        c.HL(x, y, 9, K(cols[k], 1)); c.HL(x, y + 1, 9, K(cols[k], 0)); c.VL(x, y, h, K(cols[k], 1)); c.VL(x + 8, y, h, K(cols[k], -1))
        c.VL(x - 1, y, h, OL); c.VL(x + 9, y, h, OL); c.HL(x, y - 1, 9, OL)
    shadow(c, 1, 14, 62)


GH = 22          # 골대 높이(px)


def _goal(c, west=True):
    """골 입(남북 3칸)이 동(서쪽 골)·서(동쪽 골)를 본다. 위에서 보면 입 가로대가 세로로 서고, 그물은 뒤쪽(바깥)으로 1.2칸.
    그물은 성긴 마름모(바닥이 비쳐 보인다), 기둥·가로대는 흰 파이프 + 윤곽."""
    W = 48; yN, yS = 30, 78                        # 북쪽·남쪽 기둥 밑동(바닥) y
    mx = W - 8 if west else 6                      # 입(앞 기둥) x
    D = 20; bx = mx - D if west else mx + D        # 뒤 바닥대 x
    s = 1 if west else -1
    for y in range(yN - GH + 2, yS):               # 그물: 성긴 마름모 4px
        for x in range(min(mx, bx), max(mx, bx) + 1):
            t = (mx - x) * s
            if y < yN - GH + t or y > yS - GH + t + GH - 1: continue
            if (x + y) % 4 == 0 or (x - y) % 4 == 0: c.P(x, y, K('shiro', 0))
    for yy in range(yN - GH, yS - GH + 2): c.P(mx - 1, yy, OL); c.P(mx, yy, K('shiro', 2)); c.P(mx + 1, yy, K('shiro', 0)); c.P(mx + 2, yy, OL)   # 가로대(세로로 보임)
    for y0 in (yN, yS):
        pipe_v(c, mx, y0 - GH, y0, 'shiro', 1, 2)
        for t in range(D + 1): c.P(mx - t * s, y0 - GH + t, K('shiro', 1)); c.P(mx - t * s, y0 - GH + t + 1, OL)   # 옆 사선 지주
    for yy in range(yN, yS + 1): c.P(bx, yy, K('shiro', 1)); c.P(bx + s, yy, OL)                           # 뒤 바닥대
    shadow(c, min(mx, bx) - 2, yS + 1, D + 6)


@prop('goal-l', 'サッカーゴール 축구 골대(서쪽 끝, 동쪽을 향함)', 3, 5, solid=[(x, y) for x in (1, 2) for y in range(2, 5)], tags=['학교', '운동장', '골대'],
      rules='트랙 안 서쪽 끝, 입이 동쪽(운동장 가운데)을 본다. 짝 goal-r 은 동쪽 끝. 아래 세 줄 막힘.')
def _goal_l(c):
    _goal(c, True)


@prop('goal-r', 'サッカーゴール 축구 골대(동쪽 끝, 서쪽을 향함)', 3, 5, solid=[(x, y) for x in (0, 1) for y in range(2, 5)], tags=['학교', '운동장', '골대'],
      rules='트랙 안 동쪽 끝, 입이 서쪽을 본다. 짝 goal-l. 아래 세 줄 막힘.')
def _goal_r(c):
    _goal(c, False)


@prop('ball-net', '防球ネット 방구망(높은 녹색 그물, 이어 붙임)', 4, 5, solid=[(i, 4) for i in range(4)], tags=['학교', '운동장', '그물'],
      rules='운동장과 길·교사 사이 경계(남쪽 길가 담 안쪽). 가로로 x + 4 씩 이어 붙인다. 아래 줄 막힘.', role='fence', repeat='x')
def _net(c):
    for y in range(4, 76):
        for x in range(0, 64):
            if (x + y) % 4 == 0 or (x - y) % 4 == 0: c.P(x, y, K('midori', -1))
    c.HL(0, 4, 64, K('midori', 0)); c.HL(0, 3, 64, OL)
    pipe_v(c, 1, 2, 78, 'conc', 1, 3)
    c.HL(0, 76, 64, K('midori', -2)); c.HL(0, 77, 64, OL)
    shadow(c, 0, 78, 64)


# ─────────────────────────── 교정 시설 ───────────────────────────
@prop('souko', '体育倉庫 체육 창고(셔터)', 4, 3, solid=[(i, y) for i in range(4) for y in (1, 2)], tags=['학교', '창고'],
      rules='운동장 모퉁이(체육관 곁). 지붕 줄(맨 위)은 뒤로 지나갈 수 있다. 셔터는 닫힘 — 실내 이동 이벤트를 ��려면 셔터 아래 칸.', role='building')
def _souko(c):
    c.R(1, 4, 62, 8, K('conc', 2)); c.HL(1, 4, 62, K('conc', 3)); c.HL(1, 11, 62, K('conc', 0))                 # 평지붕 윗면
    c.R(1, 12, 62, 3, K('conc', 1)); c.HL(1, 14, 62, K('conc', -2))
    c.R(2, 15, 60, 31, K('kinari', 1)); c.VL(2, 15, 31, K('kinari', 2)); c.VL(61, 15, 31, K('kinari', -1))     # 벽
    for x0 in (8, 34):                                                                                     # 셔터 둘
        c.R(x0, 22, 22, 24, K('tekko', 1)); c.HL(x0, 22, 22, K('tekko', -1))
        for j in range(24, 46, 2): c.HL(x0, j, 22, K('tekko', 0))
        c.R(x0 + 9, 42, 4, 2, K('tekko', -2)); c.VL(x0 - 1, 22, 24, OL); c.VL(x0 + 22, 22, 24, OL)
    c.R(23, 17, 18, 4, K('shiro', 2)); c.HL(25, 18, 14, K('sumi', 2))
    c.HL(0, 3, 64, OL); c.VL(0, 3, 43, OL); c.VL(63, 3, 43, OL); c.HL(1, 46, 62, K('conc', -2)); c.HL(1, 47, 62, OL)


@prop('hyakuyoubako', '百葉箱 백엽상', 1, 2, solid=[(0, 1)], tags=['학교', '관찰'],
      rules='교정 잔디·화단 곁(교사에서 떨어진 곳). 막힘.')
def _hyaku(c):
    c.R(2, 3, 12, 2, K('shiro', 2)); c.HL(1, 2, 14, OL); c.P(1, 3, OL); c.P(14, 3, OL)                        # 지붕
    c.R(2, 5, 12, 12, K('shiro', 1)); c.VL(2, 5, 12, K('shiro', 2)); c.VL(13, 5, 12, K('conc', 1))
    for j in range(6, 16, 2): c.HL(3, j, 10, K('conc', 2))                                                     # 비늘살
    c.VL(1, 5, 12, OL); c.VL(14, 5, 12, OL); c.HL(1, 17, 14, OL)
    for px in (3, 11): c.VL(px, 18, 12, K('shiro', 1)); c.VL(px + 1, 18, 12, K('conc', 0)); c.VL(px - 1, 18, 12, OL); c.VL(px + 2, 18, 12, OL)
    shadow(c, 2, 30, 12)


@prop('shiiku-goya', '飼育小屋 사육장(토끼)', 4, 3, solid=[(i, y) for i in range(4) for y in (1, 2)], tags=['학교', '사육장', '동물'],
      rules='교사 뒤·교정 구석. 지붕 줄은 뒤로 지나갈 수 있다. 막힘.', role='building')
def _shiiku(c):
    c.R(1, 5, 62, 9, K('tekko', 1)); c.HL(1, 5, 62, K('tekko', 3))                                            # 골함석 지붕
    for x in range(2, 62, 4): c.VL(x, 6, 8, K('tekko', 0))
    c.HL(0, 4, 64, OL); c.HL(0, 14, 64, OL)
    c.R(2, 15, 60, 31, K('ita', 0))                                                                           # 나무 틀
    c.R(5, 18, 54, 26, K('yoru', 1))                                                                          # 안쪽 어둠
    c.R(5, 36, 54, 8, K('soil', -1))                                                                          # 짚 바닥
    for (x, y) in ((16, 34), (36, 36)):                                                                        # 토끼 둘(흰 덩이 + 귀)
        c.R(x, y, 8, 5, K('shiro', 2)); c.R(x + 1, y + 5, 7, 1, K('conc', 0)); c.VL(x + 6, y - 4, 4, K('shiro', 2)); c.VL(x + 7, y - 3, 3, K('shiro', 1)); c.P(x + 6, y + 1, K('aka', 1))
    for y in range(18, 44):                                                                                   # 철망
        for x in range(5, 59):
            if (x + y) % 3 == 0 and (x - y) % 3 == 0: c.P(x, y, K('conc', 2))
    for px in (2, 30, 59): c.R(px, 15, 3, 31, K('ita', 1)); c.VL(px, 15, 31, K('ita', 2))
    c.R(44, 20, 12, 24, K('ita', -1)); c.VL(44, 20, 24, OL); c.R(53, 30, 2, 3, K('tekko', 2))                  # 문
    c.VL(1, 14, 33, OL); c.VL(62, 14, 33, OL); c.HL(1, 46, 62, OL)
    c.HL(2, 47, 60, K('soil', -2))


@prop('kadan', '花壇 벽돌 화단(튤립)', 4, 1, solid=[(i, 0) for i in range(4)], tags=['학교', '화단', '꽃'],
      rules='교사 앞·정문 안쪽 길가. 가로로 이어 붙여도 된다(x + 4). 막힘.', repeat='x')
def _kadan(c):
    c.R(0, 8, 64, 6, K('renga', 0)); c.HL(0, 8, 64, K('renga', 2))
    for x in range(0, 64, 8): c.VL(x, 9, 5, K('renga', -1))
    c.HL(0, 14, 64, K('renga', -2)); c.HL(0, 15, 64, OL)
    c.R(1, 5, 62, 3, K('soil', -1))
    cols = ('aka', 'kii', 'pinku', 'shiro', 'murasaki')
    for k in range(12):
        x = 3 + k * 5; m = cols[k % 5]
        c.VL(x + 1, 3, 4, K('midori', 0)); c.P(x, 5, K('midori', 1)); c.P(x + 2, 4, K('midori', 1))
        c.R(x, 0, 3, 3, K(m, 1)); c.P(x + 1, 0, K(m, 2)); c.P(x + 2, 2, K(m, -1)); c.P(x - 1, 1, OL); c.P(x + 3, 1, OL)


@prop('asagao', '朝顔 나팔꽃 화분 줄(1학년)', 4, 1, solid=[(i, 0) for i in range(4)], tags=['학교', '화분', '나팔꽃'],
      rules='교사 앞 처마 밑·昇降口 곁. 막힘.')
def _asagao(c):
    c.R(0, 12, 64, 3, K('tekko', 2)); c.HL(0, 12, 64, K('tekko', 3)); c.HL(0, 15, 64, OL)                      # 받침대
    for k in range(6):
        x = 2 + k * 10; m = 'sora' if k % 2 else 'pinku'
        c.R(x, 6, 8, 6, K('shiro', 2)); c.HL(x, 6, 8, K(m, 1)); c.VL(x + 7, 6, 6, K('conc', 0)); c.VL(x - 1, 6, 6, OL); c.VL(x + 8, 6, 6, OL)
        c.VL(x + 4, 0, 6, K('ita', 1))                                                                         # 지주
        for (dx, dy) in ((2, 2), (5, 1), (3, 4), (6, 3)): c.P(x + dx, dy, K('midori', 1))
        c.R(x + 1, 0, 3, 2, K('murasaki' if k % 3 else 'sora', 2))


@prop('bike-shelter', '自転車置き場 자전거 보관대(지붕)', 6, 3, solid=[(i, 2) for i in range(6)], tags=['학교', '자전거', '보관대'],
      rules='정문 안쪽·교사 옆(교직원·고학년용). 지붕 밑 두 줄은 뒤로 지나간다, 아래 줄 막힘.')
def _bikes(c):
    W = 96
    c.R(0, 4, W, 9, K('midori', 2)); c.HL(0, 4, W, K('midori', 2))
    for x in range(0, W, 6): c.VL(x, 5, 8, K('midori', 1))
    c.R(0, 13, W, 3, K('tekko', 1)); c.HL(0, 15, W, K('tekko', -2)); c.HL(0, 3, W, OL); c.HL(0, 16, W, OL)
    for px in (2, W - 5): pipe_v(c, px, 16, 46, 'tekko', 1, 3)
    frames = ('aka', 'sora', 'shiro', 'midori', 'kii', 'shiro', 'pinku', 'kon', 'sora', 'aka')
    for k in range(10):                                   # 앞(남)에서 본 ママチャリ: 앞바퀴 세로 타원 + 핸들 + 앞 바구니
        x = 9 + k * 8; m = frames[k]
        c.R(x + 2, 34, 2, 12, K('tekko', -2)); c.VL(x + 2, 35, 10, K('tekko', 0))          # 앞바퀴(타이어 옆면)
        c.R(x + 1, 30, 4, 4, K(m, 1)); c.HL(x + 1, 30, 4, K(m, 2))                         # 앞 흙받이·몸체 색
        c.R(x, 25, 6, 5, K('tekko', 2)); c.HL(x, 25, 6, K('tekko', 3)); c.VL(x + 5, 25, 5, K('tekko', 0))   # 앞 바구니
        for i in range(x + 1, x + 5, 2): c.VL(i, 26, 3, K('tekko', 0))
        c.HL(x - 2, 22, 10, K('tekko', 1)); c.P(x - 2, 22, K('sumi', 1)); c.P(x + 7, 22, K('sumi', 1))   # 핸들
        c.VL(x + 2, 22, 3, K(m, 0)); c.VL(x - 1, 25, 21, OL) if k == 0 else None
    c.HL(4, 46, 88, K('soil', -2)); c.HL(5, 47, 86, K('soil', -1))


@prop('ninomiya', '二宮金次郎像(장작 지고 책 읽는 동상)', 1, 2, solid=[(0, 1)], tags=['학교', '동상'],
      rules='교정 화단 곁·정문 안쪽. 막힘.')
def _ninomiya(c):
    b = 'ki'
    c.R(2, 20, 12, 10, K('conc', 1)); c.HL(2, 20, 12, K('conc', 3)); c.VL(13, 20, 10, K('conc', -1)); c.HL(1, 19, 14, OL); c.VL(1, 20, 10, OL); c.VL(14, 20, 10, OL); c.HL(1, 30, 14, OL)
    c.R(4, 9, 7, 8, K(b, -1)); c.R(10, 7, 4, 8, K(b, -2)); c.HL(10, 7, 4, K(b, 0))                              # 몸 + 등의 장작
    for j in (8, 10, 12): c.HL(10, j, 4, K(b, 1))
    c.R(5, 3, 5, 5, K(b, 0)); c.HL(5, 3, 5, K(b, 1)); c.P(5, 5, K(b, -2))                                        # 머리(숙임)
    c.R(3, 10, 4, 3, K('kinari', 1)); c.HL(3, 10, 4, K(b, 1))                                                    # 책
    c.R(5, 17, 2, 3, K(b, -2)); c.R(8, 17, 2, 3, K(b, -2))
    for (x, y) in ((4, 2), (10, 6), (3, 9), (14, 8)): c.P(x, y, OL)
    c.VL(3, 4, 13, OL); c.VL(14, 7, 10, OL)


@prop('school-gate-l', '正門 小学校 정문(높은 기둥·접힌 철문)', 6, 3, solid=[(0, 2), (5, 2), (1, 2), (4, 2)], tags=['학교', '정문'],
      rules='학교 담(철망·블록 담)의 정문 자리. 가운데 두 칸(x 2·3)이 열린 문(지나감), 양 기둥·접힌 철문 칸은 막힘. 곁에 jp-school-namestone.')
def _gate_l(c):
    for px in (1, 81):                                                                                       # 기둥(콘크리트 + 갓돌)
        c.R(px, 6, 14, 42, K('conc', 1)); c.VL(px, 6, 42, K('conc', 2)); c.VL(px + 13, 6, 42, K('conc', -1))
        for j in range(12, 46, 8): c.HL(px, j, 14, K('conc', 0))
        c.R(px - 1, 2, 16, 4, K('conc', 2)); c.HL(px - 1, 2, 16, K('conc', 3)); c.HL(px - 1, 5, 16, K('conc', -1))
        c.HL(px - 2, 1, 18, OL); c.VL(px - 2, 2, 4, OL); c.VL(px + 15, 2, 4, OL); c.VL(px - 1, 6, 42, OL); c.VL(px + 14, 6, 42, OL)
        c.R(px + 4, 14, 6, 4, K('kii', 1)); c.HL(px + 4, 14, 6, K('kii', 2))                                   # 문등
    c.R(85, 22, 6, 18, K('ita', 1)); c.VL(85, 22, 18, K('ita', 2))                                            # 오른쪽 기둥 명판(세로 나무판)
    for j in range(25, 38, 3): c.HL(86, j, 4, K('sumi', 1))
    for x0 in (16, 64):                                                                                      # 접힌 아코디언 철문
        c.R(x0, 24, 16, 22, K('tekko', 2)); c.HL(x0, 24, 16, K('tekko', 3)); c.HL(x0, 45, 16, K('tekko', -1))
        for i in range(x0 + 1, x0 + 16, 3): c.VL(i, 25, 20, K('tekko', 0)); c.P(i + 1, 34, K('tekko', 3))
        c.VL(x0 - 1, 24, 22, OL); c.VL(x0 + 16, 24, 22, OL); c.HL(x0, 23, 16, OL)
    c.R(32, 44, 32, 4, K('tekko', 0)); c.HL(32, 45, 32, K('tekko', -2))                                       # 바닥 레일
    shadow(c, 0, 48 - 1, 96)


@prop('school-namestone', '校名碑 학교 이름 돌(小学校)', 4, 2, solid=[(0, 1), (1, 1), (2, 1), (3, 1)], tags=['학교', '정문', '이름'],
      rules='정문 곁 담 안쪽(교정 쪽). 아래 줄 막힘.')
def _namestone(c):
    c.R(2, 6, 60, 20, K('conc', 0)); c.HL(2, 6, 60, K('conc', 2)); c.HL(2, 7, 60, K('conc', 1)); c.VL(2, 6, 20, K('conc', 2)); c.VL(61, 6, 20, K('conc', -2))
    c.R(4, 9, 56, 16, K('conc', -1))
    SP.text(c, 6, 9, '小学校', K('shiro', 1), step=19)
    c.HL(1, 5, 62, OL); c.VL(1, 6, 20, OL); c.VL(62, 6, 20, OL)
    c.R(0, 26, 64, 4, K('conc', 1)); c.HL(0, 26, 64, K('conc', 2)); c.HL(0, 29, 64, K('conc', -2)); c.HL(0, 30, 64, OL)
    shadow(c, 0, 31, 64)


# ─────────────────────────── 수영장 ───────────────────────────
PW, PH = 20, 11


def _pool_ground(c):
    """1층: 데크(밝은 콘크리트) + 물(막힘 solidfloor 칸). 물 = 칸 (2..17, 3..8)."""
    W, H = PW * 16, PH * 16
    c.R(0, 0, W, H, K('conc', 2))
    for x in range(0, W, 16): c.VL(x, 0, H, K('conc', 1))
    for y in range(0, H, 16): c.HL(0, y, W, K('conc', 1))
    x0, y0, x1, y1 = 32, 48, 18 * 16, 9 * 16
    c.R(x0, y0, x1 - x0, y1 - y0, K('sora', 1))
    c.R(x0, y0, x1 - x0, 5, K('sora', -1)); c.HL(x0, y0 + 5, x1 - x0, K('sora', 0))                             # 북쪽 벽 안쪽 면(남향) + 그늘
    for y in range(y0 + 10, y1, 3):                                                                              # 잔물결
        for x in range(x0 + ((y * 5) % 11), x1, 11): c.HL(x, y, 3, K('sora', 2))
    for k in range(1, 5):                                                                                        # 코스 줄(흰·빨강 부표)
        yy = y0 + 5 + k * (y1 - y0 - 5) // 5
        for x in range(x0, x1, 2): c.P(x, yy, K('aka', 1) if (x // 8) % 2 else K('shiro', 2))
    c.HL(x0 - 1, y0 - 1, x1 - x0 + 2, K('conc', 3)); c.VL(x0 - 1, y0, y1 - y0, K('conc', 3))
    c.HL(x0, y1, x1 - x0, K('conc', 0)); c.VL(x1, y0, y1 - y0, K('conc', 0))
    for k in range(5):                                                                                           # 출발대(서쪽)
        yy = y0 + 2 + k * (y1 - y0 - 6) // 5
        c.R(18, yy, 12, 7, K('shiro', 1)); c.HL(18, yy, 12, K('shiro', 2)); c.HL(18, yy + 6, 12, K('conc', 0)); c.VL(17, yy, 7, OL)


@prop('pool', 'プール 25m 학교 수영장(물·코스 줄·출발대·철망·탈의실)', PW, PH,
      solid=[(x, 0) for x in range(PW)] + [(x, 1) for x in range(PW)] + [(0, y) for y in range(PH)] + [(PW - 1, y) for y in range(PH)]
            + [(x, PH - 1) for x in range(PW) if x not in (9, 10)],
      ground=_pool_ground, ground_solid=[(x, y) for x in range(2, 18) for y in range(3, 9)],
      tags=['학교', '수영장'], role='building',
      rules='교정 구석(체육관 곁). 가장자리 철망·북쪽 탈의실은 막힘, 남쪽 철망 가운데 두 칸(x 9·10)이 입구(발 씻는 곳). 물(1층 solidfloor)은 들어가지 못한다. 데크는 걸음.')
def _pool(c):
    W, H = PW * 16, PH * 16
    # 북쪽 탈의실 + 뒤 철망(위 두 줄)
    c.R(0, 2, W, 22, K('midori', -1))
    for y in range(4, 24):
        for x in range(0, W):
            if (x + y) % 4 == 0 or (x - y) % 4 == 0: c.P(x, y, K('midori', 1))
    c.R(96, 0, 128, 28, K('kinari', 1)); c.HL(96, 0, 128, K('conc', 2)); c.HL(96, 3, 128, K('conc', 0)); c.VL(96, 0, 28, K('kinari', 2)); c.VL(223, 0, 28, K('kinari', -1))
    for x0 in (106, 170): c.R(x0, 10, 16, 18, K('ita', -1)); c.VL(x0 + 13, 18, 3, K('tekko', 2)); c.VL(x0 - 1, 10, 18, OL); c.VL(x0 + 16, 10, 18, OL)
    c.R(136, 8, 24, 8, K('garasu', 1)); c.HL(136, 8, 24, K('garasu', 3)); c.VL(147, 8, 8, K('conc', 1))
    c.HL(95, -1, 130, OL); c.VL(95, 0, 29, OL); c.VL(224, 0, 29, OL); c.HL(0, 28, W, K('conc', 0)); c.HL(0, 29, W, OL)
    # 옆 철망(세로 기둥 + 망)
    for x0 in (0, W - 16):
        for y in range(24, H - 12):
            for x in range(x0 + 4, x0 + 12):
                if (x + y) % 4 == 0: c.P(x, y, K('midori', 0))
        pipe_v(c, x0 + 7, 22, H - 12, 'midori', 0, 2)
    # 남쪽 철망(앞) — 가운데 입구 두 칸 비움
    for y in range(H - 26, H - 2):
        for x in range(0, W):
            if 144 <= x < 176: continue
            if (x + y) % 4 == 0 or (x - y) % 4 == 0: c.P(x, y, K('midori', 0))
    for x0, x1 in ((0, 144), (176, W)):
        c.HL(x0, H - 27, x1 - x0, K('midori', 1)); c.HL(x0, H - 28, x1 - x0, OL); c.HL(x0, H - 2, x1 - x0, OL)
        for px in range(x0 + 2, x1, 32): pipe_v(c, px, H - 28, H - 2, 'midori', 0, 2)
    for px in (142, 176): pipe_v(c, px, H - 30, H - 2, 'tekko', 1, 3)
    c.R(147, H - 10, 26, 6, K('sora', 0)); c.HL(147, H - 10, 26, K('conc', 3))                                    # 발 씻는 곳


# ─────────────────────────── 굽기 ───────────────────────────
def _render(fn, w, h):
    c = Cv(w * 16, h * 16)
    fn(c)
    return c.a


def _cut(a, R, C, key_of, add):
    grid = []
    for cy in range(R):
        row = []
        for cx in range(C):
            t = a[cy * 16:(cy + 1) * 16, cx * 16:(cx + 1) * 16].copy()
            if not t[:, :, 3].any(): row.append(None); continue
            t[t[:, :, 3] == 0] = 0
            row.append(add(cx, cy, t))
        grid.append(row)
    return grid


def _finalize():
    if 'r' in _CACHE: return _CACHE['r']
    cells = collections.OrderedDict(); seen = {}; kits = []; sprites = {}
    for p in P:
        R, C = p['h'], p['w']

        def adder(layer):
            def add(cx, cy, t):
                if layer == 'base': pc = 'solidfloor' if (cx, cy) in set(map(tuple, p['ground_solid'])) else 'floor'
                else: pc = 'solid' if (cx, cy) in set(map(tuple, p['solid'])) else p['other']
                key = (t.tobytes(), pc)
                if key in seen: return seen[key]
                local = '%s/%s%d.%d' % (p['id'], 'g' if layer == 'base' else '', cx, cy)
                seen[key] = local
                kind = '[교정 바닥]' if layer == 'base' else '[학교 소품]'
                cells[local] = dict(img=Image.fromarray(t, 'RGBA'), pc=pc, label='%s 칸 (%d,%d)%s' % (p['name'], cx, cy, ' 바닥' if layer == 'base' else ''),
                                    desc='%s %s 의 일부. 키트 jp-%s 로 통째로 놓는다.' % (kind, p['name'], p['id']), tags=list(p['tags']))
                return local
            return add
        base = _cut(_render(p['ground'], C, R), R, C, None, adder('base')) if p['ground'] else None
        grid = _cut(_render(p['draw'], C, R), R, C, None, adder('grid')) if p['draw'] else [[None] * C for _ in range(R)]
        if p['ground'] and not p['draw']: sprites[p['id']] = _render(p['ground'], C, R)
        else:
            g = _render(p['ground'], C, R) if p['ground'] else np.zeros((R * 16, C * 16, 4), np.uint8)
            u = _render(p['draw'], C, R); m = u[:, :, 3] > 0; g[m] = u[m]; sprites[p['id']] = g
        desc = '%s — 폭 %d칸×높이 %d칸. 손 도트 일본 小学校 교정(modern3, 빛 왼쪽 위, 정면 고정 3/4).' % (p['name'], C, R)
        if p['other'] == 'flat': desc += ' 투명 덧그림(2층).'
        if p['ground']: desc += ' 바닥 칸(1층) 포함.'
        ai = dict(snap='floor', tags=list(p['tags']), description=desc, placementRules=p['rules'],
                  repeatability='repeat' if p['repeat'] else 'fixed', growthAxis=p['repeat'],
                  anchor=dict(dx=0, dy=R - 1), access=[], role=p['role'])
        parts = []
        if p['id'] == 'pool': parts = [dict(kind='anchor', x=9, y=PH - 1, w=2, h=1, label='수영장 입구(발 씻는 곳)')]
        kits.append(dict(id='jp-' + p['id'], name=p['name'], grid=grid, base=base, parts=parts, ai=ai))
    groups = [
        dict(id='jp:school-ground', name='校庭 흙 바닥', role='terrain', defaultLayer='lower',
             cells=[k for k, v in cells.items() if k.startswith('school-ground-')], desc='학교 운동장·교정의 다진 흙(A·B·C 변형).',
             rules='paint_tiles·fill 로 1층에 깐다. 세 변형을 섞는다.'),
        dict(id='jp:school-track', name='운동장 트랙 선', role='detail', defaultLayer='upper',
             cells=[k for k, v in cells.items() if k.startswith('school-track/')], desc='트랙 흰 분필 선(투명 덧그림).',
             rules='키트 jp-school-track 으로 통째로 2층에 찍는다.'),
    ]
    _CACHE['r'] = (cells, kits, sprites, groups)
    return _CACHE['r']


_CACHE = {}
NOTES = ('손 도트 小学校 교정 %d종(校庭 흙 바닥·트랙 선·철봉·조례대·게양대·정글짐·운제·타이어·골대·방구망·체육 창고·百葉箱·사육장·화단·나팔꽃·자전거 보관대·二宮金次郎像·수영장). '
         '바닥(흙·수영장 데크·물)은 1층, 트랙 선은 2층 투명 덧그림, 나머지 3층. 한계: 교사 실내 없음, 밤 조명 없음.')


def build():
    cells, kits, sprites, groups = _finalize()
    return {'cells': collections.OrderedDict((k, dict(v, img=v['img'].copy(), tags=list(v['tags']))) for k, v in cells.items()),
            'autotiles': [], 'groups': [dict(g, cells=list(g['cells'])) for g in groups], 'kits': [dict(k) for k in kits], 'notes': NOTES % len(kits)}


def render_all():
    os.makedirs(OUTDIR, exist_ok=True)
    cells, kits, sprites, groups = _finalize()
    ims = []
    for kit in kits:
        g = kit['grid']; R, C = len(g), len(g[0])
        im = Image.new('RGBA', (C * 16, R * 16), (0, 0, 0, 0))
        for yy in range(R):
            for xx in range(C): im.alpha_composite(cells['school-ground-a/g0.0']['img'], (xx * 16, yy * 16))
        for layer in (kit['base'], g):
            if not layer: continue
            for y in range(R):
                for x in range(C):
                    if layer[y][x]: im.alpha_composite(cells[layer[y][x]]['img'], (x * 16, y * 16))
        im.save(os.path.join(OUTDIR, kit['id'] + '.png')); ims.append((kit['id'], im))
    W = 1100; x = y = 0; rowh = 0; pos = []
    for _, im in ims:
        if x + im.width > W: x = 0; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += im.width + 8; rowh = max(rowh, im.height)
    S = Image.new('RGBA', (W, y + rowh), (104, 103, 122, 255))
    for (_, im), p in zip(ims, pos): S.alpha_composite(im, p)
    S.resize((S.width * 2, S.height * 2), Image.NEAREST).save(os.path.join(OUTDIR, '_all-x2.png'))


def selftest(verbose=True, render=True):
    out = []
    b = build(); cells, kits, sprites, groups = _finalize()
    for k, c in b['cells'].items():
        for m in check_cell(c['img']): out.append('(a) %s: %s' % (k, m))
    for kit in kits:
        p = next(q for q in P if 'jp-' + q['id'] == kit['id'])
        a = sprites[p['id']].copy(); a[a[:, :, 3] == 0] = 0
        R, C = p['h'], p['w']; re_ = np.zeros_like(a)
        for layer in (kit['base'], kit['grid']):
            if not layer: continue
            for y in range(R):
                for x in range(C):
                    if layer[y][x]:
                        t = np.array(b['cells'][layer[y][x]]['img']); m = t[:, :, 3] > 0
                        blk = re_[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]; blk[m] = t[m]
        if not (re_ == a).all(): out.append('(b) %s 재조립 불일치' % kit['id'])
        for (sx, sy) in p['solid']:
            if kit['grid'][sy][sx] is None: out.append('(e) %s 막힘 칸 (%d,%d) 이 비었다' % (kit['id'], sx, sy))
    ids = [k['id'] for k in kits]
    if len(ids) != len(set(ids)): out.append('(e) 키트 id 중복')
    if render: render_all()
    if verbose:
        print('school — 키트 %d · 고유 칸 %d' % (len(kits), len(b['cells'])))
        for m in out: print('  ✗', m)
    return len(out)


if __name__ == '__main__':
    sys.exit(1 if selftest() else 0)
