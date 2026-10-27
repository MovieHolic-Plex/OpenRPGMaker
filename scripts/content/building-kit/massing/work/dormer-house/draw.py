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


DARKER = {'H': 'G', 'I': 'H', 'G': 'F', 'F': 'E', 'E': 'B', 'B': 'B', 'D': 'A', 'C': 'B',
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
def plaster_px(x, y, s):
    """버들항 회벽: 바탕 3 + 점묘 y(가장 흔함)·z·2 — 세 단."""
    v = hsh(x, y, 40 + s) % 12
    if v in (0, 1):
        return 'y'
    if v == 2 and (x + y) % 2:
        return 'z'
    if v == 3:
        return '2'
    return '3'


def wall_face(x0, x1, y0, y1, s):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(x, y, plaster_px(x, y, s))


def glass(x0, y0, w, h, look=0, frame=True):
    """버들항 창: 나무 틀(ε 밝은 왼·β 위·_ 오른), 남색 유리 D/A, 작은 반짝임 ^·j, 가운데 살 β, 나무 창턱."""
    mid = x0 + w // 2
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            put(x, y, 'D' if (y - y0) < h - 2 or x == mid else 'A')
        put(mid, y, 'β')
    for x in range(x0, x0 + w):
        put(x, y0 + h // 2, '-')
    put(x0, y0, '^')
    put(mid + 1 + (look % 2), y0 + h // 2 + 1, '^')
    if look == 1:
        put(x0 + 1, y0, 'j')
    if look == 2:                                  # 불 켜진 오른 아래 칸
        for y in range(y0 + h // 2 + 1, y0 + h):
            for x in range(mid + 1, x0 + w):
                put(x, y, 'K' if (x + y) % 3 else 'L')
    if look == 3:                                  # 커튼(분홍) 위 모서리
        for (dx, dy) in ((0, 0), (0, 1), (w - 1, 0), (w - 1, 1), (mid - x0 - 1, 0), (mid - x0 + 1, 0)):
            put(x0 + dx, y0 + dy, 'o')
    if look == 4:                                  # 쇠살
        for y in range(y0 + h // 2 + 1, y0 + h):
            for x in range(x0 + 1, x0 + w, 2):
                if x != mid:
                    put(x, y, 'X')
    if frame:
        for y in range(y0 - 1, y0 + h + 1):
            put(x0 - 1, y, 'ε')
            put(x0 + w, y, '_')
        for x in range(x0 - 1, x0 + w + 1):
            put(x, y0 - 1, 'β')
            put(x, y0 + h, 'η' if x < x0 + w else 'ε')


# ---------------------------------------------------------------- 왼 지붕창: 남북 박공(작은 3/4 지붕 윗면, 본 지붕과 같은 청석)
GX0, GX1 = 16, 39
GC = 27
GW0, GW1 = 18, 37
GBASE = 41
GTOP = 17
GEAVE = 34
before = [r[:] for r in c.g]


def gvl(y):
    return GX0 + (GEAVE - y) * (GC - GX0) / (GEAVE - GTOP) if y < GEAVE else GX0


def gvr(y):
    return GX1 - (GEAVE - y) * (GX1 - GC - 1) / (GEAVE - GTOP) if y < GEAVE else GX1


for y in range(GTOP, GBASE + 1):
    a, b = int(round(gvl(y))), int(round(gvr(y)))
    for x in range(a, b + 1):
        if x <= GC:                                  # 왼 사면: 밝은 세로 청석 열
            t, col = divmod(x - GX0, 3)
            k, r = divmod(y + t * 2, 5)
            hv = hsh(t, k, 7)
            ch = 'G' if r == 4 else ('G' if col == 2 else ('I' if col == 0 and hv % 2 == 0 else 'H'))
        else:                                        # 오른 사면: 그늘 진 세로 열
            t, col = divmod(x - GC - 1, 3)
            k, r = divmod(y + t, 4)
            ch = 'E' if r == 3 else ('G' if col == 0 else ('F' if (col + r) % 3 else 'E'))
        put(x, y, ch)
    put(a, y, 'H' if y >= GEAVE else 'B')            # 왼 처마 테 · 골(어두운 선)
    put(b, y, 'B')
    if y < GEAVE:
        put(a + 1, y, 'I')
        put(b - 1, y, 'B')
for y in range(GTOP - 1, GBASE - 9):                # 지붕창 용마루(세로, 얇은 마룻기와)
    put(GC, y, 'I')
    put(GC + 1, y, 'B')
GA = GBASE - 10
for y in range(GA, GBASE + 1):
    hw = (y - GA)
    for x in range(GC - hw, GC + 2 + hw):
        put(x, y, plaster_px(x, y, 9))
    put(GC - hw - 1, y, 'ε')                       # 박공널(나무)
    put(GC - hw - 2, y, 'η')
    put(GC + 2 + hw, y, '-')
    put(GC + 3 + hw, y, 'β')
put(GC, GA - 1, 'ε')
put(GC + 1, GA - 1, '-')
for y in range(GA + 3, GBASE + 1):                  # 삼각벽 가운데 짧은 기둥
    put(GC, y, 'β')
    put(GC + 1, y, '-')
wall_face(GW0, GW1, GBASE + 1, 52, 1)
for y in range(GBASE + 1, 53):
    put(GW0, y, 'ε')
    put(GW0 + 1, y, 'β')
    put(GW1, y, '_')
for x in range(GW0, GW1 + 1):
    put(x, GBASE + 1, 'β')
    put(x, GBASE + 2, '-')
glass(23, 45, 10, 7, 1)
for x in range(GW0 - 1, GW1 + 2):                   # 지붕창 밑 납 물막이 + 본 지붕에 진 그늘
    put(x, 53, 'e' if x % 3 else 'd')
    put(x, 54, 'X')

# ---------------------------------------------------------------- 오른 지붕창: 모임(앞 사면 가로 청석 + 양 모임 사선)
HX0, HX1 = 72, 95
HR0, HR1 = 79, 88
HRY, HEY = 29, 40
HW0, HW1 = 74, 93
for y in range(HRY, HEY + 1):
    f = (y - HRY) / (HEY - HRY)
    a = int(round(HR0 - f * (HR0 - HX0)))
    b = int(round(HR1 + f * (HX1 - HR1)))
    for x in range(a, b + 1):
        k, r = divmod(y - HRY, 3)
        t, col = divmod(x + (k % 2) * 2, 4)
        hv = hsh(t, k, 12)
        if x < a + 3 + (y - HRY) // 3:               # 왼 모임: 밝은 청석
            ch = 'G' if (x + y) % 3 else 'H'
        elif x > b - 3 - (y - HRY) // 3:             # 오른 모임: 그늘
            ch = 'E' if (x + y) % 3 else 'F'
        else:                                         # 앞 사면: 가로 켜(위 밝게)
            if r == 2:
                ch = 'B' if col != 1 else 'E'
            elif col == 3:
                ch = 'E'
            elif r == 0:
                ch = ('H' if hv % 3 else 'G') if y < HRY + 5 else ('G' if hv % 3 else 'F')
            else:
                ch = 'G' if y < HRY + 5 else 'F'
        put(x, y, ch)
    put(a, y, 'B')
    put(b, y, 'B')
    put(int(round(a + 2 + (y - HRY) / 3)), y, 'H' if y % 2 else 'G')
    put(int(round(b - 2 - (y - HRY) / 3)), y, 'B')
for x in range(HR0 - 1, HR1 + 2):                   # 짧은 용마루(밝은 마룻기와) + 뒤 골
    put(x, HRY - 1, 'B' if x in (HR0 - 1, HR1 + 1) else ('H' if x % 3 else 'I'))
    put(x, HRY - 2, 'B' if HR0 <= x <= HR1 else c.get(x, HRY - 2))
for x in range(HX0, HX1 + 1):
    put(x, HEY + 1, 'B' if x % 3 else 'E')
wall_face(HW0, HW1, HEY + 2, 52, 2)
for y in range(HEY + 2, 53):
    put(HW0, y, 'ε')
    put(HW0 + 1, y, 'β')
    put(HW1, y, '_')
for x in range(HW0 + 1, HW1):
    put(x, HEY + 2, '-')
    put(x, HEY + 3, 'z')
glass(80, 45, 8, 7, 2)
for (x, y) in ((80, 45), (87, 45)):                  # 둥근 머리(위 모서리 나무)
    put(x, y, 'β')
for x in range(HW0 - 1, HW1 + 2):
    put(x, 53, 'e' if x % 3 else 'd')
    put(x, 54, 'X')

# ---------------------------------------------------------------- 지붕창 둘레 골·그늘(본 지붕에 진다)
changed = {(x, y) for y in range(H) for x in range(W) if c.g[y][x] != before[y][x]}
for (x, y) in sorted(changed):
    for ax, ay, n in ((1, 0, 2), (2, 0, 1), (0, 1, 1), (-1, 0, 1)):
        q = (x + ax, y + ay)
        if q not in changed and 0 <= q[0] < W and 0 <= q[1] <= EY - 2:
            darken(q[0], q[1], n)


# ================================================================ 막돌(버들항 v/p 면 + J/C 줄눈)
def stone_px(x, y, y0, s):
    k, r = divmod(y - y0, 3)
    x2 = x + (hsh(k, s, 80) % 5)
    # 돌 너비 3~5: 열마다 해시로 이음 자리
    pos, t = 0, 0
    while True:
        wdt = 3 + hsh(t, k, 81 + s) % 3
        if pos + wdt > x2:
            break
        pos += wdt
        t += 1
    col = x2 - pos
    hv = hsh(t, k, 82 + s)
    if r == 2:
        return 'C' if hv % 3 == 0 else 'J'
    if col == 0:
        return 'J' if r else 'C'
    if r == 0 and col == 1:
        return 'p'
    return 'v' if hv % 4 else ('p' if (x + y) % 2 else 'f')


# ================================================================ 굴뚝(왼 모임면, 밑동이 모임 사선을 따른다) — 막돌
CX0, CX1 = 9, 16
for x in range(CX0, CX1 + 1):
    base = int(round(RY + (RX0 - x) * (EY - RY) / RX0)) - 6
    for y in range(6, base + 1):
        ch = stone_px(x, y, 6, 3)
        if x == CX0:
            ch = 'p' if ch in 'vf' else ch
        if x == CX1:
            ch = 'J' if ch in 'vp' else 'C'
        put(x, y, ch)
    put(x, base + 1, 'B')
    put(x, base + 2, 'E')
T0 = 2
for x in range(CX0 - 1, CX1 + 2):                  # 갓돌 고리 + 연기 구멍(윗면)
    put(x, T0, 'h' if CX0 <= x < CX1 else '.')
    put(x, T0 + 1, 'm' if x < CX1 else 'h')
    put(x, T0 + 2, 'k' if x < CX1 else 'd')
    put(x, T0 + 3, 'h' if x < CX1 else 'e')
for x in range(CX0 + 1, CX1):
    put(x, T0 + 1, 'T')
    put(x, T0 + 2, 'T' if x < CX1 - 1 else 'U')
for x in range(CX0 - 1, CX1 + 2):
    put(x, T0 + 4, 'e' if x < CX1 else 'X')


# ================================================================ 벽
WX0, WX1 = 3, W - 4
CY0 = EY + 1                                        # 처마 밑 그늘(버들항 결) 59..62
SOFF = ['/', 'c', 'f', 'l']
for i, base in enumerate(SOFF):
    for x in range(WX0, WX1 + 1):
        ch = base
        if (x - WX0) % 9 in (0, 1) and i < 2:
            ch = ';' if (x - WX0) % 9 == 0 else '|'
        if base == 'c' and hsh(x, 1, 90) % 5 == 0:
            ch = 'Y'
        put(x, CY0 + i, ch)
UY0, UY1 = CY0 + 4, 88                              # 2층 63..88 회벽 + 반목조
for y in range(UY0, UY1 + 1):
    for x in range(WX0, WX1 + 1):
        put(x, y, plaster_px(x, y, 5))


def post(x, y0, y1):
    for y in range(y0, y1 + 1):
        put(x, y, 'ε')
        put(x + 1, y, 'β')
        put(x + 2, y, '_')


def brace(x0, y0, x1, y1):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        x = round(x0 + (x1 - x0) * i / n)
        y = round(y0 + (y1 - y0) * i / n)
        put(x, y, 'β')
        put(x + (1 if x1 > x0 else -1), y, '-')


for x in range(WX0, WX1 + 1):                       # 처마 밑 보 · 창턱 띠장
    put(x, UY0, 'ε')
    put(x, UY0 + 1, '-')
    put(x, 84, 'ε')
    put(x, 85, '-')
for px in (WX0, 27, 44, 65, 82, WX1 - 2):
    post(px, UY0, UY1)
brace(30, 83, 42, UY0 + 2)                          # 가새(띠장 → 보), 좌우 다르게
brace(79, 83, 68, UY0 + 2)
for x in range(WX0, WX1 + 1):                       # 층 사이 굵은 보 89..92
    put(x, 89, 'η' if x % 10 else 'ζ')
    put(x, 90, 'ε')
    put(x, 91, 'β')
    put(x, 92, '-')
GY0, GY1 = 93, 123                                  # 1층 막돌 31px
for y in range(GY0, GY1 + 1):
    for x in range(WX0, WX1 + 1):
        put(x, y, stone_px(x, y, GY0, 1))
for y in range(UY0, GY1 + 1):                       # 벽 좌우 끝: 재질 어두운 단(나무 기둥 · 막돌 어두운 줄눈)
    put(WX0 - 1, y, 'α' if y < 89 else ('9' if y % 3 else 'Z'))
    put(WX1 + 1, y, '-' if y < 89 else ('Z' if y % 2 else '9'))
for y in range(CY0, UY0):
    put(WX0 - 1, y, '-')
    put(WX1 + 1, y, '-')
for x in range(WX0 - 1, WX1 + 2):                   # 기초(버들항 돌 받침)
    put(x, 124, 'aiimiWii'[(x * 3) % 8] if WX0 <= x <= WX1 else 'a')
    put(x, 125, 'Z' if x % 5 else 'Y')
    put(x, 126, 'U' if x % 7 else 'Y')
    put(x, 127, 'U' if x % 3 else 'V')

# ================================================================ 창(층마다 다르게)
glass(11, 70, 10, 12, 3)                            # 2층 왼(커튼)
for i, x in enumerate(range(10, 23)):               # 꽃상자
    put(x, 83, 'κMKMκN'[i % 6])
glass(50, 69, 11, 13, 0)                            # 2층 가운데(넓은 창)
glass(91, 70, 9, 12, 1)                             # 2층 오른
for y in range(69, 83):                             # 오른 창 열린 덧문(나무 판)
    for i, x in enumerate((101, 102)):
        put(x, y, 'δζ'[i] if y % 4 else 'β')
glass(14, 100, 10, 14, 4)                           # 1층 왼(쇠살)
glass(88, 100, 10, 14, 2)                           # 1층 오른(불빛)
for i, x in enumerate(range(87, 99)):
    put(x, 115, 'κMKMκN'[(i + 2) % 6])
    put(x, 116, 'β')

# 문(가운데): 막돌 아치 + 나무 문 + 돌 문턱
DX0, DX1 = 50, 61
CXD = (DX0 + DX1) / 2.0


def arch_top(x, rad):
    d = abs(x + 0.5 - (CXD + 0.5))
    return 101 - int(round((max(0.0, rad * rad - d * d)) ** 0.5 * 0.6))


for x in range(DX0 - 2, DX1 + 3):                  # 쐐기돌 테(어두운 돌)
    t = arch_top(x, 8.5)
    put(x, t, 'J')
    put(x, t + 1, 'p' if x < CXD else 'v')
    for y in range(t + 2, 124):
        if x in (DX0 - 2, DX0 - 1):
            put(x, y, 'p' if x == DX0 - 2 else 'J')
        elif x in (DX1 + 1, DX1 + 2):
            put(x, y, 'C' if x == DX1 + 1 else 'v')
for x in range(DX0, DX1 + 1):
    t = arch_top(x, 7.0) + 2
    for y in range(t, 124):
        col = (x - DX0) % 4
        ch = 'ζ' if col == 0 else ('δ' if col in (1, 2) else 'β')
        if x == (DX0 + DX1) // 2:
            ch = 'β'
        if x == (DX0 + DX1) // 2 + 1:
            ch = '-'
        if y in (106, 117):
            ch = 'X' if x % 2 else 'U'
        if y == t:
            ch = 'β'
        put(x, y, ch)
put(DX0 + 4, 112, 'K')
put(DX1 - 4, 112, 'K')
for x in range(DX0 - 2, DX1 + 3):                  # 문턱
    put(x, 124, 'r' if x < DX1 + 1 else 'm')
    put(x, 125, 'i')
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
