# Bake the leaf interior ("K · 잎 채움") into the green canopy source: the 47 grafted canopy tiles of the forest
# cliff-village atlas (tex_forest_cliff_reference) and its 11 interior variants (forestGroveCanopy.json interior.sources).
# Idempotent: it always starts from the pristine flat canopy in tiledata/forest-villages/canopy-leaves/flat-canopy.png
# (extracted from the atlas on the first run). The climate sheets bake theirs in build-climate-chipsets.py.
# Usage: python3 scripts/content/bake-forest-canopy-leaves.py
import sys, pathlib
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent / "lib"))
import canopy_leaves as K

ATLAS = K.ROOT / "public/assets/region-references/forest-cliff-village-atlas.png"
atlas = Image.open(ATLAS).convert("RGBA")
sources = K.CANOPY["sources"]; interior = K.CANOPY["interior"]["sources"]
box = lambda t: ((t % 30) * 16, (t // 30) * 16)
if not K.FLAT.exists():
    full = atlas.crop((*box(sources[K.FULL]), box(sources[K.FULL])[0] + 16, box(sources[K.FULL])[1] + 16))
    assert len(set(full.getdata())) == 1, "the atlas canopy is not flat any more; restore flat-canopy.png from git"
    K.FLAT.parent.mkdir(parents=True, exist_ok=True)
    flat = Image.new("RGBA", (480, 32), (0, 0, 0, 0))
    for i, t in enumerate(sources): flat.paste(atlas.crop((*box(t), box(t)[0] + 16, box(t)[1] + 16)), ((i % 30) * 16, (i // 30) * 16))
    flat.save(K.FLAT, optimize=True)
for i, tile in enumerate(K.flat_tiles()): atlas.paste(tile, box(sources[i]))
K.bake(atlas, sources, interior)
atlas.save(ATLAS, optimize=True)
print({"canopy": len(sources), "interior": interior, "tones": K.TONES})
