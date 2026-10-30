#!/usr/bin/env python3
"""bbox-room-test page → ~/claude-viz/bbox-room-test.html (images in ~/claude-viz/bboxroom/).
  python3 scripts/experiments/bbox-room/page.py "<one-line verdict>"   (run from the worktree root)"""
import json, os, sys, glob, shutil, subprocess, html
from PIL import Image
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxroom")
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/bboxroom"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
res = json.load(open(f"{RUNS}/results.json")) if os.path.exists(f"{RUNS}/results.json") else {}
ld = lambda n: json.load(open(f"{RUNS}/{n}")) if os.path.exists(f"{RUNS}/{n}") else {}
opus, gopus = ld("results-opus.json"), ld("results-G-opus.json")
def wdl(R, key):
    vs = [v["verdict"] for k, v in R.items() if k.startswith(key + "|")]
    return vs.count(1), vs.count(0), vs.count(-1), len(vs)
fmt = lambda t: f"{t[0]}승 {t[1]}무 {t[2]}패 / {t[3]}" if t[3] else "채점 전"
def agg(R, keys):
    t = [0, 0, 0, 0]
    for k in keys:
        for i, v in enumerate(wdl(R, k)): t[i] += v
    return t
ALL = [f"{a}{r}/{t}" for t in ["boss", "inn"] for a in ["sol", "terra"] for r in ["1", "2"]]
GK = sorted({k.split("|")[0] for k in gopus})
cards, tally = [], {}
for task in ["boss", "inn"]:
    for arm in ["sol", "terra"]:
        for rep in ["1", "2"]:
            g = f"{RUNS}/{arm}{rep}/{task}"; key = f"{arm}{rep}/{task}"; tag = f"{arm}{rep}-{task}"
            if not os.path.exists(f"{g}/RUN.json"):
                cards.append(f"<div class=card><h3>{task} · {arm} #{rep}</h3><p class=meta>아직 실행 중</p></div>"); continue
            r = json.load(open(f"{g}/RUN.json"))
            imgs = ""
            if os.path.exists(f"{g}/layout.json"):
                subprocess.run(["python3", "scripts/experiments/bbox-room/draw_layout.py", f"{g}/layout.json", f"{IMG}/{tag}-layout.png"], check=False)
                imgs += f"<figure><img src='bboxroom/{tag}-layout.png'><figcaption>모델이 쓴 배치(칸 격자, 노란 = 랜드마크, 어두운 띠 = 북쪽 벽면 두 줄)</figcaption></figure>"
            if os.path.exists(f"{g}/map.png"):
                m = Image.open(f"{g}/map.png"); m.resize((m.width * 2, m.height * 2), Image.NEAREST).save(f"{IMG}/{tag}-map.png")
                imgs += f"<figure><img src='bboxroom/{tag}-map.png'><figcaption>그대로 깐 맵(1배 렌더를 2배로)</figcaption></figure>"
            vs = [v["verdict"] for k, v in res.items() if k.startswith(key + "|")]
            w, d, l = vs.count(1), vs.count(0), vs.count(-1)
            t = tally.setdefault(task, [0, 0, 0, 0]); t[0] += w; t[1] += d; t[2] += l; t[3] += len(vs)
            judge = f"sol 판정자 {w}승 {d}무 {l}패 · Opus 판정자 {fmt(wdl(opus, key))}" if vs else "채점 전"
            status = "" if r["ok"] else f" · <b>검증 실패</b>: {html.escape('; '.join(r.get('errors', [])[:3]))}"
            cards.append(f"<div class=card><h3>{task} · {r['model']} #{rep}</h3><div class=pair>{imgs}</div>"
                         f"<p class=meta>{r['model']} high · 판정 {judge} · {r['secs']}초 · 토큰 {r['tokens']:,} · 고침 {r['repairs']}회{status}</p></div>")
tot = [sum(t[i] for t in tally.values()) for i in range(4)]
summary = " · ".join(f"{k}: {v[0]}승 {v[1]}무 / {v[3]}" for k, v in tally.items())
page = f"""<!doctype html><meta charset=utf-8><title>bbox 배치 방 시험</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}figcaption{{font-size:12px;color:#999}}.meta{{margin:8px 0 0;color:#bbb}}table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:4px 10px}}</style>
<h1>bbox 배치 방 시험 — 모델이 칸 사각형 배치를 쓰고, 코드는 그대로 깐다</h1>
<p class=v>{html.escape(verdict)}</p>
<p>합계 {tot[0]}승 {tot[1]}무 / {tot[3]} ({summary}). 예전: 지금 경로(A) 0/14, GPT 목업(G) 3승 1무 /21. 판정자·프롬프트·기준 방은 img-room 시험과 같다(gpt-6.1-sol, 쌍 비교).</p>
<table><tr><th>조건</th><th>판정자 gpt-6.1-sol</th><th>판정자 Opus 5.5 medium</th></tr>
<tr><td>bbox · sol</td><td>{fmt(agg(res, [k for k in ALL if k.startswith("sol")]))}</td><td>{fmt(agg(opus, [k for k in ALL if k.startswith("sol")]))}</td></tr>
<tr><td>bbox · terra</td><td>{fmt(agg(res, [k for k in ALL if k.startswith("terra")]))}</td><td>{fmt(agg(opus, [k for k in ALL if k.startswith("terra")]))}</td></tr>
<tr><td><b>bbox 전체</b></td><td>{fmt(agg(res, ALL))}</td><td>{fmt(agg(opus, ALL))}</td></tr>
<tr><td>예전 GPT 목업(G, {len(GK)}판)</td><td>3승 1무 17패 / 21</td><td>{fmt(agg(gopus, GK))}</td></tr>
<tr><td>예전 지금 경로(A)</td><td>0승 0무 14패 / 14</td><td>—</td></tr></table>
{''.join(cards)}"""
open(f"{VIZ}/bbox-room-test.html", "w").write(page)
print("ok", tot)
