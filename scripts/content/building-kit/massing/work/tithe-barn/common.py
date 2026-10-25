"""손 도트 마감 도우미(cottage·inn 공용 사본). 난수·잡음 없음 — 변화는 손으로 쓴 표(VAR 문자열)와 좌표로만."""
import os
import sys

REPO = __import__('os').path.abspath(__file__).rsplit('/scripts/content/building-kit/', 1)[0]
sys.path.insert(0, os.path.join(REPO, 'src/harnesses/building-kit'))
from massing_lib import Canvas  # noqa: E402,F401

# ---------------------------------------------------------------- 기와
# 띠(위 → 아래 처마로 갈수록 어둡다): (윗빛, 몸, 아랫그늘, 낱장 사이 틈)
ROOF_BANDS = [  # (윗빛, 빛 받는 왼쪽, 가운데, 오른쪽 골 그늘) — 버들항식 둥근 기와(왼쪽이 빛을 받는다)
    ('ρ', 'ρ', '<', '$'),
    ('ρ', 'π', '<', '$'),
    ('ρ', 'π', '?', '@'),
    ('π', 'π', '?', '@'),
    ('π', 'π', '=', '@'),
    ('ν', 'π', '=', '!'),
    ('ν', 'ν', '+', '!'),
    ('ν', 'λ', '+', '9'),
    ('λ', 'λ', '&', '9'),
]
LIGHTER = {'<': 'π', '?': 'π', '=': '?', '+': '=', '&': '+', 'π': 'ρ', 'ρ': 'L', 'ν': 'π', 'λ': 'ν',
           '$': '@', '@': '?', '!': '=', '9': '&', '6': '9', 'L': 'L'}
DARKER = {'π': '<', 'ρ': 'π', '<': '$', '?': '@', '=': '!', '+': '!', '&': '9', 'L': 'ρ', 'ν': '+', 'λ': '&',
          '$': '9', '@': '!', '!': '9', '9': '6'}

# 낱장 변화표(손으로 씀): 0 보통 · 1 밝은 새 기와 · 2 어두운 묵은 기와 · 3 이끼 · 4 이 빠진 기와(그늘이 길다) · 5 아주 밝은 반짝
VAR = [
    '0010002000010000200001000400',
    '2000100000000010002000100000',
    '0001000200100000000010020010',
    '0400002000001000010000200000',
    '1000000100002000100400000200',
    '0020000010000002000010001000',
    '0000120000040010000200000000',
    '0001000020000100120000040001',
    '0200004000100020000000100020',
    '0010020000000001000020000100',
    '0000100002000040010000102000',
    '1020000001000200000000010004',
    '0000001000002000100002000000',
    '2000040001000000000100200001',
]


def tile_px(u, r, w, h, band, v):
    """둥근 기와 한 장(u 가로, r 세로). 왼쪽이 빛, 오른쪽 끝이 골 그늘, 맨 아래 줄은 겹침.
    변화는 은근하게: 1 은 몸만 한 단 밝게, 2 는 몸만 한 단 어둡게(윗빛·골은 그대로), 4 는 이 빠짐."""
    hi, lt, md, dk = band
    if v == '1':
        md = LIGHTER[md]
    elif v == '2':
        lt, md = md, DARKER[md]
    elif v == '5':
        hi = 'L'
    if r == h - 1:
        return dk if u == w - 1 else md
    if v == '4' and r == h - 2:
        return dk if u else md
    if u == w - 1:
        return dk
    if u == 0:
        return hi if r == 0 else lt
    if u == 1:
        return lt if r < h - 2 or v != '2' else md
    return md


# 줄마다 엇갈림(손으로 쓴 순서 — 반 장 교대가 아니다)
COURSE_OFF = [0, 2, 1, 3, 2, 0, 3, 1, 0, 2, 3, 1, 2, 0, 1, 3, 2, 1, 0, 3]


def roof(c, inside, x0, x1, y0, y1, bands=ROOF_BANDS, tw=4, th=3, var=VAR, vshift=0, hshift=0):
    """inside(x,y) 가 참인 화소에 기와를 깐다. 줄은 th 화소 높이, 낱장 tw 너비, 줄마다 COURSE_OFF 만큼 어긋난다.
    낱장 변화는 VAR 표를 줄마다 다른 자리(줄 번호×7)에서 읽어 16px 격자로 되풀이되지 않게."""
    n = (y1 - y0 + 1 + th - 1) // th
    for y in range(y0, y1 + 1):
        k = (y - y0) // th
        r = (y - y0) % th
        b = bands[min(len(bands) - 1, k * len(bands) // max(1, n))]
        off = COURSE_OFF[(k + vshift) % len(COURSE_OFF)] + hshift
        row = var[(k * 3 + vshift) % len(var)]
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            t = (x + off) // tw
            u = (x + off) % tw
            v = row[(t + k * 7 + vshift) % len(row)]
            c.put(x, y, tile_px(u, r, tw, th, b, v))


# 옆 모임 사면(빛 받는 왼쪽 · 그늘 오른쪽) — 낱장이 옆으로 누워 길게 보인다
HIP_LIT = [('L', 'ρ', '#', '?'), ('ρ', 'ρ', '#', '?'), ('L', 'ρ', '?', '#')]
HIP_DARK = [('θ', '%', '9', '9'), ('θ', '%', '9', '%'), ('%', '9', '7', '9')]


def hip_side(c, inside, x0, x1, y0, y1, bands, tw=6, th=3, hshift=0):
    for y in range(y0, y1 + 1):
        k = (y - y0) // th
        r = (y - y0) % th
        b = bands[k % len(bands)]
        off = (k % 2) * (tw // 2) + hshift
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            u = (x + off) % tw
            lt, body, sh, gap = b
            if r == th - 1:
                ch = sh
            elif u == tw - 1:
                ch = gap
            elif r == 0 and u < tw - 3:
                ch = lt
            else:
                ch = body
            c.put(x, y, ch)


# ---------------------------------------------------------------- 회벽
PLASTER_DOTS = [  # 손 점묘 motif(17×13) — 버들항처럼 촘촘하게(y·z·1·2)
    '..y......1....y..',
    '......z.......2..',
    '.1.....y..y......',
    '....2.......1...z',
    'y.........y......',
    '...y..1......y...',
    '.......z...2.....',
    '.z..y.......y..1.',
    '.....1...y.......',
    '..2.......z...y..',
    'y.....y.......1..',
    '....z....1.y.....',
    '.1........y...2..',
]


def plaster(c, x0, y0, w, h, ox=0, oy=0, base='3'):
    for j in range(h):
        for i in range(w):
            m = PLASTER_DOTS[(j + oy) % len(PLASTER_DOTS)]
            ch = m[(i + ox) % len(m)]
            c.put(x0 + i, y0 + j, base if ch == '.' else ch)


def eave_shadow(c, x0, y0, w, rows=('|', '-', 'c', 'f', 'l')):
    """처마 밑 그늘 띠: 짙은 그늘 → 회벽으로 풀린다."""
    for j, ch in enumerate(rows):
        for i in range(w):
            col = ch
            if ch in 'cfl' and (i * 7 + j * 3) % 11 == 0:
                col = {'c': 'Y', 'f': 'c', 'l': 'h'}[ch]
            c.put(x0 + i, y0 + j, col)


# ---------------------------------------------------------------- 목재
def post(c, x, y0, y1, w=3):
    for y in range(y0, y1 + 1):
        c.put(x, y, 'η' if w >= 3 else 'ε')
        for i in range(1, w - 1):
            c.put(x + i, y, 'ε')
        c.put(x + w - 1, y, 'β')
    # 결 — 손 위치의 짙은 결 몇 점
    for k, y in enumerate(range(y0 + 3, y1, 7)):
        c.put(x + 1, y, 'δ' if k % 2 else 'ζ')


def beam(c, x0, x1, y, h=2):
    for i in range(x0, x1 + 1):
        c.put(i, y, 'η' if (i % 9) else 'ζ')
        for j in range(1, h):
            c.put(i, y + j, 'ε')
    for i in range(x0, x1 + 1):
        c.put(i, y + h, '-')


def brace(c, x0, y0, x1, y1):
    """사선 가새(2화소 굵기)."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for s in range(n + 1):
        x = round(x0 + (x1 - x0) * s / n)
        y = round(y0 + (y1 - y0) * s / n)
        c.put(x, y, 'ε')
        c.put(x + 1, y, 'β')


# ---------------------------------------------------------------- 창·문
WIN_LOOKS = [  # 창마다 다르게(⑰): (꽃 무늬, 커튼 색, 반짝 자리, 창턱 여분)
    ('κMKMκNκMLMκ', None, ((1, 1), (2, 1), (1, 2)), 1),
    ('NLMNOMLNOMN', '+', ((2, 1), (3, 1)), 2),
    ('KMκOMKNMκOK', None, ((1, 1), (1, 2), (2, 2)), 0),
    ('κκMNκLMκκNM', '?', ((3, 1), (2, 2)), 1),
    ('LNMOLMNOLMN', 'G', ((1, 1), (2, 1)), 2),
    ('MκNMKMκOMNκ', None, ((2, 1), (1, 3)), 0),
]


def window(c, x, y, w=10, h=13, box=True, shutters=False, look=0):
    """나무 틀 + 십자 살 + 유리(위 밝고 아래 어둡다) + 창턱 + 꽃상자. look 으로 창마다 커튼·꽃·반짝·창턱을 바꾼다."""
    flowers, curtain, glints, sill = WIN_LOOKS[look % len(WIN_LOOKS)]
    for j in range(h):
        for i in range(w):
            edge = i in (0, w - 1) or j in (0, h - 1)
            c.put(x + i, y + j, ('η' if (i == 0 or j == 0) else 'β') if edge else 'A')
    mid = w // 2
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            if i == mid or j == h // 2:
                ch = 'ε'
            else:
                ch = 'E' if j < 2 else ('D' if j < 4 else ('B' if j > h - 4 else 'D'))
                if curtain and (i in (1, w - 2)) and j > 1:
                    ch = curtain
            c.put(x + i, y + j, ch)
    for (gx, gy) in glints:
        c.put(x + gx, y + gy, '^' if gy > 1 else 'H')
        c.put(x + mid + gx, y + h // 2 + gy, 'F')
    for i in range(-1 - sill, w + 1 + sill):
        c.put(x + i, y + h, 'm' if i < w // 2 else 'h')
        c.put(x + i, y + h + 1, 'Y')
    if box:
        for i in range(w):
            c.put(x + i, y + h - 1, flowers[i % len(flowers)])
        for i in range(-1, w + 1):
            c.put(x + i, y + h, 'η')
            c.put(x + i, y + h + 1, 'δ' if (i + look) % 3 else 'ζ')
            c.put(x + i, y + h + 2, '-')
        c.put(x + 1 + look % 3, y + h - 2, 'N')
        c.put(x + w - 3 - look % 2, y + h - 2, 'O')
    if shutters:
        for j in range(h):
            for side, xx in ((0, x - 4), (1, x + w)):
                for i in range(4):
                    ch = 'ε' if (j % 3) else 'δ'
                    if i == 3 and side == 0 or i == 0 and side == 1:
                        ch = '_'
                    if i == 0 and side == 0:
                        ch = 'η'
                    c.put(xx + i, y + j, ch)


def door(c, x, y, w, h, frame='stone'):
    """아치 문(널빤지 + 징 + 쇠띠 + 손잡이). (x,y) 는 아치 꼭대기 왼쪽 위."""
    arch = max(2, w // 3)
    for j in range(h):
        # 아치: 위 몇 줄은 양옆을 깎는다
        cut = 0
        if j < arch:
            cut = [3, 2, 1, 1, 0, 0][j] if j < 6 else 0
        for i in range(w):
            if i < cut or i >= w - cut:
                continue
            ch = 'ε'
            if i in (cut, ) or j == 0:
                ch = '_'
            elif i == w - cut - 1:
                ch = '_'
            elif (i - 1) % 4 == 3:
                ch = '-'
            elif (i - 1) % 4 == 2:
                ch = 'β'
            elif (i - 1) % 4 == 0:
                ch = 'η' if j < h // 2 else 'ε'
            c.put(x + i, y + j, ch)
    # 쇠띠 두 줄 + 징
    for yy in (y + 6, y + h - 7):
        for i in range(1, w - 1):
            c.put(x + i, yy, 'X' if i % 2 else 'W')
        for i in range(2, w - 2, 3):
            c.put(x + i, yy, 'k')
    for yy in (y + 11, y + 15):
        for i in range(3, w - 3, 4):
            c.put(x + i, yy, 'i')
    # 손잡이
    c.put(x + w - 4, y + h // 2 + 1, 'K')
    c.put(x + w - 4, y + h // 2 + 2, 'τ')
    # 문지방
    for i in range(w):
        c.put(x + i, y + h - 1, 'i' if i % 3 else 'm')


# ---------------------------------------------------------------- 막돌(버들항식: 2~4px 작은 돌, 면은 평평, 짙은 보라 줄눈)
STONE_FACES = 'vvpvwvxvvpwvvxvpvwvvxpvw'
STONE_WIDTHS = [3, 5, 2, 4, 6, 3, 4, 5, 2, 3, 6, 4, 3, 5, 4, 2, 5, 3, 6, 4, 3, 2]
LIGHT = {'v': 'x', 'w': 'z', 'x': 'p', 'p': 'p', 'u': 'w', 'g': 'j', 'f': 'h', 'h': 'j', 'e': 'h', 'd': 'e'}
SHADE = {'v': 't', 'w': 'v', 'x': 'v', 'p': 'w', 'u': 't', 'g': 'e', 'f': 'c', 'h': 'e', 'j': 'h', 'e': 'd'}


def rubble(c, x0, y0, w, h, courses, skip=None, start=0, mortar=('J', 'C'), faces=None, widths=None):
    """작은 막돌: 돌 면은 한 색(베개 명암 없음) — 몇 돌만 왼쪽 위 1화소 반짝. 줄눈은 오른쪽·아래 1화소.
    faces/widths 를 층마다 다르게 주면 무늬가 층마다 달라진다."""
    skip = skip or (lambda x, y: False)
    faces = faces or STONE_FACES
    widths = widths or STONE_WIDTHS
    mj, mc = mortar
    y = y0
    n = start
    k = 0
    while y < y0 + h:
        ch_h = min(courses[k % len(courses)], y0 + h - y)
        x = x0 - (k * 3) % 5
        wi = (k * 7 + start) % len(widths)
        while x < x0 + w:
            sw = widths[wi % len(widths)]
            wi += 1
            face = faces[n % len(faces)]
            n += 1
            glint = (n % 3 == 0)
            for j in range(ch_h):
                for i in range(sw):
                    px, py = x + i, y + j
                    if px < x0 or px >= x0 + w or skip(px, py):
                        continue
                    if j == ch_h - 1 and i == sw - 1:
                        col = mc
                    elif j == ch_h - 1 or i == sw - 1:
                        col = mj
                    elif glint and j == 0 and i == 0:
                        col = LIGHT.get(face, face)
                    elif (n % 4 == 1) and j == ch_h - 2 and i == sw - 2 and ch_h >= 3:
                        col = SHADE.get(face, face)
                    else:
                        col = face
                    c.put(px, py, col)
            x += sw
        y += ch_h
        k += 1


# ---------------------------------------------------------------- 붙임채 지붕(남쪽으로 내려가는 외쪽 + 오른쪽 모임 끝)
def wing_roof(c, x0, x1, ytop, yeave, run, bands, vshift=0):
    """x0 은 본채 벽에 맞댄다. 위 용마루(가로) → 앞 처마(가로), 기와 줄은 가로. 오른쪽 끝은 모임 사선으로 닫는다:
    모임 선 (x1-run, ytop) → (x1-1, yeave), 바깥 윤곽은 가파르게 떨어져 중간에 x1 세로선에 닿는다."""
    rr = x1 - run
    knee = ytop + int((yeave - ytop) * 0.72)

    def hx(y):
        return rr + (y - ytop) * (x1 - 1 - rr) / (yeave - ytop)

    def ox(y):
        return min(float(x1), rr + 3 + (y - ytop) * (x1 - rr - 3) / max(1, knee - ytop))

    roof(c, lambda x, y: x0 <= x < hx(y) - 1, x0, x1, ytop + 2, yeave, bands=bands, vshift=vshift)
    hip_side(c, lambda x, y: hx(y) - 1 <= x <= ox(y) + 0.5, x0, x1, ytop + 1, yeave, HIP_DARK, hshift=1)
    for y in range(ytop + 1, yeave + 1):
        xr = int(round(hx(y)))
        c.put(xr - 1, y, '_')
        c.put(xr, y, '_')
        if xr + 1 <= x1:
            c.put(xr + 1, y, 'θ' if y % 3 else '%')
        xo = int(round(ox(y)))
        c.put(xo, y, '-' if y % 3 else '9')
    for x in range(x0, rr + 4):
        c.put(x, ytop, 'ζ' if x == rr + 3 else ('σ' if x % 4 else 'ξ'))
        c.put(x, ytop + 1, '-' if x % 4 else 'α')
    for x in range(x0, x1 + 1):
        c.put(x, yeave + 1, '&' if x % 4 else '9')
        c.put(x, yeave + 2, '7' if x % 4 == 1 else ('6' if x % 4 == 3 else '%'))
    c.put(x1, yeave + 1, '9')
    c.put(x1, yeave + 2, '-')


def walk_from(c, roof_rows, door_cell, door_rows=1):
    """walk 자동: 그림 있는 칸 = 위 roof_rows 줄은 *, 아래는 X. 문 칸 D(아래에서 door_rows 칸)."""
    cw, chh = c.w // 16, c.h // 16
    out = []
    for cy in range(chh):
        row = ''
        for cx in range(cw):
            op = any(c.g[y][x] != '.' for y in range(cy * 16, cy * 16 + 16) for x in range(cx * 16, cx * 16 + 16))
            row += ('*' if cy < roof_rows else 'X') if op else '.'
        out.append(row)
    for k in range(door_rows):
        cy = chh - 1 - k
        out[cy] = out[cy][:door_cell] + 'D' + out[cy][door_cell + 1:]
    return out


# ---------------------------------------------------------------- 굴뚝(막돌, 위에서 본 머리, 지붕 경사를 따른 밑동)
CHIM_STONES = [  # 손 막돌 — 크기 다른 돌이 엇물린다(격자 아님)
    'jhhVhjjhV', 'heeVeedeV', 'VVVhjVVVh', 'hjjheVjhe', 'eedeeVedd', 'VVVVdhjVV',
    'jhVhhjeVj', 'edVeeddVe', 'VjhhVVVhh', 'hheeVjhee', 'eddeVeddV', 'VVVjhVVjh',
]


def chimney(c, cx, top, base, cw=8, start=0, slope=1):
    """막돌 굴뚝. 머리: 0 바깥 테 · 1 갓돌 고리 + 어두운 연기 구멍 · 2 앞 갓돌 턱 · 3 갓돌 밑 그늘.
    몸: 손 막돌 무늬(start 로 굴뚝마다 다른 줄에서 시작). 밑동: 가로 띠 없이, 지붕에 묻히는 아랫선이
    slope(1=왼쪽이 높다, -1=오른쪽이 높다) 따라 비스듬히 — 지붕 기와가 아랫단을 덮는다."""
    for i in range(cw):
        x = cx + i
        bot = base + (i * 2 // cw if slope > 0 else (cw - 1 - i) * 2 // cw)
        for y in range(top, bot + 1):
            yy = y - top
            if yy == 0:
                ch = 'i' if 0 < i < cw - 1 else 'X'
            elif yy == 1:
                ch = 'k' if i == 0 else ('d' if i == cw - 1 else ('U' if i == 1 or i == cw - 2 else 'T'))
            elif yy == 2:
                ch = 'k' if i == 0 else ('Z' if i == cw - 1 else 'r')
            elif yy == 3:
                ch = 'Y' if i == 0 else ('U' if i == cw - 1 else 'X')
            elif i == 0:
                ch = 'X'
            elif i == cw - 1:
                ch = 'U'
            elif i == 1:
                ch = 'h' if (y + start) % 3 else 'j'
            else:
                row = CHIM_STONES[(yy - 4 + start) % len(CHIM_STONES)]
                ch = row[(i - 2 + start) % len(row)]
            if y == bot and 0 < i < cw - 1:
                ch = 'd' if ch not in 'V' else 'V'
            c.put(x, y, ch)
    # 지붕에 지는 그늘: 오른쪽 2화소 + 밑동 바로 아래 1줄(기와를 한 단 어둡게)
    DK = {'L': 'ρ', 'ρ': 'π', 'π': '<', '<': '$', '?': '@', '=': '!', '+': '!', '&': '9', 'ν': '+', 'λ': '&',
          '$': '9', '@': '!', '!': '9', '9': '6', 'σ': 'ξ', 'ξ': 'η', 'ζ': '-', '-': '-', '#': '!', '%': '7',
          'θ': '%'}
    for y in range(top + 4, base + 4):
        for x in (cx + cw, cx + cw + 1):
            g = c.get(x, y)
            if g in DK:
                c.put(x, y, DK[g])
    for i in range(cw + 1):
        bot = base + (i * 2 // cw if slope > 0 else (cw - 1 - min(i, cw - 1)) * 2 // cw)
        g = c.get(cx + i, bot + 1)
        if g in DK:
            c.put(cx + i, bot + 1, DK[g])



def moss(c, spots):
    """이끼 덩이(손 좌표): (x, y, 모양 번호). 처마 모서리·굴뚝 밑처럼 그늘지고 물 고이는 곳에만."""
    shapes = [
        ['.OP.', 'NOON', '.MN.'],
        ['OP..', 'NOOP', 'MNNO', '.MM.'],
        ['.P', 'ON', 'M.'],
    ]
    for (x, y, k) in spots:
        for j, row in enumerate(shapes[k]):
            for i, ch in enumerate(row):
                if ch != '.' and c.get(x + i, y + j) != '.':
                    c.put(x + i, y + j, ch)
