#!/usr/bin/env python3
"""영수증 요약: 조각(프레임)마다 판정·3/4·화풍·이유·화소 해시 (모델 호출 없음)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import wl_all  # noqa
import wl_core as C
for p in C.PIECES.values():
    for f in range(p['frames']):
        sha, r = C.receipt_of(p, f)
        if not r: print('NONE ', C.gate_name(p, f).ljust(16), sha[:16]); continue
        v = (r.get('view34') or {}).get('verdict'); s = (r.get('style') or {}).get('verdict')
        if '-a' in sys.argv or r['verdict'] != 'pass':
            print(r['verdict'].ljust(5), C.gate_name(p, f).ljust(16), p['kind'].ljust(12), 'v34=%-5s style=%-5s' % (v, s), sha[:16], '|', '; '.join(r.get('reasons') or [])[:260])
