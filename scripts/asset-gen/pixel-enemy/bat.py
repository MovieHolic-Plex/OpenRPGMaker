#!/usr/bin/env python3
"""Coordinate-authored 48px bat; Python 3 + Pillow, no AI or resampled art.

Production pixels are painted on the final grid. Only QA is enlarged, at 4x.
Run from any directory; all outputs stay in this checkout.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'public/assets/generated/pixel-enemies/bat.png'
ACTOR = ROOT / 'public/assets/generated/charset-battlers/actor1-0.png'
QA = ROOT / '.omo/pixel-enemy-bat'
CELL, CENTER, GROUND = 48, 24, 44
# Original palette: upper-left light, warm fur and blue-violet membranes.
HEX = {
    'o': '#201b30', 's': '#383044', 'b': '#544453',
    'h': '#77616c', 'l': '#a18a91',
    'v': '#37304e', 'm': '#51416d', 'p': '#71568b', 'q': '#9573aa',
    'i': '#a35c7b', 'r': '#b33353', 'e': '#ff6b72',
    't': '#b9aab0', 'w': '#f0dfc2',
}
PAL = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in HEX.items()}
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead']

# Newly authored one-character/one-pixel face, ears, 9px torso and tiny feet.
# The rightward muzzle protrudes beyond the torso; no source sprite is scaled.
BODY = '''
.o....o....
.sh...si...
.shb..si...
.shibshi...
..shhbso...
.oshhbbso..
.shlhbreo.
.shlhhbso..
.shhbbbsbo.
.shbbbhtbso
.sbbbbowow.
..sbbso.o..
..sbbso....
..osbso....
..ototo....
...o.o.....
'''.strip().splitlines()


def grid(im, rows, x, y):
    for j, row in enumerate(rows):
        for i, c in enumerate(row):
            if c != '.':
                im.putpixel((x+i, y+j), PAL[c])


def poly(d, pts, c, outline=None):
    d.polygon(pts, fill=PAL[c], outline=PAL[outline] if outline else None)


def line(d, pts, c):
    d.line(pts, fill=PAL[c], width=1)


def wing(im, root, wrist, tip, edge, far=False):
    """Integer final-grid scallops, three fingers and one-pixel thumb cap."""
    d = ImageDraw.Draw(im)
    poly(d, [root, wrist, tip] + edge, 'v' if far else 'm', 'o')
    inner = ((wrist[0]+tip[0])//2, (wrist[1]+tip[1])//2+2)
    poly(d, [root, wrist, inner, edge[1]], 'm' if far else 'p')
    for end in edge[::2]:
        line(d, [wrist, end], 'o')
    line(d, [root, wrist, tip], 'p' if far else 'q')
    im.putpixel((wrist[0], wrist[1]-1), PAL['t'])


# Independently authored final-grid poses: (root, wrist, tip, scalloped edge).
WINGS = {
 'idle_a': (
  ((26,22),(32,16),(39,12),[(37,23),(34,21),(32,26),(29,24),(27,27),(25,24)]),
  ((22,23),(16,16),(8,12),[(10,24),(13,21),(16,27),(19,24),(21,28),(23,25)])),
 'idle_b': (
  ((26,23),(32,21),(39,22),[(36,29),(33,26),(31,30),(28,27),(26,29),(25,25)]),
  ((22,24),(16,21),(8,22),[(10,30),(13,27),(16,31),(19,27),(21,29),(23,26)])),
 'idle_c': (
  ((26,24),(32,24),(39,32),[(33,30),(32,27),(29,30),(28,26),(26,28),(25,25)]),
  ((22,25),(16,24),(8,33),[(14,31),(15,28),(18,31),(19,27),(21,29),(23,26)])),
 'windup': (
  ((25,22),(31,15),(39,13),[(36,22),(33,19),(30,26),(28,23),(25,28),(24,24)]),
  ((21,23),(15,15),(8,13),[(10,24),(13,21),(16,28),(18,24),(20,29),(22,25)])),
 'move': (
  ((26,22),(32,18),(39,17),[(35,24),(32,22),(30,27),(28,24),(26,27),(25,24)]),
  ((24,24),(18,23),(8,23),[(14,29),(18,27),(22,31),(24,28),(27,29),(28,25)])),
 'attack': (
  ((27,22),(33,19),(40,22),[(37,28),(34,25),(32,30),(30,27),(27,29),(26,25)]),
  ((23,24),(17,21),(9,24),[(13,29),(16,26),(20,31),(22,28),(25,30),(26,26)])),
 'recover': (
  ((26,21),(32,22),(39,30),[(33,29),(32,25),(29,28),(28,24),(26,26),(25,23)]),
  ((22,22),(16,22),(8,31),[(14,29),(15,26),(18,30),(19,25),(21,27),(23,24)])),
 'hit': (
  ((25,23),(32,17),(39,15),[(35,24),(32,22),(29,28),(27,25),(25,29),(24,25)]),
  ((21,24),(15,24),(8,33),[(14,31),(15,28),(18,31),(19,27),(21,29),(22,25)])),
}
POSES = {
 'idle_a':(20,14), 'idle_b':(20,15), 'idle_c':(20,16),
 'windup':(19,15), 'move':(23,16), 'attack':(22,14),
 'recover':(20,13), 'hit':(18,15),
}


def draw_body(name):
    im = Image.new('RGBA', (CELL,CELL))
    x,y = POSES[name]
    grid(im, BODY, x,y)
    if name in ('windup','attack'):
        grid(im, ['hbbso', 'twowo', 'boowo', 'oroo.', 'srbso', '.sso.'], x+6,y+8)
    if name == 'attack':
        d = ImageDraw.Draw(im)
        line(d, [(26,27),(30,29),(33,27)], 'o')
        line(d, [(27,27),(30,28),(33,26)], 'h')
        line(d, [(33,26),(33,27)], 't')
    if name == 'hit':
        grid(im, ['bbo','obo','boo'], x+6,y+6)
    return im


def draw_frame(name):
    im = Image.new('RGBA', (CELL,CELL))
    d = ImageDraw.Draw(im)
    if name == 'dead':
        poly(d, [(9,42),(15,36),(20,37),(24,41),(33,38),(39,44),(10,44)], 'm', 'o')
        poly(d, [(13,41),(15,37),(19,38),(22,41),(18,40),(16,42)], 'p')
        line(d, [(15,38),(17,43),(20,39),(23,43)], 'o')
        line(d, [(15,37),(17,38)], 'q')
        poly(d, [(20,40),(22,37),(27,37),(30,39),(32,43),(29,44),(21,44),(19,42)], 'b','o')
        poly(d, [(22,38),(26,38),(28,40),(23,41),(21,40)], 'h')
        line(d, [(23,38),(25,38)], 'l')
        line(d, [(23,43),(27,43)], 's')
        poly(d, [(29,41),(33,40),(36,44),(30,43)], 'i','o')
        line(d, [(28,39),(29,40),(30,39)], 'o')
        im.putpixel((32,42), PAL['w'])
        line(d, [(22,37),(22,35),(23,35)], 'o')
        line(d, [(26,37),(27,35),(28,35)], 'o')
        im.putpixel((23,35), PAL['t'])
        im.putpixel((28,35), PAL['t'])
        line(d, [(33,39),(35,42)], 'p')
        return im
    far,near = WINGS[name]
    wing(im,*far,far=True)
    wing(im,*near)
    im.alpha_composite(draw_body(name))
    return im


def validate(sheet, frames):
    assert sheet.mode == 'RGBA' and sheet.size == (144,144)
    assert set(sheet.getchannel('A').tobytes()) == {0,255}
    opaque = {color for _,color in sheet.getcolors(sheet.width*sheet.height) if color[3]}
    assert opaque <= set(PAL.values())
    report = {'mode':sheet.mode, 'size':list(sheet.size), 'cell':CELL,
              'alpha':[0,255], 'opaque_colors':len(opaque), 'center_x':CENTER,
              'ground_y':GROUND, 'bbox_convention':'inclusive local x0,y0,x1,y1', 'frames':{}}
    for name, im in zip(NAMES, frames):
        x0,y0,x1,y1 = im.getbbox()
        assert 1 <= x0 < x1 <= CELL-1 and 1 <= y0 < y1 <= CELL-1, name
        assert 30 <= x1-x0 <= 34, name
        assert abs((x0+x1-1)/2-CENTER) <= 1, name
        if name != 'dead':
            body = draw_body(name)
            bx0,by0,bx1,by1 = body.getbbox()
            assert 14 <= by1-by0 <= 18, name
            # Torso at the shoulder/belly rows, excluding the projecting muzzle.
            torso = Image.new('RGBA', (CELL,CELL))
            grid(torso, BODY, *POSES[name])
            widths = [sum(torso.getpixel((x,y))[3] > 0 for x in range(CELL))
                      for y in range(POSES[name][1]+5, POSES[name][1]+9)]
            assert 8 <= max(widths) <= 9, (name,widths)
            assert 20 <= (by0+by1-1)/2 <= 24, name
        if name.startswith('idle'):
            assert y1-1 <= 34, name
        if name == 'dead':
            assert y1-1 == GROUND
        else:
            assert y1-1 < GROUND
        points = {(x,y) for y in range(CELL) for x in range(CELL) if im.getpixel((x,y))[3]}
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
        report['frames'][name] = {'bbox':[x0,y0,x1-1,y1-1], 'size':[x1-x0,y1-y0], 'components':components}
        if name != 'dead':
            report['frames'][name].update(body_height=by1-by0, torso_width=max(widths), body_center_y=(by0+by1-1)/2)
    return report


def scale_preview(idle):
    with Image.open(ACTOR) as source:
        actor = source.convert('RGBA').crop((0,0,CELL,CELL))
    # Top: actual lowest opaque pixels aligned to y44 for direct size comparison.
    # Bottom: shared ground origin, preserving the bat's authored hover clearance.
    board = Image.new('RGB',(432,456),'#202840')
    d = ImageDraw.Draw(board)
    for row in range(2):
        top = 24+row*224
        for col, (name, frame) in enumerate((('actor1-0 idle',actor),('bat idle_a',idle))):
            bottom = frame.getbbox()[3]-1
            dy = GROUND-bottom if row == 0 or col == 0 else 0
            cell = Image.new('RGBA',(CELL,CELL),'#202840')
            cell.alpha_composite(frame,(0,dy))
            board.paste(cell.convert('RGB').resize((192,192),Image.Resampling.NEAREST),(16+col*208,top))
            d.text((16+col*208,top-16), f'{name}  4x  dy={dy:+}',fill='#d6cddc')
            d.line((16+col*208,top+(GROUND+1)*4,207+col*208,top+(GROUND+1)*4),fill='#8c9d85')
        d.text((16,top+195), 'Feet aligned / size' if row == 0 else 'Shared ground y=44 / hover',fill='#d6cddc')
    board.save(QA/'scale.png')
    return {'actor_bbox':list(actor.getbbox()), 'bbox_convention':'exclusive x1,y1',
            'scale':4, 'aligned_bottom_y':GROUND,
            'actor_shift_y':GROUND-(actor.getbbox()[3]-1),
            'bat_shift_y_for_size_only':GROUND-(idle.getbbox()[3]-1)}


def previews(sheet, frames):
    bg = Image.new('RGBA',sheet.size,'#202840')
    bg.alpha_composite(sheet)
    preview = bg.convert('RGB').resize((576,576),Image.Resampling.NEAREST)
    d = ImageDraw.Draw(preview)
    for p in (0,192,384,575):
        d.line([(p,0),(p,575)],fill='#586078')
        d.line([(0,p),(575,p)],fill='#586078')
    for i,name in enumerate(NAMES):
        d.text((i%3*192+8,i//3*192+8),name,fill='#d6cddc')
    preview.save(QA/'preview.png')
    sequence = [(0,140),(1,120),(2,140),(1,120)]*2 + [
        (3,280),(4,160),(5,240),(6,220),(0,140),(1,120),(2,140),(1,120),
        (7,300),(0,140),(1,120),(2,140),(1,120),(8,1200)]
    gif_frames = []
    for index,_ in sequence:
        f = Image.new('RGBA',(CELL,CELL),'#202840')
        f.alpha_composite(frames[index])
        gif_frames.append(f.convert('RGB').resize((192,192),Image.Resampling.NEAREST))
    gif_frames[0].save(QA/'cycle.gif',save_all=True,append_images=gif_frames[1:],
                     duration=[ms for _,ms in sequence],loop=0,disposal=2,optimize=False)
    with Image.open(QA/'cycle.gif') as gif:
        assert gif.size == (192,192) and gif.n_frames == len(sequence)
        for idx,(_,duration) in enumerate(sequence):
            gif.seek(idx)
            assert gif.info['duration'] == duration
            assert gif.convert('RGB').tobytes() == gif_frames[idx].tobytes()
        key = Image.new('RGB',(192*5,192),'#202840')
        for col,idx in enumerate((0,8,10,16,21)):
            gif.seek(idx)
            key.paste(gif.convert('RGB'),(col*192,0))
        key.save(QA/'gif-keyframes.png')


def main():
    OUT.parent.mkdir(parents=True,exist_ok=True)
    QA.mkdir(parents=True,exist_ok=True)
    frames = [draw_frame(name) for name in NAMES]
    sheet = Image.new('RGBA',(CELL*3,CELL*3))
    for i,im in enumerate(frames):
        sheet.paste(im,(i%3*CELL,i//3*CELL))
    report = validate(sheet,frames)
    sheet.save(OUT)
    with Image.open(OUT) as saved:
        assert saved.mode == 'RGBA' and saved.size == sheet.size
        assert saved.tobytes() == sheet.tobytes()
        assert validate(saved,[saved.crop((i%3*CELL,i//3*CELL,i%3*CELL+CELL,i//3*CELL+CELL)) for i in range(9)]) == report
    previews(sheet,frames)
    report['comparison'] = scale_preview(frames[0])
    (QA/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':
    main()
