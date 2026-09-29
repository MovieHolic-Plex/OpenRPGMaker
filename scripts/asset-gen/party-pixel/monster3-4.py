"""monster3-4 개미귀신(파티원) — 64 셀. 걷기 칩: 갈색 흙더미에 푸른 밧줄 무늬, 입구에서 분홍 입이 벌어진다. 몸 대부분이 모래에 묻힌 괴수(stomp).
대기 = 흙더미가 들썩·모래가 흘러내림, windup = 가라앉으며 부풀림, move = 모래 파도를 밀며 전진, attack = 입구가 크게 열려 턱이 튀어나옴. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from mon_lib import *  # noqa

CELL = 64
PAL = dict(o='24160c', s='4f2e21', b='714e29', l='a77b4b', L='c8a070', r='082b44', R='00558e', m='a3355f', M='e07aa0', t='f0e0c0', g='3a5a2a', e='fff08a')
SH = {'idle_a': (0, 22, 16, 0), 'idle_b': (0, 23, 15, 1), 'idle_c': (0, 22, 17, 2), 'windup': (-2, 25, 12, 0), 'move': (4, 21, 15, 1),
      'attack': (5, 22, 18, 3), 'recover': (2, 22, 16, 1), 'hit': (-4, 20, 14, 0), 'dead': (0, 26, 7, 0)}


def draw(p, n):
    G = CELL - 4
    dx, rx, ry, jaw = SH[n]
    cx = 30 + dx
    # 흙더미: 둥근 봉분
    mass(p, [(cx, G - ry * .55, rx, ry, 0), (cx - rx * .5, G - ry * .3, rx * .55, ry * .6, 0), (cx + rx * .45, G - ry * .3, rx * .55, ry * .6, 0)],
         keys={'l': 'L', 'b': 'l', 's': 'b'})
    # 바닥 평평하게 자르기
    for y in range(G + 1, CELL):
        for x in range(CELL):
            p.im.putpixel((x, y), (0, 0, 0, 0))
    p.line([(cx - rx - 2, G), (cx + rx + 2, G)], 'o')
    p.line([(cx - rx - 1, G - 1), (cx + rx + 1, G - 1)], 's')
    # 흙 줄무늬 + 밧줄
    top = G - ry * 1.55
    for k in range(3):
        y = top + ry * (.45 + k * .32)
        p.d.arc((cx - rx + 2, y - 5, cx + rx - 2, y + 5), 200, 340, fill=p.pal['b'])
    p.d.arc((cx - rx + 1, top + ry * .6 - 7, cx + rx - 1, top + ry * .6 + 7), 190, 350, fill=p.pal['o'], width=3)
    p.d.arc((cx - rx + 1, top + ry * .6 - 7, cx + rx - 1, top + ry * .6 + 7), 190, 350, fill=p.pal['R'], width=1)
    if n == 'dead':
        for k in range(4): dot(p, cx - 10 + k * 7, G - 3, 'L')
        p.line([(cx + 8, G - 4), (cx + 12, G - 4)], 'm')
        return
    # 입구(앞 = 오른쪽): 분홍 입과 턱
    mx, my = cx + rx * .55, G - ry * .5
    w = 4 + jaw * 2
    blob(p, mx, my, w, 3 + jaw, 0, keys={'l': 'M', 'b': 'm', 's': 's'})
    p.box((int(mx) - w + 2, int(my) - 1, int(mx) + w - 2, int(my) + jaw), 's')
    for k in range(-1, 2):
        dot(p, mx + k * 2, my - 1, 't')
    if jaw >= 2:     # 튀어나온 집게 턱
        for sgn in (-1, 1):
            base = (mx + 2, my + sgn * (2 + jaw))
            tip = (mx + 10 + jaw, my + sgn * 1)
            pts = bez([(base[0], base[1], 1.4), (mx + 8, my + sgn * (6 + jaw), 1.2), (tip[0], tip[1], .5)], 12)
            tube(p, pts, 'b', 'o', 's')
    # 눈 둘(흙더미 위, 번쩍)
    for ox in (4, 9):
        ex, ey = cx + ox, top + ry * .3
        p.box((int(ex), int(ey), int(ex) + 1, int(ey) + 1), 'o' if n == 'hit' else 'e')
    # 흘러내리는 모래알 / 이끼
    for k in range(5):
        x = cx - rx + 4 + k * (rx * 2 - 8) / 4
        y = G - 3 - ((k * 3 + jaw + SH[n][3]) % 5)
        dot(p, x, y, 'L')
    dot(p, cx - 6, top + 3, 'g'); dot(p, cx - 5, top + 3, 'g')
    if n == 'move':
        for k in range(4): p.line([(cx - rx - 4 - k * 3, G - 1 - k), (cx - rx - 1 - k * 3, G - 1 - k)], 'l')


if __name__ == '__main__':
    build('monster3-4', 'b5', CELL, PAL, draw)

