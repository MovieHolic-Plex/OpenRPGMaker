"""Render template + authored row edits, package its reproducible provenance and comparison."""
import argparse,json,hashlib
from pathlib import Path
from PIL import Image
from template import replay,sha
import importlib.util
module=importlib.util.spec_from_file_location('authored',Path(__file__).with_name('render-authored.py'));authored=importlib.util.module_from_spec(module);module.loader.exec_module(authored)

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--spec',type=Path,required=True);parser.add_argument('--candidate',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);a=parser.parse_args()
 spec=json.loads(a.spec.read_text());meta=json.loads(a.candidate.read_text());author=meta.get('author','Unspecified template editor');original,image,audit=replay(spec);a.out.mkdir(parents=True,exist_ok=True)
 # The reusable encoder receives explicit replayed rows. Replace its independent-art provenance below.
 colors=sorted({p[:3] for p in image.get_flattened_data() if p[3]});keys='123456789ABCDEF';lookup={c:keys[i] for i,c in enumerate(colors)}
 frames=[]
 for row,d in enumerate(authored.DIRECTIONS):
  for col,p in enumerate(authored.POSES):
   tile=image.crop((col*16,row*32,col*16+16,row*32+32))
   frames.append({'id':d+'_'+p,'durationMs':130,'rows':[''.join(lookup[tile.getpixel((x,y))[:3]] if tile.getpixel((x,y))[3] else '.' for x in range(16)) for y in range(32)]})
 grid={'version':1,'width':16,'height':32,'maxColors':15,'palette':{lookup[c]:'#'+bytes(c).hex() for c in colors},'frames':frames}
 gridpath=a.out/'replayed.px.json';gridpath.write_text(json.dumps(grid,indent=2)+'\n')
 import sys
 sys.argv=[sys.argv[0],'--source',str(gridpath),'--candidate',str(a.candidate),'--out',str(a.out)];authored.main()
 original.save(a.out/'template.png')
 changed=Image.new('RGBA',image.size)
 changed.putdata([(238,110,56,255) if x!=y and (x[3] or y[3]) else (0,0,0,0) for x,y in zip(original.get_flattened_data(),image.get_flattened_data())]);changed.save(a.out/'changes.png')
 recipe={'method':'pinned-template-explicit-edits','author':author+' edits on original Emerald '+spec['templateId']+' artwork','independentlyAuthored':False,'copiedOriginalPixels':True,'templateSpec':spec,'templateAudit':audit,'templateSpecSha256':sha(a.spec),'rendererSha256':sha(__file__),'templateImplementationSha256':sha(Path(__file__).with_name('template.py')),'encoderSha256':sha(Path(__file__).with_name('render-authored.py')),'scope':'Original-game derivative. Body/gait template retained; new head/clothes row patches. Human Allow required.'}
 (a.out/'recipe.json').write_text(json.dumps(recipe,indent=2)+'\n')
 (a.out/'origin.txt').write_text('Emerald '+spec['templateId']+' template derivative. Original artwork Nintendo / Game Freak / Creatures. '+author+' authored explicit row patches and selected palette edits. Original body/gait/face retained. Exact template source and replayable edits in recipe.json. Not independently drawn from scratch.\n')
 print(json.dumps({'template':spec['templateId'],'audit':audit}))
if __name__=='__main__':main()
