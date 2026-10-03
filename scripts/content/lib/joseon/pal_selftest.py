"""pal_checks 가 실제로 걸리는지 확인하는 음성 시험: 일부러 망가뜨린 방을 점검기에 넣어 기대한 FAIL 이 나오는지 본다. python3 pal_selftest.py"""
import sys, os, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pal_demo as D, pal_rooms as RS, pal_map as M, pal_checks as CK

terr, objs = D.sheet_objects()


def run(spec):
    sh = M.Sheet(terr, objs)
    room = M.PalRoom(sh, spec['id'], spec['title'], spec['plan'], spec['props'], spec['door'], replace=spec.get('replace'), doors_extra=spec.get('doors_extra'))
    return CK.analyze(room, sh, spec)['fails']


base = {s['id']: s for s in RS.ROOMS}
th = base['joseon_in_throne']
cases = []
a = copy.deepcopy(th); a['props'].append(('pal_hyangro_a', 10, 12)); cases.append(('어도 한가운데 향로', a, ('P2', 'C8', 'C3', 'C4')))
b = copy.deepcopy(th); b['props'] += [('pal_hwaro', 7, 11), ('pal_hwaro', 7, 14), ('pal_hwaro', 7, 17)]; cases.append(('같은 화로 셋 한 줄(x=7)', b, ('P3',)))
c = copy.deepcopy(th)
for (n, x, y) in list(c['props']):
    if n in ('pal_hwaro', 'pal_bangseok_b', 'pal_bangseok_a', 'pal_deungnong_a', 'pal_deungnong_b', 'pal_deumeu_a', 'pal_deumeu_b'):
        w = 1 if n.startswith(('pal_hwaro', 'pal_bang', 'pal_deungnong')) else 2
        c['props'].append((n, 21 - 1 - (x + w - 1), y))
cases.append(('좌우 복제', c, ('P4',)))
d = copy.deepcopy(th); d['plan'] = list(d['plan']); r = list(d['plan'][2]); r[5] = '#'; d['plan'][2] = ''.join(r); cases.append(('벽면 윗줄 한 칸을 막힌 칸으로(구조)', d, ('C1', 'C2', 'P5')))
e = copy.deepcopy(th); e['props'] = [p for p in e['props'] if not p[0].startswith(('pal_hyangro', 'pal_mat_sinha', 'pal_deungnong', 'pal_hwaro', 'pal_bangseok', 'pal_deumeu'))]; cases.append(('소품을 다 빼 텅 빈 홀', e, ('C7',)))
f = copy.deepcopy(th); f['props'].append(('pal_beam_dan_m', 5, 9)); cases.append(('바닥에 누운 보', f, ('P6',)))
ok = True
for name, spec, want in cases:
    fails = run(spec)
    hit = [w for w in want if any(f.startswith(w) or (' ' + w + ' ') in f for f in fails)]
    print(('OK  ' if hit else 'MISS'), name, '->', [f[:60] for f in fails[:4]])
    ok &= bool(hit)
print('음성 시험', '전부 걸렸다' if ok else '못 걸린 것 있음')
sys.exit(0 if ok else 1)
