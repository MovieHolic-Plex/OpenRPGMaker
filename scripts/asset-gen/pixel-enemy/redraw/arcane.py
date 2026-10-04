"""Fresh native64 arcane battlers, authored from integer pixel geometry."""
import arcane_slimes,arcane_constructs,arcane_undead,arcane_spirits,arcane_objects,arcane_creatures
MODULES=(arcane_slimes,arcane_constructs,arcane_undead,arcane_spirits,arcane_objects,arcane_creatures)
DESCRIPTIONS={slug:desc for mod in MODULES for slug,desc in mod.SPECIES.items()}
def draw(slug,pose,cell):
    for mod in MODULES:
        if slug in mod.SPECIES:return mod.draw(slug,pose,cell)
    raise KeyError(slug)
