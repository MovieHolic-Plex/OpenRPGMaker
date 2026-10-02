#!/usr/bin/env python3
"""월드맵 키트 빌더 — 지형(공용) + 팔레트(색 표) + 아이콘 세트 + 여정 템플릿을 한 장으로 합친다.

  python3 kit/build_world.py --iconset fantasy --palette original --journey fantasy-5act --out out/
  python3 kit/build_world.py --iconset fantasy --palette winter,dusk --journey fantasy-5act --out out/ --tint-icons 0.4
  python3 kit/build_world.py --iconset fantasy --palette all --journey fantasy-5act --out out/ --cache /tmp/wmk-cache

단계: 입력 검사(세트가 템플릿의 모든 역할을 칸 수대로 채우는가) → 지형 렌더(공용, 아이콘 없음; 한 번) →
      [팔레트마다] 지형 색만 교체 → 아이콘 붙이기(역할별 변형은 장소 id 의 crc32 로 결정, 세트의 pins 가 우선; 아이콘 색은 --tint-icons 만큼만 팔레트 빛으로) →
      PNG 와 world.json 을 쓴다. 그림자 키색(254,103,139)은 바닥을 어둡게 하는 그림자로, 키색(255,103,139)은 투명으로 처리한다.
출력: <out>/<iconset>-<palette>.png, <out>/world.json, <out>/build-report.json
--cache 는 지형(C)·색 -> 칸종류 표를 저장한다. 키는 여정 템플릿 + 역할 표 + 지형 코드이므로 아이콘 그림이 달라도(칸 수가 같으면) 재사용된다.
종료 코드: 0 성공, 2 입력 오류.
"""
import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

sys.dont_write_bytecode = True
os.environ['CITY_TAG'] = 'v8'
KIT = Path(__file__).resolve().parent
sys.path.insert(0, str(KIT / 'lib'))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

import kit_common as K  # noqa: E402
import kit_palette as KP  # noqa: E402

KEY_ROLES = ('grass', 'savanna', 'sand', 'tundra', 'snow', 'forest', 'mount', 'rock', 'swamp', 'badlands', 'ash', 'sea', 'river')   # 구별력 지표를 재는 주요 지형
PALETTE_ORDER = ['original', 'ruin', 'dusk', 'winter', 'ashfall', 'regional']


def signature(journey_id, roles_data):
    h = hashlib.sha1()
    h.update((K.WM / 'journeys' / (journey_id + '.json')).read_bytes())
    h.update(json.dumps(roles_data['roles'], sort_keys=True).encode())
    for f in sorted(K.LIB.glob('*.py')):
        if f.name.startswith(('kit_palette', 'kit_common')):      # 팔레트·입력 검사 코드는 지형에 영향이 없다
            continue
        h.update(f.name.encode())
        h.update(f.read_bytes())
    return h.hexdigest()


def build_terrain(journey, roles, roles_data, iconset, assign, cache):
    """지형 그림 C(아이콘 없음)·색 표·세계 JSON. 캐시가 맞으면 읽는다."""
    sig = signature(journey['id'], roles_data)
    if cache:
        cache = Path(cache)
        cj, cn = cache / 'terrain.json', cache / 'terrain.npz'
        if cj.exists() and cn.exists():
            meta = json.loads(cj.read_text())
            if meta.get('sig') == sig:
                z = np.load(cn)
                return dict(C=z['C'], ukeys=z['ukeys'], role=z['role'], G=z['G'], grp_t=z['grp_t'], world=meta['world'], paths_same=meta['paths_same'],
                            purity=meta['purity'], cached=True, seconds=0.0)
    import kit_world as W
    t0 = time.time()
    W.install(journey, roles, iconset, assign)
    w = W.make_world()
    C, info, paths_same = W.render_terrain(w)
    ukeys, role, grp_t, _cnt = KP.build_roles(C, w.M, info)
    purity = KP.role_purity(C, ukeys, role, grp_t)
    world = W.world_dict(w, journey, assign)
    out = dict(C=C, ukeys=ukeys, role=role, G=w.M.G.copy(), grp_t=grp_t, world=world, paths_same=bool(paths_same), purity=purity, cached=False, seconds=time.time() - t0)
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(cache / 'terrain.npz', C=C, ukeys=ukeys, role=role, G=out['G'], grp_t=grp_t)
        (cache / 'terrain.json').write_text(json.dumps(dict(sig=sig, world=world, paths_same=out['paths_same'], purity=purity), ensure_ascii=False))
    return out


def separation_metrics(img, C, ukeys, role):
    """팔레트 결과(img)의 지형 구별력 지표. 화소마다 원래 지형(C 의 색 -> role)으로 role 을 정하고, 결과 색을 role 별로 센다.
    steps: role 별 명암 단 수(그 role 화소의 0.5% 이상을 차지하는 색을 L 간격 0.03 이상으로 서로 다른 단으로 센 것).
    min_pairs: role 별 평균색(OKLab)의 쌍별 거리 중 가장 가까운 쌍. KEY_ROLES 끼리만 재면 key_min_pair."""
    rp = role[np.searchsorted(ukeys, KP.key_of(C).ravel())].astype(np.int64)
    u, cnt = np.unique((rp << 32) | KP.key_of(img).ravel(), return_counts=True)
    ur, uk = (u >> 32).astype(int), u & 0xffffffff
    cols = np.stack([(uk >> 16) & 255, (uk >> 8) & 255, uk & 255], -1).astype(np.uint8)
    lab = KP.to_oklab(cols.astype(np.float64))
    means, steps = {}, {}
    for gi, g in enumerate(KP.GROUPS):
        m = ur == gi
        if not m.any() or cnt[m].sum() < 800:      # 화면에 거의 없는 role(독수·용암·화산 몇 칸)은 지표에서 뺀다
            continue
        wgt = cnt[m].astype(np.float64)
        means[g] = (lab[m] * wgt[:, None]).sum(0) / wgt.sum()
        Ls = np.sort(lab[m][wgt >= 0.005 * wgt.sum()][:, 0])
        n, last = 0, -9
        for L in Ls:
            if L - last >= 0.03:
                n += 1
                last = L
        steps[g] = n
    names = sorted(means)
    pair = {a + '/' + b: float(np.linalg.norm(means[a] - means[b])) for i, a in enumerate(names) for b in names[i + 1:]}
    ordered = sorted(pair.items(), key=lambda kv: kv[1])
    key = {k: v for k, v in pair.items() if all(r in KEY_ROLES for r in k.split('/'))}
    kmin = min(key.items(), key=lambda kv: kv[1]) if key else None
    ksteps = {r: steps[r] for r in KEY_ROLES if r in steps}
    return dict(steps=steps, min_pairs=ordered[:6], median_pair=float(np.median(list(pair.values()))) if pair else None,
                key_min_pair=kmin, key_min_steps=min(ksteps.items(), key=lambda kv: kv[1]) if ksteps else None)


def icon_metrics(terrain, final, ic, sky_site):
    """아이콘이 둘레 지형에서 묻히지 않는지: 아이콘 화소 중 둘레 2칸 고리의 평균색과 OKLab 거리 0.08 이상인 화소 비율(p). 가장 낮은 아이콘과 중앙값."""
    rects = {k: tuple(v) for k, v in ic.items() if not k.endswith('경사로')}
    rects[sky_site[0]] = tuple(sky_site[1:])
    H, W = terrain.shape[:2]
    res = {}
    for name, (x, y, w, h) in rects.items():
        icon_mask = np.zeros((H, W), bool)
        icon_mask[y * 16:(y + h) * 16, x * 16:(x + w) * 16] = (terrain[y * 16:(y + h) * 16, x * 16:(x + w) * 16] != final[y * 16:(y + h) * 16, x * 16:(x + w) * 16]).any(2)
        ring = np.zeros((H, W), bool)
        ring[max(y - 2, 0) * 16:(y + h + 2) * 16, max(x - 2, 0) * 16:(x + w + 2) * 16] = True
        ring[y * 16:(y + h) * 16, x * 16:(x + w) * 16] = False
        if icon_mask.sum() < 20:
            continue
        ring_lab = KP.to_oklab(terrain[ring].astype(np.float64)).mean(0)
        lab = KP.to_oklab(final[icon_mask].astype(np.float64))
        res[name] = float((np.linalg.norm(lab - ring_lab, axis=1) >= 0.08).mean())
    vals = sorted(res.items(), key=lambda kv: kv[1])
    return dict(min=vals[0], median=float(np.median([v for _, v in vals])), lowest=vals[:3])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--iconset', required=True)
    ap.add_argument('--palette', required=True, help='palettes/<id> — 쉼표로 여러 개, all = palettes/ 전부')
    ap.add_argument('--journey', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--tint-icons', type=float, default=None, help='아이콘 색을 팔레트 빛으로 옮기는 정도 0..1 (기본 0.25, 팔레트 icon_tint 가 있으면 그 값)')
    ap.add_argument('--cache', help='지형 캐시 폴더')
    ap.add_argument('--no-check', action='store_true', help='여정 도달성 검사를 건너뛴다')
    a = ap.parse_args()
    try:
        roles, roles_data = K.load_roles()
        journey = K.load_journey(a.journey)
        iconset = K.IconSet(a.iconset)
        assign = K.assign_icons(roles, journey, iconset)          # 역할 채움 검사 포함(모자라면 여기서 KitError)
        pdir = K.WM / 'palettes'
        if a.palette == 'all':
            ids = sorted([p.stem for p in pdir.glob('*.json')], key=lambda s: (PALETTE_ORDER.index(s) if s in PALETTE_ORDER else 99, s))
        else:
            ids = [s.strip() for s in a.palette.split(',') if s.strip()]
        palettes = []
        for pid in ids:
            if not (pdir / (pid + '.json')).exists():
                raise K.KitError('palettes/%s.json 이 없다 (있는 것: %s)' % (pid, ', '.join(sorted(p.stem for p in pdir.glob('*.json')))))
            palettes.append(KP.load_palette(pdir / (pid + '.json'), pdir))
        if a.tint_icons is not None and not 0 <= a.tint_icons <= 1:
            raise K.KitError('--tint-icons 는 0..1')
        out = Path(a.out)
        t = build_terrain(journey, roles, roles_data, iconset, assign, a.cache)
    except K.KitError as e:
        print('입력 오류:\n' + str(e), file=sys.stderr)
        sys.exit(2)
    out.mkdir(parents=True, exist_ok=True)
    world = t['world']
    for pl in world['places']:                      # 캐시에서 읽은 지형의 장소 표는 처음 만든 세트의 아이콘 이름을 갖고 있다 — 지금 세트의 배정으로 덮는다
        pl['icon'] = assign[pl['id']]
    print('지형 %s (%.1f초) 길 일치=%s role 순도=%.3f' % ('캐시' if t['cached'] else '렌더', t['seconds'], t['paths_same'], t['purity']))
    import kit_world as W
    ic = {k: tuple(v) for k, v in world['ic'].items()}
    sky_site = tuple(world['sky_site'])
    report = dict(iconset=iconset.id, journey=journey['id'], terrain_seconds=t['seconds'], role_purity=t['purity'], palettes={})
    files = {}
    for pal in palettes:
        tint = a.tint_icons if a.tint_icons is not None else pal.get('icon_tint', 0.25)
        img, extra = KP.recolor_terrain(t['C'], t['ukeys'], t['role'], pal, t['G'])
        final = W.paste_icons(img, ic, sky_site, iconset, assign, lambda arr: KP.tint_icon(arr, pal, tint, iconset.key, iconset.shadow_key))
        fn = '%s-%s.png' % (iconset.id, pal['id'])
        Image.fromarray(final).save(out / fn, optimize=True)
        files[pal['id']] = fn
        m = separation_metrics(img, t['C'], t['ukeys'], t['role'])
        im = icon_metrics(img, final, ic, sky_site)
        report['palettes'][pal['id']] = dict(file=fn, icon_tint=tint, terrain_metrics=m, icon_metrics=im, levels=extra.get('levels'))
        print('  %-9s -> %s (icon tint %.2f)  주요 지형 최소 쌍거리 %s %.3f · 최소 명암 단 %s %d' % (
            pal['id'], fn, tint, m['key_min_pair'][0], m['key_min_pair'][1], m['key_min_steps'][0], m['key_min_steps'][1]))
        print('            아이콘 구별(둘레와 다른 화소 비율): 최저 %s %.2f · 중앙 %.2f' % (im['min'][0], im['min'][1], im['median']))
    world.update(iconset=iconset.id, icons_used=sorted(set(assign.values())), palettes=[p['id'] for p in palettes], images=files)
    if len(palettes) == 1:
        world['palette'] = palettes[0]['id']
    (out / 'world.json').write_text(json.dumps(world, ensure_ascii=False))
    if not a.no_check:
        import kit_world as W2
        from check_journey import run_check
        jw = W2.MapWorld(world)
        bad, info, txt = run_check(journey, jw, out_path=out / 'journey-check.txt', verbose=False)
        report['journey_check'] = dict(ok=not bad, bad=bad)
        print('여정 검사: %s' % ('통과' if not bad else '불일치 %d건 — %s' % (len(bad), '; '.join(bad[:3]))))
    (out / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
