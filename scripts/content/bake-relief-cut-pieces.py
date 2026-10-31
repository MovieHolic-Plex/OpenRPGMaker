#!/usr/bin/env python3
"""Bake the cliff cut pieces into the shipped relief art — GATED. Forward cuts (south-facing cliffs, h1-4 x w2-3; stacked flights are
composed at run time) for grass/sand/snow/peat/cave-steps, and reverse cuts (north-facing cliffs, cutPieces.ts reverseCutLength) for all five.

The pieces are drawn by scripts/experiments/bbox-village/ramps/pieces.py (code hand-pixel, beodeul locked colours).
Until they are baked they exist only in the experiment (ramps/install.mts adds them in-process). Baking writes them into
src/project/relief/rampArt.json["grass-steps"].pieces, after which the relief renderer (render.ts paintSlopePieces via
screen.ts reliefRenderOptions) draws every one-row cut through a south-facing cliff with them — editor, player and QA renders.

AGENTS.md hard rule: new pixel art enters a bundle only after the 3/4 object gate. Every piece must pass
require_pass(kind="terrain", context="bundle"). Nothing is written unless ALL pieces pass. No flag skips the gate.

  python3 scripts/content/bake-relief-cut-pieces.py --check    # report gate status per piece, write nothing
  python3 scripts/content/bake-relief-cut-pieces.py            # bake (refused while any piece lacks a valid pass)
"""
import json, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "harnesses" / "_core"))
from object_gate import ObjectGateRefused, refusal, require_all  # noqa: E402

ART = ROOT / "src/project/relief/rampArt.json"
EXP = ROOT / "scripts/experiments/bbox-village"
STYLES5 = ("grass-steps", "sand-steps", "snow-steps", "peat-steps", "cave-steps")

def pieces():
    """(style, key, gate label, image). Sets:
      grass-steps forward  ramps/png/<name>.png           key <kind>:n:<w>x1:<rise>        label bbox-village-ramps/<name>
      other forward        stairs/fwd/<style>/<name>.png  key <kind>:n:<w>x1:<rise>        label relief-cuts-fwd/<style>/<name>
      reverse (all five)   stairs/rev/<style>/<name>.png  key <kind>:s:<w>x<rise+2>:<rise> label relief-cuts-rev/<style>/<name>"""
    for kind in ("ramp", "stairs"):
        for rise in (1, 2, 3, 4):
            for w in (2, 3):
                name = f"{kind}-h{rise}-w{w}"
                yield "grass-steps", f"{kind}:n:{w}x1:{rise}", f"bbox-village-ramps/{name}", EXP / "ramps/png" / f"{name}.png"
                for st in STYLES5[1:]:
                    yield st, f"{kind}:n:{w}x1:{rise}", f"relief-cuts-fwd/{st}/{name}", EXP / "stairs/fwd" / st / f"{name}.png"
                for st in STYLES5:
                    yield st, f"{kind}:s:{w}x{rise + 2}:{rise}", f"relief-cuts-rev/{st}/{name}", EXP / "stairs/rev" / st / f"{name}.png"

def main():
    only = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")), None)   # label prefix filter for --check
    items = [(st, key, label, Image.open(f).convert("RGBA")) for st, key, label, f in pieces() if not only or label.startswith(only)]
    if "--check" in sys.argv:
        bad = 0
        for _, _, label, im in items:
            why = refusal(im, kind="terrain", context="bundle")
            bad += bool(why); print(f"{'REFUSED' if why else 'pass   '} {label:40} {why or ''}")
        print(f"{len(items) - bad}/{len(items)} may be baked"); return 1 if bad else 0
    if only: print("--only is for --check; the bake takes every set"); return 1
    try:
        require_all([(im, "terrain", label) for _, _, label, im in items], context="bundle")
    except ObjectGateRefused as e:
        print("not baked — object gate:", e); return 1
    art = json.loads(ART.read_text())
    for st in STYLES5: art.setdefault(st, {})["pieces"] = {}
    for st, key, _, im in items: art[st]["pieces"][key] = {"w": im.width, "h": im.height, "rgba": list(im.tobytes())}
    ART.write_text(json.dumps(art) + "\n"); print(f"baked {len(items)} pieces into {ART.relative_to(ROOT)} ({', '.join(STYLES5)})")
    return 0

if __name__ == "__main__":
    sys.exit(main())
