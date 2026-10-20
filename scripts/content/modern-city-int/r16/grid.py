#!/usr/bin/env python3
"""r16 — modern_city 실내 기물 3/4 + 화풍 다시 그림의 원본 격자 도구 (2026-10-20).

원본은 tiledata/modern-city/interior/r16/grids/<id>.json 하나:
  {"id", "w", "h", "legend": {"글자": "#rrggbbaa"}, "rows": ["....", ...], "note"}
  w×h = 사양(modernCityRoomSpec.json) objects[id].cells 의 칸 경계 상자(px). '.' = 투명.
  등록되지 않은 칸(cells 에 없는 칸)에는 한 화소도 찍지 않는다(시트에 자리가 없다).

  python3 grid.py extract <id>... [--force]   지금 시트 그림을 격자로 꺼낸다(작업 시작점 — 기존 디자인을 고쳐 쓴다)
  python3 grid.py check <id>...               크기·글자·색·등록 칸 검사
  python3 grid.py show <out.png> <id>...      옛 그림 | 새 그림 (4배·1배) | 방 안 맥락(2배) 비교판
  python3 grid.py colors <id>                 이 기물 범례 + 쓸 수 있는 칩셋 램프 색 목록

색 규칙: modern_city 램프(mkit.PALETTE) 또는 원래 modern_city 실내 기물 그림에 이미 있던 색만 쓴다(반투명은 원래 있던 RGBA 값만).
옛 그림 = origin 시트 사본(tiledata/.../r16/orig-chipset.png 가 없으면 git show origin/main 으로 만든다).
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..'))
import numpy as np                      # noqa: E402
from PIL import Image, ImageDraw, ImageFont   # noqa: E402

SPEC = os.path.join(ROOT, 'src/assets/modernCityRoomSpec.json')
PNG = os.path.join(ROOT, 'public/assets/modern-city/modern-city-chipset.png')
DIR = os.path.join(ROOT, 'tiledata/modern-city/interior/r16')
GRIDS = os.path.join(DIR, 'grids')
ORIG = '/tmp/mip34/orig-chipset.png'
TPR = 48
CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+-=@?!<>^~:;/|()[]{}_,'


def spec():
    return json.load(open(SPEC, encoding='utf-8'))


def orig_sheet():
    if not os.path.exists(ORIG):
        os.makedirs(os.path.dirname(ORIG), exist_ok=True)
        data = subprocess.run(['git', '-C', ROOT, 'show', 'origin/main:public/assets/modern-city/modern-city-chipset.png'], capture_output=True, check=True).stdout
        open(ORIG, 'wb').write(data)
    return Image.open(ORIG).convert('RGBA')


def box(sp, pid):
    cells = sp['objects'][pid]['cells']
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    return min(xs), min(ys), max(xs) - min(xs) + 1, max(ys) - min(ys) + 1


def compose(sp, pid, sheet):
    mx, my, cw, ch = box(sp, pid)
    out = Image.new('RGBA', (cw * 16, ch * 16))
    for dx, dy, tid, _l in sorted(sp['objects'][pid]['cells'], key=lambda c: (c[3], c[1], c[0])):
        t = sheet.crop(((tid % TPR) * 16, (tid // TPR) * 16, (tid % TPR) * 16 + 16, (tid // TPR) * 16 + 16))
        out.alpha_composite(t, ((dx - mx) * 16, (dy - my) * 16))
    return out


def hexa(c):
    return '#%02x%02x%02x%02x' % tuple(int(v) for v in c)


def path(pid):
    return os.path.join(GRIDS, pid + '.json')


def to_grid(pid, img):
    a = np.asarray(img)
    cols = {}
    for c in sorted({tuple(p) for p in a.reshape(-1, 4).tolist() if p[3]}):
        cols[c] = CHARS[len(cols)]
    assert len(cols) <= len(CHARS), (pid, len(cols))
    rows = [''.join(cols[tuple(p)] if p[3] else '.' for p in row.tolist()) for row in a]
    return dict(id=pid, w=img.width, h=img.height, legend={ch: hexa(c) for c, ch in cols.items()}, rows=rows, note='')


def load(pid):
    return json.load(open(path(pid), encoding='utf-8'))


def to_img(g):
    lg = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5, 7)) for k, v in g['legend'].items()}
    a = np.zeros((g['h'], g['w'], 4), np.uint8)
    for y, r in enumerate(g['rows']):
        for x, ch in enumerate(r):
            if ch != '.': a[y, x] = lg[ch]
    return Image.fromarray(a, 'RGBA')


_allowed = None


def allowed():
    """(불투명 RGB 집합, 반투명 RGBA 집합) — 램프 + 원래 실내 기물 그림의 색."""
    global _allowed
    if _allowed is None:
        from mkit import PALETTE
        sp = spec(); sh = orig_sheet(); a = np.asarray(sh)
        rgb, rgba = set(PALETTE), set()
        tids = {c[2] for o in sp['objects'].values() for c in o['cells']} | set(sp['goods'].values())
        for t in tids:
            blk = a[(t // TPR) * 16:(t // TPR) * 16 + 16, (t % TPR) * 16:(t % TPR) * 16 + 16].reshape(-1, 4)
            for p in blk.tolist():
                if p[3] == 255: rgb.add(tuple(p[:3]))
                elif p[3]: rgba.add(tuple(p))
        _allowed = (rgb, rgba)
    return _allowed


def check(pid, sp=None):
    sp = sp or spec(); errs = []
    g = load(pid)
    mx, my, cw, ch = box(sp, pid)
    if (g['w'], g['h']) != (cw * 16, ch * 16): errs.append('크기 %dx%d != %dx%d' % (g['w'], g['h'], cw * 16, ch * 16))
    if len(g['rows']) != g['h'] or any(len(r) != g['w'] for r in g['rows']): errs.append('행 수/길이가 w,h 와 다르다')
    bad = sorted({c for r in g['rows'] for c in r if c != '.' and c not in g['legend']})
    if bad: errs.append('범례에 없는 글자 ' + ''.join(bad))
    if errs: return errs
    rgb, rgba = allowed()
    for k, v in g['legend'].items():
        c = tuple(int(v[i:i + 2], 16) for i in (1, 3, 5, 7))
        if c[3] == 255 and c[:3] not in rgb: errs.append('칩셋 밖 색 %s=%s' % (k, v))
        if 0 < c[3] < 255 and c not in rgba: errs.append('없던 반투명 %s=%s' % (k, v))
        if c[3] == 0: errs.append('범례에 알파 0 (%s) — 투명은 . 로' % k)
    reg = {(c[0] - mx, c[1] - my) for c in sp['objects'][pid]['cells']}
    for y, r in enumerate(g['rows']):
        for x, chh in enumerate(r):
            if chh != '.' and (x // 16, y // 16) not in reg:
                errs.append('등록 안 된 칸 (%d,%d) 에 화소 (%d,%d)' % (x // 16, y // 16, x, y)); break
        if errs and errs[-1].startswith('등록'): break
    return errs


FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 12)


def checker(w, h, s):
    b = Image.new('RGBA', (w * s, h * s), (150, 128, 100, 255)); d = ImageDraw.Draw(b)
    for y in range(0, h, 4):
        for x in range(0, w, 4):
            if (x // 4 + y // 4) % 2: d.rectangle([x * s, y * s, (x + 4) * s - 1, (y + 4) * s - 1], fill=(138, 118, 92, 255))
    return b


def zoom(img, s, grid=True):
    b = checker(img.width, img.height, s); b.alpha_composite(img.resize((img.width * s, img.height * s), Image.NEAREST))
    if grid:
        d = ImageDraw.Draw(b)
        for k in range(0, img.height + 1, 16): d.line([(0, k * s), (img.width * s, k * s)], fill=(0, 0, 0, 80))
        for k in range(0, img.width + 1, 16): d.line([(k * s, 0), (k * s, img.height * s)], fill=(0, 0, 0, 80))
    return b


def context(sp, pid, img, sheet, wall='mci-wall-store', floor='mci-vinyl-store'):
    """방 안 맥락: 바닥 위, wall 종류는 뒤 벽 두 줄 앞에. 좌우 한 칸 여백."""
    o = sp['objects'][pid]; mx, my, cw, ch = box(sp, pid)
    W, H = cw + 2, ch + 3
    out = Image.new('RGBA', (W * 16, H * 16))
    tile = lambda t: sheet.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))   # noqa: E731
    fl = sp['floors'][floor]; wl = sp['walls'][wall]
    hrows = max(1, o.get('h') or 1)
    wall_rows = H - hrows - 1 if o.get('kind') in ('wall', 'hang', 'door') else 2
    for y in range(H):
        for x in range(W):
            if y < wall_rows - 2: t = tile(sp['void']) if 'void' in sp else None
            elif y < wall_rows: t = tile(wl['tiles'][(((y - (wall_rows - 2)) * wl['cols']) + x % wl['cols']) * 2])
            else: t = tile(fl['tiles'][(((y % fl.get('rows', 1)) * fl['cols']) + x % fl['cols']) * 4])
            if t: out.alpha_composite(t, (x * 16, y * 16))
    oy = (H - 1 - ch) * 16 if o.get('kind') not in ('hang',) else (wall_rows - ch) * 16
    out.alpha_composite(img, (16, max(0, oy)))
    return out


def show(out, ids):
    sp = spec(); cur = Image.open(PNG).convert('RGBA'); old = orig_sheet()
    panels = []
    for pid in ids:
        a = compose(sp, pid, old)
        b = to_img(load(pid)) if os.path.exists(path(pid)) else compose(sp, pid, cur)
        s = 4 if a.width <= 64 else 3 if a.width <= 96 else 2
        ctx = context(sp, pid, b, cur)
        z = [zoom(a, s), zoom(b, s)]
        w = z[0].width * 2 + a.width * 2 + ctx.width * 2 + 50; h = max(z[0].height, ctx.height * 2) + 22
        P = Image.new('RGBA', (w, h), (30, 32, 38, 255)); d = ImageDraw.Draw(P)
        x = 4
        for k, im in enumerate(z): P.alpha_composite(im, (x, 20)); x += im.width + 8
        for im in (a, b):
            c1 = checker(im.width, im.height, 1); c1.alpha_composite(im); P.alpha_composite(c1, (x, 20)); x += im.width + 6
        P.alpha_composite(ctx.resize((ctx.width * 2, ctx.height * 2), Image.NEAREST), (x + 4, 20))
        d.text((4, 3), '%s  (old | new | old 1x new 1x | in room 2x)' % pid, fill=(240, 240, 240), font=FONT)
        panels.append(P)
    W = max(p.width for p in panels); H = sum(p.height + 6 for p in panels)
    C = Image.new('RGBA', (W, H), (18, 20, 24, 255)); y = 0
    for p in panels: C.alpha_composite(p, (0, y)); y += p.height + 6
    C.save(out)
    print(out, C.size)


def main():
    cmd, args = sys.argv[1], [a for a in sys.argv[2:] if not a.startswith('--')]
    if cmd == 'extract':
        sp = spec(); cur = Image.open(PNG).convert('RGBA'); os.makedirs(GRIDS, exist_ok=True)
        for pid in args:
            if os.path.exists(path(pid)) and '--force' not in sys.argv: print('있음', pid); continue
            g = to_grid(pid, compose(sp, pid, cur))
            open(path(pid), 'w', encoding='utf-8').write(json.dumps(g, ensure_ascii=False, indent=1) + '\n')
            print('extract', pid, g['w'], g['h'], len(g['legend']), '색')
    elif cmd == 'check':
        sp = spec(); bad = 0
        for pid in args:
            e = check(pid, sp); bad += bool(e)
            print(('OK  ' if not e else 'ERR ') + pid + ('' if not e else ': ' + ' · '.join(e[:5])))
        sys.exit(1 if bad else 0)
    elif cmd == 'show':
        show(args[0], args[1:])
    elif cmd == 'colors':
        g = load(args[0]); print(json.dumps(g['legend'], indent=0))
        import mpx
        for name, r in mpx.RAMPS.items(): print(name, ' '.join('#%02x%02x%02xff' % mpx._rgb(c) for c in r))
    else:
        sys.exit(__doc__)


if __name__ == '__main__':
    main()
