import sys; sys.path.insert(0,'tiledata/atlas-pick/candidates-jp/station_entrance/work')
from j4_mk import *
def box(inner): return c("o"+inner+"o")
SH=c("-"+"~"*12+"-")
# ---- A: 카스가형, 강남 결
mats=["o ishi 0","k ishi 0","s ishi 2","m ishi 3","l ishi 4","h ishi 5","g moss 2","G moss 3","w washi 3"]
rows=[c("oo"),c("ohmo"),c("ohso"),c("o"*6),
 box("hlmmss"),box("hhlmmmss"),box("hhlllmmmss"),box("hhhllmmmmsss"),box("hhhlllmmmmmmss"),c("o"*16),
 box("ssssssssss"),
 box("lmmmmm"),box("kkmkks"),box("kkmkks"),box("kkmkks"),box("kkmkks"),box("smmmms"),
 c("o"*12),box("hllmmmmmss"),c("o"*12),
 box("hmms")[:0] or c("o"+"hmms"+"o"),c("o"+"hmms"+"o"),c("o"+"hmms"+"o"),c("o"+"lmms"+"o"),c("o"+"hmgs"+"o"),c("o"+"mGGs"+"o"),
 c("o"*10),box("hllmmmmmmsss"),box("lmmmmmmmmsss"),c("o"*14),SH]
rows=fit(rows,32)
w('stone_lantern','A',(1,2),"강남 결: 카스가형 석등 — 보주·6각 지붕돌·불 켜는 칸(창 둘)·중대·기둥·기단, 이끼 조금",mats,rows)
# ---- B: 불이 켜진 밤 — 창에 불빛, 주위로 번지는 빛, 발치 그림자
matsB=["o ishi 0","s ishi 1","m ishi 2","l ishi 3","h ishi 4","g moss 2","G moss 3","y washi 3","Y washi 4","Z washi 5","x washi 1"]
lit=lambda: box("lmyYZs")
rows=[c("oo"),c("ohlo"),c("ohso"),c("o"*6),
 box("hlmmss"),box("hhlmmmss"),box("hhllmmmmss"),box("hhhlmmmmmsss"),box("hhhllmmmmmmmss"),c("o"*16),
 box("%ssssssss%")[:0] or c("o"+"s"*10+"o"),
 box("lmmmmm"),lit(),lit(),lit(),lit(),box("smmmms"),
 c("o"*12),box("hllmmmmmss"),c("o"*12),
 c("o"+"hlms"+"o"),c("o"+"hlms"+"o"),c("o"+"hlms"+"o"),c("o"+"hlms"+"o"),c("o"+"hmgs"+"o"),c("o"+"mGGs"+"o"),
 c("o"*10),box("hllmmmmmmsss"),box("lmmmmmmmmsss"),c("o"*14),c("-"+"~"*12+"-")]
rows=fit(rows,32)
# 빛 번짐: 지붕 아래 창 좌우에 %
def put(rows,y,x,s):
    r=rows[y]; rows[y]=r[:x]+s+r[x+len(s):]
for y in (19,20,21):
    put(rows,y,3,'%'); put(rows,y,4,'%') if rows[y][4]=='.' else None
    put(rows,y,11,'%'); put(rows,y,12,'%') if rows[y][12]=='.' else None
w('stone_lantern','B',(1,2),"빛 구조: 불 켜진 창(washi 3단)·창 옆 빛 번짐·기둥은 한 단 어둡게",matsB,rows)

# ---- C: 네모 지붕 사각 석등(실루엣 재해석) — 납작한 사각 지붕, 큰 창 하나, 둥근 구슬 마디, 넓은 3단 기단
matsC=["o ishi 0","k ishi 0","s ishi 2","m ishi 3","l ishi 4","h ishi 5","g moss 2","G moss 3","w washi 3","W washi 4"]
rows=[c("oooo"),c("ohhlo")[:0] or c("o"+"hhls"+"o"),c("o"*8),
 c("o"+"hhhllmmmmmss"+"o")[:16], c("o"*16),
 c("o"+"hmmmmmmmmmmmms"[:14]+"o")[:16],
 c("o"*16),
 box("ssssssssss"),
 box("hkkkkkkkms"),box("hkkkkkkkms"),box("hkkkkkkkms"),box("hkkkkkkkms"),box("hkkkkkkkms"),
 c("o"*12),
 c("o"*6),c("o"+"hlls"+"o"),c("o"*4)[:0] or c("o"+"hlms"+"o"),c("o"+"hlms"+"o"),c("o"+"hmgs"+"o"),c("o"+"mGgs"+"o"),c("o"+"hlms"+"o"),
 c("o"*8),c("o"+"hlmmss"+"o"),c("o"*10),box("hllmmmmmmsss"),box("lmmmmmmmmsss"),c("o"*14),SH]
rows=fit(rows,32)
w('stone_lantern','C',(1,2),"실루엣 재해석: 납작한 사각 지붕·큰 창 하나(속 어둡게)·기둥·3단 기단, 이끼",matsC,rows)
