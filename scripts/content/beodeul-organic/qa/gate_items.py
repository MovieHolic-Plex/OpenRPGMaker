"""Write object-gate enqueue items (items.jsonl) and copy the blind VQA evidence for the current 37 pixel hashes.
  python3 qa/gate_items.py <evidence_dir>
Writes <evidence_dir>/items.jsonl ({png,kind,name,label}) with out/*.png copied next to it, and <evidence_dir>/blind-vqa.json:
the ledger rows for each current hash (all blind sheets that showed it, both judges' verdicts) + the acceptance rule. Refuses unless all are accepted.
"""
import hashlib, json, shutil, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parents[1]
dst = Path(sys.argv[1]); dst.mkdir(parents=True, exist_ok=True)
spec = json.loads((HERE / "spec.json").read_text())["items"]
L = json.loads((HERE / "qa" / "ledger.json").read_text())
st = subprocess.run([sys.executable, str(HERE / "qa" / "ledger.py"), "status"], capture_output=True, text=True).stdout
if not st.strip().endswith(f"accepted {len(spec)}/{len(spec)}"): sys.exit("not all pieces accepted:\n" + st)
FAM = {"rock": "rock", "mossy": "mossy stone", "bush": "bush", "wood": "fallen log / stump", "mushroom": "mushrooms", "fern": "fern",
       "grass": "grass tuft", "flower": "wildflowers", "landmark": "forest landmark"}
items, evid = [], {}
for it in spec:
    src = HERE / "out" / f"{it['id']}.png"; shutil.copy(src, dst / src.name)
    sha = hashlib.sha256(np.ascontiguousarray(np.array(Image.open(src).convert("RGBA"))).tobytes()).hexdigest()
    items.append({"png": src.name, "kind": it["kind"], "label": f"beodeul_organic/{it['id']}",
                  "name": f"{it['en']} ({FAM[it['family']]}), natural map prop for the Beodeul 16px chipset, {it['w']}x{it['h']} tiles, "
                          f"{'standing object (3rd layer)' if it['layer'] == 3 else 'walk-over ground decor (2nd layer)'}, 3/4 top-down, sits on grass between broadleaf trees"})
    evid[it["id"]] = [{"round": r["round"], "artRev": r["rev"], **r["pieces"][it["id"]]} for r in L["rounds"] if r["pieces"].get(it["id"], {}).get("sha") == sha]
(dst / "items.jsonl").write_text("".join(json.dumps(i, ensure_ascii=False) + "\n" for i in items))
(dst / "blind-vqa.json").write_text(json.dumps({
    "reviewers": ["argon (Gemini 4 Argon high)", "klb-sonnet-5-5"], "method": "blind mixed sheets: 37 new + 16 Beodeul original kits under neutral codes, fresh judge processes per round (qa/blind.py, qa/protocol.md)",
    "rule": ">=2 blind sheets on the exact pixel hash, >=1 sheet with both judges PASS, each judge PASS in >=2/3 of those sheets",
    "originalsControlPassRate": "each judge passes only 2-10 of the 16 Beodeul originals per sheet",
    "verdict": "PASS", "pieces": evid}, indent=1) + "\n")
print(dst, len(items))
