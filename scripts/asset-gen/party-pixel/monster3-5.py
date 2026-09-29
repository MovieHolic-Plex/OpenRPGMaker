"""monster3-5 새끼 화룡(파티원) — 셀 64, 15칸. 붉은 비늘·흰 뿔·살구빛 배·붉은 날개, 뒷다리로 선 통통한 새끼 용. 입에서 불을 뿜는다. 바닥에 선다.
공용 엔진 pp15_pp5.Poser: 걷기 칩 왼쪽 보기 칸을 Scale2x 로 정수 2배 한 몸이 대기 칸이고, 나머지 칸은 부위를 옮겨 만든다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp5 import Poser, fx_common, star, burst, note  # noqa


def fx(R, d, J):
    k = J['P'].get('fx')
    x, y = J['pt'](2, 10, 'head')
    O, Y, Rr = R.c('ffd578'), R.c('f09a6b'), R.c('ff3f44')
    if k in ('release', 'finisher', 'impact') or J['name'] == 'attack':
        ln = {'impact': 10, 'release': 18, 'finisher': 26}.get(k, 10)
        h = 3 if k != 'finisher' else 6
        d.polygon([(x, y - 1), (x - ln, y - h), (x - ln - 4, y), (x - ln, y + h), (x, y + 2)], fill=Rr)
        d.polygon([(x - 1, y), (x - ln + 3, y - h + 2), (x - ln, y), (x - ln + 3, y + h - 2)], fill=Y)
        d.line((x - 2, y, x - ln + 5, y), fill=O)
        return
    if k == 'charge':
        d.point((x - 1, y + 1), fill=O)
        d.point((x - 3, y), fill=Y)
        d.point((x - 2, y - 2), fill=Rr)
        return
    fx_common(R, d, J, 'ff3f44', 'ffd578', (2, 10), 'head')


S = dict(
    # 몸을 오른쪽으로 7px 놓아 입 앞(왼쪽)에 불길 자리를 둔다.
    name='monster3-5', chip=5, cell=64, breath_y=15, ox=7, dead='slump',
    parts=[
        ('head', [(1, 2), (13.5, 2), (13.5, 12.5), (1, 12.5)], (9, 12)),
        ('back', [(14.5, 6), (21, 6), (21, 21), (14.5, 21)], (15, 13)),
        ('tail', [(2, 27.5), (12, 27.5), (12, 31), (2, 31)], (10, 27)),
    ],
    order=['back', 'body', 'tail', 'head'],
    fx=fx,
    poses={
        'idle_b': dict(br=1, back=(0, 0, 6), tail=(0, 0, 3)),
        'idle_c': dict(br=1, back=(0, 0, 12), tail=(0, 0, 6), head=(0, 1, 0)),
        'windup': dict(g=(3, 0, 6), br=-1, head=(2, -2, 14), back=(0, 0, 18)),
        'move': dict(g=(-5, 0, -4), head=(-1, 0, -4), back=(1, 0, -10), tail=(1, 0, 6)),
        'attack': dict(g=(-7, 0, -6), br=1, head=(-3, 1, -8), back=(1, 0, -16), fx='impact'),
        'recover': dict(g=(-2, 0, -2), br=1, head=(-1, 0, -3), back=(0, 0, -4)),
        'hit': dict(g=(5, 0, 9), head=(2, -2, 18), back=(0, -1, 20), tail=(0, 0, -6), fx='hurt'),
        'cast_charge': dict(g=(2, 0, 3), br=-2, head=(2, -1, 10), back=(0, 0, 10), fx='charge'),
        'cast_raise': dict(g=(0, -1, 2), br=-3, head=(1, -4, 24), back=(0, -2, 34), fx='raise'),
        'cast_release': dict(g=(-6, 0, -6), br=1, head=(-3, 1, -10), back=(1, 0, -14), fx='release'),
        'leap': dict(g=(-2, -10, -5), br=1, back=(0, -2, 40), tail=(1, -1, -10), air=True),
        'buff': dict(g=(0, -1, 1), br=-3, head=(0, -3, 14), back=(0, -2, 44), fx='buff'),
        'finisher': dict(g=(-7, -1, -8), br=-2, head=(-4, 0, -12), back=(1, -1, 30), tail=(2, 0, 8), fx='finisher'),
    },
)

if __name__ == '__main__':
    Poser(S).sheet()

