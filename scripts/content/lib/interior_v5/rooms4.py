# v4 interiors: 10 buildings (the manor has two floor maps). Plans follow the partition rule (E-W gap = door,
# N-S gap = 3 rows); every table/desk/counter comes from the autotile kit; things that belong on a surface sit ON it.
import sys; sys.path.insert(0,'/tmp/j8v5')
import anim4, kit4
import tiles5, kit5, props5, props6, chapel5
from chapel5 import altar_rail, dais_w
from kit5 import rug, rect, line
from kit4 import OBJ, assemble
import room4
from mat import G
from surf import ice_chest, altar
def o(n):
    f=OBJ[n][1](); f.id=n; return f
def T(st,w,h=1):
    return assemble(st,w,h)
def C(w,st='counter'):
    f=assemble(st,w,1); f.role='counter'; return f
B={}   # building -> dict(name, maps=[map,...])
def mk(W,H,rects,opens=()):
    """plan from inside rectangles (x0,y0,x1,y1 inclusive) + single open cells (doors)"""
    g=[['#']*W for _ in range(H)]
    for x0,y0,x1,y1 in rects:
        for y in range(y0,y1+1):
            for x in range(x0,x1+1): g[y][x]='.'
    for x,y in opens: g[y][x]='.'
    return [''.join(r) for r in g]
def door_ns(x,y0): return [(x,y0),(x,y0+1),(x,y0+2)]          # gap in an N-S partition: 3 rows
def ss(n,k): f=o(n); return f
# ------------------------------------------------------------------ 빵집
B['bakery']=dict(name='빵집 — 가게·굽는 방(돌)·밀가루 창고',maps=[dict(key='bakery',name='빵집',floor='plank',wall='plaster',
 zones=[(1,1,8,5,'ovenf','rubble')],
 plan=[
"################",
"#........#.....#",
"#........#.....#",
"#........#.....#",
"#........#.....#",
"#........#.....#",
"#####.######.###",
"#..............#",
"#..............#",
"#..............#",
"#..............#",
"#..............#",
"#..............#",
"#######..#######",
"#######..#######"],
 rooms=[('굽는 방',2,4),('밀가루 창고',11,4),('가게',3,10)],
 items=[
  # 굽는 방: 화덕 + 옆 장작 선반, 발효 선반, 반죽대(위에 반죽·밀대·밀가루), 밀가루 자루는 반죽대 곁
  (o('bread oven'),1,3),(o('firewood rack'),3,3),(o('peel rack'),4,1),(o('proofing rack'),7,3),(o('proofing rack'),8,3),
  (T('work',3),6,5,[('doughball',0.15,1),('rollingpin',0.45,0.8),('doughball',0.7,1),('flourbowl',0.92,1)]),(o('sack:flour'),1,5),(o('water jar'),2,5),
  # 밀가루 창고 (좁게 5칸): 자루·통·궤짝, 앞줄은 비워 둔다
  (o('sack:flour'),10,3),(o('sack:grain'),11,3),(o('sack:flour'),13,3),(o('barrel'),14,3),(o('crate'),10,5),(o('crate'),14,5),(o('window'),11,1),
  # 가게: 손님은 남쪽 문으로 → 벽 빵 선반·진열 탁자에서 고르고 → 문 옆 카운터에서 계산. 주인은 뒷문(굽는 방)으로 드나든다
  (o('bread shelf'),1,9),(o('bread shelf baguette'),2,9),(o('bread shelf pie'),3,9),(o('bread shelf'),6,9),(o('bread shelf baguette'),7,9),
  (o('window'),2,7),(o('picture'),9,7),(o('window'),13,7),
  (T('display',3),1,11,[('breadbasket',0.18,1),('loafrow',0.55,1),('breadbasket',0.88,1)]),(T('display',2),5,11,[('baguettes',0.3,1),('breadbasket',0.75,1)]),
  (o('cake display case'),13,9),(o('cabinet:pie'),9,9),(o('bread shelf pie'),10,9),
  (C(3),9,11,[('bell',0.1,1),('cashbox',0.45,1),('breadbasket',0.85,1)]),(o('stool'),10,10) if False else (o('doormat'),7,12),
 ])])
import glob
for _f in sorted(glob.glob('/tmp/j8v5/b_*.py'))+sorted(glob.glob('/tmp/j8v5/b5_*.py')):
    exec(open(_f).read(),globals())
ORDER=['bakery','pharmacy','fish','butcher','smithy','chapel','scholar','tailor','tavern','manor','hobbit','inn','dwarf','elf','mead','throne','tower','dungeon','mine','magitek','opera','casino','stable','narshe','zozo']
def all_maps():
    for k in [k for k in ORDER if k in B]+[k for k in B if k not in ORDER]:
        b=B[k]
        for m in b['maps']: yield k,b,m
if __name__=='__main__':
    import json
    for k,b,m in all_maps():
        if len(sys.argv)>1 and k not in sys.argv[1:]: continue
        r=room4.check(m); print(m['key'],'OK' if r['ok'] else 'FAIL',r['rooms'],f"use {r['usesOk']}/{r['usesTotal']}")
        for i in r['issues']: print('   ',i)
        print('\n'.join('    '+row for row in r['grid']))
        im=room4.compose(m); im.save(f'/tmp/j8v5/v5_{m["key"]}.png'); im.resize((im.width*2,im.height*2),0).save(f'/tmp/j8v5/x2v5_{m["key"]}.png')
