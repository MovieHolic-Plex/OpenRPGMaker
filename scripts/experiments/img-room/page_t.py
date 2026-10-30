#!/usr/bin/env python3
"""img-room-test 페이지(조건 T만: 칩셋 묶인 목업 → 조각 표 → 지은 방): ~/claude-viz/img-room-test.html + ~/claude-viz/imgroom/T*.jpg
  python3 page_t.py <runs dir> "<한 줄 결론>"   (A·B·G 판 자료는 디스크에 그대로 둔다)"""
import json, os, sys, glob, html
from collections import Counter
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
for g in sorted(glob.glob(f"{RUNS}/T[0-9]/*/*"), key=lambda p: (p.split("/")[-1], p.split("/")[-2] != "terra", p)):
    cond, arm, task = g.split("/")[-3:]; key = f"{cond}/{arm}/{task}"; slug = key.replace("/", "-")
    if not os.path.exists(f"{g}/room/map.png") or not os.path.exists(f"{g}/room/table.json"): continue
    tb = json.load(open(f"{g}/room/table.json")); t = tb.get("table") or {}; vs = tb.get("verdicts") or []
    ck = json.load(open(f"{g}/mockup.check.json")) if os.path.exists(f"{g}/mockup.check.json") else {}
    pairs = [v for k, v in res.items() if k.startswith(key + "|") and "anchor" in v]
    w = sum(v["verdict"] > 0 for v in pairs); d = sum(v["verdict"] == 0 for v in pairs); l = sum(v["verdict"] < 0 for v in pairs)
    fo = (res.get(key + "|follow") or {}).get("follow") or {}
    model = "gpt-6.1-terra high" if arm == "terra" else "Opus 5.5 medium"
    cov = round(100 * (tb.get("coverage") or 0))
    line = f"{'보스 방' if task == 'boss' else '여관 1층'} · {model} · 기준 방 대비 {w}승 {d}무 {l}패 · 목업 충실도 {fo.get('overall', '?')}/10 · 표→맵 {cov}%"
    ids = Counter()
    for gr in t.get("groups", []): ids[gr["id"]] += gr.get("count", 1)
    miss = [f"{v['name']}({v['id']})" for v in vs if not v.get("covered")]
    summ = (f"<b>{t.get('mapWidth')}×{t.get('mapHeight')}</b> · 구역 {len(t.get('rooms', []))} · 묶음 {len(t.get('groups', []))}<br>"
            + E(", ".join(f"{k} ×{n}" for k, n in ids.most_common(12))) + (" …" if len(ids) > 12 else "")
            + f"<br><span class=m>빠짐·어긋남: {E(', '.join(miss)) if miss else '없음'}</span>"
            + f"<br><span class=m>목업 검사: 칩셋에 없는 것 {ck.get('n', '?')}개</span>")
    cards.append(f"<section><p>{E(line)}</p><div class=pair><figure><img src='{jpg(f'{g}/mockup.png', slug + '-mockup', False)}'><figcaption>칩셋 조각만 쓴 GPT 목업</figcaption></figure>"
                 f"<div class=tbl>{summ}</div>"
                 f"<figure><img src='{jpg(f'{g}/room/map.png', slug + '-map', True)}'><figcaption>지은 방</figcaption></figure></div></section>")
open(f"{V}/img-room-test.html", "w").write(f"""<!doctype html><meta charset=utf-8><title>img-room-test</title>
<style>body{{font:15px/1.5 system-ui,sans-serif;background:#16171b;color:#e6e6e6;margin:20px}}.v{{font-weight:600;background:#22252c;border-left:4px solid #e0b040;padding:8px 14px}}
section{{border-top:1px solid #333;padding:10px 0}}.pair{{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}}figure{{margin:0}}img{{max-width:520px;max-height:520px;image-rendering:pixelated}}figcaption{{color:#999;font-size:12px}}
.tbl{{width:240px;font-size:13px;background:#1e2026;padding:8px 10px;border-radius:4px}}.m{{color:#aaa}}</style>
<p class=v>{E(VERDICT)}</p>{''.join(cards)}""")
print("ok", len(cards))
