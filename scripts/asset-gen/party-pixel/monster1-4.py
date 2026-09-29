"""monster1-4 해골병(파티원) — 15칸 3×5, 셀 48. 몸은 걷기 칩 왼쪽 보기 가운데 칸 × 2(pp15_pp3 리그) 그대로.
대기는 칩과 같은 맨손. 싸울 때만 뼈 몽둥이를 꺼낸다(칩에는 무기가 없다 — 대기 실루엣을 칩과 같게 두려고).
시전 = 눈구멍의 보랏빛 혼불을 모아 뿜음, 도약 = 무릎을 접고 뛰어오름, 강화 = 재조립(뼈 조각이 몸으로 모임),
필살기 = 뼈 회오리(몽둥이를 크게 휘둘러 내려친 결정 자세). 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp3 import *  # noqa

CHIP, INDEX, CELL = 'monster1-4', 4, 48
PAL = dict(o='262626', k='060606', g='393939', s='5a5a5a', m='767676', n='9f9f9f', b='bdbdbd', c='d6d6d6', l='eaeaea',
           t='ffffff', e='ff5a3a', v='5b2d9e', p='a070ff', q='e6dcff')
LABELS = [('head', 0, 0, 23, 18), ('arm', 6, 19, 10, 23), ('leg_f', 0, 25, 11, 31), ('leg_b', 12, 25, 23, 31)]
PIV = {'head': (12, 18.5), 'arm': (9.5, 19), 'leg_f': (11, 25), 'leg_b': (13, 25), 'body': (13, 25)}
PAR = {'head': 'body', 'arm': 'body', 'body': 'root', 'leg_f': 'root', 'leg_b': 'root'}
ORDER = ['leg_b', 'body', 'leg_f', 'head', 'arm']
rig = Rig(INDEX, PAL, LABELS, PIV, PAR, ORDER, cell=CELL, own=('arm', 'leg_f', 'leg_b', 'head'),
          light={'b': 'c', 'c': 'l', 'l': 't', 'n': 'b', 's': 'm'}, shade={'t': 'l', 'l': 'c', 'c': 'b', 'b': 'n'})

HAND = (8, 23)
EYE = (9, 15)
POSE = {k: dict(v) for k, v in HUMANOID.items()}
POSE['hit'] = {'root': (2, 0, 0, -0.2), 'head': (1, 1, 0), 'arm': (0, 0, 50), 'leg_f': (0, 0, -6), 'leg_b': (0, 0, 5)}
POSE['cast_raise'] = {'root': (1, 0, 0, -0.14), 'arm': (0, 0, -95), 'leg_f': (0, 0, -4), 'leg_b': (0, 0, 3)}
POSE['buff'] = {'root': (0, 0, 0, -0.06), 'arm': (0, 0, -60), 'leg_f': (0, 0, -18), 'leg_b': (0, 0, 18)}
POSE['leap'] = {'root': (0, 0, 0, 0.12), 'arm': (0, 0, 70), 'leg_f': (-1, -4, -60), 'leg_b': (1, -3, 45)}
POSE['finisher'] = {'root': (0, 0, 0, 0.34), 'head': (-1, 1, 0), 'arm': (0, 0, -40), 'leg_f': (0, 0, -40), 'leg_b': (0, 0, 36)}
POSE['windup'] = {'root': (3, 0, 0, -0.16), 'arm': (0, 0, 100), 'leg_f': (0, 0, -10), 'leg_b': (0, 0, 8)}


def club(cv, a, b):
    """뼈 몽둥이: 2px 자루 + 양 끝 둥근 마디(3×3)."""
    stroke(cv, [a, b], 'l', w=2)
    for q in (a, b):
        x, y = round(q[0]), round(q[1])
        cv.box((x - 2, y - 2, x + 2, y + 2), 'o')
        cv.box((x - 1, y - 1, x + 1, y + 1), 'l')
        cv.dot(x - 1, y - 1, 't'); cv.dot(x + 1, y + 1, 'b')


def held(cv, pose, ln=9, turn=0):
    """손에 쥔 몽둥이. 팔 방향에서 turn 도 돌린 쪽으로 ln px 뻗는다(손 뒤로 2px)."""
    sh = rig.pt(pose, 'arm', PIV['arm']); hd = rig.pt(pose, 'arm', HAND)
    ux, uy = dirv(sh, hd)
    t = math.radians(turn)
    vx, vy = ux * math.cos(t) - uy * math.sin(t), ux * math.sin(t) + uy * math.cos(t)
    a = (hd[0] + vx * ln, hd[1] + vy * ln)
    club(cv, (hd[0] - vx * 2, hd[1] - vy * 2), a)
    return hd, a


def glow_eye(cv, pose, k='p'):
    e = rig.pt(pose, 'head', EYE)
    cv.dot(e[0], e[1], k); cv.dot(e[0] - 1, e[1], k)
    return e


def over_for(n):
    if n in ('idle_a', 'idle_b', 'idle_c'):
        return None
    if n == 'windup':
        return lambda cv, p: held(cv, p, 9, 0)
    if n == 'move':
        return lambda cv, p: held(cv, p, 9, 0)
    if n == 'attack':
        def f(cv, p):
            hd, tip = held(cv, p, 10, 0)
            arc(cv, hd[0], hd[1] - 2, 11, 110, 200, 'c', step=8)
            arc(cv, hd[0], hd[1] - 2, 12, 120, 190, 'n', step=8)
        return f
    if n == 'recover':
        return lambda cv, p: held(cv, p, 8, 0)
    if n == 'hit':
        def f(cv, p):
            held(cv, p, 8, 0)
            h = rig.pt(p, 'head', (7, 12))
            spark(cv, h[0] - 3, h[1] - 1, 2, 't', 'e')
        return f
    if n == 'cast_charge':
        def f(cv, p):
            e = glow_eye(cv, p, 'v')
            hd = rig.pt(p, 'arm', HAND)
            orb(cv, hd[0] - 2, hd[1] - 2, 2, 'v', 'p')
            for k, a in enumerate((30, 110, 190, 270)):
                t = math.radians(a)
                cv.dot(hd[0] - 2 + 5 * math.cos(t), hd[1] - 2 - 5 * math.sin(t), 'p' if k % 2 else 'v')
        return f
    if n == 'cast_raise':
        def f(cv, p):
            glow_eye(cv, p, 'p')
            hd = rig.pt(p, 'arm', HAND)
            orb(cv, hd[0] - 4, hd[1] + 1, 3, 'v', 'p', 'q')
            ring(cv, hd[0] - 4, hd[1] + 1, 6, 'v', step=45, a0=20)
        return f
    if n == 'cast_release':
        def f(cv, p):
            glow_eye(cv, p, 'q')
            hd = rig.pt(p, 'arm', HAND)
            y = round(hd[1])
            x0 = round(hd[0]) - 2
            for k, x in enumerate(range(x0, x0 - 13, -1)):
                w = min(3, 1 + k // 4)
                cv.line([(x, y - w // 2), (x, y + (w - 1) // 2 + (1 if w == 3 else 0))], 'p' if (k // 2) % 2 else 'v')
            orb(cv, x0 - 13, y, 3, 'v', 'p', 'q')
        return f
    if n == 'leap':
        return lambda cv, p: held(cv, p, 9, -40)
    if n == 'buff':
        def f(cv, p):
            glow_eye(cv, p, 'e')
            c = rig.pt(p, 'body', (13, 21))
            for (dx, dy, a) in ((-13, -6, 35), (10, -8, -40), (11, 3, 80), (-12, 6, -15)):
                q = (c[0] + dx, c[1] + dy)
                e1 = (q[0] + 2 * math.cos(math.radians(a)), q[1] + 2 * math.sin(math.radians(a)))
                e0 = (q[0] - 2 * math.cos(math.radians(a)), q[1] - 2 * math.sin(math.radians(a)))
                stroke(cv, [e0, e1], 'l')
                sx, sy = dirv(q, c)
                cv.dot(q[0] + sx * 4, q[1] + sy * 4, 'n'); cv.dot(q[0] + sx * 6, q[1] + sy * 6, 'm')
        return f
    if n == 'finisher':
        def f(cv, p):
            glow_eye(cv, p, 'e')
            hd, tip = held(cv, p, 11, 0)
            cx, cy = hd[0] + 6, hd[1] - 6
            arc(cv, cx, cy, 13, 95, 235, 'l', w=2, step=6)
            arc(cv, cx, cy, 15, 110, 225, 'c', step=6)
            arc(cv, cx, cy, 10, 140, 230, 'p', step=8)
            spark(cv, tip[0] - 2, tip[1] + 3, 3, 't', 'q')
        return f
    return None


def dead():
    """쓰러짐: 칩 몸 그대로 뒤로(오른쪽) 눕고, 팔다리 뼈는 곁에 흩어진다."""
    W = rig.W
    im = rig.render({'root': (0, 0, -90)}, hide=('arm', 'leg_f', 'leg_b'))
    b = im.getbbox()
    cv = Canvas(im, rig.pal)
    G = b[3] - 1
    for (x, y, a) in ((b[0] - 5, G - 1, 8), (b[0] - 2, G - 5, -40), (b[2] + 3, G - 1, 20)):
        e = (x + 3 * math.cos(math.radians(a)), y - 3 * math.sin(math.radians(a)))
        s_ = (x - 3 * math.cos(math.radians(a)), y + 3 * math.sin(math.radians(a)))
        stroke(cv, [s_, e], 'l')
        cv.dot(e[0], e[1], 't'); cv.dot(s_[0], s_[1], 'b')
    return im


def draw(n):
    if n == 'dead':
        return dead()
    return rig.render(POSE[n], over=over_for(n))


if __name__ == '__main__':
    build2(CHIP, CELL, {n: draw(n) for n in NAMES}, INDEX)

