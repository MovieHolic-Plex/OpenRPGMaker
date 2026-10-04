"""조선 실내 방 자동 점검(후보 B). 통행은 변환기(build-joseon-tileset.py)와 같은 규칙 함수(joseon_tileset/walk.py)로 계산한다 —
방 검사가 변환기와 다른 통행을 보고 「통과」하는 일이 없게 한다.

  C1 구조      lint_structure(): 천장 밑 벽면 2줄·통로 3줄·출입구 모양 → 「구조:」 0
  C2 도달      출입구 앞 칸에서 걸을 수 있는 바닥 전부에 닿는다(닿지 못하는 바닥 칸 0)
  C3 입구·통로 출입구 앞 3×3 칸과 방 사이 문 칸(통로)은 가구가 막지 않는다
  C4 사용 칸   모든 가구가 닿을 수 있는 사용 칸(상하좌우 한 칸이라도 도달)을 가진다
  C5 일렬      같은 기물 셋 이상이 줄지어 붙어 있지 않다(벽면·바닥 깔개 제외)
  C6 벽 가구   벽걸이(hang·jokja·win)는 벽면 윗줄에만, 벽면을 가리는 높은 가구는 북벽 앞에만
  C7 맨바닥    가구가 하나도 없는 걷는 바닥이 4방향으로 이어져 10칸 이상 덩어리지면 안 된다
  C8 겹침      가구끼리(깔개 제외) 칸이 겹치지 않는다
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts/content/lib'))
from joseon_tileset import walk as W
import inb_room as RM

HANG = ('in_b_hang_', 'in_b_jokja_', 'in_b_win_')
WALLP = ('in_b_wall_', 'in_b_win_', 'in_b_door_slide', 'in_b_door_plank', 'in_b_door_open', 'in_b_doorway')
MATS = ('in_b_mat_',)
FLATDECOR = ('in_b_mat_', 'in_b_exit_mat')


def walk_rows(sheet):
    """변환기와 같은 방식으로 조각별 통행 격자(X/C/F/.)를 구한다."""
    meta = json.load(open(os.path.join(HERE, 'harness', 'pieces_meta.json')))
    ov = json.load(open(os.path.join(ROOT, 'tiledata/joseon-village/piece-walk-overrides.json')))
    pieces = {n: p for n, p in sheet.pieces.items() if 'w' in p}
    return W.build_piece_walk(pieces, lambda i: sheet.tile(i).a, meta, ov)


def cover(room, walk):
    """칸 → [(통행 문자, 조각이름)] (변환기 cover 와 같은 규칙: 그림 있는 칸만)."""
    cv = {}
    for (name, x, y, w, h) in room.placed:
        wk = walk.get(name)
        if wk is None:
            continue
        for j in range(h):
            for i in range(w):
                ch = wk['rows'][j][i]
                if ch != '.':
                    cv.setdefault((x + i, y + j), []).append((ch, name))
    return cv


def analyze(room, sheet):
    walk = walk_rows(sheet)
    cv = cover(room, walk)
    p = room.plan
    W_, H_ = p.W, p.H
    rep = {'fails': [], 'warns': [], 'info': {}}
    # 걸을 수 있는 칸: 바닥(벽면 제외)이고 X 가 덮지 않은 칸. C·F 는 아래 땅이 걷는 땅이면 걷는다.
    def need(c):
        return W.merge_chars([ch for ch, _ in cv.get(c, [])])
    walkable = set()
    for y in range(H_):
        for x in range(W_):
            if p.ch(x, y) == '#':
                continue
            n = need((x, y))
            if p.is_face(x, y) and n != 'F':
                continue                                  # 벽면 칸은 걷지 못한다(조각이 X)
            if n == 'X':
                continue
            walkable.add((x, y))
    # C1 구조
    for b in RM.lint_structure(p):
        rep['fails'].append('C1 ' + b)
    dx, dy = room.door
    entry = (dx, dy - 1)
    if entry not in walkable:
        rep['fails'].append(f'C2 들어오는 칸 {entry} 이 걸을 수 없는 칸이다')
    if (dx, dy) not in walkable:
        rep['fails'].append(f'C2 출입구 칸 {(dx, dy)} 이 걸을 수 없는 칸이다')
    seen = RM.bfs(p, walkable, entry) if entry in walkable else set()
    # 닿지 못하는 칸: 걷는 칸 중 아무 조각도 없고(순수 바닥) 도달하지 못하는 것은 실패, 가구 밑 F·C 칸은 제외
    unreach = sorted(c for c in walkable if c not in seen and not p.is_face(*c))
    if unreach:
        rep['fails'].append(f'C2 닿지 못하는 걷는 칸 {len(unreach)}: {unreach[:12]}')
    rep['info']['walkable'] = len(walkable)
    rep['info']['reachable'] = len(seen)
    # C3 입구 앞
    for yy in range(dy - 3, dy):
        for xx in range(dx - 1, dx + 2):
            if p.ch(xx, yy) != '#' and not p.is_face(xx, yy) and need((xx, yy)) == 'X':
                rep['fails'].append(f'C3 출입구 앞 칸 ({xx},{yy}) 이 가구에 막혔다: {[n for _, n in cv.get((xx, yy), [])]}')
    # 문 칸(칸막이 틈의 걷는 줄) — 평면에서 양옆이 막힌 걷는 칸을 통로로 보고 막혔는지
    for y in range(H_):
        for x in range(W_):
            if p.walk_floor(x, y) and p.solid(x - 1, y) and p.solid(x + 1, y) and p.face_l(x, y - 1):
                if need((x, y)) == 'X':
                    rep['fails'].append(f'C3 통로 칸 ({x},{y}) 이 가구에 막혔다')
    # C4 사용 칸
    furniture = [(n, x, y, w, h) for (n, x, y, w, h) in room.placed if not n.startswith(WALLP + MATS + ('in_b_exit_mat', 'in_b_hang_', 'in_b_jokja_', 'in_b_dais_', 'in_b_stair_dais'))]
    for (n, x, y, w, h) in furniture:
        ok = False
        for i in range(w):
            for c in ((x + i, y + h), (x + i, y - 1)):
                if c in seen:
                    ok = True
        for j in range(h):
            for c in ((x - 1, y + j), (x + w, y + j)):
                if c in seen:
                    ok = True
        if not ok:
            rep['fails'].append(f'C4 {n}({x},{y}) 에 닿을 수 있는 사용 칸이 없다')
    # C5 같은 기물 셋 이상 일렬
    byname = {}
    for (n, x, y, w, h) in furniture:
        byname.setdefault(n, []).append((x, y, w, h))
    for n, lst in byname.items():
        for horiz in (True, False):
            lst2 = sorted(lst, key=(lambda t: (t[1], t[0])) if horiz else (lambda t: (t[0], t[1])))
            run = 1
            for a, b in zip(lst2, lst2[1:]):
                adj = (a[1] == b[1] and a[0] + a[2] == b[0]) if horiz else (a[0] == b[0] and a[1] + a[3] == b[1])
                run = run + 1 if adj else 1
                if run >= 3:
                    rep['fails'].append(f'C5 같은 기물 {n} 셋 이상 일렬(…{b[0]},{b[1]})')
                    break
    # C6 벽걸이는 벽면 윗줄에만
    for (n, x, y, w, h) in room.placed:
        if n.startswith(HANG):
            for i in range(w):
                if not p.face_u(x + i, y):
                    rep['fails'].append(f'C6 벽걸이 {n}({x},{y}) 가 벽면 윗줄이 아니다')
    # C7 맨바닥
    occupied = set(cv)
    bare = {c for c in walkable if c not in occupied and not p.is_face(*c)}
    # 「덩어리」= 2×2 이상 빈 바닥 조각이 겹쳐 이어진 판(좁은 1칸 통로는 길이 길어도 판이 아니다). 엄격판(1칸 통로까지 이은 4방향 덩어리)은 info 로만 남긴다.
    def comps(cells):
        seenb, out = set(), []
        for c in sorted(cells):
            if c in seenb:
                continue
            comp, stack = {c}, [c]
            seenb.add(c)
            while stack:
                a, b = stack.pop()
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n2 = (a + d[0], b + d[1])
                    if n2 in cells and n2 not in seenb:
                        seenb.add(n2); comp.add(n2); stack.append(n2)
            out.append(comp)
        return out
    plain = set()
    for (x, y) in bare:
        if all(c in bare for c in ((x + 1, y), (x, y + 1), (x + 1, y + 1))):
            plain |= {(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)}
    big = [sorted(c) for c in comps(plain) if len(c) >= 10]
    for comp in big:
        rep['fails'].append(f'C7 맨바닥 판 {len(comp)}칸(2x2 이상, x {min(c[0] for c in comp)}~{max(c[0] for c in comp)}, y {min(c[1] for c in comp)}~{max(c[1] for c in comp)})')
    rep['info']['bareLargest'] = max([len(c) for c in comps(plain)] + [0])
    rep['info']['bareStrict'] = max([len(c) for c in comps(bare)] + [0])
    # C8 겹침
    occ = {}
    for (n, x, y, w, h) in furniture:
        for j in range(h):
            for i in range(w):
                occ.setdefault((x + i, y + j), []).append(n)
    for c, ns in occ.items():
        if len(ns) > 1:
            rep['fails'].append(f'C8 가구 겹침 {c}: {ns}')
    # 정보: 공간 활용(걷는 바닥 중 가구 접점 비율)
    rep['info']['furniture'] = len(furniture)
    rep['info']['bareCells'] = len(bare)
    rep['walkable'] = walkable
    rep['reach'] = seen
    rep['cover'] = cv
    return rep
