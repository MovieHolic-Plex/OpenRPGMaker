"""조선 궁 내부 방 3장 굽기.  python3 pal_demo.py [방id ...] [--no-gate] [--candidate]

방마다 tiledata/joseon-palace-int/<id>/ 에 map.json·pieces.json·extra.json·시트 PNG·지도 PNG(직접·시트 재조립·사람 포함·통행 겹침)를 쓴다(EXTRA_FORMAT.md).
시트는 in_b_(후보 B 키트·기물) + pal_(궁 전용) 전부라 방마다 같고, 겹침 칸(벽면+가구)만 방마다 시트 끝에 덧붙는다.
굽기 전 게이트: pal_ 조각에 FAIL 이 있으면 굽지 않는다. 방 점검(pal_checks)이나 지도 게이트(mapgate palace_int)가 실패해도 굽지 않는다.
"""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import numpy as np
from PIL import Image
from tk import Cv, T
import pal_map as M
import pal_checks as CK
import pal_rooms as RS
import people as PP

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata', 'joseon-palace-int')
_DIRN = {PP.UP: 'up', PP.RIGHT: 'right', PP.FRONT: 'down', PP.LEFT: 'left'}


def gate_ok():
    import gate
    rows, fails, warns, _ = gate.run(skip_a=True)
    return [r for r in rows if r[0].startswith('pal_') and r[2].startswith('FAIL')]


def sheet_objects():
    import inb_kit as IK, inb_props as IP, inb_props2 as IP2, inb_props3 as IP3, pal_kit as PK, pal_props as PP1, pal_props2 as PP2
    objs, terr = {}, {}
    for m in (IK, IP, IP2, IP3, PK, PP1, PP2):
        objs.update(m.objects())
    for m in (IK, PK):
        terr.update(m.terrain())
    objs = {k: v for k, v in objs.items() if k.startswith(('in_b_', 'pal_'))}
    terr = {k: v for k, v in terr.items() if k.startswith(('in_b_', 'pal_'))}
    return terr, objs


def people_png(people, direct):
    img = direct.img().convert('RGBA')
    return PP.overlay(img, [(p['x'], p['y'], p['char'], {v: k for k, v in _DIRN.items()}[p['dir']], p['frame']) for p in people])


def bake(spec, sheet=None):
    if sheet is None:
        terr, objs = sheet_objects()
        sheet = M.Sheet(terr, objs)
    rid = spec['id']
    room = M.PalRoom(sheet, rid, spec['title'], spec['plan'], spec['props'], spec['door'], replace=spec.get('replace'), people=[], seed=spec.get('seed', 1), doors_extra=spec.get('doors_extra'))
    ppl = []
    rep0 = CK.analyze(room, sheet, spec)
    for (x, y, ch, d, fr) in spec.get('people', []):
        assert 0 <= ch <= 7 and 0 <= fr <= 2, f'Actor1 캐릭터는 0..7, 걸음 0..2: {ch},{fr}'
        if (x, y) not in rep0['walkable']:
            print(f'  [경고] 사람 ({x},{y}) 는 걸을 수 있는 칸이 아니라 뺀다')
            continue
        ppl.append({'x': x, 'y': y, 'char': ch, 'dir': _DIRN[d], 'frame': fr})
    room.people = ppl
    rep = CK.analyze(room, sheet, spec)
    for p in ppl:
        if (p['x'], p['y']) == (room.door[0], room.door[1] - 1):
            rep['fails'].append('사람이 들어오는 칸에 서 있다')
    os.environ['JS_PROFILE'] = 'palace_int'
    import importlib, mapgate
    importlib.reload(mapgate)
    gfails, grep = mapgate.check(room.placed, room.direct(), room.obj)
    rep['info']['mapgate'] = grep
    for f in gfails:
        rep['fails'].append('mapgate ' + f)
    ids = room.object_ids()
    direct = room.direct()
    re_ = room.reassemble()
    diff = int((direct.a != re_.a).any(axis=2).sum())
    d = os.path.join(OUT, rid)
    os.makedirs(d, exist_ok=True)
    stem = rid.replace('_', '-')
    sh, rows = sheet.sheet_img()
    sh.img().save(os.path.join(d, f'{stem}-chipset.png'))
    direct.img().save(os.path.join(d, f'{stem}-map.png'))
    re_.img().save(os.path.join(d, f'{stem}-map-from-sheet.png'))
    people_png(ppl, direct).convert('RGB').save(os.path.join(d, f'{stem}-map-people.png'))
    ov = np.array(direct.img().convert('RGB'))
    for y in range(room.H):
        for x in range(room.W):
            if (x, y) not in rep['walkable']:
                sub = ov[y * T:(y + 1) * T, x * T:(x + 1) * T].astype(np.float32)
                ov[y * T:(y + 1) * T, x * T:(x + 1) * T] = (sub * 0.6 + np.array([230, 40, 40]) * 0.4).astype(np.uint8)
    Image.fromarray(ov).save(os.path.join(d, f'{stem}-walk-overlay.png'))
    json.dump({'tile': T, 'cols': M.COLS, 'rows': rows, 'tileCount': len(sheet.grid), 'pieces': sheet.pieces,
               'overlapTiles': {'start': sheet.base, 'count': len(sheet.extra)}}, open(os.path.join(d, 'pieces.json'), 'w'), ensure_ascii=False, indent=1)
    json.dump({'width': room.W, 'height': room.H, 'ground': room.ground, 'object': ids}, open(os.path.join(d, 'map.json'), 'w'))
    json.dump(room.extra_json(None), open(os.path.join(d, 'extra.json'), 'w'), ensure_ascii=False)
    return room, rep, diff, sheet


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    want = args or [r['id'] for r in RS.ROOMS]
    t0 = time.time()
    if '--no-gate' not in sys.argv:
        bad = gate_ok()
        if bad:
            print('조각 게이트 FAIL %d — 굽지 않는다' % len(bad))
            for r in bad[:40]:
                print('  ', r[0], r[2])
            sys.exit(1)
    allok = True
    for spec in RS.ROOMS:
        if spec['id'] not in want:
            continue
        # 방마다 새 시트: 겹침 칸은 방마다 덧붙으므로 방끼리 섞이지 않게 한다(in_b_ 6방과 같은 관례)
        room, rep, diff, sheet = bake(spec)
        i = rep['info']
        print(f"{spec['id']:22s} {room.W}x{room.H}  pixelDiffMapVsSheet={diff}  겹침칸 {len(sheet.extra)}  걷는칸 {i['walkable']}  도달 {i['reachable']}  가구 {i['furniture']}  물체피복 {i['mapgate']['obj_cover']} 겹침쌍 {i['mapgate']['depth_pairs']} 맨바닥 판 {i['bareLargest']} (엄격 {i['bareStrict']}) 좌우 {i.get('mirrorRatio')}")
        for f in rep['fails']:
            print('   FAIL', f)
        for w in rep['warns']:
            print('   WARN', w)
        if rep['fails'] or diff:
            allok = False
    print('끝 %.1fs' % (time.time() - t0), 'OK' if allok else 'FAIL')
    sys.exit(0 if allok else 1)
