"""Read the actual rendered GIFs; make nearest diagnostic strips of their cels."""
from pathlib import Path
from PIL import Image, ImageSequence, ImageDraw
import json
root=Path(__file__).resolve().parent/'progress'
report=[]
for name in ['idle','attack','hit','dead','skill','poison','stun','sleep']:
 with Image.open(root/f'{name}-1x.gif') as gif:
  frames=[];holds=[]
  for frame in ImageSequence.Iterator(gif):
   frames.append(frame.convert('RGB').copy());holds.append(frame.info.get('duration',0))
  sheet=Image.new('RGB',(288,116*((len(frames)+2)//3)),(36,37,48));draw=ImageDraw.Draw(sheet)
  for i,frame in enumerate(frames):
   x=i%3*96;y=i//3*116
   sheet.paste(frame,(x,y+16));draw.text((x+3,y+2),f'{i+1}: {holds[i]}ms',fill=(225,218,203))
  sheet.resize((sheet.width*3,sheet.height*3),Image.Resampling.NEAREST).save(root/f'gif-strip-{name}-3x.png')
  report.append({'group':name,'nativeSize':[96,96],'actualGifFrames':len(frames),'actualGifHoldsMs':holds,'loop':gif.info.get('loop')})
(root/'gif-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
