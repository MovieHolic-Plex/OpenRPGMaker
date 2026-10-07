"""저장된 프로젝트(project.json)의 wizarding_world 맵을 그림 한 장으로 — 조수 결과 확인용.
  python3 scripts/content/wizarding/render_project_maps.py <project.json> <out.png>"""
import json, os, sys
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '../../..'))
SHEET = Image.open(os.path.join(ROOT, 'public/assets/wizarding-world/wizarding-world-chipset.png')).convert('RGBA')
TS = json.load(open(os.path.join(ROOT, 'src/assets/wizardingWorldTileset.json'), encoding='utf-8'))
TPR = TS['tilesPerRow']; P = TS['passability']
proj = json.load(open(sys.argv[1], encoding='utf-8'))
cells = {}
def tile(t):
    if t not in cells: cells[t] = SHEET.crop(((t % TPR) * 16, (t // TPR) * 16, (t % TPR) * 16 + 16, (t // TPR) * 16 + 16))
    return cells[t]
ims = []
for m in proj['maps'].values():
    if m.get('tilesetId') != 'wizarding_world': continue
    W, H = m['width'], m['height']; im = Image.new('RGBA', (W * 16, H * 16 + 14), (20, 20, 24, 255)); d = ImageDraw.Draw(im)
    for key in ('lowerTiles', 'lowerOverlayTiles', 'upperTiles', 'upperOverlayTiles'):
        arr = m.get(key) or []
        for i, t in enumerate(arr):
            if isinstance(t, int) and 0 <= t < len(P): im.alpha_composite(tile(t), ((i % W) * 16, (i // W) * 16 + 14))
    for ev in m.get('events', []):
        x, y = ev.get('x', 0), ev.get('y', 0); d.rectangle((x * 16 + 2, y * 16 + 16, x * 16 + 13, y * 16 + 27), outline=(255, 60, 200, 255))
    d.text((2, 1), f"{m['name']} {W}x{H}", fill=(255, 255, 0, 255)); ims.append(im)
Wt = 1400; x = y = rh = 0; pos = []
for im in ims:
    if x + im.width > Wt: x = 0; y += rh + 8; rh = 0
    pos.append((x, y)); x += im.width + 8; rh = max(rh, im.height)
S = Image.new('RGBA', (Wt, y + rh), (40, 40, 44, 255))
for im, p in zip(ims, pos): S.paste(im, p)
S.save(sys.argv[2]); print(sys.argv[2], S.size)
