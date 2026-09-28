"""Hand-authored 320x180 pixel shapes for plains/forest (Python 3 + Pillow).

No source art, random texture, filtering, quantization, or antialiasing is used.
Only actor QA reads existing images. Coordinates and palettes are logical pixels;
all deliverables are enlarged with NEAREST. Run either sibling biome script.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / '.omo/pixel-scenery'
SIZE = (320, 180)
LAYERS = ('sky', 'far', 'mid', 'ground')


def palette(values):
    return {key: tuple(bytes.fromhex(value)) + (255,) for key, value in values.items()}


def layers():
    return {key: Image.new('RGBA', SIZE) for key in LAYERS}


def poly(im, points, color):
    ImageDraw.Draw(im).polygon(points, fill=color)


def rect(im, box, color):
    ImageDraw.Draw(im).rectangle(box, fill=color)


def line(im, points, color, width=1):
    ImageDraw.Draw(im).line(points, fill=color, width=width)


def shape(im, x, y, points, color, scale=1):
    poly(im, [(x + u*scale, y + v*scale) for u, v in points], color)


def leaf(im, x, y, scale, colors, detail=True):
    """Interlocking angular oak leaves: four flat values, upper-left light."""
    dark, shade, body, light = colors
    contour = [(0,9),(2,9),(2,5),(6,5),(6,2),(11,2),(11,0),
               (18,0),(18,2),(23,2),(23,5),(27,5),(27,9),(29,9),
               (29,15),(26,15),(26,18),(21,18),(21,20),(14,20),
               (14,19),(7,19),(7,17),(2,17),(2,14),(0,14)]
    shape(im,x,y,contour,dark,scale)
    shape(im,x,y,[(1,9),(4,9),(4,5),(8,5),(8,2),(18,2),(18,4),
                  (23,4),(23,7),(26,7),(26,14),(23,14),(23,17),
                  (15,17),(15,18),(8,18),(8,15),(3,15),(3,12),(1,12)],shade,scale)
    shape(im,x,y,[(3,7),(7,7),(7,4),(12,4),(12,2),(17,2),(17,4),
                  (21,4),(21,7),(24,7),(24,11),(20,11),(20,14),
                  (15,14),(15,12),(10,12),(10,14),(5,14),(5,11),(3,11)],body,scale)
    if detail:
        shape(im,x,y,[(5,7),(8,7),(8,5),(12,5),(12,3),(16,3),(16,5),
                      (14,5),(14,7),(10,7),(10,9),(5,9)],light,scale)
        shape(im,x,y,[(16,8),(20,8),(20,10),(18,10),(18,12),(15,12),(15,10),(16,10)],light,scale)
        line(im,[(x+9*scale,y+16*scale),(x+12*scale,y+16*scale)],body,scale)
        line(im,[(x+22*scale,y+14*scale),(x+24*scale,y+14*scale)],body,scale)
        if scale == 2:
            # Fine subclusters cut across the broad masses at the real 1px grid.
            for u,v in [(7,9),(12,6),(19,5),(25,12),(34,11),(39,19),(17,23),(30,27),(9,28)]:
                shape(im,x+u,y+v,[(0,2),(2,2),(2,0),(6,0),(6,1),
                                  (8,1),(8,3),(5,3),(5,5),(1,5),(1,4),(0,4)],
                      light if u < 30 and v < 24 else body)
            for u,v in [(13,15),(27,18),(37,25),(21,31),(43,12)]:
                line(im,[(x+u,y+v),(x+u+3,y+v),(x+u+3,y+v-2),(x+u+6,y+v-2)],shade)


def grass(im, x, y, colors, size=1):
    shade, light = colors
    shape(im,x,y,[(0,5),(0,2),(2,4),(3,0),(4,0),(5,4),(7,2),
                  (8,2),(7,6),(1,6)],shade,size)
    line(im,[(x+3*size,y+2*size),(x+3*size,y+4*size)],light,size)
    line(im,[(x+6*size,y+4*size),(x+5*size,y+5*size)],light,size)


def rock(im, x, y, w, h, colors):
    edge, shade, face, light = colors
    pts = [(0,h//2),(w//5,2),(w//2,0),(w*4//5,2),(w-1,h//2),
           (w,h-2),(w*3//4,h),(w//5,h),(0,h-3)]
    shape(im,x,y,pts,edge)
    shape(im,x,y,[(1,h//2),(w//5,3),(w//2,1),(w*3//4,3),
                  (w*3//5,h-2),(w//5,h-2),(1,h-4)],face)
    shape(im,x,y,[(w*3//4,3),(w-2,h//2),(w-1,h-3),(w*3//4,h-1),
                  (w*3//5,h-2)],shade)
    line(im,[(x+3,y+h//2),(x+w//5+1,y+4),(x+w//2,y+2)],light)
    rect(im,(x+w//3,y+4,x+w//3+2,y+5),light)
    line(im,[(x+w//2,y+h-4),(x+w//2+3,y+h-4)],shade)


def trunk(im, x, top, bottom, width, colors):
    dark, shade, light = colors
    poly(im,[(x,top),(x+width,top),(x+width-2,bottom-11),
             (x+width+5,bottom),(x-6,bottom),(x+2,bottom-12)],dark)
    poly(im,[(x+2,top),(x+width-3,top),(x+width-5,bottom-10),
             (x+width,bottom-2),(x-2,bottom-2),(x+4,bottom-12)],shade)
    poly(im,[(x+2,top),(x+5,top),(x+6,bottom-14),(x+3,bottom-6),
             (x+2,bottom-3),(x,bottom-3),(x+4,bottom-15)],light)
    for k in range(3):
        yy = top+12+k*17
        if yy+9 < bottom:
            line(im,[(x+width-5,yy),(x+width-7,yy+3),(x+width-7,yy+9)],dark)
    # Split branches are connected silhouettes, never floating marks.
    poly(im,[(x+4,top+28),(x-13,top+10),(x-13,top+5),
             (x-8,top+8),(x+7,top+21)],shade)
    poly(im,[(x+width-3,top+18),(x+width+13,top+6),
             (x+width+12,top+12),(x+width-2,top+27)],dark)


def fern(im, x, y, direction, colors):
    dark, shade, light = colors
    # Three arcing fronds, with joined 2-3px leaflets.
    for reach,height in [(9,15),(14,9),(7,6)]:
        tip = (x+direction*reach,y-height)
        line(im,[(x,y),(x+direction*3,y-4),tip],dark)
        for n in (1,2,3):
            xx = x+direction*(reach*n//4)
            yy = y-height*n//4
            poly(im,[(xx,yy),(xx-direction*4,yy-3),(xx-direction*2,yy-4),
                     (xx+direction,yy-1)],light if n == 3 else shade)
            poly(im,[(xx,yy),(xx+direction*5,yy-1),(xx+direction*4,yy+1),
                     (xx,yy+2)],shade)


def cloud(im, x, y, colors, wispy=False):
    shadow, body, light = colors
    if wispy:
        # A different, long/low formation rather than another stamp of cumulus.
        shape(im,x,y,[(0,9),(7,9),(7,7),(18,7),(18,5),(23,5),(23,2),
                      (35,2),(35,0),(42,0),(42,3),(49,3),(49,5),
                      (57,5),(57,7),(71,7),(71,9),(82,9),(82,12),
                      (67,12),(67,14),(14,14),(14,12),(0,12)],shadow)
        shape(im,x,y,[(8,9),(19,9),(19,7),(25,7),(25,4),(36,4),
                      (36,2),(41,2),(41,5),(48,5),(48,7),(56,7),
                      (56,9),(67,9),(67,11),(15,11),(15,10),(8,10)],body)
        line(im,[(x+25,y+6),(x+32,y+6),(x+32,y+5),(x+39,y+5)],light)
        return
    outline = [(0,14),(5,14),(5,11),(12,11),(12,7),(17,7),(17,3),
               (23,3),(23,0),(33,0),(33,3),(39,3),(39,7),(45,7),
               (45,9),(52,9),(52,12),(60,12),(60,15),(67,15),
               (67,19),(61,19),(61,21),(9,21),(9,19),(0,19)]
    shape(im,x,y,outline,shadow)
    shape(im,x,y,[(2,14),(7,14),(7,11),(14,11),(14,7),(19,7),
                  (19,3),(24,3),(24,1),(32,1),(32,4),(38,4),
                  (38,8),(45,8),(45,11),(51,11),(51,14),(59,14),
                  (59,17),(45,17),(45,18),(9,18),(9,17),(2,17)],body)
    shape(im,x,y,[(16,8),(20,8),(20,4),(25,4),(25,2),(31,2),
                  (31,5),(27,5),(27,7),(25,7),(25,10),(16,10)],light)
    line(im,[(x+10,y+14),(x+19,y+14),(x+19,y+12),(x+23,y+12)],light)


def ground(im, p, forest=False):
    rect(im,(0,80,319,179),p['soil'])
    # The distant turf lip is thin so the stage starts at exactly logical y=80.
    poly(im,[(0,80),(319,80),(319,86),(286,86),(286,87),(241,87),
             (241,85),(202,85),(202,86),(150,86),(150,85),(102,85),
             (102,87),(60,87),(60,85),(0,85)],p['turf'])
    for x,y in [(-3,77),(8,75),(19,77),(38,76),(47,78),(63,77),(80,78),
                (93,77),(115,78),(139,77),(151,78),(174,78),(196,77),
                (214,76),(230,78),(248,77),(256,75),(275,77),(298,76),(313,77)]:
        grass(im,x,y,[p['turf'],p['soil']])
    # Irregular shaded sod hugs the boundary, keeping the middle low contrast.
    for x,y,flip in [(0,88,1),(319,91,-1),(0,141,1),(319,164,-1)]:
        poly(im,[(x,y),(x+flip*14,y),(x+flip*14,y+3),(x+flip*24,y+3),
                 (x+flip*24,y+6),(x+flip*17,y+6),(x+flip*17,y+10),
                 (x+flip*8,y+10),(x+flip*8,y+13),(x,y+13)],p['turf'])
    # Hand-placed broad, low-contrast earth islands; no noise field.
    for x,y,w in [(33,95,29),(141,99,45),(240,92,34),(81,119,37),
                  (183,135,49),(28,152,37),(263,150,29),(118,166,51)]:
        shape(im,x,y,[(0,2),(5,2),(5,0),(w-7,0),(w-7,2),(w,2),
                      (w,4),(w-4,4),(w-4,6),(8,6),(8,5),(0,5)],p['soil_light'])
    for x,y in [(24,108),(61,100),(106,108),(164,117),(259,110),(286,125),
                (52,138),(116,146),(218,154),(273,163),(170,172)]:
        line(im,[(x,y),(x+4,y),(x+4,y-1),(x+7,y-1)],p['turf'])
    # Small authored tufts use the same subdued ground ramp as the stage.
    # No stochastic pixels: every 3-8px motif is placed deliberately in groups.
    for x,y in [(31,103),(40,105),(93,96),(101,97),(215,94),(227,96),
                (162,110),(170,112),(275,115),(282,117),(52,128),(60,131),
                (122,136),(130,138),(236,143),(244,146),(76,159),(84,161),
                (179,156),(187,158),(288,154),(296,158)]:
        shape(im,x,y,[(0,3),(0,1),(1,1),(2,3),(3,0),(4,0),(4,3),
                      (6,2),(7,2),(6,4),(1,4)],p['turf'])
        line(im,[(x+1,y+5),(x+4,y+5)],p['soil_light'])
    # Foreground frame only; all sizable rocks stay outside the fighter rectangle.
    leaf_colors = [p['leaf_dark'],p['leaf_shadow'],p['leaf'],p['leaf_light']]
    for x,y,s in [(-17,103,1),(310,117,1),(-18,160,2),(307,167,2)]:
        leaf(im,x,y,s,leaf_colors)
    stones = [p['bark_dark'],p['stone_shadow'],p['stone'],p['stone_light']]
    rock(im,-8,130,23,16,stones)
    rock(im,307,153,24,18,stones)
    for x,y in [(4,94),(308,96),(10,154),(305,139),(33,174),(74,178),(282,177)]:
        grass(im,x,y,[p['leaf_shadow'],p['leaf']],1)
    # Narrow foreground turf outside y=170 makes a near plane without clutter.
    for x,y in [(3,173),(18,176),(34,172),(45,176),(61,175),(82,177),
                (103,178),(197,178),(220,176),(237,173),(257,176),(276,173),(294,174)]:
        grass(im,x,y,[p['leaf_shadow'],p['leaf']],1)
    for x,y in [(43,115),(200,103),(286,143),(135,156)]:
        line(im,[(x,y),(x+3,y)],p['turf'])
        line(im,[(x,y-1),(x+2,y-1)],p['soil_light'])


def actors(preview, biome):
    composed = preview.copy()
    for asset, cx, foot in [('charset-battlers/actor1-0.png',460,250),
                            ('pixel-enemies/slime.png',150,270)]:
        tile = Image.open(ROOT/'public/assets/generated'/asset).convert('RGBA').crop((0,0,48,48))
        tile = tile.resize((96,96),Image.Resampling.NEAREST)
        bounds = tile.getchannel('A').getbbox()
        # Align the visible sprite's feet and center, rather than its padded cell.
        dest = (cx-(bounds[0]+bounds[2])//2,foot-bounds[3])
        composed.alpha_composite(tile,dest)
    composed.save(EVIDENCE/f'{biome}-with-actors.png')


def finish(biome, images, p):
    out = ROOT/'public/assets/generated/battle-scenery'/biome
    out.mkdir(parents=True,exist_ok=True)
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    preview = Image.new('RGBA',SIZE)
    for key in LAYERS:
        images[key].resize((640,360),Image.Resampling.NEAREST).save(out/f'{key}.png')
        preview = Image.alpha_composite(preview,images[key])
    preview = preview.resize((640,360),Image.Resampling.NEAREST)
    preview.save(out/'preview.png')
    actors(preview,biome)
    # Reopen the actual written deliverables, including the preview.
    saved = {key:Image.open(out/f'{key}.png').convert('RGBA') for key in (*LAYERS,'preview')}
    colors = set()
    for key, im in saved.items():
        assert im.size == (640,360), key
        assert set(im.getchannel('A').getdata()) <= {0,255}, key
        colors.update(rgb[:3] for rgb in im.getdata() if rgb[3])
        # Prove true 2x nearest pixel blocks, not only nominal dimensions.
        assert im.resize(SIZE,Image.Resampling.NEAREST).resize(im.size,Image.Resampling.NEAREST).tobytes() == im.tobytes(), key
    sky = saved['sky']
    assert sky.getchannel('A').getextrema() == (255,255)
    assert sky.crop((0,0,1,360)).tobytes() == sky.crop((639,0,640,360)).tobytes()
    assert saved['ground'].crop((0,160,640,360)).getchannel('A').getextrema() == (255,255)
    assert saved['preview'].getchannel('A').getextrema() == (255,255)
    assert len(colors) <= 24, len(colors)
    assert colors <= {c[:3] for c in p.values()}
    merged = Image.new('RGBA',(640,360))
    for key in LAYERS:
        merged = Image.alpha_composite(merged,saved[key])
    assert merged.tobytes() == saved['preview'].tobytes()
    report = dict(biome=biome, colors=len(colors), dimensions='640x360', binary_alpha=True,
                  sky_opaque=True, sky_seam_equal=True, ground_opaque_from_y=160,
                  nearest_2x=True, composite_equal=True,
                  palette=sorted('#' + bytes(c).hex() for c in colors))
    (EVIDENCE/f'{biome}-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
