import sys; sys.path.insert(0, '.')
from w23_px import *

ANT = dict(base=[(13,12),(12,10),(11,7)], main=[(11,7),(11,4),(12,2)], t1=[(12,10),(8,9),(4,7)], t2=[(11,7),(7,5),(4,3)], t3=[(11,4),(9,2)])

def antlers(g, spec, tines=None):
    m = set()
    for k, pts in spec.items():
        m |= line(pts, 2 if k in ('base','main','t1','t2') else 1)
    m = mirror(m)
    shade(g, m, 'pine', 4, outline=False, hi=1, lo=1)
    return m

def plaque_shield(g):
    spec = {y: [(7, 24)] for y in range(10, 22)}
    for i, y in enumerate(range(22, 31)):
        spec[y] = [(7 + (i+1)//2, 24 - (i+1)//2)]
    m = rows_mask(spec)
    shade(g, m, 'dwood', 3, out_lvl=0, hi=2, lo=2)
    return m

def head(g):
    spec = {12:[(12,19)],13:[(11,20)],14:[(11,20)],15:[(11,20)],16:[(11,20)],17:[(12,19)],18:[(12,19)],19:[(13,18)],
            20:[(13,18)],21:[(13,18)],22:[(13,18)],23:[(12,19)],24:[(12,19)],25:[(12,19)],26:[(13,18)]}
    m = rows_mask(spec)
    # 왼쪽 반 밝게, 오른쪽 반 어둡게 (윗왼쪽 빛), 가장자리 윤곽
    for (x, y) in m:
        g.set(x, y, 'wood:6' if x <= 15 else 'wood:5')
    for (x, y) in m:
        for (dx, dy) in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in m and g.get(x+dx, y+dy) is None: g.set(x+dx, y+dy, 'wood:1')
    # 귀
    ear = mirror(rows_mask({13:[(8,10)],14:[(7,10)],15:[(7,10)],16:[(8,10)],17:[(9,10)]}))
    for (x, y) in ear: g.set(x, y, 'wood:5' if x < 16 else 'wood:4')
    for (x, y) in ear:
        for (dx, dy) in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in ear and (x+dx, y+dy) not in m and g.get(x+dx, y+dy) in (None,) : g.set(x+dx, y+dy, 'wood:1')
    for (x, y) in ((8,14),(9,14),(8,15),(9,15),(22,14),(23,14),(22,15),(23,15)): g.set(x, y, 'clay:4' if x < 16 else 'clay:3')
    # 눈·코·이마 밝은 줄
    for (x, y, k) in ((13,15,'black:1'),(18,15,'black:1'),(13,14,'linen:5'),
                      (14,24,'black:1'),(15,24,'black:1'),(16,24,'black:1'),(17,24,'black:1'),(14,25,'black:2'),(15,25,'black:2'),(16,25,'black:2'),(17,25,'black:2'),
                      
                      (15,26,'wood:2'),(16,26,'wood:2')):
        g.set(x, y, k)
    for (x, y) in rows_mask({23:[(12,19)],24:[(12,19)],25:[(12,19)]}): g.set(x, y, 'linen:3' if x <= 15 else 'linen:2')
    for (x,y) in ((14,24),(15,24),(16,24),(17,24),(15,25),(16,25)): g.set(x,y,'black:1')
    return m

def build_D():
    g = G(); plaque_shield(g); head(g)
    m = antlers(g, ANT)
    # 걸이 끈: 못 -> 판 위 두 모서리
    g.set(15, 1, 'iron:5'); g.set(16, 1, 'iron:5'); g.set(15, 2, 'iron:3'); g.set(16, 2, 'iron:3')
    cord(g, (15, 3), (13, 9)); cord(g, (16, 3), (18, 9), 'straw:2')
    shadow(g, 1, 1, 1)
    return g

def build_E():
    """어깨까지 박제한 사슴: 판 없이 목·가슴이 벽에서 내민다. 큰 6뿔."""
    g = G()
    neck = rows_mask({18:[(12,19)],19:[(12,19)],20:[(11,20)],21:[(11,20)],22:[(10,21)],23:[(10,21)],24:[(9,22)],25:[(8,23)],26:[(7,24)],27:[(6,25)],28:[(6,25)],29:[(5,26)],30:[(5,26)]})
    for (x, y) in neck:
        g.set(x, y, 'wood:5' if x <= 12 else 'wood:4' if x <= 18 else 'wood:3')
    # 목 털결: 아래로 짧은 줄
    for (x, y) in ((14,22),(14,23),(17,25),(17,26),(11,26),(11,27),(21,27),(21,28),(15,29),(15,30),(9,29),(23,29)):
        g.set(x, y, 'wood:3' if x < 16 else 'wood:2')
    for (x, y) in neck:
        for (dx, dy) in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in neck and g.get(x+dx, y+dy) is None and dy <= 0: g.set(x+dx, y+dy, 'wood:1')
    # 아래 자른 면: 짙은 받침 판 한 줄
    for x in range(4, 28): g.set(x, 31, 'dwood:1')
    h = rows_mask({6:[(12,19)],7:[(11,20)],8:[(11,20)],9:[(11,20)],10:[(12,19)],11:[(12,19)],12:[(13,18)],13:[(13,18)],14:[(13,18)],15:[(13,18)],16:[(12,19)],17:[(12,19)]})
    for (x, y) in h: g.set(x, y, 'wood:6' if x <= 15 else 'wood:5')
    for (x, y) in h:
        for (dx, dy) in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in h and g.get(x+dx, y+dy) in (None,): g.set(x+dx, y+dy, 'wood:1')
    ear = mirror(rows_mask({7:[(8,10)],8:[(7,10)],9:[(7,10)],10:[(8,10)],11:[(9,10)]}))
    for (x, y) in ear: g.set(x, y, 'wood:5' if x < 16 else 'wood:4')
    for (x, y) in ear:
        for (dx, dy) in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in ear and (x+dx, y+dy) not in h and g.get(x+dx, y+dy) is None: g.set(x+dx, y+dy, 'wood:1')
    for (x, y) in ((8,8),(9,8),(22,8),(23,8)): g.set(x, y, 'clay:4' if x < 16 else 'clay:3')
    for (x, y, k) in ((13,9,'black:1'),(18,9,'black:1'),(13,8,'linen:5')): g.set(x, y, k)
    for (x, y) in rows_mask({16:[(13,18)],17:[(13,18)]}): g.set(x, y, 'linen:3' if x <= 15 else 'linen:2')
    for (x, y) in ((14,16),(15,16),(16,16),(17,16),(15,17),(16,17)): g.set(x, y, 'black:1')
    # 뿔: 6뿔
    a = dict(base=[(13,6),(12,4),(11,2)], t1=[(12,4),(8,4),(4,2)], t2=[(11,2),(8,1)], t3=[(12,5),(8,6),(5,7)])
    m = set()
    for k, pts in a.items(): m |= line(pts, 2 if k == 'base' else 1)
    m = mirror(m); shade(g, m, 'pine', 4, outline=False)
    g.set(15, 0, 'iron:5'); g.set(16, 0, 'iron:5')
    cord(g, (15, 1), (13, 5)); cord(g, (16, 1), (18, 5), 'straw:2')
    shadow(g, 1, 1, 1)
    return g

def build_F():
    """유럽식 두개골 마운트: 표백한 두개골 + 굵은 뿔, 동그란 참나무 판. 걸이 고리."""
    g = G(); cx = cy = 19.5; R = 10.5
    plaque = {(x, y) for y in range(32) for x in range(32) if (x+.5-16)**2 + (y+.5-cy)**2 <= 10.4**2}
    for (x, y) in plaque:
        dx, dy = x+.5-16, y+.5-cy; d = math.hypot(dx, dy); t = (-dx-dy)/(d or 1)
        g.set(x, y, 'dwood:5' if (d > 8.4 and t > .35) else 'dwood:1' if (d > 8.4 and t < -.35) else 'dwood:3')
    for (x, y) in plaque:
        for (dx, dy) in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in plaque and g.get(x+dx, y+dy) is None: g.set(x+dx, y+dy, 'dwood:0')
    sk = rows_mask({14:[(13,18)],15:[(12,19)],16:[(12,19)],17:[(12,19)],18:[(13,18)],19:[(14,17)],20:[(14,17)],21:[(14,17)],22:[(14,17)],23:[(13,18)],24:[(13,18)]})
    for (x, y) in sk: g.set(x, y, 'linen:5' if x <= 15 else 'linen:4')
    for (x, y) in sk:
        for (dx, dy) in ((1,0),(-1,0),(0,1),(0,-1)):
            if (x+dx, y+dy) not in sk and g.get(x+dx, y+dy) is not None and (x+dx, y+dy) not in sk and g.get(x+dx,y+dy)[:6] == 'dwood:': g.set(x+dx, y+dy, 'linen:1')
    for (x, y) in ((13,17),(14,17),(13,18),(17,17),(18,17),(18,18)): g.set(x, y, 'black:1')
    for (x, y) in ((15,22),(16,22),(15,23),(16,23)): g.set(x, y, 'black:2')
    for (x, y) in ((15,14),(16,14),(15,15),(16,15)): g.set(x, y, 'linen:6' if x == 15 else 'linen:5')
    for (x, y) in ((14,24),(15,24),(16,24),(17,24)): g.set(x, y, 'linen:2')
    a = dict(base=[(13,14),(11,12),(9,9)], main=[(9,9),(7,6),(6,3)], t1=[(11,12),(6,11),(3,10)], t2=[(9,9),(4,8)], t3=[(7,6),(10,4)])
    m = set()
    for k, pts in a.items(): m |= line(pts, 2 if k in ('base','main') else 1)
    m = mirror(m); shade(g, m, 'pine', 5, outline=False)
    # 걸이 고리 + 못
    for (x, y) in ((15,1),(16,1),(14,2),(17,2),(14,3),(17,3),(15,4),(16,4)): g.set(x, y, 'iron:5' if x < 16 else 'iron:3')
    g.set(15, 0, 'iron:4'); g.set(16, 0, 'iron:4')
    for y in range(5, 9): g.set(15, y, 'straw:3'); g.set(16, y, 'straw:2')
    shadow(g, 1, 1, 1)
    return g

if __name__ == '__main__':
    for w in (sys.argv[1:] or ['D']):
        g = {'D': build_D, 'E': build_E, 'F': build_F}[w](); g.dump(); g.write(f'../w23-{w}.pxg', f'w23-{w}')
