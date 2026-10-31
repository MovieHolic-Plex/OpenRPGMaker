#!/usr/bin/env python3
"""argon-plan page -> ~/claude-viz/argon-plan-vs-direct.html: per place, B drawn plan -> B laid map | A laid map, plus score table.
  python3 scripts/experiments/argon-plan/page.py "<one-line verdict>" """
import html, json, os, shutil, sys
HOME = os.path.expanduser("~"); R = os.environ.get("BW_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-argonplan")
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/argon-plan-vs-direct"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
ld = lambda p: json.load(open(p)) if os.path.exists(p) else {}
TASKS = ["inn", "library", "jail", "manor"]; KO = {"inn": "여관", "library": "도서관", "jail": "감옥", "manor": "저택"}
res, h2h = ld(f"{R}/results.json"), ld(f"{R}/h2h.json")
def run(arm, r, t): return ld(f"{R}/{arm}{r}/{t}/RUN.json")
def img(src, name):
    if not os.path.exists(src): return None
    shutil.copy(src, f"{IMG}/{name}"); return f"argon-plan-vs-direct/{name}"
def avg(v, f="{:.2f}"):
    v = [x for x in v if isinstance(x, (int, float))]; return f.format(sum(v) / len(v)) if v else "—"
def wdl(vs): return f"{vs.count(1)}승 {vs.count(0)}무 {vs.count(-1)}패" if vs else "—"
rows = []
for arm, lab in [("argonA", "A 바로 JSON"), ("argonB", "B 그림 먼저 → JSON")]:
    Rs = [run(arm, r, t) for r in (1, 2, 3) for t in TASKS]; Rs = [x for x in Rs if x]
    M = [(x.get("stats") or x.get("salvageStats") or {}).get("measure") or {} for x in Rs if (x.get("stats") or x.get("salvageStats"))]; V = [m.get("variety") or {} for m in M]
    anc = [v["verdict"] for k, v in res.items() if k.startswith(arm)]
    hv = [v["verdict"] for v in h2h.values()]; hv = hv if arm == "argonB" else [-x for x in hv]
    pics = sum(1 for r in (1, 2, 3) for t in TASKS if os.path.exists(f"{R}/{arm}{r}/{t}/plan-picture.png")) if arm == "argonB" else None
    rows.append(f"<tr><td>{lab}</td><td>{len(Rs)}/12</td><td>{sum(1 for x in Rs if x.get('ok'))}/{len(Rs)}</td><td>{avg([x.get('repairs') for x in Rs], '{:.1f}')}</td>"
                f"<td>{avg([v.get('distinctPerRoom') for v in V], '{:.1f}')}</td><td>{avg([v.get('repetition') for v in V])}</td><td>{avg([m.get('types') for m in M], '{:.1f}')}</td>"
                f"<td>{avg([v.get('boxRoomRatio') for v in V])} / {avg([v.get('plainBoxRatio') for v in V])}</td><td>{wdl(anc)}</td><td>{wdl(hv)}</td><td>{'' if pics is None else f'{pics}/12'}</td><td>{sum(1 for r in (1, 2, 3) for t in TASKS if os.path.exists(f"{R}/{arm}{r}/{t}/map.png"))}/12</td></tr>")
def cap(x, arm, r, t):
    if not x: return "아직"
    m = (x.get("stats") or x.get("salvageStats") or {}).get("measure") or {}; v = m.get("variety") or {}
    sv = ld(f"{R}/{arm}{r}/{t}/salvage.json")
    anc = [vv["verdict"] for k, vv in res.items() if k.startswith(f"{arm}{r}/{t}|")]
    s = f"{'검증 통과' if x.get('ok') else '<b class=bad>검증 실패</b>'} · 수리 {x.get('repairs')}회 · 방당 서로 다른 물건 {v.get('distinctPerRoom', '—')} · 종류 {m.get('types', '—')} · 네모 방 {v.get('boxRoomRatio', '—')} · 기준 방 대비 {wdl(anc)}"
    if sv.get("rendered"): s += f" · <span class=err>그림은 검증 실패 배치({sv.get('from') or 'layout.json'})에서 잘못 놓인 물건 {len(sv.get('dropped') or [])}개를 빼고 그린 것</span>"
    elif sv: s += " · <span class=err>벽 구조 오류로 그릴 수 없음</span>"
    if not x.get("ok") and x.get("errors"): s += f"<br><span class=err>남은 오류 {len(x['errors'])}: {html.escape(x['errors'][0][:160])}</span>"
    return s
secs = []
for t in TASKS:
    cards = []
    for r in (1, 2, 3):
        a, b = run("argonA", r, t), run("argonB", r, t)
        pb = img(f"{R}/argonB{r}/{t}/plan-picture.png", f"B{r}-{t}-plan.png"); mb = img(f"{R}/argonB{r}/{t}/map.png", f"B{r}-{t}-map.png"); ma = img(f"{R}/argonA{r}/{t}/map.png", f"A{r}-{t}-map.png")
        hv = h2h.get(f"argonB{r}/{t}", {})
        hs = {1: "B 승", 0: "무", -1: "A 승"}.get(hv.get("verdict"), "아직")
        why = ""
        for jd in (hv.get("judges") or {}).values():
            w = jd.get("why") or []; why = html.escape(" / ".join(w[:2]) if isinstance(w, list) else str(w))[:400]
        f = lambda p, c: f"<div class=col><h4>{c}</h4>" + (f"<a href='{p}'><img src='{p}'></a>" if p else "<div class=none>없음</div>") + "</div>"
        cards.append(f"<div class=card><h3>{KO[t]} #{r} — 맞대결(B 대 {hv.get("a", "A") if hv else "A"}, 두 순서): <b>{hs}</b></h3><div class=row>{f(pb, 'B ① Argon 이 그린 평면도 (SVG → PNG)')}{f(mb, 'B ② 그 그림을 보고 쓴 JSON → 깐 맵')}{f(ma, 'A 바로 JSON → 깐 맵')}</div>"
                     f"<p class=meta>B: {cap(b, 'argonB', r, t)}</p><p class=meta>A: {cap(a, 'argonA', r, t)}</p>" + (f"<p class=meta>판정 이유: {why}</p>" if why else "") + "</div>")
    secs.append(f"<h2>{KO[t]}</h2>" + "".join(cards))
page = f"""<!doctype html><meta charset=utf-8><title>Argon 평면도 먼저 vs 바로 배치</title>
<style>body{{background:#16161b;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}table{{border-collapse:collapse;margin:10px 0}}td,th{{border:1px solid #444;padding:4px 8px;text-align:center}}
.card{{background:#202027;border-radius:8px;padding:10px;margin:12px 0}}.row{{display:flex;gap:10px;align-items:flex-start}}.col{{flex:1;min-width:0}}.col img{{width:100%;image-rendering:pixelated;border:1px solid #333}}
h4{{margin:4px 0;font-size:13px;color:#aab}}.meta{{font-size:12px;color:#aaa;margin:4px 0}}.bad{{color:#f77}}.err{{color:#c99}}.none{{padding:40px;color:#666;border:1px dashed #444;text-align:center}}.verdict{{background:#2a2a35;padding:10px;border-left:4px solid #8af}}</style>
<h1>Argon(gemini-4-argon-high): 평면도 그림을 먼저 그리고 깔기(B) vs 배치 JSON 을 바로 쓰기(A)</h1>
<p class=verdict>{html.escape(verdict)}</p>
<p>장소 4곳 × Argon 3회씩. 두 쪽 모두 bbox-walls 8판 흐름(방 계획 → 맞춤 카탈로그 → 배치 → 같은 검증기·같은 영어 수리 지적, 최대 6회)이고, B 는 그 앞에 평면도 그림 한 장을 그린다.
8318 경로의 Argon 은 그림을 내지 못해(이미지 대신 dalle 호출 글을 돌려줌, gemini-web 계열은 503) <b>Argon 이 SVG 를 직접 쓰고 코드는 그것을 PNG 로 바꾸기만 했다</b>(배치 논리 없음). B 의 2단계에는 SVG 원문이 아니라 그 그림만 붙였다.
<b>두 팔 24장 모두 최대 6회 안에 검증을 통과하지 못했다</b>(7·8판 Argon 과 같음). 판정용 그림은 두 팔에 똑같이: 마지막 배치(벽을 못 그리면 그릴 수 있는 가장 늦은 답)에서 검증기가 지목한 잘못 놓인 물건만 빼고 그렸다 — 벽·방은 건드리지 않았다. 벽이 닫히지 않아 어떤 답도 못 그린 판은 맵이 없다.
판정자 Opus 5.5 medium, 기준 방은 bbox-walls 판들과 같고 두 순서로 본다. 맞대결은 같은 장소·같은 회차의 B 맵 대 A 맵.</p>
<table><tr><th>팔</th><th>완료</th><th>검증 통과</th><th>평균 수리</th><th>방당 서로 다른 물건</th><th>반복률</th><th>물건 종류</th><th>네모 방 / 밋밋한 네모</th><th>기준 방 대비</th><th>맞대결</th><th>그림 성공</th><th>맵 그려짐</th></tr>{''.join(rows)}</table>
{''.join(secs)}"""
open(f"{VIZ}/argon-plan-vs-direct.html", "w").write(page); print("ok")
