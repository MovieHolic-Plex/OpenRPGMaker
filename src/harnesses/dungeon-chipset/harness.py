"""dungeon-chipset 하네스 본체. `npm run harness -- dungeon-chipset <단계>` 또는 `python3 src/harnesses/dungeon-chipset/harness.py <단계>`.

  palette [--check]                 버들항 그림에서 잠금 팔레트를 다시 뽑는다(--check 는 비교만)
  validate                          시드·팔레트·판 모듈·기준 그림·Actor1 점검
  list [--wave W]                   시드 항목(★ = 사람이 고른 것, 현재 그림과 해시가 맞을 때만)
  draw <판>                         판 후보를 그려 qa-runs/harnesses/dungeon-chipset/<판>/ 에 PNG·manifest.json
  gate <판>                         draw + 기계 관문(P Z Q O F S G / WARN R). FAIL 이 있으면 종료코드 1
  sheet <판> [--force]              draw + gate + ~/claude-viz/dungeon-<판>.html (FAIL 이면 --force 없이는 안 쓴다)
  pick <판> <항목> <글자> --sha <앞 8자리> [--note …]   사람이 시트에서 고른 후보를 그림 해시에 묶어 기록
  reject <판> <항목> <글자> --why …   사람이 버린 후보와 이유
  status                            판·관문·시트·고른 것(현재 그림과 해시가 맞는지)

감독·에이전트는 pick/reject 를 스스로 부르지 않는다. 사람이 고른 글자와 시트에 적힌 해시 앞자리를 받아 적을 때만 쓴다.
기계 관문 통과는 합격이 아니다.
"""
import argparse
import base64
import datetime
import importlib.util
import io
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

import dot  # noqa: E402
import gate as G  # noqa: E402

REPO = dot.REPO
DATA = dot.DATA
RUNS = os.path.join(REPO, 'qa-runs', 'harnesses', 'dungeon-chipset')
VIZ = os.path.expanduser('~/claude-viz')
LEDGER = os.path.join(DATA, 'ledger.json')
PICKED = os.path.join(DATA, 'picked')


def now():
    return datetime.datetime.now().isoformat(timespec='seconds')


def seed():
    return json.load(open(os.path.join(DATA, 'seed.json'), encoding='utf-8'))


def items_by_id():
    return {it['id']: it for it in seed()['items']}


def ledger():
    if os.path.exists(LEDGER):
        return json.load(open(LEDGER, encoding='utf-8'))
    return {'picks': [], 'rejects': [], 'runs': []}


def save_ledger(L):
    with open(LEDGER, 'w', encoding='utf-8') as f:
        json.dump(L, f, ensure_ascii=False, indent=1)
        f.write('\n')


def load_round(rid):
    s = seed()
    if rid not in s['rounds']:
        raise SystemExit(f'모르는 판: {rid}. 시드 rounds: {", ".join(s["rounds"])}')
    path = os.path.join(REPO, s['rounds'][rid]['module'])
    spec = importlib.util.spec_from_file_location(f'dungeon_round_{rid.replace("-", "_")}', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def render_round(rid):
    mod = load_round(rid)
    out = {}
    for item, cands in mod.CANDIDATES.items():
        out[item] = {L: (lambda r: (r[0].img(), r[1]))(fn()) for L, fn in cands.items()}
    return mod, out


def cmd_draw(rid, quiet=False):
    mod, rendered = render_round(rid)
    base = os.path.join(RUNS, rid)
    man = {'round': rid, 'wave': getattr(mod, 'WAVE', None), 'at': now(), 'items': {}}
    for item, cands in rendered.items():
        d = os.path.join(base, item)
        os.makedirs(d, exist_ok=True)
        man['items'][item] = {}
        for L, (im, meta) in cands.items():
            im.save(os.path.join(d, f'{L}.png'))
            im.resize((im.width * 8, im.height * 8), Image.NEAREST).save(os.path.join(d, f'{L}-x8.png'))
            if 'vignette' in meta:
                meta['vignette'].img().save(os.path.join(d, f'{L}-scene.png'))
            man['items'][item][L] = {'sha256': dot.image_hash(im), 'size': [im.width, im.height]}
    json.dump(man, open(os.path.join(base, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if not quiet:
        n = sum(len(v) for v in man['items'].values())
        print(f'{rid}: 항목 {len(man["items"])} · 후보 {n} → {os.path.relpath(base, REPO)}/')
    return mod, rendered, man


def run_gate(rendered):
    items = items_by_id()
    res = {}
    for item, cands in rendered.items():
        if item not in items:
            raise SystemExit(f'판의 항목 {item} 이 시드에 없다')
        rc = G.check_recolor({L: im for L, (im, _) in cands.items()})
        res[item] = {L: G.check_one(items[item], im, meta) + [rc[L]] for L, (im, meta) in cands.items()}
    return res


def gate_summary(res):
    fails = [(i, L, r) for i, c in res.items() for L, rs in c.items() for r in rs if r['level'] == 'FAIL' and not r['ok']]
    warns = [(i, L, r) for i, c in res.items() for L, rs in c.items() for r in rs if r['level'] == 'WARN' and not r['ok']]
    return fails, warns


def cmd_gate(rid, quiet=False):
    mod, rendered, man = cmd_draw(rid, quiet=True)
    res = run_gate(rendered)
    fails, warns = gate_summary(res)
    if not quiet:
        for item, c in res.items():
            for L, rs in c.items():
                bad = [r for r in rs if not r['ok']]
                print(f'{item:20} {L} {man["items"][item][L]["sha256"][:8]}  '
                      + ('통과' if not bad else ' · '.join(f'{r["level"]} {r["code"]}: {r["msg"]}' for r in bad)))
        print(f'관문: FAIL {len(fails)} · WARN {len(warns)} — 통과는 합격이 아니다(사람이 시트에서 고른다)')
    L = ledger()
    L['runs'].append({'round': rid, 'at': now(), 'fail': len(fails), 'warn': len(warns),
                      'hashes': {i: {k: v['sha256'] for k, v in c.items()} for i, c in man['items'].items()}})
    L['runs'] = L['runs'][-40:]
    save_ledger(L)
    return mod, rendered, man, res, fails


# ------------------------------------------------------------------------------------------------ 시트
def b64(im, k=1):
    if isinstance(im, dot.Cv):
        im = im.img()
    if k != 1:
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def ref_image(key):
    r = seed()['refs'][key]
    im = Image.open(os.path.join(REPO, r['file'])).convert('RGBA')
    if 'box' in r:
        x, y, w, h = r['box']
        im = im.crop((x, y, x + w, y + h))
    return im, r['label']


def actor():
    return dot.actor1_frame(1, 0, 0)


def set_scene(mod, letter):
    """글자 하나의 다섯 항목을 한 장면(12×9)에 모은다. 벽돌 칸은 맥락 벽돌."""
    g = mod.SET_GRID
    cave = mod.CAVES[letter]()
    wat = mod.water_set(letter)
    base = dot.render_cave(g, cave['ceil'], cave['face'], cave['floor'], water=wat)
    brick = dot.render_cave(g, cave['ceil'], mod.brick_face(), cave['floor'], water=wat)
    k = dot.classify(g)
    for y, row in enumerate(k):
        for x, kk in enumerate(row):
            if kk in ('hi', 'lo') and x >= mod.SET_BRICK_FROM:
                base.a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16] = brick.a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16]
    rows = {'A': mod.DOOR_A, 'B': mod.DOOR_B, 'C': mod.DOOR_C}[letter]
    dx, dy = mod.SET_DOOR
    base.paste(mod.door_insert(rows), dx * 16, dy * 16)
    sx, sy = mod.SET_STAIRS
    base.paste(mod.stairs_tile(letter), sx * 16, sy * 16)
    chest, torch = mod.chest_torch(letter)
    cx, cy = mod.SET_CHEST
    base.paste(chest, cx * 16, cy * 16)
    for tx, ty in (mod.SET_TORCH_WALL if mod.PAIRS[letter][2] == 'wall' else mod.SET_TORCH_FLOOR):
        base.paste(torch, tx * 16, ty * 16 + (6 if mod.PAIRS[letter][2] == 'wall' else 0))
    ax, ay = mod.SET_ACTOR
    base.paste(dot.Cv.of(actor()), ax * 16 - 4, ay * 16 - 16)
    return base


CSS = '''
body{background:#16141c;color:#e6e2da;font:14px/1.5 system-ui,"Noto Sans KR",sans-serif;margin:0;padding:24px 28px 80px}
h1{font-size:22px;margin:0 0 6px} h2{font-size:18px;margin:34px 0 8px;border-top:1px solid #3a3644;padding-top:18px}
.lead{color:#b9b3a8;max-width:1100px} .warn{color:#f0b060} code{background:#2a2633;padding:1px 5px;border-radius:3px}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;margin:10px 0}
.card{background:#211e29;border:1px solid #3a3644;border-radius:6px;padding:10px 12px}
.card h3{margin:0 0 4px;font-size:15px} .sub{color:#a9a39a;font-size:12px;margin-bottom:6px}
.card.ref{border-color:#5a6a4a} .imgs{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
img{image-rendering:pixelated;display:block} .lbl{font-size:11px;color:#8f897f;margin-top:2px}
.ok{color:#8fd08f} .bad{color:#ff8a7a} .w{color:#f0c060} .gate{font-size:12px;margin-top:6px;max-width:560px}
.sha{font-family:ui-monospace,monospace;color:#d8c48a}
.pal .sw{display:inline-block;width:18px;height:18px;margin:0 1px 1px 0;border:1px solid #000;vertical-align:middle}
.pal div{margin:2px 0;font-size:12px}
'''


def img_tag(im, k, alt=''):
    w = (im.width if not isinstance(im, dot.Cv) else im.w) * k
    return f'<img src="{b64(im, k)}" width="{w}" alt="{alt}">'


def cmd_sheet(rid, force=False):
    mod, rendered, man, res, fails = cmd_gate(rid, quiet=True)
    if fails and not force:
        for i, L, r in fails:
            print(f'FAIL {i} {L} {r["code"]}: {r["msg"]}')
        raise SystemExit('관문 FAIL 이 있어 시트를 쓰지 않는다(--force 로 강제, 사람에게 FAIL 을 같이 보인다)')
    s = seed()
    items = items_by_id()
    act = actor()
    H = [f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>던전 칩셋 {rid}</title><style>{CSS}</style></head><body>']
    H.append(f'<h1>버들항 던전 칩셋(beodeul_dungeon) — 화풍 시험 {rid}</h1>')
    H.append('<p class="lead">편집기에 던전·동굴 칩셋이 없다. 버들항(oprn-atlas) 계열로 쓸 던전 문법의 <b>화풍</b>을 먼저 고른다. '
             '항목마다 후보 A·B·C 를 <b>1배·4배</b>로, 왼쪽에 <b>버들항 던전 조각</b>과 <b>Actor1 사람 크기</b>를 같은 배율로 놓았다. '
             '각 후보 옆 장면은 같은 글자의 동굴 바닥·벽 위에 놓은 것이다(맥락). 맨 아래에 글자마다 다섯 항목을 한 장면으로 모았다.</p>')
    H.append('<p class="lead"><b>A 버들항 정통 띠</b> — 바다 동굴 그대로(어둠 + 갈색 윗면 띠 + 밝은 끝선). '
             '<b>B 바위 윗면</b> — 어둠 대신 갈라진 바위 윗면, 큰 바윗덩이 앞면, 어두운 흙. '
             '<b>C 검푸른 층리</b> — 울퉁불퉁한 돌 혹 테두리, 물결 층리 앞면, 회색 자갈.</p>')
    H.append('<p class="lead warn">기계 관문(팔레트·크기·불투명·윤곽·윗면·이음) 통과는 합격이 아니다. 감독·에이전트는 고르지 않았다. '
             '항목마다 하나를 고르거나 전부 버려 주세요. 고르기: <code>npm run harness -- dungeon-chipset pick '
             f'{rid} &lt;항목&gt; &lt;글자&gt; --sha &lt;해시 앞 8자리&gt;</code> · 버리기: <code>… reject {rid} &lt;항목&gt; &lt;글자&gt; --why "…"</code></p>')
    for item, cands in rendered.items():
        it = items[item]
        H.append(f'<h2>{item} — {it["title"]}</h2><p class="lead">{it["brief"]}<br><span class="sub">받아들일 기준: '
                 + ' · '.join(it.get('accept', [])) + f' · 통행 의도: {it.get("walk", "")}</span></p>')
        H.append('<div class="row">')
        for key in it.get('refs', []):
            rim, label = ref_image(key)
            H.append(f'<div class="card ref"><h3>버들항 기준</h3><div class="sub">{label}</div><div class="imgs">'
                     f'<div>{img_tag(rim, 1)}<div class="lbl">1배</div></div><div>{img_tag(rim, 4)}<div class="lbl">4배</div></div></div></div>')
        H.append(f'<div class="card ref"><h3>사람 크기</h3><div class="sub">Actor1 정면 24×32</div><div class="imgs">'
                 f'<div>{img_tag(act, 1)}<div class="lbl">1배</div></div><div>{img_tag(act, 4)}<div class="lbl">4배</div></div></div></div>')
        H.append('</div><div class="row">')
        for L, (im, meta) in cands.items():
            sha = man['items'][item][L]['sha256']
            rs = res[item][L]
            gl = ' '.join(f'<span class="{"ok" if r["ok"] else ("bad" if r["level"] == "FAIL" else "w")}" title="{r["msg"]}">{r["code"]}{"✓" if r["ok"] else "✗"}</span>' for r in rs)
            H.append(f'<div class="card"><h3>후보 {L} <span class="sha">{sha[:8]}</span></h3>'
                     f'<div class="sub">{mod.STYLE_NOTE[L]}</div><div class="imgs">'
                     f'<div>{img_tag(im, 1)}<div class="lbl">원본 1배</div></div><div>{img_tag(im, 4)}<div class="lbl">4배</div></div>')
            if 'vignette' in meta:
                v = meta['vignette']
                H.append(f'<div>{img_tag(v, 1)}<div class="lbl">장면 1배</div></div><div>{img_tag(v, 3)}<div class="lbl">장면 3배</div></div>')
            H.append('</div>')
            if meta.get('kind') == 'cave-set':
                fl = meta['parts']['floor']
                H.append(f'<div class="imgs" style="margin-top:6px"><div>{img_tag(dot.tiled(fl.body, 6, 6), 2)}<div class="lbl">바닥 몸통 6×6 (2배)</div></div>'
                         f'<div>{img_tag(dot.tiled(meta["parts"]["ceil"].body, 6, 6), 2)}<div class="lbl">천장 몸통 6×6</div></div>'
                         f'<div>{img_tag(_face_run(meta["parts"]["face"]), 2)}<div class="lbl">앞면 6칸 이어 붙임</div></div></div>')
            H.append(f'<div class="gate">관문 {gl}<br>' + '<br>'.join(f'{r["code"]} {r["msg"]}' for r in rs if not r['ok'] or r['code'] in 'SF') + '</div></div>')
        H.append('</div>')
    H.append('<h2>세트 장면 — 글자마다 다섯 항목을 한 곳에</h2><p class="lead">동굴 벽·바닥·물·내림 계단·벽돌 문(벽돌은 맥락)·상자·횃불·Actor1. 1배와 3배.</p><div class="row">')
    for L in 'ABC':
        sc = set_scene(mod, L)
        H.append(f'<div class="card"><h3>세트 {L}</h3><div class="sub">{mod.STYLE_NOTE[L]}</div><div class="imgs">'
                 f'<div>{img_tag(sc, 1)}<div class="lbl">1배</div></div><div>{img_tag(sc, 3)}<div class="lbl">3배</div></div></div></div>')
    H.append('</div><h2>잠금 팔레트</h2><p class="lead">버들항 변형 조각에서 램프마다 실제 화소색을 뽑았다(palette.py). 모든 색이 공용 시트에 있다.</p><div class="pal">')
    for k, v in dot.PAL['ramps'].items():
        H.append(f'<div><b>{k}</b> ' + ''.join(f'<span class="sw" style="background:{c}" title="{c}"></span>' for c in v)
                 + f' <span class="sub">{dot.PAL["sources"][k]["why"]}</span></div>')
    H.append(f'</div><p class="sub">판 {rid} · {man["at"]} · 그림 원본 {s["rounds"][rid]["module"]}</p></body></html>')
    os.makedirs(VIZ, exist_ok=True)
    out = os.path.join(VIZ, f'dungeon-{rid}.html')
    open(out, 'w', encoding='utf-8').write('\n'.join(H))
    print(f'시트 → {out}\n주소 http://mdc-server:18301/dungeon-{rid}.html (관문 FAIL {len(fails)})')


def _face_run(face):
    cv = dot.Cv(6 * 16, 32)
    for i in range(6):
        cv.a[:16, i * 16:(i + 1) * 16] = face.tile(0, i == 0, i == 5).a
        cv.a[16:, i * 16:(i + 1) * 16] = face.tile(1, i == 0, i == 5).a
    return cv


# ------------------------------------------------------------------------------------------------ 고르기·버리기·현황
def current_hash(rid, item, letter):
    mod = load_round(rid)
    if item not in mod.CANDIDATES or letter not in mod.CANDIDATES[item]:
        return None, None
    cv, _ = mod.CANDIDATES[item][letter]()
    im = cv.img()
    return dot.image_hash(im), im


def cmd_pick(rid, item, letter, sha, note):
    man_p = os.path.join(RUNS, rid, 'manifest.json')
    if not os.path.exists(man_p):
        raise SystemExit(f'판 {rid} 의 manifest 가 없다 — sheet {rid} 를 먼저(사람이 본 시트가 있어야 고를 수 있다)')
    man = json.load(open(man_p, encoding='utf-8'))
    if item not in man['items'] or letter not in man['items'][item]:
        raise SystemExit(f'{rid} 에 {item} {letter} 후보가 없다')
    shown = man['items'][item][letter]['sha256']
    if not sha or not shown.startswith(sha):
        raise SystemExit(f'--sha 가 시트에 보인 해시({shown[:8]})와 다르다 — 사람이 본 그림의 해시 앞자리를 그대로 받는다')
    cur, im = current_hash(rid, item, letter)
    if cur != shown:
        raise SystemExit(f'시트 이후 그림이 바뀌었다(시트 {shown[:12]} ≠ 현재 {str(cur)[:12]}). sheet {rid} 를 다시 만들어 다시 보여야 한다')
    os.makedirs(PICKED, exist_ok=True)
    im.save(os.path.join(PICKED, f'{item}.png'))
    L = ledger()
    L['picks'] = [p for p in L['picks'] if p['item'] != item] + [
        {'round': rid, 'item': item, 'letter': letter, 'sha256': cur, 'note': note, 'at': now(), 'by': 'user'}]
    save_ledger(L)
    print(f'고름 기록: {item} ← {rid} {letter} ({cur[:12]}) → harness-data/dungeon-chipset/picked/{item}.png')


def cmd_reject(rid, item, letter, why):
    if not why:
        raise SystemExit('--why 가 필요하다(다음 판의 「하지 말 것」이 된다)')
    cur, _ = current_hash(rid, item, letter)
    if cur is None:
        raise SystemExit(f'{rid} 에 {item} {letter} 후보가 없다')
    L = ledger()
    L['rejects'].append({'round': rid, 'item': item, 'letter': letter, 'sha256': cur, 'why': why, 'at': now(), 'by': 'user'})
    save_ledger(L)
    print(f'버림 기록: {rid} {item} {letter} ({cur[:8]}) — {why}')


def pick_state():
    out, cache = {}, {}
    for p in ledger()['picks']:
        rid = p['round']
        try:
            if rid not in cache:
                cache[rid] = render_round(rid)[1]
            c = cache[rid].get(p['item'], {}).get(p['letter'])
            cur = dot.image_hash(c[0]) if c else None
        except SystemExit:
            cur = None
        f = os.path.join(PICKED, f'{p["item"]}.png')
        fh = dot.image_hash(Image.open(f)) if os.path.exists(f) else None
        if cur != p['sha256']:
            out[p['item']] = (p, 'VOID — 판 코드의 그림이 고른 뒤 바뀌었다')
        elif fh != p['sha256']:
            out[p['item']] = (p, 'VOID — picked/ 파일이 고른 그림과 다르다')
        else:
            out[p['item']] = (p, 'current')
    return out


def cmd_status():
    s = seed()
    L = ledger()
    ps = pick_state()
    print(f'던전 칩셋 — 타일셋 {s["tileset"]["id"]} · 계열 {s["family"]} ({s["tileset"]["status"]})')
    for rid in s['rounds']:
        runs = [r for r in L['runs'] if r['round'] == rid]
        last = runs[-1] if runs else None
        print(f'판 {rid}: 그림 {"있음" if os.path.exists(os.path.join(RUNS, rid, "manifest.json")) else "없음"} · 마지막 관문 '
              + (f'{last["at"]} FAIL {last["fail"]} WARN {last["warn"]}' if last else '없음')
              + f' · 시트 {"있음" if os.path.exists(os.path.join(VIZ, f"dungeon-{rid}.html")) else "없음"}')
    waves = {}
    for it in s['items']:
        waves.setdefault(it['wave'], []).append(it)
    for w, its in waves.items():
        got = [i for i in its if i['id'] in ps and ps[i['id']][1] == 'current']
        print(f'  묶음 {w}: {len(got)}/{len(its)} 고름')
        for it in its:
            if it['id'] in ps:
                p, st = ps[it['id']]
                print(f'    {it["id"]:22} {p["round"]} {p["letter"]} {p["sha256"][:8]}  {st}')
    print(f'버림 기록 {len(L["rejects"])}건')


def cmd_list(wave=None):
    ps = pick_state()
    for it in seed()['items']:
        if wave and it['wave'] != wave:
            continue
        star = '★' if it['id'] in ps and ps[it['id']][1] == 'current' else ' '
        print(f'{star} {it["wave"]:6} {it["id"]:22} {it["size"][0]}×{it["size"][1]} {it["layer"]:5} {it["kind"]:11} {it["title"]}')


def cmd_validate():
    s = seed()
    errs = []
    ids = set()
    for it in s['items']:
        for k in ('id', 'wave', 'title', 'kind', 'size', 'layer', 'walk', 'brief', 'accept'):
            if k not in it:
                errs.append(f'{it.get("id")}: {k} 없음')
        if it['id'] in ids:
            errs.append(f'{it["id"]} 중복')
        ids.add(it['id'])
        if it.get('wave') not in s['waves']:
            errs.append(f'{it["id"]}: 모르는 묶음 {it.get("wave")}')
        if it.get('layer') not in ('lower', 'upper'):
            errs.append(f'{it["id"]}: layer 는 lower|upper')
        for r in it.get('refs', []):
            if r not in s['refs']:
                errs.append(f'{it["id"]}: 기준 그림 {r} 이 refs 에 없다')
    for k, r in s['refs'].items():
        if not os.path.exists(os.path.join(REPO, r['file'])):
            errs.append(f'기준 그림 파일 없음: {r["file"]}')
    if not os.path.exists(os.path.join(REPO, s['characters']['sheet'])):
        errs.append('Actor1 이 없다')
    if s['tileset']['family'] != 'oprn-atlas' or s['family'] != 'oprn-atlas':
        errs.append('계열은 버들항과 같은 oprn-atlas 여야 한다')
    r = subprocess.run([sys.executable, os.path.join(HERE, 'palette.py'), '--check'], capture_output=True, text=True)
    if r.returncode:
        errs.append('palette.json: ' + r.stdout.strip())
    for rid, rd in s['rounds'].items():
        try:
            mod = load_round(rid)
        except Exception as e:  # noqa: BLE001
            errs.append(f'판 {rid} 모듈 오류: {e}')
            continue
        for item in rd['items']:
            if item not in ids:
                errs.append(f'판 {rid}: 항목 {item} 이 시드에 없다')
            if item not in mod.CANDIDATES:
                errs.append(f'판 {rid}: 모듈에 {item} 후보가 없다')
        src = open(os.path.join(REPO, rd['module']), encoding='utf-8').read()
        if re.search(r"['\"]#[0-9a-fA-F]{6}['\"]", src):
            errs.append(f'판 {rid}: 후보 코드에 hex 색이 있다(팔레트 램프만 쓴다)')
    for e in errs:
        print('✗', e)
    print('시드·팔레트·판 점검: ' + ('통과' if not errs else f'{len(errs)}건'))
    return 1 if errs else 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog='dungeon-chipset')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('palette')
    p.add_argument('--check', action='store_true')
    sub.add_parser('validate')
    p = sub.add_parser('list')
    p.add_argument('--wave')
    for c in ('draw', 'gate'):
        sub.add_parser(c).add_argument('round')
    p = sub.add_parser('sheet')
    p.add_argument('round')
    p.add_argument('--force', action='store_true')
    p = sub.add_parser('pick')
    p.add_argument('round')
    p.add_argument('item')
    p.add_argument('letter')
    p.add_argument('--sha', required=True)
    p.add_argument('--note', default='')
    p = sub.add_parser('reject')
    p.add_argument('round')
    p.add_argument('item')
    p.add_argument('letter')
    p.add_argument('--why', default='')
    sub.add_parser('status')
    a = ap.parse_args(argv)
    if a.cmd == 'palette':
        return subprocess.run([sys.executable, os.path.join(HERE, 'palette.py')] + (['--check'] if a.check else [])).returncode
    if a.cmd == 'validate':
        return cmd_validate()
    if a.cmd == 'list':
        return cmd_list(a.wave) or 0
    if a.cmd == 'draw':
        cmd_draw(a.round)
        return 0
    if a.cmd == 'gate':
        return 1 if cmd_gate(a.round)[4] else 0
    if a.cmd == 'sheet':
        cmd_sheet(a.round, a.force)
        return 0
    if a.cmd == 'pick':
        cmd_pick(a.round, a.item, a.letter, a.sha, a.note)
        return 0
    if a.cmd == 'reject':
        cmd_reject(a.round, a.item, a.letter, a.why)
        return 0
    if a.cmd == 'status':
        cmd_status()
        return 0
    return 2


if __name__ == '__main__':
    sys.exit(main())
