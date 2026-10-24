"""Raw char-gen candidates -> 64x64 busts with the cast's own pipeline (bake_astra_busts64.native/place), plus a lineup sheet.
  python3 preview.py <raw_dir> <out_dir> name1 name2 ...
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bake_astra_busts64 as B
ROOT = Path(__file__).resolve().parents[4]
raw, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
names = sys.argv[3:]
CAST = ['hero', 'mom', 'nurse', 'naru', 'yurim', 'muyeong']
tiles = [(c, Image.open(ROOT / f'public/assets/emerald-monster/cast/{c}/bust-base.png').convert('RGBA')) for c in CAST]
for n in names:
    bn = B.native(raw / f'{n}.png'); im, info = B.place(bn)
    im = B.shared_palette([im])[0]
    im.save(out / f'{n}.png'); print(n, bn.size, info)
    tiles.append((n, im))
S = 3
sheet = Image.new('RGBA', (len(tiles) * (64 * S + 6), 64 * S + 16), (232, 240, 222, 255)); d = ImageDraw.Draw(sheet)
for i, (n, im) in enumerate(tiles):
    sheet.alpha_composite(im.resize((64 * S, 64 * S), Image.NEAREST), (i * (64 * S + 6), 0)); d.text((i * (64 * S + 6) + 2, 64 * S + 2), n, fill=(0, 0, 0, 255))
sheet.save(out / 'sheet.png')
