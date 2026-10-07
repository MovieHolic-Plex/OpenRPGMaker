"""25 chosen JRPG house assemblies, exact native pixels and authored detail grids.
The game research images are observations, never texture inputs.
"""
from pathlib import Path
import json,hashlib,sys
from PIL import Image,ImageDraw,ImageFont
import author_round6 as old
from round7_curved import repair as repair_curve
from native_author import ROOT,native
SOURCE=ROOT/'harness-data/beodeul-building-review'
records=[];rec=None
HIP={
 80:[('bd-house-h103_2',[0,0,80,64],[0,0])],
 96:[('bd-house-h101_1',[0,0,96,64],[0,0])],
 112:[('arch:cream',[0,0,112,64],[0,0])],
 128:[('bd-house-h104_1',[0,0,128,64],[0,0])],
 160:[('bd-house-h104_1',[0,0,64,64],[0,0]),('bd-house-h104_1',[48,0,80,64],[64,0]),('bd-house-h104_1',[64,0,128,64],[96,0])],
 176:[('bd-house-h104_1',[0,0,64,64],[0,0]),('bd-house-h104_1',[48,0,80,64],[64,0]),('bd-house-h104_1',[64,0,80,64],[96,0]),('bd-house-h104_1',[64,0,128,64],[112,0])],
 192:[('bd-house-h104_1',[0,0,64,64],[0,0]),('bd-house-h104_1',[48,0,80,64],[64,0]),('bd-house-h104_1',[48,0,80,64],[96,0]),('bd-house-h104_1',[64,0,128,64],[128,0])],
}
MANSARD={128:[([0,0,128,96],[0,0])],176:[([0,0,64,96],[0,0]),([48,0,80,96],[64,0]),([64,0,80,96],[96,0]),([64,0,128,96],[112,0])]}
LANCET=['.....HH.....','...HHhhHH...','..HhhmmhhH..','.HhmtttmhhH.','.HhmtttmhhH.','HhmttDttmhhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhDDDDDDDDhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhDDDDDDDDhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhmtlDtlmhhH','HhhhhhhhhhhH','HHhhhhhhhhHH','..HHHHHHHH..']
SHUTTER=['HHhhhhhhhhhhhhHH','HhmmmHttttHmmmhH','HhmnmHtlltHmnmhH','HhnmmHttttHmmnhH','HhmmmHtlltHmmmhH','HhmnmHttttHmnmhH','HhDDDHDDDDHDDDhH','HhmmmHtlltHmmmhH','HhmnmHttttHmnmhH','HhnmmHtlltHmmnhH','HhmmmHttttHmmmhH','HhmnmHtlltHmnmhH','HhmmmmmmmmmmmmhH','HHhhhhhhhhhhhhHH','DDDDDDDDDDDDDDDD','................']
DETAIL_PAL={**old.PAL,'H':(198,163,104,255),'h':(140,87,45,255),'m':(84,49,31,255),'n':(105,67,38,255),'D':(36,36,33,255),'t':(40,70,90,255),'l':(66,105,119,255)}
def part(im,key,rect,at,replace=False):old.current=rec;old.transfer(im,key,rect,tuple(at),replace)
def grid(im,rows,pal,at,label):
 assert len({len(r) for r in rows})==1
 for y,row in enumerate(rows):
  for x,c in enumerate(row):
   if pal[c][3]:im.putpixel((at[0]+x,at[1]+y),pal[c])
 rec.setdefault('grids',[]).append({'label':label,'at':at,'rows':rows,'palette':{k:bytes(v).hex() for k,v in pal.items()}})
def wall(im,at,rows,kind='plaster'):
 # Every facade row and opening is explicitly chosen in the house brief.
 assert len({len(r) for r in rows})==1
 for j,row in enumerate(rows):
  for k,c in enumerate(row):
   x=at[0]+k*16;y=at[1]+j*32
   if kind=='stone':part(im,'arch:stone',[48,64,64,96],[x,y],True)
   else:part(im,'arch:cream',[48 if c=='b' else 64,64,64 if c=='b' else 80,96],[x,y],True)
   if c=='D':
    part(im,'arch:stone' if kind=='stone' else 'arch:cream',[32,64,48,96],[x,y],True)
    rec.setdefault('doors',[]).append({'x':x,'y':y,'w':16,'h':32})
   elif c=='s':part(im,'arch:stone' if kind=='stone' else 'arch:cream',[8,64,24,80] if kind=='stone' else [80,64,96,80],[x,y])
   elif c=='t':grid(im,LANCET,DETAIL_PAL,[x+2,y+1],'lancet window')
   elif c=='x':grid(im,SHUTTER,DETAIL_PAL,[x,y+2],'shuttered glass window')
   elif c=='o':old.current=rec;old.oculus(im,[x,y+1])
   elif c not in 'bw':raise ValueError(c)
 rec.setdefault('facades',[]).append({'at':at,'rows':rows,'cell':[16,32],'material':kind})
def roof(im,style,at,width=None,material=None,kind='plaster'):
 x,y=at
 if style=='hip':
  for key,rect,to in HIP[width]:part(im,key,rect,[x+to[0],y+to[1]])
  if material:old.current=rec;old.convert_roof(im,[x,y,x+width,y+64],material)
 elif style=='gable':part(im,'arch:stone' if kind=='stone' else 'bd-house-h139_0',[0,0,64,64],at)
 elif style=='mansard':
  for rect,to in MANSARD[width]:part(im,'arch:review-r6-building-02',rect,[x+to[0],y+to[1]])
 elif style=='gambrel':part(im,'arch:review-r6-building-01',[0,0,96,64],at)
 elif style=='barrel':part(im,'arch:review-r6-building-04',[0,0,112,64],at)
 elif style=='onion':
  part(im,'arch:review-r6-building-09',[0,0,80,64],at)
  repair_curve(im,rec,at,old.ONION,'onion','gold')
 elif style=='bell':part(im,'arch:review-r6-building-05',[0,0,64,56],at)
 elif style=='flat':
  for rect,to in [([0,0,48,64],[0,0]),([48,0,64,64],[48,0]),([48,0,64,64],[64,0]),([64,0,112,64],[80,0])]:part(im,'arch:brick',rect,[x+to[0],y+to[1]])
  if material:old.current=rec;old.convert_roof(im,[x,y,x+128,y+64],material)
 else:raise ValueError(style)
 rec.setdefault('roofAssembly',[]).append({'style':style,'at':at,'width':width,'material':material})
def balcony(im,at):
 # A glazed window remains behind these rails. There is no upper-storey door.
 rows=['HhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhhHhhh',
       'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
       'hD......hD......hD......hD......hD......hD......hD......hD....hD',
       'hD......hD......hD......hD......hD......hD......hD......hD....hD',
       'hD......hD......hD......hD......hD......hD......hD......hD....hD',
       'hD......hD......hD......hD......hD......hD......hD......hD....hD',
       'hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh',
       'mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm',
       'DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
       '....mD....................................................mD....',
       '....mD....................................................mD....',
       '.....D.....................................................D....']
 grid(im,rows,DETAIL_PAL,at,'projected wooden balcony, glazed openings')
def W(at,rows,kind='plaster'):return ['wall',at,rows,kind]
def R(style,at,width=None,material=None,kind='plaster'):return ['roof',style,at,width,material,kind]
def B(at):return ['balcony',at]
def T(at,style='dome'):return ['tower',at,style]
# The tuples below are the authored structure, layer order, facade layout and
# chosen roof rectangles. No inference of masks, roof curves or building plans.
PLANS=[
 (1,'둥근 창의 작은 돌집',64,112,'Mana: steep gable and round glazing',[W([0,80],['soDs'],'stone'),R('gable',[0,16],kind='stone')]),
 (2,'길게 누운 지붕의 농가',128,112,'CT: low elongated residence',[W([0,80],['sbbDsbbs']),R('hip',[0,16],128,'olive')]),
 (3,'높은 본채와 낮은 부엌집',112,144,'CT: asymmetric domestic wings',[W([48,112],['swbs']),W([0,80],['stbs','bsDb']),R('hip',[32,48],80),R('gable',[0,16])]),
 (4,'가운데 박공이 솟은 상인집',160,144,'FF6 Narshe: high central gable in broad roof',[W([0,80],['sbbwtswbws','sbwbwDwbws']),R('hip',[0,16],160,'slate'),W([48,64],['stts']),R('gable',[48,0])]),
 (5,'한쪽 지붕이 낮은 골목집',112,128,'CT: unequal connected roof volumes',[W([0,96],['wbswbbs']),R('hip',[0,32],112),W([0,64],['stws','sbDs']),R('gable',[0,0])]),
 (6,'발코니가 있는 삼층 주택',96,176,'FF6 Zozo: tall facade and balcony',[W([0,80],['stbbts','sxttxs','sbDbbs']),R('hip',[0,16],96,'slate'),B([16,130])]),
 (7,'높은 돌집과 낮은 살림채',160,192,'FF6 Zozo: tall narrow wing over low block',[W([0,160],['ssDbbbbsss'],'stone'),R('hip',[0,96],160,'slate'),W([96,64],['stts','swbs','sbws','swws'],'stone'),R('gable',[96,0],kind='stone')]),
 (8,'두 박공 사이의 넓은 집',160,160,'BOF2: two gables connected by common block',[W([0,96],['sbtssbtssb','sbwbwDwbws']),R('hip',[0,32],160),W([0,64],['stts']),W([96,64],['stts']),R('gable',[0,0]),R('gable',[96,0])]),
 (9,'긴 맨사드 지붕의 연립집',176,160,'FF6: continuous urban block with attic',[W([0,96],['sxtsbbbstxs','sbwbwDwbwbs']),R('mansard',[0,0],176)]),
 (10,'앞 날개가 두 개인 저택',192,160,'FF6 Jidoor: symmetric wings and wide center',[W([16,64],['sbtssbtssb','sbwbwswbws','sbbbwDbbbs']),R('hip',[16,0],160,'gold'),W([0,96],['stts','swws']),W([128,96],['stts','swws']),R('gable',[0,32]),R('gable',[128,32])]),
 (11,'박공 현관이 붙은 청회색 집',128,144,'Mana: doorway wing and distinct upper roof',[W([0,80],['stswstsw','sbbwDbws']),R('hip',[0,16],128,'slate'),W([0,112],['stts']),R('gable',[0,48])]),
 (12,'십자 지붕의 큰 가족집',160,160,'FF6 South Figaro: cross gable and upper rooms',[W([0,64],['sbtssbtssb','sbbsttsbbs','sbwbwswbws']),R('hip',[0,0],160,'olive'),W([48,96],['stts','sbDs']),R('gable',[48,32])]),
 (13,'엇갈린 박공의 석조 민가',176,144,'FF6 Narshe: irregular gable heights',[W([0,80],['sbtssbtssbs','sbbDbbbsbws'],'stone'),R('hip',[0,16],176,'slate'),W([16,64],['stts'],'stone'),R('gable',[16,0],kind='stone'),R('gable',[96,32],kind='stone')]),
 (14,'깊은 현관채가 있는 민가',128,176,'Mana: entrance volume projects toward path',[W([0,80],['stswstsw','sbbwbbws']),R('hip',[0,16],128),W([32,144],['sbDs']),R('gable',[32,80])]),
 (15,'세 박공이 이어진 지붕집',192,144,'FF6 Narshe: multiple independent roof ridges',[W([0,80],['stssbtssbtss','sbbwbDwbwbbs']),R('hip',[0,16],192,'slate'),W([0,64],['stts']),R('gable',[0,0]),R('gable',[64,16]),R('gable',[128,32])]),
 (16,'둥근 탑과 작은 살림집',112,144,'CT Medina: round volumes attached to house',[W([32,112],['sbDss']),R('hip',[32,48],80,'olive'),T([0,0])]),
 (17,'종 지붕 탑이 붙은 집',144,160,'CT Medina: pointed round roof beside low wing',[W([0,128],['sbDbwbs']),R('hip',[0,64],112,'gold'),T([80,16],'bell')]),
 (18,'두 둥근 탑 사이의 집',160,144,'CT: flanking cylindrical silhouettes',[W([16,112],['sbbwDwws']),R('hip',[16,48],128,'olive'),T([0,0]),T([96,0])]),
 (19,'구근 지붕과 두 낮은 날개',176,160,'CT Medina: curved central cap and low wings',[W([0,128],['swbbs']),W([96,128],['sbbws']),R('hip',[0,64],80),R('hip',[96,64],80),W([48,64],['sttts','sbbbs','sbDbs']),R('onion',[48,0])]),
 (20,'둥근 본채와 긴 현관채',112,176,'CT: stacked round mass and attached pitched wing',[W([0,80],['sttts','sbbbs','sbwbs']),R('onion',[0,16]),W([48,144],['sbDs']),R('gable',[48,80])]),
 (21,'다락 박공이 있는 맨사드 집',160,160,'FF6 Jidoor: roof dormer and asymmetric domestic wing',[W([16,96],['stswstsw','sbDwbwws']),R('mansard',[16,0],128),W([80,128],['stbws']),R('hip',[80,64],80,'olive'),R('gable',[48,32])]),
 (22,'꺾인 너와와 낮은 기와채',160,144,'BOF2: large pitched house with attached lower roof',[W([0,80],['stbbts','sbwbws']),W([32,112],['swbbbDss']),R('flat',[32,48],material='gold'),R('gambrel',[0,16])]),
 (23,'통지붕과 둥근 창의 삼층집',112,176,'BOF2: strong vertical home silhouette',[W([0,80],['sotttos','sxbbtxs','sbwDwws']),R('barrel',[0,16]),B([24,130])]),
 (24,'종 지붕 다락을 얹은 집',128,176,'CT: raised round roof above broad lower cap',[W([32,72],['stts']),R('bell',[32,16]),W([0,144],['sbbDbbbs']),R('hip',[0,80],128,'olive')]),
 (25,'박공 날개와 다락의 큰 저택',208,176,'FF6 Jidoor + BOF2: symmetric house with projecting entrance',[W([40,112],['stswstsw','sbbwbbws']),R('mansard',[40,16],128),W([8,112],['stts','sbbs']),W([136,112],['stts','sbbs']),R('gable',[8,48]),R('gable',[136,48]),W([72,144],['sbDs']),R('gable',[72,80])]),
]
def author(limit=None):
 global rec
 for n,name,w,h,inspiration,steps in PLANS:
  if limit and n>limit:break
  rec={'id':f'r7-building-{n:02}','name':name,'width':w,'height':h,'inspiration':inspiration,'parts':[],'roofs':[],'steps':steps};old.current=rec;im=Image.new('RGBA',(w,h))
  for step in steps:
   if step[0]=='wall':wall(im,*step[1:])
   elif step[0]=='roof':roof(im,*step[1:])
   elif step[0]=='balcony':balcony(im,*step[1:])
   elif step[0]=='tower':
    at,style=step[1:]
    # The chapel includes an adjoining roof beyond x48 at y64. Preserve only
    # its roof cap and repaired door patch, over the original pure round tower.
    part(im,'arch:review-r5-mill-round-roof',[0,0,64,144],at)
    part(im,'arch:review-r6-building-10',[0,0,64,56],at,True)
    part(im,'arch:review-r6-building-10',[22,108,42,144],[at[0]+22,at[1]+108],True)
    if style=='bell':part(im,'arch:review-r6-building-05',[0,0,64,56],at,True)
    else:repair_curve(im,rec,[at[0],at[1]+16],old.DOME,'dome','wood')
  # The only entrance remains explicit; no sign is used as a proxy for a door.
  if len(rec.get('doors',[]))!=1:raise ValueError((name,rec.get('doors')))
  rec['entrance']=rec['doors'][0]
  colors=sorted(set(im.getdata()));sym={c:'p'+str(i) for i,c in enumerate(colors)}
  rec['palette']={sym[c]:bytes(c).hex() for c in colors};rec['rows']=[' '.join(sym[im.getpixel((x,y))] for x in range(w)) for y in range(h)]
  path=ROOT/'public/assets/beodeul-architecture'/('review-'+rec['id']+'.png');im.save(path);rec['sourcePngHash']=hashlib.sha256(path.read_bytes()).hexdigest();records.append(rec)
 SOURCE.joinpath('round7-detail-sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
 candidates=[]
 for r in records:
  asset='review-'+r['id'];candidates.append({'id':r['id'],'name':r['name'],'role':'주택','width':r['width'],'height':r['height'],'authoring':'native-parts','reference':'arch:cream','components':[{'source':'arch:'+asset,'rect':[0,0,r['width'],r['height']],'at':[0,0],'replace':False}],'entrance':r['entrance'],'description':r['name']+' · 창문과 지붕의 높낮이를 달리한 주택. 출입문은 한 곳이며 벽 재질을 통일했습니다.','lighting':'원본 왼쪽 위 광원','perspective':'3/4 탑뷰 · 지붕 윗면과 남쪽 정면','source':'authored-native-grid/round-7','silhouette':r['name'],'round':7,'nativeAssetHashes':{asset:r['sourcePngHash']}})
 SOURCE.joinpath('round7-candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2)+'\n')
 board=Image.new('RGB',(2240,2280),'#344430');d=ImageDraw.Draw(board);font=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumGothic.ttf',17)
 for n,r in enumerate(records):
  im=Image.open(ROOT/'public/assets/beodeul-architecture'/('review-'+r['id']+'.png')).convert('RGBA');big=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST);x=n%5*448;y=n//5*456;board.paste(big,(x+(448-big.width)//2,y+404-big.height),big);d.text((x+10,y+425),f'{n+1:02} '+r['name'],font=font,fill='#e7ead8')
 board.save(ROOT/'verify-shots/beodeul-building-review/round7-draft-board.png');print('Authored',len(records),'private candidates; seed unchanged')
if __name__=='__main__':author(int(sys.argv[1]) if len(sys.argv)>1 else None)
