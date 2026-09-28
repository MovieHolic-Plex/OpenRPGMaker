"""retro2003 로스터 2차(r2w5) 이펙트 공용 모듈 — 묶음 b1(Animal 8)의 시트 80종이 쓴다.

lib_mage(Cel·Pal·build·check)와 lib_druid(뾰족한 도형들) 위에 얹는다. 좌표만으로 찍는다(리샘플·블러·AI 도구 없음).
  * 시트는 r2w5_<동물>.py 에 @sheet(...) 데코레이터로 등록하고, <키>.py 는 그 시트 하나를 만드는 얇은 진입점이다.
  * 프레임 규격(frame·frames·anchor)은 src/assets/retroRosterSkills/b1.ts 에서 읽어 대조한다 — 다르면 멈춘다.
  * 마무리: screen(128) 은 fade_oval, 나머지는 fade_edges(투사체 32 는 1px), 검사: 크기·알파 0/255·≤16색·빈 칸·인접 칸 다름.
  * 검수 산출물: .omo/r2w5/b1/fx/<키>-preview*.png(4배, 1900px 이하 조각), <동물>-board.png(가상 무대 합성).
  * 방향: 아군 스킬 — 적은 왼쪽, 시전자는 오른쪽. 투사체 첫 칸은 왼쪽을 본다. 타격은 오른쪽 위에서 왼쪽 아래로 온다.

    python3 scripts/asset-gen/pixel-fx/lib_r2w5.py dog          # 한 동물 전부 + 무대판
    python3 scripts/asset-gen/pixel-fx/lib_r2w5.py dog_bite     # 시트 하나
    python3 scripts/asset-gen/pixel-fx/dog_bite.py              # 같은 것
"""
import importlib
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
from lib_druid import *          # noqa: F401,F403  (Pal, Cel, LM, lerp, ease, orbit, jag, rng, rays, puff, plus, fade, ...)
import lib_mage as LM            # noqa: E402
import fx_edge                   # noqa: E402
from PIL import Image            # noqa: E402

B1 = ROOT / 'src/assets/retroRosterSkills/b1.ts'
REVIEW_DIR = ROOT / '.omo/r2w5/b1/fx'
LM.REVIEW = REVIEW_DIR
ANIMALS = ['dog', 'cat', 'rooster', 'sheep', 'cow', 'horse', 'tiger', 'lion']
CHIP = {a: f'animal-{i}' for i, a in enumerate(ANIMALS)}
CX, CY, GY = 32, 40, 56          # 64 셀: 발밑 56, 몸 중심 40
REG = {}


def sheet(key, frame, frames, anchor, pal, peak=None):
    """@sheet('dog_bite', 64, 8, 'target', Pal(...), peak=[2, 4, 6]) def draw(c, f): ..."""
    def deco(fn):
        REG[key] = dict(key=key, frame=frame, frames=frames, anchor=anchor, pal=pal, peak=peak, draw=fn)
        return fn
    return deco


def b1_contract():
    text = B1.read_text(encoding='utf8')
    out = {}
    for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', text):
        out.setdefault(m.group(1), dict(anchor=m.group(2), frame=int(m.group(3)), frames=int(m.group(4))))
    return out


def load_all():
    for a in ANIMALS:
        f = HERE / f'r2w5_{a}.py'
        if f.exists():
            importlib.import_module(f'r2w5_{a}')


# ---------------------------------------------------------------- 도형

def arc_pts(cx, cy, r, a0, a1, n=None, ry=None):
    ry = r if ry is None else ry
    n = n or max(6, int(abs(a1 - a0) / 6))
    return [(cx + math.cos(math.radians(a0 + (a1 - a0) * i / (n - 1))) * r, cy + math.sin(math.radians(a0 + (a1 - a0) * i / (n - 1))) * ry) for i in range(n)]


def strip(c, pts, widths, col):
    """중심선 pts 를 따라 점마다 반폭 widths 로 채운 띠."""
    left, right = [], []
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        if i == 0:
            dx, dy = pts[1][0] - x, pts[1][1] - y
        elif i == n - 1:
            dx, dy = x - pts[i - 1][0], y - pts[i - 1][1]
        else:
            dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        w = widths[i]
        left.append((x + nx * w, y + ny * w))
        right.append((x - nx * w, y - ny * w))
    c.poly(left + right[::-1], col)


def lens(n, w, floor=0.4):
    return [max(floor, w * math.sin(math.pi * (i + 0.5) / n)) for i in range(n)]


def crescent(c, cx, cy, r, a0, a1, w, cols, u=1.0, ry=None, tail=0.0):
    """초승달 베기. cols = [바깥, 안쪽, 심] 순 색, 안쪽일수록 가늘다. u = 그려지는 진행(0~1), tail = 꼬리 쪽 잘림(0~1)."""
    ta0 = a0 + (a1 - a0) * tail
    ta1 = a0 + (a1 - a0) * max(u, tail + 0.02)
    pts = arc_pts(cx, cy, r, ta0, ta1, ry=ry)
    n = len(pts)
    for k, col in enumerate(cols):
        strip(c, pts, lens(n, w * (1 - k * 0.32)), col)


def gash(c, x0, y0, x1, y1, w, cols, u=1.0, bow=0.0, tail=0.0):
    """직선(살짝 휘는) 할퀸 자국. u 는 앞쪽 진행, tail 은 뒤쪽 잘림."""
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    pts = []
    N = 14
    for i in range(N):
        t = i / (N - 1)
        b = math.sin(math.pi * t) * bow
        pts.append((x0 + dx * t + nx * b, y0 + dy * t + ny * b))
    a, b_ = int(N * tail), max(int(N * u), int(N * tail) + 2)
    pts = pts[a:b_]
    if len(pts) < 2:
        return
    for k, col in enumerate(cols):
        strip(c, pts, lens(len(pts), w * (1 - k * 0.34)), col)


def claws(c, x0, y0, x1, y1, n, gap, w, cols, u=1.0, bow=1.5, tail=0.0):
    """평행한 발톱 자국 n 줄. 진행 방향에 수직으로 gap 씩 벌어진다."""
    dx, dy = x1 - x0, y1 - y0
    ln = math.hypot(dx, dy) or 1
    nx, ny = -dy / ln, dx / ln
    for i in range(n):
        o = (i - (n - 1) / 2) * gap
        s = 1 - abs(i - (n - 1) / 2) * 0.12
        gash(c, x0 + nx * o, y0 + ny * o, x0 + dx * s + nx * o, y0 + dy * s + ny * o, w, cols, u, bow, tail)


def tooth(c, x, y, ln, ang, wd, col, edge=None):
    """송곳니: (x, y) 뿌리에서 각도 ang 으로 뾰족하게."""
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    pts = [(x + nx * wd, y + ny * wd), (x + dx * ln, y + dy * ln), (x - nx * wd, y - ny * wd)]
    if edge is not None:
        c.poly([(x + nx * (wd + 1) - dx, y + ny * (wd + 1) - dy), (x + dx * (ln + 1.6), y + dy * (ln + 1.6)), (x - nx * (wd + 1) - dx, y - ny * (wd + 1) - dy)], edge)
    c.poly(pts, col)


def jaw_row(c, cx, cy, half, down, n, ln, gum, teeth, edge, curve=6):
    """위(down=+1: 이빨이 아래로) 또는 아래(down=-1) 턱. 곡선 잇몸띠 위에 이빨 n 개."""
    pts = []
    for i in range(15):
        t = i / 14 * 2 - 1
        pts.append((cx + t * half, cy - down * curve * (1 - t * t) * 0.0 - down * curve * t * t * 0.9))
    strip(c, pts, [3.2] * 15, edge)
    strip(c, pts, [2.2] * 15, gum)
    for k in range(n):
        t = (k + 0.5) / n * 2 - 1
        x = cx + t * half * 0.94
        y = cy - down * curve * t * t * 0.9 + down * 1.0
        big = 1.0 + 0.55 * (1 - abs(t))
        tooth(c, x, y, ln * big, math.pi / 2 if down > 0 else -math.pi / 2, 1.9 * (0.75 + 0.3 * big), teeth, edge)


def paw(c, x, y, s, col, pad, rim=None):
    """발바닥 자국(작은 패드 하나 + 발가락 넷)."""
    if rim is not None:
        c.disc(x, y + 1.2 * s, 3.6 * s + 1, rim, 3.0 * s + 1)
        for dx, dy in ((-3.6, -3.4), (-1.3, -5.0), (1.3, -5.0), (3.6, -3.4)):
            c.disc(x + dx * s, y + dy * s, 1.7 * s + 1, rim)
    c.disc(x, y + 1.2 * s, 3.6 * s, col, 3.0 * s)
    for dx, dy in ((-3.6, -3.4), (-1.3, -5.0), (1.3, -5.0), (3.6, -3.4)):
        c.disc(x + dx * s, y + dy * s, 1.7 * s, col)
    c.disc(x, y + 1.4 * s, 2.2 * s, pad, 1.8 * s)


def bone(c, x, y, ang, ln, w, col, shade, rim):
    dx, dy = math.cos(ang), math.sin(ang)
    nx, ny = -dy, dx
    ax_, ay_ = x - dx * ln / 2, y - dy * ln / 2
    bx_, by_ = x + dx * ln / 2, y + dy * ln / 2
    c.line([(ax_, ay_), (bx_, by_)], rim, int(w + 2))
    for (ex, ey) in ((ax_, ay_), (bx_, by_)):
        for s in (-1, 1):
            c.disc(ex + nx * s * w * 0.7, ey + ny * s * w * 0.7, w * 0.75 + 1, rim)
    c.line([(ax_, ay_), (bx_, by_)], col, int(w))
    for (ex, ey) in ((ax_, ay_), (bx_, by_)):
        for s in (-1, 1):
            c.disc(ex + nx * s * w * 0.7, ey + ny * s * w * 0.7, w * 0.75, col)
    c.line([(ax_ + nx, ay_ + ny), (bx_ + nx, by_ + ny)], shade)


def heart(c, x, y, s, col, hi=None, rim=None):
    def body(cc, k, colr):
        cc.disc(x - 1.6 * s * k, y - 0.8 * s * k, 2.0 * s * k, colr)
        cc.disc(x + 1.6 * s * k, y - 0.8 * s * k, 2.0 * s * k, colr)
        cc.poly([(x - 3.5 * s * k, y - 0.2 * s * k), (x + 3.5 * s * k, y - 0.2 * s * k), (x, y + 3.6 * s * k)], colr)
    if rim is not None:
        body(c, 1.0 + 1.2 / max(s, 1), rim)
    body(c, 1.0, col)
    if hi is not None:
        c.px(x - 2 * s, y - 1.6 * s, hi)


def zzz(c, x, y, s, col, rim=None):
    for i, (dx, dy, k) in enumerate(((0, 0, 1.0), (3 * s, -4 * s, 0.75), (5.5 * s, -8 * s, 0.55))):
        h = max(2, round(3 * s * k))
        if rim is not None:
            c.rect(x + dx - 1, y + dy - h - 1, x + dx + h + 1, y + dy + 1, rim)
        c.line([(x + dx, y + dy - h), (x + dx + h, y + dy - h)], col)
        c.line([(x + dx + h, y + dy - h), (x + dx, y + dy)], col)
        c.line([(x + dx, y + dy), (x + dx + h, y + dy)], col)


def burst(c, cx, cy, r_out, r_in, n, col, rot=0.0, jag_=0.0, seed=1):
    """만화식 뾰족 폭발 다각형(안쪽/바깥 번갈아)."""
    r = rng('burst', seed)
    pts = []
    for k in range(n * 2):
        a = rot + k * math.pi / n
        rr = (r_out if k % 2 == 0 else r_in) * (1 + r.uniform(-jag_, jag_))
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    c.poly(pts, col)


def dashes(c, cx, cy, r, a0, a1, n, ln, col, ry=None, w=1):
    """원둘레에 끊어진 호(속도선·충격선)."""
    ry = r if ry is None else ry
    for i in range(n):
        a = a0 + (a1 - a0) * i / max(1, n - 1)
        c.arc(cx, cy, r, a - ln / 2, a + ln / 2, col, w, ry)


def speed(c, x0, y0, x1, y1, cols, gap=3, n=4, ln=10):
    """(x0,y0)에서 (x1,y1) 반대 방향으로 흐르는 속도선 n 줄."""
    dx, dy = x1 - x0, y1 - y0
    d = math.hypot(dx, dy) or 1
    ux, uy = dx / d, dy / d
    nx, ny = -uy, ux
    for i in range(n):
        o = (i - (n - 1) / 2) * gap
        s = ln * (0.7 + 0.3 * ((i * 3) % 3) / 2)
        c.line([(x0 + nx * o - ux * s, y0 + ny * o - uy * s), (x0 + nx * o, y0 + ny * o)], cols[i % len(cols)])


def puffs(c, pts, cols, r0, grow, f, f0=0):
    for i, (x, y) in enumerate(pts):
        puff(c, x, y, r0 + grow * (f - f0), cols)


def stars(c, cx, cy, rad, n, f, col, hi, ry=None, spin=0.5, s=1):
    for k in range(n):
        a = k * math.tau / n + f * spin
        x, y = orbit(cx, cy, rad, a, ry)
        c.spark(x, y, s, col, hi)


def cloud(c, x, y, r, cols):
    """몽실 구름 한 덩이(가운데가 크다)."""
    puff(c, x - r * .8, y + r * .15, r * .62, cols)
    puff(c, x + r * .8, y + r * .1, r * .66, cols)
    puff(c, x, y - r * .2, r * .85, cols)


def arrow_lines(c, x, y, ang, ln, col):
    c.line([(x, y), (x + math.cos(ang) * ln, y + math.sin(ang) * ln)], col)


def ellipse_ring(c, cx, cy, rx, ry, col, w=1, ph=0):
    c.ring(cx, cy, rx, col, w, ry)


# ---------------------------------------------------------------- 만들기·검사·검수

def _finish(c, spec):
    fr = spec['frame']
    if spec['anchor'] == 'screen':
        fx_edge.fade_oval(c, 0.32)
    elif fr == 32:
        fx_edge.fade_edges(c, T=1, B=1, L=1, R=1)
    else:
        fx_edge.fade_edges(c, T=3, B=3, L=3, R=3)


def build(key):
    spec = REG[key]
    want = b1_contract().get(key)
    assert want, f'{key}: b1.ts 에 없다'
    got = dict(anchor=spec['anchor'], frame=spec['frame'], frames=spec['frames'])
    assert want == got, f'{key}: 스크립트 {got} != 계약 {want}'
    assert len(spec['pal'].colors) <= 16

    def draw(c, f):
        spec['draw'](c, f)
        _finish(c, spec)
    return LM.build(key, spec['frame'], spec['frames'], spec['pal'], draw)


def check(key):
    spec = REG[key]
    r = LM.check(key, spec['frame'], spec['frames'])
    fr = spec['frame']
    im = Image.open(OUT / f'{key}.png').convert('RGBA')
    cells = [im.crop((i * fr, 0, (i + 1) * fr, fr)) for i in range(spec['frames'])]
    ink = [sum(1 for a in cl.getchannel('A').getdata() if a) for cl in cells]
    diffs = [sum(1 for p, q in zip(cells[i].getdata(), cells[i + 1].getdata()) if p != q) for i in range(len(cells) - 1)]
    weak = [i for i, d in enumerate(diffs) if d < max(8, .05 * min(ink[i], ink[i + 1]))]
    if weak:
        r['errors'].append(f'low motion after {weak}')
        r['ok'] = False
    # 셀 가장자리에 살아 있는 잉크(직선 잘림)
    edge = 0
    for cl in cells:
        a = cl.getchannel('A')
        w = a.width
        edge += sum(1 for x in range(w) if a.getpixel((x, 0)) or a.getpixel((x, w - 1)) or a.getpixel((0, x)) or a.getpixel((w - 1, x)))
    if edge:
        r['errors'].append(f'edge ink {edge}')
        r['ok'] = False
    r['ink'] = ink
    return r


def preview(key):
    """4배(128 은 4배 조각) 미리보기. 각 조각은 가로·세로 1900px 이하."""
    spec = REG[key]
    fr = spec['frame']
    cells = LM.cells_of(key, fr)
    sc = 4
    s = fr * sc
    per_row = max(1, min(len(cells), (1880 - 4) // (s + 4)))
    rows_max = max(1, (1880 - 4) // (s + 18))
    chunk = per_row * rows_max
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    paths = []
    for part, start in enumerate(range(0, len(cells), chunk)):
        sub = cells[start:start + chunk]
        rows = math.ceil(len(sub) / per_row)
        cols = min(per_row, len(sub))
        img = Image.new('RGBA', (cols * (s + 4) + 4, rows * (s + 18) + 4), (12, 14, 24, 255))
        for i, cl in enumerate(sub):
            x = 4 + (i % per_row) * (s + 4)
            y = 4 + (i // per_row) * (s + 18)
            img.paste(Image.new('RGBA', (s, s), BG), (x, y + 14))
            img.alpha_composite(cl.resize((s, s), Image.NEAREST), (x, y + 14))
            LM._label(img, x, y + 2, str(start + i))
        p = REVIEW_DIR / (f'{key}-preview.png' if len(cells) <= chunk else f'{key}-preview-{part}.png')
        img.save(p)
        paths.append(p)
    return paths


def make(key, review=True):
    load_all()
    build(key)
    r = check(key)
    if review:
        preview(key)
        LM.gif(key, REG[key]['frame'])
    print(('OK  ' if r['ok'] else 'FAIL'), key, r['size'], 'colours', r['colours'], 'minFill', r['minFill'], 'minDiff', r['minDiff'], *r['errors'])
    return r


def stage_board(animal, keys=None):
    """가상 무대: 왼쪽에 슬라임(적), 오른쪽에 그 동물(전투 도트 idle) — 시트마다 정점 3칸."""
    load_all()
    keys = keys or [k for k in REG if k.startswith(animal + '_')]
    chip = CHIP[animal]
    sh = Image.open(ROOT / f'public/assets/generated/party-pixel/{chip}.png').convert('RGBA')
    cell = sh.width // 3
    caster = sh.crop((0, 0, cell, cell)).resize((cell * 2, cell * 2), Image.NEAREST)
    slime = Image.open(ROOT / 'public/assets/generated/pixel-enemies/slime.png').convert('RGBA').crop((0, 0, 48, 48)).resize((96, 96), Image.NEAREST)
    W, H = 320, 180
    enemy_feet, ally_feet = (78, 150), (244, 132)
    panels = []
    for ki, key in enumerate(keys):
        spec = REG[key]
        fr, n, anchor = spec['frame'], spec['frames'], spec['anchor']
        cells = LM.cells_of(key, fr)
        for f in (spec['peak'] or [n // 3, n // 2, n - 2]):
            p = Image.new('RGBA', (W, H), BG)
            p.alpha_composite(Image.new('RGBA', (W, 34), (0x2a, 0x34, 0x52, 255)), (0, 146))
            p.alpha_composite(slime, (enemy_feet[0] - 48, enemy_feet[1] - 88))
            p.alpha_composite(caster, (ally_feet[0] - cell, ally_feet[1] - (cell - 4) * 2))
            cl = cells[f].resize((fr * 2, fr * 2), Image.NEAREST)
            if anchor in ('user', 'allAllies'):
                p.alpha_composite(cl, (ally_feet[0] - fr, ally_feet[1] - (fr - 8) * 2))
            elif anchor in ('target', 'allTargets'):
                p.alpha_composite(cl, (enemy_feet[0] - fr, enemy_feet[1] - (fr - 8) * 2))
            elif anchor == 'screen':
                p.alpha_composite(cl, (W // 2 - fr, H // 2 - fr))
            else:
                for j, u in enumerate((.2, .5, .8)):
                    x = int(lerp(ally_feet[0] - 34, enemy_feet[0] + 30, u))
                    y = int(lerp(96, 108, u))
                    p.alpha_composite(cells[(f + j) % n].resize((fr * 2, fr * 2), Image.NEAREST), (x - fr, y - fr))
            LM._label(p, 4, 4, str(ki), 2, (140, 220, 255, 255))
            LM._label(p, 30, 4, str(f), 2)
            panels.append(p)
    cols = 5
    rows_per = 5
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    paths = []
    per_img = cols * rows_per
    for part, start in enumerate(range(0, len(panels), per_img)):
        sub = panels[start:start + per_img]
        rows = math.ceil(len(sub) / cols)
        img = Image.new('RGBA', (cols * (W + 4), rows * (H + 4)), (8, 8, 12, 255))
        for i, pn in enumerate(sub):
            img.paste(pn, ((i % cols) * (W + 4), (i // cols) * (H + 4)))
        path = REVIEW_DIR / f'{animal}-board-{part}.png'
        img.save(path)
        paths.append(path)
    return paths


def run(args):
    load_all()
    keys = []
    animals = []
    for a in args or ANIMALS:
        if a in ANIMALS:
            animals.append(a)
            keys += [k for k in REG if k.startswith(a + '_')]
        else:
            keys.append(a)
    res = [make(k) for k in keys]
    for a in animals:
        for p in stage_board(a):
            print(p)
    return res


if __name__ == '__main__':
    import lib_r2w5 as _self   # __main__ 이 아닌 모듈 사본에 시트가 등록된다
    res = _self.run(sys.argv[1:])
    sys.exit(0 if all(r['ok'] for r in res) else 1)
