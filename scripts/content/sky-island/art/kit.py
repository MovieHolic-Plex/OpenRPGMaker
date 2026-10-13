"""sky_island 조각 등록·내보내기·검수 시트.

조각 = (id, 이름, 칸 w×h, object-gate 종류 kind, draw(c)) + 메타:
  pc       칸 통행 — 'floor' 걷는 아래층 · 'solidfloor' 막힌 아래층(하늘·절벽) · 'flat' 걷는 위층 덧그림(다리·부두)
           · 'solid' 막힌 위층 · 'star' 사람 위에 그려지는 위층. 문자열 하나 또는 fn(x, y, W, H) -> pc. 없으면 종류로 정한다.
  entrance 건물 맨 아랫줄의 문 칸 x 목록(문 칸은 막힘, 바로 아래 칸이 접근칸)
  frames   애니메이션 프레임 수(draw(c, f) 를 f=0..n-1 로 부른다). 프레임 0 이 정지 그림.
내보내기: tiledata/sky-island/<group>/_gate/si-<id>.png (+ -f1, -f2 …) 와 items.jsonl(object-gate --batch 입력).
"""
import os, json
from PIL import Image, ImageDraw, ImageFont
from px import C, ROOT, save

OUT = os.path.join(ROOT, 'tiledata', 'sky-island')


class Reg:
    def __init__(s, group):
        s.group = group; s.items = []; s.by = {}

    def add(s, id_, name, w, h, kind, tags=(), rules='', **meta):
        def deco(fn):
            it = dict(id=id_, name=name, w=w, h=h, kind=kind, draw=fn, tags=list(tags), rules=rules, **meta)
            s.items.append(it); s.by[id_] = it
            return fn
        return deco

    def render(s, it, f=0):
        c = C(it['w'] * 16, it['h'] * 16)
        if it.get('frames', 1) > 1: it['draw'](c, f)
        else: it['draw'](c)
        return c

    def pngs(s, it):
        d = os.path.join(OUT, s.group, '_gate')
        base = os.path.join(d, 'si-%s.png' % it['id'])
        return [base] + [os.path.join(d, 'si-%s-f%d.png' % (it['id'], f)) for f in range(1, it.get('frames', 1))]

    def export(s, only=None):
        d = os.path.join(OUT, s.group, '_gate'); os.makedirs(d, exist_ok=True)
        rows = []
        for it in s.items:
            if only and it['id'] not in only: continue
            for f, path in enumerate(s.pngs(it)):
                c = s.render(it, f); save(c, path)
                rows.append(dict(png=os.path.relpath(path, ROOT), kind=it['kind'], name=it.get('gate_name') or it['name'], label='sky-island/si-' + it['id'] + ('' if f == 0 else '-f%d' % f)))
        if not only:
            with open(os.path.join(d, 'items.jsonl'), 'w') as fh:
                for r in rows: fh.write(json.dumps(r, ensure_ascii=False) + '\n')
        return rows


def _font(sz=12):
    for p in ('/usr/share/fonts/truetype/nanum/NanumGothic.ttf', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
              '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()


def contact(items, path, z=3, W=1500, bg=(126, 174, 232), label=True):
    """[(이름, Image)] 를 z 배 확대해 이름표와 함께 한 장으로."""
    f = _font(12)
    cells = [(name, im.resize((im.width * z, im.height * z), Image.NEAREST)) for name, im in items]
    x = y = 8; rowh = 0; pos = []
    for name, im in cells:
        cw = max(im.width, 60) + 10
        if x + cw > W: x = 8; y += rowh + 26; rowh = 0
        pos.append((x, y)); x += cw; rowh = max(rowh, im.height)
    H = y + rowh + 30
    S = Image.new('RGBA', (W, H), bg + (255,))
    d = ImageDraw.Draw(S)
    for (name, im), (px_, py) in zip(cells, pos):
        S.alpha_composite(im, (px_, py))
        if label:
            d.rectangle([px_, py + im.height + 2, px_ + len(name) * 7 + 4, py + im.height + 18], fill=(20, 20, 28, 255))
            d.text((px_ + 2, py + im.height + 3), name, fill=(240, 240, 240, 255), font=f)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    S.save(path)
    return S
