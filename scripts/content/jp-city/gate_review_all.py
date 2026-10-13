#!/usr/bin/env python3
"""모든 street_hand _gate 키트를 object-gate review --batch 입력(JSONL)으로 쓴다. 40개씩 /tmp/jp-gate-chunk-N.jsonl.
사용: python3 scripts/content/jp-city/gate_review_all.py [--all]   (기본: 이미 통과 영수증이 있는 키트는 건너뜀)
이어서: npm run harness -- object-gate review --batch /tmp/jp-gate-chunk-1.jsonl  (유료 판정자, 감독이 직접 실행)"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gate_kinds as G

CHUNK = 40

def main():
    only_missing = '--all' not in sys.argv
    skip = set()
    if only_missing:
        res = G.check_all()
        skip = set(res['ok'])
    rows = []
    for kid in G.gate_kits():
        if kid in skip: continue
        rows.append(dict(png=os.path.join(G.GATE_DIR, kid + '.png'), kind=G.kind_of(kid), name=kid, label='jp_city/street_hand/' + kid))
    for old in os.listdir('/tmp'):
        if old.startswith('jp-gate-chunk-') and old.endswith('.jsonl'): os.remove('/tmp/' + old)
    n = 0
    for i in range(0, len(rows), CHUNK):
        n += 1
        with open(f'/tmp/jp-gate-chunk-{n}.jsonl', 'w', encoding='utf-8') as f:
            for r in rows[i:i + CHUNK]: f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'{len(rows)}개 키트 -> /tmp/jp-gate-chunk-1..{n}.jsonl')

if __name__ == '__main__': main()
