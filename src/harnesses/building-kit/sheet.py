"""building-kit 고르기 시트 — 사람이 보는 자체완결 HTML 한 장.

`sheet <테마> <판> [--show-failed]` → `~/claude-viz/bk-<테마>-<판>.html` (주소 http://mdc-server:18301/bk-<테마>-<판>.html).

무엇을 보여 주나 — 독립 검수(review) 영수증이 **지금 그림 화소 해시**에 대해 PASS 인 후보만. 검수는 조립 건물 단위
(줄 × 레시피, 영수증 이름 `<줄>.<레시피>`)이므로 같은 줄의 부품은 그 조립 영수증으로 덮인다(AGENTS.md 「부품 예외」).
항목마다: 버들항 기준 건물 · Actor1 정면 · 후보 1배·3배 · 조립 건물 · 같은 번호 부품으로 깐 거리 장면(버들항 잔디·포석 위,
Actor1) · 검수 판정 요약 · 해시 앞 8자리 · 복사할 pick/reject 명령.

`--show-failed` 는 PASS 가 아닌 후보(검수 FAIL·미검수·영수증 해시 불일치·조립 불가)를 사유와 함께 회색으로 보여 준다.
시트는 아무것도 고르지 않는다 — 명령 글자만 적는다. 감독·에이전트는 pick/reject 를 부르지 않는다.
"""
import base64
import datetime
import html as html_mod
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

import assemble as AS  # noqa: E402
import beodeul  # noqa: E402
import dot  # noqa: E402
import review  # noqa: E402

CSS = '''
body{background:#16141c;color:#e6e2da;font:14px/1.5 system-ui,"Noto Sans KR",sans-serif;margin:0;padding:24px 28px 80px}
h1{font-size:22px;margin:0 0 6px} h2{font-size:18px;margin:34px 0 8px;border-top:1px solid #3a3644;padding-top:18px}
h3{font-size:15px;margin:0 0 4px}
.lead{color:#b9b3a8;max-width:1100px} .warn{color:#f0b060} code{background:#2a2633;padding:1px 5px;border-radius:3px}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;margin:10px 0}
.card{background:#211e29;border:1px solid #3a3644;border-radius:6px;padding:10px 12px;max-width:820px}
.card h3{margin:0 0 4px;font-size:15px} .sub{color:#a9a39a;font-size:12px;margin-bottom:6px}
.card.ref{border-color:#5a6a4a} .imgs{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
img{image-rendering:pixelated;display:block} .lbl{font-size:11px;color:#8f897f;margin-top:2px}
.ok{color:#8fd08f} .bad{color:#ff8a7a} .w{color:#f0c060} .gate{font-size:12px;margin-top:6px;max-width:760px}
.sha{font-family:ui-monospace,monospace;color:#d8c48a;font-weight:400}
.star{color:#ffd24a;font-weight:700} .card.picked{border-color:#c9a227;box-shadow:0 0 0 1px #c9a227}
.card.grey{filter:grayscale(.85);opacity:.55;border-style:dashed}
.cmd{font:12px/1.45 ui-monospace,monospace;background:#2a2633;border:1px solid #3a3644;border-radius:4px;
     padding:6px 8px;margin:4px 0;white-space:pre-wrap;word-break:break-all;user-select:all}
.copy{font:11px system-ui,sans-serif;background:#332e3f;color:#cfc8ba;border:1px solid #4a4457;border-radius:3px;
      padding:1px 6px;cursor:pointer;margin-top:6px}
.stat{background:#211e29;border:1px solid #3a3644;border-radius:6px;padding:6px 10px;font-size:12px;color:#b9b3a8}
.stat b{color:#e6e2da}
.pal .sw{display:inline-block;width:16px;height:16px;margin:0 1px 1px 0;border:1px solid #000;vertical-align:middle}
.pal div{margin:2px 0;font-size:12px}
'''

def now():
    return datetime.datetime.now().isoformat(timespec='seconds')

def b64(im, k=1):
    if isinstance(im, dot.Cv):
        im = im.img()
    if k != 1:
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    buf = io.BytesIO()
    im.save(buf, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()

def img_tag(im, k=1, alt=''):
    w = (im.w if isinstance(im, dot.Cv) else im.width) * k
    return f'<img src="{b64(im, k)}" width="{w}" alt="{html_mod.escape(alt)}">'

def figure(im, k, label):
    return f'<div>{img_tag(im, k, label)}<div class="lbl">{html_mod.escape(label)}</div></div>'

def code_cmd(text):
    esc = html_mod.escape(text)
    return (f'<button class="copy" onclick="navigator.clipboard&amp;&amp;navigator.clipboard.writeText('
            f'this.nextElementSibling.textContent)">복사</button><pre class="cmd">{esc}</pre>')

_REF = {}

def ref_image(ref):
    name = beodeul.ref_name(ref)
    if name not in _REF:
        _REF[name] = beodeul.ref_image(ref).img()
    return _REF[name]

def ref_for_item(theme, item_id, refs):
    for b in dot.seed(theme)['buildings']:
        used = set()
        for m in AS.masses(b):
            used |= {m.get('roof'), m.get('wall'), m.get('base'), m.get('band')}
            used |= {row['item'] for row in m['walls']}
            used |= {ex.get('part') for ex in (m.get('extras') or [])}
        if item_id in used:
            for r in refs:
                if r.get('use') == b.get('use'):
                    return r
    return refs[0] if refs else None

def key_buildings(theme, cands, key, rid=None):
    out = []
    for recipe in AS.round_buildings(theme, rid):
        bid = f'{key}.{recipe["id"]}'
        if bid in cands:
            out.append((bid, recipe, cands[bid]))
    return out

def street_scene(theme, buildings):
    ims = [c['img'] for _, _, c in buildings]
    gap = 2
    body = sum(im.width // dot.T for im in ims) + gap * max(0, len(ims) - 1)
    w = gap + body + gap + 1
    h = max((im.height // dot.T for im in ims), default=4) + 3
    cv = beodeul.ground_scene(w, h, theme, 'grass')
    base_y = (h - 2) * dot.T
    cv.paste(beodeul.ground_scene(w, 2, theme, 'cobble'), 0, base_y)
    x = gap
    for im in ims:
        cv.paste(dot.Cv.of(im), x * dot.T, base_y - im.height)
        x += im.width // dot.T + gap
    cv.paste(dot.Cv.of(beodeul.actor1_frame(1, 0, 0)), x * dot.T - dot.T // 2, base_y - 24)
    return cv

def review_state(theme, rid, cands, keys):
    """줄(부품 번호) → {pass, bids, receipts, reasons}. 검수 영수증이 지금 그림 해시에 대해 PASS 여야 pass."""
    out = {}
    for key in keys:
        st = {'pass': True, 'bids': [], 'receipts': [], 'reasons': []}
        for bid, recipe, c in key_buildings(theme, cands, key, rid):
            rec = review.receipt(theme, rid, bid)
            st['bids'].append(bid)
            st['receipts'].append((bid, rec, c))
            if review.passed(theme, rid, bid, c['img']):
                continue
            st['pass'] = False
            if rec is None:
                st['reasons'].append(f'{bid}: 독립 검수 없음 — review {theme} {rid}')
            elif not rec.get('complete'):
                st['reasons'].append(f'{bid}: 검수 미완료 — 유효 회차 부족({rec.get("votes")})')
            elif rec.get('pixelSha256') != review.sha(c['img']):
                st['reasons'].append(f'{bid}: 영수증 해시 불일치 — 검수 뒤 그림이 바뀌었다')
            else:
                for iss in (rec.get('issues') or [])[:2]:
                    st['reasons'].append(f'{bid}: {iss.get("code")} — {iss.get("why")}')
                if not (rec.get('issues') or []):
                    st['reasons'].append(f'{bid}: 검수 {rec.get("verdict")} (두 축 {rec.get("votes")})')
        if not st['bids']:
            st['pass'] = False
            st['reasons'].append('조립 가능한 레시피가 없다 — 부품 누락이거나 조립 관문(A1~A6) FAIL')
        out[key] = st
    return out

def _vote_summary(theme, rid, st):
    votes, judges = [], []
    for _, rec, _ in st['receipts']:
        if rec:
            votes.append(rec.get('votes', '?'))
            judges += [r.get('judge', '') for r in rec.get('runs', [])]
    return votes[0] if votes else '?', ', '.join(sorted({j for j in judges if j})) or '없음'

def write(theme, rid, show_failed=False):
    import harness
    s = dot.seed(theme)
    mod, rendered = harness.render_round(theme, rid)
    rd = s['rounds'][rid]
    man_p = os.path.join(dot.RUNS, theme, rid, 'manifest.json')
    if not os.path.exists(man_p):
        raise SystemExit(f'{theme} {rid}: manifest 가 없다 — sheet 는 draw 뒤에 쓴다(사람이 본 그림의 해시가 있어야 고를 수 있다)')
    man = json.load(open(man_p, encoding='utf-8'))
    items = {it['id']: it for it in s['items']}
    refs = s.get('refs') or []
    keys = sorted({k for c in rendered.values() for k in c})
    parts_by_key = {k: harness.parts_for(theme, rid, k, rendered) for k in keys}
    cands = review.candidates_for(theme, rid, parts_by_key)
    state = review_state(theme, rid, cands, keys)
    ps = harness.pick_state(theme)
    runs = [r for r in harness.ledger(theme)['runs'] if r.get('round') == rid]
    last = runs[-1] if runs else None
    agg_p = os.path.join(dot.RUNS, theme, rid, 'review', 'result.json')
    agg = json.load(open(agg_p, encoding='utf-8')) if os.path.exists(agg_p) else None
    passed_keys = [k for k in keys if state[k]['pass']]
    failed_keys = [k for k in keys if not state[k]['pass']]

    H = [f'<!doctype html><html lang="ko"><head><meta charset="utf-8">'
         f'<title>building-kit {theme} {rid}</title><style>{CSS}</style></head><body>']
    H.append(f'<h1>{html_mod.escape(s["theme"]["name"])} — {html_mod.escape(rd.get("title", rid))}</h1>')
    H.append(f'<p class="lead">{html_mod.escape(s["theme"]["concept"])}</p>')
    if rd.get('lead'):
        H.append(f'<p class="lead">{html_mod.escape(rd["lead"])}</p>')
    H.append('<div class="row">')
    H.append(f'<div class="stat">판 <b>{rid}</b> · 항목 {len(rd.get("items", []))} · 부품 번호 {", ".join(keys)}</div>')
    H.append('<div class="stat">기계 관문 <b>' + (
        f'{last["at"]} · FAIL {last["fail"]} · WARN {last["warn"]}' if last else '기록 없음 — gate 를 돌린다')
        + '</b></div>')
    H.append('<div class="stat">독립 검수 <b>' + (
        f'유효 {agg["valid"]}/{agg["need"]}회 · 무효 {agg["void"]}' if agg else '없음 — review 를 돌린다')
        + '</b></div>')
    H.append(f'<div class="stat">검수 PASS 부품 번호 <b>{", ".join(passed_keys) or "없음"}</b>'
             f' · 숨긴 실패·미검수 <b>{len(failed_keys)}</b></div>')
    H.append('</div>')
    H.append('<p class="lead warn">기계 관문 통과는 합격이 아니다. 이 시트는 <b>독립 검수 PASS(지금 그림 화소 해시)</b> 후보만 보여 준다. '
             '검수는 조립 건물 단위(부품 번호 × 레시피)이고, 같은 번호의 부품은 그 조립 영수증으로 덮인다. '
             '<b>감독·에이전트는 고르지 않는다</b> — 아래 명령은 사람이 직접 부른다.</p>')
    H.append('<p class="lead">고르기 <code>npm run harness -- building-kit pick &lt;테마&gt; &lt;판&gt; &lt;항목&gt; &lt;후보&gt; --sha &lt;해시 앞 8자리&gt;</code> · '
             '버리기 <code>… reject &lt;테마&gt; &lt;판&gt; &lt;항목&gt; &lt;후보&gt; --why "…"</code>. '
             '명령의 해시는 이 시트를 만들 때의 그림 해시다 — 그림이 바뀌면 pick 이 거절한다.</p>')

    H.append('<h2>버들항 기준 건물 · 사람 크기</h2><p class="lead">같은 계열(oprn-atlas)의 실제 버들항 건물과 Actor1. '
             '후보는 이 옆에서 같은 배율로 본다.</p><div class="row">')
    for r in refs:
        try:
            im = ref_image(r)
        except SystemExit:
            continue
        src = f'kit {r["kit"]}' if r.get('kit') else f'file {r["file"]}' + (f' crop {r["crop"]}' if r.get('crop') else '')
        H.append(f'<div class="card ref"><h3>{html_mod.escape(r.get("label", beodeul.ref_name(r)))}</h3>'
                 f'<div class="sub">{html_mod.escape(src)} · use {html_mod.escape(str(r.get("use", "")))}</div>'
                 f'<div class="imgs">{figure(im, 1, "1배")}{figure(im, 2, "2배")}</div></div>')
    act = beodeul.actor1_frame(1, 0, 0)
    H.append(f'<div class="card ref"><h3>Actor1 정면</h3><div class="sub">24×32 — 사람은 그리지 않는다</div>'
             f'<div class="imgs">{figure(act, 1, "1배")}{figure(act, 2, "2배")}</div></div></div>')

    for key in passed_keys:
        st = state[key]
        ln = key[0] if key and key[0] in s['lines'] else None
        votes, judges = _vote_summary(theme, rid, st)
        scene = street_scene(theme, key_buildings(theme, cands, key, rid))
        scene_tags = figure(scene, 1, f'거리 장면 1배 — {len(st["bids"])}채 + Actor1') + figure(scene, 3, '거리 장면 3배')
        H.append(f'<h2>부품 번호 {key} — 검수 PASS</h2>')
        if ln and isinstance(s['lines'].get(ln), dict):
            info = s['lines'][ln]
            H.append(f'<p class="lead">줄 {ln} 「{html_mod.escape(info.get("name", ""))}」 — '
                     f'{html_mod.escape(info.get("concept", ""))}<br>'
                     f'<span class="sub">두 축 {html_mod.escape(votes)} · 판정자 {html_mod.escape(judges)} · '
                     f'조립 {", ".join(html_mod.escape(b) for b in st["bids"])}</span></p>')
        else:
            H.append(f'<p class="lead"><span class="sub">두 축 {html_mod.escape(votes)} · 판정자 {html_mod.escape(judges)} · '
                     f'조립 {", ".join(html_mod.escape(b) for b in st["bids"])}</span></p>')
        H.append('<div class="row">')
        for item_id in rd.get('items', []):
            if item_id not in rendered or key not in rendered[item_id]:
                continue
            it = items[item_id]
            im = rendered[item_id][key][0]
            sha = man.get('items', {}).get(item_id, {}).get(key, {}).get('sha256') or dot.image_hash(im)
            cur = dot.image_hash(im)
            stale = cur != sha
            pick = ps.get((item_id, key))
            star = pick and pick[1] == 'current' and pick[0].get('key') == key
            H.append(f'<div class="card{" picked" if star else ""}"><h3>{item_id} — {html_mod.escape(it["title"])} '
                     f'<span class="sha">{sha[:8]}</span>' + (' <span class="star">★ 고름</span>' if star else '') + '</h3>')
            H.append(f'<div class="sub">{html_mod.escape(it.get("brief", ""))} · {it["size"][0]}×{it["size"][1]}칸</div>')
            H.append('<div class="imgs">')
            ref = ref_for_item(theme, item_id, refs)
            if ref:
                try:
                    H.append(figure(ref_image(ref), 2, '버들항 기준 2배'))
                except SystemExit:
                    pass
            H.append(figure(act, 2, 'Actor1 2배'))
            H.append(figure(im, 1, '후보 1배'))
            H.append(figure(im, 3, '후보 3배'))
            for bid, recipe, c in key_buildings(theme, cands, key, rid):
                H.append(figure(c['img'], 2, f'조립 {recipe["id"]} 2배'))
            H.append(scene_tags)
            H.append('</div>')
            H.append(f'<div class="gate"><span class="ok">검수 PASS</span> · 두 축 {html_mod.escape(votes)} · '
                     f'{" · ".join(html_mod.escape(b) for b in st["bids"])}</div>')
            if stale:
                H.append('<div class="gate bad">manifest 해시와 지금 그림이 다르다 — draw·review·sheet 를 다시 돌린다</div>')
            H.append(code_cmd(f'npm run harness -- building-kit pick {theme} {rid} {item_id} {key} --sha {sha[:8]}'))
            H.append(code_cmd(f'npm run harness -- building-kit reject {theme} {rid} {item_id} {key} --why "…"'))
            H.append('</div>')
        H.append('</div>')

    if not passed_keys:
        H.append('<h2>검수 PASS 후보가 아직 없다</h2><p class="lead warn">review 를 먼저 돌린다: '
                 f'<code>npm run harness -- building-kit review {theme} {rid}</code>. '
                 '판정 영수증이 지금 그림 해시에 대해 PASS 인 후보만 이 시트에 올라온다.</p>')

    if show_failed:
        H.append('<h2>검수 실패·미검수 (--show-failed)</h2><p class="lead">고를 수 없다 — 사유만 본다. 회색 카드.</p><div class="row">')
        for key in failed_keys:
            st = state[key]
            H.append(f'<div class="card grey"><h3>부품 번호 {key} — 고를 수 없음</h3><div class="sub">'
                     + '<br>'.join(html_mod.escape(r) for r in st['reasons']) + '</div><div class="imgs">')
            for item_id in rd.get('items', []):
                if item_id in rendered and key in rendered[item_id]:
                    H.append(figure(rendered[item_id][key][0], 1, f'{item_id} 1배'))
            for bid, recipe, c in key_buildings(theme, cands, key, rid):
                H.append(figure(c['img'], 2, f'조립 {recipe["id"]} 2배'))
            H.append('</div></div>')
        H.append('</div>')
    elif failed_keys:
        H.append(f'<p class="lead">검수 PASS 가 아닌 부품 번호 {len(failed_keys)}개({", ".join(failed_keys)})는 숨겼다 — '
                 '사유와 그림은 <code>sheet ' + f'{theme} {rid} --show-failed</code> 로 본다.</p>')

    H.append('<h2>잠금 팔레트</h2><p class="lead">테마 램프는 버들항 실제 화소에서 뽑았다(palette.py). 불투명은 이 색만.</p><div class="pal">')
    pal = dot.palette(theme)
    for name, cols in pal['ramps'].items():
        why = (pal.get('sources', {}).get(name) or {}).get('why', '')
        H.append(f'<div><b>{name}</b> ' + ''.join(f'<span class="sw" style="background:{c}" title="{c}"></span>' for c in cols)
                 + (f' <span class="sub">{html_mod.escape(why)}</span>' if why else '') + '</div>')
    H.append(f'</div><p class="sub">판 {rid} · manifest {man.get("at", "")} · 그림 원본 {html_mod.escape(rd.get("module", ""))} · '
             f'시트 {now()}</p></body></html>')

    os.makedirs(dot.VIZ, exist_ok=True)
    out = os.path.join(dot.VIZ, f'bk-{theme}-{rid}.html')
    with open(out, 'w', encoding='utf-8') as f:
        f.write('\n'.join(H))
    L = harness.ledger(theme)
    L.setdefault('sheets', [])
    L['sheets'].append({'theme': theme, 'round': rid, 'at': now(), 'showFailed': bool(show_failed),
                        'passed': passed_keys, 'failed': failed_keys, 'file': out})
    L['sheets'] = L['sheets'][-40:]
    harness.save_ledger(theme, L)
    print(f'시트 → {out}\n주소 http://mdc-server:18301/bk-{theme}-{rid}.html '
          f'(검수 PASS {len(passed_keys)} · 실패/미검수 {len(failed_keys)}'
          + ('' if show_failed else ' — --show-failed 로 사유를 본다') + ')')
    return 0
