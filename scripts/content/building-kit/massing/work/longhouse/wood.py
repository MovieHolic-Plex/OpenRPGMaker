"""판자벽·덧창·닫힌 건초창 도우미(longhouse·tithe-barn 공용 사본). 난수·잡음 없음 — 손 표만."""

# 판자 이음 자리(판자 줄마다 다른 자리, 손으로 씀) — 화소 x 오프셋 목록
JOINTS = [
    [13, 41, 67, 98, 131],
    [27, 55, 84, 116],
    [6, 38, 72, 101, 140],
    [21, 49, 90, 122],
    [33, 60, 79, 110, 137],
    [9, 46, 75, 104, 128],
    [24, 58, 93, 119],
]
# 판자 결(옹이·긴 결) 위치: (판자줄, x, 길이)
GRAIN = [(0, 4, 5), (0, 30, 7), (1, 12, 4), (1, 64, 6), (2, 20, 5), (2, 52, 8), (3, 7, 6), (3, 70, 5),
         (4, 15, 7), (4, 44, 4), (5, 29, 6), (5, 83, 5), (6, 3, 4), (6, 61, 7), (0, 88, 6), (2, 106, 5),
         (4, 96, 6), (1, 120, 5), (3, 112, 4), (5, 134, 4), (6, 99, 6)]
# 판자 바탕 밝기(줄마다): 0 보통 · 1 밝은 새 판 · 2 묵은 판
BOARD_TONE = '0102010201'
BODY = {'0': ('θ', 'η', 'ζ', 'ε'), '1': ('μ', 'θ', 'η', 'ζ'), '2': ('η', 'ζ', 'ε', 'δ')}


def planks(c, x0, y0, w, h, bh=4, start=0, shade_top=0, mask=None):
    """가로 판자벽: 판자 높이 bh(맨 아래 1화소 이음 그늘). 판자마다 이음·결 자리가 다르다.
    shade_top: 위에서 몇 줄 처마 그늘(한 단 어둡게)."""
    DK = {'μ': 'θ', 'θ': 'η', 'η': 'ζ', 'ζ': 'ε', 'ε': 'δ', 'δ': 'γ', 'γ': 'α', 'α': '-', '-': '_', '_': '|'}
    for y in range(y0, y0 + h):
        k = (y - y0) // bh + start
        r = (y - y0) % bh
        tone = BOARD_TONE[k % len(BOARD_TONE)]
        hi, b1, b2, lo = BODY[tone]
        joints = JOINTS[k % len(JOINTS)]
        for x in range(x0, x0 + w):
            if mask and not mask(x, y):
                continue
            u = x - x0
            if r == bh - 1:
                ch = '-' if (u % 9) else '_'
            elif r == 0:
                ch = hi if (u % 11) != 5 else b1
            elif r == bh - 2:
                ch = lo
            else:
                ch = b1 if (u + k) % 13 < 9 else b2
            for j in joints:
                if u == j:
                    ch = '_' if r < bh - 1 else '|'
                elif u == j + 1 and r < bh - 1:
                    ch = hi if r == 0 else b1
            for (gk, gx, gl) in GRAIN:
                if gk == k % len(JOINTS) and r == 1 + (gx % 2) and gx <= u < gx + gl and r < bh - 2:
                    ch = b2 if ch in (b1, hi) else ch
            if y - y0 < shade_top:
                ch = DK.get(ch, ch)
            c.put(x, y, ch)


def shutter_hatch(c, x, y, w, h):
    """닫힌 판자 덧문(건초창·환기창): 세로 널 + Z 띠 + 쇠 경첩. 문이 아니다(땅에 닿지 않는다)."""
    for j in range(h):
        for i in range(w):
            edge = i in (0, w - 1) or j in (0, h - 1)
            if edge:
                ch = 'ξ' if (i == 0 or j == 0) else '_'
            elif i % 3 == 0:
                ch = '-'
            elif i % 3 == 1:
                ch = 'η' if j < h // 2 else 'ζ'
            else:
                ch = 'ζ' if j < h // 2 else 'ε'
            c.put(x + i, y + j, ch)
    # 띠 두 줄 + 사선
    for yy in (y + 2, y + h - 3):
        for i in range(1, w - 1):
            c.put(x + i, yy, 'θ' if yy == y + 2 else 'η')
            c.put(x + i, yy + 1, 'β')
    n = h - 6
    for s in range(n):
        xx = x + 1 + round((w - 3) * s / max(1, n - 1))
        c.put(xx, y + h - 4 - s, 'θ')
        c.put(xx + 1, y + h - 4 - s, 'β')
    for yy in (y + 2, y + h - 3):
        c.put(x + 1, yy, 'k')
        c.put(x + 2, yy, 'X')
    # 창턱 그늘
    for i in range(-1, w + 1):
        c.put(x + i, y + h, 'α' if i < w // 2 else '-')
