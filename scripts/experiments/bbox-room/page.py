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
            judge = f"기준 방 {len(vs)}장 대비 {w}승 {d}무 {l}패" if vs else "채점 전"
            status = "" if r["ok"] else f" · <b>검증 실패</b>: {html.escape('; '.join(r.get('errors', [])[:3]))}"
            cards.append(f"<div class=card><h3>{task} · {r['model']} #{rep}</h3><div class=pair>{imgs}</div>"
                         f"<p class=meta>{r['model']} high · 판정 {judge} · {r['secs']}초 · 토큰 {r['tokens']:,} · 고침 {r['repairs']}회{status}</p></div>")
tot = [sum(t[i] for t in tally.values()) for i in range(4)]
summary = " · ".join(f"{k}: {v[0]}승 {v[1]}무 / {v[3]}" for k, v in tally.items())
page = f"""<!doctype html><meta charset=utf-8><title>bbox 배치 방 시험</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}figcaption{{font-size:12px;color:#999}}.meta{{margin:8px 0 0;color:#bbb}}</style>
<h1>bbox 배치 방 시험 — 모델이 칸 사각형 배치를 쓰고, 코드는 그대로 깐다</h1>
<p class=v>{html.escape(verdict)}</p>
<p>합계 {tot[0]}승 {tot[1]}무 / {tot[3]} ({summary}). 예전: 지금 경로(A) 0/14, GPT 목업(G) 3승 1무 /21. 판정자·프롬프트·기준 방은 img-room 시험과 같다(gpt-6.1-sol, 쌍 비교).</p>
{''.join(cards)}"""
open(f"{VIZ}/bbox-room-test.html", "w").write(page)
print("ok", tot)
