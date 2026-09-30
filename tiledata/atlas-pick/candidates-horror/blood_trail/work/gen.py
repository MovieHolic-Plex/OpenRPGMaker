import sys
sys.path.insert(0, '/home/main/.t3/worktrees/rpg-zzu/t3code-8b4b09de-jp-pick/tiledata/atlas-pick/candidates-horror/blood_pool/work')
from blood import *
SLUG = 'blood_trail'
W = 32
def streak(g, x0, x1, ys, tones, wrap=True):
    """ys: x마다 (위y, 두께) 를 돌려주는 함수, tones=(위, 속, 아래)"""
    for x in range(x0, x1+1):
        top, th = ys(x)
        for k in range(th):
            c = tones[0] if k == 0 else (tones[2] if k == th-1 else tones[1])
            g.put(x, top+k, c, wrap=wrap)
def bleed_pass(g):
    G0 = g.copy()
    for y in range(g.H):
        for x in range(g.w):
            if G0.get(x, y) != '.': continue
            for dx, dy in ((-1,0),(1,0),(0,-1),(0,1),(1,1),(-1,-1)):
                if G0.get((x+dx) % g.w, y+dy) in '012345' and 0 <= y+dy < g.H:
                    g.put(x, y, '$'); break
def base(g, tone=('4','3','2'), main_th=lambda x: 3, low=None):
    # 주 줄: 가로 끝까지(x=0 과 x=31 이 같다), 두께가 3↔2 로 살짝 출렁인다
    def ys(x):
        wob = {0:0,1:0,2:0,3:0,4:0,5:1,6:1,7:1,8:1,9:0,10:0,11:0,12:0}.get(x % 16 if x < 16 else (x-16) % 16, 0)
        return (7 + wob, 3 if (x % 8) not in (2, 3, 4) else 2)
    # 끝 열(0, 31)은 같은 값이어야 하므로 wob 이 x=0,16 에서 0
    streak(g, 0, 31, ys, tone)
    # 끊겼다 이어지는 곳: x=13..17 을 마른 붓(위 한 줄만)으로
    for x in range(13, 18):
        top, th = ys(x)
        for k in range(th):
            if k != 1: g.put(x, top+k, '.')
        if x in (14, 16): g.put(x, top+1, tone[2])
    # 둘째 줄: 아래, x=3..21, 끝에서 얇아진다
    for x in range(3, 22):
        th = 2 if 6 <= x <= 16 else 1
        top = 11 if x < 16 else 12
        for k in range(th):
            g.put(x, top+k, tone[1] if k == 0 and th == 2 else tone[2])
        if th == 2: g.put(x, top, tone[0] if x in (7, 8, 12) else tone[1])
    for x in (4, 20, 21): g.put(x, 12, '.')
    # 셋째 줄: 위, x=12..29 마른 붓 (점선)
    for x in range(12, 30):
        if x % 3 != 2: g.put(x, 4, tone[1]); g.put(x, 5, tone[2]) if x % 3 == 0 else None
    g.pts(tone[0], 12, 4, 15, 4, 24, 4)
    # 튄 점
    g.pts(tone[1], 6, 3, 26, 13, 9, 13)
    return g
a = G(W, 16); base(a); bleed_pass(a)
b = G(W, 16); base(b, tone=('5','2','0')); bleed_pass(b)
for x in range(0, 32):
    for y in range(16):
        if b.get(x, y) == '2' and b.get(x, y-1) in '5.$' : pass
b.pts('5', 3, 7, 4, 7, 20, 7, 21, 7, 27, 7, 8, 11, 12, 11)
for x in range(0, 32, 1):
    if b.get(x, 10) in '0' and x % 2 == 0: b.put(x, 11, '-') if b.get(x, 11) == '.' else None
# C: 손톱으로 긁은 다섯 줄 (좌우 끝 열 동일, 가운데서 마른 붓처럼 끊김)
c = G(W, 16)
for n, y in enumerate((1, 4, 7, 10, 13)):
    for x in range(0, 32):
        c.put(x, y, '4' if x % 6 == n % 6 else '3', wrap=True)
        c.put(x, y+1, '2' if x % 4 != n % 4 else '1', wrap=True)
    # 가운데 끊김(줄마다 위치가 다르다)
    for x in range(11 + n*2, 15 + n*2):
        if x % 2 == 0: c.put(x, y, '.'); c.put(x, y+1, '.')
# 시작점 뭉침 하나: 끝 열 x=0,31 은 손대지 않음
c.pts('3', 8, 2, 9, 2, 19, 8)
# 빠진 손톱(창백) 마지막 줄 끝에 박혀 있다
c.pts('f', 20, 13, 21, 13, 21, 14); c.pts('d', 22, 13, 22, 14); c.pts('g', 20, 14)
bleed_c = c.copy()
for y in range(16):
    for x in range(32):
        if c.get(x, y) == '.' and (bleed_c.get((x-1) % 32, y-1) in '012345' if y > 0 else False) and x % 3 == 0:
            c.put(x, y, '$')
notes = {
 'A': ('끌고 간 자국: 주 줄이 좌우 끝까지 이어지고(두께 2~3 출렁임) 가운데서 마른 붓으로 끊겼다 이어짐, 아래 줄과 위 마른 붓 점선, 튄 점 셋, $ 번짐. 좌우 열이 같아 가로로 이어 붙음', a),
 'B': ('빛 대비 강화: 줄 윗선 blood 5 단으로 번쩍, 속은 2, 아랫선은 0 으로 검게, 접지 그림자 반투명 한 줄', b),
 'C': ('손톱 긁은 다섯 줄: 줄 두께 2 씩 다섯 갈래로 끌린 자국, 한 줄 끝에 빠진 손톱 조각이 떨어져 있다', c),
}
finish(SLUG, notes, LG)
