#!/usr/bin/env python3
"""bbox-village page → ~/claude-viz/bbox-village.html (images in ~/claude-viz/bbox-village/).  python3 page.py "<one-line verdict>"  (run from worktree root)"""
import json, os, sys, subprocess, html
from PIL import Image
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxvillage")
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/bbox-village"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
B = json.load(open("scripts/experiments/bbox-village/briefs.json"))
R = json.load(open(f"{RUNS}/results-opus.json")) if os.path.exists(f"{RUNS}/results-opus.json") else {}
def wdl(pred):
    vs = [v["verdict"] for k, v in R.items() if pred(k)]
    return vs.count(1), vs.count(0), vs.count(-1), len(vs)
fmt = lambda t: f"{t[0]}승 {t[1]}무 {t[2]}패 / {t[3]}" if t[3] else "채점 전"
anc = lambda k: k.split("|")[1].startswith("bdv-")
def big(src, dst):
    m = Image.open(src); k = 2 if m.width < 900 else 1; m.resize((m.width * k, m.height * k), Image.NEAREST).save(dst)
cards = []
for brief in ("port", "hill"):
    cards.append(f"<h2>{brief} — {html.escape(B[brief]['en'])}</h2>")
    for arm in ("sol", "terra"):
        for rep in ("1", "2"):
            g = f"{RUNS}/{arm}{rep}/{brief}"; key = f"{arm}{rep}/{brief}"; tag = f"{arm}{rep}-{brief}"
            if not os.path.exists(f"{g}/RUN.json"): cards.append(f"<div class=card><h3>{brief} · {arm} #{rep}</h3><p class=meta>실행 중</p></div>"); continue
            r = json.load(open(f"{g}/RUN.json")); imgs = ""
            if os.path.exists(f"{g}/layout.json"):
                subprocess.run(["python3", "scripts/experiments/bbox-village/draw_layout.py", f"{g}/layout.json", f"{RUNS}/terrain-{brief}/terrain.json", f"{RUNS}/catalog.json", f"{IMG}/{tag}-layout.png"], check=False)
                imgs += f"<figure><img src='bbox-village/{tag}-layout.png'><figcaption>모델이 쓴 배치(빨강 = 건물·노란 점 = 문 앞, 회색 = 길, 갈색 = 흙길·부두, 주황 S = 계단, 노랑 = 밭, 짙은 녹색 = 숲, 흰 테두리 = 구역)</figcaption></figure>"
            if os.path.exists(f"{g}/map.png"):
                big(f"{g}/map.png", f"{IMG}/{tag}-map.png"); imgs += f"<figure><img src='bbox-village/{tag}-map.png'><figcaption>그대로 깐 맵(1배 렌더)</figcaption></figure>"
            st = r.get("stats") or {}
            j = f"기준 마을 8장 대비 {fmt(wdl(lambda k: k.startswith(key + '|') and anc(k)))} · 현행 v2 대비 {fmt(wdl(lambda k: k.startswith(key + '|') and not anc(k)))}"
            bad = "" if r["ok"] else f" · <b>검증 실패</b>: {html.escape('; '.join(r.get('errors', [])[:3]))}"
            cards.append(f"<div class=card><h3>{brief} · {r['model']} #{rep}</h3><div class=pair>{imgs}</div><p class=meta>{r['model']} high · 판정 Opus 5.5 medium: {j} · {r['secs']}초 · 고침 {r['repairs']}회 · 건물 {st.get('buildings','-')} · 계단 {st.get('stairs','-')} · 맨 풀밭 {st.get('bareLandPct','-')}%{bad}</p></div>")
    for arm in ("sol", "terra"):
        g = f"{RUNS}/base-{arm}/{brief}"
        if not os.path.exists(f"{g}/RUN.json"): continue
        r = json.load(open(f"{g}/RUN.json")); imgs = ""
        if os.path.exists(f"{g}/map.png"): big(f"{g}/map.png", f"{IMG}/base-{arm}-{brief}-map.png"); imgs = f"<figure><img src='bbox-village/base-{arm}-{brief}-map.png'><figcaption>현행 v2: 모델은 자리 힌트만, 함수가 옮기고 길·숲·소품을 채운다</figcaption></figure>"
        key = f"base-{arm}/{brief}"
        cards.append(f"<div class='card base'><h3>비교군 · 현행 v2 마을 빌더 · {r['model']}</h3><div class=pair>{imgs}</div><p class=meta>{r['model']} high(자리 힌트) · 판정 Opus: 기준 마을 8장 대비 {fmt(wdl(lambda k: k.startswith(key + '|')))} · {r['secs']}초 · 집 {r.get('houses','-')}</p></div>")
bb = lambda k: not k.startswith("base")
page = f"""<!doctype html><meta charset=utf-8><title>bbox 마을 시험</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{font-size:16px;margin-top:28px}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}.base{{background:#1d2a24}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}figcaption{{font-size:12px;color:#999}}.meta{{margin:8px 0 0;color:#bbb}}td,th{{border:1px solid #444;padding:4px 10px}}table{{border-collapse:collapse}}</style>
<h1>bbox 마을 시험 — 지형은 코드, 마을은 모델이 칸 단위로 쓰고 코드는 그대로 깐다</h1>
<p class=v>{html.escape(verdict)}</p>
<table><tr><th>조건</th><th>기준 마을(bdv 8장) 대비</th><th>현행 v2 대비</th></tr>
<tr><td>bbox · sol</td><td>{fmt(wdl(lambda k: k.startswith('sol') and anc(k)))}</td><td>{fmt(wdl(lambda k: k.startswith('sol') and not anc(k)))}</td></tr>
<tr><td>bbox · terra</td><td>{fmt(wdl(lambda k: k.startswith('terra') and anc(k)))}</td><td>{fmt(wdl(lambda k: k.startswith('terra') and not anc(k)))}</td></tr>
<tr><td><b>bbox 전체</b></td><td>{fmt(wdl(lambda k: bb(k) and anc(k)))}</td><td>{fmt(wdl(lambda k: bb(k) and not anc(k)))}</td></tr>
<tr><td>현행 v2 (비교군)</td><td>{fmt(wdl(lambda k: k.startswith('base') and anc(k)))}</td><td>—</td></tr></table>
<p>판정자 Opus 5.5 medium, 쌍 비교 두 순서(엇갈리면 무). 기준 마을 = 사용자가 조각을 고른 버들항 변형 8곳. 같은 요청·같은 지형(코드 지형 seed 고정)에서 bbox 4판과 현행 v2 2판.</p>
{''.join(cards)}"""
open(f"{VIZ}/bbox-village.html", "w").write(page); print("ok")
