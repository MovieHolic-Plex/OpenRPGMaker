"""Chosen native pixel transfers and explicit roof scanlines, review drafts only.
Every final asset is retained as a palette-index grid for exact reproduction.
"""
from pathlib import Path
from functools import lru_cache
from PIL import Image,ImageDraw,ImageFont
import json,hashlib,colorsys,sys
from native_author import ROOT,native,render_native
from round6_courses import rounded_courses,ONION_COURSES,BARREL_COURSES,DOME_COURSES
from author_round3_details import bake_sign,BACK,PAL,COPPER,SLATE,OLIVE,GOLD
SOURCE=ROOT/'harness-data/beodeul-building-review'
@lru_cache(None)
def original(key):return native(key)
SEED=json.loads((SOURCE/'seed.json').read_text())
records=[];current=None

def transfer(im,key,rect,at,replace=False):
 source=original(key);patch=source.crop(rect);assert 0<=rect[0]<rect[2]<=source.width and 0<=rect[1]<rect[3]<=source.height
 assert 0<=at[0] and 0<=at[1] and at[0]+patch.width<=im.width and at[1]+patch.height<=im.height
 if replace:im.paste(patch,at)
 else:im.alpha_composite(patch,at)
 current['parts'].append(dict(source=key,rect=rect,at=at,replace=replace))

def chosen_roof(im,at,spans,material='copper',columns=None,seams=()):
 """Copy chosen native roof runs; authored endpoints are not a shape formula."""
 tex=original('arch:brick');source_rect=[32,24,80,64]
 mapping={}
 for c in set(tex.crop(source_rect).getdata()):
  h,sat,v=colorsys.rgb_to_hsv(*(n/255 for n in c[:3]));hue,saturation,factor={'wood':(.09,min(.28,sat*.54),.74),'slate':(.59,min(.28,sat*.52),.85),'olive':(.155,min(.42,sat*.63),.88),'gold':(.115,min(.48,sat*.7),.96)}.get(material,(h,sat,1.0));mapping[c]=tuple(round(n*255) for n in colorsys.hsv_to_rgb(hue,saturation,v*factor))+(c[3],)
 details={'at':at,'spans':spans,'material':material,'textureSource':'arch:brick','textureRect':source_rect,'columns':columns,'transfers':[],'seams':[],'mapping':{bytes(a).hex():bytes(b).hex() for a,b in mapping.items()}}
 x0,y0=at
 width=max(b for a,b in spans);tones={60:[(0,12,1.02),(12,32,.98),(32,44,.90),(44,56,.76),(56,64,.60)],64:[(0,12,1.02),(12,32,.98),(32,44,.90),(44,56,.76),(56,64,.60)],80:[(0,16,1.02),(16,40,.98),(40,56,.90),(56,72,.76),(72,80,.60)],96:[(0,20,1.02),(20,48,.98),(48,68,.90),(68,84,.76),(84,96,.60)],112:[(0,24,1.02),(24,56,.98),(56,80,.90),(80,100,.76),(100,112,.60)],128:[(0,28,1.02),(28,64,.98),(64,92,.90),(92,116,.76),(116,128,.60)],160:[(0,36,1.02),(36,80,.98),(80,112,.90),(112,144,.76),(144,160,.60)]}[width];toneMaps={factor:{c:tuple(round(n*factor) for n in out[:3])+(out[3],) for c,out in mapping.items()} for _,_,factor in tones};details['toneBands']=tones;details['tonePalettes']={str(f):{bytes(c).hex():bytes(out).hex() for c,out in m.items()} for f,m in toneMaps.items()}
 for y,(a,b) in enumerate(spans):
  assert 0<=a<b and b+x0<=im.width and y+y0<im.height
  for x in range(a,b):
   offset=next((o for l,r,o in columns if l<=x<r),0) if columns else 0
   sx=32+(x%48);sy=24+((y-offset)%40);c=tex.getpixel((sx,sy));assert c[3]
   factor=next(f for a,b,f in tones if a<=x<b);im.putpixel((x+x0,y+y0),toneMaps[factor][c]);details['transfers'].append([x+x0,y+y0,sx,sy])
 # Only explicitly chosen edge pixels are added, using original native seam colors.
 edge=(52,24,38,255) if material=='copper' else (32,39,55,255) if material=='slate' else (43,33,23,255)
 for y,(a,b) in enumerate(spans):
  for x in [a,b-1]:im.putpixel((x+x0,y+y0),edge);details['seams'].append([x+x0,y+y0,bytes(edge).hex()])
 for x,y,line in seams:
  pal={'D':edge,'H':(236,219,149,255) if material=='copper' else (158,164,145,255) if material=='slate' else (156,134,91,255),'m':(86,68,44,255)}
  for dx,c in enumerate(line):
   im.putpixel((x0+x+dx,y0+y),pal[c]);details['seams'].append([x0+x+dx,y0+y,bytes(pal[c]).hex()])
 current['roofs'].append(details)

def put_glyph(im,name,at):
 glyphs={
 'cup':['........','..ssss..','.wttttws','.wllllws','.wllllws','..wwww..','ssssssss','........'],
 'shears':['.ww...ww','w..w.w..','w..w.w..','.ww.ww..','...ss...','..s..s..','.s....s.','s......s'],
 'leaf':['....gg..','..ggggg.','.gggsgg.','gggsgg..','ggsgg...','.sgg....','.s......','s.......'],
 'bell':['...gg...','..gggg..','..gssg..','.ggssgg.','.gggggg.','gggggggg','...ss...','...gg...'],
 'fish':['........','...ss...','..wllw..','wwllllww','..wllw..','...ss...','........','........'],
 'compass':['...g....','..ggg...','...g....','gggggggg','...g....','..ggg...','...g....','........'],
 'wheat':['..g.g...','.gg.gg..','..gsg...','.ggsgg..','..gsg...','...s....','...s....','..sss...']}
 if name not in glyphs:
  sign,rows=bake_sign(name)
 else:
  rows=[list(r) for r in BACK]
  for y,row in enumerate(glyphs[name]):
   for x,c in enumerate(row):
    if c!='.':rows[11+y][4+x]=c
  rows=[''.join(r) for r in rows];sign=Image.new('RGBA',(16,24))
  for y,row in enumerate(rows):
   for x,c in enumerate(row):sign.putpixel((x,y),PAL[c])
 im.alpha_composite(sign,at);current['sign']={'glyph':name,'at':at,'rows':rows,'palette':{k:bytes(v).hex() for k,v in PAL.items()}}

def convert_roof(im,rect,material):
 lookup={};coords=[]
 for y in range(rect[1],rect[3]):
  for x in range(rect[0],rect[2]):
   c=im.getpixel((x,y))
   if not c[3]:continue
   h,s,v=colorsys.rgb_to_hsv(*(n/255 for n in c[:3]))
   # Chosen roof material recoloring leaves neutral cap stones and mortar alone.
   if s<.15:continue
   hue,sat,factor={'slate':(.59,min(.28,s*.52),.85),'gold':(.115,min(.48,s*.7),.96),'olive':(.155,min(.42,s*.63),.88),'wood':(.09,min(.28,s*.54),.74)}[material]
   out=tuple(round(n*255) for n in colorsys.hsv_to_rgb(hue,sat,v*factor))+(c[3],);lookup[c]=out;im.putpixel((x,y),out);coords.append([x,y])
 current.setdefault('nativeRoofConversions',[]).append({'rect':rect,'material':material,'coordinates':coords,'mapping':{bytes(a).hex():bytes(b).hex() for a,b in lookup.items()}})

def oculus(im,at):
 rows=['.....DDDDDD.....','...DDHHHHHHDD...','..DHhhmmmmhhHD..','.DHhmmtmmmhmHD..','.DhhmmttmmmhHD..','DHhmmmttmmmmhHD.','DHmmmmttmmmmmHD.','DHttttDDtttttHD.','DHggggDDgggggHD.','DHmmmmttmmmmmHD.','DHhmmmttmmmmhHD.','.DhhmmttmmmhHD..','.DHhmmttmmhmHD..','..DHhhmmmmhhHD..','...DDHHHHHHDD...','.....DDDDDD.....']
 palette={'.':(0,0,0,0),'D':(45,36,28,255),'H':(228,211,183,255),'h':(141,122,96,255),'m':(40,70,85,255),'t':(98,86,68,255),'g':(61,104,113,255)}
 for y,row in enumerate(rows):
  assert len(row)==16,(y,len(row))
  for x,c in enumerate(row):
   if c!='.':im.putpixel((at[0]+x,at[1]+y),palette[c])
 current['oculus']={'at':at,'rows':rows,'palette':{k:bytes(v).hex() for k,v in palette.items()}}

def cylinder_light(im):
 bands=[(0,16,1.0),(16,24,.98),(24,40,.94),(40,52,.83),(52,64,.72)];lookups={};changes=[]
 for a,b,factor in bands:
  lookup={}
  for y in range(56,im.height):
   for x in range(a,b):
    c=im.getpixel((x,y))
    if c[3]:
     out=tuple(round(v*factor) for v in c[:3])+(c[3],);lookup[c]=out;im.putpixel((x,y),out);changes.append([x,y])
  lookups[str(factor)]={bytes(a).hex():bytes(b).hex() for a,b in lookup.items()}
 current['cylinderLight']={'bands':bands,'coordinates':changes,'lookups':lookups}

# Hand-chosen native-pixel outlines. Equal runs are deliberate rows, not a generated polygon.
GAMBREL=[(46,50),(44,52),(42,54),(40,56),(38,58),(36,60),(34,62),(32,64),(30,66),(28,68),(26,70),(24,72),(22,74),(20,76),(18,78),(16,80),(14,82),(12,84),(10,86),(8,88),(8,88),(8,88),(7,89),(7,89),(7,89),(7,89),(6,90),(6,90),(6,90),(6,90),(5,91),(5,91),(5,91),(5,91),(4,92),(4,92),(4,92),(4,92),(3,93),(3,93),(3,93),(3,93),(2,94),(2,94),(2,94),(2,94),(1,95),(1,95),(1,95),(1,95),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96),(0,96)]
MANSARD=[(32,96),(31,97),(30,98),(29,99),(28,100),(27,101),(26,102),(25,103),(24,104),(23,105),(22,106),(21,107),(20,108),(19,109),(18,110),(17,111),(16,112),(15,113),(14,114),(13,115),(12,116),(12,116),(12,116),(12,116),(12,116),(12,116),(12,116),(12,116),(12,116),(12,116),(12,116),(12,116),(11,117),(11,117),(11,117),(11,117),(10,118),(10,118),(10,118),(10,118),(9,119),(9,119),(9,119),(9,119),(8,120),(8,120),(8,120),(8,120),(7,121),(7,121),(7,121),(7,121),(6,122),(6,122),(6,122),(6,122),(5,123),(5,123),(5,123),(5,123),(4,124),(4,124),(4,124),(4,124),(3,125),(3,125),(3,125),(3,125),(2,126),(2,126),(2,126),(2,126),(1,127),(1,127),(1,127),(1,127),(0,128),(0,128),(0,128),(0,128)]
BARREL=[(36,76),(32,80),(28,84),(24,88),(21,91),(18,94),(16,96),(14,98),(12,100),(10,102),(9,103),(8,104),(7,105),(6,106),(5,107),(4,108),(3,109),(3,109),(2,110),(2,110),(1,111),(1,111),(1,111),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112),(0,112)]
BELL=[(31,33),(30,34),(30,34),(29,35),(29,35),(28,36),(28,36),(27,37),(27,37),(26,38),(26,38),(25,39),(25,39),(24,40),(24,40),(23,41),(23,41),(22,42),(22,42),(21,43),(21,43),(20,44),(20,44),(19,45),(19,45),(18,46),(18,46),(17,47),(17,47),(16,48),(16,48),(15,49),(14,50),(13,51),(12,52),(11,53),(10,54),(9,55),(8,56),(7,57),(6,58),(5,59),(4,60),(3,61),(2,62),(1,63),(0,64),(0,64),(0,64),(1,63),(2,62),(3,61),(4,60),(5,59),(6,58),(7,57)]
ONION=[(39,41),(38,42),(38,42),(37,43),(37,43),(36,44),(36,44),(35,45),(35,45),(34,46),(33,47),(32,48),(31,49),(30,50),(29,51),(28,52),(26,54),(24,56),(22,58),(20,60),(18,62),(16,64),(14,66),(12,68),(10,70),(8,72),(7,73),(6,74),(5,75),(4,76),(3,77),(2,78),(2,78),(1,79),(1,79),(0,80),(0,80),(0,80),(0,80),(0,80),(0,80),(0,80),(1,79),(1,79),(2,78),(2,78),(3,77),(4,76),(5,75),(6,74),(7,73),(8,72),(9,71),(9,71),(9,71),(9,71),(9,71),(9,71),(9,71),(9,71),(8,72),(8,72),(8,72),(8,72)]
HIP48=[(18,46),(17,47),(16,48),(15,49),(14,50),(13,51),(12,52),(11,53),(10,54),(9,55),(8,56),(7,57),(6,58),(5,59),(4,60),(3,61),(2,62),(1,63),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64),(0,64)]
# Explicit source run selection makes the shed roof a broad single slope.
DOME=[[27, 37], [24, 40], [22, 42], [20, 44], [18, 46], [17, 47], [15, 49], [14, 50], [13, 51], [12, 52], [11, 53], [10, 54], [9, 55], [8, 56], [7, 57], [7, 57], [6, 58], [6, 58], [5, 59], [5, 59], [4, 60], [4, 60], [4, 60], [4, 60], [4, 60], [4, 60], [4, 60], [4, 60], [4, 60], [4, 60], [4, 60], [5, 59], [5, 59], [6, 58], [7, 57], [8, 56], [9, 55], [10, 54], [11, 53], [12, 52]]
SHED=[(20,140),(18,142),(16,144),(14,146),(12,148),(10,150),(8,152),(6,154),(4,156),(2,158),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160),(0,160)]

def begin(n,name,role,w,h,entrance,silhouette):
 global current
 current={'id':f'r6-building-{n:02}','name':name,'role':role,'width':w,'height':h,'entrance':entrance,'silhouette':silhouette,'parts':[],'roofs':[]};return Image.new('RGBA',(w,h))
def finish(im,description,material):
 name='review-'+current['id'];path=ROOT/'public/assets/beodeul-architecture'/(name+'.png');im.save(path)
 colors=sorted(set(im.getdata()));symbols={c:'p'+str(n) for n,c in enumerate(colors)}
 current.update(description=description,material=material,palette={symbols[c]:bytes(c).hex() for c in colors},rows=[[symbols[im.getpixel((x,y))] for x in range(im.width)] for y in range(im.height)],sourcePngHash=hashlib.sha256(path.read_bytes()).hexdigest());records.append(current)

def main():
 # 01: a bent roof and fine plaster gable, one entrance in the timber/plaster facade.
 im=begin(1,'꺾인 너와 지붕 양조장','양조장',96,96,dict(x=48,y=64,w=16,h=32),'꺾인 경사 · 따뜻한 회벽 박공');transfer(im,'arch:ochre',[0,64,96,96],[0,64]);chosen_roof(im,[0,0],GAMBREL,'wood')
 # Selected front gable runs keep fine plaster grain and one wall color. The apex is below the roof ridge.
 gable=[(46,50),(44,52),(42,54),(40,56),(38,58),(36,60),(34,62),(32,64),(30,66),(28,68),(26,70),(24,72),(22,74),(20,76),(18,78),(16,80),(14,82),(12,84),(10,86),(8,88),(6,90),(4,92),(2,94),(0,96)]
 for row,(a,b) in enumerate(gable):
  for x in range(a,b):im.putpixel((x,40+row),original('arch:ochre').getpixel((4+x%10,66+row%10)))
 current['gable']={'spans':gable,'atY':40,'source':'arch:ochre','sourceYRuns':[66,76],'sourceXRuns':[4,14]};oculus(im,[40,46]);put_glyph(im,'cup',[8,60]);finish(im,'완만한 상단과 가파른 하단 경사가 꺾이는 너와 지붕. 미세한 회벽 박공과 술잔 간판, 출입문 하나.','wood')
 # 02: mansard knee, deep upper surface, two storeys and an original single door.
 im=begin(2,'청회색 맨사드 지붕 열쇠점','열쇠점',128,160,dict(x=64,y=128,w=16,h=32),'꺾인 사면 지붕 · 이층');transfer(im,'bd-house-h104_1',[0,64,128,128],[0,96]);chosen_roof(im,[0,16],MANSARD,'slate')
 # Finished back ridge inside the sprite, with 16 transparent rows above it.
 cap={'D':(45,59,76,255),'H':(155,173,177,255),'m':(89,114,129,255)}
 cap_rows=['D'*64,'D'+'H'*62+'D','D'+'m'*62+'D']
 for y,row in enumerate(cap_rows):
  for x,c in enumerate(row):im.putpixel((32+x,16+y),cap[c])
 current['ridgeCap']={'at':[32,16],'rows':cap_rows,'palette':{c:bytes(rgba).hex() for c,rgba in cap.items()}}
 put_glyph(im,'key',[96,112]);finish(im,'상부의 완만한 사면과 하부의 깊은 경사를 구분한 청회색 기와. 같은 회벽·목조 틀을 쓰는 이층 열쇠점.','slate')
 # 03: a low, wide bathhouse; one stone material, large native circular window.
 im=begin(3,'낮은 황동 기와 돌벽 목욕탕','목욕탕',128,96,dict(x=64,y=64,w=16,h=32),'낮은 사면 지붕 · 넓은 돌벽');transfer(im,'arch:brick',[0,16,48,64],[0,16]);transfer(im,'arch:brick',[48,16,64,64],[48,16]);transfer(im,'arch:brick',[48,16,64,64],[64,16]);transfer(im,'arch:brick',[64,16,112,64],[80,16]);transfer(im,'arch:stone',[0,64,32,96],[0,64]);transfer(im,'arch:stone',[0,64,32,96],[32,64]);transfer(im,'arch:stone',[32,64,64,96],[64,64]);transfer(im,'arch:stone',[0,64,32,96],[96,64]);
 # Retain relief coordinates when converting the roof's copper ramp to aged brass.
 convert_roof(im,[0,0,128,64],'gold');oculus(im,[20,68]);put_glyph(im,'cup',[96,60]);finish(im,'낮고 넓은 황동 기와와 일정한 돌벽 색. 원형 창과 좁은 창을 섞은 한 층의 목욕탕.','gold')
 # 04: curved roof across a short broad tea house, same native shingle scale.
 im=begin(4,'둥근 통지붕 찻집','찻집',112,96,dict(x=32,y=64,w=16,h=32),'낮은 둥근 통지붕 · 단층');transfer(im,'bd-house-h120_0',[0,64,112,96],[0,64]);transfer(im,'bd-house-h103_2',[64,64,80,80],[16,64],True);chosen_roof(im,[0,16],BARREL,'olive',columns=[(0,12,0),(12,24,1),(24,40,2),(40,72,3),(72,88,2),(88,100,1),(100,112,0)]);put_glyph(im,'leaf',[88,58]);finish(im,'중앙의 곡면과 휘어진 기와 줄로 읽히는 낮은 통지붕. 올리브빛 기와·회벽과 찻잎 간판.','olive')
 # 05: bell-shaped roof and taller cylindrical plaster tower, shield sign.
 im=begin(5,'종 모양 지붕 파수탑','파수탑',64,176,dict(x=24,y=140,w=16,h=29),'곡선으로 벌어지는 종 지붕 · 높은 원형 탑');transfer(im,'arch:review-r5-mill-round-roof',[12,64,52,96],[12,56]);transfer(im,'arch:review-r5-mill-round-roof',[12,88,52,96],[12,88]);transfer(im,'arch:review-r5-mill-round-roof',[0,64,64,144],[0,96]);chosen_roof(im,[0,0],BELL,'slate',columns=[(0,12,0),(12,24,1),(24,40,2),(40,52,1),(52,64,0)]);cylinder_light(im);put_glyph(im,'shield',[40,114]);finish(im,'아래로 갈수록 곡선으로 벌어지는 청회색 종 지붕. 같은 회벽과 석재 기초를 유지한 높은 원형 파수탑.','slate')
 # 06: long single roof slope, grain scale kept, low timber/plaster building below.
 im=begin(6,'긴 너와 지붕 숲지기 숙소','숲지기',160,96,dict(x=32,y=64,w=16,h=32),'길고 낮은 지붕 · 회벽과 목조 틀');transfer(im,'arch:cream',[0,64,112,96],[0,64]);transfer(im,'arch:cream',[64,64,112,96],[112,64]);transfer(im,'arch:brick',[0,16,48,64],[0,16]);transfer(im,'arch:brick',[48,16,64,64],[48,16]);transfer(im,'arch:brick',[48,16,64,64],[64,16]);transfer(im,'arch:brick',[48,16,64,64],[80,16]);transfer(im,'arch:brick',[48,16,64,64],[96,16]);transfer(im,'arch:brick',[64,16,112,64],[112,16]);convert_roof(im,[0,16,160,64],'wood');put_glyph(im,'leaf',[132,61]);finish(im,'긴 단층 회벽과 넓은 너와 사면. 서로 다른 창 간격과 잎 간판의 숲지기 숙소.','wood')
 # 07: tall front-gabled main building and low hipped weaving wing, no extra door.
 im=begin(7,'높은 박공과 낮은 옆채 직조 공방','직조 공방',128,128,dict(x=32,y=96,w=16,h=32),'높은 박공 · 낮은 작업채');base=next(i for i in SEED['candidates'] if i['id']=='r2-building-02')
 for p in base['components']:transfer(im,p['source'],p['rect'],p['at'],p.get('replace',False))
 transfer(im,'bd-house-h104_1',[0,96,64,128],[64,96]);transfer(im,'arch:cream',[0,16,32,64],[64,48]);transfer(im,'arch:cream',[32,16,48,64],[96,48]);transfer(im,'arch:cream',[64,16,80,64],[112,48]);convert_roof(im,[64,48,128,96],'olive');put_glyph(im,'shears',[100,87]);finish(im,'앞 박공의 높은 집과 낮은 작업채를 붙인 공방. 상부 창과 작업실 창의 높이를 달리하고 문은 본채 하나.','copper/olive')
 # 08: offset two-storey house, broad mansard cap plus a shorter shed wing.
 im=begin(8,'높낮이가 다른 청회색 서기관 집','서기관',144,144,dict(x=48,y=112,w=16,h=32),'깊은 지붕 · 비대칭 낮은 옆채');transfer(im,'bd-house-h104_1',[16,64,112,128],[0,80]);transfer(im,'bd-house-h104_1',[0,96,48,128],[96,112]);
 # Explicit 96-wide subset of the chosen mansard outline, centered over the main facade.
 # Native original cap pieces avoid a synthetic resized roof.
 transfer(im,'bd-house-h104_1',[0,0,32,64],[0,16]);transfer(im,'bd-house-h104_1',[32,0,64,64],[32,16]);transfer(im,'bd-house-h104_1',[96,0,128,64],[64,16]);
 transfer(im,'bd-house-h120_0',[64,16,112,64],[96,64]);convert_roof(im,[0,16,96,80],'slate');put_glyph(im,'quill',[116,108]);finish(im,'높은 본채와 낮게 이어진 옆채의 비대칭 윤곽. 넓은 윗면의 기와·동일한 회벽·서기관 깃펜 간판.','copper')
 # 09: onion cap, round silhouette and different roof-course curvature.
 im=begin(9,'별빛 구근 지붕 관측소','관측소',80,128,dict(x=40,y=96,w=16,h=32),'구근형 기와 지붕 · 좁은 관측소');base=next(i for i in SEED['candidates'] if i['id']=='r2-building-02')
 for p in base['components']:
  rect=p['rect'];y=max(64,rect[1]);
  if rect[3]>y:transfer(im,p['source'],[rect[0],y,rect[2],rect[3]],[p['at'][0]+8,p['at'][1]+y-rect[1]],p.get('replace',False))
 chosen_roof(im,[0,0],ONION,'gold',columns=[(0,12,0),(12,24,1),(24,32,2),(32,48,3),(48,56,2),(56,68,1),(68,80,0)]);rounded_courses(im,current,[0,0],ONION,ONION_COURSES,'gold');put_glyph(im,'compass',[56,78]);finish(im,'허리가 좁아졌다가 볼록하게 벌어지는 구근형 기와 지붕. 둥근 기와 줄·황동 계열 명암과 별 관측 간판.','gold')
 # 10: short domed bell tower beside a long single-storey chapel; only nave has a door.
 im=begin(10,'둥근 종탑과 긴 예배당','예배당',160,144,dict(x=80,y=112,w=16,h=32),'둥근 종탑 · 긴 낮은 본당');transfer(im,'arch:review-r5-mill-round-roof',[0,0,64,144],[0,0]);transfer(im,'arch:review-r5-mill-round-roof',[12,104,20,116],[22,108],True);transfer(im,'arch:review-r5-mill-round-roof',[12,104,20,116],[30,108],True);transfer(im,'arch:review-r5-mill-round-roof',[12,104,16,116],[38,108],True);transfer(im,'arch:review-r5-mill-round-roof',[8,120,24,144],[22,120],True);transfer(im,'arch:review-r5-mill-round-roof',[8,120,12,144],[38,120],True);transfer(im,'bd-house-h120_0',[0,64,112,96],[48,112]);transfer(im,'bd-house-h103_2',[64,64,80,80],[64,112],True);chosen_roof(im,[48,64],BARREL,'gold');chosen_roof(im,[0,16],DOME,'wood',columns=[(0,8,0),(8,16,1),(16,24,2),(24,40,3),(40,48,2),(48,56,1),(56,64,0)]);rounded_courses(im,current,[48,64],BARREL,BARREL_COURSES,'gold');rounded_courses(im,current,[0,16],DOME,DOME_COURSES,'wood');cylinder_light(im);put_glyph(im,'bell',[128,108]);finish(im,'둥근 너와 종탑과 황동빛 통지붕의 긴 본당. 종탑 하부 문은 회벽·기초로 바꾸고 본당 출입문만 남김.','wood/gold')
 (SOURCE/'round6-detail-sources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
 candidates=[]
 for r in records:
  name='review-'+r['id'];candidates.append(dict(id=r['id'],name=r['name'],role=r['role'],width=r['width'],height=r['height'],authoring='native-parts',reference='arch:cream',components=[dict(source='arch:'+name,rect=[0,0,r['width'],r['height']],at=[0,0],replace=False)],entrance=r['entrance'],description=r['description'],lighting='원본 왼쪽 위 광원',perspective='3/4 탑뷰 · 지붕 윗면과 남쪽 정면',source='authored-native-grid/round-6',silhouette=r['silhouette'],round=6,roofPalette=r['material'],nativeAssetHashes={name:r['sourcePngHash']}))
 (SOURCE/'round6-candidates.json').write_text(json.dumps(candidates,ensure_ascii=False,indent=2)+'\n')
 board=Image.new('RGB',(1800,940),'#344430');d=ImageDraw.Draw(board);font=ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumGothic.ttf',16)
 for n,r in enumerate(records):
  im=original('arch:review-'+r['id']);big=im.resize((im.width*2,im.height*2),Image.Resampling.NEAREST);x=n%5*360;y=n//5*470;board.paste(big,(x+(360-big.width)//2,y+400-big.height),big);d.text((x+10,y+425),r['name'],font=font,fill='#e7ead8')
 board.save(ROOT/'verify-shots/beodeul-building-review/round6-draft-board.png');print('10 private grids and native-scale drafts authored; seed not changed')
if __name__=='__main__':main()
