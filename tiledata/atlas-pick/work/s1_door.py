import sys; sys.path.insert(0,'tiledata/atlas-pick/work')
from s1lib import G
from s1_wall import wall_cols, MATS as WM

DM = {
 'A': {'f':('vdwood',3),'F':('vdwood',5),'D':('vdwood',1),'p':('vpine',3),'P':('vpine',4),'q':('vpine',5),'e':('vpine',2),'g':('mglass',4),'G':('mglass',5),'i':('mglass',2),'j':('mglass',6),'y':('vbrass',4),'z':('vbrass',2),'k':('mmetal',1)},
 'B': {'f':('vdwood',3),'F':('vdwood',5),'D':('vdwood',1),'p':('vpine',3),'P':('vpine',4),'q':('vpine',6),'e':('vpine',1),'g':('mglass',4),'G':('mglass',6),'i':('mglass',2),'j':('mglass',7),'y':('vbrass',5),'z':('vbrass',1),'k':('mmetal',1),'n':('vpine',2)},
 'C': {'f':('hinoki',2),'F':('hinoki',4),'D':('hinoki',0),'p':('hinoki',3),'P':('hinoki',5),'q':('hinoki',6),'e':('hinoki',1),'g':('mglass',4),'G':('mglass',5),'i':('mglass',2),'j':('mglass',6),'y':('vbrass',4),'z':('vbrass',2),'k':('mmetal',1)},
}
NOTE = {'A':'A: 소나무 미닫이 한 짝 + 어두운 나무 문틀, 위쪽 세로 유리창, 손잡이 홈, 옆 벽은 hall_wall A 와 같은 레일·징두리·걸레받이',
        'B':'B: 명암 강화 — 왼쪽 위 밝은 면·오른쪽 아래 어두운 면, 유리 반사 &, 문틀 안쪽 그늘, 문 밑 접지 그림자, 벽은 hall_wall B',
        'C':'C: 히노키 색 문 + 가로 살대 무늬 위 유리 두 칸(같은 칸수에서 유리 위치·문살 재해석), 벽은 hall_wall C'}
def build(v):
    m = dict(DM[v]); m.update(WM[v])
    g = G(32,32,m)
    wall_cols(g,0,3,v); wall_cols(g,29,32,v)      # 문 옆 벽띠
    # 틀 (열 3-4, 27-28 / 윗틀 행 2-4)
    g.rect(3,0,26,2,'C' if v!='C' else 'C')
    g.rect(3,2,26,3,'f'); g.hl(3,2,26,'F'); g.hl(3,4,26,'D')
    g.rect(3,5,2,27,'f'); g.rect(27,5,2,27,'f'); g.vl(3,5,27,'F'); g.vl(28,5,27,'D')
    # 문짝 (열 5-26, 행 5-30)
    g.rect(5,5,22,26,'p')
    g.hl(5,5,22,'P'); g.vl(5,5,26,'P'); g.vl(26,5,26,'e');     g.hl(30,5,22,'e'); g.hl(31,3,26,'D')
    # 문 아래 걸레받이 판(리놀륨 킥플레이트는 hall_wall 걸레받이 행과 맞춤 29-30)
    g.hl(29,5,22,'e'); g.hl(28,5,22,'P')
    # 유리창 (세로 긴 네모)
    if v == 'C':
        g.rect(8,7,7,7,'g'); g.rect(8,15,7,6,'g')
        for x in range(8,15): g.px(x,14,'e')
        g.hl(6,6,0,'e')
        g.rect(7,6,9,1,'q'); g.rect(7,21,9,1,'e'); g.vl(7,6,16,'q'); g.vl(15,6,16,'e'); g.rect(8,14,7,1,'e')
        g.hl(8,7,7,'i'); g.vl(8,7,14,'i') 
        g.pts('j',13,9,13,10,12,9)
    else:
        g.rect(8,7,7,14,'g'); g.rect(7,6,9,1,'e'); g.rect(7,21,9,1,'q'); g.vl(7,6,16,'e'); g.vl(15,6,16,'q')
        g.hl(8,7,7,'i'); g.vl(8,7,14,'i')
        g.pts('G',9,9,9,10,10,9); g.pts('j',12,8,13,8)
        if v=='B':
            for k in range(4): g.px(9+k*1,17-k,'j')
    # 손잡이 홈 (오른쪽)
    g.rect(21,15,2,6,'e'); g.vl(21,15,6,'e'); g.vl(22,15,6,'y')
    g.pts('z',22,21)
    if v=='B':
        g.rect(5,29,22,1,'e'); g.rect(5,30,22,1,'D'); g.rect(4,31,24,1,'~')
        g.vl(25,5,26,'e'); g.vl(26,5,26,'D')
    # 가로 살대 (C)
    if v=='C':
        for y in (24,26): g.hl(6,y,20,'P')
        g.hl(25,6,20,'e') if False else None
    # 바닥 문턱
    return g
if __name__ == '__main__':
    for v in 'ABC':
        build(v).write('hall_door', f's1-{v}', NOTE[v])
