"""building-kit 자체 점검 — 후보 키 하나(한 벌)의 관문·조립을 돌리고 미리보기 PNG 를 쓴다.

저장소:  python3 harness.py dry <테마> <판> <후보> [--module <판 모듈 경로>] [--out <미리보기 폴더>]
샌드박스: 같은 폴더의 dry.json(테마·판·후보·모듈·미리보기 폴더·하네스 경로·데이터 폴더)을 읽어 `python3 dry.py`.

--module 을 주면 **그 모듈**을 불러 검사한다 — 그리기 에이전트는 샌드박스의 round_module.py 를 검사해야 한다.
미리보기: preview/<항목>.png(4배) · preview/<건물>.png(3배, 버들항 잔디 위) ·
preview/compare.png(조립 건물과 버들항 기준 건물을 같은 배율로 나란히). FAIL 코드를 찍고 종료코드 1.
"""
import argparse
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

def config():
    path = os.path.join(HERE, 'dry.json')
    if not os.path.exists(path):
        return {}
    with open(path, encoding='utf-8') as f:
        return json.load(f)

CFG = config()
HARNESS = os.environ.get('BUILDING_KIT_HARNESS') or CFG.get('harness') or HERE
sys.path.insert(0, HERE)
if HARNESS != HERE and HARNESS not in sys.path:
    sys.path.insert(1, HARNESS)

from PIL import Image, ImageDraw  # noqa: E402

import assemble as AS  # noqa: E402
import beodeul  # noqa: E402
import dot  # noqa: E402
import gate as G  # noqa: E402

ITEM_SCALE = 4
BUILDING_SCALE = 3
COMPARE_SCALE = 3
LABEL = (240, 236, 220, 255)

if CFG.get('data'):
    dot.DATA = CFG['data']
    dot._PAL.clear()

def load_module(path):
    path = os.path.abspath(path)
    name = 'bk_dry_' + re.sub(r'\W', '_', os.path.splitext(os.path.basename(path))[0])
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

def render(mod, item_ids, key):
    out = {}
    for item_id in item_ids:
        fn = (mod.CANDIDATES.get(item_id) or {}).get(key)
        if fn is None:
            continue
        cv, meta = fn()
        out[item_id] = (cv.img(), meta or {})
    return out

def line_refs(theme, line):
    s = dot.seed(theme)
    origin = ((s.get('lines') or {}).get(line) or {}).get('origin') or {}
    rd = s.get('rounds', {}).get(origin.get('round'))
    if not rd:
        return []
    path = os.path.join(dot.REPO, rd['module'])
    if not os.path.exists(path):
        return []
    try:
        rendered = render(load_module(path), [it['id'] for it in s['items']], origin.get('key'))
    except Exception:  # noqa: BLE001 — 기준 판이 아직 없으면 재료 검사만 건너뛴다
        return []
    return [im for im, _ in rendered.values()]

def peers(mod, item_id, key, own):
    out = {key: own}
    for k, fn in (mod.CANDIDATES.get(item_id) or {}).items():
        if k == key:
            continue
        try:
            cv, _ = fn()
        except Exception:  # noqa: BLE001 — 아직 안 그린 후보
            continue
        out[k] = cv.img()
    return out

def check(theme, rid, key, mod, rendered):
    s = dot.seed(theme)
    items = {it['id']: it for it in s['items']}
    pal = dot.palette(theme)
    style = s['rounds'][rid].get('wave') == 'style'
    res = {}
    for item_id, (im, meta) in rendered.items():
        it = items[item_id]
        rs = G.check_item(it, im, pal, meta)
        if not style and key:
            refs = line_refs(theme, key[0])
            if refs:
                rs.append(G.check_line_material(im, refs, it.get('extraRamps', []), pal))
        cands = peers(mod, item_id, key, im)
        if len(cands) > 1:
            r = G.check_recolor(cands).get(key)
            if r:
                rs.append(r)
        for pc in it['pieces']:
            if pc.get('kind') != 'extra':
                continue
            crop = im.crop((pc['at'][0] * dot.T, pc['at'][1] * dot.T,
                            (pc['at'][0] + pc['size'][0]) * dot.T, (pc['at'][1] + pc['size'][1]) * dot.T))
            r = G.check_contrast(crop, dot.Cv.of(Image.new('RGBA', (dot.T, dot.T), dot.C(theme, 'grass', 3) + (255,))),
                                 pc['size'][0] * pc['size'][1])
            if r:
                r['msg'] = f'{pc["id"]} ' + r['msg']
                rs.append(r)
        res[item_id] = rs
    return res

def parts_for(theme, rendered):
    items = {it['id']: it for it in dot.seed(theme)['items']}
    return {item_id: {'item': items[item_id], 'img': im} for item_id, (im, _) in rendered.items()}

def needed(recipe):
    return AS.needed(recipe)

def assemble_all(theme, parts, rid=None):
    rows = []
    for recipe in harness_round_buildings(theme, rid):
        missing = sorted(needed(recipe) - set(parts))
        res = None if missing else AS.assemble(recipe, parts, dot.palette(theme), theme)
        rows.append({'recipe': recipe, 'res': res, 'missing': missing, 'fails': AS.run_checks(res) if res else []})
    return rows

def harness_round_buildings(theme, rid):
    s = dot.seed(theme)
    ids = ((s.get('rounds') or {}).get(rid or '') or {}).get('buildings')
    if not ids:
        return s['buildings']
    by = {b['id']: b for b in s['buildings']}
    return [by[i] for i in ids if i in by]

def _scene(cols, rows, theme, ground_line):
    scene = beodeul.ground_scene(cols, rows, theme, 'grass')
    return scene, ground_line * dot.T

def preview_item(im, out, item_id):
    im.resize((im.width * ITEM_SCALE, im.height * ITEM_SCALE), Image.NEAREST).save(
        os.path.join(out, f'{item_id}.png'))

def preview_building(im, out, theme, bid, scale=BUILDING_SCALE):
    pad = 2
    cols = im.width // dot.T + pad * 2
    rows = im.height // dot.T + pad
    scene = beodeul.ground_scene(cols, rows, theme, 'grass')
    scene.paste(dot.Cv.of(im), pad * dot.T, (rows - 1) * dot.T - im.height)
    scene.img().resize((scene.w * scale, scene.h * scale), Image.NEAREST).save(
        os.path.join(out, f'{bid}.png'))

def preview_compare(theme, assembled, out, scale=COMPARE_SCALE):
    refs = []
    for ref in dot.seed(theme).get('refs', []):
        try:
            refs.append((ref['kit'], beodeul.kit(ref['kit']).img()))
        except SystemExit:
            continue
    tiles = [(bid, im, 'candidate') for bid, im in assembled] + [(kid, im, 'beodeul') for kid, im in refs]
    if not tiles:
        return None
    gap = 1
    cols = sum(im.width // dot.T for _, im, _ in tiles) + gap * (len(tiles) + 2) + 1
    rows = max(im.height // dot.T for _, im, _ in tiles) + 4
    scene = beodeul.ground_scene(cols, rows, theme, 'grass')
    base = (rows - 2) * dot.T
    x = gap
    labels = []
    for i, (name, im, kind) in enumerate(tiles):
        if i == len(assembled):
            scene.a[:, x * dot.T - 1:x * dot.T + 1] = dot.C(theme, 'cobble', 1) + (255,)
            x += 1
        scene.paste(dot.Cv.of(im), x * dot.T, base - im.height)
        chars = max(4, (im.width + dot.T) // 6)
        labels.append((x, f'{"new" if kind == "candidate" else "ref"}:{name}'[:chars]))
        x += im.width // dot.T + gap
    img = scene.img()
    draw = ImageDraw.Draw(img)
    for lx, text in labels:
        draw.text((lx * dot.T, 2), text, fill=LABEL)
    img.resize((img.width * scale, img.height * scale), Image.NEAREST).save(os.path.join(out, 'compare.png'))
    return len(assembled)

def _fails(rs):
    return [r for r in rs if r['level'] == 'FAIL' and not r['ok']]

def run(theme, rid, key, module=None, out=None, quiet=False):
    s = dot.seed(theme)
    rd = s['rounds'][rid]
    path = module or os.path.join(dot.REPO, rd['module'])
    if not os.path.exists(path):
        raise SystemExit(f'{theme} {rid}: 판 모듈이 없다 — {path}')
    mod = load_module(path)
    rendered = render(mod, rd['items'], key)
    if not rendered:
        raise SystemExit(f'{theme} {rid}: 모듈 {path} 에 후보 {key} 함수가 없다')
    res = check(theme, rid, key, mod, rendered)
    out = out or os.path.join(dot.RUNS, theme, rid, 'preview', key)
    os.makedirs(out, exist_ok=True)
    bad_total = 0
    if not quiet:
        print(f'{theme} {rid} 후보 {key} — {os.path.relpath(path, dot.REPO) if path.startswith(dot.REPO) else path}')
    for item_id, (im, _) in rendered.items():
        bad = [r for r in res[item_id] if not r['ok']]
        bad_total += len([r for r in bad if r['level'] == 'FAIL'])
        if not quiet:
            print(f'{item_id:20} {key:3} {dot.image_hash(im)[:8]}  '
                  + ('통과' if not bad else ' · '.join(f'{r["level"]} {r["code"]}: {r["msg"]}' for r in bad)))
        preview_item(im, out, item_id)
    parts = parts_for(theme, rendered)
    rows = assemble_all(theme, parts, rid)
    assembled = []
    if not quiet:
        print('조립:')
    for row in rows:
        recipe = row['recipe']
        if row['missing']:
            if not quiet:
                print(f'  {recipe["id"]:18} 건너뜀 — 이번 판 밖 부품 {", ".join(row["missing"])}')
            continue
        bad_total += len(row['fails'])
        if row['res']['img'] is not None:
            assembled.append((recipe['id'], row['res']['img'].img()))
            preview_building(row['res']['img'].img(), out, theme, recipe['id'])
        if not quiet:
            state = '통과' if not row['fails'] else ' · '.join(f'{c["code"]} {c["msg"]}' for c in row['fails'])
            print(f'  {recipe["id"]:18} {row["res"]["width"]}×{row["res"]["height"]}칸  {state}')
    preview_compare(theme, assembled, out)
    if not quiet:
        print(f'미리보기 → {out}/ (항목 {ITEM_SCALE}배 · 건물 {BUILDING_SCALE}배 잔디 위 · compare.png 조립 vs 버들항)')
        print(f'FAIL {bad_total}' + (' — 고칠 것: ' + str(bad_total) if bad_total else ' — 기계 관문·조립 통과(합격 아님)'))
    return 1 if bad_total else 0

def main(argv=None):
    ap = argparse.ArgumentParser(prog='dry.py')
    ap.add_argument('--theme', default=CFG.get('theme'))
    ap.add_argument('--round', default=CFG.get('round'))
    ap.add_argument('--key', default=CFG.get('key'))
    ap.add_argument('--module', default=CFG.get('module'))
    ap.add_argument('--out', default=CFG.get('out'))
    a = ap.parse_args(argv)
    if not (a.theme and a.round and a.key):
        ap.error('테마·판·후보가 없다 — 같은 폴더에 dry.json 을 두거나 --theme/--round/--key 를 준다')
    return run(a.theme, a.round, a.key, a.module, a.out)

if __name__ == '__main__':
    sys.exit(main())
