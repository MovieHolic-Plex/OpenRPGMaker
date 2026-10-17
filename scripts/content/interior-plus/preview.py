"""조각 미리보기: python3 preview.py out.png [모듈,...] [배율] — 바닥 위에 조각을 늘어놓고 이름표 없이 확대한다."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import loader, iplib
from PIL import Image, ImageDraw
mods = sys.argv[2].split(',') if len(sys.argv) > 2 and sys.argv[2] else None
z = int(sys.argv[3]) if len(sys.argv) > 3 else 4
only = sys.argv[4].split(',') if len(sys.argv) > 4 else None
reg = loader.load(mods)
ims = [(pid, iplib.render(reg.pieces[pid])) for pid in reg.order if (not only or pid in only) and (not mods or reg.pieces[pid]['mod'] in mods)]
cols = 10; pad = 6
cw = max(i.width for _, i in ims) + pad; ch = max(i.height for _, i in ims) + pad + 8
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * cw, rows * ch), (0, 0, 0, 255))
bg = Image.new('RGBA', (cw - 2, ch - 10), (0, 0, 0, 0))
# 밝은 판석 바닥 위(실제 방 느낌)
for y in range(bg.height):
    for x in range(bg.width):
        v = 168 + (8 if ((x // 16 + y // 16) % 2) else 0)
        bg.putpixel((x, y), (v, v - 6, v - 14, 255))
for k, (pid, im) in enumerate(ims):
    X, Y = (k % cols) * cw, (k // cols) * ch
    sheet.alpha_composite(bg, (X + 1, Y + 1))
    sheet.alpha_composite(im, (X + 1 + (cw - 2 - im.width) // 2, Y + 1 + (ch - 10 - im.height)))
sheet = sheet.resize((sheet.width * z, sheet.height * z), Image.NEAREST)
d = ImageDraw.Draw(sheet)
for k, (pid, im) in enumerate(ims):
    X, Y = (k % cols) * cw, (k // cols) * ch
    d.text((X * z + 4, (Y + ch - 9) * z + 2), pid[:22], fill=(255, 255, 255, 255))
sheet.save(sys.argv[1]); print(len(ims), sheet.size)
