"""thouse — ㅜ자 집(덩어리 모형 6). 9×8 칸(144×128). 난수 없음(좌표 해시만).

2층 본채(정면과 나란한 용마루, 양 끝 모임 사선) 앞으로 **2층 박공 날개**가 나온다. 날개 용마루는 본채 용마루와 같은 높이 —
버들항 `bd-house-h124_0`/`h122_0` 규약(㉚): 남쪽 박공 삼각벽 뒤로 날개 지붕이 오각형으로 물러나 본채 용마루에서 닫히고,
기와는 용마루와 나란한 세로 열(왼 사면 밝게 · 오른 사면 어둡게), 날개 처마가 본채 처마에 닿은 곳부터 골이 비스듬히 용마루로 오른다.
본채 1층은 연보라 막돌, 2층은 회벽+반목조. 날개는 두 층 모두 반목조(1층 가운데 문)이고 박공에 작은 창.
이 폴더의 다른 도우미(common·gf·fixups)는 쓰지 않는다 — 다른 건물과 같은 8×8 조각이 나오지 않게 여기서 다 그린다."""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'building-kit'))
from massing_lib import Canvas  # noqa: E402

W, H = 144, 128
c = Canvas(9, 8)
WALLS = set()          # 벽(지붕 아닌) 화소 — walk 계산용


def hsh(x, y, s=0):
    v = (x * 73856093) ^ (y * 19349663) ^ (s * 83492791) ^ 0x5bd1e995
    v = (v ^ (v >> 13)) * 0x5bd1e995 & 0xffffffff
    return (v ^ (v >> 15)) & 0xffff


def put(x, y, ch, wall=False):
    c.put(x, y, ch)
    if wall:
        WALLS.add((x, y))


# ================================================================ 치수
RY, EY = 12, 54            # 본채 용마루 줄 · 처마 끝 줄
RX0, RX1 = 38, 105         # 본채 용마루 양 끝
GB = 70                    # 날개 박공 밑(날개 처마 높이 = 본채보다 16px 앞)
WL, WR = 44, 99            # 날개 지붕 바깥(처마) 열
NX0, NX1 = 46, 97          # 날개 벽
RIDGE = 71                 # 날개 용마루 두 열 71·72
MAIN_G = 111               # 본채 땅선
WING_G = 127               # 날개 땅선


def outl(y):               # 본채 왼 바깥 윤곽(모임 끝 처마): 용마루 끝에서 2px/줄로 내려가 x=0 에서 세로
    return max(0, RX0 - 2 * (y - RY))


def outr(y):
    return min(W - 1, RX1 + 2 * (y - RY))


def hipl(y):               # 왼 모임 사선(앞-왼 모서리) — 용마루 끝 → 처마 왼끝
    return RX0 - (y - RY) * RX0 / (EY - RY)


def hipr(y):
    return RX1 + (y - RY) * (W - 1 - RX1) / (EY - RY)


def vall(y):               # 날개 왼 골: 본채 처마(WL,EY) → 용마루(RIDGE,RY)
    return WL + (EY - y) * (RIDGE - WL) / (EY - RY) if y <= EY else WL


def valr(y):
    return WR - (EY - y) * (WR - RIDGE - 1) / (EY - RY) if y <= EY else WR


# ================================================================ 기와 결
FRONT_LV = [('L', 'ρ', 'π', '<'), ('σ', 'ρ', 'κ', '?'), ('ρ', 'π', 'κ', '='), ('π', 'κ', '<', '='),
            ('π', 'ν', 'κ', '+'), ('ν', 'λ', '+', '&'), ('ν', 'λ', '&', '&'), ('λ', '&', '+', '9')]


def front_tile(x, y):
    """본채 앞 사면: 처마와 나란한 가로 기와 줄(4줄 한 켜, 켜마다 반 장 어긋남, 장마다 밝기 다름). 위가 밝고 아래로 테라코타."""
    k, r = divmod(y - RY - 1, 4)
    off = 2 if k % 2 else 0
    t, col = divmod(x + off + (k * 7) % 3, 4)
    f = (y - RY) / (EY - RY)
    lv = min(len(FRONT_LV) - 1, int(f * len(FRONT_LV)))
    hv = hsh(t, k, 3)
    if hv % 7 == 0:
        lv = max(0, lv - 1)
    elif hv % 7 == 1:
        lv = min(len(FRONT_LV) - 1, lv + 1)
    li, mi, jt, dk = FRONT_LV[lv]
    if r == 3:
        return dk if col != 1 or hv % 3 else jt
    if col == 3:
        return jt if r == 2 else dk
    if r == 2 and col == 2:
        return jt
    if r == 0:
        return li if col < 2 or hv % 5 == 0 else mi
    if r == 1 and col == 0 and hv % 4 == 0:
        return li
    return mi


def lit_col(x, y, x0, sd=0):
    """밝은 사면(남북 박공 왼 사면·왼 모임면): 용마루와 나란한 세로 기와 열. 열 너비 4, 6줄마다 이음, 열마다 어긋남."""
    t, col = divmod(x - x0, 4)
    k, r = divmod(y + (t * 3) % 6, 6)
    hv = hsh(t, k, 11 + sd)
    hi = 'L' if hv % 3 else 'σ'
    mid = 'ρ' if hv % 5 else 'π'
    if r == 5:
        return '#' if col < 3 else '?'
    if col == 3:
        return '?' if hv % 4 else '#'
    if col == 0:
        return mid if r == 0 else hi
    if col == 1:
        return hi if r < 3 or hv % 2 else mid
    return mid


def dark_col(x, y, x0, sd=0):
    """어두운 사면(오른 사면): 세로 열, 밝은 이가 왼쪽에 한 줄."""
    t, col = divmod(x - x0, 4)
    k, r = divmod(y + (t * 2) % 5, 5)
    hv = hsh(t, k, 21 + sd)
    if r == 4:
        return '@' if col else '='
    if col == 0:
        return 'π' if hv % 3 else 'ν'
    if col == 3:
        return '@' if hv % 4 else '!'
    return '=' if (col + r + hv) % 3 else '@'


def hip_dark(x, y):
    """오른 모임면: 가로 결의 어두운 테라코타."""
    k, r = divmod(y, 4)
    t, col = divmod(x + (2 if k % 2 else 0), 4)
    hv = hsh(t, k, 31)
    if r == 3:
        return '9' if col != 2 else '%'
    if col == 3:
        return '%'
    if r == 0:
        return 'θ' if hv % 3 else 'ι'
    return 'θ' if (col + hv) % 3 else '%'


# ================================================================ 본채 지붕
for y in range(RY + 1, EY + 1):
    for x in range(outl(y), outr(y) + 1):
        hl, hr = hipl(y), hipr(y)
        if x < hl - 1:
            ch = lit_col(x, y, 0, 1)
        elif x > hr + 1:
            ch = hip_dark(x, y)
        else:
            ch = front_tile(x, y)
        put(x, y, ch)
    # 모임 사선(밝은 왼 사선 2px · 어두운 오른 사선)
    xl = int(round(hipl(y)))
    put(xl, y, 'η')
    put(xl - 1, y, 'η' if y % 4 else 'ζ')
    xr = int(round(hipr(y)))
    put(xr, y, '-')
    put(xr + 1, y, '_' if y % 3 else '-')
    # 바깥 윤곽(재질 어두운 단)
    ol, orr = outl(y), outr(y)
    if ol > 0:
        put(ol, y, '-')
        put(ol + 1, y, '-' if y % 2 else 'α')
    else:
        put(0, y, 'ζ' if y % 2 else '7')
    if orr < W - 1:
        put(orr, y, '_')
        put(orr - 1, y, '%' if y % 2 else '9')
    else:
        put(W - 1, y, '%' if y % 2 else '7')
# 용마루(얇은 마룻기와 두 줄)
for x in range(RX0, RX1 + 1):
    put(x, RY - 1, 'ζ' if (x - RX0) % 9 else 'η')
    put(x, RY, '-' if (x - RX0) % 6 else 'α')
put(RX0 - 1, RY, '-')
put(RX1 + 1, RY, '_')
# 처마 끝 테(맨 아래 켜 아래 어두운 물끊기)
for x in range(0, W):
    if c.get(x, EY) != '.':
        put(x, EY, '&' if x % 4 else '9')

# ================================================================ 굴뚝(오른 모임면, 밑동이 모임 사선을 따라 비스듬히)
CX0, CX1 = 116, 124
CTOP = 9
for x in range(CX0, CX1 + 1):
    base = int(round(RY + (x - RX1) * (EY - RY) / (W - 1 - RX1))) + 4
    for y in range(CTOP, base + 1):
        # 막돌(작은 회색 돌) — 줄마다 어긋남
        k, r = divmod(y - CTOP, 3)
        t, col = divmod(x - CX0 + (k % 2) * 2, 4)
        hv = hsh(t, k, 41)
        if r == 2 or col == 3:
            ch = 'd' if x < CX1 - 2 else 'X'
        else:
            ch = ('k' if hv % 3 else 'm') if x < CX0 + 4 else ('h' if hv % 2 else 'g') if x < CX1 - 1 else 'e'
        put(x, y, ch)
    put(x, base + 1, '9')                     # 지붕에 진 밑동 그늘(사선)
for y in range(CTOP, 44):
    if c.get(CX0, y) not in '.' and y < int(round(RY + (CX0 - RX1) * (EY - RY) / (W - 1 - RX1))) + 5:
        put(CX0, y, 'j')
    if y < int(round(RY + (CX1 - RX1) * (EY - RY) / (W - 1 - RX1))) + 5:
        put(CX1, y, 'X')
# 머리: 갓돌 고리 + 연기 구멍(위에서 본 윗면) — 갓돌은 몸통보다 한 화소씩 넓다
T0 = CTOP - 5
for x in range(CX0 - 1, CX1 + 2):
    put(x, T0, 'h' if CX0 <= x <= CX1 else '.')
    put(x, T0 + 1, 'm' if x < CX1 else 'h')
    put(x, T0 + 2, 'k' if x < CX1 else 'd')
    put(x, T0 + 3, 'h' if x < CX1 else 'e')
    put(x, T0 + 4, 'd' if x < CX1 else 'X')
for x in range(CX0 + 1, CX1):
    put(x, T0 + 1, 'T' if x > CX0 + 1 else 'd')
    put(x, T0 + 2, 'T' if CX0 + 1 < x < CX1 - 1 else ('U' if x > CX0 + 1 else 'd'))
put(CX0 - 1, T0 + 1, 'h')
put(CX1 + 1, T0 + 1, 'e')

# ================================================================ 날개 지붕(남북 박공, 오각형으로 본채 용마루까지)
for y in range(RY, GB + 1):
    a = int(round(vall(y))) if y <= EY else WL
    b = int(round(valr(y))) if y <= EY else WR
    for x in range(a, b + 1):
        put(x, y, lit_col(x, y, WL + 1, 5) if x < RIDGE else dark_col(x, y, RIDGE + 2, 5))
    # 골(본 지붕과 만나는 선): 어두운 두 화소 + 본 지붕 쪽 그늘 한 화소
    if y <= EY and y > RY:
        put(a, y, '-')
        put(a - 1, y, '!' if y % 2 else '@')
        put(b, y, '_')
        put(b + 1, y, '-')
        put(b + 2, y, '9' if y % 2 else '&')
# 용마루(세로 두 열)
for y in range(RY - 1, GB - 12):
    put(RIDGE, y, '<' if y % 4 else '*')
    put(RIDGE + 1, y, '7' if y % 3 else '6')
put(RIDGE, RY - 1, 'ζ')
put(RIDGE + 1, RY - 1, 'ζ')
# 날개 처마 세로 테(본채 처마 아래로 내려온 부분)
for y in range(EY + 1, GB + 1):
    put(WL, y, 'ζ' if y % 2 else 'α')
    put(WL + 1, y, 'η')
    put(WR, y, '_')
    put(WR - 1, y, '%')
for y in range(RY + 2, EY + 1):              # 골 바로 안쪽 날개 처마 테
    put(int(round(vall(y))) + 1, y, 'η' if y % 3 else 'ζ')
    put(int(round(valr(y))) - 1, y, '%')

# ================================================================ 날개 박공 삼각벽
GA = GB - 13                                  # 꼭짓점 줄 57


def gab_half(y):
    return 2 * (y - GA) + 1


def plaster(x, y, s=0):
    v = hsh(x, y, 51 + s) % 13
    if v == 0:
        return 'y'
    if v == 1 and (x + y) % 3 == 0:
        return 'z'
    if v in (2, 3):
        return '2'
    return '3'


for y in range(GA, GB):
    hw = gab_half(y)
    for x in range(RIDGE - hw + 1, RIDGE + 1 + hw):
        put(x, y, plaster(x, y, 1), True)
    # 박공널: 왼 밝게 2px · 오른 어둡게 2px
    xl, xr = RIDGE - hw, RIDGE + 1 + hw
    put(xl, y, 'ε')
    put(xl - 1, y, 'η' if y % 2 else 'ε')
    put(xr, y, '-')
    put(xr + 1, y, '_' if y % 2 else 'β')
put(RIDGE, GA - 1, 'η')
put(RIDGE + 1, GA - 1, 'β')
put(RIDGE, GA - 2, 'ζ')                       # 꼭대기 끝 장식(용마루에 닿는다)
# 삼각벽 안 가운데 기둥 + 작은 창(둥근 머리)
for y in range(GA + 2, GB):
    put(RIDGE, y, 'β', True)
    put(RIDGE + 1, y, '-', True)
for (x, y, ch) in [(67, 62, 'β'), (68, 61, 'β'), (69, 61, 'β'), (70, 61, 'β'), (67, 63, 'β'), (67, 64, 'β'), (67, 65, 'β'),
                   (68, 62, 'A'), (69, 62, 'D'), (70, 62, 'D'), (68, 63, 'A'), (69, 63, '^'), (70, 63, 'D'),
                   (68, 64, 'A'), (69, 64, 'A'), (70, 64, 'D'), (68, 65, 'A'), (69, 65, 'A'), (70, 65, 'A'),
                   (73, 62, 'D'), (74, 62, 'D'), (75, 62, 'A'), (73, 63, 'D'), (74, 63, 'A'), (75, 63, 'A'),
                   (73, 64, 'A'), (74, 64, 'A'), (75, 64, 'A'), (73, 65, 'A'), (74, 65, 'j'), (75, 65, 'A'),
                   (73, 61, 'β'), (74, 61, 'β'), (75, 61, 'β'), (76, 62, '_'), (76, 63, '_'), (76, 64, '_'), (76, 65, '_'),
                   (67, 66, 'ε'), (68, 66, 'η'), (69, 66, 'η'), (70, 66, 'η'), (71, 66, 'η'), (72, 66, 'η'), (73, 66, 'η'),
                   (74, 66, 'η'), (75, 66, 'η'), (76, 66, '-')]:
    put(x, y, ch, True)
# 삼각벽 밑 보(박공 받침)
for x in range(WL, WR + 1):
    put(x, GB, 'β' if WL < x < WR else ('ζ' if x == WL else '_'), True)
    put(x, GB + 1, '-' if WL < x < WR else ('α' if x == WL else '_'), True)


# ================================================================ 벽 공용
def post(x, y0, y1):
    for y in range(y0, y1 + 1):
        put(x, y, 'ε', True)
        put(x + 1, y, 'β', True)
        put(x + 2, y, '_', True)


def beam(x0, x1, y, light='ε', dark='-'):
    for x in range(x0, x1 + 1):
        put(x, y, light, True)
        put(x, y + 1, dark, True)


def brace(x0, y0, x1, y1):
    """가새(두 화소 굵기) — 끝은 기둥·보에 닿는다."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n)
        y = round(y0 + (y1 - y0) * i / n)
        put(x, y, 'β', True)
        put(x + (1 if x1 > x0 else -1), y, '-', True)


def plaster_rect(x0, y0, x1, y1, s):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(x, y, plaster(x, y, s), True)


def soffit(x0, x1, y0, step, phase):
    """처마 밑 그늘(위가 가장 어둡다) + 서까래 끝."""
    rows = ['/', 'c', 'f', 'l', 'l']
    for i, base in enumerate(rows):
        for x in range(x0, x1 + 1):
            ch = base
            if base == 'c' and hsh(x, y0, 61) % 6 == 0:
                ch = 'Y'
            if base == 'l' and i == 4 and hsh(x, y0 + i, 62) % 7 == 0:
                ch = 'h'
            if (x - x0 + phase) % step in (0, 1) and i < 3:
                ch = ';' if (x - x0 + phase) % step == 0 else '|'
            put(x, y0 + i, ch, True)


def rubble(x0, y0, x1, y1, s):
    """연보라·회색 막돌(작은 돌 2~5px, 켜 높이 3+이음 1, 켜마다 어긋남)."""
    for y in range(y0, y1 + 1):
        k, r = divmod(y - y0, 4)
        x = x0 - (hsh(k, s, 71) % 4)
        while x <= x1:
            wdt = 2 + hsh(x, k, 72 + s) % 4
            face = 'lowxlqo'[hsh(x, k, 73 + s) % 7]
            for i in range(wdt + 1):
                xx = x + i
                if xx < x0 or xx > x1:
                    continue
                if r == 3 or i == wdt:
                    ch = 'c' if (r == 3 and i < wdt) else 'f'
                elif r == 0 and i == 0:
                    ch = 'q'
                elif r == 2 and i == wdt - 1:
                    ch = 'f'
                else:
                    ch = face
                put(xx, y, ch, True)
            x += wdt + 1


def window(x, y, w, h, look):
    """창: 테 + 남색 유리 + 반짝임. look 마다 덧문·커튼·불빛·꽃상자·창턱 길이 다르게."""
    for yy in range(y, y + h):
        for xx in range(x, x + w):
            put(xx, yy, 'A', True)
    for xx in range(x - 1, x + w + 1):
        put(xx, y - 1, 'β', True)
    for yy in range(y, y + h):
        put(x - 1, yy, 'ε', True)
        put(x + w, yy, '_', True)
    mid = x + w // 2
    for yy in range(y, y + h):
        put(mid, yy, 'β', True)
    for xx in range(x, x + w):
        put(xx, y + h // 2, '-' if look != 2 else 'A', True)
        put(xx, y, 'D', True)
    put(x, y + 1, '^', True)
    put(mid + 1, y + 1, 'j' if look % 2 else '^', True)
    if look == 1:                              # 커튼(분홍) 위 모서리
        for xx, yy in ((x, y), (x + 1, y), (x, y + 1), (mid + 1, y), (mid + 2, y), (x + w - 1, y), (x + w - 1, y + 1)):
            put(xx, yy, 'o', True)
    if look == 3:                              # 불 켜진 아래 칸
        for yy in range(y + h // 2 + 1, y + h):
            for xx in range(x, x + w):
                if xx != mid:
                    put(xx, yy, 'K' if (xx + yy) % 3 else 'L', True)
    sill = 'iimi' if look != 4 else 'ηηηη'
    for i, xx in enumerate(range(x - 2, x + w + 2)):
        put(xx, y + h, sill[i % 4], True)
        put(xx, y + h + 1, 'e' if look != 4 else 'β', True)
    if look in (0, 3):                         # 꽃상자
        for i, xx in enumerate(range(x - 1, x + w + 1)):
            put(xx, y + h + 1, 'κMKMκN'[i % 6], True)
            put(xx, y + h + 2, 'β', True)
    if look in (2, 4):                         # 덧문(나무 두 짝, 세로 판)
        for yy in range(y - 1, y + h + 1):
            for i, xx in enumerate((x - 4, x - 3, x - 2)):
                put(xx, yy, 'ζδ-'[i] if yy % 4 else 'β', True)
            for i, xx in enumerate((x + w + 1, x + w + 2, x + w + 3)):
                put(xx, yy, 'δζ_'[i] if yy % 4 else 'β', True)


# ================================================================ 본채 벽 (x 2..141 · 처마 밑 55 · 땅 111)
MX0, MX1 = 2, W - 3
for (a, b) in ((MX0, NX0 - 1), (NX1 + 1, MX1)):
    soffit(a, b, EY + 1, 11, 3 if a == MX0 else 7)
    plaster_rect(a, EY + 6, b, 84, 2 if a == MX0 else 3)
# 2층 반목조: 기둥 · 가운데 띠 · 가새
UY0, UY1 = EY + 6, 84
post(MX0, EY + 1, 108)
post(MX1 - 2, EY + 1, 108)
for px in (20, 38, 108, 124):
    post(px, UY0, UY1)
beam(MX0, NX0 - 1, UY0)
beam(NX1 + 1, MX1, UY0)
window(8, UY0 + 6, 9, 11, 1)                 # 왼 2층 창(커튼)
brace(23, UY1 - 1, 36, UY0 + 2)              # 왼 둘째 칸 가새(띠장 → 보)
window(113, UY0 + 6, 8, 11, 0)               # 오른 2층 창(꽃상자)
brace(104, UY1 - 1, 101, UY0 + 2)
brace(127, UY0 + 2, 138, UY1 - 1)
# 층 사이 띠보(굵은 보 + 돌 띠)
for x in range(MX0, MX1 + 1):
    if NX0 <= x <= NX1:
        continue
    put(x, 85, 'η' if x % 9 else 'ζ', True)
    put(x, 86, 'ε', True)
    put(x, 87, 'β', True)
    put(x, 88, '-', True)
# 1층 막돌
rubble(MX0 + 3, 89, NX0 - 1, 107, 1)
rubble(NX1 + 1, 89, MX1 - 3, 107, 2)
window(14, 93, 8, 9, 2)                      # 왼 1층 창(덧문)
window(118, 92, 8, 10, 3)                    # 오른 1층 창(불빛·꽃상자)
# 기초(어두운 돌 두 줄)
for x in range(MX0, MX1 + 1):
    if NX0 <= x <= NX1:
        continue
    put(x, 108, 'aiimiWii'[(x * 5) % 8] if x not in (MX0, MX1) else 'a', True)
    put(x, 109, 'Z' if x % 7 else 'Y', True)
    put(x, 110, 'U' if x % 5 else 'Y', True)
    put(x, 111, 'V' if x % 6 else 'U', True)
for y in range(EY + 1, MAIN_G + 1):          # 벽 좌우 끝 어두운 테
    put(MX0 - 1, y, 'β' if y < 108 else 'U')
    put(MX1 + 1, y, '-' if y < 108 else 'U')
# 날개가 본채 오른 벽에 지는 그늘(빛 왼 위)
for y in range(EY + 6, MAIN_G - 3):
    for i, x in enumerate((NX1 + 1, NX1 + 2, NX1 + 3)):
        ch = c.get(x, y)
        dk = {'3': 'x', 'y': 'w', 'z': 'w', '2': 'x', 'l': 'f', 'o': 'l', 'w': 'f', 'x': 'w', 'q': 'l', 'c': 'c',
              'ε': 'β', 'η': 'ε', 'β': '-', 'f': 'c'}
        if i < 2 or y % 2:
            put(x, y, dk.get(ch, ch), True)

# ================================================================ 날개 벽 (x 46..97 · 박공 밑 72 · 땅 127)
soffit(NX0, NX1, GB + 2, 13, 5)
plaster_rect(NX0, GB + 7, NX1, 124, 4)
WUY = GB + 7                                  # 2층 77..98
post(NX0, GB + 2, 124)
post(NX1 - 2, GB + 2, 124)
post(58, WUY, 98)
post(83, WUY, 98)
beam(NX0, NX1, WUY)
window(64, WUY + 5, 14, 12, 4)               # 날개 2층 큰 창(세 칸, 덧문 없음 창턱 나무)
for yy in range(WUY + 5, WUY + 17):
    put(68, yy, 'β', True)
    put(74, yy, 'β', True)
brace(49, 97, 56, WUY + 3)                   # 2층 양 끝 칸 가새(반대 방향)
brace(94, 97, 87, WUY + 3)
for x in range(NX0, NX1 + 1):                 # 날개 층 사이 띠
    put(x, 99, 'η' if x % 8 else 'ζ', True)
    put(x, 100, 'ε', True)
    put(x, 101, '-', True)
# 1층: 문 + 작은 창 + 등불
DX0, DX1 = 66, 77
post(DX0 - 3, 102, 124)
post(DX1 + 1, 102, 124)
for y in range(103, 126):                     # 아치 문(세로 판 + 징)
    for x in range(DX0, DX1 + 1):
        top = 103 + (2 if x in (DX0, DX1) else (1 if x in (DX0 + 1, DX1 - 1) else 0))
        if y < top:
            put(x, y, 'β', True)
            continue
        col = (x - DX0) % 3
        ch = 'ζ' if col == 0 else ('δ' if col == 1 else 'β')
        if y in (108, 119) and DX0 < x < DX1:
            ch = 'X' if x % 2 else 'U'
        put(x, y, ch, True)
    put(DX0 - 1 + 0, y, c.get(DX0, y), True)
for (x, y, ch) in [(75, 113, 'K'), (75, 114, 'τ'), (DX0 + 1, 110, 'h'), (DX1 - 1, 116, 'h')]:
    put(x, y, ch, True)
for x in range(DX0, DX1 + 1):
    put(x, 102, 'β', True)
window(86, 107, 6, 8, 1)                     # 문 오른쪽 작은 창
brace(49, 124, 59, 103)                      # 1층 왼 칸 긴 가새
for (x, y, ch) in [(60, 106, 'U'), (61, 106, 'U'), (62, 106, 'U'), (60, 107, 'X'), (59, 108, 'X'), (60, 108, 'Y'), (61, 108, 'X'),
                   (59, 109, 'K'), (60, 109, 'L'), (61, 109, 'K'), (59, 110, 'K'), (60, 110, 'K'), (61, 110, 'τ'),
                   (59, 111, 'X'), (60, 111, 'U'), (61, 111, 'X')]:
    put(x, y, ch, True)
for x in range(NX0, NX1 + 1):                 # 날개 기초 + 문턱
    if DX0 - 1 <= x <= DX1 + 1:
        put(x, 125, 'm', True)
        put(x, 126, 'r' if x % 3 else 'm', True)
        put(x, 127, 'i', True)
    else:
        put(x, 125, 'aiimiWii'[(x * 3) % 8], True)
        put(x, 126, 'Z' if x % 6 else 'Y', True)
        put(x, 127, 'U' if x % 4 else 'V', True)
for y in range(GB + 2, WING_G + 1):          # 날개 벽 좌우 테
    if y < 125:
        put(NX0, y, 'ε' if y % 7 else 'η', True)
for y in range(MAIN_G - 3, WING_G + 1):
    put(NX0 - 1, y, 'U' if y > MAIN_G else c.get(NX0 - 1, y))
# 이끼·풍화 몇 점(지붕)
for (x, y) in [(12, 47), (13, 47), (30, 52), (98, 22), (99, 22), (124, 50), (52, 40), (88, 44)]:
    if c.get(x, y) not in '.':
        put(x, y, 'O' if (x + y) % 2 else 'N')

# ================================================================ 마감: 갇힌 투명 막기 · walk
for _ in range(2):
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if c.get(x, y) == '.' and c.get(x - 1, y) != '.' and c.get(x + 1, y) != '.' and \
                    c.get(x, y - 1) != '.' and c.get(x, y + 1) != '.':
                put(x, y, c.get(x - 1, y))

walk = []
for cy in range(8):
    row = ''
    for cx in range(9):
        cells = [(x, y) for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16)]
        drawn = any(c.get(x, y) != '.' for (x, y) in cells)
        if not drawn:
            row += '.'
        elif cy >= 3:
            row += 'X'
        else:
            row += '*'
    walk.append(row)
walk[6] = walk[6][:4] + 'D' + walk[6][5:]
walk[7] = walk[7][:4] + 'D' + walk[7][5:]

meta = {
    'name': 'ㅜ자 집', 'massing': '6', 'material': 'plaster',
    'refs': ['bd-house-h124_0', 'bd-house-h122_0'],
    'walk': walk,
}
print('\n'.join(walk))
fails, warns = c.save('thouse', meta)
print('fails', fails, 'warns', warns)
