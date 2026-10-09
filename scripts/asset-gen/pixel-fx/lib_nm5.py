"""lib_nm5 — retro2003 로스터 m5(Monster5 저주받은 물건 8명) 스킬 이펙트 공용 모듈. 좌표·수식 도트(PIL 마스크), 블러·안티에일리어스 없음.

각 <key>.py 는 KEY, SIZE, FRAMES, PAL(hex 목록, ≤15), draw(c, f, t) 를 정의하고 run(globals()) 를 부른다.
run() 은 src/assets/retroRosterSkills/m5.ts 의 그 키 레이어(frame·frames)와 스크립트가 다르면 멈추고,
가장자리를 지운다: SIZE 128(screen) = fade_oval 필수, 64 몸 위 층 = fade_edges(EDGE 로 조절).
산출 public/assets/generated/pixel-fx/<key>.png (가로 스트립, 알파 0/255, ≤16색), 확인판 .omo/nm5/fx/<key>.png.
셀 규약(retroClassSkills.ts 머리 주석): 64 셀 발 밑 = 행 56, 몸 중심 (32, 34). projectile 32 루프, 첫 칸이 왼쪽을 본다.
'python3 lib_nm5.py' 는 m5 의 새 키를 모두 다시 굽고 .omo/nm5/d-fx-preview-*.png 를 만든다.
"""
import importlib.util
import math
import re
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.dont_write_bytecode = True
from fx_edge import fade_edges, fade_oval  # noqa: E402

ROOT = HERE.parents[2]
OUT = ROOT / 'public/assets/generated/pixel-fx'
REVIEW = ROOT / '.omo/nm5/fx'
CONTRACT = ROOT / 'src/assets/retroRosterSkills/m5.ts'
NEW_KEYS_PREFIX = ('mimic_pal_', 'living_armor_', 'lantern_ghost_', 'doll_', 'book_demon_', 'scarecrow_', 'clockwork_', 'candle_imp_')


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


class Cell:
    """색인 캔버스. a == 0 투명, 1.. = PAL 순서."""

    def __init__(self, size):
        self.s = size
        self.a = np.zeros((size, size), np.uint8)

    def _m(self, fn):
        im = Image.new('1', (self.s, self.s), 0)
        fn(ImageDraw.Draw(im))
        return np.array(im, bool)

    def fill(self, m, k):
        self.a[m] = k
        return m

    def ell(self, cx, cy, rx, ry, k):
        yy, xx = np.mgrid[0:self.s, 0:self.s]
        m = ((xx + .5 - cx) / max(rx, .5)) ** 2 + ((yy + .5 - cy) / max(ry, .5)) ** 2 <= 1
        return self.fill(m, k)

    def poly(self, pts, k):
        return self.fill(self._m(lambda d: d.polygon([tuple(p) for p in pts], fill=1, outline=1)), k)

    def line(self, pts, k, w=1):
        return self.fill(self._m(lambda d: d.line([tuple(p) for p in pts], fill=1, width=w)), k)

    def rect(self, x0, y0, x1, y1, k):
        return self.fill(self._m(lambda d: d.rectangle([min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1)], fill=1)), k)

    def px(self, x, y, k):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.s and 0 <= y < self.s:
            self.a[y, x] = k

    def ring(self, cx, cy, rx, ry, k, w=1.0, gap=0, phase=0.0):
        yy, xx = np.mgrid[0:self.s, 0:self.s]
        r = np.hypot((xx + .5 - cx) / max(rx, .5), (yy + .5 - cy) / max(ry, .5))
        m = np.abs(r - 1) * max(rx, ry) <= w / 2 + .01
        if gap:
            ang = np.arctan2(yy + .5 - cy, xx + .5 - cx) + phase
            m &= (np.floor((ang + math.pi) / (2 * math.pi) * gap * 2) % 2) == 0
        return self.fill(m, k)

    def arc(self, cx, cy, r, a0, a1, k, w=1):
        n = max(4, int(abs(a1 - a0) / 6))
        pts = [(cx + math.cos(math.radians(a0 + (a1 - a0) * i / n)) * r, cy + math.sin(math.radians(a0 + (a1 - a0) * i / n)) * r) for i in range(n + 1)]
        return self.line(pts, k, w)

    def star(self, x, y, r, k, k2=None):
        for i in range(8):
            a = i * math.pi / 4
            rr = r if i % 2 == 0 else r * .5
            self.line([(x, y), (x + math.cos(a) * rr, y + math.sin(a) * rr)], k)
        if k2:
            self.px(x, y, k2)

    def flame(self, x, y, h, w, ks, sway=0.0):
        """위로 타오르는 불꽃. ks = (바깥, 가운데, 속) 색."""
        d, m, l = ks
        self.poly([(x - w, y), (x - w * 1.1, y - h * .35), (x - w * .4 + sway * .4, y - h * .7), (x + sway, y - h),
                   (x + w * .6 + sway * .5, y - h * .6), (x + w * 1.1, y - h * .3), (x + w, y)], d)
        self.poly([(x - w * .55, y - .5), (x - w * .5, y - h * .4), (x + sway * .6, y - h * .75), (x + w * .5, y - h * .35), (x + w * .5, y - .5)], m)
        self.poly([(x - w * .2, y - 1), (x + sway * .3, y - h * .45), (x + w * .25, y - 1)], l)

    def outline(self, k, src=None):
        """src 색(들) 둘레 바깥 1px 을 k 로(투명 칸에만)."""
        m = self.a > 0 if src is None else np.isin(self.a, src)
        p = np.pad(m, 1)
        ring = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]) & ~m
        self.a[ring & (self.a == 0)] = k


def ease(t):
    return 1 - (1 - t) ** 2


def rng(seed):
    return np.random.default_rng(seed)


def contract():
    text = CONTRACT.read_text(encoding='utf8')
    out = {}
    for m in re.finditer(r'key: "(\w+)", anchor: "(\w+)", frame: (\d+), frames: (\d+)', text):
        spec = (int(m.group(3)), int(m.group(4)))
        if m.group(1) in out and out[m.group(1)][1:] != spec:
            raise SystemExit(f'{m.group(1)}: m5.ts lists two different specs')
        out.setdefault(m.group(1), (m.group(2),) + spec)
    return out


def render(mod):
    S, N = mod['SIZE'], mod['FRAMES']
    pal = [hexrgb(h) for h in mod['PAL']]
    assert len(pal) <= 15, 'palette > 15'
    strip = np.zeros((S, S * N, 4), np.uint8)
    for f in range(N):
        c = Cell(S)
        mod['draw'](c, f, f / max(N - 1, 1))
        if S == 128:
            fade_oval(c, mod.get('OVAL', .3))
        elif S == 64 and mod.get('EDGE') != 'none':
            fade_edges(c, **(mod.get('EDGE') or dict(T=6, B=4, L=6, R=6)))
        c.a[0, :] = c.a[-1, :] = 0
        c.a[:, 0] = c.a[:, -1] = 0
        for i, rgb in enumerate(pal, 1):
            strip[:, f * S:(f + 1) * S][c.a == i] = rgb + (255,)
    return strip


def check(strip, S, N):
    errs = []
    if strip.shape != (S, S * N, 4):
        errs.append('size')
    if not np.isin(strip[:, :, 3], (0, 255)).all():
        errs.append('alpha')
    cols = {tuple(v) for v in strip[strip[:, :, 3] == 255][:, :3]}
    if len(cols) > 16:
        errs.append(f'colors {len(cols)}')
    cells = []
    for f in range(N):
        cell = strip[:, f * S:(f + 1) * S]
        if not (cell[:, :, 3] > 0).any():
            errs.append(f'frame {f} empty')
        cells.append(cell.tobytes())
    if len(set(cells)) != N:
        errs.append('duplicate frames')
    return errs


def run(mod):
    key, S, N = mod['KEY'], mod['SIZE'], mod['FRAMES']
    spec = contract().get(key)
    if spec is None or spec[1:] != (S, N):
        raise SystemExit(f'{key}: script {S}x{N} vs m5.ts {spec}')
    strip = render(mod)
    errs = check(strip, S, N)
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(strip).save(OUT / f'{key}.png')
    REVIEW.mkdir(parents=True, exist_ok=True)
    z = 4 if S <= 64 else 2
    bg = Image.new('RGBA', (S * N * z, S * z), (28, 32, 52, 255))
    bg.alpha_composite(Image.fromarray(strip).resize((S * N * z, S * z), Image.NEAREST))
    bg.save(REVIEW / f'{key}.png')
    print(f'{key} {S}x{N} errors: {errs or "none"}')
    return errs


def load(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def new_keys():
    return [k for k in contract() if k.startswith(NEW_KEYS_PREFIX)]


def preview(keys, maxw=1880):
    """새 키 미리보기: 줄마다 키 하나(64 이하 2배, 128 1배), 너비 maxw 이하."""
    rows = []
    for k in keys:
        im = Image.open(OUT / f'{k}.png')
        S = im.height
        z = 2 if S <= 64 else 1
        im = im.resize((im.width * z, im.height * z), Image.NEAREST)
        if im.width > maxw:
            im = im.crop((0, 0, maxw - maxw % (S * z), im.height))
        rows.append(im)
    H = sum(r.height + 4 for r in rows)
    W = max(r.width for r in rows)
    bg = Image.new('RGBA', (W, H), (28, 32, 52, 255))
    y = 0
    for r in rows:
        bg.alpha_composite(r, (0, y))
        y += r.height + 4
    return bg


if __name__ == '__main__':
    keys = sys.argv[1:] or new_keys()
    bad = {}
    for k in keys:
        errs = run(vars(load(HERE / f'{k}.py')))
        if errs:
            bad[k] = errs
    half = (len(keys) + 1) // 2
    preview(keys[:half]).save(ROOT / '.omo/nm5/d-fx-preview-1.png')
    preview(keys[half:]).save(ROOT / '.omo/nm5/d-fx-preview-2.png')
    print('bad:', bad or 'none')

