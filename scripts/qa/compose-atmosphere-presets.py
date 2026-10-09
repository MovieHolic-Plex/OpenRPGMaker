"""Six labeled GIF contact sheets from 30 actual player captures, plus each full-size GIF."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, subprocess, time, html
root = Path('.omo/evidence/atmosphere-30')
catalog = json.loads((root/'catalog.json').read_text())
font = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 17)
small = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareR.ttf', 14)
title = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumSquareB.ttf', 27)
genres = [('마법','magic'),('악마','demonic'),('무협','wuxia'),('현대','modern'),('근대','industrial'),('자연·수중','nature-water')]
sounds = {'none':'무음','breeze':'바람','rustle':'잎사귀','insects':'풀벌레','chimes':'마력 종소리','whisper':'공명','rumble':'저음','fire':'불꽃','steam':'증기','drips':'물방울','electric':'전기음','bubbles':'기포'}
def encode(pattern, target):
    subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','125/12','-i',str(pattern),'-filter_complex','[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse=dither=sierra2_4a','-loop','0',str(target)],check=True)
for genre,slug in genres:
    presets=[p for p in catalog if p['genre']==genre]
    for p in presets:
        deadline=time.monotonic()+1800
        while not (root/p['id']/'receipt.json').exists():
            if time.monotonic()>deadline: raise RuntimeError('Missing capture: '+p['id'])
            time.sleep(1)
    frames=root/('gallery-'+slug);frames.mkdir(exist_ok=True)
    for index in range(60):
        canvas=Image.new('RGB',(960,600),'#111827');draw=ImageDraw.Draw(canvas)
        for n,p in enumerate(presets):
            x,y=(n%3)*320,(n//3)*300
            draw.text((x+9,y+6),f"{catalog.index(p)+1:02d}  {p['label']}",font=font,fill='#f1f5f9')
            shot=Image.open(root/p['id']/f'{index:03d}.png').convert('RGB').resize((320,240),Image.Resampling.LANCZOS)
            canvas.paste(shot,(x,y+30))
            sound=' · '.join(dict.fromkeys(sounds[e['sound']] for e in p['effects'] if e['sound']!='none' and e['volume']>0))
            draw.text((x+9,y+277),sound,font=small,fill='#a9d8d2')
        draw.text((655,328),genre,font=title,fill='#f1f5f9')
        for n,text in enumerate(['시각 효과 + 환경음 프리셋','실제 플레이어 · 같은 맵 비교','각 설정의 기본값 그대로 촬영','GIF는 무음입니다.','갤러리에서 개별 소리 재생 가능']):
            draw.text((655,383+n*30),text,font=small,fill='#cbd5e1')
        canvas.save(frames/f'{index:03d}.png')
    encode(frames/'%03d.png',root/f'{slug}.gif')
    print(root/f'{slug}.gif',flush=True)
    for p in presets: encode(root/p['id']/'%03d.png',root/f"{p['id']}.gif")
# Portable gallery: each card pairs its real GIF with a separately captured ambience recording.
parts=['<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>환경 효과·환경음 30종</title><style>body{background:#101827;color:#e2e8f0;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}article{background:#1e293b;border-radius:12px;padding:16px}img,audio{width:100%}p{color:#b7c4d7;font-size:14px}h2{font-size:19px}h1{font-size:26px}</style><h1>환경 효과 + 환경음 30종</h1><p>같은 게임 맵에서 프리셋 기본값으로 촬영했습니다. GIF는 실제 프레임이며, 환경음 녹음은 별도로 재생합니다.</p><main>']
for p in catalog:
    name=html.escape(p['label']);pid=p['id']
    parts.append(f'<article><h2>{catalog.index(p)+1:02d}. {name}</h2><p>{html.escape(p["genre"])} · {html.escape(p["description"])}</p><img loading="lazy" src="{pid}.gif" alt="{name}"><audio controls preload="none" src="{pid}.mp3"></audio></article>')
parts.append('</main></html>')
(root/'gallery.html').write_text(''.join(parts))
print(root/'gallery.html',flush=True)
