"""w23 작도 도우미: 글자 격자 + 재료 열쇠 -> .pxg. 색은 손으로 정한다(램프:단), 도형 채움은 실루엣 마스크 계산에만 쓴다."""
import math, string
class G:
    def __init__(s, w=32, h=32):
        s.w, s.h = w, h
        s.g = [[None]*w for _ in range(h)]
    def set(s, x, y, k):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = k
    def get(s, x, y):
        return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else None
    def mask(s):
        return {(x, y) for y in range(s.h) for x in range(s.w) if s.g[y][x] and s.g[y][x] not in ('~', '-')}
    def write(s, path, note=''):
        keys = []
        for row in s.g:
            for k in row:
                if k and k not in keys and k not in ('~', '-'): keys.append(k)
        letters = [c for c in string.ascii_letters if c not in 'x']  # 글자 배정
        m = {k: letters[i] for i, k in enumerate(keys)}
        out = [f'// {note}', f'@size {s.w} {s.h}', '@cell 16', '@palette palette.pal']
        for k, c in m.items():
            r, l = k.split(':'); out.append(f'@mat {c} {r} {l}')
        out.append('@mblock 0 0')
        for row in s.g:
            out.append(''.join('.' if not k else (k if k in '~-' else m[k]) for k in row))
        open(path, 'w').write('\n'.join(out) + '\n')
    def dump(s):
        keys = {}
        for row in s.g:
            print(''.join('.' if not k else (k if k in '~-' else k.split(':')[0][0]) for k in row))

def shadow(g, dx=1, dy=1, far=2):
    """벽에 떨어지는 그림자: 실루엣을 (dx,dy)만큼 옮겨 ~ , 한 칸 더 옮겨 - (아래·오른쪽)."""
    m = g.mask()
    for k, ch in ((far, '-'), (1, '~')):
        for (x, y) in m:
            xx, yy = x + dx*k, y + dy*k
            if g.get(xx, yy) is None and (xx, yy) not in m:
                g.set(xx, yy, ch)
    # ~ 가 - 를 덮도록 재적용
    for (x, y) in m:
        xx, yy = x + dx, y + dy
        if g.get(xx, yy) in (None, '-') and (xx, yy) not in m: g.set(xx, yy, '~')

def line(pts, thick=2):
    """폴리라인 -> 칸 집합. thick=2 면 (x,y)+(x+1,y)."""
    out = set()
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1-x0), abs(y1-y0), 1)
        for i in range(n+1):
            x = round(x0 + (x1-x0)*i/n); y = round(y0 + (y1-y0)*i/n)
            out.add((x, y))
            if thick >= 2: out.add((x+1, y))
    return out

def rows_mask(spec):
    """{y: [(x0,x1),...]} -> 집합"""
    return {(x, y) for y, rs in spec.items() for (a, b) in rs for x in range(a, b+1)}

def mirror(m, w=32):
    return m | {(w-1-x, y) for (x, y) in m}

def shade(g, m, ramp, base, outline=True, out_lvl=None, hi=1, lo=1, bits=None):
    """윗·왼쪽 가장자리는 밝게(base+hi), 아래·오른쪽 가장자리는 어둡게(base-lo), 안은 base. 윤곽은 재료의 어두운 단."""
    for (x, y) in m:
        L = (x-1, y) not in m; U = (x, y-1) not in m; R = (x+1, y) not in m; D = (x, y+1) not in m
        lvl = base
        if (R or D) and not (L or U): lvl = base - lo
        elif (L or U) and not (R or D): lvl = base + hi
        g.set(x, y, f'{ramp}:{lvl}')
    if outline:
        ol = out_lvl if out_lvl is not None else max(base - 3, 0)
        for (x, y) in m:
            for (dx, dy) in ((1,0),(-1,0),(0,1),(0,-1)):
                if (x+dx, y+dy) not in m and g.get(x+dx, y+dy) is None:
                    g.set(x+dx, y+dy, f'{ramp}:{ol}')

def cord(g, p0, p1, key='straw:3'):
    for (x, y) in line([p0, p1], 1): g.set(x, y, key)

def nail(g, x, y):
    g.set(x, y, 'iron:5'); g.set(x, y+1, 'iron:3')
