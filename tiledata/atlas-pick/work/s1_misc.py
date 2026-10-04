import sys, random; sys.path.insert(0,'tiledata/atlas-pick/work')
from s1lib import G as _G
class G(_G):
    def hl(s, y, x, w, c): _G.hl(s, x, y, w, c)   # 이 파일은 hl(행, 열, 폭, 글자)
# ---------- 운동장 흙 + 트랙 선 ----------
YM = {'m':('undo',4),'l':('undo',5),'L':('undo',6),'d':('undo',3),'D':('undo',2)}
def yard(v):
    g = G(16,16,YM); rnd = random.Random({'A':11,'B':22,'C':33}[v])
    g.rect(0,0,16,16,'m')
    n = {'A':14,'B':16,'C':12}[v]
    for _ in range(n):
        g.px(rnd.randrange(16),rnd.randrange(16),'l')
    for _ in range({'A':9,'B':14,'C':8}[v]):
        g.px(rnd.randrange(16),rnd.randrange(16),'d')
    if v=='B':
        for _ in range(5): g.px(rnd.randrange(16),rnd.randrange(16),'L')
        for _ in range(2): g.px(rnd.randrange(16),rnd.randrange(16),'D')
    if v=='C':   # 굵은 결: 가로 쓸린 자국
        g.hl(3,2,4,'l'); g.hl(10,11,5,'l'); g.hl(9,6,3,'d'); g.hl(1,13,3,'d')
    # 발자국 하나(가운데 안쪽, 가장자리 안 건드림)
    g.rows(6,5,["dd ","dd ","   ","  d","  dd"]) if v!='C' else g.rows(5,6,["dd","dd"," ","  dd","  dd"])
    return g
TM = {'w':('vwhite',5),'x':('vwhite',4),'p':('washi',5),'q':('vwhite',3)}
def track(v):
    g = G(16,16,TM); rnd = random.Random({'A':5,'B':6,'C':7}[v])
    if v=='A':
        g.rect(0,7,16,2,'w'); g.hl(6,0,16,'x') if False else None
        g.hl(9,0,16,'q') if False else None
        for x in (2,5,9,13): g.px(x,6,'p')
        for x in (1,7,11,14): g.px(x,9,'p')
        g.px(4,5,'x'); g.px(12,10,'x')
    elif v=='B':
        g.rect(0,7,16,2,'w'); g.hl(9,0,16,'q')      # 아랫줄 한 단 어둡게(그늘)
        for x in (0,3,6,10,13): g.px(x,6,'p')
        for x in (2,5,8,12,15): g.px(x,10,'p')
        g.px(4,5,'x'); g.px(9,11,'x'); g.px(14,5,'x')
    else:
        g.rect(0,6,16,3,'w'); g.hl(8,0,16,'q'); g.hl(6,0,16,'x') if False else None
        for x in (1,4,8,11,14): g.px(x,5,'p')
        for x in (3,6,10,13): g.px(x,9,'p')
    return g
NY = {'A':'A: 옅은 마사토 5단, 밝은 모래알·어두운 알갱이 흩기, 신발 자국 하나 안쪽',
      'B':'B: 명암 강화 — 알갱이 대비 큼(가장 밝은 알·가장 어두운 알 섞음), 사방 이음 유지',
      'C':'C: 가로로 쓸린 결 자국 + 자국 두 개, 알갱이 적게'}
NT = {'A':'A: 석회 흰 선 2px 가로, 위·아래 가루 점, 좌우 끝 그대로 이어짐, 투명 배경',
      'B':'B: 선 아랫줄 그늘 한 단, 가루 번짐 점 더 많이',
      'C':'C: 선을 3px로 두껍게, 가장자리 가루 점'}
# ---------- 배식대 48x32 ----------
SM = {'a':('tray',5),'b':('tray',4),'c':('tray',3),'d':('tray',2),'e':('tray',1),'f':('tray',0),
      'W':('vwhite',5),'w':('vwhite',4),'x':('vwhite',3),'R':('vred',3),'r':('vred',4),'O':('vyellow',4),'Y':('vyellow',5),
      'G':('vgreen',4),'g':('vgreen',3),'k':('vblack',3)}
def counter(v):
    g = G(48,32,SM)
    # 유리 가림막(뒤쪽 위): y2..8
    g.rect(1,3,46,6,'&'); g.hl(2,1,46,'b'); g.hl(9,1,46,'c'); g.vl(1,2,8,'c'); g.vl(46,2,8,'d')
    if v=='B':
        for x in (6,7,20,21,35): g.px(x,4,'W')
    # 윗면 y10..21 (¾): 대 상판
    g.rect(0,10,48,11,'b'); g.hl(10,0,48,'a'); g.hl(20,0,48,'c'); g.hl(21,0,48,'d')
    g.vl(0,10,11,'a') ; g.vl(47,10,11,'d')
    # 배식통 셋
    pans = [(3,'W','x'),(18,'r','R'),(33,'G','g')] if v!='C' else [(3,'W','x'),(18,'O','Y'),(33,'G','g')]
    for px0,c1,c2 in pans:
        g.rect(px0,12,12,7,'e'); g.rect(px0+1,13,10,5,c1)
        g.hl(13,px0+1,10,c2); g.hl(19,px0,12,'f')
        g.hl(11,px0,12,'a') if False else None
        # 김
        g.pts('W',px0+3,9,px0+8,10) if v!='B' else g.pts('W',px0+3,9,px0+4,9,px0+8,10)
    # 국자: 국 통에서 위로
    g.vl(25,10,4,'f'); g.px(24,10,'f'); g.rect(24,14,3,2,'d')
    if v=='C': g.rect(24,14,3,2,'e')
    # 앞판 y22..29
    g.rect(0,22,48,8,'c'); g.hl(22,0,48,'b'); g.vl(0,22,8,'b'); g.rect(46,22,2,8,'d'); g.vl(47,22,8,'e')
    for x in (12,24,36): g.vl(x,23,6,'d')      # 문 틈
    g.hl(29,0,48,'e'); g.hl(28,0,48,'d') if v=='B' else None
    g.pts('f',5,24,17,24,29,24,41,24)          # 손잡이
    # 아랫 그림자
    g.hl(30,1,46,'~'); g.hl(31,2,44,'-')
    return g
NC = {'A':'A: 스테인리스 대에 배식통 셋(흰 밥·붉은 국·초록 반찬)+김 점, 국자, 뒤 유리 가림막 &, 윗면 ¾',
      'B':'B: 명암 강화 — 유리 하이라이트 점, 앞판 아랫줄 더 어둡게, 김 점 더 많이',
      'C':'C: 국을 노란 카레로, 국자를 어두운 쇠 국자 몸통으로 재해석(같은 칸수)'}
# ---------- 골격 모형 16x32 ----------
KM = {'B':('vwhite',5),'b':('vwhite',4),'c':('vlinen',4),'d':('vlinen',3),'e':('vlinen',2),'k':('vblack',3),
      'm':('mmetal',4),'n':('mmetal',3),'o':('mmetal',2),'p':('mmetal',1)}
SK = [
"................",
"......BBBBBB....",
".....BBBBBBBB...",
".....BBBBBBBBc..",
".....BkkBBkkBc..",
".....BkkBBkkBc..",
".....BBBkkBBBc..",
"......BBBBBBc...",
".......bdbdb....",
"........c.......",
"..B.BBBBcccc.c..",
"..B.B.B.c.c.c.c.",
"..B.BBBBcccc.c..",
"..B.B.B.c.c.c.c.",
"..B.BBBBcccc.c..",
"..B..BBBcccc.c..",
"..B...B.c.c..c..",
"..B...BBcc...c..",
"..c..BBBccc..d..",
"..d..BBkBkc.....",
"......BB.cc.....",
"......B..c......",
"......B..c......",
".....BB..cc.....",
"......B..c......",
"......B..c......",
"......B..c......",
".....BB..cd.....",
".....mmnnmm.....",
"...nonnnnnnon...",
"...pp..pp..pp...",
"....--------....",
]
def skeleton(v):
    g = G(16,32,KM)
    g.rows(0,0,SK)
    g.vl(8,20,8,'n')                     # 받침 기둥(가운데 뒤)
    if v=='B':
        for y in (11,13,15): g.hl(y,4,4,'d')       # 갈비 아랫면 연한 그늘
        g.vl(7,1,7,'b') if False else None
        g.hl(31,3,10,'~')
    if v=='C':
        g.rect(4,0,10,1,'.'); g.hl(0,5,6,'B'); g.rect(4,1,1,6,'B'); g.rect(13,3,1,3,'c')   # 두개골 더 크게
        g.px(14,5,'.') ; g.rect(2,10,1,9,'.'); g.rect(1,10,1,7,'B'); g.rect(14,10,1,7,'.'); g.rect(14,10,1,8,'c')
    return g
NK = {'A':'A: 교과서 골격 — 큰 두개골, 갈비 4줄, 골반, 팔다리 1px 뼈, 쇠 기둥·바퀴 받침',
      'B':'B: 명암 강화 — 뼈 아랫면 연한 그늘 줄, 받침 접지 그림자',
      'C':'C: 두개골을 더 크게 과장, 팔을 몸에서 떼어 벌림'}
# ---------- 공 바구니 16x16 ----------
BM = {'m':('mmetal',5),'n':('mmetal',3),'o':('mmetal',2),'p':('mmetal',1),
      'r':('vred',4),'R':('vred',2),'W':('vwhite',5),'w':('vwhite',3),'Y':('vyellow',5),'y':('vyellow',3),'k':('vblack',3)}
def basket(v):
    g = G(16,16,BM)
    # 공 y2..6 (바구니 위로 솟음)
    g.rect(3,3,4,4,'r'); g.px(3,3,'.'); g.px(6,3,'.'); g.hl(5,3,4,'R'); g.vl(4,3,4,'R') if False else None
    g.px(4,4,'W') if False else None
    g.rect(7,2,4,4,'W'); g.px(7,2,'.'); g.px(10,2,'.'); g.hl(4,7,4,'w'); g.px(9,3,'w')
    g.rect(10,4,4,4,'Y'); g.px(10,4,'.'); g.px(13,4,'.'); g.px(11,5,'y'); g.hl(7,10,4,'y')
    if v=='B': g.px(5,4,'W'); g.px(8,3,'m'); g.px(11,5,'W')
    if v=='C': g.rect(1,4,3,3,'r'); g.px(1,4,'.'); g.hl(6,1,3,'R')
    # 바구니 y7..12
    g.rect(1,7,14,6,'n'); g.hl(7,1,14,'m'); g.hl(12,1,14,'p'); g.vl(14,7,6,'o')
    for x in (3,5,7,9,11,13): g.vl(x,8,4,'p')
    g.hl(9,1,14,'p'); 
    # 바퀴
    g.rect(2,13,2,2,'k'); g.rect(12,13,2,2,'k'); g.px(2,13,'o'); g.px(12,13,'o')
    g.hl(14,4,8,'-') if v!='B' else g.hl(15,2,12,'~')
    return g
NB = {'A':'A: 쇠 바구니 수레(세로 격자), 농구공 주황·배구공 흰·노란 공, 바퀴 점',
      'B':'B: 명암 강화 — 공 하이라이트 점, 접지 그림자',
      'C':'C: 공을 왼쪽에 한 개 더 쌓음'}
if __name__=='__main__':
    for v in 'ABC':
        yard(v).write('schoolyard',f's1-{v}',NY[v]); track(v).write('track_line',f's1-{v}',NT[v])
        counter(v).write('serving_counter',f's1-{v}',NC[v]); skeleton(v).write('skeleton_model',f's1-{v}',NK[v])
        basket(v).write('ball_basket',f's1-{v}',NB[v])
