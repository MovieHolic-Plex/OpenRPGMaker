"""steampunk_city 조각 등록·내보내기·검수 시트.

조각 = (id, 이름, 칸 w×h, object-gate 종류 kind, draw(c)). 내보내기: tiledata/steampunk-city/<group>/_gate/sp-<id>.png (투명, 관문 정본) + items.jsonl.
"""
import os, json
from PIL import Image, ImageDraw, ImageFont
from px import C, ROOT, save

OUT = os.path.join(ROOT, 'tiledata', 'steampunk-city')


# ═══ 윤곽 재질 톤(화풍 정렬 2026-10-14 2판) ═══
# 실루엣 가장자리(4이웃에 투명이 있는) 먹(ink) 화소를 맞닿은 재질 램프의 «V≥30 중 가장 어두운 단» 으로 바꾼다.
# 그 단도 너무 밝은 램프(V>70 — 범포·켜진 등·증기)는 짝 재질로. 캔버스 밖은 투명으로 보지 않는다(이어 칠하는 바닥 칸은 그대로).
# 3/4 관문에서 떨어진 조각은 OUTLINE_KEEP('<묶음>/<id>') 에 넣어 옛 먹 윤곽 그대로 둔다.
OUTLINE_KEEP = {   # 2026-10-14 재질 윤곽판이 관문에서 떨어진 조각 — 옛 먹 윤곽·옛 영수증 유지
    'street/pillar-box', 'street/hydrant', 'buildings/pump-house', 'props/bench', 'props/barrels',
    'interior/drill-press', 'interior/curio-cabinet', 'interior/wardrobe'}
_PAIR = {'canvas': 'wood', 'lit': 'brass', 'steam': 'iron'}


def _dark_step(mat):
    from palette import RGB
    for k, (r, g, b) in enumerate(RGB[mat]):
        if max(r, g, b) >= 30: return k, max(r, g, b)
    return len(RGB[mat]) - 1, 255


def outline_tone(mat):
    k, v = _dark_step(mat)
    if v > 70 and mat in _PAIR: return outline_tone(_PAIR[mat])
    return mat, k


def material_outline(c):
    from palette import MATS
    import collections
    ink = MATS.index('ink'); m = c.m; H, W = m.shape
    edge = []
    for y in range(H):
        for x in range(W):
            if m[y, x] != ink: continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and m[y + dy, x + dx] < 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                edge.append((x, y))
    out = []
    for x, y in edge:
        mat = None
        for rad in (1, 2, 3):
            cnt = collections.Counter()
            for dy in range(-rad, rad + 1):
                for dx in range(-rad, rad + 1):
                    X, Y = x + dx, y + dy
                    if (dx or dy) and 0 <= X < W and 0 <= Y < H and m[Y, X] >= 0 and m[Y, X] != ink:
                        cnt[MATS[m[Y, X]]] += 2 if abs(dx) + abs(dy) == 1 else 1
            if cnt: mat = cnt.most_common(1)[0][0]; break
        if mat: out.append((x, y, outline_tone(mat)))
    for x, y, (mt, k) in out: c.P(x, y, mt, k)


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
        c = C(it['w'] * 16, it['h'] * 16); it['draw'](c)
        if s.group + '/' + it['id'] not in OUTLINE_KEEP: material_outline(c)
        return c

    def export(s, only=None):
        d = os.path.join(OUT, s.group, '_gate'); os.makedirs(d, exist_ok=True)
        rows = []
        for it in s.items:
            if only and it['id'] not in only: continue
            c = s.render(it); path = os.path.join(d, 'sp-%s.png' % it['id']); save(c, path)
            rows.append(dict(png=os.path.basename(path), kind=it['kind'], name=it['name'], label='steampunk-city/sp-' + it['id']))
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
