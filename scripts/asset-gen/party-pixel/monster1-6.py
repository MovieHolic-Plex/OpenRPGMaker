"""monster1-6 사신(파티원) — 15칸 3×5, 셀 64(칩 키 24px × 2 = 48px 이라 48 칸에 안 든다). 몸은 걷기 칩 왼쪽 보기
가운데 칸 × 2(pp15_pp3 리그) 그대로, 바닥선 위로 떠 있다(motion float, dead 만 바닥).
큰 낫(칩에는 없다 — 스킬 낫 베기·죽음의 회전)은 싸울 때 뼈 손에 쥔다. 시전 = 푸른 영혼불을 모아 방출,
도약 = 높이 떠올라 낫을 뒤로, 강화 = 명계의 기운(보랏빛 불꽃), 필살기 = 낫을 앞으로 크게 긋는 X 베기. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp3 import *  # noqa

CHIP, INDEX, CELL = 'monster1-6', 6, 64
PAL = dict(o='210f33', k='000000', C='3e1651', E='571870', B='861099', D='a007bf', L='c64ae0',
           G='eaeaea', H='cbcbcb', K='aaaaaa', j='393939', I='1d73d6', c='8fdcff', w='ffffff')
FORCE = {'242424': 'j', '090909': 'k', '060606': 'k', '040404': 'k'}
LABELS = [('head', 0, 0, 23, 19), ('hem', 0, 26, 23, 31)]
PIV = {'head': (12, 19.5), 'body': (13, 26), 'hem': (13, 26)}
PAR = {'head': 'body', 'body': 'root', 'hem': 'body'}
ORDER = ['hem', 'body', 'head']
rig = Rig(INDEX, PAL, LABELS, PIV, PAR, ORDER, cell=CELL, own=('head', 'hem'), force=FORCE,
          light={'B': 'D', 'D': 'L', 'E': 'B', 'H': 'G'}, shade={'D': 'B', 'B': 'E', 'L': 'D'})
HAND = (8, 21)
EYE = (9, 16)


def grip(cv, h):
    x, y = round(h[0]), round(h[1])
    cv.box((x - 2, y - 1, x + 1, y + 2), 'o'); cv.box((x - 1, y, x, y + 1), 'G')


def scythe(cv, h, ang, ln=22, blade=12, back=5):
    """낫: 손 h 에서 ang 도(화면, 0 = 오른쪽, 90 = 위) 쪽으로 자루, 끝에서 앞쪽으로 휜 날."""
    d = (math.cos(math.radians(ang)), -math.sin(math.radians(ang)))
    nrm = (math.cos(math.radians(ang + 90)), -math.sin(math.radians(ang + 90)))
    top = (h[0] + d[0] * ln, h[1] + d[1] * ln)
    bot = (h[0] - d[0] * back, h[1] - d[1] * back)
    stroke(cv, [bot, top], 'E')
    pts = []
    for i in range(0, 11):
        t = i / 10
        pts.append((top[0] + nrm[0] * blade * t - d[0] * (t * t) * 6, top[1] + nrm[1] * blade * t - d[1] * (t * t) * 6))
    stroke(cv, pts, 'H', w=2)
    cv.line(pts[:-1], 'G')
    cv.dot(pts[-1][0], pts[-1][1], 'w')
    x, y = round(h[0]), round(h[1])
    cv.box((x - 2, y - 1, x + 1, y + 2), 'o'); cv.box((x - 1, y, x, y + 1), 'G')
    return top, pts[-1]


def soul(cv, x, y, r=2):
    orb(cv, x, y, r, 'I', 'c', 'w')


POSE = {
    'idle_a': {},
    'idle_b': {'body': (0, 0, 0), 'hem': (1, 0, 0), 'head': (0, 1, 0)},
    'idle_c': {'hem': (2, 0, 0), 'head': (0, 1, 0)},
    'windup': {'root': (3, 0, 0, -0.2), 'hem': (-2, 0, 0)},
    'move': {'root': (0, 0, 0, 0.3), 'hem': (4, -1, 0)},
    'attack': {'root': (0, 0, 0, 0.36), 'head': (-1, 1, 0), 'hem': (4, -1, 0)},
    'recover': {'root': (0, 0, 0, 0.1), 'hem': (2, 0, 0)},
    'hit': {'root': (3, 0, 0, -0.3), 'head': (2, 0, 0), 'hem': (-3, 0, 0)},
    'cast_charge': {'root': (0, 0, 0, -0.06), 'head': (0, 1, 0), 'hem': (1, 0, 0)},
    'cast_raise': {'root': (1, 0, 0, -0.16), 'head': (1, -1, 0), 'hem': (-2, 0, 0)},
    'cast_release': {'root': (0, 0, 0, 0.24), 'head': (-1, 0, 0), 'hem': (3, 0, 0)},
    'leap': {'root': (0, 0, 0, 0.18), 'hem': (5, -2, 0)},
    'buff': {'root': (0, 0, 0, -0.08), 'head': (0, -1, 0), 'hem': (0, 1, 0)},
    'finisher': {'root': (0, 0, 0, 0.42), 'head': (-2, 1, 0), 'hem': (5, -1, 0)},
}
HOVER = {'idle_a': 3, 'idle_b': 4, 'idle_c': 5, 'windup': 3, 'move': 4, 'attack': 2, 'recover': 3, 'hit': 4,
         'cast_charge': 3, 'cast_raise': 6, 'cast_release': 4, 'leap': 12, 'buff': 5, 'finisher': 2}


def over_for(n):
    def hand(p):
        return rig.pt(p, 'body', HAND)

    def eye(cv, p, k='c'):
        e = rig.pt(p, 'head', EYE)
        cv.dot(e[0], e[1], k)
    if n in ('idle_a', 'idle_b', 'idle_c'):
        return ('under', lambda cv, p: scythe(cv, rig.pt(p, 'body', (15, 21)), 80, 26, 13))
    if n == 'windup':
        return lambda cv, p: scythe(cv, hand(p), 125, 24, 11)
    if n == 'move':
        return lambda cv, p: scythe(cv, hand(p), 20, 22, 10)
    if n == 'attack':
        def f(cv, p):
            h = hand(p)
            scythe(cv, h, 200, 20, 11)
            arc(cv, h[0] + 2, h[1] - 4, 22, 120, 215, 'L', step=5)
            arc(cv, h[0] + 2, h[1] - 4, 20, 135, 205, 'G', step=5)
        return f
    if n == 'recover':
        return lambda cv, p: scythe(cv, hand(p), 250, 18, 10)
    if n == 'hit':
        def f(cv, p):
            scythe(cv, hand(p), 60, 22, 11)
            e = rig.pt(p, 'head', EYE)
            spark(cv, e[0] - 5, e[1] - 4, 2, 'w', 'c')
        return f
    if n == 'cast_charge':
        def f(cv, p):
            h = hand(p)
            eye(cv, p)
            soul(cv, h[0] - 6, h[1] + 2, 2)
            for a in (20, 140, 230, 320):
                t = math.radians(a)
                cv.dot(h[0] - 6 + 8 * math.cos(t), h[1] + 2 - 8 * math.sin(t), 'I')
        return f
    if n == 'cast_raise':
        def f(cv, p):
            h = hand(p)
            top, tip = scythe(cv, h, 100, 26, 12)
            eye(cv, p)
            soul(cv, tip[0] - 2, tip[1] - 5, 3)
            ring(cv, tip[0] - 2, tip[1] - 5, 7, 'I', step=40)
        return f
    if n == 'cast_release':
        def f(cv, p):
            h = hand(p)
            scythe(cv, h, 150, 20, 10)
            eye(cv, p, 'w')
            y = round(h[1]) - 1
            for k, x in enumerate(range(round(h[0]) - 4, round(h[0]) - 22, -1)):
                w = min(3, 1 + k // 5)
                cv.line([(x, y - w // 2), (x, y + w // 2)], 'c' if (k // 2) % 2 else 'I')
            soul(cv, round(h[0]) - 24, y, 3)
        return f
    if n == 'leap':
        return lambda cv, p: scythe(cv, hand(p), 150, 24, 12)
    if n == 'buff':
        def f(cv, p):
            h = hand(p)
            eye(cv, p, 'L')
            c = rig.pt(p, 'body', (13, 22))
            for (dx, dy, hgt) in ((-13, 8, 6), (12, 8, 7), (-15, -4, 4), (14, -6, 5), (0, 12, 4)):
                x, y = c[0] + dx, c[1] + dy
                cv.poly([(x - 2, y), (x + 2, y), (x, y - hgt)], 'D')
                cv.line([(x, y - 1), (x, y - hgt + 2)], 'L')
        return f
    if n == 'finisher':
        def f(cv, p):
            h = hand(p)
            top, tip = scythe(cv, h, 215, 22, 12)
            cx, cy = h[0] - 10, h[1] - 6
            cv.line([(cx - 9, cy - 12), (cx + 9, cy + 12)], 'L', 2)
            cv.line([(cx - 9, cy + 12), (cx + 9, cy - 12)], 'L', 2)
            cv.line([(cx - 8, cy - 11), (cx + 8, cy + 11)], 'G')
            cv.line([(cx - 8, cy + 11), (cx + 8, cy - 11)], 'G')
            spark(cv, cx, cy, 3, 'w', 'c')
            eye(cv, p, 'w')
        return f
    return None


def dead():
    """쓰러짐: 망토가 바닥에 주저앉아 납작해지고 낫이 곁에 떨어진다."""
    im = rig.render({'root': (0, 0, -90)})
    cv = Canvas(im, rig.pal)
    b = im.getbbox()
    scythe(cv, (b[0] + 2, b[3] - 2), 178, 11, 6, back=2)
    return im


BEHIND = {'cast_charge': (15, 21, 95, 24, 12), 'buff': (15, 21, 86, 26, 13)}


def draw(n):
    if n == 'dead':
        return dead()
    f = over_for(n)
    if isinstance(f, tuple):
        return rig.render(POSE[n], under=f[1])
    under = None
    if n in BEHIND:
        x, y, a, ln, bl = BEHIND[n]
        under = lambda cv, p: scythe(cv, rig.pt(p, 'body', (x, y)), a, ln, bl)
    return rig.render(POSE[n], under=under, over=f)


if __name__ == '__main__':
    build2(CHIP, CELL, {n: draw(n) for n in NAMES}, INDEX, airborne=(), hover=HOVER, nudge={'dead': -4})

