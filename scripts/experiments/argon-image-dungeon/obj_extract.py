#!/usr/bin/env python3
"""Object step 1: Argon (gemini-4-argon-high via 8318; the plain id drops images) lists the distinct props in one generated dungeon picture
with pixel boxes; code crops them (pad 3 px) into $AID_RUNS/objects/crops/<pic>-NN.png.
  python3 obj_extract.py <pic id> <picture.png>   -> $AID_RUNS/objects/ext/<pic id>.json"""
import base64, json, os, re, sys, time, urllib.request
from PIL import Image
pid, pic = sys.argv[1], sys.argv[2]
RUNS = os.environ.get("AID_RUNS", os.path.expanduser("~/z-project/assistant-whole-game/suite/rooms/runs-argonimg"))
O = f"{RUNS}/objects"; os.makedirs(f"{O}/ext", exist_ok=True); os.makedirs(f"{O}/crops", exist_ok=True)
_ep = json.load(open(os.path.expanduser("~/.oprn-suite/openai-compat-endpoints.json")))["endpoints"]["openai-compat:proxy8318"]
URL = _ep["baseUrl"].rstrip("/") + "/chat/completions"
HDR = {"Content-Type": "application/json", "Authorization": f"Bearer {_ep['apiKey']}"}
W, H = Image.open(pic).size
P = f"""(extract {pid}) The attached image is a pixel-art JRPG dungeon map ({W}x{H} px, 3/4 top-down view).
List the distinct OBJECTS (props) in it: free-standing props (torches, braziers, chests, barrels, pillars, statues, altars, coffins, thrones, cages,
stalagmites, crystals, bones, skull piles, rubble, mushrooms, ...), wall-mounted props (banners, torches, chains, niches) and small floor clutter.
NOT floor or wall materials, NOT whole rooms, NOT water/lava areas, NOT stairs or doorways, NOT people or monsters.
Up to 8, each a different kind, the clearest examples. For each:
- name_en: 2-4 lower-case English words, specific
- category: one of light, statue, crypt, bones, container, furniture, rock, crystal, plant, fungus, water, ice, lava, prison, ritual, ruin, debris, wall_decor
- w, h: its size in 16px map cells as a game object (a person is 1x2, a barrel 1x1), 1..3 each
- placement: floor | wall-mounted | scatter
- kind: one of tall_furniture, low_furniture, seat, container, round_body, column, box, figure, organic, debris, flat, wall_mounted, front_prop, other
- brief: one sentence: shape, materials and colours as seen in the picture, seen in 3/4 top-down view
- box_2d: [ymin, xmin, ymax, xmax] normalised to 0-1000, TIGHT around ONE example of it only (no neighbouring objects)
Answer JSON only: {{"objects": [{{"name_en": "...", "category": "...", "w": 1, "h": 1, "placement": "floor", "kind": "...", "brief": "...", "box_2d": [0, 0, 10, 10]}}]}}"""
body = json.dumps({"model": "gemini-4-argon-high", "messages": [{"role": "user", "content": [
    {"type": "text", "text": P}, {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(pic, "rb").read()).decode()}}]}]}).encode()
d = None
for a in range(5):
    try:
        with urllib.request.urlopen(urllib.request.Request(URL, body, HDR), timeout=600) as r: d = json.load(r)
        if (d["choices"][0]["message"].get("content") or "").strip(): break
        raise RuntimeError("empty answer")
    except Exception as x:
        print(pid, "retry", a + 1, str(x)[:100], flush=True); d = None; time.sleep(15 * 2 ** a)
if not d: json.dump({"pic": pid, "void": True}, open(f"{O}/ext/{pid}.json", "w")); sys.exit(0)
text = d["choices"][0]["message"]["content"]
m = re.search(r"\{.*\}", text, re.S)
objs = (json.loads(m.group(0)).get("objects") if m else None) or []
im = Image.open(pic).convert("RGB")
for i, o in enumerate(objs):
    try:
        ya, xa, yb, xb = [float(v) for v in o["box_2d"]]   # Gemini's native box convention
        x0, y0, x1, y1 = int(xa * W / 1000), int(ya * H / 1000), int(xb * W / 1000), int(yb * H / 1000)
        x0, x1 = sorted((max(0, x0 - 3), min(W, x1 + 3))); y0, y1 = sorted((max(0, y0 - 3), min(H, y1 + 3)))
        if x1 - x0 < 6 or y1 - y0 < 6: o["crop"] = None; continue
        o["cid"] = f"{pid}-{i:02d}"; o["crop"] = f"{O}/crops/{o['cid']}.png"; im.crop((x0, y0, x1, y1)).save(o["crop"])
    except Exception as x: o["crop"] = None; o["err"] = str(x)[:80]
json.dump({"pic": pid, "src": pic, "size": [W, H], "objects": objs, "raw": text}, open(f"{O}/ext/{pid}.json", "w"), indent=1, ensure_ascii=False)
print(pid, len(objs), "objects", sum(1 for o in objs if o.get("crop")), "crops", flush=True)
