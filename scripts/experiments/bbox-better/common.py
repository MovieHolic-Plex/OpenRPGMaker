#!/usr/bin/env python3
"""bbox-better: shared helpers (model call, parse, lay/validate, prompt text) for the bbox-room improvement tests.
Same request, grid rules and painter as scripts/experiments/bbox-room/run.py. Runs go to $BBOX_RUNS (own copy of base + shared-content)."""
import base64, json, os, re, subprocess, time, urllib.request
HOME = os.path.expanduser("~")
SUITE = f"{HOME}/z-project/assistant-whole-game/suite"
RUNS = os.environ.get("BBOX_RUNS", f"{SUITE}/rooms/runs-bboxbetter")
BASE_RUNS = f"{SUITE}/rooms/runs-bboxroom"          # baseline runs (read only)
REFS = f"{SUITE}/rooms/runs-imgroom/refs"
WT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
MODEL = {"sol": "gpt-6.1-sol", "terra": "gpt-6.1-terra"}
OCX = "http://127.0.0.1:10200/v1/chat/completions"
SUFFIX = " 다른 맵은 만들지 말고 이 방 하나만 지어 줘."
REQ = {"inn": "작은 마을 여관 1층을 만들어 줘. 손님을 맞는 카운터와 밥 먹는 자리가 있는 곳이야." + SUFFIX,
       "boss": "성 지하 깊은 곳, 마왕이 기다리는 던전 보스 방을 만들어 줘. 입구에서 들어와 옥좌까지 가는 곳이야." + SUFFIX}

GRID_RULES = """# Grid rules (16px cells, x to the right, y down, origin top-left)
- Every cell outside all regions is solid (dark wall top / void). Regions are rectangles of interior space.
- Regions that touch or overlap merge into one open space. To put a wall between two regions, leave at least one solid cell between them, then carve openings.
- Wall face: inside any region, the two rows directly below a solid cell are the wall face (drawn as wall, not walkable). So a region's top two rows are its north wall; floor starts at row y+2.
  'wall-mounted' pieces go on the upper face row (row y of the region). 'against-wall' pieces go on the first floor row (y+2) right under the face.
- Openings are cells carved through solid cells. In a horizontal solid wall a 1-cell opening is a doorway. In a vertical solid wall an opening must be 3 cells tall (its top two cells become wall face; the bottom one is the walkable passage).
- Keep a solid border: regions inside x 1..w-2, y 1..h-2. The entrance is one cell on the bottom map row (y = h-1) directly below a region cell; the bottom row is otherwise solid.
- Footprints must not overlap each other, must lie on floor cells, and every piece needs a reachable free side. Keep walking paths from the entrance to every area. Decals/carpets/daises are walkable and may lie under furniture.
- Pieces with art taller than the footprint draw upward; leave that space free of other tall pieces."""

FORMAT = """# Output: one JSON object only, no prose
{"map": {"w": W, "h": H},
 "landmark": {"id": "...", "x": X, "y": Y, "purpose": "..."},
 "regions": [{"id": "hall", "x": X, "y": Y, "w": W, "h": H, "floor": "<floor id>", "wall": "<wall id>", "purpose": "..."}],
 "openings": [{"x": X, "y": Y, "w": 1, "h": 1, "purpose": "..."}],
 "entrance": {"x": X, "y": H-1},
 "carpets": [{"id": "<rug id>", "x": X, "y": Y, "w": W, "h": H, "purpose": "..."}],
 "daises": [{"id": "dais stone", "x": X, "y": Y, "w": W, "h": H}],
 "objects": [{"id": "<catalog id>", "x": X, "y": Y, "repeat": {"count": 4, "dx": 2, "dy": 0}, "purpose": "..."}]}
x,y of a piece = the top-left cell of its footprint. "repeat" is optional (count copies, each shifted by dx,dy). carpets/daises only if the catalog lists them."""

DESIGN = "Design a specific, lived-in room that fits the request: not a plain rectangle — use several regions (side rooms, alcoves, an L or two-part shape), a clear landmark, distinct functional zones, and enough furniture and decoration that no large floor area is empty."

HEAD = "You design one RPG map room as an exact cell layout. Your JSON is laid onto the map cell by cell by code that only executes it — every floor, wall, opening and object you write is exactly what appears, nothing is added."


def catalog(task): return open(f"{RUNS}/catalog-{task}.txt").read()


def full_prompt(task, cat=None, extra=""):
    """The baseline bbox prompt (identical text to bbox-room/run.py), optional extra block before the output format."""
    return f"{HEAD}\n\nUser request (Korean): {REQ[task]}\n\n{cat if cat is not None else catalog(task)}\n{GRID_RULES}\n\n{extra}{FORMAT}\n{DESIGN}"


def img_url(path):
    return "data:image/png;base64," + base64.b64encode(open(path, "rb").read()).decode()


def palette(task): return img_url(f"{REFS}/{task}-pieces.png")


def call(arm, msgs, out_json):
    body = json.dumps({"model": MODEL[arm], "messages": msgs, "reasoning_effort": "high"}).encode()
    t0 = time.time()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(OCX, body, {"content-type": "application/json"}), timeout=900) as r: d = json.load(r)
            break
        except Exception:
            if attempt == 2: raise
            time.sleep(20)
    secs = round(time.time() - t0, 1); u = d.get("usage") or {}
    text = d["choices"][0]["message"]["content"] or ""
    json.dump({"secs": secs, "usage": u, "model": d.get("model"), "text": text}, open(out_json, "w"), ensure_ascii=False, indent=1)
    return text, {"model": MODEL[arm], "secs": secs, "in": u.get("prompt_tokens", 0), "out": u.get("completion_tokens", 0), "tokens": u.get("total_tokens", 0)}


def parse(text):
    m = re.search(r"\{.*\}", text or "", re.S)
    try: return json.loads(m.group(0)) if m else None
    except Exception: return None


def lay(G, n, layout, render=False):
    f = f"{G}/layout-{n}.json"; json.dump(layout, open(f, "w"), indent=1)
    out = f"{G}/lay-{n}" if not render else G
    p = subprocess.run(["bun", "scripts/experiments/bbox-room/lay.mts", f, out, f"{RUNS}/base"] + (["--render"] if render else []), cwd=WT,
                       capture_output=True, text=True, env=dict(os.environ, OPRN_SHARED_CONTENT_SQLITE=f"{RUNS}/shared-content.sqlite"))
    try: return json.loads(p.stdout.strip().splitlines()[-1])
    except Exception: return {"ok": False, "errors": ["painter crashed: " + (p.stderr or p.stdout)[-500:]], "warnings": []}


def rejected_msg(chk, what="layout JSON"):
    return ("Rejected: the validator rejected it. Fixed call: fix every problem below and return the full corrected " + what + " only (same format).\n- "
            + "\n- ".join(chk["errors"][:40]) + ("\nWarnings (fix if you can):\n- " + "\n- ".join(chk["warnings"][:10]) if chk.get("warnings") else ""))


def draw(layout_json, out_png):
    subprocess.run(["python3", "scripts/experiments/bbox-room/draw_layout.py", layout_json, out_png], cwd=WT, check=False)


def x2(src, dst):
    from PIL import Image
    m = Image.open(src); m.resize((m.width * 2, m.height * 2), Image.NEAREST).save(dst)
