"""building-kit 하네스 본체. `npm run harness -- building-kit <단계>` 또는 `python3 src/harnesses/building-kit/harness.py <단계>`.

  palette <테마> [--check]        테마 잠금 팔레트를 다시 뽑는다(--check 는 비교만)
  validate [<테마>]               테마 seed·팔레트·부품 세트·조립 레시피·판 모듈·기준 그림 점검
  list <테마>                     부품 세트·조립 레시피. 줄마다 ★ = 사람이 고른 것(현재 그림과 해시가 맞을 때) · - = 뺀 항목
  draw <테마> <판> [--agent] [--lines A,B,C] [--jobs N]  후보 키마다(화풍 판 = 줄, 이후 판 = <줄><번호>) 그 벌 전체를 그리고 판 모듈로 옮긴다
  dry <테마> <판> <후보> [--module <판 모듈>] [--out <폴더>]  후보 한 벌의 관문·조립 + preview/ PNG(자체 점검 입구)
  gate <테마> <판>                draw + 기계 관문(P Z Q F S J G Y R / WARN OUTLINE CONTRAST T L N). FAIL 이면 종료코드 1
  assemble <테마> <판> [--line A] [--key A1]   부품을 레시피대로 조립하고 조립 관문 A1~A6
  review <테마> <판> [--runs 3]   독립 Opus 검수(숨긴 함정·무효 회차·다수결·영수증)
  sheet <테마> <판>               검수 PASS 후보만 ~/claude-viz/bk-<테마>-<판>.html 자체완결 시트
  pick <테마> <판> <항목> <후보> --sha <앞 8자리>   사람이 고른 후보를 그림 해시에 묶어 기록
  reject <테마> <판> <항목> <후보> --why …          사람이 버린 후보와 이유
  objgate <테마>                  사람이 고른 부품으로 조립한 건물의 3/4 관문(object-gate kind structure) 영수증
  status [<테마>]                 판·관문·검수·시트·고른 것·3/4 영수증 현황

줄(line) — 테마마다 화풍이 셋이다(seed lines A·B·C). style-r1 의 후보 글자 A·B·C 가 곧 줄이고, 이후 판은 후보 키가
<줄><번호>(A1 A2 B1 …)다. 고르기 단위는 (항목, 줄). 고른 그림은 picked/<줄>/<항목>.png.

감독·에이전트는 pick/reject 를 스스로 부르지 않는다. 사람이 시트에서 고른 후보와 시트에 적힌 해시 앞자리를 받아 적을 때만 쓴다.
기계 관문 통과는 합격이 아니다 — 판정은 독립 검수(review)와 사람이 한다.
"""
import argparse
import datetime
import importlib.util
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

import assemble as AS  # noqa: E402
import beodeul  # noqa: E402
import dot  # noqa: E402
import gate as G  # noqa: E402

REPO = dot.REPO
POLISH_CODES = ('OUTLINE', 'CONTRAST')


def now():
    return datetime.datetime.now().isoformat(timespec='seconds')


def themes():
    if not os.path.isdir(dot.DATA):
        return []
    return sorted(t for t in os.listdir(dot.DATA) if os.path.exists(os.path.join(dot.DATA, t, 'seed.json')))


def seed(theme):
    return dot.seed(theme)


def items_by_id(theme):
    return {it['id']: it for it in seed(theme)['items']}


def lines(theme):
    return {k: v for k, v in seed(theme).get('lines', {}).items() if isinstance(v, dict)}


def line_of(theme, key):
    if key and key[0] in lines(theme) and (len(key) == 1 or key[1:].isdigit()):
        return key[0]
    return None


def ledger(theme):
    path = os.path.join(dot.theme_dir(theme), 'ledger.json')
    if os.path.exists(path):
        return json.load(open(path, encoding='utf-8'))
    return {'picks': [], 'rejects': [], 'runs': [], 'reviews': [], 'assemblies': []}


def save_ledger(theme, L):
    path = os.path.join(dot.theme_dir(theme), 'ledger.json')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(L, f, ensure_ascii=False, indent=1)
        f.write('\n')


def picked_path(theme, line, item):
    return os.path.join(dot.theme_dir(theme), 'picked', line, f'{item}.png')


def load_round(theme, rid):
    s = seed(theme)
    if rid not in s.get('rounds', {}):
        raise SystemExit(f'{theme}: 모르는 판 {rid}. 시드 rounds: {", ".join(s.get("rounds", {})) or "없음"}')
    path = os.path.join(REPO, s['rounds'][rid]['module'])
    if not os.path.exists(path):
        raise SystemExit(f'{theme} {rid}: 판 모듈이 아직 없다({s["rounds"][rid]["module"]}) — draw --agent 로 그린다')
    name = f'bk_{theme.replace("-", "_")}_{rid.replace("-", "_")}'
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.path.insert(0, os.path.dirname(path))
    spec.loader.exec_module(mod)
    return mod


def render_round(theme, rid):
    mod = load_round(theme, rid)
    out = {}
    for item, cands in mod.CANDIDATES.items():
        out[item] = {}
        for key, fn in cands.items():
            cv, meta = fn()
            out[item][key] = (cv.img(), meta or {})
    return mod, out


def line_style(theme, line):
    o = lines(theme)[line].get('origin')
    if not o:
        return {}
    _, rendered = render_round(theme, o['round'])
    return {item: c[o['key']][0] for item, c in rendered.items() if o['key'] in c}


def ground(theme, line):
    """CONTRAST 의 줄 대표 바닥 = 공유 grass 램프 몸통(버들항 잔디)."""
    return dot.Cv.of(Image.new('RGBA', (dot.T, dot.T), dot.C(theme, 'grass', 3) + (255,)))


def check_candidate(theme, rid, item, key, im, meta, pal):
    rs = G.check_item(item, im, pal, meta)
    if seed(theme)['rounds'][rid].get('wave') != 'style':
        line = line_of(theme, key)
        if line and line in lines(theme):
            refs = [v for v in line_style(theme, line).values()]
            if refs:
                rs.append(G.check_line_material(im, refs, item.get('extraRamps', []), pal))
    ct = []
    for pc in item['pieces']:
        if pc.get('kind') != 'extra':
            continue
        crop = im.crop((pc['at'][0] * dot.T, pc['at'][1] * dot.T,
                        (pc['at'][0] + pc['size'][0]) * dot.T, (pc['at'][1] + pc['size'][1]) * dot.T))
        r = G.check_contrast(crop, ground(theme, line_of(theme, key)), pc['size'][0] * pc['size'][1])
        if r:
            r['msg'] = f'{pc["id"]} ' + r['msg']
            ct.append(r)
    rs += ct
    return rs


def run_gate(theme, rid, rendered):
    items = items_by_id(theme)
    pal = dot.palette(theme)
    res = {}
    for item, cands in rendered.items():
        if item not in items:
            raise SystemExit(f'{theme} {rid}: 판의 항목 {item} 이 시드에 없다')
        rc = G.check_recolor({k: im for k, (im, _) in cands.items()})
        res[item] = {}
        for key, (im, meta) in cands.items():
            res[item][key] = check_candidate(theme, rid, items[item], key, im, meta, pal) + [rc[key]]
    return res


def gate_summary(res):
    fails = [(i, k, r) for i, c in res.items() for k, rs in c.items() for r in rs if r['level'] == 'FAIL' and not r['ok']]
    warns = [(i, k, r) for i, c in res.items() for k, rs in c.items() for r in rs if r['level'] == 'WARN' and not r['ok']]
    return fails, warns


def cmd_palette(theme, check):
    return subprocess.run([sys.executable, os.path.join(HERE, 'palette.py'), '--theme', theme] + (['--check'] if check else [])).returncode


def cmd_draw(theme, rid, agent=False, lines_=None, jobs=1, cmd=None, quiet=False):
    if agent:
        import drawer
        return drawer.run(theme, rid, lines_, jobs, cmd)
    mod, rendered = render_round(theme, rid)
    base = os.path.join(dot.RUNS, theme, rid)
    man = {'theme': theme, 'round': rid, 'wave': getattr(mod, 'WAVE', None), 'at': now(), 'items': {}}
    for item, cands in rendered.items():
        d = os.path.join(base, item)
        os.makedirs(d, exist_ok=True)
        man['items'][item] = {}
        for key, (im, meta) in cands.items():
            im.save(os.path.join(d, f'{key}.png'))
            im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(d, f'{key}-x4.png'))
            man['items'][item][key] = {'sha256': dot.image_hash(im), 'size': [im.width, im.height],
                                       'line': line_of(theme, key), 'note': meta.get('note', '')}
    os.makedirs(base, exist_ok=True)
    json.dump(man, open(os.path.join(base, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if not quiet:
        n = sum(len(v) for v in man['items'].values())
        print(f'{theme} {rid}: 항목 {len(man["items"])} · 후보 {n} → {os.path.relpath(base, REPO)}/')
    return 0


def parts_for(theme, rid, key, rendered):
    items = items_by_id(theme)
    out = {}
    for item, cands in rendered.items():
        if key in cands:
            out[item] = {'item': items[item], 'img': cands[key][0]}
    return out


def round_buildings(theme, rid=None):
    """그 판이 조립하는 레시피 목록 — rounds.<판>.buildings 가 있으면 그것만, 없으면 시드 전체(옛 판)."""
    s = seed(theme)
    ids = (s.get('rounds', {}).get(rid or '', {}) or {}).get('buildings')
    if not ids:
        return s['buildings']
    by = {b['id']: b for b in s['buildings']}
    return [by[i] for i in ids if i in by]

def assemble_all(theme, parts, only=None, quiet=False, rid=None):
    out = []
    for recipe in round_buildings(theme, rid):
        if only and recipe['id'] != only:
            continue
        res = AS.assemble(recipe, parts, dot.palette(theme), theme)
        fails = AS.run_checks(res)
        out.append({'recipe': recipe, 'res': res, 'fails': fails})
        if not quiet:
            state = '통과' if not fails else ' · '.join(f'{c["code"]} {c["msg"]}' for c in fails)
            print(f'  조립 {recipe["id"]:18} {recipe.get("title", "")} {res["width"]}×{res["height"]}칸  {state}')
    return out


def cmd_gate(theme, rid, quiet=False):
    mod, rendered = render_round(theme, rid)
    cmd_draw(theme, rid, quiet=True)
    res = run_gate(theme, rid, rendered)
    fails, warns = gate_summary(res)
    if not quiet:
        for item, c in res.items():
            for key, rs in c.items():
                bad = [r for r in rs if not r['ok']]
                print(f'{item:20} {key:3}  ' + ('통과' if not bad else ' · '.join(f'{r["level"]} {r["code"]}: {r["msg"]}' for r in bad)))
        print(f'관문: FAIL {len(fails)} · WARN {len(warns)} — 통과는 합격이 아니다(독립 검수와 사람이 본다)')
    L = ledger(theme)
    by_code = {}
    for _, _, r in warns:
        by_code[r['code']] = by_code.get(r['code'], 0) + 1
    L['runs'].append({'theme': theme, 'round': rid, 'at': now(), 'fail': len(fails), 'warn': len(warns), 'warnByCode': by_code,
                      'hashes': {i: {k: dot.image_hash(im) for k, (im, _) in c.items()} for i, c in rendered.items()}})
    L['runs'] = L['runs'][-60:]
    save_ledger(theme, L)
    return rendered, res, fails


def cmd_dry(theme, rid, key, quiet=False, module=None, out=None):
    import dry
    return dry.run(theme, rid, key, module, out, quiet)


def resolve_parts(theme, rid, line, key=None):
    """조립에 쓸 부품: key 가 있으면 그 판 후보, 없으면 사람이 고른 picked/<줄>/<항목>.png (해시 확인)."""
    items = items_by_id(theme)
    if key:
        _, rendered = render_round(theme, rid)
        return parts_for(theme, rid, key, rendered)
    ps = pick_state(theme)
    out = {}
    for item in items:
        p = ps.get((item, line))
        if p and p[1] == 'current':
            out[item] = {'item': items[item], 'img': Image.open(picked_path(theme, line, item)).convert('RGBA')}
    return out


def cmd_assemble(theme, rid, line='A', key=None, quiet=False):
    key = key or line
    parts = resolve_parts(theme, rid, line, key if key else None)
    if not parts:
        raise SystemExit(f'{theme}: 조립할 부품이 없다 — 먼저 그려서 사람이 고르거나 --key 로 판 후보를 지정한다')
    rows = assemble_all(theme, parts, quiet=quiet, rid=rid)
    fails = [f for r in rows for f in r['fails']]
    base = os.path.join(dot.RUNS, theme, rid, 'buildings')
    os.makedirs(base, exist_ok=True)
    for r in rows:
        if r['res']['img'] is None:
            continue
        im = r['res']['img'].img()
        im.save(os.path.join(base, f'{r["recipe"]["id"]}.png'))
        im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(os.path.join(base, f'{r["recipe"]["id"]}-x3.png'))
        json.dump(r['res']['kit'], open(os.path.join(base, f'{r["recipe"]["id"]}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    L = ledger(theme)
    L['assemblies'].append({'theme': theme, 'round': rid, 'line': line, 'key': key, 'at': now(),
                            'fails': len(fails), 'buildings': [r['recipe']['id'] for r in rows]})
    L['assemblies'] = L['assemblies'][-40:]
    save_ledger(theme, L)
    if not quiet:
        print(f'조립 {len(rows)}채 · FAIL {len(fails)} → {os.path.relpath(base, REPO)}/')
    return rows, fails


def cmd_validate(theme):
    errs, notes = [], []
    s = seed(theme)
    pal = None
    try:
        pal = dot.palette(theme)
    except SystemExit as e:
        errs.append(f'palette.json: {e}')
    for k in ('harness', 'theme', 'family', 'rules', 'palette', 'lines', 'items', 'buildings', 'rounds'):
        if k not in s:
            errs.append(f'seed: {k} 없음')
    if s.get('harness') != 'building-kit':
        errs.append('seed harness 는 building-kit 이어야 한다')
    if s.get('family') != 'oprn-atlas':
        errs.append('계열은 버들항과 같은 oprn-atlas 여야 한다')
    rules = s.get('rules', {})
    for k in ('tile', 'family', 'view', 'outline', 'paletteLock', 'door', 'forbidden'):
        if k not in rules:
            errs.append(f'rules: {k} 없음')
    if rules.get('tile') != dot.T:
        errs.append(f'rules.tile 은 {dot.T} 여야 한다')
    if rules.get('family') != 'oprn-atlas':
        errs.append('rules.family 는 oprn-atlas 여야 한다')

    ids = set()
    for it in s.get('items', []):
        for k in ('id', 'wave', 'title', 'size', 'pieces', 'brief', 'accept'):
            if k not in it:
                errs.append(f'{it.get("id")}: {k} 없음')
        if it.get('id') in ids:
            errs.append(f'{it["id"]} 중복')
        ids.add(it.get('id'))
        pids = set()
        for pc in it.get('pieces', []):
            for k in ('id', 'at', 'size', 'kind'):
                if k not in pc:
                    errs.append(f'{it["id"]}.{pc.get("id")}: {k} 없음')
            if pc.get('id') in pids:
                errs.append(f'{it["id"]}: 조각 {pc["id"]} 중복')
            pids.add(pc.get('id'))
            if pc.get('kind') not in ('roof', 'wall', 'band', 'base', 'extra'):
                errs.append(f'{it["id"]}.{pc.get("id")}: 모르는 kind {pc.get("kind")}')
            at, sz = pc.get('at', [0, 0]), pc.get('size', [0, 0])
            if at[0] + sz[0] > it['size'][0] or at[1] + sz[1] > it['size'][1]:
                errs.append(f'{it["id"]}.{pc["id"]}: 조각이 세트 그림({it["size"]}) 밖으로 나간다')
            if pc.get('tileable') not in (None, '', 'x'):
                errs.append(f'{it["id"]}.{pc["id"]}: tileable 은 "" 또는 "x"')
        for j in it.get('joins', []):
            if len(j) != 3 or j[2] not in ('x', 'y'):
                errs.append(f'{it["id"]}: joins {j} 는 [a,b,"x"|"y"]')
            elif j[0] not in pids or j[1] not in pids:
                errs.append(f'{it["id"]}: joins {j} 의 조각이 없다')
        if it.get('wave') in ('roof', 'band', 'base'):
            need = {'roof': ('l', 'm', 'r'), 'band': ('l', 'm', 'r'), 'base': ('l', 'm', 'r')}[it['wave']]
            have = {pc.get('role') for pc in it.get('pieces', [])}
            if not set(need) <= have:
                errs.append(f'{it["id"]}: {it["wave"]} 세트에 role {sorted(set(need) - have)} 가 없다')
        if it.get('wave') == 'wall':
            have = {pc.get('role') for pc in it.get('pieces', [])}
            if not {'l', 'm', 'd', 'r'} <= have:
                errs.append(f'{it["id"]}: wall 세트에 role {sorted({"l", "m", "d", "r"} - have)} 가 없다')
        if it.get('wave') == 'roof':
            for why in AS.roof_problems(it):
                errs.append(f'{it["id"]}: {why}')

    for ln, info in lines(theme).items():
        if len(ln) != 1 or not ln.isupper():
            errs.append(f'줄 id {ln!r} 는 대문자 한 글자여야 한다(후보 키 <줄><번호> 의 앞 글자)')
        for k in ('name', 'concept', 'origin'):
            if k not in info:
                errs.append(f'줄 {ln}: {k} 없음')
        o = info.get('origin', {})
        if o.get('round') not in s.get('rounds', {}) and o.get('round') not in s.get('plan', {}):
            errs.append(f'줄 {ln}: origin.round {o.get("round")} 가 rounds 에도 plan 에도 없다')
        for item, why in info.get('skip', {}).items():
            if item not in ids:
                errs.append(f'줄 {ln} skip: 모르는 항목 {item}')
            if not why:
                errs.append(f'줄 {ln} skip {item}: 이유가 비었다')
    if len(lines(theme)) < 3:
        notes.append(f'줄 {len(lines(theme))}개 — style-r1 은 셋(A·B·C)을 권한다')

    for b in s.get('buildings', []):
        bid = b.get('id')
        for k in ('id', 'title', 'use'):
            if k not in b:
                errs.append(f'건물 {bid}: {k} 없음')
        ms = AS.masses(b)
        if len(ms) > 1 and not b.get('masses'):
            errs.append(f'건물 {bid}: 질량이 여럿인데 masses 로 적지 않았다')
        for m in ms:
            tag = f'건물 {bid} 질량 {m["id"]}'
            for k in ('cols', 'storeys', 'roof'):
                if not m.get(k):
                    errs.append(f'{tag}: {k} 없음')
            if m.get('cols') and int(m['cols']) < AS.MIN_COLS:
                errs.append(f'{tag}: cols {m["cols"]} < {AS.MIN_COLS} — 모임지붕 끝 l·r 이 2칸씩이다')
            for k in ('roof', 'band', 'base'):
                if m.get(k) and m[k] not in ids:
                    errs.append(f'{tag}: 부품 {m[k]} 가 items 에 없다')
            if len(m['walls']) != int(m.get('storeys') or 0):
                errs.append(f'{tag}: walls 는 층마다 하나({m.get("storeys")}개)')
            for i, row in enumerate(m['walls']):
                if row.get('item') and row['item'] not in ids:
                    errs.append(f'{tag} {i}층: 벽 부품 {row["item"]} 가 items 에 없다')
                letters = row['letters'].replace(' ', '')
                if m.get('cols') and len(letters) != int(m['cols']):
                    errs.append(f'{tag} {i}층: "{letters}" 길이 {len(letters)} ≠ cols {m["cols"]}')
                if set(letters) - set('LMWDR'):
                    errs.append(f'{tag} {i}층: 모르는 글자 {sorted(set(letters) - set("LMWDR"))}')
            rows_ = [r['letters'].replace(' ', '') for r in m['walls']]
            if rows_ and 'D' in ''.join(rows_[:-1]):
                errs.append(f'{tag}: 문은 맨 아래 층에 있어야 한다')
            for ex in m.get('extras') or []:
                if ex.get('part') not in ids:
                    errs.append(f'{tag}: extra {ex.get("part")} 가 items 에 없다')
        doors = sum(r['letters'].replace(' ', '').count('D') for m in ms for r in m['walls'])
        if doors != 1 and not b.get('doorTwice'):
            errs.append(f'건물 {bid}: 문 {doors}개 — 건물 하나(질량 전부)에 문은 정확히 하나')
        for why in AS.mass_problems(ms):
            errs.append(f'건물 {bid}: {why}')
        if len(ms) > 1 and not any(int(m.get('depth') or 0) == 0 for m in ms):
            errs.append(f'건물 {bid}: 앞줄(depth 0) 질량이 없다 — 질량마다 depth 를 적는다')
        if any('base' in m and m['base'] for m in ms) and not b.get('masses'):
            errs.append(f'건물 {bid}: base 는 선택 부품이다 — 기단이 필요 없으면 빼고 벽 맨 아래 1~3px 을 기단으로 그린다')
    kit_ids = {k['id'] for k in beodeul.tileset()['structureKits']}
    for ref in s.get('refs', []):
        if ref.get('kit') not in kit_ids:
            errs.append(f'기준 그림 {ref.get("kit")} 가 버들항 structureKits 에 없다')
    if not s.get('rounds') and not s.get('plan'):
        errs.append('rounds 도 plan 도 없다 — 첫 판을 적는다')

    for rid, rd in s.get('rounds', {}).items():
        if rd.get('superseded'):
            notes.append(f'판 {rid}: superseded by {rd["superseded"]} — 옛 문법(3칸 지붕·전폭 기단 행)으로 그린 판이다. '
                         f'gate/dry/assemble·시트 대상이 아니다')
            continue
        for bid in rd.get('buildings') or []:
            if bid not in {b['id'] for b in s.get('buildings', [])}:
                errs.append(f'판 {rid}: buildings 의 {bid} 레시피가 시드에 없다')
        path = os.path.join(REPO, rd.get('module', ''))
        if not os.path.exists(path):
            notes.append(f'판 {rid}: 모듈이 아직 없다({rd.get("module")}) — 그리기 전')
            continue
        try:
            mod = load_round(theme, rid)
        except Exception as e:  # noqa: BLE001
            errs.append(f'판 {rid} 모듈 오류: {e}')
            continue
        style = rd.get('wave') == 'style'
        for item in rd.get('items', []):
            if item not in ids:
                errs.append(f'판 {rid}: 항목 {item} 이 시드에 없다')
                continue
            if item not in mod.CANDIDATES:
                errs.append(f'판 {rid}: 모듈에 {item} 후보가 없다')
                continue
            for key in mod.CANDIDATES[item]:
                ln = line_of(theme, key)
                if not ln or (style and key != ln) or (not style and key == ln):
                    errs.append(f'판 {rid} {item}: 후보 키 {key} — 화풍 판은 줄 글자, 이후 판은 <줄><번호>')
                elif lines(theme).get(ln, {}).get('skip', {}).get(item):
                    errs.append(f'판 {rid} {item}: 줄 {ln} 에서 뺀 항목인데 후보 {key} 가 있다')
        for item in mod.CANDIDATES:
            if item not in rd.get('items', []):
                errs.append(f'판 {rid}: 모듈 후보 {item} 이 시드 rounds.{rid}.items 에 없다')
        src = open(path, encoding='utf-8').read()
        if re.search(r"['\"]#[0-9a-fA-F]{6}['\"]", src):
            errs.append(f'판 {rid}: 후보 코드에 hex 색이 있다(팔레트 램프만 쓴다)')

    if not os.path.exists(beodeul.SHEET):
        errs.append(f'버들항 공용 시트가 없다: {beodeul.SHEET}')
    if not os.path.exists(beodeul.ACTOR):
        errs.append('Actor1 이 없다')
    if os.path.exists(os.path.join(dot.theme_dir(theme), 'palette.json')):
        r = subprocess.run([sys.executable, os.path.join(HERE, 'palette.py'), '--theme', theme, '--check'], capture_output=True, text=True)
        if r.returncode:
            errs.append('palette.json: ' + r.stdout.strip())
    for e in errs:
        print('✗', e)
    for n in notes:
        print('·', n)
    print(f'{theme}: 시드·팔레트·부품·조립·판 점검 ' + ('통과' if not errs else f'{len(errs)}건 실패') + (f' (안내 {len(notes)})' if notes else ''))
    return 1 if errs else 0


def pick_state(theme):
    out = {}
    cache = {}
    for p in ledger(theme)['picks']:
        rid = p['round']
        try:
            if rid not in cache:
                cache[rid] = render_round(theme, rid)[1]
            c = cache[rid].get(p['item'], {}).get(p['key'])
            cur = dot.image_hash(c[0]) if c else None
        except SystemExit:
            cur = None
        f = picked_path(theme, p['line'], p['item'])
        fh = dot.image_hash(Image.open(f)) if os.path.exists(f) else None
        if cur != p['sha256']:
            out[(p['item'], p['line'])] = (p, 'VOID — 판 코드의 그림이 고른 뒤 바뀌었다')
        elif fh != p['sha256']:
            out[(p['item'], p['line'])] = (p, 'VOID — picked/ 파일이 고른 그림과 다르다')
        else:
            out[(p['item'], p['line'])] = (p, 'current')
    return out


def current_hash(theme, rid, item, key):
    mod = load_round(theme, rid)
    if item not in mod.CANDIDATES or key not in mod.CANDIDATES[item]:
        return None, None
    cv, _ = mod.CANDIDATES[item][key]()
    im = cv.img()
    return dot.image_hash(im), im


def cmd_pick(theme, rid, item, key, sha, note, by='user'):
    if by != 'user':
        raise SystemExit('pick 은 사람만 한다 — --by 는 user 만 받는다(감독·에이전트 대리 선택 경로 없음)')
    ln = line_of(theme, key)
    if not ln:
        raise SystemExit(f'후보 {key} 의 줄을 모른다 — 시드 lines: {", ".join(lines(theme))} (화풍 판은 글자, 이후 판은 <줄><번호>)')
    man_p = os.path.join(dot.RUNS, theme, rid, 'manifest.json')
    if not os.path.exists(man_p):
        raise SystemExit(f'{theme} {rid} 의 manifest 가 없다 — sheet {theme} {rid} 를 먼저(사람이 본 시트가 있어야 고를 수 있다)')
    man = json.load(open(man_p, encoding='utf-8'))
    if item not in man['items'] or key not in man['items'][item]:
        raise SystemExit(f'{theme} {rid} 에 {item} {key} 후보가 없다')
    shown = man['items'][item][key]['sha256']
    if not sha or not shown.startswith(sha):
        raise SystemExit(f'--sha 가 시트에 보인 해시({shown[:8]})와 다르다 — 사람이 본 그림의 해시 앞자리를 그대로 받는다')
    cur, im = current_hash(theme, rid, item, key)
    if cur != shown:
        raise SystemExit(f'시트 이후 그림이 바뀌었다(시트 {shown[:12]} ≠ 현재 {str(cur)[:12]}). sheet {theme} {rid} 를 다시 만들어 다시 보여야 한다')
    out = picked_path(theme, ln, item)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)
    L = ledger(theme)
    L['picks'] = [p for p in L['picks'] if not (p['item'] == item and p['line'] == ln)] + [
        {'round': rid, 'item': item, 'line': ln, 'key': key, 'sha256': cur, 'note': note, 'at': now(), 'by': 'user'}]
    save_ledger(theme, L)
    print(f'고름 기록: {item} 줄 {ln} ← {theme} {rid} {key} ({cur[:12]}) → {os.path.relpath(out, REPO)}')


def cmd_reject(theme, rid, item, key, why, by='user'):
    if by != 'user':
        raise SystemExit('reject 은 사람만 한다 — --by 는 user 만 받는다')
    if not why:
        raise SystemExit('--why 가 필요하다(다음 판의 「하지 말 것」이 된다)')
    ln = line_of(theme, key)
    if not ln:
        raise SystemExit(f'후보 {key} 의 줄을 모른다 — 시드 lines: {", ".join(lines(theme))}')
    cur, _ = current_hash(theme, rid, item, key)
    if cur is None:
        raise SystemExit(f'{theme} {rid} 에 {item} {key} 후보가 없다')
    L = ledger(theme)
    L['rejects'].append({'round': rid, 'item': item, 'line': ln, 'key': key, 'sha256': cur, 'why': why, 'at': now(), 'by': 'user'})
    save_ledger(theme, L)
    print(f'버림 기록: {theme} {rid} {item} {key}(줄 {ln}) ({cur[:8]}) — {why}')


def cmd_objgate(theme):
    import object_gate
    ps = pick_state(theme)
    if not ps:
        print(f'{theme}: 사람이 고른 부품이 없다 — pick 뒤에 objgate')
        return 1
    lines_ = sorted({line for (_, line), (p, st) in ps.items() if st == 'current'})
    rows = []
    for line in lines_:
        parts = resolve_parts(theme, None, line, None)
        if not parts:
            continue
        for r in assemble_all(theme, parts, quiet=True):
            if r['res']['img'] is None:
                rows.append((line, r['recipe']['id'], '조립 실패', False))
                continue
            try:
                h = object_gate.require_pass(r['res']['img'].img(), kind='structure', context='bundle',
                                             label=f'building-kit/{theme}/{line}/{r["recipe"]["id"]}')
                rows.append((line, r['recipe']['id'], h[:12], True))
            except object_gate.ObjectGateRefused as e:
                rows.append((line, r['recipe']['id'], str(e)[:160], False))
    ok = sum(1 for *_, good in rows if good)
    for line, bid, msg, good in rows:
        print(f'  {"PASS" if good else "미통과"} 줄 {line} {bid:18} {msg}')
    print(f'{theme}: 3/4 관문 영수증 {ok}/{len(rows)} — 없으면 「3/4 관문 미통과」다(번들·스토어에 넣지 않는다)')
    return 0 if ok == len(rows) and rows else 1


def cmd_sheet(theme, rid, show_failed=False):
    import sheet
    return sheet.write(theme, rid, show_failed)


def cmd_review(theme, rid, runs=3, judge_cmd=None):
    import review
    return review.run(theme, rid, runs, judge_cmd)


def cmd_list(theme):
    ps = pick_state(theme)
    print(f'{theme} — {seed(theme)["theme"]["name"]} · 계열 {seed(theme)["family"]}')
    for it in seed(theme)['items']:
        marks = ' '.join(('★' if (it['id'], ln) in ps and ps[(it['id'], ln)][1] == 'current'
                          else '-' if lines(theme).get(ln, {}).get('skip', {}).get(it['id']) else '·') + ln
                         for ln in lines(theme))
        roles = '/'.join(pc.get('role', '?') for pc in it['pieces'])
        print(f'{marks}  {it["wave"]:6} {it["id"]:20} {it["size"][0]}×{it["size"][1]} {it["kind"] if "kind" in it else "":8} {it["title"]}  [{roles}]')
    print('조립 레시피:')
    for b in seed(theme)['buildings']:
        ms = AS.masses(b)
        shape = ' + '.join(f'{m["id"]} {m["cols"]}칸 {m["storeys"]}층 x{m["x"]} d{m["depth"]}' for m in ms)
        base = ' + 기단' if any(m.get('base') for m in ms) else ''
        print(f'  {b["id"]:18} {shape}{base}  ({b["use"]})')


def cmd_status(theme=None):
    for t in ([theme] if theme else themes()):
        s = seed(t)
        L = ledger(t)
        ps = pick_state(t)
        print(f'{t} — {s["theme"]["name"]}')
        for rid in s.get('rounds', {}):
            runs = [r for r in L['runs'] if r['round'] == rid]
            last = runs[-1] if runs else None
            rev = [r for r in L['reviews'] if r.get('round') == rid]
            print(f'  판 {rid}: 그림 {"있음" if os.path.exists(os.path.join(dot.RUNS, t, rid, "manifest.json")) else "없음"}'
                  + (f' · 마지막 관문 {last["at"]} FAIL {last["fail"]} WARN {last["warn"]}' if last else ' · 관문 기록 없음')
                  + (f' · 검수 {rev[-1]["valid"]}/{rev[-1]["need"]} 유효 ({rev[-1]["at"]})' if rev else ' · 검수 없음')
                  + f' · 시트 {"있음" if os.path.exists(os.path.join(dot.VIZ, f"bk-{t}-{rid}.html")) else "없음"}')
        got = [p for (item, line), (p, st) in ps.items() if st == 'current']
        print(f'  고른 부품 {len(got)}/{len(s["items"]) * len(lines(t))} · 버림 기록 {len(L["rejects"])}건')
        for (item, line), (p, st) in sorted(ps.items()):
            print(f'    {item:20} 줄 {line} {p["round"]:10} {p["key"]:3} {p["sha256"][:8]}  {st}')
        builds = os.path.join(dot.RUNS, t, 'buildings')
        print(f'  3/4 관문: objgate 기록 {sum(1 for a in L["assemblies"] if a.get("objgate"))}건 — 영수증 확인은 objgate {t}')
    return 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog='building-kit')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('palette')
    p.add_argument('theme')
    p.add_argument('--check', action='store_true')
    p = sub.add_parser('validate')
    p.add_argument('theme', nargs='?')
    p = sub.add_parser('list')
    p.add_argument('theme')
    p = sub.add_parser('draw')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('--agent', action='store_true')
    p.add_argument('--lines')
    p.add_argument('--jobs', type=int, default=1)
    p.add_argument('--cmd', dest='agent_cmd')  # dest 'cmd' would overwrite the subcommand name
    p = sub.add_parser('dry')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('key')
    p.add_argument('--module')
    p.add_argument('--out')
    for c in ('gate',):
        q = sub.add_parser(c)
        q.add_argument('theme')
        q.add_argument('round')
    p = sub.add_parser('assemble')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('--line', default='A')
    p.add_argument('--key')
    p = sub.add_parser('review')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('--runs', type=int, default=3)
    p.add_argument('--judge-cmd')
    p = sub.add_parser('sheet')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('--show-failed', action='store_true')
    p = sub.add_parser('pick')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('item')
    p.add_argument('key')
    p.add_argument('--sha', required=True)
    p.add_argument('--note', default='')
    p.add_argument('--by', default='user')
    p = sub.add_parser('reject')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('item')
    p.add_argument('key')
    p.add_argument('--why', default='')
    p.add_argument('--by', default='user')
    p = sub.add_parser('objgate')
    p.add_argument('theme')
    p = sub.add_parser('status')
    p.add_argument('theme', nargs='?')
    a = ap.parse_args(argv)
    if a.cmd == 'palette':
        return cmd_palette(a.theme, a.check)
    if a.cmd == 'validate':
        targets = [a.theme] if a.theme else themes()
        rc = 0
        for t in targets:
            rc |= cmd_validate(t)
        return rc
    if a.cmd == 'list':
        cmd_list(a.theme)
        return 0
    if a.cmd == 'draw':
        return cmd_draw(a.theme, a.round, a.agent, (a.lines or '').split(',') if a.lines else None, a.jobs, a.agent_cmd)
    if a.cmd == 'dry':
        return cmd_dry(a.theme, a.round, a.key, module=a.module, out=a.out)
    if a.cmd == 'gate':
        _, _, fails = cmd_gate(a.theme, a.round)
        return 1 if fails else 0
    if a.cmd == 'assemble':
        _, fails = cmd_assemble(a.theme, a.round, a.line, a.key)
        return 1 if fails else 0
    if a.cmd == 'review':
        return cmd_review(a.theme, a.round, a.runs, a.judge_cmd)
    if a.cmd == 'sheet':
        return cmd_sheet(a.theme, a.round, a.show_failed)
    if a.cmd == 'pick':
        cmd_pick(a.theme, a.round, a.item, a.key, a.sha, a.note, a.by)
        return 0
    if a.cmd == 'reject':
        cmd_reject(a.theme, a.round, a.item, a.key, a.why, a.by)
        return 0
    if a.cmd == 'objgate':
        return cmd_objgate(a.theme)
    if a.cmd == 'status':
        return cmd_status(a.theme)
    return 2


if __name__ == '__main__':
    sys.exit(main())
