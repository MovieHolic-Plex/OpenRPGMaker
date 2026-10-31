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
    hv = [v["verdict"] for k, v in h2h.items() if k.startswith("argonB")]; hv = hv if arm == "argonB" else [-x for x in hv]
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
def round2():
    def gstat(arm):
        Rs = [(r, t, run(arm, r, t)) for r in (1, 2, 3) for t in TASKS]; Rs = [x for x in Rs if x[2]]
        M = [(x.get("stats") or x.get("salvageStats") or {}).get("measure") or {} for _, _, x in Rs if (x.get("stats") or x.get("salvageStats"))]; V = [m.get("variety") or {} for m in M]
        gc = [ld(f"{R}/{arm}{r}/{t}/grid-check.json") for r, t, _ in Rs]
        gok = sum(1 for g in gc if g and not g[-1]["errors"]); grep_ = avg([len(g) - 1 for g in gc if g], "{:.1f}")
        nobj = avg([sum(1 for o in (json.load(open(f"{R}/{arm}{r}/{t}/grid-{len(g) - 1}.json")) if arm == "argonJ" and os.path.exists(f"{R}/{arm}{r}/{t}/grid-{len(g) - 1}.json") else {}).get("cells", []) if str(o.get("class", "")).startswith("object:")) for (r, t, _), g in zip(Rs, gc) if g] if arm == "argonJ" else [open(f"{R}/{arm}{r}/{t}/grid-{len(g) - 1}.svg").read().count('class="object:') for (r, t, _), g in zip(Rs, gc) if g and os.path.exists(f"{R}/{arm}{r}/{t}/grid-{len(g) - 1}.svg")], "{:.1f}")
        anc = [v["verdict"] for k, v in res.items() if k.startswith(arm)]
        return (f"<td>{len(Rs)}/12</td><td>{gok}/{len(Rs)}</td><td>{grep_}</td><td>{nobj}</td><td>{sum(1 for _, _, x in Rs if x.get('ok'))}/{len(Rs)}</td><td>{avg([x.get('repairs') for _, _, x in Rs], '{:.1f}')}</td>"
                f"<td>{avg([v.get('distinctPerRoom') for v in V], '{:.1f}')}</td><td>{avg([m.get('types') for m in M], '{:.1f}')}</td><td>{avg([v.get('boxRoomRatio') for v in V])}</td><td>{wdl(anc)}</td>"
                f"<td>{sum(1 for r in (1, 2, 3) for t in TASKS if os.path.exists(f'{R}/{arm}{r}/{t}/map.png'))}/12</td>")
    hGA = [v["verdict"] for k, v in h2h.items() if k.startswith("A:")]; hGJ = [v["verdict"] for k, v in h2h.items() if k.startswith("J:")]
    tb = ("<table><tr><th>팔</th><th>완료</th><th>평면도 검사 통과</th><th>평면도 수리</th><th>평면도 물건 수</th><th>배치 검증 통과</th><th>배치 수리</th><th>방당 서로 다른 물건</th><th>물건 종류</th><th>네모 방</th><th>기준 방 대비</th><th>맵 그려짐</th></tr>"
          f"<tr><td>G 격자 SVG 그림 → JSON</td>{gstat('argonG')}</tr><tr><td>J 격자를 JSON 칸으로 → JSON (그림 없음)</td>{gstat('argonJ')}</tr></table>"
          f"<p>맞대결: G 대 A(1판 대조군) {wdl(hGA)} · G 대 J {wdl(hGJ)} (G 기준, 두 순서)</p>")
    cards = []
    for t in TASKS:
        for r in (1, 2, 3):
            g, j = run("argonG", r, t), run("argonJ", r, t)
            gp = img(f"{R}/argonG{r}/{t}/plan-picture.png", f"G{r}-{t}-plan.png"); gm = img(f"{R}/argonG{r}/{t}/map.png", f"G{r}-{t}-map.png")
            jp = img(f"{R}/argonJ{r}/{t}/plan-picture.png", f"J{r}-{t}-plan.png"); jm = img(f"{R}/argonJ{r}/{t}/map.png", f"J{r}-{t}-map.png")
            def gcap(arm):
                gc = ld(f"{R}/{arm}{r}/{t}/grid-check.json")
                if not gc: return "평면도 없음"
                e = gc[-1]["errors"]
                return f"평면도 {'검사 통과' if not e else f'<b class=bad>검사 오류 {len(e)}</b>'} (수리 {len(gc) - 1}회)" + (f"<br><span class=err>{html.escape(e[0][:160])}</span>" if e else "")
            vs = lambda key: {1: "G 승", 0: "무", -1: "G 패"}.get(h2h.get(key, {}).get("verdict"), "아직")
            f = lambda p, c: f"<div class=col><h4>{c}</h4>" + (f"<a href='{p}'><img src='{p}'></a>" if p else "<div class=none>없음</div>") + "</div>"
            cards.append(f"<div class=card><h3>{KO[t]} #{r} — G 대 A: <b>{vs(f'A:argonG{r}/{t}')}</b> · G 대 J: <b>{vs(f'J:argonG{r}/{t}')}</b></h3><div class=row>{f(gp, 'G ① 격자 평면도 (SVG, 검사 후 그린 것)')}{f(gm, 'G ② 그 그림으로 깐 맵')}{f(jp, 'J ① 격자 평면도 (JSON 칸, 같은 렌더)')}{f(jm, 'J ② 그 칸으로 깐 맵')}</div>"
                         f"<p class=meta>G: {gcap('argonG')} · {cap(g, 'argonG', r, t)}</p><p class=meta>J: {gcap('argonJ')} · {cap(j, 'argonJ', r, t)}</p></div>")
    return ("<h1 id=r2>2판 — 칸 격자 평면도 (천장·벽면 범례, 코드 검사)</h1><p>지도 크기를 고정(여관 22×20 · 도서관 24×22 · 감옥 20×18 · 저택 28×24)하고, 칸 16px 격자·가장자리 좌표가 그려진 SVG 뼈대를 줬다. Argon 은 칸에 맞춘 사각형만 더할 수 있고 범례는 ceiling(벽 윗면, 1칸) · wallface(북쪽 벽 앞면, 천장 바로 아래 2줄) · floor-재질 · door · window · object:id(카탈로그 크기) · label 뿐이다. 3/4 벽 모델을 영어 ASCII 예로 가르쳤다. 코드는 래스터 전에 격자 이탈·모르는 범례·천장 없는 벽면·천장 아래 바로 바닥·닫히지 않은 바깥 천장 고리·벽에 없는 문(세로 벽 문은 벽면 2칸+문 1칸)·물건 크기/자리를 검사해 정확한 칸의 Fixed call 로 최대 3회 돌려보낸다. 2단계는 1판과 같다(8판 흐름). G = 그 SVG 를 검사한 뒤 코드가 그린 그림을 붙여 줌, J = 같은 범례 평면을 JSON 칸으로 쓰고 2단계에 그림 없이 JSON 만 줌 — 그림이 격자 자체보다 더 주는 것이 있는지 본다. 평면도 그림은 두 팔 모두 같은 코드로 그렸다(어두운 = 천장, 갈색 = 벽면, 초록 = 문, 하늘색 막대 = 창).</p>"
            + tb + "".join(cards))
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
{''.join(secs)}
{round2()}"""
open(f"{VIZ}/argon-plan-vs-direct.html", "w").write(page); print("ok")
