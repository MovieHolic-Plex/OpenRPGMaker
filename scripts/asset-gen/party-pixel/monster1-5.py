"""monster1-5 좀비(파티원) — 15칸 3×5, 셀 64(칩 키 25px × 2 = 50px 이라 48 칸에 안 든다). 몸은 걷기 칩 왼쪽 보기 가운데 칸 × 2(pp15_pp3 리그) 그대로.
다리는 칩처럼 곧게 선다(쪼그리지 않는다). 앞으로 내민 손(칩 그대로)으로 할퀴고 문다.
시전 = 썩은 숨(초록 독기)을 모아 입으로 뿜음, 도약 = 덮치기(두 팔을 뻗고 뛰어듦), 강화 = 불사(일어서며 초록 기운),
필살기 = 역병 할퀴기(몸을 던져 크게 할퀸 결정 자세). 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp3 import *  # noqa

CHIP, INDEX, CELL = 'monster1-5', 5, 64
PAL = dict(o='1a1a1a', k='0c0c0c', h='3e493f', a='5a6d5c', i='8eb192', G='78947b',   # 머리칼 어두움→밝음
           f='36b34e', g='5bcc70', j='7fe491', w='b6f5c0',                            # 피부
           r='0f2c66', u='0141c2', U='255db9',                                        # 윗옷
           d='2d2d2d', m='6d6d6d', e='965801', y='fccb88')
FORCE = {'5c705e': 'a', '526354': 'a', '363e37': 'h', '94a882': 'i', '12264f': 'r', '063aa1': 'u', '15461e': 'f',
         '393939': 'd', '3e3e3e': 'd', '353535': 'd', '202020': 'd', '272727': 'd', '363636': 'd', '444444': 'm',
         '979797': 'm', '18231b': 'o', '17331c': 'f', '133d1c': 'f'}
LABELS = [('head', 0, 0, 23, 17), ('arm', 15, 20, 18, 24), ('leg_f', 0, 25, 12, 31), ('leg_b', 13, 25, 23, 31)]
PIV = {'head': (11, 17.5), 'arm': (15, 20), 'leg_f': (12, 25), 'leg_b': (13, 25), 'body': (12, 25)}
PAR = {'head': 'body', 'arm': 'body', 'body': 'root', 'leg_f': 'root', 'leg_b': 'root'}
ORDER = ['leg_b', 'body', 'leg_f', 'head', 'arm']
rig = Rig(INDEX, PAL, LABELS, PIV, PAR, ORDER, cell=CELL, own=('arm', 'leg_f', 'leg_b', 'head'), force=FORCE,
          light={'g': 'j', 'j': 'w', 'f': 'g', 'u': 'U', 'r': 'u', 'a': 'G', 'G': 'i', 'd': 'm'},
          shade={'j': 'g', 'g': 'f', 'U': 'u', 'u': 'r', 'i': 'G', 'G': 'a'})

MOUTH = (8, 16)
HAND = (16, 24)


def claw_marks(cv, x, y, k1='w', k2='g', n=3, ln=7, slope=0.9):
    for i in range(n):
        x0 = x + i * 3
        cv.line([(x0, y), (x0 - ln * 0.5, y + ln * slope)], k2 if i % 2 else k1)


def miasma(cv, pts, big=False):
    for k, (x, y, r) in enumerate(pts):
        orb(cv, x, y, r, 'f', 'g' if k % 2 else 'j')


POSE = {
    'idle_a': {},
    'idle_b': {'body': (0, 1, 0), 'arm': (0, 1, 0), 'head': (0, 1, 0)},
    'idle_c': {'body': (0, 1, 0), 'arm': (0, 1, 0), 'head': (-1, 1, 0)},
    # 팔: 칩은 앞으로 내민 팔. rot 은 어깨(뒤쪽) 기준 — 음수 = 손끝이 위로, 양수 = 아래로.
    'windup': {'root': (3, 0, 0, -0.14), 'head': (1, 0, 0), 'arm': (3, -2, 150), 'leg_f': (0, 0, -8), 'leg_b': (0, 0, 8)},
    'move': {'root': (0, 0, 0, 0.3), 'head': (-1, 0, 0), 'arm': (-2, 0, 0), 'leg_f': (0, 0, -26), 'leg_b': (0, 0, 24)},
    'attack': {'root': (0, 0, 0, 0.36), 'head': (-2, 1, 0), 'arm': (-7, -2, -95), 'leg_f': (0, 0, -32), 'leg_b': (0, 0, 26)},
    'recover': {'root': (0, 0, 0, 0.12), 'arm': (-1, 0, 25), 'leg_f': (0, 0, -12), 'leg_b': (0, 0, 8)},
    'hit': {'root': (2, 0, 0, -0.26), 'head': (2, 1, 0), 'arm': (2, -1, -35), 'leg_f': (0, 0, -6), 'leg_b': (0, 0, 5)},
    'cast_charge': {'root': (1, 0, 0, -0.06), 'body': (0, 1, 0), 'head': (0, 1, 0), 'arm': (1, 0, 45), 'leg_f': (0, 0, -5), 'leg_b': (0, 0, 5)},
    'cast_raise': {'root': (1, 0, 0, -0.18), 'head': (1, -1, 0), 'arm': (1, -1, -70), 'leg_f': (0, 0, -3), 'leg_b': (0, 0, 3)},
    'cast_release': {'root': (0, 0, 0, 0.24), 'head': (-2, 1, 0), 'arm': (0, 1, 50), 'leg_f': (0, 0, -18), 'leg_b': (0, 0, 16)},
    'leap': {'root': (0, 0, 0, 0.42), 'head': (-1, 0, 0), 'arm': (-8, -4, -110), 'leg_f': (-1, -4, -20), 'leg_b': (2, -4, 60)},
    'buff': {'root': (0, 0, 0, -0.1), 'head': (0, -1, 0), 'arm': (1, -2, -150), 'leg_f': (0, 0, -14), 'leg_b': (0, 0, 14)},
    'finisher': {'root': (0, 0, 0, 0.44), 'head': (-2, 1, 0), 'arm': (-8, -3, -130), 'leg_f': (0, 0, -40), 'leg_b': (0, 0, 36)},
}


def over_for(n):
    if n == 'attack':
        def f(cv, p):
            h = rig.pt(p, 'arm', HAND)
            claw_marks(cv, h[0] - 7, h[1] - 6)
        return f
    if n == 'hit':
        def f(cv, p):
            h = rig.pt(p, 'head', (7, 11))
            spark(cv, h[0] - 3, h[1], 2, 'w', 'y')
        return f
    if n == 'cast_charge':
        def f(cv, p):
            m = rig.pt(p, 'head', MOUTH)
            miasma(cv, [(m[0] - 3, m[1] + 3, 1), (m[0] - 5, m[1] - 1, 1)])
            for a in (40, 150, 250):
                t = math.radians(a)
                cv.dot(m[0] - 4 + 7 * math.cos(t), m[1] + 1 - 7 * math.sin(t), 'g')
        return f
    if n == 'cast_raise':
        def f(cv, p):
            m = rig.pt(p, 'head', MOUTH)
            miasma(cv, [(m[0] - 4, m[1] - 5, 2), (m[0] + 2, m[1] - 10, 1), (m[0] - 8, m[1] - 9, 1)])
        return f
    if n == 'cast_release':
        def f(cv, p):
            m = rig.pt(p, 'head', MOUTH)
            miasma(cv, [(m[0] - 3, m[1], 1), (m[0] - 7, m[1] - 1, 2), (m[0] - 12, m[1] + 1, 3), (m[0] - 12, m[1] - 5, 1)])
        return f
    if n == 'buff':
        def f(cv, p):
            c = rig.pt(p, 'body', (12, 22))
            for (dx, dy) in ((-11, -8), (9, -12), (11, 2), (-10, 5), (0, -24)):
                spark(cv, c[0] + dx, c[1] + dy, 1, 'j', 'w')
            cv.dot(c[0] - 13, c[1] - 1, 'g'); cv.dot(c[0] + 13, c[1] - 6, 'g')
        return f
    if n == 'finisher':
        def f(cv, p):
            h = rig.pt(p, 'arm', HAND)
            claw_marks(cv, h[0] - 9, h[1] - 9, n=4, ln=14, slope=1.0)
            miasma(cv, [(h[0] - 4, h[1] + 5, 1), (h[0] + 3, h[1] - 9, 1)])
        return f
    return None


def dead():
    """쓰러짐: 뒤로(오른쪽) 벌렁 누워 손만 삐죽."""
    im = rig.render({'root': (0, 0, -90), 'arm': (0, 0, -60)})
    return im


def draw(n):
    if n == 'dead':
        return dead()
    return rig.render(POSE[n], over=over_for(n))


if __name__ == '__main__':
    parts_board(rig, QA / f'parts-{CHIP}.png')
    build2(CHIP, CELL, {n: draw(n) for n in NAMES}, INDEX, nudge={'dead': -6})

