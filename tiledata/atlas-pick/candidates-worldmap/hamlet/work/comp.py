"""wv7 조립 도구 — 손으로 그린 조각(글자 줄)을 좌표에 얹어 .art 로 적는다. 색·모양을 계산하지 않는다."""
def canvas(W, H): return [['.'] * W for _ in range(H)]
def put(cv, x, y, rows, over=True):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch == '.' or ch == ' ': continue
            yy, xx = y + j, x + i
            if 0 <= yy < len(cv) and 0 <= xx < len(cv[0]): cv[yy][xx] = ch
def emit(path, cv, maps, shadow=None, auto=True):
    W = len(cv[0]); H = len(cv)
    L = [f'size {W} {H}'] + [f'map {g} {rp} {st}' for g, (rp, st) in maps.items()]
    if auto: L.append('autoshadow')
    L.append('grid'); L += [''.join(r) for r in cv]
    if shadow: L += ['shadow'] + shadow
    L.append('')
    open(path, 'w').write('\n'.join(L))

RED = dict(o='K', a='q', b='r', c='R', d='Q')      # wroofr 0..4
BLUE = dict(o='J', a='i', b='j', c='I', d='H')     # wroofb 0..4
def gable(n, roof, wallh, doors=(), wins=(), shade=False):
    """박공 집 조각을 글자로 그려 낸다(지붕 n줄: 폭 2,4,..2n, 마지막 줄은 처마). 벽 바깥 k, 안쪽 W(밝음 V·어둠 Y·처마그늘 x).
    doors=[(안쪽x,폭)], wins=[(안쪽x,안쪽y,폭)]. 색은 글자만 정하고 계산하지 않는다."""
    W = 2 * n; rows = []
    for k in range(n - 1):
        w = 2 * k + 2; m = w - 2
        fill = ''.join('Q' if False else (roof['d'] if i < m * 0.4 else roof['c'] if i < m * 0.65 else roof['b']) for i in range(m))
        if shade and m >= 4: fill = fill[:-1] + roof['a']
        r = roof['o'] + fill + roof['o']
        rows.append(' ' * ((W - w) // 2) + r)
    rows.append(roof['o'] + roof['a'] * (W - 2) + roof['o'])
    iw = W - 4
    for y in range(wallh):
        inner = ['W'] * iw
        if shade:
            inner[0] = 'V'; inner[-1] = 'Y'
            if y == 0: inner = ['x'] * iw
        for (dx, dw) in doors:
            if y >= wallh - 3 or True:
                if y >= wallh - 3:
                    for i in range(dw): inner[dx + i] = 'D'
        for (wx, wy, ww) in wins:
            if y in (wy, wy + 1):
                for i in range(ww): inner[wx + i] = 'g'
        rows.append(' ' + 'k' + ''.join(inner) + 'k')
    rows.append(' ' + 'k' * (W - 2))
    return [r.ljust(W, '.').replace(' ', '.') for r in rows]

STD = {'K':('wroofr',0),'q':('wroofr',1),'r':('wroofr',2),'R':('wroofr',3),'Q':('wroofr',4),
'J':('wroofb',0),'i':('wroofb',1),'j':('wroofb',2),'I':('wroofb',3),'H':('wroofb',4),
'k':('mbrick',2),'x':('mwhite',0),'Y':('mwhite',1),'W':('mwhite',2),'V':('mwhite',3),'g':('mglass',4),'D':('mwood',3),'d':('mwood',1),'e':('wdirt',2),
'L':('wleaf',0),'l':('wleaf',1),'m':('wleaf',2),'n':('wleaf',3),'o':('wleaf',4),'t':('wbark',0),'T':('wbark',1),
'z':('wstone',0),'s':('wstone',1),'S':('wstone',2),'U':('wstone',3),'X':('wstone',4),'Z':('wstone',5),'C':('wstone',6),
'p':('wsnow',1),'P':('wsnow',2),'N':('wsnow',3),'M':('wsnow',4),'O':('wsnow',5),'F':('wsnow',6),
'a':('wbark',2),'b':('wbark',3),'y':('wgold',3),'Ｙ':('wgold',4)}
def tree(): return [".LLLL.","LonnmL","LnnmlL","LmmllL",".LllL.","..tT..","..tT.."]
def tree_big(): return ["..LLL...",".LnooL..","LonnnmL.","LnnmmlL.","LmmmllLL",".LmllLl.","..LLtTL.","....tT..","....tT.."]
