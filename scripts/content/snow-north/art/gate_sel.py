#!/usr/bin/env python3
"""고른 조각만 관문 묶음 파일로: python3 gate_sel.py <group> id1 id2 … → tiledata/snow-north/<group>/_gate/sel.jsonl."""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kit import OUT
g = sys.argv[1]; ids = sys.argv[2:]
src = os.path.join(OUT, g, '_gate', 'items.jsonl')
rows = [json.loads(l) for l in open(src)]
want = {('sn-%s.png' % i) for i in ids}
out = os.path.join(OUT, g, '_gate', 'sel.jsonl')
with open(out, 'w') as f:
    for r in rows:
        if not ids or r['png'] in want: f.write(json.dumps(r, ensure_ascii=False) + '\n')
print(out)
