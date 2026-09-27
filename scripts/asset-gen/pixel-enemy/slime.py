#!/usr/bin/env python3
"""Original hand-placed slime pixels. Python 3 + Pillow; no source art inputs.

Every silhouette is an explicit scanline (inclusive x endpoints), with authored
integer-coordinate color clusters and small character-grid facial features.
Only the review images are scaled, using nearest-neighbor sampling.
"""
from pathlib import Path
import json
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
OUTPUT = ROOT / 'public/assets/generated/pixel-enemies/slime.png'
REVIEW = ROOT / '.omo/pixel-enemy-slime'
COLORS = {
    'D': '#173451',  # deep blue outline / facial ink
    'S': '#2d719b',  # cool shadow / lit-side outline
    'B': '#299fb8',  # clear turquoise body
    'L': '#70d0d2',  # broad upper-left transmitted light
    'H': '#b5ece4',  # small internal bubbles
    'W': '#effff0',  # three-pixel specular reflection
}
RGBA = {key: tuple(bytes.fromhex(value[1:])) + (255,) for key, value in COLORS.items()}
BG = '#202840'
NAMES = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack', 'recover', 'hit', 'dead']
# Each pair draws one native-resolution row; none are scaled from another pose.
SHAPES = {
    'idle_a': (31, [
        (29,34),(27,36),(26,37),(25,38),(24,39),(23,40),(22,41),
        (21,42),(20,43),(19,44),(19,44),(18,45),(18,45),(17,46),
        (17,46),(16,47),(16,47),(16,47),(15,48),(15,48),(15,48),
        (15,48),(15,48),(15,48),(16,47),(17,46),(18,45),
        (20,43),(22,41),(24,39)]),
    'idle_b': (33, [
        (29,34),(27,36),(25,38),(23,40),(21,42),(20,43),(19,44),
        (18,45),(17,46),(17,46),(16,47),(16,47),(15,48),(15,48),
        (14,49),(14,49),(14,49),(14,49),(14,49),(14,49),(14,49),
        (14,49),(15,48),(16,47),(17,46),(19,44),(21,42),(23,40)]),
    'idle_c': (35, [
        (27,37),(24,40),(22,42),(20,44),(19,45),(18,46),(17,47),
        (16,47),(15,48),(15,48),(14,49),(14,49),(13,50),
        (13,50),(13,50),(13,50),(13,50),(13,50),(13,50),(13,50),
        (14,49),(15,48),(16,47),(18,45),(20,43),(22,41)]),
    'windup': (39, [
        (22,26),(20,29),(19,31),(17,33),(15,35),(14,37),(13,39),
        (12,41),(11,43),(10,45),(10,46),(10,47),(9,48),(9,48),
        (9,48),(9,48),(10,47),(11,46),(13,44),(15,42),(18,39),(21,36)]),
    'move': (22, [
        (43,47),(40,49),(37,51),(34,52),(31,53),(29,53),
        (27,53),(25,53),(24,53),(23,52),(22,52),(21,52),
        (20,51),(19,51),(18,50),(17,50),(16,49),(15,48),
        (15,47),(15,46),(14,44),(14,42),(15,40),(15,37),
        (16,34),(17,30),(18,27),(18,24),(19,22)]),
    'attack': (32, [
        (43,49),(40,53),(37,55),(35,56),(33,57),(31,57),
        (29,57),(27,57),(26,57),(25,57),(24,57),(23,57),
        (23,57),(23,57),(23,57),(23,57),(24,57),(24,57),
        (25,57),(26,57),(27,57),(29,56),(31,55),(33,54),
        (35,52),(37,50),(39,48),(39,47),(40,46)]),
    'recover': (37, [
        (26,36),(23,39),(21,41),(19,43),(18,44),(17,45),
        (16,46),(15,47),(14,48),(14,49),(13,50),(13,51),
        (12,52),(12,52),(12,52),(12,52),(12,52),(13,51),
        (14,50),(15,49),(17,47),(19,45),(21,43),(24,40)]),
    'hit': (33, [
        (19,25),(16,28),(14,31),(13,33),(12,35),(11,36),
        (11,37),(11,38),(12,39),(12,40),(13,41),(13,42),
        (14,43),(14,44),(15,45),(15,46),(16,47),(16,48),
        (16,49),(16,49),(16,50),(16,50),(17,49),(18,48),
        (19,47),(21,45),(23,43),(25,41)]),
    'dead': (53, [
        (24,38),(18,44),(14,48),(11,51),(10,53),(11,54),
        (13,52),(17,47)]),
}
# Integer polygon vertices describe asymmetric color clusters, not gradients.
PATCHES = {
    'idle_a': (
        [(38,36),(43,40),(46,46),(49,51),(48,56),(41,59),(23,59),(17,56),(29,56),(36,53),(39,47)],
        [(26,35),(31,34),(35,37),(35,41),(32,44),(28,46),(23,47),(20,45),(21,41),(23,38)]),
    'idle_b': (
        [(38,37),(43,41),(46,47),(49,52),(48,56),(41,59),(23,59),(17,56),(29,56),(36,54),(39,48)],
        [(26,37),(31,36),(35,39),(35,43),(32,46),(28,48),(23,49),(19,47),(20,43),(23,40)]),
    'idle_c': (
        [(38,38),(43,42),(46,48),(49,52),(48,56),(41,59),(23,59),(17,56),(29,56),(36,54),(39,49)],
        [(26,39),(31,38),(35,41),(35,45),(32,48),(28,50),(22,51),(18,49),(20,45),(23,41)]),
    'windup': (
        [(33,44),(42,48),(48,52),(47,55),(40,58),(20,59),(13,56),(26,56),(34,54)],
        [(19,43),(25,42),(31,44),(34,47),(30,50),(23,52),(14,52),(13,49),(15,46)]),
    'move': (
        [(50,26),(52,29),(51,38),(46,44),(33,49),(27,46),(34,43),(40,36),(43,28)],
        [(40,26),(45,25),(46,28),(40,33),(35,37),(30,39),(23,40),(23,36),(30,31)]),
    'attack': (
        [(52,35),(56,38),(56,52),(51,56),(45,59),(37,55),(43,52),(47,48)],
        [(43,35),(48,35),(48,39),(44,43),(39,46),(31,48),(26,46),(29,42),(36,38)]),
    'recover': (
        [(39,40),(46,45),(50,51),(50,56),(41,59),(23,59),(16,56),(29,56),(38,53)],
        [(26,40),(33,39),(38,42),(38,45),(33,49),(24,52),(18,51),(17,48),(21,43)]),
    'hit': (
        [(29,37),(34,41),(39,45),(48,51),(48,55),(41,59),(26,59),(21,55),(30,53),(30,46)],
        [(18,37),(24,36),(29,39),(30,42),(27,45),(23,47),(17,46),(14,41)]),
    'dead': (
        [(41,55),(48,56),(52,58),(46,59),(19,59),(14,58),(32,57)],
        [(23,54),(35,54),(42,55),(39,56),(27,56),(16,57),(17,56)]),
}
# Body reflection origins and two internal bubble origins, one smaller/darker.
DETAILS = {
    'idle_a': ((24,37),(23,50),(29,54)),
    'idle_b': ((24,39),(23,51),(29,55)),
    'idle_c': ((24,41),(23,53),(30,55)),
    'windup': ((19,44),(18,54),(26,54)),
    'move': ((38,28),(28,39),(34,42)),
    'attack': ((40,38),(32,47),(37,51)),
    'recover': ((24,42),(23,53),(31,55)),
    'hit': ((18,39),(23,49),(31,54)),
    'dead': ((22,55),None,None),
}


def stamp(image, origin, grid):
    """Literal character grid: dot = leave existing pixel unchanged."""
    ox, oy = origin
    for dy, row in enumerate(grid):
        for dx, char in enumerate(row):
            if char != '.':
                image.putpixel((ox + dx, oy + dy), RGBA[char])


def draw_pose(name):
    y0, spans = SHAPES[name]
    pixels = {(x,y0+dy) for dy,(left,right) in enumerate(spans) for x in range(left,right+1)}
    frame = Image.new('RGBA', (64,64))
    for xy in pixels:
        frame.putpixel(xy, RGBA['B'])
    patches = Image.new('RGBA', (64,64))
    pen = ImageDraw.Draw(patches)
    for key, vertices in zip(('S','L'), PATCHES[name]):
        pen.polygon(vertices, fill=RGBA[key])
    for x,y in pixels:
        if patches.getpixel((x,y))[3]:
            frame.putpixel((x,y), patches.getpixel((x,y)))
        if any((x+dx,y+dy) not in pixels for dx,dy in [(0,-1),(-1,0),(1,0),(0,1)]):
            frame.putpixel((x,y), RGBA['S' if x < 33 and y < 53 else 'D'])
    reflection, bubble, small_bubble = DETAILS[name]
    stamp(frame, (reflection[0]-1, reflection[1]-1), ['.HHH','HWWW','HH..'])
    # Keep the specular white cluster exactly three connected native pixels.
    if bubble:
        stamp(frame, bubble, ['HH.','HBL','.LL'])
        stamp(frame, small_bubble, ['LL','LB'])
    if name.startswith('idle') or name == 'recover':
        shift = {'idle_a':-1,'idle_b':0,'idle_c':2,'recover':2}[name]
        stamp(frame,(32,43+shift),['DD...','.DDD.','..DD.','..DD.','..DD.'])
        stamp(frame,(41,43+shift),['..DD','.DDD','.DD.','.DD.'])
        stamp(frame,(40,52+shift),['D..D','.DD.'])
    elif name == 'windup':
        stamp(frame,(29,49),['DDD..','.DDD.'])
        stamp(frame,(41,49),['..DD','DDD.'])
        stamp(frame,(36,55),['DDD'])
    elif name == 'move':
        stamp(frame,(39,29),['DD..','.DDD','..DD','..DD','..DD'])
        stamp(frame,(48,28),['..D','.DD','.DD','.DD'])
        stamp(frame,(43,37),['.DD.','DSSD','.DD.'])
        stamp(frame,(9,38),['.S..','SBL.','.BB.','..D.'])
        stamp(frame,(12,46),['SB','BD'])
    elif name == 'attack':
        stamp(frame,(44,39),['DD..','.DDD','..DD','..DD'])
        stamp(frame,(53,38),['.DD','DDD','.DD'])
        stamp(frame,(47,44),['.DDDD.','DDDDDD','DDDDDD','DDDDDD','DSSLLD','.DDDD.'])
        stamp(frame,(56,26),['.S.','SBL','.BD'])
        stamp(frame,(60,34),['SB','BD'])
        stamp(frame,(59,54),['.S.','SBL','.BD'])
    elif name == 'hit':
        stamp(frame,(27,43),['DD...','.DD..','..DD.','.DD..','DD...'])
        stamp(frame,(38,43),['...DD','..DD.','.DD..','..DD.','...DD'])
        stamp(frame,(33,51),['.DD.','DSSD','.DD.'])
    else:
        stamp(frame,(31,55),['D.D','.D.','D.D'])
        stamp(frame,(42,55),['D.D','.D.','D.D'])
    return frame


def components(frame):
    remaining = {(x,y) for y in range(64) for x in range(64) if frame.getpixel((x,y))[3]}
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
    assert sheet.mode == 'RGBA' and sheet.size == (192,192)
    assert set(sheet.getchannel('A').tobytes()) == {0,255}
    palette = {sheet.getpixel((x,y)) for y in range(192) for x in range(192) if sheet.getpixel((x,y))[3]}
    assert len(palette) <= 16
    report = {'size': list(sheet.size), 'mode': sheet.mode, 'alpha': [0,255],
              'opaque_palette_size': len(palette), 'bbox_convention': 'cell-local, inclusive', 'frames': {}}
    for name,frame in frames.items():
        left,top,right,bottom = frame.getbbox()
        width,height = right-left,bottom-top
        assert left >= 1 and top >= 1 and right <= 63 and bottom <= 63, name
        assert bottom-1 == (50 if name == 'move' else 60), (name,bottom)
        sizes = components(frame)
        assert min(sizes) > 1, (name,'isolated pixel',sizes)
        if name.startswith('idle'):
            assert 34 <= width <= 38 and 26 <= height <= 30, name
            assert (left+right)/2 == 32, name
        if name == 'dead':
            assert 6 <= height <= 8
        report['frames'][name] = {'bbox': [left,top,right-1,bottom-1], 'size': [width,height], 'components': sizes}
    assert [report['frames'][n]['size'] for n in NAMES[:3]] == [[34,30],[36,28],[38,26]]
    assert report['frames']['windup']['size'] == [40,22]  # idle_a +6 wide, -8 high
    return report


def make_previews(sheet, frames):
    preview = Image.new('RGBA',sheet.size,BG)
    preview.alpha_composite(sheet)
    preview = preview.convert('RGB').resize((768,768),Image.Resampling.NEAREST)
    pen = ImageDraw.Draw(preview)
    for line in (0,256,512,767):
        pen.line((line,0,line,767), fill='#505c78')
        pen.line((0,line,767,line), fill='#505c78')
    for index,name in enumerate(NAMES):
        x,y = index%3*256,index//3*256
        pen.text((x+12,y+12),name,fill='#c8d5e3')
        pen.line((x+4,y+244,x+251,y+244),fill='#39465e')
    preview.save(REVIEW/'preview.png')
    idle = ['idle_a','idle_b','idle_c','idle_b']
    sequence = idle*2 + ['windup','move','attack','recover','idle_a','hit','idle_a','dead']
    durations = [180]*8 + [260,140,180,200,400,300,400,1200]
    rendered = []
    # One fixed GIF palette keeps every pose's six source colors exact.
    gif_palette = Image.new('P',(1,1))
    values = [tuple(bytes.fromhex(BG[1:]))] + [rgba[:3] for rgba in RGBA.values()]
    flat = [channel for rgb in values for channel in rgb]
    gif_palette.putpalette(flat + [0]*(768-len(flat)))
    for name in sequence:
        shot = Image.new('RGBA',(64,64),BG)
        shot.alpha_composite(frames[name])
        shot = shot.convert('RGB').resize((256,256),Image.Resampling.NEAREST)
        rendered.append(shot.quantize(palette=gif_palette,dither=Image.Dither.NONE))
    rendered[0].save(REVIEW/'cycle.gif',save_all=True,append_images=rendered[1:],
                     duration=durations,loop=0,disposal=2,optimize=False)
    # Decode the actual GIF frames for visual inspection, not just PNG sources.
    with Image.open(REVIEW/'cycle.gif') as gif:
        assert gif.n_frames == len(sequence)
        for index, expected in enumerate(rendered):
            gif.seek(index)
            actual = gif.convert('RGB')
            assert actual.tobytes() == expected.convert('RGB').tobytes(), ('GIF colors',index)
            assert gif.info['duration'] == durations[index]
            if index in (0,8,9,10,13,15):
                actual.save(REVIEW/f'gif-{index:02d}-{sequence[index]}.png')


def main():
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    REVIEW.mkdir(parents=True,exist_ok=True)
    frames = {name:draw_pose(name) for name in NAMES}
    sheet = Image.new('RGBA',(192,192))
    for index,name in enumerate(NAMES):
        sheet.paste(frames[name],(index%3*64,index//3*64))
    report = validate(sheet,frames)
    sheet.save(OUTPUT)
    # Validate decoded deliverable as well, including exact packing/order.
    with Image.open(OUTPUT) as decoded:
        for index,name in enumerate(NAMES):
            x,y = index%3*64,index//3*64
            assert decoded.crop((x,y,x+64,y+64)).tobytes() == frames[name].tobytes()
        validate(decoded,frames)
    make_previews(sheet,frames)
    (REVIEW/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))


if __name__ == '__main__':
    main()
