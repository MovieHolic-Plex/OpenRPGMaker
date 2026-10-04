# 던전 검수 도구: 빈 바닥 비율, 재료 표본 등록, parts.md 작성.
from dlib import *
import dlib
from px2 import _hash

def emptiness(m, win=(20, 15), stride=2):
    """20x15 창마다 '빈 바닥'(걷는 칸 중 소품·데칼이 없는 칸) 비율. 최댓값과 그 위치를 돌려준다."""
    used = set()
    for (x, y, img, w, h, layer) in m.props:
        wc = -(-img.width // T); hc = -(-img.height // T)
        for dy in range(hc):
            for dx in range(wc): used.add((x + dx, y - dy))
    for (x, y, img) in m.decals:
        used.add((int(x), int(y)))
        if img.width > T or img.height > T:
            for dy in range(-(-img.height // T)):
                for dx in range(-(-img.width // T)): used.add((int(x) + dx, int(y) + dy))
    empty = [[1 if (m.fl[y][x] is not None and (x, y) not in used and (x, y) not in m.blocked and not m.br[y][x] and not (m.wa[y][x] and not m.br[y][x])) else 0
              for x in range(m.W)] for y in range(m.H)]
    ww, wh_ = win; best = (0, None); vals = []
    for y0 in range(0, max(1, m.H - wh_ + 1), stride):
        for x0 in range(0, max(1, m.W - ww + 1), stride):
            c = sum(empty[y][x] for y in range(y0, min(m.H, y0 + wh_)) for x in range(x0, min(m.W, x0 + ww)))
            r = c / float(ww * wh_); vals.append(r)
            if r > best[0]: best = (r, (x0, y0))
    tot = sum(sum(r) for r in empty)
    return dict(max=round(best[0], 3), at=best[1], mean=round(sum(vals) / len(vals), 3), empty_cells=tot, over40=sum(1 for v in vals if v > .4))

def compose(cols, rows, fn):
    im = new(cols * T, rows * T)
    for j in range(rows):
        for i in range(cols): im.alpha_composite(fn(i, j), (i * T, j * T))
    return im

def reg_materials(m):
    """지도에서 실제로 쓴 재료 (앞면·바닥·물·천장) 표본을 부품으로 등록한다."""
    m.compute_faces()
    styles = {}
    for (x, y), (sty, k, n) in m.face.items(): styles[(sty, n)] = 1
    for (sty, n) in sorted(styles):
        def ff(i, j, sty=sty, n=n):
            idx = j
            return face_tile(sty, None, idx, int(_hash(i + 3, j, 3) * 6), i == 0, i == 2, n * T)
        reg('face_%s_%dh' % (sty, n), compose(3, n, ff), '벽 앞면 %s 돌 %d칸 높이 (양끝 마구리 포함, 3칸 폭 표본)' % (sty, n), (3, n))
    kinds = sorted({k for row in m.fl for k in row if k})
    for k in kinds:
        reg('floor_' + k, compose(2, 2, lambda i, j, k=k: floor_tile(k, i + 6, j + 4)), '바닥 %s (2x2 표본, 이웃과 이어짐)' % k, (2, 2))
    wk = sorted({k for row in m.wa for k in row if k})
    for k in wk:
        reg('water_' + k, compose(3, 2, lambda i, j, k=k: water_tile(k, j > 0, i < 2, j < 1, i > 0, 'floor')), '물 %s (가장자리 포함 3x2 표본)' % k, (3, 2))
    def cf(i, j):
        o8 = (j > 0, i < 2, j < 2, i > 0, j > 0 and i < 2, j < 2 and i < 2, j < 2 and i > 0, j > 0 and i > 0)
        return ceiling((False,) * 8 if (i == 1 and j == 1) else o8, i + j, m.cave)
    reg('ceiling' + ('_cave' if m.cave else ''), compose(3, 3, cf), '어두운 천장 + 밝은 테두리 (3x3 표본, 방 모서리 포함)', (3, 3))

def write_parts_md(outdir, lines, title):
    with open(os.path.join(outdir, 'parts.md'), 'w') as f:
        f.write('# %s — 새 부품\n\n손 도트(파이썬/Pillow, 버들항 돌·물·잎·나무 램프와 pz.fin 윤곽) 로 새로 그린 것만 적는다. 칸 = 16px.\n\n' % title)
        f.write('| 이름 | 크기(칸) | 설명 |\n|---|---|---|\n')
        for (n, note, cells) in lines: f.write('| `parts/%s.png` | %dx%d | %s |\n' % (n, cells[0], cells[1], note))
        f.write('\n합계 **%d** 종.\n' % len(lines))
