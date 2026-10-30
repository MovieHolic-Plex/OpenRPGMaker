#!/usr/bin/env python3
"""img-room-test 결과 페이지: ~/claude-viz/img-room-test.html + ~/claude-viz/imgroom/*.jpg
  python3 page.py [runs dir] [verdict html file]"""
import json, os, sys, glob, re, html
from PIL import Image
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
RUNS = sys.argv[1] if len(sys.argv) > 1 else f"{S}/rooms/runs-imgroom"
VERDICT = open(sys.argv[2]).read() if len(sys.argv) > 2 else ""
V = os.path.expanduser("~/claude-viz"); IMG = f"{V}/imgroom"; os.makedirs(IMG, exist_ok=True)
res = json.load(open(f"{RUNS}/results.json"))
sys.path.insert(0, f"{S}/mapvqa"); import mapvqa

def jpg(src, name, up=True, maxw=1100):
    im = Image.open(src).convert("RGB")
    if up:
        k = max(1, min(4, 700 // max(im.size)))
        im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    if im.width > maxw: im = im.resize((maxw, round(im.height * maxw / im.width)), Image.LANCZOS)
    im.save(f"{IMG}/{name}.jpg", quality=88); return f"imgroom/{name}.jpg"

rows = []
for g in sorted(glob.glob(f"{RUNS}/[AB][0-9]/*/*")):
    cond, arm, task = g.split("/")[-3:]
    key = f"{cond}/{arm}/{task}"; slug = key.replace("/", "-")
    r = dict(key=key, cond=cond[0], rep=cond[1:], arm=arm, task=task)
    run = open(f"{g}/RUN.txt").read() if os.path.exists(f"{g}/RUN.txt") else ""
    m = re.search(r"build_s=(\d+)", run); r["build_s"] = int(m.group(1)) if m else None
    if os.path.exists(f"{g}/mockup.json"):
        mj = json.loads(open(f"{g}/mockup.json").read().strip().splitlines()[-1]); r["img_s"] = round(mj["ms"] / 1000); r["img_model"] = mj["model"]
        r["mock"] = jpg(f"{g}/mockup.png", f"{slug}-mockup", up=False, maxw=900)
    if os.path.exists(f"{g}/room/map.png"):
        r["map"] = jpg(f"{g}/room/map.png", f"{slug}-map")
        mm = json.load(open(f"{g}/room/measure.json")); r["size"] = mm.get("size"); r["tileset"] = mm.get("tilesetId")
    tf = f"{g}/session/turns/001.json"
    if os.path.exists(tf):
        t = json.load(open(tf)); st = (t.get("done") or [{}])[0].get("stats", {})
        r["agent_s"] = round((st.get("ms") or 0) / 1000); r["cost"] = st.get("costUsd"); u = st.get("usage") or {}
        r["tok"] = (u.get("input", 0) + u.get("output", 0) + u.get("cacheRead", 0) + u.get("cacheWrite", 0)); r["out_tok"] = u.get("output", 0)
        r["tools"] = [c.get("name") for c in t.get("toolCalls", [])]
        ans = t.get("answer") or ""; r["answer"] = ans if isinstance(ans, str) else json.dumps(ans, ensure_ascii=False)
    pairs = [v for k, v in res.items() if k.startswith(key + "|") and "anchor" in v]
    r["w"] = sum(v["verdict"] > 0 for v in pairs); r["t"] = sum(v["verdict"] == 0 for v in pairs); r["l"] = sum(v["verdict"] < 0 for v in pairs); r["n"] = len(pairs)
    r["judge_cost"] = round(sum(j.get("cost", 0) for v in pairs for j in v["judges"].values()), 3)
    r["whys"] = [(v["anchor"], v["verdict"], (list(v["judges"].values())[0].get("why") or [""])[0]) for v in pairs]
    fo = res.get(key + "|follow"); r["follow"] = (fo or {}).get("follow")
    rows.append(r)

def agg(sel):
    w = sum(r["w"] for r in sel); t = sum(r["t"] for r in sel); l = sum(r["l"] for r in sel); n = w + t + l
    return f"{w}승 {t}무 {l}패 / {n}쌍 (승률 {w / n:.0%})" if n else "-"
summary = []
for task in ("boss", "inn"):
    for label, f in (("A terra (기존)", lambda r: r["cond"] == "A" and r["arm"] == "terra"), ("B terra (목업)", lambda r: r["cond"] == "B" and r["arm"] == "terra"), ("B opus (목업)", lambda r: r["cond"] == "B" and r["arm"] == "opus")):
        sel = [r for r in rows if r["task"] == task and f(r)]
        fol = [r["follow"]["overall"] for r in sel if r.get("follow")]
        summary.append((task, label, len(sel), agg(sel), (sum(fol) / len(fol)) if fol else None,
                        round(sum(r.get("agent_s") or 0 for r in sel) / max(1, len(sel))), round(sum(r.get("img_s") or 0 for r in sel) / max(1, len(sel)))))
anchors = {a["id"]: jpg(a["png"], f"anchor-{a['id']}") for k in ("dungeon", "room-hall") for a in mapvqa.anchors_for(k)}

E = html.escape
def card(r):
    fo = r.get("follow") or {}
    cost = f"${r['cost']:.2f} (Opus CLI 환산)" if r.get("cost") is not None else f"토큰 {r.get('tok', 0):,} (출력 {r.get('out_tok', 0):,}) — terra 단가 없음"
    whys = "".join(f"<li><b>{E(a)}</b> {'승' if v > 0 else '무' if v == 0 else '패'} — {E((w or '')[:220])}</li>" for a, v, w in r["whys"])
    mock = f"<figure><img src='{r['mock']}'><figcaption>목업 ({E(r.get('img_model',''))}, {r.get('img_s')}초)</figcaption></figure>" if r.get("mock") else "<figure class=nomock><figcaption>목업 없음 (A)</figcaption></figure>"
    built = f"<figure><img src='{r['map']}'><figcaption>지은 방 {r.get('size')} · {E(r.get('tileset') or '')}</figcaption></figure>" if r.get("map") else "<figure><figcaption>그림 없음</figcaption></figure>"
    follow = f"<p class=follow>목업 충실도(gpt-6.1-sol): 외곽 {fo.get('outline')} · 구역 {fo.get('zones')} · 랜드마크 {fo.get('landmark')} · <b>종합 {fo.get('overall')}/10</b> — {E(fo.get('why') or '')}</p>" if fo else ""
    return f"""<section class=run><h3>{E(r['key'])}</h3><div class=pair>{mock}{built}</div>
<p class=score>기준 방 대비: <b>{r['w']}승 {r['t']}무 {r['l']}패</b> / {r['n']}쌍 · 판정 비용 ${r['judge_cost']}</p>{follow}
<p class=meta>시간: 목업 {r.get('img_s') or 0}초 · 조수 {r.get('agent_s')}초 (세션 전체 {r.get('build_s')}초) · 비용: {cost} · 도구: {E(' '.join(r.get('tools') or []))}</p>
<details><summary>판정자 이유 · 조수 보고</summary><ul>{whys}</ul><pre>{E((r.get('answer') or '')[:2500])}</pre></details></section>"""

tbl = "".join(f"<tr><td>{'보스 방' if t == 'boss' else '여관 1층'}</td><td>{E(l)}</td><td>{n}</td><td>{E(a)}</td><td>{'' if f is None else f'{f:.1f}/10'}</td><td>{s}초</td><td>{i}초</td></tr>" for t, l, n, a, f, s, i in summary)
anc = "".join(f"<figure><img src='{p}'><figcaption>{E(k)}</figcaption></figure>" for k, p in anchors.items())
out = f"""<!doctype html><meta charset=utf-8><title>img-room-test — 목업 먼저 그리기 실험</title>
<style>body{{font:14px/1.5 system-ui,sans-serif;background:#16171b;color:#e6e6e6;margin:20px;max-width:1500px}}h1{{font-size:22px}}
.verdict{{background:#22252c;border-left:4px solid #e0b040;padding:10px 16px;margin:12px 0}}table{{border-collapse:collapse}}td,th{{border:1px solid #444;padding:4px 10px}}
.run{{border-top:1px solid #333;padding:10px 0}}.pair{{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}}figure{{margin:0}}figure img{{max-width:720px;max-height:560px;image-rendering:pixelated;border:1px solid #333}}
figcaption{{color:#aaa;font-size:12px}}.nomock{{width:200px;height:80px;border:1px dashed #444;display:flex;align-items:center;justify-content:center}}.meta{{color:#aaa;font-size:12px}}
.anchors{{display:flex;gap:10px;flex-wrap:wrap}}.anchors img{{max-width:300px}}pre{{white-space:pre-wrap;font-size:12px;color:#bbb}}</style>
<h1>img-room-test — 칩셋 조각 → 이미지 모델 목업 → 조수가 목업대로 짓기</h1>
<div class=verdict>{VERDICT}</div>
<h2>요약 (판정자 gpt-6.1-sol, 기준 방과 쌍 비교·순서 바꿔 두 번)</h2>
<table><tr><th>과제</th><th>조건</th><th>판</th><th>기준 방 대비</th><th>목업 충실도</th><th>조수 평균</th><th>목업 평균</th></tr>{tbl}</table>
<p class=meta>보스 방은 보스 방 기준 그림이 없어 던전 기준 5장(bdv-*)과 비교, 여관은 room-hall 기준 2장(rooms2-28·29). 터라 비용은 opencodex 구독이라 달러 대신 토큰. 목업 생성은 Google 구독 경로(gemini-3.1-flash-image) 한 번.</p>
{''.join(card(r) for r in rows)}
<h2>기준 방(판정 기준)</h2><div class=anchors>{anc}</div>"""
open(f"{V}/img-room-test.html", "w").write(out); print("ok", len(rows))
