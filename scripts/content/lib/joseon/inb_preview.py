"""조선 실내 조각 검수 시트: 조각 하나씩 [내 조각 | 실내 v5 기준 조각] 을 같은 배율로. 눈으로 보기 위한 도구."""
import json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
V5 = os.path.join(ROOT, 'tiledata/hand-interior/v5')
_AT = None
_BY = None


def v5(ident):
    global _AT, _BY
    if _AT is None:
        _AT = Image.open(os.path.join(V5, 'interior-atlas.png')).convert('RGBA')
        m = json.load(open(os.path.join(V5, 'interior-meta.json')))
        _BY = {x['id']: x for x in m['objects']}
        for k in ('floors', 'walls'):
            for x in m[k]:
                _BY[x['id']] = x
    x = _BY.get(ident)
    if not x:
        return None
    a = x['atlas']
    return _AT.crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))


def sheet(items, out, scale=4, bg=(120, 96, 78, 255), cols_px=1700, refs=None):
    """items: [(label, PIL.Image)] ; refs: {label: [v5 id...]} 오른쪽에 같은 배율로 붙인다."""
    refs = refs or {}
    cells = []
    for label, im in items:
        group = [(label, im)]
        for r in refs.get(label, []):
            ri = v5(r)
            if ri is not None:
                group.append(('v5:' + r, ri))
        cells.append(group)
    W = cols_px
    x = y = rh = 0
    pos = []
    for g in cells:
        w = sum(i.width * scale + 8 for _, i in g) + 10
        h = max(i.height for _, i in g) * scale + 18
        if x + w > W:
            x = 0; y += rh; rh = 0
        pos.append((x, y)); x += w; rh = max(rh, h)
    sh = Image.new('RGBA', (W, y + rh + 4), bg)
    d = ImageDraw.Draw(sh)
    for g, (px, py) in zip(cells, pos):
        xx = px + 4
        for label, im in g:
            big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            sh.alpha_composite(big, (xx, py + 14))
            d.text((xx, py + 1), label, fill=(255, 255, 255, 255))
            xx += big.width + 8
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sh.convert('RGB').save(out)
    return out
