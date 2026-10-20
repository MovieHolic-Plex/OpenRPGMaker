"""몇 조각만 관문에 낼 투명 PNG + jsonl: python3 gate_some.py <out_dir> "<id>,<id>" [kind 덮어쓰기 없음]
→ <out_dir>/<slug>.png + <out_dir>/items.jsonl. 그 뒤: npm run harness -- object-gate review --batch <out_dir>/items.jsonl
(gate_export.py 와 같은 그림 — 시트에 들어가는 화소. 공용 _gate/ 폴더를 건드리지 않아 여러 작업자가 같이 쓸 수 있다.)"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import loader, iplib
out = sys.argv[1]; ids = [x.strip() for x in sys.argv[2].split(',') if x.strip()]
os.makedirs(out, exist_ok=True); reg = loader.load()
with open(os.path.join(out, 'items.jsonl'), 'w') as f:
    for pid in ids:
        p = reg.pieces[pid]; path = os.path.join(out, pid.replace(' ', '_') + '.png'); iplib.render(p).save(path)
        f.write(json.dumps(dict(png=path, kind=p['gate'], name=f"{p['ko']} ({pid})", label=f'atlas_biome_interior/plus/{pid}', **({'styleKind': p['style']} if p.get('style') else {})), ensure_ascii=False) + '\n')
print(len(ids), out)
