"""Hand pixel refresh of all 56 arcane monsters. Draw directly on final grid."""
from common import run_group,POSES
import arcane_slimes,arcane_constructs,arcane_undead,arcane_spirits,arcane_objects,arcane_creatures
MODULES=[(arcane_slimes,'SLIMES'),(arcane_constructs,'GOLEMS'),(arcane_undead,'UNDEAD'),(arcane_spirits,'SPIRITS'),(arcane_objects,'OBJECTS'),(arcane_creatures,'CREATURES')]
def draw(slug,pose,cell):
    for module,key in MODULES:
        if slug in getattr(module,key):return module.draw(slug,pose,cell)
    raise KeyError(slug)
# Earlier rejected anatomy remains below this module's historical helpers only.
# Every public draw/command now delegates to the canonical fresh source.
_rejected_draw = draw

def draw(slug, pose, cell=None):
    from registry import draw_entry
    return draw_entry(slug, pose)

if __name__ == '__main__':
    from registry import helper
    helper.run_group('arcane', lambda slug, pose, cell: draw(slug, pose, cell))
