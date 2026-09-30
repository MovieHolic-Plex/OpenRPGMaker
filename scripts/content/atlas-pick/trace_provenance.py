#!/usr/bin/env python3
"""트레이싱 C 조 출처 검사. 손 도트 에셋이 밑그림을 복사하지 않았는지 수치로 본다.
각 에셋을 장면 배치 좌표(placements.json)의 밑그림(bakeoff/c-32px/scene.png, 같은 512x448 배율)과 ±8px 밀어 가며 겹쳐
  exact  = 불투명 화소 중 밑그림 화소와 색이 완전히 같은 비율(밑그림은 팔레트 밖 색이라 복사면 0 에 가깝지 않고 양자화면 높다)
  near   = |dR|+|dG|+|dB| <= 24 인 비율(눈으로 같은 색)
  비교 대상 scene.png 는 C 조 장면(이미 modern3 색으로 양자화된 밑그림)이라 exact 가 가장 엄격한 복사 지표다: 복사면 100% 에 가깝다.
  평평한 한 색 면(도로·옥상 윗면)은 저절로 높게 나온다 — 복사가 아니라 같은 색 고른 것이므로 표에 「평면」 꼬리표를 단다.
  최대값은 오프셋 탐색 최선치(복사면 오프셋 0 에서 정점). 팔레트 밖 색은 modern3_check 로 센다.
  python3 scripts/content/atlas-pick/trace_provenance.py   → trace-c/provenance.json + 표 출력"""
import json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import modern3_check as M
ROOT = os.path.join(HERE, '..', '..', '..')
TC = os.path.join(ROOT, 'tiledata/atlas-pick/trace-c')
UND = os.path.join(ROOT, 'tiledata/atlas-pick/bakeoff/c-32px/scene.png')
R = 8


def main():
    und = np.array(Image.open(UND).convert('RGB')).astype(np.int32)
    H, W = und.shape[:2]
    pal = np.array(sorted({c for r in M.load_pal().values() for c in r}), dtype=np.uint32)
    pal_rgb = np.stack([(pal >> 16) & 255, (pal >> 8) & 255, pal & 255], 1).astype(np.int32)
    # 밑그림 전체를 modern3 최근접색으로(청크 처리)
    flat = und.reshape(-1, 3); q = np.empty_like(flat)
    for i in range(0, len(flat), 20000):
        d = ((flat[i:i + 20000, None, :] - pal_rgb[None]) ** 2).sum(2); q[i:i + 20000] = pal_rgb[d.argmin(1)]
    qund = q.reshape(H, W, 3)
    meta = json.load(open(os.path.join(TC, 'assets.json'), encoding='utf-8'))
    pl = {}
    for n, x, y in json.load(open(os.path.join(TC, 'placements.json'))): pl.setdefault(n, []).append((x, y))
    rows = []
    for m in meta:
        n = m['name']
        a = np.array(Image.open(os.path.join(TC, 'assets', n + '.png')).convert('RGBA'))
        op = a[..., 3] > 0; rgb = a[..., :3].astype(np.int32); h, w = op.shape
        best = dict(exact=0.0, near=0.0)
        for (x0, y0) in pl.get(n, [])[:8]:
            for dy in range(-R, R + 1):
                for dx in range(-R, R + 1):
                    X, Y = x0 + dx, y0 + dy
                    xs, ys = max(0, -X), max(0, -Y); xe, ye = min(w, W - X), min(h, H - Y)
                    if xe - xs < w // 2 or ye - ys < h // 2: continue
                    o = op[ys:ye, xs:xe]
                    if o.sum() < 16: continue
                    u = und[Y + ys:Y + ye, X + xs:X + xe]; qq = qund[Y + ys:Y + ye, X + xs:X + xe]; r = rgb[ys:ye, xs:xe]
                    ex = ((u == r).all(2) & o).sum() / o.sum()
                    ne = ((np.abs(u - r).sum(2) <= 24) & o).sum() / o.sum()
                    best['exact'] = max(best['exact'], float(ex)); best['near'] = max(best['near'], float(ne));
        out, marker, _ = M.check(os.path.join(TC, 'assets', n + '.png'), quiet=True)
        outside = len([k for k in out if k >= 0]) + (1 if -1 in out else 0) + (1 if marker else 0)
        rows.append(dict(name=n, kind=m['kind'], tracedFrom=m['tracedFrom'], placements=len(pl.get(n, [])),
                         exact=round(best['exact'] * 100, 1), near=round(best['near'] * 100, 1),
                         paletteOutside=outside))
    json.dump(rows, open(os.path.join(TC, 'provenance.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('%-18s %-8s %7s %7s %5s' % ('asset', 'kind', 'exact%', 'near%', 'out'))
    for r in rows: print('%-18s %-8s %7.1f %7.1f %5d' % (r['name'], r['kind'], r['exact'], r['near'], r['paletteOutside']))
    for k in ('exact', 'near'):
        v = [r[k] for r in rows if r['placements']]; print('%s 범위 %.1f ~ %.1f, 평균 %.1f, 중앙 %.1f' % (k, min(v), max(v), np.mean(v), np.median(v)))
    print('팔레트 밖 색 합계', sum(r['paletteOutside'] for r in rows))


if __name__ == '__main__':
    main()
