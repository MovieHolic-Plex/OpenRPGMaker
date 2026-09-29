"""monster3-6 업화(파티원) — 셀 48, 15칸. 붉은 불꽃 덩어리에 검은 얼굴 무늬. 칩 가운데 열의 옆 보기(행 1 = 오른쪽)를 좌우로 뒤집어 왼쪽을 보게 한다. 떠서 일렁인다(dead 만 바닥).
공용 엔진 pp15_pp5.Poser: 걷기 칩 왼쪽 보기 칸을 확대 없이(칩 × 1) 대기 칸 몸으로 쓰고, 나머지 칸은 부위를 옮겨 만든다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp5 import Poser, fx_common, star, burst, note  # noqa


def fx(R, d, J):
    k = J['P'].get('fx')
    x, y = J['pt'](1, 23, 'head')
    Rr, Lt, Dd = R.c('f45858'), R.c('d30000'), R.c('8c0c0c')
    if k in ('release', 'finisher', 'impact'):
        ln = {'impact': 8, 'release': 16, 'finisher': 24}[k]
        for i in range(3 if k != 'finisher' else 5):
            yy = y - 6 + i * 4
            d.polygon([(x, yy - 1), (x - ln + (i % 2) * 4, yy), (x, yy + 2)], fill=Rr if i % 2 else Lt)
        if k == 'finisher':
            burst(d, x - 10, y - 2, 12, 16, 8, Rr, 10)
        return
    if k in ('charge', 'raise', 'buff'):
        (x0, y0), (x1, y1) = J['pt'](1, 15), J['pt'](23, 31)
        n = {'charge': 3, 'raise': 5, 'buff': 7}[k]
        for i in range(n):
            xx = x0 + (x1 - x0) * (i + .5) / n
            h = 3 + (i * 7) % 5
            d.polygon([(xx - 2, y0 + 3), (xx, y0 - h), (xx + 2, y0 + 3)], fill=Rr if i % 2 else Lt)
        return
    fx_common(R, d, J, 'd30000', 'f45858', (1, 23), 'head')


S = dict(
    name='monster3-6', chip=6, cell=48, row=1, col=1, mirror=True, ground=False, oy=-6, breath_y=23,
    parts=[
        ('head', [(0, 14), (9, 14), (9, 30), (0, 30)], (8, 22)),
        ('back', [(14, 14), (24, 14), (24, 31), (14, 31)], (15, 23)),
    ],
    order=['back', 'body', 'head'],
    attached=('head', 'back'),
    fx=fx,
    dead='slump',
    poses={
        'idle_b': dict(g=(0, 1, 1), br=1, back=(1, 0, 4)),
        'idle_c': dict(g=(0, 2, -1), br=-1, head=(0, -1, 0), back=(0, -1, -4)),
        'windup': dict(g=(3, 1, 4), br=2, head=(2, 0, 0), back=(0, 0, 6)),
        'move': dict(g=(-5, -2, -8), head=(-2, 0, 0), back=(2, 0, -6)),
        'attack': dict(g=(-8, 0, -8), br=-3, head=(-3, 0, 0), back=(2, 0, -8), fx='impact'),
        'recover': dict(g=(-2, 1, -2), br=1, back=(1, 0, -3)),
        'hit': dict(g=(5, -1, 10), br=1, head=(2, -1, 0), back=(-1, 0, 10), fx='hurt'),
        'cast_charge': dict(g=(1, 2, 2), br=3, back=(0, 0, 4), fx='charge'),
        'cast_raise': dict(g=(0, -3, 0), br=-4, head=(0, -2, 0), back=(0, -2, 0), fx='raise'),
        'cast_release': dict(g=(-6, -1, -7), br=-2, head=(-3, 0, 0), back=(1, 0, -6), fx='release'),
        'leap': dict(g=(-2, -9, -4), br=-2, back=(1, -1, 8), air=True),
        'buff': dict(g=(0, -2, 0), br=-5, head=(-1, -2, 0), back=(1, -2, 0), fx='buff'),
        'finisher': dict(g=(-8, -2, -10), br=-4, head=(-3, -1, 0), back=(2, -1, -10), fx='finisher'),
    },
)

if __name__ == '__main__':
    Poser(S).sheet()

