#!/usr/bin/env python3
"""실내 합친 팔레트 시안 — v5.pal(새 기물 203색) + 실내 칩셋 시트에서 뽑은 색 K개(2026-10-03, 사용자 「몬스터 뿐만 아니라 타일들도 문제」).

v5.pal 하나로 바닥·벽을 옮기면 테라코타가 갈색이 되고 이끼가 사라진다(interior-floor-wall.html). 그래서 시트가 실제로 많이 쓰는 색 중
v5 에 없는 것을 K 개로 묶어 v5 에 더한다. 시트 전체(바닥·벽·천장·옛 기물·예제 맵 합성 칸)를 같이 옮겨야 칸끼리 이음매가 맞는다.

쓰는 팔레트로 굳힌 것은 palette/v6.pal(2026-10-03 사용자 확인). 이 스크립트를 다시 돌려도 v6.pal 은 안 바뀐다.
  python3 scripts/content/hand-interior-pick/build_merged_palette.py [--k 128] [--html ~/claude-viz/interior-merged-palette.html]
      [--pal tiledata/hand-interior/pick/palette/v6.pal] [--sheet-out /tmp/interior-chipset-v6.png]

시트·v5.pal 은 바꾸지 않는다. 후보 팔레트 파일(--pal)과 옮긴 시트 사본(--sheet-out)만 만든다 — 켜는 것은 사용자 확인 뒤.
묶는 법: OKLab 가중 k-means(무게 = 시트에서 그 색이 칠한 화소 수). 대표 색은 그 무리의 실제 색(없는 색을 지어내지 않는다).
옮기는 법: 화소마다 OKLab 에서 가장 가까운 팔레트 색.
"""
import argparse, base64, io, json, math, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/asset-gen/pixel-enemy'))
from common_palette_preview import oklab, kmeans, ramps  # noqa: E402

SHEET = os.path.join(ROOT, 'public/assets/atlas-interior/interior-chipset.png')
SPEC = os.path.join(ROOT, 'src/assets/handInteriorSpec.json')
PALDIR = os.path.join(ROOT, 'tiledata/hand-interior/pick/palette')
ROOMS = os.path.join(ROOT, 'tiledata/hand-interior/v5-maps/render')
TONES = '0123456789abcde'   # pxgrid 의 @rampc 단 글자 — 한 램프 15색까지


def v5_colors():
    out = []
    for line in open(os.path.join(PALDIR, 'v5.pal'), encoding='utf-8'):
        if line.startswith('@rampc'):
            out += [tuple(int(c[k:k + 2], 16) for k in (1, 3, 5)) for c in line.split('//')[0].split()[2:] if c.startswith('#')]
    return sorted(set(out))


def sheet_weights(sheet):
    a = np.asarray(sheet); m = a[..., 3] > 0
    cs, n = np.unique(a[m][:, :3], axis=0, return_counts=True)
    return {tuple(int(v) for v in c): int(k) for c, k in zip(cs, n)}


def build(sheet, k):
    v5 = v5_colors(); s5 = set(v5); w = sheet_weights(sheet)
    rest = {c: n for c, n in w.items() if c not in s5}
    tot = sum(rest.values())
    extra = [c for c in kmeans({c: n / tot for c, n in rest.items()}, k) if c not in s5]
    return v5, extra, w


class Snap:
    """색 → 가장 가까운 팔레트 색(OKLab). 시트 색 4천 개 남짓이라 색마다 한 번만 잰다."""
    def __init__(self, pal):
        self.P = np.array(pal); self.PL = oklab(self.P); self.m = {}

    def color(self, c):
        if c not in self.m:
            d = ((self.PL - oklab(np.array([c]))[0]) ** 2).sum(1); j = int(d.argmin())
            self.m[c] = (tuple(int(v) for v in self.P[j]), math.sqrt(d[j]))
        return self.m[c]

    def image(self, im):
        a = np.asarray(im.convert('RGBA')).copy(); m = a[..., 3] > 0
        cs, inv = np.unique(a[m][:, :3], axis=0, return_inverse=True)
        to = np.array([self.color(tuple(int(v) for v in c))[0] for c in cs], dtype=np.uint8)
        px = a[m]; px[:, :3] = to[inv.reshape(-1)]; a[m] = px
        return Image.fromarray(a, 'RGBA')

    def error(self, w):
        """화소 무게로 평균·95%·최대 차(OKLab)."""
        e = sorted((self.color(c)[1], n) for c, n in w.items()); tot = sum(n for _, n in e)
        mean = sum(d * n for d, n in e) / tot; acc = 0; p95 = e[-1][0]
        for d, n in e:
            acc += n
            if acc >= tot * 0.95: p95 = d; break
        return mean, p95, e[-1][0]


def write_pal(path, extra):
    """v5.pal 그대로 + 새 램프(@rampc s1 …). 한 램프는 어두운 → 밝은, 15색까지."""
    lines = [l.rstrip('\n') for l in open(os.path.join(PALDIR, 'v5.pal'), encoding='utf-8')]
    lines += ['', f'// ---- 실내 칩셋 시트에서 더한 색 {len(extra)}개 (build_merged_palette.py) — 바닥·벽·천장·옛 기물이 쓰는 색 중 v5 에 없는 것']
    n = 0; out = []
    for r in ramps(extra):
        for i in range(0, len(r), len(TONES)):
            n += 1; out.append(r[i:i + len(TONES)])
            lines.append(f'@rampc s{n} ' + ' '.join('#%02x%02x%02x' % c for c in r[i:i + len(TONES)]))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    return out


def uri(im, s=1):
    if s != 1: im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    b = io.BytesIO(); im.save(b, 'PNG'); return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()


def patch(sheet, tiles, cols):
    N = sheet.width // 16; rows = (len(tiles) + cols - 1) // cols
    im = Image.new('RGBA', (cols * 16, rows * 16))
    for i, t in enumerate(tiles):
        im.alpha_composite(sheet.crop(((t % N) * 16, (t // N) * 16, (t % N) * 16 + 16, (t // N) * 16 + 16)), ((i % cols) * 16, (i // cols) * 16))
    return im


def strip(rs):
    return ''.join('<div class=ramp>' + ''.join(f'<i style="background:#{c[0]:02x}{c[1]:02x}{c[2]:02x}"></i>' for c in r) + '</div>' for r in rs)


def html(path, sheet, v5, extra, rs, w, s5, sm):
    e5, em = s5.error(w), sm.error(w)
    S = json.load(open(SPEC))
    def trio(name, im, s=3, show=None):
        a, b = s5.image(im), sm.image(im)
        st = f' style="width:{im.width * show}px"' if show else ''   # 방은 1배로 싣고 화면에서만 키운다(페이지 크기)
        return (f'<div class=c><div class=p><figure><img src="{uri(im, s)}"{st}><figcaption>지금</figcaption></figure>'
                f'<figure><img src="{uri(a, s)}"{st}><figcaption>v5 만</figcaption></figure>'
                f'<figure class=pick><img src="{uri(b, s)}"{st}><figcaption>합친 팔레트</figcaption></figure></div><b>{name}</b></div>')
    h = ['<!doctype html><meta charset=utf-8><title>실내 합친 팔레트 시안</title><style>body{background:#1d1b20;color:#ddd;font:14px sans-serif;margin:20px;max-width:1700px}'
         '.g{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end}.c{display:flex;flex-direction:column;gap:4px;background:#2a272e;padding:8px}'
         '.p{display:flex;gap:6px;align-items:flex-end}figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:2px}figcaption{font-size:11px;color:#999}'
         'figure.pick figcaption{color:#9fd88a;font-weight:bold}img{image-rendering:pixelated;display:block}h2{font-size:17px;margin:30px 0 8px}'
         '.ramp{display:flex;margin:2px 0}.ramp i{width:18px;height:18px;display:block}.pals{display:flex;gap:50px;flex-wrap:wrap}'
         'table{border-collapse:collapse}td,th{padding:5px 14px;border-bottom:1px solid #3a3640;text-align:left}.room img{max-width:100%}</style>',
         '<h1 style="font-size:21px">실내 합친 팔레트 시안 — v5 팔레트 + 실내 타일에서 뽑은 색</h1>',
         f'<p>새 기물은 v5 팔레트 {len(v5)}색으로 그린다. 바닥·벽·천장·예전 기물은 시트에서 <b>{len(w)}색</b>을 쓴다. '
         f'v5 에 없는 색 중 많이 쓰는 것을 <b>{len(extra)}색</b>으로 묶어 더하면 합쳐서 <b>{len(v5) + len(extra)}색</b>이다. '
         '시트 전체를 그 색으로 옮긴 것을 지금 그림과 나란히 보인다. 시트는 아직 바꾸지 않았다(시안).</p>',
         '<table><tr><th></th><th>색 수</th><th>평균 차이</th><th>많이 바뀐 곳(상위 5%)</th><th>가장 크게 바뀐 색</th></tr>',
         f'<tr><td>v5 만</td><td>{len(v5)}</td><td>{e5[0]:.4f}</td><td>{e5[1]:.3f}</td><td>{e5[2]:.3f}</td></tr>',
         f'<tr><td><b>합친 팔레트</b></td><td>{len(v5) + len(extra)}</td><td><b>{em[0]:.4f}</b></td><td>{em[1]:.3f}</td><td>{em[2]:.3f}</td></tr></table>',
         '<p style="color:#aaa">차이 단위: 0.02 쯤이 눈으로 「색이 다르다」고 알아채는 정도. 평균이 0.006 이면 대부분 칸은 구분이 안 된다. '
         '다만 가장 크게 바뀐 색은 드물게 쓰인 색이라 아래 그림에서 눈으로 확인할 것.</p>',
         '<h2>팔레트</h2><div class=pals>'
         f'<div><b>v5 ({len(v5)}색, 그대로)</b>{strip(ramps(v5))}</div><div><b>더한 색 ({len(extra)}색)</b>{strip(rs)}</div></div>']
    rooms = [r[:-4] for r in sorted(os.listdir(ROOMS)) if r.endswith('.png')]
    h.append(f'<h2>예제 방 {len(rooms)}개 — 지금 · v5 만 · 합친 팔레트</h2><div class="g room">'
             + ''.join(trio(r, Image.open(os.path.join(ROOMS, r + '.png')), 1, 2) for r in rooms) + '</div>')
    h.append(f'<h2>바닥 ({len(S["floors"])}종)</h2><div class=g>'
             + ''.join(trio(f.get('ko') or n, patch(sheet, f['tiles'][:f['cols'] * f['rows']], f['cols'])) for n, f in S['floors'].items()) + '</div>')
    h.append(f'<h2>벽 ({len(S["walls"])}종)</h2><div class=g>'
             + ''.join(trio(x.get('ko') or n, patch(sheet, x['tiles'], x['cols'])) for n, x in S['walls'].items()) + '</div>')
    h.append(f'<h2>천장 ({len(S["ceilings"])}종)</h2><div class=g>'
             + ''.join(trio(n, patch(sheet, ts[:16], 8)) for n, ts in S['ceilings'].items()) + '</div>')
    open(os.path.expanduser(path), 'w').write('\n'.join(h))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--k', type=int, default=128)
    ap.add_argument('--pal', default=os.path.join(PALDIR, 'v6-candidate.pal'))
    ap.add_argument('--sheet-out', default='/tmp/interior-chipset-merged.png')
    ap.add_argument('--html')
    a = ap.parse_args()
    sheet = Image.open(SHEET).convert('RGBA')
    v5, extra, w = build(sheet, a.k)
    rs = write_pal(a.pal, extra)
    s5, sm = Snap(v5), Snap(v5 + extra)
    sm.image(sheet).save(a.sheet_out)
    e5, em = s5.error(w), sm.error(w)
    print(f'v5 {len(v5)} + 더함 {len(extra)} = {len(v5) + len(extra)}색 · 평균 차 v5만 {e5[0]:.4f} → 합침 {em[0]:.4f} (95% {em[1]:.3f}, 최대 {em[2]:.3f})')
    print('팔레트:', os.path.relpath(a.pal, ROOT), '· 옮긴 시트:', a.sheet_out)
    if a.html: html(a.html, sheet, v5, extra, rs, w, s5, sm)


if __name__ == '__main__':
    main()
