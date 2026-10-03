"""조선 실내 방 6장 굽기(후보 B).  python3 inb_demo.py [방id ...] [--candidate] [--no-gate]

방마다 tiledata/joseon-interior-b/<id>/ 에 map.json·pieces.json·extra.json·시트 PNG·지도 PNG(직접·시트 재조립·사람 포함·통행 겹침)를 쓴다.
시트는 in_b_ 조각 전부(지형 묶음 9 + 물체)라 방마다 같고, 겹침 칸(벽면+가구)만 방마다 시트 끝에 덧붙는다.
굽기 전 게이트: in_b_ 조각에 FAIL 이 있으면 굽지 않는다(--candidate 는 적대 리뷰 A 만 건너뛴다 — 지금은 항상 건너뜀). 맵 점검(inb_checks)이 실패해도 굽지 않는다.
"""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import numpy as np
from PIL import Image
from tk import Cv, T
import catalog
import inb_map as M
import inb_room as RM
import inb_checks as CK
import inb_rooms as RS
import people as PP

ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
OUT = os.path.join(ROOT, 'tiledata', 'joseon-interior-b')
_DIRN = {PP.UP: 'up', PP.RIGHT: 'right', PP.FRONT: 'down', PP.LEFT: 'left'}


def gate_ok():
    import gate
    rows, fails, warns, _ = gate.run(skip_a=True)
    bad = [r for r in rows if r[0].startswith('in_b_') and r[2].startswith('FAIL')]
    return bad


def sheet_objects():
    objs = {k: v for k, v in catalog.objects().items() if k.startswith('in_b_')}
    terr = {k: v for k, v in catalog.terrain().items() if k.startswith('in_b_')}
    return terr, objs


def people_png(room, people, direct):
    img = direct.img().convert('RGBA')
    return PP.overlay(img, [(p['x'], p['y'], p['char'], {v: k for k, v in _DIRN.items()}[p['dir']], p['frame']) for p in people])


def bake(spec, no_gate=False):
    terr, objs = sheet_objects()
    sheet = M.Sheet(terr, objs)
    rid = spec['id']
    room = M.Room(sheet, rid, spec['title'], spec['plan'], spec['props'], spec['door'], replace=spec.get('replace'), people=[], seed=spec.get('seed', 1))
    # 사람(Actor1) — 걸을 수 있는 칸에만
    ppl = []
    rep0 = CK.analyze(room, sheet)
    for (x, y, ch, d, fr) in spec.get('people', []):
        if (x, y) not in rep0['walkable']:
            print(f'  [경고] 사람 ({x},{y}) 는 걸을 수 있는 칸이 아니라 뺀다')
            continue
        ppl.append({'x': x, 'y': y, 'char': ch, 'dir': _DIRN[d], 'frame': fr})
    room.people = ppl
    rep = CK.analyze(room, sheet)
    # 사람 칸이 가구에 막힌 칸이면 안 된다(위에서 걸렀음). 사람이 출입구 앞을 막지 않는지
    for p in ppl:
        if (p['x'], p['y']) == (room.door[0], room.door[1] - 1):
            rep['fails'].append('사람이 들어오는 칸에 서 있다')
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
    people_png(room, ppl, direct).convert('RGB').save(os.path.join(d, f'{stem}-map-people.png'))
    # 통행 겹침 그림(막힘=붉게)
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
            for r in bad[:20]:
                print('  ', r[0], r[2])
            sys.exit(1)
    allok = True
    for spec in RS.ROOMS:
        if spec['id'] not in want:
            continue
        room, rep, diff, sheet = bake(spec)
        print(f"{spec['id']:22s} {room.W}x{room.H}  pixelDiffMapVsSheet={diff}  겹침칸 {len(sheet.extra)}  걷는칸 {rep['info']['walkable']}  도달 {rep['info']['reachable']}  가구 {rep['info']['furniture']}  맨바닥 최대 {rep['info']['bareLargest']}")
        for f in rep['fails']:
            print('   FAIL', f)
        for w in rep['warns']:
            print('   WARN', w)
        if rep['fails'] or diff:
            allok = False
    print('끝 %.1fs' % (time.time() - t0), 'OK' if allok else 'FAIL')
    sys.exit(0 if allok else 1)
