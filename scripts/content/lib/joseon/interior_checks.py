"""조선 실내 방 맵 자동 점검 (mapgate.py 의 interior 프로필이 판정한다).

통행은 변환기(build-joseon-tileset.py)와 같은 규칙을 쓴다 — joseon_tileset.walk 의 build_piece_walk(자동 + piece-walk-overrides.json) 로
조각 칸 통행(X/C/F)을 구하고, 한 칸에 여러 조각이 겹치면 X>F>C, 조각이 없으면 바닥(천장 = 막힘, 바닥 = 걸음).

  I1 exit_unreached  시작 칸(출입구 바로 위)에서 걸어서 닿지 못하는 걷는 칸 — 기물이 통로를 막아 생긴 고립 칸
  I2 use_unreached   접근 칸이 없는 기물(막힌 기물의 4방 이웃 중 도달 가능한 칸이 없음) / door_blocked 출입구 위 INT_DOOR_CLEAR 줄이 막힘
  I3 triples         같은 기물 3개 일렬(가로·세로, 칸 간격 ≤ 1)
  I4 wall_rule       벽면 두 줄 구조(평면 유도 오류) · 벽 가구 규칙(벽걸이는 벽면 위에만, 키 큰 가구는 바닥에 서고 윗부분만 벽에 걸침, 고체 칸 위 금지) · 기물 겹침
  I5 bare_runs       물체가 하나도 안 덮은 걷는 칸이 가로 또는 세로로 INT_BARE_RUN 칸 이상 이어짐
  I6 pairs           같은 기물 둘이 가로·세로로 INT_PAIR_GAP 칸 이내에 붙어 있음(복제 쌍 — 적대 검수 R6) / bare_rect 맨바닥이 INT_BARE_RECT 칸 이상의 직사각형으로 비어 있음
  I7 door_no_yard    출입구 아래에 문 밖 마당 두 줄이 없음 · wall_ring 외곽이 벽(#)·출입구가 아님 · no_shadow 접지 그림자가 하나도 없음(적대 검수 R1·R2·R7)
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'lib'))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'harness'))
from joseon_tileset import walk as W
import in_meta

META = os.path.join(HERE, 'harness', 'pieces_meta.json')
OVR = os.path.join(ROOT, 'tiledata', 'joseon-village', 'piece-walk-overrides.json')
INT_BARE_RUN, INT_TRIPLE, INT_DOOR_CLEAR = 10, 3, 2        # mapgate.py 의 같은 이름 상수와 같다(여기서도 읽는다)
INT_PAIR_GAP, INT_BARE_RECT = 1, 15
try:
    import mapgate as _mg
    INT_BARE_RUN, INT_TRIPLE, INT_DOOR_CLEAR = _mg.INT_BARE_RUN, _mg.INT_TRIPLE, _mg.INT_DOOR_CLEAR
    INT_PAIR_GAP, INT_BARE_RECT = _mg.INT_PAIR_GAP, _mg.INT_BARE_RECT
except Exception:
    pass


WALLP = ('in_wall_', 'pal_wall_')
STRUCT = ('in_wall_', 'pal_wall_', 'in_pillar', 'pal_pillar', 'in_ceil_beam', 'pal_ceil_beam', 'in_dais', 'pal_dais', 'in_exit', 'pal_exit', 'in_runner', 'pal_stairs')
PAIR_OK = STRUCT + ('in_hakdong_sang', 'in_bangseok', 'pal_bangseok', 'in_mat_', 'in_jipjari', 'in_hang_', 'pal_deung', 'in_chotdae', 'pal_chotdae')   # 쌍으로 서는 것이 본질(방석 줄·좌우 촛대·등)
SEAT_OK = ('in_gwan_chair', 'pal_throne', 'pal_uija')
STAIRS = ('in_stairs_wood_3', 'in_stairs_wood_2', 'in_stairs_stone_3', 'pal_stairs_big')


def piece_walk(sheet):
    objs = {n: p for n, p in sheet.pieces.items() if 'w' in p}
    meta = json.load(open(META))
    ov = json.load(open(OVR))
    return W.build_piece_walk(objs, lambda i: sheet.tile(i).a, meta, ov)


def analyze(room, sheet, walk=None):
    walk = walk or piece_walk(sheet)
    Wd, Ht = room.W, room.H
    cover = {}
    for (n, x, y, w, h) in room.placed:
        wk = walk[n]
        for j in range(h):
            for i in range(w):
                ch = wk['rows'][j][i]
                if ch != '.' and 0 <= x + i < Wd and 0 <= y + j < Ht:
                    cover.setdefault((x + i, y + j), []).append((ch, n))

    def cls(x, y):
        cs = [c for c, _ in cover.get((x, y), [])]
        return W.merge_chars(cs) if cs else None

    ok = [[False] * Wd for _ in range(Ht)]
    for y in range(Ht):
        for x in range(Wd):
            if room.solid(x, y):
                ok[y][x] = False
                continue
            c = cls(x, y)
            ok[y][x] = False if c == 'X' else True        # F·C·없음 = 바닥이 걸음
            if room.wallrow[y][x] > 0 and c is None:      # 벽면 칸은 벽 조각이 반드시 덮는다
                ok[y][x] = False
    rep = {k: [] for k in ('exit_unreached', 'use_unreached', 'door_blocked', 'triples', 'wall_rule', 'overlap', 'bare_runs', 'pairs', 'bare_rect', 'door_no_yard', 'wall_ring', 'no_shadow', 'bad_people', 'people_blocking')}
    # I1 도달
    sx, sy = room.start_cell()
    seen = set()
    if ok[sy][sx]:
        q = [(sx, sy)]
        seen.add((sx, sy))
        while q:
            x, y = q.pop()
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                X, Y = x + dx, y + dy
                if 0 <= X < Wd and 0 <= Y < Ht and ok[Y][X] and (X, Y) not in seen:
                    seen.add((X, Y)); q.append((X, Y))
    else:
        rep['exit_unreached'].append(('start-blocked', sx, sy))
    for (ex, ey, ew) in room.exit_runs():
        for k in range(ew):
            if not ok[ey][ex + k] or (ex + k, ey) not in seen:
                rep['exit_unreached'].append(('exit', ex + k, ey))
    for y in range(Ht):
        for x in range(Wd):
            if ok[y][x] and (x, y) not in seen:
                rep['exit_unreached'].append((x, y))
    # I2 출입구 앞
    for (ex, ey, ew) in room.exit_runs():
        for k in range(ew):
            for d in range(1, INT_DOOR_CLEAR + 1):
                if not ok[ey - d][ex + k]:
                    rep['door_blocked'].append((ex + k, ey - d))
    # 기물 접근
    for (n, x, y, w, h) in room.placed:
        if n.startswith(WALLP) or n in in_meta.HUNG:
            continue
        wk = walk[n]
        if all(ch in 'F.C' for r in wk['rows'] for ch in r):
            continue                                   # 걷는 바닥 장식
        nb = set()
        for j in range(h):
            for i in range(w):
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    X, Y = x + i + dx, y + j + dy
                    if not (x <= X < x + w and y <= Y < y + h):
                        nb.add((X, Y))
        if not any((c in seen) for c in nb):
            rep['use_unreached'].append((n, x, y))
    # I3 일렬
    byname = {}
    for (n, x, y, w, h) in room.placed:
        if n.startswith(STRUCT):
            continue
        byname.setdefault(n, []).append((x, y, w, h))
    for n, lst in byname.items():
        if len(lst) < INT_TRIPLE:
            continue
        for axis in (0, 1):
            groups = {}
            for (x, y, w, h) in lst:
                groups.setdefault((y, h) if axis == 0 else (x, w), []).append((x, y, w, h))
            for key, g in groups.items():
                g = sorted(g, key=lambda t: t[axis])
                run = [g[0]]
                for a, b in zip(g, g[1:]):
                    gap = b[axis] - (a[axis] + (a[2] if axis == 0 else a[3]))
                    if gap <= 1:
                        run.append(b)
                    else:
                        if len(run) >= INT_TRIPLE:
                            rep['triples'].append((n, 'row' if axis == 0 else 'col', run[0][0], run[0][1], len(run)))
                        run = [b]
                if len(run) >= INT_TRIPLE:
                    rep['triples'].append((n, 'row' if axis == 0 else 'col', run[0][0], run[0][1], len(run)))
    # I4 벽 규칙
    rep['wall_rule'] += [e for e in room.errors]
    for (n, x, y, w, h) in room.placed:
        if n.startswith(('in_wall_', 'pal_wall_', 'in_exit', 'pal_exit')):
            continue
        wk = walk[n]
        cells = [(x + i, y + j, j) for j in range(h) for i in range(w) if wk['rows'][j][i] != '.']
        for (cx, cy, j) in cells:
            if not (0 <= cx < Wd and 0 <= cy < Ht) or room.solid(cx, cy):
                rep['wall_rule'].append(('고체 칸 위', n, cx, cy)); break
        if n in in_meta.HUNG:
            for (cx, cy, j) in cells:
                if room.wallrow[cy][cx] == 0:
                    rep['wall_rule'].append(('벽걸이가 벽면 밖', n, cx, cy)); break
            continue
        for i in range(w):
            col = [(x + i, y + j) for j in range(h) if wk['rows'][j][i] != '.']
            if not col:
                continue
            bottom = col[-1]
            wr = [room.wallrow[cy][cx] for cx, cy in col]
            if wr[-1] > 0 and n not in STAIRS:
                rep['wall_rule'].append(('기물이 벽면에 떠 있다(밑줄이 벽면)', n, bottom[0], bottom[1])); break
            # 벽면에 걸친 위쪽 칸은 연속이어야 한다(바닥 → 벽면 순)
            if any(wr[k] == 0 and any(v > 0 for v in wr[k + 1:]) for k in range(len(wr))):
                rep['wall_rule'].append(('벽면 위에서 바닥으로 이어지지 않음', n, col[0][0], col[0][1])); break
    # 기물 겹침(벽 조각 제외, X 끼리)
    for pos, lst in cover.items():
        xs = [n for c, n in lst if c == 'X' and not n.startswith(('in_wall_', 'pal_wall_', 'in_exit', 'pal_exit'))]
        if len(xs) > 1:
            rep['overlap'].append((pos, xs))
    # I5 맨바닥
    # 궁 방: 카펫 띠·월대 윗면은 「의도적으로 구분된 공간」이라 맨바닥으로 세지 않는다(물체가 없어도 용도가 있다). 일반 바닥만 센다.
    marked = set(room.K['carpet'] or '') | (set('w') if room.kit == 'pal' else set()) | {'y'}
    bare = [[(not room.solid(x, y)) and room.wallrow[y][x] == 0 and not any(ch in 'XF' for ch, _n in cover.get((x, y), [])) and room.ch(x, y) != 'E' and room.floor_char(x, y) not in marked for x in range(Wd)] for y in range(Ht)]
    for y in range(Ht):
        run = 0
        for x in range(Wd + 1):
            if x < Wd and bare[y][x]:
                run += 1
            else:
                if run >= INT_BARE_RUN:
                    rep['bare_runs'].append(('row', x - run, y, run))
                run = 0
    for x in range(Wd):
        run = 0
        for y in range(Ht + 1):
            if y < Ht and bare[y][x]:
                run += 1
            else:
                if run >= INT_BARE_RUN:
                    rep['bare_runs'].append(('col', x, y - run, run))
                run = 0
    # I6 복제 쌍: 같은 기물이 가로·세로로 간격 INT_PAIR_GAP 칸 이내에 나란히
    for n, lst in byname.items():
        if n.startswith(PAIR_OK) or len(lst) < 2:
            continue
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                (x1, y1, w1, h1), (x2, y2, w2, h2) = lst[i], lst[j]
                row_overlap = y1 < y2 + h2 and y2 < y1 + h1
                col_overlap = x1 < x2 + w2 and x2 < x1 + w1
                gx = max(x1, x2) - min(x1 + w1, x2 + w2)
                gy = max(y1, y2) - min(y1 + h1, y2 + h2)
                if (row_overlap and gx <= INT_PAIR_GAP) or (col_overlap and gy <= INT_PAIR_GAP):
                    rep['pairs'].append((n, (x1, y1), (x2, y2)))
    # 맨바닥 최대 직사각형(히스토그램 스택)
    heights = [0] * Wd
    best = (0, 0, 0, 0, 0)
    for y in range(Ht):
        for x in range(Wd):
            heights[x] = heights[x] + 1 if bare[y][x] else 0
        st = []
        for x in range(Wd + 1):
            cur = heights[x] if x < Wd else 0
            start = x
            while st and st[-1][1] >= cur:
                sx, sh = st.pop()
                area = sh * (x - sx)
                if area > best[0]:
                    best = (area, sx, y - sh + 1, x - sx, sh)
                start = sx
            st.append((start, cur))
    if best[0] >= INT_BARE_RECT:
        rep['bare_rect'].append(('rect', best[1], best[2], best[3], best[4], best[0]))
    # I7 인물: 조선에 맞는 프레임만, 막힌 칸·문 앞 2칸 위에 서지 않는다(동선을 막지 않는다)
    import people as _PP
    for (px, py, ch, *_r) in room.people:
        px += room.ox
        if ch not in _PP.OK_CHARS:
            rep['bad_people'].append((px, py, ch))
        seated = all(n in SEAT_OK for _c, n in cover.get((px, py), []))     # 의자에 앉은 사람은 막힌 칸 위에 있어도 된다
        if not ok[py][px] and not (seated and cover.get((px, py))):
            rep['people_blocking'].append((px, py, '막힌 칸'))
        for (ex, ey, ew) in room.exit_runs():
            if ex - 1 <= px <= ex + ew and ey - INT_DOOR_CLEAR <= py < ey:
                rep['people_blocking'].append((px, py, '문 앞'))
    # I7 문 밖 마당·외곽 벽·접지 그림자
    for (ex, ey, ew) in room.exit_runs():
        for k in range(ew):
            if room.ch(ex + k, ey + 1) != 'y' or room.ch(ex + k, ey + 2) != 'y':
                rep['door_no_yard'].append((ex + k, ey))
    if room.kit == 'in' or room.kit == 'pal':
        last = room.H - 1 - (2 if room.exits else 0)
        for x in range(room.W):
            for y in (0, last):
                if room.ch(x, y) not in ('#', 'E'):
                    rep['wall_ring'].append((x, y))
        for y in range(last + 1):
            for x in (0, room.W - 1):
                if room.ch(x, y) != '#':
                    rep['wall_ring'].append((x, y))
    if getattr(room, 'shadow_px', 0) == 0 and any(not n.startswith(('in_wall_', 'pal_wall_')) for (n, *_r) in room.placed):
        rep['no_shadow'].append('접지 그림자 0화소')
    floor_cells = sum(1 for y in range(Ht) for x in range(Wd) if not room.solid(x, y) and room.wallrow[y][x] == 0 and room.ch(x, y) not in ('E', 'y'))
    rep['_floor_cells'] = floor_cells
    rep['_bare_cells'] = sum(1 for y in range(Ht) for x in range(Wd) if bare[y][x])
    rep['_reached'] = len(seen)
    room.walk_ok = ok
    room.walk_seen = seen
    return rep
