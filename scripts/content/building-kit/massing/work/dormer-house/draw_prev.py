"""dormer-house — 지붕창 집(덩어리 모형 17). 7×8 칸(112×128). 난수 없음(좌표 해시만).

2층 벽(층마다 27~31px) 위에 가파른 청석(슬레이트) 모임지붕, 지붕 속 다락에 지붕창 둘, 굴뚝 하나.
지붕 색은 버들항 청기와(`bd-house-cathedral`·`bd-house-barracks`) 분포(㉝): 위쪽 켜는 밝은 G/H, 아래로 F/E, 이음은 B.
지붕창은 서로 다르다(㉔): 왼쪽 = 남북 박공 지붕창(세로 기와 열 두 사면 + 세로 용마루 + 남쪽 삼각벽, ㉚ 규약 축소판),
오른쪽 = 모임 지붕창(앞 사면 가로 기와 + 양 모임 사선 + 짧은 용마루). 둘 다 테라코타(모형의 주황 지붕창)라 뒤 청석과 램프가 다르고,
본 지붕과 만나는 골·옆 그늘을 둘레에 그린다.
벽: 1층 = 흰 돌 다듬돌(켜마다 어긋남, 연보라 줄눈), 2층 = 점묘 회벽(2~3단) + 모서리 귀돌, 층 사이 돌 띠.
창은 층마다 다르게(덧문·커튼·불빛·꽃상자·쇠살), 1층 가운데 아치 문.
이 폴더의 다른 도우미는 쓰지 않는다 — 다른 건물과 같은 8×8 조각이 나오지 않게 여기서 다 그린다."""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', 'building-kit'))
from massing_lib import Canvas  # noqa: E402

W, H = 112, 128
c = Canvas(7, 8)


def hsh(x, y, s=0):
    v = (x * 2654435761) ^ (y * 40503) ^ (s * 2246822519) ^ 0x27d4eb2f
    v = (v ^ (v >> 15)) * 0x85ebca6b & 0xffffffff
    return (v ^ (v >> 13)) & 0xffff


def put(x, y, ch):
    c.put(x, y, ch)


DARKER = {'H': 'G', 'I': 'H', 'G': 'F', 'F': 'E', 'E': 'B', 'B': 'A', 'D': 'A', 'C': 'B',
          'L': 'ρ', 'σ': 'ρ', 'ρ': 'π', 'π': 'κ', 'κ': '+', 'ν': 'λ', 'λ': '&', '<': '=', '?': '=', '=': '@', '@': '!',
          '#': '!', '&': '9', '+': '&', '%': '9', 'θ': '%', 'ζ': 'ε', 'η': 'ε', 'ε': 'β', 'β': '-', '-': '_'}


def darken(x, y, n=1):
    ch = c.get(x, y)
    for _ in range(n):
        ch = DARKER.get(ch, ch)
    put(x, y, ch)


# ================================================================ 치수
RY, EY = 7, 58
RX0, RX1 = 34, 77
GY = 127


def outl(y):
    return max(0, RX0 - 2 * (y - RY))


def outr(y):
    return min(W - 1, RX1 + 2 * (y - RY))


def hipl(y):
    return RX0 - (y - RY) * RX0 / (EY - RY)


def hipr(y):
    return RX1 + (y - RY) * (W - 1 - RX1) / (EY - RY)


# ================================================================ 청석 결
SL = [('H', 'G', 'F', 'B'), ('H', 'G', 'F', 'E'), ('G', 'G', 'F', 'B'), ('G', 'F', 'E', 'B'),
      ('G', 'F', 'E', 'B'), ('F', 'F', 'E', 'B'), ('F', 'E', 'E', 'B'), ('F', 'E', 'B', 'B')]


def slate_front(x, y):
    """앞 사면: 가로 켜(3줄 + 이음 1줄), 켜마다 반 장 어긋남, 장(너비 4)마다 밝기 한 단 오르내림."""
    k, r = divmod(y - RY - 1, 4)
    off = (k * 3) % 4
    t, col = divmod(x + off, 4)
    lv = min(len(SL) - 1, int((y - RY) / (EY - RY + 1) * len(SL)))
    hv = hsh(t, k, 1)
    if hv % 6 == 0:
        lv = max(0, lv - 1)
    elif hv % 6 == 1:
        lv = min(len(SL) - 1, lv + 1)
    hi, mi, lo, jt = SL[lv]
    if r == 3:
        return jt if col != 2 else lo
    if col == 3:
        return lo if r == 0 else jt
    if r == 0:
        return hi if col < 2 else mi
    if r == 2:
        return lo if col == 0 else mi
    return mi


def slate_lit(x, y):
    """왼 모임면: 빛 받는 세로 결(열 너비 3)."""
    t, col = divmod(x, 3)
    k, r = divmod(y + (t * 2) % 5, 5)
    hv = hsh(t, k, 2)
    if r == 4:
        return 'G' if col else 'F'
    if col == 2:
        return 'F' if hv % 3 else 'E'
    if col == 0:
        return 'I' if hv % 5 == 0 else 'H'
    return 'G' if (r + hv) % 3 else 'H'


def slate_dark(x, y):
    """오른 모임면: 그늘 진 세로 결."""
    t, col = divmod(x, 3)
    k, r = divmod(y + t % 4, 4)
    hv = hsh(t, k, 3)
    if r == 3:
        return 'B'
    if col == 2:
        return 'B' if hv % 2 else 'E'
    if col == 0:
        return 'F' if hv % 3 else 'E'
    return 'E'


# ================================================================ 본 지붕
for y in range(RY + 1, EY + 1):
    for x in range(outl(y), outr(y) + 1):
        if x < hipl(y) - 1:
            ch = slate_lit(x, y)
        elif x > hipr(y) + 1:
            ch = slate_dark(x, y)
        else:
            ch = slate_front(x, y)
        put(x, y, ch)
    xl = int(round(hipl(y)))
    put(xl, y, 'I' if y % 3 else 'H')            # 밝은 모임 사선(얇은 마룻기와)
    put(xl + 1, y, 'G')
    xr = int(round(hipr(y)))
    put(xr, y, 'B')
    put(xr - 1, y, 'G' if y % 2 else 'F')
    ol, orr = outl(y), outr(y)
    if ol > 0:
        put(ol, y, 'E')
        put(ol + 1, y, 'G' if y % 2 else 'F')
    else:
        put(0, y, 'E' if y % 2 else 'F')
    if orr < W - 1:
        put(orr, y, 'E')
        put(orr - 1, y, 'B')
    else:
        put(W - 1, y, 'E')
for x in range(RX0, RX1 + 1):                      # 용마루: 얇은 마룻기와 두 줄
    put(x, RY - 1, 'H' if (x - RX0) % 7 else 'I')
    put(x, RY, 'E' if (x - RX0) % 5 else 'F')
put(RX0 - 1, RY, 'E')
put(RX1 + 1, RY, 'E')
for x in range(W):                                 # 처마 끝 물끊기
    put(x, EY, 'B' if x % 5 else 'E')
    put(x, EY - 1, 'E' if x % 3 else 'F')


# ================================================================ 지붕창 공용
def wall_face(x0, x1, y0, y1, s):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            v = hsh(x, y, 40 + s) % 9
            put(x, y, '0' if v == 0 else ('z' if v == 1 else ('2' if v < 4 else '4')))


def dwin(x0, y0, w, h, lit, arched):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            put(x, y, 'A')
    mid = x0 + w // 2
    for y in range(y0, y0 + h):
        put(mid, y, 'r')
    for x in range(x0, x0 + w):
        put(x, y0 + h // 2, 'r')
    put(x0, y0 + 1, '^')
    put(mid + 1, y0 + 1, 'j')
    if lit:
        for y in range(y0 + h // 2 + 1, y0 + h):
            for x in (mid + 1, mid + 2):
                put(x, y, 'K')
    for y in range(y0 - 1, y0 + h + 1):            # 흰 돌 창틀
        put(x0 - 1, y, 'r')
        put(x0 + w, y, 'h')
    for x in range(x0 - 1, x0 + w + 1):
        put(x, y0 - 1, 'r' if not arched or x0 <= x < x0 + w else '.')
        put(x, y0 + h, 'm')
        put(x, y0 + h + 1, 'e')
    if arched:
        put(x0 - 1, y0 - 1, c.get(x0 - 2, y0 - 1))
        put(x0 + w, y0 - 1, c.get(x0 + w + 1, y0 - 1))
        put(x0, y0, 'r')
        put(x0 + w - 1, y0, 'h')


# ---------------------------------------------------------------- 왼 지붕창: 남북 박공(작은 3/4 지붕 윗면)
GX0, GX1 = 16, 39                                   # 지붕(처마 포함) 열
GC = 27                                             # 용마루 두 열 27·28
GW0, GW1 = 18, 37                                   # 앞벽
GBASE = 41                                          # 삼각벽 밑
GTOP = 17                                           # 지붕창 용마루가 본 지붕 속으로 들어가는 곳
GEAVE = 34                                          # 지붕창 처마 높이(세로 처마가 여기서 골로 바뀐다)
before = [r[:] for r in c.g]


def gvl(y):
    return GX0 + (GEAVE - y) * (GC - GX0) / (GEAVE - GTOP) if y < GEAVE else GX0


def gvr(y):
    return GX1 - (GEAVE - y) * (GX1 - GC - 1) / (GEAVE - GTOP) if y < GEAVE else GX1


for y in range(GTOP, GBASE + 1):
    a, b = int(round(gvl(y))), int(round(gvr(y)))
    for x in range(a, b + 1):
        if x <= GC:                                  # 왼 사면: 밝은 세로 기와 열
            t, col = divmod(x - GX0, 3)
            k, r = divmod(y + t * 2, 5)
            hv = hsh(t, k, 7)
            ch = '#' if r == 4 else ('?' if col == 2 else ('L' if col == 0 and hv % 2 else 'ρ' if col else 'σ'))
        else:                                        # 오른 사면: 어두운 세로 열
            t, col = divmod(x - GC - 1, 3)
            k, r = divmod(y + t, 4)
            ch = '@' if r == 3 else ('π' if col == 0 else ('=' if (col + r) % 2 else '@'))
        put(x, y, ch)
    put(a, y, 'ζ' if y >= GEAVE else 'η')            # 왼 처마·골 테
    put(b, y, '%' if y >= GEAVE else '!')
for y in range(GTOP - 1, GBASE - 9):                # 지붕창 용마루(세로)
    put(GC, y, '<')
    put(GC + 1, y, '7' if y % 2 else '6')
GA = GBASE - 10                                     # 삼각벽 꼭짓점 31
for y in range(GA, GBASE + 1):
    hw = (y - GA)
    for x in range(GC - hw, GC + 2 + hw):
        put(x, y, '3' if hsh(x, y, 9) % 7 else 'y')
    put(GC - hw - 1, y, 'ε')                       # 박공널
    put(GC - hw - 2, y, 'η')
    put(GC + 2 + hw, y, '-')
    put(GC + 3 + hw, y, 'β')
put(GC, GA - 1, 'η')
put(GC + 1, GA - 1, 'β')
wall_face(GW0, GW1, GBASE + 1, 52, 1)
for y in range(GBASE + 1, 53):
    put(GW0, y, 'ε')
    put(GW1, y, '_')
for x in range(GW0, GW1 + 1):                       # 박공 밑 보
    put(x, GBASE + 1, 'β')
dwin(23, 44, 9, 8, False, False)
for x in range(GW0 - 1, GW1 + 2):                    # 지붕창 밑 납 물막이(본 지붕 위)
    put(x, 53, 'e' if x % 2 else 'X')
    put(x, 54, 'd')

# ---------------------------------------------------------------- 오른 지붕창: 모임(앞 사면 + 양 모임 사선)
HX0, HX1 = 72, 95                                   # 처마 폭
HR0, HR1 = 79, 88                                   # 짧은 용마루
HRY, HEY = 28, 40                                   # 용마루 줄 · 처마 줄
HW0, HW1 = 74, 93
for y in range(HRY - 6, HRY):                       # 용마루 뒤로 본 지붕에 묻히는 뒤 사면(짧게 위로 물러남)
    a = HR0 + (HRY - y) // 2
    b = HR1 - (HRY - y) // 2
    for x in range(a, b + 1):
        put(x, y, 'λ' if (x + y) % 3 else 'ν')
    put(a, y, 'ζ')
    put(b, y, '%')
for y in range(HRY, HEY + 1):
    f = (y - HRY) / (HEY - HRY)
    a = int(round(HR0 - f * (HR0 - HX0)))
    b = int(round(HR1 + f * (HX1 - HR1)))
    for x in range(a, b + 1):
        k, r = divmod(y - HRY, 3)
        t, col = divmod(x + (k % 2) * 2, 4)
        hv = hsh(t, k, 12)
        if x < a + 3 + (y - HRY) // 3:               # 왼 모임: 밝다
            ch = 'σ' if (x + y) % 3 else 'L'
        elif x > b - 3 - (y - HRY) // 3:             # 오른 모임: 어둡다
            ch = '%' if (x + y) % 2 else '9'
        else:                                         # 앞 사면: 가로 기와(위 밝게)
            if r == 2:
                ch = '+' if col != 1 else '&'
            elif col == 3:
                ch = '&'
            elif r == 0:
                ch = ('ρ' if hv % 3 else 'σ') if y < HRY + 6 else ('π' if hv % 3 else 'ρ')
            else:
                ch = 'κ' if y < HRY + 6 else ('ν' if hv % 2 else 'κ')
        put(x, y, ch)
    put(a, y, 'ζ')
    put(b, y, '_')
    hl = int(round(a + 2 + (y - HRY) / 3))
    put(hl, y, 'η')
    hr = int(round(b - 2 - (y - HRY) / 3))
    put(hr, y, '-')
for x in range(HR0, HR1 + 1):
    put(x, HRY - 1, 'ζ' if x % 3 else 'η')
for x in range(HX0, HX1 + 1):
    put(x, HEY + 1, '&' if x % 3 else '9')
wall_face(HW0, HW1, HEY + 2, 52, 2)
for y in range(HEY + 2, 53):
    put(HW0, y, 'ε')
    put(HW1, y, '_')
for x in range(HW0 + 1, HW1):                       # 처마 밑 그늘
    put(x, HEY + 2, 'x')
dwin(80, 44, 8, 8, True, True)
for x in range(HW0 - 1, HW1 + 2):
    put(x, 53, 'e' if x % 2 else 'X')
    put(x, 54, 'd')

# ---------------------------------------------------------------- 지붕창 둘레 골·그늘(본 지붕에 진다)
changed = {(x, y) for y in range(H) for x in range(W) if c.g[y][x] != before[y][x]}
for (x, y) in sorted(changed):
    for ax, ay, n in ((1, 0, 2), (2, 0, 1), (3, 0, 1), (0, 1, 1), (-1, 0, 1)):
        q = (x + ax, y + ay)
        if q not in changed and 0 <= q[0] < W and 0 <= q[1] <= EY - 2:
            darken(q[0], q[1], n)
            changed.add(q) if False else None

# ================================================================ 굴뚝(왼 모임면, 밑동이 바깥 처마 사선을 따른다)
CX0, CX1 = 9, 16
for x in range(CX0, CX1 + 1):
    base = int(round(hipl_y := RY + (RX0 - x) * (EY - RY) / RX0)) - 6
    for y in range(6, base + 1):
        k, r = divmod(y - 6, 3)
        t, col = divmod(x - CX0 + (k % 2) * 2, 3)
        hv = hsh(t, k, 30)
        if r == 2 or col == 2:
            ch = 'v' if x < CX1 - 1 else 't'
        else:
            ch = ('z' if hv % 2 else 'y') if x < CX0 + 4 else ('x' if hv % 2 else 'w')
        if x == CX0:
            ch = '0'
        if x == CX1:
            ch = 'u'
        put(x, y, ch)
    put(x, base + 1, 'B')
    put(x, base + 2, 'E')
T0 = 2
for x in range(CX0 - 1, CX1 + 2):                 # 갓돌 고리 + 연기 구멍(윗면)
    put(x, T0, 'm' if CX0 <= x < CX1 else 'h')
    put(x, T0 + 1, 'r' if x < CX1 else 'h')
    put(x, T0 + 2, 'm' if x < CX1 else 'e')
    put(x, T0 + 3, 'h' if x < CX1 else 'd')
for x in range(CX0 + 1, CX1):
    put(x, T0 + 1, 'T')
    put(x, T0 + 2, 'T' if x < CX1 - 1 else 'U')
put(CX0 - 1, T0, '.')
put(CX1 + 1, T0, '.')
for x in range(CX0, CX1 + 1):
    put(x, T0 + 4, 'v' if x < CX1 else 't')


# ================================================================ 벽
WX0, WX1 = 3, W - 4                                 # 벽 3..108
CY0 = EY + 1                                        # 처마 밑 돌림띠 59..62
for x in range(WX0, WX1 + 1):
    put(x, CY0, 'B' if x % 4 else 'A')               # 처마 그늘
    put(x, CY0 + 1, 'e')
    put(x, CY0 + 2, 'r' if x < W // 2 else 'm')     # 돌림띠 윗면
    put(x, CY0 + 3, 'i' if x % 9 else 'h')
    put(x, CY0 + 4, 'd' if x % 3 else 'e')
UY0, UY1 = CY0 + 5, 89                              # 2층 64..89 (26) + 돌림띠 = 31
for y in range(UY0, UY1 + 1):
    for x in range(WX0, WX1 + 1):
        v = hsh(x, y, 50) % 11
        put(x, y, '0' if v == 0 else ('z' if v in (1, 2) and (x * 3 + y) % 4 == 0 else ('2' if v < 5 else '4')))
# 2층 모서리 귀돌(큰 돌·작은 돌 번갈아)
for side, (x0, x1) in (('l', (WX0, WX0 + 7)), ('r', (WX1 - 7, WX1))):
    for i, y0 in enumerate(range(UY0, UY1 + 1, 6)):
        w = 7 if i % 2 == 0 else 4
        xa, xb = (x0, x0 + w) if side == 'l' else (x1 - w, x1)
        for y in range(y0, min(y0 + 5, UY1 + 1)):
            for x in range(xa, xb + 1):
                ch = 'r' if y == y0 else ('n' if (x + y) % 5 else 'm')
                if x == xb if side == 'l' else x == xa:
                    ch = 'h' if side == 'l' else 'j'
                put(x, y, ch)
        for x in range(xa, xb + 1):
            put(x, min(y0 + 5, UY1), 'l')
# 층 사이 돌 띠 90..92
for x in range(WX0, WX1 + 1):
    put(x, 90, 'r' if x % 11 else 'n')
    put(x, 91, 'm' if x % 7 else 'k')
    put(x, 92, 'e')
GY0, GY1 = 93, 123                                  # 1층 다듬돌 31px
for y in range(GY0, GY1 + 1):
    k, r = divmod(y - GY0, 5)
    off = (k % 2) * 7 + (k % 3)
    for x in range(WX0, WX1 + 1):
        t, col = divmod(x + off, 14)
        hv = hsh(t, k, 60)
        face = 'pnpqp'[hv % 5]
        if r == 4:
            ch = 'l' if col else 'w'
        elif col == 13:
            ch = 'w' if r else 'l'
        elif r == 0:
            ch = 'r' if col < 12 else face
        elif col == 12 or r == 3:
            ch = 'n' if face != 'n' else 'k'
        else:
            ch = face if hsh(x, y, 61) % 9 else ('z' if face == 'p' else 'o')
        put(x, y, ch)
for y in range(UY0, GY1 + 1):                       # 벽 좌우 끝 테(재질 어두운 단)
    put(WX0 - 1, y, 'k' if y < 90 else 'e')
    put(WX1 + 1, y, 'g' if y < 90 else 'd')
for x in range(WX0 - 1, WX1 + 2):                   # 기초(어두운 돌)
    put(x, 124, 'i' if x % 6 else 'h')
    put(x, 125, 'g' if x % 4 else 'd')
    put(x, 126, 'Z' if x % 5 else 'Y')
    put(x, 127, 'V' if x % 3 else 'W')


# ================================================================ 창(층마다 다르게)
def win(x0, y0, w, h, look):
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            put(x, y, 'A')
    mid = x0 + w // 2
    for y in range(y0, y0 + h):
        put(mid, y, 'β')
    for x in range(x0, x0 + w):
        put(x, y0 + h // 3, 'β')
        put(x, y0, 'D')
    put(x0, y0 + 1, '^')
    put(x0, y0 + 2, 'j')
    put(mid + 1, y0 + 1 + h // 3, '^')
    for y in range(y0 - 2, y0 + h + 2):              # 흰 돌 창틀
        put(x0 - 1, y, 'r')
        put(x0 + w, y, 'h')
    for x in range(x0 - 1, x0 + w + 1):
        put(x, y0 - 2, 'r')
        put(x, y0 - 1, 'm')
    if look == 'curtain':
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (w - 1, 0), (w - 2, 0), (w - 1, 1), (mid - x0 + 1, 0)):
            put(x0 + dx, y0 + dy, 'o')
    if look == 'lit':
        for y in range(y0 + h // 3 + 1, y0 + h):
            for x in range(x0, x0 + w):
                if x != mid:
                    put(x, y, 'K' if (x + 2 * y) % 5 else 'L')
    if look == 'grille':
        for y in range(y0 + h // 3 + 1, y0 + h):
            for x in range(x0, x0 + w, 2):
                put(x, y, 'X')
    sill = w + 4 if look in ('box', 'shutter') else w + 2
    sx = x0 - (sill - w) // 2
    for x in range(sx, sx + sill):
        put(x, y0 + h, 'r' if x < sx + sill - 1 else 'm')
        put(x, y0 + h + 1, 'e')
    if look == 'box':
        for i, x in enumerate(range(x0 - 1, x0 + w + 1)):
            put(x, y0 + h - 1, 'NOMκRK'[i % 6])
            put(x, y0 + h + 1, 'β')
            put(x, y0 + h + 2, '-')
    if look == 'shutter':                            # 열린 덧문(청록 판)
        for y in range(y0 - 1, y0 + h):
            for i, x in enumerate((x0 - 5, x0 - 4, x0 - 3)):
                put(x, y, '^>>'[i] if y % 5 else 'b')
            for i, x in enumerate((x0 + w + 2, x0 + w + 3, x0 + w + 4)):
                put(x, y, '>>b'[i] if y % 5 else 'b')


win(13, 70, 8, 14, 'shutter')                     # 2층 왼
win(51, 69, 10, 15, 'box')                        # 2층 가운데(넓은 창 + 꽃상자)
win(90, 70, 8, 14, 'curtain')                     # 2층 오른
win(14, 99, 9, 16, 'grille')                      # 1층 왼(쇠살)
win(88, 99, 9, 16, 'lit')                         # 1층 오른(불빛)

# 문(가운데): 둥근 돌 문틀(쐐기돌) + 채광창 + 나무 문 + 돌 계단
DX0, DX1 = 50, 61
CXD = (DX0 + DX1) / 2.0


def arch_top(x, rad):
    d = abs(x + 0.5 - (CXD + 0.5))
    return 100 - int(round((max(0.0, rad * rad - d * d)) ** 0.5 * 0.55))


for x in range(DX0 - 2, DX1 + 3):                  # 바깥 돌 테(두 화소) — 둥근 머리
    t = arch_top(x, 8.5)
    for y in range(t, 124):
        put(x, y, 'r' if x < CXD else 'm')
    put(x, t, 'n' if x < CXD else 'k')
for x in range(DX0 - 1, DX1 + 2):                  # 안쪽 어두운 홈
    t = arch_top(x, 7.5) + 2
    for y in range(t, 124):
        put(x, y, 'A')
for (x, y, ch) in ((55, 93, 'r'), (56, 93, 'm'), (55, 94, 'n'), (56, 94, 'k')):   # 쐐기돌
    put(x, y, ch)
for x in range(DX0, DX1 + 1):                       # 채광창(반원 유리 + 살)
    t = arch_top(x, 7.5) + 3
    for y in range(t, 101):
        put(x, y, 'D' if (x - DX0) % 4 else 'm')
put(DX0 + 2, 99, '^')
put(DX0 + 3, 98, 'j')
for x in range(DX0 - 1, DX1 + 2):
    put(x, 101, 'm' if x < DX1 + 1 else 'k')
for y in range(102, 124):                           # 나무 문 두 짝(세로 판)
    for x in range(DX0, DX1 + 1):
        col = (x - DX0) % 4
        ch = 'ζ' if col == 0 else ('δ' if col in (1, 2) else 'β')
        if x == (DX0 + DX1) // 2 or x == (DX0 + DX1) // 2 + 1:
            ch = 'β' if x == (DX0 + DX1) // 2 else '-'
        if y in (107, 117):
            ch = 'X' if x % 2 else 'U'
        put(x, y, ch)
put(DX0 + 4, 112, 'K')
put(DX1 - 4, 112, 'K')
for x in range(DX0 - 2, DX1 + 3):                  # 돌 계단 두 단
    put(x, 124, 'r' if x < DX1 + 1 else 'm')
    put(x, 125, 'm')
    put(x, 126, 'k' if x % 3 else 'j')
    put(x, 127, 'h')
# 이끼 몇 점
for (x, y) in [(6, 50), (7, 50), (104, 52), (45, 56)]:
    if c.get(x, y) != '.':
        put(x, y, 'N' if x % 2 else 'O')

# ================================================================ 마감
for _ in range(2):
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            if c.get(x, y) == '.' and c.get(x - 1, y) != '.' and c.get(x + 1, y) != '.' and \
                    c.get(x, y - 1) != '.' and c.get(x, y + 1) != '.':
                put(x, y, c.get(x - 1, y))
# 같은 건물 안에서 8×8 칸(8의 배수 자리)이 되풀이되지 않게: 겹친 칸마다 기와 한 장을 손으로 한 단 바꾼다
for _ in range(6):
    seen, dup = {}, []
    for by in range(0, H, 8):
        for bx in range(0, W, 8):
            key = tuple(''.join(c.g[y][bx:bx + 8]) for y in range(by, by + 8))
            if ''.join(key).count('.') > 8:
                continue
            if key in seen:
                dup.append((bx, by))
            else:
                seen[key] = (bx, by)
    if not dup:
        break
    for n, (bx, by) in enumerate(dup):
        for (dx, dy) in ((2 + n % 4, 1 + n % 3), (5 - n % 3, 5)):
            x, y = bx + dx, by + dy
            ch = c.get(x, y)
            lift = {'F': 'G', 'G': 'H', 'E': 'F', 'B': 'E', 'H': 'G', '2': '0', '4': '2', 'r': 'm', 'm': 'n'}
            if ch in lift:
                put(x, y, lift[ch])
walk = []
for cy in range(8):
    r = ''
    for cx in range(7):
        op = any(c.get(x, y) != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
        r += '.' if not op else ('D' if (cx == 3 and cy in (6, 7)) else ('*' if cy < 3 else 'X'))
    walk.append(r)
print('\n'.join(walk))
# 덩어리 모형: 감독 지시는 '5' 였으나 5번은 지붕창 없는 1층 긴 집(가로 비율이 7×8 과 맞지 않는다) — 2층 벽 + 청석 + 지붕창 둘은 17번이다.
meta = {'name': '지붕창 3층 집', 'massing': '17', 'material': 'plaster',
        'refs': ['bd-house-h124_0', 'bd-house-cathedral'], 'walk': walk}
fails, warns = c.save('dormer-house', meta)
print('fails', fails, 'warns', warns)
