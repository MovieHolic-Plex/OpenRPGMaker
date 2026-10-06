"""Authored impact cels; current source: hero_magic_rework.py / aether_cels.py."""
from lib_monk import run
from hand_pixels import scout_setup

KEY, SIZE, FRAMES, ANCHOR = 'monk_dragon_hit', 64, 6, 'target'
PAL, draw = scout_setup(KEY)

if __name__ == '__main__':
    run(globals())
