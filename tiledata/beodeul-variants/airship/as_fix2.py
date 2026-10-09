# 적대 검수 보정(2026-10-08, tiledata/beodeul-kits/qa/airship.md 상위 1~3) — 땅 덩이 셋의 재질 가독성·반복.
#   1. autotile-deck-puddle : 회청 판 → 하늘 반사 물. 물 색 = 7단 고인 물 램프 WATER7(하늘보다 한 단 어둡게 — 하늘색 그대로면 갑판에 뚫린 구멍으로 읽힌다).
#        북·서 안 가 = 둑 그림자(WATER7[0]·[1]), 남·동 안 가 = 하늘이 비친 밝은 물가선(WATER7[6]) + 물빛·비친 구름 띠([5]·[4]·[3]), 속 = WATER7[2] 한 톤. 비친 빛 띠는 윤곽을 따라 돌아 칸 격자가 생기지 않는다.
#   2. autotile-oil-slick   : 짐승 모양 큰 구멍 → 둥근 기름 덩이. 윤곽은 공용 깊이장(autotile_edge, 볼록 모서리 반지름 7.5),
#        색은 7단 기름 램프 OILR(0 윤곽 .. 6 반짝 — 4·5 단이 보라·청록 기운) 안에서만. 무지갯빛은 윤곽을 따라 도는 테(북·서 빛 받는 쪽)라
#        1x 에서도 보이고, 속은 한 톤이라 칸 격자가 없다.
#   3. autotile-coal-dust   : 칸마다 같은 자리 석탄 알 격자 → 속(이웃 넷 다 있는 칸)에는 덩이 알을 두지 않고 1px 알갱이만(잡음으로 읽힘).
#        덩이 알은 가장자리 칸에만, 변형 번호마다 다른 자리(hash(n))에 둔다. 북쪽 가 소복한 마루 빛 · 남쪽 두께 그늘로 「쏟아진 가루 더미」.
# 칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8. 결정적. 기존 조각 이름 그대로 덮어쓴다(parts/autotile-*.png 세 장).
import math, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', '..', 'beodeul-kits'))
import numpy as np
from autotile_edge import edge_fields


def fields(n, seed, inset, jag, rad):
    m, dN, dE, dS, dW = edge_fields(n, inset=inset, jag=jag, rad=rad, seed=seed)
    st = np.stack([dN, dE, dS, dW]); side = np.array(['N', 'E', 'S', 'W'])[np.argmin(st, 0)]
    return m, np.where(st.min(0) > 90, '', side)


# ---------------------------------------------------------------- 1. 빗물 웅덩이
WATER7 = [(26, 36, 58), (38, 54, 82), (50, 72, 106), (64, 92, 132), (90, 122, 162), (140, 172, 206), (214, 230, 244)]   # 고인 물 7단(하늘보다 한 단 어둡고 짙다)
def puddle_cell(n, seed=1201):
    import as_blob as B
    from as_fix_puddle import puddle_fields                       # 감사 통과한 둥근 윤곽(bad 0.169) 그대로
    m, side = puddle_fields(n, seed)
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < -1.0: continue
            if v < 0:                                              # 칸 밖: 드문 튄 물 자국
                if B.hash2(x + n * 16, y, seed + 1) > 0.88: a[y, x] = B.WET + (100,)
                continue
            if v < 1.2:                                            # 젖어 짙어진 널 테(반투명 — 결이 비친다)
                a[y, x] = B.WET + (140 if v > 0.5 else 90,); continue
            al = 225
            if sd in ('N', 'W'):                                   # 먼 둑: 둑 그림자 → 물 속
                c = WATER7[0] if v < 2.1 else (WATER7[1] if v < 3.0 else WATER7[2])
            elif sd in ('S', 'E'):                                 # 가까운 물가: 하늘이 비친 밝은 물가선 + 물빛 + 비친 구름 띠
                if v < 1.9: c = WATER7[6]
                elif v < 2.7: c = WATER7[5]
                elif v < 3.6: c = WATER7[4]
                elif v < 4.6: c = WATER7[3]
                else: c = WATER7[2]
            else: c = WATER7[2]                                    # 속: 한 톤(점·물결 무늬 없음 — 칸 격자가 보인다)
            a[y, x] = tuple(c) + (al,)
    return B._img(a)


# ---------------------------------------------------------------- 2. 기름때
OILR = [(14, 10, 12), (26, 18, 20), (38, 28, 30), (52, 40, 44), (70, 56, 82), (66, 92, 104), (132, 146, 158)]   # 7단(4 보라·5 청록 기운)
def oil_cell(n, seed=1301):
    import as_blob as B
    m, side = fields(n, seed, inset=2.8, jag=2.2, rad=7.5)
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < -1.8: continue
            if v < 0:                                              # 둘레 튄 방울(1px, 드물게)
                if B.hash2(x + n * 16, y + n * 7, seed + 1) > 0.9: a[y, x] = OILR[2] + (200,)
                continue
            lit = sd in ('N', 'W')
            if v < 1.0:   c, al = OILR[3], 150                      # 스민 가(반투명)
            elif v < 1.8: c, al = (OILR[3] if lit else OILR[1]), 225   # 빛 받는 테 / 그늘 테
            elif v < 2.6 and lit: c, al = OILR[4], 225              # 무지갯빛 테: 보라
            elif v < 3.3 and lit: c, al = OILR[5], 225              # 무지갯빛 테: 청록
            elif v < 3.8 and lit and B.hash2(x // 3, y // 3, seed + 4) > 0.5: c, al = OILR[6], 225   # 반짝(드문 끊김)
            else: c, al = OILR[2], 195                             # 속: 한 톤, 반투명(널 결이 비쳐 구멍이 아니라 얼룩으로 읽힌다)
            a[y, x] = tuple(c) + (al,)
    return B._img(a)


# ---------------------------------------------------------------- 3. 석탄 가루
DUSTR = [(16, 14, 18), (30, 28, 34), (42, 40, 48), (56, 54, 64), (74, 72, 84), (98, 96, 110), (132, 130, 146)]   # 7단 잿빛
def coal_cell(n, seed=1401):
    import as_blob as B
    m, side = fields(n, seed, inset=2.6, jag=2.6, rad=7.0)
    a = np.zeros((16, 16, 4), np.uint8)
    for y in range(16):
        for x in range(16):
            v = m[y, x]; sd = side[y, x]
            if v < -2.0: continue
            if v < 0:                                              # 칸 밖: 드문 부스러기
                if B.hash2(x + n * 16, y, seed + 1) > 0.9: a[y, x] = DUSTR[3] + (235,)
                continue
            if v < 1.0: a[y, x] = DUSTR[2] + (150,); continue       # 얇게 깔린 가루 테
            c = DUSTR[2]                                           # 잿빛 가루(그을음 그림자보다 한 단 밝고 알갱이가 보이게)
            if sd == 'N' and v < 2.2: c = DUSTR[4]                  # 소복한 북쪽 마루(빛)
            elif sd == 'S' and v < 2.4: c = DUSTR[1]                # 남쪽 두께 그늘
            h = B.hash2(x, y, seed + 3)                            # 1px 알갱이(잡음 — 격자로 읽히지 않는다)
            if h > 0.95: c = DUSTR[5]
            elif h > 0.8: c = DUSTR[3]
            elif h < 0.12: c = DUSTR[0]
            a[y, x] = tuple(c) + (215,)
    im = B._img(a); p = im.load()
    if n != 15:                                                    # 덩이 알: 가장자리 칸에만, 변형마다 다른 자리
        for i in range(2):
            lx = int(B.hash2(n, i, seed + 7) * 13) + 1; ly = int(B.hash2(i, n, seed + 8) * 13) + 1
            if not (1.6 <= m[ly, lx] <= 6 and m[ly + 1, lx + 1] >= 1.6): continue
            for (dx, dy, k) in ((0, 0, 5), (1, 0, 3), (0, 1, 2), (1, 1, 0)):
                p[lx + dx, ly + dy] = DUSTR[k] + (255,)
    return im
