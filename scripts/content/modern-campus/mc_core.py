"""modern_campus 야외 공용 도우미 — 그리개·등록·굽기. campus_props.py 의 cube/bricks 를 재사용한다."""
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from campus_props import cube, bricks, OL, K, Cv, RAMPS, np, Image, palette_issues, OUT, ROOT   # noqa: E402,F401


def hsh(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2147483647) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return (n ^ (n >> 16)) & 0xffff


class Reg:
    def __init__(s, group):
        s.group = group; s.items = []

    def add(s, id_, name, w, h, kind, solid=(), tags=(), rules=''):
        def deco(fn):
            s.items.append(dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, solid=list(solid), tags=list(tags), rules=rules)); return fn
        return deco

    def render(s, p):
        c = Cv(p['w'] * 16, p['h'] * 16); p['draw'](c); return c.a

    def export(s, only=None):
        d = os.path.join(OUT, s.group, '_gate'); os.makedirs(d, exist_ok=True)
        metas = []; ims = []
        for p in s.items:
            if only and p['id'] not in only: continue
            a = s.render(p); bad = palette_issues(a, p['id'])
            if bad: print('  x', bad)
            path = os.path.join(d, 'mc-%s.png' % p['id']); Image.fromarray(a, 'RGBA').save(path)
            metas.append(dict(png=path, kind=p['kind'], name=p['name'], label='modern-campus/mc-' + p['id'])); ims.append(Image.fromarray(a, 'RGBA'))
        with open(os.path.join(d, 'items.jsonl'), 'w') as f:
            for m in metas: f.write(json.dumps(m, ensure_ascii=False) + '\n')
        return metas, ims


def sheet(ims, path, W=640, z=3, bg=(104, 103, 122, 255)):
    x = y = rowh = 0; pos = []
    for im in ims:
        if x + im.width > W: x = 0; y += rowh + 8; rowh = 0
        pos.append((x, y)); x += im.width + 8; rowh = max(rowh, im.height)
    S = Image.new('RGBA', (W, y + rowh), bg)
    for im, pp in zip(ims, pos): S.alpha_composite(im, pp)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    S.resize((S.width * z, S.height * z), Image.NEAREST).save(path)
