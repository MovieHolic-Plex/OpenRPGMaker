#!/usr/bin/env python3
"""argon-image-dungeon page → ~/claude-viz/argon-image-dungeon-layout.html (images in ~/claude-viz/argon-image-dungeon/).
Row per dungeon: generated picture | Argon dots from it | Argon direct | Opus r4; then the grid-picture variant. Summary table on top.
  python3 page.py "<one-line verdict>"   (run from the worktree root)"""
import json, os, sys, glob, html, shutil
from PIL import Image
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
RUNS = os.environ.get("AID_RUNS", f"{S}/rooms/runs-argonimg"); R4 = f"{S}/rooms/runs-bboxdungeon4"
VIZ = os.path.expanduser("~/claude-viz"); IMG = f"{VIZ}/argon-image-dungeon"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중"
res = json.load(open(f"{RUNS}/results.json")) if os.path.exists(f"{RUNS}/results.json") else {}
r4 = {}
for fn in sorted(glob.glob(f"{R4}/results*.json")): r4.update(json.load(open(fn)))
BR = {"crypt": "교회 밑 지하 묘지", "flooded": "물에 잠긴 동굴 신전", "demon": "마왕성 지하", "cave": "자연 동굴"}
run = lambda d: json.load(open(f"{d}/RUN.json")) if os.path.exists(f"{d}/RUN.json") else None
def wdl(R, key, pred):
    vs = [v["verdict"] for k, v in R.items() if k.startswith(key + "|") and pred(v["vs"])]
    return [vs.count(1), vs.count(0), vs.count(-1)]
add = lambda a, b: [x + y for x, y in zip(a, b)]
fmt = lambda t: f"{t[0]}승 {t[1]}무 {t[2]}패" if sum(t) else "-"
isref = lambda vs: vs.startswith("ref:")
def passes(arm): return sum(1 for b in BR if (run(f"{RUNS}/{arm}/{b}") or {}).get("ok"))
def fig(src, tag, cap, jpg=False):
    if not src or not os.path.exists(src): return f"<td class=empty>{cap}</td>"
    if jpg: Image.open(src).convert("RGB").save(f"{IMG}/{tag}.jpg", quality=88); fn = f"{tag}.jpg"
    else: shutil.copyfile(src, f"{IMG}/{tag}.png"); fn = f"{tag}.png"
    return f"<td><a href='argon-image-dungeon/{fn}'><img src='argon-image-dungeon/{fn}'></a><div class=cap>{cap}</div></td>"
def cell(arm, b, label):
    r = run(f"{RUNS}/{arm}/{b}")
    if not r: return f"<td class=empty>{label}: 없음</td>"
    if r.get("void"): return f"<td class=empty>{label}: 무효 — {html.escape(r['reason'])}</td>"
    if not r["ok"]: return f"<td class=empty>{label}: 검증 실패 (고침 {r['repairs']}회 다 씀)<br><small>마지막 오류: {html.escape('; '.join(r.get('errors', [])[:2]))[:220]}</small></td>"
    o = wdl(res, f"{arm}/{b}", lambda vs: vs.startswith("opus")); ref = wdl(res, f"{arm}/{b}", isref)
    return fig(f"{RUNS}/{arm}/{b}/map.png", f"{arm}-{b}", f"{label} · 통과 (고침 {r['repairs']}회) · 대 Opus {fmt(o)} · 기준 5장 대비 {fmt(ref)}")
tot = {a: {"opus": [0, 0, 0], "ref": [0, 0, 0], "direct": [0, 0, 0]} for a in ("img-r3", "img-grid-r3", "direct-r3")}
for a in tot:
    for b in BR:
        tot[a]["opus"] = add(tot[a]["opus"], wdl(res, f"{a}/{b}", lambda vs: vs.startswith("opus")))
        tot[a]["ref"] = add(tot[a]["ref"], wdl(res, f"{a}/{b}", isref))
        tot[a]["direct"] = add(tot[a]["direct"], wdl(res, f"{a}/{b}", lambda vs: vs == "direct-r3"))
opus_pass = sum(1 for b in BR for r in (1, 2) if (run(f"{R4}/opus{r}/{b}") or {}).get("ok"))
opus_ref = [0, 0, 0]
for b in BR:
    for r in (1, 2): opus_ref = add(opus_ref, wdl(r4, f"opus{r}/{b}", lambda vs: ":" not in vs))
rows, grows = [], []
for b, name in BR.items():
    r = run(f"{R4}/opus1/{b}"); rep = 1 if r and r["ok"] else 2
    rows.append(f"<tr><th>{name}</th>" + fig(f"{RUNS}/img/{b}/picture.png", f"pic-{b}", "생성 그림 (gemini-3.1-flash-image)", jpg=True)
                + cell("img-r3", b, "Argon 도트 (그림 보고)") + cell("direct-r3", b, "Argon 직접 (그림 없이)")
                + fig(f"{R4}/opus{rep}/{b}/map.png", f"opus{rep}-{b}", f"Opus 4차 #{rep} (고침 2회 안) · 기준 5장 대비 {fmt(wdl(r4, f'opus{rep}/{b}', lambda vs: ':' not in vs))}") + "</tr>")
    grows.append(f"<tr><th>{name}</th>" + fig(f"{RUNS}/img-grid/{b}/picture.png", f"picgrid-{b}", "격자를 넣어 그린 그림 (gemini-3.1-flash-image)", jpg=True)
                 + cell("img-grid-r3", b, "Argon 도트 (격자 그림 보고)") + "<td></td><td></td></tr>")
summ = f"""<table class=sum><tr><th>방식</th><th>통과<br><small>1판: r4 그대로·고침 2회</small></th><th>통과<br><small>2판: 고침 문구 보강</small></th><th>통과<br><small>3판: 보강 + 고침 6회</small></th><th>3판 대 Opus 4차</th><th>3판 대 기준 던전 5장</th></tr>
<tr><td>그림 → Argon 도트</td><td>{passes('img')}/4</td><td>{passes('img-r2')}/4</td><td>{passes('img-r3')}/4</td><td>{fmt(tot['img-r3']['opus'])}</td><td>{fmt(tot['img-r3']['ref'])}</td></tr>
<tr><td>격자 그림 → Argon 도트</td><td>-</td><td>-</td><td>{passes('img-grid-r3')}/4</td><td>{fmt(tot['img-grid-r3']['opus'])}</td><td>{fmt(tot['img-grid-r3']['ref'])}</td></tr>
<tr><td>Argon 직접 (그림 없이)</td><td>{passes('direct')}/4</td><td>{passes('direct-r2')}/4</td><td>{passes('direct-r3')}/4</td><td>{fmt(tot['direct-r3']['opus'])}</td><td>{fmt(tot['direct-r3']['ref'])}</td></tr>
<tr><td>Opus 4차 (기존 최고)</td><td colspan=3>{opus_pass}/8 (고침 2회 안)</td><td>-</td><td>{fmt(opus_ref)}</td></tr></table>
<p class=cap>그림 도트 대 Argon 직접 맞대결: 같은 던전에서 둘 다 통과한 판이 없어 비교 못 함.</p>"""
page = f"""<!doctype html><meta charset=utf-8><title>그림 먼저 → Argon 도트 던전</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px;margin:0 0 6px}}h2{{font-size:16px;margin:26px 0 0}}.v{{font-size:16px;color:#ffd866;margin:8px 0}}
table{{border-collapse:collapse}}.sum td,.sum th{{border:1px solid #444;padding:4px 10px;text-align:center}}.sum td:first-child{{text-align:left}}.grid{{width:100%;table-layout:fixed;margin-top:10px}}.grid th{{width:90px;text-align:left;vertical-align:top;padding-top:6px}}
.grid td{{vertical-align:top;padding:6px}}.grid img{{width:100%;image-rendering:pixelated;display:block;background:#000}}.cap{{font-size:12px;color:#aaa;margin-top:4px}}.empty{{background:#2a2a36;color:#aaa;font-size:13px;border-radius:6px}}</style>
<h1>그림 먼저 → Argon 이 도트로 옮기기 (던전 4종, 각 1판)</h1>
<p class=v>{html.escape(verdict)}</p>
{summ}
<p class=cap>그림 모델은 gemini-3.1-flash-image (8318 의 Argon 은 그림을 못 만든다). 도트 배치는 Argon (gemini-4-argon-high). 판정은 Opus 5.5 medium 이 두 순서로 쌍 비교하고, 엇갈리면 무승부. 통과 = 검증기 통과. 표 아래 그림은 3판 결과다.</p>
<table class=grid><tr><th></th><th>생성 그림</th><th>Argon 도트 (그림 보고)</th><th>Argon 직접</th><th>Opus 4차</th></tr>
{''.join(rows)}</table>
<h2>격자를 넣은 그림으로 다시 (그림을 덜 닮아서 해 본 것)</h2>
<table class=grid><tr><th></th><th>격자 그림</th><th>Argon 도트</th><th></th><th></th></tr>
{''.join(grows)}</table>"""
open(f"{VIZ}/argon-image-dungeon-layout.html", "w").write(page)   # the earlier layout experiment; the object page owns argon-image-dungeon.html
print("ok", {a: (passes(a), tot.get(a)) for a in ("img", "img-r2", "img-r3", "img-grid-r3", "direct", "direct-r2", "direct-r3")}, opus_pass, opus_ref)
