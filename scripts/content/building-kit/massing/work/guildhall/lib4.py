"""guildhall · smithy · granary-mill · tower-house 공용 붓(이 네 건물 전용 사본).
common.py(cottage/inn 사본)·pix.py(chapel/gatehouse 사본) 위에 더한 것만 여기 둔다.
난수·잡음 없음 — 변화는 손으로 쓴 표 문자열을 순서대로 읽는다. 빛은 왼쪽 위."""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, __import__('os').path.abspath(__file__).rsplit('/scripts/content/building-kit/', 1)[0] + '/src/harnesses/building-kit')
from massing_lib import Canvas  # noqa: E402,F401
import common  # noqa: E402,F401
import pix  # noqa: E402,F401
from pix import ST, SL, sclamp  # noqa: E402,F401

# ---------------------------------------------------------------- 분홍 마름돌(버들항 대성당 벽 결)
# 돌 바탕 순서(손으로 씀) — 회벽 램프의 따뜻한 연분홍. 줄눈은 자두색 J.
PK_FACE = 'vwvxuwvvxwvwxvuwvxwvvwxvw'
PK_LIGHT = {'u': 'w', 'v': 'p', 'w': 'z', 'x': 'p', 'y': '0', 'z': '2', '0': '3'}
PK_SHADE = {'u': 't', 'v': 'u', 'w': 'v', 'x': 'w', 'y': 'x', 'z': 'y', '0': 'z'}
PK_DARK = {'w': 'u', 'x': 'v', 'y': 'w', 'z': 'x', '0': 'y', 'v': 't', 'u': 't', 't': 't'}
PK_WIDTHS = [6, 4, 7, 5, 8, 4, 6, 5, 7, 4, 6, 8, 5, 4, 7, 6, 5, 8, 4, 6, 5]
PK_FLECK = '3070504020608030507'          # 돌 안 짙은 반점 자리(0 없음)


def pink_ashlar(c, x0, y0, w, h, course=5, seed=0, shade=None, mask=None, vy0=None):
    """분홍 마름돌 벽: 줄 높이 course(줄눈 1 포함), 돌 폭은 표를 줄마다 다른 자리에서 읽는다.
    shade(x,y) -> 음수면 그만큼 어둡게(1=한 단, 2=두 단)."""
    vy0 = y0 if vy0 is None else vy0
    for y in range(y0, y0 + h):
        v = y - vy0
        k = v // course
        lv = v % course
        off = [0, 6, 3, 9, 1, 7, 4, 10][(k + seed) % 8]
        # 이 줄의 돌 경계
        u = -off
        wi = (k * 5 + seed * 3) % len(PK_WIDTHS)
        spans = []
        while u < x0 + w + 20:
            sw = PK_WIDTHS[wi % len(PK_WIDTHS)]
            spans.append((u, sw, wi + k * 7))
            u += sw
            wi += 1
        for x in range(x0, x0 + w):
            if mask and not mask(x, y):
                continue
            lx = x - x0
            for (su, sw, sid) in spans:
                if su <= lx < su + sw:
                    break
            lu = lx - su
            face = PK_FACE[sid % len(PK_FACE)]
            if lv == course - 1 or lu == sw - 1:
                ch = 'C' if (lu == sw - 1 and lv == course - 1 and sid % 2) else 'J'
            elif lv == 0 and lu < sw - 2 and (sid % 3):
                ch = PK_LIGHT[face]
            elif (lv == course - 2 and course > 4) or (lu == sw - 2 and sw > 5):
                ch = PK_SHADE[face]
            elif lu == 0 and lv == 1 and sid % 2:
                ch = PK_LIGHT[face]
            else:
                ch = face
                fl = int(PK_FLECK[sid % len(PK_FLECK)])
                if fl and lu == fl and lv == 1 + (sid % 2):
                    ch = PK_SHADE[face] if sid % 3 else 'v'
            s = shade(x, y) if shade else 0
            for _ in range(-s):
                ch = 'J' if ch == 'J' else PK_DARK.get(ch, ch)
            c.put(x, y, ch)


def pink_band(c, x0, x1, y):
    """층 띠(돌출 돌림띠): 윗면 밝게 → 앞면 → 밑 그늘."""
    for x in range(x0, x1 + 1):
        c.put(x, y, '3' if x % 9 else '1')
        c.put(x, y + 1, 'z' if x % 9 else 'y')
        c.put(x, y + 2, 'x')
        c.put(x, y + 3, 'J')
        if c.get(x, y + 4) != '.':
            g = c.get(x, y + 4)
            c.put(x, y + 4, PK_DARK.get(PK_DARK.get(g, g), g) if g != 'J' else 'J')


def tall_window(c, cx, y0, h, w=9, glow=False, arch=True):
    """둥근 머리 좁은 창: 돌 테(왼쪽 밝게) + 납 띠 유리 + 하늘 반짝임 + 창턱(대성당 창 결)."""
    hw = w // 2
    # 돌 테
    rows = []
    top = ['..' + '3' * (w - 4) + '..', '.3' + 'D' * (w - 4) + 'x.'] if arch else ['3' * (w - 1) + 'x']
    for j in range(h):
        if j < len(top):
            r = top[j]
        else:
            inner = []
            for i in range(w - 4):
                if glow:
                    ch = 'K' if (i + j) % 5 else 'L'
                    if i == (w - 4) // 2:
                        ch = 'τ'
                else:
                    ch = 'A'
                    if j < len(top) + 3:
                        ch = 'D'
                    if i == 0 and j % 6 in (1, 2):
                        ch = '^'
                    if i == 0 and j == len(top):
                        ch = 'F'
                    if i == w - 5:
                        ch = 'B'
                if (j - len(top)) % 7 == 5:
                    ch = '>' if not glow else 'τ'
                inner.append(ch)
            r = '3' + 'z' + ''.join(inner) + 'w' + 'v'
        rows.append(r[:w])
    rows.append('3' + 'z' * (w - 2) + 'x')
    rows.append('J' * w)
    c.rows(cx - hw, y0, rows)


# ---------------------------------------------------------------- 테라코타 원뿔(버들항 망루 결)
# SL(청석) 6단 → 테라코타 6단. 0 가장 어둠, 1 틈, 2 그늘, 3 중간, 4 몸, 5 반짝
TC = ['6', '9', '&', 'λ', 'π', 'σ']
TC_LIT = ['9', '!', '+', 'ν', 'ρ', 'L']


def tc_cone(c, cx, apex_y, base_y, hw, ell, seed=0):
    """pix.cone 과 같은 기하(기와 줄이 밑 타원과 평행하게 휜다), 색만 테라코타. 왼쪽 밝고 오른쪽 어둡다."""
    H = base_y - apex_y
    for y in range(apex_y, base_y + ell + 2):
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            p = pix.cone_param(cx, apex_y, H, hw, ell, x, y)
            if not p:
                continue
            t, f = p
            v = y + 0.5 - apex_y - ell * t * math.sqrt(max(0.0, 1 - f * f)) * 0.85
            row = int(v // pix.TH)
            lv = int(v % pix.TH)
            off = 2 if row % 2 else 0
            col = int((x - cx + 40 + off) // pix.TW)
            lu = int((x - cx + 40 + off) % pix.TW)
            var = int(pix.SLATE_VAR[(row * 7 + col + seed * 3) % len(pix.SLATE_VAR)])
            if var == 3 and row % 3:
                var = 0
            if f < -0.55:
                s = 1
            elif f < 0.2:
                s = 0
            elif f < 0.6:
                s = -1
            else:
                s = -2
            i = pix.slate_px(lu, lv, pix.TW, pix.TH, var, s)
            ramp = TC_LIT if (f < -0.35 and t > 0.12) else TC
            c.put(x, y, ramp[i])


def cone_eave(c, cx, base_y, hw, ell, lit='ν', dark='9'):
    """원뿔 처마 앞 끝 두께: 밑 타원 앞 반쪽을 따라 두 줄."""
    for x in range(int(cx - hw), int(cx + hw) + 1):
        dx = x + 0.5 - cx
        if abs(dx) > hw:
            continue
        ye = base_y + ell * math.sqrt(max(0, 1 - (dx / hw) ** 2))
        y = int(round(ye))
        f = dx / hw
        c.put(x, y, '6' if f > 0.35 else ('9' if f > -0.2 else '&'))
        c.put(x, y - 1, '&' if f > 0.35 else ('+' if f > -0.3 else lit))


# ---------------------------------------------------------------- 바깥 윤곽(먹선 금지: 재질의 어두운 단)
EDGE_MAP = {}
for _ch in 'tuvwxyz012345':
    EDGE_MAP[_ch] = 't'
for _ch in 'JK':
    pass
EDGE_MAP.update({'J': 'J', '3': 'v', '1': 'v'})


def material_outline(c, mapping, skip=None):
    g = c.g
    pts = []
    for y in range(c.h):
        for x in range(c.w):
            ch = g[y][x]
            if ch == '.':
                continue
            if skip and skip(x, y):
                continue
            edge = any(not (0 <= x + ax < c.w and 0 <= y + ay < c.h) or g[y + ay][x + ax] == '.'
                       for ax, ay in ((1, 0), (-1, 0), (0, -1)))
            if edge and ch in mapping:
                pts.append((x, y, mapping[ch]))
    for x, y, ch in pts:
        c.put(x, y, ch)


def fill_walk(c, walk):
    """그림이 있는데 '.' 인 칸은 '*', 빈 칸은 '.'."""
    H = len(walk)
    W = len(walk[0])
    wl = [list(r) for r in walk]
    for cy in range(H):
        for cx in range(W):
            op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
            if not op:
                wl[cy][cx] = '.'
            elif wl[cy][cx] == '.':
                wl[cy][cx] = '*'
    return [''.join(r) for r in wl]


# ---------------------------------------------------------------- 둥근 기와 원뿔(장이 꼭짓점 쪽으로 좁아진다 — 버들항 망루 결)
def tc_cone_radial(c, cx, apex_y, base_y, hw, ell, ncol=8, th=6, seed=0):
    """비늘 기와 원뿔: 장의 열이 꼭짓점에서 방사(열 수 고정 → 위로 갈수록 장이 좁다), 줄은 밑 타원과 평행하게 휜다.
    왼쪽 빛(ρ·L 반짝·# 틈), 가운데 ρ/λ, 오른쪽 λ·&·9 그늘. 바깥 테 η(왼)·_(오른)."""
    H = base_y - apex_y
    pts = {}
    for y in range(apex_y, base_y + ell + 2):
        for x in range(int(cx - hw) - 1, int(cx + hw) + 2):
            p = pix.cone_param(cx, apex_y, H, hw, ell, x, y)
            if not p:
                continue
            t, f = p
            v = y + 0.5 - apex_y - ell * t * math.sqrt(max(0.0, 1 - f * f)) * 0.85
            row = int(v // th)
            lv = int(v % th)
            nc = ncol if t > 0.42 else max(2, ncol // 2)
            pos = (f + 1) / 2 * nc + (0.5 if row % 2 else 0) + seed * 0.25
            col = int(math.floor(pos))
            fr = pos - col
            var = '0102001020010201002010'[(row * 5 + col * 3 + seed) % 22]
            tw = 2 * hw * max(t, 0.05) / nc          # 이 줄의 장 폭(px)
            lu = fr * tw
            edge = lu < 1.0
            bot = lv == th - 1
            hil = tw >= 3.5 and 1.0 <= lu < 3.5 and lv in (0, 1, 2) and var != '2'
            if f < -0.2:           # 빛 쪽
                ch = '#' if edge else ('?' if bot else ('L' if hil else 'ρ'))
                if var == '2' and not edge and not bot:
                    ch = 'π'
            elif f < 0.15:         # 가운데
                ch = '?' if edge else ('&' if bot else ('ρ' if hil else ('λ' if var == '2' else 'π')))
            elif f < 0.6:
                ch = '9' if edge else ('9' if bot else ('λ' if lv < 2 else ('&' if var == '2' else 'λ')))
            else:
                ch = '9' if (edge or bot) else ('λ' if lv == 0 else '&')
            pts[(x, y)] = ch
    for (x, y), ch in pts.items():
        c.put(x, y, ch)
    # 바깥 테: 왼쪽 η, 오른쪽 _, 밑 처마 줄은 cone_eave 가 맡는다
    for (x, y) in pts:
        if (x - 1, y) not in pts:
            c.put(x, y, 'η')
        elif (x + 1, y) not in pts:
            c.put(x, y, '_')


# 회색 마름돌 글자 → 따뜻한 크림·회갈 돌(버들항 망루·방앗간 탑 결)
WARM_STONE = {'U': 't', 'W': 't', 'Y': 't', 'a': 't', 'e': 'u', 'i': 'v', 'j': 'w', 'k': 'y', 'm': 'z',
              'n': '0', 'r': '2', 's': '4', 'p': 'z', 'g': 'w', 'o': '0', 'f': 'v', 'h': 'w', 'c': 'u', 'd': 'u'}
WS_DARK = {'5': '4', '4': '2', '2': '0', '0': 'z', 'z': 'y', 'y': 'x', 'x': 'w', 'w': 'v', 'v': 'u', 'u': 't',
           't': 'J', 'J': 'J', '1': 'z', '3': '0'}


def warm_cylinder(c, cx, r, y0, y1):
    for y in range(y0, y1 + 1):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if abs(x + 0.5 - cx) <= r + 0.6:
                g = c.get(x, y) if 0 <= x < c.w and 0 <= y < c.h else '.'
                if g in WARM_STONE:
                    c.put(x, y, WARM_STONE[g])


def fill_gap_under(c, x0, x1, ytop, ybot, ch_fn):
    """원뿔 처마와 원통 사이 투명 틈을 채운다(목 그늘). 열마다 ytop..ybot 의 '.' 만."""
    for x in range(max(0, x0), min(c.w - 1, x1) + 1):
        ys = [y for y in range(max(0, ytop), min(c.h - 1, ybot) + 1) if c.get(x, y) != '.']
        if not ys:
            continue
        for y in range(min(ys), max(ys) + 1):
            if c.get(x, y) == '.':
                c.put(x, y, ch_fn(x, y))


# ---------------------------------------------------------------- 촘촘한 분홍 막돌(버들항 대성당 벽 결)
STIP = 'vpvvpvwvpvvpxvvpvvwpvpvvpvxv'
STIP_W = [4, 3, 5, 3, 4, 2, 5, 3, 4, 3, 2, 4, 5, 3, 4]


def dense_rubble(c, x0, y0, w, h, seed=0, shade=None, mask=None, vy0=None):
    """2~3px 높이·2~5px 폭 작은 돌, 돌마다 v/p 점묘, 줄눈 J(맞닿는 모서리 C). 손으로 쓴 표만 읽는다."""
    vy0 = y0 if vy0 is None else vy0
    for y in range(y0, y0 + h):
        v = y - vy0
        k = v // 3
        lv = v % 3
        off = [0, 2, 1, 3, 2, 0, 3, 1][(k + seed) % 8]
        u = -off
        wi = (k * 4 + seed) % len(STIP_W)
        spans = []
        while u < w + 8:
            sw = STIP_W[wi % len(STIP_W)]
            spans.append((u, sw, wi + k * 3))
            u += sw
            wi += 1
        for x in range(x0, x0 + w):
            if mask and not mask(x, y):
                continue
            lx = x - x0
            for (su, sw, sid) in spans:
                if su <= lx < su + sw:
                    break
            lu = lx - su
            if lv == 2:
                ch = 'C' if lu == sw - 1 and sid % 2 else 'J'
            elif lu == sw - 1:
                ch = 'J' if lv == 0 or sid % 3 else 'C'
            else:
                ch = STIP[(lx * 3 + v * 5 + sid * 7) % len(STIP)]
                if lv == 0 and lu == 0 and sid % 2 == 0:
                    ch = 'p'
            s = shade(x, y) if shade else 0
            for _ in range(-s):
                ch = {'p': 'v', 'v': 'u', 'w': 'v', 'x': 'w', 'u': 't', 'J': 'J', 'C': 'C', 't': 't'}.get(ch, ch)
            c.put(x, y, ch)
