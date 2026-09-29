"""monster3-3 서큐버스(파티원) — 셀 64, 15칸. 걷기 칩 그대로: 보라 피부·녹색 머리 기수가 갈색 말을 탄 모습(창·검 든 손). 바닥에 선다. 도약은 말이 뛰어오른다.
공용 엔진 pp15_pp5.Poser: 걷기 칩 왼쪽 보기 칸을 Scale2x 로 정수 2배 한 몸이 대기 칸이고, 나머지 칸은 부위를 옮겨 만든다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp5 import Poser, fx_common, star, burst, note  # noqa


def fx(R, d, J):
    fx_common(R, d, J, 'dd94bc', 'fff5c3', (1, 16), 'arm')


S = dict(
    name='monster3-3', chip=3, cell=64, breath_y=15, dead='slump',
    parts=[
        ('head', [(6, 0), (21, 0), (21, 14.5), (6, 14.5)], (13, 14)),
        ('neck', [(0, 7.5), (7.5, 7.5), (7.5, 15), (0, 15)], (7, 14)),
        ('arm', [(0, 15), (5.5, 15), (5.5, 18.5), (0, 18.5)], (5, 16)),
        ('legs', [(4, 24.5), (23, 24.5), (23, 31), (4, 31)], (13, 24)),
    ],
    order=['legs', 'body', 'neck', 'arm', 'head'],
    fx=fx,
    poses={
        'idle_b': dict(br=1, neck=(0, 1, 0)),
        'idle_c': dict(br=1, neck=(0, 2, -4), head=(0, 1, 0)),
        'windup': dict(g=(3, 0, 4), neck=(1, -2, 12), arm=(2, -3, 30), head=(1, 0, 0)),
        'move': dict(g=(-6, 0, -5), neck=(-1, 1, -8), legs=(-2, 0, 0), arm=(-1, 0, 0)),
        'attack': dict(g=(-9, 0, -7), neck=(-2, 1, -10), arm=(-4, 1, -20), head=(-2, 0, 0), legs=(-1, 0, 0), fx='impact'),
        'recover': dict(g=(-3, 0, -2), br=1, arm=(-1, 0, -6)),
        'hit': dict(g=(5, 0, 8), neck=(2, -3, 16), head=(2, -1, 0), arm=(1, -1, 15), fx='hurt'),
        'cast_charge': dict(g=(1, 0, 2), br=1, arm=(1, -1, 20), fx='charge'),
        'cast_raise': dict(g=(0, -1, 1), br=-2, arm=(2, -6, 80), head=(0, -2, 0), neck=(0, -1, 6), fx='raise'),
        'cast_release': dict(g=(-5, 0, -5), arm=(-4, -1, -15), head=(-1, 0, 0), neck=(-1, 0, -6), fx='release'),
        'leap': dict(g=(-3, -9, -10), br=1, neck=(0, -3, 20), legs=(1, -3, 0), air=True),
        'buff': dict(g=(0, -1, 1), br=-2, neck=(0, -3, 22), arm=(1, -4, 60), head=(0, -2, 0), fx='buff'),
        'finisher': dict(g=(-10, -1, -9), br=-2, neck=(-2, 0, -14), arm=(-5, -1, -35), head=(-2, -1, 0), legs=(-2, 0, 0), fx='finisher'),
    },
)

if __name__ == '__main__':
    Poser(S).sheet()

