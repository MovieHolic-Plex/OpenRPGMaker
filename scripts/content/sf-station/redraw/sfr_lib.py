"""sf_station redraw 공용: 잠금 팔레트(sf_core RAMPS, shadow 제외) · 행 문자열 ↔ PNG · 답 읽기(느슨/엄격). steampunk-redo/sp_lib.py 를 옮긴 것."""
import json, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = '/home/main/z-project/rpg-zzu-assistant-fable-redraw-sf-station'
sys.path.insert(0, f'{REPO}/scripts/content/sf-station'); sys.path.insert(0, f'{REPO}/scripts/content/jp-city')
import sf_core as C  # noqa: E402
KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
import sfr_palette as PAL  # noqa: E402
from sfr_measure_fn import oklab  # noqa: E402
RAMPS = {k: [int(c[1:], 16) for c in v] for k, v in PAL.ALL.items()}
OLD = {k: v for k, v in C.RAMPS.items()}
LUM = np.array([0.299, 0.587, 0.114])
BG = (70, 74, 90)


def hx(v): return ((v >> 16) & 255, (v >> 8) & 255, v & 255)


def colour_of(name):
    if not isinstance(name, str) or ':' not in name: return None
    r, t = name.split(':', 1)
    try: t = int(t)
    except ValueError: return None
    ramp = RAMPS.get(r.strip()) or OLD.get(r.strip())
    if ramp is None: return None
    return hx(ramp[max(0, min(len(ramp) - 1, t))])


def _rev():
    rev = {}
    for r, tones in RAMPS.items():
        for i, c in enumerate(tones): rev.setdefault(hx(c), f'{r}:{i}')
    return rev


def nearest_to_palette(im):
    cols = [hx(c) for t in RAMPS.values() for c in t]
    arr = np.array(cols, float); a = np.array(im.convert('RGBA')); out = a.copy(); cache = {}
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] < 128: out[y, x] = 0; continue
            k = tuple(int(v) for v in a[y, x, :3])
            if k not in cache:
                d = ((arr - np.array(k, float)) ** 2 * np.array([0.30, 0.59, 0.11])).sum(axis=1); cache[k] = cols[int(d.argmin())]
            out[y, x, :3] = cache[k]; out[y, x, 3] = 255
    return Image.fromarray(out, 'RGBA')


def png_to_rows(im, names_first=()):
    rev = {}
    for r in list(names_first) + list(RAMPS):
        for i, c in enumerate(RAMPS[r]): rev.setdefault(hx(c), f'{r}:{i}')
    a = np.array(im.convert('RGBA')); names = []
    for px in a.reshape(-1, 4):
        if px[3] == 255:
            n = rev[tuple(int(v) for v in px[:3])]
            if n not in names: names.append(n)
    order = list(RAMPS)
    names.sort(key=lambda n: (order.index(n.split(':')[0]), int(n.split(':')[1])))
    inv = {n: KEYS[i] for i, n in enumerate(names)}
    rows = [''.join('.' if px[3] == 0 else inv[rev[tuple(int(v) for v in px[:3])]] for px in row) for row in a]
    return {v: k for k, v in inv.items()}, rows


def rows_to_png(legend, rows):
    h, w = len(rows), len(rows[0]); a = np.zeros((h, w, 4), np.uint8)
    cols = {k: colour_of(v) for k, v in legend.items()}
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in cols and cols[ch]: a[y, x, :3] = cols[ch]; a[y, x, 3] = 255
    return Image.fromarray(a, 'RGBA')


def read_answer(b, text):
    w, h = b['w'], b['h']; t = (text or '').strip()
    out = {'strictOk': False, 'strictErrors': [], 'lenientOk': False, 'steps': [], 'legend': None, 'rows': None, 'top': None, 'note': None}
    obj = None
    try: obj = json.loads(t)
    except Exception: out['strictErrors'].append('not one JSON')
    if not (isinstance(obj, dict) and isinstance(obj.get('rows'), list) and isinstance(obj.get('legend'), dict)):
        if obj is not None: out['strictErrors'].append('no legend/rows')
        t = re.sub(r'"\s*\+\s*"', '', t)
        t2 = re.sub(r'\.(?:replace|slice|substring|substr|padEnd|padStart|repeat|join|map)\([^()]*\)', '', t)
        objs = []; dec = json.JSONDecoder(); i = t2.find('{')
        while i >= 0:
            try:
                o, end = dec.raw_decode(t2, i)
                if isinstance(o, dict) and isinstance(o.get('rows'), list) and isinstance(o.get('legend'), dict): objs.append(o)
                i = t2.find('{', end)
            except Exception: i = t2.find('{', i + 1)
        if not objs: return out
        out['steps'].append('json-extracted'); obj = objs[-1]
    legend = {}
    for k, v in obj['legend'].items():
        if len(str(k)) == 1 and k != '.' and colour_of(v) is not None: legend[k] = v
        else: out['strictErrors'].append(f'bad legend {k}={v!r}'); out['steps'].append(f'legend {k} -> transparent')
    rows = [str(r) for r in obj['rows']]
    if any(' ' in r for r in rows): rows = [r.replace(' ', '') for r in rows]; out['strictErrors'].append('spaces in rows')
    if len(rows) != h:
        out['strictErrors'].append(f'rows {len(rows)} != {h}'); rows = (rows + ['.' * w] * h)[:h]
    n = sum(1 for r in rows if len(r) != w)
    if n:
        worst = max(abs(len(r) - w) for r in rows)
        out['strictErrors'].append(f'{n} rows of wrong length (max {worst})'); rows = [(r + '.' * w)[:w] for r in rows]
    okc = set(legend) | {'.'}
    unk = {ch for r in rows for ch in r if ch not in okc}
    if unk:
        out['strictErrors'].append(f'unknown chars {"".join(sorted(unk))[:12]!r}'); rows = [''.join(ch if ch in okc else '.' for ch in r) for r in rows]
    out.update(legend=legend, rows=rows, top=obj.get('top_rows'), note=str(obj.get('note'))[:240])
    out['strictOk'] = not out['strictErrors']
    filled = sum(1 for r in rows for ch in r if ch != '.')
    out['lenientOk'] = filled >= 0.08 * w * h
    return out


def up(im, s): return im.resize((im.width * s, im.height * s), Image.NEAREST)


def big(im, s, bg=BG):
    b = Image.new('RGBA', (im.width * s, im.height * s), bg + (255,)); b.alpha_composite(up(im, s)); return b.convert('RGB')


def old_piece(pid):
    return Image.open(f'{HERE}/old/{pid}.png').convert('RGBA')


def snap(im, ramp_names):
    """§6: 역할 램프의 가장 가까운 색으로(OKLab, 디더 없음). → (그림, 바뀐 화소 수)"""
    GLOWSRC = {(255, 255, 255), (206, 246, 255), (168, 232, 255)}
    cols = sorted({hx(c) for n in ramp_names if n != 'a_glow' for c in RAMPS[n]}); lab = oklab(np.array(cols, float))
    a = np.array(im.convert('RGBA')); out = a.copy(); cache = {}; changed = 0
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if a[y, x, 3] < 128: out[y, x] = 0; continue
            k = tuple(int(v) for v in a[y, x, :3])
            if k not in cache:
                if k in GLOWSRC and 'a_glow' in ramp_names: cache[k] = (255, 255, 255)
                else: d = ((lab - oklab(np.array(k, float))) ** 2).sum(axis=1); cache[k] = cols[int(d.argmin())]
            if cache[k] != k: changed += 1
            out[y, x, :3] = cache[k]; out[y, x, 3] = 255
    return Image.fromarray(out, 'RGBA'), changed


def chip(i=0):
    return Image.open(f'{HERE}/refs/chip{i}.png').convert('RGBA')
