import sys; sys.path.insert(0, '.')
import math
from w23_px import *

def paint_map(g, x0, y0, w, h, sea='blue:4', seahi='blue:5', sealo='blue:3'):
    """x0,y0,w,h 안을 지도로 채운다. 바다는 파랑, 땅은 초록(윗왼쪽 밝게), 기슭 선, 깃발 핀, 나침반."""
    inner = {(x, y) for y in range(y0, y0+h) for x in range(x0, x0+w)}
    for (x, y) in inner: g.set(x, y, sea)
    # 땅: 원의 합
    land = set()
    for (cx, cy, r) in ((.32, .45, .27), (.52, .32, .20), (.70, .62, .24), (.60, .80, .13), (.22, .75, .11)):
        for (x, y) in inner:
            if math.hypot((x-x0)/w - cx, ((y-y0)/h - cy) * h/w) <= r: land.add((x, y))
    for (x, y) in land:
        L = (x-1, y) not in land; U = (x, y-1) not in land; R = (x+1, y) not in land; D = (x, y+1) not in land
        g.set(x, y, 'green:5' if (L or U) and not (R or D) else 'green:3' if (R or D) and not (L or U) else 'green:4')
    # 기슭: 바다 쪽 한 줄 밝게
    for (x, y) in land:
        for (dx, dy) in ((-1,0),(0,-1)):
            p = (x+dx, y+dy)
            if p in inner and p not in land: g.set(p[0], p[1], seahi)
    for (x, y) in inner:
        if (x, y) not in land and (x-1, y-1) in land and False: pass
    # 물 결: 몇 개
    for (x, y) in ((x0+2, y0+h-3), (x0+3, y0+h-3), (x0+w-6, y0+2), (x0+w-5, y0+2)):
        if (x, y) not in land: g.set(x, y, seahi)
    # 길 점선
    pts = [(x0+int(w*.30), y0+int(h*.55)), (x0+int(w*.45), y0+int(h*.50)), (x0+int(w*.60), y0+int(h*.62)), (x0+int(w*.68), y0+int(h*.66))]
    n = 0
    for a, b in zip(pts, pts[1:]):
        for (x, y) in sorted(line([a, b], 1)):
            n += 1
            if n % 2 == 0: g.set(x, y, 'straw:5')
    fx, fy = pts[-1]
    g.set(fx, fy, 'black:2'); g.set(fx, fy-1, 'black:2'); g.set(fx, fy-2, 'black:2')
    for (dx, dy, k) in ((1,-2,'red:4'),(2,-2,'red:3'),(1,-3,'red:5'),(2,-3,'red:3')): g.set(fx+dx, fy+dy, k)
    # 나침반 (오른쪽 아래 구석)
    cx, cy = x0+w-4, y0+h-4
    for (dx, dy) in ((0,-2),(0,-1),(0,1),(0,2),(-2,0),(-1,0),(1,0),(2,0)): g.set(cx+dx, cy+dy, 'linen:6')
    g.set(cx, cy-3, 'red:4'); g.set(cx, cy, 'gold:4')
    return inner

def frame(g, x0, y0, x1, y1, t=2):
    """나무 액자. 위·왼 밝게, 아래·오른 어둡게. 모서리는 한 칸 깎음."""
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if x in (x0, x1) and y in (y0, y1): continue
            e = min(x-x0, y-y0, x1-x, y1-y)
            if e >= t: continue
            if e == 0: k = 'wood:1' if (x == x1 or y == y1) else 'wood:2'
            else:
                top_left = (x - x0 <= y - y0 and x - x0 < t) or (y - y0 < t and y - y0 <= x - x0)
                k = 'wood:5' if (x-x0 == e or y-y0 == e) and (x-x0 < t or y-y0 < t) and min(x-x0, y-y0) == e and (x - x0 == e or y - y0 == e) and not (x1-x == e or y1-y == e) else 'wood:3' if (x1-x == e or y1-y == e) else 'wood:4'
            g.set(x, y, k)

def build_D():
    g = G()
    x0, y0, x1, y1 = 3, 5, 28, 27
    # 액자 t=3: 바깥 짙은 테, 가운데 밝은 면, 안쪽 어두운 턱
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if x in (x0, x1) and y in (y0, y1): continue
            e = min(x-x0, y-y0, x1-x, y1-y)
            lit = min(x-x0, y-y0) <= min(x1-x, y1-y)
            if e == 0: k = 'wood:1' if not lit else 'wood:2'
            elif e == 1: k = 'wood:7' if lit else 'wood:4'
            elif e == 2: k = 'wood:5' if lit else 'wood:3'
            else: continue
            g.set(x, y, k)
    # 종이 여백 1칸 (linen)
    for y in range(y0+3, y1-2):
        for x in range(x0+3, x1-2): g.set(x, y, 'linen:5' if (x == x0+3 or y == y0+3) else 'linen:4')
    paint_map(g, x0+4, y0+4, x1-x0-7, y1-y0-7)
    for x in range(x0+3, x1-2): g.set(x, y0+3, 'linen:6')
    nail(g, 15, 1); g.set(16, 1, 'iron:5'); g.set(16, 2, 'iron:3')
    cord(g, (15, 3), (9, y0)); cord(g, (16, 3), (22, y0))
    shadow(g, 1, 1, 1)
    return g

def build_E():
    """두루마리 지도: 위아래 막대(놋쇠 마감)에 종이가 말려 걸림."""
    g = G()
    x0, y0, x1, y1 = 5, 7, 26, 26
    # 종이
    for y in range(y0, y1+1):
        for x in range(x0, x1+1): g.set(x, y, 'linen:5')
    paint_map(g, x0+2, y0+3, x1-x0-3, y1-y0-5)
    # 위 막대 (y=5..7) 아래 막대 (y=26..28)
    for x in range(x0-2, x1+3):
        g.set(x, 5, 'wood:6'); g.set(x, 6, 'wood:5'); g.set(x, 7, 'wood:3')
        g.set(x, 27, 'wood:6'); g.set(x, 28, 'wood:4'); g.set(x, 29, 'wood:2')
    for (x, y) in ((x0-3, 5), (x0-3, 6), (x0-3, 7), (x1+3, 5), (x1+3, 6), (x1+3, 7)): g.set(x, y, 'brass:5' if x < 16 else 'brass:3')
    for (x, y) in ((x0-3, 27), (x0-3, 28), (x0-3, 29), (x1+3, 27), (x1+3, 28), (x1+3, 29)): g.set(x, y, 'brass:4' if x < 16 else 'brass:2')
    # 종이 위·아래 말림 그림자
    for x in range(x0, x1+1): g.set(x, y0+1, 'linen:3'); g.set(x, y1-1, 'linen:3')
    # 종이 옆 그림자 한 줄
    for y in range(y0+1, y1): g.set(x1, y, 'linen:3')
    nail(g, 15, 0); g.set(16, 0, 'iron:5'); g.set(16, 1, 'iron:3')
    cord(g, (15, 2), (7, 5)); cord(g, (16, 2), (24, 5))
    shadow(g, 1, 1, 1)
    return g

def build_F():
    """액자 없이 종이 그대로: 모서리 네 곳에 쇠못, 위쪽은 말려 올라오고 접힌 자국이 남은 오래된 지도."""
    g = G()
    x0, y0, x1, y1 = 3, 5, 28, 27
    for y in range(y0, y1+1):
        for x in range(x0, x1+1):
            if x in (x0, x1) and y in (y0, y1): continue
            g.set(x, y, 'linen:5')
    # 지도 (종이 테두리 2칸)
    paint_map(g, x0+2, y0+2, x1-x0-3, y1-y0-3, sea='blue:3', seahi='blue:4', sealo='blue:2')
    # 종이 테: 낡은 가장자리(아래·오른쪽 어둡게)
    for x in range(x0, x1): g.set(x, y1, 'linen:2')
    for y in range(y0, y1+1):
        if (x1, y) != (x1, y0): g.set(x1, y, 'linen:2')
    for x in range(x0+1, x1): g.set(x, y0, 'linen:6')
    for y in range(y0+1, y1): g.set(x0, y, 'linen:6')
    # 세로 접힌 자국 (가운데)
    for y in range(y0+2, y1-1):
        p = g.get(16, y)
        if p and p.startswith('blue'): g.set(16, y, 'blue:2')
        elif p and p.startswith('green'): g.set(16, y, 'green:2')
    # 위 왼쪽 모서리 살짝 말림
    for (x, y) in ((x0, y0), (x0+1, y0), (x0, y0+1)): g.set(x, y, None)
    g.set(x0+1, y0+1, 'linen:3'); g.set(x0+2, y0, 'linen:3'); g.set(x0, y0+2, 'linen:3')
    # 못 네 개 (위 둘은 머리가 보이고 아래 둘은 작게)
    for (x, y) in ((x0+3, y0+1), (x1-2, y0+1), (x0+3, y1-2), (x1-2, y1-2)):
        g.set(x, y, 'iron:5'); g.set(x+1, y, 'iron:3'); g.set(x, y+1, 'iron:3')
    # 위쪽 가운데 걸이 끈이 아니라 못 -> 종이가 못에 박혀 있으므로 끈 없이 못의 그림자가 걸이 단서
    shadow(g, 1, 1, 1)
    return g

if __name__ == '__main__':
    for w in (sys.argv[1:] or ['D']):
        g = {'D': build_D, 'E': build_E, 'F': build_F}[w](); g.dump(); g.write(f'../w23-{w}.pxg', f'w23-{w}')
