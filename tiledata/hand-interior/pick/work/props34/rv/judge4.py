import sys
sys.path.insert(0,'/home/main/z-project/rpg-zzu-v5-interior-props-34/scripts/content/hand-interior/props34')
import redraw as R, compare as C, r2_cabinet as RC
sys.path.insert(0,R.ROOT+'/scripts/content/hand-interior-pick'); import palette_snap
res=RC.build_cabinets(); ids=sys.argv[2:]
refs=[C.card('GOOD '+r,R.frames(r)[0],6) for r in ['bread shelf','wardrobe','globe']]+[C.card('BAD armchair',R.frames('armchair')[0],6)]
C.stack([C.row(refs),C.row([C.card(f'{k}',palette_snap.snap(res[k][0])[0],6) for j,k in enumerate(ids)])],sys.argv[1])
