import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from vq_base import *
import vq_kit as KT, vq_ground as GR
P = lambda n: Image.open(f'parts/{n}.png').convert('RGBA')
# 6칸 집: 지붕 끝 + 몸 2 + 끝, 벽 2층(위층: 모서리 L·창·덧문·꽃·창·모서리 R / 1층: 모서리 L·1층창·문·가게·1층창·모서리 R)
roof = [P('roof-end-left'), P('roof-span'), P('roof-span'), P('roof-end-right')]
up = ['wall-bay-window', 'wall-bay-shutter', 'wall-bay-flower', 'wall-bay-balcony', 'wall-bay-shutter', 'wall-bay-window']
gr = ['wall-bay-ground', 'wall-bay-ground', 'wall-bay-door', 'wall-bay-shop', 'wall-bay-shop', 'wall-bay-ground']
W = 96; rh = roof[0].height
o = Image.new('RGBA', (W + 64, rh + 64 + 40))
g = GR.ground_sample('ground-cobble')
for y in range(0, o.height, 48):
    for x in range(0, o.width, 48): o.alpha_composite(g, (x, y))
x0, y0 = 32, 20
for i, n in enumerate(up): o.alpha_composite(P(n), (x0 + i * 16, y0 + rh - 4))
for i, n in enumerate(gr): o.alpha_composite(P(n), (x0 + i * 16, y0 + rh - 4 + 32))
x = x0
for r in roof: o.alpha_composite(r, (x, y0 + (rh - r.height))); x += r.width
d = P('dormer-point'); o.alpha_composite(d, (x0 + 24 - d.width // 2, y0 + rh - 4 - d.height + 1)); o.alpha_composite(d, (x0 + 72 - d.width // 2, y0 + rh - 4 - d.height + 1))
c = P('chimney-stone'); o.alpha_composite(c, (x0 + 80, y0 - c.height + 20))
o.resize((o.width * 3, o.height * 3), Image.NEAREST).save(os.path.join(os.path.dirname(os.path.abspath(__file__)), 't_modules.png'))
print([P(n).size for n in ('roof-end-left', 'roof-span', 'dormer-point', 'chimney-stone', 'wall-bay-window')])
