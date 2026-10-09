from lib import *
def shaft_tones(w, hi, lo=None):
    pass
def pillar(slug, mat, shade, cap, capf, capb, band=None, note=''):
    """shade: 10칸 몸통 명암 / cap: 윗면 톤 / capf: 앞면 톤 / capb: 뒤 모서리 톤"""
    M = {'m': mat}
    if band: M['t'] = band
    c = Cv(16, 48, M)
    # 머리 윗면: 위에서 본 판(모서리 깎은 모양), 가장 밝음
    for y, (x0, x1) in enumerate([(3,12),(1,14),(1,14),(1,14),(1,14)]):
        for x in range(x0, x1+1):
            t = capb if y == 0 else cap
            if y == 4: t = cap + 1
            if x == x0 and y > 0: t = min(cap + 1, 6)
            c.p(x, y, 'm', t)
    for x in range(1, 15): c.p(x, 5, 'm', 1)            # 앞 모서리 밑 그늘(접힘)
    for y in (6, 7):
        for x in range(1, 15): c.p(x, y, 'm', capf)      # 머리 앞면
        c.p(1, y, 'm', capf + 1); c.p(14, y, 'm', capf - 1)
    for x in range(3, 13): c.p(x, 8, 'm', 1)             # 머리 밑 그늘
    # 몸통 y9~35
    for y in range(9, 36):
        for i, x in enumerate(range(3, 13)): c.p(x, y, 'm', shade[i])
    if band:
        for y0 in (12, 32):
            for y in (y0, y0+1):
                for x in range(3, 13): c.p(x, y, 't', 3 if y == y0 else 2)
            for x in range(3, 13): c.p(x, y0+2, 'm', 1)
            c.R(3, y0, 1, 2, 't', 4)
    # 기단: 윗면(밝음) 3줄 + 앞 모서리 + 앞면
    for x in range(3, 13): c.p(x, 36, 'm', 1)
    for y in (37, 38, 39):
        for x in range(2, 14): c.p(x, y, 'm', cap)
        c.p(2, y, 'm', cap + 1)
    for x in range(1, 15):
        c.p(x, 37, 'm', cap - 1) if False else None
    # 몸통이 기단에 서는 그림자 원
    for x in range(4, 12): c.p(x, 37, 'm', 2)
    for x in range(5, 11): c.p(x, 38, 'm', cap - 1)
    for x in range(1, 15): c.p(x, 40, 'm', cap + 1)      # 앞 모서리 하이라이트
    for x in range(1, 15): c.p(x, 41, 'm', 1)            # 그늘
    for y in range(42, 47):
        for x in range(1, 15): c.p(x, y, 'm', capf)
        c.p(1, y, 'm', capf + 1); c.p(14, y, 'm', capf - 1)
    for x in range(1, 15): c.p(x, 46, 'm', capf - 2)
    if band:
        for x in range(2, 14): c.p(x, 44, 't', 3)
    outline(c, 1, bt=0)
    c.save(slug, note=note)
S = [1,3,4,5,5,4,3,2,1,0]                                # 돌 몸통(왼쪽 밝음)
pillar('pillar_stone', 'vstone', S, 5, 3, 3, note='v34-A: 3/4 시점 — 머리 윗면(가장 밝음, 뒤 모서리·앞 모서리 그늘)+머리 앞면, 원기둥 몸통 명암, 기단 윗면+앞면. 같은 vstone 램프')
M2 = [1,3,4,5,6,5,4,3,2,1]
pillar('pillar_marble', 'vmarble', M2, 5, 3, 3, band='tarn', note='v34-A: 3/4 시점 — 머리 윗면(가장 밝음)+앞면, 원기둥 몸통, 청동 띠 두 줄, 기단 윗면+앞면. 같은 vmarble/tarn 램프')
