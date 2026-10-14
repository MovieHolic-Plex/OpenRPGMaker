#!/usr/bin/env python3
"""pirate_isles 조각 전체 진입점.
  python3 pi_all.py export [group] [id…]     그림을 tiledata/pirate-isles/<group>/_gate/ 로 내보낸다
  python3 pi_all.py gate [group] [--todo] [id…]   export 후 object-gate review --batch (모델 호출). --todo = 미판정·불합격만
  python3 pi_all.py status [group] [-v]      영수증만 읽어 통과/불합격/미판정 목록(모델 호출 없음)
  python3 pi_all.py sheet [group] [id…]      미리보기 시트 /tmp/pi-<group>.png (Z=배율, W=폭, BG=terrain 이면 모래 바탕)
  python3 pi_all.py why id                    불합격 영수증 이유
"""
import json, os, subprocess, sys, importlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pi_core as C
MODS = ['pi_terrain', 'pi_nature', 'pi_buildings', 'pi_props', 'pi_boats', 'pi_interior', 'pi_anim']
for m in MODS:
    if os.path.exists(os.path.join(C.HERE, m + '.py')): importlib.import_module(m)
GROUPS = {'terrain', 'nature', 'buildings', 'props', 'boats', 'interior', 'anim'}


def main():
    a = sys.argv[1:] or ['status']; cmd = a[0]; args = [x for x in a[1:] if not x.startswith('-')]; todo = '--todo' in a
    group = args[0] if args and args[0] in GROUPS else None
    only = set(x for x in args if x not in GROUPS) or None
    if cmd == 'status':
        n = ok = 0; bad = []
        for p in C.pieces_of(group, only):
            s = C.status_of(p); n += 1; ok += s == 'pass'
            if s != 'pass' or '-v' in a: print(s.upper().ljust(5), p['group'].ljust(9), p['id']); bad.append(p['id'])
        print('%d/%d pass' % (ok, n)); return
    if cmd == 'why':
        for p in C.pieces_of(None, only):
            for f in range(p['frames']):
                r = C.receipt_of(p, f)
                print(p['id'], f, r and r.get('verdict'), r and r.get('reasons'), [(x.get('top_rows'), x.get('pure_front_elevation'), (x.get('evidence') or '')[:160]) for x in (r or {}).get('answers', [])][:4])
        return
    if cmd in ('export', 'gate'):
        ps = [p for p in C.pieces_of(group, only) if not todo or C.status_of(p) != 'pass']
        rows = []
        for p in ps:
            r, _ = C.export(None, {p['id']}); rows += r
        bp = '/tmp/pi-batch-%s-%d.jsonl' % (group or 'all', os.getpid())
        open(bp, 'w').write('\n'.join(json.dumps(r, ensure_ascii=False) for r in rows) + '\n')
        print('%d images -> %s' % (len(rows), bp))
        if cmd == 'gate' and rows:
            r = subprocess.run('npm run harness -- object-gate review --batch %s 2>&1 | grep -E "^(PASS|FAIL)|통과|error|Error"' % bp, shell=True, cwd=C.ROOT, capture_output=True, text=True)
            print(r.stdout[-8000:])
        return
    if cmd == 'sheet':
        from PIL import Image
        from pi_sheet import sheet
        ps = C.pieces_of(group, only)
        out = '/tmp/pi-%s.png' % (group or 'all')
        sheet([(p['id'], Image.fromarray(C.render(p), 'RGBA')) for p in ps], out, z=int(os.environ.get('Z', 3)), W=int(os.environ.get('W', 1500)), bg=os.environ.get('BG', 'grass'))
        print(out)


if __name__ == '__main__': main()
