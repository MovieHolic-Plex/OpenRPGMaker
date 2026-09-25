"""Compact actual-object dictionary; no authored scene arrays or pixels in Git."""
import sys,json,base64,io,hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
source,out=map(Path,sys.argv[1:3]);out.mkdir(parents=True,exist_ok=True)
s=json.loads(source.read_text());tile=s['tile'];c=json.loads(Path('tiledata/pixel-art-world/modern-interiors-compiled.json').read_text())
recipes=[];pictures=[]
for r in c['recipes']:
 kit=next(k for k in tile['structureKits'] if k['id']==r['id'])
 assert [row['upperTiles'] for row in kit['rows']]==r['tiles'],r['id']
 recipes.append({k:r[k] for k in ['id','name','sourceId','filename','sha256','originalTiles','tiles','placementKind','facing','supportCells']})
 pictures.append((r['id'],Image.open(io.BytesIO(base64.b64decode(kit['referenceDocuments'][0]['images'][0]['dataUrl'].split(',')[1]))).convert('RGBA')))
group=next(g for g in tile['autotileGroups'] if g['id']=='paw-wall-a01')
dictionary={'tilesetId':tile['id'],'tileSize':tile['tileSize'],'columns':tile['tilesPerRow'],'sources':c['sources'],'materials':c['materials'],'ceiling':{'paintTile':group['memberTileIds'][0],'variantMap':group['variantMap']},'objects':recipes}
md='# 직접 배치 재료·가구 사전\n\n완성 맵 좌표나 배열은 없다. 객체 tiles는 현재 번호, originalTiles는 원본 번호.\n\n```json\n'+json.dumps(dictionary,ensure_ascii=False,separators=(',',':'))+'\n```\n'
images=[];font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',14)
for start in range(0,len(pictures),12):
 sheet=Image.new('RGB',(1200,1100),'#ddd');draw=ImageDraw.Draw(sheet)
 for j,(id,pic) in enumerate(pictures[start:start+12]):
  x=j%3*400;y=j//3*275;draw.text((x+5,y+4),id,font=font,fill='black');pic.thumbnail((390,238),Image.Resampling.NEAREST);sheet.paste(pic,(x+5,y+30),pic)
 name=f'objects-{start//12+1}';buf=io.BytesIO();sheet.save(buf,format='WEBP',lossless=True);(out/(name+'.webp')).write_bytes(buf.getvalue())
 images.append({'id':name,'name':name+'.webp','caption':'각 객체 왼쪽 정상 / 오른쪽 하단 한 칸 누락. '+', '.join(id for id,_ in pictures[start:start+12]),'dataUrl':'data:image/webp;base64,'+base64.b64encode(buf.getvalue()).decode()})
category={'id':'direct-authoring','name':'직접 배치 · 재료와 가구 사전','description':'완성 맵 없이 새 평면 설계. 재료/가구 전체 배열/지지/방향/정상·오류.','documents':[{'id':'method','name':'직접 배치 지침.md','markdown':Path('tiledata/pixel-art-world/DIRECT-AUTHORING.md').read_text()},{'id':'dictionary','name':'직접 배치 사전.md','markdown':md}],'images':images}
(out/'category.json').write_text(json.dumps(category,ensure_ascii=False));(out/'dictionary.md').write_text(md)
print({'objects':len(recipes),'characters':len(md),'images':len(images)})
