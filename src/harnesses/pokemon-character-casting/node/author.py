"""Lossless candidates from six distinct original Emerald NPC walking bases.
No original-game art is claimed as independent hand drawing.
"""
from pathlib import Path
from PIL import Image
import argparse,json,hashlib,subprocess
ROOT=Path(__file__).resolve().parents[4]
REFERENCES=Path(__file__).resolve().parent.parent/'references'
MAPPING=[('up',[5,1,6],False),('right',[7,2,8],True),('down',[3,0,4],False),('left',[7,2,8],False)]

def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def main():
 p=argparse.ArgumentParser();p.add_argument('--seed',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();seed=json.loads(a.seed.read_text());a.out.mkdir(parents=True,exist_ok=True)
 if seed.get('version')!=2:raise ValueError('Legacy same-body producer is archived. Use a version2 distinct-body seed.')
 sources={s['id']:s for s in json.loads((REFERENCES/'sources.json').read_text())['sources']};background=ROOT/'verify-shots/pokemon-hero-reference-fidelity/runtime-walking.png';results=[]
 for item in seed['candidates']:
  source=sources[item['base']];source_file=REFERENCES/source['file'];assert digest(source_file)==source['sha256'];s=Image.open(source_file);assert s.mode=='P' and s.size==(144,32) and s.getpixel((0,0))==0
  s.info['transparency']=0;s=s.convert('RGBA');s.putdata([p if p[3] else (0,0,0,0) for p in s.get_flattened_data()]);assert not item.get('palette'),'Color-only variants are not current distinct-body candidates'
  folder=a.out/seed['collection']/item['role']/item['base'];folder.mkdir(parents=True,exist_ok=True);atlas=Image.new('RGBA',(48,128))
  for row,(direction,seq,flip) in enumerate(MAPPING):
   for col,index in enumerate(seq):
    frame=s.crop((index*16,0,(index+1)*16,32))
    if flip:frame=frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    atlas.paste(frame,(col*16,row*32))
  atlas.save(folder/'charset.png');colors=sorted({p[:3] for p in atlas.get_flattened_data() if p[3]});assert len(colors)<=15;lookup={c:i+1 for i,c in enumerate(colors)};pal=[0,0,0]+[v for c in colors for v in c];pal+=[0]*(768-len(pal));frames=[]
  for col in [0,1,2,1]:
   rgba=Image.new('RGBA',(68,32))
   for row in range(4):rgba.paste(atlas.crop((col*16,row*32,(col+1)*16,(row+1)*32)),(17*row,0))
   indexed=Image.new('P',rgba.size);indexed.putpalette(pal);indexed.putdata([lookup[p[:3]] if p[3] else 0 for p in rgba.get_flattened_data()]);frames.append(indexed)
  frames[0].save(folder/'walk.gif',save_all=True,append_images=frames[1:],loop=0,duration=130,transparency=0,disposal=2,optimize=False)
  context=Image.open(background).convert('RGBA').resize((480,360),Image.Resampling.NEAREST);new=atlas.crop((16,64,32,96)).resize((32,64),Image.Resampling.NEAREST);context.alpha_composite(new,(235,252));context.save(folder/'context.png')
  meta={k:item[k] for k in ['role','label','variant','description','identity']};meta.update(collection=seed['collection'],base=item['base'],sourceNote='에메랄드 실제 NPC 원본을 사용한 후보. 체형·얼굴·복장·걷기 원본이 각각 다릅니다. 신규 창작 원화 아님.')
  (folder/'candidate.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
  recipe={'method':'lossless-distinct-original-npc-adoption','source':source,'sourceSha256':source['sha256'],'sourceUrl':source['sourceUrl'],'originalArtwork':source['originalArtwork'],'independentlyAuthored':False,'bodyBase':item['base'],'frameMapping':MAPPING,'seed':item,'generatorSha256':digest(__file__),'resizingAuthoredPixels':False,'colorEdits':False,'scope':'Walking only; original-game art adoption. Context is a scale mockup, not runtime play.'}
  (folder/'recipe.json').write_text(json.dumps(recipe,ensure_ascii=False,indent=2)+'\n');(folder/'origin.txt').write_text(meta['sourceNote']+' Base='+item['base']+'; original artwork Nintendo/Game Freak/Creatures. Source hash/mapping in recipe.json. Native crops and original right-facing flip only. No independent-hand-art claim.\n');results.append(str(folder))
 bundles=a.out/'current-bundles.json';bundles.write_text(json.dumps(results,indent=2));r=subprocess.run(['python3',str(Path(__file__).with_name('diversity.py')),'--bundles',str(bundles),'--out',str(a.out/'diversity.json')],capture_output=True,text=True)
 if r.returncode:raise ValueError('Candidate wave repeats a body/silhouette: '+r.stdout+r.stderr)
 print(json.dumps(results))
if __name__=='__main__':main()
