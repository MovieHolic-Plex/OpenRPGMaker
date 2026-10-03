"""재조립한 지구 PNG(행인 없음)를 원본(행인 포함)과 픽셀 비교한다. 다른 픽셀은 전부 행인 스프라이트 상자 안이어야 통과.
  python3 verify_districts.py --orig <원본 chipset 폴더> [--new <폴더>] [--boxes people-boxes.json] [--json out.json]"""
import sys, os, json, argparse
import numpy as np
from PIL import Image
import jpenv
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--orig', required=True); ap.add_argument('--new', default=jpenv.DISTRICTS_OUT)
    ap.add_argument('--boxes', default=os.path.join(jpenv.TD, 'districts', 'people-boxes.json')); ap.add_argument('--json')
    a = ap.parse_args(); boxes = json.load(open(a.boxes)); res = {}; ok = True
    for name, bx in boxes.items():
        if name.startswith('_'): continue
        o = np.array(Image.open(os.path.join(a.orig, name)).convert('RGBA')); n = np.array(Image.open(os.path.join(a.new, name)).convert('RGBA'))
        if o.shape != n.shape: res[name] = {'shapeMismatch': [list(o.shape), list(n.shape)]}; ok = False; continue
        diff = (o != n).any(axis=2); mask = np.zeros(diff.shape, bool)
        for x, y, w, h in bx: mask[max(y, 0):y + h, max(x, 0):x + w] = True
        outside = int((diff & ~mask).sum()); total = int(diff.sum())
        res[name] = {'size': [o.shape[1], o.shape[0]], 'people': len(bx), 'diffPixels': total, 'diffOutsidePeopleBoxes': outside, 'diffPct': round(100 * total / diff.size, 3)}
        ok &= (outside == 0)
    res['pass'] = bool(ok); print(json.dumps(res, ensure_ascii=False, indent=1))
    if a.json: json.dump(res, open(a.json, 'w'), ensure_ascii=False, indent=1)
    return 0 if ok else 1
if __name__ == '__main__': sys.exit(main())
