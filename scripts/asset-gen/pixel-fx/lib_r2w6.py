"""r2w6(2026-09-29) 파티 스킬 이펙트 공용 모듈 — 묶음 b2(탈것 8종)부터 쓴다.

좌표·수식으로만 그린다: 원본 그림·리샘플·블러·안티에일리어싱 없음. 알파 0/255, 시트당 ≤16색.
그림 생성기는 직업별 한 파일 r2w6_b2_<classKey>.py 이고, 키(시트)마다 draw 함수 하나를 @fx(...) 로 등록한다.
  @fx(key, anchor, size, frames, PAL)  ← 이 값이 묶음 파일(src/assets/retroRosterSkills/<batch>.ts)의 레이어와 다르면 **멈춘다**.
  draw(c, f): c 는 Fx 셀, f 는 프레임 번호. c.t = f/(frames-1) 진행도.

규격(src/assets/retroClassSkills.ts 머리 주석이 정본):
  user/target/allTargets/allAllies  발밑 SIZE-8 행, 몸 중심이 셀 가운데
  screen                            128px 셀이 무대 전체 — 가장자리는 fade_oval 로 걷어 사각 경계를 없앤다
  projectile                        32px 루프, 첫 칸이 **왼쪽**을 본다(아군이 오른쪽에서 왼쪽으로 쏜다)
검수판은 .omo/r2w6/b2/fx/ 에 쓴다: <key>-x4.png(4배·64px 시트, 128px 시트는 3배), <class>-stage.png(가상 무대 합성).
"""
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from lib_scout import Cel, rgba, lerp, ease, rng, pol, pal, pick, check, BG  # noqa: E402
from fx_edge import fade_edges, fade_oval  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / 'public/assets/generated/pixel-fx'
REVIEW = ROOT / '.omo/r2w6/b2/fx'
CONTRACT_DIR = ROOT / 'src/assets/retroRosterSkills'

# ---- 잉크 가족: 한 키는 어디서나 같은 색이다(한 스킬의 여러 층이 이어져 보이게) ----------------------------
WATER = dict(a0='#0c2a5c', a1='#1d5cae', a2='#3a94e0', a3='#7ad0f2', a4='#d2f6ff')
WOOD = dict(t0='#3a2210', t1='#74481e', t2='#b47a38', t3='#e0b070')
STEEL = dict(s0='#232a3a', s1='#465470', s2='#8896b2', s3='#c8d4e8', s4='#f2f6ff')
FIRE = dict(e0='#521018', e1='#b02a1c', e2='#ee6420', e3='#ffb63c', e4='#fff2a0')
SMOKE = dict(q0='#22232e', q1='#464a5e', q2='#7a8098', q3='#b4bace', q4='#e6eaf4')
GOLD = dict(y0='#7a4c10', y1='#d8961e', y2='#ffd84a', y3='#fff6b8')
PLASMA = dict(n0='#0c3a20', n1='#1c8a3c', n2='#5ae05a', n3='#b8ff9c', n4='#f0ffe0')
VIOLET = dict(v0='#1c1040', v1='#4a2a90', v2='#8a5ae0', v3='#c8a0ff', v4='#f4e6ff')
EARTH = dict(d0='#3c2a20', d1='#6e5038', d2='#a88058', d3='#d8b888')
WIND = dict(k0='#2a6a78', k1='#58b0a0', k2='#a0e8c8', k3='#e0fff0')
ROSE = dict(r0='#5c1234', r1='#c02a5c', r2='#ff7098', r3='#ffc4d4')
LEAFY = dict(l0='#1e4a2c', l1='#3c8a3c', l2='#7ad048', l3='#d0f890')
WHITE = dict(w='#ffffff')

CONTRACT_RE = re.compile(r'\{ key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+) \}')
_contract = {}


def contract(batch='b2'):
    if batch not in _contract:
        text = (CONTRACT_DIR / f'{batch}.ts').read_text(encoding='utf-8')
        _contract[batch] = {k: (a, int(s), int(n)) for k, a, s, n in CONTRACT_RE.findall(text)}
    return _contract[batch]


class Fx(Cel):
    """Cel + 이번 묶음이 쓰는 그림 도구. 모든 도구는 정수 좌표로 찍고 팔레트 키를 받는다."""

    def __init__(self, n, palette, f=0, nf=8):
        # 시트가 고른 가족 외의 키를 잘못 써도 KeyError 로 죽지 않게 공용 가족을 바닥에 깐다(색 수 검사는 실제 찍은 색만 센다).
        full = dict(WATER); [full.update(x) for x in (WOOD, STEEL, FIRE, SMOKE, GOLD, PLASMA, VIOLET, EARTH, WIND, ROSE, LEAFY, WHITE)]
        full.update(palette)
        super().__init__(n, full)
        self.f, self.nf = f, nf
        self.t = f / max(1, nf - 1)
        self.pal['_'] = (0, 0, 0, 0)
        self.cx = n / 2
        self.cy = n * 0.53
        self.feet = n - 8

    # -- 지우기 ---------------------------------------------------------------------------------------
    def erase_disc(self, x, y, r):
        self.d.ellipse((round(x - r), round(y - r), round(x + r), round(y + r)), fill=(0, 0, 0, 0))

    def erase_rect(self, x0, y0, x1, y1):
        self.d.rectangle((round(x0), round(y0), round(x1), round(y1)), fill=(0, 0, 0, 0))

    # -- 별·폭발·번쩍임 ---------------------------------------------------------------------------------
    def star(self, x, y, r, keys, pts=10, rot=0.0, inner=0.55, squash=1.0):
        """폭발 별: keys 바깥(어둠) → 안쪽(밝음)."""
        n = len(keys)
        for i, k in enumerate(keys):
            rr = r * (1 - i / n * 0.78)
            poly = []
            for j in range(pts * 2):
                a = rot + j * math.pi / pts
                rad = rr * (1.0 if j % 2 == 0 else inner)
                poly.append((x + math.cos(a) * rad, y + math.sin(a) * rad * squash))
            self.poly(poly, k)

    def glow(self, x, y, r, keys, squash=1.0):
        """디더 후광: 바깥은 체크무늬, 안쪽은 꽉 참."""
        for i, k in enumerate(keys):
            rr = r * (1 - i / len(keys))
            if i == 0:
                self.ddisc(x, y, rr, k, squash=squash)
            else:
                self.oval(x, y, rr, rr * squash, k)

    def ball(self, x, y, r, dark, mid, light, spec=None):
        """구슬: 어두운 바탕, 왼쪽 위로 밝은 면, 하이라이트 점."""
        self.disc(x, y, r, dark)
        if r >= 2:
            self.disc(x - r * 0.15, y - r * 0.15, r * 0.78, mid)
            self.disc(x - r * 0.3, y - r * 0.3, max(1, r * 0.42), light)
        if spec and r >= 3:
            self.px(x - r * 0.4, y - r * 0.4, spec)

    def flame(self, x, y, h, w, keys, seed=0, sway=0.0, tongues=3):
        """아래에서 위로 타오르는 불꽃 혀. keys 바깥(어둠) → 안쪽(밝음), 안쪽일수록 작다."""
        r = rng(seed)
        hs = [1.0] + [0.62 + 0.38 * r.random() for _ in range(tongues - 1)]
        for i, k in enumerate(keys):
            s = 1 - i * 0.24
            for t in range(tongues):
                off = (t - (tongues - 1) / 2) * w * 0.55
                hh = h * s * hs[t]
                ww = max(0.7, w * s * (0.6 if tongues > 1 else 1))
                bx = x + off
                self.poly([(bx - ww, y), (bx + ww, y), (bx + ww * 0.35 + sway * hh * 0.25, y - hh * 0.6), (bx + sway * hh, y - hh)], k)
                self.poly([(bx - ww, y), (bx - ww * 0.35 + sway * hh * 0.25, y - hh * 0.6), (bx + sway * hh, y - hh)], k)

    def ember(self, x, y, k, k2=None):
        self.px(x, y, k)
        if k2:
            self.px(x, y + 1, k2)

    # -- 물 -------------------------------------------------------------------------------------------
    def ripple(self, x, y, r, k, squash=0.32, parity=0):
        self.dring(x, y, r, k, parity=parity, squash=squash)

    def ring(self, x, y, r, k, w=1, squash=1.0):
        Cel.ring(self, x, y, r, k, w, squash)

    def crown(self, x, y, r, h, keys, t, n=9):
        """물 왕관: 착수점 둘레로 물방울이 포물선으로 솟았다 떨어진다. t 0..1 = 솟구침 진행."""
        hh = h * math.sin(min(1.0, t) * math.pi)
        for j in range(n):
            u = -1 + 2 * j / (n - 1)
            px_ = x + u * r * (0.4 + 0.6 * t)
            top = y - hh * (1 - u * u * 0.75)
            self.line([(x + u * r * 0.3, y), (px_, top)], keys[0])
            self.px(px_, top - 1, keys[-1])
            if j % 2 == 0:
                self.px(px_, top, keys[-2 if len(keys) > 1 else 0])

    def column(self, x, y0, h, w, keys, wob=0.0):
        """물기둥/바위기둥: 아래(y0)에서 위로, 가장자리는 어둡고 가운데 밝음, 위쪽은 둥글게."""
        n = len(keys)
        for i, k in enumerate(keys):
            ww = max(0.5, w * (1 - i / n * 0.7))
            top = y0 - h * (1 - i * 0.03)
            self.poly([(x - ww, y0), (x - ww * 0.8 + wob, top + ww), (x + wob, top), (x + ww * 0.8 + wob, top + ww), (x + ww, y0)], k)

    def wave(self, x0, x1, y, h, keys, phase=0.0, curl=0.0, base=None):
        """가로로 늘어선 파도마루: 위 가장자리는 사인, 아래는 base(없으면 y+h). curl>0 이면 오른쪽으로 말린다(왼쪽 진행)."""
        base = y + h if base is None else base
        n = len(keys)
        for i, k in enumerate(keys):
            top = []
            for x in range(int(x0), int(x1) + 1):
                u = (x - x0) / max(1, x1 - x0)
                yy = y + i * 1.6 - math.sin(u * math.pi) * h * 0.6 - math.sin(u * 9 + phase) * 1.3 - curl * max(0, u - 0.6) * 12 * math.sin(u * math.pi)
                top.append((x, yy))
            self.poly(top + [(x1, base), (x0, base)], k)

    # -- 연기·파편 ---------------------------------------------------------------------------------------
    def smoke(self, x, y, r, keys, seed=0, lobes=5):
        self.puff(x, y, r, keys, seed=seed, lobes=lobes)

    def debris(self, x, y, n, spread, k, seed=0, rise=0.0, size=1, k2=None):
        r = rng(seed)
        for _ in range(n):
            a = r.uniform(0, math.tau)
            d = r.uniform(0.3, 1.0) * spread
            px_, py_ = x + math.cos(a) * d, y + math.sin(a) * d * 0.8 - rise * d * 0.3
            self.disc(px_, py_, size if r.random() > 0.4 else max(0.5, size - 1), k2 if (k2 and r.random() > 0.55) else k)

    def rock(self, x, y, s, keys, seed=0):
        """모난 바위: 6~7각형 + 왼쪽 위 밝은 면 + 오른쪽 아래 어두운 면."""
        r = rng(seed)
        pts = []
        m = 7
        for j in range(m):
            a = j * math.tau / m + r.uniform(-.25, .25)
            rr = s * r.uniform(0.75, 1.05)
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr * 0.85))
        self.poly(pts, keys[0])
        if len(keys) > 1:
            self.poly([(x - s * .7, y - s * .1), (x - s * .1, y - s * .7), (x + s * .5, y - s * .35), (x, y + s * .1)], keys[1])
        if len(keys) > 2:
            self.poly([(x - s * .5, y - s * .2), (x - s * .05, y - s * .55), (x + s * .1, y - s * .25)], keys[2])

    # -- 도형 ------------------------------------------------------------------------------------------
    def gear(self, x, y, r, teeth, rot, body, hole=None, hi=None):
        pts = []
        for j in range(teeth * 4):
            a = rot + j * math.tau / (teeth * 4)
            rr = r if (j % 4) in (0, 1) else r * 0.72
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
        self.poly(pts, body)
        if hi:
            self.arc(x, y, r * 0.55, 200, 300, hi, 1)
        if hole:
            self.disc(x, y, max(1, r * 0.32), hole)

    def spiral(self, x, y, r0, r1, turns, rot, k, w=1, squash=1.0, steps=None, frac=1.0):
        steps = steps or int(turns * 26)
        pts = []
        for i in range(int(steps * frac) + 1):
            u = i / steps
            a = rot + u * turns * math.tau
            rr = lerp(r0, r1, u)
            pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr * squash))
        if len(pts) > 1:
            self.line(pts, k, w)

    def hexagon(self, x, y, r, k, fill=None):
        pts = [(x + math.cos(math.radians(60 * j + 30)) * r, y + math.sin(math.radians(60 * j + 30)) * r) for j in range(6)]
        if fill:
            self.poly(pts, fill)
        self.line(pts + [pts[0]], k)

    def note(self, x, y, k):
        """8분음표."""
        self.disc(x, y, 1.6, k)
        self.line([(x + 1, y), (x + 1, y - 6)], k)
        self.line([(x + 1, y - 6), (x + 4, y - 4)], k)

    def plus(self, x, y, r, k, k2=None):
        self.rect(x - r, y - 1, x + r, y + 1, k)
        self.rect(x - 1, y - r, x + 1, y + r, k)
        if k2:
            self.px(x, y, k2)

    def chevrons(self, x, y, n, gap, w, k, up=True):
        s = -1 if up else 1
        for i in range(n):
            yy = y + s * i * gap
            self.line([(x - w, yy - s * w // 2), (x, yy), (x + w, yy - s * w // 2)], k)

    def bolt_seg(self, p0, p1, seed, keys, segs=5, jitter=4.0):
        return self.bolt(p0, p1, seed, keys, segs=segs, jitter=jitter)

    def cannonball(self, x, y, r=3):
        self.disc(x, y, r, 's0'); self.disc(x - .4, y - .4, r - 1, 's1'); self.px(x - r * .4, y - r * .5, 's3')

    def speed(self, x0, x1, y, k, w=1):
        self.line([(x0, y), (x1, y)], k, w)


# ---- 등록·실행 --------------------------------------------------------------------------------------------
REG = {}


def fx(key, anchor, size, frames, palette):
    """draw(c, f) 를 키에 등록한다. 묶음 파일 레이어와 어긋나면 나중에 run() 이 멈춘다."""
    def deco(fn):
        REG[key] = dict(KEY=key, ANCHOR=anchor, SIZE=size, FRAMES=frames, PAL=palette, draw=fn)
        return fn
    return deco


def finish(c, anchor):
    """앵커별 가장자리 처리: 화면층은 타원으로, 나머지는 칸 경계에 닿은 부분을 디더로 걷는다."""
    if anchor == 'screen':
        fade_oval(c)
    elif anchor == 'projectile':
        pass
    else:
        fade_edges(c, T=2, B=2, L=2, R=2)


def render(spec):
    frames = []
    for f in range(spec['FRAMES']):
        c = Fx(spec['SIZE'], spec['PAL'], f, spec['FRAMES'])
        spec['draw'](c, f)
        finish(c, spec['ANCHOR'])
        frames.append(c.im)
    return frames


def board_wrapped(frames, scale, label=True, gap=4, maxw=1880):
    size = frames[0].size[0]
    cell = size * scale
    per = max(1, (maxw - gap) // (cell + gap))
    rows = (len(frames) + per - 1) // per
    top = 12 if label else 0
    im = Image.new('RGBA', (min(len(frames), per) * (cell + gap) + gap, rows * (cell + top + gap) + gap), BG)
    d = ImageDraw.Draw(im)
    font = ImageFont.load_default()
    for i, fr in enumerate(frames):
        r, cidx = divmod(i, per)
        x = gap + cidx * (cell + gap)
        y = gap + r * (cell + top + gap) + top
        d.rectangle((x - 1, y - 1, x + cell, y + cell), outline=(0x34, 0x40, 0x60, 255))
        im.alpha_composite(fr.resize((cell, cell), Image.NEAREST), (x, y))
        if label:
            d.text((x + 2, y - 11), str(i), fill=(0xf0, 0xf0, 0xa0, 255), font=font)
    return im


def run(key, quiet=False):
    spec = REG[key]
    c = contract().get(key)
    if c is None:
        raise SystemExit(f'STOP {key}: 묶음 파일(b2.ts)에 이 키의 레이어가 없다')
    if c != (spec['ANCHOR'], spec['SIZE'], spec['FRAMES']):
        raise SystemExit(f'STOP {key}: 묶음 파일 {c} != 생성기 {(spec["ANCHOR"], spec["SIZE"], spec["FRAMES"])}')
    size, n = spec['SIZE'], spec['FRAMES']
    frames = render(spec)
    sheet = Image.new('RGBA', (size * n, size), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        sheet.paste(fr, (i * size, 0))
    problems, total, counts, diffs = check(size, n, sheet, frames)
    OUT.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'{key}.png', optimize=True)
    back = Image.open(OUT / f'{key}.png').convert('RGBA')
    if back.tobytes() != sheet.tobytes():
        problems.append('png roundtrip changed pixels')
    board_wrapped(frames, 4 if size <= 64 else 3).save(REVIEW / f'{key}-x4.png')
    line = (f'{"OK " if not problems else "BAD"} {key:<24} {spec["ANCHOR"]:<10} {size}px x{n} colours={total} '
            f'minpx={min(counts)} mindiff={min(diffs) if diffs else "-"}')
    if problems:
        line += ' :: ' + '; '.join(problems)
    if not quiet:
        print(line)
    return not problems, frames, spec


def _cell(path, size, scale=2):
    return Image.open(path).convert('RGBA').crop((0, 0, size, size)).resize((size * scale, size * scale), Image.NEAREST)


def stage(name, results, chip, cell):
    """가상 무대 합성판: 왼쪽 슬라임(적), 오른쪽 이 직업의 걷기 칩 전투 시트(idle_a)가 서고,
    이펙트는 런타임과 같은 규칙으로 앵커된다. 시트마다 세 프레임(초·중·말)."""
    veh = _cell(ROOT / f'public/assets/generated/party-pixel/{chip}.png', cell)
    slime = _cell(ROOT / 'public/assets/generated/pixel-enemies/slime.png', 48)
    PW, PH = 400, 260
    enemy_c, enemy_feet = 96, 220
    ally_c, ally_feet = 300, 216
    font = ImageFont.load_default()
    rows = []
    for ok, frames, spec in results:
        n = spec['FRAMES']
        anchor = spec['ANCHOR']
        picks = sorted({1, n // 2, n - 2}) if anchor != 'projectile' else [0, 1, 2]
        row = []
        for fi in picks:
            p = Image.new('RGBA', (PW, PH), BG)
            d = ImageDraw.Draw(p)
            d.line((0, 222, PW, 222), fill=(0x2c, 0x36, 0x54, 255))
            p.alpha_composite(slime, (enemy_c - 48, enemy_feet - 88))
            p.alpha_composite(veh, (ally_c - cell, ally_feet - 2 * cell + 8 + 4))
            s = spec['SIZE'] * 2
            img = frames[fi].resize((s, s), Image.NEAREST)
            if anchor in ('target', 'allTargets'):
                pos = (enemy_c - s // 2, enemy_feet - (s - 16))
            elif anchor in ('user', 'allAllies'):
                pos = (ally_c - s // 2, ally_feet - (s - 16))
            elif anchor == 'screen':
                pos = (PW // 2 - s // 2, 150 - s // 2)
            else:
                pos = (PW // 2 - s // 2 + (1 - fi) * 40, ally_feet - 60 - s // 2)
            p.alpha_composite(img, pos)
            d.text((4, 4), f'{spec["KEY"]} #{fi}', fill=(255, 255, 255, 255), font=font)
            row.append(p)
        rows.append(row)
    cols = 3
    out = Image.new('RGBA', (cols * (PW + 4), len(rows) * (PH + 4)), (0x10, 0x14, 0x20, 255))
    for r, row in enumerate(rows):
        for ci, p in enumerate(row):
            out.alpha_composite(p, (ci * (PW + 4), r * (PH + 4)))
    # 1900px 이하로 쪼개 저장(행 6개씩)
    per = 6
    paths = []
    for part in range(0, len(rows), per):
        sub = out.crop((0, part * (PH + 4), out.width, min(out.height, (part + per) * (PH + 4))))
        p = REVIEW / f'{name}-stage{part // per + 1}.png'
        sub.save(p)
        paths.append(p)
    return paths


def run_module(mod, chip, cell, keys=None, class_name=None):
    """한 직업 모듈의 모든 키(또는 지정한 키만)를 그리고 무대 합성판을 만든다. 나쁜 시트가 있으면 1 을 돌려준다."""
    results = []
    bad = 0
    for key, spec in REG.items():
        if not key.startswith(class_name + '_') or (keys and key not in keys):
            continue
        ok, frames, sp = run(key)
        bad += not ok
        results.append((ok, frames, sp))
    if results:
        stage(class_name, results, chip, cell)
    return bad
