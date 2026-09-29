"""monster3-4 개미귀신(파티원) — 셀 64, 15칸. 갈색 흙더미·푸른 밧줄, 아래쪽에 분홍 입과 초록 눈. 칩의 풀 장식(초록)과 흩날린 모래는 떼어 낸다. 바닥에 묻혀 있다.
공용 엔진 pp15_pp5.Poser: 걷기 칩 왼쪽 보기 칸을 Scale2x 로 정수 2배 한 몸이 대기 칸이고, 나머지 칸은 부위를 옮겨 만든다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp5 import Poser, fx_common, star, burst, note  # noqa

GRASS = {(0x30, 0x80, 0x50), (0x3c, 0x8f, 0x4b), (0x2c, 0x63, 0x4c), (0x19, 0x96, 0x17)}


def clean(c):
    px = c.load()
    for y in range(32):
        for x in range(24):
            q = px[x, y]
            if q[3] and (q[:3] in GRASS and y >= 27 or y < 4):
                px[x, y] = (0, 0, 0, 0)
    # 흩날린 모래 알갱이(몸과 4방향으로 이어지지 않은 점)를 뗀다
    seen, comps = set(), []
    for y in range(32):
        for x in range(24):
            if px[x, y][3] and (x, y) not in seen:
                st, comp = [(x, y)], []
                seen.add((x, y))
                while st:
                    a, b = st.pop()
                    comp.append((a, b))
                    for i, j in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        q = (a + i, b + j)
                        if 0 <= q[0] < 24 and 0 <= q[1] < 32 and q not in seen and px[q][3]:
                            seen.add(q)
                            st.append(q)
                comps.append(comp)
    for comp in comps:
        if len(comp) < 12:
            for q in comp:
                px[q] = (0, 0, 0, 0)


def fx(R, d, J):
    k = J['P'].get('fx')
    S1, S2 = R.c('d7aa73'), R.c('a77b4b')
    if k in ('impact', 'release', 'finisher', 'buff'):
        x0, y0 = J['pt'](0, 28)
        x1, _ = J['pt'](24, 28)
        n = {'impact': 3, 'release': 5, 'finisher': 7, 'buff': 4}[k]
        for i in range(n):
            x = x0 - 3 - i * 3 if k in ('release', 'finisher', 'impact') else (x0 - 2 if i % 2 else x1 + 2)
            y = y0 - 1 - (i * 5) % 9 - (i // 2)
            d.rectangle((x, y, x + 2, y + 1), fill=S1 if i % 2 else S2)
    if k == 'hurt':
        fx_common(R, d, J, 'a77b4b', 'd7aa73', (6, 24))
    if k == 'charge':
        # 흙더미 꼭대기로 모래가 빨려 든다
        x, y = J['pt'](12, 4)
        for i, (a, b) in enumerate(((-8, -2), (7, -1), (-5, -7), (5, -6))):
            d.line((x + a, y + b, x + a * 0.6, y + b * 0.6), fill=S1 if i % 2 else S2)
    if k == 'finisher':
        x, y = J['pt'](1, 25)
        d.polygon([(x, y), (x - 14, y + 3), (x - 22, y + 3), (x - 14, y - 4), (x - 4, y - 8)], fill=S2)
        d.line((x - 4, y - 5, x - 16, y), fill=S1)
    if k == 'raise':
        x, y = J['pt'](12, 2)
        burst(d, x, y - 4, 3, 6, 5, S1, -90)


S = dict(
    name='monster3-4', chip=4, cell=64, breath_y=16, clean=clean, dead='slump',
    parts=[
        ('head', [(6.5, 21.5), (18.5, 21.5), (18.5, 29), (6.5, 29)], (12, 22)),
        ('back', [(5, 3), (19, 3), (19, 9.5), (5, 9.5)], (12, 9)),
    ],
    attached=('head', 'back'),
    order=['body', 'back', 'head'],
    fx=fx,
    poses={
        'idle_b': dict(br=1, back=(0, 1, 0)),
        'idle_c': dict(br=2, back=(0, 1, 4), head=(0, 0, 0)),
        'windup': dict(g=(2, 0, 3), br=3, head=(1, -1, 0), back=(0, 2, 6)),
        'move': dict(g=(-5, 0, -4), br=1, head=(-1, 0, 0), back=(0, 0, -6)),
        'attack': dict(g=(-7, 0, -5), br=-2, head=(-4, 1, -10), back=(1, -1, -8), fx='impact'),
        'recover': dict(g=(-2, 0, -1), br=1, head=(-1, 0, -3)),
        'hit': dict(g=(4, 0, 6), br=-1, head=(2, -1, 10), back=(0, -1, 10), fx='hurt'),
        'cast_charge': dict(g=(1, 0, 1), br=3, back=(0, 2, 0), fx='charge'),
        'cast_raise': dict(g=(0, 0, 0), br=-4, back=(0, -3, 0), head=(0, -1, 0), fx='raise'),
        'cast_release': dict(g=(-4, 0, -4), br=-1, head=(-3, 0, -8), fx='release'),
        'leap': dict(g=(-2, -8, -3), br=-2, back=(0, -1, 8), air=True),
        'buff': dict(g=(0, 0, 0), br=-3, back=(0, -2, 12), head=(0, -1, 0), fx='buff'),
        'finisher': dict(g=(-6, 0, -7), br=-3, head=(-5, 0, -14), back=(1, -2, -10), fx='finisher'),
    },
)

if __name__ == '__main__':
    Poser(S).sheet()

