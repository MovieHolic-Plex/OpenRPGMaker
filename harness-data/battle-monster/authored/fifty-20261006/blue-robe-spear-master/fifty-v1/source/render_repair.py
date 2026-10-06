"""Read native candidate PNGs and GIFs; arrange 1x/3x visual diagnostics only.
No art creation, silhouette operations, frame transforms or source changes.
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent
NAMES = ['move', 'attack', 'skill_a', 'skill_b', 'recover', 'skill_c', 'sleep_a', 'sleep_b']

for theme, color in [('light', (242,232,211)), ('dark', (28,34,44)), ('checker', None)]:
    out = Image.new('RGB', (len(NAMES)*208, 302), (104,106,112))
    draw = ImageDraw.Draw(out)
    for i, name in enumerate(NAMES):
        tile = Image.new('RGB', (64,64), color or (158,162,166))
        if color is None:
            tile.putdata([(158,162,166) if (x//8+y//8)%2==0 else (205,207,198)
                          for y in range(64) for x in range(64)])
        with Image.open(ROOT/'rendered'/f'{name}.png') as im:
            tile.paste(im, (0,0), im)
        x = i*208+8
        draw.text((x,6),name+' 1x / 3x',fill=(255,255,255))
        out.paste(tile,(x,24))
        out.paste(tile.resize((192,192),Image.Resampling.NEAREST),(x,100))
    out.save(ROOT/'rendered'/f'repair-{theme}.png')

# Actual GIF decode: attack, skill and sleep, with encoded hold labels.
out = Image.new('RGB',(6*208,3*302),(31,37,47));draw=ImageDraw.Draw(out)
for row, motion in enumerate(['attack','skill','sleep']):
    with Image.open(ROOT/'motions'/f'{motion}.gif') as gif:
        for i in range(gif.n_frames):
            gif.seek(i)
            im=gif.convert('RGBA')
            tile=Image.new('RGB',(64,64),(31,37,47));tile.paste(im,(0,0),im)
            x=i*208+8;y=row*302
            draw.text((x,y+6),f'{motion} {i}: {gif.info["duration"]}ms',fill=(240,240,230))
            out.paste(tile,(x,y+24))
            out.paste(tile.resize((192,192),Image.Resampling.NEAREST),(x,y+100))
out.save(ROOT/'rendered'/'repair-gif-frames.png')
