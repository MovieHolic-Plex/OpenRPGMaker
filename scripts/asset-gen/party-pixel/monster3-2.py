"""monster3-2 망령술사(파티원) — 셀 48, 15칸. 검은 두건·금 테두리·긴 망토, 얼굴은 어둠, 손에 보라 영혼 불. 발 없이 뜬다(dead 만 바닥).
공용 엔진 pp15_pp5.Poser: 걷기 칩 왼쪽 보기 칸을 확대 없이(칩 × 1) 대기 칸 몸으로 쓰고, 나머지 칸은 부위를 옮겨 만든다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp5 import Poser, fx_common, star, burst, note  # noqa


def fx(R, d, J):
    k = J['P'].get('fx')
    x, y = J['pt'](7, 23, 'arm')
    V, Vl = R.c('622680'), R.c('d8ad50')
    if k == 'release':
        for i in range(3):
            d.ellipse((x - 8 - i * 6, y - 2 - i, x - 4 - i * 6, y + 2 - i), fill=V)
            d.point((x - 6 - i * 6, y - 1 - i), fill=Vl)
        return
    if k == 'finisher':
        for i in range(5):
            a = math.radians(160 + i * 16)
            px, py = x + math.cos(a) * 16, y + math.sin(a) * 16
            d.ellipse((px - 2, py - 2, px + 2, py + 2), fill=V)
            d.point((int(px), int(py) - 1), fill=Vl)
        d.arc((x - 22, y - 18, x + 6, y + 10), 140, 230, fill=Vl, width=1)
        return
    fx_common(R, d, J, '622680', 'd8ad50', (7, 23), 'arm')


S = dict(
    name='monster3-2', chip=2, cell=48, ground=False, oy=-4, breath_y=19,
    parts=[
        ('head', [(5, 6), (20, 6), (20, 18.5), (5, 18.5)], (12, 18)),
        ('arm', [(5, 20.5), (10.5, 20.5), (10.5, 28), (5, 28)], (9, 21)),
    ],
    order=['body', 'arm', 'head'],
    fx=fx,
    poses={
        'idle_b': dict(g=(0, 1, 0), br=1),
        'idle_c': dict(g=(0, 2, 1), br=1, arm=(0, 1, 0)),
        'windup': dict(g=(3, -1, 5), arm=(2, -3, 30), head=(1, 0, 0)),
        'move': dict(g=(-5, -2, -8), arm=(-1, 0, -10)),
        'attack': dict(g=(-8, 0, -8), arm=(-5, -1, -35), head=(-2, 0, 0), fx='impact'),
        'recover': dict(g=(-2, 1, -2), arm=(-1, 0, -10), br=1),
        'hit': dict(g=(5, -1, 9), arm=(2, -2, 20), head=(2, -1, 0), fx='hurt'),
        'cast_charge': dict(g=(1, 1, 2), br=2, arm=(1, -2, 15), fx='charge'),
        'cast_raise': dict(g=(0, -3, 1), br=-2, arm=(1, -8, 60), head=(0, -1, 0), fx='raise'),
        'cast_release': dict(g=(-5, -1, -6), arm=(-5, -2, -40), head=(-1, 0, 0), fx='release'),
        'leap': dict(g=(-2, -9, -5), br=2, arm=(0, -3, 40), air=True),
        'buff': dict(g=(0, -2, 0), br=-3, arm=(1, -4, 45), head=(0, -2, 0), fx='buff'),
        'finisher': dict(g=(-7, -2, -9), br=-2, arm=(-5, -4, -50), head=(-2, -1, 0), fx='finisher'),
    },
)

if __name__ == '__main__':
    Poser(S).sheet()

