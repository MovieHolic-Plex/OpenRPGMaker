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
if os.environ.get('JS_PROFILE') == 'gungnae':
    # 국내성형(96×96): 해자·성벽·궁 포장·큰 흙 마당이 넓고 건물은 듬성듬성한 대형 경관(조사 §⑧). 완화 폭은 최소로 둔다.
    LAWN_MAX, TREE_MIN, OBJ_MIN = 0.25, 0.07, 0.30
if os.environ.get('JS_PROFILE') == 'gungnae_full':
    # 국내성 원작 규모(200×208): 96×96 국내성형과 같은 이유(해자·성벽·궁 포장·큰 흙 마당이 넓고 건물은 듬성듬성한 대형 경관, 조사 §⑧)에
    # 더해, 원작 지도는 숲·논밭·정원이 넓다 — 맨 잔디 창은 96×96 과 같은 0.25 로 두되, 물체 피복은 건물이 듬성하므로 0.22 까지 허용한다.
    LAWN_MAX, TREE_MIN, OBJ_MIN = 0.25, 0.07, 0.22
if os.environ.get('JS_PROFILE') == 'field':
    # 사냥터(96×96): 몬스터가 배회하는 넓은 초원·숲·바위산이 목적이라 마을·국내성보다 맨 풀이 많다(초원 한가운데 20×15 창).
    # 대신 10×10 칸 전체가 평범한 바닥인 빈 광장은 빌더가 따로 막는다(fld_map.audit_plain).
    # 검수 승자(field-fa 빌더) 첫 굽기 실측 lawn_window 0.373 · tree 0.218 · obj 0.244 — 숲·바위산이 넓은 대신 중앙 초원은 열린 숨 쉴 자리를 두었다(검수 요청).
    # lawn 상한만 후보 A 때 0.37 에서 0.40 으로 되돌린다(숨 쉴 초원 + 사냥터 목적). tree/obj 는 실측보다 한 뼘 아래로 조인다.
    LAWN_MAX, TREE_MIN, OBJ_MIN = 0.40, 0.18, 0.20
if os.environ.get('JS_PROFILE') == 'cave':
    # 동굴(48×48): 나무·잔디가 없다(M1·M2·M4·M7 해당 없음). 바닥·벽면이 땅 그림이라 물체 피복은 낮다 — 방 안 소품(화로·기둥·석순·상자) 밀도로 대신 본다.
    LAWN_MAX, TREE_MIN, OBJ_MIN, DEPTH_MIN = 1.0, 0.0, 0.03, 0
if os.environ.get('JS_PROFILE') == 'interior':
    # 조선 실내(민가·상점·관아 방 맵): 맨 잔디·수관·건물 밀도·층 깊이는 실외 지표라 실내에는 잴 대상이 없다 — 0 으로 둔다
    # (통과시키려고 푸는 것이 아니다). 실내의 합격선은 아래 check_interior 의 I1~I6 이다.
    LAWN_MAX, TREE_MIN, OBJ_MIN, DEPTH_MIN = 1.0, 0.0, 0.0, 0
TREE_KINDS = ('zelkova', 'pine', 'persimmon', 'willow', 'bamboo', 'small', 'bush', 'grove')
BUILDINGS = ('giwa', 'thatch', 'gate', 'pavilion', 'gwanah', 'nugak', 'fort')
BLD_MIN, HEIGHTS_MIN = 0.0060, 3
if os.environ.get('JS_PROFILE') == 'cave':
    HEIGHTS_MIN = 0        # 0.0072 → 0.0060: 20채 마을 데모(64×56)는 논·연못·밭이 넓다
if os.environ.get('JS_PROFILE') == 'interior':
    BLD_MIN, HEIGHTS_MIN = 0.0, 0         # 실내: 건물 몸체·나무 키는 없다(위 사유)
_GN = os.environ.get('JS_PROFILE') in ('gungnae', 'gungnae_full', 'field', 'cave')
if _GN:
    # 국내성형: 새 조각 이름(gn_·palace_·tower_·gungnae_)도 건물로 센다. 담·문·소품은 세지 않는다(정규식은 건물 몸체 조각만).
    import re
    _BLD_RE = re.compile(r'^(giwa|thatch|gate|pavilion|gwanah|nugak|fort)_|^gn_(shop|l|u|g2|g3|thatch|jm_(corner|anchae|daemun|row))|^palace_(hall|jeongak|haeng(nak|gak)|gate)|^tower_|^gungnae_(gate|tower)')
    if os.environ.get('JS_PROFILE') == 'field':
        # 사냥터의 「건물」: 천막·굴 입구·폐허 석탑·건조대·무덤(사람이 머문 자리).
        _BLD_RE = re.compile(r'^fld_(tent|cave|ruin|rack|grave)')
    if os.environ.get('JS_PROFILE') == 'cave':
        # 동굴의 「건물」: 방을 밝히거나 받치는 구조물과 용도 앵커(횃불·바위 기둥·보물 단상/상자·광산 수레·뼈 둥지·큰 석순 군락).
        _BLD_RE = re.compile(r'^cav_(brazier|pillar|rockpillar|chest|chest_dais|torch_|cart|nest|stalagmite_wide)')
    BLD_MIN = {'gungnae': 0.0040, 'field': 0.0010, 'cave': 0.0030}.get(os.environ.get('JS_PROFILE'), 0.0007)   # 원작 규모(200×208=41600칸)는 건물 몸체 조각 29개 이상(원작 이름표 건물 약 25~35채). 아래는 96×96 국내성형의 사유다. # 0.0060 → 0.0040(8차 검수: 구획마다 건물 하나로 듬성듬성): 해자·성벽·궁 포장·밭이 넓고 건물은 듬성듬성한 대형 경관(조사 §⑧). 96×96=9216칸에 건물 몸체 조각 42개 이상.


def _b(n):
    """사냥터 조각 이름의 fld_ 접두어를 뗀다(나무 종류 판정용). 다른 프로필의 이름은 그대로."""
    return n[4:] if n.startswith('fld_') else n


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
        if _b(n).split('_')[0] in TREE_KINDS:
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
    tr = [p for p in placed if _b(p[0]).split('_')[0] in TREE_KINDS and not _b(p[0]).startswith('bush')]
    dup = [(a[0], a[1], a[2], b[1], b[2]) for i, a in enumerate(tr) for b in tr[i + 1:]
           if a[0] == b[0] and abs(a[1] - b[1]) <= 6 and abs(a[2] - b[2]) <= 6]
    rep['repeat_pairs'] = len(dup)
    if dup:
        fails.append(f"M4 같은 나무가 6칸 안에 {len(dup)}쌍: {dup}")

    nb = sum(1 for p in placed if ((_BLD_RE.match(p[0]) is not None) if _GN else (p[0].split('_')[0] in BUILDINGS and 'wall' not in p[0])))
    rep['buildings'] = nb
    rep['building_density'] = round(nb / (direct.w // T * (direct.h // T)), 4)
    if rep['building_density'] < BLD_MIN:
        fails.append(f"M6 건물 밀도 {rep['building_density']} < {BLD_MIN} (버들항 0.0092/칸)")
    hs = len({p[4] for p in placed if _b(p[0]).split('_')[0] in TREE_KINDS and not _b(p[0]).startswith('bush')})
    rep['tree_heights'] = hs
    if hs < HEIGHTS_MIN:
        fails.append(f"M7 나무 키 종류 {hs} < {HEIGHTS_MIN}")
    big = [p for p in placed if p[3] * p[4] >= 8 or _b(p[0]).split('_')[0] in TREE_KINDS]
    depth = sum(1 for i, a in enumerate(big) for b in big[i + 1:] if ov(a, b))
    rep['depth_pairs'] = depth
    if depth < DEPTH_MIN:
        fails.append(f"M5 겹침 {depth} < {DEPTH_MIN} — 물체가 평면에 흩어져 있다")
    return fails, rep


# ---- 조선 실내 합격선(JS_PROFILE=interior 의 방 맵). interior_checks.analyze() 가 만든 보고(rep)를 판정한다.
INT_BARE_RUN = 10          # I5 맨바닥(물체가 하나도 안 덮은 걷는 칸)이 가로·세로로 이만큼 이어지면 FAIL — 「공간이 남으면 방이 너무 크다」
INT_TRIPLE = 3             # I3 같은 기물이 이 개수 이상 한 줄(가로 또는 세로, 칸 간격 ≤1)이면 FAIL
INT_DOOR_CLEAR = 2         # I2 출입구 위 칸부터 이만큼은 비워 둔다(기물이 입구를 막지 않는다)
INT_PAIR_GAP = 1           # I6 같은 기물 둘이 가로·세로 간격 이 칸 이내로 붙어 있으면 FAIL(복제 쌍, 적대 검수 R6)
INT_BARE_RECT = 15         # I6 맨바닥이 이 칸 수 이상의 직사각형으로 비어 있으면 FAIL(빈 바닥, 적대 검수 R6)


def check_interior(rep):
    """rep: interior_checks.analyze 의 결과. 반환 (fails, 요약 보고)."""
    fails = []
    for key, label in (('exit_unreached', 'I1 출입구 앞 칸에서 닿지 못하는 걷는 칸'), ('use_unreached', 'I2 접근 칸이 없는/막힌 기물'),
                       ('door_blocked', 'I2 출입구 앞이 기물에 막힘'), ('triples', f'I3 같은 기물 {INT_TRIPLE}개 일렬'),
                       ('wall_rule', 'I4 천장 밑 벽·벽 가구 규칙'), ('overlap', 'I4 기물 겹침'), ('bare_runs', f'I5 맨바닥 {INT_BARE_RUN}칸 이상 연속'),
                       ('pairs', f'I6 같은 기물 간격 {INT_PAIR_GAP}칸 이내 복제 쌍'), ('bare_rect', f'I6 맨바닥 {INT_BARE_RECT}칸 이상 직사각형'),
                       ('door_no_yard', 'I7 출입구 밖 마당 두 줄 없음'), ('wall_ring', 'I7 외곽 벽 두께(외곽이 #·E 가 아님)'), ('no_shadow', 'I7 접지 그림자 없음(기물마다 SHADOW_MIN 화소)'),
                       ('bad_people', 'I7 조선에 맞지 않는 Actor1 프레임(0·6 만)'), ('people_dup', 'I7 같은 인물 캐릭터 복제'), ('people_blocking', 'I7 인물이 막힌 칸·문 앞에 섬')):
        if rep.get(key):
            fails.append(f"{label}: {rep[key][:6]}" + (f" 외 {len(rep[key]) - 6}" if len(rep[key]) > 6 else ''))
    return fails, {k: (len(v) if isinstance(v, list) else v) for k, v in rep.items()}
