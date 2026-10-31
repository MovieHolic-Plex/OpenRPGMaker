#!/usr/bin/env python3
"""zoom crops of the probe renders: probe/<style>-r<rise>-4x.png (one rise section: ramp w2 + stairs w3, 4x) and
probe/<style>-1x-strip.png (the cut band at 1x, unscaled, for the at-a-glance read)."""
import sys, os
from PIL import Image
D = os.path.dirname(os.path.abspath(__file__))
for s in sys.argv[1:] or ["grass-steps", "sand-steps", "snow-steps", "peat-steps", "cave-steps"]:
    im = Image.open(f"{D}/probe/{s}.png").convert("RGB")
    for i, r in enumerate((1, 2, 3, 4)):
        x0 = 1 + i * 10
        top = 160 - 16 * r
        c = im.crop(((x0 - 1) * 16, top - 20, (x0 + 8) * 16, top + 32 + 24))
        c.resize((c.width * 4, c.height * 4), Image.NEAREST).save(f"{D}/probe/{s}-r{r}-4x.png")
    rs = [Image.open(f"{D}/probe/{s}-r{r}-4x.png") for r in (1, 2, 3, 4)]
    w, hh = rs[0].size; g = 8
    out = Image.new("RGB", (2 * w + g, 2 * hh + g), (24, 24, 30))
    for k, c in enumerate(rs): out.paste(c, ((k % 2) * (w + g), (k // 2) * (hh + g)))
    out.save(f"{D}/probe/{s}-4x.png")
