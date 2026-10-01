#!/usr/bin/env python3
"""[fix4 파생본: 분화구 호수를 장소 목록에서 뺐다 → 31곳] 9단계 여정 설계의 「내용」(장소 역할·서사·정답표)과 그것을 지도에서 계산하는 함수.

설계서(journey-design-v9.md)·검사기(journey_check_v9.py)·페이지가 모두 이 파일을 본다.
정답표 EXPECT_STAGE 는 설계서의 막 구분이고, 검사기가 지도 위 BFS 결과와 대조한다."""
import heapq
from collections import deque, defaultdict

import numpy as np

import journey_world_v9 as J
import make_map_v4 as M4

W, H = J.W, J.H

# 이름, 막(0~4 = 1~5막), 역할, 한 줄 서사
PLACES = [
    ('강가 마을', 0, '시작', '큰 강과 내해 사이의 평화로운 마을. 동쪽 능선 너머 거대한 탑의 수정빛이 마을 어디서나 보인다.'),
    ('대성', 0, '거점', '서부 왕국의 수도. 왕이 「고갯길의 봉인」을 풀 통행증을 찾아 오라 명하고, 막이 바뀔 때마다 소식이 모이는 거점.'),
    ('내해 항구', 0, '거점', '배가 한 척도 없어 닫힌 부두. 2막에서 범선이 완성되면 승선 지점이 된다.'),
    ('고갯길 요새', 0, '관문', '중앙 산줄기의 유일한 틈을 막은 요새. 통행증이 없으면 문이 열리지 않는다(장벽 ①).'),
    ('설원 마을', 0, '선택 탐험', '북부 설원 가장자리의 교역 마을. 설원 길과 눈 촌락의 소문을 판다.'),
    ('눈 촌락', 0, '보상', '눈에 묻힌 외딴 촌락. 늙은 사냥꾼이 첫 보조 장비를 건넨다.'),
    ('고원 마을', 0, '거점', '2단 고원 꼭대기 마을. 산기슭 동굴에 통행증이 잠들어 있다는 단서를 준다.'),
    ('산기슭 동굴', 0, '장벽 해제 열쇠', '고원 발치의 첫 던전. 깊은 곳에서 요새 통행증을 얻는다(장벽 ① 해제 수단).'),
    ('거목', 0, '보상', '서부 숲 한가운데 선 거목. 회복의 열매를 얻는 쉼터.'),
    ('사막 촌락', 0, '거점', '대사막 입구의 마지막 마을. 사막선 전설만 전하고, 4막에서 사막선을 띄우는 출항지가 된다.'),
    ('거대한 탑', 1, '위기', '관문 너머 수정 탑. 탑의 마수가 정글 마을로 가는 조선 목재를 막고 있다. 쓰러뜨려야 선재가 풀린다.'),
    ('고대 돌원', 1, '선택 탐험', '돌원의 석판이 바다 위에 떠 있는 땅을 암시한다(천공섬 복선).'),
    ('정글 마을', 1, '장벽 해제 열쇠', '선재가 풀리면 마을 조선소가 범선을 완성한다(장벽 ② 해제 수단).'),
    ('사바나 마을', 2, '거점', '동대륙 성곽 도시. 서릉 고개를 넘은 여행자의 첫 거점이자 동대륙의 정보 허브.'),
    ('폐허 도시', 2, '위기', '화산재에 묻힌 옛 도시. 지난 분화 때 사라진 이들의 기록이 이번 위기를 예고한다.'),
    ('화염 요새', 2, '위기', '화산의 열기를 무기로 쓰는 요새. 동대륙 북부가 재에 덮이는 중반 위기의 진원.'),
    ('화산', 2, '위기', '분화구를 식혀 재 폭풍을 멈추는 중반 위기의 절정.'),
    ('독늪 탑', 2, '위기', '독 늪을 번지게 하는 정화 장치가 고장 난 탑. 고쳐야 북서쪽 길이 산다.'),
    ('북동 눈 촌락', 2, '선택 탐험', '동대륙 북동 끝 설원 마을. 재를 피해 온 피난민이 이야기를 들려준다.'),
    ('동쪽 항구', 2, '거점', '동대륙 동해안 항구. 배의 보급·귀환 지점.'),
    ('협곡 폐허', 2, '선택 탐험', '협곡 위 폐허. 사막 지도 조각이 남아 있다.'),
    ('오아시스 촌락', 2, '장벽 해제 열쇠', '사막 부족이 화산 위기를 막아 준 보답으로 사막선을 내준다(장벽 ③ 해제 수단).'),
    ('남섬 마을', 2, '거점', '남쪽 섬줄기의 항구 마을. 섬들을 도는 보급 거점.'),
    ('섬 동굴', 2, '선택 탐험', '섬줄기 첫 섬의 던전. 깊은 곳에 희귀 장비.'),
    ('섬 탑', 2, '보상', '섬줄기 등대. 꼭대기에서 천공섬의 방향이 확정된다.'),
    ('섬 폐허', 2, '선택 탐험', '재의 섬 폐허. 비공정 설계 조각이 묻혀 있다.'),
    ('북섬 촌락', 2, '선택 탐험', '북쪽 빙하 섬의 촌락. 빙하 아래 옛 항로의 기록.'),
    ('사막 폐허', 3, '선택 탐험', '대사막 속 모래에 반쯤 묻힌 폐허. 사막선 개조 부품이 있다.'),
    ('해협 감시탑', 3, '보상', '사구 한가운데 고원 위 감시탑. 꼭대기에서 비공정 이륙 항로가 보인다.'),
    ('사막 신전', 3, '장벽 해제 열쇠', '신전 지하에 잠든 비공정(장벽 ④ 해제 수단). 대사막을 건너야 닿는다.'),
    ('천공섬', 4, '최종', '바다 위에 떠 있는 대륙. 배로도 사막선으로도 닿지 않는 마지막 장소.'),
]
PLACE = {p[0]: p for p in PLACES}

# 줄거리 순서(굵은 여정선). (장소, 이 장소에서 일어나는 일)
MAIN_LINE = [
    ('강가 마을', '여기서 시작'),
    ('대성', '왕명: 통행증을 구하라'),
    ('고원 마을', '단서: 산기슭 동굴'),
    ('산기슭 동굴', '통행증 획득'),
    ('고갯길 요새', '관문 ① 개방'),
    ('거대한 탑', '1차 위기'),
    ('정글 마을', '범선 완성'),
    ('내해 항구', '승선'),
    ('동쪽 항구', '상륙'),
    ('사바나 마을', '거점'),
    ('화염 요새', '중반 위기'),
    ('화산', '위기 절정'),
    ('오아시스 촌락', '사막선 획득'),
    ('사막 촌락', '사막선 출항'),
    ('사막 신전', '비공정 획득'),
    ('천공섬', '최종'),
]
# 막별 정답(설계서와 같은 표). key = 처음 닿는 막 번호
EXPECT_STAGE = {}
for _n, _a, _r, _l in PLACES:
    EXPECT_STAGE[_n] = _a

# 수단 → (얻는 장소, 그 장소가 속해야 하는 막)
MEANS_SOURCE = {
    'pass': ('산기슭 동굴', 0),
    'ship': ('정글 마을', 1),
    'skiff': ('오아시스 촌락', 2),
    'air': ('사막 신전', 3),
}
FINAL = '천공섬'
START_PLACE = '강가 마을'
CRISIS = ['거대한 탑', '폐허 도시', '화염 요새', '화산', '독늪 탑']   # 위기 지역(중반 위기는 화염 요새·화산 일대)

ROLE_COLOR = {'시작': '#ffffff', '거점': '#9ec9ff', '관문': '#ff5d5d', '장벽 해제 열쇠': '#ffd34d', '위기': '#ff8a3d',
              '보상': '#7ee787', '선택 탐험': '#c9b6ff', '최종': '#ff6ad5'}


def fp(w, name):
    if name == '천공섬':
        return sorted(w.sky)
    return J.footprint(w.ic, name)


def center_of(w, name):
    cells = fp(w, name)
    xs = [c[0] for c in cells]
    ys = [c[1] for c in cells]
    return (min(xs) + max(xs) + 1) / 2.0, (min(ys) + max(ys) + 1) / 2.0


# ───────────── 다중 수단 최단 경로 ─────────────
_NS = {}


def _near_sky(w):
    if id(w) not in _NS:
        import scipy.ndimage as ndi
        m = np.zeros((H, W), bool)
        for (x, y) in w.sky:
            m[y, x] = True
        _NS[id(w)] = ndi.binary_dilation(m, iterations=3)
    return _NS[id(w)]


def multimodal_path(w, src, dst, stage, embark_cells=None):
    """src/dst 장소 이름. stage(0~4): 쓸 수 있는 수단. 반환 [(x,y,mode)] 모드는 foot/ship/skiff/air."""
    walk = w.walk0
    road = w.road
    sea = w.sea_reach
    dune = w.dune
    sky = w.sky
    tgt = set(fp(w, dst))
    starts = fp(w, src)
    near_sky = _near_sky(w)
    if stage >= 4 and dst == FINAL:
        # 비공정: 직선. 출발 장소에서 곧장 날아간다.
        (sx, sy), (tx, ty) = center_of(w, src), center_of(w, dst)
        n = int(max(abs(tx - sx), abs(ty - sy)) * 1.5) + 2
        pts = []
        for i in range(n + 1):
            u = i / n
            pts.append((int(sx + (tx - sx) * u), int(sy + (ty - sy) * u), 'air'))
        out = [pts[0]]
        for p in pts[1:]:
            if p != out[-1]:
                out.append(p)
        return out
    dist = {}
    prev = {}
    pq = []
    for (x, y) in starts:
        dist[(x, y, 'foot')] = 0.0
        heapq.heappush(pq, (0.0, x, y, 'foot'))
    best = None
    while pq:
        c, x, y, m = heapq.heappop(pq)
        if dist.get((x, y, m), 1e18) < c - 1e-9:
            continue
        if (x, y) in tgt and m == 'foot':
            best = (x, y, m)
            break
        for a, b in J.neighbors4(x, y):
            if m == 'foot':
                if walk[b, a]:
                    step = 0.35 if road[b, a] else (1.7 if M4.V.FORESTS and int(w.M.O[b, a]) in M4.V.FORESTS else 1.0)
                    nk = (a, b, 'foot')
                    nc = c + step
                    if nc < dist.get(nk, 1e18) - 1e-9:
                        dist[nk] = nc; prev[nk] = (x, y, m); heapq.heappush(pq, (nc, a, b, 'foot'))
                if stage >= 2 and sea[b, a] and w.landing_cell_ok(x, y) and (embark_cells is None or (x, y) in embark_cells):
                    nk = (a, b, 'ship'); nc = c + 3.0
                    if nc < dist.get(nk, 1e18) - 1e-9:
                        dist[nk] = nc; prev[nk] = (x, y, m); heapq.heappush(pq, (nc, a, b, 'ship'))
                if stage >= 3 and dune[b, a]:
                    nk = (a, b, 'skiff'); nc = c + 2.0
                    if nc < dist.get(nk, 1e18) - 1e-9:
                        dist[nk] = nc; prev[nk] = (x, y, m); heapq.heappush(pq, (nc, a, b, 'skiff'))
            elif m == 'ship':
                if sea[b, a]:
                    nk = (a, b, 'ship'); nc = c + 0.22 + (1.5 if near_sky[b, a] else 0.0)
                    if nc < dist.get(nk, 1e18) - 1e-9:
                        dist[nk] = nc; prev[nk] = (x, y, m); heapq.heappush(pq, (nc, a, b, 'ship'))
                if walk[b, a] and w.landing_cell_ok(a, b):
                    nk = (a, b, 'foot'); nc = c + 3.0
                    if nc < dist.get(nk, 1e18) - 1e-9:
                        dist[nk] = nc; prev[nk] = (x, y, m); heapq.heappush(pq, (nc, a, b, 'foot'))
            elif m == 'skiff':
                if dune[b, a]:
                    nk = (a, b, 'skiff'); nc = c + 0.45
                    if nc < dist.get(nk, 1e18) - 1e-9:
                        dist[nk] = nc; prev[nk] = (x, y, m); heapq.heappush(pq, (nc, a, b, 'skiff'))
                if walk[b, a]:
                    nk = (a, b, 'foot'); nc = c + 2.0
                    if nc < dist.get(nk, 1e18) - 1e-9:
                        dist[nk] = nc; prev[nk] = (x, y, m); heapq.heappush(pq, (nc, a, b, 'foot'))
    if best is None:
        return None
    out = []
    cur = best
    while cur is not None:
        out.append(cur)
        cur = prev.get(cur)
    return out[::-1]


def simplify(path):
    """같은 방향으로 이어지는 점을 줄인다(그림용)."""
    if len(path) <= 2:
        return path
    out = [path[0]]
    for i in range(1, len(path) - 1):
        a, b, c = path[i - 1], path[i], path[i + 1]
        if (b[0] - a[0], b[1] - a[1]) == (c[0] - b[0], c[1] - b[1]) and a[2] == b[2] == c[2]:
            continue
        out.append(b)
    out.append(path[-1])
    return out


LEG_STAGE = {   # 구간별로 쥐고 있는 수단 가짓수(통행증·범선·사막선·비공정)
    ('정글 마을', '내해 항구'): 1, ('내해 항구', '동쪽 항구'): 2, ('동쪽 항구', '사바나 마을'): 2,
    ('오아시스 촌락', '사막 촌락'): 3, ('사막 촌락', '사막 신전'): 3, ('사막 신전', '천공섬'): 4,
}


def main_line_legs(w):
    """줄거리 순서의 구간별 경로. 각 구간에서 쓰는 막(=수단 가짓수)을 함께 돌려준다."""
    legs = []
    for (a, _), (b, _) in zip(MAIN_LINE, MAIN_LINE[1:]):
        stage = LEG_STAGE.get((a, b), max(PLACE[a][1], PLACE[b][1]))
        emb = set(fp(w, '내해 항구')) if a == '내해 항구' else None
        p = multimodal_path(w, a, b, stage, embark_cells=emb)
        legs.append(dict(a=a, b=b, stage=stage, path=p))
    return legs


def place_nodes(w):
    return [p[0] for p in PLACES]


def route_ends():
    """길 이름 → (출발 장소, 도착 장소). 이름 문자열을 쪼개지 않고 경로 정의에서 읽는다."""
    if ROUTE_ENDS:       # [worldmap-kit] 여정 템플릿의 roads 에서 읽는다(M4.ROUTES 는 지형을 만든 프로세스에만 있다)
        return dict(ROUTE_ENDS)
    return {r[0]: (r[1], r[2]) for r in M4.ROUTES}


def nearest_by_walk(w, group, others):
    """group(장소 이름 목록)에서 걸어서 가장 가까운 others 장소와 그 출발 장소."""
    H_, W_ = W, H
    origin = {}
    q = deque()
    cellname = {}
    for n in others:
        for c in fp(w, n):
            cellname[c] = n
    for n in group:
        for c in fp(w, n):
            origin[c] = n
            q.append(c)
    while q:
        x, y = q.popleft()
        for a, b in J.neighbors4(x, y):
            if (a, b) in origin or not w.walk0[b, a]:
                continue
            if (a, b) in cellname and (a, b) not in origin:
                return origin[(x, y)], cellname[(a, b)]
            origin[(a, b)] = origin[(x, y)]
            q.append((a, b))
    return None


def foot_graph(w):
    """그려진 길(도로)에서 장소끼리의 간선, 길이 없는 같은 땅은 걷는 길(trail)로 잇는다."""
    adj = defaultdict(set)
    ends = route_ends()
    for name, cells in w.paths:
        a, b = ends[name]
        adj[a].add(b)
        adj[b].add(a)
    # 경사로 접기
    edges = set()
    ramps = [n for n in adj if n.endswith('경사로')]
    for r in ramps:
        nb = [n for n in adj[r]]
        for i in range(len(nb)):
            for j in range(i + 1, len(nb)):
                if not nb[i].endswith('경사로') and not nb[j].endswith('경사로'):
                    edges.add(tuple(sorted((nb[i], nb[j]))))
    # 경사로끼리 이어진 사슬(서 고원 아랫 ─ 윗)을 지나 장소까지
    def real_neighbors(start):
        out, seen, q = set(), {start}, [start]
        while q:
            n = q.pop()
            for m in adj[n]:
                if m in seen:
                    continue
                seen.add(m)
                if m.endswith('경사로'):
                    q.append(m)
                else:
                    out.add(m)
        return out
    for r in ramps:
        nb = real_neighbors(r)
        nb = sorted(nb)
        for i in range(len(nb)):
            for j in range(i + 1, len(nb)):
                edges.add((nb[i], nb[j]))
    for a, nbs in adj.items():
        if a.endswith('경사로'):
            continue
        for b in nbs:
            if not b.endswith('경사로'):
                edges.add(tuple(sorted((a, b))))
    # 같은 땅 안에서 길로 안 이어진 무리를 걷는 길로 잇기
    names = place_nodes(w)
    comp = walk_components(w)
    parent = {n: n for n in names}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for a, b in edges:
        if a in parent and b in parent:
            parent[find(a)] = find(b)
    trails = []
    changed = True
    while changed:
        changed = False
        groups = defaultdict(list)
        for n in names:
            groups[find(n)].append(n)
        for g, mem in groups.items():
            cg = {comp.get(m) for m in mem}
            cands = [n for n in names if find(n) != g and comp.get(n) in cg and comp.get(n) is not None]
            if not cands:
                continue
            hit = nearest_by_walk(w, mem, cands)
            if hit:
                trails.append(hit)
                parent[find(hit[0])] = find(hit[1])
                changed = True
                break
    return sorted(edges), trails


def walk_components(w):
    """장소 → 걸을 수 있는 땅 덩어리 번호(관문 열린 상태, 사구 닫힘). 없으면 None."""
    import scipy.ndimage as ndi
    lab, n = ndi.label(w.walk0)
    comp = {}
    for nm in place_nodes(w):
        for (x, y) in fp(w, nm):
            if lab[y, x] > 0:
                comp[nm] = int(lab[y, x])
                break
    # 천공섬은 걸을 수 있는 땅이 아님
    comp['천공섬'] = None
    return comp


# 배·사막선으로 닿는 땅 덩어리마다 「들어가는 곳」
SHIP_ENTRY = {'동쪽 항구', '남섬 마을', '섬 폐허', '북섬 촌락'}
SKIFF_ENTRY = {'사막 폐허', '사막 신전', '해협 감시탑'}


def means_edges(w):
    """(출발, 도착, 수단) 목록. 지형이 막는 곳을 건너는 간선만."""
    out = []
    out.append(('고갯길 요새', '정글 마을', 'pass'))
    out.append(('고갯길 요새', '거대한 탑', 'pass'))
    for e in sorted(SHIP_ENTRY):
        out.append(('내해 항구', e, 'ship'))
    for e in sorted(SKIFF_ENTRY):
        out.append(('사막 촌락', e, 'skiff'))
    out.append(('사막 신전', '천공섬', 'air'))
    return out


def barrier_numbers(w):
    """장벽 두께를 숫자로. 설계서가 말한 「좁은 목·단일 통로」를 지도 칸으로 잰다."""
    M = w.M
    out = {}
    # ① 산벽: 서쪽(걸어서 닿는 땅)과 동쪽(통행증 뒤에 닿는 땅) 사이를 막는 칸 수를 행마다 잰다(관문 행 제외).
    gx, gy, gw, gh = w.ic[J.GATE_SITE]
    r0, r1 = w.reach[0], w.reach[1]
    east = r1 & ~r0
    thick = []
    for y in range(11, 35):
        if gy <= y < gy + gh:
            continue
        wx = [x for x in range(30, 48) if r0[y, x]]
        ex = [x for x in range(38, 56) if east[y, x]]
        if not wx or not ex:
            continue
        a_, b_ = max(wx), min(ex)
        if b_ > a_:
            thick.append((b_ - a_ - 1, y))
    out['mount_wall_rows'] = len(thick)
    out['mount_wall_min_thickness'] = min(t for t, _ in thick) if thick else 0
    out['mount_wall_min_row'] = min(thick)[1] if thick else None
    out['gate_width'] = gw
    # ② 바다: 서대륙 땅(걸어서 닿는 땅, 서쪽)과 동대륙 땅(배로만 닿는 땅, x>=58) 사이 최단 바다 칸 수
    land_a = (w.reach[1] & ~w.sea)
    land_b = (w.reach[2] & ~w.reach[1] & ~w.sea)
    for y in range(H):
        for x in range(W):
            if x < 58 or y > 50:
                land_b[y, x] = False
    dist = np.full((H, W), -1, int)
    q = deque()
    for y in range(H):
        for x in range(W):
            if w.sea[y, x] and x < 58 and any(land_a[b, a] for a, b in J.neighbors4(x, y)):
                dist[y, x] = 1
                q.append((x, y))
    best = None
    bx = by = None
    while q:
        x, y = q.popleft()
        if any(land_b[b, a] for a, b in J.neighbors4(x, y)):
            best = dist[y, x]
            bx, by = x, y
            break
        for a, b in J.neighbors4(x, y):
            if w.sea[b, a] and dist[b, a] < 0:
                dist[b, a] = dist[y, x] + 1
                q.append((a, b))
    out['sea_gap'] = int(best) if best else None
    out['sea_gap_at'] = (int(bx), int(by)) if best else None
    # ③ 사구 바다: 걸어서 닿는 땅에서 가장 가까운 폐허·신전·고원까지 사구 칸 수
    dune = w.dune
    r2 = w.reach[2]
    dd = np.full((H, W), -1, int)
    q = deque()
    for y in range(H):
        for x in range(W):
            if dune[y, x] and any(r2[b, a] and not dune[b, a] for a, b in J.neighbors4(x, y)):
                dd[y, x] = 1
                q.append((x, y))
    # 사구 칸을 지나 처음 닿는 새 땅(r3 에서 새로 생긴 칸)까지 폭
    r3new = w.reach[3] & ~w.reach[2]
    found = {}
    while q:
        x, y = q.popleft()
        for a, b in J.neighbors4(x, y):
            if r3new[b, a] and not dune[b, a]:
                for nm in ('사막 폐허', '해협 감시탑', '사막 신전'):
                    if (a, b) in set(fp(w, nm)) or (nm == '해협 감시탑' and w.M.Hh[b, a] > 0):
                        found.setdefault(nm, int(dd[y, x]))
            if dune[b, a] and dd[b, a] < 0:
                dd[b, a] = dd[y, x] + 1
                q.append((a, b))
    out['dune_depth_to'] = found
    out['dune_cells'] = int(dune.sum())
    # ④ 하늘: 천공섬에서 가장 가까운 땅까지 바다 칸
    sky = w.sky
    dmin = 99
    near = None
    for (sx, sy) in sky:
        for y in range(H):
            for x in range(W):
                if w.M.G[y, x] >= 10:
                    d = abs(x - sx) + abs(y - sy)
                    if d < dmin:
                        dmin = d; near = (x, y)
    out['sky_gap'] = int(dmin) - 1
    out['sky_near'] = near
    return out


def opening_view(w):
    """시작 지점에서 한 화면(20x15)에 들어오는 장소와 장벽."""
    sx, sy = J.START
    vw, vh = J.WINDOW
    x0, y0 = sx - 7, sy - vh // 2
    x1, y1 = x0 + vw - 1, y0 + vh - 1
    vis = []
    for n in [p[0] for p in PLACES]:
        cells = fp(w, n)
        inside = [c for c in cells if x0 <= c[0] <= x1 and y0 <= c[1] <= y1]
        if inside:
            vis.append((n, len(inside), len(cells)))
    return dict(box=(x0, y0, x1, y1), places=vis)


# ───────────── [worldmap-kit] 여정 템플릿에서 내용 읽기 ─────────────
ROUTE_ENDS = {}
CFG = {'must_not_walk': ['정글 마을', '거대한 탑', '고대 돌원', '사막 신전', '사막 폐허', '해협 감시탑', '화산', '천공섬', '오아시스 촌락'],
       'opening_must_see': ['고갯길 요새', '내해 항구'], 'opening_far': ['거대한 탑']}


def configure(t):
    """journeys/<id>.json 의 장소·막·수단·줄거리를 이 모듈의 전역(PLACES …)으로 옮긴다. 함수(최단 경로·장벽 두께·시작 화면)는 그대로다."""
    global PLACES, PLACE, MAIN_LINE, EXPECT_STAGE, MEANS_SOURCE, FINAL, START_PLACE, CRISIS, LEG_STAGE, SHIP_ENTRY, SKIFF_ENTRY
    # places 배열 순서는 지형이 요구하는 순서(M4.SITES)다. 설계서·검사 보고의 순서는 seq(줄거리 순)를 따른다.
    PLACES = [(p['id'], p['act'], p['function'], p['story']) for p in sorted(t['places'], key=lambda p: p.get('seq', 0))]
    PLACE = {p[0]: p for p in PLACES}
    MAIN_LINE = [(m['place'], m['event']) for m in t['main_line']]
    EXPECT_STAGE = {p[0]: p[1] for p in PLACES}
    MEANS_SOURCE = {k: (v['source'], v['act']) for k, v in t['means'].items()}
    FINAL = t['final']
    START_PLACE = t['start']['place']
    CRISIS = list(t.get('crisis', []))
    LEG_STAGE = {(a, b): st for a, b, st in t.get('leg_stage', [])}
    SHIP_ENTRY = set(t.get('entries', {}).get('ship', []))
    SKIFF_ENTRY = set(t.get('entries', {}).get('skiff', []))
    CFG.update(t.get('checks', {}))
    ROUTE_ENDS.clear()
    ROUTE_ENDS.update({r['id']: (r['from'], r['to']) for r in t.get('roads', [])})
