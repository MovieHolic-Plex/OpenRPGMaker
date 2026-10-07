"""Explicit four-pixel shingle cels and individually placed curved courses.
No inferred curves, generated masks, noise, resampling, or automatic tracing.
"""
import colorsys
GRIDS={'F':['mhmD','hhmD','hhDD','Dmmm'],'G':['mhmD','hhmD','hhDD','Dmmm'],'L':['mhmD','hhmD','hhDD','Dmmm'],'R':['mhmD','hhmD','hhDD','Dmmm']}
PAL={'.':(0,0,0,0),'D':(91,41,66,255),'d':(83,34,36,255),'H':(236,219,149,255),'h':(207,125,57,255),'m':(143,58,57,255),'n':(194,117,54,255),'s':(137,52,55,255)}
# Every row spells the tiles and every vertical offset is chosen explicitly.
# The reader packs native 4px cels; it does not infer a curve.
ONION_ROWS=[
 (36,3,'FG',[0,0]),
 (32,7,'LFGR',[0,1,1,0]),
 (28,11,'LFGFGR',[0,1,2,2,1,0]),
 (24,15,'LLFGFGRR',[0,1,2,3,3,2,1,0]),
 (16,19,'LLFFGFGFGFRR',[0,1,2,3,4,4,4,4,3,2,1,0]),
 (8,23,'LLLFGFGFGFGFGRRR',[0,1,2,3,4,5,5,5,5,5,5,4,3,2,1,0]),
 (4,27,'LLLFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,6,6,6,6,6,5,4,3,2,1,0]),
 (0,31,'LLLFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,35,'LLLFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,39,'LLLFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,43,'LLLFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (4,47,'LLLFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,6,6,6,6,6,5,4,3,2,1,0]),
 (8,51,'LLLFGFGFGFGFGRRR',[0,1,2,3,4,5,5,5,5,5,5,4,3,2,1,0]),
 (8,55,'LLLFGFGFGFGFGRRR',[0,1,2,3,4,5,5,5,5,5,5,4,3,2,1,0]),
 (8,59,'LLLFGFGFGFGFGRRR',[0,1,2,2,3,3,3,3,3,3,3,3,2,2,1,0])]
BARREL_ROWS=[
 (36,0,'LFGFGFGFGR',[0,0,0,1,1,1,1,0,0,0]),
 (24,4,'LLLFGFGFGFGFGRRR',[0,1,2,3,4,5,5,5,5,5,5,4,3,2,1,0]),
 (12,8,'LLLFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,6,6,6,6,6,6,6,6,6,5,4,3,2,1,0]),
 (4,12,'LLLFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,16,'LLLFGFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,20,'LLLFGFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,24,'LLLFGFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,28,'LLLFGFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,32,'LLLFGFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,36,'LLLFGFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,40,'LLLFGFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0]),
 (0,44,'LLLFGFGFGFGFGFGFGFGFGFGFGRRR',[0,1,2,3,4,5,6,7,7,7,7,7,7,7,7,7,7,7,7,7,7,6,5,4,3,2,1,0])]
DOME_ROWS=[
 (26,0,'FGR',[0,0,0]),
 (16,4,'LFGFGFRR',[0,1,2,2,2,2,1,0]),
 (8,8,'LLFGFGFGFGRR',[0,1,2,3,4,4,4,4,3,2,1,0]),
 (4,12,'LLFGFGFGFGFGRR',[0,1,2,3,4,5,5,5,5,4,3,2,1,0]),
 (4,16,'LLFGFGFGFGFGRR',[0,1,2,3,4,5,5,5,5,4,3,2,1,0]),
 (4,20,'LLFGFGFGFGFGRR',[0,1,2,3,4,5,5,5,5,4,3,2,1,0]),
 (4,24,'LLFGFGFGFGFGRR',[0,1,2,3,4,5,5,5,5,4,3,2,1,0]),
 (8,28,'LLFGFGFGFGRR',[0,1,2,3,4,4,4,4,3,2,1,0]),
 (12,32,'LFGFGFGFGR',[0,1,2,3,4,4,3,2,1,0]),
 (12,36,'LFGFGFGFGR',[0,1,2,2,3,3,2,2,1,0])]
def read_rows(rows):
 courses=[]
 for row_index,(x,y,glyphs,offsets) in enumerate(rows):
  # Chosen alternating half-cell course origins break continuous vertical ribs.
  x += 2 if row_index in [1,3,5,7,9,11,13] else 0
  assert len(glyphs)==len(offsets),(x,y,len(glyphs),len(offsets))
  courses.append([(x+n*4,y+offsets[n],g) for n,g in enumerate(glyphs)])
 return courses
ONION_COURSES=read_rows(ONION_ROWS);BARREL_COURSES=read_rows(BARREL_ROWS);DOME_COURSES=read_rows(DOME_ROWS)

def rounded_courses(im,record,at,spans,courses,material):
 palettes={}
 for face,factor in [('L',1.02),('F',.98),('G',.90),('R',.65)]:
  palette={}
  for c,rgba in PAL.items():
   h,s,v=colorsys.rgb_to_hsv(*(n/255 for n in rgba[:3]));h,s,f={'gold':(.115,min(.48,s*.7),.96),'wood':(.09,min(.28,s*.54),.74)}[material]
   palette[c]=tuple(round(n*255) for n in colorsys.hsv_to_rgb(h,s,min(1,v*f*factor)))+(rgba[3],)
  palettes[face]=palette
 patches=[];x0,y0=at
 for course in courses:
  for x,y,face in course:
   for dy,row in enumerate(GRIDS[face]):
    for dx,c in enumerate(row):
     yy=y+dy;xx=x+dx
     if c!='.' and 0<=yy<len(spans) and spans[yy][0]<=xx<spans[yy][1]:im.putpixel((x0+xx,y0+yy),palettes[face][c]);patches.append([x0+xx,y0+yy,face,c])
 # Explicit outline rows remain the original chosen silhouette, including its eave.
 outline=(43,33,23,255)
 for y,(a,b) in enumerate(spans):
  for x in [a,b-1]:im.putpixel((x0+x,y0+y),outline)
 record.setdefault('curvedCourses',[]).append({'at':at,'spans':spans,'grids':GRIDS,'courses':courses,'palettes':{face:{c:bytes(v).hex() for c,v in p.items()} for face,p in palettes.items()},'pixelPatches':patches,'outline':bytes(outline).hex()})
