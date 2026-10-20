"""조립 방 관문 — 바닥·벽면 칸은 혼자서 윗면을 보일 수 없는 부품이라, 그 칸을 화소 그대로 품은 「방 한 칸」 그림을
object-gate(kind structure)에 낸다(gothic-manor assemble.py · jp-city gate_assembled.py 와 같은 규칙). 바닥·벽면을 한 화소라도
다시 그리면 조립 그림 해시가 바뀌어 덮임이 풀린다(굽기가 다시 그려 영수증을 찾는다).

판정 상태(jp-city gate_kinds.state 와 같은 뜻):
  pass        — 보정된 프로필의 PASS
  provisional — 현재 프로필(아직 보정 전)의 PASS → 임시 통과, 보고에 「미보정 프로필 임시」로 적는다
  그 밖(영수증 없음·FAIL·옛 프로필·다른 종류)은 막는다.

  python3 gate_rooms.py           → _gate/_rooms/*.png 저장 + 상태 표
"""
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import iplib
from PIL import Image
sys.path.insert(0, os.path.join(iplib.ROOT, 'src', 'harnesses', '_core'))
sys.path.insert(0, os.path.join(iplib.ROOT, 'scripts', 'content', 'hand-interior-pick'))

OUT = os.path.join(iplib.TD, '_gate', '_rooms')
# 벽면 → 그 벽 밑에 까는 바닥(둘이면 왼쪽 반·오른쪽 반). 바닥 다섯·벽면 넷을 모두 한 번 이상 품는다.
ROOMS = [('hull', ('deck', 'hold'), 'wood', '범선 선체 판자 벽 방(갑판 판자·짐칸 판자 바닥)'),
         ('cabin', ('deck',), 'wood', '선장실 판벽 방(갑판 판자 바닥)'),
         ('gallery', ('parquet',), 'default', '미술관 벽지 전시실(쪽모이 마루)'),
         ('arenawall', ('sand', 'sandstone'), 'rock', '투기장 사암 벽 마당(모래·사암 포석 바닥)'),
         # 벽면이 v5 시트에 있는 것(reg 에 없는 벽) — 시트 칸을 그대로 쓴다. 바닥만 새 그림.
         ('rock', ('ice',), 'rock', '얼음 동굴 바위벽 방(빙판 바닥)', 7, True)]
W, FLOOR_ROWS = 10, 4


def _sheet_tile(n):
    """v5 시트(덧붙이기 앞부분은 불변)의 칸 n — 천장 띠는 v5 칸을 그대로 쓴다."""
    global _SHEET
    try: _SHEET
    except NameError: _SHEET = Image.open(os.path.join(iplib.ROOT, 'public/assets/atlas-interior/interior-chipset.png')).convert('RGBA')
    return _SHEET.crop(((n % 48) * 16, (n // 48) * 16, (n % 48) * 16 + 16, (n // 48) * 16 + 16))


def room_image(reg, wid, floors, ceiling, floor_rows=None, inner=False):
    """조립기(builder.ts handInteriorStructure)와 같은 규칙으로 방 한 칸을 짓는다: 평면 맨 윗줄 공허 → 천장 띠(벽 윗면) → 벽면 두 줄 → 바닥.
    좌우·아래 막힌 칸도 실내에 닿으면 천장 띠다(비트 = 아래1·위2·왼4·오른8·위가 공허16)."""
    import bake, json
    from palette_snap import snap
    spec = json.load(open(os.path.join(iplib.ROOT, 'src/assets/handInteriorSpec.json')))
    ceil = spec['ceilings'][ceiling]; void = spec['void']
    wd = reg.walls.get(wid)
    sheet_wall = None if wd else spec['walls'][wid]                 # v5 시트 벽면: tiles[(줄*cols + x%cols)*2 + 서쪽]
    FR = floor_rows or FLOOR_ROWS
    GW, GH = W + 2, 2 + 2 + FR + 2          # 공허 1 + 천장 띠 1 + 벽면 2 + 바닥 + 아래 천장 띠 1 + 공허 1
    inn = lambda x, y: 1 <= x <= W and 2 <= y <= 3 + FR
    top = lambda x, y: 0 <= x < GW and 0 <= y < GH and not inn(x, y) and any(inn(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
    im = Image.new('RGBA', (GW * 16, GH * 16), (0, 0, 0, 0))
    for y in range(GH):
        for x in range(GW):
            if inn(x, y):
                if y in (2, 3) and sheet_wall:
                    t = _sheet_tile(sheet_wall['tiles'][((y - 2) * sheet_wall['cols'] + (x - 1) % sheet_wall['cols']) * 2 + (0 if inn(x - 1, y) else 1)])
                elif y in (2, 3):
                    t = bake.wall_tile(wd, (x - 1) % wd['cols'], y - 1, not inn(x - 1, y))
                else:
                    fy = y - 4; fx = x - 1
                    fid = floors[0] if len(floors) == 1 or fx < W // 2 else floors[1]
                    fd = reg.floors[fid]
                    sh = (1 if fy == 0 else 0) | (2 if not inn(x - 1, y) else 0)
                    t = bake.floor_tile(fd, fx % fd['cols'], fy % fd['rows'], sh)
            elif top(x, y):
                nv = 1 if y == 0 else (0 if inn(x, y - 1) or top(x, y - 1) else 1)
                b = (1 if inn(x, y + 1) else 0) | (2 if inn(x, y - 1) else 0) | (4 if inn(x - 1, y) else 0) | (8 if inn(x + 1, y) else 0) | 16 * nv
                t = _sheet_tile(ceil[b])
            else:
                t = _sheet_tile(void)
            im.paste(t, (x * 16, y * 16))
    if inner:   # 바깥 공허 줄(평면 한 색)만 뺀다 — 천장 띠(벽 윗면)·벽면·바닥은 조립기 그대로. 칸 화소는 그대로다.
        im = im.crop((0, 16, GW * 16, (GH - 1) * 16))
    return snap(im)[0]


GROUND = ['ice']


def ground_patch(reg, fid):
    """바닥 한 벌(주기 cols×rows 칸, 그림자 없음 + 북·서 벽 접촉 그림자 줄)을 깐 땅 조각. 칸 화소는 굽는 것과 같다."""
    import bake
    from palette_snap import snap
    fd = reg.floors[fid]; W_, H_ = fd['cols'] + 2, fd['rows'] + 1
    im = Image.new('RGBA', (W_ * 16, H_ * 16))
    for y in range(H_):
        for x in range(W_):
            sh = (1 if y == 0 else 0) | (2 if x == 0 else 0)
            im.paste(bake.floor_tile(fd, x % fd['cols'], y % fd['rows'], sh), (x * 16, y * 16))
    return dict(label=f'atlas_biome_interior/plus/ground-{fid}', kind='terrain', img=snap(im)[0],
                name=f'{fd["ko"]} 바닥 조각(위에서 본 3/4 실내 바닥 {W_}×{H_}칸 — 위·왼쪽 줄은 벽 밑 접촉 그림자)', covers=[('floor', fid)])


def rooms(reg):
    out = [dict(label=f'atlas_biome_interior/plus/room-{wid}' + ('' if wid in reg.walls else '-' + '-'.join(floors)), kind='structure', img=room_image(reg, wid, floors, ceil, *rest),
                name=f'{ko} — 바닥·벽면을 조립기와 같은 천장 띠(벽 윗면) 사이에 조립(위에서 본 3/4 방 한 칸)',
                covers=([('wall', wid)] if wid in reg.walls else []) + [('floor', f) for f in floors])
           for wid, floors, ceil, ko, *rest in ROOMS]
    for fid in GROUND:   # 바닥 칸만 깐 땅 조각(kind terrain · 화풍 ground) — 버들항 땅 기준과 같은 종류로 비교한다
        if fid in reg.floors: out.append(ground_patch(reg, fid))
    if reg.pits:   # 구멍(심연) 오토타일 — 47 칸을 화소 그대로 품은 동굴 바닥 조립 그림(kind terrain)
        import puzzle_scene
        out += puzzle_scene.pit_pictures(reg)
    return out


_CUR = None
def current_profile():
    global _CUR
    if _CUR: return _CUR
    out = subprocess.run(['npm', 'run', 'harness', '--', 'object-gate', 'status'], cwd=iplib.ROOT, capture_output=True, text=True).stdout
    m = re.search(r'현재 규칙 프로필 ([0-9a-f]{16})', out)
    if not m: raise RuntimeError('현재 판정 프로필 해시를 못 읽었다(object-gate status)')
    _CUR = m.group(1); return _CUR


def state(img, kind):
    """('pass'|'provisional', None) 또는 (None, 이유)."""
    import object_gate as OG
    rc = OG.read_receipt(OG.pixel_sha256(img))
    if not rc: return None, '영수증 없음 — object-gate review 를 먼저 받아라'
    if rc.get('kind') != kind: return None, f"영수증 종류({rc.get('kind')})가 요청 종류({kind})와 다르다"
    cal = OG.calibrated_profiles()
    if rc.get('profileHash') != current_profile() and rc.get('profileHash') not in cal:
        return None, f"옛 판정 프로필({rc.get('profileHash')}) 영수증 — 다시 판정받아라"
    if rc.get('verdict') != 'pass': return None, '불합격(' + ' · '.join(rc.get('reasons') or ['fail']) + ')'
    return ('pass' if rc.get('profileHash') in cal else 'provisional'), None


def _baked_unchanged(reg):
    """이미 시트에 구운 칸과 화소가 같은 것(덧붙이기 전에 굽힌 기물·바닥·벽면) → {'piece': set(id), 'floor': set, 'wall': set}.
    object-gate 결정(2026-10-08): 기존 번들 시트는 소급 면제, 새 그림만 막는다. 굽힌 뒤 한 화소라도 바뀐 것·새 것은 여기 들지 않는다."""
    import bake, json
    from palette_snap import snap
    pins_p = os.path.join(iplib.TD, 'pins.json')
    if not os.path.exists(pins_p): return {'piece': set(), 'floor': set(), 'wall': set()}
    pins = json.load(open(pins_p)); slots = pins.get('slots', {}); done = set(pins.get('ids', []))
    eq = lambda im, n: n is not None and snap(im)[0].tobytes() == _sheet_tile(n).tobytes()
    out = {'piece': set(), 'floor': set(), 'wall': set()}
    for pid in reg.order:
        if pid not in done: continue
        p = reg.pieces[pid]
        if all(eq(t, slots.get(f'obj:{pid}:{dx},{dy}')) for dx, dy, t, _ in bake.cells_of(p, iplib.render(p))): out['piece'].add(pid)
    for fid, fd in reg.floors.items():
        n = fd['cols'] * fd['rows'] * 4
        if all(eq(bake.floor_tile(fd, (i // 4) % fd['cols'], i // (4 * fd['cols']), i % 4), slots.get(f'floor:{fid}:{i}')) for i in range(n)): out['floor'].add(fid)
    for wid, wd in reg.walls.items():
        n = wd['cols'] * 4
        if all(eq(bake.wall_tile(wd, (i // 2) % wd['cols'], 1 + i // (2 * wd['cols']), i % 2), slots.get(f'wall:{wid}:{i}')) for i in range(n)): out['wall'].add(wid)
    return out


def check(reg):
    """기물 + 조립 방 전부. {'pass':[], 'provisional':[], 'grandfathered':[], 'bad':[(label, why)]}
    grandfathered = 영수증이 옛 프로필이거나 없지만 이미 시트에 구운 그림과 화소가 같다(소급 면제) — 새 조각은 해당 없음."""
    res = {'pass': [], 'provisional': [], 'grandfathered': [], 'bad': []}
    old = _baked_unchanged(reg)
    items = [(f'atlas_biome_interior/plus/{pid}', iplib.render(reg.pieces[pid]), reg.pieces[pid]['gate'], pid in old['piece']) for pid in reg.order]
    rs = rooms(reg)
    items += [(r['label'], r['img'], r['kind'], all(k in ('floor', 'wall') and v in old[k] for k, v in r['covers'])) for r in rs]
    for label, img, kind, grand in items:
        st, why = state(img, kind)
        if st: res[st].append(label)
        elif grand: res['grandfathered'].append(label)
        else: res['bad'].append((label, why))
    ok = set(res['pass']) | set(res['provisional'])
    # 조립 그림은 증거다: 떨어진 그림이 덮는 바닥·벽면이 모두 다른 통과 그림(또는 소급 면제)으로 덮이면 막지 않는다(보고에는 남긴다)
    covered = {cv for r in rs if r['label'] in ok for cv in r['covers'] if cv[0] != 'pit'}
    covered |= {(k, v) for k in ('floor', 'wall') for v in old[k]}
    res['superseded'] = []
    keep = []
    for label, why in res['bad']:
        r = next((r for r in rs if r['label'] == label), None)
        if r and r['covers'] and all(cv in covered for cv in r['covers'] if cv[0] != 'pit') and not any(cv[0] == 'pit' for cv in r['covers']):
            res['superseded'].append((label, why))
        else: keep.append((label, why))
    res['bad'] = keep
    # 구멍 그림은 마스크 덮임으로 센다 — 떨어진 그림이 있어도 통과 그림들이 47 마스크를 다 품으면 막지 않는다
    pit_ok = {pid for pid in reg.pits if not (set(iplib.PIT_MASKS) - set().union(*[r['masks'] for r in rs if ('pit', pid) in r.get('covers', []) and r['label'] in ok] or [set()]))}
    keep = []
    for label, why in res['bad']:
        r = next((r for r in rs if r['label'] == label), None)
        if r and any(cv[0] == 'pit' and cv[1] in pit_ok for cv in r['covers']): res['superseded'].append((label, why))
        else: keep.append((label, why))
    res['bad'] = keep
    for pid in reg.pits:   # 구멍 칸은 통과한 조립 그림이 47 마스크를 모두 품을 때만 덮인다
        got = set()
        for r in rs:
            if ('pit', pid) in r.get('covers', []) and r['label'] in ok: got |= r['masks']
        miss = sorted(set(iplib.PIT_MASKS) - got)
        if miss: res['bad'].append((f'pit:{pid}', f'통과한 조립 그림이 품지 못한 마스크 {len(miss)}개 {miss[:8]}'))
    return res


def require_structure(reg):
    """굽기 관문: 기물과 조립 방이 모두 pass/provisional 이어야 한다. 아니면 SystemExit(이유 전부)."""
    res = check(reg)
    print(f"[3/4 관문] 기물 {len(reg.order)} + 조립 그림 {len(rooms(reg))}: 통과 {len(res['pass'])} · 미보정 프로필 임시통과 {len(res['provisional'])} · "
          f"이미 구운 그대로(소급 면제) {len(res['grandfathered'])} · 다른 통과 그림이 대신 덮음 {len(res.get('superseded', []))} · 막힘 {len(res['bad'])}")
    for l, w in res.get('superseded', []): print(f'  (대신 덮임) {l}: {w}')
    if res['bad']:
        raise SystemExit('3/4 관문 막힘:\n' + '\n'.join(f'  {l}: {w}' for l, w in res['bad']))
    return res


if __name__ == '__main__':
    import loader
    reg = loader.load(); os.makedirs(OUT, exist_ok=True)
    for r in rooms(reg):
        p = os.path.join(OUT, r['label'].split('/')[-1] + '.png'); r['img'].save(p)
        print(p, r['img'].size, state(r['img'], 'structure'))
