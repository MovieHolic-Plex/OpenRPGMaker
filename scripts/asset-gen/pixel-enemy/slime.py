#!/usr/bin/env python3
"""Hand-authored 48px slime cells. Python 3 + Pillow; no AI or downsampling.

Silhouettes are native scanlines; lighting and faces use integer pixel clusters.
The actor input is used only in the review comparison, never to draw the slime.
Only review images are enlarged, with nearest-neighbor sampling.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'public/assets/generated/pixel-enemies/slime.png'
ACTOR = ROOT / 'public/assets/generated/charset-battlers/actor1-0.png'
REVIEW = ROOT / '.omo/pixel-enemy-slime'
CELL, SCALE, BASELINE = 48, 4, 44
COLORS = {
    'D': '#173451',  # deep blue outline / facial ink
    'S': '#2d719b',  # cool shadow / lit-side outline
    'B': '#299fb8',  # clear turquoise body
    'L': '#70d0d2',  # upper-left transmitted light
    'H': '#b5ece4',  # internal bubble / reflection surround
    'W': '#effff0',  # three-pixel specular reflection
}
RGBA = {key: tuple(bytes.fromhex(value[1:])) + (255,) for key, value in COLORS.items()}
BG = '#202840'
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead']
# Inclusive row endpoints. These are authored at 1:1, not transformed old art.
SHAPES = {
    'idle_a': (29, [
        (22,25),(20,27),(19,28),(18,29),(18,30),(17,30),(17,31),(16,31),
        (16,32),(15,32),(15,32),(15,32),(16,31),(17,30),(18,29),(20,27)]),
    'idle_b': (30, [
        (21,26),(19,28),(18,29),(17,30),(16,31),(16,31),(15,32),(15,32),
        (14,33),(14,33),(14,33),(15,32),(16,31),(18,29),(20,27)]),
    'idle_c': (31, [
        (21,27),(19,29),(17,30),(16,31),(16,32),(15,32),(14,33),
        (14,33),(14,33),(14,33),(15,32),(16,31),(18,29),(20,27)]),
    'windup': (33, [
        (18,22),(16,25),(15,27),(14,29),(14,31),(13,32),
        (13,33),(13,34),(14,33),(15,32),(17,30),(20,27)]),
    'move': (23, [
        (29,32),(27,34),(25,35),(23,35),(22,35),(21,35),(20,34),(19,34),
        (18,33),(17,32),(16,31),(15,30),(15,28),(15,26),(16,24),(17,22),(18,20)]),
    'attack': (28, [
        (29,33),(27,35),(25,37),(23,38),(22,38),(21,38),(20,38),(19,38),
        (18,38),(17,38),(17,38),(18,38),(19,37),(21,36),(23,35),(25,33),(27,31)]),
    'recover': (33, [
        (21,26),(18,29),(16,31),(15,32),(14,33),(13,34),
        (12,35),(12,35),(13,34),(15,32),(17,30),(20,27)]),
    'hit': (29, [
        (17,21),(15,23),(14,25),(13,26),(13,27),(13,28),(14,29),(14,30),
        (15,31),(16,32),(16,33),(17,34),(18,33),(19,32),(21,30),(23,28)]),
    'dead': (40, [(19,29),(14,33),(11,35),(12,36),(16,32)]),
}
# Explicit shadow and light polygons, clipped to the authored silhouette.
PATCHES = {
    'idle_a': (
        [(30,34),(32,38),(32,41),(28,43),(19,43),(17,42),(25,42),(30,40)],
        [(21,31),(24,31),(26,33),(25,36),(22,38),(18,38),(18,35)]),
    'idle_b': (
        [(31,35),(33,38),(33,41),(28,43),(19,43),(16,42),(25,42),(31,40)],
        [(20,32),(24,32),(26,34),(25,37),(21,39),(17,39),(17,36)]),
    'idle_c': (
        [(31,35),(33,38),(33,41),(28,43),(19,43),(16,42),(25,42),(31,40)],
        [(20,33),(24,33),(26,35),(25,37),(21,39),(17,39),(17,36)]),
    'windup': (
        [(26,36),(31,38),(33,40),(28,43),(18,43),(16,41),(25,41)],
        [(18,35),(22,35),(25,37),(24,39),(16,40),(15,38)]),
    'move': (
        [(32,25),(34,27),(33,31),(29,34),(21,38),(20,35),(27,31),(29,26)],
        [(27,26),(30,25),(30,28),(25,31),(19,33),(20,30)]),
    'attack': (
        [(36,31),(37,33),(37,39),(31,43),(26,42),(33,40),(36,38)],
        [(28,31),(31,30),(32,32),(29,35),(23,38),(20,37),(23,34)]),
    'recover': (
        [(32,37),(34,39),(34,41),(28,43),(18,43),(15,42),(27,42),(32,40)],
        [(20,35),(24,35),(27,37),(25,39),(17,40),(16,38)]),
    'hit': (
        [(23,32),(28,35),(33,40),(30,43),(24,43),(21,40),(23,37)],
        [(17,31),(20,31),(23,33),(23,35),(19,37),(15,35)]),
    'dead': (
        [(34,42),(35,43),(17,43),(18,43),(33,43)],
        [(19,41),(26,41),(28,42),(16,42)]),
}
DETAILS = {
    'idle_a': ((20,33),(19,39)),
    'idle_b': ((19,34),(18,40)),
    'idle_c': ((19,35),(18,40)),
    'windup': ((17,36),(18,40)),
    'move': ((25,27),(21,32)),
    'attack': ((26,32),(24,38)),
    'recover': ((19,36),(18,40)),
    'hit': ((17,33),(20,39)),
    'dead': ((19,41),None),
}
FACES = {
    'idle_a': [((25,34), ['D.','DD','.D']), ((29,34), ['.D','DD','D.']), ((27,39), ['D.D','.D.'])],
    'idle_b': [((25,35), ['D.','DD','.D']), ((29,35), ['.D','DD','D.']), ((27,39), ['D.D','.D.'])],
    'idle_c': [((25,36), ['D.','DD','.D']), ((29,36), ['.D','DD','D.']), ((27,39), ['D.D','.D.'])],
    'windup': [((23,37), ['DD.','.DD']), ((29,37), ['.DD','DD.']), ((26,41), ['DDD'])],
    'move': [((29,27), ['DD','DD','DD']), ((33,26), ['D','D','D']), ((29,31), ['DD','SD'])],
    'attack': [((32,32), ['DD','DD']), ((36,32), ['D','D']), ((32,35), ['.DDD','DDDD','DDDD','.LLD'])],
    'recover': [((25,36), ['D.','DD','.D']), ((29,36), ['.D','DD','D.']), ((27,39), ['D.D','.D.'])],
    'hit': [((22,35), ['D.','.D','D.']), ((27,35), ['.D','D.','.D']), ((26,40), ['DD'])],
    'dead': [((24,41), ['D.D','.D.','D.D']), ((30,41), ['D.D','.D.','D.D'])],
}
DROPS = {
    'move': [((12,32), ['SB','BD']), ((12,38), ['SB','BD'])],
    'attack': [((39,25), ['SB','BD']), ((41,31), ['SB','BD']), ((40,40), ['SB','BD'])],
}


def stamp(image, origin, grid, allowed=None):
    """Literal native pixels. Body details must stay inside the silhouette."""
    ox, oy = origin
    for dy, row in enumerate(grid):
        for dx, char in enumerate(row):
            if char != '.':
                xy = (ox + dx, oy + dy)
                assert allowed is None or xy in allowed, (origin, xy)
                image.putpixel(xy, RGBA[char])


def draw_pose(name):
    y0, spans = SHAPES[name]
    pixels = {(x,y0+dy) for dy,(left,right) in enumerate(spans) for x in range(left,right+1)}
    frame = Image.new('RGBA', (CELL,CELL))
    patches = Image.new('RGBA', frame.size)
    pen = ImageDraw.Draw(patches)
    for key, vertices in zip(('S','L'), PATCHES[name]):
        pen.polygon(vertices, fill=RGBA[key])
    for x,y in pixels:
        color = patches.getpixel((x,y))
        frame.putpixel((x,y), color if color[3] else RGBA['B'])
        if any((x+dx,y+dy) not in pixels for dx,dy in [(0,-1),(-1,0),(1,0),(0,1)]):
            frame.putpixel((x,y), RGBA['S' if x < 24 and y < 40 else 'D'])
    reflection, bubble = DETAILS[name]
    stamp(frame, reflection, ['HWW','HW.'], pixels)
    if bubble:
        stamp(frame, bubble, ['HH','HL'], pixels)
        if name.startswith('idle') or name == 'recover':
            stamp(frame, (22,41), ['LL'], pixels)
    for origin, grid in FACES[name]:
        stamp(frame, origin, grid, pixels)
    for origin, grid in DROPS.get(name, []):
        stamp(frame, origin, grid)
    return frame


def components(frame):
    remaining = {(x,y) for y in range(CELL) for x in range(CELL) if frame.getpixel((x,y))[3]}
    sizes = []
    while remaining:
        stack = [remaining.pop()]
        size = 0
        while stack:
            x,y = stack.pop()
            size += 1
            for dx,dy in [(-1,-1),(0,-1),(1,-1),(-1,0),(1,0),(-1,1),(0,1),(1,1)]:
                nxt = (x+dx,y+dy)
                if nxt in remaining:
                    remaining.remove(nxt)
                    stack.append(nxt)
        sizes.append(size)
    return sorted(sizes, reverse=True)


def validate(sheet, frames):
    assert sheet.mode == 'RGBA' and sheet.size == (144,144)
    assert set(sheet.getchannel('A').tobytes()) == {0,255}
    palette = {color for count,color in sheet.getcolors(sheet.width*sheet.height) if color[3]}
    assert palette == set(RGBA.values())
    report = {'size': list(sheet.size), 'mode': sheet.mode, 'alpha': [0,255],
              'cell_size': CELL, 'opaque_palette_size': len(palette),
              'baseline': BASELINE, 'bbox_convention': 'cell-local, inclusive', 'frames': {}}
    for name,frame in frames.items():
        left,top,right,bottom = frame.getchannel('A').getbbox()
        width,height = right-left,bottom-top
        assert left >= 1 and top >= 1 and right <= CELL-1 and bottom <= CELL-1, name
        assert bottom-1 == (39 if name == 'move' else BASELINE), (name,bottom)
        sizes = components(frame)
        assert min(sizes) > 1, (name,'isolated pixel',sizes)
        assert len(sizes) == {'move':3,'attack':4}.get(name,1), (name,sizes)
        assert sum(count for count,color in frame.getcolors(CELL*CELL) if color == RGBA['W']) == 3, name
        if name.startswith('idle'):
            assert 18 <= width <= 20 and 14 <= height <= 16, name
            assert (left+right)/2 == 24, name
        if name == 'dead':
            assert height == 5
        y0, spans = SHAPES[name]
        body = [min(l for l,r in spans), y0, max(r for l,r in spans), y0+len(spans)-1]
        report['frames'][name] = {'bbox': [left,top,right-1,bottom-1], 'size': [width,height],
                                  'body_bbox': body, 'last_opaque_row': bottom-1, 'components': sizes}
    assert [report['frames'][n]['size'] for n in NAMES[:3]] == [[18,16],[20,15],[20,14]]
    return report


def make_previews(sheet, frames):
    side = CELL*SCALE
    preview = Image.new('RGBA',sheet.size,BG)
    preview.alpha_composite(sheet)
    preview = preview.convert('RGB').resize((side*3,side*3),Image.Resampling.NEAREST)
    pen = ImageDraw.Draw(preview)
    for line in (0,side,side*2,side*3-1):
        pen.line((line,0,line,side*3-1), fill='#505c78')
        pen.line((0,line,side*3-1,line), fill='#505c78')
    for index,name in enumerate(NAMES):
        x,y = index%3*side,index//3*side
        pen.text((x+12,y+12),name,fill='#c8d5e3')
        pen.line((x+4,y+(BASELINE+1)*SCALE,x+side-5,y+(BASELINE+1)*SCALE),fill='#39465e')
    preview.save(REVIEW/'preview.png')
    idle = ['idle_a','idle_b','idle_c','idle_b']
    sequence = idle*2 + ['windup','move','attack','recover','idle_a','hit','idle_a','dead']
    durations = [180]*8 + [260,140,180,200,400,300,400,1200]
    rendered = []
    gif_palette = Image.new('P',(1,1))
    values = [tuple(bytes.fromhex(BG[1:]))] + [rgba[:3] for rgba in RGBA.values()]
    flat = [channel for rgb in values for channel in rgb]
    gif_palette.putpalette(flat + [0]*(768-len(flat)))
    for name in sequence:
        shot = Image.new('RGBA',(CELL,CELL),BG)
        shot.alpha_composite(frames[name])
        shot = shot.convert('RGB').resize((side,side),Image.Resampling.NEAREST)
        rendered.append(shot.quantize(palette=gif_palette,dither=Image.Dither.NONE))
    rendered[0].save(REVIEW/'cycle.gif',save_all=True,append_images=rendered[1:],
                     duration=durations,loop=0,disposal=2,optimize=False)
    with Image.open(REVIEW/'cycle.gif') as gif:
        assert gif.n_frames == len(sequence)
        for index, expected in enumerate(rendered):
            gif.seek(index)
            actual = gif.convert('RGB')
            assert actual.tobytes() == expected.convert('RGB').tobytes(), ('GIF colors',index)
            assert gif.info['duration'] == durations[index]
            if index in (0,8,9,10,13,15):
                actual.save(REVIEW/f'gif-{index:02d}-{sequence[index]}.png')

    # Exact actor idle (0,0); align its last opaque row to slime y=44 by
    # translation only. Both full cells are enlarged by the SAME factor four.
    with Image.open(ACTOR) as source:
        actor = source.convert('RGBA').crop((0,0,CELL,CELL))
    actor_bbox = actor.getchannel('A').getbbox()
    offset = BASELINE-(actor_bbox[3]-1)
    assert 0 <= actor_bbox[1]+offset and actor_bbox[3]+offset <= CELL
    aligned = Image.new('RGBA',(CELL,CELL))
    aligned.alpha_composite(actor,(0,offset))
    assert aligned.getchannel('A').getbbox()[3]-1 == BASELINE
    board = Image.new('RGBA',(CELL*2,CELL),BG)
    board.alpha_composite(aligned,(0,0))
    board.alpha_composite(frames['idle_a'],(CELL,0))
    board = board.convert('RGB').resize((side*2,side),Image.Resampling.NEAREST)
    pen = ImageDraw.Draw(board)
    pen.line((side,0,side,side-1),fill='#505c78')
    pen.line((0,(BASELINE+1)*SCALE,side*2-1,(BASELINE+1)*SCALE),fill='#8fa28b')
    pen.text((12,12),'actor1-0 idle / 4x',fill='#c8d5e3')
    pen.text((side+12,12),'slime idle_a / 4x',fill='#c8d5e3')
    board.save(REVIEW/'scale.png')
    return {'actor_source': str(ACTOR.relative_to(ROOT)),
            'actor_idle_bbox': [actor_bbox[0],actor_bbox[1],actor_bbox[2]-1,actor_bbox[3]-1],
            'actor_y_translation': offset, 'both_scale': SCALE, 'aligned_last_opaque_row': BASELINE}


def main():
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    REVIEW.mkdir(parents=True,exist_ok=True)
    frames = {name:draw_pose(name) for name in NAMES}
    sheet = Image.new('RGBA',(CELL*3,CELL*3))
    for index,name in enumerate(NAMES):
        sheet.paste(frames[name],(index%3*CELL,index//3*CELL))
    report = validate(sheet,frames)
    sheet.save(OUTPUT)
    with Image.open(OUTPUT) as decoded:
        for index,name in enumerate(NAMES):
            x,y = index%3*CELL,index//3*CELL
            assert decoded.crop((x,y,x+CELL,y+CELL)).tobytes() == frames[name].tobytes()
        validate(decoded,frames)
    report['scale_comparison'] = make_previews(sheet,frames)
    (REVIEW/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':
    main()
