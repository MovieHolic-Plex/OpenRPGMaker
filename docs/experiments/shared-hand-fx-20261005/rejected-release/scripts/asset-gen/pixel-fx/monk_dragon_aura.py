"""Winged golden summon. Every cel is authored in hand-authored/monk_dragon_aura.hand.json."""
from lib_monk import run
from hand_pixels import export_grid, scout_setup

KEY, SIZE, FRAMES, ANCHOR = 'monk_dragon_aura', 128, 12, 'screen'
PAL, draw = scout_setup(KEY)

if __name__ == '__main__':
    export_grid(KEY)
    run(globals())
