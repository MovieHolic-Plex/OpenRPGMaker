# 빈 바닥 채우기: 20x15 창 중 40% 넘는 곳에 "덩어리" 소품 묶음을 하나씩 얹는다 (줄 세우기 아님).
# 걷는 길이 끊기면 그 묶음은 취소한다. reserved 칸(복도·문 앞)은 건드리지 않는다.
import random
T = 16

def empty_grid(m):
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        for dy in range(-(-img.height // T)):
            for dx in range(-(-img.width // T)): used.add((int(x) + dx, int(y) + dy))
    g = [[0] * m.W for _ in range(m.H)]
    for y in range(m.H):
        for x in range(m.W):
            if m.fl[y][x] is not None and not m.wa[y][x] and (x, y) not in used and (x, y) not in m.blocked and not m.br[y][x]:
                g[y][x] = 1
    return g

def worst(m, g, lim=.4):
    best = None
    for y0 in range(0, m.H - 14, 2):
        for x0 in range(0, m.W - 19, 2):
            c = sum(g[y][x] for y in range(y0, y0 + 15) for x in range(x0, x0 + 20)) / 300.0
            if c > lim and (best is None or c > best[0]): best = (c, x0, y0)
    return best

def autofill(m, themes, reserved, seed=1, lim=.38, maxit=400, notheme=('dirt',)):
    """themes: {바닥종류: [묶음, ...]}, 묶음 = [(dx, dy, img, 'b'|'n'|'t'), ...]  (b=발밑 막음, n=안 막음, t=키 큰 것: 윗칸도 열려 있어야 함)."""
    rng = random.Random(seed); placed = 0
    ncomp0 = len(m.components())
    for it in range(maxit):
        g = empty_grid(m); w = worst(m, g, lim)
        if not w: break
        _, x0, y0 = w
        cells = [(x, y) for y in range(y0, y0 + 15) for x in range(x0, x0 + 20) if g[y][x] and (x, y) not in reserved]
        if not cells: break
        # 주변이 가장 비어 있는 칸부터 시도
        def nb(c):
            return sum(g[yy][xx] for yy in range(c[1] - 2, c[1] + 3) for xx in range(c[0] - 2, c[0] + 3) if 0 <= yy < m.H and 0 <= xx < m.W)
        cells.sort(key=lambda c: (-nb(c), rng.random()))
        ok = False
        for (cx, cy) in cells[:40]:
            kind = m.fl[cy][cx]
            opts = themes.get(kind) or themes.get('*') or []
            if not opts: continue
            rec = rng.choice(opts)
            items = []; good = True
            for (dx, dy, img, mode) in rec:
                x, y = cx + dx, cy + dy
                if not m.inb(x, y) or not g[y][x] or (x, y) in reserved: good = False; break
                if mode == 't' and not (m.inb(x, y - 1) and m.fl[y - 1][x] is not None): good = False; break
                if any((x, y) == (i[0], i[1]) for i in items): good = False; break
                items.append((x, y, img, mode))
            if not good: continue
            n0 = len(m.props); b0 = set(m.blocked)
            for (x, y, img, mode) in items:
                blk = [] if mode == 'n' else [(dx_, 0) for dx_ in range(img.width // T)]
                m.props_add(x, y, img, blk, 1)
            if len(m.components()) > ncomp0:
                del m.props[n0:]; m.blocked = b0; continue
            ok = True; placed += 1; break
        if not ok:
            # 이 창은 더 못 채운다 -> 창 안 칸을 잠깐 막음 처리 대신 종료
            break
    return placed
