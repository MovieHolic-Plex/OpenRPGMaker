"""판정 이유 보기: python3 sf_why.py id… — 영수증의 판정자 증거 한 줄씩."""
import sys, os
import sf_all, sf_core as C
from PIL import Image
from object_gate import pixel_sha256, read_receipt
for i in sys.argv[1:]:
    p = C.PIECES[i]
    for f in range(p['frames']):
        r = read_receipt(pixel_sha256(Image.fromarray(C.render(p, f), 'RGBA')))
        if not r: print(i, 'no receipt'); continue
        print(i, r['verdict'], r.get('reasons'))
        for run in r['runs'][:2]:
            a = run.get('answer') or run; print('   top=%s front=%s | %s' % (a.get('top_rows'), a.get('pure_front_elevation'), (a.get('evidence') or '')[:380]))
