"""pp15_nm4 — retro2003 파티원 15칸 시트 공용 빌더 (묶음 m4, OPRN 자체 칩 Monster4).

원칙
  - 대기 칸 = 걷기 칩(public/assets/generated/charsets/Monster4.png)의 **왼쪽 보기 서 있는 칸(행 3 · 열 1)을 1배 그대로**.
    사람 파티원 전투 도트(charset-battlers, 칩 × 1)와 같은 키가 되도록 키우지 않는다. 셀 48, 가로 중심 24, 칩 30줄(발 외곽선) → 셀 y 44.
  - 다른 칸은 칩 픽셀만 옮긴다: 행 단위 밀기(기울임), 윗몸 눌림(호흡·웅크림), 걷기 패턴 0·2, 90° 회전(쓰러짐),
    팔레트 안에서 한 단 밝게/어둡게(피격 번쩍·쓰러짐). 새 색은 캐릭터별 효과색(≤3)만 — 시트 전체 ≤16색.
  - 효과(물대포·여우불·포자·뿌리…)는 캐릭터 파일이 칸별 함수로 좌표를 찍는다. 그림은 처음부터 왼쪽(적 쪽)을 본다.
산출: public/assets/generated/party-pixel/monster4-<i>.png (144×240, 3열×5행) + .omo/nm4/board-monster4-<i>.png.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/party-pixel'
QA = ROOT / '.omo/nm4'
CHARSET = ROOT / 'public/assets/generated/charsets/Monster4.png'
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead',
         'cast_charge', 'cast_raise', 'cast_release', 'leap', 'buff', 'finisher']
CELL = 48
FLOOR = 44
BG = (40, 56, 72)
PAD = 8


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def chip(index, row=3, col=1):
    a = np.array(Image.open(CHARSET).convert('RGBA'))
    bx, by = index % 4 * 72, index // 4 * 128
    cell = a[by + row * 32: by + row * 32 + 32, bx + col * 24: bx + col * 24 + 24]
    # 위에 빈 줄 PAD 를 둔다: 늘이기(stretch)가 칸 위로 잘리지 않게.
    out = np.zeros((32 + PAD, 24, 4), np.uint8)
    out[PAD:] = cell
    return out


def palette_of(img):
    cols = {tuple(int(v) for v in px[:3]) for px in img[img[:, :, 3] == 255]}
    return sorted(cols, key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])


# ───────────────────────── 칩 픽셀 변형 ─────────────────────────
def lean(img, amount, pivot=None):
    """행 밀기: 발(아래) 고정, 위로 갈수록 amount 만큼(음수 = 왼쪽 = 앞)."""
    h = img.shape[0]
    ys = np.nonzero(img[:, :, 3].any(1))[0]
    top, bot = (ys.min(), ys.max()) if ys.size else (0, h - 1)
    pivot = bot if pivot is None else pivot
    out = np.zeros_like(img)
    for y in range(h):
        t = 0 if y >= pivot else (pivot - y) / max(1, pivot - top)
        dx = int(round(amount * t))
        out[y] = np.roll(img[y], dx, axis=0)
        if dx > 0:
            out[y, :dx] = 0
        elif dx < 0:
            out[y, dx:] = 0
    return out


def squash(img, rows=1, split=None):
    """윗몸을 rows 줄 내린다(split 줄 위를 통째로 내리고 split 아래 rows 줄을 지운다) — 웅크림·호흡."""
    ys = np.nonzero(img[:, :, 3].any(1))[0]
    top, bot = ys.min(), ys.max()
    split = (top + bot) // 2 if split is None else split
    out = img.copy()
    out[top:split + rows] = 0
    out[top + rows:split + rows] = img[top:split]
    return out


def stretch(img, rows=1, split=None):
    """윗몸을 rows 줄 올린다(split 줄을 복제해 채운다) — 시전 고조·기합."""
    ys = np.nonzero(img[:, :, 3].any(1))[0]
    top, bot = ys.min(), ys.max()
    split = (top + bot) // 2 if split is None else split
    out = img.copy()
    out[top - rows:split - rows + 1] = img[top:split + 1]
    for r in range(rows):
        out[split - r] = img[split]
    return out


def shift(img, dx, dy):
    out = np.zeros_like(img)
    h, w = img.shape[:2]
    ys, xs = np.nonzero(img[:, :, 3])
    ny, nx = ys + dy, xs + dx
    ok = (ny >= 0) & (ny < h) & (nx >= 0) & (nx < w)
    out[ny[ok], nx[ok]] = img[ys[ok], xs[ok]]
    return out


def recolor(img, pal, step):
    """팔레트 안에서 밝기 순위 step 단 이동(+ 밝게, − 어둡게). 외곽선(가장 어두운 색)은 그대로."""
    out = img.copy()
    idx = {c: i for i, c in enumerate(pal)}
    m = img[:, :, 3] == 255
    for y, x in zip(*np.nonzero(m)):
        c = tuple(int(v) for v in img[y, x, :3])
        i = idx[c]
        if i == 0:
            continue
        j = min(len(pal) - 1, max(1, i + step))
        out[y, x, :3] = pal[j]
    return out


def flash_outline(img, pal):
    """피격 번쩍: 외곽선(칩의 가장 어두운 색)만 팔레트 가장 밝은 색으로. 몸 색은 그대로라 같은 캐릭터로 읽힌다."""
    out = img.copy()
    dark = pal[0]
    m = (img[:, :, 3] == 255) & (img[:, :, :3] == dark).all(2)
    out[m, :3] = pal[-1]
    return out


def lay_down(img):
    """뒤로 쓰러짐: 시계 방향 90°(머리가 오른쪽 = 적 반대쪽)."""
    r = np.ascontiguousarray(np.rot90(img, k=-1))
    return r


class Frame:
    """48×48 셀. 칩(24×32)을 x0=12, y0=14 에 두면 칩 30줄이 바닥 44 에 닿는다."""

    def __init__(self):
        self.a = np.zeros((CELL, CELL, 4), np.uint8)

    def put(self, img, dx=0, dy=0, x0=None, y0=None):
        h, w = img.shape[:2]
        x0 = (CELL - w) // 2 if x0 is None else x0
        y0 = FLOOR - 30 - PAD if y0 is None else y0
        ys, xs = np.nonzero(img[:, :, 3])
        ny, nx = ys + y0 + dy, xs + x0 + dx
        ok = (ny >= 0) & (ny < CELL) & (nx >= 0) & (nx < CELL)
        self.a[ny[ok], nx[ok]] = img[ys[ok], xs[ok]]

    def put_floor(self, img, dx=0):
        ys, xs = np.nonzero(img[:, :, 3])
        crop = img[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        h, w = crop.shape[:2]
        self.put(crop, x0=(CELL - w) // 2 + dx, y0=FLOOR - h + 1)

    # 효과 찍기(색은 RGB 튜플)
    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < CELL and 0 <= y < CELL:
            self.a[y, x] = c + (255,)

    def px_under(self, x, y, c):
        """몸 뒤(빈 칸에만)."""
        x, y = int(round(x)), int(round(y))
        if 0 <= x < CELL and 0 <= y < CELL and self.a[y, x, 3] == 0:
            self.a[y, x] = c + (255,)

    def _draw(self, fn, under=False):
        im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        fn(d)
        b = np.array(im)
        m = b[:, :, 3] > 0
        if under:
            m &= self.a[:, :, 3] == 0
        self.a[m] = b[m]
        self.a[m, 3] = 255

    def ell(self, x0, y0, x1, y1, c, under=False):
        self._draw(lambda d: d.ellipse([x0, y0, x1, y1], fill=c), under)

    def ring(self, x0, y0, x1, y1, c, w=1, under=False):
        self._draw(lambda d: d.ellipse([x0, y0, x1, y1], outline=c, width=w), under)

    def poly(self, pts, c, under=False):
        self._draw(lambda d: d.polygon([tuple(p) for p in pts], fill=c), under)

    def line(self, pts, c, w=1, under=False):
        self._draw(lambda d: d.line([tuple(p) for p in pts], fill=c, width=w), under)

    def arc(self, box, a0, a1, c, w=1, under=False):
        self._draw(lambda d: d.arc(list(box), a0, a1, fill=c, width=w), under)

    def rect(self, x0, y0, x1, y1, c, under=False):
        self._draw(lambda d: d.rectangle([x0, y0, x1, y1], fill=c), under)

    def spark(self, x, y, r, c, core=None):
        for i in range(-r, r + 1):
            self.px(x + i, y, c)
            self.px(x, y + i, c)
        if core:
            self.px(x, y, core)

    def dust(self, x, y, c, n=3, dir=1):
        for i in range(n):
            self.px(x + dir * i * 2, y - (i % 2), c)
            self.px(x + dir * i * 2 + dir, y, c)

    def shadow(self, cx, w, c):
        for x in range(cx - w, cx + w + 1):
            if (x + FLOOR) % 2 == 0 or abs(x - cx) < w - 1:
                self.px(x, FLOOR, c)


# ───────────────────────── 조립 · 검사 · 확인판 ─────────────────────────
def base_frames(index, floating=False):
    """모든 캐릭터가 같이 쓰는 칩 변형 15개. 캐릭터 파일이 효과를 덧칠한다."""
    stand = chip(index, 3, 1)
    walk0 = chip(index, 3, 0)
    walk2 = chip(index, 3, 2)
    pal = palette_of(np.concatenate([stand, walk0, walk2], axis=1))
    lift = -1 if floating else 0
    f = {}
    fr = Frame(); fr.put(stand); f['idle_a'] = fr
    fr = Frame(); fr.put(squash(stand, 1) if not floating else stand, dy=1 if floating else 0); f['idle_b'] = fr
    fr = Frame(); fr.put(lean(stand, -1), dy=lift); f['idle_c'] = fr
    fr = Frame(); fr.put(lean(squash(stand, 2), 3), dx=1); f['windup'] = fr
    fr = Frame(); fr.put(lean(walk0, -2), dx=-3, dy=lift); f['move'] = fr
    fr = Frame(); fr.put(lean(walk2, -4), dx=-6); f['attack'] = fr
    fr = Frame(); fr.put(lean(squash(walk2, 1), -1), dx=-2); f['recover'] = fr
    fr = Frame(); fr.put(flash_outline(lean(stand, 3), pal), dx=3); f['hit'] = fr
    fr = Frame(); fr.put_floor(lay_down(stand), dx=2); f['dead'] = fr
    fr = Frame(); fr.put(squash(stand, 1)); f['cast_charge'] = fr
    fr = Frame(); fr.put(lean(stretch(stand, 1), 1)); f['cast_raise'] = fr
    fr = Frame(); fr.put(lean(stand, -3), dx=-2); f['cast_release'] = fr
    fr = Frame(); fr.put(lean(squash(walk0, 2), -2), dy=-10); f['leap'] = fr
    fr = Frame(); fr.put(stretch(stand, 1), dy=lift); f['buff'] = fr
    fr = Frame(); fr.put(lean(walk0, -5), dx=-7); f['finisher'] = fr
    return f, stand, pal


def assemble(frames):
    sheet = np.zeros((CELL * 5, CELL * 3, 4), np.uint8)
    for i, n in enumerate(NAMES):
        x, y = i % 3 * CELL, i // 3 * CELL
        sheet[y:y + CELL, x:x + CELL] = frames[n].a
    return sheet


def validate(sheet, chip_id, floating=False):
    errs = []
    if sheet.shape[:2] != (CELL * 5, CELL * 3):
        errs.append('size')
    if not np.isin(sheet[:, :, 3], (0, 255)).all():
        errs.append('alpha')
    cols = {tuple(int(v) for v in px[:3]) for px in sheet[sheet[:, :, 3] == 255]}
    if len(cols) > 16:
        errs.append('colors %d' % len(cols))
    cells = []
    for i, n in enumerate(NAMES):
        x, y = i % 3 * CELL, i // 3 * CELL
        c = sheet[y:y + CELL, x:x + CELL]
        if not c[:, :, 3].any():
            errs.append('empty ' + n)
        cells.append(c.tobytes())
        ys = np.nonzero(c[:, :, 3].any(1))[0]
        if n in ('idle_a', 'dead') and ys.size and ys.max() != FLOOR and not (floating and n == 'idle_a'):
            errs.append('%s bottom %d' % (n, ys.max()))
    if len(set(cells)) != 15:
        errs.append('duplicate cells %d' % len(set(cells)))
    info = {'chip': chip_id, 'colors': len(cols), 'unique': len(set(cells)), 'errors': errs}
    return info


def board(sheet, stand, chip_id):
    s = 4
    pad = 8
    w = 24 * s + pad * 3 + CELL * 3 * s
    h = max(32 * s, CELL * 5 * s) + pad * 2
    im = Image.new('RGBA', (w, h), BG + (255,))
    st = Image.fromarray(stand[PAD:], 'RGBA').resize((24 * s, 32 * s), Image.NEAREST)
    im.alpha_composite(st, (pad, pad))
    sh = Image.fromarray(sheet, 'RGBA').resize((CELL * 3 * s, CELL * 5 * s), Image.NEAREST)
    grid = Image.new('RGBA', sh.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(grid)
    for i in range(1, 3):
        d.line([(i * CELL * s, 0), (i * CELL * s, sh.height)], fill=(90, 110, 130, 255))
    for j in range(1, 5):
        d.line([(0, j * CELL * s), (sh.width, j * CELL * s)], fill=(90, 110, 130, 255))
    for j in range(5):
        d.line([(0, j * CELL * s + FLOOR * s + s), (sh.width, j * CELL * s + FLOOR * s + s)], fill=(60, 80, 96, 255))
    im.alpha_composite(grid, (24 * s + pad * 2, pad))
    im.alpha_composite(sh, (24 * s + pad * 2, pad))
    return im


def run(index, draw_fx, floating=False):
    """draw_fx(f, pal) — f: 칸 이름 → Frame, pal: 칩 색(어두운→밝은). 효과를 덧칠한다."""
    chip_id = 'monster4-%d' % index
    f, stand, pal = base_frames(index, floating)
    draw_fx(f, pal)
    sheet = assemble(f)
    OUT.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet, 'RGBA').save(OUT / (chip_id + '.png'))
    board(sheet, stand, chip_id).save(QA / ('board-' + chip_id + '.png'))
    info = validate(sheet, chip_id, floating)
    (QA / (chip_id + '.json')).write_text(json.dumps(info, ensure_ascii=False))
    print(chip_id, 'colors', info['colors'], 'unique', info['unique'], 'OK' if not info['errors'] else info['errors'])
    return info
