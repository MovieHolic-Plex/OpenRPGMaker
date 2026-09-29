"""monster3-7 마장군(파티원) — 셀 64, 15칸. 검은 갑옷·푸른 피부·붉은 뿔, 금 장식, 보랏빛 대검(뒤 손, 칼끝이 아래). 바닥에 선다. 대검은 손잡이 피벗으로 돈다.
공용 엔진 pp15_pp5.Poser: 걷기 칩 왼쪽 보기 칸을 Scale2x 로 정수 2배 한 몸이 대기 칸이고, 나머지 칸은 부위를 옮겨 만든다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp5 import Poser, fx_common, star, burst, note  # noqa


def fx(R, d, J):
    k = J['P'].get('fx')
    V, Vl, Rr = R.c('6a60cb'), R.c('a790ec'), R.c('ff3f44')
    x, y = J['pt'](22, 30, 'arm')
    if k == 'impact':
        return burst(d, x, y, 2, 6, 6, Vl, 10)
    if k == 'finisher':
        hx, hy = J['pt'](19, 12, 'arm')
        d.arc((hx - 34, hy - 30, hx + 6, hy + 14), 110, 260, fill=V, width=4)
        d.arc((hx - 33, hy - 29, hx + 5, hy + 13), 120, 250, fill=Vl, width=1)
        star(d, x, y, 3, Vl, Rr)
        return
    if k in ('charge', 'raise', 'release'):
        n = {'charge': 2, 'raise': 4, 'release': 3}[k]
        hx, hy = J['pt'](19, 12, 'arm')
        for i in range(n):
            f = (i + 1) / (n + 1)
            px, py = hx + (x - hx) * f, hy + (y - hy) * f
            d.point((int(px) - 2, int(py)), fill=Vl)
            d.point((int(px) + 2, int(py) - 1), fill=V)
        if k == 'release':
            d.polygon([(x - 2, y - 3), (x - 16, y), (x - 2, y + 3)], fill=V)
            d.line((x - 3, y, x - 13, y), fill=Vl)
        return
    fx_common(R, d, J, '6a60cb', 'a790ec', (5, 12), 'head')


S = dict(
    name='monster3-7', chip=7, cell=64, breath_y=16, dead='lie',
    parts=[
        # 대검(붉은 손잡이 손 + 보랏빛 칼날). 금 어깨받이와 초록 망토는 몸에 남긴다. 피벗 = 손잡이.
        ('arm', [(18.5, 18.5), (24, 18.5), (24, 32), (18.5, 32)], (20, 20)),
        ('head', [(1, 1), (17, 1), (17, 12.5), (1, 12.5)], (9, 12)),
        ('legs', [(5, 22.5), (15.5, 22.5), (15.5, 31), (5, 31)], (10, 22)),
    ],
    order=['legs', 'body', 'head', 'arm'],
    fx=fx,
    poses={
        'idle_b': dict(br=1, arm=(0, 1, 2)),
        'idle_c': dict(br=1, arm=(0, 1, 4), head=(0, 1, 0)),
        # 칼날은 처음에 아래(+y)를 본다. 회전 +는 반시계: 180 = 위, -90 = 앞(왼쪽), 90 = 뒤.
        'windup': dict(g=(3, 0, 4), arm=(-2, -10, 170), head=(1, 0, 0)),
        'move': dict(g=(-6, 0, -5), arm=(0, -2, 120), legs=(-1, 0, 0)),
        'attack': dict(g=(-9, 0, -8), br=-1, arm=(-14, 0, -70), head=(-2, 0, 0), fx='impact'),
        'recover': dict(g=(-3, 0, -2), br=1, arm=(-8, 2, -25)),
        'hit': dict(g=(5, 0, 8), arm=(2, -2, 25), head=(2, -1, 0), fx='hurt'),
        'cast_charge': dict(g=(1, 0, 2), br=1, arm=(-4, -4, 150), fx='charge'),
        'cast_raise': dict(g=(0, -1, 1), br=-2, arm=(-6, -14, 180), head=(0, -1, 0), fx='raise'),
        'cast_release': dict(g=(-5, 0, -5), arm=(-14, -4, -100), head=(-1, 0, 0), fx='release'),
        'leap': dict(g=(-3, -9, -4), br=2, arm=(-2, -10, 160), legs=(1, -4, 0), air=True),
        'buff': dict(g=(0, -1, 1), br=-2, arm=(-6, -2, 0), head=(0, -2, 0), fx='buff'),
        'finisher': dict(g=(-10, 0, -10), br=-2, arm=(-16, 2, -45), head=(-2, 0, 0), legs=(-1, 0, 0), fx='finisher'),
    },
)

if __name__ == '__main__':
    Poser(S).sheet()

