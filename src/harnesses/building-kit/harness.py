"""building-kit 하네스 본체. `npm run harness -- building-kit <단계>` 또는 `python3 src/harnesses/building-kit/harness.py <단계>`.

  palette <테마> [--check]        테마 잠금 팔레트를 다시 뽑는다(--check 는 비교만)
  validate [<테마>]               테마 seed·팔레트·부품 세트·조립 레시피·판 모듈·기준 그림 점검
  list <테마>                     부품 세트·조립 레시피. 줄마다 ★ = 사람이 고른 것(현재 그림과 해시가 맞을 때) · - = 뺀 항목
  draw <테마> <판> [--agent] [--lines A,B,C] [--jobs N]  후보 키마다(화풍 판 = 줄, 이후 판 = <줄><번호>) 그 벌 전체를 그리고 판 모듈로 옮긴다
  dry <테마> <판> <후보> [--module <판 모듈>] [--out <폴더>]  후보 한 벌의 관문·조립 + preview/ PNG(자체 점검 입구)
  gate <테마> <판>                draw + 기계 관문(P Z Q F S J G Y R / WARN OUTLINE CONTRAST T L N). FAIL 이면 종료코드 1
  assemble <테마> <판> [--line A] [--key A1]   부품을 레시피대로 조립하고 조립 관문 A1~A11
  finish <테마> <판> --line A [--building id] [--jobs N]   조립 관문을 통과한 건물마다 Opus 5.5 high 가 손 마감(finish.py)
  review <테마> <판> [--runs 3] [--finished]   독립 Opus 검수(숨긴 함정·무효 회차·다수결·영수증). --finished 는 마감 그림
  sheet <테마> <판> [--finished]  검수 PASS 후보만 ~/claude-viz/bk-<테마>-<판>[-finished].html 자체완결 시트
  village <테마> <판> --line A [--seed N] [--size 52x40] [--all] [--finished]  그 줄의 조립(또는 마감) 건물을 마을로 놓는다
  pick <테마> <판> <항목> <후보> --sha <앞 8자리>   사람이 고른 후보를 그림 해시에 묶어 기록
  pick <테마> <판> <건물> <후보> --sha <앞 8자리> --finished   사람이 고른 마감 건물을 마감 그림 해시에 묶어 기록
  reject <테마> <판> <항목> <후보> --why …          사람이 버린 후보와 이유
  objgate <테마>                  사람이 고른 부품으로 조립한 건물의 3/4 관문(object-gate kind structure) 영수증
  status [<테마>]                 판·관문·검수·시트·고른 것·3/4 영수증 현황
  projection [--out <폴더>]       박공 정면 투영 안내도(회색) projection-*.png — 그리기 샌드박스 refs/ 에도 들어간다

reuseParts — 시드 판에 `reuseParts: "<판>"` 을 적으면 (항목, 후보 키)마다 이 판 모듈에 없는 함수를 그 판 모듈의 같은 항목 id 함수로
채운다(round_module). 옛 판 그림으로 새 레시피를 조립하고, 다시 그릴 항목만 그린다. 해시·관문·검수는 그린 그림과 같다.

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


def round_module(theme, rid):
    """그 판의 후보 함수 모음. 시드 판에 `reuseParts: "<판>"` 이 있으면 (항목, 후보 키)마다 이 판 모듈의 함수가 있으면
    그것을, 없으면 그 판 모듈의 같은 항목 id·키 함수를 쓴다(다시 그리지 않고 옛 부품을 새 레시피로 조립).
    이 판의 items 에 없는 항목은 가져오지 않는다. 반환 객체: CANDIDATES · WAVE · REUSED {항목: {키: 원본 판}}.
    그림은 그대로 그려지므로 해시·관문·검수는 이 판 그림과 똑같이 다룬다."""
    s = seed(theme)
    rd = (s.get('rounds') or {}).get(rid)
    reuse = (rd or {}).get('reuseParts')
    if not reuse:
        return load_round(theme, rid)
    if reuse == rid or reuse not in s['rounds']:
        raise SystemExit(f'{theme} {rid}: reuseParts {reuse!r} 가 다른 판 id 가 아니다')
    own = load_round(theme, rid) if os.path.exists(os.path.join(REPO, rd['module'])) else None
    base = round_module(theme, reuse)
    cands, reused = {}, {}
    for item in rd.get('items', []):
        mine = dict((own.CANDIDATES.get(item) or {}) if own else {})
        theirs = base.CANDIDATES.get(item) or {}
        src = dict(getattr(base, 'REUSED', {}).get(item) or {})
        for key, fn in theirs.items():
            if key not in mine:
                mine[key] = fn
                reused.setdefault(item, {})[key] = src.get(key, reuse)
        if mine:
            cands[item] = mine
    import types
    return types.SimpleNamespace(CANDIDATES=cands, WAVE=getattr(own, 'WAVE', None) or getattr(base, 'WAVE', None),
                                 REUSED=reused, OWN=own, reuse=reuse)


def render_round(theme, rid):
    mod = round_module(theme, rid)
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
    return AS.round_buildings(theme, rid)

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
    items = {it['id']: it for it in s.get('items', [])}
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
            if pc.get('kind') not in ('roof', 'wall', 'band', 'base', 'extra', 'slope', 'roofend', 'gable'):
                errs.append(f'{it["id"]}.{pc.get("id")}: 모르는 kind {pc.get("kind")}')
            at, sz = pc.get('at', [0, 0]), pc.get('size', [0, 0])
            if at[0] + sz[0] > it['size'][0] or at[1] + sz[1] > it['size'][1]:
                errs.append(f'{it["id"]}.{pc["id"]}: 조각이 세트 그림({it["size"]}) 밖으로 나간다')
            if pc.get('tileable') not in (None, '', 'x', 'y', 'xy'):
                errs.append(f'{it["id"]}.{pc["id"]}: tileable 은 "" · "x" · "y" · "xy"')
        for j in it.get('joins', []):
            if len(j) != 3 or j[2] not in ('x', 'y'):
                errs.append(f'{it["id"]}: joins {j} 는 [a,b,"x"|"y"]')
            elif j[0] not in pids or j[1] not in pids:
                errs.append(f'{it["id"]}: joins {j} 의 조각이 없다')
        if it.get('wave') in ('roof', 'band', 'base') and not it.get('form'):
            need = {'roof': ('l', 'm', 'r'), 'band': ('l', 'm', 'r'), 'base': ('l', 'm', 'r')}[it['wave']]
            have = {pc.get('role') for pc in it.get('pieces', [])}
            if not set(need) <= have:
                errs.append(f'{it["id"]}: {it["wave"]} 세트에 role {sorted(set(need) - have)} 가 없다')
        if it.get('wave') == 'wall':
            have = {pc.get('role') for pc in it.get('pieces', [])}
            if not {'l', 'm', 'd', 'r'} <= have:
                errs.append(f'{it["id"]}: wall 세트에 role {sorted({"l", "m", "d", "r"} - have)} 가 없다')
        if it.get('wave') == 'gable' and not it.get('form'):
            errs.append(f'{it["id"]}: gable 세트는 form(gable_front) 을 적는다')
        if it.get('wave') in ('roof', 'gable'):
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

    depth_bids = {bid for rd in s.get('rounds', {}).values() if rd.get('grammar') == AS.DEPTH_GRAMMAR
                  for bid in rd.get('buildings') or []}
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
            spire = bool((items.get(m.get('roof')) or {}).get('spire'))
            if m['kind'] not in AS.KINDS:
                errs.append(f'{tag}: 모르는 kind {m["kind"]} ({"·".join(AS.KINDS)})')
            elif m['kind'] in AS.RECEDING:
                errs += _receding_problems(tag, m, items)
            elif spire:
                if int(m.get('cols') or 0) not in (1, 2):
                    errs.append(f'{tag}: 첨탑 질량 폭 {m["cols"]}칸 — 탑은 1~2칸')
            elif m.get('cols') and int(m['cols']) < AS.MIN_COLS:
                errs.append(f'{tag}: cols {m["cols"]} < {AS.MIN_COLS} — 모임지붕 끝 l·r 이 2칸씩이다')
            for k in ('roof', 'band', 'base', 'gable', 'back'):
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
                if ex.get('on') not in (None, 'roof'):
                    errs.append(f'{tag}: extra on {ex.get("on")!r} — "roof" 만 안다')
        doors = sum(r['letters'].replace(' ', '').count('D') for m in ms for r in m['walls'])
        if doors != 1 and not b.get('doorTwice'):
            errs.append(f'건물 {bid}: 문 {doors}개 — 건물 하나(질량 전부)에 문은 정확히 하나')
        for why in ([] if bid in depth_bids else AS.mass_problems(ms)):  # 깊이 땅 판 건물은 _depth_round 가 본다
            errs.append(f'건물 {bid}: {why}')
        if len(ms) > 1 and not any(int(m.get('depth') or 0) == 0 for m in ms):
            errs.append(f'건물 {bid}: 앞줄(depth 0) 질량이 없다 — 질량마다 depth 를 적는다')
        if any('base' in m and m['base'] for m in ms) and not b.get('masses'):
            errs.append(f'건물 {bid}: base 는 선택 부품이다 — 기단이 필요 없으면 빼고 벽 맨 아래 1~3px 을 기단으로 그린다')
    kit_ids = {k['id'] for k in beodeul.tileset()['structureKits']}
    ref_names = set()
    for ref in s.get('refs', []):
        if bool(ref.get('kit')) == bool(ref.get('file')):
            errs.append(f'기준 그림 {ref}: kit 이나 file 중 하나만 적는다')
            continue
        if ref.get('kit') and ref['kit'] not in kit_ids:
            errs.append(f'기준 그림 {ref.get("kit")} 가 버들항 structureKits 에 없다')
        if ref.get('file'):
            try:
                beodeul.ref_image(ref)
            except SystemExit as e:
                errs.append(str(e))
        name = beodeul.ref_name(ref)
        if name in ref_names:
            errs.append(f'기준 그림 이름 {name} 중복 — file 참조는 id 를 적는다(refs/<이름>-1x.png)')
        ref_names.add(name)
    if not s.get('rounds') and not s.get('plan'):
        errs.append('rounds 도 plan 도 없다 — 첫 판을 적는다')

    for rid, rd in s.get('rounds', {}).items():
        if rd.get('superseded'):
            if rd['superseded'] not in s.get('rounds', {}):
                errs.append(f'판 {rid}: superseded 대상 {rd["superseded"]} 가 rounds 에 없다')
            why = rd.get('supersededWhy') or '옛 문법(3칸 지붕·전폭 기단 행)으로 그린 판이다'
            held = superseded_records(theme, rid)
            notes.append(f'판 {rid}: superseded by {rd["superseded"]} — {why}. gate/dry/assemble·시트 대상이 아니다'
                         + (f'. 원장의 이 판 해시 기록 {held} 건은 옛 판 기록이다(지금 팔레트·줄로 다시 그리면 해시가 달라질 수 있고, '
                            f'실패로 세지 않는다)' if held else ''))
            continue
        for bid in rd.get('buildings') or []:
            if bid not in {b['id'] for b in s.get('buildings', [])}:
                errs.append(f'판 {rid}: buildings 의 {bid} 레시피가 시드에 없다')
        if rd.get('grammar') in ('r4', 'r5', AS.DEPTH_GRAMMAR):
            errs += _r4_grammar(s, items, rid)
        if rd.get('requireGableFront'):
            errs += _gable_front_round(s, items, rid)
        if rd.get('grammar') == AS.DEPTH_GRAMMAR:
            errs += _depth_round(s, items, rid)
        reuse = rd.get('reuseParts')
        if reuse and (reuse == rid or reuse not in s.get('rounds', {})):
            errs.append(f'판 {rid}: reuseParts {reuse!r} 가 다른 판 id 가 아니다')
            continue
        path = os.path.join(REPO, rd.get('module', ''))
        if not os.path.exists(path) and not reuse:
            notes.append(f'판 {rid}: 모듈이 아직 없다({rd.get("module")}) — 그리기 전')
            continue
        try:
            mod = round_module(theme, rid)
        except (Exception, SystemExit) as e:  # noqa: BLE001
            if reuse:
                notes.append(f'판 {rid}: reuseParts {reuse} 를 아직 불러올 수 없다({e}) — 그 판을 먼저 그린다')
            else:
                errs.append(f'판 {rid} 모듈 오류: {e}')
            continue
        style = rd.get('wave') == 'style'
        if reuse:
            n = sum(len(v) for v in getattr(mod, 'REUSED', {}).values())
            notes.append(f'판 {rid}: reuseParts {reuse} — 후보 함수 {n}개를 그 판에서 가져온다'
                         + ('' if os.path.exists(path) else ' (이 판 모듈은 아직 없다)'))
        for item in rd.get('items', []):
            if item not in ids:
                errs.append(f'판 {rid}: 항목 {item} 이 시드에 없다')
                continue
            if item not in mod.CANDIDATES:
                if reuse:
                    notes.append(f'판 {rid}: {item} 은 {reuse} 에 없어 이 판에서 그려야 한다(다시 그릴 것)')
                else:
                    errs.append(f'판 {rid}: 모듈에 {item} 후보가 없다')
                continue
            for key in mod.CANDIDATES[item]:
                ln = line_of(theme, key)
                if not ln or (style and key != ln) or (not style and key == ln):
                    errs.append(f'판 {rid} {item}: 후보 키 {key} — 화풍 판은 줄 글자, 이후 판은 <줄><번호>')
                elif lines(theme).get(ln, {}).get('skip', {}).get(item):
                    errs.append(f'판 {rid} {item}: 줄 {ln} 에서 뺀 항목인데 후보 {key} 가 있다')
        own = getattr(mod, 'OWN', mod) if reuse else mod
        for item in (own.CANDIDATES if own is not None else {}):
            if item not in rd.get('items', []):
                errs.append(f'판 {rid}: 모듈 후보 {item} 이 시드 rounds.{rid}.items 에 없다')
        if not os.path.exists(path):
            continue
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


def _finish_status(theme, rid):
    d = os.path.join(dot.RUNS, theme, rid, 'finished')
    if not os.path.isdir(d):
        return ''
    recs = [json.load(open(os.path.join(d, f), encoding='utf-8')) for f in os.listdir(d)
            if f.endswith('.json') and f != 'sheet.json']
    return f' · 마감 검사 통과 {sum(1 for r in recs if r.get("pass"))}/{len(recs)}' if recs else ''


def superseded_records(theme, rid):
    """원장에서 이 판의 그림 해시에 묶인 기록 수(고름·버림·관문 해시·시트). superseded 판은 안내로만 센다."""
    L = ledger(theme)
    n = sum(1 for k in ('picks', 'rejects') for r in L.get(k, []) if r.get('round') == rid)
    n += sum(sum(len(v) for v in (r.get('hashes') or {}).values()) for r in L.get('runs', []) if r.get('round') == rid)
    n += sum(1 for r in L.get('sheets', []) if r.get('round') == rid)
    return n


def _r4_grammar(s, items, rid):
    """style-r4 문법 — 1층 지붕 2행·2층 3행, 모임지붕 몸통 5칸 이상, 첨탑 탑은 1~2칸에 용마루보다 1칸 이상 높다."""
    errs = []
    by = {b['id']: b for b in s.get('buildings', [])}
    for bid in (next(r for r in s['rounds'] if r == rid) and s['rounds'][rid].get('buildings')) or []:
        recipe = by.get(bid)
        if not recipe:
            continue
        ms = AS.masses(recipe)
        for m in ms:
            it = items.get(m['roof'])
            if not it or it.get('spire') or m['kind'] != AS.RIDGE_SIDE:
                continue
            rows = it['pieces'][0]['size'][1]
            want = 2 if int(m['storeys']) == 1 else 3
            if rows != want:
                errs.append(f'판 {rid} {bid}/{m["id"]}: {m["storeys"]}층 지붕 {rows}행 — {want}행이어야 한다')
            if int(it.get('end', AS.ROOF_END)) == AS.ROOF_END and int(m['cols']) < 5:
                errs.append(f'판 {rid} {bid}/{m["id"]}: 모임지붕 몸통 {m["cols"]}칸 — 용마루가 남으려면 5칸 이상')
        spires = [m for m in ms if (items.get(m['roof']) or {}).get('spire')]
        plain = [m for m in ms if not (items.get(m['roof']) or {}).get('spire')]
        try:
            [AS.mass_rows(m, items) for m in ms]
        except KeyError:
            continue  # 조각 계약 오류는 _receding_problems 가 따로 적는다
        if spires and plain:
            lift = (lambda m: int(m.get('depth') or 0)) if s['rounds'][rid].get('grammar') == AS.DEPTH_GRAMMAR \
                else (lambda m: 0)
            main = max(plain, key=lambda m: int(m['cols']) * int(m['storeys']))
            main_h = AS.mass_rows(main, items) + lift(main)
            for sp in spires:
                if AS.mass_rows(sp, items) + lift(sp) - main_h < 1:
                    errs.append(f'판 {rid} {bid}/{sp["id"]}: 첨탑 탑이 주 지붕 용마루보다 1칸 이상 높아야 한다')
    return errs


def _depth_round(s, items, rid):
    """깊이 땅 문법(grammar r7) 레시피 계약(부품 그림 없이): 질량이 화면에서 이어지고, 박공 정면은 폭 4~6·
    depth_rows 2~3, 문은 가장 앞 질량, 외쪽은 옆 질량보다 낮고, 더 뒤 질량 앞 박공 날개의 뒤 끝은 (뒤 박공이면) 뒤 질량
    처마보다 낮게 벽 앞에 서거나 (골이면) 뒤 질량 지붕 안에서 끝난다(A13 예측)."""
    errs = []
    by = {b['id']: b for b in s.get('buildings', [])}
    for bid in s['rounds'][rid].get('buildings') or []:
        recipe = by.get(bid)
        if not recipe:
            continue
        ms = AS.masses(recipe)
        tag = f'판 {rid} {bid}'
        try:
            rows = {m['id']: AS.mass_rows(m, items) for m in ms}
            roof = {m['id']: AS.roof_rows(m, items) for m in ms}
        except KeyError as e:
            errs.append(f'{tag}: 조각 계약 오류 {e}')
            continue
        errs += [f'{tag}: {why}' for why in AS.mass_problems(ms, rows)]
        for m in ms:
            if m['kind'] in AS.RECEDING:
                (c0, c1), (d0, d1) = AS.receding_limits(m['kind'], True)
                if not c0 <= m['cols'] <= c1:
                    errs.append(f'{tag}/{m["id"]}: {m["kind"]} 폭 {m["cols"]}칸 — 깊이 땅 문법은 {c0}~{c1}칸')
                if not d0 <= int(m.get('depth_rows') or 0) <= d1:
                    errs.append(f'{tag}/{m["id"]}: depth_rows {m.get("depth_rows")} — 깊이 땅 문법은 {d0}~{d1}(짧은 지붕)')
        front = min(m['depth'] for m in ms)
        for m in ms:
            if any('D' in r['letters'] for r in m['walls']) and m['depth'] != front:
                errs.append(f'{tag}: 문이 {m["id"]}(depth {m["depth"]}) — 가장 앞 질량(depth {front})에 둔다')
        tallest = max(int(m['storeys']) for m in ms)
        for m in ms:
            if m['kind'] == AS.LEAN_TO and int(m['storeys']) >= tallest:
                errs.append(f'{tag}/{m["id"]}: 외쪽 {m["storeys"]}층 — 붙는 본 질량({tallest}층)보다 낮아야 한다(처마 아래)')
        for w in ms:
            if w['kind'] != AS.GABLE_FRONT:
                continue
            top = w['depth'] + rows[w['id']]
            for b in ms:
                if b['depth'] <= w['depth'] or min(w['x'] + w['cols'], b['x'] + b['cols']) <= max(w['x'], b['x']):
                    continue
                eave = b['depth'] + rows[b['id']] - roof[b['id']]
                btop = b['depth'] + rows[b['id']]
                if w.get('back_end') == 'valley' and not eave < top <= btop:
                    errs.append(f'{tag}/{w["id"]}: 골 날개 꼭대기(땅에서 {top}칸)가 {b["id"]} 지붕(처마 {eave}~용마루 {btop}) 안에 없다')
                if w.get('back_end') != 'valley' and top >= eave:
                    errs.append(f'{tag}/{w["id"]}: 뒤 박공 꼭대기(땅에서 {top}칸)가 {b["id"]} 처마({eave}칸)에 닿거나 넘는다 — '
                                f'{b["id"]} depth 를 {top - (rows[b["id"]] - roof[b["id"]]) + 1} 이상으로 물리거나 골(valley)을 쓴다')
    return errs


def _receding_problems(tag, m, items):
    """박공 정면·외쪽 질량 레시피 계약(부품 그림 없이)."""
    errs = []
    kind = m['kind']
    lo, hi = AS.GF_COLS if kind == AS.GABLE_FRONT else AS.LEAN_COLS
    if not lo <= int(m['cols']) <= hi:
        errs.append(f'{tag}: {kind} 폭 {m["cols"]}칸 — {lo}~{hi}칸')
    d0, d1 = AS.DEPTH_ROWS
    if not d0 <= int(m.get('depth_rows') or 0) <= d1:
        errs.append(f'{tag}: depth_rows {m.get("depth_rows")} — {d0}~{d1}')
    slope = items.get(m.get('roof')) or {}
    if kind == AS.GABLE_FRONT:
        if slope.get('form') != 'gf_slope':
            errs.append(f'{tag}: roof {m.get("roof")} 는 사면 띠 세트(form gf_slope)여야 한다')
        if (items.get(m.get('gable')) or {}).get('form') != 'gable_front':
            errs.append(f'{tag}: gable {m.get("gable")} 는 앞 박공 세트(form gable_front)여야 한다')
        if (items.get(m.get('back')) or {}).get('form') not in ('gf_back', 'gable_front'):
            errs.append(f'{tag}: back {m.get("back")} 는 뒤 끝 세트(form gf_back 또는 gable_front)여야 한다')
        if m.get('back_end') not in ('gable', 'valley'):
            errs.append(f'{tag}: back_end {m.get("back_end")!r} — gable|valley')
    else:
        if slope.get('form') != 'lean_to':
            errs.append(f'{tag}: roof {m.get("roof")} 는 외쪽 세트(form lean_to)여야 한다')
        elif slope.get('low') != m.get('low'):
            errs.append(f'{tag}: low {m.get("low")} ≠ 세트 low {slope.get("low")}')
    if errs:
        return errs
    back_role, front_role = AS.end_roles(m)
    back = AS._piece_of(items[m['back']], back_role)
    front = AS._piece_of(items[m['gable']], front_role)
    for name, pc, item in ((back_role, back, m['back']), (front_role, front, m['gable'])):
        if pc is None:
            errs.append(f'{tag}: {item} 에 {name} 조각이 없다(폭 {m["cols"]}칸 변형)')
    for r in AS.body_roles(m):
        if AS._piece_of(slope, r) is None:
            errs.append(f'{tag}: {m["roof"]} 에 {r} 조각이 없다')
    if kind == AS.GABLE_FRONT and back and front and back['size'][1] != front['size'][1]:
        errs.append(f'{tag}: 뒤 끝 {back_role} {back["size"][1]}행 ≠ 앞 박공 {front_role} {front["size"][1]}행(같은 물매)')
    return sorted(set(errs), key=errs.index)


def _gable_front_round(s, items, rid):
    """requireGableFront 판 — 건물마다 gable_front 질량, 판 항목이 레시피 부품을 다 덮고, flat_elevation 함정을
    만들 용마루-정면 지붕(ridge_side) 항목이 판에 있다. 지붕 위 extras 는 on: roof 를 적는다."""
    errs = []
    rd = s['rounds'][rid]
    by = {b['id']: b for b in s.get('buildings', [])}
    have = set(rd.get('items') or [])
    for bid in rd.get('buildings') or []:
        recipe = by.get(bid)
        if not recipe:
            continue
        ms = AS.masses(recipe)
        if not any(m['kind'] == AS.GABLE_FRONT for m in ms):
            errs.append(f'판 {rid} {bid}: requireGableFront — gable_front 질량이 없다(평평한 정면 입면만)')
        miss = sorted(AS.needed(recipe) - have)
        if miss:
            errs.append(f'판 {rid} {bid}: 판 items 에 없는 부품 {miss}')
        for m in ms:
            for ex in m.get('extras') or []:
                if ex.get('on') != 'roof':
                    errs.append(f'판 {rid} {bid}/{m["id"]}: extra {ex.get("part")} 는 on: "roof" 를 적는다(A14)')
    ridge = [i for i in have if (items.get(i) or {}).get('wave') == 'roof' and not items[i].get('form')
             and not items[i].get('spire') and int(items[i].get('end', AS.ROOF_END)) == AS.ROOF_END]
    if not ridge:
        errs.append(f'판 {rid}: flat_elevation 함정을 만들 용마루-정면 지붕(ridge_side) 항목이 판에 없다')
    return errs


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
    mod = round_module(theme, rid)
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


def cmd_sheet(theme, rid, show_failed=False, finished=False):
    import sheet
    return sheet.write(theme, rid, show_failed, finished=finished)


def cmd_review(theme, rid, runs=3, judge_cmd=None, finished=False):
    import review
    return review.run(theme, rid, runs, judge_cmd, finished=finished)


def cmd_village(theme, rid, line='A', seed=0, size=None, all_=False, quiet=False, finished=False):
    import village
    return village.write(theme, rid, line, seed, size or village.DEFAULT_SIZE, all_, quiet, finished=finished)


def cmd_finish(theme, rid, line, building=None, jobs=1, cmd=None):
    import finish
    return finish.run(theme, rid, line, building, jobs, cmd)


def finished_picked_path(theme, line, building):
    return os.path.join(dot.theme_dir(theme), 'picked', line, 'finished', f'{building}.png')


def cmd_pick_finished(theme, rid, building, key, sha, note, by='user'):
    """사람이 마감 시트에서 고른 마감 건물 — 시트에 보인 마감 해시 · 지금 마감 PNG · 마감 검사 · 바탕 조립 · 마감 검수 PASS 가
    모두 같은 해시일 때만 picked/<줄>/finished/<건물>.png 와 원장 finishedPicks 에 적는다."""
    import finish
    import review
    if by != 'user':
        raise SystemExit('pick 은 사람만 한다 — --by 는 user 만 받는다(감독·에이전트 대리 선택 경로 없음)')
    ln = line_of(theme, key)
    if not ln:
        raise SystemExit(f'후보 {key} 의 줄을 모른다 — 시드 lines: {", ".join(lines(theme))}')
    recipe = building[len(key) + 1:] if building.startswith(f'{key}.') else building
    bid = f'{key}.{recipe}'
    sheet_p = os.path.join(finish.out_dir(theme, rid), 'sheet.json')
    if not os.path.exists(sheet_p):
        raise SystemExit(f'{theme} {rid}: 마감 시트가 없다 — sheet {theme} {rid} --finished 를 먼저(사람이 본 시트가 있어야 고를 수 있다)')
    shown = (json.load(open(sheet_p, encoding='utf-8')).get('shown') or {}).get(bid)
    if not shown:
        raise SystemExit(f'{bid} 는 마감 시트에 보이지 않았다(검수 PASS 마감 건물만 시트에 올라온다)')
    if not sha or not shown.startswith(sha):
        raise SystemExit(f'--sha 가 시트에 보인 마감 해시({shown[:8]})와 다르다 — 사람이 본 그림의 해시 앞자리를 그대로 받는다')
    cands, why = finish.finished_candidates(theme, rid)
    if bid not in cands:
        raise SystemExit(f'{bid}: 지금 쓸 수 있는 마감본이 아니다 — {why.get(bid, "마감 기록 없음")}')
    img = cands[bid]['img']
    cur = dot.image_hash(img)
    if cur != shown:
        raise SystemExit(f'시트 이후 마감 그림이 바뀌었다(시트 {shown[:12]} ≠ 현재 {cur[:12]}). sheet --finished 를 다시 만들어 보여야 한다')
    if not review.passed(theme, rid, bid, img, finished=True):
        raise SystemExit(f'{bid}: 마감 그림 해시에 대한 독립 검수 PASS 영수증이 없다 — review {theme} {rid} --finished')
    out = finished_picked_path(theme, ln, recipe)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out)
    L = ledger(theme)
    L.setdefault('finishedPicks', [])
    L['finishedPicks'] = [p for p in L['finishedPicks'] if not (p['building'] == recipe and p['line'] == ln)] + [
        {'round': rid, 'building': recipe, 'line': ln, 'key': key, 'sha256': cur,
         'baseSha256': cands[bid]['record'].get('baseSha256'), 'note': note, 'at': now(), 'by': 'user'}]
    save_ledger(theme, L)
    print(f'마감 고름 기록: {recipe} 줄 {ln} ← {theme} {rid} {bid} ({cur[:12]}) → {os.path.relpath(out, REPO)}')


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
                  + f' · 시트 {"있음" if os.path.exists(os.path.join(dot.VIZ, f"bk-{t}-{rid}.html")) else "없음"}'
                  + _finish_status(t, rid))
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
    p = sub.add_parser('finish')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('--line', required=True)
    p.add_argument('--building')
    p.add_argument('--jobs', type=int, default=1)
    p.add_argument('--cmd', dest='agent_cmd')
    p = sub.add_parser('review')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('--runs', type=int, default=3)
    p.add_argument('--judge-cmd')
    p.add_argument('--finished', action='store_true')
    p = sub.add_parser('sheet')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('--show-failed', action='store_true')
    p.add_argument('--finished', action='store_true')
    p = sub.add_parser('pick')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('item')
    p.add_argument('key')
    p.add_argument('--sha', required=True)
    p.add_argument('--note', default='')
    p.add_argument('--by', default='user')
    p.add_argument('--finished', action='store_true')
    p = sub.add_parser('reject')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('item')
    p.add_argument('key')
    p.add_argument('--why', default='')
    p.add_argument('--by', default='user')
    p = sub.add_parser('objgate')
    p.add_argument('theme')
    p = sub.add_parser('village')
    p.add_argument('theme')
    p.add_argument('round')
    p.add_argument('--line', default='A')
    p.add_argument('--seed', type=int, default=0)
    p.add_argument('--size')
    p.add_argument('--all', action='store_true')
    p.add_argument('--finished', action='store_true')
    p = sub.add_parser('status')
    p.add_argument('theme', nargs='?')
    p = sub.add_parser('projection')
    p.add_argument('--out', default=os.path.join(dot.RUNS, '_projection'))
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
    if a.cmd == 'finish':
        return cmd_finish(a.theme, a.round, a.line, a.building, a.jobs, a.agent_cmd)
    if a.cmd == 'review':
        return cmd_review(a.theme, a.round, a.runs, a.judge_cmd, a.finished)
    if a.cmd == 'sheet':
        return cmd_sheet(a.theme, a.round, a.show_failed, a.finished)
    if a.cmd == 'pick':
        if a.finished:
            cmd_pick_finished(a.theme, a.round, a.item, a.key, a.sha, a.note, a.by)
        else:
            cmd_pick(a.theme, a.round, a.item, a.key, a.sha, a.note, a.by)
        return 0
    if a.cmd == 'reject':
        cmd_reject(a.theme, a.round, a.item, a.key, a.why, a.by)
        return 0
    if a.cmd == 'objgate':
        return cmd_objgate(a.theme)
    if a.cmd == 'village':
        size = None
        if a.size:
            try:
                w, h = (int(v) for v in a.size.lower().split('x'))
            except ValueError:
                raise SystemExit('--size 는 40x28 처럼 WxH 칸이다')
            size = (w, h)
        _, html_path = cmd_village(a.theme, a.round, a.line, a.seed, size, a.all, finished=a.finished)
        print(f'  HTML {html_path}')
        return 0
    if a.cmd == 'status':
        return cmd_status(a.theme)
    if a.cmd == 'projection':
        import projection
        for path in projection.write_guides(a.out):
            print(path)
        return 0
    return 2


if __name__ == '__main__':
    sys.exit(main())
