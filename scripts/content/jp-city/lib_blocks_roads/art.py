"""roads 블록의 새 칸 그림(전부 코드로 그린 손 도트, modern3, 알파 0/255, 난수 없음).
평면 표시(차선·정지선·화살표·자전거 표시)는 빛이 없으므로 90도 회전해 쓴다. 세워진 것(경보기·차단기·표지·계단)은 방향마다 따로 그린다."""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np                                          # noqa: E402
from lib_blocks_lines.core import K, Px, rot90, Image   # noqa: E402

def ascii_px(rows, pal, p=None, ox=0, oy=0):
    """rows: 문자열 리스트(.=투명). pal: 문자→색(int)."""
    p = p or Px()
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != '.' and ch in pal: p.P(x + ox, y + oy, pal[ch])
    return p

def flip_h(img):
    return img.transpose(Image.FLIP_LEFT_RIGHT)

# ───────────── 노면 표시(평면) ─────────────
W1 = lambda: K('shiro', 1)       # 차선 점선·정지선·화살표의 흰색(autotiles_lines 점선과 같은 단)

def dash_top():
    """차선 경계 점선: 칸 위쪽 2줄(윗 경계). autotiles_lines 의 jp-lane-dash 와 같은 8px 마디·2px 굵기."""
    p = Px(); p.R(4, 0, 11, 1, W1()); return p.img()

def stop_bar():
    """정지선: 세로 방향 흰 띠(3px 굵기, 칸 전체 높이) — 이웃 칸과 이어진다."""
    p = Px(); p.R(6, 0, 8, 15, W1()); return p.img()

def edge_line():
    """갓길 흰 실선(가로, 칸 위쪽 아래로 2px 떨어진 곳). 생활도로 막다른 길 표지 등에 쓰는 보조."""
    p = Px(); p.R(0, 2, 15, 3, W1()); return p.img()

ARR = {
 's': ["................", ".......XX.......", "......XXXX......", ".....XXXXXX.....", "....XXXXXXXX....", "...XXXXXXXXXX...",
       "......XXXX......", "......XXXX......", "......XXXX......", "......XXXX......", "......XXXX......", "......XXXX......",
       "......XXXX......", "......XXXX......", "................", "................"],
 'r': ["................", "................", ".........X......", ".........XX.....", "..XXXXXXXXXXX...", "..XXXXXXXXXXXX..", "..XXXXXXXXXXX...",
       "..XXX.....XX....", "..XXX......X....", "..XXX...........", "..XXX...........", "..XXX...........", "..XXX...........", "..XXX...........",
       "..XXX...........", "................"],
 'sl': ["................", "........X.......", ".......XXX......", "......XXXXX.....", ".....XXXXXXX....", "....XXXXXXXXX...",
        "........XXX.....", "...X....XXX.....", "..XXX...XXX.....", ".XXXXXXXXXX.....", "..XXX...XXX.....", "...X....XXX.....",
        "........XXX.....", "........XXX.....", "........XXX.....", "................"],
}
def arrow(kind):
    """kind: s(직진) r(우회전) sl(직진+좌) / 반전해서 l(좌회전) sr(직진+우)."""
    k = kind
    base = {'l': 'r', 'sr': 'sl'}.get(k, k)
    p = ascii_px(ARR[base], {'X': W1()})
    im = p.img()
    return flip_h(im) if k in ('l', 'sr') else im

def bike_stop():
    """자전거 정차(대기) 표시: 위에 흰 정지선, 아래에 파란 바탕+자전거 모양(흰). 평면."""
    p = Px()
    p.R(0, 1, 15, 2, W1())
    p.R(2, 5, 13, 14, K('sora', -1)); p.R(2, 5, 13, 5, K('sora', 0)); p.R(2, 14, 13, 14, K('sora', -2))
    wc = K('shiro', 2)
    for (cx, cy) in ((5, 11), (10, 11)):                                 # 바퀴(원 5x5)
        for dx, dy in ((0, -2), (1, -2), (-1, -1), (2, -1), (-2, 0), (2, 0), (-2, 1), (2, 1), (-1, 2), (0, 2), (1, 2)):
            p.P(cx + dx, cy + dy, wc)
    for (x, y) in ((5, 11), (10, 11), (6, 10), (7, 9), (8, 9), (9, 10), (8, 10), (7, 10), (9, 8), (10, 8), (5, 8), (6, 8)):   # 프레임·핸들·안장
        p.P(x, y, wc)
    return p.img()

# ───────────── 철길 건널목 ─────────────
def deck_h():
    """건널목 바닥판(가로 선로): 선로 오토타일(m10) 과 같은 자리(y4-5, y10-11)에 레일, 레일 사이·바깥은 콘크리트 판(8px 마디)."""
    p = Px()
    for y in range(16):
        for x in range(16):
            if y in (0,): c = K('conc', -3)
            elif y == 15: c = K('conc', -3)
            elif y in (6, 12): c = K('conc', -2)                           # 레일이 드리운 그림자
            elif (x % 8) == 7: c = K('conc', -2)                           # 판 이음
            else: c = K('conc', 0) if y < 8 else K('conc', -1)
            p.P(x, y, c)
    for y0 in (4, 10):
        for x in range(16): p.P(x, y0, K('tekko', 3)); p.P(x, y0 + 1, K('tekko', 1))
    return p.img()

def deck_v():
    return Image.fromarray(np.array(deck_h()).transpose(1, 0, 2).copy(), 'RGBA')

def alarm_head():
    """경보기 머리(1x2 의 윗칸): 검은 상자에 노랑-검정 X 표지(踏切警標)와 빨간 경고등 둘. 아래로 기둥이 이어진다."""
    p = Px()
    Y, B, R_, Rh = K('kii', 1), K('sumi', 1), K('aka', 2), K('aka', 4)
    # 상자(윤곽 1px)
    p.R(1, 8, 14, 14, K('tekko', -2)); p.R(2, 9, 13, 13, K('tekko', -1))
    for (cx, cy) in ((5, 11), (10, 11)):                               # 경고등 3x3 + 하이라이트
        p.R(cx - 1, cy - 1, cx + 1, cy + 1, K('aka', 1)); p.P(cx, cy, R_); p.P(cx - 1, cy - 1, Rh)
    # X 표지: 두 판자 대각, 노랑 판 + 검정 윤곽
    for i in range(8):
        for (x, y) in ((3 + i, 0 + i), (12 - i, 0 + i)):
            p.P(x, y, B)
    for i in range(8):
        for (x, y) in ((4 + i, 0 + i), (11 - i, 0 + i)):
            p.P(x, y, Y if i % 4 < 2 else K('kii', 3))
    for i in range(8):
        for (x, y) in ((5 + i, 0 + i), (10 - i, 0 + i)):
            if p.get(x, y) is None: p.P(x, y, B)
    p.R(7, 15, 8, 15, K('tekko', 3)); p.P(8, 15, K('tekko', 1))
    p.R(7, 14, 8, 14, K('tekko', 3)); p.P(8, 14, K('tekko', 1))
    return p.img()

def alarm_pole():
    """경보기 기둥+받침(아랫칸, 막힘): 노랑-검정 띠 기둥."""
    p = Px()
    for y in range(0, 14):
        band = (y // 2) % 2
        p.P(7, y, K('kii', 3) if band == 0 else K('tekko', 3)); p.P(8, y, K('kii', 0) if band == 0 else K('tekko', 1))
    p.R(5, 14, 10, 15, K('tekko', -1)); p.R(5, 14, 10, 14, K('tekko', 1)); p.R(5, 15, 10, 15, K('sumi', 1))
    p.P(5, 14, K('tekko', 3)); p.P(6, 14, K('tekko', 3))
    return p.img()

def gate_box():
    """차단기 본체(막힘): 회색 상자 + 빨간 지시등, 윗면 밝게."""
    p = Px()
    p.R(4, 5, 11, 14, K('tekko', 0)); p.R(4, 5, 11, 7, K('tekko', 3)); p.R(4, 5, 11, 5, K('tekko', 2))
    p.R(4, 8, 11, 14, K('tekko', 1)); p.R(4, 8, 7, 14, K('tekko', 2))
    p.R(9, 10, 10, 11, K('aka', 2)); p.P(9, 10, K('aka', 4))
    p.R(3, 15, 12, 15, K('sumi', 1))
    for x in range(4, 12): p.P(x, 4, K('sumi', 1))
    for y in range(5, 15): p.P(3, y, K('sumi', 1)); p.P(12, y, K('sumi', 1))
    p.R(7, 6, 8, 7, K('tekko', -1))                                   # 팔 축
    return p.img()

def gate_top():
    """차단기가 올라간 팔(윗칸, 지나감 ★): 노랑-검정 줄 막대가 세로로 선다. 아래 칸 본체의 축에서 이어진다."""
    p = Px()
    for y in range(0, 16):
        band = ((y + 1) // 3) % 2
        p.P(7, y, K('kii', 2) if band == 0 else K('sumi', 1)); p.P(8, y, K('kii', 0) if band == 0 else K('sumi', 0))
    p.P(7, 0, K('aka', 3)); p.P(8, 0, K('aka', 1))
    return p.img()

def arm_ew(kind):
    """내려온 차단기 팔(가로): mid 줄무늬 / tipW 서쪽 끝 / tipE 동쪽 끝. 윗면 1px + 앞면 2px + 밑그늘 1px."""
    p = Px()
    for x in range(16):
        band = (x // 4) % 2
        top, front = (K('kii', 3), K('kii', 1)) if band == 0 else (K('tekko', 1), K('sumi', 1))
        p.P(x, 6, top); p.P(x, 7, front); p.P(x, 8, front); p.P(x, 9, K('sumi', 1))
    if kind == 'tipW':
        for y in range(6, 10): p.clear(0, y)
        p.R(1, 5, 2, 9, K('aka', 2)); p.P(1, 5, K('aka', 4))
    if kind == 'tipE':
        for y in range(6, 10): p.clear(15, y)
        p.R(13, 5, 14, 9, K('aka', 2)); p.P(13, 5, K('aka', 4))
    return p.img()

def arm_ns(kind):
    """내려온 차단기 팔(세로): 위에서 본 띠(폭 4) + 줄무늬. tipN 북쪽 끝 / tipS 남쪽 끝."""
    p = Px()
    for y in range(16):
        band = (y // 4) % 2
        a, b = (K('kii', 3), K('kii', 1)) if band == 0 else (K('tekko', 1), K('sumi', 1))
        p.P(6, y, a); p.P(7, y, a); p.P(8, y, b); p.P(9, y, K('sumi', 1))
    if kind == 'tipN':
        for x in range(6, 10): p.clear(x, 0)
        p.R(6, 1, 9, 2, K('aka', 2)); p.P(6, 1, K('aka', 4))
    if kind == 'tipS':
        for x in range(6, 10): p.clear(x, 15)
        p.R(6, 13, 9, 14, K('aka', 2)); p.P(6, 13, K('aka', 4))
    return p.img()

# ───────────── 서 있는 표지 ─────────────
def sign_post_head():
    """도로 표지 기둥 머리(1x2 의 윗칸): 파란 사각 표지에 흰 화살표(지시 표지). 아래로 4px 기둥(기존 표지 기둥과 같은 모양)이 이어진다."""
    p = Px()
    OL, BL, BH, WH = K('tekko', -3), K('sora', 0), K('sora', 1), K('shiro', 2)
    p.R(1, 1, 14, 10, OL); p.R(2, 2, 13, 9, BL); p.R(2, 2, 13, 2, BH)
    for (x, y) in ((4, 5), (5, 5), (6, 5), (7, 5), (8, 5), (9, 5), (10, 5), (4, 6), (5, 6), (6, 6), (7, 6), (8, 6), (9, 6), (10, 6), (11, 6),
                   (9, 4), (10, 4), (9, 7), (10, 7), (10, 3), (10, 8), (11, 5), (12, 5)):
        pass
    for (x, y) in ((3, 5), (4, 5), (5, 5), (6, 5), (7, 5), (8, 5), (9, 5), (10, 5), (3, 6), (4, 6), (5, 6), (6, 6), (7, 6), (8, 6), (9, 6), (10, 6),
                   (9, 3), (9, 4), (10, 4), (9, 7), (10, 7), (9, 8), (11, 5), (11, 6), (10, 5), (12, 5), (12, 6)):
        p.P(x, y, WH)
    for y in range(11, 16):
        p.P(6, y, K('tekko', -3)); p.P(7, y, K('tekko', 0)); p.P(8, y, K('tekko', -3)); p.P(9, y, K('tekko', -3))
    return p.img()

# ───────────── 지하도 입구 / 육교 계단 (큰 그림을 그려 칸으로 자른다) ─────────────
def _slice(big, cols, rows):
    return {(cx, cy): big.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16)) for cy in range(rows) for cx in range(cols)}

def _steps(p, x0, x1, y0, y1, dark_top=True, period=6):
    """층계: 띠마다 디딤판(밝음 3px) + 챌판(어두움 3px). 먼 쪽(위)일수록 어두워진다."""
    n = y1 - y0 + 1
    for y in range(y0, y1 + 1):
        d = (y - y0) / max(1, n - 1)                     # 0 = 먼 쪽(위) … 1 = 가까운 쪽(아래)
        ph = (y1 - y) % period
        lvl = int(round(-2 + 4 * d)) if dark_top else 1
        c = K('conc', lvl) if ph >= period // 2 else K('conc', lvl - 2)
        if ph == period - 1: c = K('conc', min(3, lvl + 1))      # 디딤판 앞 모서리 하이라이트
        for x in range(x0, x1 + 1): p.P(x, y, c)

def underpass_cells():
    """지하도 입구(4x4, 남쪽에서 본 계단 내리막): 북쪽 벽(터널 입구) · 좌우 난간벽 · 아래로 내려가는 계단. 칸 키 (cx,cy)."""
    p = Px(64, 64); OL = K('sumi', 1)
    # 북쪽 벽: 윗면 → 안쪽 면 → 터널 입구
    p.R(0, 0, 63, 3, K('conc', 2)); p.R(0, 3, 63, 3, K('conc', 1)); p.R(0, 0, 63, 0, K('conc', 3))
    p.R(0, 4, 63, 13, K('conc', 0))
    for x in range(0, 64, 16): p.R(x, 4, x, 13, K('conc', -1))
    p.R(0, 13, 63, 13, K('conc', -2))
    p.R(18, 5, 45, 5, K('conc', -2)); p.R(19, 6, 44, 13, K('sumi', 1)); p.R(19, 10, 44, 13, K('sumi', 0))
    p.R(18, 5, 18, 13, K('conc', -2)); p.R(45, 5, 45, 13, K('conc', -2))
    # 난간벽(윗면 + 끝 앞면)
    for (x0, x1, edge) in ((0, 15, 'r'), (48, 63, 'l')):
        p.R(x0, 14, x1, 55, K('conc', 2)); p.R(x0, 14, x1, 55, K('conc', 2))
        p.R(x0 + 2, 14, x1 - 2, 55, K('conc', 3)) if False else None
        inner = (x1 - 1, x1) if edge == 'r' else (x0, x0 + 1)
        for x in inner: p.R(x, 14, x, 55, K('conc', 0))
        p.R(x0, 56, x1, 63, K('conc', -1)); p.R(x0, 56, x1, 56, K('conc', 1)); p.R(x0, 63, x1, 63, OL)
        p.R(x0, 14, x1, 14, K('conc', 3))
    for y in range(14, 64): p.P(0, y, K('conc', 1)); p.P(63, y, K('conc', 0))
    # 층계
    _steps(p, 16, 47, 14, 55, True)
    p.R(16, 56, 47, 57, K('kii', 1)); p.R(16, 58, 47, 63, K('conc', 0)); p.R(16, 63, 47, 63, K('conc', -2))
    for (x0, x1) in ((11, 14), (49, 52)):                                   # 난간(윗선 + 기둥)
        pass
    for y in range(14, 56):
        p.P(14, y, K('tekko', 3)); p.P(15, y, K('tekko', 1)); p.P(48, y, K('tekko', 3)); p.P(49, y, K('tekko', 1))
    for y in range(18, 56, 10):
        p.R(12, y, 15, y + 1, K('tekko', 2)); p.R(48, y, 51, y + 1, K('tekko', 2))
    for x in (16, 17): p.R(x, 14, x, 55, K('conc', -3))                      # 난간 그림자
    for y in range(14, 56): p.P(46, y, K('conc', -3)); p.P(47, y, K('conc', -3))
    return _slice(p.img(), 4, 4)

def footbridge_cells():
    """육교 계단(4x5): 위쪽 가로 보행교 바닥(앞면+난간) · 좌우 난간벽 · 올라가는 계단. 칸 키 (cx,cy)."""
    p = Px(64, 80); OL = K('sumi', 1)
    # 보행교(위): 난간(윗선+기둥) / 바닥 윗면 / 앞면 / 밑그늘
    p.R(0, 0, 63, 1, K('tekko', 3)); p.R(0, 2, 63, 2, K('tekko', 1))
    for x in range(1, 64, 8): p.R(x, 0, x + 1, 9, K('tekko', 2)); p.R(x + 1, 0, x + 1, 9, K('tekko', 0))
    p.R(0, 10, 63, 13, K('conc', 3)); p.R(0, 13, 63, 13, K('conc', 1))
    p.R(0, 14, 63, 27, K('conc', 0)); p.R(0, 14, 63, 14, K('conc', 2))
    for x in range(0, 64, 16): p.R(x + 15, 14, x + 15, 27, K('conc', -1))
    p.R(0, 22, 63, 22, K('conc', -1))
    p.R(0, 28, 63, 31, K('conc', -3)); p.R(0, 28, 63, 28, K('conc', -2))
    # 좌우 난간벽 + 난간
    for (x0, x1) in ((4, 15), (48, 59)):
        p.R(x0, 32, x1, 79, K('conc', 1)); p.R(x0, 32, x1, 79, K('conc', 1))
        p.R(x0, 32, x0, 79, K('conc', 3)); p.R(x1, 32, x1, 79, K('conc', -1))
        p.R(x0 + 1, 32, x1 - 1, 79, K('conc', 2))
        p.R(x0, 79, x1, 79, OL)
    for x in (13, 14): p.R(x, 32, x, 79, K('tekko', 3 if x == 13 else 1))
    for x in (49, 50): p.R(x, 32, x, 79, K('tekko', 3 if x == 49 else 1))
    for y in range(36, 80, 10):
        p.R(12, y, 15, y, K('tekko', 2)); p.R(48, y, 51, y, K('tekko', 2))
    # 계단
    _steps(p, 16, 47, 32, 73, False)
    p.R(16, 74, 47, 75, K('kii', 1)); p.R(16, 76, 47, 79, K('conc', 0)); p.R(16, 79, 47, 79, K('conc', -2))
    for x in (16, 17): p.R(x, 32, x, 73, K('conc', -3))
    for x in (46, 47): p.R(x, 32, x, 73, K('conc', -3))
    return _slice(p.img(), 4, 5)
