#!/usr/bin/env python3
"""sf_station 조각 전체 진입점.
  python3 sf_all.py export [id…]      그림을 tiledata/sf-station/<group>/_gate/ 로 내보내고 /tmp/sf-batch.jsonl 을 쓴다(미판정·불합격 것만 --todo)
  python3 sf_all.py gate [--todo] [id…]   export 후 object-gate review --batch 로 판정(모델 호출)
  python3 sf_all.py status [group]    영수증만 읽어 통과/불합격/미판정 목록(모델 호출 없음)
  python3 sf_all.py sheet [group]     미리보기 시트 /tmp/sf-<group>.png
"""
import json, os, subprocess, sys, importlib
import sf_core as C
MODS = ['sf_base', 'sf_terrain', 'sf_outdoor', 'sf_street', 'sf_interior', 'sf_anim']
ONLY_MOD = os.environ.get('SF_MODS')          # 병렬 작업자는 자기 모듈만: SF_MODS=sf_outdoor python3 sf_all.py gate outdoor --todo
for m in MODS:
    if ONLY_MOD and m not in ONLY_MOD.split(',') and m != 'sf_base': continue
    if os.path.exists(os.path.join(C.HERE, m + '.py')):
        try: importlib.import_module(m)
        except Exception as e: print('!! %s 불러오기 실패(건너뜀): %r' % (m, e))

def main():
    a = sys.argv[1:] or ['status']; cmd = a[0]; args = [x for x in a[1:] if not x.startswith('--')]; todo = '--todo' in a
    groups = {'scratch', 'outdoor', 'street', 'interior', 'terrain', 'anim'}
    group = args[0] if args and args[0] in groups else None
    only = set(x for x in args if x not in groups) or None
    if cmd == 'status':
        n = ok = 0
        for p in C.pieces_of(group, only):
            s = C.status_of(p); n += 1; ok += s == 'pass'
            if s != 'pass' or '-v' in a: print(s.upper().ljust(5), p['group'].ljust(8), p['id'])
        print('%d/%d pass' % (ok, n)); return
    if cmd in ('export', 'gate'):
        ps = [p for p in C.pieces_of(group, only) if not todo or C.status_of(p) != 'pass']
        rows = []
        for p in ps:
            r, _, bad = C.export(None, {p['id']}); rows += r
        bp = '/tmp/sf-batch-%s.jsonl' % (group or 'all'); open(bp, 'w').write('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n')
        print('%d images -> %s' % (len(rows), bp))
        if cmd == 'gate' and rows:
            cwd = C.ROOT; r = subprocess.run('npm run harness -- object-gate review --batch %s 2>&1 | grep -E "^(PASS|FAIL)|통과"' % bp, shell=True, cwd=cwd, capture_output=True, text=True)
            print(r.stdout[-6000:])
        return
    if cmd == 'sheet':
        from PIL import Image
        ps = C.pieces_of(group, only); ims = [Image.fromarray(C.render(p), 'RGBA') for p in ps]
        C.sheet(ims, '/tmp/sf-%s.png' % (group or 'all'), W=int(os.environ.get('W', 220)), z=int(os.environ.get('Z', 4))); print('/tmp/sf-%s.png' % (group or 'all'))

if __name__ == '__main__': main()
