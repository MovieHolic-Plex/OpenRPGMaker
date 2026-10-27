"""r59 관문 그림 내보내기: slab-a..e 의 표본(24×16 섞은 판)을 <폴더>/gate-slab-*.png 로, items.jsonl 은 같은 폴더에."""
import sys, os, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', '..', 'scripts', 'content', 'wasteland-ruins'))
from PIL import Image
import wl_all
import wl_core as C
import wl_ground as G
out = os.path.abspath(sys.argv[1]); os.makedirs(out, exist_ok=True)
ids = sys.argv[2:] or ['slab-' + k for k in 'abcde']
rows = []
for pid in ids:
    p = C.PIECES[pid]
    a = C.gate_array(p)
    iss = C.palette_issues(a, pid)
    if iss: print('PALETTE', iss)
    path = os.path.join(out, 'gate-' + pid + '.png'); Image.fromarray(a, 'RGBA').save(path)
    rows.append(dict(png=path, kind=p['kind'], styleKind=C.style_kind(p), name=p['en'], label=C.LABEL_PREFIX + pid))
    print(pid, C.receipt_of(p)[0])
with open(os.path.join(out, 'items.jsonl'), 'w') as f:
    for r in rows: f.write(json.dumps(r, ensure_ascii=False) + '\n')
print('missed', G.SLAB_MISSED)
