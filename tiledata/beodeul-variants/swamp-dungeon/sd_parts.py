# 늪 던전 조각 저장: 오토타일 3장(16변형), 바닥 표본 4장, 벽 앞면 표본, 물체·식생·소품 — partmeta.json · parts.md 를 같이 쓴다.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import sd_art as A
from sd_art import *
from px2 import _hash, vnoise
wl = AF.wl                                                     # 16변형 가장자리 깊이장·조립(웨이브 공용 도우미, 읽기만)

# ================================================================ 오토타일 1: 늪 웅덩이(물 ↔ 진흙 ↔ 풀)
def mudpool_cell(n, seed=71):
    """칸 안쪽은 늪물(이웃 쪽으로 그대로 이어짐), 이웃 없는 쪽 물가 2화소는 짙은 젖은 진흙 테, 그 바깥 1~2화소는 진흙 → 투명(풀이 보인다).
    물 빛은 테에서 가까운 한 줄만 얕게 밝고 나머지는 칸 위치와 상관없이 같은 톤이라 속 칸(15)과 줄 칸이 이어진다."""
    m, _ = wl.edge_depth(n, 0.8, 1.2, 5.0, seed)
    im = Image.new('RGBA', (16, 16)); px = im.load()
    for y in range(16):
        for x in range(16):
            v = m[y, x]
            if v < 0: continue
            if v < 1.4: c = mud_px_p(x, y, 9, 16)
            elif v < 2.6: c = MUD[2] if _hash(x, y, seed + 1) < 0.6 else MUD[3]
            elif v < 3.3: c = MUD[1]
            else:
                c = murk_px_p(x, y, 13, 16, 0.9)
                if v < 4.4: c = MURK[4] if _hash(x, y, seed) < 0.55 else MURK[5]
            px[x, y] = c + (255,)
    return im
def autotile_mudpool(): return wl.sheet_from_cells([mudpool_cell(n) for n in range(16)])

# ================================================================ 오토타일 2: 갈대 번짐
def reeds_cell(n, seed=73):
    """갈대 덤불(투명 바탕): 칸마다 두 줄(밑동 y=7, y=15)에 갈대 줄기·잎, 일부는 이삭. 이웃 없는 쪽 가장자리로 갈수록 성기고 낮다.
    줄기는 칸 안에서 끝나 이웃 칸과 이음새가 없다."""
    m, _ = wl.edge_depth(n, 1.0, 1.2, 4.5, seed)
    im = Image.new('RGBA', (16, 16)); px = im.load()
    for base in (7, 15):
        for x in range(16):
            h = _hash(x, base, seed)
            if h > 0.72: continue
            if m[base, x] < 0: continue
            depth = m[base, x]
            if depth < 2.5 and _hash(x, base, seed + 1) < 0.55: continue
            hgt = 3 + int(_hash(x, base, seed + 2) * (6 if base == 15 else 5))
            if depth < 3: hgt = max(2, hgt - 3)
            top = base - hgt
            lean = -1 if _hash(x, base, seed + 3) < 0.3 else (1 if _hash(x, base, seed + 3) > 0.75 else 0)
            for k, y in enumerate(range(base, top, -1)):
                xx = x + (lean if k >= hgt - 2 else 0)
                if not (0 <= xx < 16 and 0 <= y < 16): continue
                f = k / max(1, hgt)
                c = REED[2] if f < 0.3 else (REED[3] if f < 0.7 else REED[4])
                if xx < 8 and f > 0.5: c = REED[5]
                px[xx, y] = c + (255,)
            if _hash(x, base, seed + 4) < 0.18 and top + 1 >= 0:            # 이삭
                for y in (top + 1, top + 2):
                    if 0 <= y < 16: px[x, y] = ((126, 78, 44) if y == top + 1 else (98, 58, 32)) + (255,)
            if base < 16: px[x, base] = REED[1] + (255,)                    # 밑동 그늘
    return im
def autotile_reeds():                                          # 감사 보정 2026-10-08: 둥근 덩이 윤곽 판(sd_fix_reeds)
    import sd_fix_reeds
    return sd_fix_reeds.autotile_reeds()

# ================================================================ 오토타일 3: 썩은 널다리
def autotile_boardwalk():
    cells = []
    for n in range(16):
        vert = bool(n & 5) and not bool(n & 10)
        cells.append(deck_cell(n, 'v' if vert else 'h', (n % 4) * 16, (n // 4) * 16))
    return wl.sheet_from_cells(cells)

# ================================================================ 바닥·벽 표본(48x48, 이어 붙여도 이음새 없음)
def ground_mud():
    im = new(48, 48); p = im.load()
    for y in range(48):
        for x in range(48): p[x, y] = mud_px_p(x, y, 3) + (255,)
    return im
def ground_murk():
    im = new(48, 48); p = im.load()
    for y in range(48):
        for x in range(48): p[x, y] = murk_px_p(x, y, 5) + (255,)
    return im
def ground_flag():
    im = new(48, 48); p = im.load()
    for y in range(48):
        for x in range(48): p[x, y] = flag_px(x, y) + (255,)
    return im
def ground_deck():
    im = new(48, 48)
    for cy in range(3):
        for cx in range(3): im.alpha_composite(deck_cell(15, 'h', cx * 16, cy * 16), (cx * 16, cy * 16))
    return im
def face_landing():
    """사당 앞 돌 단의 앞면 표본(3x1칸): 판석 윗면 테 + 젖은 옛 마름돌 2줄 + 물때 + 물에 잠기는 아랫단."""
    s2 = SwampScene('t', 3, 2, 1); s2.stone = {(0, 0), (1, 0), (2, 0)}
    return s2._deck_layer(48, 32).crop((0, 0, 48, 16))

# ================================================================ 저장
def save_parts():
    pt = wl.Parts(HERE)
    for f in os.listdir(pt.dir):
        if f.endswith('.png'): os.remove(os.path.join(pt.dir, f))
    T, O, D, AU = 'tree', 'object', 'decal', 'autotile'
    add = pt.add
    # --- 바닥·벽·오토타일
    add('ground-mud', ground_mud(), 'floor', '늪 진흙', '버들항 흙길 타일의 점 결을 칩셋 밀림 진흙 색 7단으로 옮긴 젖은 진흙 바닥(마른 덩이·젖은 덩이 두 톤, 마른 풀 포기).', '섬·물가의 기본 땅. 3x3 이상 덩이로 깔고 풀과의 경계는 늪 웅덩이 오토타일의 진흙 테나 자연 덩이로 섞는다.', pad=False)
    add('ground-murk', ground_murk(), 'liquid', '늪물', '탁한 녹청 늪물(덩이 깊이 띠·잔물결·개구리밥 조각). 막힘.', '늪 수면. 통행 불가. 넓게 깔고 연잎·통나무·말뚝을 드문드문 띄운다. 물가에는 진흙 테를 둔다.', pad=False)
    add('ground-flag', ground_flag(), 'floor', '이끼 판석', '사당 앞 돌 단의 바랜 판석(줄 12화소, 판마다 명도, 줄눈에 이끼).', '가라앉은 유적 앞 단·돌길 윗면. 가장자리는 face_landing 앞면으로 물에 잇는다.', pad=False)
    add('ground-deck', ground_deck(), 'walk', '썩은 널판', '칩셋 널판 결을 회갈 썩은 목재로 옮긴 널다리 윗면(빠진 널·이끼 얼룩).', '물 위를 지나는 널다리·선착장 바닥. 걸음. 길이 방향이 바뀌면 널다리 오토타일을 쓴다.', pad=False)
    add('face_landing', face_landing(), 'wall', '돌 단 앞면', '물 위 판석 단의 남쪽 앞면: 젖은 옛 마름돌 2줄과 물때, 아랫단은 물에 잠김.', '돌 단(판석) 남쪽 끝 한 줄에 이어 붙인다. 막힘. 옆면은 그리지 않는다(1화소 어두운 테).', pad=False)
    add('autotile-mudpool', autotile_mudpool(), AU, '늪 웅덩이', '물↔진흙↔풀 16변형: 속은 늪물, 이웃 없는 쪽은 젖은 진흙 테 → 투명 가장자리(풀이 보인다).', '아래층. 물 칸이라 통행 불가. 풀·진흙 땅 위에 덩이로 칠해 웅덩이·늪 가장자리를 만든다. 1칸 외톨이는 0번.', layer='lower', role='terrain')
    add('autotile-reeds', autotile_reeds(), AU, '갈대 번짐', '진흙·물가에 번진 갈대 덤불 16변형(투명 바탕, 가장자리로 갈수록 성기고 낮음, 이삭 섞임).', '아래층 덧그림, 걸음(물 위에 칠하면 물 칸이라 막힘). 물가를 따라 3칸 이상 띠·덩이로, 길 위에는 칠하지 않는다.', layer='lower', role='terrain')
    add('autotile-boardwalk', autotile_boardwalk(), AU, '썩은 널다리', '이웃에 따라 모양이 바뀌는 널다리 16변형: 위 끝은 물이 비치고 아래 끝은 널 두께 앞면, 옆은 어두운 테.', '물 칸 위에 길처럼 칠한다(lay_path). 칠한 칸은 걸음으로 바꾼다. 남북 다리는 세로 이웃, 동서 다리는 가로 이웃으로 결이 정해진다.', layer='lower', role='terrain')
    # --- 앵커
    add('shrine-sunken', A.shrine_sunken(), O, '가라앉은 옛 사당', '버들항 신전이 늪에 가라앉았다: 기둥·박공만 물 위, 이끼 슬레이트 지붕은 오른쪽 뒤가 내려앉음, 어두운 입구에 도깨비불 빛(6x6칸).', '맵의 끝(앵커). 물 위에 놓고 앞(남쪽)에 판석 돌 단을 붙인다. 가운데 아래 두 칸이 입구(이벤트 자리). 기둥·엔타블러처 아래 3줄 막힘, 지붕 줄은 뒤로 걷는다(보통 물 위라 물이 막는다). 둘레에 잠긴 기둥·아치를 흩는다.', brows=3)
    add('spire-sunken', A.spire_sunken(), O, '물에 잠긴 탑 첨두', '버들항 원탑의 고깔 지붕과 맨 윗단(창 하나)만 늪 위로 나왔다. 비늘 한쪽이 떨어지고 쇠막대가 휨(3x6칸).', '넓은 물 한가운데 하나(먼 경치). 물 칸이라 통행 불가. 널다리에서 보이는 자리에.', brows=1)
    add('hut-ruin', HUT_IMG(), O, '오두막 폐허', '늪 마을 널집이 버려져 무너짐: 묵은 이엉 지붕이 내려앉아 서까래, 문짝 떨어진 어두운 문간, 깨진 창, 빠진 널(4x6칸).', '섬 가운데 하나. 벽 아래 2줄 막힘, 지붕 줄은 뒤로 걷는다. 문 앞 한 칸은 비우고 둘레에 널 더미·깨진 통·안개.', brows=2)
    add('mangrove-big', A.mangrove(5, 6, 1), T, '큰 맹그로브', '넓고 어두운 수관 밑으로 굵은 받침뿌리가 활처럼 휘어 물·진흙에 꽂힌 맹그로브, 이끼 수염·기근(5x6칸).', '섬·물가의 앵커 나무. 물가에 반쯤 걸쳐 심는다. 밑동 가운데 2칸만 막히고 수관 밑은 뒤로 걷는다. 길을 수관으로 덮지 않게.', brows=1)
    add('mangrove-small', A.mangrove(3, 4, 3), T, '작은 맹그로브', '받침뿌리 우리가 있는 작은 맹그로브(3x4칸).', '큰 맹그로브 곁·작은 섬·물가에 덩이로. 밑동 1칸 막힘.', brows=1)
    add('mangrove-mid', A.mangrove(4, 5, 13), T, '맹그로브(중간)', '중간 크기 맹그로브(4x5칸), 다른 뿌리 배치.', '크기가 다른 맹그로브와 섞어 반복을 숨긴다. 밑동 2칸 막힘.', brows=1)
    add('bald-cypress', A.bald_cypress(2), T, '낙우송', '밑동이 활짝 퍼진 골진 줄기와 층진 좁은 수관, 이끼 수염, 무릎 뿌리(3x6칸).', '마른 땅·물가 숲 채움 나무. 덩이로(일렬 금지). 밑동 1칸 막힘.', brows=1)
    add('bald-cypress-b', A.bald_cypress(11, 5), T, '낙우송 B(작음)', '조금 작은 낙우송(3x5칸), 다른 덩이 배치.', '낙우송 A 와 번갈아. 밑동 1칸 막힘.', brows=1)
    add('dead-tree', A.dead_tree(4), T, '늪 고사목', '잎 없는 회갈 줄기, 부러진 우듬지, 가지 셋, 선반버섯, 이끼 수염(2x4칸).', '땅 위. 숲 가장자리·폐허 곁에 드문드문. 밑동 1칸 막힘.', brows=1)
    add('dead-tree-water', A.dead_tree(21, wet=True), T, '물에 잠긴 고사목', '밑동이 늪물에 잠긴 고사목(물결 고리).', '물 칸 위에 하나씩(물 칸이라 통행 불가). 넓은 물을 끊어 준다.', brows=1)
    # --- 유적 조각
    add('arch-sunken', A.sunken_arch(), O, '물에 잠긴 아치', '버들항 마름돌 아치의 다리가 물에 잠겨 고리와 기둥 윗부분만 나왔다(4x4칸).', '사당 둘레 물 위. 물 칸이라 통행 불가. 사당과 같은 돌빛.', brows=1)
    add('pillar-sunken-a', A.pillar_water(0, 3), O, '잠긴 기둥(온전)', '받침이 물 밑에 잠긴 옛 기둥(기둥머리 남음, 1x3칸).', '사당 둘레 물 위에 2~3칸 간격, 부러진 기둥과 섞는다. 일렬 금지.', brows=1)
    add('pillar-sunken-b', A.pillar_water(1, 5), O, '잠긴 기둥(부러짐)', '중간에서 부러진 잠긴 기둥.', '온전한 잠긴 기둥 사이에.', brows=1)
    add('pillar-sunken-c', A.pillar_water(2, 7), O, '잠긴 기둥(토막)', '수면 위로 조금만 나온 기둥 토막.', '기둥 줄 끝·얕은 물.', brows=1)
    add('stone-lantern', A.stone_lantern(21), O, '이끼 돌 등롱', '받침·기둥·불집·지붕돌의 돌 등롱, 불집 창에 푸른 도깨비불(1x2칸).', '돌 단 양 끝·섬 들머리에 하나씩. 밑동 1칸 막힘.', brows=1)
    add('stone-lantern-lean', A.stone_lantern(22, lean=2), O, '기운 돌 등롱', '진흙에 기울어진 돌 등롱.', '곧은 등롱과 짝으로 한쪽에. 밑동 1칸 막힘.', brows=1)
    # --- 늪 소품
    add('hut-debris', A.hut_debris(), O, '무너진 널 더미', '오두막에서 떨어진 썩은 널·서까래 더미(2x1칸).', '오두막 곁·문 옆. 1칸 막힘. 길을 막지 않게.', brows=1)
    add('barrel-broken', A.barrel_broken(), O, '깨진 나무통', '테가 풀려 널이 벌어진 썩은 통(1x1칸).', '폐허 곁에 하나. 1칸 막힘.', brows=1)
    add('rock-water-big', A.rock_water(True, 41), O, '물속 이끼 바위', '물에 반쯤 잠긴 이끼 바위 두 덩이(2x2칸).', '물 위·물가. 넓은 물을 끊는 덩이로.', brows=1)
    add('rock-water-small', A.rock_water(False, 45), O, '작은 물속 바위', '물에 반쯤 잠긴 작은 이끼 바위(1x1칸).', '큰 바위 곁·섬 물가. 1칸 막힘.', brows=1)
    add('stepping-stones', A.stepping_stones(), D, '디딤돌', '수면에 겨우 나온 납작한 이끼 돌 셋(2x1칸, 바닥 소품).', '물 위 장식(물 칸이라 막힘은 물이 맡는다). 섬 사이 얕은 곳에.', brows=0)
    add('log-water', A.log_water(), O, '물에 잠긴 통나무', '윗등만 물 위로 나온 이끼 통나무(3x1칸).', '물 위. 널다리와 나란히 두지 않는다.', brows=1)
    add('sunken-boat', A.sunken_boat(), O, '가라앉은 나룻배', '뱃머리만 들리고 고물은 물에 잠긴 썩은 나룻배, 배 안에 물(3x1칸).', '물가 가까운 물 위에 하나.', brows=1)
    add('deck-post', A.deck_post(45), O, '물속 말뚝', '널다리 곁 물에 박힌 썩은 말뚝(1x2칸, 이끼 띠·물결).', '널다리 옆 물 칸에 드문드문(2~4칸 간격, 일렬 금지).', brows=1)
    add('deck-post-rope', A.deck_post(46, True), O, '밧줄 말뚝', '밧줄이 감긴 물속 말뚝.', '널다리 끝·꺾이는 곳 곁에.', brows=1)
    add('deck-broken-end', A.deck_broken_end(), O, '끊긴 널다리 끝', '성한 널다리 한 칸 뒤로 널이 부러져 물속으로 처박힌 끝, 부러진 말뚝(2x1칸).', '널다리가 끊긴 자리 끝에 왼쪽 칸을 맞춰 붙인다. 오른쪽 칸은 물(막힘).', brows=1)
    add('stump-fungus', A.stump_fungus(), O, '선반버섯 그루터기', '나이테 윗면·주황 선반버섯이 붙은 썩은 그루터기(1x1칸).', '섬·숲 바닥. 1칸 막힘.', brows=1)
    add('skull-stake', A.skull_stake(), O, '머리뼈 말뚝', '뿔 달린 짐승 머리뼈를 꽂은 경고 말뚝(1x2칸, 끈·깃털).', '던전 들머리·위험한 곳(독 연못) 곁에 하나씩. 밑동 1칸 막힘.', brows=1)
    add('cattail', A.cattail(39), O, '부들 덤불', '가는 잎과 갈색 이삭 방망이의 부들(1x2칸).', '물가·진흙에 덩이로. 키 큰 부드러운 물체라 밑동 1칸만 막힘.', brows=1)
    add('cattail-b', A.cattail(64, 5), O, '부들 덤불 B', '이삭이 더 많은 부들.', '부들 A 와 섞는다.', brows=1)
    add('reed-tuft', A.reed_tuft(41), D, '갈대 포기', '작은 갈대 포기(1x1칸, 바닥 소품).', '물가 진흙에 흩어 심는다. 걸음(사람 아래).')
    add('reed-tuft-b', A.reed_tuft(43), D, '갈대 포기 B', '다른 갈대 포기.', '갈대 포기 A 와 섞는다.')
    add('lily-cluster', A.lily_cluster(43, True), D, '연잎과 연꽃', '홈 파인 연잎 다섯과 분홍 연꽃(2x1칸, 물 위 소품).', '잔잔한 물 위에 드문드문. 널다리 위에는 두지 않는다.')
    add('lily-pads', A.lily_cluster(47, False), D, '연잎 무리', '꽃 없는 연잎 무리.', '연꽃과 섞는다.')
    add('toxic-bubbles', A.toxic_bubbles(), D, '독 거품', '독 연못 수면의 거품(밝은 테·반짝).', '독 연못 물 위에만 2~4개.')
    add('swamp-mushrooms', A.swamp_mushrooms(31), D, '독버섯 무리', '연보라 갓 흰 점 독버섯(1x1칸, 바닥 소품).', '나무 밑·폐허 곁 진흙에 드물게. 걸음.')
    add('bones', A.bones(), D, '짐승 뼈', '흩어진 갈비·긴 뼈(1x1칸, 바닥 소품).', '독 연못·던전 깊은 곳 바닥에 드물게. 걸음.')
    add('wisp', A.wisp(23), D, '도깨비불', '푸른 초록 불덩이와 꼬리(1x1칸, 공중·사람 위).', '사당 입구·폐허 둘레에 1~2개. 위층 덧그림, 막힘 없음.')
    add('wisp-pair', A.wisp(24, 2), D, '도깨비불 둘', '작은 도깨비불 한 쌍.', '도깨비불과 섞는다.')
    add('fog-wisp', A.fog_wisp(25, 3, 2), D, '안개 자락', '성긴 디더로 그린 옅은 회녹 안개(3x2칸, 반투명, 사람 위).', '안개 섬·사당 앞 물 위에 겹쳐 덮는다. 위층 덧그림, 막힘 없음. 길 전체를 덮지 않는다.')
    add('vine-curtain', A.vine_curtain(), D, '늘어진 덩굴 발', '가지에서 드리운 덩굴과 이끼 수염(2x2칸, 사람 위).', '나무 수관·사당 처마 밑에. 위층 덧그림, 막힘 없음.')
    return pt.finish('늪 던전 (swamp-dungeon)')

_HUT = [None]
def HUT_IMG():
    if _HUT[0] is None: _HUT[0] = A.hut_ruin()
    return _HUT[0]
