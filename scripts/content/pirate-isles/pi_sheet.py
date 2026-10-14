"""검수 시트: 조각을 z 배로 이름표와 함께 한 장으로(바탕 = 실제 바닥 칸 반복)."""
import os
from PIL import Image, ImageDraw, ImageFont


def _font(sz=12):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc'):
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()


def ground_tile(kind):
    import pi_core as C
    from pi_terrain import sand_px, grass_px, cobble_px
    c = C.Cv(16, 16)
    fn = {'sand': lambda x, y: sand_px(x, y), 'grass': lambda x, y: grass_px(x, y), 'cobble': lambda x, y: cobble_px(x, y),
          'water': lambda x, y: C.water_px(x, y), 'deck': None}.get(kind)
    if fn is None: return None
    for y in range(16):
        for x in range(16): c.P(x, y, fn(x, y))
    return c.image()


def sheet(items, path, z=3, W=1500, bg='grass', label=True):
    f = _font(12)
    cells = [(n, im.resize((im.width * z, im.height * z), Image.NEAREST)) for n, im in items]
    x = y = 8; rowh = 0; pos = []
    for n, im in cells:
        cw = max(im.width, 70) + 12
        if x + cw > W: x = 8; y += rowh + 26; rowh = 0
        pos.append((x, y)); x += cw; rowh = max(rowh, im.height)
    H = y + rowh + 30
    S = Image.new('RGBA', (W, H), (70, 74, 80, 255))
    g = ground_tile(bg) if isinstance(bg, str) else None
    if g is not None:
        g = g.resize((16 * z, 16 * z), Image.NEAREST)
        for gy in range(0, H, g.height):
            for gx in range(0, W, g.width): S.paste(g, (gx, gy))
    d = ImageDraw.Draw(S)
    for (n, im), (px, py) in zip(cells, pos):
        S.alpha_composite(im, (px, py))
        if label:
            d.rectangle([px, py + im.height + 2, px + len(n) * 7 + 4, py + im.height + 18], fill=(20, 20, 28, 255))
            d.text((px + 2, py + im.height + 3), n, fill=(240, 240, 240, 255), font=f)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    S.save(path)
    return S
