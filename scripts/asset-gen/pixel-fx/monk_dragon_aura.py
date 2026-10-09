"""Reproduce the reused OPRN hydra cel; source: summon-hydra-reuse.json."""
from lib_monk import run
from hand_pixels import scout_setup

KEY, SIZE, FRAMES, ANCHOR = 'monk_dragon_aura', 128, 1, 'screen'
PAL, draw = scout_setup(KEY)

if __name__ == '__main__':
    run(globals())
