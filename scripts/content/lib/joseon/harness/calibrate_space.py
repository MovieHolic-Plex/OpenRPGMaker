"""버들항에서 나무·공간감 통과선을 잰다 → space_calibration.json"""
import json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from spacemetrics import tree_metrics, lawn_colors, lawn_cells, window_stats
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
R = os.path.join(ROOT, 'tiledata/beodeul-city/render')


def pct(v, p):
    return float(np.percentile(v, p))


items = json.load(open(os.path.join(R, 'city6_objects.json')))
tm = []
for it in items:
    if it['name'] != 'tree' or it['w'] < 48 or it['h'] < 48:
        continue
    im = np.array(Image.open(os.path.join(R, 'objects', it['hash'] + '.png')).convert('RGBA'))
    m = tree_metrics(im)
    if m:
        tm.append(m)
band = {}
for k in ('texture', 'colors', 'px', 'lit', 'crown_ratio', 'w', 'h'):
    v = [m[k] for m in tm]
    band[k] = {'p5': pct(v, 5), 'p25': pct(v, 25), 'p50': pct(v, 50), 'p75': pct(v, 75), 'p95': pct(v, 95), 'n': len(v)}
comp = np.array(Image.open(os.path.join(R, 'city6.png')).convert('RGB'))
lawn = lawn_colors(comp)
G = lawn_cells(comp, 16, lawn)
ws = window_stats(G)
# 마을 안쪽 창만(전체 지도의 바깥 둘레 제외) — 가장자리 창은 바깥 숲이라 제외
H, W = G.shape
inner = []
for y in range(15, H - 30, 5):
    for x in range(15, W - 35, 5):
        inner.append(float(G[y:y + 15, x:x + 20].mean()))
space = {'lawn_ratio_window': {'p50': pct(inner, 50), 'p75': pct(inner, 75), 'p90': pct(inner, 90), 'p95': pct(inner, 95), 'max': max(inner), 'n': len(inner)},
         'lawn_total': float(G.mean())}
json.dump({'source': 'beodeul city6 trees(>=48px) + map windows 20x15', 'tree': band, 'space': space},
          open(os.path.join(HERE, 'space_calibration.json'), 'w'), indent=1)
print(json.dumps({'tree': {k: {kk: round(vv, 3) for kk, vv in v.items()} for k, v in band.items()}, 'space': space}, indent=1))
