"""사냥터·동굴 맵 빌더 공용 틀(demo_field.py · demo_cave.py 가 쓴다).

demo_gungnae_full.py 와 같은 산출 계약이다: 지형 칸(바닥) + 물체 층(조각 칸) → 시트 칸 번호만으로 다시 조립해 pixelDiff 0 증명 →
지도 게이트(mapgate.py 프로필) → 사람 오버레이(Actor1) → map.json · pieces.json · extra.json · PNG 4장.
국내성 빌더와 다른 점: 칸 통행은 **실제 변환기와 같은 규칙**(joseon_tileset.walk + pieces_meta + piece-walk-overrides.json)으로 미리 계산해
배치·점검에 쓴다(근사 BODY 집합이 아니다). 그래서 자동 점검 단언이 변환기가 굽는 통행과 어긋나지 않는다.

좌표 약속: (x, y) 는 칸. 물체 조각의 왼쪽 위 칸이 (x, y).
"""
import json, os, sys, glob, pickle, random, collections
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, 'harness'))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'lib'))
from tk import *
from PIL import Image

N, E, S, W = 1, 2, 4, 8
DIRS4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
_META = json.load(open(os.path.join(HERE, 'harness', 'pieces_meta.json')))
_OVR = json.load(open(os.path.join(ROOT, 'tiledata', 'joseon-village', 'piece-walk-overrides.json')))
TREE_PFX = ('zelkova', 'pine', 'persimmon', 'willow', 'bamboo', 'small', 'bush')


def base_name(n):
    return n[4:] if n.startswith('fld_') else n


def is_tree(n):
    return _META.get(n, {}).get('cls') in ('tree',) or base_name(n).split('_')[0] in ('zelkova', 'pine', 'persimmon', 'willow')


def is_bush(n):
    return _META.get(n, {}).get('cls') in ('bush', 'sapling', 'tuft') or base_name(n).split('_')[0] in ('bush', 'small')


def load_catalog(tag):
    """조각 12초·지형 1초: 모듈 mtime 이 같으면 /tmp 캐시를 쓴다(소멸해도 다시 만들면 된다 — 소스가 아니다)."""
    import catalog
    key = max(os.path.getmtime(f) for f in glob.glob(os.path.join(HERE, '*.py')) if not os.path.basename(f).startswith(('demo', 'fa_')))
    cp = '/tmp/%s_objcache.pkl' % tag
    if os.path.exists(cp):
        try:
            k, t, o = pickle.load(open(cp, 'rb'))
            if k == key:
                return t, o
        except Exception:
            pass
    t, o = catalog.terrain(), catalog.objects()
    pickle.dump((key, t, o), open(cp, 'wb'))
    return t, o


def piece_walk(objs):
    """변환기와 같은 규칙으로 모든 조각의 칸 통행(X/C/F/.)을 미리 계산한다."""
    from joseon_tileset import walk as WK
    cells, pieces = [], {}
    for n, cv in objs.items():
        w, h = cv.w // T, cv.h // T
        tiles = []
        for j in range(h):
            r = []
            for i in range(w):
                cells.append(cv.a[j * T:(j + 1) * T, i * T:(i + 1) * T].copy())
                r.append(len(cells) - 1)
            tiles.append(r)
        pieces[n] = {'w': w, 'h': h, 'tiles': tiles}
    return WK.build_piece_walk(pieces, lambda i: cells[i], _META, _OVR)


class Kit:
    def __init__(s, MW, MH, tag, out_dir, file_prefix, cols=20):
        s.MW, s.MH, s.tag, s.OUT, s.FP, s.COLS = MW, MH, tag, out_dir, file_prefix, cols
        s.terr, s.objects = load_catalog(tag)
        s.WALK = piece_walk(s.objects)
        s.tiles, s.pieces = [], {}
        s.KG = [[None] * MW for _ in range(MH)]          # 바닥 종류(None=기본 바닥)
        s.items, s.placed = [], []                       # 물체 층
        s.HARD = {}                                      # 막힌 칸(X) → 조각 이름
        s.DRAWN = {}                                     # 그림이 있는 칸 → [(이름, 통행 문자)]
        s.KEEP = set()                                   # 물체가 못 서는 칸(길 위·문 앞)
        s.DOORS, s.PEOPLE, s.SPAWNS, s.EXITS, s.ANCHORS = [], [], [], [], []
        s.rg = random.Random(7)

    # ---------------------------------------------------------- 지형 묶음
    def add_group(s, name, cvs):
        base = len(s.tiles)
        for c in cvs:
            s.tiles.append(c)
        s.pieces[name] = {'id': base, 'count': len(cvs), 'tiles': list(range(base, base + len(cvs)))}
        while len(s.tiles) % s.COLS:
            s.tiles.append(Cv(T, T))
        return base

    def gid(s, name):
        return s.pieces[name]['id']

    def inb(s, x, y):
        return 0 <= x < s.MW and 0 <= y < s.MH

    def kind(s, x, y):
        return s.KG[y][x] if s.inb(x, y) else 'OUT'

    def paint(s, kind, x0, y0, x1, y1, only=None):
        """x0..x1, y0..y1(끝 포함) 사각형을 kind 로. only 가 있으면 그 종류 칸만 덮는다."""
        for y in range(max(0, y0), min(s.MH - 1, y1) + 1):
            for x in range(max(0, x0), min(s.MW - 1, x1) + 1):
                if only is None or s.KG[y][x] in only:
                    s.KG[y][x] = kind

    def cells_of(s, *kinds):
        return {(x, y) for y in range(s.MH) for x in range(s.MW) if s.KG[y][x] in kinds}

    def mask4(s, cs, x, y, edge_open=False):
        """4방향 이웃 마스크(N1 E2 S4 W8). edge_open=True 면 맵 밖을 이어진 것으로 본다."""
        m = 0
        for bit, (dx, dy) in ((N, (0, -1)), (E, (1, 0)), (S, (0, 1)), (W, (-1, 0))):
            X, Y = x + dx, y + dy
            if (X, Y) in cs or (edge_open and not s.inb(X, Y)):
                m |= bit
        return m

    # ---------------------------------------------------------- 물체
    def rows(s, name):
        return s.WALK[name]['rows']

    def cells_for(s, name, x, y):
        out = []
        for j, row in enumerate(s.rows(name)):
            for i, ch in enumerate(row):
                if ch != '.':
                    out.append((x + i, y + j, ch))
        return out

    def can_place(s, name, x, y, ok_kinds=(None,), why=False, keep_ok=False):
        cv = s.objects[name]
        w, h = cv.w // T, cv.h // T
        if x < 0 or y < 0 or x + w > s.MW or y + h > s.MH:
            return 'oob' if why else False
        tree = is_tree(name) or is_bush(name)
        for (X, Y, ch) in s.cells_for(name, x, y):
            if ch == 'X':
                if s.KG[Y][X] not in ok_kinds:
                    return 'kind %s at %d,%d' % (s.KG[Y][X], X, Y) if why else False
                if (X, Y) in s.HARD:
                    return 'hard %s at %d,%d' % (s.HARD[(X, Y)], X, Y) if why else False
                if (X, Y) in s.KEEP and not keep_ok:
                    return 'keep %d,%d' % (X, Y) if why else False
                for (n2, c2) in s.DRAWN.get((X, Y), []):          # 막힌 칸 위에 다른 조각의 그림이 이미 있으면(수관 아래 제외) 안 된다
                    if c2 != 'C':
                        return 'drawn %s at %d,%d' % (n2, X, Y) if why else False
            elif ch == 'F':
                if s.KG[Y][X] in ('rock', 'face0', 'face1', 'bog', 'pool', 'ceil', 'cface0', 'cface1'):
                    return 'F on solid ground' if why else False
                for (n2, c2) in s.DRAWN.get((X, Y), []):
                    if c2 in ('X', 'F'):
                        return 'F over %s' % n2 if why else False
            elif ch == 'C':
                for (n2, c2) in s.DRAWN.get((X, Y), []):
                    pass
        return True

    def place(s, name, x, y, ok_kinds=(None,), keep_ok=False, anchor=None):
        cv = s.objects[name]
        w, h = cv.w // T, cv.h // T
        s.placed.append((name, x, y, w, h))
        s.items.append((y + h, h, x, name, cv))
        for (X, Y, ch) in s.cells_for(name, x, y):
            s.DRAWN.setdefault((X, Y), []).append((name, ch))
            if ch == 'X':
                s.HARD[(X, Y)] = name
        return (x, y, w, h)

    def try_place(s, name, x, y, **kw):
        if s.can_place(name, x, y, **{k: v for k, v in kw.items() if k in ('ok_kinds', 'keep_ok')}):
            return s.place(name, x, y, **kw)
        return None

    def walk_ground(s, x, y):
        k = s.kind(x, y)
        return k not in ('rock', 'face0', 'face1', 'bog', 'pool', 'ceil', 'cface0', 'cface1', 'OUT')

    def walkable(s, x, y):
        """칸이 걸을 수 있는가: 바닥이 걷는 땅이고, 그 칸에 막힘(X) 조각이 없다. C(수관·처마)는 바닥이 정하고 F 는 걷는다."""
        if not s.inb(x, y):
            return False
        if (x, y) in s.HARD:
            return False
        return s.walk_ground(x, y) or any(c == 'F' for (_n, c) in s.DRAWN.get((x, y), []))

    def reach(s, start, ok=None):
        ok = ok or s.walkable
        seen = {start}
        dq = collections.deque([start])
        while dq:
            x, y = dq.popleft()
            for dx, dy in DIRS4:
                n = (x + dx, y + dy)
                if n not in seen and ok(*n):
                    seen.add(n); dq.append(n)
        return seen

    # ---------------------------------------------------------- 합성
    def compose_objects(s):
        OBJ = np.zeros((s.MH * T, s.MW * T, 4), np.uint8)
        for (_b, _h, x, name, cv) in sorted(s.items, key=lambda i: (i[0], i[1], i[2])):
            _comp(OBJ, cv.a, x * T, int(round((_b - _h) * T)))
        return OBJ

    # ---------------------------------------------------------- 굽기
    def bake(s, ground_ids, profile, people_overlay=None, extra_fields=None, ground_kind_map=None):
        os.environ['JS_PROFILE'] = profile
        import importlib, mapgate as _mg
        importlib.reload(_mg)
        MW, MH, COLS, OUT, FP = s.MW, s.MH, s.COLS, s.OUT, s.FP
        TARR = [t.a for t in s.tiles]
        gr = ground_ids
        ground = np.zeros((MH * T, MW * T, 4), np.uint8)
        for y in range(MH):
            for x in range(MW):
                ground[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
        OBJ = s.compose_objects()
        direct = ground.copy()
        _comp(direct, OBJ, 0, 0)
        cvD = Cv(MW * T, MH * T); cvD.a = direct
        cvO = Cv(MW * T, MH * T); cvO.a = OBJ
        mf, mrep = _mg.check(s.placed, cvD, cvO)
        print('지도 게이트', json.dumps(mrep, ensure_ascii=False))
        if mf:
            print('지도 게이트 FAIL:\n  ' + '\n  '.join(mf))
            if not os.environ.get('JS_FORCE'):
                sys.exit(1)
        tiles_n = len(s.tiles)
        grid = {}
        for i, c in enumerate(s.tiles):
            grid[(i % COLS, i // COLS)] = c.a
        rows_used = (tiles_n + COLS - 1) // COLS
        cur_x, cur_y, row_h = 0, rows_used, 0
        used = []
        for (nm, x, y, w, h) in s.placed:
            if nm not in used:
                used.append(nm)
        for name in used:
            cv = s.objects[name]
            w, h = cv.w // T, cv.h // T
            if cur_x + w > COLS:
                cur_x, cur_y, row_h = 0, cur_y + row_h, 0
            ids = []
            for ty in range(h):
                r = []
                for tx in range(w):
                    grid[(cur_x + tx, cur_y + ty)] = cv.a[ty * T:(ty + 1) * T, tx * T:(tx + 1) * T].copy()
                    r.append((cur_y + ty) * COLS + cur_x + tx)
                ids.append(r)
            s.pieces[name] = {'id': ids[0][0], 'w': w, 'h': h, 'tiles': ids}
            cur_x += w
            row_h = max(row_h, h)
        sheet_rows = cur_y + row_h
        lookup = {}
        for (cx, cy), a in grid.items():
            if a[:, :, 3].max() > 0:
                lookup.setdefault(a.tobytes(), cy * COLS + cx)
        extra = []
        obj_ids = [[-1] * MW for _ in range(MH)]
        for y in range(MH):
            for x in range(MW):
                sub = OBJ[y * T:(y + 1) * T, x * T:(x + 1) * T]
                if sub[:, :, 3].max() == 0:
                    continue
                key = sub.tobytes()
                if key not in lookup:
                    extra.append(sub.copy())
                    lookup[key] = -2 - len(extra)
                obj_ids[y][x] = lookup[key]
        base = sheet_rows * COLS
        for k, a in enumerate(extra):
            grid[((base + k) % COLS, (base + k) // COLS)] = a
        for y in range(MH):
            for x in range(MW):
                if obj_ids[y][x] <= -3:
                    obj_ids[y][x] = base + (-obj_ids[y][x] - 3)
        if extra:
            sheet_rows = (base + len(extra) + COLS - 1) // COLS
        SHEET = np.zeros((sheet_rows * T, COLS * T, 4), np.uint8)
        for (cx, cy), a in grid.items():
            SHEET[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = a
        re_ = np.zeros((MH * T, MW * T, 4), np.uint8)
        for y in range(MH):
            for x in range(MW):
                re_[y * T:(y + 1) * T, x * T:(x + 1) * T] = TARR[gr[y][x]]
        for y in range(MH):
            for x in range(MW):
                if obj_ids[y][x] >= 0:
                    t = grid[(obj_ids[y][x] % COLS, obj_ids[y][x] // COLS)]
                    d = re_[y * T:(y + 1) * T, x * T:(x + 1) * T]
                    a = t[:, :, 3:4].astype(np.float32) / 255.0
                    full = t[:, :, 3] == 255
                    blend = (d[:, :, :3] * (1 - a) + t[:, :, :3] * a).astype(np.uint8)
                    d[:, :, :3] = np.where(full[:, :, None], t[:, :, :3], np.where((t[:, :, 3] > 0)[:, :, None], blend, d[:, :, :3]))
                    d[:, :, 3] = np.maximum(d[:, :, 3], t[:, :, 3])
        diff = int((direct != re_).any(axis=2).sum())
        os.makedirs(OUT, exist_ok=True)
        Image.fromarray(direct, 'RGBA').save(os.path.join(OUT, FP + '-map.png'))
        ppl = Image.fromarray(direct, 'RGBA')
        if people_overlay:
            ppl = people_overlay(ppl, s.PEOPLE)
        ppl.save(os.path.join(OUT, FP + '-map-people.png'))
        Image.fromarray(SHEET, 'RGBA').save(os.path.join(OUT, FP + '-chipset.png'))
        Image.fromarray(re_, 'RGBA').save(os.path.join(OUT, FP + '-map-from-sheet.png'))
        json.dump({'tile': T, 'cols': COLS, 'rows': sheet_rows, 'tileCount': len(grid), 'pieces': s.pieces,
                   'overlapTiles': {'start': base, 'count': len(extra)}}, open(os.path.join(OUT, 'pieces.json'), 'w'), ensure_ascii=False, indent=1)
        json.dump({'width': MW, 'height': MH, 'ground': gr, 'object': obj_ids}, open(os.path.join(OUT, 'map.json'), 'w'))
        gk = [[(ground_kind_map or {}).get(s.KG[y][x], s.KG[y][x] or 'grass') for x in range(MW)] for y in range(MH)]
        ex = {'width': MW, 'height': MH,
              'placed': [{'name': n, 'x': x, 'y': y, 'w': w, 'h': h} for (n, x, y, w, h) in s.placed],
              'groundKind': gk,
              'doors': [{'x': d['x'], 'y': d['y'], 'piece': d['piece']} for d in s.DOORS],
              'people': [{'x': p[0], 'y': p[1], 'char': p[2], 'dir': ['up', 'right', 'down', 'left'][p[3]], 'frame': p[4]} for p in s.PEOPLE],
              'spawns': s.SPAWNS, 'exits': s.EXITS}
        ex.update(extra_fields or {})
        json.dump(ex, open(os.path.join(OUT, 'extra.json'), 'w'), ensure_ascii=False)
        colors = set(map(tuple, SHEET.reshape(-1, 4)[SHEET.reshape(-1, 4)[:, 3] == 255][:, :3]))
        rep = {'sheet': f'{COLS}x{sheet_rows} tiles', 'pixelDiffMapVsSheet': diff, 'overlapTiles': len(extra), 'uniqueOpaqueColors': len(colors),
               'doors': len(s.DOORS), 'placed': len(s.placed), 'people': len(s.PEOPLE), 'spawns': len(s.SPAWNS)}
        print(json.dumps(rep, ensure_ascii=False))
        assert diff == 0, 'sheet-reassemble pixelDiff %d != 0' % diff
        return direct, rep


def _comp(dst, src, x, y):
    h, w = src.shape[:2]
    x0, y0 = max(0, x), max(0, y)
    x1, y1 = min(dst.shape[1], x + w), min(dst.shape[0], y + h)
    if x0 >= x1 or y0 >= y1:
        return
    s_ = src[y0 - y:y1 - y, x0 - x:x1 - x]
    d = dst[y0:y1, x0:x1]
    a = s_[:, :, 3:4].astype(np.float32) / 255.0
    full = s_[:, :, 3] == 255
    blend = (d[:, :, :3] * (1 - a) + s_[:, :, :3] * a).astype(np.uint8)
    out = np.where(full[:, :, None], s_[:, :, :3], np.where((s_[:, :, 3] > 0)[:, :, None], blend, d[:, :, :3]))
    d[:, :, :3] = out
    d[:, :, 3] = np.maximum(d[:, :, 3], s_[:, :, 3])


# ================================================================ 자동 점검 단언
def audit_line3(placed, names_ok=None, maxgap=7):
    """같은 이름 소품 셋이 등간격 일렬(가로·세로·대각)이면 위반. 나무는 이름이 달라도 셋이 등간격 일렬이면 위반(줄 심기 금지)."""
    bad = []
    for kind in ('same', 'tree'):
        pts = [(n, x, y + h - 1) for (n, x, y, w, h) in placed if (kind == 'same' or is_tree(n))]
        if kind == 'same':
            by = collections.defaultdict(list)
            for n, x, y in pts:
                by[n].append((x, y))
            groups = {n: v for n, v in by.items() if not is_tree(n) and len(v) >= 3}
        else:
            groups = {'tree': [(x, y) for n, x, y in pts if is_tree(n) and not is_bush(n)]}
        for n, v in groups.items():
            S_ = set(v)
            for (x, y) in v:
                for dx, dy in ((1, 0), (0, 1), (1, 1), (1, -1)):
                    for g in range(1, maxgap + 1):
                        if (x + dx * g, y + dy * g) in S_ and (x + 2 * dx * g, y + 2 * dy * g) in S_ and (g >= 2 or kind == 'same'):
                            bad.append((n, (x, y), (dx * g, dy * g)))
    return bad


def audit_plain(kit, win=10, plain_kinds=(None,)):
    """win×win 칸이 전부 평범한 바닥(None 종류 + 물체 그림 없음)이면 위반. 위반 창의 왼쪽 위 칸 목록."""
    MW, MH = kit.MW, kit.MH
    P = np.zeros((MH, MW), np.int32)
    for y in range(MH):
        for x in range(MW):
            if kit.KG[y][x] in plain_kinds and (x, y) not in kit.DRAWN:
                P[y, x] = 1
    ii = np.pad(P.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    bad = []
    for y in range(0, MH - win + 1):
        for x in range(0, MW - win + 1):
            if ii[y + win, x + win] - ii[y, x + win] - ii[y + win, x] + ii[y, x] == win * win:
                bad.append((x, y))
    return bad


def audit_deadends(kit, path_kinds, anchors):
    """길 칸(path_kinds) 중 이웃 길 칸이 1개 이하인 끝점이, 앵커(문 앞·야영지·길망 끝·맵 가장자리) 곁이 아니면 막다른 길."""
    paths = {(x, y) for y in range(kit.MH) for x in range(kit.MW) if kit.KG[y][x] in path_kinds}
    anc = set(anchors)
    bad = []
    for (x, y) in paths:
        nb = sum(1 for dx, dy in DIRS4 if (x + dx, y + dy) in paths)
        if nb <= 1:
            near_anchor = any(abs(x - ax) + abs(y - ay) <= 2 for (ax, ay) in anc) or x in (0, kit.MW - 1) or y in (0, kit.MH - 1)
            if not near_anchor:
                bad.append((x, y))
    return bad


def audit_components(kit, targets, start):
    """start 에서 걸어 닿는 칸 집합과, 닿지 못하는 목표."""
    seen = kit.reach(start)
    return seen, [t for t in targets if t not in seen]


def audit_unreachable_walk(kit, seen, min_island=1, ignore=lambda x, y: False):
    """걸을 수 있는데 start 에서 못 닿는 칸의 연결 덩어리 목록(크기, 대표 칸). 나무 사이 작은 틈(≤min_island)은 센다."""
    rest = {(x, y) for y in range(kit.MH) for x in range(kit.MW) if kit.walkable(x, y) and (x, y) not in seen and not ignore(x, y)}
    comps = []
    while rest:
        c0 = next(iter(rest)); st = [c0]; sn = {c0}
        while st:
            x, y = st.pop()
            for dx, dy in DIRS4:
                n = (x + dx, y + dy)
                if n in rest and n not in sn:
                    sn.add(n); st.append(n)
        rest -= sn
        comps.append((len(sn), min(sn)))
    return sorted(comps, reverse=True)
