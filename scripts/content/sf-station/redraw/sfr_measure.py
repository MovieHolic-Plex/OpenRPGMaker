"""§6·§7 측정(모델 없음): 버들항 시트의 땅/구조물 화소 OKLab L·C 분포(10–90 백분위) · 주인공 칩 · 버들항·실내 v5 키트의 문·벽·창·가구 크기."""
import json, re, sys, colorsys
import numpy as np
from PIL import Image
R = '/home/main/z-project/rpg-zzu-assistant-fable-redraw-sf-station'


def oklab(rgb):
    c = np.asarray(rgb, float) / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    l = 0.4122214708 * c[..., 0] + 0.5363325363 * c[..., 1] + 0.0514459929 * c[..., 2]
    m = 0.2119034982 * c[..., 0] + 0.6806995451 * c[..., 1] + 0.1073969566 * c[..., 2]
    s = 0.0883024619 * c[..., 0] + 0.2817188376 * c[..., 1] + 0.6299787005 * c[..., 2]
    l, m, s = np.cbrt(l), np.cbrt(m), np.cbrt(s)
    return np.stack([0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s], -1)


def LC(rgb):
    o = oklab(rgb); return o[..., 0], np.hypot(o[..., 1], o[..., 2])


def band(px):
    L, C = LC(px[:, :3])
    q = lambda v: [round(float(np.percentile(v, p)), 3) for p in (10, 50, 90)]
    return dict(n=int(len(px)), L=q(L), C=q(C))


def main():
    d = json.load(open(f'{R}/src/assets/beodeulCityTileset.json')); sh = np.array(Image.open(f'{R}/public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')); n = d['tilesPerRow']
    GROUND = {'grass', 'road', 'plaza', 'floor', 'sand', '모래', '풀', '길', '마당', 'yard'}; STRUCT = {'building', 'wall', 'town_wall'}; BAD = {'water', 'lava', 'dungeon', '던전', 'tree'}
    g, s, p = [], [], []
    for i, m in enumerate(d['tileMeta']):
        t = set(m.get('tags', []))
        if t & BAD: continue
        cell = sh[(i // n) * 16:(i // n) * 16 + 16, (i % n) * 16:(i % n) * 16 + 16].reshape(-1, 4); cell = cell[cell[:, 3] == 255]
        if not len(cell): continue
        if t & GROUND and not t & STRUCT: g.append(cell)
        elif t & STRUCT: s.append(cell)
        elif 'prop' in t: p.append(cell)
    out = dict(beodeul=dict(ground=band(np.concatenate(g)), structure=band(np.concatenate(s)), prop=band(np.concatenate(p))))
    a1 = Image.open(f'{R}/public/assets/easyrpg/charset/Actor1.png').convert('RGBA'); print('Actor1', a1.size)
    hero = a1.crop((24, 64, 48, 96)); hero.save('refs/hero.png')
    hp = np.array(hero).reshape(-1, 4); hp = hp[hp[:, 3] == 255]; out['hero'] = band(hp)
    ys, xs = np.nonzero(np.array(hero)[..., 3]); out['hero_bbox'] = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
    # ink: darkest 2% of beodeul structure pixels
    sp = np.concatenate(s); L, C = LC(sp[:, :3]); dark = sp[L <= np.percentile(L, 3)]
    vals, cnt = np.unique(dark[:, :3], axis=0, return_counts=True); o = np.argsort(-cnt)[:6]
    out['beodeul_ink'] = [('#%02x%02x%02x' % tuple(vals[i]), int(cnt[i])) for i in o]
    # kits
    sys.path.insert(0, '/home/main/z-project/assistant-fable-runs/object-oneshot'); import w2_lib as W
    def bbox(cs, kid, lower=True):
        im, k = W.kit_png(cs, kid, lower=lower); a = np.array(im)[..., 3]; ys, xs = np.nonzero(a)
        return dict(kit=kid, canvas=[im.width, im.height], bbox=[int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)])
    ks = {}
    for kid in ('bd-out-plank-door', 'bd-out-log-door', 'bd-out-logg-door', 'bd-out-plank-wall', 'bd-out-log-wall', 'bd-out-log-window', 'bd-out-plank-window', 'bd-mpart-door-bay', 'bd-mpart-lamp-post',
                'bd-prop-lamp_crook', 'bd-prop-lamp_double', 'bd-prop-table_mugs', 'bd-prop-bench_wood', 'bd-tree-a', 'bd-tree-b', 'bd-out-cabin', 'bd-house-lodge'):
        try: ks[kid] = bbox('beodeul_city', kid)
        except Exception as e: ks[kid] = repr(e)[:60]
    di = json.load(open(f'{W.REPO}/src/assets/atlasBiomeInteriorTileset.json'))
    pat = re.compile(r'bed|침대|chair|의자|table|탁자|counter|카운터|shelf|책장|door|문', re.I); seen = 0
    for k in di['structureKits']:
        if pat.search(k['id'] + ' ' + k['name']) and seen < 24:
            try: ks[k['id'] + ' (' + k['name'][:16] + ')'] = bbox('atlas_biome_interior', k['id']); seen += 1
            except Exception as e: pass
    out['kits'] = ks
    json.dump(out, open('measure.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in out.items() if k != 'kits'}, ensure_ascii=False, indent=0))
    for k, v in ks.items(): print(k, v if isinstance(v, str) else (v['canvas'], v['bbox']))
    # old sf ramps in the same units
    sys.path.insert(0, f'{R}/scripts/content/sf-station'); import sf_core as C
    for r, t in C.RAMPS.items():
        L, Cc = LC(np.array([[(v >> 16) & 255, (v >> 8) & 255, v & 255] for v in t]))
        print(f'{r:9}', ' '.join(f'{l:.2f}/{c:.3f}' for l, c in zip(L, Cc)))


main()
