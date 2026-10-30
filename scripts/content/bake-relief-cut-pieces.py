#!/usr/bin/env python3
"""Bake the bbox-village cliff cut pieces (ramp/stairs, h1-3 x w2-3) into the shipped relief art — GATED.

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

PNG = ROOT / "scripts/experiments/bbox-village/ramps/png"
ART = ROOT / "src/project/relief/rampArt.json"
STYLE = "grass-steps"

def pieces():
    for kind in ("ramp", "stairs"):
        for rise in (1, 2, 3):
            for w in (2, 3):
                name = f"{kind}-h{rise}-w{w}"
                yield f"{kind}:n:{w}x1:{rise}", name, Image.open(PNG / f"{name}.png").convert("RGBA")

def main():
    items = list(pieces())
    if "--check" in sys.argv:
        bad = 0
        for key, name, im in items:
            why = refusal(im, kind="terrain", context="bundle")
            bad += bool(why); print(f"{'REFUSED' if why else 'pass   '} {name:14} {why or ''}")
        print(f"{len(items) - bad}/{len(items)} may be baked"); return 1 if bad else 0
    try:
        require_all([(im, "terrain", f"bbox-village-ramps/{name}") for _, name, im in items], context="bundle")
    except ObjectGateRefused as e:
        print("not baked — object gate:", e); return 1
    art = json.loads(ART.read_text())
    art[STYLE]["pieces"] = {key: {"w": im.width, "h": im.height, "rgba": list(im.tobytes())} for key, _, im in items}
    ART.write_text(json.dumps(art) + "\n"); print(f"baked {len(items)} pieces into {ART.relative_to(ROOT)} [{STYLE}]")
    return 0

if __name__ == "__main__":
    sys.exit(main())
