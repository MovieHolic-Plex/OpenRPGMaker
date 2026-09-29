"""animal-1 고양이 — 48 셀. 걷기 칩(갈색 줄무늬 고양이): 날씬한 몸·삼각 귀·긴 꼬리·수염. 왼쪽을 본다.
대기 = 꼬리 흔들기·눈 깜박임, windup = 바닥에 바짝 엎드려 노림, move = 공중 도약, attack = 뒷발로 서듯 앞발 후려치기(발톱), hit = 귀를 접고 움찔, dead = 뻗음."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_lib import *  # noqa

CELL = 48
PAL = dict(o='3a1226', b='c48a3c', l='f0b872', s='945a18', d='5e3512', w='fff0d8', p='e8788a', y='f4dc50', k='22101a')


def foot(p, fp, front, far, lift):
    x, y = ipt(fp)
    p.box((x - 2, y, x + 1, y + 2), 'o')
    p.box((x - 1, y, x, y + 1), 'b' if far else 'w')


def pre(p, R):
    t0 = R.pt(-7, -1.5)
    tl = R.pose.get('tail', 0)
    m = ax(t0, 188 + tl * 0.35, 6)
    e = ax(m, 236 + tl * 0.7, 8)
    e2 = ax(e, 268 + tl, 3)
    pts = bez([(t0[0], t0[1], 1.5), (m[0], m[1], 1.2), (e[0], e[1], 1.0), (e2[0], e2[1], 0.9)], 22)
    tube(p, pts, 'b', 'o', 's')
    for x, y, r, *_ in pts[-6:]:
        dot(p, x, y, 'd')


def body_detail(p, R):
    def f(t):
        c1 = R.pt(1.2, 3.4)
        blob(t, c1[0], c1[1], 6.6, 2.2, R.tilt, edge=None, fn=lambda u, v, r, L: 'w' if L > -.2 else 'l')
        for i, x in enumerate(range(-6, 8, 3)):
            a = R.pt(x, -5); b = R.pt(x + 0.8, 0.5 + (i % 2))
            t.line([ipt(a), ipt(b)], 'd' if i % 2 == 0 else 's')
        c2 = R.pt(5.4, 0)
        blob(t, c2[0], c2[1], 2.4, 3.0, R.tilt, edge=None, fn=lambda u, v, r, L: 'l' if L > -.1 else 'b')
    layer(p, f)


def head(p, R):
    pose = R.pose
    hc = R.hpt(9.4, -3.4)
    ang = pose.get('hang', 0) + R.tilt * 0.5
    mouth = pose.get('mouth', 0)
    eye = pose.get('eye', 'o')
    back = 1 if pose.get('ears') else 0
    # 귀: 크고 곧은 삼각형 둘(먼 쪽은 어둡게 살짝 뒤)
    for far in (True, False):
        base = ax(hc, ang, -0.6 - (2.6 if far else 0), -3.6 - (0.3 if far else 0))
        tip = ax(base, ang + back * 62, -0.4 - (1 if far else 0) - back * 3, -7.4 + back * 4.2)
        p.poly([ipt(ax(base, ang, -3.0)), ipt(tip), ipt(ax(base, ang, 3.0))], 'd' if far else 'b', 'o')
        if not far:
            ti = ax(base, ang + back * 50, -0.4 - back * 2, -5.0 + back * 2.4)
            p.poly([ipt(ax(base, ang, -1.2)), ipt(ti), ipt(ax(base, ang, 1.4))], 'p')
    blob(p, hc[0], hc[1], 5.4, 4.8, ang)
    mz = ax(hc, ang, 4.4, 1.6)
    blob(p, mz[0], mz[1], 2.6, 2.1, ang, keys={'l': 'w', 'b': 'w', 's': 'l'})
    if mouth:
        jaw = ax(hc, ang + 12, 4.2, 3.4)
        blob(p, jaw[0], jaw[1], 2.3, 1.3, ang + 12, keys={'l': 'w', 'b': 'l', 's': 'l'})
        m0 = ax(hc, ang, 3.4, 2.8)
        p.line([ipt(m0), ipt(ax(m0, ang + 12, 3.6, 0.5))], 'o')
        f0 = ax(hc, ang, 5.6, 2.4)
        dot(p, f0[0], f0[1], 'w')
    nose = ax(hc, ang, 6.6, 0.4)
    dot(p, nose[0], nose[1], 'p')
    ey = ax(hc, ang, 2.4, -1.0)
    ex, eyy = ipt(ey)
    if eye == 'x':
        eye_x(p, ex, eyy, 'k')
    elif eye == 'c':
        p.line([(ex - 1, eyy + 1), (ex + 1, eyy + 1)], 'k')
    else:
        p.box((ex, eyy, ex + 1, eyy + 1), 'y')
        dot(p, ex + 1, eyy, 'k'); dot(p, ex + 1, eyy + 1, 'k')
    for dp in (-2.4, 0.0):
        q = ax(hc, ang, 0.6 + dp * 0.6, -4.3)
        dot(p, q[0], q[1] + 1, 'd')


def post(p, R):
    if R.pose.get('claws') and (True, False) in R.fp:
        x, y = R.fp[(True, False)]
        x, y = int(round(x)), int(round(y))
        for k, oy in enumerate((-2, 0, 2)):
            p.line([(x + 2, y + oy), (x + 4 + (k == 1), y + oy - (1 if k != 1 else 0))], 'w')


POSES = default_poses()
POSES['idle_a'].update(tail=0)
POSES['idle_b'].update(tail=30, hdy=1, hang=3)
POSES['idle_c'].update(tail=-24, hdy=1, hang=5, eye='c', dy=1)
POSES['windup'].update(dx=-2, dy=3, tilt=6, hdx=-1, hdy=3, hang=16, tail=-10, ears=1,
                       feet=[(3, 0), (-3, 0), (1, 0), (-1, 0)])
POSES['move'].update(dx=0, dy=-5, tilt=-4, hdx=2, hdy=-1, hang=-4, tail=22, mouth=1,
                     feet=[(8, 2), (-8, 3), (5, 5), (-5, 5)])
POSES['attack'].update(dx=-1, dy=-2, tilt=-9, hdx=2, hdy=-1, hang=-4, tail=-20, mouth=2, claws=True, ears=1,
                       feet=[(1, 0), (-6, 0), (8, 7), (-3, 0)])
POSES['recover'].update(dx=-1, tilt=-1, hdx=0, hdy=0, hang=-2, tail=14, mouth=0,
                        feet=[(3, 0), (-2, 0), (-1, 0), (-3, 1)])
POSES['hit'].update(dx=-3, dy=-1, tilt=-6, hdx=-3, hdy=-1, hang=-12, tail=36, ears=1,
                    feet=[(-1, 0), (-4, 0), (0, 1), (-5, 2)])
SPEC = dict(
    cell=CELL, pal=PAL, cx=21, stand=7.6, hip=(0, 2.4), hip_fore=(4.6, 2.4), hip_rear=(-5.0, 2.4),
    leg_fore=(4.4, 4.4, 1.9, 1.5, 1.1), leg_hind=(4.4, 4.4, 2.4, 1.6, 1.1),
    foot_dx_fore=0, foot_dx_hind=0, far=('s', 'd'), near=('b', 's'),
    body=[(0, 0, 7.4, 4.2, 0), (4.2, 0.5, 4.5, 4.4, 0), (-4.0, 0.7, 4.5, 4.3, 0)],
    light_c=(0, 0), light_r=9, foot=foot, pre=pre, body_detail=body_detail, head=head, post=post,
    dead_pose=dict(flat=0.72, head_abs=(10, 5), hang=10), poses=POSES,
)

if __name__ == '__main__':
    run('animal-1', SPEC)
