"""animal-4 젖소 — 64 셀. 걷기 칩(흰 바탕에 회색 얼룩·분홍 코·검은 발굽): 큰 몸통과 두툼한 머리, 작은 뿔, 젖통.
대기 = 되새김·꼬리 털기, windup = 앞발로 땅을 긁으며 머리를 낮춤, move = 육중한 돌진 보폭, attack = 뿔 들이받기,
hit = 되밀리며 음메 하고 젖혀짐, dead = 옆으로 쓰러져 발굽을 세움. 왼쪽을 본다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_lib import *  # noqa

CELL = 64
PAL = dict(o='2a1a14', b='e6e6ea', l='ffffff', s='b2b6c2', d='8a8ea0', p='6c6e7c', P='484a58', n='f0a894', N='c87466', h='f4e2a8', k='3a2a22', e='202028')


def foot(p, fp, front, far, lift):
    x, y = ipt(fp)
    p.box((x - 3, y, x + 2, y + 3), 'o')
    p.box((x - 2, y + 1, x + 1, y + 2), 'k')


def pre(p, R):
    # 꼬리: 엉덩이에서 아래로 드리운 줄, 끝에 검은 술
    t0 = R.pt(-15.6, -3.5)
    sw = R.pose.get('tail', 0) * 0.16
    t1 = (t0[0] - 3 + sw, t0[1] + 8)
    t2 = (t1[0] - 1 + sw * 0.6, t1[1] + 8)
    tube(p, bez([(t0[0], t0[1], 1.4), (t1[0], t1[1], 1.1), (t2[0], t2[1], 0.9)], 16), 'd', 'o', None)
    blob(p, t2[0], t2[1] + 2.5, 2.2, 3.4, 0, keys={'l': 'p', 'b': 'P', 's': 'e'})


def udder(p, R):
    u = R.pt(-7.5, 8.4)
    blob(p, u[0], u[1], 4.2, 3.0, 0, keys={'l': 'n', 'b': 'n', 's': 'N'})
    for k in (-1.4, 1.4):
        dot(p, u[0] + k, u[1] + 3.6, 'N')


def body_detail(p, R):
    def f(t):
        for cx, cy, a, b, ang in ((-6, -3.5, 6.5, 4.2, 12), (5.5, -4.6, 5.2, 3.6, -8), (-13.5, 2.5, 3.2, 4.6, 0), (11, 3, 3.0, 3.6, 0)):
            c = R.pt(cx, cy)
            blob(t, c[0], c[1], a, b, ang, edge=None, fn=lambda u, v, r, L: 'p' if L > -.2 else 'P')
        c = R.pt(0, 8.2)
        blob(t, c[0], c[1], 13, 2.4, R.tilt, edge=None, fn=lambda u, v, r, L: 'l' if L > -.1 else 's')
    layer(p, f)
    udder(p, R)


def head(p, R):
    def before(p, R, hc, ang):
        # 두툼한 목
        nb = R.pt(11.5, -1.5)
        tube(p, bez([(nb[0], nb[1], 6.4), ((nb[0] + hc[0]) / 2, (nb[1] + hc[1]) / 2 + 1.5, 5.8), (hc[0], hc[1], 5.4)], 14), 'b', 'o', 's')
        # 뿔: 두 쌍 중 가까운 쪽만 위로 살짝 굽음
        for far in (True, False):
            b0 = ax(hc, ang, -1.2 - (1.8 if far else 0), -5.8)
            b1 = ax(b0, ang, -0.4, -2.6)
            b2 = ax(b1, ang, 1.6, -1.2)
            tube(p, bez([(b0[0], b0[1], 1.2), (b1[0], b1[1], 1.0), (b2[0], b2[1], 0.5)], 8), 'h' if not far else 'd', 'o', None)
    def after(p, R, hc, ang):
        # 이마 얼룩 + 콧구멍 자리
        pa = ax(hc, ang, -1.0, -3.2)
        blob(p, pa[0], pa[1], 3.2, 2.4, ang, edge=None, keys={'l': 'p', 'b': 'p', 's': 'P'}) if False else None
    std_head(p, R, dict(
        rest=(20.5, -1.0), skull=(7.6, 6.6), tk=0.6,
        ears=[(True, -4.5, -1.5, -150, 5.8, 1.9, 'd', None), (False, -3.6, -0.5, 160, 6.4, 2.4, 'd', 'n')],
        muzzle=(7.4, 2.2, 5.2, 4.4, {'l': 'n', 'b': 'n', 's': 'N'}),
        nose=(11.4, 0.8, 'N', 2), eye=(2.4, -2.2, 'e'), eyec='e', eyehi=None,
        jaw=(7.8, 5.4, 4.6, 2.0, {'l': 'n', 'b': 'N', 's': 'N'}), tongue='N',
        before=before, after=after))


POSES = default_poses()
POSES['idle_a'].update(dy=0, hdy=0, hang=6, tail=0, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['idle_b'].update(dy=0, hdy=1, hang=10, tail=20, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['idle_c'].update(dy=1, hdy=2, hang=14, tail=-14, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['windup'].update(dx=-4, dy=2, tilt=4, hdx=-2, hdy=5, hang=30, tail=30, feet=[(6, 0), (-6, 0), (5, 9), (-4, 0)])
POSES['move'].update(dx=0, dy=-4, tilt=-2, hdx=2, hdy=2, hang=20, mouth=0, tail=-20, feet=[(11, 2), (-11, 2), (6, 6), (-6, 6)])
POSES['attack'].update(dx=2, dy=1, tilt=6, hdx=5, hdy=7, hang=36, mouth=0, tail=40, feet=[(8, 0), (-6, 0), (4, 0), (-2, 0)])
POSES['recover'].update(dx=-3, tilt=-2, hdx=-1, hdy=0, hang=8, mouth=0, tail=10, feet=[(5, 0), (-3, 0), (0, 0), (-6, 1)])
POSES['hit'].update(dx=-4, dy=-1, tilt=-8, hdx=-3, hdy=-3, hang=-8, mouth=2, eye='c', tail=50, feet=[(-1, 0), (-6, 0), (2, 1), (-7, 2)])
SPEC = dict(
    cell=CELL, pal=PAL, cx=30, stand=15.5, hip=(0, 4.2), hip_fore=(10.5, 4.2), hip_rear=(-10.5, 4.2),
    leg_fore=(8.2, 8.2, 3.0, 2.2, 1.8), leg_hind=(8.4, 8.4, 3.7, 2.4, 1.8),
    foot_dx_fore=0, foot_dx_hind=0, far=('d', 'p'), near=('b', 's'),
    body=[(0, 0, 15.2, 9.0, 0), (9.6, 0.8, 8.2, 9.0, 0), (-10, 0.8, 7.6, 8.8, 0)],
    light_c=(0, 0), light_r=17, foot=foot, pre=pre, body_detail=body_detail, head=head,
    dead_pose=dict(flat=0.72, head_abs=(20, 8), hang=14), poses=POSES,
)

if __name__ == '__main__':
    run('animal-4', SPEC)
