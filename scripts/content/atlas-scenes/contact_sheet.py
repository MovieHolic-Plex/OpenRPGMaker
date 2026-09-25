"""Contact sheet of rendered atlas-scenes maps for visual QA: python3 contact_sheet.py out.png id,id,... [scale]."""
import sys

from PIL import Image, ImageDraw

out, ids = sys.argv[1], sys.argv[2].split(",")
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
ims = [(i, Image.open(f"tiledata/atlas-scenes/images/{i}.png").convert("RGB")) for i in ids]
ims = [(i, im.resize((int(im.width * scale), int(im.height * scale)), Image.NEAREST)) for i, im in ims]
cols = 2
rows = (len(ims) + cols - 1) // cols
cw = max(im.width for _, im in ims)
ch = max(im.height for _, im in ims) + 14
sheet = Image.new("RGB", (cw * cols, ch * rows), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for n, (i, im) in enumerate(ims):
    x, y = (n % cols) * cw, (n // cols) * ch
    sheet.paste(im, (x, y + 14))
    d.text((x + 2, y + 1), i, fill=(255, 255, 0))
sheet.save(out)
