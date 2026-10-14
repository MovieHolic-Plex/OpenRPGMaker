"""object-gate 에 낼 투명 PNG 와 items.jsonl: python3 gate_export.py [pending|--fail]
→ tiledata/hand-interior/plus/_gate/<id>.png + items.jsonl(줄마다 {png,kind,name,label}). 그림은 시트에 들어가는 것과 같은 화소(팔레트 v6)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import loader, iplib
OUT = os.path.join(iplib.TD, '_gate')
sys.path.insert(0, os.path.join(iplib.ROOT, 'src', 'harnesses', '_core'))


def slug(pid): return pid.replace(' ', '_')


def export():
    reg = loader.load(); os.makedirs(OUT, exist_ok=True); rows = []
    for pid in reg.order:
        p = reg.pieces[pid]; path = os.path.join(OUT, slug(pid) + '.png'); iplib.render(p).save(path)
        rows.append(dict(png=path, kind=p['gate'], name=f"{p['ko']} ({pid})", label=f'atlas_biome_interior/plus/{pid}'))
    with open(os.path.join(OUT, 'items.jsonl'), 'w') as f:
        for x in rows: f.write(json.dumps(x, ensure_ascii=False) + '\n')
    return rows


def pending(only_fail=False):
    from object_gate import pixel_sha256, read_receipt
    from PIL import Image
    rows = export(); out = []; st = {'pass': 0, 'fail': 0, 'none': 0}
    for x in rows:
        r = read_receipt(pixel_sha256(Image.open(x['png']))); v = r and r.get('verdict')
        if v == 'pass': st['pass'] += 1; continue
        st['fail' if v else 'none'] += 1
        if v and not only_fail: continue
        out.append(x)
    p = os.path.join(OUT, 'pending.jsonl')
    with open(p, 'w') as f:
        for x in out: f.write(json.dumps(x, ensure_ascii=False) + '\n')
    print('pending', len(out), st, p)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'pending': pending('--fail' in sys.argv)
    else: print(len(export()))
