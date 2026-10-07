"""Native-scale component assembly; original roof and facade pixels stay intact.
Every replacement has a chosen source rectangle and a chosen destination.
"""
from pathlib import Path
from PIL import Image
import json, hashlib
ROOT=Path(__file__).resolve().parents[4]

def native(key):
    if key.startswith('arch:'):
        return Image.open(ROOT/'public/assets/beodeul-architecture'/(key[5:]+'.png')).convert('RGBA')
    catalog=json.loads((ROOT/'src/assets/beodeulCityTileset.json').read_text())
    kit=next(k for k in catalog['structureKits'] if k['id']==key)
    atlas=Image.open(ROOT/'public/assets/beodeul-city/beodeul-city-chipset.png').convert('RGBA')
    image=Image.new('RGBA',(kit['width']*16,kit['height']*16))
    for y,row in enumerate(kit['rows']):
        for x,n in enumerate(row['upperTiles']):
            if n>=0:image.paste(atlas.crop((n%128*16,n//128*16,n%128*16+16,n//128*16+16)),(x*16,y*16))
    return image

def render_native(item):
    image=Image.new('RGBA',(item['width'],item['height']))
    for part in item['components']:
        original=native(part['source']);x1,y1,x2,y2=part['rect']
        assert 0<=x1<x2<=original.width and 0<=y1<y2<=original.height,(item['id'],part['rect'],original.size)
        patch=original.crop((x1,y1,x2,y2))
        assert patch.width==part['rect'][2]-part['rect'][0] and patch.height==part['rect'][3]-part['rect'][1]
        x,y=part['at'];assert x>=0 and y>=0 and x+patch.width<=image.width and y+patch.height<=image.height
        # Whole rectangular replacement includes background alpha: no old door survives below a new window.
        if part.get('replace'):image.paste(patch,(x,y))
        else:image.alpha_composite(patch,(x,y))
    return image

def reference_image(item):
    return native(item['reference'])
