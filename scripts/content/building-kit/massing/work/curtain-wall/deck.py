"""버들항 성탑 윗바닥처럼 위에서 본 네모 판석(줄 맞춤 격자, 엇갈림 없음 — 벽돌 벽과 다르게 읽힌다).
판 = 엷은 분홍 베이지 + 촘촘한 점(손 규칙), 판 위·왼쪽 줄눈은 짙은 회색, 판 안 왼·위 1px 밝은 모."""
BASES = ['o', 'q', 'o', 'p', 'o', 'l', 'q', 'o']
DOT = {'o': 'l', 'q': 'o', 'p': 'g', 'l': 'f'}
HI = {'o': 'q', 'q': 'r', 'p': 'r', 'l': 'o'}


def deck(c, x0, y0, x1, y1, sw=9, sh=8, ox=0, oy=0):
    for y in range(y0, y1 + 1):
        j, fy = divmod(y - y0 + oy, sh)
        for x in range(x0, x1 + 1):
            i, fx = divmod(x - x0 + ox, sw)
            base = BASES[(i * 3 + j * 5) % len(BASES)]
            if fy == 0 or fx == 0:
                ch = 'e' if (fy == 0 and fx == 0) or fy == 0 else 'i'
            elif fy == 1 or fx == 1:
                ch = HI[base]
            elif (x * 5 + y * 3 + (x + y) // 4) % 7 == 0:
                ch = DOT[base]
            elif fy == sh - 1 or fx == sw - 1:
                ch = DOT[base] if (x + y) % 2 else base
            else:
                ch = base
            c.put(x, y, ch)
