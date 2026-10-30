#!/usr/bin/env python3
"""img-room-test 간단 페이지(GPT Image 목업 판만): ~/claude-viz/img-room-test.html + ~/claude-viz/imgroom/G*.jpg
  python3 page_gpt.py <runs dir> "<한 줄 결론>"   (A·gemini 판 자료는 디스크에 그대로 둔다)"""
import json, os, sys, glob, html
from PIL import Image
RUNS, VERDICT = sys.argv[1], sys.argv[2]
V = os.path.expanduser("~/claude-viz"); IMG = f"{V}/imgroom"; os.makedirs(IMG, exist_ok=True)
res = json.load(open(f"{RUNS}/results.json")); E = html.escape
def jpg(src, name, up):
    im = Image.open(src).convert("RGB")
    if up: k = max(1, min(4, 640 // max(im.size))); im = im.resize((im.width * k, im.height * k), Image.NEAREST)
    if im.width > 900: im = im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS)
    im.save(f"{IMG}/{name}.jpg", quality=88); return f"imgroom/{name}.jpg"
cards = []
for g in sorted(glob.glob(f"{RUNS}/G[0-9]/*/*"), key=lambda p: (p.split("/")[-1], p.split("/")[-2] != "terra", p)):
    cond, arm, task = g.split("/")[-3:]; key = f"{cond}/{arm}/{task}"; slug = key.replace("/", "-")
    if not os.path.exists(f"{g}/room/map.png") or not os.path.exists(f"{g}/mockup.png"): continue
    mj = json.loads(open(f"{g}/mockup.json").read().strip().splitlines()[-1])
    pairs = [v for k, v in res.items() if k.startswith(key + "|") and "anchor" in v]
    w = sum(v["verdict"] > 0 for v in pairs); t = sum(v["verdict"] == 0 for v in pairs); l = sum(v["verdict"] < 0 for v in pairs)
    fo = (res.get(key + "|follow") or {}).get("follow") or {}
    model = "gpt-6.1-terra high" if arm == "terra" else "Opus 5.5 medium"
    line = f"{'보스 방' if task == 'boss' else '여관 1층'} · {model} · 기준 방 대비 {w}승 {t}무 {l}패 · 목업 충실도 {fo.get('overall', '?')}/10"
    cards.append(f"<section><p>{E(line)}</p><div class=pair><figure><img src='{jpg(f'{g}/mockup.png', slug + '-mockup', False)}'><figcaption>GPT 목업 ({E(mj.get('model', ''))})</figcaption></figure>"
                 f"<figure><img src='{jpg(f'{g}/room/map.png', slug + '-map', True)}'><figcaption>지은 방</figcaption></figure></div></section>")
open(f"{V}/img-room-test.html", "w").write(f"""<!doctype html><meta charset=utf-8><title>img-room-test</title>
<style>body{{font:15px/1.5 system-ui,sans-serif;background:#16171b;color:#e6e6e6;margin:20px}}.v{{font-weight:600;background:#22252c;border-left:4px solid #e0b040;padding:8px 14px}}
section{{border-top:1px solid #333;padding:10px 0}}.pair{{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}}figure{{margin:0}}img{{max-width:680px;max-height:560px;image-rendering:pixelated}}figcaption{{color:#999;font-size:12px}}</style>
<p class=v>{E(VERDICT)}</p>{''.join(cards)}""")
print("ok", len(cards))
