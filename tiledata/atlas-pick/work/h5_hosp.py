from h5_lib import *
import random
L = {}
for i, ch in enumerate('0123456'): L[ch] = ('ward', i)
for i, ch in enumerate('abcdefg'): L[ch] = ('grave', i)
for i, ch in enumerate('pqrstuv'): L[ch] = ('sheet', i)
for i, ch in enumerate('ABCDEF'): L[ch] = ('blood', i)
for i, ch in enumerate('mnopqr'): pass
L.update({'H': ('rust', 2), 'I': ('rust', 3), 'J': ('rust', 4), 'K': ('rust', 1),
          'x': ('void', 0), 'y': ('void', 1), 'z': ('void', 2), 'w': ('void', 3),
          'T': ('tarn', 1), 'U': ('tarn', 2), 'Y': ('tarn', 3), 'M': ('murk', 3), 'N': ('murk', 2), 'O': ('murk', 4)})

def floor(c, base, hi, lo, grout, ghi, spk):
    for ty in range(4):
        for tx in range(4):
            x, y = tx * 8, ty * 8
            c.rect(x, y, 8, 8, base)
            c.hl(x, y, 8, grout); c.vl(x, y, 8, grout)         # 왼쪽·위 줄눈 (이어 붙는 쪽)
            c.hl(x + 1, y + 1, 7, hi); c.vl(x + 1, y + 1, 7, hi) # 위·왼 하이라이트
            c.hl(x + 1, y + 7, 7, lo); c.vl(x + 7, y + 2, 6, lo) # 아래·오른 그늘
            c.px(x, y, ghi)
    # 미세 얼룩(손으로 고른 자리)
    for (x, y) in ((4, 4), (13, 5), (21, 3), (29, 6), (6, 12), (11, 14), (26, 12), (2, 19), (15, 21), (23, 20), (30, 22), (9, 27), (18, 29), (27, 28), (5, 30)):
        c.px(x, y, spk)

def broken(c, tx, ty, inner, edge):
    x, y = tx * 8, ty * 8
    # 깨진 타일: 대각선 금과 틈 속 어둠, 조각이 살짝 어긋남
    pts = [(2, 2), (3, 3), (3, 4), (4, 5), (5, 5), (5, 6), (6, 7)]
    for (a, b) in pts: c.px(x + a, y + b, inner)
    for (a, b) in ((3, 2), (4, 3), (4, 4), (5, 4)): c.px(x + a, y + b, edge)
    c.px(x + 6, y + 6, inner); c.px(x + 2, y + 3, inner)

def stain(c, cx, cy, rx, ry, ring, mid):
    for j in range(-ry - 1, ry + 2):
        for i in range(-rx - 1, rx + 2):
            d = (i * i) / (rx * rx) + (j * j) / (ry * ry)
            x, y = cx + i, cy + j
            if d <= 0.55 and (x % 8) and (y % 8): c.px(x, y, mid)
            elif d <= 1.05 and (x % 8) and (y % 8): c.px(x, y, ring)

def foot(c, x, y, ch):
    for (a, b) in ((0, 0), (1, 0), (0, 1), (1, 1), (0, 2), (1, 2), (0, 3), (1, 3), (0, 5), (1, 5)): c.px(x + a, y + b, ch)
    c.px(x + 2, y + 1, ch); c.px(x + 2, y + 2, ch)

# ---------- floor A
c = C(32, 32); floor(c, '4', '5', '3', 'b', 'c', '3')
broken(c, 2, 1, 'x', '1')
stain(c, 6, 21, 4, 3, '3', '2')
foot(c, 22, 24, 'z'); foot(c, 26, 18, 'z')
save('hosp_floor', 'h5-A', c, L, 'v5 회색 판석의 폐병원판: 8px 타일 한 색 + 위·왼 줄눈, 깨진 타일 한 장(대각 금 속 어둠), 물 얼룩 한 곳, 검은 발자국 두 짝. 가장자리는 줄눈 열에서 끊겨 사방 이음')

# ---------- floor B : 창빛이 든 자리는 밝고 나머지는 한 단씩 어둡게
c = C(32, 32); floor(c, '3', '4', '2', 'a', 'b', '2')
for ty, tx0, tx1 in ((0, 1, 2), (1, 1, 3), (2, 2, 3)):
    for tx in range(tx0, tx1 + 1):
        x, y = tx * 8, ty * 8
        c.rect(x + 1, y + 1, 7, 7, 'p' if False else '5'); c.hl(x + 1, y + 1, 7, 'q' if False else '6'); c.vl(x + 1, y + 1, 7, '6')
        c.hl(x + 1, y + 7, 7, '4'); c.vl(x + 7, y + 2, 6, '4')
for (x, y) in ((11, 5), (18, 4), (19, 12), (27, 15), (22, 20)): c.px(x, y, '4')
broken(c, 3, 2, 'x', '2')
c.rect(2, 24, 6, 5, 'z')
stain(c, 6, 27, 3, 2, 'y', 'x')
save('hosp_floor', 'h5-B', c, L, '바닥 전체를 어둡게 두고 창빛 든 타일 일곱 장만 밝은 회백으로: 사선 빛줄기 모양. 빛 안쪽에 깨진 타일, 어둠 쪽 구석에 번진 검은 얼룩')

# ---------- floor C : 피 끌린 자국
c = C(32, 32); floor(c, '3', '4', '2', 'a', 'b', '2')
# 피 끌림: 타일 위로 굽은 띠, 끝에 손바닥 자국
path = [(8, 6), (9, 6), (10, 7), (11, 8), (12, 9), (13, 9), (14, 10), (15, 11), (16, 11), (17, 12), (18, 13), (19, 13), (20, 14), (21, 15), (22, 15)]
for (x, y) in path:
    for d in (0, 1): c.px(x, y + d, 'C' if d == 0 else 'B')
    c.px(x, y + 2, 'A')
for (x, y) in ((22, 14), (23, 14), (24, 14), (22, 16), (23, 16), (24, 17), (23, 15), (24, 15), (25, 15)):
    c.px(x, y, 'C')
for (x, y) in ((24, 13), (25, 13), (25, 14), (26, 15), (26, 16), (25, 17)): c.px(x, y, 'B')
broken(c, 0, 3, 'x', '1')
for k in range(0, 8): c.px(2 + k, 25 + k // 3, 'y')
save('hosp_floor', 'h5-C', c, L, '끌린 핏자국이 바닥을 가로질러 손바닥·손가락 자국으로 끝남(핏빛 6분의 1 이하), 아래 왼쪽에 깨진 타일과 틈. 타일은 어두운 청회색이라 핏빛만 튐')

# =============== 벽
def wall(c, paint, phi, plo, under, rail, rail2, wain, whi, wlo, base, bhi, blo):
    c.rect(0, 0, 32, 20, paint)
    c.hl(0, 0, 32, phi); c.hl(0, 1, 32, phi)
    for x in range(0, 32, 5): c.vl(x, 2, 18, plo if x % 10 == 0 else paint)   # 페인트 결
    for x in (3, 11, 19, 27): c.vl(x, 2, 6, phi)
    c.hl(0, 19, 32, plo)
    c.hl(0, 20, 32, rail); c.hl(0, 21, 32, rail2)
    c.rect(0, 22, 32, 7, wain)
    c.hl(0, 22, 32, whi)
    for x in range(1, 32, 4): c.vl(x, 23, 6, wlo)
    c.hl(0, 28, 32, wlo)
    c.rect(0, 29, 32, 3, base); c.hl(0, 29, 32, bhi); c.hl(0, 31, 32, blo)

def peel(c, x, y, w, h, under, edge):
    # 벗겨진 얼룩: 불규칙한 덩어리
    for j in range(h):
        inset = 1 if j in (0, h - 1) else 0
        c.hl(x + inset + (1 if j % 3 == 2 else 0), y + j, w - 2 * inset - (1 if j % 2 == 0 else 0), under)
    c.hl(x + 1, y, w - 2, edge)
    c.hl(x, y + h, w - 1, edge) if False else None

def drip(c, x, y, n):
    c.vl(x, y, n, 'K'); c.vl(x, y + n // 2, n - n // 2, 'H'); c.px(x, y + n, 'I'); c.px(x, y + n + 1, 'H')

# ---------- wall A
c = C(32, 32); wall(c, '4', '5', '3', 'b', '6', '2', '2', '3', '1', 'b', 'c', 'a')
peel(c, 5, 5, 8, 6, 'c', 'e'); peel(c, 19, 11, 7, 5, 'd', 'e'); peel(c, 14, 2, 5, 3, 'c', 'e')
c.px(7, 7, 'd'); c.px(9, 8, 'b'); c.px(21, 13, 'c')
drip(c, 16, 3, 13); drip(c, 29, 4, 9)
save('hosp_wall', 'h5-A', c, L, '병원 벽 v5 판: 바랜 회녹 페인트 위 벗겨진 얼룩 세 곳(속 회색), 아래는 짙은 녹색 징두리와 경계 가로줄, 걸레받이, 녹물 한 줄. 좌우 이음은 x0/x31 열 동일')

# ---------- wall B : 창빛이 위쪽 절반만 스침
c = C(32, 32); wall(c, '3', '5', '2', 'a', '6', '1', '1', '2', '0', 'a', 'b', '0')
for x in range(8, 24):
    c.rect(x, 2, 1, 9 - abs(x - 15) // 2, '5')
c.rect(10, 4, 12, 3, '6'); c.hl(10, 3, 12, '5')
peel(c, 4, 12, 8, 5, 'b', 'd'); peel(c, 23, 6, 6, 6, 'a', 'c')
drip(c, 2, 3, 14); drip(c, 20, 8, 8)
c.rect(0, 12, 3, 8, '2'); c.rect(29, 12, 3, 8, '2')
c.hl(0, 22, 32, '4')
save('hosp_wall', 'h5-B', c, L, '위에서 오는 창빛 한 덩이가 벽 가운데를 가늘게 밝히고 양옆·아래는 한 단씩 어둡게. 어둠 쪽 벗겨진 곳에 회색 속이 비침')

# ---------- wall C : 「나가」 손글씨 + 긁힌 자국
c = C(32, 32); wall(c, '3', '4', '2', 'a', '5', '1', '1', '2', '0', 'a', 'b', '0')
peel(c, 3, 13, 7, 5, 'b', 'd')
def glyph(c, x, y, rows, ch, ch2):
    for j, r in enumerate(rows):
        for i, t in enumerate(r):
            if t == '#': c.px(x + i, y + j, ch)
            elif t == '+': c.px(x + i, y + j, ch2)
NA = ['##....##..', '##....##..', '##....####', '##....####', '##....##..', '##....##..', '######.##.', '######.##.', '.......##.']
GA = ['#####.##..', '#####.##..', '...##.##..', '...##.####', '...##.####', '...##.##..', '...##.##..', '...##.##..', '.......##.']
NA = ['##....##..', '##....##..', '##....##..', '##....####', '##....####', '##....##..', '######.##.', '######.##.', '.......##.']
NA = ['##....##..', '##....##..', '##....##..', '##....####', '##....####', '##....##..', '##....##..', '######.##.', '######.##.']
GA = ['#####.##..', '#####.##..', '...##.##..', '...##.##..', '...##.####', '...##.####', '...##.##..', '...##.##..', '...##.##..']
glyph(c, 5, 5, NA, 'D', 'C'); glyph(c, 17, 5, GA, 'D', 'C')
for x in (6, 8, 12, 18, 21, 24): c.vl(x, 15 if x < 12 else 14, 3 if x % 2 else 5, 'C')
for x in (9, 20): c.px(x, 19, 'B')
# 긴 긁힌 세 줄(속 회색)
for k in range(3):
    for j in range(9): c.px(24 + k * 2 + (j // 4), 11 + j, 'b')
save('hosp_wall', 'h5-C', c, L, '벽에 손끝으로 새긴 붉은 「나가」(2px 획, 흘러내림) + 오른쪽 긁힌 세 줄이 회색 속을 드러냄. 왼쪽 벗겨진 얼룩 한 곳')
