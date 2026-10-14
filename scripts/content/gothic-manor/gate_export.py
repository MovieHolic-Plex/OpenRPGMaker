"""object-gate 에 낼 투명 PNG 와 items.jsonl 을 쓴다: python3 gate_export.py [모듈,모듈] → tiledata/gothic-manor/_gate/<모듈>/<id>.png + items.jsonl
조각 = 0프레임 그림(kind 는 조각 등록의 kind). 줄 조각 = 동서 3칸 줄 + 끝 기둥 견본. 오토타일 = 3×3 패치(terrain)."""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'pieces'))
import loader, gmlib
from PIL import Image
OUT = os.path.join(gmlib.TD, '_gate')

def run_sample(r):
    t = gmlib.run_cells(r); im = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    for x, m in enumerate((2, 10, 10, 8)): im.alpha_composite(t[m], (x * 16, 16))
    im.alpha_composite(t[4], (0, 0)); im2 = Image.new('RGBA', (64, 32), (0, 0, 0, 0)); im2.alpha_composite(im)
    return im2

def export(mods):
    total = 0; seen = set()
    for mod in mods:
        reg = loader.load(mod); d = os.path.join(OUT, mod); os.makedirs(d, exist_ok=True); rows = []
        for p in reg.pieces.values():
            if p['id'] in seen: continue
            seen.add(p['id'])
            if not p.get('kind'): print('kind 없음', p['id']); continue
            path = os.path.join(d, p['id'] + '.png'); gmlib.render_piece(p, 0).img().save(path)
            rows.append(dict(png=path, kind=p['kind'], name=p['name'], label='gothic_manor/' + p['id']))
        for a in reg.autotiles.values():
            if a['id'] in seen: continue
            seen.add(a['id'])
            m, t, pa, ic = gmlib.autotile_cells(a); path = os.path.join(d, a['id'] + '.png'); pa.img().save(path)
            rows.append(dict(png=path, kind='terrain', name=a['name'], label='gothic_manor/' + a['id']))
        for r in reg.runs.values():
            if r['id'] in seen: continue
            seen.add(r['id'])
            path = os.path.join(d, r['id'] + '.png'); run_sample(r).save(path)
            rows.append(dict(png=path, kind=r['kind'], name=r['name'] + ' (3칸 줄 + 모퉁이 견본)', label='gothic_manor/' + r['id']))
        with open(os.path.join(d, 'items.jsonl'), 'w') as f:
            for x in rows: f.write(json.dumps(x, ensure_ascii=False) + '\n')
        total += len(rows); print(mod, len(rows))
    import assemble
    d = os.path.join(OUT, '_assembled'); os.makedirs(d, exist_ok=True); rows = []
    for a in assemble.assembled():
        path = os.path.join(d, a['label'].split('/')[-1] + '.png'); a['img'].save(path)
        rows.append(dict(png=path, kind=a['kind'], name=a['name'], label=a['label']))
    with open(os.path.join(d, 'items.jsonl'), 'w') as f:
        for x in rows: f.write(json.dumps(x, ensure_ascii=False) + '\n')
    return total + len(rows)

def pending(out='/tmp/gm-pending.jsonl', only_fail=False):
    """현재 그림 해시에 영수증이 없는 항목(또는 only_fail 이면 통과 못 한 항목)만 모은다."""
    sys.path.insert(0, os.path.join(gmlib.ROOT, 'src', 'harnesses', '_core'))
    from object_gate import pixel_sha256, read_receipt
    rows = []; st = dict(pass_=0, fail=0, none=0)
    for mod in sorted(os.listdir(OUT)):
        f = os.path.join(OUT, mod, 'items.jsonl')
        if not os.path.exists(f): continue
        for line in open(f):
            x = json.loads(line); r = read_receipt(pixel_sha256(Image.open(x['png'])))
            v = r and r.get('verdict')
            if v == 'pass': st['pass_'] += 1; continue
            st['fail' if v else 'none'] += 1
            if v and not only_fail: continue
            rows.append(x)
    with open(out, 'w') as f:
        for x in rows: f.write(json.dumps(x, ensure_ascii=False) + '\n')
    print('pending', len(rows), st, out)
    return rows


if __name__ == '__main__' and len(sys.argv) > 1 and sys.argv[1] == 'pending':
    pending(only_fail='--fail' in sys.argv); sys.exit(0)
if __name__ == '__main__':
    mods = sys.argv[1].split(',') if len(sys.argv) > 1 else loader.module_names()
    print('합계', export(mods))

