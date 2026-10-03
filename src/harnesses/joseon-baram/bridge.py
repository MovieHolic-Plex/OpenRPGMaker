"""joseon-baram 하네스 다리 — 기존 조선 도구(scripts/content/lib/joseon/harness/*)를 읽고 부르는 얇은 입구.

새 판정 로직을 두지 않는다. 팔레트·카탈로그·게이트·판정·적대 리뷰의 규칙은 전부 기존 모듈이 가진다.
이 파일이 하는 일: 점검(palette·validate)·목록(list·status)·게이트 호출(gate)·16구역 검수 묶음(review). 쓰는 파일은 review 의 산출 폴더뿐이다.

    python3 bridge.py palette
    python3 bridge.py validate [--deep]
    python3 bridge.py list [pieces|maps] [--class C] [--status S] [--adv keep|block|none]
    python3 bridge.py gate [--candidate] [--sheets] [--piece a,b] [--all] [--out DIR]
    python3 bridge.py status [--fresh]
    python3 bridge.py review zones <지도id> [--out DIR] [--scale N]
    python3 bridge.py review pieces (--piece a,b | --blocked [--limit N]) [--out DIR]

환경변수: JOSEON_BARAM_LEDGER(기록 파일 경로) · JOSEON_BARAM_RUNS(산출 폴더, 기본 qa-runs/harnesses/joseon-baram)
"""
import ast
import hashlib
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
SEED_PATH = os.path.join(ROOT, 'harness-data', 'joseon-baram', 'seed.json')


def P(rel):
    return os.path.join(ROOT, rel)


def jload(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return default


def seed():
    return jload(SEED_PATH)


def toolchain(key):
    return P(seed()['toolchain'][key])


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def use_joseon_path():
    d = toolchain('dir')
    h = toolchain('harnessDir')
    for p in (h, d):
        if p not in sys.path:
            sys.path.insert(0, p)


def ledger_path():
    return os.environ.get('JOSEON_BARAM_LEDGER') or P('harness-data/joseon-baram/ledger.json')


def runs_base():
    return os.environ.get('JOSEON_BARAM_RUNS') or P('qa-runs/harnesses/joseon-baram')


def parse(argv, booleans=(), values=()):
    """--k v / --k(불리언) 과 위치 인자를 나눈다."""
    pos, flags = [], {}
    i = 0
    while i < len(argv):
        a = argv[i]
        if a.startswith('--'):
            k = a[2:]
            if k in booleans:
                flags[k] = True
            elif k in values:
                if i + 1 >= len(argv):
                    raise SystemExit(f'--{k} 값이 없다')
                flags[k] = argv[i + 1]
                i += 1
            else:
                raise SystemExit(f'모르는 옵션 --{k}')
        else:
            pos.append(a)
        i += 1
    return pos, flags


# ───────────────────────── palette ─────────────────────────

def palette_check():
    """(ok, 줄들). 파일을 쓰지 않는다. 잠금 규칙: allowed == 램프 합집합 ∪ 그림자."""
    s = seed()['palette']
    lines, ok = [], True
    pal = jload(P(s['file']))
    if pal is None:
        return False, [f'FAIL palette.json 이 없다: {s["file"]}']
    allowed = pal.get('allowed', [])
    ramps = pal.get('ramps', {})
    shadow = pal.get('shadow')
    hexre = re.compile(r'^#[0-9a-f]{6}$')
    bad_fmt = [c for c in allowed if not hexre.match(c)]
    if bad_fmt:
        ok = False
        lines.append(f'FAIL 허용 색 형식 오류 {bad_fmt[:3]}')
    if allowed != sorted(set(allowed)):
        ok = False
        lines.append('FAIL allowed 가 정렬·중복 제거 상태가 아니다')
    union = set(c for v in ramps.values() for c in v) | ({shadow} if shadow else set())
    outside = sorted(union - set(allowed))
    unused = sorted(set(allowed) - union)
    if outside:
        ok = False
        lines.append(f'FAIL 램프에 있지만 허용 목록에 없는 색 {len(outside)}개 {outside[:4]}')
    if unused:
        ok = False
        lines.append(f'FAIL 허용 목록에 있지만 어느 램프에도 없는 색 {len(unused)}개 {unused[:4]}')
    if shadow != s['shadow']:
        ok = False
        lines.append(f'FAIL 그림자색 {shadow} != 시드 {s["shadow"]}')
    if len(allowed) != s['allowedColors']:
        ok = False
        lines.append(f'FAIL 허용 색 {len(allowed)}색 != 시드 {s["allowedColors"]}색 — 다시 잠갔다면 시드의 allowedColors 도 고치고 V 판정을 다시 쓴다')
    if len(ramps) != s['rampCount']:
        ok = False
        lines.append(f'FAIL 램프 {len(ramps)}개 != 시드 {s["rampCount"]}개')
    bad_len = [k for k, v in ramps.items() if len(v) not in (7, 8)]
    if bad_len:
        ok = False
        lines.append(f'FAIL 램프 길이가 7/8 이 아님 {bad_len}')
    prev = jload(P(s['previous']['file']))
    if prev is None:
        ok = False
        lines.append(f'FAIL 옛 잠금 {s["previous"]["file"]} 가 없다(되돌리기용 보존)')
    elif len(prev.get('allowed', [])) != s['previous']['allowedColors']:
        ok = False
        lines.append(f'FAIL 옛 잠금 색 수 {len(prev.get("allowed", []))} != 시드 {s["previous"]["allowedColors"]}')
    if ok:
        lines.insert(0, f'팔레트 잠금 OK: 허용 {len(allowed)}색 · 램프 {len(ramps)}개 · 그림자 {shadow} (옛 버들항 잠금 {len(prev["allowed"])}색 보존)')
    return ok, lines


def cmd_palette(argv):
    parse(argv)
    ok, lines = palette_check()
    print('\n'.join(lines))
    return 0 if ok else 1


# ───────────────────────── validate ─────────────────────────

def _git_tracked(prefixes):
    out = subprocess.run(['git', '-C', ROOT, 'ls-files', '-z', '--'] + prefixes, capture_output=True, check=False)
    return [p for p in out.stdout.decode('utf-8', 'replace').split('\0') if p]


def _mapgate_profile(profile):
    """mapgate 는 import 시점에 JS_PROFILE 환경변수로 임계를 정한다. 프로필별로 새로 import 해 상수를 읽는다."""
    use_joseon_path()
    old = os.environ.get('JS_PROFILE')
    try:
        if profile == 'default':
            os.environ.pop('JS_PROFILE', None)
        else:
            os.environ['JS_PROFILE'] = profile
        sys.modules.pop('mapgate', None)
        import mapgate
        return {'lawnMax': mapgate.LAWN_MAX, 'treeMin': mapgate.TREE_MIN, 'objMin': mapgate.OBJ_MIN, 'depthMin': mapgate.DEPTH_MIN,
                'bldMin': mapgate.BLD_MIN, 'heightsMin': mapgate.HEIGHTS_MIN}
    finally:
        sys.modules.pop('mapgate', None)
        if old is None:
            os.environ.pop('JS_PROFILE', None)
        else:
            os.environ['JS_PROFILE'] = old


def cmd_validate(argv):
    _, fl = parse(argv, booleans=('deep',))
    sd = seed()
    errors, warns, notes = [], [], []

    def err(m): errors.append(m)

    # 1. 시드가 가리키는 파일
    for key, rel in sd['toolchain'].items():
        if not os.path.exists(P(rel)):
            err(f'toolchain.{key} 파일이 없다: {rel}')
    for rel in (sd['tileset']['sheet'], sd['tileset']['doc'], sd['characters']['sheet'], sd['palette']['file']):
        if not os.path.exists(P(rel)):
            err(f'시드가 가리키는 파일이 없다: {rel}')
    ref = sd['sources']['beodeulReference']['dir']
    if not os.path.isdir(P(ref)):
        err(f'게이트 기준 폴더가 없다: {ref} (gate --sheets·calibrate 가 읽는다)')
    lock = sd['palette'].get('lockScript', '').split(' ')[0]
    if lock and not os.path.exists(P(lock)):
        err(f'palette.lockScript 가 없다: {lock}')

    # 2. 지도 산출물
    for m in sd['maps']:
        d = P(m['out'])
        if not os.path.isdir(d):
            err(f'지도 {m["id"]}: 산출 폴더가 없다 {m["out"]}')
            continue
        for tpl in sd['mapFiles']:
            f = os.path.join(d, tpl.replace('{stem}', m['stem']))
            if not os.path.exists(f):
                err(f'지도 {m["id"]}: 파일이 없다 {os.path.relpath(f, ROOT)}')
        mj = jload(os.path.join(d, 'map.json'))
        if mj and [mj.get('width'), mj.get('height')] != m['size']:
            err(f'지도 {m["id"]}: map.json 크기 {mj.get("width")}x{mj.get("height")} != 시드 {m["size"]}')
        if not os.path.exists(P(m['builder'])):
            err(f'지도 {m["id"]}: 빌더가 없다 {m["builder"]}')

    # 3. 팔레트
    ok, lines = palette_check()
    if not ok:
        errors.extend(l for l in lines)
    else:
        notes.append(lines[0])

    # 4. 조각 메타 분류
    meta = jload(toolchain('piecesMeta'), {})
    classes = set(sd['pieceClasses'])
    unknown_cls = sorted({v.get('cls') for k, v in meta.items() if isinstance(v, dict) and v.get('cls') not in classes})
    if unknown_cls:
        err(f'pieces_meta 에 시드 pieceClasses 에 없는 분류 {unknown_cls}')
    nometa_cls = [k for k, v in meta.items() if isinstance(v, dict) and 'cls' not in v]
    if nometa_cls:
        warns.append(f'cls 가 없는 메타 {len(nometa_cls)}개 {nometa_cls[:4]}')
    notes.append(f'조각 메타 {sum(1 for k in meta if not k.startswith("_"))}개 분류 확인')

    # 5. 시드 ↔ 기존 스크립트 소스 대조(문자열만 읽는다)
    gate_src = open(toolchain('gate'), encoding='utf-8').read()
    m = re.search(r'^TERRAIN_VERDICT\s*=\s*(\(.*?\))', gate_src, re.M)
    if not m or list(ast.literal_eval(m.group(1))) != sd['terrainWithVerdict']:
        err(f'terrainWithVerdict 가 gate.py TERRAIN_VERDICT 와 다르다 ({m.group(1) if m else "없음"})')
    doc_codes = re.findall(r'^\s{2}([A-Z]{1,2})\s+\S', gate_src.split('"""')[1], re.M)
    missing = [g['code'] for g in sd['gates'] if g['code'] not in doc_codes]
    if missing:
        err(f'gate.py 독스트링에 없는 관문 코드 {missing}')
    v_src = open(toolchain('verdict'), encoding='utf-8').read()
    m = re.search(r"status in (\([^)]*\))", v_src)
    if not m or sorted(ast.literal_eval(m.group(1))) != sorted(sd['verdictStatuses']):
        err('verdictStatuses 가 verdict.py 의 허용 상태와 다르다')
    a_src = open(toolchain('adversarial'), encoding='utf-8').read()
    m = re.search(r'^LENSES\s*=\s*(\(.*?\))', a_src, re.M)
    if not m or list(ast.literal_eval(m.group(1))) != sd['adversarial']['lenses']:
        err('adversarial.lenses 가 adversarial.py LENSES 와 다르다')

    # 6. 지도 관문 임계 대조(실제 mapgate import)
    for name, want in sd['mapGate']['profiles'].items():
        got = _mapgate_profile(name)
        diff = {k: (want[k], got[k]) for k in want if abs(want[k] - got[k]) > 1e-12}
        if diff:
            err(f'mapGate 프로필 {name} 이 mapgate.py 와 다르다 {diff}')
    notes.append(f'지도 관문 프로필 {len(sd["mapGate"]["profiles"])}개 mapgate.py 와 일치')

    # 7. 바람의나라 스크린샷 추적 금지
    baram = sd['sources']['baramScreens']
    sizes = {v['bytes']: (k, v['sha256']) for k, v in baram['files'].items()}
    tracked = _git_tracked(['tiledata', 'public/assets', 'harness-data', 'src/assets', 'scripts/content/lib/joseon', 'assistant-skills', 'openwiki'])
    leaked = []
    for rel in tracked:
        fp = P(rel)
        try:
            sz = os.path.getsize(fp)
        except OSError:
            continue
        if sz in sizes and sha256_file(fp) == sizes[sz][1]:
            leaked.append(rel)
    if leaked:
        err(f'바람의나라 스크린샷과 같은 파일이 추적된다(커밋 금지): {leaked}')
    notes.append(f'추적 파일 {len(tracked)}개에서 바람의나라 스크린샷 해시 일치 0')
    home = os.path.expanduser(baram['dir'])
    if os.path.isdir(home):
        for name, info in baram['files'].items():
            fp = os.path.join(home, name)
            if not os.path.exists(fp):
                warns.append(f'참조 원본 없음: {baram["dir"]}/{name}')
            elif sha256_file(fp) != info['sha256']:
                warns.append(f'참조 원본 해시가 시드와 다르다: {baram["dir"]}/{name}')
    else:
        notes.append(f'{baram["dir"]} 없음(이 기계에 참조 원본이 없다 — 정상, 해시만 시드에 있다)')

    # 8. 기록 파일
    led = jload(ledger_path())
    if led is None:
        notes.append('ledger 아직 없음(첫 verdict·build·map·review 때 만들어진다)')
    elif not isinstance(led.get('entries'), list):
        err(f'ledger 의 entries 가 목록이 아니다: {ledger_path()}')

    # 9. 깊게: 카탈로그와 대조(약 20초)
    if fl.get('deep'):
        use_joseon_path()
        import catalog
        objs, terr = catalog.objects(), catalog.terrain()
        names = set(objs) | set(sd['terrainWithVerdict'])
        verd = jload(toolchain('verdicts'), {})
        adv = jload(toolchain('adversarialRecords'), {})
        no_meta = sorted(set(objs) - set(meta))
        no_obj_meta = sorted(k for k in meta if not k.startswith('_') and k not in objs)
        stale_verd = sorted(set(verd) - names)
        no_verd = sorted(names - set(verd))
        stale_adv = sorted(set(adv) - set(objs))
        if no_obj_meta:
            err(f'pieces_meta 에는 있고 카탈로그에는 없는 조각 {no_obj_meta[:6]}')
        if no_meta:
            warns.append(f'카탈로그에는 있고 pieces_meta 에는 없는 조각 {len(no_meta)}개(기본값으로 검사됨) {no_meta[:6]}')
        if stale_verd:
            warns.append(f'카탈로그에 없는 판정 줄 {len(stale_verd)}개 {stale_verd}')
        if no_verd:
            warns.append(f'판정 줄이 없는 조각 {len(no_verd)}개 {no_verd[:6]}')
        if stale_adv:
            warns.append(f'카탈로그에 없는 적대 리뷰 기록 {stale_adv}')
        notes.append(f'카탈로그 조각 {len(objs)}개 · 지형 {len(terr)}개 대조 완료')

    for n in notes:
        print('OK   ' + n)
    for w in warns:
        print('WARN ' + w)
    for e in errors:
        print('FAIL ' + e)
    print(f'\nvalidate: FAIL {len(errors)} / WARN {len(warns)}')
    return 1 if errors else 0


# ───────────────────────── list ─────────────────────────

def _adv_summary(rec):
    if not rec:
        return '-'
    parts = []
    for lens in ('culture', 'view'):
        r = rec.get('lenses', {}).get(lens)
        parts.append(f'{lens[0]}:{r["verdict"]}({r["score"]})' if r else f'{lens[0]}:-')
    return ' '.join(parts)


def _adv_state(rec):
    if not rec:
        return 'none'
    ok = all(rec.get('lenses', {}).get(l, {}).get('verdict') == 'keep' for l in ('culture', 'view'))
    return 'keep' if ok else 'block'


def cmd_list(argv):
    pos, fl = parse(argv, values=('class', 'status', 'adv'))
    what = pos[0] if pos else 'all'
    if what not in ('all', 'pieces', 'maps'):
        print(f'list 는 pieces 또는 maps 를 받는다: {what}', file=sys.stderr)
        return 2
    sd = seed()
    if what in ('all', 'pieces'):
        meta = jload(toolchain('piecesMeta'), {})
        verd = jload(toolchain('verdicts'), {})
        adv = jload(toolchain('adversarialRecords'), {})
        names = sorted((set(k for k in meta if not k.startswith('_')) | set(verd)))
        rows = []
        for n in names:
            cls = meta.get(n, {}).get('cls', '?') if n in meta else '?'
            v = verd.get(n)
            vs = v['status'] if v else 'none'
            ad = _adv_state(adv.get(n))
            if fl.get('class') and cls != fl['class']:
                continue
            if fl.get('status') and vs != fl['status']:
                continue
            if fl.get('adv') and ad != fl['adv']:
                continue
            rows.append((n, cls, vs, _adv_summary(adv.get(n)), (v or {}).get('date', '')))
        w = max([len(r[0]) for r in rows] + [4])
        for n, cls, vs, a, d in rows:
            print(f'{n:{w}s} {cls:8s} verdict={vs:4s} adv[{a}] {d}')
        by_cls, by_status = {}, {}
        for r in rows:
            by_cls[r[1]] = by_cls.get(r[1], 0) + 1
            by_status[r[2]] = by_status.get(r[2], 0) + 1
        print(f'\n조각 {len(rows)}개  분류 {by_cls}  판정 {by_status}')
        print('(기록된 값이다. 현재 그림 해시와 맞는지는 gate 가 판단한다)')
    if what in ('all', 'maps'):
        print()
        for m in sd['maps']:
            d = P(m['out'])
            mj = jload(os.path.join(d, 'map.json')) or {}
            have = [t.replace('{stem}', m['stem']) for t in sd['mapFiles'] if os.path.exists(os.path.join(d, t.replace('{stem}', m['stem'])))]
            print(f'{m["id"]:13s} {m["name"]}  {mj.get("width", "?")}x{mj.get("height", "?")}칸  시트순번 {m["sheetOrder"]}  프로필 {m["profile"]}  산출 {len(have)}/{len(sd["mapFiles"])}  빌더 {os.path.basename(m["builder"])}')
    return 0


# ───────────────────────── gate ─────────────────────────

def _code_of(status):
    """'FAIL P …; E …' → 막은 코드 집합."""
    body = status[5:] if status.startswith('FAIL ') else ''
    return set(re.findall(r'(?:^|; |\| )(TR|[A-Z]) ', body))


def _sheets_for(gate, objs):
    """gate.sheets 는 pieces_meta 의 refs 가 있는 조각만 그릴 수 있다. 메타가 없는 조각은 건너뛰고 알린다."""
    ok = {k: v for k, v in objs.items() if k in gate.META and 'refs' in gate.META[k]}
    skipped = sorted(set(objs) - set(ok))
    if skipped:
        print(f'WARN 기준 조각(refs) 메타가 없어 검수 시트를 못 만든 조각 {len(skipped)}개: {skipped[:6]} — pieces_meta.json 에 refs 를 더해야 한다', file=sys.stderr)
    return gate.sheets(ok) if ok else []


def cmd_gate(argv):
    _, fl = parse(argv, booleans=('candidate', 'sheets', 'all'), values=('piece', 'out'))
    use_joseon_path()
    import gate
    import catalog
    rows, fails, warns, objs = gate.run(skip_a=bool(fl.get('candidate')))
    want = set(fl['piece'].split(',')) if fl.get('piece') else None
    if want:
        known = {r[0] for r in rows}
        miss = sorted(want - known)
        if miss:
            print(f'카탈로그에 없는 조각: {miss}', file=sys.stderr)
            return 2
        rows = [r for r in rows if r[0] in want]
        fails = sum(1 for r in rows if r[2].startswith('FAIL'))
        warns = sum(1 for r in rows if r[2].startswith('WARN'))
    shown = rows if (fl.get('all') or want) else [r for r in rows if r[2] != 'ok']
    w = max([len(r[0]) for r in shown] + [4])
    for n, c, st, info in shown:
        print(f'{n:{w}s} {c:8s} {st}' + (f'   [{info}]' if info else ''))
    by = {}
    for r in rows:
        for c in _code_of(r[2]):
            by[c] = by.get(c, 0) + 1
    mode = '후보(A 건너뜀)' if fl.get('candidate') else '전체'
    print(f'\n[{mode}] FAIL {fails} / WARN {warns} / 전체 {len(rows)}')
    if by:
        print('막은 관문별: ' + ', '.join(f'{k} {v}' for k, v in sorted(by.items())))
    if fl.get('sheets'):
        if fl.get('out'):
            gate.OUTDIR = os.path.abspath(fl['out'])
        objs2 = {k: v for k, v in objs.items() if not want or k in want}
        paths = _sheets_for(gate, objs2)
        print(f'검수 시트 {len(paths)}장 -> {gate.OUTDIR}')
        if not want:
            print(gate.water_sheet(catalog.terrain()))
    return 1 if fails else 0


# ───────────────────────── status ─────────────────────────

def cmd_status(argv):
    _, fl = parse(argv, booleans=('fresh',))
    sd = seed()
    ok, lines = palette_check()
    print(('팔레트: ' + lines[0]) if ok else 'palette: ' + ' | '.join(lines))
    meta = jload(toolchain('piecesMeta'), {})
    verd = jload(toolchain('verdicts'), {})
    adv = jload(toolchain('adversarialRecords'), {})
    by_cls = {}
    for k, v in meta.items():
        if isinstance(v, dict):
            by_cls[v.get('cls', '?')] = by_cls.get(v.get('cls', '?'), 0) + 1
    by_v = {}
    for v in verd.values():
        by_v[v['status']] = by_v.get(v['status'], 0) + 1
    states = {}
    for rec in adv.values():
        s = _adv_state(rec)
        states[s] = states.get(s, 0) + 1
    print(f'조각 메타 {sum(by_cls.values())}개 {by_cls}')
    print(f'판정 기록 {len(verd)}줄 {by_v}  (해시 신선도는 --fresh 또는 gate)')
    print(f'적대 리뷰 기록 {len(adv)}개 {states}  (두 렌즈 keep 만 A 통과)')
    stats = jload(P('tiledata/joseon-village/build-stats.json'), {})
    sheet = jload(P('src/assets/joseonBaramSheet.json'), {})
    if stats:
        print(f'번들 시트: {stats.get("count")}칸 (조각 {stats.get("pieces")} · 지형 {stats.get("terrainGroups")} · 오토타일 {stats.get("autotileGroups")} · 꼬리 복사 {stats.get("tailCopies")}) 시트순번 {len(stats.get("sourceSheets", []))}장 합침')
        if sheet.get('count') != stats.get('count'):
            print(f'WARN src/assets/joseonBaramSheet.json count {sheet.get("count")} != build-stats {stats.get("count")}')
    sp = P(sd['tileset']['sheet'])
    print(f'시트 PNG: {"있음 " + str(os.path.getsize(sp)) + "B" if os.path.exists(sp) else "없음"}')
    for m in sd['maps']:
        mj = jload(os.path.join(P(m['out']), 'map.json')) or {}
        print(f'지도 {m["id"]}: {mj.get("width", "?")}x{mj.get("height", "?")}칸 (시드 {m["size"][0]}x{m["size"][1]})')
    led = jload(ledger_path(), {'entries': []})
    entries = led.get('entries', [])
    print(f'기록(ledger) {len(entries)}건' + ('' if not entries else ' — 최근:'))
    for e in entries[-5:]:
        print(f'  {e.get("at", "?")} {e.get("step", "?")} {json.dumps({k: v for k, v in e.items() if k not in ("at", "step")}, ensure_ascii=False)[:160]}')
    if fl.get('fresh'):
        use_joseon_path()
        import gate
        rows, fails, warns, _ = gate.run(skip_a=False)
        by = {}
        for r in rows:
            for c in _code_of(r[2]):
                by[c] = by.get(c, 0) + 1
        print(f'\n[현재 해시 기준] 게이트 FAIL {fails} / WARN {warns} / 전체 {len(rows)}  막은 관문별 {by}')
    return 0


# ───────────────────────── review ─────────────────────────

def _adversarial_sections():
    """ADVERSARIAL.md 의 렌즈·출력 절을 그대로 읽는다(문서가 바뀌면 프롬프트도 따라간다)."""
    text = open(toolchain('adversarialDoc'), encoding='utf-8').read()
    parts = re.split(r'^## ', text, flags=re.M)
    out = {}
    for p in parts[1:]:
        head, _, body = p.partition('\n')
        if head.startswith('렌즈 culture'):
            out['culture'] = '## ' + head + '\n' + body.strip()
        elif head.startswith('렌즈 view'):
            out['view'] = '## ' + head + '\n' + body.strip()
        elif head.startswith('출력'):
            out['output'] = '## ' + head + '\n' + body.strip()
        elif head.startswith('게이트 A'):
            out['gate'] = '## ' + head + '\n' + body.strip()
    preamble = parts[0].strip()
    missing = [k for k in ('culture', 'view', 'output') if k not in out]
    if missing:
        raise SystemExit(f'ADVERSARIAL.md 에서 절을 못 찾았다: {missing}')
    out['preamble'] = preamble
    return out


ZONE_RULES = """\
- 너는 이 그림을 그린 사람과 **다른 맥락의 독립 리뷰어**다. 이전 판정·점수·게이트 결과를 보지 못했다. 기본 태도는 **기각**이다.
- 칭찬에는 시각 근거(어느 부위의 무엇)가 있어야 한다. 근거 없는 "좋음"은 무효.
- 결함은 **최소 2개**(없으면 왜 없는지 근거). 위치는 이 구역 안의 칸 좌표(맵 전체 기준 x,y)로 적는다.
- 그림 한 화소 = {scale}x{scale} 픽셀이다(최근접 확대, 원 해상도). 확대된 한 칸 = 16*{scale} px.
- 통과 점수 숫자 하나에 기대지 마라: 점수는 ±1 흔들린다. 결함 목록이 판정이다.
- 이 구역 밖(이웃 구역)은 보이지 않는다. 구역 경계에서 잘린 것은 잘렸다고만 적고 결함으로 세지 않는다."""


def _prompt_zone(sd, mapinfo, zone, lens, sections, scale):
    return f"""# 적대 검수 — {mapinfo['name']} ({mapinfo['id']}) 구역 {zone['id']} · 렌즈 {lens}

대상 타일셋 joseon_baram(조선·바람의나라풍, 16px, 3/4). 이미지: `{zone['image']}`
이 구역: 칸 x {zone['tiles'][0]}..{zone['tiles'][2] - 1}, y {zone['tiles'][1]}..{zone['tiles'][3] - 1} (맵 {mapinfo['size'][0]}x{mapinfo['size'][1]}칸 중 {zone['tiles'][2] - zone['tiles'][0]}x{zone['tiles'][3] - zone['tiles'][1]}칸)

## 규칙
{ZONE_RULES.format(scale=scale)}
- 지도 구역이라 조각 단위가 아니라 **배치·밀도·반복·공간감·경계 처리**까지 본다: 같은 조각의 기계적 반복, 길과 문의 접속, 담·성벽 끊김, 나무 군락, 빈 잔디, 물 위 걸침, 3/4 가림 순서.

{sections[lens]}

{sections['output']}

구역 검수 출력은 위 형식에서 `piece` 대신 `zone`(`{zone['id']}`)과 `map`(`{mapinfo['id']}`)을 쓰고, 결함마다 `tiles`([x, y])를 더한다.
"""


def _write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)


def cmd_review(argv):
    if not argv or argv[0] not in ('zones', 'pieces'):
        print('review 는 zones <지도id> 또는 pieces (--piece … | --blocked) 를 받는다', file=sys.stderr)
        return 2
    kind, rest = argv[0], argv[1:]
    if kind == 'zones':
        return review_zones(rest)
    return review_pieces(rest)


def review_zones(argv):
    from PIL import Image
    pos, fl = parse(argv, values=('out', 'scale'))
    sd = seed()
    ids = [m['id'] for m in sd['maps']]
    if len(pos) != 1 or pos[0] not in ids:
        print(f'지도 id 가 필요하다: {ids}', file=sys.stderr)
        return 2
    mapinfo = next(m for m in sd['maps'] if m['id'] == pos[0])
    scale = int(fl.get('scale') or sd['reviewZones']['scale'])
    src = os.path.join(P(mapinfo['out']), f'{mapinfo["stem"]}-map.png')
    if not os.path.exists(src):
        print(f'지도 그림이 없다: {os.path.relpath(src, ROOT)} (map 단계로 먼저 굽는다)', file=sys.stderr)
        return 2
    out = os.path.abspath(fl['out']) if fl.get('out') else os.path.join(runs_base(), 'review', f'zones-{mapinfo["id"]}')
    sections = _adversarial_sections()
    im = Image.open(src).convert('RGBA')
    T = sd['tileset']['tile']
    tw, th = im.width // T, im.height // T
    cols, rows_n = sd['reviewZones']['grid']
    zones = []
    for r in range(rows_n):
        for c in range(cols):
            x0, x1 = c * tw // cols, (c + 1) * tw // cols
            y0, y1 = r * th // rows_n, (r + 1) * th // rows_n
            crop = im.crop((x0 * T, y0 * T, x1 * T, y1 * T))
            crop = crop.resize((crop.width * scale, crop.height * scale), Image.NEAREST)
            zid = f'r{r + 1}c{c + 1}'
            path = os.path.join(out, f'zone-{zid}.png')
            os.makedirs(out, exist_ok=True)
            crop.save(path)
            zones.append({'id': zid, 'tiles': [x0, y0, x1, y1], 'image': path, 'px': [crop.width, crop.height], 'sha256': sha256_file(path)})
    for z in zones:
        for lens in sd['reviewZones']['lenses']:
            _write(os.path.join(out, f'zone-{z["id"]}.{lens}.prompt.md'), _prompt_zone(sd, mapinfo, z, lens, sections, scale))
    manifest = {'map': mapinfo['id'], 'source': os.path.relpath(src, ROOT), 'sourceSha256': sha256_file(src), 'sourcePx': [im.width, im.height],
                'grid': [cols, rows_n], 'scale': scale, 'lenses': sd['reviewZones']['lenses'], 'zones': zones}
    _write(os.path.join(out, 'manifest.json'), json.dumps(manifest, ensure_ascii=False, indent=1) + '\n')
    _write(os.path.join(out, 'README.md'), f"""# {mapinfo['name']} 16구역 적대 검수 묶음

- 구역 {len(zones)}개 x 렌즈 {len(sd['reviewZones']['lenses'])}개 = 프롬프트 {len(zones) * len(sd['reviewZones']['lenses'])}개 (`zone-<구역>.<렌즈>.prompt.md`) + 구역 그림 `zone-<구역>.png`
- **프롬프트마다 새 독립 리뷰어**에게 준다(그린 사람의 맥락·이전 판정을 주지 않는다). 같은 리뷰어를 재사용하지 않는다. 최대 3라운드.
- 리뷰어 출력은 `manifest.json` 의 `sourceSha256`(지도 그림 해시)에 묶는다. 지도가 다시 구워지면 이 묶음은 낡은 것이다.
- 검수 ✓ 는 보증이 아니다. 감독자가 결함 목록의 위치를 원본 해상도 그림에서 직접 확인한다.
""")
    print(f'구역 {len(zones)}개 크롭(x{scale}) + 프롬프트 {len(zones) * len(sd["reviewZones"]["lenses"])}개 -> {out}')
    print('manifest ' + os.path.join(out, 'manifest.json'))
    return 0


def review_pieces(argv):
    from PIL import Image
    _, fl = parse(argv, booleans=('blocked',), values=('piece', 'limit', 'out'))
    sd = seed()
    use_joseon_path()
    import catalog
    import adversarial
    import gate
    objs = catalog.objects()
    if fl.get('piece'):
        names = fl['piece'].split(',')
        miss = [n for n in names if n not in objs]
        if miss:
            print(f'카탈로그에 없는 조각: {miss}', file=sys.stderr)
            return 2
    elif fl.get('blocked'):
        data = adversarial.load()
        names = [n for n, cv in objs.items() if not adversarial.check(n, cv, data)[0]]
        names = names[:int(fl.get('limit') or 20)]
    else:
        print('--piece a,b 또는 --blocked [--limit N] 이 필요하다', file=sys.stderr)
        return 2
    out = os.path.abspath(fl['out']) if fl.get('out') else os.path.join(runs_base(), 'review', 'pieces')
    os.makedirs(out, exist_ok=True)
    sections = _adversarial_sections()
    gate.OUTDIR = out
    _sheets_for(gate, {n: objs[n] for n in names})            # 내 조각 | 버들항 기준 조각 x3, 3배
    items = []
    for n in names:
        cv = objs[n]
        six = os.path.join(out, f'{n}.6x.png')
        cv.img().resize((cv.w * 6, cv.h * 6), Image.NEAREST).save(six)
        h = adversarial.piece_hash(cv)
        for lens in sd['adversarial']['lenses']:
            prompt = f"""# 적대 검수 — 조각 {n} · 렌즈 {lens}

조각 해시 `{h}`(기록은 이 해시에 묶인다). 그림: `{six}` (조각 6배), 기준 비교: `{os.path.join(out, n + '.png')}` (왼쪽 내 조각, 오른쪽 버들항 기준 조각 x3, 3배)

너는 그린 사람과 다른 맥락의 독립 리뷰어다. 기본 태도는 기각이다. 결함은 최소 2개. 점수는 ±1 흔들리니 결함 목록이 판정이다.

{sections[lens]}

{sections['output']}
"""
            _write(os.path.join(out, f'{n}.{lens}.prompt.md'), prompt)
        items.append({'piece': n, 'hash': h, 'image6x': six, 'sheet': os.path.join(out, n + '.png')})
    _write(os.path.join(out, 'manifest.json'), json.dumps({'pieces': items, 'lenses': sd['adversarial']['lenses'],
                                                          'record': 'npm run harness -- joseon-baram review record <리뷰어 출력 json>'}, ensure_ascii=False, indent=1) + '\n')
    print(f'조각 {len(names)}개 x 렌즈 {len(sd["adversarial"]["lenses"])}개 프롬프트 -> {out}')
    return 0


COMMANDS = {'palette': cmd_palette, 'validate': cmd_validate, 'list': cmd_list, 'gate': cmd_gate, 'status': cmd_status, 'review': cmd_review}

if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print('bridge.py 단계: ' + ', '.join(COMMANDS), file=sys.stderr)
        sys.exit(2)
    sys.exit(COMMANDS[sys.argv[1]](sys.argv[2:]))
