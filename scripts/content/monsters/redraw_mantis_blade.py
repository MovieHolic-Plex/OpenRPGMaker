#!/usr/bin/env python3
"""칼날 사마귀(mantis-blade) 전투 시트 3x3x64 + 초상 64 를 직접 도트로 다시 그린다.

계약(src/assets/pixelEnemySheets.ts 머리말):
  셀 64 정사각 3열x3행, 1:1 도트, 알파 0/255, 오른쪽(아군 쪽)을 본다, 바닥 기준선 y=60.
  칸 순서 idle_a idle_b idle_c / windup move attack / recover hit dead.

그림 방식: 포즈마다 관절 좌표(엉덩이·앞가슴·머리·낫 앞다리·걷는 다리 4개)를 새로 정하고
부위 마스크를 다각형으로 래스터화한 뒤, 부위별 외곽선 + 세로 단면 명암(위 빛·아래 그늘)을 칠한다.
비트맵 확대/추적/생성 이미지는 쓰지 않는다.

  python3 scripts/content/monsters/redraw_mantis_blade.py            # 시트·초상 저장 + 검사
  python3 scripts/content/monsters/redraw_mantis_blade.py --preview D # D 에 4배 시트·GIF 도 저장
"""
from __future__ import annotations

import hashlib
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SHEET = ROOT / "public/assets/generated/pixel-enemies/mantis-blade.png"
PORTRAIT = ROOT / "public/assets/generated/pixel-enemy-portraits/mantis-blade.png"
S = 64
GROUND = S - 4  # 60: 발이 닿는 마지막 행
POSES = ["idle_a", "idle_b", "idle_c", "windup", "move", "attack", "recover", "hit", "dead"]

# ── 팔레트 (≤32색) ─────────────────────────────────────────────
INK = (14, 30, 26)            # 몸 외곽선
INK_BLADE = (34, 44, 62)      # 칼날 외곽선
EMERALD = [(22, 74, 54), (38, 120, 72), (84, 172, 86), (172, 226, 118)]
EMERALD_FAR = [(16, 52, 42), (22, 74, 54), (38, 120, 72), (38, 120, 72)]
BELLY = (150, 198, 92)        # 배 아랫면 연두
WING = [(20, 70, 82), (34, 110, 112), (72, 156, 144), (150, 214, 190)]
STEEL = [(72, 88, 108), (150, 166, 182), (212, 224, 232), (255, 255, 255)]
GOLD, CRIMSON, PUPIL = (246, 196, 58), (206, 38, 48), (72, 10, 24)
MOUTH = (128, 34, 40)
ARC = (176, 236, 255)


def rnd(p):
    return (int(round(p[0])), int(round(p[1])))


def add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def polar(p, ang_deg, length):
    a = math.radians(ang_deg)
    return (p[0] + math.cos(a) * length, p[1] + math.sin(a) * length)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def blank():
    return Image.new("L", (S, S), 0)


def poly(m, pts):
    ImageDraw.Draw(m).polygon([rnd(p) for p in pts], fill=255)
    return m


def tapered(a, b, wa, wb, bulge=0.0, mid=0.5):
    """a→b 사이를 폭 wa→wb 로 잇는 다각형(중간 mid 지점에서 bulge 만큼 부풀림)."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    left, right = [], []
    for i in range(9):
        t = i / 8
        w = (wa + (wb - wa) * t) / 2 + bulge * max(0.0, 1 - abs(t - mid) / max(mid, 1 - mid))
        c = lerp(a, b, t)
        left.append((c[0] + nx * w, c[1] + ny * w))
        right.append((c[0] - nx * w, c[1] - ny * w))
    return left + right[::-1]


def limb(a, b, w):
    m = blank()
    d = ImageDraw.Draw(m)
    d.line([rnd(a), rnd(b)], fill=255, width=w)
    if w >= 3:
        r = w / 2 - 0.5
        for p in (a, b):
            d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=255)
    return m


def ik(hip, foot, l1, l2, up=True):
    """두 마디 다리: 무릎을 위로 꺾은 관절점."""
    dx, dy = foot[0] - hip[0], foot[1] - hip[1]
    d = min(math.hypot(dx, dy), l1 + l2 - 0.01)
    a = math.atan2(dy, dx)
    cos_k = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    k = math.acos(max(-1, min(1, cos_k)))
    s = -1 if up else 1
    # 무릎이 위쪽(화면 y 작음)에 오도록 부호를 고른다
    cand = [polar(hip, math.degrees(a + k), l1), polar(hip, math.degrees(a - k), l1)]
    cand.sort(key=lambda p: p[1])
    return cand[0] if s == -1 else cand[1]


class Canvas:
    def __init__(self):
        self.rgb = np.zeros((S, S, 3), np.uint8)
        self.a = np.zeros((S, S), bool)

    def put(self, mask, color):
        self.rgb[mask] = color
        self.a[mask] = True

    def pixel(self, x, y, color):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < S and 0 <= y < S:
            self.rgb[y, x] = color
            self.a[y, x] = True

    def line(self, pts, color):
        m = blank()
        ImageDraw.Draw(m).line([rnd(p) for p in pts], fill=255, width=1)
        self.put(np.array(m) > 0, color)

    def part(self, m, ramp, ink=INK, gloss=True, belly=None):
        """외곽선 링 → 세로 단면 명암. belly 가 있으면 두꺼운 단면의 맨 아래 한 줄을 배색."""
        M = np.array(m) > 0 if isinstance(m, Image.Image) else m
        if not M.any():
            return M
        ring = M.copy()
        ring[1:] |= M[:-1]
        ring[:-1] |= M[1:]
        ring[:, 1:] |= M[:, :-1]
        ring[:, :-1] |= M[:, 1:]
        self.put(ring & ~M, ink)
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
                    if n <= 2:
                        c = ramp[2] if i == 0 else ramp[1]
                    elif i == 0:
                        c = ramp[3] if gloss and n >= 4 and (x % 3) else ramp[2]
                    elif i >= math.ceil(n * 0.62):
                        c = belly if belly and i == n - 1 and n >= 5 else ramp[0]
                    else:
                        c = ramp[1]
                    self.rgb[y0 + i, x] = c
                    self.a[y0 + i, x] = True
        return M

    def image(self):
        out = np.zeros((S, S, 4), np.uint8)
        out[..., :3] = self.rgb
        out[..., 3] = np.where(self.a, 255, 0)
        return Image.fromarray(out, "RGBA")


# ── 부위 ─────────────────────────────────────────────────────

def blade_shape(knee, ang, length, curve, w0):
    """낫 날: knee 에서 ang 방향으로 뻗고 끝으로 갈수록 curve 도 만큼 휘며 가늘어진다.
    반환: 다각형, 날 쪽(오목한 안쪽) 선, 등 쪽 선."""
    steps = 12
    pts, edge, spine = [], [], []
    p = knee
    for i in range(steps + 1):
        t = i / steps
        a = ang + curve * t * t
        w = max(0.4, w0 * (1 - t) ** 0.8)
        nx, ny = -math.sin(math.radians(a)), math.cos(math.radians(a))
        side = 1 if curve >= 0 else -1  # 휘는 쪽이 칼날
        edge.append((p[0] + nx * w * side * 0.5, p[1] + ny * w * side * 0.5))
        spine.append((p[0] - nx * w * side * 0.5, p[1] - ny * w * side * 0.5))
        pts.append(p)
        p = polar(p, a, length / steps)
    return edge + spine[::-1], edge, spine


def draw_scythe(cv, shoulder, coxa_ang, fem_ang, blade_ang, blade_curve, far=False, gleam=True):
    ramp = EMERALD_FAR if far else EMERALD
    coxa_end = polar(shoulder, coxa_ang, 5)
    knee = polar(coxa_end, fem_ang, 13)
    # 넓은 앞다리 넓적다리(판갑) — 밑면 가시
    cv.part(limb(shoulder, coxa_end, 3), ramp)
    fem = poly(blank(), tapered(coxa_end, knee, 5.6, 3.6, bulge=0.9, mid=0.4))
    cv.part(fem, ramp)
    # 넓적다리 아래쪽 가시 3개
    dx, dy = knee[0] - coxa_end[0], knee[1] - coxa_end[1]
    n = math.hypot(dx, dy) or 1
    nx, ny = -dy / n, dx / n
    if ny < 0:
        nx, ny = -nx, -ny  # 아래쪽 법선
    for t in (0.3, 0.55, 0.8):
        c = lerp(coxa_end, knee, t)
        cv.pixel(c[0] + nx * 3, c[1] + ny * 3, STEEL[1] if far else STEEL[2])
    # 칼날 정강이
    shape, edge, spine = blade_shape(knee, blade_ang, 21, blade_curve, 5.2)
    bm = poly(blank(), shape)
    steel = [STEEL[0], STEEL[0], STEEL[1], STEEL[1]] if far else [STEEL[0], STEEL[1], STEEL[1], STEEL[2]]
    cv.part(bm, steel, ink=INK_BLADE, gloss=False)
    # 날 쪽 하이라이트 + 톱니
    edge_col = STEEL[2] if far else STEEL[3]
    for i, p in enumerate(edge[1:-1]):
        cv.pixel(p[0], p[1], STEEL[0] if (i % 3 == 2) else edge_col)
    for p in spine[2:-2:2]:
        cv.pixel(p[0], p[1], STEEL[0])
    # 무릎 마디
    cv.part(limb(knee, knee, 3), ramp)
    if gleam and not far:
        tip = edge[-3]
        cv.pixel(tip[0], tip[1], STEEL[3])
    return knee, edge


def draw_leg(cv, hip, foot, rise, out, far=False, spines=True):
    """곤충 걷는 다리: 넓적다리가 몸 밖으로 비스듬히 솟고(rise), 무릎에서 꺾여 정강이가 바닥으로 사선."""
    ramp = EMERALD_FAR if far else EMERALD
    knee = (hip[0] + (foot[0] - hip[0]) * out, hip[1] - rise)
    cv.part(limb(hip, knee, 2), ramp, gloss=False)
    cv.part(limb(knee, foot, 1), ramp, gloss=False)
    if spines:
        mid = lerp(knee, foot, 0.5)
        cv.pixel(mid[0] - 1 if foot[0] > knee[0] else mid[0] + 1, mid[1], ramp[2])
    # 발끝 갈고리
    cv.pixel(foot[0] + (1 if foot[0] >= hip[0] else -1), foot[1], ramp[1])
    return knee


def draw_abdomen(cv, hip, ang, length, belly_up=False):
    tip = polar(hip, ang, length)
    shape = tapered(hip, tip, 7.5, 1.6, bulge=1.6, mid=0.35)
    m = poly(blank(), shape)
    M = cv.part(m, EMERALD, belly=None if belly_up else BELLY)
    # 배 마디 줄무늬(축에 수직)
    ax, ay = math.cos(math.radians(ang)), math.sin(math.radians(ang))
    ys, xs = np.nonzero(M)
    for y, x in zip(ys, xs):
        proj = (x - hip[0]) * ax + (y - hip[1]) * ay
        if proj > 3 and int(proj) % 4 == 0:
            cv.rgb[y, x] = EMERALD[0]
    return tip


def draw_wings(cv, base, ang, length, lift=0.0, flare=False):
    """접힌 겉날개(시초). lift 만큼 끝이 들리고, flare 면 속날개가 부채꼴로 펴진다."""
    if flare:
        fan = [base]
        for k in range(6):
            fan.append(polar(base, ang + 12 + k * 12, length * 0.8))
        cv.part(poly(blank(), fan), [WING[0], WING[1], WING[2], WING[2]], ink=INK, gloss=False)
        for k in range(1, 5):
            cv.line([base, polar(base, ang + 12 + k * 12, length * 0.72)], WING[0])
    tip = polar(base, ang - lift, length)
    m = poly(blank(), tapered(base, tip, 5.0, 1.2, bulge=1.0, mid=0.4))
    M = cv.part(m, WING, ink=INK)
    # 날개맥: 축을 따라 밝은 줄 하나
    cv.line([polar(base, ang - lift, 3), polar(base, ang - lift - 3, length - 4)], WING[3])
    return tip


def draw_head(cv, neck_top, tilt, eye="open", jaw=0.0, antenna=0.0):
    """역삼각형 사마귀 머리. tilt=0 이면 입이 앞-아래를 향한다."""
    def r(dx, dy):
        a = math.radians(tilt)
        return (neck_top[0] + dx * math.cos(a) - dy * math.sin(a), neck_top[1] + dx * math.sin(a) + dy * math.cos(a))
    back_top, front_top, mouth = r(-3.5, -3.5), r(6.5, -4.5), r(5.0, 4.5)
    jaw_back = r(1.5, 2.5)
    m = poly(blank(), [r(-4, -1), back_top, r(1, -6), front_top, r(7.5, -1), mouth, jaw_back])
    cv.part(m, EMERALD)
    # 더듬이(가늘게 뒤로 휘어 넘김)
    base = r(3, -5.5)
    a1 = polar(base, -112 + tilt + antenna, 6)
    cv.line([base, a1, polar(a1, -160 + tilt + antenna * 1.5, 7)], INK)
    base2 = r(5, -5.5)
    a2 = polar(base2, -95 + tilt + antenna * 0.6, 6)
    cv.line([base2, a2, polar(a2, -150 + tilt + antenna, 6)], EMERALD[0])
    # 겹눈: 머리 위 앞모서리, 금빛 테두리 + 진홍 동공
    ex, ey = r(4.6, -3.0)
    ex, ey = int(round(ex)), int(round(ey))
    if eye == "x":
        for d in (-1, 0, 1):
            cv.pixel(ex + d, ey + d, CRIMSON)
            cv.pixel(ex + d, ey - d, CRIMSON)
    elif eye == "shut":
        for d in (-1, 0, 1):
            cv.pixel(ex + d, ey, INK)
        cv.pixel(ex - 1, ey - 1, GOLD)
    else:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                cv.pixel(ex + dx, ey + dy, GOLD)
        cv.pixel(ex + 1, ey + 1, CRIMSON)
        cv.pixel(ex, ey + 1, CRIMSON)
        cv.pixel(ex + 1, ey, PUPIL if eye != "glow" else CRIMSON)
        cv.pixel(ex - 1, ey - 1, STEEL[3])
        if eye == "glow":
            cv.pixel(ex + 2, ey, GOLD)
    # 먼 쪽 눈이 머리 뒤 윗선 너머로 살짝
    fx, fy = r(-1.5, -4.5)
    cv.pixel(fx, fy, GOLD)
    cv.pixel(fx + 1, fy, CRIMSON)
    # 큰턱
    j1 = polar(mouth, 90 + tilt - 30 - jaw * 25, 2.4)
    j2 = polar(mouth, 90 + tilt + 40 + jaw * 25, 2.4)
    cv.line([mouth, j1], MOUTH)
    cv.line([mouth, j2], STEEL[1])
    return (ex, ey)


def draw_arc(cv, center, r0, a0, a1, thick=2.5, color=ARC, core=STEEL[3]):
    """칼날이 지나간 초승달 궤적(외곽선 없음)."""
    outer, inner = [], []
    for i in range(17):
        t = i / 16
        a = a0 + (a1 - a0) * t
        w = thick * math.sin(math.pi * t) + 0.3
        outer.append(polar(center, a, r0 + w / 2))
        inner.append(polar(center, a, r0 - w / 2))
    m = np.array(poly(blank(), outer + inner[::-1])) > 0
    cv.put(m, color)
    core_pts = [polar(center, a0 + (a1 - a0) * (0.2 + 0.6 * i / 10), r0) for i in range(11)]
    cv.line(core_pts, core)

def slash(cv, a, b, bow, thick=3.0):
    """a→b 를 bow 만큼 휜 칼바람 한 줄기(가운데가 두껍고 양끝이 뾰족)."""
    mid = lerp(a, b, 0.5)
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    ctrl = (mid[0] - dy / n * bow, mid[1] + dx / n * bow)
    def q(t):
        u = 1 - t
        return (u * u * a[0] + 2 * u * t * ctrl[0] + t * t * b[0], u * u * a[1] + 2 * u * t * ctrl[1] + t * t * b[1])
    left, right, core = [], [], []
    for i in range(17):
        t = i / 16
        p, p2 = q(t), q(min(1, t + 0.01))
        tx, ty = p2[0] - p[0], p2[1] - p[1]
        m = math.hypot(tx, ty) or 1
        w = thick * math.sin(math.pi * t) / 2 + 0.2
        left.append((p[0] - ty / m * w, p[1] + tx / m * w))
        right.append((p[0] + ty / m * w, p[1] - tx / m * w))
        if 0.2 <= t <= 0.8:
            core.append(p)
    cv.put(np.array(poly(blank(), left + right[::-1])) > 0, ARC)
    cv.line(core, STEEL[3])



def sparkle(cv, p, big=False):
    x, y = rnd(p)
    cv.pixel(x, y, STEEL[3])
    for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        cv.pixel(x + d[0], y + d[1], ARC)
    if big:
        for d in ((2, 0), (-2, 0), (0, 2), (0, -2)):
            cv.pixel(x + d[0], y + d[1], ARC)


# ── 포즈 ─────────────────────────────────────────────────────
# hip: 가슴-배 연결점(걷는 다리가 붙는 곳). neck: 앞가슴 각도(도, -90=수직 위). 화면 좌표.
BASE = dict(
    hip=(22.0, 41.0), abd=166, abd_len=22, neck=-58, neck_len=17, head_tilt=0,
    near=(70, -42, 92, 70), far=(76, -50, 96, 66),  # (coxa, femur, blade, curve)
    feet=dict(mid_near=(44, 59), mid_far=(38, 59), hind_near=(3, 59), hind_far=(10, 59)),
    wing_lift=0, flare=False, eye="open", jaw=0.0, antenna=0.0,
)


def pose_params(name):
    p = dict(BASE)
    p["feet"] = dict(BASE["feet"])
    if name == "idle_a":
        pass
    elif name == "idle_b":  # 몸을 낮추며 앞으로 기울고 낫을 살짝 연다
        p.update(hip=(22.5, 42.0), neck=-54, head_tilt=4, near=(66, -34, 82, 62), far=(72, -42, 88, 60),
                 wing_lift=3, antenna=6, jaw=0.5)
    elif name == "idle_c":  # 몸을 세우며 낫을 모아 접는다
        p.update(hip=(21.5, 40.0), neck=-63, head_tilt=-4, near=(74, -50, 100, 76), far=(80, -56, 104, 72),
                 wing_lift=-2, antenna=-6)
    elif name == "windup":  # 뒤로 젖히며 두 낫을 머리 위로 높이 치켜든다
        p.update(hip=(19.0, 41.0), abd=170, neck=-78, neck_len=16, head_tilt=-10,
                 near=(10, -92, -50, 80), far=(30, -108, -78, 62), wing_lift=6, flare=True, eye="glow", jaw=1.0,
                 antenna=-14)
        p["feet"].update(mid_near=(40, 59), mid_far=(34, 59), hind_near=(2, 59), hind_far=(8, 59))
    elif name == "move":  # 수평으로 몸을 쭉 뻗어 돌진, 가까운 낫을 앞으로 휘둘러 낸다
        p.update(hip=(23.0, 43.0), abd=178, abd_len=21, neck=-22, neck_len=17, head_tilt=14,
                 near=(40, -6, 30, 62), far=(48, -64, 60, 64), wing_lift=4, eye="glow", jaw=1.0, antenna=18)
        p["feet"].update(mid_near=(50, 59), mid_far=(42, 59), hind_near=(2, 59), hind_far=(12, 59))
    elif name == "attack":  # X 자 교차 베기
        p.update(hip=(24.0, 42.0), abd=172, abd_len=21, neck=-40, neck_len=16, head_tilt=10,
                 near=(0, -6, 56, 40), far=(30, 20, -58, -40), wing_lift=5, flare=True, eye="glow", jaw=1.0,
                 antenna=10)
        p["feet"].update(mid_near=(48, 59), mid_far=(42, 59), hind_near=(4, 59), hind_far=(12, 59))
    elif name == "recover":  # 두 낫을 얼굴 앞에서 교차해 겨누는 기술 자세(칼날 번뜩임)
        p.update(hip=(21.0, 41.0), neck=-70, head_tilt=-6, near=(60, -70, 140, 50), far=(64, -38, -100, -56),
                 wing_lift=8, flare=True, eye="glow", antenna=-10)
    elif name == "hit":  # 맞고 뒤로 젖혀진다
        p.update(hip=(18.0, 42.0), abd=156, abd_len=21, neck=-104, neck_len=15, head_tilt=-34,
                 near=(40, 10, 70, 60), far=(10, -20, 30, 60), wing_lift=10, eye="shut", jaw=1.0,
                 antenna=-30)
        p["feet"].update(mid_near=(36, 59), mid_far=(30, 59), hind_near=(2, 59), hind_far=(9, 59))
    return p


def draw_standing(cv, P, name):
    hip = P["hip"]
    neck_top = polar(add(hip, (2, -2)), P["neck"], P["neck_len"])
    shoulder_far = lerp(add(hip, (2, -2)), neck_top, 0.72)
    shoulder_near = add(shoulder_far, (1, 1))
    f = P["feet"]
    # 먼 쪽: 다리 2개 → 먼 낫
    draw_leg(cv, add(hip, (-2, 2)), f["hind_far"], 5, 0.55, far=True)
    draw_leg(cv, add(hip, (3, 2)), f["mid_far"], 5, 0.5, far=True)
    far_knee, far_edge = draw_scythe(cv, shoulder_far, *P["far"], far=True)
    # 몸통
    draw_abdomen(cv, add(hip, (-1, 0)), P["abd"], P["abd_len"])
    draw_wings(cv, add(hip, (1, -4)), P["abd"] - 3, P["abd_len"] - 2, lift=P["wing_lift"], flare=P["flare"])
    thorax = poly(blank(), tapered(add(hip, (2, -1)), neck_top, 5.5, 3.0, bulge=1.2, mid=0.72))
    cv.part(thorax, EMERALD)
    # 앞가슴 등선 판갑 무늬
    cv.line([lerp(add(hip, (2, -1)), neck_top, 0.15), lerp(add(hip, (2, -1)), neck_top, 0.6)], EMERALD[2])
    draw_head(cv, add(neck_top, (0, -1)), P["head_tilt"], eye=P["eye"], jaw=P["jaw"], antenna=P["antenna"])
    # 가까운 쪽 다리 2개 → 가까운 낫
    draw_leg(cv, add(hip, (-3, 3)), f["hind_near"], 4, 0.6)
    draw_leg(cv, add(hip, (4, 3)), f["mid_near"], 4, 0.55)
    near_knee, near_edge = draw_scythe(cv, shoulder_near, *P["near"])
    return dict(near_knee=near_knee, far_knee=far_knee, near_edge=near_edge, far_edge=far_edge, neck=neck_top,
                shoulder=shoulder_near)


def draw_dead(cv):
    """배를 드러내고 옆으로 쓰러져, 걷는 다리를 허공에 오그리고 낫은 바닥에 접힌 모습."""
    hip = (26.0, 54.0)
    # 허공에 오그린 먼 쪽 다리와 먼 낫(위로 접혀 떨림이 멎은 모양)
    for a, k, b in (((22, 52), (18, 45), (13, 42)), ((29, 52), (31, 44), (36, 41))):
        cv.part(limb(a, k, 2), EMERALD_FAR, gloss=False)
        cv.part(limb(k, b, 1), EMERALD_FAR, gloss=False)
    draw_scythe(cv, (36, 51), -70, -20, 150, 40, far=True, gleam=False)
    draw_abdomen(cv, add(hip, (-1, 0)), 182, 21, belly_up=True)
    cv.part(poly(blank(), tapered((8, 50), (27, 49), 2.0, 4.0)), WING, gloss=False)
    thorax = poly(blank(), tapered(add(hip, (1, 0)), (41, 54), 5.2, 3.2, bulge=0.6))
    cv.part(thorax, EMERALD)
    draw_head(cv, (45, 53), 70, eye="x", jaw=1.0, antenna=50)
    for a, k, b in (((24, 53), (20, 47), (15, 46)), ((31, 54), (35, 48), (40, 47))):
        cv.part(limb(a, k, 2), EMERALD, gloss=False)
        cv.part(limb(k, b, 1), EMERALD, gloss=False)
    # 바닥에 힘없이 놓인 가까운 낫(날이 앞으로 누워 반짝임이 꺼짐)
    draw_scythe(cv, (38, 56), 10, 4, 170, -24, far=False, gleam=False)


def draw(name):
    cv = Canvas()
    if name == "dead":
        draw_dead(cv)
        return clamp(cv.image())
    P = pose_params(name)
    j = draw_standing(Canvas(), P, name)  # 관절 위치만 먼저 구한다
    # 칼날 궤적은 몸 뒤에 깔아 칼날 자체가 궤적 위에 또렷이 보이게 한다
    if name == "move":
        draw_arc(cv, j["shoulder"], 22, -40, 34, thick=3.0)
    elif name == "attack":
        slash(cv, (44, 16), (62, 52), -4, thick=3.6)
        slash(cv, (62, 16), (42, 54), 4, thick=3.2)
    j = draw_standing(cv, P, name)
    if name == "attack":
        sparkle(cv, (54, 35), big=True)
    elif name == "recover":
        sparkle(cv, add(j["near_knee"], (2, -3)), big=True)
    elif name == "windup":
        sparkle(cv, add(j["near_edge"][-2], (0, -1)))
    elif name == "hit":
        # 맞은 자리 충격 금(오른쪽 가슴)
        cx, cy = rnd(lerp(P["hip"], j["neck"], 0.5))
        for dx, dy in ((4, -1), (6, -3), (5, 1), (7, 2)):
            cv.pixel(cx + dx, cy + dy, STEEL[3])
    return clamp(cv.image())


def clamp(im):
    """여백 1px·바닥선 y=60 을 넘는 픽셀은 깎아낸다(안전장치, 정상 포즈에서는 아무것도 안 지운다)."""
    a = np.array(im)
    a[GROUND + 1:, :, 3] = 0
    a[0, :, 3] = 0
    a[:, 0, 3] = 0
    a[:, -1, 3] = 0
    return Image.fromarray(a, "RGBA")


def build():
    frames = [draw(n) for n in POSES]
    sheet = Image.new("RGBA", (S * 3, S * 3))
    hashes = set()
    for i, f in enumerate(frames):
        b = f.getbbox()
        assert b and b[0] > 0 and b[1] > 0 and b[2] < S and b[3] <= GROUND + 1, (POSES[i], b)
        hashes.add(hashlib.sha256(f.tobytes()).hexdigest())
        sheet.alpha_composite(f, (i % 3 * S, i // 3 * S))
    assert len(hashes) == 9, "duplicate pose"
    colors = {c for _, c in sheet.getcolors(S * S * 9) if c[3]}
    assert len(colors) <= 32, len(colors)
    assert set(sheet.getchannel("A").tobytes()) <= {0, 255}
    return frames, sheet, len(colors)


def preview(frames, sheet, out: Path):
    out.mkdir(parents=True, exist_ok=True)
    bg = (32, 40, 64, 255)

    def on_bg(im, k):
        b = Image.new("RGBA", im.size, bg)
        b.alpha_composite(im)
        return b.convert("RGB").resize((im.width * k, im.height * k), Image.Resampling.NEAREST)

    big = on_bg(sheet, 4)
    d = ImageDraw.Draw(big)
    for i, n in enumerate(POSES):
        x, y = i % 3 * S * 4, i // 3 * S * 4
        d.rectangle([x, y, x + S * 4 - 1, y + S * 4 - 1], outline=(70, 80, 110))
        d.line([x, y + GROUND * 4 + 4, x + S * 4 - 1, y + GROUND * 4 + 4], fill=(90, 70, 70))
        d.text((x + 4, y + 3), f"{i} {n}", fill=(230, 230, 210))
    big.save(out / "after_sheet_4x.png")
    on_bg(frames[0], 4).save(out / "after_portrait_4x.png")
    for tag, seq, dur in (("idle", [0, 1, 2, 1], [170] * 4), ("attack", [0, 3, 4, 5, 6, 0], [200, 320, 160, 380, 300, 260]),
                          ("cycle", [0, 1, 2, 1, 3, 4, 5, 6, 0, 7, 8], [170] * 4 + [320, 160, 380, 300, 200, 420, 1000])):
        imgs = [on_bg(frames[i], 4) for i in seq]
        imgs[0].save(out / f"after_{tag}.gif", save_all=True, append_images=imgs[1:], duration=dur, loop=0, disposal=2)


def main(argv):
    frames, sheet, ncol = build()
    sheet.save(SHEET)
    frames[0].save(PORTRAIT)
    for path, im in ((SHEET, sheet), (PORTRAIT, frames[0])):
        with Image.open(path) as r:
            assert r.convert("RGBA").tobytes() == im.tobytes()
    if "--preview" in argv:
        preview(frames, sheet, Path(argv[argv.index("--preview") + 1]))
    print(f"mantis-blade: 9 poses, {ncol} colors, sheet sha256 {hashlib.sha256(SHEET.read_bytes()).hexdigest()}")


if __name__ == "__main__":
    main(sys.argv[1:])
