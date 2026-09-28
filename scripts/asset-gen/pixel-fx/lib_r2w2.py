"""retro2003 2차 로스터(r2w2 담당: a3·p1 묶음) 이펙트 공용 모듈.

좌표로만 그린 도트(이미지 생성·축소·블러 없음). 각 <key>.py 가 KEY, SIZE, FRAMES, ANCHOR, PAL, draw(c, f) 를 정의하고
run(globals()) 를 부른다. `python3 lib_r2w2.py [a3|p1|<key> ...]` 은 묶음의 모든 시트를 다시 굽고 .omo/r2w2/<batch>/ 에
4배 미리보기와 가상 무대 합성판을 쓴다(모든 이미지는 가로·세로 1900px 이하).

계약은 src/assets/retroRosterSkills/<batch>.ts 의 레이어(key·anchor·frame·frames)다. 스크립트가 다르게 적으면 멈춘다.
셀 규약(src/assets/retroClassSkills.ts 머리 주석): user/target/allTargets/allAllies 는 발이 SIZE-8 행, 몸 중심이 셀 중앙,
screen 은 128px(fade_oval), projectile 은 32px 루프(첫 칸이 왼쪽을 본다: 아군은 오른쪽에서 왼쪽으로 쏜다).
"""
import importlib
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import lib_scout  # noqa: E402
from lib_scout import (BG, OUT, ROOT, Cel, check, ease, lerp, pal, pick, pol, rgba, rng, WHITE, board, gif)  # noqa: E402,F401
from lib_samurai import Ink, burst_petals, specks, BLOOD, IRON, FLAME, WATER, SPARK, SMOKEV, LOG, BOLT  # noqa: E402,F401
from lib_monk import star, pow_burst, burst, converge, shade, note, heart, chevron, clef, staff, dragon, dragon_head, flame_tongue  # noqa: E402,F401
import fx_edge  # noqa: E402

BATCH_DIR = ROOT / 'src/assets/retroRosterSkills'
REVIEW = ROOT / '.omo/r2w2'
CX, CY, FEET = 32, 34, 56  # 64px 셀: 몸 중심·발 행

# 잉크 계열: 같은 키는 한 직업 안에서 같은 색이다(층 사이 연속성). 각 시트는 필요한 키만 pick 한다.
EMBER = dict(m0='#3a0a08', m1='#8c1c10', m2='#e04818', m3='#ff9a30', m4='#ffe070')
STEELB = dict(b0='#1c2434', b1='#4a5a78', b2='#94a8c8', b3='#d8e8fa')
LEATHER = dict(l0='#2a180c', l1='#6a4020', l2='#b07838', l3='#e8c078')
ROSE = dict(p0='#4a1030', p1='#b0306c', p2='#f06a9c', p3='#ffb6cc', p4='#ffe8ee')
LEAFG = dict(g0='#123a1e', g1='#2a7a2e', g2='#68bc3a', g3='#b8ec78')
GOLDY = dict(y0='#6a3c0c', y1='#d8901c', y2='#ffd448', y3='#fff4b0')
ICEB = dict(i0='#12285c', i1='#2c68b4', i2='#66b4ec', i3='#b4ecfc', i4='#f0ffff')
PURP = dict(v0='#1a0a34', v1='#402070', v2='#7c48c8', v3='#b88cf0', v4='#eadcff')
TEAL = dict(t0='#0a2e34', t1='#167a80', t2='#38c0b8', t3='#9ceee0')
SMOG = dict(q0='#2a2432', q1='#524a5e', q2='#8a8496', q3='#c4c0ce')
BONE = dict(o0='#4a3c30', o1='#a89678', o2='#e8dcc0')


def _contract_text():
    return '\n'.join(p.read_text(encoding='utf8') for p in sorted(BATCH_DIR.glob('*.ts')))


def contract(batch=None):
    """{key: dict(anchor, frame, frames, skill, batch)} — 묶음 파일들의 layers 항목."""
    out = {}
    for p in sorted(BATCH_DIR.glob('*.ts')):
        if batch and p.stem != batch:
            continue
        for m in re.finditer(r'id: "(\w+)".*?layers: \[(.*?)\] \}', p.read_text(encoding='utf8')):
            for l in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', m.group(2)):
                out.setdefault(l.group(1), dict(anchor=l.group(2), frame=int(l.group(3)), frames=int(l.group(4)), skill=m.group(1), batch=p.stem))
    return out


def batch_keys(batch):
    """묶음의 새 시트 키(계약 순서, 중복 제거)."""
    seen, keys = set(), []
    text = (BATCH_DIR / f'{batch}.ts').read_text(encoding='utf8')
    for l in re.finditer(r'key: "(\w+)", anchor', text):
        if l.group(1) not in seen:
            seen.add(l.group(1))
            keys.append(l.group(1))
    return keys


# --------------------------------------------------------------------------- 공용 모양

def unit(ang):
    return math.cos(ang), math.sin(ang)


def axe(c, hx, hy, ang, L=24, hw=9, keys=('b0', 'b1', 'b2', 'b3'), haft=('l1', 'l2'), side=1, wrap=None):
    """양손 도끼. (hx, hy) 는 자루 끝(날이 붙은 곳), ang 는 거기서 손잡이 쪽으로 향하는 방향(라디안, y 아래).
    날은 자루에 붙은 곧은 변에서 side(±1) 쪽 수직으로 부풀어 나가는 반달이고, 위아래 끝이 벌어진다."""
    ux, uy = unit(ang)
    vx, vy = -uy * side, ux * side
    e0, e1, e2, e3 = keys
    gx, gy = hx + ux * L, hy + uy * L
    c.line([(hx, hy), (gx, gy)], e0, 4)
    c.line([(hx, hy), (gx, gy)], haft[0], 2)
    c.line([(hx - vx * .5, hy - vy * .5), (gx - vx * .5, gy - vy * .5)], haft[1], 1)
    if wrap:
        for j in range(3):
            t = L * (.55 + j * .1)
            c.px(hx + ux * t + vx, hy + uy * t + vy, wrap)

    def P(u_, w_):
        return (hx + ux * u_ * hw + vx * w_ * hw, hy + uy * u_ * hw + vy * w_ * hw)
    blade = [P(-.35, .1), P(-.75, .8), P(-.5, 1.25), P(.4, 1.5), P(1.35, 1.25), P(1.6, .8), P(1.15, .1)]
    c.poly(blade, e1, outline=e0)
    back = [P(-.2, -.1), P(-.2, -.75), P(.3, -.5), P(.9, -.1)]
    c.poly(back, e1, outline=e0)
    c.line([P(-.55, .85), P(-.35, 1.2), P(.4, 1.42), P(1.3, 1.2), P(1.45, .85)], e3)
    c.line([P(-.1, .8), P(.4, 1.05), P(1.0, .8)], e2)
    c.disc(*P(.4, 0), 1.3, e0)
    c.px(*P(.4, 0), e2)


def shock(c, x, y, r, k, w=1, squash=0.38, dither=False, parity=0):
    """바닥 충격 고리(납작한 타원)."""
    if dither:
        c.dring(x, y, r, k, parity=parity, squash=squash)
    else:
        c.ring(x, y, r, k, w, squash)


def crack(c, x, y, ang0, n, L, keys, seed, grow=1.0, squash=0.5, branch=True):
    """(x, y) 에서 사방으로 퍼지는 지그재그 균열. keys = (어둠, 열기). grow 0..1 로 자라난다."""
    r = rng(seed)
    for i in range(n):
        a = ang0 + i * 2 * math.pi / n + r.uniform(-.25, .25)
        ln = L * r.uniform(.7, 1.1) * grow
        pts = [(x, y)]
        cx_, cy_, aa = x, y, a
        steps = max(2, int(ln / 4))
        for _ in range(steps):
            aa += r.uniform(-.5, .5)
            cx_ += math.cos(aa) * ln / steps
            cy_ += math.sin(aa) * ln / steps * squash * 2
            pts.append((cx_, cy_))
            if branch and r.random() < .35:
                ba = aa + r.choice((-1, 1)) * r.uniform(.6, 1.0)
                c.line([(cx_, cy_), (cx_ + math.cos(ba) * ln * .3, cy_ + math.sin(ba) * ln * .3 * squash * 2)], keys[0])
        c.line(pts, keys[0], 2)
        c.line(pts, keys[1], 1)


def debris(c, x, y, t, n, seed, keys, spd=(10, 26), grav=1.4, up=0.9, size=(1.2, 2.6)):
    """바닥에서 튀어 오르는 돌 조각(포물선). t 0..1."""
    r = rng(seed)
    for i in range(n):
        a = r.uniform(-math.pi * .95, -math.pi * .05)
        v = r.uniform(*spd)
        s = r.uniform(*size)
        life = r.uniform(.8, 1.15)
        if t > life:
            continue
        d = v * ease(min(1, t * 1.3))
        px_ = x + math.cos(a) * d
        py_ = y + math.sin(a) * d * up + grav * t * t * 30
        k = keys[i % len(keys)]
        if s >= 1.8:
            c.rect(px_ - 1, py_ - 1, px_, py_, k)
        else:
            c.px(px_, py_, k)


def dust_puff(c, x, y, r, keys, seed=0):
    """땅먼지 덩이(납작)."""
    rr = rng(seed)
    for j in range(5):
        ox = rr.uniform(-1, 1) * r
        c.oval(x + ox, y - abs(ox) * .15 - rr.uniform(0, r * .25), r * rr.uniform(.35, .6), r * rr.uniform(.22, .38), keys[0])
    for j in range(3):
        ox = rr.uniform(-1, 1) * r * .8
        c.oval(x + ox - 1, y - abs(ox) * .15 - r * .3, r * .3, r * .2, keys[1])


def slash(c, p0, p1, bulge, th, keys, frac=1.0):
    """초승달 궤적(lib_scout.Cel.blade 별칭)."""
    c.blade(p0, p1, bulge, th, keys, frac)


def band(c, cx, cy, rx, ry, a0, a1, th, keys, rot=0.0):
    """타원 궤도 위의 초승달 띠(도 단위, y 아래로 시계 방향). keys 는 어두움→밝음, 밝을수록 가늘고 앞쪽에 붙는다. 양 끝은 뾰족하게 가늘어진다."""
    steps = max(10, int(abs(a1 - a0) / 6))
    n = len(keys)
    cr, sr = math.cos(rot), math.sin(rot)

    def at(a, k):
        rad = math.radians(a)
        x, y = math.cos(rad) * rx * k, math.sin(rad) * ry * k
        return cx + x * cr - y * sr, cy + x * sr + y * cr

    for i, k in enumerate(keys):
        t_th = th * (n - i) / n
        outer, inner = [], []
        for j in range(steps + 1):
            u = j / steps
            a = lerp(a0, a1, u)
            tap = math.sin(math.pi * u) ** 0.9
            outer.append(at(a, 1.0))
            inner.append(at(a, max(0.05, 1.0 - t_th * tap / max(rx, 1))))
        c.poly(outer + inner[::-1], k)


def zring(c, x, y, r, th, k, n=12, rot=0.0, squash=1.0):
    """톱니(별) 고리 윤곽: 함성·충격파용."""
    def pts(rr):
        out = []
        for i in range(n * 2):
            a = rot + i * math.pi / n
            q = rr if i % 2 == 0 else rr * 0.8
            out.append((x + math.cos(a) * q, y + math.sin(a) * q * squash))
        return out
    c.poly(pts(r), k)
    c.poly(pts(max(0.5, r - th)), '_')


def drops(c, x, y, t, n, seed, keys, spd=(6, 20), grav=1.6, size=(1, 2)):
    """튀는 핏방울/물방울(중력 포물선). t 0..1."""
    r = rng(seed)
    for i in range(n):
        a = r.uniform(-math.pi, 0) if i % 3 else r.uniform(-math.pi * .5, math.pi * .3)
        v = r.uniform(*spd)
        life = r.uniform(.7, 1.15)
        if t > life:
            continue
        d = v * ease(min(1, t * 1.4))
        px_ = x + math.cos(a) * d
        py_ = y + math.sin(a) * d + grav * t * t * 34
        k = keys[i % len(keys)]
        if r.uniform(*size) > 1.6:
            c.rect(px_, py_, px_ + 1, py_ + 1, k)
        else:
            c.px(px_, py_, k)


def dissolve(c, level, box=None):
    """level 0..1: 베이어 4x4 순서로 그만큼의 픽셀을 지운다(알파 0/255 유지). box=(x0,y0,x1,y1) 로 범위 제한."""
    n = c.n
    x0, y0, x1, y1 = box or (0, 0, n - 1, n - 1)
    a = c.im.load()
    for y in range(max(0, y0), min(n - 1, y1) + 1):
        for x in range(max(0, x0), min(n - 1, x1) + 1):
            if fx_edge.BAYER[y % 4, x % 4] / 16.0 < level:
                a[x, y] = (0, 0, 0, 0)


def bolt(c, p0, p1, seed, keys, segs=6, jitter=4.0):
    """번개(lib_scout.Cel.bolt 별칭: 어두운 굵은 선 → 흰 가는 선)."""
    return c.bolt(p0, p1, seed, keys, segs=segs, jitter=jitter)


def ribbon(c, pts, keys=('p0', 'p1', 'p2'), w=3, hi=None):
    """리본/띠: 굵은 선 세 겹(윤곽·몸·하이라이트). pts 는 꼭짓점 목록."""
    if len(pts) < 2:
        return
    c.line(pts, keys[0], w + 2)
    c.line(pts, keys[1], w)
    c.line([(x, y - 1) for x, y in pts], keys[2], 1)
    if hi:
        c.line([(x + 1, y + 1) for x, y in pts[::2]], hi, 1) if False else None


def fan(c, x, y, ang, r, span, keys, ribs=6, edge=None):
    """접부채를 펼친 모양: (x, y) 는 사북(축), ang 방향으로 반지름 r, 부채살 ribs 개, 벌어진 각 span(도)."""
    a0 = ang - math.radians(span) / 2
    a1 = ang + math.radians(span) / 2
    n = 14
    pts = [(x, y)] + [(x + math.cos(lerp(a0, a1, i / n)) * r, y + math.sin(lerp(a0, a1, i / n)) * r) for i in range(n + 1)]
    c.poly(pts, keys[0], outline=edge or keys[0])
    inner = [(x, y)] + [(x + math.cos(lerp(a0, a1, i / n)) * r * .82, y + math.sin(lerp(a0, a1, i / n)) * r * .82) for i in range(n + 1)]
    c.poly(inner, keys[1])
    for i in range(ribs):
        a = lerp(a0, a1, (i + .5) / ribs)
        c.line([(x, y), (x + math.cos(a) * r, y + math.sin(a) * r)], keys[2])
    # 가장자리 장식(윗단)
    c.line([(x + math.cos(lerp(a0, a1, i / n)) * r, y + math.sin(lerp(a0, a1, i / n)) * r) for i in range(n + 1)], keys[3] if len(keys) > 3 else keys[2])
    c.disc(x, y, 1.3, keys[2])


def spiral(c, x, y, r, turns, k, rot=0.0, squash=1.0, w=1, phase_end=1.0):
    """아르키메데스 나선(최면·소용돌이)."""
    pts = []
    steps = int(turns * 26)
    for i in range(int(steps * phase_end) + 1):
        u = i / steps
        a = rot + u * turns * 2 * math.pi
        pts.append((x + math.cos(a) * r * u, y + math.sin(a) * r * u * squash))
    if len(pts) > 1:
        c.line(pts, k, w)


def beam(c, x0, y0, x1, y1, w0, w1, inner, outer, phase=0, stripes=0):
    """빛기둥/원뿔: (x0,y0)→(x1,y1) 축, 양 끝 반폭 w0→w1. 가운데는 체커, 가장자리는 4칸에 1칸 점묘로 부드럽게.
    stripes>0 이면 축 방향으로 밝은 띠가 phase 에 맞춰 흘러내린다(inner→outer 로 번쩍)."""
    ymin, ymax = int(min(y0, y1)), int(max(y0, y1))
    for y in range(ymin, ymax + 1):
        t = (y - y0) / (y1 - y0) if y1 != y0 else 0
        cxs = lerp(x0, x1, t)
        half = lerp(w0, w1, t)
        for x in range(int(cxs - half) - 1, int(cxs + half) + 2):
            d = abs(x - cxs) / max(half, .5)
            if d > 1:
                continue
            core = d < .5
            on = (x + y) % 2 == 0 if core else (x % 2 == 0 and y % 2 == 0)
            if not on:
                continue
            k = inner if core else outer
            if stripes and ((y + phase) // stripes) % 2 == 0 and core:
                k = inner
            c.px(x, y, k)


def rot_pts(pts, cx, cy, ang):
    ca, sa = math.cos(ang), math.sin(ang)
    return [(cx + (x - cx) * ca - (y - cy) * sa, cy + (x - cx) * sa + (y - cy) * ca) for x, y in pts]


def flask(c, x, y, ang, s, liquid, glass, cork, hi='w', edge=None):
    """둥근 플라스크(병목이 위=ang 0). (x,y)=몸통 중심, s=몸통 반지름. ang 라디안 회전(시계 방향)."""
    body = c.__class__  # noqa: F841 (문서용)
    edge = edge or glass
    # 병목 사각형과 몸통 원을 회전 좌표로 찍는다
    ca, sa = math.cos(ang), math.sin(ang)

    def P(u, v):
        return (x + u * ca - v * sa, y + u * sa + v * ca)
    neck = [P(-s * .32, -s * .8), P(s * .32, -s * .8), P(s * .32, -s * 1.7), P(-s * .32, -s * 1.7)]
    c.disc(x, y, s + 1, edge)
    c.poly([P(-s * .32 - 1, -s * .7), P(s * .32 + 1, -s * .7), P(s * .32 + 1, -s * 1.8), P(-s * .32 - 1, -s * 1.8)], edge)
    c.disc(x, y, s, glass)
    c.disc(*P(0, s * .18), s * .82, liquid)
    c.poly(neck, glass)
    cx_, cy_ = P(0, -s * 1.95)
    c.disc(cx_, cy_, max(1, s * .38), cork)
    c.px(*P(-s * .45, -s * .35), hi)
    c.px(*P(-s * .45, -s * .05), hi)


def hexagram(c, cx, cy, r, k, rot=0.0, squash=1.0, w=1):
    """육망성(연성진). 두 삼각형."""
    for j in (0, 1):
        pts = [(cx + math.cos(rot + j * math.pi / 3 + i * 2 * math.pi / 3) * r,
                cy + math.sin(rot + j * math.pi / 3 + i * 2 * math.pi / 3) * r * squash) for i in range(3)]
        c.line(pts + [pts[0]], k, w)


def skull(c, x, y, k, eye, s=1):
    """5x5 해골(왼쪽 위 기준 중심)."""
    rows = ['.###.', '#####', '#.#.#', '.###.', '.#.#.']
    for j, row in enumerate(rows):
        for i, ch in enumerate(row):
            if ch == '#':
                c.px(x - 2 + i, y - 2 + j, eye if (j == 2 and i in (1, 3)) else k)


def gem(c, x, y, r, keys, squash=1.25):
    """마름모 보석(키: 어둠→밝음). 위 밝은 면과 아래 어두운 면."""
    e0, e1, e2, e3 = keys
    ry = r * squash
    c.poly([(x, y - ry - 1), (x + r + 1, y), (x, y + ry + 1), (x - r - 1, y)], e0)
    c.poly([(x, y - ry), (x + r, y), (x, y + ry), (x - r, y)], e1)
    c.poly([(x, y - ry), (x - r, y), (x, y)], e2)
    c.poly([(x, y - ry), (x + r, y), (x, y - ry * .2)], e2)
    c.line([(x - r * .6, y - ry * .2), (x, y - ry * .8)], e3)
    c.px(x - r * .3, y - ry * .4, e3)


def bubble(c, x, y, r, k, hi='w'):
    c.ring(x, y, r, k, 1)
    if r >= 2:
        c.px(x - r * .45, y - r * .45, hi)


# --------------------------------------------------------------------------- 출력

def render(mod):
    frames = []
    size, anchor = mod['SIZE'], mod['ANCHOR']
    edge = mod.get('EDGE', 'auto')
    for f in range(mod['FRAMES']):
        c = Ink(size, mod['PAL'])
        mod['draw'](c, f)
        if edge == 'auto':
            if anchor == 'screen':
                fx_edge.fade_oval(c)
            elif anchor != 'projectile':
                fx_edge.fade_edges(c, T=5, B=4, L=5, R=5)
        elif isinstance(edge, dict):
            fx_edge.fade_edges(c, **edge)
        elif edge == 'oval':
            fx_edge.fade_oval(c)
        frames.append(c.im)
    return frames


def run(mod, quiet=False):
    key, size, n, anchor = mod['KEY'], mod['SIZE'], mod['FRAMES'], mod['ANCHOR']
    spec = contract().get(key)
    if not spec or (spec['frame'], spec['frames'], spec['anchor']) != (size, n, anchor):
        raise SystemExit(f'{key}: script {anchor} {size}px x{n} != contract {spec}')
    if len(mod['PAL']) > 15:
        raise SystemExit(f'{key}: palette has {len(mod["PAL"])} inks (+transparent > 16)')
    frames = render(mod)
    sheet = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * size, 0))
    problems, total, counts, diffs = check(size, n, sheet, frames)
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{key}.png', optimize=True)
    if Image.open(OUT / f'{key}.png').convert('RGBA').tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    status = 'OK ' if not problems else 'BAD'
    line = (f'{status} {key:<26} {anchor:<10} {size}px x{n} colours={total} minpx={min(counts)} mindiff={min(diffs) if diffs else "-"}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return line, frames, mod


# --------------------------------------------------------------------------- 미리보기(1900px 이하)

def wrapped_board(frames, scale, maxw=1880, label=True, bg=BG, gap=4):
    size = frames[0].size[0]
    cell = size * scale
    per = max(1, (maxw - gap) // (cell + gap))
    rows = (len(frames) + per - 1) // per
    top = 12 if label else 0
    W = min(len(frames), per) * (cell + gap) + gap
    H = rows * (cell + top + gap) + gap
    im = Image.new('RGBA', (W, H), bg)
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default()
    for i, fr in enumerate(frames):
        r, cidx = divmod(i, per)
        x = gap + cidx * (cell + gap)
        y = gap + r * (cell + top + gap)
        d.rectangle((x - 1, y + top - 1, x + cell, y + top + cell), outline=(0x34, 0x40, 0x60, 255))
        im.alpha_composite(fr.resize((cell, cell), Image.NEAREST), (x, y + top))
        if label:
            d.text((x + 2, y), str(i), fill=(0xf0, 0xf0, 0xa0, 255), font=font)
    assert im.width <= 1900 and im.height <= 1900, im.size
    return im


def preview(key, frames, size, batch):
    d = REVIEW / batch / 'fx'
    d.mkdir(parents=True, exist_ok=True)
    scale = 4 if size <= 64 else 2
    wrapped_board(frames, scale).save(d / f'{key}-preview.png')


def _cell(path, col, row, size=48):
    return Image.open(path).convert('RGBA').crop((col * size, row * size, col * size + size, row * size + size)).resize((size * 2, size * 2), Image.NEAREST)


def stage(results, actor_id, actor_pose=(0, 0), name='stage', batch='a3', enemy='slime', per_image=4):
    """가상 무대 합성판: 적(왼쪽)·아군(오른쪽)·이펙트를 런타임 앵커대로. 레이어는 재생 순서대로 겹친다."""
    actor = _cell(ROOT / f'public/assets/generated/charset-battlers/{actor_id}.png', *actor_pose)
    foe = _cell(ROOT / f'public/assets/generated/pixel-enemies/{enemy}.png', 0, 0)
    PW, PH = 400, 260
    e_c, e_f = 96, 220
    a_c, a_f = 300, 212
    font = ImageFont.load_default()

    def panel(mods, fi_frac, label):
        p = Image.new('RGBA', (PW, PH), BG)
        d = ImageDraw.Draw(p)
        d.line((0, 222, PW, 222), fill=(0x2c, 0x36, 0x54, 255))
        p.alpha_composite(foe, (e_c - 48, e_f - 88))
        p.alpha_composite(actor, (a_c - 48, a_f - 90))
        for frames, mod in mods:
            n = mod['FRAMES']
            fi = min(n - 1, int(fi_frac * n))
            s = mod['SIZE'] * 2
            fx = frames[fi].resize((s, s), Image.NEAREST)
            a = mod['ANCHOR']
            if a == 'target':
                pos = (e_c - s // 2, e_f - (s - 16))
            elif a == 'allTargets':
                pos = (e_c - s // 2, e_f - (s - 16))
            elif a == 'user':
                pos = (a_c - s // 2, a_f - (s - 16))
            elif a == 'allAllies':
                pos = (a_c - s // 2, a_f - (s - 16))
            elif a == 'screen':
                pos = (PW // 2 - s // 2, 150 - s // 2)
            else:
                pos = (PW // 2 - s // 2 + int((0.5 - fi_frac) * 200), a_f - 50 - s // 2)
            p.alpha_composite(fx, pos)
        d.text((4, 4), label, fill=(255, 255, 255, 255), font=font)
        return p

    by_skill = {}
    for line, frames, mod in results:
        by_skill.setdefault(contract()[mod['KEY']]['skill'], []).append((frames, mod))
    skills = list(by_skill.items())
    outs = []
    for chunk in range(0, len(skills), per_image):
        part = skills[chunk:chunk + per_image]
        img = Image.new('RGBA', (3 * (PW + 4), len(part) * (PH + 4)), (0x10, 0x14, 0x20, 255))
        for r, (sid, mods) in enumerate(part):
            for ci, frac in enumerate((0.2, 0.5, 0.8)):
                img.alpha_composite(panel(mods, frac, f'{sid} {int(frac * 100)}%'), (ci * (PW + 4), r * (PH + 4)))
        assert img.width <= 1900 and img.height <= 1900, img.size
        path = REVIEW / batch / f'{name}-{chunk // per_image + 1}.png'
        path.parent.mkdir(parents=True, exist_ok=True)
        img.save(path)
        outs.append(path)
    return outs


def overview(keys, path, disp=128, maxw=1880):
    """여러 시트를 한 장에: 시트 하나 = 한 줄, 칸 표시 크기 disp(64px→2배, 128px→1배, 32px→4배). 열이 넘치면 줄을 나눈다."""
    rows = []
    font = ImageFont.load_default()
    for key in keys:
        img = Image.open(OUT / f'{key}.png').convert('RGBA')
        size = img.height
        n = img.width // size
        sc = max(1, disp // size)
        cell = size * sc
        per = max(1, (maxw - 4) // (cell + 4))
        r = (n + per - 1) // per
        band = Image.new('RGBA', (min(n, per) * (cell + 4) + 4, r * (cell + 4) + 14), BG)
        d = ImageDraw.Draw(band)
        d.text((3, 1), f'{key}  {size}px x{n}', fill=(255, 255, 255, 255), font=font)
        for i in range(n):
            rr, cc = divmod(i, per)
            fr = img.crop((i * size, 0, i * size + size, size)).resize((cell, cell), Image.NEAREST)
            d.rectangle((4 + cc * (cell + 4) - 1, 14 + rr * (cell + 4) - 1, 4 + cc * (cell + 4) + cell, 14 + rr * (cell + 4) + cell), outline=(0x34, 0x40, 0x60, 255))
            band.alpha_composite(fr, (4 + cc * (cell + 4), 14 + rr * (cell + 4)))
        rows.append(band)
    W = max(r.width for r in rows)
    H = sum(r.height for r in rows)
    out = Image.new('RGBA', (W, H), BG)
    y = 0
    for r in rows:
        out.alpha_composite(r, (0, y))
        y += r.height
    assert out.width <= 1900 and out.height <= 1900, out.size
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    out.save(path)
    return out.size


def main(args=None):
    args = args or []
    batches = [a for a in args if a in ('a3', 'p1')] or (['a3', 'p1'] if not args else [])
    keys = [a for a in args if a not in ('a3', 'p1')]
    todo = []
    for b in (batches or []):
        todo += [(b, k) for k in batch_keys(b)]
    for k in keys:
        spec = contract().get(k)
        if spec:
            todo.append((spec['batch'], k))
    bad = 0
    results = {}
    for b, k in todo:
        try:
            mod = importlib.import_module(k)
        except ModuleNotFoundError as err:
            if err.name == k:
                print(f'--- {k} missing')
                continue
            raise
        res = run(vars(mod))
        bad += res[0].startswith('BAD')
        preview(k, res[1], res[2]['SIZE'], b)
        results.setdefault(b, []).append(res)
    return bad


if __name__ == '__main__':
    sys.exit(1 if main(sys.argv[1:]) else 0)
