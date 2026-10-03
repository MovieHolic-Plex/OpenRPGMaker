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
import kit_terrain as KTer  # noqa: E402

FIT_TRIES = 6           # 생성 지형: 맞춤·길·여정 검사가 실패하면 salt 를 바꿔 다시(새 프로세스 — kit_world.install 은 프로세스당 한 번)


NO_CHECK = [False]


class RetryFit(Exception):
    """생성 지형의 배치가 이번 salt 로는 안 맞았다(맞춤 실패·길 실패·여정 검사 불일치)."""


KEY_ROLES = ('grass', 'savanna', 'sand', 'tundra', 'snow', 'forest', 'mount', 'rock', 'swamp', 'badlands', 'ash', 'sea', 'river')   # 구별력 지표를 재는 주요 지형
PALETTE_ORDER = ['original', 'ruin', 'dusk', 'winter', 'ashfall', 'regional']


def signature(journey_id, roles_data, terrain=None):
    h = hashlib.sha1()
    h.update((K.WM / 'journeys' / (journey_id + '.json')).read_bytes())
    if terrain is not None:                          # 지형 편집 작업도 지형 모양을 바꾼다
        h.update(json.dumps(terrain, sort_keys=True, ensure_ascii=False).encode())
    h.update(json.dumps(roles_data['roles'], sort_keys=True).encode())
    for f in sorted(K.LIB.glob('*.py')):
        if f.name.startswith(('kit_palette', 'kit_common', 'kit_theme')):      # 팔레트·입력 검사·테마 덧칠 코드는 지형에 영향이 없다
            continue
        h.update(f.name.encode())
        h.update(f.read_bytes())
    return h.hexdigest()


def build_terrain(journey, roles, roles_data, iconset, assign, cache, terrain=None):
    """지형 그림 C(아이콘 없음)·색 표·세계 JSON. 캐시가 맞으면 읽는다."""
    sig = signature(journey['id'], roles_data, terrain)
    if cache:
        cache = Path(cache) / ('terrain-' + sig[:12] if terrain else '')     # 지형마다 따로 — 하나로 두면 테마를 오갈 때마다 100초 렌더
        cj, cn = cache / 'terrain.json', cache / 'terrain.npz'
        if cj.exists() and cn.exists():
            meta = json.loads(cj.read_text())
            if meta.get('sig') == sig:
                z = np.load(cn)
                _emit_warnings(meta['world'])
                return dict(C=z['C'], ukeys=z['ukeys'], role=z['role'], G=z['G'], grp_t=z['grp_t'], world=meta['world'], paths_same=meta['paths_same'],
                            purity=meta['purity'], cached=True, seconds=0.0)
    import kit_world as W
    t0 = time.time()
    W.install(journey, roles, iconset, assign)
    w = _make_world_gen(W, journey, terrain)
    C, info, paths_same = W.render_terrain(w)
    ukeys, role, grp_t, _cnt = KP.build_roles(C, w.M, info)
    purity = KP.role_purity(C, ukeys, role, grp_t)
    world = W.world_dict(w, journey, assign)
    world['terrain'] = terrain['id'] if terrain else 'shared-v9'
    world['place_rules'] = KTer.place_rules(journey)
    world['edit_ground'] = _edit_ground_cells()
    _collect_warnings(world, terrain)
    out = dict(C=C, ukeys=ukeys, role=role, G=w.M.G.copy(), grp_t=grp_t, world=world, paths_same=bool(paths_same), purity=purity, cached=False, seconds=time.time() - t0)
    if cache:
        cache.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(cache / 'terrain.npz', C=C, ukeys=ukeys, role=role, G=out['G'], grp_t=grp_t)
        (cache / 'terrain.json').write_text(json.dumps(dict(sig=sig, world=world, paths_same=out['paths_same'], purity=purity), ensure_ascii=False))
    return out


def _generated(terrain):
    return bool(terrain) and terrain.get('base') == 'generate'


def _make_world_gen(W, journey, terrain):
    """세계를 만들고, 생성 지형이면 렌더 전에 여정을 검사한다 — 2분 렌더 뒤에야 실패를 알지 않게."""
    try:
        w = W.make_world()
    except K.KitError as e:
        if _generated(terrain):
            raise RetryFit(str(e))
        raise
    if _generated(terrain) and not NO_CHECK[0]:
        from check_journey import run_check
        bad, _info, _txt = run_check(journey, w, verbose=False)
        if bad:
            raise RetryFit('; '.join(KTer.explain(bad, journey)[:4]))
    return w


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


def walk_rows(world):
    """걸을 수 있는 칸(관문 열림·다리·경사로·장소 발자국 포함) — 게임 맵의 통행 표로 쓴다. 행마다 '0'/'1' 문자열."""
    import kit_world as W
    w0 = W.MapWorld(world).walk0
    return [''.join('1' if v else '0' for v in row) for row in w0]


def _edit_ground_cells():
    """지형 편집이 바닥을 정한 칸 [[x,y],...] — 지역 팔레트가 그 칸을 덮지 않게(recolor_terrain keep_cells)."""
    import make_map_v4 as M4
    if M4.EDIT_GROUND is None:
        return []
    return [[int(x), int(y)] for y, x in np.argwhere(M4.EDIT_GROUND)]


def _collect_warnings(world, terrain):
    """키트 경고(경사로 면 없음 등) + 작업이 덜 먹은 곳(숲이 사막 위) — 세계 JSON 에 남겨 캐시로 읽을 때도 다시 알린다."""
    import make_map_v4 as M4
    import kit_terrain as KTer
    world['warnings'] = list(M4.WARN) + KTer.coverage(terrain, world)
    _emit_warnings(world)


def _emit_warnings(world):
    for m in world.get('warnings', []):
        print('지형 경고: ' + m)


GLYPH = {0: '~', 1: 'r', 2: 'L', 3: 'x', 10: '.', 11: 'f', 12: 'v', 13: 's', 14: 'd', 15: 'D', 16: 'b', 17: 'a', 18: 'B', 19: 'w', 20: 'm',
         21: 't', 22: 'n', 23: 'g', 24: 'j', 25: 'c', 26: 'o', 27: 'p'}
SCHEMA_RGB = {0: (40, 80, 160), 1: (70, 130, 220), 2: (230, 80, 30), 3: (150, 90, 190), 10: (110, 180, 80), 11: (220, 200, 90), 12: (200, 190, 110),
              13: (235, 215, 150), 14: (245, 225, 165), 15: (160, 130, 90), 16: (190, 100, 70), 17: (90, 85, 85), 18: (60, 55, 60), 19: (80, 120, 90),
              20: (110, 80, 140), 21: (170, 180, 160), 22: (240, 245, 250), 23: (200, 230, 245), 24: (60, 140, 70), 25: (40, 30, 30),
              26: (120, 40, 30), 27: (120, 190, 90)}


LEGEND = ('범례: ~ 바다 r 강 L 용암 x 독늪 . 초원 f 밭 p 곡식밭 v 사바나 s 사막 d 모래언덕 D 흙 b 협곡토 a 화산재 B 현무암 w 늪 m 습지 c 균열 o 분화구 '
          't 툰드라 n 설원 g 빙하 j 정글 | ^ 산 M 메사 V 화산 * 숲 = 길 / 경사로 @ 장소. 첫 줄은 x 의 10 자리, 줄 머리는 y')


def ascii_map(world):
    """칸 글자 지도. 물체가 있으면 물체 글자(^ 산, * 숲, M 메사, V 화산), 장소는 @, 길은 =, 경사로는 /."""
    G, O = world['ground'], world['object']
    rows = [[GLYPH.get(G[y][x], '?') for x in range(len(G[0]))] for y in range(len(G))]
    for y in range(len(G)):
        for x in range(len(G[0])):
            o = O[y][x]
            if o in (6, 7):
                rows[y][x] = '^'
            elif o == 9:
                rows[y][x] = 'M'
            elif o == 8:
                rows[y][x] = 'V'
            elif o:
                rows[y][x] = '*'
    for x, y in world['road_cells']:
        rows[y][x] = '='
    for x, y in world['ramp']:
        rows[y][x] = '/'
    for p in world['places']:
        for yy in range(p['y'], p['y'] + p['h']):
            for xx in range(p['x'], p['x'] + p['w']):
                rows[yy][xx] = '@'
    head = '    ' + ''.join(str(x // 10) if x % 10 == 0 else ' ' for x in range(len(G[0])))
    return '\n'.join([LEGEND, head] + ['%02d  %s' % (y, ''.join(r)) for y, r in enumerate(rows)])


def schematic(world, scale=8):
    """지형 칸 배열의 빠른 도식 그림(렌더 없이 몇 초) — 바닥 색 + 산 ▲ 숲 점 + 길 + 장소 테두리."""
    from PIL import ImageDraw
    G, O = np.array(world['ground']), np.array(world['object'])
    Hh = np.array(world['height_level'])
    h, w = G.shape
    rgb = np.zeros((h, w, 3), np.uint8)
    for g, c in SCHEMA_RGB.items():
        rgb[G == g] = c
    rgb = (rgb.astype(np.float32) * (1 - .12 * Hh[..., None])).astype(np.uint8)
    im = Image.fromarray(rgb).resize((w * scale, h * scale), Image.NEAREST)
    d = ImageDraw.Draw(im)
    for y in range(h):
        for x in range(w):
            o = O[y, x]
            cx, cy = x * scale, y * scale
            if o in (6, 7, 9, 8):
                d.polygon([(cx + scale / 2, cy + 1), (cx + scale - 1, cy + scale - 1), (cx + 1, cy + scale - 1)],
                          fill=(120, 95, 70) if o != 8 else (200, 60, 30), outline=(40, 30, 25))
            elif o:
                d.ellipse([cx + 1, cy + 1, cx + scale - 2, cy + scale - 2], fill=(30, 90, 40))
    for x, y in world['road_cells']:
        d.rectangle([x * scale + scale // 3, y * scale + scale // 3, x * scale + scale * 2 // 3, y * scale + scale * 2 // 3], fill=(150, 100, 50))
    for p in world['places']:
        d.rectangle([p['x'] * scale, p['y'] * scale, (p['x'] + p['w']) * scale - 1, (p['y'] + p['h']) * scale - 1], outline=(255, 40, 40), width=2)
    # 10칸 격자 + 숫자 — 틱만 있으면 그림으로 좌표를 못 읽었다(조수 역할 시험)
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(ov)
    for x in range(10, w, 10):
        od.line([(x * scale, 0), (x * scale, h * scale)], fill=(255, 255, 255, 70))
    for y in range(10, h, 10):
        od.line([(0, y * scale), (w * scale, y * scale)], fill=(255, 255, 255, 70))
    im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
    d = ImageDraw.Draw(im)
    for x in range(0, w, 10):
        d.text((x * scale + 2, 1), str(x), fill=(255, 255, 255), stroke_width=1, stroke_fill=(0, 0, 0))
    for y in range(10, h, 10):
        d.text((2, y * scale + 1), str(y), fill=(255, 255, 255), stroke_width=1, stroke_fill=(0, 0, 0))
    return im


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--theme', help='themes/<id> — 아이콘 세트·팔레트·지형 덧칠(포장도로·철길·시가지·그을음·우주)을 한 번에 고른다')
    ap.add_argument('--iconset', help='테마가 없으면 필수')
    ap.add_argument('--palette', help='palettes/<id> — 쉼표로 여러 개, all = palettes/ 전부. 테마가 없으면 필수')
    ap.add_argument('--journey', help='journeys/<id> — 없으면 테마의 journey(없으면 fantasy-5act)')
    ap.add_argument('--out', required=True)
    ap.add_argument('--tint-icons', type=float, default=None, help='아이콘 색을 팔레트 빛으로 옮기는 정도 0..1 (기본 0.25, 팔레트 icon_tint 가 있으면 그 값)')
    ap.add_argument('--cache', help='지형 캐시 폴더')
    ap.add_argument('--no-check', action='store_true', help='여정 도달성 검사를 건너뛴다')
    ap.add_argument('--terrain', help='terrains/<id> 또는 지형 편집 JSON 경로 — 공용 지형(shared-v9) 위에 작업(ops)을 얹는다')
    ap.add_argument('--preview', action='store_true', help='픽셀 렌더 없이 칸 배열만(몇 초): schematic.png · terrain.txt · world.json · 여정 검사')
    ap.add_argument('--fit-salt', type=int, default=None, help='생성 지형 배치 시도 번호(없으면 지형 JSON 의 fit_salt, 그것도 없으면 0). 실패하면 빌더가 스스로 다음 번호로 다시 돈다')
    ap.add_argument('--fit-start', type=int, default=None, help=argparse.SUPPRESS)
    a = ap.parse_args()
    NO_CHECK[0] = a.no_check
    if a.fit_salt is not None and a.fit_start is None:
        a.fit_start = a.fit_salt
    try:
        _main(a)
    except RetryFit as e:
        if os.environ.get('WMK_NO_RETRY'):
            print('배치 %d 실패: %s' % (a.fit_salt, e), file=sys.stderr)
            sys.exit(3)
        if a.fit_salt + 1 >= (a.fit_start or 0) + FIT_TRIES:
            print('입력 오류:\n생성 지형: 배치를 %d번 바꿔 봐도 여정이 맞지 않는다 — 마지막 이유: %s' % (FIT_TRIES, e), file=sys.stderr)
            sys.exit(2)
        print('배치 %d 실패(%s) — 다음 배치로 다시' % (a.fit_salt, str(e)[:160]))
        import subprocess
        drop = ('--fit-salt', '--fit-start')
        argv = [x for i, x in enumerate(sys.argv) if x not in drop and (i == 0 or sys.argv[i - 1] not in drop)]
        r = subprocess.run([sys.executable] + argv + ['--fit-salt', str(a.fit_salt + 1), '--fit-start', str(a.fit_start or 0)])
        sys.exit(r.returncode)


def _main(a):
    theme = None
    theme_terrain = None
    terrain = None
    try:
        if a.theme:
            import kit_theme as KT
            tp = K.WM / 'themes' / (a.theme + '.json')
            if not tp.exists():
                raise K.KitError('themes/%s.json 이 없다 (있는 것: %s)' % (a.theme, ', '.join(sorted(p.stem for p in (K.WM / 'themes').glob('*.json')))))
            try:
                theme = KT.load_theme(tp)
            except ValueError as e:
                raise K.KitError(str(e))
            a.iconset = a.iconset or theme['iconset']
            a.palette = a.palette or theme['palette']
            theme_terrain = theme.get('terrain')
        if not a.iconset or not a.palette:
            raise K.KitError('--theme 이 없으면 --iconset 과 --palette 가 필요하다')
        roles, roles_data = K.load_roles()
        a.journey = a.journey or (theme or {}).get('journey') or 'fantasy-5act'
        journey = K.load_journey(a.journey)
        import kit_terrain as KTer
        try:
            terrain = KTer.merge(KTer.load(theme_terrain, K.WM), KTer.load(a.terrain, K.WM))   # 테마 지형 위에 편집을 얹는다
            if _generated(terrain):
                if a.fit_salt is None:                   # 처음 부름: 저장된 배치 번호(맵의 worldmapSource.fitSalt)부터
                    a.fit_salt = int(terrain.get('fit_salt', 0))
                    a.fit_start = a.fit_salt
                terrain = dict(terrain, fit_salt=a.fit_salt)
            journey = KTer.apply(terrain, journey)
        except KTer.TerrainError as e:
            if _generated(terrain):
                raise RetryFit(str(e))
            raise K.KitError('지형 편집: ' + str(e))
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
        if a.preview:
            return preview(journey, roles, iconset, assign, out, a.no_check, terrain)
        t = build_terrain(journey, roles, roles_data, iconset, assign, a.cache, terrain)
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
    report = dict(theme=theme['id'] if theme else None, iconset=iconset.id, journey=journey['id'], terrain_seconds=t['seconds'], role_purity=t['purity'], palettes={})
    files = {}
    for pal in palettes:
        tint = a.tint_icons if a.tint_icons is not None else pal.get('icon_tint', 0.25)
        road_px = t['role'][np.searchsorted(t['ukeys'], KP.key_of(t['C']))] == KP.GID['road'] if theme else None
        if theme and theme['kind'] == 'space':
            img, extra = KT.render_space(KT.Ctx(world), road_px=road_px), {}
            tint = 0.0
        else:
            keep = np.zeros(t['G'].shape, bool)
            for x, y in world.get('edit_ground', []):
                keep[y, x] = True
            img, extra = KP.recolor_terrain(t['C'], t['ukeys'], t['role'], pal, t['G'], keep_cells=keep)
            if theme:
                img = KT.force_road_band(img, world, t['C'], t['ukeys'], t['role'], pal, road_px)
                img, extra['overlays'] = KT.apply_land(img, world, theme, road_px)
        final = W.paste_icons(img, ic, sky_site, iconset, assign, lambda arr: KP.tint_icon(arr, pal, tint, iconset.key, iconset.shadow_key))
        fn = ('%s-%s.png' % (theme['id'], pal['id'])) if theme else ('%s-%s.png' % (iconset.id, pal['id']))
        Image.fromarray(final).save(out / fn, optimize=True)
        files[pal['id']] = fn
        m = separation_metrics(img, t['C'], t['ukeys'], t['role'])
        im = icon_metrics(img, final, ic, sky_site)
        report['palettes'][pal['id']] = dict(file=fn, icon_tint=tint, terrain_metrics=m, icon_metrics=im, levels=extra.get('levels'), overlays=extra.get('overlays'))
        print('  %-9s -> %s (icon tint %.2f)  주요 지형 최소 쌍거리 %s %.3f · 최소 명암 단 %s %d' % (
            pal['id'], fn, tint, m['key_min_pair'][0], m['key_min_pair'][1], m['key_min_steps'][0], m['key_min_steps'][1]))
        print('            아이콘 구별(둘레와 다른 화소 비율): 최저 %s %.2f · 중앙 %.2f' % (im['min'][0], im['min'][1], im['median']))
    world.update(iconset=iconset.id, icons_used=sorted(set(assign.values())), palettes=[p['id'] for p in palettes], images=files)
    if len(palettes) == 1:
        world['palette'] = palettes[0]['id']
    world['walk'] = walk_rows(world)
    (out / 'terrain.txt').write_text(ascii_map(world) + '\n')
    (out / 'world.json').write_text(json.dumps(world, ensure_ascii=False))
    if not a.no_check:
        import kit_world as W2
        from check_journey import run_check
        jw = W2.MapWorld(world)
        bad, info, txt = run_check(journey, jw, out_path=out / 'journey-check.txt', verbose=False)
        report['journey_check'] = dict(ok=not bad, bad=KTer.explain(bad, journey))
        print('여정 검사: %s' % ('통과' if not bad else '불일치 %d건 — %s' % (len(bad), '; '.join(bad[:3]))))
    (out / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))


def preview(journey, roles, iconset, assign, out, no_check, terrain):
    """픽셀 렌더를 건너뛰고 칸 배열·길·장소만 만든다 — 지형 편집을 몇 초 만에 확인한다."""
    import kit_world as W
    t0 = time.time()
    try:
        W.install(journey, roles, iconset, assign)
        w = _make_world_gen(W, journey, terrain)
    except K.KitError as e:
        print('입력 오류:\n' + str(e), file=sys.stderr)
        sys.exit(2)
    world = W.world_dict(w, journey, assign)
    world['terrain'] = terrain['id'] if terrain else 'shared-v9'
    world['place_rules'] = KTer.place_rules(journey)
    world['edit_ground'] = _edit_ground_cells()
    _collect_warnings(world, terrain)
    world['walk'] = walk_rows(world)
    out.mkdir(parents=True, exist_ok=True)
    (out / 'world.json').write_text(json.dumps(world, ensure_ascii=False))
    (out / 'terrain.txt').write_text(ascii_map(world) + '\n')
    schematic(world).save(out / 'schematic.png')
    import make_map_v4 as M4
    report = dict(preview=True, terrain=world['terrain'], seconds=round(time.time() - t0, 1), warnings=list(world['warnings']))
    print('미리보기 %.1f초 → %s' % (report['seconds'], out / 'schematic.png'))
    if not no_check:
        from check_journey import run_check
        bad, info, txt = run_check(journey, W.MapWorld(world), out_path=out / 'journey-check.txt', verbose=False)
        report['journey_check'] = dict(ok=not bad, bad=KTer.explain(bad, journey))
        print('여정 검사: %s' % ('통과' if not bad else '불일치 %d건 — %s' % (len(bad), '; '.join(bad[:3]))))
    (out / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
