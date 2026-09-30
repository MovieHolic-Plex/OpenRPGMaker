import math, sys
sys.path.insert(0, '.')
from w23_px import G, shadow
P = 'python3'
def wedge(dx, dy, n=20):
    a = math.degrees(math.atan2(dx, -dy)) % 360   # 위쪽 0도, 시계 방향
    return int(((a + 180/n) % 360) // (360/n))

def face(g, cx, cy, R, ring, col, n=20):
    """ring: [(반지름 안쪽 경계 d, 종류)] 바깥에서 안으로. col: 색 열쇠 사전"""
    for y in range(g.h):
        for x in range(g.w):
            dx, dy = x + .5 - cx, y + .5 - cy
            d = math.hypot(dx, dy)
            if d > R: continue
            i = wedge(dx, dy, n) % 2
            for lim, kind in ring:
                if d >= lim:
                    g.set(x, y, col[kind][i] if isinstance(col[kind], tuple) else col[kind]); break

def bezel_light(g, cx, cy, R, w, light, dark, mid):
    for y in range(g.h):
        for x in range(g.w):
            dx, dy = x + .5 - cx, y + .5 - cy
            d = math.hypot(dx, dy)
            if R - w <= d <= R:
                t = (-dx - dy) / (d or 1)   # 왼쪽 위 = +
                g.set(x, y, light if t > .45 else dark if t < -.45 else mid)

def nail_cord(g, cx, top, cord='straw:3', nail='iron:5', span=4, nailhi='iron:6'):
    # 못 머리(2px) + 끈이 못에서 판 위 모서리 두 곳으로 내려가는 V
    nx = int(cx)
    g.set(nx-1, top, nail); g.set(nx, top, nailhi)
    for k in range(1, span+1):
        for sx in (nx-1-k, nx+k):
            if g.get(sx, top+k) is None: g.set(sx, top+k, cord)
    return

# ---- D : 정석 20쐐기, 22px, 색을 눌러서 ----
def build_D():
    g = G(); cx = cy = 16.0; R = 11.0
    col = {'sur': 'black:1', 'dbl': ('red:2', 'green:2'), 'sng': ('black:3', 'linen:4'),
           'trb': ('red:2', 'green:2'), 'bull': 'green:2', 'eye': 'red:2'}
    # 검정 테두리 (숫자 띠) 를 바깥에 둔다
    ring = [(R-1.4, 'sur'), (R-3.2, 'dbl'), (R-5.6, 'sng'), (R-7.2, 'trb'), (R-9.4, 'sng'), (1.6, 'bull'), (0, 'eye')]
    ring = [(9.6, 'sur'), (8.0, 'dbl'), (6.2, 'sng'), (4.9, 'trb'), (2.7, 'sng'), (1.2, 'bull'), (0, 'eye')]
    face(g, cx, cy, R, ring, col)
    bezel_light(g, cx, cy, R, 1.3, 'black:4', 'black:1', 'black:2')
    # 바깥 테 안쪽의 숫자 점: 쐐기 중심마다 한 점(뜻 있는 점)
    for i in range(20):
        a = math.radians(i * 18)
        x = int(cx + 9.5*math.sin(a)); y = int(cy - 9.5*math.cos(a))
        if g.get(x, y) == 'black:1': g.set(x, y, 'linen:3')
    nail_cord(g, cx, 1, span=4)
    shadow(g, 1, 1, 1)
    return g

#EF

def dart(g, tx, ty):
    """오른쪽 위로 뻗은 다트: 촉(쇠) 1, 몸통(놋쇠) 2, 깃 붉은 2x2 (3D 아님, 옆모습)"""
    g.set(tx, ty, 'iron:5'); g.set(tx+1, ty-1, 'brass:5'); g.set(tx+2, ty-2, 'brass:4')
    for (x, y, k) in ((tx+3, ty-3, 'red:4'), (tx+4, ty-3, 'red:3'), (tx+3, ty-4, 'red:5'), (tx+4, ty-4, 'red:3'), (tx+5, ty-5, 'red:2')):
        g.set(x, y, k)

def build_E():
    g = G()
    # 네모 나무 틀 24x24 (모서리 1칸 깎음), 위·왼 밝게 / 아래·오른 어둡게
    x0, y0, x1, y1 = 4, 4, 27, 27
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if (x in (x0, x1)) and (y in (y0, y1)): continue
            edge_l, edge_t, edge_r, edge_b = x == x0, y == y0, x == x1, y == y1
            k = 'wood:4'
            if edge_r or edge_b: k = 'wood:1'
            elif edge_l or edge_t: k = 'wood:2'
            elif x == x0+1 or y == y0+1: k = 'wood:7'
            elif x == x1-1 or y == y1-1: k = 'wood:3'
            else: k = 'wood:6'
            g.set(x, y, k)
    # 안쪽 우묵(짙은 나무): 틀 3칸 안
    for y in range(y0+3, y1-2):
        for x in range(x0+3, x1-2):
            if x == x0+3 or y == y0+3: g.set(x, y, 'dwood:0')
            else: g.set(x, y, 'dwood:2')
    cx = cy = 16.0; R = 8.6
    col = {'sur': 'black:1', 'dbl': ('red:2', 'green:2'), 'sng': ('black:3', 'linen:4'),
           'trb': ('red:2', 'green:2'), 'bull': 'green:2', 'eye': 'red:2'}
    ring = [(7.7, 'sur'), (6.5, 'dbl'), (4.9, 'sng'), (3.9, 'trb'), (2.3, 'sng'), (1.2, 'bull'), (0, 'eye')]
    face(g, cx, cy, R, ring, col)
    bezel_light(g, cx, cy, R, 1.0, 'black:4', 'black:1', 'black:2')
    dart(g, 17, 14)
    # 벽에 박은 못 (틀 네 모서리 안쪽)
    for (x, y) in ((6, 6), (25, 6), (6, 25), (25, 25)):
        g.set(x, y, 'iron:5'); 
    shadow(g, 1, 1, 1)
    return g

def build_F():
    g = G(); cx = cy = 16.0; R = 12.0   # 지름 24 = 75%
    # 나무 테(둥근) : 바깥 R, 두께 2
    n = 12
    col = {'wood': 'wood:3', 'sng': ('black:3', 'linen:4'), 'dbl': ('red:2', 'green:2'), 'bull': 'green:2', 'eye': 'red:2', 'ring2': 'black:1'}
    ring = [(10.0, 'wood'), (9.0, 'ring2'), (7.0, 'dbl'), (4.3, 'sng'), (1.8, 'dbl'), (1.0, 'bull'), (0, 'eye')]
    face(g, cx, cy, R, ring, col, n=n)
    for y in range(g.h):
        for x in range(g.w):
            dx, dy = x + .5 - cx, y + .5 - cy
            d = math.hypot(dx, dy)
            if 10.0 <= d <= R:
                t = (-dx - dy) / (d or 1)
                g.set(x, y, 'wood:7' if t > .5 and d < 11.2 else 'wood:5' if t > .3 else 'wood:1' if t < -.5 else 'wood:2' if t < -.15 else 'wood:3')
    nail_cord(g, cx, 0, span=3)
    dart(g, 14, 17)
    shadow(g, 1, 1, 1)
    return g

if __name__ == '__main__':
    import sys
    which = sys.argv[1:] or ['D', 'E', 'F']
    for w in which:
        g = {'D': build_D, 'E': build_E, 'F': build_F}[w](); g.dump()
        g.write(f'../w23-{w}.pxg', f'w23-{w}')
