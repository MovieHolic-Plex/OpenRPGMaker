"""murim-chipset 하네스 본체. `npm run harness -- murim-chipset <단계>` 또는 `python3 src/harnesses/murim-chipset/harness.py <단계>`.

  validate                         시드·팔레트·판 모듈 점검
  palette                          잠금 팔레트 보고(단마다 밝기 vs joseon_baram 범위, 가장 가까운 조선 램프)
  list [--wave W]                  시드 항목(★ = 사람이 고른 것, 현재 그림과 해시가 맞을 때만)
  draw <판>                        판의 후보를 그려 qa-runs/harnesses/murim-chipset/<판>/ 에 PNG·manifest.json
  gate <판>                        draw + 기계 관문(P Z Q O F S R / WARN T L N). FAIL 이 있으면 종료코드 1
  sheet <판> [--force]             draw + gate + ~/claude-viz/murim-<판>.html (FAIL 이 있으면 --force 없이는 안 쓴다)
  pick <판> <항목> <글자> [--note]  사람이 고른 후보를 해시에 묶어 기록, picked/<항목>.png 로 복사
  reject <판> <항목> <글자> --why   사람이 버린 후보와 이유
  status                           판·관문·고른 것(현재 그림 해시와 맞는지) 현황

감독·에이전트는 pick 을 스스로 부르지 않는다. 사람이 고른 글자를 받아 적을 때만 쓴다.
"""
import argparse
import base64
import datetime
import importlib.util
import io
import json
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

import gate as G  # noqa: E402
import tk  # noqa: E402

REPO = tk.REPO
DATA = tk.DATA
RUNS = os.path.join(REPO, 'qa-runs', 'harnesses', 'murim-chipset')
VIZ = os.path.expanduser('~/claude-viz')
LEDGER = os.path.join(DATA, 'ledger.json')
PICKED = os.path.join(DATA, 'picked')
JOSEON_PALETTE = os.path.join(REPO, 'scripts', 'content', 'lib', 'joseon', 'harness', 'palette.json')
LETTERS = 'ABCDE'


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
    json.dump(L, open(LEDGER, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(LEDGER, 'a').write('\n')


def load_round(rid):
    s = seed()
    if rid not in s['rounds']:
        raise SystemExit(f'모르는 판: {rid}. 시드 rounds: {", ".join(s["rounds"])}')
    path = os.path.join(REPO, s['rounds'][rid]['module'])
    sys.path.insert(0, os.path.dirname(path))
    spec = importlib.util.spec_from_file_location(f'murim_round_{rid.replace("-", "_")}', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def render_round(rid):
    """판 모듈의 후보를 전부 그린다. {항목: {글자: (PIL, meta)}}"""
    mod = load_round(rid)
    out = {}
    for item, cands in mod.CANDIDATES.items():
        out[item] = {}
        for letter, fn in cands.items():
            cv, meta = fn()
            out[item][letter] = (cv.img(), meta or {})
    return mod, out


def cmd_draw(rid, quiet=False):
    mod, rendered = render_round(rid)
    base = os.path.join(RUNS, rid)
    os.makedirs(base, exist_ok=True)
    man = {'round': rid, 'wave': getattr(mod, 'WAVE', None), 'at': now(), 'items': {}}
    for item, cands in rendered.items():
        d = os.path.join(base, item)
        os.makedirs(d, exist_ok=True)
        man['items'][item] = {}
        for letter, (im, meta) in cands.items():
            im.save(os.path.join(d, f'{letter}.png'))
            im.resize((im.width * 8, im.height * 8), Image.NEAREST).save(os.path.join(d, f'{letter}-x8.png'))
            man['items'][item][letter] = {'sha256': tk.image_hash(im), 'size': [im.width, im.height],
                                          'note': meta.get('note', ''), 'top': meta.get('top')}
    json.dump(man, open(os.path.join(base, 'manifest.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    if not quiet:
        n = sum(len(v) for v in man['items'].values())
        print(f'{rid}: 항목 {len(man["items"])} · 후보 {n} → {os.path.relpath(base, REPO)}/')
    return mod, rendered, man


def run_gate(rid, rendered):
    items = items_by_id()
    res = {}
    for item, cands in rendered.items():
        if item not in items:
            raise SystemExit(f'판 {rid} 의 항목 {item} 이 시드에 없다')
        rc = G.check_recolor({L: im for L, (im, _) in cands.items()})
        res[item] = {}
        for letter, (im, meta) in cands.items():
            res[item][letter] = G.check_one(items[item], im, meta) + [rc[letter]]
    return res


def gate_summary(res):
    fails = [(i, L, r) for i, c in res.items() for L, rs in c.items() for r in rs if r['level'] == 'FAIL' and not r['ok']]
    warns = [(i, L, r) for i, c in res.items() for L, rs in c.items() for r in rs if r['level'] == 'WARN' and not r['ok']]
    return fails, warns


def cmd_gate(rid, quiet=False):
    mod, rendered, man = cmd_draw(rid, quiet=True)
    res = run_gate(rid, rendered)
    json.dump(res, open(os.path.join(RUNS, rid, 'gate.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    fails, warns = gate_summary(res)
    if not quiet:
        for item, cands in res.items():
            for letter, rs in cands.items():
                marks = ' '.join(f"{r['code']}{'✓' if r['ok'] else ('✗' if r['level'] == 'FAIL' else '!')}" for r in rs)
                print(f'{item:22} {letter}  {marks}')
        for i, L, r in fails:
            print(f'  FAIL {i} {L} {r["code"]}: {r["msg"]}')
        for i, L, r in warns:
            print(f'  WARN {i} {L} {r["code"]}: {r["msg"]}')
        print(f'관문: FAIL {len(fails)} · WARN {len(warns)} — 통과는 합격이 아니다(시점·화풍은 사람이 본다)')
    L = ledger()
    L['runs'].append({'at': now(), 'stage': 'gate', 'round': rid, 'fail': len(fails), 'warn': len(warns),
                      'hashes': {i: {k: v['sha256'] for k, v in c.items()} for i, c in man['items'].items()}})
    save_ledger(L)
    return mod, rendered, man, res, fails


# ---------------------------------------------------------------------------- 시트
def b64(im, k=1):
    if k != 1:
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


def joseon_ref(ref):
    sheet = Image.open(os.path.join(REPO, ref['sheet'])).convert('RGBA')
    pieces = json.load(open(os.path.join(REPO, ref['pieces']), encoding='utf-8'))
    p = pieces['pieces'][ref['piece']]
    cols = pieces['cols']
    i = p['id']
    w, h = ref.get('w', p.get('w', 1)), ref.get('h', p.get('h', 1))
    x, y = (i % cols) * 16, (i // cols) * 16
    return sheet.crop((x, y, x + w * 16, y + h * 16))


def actor1():
    s = seed()['characters']
    sh = Image.open(os.path.join(REPO, s['sheet'])).convert('RGBA')
    fw, fh = s['frame']
    fr = sh.crop((fw * 1, fh * 2, fw * 2, fh * 3))  # 첫 캐릭터 · 정면 줄 · 가운데 프레임
    key = sh.getpixel((0, 0))[:3]
    px = fr.load()
    for yy in range(fr.height):
        for xx in range(fr.width):
            if px[xx, yy][:3] == key:
                px[xx, yy] = (0, 0, 0, 0)
    return fr


def tiled(im, nx, ny):
    t = Image.new('RGBA', (im.width * nx, im.height * ny))
    for i in range(nx):
        for j in range(ny):
            t.paste(im, (i * im.width, j * im.height))
    return t


def vignettes(rendered, letter):
    """후보 글자 하나로 6×5 칸(96×80) 장면 두 장: 바깥(지붕·벽·돌바닥·목인장) / 안(벽·마루·탁자). 사람은 Actor1."""
    def get(item):
        c = rendered.get(item, {})
        return c[letter][0] if letter in c else None
    act = actor1()
    out = {}
    roof, wall, stone, dummy = get('roof_tile_eave'), get('inn_wall_pillar'), get('yard_floor_stone'), get('training_dummy')
    if roof and wall and stone:
        v = Image.new('RGBA', (96, 80), (0, 0, 0, 255))
        for x in (0, 48):
            v.paste(roof, (x, 0))
            v.paste(wall, (x, 32))
        st = tiled(stone, 3, 1).crop((0, 0, 96, 16))
        v.paste(st, (0, 64))
        if dummy:
            v.alpha_composite(dummy, (10, 48))
        v.alpha_composite(act, (60, 47))
        out['바깥'] = v
    wood, table = get('inn_floor_wood'), get('round_table_stools')
    if wall and wood:
        v = Image.new('RGBA', (96, 80), (0, 0, 0, 255))
        for x in (0, 48):
            v.paste(wall, (x, 0))
        v.paste(tiled(wood, 3, 2).crop((0, 0, 96, 48)), (0, 32))
        if table:
            v.alpha_composite(table, (12, 38))
        v.alpha_composite(act, (62, 42))
        out['안'] = v
    return out


def joseon_scene():
    """조선 객잔 지도 한 자락(같은 6×5 칸) — 같은 게임에 놓였을 때의 밝기·대비 기준."""
    p = os.path.join(REPO, 'tiledata', 'joseon-interior', 'joseon_in_inn', 'joseon_in_inn-map-people.png')
    if not os.path.exists(p):
        return None
    im = Image.open(p).convert('RGBA')
    return im.crop((128, 16, 224, 96))


CSS = """
body{background:#1e1f22;color:#e6e2da;font:14px/1.5 'Noto Sans KR','Nanum Gothic',sans-serif;margin:0;padding:18px 24px 80px}
h1{font-size:20px;margin:0 0 6px} h2{font-size:17px;margin:34px 0 4px;border-top:1px solid #444;padding-top:16px}
.lead{color:#bdb6a8;max-width:1100px} .warn{color:#ffcf7a}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start;margin-top:10px}
.card{background:#2a2b2f;border:1px solid #3c3d42;border-radius:6px;padding:8px 10px;min-width:120px}
.card.ref{background:#26292a;border-color:#3d4a44}
.card h3{font-size:14px;margin:0 0 6px} .card .sub{color:#a9a294;font-size:12px;max-width:340px}
.imgs{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
.imgs figure{margin:0;text-align:center;font-size:11px;color:#8e877c}
.imgs img{image-rendering:pixelated;display:block;background:repeating-conic-gradient(#3a3a3a 0 25%,#454545 0 50%) 0 0/16px 16px}
.badges{margin:6px 0 4px;display:flex;flex-wrap:wrap;gap:4px}
.b{font:12px monospace;padding:1px 5px;border-radius:3px;background:#2f4a35;color:#bfe3c4;cursor:help}
.b.w{background:#5a4a20;color:#ffe2a0} .b.f{background:#6a2626;color:#ffc4c4}
button{background:#3b3d44;color:#e6e2da;border:1px solid #555;border-radius:4px;padding:3px 8px;font-size:12px;cursor:pointer;margin:2px 4px 0 0}
button:hover{background:#4a4d56}
.crit{color:#bdb6a8;font-size:13px;margin:4px 0 0 0;padding-left:18px}
.pal{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
.ramp{display:flex;align-items:center;gap:0;font-size:11px;color:#a9a294}
.ramp span.sw{width:16px;height:16px;display:inline-block}
.ramp b{width:120px;font-weight:normal;margin-right:4px}
code{background:#2a2b2f;padding:1px 4px;border-radius:3px}
#toast{position:fixed;bottom:16px;right:16px;background:#2f4a35;color:#dfffe4;padding:8px 12px;border-radius:6px;display:none}
"""


def cmd_sheet(rid, force=False):
    mod, rendered, man, res, fails = cmd_gate(rid, quiet=True)
    if fails and not force:
        for i, L, r in fails:
            print(f'  FAIL {i} {L} {r["code"]}: {r["msg"]}')
        raise SystemExit(f'관문 FAIL {len(fails)} — 고친 뒤 다시(--force 는 사람에게 실패를 보여 줄 때만)')
    s = seed()
    items = items_by_id()
    act = actor1()
    L = ledger()
    picks = {(p['round'], p['item']): p for p in L['picks']}
    pal = tk.PAL
    H = []
    H.append(f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>무림 칩셋 {rid}</title><style>{CSS}</style></head><body>')
    H.append(f'<h1>무림 칩셋(murim_wuxia) 스타일 시험 — {rid}</h1>')
    H.append('<p class="lead">항목마다 후보 A·B·C 를 <b>1배와 4배</b>로, 왼쪽에 <b>조선(joseon_baram) 같은 용도 조각</b>과 <b>Actor1 사람 크기</b>를 같은 배율로 놓았다. '
             '반복 타일은 3×3 으로 이어 붙인 것도 함께 보인다. 맨 아래에 후보 글자별 6×5 칸 장면이 있다.</p>')
    H.append('<p class="lead warn">고르는 것은 사람이다. 기계 관문(초록 배지)은 깨진 그림만 거르는 것이고 <b>통과가 합격이 아니다</b> — 3/4 시점(윗면이 보이고 옆면이 없는지)·화풍·조선 옆 어울림은 눈으로 판단한다. '
             '버튼은 명령을 복사만 한다. 고른 글자를 알려 주면 그대로 기록한다(고른 기록은 그림 해시에 묶여, 그림이 바뀌면 무효).</p>')
    H.append(f'<p class="lead">만든 때 {man["at"]} · 관문 FAIL {len(fails)} · 판 모듈 <code>{s["rounds"][rid]["module"]}</code></p>')
    # 팔레트
    H.append('<h2>잠긴 팔레트 (램프 7단, 어두움 → 밝음)</h2><div class="pal">')
    for name, ramp in pal['ramps'].items():
        sw = ''.join(f'<span class="sw" style="background:{c}" title="{c}"></span>' for c in ramp)
        H.append(f'<div class="ramp"><b>{name} · {pal["rampNames"].get(name, "")}</b>{sw}</div>')
    H.append(f'<div class="ramp"><b>ink · 먹 윤곽</b><span class="sw" style="background:{pal["ink"]}"></span></div>')
    for name, ramp in pal['shared'].items():
        sw = ''.join(f'<span class="sw" style="background:{c}"></span>' for c in ramp)
        H.append(f'<div class="ramp"><b>{name} · 조선 잎 램프 공유</b>{sw}</div>')
    H.append('</div>')

    def badge(r):
        cls = '' if r['ok'] else (' f' if r['level'] == 'FAIL' else ' w')
        mark = '✓' if r['ok'] else ('✗' if r['level'] == 'FAIL' else '!')
        return f'<span class="b{cls}" title="{r["msg"]}">{r["code"]}{mark}</span>'

    for item, cands in rendered.items():
        it = items[item]
        tiles = f'{it["size"][0]}×{it["size"][1]}칸'
        H.append(f'<h2>{it["title"]} <span style="color:#8e877c;font-size:13px">({item} · {tiles} · {it["layer"]}{" · 반복 " + it["tileable"] if it.get("tileable") else ""})</span></h2>')
        H.append(f'<div class="lead">{it["brief"]}</div><ul class="crit">' + ''.join(f'<li>{c}</li>' for c in it['criteria']) + '</ul>')
        H.append('<div class="row">')
        if it.get('joseonRef'):
            try:
                ref = joseon_ref(it['joseonRef'])
                H.append(f'<div class="card ref"><h3>조선 기준</h3><div class="sub">{it["joseonRef"]["label"]}</div><div class="imgs">'
                         f'<figure><img src="{b64(ref)}"><figcaption>1×</figcaption></figure>'
                         f'<figure><img src="{b64(ref, 4)}"><figcaption>4×</figcaption></figure></div></div>')
            except Exception as e:  # 기준 조각을 못 읽어도 시트는 만든다
                H.append(f'<div class="card ref"><h3>조선 기준</h3><div class="sub warn">읽기 실패: {e}</div></div>')
        H.append(f'<div class="card ref"><h3>사람 크기</h3><div class="sub">Actor1 정면(24×32)</div><div class="imgs">'
                 f'<figure><img src="{b64(act)}"><figcaption>1×</figcaption></figure>'
                 f'<figure><img src="{b64(act, 4)}"><figcaption>4×</figcaption></figure></div></div>')
        for letter, (im, meta) in cands.items():
            rs = res[item][letter]
            p = picks.get((rid, item))
            star = ' ★ 고름' if p and p['letter'] == letter else ''
            H.append(f'<div class="card"><h3>후보 {letter}{star}</h3><div class="sub">{meta.get("note", "")}</div>')
            H.append('<div class="badges">' + ''.join(badge(r) for r in rs) + '</div><div class="imgs">')
            H.append(f'<figure><img src="{b64(im)}"><figcaption>1×</figcaption></figure>')
            H.append(f'<figure><img src="{b64(im, 4)}"><figcaption>4×</figcaption></figure>')
            if it.get('tileable'):
                nx = 3
                ny = 3 if 'y' in it['tileable'] else 1
                H.append(f'<figure><img src="{b64(tiled(im, nx, ny), 2)}"><figcaption>{nx}×{ny} 이어 붙임 2×</figcaption></figure>')
            H.append('</div>')
            pick_cmd = f'npm run harness -- murim-chipset pick {rid} {item} {letter}'
            rej_cmd = f'npm run harness -- murim-chipset reject {rid} {item} {letter} --why "…"'
            H.append(f'<button data-cmd=\'{pick_cmd}\'>고르기 명령 복사</button><button data-cmd=\'{rej_cmd}\'>버리기 명령 복사</button>')
            H.append(f'<div class="sub" style="font:11px monospace;color:#6f6a60">{man["items"][item][letter]["sha256"][:16]}</div></div>')
        H.append('</div>')

    H.append('<h2>장면 6×5 칸 (후보 글자별, 3배)</h2><p class="lead">같은 글자끼리 묶은 장면이다. 항목마다 다른 글자를 골라도 된다. 맨 왼쪽은 조선 객잔 지도의 같은 크기 자락(밝기·대비 기준).</p><div class="row">')
    js = joseon_scene()
    if js:
        H.append(f'<div class="card ref"><h3>조선 객잔(기준)</h3><div class="imgs"><figure><img src="{b64(js, 3)}"><figcaption>joseon_in_inn 자락</figcaption></figure></div></div>')
    letters = sorted({L for c in rendered.values() for L in c})
    for letter in letters:
        vs = vignettes(rendered, letter)
        H.append(f'<div class="card"><h3>{letter} 묶음</h3><div class="imgs">' +
                 ''.join(f'<figure><img src="{b64(v, 3)}"><figcaption>{k}</figcaption></figure>' for k, v in vs.items()) + '</div></div>')
    H.append('</div>')
    H.append('<div id="toast">복사했다</div><script>document.querySelectorAll("button[data-cmd]").forEach(b=>b.onclick=()=>{const t=b.dataset.cmd;'
             '(navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).catch(()=>{const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove();})'
             '.finally(()=>{const e=document.getElementById("toast");e.textContent="복사: "+t;e.style.display="block";setTimeout(()=>e.style.display="none",2200);});});</script>')
    H.append('</body></html>')
    os.makedirs(VIZ, exist_ok=True)
    out = os.path.join(VIZ, f'murim-{rid}.html')
    open(out, 'w', encoding='utf-8').write('\n'.join(H))
    print(f'시트 → {out}\n주소 http://mdc-server:18301/murim-{rid}.html (관문 FAIL {len(fails)})')


# ---------------------------------------------------------------------------- 고르기·버리기·현황
def current_hash(rid, item, letter):
    _, rendered = render_round(rid)
    if item not in rendered or letter not in rendered[item]:
        return None, None
    im = rendered[item][letter][0]
    return tk.image_hash(im), im


def cmd_pick(rid, item, letter, note):
    man_p = os.path.join(RUNS, rid, 'manifest.json')
    if not os.path.exists(man_p):
        raise SystemExit(f'판 {rid} 의 manifest 가 없다 — sheet {rid} 를 먼저(사람이 본 시트가 있어야 고를 수 있다)')
    man = json.load(open(man_p, encoding='utf-8'))
    if item not in man['items'] or letter not in man['items'][item]:
        raise SystemExit(f'{rid} 에 {item} {letter} 후보가 없다')
    shown = man['items'][item][letter]['sha256']
    cur, im = current_hash(rid, item, letter)
    if cur != shown:
        raise SystemExit(f'시트 이후 그림이 바뀌었다(시트 {shown[:12]} ≠ 현재 {str(cur)[:12]}). sheet {rid} 를 다시 만들어 사람에게 다시 보여야 한다')
    os.makedirs(PICKED, exist_ok=True)
    im.save(os.path.join(PICKED, f'{item}.png'))
    L = ledger()
    L['picks'] = [p for p in L['picks'] if not (p['item'] == item)] + [
        {'round': rid, 'item': item, 'letter': letter, 'sha256': cur, 'note': note, 'at': now(), 'by': 'user'}]
    save_ledger(L)
    print(f'고름 기록: {item} ← {rid} {letter} ({cur[:12]}) → harness-data/murim-chipset/picked/{item}.png')


def cmd_reject(rid, item, letter, why):
    if not why:
        raise SystemExit('--why 가 필요하다(다음 판의 「하지 말 것」이 된다)')
    cur, _ = current_hash(rid, item, letter)
    L = ledger()
    L['rejects'].append({'round': rid, 'item': item, 'letter': letter, 'sha256': cur, 'why': why, 'at': now(), 'by': 'user'})
    save_ledger(L)
    print(f'버림 기록: {rid} {item} {letter} — {why}')


def pick_state():
    """고른 것마다 현재 그림 해시와 맞는지. {항목: (pick, 'current'|'VOID 사유')}"""
    L = ledger()
    out = {}
    cache = {}
    for p in L['picks']:
        rid = p['round']
        try:
            if rid not in cache:
                cache[rid] = render_round(rid)[1]
            c = cache[rid].get(p['item'], {}).get(p['letter'])
            cur = tk.image_hash(c[0]) if c else None
        except SystemExit:
            cur = None
        f = os.path.join(PICKED, f'{p["item"]}.png')
        file_hash = tk.image_hash(Image.open(f)) if os.path.exists(f) else None
        if cur != p['sha256']:
            out[p['item']] = (p, 'VOID — 판 코드의 그림이 고른 뒤 바뀌었다')
        elif file_hash != p['sha256']:
            out[p['item']] = (p, 'VOID — picked/ 파일이 고른 그림과 다르다')
        else:
            out[p['item']] = (p, 'current')
    return out


def cmd_status():
    s = seed()
    L = ledger()
    ps = pick_state()
    print(f'무림 칩셋 — 계열 {s["family"]} · 타일셋 {s["tileset"]["id"]} ({s["tileset"]["status"]}, 번들에 굽지 않음)')
    for rid in s['rounds']:
        runs = [r for r in L['runs'] if r['round'] == rid]
        last = runs[-1] if runs else None
        man = os.path.join(RUNS, rid, 'manifest.json')
        print(f'판 {rid}: 그림 {"있음" if os.path.exists(man) else "없음"} · 마지막 관문 '
              + (f'{last["at"]} FAIL {last["fail"]} WARN {last["warn"]}' if last else '없음')
              + f' · 시트 {"있음" if os.path.exists(os.path.join(VIZ, f"murim-{rid}.html")) else "없음"}')
    by_wave = {}
    for it in s['items']:
        by_wave.setdefault(it['wave'], []).append(it)
    for w, its in by_wave.items():
        got = [i for i in its if i['id'] in ps and ps[i['id']][1] == 'current']
        print(f'  묶음 {w}: {len(got)}/{len(its)} 고름')
        for it in its:
            if it['id'] in ps:
                p, st = ps[it['id']]
                print(f'    {it["id"]:22} {p["round"]} {p["letter"]}  {st}')
    print(f'버림 기록 {len(L["rejects"])}건')


def cmd_list(wave=None):
    ps = pick_state()
    for it in seed()['items']:
        if wave and it['wave'] != wave:
            continue
        mark = '★' if it['id'] in ps and ps[it['id']][1] == 'current' else ' '
        print(f'{mark} {it["wave"]:8} {it["id"]:22} {it["size"][0]}×{it["size"][1]} {it["kind"]:6} {it["title"]}')


def cmd_palette():
    rep = G.palette_report(JOSEON_PALETTE)
    print('단:          ' + ' '.join(f'{t:>5}' for t in range(7)))
    print('조선 범위 하: ' + ' '.join(f'{a:5.2f}' for a, b in rep['envelope']))
    print('조선 범위 상: ' + ' '.join(f'{b:5.2f}' for a, b in rep['envelope']))
    for name, r in rep['ramps'].items():
        flag = '' if not r['outOfEnvelope'] and r['monotone'] else '  ✗'
        print(f'{name:6} {tk.PAL["rampNames"].get(name, ""):14} ' + ' '.join(f'{l:5.2f}' for l in r['luma'])
              + f'   가까운 조선 램프 {r["nearestJoseon"]} (거리 {r["midDistance"]}){flag}')
    print('허용 색', len(tk.PAL['allowed']), '· ink', tk.PAL['ink'], '· 그림자 alpha', tk.PAL['shadow']['alpha'])
    for f in rep['fail']:
        print('  FAIL', f)
    return 1 if rep['fail'] else 0


def cmd_validate():
    errs = []
    s = seed()
    if s.get('version') != 1:
        errs.append('version 은 1')
    if s.get('family') != 'oprn-murim' or s.get('tileset', {}).get('id') != 'murim_wuxia':
        errs.append('family=oprn-murim, tileset.id=murim_wuxia 여야 한다')
    ids = set()
    for it in s['items']:
        i = it.get('id')
        if i in ids:
            errs.append(f'항목 id 중복 {i}')
        ids.add(i)
        if it.get('wave') not in s['waves']:
            errs.append(f'{i}: wave {it.get("wave")} 가 waves 에 없다')
        if it.get('kind') not in s['kinds']:
            errs.append(f'{i}: kind {it.get("kind")}')
        if it.get('layer') not in s['layers']:
            errs.append(f'{i}: layer {it.get("layer")}')
        sz = it.get('size')
        if not (isinstance(sz, list) and len(sz) == 2 and all(isinstance(v, int) and v > 0 for v in sz)):
            errs.append(f'{i}: size 는 [칸w, 칸h]')
        if it.get('tileable') not in (None, 'x', 'y', 'xy'):
            errs.append(f'{i}: tileable 은 x|y|xy')
        if not it.get('brief') or not it.get('criteria'):
            errs.append(f'{i}: brief·criteria 필수')
        ref = it.get('joseonRef')
        if ref:
            for k in ('sheet', 'pieces'):
                if not os.path.exists(os.path.join(REPO, ref[k])):
                    errs.append(f'{i}: joseonRef.{k} 파일 없음 {ref[k]}')
    for w in s['waves']:
        if not any(it['wave'] == w for it in s['items']):
            errs.append(f'묶음 {w} 에 항목이 없다')
    if not os.path.exists(os.path.join(REPO, s['characters']['sheet'])) or 'Actor1' not in s['characters']['sheet']:
        errs.append('characters.sheet 는 있는 Actor1 이어야 한다')
    for f in ('generated-images', 'people', 'side-faces', 'supervisor-pick', 'bake'):
        if f not in {x['id'] for x in s['forbidden']}:
            errs.append(f'forbidden 에 {f} 가 없다')
    for rid, r in s['rounds'].items():
        if not os.path.exists(os.path.join(REPO, r['module'])):
            errs.append(f'판 {rid}: 모듈 없음 {r["module"]}')
            continue
        mod = load_round(rid)
        for item, cands in mod.CANDIDATES.items():
            if item not in ids:
                errs.append(f'판 {rid}: 항목 {item} 이 시드에 없다')
            if not set(cands) <= set(LETTERS) or len(cands) < 2:
                errs.append(f'판 {rid} {item}: 후보 글자는 A~E, 2개 이상')
            if mod.WAVE != r['wave']:
                errs.append(f'판 {rid}: 모듈 WAVE {mod.WAVE} ≠ 시드 {r["wave"]}')
    rep = G.palette_report(JOSEON_PALETTE)
    errs += [f'팔레트: {f}' for f in rep['fail']]
    for e in errs:
        print('✗', e)
    print(f'시드 항목 {len(ids)} · 묶음 {len(s["waves"])} · 판 {len(s["rounds"])} — ' + ('통과' if not errs else f'오류 {len(errs)}'))
    return 1 if errs else 0


def main(argv=None):
    ap = argparse.ArgumentParser(prog='murim-chipset')
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('validate')
    sub.add_parser('palette')
    p = sub.add_parser('list'); p.add_argument('--wave')
    p = sub.add_parser('draw'); p.add_argument('round')
    p = sub.add_parser('gate'); p.add_argument('round')
    p = sub.add_parser('sheet'); p.add_argument('round'); p.add_argument('--force', action='store_true')
    p = sub.add_parser('pick'); p.add_argument('round'); p.add_argument('item'); p.add_argument('letter'); p.add_argument('--note', default='')
    p = sub.add_parser('reject'); p.add_argument('round'); p.add_argument('item'); p.add_argument('letter'); p.add_argument('--why', default='')
    sub.add_parser('status')
    a = ap.parse_args(argv)
    if a.cmd == 'validate':
        return cmd_validate()
    if a.cmd == 'palette':
        return cmd_palette()
    if a.cmd == 'list':
        cmd_list(a.wave); return 0
    if a.cmd == 'draw':
        cmd_draw(a.round); return 0
    if a.cmd == 'gate':
        return 1 if cmd_gate(a.round)[4] else 0
    if a.cmd == 'sheet':
        cmd_sheet(a.round, a.force); return 0
    if a.cmd == 'pick':
        cmd_pick(a.round, a.item, a.letter.upper(), a.note); return 0
    if a.cmd == 'reject':
        cmd_reject(a.round, a.item, a.letter.upper(), a.why); return 0
    if a.cmd == 'status':
        cmd_status(); return 0
    return 2


if __name__ == '__main__':
    sys.exit(main())
