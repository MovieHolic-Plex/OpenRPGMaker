"""retro2003 로스터 b4(Monster2 8명) 스킬 이펙트 공용 모듈 — 좌표 기반 도트(PIL), 리샘플·블러·안티에일리어스 없음.

각 <key>.py 는 KEY, SIZE, FRAMES, ANCHOR, PAL, draw(c, f) 를 정의하고 `run(globals())` 를 부른다.
run() 은 src/assets/retroRosterSkills/b4.ts 의 그 키 레이어(anchor·frame·frames)와 스크립트가 다르면 멈춘다.
산출 public/assets/generated/pixel-fx/<key>.png (가로 스트립, 알파 0/255, 시트당 ≤16색), 확인판 .omo/r2w8/b4/fx/.
`python3 lib_r2w8.py [키...]` 는 b4 의 모든 시트를 다시 굽고 클래스별 확인판·가상 무대 합성판을 만든다.

셀 규약(retroClassSkills.ts 머리 주석이 정본):
  user/target/allTargets/allAllies  발 밑 = 행 SIZE-8, 몸 중심 = 셀 중심
  screen                            128px 셀이 무대 전체(fade_oval 필수)
  projectile                        32px 루프, 첫 칸이 **왼쪽**을 본다(아군이 오른쪽에서 왼쪽 적에게 쏜다)
색 규칙: 한 키는 한 색. 스킬마다 모양·색·움직임이 다르게 그리고, 같은 직업 8개가 서로 달라 보여야 한다.
"""
import importlib
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.dont_write_bytecode = True

import lib_scout  # noqa: E402
from lib_scout import Cel, pal, pick, pol, ease, lerp, rng, rgba, WHITE, board, check, OUT, ROOT, BG  # noqa: E402,F401
from fx_edge import fade_edges, fade_oval  # noqa: E402,F401

REVIEW = ROOT / '.omo/r2w8/b4/fx'
lib_scout.REVIEW = REVIEW
CONTRACT = ROOT / 'src/assets/retroRosterSkills/b4.ts'
CX, CY, FEET = 32, 34, 56   # 64px 셀: 몸 중심·발 밑


# ---------------------------------------------------------------- 색 계열 (한 키 = 한 색)
LEAFG = dict(g0='#12301c', g1='#2c7238', g2='#5cb04c', g3='#a4e07c', g4='#eeffd0')     # 하피 초록 깃
DOWN = dict(f0='#5a6470', f1='#a2acb8', f2='#dfe4ea', f3='#ffffff')                   # 흰 깃털
AIR = dict(a0='#1e5058', a1='#3e9088', a2='#84d4b8', a3='#ccfae4')                    # 바람
STONE = dict(s0='#141c30', s1='#2c4664', s2='#4c7896', s3='#88b4cc', s4='#d0e8f2')    # 가고일 청회색 돌
SAND = dict(n1='#7a5c34', n2='#b89a64', n3='#e6ce9c')                                 # 황갈색(가고일 배·골렘 점토 겸용)
BLOOD = dict(b0='#1e0410', b1='#5a0c26', b2='#a01430', b3='#e03048', b4='#ff9a94')    # 흡혈귀 핏빛
NIGHTV = dict(n0='#100818', n1='#2c1846', n2='#563088', n3='#9660c8', n4='#d8b4ff')   # 밤·박쥐 보라
BONEW = dict(w1='#b8b0bc', w2='#e8e2ea')                                              # 창백한 뼈/송곳니
DEMON = dict(d0='#180810', d1='#48101c', d2='#961c28', d3='#e04a3c', d4='#ffa878')    # 마기사 붉은 마검
BLADE = dict(k1='#4c4c60', k2='#9498b0', k3='#dcdff0')                                # 강철
CLAY = dict(c0='#2c1a10', c1='#6c4a2c', c2='#a8804e', c3='#d8b884', c4='#f4e2b8')     # 골렘 점토·흙
FIRE = dict(e0='#4a1010', e1='#b02c1c', e2='#f06a20', e3='#ffb840', e4='#fff4a0')     # 화염
DRAKE = dict(r0='#102a16', r1='#2a6a30', r2='#58b048')                                # 용 비늘 초록
VENOM = dict(v0='#1c2a10', v1='#4a7a1c', v2='#90c42c', v3='#d4f060')                  # 독
ICE = dict(i0='#182e5c', i1='#3468b0', i2='#66b8e8', i3='#b4ecfa', i4='#f2ffff')      # 서리
ONI = dict(o0='#200a12', o1='#701428', o2='#c4302c', o3='#ff7a5a')                    # 오니 붉은
GHOST = dict(h0='#0c2050', h1='#2058c0', h2='#48a8f0', h3='#a8e4ff', h4='#eafcff')    # 귀화 푸른 불
GOLD = dict(y1='#b8801c', y2='#ffd44a', y3='#fff6b8')
DARKV = dict(u0='#0c0614', u1='#26103c', u2='#4e2286', u3='#8c4ed0', u4='#d0a0ff')    # 마족 암흑 보라
HELL = dict(z1='#8a1030', z2='#e8304c', z3='#ffb0a0')                                 # 지옥 붉은 번개
INK = dict(k0='#0a0810')                                                              # 가장 진한 외곽


# ---------------------------------------------------------------- 계약
def contract():
    """{key: dict(anchor, frame, frames)} — b4.ts 의 레이어 표기에서 그대로 읽는다."""
    out = {}
    text = CONTRACT.read_text(encoding='utf8')
    for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', text):
        spec = dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4)))
        if m.group(1) in out and out[m.group(1)] != spec:
            raise SystemExit(f'{m.group(1)}: contract lists two different specs')
        out[m.group(1)] = spec
    return out


def contract_keys():
    return list(contract())


def render(mod):
    edge = mod.get('EDGE', None)
    frames = []
    for f in range(mod['FRAMES']):
        c = Cel(mod['SIZE'], mod['PAL'])
        mod['draw'](c, f)
        if mod['ANCHOR'] == 'screen':
            fade_oval(c, mod.get('OVAL', 0.35))
        elif edge is None:
            if mod['SIZE'] >= 64:
                fade_edges(c, T=4, B=3, L=4, R=4)
        elif edge:
            fade_edges(c, **edge)
        frames.append(c.im)
    return frames


def run(mod, quiet=False):
    spec = contract().get(mod['KEY'])
    got = dict(anchor=mod['ANCHOR'], frame=mod['SIZE'], frames=mod['FRAMES'])
    assert spec, f"{mod['KEY']}: not in {CONTRACT.name}"
    assert got == spec, f"{mod['KEY']}: script {got} != contract {spec}"
    if len(mod['PAL']) > 15:
        raise SystemExit(f"{mod['KEY']}: {len(mod['PAL'])} inks (+transparent) > 16")
    orig = lib_scout.render
    lib_scout.render = render          # 가장자리 페이드까지 포함해 굽는다
    try:
        return lib_scout.run(mod, quiet)
    finally:
        lib_scout.render = orig


# ---------------------------------------------------------------- 모티프 (c = Cel)
def spark_burst(c, cx, cy, t, n, seed, keys, spd=(6, 22), grav=0.0, squash=1.0, size=(1, 2), up=0.0):
    """t(0..1)에서의 방사 입자. 뜨거운 키부터 식으며 작아진다."""
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        v = r.uniform(*spd)
        s = r.uniform(*size)
        d = v * ease(t)
        x = cx + math.cos(a) * d
        y = cy + math.sin(a) * d * squash + grav * t * t * 20 - up * t * 20
        life = r.uniform(0.75, 1.1)
        if t > life:
            continue
        ki = min(len(keys) - 1, int(t / life * len(keys) + (i % 2) * 0.5))
        rr = s * (1 - 0.6 * t / life)
        if rr >= 1.4:
            c.spark(x, y, rr + 0.6, keys[ki], keys[min(len(keys) - 1, ki + 1)])
        elif rr >= 0.9:
            c.disc(x, y, 1, keys[ki])
        else:
            c.px(x, y, keys[ki])


def converge(c, cx, cy, t, n, seed, keys, r0=26, r1=4, squash=1.0, trail=3):
    """t 에서 중심으로 빨려드는 꼬리 달린 입자."""
    r = rng(seed)
    for i in range(n):
        a = r.uniform(0, 2 * math.pi)
        d0 = r0 * r.uniform(0.75, 1.15)
        d = lerp(d0, r1, ease(t))
        x, y = pol(cx, cy, d, a, squash)
        tx, ty = pol(cx, cy, d + trail + 2 * (1 - t), a, squash)
        c.line([(tx, ty), (x, y)], keys[0])
        c.px(x, y, keys[-1] if i % 2 else keys[min(1, len(keys) - 1)])


def feather(c, x, y, ang, L, body, vein, edge=None, hi=None):
    """깃털 하나. (x, y) 가 중심, ang(라디안) 방향이 깃 끝. 축을 따라 갈래(barb)를 친다."""
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    w = max(1.3, L * 0.22)
    tip = (x + ux * L / 2, y + uy * L / 2)
    tail = (x - ux * L / 2, y - uy * L / 2)
    m1 = (x + ux * L * 0.1 + vx * w, y + uy * L * 0.1 + vy * w)
    m2 = (x + ux * L * 0.1 - vx * w, y + uy * L * 0.1 - vy * w)
    b1 = (x - ux * L * 0.25 + vx * w * 0.8, y - uy * L * 0.25 + vy * w * 0.8)
    b2 = (x - ux * L * 0.25 - vx * w * 0.8, y - uy * L * 0.25 - vy * w * 0.8)
    c.poly([tail, b1, m1, tip, m2, b2], body, outline=edge)
    if hi:
        c.line([(x + vx * w * 0.5, y + vy * w * 0.5), tip], hi)
    c.line([tail, tip], vein)
    n = max(2, int(L / 4))
    for i in range(1, n):
        t = i / n
        px, py = lerp(tail[0], tip[0], t), lerp(tail[1], tip[1], t)
        c.px(px + vx * w * 0.6 * (1 - t * 0.5), py + vy * w * 0.6 * (1 - t * 0.5), vein)
        c.px(px - vx * w * 0.6 * (1 - t * 0.5), py - vy * w * 0.6 * (1 - t * 0.5), vein)


def claw_slashes(c, cx, cy, ang, n, L, gap, th, keys, frac=1.0, bulge=None):
    """평행한 n 줄 발톱 자국(가는 초승달). ang 은 획 방향, gap 은 줄 간격."""
    ux, uy = math.cos(ang), math.sin(ang)
    nx, ny = -uy, ux
    for i in range(n):
        o = (i - (n - 1) / 2) * gap
        p0 = (cx + nx * o - ux * L / 2, cy + ny * o - uy * L / 2)
        p1 = (cx + nx * o + ux * L / 2, cy + ny * o + uy * L / 2)
        c.blade(p0, p1, bulge if bulge is not None else L * 0.12, th, keys, frac)


def crack(c, x, y, ang, L, seed, k, t=1.0, branch=2, k2=None):
    """갈라지는 땅 금. 길이 L 의 t 비율까지 자란다."""
    r = rng(seed)
    pts = [(x, y)]
    a = ang
    steps = 7
    for i in range(int(steps * t)):
        a += r.uniform(-0.45, 0.45)
        px, py = pts[-1]
        pts.append((px + math.cos(a) * L / steps, py + math.sin(a) * L / steps * 0.7))
    if len(pts) > 1:
        c.line(pts, k)
        if k2:
            c.line([(px, py + 1) for px, py in pts], k2)
    if branch and len(pts) > 3:
        for b in range(branch):
            i = 2 + b * 2
            if i < len(pts):
                bx, by = pts[i]
                ba = ang + (0.9 if b % 2 else -0.9)
                c.line([(bx, by), (bx + math.cos(ba) * L * 0.3 * t, by + math.sin(ba) * L * 0.22 * t)], k)
    return pts


def rock(c, x, y, r, keys, seed=0, n=7):
    """돌 덩이: 외곽 불규칙 다각형 + 왼쪽 위 밝은 면 + 오른쪽 아래 어두운 면. keys = (dark, mid, light[, hi])."""
    rr = rng(seed)
    pts = []
    for i in range(n):
        a = i * 2 * math.pi / n + rr.uniform(-0.25, 0.25)
        pts.append(pol(x, y, r * rr.uniform(0.72, 1.0), a))
    c.poly(pts, keys[0])
    inner = [pol(x - r * 0.1, y - r * 0.12, r * 0.72, i * 2 * math.pi / n + 0.2) for i in range(n)]
    c.poly(inner, keys[1])
    c.poly([(x - r * 0.6, y - r * 0.1), (x - r * 0.15, y - r * 0.62), (x + r * 0.22, y - r * 0.5), (x - r * 0.25, y - r * 0.1)], keys[2])
    if len(keys) > 3 and r >= 4:
        c.px(x - r * 0.35, y - r * 0.42, keys[3])
        c.px(x - r * 0.15, y - r * 0.5, keys[3])


def spike(c, x, y, ang, L, w, keys):
    """뾰족한 가시/창. (x, y) 가 뿌리, keys = (body, light, dark)."""
    ux, uy = math.cos(ang), math.sin(ang)
    vx, vy = -uy, ux
    tip = (x + ux * L, y + uy * L)
    a = (x + vx * w, y + vy * w)
    b = (x - vx * w, y - vy * w)
    c.poly([a, tip, b], keys[0])
    if len(keys) > 1:
        c.line([(x + vx * w * 0.5, y + vy * w * 0.5), (x + ux * L * 0.85 + vx * 0.3, y + uy * L * 0.85 + vy * 0.3)], keys[1])
    if len(keys) > 2:
        c.line([(x - vx * w * 0.6, y - vy * w * 0.6), (x + ux * L * 0.7, y + uy * L * 0.7)], keys[2])


def flame(c, x, y, w, h, keys, seed=0, sway=0.0, tongues=3):
    """바닥이 (x, y) 인 불꽃 더미. keys = 어두운 → 밝은. 혀 끝이 sway 로 흔들린다."""
    rr = rng(seed)
    n = len(keys)
    for i, k in enumerate(keys):
        s = 1 - i / (n + 0.6)
        for j in range(tongues):
            ox = (j - (tongues - 1) / 2) * w * 0.55 + rr.uniform(-1, 1)
            hh = h * s * rr.uniform(0.7, 1.05) * (0.85 if j % 2 else 1.0)
            ww = w * s * 0.7
            tipx = x + ox + sway * (hh / max(h, 1))
            c.poly([(x + ox - ww, y), (x + ox - ww * 0.6, y - hh * 0.55), (tipx, y - hh), (x + ox + ww * 0.7, y - hh * 0.5), (x + ox + ww, y)], k)


def bat(c, x, y, s, k, flap=0.0, hi=None):
    """박쥐 실루엣: 몸통 + 양 날개(flap -1 아래 ~ 1 위). s 는 날개 반폭(px)."""
    up = flap * s * 0.55
    c.poly([(x, y - 1), (x - s * 0.35, y - s * 0.3 - up * 0.5), (x - s, y - s * 0.55 - up), (x - s * 0.75, y + s * 0.05 - up * 0.3),
            (x - s * 0.5, y + s * 0.2), (x - s * 0.3, y + s * 0.1), (x, y + 2)], k)
    c.poly([(x, y - 1), (x + s * 0.35, y - s * 0.3 - up * 0.5), (x + s, y - s * 0.55 - up), (x + s * 0.75, y + s * 0.05 - up * 0.3),
            (x + s * 0.5, y + s * 0.2), (x + s * 0.3, y + s * 0.1), (x, y + 2)], k)
    c.disc(x, y + 0.5, max(1.2, s * 0.22), k)
    c.px(x - 1, y - 2, k); c.px(x + 1, y - 2, k)
    if hi:
        c.px(x - 1, y, hi); c.px(x + 1, y, hi)


def orb(c, x, y, r, keys):
    """구슬: 어두운 바깥 → 밝은 속 + 왼쪽 위 반짝임. keys = (rim, body, light, core)."""
    c.disc(x, y, r, keys[0])
    if r > 1.5:
        c.disc(x, y, r * 0.78, keys[1])
    if r > 2.5 and len(keys) > 2:
        c.disc(x - r * 0.12, y - r * 0.12, r * 0.5, keys[2])
    if r > 3 and len(keys) > 3:
        c.disc(x - r * 0.3, y - r * 0.3, max(1, r * 0.22), keys[3])


def swirl(c, cx, cy, r0, r1, turns, keys, t, n=3, squash=1.0, width=1, phase=0.0):
    """나선 줄기 n 가닥. t 로 회전. 안쪽에서 바깥으로 벌어진다."""
    steps = 26
    for j in range(n):
        pts = []
        for i in range(steps + 1):
            u = i / steps
            a = phase + t * 2 * math.pi + j * 2 * math.pi / n + u * turns * 2 * math.pi
            r = lerp(r0, r1, u)
            pts.append(pol(cx, cy, r, a, squash))
        c.line(pts, keys[j % len(keys)], width)


def beam(c, p0, p1, w, keys):
    """겹 광선: 굵고 어두운 → 가늘고 밝은."""
    n = len(keys)
    for i, k in enumerate(keys):
        c.line([p0, p1], k, max(1, int(round(w * (n - i) / n))))


def chain(c, p0, p1, n, k, k2=None, sag=0.0):
    """사슬 고리 n 개. 고리마다 가로/세로 번갈아 놓는다."""
    for i in range(n + 1):
        t = i / n
        x = lerp(p0[0], p1[0], t)
        y = lerp(p0[1], p1[1], t) + math.sin(t * math.pi) * sag
        if i % 2:
            c.oval(x, y, 1.5, 2.5, k, 1)
        else:
            c.oval(x, y, 2.5, 1.5, k, 1)
        if k2:
            c.px(x, y, k2)


def ring(c, x, y, r, keys, squash=1.0, w=1):
    """겹 고리(바깥 어두움 → 안쪽 밝음)."""
    for i, k in enumerate(keys):
        c.ring(x, y, r - i * w, k, w, squash)


def dust(c, x, y, r, seed, keys, fade=False):
    """공기처럼 성긴 먼지 구름: 점선(체커) 몸통 + 위쪽 작은 밝은 덩이. keys 어두움 → 밝음(3~4).
    fade=True 는 마지막 칸용 — 점선 잔상만 남긴다."""
    rr = rng(seed)
    lobes = [(rr.uniform(-0.75, 0.75) * r, rr.uniform(-0.5, 0.05) * r, rr.uniform(0.3, 0.48) * r) for _ in range(5)]
    if fade:
        c.ddisc(x, y, r, keys[1], squash=0.55)
        for ox, oy, s_ in lobes[:2]:
            c.ddisc(x + ox, y + oy, s_ * 0.8, keys[2], parity=1)
        return
    c.ddisc(x, y, r * 1.15, keys[0], squash=0.55)
    c.ddisc(x, y + r * 0.05, r * 0.9, keys[1], squash=0.5, parity=1)
    for ox, oy, s_ in lobes:
        c.ddisc(x + ox, y + oy, s_, keys[1], parity=ox > 0)
    for ox, oy, s_ in lobes:
        if oy < -0.15 * r:
            c.disc(x + ox - 1, y + oy - 1, max(0.8, s_ * 0.55), keys[2])
    if len(keys) > 3:
        for ox, oy, s_ in lobes[:2]:
            c.px(x + ox - 1.5, y + oy - 2, keys[3])


def teeth(c, p0, p1, n, h, down, keys):
    """p0-p1 를 따라 삼각 이빨 n 개. down=True 면 끝이 아래. keys = (몸, 밝은 변)."""
    (x0, y0), (x1, y1) = p0, p1
    for i in range(n):
        a = (lerp(x0, x1, i / n), lerp(y0, y1, i / n))
        b = (lerp(x0, x1, (i + 1) / n), lerp(y0, y1, (i + 1) / n))
        m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (h if down else -h))
        c.poly([a, b, m], keys[0])
        c.line([a, m], keys[1])


def fang(c, x, y, L, w, down, body, hi, edge=None):
    """뿌리 (x, y), 끝이 L 만큼 아래(down)/위로 휜 송곳니."""
    s = 1 if down else -1
    pts = [(x - w, y), (x + w, y), (x + w * 0.4 + 1, y + s * L * 0.6), (x + 1.5, y + s * L), (x - w * 0.5, y + s * L * 0.55)]
    if edge:
        c.poly([(px + (1 if px > x else -1), py) for px, py in pts], edge)
    c.poly(pts, body)
    c.line([(x - w + 1, y), (x - w * 0.3, y + s * L * 0.55)], hi)


def drip(c, x, y, L, keys):
    """핏방울이 맺혀 흘러내리는 줄. keys = (몸, 밝은)."""
    c.line([(x, y), (x, y + L)], keys[0])
    c.disc(x, y + L + 1, 1.3, keys[0])
    c.px(x - 0.5, y + L, keys[1])


def bezier(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


def star4(c, x, y, r, k, k2=None):
    """네 갈래 반짝임."""
    c.spark(x, y, r, k, k2 or k)


def streak_lines(c, x0, x1, ys, k, phase=0):
    for i, y in enumerate(ys):
        off = ((i * 5 + phase * 3) % 7)
        c.line([(x0 + off, y), (x1 - off, y)], k)


def lightning(c, p0, p1, seed, keys, segs=6, jitter=4.0, fork=True):
    pts = c.bolt(p0, p1, seed, keys, segs=segs, jitter=jitter)
    if fork and len(pts) > 3:
        r = rng(seed + 9)
        i = r.randint(1, len(pts) - 3)
        bx, by = pts[i]
        ex, ey = bx + r.uniform(-9, 9), by + r.uniform(4, 10)
        c.line([(bx, by), (ex, ey)], keys[-2] if len(keys) > 1 else keys[-1])
    return pts


# ---------------------------------------------------------------- 검수용 확인판
def _keys_of(module_names):
    return [k for k in contract_keys() if k in module_names]


def all_keys():
    return contract_keys()


def load(key):
    try:
        return importlib.import_module(key)
    except ModuleNotFoundError as err:
        if err.name == key:
            return None
        raise


def skills():
    """b4.ts 의 스킬 목록 [(classKey, id, name, level, motion, [(key, anchor, frame, frames)])]."""
    text = CONTRACT.read_text(encoding='utf8')
    out = []
    for m in re.finditer(r'\{ id: "(skill_\w+)", classId: "class_(\w+)", actorId: "\w+", name: "([^"]+)", level: (\d+), motion: "([\w-]+)", description: "[^"]*", layers: \[(.*?)\] \}', text):
        layers = [(a, b, int(cc), int(d)) for a, b, cc, d in re.findall(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', m.group(6))]
        out.append((m.group(2), m.group(1), m.group(3), int(m.group(4)), m.group(5), layers))
    return out


CHIPS = {'harpy_pal': ('monster2-0', 48), 'gargoyle_pal': ('monster2-1', 64), 'vampire': ('monster2-2', 48), 'demon_knight': ('monster2-3', 48),
         'golem_pal': ('monster2-4', 64), 'dragonewt': ('monster2-5', 64), 'oni_warrior': ('monster2-6', 64), 'dark_lord': ('monster2-7', 64)}


def _sprite(chip, cell, name='idle_a'):
    idx = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead'].index(name)
    im = Image.open(ROOT / f'public/assets/generated/party-pixel/{chip}.png').convert('RGBA')
    x, y = idx % 3 * cell, idx // 3 * cell
    return im.crop((x, y, x + cell, y + cell)).resize((cell * 2, cell * 2), Image.NEAREST)


def stage(classKey, skill_rows, frames_by_key, name):
    """가상 무대 합성판: 슬라임(왼쪽·적) ← 파티 몸(오른쪽). 레이어를 런타임 앵커대로 겹친다. 스킬마다 세 시점."""
    chip, cell = CHIPS[classKey]
    body = _sprite(chip, cell)
    slime = Image.open(ROOT / 'public/assets/generated/pixel-enemies/slime.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)
    PW, PH = 400, 260
    enemy_c, enemy_feet = 96, 220
    actor_c, actor_feet = 300, 212
    font = ImageFont.load_default()
    rows = []
    for (ck, sid, sname, level, motion, layers) in skill_rows:
        main = [l for l in layers if l[0] in frames_by_key]
        if not main:
            continue
        n = max(l[3] for l in layers)
        picks = [max(0, n // 5), n // 2, max(0, n - 3)]
        row = []
        for fi in picks:
            p = Image.new('RGBA', (PW, PH), (0x20, 0x28, 0x40, 255))
            d = ImageDraw.Draw(p)
            d.line((0, 222, PW, 222), fill=(0x2c, 0x36, 0x54, 255))
            p.alpha_composite(slime, (enemy_c - 48, enemy_feet - 88))
            p.alpha_composite(body, (actor_c - cell, actor_feet - (cell - 4) * 2 - 2))
            for key, anchor, frame, nf in layers:
                if key not in frames_by_key:
                    continue
                frs = frames_by_key[key]
                f = frs[min(len(frs) - 1, int(fi * len(frs) / n))]
                s = frame * 2
                fx = f.resize((s, s), Image.NEAREST)
                if anchor in ('target', 'allTargets'):
                    pos = (enemy_c - s // 2, enemy_feet - (s - 16))
                elif anchor in ('user', 'allAllies'):
                    pos = (actor_c - s // 2, actor_feet - (s - 16))
                elif anchor == 'screen':
                    pos = (PW // 2 - s // 2, 150 - s // 2)
                else:
                    pos = (actor_c - s // 2 - int((fi / max(1, n - 1)) * 150), actor_feet - 60 - s // 2)
                p.alpha_composite(fx, pos)
            d.text((4, 4), f'{sid[6:]} L{level} {motion} #{fi}', fill=(255, 255, 255, 255), font=font)
            row.append(p)
        rows.append(row)
    if not rows:
        return
    cols = 3
    # 1900px 이하: 3열 × (400+4) = 1212, 한 장에 4행(1040px) 이하로 쪼갠다.
    per = 4
    for part in range(0, len(rows), per):
        chunk = rows[part:part + per]
        out = Image.new('RGBA', (cols * (PW + 4), len(chunk) * (PH + 4)), (0x10, 0x14, 0x20, 255))
        for r, row in enumerate(chunk):
            for ci, p in enumerate(row):
                out.alpha_composite(p, (ci * (PW + 4), r * (PH + 4)))
        assert out.width <= 1900 and out.height <= 1900
        out.convert('RGB').save(REVIEW / f'{name}-stage-{part // per + 1}.png')


def class_boards(classKey, results):
    rows = []
    font = ImageFont.load_default()
    for line, frames, mod in results:
        scale = 128 // mod['SIZE'] if mod['SIZE'] < 128 else 1
        scale = max(1, min(scale, 3 if mod['SIZE'] >= 64 else 4))
        b = board(frames, scale)
        lab = Image.new('RGBA', (b.size[0], 14), BG)
        ImageDraw.Draw(lab).text((4, 1), f'{mod["KEY"]}  {mod["ANCHOR"]}  {mod["SIZE"]}px x{mod["FRAMES"]}', fill=(255, 255, 255, 255), font=font)
        rows += [lab, b]
    # 한 장 폭 1900 이하로: 넘으면 프레임을 두 줄로 접는 대신 행 단위로 쪼갠다.
    W = max(r.size[0] for r in rows)
    parts, cur, h = [], [], 0
    for r in rows:
        if h + r.size[1] > 1800:
            parts.append(cur); cur, h = [], 0
        cur.append(r); h += r.size[1]
    if cur:
        parts.append(cur)
    for i, part in enumerate(parts):
        out = Image.new('RGBA', (W, sum(r.size[1] for r in part)), BG)
        y = 0
        for r in part:
            out.alpha_composite(r, (0, y)); y += r.size[1]
        assert out.width <= 1900, out.size
        out.convert('RGB').save(REVIEW / f'{classKey}-sheet-{i + 1}.png')


def main(keys=None):
    """keys: 시트 키 목록(그 시트만 굽는다) 또는 'class:<classKey>'(그 직업 전부 + 확인판·무대 합성판)."""
    REVIEW.mkdir(parents=True, exist_ok=True)
    rows = skills()
    bad = 0
    only = {k[6:] for k in (keys or []) if k.startswith('class:')}
    if only:
        keys = None
    for classKey in CHIPS:
        if only and classKey not in only:
            continue
        crow = [r for r in rows if r[0] == classKey]
        results, frames_by_key = [], {}
        for ck, sid, sname, level, motion, layers in crow:
            for key, anchor, frame, nf in layers:
                if key in frames_by_key or (keys and key not in keys):
                    continue
                mod = load(key)
                if mod is None:
                    print(f'--- {key} missing')
                    continue
                res = run(vars(mod))
                bad += res[0].startswith('BAD')
                results.append(res)
                frames_by_key[key] = res[1]
        if results and not keys:
            class_boards(classKey, results)
            stage(classKey, crow, frames_by_key, classKey)
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:] or None) else 0)
