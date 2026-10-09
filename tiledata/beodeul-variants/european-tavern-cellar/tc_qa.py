# QA: 한 화면(20x15) 빈 바닥 비율, 통행 BFS.
def occupied(m):
    occ = set()
    for (x, y, img, w, h, layer) in m.props:
        for j in range(h):
            for i in range(w): occ.add((x + i, y - j))
    for (x, y, img) in m.decals:
        w = -(-img.width // 16); h = -(-img.height // 16)
        for j in range(h):
            for i in range(w): occ.add((int(x) + i, int(y) + j))
    for cells, sh in m.under: occ |= set(cells)
    return occ
def emptiness(m, sw=20, sh=15, step=4):
    occ = occupied(m); worst = []
    for y0 in range(0, max(1, m.H - sh + 1), step):
        for x0 in range(0, max(1, m.W - sw + 1), step):
            e = sum(1 for y in range(y0, y0 + sh) for x in range(x0, x0 + sw) if m.fl[y][x] is not None and (x, y) not in occ)
            worst.append((e / float(sw * sh), x0, y0))
    worst.sort(reverse=True)
    return worst[:5]
