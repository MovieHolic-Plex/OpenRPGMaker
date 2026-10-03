"""조선 실내 방 빌더 — 평면도 문자열에서 천장·벽면·바닥 그늘을 유도하고, 시트 칸 번호만으로 다시 조립해 증명한다.

평면 문자:  #  고체(천장·칸막이) / o 온돌 장판 / m 마루 / d 흙바닥 / s 돌바닥 / j 전돌 / E 남벽 출입구(고체 줄의 틈, 바닥은 위 칸을 따른다)
  - 고체 칸 바로 밑 두 줄 = 벽면(1×2 조각). 벽 종류는 그 칸의 바닥 문자로 정한다(WALL_OF), 방마다 덮어쓸 수 있다.
  - 벽면 두 줄 아래 바닥 줄은 「북쪽 그늘」, 서쪽에 고체·벽면이 있는 바닥은 「서쪽 그늘」 변형.
  - 두꺼운 칸막이의 통로는 3줄(벽면 2 + 바닥 1)이어야 한다 — build() 가 구조 오류를 모아 알려 준다(lintStructure 의 「구조:」).
출력(tiledata/joseon-interior/<id>/): map.json(칸 번호 격자) · pieces.json · <id>-chipset.png(공용 키트 + 이 방의 겹침 칸) · extra.json · map/map-from-sheet/map-people PNG.
"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from tk import *
import interior_kit as IK

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
OUTROOT = os.path.join(ROOT, 'tiledata', 'joseon-interior')
COLS = 16
FLOOR_CH = {'o': 'ondol', 'm': 'maru', 'd': 'dirt', 's': 'stone', 'j': 'jeondol'}
RAISED = ('o', 'm')                     # 앞 턱(lip)이 생기는 높은 바닥
WALL_OF = {'o': 'hoe', 'm': 'hoe', 'd': 'heuk', 's': 'dol', 'j': 'hoe'}


def all_terrain():
    d = IK.terrain()
    try:
        import props_in
        d.update(props_in.terrain())
    except ImportError:
        pass
    return d


def all_objects():
    d = IK.objects()
    try:
        import props_in
        d.update(props_in.objects())
    except ImportError:
        pass
    return d


def slice_tiles(cv):
    out = []
    for ty in range(cv.h // T):
        out.append([])
        for tx in range(cv.w // T):
            c = Cv(T, T)
            c.a = cv.a[ty * T:(ty + 1) * T, tx * T:(tx + 1) * T].copy()
            out[-1].append(c)
    return out


class Sheet:
    """공용 키트 시트: 지형 묶음(평면 줄) 다음 물체 조각을 선반 쌓기로. 같은 입력이면 칸 번호가 항상 같다."""

    def __init__(self):
        self.terr = all_terrain()
        self.objs = all_objects()
        self.grid = {}
        self.pieces = {}
        n = 0
        for name, tl in self.terr.items():
            ids = []
            for c in tl:
                self.grid[(n % COLS, n // COLS)] = c
                ids.append(n)
                n += 1
            self.pieces[name] = {'id': ids[0], 'count': len(ids), 'tiles': ids}
            if n % COLS:                                        # 묶음마다 줄 맞춤
                n += COLS - n % COLS
        cur_x, cur_y, row_h = 0, (n + COLS - 1) // COLS, 0
        for name, cv in self.objs.items():
            w, h = cv.w // T, cv.h // T
            if cur_x + w > COLS:
                cur_x, cur_y, row_h = 0, cur_y + row_h, 0
            ts = slice_tiles(cv)
            ids = []
            for ty in range(h):
                r = []
                for tx in range(w):
                    self.grid[(cur_x + tx, cur_y + ty)] = ts[ty][tx]
                    r.append((cur_y + ty) * COLS + cur_x + tx)
                ids.append(r)
            self.pieces[name] = {'id': ids[0][0], 'w': w, 'h': h, 'tiles': ids}
            cur_x += w
            row_h = max(row_h, h)
        self.rows = cur_y + row_h
        self.base = self.rows * COLS
        self.extra = []                                         # 방별 겹침 칸

    def tile(self, i):
        return self.grid.get((i % COLS, i // COLS))

    def image(self):
        rows = (self.base + len(self.extra) + COLS - 1) // COLS
        sh = Cv(COLS * T, rows * T)
        for (cx, cy), c in self.grid.items():
            sh.paste(c, cx * T, cy * T)
        for k, c in enumerate(self.extra):
            sh.paste(c, ((self.base + k) % COLS) * T, ((self.base + k) // COLS) * T)
        return sh, rows


class Room:
    def __init__(self, rid, name, plan, wall_of=None):
        self.id, self.name = rid, name
        self.plan = [r.rstrip() for r in plan.strip('\n').split('\n')]
        self.H = len(self.plan)
        self.W = max(len(r) for r in self.plan)
        self.plan = [r.ljust(self.W, '#') for r in self.plan]
        self.wall_of = dict(WALL_OF, **(wall_of or {}))
        self.items = []             # (조각 이름, x, y)
        self.people = []            # (x, y, char, dir, frame)
        self.feat = {}              # (x, y) -> 'win' | 'door' : 벽면 위 칸의 창·문 변형
        self.wall_override = {}     # (x, y) -> 벽 종류(그 칸만)
        self.errors = []
        self.entrance = None
        self.derive()

    # ---------------------------------------------------------- 평면 → 구조
    def ch(self, x, y):
        return self.plan[y][x] if 0 <= x < self.W and 0 <= y < self.H else '#'

    def solid(self, x, y):
        return self.ch(x, y) == '#'

    def derive(self):
        W, H = self.W, self.H
        self.wallrow = [[0] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                c = self.ch(x, y)
                if c in ('#', 'E'):
                    continue
                if y > 0 and self.solid(x, y - 1):
                    self.wallrow[y][x] = 1
                elif y > 0 and self.wallrow[y - 1][x] == 1:
                    self.wallrow[y][x] = 2
        # 벽면 위 줄은 바로 밑 칸이 벽면 아래 줄(바닥 칸)이어야 한다
        for y in range(H):
            for x in range(W):
                if self.wallrow[y][x] == 1 and not (y + 1 < H and self.wallrow[y + 1][x] == 2):
                    self.errors.append(f'구조: ({x},{y}) 벽면 위 줄 밑이 바닥이 아니다(벽면 2줄 필요, 통로는 3줄)')
        for y in range(H):
            for x in range(W):
                if self.ch(x, y) == 'E':
                    self.entrance = getattr(self, 'entrance', None)
        self.exits = [(x, y) for y in range(H) for x in range(W) if self.ch(x, y) == 'E']

    def floor_char(self, x, y):
        """바닥 칸의 바닥 문자. E 는 위(북) 칸을 따른다."""
        c = self.ch(x, y)
        if c == 'E':
            return self.floor_char(x, y - 1)
        return c

    def wall_kind(self, x, y):
        if (x, y) in self.wall_override:
            return self.wall_override[(x, y)]
        return self.wall_of.get(self.ch(x, y), 'hoe')

    # ---------------------------------------------------------- 아이템
    def put(self, name, x, y):
        self.items.append((name, x, y))

    # ---------------------------------------------------------- 조립
    def build(self, sheet, outdir=None, check=True, candidate=True):
        W, H = self.W, self.H
        T_ = sheet.pieces
        tr = {k: v for k, v in sheet.pieces.items() if 'count' in v}
        # 지면
        ground = [[0] * W for _ in range(H)]
        gkind = [[None] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                if self.solid(x, y):
                    m = 0
                    for bit, (dx, dy) in ((IK.N_, (0, -1)), (IK.E__, (1, 0)), (IK.S__, (0, 1)), (IK.W__, (-1, 0)),
                                          (IK.NE_, (1, -1)), (IK.SE_, (1, 1)), (IK.SW_, (-1, 1)), (IK.NW_, (-1, -1))):
                        if self.solid(x + dx, y + dy):
                            m |= bit
                    ground[y][x] = tr['in_ceil47']['tiles'][IK.INDEX47[IK._canon(m)]]
                    gkind[y][x] = 'void'
                    continue
                fc = self.floor_char(x, y)
                g = tr['in_floor_' + FLOOR_CH[fc]]['tiles']
                v = (x % 2) if fc == 'o' else (x + y) % 2
                south = self.floor_char(x, y + 1) if y + 1 < H and not self.solid(x, y + 1) else None
                raised_edge = (fc in RAISED and len(g) > 6 and south is not None and south not in RAISED and self.ch(x, y + 1) != 'E' and y + 1 < H)
                under = y > 0 and self.wallrow[y - 1][x] == 2 and self.wallrow[y][x] == 0
                west = x > 0 and (self.solid(x - 1, y) or self.wallrow[y][x - 1] > 0)
                if raised_edge:
                    ground[y][x] = g[6]
                elif under and west:
                    ground[y][x] = g[4]
                elif under:
                    ground[y][x] = g[2 + 3 * v]          # 2 또는 5
                elif west:
                    ground[y][x] = g[3]
                else:
                    ground[y][x] = g[v]
                gkind[y][x] = 'other'
        # 물체: 벽면 → 기물
        placed = []
        for y in range(H):
            for x in range(W):
                if self.wallrow[y][x] == 1:
                    kind = self.wall_kind(x, y)
                    f = self.feat.get((x, y))
                    if f and f'in_wall_{kind}_{f}' in T_:
                        name = f'in_wall_{kind}_{f}'
                    else:
                        L = (x > 0 and self.wallrow[y][x - 1] == 1 and self.wall_kind(x - 1, y) == kind)
                        R = (x + 1 < W and self.wallrow[y][x + 1] == 1 and self.wall_kind(x + 1, y) == kind)
                        e = 'm' if (L and R) else ('r' if L else ('l' if R else 'lr'))
                        name = f'in_wall_{kind}_{e}'
                    placed.append((name, x, y, 1, 2))
        for (x, y, w) in self.exit_runs():
            placed.append(('in_exit_door' if w == 1 else 'in_exit_door2', x, y, w, 1))
        for (nm, x, y) in self.items:
            p = T_[nm]
            placed.append((nm, x, y, p['w'], p['h']))
        self.placed = placed
        # 합성 물체 층
        OBJ = Cv(W * T, H * T)
        order = sorted(range(len(placed)), key=lambda i: (0 if placed[i][0].startswith('in_wall_') else 1, placed[i][2] + placed[i][4], placed[i][1], i))
        for i in order:
            nm, x, y, w, h = placed[i]
            OBJ.paste(sheet.objs[nm], x * T, y * T)
        # 시트 칸으로 환원(같은 그림이면 같은 칸 번호, 합성 칸은 시트 끝 겹침 구역)
        lookup = {}
        for (cx, cy), c in sheet.grid.items():
            lookup.setdefault(c.a.tobytes(), cy * COLS + cx)
        obj_ids = [[-1] * W for _ in range(H)]
        new = {}
        for y in range(H):
            for x in range(W):
                sub = OBJ.a[y * T:(y + 1) * T, x * T:(x + 1) * T]
                if sub[:, :, 3].max() == 0:
                    continue
                key = sub.tobytes()
                if key in lookup:
                    obj_ids[y][x] = lookup[key]
                else:
                    if key not in new:
                        c = Cv(T, T); c.a = sub.copy()
                        new[key] = len(sheet.extra)
                        sheet.extra.append(c)
                    obj_ids[y][x] = sheet.base + new[key]
        # 직접 렌더 vs 시트 재조립
        def tile_by_id(i):
            if i >= sheet.base:
                return sheet.extra[i - sheet.base]
            return sheet.tile(i)
        direct = Cv(W * T, H * T)
        for y in range(H):
            for x in range(W):
                direct.paste(tile_by_id(ground[y][x]), x * T, y * T)
        direct.paste(OBJ, 0, 0)
        re = Cv(W * T, H * T)
        for y in range(H):
            for x in range(W):
                re.paste(tile_by_id(ground[y][x]), x * T, y * T)
                if obj_ids[y][x] >= 0:
                    re.paste(tile_by_id(obj_ids[y][x]), x * T, y * T)
        diff = int((direct.a != re.a).any(axis=2).sum())
        self.ground, self.obj_ids, self.gkind, self.direct, self.re, self.diff = ground, obj_ids, gkind, direct, re, diff
        self.OBJ = OBJ
        if outdir:
            self.write(sheet, outdir)
        return diff

    def write(self, sheet, outdir):
        import people as _pp
        os.makedirs(outdir, exist_ok=True)
        sh, rows = sheet.image()
        sh.img().save(os.path.join(outdir, f'{self.id}-chipset.png'))
        self.direct.img().save(os.path.join(outdir, f'{self.id}-map.png'))
        self.re.img().save(os.path.join(outdir, f'{self.id}-map-from-sheet.png'))
        _pp.overlay(self.direct.img(), self.people).save(os.path.join(outdir, f'{self.id}-map-people.png'))
        pieces = {k: v for k, v in sheet.pieces.items()}
        json.dump({'tile': T, 'cols': COLS, 'rows': rows, 'tileCount': sheet.base + len(sheet.extra), 'pieces': pieces,
                   'overlapTiles': {'start': sheet.base, 'count': len(sheet.extra)}},
                  open(os.path.join(outdir, 'pieces.json'), 'w'), ensure_ascii=False, indent=1)
        json.dump({'width': self.W, 'height': self.H, 'ground': self.ground, 'object': self.obj_ids},
                  open(os.path.join(outdir, 'map.json'), 'w'))
        kind = {'other': 'other', 'void': 'void'}
        doors = [{'x': x, 'y': y, 'piece': 'in_exit_door' if w == 1 else 'in_exit_door2'} for (x, y, w) in self.exit_runs()]
        sx, sy = self.start_cell()
        json.dump({'width': self.W, 'height': self.H, 'kind': 'interior',
                   'placed': [{'name': n, 'x': x, 'y': y, 'w': w, 'h': h} for (n, x, y, w, h) in self.placed],
                   'groundKind': [[kind[self.gkind[y][x]] for x in range(self.W)] for y in range(self.H)],
                   'doors': doors, 'start': {'x': sx, 'y': sy},
                   'people': [{'x': p[0], 'y': p[1], 'char': p[2], 'dir': {0: 'up', 1: 'right', 2: 'down', 3: 'left'}[p[3]], 'frame': p[4]} for p in self.people]},
                  open(os.path.join(outdir, 'extra.json'), 'w'), ensure_ascii=False)

    def exit_runs(self):
        """출입구 칸 묶음(가로로 이어진 E): [(x, y, 폭)]. 폭 2 이상이면 in_exit_door2 로 놓는다."""
        runs, seen = [], set()
        for (x, y) in self.exits:
            if (x, y) in seen:
                continue
            w = 1
            while (x + w, y) in self.exits_set():
                w += 1
            for k in range(w):
                seen.add((x + k, y))
            runs.append((x, y, w))
        return runs

    def exits_set(self):
        return set(self.exits)

    def start_cell(self):
        """플레이어 시작 칸: 출입구 바로 위 칸."""
        x, y = self.exits[0]
        return x, y - 1


def load_people():
    import people as _pp
    return _pp
