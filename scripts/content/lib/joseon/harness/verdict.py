"""조각별 3/4 판정 기록. 검수 시트(gate.py --sheets)를 눈으로 본 뒤에만 쓴다.

    python3 harness/verdict.py <조각> <pass|note|user|redo> "<한 줄: 윗면이 얼마나 보이나, 기준 조각과 비교해 무엇이 다른가>"
상태: pass=기준과 같은 문법 / note=통과하지만 차이 있음 / user=정면 소품이라 사용자 판정 필요 / redo=다시 그려야 함.
판정은 그 조각의 현재 픽셀 해시에 묶인다 — 그림이 바뀌면 gate 가 V 로 다시 막는다.
"""
import json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE)); sys.path.insert(0, HERE)
import catalog
from gate import piece_hash, group_hash, VERD_PATH, TERRAIN_VERDICT

if __name__ == '__main__':
    name, status, line = sys.argv[1], sys.argv[2], sys.argv[3]
    assert status in ('pass', 'note', 'user', 'redo')
    objs = catalog.objects()
    try:
        v = json.load(open(VERD_PATH))
    except FileNotFoundError:
        v = {}
    h = group_hash(catalog.terrain()[name]) if name in TERRAIN_VERDICT else piece_hash(objs[name])
    v[name] = {'hash': h, 'status': status, 'line': line, 'reviewer': 'claude', 'user': 'pending', 'date': time.strftime('%Y-%m-%d')}
    json.dump(v, open(VERD_PATH, 'w'), ensure_ascii=False, indent=1)
    print(name, status)
