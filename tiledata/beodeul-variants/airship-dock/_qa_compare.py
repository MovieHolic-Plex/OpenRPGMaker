# compare-ref.png: 같은 배율로 [버들항·기준 장소 크롭 | 이 장소 크롭] 을 나란히(재질별), 끝에 전투 배경 | 같은 장소 맵 렌더.
import os
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); VAR = os.path.join(HERE, '..'); ROOT = os.path.join(VAR, '..', '..')
def crop(path, box, s=2):
    im = Image.open(path).convert('RGB').crop(box); return im.resize((im.width * s, im.height * s), Image.NEAREST)
ROWS = [
 ('beodeul city6_base (brick/stone houses, harbor)', os.path.join(ROOT, 'tiledata/beodeul-city/render/city6_base.png'), (1040, 1300, 1240, 1460),
  'airship-dock: control hut, plank yard, crane', os.path.join(HERE, 'render-1x.png'), (400, 150, 600, 310)),
 ('sky-city render (cloud sea, island rim)', os.path.join(VAR, 'sky-city/render-1x.png'), (440, 360, 640, 520),
  'airship-dock: cloud cliff edge, piers, airship', os.path.join(HERE, 'render-1x.png'), (620, 60, 820, 220)),
 ('ghost-train render (station, coal, lamps)', os.path.join(VAR, 'ghost-train/render-1x.png'), (560, 230, 760, 390),
  'airship-dock: coal shed yard', os.path.join(HERE, 'render-1x.png'), (0, 20, 200, 180)),
 ('deep-forest/coast grass (beodeul grass chip)', os.path.join(VAR, 'coast-cliff-road/render-1x.png'), (380, 380, 580, 540),
  'airship-dock: south rock rim, gasbag cradle', os.path.join(HERE, 'render-1x.png'), (180, 400, 380, 560)),
]
def build():
    blocks = []
    for (lt, lp, lb, rt, rp, rb) in ROWS:
        a = crop(lp, lb); b = crop(rp, rb)
        row = Image.new('RGB', (a.width + b.width + 12, a.height + 16), (24, 24, 30)); d = ImageDraw.Draw(row)
        row.paste(a, (0, 16)); row.paste(b, (a.width + 12, 16)); d.text((2, 2), lt, fill=(160, 220, 255)); d.text((a.width + 14, 2), rt, fill=(255, 230, 120))
        blocks.append(row)
    bg = Image.open(os.path.join(HERE, 'battle-bg.png')).convert('RGB'); ref = Image.open(os.path.join(VAR, 'battle-bg-sky-machine/airship.png')).convert('RGB')
    rc = Image.open(os.path.join(HERE, 'render-1x.png')).convert('RGB').crop((500, 80, 860, 440))
    row = Image.new('RGB', (640 * 2 + 12, 360 + 16), (24, 24, 30)); d = ImageDraw.Draw(row)
    row.paste(ref, (0, 16)); row.paste(bg, (652, 16)); d.text((2, 2), 'battle-bg-sky-machine/airship.png (1x)', fill=(160, 220, 255)); d.text((654, 2), 'airship-dock battle-bg.png (1x)', fill=(255, 230, 120))
    blocks.append(row)
    row = Image.new('RGB', (640 + 12 + 360, 360 + 16), (24, 24, 30)); d = ImageDraw.Draw(row)
    row.paste(bg, (0, 16)); row.paste(rc, (652, 16)); d.text((2, 2), 'battle-bg.png', fill=(255, 230, 120)); d.text((654, 2), 'render-1x crop (same place, 1x)', fill=(255, 230, 120))
    blocks.append(row)
    W = max(b.width for b in blocks); H = sum(b.height + 8 for b in blocks)
    out = Image.new('RGB', (W, H), (24, 24, 30)); y = 0
    for b in blocks: out.paste(b, (0, y)); y += b.height + 8
    out.save(os.path.join(HERE, 'compare-ref.png')); return out.size
if __name__ == '__main__': print(build())
