#!/usr/bin/env python3
"""3x crops of the probe renders (the cut band of every rise) -> <style>-probe-3x.png (main widths: ramp w2, stairs w3) and
probe/<style>-probe-alt-3x.png (ramp w3, stairs w2)."""
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
for s in ("sand-steps", "snow-steps", "peat-steps", "cave-steps"):
    for src, dst in ((f"{HERE}/{s}-probe.png", f"{HERE}/{s}-probe-3x.png"), (f"{HERE}/probe/{s}-probe-alt.png", f"{HERE}/probe/{s}-probe-alt-3x.png")):
        im = Image.open(src).convert("RGB")
        c = im.crop((0, 96, im.width, 240))       # face band of rise 1..4 (face tops 128..176, foot row 192..208) with context
        c.resize((c.width * 3, c.height * 3), Image.NEAREST).save(dst)
print("crops ok")
