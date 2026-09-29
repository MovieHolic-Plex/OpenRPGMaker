"""monster3-0 세이렌(파티원) — 셀 64, 15칸. 걷기 칩 Monster3 #0 의 왼쪽 보기 가운데 칸을 정수 2배(Scale2x)한 몸이 대기 칸.
붉은 곱슬머리·흰 날개 팔·보라 치마·새 발. 떠 있고(dead 만 바닥), 노래(음파)로 싸운다. 칩 그림자 줄(29~31)은 떼어 낸다.
부위: 머리(곱슬머리+얼굴 윗부분) · 날개(뒤, 어깨 뿌리 피벗) · 다리. 공용 엔진 pp15_pp5.Poser."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp5 import Poser, fx_common  # noqa

WING = (14, 15.5)


def fx(R, d, J):
    n = J['name']
    k = J['P'].get('fx')
    mx, my = J['pt'](7, 12, 'head')
    W, Q, D = R.c('ffffff'), R.c('ff3f44'), R.dark + (255,)
    if k in ('release', 'finisher') or n == 'attack':
        rings = 3 if k != 'finisher' else 4
        for i in range(rings):
            r = 4 + i * 4
            d.arc((mx - r, my - r, mx + r, my + r), 140 - i * 4, 220 + i * 4, fill=W if i % 2 == 0 else Q, width=1)
        if k == 'finisher':
            for (a, b) in ((mx - 20, my - 12), (mx - 26, my + 8), (mx - 8, my - 18)):
                d.line((a - 2, b, a + 2, b), fill=W)
                d.line((a, b - 2, a, b + 2), fill=W)
                d.point((a + 4, b - 2), fill=Q)
        return
    if k in ('hurt', 'buff'):
        return fx_common(R, d, J, 'ff3f44', 'ffffff', (7, 12), 'head')
    if k == 'charge':
        # 목에 음표 두 개를 모은다
        for (a, b) in ((mx - 7, my - 4), (mx - 4, my - 9)):
            d.rectangle((a, b + 2, a + 1, b + 3), fill=W)
            d.line((a + 1, b - 2, a + 1, b + 2), fill=W)
            d.point((a + 2, b - 2), fill=W)
    if k == 'raise':
        for i, (a, b) in enumerate(((mx - 8, my - 16), (mx + 2, my - 22), (mx + 12, my - 14))):
            d.rectangle((a, b + 2, a + 1, b + 3), fill=W if i != 1 else Q)
            d.line((a + 1, b - 2, a + 1, b + 2), fill=W if i != 1 else Q)
            d.line((a + 1, b - 2, a + 3, b - 1), fill=W if i != 1 else Q)


S = dict(
    name='monster3-0', chip=0, cell=64, drop=(28, 29, 30, 31), ground=False, oy=-4, breath_y=18,
    parts=[
        ('wing', [(19.5, 11), (24, 11), (24, 23), (15.5, 23), (15.5, 19), (11.5, 18), (11.5, 14), (17.5, 14), (17.5, 13), (19.5, 13)], WING),
        ('head', [(4, 0), (22, 0), (22, 14), (4, 14)], (10, 14)),
        ('legs', [(3, 21.5), (15.5, 21.5), (15.5, 29), (3, 29)], (10, 21)),
    ],
    order=['legs', 'body', 'wing', 'head'],
    roles={'wing': 'arm'},
    fx=fx,
    poses={
        'idle_a': dict(g=(0, 0, 0)),
        'idle_b': dict(g=(0, 1, 0), wing=(0, 0, 8), br=1),
        'idle_c': dict(g=(0, 2, 0), wing=(0, 0, 16), br=1),
        'windup': dict(g=(4, -2, 5), wing=(1, -1, 38), head=(1, 0, 0), legs=(1, 0, 0)),
        'move': dict(g=(-6, -3, -6), wing=(2, 0, -18), legs=(2, -1, 0)),
        'attack': dict(g=(-10, 0, -8), wing=(1, 0, -40), head=(-1, 0, 0), legs=(3, -1, 0), br=-1),
        'recover': dict(g=(-3, 1, -2), wing=(0, 0, -12), br=1),
        'hit': dict(g=(6, -1, 9), wing=(1, -2, 50), head=(2, 0, 0), legs=(-2, 0, 0)),
        'cast_charge': dict(g=(1, 1, 2), br=2, wing=(0, 1, 22), head=(0, 1, 0)),
        'cast_raise': dict(g=(0, -3, 2), br=-2, wing=(0, -2, 62), head=(1, -1, 0)),
        'cast_release': dict(g=(-6, -1, -5), wing=(1, 0, -26), head=(-1, 0, 0)),
        'leap': dict(g=(-2, -10, -4), wing=(0, -1, 70), legs=(1, -3, 0), br=2),
        'buff': dict(g=(0, -2, 1), br=-2, wing=(0, -2, 80), head=(0, -1, 0)),
        'finisher': dict(g=(-8, -2, -7), br=-2, wing=(1, -1, -50), head=(-2, -1, 0), legs=(3, -2, 0)),
    },
)

if __name__ == '__main__':
    Poser(S).sheet()

