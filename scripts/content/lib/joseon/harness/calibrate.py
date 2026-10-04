"""버들항 객체에서 지표 분포를 재어 통과선(calibration.json)을 만든다.

    python3 harness/calibrate.py
객체 = tiledata/beodeul-city/render/objects/*.png (594개 중 불투명 화소 400 이상 = 건물·나무·큰 소품).
"""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from metrics import metrics

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
OBJ = os.path.join(ROOT, 'tiledata/beodeul-city/render/objects')
LIST = os.path.join(ROOT, 'tiledata/beodeul-city/render/city6_objects.json')


def main():
    items = json.load(open(LIST))
    seen, vals = set(), {}
    for it in items:
        if it['hash'] in seen:
            continue
        seen.add(it['hash'])
        p = os.path.join(OBJ, it['hash'] + '.png')
        if not os.path.exists(p):
            continue
        m = metrics(np.array(Image.open(p).convert('RGBA')))
        if not m or m['opaque_px'] < 400:
            continue
        for k, v in m.items():
            if v is not None:
                vals.setdefault(k, []).append(v)
    band = {}
    for k in ('edge_ratio', 'light_lr', 'thin_ratio', 'grain', 'asym'):
        v = np.array(vals[k])
        band[k] = {'p5': float(np.percentile(v, 5)), 'p50': float(np.percentile(v, 50)), 'p95': float(np.percentile(v, 95)),
                   'min': float(v.min()), 'max': float(v.max()), 'n': int(len(v))}
    json.dump({'source': '버들항 render/objects (불투명 400화소 이상)', 'band': band}, open(os.path.join(HERE, 'calibration.json'), 'w'), indent=1)
    for k, b in band.items():
        print(f"{k:11s} n={b['n']:3d} p5={b['p5']:.3f} p50={b['p50']:.3f} p95={b['p95']:.3f} (min {b['min']:.3f} max {b['max']:.3f})")


if __name__ == '__main__':
    main()
