# j1 작업용 도우미: (램프,단) 격자를 손으로 놓고 pxgrid 형식(.pxg: @mat + @mblock + @tblock)으로 적어 낸다.
# 보간·난수 없음 — 단은 전부 호출하는 쪽이 정한다.
import os
TONES = '0123456789abcde'
LET = 'abcdefghijklmnopqrstuvwxyz'
RN = dict(mout=3,masph=6,mconc=7,mpave=8,mgran=7,mbrick=6,mtile=6,mglass=8,mdglass=8,mmetal=8,mwhite=6,myellow=6,mred=6,mgreen=6,mblue=6,mteal=5,mwood=6,morange=6,mpurple=6,mnavy=6,msoil=4,vwood=9,vdwood=7,vpine=7,viron=7,vbrass=7,vstone=7,vlinen=7,vred=7,vblue=7,vgreen=7,vyellow=7,vglass=7,vblack=7,vwhite=7,vleaf=7,sakura=6,hinoki=7,washi=6,ai=7,kokuban=7,wboard=6,cork=6,locker=7,cream=6,cfloor=7,lino=7,gym=7,gmat=6,jersey=6,fence=6,undo=7,stile=7,tray=6,uniform=6)
class C:
    def __init__(s, W, H):
        s.W, s.H = W, H
        s.g = [[None] * W for _ in range(H)]
    def px(s, x, y, r, t=None):
        if 0 <= x < s.W and 0 <= y < s.H:
            if t is not None and r in RN: t = max(0, min(RN[r] - 1, t))
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

# ── s4 추가 도우미 (호출하는 쪽이 단을 정한다) ──
def ascii_layer(c, x, y, rows, leg):
    c.art(x, y, rows, leg)

def write_item(c, slug, tag, note, root=None):
    root = root or os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    d = os.path.join(root, slug)
    c.save(os.path.join(d, f's4-{tag}.pxg'))
    open(os.path.join(d, f's4-{tag}.note'), 'w', encoding='utf-8').write(note + '\n')

def shadow(c, x0, x1, y, two=True):
    for x in range(x0, x1):
        c.px(x, y, '~')
        if two and y + 1 < c.H: c.px(x, y + 1, '-')

# ── B 방향(명암·그림자 강화)용: 그려진 격자에 빛 방향을 입힌다 ──
def shift_up(c, n=1):
    for _ in range(n):
        c.g.pop(0); c.g.append([None] * c.W)

def grade(c, lit=0.22, dark=0.62, darker=0.86, low=0.70, lit_d=1, dark_d=1, darker_d=1, low_d=1, top_rows=0, xa=0, xb=None):
    """왼쪽(lit) 열은 +lit_d, 오른쪽(dark)은 -dark_d, 더 오른쪽(darker)은 추가 -darker_d, 아래(low)는 -low_d, 위 top_rows 줄은 +1."""
    W, H = c.W, c.H
    ys = [y for y in range(H) if any(v is not None and isinstance(v, tuple) for v in c.g[y])]
    y0, y1 = ys[0], ys[-1]
    xb = W if xb is None else xb
    for y in range(H):
        for x in range(xa, xb):
            v = c.g[y][x]
            if not isinstance(v, tuple): continue
            fx = (x - xa) / max(1, xb - xa - 1)
            fy = (y - y0) / max(1, (y1 - y0))
            d = 0
            if fx < lit: d += lit_d
            if fx > dark: d -= dark_d
            if fx > darker: d -= darker_d
            if fy > low: d -= low_d
            if y < y0 + top_rows: d += 1
            if d: c.px(x, y, v[0], v[1] + d)

def cast(c, x0, x1, y, lens=(1.0, 0.8, 0.5)):
    """접지 그림자 3줄: 바로 밑 ~ ~ , 다음 줄 ~ 좁게, 마지막 - 더 좁게."""
    n = x1 - x0
    for k, f in enumerate(lens):
        if y + k >= c.H: break
        m = int(n * f); a = x0 + (n - m) // 2
        for x in range(a, a + m): c.px(x, y + k, '-' if k == len(lens) - 1 else '~')
