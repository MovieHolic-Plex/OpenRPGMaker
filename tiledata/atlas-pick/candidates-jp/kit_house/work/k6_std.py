# kit_house k6 — A·B 공용 그리개. 결(단 표)만 S 로 갈아 끼운다. 격자는 전부 손으로 정한 표(보간·잡음 없음).
from k6_lib import *
MAXT = dict(kawara=6, washi=5, mconc=6, hinoki=6, mglass=7, mmetal=7, mwhite=5, ishi=6, sumi=5, mdglass=7, mtile=5, akachin=6, shu=6, ai=6, moss=4)
def cl(r, t): return (r, max(0, min(MAXT[r], t)))

def build(S):
    RR = S['roof']; WR = S['wall']
    def kaw(x, y):
        cy, cx = y % 8, x % 4
        t = S['row'][cy] + (S['col'][cx] if cy != 0 else 0)
        return cl(RR, t)
    def shade(y):  # 처마·차양 밑 벽 그늘 (y = 13..15)
        return cl(WR, S['eave'][y - 13])
    def eave_tail(y, x):  # 10..15
        cx = x % 4
        if y == 10: return cl(RR, S['mk'][0] if cx < 3 else S['mk'][1])
        if y == 11: return cl(RR, S['mk'][2] if cx < 3 else S['mk'][3])
        if y == 12: return cl(RR, S['mk'][4]) if cx in (1, 2) else shade(13)
        return shade(y)
    if S.get('kaw'): kaw = S['kaw'](cl)
    if S.get('tail'): eave_tail = S['tail'](cl, shade)
    def rimL(x):  return {0: cl(RR, S['rim'][0]), 1: cl(RR, S['rim'][1]), 2: cl(RR, S['rim'][2])}.get(x)
    def rimR(x):  return {15: cl(RR, S['rim'][0]), 14: cl(RR, S['rim'][3]), 13: cl(RR, S['rim'][2])}.get(x)
    def roofcell(p, side, y0, y1, tail):
        for y in range(y0, y1):
            for x in range(16):
                if tail and y >= 10: key = eave_tail(y, x)
                else: key = kaw(x, y)
                if y < 13:
                    if side == 'l' and rimL(x): key = rimL(x)
                    if side == 'r' and rimR(x): key = rimR(x)
                p.px(x, y, key)
        if tail and side:  # 처마 끝 그늘 줄: 끝 기둥 자리도 그늘
            pass
    def ridge(p, side):
        for x in range(16):
            for y in range(5):
                t = S['ridge'][y]
                if 1 <= y <= 3 and x % 8 == 7: t -= 2
                if y == 1 and x % 8 == 0: t += 1
                p.px(x, y, cl(RR, t))
    # ---- 지붕
    P_tl, P_tm, P_tr = P('rf_tl'), P('rf_tm'), P('rf_tr')
    for p, side in ((P_tl, 'l'), (P_tm, None), (P_tr, 'r')):
        roofcell(p, side, 5, 16, False)
        for y in range(5):  # 용마루 밑 그늘 줄은 ridge 안 4행
            pass
        ridge(p, side)
    oL = ['.ooo.', 'oLLMo', 'oLMDo', 'oMMDo', 'oMDDo', '.ooo.']
    oR = ['.ooo.', 'oLMDo', 'oMDDo', 'oMDSo', 'oDDSo', '.ooo.']
    if S.get('oni'): oL, oR = S['oni']
    oleg = dict(o=cl(RR, 1), L=cl(RR, 6), M=cl(RR, 5), D=cl(RR, 3), S=cl(RR, 2))
    if S.get('oni_dark'): oleg = dict(o=cl(RR, 0), L=cl(RR, 5), M=cl(RR, 4), D=cl(RR, 2), S=cl(RR, 1))
    P_tl.art(0, 0, oL, oleg); P_tr.art(11, 0, oR, oleg)
    P_sl, P_sm, P_sr = P('rf_sl'), P('rf_sm'), P('rf_sr')
    roofcell(P_sl, 'l', 0, 16, False); roofcell(P_sm, None, 0, 16, False); roofcell(P_sr, 'r', 0, 16, False)
    for slug, side in (('rf_el', 'l'), ('rf_em', None), ('rf_er', 'r')):
        roofcell(P(slug), side, 0, 16, True)
    # ---- 벽
    def wallbase(x, y, side):
        if y >= 29:
            t = {29: S['fd'][0], 30: S['fd'][1], 31: S['fd'][2]}[y]
            if y == 30 and x % 8 == 7: t -= 1
            if side == 'l' and x == 0: t = 1
            if side == 'r' and x == 15: t = 1
            if side == 'r' and x >= 11 and x != 15: t -= 1
            return cl('mconc', t)
        if y < 2: t = S['top'][y]
        elif y % 4 == 0: t = S['lit']
        elif y % 4 == 3: t = S['groove']
        else: t = S['base']
        if side == 'l':
            if x == 0: t = 0
            elif x == 1: t = S['corner']
        if side == 'r':
            if x >= 11: t -= S['rdark']
            if x == 15: t = 0
        return cl(WR, t)
    for slug, side in (('wall_l', 'l'), ('wall_m', None), ('wall_r', 'r')):
        p = P(slug)
        for y in range(32):
            for x in range(16): p.px(x, y, wallbase(x, y, side))
    MG, MM = 'mglass', 'mmetal'
    # win_slide
    p = P('win_slide')
    for y in range(32):
        for x in range(16): p.px(x, y, wallbase(x, y, None))
    for y in range(6, 26):
        for x in range(16):
            if y == 6: key = cl(MM, S['fr'][0])
            elif y == 24: key = cl(MM, S['fr'][1])
            elif y == 25: key = cl(MM, S['fr'][2])
            elif x == 0: key = cl(MM, S['fr'][3])
            elif x == 8: key = cl(MM, S['fr'][4])
            elif x == 7: key = cl(MM, S['fr'][2])
            else:
                key = cl(MG, S['gl'][0] if y <= 8 else (S['gl'][1] if y <= 16 else S['gl'][2]))
                if x > 8 and x % 2 == 0: key = cl(MG, S['gl'][3] if y > 8 else S['gl'][0])
            p.px(x, y, key)
    for (x, y) in ((2, 13), (3, 12), (4, 11), (5, 10), (2, 17), (3, 16), (10, 14), (11, 13)):
        p.px(x, y, cl(MG, S['gl'][4]))
    for x in range(16): p.px(x, 26, cl(WR, S['sill'][0])); p.px(x, 27, cl(WR, S['sill'][1]))
    # win_small
    p = P('win_small')
    for y in range(32):
        for x in range(16): p.px(x, y, wallbase(x, y, None))
    for y in range(9, 21):
        for x in range(4, 12):
            if y in (9, 20) or x in (4, 11): key = cl(MM, S['fr'][3] if (y == 9 or x == 4) else S['fr'][2])
            else: key = cl('mwhite', S['fz'][0] if (x + y) % 4 else S['fz'][1])
            p.px(x, y, key)
    for y in range(10, 20):
        for x in (6, 9): p.px(x, y, cl(MM, S['bar']))
    for x in range(3, 13): p.px(x, 21, cl(MM, S['fr'][1])); p.px(x, 22, cl(WR, S['sill'][0]))
    # win_veranda
    p = P('win_veranda')
    for y in range(32):
        for x in range(16): p.px(x, y, wallbase(x, y, None))
    for y in range(3, 18):
        for x in range(16):
            if y == 3: key = cl(MM, S['fr'][0])
            elif x == 0: key = cl(MM, S['fr'][3])
            elif x == 8: key = cl(MM, S['fr'][4])
            elif x == 7: key = cl(MM, S['fr'][2])
            else: key = cl(MG, S['gl'][0] if y <= 6 else (S['gl'][1] if y <= 13 else S['gl'][2]))
            p.px(x, y, key)
    for (x, y) in ((2, 11), (3, 10), (4, 9), (5, 8), (10, 12), (11, 11)): p.px(x, y, cl(MG, S['gl'][4]))
    for y in range(18, 28):
        for x in range(16):
            if y == 18: key = cl(MM, S['rail'][0])
            elif y == 19: key = cl(MM, S['rail'][1])
            elif y == 27: key = cl(MM, S['rail'][2])
            elif y == 28: key = cl(MM, S['rail'][3])
            elif x % 4 == 0: key = cl(MM, S['rail'][4])
            elif x % 4 == 1: key = cl(MM, S['rail'][5])
            else: key = cl(MG, S['gl'][2])
            p.px(x, y, key)
    # genkan
    p = P('genkan'); H = 'hinoki'
    for y in range(32):
        for x in range(16):
            if y < 2: key = wallbase(x, y, None)
            elif y < 5: key = cl(H, S['lin'][y - 2])
            elif x == 0 or x == 15: key = cl(H, 1)
            elif x in (1, 14): key = cl(H, S['post'][0 if x == 1 else 1])
            elif y >= 29:
                key = cl('ishi', S['step'][y - 29])
                if x % 8 == 0: key = cl('ishi', 1)
            elif y == 28: key = cl(H, 1)
            elif y == 27: key = cl(H, S['post'][0])
            elif y >= 17:  # 아래 판벽
                key = cl(H, S['pan'][0] if x % 3 else S['pan'][1])
            elif y in (14, 15, 16):
                key = cl(H, S['rail_d'][y - 14])
            else:  # 격자 유리
                if x in (7, 8): key = cl(H, S['post'][0] if x == 7 else S['post'][1])
                elif x in (4, 11) or y in (8, 11): key = cl(H, S['post'][0] if x < 8 else S['post'][1])
                else: key = cl(MG, S['gl'][0] if y <= 8 else (S['gl'][1] if y <= 11 else S['gl'][2]))
            p.px(x, y, key)
    for (x, y) in ((2, 6), (2, 9), (9, 6), (9, 9)): p.px(x, y, cl(MG, S['gl'][4]))
    # genkan_hisashi (over, 배경 투명)
    p = P('genkan_hisashi')
    for y in range(7):
        for x in range(16):
            if y == 0 or x == 0 or x == 15: key = cl(RR, 1)
            elif y <= 4: key = kaw(x, y) if y > 1 else cl(RR, S['row'][1])
            elif y == 5: key = cl(RR, S['mk'][0] if x % 4 < 3 else S['mk'][1])
            else: key = cl(RR, 1)
            p.px(x, y, key)
    for x in range(1, 15): p.px(x, 7, '~'); p.px(x, 8, '-')
    # hisashi
    for slug, side in (('hisashi_l', 'l'), ('hisashi_m', None), ('hisashi_r', 'r')):
        roofcell(P(slug), side, 0, 16, True)
