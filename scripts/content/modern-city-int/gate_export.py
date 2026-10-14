"""object-gate 에 낼 투명 PNG 와 items.jsonl: python3 gate_export.py [pending [--fail]]
조각마다 그림 하나(바닥·벽면 = 주기 그림 terrain, 가구 = 등록 kind, 탁자 = 3×2 조립, 탁상 = 16×16).
문·옆문은 혼자 윗면을 보일 수 없어서 조립 방 그림(assembled.py, kind structure)으로만 덮는다."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from PIL import Image
import pieces as P

ROOT = P.ROOT
OUT = os.path.join(P.OUT, '_gate')
ASSEMBLED_ONLY = {'door', 'sidedoor'}


def export():
    os.makedirs(OUT, exist_ok=True); rows = []
    for id_, ko, a, kind in P.piece_images():
        o = P.R.objs.get(id_)
        if o and o['kind'] in ASSEMBLED_ONLY: continue
        path = os.path.join(OUT, id_ + '.png'); Image.fromarray(a, 'RGBA').save(path)
        rows.append(dict(png=path, kind=kind, name=ko, label='modern_city/interior/' + id_))
    with open(os.path.join(OUT, 'items.jsonl'), 'w') as f:
        for x in rows: f.write(json.dumps(x, ensure_ascii=False) + '\n')
    print('export', len(rows), OUT)
    return rows


def status(rows=None, out='/tmp/mci-pending.jsonl', only_fail=False):
    sys.path.insert(0, os.path.join(ROOT, 'src', 'harnesses', '_core'))
    from object_gate import pixel_sha256, read_receipt
    rows = rows if rows is not None else [json.loads(l) for l in open(os.path.join(OUT, 'items.jsonl'))]
    pend = []; st = dict(pass_=0, fail=0, none=0); fails = []
    for x in rows:
        r = read_receipt(pixel_sha256(Image.open(x['png'])))
        v = r and r.get('verdict')
        if v == 'pass': st['pass_'] += 1; continue
        st['fail' if v else 'none'] += 1
        if v: fails.append(x['label'].split('/')[-1])
        if v and not only_fail: continue
        pend.append(x)
    with open(out, 'w') as f:
        for x in pend: f.write(json.dumps(x, ensure_ascii=False) + '\n')
    print('pass %(pass_)d fail %(fail)d none %(none)d' % st, 'pending ->', out, len(pend)); print('FAIL:', ' '.join(fails))
    return st, fails


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'pending': status(only_fail='--fail' in sys.argv)
    else: status(export())
