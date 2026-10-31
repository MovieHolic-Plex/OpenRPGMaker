#!/usr/bin/env python3
"""Sample the native beodeul road/track as it renders on a straight north-south run (autotile side edges included: the track's
ragged grass edge, the paving's kerb) — the foot row of every cut piece is this segment, so the climb starts on the very road
that leads to it (the r2 adversarial VQA: a plain interior tile read as a pasted rectangle wider than the track).
  python3 sample_foot.py <probe.png from probe.mts>   -> foot-<ramp|stairs>-w<2|3>.png"""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
im = Image.open(sys.argv[1]).convert("RGB"); pad = im.height - 13 * 16
# probe.mts sections: ramp w2 at x=1, stairs w3 at x=6, ramp w3 at x=23, stairs w2 at x=28; row 9 = straight run on level 0
for (kind, w), x0 in {("ramp", 2): 1, ("stairs", 3): 6, ("ramp", 3): 23, ("stairs", 2): 28}.items():
    im.crop((x0 * 16, 9 * 16 + pad, (x0 + w) * 16, 10 * 16 + pad)).save(f"{HERE}/foot-{kind}-w{w}.png")
print("ok")
