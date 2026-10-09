"""wizarding_world 굽기 — 검수 통과(PASS·해시 일치) 조각만 모아 공용 타일셋·캐릭터 시트·예제 맵을 쓴다.

  python3 scripts/content/wizarding/bake_wz.py            # 쓰기
  python3 scripts/content/wizarding/bake_wz.py --dry      # 보고만
  python3 scripts/content/wizarding/bake_wz.py --all      # 검수 무시(미리보기 전용 — 출하 금지)

산출: public/assets/wizarding-world/wizarding-world-chipset.png · src/assets/wizardingWorldTileset.json · src/assets/wizardingWorldSheet.json · src/assets/wizardingRoomSpec.json
      public/assets/generated/charsets/Wizarding<N>.png · src/assets/wizardingCharsets.json
      tiledata/wizarding/pins.json · tiledata/wizarding/bake-report.json · tiledata/wizarding/examples/<id>.{json,png}
번호는 자리 키 핀(`pins.json`)으로 고정 — 그림을 고쳐도 번호가 안 바뀌고 새 칸은 끝에 덧붙는다. 애니메이션 칸은 한 행 안에 연속 배치.
"""
import argparse, collections, hashlib, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import wzlib, loader, roomkit_wz  # noqa: E402
import bake_lib as BL           # noqa: E402  (jp_city 굽기 보조 — pc 표·시트·재조립·정의 검사)

ROOT = wzlib.ROOT
ID, NAME, TEXTURE, FAMILY = 'wizarding_world', '마법 학교 (해리포터풍)', 'tex_wizarding_world', 'oprn-wizard'
TPR = 48
P = dict(png=os.path.join(ROOT, 'public/assets/wizarding-world/wizarding-world-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/wizardingWorldTileset.json'),
         sheet=os.path.join(ROOT, 'src/assets/wizardingWorldSheet.json'),
         chars=os.path.join(ROOT, 'src/assets/wizardingCharsets.json'),
         charpng=os.path.join(ROOT, 'public/assets/generated/charsets'),
         pins=os.path.join(wzlib.TD, 'pins.json'), report=os.path.join(wzlib.TD, 'bake-report.json'),
         examples=os.path.join(wzlib.TD, 'examples'),
         roomspec=os.path.join(ROOT, 'src/assets/wizardingRoomSpec.json'), spacespec=os.path.join(ROOT, 'src/assets/wizardingSpaceSpec.json'))
WALK_PC = wzlib.WALK_PC
FAMILY_KO = dict(architecture='건축', surfaces='바닥', furniture='가구', nature='자연', characters='인물', creatures='생물', vehicles='탈것', effects='효과')
ROLE_FROM_FAMILY = dict(architecture='wall', surfaces='terrain', furniture='prop', nature='prop', creatures='prop', vehicles='prop', effects='prop', characters='prop')
NATIVE_CHARS = [  # 데모가 쓴 승인 native 걷기 시트(72×128, 행 위·오른쪽·아래·왼쪽)
    ('wz-chr-elder-wandmaker', '노년 지팡이 장인', 'wandshop', 'native/wandshop/actors/elder-wandmaker/walk.png'),
    ('wz-chr-trial-student', '지팡이 시험 학생', 'wandshop', 'native/wandshop/actors/trial-student/walk.png'),
    ('wz-chr-potions-master', '마법약 교사', 'potions', 'native/potions/actors/potions-master/walk.png'),
    ('wz-chr-potions-student', '마법약 학생', 'potions', 'native/potions/actors/potions-student/walk.png'),
    ('wz-chr-potions-assistant', '마법약 조교', 'potions', 'native/potions/actors/potions-assistant/walk.png'),
]


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


# ───────────────────────── 검수 판정 ─────────────────────────
def verdicts(mod):
    p = os.path.join(wzlib.TD, 'review', f'{mod}.verdict.json')
    if not os.path.exists(p): return {}
    v = json.load(open(p, encoding='utf-8'))
    out = {}
    for sect in ('pieces', 'autotiles', 'characters'):
        for k, e in (v.get(sect) or {}).items(): out[k] = e
    return out


def auto_hash(a):
    _, tiles, patch, ic = wzlib.autotile_cells(a)
    return hashlib.sha256(patch.img().tobytes() + ic.img().tobytes()).hexdigest()


def char_hash(ch):
    return hashlib.sha256(wzlib.render_character(ch).img().tobytes()).hexdigest()


def adopted(regs, take_all=False):
    """(조각[(mod,p)], 오토타일[(mod,a)], 캐릭터[(mod,ch)], 거절 목록)"""
    pcs, ats, chs, rejected = [], [], [], []
    for mod, reg in regs.items():
        V = verdicts(mod)
        for kind, coll, hf in (('piece', reg.pieces, wzlib.piece_hash), ('autotile', reg.autotiles, auto_hash), ('character', reg.characters, char_hash)):
            for k, d in coll.items():
                v = V.get(k)
                ok = take_all or (v and v.get('verdict') == 'PASS' and v.get('hash') == hf(d))
                if not ok:
                    rejected.append(dict(module=mod, kind=kind, id=k, why=('판정 없음' if not v else v.get('verdict') if v.get('verdict') != 'PASS' else '해시 불일치(판정 뒤 그림이 바뀜)'),
                                         reason=(v or {}).get('reason', '')[:200]))
                    continue
                (pcs if kind == 'piece' else ats if kind == 'autotile' else chs).append((mod, d))
    return pcs, ats, chs, rejected


# ───────────────────────── 굽기 ─────────────────────────
def bake(dry=False, take_all=False):
    regs, load_errs = loader.load_all(quiet=True)
    pieces, autos, chars, rejected = adopted(regs, take_all)
    pins = Pins(P['pins'])
    img, info = {}, {}              # tid → Image, tid → dict(pc,label,desc,role,tags,rep)
    dedupe = {}                     # (bytes, pc) → tid
    strips = []
    piece_cells = {}                # pid → {(x,y): (tid, pc)}

    def put(key, im, pc, meta):
        im = BL.norm(im)
        k2 = (im.tobytes(), pc)
        if k2 in dedupe and not key.endswith('!'): return dedupe[k2]
        tid = pins.one(key)
        img[tid] = im; info[tid] = dict(meta, pc=pc); dedupe.setdefault(k2, tid)
        return tid

    # 1) 조각
    for mod, p in pieces:
        frames = [wzlib.render_piece(p, f).img() for f in range(p['frames'])]
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
                            tags=['wizarding', p['space'], p['family']] + p['tags'], rep='repeat' if p['repeat'] else 'fixed', piece=p['id'])
                if p['frames'] > 1:
                    base = pins.block(f"{mod}/{p['id']}/{x}.{y}", p['frames'])
                    for f in range(p['frames']):
                        img[base + f] = BL.norm(crop(frames[f])); info[base + f] = dict(meta, pc=pc, label=f"{meta['label']} · {f + 1}/{p['frames']}프레임")
                    strips.append(dict(baseTile=base, frames=p['frames'], fps=p['fps']))
                    cells[(x, y)] = (base, pc)
                else:
                    cells[(x, y)] = (put(f"{mod}/{p['id']}/{x}.{y}", crop(frames[0]), pc, meta), pc)
        piece_cells[p['id']] = cells

    # 2) 오토타일
    autotile_groups = []
    for mod, a in autos:
        masks, tiles, _, _ = wzlib.autotile_cells(a)
        tid_of = {}
        for m in masks:
            tid_of[m] = put(f"{mod}/{a['id']}/m{m}!", tiles[m], a['pc'],
                            dict(label=f"{a['name']} (이웃 {m})", desc=f"{a['desc']} 오토타일 칸(이웃 마스크 {m}) — 붓이 이웃에 맞춰 고른다.", role=a['role'],
                                 tags=['wizarding', a['space'], 'autotile'] + a['tags'], rep='auto', piece=a['id']))
        mem = sorted(set(tid_of.values()))
        autotile_groups.append(dict(id=a['id'], name=a['name'], neighborhood=8, memberTileIds=mem, connectTileIds=mem,
                                    variantMap={str(m): tid_of[wzlib.canon(m)] for m in range(256)}, layer=a['layer'], edgeConnects=True))
        piece_cells[a['id']] = {(0, 0): (tid_of[255], a['pc'])}

    # 2b) 방 짓기 역할표(build_hand_interior_room) — 변형 칸은 pins 의 roomkit/… 키로 끝에 덧붙는다.
    room_spec = roomkit_wz.build(pieces, piece_cells, img, put, json.load(open(P['spacespec'], encoding='utf-8')))

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
        gkey = ('floor:' + p['id']) if p['repeat'] else f"{p['space']}:{p['family']}"
        if gkey not in groups:
            if p['repeat']:
                groups[gkey] = dict(id=f"wz:{gkey}", name=p['name'], role=p['role'] if p['role'] in BL.ENUM['grole'] else 'terrain', defaultLayer='lower',
                                    tileIds=set(), description=p['desc'], placementRules=(p['rules'] or p['desc']) + ' 낱칸으로 이어 칠한다(16 주기, 이음새 없음).')
            else:
                groups[gkey] = dict(id=f"wz:{gkey}", name=f"{wzlib.SPACES[p['space']]} · {FAMILY_KO[p['family']]}", role=ROLE_FROM_FAMILY[p['family']], defaultLayer='upper',
                                    tileIds=set(), description=f"{wzlib.SPACES[p['space']]}의 {FAMILY_KO[p['family']]} 조각 칸 모음.",
                                    placementRules='다칸 조각은 낱칸으로 칠하지 않고 같은 이름의 키트(wz-…)로 찍는다.')
        groups[gkey]['tileIds'] |= set(tids)
        if p['repeat'] and p['w'] * p['h'] == 1: continue
        rows = []
        for y in range(p['h']):
            lo = [-1] * p['w']; up = [-1] * p['w']
            for x in range(p['w']):
                if (x, y) not in cells: continue
                t, pc = cells[(x, y)]
                (lo if pc in BL.LOWER_PC else up)[x] = t
            rows.append(dict(tiles=lo, upperTiles=up))
        ai = dict(description=p['desc'][:400], placementRules=(p['rules'] or '키트 하나로 찍는다(낱칸으로 칠하지 않는다).')[:400],
                  tags=['wizarding', wzlib.SPACES[p['space']], FAMILY_KO[p['family']]] + p['tags'], role=p['role'],
                  repeatability='repeat' if p['repeat'] else 'fixed', layerHome='upper', themes=['마법 학교'], origin='ai', confidence='high')
        if p['family'] in ('furniture', 'nature', 'creatures', 'vehicles'): ai['snap'] = 'floor'; ai['anchor'] = dict(dx=p['w'] // 2, dy=p['h'] - 1)
        if p['states']: ai['tags'].append('상태:' + p['states'])
        if p['frames'] > 1: ai['tags'].append(f"애니메이션 {p['frames']}프레임")
        kits.append(dict(id=p['id'], kind='section', name=p['name'], width=p['w'], height=p['h'], tileSize=16, rows=rows, learnedFrom='db-authored', ai=ai))
    for a in autotile_groups:
        _, ad = next((m, x) for m, x in autos if x['id'] == a['id'])
        groups['auto:' + a['id']] = dict(id=f"wz:auto:{a['id']}", name=a['name'], role='water' if ad['pc'] == 'solidfloor' else 'terrain', defaultLayer=ad['layer'],
                                         tileIds=set(a['memberTileIds']), description=ad['desc'], placementRules=(ad['rules'] or ad['desc']) + ' 오토타일 — 붓·fill_region 이 이웃에 맞는 칸을 고른다.')
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
    expected = {}
    for k in kits:
        mod, p = pmap[k['id']]
        exp = wzlib.render_piece(p, 0).img()
        # 아래층 F 이 아닌 칸의 투명은 그대로 — 재조립과 비교
        expected[k['id']] = BL.norm(exp)
    mism = [k['id'] for k in kits if not BL.same_image(BL.reassemble(k, sheet, TPR), expected[k['id']])]
    rep['reassembly'] = dict(kits=len(kits), mismatched=len(mism), ids=mism[:20])
    pal = wzlib.PALSET
    offs = sum(1 for t in range(count) if BL.off_palette(img[t], pal))
    rep['palette'] = dict(cells_off_palette=offs)
    rep['tiles'] = dict(count=count, rows=math.ceil(count / TPR), sheetPx=[TPR * 16, math.ceil(count / TPR) * 16], strips=len(strips), kits=len(kits),
                        groups=len(tile_groups), autotiles=len(autotile_groups))
    rep['adopted'] = dict(pieces=len(pieces), autotiles=len(autos), characters=len(chars) + len(NATIVE_CHARS))
    by_mod = collections.Counter(m for m, _ in pieces)
    rep['by_module'] = {m: dict(adopted=by_mod.get(m, 0), total=len(r.pieces) + len(r.autotiles) + len(r.characters)) for m, r in regs.items()}
    rep['rejected'] = rejected
    rep['load_errors'] = {k: v.splitlines()[-1] for k, v in load_errs.items()}

    # 6) 캐릭터 시트
    char_list = []
    for cid, name, space, rel in NATIVE_CHARS:
        char_list.append(dict(id=cid, name=name, space=space, desc=f'{name} — 데모에서 승인된 native 걷기 시트.', img=Image.open(os.path.join(wzlib.TD, rel)).convert('RGBA'), source='native'))
    for mod, ch in chars:
        char_list.append(dict(id=ch['id'], name=ch['name'], space=ch['space'], desc=ch['desc'], img=wzlib.render_character(ch).img(), source=mod))
    sheets, char_meta = [], []
    for i, c in enumerate(char_list):
        n, k = divmod(i, 8)
        if k == 0: sheets.append(Image.new('RGBA', (288, 256), (0, 0, 0, 0)))
        sheets[n].alpha_composite(c['img'], ((k % 4) * 72, (k // 4) * 128))
        char_meta.append(dict(id=c['id'], name=c['name'], space=c['space'], spaceName=wzlib.SPACES[c['space']], desc=c['desc'], sheet=n + 1, index=k, source=c['source']))
    rep['charsets'] = dict(sheets=len(sheets), characters=len(char_list))

    # 7) 예제 맵
    ex_out = []
    for mod, reg in regs.items():
        for ex in reg.examples:
            res = render_example(ex, piece_cells, pmap, sheet)
            if res is None: continue
            ex_out.append(res)
    rep['examples'] = [dict(id=e['id'], w=e['w'], h=e['h'], skipped=e['skipped']) for e in ex_out]

    rep['roomkit'] = dict(floors=len(room_spec['floors']), walls=len(room_spec['walls']))
    out = dict(data=data, sheet=sheet, report=rep, chars=char_meta, char_sheets=sheets, examples=ex_out, room_spec=room_spec)
    if dry: return out
    for k in ('png',): os.makedirs(os.path.dirname(P[k]), exist_ok=True)
    os.makedirs(P['charpng'], exist_ok=True); os.makedirs(P['examples'], exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['roomspec'], room_spec, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    pins_out = dict(version=1, tilesPerRow=TPR, cells=dict(sorted(pins.map.items(), key=lambda kv: kv[1])), strips=pins.strips)
    wr(P['pins'], pins_out, indent=0)
    for i, s in enumerate(sheets): s.save(os.path.join(P['charpng'], f'Wizarding{i + 1}.png'), optimize=True)
    wr(P['chars'], dict(version=1, sheets=len(sheets), characters=char_meta), indent=1)
    for e in ex_out:
        e['image'].save(os.path.join(P['examples'], e['id'] + '.png'))
        wr(os.path.join(P['examples'], e['id'] + '.json'), {k: v for k, v in e.items() if k != 'image'}, separators=(',', ':'))
    # 파일에서 다시 읽어 한 번 더
    d2 = json.load(open(P['tileset'], encoding='utf-8')); s2 = Image.open(P['png']).convert('RGBA')
    rep['reassembly_from_files'] = sum(1 for k in d2['structureKits'] if not BL.same_image(BL.reassemble(k, s2, TPR), expected[k['id']]))
    wr(P['report'], rep, indent=1)
    return out


def render_example(ex, piece_cells, pmap, sheet):
    """예제 → 아래/위층 배열(w*h, 행 우선)과 원본 해상도 그림. 채택 안 된 조각은 건너뛰고 기록."""
    W, H = ex['w'], ex['h']
    lower = [-1] * (W * H); upper = [-1] * (W * H); skipped = []
    fl = piece_cells.get(ex['floor'])
    if fl:
        t, pc = next(iter(fl.values()))
        for i in range(W * H): (lower if pc in BL.LOWER_PC else upper)[i] = t
    else: skipped.append(ex['floor'])
    for pid, x0, y0 in ex['place']:
        cells = piece_cells.get(pid)
        if not cells: skipped.append(pid); continue
        for (x, y), (t, pc) in cells.items():
            X, Y = x0 + x, y0 + y
            if not (0 <= X < W and 0 <= Y < H): continue
            if pc in BL.LOWER_PC: lower[Y * W + X] = t
            else: upper[Y * W + X] = t
    im = Image.new('RGBA', (W * 16, H * 16), (0, 0, 0, 255))
    for i in range(W * H):
        for t in (lower[i], upper[i]):
            if t >= 0: im.alpha_composite(BL.read_cell(sheet, t, TPR), ((i % W) * 16, (i // W) * 16))
    return dict(id=ex['id'], name=ex['name'], space=ex['space'], desc=ex['desc'], w=W, h=H, floor=ex['floor'], place=ex['place'],
                lower=lower, upper=upper, skipped=sorted(set(skipped)), image=im)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); ap.add_argument('--all', action='store_true')
    a = ap.parse_args()
    o = bake(dry=a.dry, take_all=a.all)
    r = o['report']
    print(json.dumps({k: r[k] for k in ('tiles', 'adopted', 'reassembly', 'palette', 'charsets')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'])
    print('모듈별', json.dumps(r['by_module'], ensure_ascii=False))
    if r['load_errors']: print('불러오기 실패', r['load_errors'])
    print('거절', len(r['rejected']))
