# w24 작도 보조: (램프,단)을 칸마다 적어 @tblock 격자로 내보낸다. 보간·난수 없음 — 손으로 놓은 칸만.
import sys
class Cv:
    def __init__(s, W, H): s.W, s.H, s.c = W, H, {}
    def p(s, x, y, ramp, t):
        if 0 <= x < s.W and 0 <= y < s.H: s.c[(x, y)] = (ramp, t)
    def r(s, x0, y0, x1, y1, ramp, t):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.p(x, y, ramp, t)
    def row(s, y, x0, txt, ramp):   # 단 글자 줄. '.' 는 건드리지 않음
        for i, ch in enumerate(txt):
            if ch != '.': s.p(x0 + i, y, ramp, int(ch, 16))
    def mirror(s, cx, dark=1, keep=('~', '-')):
        """x < cx 의 왼쪽 반을 x' = 2cx-1-x 로 복사. 단은 dark 만큼 어둡게(0 유지)."""
        for (x, y), (r, t) in list(s.c.items()):
            if x < cx:
                nx = 2 * cx - 1 - x
                if (nx, y) in s.c: continue
                s.c[(nx, y)] = (r, t) if r in keep else (r, max(0 if t == 0 else 1, t - dark) if t else 0)
    def dim(s, x0, y0, x1, y1, d, ramps=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                v = s.c.get((x, y))
                if v and (ramps is None or v[0] in ramps) and v[0] not in ('~', '-'): s.c[(x, y)] = (v[0], max(0, min(6, v[1] + d)))
    def emit(s, path, header_note=''):
        out = [f'@size {s.W} {s.H}', '@cell 16', '@palette palette.pal']
        ramps = []
        for v in s.c.values():
            if v[0] not in ramps and v[0] not in ('~', '-'): ramps.append(v[0])
        for rp in ramps:
            out.append(f'@tblock 0 0 {rp}')
            for y in range(s.H):
                out.append(''.join('0123456789abcdef'[s.c[(x, y)][1]] if (x, y) in s.c and s.c[(x, y)][0] == rp else '.' for x in range(s.W)))
        if any(v[0] in ('~', '-') for v in s.c.values()):
            out.append('@block 0 0')
            for y in range(s.H):
                out.append(''.join(s.c[(x, y)][0] if (x, y) in s.c and s.c[(x, y)][0] in ('~', '-') else '.' for x in range(s.W)))
        open(path, 'w').write('\n'.join(out) + '\n')
    def show(s):
        sym = {'gold': 'g', 'red': 'r', 'pine': 'p', 'blue': 'b', 'green': 'n', 'stone': 's', 'marble': 'm', 'wood': 'w', '~': '~', '-': '-', 'yellow': 'y', 'purple': 'u', 'white': 'h', 'glass': 'l', 'brass': 'B', 'black': 'k', 'iron': 'i', 'teal': 't', 'linen': 'L', 'ice': 'I'}
        for y in range(s.H):
            print(''.join((sym[s.c[(x, y)][0]] if (x, y) in s.c else '.') for x in range(s.W)))
