#!/usr/bin/env python3
"""Original, coordinate-authored pixel bat. Python 3 + Pillow; no input artwork.

Only the review images are enlarged (nearest neighbour). Production pixels are
painted directly at 64x64. Run from any directory; outputs stay in this checkout.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/pixel-enemies/bat.png'
QA = ROOT / '.omo/pixel-enemy-bat'
# 14 opaque colours. Upper-left light, warm fur against blue-violet membranes.
HEX = {
    'o': '#201b30', 's': '#383044', 'b': '#544453',
    'h': '#77616c', 'l': '#a18a91',
    'v': '#37304e', 'm': '#51416d', 'p': '#71568b', 'q': '#9573aa',
    'i': '#a35c7b', 'r': '#b33353', 'e': '#ff6b72',
    't': '#b9aab0', 'w': '#f0dfc2',
}
PAL = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in HEX.items()}
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead']

# Hand-written tufts, two tall ears, brow, right-facing muzzle and two fangs.
BODY = '''
...ss..........ss...
...sho........sho...
...shbo......shio...
...shibo.....sibo...
....hibbo...shibo...
....shibo...shibo...
....shibbo.shibso...
.....shbbo.shbso....
....sshhhsshhbso....
...shlhhhhhhbbs.....
..shlllhhhhhbbso....
..shlhhhhhhbsseoo...
.shhhhhhhhbsoreeoo..
..shhhhhhbbsooreo...
.shhhbhhbbbbbssbso..
.shhbbhhbbbbshhbbsoo
oshbbbbbbbssshhttbbo
.sbbbbbbbssssoowowo.
..sbbbbbbsssoo.wo...
..sbbbbbbssso.......
...sbbbbssso........
...ssbbssso.........
....osbsso.........
....osossso........
....oto.oto........
.....oo..oo........
'''.strip().splitlines()


def grid(im, rows, x, y, lean=0, thrust=False):
    """Each character writes exactly one source pixel; no filtering or scaling."""
    for j, row in enumerate(rows):
        dx = (j - 12) // 5 * lean
        if thrust:
            dx += 3 if j < 17 else max(0, 20-j)
        for i, c in enumerate(row):
            if c != '.':
                im.putpixel((x + i + dx, y + j), PAL[c])


def poly(d, pts, c, outline=None):
    d.polygon(pts, fill=PAL[c], outline=PAL[outline] if outline else None)


def line(d, pts, c, width=1):
    d.line(pts, fill=PAL[c], width=width)


def wing(im, root, elbow, tip, edge, far=False):
    """An authored five-finger silhouette, folded planar light and dark ribs.

    edge alternates membrane scallop valleys and finger ends, tip to root.
    All rasterisation is integer and aliased on the final source grid.
    """
    d = ImageDraw.Draw(im)
    poly(d, [root, elbow, tip] + edge, 'v' if far else 'm', 'o')
    # Broad directional plane; intentionally not nested contour shading.
    inner = ((tip[0] + elbow[0]) // 2, (tip[1] + elbow[1]) // 2 + 2)
    poly(d, [root, elbow, inner, edge[1]], 'm' if far else 'p')
    for end in edge[0::2]:
        line(d, [elbow, end], 'o')
    line(d, [root, elbow, tip], 's', 2)
    line(d, [(root[0], root[1]-1), (elbow[0], elbow[1]-1), tip], 'p' if far else 'q')
    # A short lit seam on the upper-left side of the near wrist.
    if not far:
        ex, ey = elbow
        line(d, [(ex-2,ey+2),(ex-2,ey+4)], 'p')
    # Thumb hook is connected to the arm, with a two-pixel ivory cap.
    ex, ey = elbow
    line(d, [(ex, ey), (ex, ey-3), (ex+2, ey-4), (ex+3, ey-2)], 'o')
    line(d, [(ex, ey-3), (ex+1, ey-3)], 't')


# Per-frame wing coordinates; no source sprite is copied, rotated or traced.
# (root, wrist, wingtip, scalloped trailing contour)
WINGS = {
 'idle_a': (
  ((35,28),(46,17),(58,10),[(55,27),(50,24),(48,32),(43,28),(39,34),(35,32)]),
  ((29,30),(18,15),(5,9),[(8,29),(13,25),(16,34),(21,29),(25,36),(30,33)])),
 'idle_b': (
  ((35,29),(46,23),(58,25),[(54,37),(50,32),(46,39),(42,34),(38,37),(35,32)]),
  ((29,31),(18,23),(5,25),[(8,39),(13,34),(17,41),(21,35),(26,38),(30,33)])),
 'idle_c': (
  ((35,30),(45,30),(57,46),[(47,43),(46,38),(41,41),(40,35),(36,37),(35,33)]),
  ((29,32),(18,30),(7,47),[(17,44),(18,39),(23,42),(24,36),(28,39),(30,34)])),
 'windup': (
  ((29,31),(38,15),(50,5),[(47,23),(42,20),(38,29),(34,25),(31,35),(29,34)]),
  ((24,32),(13,14),(5,4),[(6,27),(11,23),(15,34),(18,29),(23,37),(27,34)])),
 'move': (
  ((33,30),(23,22),(7,19),[(17,29),(21,27),(27,34),(30,31),(34,35),(35,32)]),
  ((30,32),(20,27),(4,27),[(14,37),(20,34),(24,40),(28,36),(33,39),(35,34)])),
 'attack': (
  ((39,29),(49,21),(60,27),[(57,36),(53,32),(49,39),(46,35),(42,39),(39,32)]),
  ((32,32),(18,24),(7,31),[(17,36),(20,33),(25,40),(29,36),(35,39),(38,33)])),
 'recover': (
  ((33,26),(44,28),(57,42),[(47,40),(45,35),(41,39),(39,32),(35,34),(33,30)]),
  ((27,28),(15,27),(4,43),[(14,40),(16,35),(20,40),(23,33),(27,35),(29,30)])),
 'hit': (
  ((29,30),(41,19),(54,15),[(48,29),(44,26),(40,36),(36,31),(31,37),(29,33)]),
  ((23,31),(13,29),(5,44),[(15,42),(16,36),(20,39),(22,35),(25,38),(27,33)])),
}


def draw_frame(name):
    im = Image.new('RGBA', (64,64))
    d = ImageDraw.Draw(im)
    if name == 'dead':
        # Folded wings lie sideways; belly up, ears pressed against the ground.
        poly(d, [(10,57),(16,46),(24,47),(32,54),(45,50),(54,59),(49,60),(16,60)], 'm', 'o')
        poly(d, [(13,56),(17,48),(23,49),(29,55),(23,54),(18,57)], 'p')
        line(d, [(17,49),(20,59),(25,52),(29,59)], 'o')
        line(d, [(18,50),(20,55)], 'q')
        line(d, [(45,52),(50,57),(44,56)], 'p')
        line(d, [(46,54),(49,58)], 'o')
        poly(d, [(24,54),(25,50),(27,48),(34,48),(38,51),(42,53),(44,58),(41,60),(27,60),(23,58)], 'b', 'o')
        poly(d, [(26,51),(28,49),(33,49),(36,52),(34,55),(27,54)], 'h')
        line(d, [(28,50),(31,50),(32,51)], 'l')
        line(d, [(26,54),(28,55),(30,55)], 'b')
        line(d, [(29,57),(33,58),(35,57)], 's')
        poly(d, [(38,56),(43,54),(51,58),(50,60),(39,59)], 's', 'o')
        poly(d, [(35,57),(39,56),(44,60),(35,60)], 'i', 'o')
        line(d, [(37,52),(39,54),(41,52)], 'o')
        line(d, [(42,55),(45,56)], 'o')
        line(d, [(43,56),(43,57)], 'w')
        line(d, [(28,49),(27,46),(29,45)], 'o', 2)
        line(d, [(33,49),(34,46),(36,46)], 'o', 2)
        im.putpixel((29,45), PAL['t'])
        im.putpixel((36,46), PAL['t'])
        return im
    far, near = WINGS[name]
    wing(im, *far, far=True)
    wing(im, *near)
    x,y,lean = {
      'idle_a': (24,10,0), 'idle_b': (24,11,0), 'idle_c': (24,12,0),
      'windup': (19,12,0), 'move': (27,15,1), 'attack': (31,11,0),
      'recover': (22,8,0), 'hit': (18,11,-1),
    }[name]
    grid(im, BODY, x,y,lean, thrust=name == 'attack')
    if name in ('windup','attack'):
        # A shaped muzzle and lower jaw, joined to the cheek at the left.
        mouth = [
            'sshhbbs.....',
            'shhttbbso...',
            'sbtwowwboo..',
            'sbowoowooo..',
            'sboooowoo...',
            'sbsoooooo...',
            '.sborroo....',
            '.sbhrrbo....',
            '..sbbbso....',
            '...ssso.....',
        ]
        grid(im, mouth, x+12+(3 if name == 'attack' else 0), y+14)
    if name == 'attack':
        # Forward legs and hooked claws remain joined to the belly.
        line(d, [(40,31),(45,35),(51,33)], 'o', 3)
        line(d, [(40,31),(45,34),(51,32)], 'h')
        line(d, [(51,32),(53,33),(52,35)], 't')
        line(d, [(39,34),(44,39),(49,38)], 'o', 3)
        line(d, [(40,34),(44,38),(49,37)], 'b')
        line(d, [(49,37),(51,38),(50,40)], 't')
    if name == 'hit':
        # Replace the red eye with a clenched chevron at the leaned face.
        poly(d, [(31,22),(35,22),(36,26),(31,26)], 'b')
        line(d, [(32,23),(34,24),(32,25)], 'o')
    return im


def validate(sheet, frames):
    assert sheet.mode == 'RGBA' and sheet.size == (192,192)
    assert set(sheet.getchannel('A').tobytes()) == {0,255}
    opaque = {sheet.getpixel((x,y)) for y in range(192) for x in range(192) if sheet.getpixel((x,y))[3]}
    assert len(opaque) <= 16
    report = {'mode':sheet.mode, 'size':list(sheet.size), 'alpha':[0,255],
              'opaque_colors':len(opaque), 'bbox_convention':'inclusive local x0,y0,x1,y1', 'frames':{}}
    for name, im in zip(NAMES, frames):
        x0,y0,x1,y1 = im.getbbox()
        assert 1 <= x0 < x1 <= 63 and 1 <= y0 < y1 <= 63, name
        if name.startswith('idle'):
            assert y1-1 <= 50 and 50 <= x1-x0 <= 56, name
        if name == 'dead':
            assert y1-1 == 60
        # Eight-connected components expose accidental floating single pixels.
        points = {(x,y) for y in range(64) for x in range(64) if im.getpixel((x,y))[3]}
        components = []
        while points:
            todo = [points.pop()]
            n = 0
            while todo:
                x,y = todo.pop()
                n += 1
                for dx,dy in ((-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)):
                    p = (x+dx,y+dy)
                    if p in points:
                        points.remove(p)
                        todo.append(p)
            components.append(n)
        assert len(components) == 1, (name,components)
        report['frames'][name] = {'bbox':[x0,y0,x1-1,y1-1], 'size':[x1-x0,y1-y0], 'components':sorted(components)}
    return report


def previews(sheet, frames):
    bg = Image.new('RGBA', sheet.size, '#202840')
    bg.alpha_composite(sheet)
    preview = bg.convert('RGB').resize((768,768), Image.Resampling.NEAREST)
    d = ImageDraw.Draw(preview)
    for p in (0,256,512,767):
        d.line([(p,0),(p,767)], fill='#586078')
        d.line([(0,p),(767,p)], fill='#586078')
    for i,name in enumerate(NAMES):
        d.text((i%3*256+8,i//3*256+8), name, fill='#d6cddc')
    preview.save(QA / 'preview.png')
    sequence = [(0,140),(1,120),(2,140),(1,120)]*2 + [
        (3,280),(4,160),(5,240),(6,220),(0,140),(1,120),(2,140),(1,120),
        (7,300),(0,140),(1,120),(2,140),(1,120),(8,1200)]
    gif_frames=[]
    for index, duration in sequence:
        f = Image.new('RGBA',(64,64),'#202840')
        f.alpha_composite(frames[index])
        gif_frames.append(f.convert('RGB').resize((256,256),Image.Resampling.NEAREST))
    gif_frames[0].save(QA/'cycle.gif', save_all=True, append_images=gif_frames[1:],
                       duration=[ms for _,ms in sequence], loop=0, disposal=2, optimize=False)
    # Extract actual encoded GIF frames for review, rather than assumed inputs.
    with Image.open(QA/'cycle.gif') as gif:
        assert gif.size == (256,256) and gif.n_frames == len(sequence)
        for idx, (_, duration) in enumerate(sequence):
            gif.seek(idx)
            assert gif.info['duration'] == duration
            assert gif.convert('RGB').tobytes() == gif_frames[idx].tobytes()
        key = Image.new('RGB',(256*5,256),'#202840')
        for col, idx in enumerate((0,8,10,16,21)):
            gif.seek(idx)
            key.paste(gif.convert('RGB'),(col*256,0))
        key.save(QA/'gif-keyframes.png')


def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    QA.mkdir(parents=True,exist_ok=True)
    frames = [draw_frame(name) for name in NAMES]
    sheet = Image.new('RGBA',(192,192))
    for i, im in enumerate(frames):
        sheet.paste(im,(i%3*64,i//3*64))
    report = validate(sheet,frames)
    sheet.save(OUT)
    # Verify the file written to disk, not only the in-memory image.
    with Image.open(OUT) as saved:
        assert saved.tobytes() == sheet.tobytes()
        assert saved.mode == 'RGBA' and saved.size == (192,192)
    previews(sheet,frames)
    (QA/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':
    main()
