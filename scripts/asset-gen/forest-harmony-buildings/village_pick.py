"""마을 칸(slot)마다 검사 통과작 하나를 고른다.  python3 village_pick.py [slot=art ...]  → {OUT}/village/picks.json
같은 설계도를 여러 칸에 쓰면 서로 다른 후보를 준다(같은 그림 반복 금지). 점수 = 스냅 칸·입구 번짐·처마 어긋남이 적을수록, 창·목재 등 세부(지붕 아닌 비배경 색 수)가 많을수록.
명령줄 slot=art 는 사람이 고른 것으로 그대로 쓴다(통과작이어야 한다)."""
import glob, json, os, re, sys
import numpy as np
from PIL import Image
from fhlib import *
plan = json.load(open(os.path.join(ROOT, 'tiledata/forest-harmony-buildings', os.environ.get('PLAN', 'village-plan.json'))))
VD = f"{OUT}/{os.environ.get('VDIR', 'village')}"
forced = dict(a.split('=', 1) for a in sys.argv[1:])
def score(n):
    c = json.load(open(f'{OUT}/{n}-bpcheck.json'))
    a = np.array(Image.open(f'{OUT}/{n}-art.png').convert('RGBA')); px = a[a[..., 3] > 200][:, :3]
    detail = len(np.unique(px, axis=0))
    z = c.get('zone') or {}
    return detail - 3 * c['snapped'] - 4 * c.get('door_over', 0) - 2 * z.get('eave_off_n', 0)
used, picks, why = set(), {}, {}
for s in plan['slots']:
    if s['id'] in forced: picks[s['id']] = forced[s['id']]; used.add(forced[s['id']]); why[s['id']] = '지정'; continue
    cands = [os.path.basename(p)[:-len('-bpcheck.json')] for p in glob.glob(f"{OUT}/{s['blueprint']}-c*-bpcheck.json")]
    ok = [n for n in cands if json.load(open(f'{OUT}/{n}-bpcheck.json'))['pass'] and os.path.exists(f'{OUT}/{n}-art.png')]
    free = [n for n in ok if n not in used]
    assert free, f"{s['id']}: 통과작 없음 ({s['blueprint']} 후보 {len(cands)}, 통과 {len(ok)}, 남은 것 0)"
    best = max(free, key=score); picks[s['id']] = best; used.add(best); why[s['id']] = f'통과 {len(ok)}/{len(cands)} 중 점수 {score(best)}'
os.makedirs(VD, exist_ok=True)
json.dump(picks, open(f'{VD}/picks.json', 'w'), indent=1)
for k, v in picks.items(): print(k, v, why[k])
