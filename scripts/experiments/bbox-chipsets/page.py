#!/usr/bin/env python3
"""bbox-chipsets page → ~/claude-viz/bbox-chipsets.html (images in ~/claude-viz/bbox-chipsets/).
  python3 scripts/experiments/bbox-chipsets/page.py "<one-line verdict>"   (run from the worktree root)"""
import json, os, sys, subprocess, html
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from places import PLACES
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bbox-chipsets")
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/bbox-chipsets"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
NOTES = json.load(open(f"{RUNS}/notes.json")) if os.path.exists(f"{RUNS}/notes.json") else {}
res = json.load(open(f"{RUNS}/results-opus.json")) if os.path.exists(f"{RUNS}/results-opus.json") else {}
def wdl(prefix):
    vs = [v["verdict"] for k, v in res.items() if k.startswith(prefix)]
    return vs.count(1), vs.count(0), vs.count(-1), len(vs)
fmt = lambda t: f"{t[0]}승 {t[1]}무 {t[2]}패 / {t[3]}" if t[3] else "채점 전"
def big(src, dst, k=2):
    m = Image.open(src); m.resize((m.width * k, m.height * k), Image.NEAREST).save(dst)
secs, rows = [], []
tot = [0, 0, 0, 0]
for place, P in PLACES.items():
    t = [0, 0, 0, 0]
    for k, v in res.items():
        if k.split("|")[0].endswith("/" + place): i = {1: 0, 0: 1, -1: 2}[v["verdict"]]; t[i] += 1; t[3] += 1
    for i in range(4): tot[i] += t[i]
    rows.append(f"<tr><td>{place}</td><td>{P['tileset']}</td><td>{html.escape(NOTES.get(place, ''))}</td><td>{fmt(t)}</td></tr>")
    refs = ""
    for a in P["anchors"]:
        n = a.split(":")[1]
        if os.path.exists(f"{RUNS}/refs/{n}.png"):
            big(f"{RUNS}/refs/{n}.png", f"{IMG}/ref-{n}.png", 1); refs += f"<figure class=ref><img src='bbox-chipsets/ref-{n}.png'><figcaption>기준 {n}</figcaption></figure>"
    cards = []
    for arm in ["sol", "terra"]:
        for rep in ["1", "2"]:
            g = f"{RUNS}/{arm}{rep}/{place}"; tag = f"{arm}{rep}-{place}"
            if not os.path.exists(f"{g}/RUN.json"):
                if os.path.exists(f"{g}/prompt.txt"): cards.append(f"<div class=card><h3>{place} · {arm} #{rep}</h3><p class=meta>실행 중</p></div>")
                continue
            r = json.load(open(f"{g}/RUN.json"))
            imgs = ""
            if os.path.exists(f"{g}/layout.json"):
                subprocess.run(["python3", "scripts/experiments/bbox-chipsets/draw_layout.py", f"{g}/layout.json", f"{IMG}/{tag}-layout.png", f"{RUNS}/cat/{place}.raw.json"], check=False, capture_output=True)
                if os.path.exists(f"{IMG}/{tag}-layout.png"): imgs += f"<figure><img src='bbox-chipsets/{tag}-layout.png'><figcaption>모델이 쓴 배치(노랑 = 랜드마크, 어두운 띠 = 북쪽 벽면 두 줄)</figcaption></figure>"
            if os.path.exists(f"{g}/map.png"):
                big(f"{g}/map.png", f"{IMG}/{tag}-map.png"); imgs += f"<figure><img src='bbox-chipsets/{tag}-map.png'><figcaption>그대로 깐 맵(1배 렌더를 2배로)</figcaption></figure>"
            status = "" if r["ok"] else f" · <b>검증 실패</b>: {html.escape('; '.join(r.get('errors', [])[:3]))[:300]}"
            cards.append(f"<div class=card><h3>{place} · {r['model']} #{rep}</h3><div class=pair>{imgs}</div>"
                         f"<p class=meta>{r['model']} high · Opus 5.5 medium 판정 {fmt(wdl(f'{arm}{rep}/{place}|'))} · {r['secs']}초 · 토큰 {r['tokens']:,} · 고침 {r['repairs']}회{status}</p></div>")
    secs.append(f"<h2>{place} — {P['tileset']}</h2><p>{html.escape(P['request'])}</p><p class=meta>{html.escape(NOTES.get(place, ''))}</p><div class=refs>{refs}</div>{''.join(cards)}")
page = f"""<!doctype html><meta charset=utf-8><title>bbox 배치 — 다른 칩셋</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{font-size:17px;margin-top:28px;border-top:1px solid #444;padding-top:12px}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}.refs{{display:flex;gap:10px;align-items:flex-start}}.refs figure{{flex:0 1 auto}}.refs img{{width:auto;max-width:100%}}figcaption{{font-size:12px;color:#999}}.meta{{margin:8px 0 0;color:#bbb}}table{{border-collapse:collapse;margin:8px 0}}td,th{{border:1px solid #444;padding:4px 10px;vertical-align:top}}</style>
<h1>bbox 배치 시험 — 다른 번들 칩셋에도 통하나 (카탈로그를 칩셋 메타데이터에서 자동 생성)</h1>
<p class=v>{html.escape(verdict)}</p>
<p>합계 {fmt(tot)} (판정자 Opus 5.5 medium, 그 칩셋의 기존 예제 맵과 쌍 비교, 두 순서). 원판(atlas_biome_interior, 손 목록): Opus 16승 6무 / 28.</p>
<table><tr><th>장소</th><th>칩셋</th><th>메타데이터로 카탈로그가 됐나</th><th>Opus 판정</th></tr>{''.join(rows)}</table>
{''.join(secs)}"""
open(f"{VIZ}/bbox-chipsets.html", "w").write(page)
print("ok", tot)
