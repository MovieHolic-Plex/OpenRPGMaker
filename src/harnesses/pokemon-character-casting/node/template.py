"""Replay explicit row edits on pinned Emerald body/gait templates."""
from pathlib import Path
import hashlib,json
from PIL import Image
REFERENCES=Path(__file__).resolve().parent.parent/'references'
DIRECTIONS=['up','right','down','left'];POSES=['stepA','idle','stepB']
MAPPING=[([5,1,6],False),([7,2,8],True),([3,0,4],False),([7,2,8],False)]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def base(template_id):
 record=next(r for r in json.loads((REFERENCES/'sources.json').read_text())['sources'] if r['id']==template_id)
 p=REFERENCES/record['file'];assert sha(p)==record['sha256'],'Template source changed'
 s=Image.open(p);assert s.mode=='P' and s.size==(144,32)
 pal=s.getpalette();palette={hex(i)[2:].upper(): '#'+bytes(pal[3*i:3*i+3]).hex() for i in range(1,16)}
 frames={}
 for row,(indices,flip) in enumerate(MAPPING):
  for col,n in enumerate(indices):
   tile=s.crop((n*16,0,n*16+16,32))
   if flip:tile=tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
   frames[DIRECTIONS[row]+'_'+POSES[col]]=[''.join('.' if tile.getpixel((x,y))==0 else hex(tile.getpixel((x,y)))[2:].upper() for x in range(16)) for y in range(32)]
 return record,palette,frames

def atlas(palette,frames):
 colors={'.':(0,0,0,0),**{k:tuple(bytes.fromhex(v[1:]))+(255,) for k,v in palette.items()}}
 im=Image.new('RGBA',(48,128))
 for row,d in enumerate(DIRECTIONS):
  for col,p in enumerate(POSES):
   tile=Image.new('RGBA',(16,32));tile.putdata([colors[k] for line in frames[d+'_'+p] for k in line]);im.paste(tile,(col*16,row*32))
 return im

def replay(spec):
 record,palette,frames=base(spec['templateId']);assert spec['templateSourceSha256']==record['sha256']
 original={k:list(v) for k,v in frames.items()};source=atlas(palette,original)
 assert set(spec.get('paletteOverrides',{}))<=set(palette)
 palette.update(spec.get('paletteOverrides',{}));occupied=set()
 for edit in spec['patches']:
  name=edit['frame'];assert name in frames
  y=edit['y'];assert isinstance(y,int) and 0<=y and y+len(edit['rows'])<=28,'Feet/leg geometry locked'
  for offset,line in enumerate(edit['rows']):
   assert len(line)==16 and set(line)<=set(palette)|{'.'}
   assert (name,y+offset) not in occupied,'Overlapping edit rows';occupied.add((name,y+offset))
   frames[name][y+offset]=line
 metrics=[]
 for name,rows in frames.items():
  assert rows[28:]==original[name][28:],'Source leg/feet indices must remain unchanged'
  head=sum(a!=b for y in range(10,21) for a,b in zip(rows[y],original[name][y]))
  clothes=sum(a!=b for y in range(21,28) for a,b in zip(rows[y],original[name][y]))
  assert head>=4 and clothes>=2, name+': author head and clothing edits; a palette-only copy is not a new character'
  metrics.append({'frame':name,'headIndexEdits':head,'clothingIndexEdits':clothes,'lowerFourRowsUnchanged':True})
 image=atlas(palette,frames)
 assert len({p for p in image.get_flattened_data() if p[3]})<=15
 return source,image,{'source':record,'frames':metrics,'footGeometryPreserved':True,'originalPixelsRetained':sum(a==b and bool(a[3]) for a,b in zip(source.get_flattened_data(),image.get_flattened_data()))}

def verified_lineage(folder):
 """Return a pinned template SHA only after replaying declared derivation or original adoption."""
 folder=Path(folder);recipe=json.loads((folder/'recipe.json').read_text())
 image=Image.open(folder/'charset.png').convert('RGBA')
 if recipe.get('method')=='pinned-template-explicit-edits':
  _,expected,report=replay(recipe['templateSpec'])
  assert expected.tobytes()==image.tobytes(),'Template recipe does not reproduce submitted pixels'
  assert recipe['templateAudit']==report,'Template audit was modified'
  return report['source']['sha256']
 if recipe.get('method')=='lossless-distinct-original-npc-adoption':
  record,palette,frames=base(recipe['bodyBase'])
  assert recipe['sourceSha256']==record['sha256'] and atlas(palette,frames).tobytes()==image.tobytes()
  return record['sha256']
 return None
