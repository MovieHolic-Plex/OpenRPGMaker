"""animal-6 호랑이 — 64 셀. 걷기 칩(주황 몸·검은 줄무늬·흰 뺨과 배): 낮고 긴 몸에 큰 발.
대기 = 웅크린 채 꼬리 휘젓기, windup = 바닥에 붙어 엉덩이를 들썩(도약 전), move = 공중 도약,
attack = 송곳니로 물며 앞발톱 내려치기, hit = 몸을 비틀며 물러남, dead = 뻗음. 왼쪽을 본다."""
import math
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp_lib import *  # noqa

CELL = 64
PAL = dict(o='3a0e08', b='f0a020', l='ffd05a', s='c85c10', d='8a2c0c', w='fff4dc', c='e0c8a0', k='34100c', n='e8788a', y='f6e05a', t='e85a6e')


def foot(p, fp, front, far, lift):
    x, y = ipt(fp)
    p.box((x - 3, y, x + 2, y + 3), 'o')
    p.box((x - 2, y + 1, x + 1, y + 2), 'c' if far else 'w')
    if not far:
        for k in (-1, 1):
            dot(p, x + k - 1, y + 2, 'o')


def pre(p, R):
    # 긴 꼬리: 엉덩이에서 뒤로 S 자, 줄무늬 마디, 끝은 위로 말림
    t0 = R.pt(-14.2, -2.5)
    tl = R.pose.get('tail', 0)
    m = ax(t0, 184 + tl * 0.3, 5)
    e = ax(m, 226 + tl * 0.6, 7)
    e2 = ax(e, 262 + tl * 0.8, 5)
    pts = bez([(t0[0], t0[1], 2.6), (m[0], m[1], 2.3), (e[0], e[1], 2.0), (e2[0], e2[1], 1.6)], 28)
    tube(p, pts, 'b', 'o', 's')
    for i in range(3, len(pts), 6):
        x, y, r, *_ = pts[i]
        p.line([(x - 1, y - r), (x - 1, y + r)], 'k')
    x, y, r, *_ = pts[-1]
    blob(p, x, y, 2.0, 2.0, 0, keys={'l': 'k', 'b': 'k', 's': 'k'})


def body_detail(p, R):
    def f(t):
        c = R.pt(0.5, 7.0)
        blob(t, c[0], c[1], 13, 2.6, R.tilt, edge=None, fn=lambda u, v, r, L: 'w' if L > -.15 else 'c')
        c = R.pt(9.4, 2.6)
        blob(t, c[0], c[1], 3.4, 5.4, 0, edge=None, fn=lambda u, v, r, L: 'w' if L > -.2 else 'c')
        # 줄무늬: 등에서 옆구리로 흘러내리는 굵은 획(끝이 갈라짐)
        for i, x in enumerate((-12, -8.4, -4.8, -1.2, 2.4, 6)):
            a = R.pt(x, -8)
            b = R.pt(x + 1.0, -2 + (i % 2) * 1.4)
            c2 = R.pt(x - 0.4, 3.4 - (i % 3) * 0.8)
            t.line([ipt(a), ipt(b), ipt(c2)], 'k', 2 if i % 2 == 0 else 1)
        for x in (-13, 10):
            a = R.pt(x, 0)
            t.line([ipt(a), ipt(R.pt(x + 1.0, 4.4))], 'k')
    layer(p, f)


def head(p, R):
    def after(p, R, hc, ang):
        # 이마·뺨 줄무늬
        for k, dp in enumerate((-4.6, -3.4, -2.2)):
            q0 = ax(hc, ang, -1.2 + k * 1.4, dp)
            p.line([ipt(q0), ipt(ax(q0, ang, 0.4, 2.0))], 'k')
        for k in (0, 1, 2):
            q0 = ax(hc, ang, -5.4, -0.4 + k * 1.8)
            p.line([ipt(q0), ipt(ax(q0, ang, 3.0, 0.6))], 'k')
        # 뺨 갈기 흰 털
        ck = ax(hc, ang, -1.0, 4.2)
        blob(p, ck[0], ck[1], 4.6, 2.2, ang, edge=None, keys={'l': 'w', 'b': 'w', 's': 'c'})
        dot(p, *ax(hc, ang, 8.8, -1.2), 'w')
    std_head(p, R, dict(
        rest=(17.6, -3.6), skull=(6.8, 6.0), tk=0.6,
        ears=[(True, -4.4, -4.6, -128, 3.4, 2.4, 'd', None), (False, -3.2, -5.2, -100, 3.8, 2.8, 'b', 'w')],
        muzzle=(6.6, 1.8, 4.2, 3.2, {'l': 'w', 'b': 'w', 's': 'c'}),
        nose=(10.8, 0.2, 'n', 2), eye=(2.4, -1.8, 'y'), eyec='y', eyehi=None,
        jaw=(6.6, 4.4, 3.8, 1.8, {'l': 'w', 'b': 'c', 's': 'c'}), tongue='t', fang='w',
        after=after))


def post(p, R):
    if R.pose.get('claws') and (True, False) in R.fp:
        x, y = R.fp[(True, False)]
        x, y = int(round(x)), int(round(y))
        for k, oy in enumerate((-3, 0, 3)):
            p.line([(x + 3, y + oy + 1), (x + 6 + (k == 1), y + oy - (1 if k != 1 else 0))], 'w')


POSES = default_poses()
POSES['idle_a'].update(dy=0, hdy=1, hang=6, tail=0, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['idle_b'].update(dy=0, hdy=2, hang=10, tail=30, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['idle_c'].update(dy=1, hdy=2, hang=12, tail=-30, feet=[(3, 0), (-2, 0), (-3, 0), (2, 0)])
POSES['windup'].update(dx=-4, dy=5, tilt=7, hdx=-1, hdy=3, hang=18, tail=30, feet=[(4, 0), (-8, 0), (6, 0), (-6, 0)])
POSES['move'].update(dx=0, dy=-6, tilt=-4, hdx=3, hdy=0, hang=-2, mouth=1, tail=-10, feet=[(12, 4), (-12, 4), (7, 7), (-8, 7)])
POSES['attack'].update(dx=0, dy=-2, tilt=-8, hdx=1, hdy=2, hang=12, mouth=2, claws=True, tail=-40, feet=[(2, 0), (-5, 0), (8, 9), (-2, 0)])
POSES['recover'].update(dx=-3, tilt=-2, hdx=-1, hdy=0, hang=4, mouth=0, tail=14, feet=[(5, 0), (-3, 0), (0, 0), (-6, 1)])
POSES['hit'].update(dx=-4, dy=-1, tilt=-8, hdx=-3, hdy=-2, hang=-14, mouth=2, eye='c', tail=50, ears=1, feet=[(-1, 0), (-6, 0), (2, 1), (-7, 2)])
SPEC = dict(
    cell=CELL, pal=PAL, cx=32, stand=12, hip=(0, 3.4), hip_fore=(9.6, 3.4), hip_rear=(-10.5, 3.4),
    leg_fore=(6.8, 6.8, 3.8, 3.0, 2.4), leg_hind=(7.0, 7.0, 4.8, 3.2, 2.4),
    foot_dx_fore=0, foot_dx_hind=0, far=('s', 'd'), near=('b', 's'),
    body=[(0, 0, 14.2, 7.4, 0), (9.6, 0.8, 7.6, 7.2, 0), (-10, 0.8, 7.4, 7.4, 0)],
    light_c=(0, 0), light_r=15, foot=foot, pre=pre, body_detail=body_detail, head=head, post=post,
    out_k=0.55, dead_pose=dict(flat=0.7, head_abs=(20, 6), hang=10), poses=POSES,
)

if __name__ == '__main__':
    run('animal-6', SPEC)
