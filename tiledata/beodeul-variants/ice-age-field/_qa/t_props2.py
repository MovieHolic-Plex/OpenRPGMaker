import sys, os
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); sys.path.insert(0, HERE)
from PIL import Image
import iaf_props2 as Q, iaf_pieces as A, iaf_props as B, iaf_ground as G
names = ['rock_heads', 'rock_outcrop', 'frozen_bush', 'snowshoe_trail', 'ice_pillar', 'mammoth_skeleton', 'cairn_spear', 'ice_fishing_hole']
ims = [getattr(Q, n)() for n in names] + [A.rock_rimed(), B.frost_snag(), A.mammoth_ribs(), B.tracks_beast()]
snow = G.ground_snow()
W = sum(i.width + 8 for i in ims) + 8; H = 72
o = Image.new('RGBA', (W, H))
for y in range(0, H, 48):
    for x in range(0, W, 48): o.alpha_composite(snow, (x, y))
x = 8
for i in ims: o.alpha_composite(i, (x, H - 4 - i.height)); x += i.width + 8
o.convert('RGB').resize((W * 3, H * 3), 0).save(os.path.join(HERE, '_qa', 'props2-test.png'))
