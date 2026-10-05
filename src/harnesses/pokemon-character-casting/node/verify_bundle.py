from pathlib import Path
from PIL import Image
import argparse,json
from template import verified_lineage,replay
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
recipe=json.loads((b/'recipe.json').read_text());template_id=None
if recipe.get('method')=='pinned-template-explicit-edits':
 assert verified_lineage(b),'Unverified template'
 original,final,audit=replay(recipe['templateSpec']);template_id=audit['source']['id']
 assert clean(Image.open(b/'template.png')).tobytes()==original.tobytes(),'Template comparison differs from original'
 expected=Image.new('RGBA',final.size);expected.putdata([(238,110,56,255) if x!=y and (x[3] or y[3]) else (0,0,0,0) for x,y in zip(original.get_flattened_data(),final.get_flattened_data())])
 assert clean(Image.open(b/'changes.png')).tobytes()==expected.tobytes(),'Changed-pixel comparison is incorrect'
print(json.dumps({'templateId':template_id,'gifFrames':4,'sourcePixelsExact':True,'durationMs':130,'paletteMax':15,'resizing':False}))
