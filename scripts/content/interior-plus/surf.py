"""바닥·벽면 견본: python3 surf.py out.png — 바닥 6×4칸, 벽 6칸 너비(두 줄), 그림자 규칙 없이."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import loader, iplib
from PIL import Image
reg = loader.load(['structure'])
tiles = []
for f in reg.floors.values():
    im = Image.new('RGBA', (96, 64))
    for y in range(64):
        for x in range(96): im.putpixel((x, y), f['fn'](x, y)[:3] + (255,))
    tiles.append(im)
for w in reg.walls.values():
    im = Image.new('RGBA', (96, 32))
    for y in range(32):
        for x in range(96): im.putpixel((x, y), w['fn'](x, y)[:3] + (255,))
    tiles.append(im)
W = sum(t.width + 6 for t in tiles); out = Image.new('RGBA', (W, 64), (0, 0, 0, 255)); x = 0
for t in tiles: out.paste(iplib.snap(t), (x, 0)); x += t.width + 6
z = int(sys.argv[2]) if len(sys.argv) > 2 else 3
out.resize((out.width * z, out.height * z), Image.NEAREST).save(sys.argv[1])
