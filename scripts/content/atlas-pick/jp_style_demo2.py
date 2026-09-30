#!/usr/bin/env python3
"""일본 세트 「새 결(v2)」 데모 2차 — 같은 32×24칸 거리 장면에서 「벽이 평평하다 · 지붕이 판때기다 · 가로수가 작다」 세 약점을 고친다.

  python3 scripts/content/atlas-pick/jp_style_demo2.py --png   # → style-demo-jp2/street/dm3-D.pxg (+ .png). 1차(dm2-D.*)는 건드리지 않는다.

1차(jp_style_demo.py)의 바닥·차도·보도·소품·전선·철도를 그대로 쓰고(그 모듈을 불러 와 함수만 바꿔 끼운다),
윗층 벽 · 1층 가게 깊이 · 낮은 건물 지붕/남쪽 벽 · 가로수만 새로 그린다. 근거 = tiledata/atlas-pick/jp-style-v2.md 「공간감」 절.

규칙은 1차와 같다: 보간·난수·그라데이션 함수 없음, 반투명 없음(그림자는 어두운 단으로 굽는다), 윤곽은 재료의 어두운 보라 단.
새로 생긴 도구 하나 = sh()/lf(): 「이 네모 안의 픽셀을 한 단 어둡게/밝게」. 색을 섞는 게 아니라 같은 램프의 단 번호만 손으로 고른
칸에서 내리는 것(드리운 그림자 = 벽 색은 그대로, 단만 -1~-2). only= 로 그림자가 떨어지는 재료(벽·바닥)만 골라 칠한다.
"""
import os, sys, re
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import jp_style_demo as J
from jp_style_demo import P, R, HL, VL, FR, SP, disc, bevel, K, SUMI0, SUMI1, text, glyph, vtext, vsign, W, H, cv, emit

RM = {}
for _ln in open(os.path.join(J.PAL_DIR, 'jp2.pal'), encoding='utf-8'):
    _m = re.match(r'@rampc\s+(\w+)\s+(.*)', _ln)
    if _m: RM[_m.group(1)] = len(_m.group(2).split())
OUT_DIR = os.path.join(J.BASE, 'style-demo-jp2', 'street')

def C(r, t): return (r, max(0, min(RM[r] - 1, t)))

def sh(x, y, w, h, d=1, only=None):
    """드리운 그림자: 네모 안 픽셀의 단을 d 만큼 내림(램프는 그대로). only = 그림자가 떨어질 재료 램프들."""
    for yy in range(max(y, 0), min(y + h, H)):
        for xx in range(max(x, 0), min(x + w, W)):
            c = cv[yy][xx]
            if c is None or (only and c[0] not in only): continue
            cv[yy][xx] = (c[0], max(0, c[1] - d))

def lf(x, y, w, h, d=1, only=None):
    for yy in range(max(y, 0), min(y + h, H)):
        for xx in range(max(x, 0), min(x + w, W)):
            c = cv[yy][xx]
            if c is None or (only and c[0] not in only): continue
            cv[yy][xx] = (c[0], min(RM[c[0]] - 1, c[1] + d))

def cast_r(x, ytop, ybot, L, d1=2, d2=1, only=None):
    """서 있는 물체가 오른쪽 아래로 드리우는 그림자: 발치 (x.., ytop~ybot) 에서 L 칸, 두 칸마다 한 줄 내려감. 앞 60% 는 -d1, 뒤는 -d2."""
    for i in range(L):
        sh(x + i, ytop + i // 2, 1, ybot - ytop + 1, d1 if i < L * 0.6 else d2, only)

# ═══════════════════════════ 벽 (윗층) ═══════════════════════════
def wall_floor(x, y0, w, ramp, t, top_shadow=True, joint=32):
    """벽 한 층(16px): 위 3줄 = 윗층 슬래브가 드리운 그림자(-2,-1,-1) · 본벽 · 아래 3줄 = 슬래브(윗면 밝게·앞면·아랫모서리 어둡게)."""
    R(x, y0, w, 16, C(ramp, t))
    if top_shadow:
        HL(x, y0, w, C(ramp, t - 3)); HL(x, y0 + 1, w, C(ramp, t - 2)); HL(x, y0 + 2, w, C(ramp, t - 1))
    for xj in range(x + joint, x + w - 6, joint):                                                   # 패널 줄눈: 어두운 줄 + 옆 밝은 줄(파낸 홈)
        VL(xj, y0 + 3, 10, C(ramp, t - 1)); VL(xj + 1, y0 + 3, 10, C(ramp, t + 1))
    HL(x, y0 + 13, w, C(ramp, t + 3)); HL(x, y0 + 14, w, C(ramp, t + 1)); HL(x, y0 + 15, w, C(ramp, t - 3))

def win2(x, y, w, kind='lit', var=0, ramp='usu', t=4):
    """들어간 창(유리 w×7): 위 2줄·왼 1줄 = 창틀이 드리운 그늘 · 문턱 윗면(밝게)+앞면 · 문턱 밑 그림자 한 줄(벽에 떨어짐)."""
    h = 7
    FR(x - 1, y - 1, w + 2, h + 2, C(ramp, t - 3))
    r, b = {'lit': ('mado', 3), 'glass': ('garasu', 2), 'dark': ('kon', 1)}[kind]
    R(x, y, w, h, C(r, b))
    if kind == 'lit':
        HL(x, y + h - 1, w, C('mado', 2))
        if var % 3 == 0: R(x + 2, y + h - 3, 4, 3, C('mado', 1))                                     # 창가 화분·사람 그림자
        if var % 3 == 1: R(x + w - 6, y + 1, 4, h - 1, C('mado', 2))                                 # 반쯤 친 커튼
    if kind == 'glass':
        for i in range(5): P(x + 2 + i * 2, y + 1 + i, C('garasu', 5)); P(x + 3 + i * 2, y + 1 + i, C('garasu', 5))
        HL(x, y + h - 1, w, C('garasu', 1))
    if kind == 'dark':
        R(x + 3, y + 3, 5, 4, C('kon', 0)); HL(x + 12, y + 2, 3, C('kon', 2))
    sh(x, y, w, 1, 2); sh(x, y + 1, w, 1, 1); sh(x, y + 2, 1, h - 2, 1)                             # 안쪽 그늘
    if w >= 12: VL(x + w // 2, y, h, C(ramp, t - 3)); VL(x + w // 2 + 1, y + 2, h - 2, C(ramp, t))
    HL(x - 1, y + h, w + 2, C(ramp, t + 3)); HL(x - 1, y + h + 1, w + 2, C(ramp, t)); HL(x, y + h + 2, w + 2, C(ramp, t - 1))   # 문턱

def acunit2(x, y, ramp='usu', t=4):
    """벽걸이 실외기: 윗면 밝게 · 앞면 · 오른쪽 옆면(어둡게) · 벽에 드리운 그림자 · 아래로 내려가는 관."""
    sh(x + 1, y + 6, 10, 2, 2, (ramp,)); sh(x + 10, y + 1, 2, 6, 1, (ramp,))
    R(x, y, 8, 5, C('tekko', 4)); HL(x, y, 8, C('tekko', 5)); VL(x, y, 5, C('tekko', 5)); HL(x, y + 4, 8, C('tekko', 2))
    R(x + 8, y + 1, 2, 4, C('tekko', 1)); P(x + 8, y, C('tekko', 3)); P(x + 9, y, C('tekko', 2))
    disc(x + 4, y + 2, 1, C('tekko', 1)); P(x + 4, y + 2, C('tekko', 3))
    FR(x - 1, y - 1, 12, 7, C(ramp, t - 3))
    VL(x + 2, y + 6, 4, C('tekko', 3)); VL(x + 3, y + 6, 4, C('tekko', 1))

def pipe(x, y0, y1, ramp='usu', t=4):
    """벽 세로 배관: 왼쪽 밝게 · 오른쪽 어둡게 · 16px 마다 고정쇠 · 오른쪽 벽에 그림자 한 줄."""
    sh(x + 3, y0, 1, y1 - y0, 1, (ramp,))
    R(x, y0, 3, y1 - y0, C('tekko', 3)); VL(x, y0, y1 - y0, C('tekko', 5)); VL(x + 2, y0, y1 - y0, C('tekko', 1))
    for yy in range(y0 + 6, y1, 16): R(x - 1, yy, 5, 2, C('tekko', 4)); HL(x - 1, yy + 1, 5, C('tekko', 1))

def pier(x, ramp, t, wf=3, ws=3, y1=96):
    """튀어나온 벽 모서리: 앞면(밝게, 왼쪽 빛) + 오른쪽 옆면(어둡게) — 옆 건물 쪽 벽에는 그림자가 떨어진다."""
    R(x, 0, wf, y1, C(ramp, t + 1)); VL(x, 0, y1, C(ramp, t + 2))
    R(x + wf, 0, ws, y1, C(ramp, t - 2)); VL(x + wf + ws - 1, 0, y1, C(ramp, t - 3)); VL(x - 1, 0, y1, C(ramp, t - 3))
    for k in range(4):
        HL(x, 16 * k + 13, wf, C(ramp, t + 3)); HL(x, 16 * k + 15, wf + ws, C(ramp, t - 3))
    R(x + wf, 62, ws, 2, C(ramp, t - 3))
    sh(x + wf + ws, 0, 2, y1, 2, ('usu', 'momo')); sh(x + wf + ws + 2, 0, 3, y1, 1, ('usu', 'momo'))

def upper_A(x):   # 잡거빌딩: 연보라 벽 · 슬래브 층띠 · 들어간 창 · 세로 간판 · 배관 · 튀어나온 모서리
    for k, t in enumerate((5, 4, 4, 3)):
        wall_floor(x, 16 * k, 128, 'usu', t, top_shadow=k > 0)
        for i, wx in enumerate((6, 32, 58)):
            win2(x + wx, 16 * k + 3, 18, 'glass' if (k + i) % 3 == 0 else ('lit' if (k * 3 + i) % 4 != 1 else 'dark'), k + i, 'usu', t)
        VL(x + 27, 16 * k + 6, 5, C('usu', t - 1)); VL(x + 53, 16 * k + 5, 6, C('usu', t - 1))          # 창 옆 물때 줄
    pipe(x + 114, 0, 62)
    acunit2(x + 102, 16 * 1 + 5); acunit2(x + 102, 16 * 3 + 5)
    vsign(x + 86, 6, 'ラーメン', 'aka', 'shiro'); vsign(x + 71, 20, 'BAR', 'sora', 'shiro', latin=True)

def upper_B(x):   # 편의점 윗층: 흰 타일 벽(잔 줄눈) · 24H 상자 간판(윗면·옆면 있음) · 리본 유리창
    for k, t in enumerate((5, 5, 5, 4)):
        wall_floor(x, 16 * k, 128, 'usu', t, top_shadow=k > 0, joint=16)
        for yy in range(16 * k + 5, 16 * k + 12, 3): HL(x, yy, 128, C('usu', t - 1)) if False else None
        if k == 1:
            bx, by = x + 10, 16 + 4
            R(bx + 36, by - 2, 2, 12, C('sora', 1)); R(bx, by - 2, 38, 2, C('sora', 5))               # 상자 간판: 윗면 · 오른쪽 옆면
            bevel(bx, by, 36, 10, 'sora', 3, out=SUMI1); text(bx + 3, by + 1, '24H', K('shiro', 5), pitch=7, bold=True)
            sh(bx + 2, by + 10, 38, 2, 2, ('usu',))
            R(x + 52, 16 + 3, 68, 8, C('garasu', 2)); HL(x + 52, 16 + 3, 68, C('garasu', 4)); FR(x + 51, 16 + 2, 70, 10, C('usu', 2))
            for i in range(4): VL(x + 66 + i * 14, 16 + 3, 8, C('usu', 1)); P(x + 68 + i * 14, 16 + 5, C('garasu', 5))
            sh(x + 52, 16 + 3, 68, 2, 2); HL(x + 51, 16 + 11, 70, C('usu', 6)); HL(x + 51, 16 + 12, 70, C('usu', 3))
        else:
            for i in range(4): win2(x + 6 + i * 30, 16 * k + 3, 24, 'glass' if (i + k) % 2 == 0 else 'lit', i + k, 'usu', t)
    acunit2(x + 6, 32 + 5) if False else None

def upper_C(x):   # 분홍 벽돌 아파트: 벽돌 줄눈 · 튀어나온 발코니(슬래브 윗면·난간 막대·안쪽 그늘) · 창 · 실외기
    for k in range(4):
        wall_floor(x, 16 * k, 128, 'momo', 3, top_shadow=k > 0, joint=128)
        for j in range(4): HL(x, 16 * k + 3 + j * 3, 128, C('momo', 2))                             # 벽돌 줄눈
        for j in range(4):
            for bxx in range((j % 2) * 3, 128, 6): VL(x + bxx, 16 * k + 3 + j * 3 + 1, 2, C('momo', 2))
        y0 = 16 * k
        for bx, laundry in ((8, k % 2 == 0), (40, k % 2 == 1)):
            R(x + bx, y0 + 2, 22, 11, C('kon', 1)); FR(x + bx - 1, y0 + 1, 24, 13, SUMI1)
            sh(x + bx, y0 + 2, 22, 2, 1); HL(x + bx, y0 + 2, 22, C('kon', 0)); VL(x + bx, y0 + 2, 11, C('kon', 0))    # 안쪽 그늘
            if laundry:
                for q, cc in enumerate(('sora', 'shiro', 'pinku')): R(x + bx + 3 + q * 6, y0 + 4, 4, 5, C(cc, 4)); HL(x + bx + 3 + q * 6, y0 + 4, 4, C(cc, 5))
                HL(x + bx + 1, y0 + 3, 20, C('tekko', 3))
            R(x + bx - 2, y0 + 12, 26, 1, C('momo', 5)); R(x + bx - 2, y0 + 8, 26, 1, C('shiro', 4))     # 슬래브 윗면(밝게) · 난간 윗대
            for q in range(1, 22, 3): VL(x + bx + q, y0 + 9, 3, C('shiro', 3)); P(x + bx + q + 1, y0 + 10, C('kon', 0))   # 난간 살 + 안쪽 살 그림자
            sh(x + bx - 2, y0 + 16, 27, 2, 1, ('momo',))
        win2(x + 78, y0 + 3, 18, 'lit' if k != 2 else 'glass', k, 'momo', 3)
        acunit2(x + 100, y0 + 5, 'momo', 3)
    pipe(x + 118, 0, 62, 'momo', 3)

def upper_D(x):   # 사무실: 창 사이 튀어나온 기둥(앞면·옆면·드리운 그림자) + 띠창 + 창밑 패널
    for k, t in enumerate((4, 3, 3, 3)):
        wall_floor(x, 16 * k, 128, 'usu', t, top_shadow=k > 0, joint=128)
        y0 = 16 * k
        for i in range(4):
            win2(x + 12 + i * 28, y0 + 3, 18, 'lit' if (i + 2 * k) % 3 != 1 else 'glass', i + k, 'usu', t)
            R(x + 12 + i * 28, y0 + 11, 18, 2, C('usu', t - 1)); HL(x + 12 + i * 28, y0 + 12, 18, C('usu', t - 2))   # 창밑 패널
        for i in range(5):                                                                            # 튀어나온 기둥
            cx = x + 4 + i * 28
            sh(cx + 5, 0, 2, 64, 2, ('usu',)) if k == 0 else None
            R(cx, y0, 3, 16, C('usu', t + 2)); VL(cx, y0, 16, C('usu', t + 3)); R(cx + 3, y0, 2, 16, C('usu', t - 2)); VL(cx - 1, y0, 16, C('usu', t - 3)); VL(cx + 4, y0, 16, C('usu', t - 3))
            HL(cx, y0 + 13, 5, C('usu', t + 3)); HL(cx, y0 + 15, 5, C('usu', t - 3))
        for i in range(3): acunit2(x + 32 - 22 + 28 * i + 22, y0 + 5, 'usu', t) if (i + k) % 2 == 0 and False else None

WALLS = {'A': upper_A, 'B': upper_B, 'C': upper_C, 'D': upper_D}

# ═══════════════════════════ 1층 가게: 들어간 입구 · 처마 그림자 · 주춧돌 ═══════════════════════════
def recess(x, y, w, h, only):
    sh(x, y, w, 2, 2, only); sh(x, y + 2, w, 2, 1, only); sh(x, y, 2, h, 1, only)                     # 열린 입구: 천장 그늘 + 왼쪽 벽 그늘

def shop_depth():
    for i, x in enumerate((0, 128, 256, 384)):
        y = 64
        if i != 2: sh(x, y, 128, 2, 2, ('usu',)); sh(x, y + 2, 128, 2, 1, ('usu',))               # 윗층 슬래브가 드리운 그림자
    # A 라멘집 · 입구
    recess(10, 79, 52, 17, ('mado', 'moku')); recess(79, 73, 23, 23, ('garasu',))
    # B 편의점
    recess(134, 80, 40, 15, ('shiro', 'tekko')); recess(179, 80, 28, 15, ('garasu',)); recess(210, 80, 38, 15, ('shiro', 'tekko'))
    # C 이자카야
    recess(265, 78, 34, 13, ('mado', 'moku')); recess(320, 78, 34, 18, ('mado', 'moku'))
    # D 카페 · 셔터 가게
    recess(393, 86, 42, 10, ('mado', 'moku')); recess(442, 80, 8, 16, ('mado', 'moku')); sh(460, 67, 46, 2, 2, ('tekko',))
    for x in (0, 128, 256, 384):                                                                    # 주춧돌(윗면 밝게)
        HL(x, 92, 128, C('conc', 5)); HL(x, 93, 128, C('conc', 3)); HL(x, 94, 128, C('conc', 2))

def piers():
    pier(122, 'usu', 4, 3, 3); pier(250, 'usu', 5, 3, 3)                                            # A: 크게 · B: 뒷면 살짝
    pier(376, 'momo', 3, 3, 5)                                                                       # C: 가장 깊이 튀어나온 아파트 모서리
    VL(383, 0, 96, C('sumi', 1))

# ═══════════════════════════ 지붕 · 남쪽 벽 ═══════════════════════════
def box3d(x, y, w, hf, ht, sw, ramp, t):
    """직육면체(위에서 살짝 내려다봄): 윗면(밝게) ht줄 · 앞면 hf줄 · 오른쪽 옆면 sw 칸(어둡게). 좌표 = 윗면 왼쪽 위."""
    R(x, y, w + sw, ht, C(ramp, t + 2)); HL(x, y, w + sw, C(ramp, t + 3))
    R(x, y + ht, w, hf, C(ramp, t)); VL(x, y + ht, hf, C(ramp, t + 1)); HL(x, y + ht + hf - 1, w, C(ramp, t - 1))
    if sw: R(x + w, y + ht, sw, hf, C(ramp, t - 2)); HL(x + w, y + ht, sw, C(ramp, t))
    VL(x, y, ht + hf, C(ramp, t + 3))
    FR(x - 1, y - 1, w + sw + 2, ht + hf + 2, SUMI1)

def roof2(x, y, w, h, ramp, t, floor_only=False):
    """지붕 바닥 + 난간 두께: 뒷난간 = 윗면 2줄 + 안쪽 벽면 6줄(볼 수 있는 쪽) · 좌우 = 윗면 3칸 · 앞난간 = 윗면 3줄. 바닥에는 난간이 드리운 그림자."""
    R(x, y, w, h, C(ramp, t))
    ix0, ix1, iy0, iy1 = x + 3, x + w - 3, y + 8, y + h - 3
    R(ix0, iy0, ix1 - ix0, iy1 - iy0, C(ramp, t))
    for sx in range(x + 40, x + w - 8, 40): VL(sx, iy0 + 4, iy1 - iy0 - 4, C(ramp, t - 1)); VL(sx + 1, iy0 + 4, iy1 - iy0 - 4, C(ramp, t + 1))   # 방수 시트 이음
    for yy in (y + 8 + 34,): HL(ix0 + 3, yy, ix1 - ix0 - 6, C(ramp, t - 1)); HL(ix0 + 3, yy + 1, ix1 - ix0 - 6, C(ramp, t + 1))
    for (px, py, pw, ph) in ((ix0 + 22, iy0 + 22, 9, 3), (ix1 - 40, iy1 - 14, 7, 3), (ix0 + 60, iy1 - 9, 11, 3)):                      # 얼룩
        R(px, py, pw, ph, C(ramp, t - 1))
    # 뒷난간(안쪽 벽면)
    R(x, y, w, 8, C('kinari', 3)); HL(x, y, w, C('kinari', 5)); HL(x, y + 1, w, C('kinari', 4))
    for j, tt in enumerate((3, 3, 3, 2, 2, 1)): HL(x, y + 2 + j, w, C('kinari', tt))
    for jx in range(x + 24, x + w - 6, 24): VL(jx, y + 2, 5, C('kinari', 2))                         # 벽면 줄눈
    # 좌우 난간 윗면
    R(x, y, 3, h, C('kinari', 4)); VL(x, y, h, C('kinari', 5)); R(x + w - 3, y, 3, h, C('kinari', 3)); VL(x + w - 1, y, h, C('kinari', 2))
    VL(x + 3, y + 8, h - 11, C('kinari', 2)); VL(x + w - 4, y + 8, h - 11, C('kinari', 4))          # 안쪽 면(왼쪽은 그늘 · 오른쪽은 빛)
    # 앞난간 윗면
    HL(x, y + h - 3, w, C('kinari', 5)); HL(x, y + h - 2, w, C('kinari', 4)); HL(x, y + h - 1, w, C('kinari', 3))
    FR(x - 1, y - 1, w + 2, h + 2, SUMI1)
    # 난간이 바닥에 드리운 그림자
    fl = (ramp,)
    sh(ix0, iy0, ix1 - ix0, 2, 2, fl); sh(ix0, iy0 + 2, ix1 - ix0, 2, 1, fl); sh(ix0, iy0, 3, iy1 - iy0, 1, fl); sh(ix0, iy0, 1, iy1 - iy0, 1, fl)
    sh(ix0, iy1 - 2, ix1 - ix0, 2, 1, fl)                                                            # 앞난간 바로 안쪽 그늘

def water_tank2(x, y):
    """물탱크: 다리 발판 위 원통(가로 띠 5단 명암) · 뾰족한 뚜껑 · 다리 사이 어둠 · 오른쪽 아래로 길게 드리운 그림자."""
    F = ('conc', 'usu')
    cast_r(x + 30, y + 33, y + 37, 16, 2, 1, F)                                                      # 드리운 그림자
    sh(x + 2, y + 31, 28, 5, 2, F)                                                                    # 통 밑 그늘
    for lx in (x + 3, x + 12, x + 20, x + 27): R(lx, y + 26, 2, 9, C('tekko', 3)); P(lx, y + 26, C('tekko', 5)); VL(lx + 1, y + 27, 8, C('tekko', 1))
    for k in range(8): P(x + 5 + k, y + 28 + (k % 2), C('tekko', 2)); P(x + 26 - k, y + 28 + (k % 2), C('tekko', 2))
    HL(x, y + 26, 32, C('tekko', 4)); HL(x, y + 27, 32, C('tekko', 1)); HL(x + 1, y + 35, 30, SUMI1)
    for (a, b, tt) in ((2, 8, 5), (8, 16, 4), (16, 22, 3), (22, 26, 2), (26, 30, 1)): R(x + a, y + 8, b - a, 18, C('tekko', tt))    # 원통 띠 명암(손으로 나눈 다섯 띠)
    for yy in (12, 18, 23): HL(x + 2, y + yy, 28, C('tekko', 1)); HL(x + 2, y + yy - 1, 28, C('tekko', 5)); sh(x + 26, y + yy - 1, 4, 2, 0)
    for (dx, wd, yy, tt) in ((1, 28, 7, 5), (3, 24, 6, 5), (6, 18, 5, 4), (9, 12, 4, 4), (12, 6, 3, 3)):                              # 뚜껑
        HL(x + dx, y + yy, wd, C('tekko', tt)); P(x + dx + wd - 1, y + yy, C('tekko', tt - 2))
    P(x + 15, y + 2, C('tekko', 5)); P(x + 15, y + 1, SUMI1)
    FR(x + 1, y + 7, 30, 20, SUMI1) if False else None
    VL(x + 1, y + 7, 19, SUMI1); VL(x + 30, y + 8, 18, SUMI1); HL(x + 2, y + 26, 28, SUMI1)
    VL(x + 34, y + 10, 26, C('tekko', 2)); VL(x + 36, y + 10, 26, C('tekko', 1))                      # 사다리
    for k in range(6): HL(x + 34, y + 12 + k * 4, 3, C('tekko', 4))

def outdoor_ac2(x, y, n=3, ramp='conc'):
    """옥상 실외기: 윗면(밝게) 3줄 · 앞면 6줄(팬 원) · 오른쪽 옆면 · 발 · 오른쪽 아래 그림자."""
    F = ('conc', 'usu', 'kinari')
    for i in range(n):
        ux = x + i * 16
        cast_r(ux + 14, y + 8, y + 12, 6, 2, 1, F); sh(ux, y + 10, 14, 3, 2, F)
        R(ux + 2, y + 11, 2, 2, C('tekko', 2)); R(ux + 10, y + 11, 2, 2, C('tekko', 2))
        box3d(ux, y, 12, 7, 3, 2, 'shiro', 3)
        disc(ux + 6, y + 6, 2, C('tekko', 1)); disc(ux + 6, y + 6, 1, C('tekko', 3))
        for k in range(3): HL(ux + 3, y + 5 + k, 7, C('tekko', 2)) if False else None

def stairwell2(x, y):
    """옥상 계단실: 윗면 · 앞면(문 + 처마 그림자) · 옆면 · 드리운 그림자."""
    F = ('conc', 'usu', 'kinari')
    cast_r(x + 27, y + 20, y + 24, 12, 2, 1, F); sh(x, y + 22, 26, 3, 2, F)
    box3d(x, y, 24, 14, 8, 4, 'usu', 4)
    R(x + 8, y + 10, 9, 12, C('tekko', 3)); FR(x + 8, y + 10, 9, 12, C('tekko', 1)); R(x + 9, y + 11, 7, 10, C('kon', 3)); sh(x + 9, y + 11, 7, 2, 2); P(x + 14, y + 16, C('kii', 4))
    HL(x + 7, y + 9, 11, C('usu', 6)); HL(x + 7, y + 8, 11, SUMI1)                                    # 문 위 차양
    R(x + 3, y + 3, 5, 3, C('tekko', 3)); FR(x + 3, y + 3, 5, 3, SUMI1); HL(x + 3, y + 3, 5, C('tekko', 5))

def antenna2(x, y):
    F = ('conc', 'usu', 'kinari')
    cast_r(x + 2, y + 16, y + 17, 12, 2, 1, F)
    R(x - 1, y + 14, 5, 3, C('conc', 4)); HL(x - 1, y + 14, 5, C('conc', 5))
    VL(x, y, 15, C('tekko', 5)); VL(x + 1, y, 15, C('tekko', 2))
    for k, half in enumerate((7, 6, 5, 4)): HL(x - half, y + 2 + k * 3, half * 2 + 2, C('tekko', 4))
    for k, half in enumerate((7, 6, 5, 4)): P(x - half, y + 3 + k * 3, C('tekko', 2)); P(x + half + 1, y + 3 + k * 3, C('tekko', 2))

def vent2(x, y):
    F = ('conc', 'usu', 'kinari')
    cast_r(x + 10, y + 7, y + 9, 6, 2, 1, F)
    box3d(x, y, 9, 4, 3, 2, 'tekko', 4)
    for k in range(2): HL(x + 2, y + 4 + k, 5, C('tekko', 2))

def skylight2(x, y):
    """채광창: 위 유리(밝게·반사) + 앞 유리 경사면(어둡게) + 틀 + 드리운 그림자."""
    F = ('conc', 'usu', 'kinari')
    cast_r(x + 26, y + 12, y + 16, 8, 2, 1, F)
    R(x, y, 26, 6, C('garasu', 4)); R(x, y + 6, 26, 8, C('garasu', 2)); HL(x, y, 26, C('shiro', 5)); VL(x, y, 14, C('garasu', 5)); VL(x + 25, y, 14, C('garasu', 1))
    for gx in (8, 17): VL(x + gx, y, 14, C('tekko', 3)); VL(x + gx + 1, y + 6, 8, C('tekko', 1))
    HL(x, y + 6, 26, C('tekko', 4)); HL(x, y + 13, 26, C('tekko', 1))
    for (dx, dy) in ((3, 1), (4, 2), (12, 1), (13, 2), (21, 1), (22, 2)): P(x + dx, y + dy, C('shiro', 5))
    FR(x - 1, y - 1, 28, 16, SUMI1)

def solar2(x, y, w, h):
    """지붕 태양광 패널(경사 설치): 윗면 판 + 아래 앞면 두께 + 뒤쪽 그림자."""
    F = ('renga', 'kinari')
    cast_r(x + w + 1, y + 2, y + h + 1, 8, 2, 1, F); sh(x, y + h + 1, w, 3, 2, F)
    R(x, y, w, h, C('kon', 2)); FR(x - 1, y - 1, w + 2, h + 2, SUMI1)
    for gx in range(x + 8, x + w, 8): VL(gx, y, h, C('kon', 4))
    for gy in range(y + 6, y + h, 6): HL(x, gy, w, C('kon', 4))
    HL(x, y, w, C('sora', 4)); VL(x, y, h, C('sora', 3)); R(x, y + h - 2, w, 2, C('kon', 0)); HL(x, y + h - 2, w, C('tekko', 2))
    for gx in range(x + 2, x + w - 4, 8): P(gx, y + 2, C('sora', 5)); P(gx + 1, y + 2, C('sora', 4))

def roof_tile2(x, y, w, h):
    """기와 지붕(경사): 맨 위 용마루 두께(윗면 밝게 · 옆면 어둡게) · 기왓줄 · 처마 끝 두께(앞면 두껍게) · 위 다락창 · 태양광."""
    R(x, y, w, h, C('renga', 3))
    for j in range(12, h - 8, 4):
        HL(x + 2, y + j, w - 4, C('renga', 2)); HL(x + 2, y + j + 1, w - 4, C('renga', 4))
        for tx in range(((j // 4) % 2) * 3, w - 4, 6): P(x + 2 + tx, y + j + 2, C('renga', 2)); P(x + 2 + tx, y + j + 3, C('renga', 2))
    sh(x + 2, y + 10, w - 4, 3, 1, ('renga',))
    R(x, y, w, 10, C('kinari', 3)); HL(x, y, w, C('kinari', 5)); HL(x, y + 1, w, C('kinari', 5)); HL(x, y + 2, w, C('kinari', 4))                # 용마루 윗면
    HL(x, y + 6, w, C('kinari', 2)); HL(x, y + 7, w, C('kinari', 1)); HL(x, y + 8, w, C('renga', 1)); HL(x, y + 9, w, C('renga', 0))        # 용마루 앞면 + 그늘
    for k in range(8, w - 6, 16): VL(x + k, y + 3, 3, C('kinari', 2))
    R(x, y + h - 5, w, 5, C('renga', 4)); HL(x, y + h - 5, w, C('renga', 5)); HL(x, y + h - 4, w, C('renga', 4)); R(x, y + h - 2, w, 2, C('renga', 1))   # 처마 끝
    VL(x, y, h, C('renga', 5)); VL(x + w - 1, y, h, C('renga', 1))
    FR(x - 1, y - 1, w + 2, h + 2, SUMI1)
    solar2(x + 62, y + 18, 40, 22); solar2(x + 106, y + 18, 32, 22)
    box3d(x + w - 24, y + 14, 7, 5, 3, 2, 'conc', 4)                                                                                            # 굴뚝
    # 다락창(돌출창): 작은 지붕 + 앞면 + 옆면
    R(x + 15, y + 18, 24, 4, C('moku', 4)); HL(x + 15, y + 18, 24, C('moku', 5)); HL(x + 15, y + 21, 24, C('moku', 2))
    R(x + 17, y + 22, 20, 12, C('moku', 3)); VL(x + 17, y + 22, 12, C('moku', 4)); R(x + 37, y + 20, 3, 14, C('moku', 1)); FR(x + 14, y + 17, 27, 18, SUMI1)
    R(x + 20, y + 24, 14, 7, C('garasu', 3)); sh(x + 20, y + 24, 14, 2, 2); HL(x + 19, y + 31, 16, C('kinari', 5)); VL(x + 27, y + 24, 7, C('moku', 2))
    sh(x + 41, y + 20, 3, 15, 2, ('renga',)); sh(x + 14, y + 36, 27, 2, 2, ('renga',))

def south_wall2(x, y, w, h, kind):
    """지붕 앞난간 밑 남쪽 벽: 처마 그림자 → 층 슬래브 → 창 / 발코니. 오른쪽 끝은 튀어나온 모서리."""
    for k in range(h // 16):
        y0 = y + 16 * k; t = 4 - k
        wall_floor(x, y0, w, 'usu', t, top_shadow=True, joint=64)
        if kind == 'balcony':
            for bx in range(6, w - 40, 44):
                R(x + bx, y0 + 4, 34, 9, C('kon', 1)); sh(x + bx, y0 + 4, 34, 2, 1); HL(x + bx, y0 + 4, 34, C('kon', 0)); FR(x + bx - 1, y0 + 3, 36, 11, SUMI1)
                R(x + bx + 2, y0 + 5, 4, 4, C('pinku', 3)); R(x + bx + 8, y0 + 5, 4, 4, C('shiro', 4)); R(x + bx + 24, y0 + 5, 6, 4, C('sora', 3))      # 널린 빨래
                R(x + bx - 2, y0 + 12, 38, 1, C('momo', 5)); HL(x + bx - 2, y0 + 8, 36, C('shiro', 4))
                for q in range(1, 34, 3): VL(x + bx + q, y0 + 9, 3, C('shiro', 3)); P(x + bx + q + 1, y0 + 10, C('kon', 0))
        else:
            for bx in range(8, w - 34, 34): win2(x + bx, y0 + 3, 22, 'lit' if (bx // 34 + k) % 2 == 0 else 'glass', bx // 34 + k, 'usu', t)
    if h % 16:
        y0 = y + h - (h % 16)
        R(x, y0, w, h % 16, C('usu', 2)); HL(x, y0, w, C('usu', 1)); HL(x, y0 + 1, w, C('usu', 1)); HL(x, y0 + 2, w, C('usu', 2))
        HL(x, y0 + 3, w, C('usu', 4))
    HL(x, y + h - 1, w, SUMI1)
    R(x + w - 6, y, 3, h, C('usu', 5)); R(x + w - 3, y, 3, h, C('usu', 2)); VL(x + w - 7, y, h, C('usu', 1))                                    # 오른쪽 모서리 기둥

# ═══════════════════════════ 가로수 ═══════════════════════════
def tree2(cx, base=118):
    """가로수(큰 형): 폭 약 32 × 높이 약 60. 가는 줄기 + 수관 덩어리 12개(뒤 어두움 → 앞 밝음), 덩어리마다 왼쪽 위 밝게.
    윤곽 = 짙은 초록 한 줄, 밑의 그림자는 보도 위 오른쪽 아래로."""
    sh(cx - 6, base - 3, 34, 6, 2, ('hodo',)); sh(cx + 12, base - 6, 20, 4, 1, ('hodo',))
    trunk_top = 96
    R(cx - 2, trunk_top, 4, base - 4 - trunk_top, C('moku', 3)); VL(cx - 2, trunk_top, base - 4 - trunk_top, C('moku', 4)); VL(cx + 1, trunk_top, base - 4 - trunk_top, C('moku', 1))
    for k in range(5): P(cx - 3 - k // 2, trunk_top + 2 - k, C('moku', 3)); P(cx + 2 + k // 2, trunk_top + 3 - k, C('moku', 2))            # 가지
    cy = 80
    back = [(0, -18, 9), (-11, -9, 8), (11, -9, 8), (-13, 4, 7), (13, 4, 7), (0, -4, 11), (-6, 10, 8), (7, 10, 8)]
    front = [(-6, -13, 7), (6, -14, 6), (-12, -1, 7), (3, -5, 8), (12, 0, 6), (-3, 7, 7), (9, 8, 6)]
    def disc_tier(ccx, ccy, r, off):
        for yy in range(ccy - r, ccy + r + 1):
            for xx in range(ccx - r, ccx + r + 1):
                if (xx - ccx) ** 2 + (yy - ccy) ** 2 <= r * r + r // 2:
                    s = (xx - ccx) + (yy - ccy)
                    t = 5 if s < -r * 0.8 else 4 if s < -r * 0.25 else 3 if s < r * 0.5 else 2 if s < r * 1.0 else 1
                    P(xx, yy, C('ki', t + off))
    for L, off in ((back, -1), (front, 0)):
        for (dx, dy, r) in L: disc(cx + dx, cy + dy, r + 1, C('ki', 0)) if L is back else None
        for (dx, dy, r) in L: disc_tier(cx + dx, cy + dy, r, off)
    leaf = ['.66.', '6776', '.66.']                                                                  # 손으로 놓은 잎 덩이 = 왼쪽 위 밝은 곳
    for (dx, dy) in ((-9, -20), (-2, -22), (4, -18), (-14, -8), (-8, -10), (-1, -12), (6, -8), (-14, 3), (-4, -2), (4, 0), (10, -3), (-8, 8), (0, 8), (8, 7)):
        for j, row in enumerate(leaf):
            for i, ch in enumerate(row):
                xx, yy = cx + dx + i, cy + dy + j
                if ch != '.' and cv[yy][xx] is not None and cv[yy][xx][0] == 'ki' and cv[yy][xx][1] >= 3: P(xx, yy, C('ki', int(ch)))
    for (dx, dy) in ((3, 12), (-6, 14), (9, 13), (14, 6)): R(cx + dx, cy + dy, 3, 2, C('ki', 0))     # 아래쪽 어두운 틈
    R(cx - 9, base - 4, 19, 5, C('conc', 3)); HL(cx - 9, base - 4, 19, C('conc', 5)); HL(cx - 9, base, 19, C('conc', 1)); FR(cx - 10, base - 5, 21, 7, SUMI1)
    R(cx - 7, base - 3, 15, 2, C('moku', 1))

# ═══════════════════════════ 조립 ═══════════════════════════
def build():
    # 1차 그림에서 바꾸는 함수는 빈 함수로 돌려 두고(거기서는 그리지 않음), 새 그림은 그 위에 얹는다.
    for nm in ('roof_flat', 'roof_tile', 'water_tank', 'outdoor_ac', 'stairwell', 'antenna', 'vent_box', 'skylight', 'south_wall', 'tree'):
        setattr(J, nm, lambda *a, **k: None)
    for k, fn in WALLS.items(): setattr(J, 'upper_' + k, fn)
    J.build()
    # 가게 깊이 · 주춧돌 · 모서리
    shop_depth(); piers()
    # 지붕(낮은 건물)
    roof2(0, 208, 176, 80, 'conc', 4)
    outdoor_ac2(90, 226, 3); water_tank2(14, 224); stairwell2(126, 246); antenna2(66, 228); vent2(84, 262); vent2(102, 270); vent2(56, 272)
    R(150, 236, 10, 10, C('conc', 5)); HL(150, 236, 10, C('conc', 5)); FR(149, 235, 12, 12, SUMI1); disc(155, 241, 3, C('tekko', 2)); disc(155, 241, 2, C('tekko', 4)); sh(162, 238, 4, 10, 2, ('conc',))
    roof2(184, 208, 168, 88, 'usu', 3)
    skylight2(200, 226); outdoor_ac2(240, 226, 4); stairwell2(206, 262); vent2(290, 262); antenna2(324, 228); vent2(268, 278); vent2(300, 278); skylight2(322, 262)
    roof_tile2(360, 216, 152, 72)
    # 남쪽 벽
    south_wall2(0, 288, 176, 32, 'balcony'); south_wall2(184, 296, 168, 24, 'win'); south_wall2(360, 288, 152, 32, 'win')
    # 가로수(맨 위)
    for tx in (112, 248, 376): tree2(tx)

def main():
    build()
    bad = {c for row in cv for c in row if c is not None and (c[1] >= RM[c[0]] or c[1] < 0)}
    assert not bad, f'램프 밖 단: {sorted(bad)}'
    rows, legend, empty = J.to_rows()
    os.makedirs(OUT_DIR, exist_ok=True)
    pxg = os.path.join(OUT_DIR, 'dm3-D.pxg')
    open(pxg, 'w', encoding='utf-8').write(emit(rows, legend, title='jp style v2 demo street 32x24 round2 (dm3-D)'))
    print(pxg, 'colors', len(legend), 'empty px', empty)
    if '--png' in sys.argv:
        sys.path.insert(0, J.PXGRID); sys.path.insert(0, J.HARNESS)
        import pxgrid; pxgrid.render(pxg, pxg[:-4] + '.png'); print('png', pxg[:-4] + '.png')

if __name__ == '__main__':
    main()
