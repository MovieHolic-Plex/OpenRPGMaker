"""animal-7 사자 — 64 셀. 걷기 칩(황갈색 몸·짙은 갈색 갈기·꼬리 술): 커다란 갈기가 머리를 두른다.
대기 = 갈기 나부낌·꼬리 술 흔들기, windup = 몸을 낮추고 갈기를 세움, move = 도약, attack = 포효하며 물어뜯기,
hit = 갈기가 눌리며 물러남, dead = 뻗음. 왼쪽을 본다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_lib import *  # noqa

CELL = 64
PAL = dict(o='34180a', b='d6a45e', l='f4c884', s='a8742e', d='7a4a18', m='7c4818', M='a86e2c', h='caa060', w='fff0d4', k='2a1408', n='c8606a', t='e8788a', e='f6e6b0')


def foot(p, fp, front, far, lift):
    x, y = ipt(fp)
    p.box((x - 3, y, x + 2, y + 3), 'o')
    p.box((x - 2, y + 1, x + 1, y + 2), 's' if far else 'l')


def pre(p, R):
    t0 = R.pt(-14.4, -2.2)
    tl = R.pose.get('tail', 0)
    m = ax(t0, 186 + tl * 0.3, 5)
    e = ax(m, 218 + tl * 0.6, 7)
    pts = bez([(t0[0], t0[1], 2.0), (m[0], m[1], 1.6), (e[0], e[1], 1.4)], 22)
    tube(p, pts, 'b', 'o', 's')
    # 꼬리 술
    x, y, r, *_ = pts[-1]
    blob(p, x - 1, y + 1, 3.6, 4.4, 20 + tl * 0.4, keys={'l': 'M', 'b': 'm', 's': 'd'})


def body_detail(p, R):
    def f(t):
        c = R.pt(0.5, 6.8)
        blob(t, c[0], c[1], 13, 2.6, R.tilt, edge=None, fn=lambda u, v, r, L: 'h' if L > -.15 else 's')
    layer(p, f)


def head(p, R):
    def before(p, R, hc, ang):
        # 갈기: 머리 뒤와 아래를 덮는 커다란 덩이 + 삐죽 털 끝
        wob = R.pose.get('mane', 0)
        for i, (d, perp, a, b) in enumerate(((-3.6, 0.5, 10.4, 9.8), (-1.4, 4.4, 8.6, 6.4), (-6.0, 4.6, 7.8, 8.0))):
            c = ax(hc, ang, d, perp)
            blob(p, c[0], c[1], a, b, ang, keys={'l': 'M', 'b': 'm', 's': 'd'})
        for k in range(14):
            a = 90 + 180 * k / 13 + 12 + wob * ((k % 3) - 1) * 6
            rad = 10.6 + (k % 2) * 1.6
            q0 = ax(hc, ang, -3.6, 0.5)
            q1 = (q0[0] + math.cos(math.radians(a)) * rad, q0[1] + math.sin(math.radians(a)) * rad)
            q2 = (q0[0] + math.cos(math.radians(a)) * (rad + 3.4), q0[1] + math.sin(math.radians(a)) * (rad + 3.4))
            if k % 2 == 0:
                p.line([ipt(q1), ipt(q2)], 'o')
                p.line([ipt(q1), ipt(ax(q1, a - 90 + 90, 0, 0))], 'm')
        # 앞 갈기 술 몇 가닥
    def after(p, R, hc, ang):
        # 이마 밝은 털 결과 코 위 주름
        for k in range(3):
            q = ax(hc, ang, 0.6 + k * 1.4, -4.6)
            dot(p, q[0], q[1], 'M')
    std_head(p, R, dict(
        rest=(17.8, -3.8), skull=(5.8, 5.2), tk=0.6,
        ears=[(False, -3.4, -4.7, -110, 2.4, 2.2, 'M', None)],
        muzzle=(6.0, 1.8, 4.4, 3.6, {'l': 'w', 'b': 'l', 's': 'b'}),
        nose=(10.2, 0.2, 'n', 2), eye=(2.2, -1.8, 'e'), eyec='k', eyehi=None,
        jaw=(6.2, 4.6, 4.0, 2.0, {'l': 'w', 'b': 'l', 's': 'b'}), tongue='t', fang='w',
        before=before, after=after))


POSES = default_poses()
POSES['idle_a'].update(dy=0, hdy=0, hang=4, tail=0, mane=0, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['idle_b'].update(dy=0, hdy=1, hang=6, tail=30, mane=1, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['idle_c'].update(dy=1, hdy=1, hang=8, tail=-30, mane=-1, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['windup'].update(dx=-4, dy=4, tilt=6, hdx=-1, hdy=3, hang=16, tail=30, mane=1, feet=[(4, 0), (-8, 0), (6, 0), (-6, 0)])
POSES['move'].update(dx=0, dy=-6, tilt=-4, hdx=3, hdy=0, hang=0, mouth=1, tail=-10, mane=-1, feet=[(12, 4), (-12, 4), (7, 7), (-8, 7)])
POSES['attack'].update(dx=0, dy=-1, tilt=-4, hdx=1, hdy=0, hang=-8, mouth=2, tail=-40, mane=1, feet=[(3, 0), (-5, 0), (6, 6), (-2, 0)])
POSES['recover'].update(dx=-3, tilt=-2, hdx=-1, hdy=0, hang=4, mouth=0, tail=14, mane=0, feet=[(5, 0), (-3, 0), (0, 0), (-6, 1)])
POSES['hit'].update(dx=-4, dy=-1, tilt=-8, hdx=-3, hdy=-2, hang=-14, mouth=2, eye='c', tail=50, mane=-1, feet=[(-1, 0), (-6, 0), (2, 1), (-7, 2)])
SPEC = dict(
    cell=CELL, pal=PAL, cx=30, stand=16.5, hip=(0, 3.4), hip_fore=(9, 3.4), hip_rear=(-9.8, 3.4),
    leg_fore=(8.8, 8.8, 3.4, 2.6, 2.1), leg_hind=(9.0, 9.0, 4.4, 2.9, 2.1),
    foot_dx_fore=0, foot_dx_hind=0, far=('s', 'd'), near=('b', 's'),
    body=[(0, 0, 13.0, 7.2, 0), (9.0, 0.8, 7.2, 7.0, 0), (-9.4, 0.8, 7.2, 7.2, 0)],
    light_c=(0, 0), light_r=15, foot=foot, pre=pre, body_detail=body_detail, head=head,
    out_k=0.55, dead_pose=dict(flat=0.7, head_abs=(20, 8), hang=10), poses=POSES,
)

if __name__ == '__main__':
    run('animal-7', SPEC)
