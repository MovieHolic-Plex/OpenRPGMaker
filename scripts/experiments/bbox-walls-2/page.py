#!/usr/bin/env python3
"""bbox-walls page -> ~/claude-viz/bbox-walls.html (images in ~/claude-viz/bbox-walls/).
  python3 scripts/experiments/bbox-walls/page.py "<one-line verdict>"   (from the worktree root)"""
import json, os, sys, subprocess, html, shutil
from PIL import Image
HOME = os.path.expanduser("~"); S = f"{HOME}/z-project/assistant-whole-game/suite"
RUNS = os.environ.get("BW_RUNS", f"{S}/rooms/runs-bboxwalls"); BASE = f"{S}/rooms/runs-bboxroom"
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/bbox-walls"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
ld = lambda p: json.load(open(p)) if os.path.exists(p) else {}
res, wal, bopus = ld(f"{RUNS}/results.json"), ld(f"{RUNS}/walls.json"), ld(f"{BASE}/results-opus.json")
TASKS = ["inn", "library", "jail", "manor"]; KO = {"inn": "여관", "library": "도서관", "jail": "감옥", "manor": "저택"}
def wdl(R, keys):
    vs = [v["verdict"] for k, v in R.items() if k.split("|")[0] in keys]
    return vs.count(1), vs.count(0), vs.count(-1), len(vs)
fmt = lambda t: f"{t[0]}승 {t[1]}무 {t[2]}패 / {t[3]}" if t[3] else "채점 전"
def wavg(keys):
    v = [wal[k]["walls"] for k in keys if k in wal and isinstance(wal[k].get("walls"), (int, float))]
    return f"{sum(v)/len(v):.1f} ({len(v)}장)" if v else "—"
rows, cards = [], []
for t in TASKS:
    for arm in ["sol", "terra"]:
        keys = [f"{arm}{r}/{t}" for r in "12"]
        rows.append(f"<tr><td>{KO[t]} · {arm}</td><td>{fmt(wdl(res, keys))}</td><td>{wavg(keys)}</td></tr>")
    if t == "inn":
        bk = [f"{a}{r}/inn" for a in ["sol", "terra"] for r in "12"]
        rows.append(f"<tr class=base><td>여관 · 예전 bbox (사각형 영역)</td><td>{fmt(wdl(bopus, bk))}</td><td>{wavg(['bbox:' + k for k in bk])}</td></tr>")
    for arm in ["sol", "terra"]:
        for rep in "12":
            g = f"{RUNS}/{arm}{rep}/{t}"; key = f"{arm}{rep}/{t}"; tag = f"{arm}{rep}-{t}"
            if not os.path.exists(f"{g}/RUN.json"):
                cards.append(f"<div class=card><h3>{KO[t]} · {arm} #{rep}</h3><p class=meta>실행 중</p></div>"); continue
            r = json.load(open(f"{g}/RUN.json")); imgs = ""
            stf = f"{g}/RUN.json" if r.get("stats") else max([f"{g}/check-{i}.json" for i in range(3) if os.path.exists(f"{g}/check-{i}.json")])
            if os.path.exists(f"{g}/layout.json") and (json.load(open(stf)).get("stats") or {}).get("wallGrid"):
                subprocess.run(["python3", "scripts/experiments/bbox-walls/draw_layout.py", f"{g}/layout.json", stf, f"{IMG}/{tag}-layout.png"], check=False)
                imgs += f"<figure><img src='bbox-walls/{tag}-layout.png'><figcaption>모델이 쓴 벽 배치 (회색 = 바깥벽, 색 띠 = 칸막이, 초록 = 문, 어두운 띠 = 벽면 두 줄, 주황 = 벽 물건)</figcaption></figure>"
            if os.path.exists(f"{g}/map.png"):
                m = Image.open(f"{g}/map.png"); m.resize((m.width * 2, m.height * 2), Image.NEAREST).save(f"{IMG}/{tag}-map.png")
                imgs += f"<figure><img src='bbox-walls/{tag}-map.png'><figcaption>그대로 깐 맵 (1배 렌더를 2배로)</figcaption></figure>"
            w = wal.get(key) or {}
            judge = f"Opus 쌍 비교 {fmt(wdl(res, [key]))}" + (f" · 벽 점수 {w.get('walls')}/10 (방 {w.get('rooms')}, 틈 {w.get('gaps')}, 뜬 물건 {w.get('floating')}) — {html.escape(str(w.get('why', '')))}" if w else "")
            status = "" if r["ok"] else f" · <b>검증 실패</b>: {html.escape('; '.join(r.get('errors', [])[:3]))}"
            cards.append(f"<div class=card><h3>{KO[t]} · {r['model']} #{rep}</h3><div class=pair>{imgs}</div>"
                         f"<p class=meta>{r['model']} high · 판정 Opus 5.5 medium: {judge} · {r['secs']}초 · 고침 {r['repairs']}회 (오류 수 {r.get('errorsPerCall')}){status}</p></div>")
bl = []
for k in ["sol1", "terra2"]:
    if os.path.exists(f"{VIZ}/bboxroom/{k}-inn-map.png"):
        shutil.copy(f"{VIZ}/bboxroom/{k}-inn-map.png", f"{IMG}/base-{k}-inn-map.png"); bl.append(f"<figure><img src='bbox-walls/base-{k}-inn-map.png'><figcaption>예전 bbox 여관 {k}</figcaption></figure>")
page = f"""<!doctype html><meta charset=utf-8><title>bbox 벽 시험</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}figcaption{{font-size:12px;color:#999}}.meta{{margin:8px 0 0;color:#bbb}}
table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:4px 10px}}tr.base td{{color:#9ab}}</style>
<h1>bbox 벽 시험 — 벽을 배치의 일급 요소로: 바깥벽 고리 · 칸막이 · 벽 위 문 · 벽에 묶인 물건</h1>
<p class=v>{html.escape(verdict)}</p>
<p>모델(gpt-6.1-sol / terra high)이 벽 고리·칸막이 선·문·방 이름표·벽 물건을 칸 단위로 쓰고, 코드는 그대로 깔고 검사만 한다(벽 닫힘·문이 벽 위·벽 물건이 벽면에 닿음·모든 방 도달, 영어 Rejected 최대 2회). 판정 Opus 5.5 medium, 기준 방과 쌍 비교(두 순서) + 벽 점수(0~10).</p>
<table><tr><th>조건</th><th>Opus 쌍 비교</th><th>Opus 벽 점수 평균</th></tr>{''.join(rows)}</table>
<div class=card><h3>비교용: 예전 bbox 여관(사각형 영역)</h3><div class=pair>{''.join(bl)}</div></div>
{''.join(cards)}"""
open(f"{VIZ}/bbox-walls.html", "w").write(page); print("ok")
