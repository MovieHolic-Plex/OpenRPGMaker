#!/usr/bin/env python3
"""img-room-test 페이지(조건 O만: 자유 GPT 목업 → 없는 물건 object-gen → 조각 표 → 지은 방): ~/claude-viz/img-room-test.html + ~/claude-viz/imgroom/O*.jpg
  python3 page_o.py <runs dir> "<한 줄 결론>"   (A·B·G·T 판 자료는 디스크에 그대로 둔다)"""
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
def strip(task):
    fs = sorted(glob.glob(f"{RUNS}/O-prep/{task}/objects/*.png")); ims = [Image.open(f).convert("RGBA") for f in fs]
    k = 3; W = sum(i.width * k + 10 for i in ims); H = max(i.height * k for i in ims)
    out = Image.new("RGBA", (W, H), (34, 36, 44, 255)); x = 0
    for i in ims: out.alpha_composite(i.resize((i.width * k, i.height * k), Image.NEAREST), (x, H - i.height * k)); x += i.width * k + 10
    out.convert("RGB").save(f"{IMG}/O-{task}-objects.png"); return f"imgroom/O-{task}-objects.png"
MODEL = {"sol": "gpt-6.1-sol high", "terra": "gpt-6.1-terra high (참고)", "opus": "Opus 5.5 medium"}
cards = []
for g in sorted(glob.glob(f"{RUNS}/O[0-9]/*/*"), key=lambda p: (p.split("/")[-1], p.split("/")[-2] != "sol", p)):
    cond, arm, task = g.split("/")[-3:]; key = f"{cond}/{arm}/{task}"; slug = key.replace("/", "-")
    if not os.path.exists(f"{g}/room/map.png") or not os.path.exists(f"{g}/room/table.json"): continue
    tb = json.load(open(f"{g}/room/table.json")); gen = tb.get("generated") or {}
    pairs = [v for k, v in res.items() if k.startswith(key + "|") and "anchor" in v]
    w = sum(v["verdict"] > 0 for v in pairs); d = sum(v["verdict"] == 0 for v in pairs); l = sum(v["verdict"] < 0 for v in pairs)
    fo = (res.get(key + "|follow") or {}).get("follow") or {}
    line = (f"{'보스 방' if task == 'boss' else '여관 1층'} · {MODEL.get(arm, arm)} · 기준 방 대비 {w}승 {d}무 {l}패 · 목업 충실도 {fo.get('overall', '?')}/10"
            f" · 표→맵 {round(100 * (tb.get('coverage') or 0))}% · 새 조각 {gen.get('placed', 0)}/{gen.get('made', 0)} 놓임")
    cards.append(f"<section><p>{E(line)}</p><div class=pair><figure><img class=m src='{jpg(f'{g}/mockup.png', f'O-{task}-mockup', False)}'><figcaption>GPT 목업</figcaption></figure>"
                 f"<figure><img src='{jpg(f'{g}/room/map.png', slug + '-map', True)}'><figcaption>지은 방</figcaption></figure></div>"
                 f"<figure><img class=s src='{strip(task)}'><figcaption>object-gen 으로 만든 조각</figcaption></figure></section>")
open(f"{V}/img-room-test.html", "w").write(f"""<!doctype html><meta charset=utf-8><title>img-room-test</title>
<style>body{{font:15px/1.5 system-ui,sans-serif;background:#16171b;color:#e6e6e6;margin:20px}}.v{{font-weight:600;background:#22252c;border-left:4px solid #e0b040;padding:8px 14px}}
section{{border-top:1px solid #333;padding:10px 0}}.pair{{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}}figure{{margin:0 0 6px}}img{{max-width:620px;max-height:520px;image-rendering:pixelated}}img.m{{max-width:520px}}img.s{{max-height:120px}}figcaption{{color:#999;font-size:12px}}</style>
<p class=v>{E(VERDICT)}</p>{''.join(cards)}""")
print("ok", len(cards))
