"""animal-3 양 — 48 셀. 걷기 칩(크림색 털뭉치·어두운 얼굴·굽은 검은 뿔): 털 구름 몸통, 짧고 어두운 다리.
대기 = 되새김하듯 고개 까딱, windup = 앞발 긁으며 머리를 낮춤, move = 뛰어오르는 돌진, attack = 뿔 박치기,
hit = 털이 눌리며 튕겨남, dead = 털 뭉치가 널브러짐. 왼쪽을 본다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_lib import *  # noqa

CELL = 48
PAL = dict(o='1e1a26', b='e6d6c4', l='fff8ee', s='b39d88', d='8a7562', f='5c5244', F='34291c', n='4a5a6c', N='222c38', e='f2e4a0')


def foot(p, fp, front, far, lift):
    x, y = ipt(fp)
    p.box((x - 2, y, x + 1, y + 2), 'o')
    p.box((x - 1, y, x, y + 1), 'F')


def pre(p, R):
    t0 = R.pt(-11, -1)
    tt = ax(t0, 200 + R.pose.get('tail', 0), 2.5)
    blob(p, tt[0], tt[1], 2.6, 2.3, 0, keys={'l': 'l', 'b': 'b', 's': 's'})


def wool(p, R):
    def f(t):
        rnd = [(-6, -3), (-2, -4.5), (3, -4), (7, -2), (-7, 1), (-3, 2.5), (2, 3), (6, 2.5), (0, 0), (-5, -0.5), (4, -0.5), (8, 0.5)]
        for i, (x, y) in enumerate(rnd):
            c = R.pt(x, y)
            t.d.arc((c[0] - 2.2, c[1] - 2, c[0] + 2.2, c[1] + 2), 200, 340, fill=t.pal['l'])
            dot(t, c[0] + 1.6, c[1] + 1.2, 's' if i % 2 else 'd')
    layer(p, f)


def head(p, R):
    pose = R.pose
    def before(p, R, hc, ang):
        # 굽은 뿔: 이마 뒤에서 뒤로 휘었다 앞으로 말린다
        for far in (True, False):
            r0 = ax(hc, ang, -1.4 - (1.6 if far else 0), -3.4 + (0.6 if far else 0))
            p1 = ax(r0, ang, -4.2, -2.0)
            p2 = ax(r0, ang, -5.4, 2.6)
            p3 = ax(r0, ang, -1.6, 4.4)
            pts = bez([(r0[0], r0[1], 1.9), (p1[0], p1[1], 1.9), (p2[0], p2[1], 1.5), (p3[0], p3[1], 0.9)], 16)
            tube(p, pts, 'N' if far else 'n', 'o', 'N' if not far else None)
    def after(p, R, hc, ang):
        # 이마 털 뭉치
        tf = ax(hc, ang, -0.2, -4.0)
        blob(p, tf[0], tf[1], 3.2, 2.4, ang, keys={'l': 'l', 'b': 'b', 's': 's'})
    std_head(p, R, dict(
        rest=(11.8, -2.4), skull=(4.6, 4.1), tk=0.5,
        ears=[(True, -2, -3.4, -160, 3.4, 1.2, 'F', None), (False, -1.6, -2.6, 170, 4.2, 1.5, 'f', None)],
        muzzle=(4.6, 1.5, 3.0, 2.6, {'l': 'f', 'b': 'f', 's': 'F'}),
        nose=(8.4, 0.6, 'o', 2), eye=(1.8, -1.2, 'e'), eyec='e', eyehi=None,
        jaw=(4.6, 3.2, 2.8, 1.4, {'l': 'f', 'b': 'F', 's': 'F'}), tongue='e',
        before=before, after=after))


def body_detail(p, R):
    wool(p, R)


POSES = default_poses()
POSES['idle_a'].update(tail=0)
POSES['idle_b'].update(hdy=2, hang=8, tail=10)
POSES['idle_c'].update(hdy=3, hang=12, tail=-8, dy=1)
POSES['windup'].update(dx=-3, dy=2, tilt=6, hdx=-1, hdy=3, hang=24, feet=[(4, 4), (-4, 0), (1, 0), (-3, 0)])
POSES['move'].update(dx=0, dy=-5, tilt=-3, hdx=2, hdy=0, hang=8, mouth=0, feet=[(7, 3), (-7, 3), (4, 5), (-4, 5)])
POSES['attack'].update(dx=0, dy=1, tilt=8, hdx=4, hdy=4, hang=32, mouth=0, feet=[(5, 0), (-4, 0), (2, 0), (-1, 0)])
POSES['recover'].update(dx=-2, tilt=-2, hdx=0, hdy=1, hang=6, mouth=0, feet=[(3, 0), (-2, 0), (0, 0), (-4, 1)])
POSES['hit'].update(dx=-3, dy=-1, tilt=-7, hdx=-2, hdy=-1, hang=-16, mouth=0, eye='c', feet=[(-1, 0), (-4, 0), (1, 1), (-5, 2)])
SPEC = dict(
    cell=CELL, pal=PAL, cx=21, stand=8.2, hip=(0, 4.6), hip_fore=(6, 4.6), hip_rear=(-6, 4.6),
    leg_fore=(3.8, 3.8, 1.2, 1.0, 0.9), leg_hind=(3.8, 3.8, 1.3, 1.1, 0.9),
    foot_dx_fore=0, foot_dx_hind=0, far=('F', 'F'), near=('F', 'f'),
    body=[(0, 0.5, 8.6, 7.2, 0), (-5.4, -0.8, 5.4, 6.4, 0), (5.4, -0.6, 5.4, 6.4, 0), (0, -3.8, 7.2, 5.0, 0), (-7, 2.6, 3.8, 4.4, 0), (7, 2.8, 3.8, 4.4, 0)],
    light_c=(0, 0), light_r=11, foot=foot, pre=pre, body_detail=body_detail, head=head,
    dead_pose=dict(flat=0.75, head_abs=(11, 5), hang=14), poses=POSES,
)

if __name__ == '__main__':
    run('animal-3', SPEC)
