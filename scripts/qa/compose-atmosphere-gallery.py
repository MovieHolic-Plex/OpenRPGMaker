"""Compose captured player frames without generating or interpolating game visuals."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import subprocess
root = Path('.omo/evidence/atmosphere')
font = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 20)
groups = [
 ('nature', [('leaves','낙엽'), ('petals','꽃잎'), ('dust','먼지'), ('sand','모래바람')]),
 ('fantasy', [('fireflies','반딧불'), ('magic','마력 입자'), ('spirits','정령빛'), ('poison','독안개')]),
 ('air', [('ash','재'), ('embers','불씨'), ('smog','스모그'), ('steam','증기')]),
 ('space', [('leaks','떨어지는 물방울'), ('sparks','전기 스파크'), ('sunrays','빛줄기'), ('underwater','물속 · 기포와 물빛')]),
]
for group, cells in groups:
    frames = root / ('gallery-' + group)
    frames.mkdir(exist_ok=True)
    for index in range(60):
        canvas = Image.new('RGB', (840, 694), '#111827')
        draw = ImageDraw.Draw(canvas)
        for cell, (kind, label) in enumerate(cells):
            x, y = (cell % 2) * 420, (cell // 2) * 347
            draw.text((x + 12, y + 5), label, font=font, fill='#eff6ff')
            shot = Image.open(root / kind / f'{index:03d}.png').convert('RGB').resize((420,315), Image.Resampling.LANCZOS)
            canvas.paste(shot, (x,y+32))
        canvas.save(frames / f'{index:03d}.png')
    subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','125/12','-i',str(frames/'%03d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',str(root/f'{group}.gif')], check=True)
    print(root/f'{group}.gif', flush=True)
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','125/12','-i',str(root/'underwater/%03d.png'),'-filter_complex','[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',str(root/'underwater.gif')],check=True)
