"""96 칸 거룡(dragon·dragon-red·dragon-blue·dragon-bone) 공용 관절 뼈대.

옆에서 본 네발 용이 오른쪽(아군)을 본다: 굵은 엉덩이·가슴 몸통, S 자로 솟은 긴 목, 쐐기 머리(경첩 아래턱),
등에서 솟아 부채처럼 펴진 박쥐 날개 둘(먼 쪽은 어둡게), 뒷다리 허벅지 덩이 + 뒤꿈치, 앞발 갈고리, 땅을 휘감는 꼬리.
그리는 순서: 먼 날개 → 먼 다리 → 꼬리 → 몸통 → 가까운 날개 → 가까운 뒷다리 → 목·머리 → 가까운 앞발.

종마다 Look(색·뿔·뺨·뼈 여부·숨결 색)만 바꾼다. bone=True 이면 살 대신 갈비뼈·척추 마디·뼈 날개 + 찢긴 막.
포즈는 dict 하나(몸 중심 c·기울기 tilt·목 마디 neck·머리 각 ha·턱 jaw·날개 각·꼬리·발 자리)다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from PIL import Image

from pixel_lib import (Canvas, add, arc_trail, burst, chain, ellipse, glow, ik_side, lerp, polar, poly, puff, rnd,
                       slash, sparkle, speed_lines)

S = 96
G = S - 4
WHITE = (255, 252, 240)
MOUTH = (70, 16, 24)


@dataclass
class Look:
    ink: tuple
    scale: list      # 4 단 (그늘, 중간, 빛, 하이라이트)
    scale_far: list
    belly: list
    memb: list
    memb_far: list
    horn: list
    eye: tuple
    eye_hi: tuple
    breath: list     # 바깥 → 안 4색
    horns: str = "curved"   # curved · straight · crown
    cheek: str = "none"     # none · spikes · fins · beard
    bone: bool = False
    smoke: tuple = ((110, 104, 100), (160, 152, 144))


def union(*ms):
    out = np.zeros((S, S), bool)
    for m in ms:
        out |= np.array(m) > 0
    return out


def fill(cv, M, ramp):
    """외곽선 없이 세로 단면 명암만(몸통 위 배 비늘·목 앞 비늘처럼 안쪽 면)."""
    for x in range(S):
        col = M[:, x]
        y = 0
        while y < S:
            if not col[y]:
                y += 1
                continue
            y0 = y
            while y < S and col[y]:
                y += 1
            n = y - y0
            for i in range(n):
                c = ramp[2] if i == 0 else ramp[0] if i >= math.ceil(n * 0.6) else ramp[1]
                cv.rgb[y0 + i, x] = c
                cv.a[y0 + i, x] = True


def spike(cv, p, ang, h, w, ramp):
    cv.part(poly(cv.blank(), [polar(p, ang - 90, w), polar(p, ang, h), polar(p, ang + 90, w)]), ramp, gloss=False)


def spikes_along(cv, pts, widths, ramp, h=3.5, every=1):
    for i in range(0, len(pts) - 1, every):
        a, b = pts[i], pts[i + 1]
        d = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        n = d - 90 if math.sin(math.radians(d - 90)) <= 0 else d + 90
        m = lerp(a, b, 0.5)
        spike(cv, polar(m, n, (widths[i] + widths[i + 1]) / 4 - 0.5), n - 25, h, 1.6, ramp)


def beads(cv, pts, radii, ramp):
    """뼈 마디(척추·꼬리뼈): 점마다 외곽선 있는 둥근 뼈."""
    for p, r in zip(pts, radii):
        cv.part(ellipse(cv.blank(), p, r, r * 0.85), ramp, gloss=False)


def resample(pts, n):
    """꺾은선을 n 점으로 고르게 나눈다(뼈 마디 자리)."""
    seg = [math.dist(a, b) for a, b in zip(pts, pts[1:])]
    total = sum(seg)
    out = []
    for k in range(n):
        t = total * k / (n - 1)
        for i, s in enumerate(seg):
            if t <= s or i == len(seg) - 1:
                out.append(lerp(pts[i], pts[i + 1], min(1.0, t / (s or 1))))
                break
            t -= s
    return out


# ── 부위 ──────────────────────────────────────────────────────

def wing(cv, L, sh, ang, span, far=False):
    """어깨 → 팔뼈 → 손목, 손가락 뼈 넷을 부채처럼 펴고 사이를 오목한 막으로. 뼈 용은 막이 찢겼다."""
    k = 0.84 if far else 1.0
    wrist = polar(sh, ang, span * 0.42 * k)
    tips = [polar(wrist, ang + d, span * ln * k) for d, ln in ((-58, 0.6), (-18, 0.8), (24, 0.72), (68, 0.52))]
    root = polar(sh, ang + 140, span * 0.22)
    pts = [sh, wrist, tips[0]]
    seq = tips + [root]
    for a, b in zip(seq, seq[1:]):
        pts.append(lerp(lerp(a, b, 0.5), wrist, 0.24))
        pts.append(b)
    M = np.array(poly(cv.blank(), pts)) > 0
    if L.bone:  # 찢긴 막: 손가락 사이에 구멍과 너덜한 끝
        for a, b, r in ((tips[0], tips[1], 3.4), (tips[1], tips[2], 4.0), (tips[2], tips[3], 2.6)):
            M &= ~(np.array(ellipse(cv.blank(), lerp(lerp(a, b, 0.5), wrist, 0.45), r, r * 0.8)) > 0)
    memb = L.memb_far if far else L.memb
    cv.part(M, memb, gloss=False)
    ramp = L.scale_far if far else (L.horn if L.bone else L.scale)
    bone = ramp[1] if far else ramp[2]
    for f in tips:
        cv.line4([rnd(wrist), rnd(f)], bone)
    cv.part(chain([sh, lerp(sh, wrist, 0.5), wrist], [4.4, 3.4, 2.8]), ramp, gloss=False)
    if L.bone:
        beads(cv, [lerp(sh, wrist, 0.5), wrist], [2.0, 2.0], ramp)
    claw = polar(wrist, ang - 100, 3)
    cv.line4([rnd(wrist), rnd(claw)], L.horn[2] if not far else L.horn[0])
    return wrist, tips


def hind_leg(cv, L, hip, foot, far=False):
    ramp = L.scale_far if far else L.scale
    knee = add(hip, (7, 9))
    hock = add(foot, (-5, -8))
    toe = add(foot, (3, 0))
    if L.bone:
        b = L.horn if not far else L.scale_far
        cv.part(chain([hip, knee], [4.0, 3.2]), b, gloss=False)
        cv.part(chain([knee, hock, foot], [3.0, 2.6, 2.4]), b, gloss=False)
        beads(cv, [knee, hock], [2.6, 2.2], b)
    else:
        cv.part(ellipse(cv.blank(), add(hip, (1, 2)), 9.5, 9.0), ramp)  # 허벅지 덩이
        cv.part(chain([add(hip, (2, 4)), knee, hock], [9.0, 6.6, 4.6]), ramp, gloss=False)
        cv.part(chain([hock, foot], [4.6, 4.0]), ramp, gloss=False)
    cv.part(poly(cv.blank(), [add(foot, (-4, -3)), add(foot, (3, -3)), add(toe, (2, 0)), add(foot, (-4, 0))]), ramp,
            gloss=False)
    for dx in (0, 3, 6):
        p = add(foot, (dx - 1, -1))
        cv.line4([rnd(p), rnd(add(p, (2, 1)))], L.horn[2] if not far else L.horn[0])


def front_leg(cv, L, sh, hand, far=False, claw_open=False):
    ramp = L.scale_far if far else L.scale
    el = ik_side(sh, hand, 12.0, 13.0, forward=False)
    if L.bone:
        b = L.horn if not far else L.scale_far
        cv.part(chain([sh, el, hand], [3.4, 3.0, 2.6]), b, gloss=False)
        beads(cv, [el], [2.4], b)
    else:
        cv.part(ellipse(cv.blank(), sh, 5.6, 5.2), ramp)
        cv.part(chain([sh, el], [6.4, 5.0]), ramp, gloss=False)
        cv.part(chain([el, hand], [5.0, 4.0]), ramp, gloss=False)
    ang = math.degrees(math.atan2(hand[1] - el[1], hand[0] - el[0]))
    spread = (-45, -10, 25) if claw_open else (-20, 0, 20)
    for d in spread:
        a = polar(hand, ang + d, 2.5)
        cv.line4([rnd(a), rnd(polar(a, ang + d + 30, 3))], L.horn[2] if not far else L.horn[0])
    cv.part(ellipse(cv.blank(), hand, 2.6, 2.4), ramp, gloss=False)
    return hand


def tail(cv, L, root, lift):
    pts = [root, add(root, (-5, 7)), add(root, (-6, 16)), add(root, (1, 23 - lift)), add(root, (12, 25 - lift * 1.3))]
    widths = [10.0, 8.0, 6.0, 4.0, 2.0]
    if L.bone:
        p = resample(pts, 9)
        beads(cv, p, [3.6 - i * 0.3 for i in range(9)], L.horn)
        return pts
    cv.part(chain(pts, widths), L.scale, gloss=False)
    under = chain([add(q, (1, 2)) for q in pts], [w * 0.45 for w in widths])
    fill(cv, (np.array(under) > 0) & (np.array(chain(pts, widths)) > 0), L.belly)
    spikes_along(cv, pts, widths, L.horn, h=3.0)
    t, prev = pts[-1], pts[-2]
    a = math.degrees(math.atan2(t[1] - prev[1], t[0] - prev[0]))
    if L.cheek == "fins":  # 꼬리 지느러미
        cv.part(poly(cv.blank(), [polar(t, a - 70, 4), polar(t, a, 6), polar(t, a + 70, 3), polar(t, a + 180, 2)]), L.memb,
                gloss=False)
    else:  # 화살촉 꼬리 끝
        cv.part(poly(cv.blank(), [polar(t, a, 6), polar(t, a + 120, 3.6), polar(t, a + 180, 1), polar(t, a - 120, 3.6)]),
                L.horn, gloss=False)
    return pts


def torso(cv, L, r):
    hips, chest = ellipse(cv.blank(), r(-10, 2), 13, 11), ellipse(cv.blank(), r(8, -3), 11, 12)
    bridge = poly(cv.blank(), [r(-12, -8), r(8, -14), r(14, 4), r(-8, 12)])
    M = union(hips, chest, bridge)
    if L.bone:
        spine = [r(-20, 0), r(-10, -7), r(2, -10), r(14, -8)]
        # 갈비뼈 안쪽의 꺼진 혼불(어두운 보라 심장)
        glow(cv, r(4, 0), 4.0, [L.memb_far[1], L.breath[1], L.breath[2]])
        for x in (-4, 0, 4, 8, 12):
            cv.part(chain([r(x, -8), r(x + 4, -1), r(x + 2, 7)], [2.4, 2.0, 1.6]), L.horn, gloss=False)
        cv.part(ellipse(cv.blank(), r(-11, 2), 7, 5), L.horn, gloss=False)  # 골반
        cv.put(ellipse(cv.blank(), r(-11, 2), 2.6, 1.8), L.ink)
        beads(cv, resample(spine, 7), [3.0] * 7, L.horn)
        return M
    cv.part(M, L.scale)
    belly = M & (np.array(ellipse(cv.blank(), r(2, 9), 18, 9)) > 0)
    fill(cv, belly, L.belly)
    for y in (2, 6, 10):  # 배 비늘 판 홈
        cv.line([r(-6, y), r(14, y - 3)], L.belly[0])
    cv.put(belly & ~M, L.ink)
    for x, y in ((-16, -9), (-8, -13), (0, -15), (8, -15)):
        spike(cv, r(x, y + 1), -100, 4.4, 2.0, L.horn)
    # 비늘 결(어깨·엉덩이 반점)
    for p in (r(-12, -4), r(-8, -6), r(4, -8), r(8, -6)):
        cv.pixel(*rnd(p), L.scale[0])
    return M


def neck_head(cv, L, base, P):
    pts = [base]
    for d in P["neck"]:
        pts.append(add(pts[-1], d))
    widths = [11.0, 8.6, 7.4, 6.4]
    hc = add(pts[-1], (3, -1))
    if L.bone:
        beads(cv, resample(pts, 7), [3.6, 3.4, 3.2, 3.0, 2.8, 2.8, 2.6], L.horn)
    else:
        cv.part(chain(pts, widths), L.scale, gloss=False)
        front = chain([add(q, (2.2, 1.6)) for q in pts], [w * 0.5 for w in widths])
        fm = (np.array(front) > 0) & (np.array(chain(pts, widths)) > 0)
        fill(cv, fm, L.belly)
        spikes_along(cv, pts, widths, L.horn, h=3.4)
    J = head(cv, L, hc, P)
    J["neck"] = pts
    return J


def head(cv, L, hc, P):
    a = math.radians(P["ha"])
    ca, sa = math.cos(a), math.sin(a)

    k = 0.82  # 머리 크기(목·몸에 맞춘 비율)

    def h(dx, dy):
        dx, dy = dx * k, dy * k
        return (hc[0] + dx * ca - dy * sa, hc[1] + dx * sa + dy * ca)
    jaw = math.radians(P["jaw"])
    hinge = (-3.0, 3.0)

    def jw(dx, dy):
        x, y = dx - hinge[0], dy - hinge[1]
        return h(hinge[0] + x * math.cos(jaw) - y * math.sin(jaw), hinge[1] + x * math.sin(jaw) + y * math.cos(jaw))
    hr = L.horn
    far_horn = [h(-3, -4), h(-11, -7), h(-17, -6)] if L.horns != "straight" else [h(-3, -4), h(-12, -8), h(-20, -10)]
    cv.part(chain(far_horn, [2.8, 2.0, 1.0]), [hr[0], hr[0], hr[1], hr[1]], gloss=False)
    skull_ramp = L.horn if L.bone else L.scale
    # 입속(턱이 열리면 보임)
    if P["jaw"] > 4:
        cv.put(poly(cv.blank(), [h(-2, 2), h(18, 2), jw(16, 3), jw(-2, 4)]), MOUTH)
    # 아래턱
    jaw_pts = [jw(-5, 3), jw(16, 3), jw(15, 6), jw(5, 8), jw(-4, 7)]
    cv.part(poly(cv.blank(), jaw_pts), skull_ramp, gloss=False)
    if not L.bone:
        fill(cv, np.array(poly(cv.blank(), [jw(-3, 6), jw(14, 5), jw(13, 6), jw(5, 7), jw(-3, 7)])) > 0, L.belly)
    # 위 머리: 뒤통수 → 이마 → 긴 주둥이
    skull = [h(-7, -5), h(0, -7), h(6, -6), h(12, -4), h(18, -2), h(20, 1), h(18, 3), h(4, 3), h(-5, 4), h(-8, 0)]
    cv.part(poly(cv.blank(), skull), skull_ramp)
    # 이빨: 위 송곳니가 아래로, 아래 이빨이 위로
    for x in (6, 10, 15):
        cv.pixel(*rnd(h(x, 4)), WHITE)
    cv.line4([rnd(h(16, 3)), rnd(h(16, 5))], WHITE)
    if P["jaw"] > 4:
        for x in (8, 12):
            cv.pixel(*rnd(jw(x, 2)), WHITE)
    # 콧구멍·눈
    cv.pixel(*rnd(h(17, -1)), L.ink)
    e = h(6, -2)
    if L.bone:
        cv.put(ellipse(cv.blank(), e, 2.4, 1.8), L.ink)
        cv.put(ellipse(cv.blank(), h(13, 0), 1.2, 0.8), L.ink)
        if P.get("eye") not in ("shut", "x"):
            cv.pixel(*rnd(e), L.eye)
            cv.pixel(*rnd(add(e, (1, 0))), L.eye_hi)
        for x in (3, 7, 11, 15):
            cv.pixel(*rnd(jw(x, 2)), hr[3])
    elif P.get("eye") == "shut":
        cv.line([rnd(h(4, -2)), rnd(h(8, -1))], L.ink)
    elif P.get("eye") == "x":
        cv.line([rnd(h(5, -3)), rnd(h(7, -1))], L.ink)
        cv.line([rnd(h(7, -3)), rnd(h(5, -1))], L.ink)
    else:
        cv.line([rnd(h(3, -4)), rnd(h(9, -3))], L.ink)  # 찌푸린 눈두덩
        cv.pixel(*rnd(e), L.eye)
        cv.pixel(*rnd(h(7, -2)), L.eye_hi)
        cv.pixel(*rnd(h(6, -1)), L.ink)
    # 뺨 장식
    if L.cheek == "spikes":
        for dy, ln in ((0, 6), (3, 5)):
            spike(cv, h(-6, dy), 180 + P["ha"] + dy * 6, ln, 1.6, hr)
    elif L.cheek == "fins":
        cv.part(poly(cv.blank(), [h(-4, -1), h(-12, -4), h(-14, 1), h(-11, 5), h(-4, 4)]), L.memb, gloss=False)
        for dy in (-2, 1, 3):
            cv.line4([rnd(h(-5, dy * 0.5)), rnd(h(-12, dy))], L.memb[2])
    elif L.cheek == "beard":
        for dx, ln in ((-2, 5), (2, 6), (6, 4)):
            spike(cv, jw(dx, 7), 100, ln, 1.4, hr)
    # 가까운 뿔
    if L.horns == "straight":
        hp = [h(-1, -6), h(-9, -10), h(-17, -13), h(-23, -15)]
        cv.part(chain(hp, [3.4, 2.6, 1.6, 0.8]), hr)
    elif L.horns == "crown":
        hp = [h(-1, -6), h(-7, -12), h(-9, -18)]
        cv.part(chain(hp, [3.0, 2.0, 1.0]), hr)
        spike(cv, h(4, -6), -80 + P["ha"], 4, 1.2, hr)
    else:  # 뒤로 휘었다 끝이 위로 들린 뿔
        hp = [h(-1, -6), h(-9, -10), h(-16, -11), h(-20, -15), h(-20, -19)]
        cv.part(chain(hp, [3.6, 3.0, 2.2, 1.4, 0.8]), hr)
        cv.line4([rnd(hp[1]), rnd(add(hp[1], (0, 2)))], hr[0])
    return dict(head=hc, mouth=h(19, 3), eye=e, horn=hp[-1], throat=h(-2, 6))


# ── 효과 ──────────────────────────────────────────────────────

def cone(cv, mouth, ang, length, w0, w1, colors, seed=0):
    """입에서 뻗는 숨결 줄기: 바깥 → 안 색으로 겹쳐 좁아진다. 가장자리는 넘실거린다."""
    n = len(colors)
    for k, col in enumerate(colors):
        s = 1 - k / (n + 0.6)
        ln = length * (1 - k * 0.08)
        top, bot = [], []
        for i in range(13):
            t = i / 12
            c = polar(mouth, ang, ln * t)
            w = (w0 + (w1 - w0) * t) * s * (1 + 0.18 * math.sin(t * 9 + seed + k))
            top.append(polar(c, ang - 90, w))
            bot.append(polar(c, ang + 90, w * (1 + 0.12 * math.cos(t * 7 + seed))))
        cv.put(poly(cv.blank(), top + bot[::-1]), col)
        cv.put(ellipse(cv.blank(), polar(mouth, ang, ln), w1 * s * 0.9, w1 * s * 0.9), col)


def draw_dragon(L, P, name):
    cv = Canvas(S, L.ink)
    c, tilt = P["c"], math.radians(P["tilt"])

    def r(dx, dy):
        return (c[0] + dx * math.cos(tilt) - dy * math.sin(tilt), c[1] + dx * math.sin(tilt) + dy * math.cos(tilt))
    if name == "move":
        speed_lines(cv, 2, 16, (36, 48, 60, 72), L.scale[2])
    sh_w, sh_wf = r(2, -10), r(7, -11)
    wing(cv, L, sh_wf, P["wfar"], P["span"] * 0.92, far=True)
    hip_n, hip_f = r(-10, 4), r(-5, 2)
    sh_n, sh_f = r(11, 3), r(14, 1)
    hf = P["hind"]
    hind_leg(cv, L, hip_f, (hf[1][0], G - hf[1][1]), far=True)
    front_leg(cv, L, sh_f, P["front_far"], far=True)
    tail(cv, L, r(-20, 2), P["tail"])
    torso(cv, L, r)
    wing(cv, L, sh_w, P["wing"], P["span"])
    hind_leg(cv, L, hip_n, (hf[0][0], G - hf[0][1]))
    J = neck_head(cv, L, r(14, -8), P)
    J["hand"] = front_leg(cv, L, sh_n, P["front"], claw_open=P.get("claw_open", False))
    J["chest"] = r(10, -2)
    return cv, J


def effects(cv, L, J, name, P):
    br = L.breath
    m = J["mouth"]
    if name == "idle_c" or P.get("smoke"):
        puff(cv, add(m, (0, -4)), 2.4, list(L.smoke))  # 콧구멍에 붙은 콧김
    if name == "windup":
        glow(cv, J["throat"], 4.0, [br[0], br[1], br[2]])
        sparkle(cv, add(J["horn"], (1, -2)), WHITE, br[2])
        for d in (-30, 0, 30):
            sparkle(cv, polar(m, d - 20, 7), br[3], br[1])
    elif name == "attack":
        hd = J["hand"]
        for k in range(3):
            slash(cv, add(hd, (2 + k * 4, -12)), add(hd, (8 + k * 4, 8)), 3, 2.2, L.horn[2], WHITE)
        burst(cv, add(m, (5, 2)), 5.0, br[2], WHITE, spikes=7)
    elif name == "recover":
        ang = P.get("breath_ang", 6)
        cone(cv, add(m, (1, 0)), ang, S - m[0] + 8, 3.0, 17.0, br, seed=P.get("seed", 0))
        for t, rr in ((0.45, 3.0), (0.75, 3.6)):  # 줄기 위로 튀는 불덩이
            c0 = polar(m, ang, (S - m[0]) * t)
            glow(cv, add(c0, (0, -12 - rr)), rr, [br[0], br[1], br[2]])
            glow(cv, add(c0, (2, 13 + rr)), rr * 0.8, [br[0], br[1], br[2]])
        for p in ((-2, -14), (6, 16), (14, -12)):
            sparkle(cv, add(polar(m, ang, 24), p), WHITE, br[2])
    elif name == "hit":
        ch = J["chest"]
        burst(cv, add(ch, (8, -6)), 5.0, WHITE, br[3] if L.bone else (255, 236, 200), spikes=6)
        for dx, dy in ((14, -18), (18, -12), (12, -24)):
            cv.pixel(ch[0] + dx, ch[1] + dy, WHITE)
    return cv


def pose(name):
    P = dict(c=(40.0, 64.0), tilt=-6, neck=((5, -9), (3, -9), (5, -5)), ha=-4, jaw=0, wing=-118, wfar=-100, span=40.0,
             tail=0.0, hind=((34, 0), (42, 0)), front=(57, 90), front_far=(63, 89))
    if name == "idle_b":  # 날개를 내리치며 몸이 가라앉고 목을 숙인다
        P.update(c=(40.0, 66.0), neck=((5, -8), (4, -8), (5, -4)), ha=2, wing=-152, wfar=-134, tail=2.0, front=(57, 90))
    elif name == "idle_c":  # 날개를 치켜들고 턱을 벌려 콧김
        P.update(c=(40.0, 63.0), neck=((5, -9), (3, -10), (5, -6)), ha=-10, jaw=10, wing=-104, wfar=-88, tail=-1.0)
    elif name == "windup":  # 뒤로 몸을 세우며 고개를 젖히고 목에 불씨를 모은다
        P.update(c=(36.0, 62.0), tilt=-18, neck=((2, -10), (-2, -10), (2, -6)), ha=-26, jaw=28, wing=-96, wfar=-80,
                 span=42.0, tail=4.0, hind=((32, 0), (40, 0)), front=(56, 62), front_far=(60, 66), claw_open=True)
    elif name == "move":  # 날개를 뒤로 접고 땅을 박차 돌진
        P.update(c=(46.0, 64.0), tilt=8, neck=((7, -6), (6, -5), (6, -2)), ha=6, jaw=12, wing=-166, wfar=-156, span=36.0,
                 tail=-2.0, hind=((32, 2), (26, 0)), front=(66, 86), front_far=(72, 84))
    elif name == "attack":  # 머리를 낮춰 물어뜯으며 앞발 갈고리로 할퀸다
        P.update(c=(44.0, 64.0), tilt=6, neck=((8, -6), (7, -3), (6, 1)), ha=14, jaw=34, wing=-130, wfar=-112,
                 hind=((36, 0), (30, 0)), front=(74, 72), front_far=(68, 80), claw_open=True)
    elif name == "recover":  # 스킬 숨결: 고개를 앞으로 뻗어 아군 쪽으로 길게 뿜는다
        P.update(c=(38.0, 64.0), tilt=-4, neck=((6, -8), (6, -6), (6, -2)), ha=6, jaw=32, wing=-100, wfar=-84, span=42.0,
                 tail=3.0, front=(58, 88), front_far=(64, 86))
    elif name == "hit":  # 맞아서 뒤로 젖혀지고 날개가 구겨진다
        P.update(c=(36.0, 64.0), tilt=-20, neck=((0, -9), (-4, -7), (-3, -3)), ha=-36, jaw=16, eye="shut", wing=-176,
                 wfar=-164, span=32.0, tail=-2.0, hind=((32, 0), (38, 1)), front=(50, 84), front_far=(56, 82))
    elif name == "dead":  # 엎어져 목을 땅에 뉘고 날개를 늘어뜨렸다
        P.update(c=(42.0, 76.0), tilt=2, neck=((7, 3), (8, 2), (8, 1)), ha=10, jaw=10, eye="x", wing=-172, wfar=-160,
                 span=34.0, tail=-3.0, hind=((40, 0), (34, 0)), front=(64, 91), front_far=(68, 91))
    # 몸 전체를 왼쪽으로 옮겨 머리·숨결이 칸 안에 들게 한다
    dx = P.pop("dx", -7)
    P["c"] = (P["c"][0] + dx, P["c"][1])
    P["front"], P["front_far"] = (P["front"][0] + dx, P["front"][1]), (P["front_far"][0] + dx, P["front_far"][1])
    P["hind"] = tuple((x + dx, y) for x, y in P["hind"])
    return P


def draw(L, name, tweak=None):
    P = pose(name)
    if tweak:
        tweak(name, P)
    cv, J = draw_dragon(L, P, name)
    effects(cv, L, J, name, P)
    return cv.image()
