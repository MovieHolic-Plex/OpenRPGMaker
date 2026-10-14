"""prehistoric 굽기 부품(steampunk_city sp_bake_lib 사본 + 조립 표본 덮임) — 원래: steampunk_city 굽기 부품 — scripts/content/lib/theme_bake.py(modern_campus·gothic_manor)의 사본에 칸 통행 규칙(발자국 줄·막힌 바닥)을 더했다.

원래 설명: 테마 칩셋 굽기 공용 부품 (modern_campus · gothic_manor) — object-gate 영수증이 있는 PNG 조각을 16px 칸으로 잘라 시트·타일셋 정의로 합친다.

조각 계약(piece dict): id, name(한국어), kind(object-gate 종류), png, group, desc, tags, [entrance: 바닥 줄 칸 x 목록], [frames: PNG 목록 = 애니메이션].
- 칸 통행(pc): terrain/flat 은 불투명이면 floor·투명이면 flat, debris 는 star, organic 은 윗줄 star·밑줄 solid, 그 밖은 solid. 건물 문 칸은 solid 로 두고
  키트 부품(entrance)·접근칸(access)으로 선언한다(jp_city 와 같은 계약 — 문 칸은 막힘, 이벤트는 문 칸에, 접근칸은 걸을 수 있는 바닥).
- 번호는 자리 키 핀(덧붙이기 전용). 같은 그림·같은 pc 는 한 칸을 공유한다(애니메이션 칸 제외).
- 3/4 관문: gate_status() 가 그림 화소 해시의 영수증을 읽는다. pass 만 굽는다. 판정 프로필이 보정 전이면 임시통과(provisional)로 세고 보고에 적는다.
"""
import collections, hashlib, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
sys.path.insert(0, os.path.join(ROOT, 'scripts', 'content', 'jp-city'))
import object_gate as OG        # noqa: E402
import bake_lib as BL           # noqa: E402  (pc 표 · 시트 · 재조립 · 정의 검사 — 읽기만)

T = 16
PC, LOWER_PC, PCNOTE = BL.PC, BL.LOWER_PC, BL.PCNOTE


# ───────────────────────── 관문 ─────────────────────────
def gate_status(png, kind):
    """'pass' | 'prov'(영수증 pass, 프로필 미보정) | 이유(str, 막힘). 영수증 파일을 직접 읽어 FAIL 을 임시통과로 세지 않는다."""
    sha = OG.pixel_sha256(png)
    r = OG.read_receipt(sha)
    if not r: return '영수증 없음'
    if r.get('kind') != kind: return '영수증 종류 %s != %s' % (r.get('kind'), kind)
    if r.get('verdict') != 'pass': return '불합격 ' + ' · '.join(r.get('reasons') or [])[:120]
    why = OG.refusal(png, kind=kind, context='bundle')
    if why is None: return 'pass'
    if '보정되지 않았다' in why: return 'prov'
    return why


# ───────────────────────── 조립 표본 덮임 ─────────────────────────
_MANIFESTS = None


def _manifests():
    global _MANIFESTS
    if _MANIFESTS is None:
        _MANIFESTS = {}
        for g in ('terrain', 'interior'):
            d = os.path.join(ROOT, 'tiledata', 'prehistoric', g, '_gate_assembled')
            mp = os.path.join(d, 'manifest.json')
            if not os.path.exists(mp): continue
            for sid, m in json.load(open(mp, encoding='utf-8')).items():
                png = os.path.join(ROOT, m['png'])
                for part in m['parts']: _MANIFESTS.setdefault(part['id'], []).append((png, part['x'], part['y']))
    return _MANIFESTS


def covered_status(piece_id, png):
    """조립 표본(가장자리 낱칸·벽면·천장·벽화가 화소 그대로 들어간 방/풀밭 한 장, kind terrain)의 영수증으로 덮이는가.
    표본 안 그 자리 화소가 조각 PNG 와 같아야 한다(한 화소라도 바뀌면 덮임이 풀린다). 'pass' | 'prov' | 이유."""
    places = _manifests().get(piece_id)
    if not places: return '조립 표본에 없음'
    me = np.asarray(Image.open(png).convert('RGBA'))
    last = '표본 없음'
    for (sw, x, y) in places:
        if not os.path.exists(sw): last = '표본 PNG 없음'; continue
        a = np.asarray(Image.open(sw).convert('RGBA'))[y:y + me.shape[0], x:x + me.shape[1]]
        if a.shape != me.shape or not (a == me).all(): last = '표본 화소 불일치(다시 내보내기)'; continue
        st = gate_status(sw, 'terrain')
        if st in ('pass', 'prov'): return st
        last = '표본 ' + os.path.basename(sw) + ': ' + st
    return last


class Pins:
    """자리 키 → 칸 번호(덧붙이기 전용). 애니메이션 블록은 한 줄 안 연속 n 칸."""
    def __init__(self, path, tpr):
        self.path, self.tpr = path, tpr
        prev = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
        self.map = dict(prev.get('cells', {})); self.strips = dict(prev.get('strips', {}))
        used = list(self.map.values()) + [b + n - 1 for b, n in self.strips.values()]
        self.next_id = max(used) + 1 if used else 1          # 0 번은 빈 칸

    def one(self, key):
        if key not in self.map: self.map[key] = self.next_id; self.next_id += 1
        return self.map[key]

    def block(self, key, n):
        if key in self.strips and self.strips[key][1] == n: return self.strips[key][0]
        if self.next_id % self.tpr + n > self.tpr: self.next_id += self.tpr - self.next_id % self.tpr
        self.strips[key] = [self.next_id, n]; self.next_id += n
        return self.strips[key][0]

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        out = dict(version=1, tilesPerRow=self.tpr, cells=dict(sorted(self.map.items(), key=lambda kv: kv[1])), strips=self.strips)
        open(self.path, 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=0) + '\n')


def cell_pc(kind, cell_img, row, rows, foot=None, blocked_floor=False, x=0, solid_cells=None):
    """한 칸의 통행 종류. 비어 있으면 None.
    - terrain/flat: 불투명이면 floor(blocked_floor 면 solidfloor — 물·배관 도랑·석축), 투명이면 flat.
    - debris: star. organic: 윗줄 star·밑줄 solid.
    - 그 밖(서 있는 소품·건물): foot(발자국 줄 수)가 주어지면 맨 아래 foot 줄만 solid, 그 위는 star(뒤로 지나가면 위에 그려진다).
      solid_cells 가 주어지면 그 (x, y) 만 solid 이고 나머지 칸은 star(문형 기중기 다리 사이로 지나간다).
    """
    a = np.asarray(cell_img)[:, :, 3]
    if not a.any(): return None
    opaque = bool((a == 255).all())
    if kind in ('terrain', 'flat'): return ('solidfloor' if blocked_floor else 'floor') if opaque else 'flat'
    if kind == 'debris': return 'star'
    if kind == 'organic' and rows > 1 and row < rows - 1: return 'star'
    if solid_cells is not None: return 'solid' if (x, row) in solid_cells else 'star'
    if foot is not None and row < rows - foot: return 'star'
    return 'solid'


def door_cells_by_color(png, door_rgb, min_px=60):
    """건물 PNG 맨 아랫줄에서 문(유리색) 화소가 min_px 이상인 칸의 x 목록."""
    a = np.array(Image.open(png).convert('RGBA')); h, w = a.shape[:2]
    m = (a[h - 11:h - 2, :, :3] == np.array(door_rgb)).all(axis=2)
    return [x for x in range(w // T) if int(m[:, x * T:(x + 1) * T].sum()) >= min_px]


class Outdoor:
    """조각 → 칸·키트·그룹·애니메이션. 인테리어/기타 칸은 put() 으로 같은 시트에 얹는다."""
    def __init__(self, pins, tpr, prefix, tag_theme):
        self.pins, self.tpr, self.prefix, self.theme = pins, tpr, prefix, tag_theme
        self.img, self.info, self.dedupe = {}, {}, {}
        self.strips, self.kits, self.groups = [], [], collections.OrderedDict()
        self.piece_cells = {}

    def put(self, key, im, pc, meta):
        im = BL.norm(im)
        k2 = (im.tobytes(), pc)
        if k2 in self.dedupe and not key.endswith('!'): return self.dedupe[k2]
        tid = self.pins.one(key)
        self.img[tid] = im; self.info[tid] = dict(meta, pc=pc); self.dedupe.setdefault(k2, tid)
        return tid

    def add_piece(self, p):
        """p: dict(id,name,kind,png,group,desc,tags,entrance?,frames?,role?)"""
        im = Image.open(p['png']).convert('RGBA'); W, H = im.width // T, im.height // T
        frames = [Image.open(f).convert('RGBA') for f in p['frames']] if p.get('frames') else None
        cells = {}
        ent = set(p.get('entrance') or [])
        for y in range(H):
            for x in range(W):
                crop = lambda s: s.crop((x * T, y * T, x * T + T, y * T + T))
                pc = cell_pc(p['kind'], crop(frames[0] if frames else im), y, H, foot=p.get('foot'), blocked_floor=p.get('blocked', False), x=x,
                             solid_cells=set(map(tuple, p['solid_cells'])) if p.get('solid_cells') else None)
                if pc is None: continue
                if y == H - 1 and x in ent: pc = 'solid'
                where = f' ({x + 1},{y + 1})' if W * H > 1 else ''
                meta = dict(label=f"{p['name']}{where}", desc=f"{p['desc']} — {BL.PCNOTE[pc]}.", role=p.get('role', 'prop'),
                            tags=[self.theme, p['group']] + list(p.get('tags', [])), rep='repeat' if p['kind'] in ('terrain',) and W * H == 1 and not p.get('fixed') else 'fixed', piece=p['id'])
                key = f"out/{p['id']}/{x}.{y}"
                if frames:
                    base = self.pins.block(key, len(frames))
                    for f, fr in enumerate(frames):
                        self.img[base + f] = BL.norm(crop(fr)); self.info[base + f] = dict(meta, pc=pc, label=f"{meta['label']} · {f + 1}/{len(frames)}프레임")
                    self.strips.append(dict(baseTile=base, frames=len(frames), fps=p.get('fps', 4)))
                    cells[(x, y)] = (base, pc)
                else:
                    cells[(x, y)] = (self.put(key, crop(im), pc, meta), pc)
        self.piece_cells[p['id']] = dict(cells=cells, W=W, H=H, piece=p, frames=len(frames) if frames else 1, src=im if not frames else frames[0])
        return cells

    # ── 키트·그룹 ──
    def finish_pieces(self, pieces, role_of, ground_note):
        for p in pieces:
            pc_ = self.piece_cells[p['id']]; cells = pc_['cells']; W, H, nfr = pc_['W'], pc_['H'], pc_['frames']
            tids = sorted({t for t, _ in cells.values()})
            if nfr > 1: tids = sorted({t + f for t in tids for f in range(nfr)})
            single_terrain = p['kind'] in ('terrain', 'flat') and W * H == 1
            gkey = ('t:' + p['id']) if single_terrain else p['group']
            if gkey not in self.groups:
                if single_terrain:
                    self.groups[gkey] = dict(id=f"{self.prefix}:{p['id']}", name=p['name'], role='terrain', tileIds=set(), description=p['desc'],
                                             placementRules=f"{ground_note} 한 칸 그림을 낱칸으로 이어 칠한다(fill_region 에 이 이름을 쓴다).")
                else:
                    self.groups[gkey] = dict(id=f"{self.prefix}:{p['group']}", name=p.get('group_ko', p['group']), role=role_of(p), tileIds=set(),
                                             description=f"{p.get('group_ko', p['group'])} 조각 칸 모음.", placementRules='다칸 조각은 낱칸으로 칠하지 않고 같은 이름의 키트(' + self.prefix + '-…)로 찍는다.')
            self.groups[gkey]['tileIds'] |= set(tids)
            if single_terrain: continue
            rows = []
            for y in range(H):
                lo = [-1] * W; up = [-1] * W
                for x in range(W):
                    if (x, y) not in cells: continue
                    t, pc = cells[(x, y)]
                    (lo if pc in LOWER_PC else up)[x] = t
                rows.append(dict(tiles=lo, upperTiles=up))
            role = role_of(p)
            ai = dict(description=p['desc'][:400], placementRules=(p.get('rules') or '키트 하나로 찍는다(낱칸으로 칠하지 않는다).')[:400],
                      tags=[self.theme, p.get('group_ko', p['group'])] + list(p.get('tags', [])), role=role, repeatability='fixed', layerHome='upper',
                      themes=[self.theme], origin='ai', confidence='high', snap='floor', anchor=dict(dx=W // 2, dy=H - 1))
            if nfr > 1: ai['tags'].append(f'애니메이션 {nfr}프레임')
            # stamp_tileset_object(조수의 키트 찍기 도구)가 읽는 종류 낱말: decal 바닥 표시 · overhead 머리 위(낙하물) · prop 막힘(기본)
            ai['tags'].append('decal' if p['kind'] == 'flat' else 'overhead' if p['kind'] == 'debris' else 'prop')
            kit = dict(id=p['id'], kind='section', name=p['name'], width=W, height=H, tileSize=16, rows=rows, learnedFrom='pack-preset', ai=ai)
            ent = p.get('entrance')
            if ent:
                kit['parts'] = [dict(id=f"{p['id']}-door", kind='entrance', dx=min(ent), dy=H - 1, w=max(ent) - min(ent) + 1, h=1, label='출입구(문 칸은 막힘 — 이벤트는 문 칸에)')]
                ai['access'] = [dict(dx=x, dy=H) for x in range(min(ent), max(ent) + 1)]
                ai['placementRules'] = (ai['placementRules'] + ' 문 바로 아래 칸(접근칸)은 걸을 수 있는 바닥으로 비워 둔다.')[:400]
            self.kits.append(kit)


def finalize(ID, NAME, TEXTURE, FAMILY, TPR, O, extra_groups, extra_kits, priority_fix=None):
    """칸 정의(통행·층·메타)를 만들어 data(OrderedDict) 를 돌려준다. O = Outdoor."""
    img, info = O.img, O.info
    count = max(list(img) + [0]) + 1
    count = max(count, O.pins.next_id)
    assert math.ceil(count / TPR) * 16 <= BL.MAX_H, ('시트 높이 초과', count)
    for t in range(count):
        if t not in img: img[t] = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    sheet = BL.render_sheet(img, count, TPR)
    SOLID = dict(up=False, down=False, left=False, right=False); PASS = dict(up=True, down=True, left=True, right=True)
    passability, priority, terrain, tile_meta = [], [], [], []
    for t in range(count):
        inf = info.get(t)
        if inf is None:
            passability.append(dict(SOLID)); priority.append('lower'); terrain.append(0)
            tile_meta.append(dict(label='빈 칸', description='빈 칸(번호 고정·애니메이션 행 맞춤용) — 쓰지 않는다.', source='bundled-default')); continue
        prio, passable, passage, home = PC[inf['pc']]
        passability.append(dict(PASS) if passable else dict(SOLID)); priority.append(prio); terrain.append(0)
        m = dict(label=inf['label'][:80], description=inf['desc'][:400], role=inf['role'], passage=passage, defaultLayer=home, tags=list(dict.fromkeys(inf['tags'])),
                 source='bundled-default', confidence='high', repeatability=inf['rep'] if inf['rep'] in ('auto', 'repeat', 'fixed') else 'fixed')
        if inf['pc'] == 'flat': m['locked'] = True; m['layerBacking'] = 'none'; m['description'] += ' 투명 덧그림: 붓은 위층, 캐릭터 밑에 그린다.'
        elif home == 'upper': m['layerBacking'] = 'none'
        tile_meta.append(m)
    groups = list(O.groups.values()) + list(extra_groups)
    tile_groups = []
    for g in groups:
        g['tileIds'] = sorted(set(g['tileIds']))
        g['defaultLayer'], g['layerHome'] = BL.derive_group_layer('lower' if g.get('role') == 'terrain' else 'upper', g['tileIds'], priority, tile_meta)
        g.update(source='bundled-default', confidence='high')
        tile_groups.append(g)
    kits = O.kits + list(extra_kits)
    data = collections.OrderedDict(id=ID, name=NAME, textureKey=TEXTURE, family=FAMILY, tileSize=16, tilesPerRow=TPR, count=count, libraryEnd=count,
                                   passability=passability, priority=priority, terrain=terrain, tileMeta=tile_meta, tileGroups=tile_groups,
                                   autotileGroups=[], animationStrips=sorted(O.strips, key=lambda s: s['baseTile']), structureKits=kits)
    return data, sheet, count


def verify(data, sheet, TPR, expected_by_kit):
    """정의 검사 + 키트 재조립(PNG 와 화소 일치). expected_by_kit: kit id → RGBA 이미지(정규화 전)."""
    chk = BL.check_definition(data, TPR)
    for code in ('group-prefix', 'kit-prefix'): chk['by_code'].pop(code, None); chk['examples'].pop(code, None)
    chk['violations'] = sum(chk['by_code'].values())
    mism = []
    for k in data['structureKits']:
        exp = expected_by_kit.get(k['id'])
        if exp is None: continue
        if not BL.same_image(BL.reassemble(k, sheet, TPR), BL.norm(exp)): mism.append(k['id'])
    return dict(definition=chk, reassembly=dict(kits=len(data['structureKits']), checked=len(expected_by_kit), mismatched=len(mism), ids=mism[:20]))
