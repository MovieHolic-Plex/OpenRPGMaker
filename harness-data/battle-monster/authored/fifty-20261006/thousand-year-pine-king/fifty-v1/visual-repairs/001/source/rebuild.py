"""Rebuild this source-only candidate from authored literal clusters and corrections."""
import author_motion, author_rest, author_actions, repair_pixels, finish_pixels, render_pixels
from PIL import Image,ImageDraw
from pathlib import Path
ROOT=Path(__file__).resolve().parent
for module in [author_motion,author_rest,author_actions,repair_pixels,finish_pixels]:module.main()
render_pixels.render()
# Diagnostic contact sheet is decoded from actual GIF files, not composed source poses.
strip=Image.new('RGB',(768,1216),(36,42,49));labels=ImageDraw.Draw(strip)
for row,motion in enumerate(render_pixels.MOTIONS):
    gif=Image.open(ROOT/'gif'/(motion+'.gif'))
    for i in range(gif.n_frames):
        gif.seek(i);frame=gif.convert('RGBA');x=i*128;y=row*152
        strip.paste(frame,(x,y+22),frame)
        labels.text((x+3,y+3),f'{motion} {i+1}: {gif.info.get("duration")}ms',fill=(232,223,191))
strip.save(ROOT/'png'/'gif-readback-1x.png')
strip.resize((1536,2432),Image.Resampling.NEAREST).save(ROOT/'png'/'gif-readback-2x.png')
