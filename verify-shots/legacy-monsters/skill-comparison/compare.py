"""Compare the actual bundled impact layer and the unregistered FX study at native 2x."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, hashlib

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parents[2]
PROTOTYPE = ROOT / 'study/sheets'
FONT = '/usr/share/fonts/truetype/nanum/NanumGothic.ttf'
font = lambda n: ImageFont.truetype(FONT, n)
cases = [('fire','파이어볼','mage_fire_burst',10), ('ice','블리자드','mage_blizzard',10),
         ('thunder','연쇄 번개','mage_chain_bolt',8), ('heal','치유의 빛','cleric_heal',10)]
target = Image.open(REPO/'public/assets/generated/pixel-enemies/golem.png').convert('RGBA')
rows = []
for slug,name,key,count in cases:
    path = REPO/f'public/assets/generated/pixel-fx/{key}.png'
    old = Image.open(path).convert('RGBA')
    new = Image.open(PROTOTYPE/f'{slug}.png').convert('RGBA')
    assert old.size == (64*count,64) and new.size == (96*32,96)
    frames = []
    for t in range(0,2200,20):
        canvas = Image.new('RGBA',(712,320),(20,29,39,255))
        d = ImageDraw.Draw(canvas)
        d.text((20,14),f'{name} · 같은 도트 표적 / 원본 2배',font=font(19),fill=(235,243,247))
        d.text((32,49),'기존 RM2003 착탄 층',font=font(17),fill=(235,243,247))
        d.text((390,49),'새 시안',font=font(17),fill=(235,243,247))
        d.text((32,77),f'64px · {count}칸 · 60ms/칸',font=font(13),fill=(176,193,206))
        d.text((390,77),'96px · 32칸 · 50ms/칸',font=font(13),fill=(176,193,206))
        for side,cx in enumerate([176,534]):
            d.line((cx-146,273,cx+146,273),fill=(64,88,91))
            hit = t >= 300 and t < (count*60 if side==0 else 1600)
            col,row = (1,2) if hit else ([0,1,2,1][(t//300)%4],0)
            p = target.crop((col*64,row*64,(col+1)*64,(row+1)*64)).resize((128,128),Image.Resampling.NEAREST)
            canvas.alpha_composite(p,(cx-64,151))
            size,step,sheet,total = (64,t//60,old,count) if side==0 else (96,t//50,new,32)
            if step < total:
                fx = sheet.crop((step*size,0,(step+1)*size,size)).resize((size*2,size*2),Image.Resampling.NEAREST)
                canvas.alpha_composite(fx,(cx-size,215-size))
        d.text((20,294),'착탄 그림만 비교 · 기존의 시전자 동작 / 투사체 / 소리는 실제 전투 GIF에서 확인',font=font(12),fill=(176,193,206))
        frames.append(canvas.convert('RGB'))
    palette_source = Image.new('RGB',(712,320*len(frames)))
    for i,f in enumerate(frames): palette_source.paste(f,(0,i*320))
    palette = palette_source.quantize(colors=240,method=Image.Quantize.MEDIANCUT)
    encoded = [f.quantize(palette=palette,dither=Image.Dither.NONE) for f in frames]
    gif = ROOT/f'{slug}-comparison.gif'
    encoded[0].save(gif,save_all=True,append_images=encoded[1:],duration=20,loop=0,disposal=2,optimize=False)
    frames[12].save(ROOT/f'{slug}-comparison.png')
    def stats(im):
        pixels = list(im.getdata())
        return {'size':list(im.size),'visibleRgbColors':len(set(p[:3] for p in pixels if p[3])), 'alphaLevels':sorted(set(p[3] for p in pixels))}
    rows.append({'name':name, 'current':{'path':str(path.relative_to(REPO)),**stats(old)},
                 'study':{'path':str((PROTOTYPE/f'{slug}.png').relative_to(REPO)),**stats(new)},
                 'gif':gif.name, 'sha256':hashlib.sha256(gif.read_bytes()).hexdigest()})
(ROOT/'comparison-report.json').write_text(json.dumps({'scope':'impact layer only, actual integer 2x, no audio', 'productionApplied':False,'rows':rows},ensure_ascii=False,indent=2)+'\n')
print('Comparison GIFs:', ', '.join(r['gif'] for r in rows))
