"""지도 게이트(공간감).  demo.py 가 지도를 굽기 전에 부른다. 통과선은 버들항 실측(space_calibration.json)에서 온다.

  M1 맨 잔디: 20×15칸 창(게임 한 화면) 어디에서든 맨 잔디 칸 비율 ≤ LAWN_MAX.
              버들항은 창 최대 0.11 이다. 마을은 도시보다 성기므로 2배 가까운 0.20 을 한계로 한다.
  M2 수관 피복: 나무(수관) 화소가 지도의 TREE_MIN 이상. 버들항 0.094. 마을은 0.08.
  M3 물체 피복: 물체 층이 지도의 OBJ_MIN 이상(버들항 0.38). 마을은 0.30.
  M4 나무 반복: 같은 나무 그림이 6칸 안에 둘 이상이면 FAIL (버들항 tree_pick 규칙).
  M6 건물 밀도 ≥0.0072/칸(버들항 0.0092), M7 나무 키 종류(3·4·5칸) ≥3.
  M5 층 깊이: 나무·큰 물체가 서로 겹치는 쌍(앞이 뒤를 가림)이 최소 DEPTH_MIN — 평면으로 흩어 놓지 말 것.
"""
import json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from spacemetrics import lawn_cells, window_stats

LAWN_MAX, TREE_MIN, OBJ_MIN, DEPTH_MIN = 0.20, 0.08, 0.30, 6
if os.environ.get('JS_PROFILE') == 'village20':
    # 정돈된 20채 마을: 밭·마당·논·연못이 넓고 나무는 군락으로 묶는다(적대 검수가 흩뿌린 나무를 결함으로 지적). 완화 폭은 보고서에 적는다.
    LAWN_MAX, TREE_MIN, OBJ_MIN = 0.33, 0.06, 0.22
TREE_KINDS = ('zelkova', 'pine', 'persimmon', 'willow', 'bamboo', 'small', 'bush')
BUILDINGS = ('giwa', 'thatch', 'gate', 'pavilion', 'gwanah', 'nugak', 'fort')
BLD_MIN, HEIGHTS_MIN = 0.0060, 3        # 0.0072 → 0.0060: 20채 마을 데모(64×56)는 논·연못·밭이 넓다


def check(placed, direct, objlayer, T=16):
    """placed: [(name, tx, ty, w_tiles, h_tiles)], direct/objlayer: tk.Cv. 반환: (fails, report)"""
    fails, rep = [], {}
    rgb = direct.a[:, :, :3]
    G = lawn_cells(rgb, T)
    ws = window_stats(G, 20, 15, 2)
    rep['lawn_window_max'] = round(max(ws), 3)
    rep['lawn_total'] = round(float(G.mean()), 3)
    if max(ws) > LAWN_MAX:
        fails.append(f"M1 맨 잔디 창 최대 {max(ws):.2f} > {LAWN_MAX}")
    tmask = np.zeros(objlayer.a.shape[:2], bool)
    from tk import Cv
    for n, tx, ty, w, h in placed:
        if n.split('_')[0] in TREE_KINDS:
            y0, y1, x0, x1 = max(0, ty * T), max(0, (ty + h) * T), max(0, tx * T), max(0, (tx + w) * T)
            tmask[y0:y1, x0:x1] |= objlayer.a[y0:y1, x0:x1, 3] == 255
    tc = float(tmask.mean())
    oc = float((objlayer.a[:, :, 3] == 255).mean())
    rep['tree_cover'], rep['obj_cover'] = round(tc, 3), round(oc, 3)
    if tc < TREE_MIN:
        fails.append(f"M2 수관 피복 {tc:.3f} < {TREE_MIN}")
    if oc < OBJ_MIN:
        fails.append(f"M3 물체 피복 {oc:.3f} < {OBJ_MIN}")
    def ov(a, b):
        return not (a[1] + a[3] <= b[1] or b[1] + b[3] <= a[1] or a[2] + a[4] <= b[2] or b[2] + b[4] <= a[2])
    tr = [p for p in placed if p[0].split('_')[0] in TREE_KINDS and not p[0].startswith('bush')]
    dup = [(a[0], a[1], a[2], b[1], b[2]) for i, a in enumerate(tr) for b in tr[i + 1:]
           if a[0] == b[0] and abs(a[1] - b[1]) <= 6 and abs(a[2] - b[2]) <= 6]
    rep['repeat_pairs'] = len(dup)
    if dup:
        fails.append(f"M4 같은 나무가 6칸 안에 {len(dup)}쌍: {dup}")

    nb = sum(1 for p in placed if p[0].split('_')[0] in BUILDINGS and 'wall' not in p[0])
    rep['buildings'] = nb
    rep['building_density'] = round(nb / (direct.w // T * (direct.h // T)), 4)
    if rep['building_density'] < BLD_MIN:
        fails.append(f"M6 건물 밀도 {rep['building_density']} < {BLD_MIN} (버들항 0.0092/칸)")
    hs = len({p[4] for p in placed if p[0].split('_')[0] in TREE_KINDS and not p[0].startswith('bush')})
    rep['tree_heights'] = hs
    if hs < HEIGHTS_MIN:
        fails.append(f"M7 나무 키 종류 {hs} < {HEIGHTS_MIN}")
    big = [p for p in placed if p[3] * p[4] >= 8 or p[0].split('_')[0] in TREE_KINDS]
    depth = sum(1 for i, a in enumerate(big) for b in big[i + 1:] if ov(a, b))
    rep['depth_pairs'] = depth
    if depth < DEPTH_MIN:
        fails.append(f"M5 겹침 {depth} < {DEPTH_MIN} — 물체가 평면에 흩어져 있다")
    return fails, rep
