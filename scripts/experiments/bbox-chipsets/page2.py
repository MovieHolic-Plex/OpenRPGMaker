#!/usr/bin/env python3
"""bbox-chipsets round 2 page → ~/claude-viz/bbox-chipsets-2.html (images in ~/claude-viz/bbox-chipsets-2/). Round 1 vs round 2 per place.
  python3 scripts/experiments/bbox-chipsets/page2.py "<one-line verdict>"   (run from the worktree root)"""
import json, os, sys, html
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places import PLACES
H = os.path.expanduser("~"); S = f"{H}/z-project/assistant-whole-game/suite/rooms"
R1 = f"{S}/runs-bbox-chipsets"; RUNS = os.environ.get("BBOX_RUNS", f"{S}/runs-bbox-chipsets-2")
VIZ = f"{H}/claude-viz"; IMG = f"{VIZ}/bbox-chipsets-2"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
J = lambda p: json.load(open(p)) if os.path.exists(p) else {}
res1, res2, M = J(f"{R1}/results-opus.json"), J(f"{RUNS}/results-opus.json"), J(f"{RUNS}/metrics.json")
def wdl(res, run, vs_r1=False):
    vs = [v["verdict"] for k, v in res.items() if k.split("|")[0] == run and (k.endswith("|r1") == vs_r1)]
    return vs.count(1), vs.count(0), vs.count(-1), len(vs)
def fmt(t): return f"{t[0]}승 {t[1]}무 {t[2]}패" if t[3] else "—"
def add(a, b): return tuple(x + y for x, y in zip(a, b))
def copy(src, dst, k=1):
    if os.path.exists(src) and (not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src)):
        m = Image.open(src); m.resize((m.width * k, m.height * k), Image.NEAREST).save(dst)
    return os.path.exists(dst)
def m(k, f): v = M.get(k, {}).get(f); return "—" if v is None else f"{v}%" if f == "emptyPct" else str(v)
secs = []; tot = {"r1": (0, 0, 0, 0), "r2": (0, 0, 0, 0), "vs": (0, 0, 0, 0)}
summary = []
for place, P in PLACES.items():
    refs = ""
    for a in P["anchors"]:
        n = a.split(":")[1]
        if copy(f"{RUNS}/refs/{n}.png", f"{IMG}/ref-{n}.png"):
            refs += f"<figure class=ref><img src='bbox-chipsets-2/ref-{n}.png'><figcaption>기준 {n} · 빈 바닥 {m('ref|' + n, 'emptyPct')}</figcaption></figure>"
    rows, cards = [], []
    pt = {"r1": (0, 0, 0, 0), "r2": (0, 0, 0, 0), "vs": (0, 0, 0, 0)}
    e1, e2, t1, t2 = [], [], [], []
    for slot in ("sol1", "sol2", "terra1", "terra2"):
        run = f"{slot}/{place}"; r2 = J(f"{RUNS}/{run}/RUN.json")
        a, b, c = wdl(res1, run), wdl(res2, run), wdl(res2, run, True)
        pt = {"r1": add(pt["r1"], a), "r2": add(pt["r2"], b), "vs": add(pt["vs"], c)}
        for lst, rnd, fld in ((e1, "r1", "emptyPct"), (e2, "r2", "emptyPct"), (t1, "r1", "types"), (t2, "r2", "types")):
            v = M.get(f"{rnd}|{run}", {}).get(fld)
            if v is not None: lst.append(v)
        state = "" if not r2 else ("통과" if r2.get("ok") else ("공간 검사 미통과로 그대로 깜" if r2.get("structOk") else "검증 실패"))
        look = len(r2.get("lookups", [])) if r2 else "—"
        rows.append(f"<tr><td>{slot}</td><td>{m('r1|' + run, 'emptyPct')} → <b>{m('r2|' + run, 'emptyPct')}</b></td><td>{m('r1|' + run, 'types')} → <b>{m('r2|' + run, 'types')}</b></td>"
                    f"<td>{fmt(a)} → <b>{fmt(b)}</b></td><td>{fmt(c)}</td><td>{look}</td><td>{state}</td></tr>")
        i1 = copy(f"{R1}/{run}/map.png", f"{IMG}/r1-{slot}-{place}.png", 2); i2 = copy(f"{RUNS}/{run}/map.png", f"{IMG}/r2-{slot}-{place}.png", 2)
        if not r2 and os.path.exists(f"{RUNS}/{run}/prompt.txt"): state = "실행 중"
        cards.append(f"<div class=card><h3>{place} · {slot}</h3><div class=pair>"
                     + (f"<figure><img src='bbox-chipsets-2/r1-{slot}-{place}.png'><figcaption>1판 · 빈 바닥 {m('r1|' + run, 'emptyPct')} · 물건 종류 {m('r1|' + run, 'types')}</figcaption></figure>" if i1 else "")
                     + (f"<figure><img src='bbox-chipsets-2/r2-{slot}-{place}.png'><figcaption>2판 · 빈 바닥 {m('r2|' + run, 'emptyPct')} · 물건 종류 {m('r2|' + run, 'types')} · {state}</figcaption></figure>" if i2 else f"<figure><p class=meta>2판 {state or '대기'}</p></figure>")
                     + "</div></div>")
    for k in tot: tot[k] = add(tot[k], pt[k])
    avg = lambda l: f"{round(sum(l) / len(l))}" if l else "—"
    summary.append(f"<tr><td>{place}</td><td>{avg(e1)}{'%' if e1 else ''} → <b>{avg(e2)}{'%' if e2 else ''}</b></td><td>{avg(t1)} → <b>{avg(t2)}</b></td><td>{fmt(pt['r1'])} → <b>{fmt(pt['r2'])}</b></td><td>{fmt(pt['vs'])}</td></tr>")
    secs.append(f"<h2>{place} — {P['tileset']}</h2><p>{html.escape(P['request'])}</p><div class=refs>{refs}</div>"
                f"<table><tr><th>판</th><th>빈 바닥 1판→2판</th><th>물건 종류 1판→2판</th><th>Opus vs 기준 1판→2판</th><th>Opus 2판 vs 1판</th><th>find_pieces</th><th>2판 상태</th></tr>{''.join(rows)}</table>{''.join(cards)}")
page = f"""<!doctype html><meta charset=utf-8><title>bbox 배치 2판 — 빈 공간·물건 다양성</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{font-size:17px;margin-top:28px;border-top:1px solid #444;padding-top:12px}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}.refs{{display:flex;gap:10px;align-items:flex-start}}.refs figure{{flex:0 1 auto}}.refs img{{width:auto;max-width:100%}}figcaption{{font-size:12px;color:#aaa}}.meta{{color:#bbb}}table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:4px 10px;vertical-align:top}}</style>
<h1>bbox 배치 2판 — 빈 공간 검사 + 카탈로그 분류·find_pieces + 새 물건 풀</h1>
<p class=v>{html.escape(verdict)}</p>
<p>빈 바닥 = 서 있는 물건이 그 칸에도 이웃 8칸에도 없는 바닥(야외는 걸을 수 있는 땅) 비율. 물건 종류 = 문·바닥 무늬를 뺀 서로 다른 조각 수. 판정자 Opus 5.5 medium 쌍 비교(두 순서).</p>
<table><tr><th>장소</th><th>빈 바닥 평균 1판→2판</th><th>물건 종류 평균 1판→2판</th><th>Opus vs 기준 1판→2판</th><th>Opus 2판 vs 1판(같은 칸)</th></tr>{''.join(summary)}
<tr><td><b>합계</b></td><td></td><td></td><td>{fmt(tot['r1'])} → <b>{fmt(tot['r2'])}</b></td><td>{fmt(tot['vs'])}</td></tr></table>
{''.join(secs)}"""
open(f"{VIZ}/bbox-chipsets-2.html", "w").write(page)
print("ok", tot)
