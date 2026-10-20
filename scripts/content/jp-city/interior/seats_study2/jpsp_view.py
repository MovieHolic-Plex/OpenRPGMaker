# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys,json
sys.path.insert(0,'/tmp/seats34'); import cmp
ids=sys.argv[2].split(','); out=sys.argv[1]; s=int(sys.argv[3]) if len(sys.argv)>3 else 6
anch=[['POS chair S','/home/main/z-project/rpg-zzu-interior-seats-34/tiledata/hand-interior/pick/candidates/chair_S/v5.png'],['POS hs-bench-row-s','jp_city_interior','hs-bench-row-s']] if '--anch' in sys.argv else []
specs=anch[:]
for i in ids: specs+= [['OLD '+i,'jp_city_interior',i],['NEW '+i,'/tmp/seats34/study2/out/batch/'+i+'.png']]
cmp.sheet(specs,out,s)
