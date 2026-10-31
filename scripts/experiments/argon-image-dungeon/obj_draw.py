#!/usr/bin/env python3
"""Object step 2: Argon draws each selected crop as pixel art through object-gen's own one-shot drawer contract
(object-gen draw --auto --drawer openai: the draw brief + chipset refs/style/palette + the crop as the FORM reference -> a JSON grid of
palette keys; object-gen's mechanical checks reject and the drawer retries, max 3 attempts). Same style sheet, rules, palette and
footprint conventions as the Opus objpool run (objpool/_dungeon/og_dungeon.py). One candidate (A) per object.
  python3 obj_draw.py [cid ...]     -> $AID_RUNS/objects/jobs/<cid>/ , $AID_RUNS/objects/draw.json"""
import json, os, shutil, subprocess, sys, time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
RUNS = Path(os.environ.get("AID_RUNS", os.path.expanduser("~/z-project/assistant-whole-game/suite/rooms/runs-argonimg")))
O = RUNS / "objects"; POOL = Path.home() / "z-project/assistant-whole-game/suite/rooms/objpool"; DG = POOL / "_dungeon"
OG = Path.home() / "object-gen"; REPO = Path(__file__).resolve().parents[3]
SHEET = DG / "style_sheet.png"; RULES = DG / "_rules.txt"   # the Opus run's sheet and rules, unchanged
ORGANIC = {"rock", "crystal", "plant", "fungus", "ice", "lava", "debris", "water", "bones"}
# selected crops (one clear object each, checked by eye on the crop sheet) -> Opus objpool counterpart of the same/similar type (None = no counterpart)
SEL = {"crypt-03": "leather-travel-chest", "cave-03": "clay-floor-urn", "cave-04": "pale-blue-mushrooms", "crypt-05": "hooded-mourner-statue",
       "gflooded-05": "headless-robed-statue", "gcrypt-05": "skull-pile-pyramid", "cave-06": "giant-beast-skull", "gcave-04": "cave-in-boulder-pile",
       "cave-05": "hourglass-cave-column", "gflooded-04": "candle-offering-table", "demon-00": "stone-ring-campfire", "cave-07": "stone-garden-lantern",
       "demon-06": "spiked-torture-chair", "flooded-07": "leafy-fern-bush", "crypt-07": "cracked-stone-slab", "gdemon-06": "hanging-iron-cage",
       "cave-00": None, "cave-01": None, "crypt-01": None, "crypt-02": None, "crypt-06": None, "demon-01": None, "demon-03": None,
       "demon-07": None, "flooded-02": None, "gcave-02": None}
_ep = json.load(open(os.path.expanduser("~/.oprn-suite/openai-compat-endpoints.json")))["endpoints"]["openai-compat:proxy8318"]
def env():
    e = dict(os.environ); e["PYTHONPATH"] = str(OG) + (os.pathsep + e["PYTHONPATH"] if e.get("PYTHONPATH") else "")
    e.update({"OBJECTGEN_BASE_URL": _ep["baseUrl"].rstrip("/"), "OBJECTGEN_API_KEY": _ep["apiKey"], "OBJECTGEN_MODEL": "gemini-4-argon-high"})
    return e
def og(*args, timeout=1800):
    r = subprocess.run([sys.executable, "-m", "objectgen", *args], capture_output=True, text=True, env=env(), timeout=timeout, cwd=str(REPO))
    out = r.stdout.strip()
    try: return json.loads(out[out.index("{"):]) if "{" in out else {"error": (r.stderr or out)[-600:]}
    except ValueError: return {"error": (r.stderr or out)[-600:]}

sys.path.insert(0, str(OG))
URL = _ep["baseUrl"].rstrip("/") + "/chat/completions"; HDR = {"Content-Type": "application/json", "Authorization": f"Bearer {_ep['apiKey']}"}
def argon(msgs):
    """One Argon call; 502/503/timeouts/empty answers retried 5 times with backoff, then None (void)."""
    import urllib.request
    body = json.dumps({"model": "gemini-4-argon-high", "messages": msgs}).encode()
    for a in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(URL, body, HDR), timeout=900) as r: d = json.load(r)
            t = (d["choices"][0]["message"].get("content") or "").strip()
            if t: return t
            raise RuntimeError("empty answer")
        except Exception as x:
            print("argon retry", a + 1, str(x)[:100], flush=True); time.sleep(15 * 2 ** a)
    return None
def draw_loop(jd, cid, max_parse=3):
    """object-gen's one-shot drawer contract with Argon as the maker: brief (+ chipset refs, style, palette, the crop) -> JSON grid ->
    object-gen submit (parse + mechanical checks). Check failures: a fresh brief (object-gen puts the failed checks and the previous grid in it).
    Parse errors (no attempt is recorded): the error goes back to Argon as a Rejected message in the same conversation."""
    import base64
    from objectgen import api
    log = []
    while True:
        st = json.load(open(jd / "candidates" / "A" / "state.json")) if (jd / "candidates" / "A" / "state.json").exists() else {}
        if st.get("status") == "checked" or st.get("attempt", 0) >= 3: return log
        b = api.brief(str(jd), "A")
        content = [{"type": "text", "text": f"(run {cid} attempt {st.get('attempt', 0) + 1})\n" + b["text"]}]
        content += [{"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(open(p, "rb").read()).decode()}} for p in b["images"]]
        msgs = [{"role": "user", "content": content}]
        for k in range(max_parse):
            t = argon(msgs)
            if t is None: log.append("void: Argon never answered"); return log
            r = api.submit(str(jd), "A", t)
            if r.get("rowFix") and not r.get("ok"):
                msgs += [{"role": "assistant", "content": t}, {"role": "user", "content": "Rejected: " + r["rowFix"]}]
                f = argon(msgs)
                if f is None: log.append("void"); return log
                from objectgen import job as J
                root, job = J.load(str(jd)); r = J.apply_row_fix(root, job, "A", f)
            log.append({k2: r.get(k2) for k2 in ("ok", "stage", "error")} | {"hard": [i["code"] for i in (r.get("check") or {}).get("hard", [])]})
            if r.get("stage") != "parse" and not r.get("error"): break
            msgs += [{"role": "assistant", "content": t}, {"role": "user", "content": f"Rejected: {r.get('error')}. Legend values must be palette keys written exactly as listed (e.g. \"c:14\" with the colon). Fixed call: return the full JSON answer again with that corrected."}]
        else:
            log.append("gave up: 3 unparseable answers"); return log
def ogcat(cat, anchor):
    if anchor == "flat": return "terrain"
    return "light" if cat == "light" else "furniture" if cat == "furniture" else "decor" if cat == "wall_decor" else "nature" if cat in ("rock", "crystal", "plant", "fungus", "ice", "lava", "water") else "prop"
items = {}
for f in sorted((O / "ext").glob("*.json")):
    for o in json.load(open(f)).get("objects", []):
        if o.get("cid") in SEL: items[o["cid"]] = o
def one(cid):
    o = items[cid]; opus = SEL[cid]; jd = O / "jobs" / cid; t0 = time.time()
    if opus:   # same footprint/anchor/kind as the Opus counterpart, so the pair is like for like
        oj = json.load(open(POOL / "beodeul_city" / f"{opus}.json")); w, h = map(int, oj["footprint"].split("x")); anchor, kind = oj["anchor"], oj["gate_kind"]
    else:
        w, h = max(1, min(3, int(o.get("w", 1)))), max(1, min(3, int(o.get("h", 1))))
        anchor = {"floor": "floor", "wall-mounted": "hang", "scatter": "flat"}.get(o.get("placement"), "floor"); kind = o.get("kind") or "other"
    cat = o.get("category", "prop")
    if not (jd / "job.json").exists():
        r = og("new", str(jd), "--brief", o["brief"], "--name", o["name_en"], "--tileset", str(SHEET), "--size", f"{w}x{h}", "--anchor", anchor,
               "--kind", kind, "--category", ogcat(cat, anchor), "--candidates", "A", "--rules", f"@{RULES}",
               "--style-set", "oprn-beodeul-organic" if cat in ORGANIC else "oprn-interior-v5-large")
        if r.get("error"): return {"cid": cid, "ok": False, "error": "new: " + r["error"][-300:]}
        ref = jd / "reference"; ref.mkdir(exist_ok=True)   # the crop from the generated picture = the drawer's FORM reference
        im = Image.open(o["crop"]).convert("RGB"); k = max(1, 256 // max(im.size)); im.resize((im.width * k, im.height * k), Image.NEAREST).save(ref / "ref-1.png")
        (ref / "ref.json").write_text(json.dumps({"items": [{"file": "ref-1.png", "source": "crop of the gemini-3.1-flash-image dungeon picture", "crop": o["crop"]}]}))
    res = draw_loop(jd, cid)
    st = json.load(open(jd / "candidates" / "A" / "state.json")) if (jd / "candidates" / "A" / "state.json").exists() else {}
    png = jd / "candidates" / "A" / f"attempt-{st.get('attempt', 0)}.png"
    return {"cid": cid, "name": o["name_en"], "opus": opus, "size": f"{w}x{h}", "anchor": anchor, "kind": kind, "ok": st.get("status") == "checked",
            "status": st.get("status"), "attempts": st.get("attempt", 0), "png": str(png) if png.exists() else None, "crop": o["crop"],
            "brief": o["brief"], "secs": round(time.time() - t0), "log": res}
if __name__ == "__main__":
    todo = sys.argv[1:] or list(SEL)
    out = json.load(open(O / "draw.json")) if (O / "draw.json").exists() else {}
    with ThreadPoolExecutor(4) as ex:
        for r in ex.map(one, todo):
            out[r["cid"]] = r; json.dump(out, open(O / "draw.json", "w"), indent=1, ensure_ascii=False)
            print(json.dumps({k: r.get(k) for k in ("cid", "ok", "status", "attempts", "secs")}), flush=True)
    print("DONE", sum(1 for r in out.values() if r["ok"]), "/", len(out))
