"""animal-0 충견 — 48 셀. 걷기 칩(노란 코기): 주황 몸·흰 배와 주둥이·서 있는 큰 귀·짧은 다리. 왼쪽을 본다.
대기 = 숨쉬며 꼬리 흔들기, windup = 웅크려 놀이 자세, move = 공중 도약, attack = 입을 벌려 물기, hit = 캥 하고 젖혀짐, dead = 옆으로 널브러짐."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_lib import *  # noqa

CELL = 48
PAL = dict(o='3b2010', b='e8901a', l='ffb42a', s='c86412', d='9c4a10', w='fff3d6', c='dcc9a4', t='e8607a', h='ffde5a', k='24140c')


def foot(p, fp, front, far, lift):
    x, y = ipt(fp)
    p.box((x - 2, y, x + 1, y + 2), 'o')
    p.box((x - 1, y, x, y + 1), 'c' if far else 'w')


def pre(p, R):
    # 짧은 꼬리(뒤쪽): 굵은 술
    t0 = R.pt(-9.5, -1)
    ang = 200 + R.pose.get('tail', 0)
    t1 = ax(t0, ang, 4)
    tube(p, bez([(t0[0], t0[1], 2.2), (t1[0], t1[1], 1.8)]), 'l', 'o', 'b')
    e = ax(t1, ang, 1.5)
    dot(p, e[0], e[1], 'w')


def body_detail(p, R):
    def f(t):
        c1 = R.pt(1.5, 4.6)
        blob(t, c1[0], c1[1], 8.2, 3.0, R.tilt, edge=None, fn=lambda u, v, r, L: 'w' if L > -.25 else 'c')
        c2 = R.pt(8.2, 1.4)
        blob(t, c2[0], c2[1], 3.4, 4.6, R.tilt, edge=None, fn=lambda u, v, r, L: 'w' if L > -.3 else 'c')
        # 등의 어두운 안장 그림자
        c3 = R.pt(-1, -4.4)
        blob(t, c3[0], c3[1], 8, 1.8, R.tilt, edge=None, fn=lambda u, v, r, L: 's')
    layer(p, f)


def head(p, R):
    pose = R.pose
    hc = R.hpt(11.5, -3.6)
    ang = pose.get('hang', 0) + R.tilt * 0.6
    mouth = pose.get('mouth', 0)
    eye = pose.get('eye', 'o')
    # 먼 쪽 귀
    for far in (True, False):
        base = ax(hc, ang, -1.5 - (2 if far else 0), -4.5)
        tip = ax(base, ang - 12 + (10 if far else 0), -2.5 + (-1 if far else 0), -8)
        p.poly([ipt(ax(base, ang, -3.2)), ipt(tip), ipt(ax(base, ang, 2.6))], 's' if far else 'b', 'o')
        if not far:
            ti = ax(base, ang, -0.5, -1.8)
            p.poly([ipt(ax(base, ang, -1.4)), ipt(ax(ti, ang, 0, -4.5)), ipt(ax(base, ang, 1.2))], 'w')
        if far:
            pass
    blob(p, hc[0], hc[1], 5.4, 4.8, ang)
    # 주둥이(흰색)
    mz = ax(hc, ang, 5.4, 1.5)
    blob(p, mz[0], mz[1], 4.0, 2.7, ang, keys={'l': 'w', 'b': 'w', 's': 'c'})
    if mouth:
        jaw = ax(hc, ang + 14 + 8 * (mouth - 1), 6.0, 3.6)
        blob(p, jaw[0], jaw[1], 3.8, 1.8, ang + 12, keys={'l': 'w', 'b': 'c', 's': 'c'})
        m0 = ax(hc, ang, 4.5, 3.2)
        p.line([ipt(m0), ipt(ax(m0, ang + 10, 5.4, 0.8))], 'o')
        tg = ax(hc, ang + 20, 7.0, 3.8)
        p.box((int(tg[0]) - 1, int(tg[1]), int(tg[0]) + 1, int(tg[1]) + 1), 't')
    nose = ax(hc, ang, 9.2, 0.3)
    p.box((int(round(nose[0])) - 1, int(round(nose[1])) - 1, int(round(nose[0])), int(round(nose[1]))), 'k')
    # 눈
    ey = ax(hc, ang, 2.6, -1.0)
    ex, eyy = ipt(ey)
    if eye == 'x':
        eye_x(p, ex, eyy, 'k')
    elif eye == 'c':
        p.line([(ex - 1, eyy - 1), (ex + 1, eyy), (ex - 1, eyy + 1)], 'k')
    else:
        p.box((ex, eyy, ex + 1, eyy + 1), 'k')
        dot(p, ex, eyy, 'w') if False else None
    # 볼 하이라이트
    hh = ax(hc, ang, -1, -4.2)
    dot(p, hh[0], hh[1], 'h')


POSES = default_poses()
POSES['hit']['eye'] = 'c'
POSES['attack'].update(dx=0, hdx=3)
POSES['move'].update(dx=0, hdx=2)
SPEC = dict(
    cell=CELL, pal=PAL, cx=21, stand=7.0, hip=(0, 2.6), hip_fore=(6, 2.6), hip_rear=(-6, 2.6),
    leg_fore=(4.2, 4.2, 2.4, 1.8, 1.3), leg_hind=(4.2, 4.2, 2.9, 1.9, 1.3),
    foot_dx_fore=0, foot_dx_hind=0, far=('s', 'd'), near=('b', 's'),
    body=[(0, 0, 9.2, 5.4, 0), (4.6, 1, 5.8, 5.6, 0), (-5, 0.5, 5.6, 5.4, 0)],
    light_c=(0, 0), light_r=10, foot=foot, pre=pre, body_detail=body_detail, head=head, dead_pose=dict(flat=0.7, head_abs=(11, 6), hang=8), poses=POSES,
)

if __name__ == '__main__':
    run('animal-0', SPEC)
