"""Explicit native cels; current source: hero_magic_rework.py / hand-authored/*.study.px.json."""
from lib_mage import make
from hand_pixels import export_grid, mage_setup

KEY = "mage_chain_bolt"
FRAME = 64
FRAMES = 7
ANCHOR = "allTargets"
PEAK = [2, 4, 5]
PAL, draw = mage_setup(KEY)

if __name__ == '__main__':
    export_grid(KEY)
    make(KEY)
