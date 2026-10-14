"""바닥·벽면 — 배 갑판·화물칸 널, 투기장 모래·사암 판석, 전시실 쪽마루 / 배 선체 벽(휜 늑골)·선장실 판벽·전시실 천 벽·투기장 사암 벽.
바닥 fn(X, Y) → RGB(세계 좌표, 주기 cols×16 · rows×16 안에서 이어진다). 벽 fn(X, fy) → RGB(fy 0..31 = 벽면 두 줄 위→아래)."""
from iplib import REG, K, hnoise


def plank_rows(X, Y, h, period, m, base, seed, nails=True):
    """가로로 누운 널: h px 높이, 줄마다 이음매 자리가 다르다."""
    row = Y // h; yy = Y % h
    joint = (row * 23 + seed * 7) % period
    xx = (X - joint) % period
    tone = base + (0 if (row * 5 + seed) % 3 else -1) + (1 if (row * 7 + seed) % 5 == 0 else 0)
    if yy == h - 1: return K(m, 1)                                  # 널 사이 틈(타르)
    if xx == 0: return K(m, 1)                                      # 맞댄 이음
    if xx == 1 or yy == 0: c = tone + 1                              # 밝은 모서리
    else: c = tone
    if nails and xx in (3, period - 3) and yy == h // 2: return K('iron', 2)
    g = hnoise(X // 3, row, seed)
    if g > .86: c -= 1                                              # 결
    elif g < .07: c += 1
    return K(m, c)


@REG.floor('deck', '배 갑판 널', 4, 4)
def deck(X, Y):
    return plank_rows(X % 64, Y % 64, 4, 64, 'pine', 3, 1)


@REG.floor('hold', '화물칸 거친 널', 4, 5)
def hold(X, Y):
    X, Y = X % 64, Y % 80
    c = plank_rows(X, Y, 5, 64, 'dwood', 4, 3)
    n = hnoise(X // 5, Y // 4, 9)
    if n > .93 and (Y % 5) not in (0, 4): return K('dwood', 3)      # 얼룩·닳은 자리
    return c


@REG.floor('sand', '투기장 모래', 4, 4)
def sand(X, Y):
    X, Y = X % 64, Y % 64
    n = hnoise(X, Y, 5); n2 = hnoise(X // 2, Y // 2, 11)
    c = 4
    if n2 > .9: c += 1                                                 # 드문 밝은 알갱이
    elif n2 < .07: c -= 1                                              # 드문 그늘 알갱이
    # 갈퀴 자국: 길게 흐르는 얕은 물결(벽돌처럼 끊기지 않게 가로로 이어진다)
    wave = (Y + int(round(2.5 * __import__('math').sin(X / 64 * 6.2832)))) % 10
    if wave == 0 and n > .2: c -= 1
    if n > .993: return K('stone', 4)                                 # 작은 자갈
    if n > .988: return K('stone', 2)
    return K('straw', c)


@REG.floor('sandstone', '사암 판석', 4, 4)
def sandstone(X, Y):
    X, Y = X % 64, Y % 64
    row = Y // 16; yy = Y % 16
    off = 0 if row % 2 == 0 else 8
    xx = (X + off) % 32 if row % 2 == 0 else (X + off) % 24
    w = 32 if row % 2 == 0 else 24
    blk = ((X + off) // w, row)
    tone = 3 + (1 if hnoise(*blk, 2) > .55 else 0) - (1 if hnoise(*blk, 4) > .85 else 0)
    if yy == 15 or xx == w - 1: return K('straw', 1)
    if yy == 0 or xx == 0: return K('straw', tone + 1)
    if yy == 14 or xx == w - 2: return K('straw', tone - 1)
    n = hnoise(X, Y, 8)
    if n > .93: return K('straw', tone - 1)
    if n < .04: return K('straw', tone + 1)
    return K('straw', tone)


@REG.floor('parquet', '전시실 쪽마루', 4, 4)
def parquet(X, Y):
    """8×8 칸을 가로·세로 쪽널 4장씩 엇갈려 깐 바구니 짜임(광 낸 꿀빛 나무, 대비는 낮게)."""
    X, Y = X % 64, Y % 64
    bx, by = X // 8, Y // 8; lx, ly = X % 8, Y % 8
    horiz = (bx + by) % 2 == 0
    a, b = (ly, lx) if horiz else (lx, ly)
    slat = a // 2
    tone = 4 if (bx * 3 + by * 5 + slat) % 3 else 3
    if (horiz and ly == 7) or (not horiz and lx == 7): return K('pine', 2)       # 덩이 경계(얕게)
    if a % 2 == 1 and slat < 3: return K('pine', tone - 1) if b % 4 == 0 else K('pine', tone)
    if hnoise(X, Y, 31) > .9: return K('pine', tone - 1)
    return K('pine', tone)


# ───────── 벽면 ─────────
def _wall_shade(c, fy):
    return c


@REG.wall('hull', '배 선체 판벽(휜 늑골)', 3)
def hull(X, fy):
    X = X % 48
    # 걸레받이(밝은 널 한 줄 + 그늘) — 벽과 같은 판자 바닥이 맞닿는 선을 읽히게 한다. 늑골은 걸레받이 위에서 끝난다.
    if fy == 25: return K('wood', 6)
    if 26 <= fy <= 28: return K('wood', 4 if fy == 26 else 3) if X % 16 else K('dwood', 2)
    if fy >= 29: return K('dwood', 2 if fy == 29 else 1)
    # 늑골(세로 들보): 아래로 갈수록 오른쪽으로 휜다 — 선체가 안으로 굽은 느낌
    bend = int(round(3 * (fy / 31) ** 2))
    rx = (X - bend) % 48
    if rx < 6:
        if rx == 0: return K('dwood', 1)
        if rx == 5: return K('dwood', 2)
        return K('wood', 5 if rx in (1, 2) else 4)
    if rx == 6: return K('dwood', 1)
    # 가로 널(5px), 위는 어둡고 아래로 밝아진다(배 안쪽 굽은 면)
    row = fy // 5; yy = fy % 5
    base = 2 + min(2, fy // 10)
    if yy == 4: return K('dwood', 1)
    if yy == 0: base += 1
    j = (X + row * 17) % 48
    if j == 20: return K('dwood', 1)
    if j == 23 and yy == 2: return K('iron', 3)
    if hnoise(X // 4, row, 21) > .85: base -= 1
    return K('dwood', base + 2)


@REG.wall('cabin', '선장실 판벽(놋쇠 띠)', 2)
def cabin(X, fy):
    X = X % 32
    if fy <= 1: return K('dwood', 1)
    if fy in (17, 18): return K('brass', 5 if fy == 17 else 3)       # 놋쇠 띠
    if fy >= 29: return K('dwood', 1 if fy == 31 else 2)               # 걸레받이
    if fy < 17:   # 위: 짜맞춘 판(테 안 판), 32px 마다 기둥
        if X in (0, 1): return K('dwood', 3 if X == 0 else 5)
        if fy in (3, 15) or X in (4, 28): return K('wood', 3) if fy == 15 or X == 28 else K('wood', 6)
        if 4 < X < 28 and 3 < fy < 15:
            return K('wood', 5 if X < 8 or fy < 6 else 4)
        return K('wood', 4)
    # 아래: 세로 널 징두리
    if X % 8 == 0: return K('dwood', 2)
    if X % 8 == 1: return K('dwood', 5)
    return K('dwood', 4 if fy < 24 else 3)


@REG.wall('gallery', '전시실 천 벽(녹청·금 띠)', 2)
def gallery(X, fy):
    X = X % 32
    if fy <= 1: return K('wood', 3)
    if fy == 2: return K('gold', 5)                                    # 그림 거는 띠
    if fy == 3: return K('gold', 3)
    if fy < 20:
        d = ((X % 8) - 4) ** 2 + (((fy - 4) % 8) - 4) ** 2               # 다마스크 점 무늬
        if d <= 1 and (X // 8 + (fy - 4) // 8) % 2 == 0: return K('teal', 2)
        return K('teal', 1 if fy < 6 else 1 if (X + fy) % 2 else 1)
    if fy == 20: return K('wood', 6)
    if fy == 21: return K('wood', 4)
    if fy >= 30: return K('dwood', 1 if fy == 31 else 2)
    # 아래 판(테 두른 판 32px)
    if X in (0, 31): return K('dwood', 2)
    if fy in (23, 28) or X in (3, 28):
        return K('dwood', 5) if fy == 23 or X == 3 else K('dwood', 2)
    return K('dwood', 4)


@REG.wall('arenawall', '투기장 사암 벽(벽기둥)', 4)
def arenawall(X, fy):
    X = X % 64
    # 64px 마다 벽기둥(밝은 돌, 머리·발 띠)
    if X < 10:
        if X == 0: return K('straw', 2)
        if X == 9: return K('straw', 2)
        if fy < 4: return K('straw', 6 if fy == 3 else 4)
        if fy > 27: return K('straw', 5 if fy == 28 else 3)
        return K('straw', 4 if X in (1, 2) else 3 if X < 7 else 2)
    row = fy // 8; yy = fy % 8
    off = 0 if row % 2 else 9
    xx = (X - 10 + off) % 18
    blk = ((X - 10 + off) // 18, row)
    tone = 3 + (1 if hnoise(*blk, 6) > .6 else 0)
    if fy >= 30: return K('straw', 1)
    if yy == 7 or xx == 17: return K('straw', 1)
    if yy == 0 or xx == 0: return K('straw', tone + 1)
    n = hnoise(X, fy, 13)
    if n > .92: return K('straw', tone - 1)
    return K('straw', tone)
