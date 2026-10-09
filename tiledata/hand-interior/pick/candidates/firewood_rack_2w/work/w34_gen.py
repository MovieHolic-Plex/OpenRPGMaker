import math, sys, os
W, H = 48, 32
HERE = os.path.dirname(os.path.abspath(__file__))

class Cv:
    def __init__(s): s.g = [['.'] * W for _ in range(H)]
    def put(s, x, y, c):
        if 0 <= x < W and 0 <= y < H: s.g[y][x] = c
    def get(s, x, y): return s.g[y][x] if 0 <= x < W and 0 <= y < H else '.'
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)
    def out(s): return '\n'.join(''.join(r) for r in s.g)

def segdist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay; L2 = vx * vx + vy * vy
    t = max(0, min(1, ((px - ax) * vx + (py - ay) * vy) / L2))
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy)), t

def log(cv, a, b, r=2.4, caps=(), seed=0, bark=('E', 'Q', 'I'), outline=True):
    ax, ay = a; bx, by = b
    L = math.hypot(bx - ax, by - ay); ux, uy = (bx - ax) / L, (by - ay) / L
    # 법선: 화면 위-왼쪽을 향하게
    nx, ny = -uy, ux
    if nx + ny > 0: nx, ny = -nx, -ny
    inside = {}
    for y in range(H):
        for x in range(W):
            d, t = segdist(x + .5, y + .5, ax, ay, bx, by)
            if d <= r:
                s = (x + .5 - (ax + t * (bx - ax))) * nx + (y + .5 - (ay + t * (by - ay))) * ny
                inside[(x, y)] = (s, t * L)
    if outline:
        ol = set()
        for (x, y) in inside:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                q = (x + dx, y + dy)
                if q not in inside: ol.add(q)
        for (x, y) in ol:
            # 윤곽: 위/왼쪽은 중간 갈색, 아래/오른쪽은 아주 어둡게
            up = (x + .5 - (ax + bx) / 2) * nx + (y + .5 - (ay + by) / 2) * ny
            cv.put(x, y, 'G' if up > 0 else 'H')
    hi, mid, dk = bark
    for (x, y), (s, t) in inside.items():
        if s > r * 0.30: c = hi
        elif s < -r * 0.38: c = dk
        else: c = mid
        # 껍질 결: 축 방향으로 짧은 어두운 줄
        h = (int(t // 2) * 7 + seed * 3 + (1 if s > 0 else 0) * 5) % 9
        if c == mid and h == 0: c = dk
        elif c == hi and h in (1,) : c = mid
        elif c == mid and h == 4 : c = 'C'
        cv.put(x, y, c)
    for end in caps:
        cx, cy = (bx, by) if end == 'b' else (ax, ay)
        # 끝 마구리: 축 바깥으로 살짝 내밀어 원반
        sx, sy = (ux, uy) if end == 'b' else (-ux, -uy)
        cx += sx * 0.3; cy += sy * 0.3
        rc = r + 0.35
        disc(cv, cx, cy, rc)

def disc(cv, cx, cy, rc):
    pts = {}
    for y in range(H):
        for x in range(W):
            d = math.hypot(x + .5 - cx, y + .5 - cy)
            if d <= rc: pts[(x, y)] = d
    for (x, y) in {(x + dx, y + dy) for (x, y) in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))} - set(pts):
        cv.put(x, y, 'O' if (x + .5 - cx) + (y + .5 - cy) < 0.2 else 'N')
    for (x, y), d in pts.items():
        dx, dy = x + .5 - cx, y + .5 - cy
        lit = -(dx + dy)  # 왼쪽 위가 크다
        if d < rc * 0.36: c = 'M' if lit > -0.2 else 'K'
        elif d < rc * 0.62: c = 'P' if d > rc * 0.5 else 'K'
        elif d < rc * 0.78: c = 'K' if lit > 0 else 'L'
        else: c = 'J' if lit > 0.6 else ('L' if lit > -0.5 else 'P')
        if d > rc - 0.9 and (dx + dy) > rc * 0.6: c = 'N' if d > rc - 0.5 else 'P'
        cv.put(x, y, c)

def skids(cv, x0, x1, y=28):
    # 받침 각재 두 줄(바닥에서 띄움) + 접지 그림자
    for (a, b) in ((x0, x0 + 5), (x1 - 5, x1)):
        cv.rect(a, y, b, y, 'E'); cv.rect(a, y + 1, b, y + 2, 'Q'); cv.rect(a, y + 3, b, y + 3, 'I')
        cv.put(a, y, 'C'); cv.rect(a, y + 3, a, y + 3, 'H')
    for x in range(x0 + 1, x1):
        if cv.get(x, 31) == '.': cv.put(x, 31, '~' if x0 + 3 < x < x1 - 1 else '-')
    for x in range(x0 + 6, x1 - 5):
        if cv.get(x, 30) == '.': cv.put(x, 30, '-')

def save(cv, name, note):
    hdr = f'// w34 {name} — 장작 선반(2칸) 대각선 눕힌 더미 (48x32)\n@size {W} {H}\n@cell 16\n@palette palette.pal\n@block 0 0\n'
    open(os.path.join(HERE, '..', f'w34-{name}.pxg'), 'w').write(hdr + cv.out() + '\n')
    open(os.path.join(HERE, '..', f'w34-{name}.note'), 'w').write(note + '\n')

if __name__ == '__main__':
    import importlib
    for m in sys.argv[1:]:
        importlib.import_module(m)
