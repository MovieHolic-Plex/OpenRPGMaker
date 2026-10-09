"""묶음 m4(Monster4 숲·요괴) 새 이펙트 시트 공용 모듈 — 13장.

모든 도형은 정수 좌표 다각형·타원·선으로 찍는다(리샘플·블러·AI 도구 없음). RGBA 캔버스, 알파 0/255, 시트당 ≤16색.
  * 규격 정본은 SHEETS(키 → frame·frames·anchor·팔레트·draw). gen_nm4_ts.py 가 이 표를 읽어 m4.ts 에 그대로 적는다.
  * 마무리: screen 128 은 fx_edge.fade_oval, 몸 위 층(user·target·allTargets·allAllies)은 fade_edges, 투사체 32 는 1px.
  * 방향: 아군 스킬 — 적은 왼쪽. 투사체 첫 칸은 왼쪽을 본다(머리가 왼쪽).
  * 검사: 크기·알파·색 수·빈 칸·이웃 칸 다름·가장자리 잉크 0. 미리보기 .omo/nm4/fx/<키>.png(4배, 1900px 이하).

    python3 scripts/asset-gen/pixel-fx/lib_nm4.py            # 13장 전부 + 미리보기
    python3 scripts/asset-gen/pixel-fx/lib_nm4.py treant_roots
"""
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import fx_edge  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / 'public/assets/generated/pixel-fx'
QA = ROOT / '.omo/nm4/fx'
BG = (34, 40, 58, 255)


def H(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


class C:
    """한 칸. 팔레트 이름으로 칠한다."""

    def __init__(self, size, pal):
        self.s = size
        self.pal = {k: H(v) for k, v in pal.items()}
        self.im = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def c(self, n):
        return self.pal[n]

    def ell(self, cx, cy, rx, ry, n):
        if rx < 0.5 or ry < 0.5:
            self.px(cx, cy, n)
            return
        self.d.ellipse([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], fill=self.c(n))

    def ring(self, cx, cy, rx, ry, n, w=1):
        if rx < 1 or ry < 1:
            return
        self.d.ellipse([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], outline=self.c(n), width=w)

    def arc(self, cx, cy, rx, ry, a0, a1, n, w=1):
        if rx < 1 or ry < 1:
            return
        self.d.arc([round(cx - rx), round(cy - ry), round(cx + rx), round(cy + ry)], a0, a1, fill=self.c(n), width=w)

    def poly(self, pts, n):
        self.d.polygon([(round(x), round(y)) for x, y in pts], fill=self.c(n))

    def line(self, pts, n, w=1):
        self.d.line([(round(x), round(y)) for x, y in pts], fill=self.c(n), width=w)

    def rect(self, x0, y0, x1, y1, n):
        self.d.rectangle([round(min(x0, x1)), round(min(y0, y1)), round(max(x0, x1)), round(max(y0, y1))], fill=self.c(n))

    def px(self, x, y, n):
        x, y = round(x), round(y)
        if 0 <= x < self.s and 0 <= y < self.s:
            self.im.putpixel((x, y), self.c(n))

    def spark(self, x, y, r, n, core=None):
        for i in range(-r, r + 1):
            self.px(x + i, y, n)
            self.px(x, y + i, n)
        if core:
            self.px(x, y, core)

    def star(self, cx, cy, r, n, core=None, rot=0.0):
        pts = []
        for i in range(8):
            a = rot + i * math.pi / 4
            rr = r if i % 2 == 0 else r * 0.35
            pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
        self.poly(pts, n)
        if core:
            self.px(cx, cy, core)


def ease(t):
    return 1 - (1 - t) ** 2


def rng(key, salt=0):
    return random.Random(f'{key}:{salt}')


SHEETS = {}


def sheet(key, frame, frames, anchor, pal):
    def deco(fn):
        SHEETS[key] = dict(key=key, frame=frame, frames=frames, anchor=anchor, pal=pal, draw=fn)
        return fn
    return deco


def finish(c, spec):
    if spec['anchor'] == 'screen':
        fx_edge.fade_oval(c, 0.32)
    elif spec['frame'] == 32:
        fx_edge.fade_edges(c, T=1, B=1, L=1, R=1)
    else:
        fx_edge.fade_edges(c, T=3, B=3, L=3, R=3)


def build(key):
    spec = SHEETS[key]
    fr, n = spec['frame'], spec['frames']
    assert len(spec['pal']) <= 16, key
    strip = Image.new('RGBA', (fr * n, fr), (0, 0, 0, 0))
    for f in range(n):
        c = C(fr, spec['pal'])
        spec['draw'](c, f, n)
        finish(c, spec)
        strip.paste(c.im, (f * fr, 0))
    OUT.mkdir(parents=True, exist_ok=True)
    strip.save(OUT / f'{key}.png')
    return strip


def check(key):
    spec = SHEETS[key]
    fr, n = spec['frame'], spec['frames']
    a = np.array(Image.open(OUT / f'{key}.png').convert('RGBA'))
    errs = []
    if a.shape[:2] != (fr, fr * n):
        errs.append('size')
    if not np.isin(a[:, :, 3], (0, 255)).all():
        errs.append('alpha')
    cols = {tuple(v) for v in a[a[:, :, 3] == 255][:, :3]}
    if len(cols) > 16:
        errs.append(f'colours {len(cols)}')
    cells = [a[:, i * fr:(i + 1) * fr] for i in range(n)]
    ink = [int((c[:, :, 3] > 0).sum()) for c in cells]
    if min(ink) == 0:
        errs.append(f'empty cell {ink.index(0)}')
    for i in range(n - 1):
        d = int((cells[i] != cells[i + 1]).any(2).sum())
        if d < max(8, 0.05 * min(ink[i], ink[i + 1])):
            errs.append(f'low motion {i}')
    edge = sum(int(c[0, :, 3].any() + c[-1, :, 3].any() + c[:, 0, 3].any() + c[:, -1, 3].any()) for c in cells)
    if edge:
        errs.append(f'edge ink {edge}')
    return dict(key=key, colours=len(cols), ink=ink, errors=errs)


def preview(key):
    spec = SHEETS[key]
    fr, n = spec['frame'], spec['frames']
    strip = Image.open(OUT / f'{key}.png').convert('RGBA')
    sc = 4 if fr <= 64 else 2
    s = fr * sc
    per = max(1, min(n, 1880 // (s + 4)))
    rows = math.ceil(n / per)
    img = Image.new('RGBA', (per * (s + 4) + 4, rows * (s + 4) + 4), (12, 14, 24, 255))
    for i in range(n):
        cell = strip.crop((i * fr, 0, (i + 1) * fr, fr)).resize((s, s), Image.NEAREST)
        x, y = 4 + i % per * (s + 4), 4 + i // per * (s + 4)
        img.paste(Image.new('RGBA', (s, s), BG), (x, y))
        img.alpha_composite(cell, (x, y))
    QA.mkdir(parents=True, exist_ok=True)
    img.save(QA / f'{key}.png')


def make(key):
    import nm4_sheets  # noqa: F401  (@sheet 등록)
    build(key)
    r = check(key)
    preview(key)
    print('OK  ' if not r['errors'] else 'FAIL', key, 'colours', r['colours'], 'minInk', min(r['ink']), *r['errors'])
    return r


def _register():
    try:
        import nm4_sheets  # noqa: F401
    except ModuleNotFoundError:
        pass


_register()

if __name__ == '__main__':
    import lib_nm4 as _m  # 같은 모듈 한 벌로 등록·빌드(__main__ 과 lib_nm4 가 둘로 갈리지 않게)
    keys = sys.argv[1:] or list(_m.SHEETS)
    bad = [k for k in keys if _m.make(k)['errors']]
    sys.exit(1 if bad else 0)
