"""dungeon-chipset 하네스 본체. `npm run harness -- dungeon-chipset <단계>` 또는 `python3 src/harnesses/dungeon-chipset/harness.py <단계>`.

  palette [--check]                 버들항 그림에서 잠금 팔레트를 다시 뽑는다(--check 는 비교만)
  validate                          시드·팔레트·판 모듈·줄·기준 그림·Actor1 점검
  list [--wave W]                   시드 항목. 줄마다 ★A = 줄 A 에서 사람이 고름(현재 그림과 해시가 맞을 때만) · -A = 줄 A 에서 뺀 항목
  draw <판>                         판 후보를 그려 qa-runs/harnesses/dungeon-chipset/<판>/ 에 PNG·manifest.json
  gate <판>                         draw + 기계 관문(P Z Q F S G A K J / WARN R OUTLINE CONTRAST). FAIL 이 있으면 종료코드 1
  sheet <판> [--force]              draw + gate + ~/claude-viz/dungeon-<판>.html (FAIL 이면 --force 없이는 안 쓴다)
  pick <판> <항목> <후보> --sha <앞 8자리> [--note …]   사람이 시트에서 고른 후보를 그림 해시에 묶어 기록
  reject <판> <항목> <후보> --why …   사람이 버린 후보와 이유
  status                            판·관문·시트, 줄별·묶음별 고른 것(현재 그림과 해시가 맞는지) + 외곽선 규칙 경고·굽기 전에 다듬을 목록

줄(line) — 던전은 컨셉이 여럿이라 화풍을 하나로 고정하지 않는다(사용자 2026-10-08). 시드 `lines` 의 줄마다 따로 고른다.
  - 화풍 판(style-r1)의 후보 글자 A·B·C 가 곧 줄이다. 줄의 화풍 기준 = style-r1 의 그 글자 조각(색·결 — 윤곽은 아래 외곽선 규칙이 우선).
  - 이후 판은 **줄마다** 후보를 그린다. 후보 키는 `<줄><번호>`(A1 A2 B1 …), pick 은 앞 글자로 줄을 안다.
  - 고르기 단위는 (항목, 줄). 고른 그림은 picked/<줄>/<항목>.png. 같은 (항목, 줄)을 다시 고르면 앞 기록을 바꾼다.
  - 줄 컨셉에 안 맞는 항목은 그 줄에서 빼도 된다 — 시드 lines.<줄>.skip 에 항목과 이유를 적는다(그 줄 후보를 그리지 않는다).

외곽선 규칙(사용자 2026-10-08, seed rules.outline — 시연 http://mdc-server:18301/outline-before-after.html):
  - 지형(바닥·벽면·천장·물·용암)과 기물(상자·석순·잔돌·문…) 모두 **먹 윤곽 없이** 재질 자신의 명암으로 형태를 읽게 한다.
    빛 받는 위·왼 가장자리 = 그 재질의 밝은 단, 그늘 아래·오른 = 그 재질의 어두운 단. 사람만 외곽선(Actor1 그대로, 그리지 않는다).
  - 예외: 바닥과 밝기가 비슷한 작은 기물(1~2칸: 석순·잔돌)은 그늘 쪽만 그 재질의 가장 어두운 단 + 바닥 닿는 곳 접지 그림자를 진하게. 그래도 먹은 아니다.
  - 큰 구조(벽 덩어리·절벽·다리)도 바깥 실루엣은 재질 어두운 단이지 먹이 아니다.
  - 먹 = 밝기 ≤ 0.12(void 전부·brick·crock·vrock 0단). 던전 팔레트에는 따로 된 ink 가 없다. 천장·낭떠러지의 어둠은 재질이라 윤곽이 아니다.
  - 관문 OUTLINE·CONTRAST 는 WARN 이다(고른 것만 굽기 전에 다듬을 목록, status). 이미 그린 판의 그림은 사람이 고르는 중이라 고치지 않는다.

감독·에이전트는 pick/reject 를 스스로 부르지 않는다. 사람이 고른 후보와 시트에 적힌 해시 앞자리를 받아 적을 때만 쓴다.
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


def lines():
    """시드 줄 {id: {name, concept, origin, skip}} — 줄 id 는 대문자 한 글자(화풍 판 후보 글자)."""
    return {k: v for k, v in seed().get('lines', {}).items() if isinstance(v, dict)}   # 'note' 는 설명


def line_of(key):
    """후보 키 → 줄. 화풍 판은 글자 그대로(A), 이후 판은 <줄><번호>(A1)."""
    if key and key[0] in lines() and (len(key) == 1 or key[1:].isdigit()):
        return key[0]
    return None


def skipped(line, item):
    return lines().get(line, {}).get('skip', {}).get(item)


def pick_line(p):
    return p.get('line') or line_of(p['letter'])


def picked_path(line, item):
    return os.path.join(PICKED, line, f'{item}.png')


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


_LINE_FLOOR = {}


def line_floor(ln):
    """CONTRAST 의 줄 대표 바닥 = 기원 판(style-r1)의 그 글자 동굴 바닥 몸통(16×16 RGBA 배열). 없으면 None."""
    if ln not in _LINE_FLOOR:
        o = lines().get(ln, {}).get('origin', {})
        try:
            mod = load_round(o['round'])
            _LINE_FLOOR[ln] = mod.CANDIDATES['style.cave'][o['letter']]()[1]['parts']['floor'].body.a
        except (KeyError, SystemExit):
            _LINE_FLOOR[ln] = None
    return _LINE_FLOOR[ln]


def run_gate(rendered):
    items = items_by_id()
    res = {}
    for item, cands in rendered.items():
        if item not in items:
            raise SystemExit(f'판의 항목 {item} 이 시드에 없다')
        rc = G.check_recolor({L: im for L, (im, _) in cands.items()})
        res[item] = {}
        for L, (im, meta) in cands.items():
            rs = G.check_one(items[item], im, meta) + [rc[L]]
            ct = G.check_contrast(meta, line_floor(line_of(L)) if line_of(L) else None)
            res[item][L] = rs + ([ct] if ct else [])
    return res


POLISH_CODES = ('OUTLINE', 'CONTRAST')   # 외곽선 규칙(seed rules.outline) 경고 — 고른 것만 굽기 전에 다듬을 목록


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
    by_code = {}
    for _, _, r in warns:
        by_code[r['code']] = by_code.get(r['code'], 0) + 1
    polish = [{'item': i, 'key': K, 'code': r['code'], 'msg': r['msg']} for i, K, r in warns if r['code'] in POLISH_CODES]
    if not quiet:
        print(f'외곽선 규칙 경고(굽기 전에 다듬을 것): OUTLINE {by_code.get("OUTLINE", 0)} · CONTRAST {by_code.get("CONTRAST", 0)}')
    L = ledger()
    L['runs'].append({'round': rid, 'at': now(), 'fail': len(fails), 'warn': len(warns), 'warnByCode': by_code, 'polish': polish,
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
.star{color:#ffd24a;font-weight:700} .card.picked{border-color:#c9a227;box-shadow:0 0 0 1px #c9a227}
.lineh{font-weight:700;color:#d9cfa8;margin:14px 0 2px}
'''


def gif_b64(frames, k=1, ms=333):
    """움직이는 장면(3fps = 편집기 animationStrips 기본) → GIF data URI. 색은 그대로 옮긴다(팔레트 양자화 없음)."""
    import numpy as np
    bg = np.array([0x21, 0x1e, 0x29], float)
    rgbs = []
    for f in frames:
        a = (f.a if isinstance(f, dot.Cv) else np.array(f.convert('RGBA'))).astype(float)
        al = a[:, :, 3:4] / 255.0
        rgbs.append((a[:, :, :3] * al + bg * (1 - al)).round().astype(np.uint8))
    packed = [(r[:, :, 0].astype(np.int64) << 16) | (r[:, :, 1].astype(np.int64) << 8) | r[:, :, 2] for r in rgbs]
    cols = np.unique(np.concatenate([p.ravel() for p in packed]))
    if len(cols) > 256:
        raise SystemExit(f'GIF 색 {len(cols)} > 256')
    pal = []
    for c in cols:
        pal += [int(c) >> 16 & 255, int(c) >> 8 & 255, int(c) & 255]
    ims = []
    for p in packed:
        idx = np.searchsorted(cols, p).astype(np.uint8)
        im = Image.fromarray(idx, 'P')
        im.putpalette(pal + [0] * (768 - len(pal)))
        if k != 1:
            im = im.resize((im.width * k, im.height * k), Image.NEAREST)
        ims.append(im)
    buf = io.BytesIO()
    ims[0].save(buf, 'GIF', save_all=True, append_images=ims[1:], duration=ms, loop=0, optimize=False)
    return 'data:image/gif;base64,' + base64.b64encode(buf.getvalue()).decode()


def anim_tag(frames, k, alt=''):
    f0 = frames[0]
    w = (f0.w if isinstance(f0, dot.Cv) else f0.width) * k
    return f'<img src="{gif_b64(frames, k)}" width="{w}" alt="{alt}">'


def img_tag(im, k, alt=''):
    w = (im.width if not isinstance(im, dot.Cv) else im.w) * k
    return f'<img src="{b64(im, k)}" width="{w}" alt="{alt}">'


_LINE_REF = {}


def line_ref(ln):
    """줄의 화풍 기준 그림 = 기원 판(style-r1)의 그 글자 동굴 장면. 없으면 None."""
    if ln not in _LINE_REF:
        o = lines().get(ln, {}).get('origin', {})
        try:
            mod = load_round(o['round'])
            _LINE_REF[ln] = mod.CANDIDATES['style.cave'][o['letter']]()[1]['vignette']
        except (KeyError, SystemExit):
            _LINE_REF[ln] = None
    return _LINE_REF[ln]


def cand_note(mod, key):
    notes = getattr(mod, 'NOTES', None) or getattr(mod, 'STYLE_NOTE', {})
    return notes.get(key, '')


def cmd_sheet(rid, force=False):
    mod, rendered, man, res, fails = cmd_gate(rid, quiet=True)
    if fails and not force:
        for i, L, r in fails:
            print(f'FAIL {i} {L} {r["code"]}: {r["msg"]}')
        raise SystemExit('관문 FAIL 이 있어 시트를 쓰지 않는다(--force 로 강제, 사람에게 FAIL 을 같이 보인다)')
    s = seed()
    rd = s['rounds'][rid]
    style = rd.get('wave') == 'style'
    items = items_by_id()
    ls = lines()
    ps = pick_state()
    act = actor()
    H = [f'<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>던전 칩셋 {rid}</title><style>{CSS}</style></head><body>']
    H.append(f'<h1>버들항 던전 칩셋(beodeul_dungeon) — {rd.get("title", rid)}</h1>')
    if rd.get('lead'):
        H.append(f'<p class="lead">{rd["lead"]}</p>')
    H.append('<p class="lead">던전은 컨셉이 여럿이라 화풍을 하나로 고정하지 않는다(2026-10-08 결정). <b>줄(line)마다 따로 고른다</b> — '
             '줄의 화풍 기준은 style-r1 의 그 글자 조각이다.</p><div class="row">')
    for ln, info in ls.items():
        cut = info.get('skip', {})
        H.append(f'<div class="card"><h3>줄 {ln} 「{info["name"]}」</h3><div class="sub">{info["concept"]}</div>'
                 f'<div class="sub">기원: {info["origin"]["round"]} {info["origin"]["letter"]}'
                 + (''.join(f'<br>뺀 항목 {k}: {v}' for k, v in cut.items()) if cut else '') + '</div></div>')
    H.append('</div>')
    H.append('<p class="lead warn">기계 관문(팔레트·크기·불투명·윗면·이음·구조, 외곽선 경고) 통과는 합격이 아니다. 감독·에이전트는 고르지 않았다. '
             '항목마다 <b>줄마다</b> 하나를 고르거나 버려 주세요. 고르기: <code>npm run harness -- dungeon-chipset pick '
             f'{rid} &lt;항목&gt; &lt;후보&gt; --sha &lt;해시 앞 8자리&gt;</code> · 버리기: <code>… reject {rid} &lt;항목&gt; &lt;후보&gt; --why "…"</code> · '
             '<span class="star">★</span> = 사람이 그 줄에서 고른 후보(현재 그림과 해시가 맞음).</p>')
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
        H.append('</div>')
        groups = {}
        for key in cands:
            groups.setdefault(line_of(key), []).append(key)
        one_row = all(len(v) <= 1 for v in groups.values())
        if one_row:
            H.append('<div class="row">')
        for ln in ls:
            if not one_row:
                H.append(f'<div class="lineh">줄 {ln} 「{ls[ln]["name"]}」</div><div class="row">')
                ref = line_ref(ln)
                if ref is not None:
                    o = ls[ln]['origin']
                    H.append(f'<div class="card ref"><h3>줄 기준</h3><div class="sub">{o["round"]} {o["letter"]} 동굴 장면(화풍 기준)</div>'
                             f'<div class="imgs"><div>{img_tag(ref, 1)}<div class="lbl">1배</div></div>'
                             f'<div>{img_tag(ref, 2)}<div class="lbl">2배</div></div></div></div>')
            if skipped(ln, item):
                H.append(f'<div class="card"><h3>줄 {ln} — 뺌</h3><div class="sub">{skipped(ln, item)}</div></div>')
            for key in groups.get(ln, []):
                im, meta = cands[key]
                sha = man['items'][item][key]['sha256']
                rs = res[item][key]
                st = ps.get((item, ln))
                st = st if st and st[0]['round'] == rid else None
                star = (f' <span class="star">★ 줄 {ln} 고름</span>' if st and st[0]['letter'] == key and st[1] == 'current' else
                        ' <span class="bad">VOID</span>' if st and st[0]['letter'] == key else '')
                gl = ' '.join(f'<span class="{"ok" if r["ok"] else ("bad" if r["level"] == "FAIL" else "w")}" title="{r["msg"]}">{r["code"]}{"✓" if r["ok"] else "✗"}</span>' for r in rs)
                H.append(f'<div class="card{" picked" if "star" in star else ""}"><h3>후보 {key} <span class="sha">{sha[:8]}</span>{star}</h3>'
                         f'<div class="sub">{meta.get("note") or cand_note(mod, key)}</div><div class="imgs">'
                         f'<div>{img_tag(im, 1)}<div class="lbl">원본 1배</div></div><div>{img_tag(im, 4)}<div class="lbl">4배</div></div>')
                if 'anim' in meta:
                    H.append(f'<div>{anim_tag(meta["anim"], 1)}<div class="lbl">장면 1배(움직임)</div></div>'
                             f'<div>{anim_tag(meta["anim"], 3)}<div class="lbl">장면 3배(움직임)</div></div>')
                elif 'vignette' in meta:
                    v = meta['vignette']
                    H.append(f'<div>{img_tag(v, 1)}<div class="lbl">장면 1배</div></div><div>{img_tag(v, 3)}<div class="lbl">장면 3배</div></div>')
                H.append('</div>')
                extras = list(meta.get('extras', []))
                if meta.get('kind') == 'cave-set':
                    extras = [('바닥 몸통 6×6 (2배)', dot.tiled(meta['parts']['floor'].body, 6, 6), 2),
                              ('천장 몸통 6×6', dot.tiled(meta['parts']['ceil'].body, 6, 6), 2),
                              ('앞면 6칸 이어 붙임', _face_run(meta['parts']['face']), 2)]
                if extras:
                    H.append('<div class="imgs" style="margin-top:6px">' + ''.join(
                        f'<div>{img_tag(x, k)}<div class="lbl">{lb}</div></div>' for lb, x, k in extras) + '</div>')
                H.append(f'<div class="gate">관문 {gl}<br>' + '<br>'.join(f'{r["code"]} {r["msg"]}' for r in rs if not r['ok'] or r['code'] in 'SF') + '</div></div>')
            if not one_row:
                H.append('</div>')
        if one_row:
            H.append('</div>')
    if style and hasattr(mod, 'SET_GRID'):
        H.append('<h2>세트 장면 — 줄마다 다섯 항목을 한 곳에</h2><p class="lead">동굴 벽·바닥·물·내림 계단·벽돌 문(벽돌은 맥락)·상자·횃불·Actor1. 1배와 3배.</p><div class="row">')
        for L in 'ABC':
            sc = set_scene(mod, L)
            H.append(f'<div class="card"><h3>줄 {L} 「{ls.get(L, {}).get("name", "")}」</h3><div class="sub">{mod.STYLE_NOTE[L]}</div><div class="imgs">'
                     f'<div>{img_tag(sc, 1)}<div class="lbl">1배</div></div><div>{img_tag(sc, 3)}<div class="lbl">3배</div></div></div></div>')
        H.append('</div>')
    if hasattr(mod, 'line_scenes'):
        H.append(f'<h2>줄별 장면</h2><p class="lead">{getattr(mod, "SCENE_LEAD", "")}</p>')
        for ln, scs in mod.line_scenes().items():
            H.append(f'<div class="lineh">줄 {ln} 「{ls[ln]["name"]}」</div><div class="row">')
            for title, sub, sc in scs:
                tag = anim_tag if isinstance(sc, list) else img_tag
                H.append(f'<div class="card"><h3>{title}</h3><div class="sub">{sub}</div><div class="imgs">'
                         f'<div>{tag(sc, 1)}<div class="lbl">1배</div></div><div>{tag(sc, 3)}<div class="lbl">3배</div></div>'
                         + (f'<div>{img_tag(sc[0], 4)}<div class="lbl">장면 1 정지 4배</div></div>' if isinstance(sc, list) else '')
                         + '</div></div>')
            H.append('</div>')
    H.append('<h2>잠금 팔레트</h2><p class="lead">버들항 변형 조각에서 램프마다 실제 화소색을 뽑았다(palette.py). 모든 색이 공용 시트에 있다.</p><div class="pal">')
    for k, v in dot.PAL['ramps'].items():
        H.append(f'<div><b>{k}</b> ' + ''.join(f'<span class="sw" style="background:{c}" title="{c}"></span>' for c in v)
                 + f' <span class="sub">{dot.PAL["sources"][k]["why"]}</span></div>')
    H.append(f'</div><p class="sub">판 {rid} · {man["at"]} · 그림 원본 {rd["module"]}</p></body></html>')
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


def cmd_pick(rid, item, key, sha, note):
    ln = line_of(key)
    if not ln:
        raise SystemExit(f'후보 {key} 의 줄을 모른다 — 시드 lines: {", ".join(lines())} (화풍 판은 글자, 이후 판은 <줄><번호>)')
    if skipped(ln, item):
        raise SystemExit(f'{item} 은 줄 {ln} 에서 뺀 항목이다: {skipped(ln, item)}')
    man_p = os.path.join(RUNS, rid, 'manifest.json')
    if not os.path.exists(man_p):
        raise SystemExit(f'판 {rid} 의 manifest 가 없다 — sheet {rid} 를 먼저(사람이 본 시트가 있어야 고를 수 있다)')
    man = json.load(open(man_p, encoding='utf-8'))
    if item not in man['items'] or key not in man['items'][item]:
        raise SystemExit(f'{rid} 에 {item} {key} 후보가 없다')
    shown = man['items'][item][key]['sha256']
    if not sha or not shown.startswith(sha):
        raise SystemExit(f'--sha 가 시트에 보인 해시({shown[:8]})와 다르다 — 사람이 본 그림의 해시 앞자리를 그대로 받는다')
    cur, im = current_hash(rid, item, key)
    if cur != shown:
        raise SystemExit(f'시트 이후 그림이 바뀌었다(시트 {shown[:12]} ≠ 현재 {str(cur)[:12]}). sheet {rid} 를 다시 만들어 다시 보여야 한다')
    out = picked_path(ln, item)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)
    L = ledger()
    L['picks'] = [p for p in L['picks'] if not (p['item'] == item and pick_line(p) == ln)] + [
        {'round': rid, 'item': item, 'line': ln, 'letter': key, 'sha256': cur, 'note': note, 'at': now(), 'by': 'user'}]
    save_ledger(L)
    print(f'고름 기록: {item} 줄 {ln} ← {rid} {key} ({cur[:12]}) → {os.path.relpath(out, REPO)}')


def cmd_reject(rid, item, key, why):
    if not why:
        raise SystemExit('--why 가 필요하다(다음 판의 「하지 말 것」이 된다)')
    ln = line_of(key)
    if not ln:
        raise SystemExit(f'후보 {key} 의 줄을 모른다 — 시드 lines: {", ".join(lines())}')
    cur, _ = current_hash(rid, item, key)
    if cur is None:
        raise SystemExit(f'{rid} 에 {item} {key} 후보가 없다')
    L = ledger()
    L['rejects'].append({'round': rid, 'item': item, 'line': ln, 'letter': key, 'sha256': cur, 'why': why, 'at': now(), 'by': 'user'})
    save_ledger(L)
    print(f'버림 기록: {rid} {item} {key}(줄 {ln}) ({cur[:8]}) — {why}')


def pick_state():
    """{(항목, 줄): (기록, 'current' | 'VOID — …')}. 현재 그림 해시·picked 파일 해시가 고른 해시와 같아야 current."""
    out, cache = {}, {}
    for p in ledger()['picks']:
        rid, ln = p['round'], pick_line(p)
        try:
            if rid not in cache:
                cache[rid] = render_round(rid)[1]
            c = cache[rid].get(p['item'], {}).get(p['letter'])
            cur = dot.image_hash(c[0]) if c else None
        except SystemExit:
            cur = None
        f = picked_path(ln, p['item'])
        fh = dot.image_hash(Image.open(f)) if os.path.exists(f) else None
        if cur != p['sha256']:
            out[(p['item'], ln)] = (p, 'VOID — 판 코드의 그림이 고른 뒤 바뀌었다')
        elif fh != p['sha256']:
            out[(p['item'], ln)] = (p, 'VOID — picked/ 파일이 고른 그림과 다르다')
        else:
            out[(p['item'], ln)] = (p, 'current')
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
    for ln, info in lines().items():
        print(f'줄 {ln} 「{info["name"]}」 — {info["concept"]}')
        for w, its in waves.items():
            live = [i for i in its if not skipped(ln, i['id'])]
            got = [i for i in live if (i['id'], ln) in ps and ps[(i['id'], ln)][1] == 'current']
            cut = len(its) - len(live)
            print(f'  묶음 {w}: {len(got)}/{len(live)} 고름' + (f' (뺀 항목 {cut})' if cut else ''))
            for it in its:
                if (it['id'], ln) in ps:
                    p, st = ps[(it['id'], ln)]
                    print(f'    {it["id"]:22} {p["round"]} {p["letter"]:3} {p["sha256"][:8]}  {st}')
    print(f'버림 기록 {len(L["rejects"])}건')
    polish_report(L, ps)


def polish_report(L, ps):
    """외곽선 규칙(seed rules.outline) 경고 OUTLINE·CONTRAST — 판별 수와, 고른 것(현재 해시) 중 굽기 전에 다듬을 목록.
    판 그림은 사람이 고르는 중이라 고치지 않는다. 굽는 작업에서 고른 그림만 규칙대로 다듬는다."""
    last = {}
    for r in L['runs']:
        last[r['round']] = r
    print('외곽선 규칙 경고(마지막 관문, WARN — FAIL 아님):')
    for rid, r in last.items():
        if 'polish' not in r:
            print(f'  {rid}: 외곽선 규칙 관문 전 기록 — gate {rid} 를 다시 돌리면 센다')
            continue
        wc = r.get('warnByCode', {})
        print(f'  {rid}: OUTLINE {wc.get("OUTLINE", 0)} · CONTRAST {wc.get("CONTRAST", 0)}')
    todo = []
    for (item, line), (p, st) in sorted(ps.items()):
        r = last.get(p['round'])
        if st != 'current' or not r or 'polish' not in r:
            continue
        todo += [(line, item, p['round'], p['letter'], w) for w in r['polish'] if w['item'] == item and w['key'] == p['letter']]
    print(f'굽기 전에 다듬을 목록(고른 것 중 외곽선 규칙 경고) {len(todo)}건' + (':' if todo else ''))
    for line, item, rid, key, w in todo:
        print(f'  줄 {line} {item:22} {rid} {key:3} {w["code"]}: {w["msg"]}')


def cmd_list(wave=None):
    ps = pick_state()
    for it in seed()['items']:
        if wave and it['wave'] != wave:
            continue
        marks = ' '.join(('-' if skipped(ln, it['id']) else
                          '★' if (it['id'], ln) in ps and ps[(it['id'], ln)][1] == 'current' else '·') + ln
                         for ln in lines())
        print(f'{marks}  {it["wave"]:6} {it["id"]:22} {it["size"][0]}×{it["size"][1]} {it["layer"]:5} {it["kind"]:11} {it["title"]}')


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
    for ln, info in lines().items():
        if len(ln) != 1 or not ln.isupper():
            errs.append(f'줄 id {ln!r} 는 대문자 한 글자여야 한다(후보 키 <줄><번호> 의 앞 글자)')
        for k in ('name', 'concept', 'origin'):
            if k not in info:
                errs.append(f'줄 {ln}: {k} 없음')
        for item, why in info.get('skip', {}).items():
            if item not in ids:
                errs.append(f'줄 {ln} skip: 모르는 항목 {item}')
            if not why:
                errs.append(f'줄 {ln} skip {item}: 이유가 비었다')
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
                continue
            style = rd.get('wave') == 'style'
            for key in mod.CANDIDATES[item]:
                ln = line_of(key)
                if not ln or (style and key != ln) or (not style and key == ln):
                    errs.append(f'판 {rid} {item}: 후보 키 {key} — 화풍 판은 줄 글자, 이후 판은 <줄><번호>')
                elif skipped(ln, item):
                    errs.append(f'판 {rid} {item}: 줄 {ln} 에서 뺀 항목인데 후보 {key} 가 있다')
            if not style:
                for ln in lines():
                    if not skipped(ln, item) and not any(line_of(k) == ln for k in mod.CANDIDATES[item]):
                        errs.append(f'판 {rid} {item}: 줄 {ln} 후보가 없다(뺄 거면 lines.{ln}.skip 에 이유)')
        for item in mod.CANDIDATES:
            if item not in rd['items']:
                errs.append(f'판 {rid}: 모듈 후보 {item} 이 시드 rounds.{rid}.items 에 없다')
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
    p.add_argument('letter', metavar='후보', help='화풍 판은 줄 글자(A), 이후 판은 <줄><번호>(A1)')
    p.add_argument('--sha', required=True)
    p.add_argument('--note', default='')
    p = sub.add_parser('reject')
    p.add_argument('round')
    p.add_argument('item')
    p.add_argument('letter', metavar='후보', help='화풍 판은 줄 글자(A), 이후 판은 <줄><번호>(A1)')
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
