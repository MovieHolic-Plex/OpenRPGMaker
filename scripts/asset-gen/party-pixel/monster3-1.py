"""monster3-1 라미아(파티원) — 셀 64, 15칸. 청록 비늘·주황 무늬 뱀 몸이 똬리를 튼 모습(칩 그대로). 머리(왼쪽 앞)가 튀어나가 휘감고 독을 뿜는다. 바닥에 붙는다.
공용 엔진 pp15_pp5.Poser: 걷기 칩 왼쪽 보기 칸을 Scale2x 로 정수 2배 한 몸이 대기 칸이고, 나머지 칸은 부위를 옮겨 만든다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp5 import Poser, fx_common, star, burst, note  # noqa


def fx(R, d, J):
    k = J['P'].get('fx')
    if k in ('release', 'finisher'):
        x, y = J['pt'](1, 17, 'head')
        G, L = R.c('29b3b0'), R.c('b0d7ff')
        n = 3 if k == 'release' else 5
        for i in range(n):
            d.ellipse((x - 5 - i * 5, y - 2 + (i % 2) * 2, x - 2 - i * 5, y + 1 + (i % 2) * 2), fill=G if i % 2 else L)
        if k == 'finisher':
            d.arc((x - 30, y - 20, x + 4, y + 14), 110, 250, fill=G, width=3)
            d.arc((x - 28, y - 18, x + 2, y + 12), 120, 240, fill=L, width=1)
        return
    fx_common(R, d, J, '29b3b0', 'ffab3f', (1, 17), 'head')


S = dict(
    name='monster3-1', chip=1, cell=64, breath_y=14, dead='slump',
    parts=[
        ('head', [(0, 7.5), (11, 7.5), (11, 25), (0, 25)], (9, 22)),
        ('back', [(12, 0), (24, 0), (24, 12.5), (12, 12.5)], (14, 11)),
    ],
    order=['back', 'body', 'head'],
    attached=('head', 'back'),
    fx=fx,
    poses={
        'idle_b': dict(br=1, head=(0, 1, 0), back=(0, 1, 4)),
        'idle_c': dict(br=2, head=(0, 1, 3), back=(1, 1, 8)),
        'windup': dict(g=(3, 0, 6), br=1, head=(2, -2, 10), back=(0, 0, 8)),
        'move': dict(g=(-4, 0, -4), head=(-2, 0, -4), back=(1, 0, -6)),
        'attack': dict(g=(-6, 0, -8), br=-2, head=(-4, -1, -8), back=(2, 0, -10), fx='impact'),
        'recover': dict(g=(-2, 0, -2), br=1, head=(-2, 0, -4), back=(0, 0, -3)),
        'hit': dict(g=(5, 0, 8), head=(3, -2, 12), back=(0, -1, 10), fx='hurt'),
        'cast_charge': dict(g=(2, 0, 3), br=2, head=(2, 1, 6), back=(0, 1, 6), fx='charge'),
        'cast_raise': dict(g=(0, -1, 2), br=-3, head=(0, -4, -6), back=(0, -2, 14), fx='raise'),
        'cast_release': dict(g=(-4, 0, -6), br=-1, head=(-4, -1, -6), back=(1, 0, -8), fx='release'),
        'leap': dict(g=(-3, -10, -4), br=2, head=(-2, -2, -8), back=(0, -2, 16), air=True),
        'buff': dict(g=(0, 0, 1), br=-3, head=(0, -3, 4), back=(0, -3, 18), fx='buff'),
        'finisher': dict(g=(-7, -1, -10), br=-3, head=(-4, -3, -12), back=(3, -2, -14), fx='finisher'),
    },
)

if __name__ == '__main__':
    Poser(S).sheet()

