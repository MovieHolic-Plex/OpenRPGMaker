#!/usr/bin/env python3
"""wasteland_ruins 굽기 — object-gate 출구(bundle)를 통과한 조각만 모아 공용 번들 타일셋을 쓴다.

    python3 wl_bake.py            # 채택 = object_gate.refusal(관문 그림, kind, context="bundle") 이 None 인 조각만
    python3 wl_bake.py --dev      # 개발용: 영수증 판정이 "pass" 인 조각도 채택(요란한 경고). 구성기 개발 전용 — 출하물 아님
    python3 wl_bake.py --dry      # 쓰지 않고 보고만

산출: public/assets/wasteland-ruins/wasteland-ruins-chipset.png · src/assets/wastelandRuinsTileset.json · src/assets/wastelandRuinsSheet.json
      tiledata/wasteland-ruins/pins.json(자리 키 → 칸 번호, 덧붙이기 전용, 0 번 = 빈 칸) · tiledata/wasteland-ruins/bake-report.json
칸 통행(pc, jp_city bake_lib 와 같은 표): terrain = floor · flat 덧그림 = flat · 그 밖: solid 목록 칸 = solid, 나머지 그림 칸 = star(★ 뒤로 지나감).
"""
import argparse, collections, json, math, os, sys
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'jp-city'))
import wl_all  # noqa: E402,F401
import wl_core as C  # noqa: E402
import wl_ground as G  # noqa: E402
import importlib.util  # noqa: E402
_spec = importlib.util.spec_from_file_location('jp_bake_lib', os.path.join(HERE, '..', 'jp-city', 'bake_lib.py'))   # modern-chipset 에도 bake_lib 가 있어 이름으로 부르면 그쪽이 잡힌다
BL = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(BL)  # noqa: E402

ROOT = C.ROOT
ID, NAME, TEXTURE, FAMILY = 'wasteland_ruins', '폐허·황무지 (손 도트)', 'tex_wasteland_ruins', 'oprn-modern'
TPR = 48
P = dict(png=os.path.join(ROOT, 'public/assets/wasteland-ruins/wasteland-ruins-chipset.png'),
         tileset=os.path.join(ROOT, 'src/assets/wastelandRuinsTileset.json'), sheet=os.path.join(ROOT, 'src/assets/wastelandRuinsSheet.json'),
         pins=os.path.join(C.OUT, 'pins.json'), report=os.path.join(C.OUT, 'bake-report.json'))
GROUP_KO = dict(ground='바닥', ruins='폐허', shacks='판잣집', defense='방어·울타리', props='기물')
FLOOR_GROUP_IDS = {'dirt-a', 'dirt-b', 'dirt-c', 'dirt-d', 'slab-a', 'slab-b', 'slab-c', 'rubble-a', 'rubble-b', 'rubble-c',
                   'weeds-a', 'weeds-b', 'weeds-c', 'puddle', 'fence-h', 'fence-v',
                   'road-crack-a', 'road-crack-b', 'road-crack-c', 'pothole-a', 'pothole-b',
                   'asphalt-in-ne', 'asphalt-in-nw', 'asphalt-in-se', 'asphalt-in-sw'}
BUILDING_IDS = {'husk-a', 'husk-b', 'husk-tall', 'shack-a', 'shack-b', 'lean-to', 'shack-c', 'container-home', 'tent-tarp'}
ANIM_FPS = 6


def role_of(p):
    if p['kind'] in ('terrain', 'flat'): return 'terrain'
    if p['id'] in BUILDING_IDS: return 'building'
    if p['id'].startswith(('wall-', 'fence-', 'barricade-', 'gate-')): return 'wall'
    return 'prop'


def cell_pcs(p, a):
    out = {}; solid = set(map(tuple, p['solid']))
    for y in range(p['h']):
        for x in range(p['w']):
            al = a[y * 16:(y + 1) * 16, x * 16:(x + 1) * 16, 3]
            if al.max() == 0: continue
            k = p['kind']
            if k == 'terrain': pc = 'floor'
            elif k == 'flat': pc = 'flat'
            else: pc = 'solid' if (x, y) in solid else 'star'
            out[(x, y)] = pc
    return out


SKIP = {'dirt-a', 'dirt-b45', 'dirt-b64', 'dirt-c64', 'dirt-d64', 'asphalt-b', 'asphalt-c', 'track', 'slab-edge', 'slab-break'} | {'asphalt-in-' + '-'.join(c) for n in range(1, 5) for c in __import__('itertools').combinations(('ne', 'nw', 'se', 'sw'), n)}  # r54 실패: 안쪽 귀 15조각 전부 뺌(감독 지시 「귀 없는 편이 낫다」)          # 키트에서 뺀 조각(감독 결정) — 표본 바탕으로만 남고 굽지 않는다(번호도 새로 잡지 않는다)


def adopt(dev):
    adopted, rejected, devonly = [], [], []
    for p in C.PIECES.values():
        if p['id'] in SKIP: rejected.append(dict(id=p['id'], status='skipped', why='감독 결정으로 키트에서 뺌')); continue
        why = C.refusal_of(p, 'bundle')
        if why is None: adopted.append(p); continue
        st = C.status_of(p)
        # --dev-refer(검수 패널용 미리보기 전용): AI 보류(refer) 조각도 넣어 맵을 그려 본다. 출하 금지 — 실제 굽기는 출구 허용만 쓴다.
        if dev and (st == 'pass' or (st == 'refer' and '--dev-refer' in sys.argv)): adopted.append(p); devonly.append(p['id']); continue
        rejected.append(dict(id=p['id'], status=st, why=why[:200]))
    if any(p['id'] == 'asphalt-ph' for p in adopted):             # 위상 아스팔트가 채택되면 옛 마스크 아스팔트는 굽지 않는다(같은 wl-asphalt 그룹을 대신한다)
        adopted = [p for p in adopted if p['id'] != 'asphalt']; devonly = [i for i in devonly if i != 'asphalt']
        rejected.append(dict(id='asphalt', status='replaced', why='asphalt-ph(위상 칸)로 대체'))
    return adopted, rejected, devonly


def bake(dry=False, dev=False):
    adopted, rejected, devonly = adopt(dev)
    if devonly:
        bar = '!' * 78
        print(bar + '\n!! --dev: %d pieces adopted on an AI receipt verdict "pass" WITHOUT a bundle-exit allow (no signed/final pass).\n'
              '!! This sheet is for composer development only. Do NOT ship it as the canonical bundle.\n!! %s\n' % (len(devonly), ', '.join(devonly)) + bar)
    pins = BL.Pins(BL.load_pins(P['pins']))
    if not pins.map: pins.next_id = 1                                  # 0 = 빈 칸
    img, info, piece_cells, frames_of = {}, {}, {}, {}
    for p in adopted:
        a = C.render(p); im = Image.fromarray(a, 'RGBA'); pcs = cell_pcs(p, a); cells = {}
        auto = p['id'] in G.AUTO
        for (x, y), pc in sorted(pcs.items(), key=lambda kv: (kv[0][1], kv[0][0])):
            crop = BL.norm(im.crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)))
            where = f" (마스크 {y} · 위상 {x % G.APH},{x // G.APH})" if p['id'] == 'asphalt-ph' else (f" (이웃 {y * 4 + x})" if y < 4 else (f" (이웃 {((y - 6) % 4) * 4 + x} · 가장자리 세트 {'BC'[(y - 6) // 4]})" if p['id'] == 'asphalt' and y >= 6 else (f" (이웃 {(y - 4) * 4 + x} · 변형 2)" if p['id'] == 'slab-break' else f" (속 변형 {(y - 4) * 4 + x + 1})"))) if auto else (f" ({x + 1},{y + 1})" if p['w'] * p['h'] > 1 else '')
            tags = ['황무지', '폐허', GROUP_KO[p['group']]] + p['tags']
            meta = dict(label=f"{p['name']}{where}"[:80], desc=f"{p['desc'] or p['name']} — {BL.PCNOTE[pc]}.", role=role_of(p), tags=tags,
                        rep='auto' if auto else ('repeat' if p['kind'] in ('terrain', 'flat') else 'fixed'))
            tid = pins.assign(f"{p['id']}/{x}.{y}"); img[tid] = crop; info[tid] = dict(meta, pc=pc)
            cells[(x, y)] = (tid, pc)
        piece_cells[p['id']] = cells
        if p['frames'] > 1:                                            # 움직이는 칸: 프레임 f 는 같은 자리 키 + /f<f> (프레임 0 칸 바로 뒤에 덧붙음)
            for (x, y), (tid0, pc) in cells.items():
                ids = [tid0]
                for f in range(1, p['frames']):
                    fa = C.render(p, f)
                    crop = BL.norm(Image.fromarray(fa, 'RGBA').crop((x * 16, y * 16, x * 16 + 16, y * 16 + 16)))
                    t = pins.assign(f"{p['id']}/{x}.{y}/f{f}"); img[t] = crop; info[t] = dict(info[tid0], label=info[tid0]['label'] + f' 프레임 {f + 1}')
                    ids.append(t)
                frames_of[(p['id'], x, y)] = ids
    count = max(list(img) + [pins.next_id - 1, 0]) + 1
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
            tile_meta.append(dict(label='빈 칸', description='빈 칸(번호 고정용) — 쓰지 않는다.', source='bundled-default')); continue
        prio, passable, passage, home = BL.PC[inf['pc']]
        passability.append(dict(PASS) if passable else dict(SOLID)); priority.append(prio); terrain.append(0)
        m = dict(label=inf['label'], description=inf['desc'][:400], role=inf['role'], passage=passage, defaultLayer=home, tags=list(dict.fromkeys(inf['tags'])),
                 source='bundled-default', confidence='high', repeatability=inf['rep'])
        if inf['pc'] == 'flat': m['locked'] = True; m['layerBacking'] = 'none'; m['description'] += ' 투명 덧그림: 붓은 위층, 캐릭터 밑에 그린다.'
        elif home == 'upper': m['layerBacking'] = 'none'
        tile_meta.append(m)

    # 오토타일(4방향, 시트 칸 (m%4, m//4) = 마스크 m): G.AUTO 마다 `wl-<id>` 그룹. 5번째 줄이 있으면 꽉 찬 칸(15)에 섞는 속 변형.
    autotile_groups = []
    for aid, ad in G.AUTO.items():
        ac = piece_cells.get(aid)
        if not ac or not all((m % 4, m // 4) in ac for m in range(16)): continue
        vm = {str(m): ac[(m % 4, m // 4)][0] for m in range(16)}
        var = [] if aid == 'slab-break' else [ac[(x, y)][0] for y in range(4, 6 if aid == 'asphalt' else 8) for x in range(4) if (x, y) in ac]          # 5번째 줄부터 = 꽉 찬 칸 속 변형(slab-break 는 5~8번째 줄 = 같은 마스크의 변형 2)
        mem = sorted(set(vm.values()) | set(var))
        mv = {}
        if aid == 'asphalt':                              # 가장자리 세트 B(7~10번째 줄)·C(11~14번째 줄): 같은 마스크의 다른 깨짐 — 조합기가 칸 자리 해시로 A/B/C 를 고른다
            mv = {str(m): [ac[(m % 4, r0 + m // 4)][0] for r0 in (6, 10)] for m in range(15) if all((m % 4, r0 + m // 4) in ac for r0 in (6, 10))}
            mem = sorted(set(mem) | {t for ts in mv.values() for t in ts})
        g = dict(id='wl-' + aid, name=ad['name'], neighborhood=4, memberTileIds=mem, connectTileIds=mem, variantMap=vm, edgeConnects=True)
        if var: g['interiorVariants'] = [var]
        if mv: g['maskVariants'] = mv
        autotile_groups.append(g)

    ph = piece_cells.get('asphalt-ph')
    PP = G.APH * G.APH
    if ph and all((k, m) in ph for m in range(16) for k in range(PP)):  # 위상 오토타일: 칸 (위상 k, 마스크 m) — 조합기가 phaseTiles[m][(x%P)+P*(y%P)] 를 깐다(P = G.APH)
        autotile_groups = [g for g in autotile_groups if g['id'] != 'wl-asphalt']
        pt = {str(m): [ph[(k, m)][0] for k in range(PP)] for m in range(16)}
        mem = sorted({t for ts in pt.values() for t in ts})
        autotile_groups.append(dict(id='wl-asphalt', name='금 간 아스팔트', neighborhood=4, memberTileIds=mem, connectTileIds=mem,
                                    variantMap={str(m): pt[str(m)][0] for m in range(16)}, edgeConnects=True, phase=G.APH, phaseTiles=pt))

    # 타일 그룹·키트
    groups = collections.OrderedDict(); kits = []
    for p in adopted:
        cells = piece_cells[p['id']]; tids = sorted({t for t, _ in cells.values()} | {t for (pid, _, _), ids in frames_of.items() if pid == p['id'] for t in ids})
        if p['id'] in G.AUTO or p['id'] == 'asphalt-ph':
            groups['auto:' + p['id']] = dict(id='wl:auto:' + p['id'], name=p['name'], role='terrain', defaultLayer='upper' if p['kind'] == 'flat' else 'lower', tileIds=set(tids),
                                             description=f"{p['name']}. {p['desc']}", placementRules='오토타일 — 붓·fill_region 이 이웃에 맞는 칸을 고른다. ' + {'asphalt': '도로는 2칸 폭 이상을 권한다.', 'slab-edge': '판 영역 테두리에 깔고, 꽉 찬 안쪽은 slab-a/b/c 이음 판을 (x mod 8, y mod 8) 자리로 깐다.', 'slab-break': '위층 투명 덧그림. 판 영역 전체(가장자리 포함)에 slab-a/b/c 를 아래층으로 깔고, 가장자리 칸(마스크 15 가 아닌 칸)의 위층에만 마스크(N1 E2 S4 W8)에 맞는 칸을 얹는다 — 시트 칸 (m%4, m//4) 또는 같은 마스크 변형 2 칸 (m%4, 4+m//4)(라벨 「변형 2」)을 칸 자리 해시로 섞는다. 안쪽(15)엔 얹지 않는다.'}.get(p['id'], '판잣집 사이 1칸 폭 발길로 깐다.'))
        elif p['id'] in FLOOR_GROUP_IDS or p['kind'] == 'terrain':
            groups['floor:' + p['id']] = dict(id='wl:floor:' + p['id'], name=p['name'], role=role_of(p) if p['kind'] in ('terrain', 'flat') else 'wall',
                                              defaultLayer='lower' if p['kind'] == 'terrain' else 'upper', tileIds=set(tids), description=f"{p['name']}. {p['desc']}",
                                              placementRules=floor_rule(p))
        else:
            key = p['group'] + ':' + role_of(p)
            if key not in groups:
                groups[key] = dict(id='wl:' + key, name=f"{GROUP_KO[p['group']]} · {dict(building='건물', wall='벽·울타리', prop='기물').get(role_of(p), '기물')}",
                                   role=role_of(p), defaultLayer='upper', tileIds=set(), description=f"{GROUP_KO[p['group']]} 조각 칸 모음.",
                                   placementRules='다칸 조각은 낱칸으로 칠하지 않고 같은 이름의 키트(wl-…)로 찍는다.')
            groups[key]['tileIds'] |= set(tids)
        if p['id'] in G.AUTO or p['id'] == 'asphalt-ph' or (p['kind'] == 'terrain' and p['w'] * p['h'] == 1): continue
        rows = []
        for y in range(p['h']):
            lo = [-1] * p['w']; up = [-1] * p['w']
            for x in range(p['w']):
                if (x, y) not in cells: continue
                t, pc = cells[(x, y)]
                (lo if pc in BL.LOWER_PC else up)[x] = t
            rows.append(dict(tiles=lo, upperTiles=up))
        ai = dict(description=(p['desc'] or p['name'])[:400], placementRules=placement_rule(p)[:400],
                  tags=['황무지', '폐허', GROUP_KO[p['group']], p['kind']] + p['tags'], role=role_of(p), repeatability='fixed', layerHome='upper',
                  themes=['포스트 아포칼립스', '폐허 도시', '황무지 정착지'], origin='ai', confidence='high')
        if p['kind'] not in ('terrain', 'flat'): ai['snap'] = 'floor'; ai['anchor'] = dict(dx=p['w'] // 2, dy=p['h'] - 1)
        kit = dict(id='wl-' + p['id'], kind='section', name=p['name'], width=p['w'], height=p['h'], tileSize=16, rows=rows, learnedFrom='db-authored', ai=ai)
        if p['door'] is not None:
            dx, dy = p['door']
            kit['parts'] = [dict(id='door', kind='entrance', dx=dx, dy=dy, w=1, h=1)]
        kits.append(kit)
    anim = [dict(baseTile=ids[0], frames=len(ids), fps=ANIM_FPS) for ids in frames_of.values() if ids == list(range(ids[0], ids[0] + len(ids)))]
    bad_anim = [k for k, ids in frames_of.items() if ids != list(range(ids[0], ids[0] + len(ids)))]
    tile_groups = []
    for g in groups.values():
        g['tileIds'] = sorted(g['tileIds'])
        g['defaultLayer'], g['layerHome'] = BL.derive_group_layer(g['defaultLayer'], g['tileIds'], priority, tile_meta)
        g.update(source='bundled-default', confidence='high'); tile_groups.append(g)
    data = collections.OrderedDict(id=ID, name=NAME, textureKey=TEXTURE, family=FAMILY, tileSize=16, tilesPerRow=TPR, count=count, libraryEnd=count,
                                   passability=passability, priority=priority, terrain=terrain, tileMeta=tile_meta, tileGroups=tile_groups,
                                   autotileGroups=autotile_groups, animationStrips=anim, structureKits=kits)
    rep = collections.OrderedDict()
    chk = BL.check_definition(data, TPR)
    for code in ('group-prefix', 'kit-prefix'): chk['by_code'].pop(code, None); chk['examples'].pop(code, None)
    chk['violations'] = sum(chk['by_code'].values()); rep['definition'] = chk
    exp = {('wl-' + p['id']): BL.norm(Image.fromarray(C.render(p), 'RGBA')) for p in adopted}
    mism = [k['id'] for k in kits if not BL.same_image(BL.reassemble(k, sheet, TPR), exp[k['id']])]
    rep['reassembly'] = dict(kits=len(kits), mismatched=len(mism), ids=mism[:20])
    rep['palette'] = dict(cells_off_palette=sum(1 for t in range(count) if C.palette_issues(np.array(img[t]), str(t))))
    rep['tiles'] = dict(count=count, rows=math.ceil(count / TPR), kits=len(kits), groups=len(tile_groups), autotiles=len(autotile_groups), animationStrips=len(anim))
    rep['animation_noncontiguous'] = [list(k) for k in bad_anim]
    rep['adopted'] = dict(pieces=len(adopted), by_group=dict(collections.Counter(p['group'] for p in adopted)))
    rep['dev_only_adopted'] = devonly
    rep['mode'] = 'dev' if dev else 'bundle'
    rep['rejected'] = rejected
    out = dict(data=data, sheet=sheet, report=rep)
    if dry: return out
    os.makedirs(os.path.dirname(P['png']), exist_ok=True)
    sheet.save(P['png'], optimize=True)
    wr = lambda path, obj, **kw: open(path, 'w', encoding='utf-8').write(json.dumps(obj, ensure_ascii=False, **kw) + '\n')
    wr(P['tileset'], data, separators=(',', ':'))
    wr(P['sheet'], dict(count=count, tilesPerRow=TPR), separators=(',', ': '))
    wr(P['pins'], dict(version=1, tilesPerRow=TPR, count=count, cells=dict(sorted(pins.map.items(), key=lambda kv: kv[1]))), indent=0)
    d2 = json.load(open(P['tileset'], encoding='utf-8')); s2 = Image.open(P['png']).convert('RGBA')
    rep['reassembly_from_files'] = sum(1 for k in d2['structureKits'] if not BL.same_image(BL.reassemble(k, s2, TPR), exp[k['id']]))
    wr(P['report'], rep, indent=1)
    return out


def floor_rule(p):
    if p['kind'] == 'terrain' and p['w'] * p['h'] > 1:
        return ('이음 판(%d×%d칸, 주기 %d화소): 맵 칸 (x,y) 에는 키트 wl-%s 의 rows[y mod %d].tiles[x mod %d] 칸을 깐다 — 무작위로 고르면 이음이 끊긴다. '
                '변형 판(B·C·D)은 같은 자리 칸만 바꿔 끼운다(10~20%%).') % (p['w'], p['h'], p['w'] * 16, p['id'], p['h'], p['w'])
    if p['kind'] == 'terrain': return '낱칸으로 이어 칠한다. 변형(A 밖)은 드물게(10~20%) 섞는다.'
    if p['kind'] == 'flat': return '바닥 위 투명 덧그림(위층, 캐릭터 밑) — 걷는다. 길·문 앞에 몰아 두지 말고 드문드문.'
    if p['id'] == 'fence-h': return '가로 울타리 한 칸 — 가로로 이어 찍는다. 끝은 벽·폐허·바리케이드에 붙인다.'
    if p['id'] == 'fence-v': return '세로 울타리 한 칸(위에서 본 띠) — 세로로 이어 찍는다. 가로 줄 끝 칸 아래에서 시작한다.'
    return '낱칸으로 쓴다.'


def placement_rule(p):
    r = role_of(p)
    if r == 'building':
        return '맨 아래 줄의 문 칸(parts door) 앞 한 칸은 길·흙으로 비운다. 이웃 건물과 1칸 이상 띄운다. 폐허는 콘크리트 판 광장·도로 옆, 판잣집은 바리케이드·울타리 안쪽에 무리 짓는다.'
    if r == 'wall':
        return '벽·바리케이드·울타리는 정착지 둘레나 길 막음에 줄로 쓴다. 문(gate-scrap) 가운데 칸은 지나가게 비운다.'
    if p['id'].startswith(('car-', 'van-')): return '도로 위나 길가에 비스듬히 버려진 듯 둔다. 정착지 안보다 도로·폐허 쪽에.'
    return '바닥 위에 키트로 찍는다(낱칸 금지). 다른 기물과 1칸 띄우고 길·문 앞을 막지 않는다.'


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('--dry', action='store_true'); ap.add_argument('--dev', action='store_true'); ap.add_argument('--dev-refer', action='store_true'); a = ap.parse_args()
    o = bake(dry=a.dry, dev=a.dev); r = o['report']
    print(json.dumps({k: r[k] for k in ('mode', 'tiles', 'adopted', 'reassembly', 'palette')}, ensure_ascii=False))
    print('정의 검사 위반', r['definition']['violations'], r['definition']['by_code'], r['definition']['examples'] if r['definition']['violations'] else '')
    print('거절', len(r['rejected']), [(x['id'], x['status']) for x in r['rejected']][:60])
