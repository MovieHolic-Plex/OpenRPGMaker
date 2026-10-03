"""조선 칩셋 게이트.  python3 harness/gate.py [--sheets]

FAIL(통과 못 하면 시트·지도 굽기 금지):
  P  팔레트: 불투명 화소가 잠긴 허용 색(palette.json) 밖
  E  외곽선: 가장자리/안쪽 밝기비가 버들항 p5 미만(어두운 바깥 링)
  T  가는 줄: 폭 1px 화소 비율이 버들항 p95 의 2배+0.02 초과(thin_ok 조각 제외)
  L  빛: 왼쪽 반이 오른쪽 반보다 어두움(버들항 p5 미만), front_only 제외
  S  그림자: 반투명 그림자 무게중심이 본체보다 위
  A  적대 리뷰: 독립 리뷰어 두 렌즈(culture 조선다움·view 3/4)가 현재 해시에 둘 다 keep 이어야 함(ADVERSARIAL.md)
  K  조립: built 조각은 blocks.house 블록 조립(pieces_meta 의 kit)이어야 함
  TR 나무: 잎 결(이웃 밝기차)이 버들항 p5×0.88 미만이거나 수관 화소가 너무 적음
  V  판정: harness/verdicts.json 에 이 조각의 현재 그림에 대한 3/4 판정 줄이 없음(그림이 바뀌면 다시 써야 함)
WARN: 결(grain) 부족, built 조각의 좌우 비대칭(0.08 초과, sym:true).
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import tk
from metrics import metrics
import catalog
import adversarial
from spacemetrics import tree_metrics
SPACE = json.load(open(os.path.join(HERE, 'space_calibration.json')))

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..'))
CAL = json.load(open(os.path.join(HERE, 'calibration.json')))['band']
META = json.load(open(os.path.join(HERE, 'pieces_meta.json')))
VERD_PATH = os.path.join(HERE, 'verdicts.json')
OBJ = os.path.join(ROOT, 'tiledata/beodeul-city/render/objects')
OUTDIR = os.path.join(ROOT, 'tiledata/joseon-demo/review')


def piece_hash(cv):
    return hashlib.sha1(cv.a.tobytes()).hexdigest()[:12]


# 사냥터·동굴 새 지형(fld_ground.py)도 눈으로 본 판정이 있어야 한다. 한 줄이어야 하네스 validate 가 시드와 대조한다.
TERRAIN_VERDICT = ('water47', 'water47g', 'water_deep', 'fld_trail32', 'fld_tall32', 'fld_forest32', 'fld_bog94', 'fld_rock32', 'fld_rock_in8', 'fld_face32', 'cav_floor', 'cav_floor_lit', 'cav_floor_sh', 'cav_roof47', 'cav_face24', 'cav_pool94')


def group_hash(tiles):
    return hashlib.sha1(b''.join(t.a.tobytes() for t in tiles)).hexdigest()[:12]


def palette_report(arr):
    op = arr[arr[:, :, 3] == 255][:, :3]
    bad = {}
    for c, k in zip(*np.unique(op.reshape(-1, 3), axis=0, return_counts=True)):
        t = tuple(int(v) for v in c)
        if t not in tk.ALLOWED:
            bad[t] = int(k)
    return bad


def run(skip_a=False):
    tk.VIOLATIONS.clear()
    objs = catalog.objects()
    terr = catalog.terrain()
    try:
        verd = json.load(open(VERD_PATH))
    except FileNotFoundError:
        verd = {}
    rows, fails, warns = [], 0, 0
    # 지형: 팔레트만
    for name, tl in terr.items():
        bad = {}
        for c in tl:
            for k, v in palette_report(c.a).items():
                bad[k] = bad.get(k, 0) + v
        why = []
        if bad: why.append('P')
        if name in TERRAIN_VERDICT:                      # 새 지형 조각은 눈으로 본 판정도 필요하다(현재 그림 해시에 묶임)
            v = verd.get(name)
            h = group_hash(tl)
            if not v or v.get('hash') != h:
                why.append('V 판정 없음' if not v else 'V 그림이 바뀜(판정 다시)')
            elif v.get('status') == 'redo':
                why.append('V 판정=다시: ' + v.get('line', ''))
        status = 'FAIL ' + ' '.join(why) if why else 'ok'
        if why: fails += 1
        rows.append((name, 'terrain', status, f'{sum(bad.values())}px/{len(bad)}색 밖' if bad else ''))
    for name, cv in objs.items():
        m = metrics(cv.a)
        meta = META.get(name, {})
        why = []
        w = []
        bad = palette_report(cv.a)
        if bad: why.append(f'P {len(bad)}색 {sum(bad.values())}px 밖')
        if m:
            if m['edge_ratio'] < CAL['edge_ratio']['p5'] and not meta.get('seam_open'):
                why.append(f"E 외곽선 밝기비 {m['edge_ratio']:.2f} < {CAL['edge_ratio']['p5']:.2f}")
            lim = CAL['thin_ratio']['p95'] * 2 + 0.02
            if m['thin_ratio'] > lim and not meta.get('thin_ok'):
                why.append(f"T 가는줄 {m['thin_ratio']:.3f} > {lim:.3f}")
            if not meta.get('front_only') and m['light_lr'] < CAL['light_lr']['p5']:
                why.append(f"L 빛 {m['light_lr']:+.2f} < {CAL['light_lr']['p5']:+.2f}")
            if m['shadow_dy'] is not None and m['shadow_dy'] < 0:
                why.append(f"S 그림자 위쪽 {m['shadow_dy']:+.1f}")
            if m['grain'] is not None and m['grain'] < CAL['grain']['p5']:
                w.append(f"결 {m['grain']:.1f} < {CAL['grain']['p5']:.1f}")
            if meta.get('sym') and m['asym'] > 0.08:
                w.append(f"비대칭 {m['asym']:.2f}")
        if meta.get('cls') in ('tree', 'bush', 'sapling', 'tuft'):
            tmx = tree_metrics(cv.a)
            tb = SPACE['tree']
            min_px = {'tree': 900, 'sapling': 350, 'bush': 300, 'tuft': 150}[meta['cls']]
            if tmx is None or tmx['px'] < min_px:
                why.append(f"TR 수관이 작다/비었다 {tmx['px'] if tmx else 0}px < {min_px}")
            elif tmx['texture'] < 0.095:
                why.append(f"TR 잎 결 {tmx['texture']:.3f} < 0.095 (버들항 p5 {tb['texture']['p5']:.3f})")
        if not skip_a:
            _ok, _why = adversarial.check(name, cv)
            if not _ok: why.append(_why)
        if meta.get('cls') == 'built' and not meta.get('kit'):
            why.append('K 건물은 블록 조립(blocks.house)이어야 함 — 통그림 금지')
        h = piece_hash(cv)
        v = verd.get(name)
        if not v or v.get('hash') != h:
            why.append('V 판정 없음' if not v else 'V 그림이 바뀜(판정 다시)')
        elif v.get('status') == 'redo':
            why.append('V 판정=다시: ' + v.get('line', ''))
        elif v.get('status') == 'user':
            w.append('사용자 판정 대기(윗면 안 보이는 정면 소품)')
        status = 'FAIL ' + '; '.join(why) if why else ('WARN ' + '; '.join(w) if w else 'ok')
        if why: fails += 1
        elif w: warns += 1
        rows.append((name, meta.get('cls', '?'), status, '' if not m else
                     f"edge {m['edge_ratio']:.2f} lr {m['light_lr']:+.2f} thin {m['thin_ratio']:.3f} grain {m['grain'] if m['grain'] is None else round(m['grain'],1)} asym {m['asym']:.2f}"))
    return rows, fails, warns, objs


def ref_image(name, idx=0):
    items = json.load(open(os.path.join(ROOT, 'tiledata/beodeul-city/render/city6_objects.json')))
    hs, seen = [], set()
    for it in sorted([i for i in items if i['name'] == name], key=lambda i: -(i['w'] * i['h'])):
        if it['hash'] not in seen:
            seen.add(it['hash']); hs.append(it['hash'])
    if not hs:
        return None
    return Image.open(os.path.join(OBJ, hs[min(idx, len(hs) - 1)] + '.png')).convert('RGBA')


def sheets(objs):
    """조각마다 [내 조각 | 버들항 기준 조각 ×3] 을 같은 배율(3배)로. 한 장씩 만들어 눈으로 본다."""
    os.makedirs(OUTDIR, exist_ok=True)
    out = []
    for name, cv in objs.items():
        refs = META[name]['refs']
        ims = [('JOSEON ' + name, cv.img())]
        used = {}
        for r in refs:
            k = used.get(r, 0); used[r] = k + 1
            im = ref_image(r, k)
            if im: ims.append((r, im))
        sc = 3
        H = max(i.height for _, i in ims) * sc + 18
        W = sum(i.width * sc + 12 for _, i in ims) + 12
        sheet = Image.new('RGBA', (W, H), (88, 160, 53, 255))
        d = ImageDraw.Draw(sheet)
        x = 12
        for label, im in ims:
            big = im.resize((im.width * sc, im.height * sc), Image.NEAREST)
            sheet.alpha_composite(big, (x, H - big.height))
            d.text((x, 2), label, fill=(255, 255, 255, 255))
            x += big.width + 12
        p = os.path.join(OUTDIR, name + '.png')
        sheet.convert('RGB').save(p)
        out.append(p)
    return out


def water_sheet(terr):
    """물 47종 검수 시트: 변형 0 의 47칸(4배, 번호 순) + 작은 강·연못 견본 + 옛 4방향 stream16 비교."""
    import water_blob as WB
    os.makedirs(OUTDIR, exist_ok=True)
    sc, cols = 4, 12
    tl = terr['water47']
    old = terr['stream16']
    rows = (47 + cols - 1) // cols
    cw = cols * 16 * sc
    scene = [  # 견본: 곧은 강 + 굴곡 + 연못(1 = 물)
        '..........................', '..#####.....###...........', '..#####....#####..........', '...####....#####..####....',
        '...####.....###..######...', '..#####.........########..', '.######.........########..', '.######..........######...',
        '..#####...........###.....', '..........................']
    cells = {(x, y) for y, r in enumerate(scene) for x, ch in enumerate(r) if ch == '#'}
    SW, SH = len(scene[0]), len(scene)
    scn = tk.Cv(SW * 16, SH * 16)
    for y in range(SH):
        for x in range(SW):
            if (x, y) in cells:
                m = 0
                for bit, (dx, dy) in ((WB.N, (0, -1)), (WB.E, (1, 0)), (WB.S, (0, 1)), (WB.W, (-1, 0)), (WB.NE, (1, -1)), (WB.SE, (1, 1)), (WB.SW, (-1, 1)), (WB.NW, (-1, -1))):
                    if (x + dx, y + dy) in cells: m |= bit
                scn.paste(tl[WB.index47(m) + 47 * ((x + y) % 2)], x * 16, y * 16)
            else:
                import ground as G
                scn.paste(G.grass(tk.hsh(x, y, 3) % 4), x * 16, y * 16)
    W = max(cw, SW * 16 * 3 + 16 * 4 * 4 * 4 + 40) + 24
    H = rows * 16 * sc + 20 + SH * 16 * 3 + 20
    sheet = Image.new('RGBA', (W, H), (88, 160, 53, 255))
    d = ImageDraw.Draw(sheet)
    d.text((4, 2), 'WATER47 variant0 (index = canon(mask8) order)   |   old stream16 at right', fill=(255, 255, 255, 255))
    for i in range(47):
        sheet.alpha_composite(tl[i].img().resize((16 * sc, 16 * sc), Image.NEAREST), ((i % cols) * 16 * sc + 4, 16 + (i // cols) * 16 * sc))
    y0 = 16 + rows * 16 * sc + 4
    d.text((4, y0), 'scene x3', fill=(255, 255, 255, 255))
    sheet.alpha_composite(scn.img().resize((SW * 16 * 3, SH * 16 * 3), Image.NEAREST), (4, y0 + 14))
    for i in range(16):
        sheet.alpha_composite(old[i].img().resize((16 * 3, 16 * 3), Image.NEAREST), (SW * 16 * 3 + 20 + (i % 4) * 48, y0 + 14 + (i // 4) * 48))
    p = os.path.join(OUTDIR, 'water47.png')
    sheet.convert('RGB').save(p)
    return p


if __name__ == '__main__':
    rows, fails, warns, objs = run()
    w = max(len(r[0]) for r in rows)
    for n, c, st, info in rows:
        print(f'{n:{w}s} {c:8s} {st}' + (f'   [{info}]' if info else ''))
    print(f'\nFAIL {fails} / WARN {warns} / 전체 {len(rows)}')
    if '--sheets' in sys.argv:
        print('\n'.join(sheets(objs)))
        print(water_sheet(catalog.terrain()))
    sys.exit(1 if fails else 0)
