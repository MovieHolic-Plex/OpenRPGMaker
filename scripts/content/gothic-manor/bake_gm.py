"""gothic_manor 굽기 — 3/4 관문(object-gate) 영수증이 현재 그림 해시에 PASS 로 붙은 조각만 모아 공용 타일셋을 쓴다.

  python3 scripts/content/gothic-manor/bake_gm.py            # 쓰기
  python3 scripts/content/gothic-manor/bake_gm.py --dry      # 보고만

채택 규칙(관문 정본 = harness-data/object-gate/receipts, src/harnesses/_core/object_gate):
  · 조각 — 0프레임 그림(gate_export.py 와 같은 렌더)의 화소 해시에 PASS 영수증, 또는
  · 부품 — 그 조각의 모든 프레임을 화소 그대로 품은 조립 그림(assemble.py, kind structure)의 PASS 영수증(jp-city gate_assembled 규칙)
  · 줄 조각(담·철책) — gate_export.run_sample 견본 그림의 PASS 영수증
  · 오토타일 — 3×3 패치 그림의 PASS 영수증
그림이 한 화소라도 바뀌면 해시가 바뀌어 채택이 풀린다(다시 review). 점수·기준을 낮추는 길은 없다.

산출: public/assets/gothic-manor/gothic-manor-chipset.png · src/assets/gothicManorTileset.json · src/assets/gothicManorSheet.json ·
      src/assets/gothicManorRoomSpec.json · tiledata/gothic-manor/pins.json · tiledata/gothic-manor/bake-report.json
번호는 자리 키 핀(pins.json)으로 고정 — 그림을 고쳐도 번호가 안 바뀌고 새 칸은 끝에 덧붙는다. 애니메이션 칸은 한 행 안에 연속 배치.
"""
import argparse, collections, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'pieces')); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import gmlib, loader, roomkit_gm, assemble, gate_export  # noqa: E402
import bake_lib as BL                                      # noqa: E402  (jp_city 굽기 보조 — pc 표·시트·재조립·정의 검사)
import space_recipes_gm                                    # noqa: E402  (벽 묶음 — 방 짓기 역할표의 벽면 칸)

ROOT = gmlib.ROOT
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
from object_gate import pixel_sha256, read_receipt  # noqa: E402

ID, NAME, TEXTURE, FAMILY = 'gothic_manor', '고딕 저택·묘지 (호러, 손 도트)', 'tex_gothic_manor', 'oprn-gothic'
TPR = 48
P = dict(png=os.path.join(ROOT, 'public/assets/gothic-manor/gothic-manor-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/gothicManorTileset.json'),
         sheet=os.path.join(ROOT, 'src/assets/gothicManorSheet.json'),
         roomspec=os.path.join(ROOT, 'src/assets/gothicManorRoomSpec.json'),
         pins=os.path.join(gmlib.TD, 'pins.json'), report=os.path.join(gmlib.TD, 'bake-report.json'))
WALK_PC = gmlib.WALK_PC
FAMILY_KO = dict(architecture='건축', surfaces='바닥', furniture='가구', nature='자연', characters='인물', creatures='생물', vehicles='탈것', effects='효과')
ROLE_FROM_FAMILY = dict(architecture='wall', surfaces='terrain', furniture='prop', nature='prop', creatures='prop', vehicles='prop', effects='prop', characters='prop')
# 모듈 순서 = 핀 순서(처음 굽기에서 번호가 이 순서로 붙는다). 같은 id 가 여러 모듈에 등록되면(yard_props 가 gy_props 를 불러온다) 처음 것만.
MODULES = ['terrain', 'bld_manor', 'bld_chapel', 'bld_misc', 'yard2', 'gy_props', 'yard_props', 'int_walls', 'int_floors', 'int_furn', 'int_gallery', 'yard3']


# ───────────────────────── 핀 ─────────────────────────
class Pins:
    def __init__(self, path):
        prev = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
        self.map = dict(prev.get('cells', {})); self.strips = dict(prev.get('strips', {}))
        used = list(self.map.values()) + [b + n - 1 for b, n in self.strips.values()]
        self.next_id = max(used) + 1 if used else 1        # 0 번은 빈 칸으로 남긴다
        self.used = set()

    def one(self, key):
        self.used.add(key)
        if key not in self.map: self.map[key] = self.next_id; self.next_id += 1
        return self.map[key]

    def block(self, key, n):
        """한 행 안의 연속 n 칸. 반환 첫 번호."""
        self.used.add(key)
        if key in self.strips and self.strips[key][1] == n: return self.strips[key][0]
        if self.next_id % TPR + n > TPR: self.next_id += TPR - self.next_id % TPR
        self.strips[key] = [self.next_id, n]; self.next_id += n
        return self.strips[key][0]


# ───────────────────────── 관문 영수증 ─────────────────────────
def verdict(img):
    r = read_receipt(pixel_sha256(img))
    return (r or {}).get('verdict'), r


def assembled_cover():
    """PASS 조립 그림이 덮는 (조각 id, 프레임) 집합과 조립 영수증 요약."""
    cov, rep = set(), []
    for a in assemble.assembled():
        v, r = verdict(a['img'])
        rep.append(dict(label=a['label'], verdict=v or '영수증 없음', sha=pixel_sha256(a['img'])[:12], covers=len(a['covers'])))
        if v == 'pass': cov |= {tuple(x) for x in a['covers']}
    return cov, rep


def adopted():
    regs = collections.OrderedDict()
    for m in MODULES: regs[m] = loader.load(m)
    cov, asm = assembled_cover()
    pcs, ats, runs, rejected, seen = [], [], [], [], set()
    for mod, reg in regs.items():
        for k, p in reg.pieces.items():
            if k in seen: continue
            seen.add(k)
            v, r = verdict(gmlib.render_piece(p, 0).img())
            frames_covered = all((k, f) in cov for f in range(p['frames']))
            if v == 'pass' or frames_covered:
                pcs.append((mod, p)); continue
            rejected.append(dict(module=mod, kind='piece', id=k, why=v or ('부품 — 조립 그림이 덮지 않음' if not p.get('kind') else '영수증 없음'),
                                 reason='; '.join((r or {}).get('reasons', []))[:200]))
        for k, a in reg.autotiles.items():
            if k in seen: continue
            seen.add(k)
            _, _, patch, _ = gmlib.autotile_cells(a)
            v, r = verdict(patch.img())
            if v == 'pass': ats.append((mod, a))
            else: rejected.append(dict(module=mod, kind='autotile', id=k, why=v or '영수증 없음', reason='; '.join((r or {}).get('reasons', []))[:200]))
        for k, rr in reg.runs.items():
            if k in seen: continue
            seen.add(k)
            v, r = verdict(gate_export.run_sample(rr))
            if v == 'pass': runs.append((mod, rr))
            else: rejected.append(dict(module=mod, kind='run', id=k, why=v or '영수증 없음', reason='; '.join((r or {}).get('reasons', []))[:200]))
    return regs, pcs, ats, runs, rejected, asm


# ───────────────────────── 굽기 ─────────────────────────
def bake(dry=False):
    regs, pieces, autos, runs, rejected, asm = adopted()
    pins = Pins(P['pins'])
    img, info = {}, {}
    dedupe = {}
    strips = []
    piece_cells = {}

    def put(key, im, pc, meta):
        im = BL.norm(im)
        k2 = (im.tobytes(), pc)
        if k2 in dedupe and not key.endswith('!'): return dedupe[k2]
        tid = pins.one(key)
        img[tid] = im; info[tid] = dict(meta, pc=pc); dedupe.setdefault(k2, tid)
        return tid

    # 1) 조각
    for mod, p in pieces:
        frames = [gmlib.render_piece(p, f).img() for f in range(p['frames'])]
        cells = {}
        for y in range(p['h']):
            for x in range(p['w']):
                ch = p['walk'][y][x]
                if ch == '.': continue
                pc = WALK_PC[ch]
                if pc == 'floor' and np.asarray(frames[0])[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16, 3].min() < 255: pc = 'flat'
                crop = lambda f: f.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16))
                where = f" ({x + 1},{y + 1})" if p['w'] * p['h'] > 1 else ''
                meta = dict(label=f"{p['name']}{where}", desc=f"{p['desc']} — {BL.PCNOTE[pc]}.", role=p['role'],
                            tags=['gothic', p['space'], p['family']] + p['tags'], rep='repeat' if p['repeat'] else 'fixed', piece=p['id'])
                if p['frames'] > 1:
                    base = pins.block(f"{mod}/{p['id']}/{x}.{y}", p['frames'])
                    for f in range(p['frames']):
                        img[base + f] = BL.norm(crop(frames[f])); info[base + f] = dict(meta, pc=pc, label=f"{meta['label']} · {f + 1}/{p['frames']}프레임")
                    strips.append(dict(baseTile=base, frames=p['frames'], fps=p['fps']))
                    cells[(x, y)] = (base, pc)
                else:
                    cells[(x, y)] = (put(f"{mod}/{p['id']}/{x}.{y}", crop(frames[0]), pc, meta), pc)
        piece_cells[p['id']] = cells

    # 2) 오토타일(47종 블롭)
    autotile_groups = []
    for mod, a in autos:
        masks, tiles, _, _ = gmlib.autotile_cells(a)
        tid_of = {}
        for m in masks:
            tid_of[m] = put(f"{mod}/{a['id']}/m{m}!", tiles[m], a['pc'],
                            dict(label=f"{a['name']} (이웃 {m})", desc=f"{a['desc']} 오토타일 칸(이웃 마스크 {m}) — 붓이 이웃에 맞춰 고른다.", role=a['role'],
                                 tags=['gothic', a['space'], 'autotile'] + a['tags'], rep='auto', piece=a['id']))
        mem = sorted(set(tid_of.values()))
        autotile_groups.append(dict(id=a['id'], name=a['name'], neighborhood=8, memberTileIds=mem, connectTileIds=mem,
                                    variantMap={str(m): tid_of[gmlib.canon(m)] for m in range(256)}, layer=a['layer'], edgeConnects=True))
        piece_cells[a['id']] = {(0, 0): (tid_of[255], a['pc'])}

    # 2a) 줄 조각(담·철책·산울타리) — 4방 이웃 16칸, 오토타일 그룹(neighborhood 4)
    for mod, r in runs:
        cells = gmlib.run_cells(r)
        tid_of = {}
        for m in range(16):
            tid_of[m] = put(f"{mod}/{r['id']}/r{m}!", cells[m], r['pc'],
                            dict(label=f"{r['name']} (이웃 {m})", desc=f"{r['desc']} 줄 칸(4방 이웃 마스크 {m}: 북1 동2 남4 서8) — 붓이 이웃에 맞춰 고른다.", role=r['role'],
                                 tags=['gothic', r['space'], 'autotile', '줄'] + r['tags'], rep='auto', piece=r['id']))
        mem = sorted(set(tid_of.values()))
        autotile_groups.append(dict(id=r['id'], name=r['name'], neighborhood=4, memberTileIds=mem, connectTileIds=mem,
                                    variantMap={str(m): tid_of[m] for m in range(16)}, layer=r['layer'], edgeConnects=False))
        piece_cells[r['id']] = {(0, 0): (tid_of[10], r['pc'])}

    # 2b) 방 짓기 역할표(build_hand_interior_room) — 변형 칸은 pins 의 roomkit/… 키로 끝에 덧붙는다.
    room_spec = roomkit_gm.build(pieces, piece_cells, img, put, dict(wallsets=space_recipes_gm.WALLSETS))

    count = max(list(img) + [0]) + 1
    count = max(count, pins.next_id)
    assert math.ceil(count / TPR) * 16 <= BL.MAX_H, ('시트 높이 초과', count)
    for t in range(count):
        if t not in img: img[t] = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    sheet = BL.render_sheet(img, count, TPR)

    # 3) 칸 정의
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    passability, priority, terrain, tile_meta = [], [], [], []
    for t in range(count):
        inf = info.get(t)
        if inf is None:
            passability.append(dict(SOLID)); priority.append('lower'); terrain.append(0)
            tile_meta.append(dict(label='빈 칸', description='빈 칸(번호 고정·애니메이션 행 맞춤용) — 쓰지 않는다.', source='bundled-default')); continue
        prio, passable, passage, home = BL.PC[inf['pc']]
        passability.append(dict(PASS) if passable else dict(SOLID)); priority.append(prio); terrain.append(0)
        m = dict(label=inf['label'][:80], description=inf['desc'][:400], role=inf['role'], passage=passage, defaultLayer=home, tags=list(dict.fromkeys(inf['tags'])),
                 source='bundled-default', confidence='high', repeatability=inf['rep'] if inf['rep'] in ('auto', 'repeat', 'fixed') else 'fixed')
        if inf['pc'] == 'flat': m['locked'] = True; m['layerBacking'] = 'none'; m['description'] += ' 투명 덧그림: 붓은 위층, 캐릭터 밑에 그린다.'
        elif home == 'upper': m['layerBacking'] = 'none'
        tile_meta.append(m)

    # 4) 키트·그룹
    kits, groups = [], collections.OrderedDict()
    pmap = {p['id']: (mod, p) for mod, p in pieces}
    for mod, p in pieces:
        cells = piece_cells[p['id']]
        tids = sorted({t for t, _ in cells.values()})
        if p['frames'] > 1: tids = sorted({t + f for t in tids for f in range(p['frames'])})
        floor_like = p['repeat'] and p['w'] * p['h'] == 1
        gkey = ('floor:' + p['id']) if floor_like else f"{p['space']}:{p['family']}"
        if gkey not in groups:
            if floor_like:
                groups[gkey] = dict(id=f"gm:{gkey}", name=p['name'], role=p['role'] if p['role'] in BL.ENUM['grole'] else 'terrain', defaultLayer='lower',
                                    tileIds=set(), description=p['desc'], placementRules=(p['rules'] or p['desc']) + ' 낱칸으로 이어 칠한다(16 주기, 이음새 없음).')
            else:
                groups[gkey] = dict(id=f"gm:{gkey}", name=f"{gmlib.SPACES[p['space']]} · {FAMILY_KO[p['family']]}", role=ROLE_FROM_FAMILY[p['family']], defaultLayer='upper',
                                    tileIds=set(), description=f"{gmlib.SPACES[p['space']]}의 {FAMILY_KO[p['family']]} 조각 칸 모음.",
                                    placementRules='다칸 조각은 낱칸으로 칠하지 않고 같은 이름의 키트(gm-…)로 찍는다.')
        groups[gkey]['tileIds'] |= set(tids)
        if floor_like: continue
        rows = []
        for y in range(p['h']):
            lo = [-1] * p['w']; up = [-1] * p['w']
            for x in range(p['w']):
                if (x, y) not in cells: continue
                t, pc = cells[(x, y)]
                (lo if pc in BL.LOWER_PC else up)[x] = t
            rows.append(dict(tiles=lo, upperTiles=up))
        ai = dict(description=p['desc'][:400], placementRules=(p['rules'] or '키트 하나로 찍는다(낱칸으로 칠하지 않는다).')[:400],
                  tags=['gothic', gmlib.SPACES[p['space']], FAMILY_KO[p['family']]] + p['tags'], role=p['role'],
                  repeatability='repeat' if p['repeat'] else 'fixed', layerHome='upper', themes=['고딕 호러'], origin='ai', confidence='high')
        if p['family'] in ('furniture', 'nature', 'creatures', 'vehicles'): ai['snap'] = 'floor'; ai['anchor'] = dict(dx=p['w'] // 2, dy=p['h'] - 1)
        if p['states']: ai['tags'].append('상태:' + p['states'])
        if p['frames'] > 1: ai['tags'].append(f"애니메이션 {p['frames']}프레임")
        if p.get('access'): ai['tags'].append('출입:' + ' '.join(f'{x},{y}' for x, y in p['access']))
        kits.append(dict(id=p['id'], kind='section', name=p['name'], width=p['w'], height=p['h'], tileSize=16, rows=rows, learnedFrom='db-authored', ai=ai))
    for mod, a in autos:
        g = next(x for x in autotile_groups if x['id'] == a['id'])
        groups['auto:' + a['id']] = dict(id=f"gm:auto:{a['id']}", name=a['name'], role='water' if a['pc'] == 'solidfloor' else 'terrain', defaultLayer=a['layer'],
                                         tileIds=set(g['memberTileIds']), description=a['desc'], placementRules=(a['rules'] or a['desc']) + ' 오토타일 — 붓·fill_region 이 이웃에 맞는 칸을 고른다.')
    for mod, r in runs:
        g = next(x for x in autotile_groups if x['id'] == r['id'])
        groups['run:' + r['id']] = dict(id=f"gm:run:{r['id']}", name=r['name'], role=r['role'] if r['role'] in BL.ENUM['grole'] else 'prop', defaultLayer=r['layer'],
                                        tileIds=set(g['memberTileIds']), description=r['desc'], placementRules=(r['rules'] or r['desc']) + ' 줄 오토타일(4방) — 같은 붓으로 이어 칠하면 모퉁이·끝이 맞는다.')
    tile_groups = []
    for g in groups.values():
        g['tileIds'] = sorted(g['tileIds'])
        g['defaultLayer'], g['layerHome'] = BL.derive_group_layer(g['defaultLayer'], g['tileIds'], priority, tile_meta)
        g.update(source='bundled-default', confidence='high')
        tile_groups.append(g)
    data = collections.OrderedDict(id=ID, name=NAME, textureKey=TEXTURE, family=FAMILY, tileSize=16, tilesPerRow=TPR, count=count, libraryEnd=count,
                                   passability=passability, priority=priority, terrain=terrain, tileMeta=tile_meta, tileGroups=tile_groups,
                                   autotileGroups=autotile_groups, animationStrips=sorted(strips, key=lambda s: s['baseTile']), structureKits=kits)

    # 5) 검증
    rep = collections.OrderedDict()
    chk = BL.check_definition(data, TPR)
    for code in ('group-prefix', 'kit-prefix'): chk['by_code'].pop(code, None); chk['examples'].pop(code, None)
    chk['violations'] = sum(chk['by_code'].values())
    rep['definition'] = chk
    expected = {k['id']: BL.norm(gmlib.render_piece(pmap[k['id']][1], 0).img()) for k in kits}
    mism = [k['id'] for k in kits if not BL.same_image(BL.reassemble(k, sheet, TPR), expected[k['id']])]
    rep['reassembly'] = dict(kits=len(kits), mismatched=len(mism), ids=mism[:20])
    offs = sum(1 for t in range(count) if BL.off_palette(img[t], gmlib.PALSET))
    rep['palette'] = dict(cells_off_palette=offs)
    rep['tiles'] = dict(count=count, rows=math.ceil(count / TPR), sheetPx=[TPR * 16, math.ceil(count / TPR) * 16], strips=len(strips), kits=len(kits),
                        groups=len(tile_groups), autotiles=len(autotile_groups))
    outdoor = {'grounds', 'manor', 'graveyard', 'chapel', 'crypt'}
    rep['adopted'] = dict(pieces=len(pieces), autotiles=len(autos), runs=len(runs),
                          outdoor=sum(1 for _, p in pieces if p['space'] in outdoor or p['id'].startswith('gm-bld-')) + len(autos) + len(runs),
                          interior=sum(1 for _, p in pieces if not (p['space'] in outdoor or p['id'].startswith('gm-bld-'))))
    by_mod = collections.Counter(m for m, _ in pieces)
    rep['by_module'] = {m: by_mod.get(m, 0) for m in MODULES}
    rep['assembled'] = asm
    rep['rejected'] = rejected
    rep['roomkit'] = dict(floors=len(room_spec['floors']), walls=len(room_spec['walls']))
    out = dict(data=data, sheet=sheet, report=rep, room_spec=room_spec, piece_cells=piece_cells)
    if dry: return out
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['roomspec'], room_spec, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    pins_out = dict(version=1, tilesPerRow=TPR, cells=dict(sorted(pins.map.items(), key=lambda kv: kv[1])), strips=pins.strips)
    wr(P['pins'], pins_out, indent=0)
    d2 = json.load(open(P['tileset'], encoding='utf-8')); s2 = Image.open(P['png']).convert('RGBA')
    rep['reassembly_from_files'] = sum(1 for k in d2['structureKits'] if not BL.same_image(BL.reassemble(k, s2, TPR), expected[k['id']]))
    wr(P['report'], rep, indent=1)
    return out


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true')
    a = ap.parse_args()
    o = bake(dry=a.dry)
    r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'adopted', 'reassembly', 'palette', 'roomkit')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'])
    print('조립 영수증', json.dumps(r['assembled'], ensure_ascii=False))
    print('거절', len(r['rejected']), [x['id'] for x in r['rejected']])
    if not a.dry: print('재조립(파일)', r['reassembly_from_files'])
