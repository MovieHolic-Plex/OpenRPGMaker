from pathlib import Path
from PIL import Image
import argparse,json
p=argparse.ArgumentParser();p.add_argument('--bundle',type=Path,required=True);a=p.parse_args();b=a.bundle
assert Image.open(b/'context.png').size==(480,360),'Map context must declare480x360 display pixels'
s=Image.open(b/'charset.png').convert('RGBA');assert s.size==(48,128)
def clean(im):
 im=im.convert('RGBA');im.putdata([p if p[3] else (0,0,0,0) for p in im.get_flattened_data()]);return im
assert clean(s).tobytes()==clean(Image.open(b/'native/charset.png')).tobytes()
g=Image.open(b/'walk.gif');assert g.size==(68,32) and g.n_frames==4 and g.info.get('loop')==0
for n,col in enumerate([0,1,2,1]):
 g.seek(n);expected=Image.new('RGBA',(68,32))
 for row in range(4):expected.paste(s.crop((col*16,row*32,(col+1)*16,(row+1)*32)),(row*17,0))
 assert clean(g).tobytes()==clean(expected).tobytes(),f'GIF source pixels/frame order mismatch {n}'
 assert g.info['duration']==130
print(json.dumps({'gifFrames':4,'sourcePixelsExact':True,'durationMs':130,'paletteMax':15,'resizing':False}))
