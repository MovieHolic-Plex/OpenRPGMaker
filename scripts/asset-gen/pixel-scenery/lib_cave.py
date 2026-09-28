"""Integer-only drawing/export helpers for cave, snow and desert.

Requires Python 3 + Pillow. Run a biome script from any working directory.
All art is newly constructed from authored coordinates at 320x180; the only
resampling is final NEAREST x2. No source art, randomness, filters or quantizers.
Evidence (including actor sprites, which are NOT part of the scenery palette)
lives under .omo/pixel-scenery. --check validates the existing exported PNGs.
"""
from pathlib import Path
import argparse
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'public/assets/generated/battle-scenery'
EVIDENCE = ROOT / '.omo/pixel-scenery'
SIZE = (320, 180)
LAYERS = ('sky', 'far', 'mid', 'ground')


class Canvas:
    def __init__(self, palette, fill=None):
        self.palette = palette
        self.image = Image.new('RGBA', SIZE, self.color(fill))
        self.draw = ImageDraw.Draw(self.image)

    def color(self, index):
        if index is None:
            return (0, 0, 0, 0)
        value = self.palette[index].lstrip('#')
        return tuple(int(value[n:n+2], 16) for n in (0, 2, 4)) + (255,)

    def poly(self, points, color):
        self.draw.polygon(points, fill=self.color(color))

    def rect(self, box, color):
        self.draw.rectangle(box, fill=self.color(color))

    def line(self, points, color, width=1):
        self.draw.line(points, fill=self.color(color), width=width)

    def stamp(self, points, x, y, color):
        self.poly([(x + a, y + b) for a, b in points], color)

    def clusters(self, x, y, color):
        """A deliberate little 2/3px chipped-rock motif, never random speckle."""
        self.rect((x, y, x+3, y+1), color)
        self.rect((x+6, y+2, x+8, y+3), color)


def rock(c, x, y, w, h, colors):
    """Faceted stone, anchored at its bottom; light from upper left."""
    outline, dark, base, light = colors
    pts = [(0,-h//3),(w//5,-h+2),(w//2,-h),(w*4//5,-h*3//4),
           (w,-h//3),(w-2,0),(w//3,2),(-2,-2)]
    c.stamp(pts, x, y, outline)
    c.stamp([(0,-h//3),(w//5+1,-h+3),(w//2,-h+1),(w*3//4,-h*2//3),
             (w*2//3,-2),(w//3,0),(0,-2)], x, y, base)
    c.stamp([(w//2,-h+2),(w*4//5-1,-h*3//4+1),(w-1,-h//3),
             (w-3,-1),(w*2//3,-1),(w*3//4,-h*2//3)], x, y, dark)
    c.stamp([(2,-h//3-1),(w//5+2,-h+4),(w//2-1,-h+2),
             (w//2-3,-h+5),(w//4+2,-h+6),(w//4,-h//3-1)], x, y, light)
    if w > 15:
        c.line([(x+4,y-h//3+2),(x+w//3,y-h//3+2),(x+w//3+2,y-h//3+4)],dark)
        c.rect((x+w//3,y-h+4,x+w//3+2,y-h+5),light)


def actors(preview, biome):
    proof = preview.copy()
    placements = [('charset-battlers/actor1-0.png',460,250),
                  ('pixel-enemies/slime.png',150,270)]
    for relative, center, feet in placements:
        with Image.open(ROOT / 'public/assets/generated' / relative) as sheet:
            cell = sheet.convert('RGBA').crop((0,0,48,48)).resize((96,96),Image.Resampling.NEAREST)
        left, top, right, bottom = cell.getbbox()
        proof.alpha_composite(cell,(center-(left+right)//2,feet-bottom))
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    proof.save(EVIDENCE / f'{biome}-with-actors.png')


def validate(biome, palette):
    images = {}
    visible = set()
    rgba = set()
    for name in (*LAYERS,'preview'):
        with Image.open(OUTPUT / biome / f'{name}.png') as source:
            im = source.convert('RGBA')
        assert im.size == (640,360), (biome,name,im.size)
        pixels = set(im.getdata())
        assert {p[3] for p in pixels} <= {0,255}, (biome,name,'fractional alpha')
        visible.update(p[:3] for p in pixels if p[3])
        rgba.update(pixels)
        small = im.resize(SIZE,Image.Resampling.NEAREST)
        assert small.resize(im.size,Image.Resampling.NEAREST).tobytes() == im.tobytes(), (biome,name,'not 2x pixels')
        images[name] = im
    assert len(visible) <= 24, (biome,len(visible))
    allowed = {Canvas(palette).color(i)[:3] for i in range(len(palette))}
    assert visible <= allowed, (biome,'unauthored color')
    sky = images['sky']
    assert sky.getchannel('A').getextrema() == (255,255)
    assert sky.crop((0,0,1,360)).tobytes() == sky.crop((639,0,640,360)).tobytes(), (biome,'sky seam')
    for name in ('far','mid'):
        assert images[name].getchannel('A').getextrema() == (0,255), (biome,name,'missing transparency')
    ground = images['ground']
    assert ground.getchannel('A').crop((0,0,640,140)).getextrema() == (0,0), (biome,'floor above horizon')
    assert ground.getchannel('A').crop((0,160,640,360)).getextrema() == (255,255), (biome,'floor hole')
    composite = Image.new('RGBA',(640,360))
    for name in LAYERS:
        composite.alpha_composite(images[name])
    assert composite.tobytes() == images['preview'].tobytes(), (biome,'incorrect preview')
    assert composite.getchannel('A').getextrema() == (255,255)
    report = dict(biome=biome,visible_colors=len(visible),rgba_colors_including_transparency=len(rgba),
                  size='640x360',nearest_2x=True,alpha='0/255',sky_opaque=True,
                  sky_first_last_columns_equal=True,ground_opaque_from_y=160,
                  ground_transparent_above_y=140,far_mid_have_transparency=True,composite_exact=True)
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    (EVIDENCE / f'{biome}-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
    return report


def export(biome, palette, layers):
    assert len(palette) <= 24
    folder = OUTPUT / biome
    folder.mkdir(parents=True,exist_ok=True)
    preview = Image.new('RGBA',SIZE)
    for name in LAYERS:
        layer = layers[name].image
        preview.alpha_composite(layer)
        layer.resize((640,360),Image.Resampling.NEAREST).save(folder / f'{name}.png')
    preview = preview.resize((640,360),Image.Resampling.NEAREST)
    preview.save(folder / 'preview.png')
    actors(preview,biome)
    validate(biome,palette)


def main(biome, palette, render):
    parser = argparse.ArgumentParser(description=f'Hand-shaped pixel {biome}; no AI source input.')
    parser.add_argument('--check',action='store_true',help='Validate existing files without redrawing.')
    args = parser.parse_args()
    if args.check:
        validate(biome,palette)
    else:
        export(biome,palette,render())
