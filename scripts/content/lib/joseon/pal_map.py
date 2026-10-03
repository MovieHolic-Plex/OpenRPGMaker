"""조선 궁 내부 지도 조립기 — 후보 B 의 inb_map.Sheet·Room 을 잇는다. 이름 접두(pal_ 궁 전용, in_b_ 후보 B 재사용)와 평면(pal_room)만 다르다.
방마다 시트는 같다(in_b_ + pal_ 조각 전부, 덧붙이기 전용). 직접 그림 == 시트 칸만으로 다시 조립한 그림(sheet-reassemble pixelDiff 0)."""
import json, os
import numpy as np
from tk import Cv, T, hsh
import water_blob as WB
import inb_map as IM
import pal_room as PR

Sheet = IM.Sheet
COLS = IM.COLS
BITS = IM.BITS
piece_size = IM.piece_size

FLOOR_GROUP = {'jeon': 'pal_jeon', 'maru': 'in_b_maru', 'ondol': 'in_b_ondol'}


class PalRoom(IM.Room):
    def __init__(s, sheet, rid, title, plan_rows, props, door, replace=None, people=None, seed=1, doors_extra=None):
        s.sh = sheet
        s.id, s.title = rid, title
        s.plan = PR.PPlan(plan_rows)
        s.props = props
        s.door = door
        s.replace = replace or {}
        s.people = people or []
        s.seed = seed
        s.doors_extra = doors_extra or []
        s.placed = []
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
                    s.ground[y][x] = sh.gid('pal_ceil47', WB.index47(p.ceil_mask(x, y, BITS)))
                    s.kind[y][x] = 'void'
                    continue
                fk = p.floor_kind(x, y)
                grp = FLOOR_GROUP[fk]
                mode = p.shade_mode(x, y)
                if mode:
                    s.ground[y][x] = sh.gid(grp + '_sh', {'n': 0, 'w': 1, 'nw': 2}[mode])
                else:
                    if fk == 'ondol':
                        v = (2 if x % 2 == 1 else 0) + (1 if y % 2 == 1 else 0)
                    else:
                        v = hsh(x, y, 5 + s.seed) % 4
                    s.ground[y][x] = sh.gid(grp, v)
        items = []
        order = 0
        for (x, y, kind, ends) in PR.faces(p):
            nm = s.replace.get((x, y)) or ('pal_wall_%s_%s' % (kind, ends))
            items.append((y + 2, order, nm, x, y)); order += 1
        for (nm, x, y) in s.props:
            w, h = piece_size(sh, nm)
            z = y + h
            if nm.startswith('pal_hang_'):                  # 벽에 거는 것은 벽면(z=y+2) 위에 그려야 한다(1줄짜리 등롱이 벽에 가려지지 않게)
                z = max(z, y + 2)
            items.append((z, order, nm, x, y)); order += 1
        dx, dy = s.door
        items.append((dy + 1, order, 'in_b_exit_mat', dx, dy)); order += 1
        items.sort(key=lambda i: (i[0], i[1]))
        s.items = items
        s.placed = [(nm, x, y) + piece_size(sh, nm) for (_, _, nm, x, y) in items]
        s.obj = Cv(W * T, H * T)
        for (_, _, nm, x, y) in items:
            s.obj.paste(sh.objs[nm], x * T, y * T)

    def extra_json(s, kinds):
        j = IM.Room.extra_json(s, kinds)
        for d in s.doors_extra:                       # [{x,y,piece,kind}] 협문·방문 앞 칸(걸어 들어가는 문 앞)
            j['doors'].append(dict(d))
        return j
