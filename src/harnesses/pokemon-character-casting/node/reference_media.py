from pathlib import Path
from PIL import Image
from importlib.util import spec_from_file_location,module_from_spec
import argparse
p=argparse.ArgumentParser();p.add_argument('--out',type=Path,required=True);a=p.parse_args();root=Path(__file__).resolve().parents[4]
spec=spec_from_file_location('f',root/'scripts/qa/runtime/pokemon-reference-fidelity.py');f=module_from_spec(spec);spec.loader.exec_module(f);sheet=f.reference();a.out.mkdir(parents=True,exist_ok=True);sheet.save(a.out/'charset.png')
colors=sorted({p[:3] for p in sheet.get_flattened_data() if p[3]});indices={c:i+1 for i,c in enumerate(colors)};pal=[0,0,0]+[v for c in colors for v in c];pal+=[0]*(768-len(pal));frames=[]
for col in [0,1,2,1]:
 im=Image.new('RGBA',(68,32))
 for row in range(4):im.paste(sheet.crop((col*16,row*32,(col+1)*16,(row+1)*32)),(17*row,0))
 g=Image.new('P',im.size);g.putpalette(pal);g.putdata([indices[p[:3]] if p[3] else 0 for p in im.get_flattened_data()]);frames.append(g)
frames[0].save(a.out/'walk.gif',save_all=True,append_images=frames[1:],duration=130,loop=0,transparency=0,disposal=2,optimize=False)
