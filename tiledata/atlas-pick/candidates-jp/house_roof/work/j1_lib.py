# j1 작업용 도우미: (램프,단) 격자를 손으로 놓고 pxgrid 형식(.pxg: @mat + @mblock + @tblock)으로 적어 낸다.
# 보간·난수 없음 — 단은 전부 호출하는 쪽이 정한다.
import os
TONES = '0123456789abcde'
LET = 'abcdefghijklmnopqrstuvwxyz'
class C:
    def __init__(s, W, H):
        s.W, s.H = W, H
        s.g = [[None] * W for _ in range(H)]
    def px(s, x, y, r, t=None):
        if 0 <= x < s.W and 0 <= y < s.H:
            s.g[y][x] = r if t is None else (r, t)
    def clear(s, x, y):
        if 0 <= x < s.W and 0 <= y < s.H: s.g[y][x] = None
    def rect(s, x, y, w, h, r, t=None):
        for j in range(h):
            for i in range(w): s.px(x + i, y + j, r, t)
    def hl(s, x, y, w, r, t=None): s.rect(x, y, w, 1, r, t)
    def vl(s, x, y, h, r, t=None): s.rect(x, y, 1, h, r, t)
    def box(s, x, y, w, h, r, t=None):
        s.hl(x, y, w, r, t); s.hl(x, y + h - 1, w, r, t); s.vl(x, y, h, r, t); s.vl(x + w - 1, y, h, r, t)
    def ell(s, cx, cy, rx, ry, r, t=None):   # 정수 타원(중심 cx,cy 는 칸 좌표, 반지름은 칸 수 -0.5 기준)
        for y in range(s.H):
            for x in range(s.W):
                dx = (x - cx) / (rx + .0001); dy = (y - cy) / (ry + .0001)
                if dx * dx + dy * dy <= 1.0: s.px(x, y, r, t)
    def art(s, x, y, rows, leg):
        """rows: 글자 격자, leg: 글자 → (램프,단) 또는 낱 글자('~' '-' '%'). '.' 은 건드리지 않음, ' ' 도."""
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch in '. ': continue
                v = leg[ch]
                s.px(x + i, y + j, v[0], v[1]) if isinstance(v, tuple) else s.px(x + i, y + j, v)
    def at(s, x, y):
        return s.g[y][x] if 0 <= x < s.W and 0 <= y < s.H else None
    def save(s, path, palette='palette.pal'):
        ramps = []
        for row in s.g:
            for v in row:
                if isinstance(v, tuple) and v[0] not in ramps: ramps.append(v[0])
        m = {r: LET[i] for i, r in enumerate(ramps)}
        out = [f'@size {s.W} {s.H}', '@cell 16', f'@palette {palette}']
        for r in ramps: out.append(f'@mat {m[r]} {r} 3')
        out.append('@mblock 0 0')
        for row in s.g:
            out.append(''.join('.' if v is None else (m[v[0]] if isinstance(v, tuple) else v) for v in row))
        out.append('@tblock 0 0')
        for row in s.g:
            out.append(''.join('.' if (v is None or not isinstance(v, tuple)) else TONES[v[1]] for v in row))
        open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
