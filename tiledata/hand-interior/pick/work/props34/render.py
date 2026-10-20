"""Render atlas_biome_interior objects from the baked sheet (spec cells) — for 3/4 audit sheets."""
import json, sys
from PIL import Image
R='/home/main/z-project/rpg-zzu-v5-interior-props-34/'
SPEC=json.load(open(R+'src/assets/handInteriorSpec.json'))
SHEET=Image.open(R+'public/assets/atlas-interior/interior-chipset.png').convert('RGBA')
TPR=48
def tile(i):
    x,y=(i%TPR)*16,(i//TPR)*16
    return SHEET.crop((x,y,x+16,y+16))
def obj(oid):
    o=SPEC['objects'][oid]; cells=o['cells']
    xs=[c[0] for c in cells]; ys=[c[1] for c in cells]
    x0,y0=min(xs),min(ys); W=(max(xs)-x0+1)*16; H=(max(ys)-y0+1)*16
    im=Image.new('RGBA',(W,H))
    for c in cells:
        im.alpha_composite(tile(c[2]),((c[0]-x0)*16,(c[1]-y0)*16))
    return im
if __name__=='__main__':
    for a in sys.argv[1:]: obj(a).resize((obj(a).width*4,obj(a).height*4),Image.NEAREST).save('/tmp/o.png')
