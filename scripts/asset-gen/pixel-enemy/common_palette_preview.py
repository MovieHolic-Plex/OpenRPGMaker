#!/usr/bin/env python3
"""몬스터 공통 팔레트 시안 — 도트 몬스터 140종이 쓰는 색(876개)을 K 색으로 묶고, 140종을 그 색으로 옮긴 전후를 보여 준다
(2026-10-03, 사용자 「몬스터용 공통 팔레트도 좀 필요할거같고」). 그림은 바꾸지 않는다 — 시안 페이지만.

  python3 scripts/asset-gen/pixel-enemy/common_palette_preview.py ~/claude-viz/monster-palette.html [--k 48 64]

묶는 법: OKLab 에서 가중 k-means(한 몬스터가 전체에 같은 몫 — 큰 몬스터가 팔레트를 독차지하지 않게). 결과 색은 색상끼리 묶어
어두운 → 밝은 램프로 늘어놓는다. 가장 어두운 색(윤곽)은 몬스터마다 다른 색을 쓰므로 그대로 두지 않고 함께 묶는다.
"""
import argparse, base64, glob, io, json, math, os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
SRC = os.path.join(ROOT, 'public/assets/generated/pixel-enemy-portraits')


def to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def oklab(rgb):
    r, g, b = to_lin(rgb.astype(float)).T
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
                     1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
                     0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], 1)


def load():
    out = []
    for f in sorted(glob.glob(os.path.join(SRC, '*.png'))):
        out.append((os.path.basename(f)[:-4], Image.open(f).convert('RGBA')))
    return out


def colors(sprites):
    """색 → 무게(몬스터마다 합 1)."""
    w = {}
    for _, im in sprites:
        cs = [c[:3] for c in im.get_flattened_data() if c[3] > 0]
        for c in set(cs): w[c] = w.get(c, 0) + cs.count(c) / len(cs)
    return w


def kmeans(w, k, it=60, seed=7):
    C = np.array(list(w)); W = np.array([w[tuple(c)] for c in C]); X = oklab(C)
    rng = np.random.default_rng(seed)
    cent = X[[int(rng.choice(len(X), p=W / W.sum()))]]   # k-means++ 시작
    while len(cent) < k:
        d = ((X[:, None] - cent[None]) ** 2).sum(-1).min(1) * W
        cent = np.vstack([cent, X[int(rng.choice(len(X), p=d / d.sum()))]])
    for _ in range(it):
        lab = ((X[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
        for j in range(k):
            m = lab == j
            if m.any(): cent[j] = (X[m] * W[m, None]).sum(0) / W[m].sum()
    lab = ((X[:, None] - cent[None]) ** 2).sum(-1).argmin(1)
    # 대표 색 = 그 무리에서 무게 중심에 가장 가까운 실제 색(없는 색을 지어내지 않는다)
    pal = []
    for j in range(k):
        m = np.where(lab == j)[0]
        if not len(m): continue
        pal.append(tuple(int(v) for v in C[m[((X[m] - cent[j]) ** 2).sum(1).argmin()]]))
    return sorted(set(pal))


def ramps(pal):
    """색상(hue)으로 묶어 어두운 → 밝은 줄."""
    P = np.array(pal); L = oklab(P); groups = {}
    for c, (l, a, b) in zip(pal, L):
        ch = math.hypot(a, b)
        key = 'gray' if ch < 0.035 else int(((math.degrees(math.atan2(b, a)) + 360 + 15) % 360) // 30)
        groups.setdefault(key, []).append((l, c))
    return [[c for _, c in sorted(v)] for k, v in sorted(groups.items(), key=lambda kv: (kv[0] != 'gray', str(kv[0]).zfill(3)))]


def snap(im, pal):
    P = np.array(pal); PL = oklab(P); cache = {}
    px = im.load(); out = im.copy(); po = out.load(); err = []
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]
            if c[3] == 0: continue
            if c[:3] not in cache:
                d = ((PL - oklab(np.array([c[:3]]))[0]) ** 2).sum(1); j = int(d.argmin()); cache[c[:3]] = (tuple(int(v) for v in P[j]), math.sqrt(d[j]))
            po[x, y] = cache[c[:3]][0] + (c[3],); err.append(cache[c[:3]][1])
    return out, (sum(err) / len(err) if err else 0), max(err or [0])


def uri(im, s):
    im = im.resize((im.width * s, im.height * s), Image.NEAREST); b = io.BytesIO(); im.save(b, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def strip(rs):
    h = ''
    for r in rs:
        h += '<div class=ramp>' + ''.join(f'<i style="background:#{c[0]:02x}{c[1]:02x}{c[2]:02x}" title="#{c[0]:02x}{c[1]:02x}{c[2]:02x}"></i>' for c in r) + '</div>'
    return h


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--k', type=int, nargs='+', default=[48, 64]); a = ap.parse_args()
    sp = load(); w = colors(sp)
    pals = {k: kmeans(w, k) for k in a.k}
    res = {k: [(n,) + snap(im, p) for n, im in sp] for k, p in pals.items()}
    h = ['<!doctype html><meta charset=utf-8><title>몬스터 공통 팔레트 시안</title><style>body{background:#1d1b20;color:#ddd;font:14px sans-serif;margin:20px}'
         '.ramp{display:flex;margin:2px 0}.ramp i{width:22px;height:22px;display:block}h2{font-size:16px;margin:26px 0 8px}'
         '.g{display:flex;flex-wrap:wrap;gap:8px}.c{background:#2a272e;padding:5px;display:flex;flex-direction:column;align-items:center;gap:2px}'
         '.p{display:flex;gap:3px;background:#8f7f66;padding:3px}img{image-rendering:pixelated}span{font-size:11px;color:#aaa}.bad{outline:2px solid #e0685a}.pals{display:flex;gap:40px;flex-wrap:wrap}</style>',
         '<h1 style="font-size:20px">몬스터 공통 팔레트 시안 — 도트 몬스터 140종</h1>',
         f'<p>지금 140종이 쓰는 색은 모두 <b>{len(w)}개</b>다(한 마리 4~14색, 마리마다 따로 고른 색). 이것을 몇 개로 묶은 공통 팔레트로 옮기면 어떻게 되는지 본다. '
         '그림은 바꾸지 않았다 — 시안이다. 각 칸: <b>' + ' · '.join(['지금'] + [f'{k}색' for k in a.k]) + '</b>. 빨간 테 = 색이 크게 바뀐 마리(눈으로 꼭 볼 것).</p>',
         '<div class=pals>' + ''.join(f'<div><h2>{k}색 팔레트 (실제 {len(p)}색)</h2>{strip(ramps(p))}</div>' for k, p in pals.items()) + '</div>']
    rows = []
    for i, (n, im) in enumerate(sp):
        cells = [uri(im, 2)] + [uri(res[k][i][1], 2) for k in a.k]
        worst = max(res[k][i][3] for k in a.k[-1:])
        rows.append((worst, f'<div class="c {"bad" if worst > 0.06 else ""}"><div class=p>' + ''.join(f'<img src="{u}">' for u in cells)
                     + f'</div><b>{n}</b><span>' + ' · '.join(f'{k}색 평균차 {res[k][i][2]:.3f}' for k in a.k) + '</span></div>'))
    h.append('<h2>140종 전후 (색이 많이 바뀐 순)</h2><div class=g>' + ''.join(r for _, r in sorted(rows, key=lambda t: -t[0])) + '</div>')
    open(os.path.expanduser(a.out), 'w').write('\n'.join(h))
    json.dump({str(k): ['#%02x%02x%02x' % c for c in p] for k, p in pals.items()}, open('/tmp/monster-palette-candidates.json', 'w'))
    for k in a.k: print(k, '색 — 크게 바뀐 마리', sum(1 for r in res[k] if r[3] > 0.06), '/', len(sp))


if __name__ == '__main__':
    main()
