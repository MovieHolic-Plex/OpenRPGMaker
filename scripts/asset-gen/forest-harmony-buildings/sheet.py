"""후보 대조표: 원본(틀 자리 잘라 1/2) | 틀 강제 결과(3배) | 판정."""
import json, sys
from PIL import Image, ImageDraw, ImageFont
from fhlib import *
names = sys.argv[2:]; dst = sys.argv[1]
font = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 14)
cells = []
for n in names:
    c = json.load(open(f'{OUT}/{n}-check.json'))
    x, y, w, h = c['bbox']
    raw = Image.open(f'{OUT}/{n}-raw.png').convert('RGBA'); raw = Image.alpha_composite(Image.new('RGBA', raw.size, (255, 0, 255, 255)), raw).convert('RGB').crop((x, y, x + w, y + h)).resize((w // 2, h // 2), Image.LANCZOS)
    art = Image.open(f'{OUT}/{n}-art.png'); S = int(os.environ.get('S', 3)); art = art.resize((art.width * S, art.height * S), Image.NEAREST)
    W = raw.width + art.width + 30; H = max(raw.height, art.height) + 40
    im = Image.new('RGB', (W, H), (40, 44, 40)); im.paste(raw, (5, 35)); im.paste(art, (raw.width + 20, 35), art)
    d = ImageDraw.Draw(im)
    bad = [k for k, v in c['checks'].items() if not v]
    d.text((5, 5), f"{n}  {'통과' if c['pass'] else '탈락: ' + ', '.join(bad)}", fill=(120, 255, 120) if c['pass'] else (255, 120, 120), font=font)
    cells.append(im)
Wt = max(i.width for i in cells); Ht = sum(i.height for i in cells)
o = Image.new('RGB', (Wt, Ht), (40, 44, 40)); y = 0
for i in cells: o.paste(i, (0, y)); y += i.height
o.save(dst); print(dst, o.size)
