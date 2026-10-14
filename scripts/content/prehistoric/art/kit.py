"""prehistoric 조각 등록·내보내기·검수 시트.

조각 = (id, 이름, 칸 w×h, object-gate 종류 kind, draw(c)). 내보내기: tiledata/prehistoric/<group>/_gate/ph-<id>.png (투명, 관문 정본) + items.jsonl.
"""
import os, json
from PIL import Image, ImageDraw, ImageFont
from px import C, ROOT, save

OUT = os.path.join(ROOT, 'tiledata', 'prehistoric')


class Reg:
    def __init__(s, group):
        s.group = group; s.items = []; s.by = {}

    def add(s, id_, name, w, h, kind, tags=(), rules='', **meta):
        def deco(fn):
            it = dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, tags=list(tags), rules=rules, **meta)
            s.items.append(it); s.by[id_] = it
            return fn
        return deco

    def render(s, it):
        c = C(it['w'] * 16, it['h'] * 16); it['draw'](c); return c

    def export(s, only=None):
        d = os.path.join(OUT, s.group, '_gate'); os.makedirs(d, exist_ok=True)
        rows = []
        for it in s.items:
            if only and it['id'] not in only: continue
            c = s.render(it); path = os.path.join(d, 'ph-%s.png' % it['id']); save(c, path)
            rows.append(dict(png=os.path.basename(path), kind=it['kind'], name=it['name'], label='prehistoric/ph-' + it['id']))
        if not only:
            with open(os.path.join(d, 'items.jsonl'), 'w') as f:
                for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
        return rows


def _font(sz=12):
    for p in ('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
              '/usr/share/fonts/truetype/nanum/NanumGothic.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()


def contact(items, path, z=3, W=1500, bg=(118, 128, 112), label=True, ground=None):
    """[(id, Image)] 를 z 배 확대해 이름표와 함께 한 장으로. ground: 16px 바닥 타일(Image) 을 깔면 실제 맥락."""
    f = _font(12)
    cells = []
    for name, im in items:
        im2 = im.resize((im.width * z, im.height * z), Image.NEAREST)
        cells.append((name, im2))
    x = y = 8; rowh = 0; pos = []
    for name, im in cells:
        cw = max(im.width, 60) + 10
        if x + cw > W: x = 8; y += rowh + 26; rowh = 0
        pos.append((x, y)); x += cw; rowh = max(rowh, im.height)
    H = y + rowh + 30
    S = Image.new('RGBA', (W, H), bg + (255,))
    if ground is not None:
        g = ground.resize((ground.width * z, ground.height * z), Image.NEAREST)
        for gy in range(0, H, g.height):
            for gx in range(0, W, g.width): S.paste(g, (gx, gy))
    d = ImageDraw.Draw(S)
    for (name, im), (px_, py) in zip(cells, pos):
        S.alpha_composite(im, (px_, py))
        if label:
            d.rectangle([px_, py + im.height + 2, px_ + len(name) * 7 + 4, py + im.height + 18], fill=(20, 20, 28, 255))
            d.text((px_ + 2, py + im.height + 3), name, fill=(240, 240, 240, 255), font=f)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    S.save(path)
    return S
