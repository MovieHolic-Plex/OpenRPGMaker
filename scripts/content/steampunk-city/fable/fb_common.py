"""steampunk_city Fable 다시 그리기 공용 — 경로 · 주인공 칩 · 행 문자열 ↔ PNG · 답 읽기.

그림의 흐름: draw.py(모델, 조각당 호출 1번) → tiledata/steampunk-city/fable-redraw/src/<id>.png → build.py(모델 없음, 조립) → fable-redraw/pieces/<묶음>/sp-<id>.png
           → art/<묶음>.py(kit.Reg.picture 가 그 그림을 _gate 로 내보낸다) → object-gate owner-waive → bake_sp.py.
작업 폴더(장부·모델 답·보낸 글)는 저장소 밖: 환경 변수 SP_FABLE_WORK, 없으면 ~/.cache/oprn-steampunk-fable (/tmp 는 지워진다).
"""
import json, os, re, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(HERE, '..', 'art'))
import palette_v3 as P3   # noqa: E402

FABLE = os.path.join(ROOT, 'tiledata', 'steampunk-city', 'fable-redraw')
SRC, PIECES = os.path.join(FABLE, 'src'), os.path.join(FABLE, 'pieces')
WORK = os.environ.get('SP_FABLE_WORK') or os.path.expanduser('~/.cache/oprn-steampunk-fable')
BG = (118, 128, 116)
KEYS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
hx = P3.hexrgb


def src(pid):
    p = os.path.join(SRC, pid + '.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None


def _actor(col):
    """Actor1 걷기 칩 시트의 col 번째 사람, 앞모습 가운데 프레임(24×32)."""
    im = Image.open(os.path.join(ROOT, 'public/assets/easyrpg/charset/Actor1.png')).convert('RGBA')
    key = np.array(im)[0, 0, :3]
    ox, oy = (col % 4) * 72, (col // 4) * 128
    a = np.array(im.crop((ox + 24, oy + 64, ox + 48, oy + 96)))
    a[(a[:, :, :3] == key).all(-1)] = 0
    return Image.fromarray(a, 'RGBA')


def hero():
    return _actor(0)


def people(n=3):
    return [_actor(c) for c in range(1, 1 + n)]


def big(im, s, bg=BG):
    b = Image.new('RGBA', (im.width * s, im.height * s), bg + (255,))
    b.alpha_composite(im.convert('RGBA').resize((im.width * s, im.height * s), Image.NEAREST))
    return b.convert('RGB')


# ── 행 문자열(모델과 주고받는 형식): {"legend": {"글자": "램프:단"}, "rows": ["…"]} ──
def colour_of(name):
    if not isinstance(name, str) or ':' not in name:
        return None
    r, t = name.split(':', 1)
    try:
        t = int(t)
    except ValueError:
        return None
    ramp = P3.RAMPS.get(r.strip())
    return hx(ramp[t]) if ramp is not None and 0 <= t < len(ramp) else None


def png_to_rows(im):
    rev = {}
    for r, tones in P3.RAMPS.items():
        for i, c in enumerate(tones):
            rev.setdefault(hx(c), f'{r}:{i}')
    a = np.array(im.convert('RGBA'))
    names = []
    for px in a.reshape(-1, 4):
        if px[3] == 255:
            n = rev[tuple(int(v) for v in px[:3])]
            if n not in names:
                names.append(n)
    order = list(P3.RAMPS)
    names.sort(key=lambda n: (order.index(n.split(':')[0]), int(n.split(':')[1])))
    inv = {n: KEYS[i] for i, n in enumerate(names)}
    rows = [''.join('.' if px[3] == 0 else inv[rev[tuple(int(v) for v in px[:3])]] for px in row) for row in a]
    return {v: k for k, v in inv.items()}, rows


def rows_to_png(legend, rows):
    h, w = len(rows), len(rows[0])
    a = np.zeros((h, w, 4), np.uint8)
    cols = {k: colour_of(v) for k, v in legend.items()}
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if cols.get(ch):
                a[y, x, :3] = cols[ch]
                a[y, x, 3] = 255
    return Image.fromarray(a, 'RGBA')


def read_answer(w, h, text):
    """모델의 답 → {'strictOk', 'strictErrors', 'lenientOk', 'legend', 'rows', 'door'}. 느슨하게 읽되(앞뒤 글 떼기·행 길이 맞추기) 엄격 결과도 남긴다.
    lenientOk = 그림으로 읽혔다(8% 이상 채움)."""
    t = (text or '').strip()
    out = {'strictOk': False, 'strictErrors': [], 'lenientOk': False, 'legend': None, 'rows': None, 'door': None}
    obj = None
    try:
        obj = json.loads(t)
    except Exception:
        out['strictErrors'].append('답이 JSON 하나가 아님')
    ok = lambda o: isinstance(o, dict) and isinstance(o.get('rows'), list) and isinstance(o.get('legend'), dict)
    if not ok(obj):
        t2 = re.sub(r'\.(?:replace|slice|substring|substr|padEnd|padStart|repeat|join|map)\([^()]*\)', '', t)
        objs, dec, i = [], json.JSONDecoder(), t2.find('{')
        while i >= 0:
            try:
                o, end = dec.raw_decode(t2, i)
                if ok(o):
                    objs.append(o)
                i = t2.find('{', end)
            except Exception:
                i = t2.find('{', i + 1)
        if not objs:
            return out
        obj = objs[-1]
    legend = {}
    for k, v in obj['legend'].items():
        if len(str(k)) == 1 and k != '.' and colour_of(v) is not None:
            legend[k] = v
        else:
            out['strictErrors'].append(f'쓸 수 없는 범례 {k}={v!r}')
    rows = [str(r).replace(' ', '') for r in obj['rows']]
    if len(rows) != h:
        out['strictErrors'].append(f'행 수 {len(rows)} ≠ {h}')
        rows = (rows + ['.' * w] * h)[:h]
    n = sum(1 for r in rows if len(r) != w)
    if n:
        out['strictErrors'].append(f'길이 틀린 행 {n}개')
        rows = [(r + '.' * w)[:w] for r in rows]
    okc = set(legend) | {'.'}
    if any(ch not in okc for r in rows for ch in r):
        out['strictErrors'].append('범례에 없는 글자')
        rows = [''.join(ch if ch in okc else '.' for ch in r) for r in rows]
    out.update(legend=legend, rows=rows, door=obj.get('door'), strictOk=not out['strictErrors'])
    out['lenientOk'] = sum(1 for r in rows for ch in r if ch != '.') >= 0.08 * w * h
    return out
