"""manor·dormer-house·keep-tower 공용: 재질 테두리 · 창 변형 · 속 구멍 막기. 난수 없음."""

# 한 단 어둡게(재질 램프 안에서). 먹(밝기 ≤ 0.12) 글자로는 가지 않는다.
DK = {
    # 테라코타
    'L': 'σ', 'σ': 'ξ', 'ξ': 'η', 'η': 'ζ', 'ζ': 'ε', 'ε': 'δ', 'δ': 'γ', 'γ': 'α', 'α': '-', '-': '-',
    'ρ': 'π', 'π': 'ν', 'ν': 'λ', 'λ': 'θ', 'θ': 'β', 'β': '_', '_': '_', 'μ': 'θ', 'ι': 'θ', 'κ': '&',
    '<': '?', '?': '=', '=': '+', '+': '&', '&': '%', '%': '7', '7': '7', '$': '@', '@': '!', '!': '9', '9': '9',
    '#': '!', '*': '!',
    # 청석
    'I': 'H', 'H': 'G', 'G': 'F', 'F': 'E', 'E': 'C', 'C': 'C', 'B': 'C', 'D': 'E',
    # 회벽
    '5': '3', '4': '2', '3': 'z', '2': 'z', '1': 'y', '0': 'y', 'z': 'x', 'y': 'w', 'x': 'w', 'w': 'u', 'v': 'u',
    'u': 't', 't': 'c',
    # 돌·회색
    's': 'r', 'r': 'm', 'n': 'k', 'm': 'j', 'k': 'i', 'j': 'h', 'i': 'e', 'h': 'e', 'g': 'e', 'e': 'a', 'd': 'a',
    'a': 'Y', 'b': 'Y', 'Z': 'X', 'Y': 'X', 'X': 'W', 'W': 'V', 'V': 'U', 'U': 'U', 'T': 'U',
    'q': 'o', 'o': 'l', 'p': 'g', 'l': 'f', 'f': 'c', 'c': 'Y',
    # 기타
    'M': 'M', 'N': 'M', 'O': 'N', 'P': 'O', 'Q': 'P', 'R': 'Q', 'S': 'R', 'K': 'τ', 'τ': 'τ', 'J': 'J',
    '^': '>', '>': '>', 'A': 'E', '|': '-', '/': '-', ':': '-', ';': '-', ',': '-', '6': '7',
}


def darken(c, x, y, n=1):
    ch = c.get(x, y)
    if ch == '.':
        return
    for _ in range(n):
        ch = DK.get(ch, ch)
    c.put(x, y, ch)


def outline(c, n=2, skip=None):
    """투명과 맞닿은 바깥 테두리 화소를 재질 어두운 단으로(n 단). 먹 글자는 갈색·짙은 보라로 바꾼다."""
    pts = []
    for y in range(c.h):
        for x in range(c.w):
            if c.get(x, y) == '.':
                continue
            if skip and skip(x, y):
                continue
            edge = any(not (0 <= x + ax < c.w and 0 <= y + ay < c.h) or c.get(x + ax, y + ay) == '.'
                       for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                pts.append((x, y))
    for x, y in pts:
        darken(c, x, y, n)
        ch = c.get(x, y)
        if ch in ('A', '|', '/', ':', ';', ',', '6'):
            c.put(x, y, {'A': 'E', '6': '7'}.get(ch, '-'))


def fill_pinholes(c):
    """위·아래·좌·우가 모두 그림인 속 투명 화소를 이웃 색으로 막는다."""
    n = 0
    for y in range(1, c.h - 1):
        for x in range(1, c.w - 1):
            if c.get(x, y) != '.':
                continue
            nb = [c.get(x + ax, y + ay) for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1))]
            if all(v != '.' for v in nb):
                c.put(x, y, nb[1])
                n += 1
    return n


# ---------------------------------------------------------------- 창 변형
SKY = [  # 유리 위쪽 하늘 반사 모양 4가지(손으로 씀) — '.'은 그대로 둔다
    ['F^..', '^D..', 'D...'],
    ['.F^.', '..^D', '...D'],
    ['^...', 'F^..', '.^D.'],
    ['FF^.', 'D^..', '....'],
]


def window(c, x, y, w=9, h=14, kind='open', sky=0, box=False, frame='stone'):
    """덧문 세로 창. kind: open(덧문 열림) · closed(덧문 닫힘) · curtain(붉은 커튼) · lit(안 불빛) · half(한쪽 덧문 닫힘).
    sky = 반사 모양 번호. box = 꽃상자. frame: stone(밝은 돌 테) | wood."""
    fl, fr, fb = ('n', 'h', 'r') if frame == 'stone' else ('η', 'β', 'η')
    for j in range(h):
        for i in range(w):
            if i == 0:
                ch = fl
            elif i == w - 1:
                ch = fr
            elif j == 0:
                ch = fb
            elif i == w // 2:
                ch = 'e' if frame == 'stone' else 'ε'
            elif j == h // 2:
                ch = 'e' if frame == 'stone' else 'ε'
            elif j == 1:
                ch = 'E'
            else:
                ch = 'D' if j < 4 else ('A' if j < h - 3 else 'B')
                if kind == 'lit':
                    ch = 'K' if (i + j) % 4 else 'L'
                    if j > h - 4:
                        ch = 'τ'
            c.put(x + i, y + j, ch)
    if kind != 'lit':
        pat = SKY[sky % len(SKY)]
        for j, row in enumerate(pat):
            for i, ch in enumerate(row):
                if ch != '.':
                    xx, yy = x + 1 + i, y + 2 + j
                    if c.get(xx, yy) in 'DAB':
                        c.put(xx, yy, ch)
        c.put(x + w // 2 + 1, y + h // 2 + 1, '^' if sky % 2 else 'D')
    if kind == 'curtain':
        for j in range(1, h - 1):
            if j == h // 2:
                continue
            c.put(x + 1, y + j, '&' if j % 3 else '+')
            c.put(x + w - 2, y + j, '+' if j % 3 else '&')
            if j < 4:
                c.put(x + 2, y + j, '=')
                c.put(x + w - 3, y + j, '&')
    # 덧문
    def shutter(xx, closed):
        for j in range(h):
            for k in range(3):
                ch = ('η', 'ε', 'β')[k] if (j % 4) else ('ε', 'β', '_')[k]
                if j == 0:
                    ch = 'ζ'
                c.put(xx + k, y + j, ch)
    if kind in ('open', 'curtain', 'lit', 'half'):
        shutter(x - 3, False)
        if kind != 'half':
            shutter(x + w, False)
    if kind in ('closed', 'half'):
        x0 = x + 1 if kind == 'closed' else x + w // 2 + 1
        for j in range(1, h - 1):
            for i in range(x0, x + w - 1):
                k = (i - x0) % 3
                ch = ('η', 'ε', 'β')[k] if (j % 3) else ('ε', 'δ', '_')[k]
                if i == x + w // 2 and kind == 'closed':
                    ch = '-'
                c.put(i, y + j, ch)
        c.put(x + w // 2 - 1 if kind == 'closed' else x + w - 3, y + h // 2, 'K')
    if box:
        flw = 'κMKMκNLMκ' if (x // 3) % 2 else 'LNκMLMKNκ'
        for i in range(1, w - 1):
            c.put(x + i, y + h - 1, flw[(i + x) % len(flw)])
        c.put(x + 2, y + h - 2, 'N')
        c.put(x + w - 3, y + h - 2, 'O')
    for i in range(-1, w + 1):
        if box:
            c.put(x + i, y + h, 'η')
            c.put(x + i, y + h + 1, 'δ' if i % 3 else 'ζ')
        else:
            c.put(x + i, y + h, 'r' if i < w // 2 else 'm')
            c.put(x + i, y + h + 1, 'h' if i < w // 2 else 'e')
