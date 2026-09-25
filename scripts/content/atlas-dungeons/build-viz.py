#!/usr/bin/env python3
"""Self-contained visual index of the atlas dungeons: map cards (image, name, id, size, registration, one line) and
shared-object cards. Images are embedded as lossless WebP data URIs so the page opens anywhere.

  python3 scripts/content/atlas-dungeons/build-viz.py [out.html]   (default ~/claude-viz/atlas-dungeons.html)
"""
import base64, html, io, json, os, sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
D = os.path.join(ROOT, "tiledata", "atlas-dungeons")
out = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/claude-viz/atlas-dungeons.html")


def uri(path, scale=1):
    im = Image.open(path).convert("RGBA")
    if scale != 1:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.NEAREST)
    b = io.BytesIO()
    im.save(b, "WEBP", lossless=True, method=4)
    return "data:image/webp;base64," + base64.b64encode(b.getvalue()).decode()


def first_sentence(note):
    s = note.split(". ")[0]
    return s if len(s) < 140 else s[:137] + "…"


cat = json.load(open(os.path.join(D, "catalog.json")))
maps = cat["maps"]
cards = []
# the rebuilt pirate cove (rpg-dungeons pipeline) leads the page
cove = os.path.join(ROOT, "tiledata", "rpg-dungeons", "images", "dungeon-pirate-cove.png")
if os.path.exists(cove):
    cards.append(dict(series="고친 맵", img=uri(cove), name="해적 소굴 · 숨은 선착장 (진짜 범선으로 교체)", id="dungeon-pirate-cove",
                      size="52×34", reg="장소 · RPG 판타지 장소 라이브러리(재게시 필요)", line="널판 뗏목을 푸른물결항의 3돛 범선(30×11)으로 바꿈 — 난간 틈 널다리로 승선"))
for p in cat["plans"]:
    m = maps[p["id"]]
    img = os.path.join(D, "images", p["id"] + ".png")
    if not os.path.exists(img):
        continue
    cards.append(dict(series=p.get("seriesName", p.get("series", "")), img=uri(img), name=p["name"], id=p["id"], size=f'{m["width"]}×{m["height"]}',
                      reg=f'장소 · {p.get("room", "")}', line=first_sentence(p.get("note", ""))))

objs = []
obj_path = os.path.join(D, "shared-objects.json")
if os.path.exists(obj_path):
    for o in json.load(open(obj_path)):
        img = os.path.join(D, "objects", o["id"].split("/", 1)[1] + ".png")
        objs.append(dict(img=uri(img, 2) if os.path.exists(img) else "", name=o["name"], id=o["id"], size=f'{o["width"]}×{o["height"]}', cat=o["category"], src=o.get("sourceMap", "")))

e = html.escape
parts = []
last = None
for c in cards:
    if c["series"] != last:
        parts.append(f'<h2>{e(c["series"])}</h2>')
        last = c["series"]
    parts.append(f'<figure><img src="{c["img"]}" loading="lazy"><figcaption><b>{e(c["name"])}</b><br>'
                 f'<code>{e(c["id"])}</code> · {e(c["size"])} · {e(c["reg"])}<br><span>{e(c["line"])}</span></figcaption></figure>')
obj_html = "".join(f'<figure class="o"><img src="{o["img"]}"><figcaption><b>{e(o["name"])}</b><br><code>{e(o["id"])}</code> · {e(o["size"])} · {e(o["cat"])}<br><span>{e(o["src"])}</span></figcaption></figure>' for o in objs)
page = f"""<!doctype html><meta charset="utf-8"><title>아틀라스 던전</title>
<style>body{{background:#1b1d22;color:#ddd;font:14px/1.45 system-ui,sans-serif;margin:16px}}h1{{margin:0 0 4px}}h2{{border-bottom:1px solid #444;margin:26px 0 8px;font-size:17px}}
.g{{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-start}}figure{{margin:0;background:#262930;padding:8px;border-radius:6px;width:min(440px,100%)}}figure.o{{width:auto;max-width:300px}}
img{{image-rendering:pixelated;max-width:100%;display:block}}figcaption{{margin-top:6px}}code{{color:#9cf}}span{{color:#aaa}}</style>
<h1>아틀라스 던전 — 분야 C</h1><p>맵 {len(cards)}장(해적 소굴 수리 포함) · 오브젝트 {len(objs)}개.</p>
<div class="g">{"".join(parts).replace("<h2>", "</div><h2>").replace("</h2>", "</h2><div class=g>")}</div>
<h2>공용 오브젝트</h2><div class="g">{obj_html}</div>
"""
page = page.replace('<div class="g"></div>', "")
open(out, "w").write(page)
print(out, len(cards), "maps", len(objs), "objects", round(len(page) / 1e6, 1), "MB")
