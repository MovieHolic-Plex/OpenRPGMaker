"""lib_nm6 — 묶음 m6(OPRN 자체 Monster6 8명) 새 이펙트 시트 공용 모듈.

규격(retroClassSkills.ts 머리 주석): 가로 스트립 frame x frames, 알파 0/255, 시트당 ≤16색. 좌표·수식으로만 찍는다(리샘플·블러·AI 없음).
  * 시트 하나 = pixel-fx/<key>.py 하나. 그 파일이 팔레트와 draw(c, f, t) 를 갖고 make(...) 를 부른다(t = f/(frames-1)).
  * 마무리: screen(128) 은 fx_edge.fade_oval, 나머지는 fx_edge.fade_edges(32 는 1px, 64 는 5px 띠).
  * 검사: 크기·알파·≤16색·빈 칸·이웃 칸 다름·src/assets/retroRosterSkills/m6.ts 정의(frame·frames·anchor)와 일치.
  * 방향: 아군 스킬 — 적은 왼쪽, 시전자는 오른쪽. 투사체 첫 칸은 왼쪽(진행 방향)을 본다.
  * 확인판: .omo/nm6/fx/<key>.png (4배, 128 은 2배, 가로 1900px 이하로 줄바꿈).
"""
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import fx_edge  # noqa: E402

OUT = ROOT / 'public/assets/generated/pixel-fx'
QA = ROOT / '.omo/nm6/fx'
BATCH = ROOT / 'src/assets/retroRosterSkills/m6.ts'
BAYER = fx_edge.BAYER


def lerp(a, b, t):
    return a + (b - a) * t


def ease(t):
    return 1 - (1 - t) ** 2


def rng(seed):
    return np.random.default_rng(seed)


class Cell:
    """팔레트 색인 칸. a[y, x] = 0 투명, 1.. = 팔레트 번호. fx_edge 는 .a 를 본다."""

    def __init__(s, n):
        s.n = n
        s.a = np.zeros((n, n), np.uint8)
        yy, xx = np.mgrid[0:n, 0:n]
        s.X, s.Y = xx + 0.5, yy + 0.5
        s.thr = (BAYER[yy % 4, xx % 4] + 0.5) / 16.0

    # 마스크
    def disc(s, x, y, r):
        return (s.X - x) ** 2 + (s.Y - y) ** 2 <= r * r

    def ell(s, x, y, rx, ry, ang=0.0):
        a = math.radians(ang)
        u = (s.X - x) * math.cos(a) + (s.Y - y) * math.sin(a)
        v = -(s.X - x) * math.sin(a) + (s.Y - y) * math.cos(a)
        return (u / max(rx, 0.1)) ** 2 + (v / max(ry, 0.1)) ** 2 <= 1.0

    def ring(s, x, y, r, th=1.5):
        d = np.hypot(s.X - x, s.Y - y)
        return (d <= r) & (d > r - th)

    def arc(s, x, y, r, th, a0, a1):
        """각도: 0 오른쪽 · 90 아래 · 180 왼쪽 · 270 위(도, 시계 방향으로 a0→a1)."""
        ang = np.degrees(np.arctan2(s.Y - y, s.X - x)) % 360
        span = (a1 - a0) % 360 or 360
        sel = ((ang - a0) % 360) <= span
        return s.ring(x, y, r, th) & sel

    def poly(s, pts):
        im = Image.new('L', (s.n, s.n), 0)
        ImageDraw.Draw(im).polygon([(float(x), float(y)) for x, y in pts], fill=255)
        return np.array(im) > 0

    def seg(s, x0, y0, x1, y1, w=1.0):
        dx, dy = x1 - x0, y1 - y0
        L2 = dx * dx + dy * dy or 1e-6
        t = np.clip(((s.X - x0) * dx + (s.Y - y0) * dy) / L2, 0, 1)
        return np.hypot(s.X - (x0 + t * dx), s.Y - (y0 + t * dy)) <= w / 2

    # 칠
    def fill(s, m, c):
        s.a[m] = c

    def dith(s, m, c, level):
        """level 0..1 비율만큼 Bayer 순서로 채운다(알파는 0/255 그대로)."""
        s.a[m & (s.thr < level)] = c

    def clear(s, m):
        s.a[m] = 0

    def px(s, x, y, c):
        X, Y = int(math.floor(x)), int(math.floor(y))
        if 0 <= X < s.n and 0 <= Y < s.n:
            s.a[Y, X] = c

    def star(s, x, y, n, c, core=None):
        for d in range(-n, n + 1):
            s.px(x + d, y, c)
            s.px(x, y + d, c)
        if core:
            s.px(x, y, core)

    def xstar(s, x, y, n, c):
        for d in range(-n, n + 1):
            s.px(x + d, y + d, c)
            s.px(x + d, y - d, c)

    def outline(s, c):
        m = s.a > 0
        g = m.copy()
        g[1:] |= m[:-1]; g[:-1] |= m[1:]; g[:, 1:] |= m[:, :-1]; g[:, :-1] |= m[:, 1:]
        s.a[g & ~m] = c

    def shard(s, x, y, size, ang, c, cd=None):
        a = math.radians(ang)
        ux, uy = math.cos(a), math.sin(a)
        nx, ny = -uy, ux
        pts = [(x + ux * size, y + uy * size), (x + nx * size * .4, y + ny * size * .4),
               (x - ux * size * .6, y - uy * size * .6), (x - nx * size * .4, y - ny * size * .4)]
        s.fill(s.poly(pts), c)
        if cd:
            s.fill(s.seg(x, y, x - ux * size * .5, y - uy * size * .5, 1), cd)

    def zig(s, x0, y0, x1, y1, n, amp, c, seed=1, w=1.0):
        r = rng(seed)
        pts = [(x0, y0)]
        for i in range(1, n):
            t = i / n
            pts.append((lerp(x0, x1, t) + r.uniform(-amp, amp), lerp(y0, y1, t) + r.uniform(-amp, amp)))
        pts.append((x1, y1))
        for p, q in zip(pts, pts[1:]):
            s.fill(s.seg(p[0], p[1], q[0], q[1], w), c)


def _spec(key):
    if not BATCH.exists():
        return None
    m = re.search(r'\{ key: "%s", anchor: "([a-zA-Z]+)", frame: (\d+), frames: (\d+) \}' % re.escape(key), BATCH.read_text())
    return (m.group(1), int(m.group(2)), int(m.group(3))) if m else None


def make(key, frame, frames, anchor, pal, draw, edge=None):
    assert 1 <= len(pal) <= 15, 'palette ≤15 + 투명'
    spec = _spec(key)
    if spec and spec != (anchor, frame, frames):
        raise SystemExit(f'{key}: m6.ts 정의 {spec} != 생성기 {(anchor, frame, frames)}')
    cells = []
    for f in range(frames):
        c = Cell(frame)
        draw(c, f, f / max(1, frames - 1))
        if anchor == 'screen':
            fx_edge.fade_oval(c)
        else:
            b = edge if edge is not None else (1 if frame == 32 else 5)
            fx_edge.fade_edges(c, T=b, B=b, L=b, R=b)
        cells.append(c.a.copy())
    strip = np.concatenate(cells, axis=1)
    rgb = np.array([(0, 0, 0)] + [tuple(p) for p in pal], np.uint8)
    out = np.zeros(strip.shape + (4,), np.uint8)
    out[..., :3] = rgb[strip]
    out[..., 3] = np.where(strip > 0, 255, 0)
    im = Image.fromarray(out, 'RGBA')
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / f'{key}.png')
    bad = check(im, frame, frames)
    preview(key, im, frame, frames)
    print(key, f'{frame}x{frames}', anchor, 'OK' if not bad else bad)
    if bad:
        raise SystemExit(1)


def check(im, frame, frames):
    a = np.array(im)
    bad = []
    if im.size != (frame * frames, frame):
        bad.append(f'size {im.size}')
    if not set(np.unique(a[..., 3])) <= {0, 255}:
        bad.append('alpha')
    cols = {tuple(c) for c in a[a[..., 3] > 0][:, :3]}
    if len(cols) > 16:
        bad.append(f'colors {len(cols)}')
    cs = [a[:, i * frame:(i + 1) * frame] for i in range(frames)]
    for i, c in enumerate(cs):
        if not c[..., 3].any():
            bad.append(f'frame {i} empty')
        if i and np.array_equal(c, cs[i - 1]):
            bad.append(f'frame {i} == {i - 1}')
    return bad


def preview(key, im, frame, frames):
    z = 2 if frame == 128 else 4
    per = max(1, 1900 // (frame * z))
    rows = (frames + per - 1) // per
    cols = min(per, frames)
    W, H = cols * frame * z, rows * frame * z
    bg = Image.new('RGBA', (W, H), (40, 48, 72, 255))
    d = ImageDraw.Draw(bg)
    for i in range(frames):
        x, y = i % per * frame * z, i // per * frame * z
        if i % 2:
            d.rectangle([x, y, x + frame * z - 1, y + frame * z - 1], fill=(34, 41, 62, 255))
        cell = im.crop((i * frame, 0, (i + 1) * frame, frame)).resize((frame * z, frame * z), Image.NEAREST)
        bg.alpha_composite(cell, (x, y))
    QA.mkdir(parents=True, exist_ok=True)
    bg.save(QA / f'{key}.png')

