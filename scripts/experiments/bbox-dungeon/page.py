#!/usr/bin/env python3
"""bbox-dungeon page → ~/claude-viz/bbox-dungeon.html (images in ~/claude-viz/bbox-dungeon/).
  python3 scripts/experiments/bbox-dungeon/page.py "<one-line verdict>"   (run from the worktree root)"""
import json, os, sys, subprocess, html
from PIL import Image
HOME = os.path.expanduser("~")
RUNS = os.environ.get("BBOX_RUNS", f"{HOME}/z-project/assistant-whole-game/suite/rooms/runs-bboxdungeon")
VIZ = f"{HOME}/claude-viz"; IMG = f"{VIZ}/bbox-dungeon"; os.makedirs(IMG, exist_ok=True)
verdict = sys.argv[1] if len(sys.argv) > 1 else "진행 중 — 판이 끝나는 대로 채운다."
import glob
res = {}
for o in sorted(glob.glob(f"{RUNS}/results*.json")): res.update(json.load(open(o)))
BR = {"crypt": "교회 밑 지하 묘지", "flooded": "물에 잠긴 동굴 신전", "demon": "마왕성 지하"}
def wdl(key, ref):
    vs = [v["verdict"] for k, v in res.items() if k.startswith(key + "|") and (v["vs"].startswith("v2:") == (ref == "v2"))]
    return [vs.count(1), vs.count(0), vs.count(-1), len(vs)]
fmt = lambda t: f"{t[0]}승 {t[1]}무 {t[2]}패/{t[3]}" if t[3] else "채점 전"
tot = {k: [0, 0, 0, 0] for k in ("bbox-ref", "bbox-v2", "v2-ref")}
cards = []
for brief in BR:
    cards.append(f"<h2>{BR[brief]}</h2>")
    for arm, rep in [("sol", "1"), ("sol", "2"), ("terra", "1"), ("terra", "2"), ("sol", "v2"), ("terra", "v2")]:
        g = f"{RUNS}/{arm}{rep}/{brief}"; key = f"{arm}{rep}/{brief}"; tag = f"{arm}{rep}-{brief}"
        title = f"{'v2 빌더(기준)' if rep == 'v2' else 'bbox #' + rep} · gpt-6.1-{arm}"
        if not os.path.exists(f"{g}/RUN.json"):
            cards.append(f"<div class=card><h3>{title}</h3><p class=meta>실행 중</p></div>"); continue
        r = json.load(open(f"{g}/RUN.json")); imgs = ""
        if rep != "v2" and os.path.exists(f"{g}/layout.json"):
            subprocess.run(["python3", "scripts/experiments/bbox-dungeon/draw_layout.py", f"{g}/layout.json", f"{RUNS}/palette.json", f"{IMG}/{tag}-layout.png"], check=False, capture_output=True)
            if os.path.exists(f"{IMG}/{tag}-layout.png"): imgs += f"<figure><img src='bbox-dungeon/{tag}-layout.png'><figcaption>모델이 쓴 배치 — 방(용도 색)·통로·문(초록, 빨강=잠김)·물/용암/구덩이·노랑=랜드마크·분홍=함정</figcaption></figure>"
        if os.path.exists(f"{g}/map.png"):
            m = Image.open(f"{g}/map.png"); m.resize((m.width * 2, m.height * 2), Image.NEAREST).save(f"{IMG}/{tag}-map.png")
            imgs += f"<figure><img src='bbox-dungeon/{tag}-map.png'><figcaption>{'그대로 깐 맵' if rep != 'v2' else '같은 요청을 지금 v2 경로(설계→author_dungeon)로 지은 맵'} (1배 렌더 ×2)</figcaption></figure>"
        a, b = wdl(key, "ref"), wdl(key, "v2")
        if rep == "v2": tot["v2-ref"] = [x + y for x, y in zip(tot["v2-ref"], a)]
        else: tot["bbox-ref"] = [x + y for x, y in zip(tot["bbox-ref"], a)]; tot["bbox-v2"] = [x + y for x, y in zip(tot["bbox-v2"], b)]
        judge = f"기준 던전 5장 대비 {fmt(a)}" + ("" if rep == "v2" else f" · v2 빌더 대비 {fmt(b)}")
        st = r.get("stats") or {}
        struct = "" if rep == "v2" else f" · 방 {st.get('rooms')} 통로 {st.get('corridors')} 문 {st.get('doors')}(잠김 {st.get('locked')}) 위험 {st.get('hazards')} 기물 {st.get('pieces')} 상자 {st.get('chests')}"
        status = "" if r["ok"] else f" · <b>검증 실패</b>: {html.escape('; '.join(r.get('errors', [])[:3]))[:400]}"
        cards.append(f"<div class=card><h3>{title}</h3><div class=pair>{imgs}</div><p class=meta>gpt-6.1-{arm} high · 판정 Opus 5.5 medium: {judge} · {r['secs']}초 · 고침 {r['repairs']}회{struct}{status}</p></div>")
page = f"""<!doctype html><meta charset=utf-8><title>bbox 던전 층 시험</title>
<style>body{{background:#16161c;color:#ddd;font:14px/1.5 sans-serif;margin:20px}}h1{{font-size:20px}}h2{{font-size:17px;margin-top:28px;border-bottom:1px solid #444}}.v{{font-size:17px;color:#ffd866;margin:6px 0 4px}}
.card{{background:#222230;border-radius:8px;padding:12px;margin:14px 0}}h3{{margin:0 0 8px;font-size:15px}}.pair{{display:flex;gap:12px;align-items:flex-start}}
figure{{margin:0;flex:1 1 0;min-width:0}}img{{image-rendering:pixelated;width:100%;display:block}}figcaption{{font-size:12px;color:#999}}.meta{{margin:8px 0 0;color:#bbb}}</style>
<h1>bbox 던전 층 시험 — 모델이 던전 한 층을 칸 단위로 쓰고, 코드는 그대로 깔고 검사만 한다</h1>
<p class=v>{html.escape(verdict)}</p>
<p>bbox 대 기준 던전(사람이 고른 버들항 던전 5장): {fmt(tot['bbox-ref'])} · bbox 대 지금 v2 빌더(같은 요청): {fmt(tot['bbox-v2'])} · 참고: v2 빌더 대 기준 던전 {fmt(tot['v2-ref'])}. 판정은 Opus 5.5 medium 쌍 비교(두 순서, 엇갈리면 무).</p>
{''.join(cards)}"""
open(f"{VIZ}/bbox-dungeon.html", "w").write(page)
print("ok", tot)
