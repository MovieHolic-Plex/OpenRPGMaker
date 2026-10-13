"""저택 평면 조립 예제(1·2층 연결)·은신처 접근칸 예제 + 자동 좌표 검증 + 정상/오류 그림. 실행: python3 plans.py  (검증 실패 시 종료코드 1)
격자: 타일 16px, (x,y) 0기준, 기물 좌표 = 왼위 타일. 차단 = 비투명 기물의 아래쪽 최대 2줄(wall_mounted·flat·terrain 제외)."""
import os, sys, json, collections
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
HERE = os.path.dirname(__file__); PIECES = os.path.join(HERE, '..', '..', '..', 'tiledata', 'gothic-interior', 'pieces')
OUT = os.path.join(HERE, '..', '..', '..', 'public', 'assets', 'gothic-interior-references')
META = {}  # id -> (w_tiles, h_tiles, kind)
for l in open(os.path.join(PIECES, '..', 'batch.jsonl')):
    r = json.loads(l); im = Image.open(r['png']); META[r['label'].split('/')[1]] = (im.width // 16, im.height // 16, r['kind'])
NONBLOCK = {'wall_mounted', 'flat', 'terrain'}

class Plan:
    def __init__(s, name, rows, items, doors=(), stairs=None, hide=()):
        s.name, s.rows, s.items, s.doors, s.stairs, s.hide = name, rows, list(items), list(doors), stairs, list(hide)
        s.h = len(rows); s.w = len(rows[0])
    def blocked(s):
        b = {(x, y) for y, r in enumerate(s.rows) for x, ch in enumerate(r) if ch == '#'}
        for id, x, y in s.items:
            w, h, k = META[id]
            if k in NONBLOCK: continue
            for yy in range(y + max(0, h - 2), y + h):
                for xx in range(x, x + w): b.add((xx, yy))
        return b
    def validate(s):
        errs = []; b = s.blocked(); occ = {}
        for id, x, y in s.items:
            w, h, k = META[id]
            if x < 0 or y < 0 or x + w > s.w or y + h > s.h: errs.append(f'E_BOUNDS {id}@({x},{y})')
            if k in NONBLOCK: continue
            for yy in range(y + max(0, h - 2), y + h):
                for xx in range(x, x + w):
                    if (xx, yy) in occ: errs.append(f'E_OVERLAP {id}@({x},{y}) x {occ[(xx, yy)]} at ({xx},{yy})')
                    occ[(xx, yy)] = id
        for d in s.doors:
            ax, ay = d['access']
            if (ax, ay) in b or not (0 <= ax < s.w and 0 <= ay < s.h): errs.append(f'E_DOOR_ACCESS_BLOCKED {d["id"]}@({ax},{ay})')
        starts = [d['access'] for d in s.doors if (tuple(d['access']) not in b)]
        seen = set()
        if starts:
            q = collections.deque([tuple(starts[0])]); seen.add(tuple(starts[0]))
            while q:
                x, y = q.popleft()
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = (x + dx, y + dy)
                    if 0 <= n[0] < s.w and 0 <= n[1] < s.h and n not in b and n not in seen: seen.add(n); q.append(n)
        for d in s.doors:
            if tuple(d['access']) not in seen: errs.append(f'E_DOOR_UNREACHABLE {d["id"]}')
        for hs in s.hide:
            ax, ay = hs['access']
            if (ax, ay) in b or (ax, ay) not in seen: errs.append(f'E_HIDE_ACCESS {hs["id"]}@({ax},{ay}) blocked/unreachable')
        return errs
    def render(s, scale=3):
        im = Image.new('RGBA', (s.w * 16, s.h * 16), (24, 26, 34, 255))
        fl = Image.open(os.path.join(PIECES, s.floor + '.png'))
        for y, r in enumerate(s.rows):
            for x, ch in enumerate(r):
                if ch != '#': im.alpha_composite(fl, (x * 16, y * 16))
                else: im.alpha_composite(Image.open(os.path.join(PIECES, 'wall_wallpaper.png')), (x * 16, y * 16))
        for id, x, y in sorted(s.items, key=lambda t: (META[t[0]][2] not in NONBLOCK and META[t[0]][2] != 'terrain', t[2] + META[t[0]][1])):
            p = Image.open(os.path.join(PIECES, id + '.png')); im.alpha_composite(p, (x * 16, y * 16))
        if s.stairs:
            sx, sy = s.stairs; c = Image.new('RGBA', (16, 16), (240, 200, 60, 150)); im.alpha_composite(c, (sx * 16, sy * 16))
        for d in s.doors + s.hide:
            ax, ay = d['access']; c = Image.new('RGBA', (16, 16), (80, 220, 120, 110)); im.alpha_composite(c, (ax * 16, ay * 16))
        return im.resize((im.width * scale, im.height * scale), Image.NEAREST)

MANOR_1F = [
 '########################',
 '#......#.......#.......#',
 '#......#.......#.......#',
 '#......#.......#.......#',
 '#......#.......#.......#',
 '#..............#.......#',
 '#......#.......#.......#',
 '#......#########.......#',
 '#......................#',
 '#......................#',
 '#......................#',
 '#......................#',
 '########################',
]
MANOR_2F = [
 '########################',
 '#.......#..............#',
 '#.......#..............#',
 '#.......#######.########',
 '#......................#',
 '#......................#',
 '#......................#',
 '#.......#######.########',
 '#.......#......#.......#',
 '#.......#......#.......#',
 '#.......#......#.......#',
 '#.......#......#.......#',
 '########################',
]
def manor():
    f1 = Plan('manor-1f', MANOR_1F, [
        ('chandelier', 10, 8), ('rug_runner', 11, 8), ('console_table', 1, 9), ('frame_m', 5, 8) , ('frame_l', 14, 0),
        ('piano', 17, 1), ('rocker', 20, 4), ('bookshelf', 9, 2), ('desk', 9, 4), ('armchair', 3, 4),
        ('glass_case', 1, 1), ('plinth', 4, 1), ('plinth', 4, 5), ('frame_s', 8, 6), ('bookshelf', 11, 5),
        ('barrel', 22, 10), ('crate', 21, 10), ('candelabra', 14, 9), ('cobweb', 22, 8), ('night_window', 21, 0),
    ], doors=[dict(id='front', access=(11, 11)), dict(id='hall-w', access=(7, 5))], stairs=(19, 9))
    f1.floor = 'floor_parquet'
    f2 = Plan('manor-2f', MANOR_2F, [
        ('bed', 1, 1), ('wardrobe', 4, 1), ('bathtub', 17, 1), ('vanity_sink', 20, 3), ('doll', 18, 8),
        ('rug_runner', 8, 4), ('cracked_mirror', 1, 8), ('wall_sconce', 12, 3), ('fog', 12, 5), ('blood_stain', 19, 5),
        ('night_window', 7, 0), ('bed', 17, 9),
    ], doors=[dict(id='stair-top', access=(19, 5))], stairs=(19, 9))
    f2.floor = 'floor_bath'
    return f1, f2
def stairs_ok(f1, f2): return [] if f1.stairs == f2.stairs else [f'E_STAIR_MISMATCH 1F{f1.stairs} 2F{f2.stairs}']

def hide_spots():
    # 옷장: 문 앞 접근칸(아래)이 비어 있어야 한다. 침대 밑: 침대 아래 줄(어두운 틈) 앞 칸.
    p = Plan('hide-room', ['##########', '#........#', '#........#', '#........#', '#........#', '#........#', '##########'], [
        ('wardrobe', 1, 1), ('bed', 5, 1), ('rug_runner', 3, 3), ('crate', 8, 4),
    ], doors=[dict(id='door', access=(4, 5))], hide=[dict(id='wardrobe', access=(1, 4)), dict(id='under-bed', access=(6, 4))])
    p.floor = 'floor_parquet'; return p
def hide_bad():
    p = hide_spots(); p.items = [(i, x, y) for i, x, y in p.items if i != 'crate'] + [('crate', 1, 4), ('barrel', 6, 4)]
    p.name = 'hide-room-bad'; return p

def main():
    os.makedirs(OUT, exist_ok=True); f1, f2 = manor(); ok = True; log = {}
    for p in (f1, f2, hide_spots()):
        e = p.validate(); log[p.name] = e; p.render().save(os.path.join(OUT, p.name + '.png'))
    log['stairs'] = stairs_ok(f1, f2)
    bad = hide_bad(); be = bad.validate(); log['hide-room-bad(expected errors)'] = be; bad.render().save(os.path.join(OUT, 'hide-room-bad.png'))
    f2b = manor()[1]; f2b.stairs = (18, 9); sb = stairs_ok(f1, f2b); log['stairs-bad(expected errors)'] = sb
    good = [k for k in log if 'expected' not in k and log[k]]
    exp = bool(be) and bool(sb) and any('HIDE_ACCESS' in x for x in be)
    json.dump(log, open(os.path.join(OUT, 'validation.json'), 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(log, ensure_ascii=False, indent=1)); return 0 if not good and exp else 1
if __name__ == '__main__': sys.exit(main())
