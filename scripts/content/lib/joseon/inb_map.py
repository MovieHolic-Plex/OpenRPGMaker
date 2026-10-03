"""조선 실내 지도 조립기: 시트(in_ 조각 전부) + 평면 → map.json·pieces.json·extra.json·그림.

demo20.py 와 같은 계약(칸 번호 시트, 물체 층 겹침 칸은 시트 끝에 덧붙임, 직접 그림 == 시트 칸만으로 다시 조립한 그림).
방마다 시트는 같다(in_ 조각 전부) — 방이 늘어도 칸 번호가 바뀌지 않는다(덧붙이기 전용).
"""
import json, os
import numpy as np
from tk import Cv, T, hsh
import water_blob as WB
import inb_room as RM
import inb_kit as K

COLS = 16
BITS = (WB.N, WB.E, WB.S, WB.W, WB.NE, WB.SE, WB.SW, WB.NW)


class Sheet:
    def __init__(s, terr, objs):
        s.tiles = []
        s.pieces = {}
        s.grid = {}
        s.objs = objs
        for name, cvs in terr.items():
            ids = []
            for c in cvs:
                s.tiles.append(c)
                ids.append(len(s.tiles) - 1)
            s.pieces[name] = {'id': ids[0], 'count': len(ids), 'tiles': ids}
        for i, c in enumerate(s.tiles):
            s.grid[(i % COLS, i // COLS)] = c
        rows_used = (len(s.tiles) + COLS - 1) // COLS
        cx, cy, rh = 0, rows_used, 0
        for name, cv in objs.items():
            w, h = cv.w // T, cv.h // T
            if cx + w > COLS:
                cx, cy, rh = 0, cy + rh, 0
            ids = []
            for ty in range(h):
                r = []
                for tx in range(w):
                    t = Cv(T, T)
                    t.a = cv.a[ty * T:(ty + 1) * T, tx * T:(tx + 1) * T].copy()
                    s.grid[(cx + tx, cy + ty)] = t
                    r.append((cy + ty) * COLS + cx + tx)
                ids.append(r)
            s.pieces[name] = {'id': ids[0][0], 'w': w, 'h': h, 'tiles': ids}
            cx += w
            rh = max(rh, h)
        s.rows = cy + rh
        s.base = s.rows * COLS
        s.extra = []

    def tile(s, i):
        return s.grid[(i % COLS, i // COLS)]

    def gid(s, group, k=0):
        return s.pieces[group]['tiles'][k]

    def sheet_img(s):
        rows = (s.base + len(s.extra) + COLS - 1) // COLS
        sh = Cv(COLS * T, rows * T)
        for (cx, cy), c in s.grid.items():
            sh.paste(c, cx * T, cy * T)
        for k, c in enumerate(s.extra):
            i = s.base + k
            sh.paste(c, (i % COLS) * T, (i // COLS) * T)
        return sh, rows

    def overlap_tile(s, c):
        s.extra.append(c)
        i = s.base + len(s.extra) - 1
        s.grid[(i % COLS, i // COLS)] = c
        return i


def piece_size(sheet, name):
    p = sheet.pieces[name]
    return p['w'], p['h']


class Room:
    """평면 + 배치 → 지도. props: [(조각이름, 칸x, 칸y)] 바닥 가구·걸이. 벽면은 평면에서 자동으로 깐다(replace 로 창·문 칸을 바꿀 수 있다)."""

    def __init__(s, sheet, rid, title, plan_rows, props, door, replace=None, people=None, seed=1):
        s.sh = sheet
        s.id, s.title = rid, title
        s.plan = RM.Plan(plan_rows)
        s.props = props
        s.door = door                      # 출입구 칸(D)
        s.replace = replace or {}          # {(x,y): 조각이름} 벽면 윗줄 칸을 다른 조각(창·문)으로
        s.people = people or []
        s.seed = seed
        s.placed = []                      # [(name, x, y, w, h)] 물체 층에 놓은 조각 전부(놓은 순서)
        s._build()

    def _build(s):
        p, sh = s.plan, s.sh
        W, H = p.W, p.H
        s.W, s.H = W, H
        s.ground = [[0] * W for _ in range(H)]
        s.kind = [['floor'] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                if p.solid(x, y):
                    s.ground[y][x] = sh.gid('in_b_ceil47', WB.index47(p.ceil_mask(x, y, BITS)))
                    s.kind[y][x] = 'void'
                    continue
                fk = p.floor_kind(x, y)
                mode = p.shade_mode(x, y)
                if mode:
                    s.ground[y][x] = sh.gid('in_b_%s_sh' % fk, {'n': 0, 'w': 1, 'nw': 2}[mode])
                else:
                    if fk == 'ondol':
                        v = (2 if x % 2 == 1 else 0) + (1 if y % 2 == 1 else 0)     # 장판 이음매가 두 칸마다 규칙적으로 이어진다
                    else:
                        v = hsh(x, y, 5 + s.seed) % 4
                    s.ground[y][x] = sh.gid('in_b_' + fk, v)
        items = []        # (z, 순서, 이름, x, y)
        order = 0
        for (x, y, kind, ends) in RM.faces(p):
            nm = s.replace.get((x, y)) or ('in_b_wall_%s_%s' % (kind, ends))
            items.append((y + 2, order, nm, x, y)); order += 1
        for (nm, x, y) in s.props:
            w, h = piece_size(sh, nm)
            items.append((y + h, order, nm, x, y)); order += 1
        # 출입구
        dx, dy = s.door
        items.append((dy + 1, order, 'in_b_exit_mat', dx, dy)); order += 1
        items.sort(key=lambda i: (i[0], i[1]))
        s.items = items
        s.placed = [(nm, x, y) + piece_size(sh, nm) for (_, _, nm, x, y) in items]
        s.obj = Cv(W * T, H * T)
        for (_, _, nm, x, y) in items:
            s.obj.paste(sh.objs[nm], x * T, y * T)

    # --- 렌더
    def direct(s):
        cv = Cv(s.W * T, s.H * T)
        for y in range(s.H):
            for x in range(s.W):
                cv.paste(s.sh.tile(s.ground[y][x]), x * T, y * T)
        cv.paste(s.obj, 0, 0)
        return cv

    def object_ids(s):
        sh = s.sh
        lookup = {}
        for (cx, cy), c in sh.grid.items():
            lookup.setdefault(c.a.tobytes(), cy * COLS + cx)
        ids = [[-1] * s.W for _ in range(s.H)]
        for y in range(s.H):
            for x in range(s.W):
                sub = s.obj.a[y * T:(y + 1) * T, x * T:(x + 1) * T]
                if sub[:, :, 3].max() == 0:
                    continue
                key = sub.tobytes()
                if key not in lookup:
                    c = Cv(T, T); c.a = sub.copy()
                    lookup[key] = sh.overlap_tile(c)
                ids[y][x] = lookup[key]
        s.obj_ids = ids
        return ids

    def reassemble(s):
        cv = Cv(s.W * T, s.H * T)
        for y in range(s.H):
            for x in range(s.W):
                cv.paste(s.sh.tile(s.ground[y][x]), x * T, y * T)
        for y in range(s.H):
            for x in range(s.W):
                if s.obj_ids[y][x] >= 0:
                    cv.paste(s.sh.tile(s.obj_ids[y][x]), x * T, y * T)
        return cv

    def extra_json(s, kinds):
        """groundKind: 바닥 칸 'floor', 천장·어둠 'void'(걸을 수 없는 칸)."""
        dx, dy = s.door
        return {
            'width': s.W, 'height': s.H,
            'placed': [{'name': n, 'x': x, 'y': y, 'w': w, 'h': h} for (n, x, y, w, h) in s.placed],
            'groundKind': s.kind,
            'doors': [{'x': dx, 'y': dy, 'piece': 'in_b_exit_mat', 'kind': 'exit'}],
            'entry': {'x': dx, 'y': dy - 1},
            'start': {'x': dx, 'y': dy - 1},
            'people': s.people,
            'interior': True,
        }
