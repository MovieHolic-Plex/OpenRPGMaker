"""조선 궁 방 디버그: python3 pal_dbg.py <방id>  — 칸마다 # 천장, f 벽면, . 맨바닥(걷는 칸 중 조각 없음), o 조각이 덮은 걷는 칸, X 막힌 칸."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pal_demo as D, pal_rooms as RS, pal_map as M, pal_checks as CK
terr, objs = D.sheet_objects()
for spec in RS.ROOMS:
    if len(sys.argv) > 1 and spec['id'] != sys.argv[1]:
        continue
    sh = M.Sheet(terr, objs)
    room = M.PalRoom(sh, spec['id'], spec['title'], spec['plan'], spec['props'], spec['door'], replace=spec.get('replace'), doors_extra=spec.get('doors_extra'))
    rep = CK.analyze(room, sh, spec)
    p = room.plan
    print(spec['id'], room.W, room.H)
    print('   ' + ''.join(str(x % 10) for x in range(room.W)))
    for y in range(room.H):
        r = ''
        for x in range(room.W):
            c = (x, y)
            if p.solid(x, y): r += '#'
            elif p.is_face(x, y): r += 'f'
            elif c not in rep['walkable']: r += 'X'
            elif c in rep['cover']: r += 'o'
            else: r += '.'
        print('%2d %s' % (y, r))
