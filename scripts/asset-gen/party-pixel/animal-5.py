"""animal-5 군마 — 64 셀. 걷기 칩(갈색 말·검은 갈기와 꼬리·검은 발굽): 길고 곧은 다리, 아치 진 목.
대기 = 고개 끄덕·꼬리 털기, windup = 뒷걸음질 치며 웅크림, move = 질주 보폭, attack = 뒷발로 서서 앞발굽 내려찍기,
hit = 앞다리가 꺾이며 젖혀짐, dead = 옆으로 쓰러져 다리를 뻗음. 왼쪽을 본다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_lib import *  # noqa

CELL = 64
PAL = dict(o='2e1808', b='b88038', l='dcaa5c', s='8a5424', d='60340e', m='2c1a14', M='5a3626', k='241812', w='f6ead0', e='1a1010', n='d89880')


def foot(p, fp, front, far, lift):
    x, y = ipt(fp)
    p.box((x - 2, y, x + 1, y + 3), 'o')
    p.box((x - 1, y + 1, x, y + 2), 'k')
    if not far:
        dot(p, x - 1, y - 1, 'w')   # 흰 양말 한 뼘


def pre(p, R):
    # 꼬리: 엉덩이에서 뒤로 흩날리며 아래로 흐른다
    t0 = R.pt(-14.2, -4.0)
    sw = R.pose.get('tail', 0) * 0.12
    m = (t0[0] - 6, t0[1] + 3 - sw * 0.4)
    e = (m[0] - 3 + sw, m[1] + 12)
    e2 = (e[0] + 1 + sw * 0.5, e[1] + 5)
    pts = bez([(t0[0], t0[1], 2.4), (m[0], m[1], 3.0), (e[0], e[1], 2.4), (e2[0], e2[1], 1.0)], 22)
    tube(p, pts, 'm', 'o', 'M')


def body_detail(p, R):
    mane(p, R)
    def f(t):
        c = R.pt(0, 6.4)
        blob(t, c[0], c[1], 13, 2.4, R.tilt, edge=None, fn=lambda u, v, r, L: 'l' if L > -.1 else 'b')
        c = R.pt(-8, -1)
        blob(t, c[0], c[1], 5, 5, 0, edge=None, fn=lambda u, v, r, L: 'l' if L > .2 else None or 'b')
    layer(p, f)


def mane(p, R):
    # 갈기: 목 뒤 곡선(몸 위에 얹는다)
    nb = R.pt(7.5, -8.2)
    mid = R.pt(9.8, -13.5)
    top = R.pt(13.0 + R.pose.get('hdx', 0) * 0.5, -18.6 + R.pose.get('hdy', 0) * 0.5)
    pts = bez([(nb[0], nb[1], 1.7), (mid[0], mid[1], 2.4), (top[0], top[1], 1.7)], 16)
    tube(p, pts, 'm', 'o', 'M')


def head(p, R):
    def before(p, R, hc, ang):
        ff = ax(hc, ang, -2.0, -5.6)
        p.poly([ipt(ax(ff, ang, -2, 0)), ipt(ax(ff, ang, 1.5, 0)), ipt(ax(ff, ang, 3.6, 4.6))], 'm', 'o')
    std_head(p, R, dict(
        rest=(17.5, -14.6), skull=(5.6, 4.9), tk=0.35,
        ears=[(True, -3.6, -3.6, -100, 4.4, 1.5, 'd', None), (False, -2.4, -4.0, -86, 4.8, 1.9, 'b', 'n')],
        muzzle=(7.4, 1.8, 6.0, 3.4, {'l': 'l', 'b': 'b', 's': 's'}),
        nose=(13.2, 1.4, 'k', 2), eye=(1.6, -1.4, 'e'), eyec='e', eyehi='w',
        jaw=(6.8, 3.8, 4.6, 1.6, {'l': 'b', 'b': 's', 's': 's'}), tongue='n', fang='w',
        before=before))


POSES = default_poses()
POSES['idle_a'].update(dy=0, hdy=0, hdx=0, hang=44, tail=0, feet=[(2, 0), (-2, 0), (-2, 0), (2, 0)])
POSES['idle_b'].update(dy=0, hdy=1, hdx=0, hang=46, tail=20, feet=[(2, 0), (-2, 0), (-2, 0), (2, 0)])
POSES['idle_c'].update(dy=1, hdy=2, hdx=-1, hang=50, tail=-16, feet=[(2, 0), (-2, 0), (-2, 0), (2, 0)])
POSES['windup'].update(dx=-4, dy=3, tilt=-6, hdx=-3, hdy=2, hang=52, tail=30, feet=[(5, 0), (-8, 0), (-2, 0), (-3, 0)])
POSES['move'].update(dx=0, dy=-5, tilt=-3, hdx=3, hdy=1, hang=38, mouth=0, tail=-30, feet=[(14, 4), (-14, 4), (8, 8), (-8, 8)])
POSES['attack'].update(dx=-2, dy=1, tilt=-24, hdx=0, hdy=2, hang=52, mouth=2, tail=50, feet=[(11, 15), (-6, 0), (7, 13), (-3, 0)])
POSES['recover'].update(dx=-3, tilt=-2, hdx=-1, hdy=0, hang=46, mouth=0, tail=10, feet=[(4, 0), (-2, 0), (-1, 0), (-5, 1)])
POSES['hit'].update(dx=-4, dy=0, tilt=-10, hdx=-3, hdy=-2, hang=30, mouth=2, eye='c', tail=50, feet=[(2, 1), (-7, 0), (5, 3), (-8, 2)])
SPEC = dict(
    cell=CELL, pal=PAL, cx=30, stand=22, hip=(0, 4.0), hip_fore=(9.8, 4.0), hip_rear=(-10.5, 4.0),
    leg_fore=(11.5, 11.5, 3.4, 1.9, 1.5), leg_hind=(11.5, 11.5, 4.6, 2.2, 1.5),
    foot_dx_fore=0, foot_dx_hind=0, far=('d', 'm'), near=('b', 's'),
    body=[(0, 0, 14.6, 8.2, 0), (9.4, 0.4, 7.4, 8.0, 0), (-9.4, 0.4, 7.2, 8.4, 0), (12.6, -8.6, 9.6, 4.6, -62), (16.0, -12.2, 4.4, 4.2, -30)],
    light_c=(0, 0), light_r=16, foot=foot, pre=pre, body_detail=body_detail, post=None, head=head,
    out_k=0.45, dead_pose=dict(flat=0.62, head_abs=(18, 7), hang=18), poses=POSES,
)

if __name__ == '__main__':
    run('animal-5', SPEC)
