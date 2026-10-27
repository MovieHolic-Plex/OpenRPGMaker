"""손 도트 마감 도우미(cottage·inn 공용 사본). 난수·잡음 없음 — 변화는 손으로 쓴 표(VAR 문자열)와 좌표로만."""
import os
import sys

REPO = __import__('os').path.abspath(__file__).rsplit('/scripts/content/building-kit/', 1)[0]
sys.path.insert(0, os.path.join(REPO, 'src/harnesses/building-kit'))
from massing_lib import Canvas  # noqa: E402,F401

# ---------------------------------------------------------------- 기와
# 띠(위 → 아래 처마로 갈수록 어둡다): (윗빛, 몸, 아랫그늘, 낱장 사이 틈)
ROOF_BANDS = [  # (윗빛, 빛 받는 왼쪽, 가운데, 오른쪽 골 그늘) — 버들항식 둥근 기와(왼쪽이 빛을 받는다)
    ('L', 'ρ', '<', '$'),
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
    """둥근 기와 한 장 안 화소(u 가로, r 세로). 왼쪽이 빛, 오른쪽 끝이 골 그늘, 맨 아래 줄은 다음 줄에 덮인 겹침."""
    hi, lt, md, dk = band
    if v == '1':
        hi, lt, md = LIGHTER[hi], LIGHTER[lt], LIGHTER[md]
    elif v == '2':
        hi, lt, md, dk = lt, md, DARKER[md], DARKER[dk]
    elif v == '5':
        hi, lt = 'L', LIGHTER[lt]
    if v == '3' and r >= h - 2 and u <= 2:
        return ('O', 'N', 'M')[u] if r == h - 2 else ('N', 'M', dk)[u]
    if r == h - 1:
        return dk if u == w - 1 else md
    if v == '4' and r == h - 2:
        return dk if u else md
    if u == w - 1:
        return dk
    if u == 0:
        return hi if r == 0 else lt
    if u == 1:
        return lt
    return md


def roof(c, inside, x0, x1, y0, y1, bands=ROOF_BANDS, tw=4, th=4, var=VAR, vshift=0, hshift=0):
    """inside(x,y) 가 참인 화소에 기와를 깐다. 줄은 th 화소 높이, 낱장 tw 너비, 줄마다 반 장 엇갈림."""
    n = (y1 - y0 + 1 + th - 1) // th
    for y in range(y0, y1 + 1):
        k = (y - y0) // th
        r = (y - y0) % th
        b = bands[min(len(bands) - 1, k * len(bands) // max(1, n))]
        off = (k % 2) * (tw // 2) + hshift
        for x in range(x0, x1 + 1):
            if not inside(x, y):
                continue
            t = (x + off) // tw
            u = (x + off) % tw
            row = var[(k + vshift) % len(var)]
            v = row[t % len(row)]
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
PLASTER_DOTS = [  # 손 점묘 motif(13×11) — y·z·1 이 회벽 3 위에 흩어진다
    '...y.........',
    '.........1...',
    '......z......',
    '.1..........y',
    '........y....',
    '...z.........',
    '...........1.',
    '.y....1......',
    '.........z...',
    '....y........',
    '..........y..',
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
def window(c, x, y, w=10, h=13, box=True, shutters=False):
    """나무 틀 + 십자 살 + 하늘 반짝임 + 창턱 + 꽃상자."""
    # 틀
    for j in range(h):
        for i in range(w):
            edge = i in (0, w - 1) or j in (0, h - 1)
            c.put(x + i, y + j, ('η' if (i == 0 or j == 0) else 'β') if edge else 'A')
    # 유리: 위는 밝은 반사, 아래로 어둡다
    mid = w // 2
    for j in range(1, h - 1):
        for i in range(1, w - 1):
            if i == mid:
                c.put(x + i, y + j, 'ε')
            elif j == h // 2:
                c.put(x + i, y + j, 'ε')
            else:
                c.put(x + i, y + j, 'D' if j < 3 else ('B' if j > h - 4 else 'A'))
    c.put(x + 1, y + 1, 'F')
    c.put(x + 2, y + 1, 'E')
    c.put(x + 1, y + 2, '^')
    c.put(x + mid + 1, y + 1, 'E')
    c.put(x + mid + 1, y + h // 2 + 1, '^')
    c.put(x + 2, y + h // 2 + 1, 'D')
    # 창턱
    for i in range(-1, w + 1):
        c.put(x + i, y + h, 'm' if i < w // 2 else 'h')
        c.put(x + i, y + h + 1, 'Y')
    if box:
        flowers = 'κMKMκNκMLMκ'
        for i in range(w):
            c.put(x + i, y + h - 1, flowers[i % len(flowers)])
        for i in range(-1, w + 1):
            c.put(x + i, y + h, 'η')
            c.put(x + i, y + h + 1, 'δ' if i % 3 else 'ζ')
            c.put(x + i, y + h + 2, '-')
        c.put(x + 1, y + h - 2, 'N')
        c.put(x + w - 3, y + h - 2, 'O')
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


# ---------------------------------------------------------------- 막돌
STONE_FACES = 'vwxvuwvgxvwuvxwvfvwxuvgw'   # 돌마다 바탕(손 순서)
STONE_WIDTHS = [6, 9, 4, 10, 7, 5, 8, 11, 5, 7, 4, 9, 6, 10, 5, 8, 7, 4, 9, 6, 11, 5]
LIGHT = {'v': 'x', 'w': 'z', 'x': 'p', 'u': 'w', 'g': 'j', 'f': 'h'}
SHADE = {'v': 't', 'w': 'u', 'x': 'v', 'u': 't', 'g': 'e', 'f': 'c'}


def rubble(c, x0, y0, w, h, courses, skip=None, start=0):
    """불규칙 막돌: courses = 줄 높이 목록(손으로), 너비는 STONE_WIDTHS 를 줄마다 다른 자리에서 읽는다."""
    skip = skip or (lambda x, y: False)
    y = y0
    n = start
    for k, ch_h in enumerate(courses):
        if y >= y0 + h:
            break
        ch_h = min(ch_h, y0 + h - y)
        x = x0 - (k * 3) % 5
        wi = (k * 7) % len(STONE_WIDTHS)
        while x < x0 + w:
            sw = STONE_WIDTHS[wi % len(STONE_WIDTHS)]
            wi += 1
            face = STONE_FACES[n % len(STONE_FACES)]
            n += 1
            for j in range(ch_h):
                for i in range(sw):
                    px, py = x + i, y + j
                    if px < x0 or px >= x0 + w or skip(px, py):
                        continue
                    if j == ch_h - 1 or i == sw - 1:
                        col = 'J'
                        if j == ch_h - 1 and i == sw - 1:
                            col = 'C'
                    elif (i == 0 and j == 0):
                        col = 'J'
                    elif j == 0 or (i == 0 and j < ch_h - 2):
                        col = LIGHT[face]
                    elif j == ch_h - 2 or i == sw - 2:
                        col = SHADE[face]
                    else:
                        col = face
                    c.put(px, py, col)
            x += sw
        y += ch_h


# ---------------------------------------------------------------- 굴뚝(앞 사면에 선다 — 지붕을 먼저 깔고 위에 그린다)
def chimney(c, cx, top, base, cw=8):
    """벽돌 굴뚝: 갓돌 3줄 + 벽돌 몸 + 밑동 함석 물막이 + 오른쪽 아래로 지붕에 지는 그늘."""
    for y in range(top, base + 1):
        for i in range(cw):
            x = cx + i
            yy = y - top
            if yy <= 3:
                # 머리 윗면(위에서 본다): 0 바깥 테 · 1 갓돌 테 + 어두운 연기 구멍 · 2 앞 갓돌 밝은 턱 · 3 갓돌 아랫면
                if yy == 0:
                    ch = 'i'
                elif yy == 1:
                    ch = 'k' if i == 0 else ('d' if i == cw - 1 else ('U' if i == 1 else 'T'))
                elif yy == 2:
                    ch = 'k' if i == 0 else ('i' if i == cw - 1 else 'r')
                else:
                    ch = 'Y' if i == 0 else ('X' if i == cw - 1 else 'Z')
            elif yy == 4:
                ch = 'U' if 1 <= i <= cw - 2 else 'X'
            else:
                k = (yy - 5) // 3
                r = (yy - 5) % 3
                u = (i + (2 if k % 2 else 0)) % 4
                ch = '@' if (r == 2 or u == 3) else ('=' if r == 1 else 'π')
                if i == 0 or i == cw - 1:
                    ch = 'C'
                elif i == 1:
                    ch = 'π' if r < 2 else '='
            c.put(x, y, ch)
    c.put(cx + 2, top + 9, '?')
    c.put(cx + 5, top + 13, '<')
    # 물막이(밑동 양옆으로 1화소 넓다)
    for i in range(-1, cw + 1):
        c.put(cx + i, base + 1, 'i' if i < cw // 2 else 'Z')
        c.put(cx + i, base + 2, 'X' if i in (-1, cw) else 'U')
    # 지붕에 지는 그늘: 오른쪽 2화소 + 밑동 아래 1줄
    DK = {'L': 'ρ', 'ρ': 'π', 'π': '<', '<': '$', '?': '@', '=': '!', '+': '!', '&': '9', 'ν': '+', 'λ': '&',
          '$': '9', '@': '!', '!': '9', '9': '6', 'σ': 'ξ', 'ξ': 'η', 'ζ': '-', '-': '-'}
    for y in range(top + 4, base + 3):
        for i in (cw + (0 if y < base + 1 else 1), cw + 1 + (0 if y < base + 1 else 1)):
            x = cx + i
            g = c.get(x, y)
            if g in DK:
                c.put(x, y, DK[g])


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
