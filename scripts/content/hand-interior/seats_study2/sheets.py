# seat study 2 (사람 합격 2026-10-20) 그림 코드 사본 — 작업 폴더 /tmp/seats34/study2 경로를 그대로 둔다. 정본 그림은 tiledata/seats34/study2/art/, 판정은 human-verdicts.json.
import sys;sys.path.insert(0,'/tmp/seats34');import cmp,extract
B='/tmp/seats34/study2/out/batch/'
A=[['POS chair S','/home/main/z-project/rpg-zzu-interior-seats-34/tiledata/hand-interior/pick/candidates/chair_S/v5.png'],['POS hs-bench-row-s','jp_city_interior','hs-bench-row-s']]
def it(pid):
    return [['OLD '+pid,'atlas_biome_interior',pid],['NEW '+pid,B+pid.replace(' ','_')+'.png']]
r=sys.argv[1]
cmp.sheet(A+it('chair E')+it('chair W')+it('chair N'),f'/tmp/seats34/study2/atlas/j{r}-a.png',7)
cmp.sheet(A+it('armchair')+it('bar stool')+it('theater seat')+it('curule seat'),f'/tmp/seats34/study2/atlas/j{r}-b.png',6)
