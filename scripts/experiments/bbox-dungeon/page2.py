#!/usr/bin/env python3
"""bbox-dungeon round 2 page → ~/claude-viz/bbox-dungeon-2.html (images in ~/claude-viz/bbox-dungeon-2/). Per brief: round 1 vs round 2 side by side.
  python3 scripts/experiments/bbox-dungeon/page2.py "<one-line verdict>"   (run from the worktree root)"""
import json, os, sys, subprocess, html, shutil
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
R1 = f"{S}/rooms/runs-bboxdungeon"; RUNS = os.environ.get("BBOX_RUNS2", f"{S}/rooms/runs-bboxdungeon2")
VIZ = os.path.expanduser("~/claude-viz"); IMG = f"{VIZ}/bbox-dungeon-2"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
res = json.load(open(f"{RUNS}/results.json")) if os.path.exists(f"{RUNS}/results.json") else {}
res1 = {}
for fn in ("results.json", "results-2.json"):
    if os.path.exists(f"{R1}/{fn}"): res1.update(json.load(open(f"{R1}/{fn}")))
BR = {"crypt": "교회 밑 지하 묘지", "flooded": "물에 잠긴 동굴 신전", "demon": "마왕성 지하", "cave": "자연 동굴 (새 요청)"}
def wdl(R, key, kind):
    vs = [v["verdict"] for k, v in R.items() if k.startswith(key + "|") and ((kind == "ref" and ":" not in v["vs"]) or (kind != "ref" and v["vs"].startswith(kind + ":")))]
    return [vs.count(1), vs.count(0), vs.count(-1), len(vs)]
fmt = lambda t: f"{t[0]}승 {t[1]}무 {t[2]}패" if t[3] else "채점 전"
add = lambda a, b: [x + y for x, y in zip(a, b)]
tot = {k: [0, 0, 0, 0] for k in ("r2-ref", "r1-ref", "r2-r1", "r2-v2", "v2-ref")}
box = {"r1": [], "r2": []}
def r1box(brief, armrep):
    p = f"{R1}/{armrep}/{brief}/layout.json"
    if not os.path.exists(p): return None
    L = json.load(open(p)); rs = L.get("rooms", [])
    return sum(1 for r in rs if len(r.get("rects", [r])) == 1) / max(1, len(rs))
def fig(src, tag, cap):
    if not os.path.exists(src): return f"<figure class=empty><figcaption>{cap} — 없음</figcaption></figure>"
    shutil.copyfile(src, f"{IMG}/{tag}.png"); return f"<figure><a href='bbox-dungeon-2/{tag}.png'><img src='bbox-dungeon-2/{tag}.png'></a><figcaption>{cap}</figcaption></figure>"
cards = []
for brief in BR:
    cards.append(f"<h2>{BR[brief]}</h2>")
    for arm, rep in [("sol", "1"), ("sol", "2"), ("terra", "1"), ("terra", "2")]:
        ar = f"{arm}{rep}"; g = f"{RUNS}/{ar}/{brief}"; key = f"{ar}/{brief}"
        r = json.load(open(f"{g}/RUN.json")) if os.path.exists(f"{g}/RUN.json") else None
        st = (r or {}).get("stats") or {}
        b1 = r1box(brief, ar)
        if b1 is not None: box["r1"].append(b1)
        if r and r["ok"] and "boxRatio" in st: box["r2"].append(st["boxRatio"])
        left = fig(f"{R1}/{ar}/{brief}/map.png", f"r1-{ar}-{brief}", f"1차 (네모 칸 배치) · 네모 방 비율 {b1:.0%} · 기준 대비 {fmt(wdl(res1, key, 'ref'))}" if b1 is not None else "1차")
        if brief == "cave": left = fig(f"{RUNS}/{arm}v2/cave/map.png", f"v2-{arm}-cave", f"지금 v2 빌더 (같은 요청, {arm}) · 기준 대비 {fmt(wdl(res, f'{arm}v2/cave', 'ref'))}")
        if not r: right = "<figure class=empty><figcaption>2차 실행 중</figcaption></figure>"
        elif not r["ok"]: right = f"<figure class=empty><figcaption>2차 검증 실패(고침 {r['repairs']}회): {html.escape('; '.join(r.get('errors', [])[:2]))[:300]}</figcaption></figure>"
        else:
            a, c, v = wdl(res, key, "ref"), wdl(res, key, "r1"), wdl(res, key, "v2")
            tot["r2-ref"] = add(tot["r2-ref"], a); tot["r2-r1"] = add(tot["r2-r1"], c); tot["r2-v2"] = add(tot["r2-v2"], v)
            sk = ", ".join(f"{k} {n}" for k, n in (st.get("shapeKinds") or {}).items())
            right = fig(f"{g}/map.png", f"r2-{ar}-{brief}", f"2차 (모양 어휘) · 네모 방 비율 {st.get('boxRatio', 0):.0%} · 기준 대비 {fmt(a)} · 1차 대비 {fmt(c)} · v2 대비 {fmt(v)}<br>모양 {sk} · 거친 가장자리 {st.get('roughEdges')} · 곡선 통로 {st.get('curves')} · 바위섬 {st.get('rocks')} · 물/용암/구덩이 {st.get('hazards')} · 다리 {st.get('bridges')} · 단 {st.get('ledges')}·계단 {st.get('stairs')} · 기물 {st.get('pieces')} · {r['secs']}초 · 고침 {r['repairs']}회")
        if brief != "cave": tot["r1-ref"] = add(tot["r1-ref"], wdl(res1, key, "ref"))
        cards.append(f"<div class=card><h3>gpt-6.1-{arm} #{rep}</h3><div class=pair>{left}{right}</div></div>")
for v in ("solv2", "terrav2"): tot["v2-ref"] = add(tot["v2-ref"], wdl(res, f"{v}/cave", "ref"))
avg = lambda l: f"{sum(l) / len(l):.0%}" if l else "-"
page = f"""<!doctype html><meta charset=utf-8><title>bbox 던전 2차 — 모양 어휘</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{font-size:17px;margin-top:28px;border-bottom:1px solid #444}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}figcaption{{font-size:12px;color:#aaa;margin-top:4px}}.empty{{background:#2a2a36;padding:30px;border-radius:6px}}</style>
<h1>bbox 던전 2차 — 모델이 모양(타원·다각형·동굴 덩이·거친 가장자리·곡선 통로·바위섬·연못·단과 계단)을 고르고, 코드는 그대로 찍고 검사만 한다</h1>
<p class=v>{html.escape(verdict)}</p>
<p>왼쪽 = 1차(네모 칸 배치), 오른쪽 = 2차. 「자연 동굴」은 1차가 없어 왼쪽에 지금 v2 빌더 맵을 둔다. 판정 Opus 5.5 medium 쌍 비교(두 순서, 엇갈리면 무).<br>
2차 대 기준 던전 5장 {fmt(tot['r2-ref'])} (1차는 {fmt(tot['r1-ref'])}) · 2차 대 1차 {fmt(tot['r2-r1'])} · 2차 대 v2 빌더 {fmt(tot['r2-v2'])} · 참고 v2 동굴 대 기준 {fmt(tot['v2-ref'])}<br>
네모 방 비율(방 중 매끈한 직사각형 하나뿐인 방의 몫, 강제 아님): 1차 평균 {avg(box['r1'])} → 2차 평균 {avg(box['r2'])}</p>
{''.join(cards)}"""
open(f"{VIZ}/bbox-dungeon-2.html", "w").write(page)
print("ok", tot, avg(box["r1"]), avg(box["r2"]))
