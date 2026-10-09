#!/usr/bin/env python3
"""Integer display enlargement of reviewed native GIF pixels; never redraw or quantize."""
import argparse,hashlib,json
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('source',type=Path);p.add_argument('output',type=Path);p.add_argument('--scale',type=int,default=4);a=p.parse_args()
assert 1<=a.scale<=8
native=Image.open(a.source);assert native.size==(68,32) and native.n_frames==4 and native.info.get('loop')==0
frames=[];durations=[]
for i in range(native.n_frames):
 native.seek(i);im=native.convert('RGBA');assert all(v[3] in [0,255] for v in im.get_flattened_data());durations.append(native.info['duration']);frames.append(im.resize((68*a.scale,32*a.scale),Image.Resampling.NEAREST))
colors=sorted({v[:3] for f in frames for v in f.get_flattened_data() if v[3]});assert len(colors)<=15
indexes={c:i+1 for i,c in enumerate(colors)};palette=[0,0,0]+[v for c in colors for v in c];palette += [0]*(768-len(palette));encoded=[]
for frame in frames:
 im=Image.new('P',frame.size);im.putpalette(palette);im.putdata([indexes[v[:3]] if v[3] else 0 for v in frame.get_flattened_data()]);encoded.append(im)
a.output.parent.mkdir(parents=True,exist_ok=True)
encoded[0].save(a.output,save_all=True,append_images=encoded[1:],loop=0,duration=durations,transparency=0,background=0,disposal=2,optimize=False)
# PIL's default RGBA->GIF adaptive palette changed source RGB during QA. Decode every output frame to guard that concrete regression.
result=Image.open(a.output);assert result.n_frames==4 and result.info['loop']==0
visible=lambda im:[v if v[3] else (0,0,0,0) for v in im.get_flattened_data()]
for i,expected in enumerate(frames):
 result.seek(i);assert visible(expected)==visible(result.convert('RGBA')) and result.info['duration']==durations[i]
record={'pass':True,'decodedFrames':4,'displayScale':a.scale,'nearestNativePixelsExact':True,'opaqueColors':len(colors),'durationsMs':durations,'sourceSha256':hashlib.sha256(a.source.read_bytes()).hexdigest(),'outputSha256':hashlib.sha256(a.output.read_bytes()).hexdigest(),'note':'Explicit indexed palette preserves native RGB; display enlargement is not an authored game sprite.'}
a.output.with_suffix('.check.json').write_text(json.dumps(record,indent=2)+'\n');print(json.dumps(record))
