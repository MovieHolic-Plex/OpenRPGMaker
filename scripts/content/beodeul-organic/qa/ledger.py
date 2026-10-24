"""Per-pixel-hash acceptance ledger for the blind two-judge protocol (qa/protocol.md).

  python3 qa/ledger.py add <round> <git-rev-of-art> <key.json> <sonnet-fails.txt> <argon-fails.txt>
  python3 qa/ledger.py status            # current out/*.png: accepted (a unanimous blind PASS on this exact pixel hash) or not

Acceptance rule: qa/protocol.md "Final acceptance rule" (>=2 sheets on this exact hash, >=1 unanimous, each judge >=2/3). Any pixel change resets it.
"""
import hashlib, io, json, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
LEDGER = HERE / "qa" / "ledger.json"
def phash(img): a = np.array(img.convert("RGBA")); return hashlib.sha256(np.ascontiguousarray(a).tobytes()).hexdigest()
def load(): return json.loads(LEDGER.read_text()) if LEDGER.exists() else {"rounds": []}
ids = [it["id"] for it in json.loads((HERE / "spec.json").read_text())["items"]]
if sys.argv[1] == "add":
    rnd, rev, key, sf, af = sys.argv[2:7]
    key = json.loads(Path(key).read_text())
    fails = {j: {l.split()[0] for l in Path(p).read_text().split("\n") if l.strip()} for j, p in (("sonnet", sf), ("argon", af))}
    rel = HERE.relative_to(Path(subprocess.check_output(["git", "rev-parse", "--show-toplevel"], cwd=HERE, text=True).strip()))
    rows = {}
    for code, v in key.items():
        if v["origin"] != "new": continue
        png = subprocess.check_output(["git", "show", f"{rev}:{rel}/out/{v['id']}.png"], cwd=HERE)
        rows[v["id"]] = {"code": code, "sha": phash(Image.open(io.BytesIO(png))), "sonnet": code not in fails["sonnet"], "argon": code not in fails["argon"]}
    L = load(); L["rounds"] = [r for r in L["rounds"] if r["round"] != rnd] + [{"round": rnd, "rev": rev, "pieces": rows}]
    LEDGER.write_text(json.dumps(L, indent=1) + "\n"); print("added", rnd, len(rows))
else:
    L = load(); ok = 0
    for i in ids:
        sha = phash(Image.open(HERE / "out" / f"{i}.png"))
        seen = [(r["round"], r["pieces"][i]) for r in L["rounds"] if r["pieces"].get(i, {}).get("sha") == sha]
        n = len(seen); s = sum(p["sonnet"] for _, p in seen); a = sum(p["argon"] for _, p in seen); u = sum(p["sonnet"] and p["argon"] for _, p in seen)
        good = n >= 2 and u >= 1 and 3 * s >= 2 * n and 3 * a >= 2 * n
        ok += good; print(f"{'OK ' if good else '-- '}{i:18} sheets {n} sonnet {s}/{n} argon {a}/{n} unanimous {u}")
    print(f"accepted {ok}/{len(ids)}")
