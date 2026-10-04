"""조각 판정 여러 개를 한 번에 기록한다 — harness/verdict.py 와 같은 기록(현재 그림 해시에 묶임)을 쓰되 카탈로그를 한 번만 굽는다.

    python3 in_verdict_batch.py lines.json     # {"조각 이름": ["pass|note|user|redo", "한 줄 판정"], ...}
검수 시트(in_review.py / harness gate --sheets)를 **눈으로 본 뒤에만** 쓴다. 이 도구는 시트를 대신 보지 않는다.
"""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'harness'))
import catalog
from gate import piece_hash, group_hash, VERD_PATH, TERRAIN_VERDICT

if __name__ == '__main__':
    lines = json.load(open(sys.argv[1]))
    objs, terr = catalog.objects(), catalog.terrain()
    try:
        v = json.load(open(VERD_PATH))
    except FileNotFoundError:
        v = {}
    for name, (status, line) in lines.items():
        assert status in ('pass', 'note', 'user', 'redo'), name
        h = group_hash(terr[name]) if name in TERRAIN_VERDICT else piece_hash(objs[name])
        v[name] = {'hash': h, 'status': status, 'line': line, 'reviewer': 'claude', 'user': 'pending', 'date': time.strftime('%Y-%m-%d')}
        print(name, status)
    json.dump(v, open(VERD_PATH, 'w'), ensure_ascii=False, indent=1)
