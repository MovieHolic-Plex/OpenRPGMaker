import sys, os
H = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(H, '..'))
from rc_props import *
import rc_props as R
items = [('stal_s', R.stalagmite('s', 1)), ('stal_m', R.stalagmite('m', 2)), ('stal_l', R.stalagmite('l', 3, .3)), ('cluster', R.stalagmite_cluster(1)),
         ('column', R.column_drip(1)), ('great', R.column_great(1)), ('stalact', R.stalactites_face(2, 1)), ('boulder_s', R.boulder('s', 1)),
         ('boulder_w', R.boulder('w', 2, True)), ('boulder_m', R.boulder('m', 3, True)), ('rubble', R.rubble(1)), ('pebbles', R.pebbles(1)),
         ('step', R.stepping_stone(1)), ('bridge', R.bridge_plank(1)), ('chest', R.chest(False)), ('chest_o', R.chest(True)), ('gold', R.gold_pile()),
         ('torch', R.torch_stand()), ('wtorch', R.wall_torch()), ('skull', R.skull_stake()), ('sign', R.signpost()), ('bones', R.bones()),
         ('skel', R.skeleton_remains()), ('stairs', R.stairs_down()), ('bats', R.bats_hanging()), ('bat', R.bat_flying()), ('mush', R.mushrooms()),
         ('moss', R.moss_patch()), ('web', R.cobweb()), ('roots', R.roots_hanging()), ('fern', R.fern_tuft()), ('camp', R.campfire_old()),
         ('ropecrate', R.rope_crate()), ('puddle', R.drip_puddle()), ('shaft', R.light_shaft()), ('mouth', R.cave_mouth())]
bg = SAMPLES['rc_rock']
def onfloor(im):
    b = new(im.width, im.height)
    for y in range(0, im.height, 48):
        for x in range(0, im.width, 48): b.alpha_composite(bg, (x, y))
    b.alpha_composite(im); return b
board([(n, onfloor(i)) for n, i in items], cols=9, scale=3).save(os.path.join(H, 'props1.png'))
