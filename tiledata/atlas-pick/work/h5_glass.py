from h5_common import *
# murk 'yzYZ:;,' moon '@=<>/|' (@ dark?) 
def shard(c, pts, edge='|', fill='Y', hi='/'):
    """pts: list of (x,y) triangle vertices; 채움 + 밝은 가장자리"""
    xs=[p[0] for p in pts]; ys=[p[1] for p in pts]
    def inside(x,y):
        (x1,y1),(x2,y2),(x3,y3)=pts
        d=lambda a,b,cx,cy:(a[0]-cx)*(b[1]-cy)-(b[0]-cx)*(a[1]-cy)
        s1=d(pts[0],pts[1],x,y); s2=d(pts[1],pts[2],x,y); s3=d(pts[2],pts[0],x,y)
        return (s1>=0 and s2>=0 and s3>=0) or (s1<=0 and s2<=0 and s3<=0)
    cells=[(x,y) for y in range(min(ys),max(ys)+1) for x in range(min(xs),max(xs)+1) if inside(x,y)]
    S=set(cells)
    for (x,y) in cells: c.px(x,y,fill)
    for (x,y) in cells:
        if (x-1,y) not in S or (x,y-1) not in S: c.px(x,y,edge)
    for (x,y) in cells:
        if (x+1,y) not in S and (x,y+1) not in S: c.px(x,y,'y')
    return S
def base(c, v='A'):
    shard(c, [(1,9),(7,7),(4,14)], '|', 'Y')
    shard(c, [(6,2),(11,4),(7,8)], '|', 'z')
    shard(c, [(9,8),(14,10),(10,13)], '/', 'Y')
    shard(c, [(3,3),(5,3),(4,6)], '/', 'Z')
    c.px(12,6,'|'); c.px(13,7,'/'); c.px(8,12,'|'); c.px(2,12,'/'); c.px(14,13,'>')
c = C(16, 16); base(c)
save('broken_glass', 'h5-A', c, L, '푸르스름한 회색 파편 다섯 개가 한쪽에 몰림, 가장자리 한 줄만 밝음, 잔 조각 점')
c = C(16, 16); base(c)
for (x,y) in ((4,10),(5,9),(9,9),(8,4),(7,3),(12,5)): c.px(x,y,'%')
for x in range(2,14): c.px(x,15,'~') if c.g[15][x]=='.' else None
c.px(0,8,'%'); c.px(15,4,'%')
save('broken_glass', 'h5-B', c, L, '파편 모서리에 달빛 반짝임(%)이 튀고 아래에 옅은 그림자, 가장 큰 파편에 밝은 반사점')
c = C(16, 16)
shard(c, [(2,6),(12,5),(7,13)], '|', 'Y')
shard(c, [(9,1),(14,3),(11,5)], '/', 'z')
c.px(5,8,'@'); c.px(6,8,'@'); c.px(6,9,'@'); c.px(8,8,'@'); c.px(9,9,'@')  # 눈처럼 보이는 어두운 구멍 두 개 + 입
for (x,y) in ((5,7),(6,7)): c.px(x,y,'|')
for (x,y) in ((8,7),(9,7)): c.px(x,y,'|')
c.px(7,11,'@'); c.px(6,11,'@')
c.px(11,7,'T'); c.px(11,8,'S'); c.px(12,9,'S')
save('broken_glass', 'h5-C', c, L, '큰 삼각 파편 하나가 얼굴처럼 어두운 눈구멍 둘과 입 자국을 품고, 작은 파편과 피 한 방울이 곁에')
