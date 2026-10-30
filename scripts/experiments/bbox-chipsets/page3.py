#!/usr/bin/env python3
"""bbox-chipsets round 3 page → ~/claude-viz/bbox-chipsets-3.html (images in ~/claude-viz/bbox-chipsets-3/). Rounds 1/2/3 per place + round-3 floor close-ups.
  python3 scripts/experiments/bbox-chipsets/page3.py "<one-line verdict>"   (run from the worktree root)"""
import json, os, sys, html
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places import PLACES
H = os.path.expanduser("~"); S = f"{H}/z-project/assistant-whole-game/suite/rooms"
RD = {"r1": f"{S}/runs-bbox-chipsets", "r2": f"{S}/runs-bbox-chipsets-2", "r3": os.environ.get("BBOX_RUNS", f"{S}/runs-bbox-chipsets-3")}
VIZ = f"{H}/claude-viz"; NM = "bbox-chipsets-3"; IMG = f"{VIZ}/{NM}"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
J = lambda p: json.load(open(p)) if os.path.exists(p) else {}
RES = {k: J(f"{v}/results-opus.json") for k, v in RD.items()}; M = J(f"{RD['r3']}/metrics.json")
def wdl(res, run, vs=False):
    v = [x["verdict"] for k, x in res.items() if k.split("|")[0] == run and (k.endswith("|r1") == vs)]
    return v.count(1), v.count(0), v.count(-1), len(v)
def fmt(t): return f"{t[0]}-{t[1]}-{t[2]}" if t[3] else "—"
def add(a, b): return tuple(x + y for x, y in zip(a, b))
def copy(src, dst, k=1, box=None):
    if os.path.exists(src) and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)):
        m = Image.open(src)
        if box: m = m.crop(box)
        m.resize((m.width * k, m.height * k), Image.NEAREST).save(dst)
    return os.path.exists(dst)
def m(rnd, run, f, pct=False):
    v = M.get(f"{rnd}|{run}", {}).get(f); return "—" if v is None else f"{v}%" if pct else str(v)
def crop_box(run_dir, outdoor, stats):
    """cells → pixel box for the floor close-up: the tatami region (or biggest region) indoors, the madang plus a margin outdoors."""
    L = J(f"{run_dir}/layout.json")
    if outdoor:
        md = stats.get("madang"); W, Hh = (L.get("map") or {}).get("w", 20), (L.get("map") or {}).get("h", 16)
        if isinstance(md, dict): x, y, w, h = md.get("x", 0), md.get("y", 0), md.get("w", W), md.get("h", Hh)
        else: x, y, w, h = 0, 0, W, Hh
        x0, y0 = max(0, x - 2), max(0, y - 2); x1, y1 = min(W, x + w + 2), min(Hh, y + h + 2)
    else:
        regs = L.get("regions") or []
        if not regs: return None
        r = next((r for r in regs if r.get("floor") == "tatami"), None) or max(regs, key=lambda r: r.get("w", 0) * r.get("h", 0))
        x0, y0, x1, y1 = r["x"] - 1, r["y"], r["x"] + r["w"] + 1, r["y"] + r["h"] + 1
    x1, y1 = min(x1, x0 + 16), min(y1, y0 + 13)
    return (max(0, x0) * 16, max(0, y0) * 16, x1 * 16, y1 * 16)
SLOTS = ("sol1", "sol2", "terra1", "terra2"); secs, summary = [], []
tot = {k: (0, 0, 0, 0) for k in ("r1", "r2", "r3", "vs")}
for place, P in PLACES.items():
    out = P.get("mode") == "outdoor"; refs = ""
    for a in P["anchors"]:
        n = a.split(":")[1]
        if copy(f"{RD['r3']}/refs/{n}.png", f"{IMG}/ref-{n}.png"):
            refs += f"<figure class=ref><img src='{NM}/ref-{n}.png'><figcaption>기준 {n} · 빈 바닥 {m('ref', n, 'emptyPct', True)}</figcaption></figure>"
    pt = {k: (0, 0, 0, 0) for k in tot}; rows, cards = [], []; avg = {}
    for slot in SLOTS:
        run = f"{slot}/{place}"; d3 = f"{RD['r3']}/{run}"; R3 = J(f"{d3}/RUN.json"); C3 = J(f"{d3}/check.json"); st = C3.get("stats") or {}
        w = {k: wdl(RES[k], run) for k in ("r1", "r2", "r3")}; vs = wdl(RES["r3"], run, True)
        for k in w: pt[k] = add(pt[k], w[k])
        pt["vs"] = add(pt["vs"], vs)
        for rnd in ("r1", "r2", "r3"):
            for f in ("emptyPct", "types", "boxPct", "edgeFramedPct"):
                v = M.get(f"{rnd}|{run}", {}).get(f)
                if v is not None: avg.setdefault((rnd, f), []).append(v)
        state = "" if not R3 else ("통과" if R3.get("ok") else ("공간 검사 미통과로 그대로 깜" if R3.get("structOk") else "검증 실패"))
        if not R3 and os.path.exists(f"{d3}/prompt.txt"): state = "실행 중"
        third = (f"{m('r2', run, 'edgeFramedPct', True)} → <b>{m('r3', run, 'edgeFramedPct', True)}</b>" if out
                 else f"{m('r1', run, 'boxPct', True)} → {m('r2', run, 'boxPct', True)} → <b>{m('r3', run, 'boxPct', True)}</b>")
        fl = (f"땅 섬 {st.get('groundIslands', '—')} · 딱딱한 경계 {st.get('hardEdges', '—')} · 디딤돌 {st.get('stonesSet', '—')}" if out
              else f"다다미 {st.get('tatamiMats', 0)}장 · 문턱 {st.get('thresholds', '—')} · 바닥 섬 {st.get('floorIslands', '—')}")
        rows.append(f"<tr><td>{slot}</td><td>{m('r1', run, 'emptyPct', True)} → {m('r2', run, 'emptyPct', True)} → <b>{m('r3', run, 'emptyPct', True)}</b></td>"
                    f"<td>{m('r1', run, 'types')} → {m('r2', run, 'types')} → <b>{m('r3', run, 'types')}</b></td><td>{third}</td><td>{fl}</td>"
                    f"<td>{fmt(w['r1'])} → {fmt(w['r2'])} → <b>{fmt(w['r3'])}</b></td><td>{fmt(vs)}</td><td>{state}</td></tr>")
        i2 = copy(f"{RD['r2']}/{run}/map.png", f"{IMG}/r2-{slot}-{place}.png", 2); i3 = copy(f"{d3}/map.png", f"{IMG}/r3-{slot}-{place}.png", 2)
        box = crop_box(d3, out, st) if i3 else None
        ic = box and copy(f"{d3}/map.png", f"{IMG}/r3c-{slot}-{place}.png", 4, box)
        cards.append(f"<div class=card><h3>{place} · {slot}</h3><div class=pair>"
                     + (f"<figure><img src='{NM}/r2-{slot}-{place}.png'><figcaption>2판 · 빈 바닥 {m('r2', run, 'emptyPct', True)} · 종류 {m('r2', run, 'types')}</figcaption></figure>" if i2 else "")
                     + (f"<figure><img src='{NM}/r3-{slot}-{place}.png'><figcaption>3판 · 빈 바닥 {m('r3', run, 'emptyPct', True)} · 종류 {m('r3', run, 'types')} · {state}</figcaption></figure>" if i3 else f"<figure><p class=meta>3판 {state or '대기'}</p></figure>")
                     + (f"<figure><img src='{NM}/r3c-{slot}-{place}.png'><figcaption>3판 바닥 확대 ({'마당' if out else '다다미 방' if 'tatami' in json.dumps(J(f'{d3}/layout.json').get('regions', [])) else '가장 큰 방'}) · {fl}</figcaption></figure>" if ic else "")
                     + "</div></div>")
    for k in tot: tot[k] = add(tot[k], pt[k])
    A = lambda rnd, f, pct=True: (f"{round(sum(avg[(rnd, f)]) / len(avg[(rnd, f)]))}{'%' if pct else ''}" if avg.get((rnd, f)) else "—")
    third = f"{A('r2', 'edgeFramedPct')} → <b>{A('r3', 'edgeFramedPct')}</b>" if out else f"{A('r1', 'boxPct')} → {A('r2', 'boxPct')} → <b>{A('r3', 'boxPct')}</b>"
    summary.append(f"<tr><td>{place}</td><td>{A('r1', 'emptyPct')} → {A('r2', 'emptyPct')} → <b>{A('r3', 'emptyPct')}</b></td><td>{A('r1', 'types', False)} → {A('r2', 'types', False)} → <b>{A('r3', 'types', False)}</b></td>"
                   f"<td>{third}</td><td>{fmt(pt['r1'])} → {fmt(pt['r2'])} → <b>{fmt(pt['r3'])}</b></td><td>{fmt(pt['vs'])}</td></tr>")
    secs.append(f"<h2>{place} — {P['tileset']}</h2><p>{html.escape(P['request'])}</p><div class=refs>{refs}</div>"
                f"<table><tr><th>판</th><th>빈 바닥 1→2→3</th><th>물건 종류 1→2→3</th><th>{'마당 가장자리 채움 2→3' if out else '상자 방 비율 1→2→3'}</th><th>3판 바닥</th><th>Opus vs 기준 1→2→3</th><th>3판 vs 2판</th><th>3판 상태</th></tr>{''.join(rows)}</table>{''.join(cards)}")
page = f"""<!doctype html><meta charset=utf-8><title>bbox 배치 3판 — 바닥 재질·마당 땅·구조 어휘</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{font-size:17px;margin-top:28px;border-top:1px solid #444;padding-top:12px}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}.refs{{display:flex;gap:10px;align-items:flex-start}}.refs figure{{flex:0 1 auto}}.refs img{{width:auto;max-width:100%}}figcaption{{font-size:12px;color:#aaa}}.meta{{color:#bbb}}table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:4px 10px;vertical-align:top}}</style>
<h1>bbox 배치 3판 — 바닥은 구역 재질(다다미 장 수·문턱), 마당 땅은 불규칙 모양·길은 선, 구조 어휘, 빈 공간 수리 문구</h1>
<p class=v>{html.escape(verdict)}</p>
<p>빈 바닥 = 서 있는 물건이 그 칸에도 이웃 8칸에도 없는 바닥(야외는 걸을 수 있는 땅) 비율. 물건 종류 = 문·바닥 무늬를 뺀 서로 다른 조각 수. 상자 방 비율 = 다른 방과 붙지 않은 단순 직사각형 구역 비율.
마당 가장자리 채움 = 열린 마당 바로 바깥 칸 중 물건·건물 1칸 안에 있는 비율. 승-무-패는 판정자 Opus 5.5 medium 쌍 비교(두 순서).</p>
<table><tr><th>장소</th><th>빈 바닥 평균 1→2→3</th><th>물건 종류 평균 1→2→3</th><th>상자 방 / 마당 가장자리</th><th>Opus vs 기준 1→2→3</th><th>3판 vs 2판(같은 칸)</th></tr>{''.join(summary)}
<tr><td><b>합계</b></td><td></td><td></td><td></td><td>{fmt(tot['r1'])} → {fmt(tot['r2'])} → <b>{fmt(tot['r3'])}</b></td><td>{fmt(tot['vs'])}</td></tr></table>
{''.join(secs)}"""
import page4
page = page.replace("<h1>", "<p><a href='#r4' style='color:#8cf'>→ 4판(평면 스케치) 절</a></p><h1>", 1) + page4.section(J, M, copy, (NM, IMG), fmt, wdl, add)
page = page.replace("figcaption{{", "figcaption{{") .replace("</style>", "pre.plan{font:11px/1.05 monospace;color:#cde;background:#111;padding:6px;margin:0}h3.sub{font-size:16px;margin-top:20px}</style>", 1)
open(f"{VIZ}/{NM}.html", "w").write(page)
print("ok", tot)
