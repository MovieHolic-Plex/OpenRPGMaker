"""Explicit native cels; current source: hero_magic_rework.py / hand-authored/*.study.px.json."""
from lib_mage import make
from hand_pixels import export_grid, mage_setup

KEY = "mage_fire_burst"
FRAME = 64
FRAMES = 8
ANCHOR = "target"
PEAK = [2, 3, 5]
PAL, draw = mage_setup(KEY)

if __name__ == '__main__':
    export_grid(KEY)
    make(KEY)
