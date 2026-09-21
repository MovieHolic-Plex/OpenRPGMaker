import json,pathlib,copy,hashlib
from PIL import Image
root=pathlib.Path.cwd();out=root/'output/evidence/shared-village-curation'
p=json.load(open(out/'local-before.json'));r=json.load(open(out/'remote-before.json'));t=p['tilesets']['forest_high_cliff_river']
assert all(p['maps'][k]==r['maps'][k] for k in p['maps'] if k.startswith('map_village_ten_'))
manifest=json.load(open('tiledata/forest-villages/villages-organic/manifest.json'))
selected={'crescent-lake','fork-stream','terrace-gardens','woodland-lane','orchard-court','fishing-cove','five-groves'}
entries=[]
for e in manifest['entries']:
 slug=e['map'][:-5]
 if slug not in selected:continue
 assert json.load(open('tiledata/forest-villages/villages-organic/'+e['map']))==p['maps'][e['mapId']]
 entries.append(dict(id='organic-'+slug+'-80x72',slug='organic-'+slug,mapId=e['mapId'],name=e['name'].split(' · ',1)[-1],kind='settlement',note=e['theme']))
(out/'selection.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2))
asset=p['assets']['uploaded'][t['image']['id']]['ref'];src=Image.open(root/'.oprn-projects/oprn-hill-forest-harmony-20260918-a4e1/assets'/f"{asset['sha256']}.{asset['extension']}").convert('RGBA')
groups=[g for g in t['tileGroups'] if any(x in g['id'] for x in ['village-prop-extension:','village-life-new:','tibo-unfake:'])]
assert len(groups)==19
# Each complete object gets two rows in a compact 6-column sheet. No scaling or new art.
atlas=Image.new('RGBA',(96,16*14));kits=[];mapping={};used=0
for n,g in enumerate(groups):
 v=g['previewMap'];x=(n%3)*2;y=(n//3)*2;rows=[]
 for dy in range(v['height']):
  row={'tiles':[],'upperTiles':[]}
  for dx in range(v['width']):
   i=dy*v['width']+dx;lo=v.get('lowerTiles',[-1]*(v['width']*v['height']))[i];up=v['upperTiles'][i];assert lo in (-1,240),(g['name'],lo)
   nt=(y+dy)*6+x+dx;row['tiles'].append(-1);row['upperTiles'].append(nt if up>=0 else -1)
   if up>=0:
    atlas.paste(src.crop((up%30*16,up//30*16,up%30*16+16,up//30*16+16)),((x+dx)*16,(y+dy)*16));mapping[nt]=up
  rows.append(row)
 kits.append(dict(id='shared-village:'+g['id'],kind='section',name=g['name'].replace(' v2',''),width=v['width'],height=v['height'],rows=rows,learnedFrom='db-authored',createdAt='2026-09-21T00:00:00.000Z'))
s=copy.deepcopy(t);s.update(id='shared_forest_village_objects',name='숲마을 · 선별 소품 19종',image={'type':'bundled','id':'tex_shared_forest_village_objects'},tilesPerRow=6,count=84,structureKits=kits,tileGroups=[],autotileGroups=[])
for key in ['tileGrafts','autotileBlocks','layout','source','semantics']:s.pop(key,None)
for key,default in [('passability',{'up':True,'down':True,'left':True,'right':True}),('priority','lower'),('terrain',0),('tileMeta',{})]:
 s[key]=[copy.deepcopy(t[key][mapping[i]]) if i in mapping else copy.deepcopy(default) for i in range(84)]
pathlib.Path('public/assets/shared-village').mkdir(parents=True,exist_ok=True);atlas.save('public/assets/shared-village/objects.png');pathlib.Path('src/assets/sharedVillageObjects.json').write_text(json.dumps(s,ensure_ascii=False)+'\n')
(out/'objects.json').write_text(json.dumps([{'id':k['id'],'name':k['name'],'width':k['width'],'height':k['height']} for k in kits],ensure_ascii=False,indent=2))
print('Selected',len(entries),'places;',len(kits),'objects; pixel-exact repack',len(mapping),'chips')
