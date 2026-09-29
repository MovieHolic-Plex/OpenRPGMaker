"""monster1-7 수인 전사(파티원) — 15칸 3×5, 셀 64. 몸은 걷기 칩 왼쪽 보기 가운데 칸 × 2(pp15_pp3 리그) 그대로
(칩 키 30px × 2 — 원래 큰 칩이라 64 칸). 뿔은 칩 모양 그대로 머리 부위에 붙어 함께 움직인다(새로 그리지 않는다).
큰 도끼(스킬 도끼 내려치기·회전 도끼)는 앞손에 쥔다. 시전 = 콧김·붉은 기운을 모음, 도약 = 대지 가르기로 뛰어올라 도끼를 머리 위로,
강화 = 광포(몸이 붉게 달아오름), 필살기 = 도끼를 땅까지 내려찍은 결정 자세 + 균열. 왼쪽을 본다."""
import math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp3 import *  # noqa

CHIP, INDEX, CELL = 'monster1-7', 7, 64
PAL = dict(o='1c1214', h='3b220a', H='5a4028', M='785f47', r='3b2b2b', e='c01830',
           s='d0663f', S='f6ac94', a='4a4a4a', A='6e6e6e', b='a1a1a1', B='d6d6d6',
           n='2d2849', t='216762', g='2a8a1e', G='64a84f')
FORCE = {'311800': 'h', '381f07': 'h', '3d240c': 'h', '41270f': 'h', '432a12': 'H', '4f361e': 'H', '5c422a': 'H', '5f462e': 'H',
         '614830': 'M', '755c44': 'M', '785f47': 'M', '231919': 'o', '3b2b2b': 'r', '463838': 'r', '453838': 'r', '534545': 'r',
         '7b0818': 'e', '272727': 'a', '010005': 'o', '000000': 'o', '1b3e4a': 'n', '2c2849': 'n', '40364f': 'n', '303858': 'n',
         '554857': 'A', '0d165b': 'n', '136022': 'g', '022f0c': 'o', '486470': 't', '8098a0': 'b', 'f6f6f6': 'B', 'bdbdbd': 'b',
         'eeabab': 'S', 'bd5a39': 's', 'e68352': 's'}
LABELS = [('head', 0, 0, 23, 14), ('arm_f', 5, 15, 8, 21), ('arm_b', 16, 15, 20, 21), ('leg_f', 0, 23, 11, 31), ('leg_b', 12, 23, 23, 31)]
PIV = {'head': (10, 14.5), 'arm_f': (8, 16), 'arm_b': (16, 16), 'leg_f': (11, 23), 'leg_b': (12, 23), 'body': (12, 23)}
PAR = {'head': 'body', 'arm_f': 'body', 'arm_b': 'body', 'body': 'root', 'leg_f': 'root', 'leg_b': 'root'}
ORDER = ['arm_b', 'leg_b', 'body', 'leg_f', 'head', 'arm_f']
rig = Rig(INDEX, PAL, LABELS, PIV, PAR, ORDER, cell=CELL, own=('arm_f', 'arm_b', 'leg_f', 'leg_b', 'head'), force=FORCE,
          light={'b': 'B', 'A': 'b', 'a': 'A', 'g': 'G', 'h': 'H', 'H': 'M', 's': 'S'},
          shade={'B': 'b', 'b': 'A', 'G': 'g', 'M': 'H'})
HAND = (7, 21)
NOSE = (4, 12)


def axe(cv, h, ang, ln=20, back=4, size=6, face='left'):
    """큰 도끼: 손 h 에서 ang 도(0 = 오른쪽, 90 = 위) 쪽으로 자루, 끝에 반달 날. face = 날이 향할 쪽(left·down·up)."""
    d = (math.cos(math.radians(ang)), -math.sin(math.radians(ang)))
    n1 = (math.cos(math.radians(ang + 90)), -math.sin(math.radians(ang + 90)))
    n2 = (-n1[0], -n1[1])
    key = {'left': lambda v: v[0], 'down': lambda v: -v[1], 'up': lambda v: v[1]}[face]
    nr = min((n1, n2), key=key)
    top = (h[0] + d[0] * ln, h[1] + d[1] * ln)
    bot = (h[0] - d[0] * back, h[1] - d[1] * back)
    stroke(cv, [bot, top], 'H', w=2)
    base = (top[0] - d[0] * 3, top[1] - d[1] * 3)
    pts = [base]
    for i in range(0, 13):
        t = math.radians(-80 + i * 160 / 12)
        u = math.cos(t) * size; v = math.sin(t) * size
        pts.append((base[0] + nr[0] * u + d[0] * v * 0.9, base[1] + nr[1] * u + d[1] * v * 0.9))
    cv.poly(pts, 'o')
    inner = [(base[0] + (x - base[0]) * 0.75, base[1] + (y - base[1]) * 0.75) for x, y in pts]
    cv.poly(inner, 'b')
    edge = pts[3:11]
    cv.line([(base[0] + (x - base[0]) * 0.8, base[1] + (y - base[1]) * 0.8) for x, y in edge], 'B')
    x, y = round(h[0]), round(h[1])
    return top, (base[0] + nr[0] * size, base[1] + nr[1] * size)


def heat(cv, x, y, k='s', k2='S'):
    cv.poly([(x - 2, y), (x + 2, y), (x, y - 5)], k)
    cv.dot(x, y - 2, k2)


# 팔 rot: 어깨 기준, 양수 = 손끝이 뒤(오른쪽) 위로 돌아감 = 쳐든다, 음수 = 앞으로 내뻗음.
POSE = {
    'idle_a': {},
    'idle_b': {'body': (0, 1, 0), 'arm_f': (0, 1, 0), 'arm_b': (0, 1, 0)},
    'idle_c': {'body': (0, 1, 0), 'head': (0, 1, 0), 'arm_f': (0, 1, 0), 'arm_b': (0, 1, 0)},
    'windup': {'root': (3, 0, 0, -0.14), 'arm_f': (0, 0, 150), 'arm_b': (0, 0, 20), 'leg_f': (0, 0, -10), 'leg_b': (0, 0, 8)},
    'move': {'root': (0, 0, 0, 0.26), 'arm_f': (0, 0, 40), 'arm_b': (0, 0, -20), 'leg_f': (0, 0, -26), 'leg_b': (0, 0, 22)},
    'attack': {'root': (0, 0, 0, 0.32), 'head': (-1, 1, 0), 'arm_f': (0, 0, -70), 'arm_b': (0, 0, -30), 'leg_f': (0, 0, -30), 'leg_b': (0, 0, 24)},
    'recover': {'root': (0, 0, 0, 0.1), 'arm_f': (0, 0, -20), 'leg_f': (0, 0, -12), 'leg_b': (0, 0, 8)},
    'hit': {'root': (3, 0, 0, -0.24), 'head': (2, 1, 0), 'arm_f': (0, 0, 50), 'arm_b': (0, 0, 30), 'leg_f': (0, 0, -6), 'leg_b': (0, 0, 5)},
    'cast_charge': {'root': (1, 0, 0, 0.1), 'body': (0, 1, 0), 'head': (-1, 2, 0), 'arm_f': (0, 0, 25), 'arm_b': (0, 0, 25), 'leg_f': (0, 0, -14), 'leg_b': (0, 0, 12)},
    'cast_raise': {'root': (1, 0, 0, -0.16), 'head': (1, -1, 0), 'arm_f': (0, 0, 165), 'arm_b': (0, 0, 60), 'leg_f': (0, 0, -8), 'leg_b': (0, 0, 8)},
    'cast_release': {'root': (0, 0, 0, 0.24), 'head': (-2, 1, 0), 'arm_f': (0, 0, -95), 'arm_b': (0, 0, -10), 'leg_f': (0, 0, -22), 'leg_b': (0, 0, 18)},
    'leap': {'root': (0, 0, 0, -0.1), 'arm_f': (0, 0, 175), 'arm_b': (0, 0, 70), 'leg_f': (-1, -4, -55), 'leg_b': (1, -3, 40)},
    'buff': {'root': (0, 0, 0, -0.08), 'head': (0, -1, 0), 'arm_f': (0, 0, 15), 'arm_b': (0, 0, 70), 'leg_f': (0, 0, -18), 'leg_b': (0, 0, 18)},
    'finisher': {'root': (0, 0, 0, 0.42), 'head': (-2, 2, 0), 'arm_f': (0, 0, -40), 'arm_b': (0, 0, -40), 'leg_f': (0, 0, -40), 'leg_b': (0, 0, 36)},
}
AXE = {  # 이름: (자루 각도 = 손→도끼머리, 자루 길이, 날 방향)
    'idle_a': (235, 13, 'left'), 'idle_b': (235, 13, 'left'), 'idle_c': (235, 13, 'left'), 'windup': (70, 16, 'up'),
    'move': (215, 15, 'left'), 'attack': (185, 18, 'down'), 'recover': (240, 13, 'left'), 'hit': (130, 14, 'left'),
    'cast_charge': (250, 11, 'left'), 'cast_raise': (115, 13, 'up'), 'cast_release': (180, 15, 'up'),
    'leap': (45, 18, 'up'), 'buff': (260, 12, 'left'), 'finisher': (205, 18, 'down'),
}


def over_for(n):
    def f(cv, p):
        h = rig.pt(p, 'arm_f', HAND)
        ang, ln, face = AXE[n]
        top, edge = axe(cv, h, ang, ln, 3, 7 if n in ('attack', 'finisher', 'leap') else 6, face)
        nose = rig.pt(p, 'head', NOSE)
        if n == 'attack':
            arc(cv, h[0] + 8, h[1] - 4, 24, 150, 220, 'B', step=5)
            arc(cv, h[0] + 8, h[1] - 4, 26, 160, 212, 'b', step=5)
        if n == 'hit':
            spark(cv, nose[0] - 3, nose[1] - 4, 2, 'B', 'S')
        if n == 'cast_charge':
            for (dx, dy) in ((-3, 1), (-6, 3), (-5, -1)):
                cv.dot(nose[0] + dx, nose[1] + dy, 'B')
            c = rig.pt(p, 'body', (12, 19))
            for a in (20, 90, 160, 230, 300):
                t = math.radians(a)
                cv.dot(c[0] + 16 * math.cos(t), c[1] - 16 * math.sin(t), 's')
        if n == 'cast_raise':
            orb(cv, top[0] - 2, top[1] - 7, 3, 's', 'S')
            ring(cv, top[0] - 2, top[1] - 7, 7, 's', step=45)
        if n == 'cast_release':
            y = round(edge[1])
            for k, x in enumerate(range(round(edge[0]) - 1, max(2, round(edge[0]) - 12), -1)):
                w = min(5, 1 + k // 3)
                cv.line([(x, y - w // 2), (x, y + w // 2)], 's' if (k // 2) % 2 else 'S')
        if n == 'buff':
            c = rig.pt(p, 'body', (12, 20))
            for (dx, dy) in ((-16, 10), (15, 8), (-18, -6), (17, -10), (-8, 16), (9, 16)):
                heat(cv, c[0] + dx, c[1] + dy)
            for (dx, dy) in ((-3, 1), (-6, 2)):
                cv.dot(nose[0] + dx, nose[1] + dy, 'B')
        if n == 'finisher':
            gx, gy = edge[0], max(top[1], edge[1]) + 2
            cv.line([(gx - 12, gy), (gx + 12, gy)], 'o', 3)
            cv.line([(gx - 11, gy), (gx + 11, gy)], 'M')
            for (a, l) in ((150, 10), (110, 8), (40, 9), (75, 7)):
                t = math.radians(a)
                cv.line([(gx, gy - 2), (gx + l * math.cos(t), gy - 2 - l * math.sin(t))], 'S')
            spark(cv, gx, gy - 4, 3, 'B', 'S')
    return f


def draw(n):
    if n == 'dead':
        # 뒤로 쓰러져 무릎이 접힌 채 눕는다(몸 길이 61px 을 그대로 누이면 칸보다 길다).
        im = rig.render({'root': (0, 0, -90), 'arm_f': (0, 0, -40), 'leg_f': (0, 0, -95), 'leg_b': (0, 0, -80)})
        cv = Canvas(im, rig.pal)
        b = im.getbbox()
        axe(cv, (b[0] + 16, b[3] - 3), 180, 9, 2, 5, 'up')
        return im
    rec = {'s': 's', 'S': 'S'}
    return rig.render(POSE[n], over=over_for(n), recolor=({'A': 's'} if n == 'buff' else None))


if __name__ == '__main__':
    parts_board(rig, QA / f'parts-{CHIP}.png')
    build2(CHIP, CELL, {n: draw(n) for n in NAMES}, INDEX, nudge={'dead': -2})

