from dcommon import *
import os, jpenv
os.makedirs(jpenv.DISTRICTS_OUT, exist_ok=True)
# 칩셋은 이미 최신 → 내보내기 생략
kit = load(); rng = random.Random(7)
NC, NR = 96, 64
d = District(kit, NC, NR)

# ───── 좌표 개요 (세로 축 X=52, 북쪽 위) ─────
# 본당(0~11) → 상향로 → 호조몬(17~26) → 나카미세(28~41, 점포 양열 + 덴보인도리 34~35) → 가미나리몬(42~50)
# → 앞 보도(51~53) → 가미나리몬도리(54~61) → 남쪽 보도(62~63).  서쪽 롯쿠·시가지, 동쪽 시가지·스미다강.
X = 52
PX0, PX1 = 47, 56                      # 나카미세 참배길 (10칸, 열 47~56)
P0, P1 = 32, 72                        # 센소지 경내 열 범위
HB, HZ, KM = 11, 26, 50                # 본당·호조몬·가미나리몬 밑줄
ROAD0, ROAD1 = 54, 61

def adpost(spec, w, fam, r):
    spec['head'] = None                      # 글자 없는 지붕 간판 제거
    nf = len(spec['floors']); W = {'facade_ad.0': 8, 'facade_ad.1': 10, 'facade_ad.2': 6}
    if w >= 6 and nf >= 3 and r.random() < .5:
        k = r.choice([n for n in W if W[n] <= w]); return vis(spec, k, (w - W[k]) // 2, r.randrange(1, nf))
    if w >= 6 and nf >= 3 and r.random() < .5: return vis(spec, r.choice(['vision.0', 'vision.1', 'vision.2', 'vision.3']), (w - 6) // 2, r.randrange(1, nf))
    return spec

def edo(w, seed):
    """덴보인풍 에도 점포: 酒 포렴(noren) 문은 3채 중 1채만, 나머지는 격자 문. 처마 아래 위치는 레시피 그대로."""
    sp = G.machiya(kit, w, seed, True)
    if w >= 5 and (seed // 13) % 3 and sp['door'][0] == 'noren':
        sp['door'] = ('machiya', min(sp['door'][1], w - kit.decos['door.machiya']['w']))
    return sp

def machiya_row(c0, c1, base, seed0, wmin=5, wmax=7):
    c = c0; k = 0
    while c1 - c >= wmin:
        w = min(rng.randint(wmin, wmax), c1 - c)
        if c1 - (c + w) < wmin: w = c1 - c
        d.building(edo(w, seed0 + k * 13), c, base); c += w; k += 1

# ───── 바닥 ─────
d.fill(0, 0, NR, NC, 'sw')
for r in range(0, 28):                                      # 경내: 석판
    for c in range(P0, P1 + 1): d.set(r, c, 'sando' if (r * 3 + c) % 11 else 'sando_b')
for r in range(2, 10):                                      # 경내 서쪽 숲(자갈) · 동쪽 숲
    for c in range(33, 42): d.set(r, c, 'gravel')
for r in range(2, 11):
    for c in range(62, 72): d.set(r, c, 'gravel')
for r in range(17, 25):
    for c in range(63, 72): d.set(r, c, 'gravel')
for r in range(12, 54):                                     # 참배길(본당 앞 ~ 가미나리몬 앞) 포장돌
    for c in range(PX0, PX1 + 1):
        if r <= 27 or r >= 28: d.set(r, c, 'pave_a' if (r + c) % 4 else 'pave_b')
for r in range(34, 36):                                     # 덴보인도리 (동서 골목, 나카미세와 교차)
    for c in range(0, 87): d.set(r, c, 'pave_a' if (r + c) % 5 else 'pave_b')
for r in range(15, 17):                                     # 롯쿠 쪽·동쪽 시가지 골목 (경내 문까지)
    for c in list(range(0, 33)) + list(range(72, 87)): d.set(r, c, 'pave_a' if (r + c) % 5 else 'pave_b')
for r in range(0, 34):                                      # 롯쿠 브로드웨이 (보행자 거리 8칸)
    for c in range(14, 22): d.set(r, c, 'pave_a' if (r + c) % 4 else 'pave_b')
for r in range(42, 43):                                     # 문 옆 점포 앞 가로 골목
    for c in list(range(32, 46)) + list(range(58, 73)): d.set(r, c, 'pave_a' if (r + c) % 5 else 'pave_b')
for r in range(36, 43):                                     # 점포 옆 작은 광장(양쪽)
    for c in list(range(32, 37)) + list(range(67, 73)): d.set(r, c, 'pave_a' if (r + c) % 5 else 'pave_b')
for r in range(0, 64):                                      # 스미다강 + 강변 산책로
    for c in range(91, NC): d.set(r, c, 'water', 'X')
    for c in range(87, 91): d.set(r, c, 'quay')
# 남쪽 도로 (좌측통행: 북쪽 차선 동행) · 앞 보도
d.fill(ROAD0, 0, ROAD1 + 1, NC, 'road_c'); d.hline(ROAD0, 0, NC, 'road_n'); d.hline(ROAD1, 0, NC, 'road_s')
for c in range(NC): d.set(58, c, 'road_dash') if not PX0 <= c <= PX1 else None
d.fill(51, 0, 54, NC, 'sw'); d.fill(62, 0, 64, NC, 'sw')
for c in range(0, NC):                                      # 점자블록: 연석에서 1칸 안쪽(52행), 횡단 대기 칸은 점형
    if PX0 <= c <= PX1: d.set(53, c, 'tactile_dot'); d.set(62, c, 'tactile_dot')
    else: d.set(52, c, 'tactile_bar')
for c in range(PX0, PX1 + 1):                               # 횡단보도: 동서 도로 → 가로줄, 문 정면 폭
    d.set(ROAD0, c, 'zeb_n')
    for r in range(ROAD0 + 1, ROAD1): d.set(r, c, 'zeb_c')
    d.set(ROAD1, c, 'zeb_s')
for r in range(51, 54):                                     # 아즈마바시풍 다리: 강 위 도로 + 보도 난간
    for c in range(91, NC): d.set(r, c, 'sw')
for c in range(91, NC): d.set(51, c, 'guard', 'S'); d.set(63, c, 'guard', 'S')
for r in range(ROAD0, ROAD1 + 1):
    for c in range(91, NC): d.set(r, c, 'road_n' if r == ROAD0 else 'road_s' if r == ROAD1 else 'road_dash' if r == 58 else 'road_c')

# ───── 경내 (본당·호조몬·오층탑·향로·초즈야) ─────
for c in range(P0, P1 + 1): d.put('wall.tsuiji', c, 1, solid=True)           # 북쪽 담
for c in list(range(P0, 45)) + list(range(59, P1 + 1)): d.put('wall.tsuiji', c, 25, solid=True)   # 남쪽 담 (호조몬 양옆)
d.put('honden', 43, HB)
d.put('censer', 51, 15)
d.put('hozomon', 45, HZ)
d.put('lantern_post', 43, HZ + 1, solid=True); d.put('lantern_post', 60, HZ + 1, solid=True)   # 호조몬 앞 광장은 비워 둔다
d.put('lantern_post', 41, 12, solid=True); d.put('lantern_post', 62, 12, solid=True)
for c, r in ((46, 14), (57, 14), (46, 17 - 1), (57, 17 - 1)): d.put('stone_lantern', c, r)
d.put('pagoda5', 34, 24)                                  # 본당 서남쪽
d.put('chozuya', 63, 15)                                  # 본당 앞 오른쪽(동)
for c in (36, 40): d.put('stone_lantern', c, 22)
d.put('stone_lantern', 62, 24); d.put('stone_lantern', 69, 24)
d.put('nobori.aka', 44, 15); d.put('nobori.sora', 59, 15)
# 가을 은행나무 (불규칙, 서·동 숲)
for c, r in ((34, 9), (38, 11), (40, 6), (66, 8), (69, 6), (64, 22), (69, 23)): d.put('tree.ginkgo', c, r)
d.put('bench', 38, 18); d.put('bench', 41, 18); d.put('bench', 66, 13)

# 경내 문 (본당 마당 ↔ 서쪽 골목 · 동쪽 골목)
d.put('gate.iron_open', 32, 16, solid=False); d.put('gate.iron_open', 72, 16, solid=False)

# ───── 나카미세 (점포 양열 · 남북 직선 축) ─────
# 모든 점포가 3/4 시점에서 앞면(남쪽)만 보이므로, 나카미세는 가로 골목(덴보인도리 34~35 · 문 앞 42)을 낀 두 단씩 쌓는다.
for k, (c, b) in enumerate(((37, 41), (42, 41), (57, 41), (62, 41), (37, 33), (42, 33), (57, 33), (62, 33))):
    d.put(f'nakamise.{(k * 3 + k // 4) % 4}', c, b)
# 점포 열 바깥 에도풍 (덴보인도리 북쪽 · 가미나리몬 곁)
machiya_row(32, 37, 33, 100); machiya_row(67, 73, 33, 140)
machiya_row(32, 46, KM, 200, 7, 7); machiya_row(58, 73, KM, 260, 5, 5)
# 호조몬 앞 광장(27행)·점포 앞 홍등 열 (참배길 가장자리)
for r in (30, 38, 46): d.put('lantern_post', PX0, r, solid=True); d.put('lantern_post', PX1, r, solid=True)
for r in (29, 37): d.put('string_lanterns4', 49, r, solid=False)
# 상향로 앞 후다바(오미쿠지) 대신 호조몬 앞 수문 소품
d.put('kaminarimon', 46, KM)

# ───── 서쪽 시가지 (롯쿠) ─────
adp = adpost
strip_fit(d, kit, 14, 0, 0, 14, [('office', 3), ('retail', 2), ('mansion', 1)], rng, 5, 9, 3, 7, post=adp)
strip_fit(d, kit, 14, 0, 22, 32, [('office', 2), ('retail', 2), ('mansion', 2)], rng, 5, 9, 3, 7, post=adp)
strip_fit(d, kit, 33, 17, 0, 14, [('office', 3), ('retail', 2), ('mansion', 1)], rng, 5, 9, 3, 7, post=adp)
strip_fit(d, kit, 33, 17, 22, 32, [('retail', 3), ('office', 2), ('mansion', 1)], rng, 5, 9, 3, 7, post=adp)
strip_fit(d, kit, KM, 36, 0, 32, [('izakaya', 3), ('bar', 2), ('retail', 2), ('office', 1)], rng, 5, 9, 2, 6, post=adp)
d.put('arch_shotengai', 14, 33, solid=True)
# ───── 동쪽 시가지 ─────
strip_fit(d, kit, 14, 0, 73, 87, [('office', 2), ('retail', 2), ('mansion', 2)], rng, 5, 9, 3, 7, post=adp)
strip_fit(d, kit, 33, 17, 73, 87, [('retail', 3), ('office', 2), ('mansion', 1)], rng, 5, 9, 3, 7, post=adp)
strip_fit(d, kit, KM, 36, 73, 87, [('retail', 3), ('office', 2), ('izakaya', 1)], rng, 5, 9, 2, 6, post=adp)
# 강변 가로수
for r in (13, 30, 46): d.put('tree.ginkgo', 87, r)
for r in (22, 40): d.put('bench', 89, r)

# ───── 앞 보도·인력거·소품 ─────
for c in (34, 38, 42): d.put('ricksha_cart', c, 52, solid=False)
for c in (60, 64): d.put('ricksha_cart', c, 52, solid=False)
for c, nm in ((2, 'vending.aka'), (20, 'vend_pair'), (30, 'vending.sora'), (76, 'vending.midori'), (84, 'vend_pair')): safe_put(d, nm, c, 52)
for c in (8, 26, 66, 80): safe_put(d, 'bike_cluster', c, 52, solid=False)
for c in (16, 66): safe_put(d, 'post_box', c, 52)
for c in (6, 18, 30, 40, 64, 78, 86): d.put('lamp_post', c, 63, solid=True)
for c in (2, 12, 24, 36, 44, 62, 70, 82): d.put('planter', c, 63)
for c in (10, 38): d.put('bollard', c, 53)

# 골목 소품 (롯쿠·덴보인도리·경내 옆 골목): 전봇대·자판기·자전거·입간판 (나카미세 안에는 없음)
for c, r in ((6, 16), (26, 16), (76, 16), (84, 16), (4, 35), (28, 35), (80, 35)): safe_put(d, 'utility_pole2', c, r)
for c, nm in ((8, 'vending.aka'), (11, 'bike_cluster'), (24, 'vending.sora'), (78, 'vending.midori'), (82, 'bike_cluster'), (30, 'a_frame'), (6, 'a_frame')):
    safe_put(d, nm, c, 35 if c % 2 == 0 else 16, solid=nm != 'bike_cluster')
d.put('neon_stack.0', 14, 25, solid=False); d.put('neon_stack.1', 20, 25, solid=False); d.put('led_tower.0', 14, 12, solid=False); d.put('led_tower.1', 19, 8, solid=False)
# 작은 광장: 서쪽 노점 · 동쪽 휴게
d.put('tin_stall.0', 33, 39); d.put('bench', 35, 41); d.put('planter', 33, 41)
d.put('tin_stall.1', 68, 39); d.put('bench', 71, 41)

# ───── 차량 (좌측통행: 북쪽 차선 동행, 남쪽 차선 서행). 횡단보도 구간·행인 구간은 비운다 ─────
def traffic(row, c0, c1, east):
    cols = ['white', 'silver', 'black', 'red', 'blue', 'taxi', 'green', 'navy']
    c = c0 + rng.randint(0, 5)
    while c < c1 - 5:
        kind = rng.choices(['car', 'van', 'bus', 'taxi'], [6, 2, 1.3, 1.5])[0]
        if kind == 'car': nm = 'car.' + rng.choice(cols[:3] + cols[3:5] + cols[6:])
        elif kind == 'taxi': nm = 'car.taxi'
        elif kind == 'van': nm = 'van.white' if east else 'van.silver_r'
        else: nm = 'bus'
        if not east and kind == 'car' or not east and kind == 'taxi': nm += '_r'
        if not east and kind == 'bus': nm = 'bus_r'
        w = kit.props[nm]['w']
        if c + w > c1: break
        d.put(nm, c, row, solid=False); c += w + rng.choice([0, 1, 2, 4, 6, 9, 3])
traffic(57, 0, PX0 - 1, True); traffic(57, PX1 + 2, NC - 1, True)
traffic(60, 0, PX0 - 1, False); traffic(60, PX1 + 2, NC - 1, False)

# ───── 인파 (흐름: 참배길 양 레인·문 앞 밀집, 나머지는 드문드문) ─────
crowd(d, rng, 28, 33, 48, 55, 8); crowd(d, rng, 36, 41, 48, 55, 10); crowd(d, rng, 43, 49, 47, 56, 0)
for c in (50, 52): d.put(f'person.{rng.randrange(40)}', c, 50, dx=rng.randint(-3, 3), dy=0, solid=False)
crowd(d, rng, 51, 53, 42, 62, 18)                                     # 가미나리몬 정면 보도 (밀집)
crowd(d, rng, 12, 24, 48, 55, 12)                                     # 본당 앞
crowd(d, rng, 34, 35, 2, 84, 14)                                      # 덴보인도리
crowd(d, rng, 18, 33, 15, 20, 9)                                      # 롯쿠 브로드웨이
crowd(d, rng, 51, 53, 0, 40, 8); crowd(d, rng, 51, 53, 64, 88, 8)
crowd(d, rng, 36, 42, 32, 36, 3); crowd(d, rng, 36, 42, 67, 72, 3)
crowd(d, rng, 15, 16, 2, 30, 3); crowd(d, rng, 15, 16, 74, 84, 2)
crowd(d, rng, 3, 24, 35, 40, 2); crowd(d, rng, 12, 24, 64, 70, 3)

check(d, 'asakusa')
im = d.render(); Image.fromarray(im).save(os.path.join(jpenv.DISTRICTS_OUT, 'district_asakusa_v2.png')); print(im.shape)
