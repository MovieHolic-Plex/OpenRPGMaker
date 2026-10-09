# 목골 구시가 건물 목록 — 큰 건물 키트(층·발코니·다락창·차양·굴뚝·내닫이 탑 변형). 결정적.
# 반환: (그림, 정보) — 정보 brows = 막히는 아랫줄 수(벽 전체 줄; 지붕·처마 칸은 걷기+가림), door = 문 칸 열(왼쪽부터 0).
from eq_house import *

def _w(im, info, door):
    info = dict(info); info['brows'] = info['wall_h'] // 16; info['door'] = door; return grade(pad16(im)), info

def house_gable_tall():
    """4칸 폭 3층 박공집: 벽돌 1층(문·창), 목골 2·3층(화분 창), 박공 다락 둥근 창, 오른쪽 경사 굴뚝."""
    im, i = gable_house(4, [('brick', 'pdwp'), ('timber', 'WpWp'), ('timber', 'SnSm')], run=30, seed=3, chimneys=[(42, 20, 12)], box_col='red')
    return _w(im, i, 1)

def house_gable_oriel():
    """5칸 폭 박공집 + 오른쪽 모퉁이 내닫이 탑(2·3층, 슬레이트 원뿔), 1층 가게 진열창·줄무늬 차양·빵 간판."""
    im, i = gable_house(5, [('brick', 'wpdsp'), ('timber', 'WpWpp'), ('timber', 'SmSpp')], run=34, seed=5, oriel=('R', 1, 2),
                        awnings=[(48, 66, 0, 'red')], chimneys=[(12, 22, 12)], box_col='yel')
    return _w(im, i, 2)

def house_gable_narrow():
    """3칸 폭 4층 좁은 박공집(벽돌 1층, 목골 3층 모두 내밀기), 다락 창 둘, 덧문 청색."""
    im, i = gable_house(3, [('brick', 'pdp'), ('timber', 'WpW'), ('timber', 'SpS'), ('timber', 'pWp')], run=24, seed=7, attic='o',
                        shutter='blu', box_col='vio')
    return _w(im, i, 1)

def house_gable_wide():
    """6칸 폭 넓은 박공집: 돌 1층 쌍 아치문, 목골 2층 화분 창 줄, 3층 엇십자 빗대, 박공 다락 창 둘, 굴뚝 둘."""
    im, i = gable_house(6, [('stone', 'wpDpww'[:6]), ('timber', 'WpWWpW'), ('timber', 'xSpxSx')], run=36, seed=11, attic='w',
                        chimneys=[(14, 26, 12), (74, 24, 14)], box_col='red', shutter='red')
    return _w(im, i, 2)

def house_eave_dormer():
    """6칸 폭 처마집(동서 용마루): 벽돌 1층·목골 2층, 앞 경사에 다락창 둘, 뒤 경사 굴뚝."""
    im, i = eave_house(6, [('brick', 'wpdpww'), ('timber', 'WkWpWk')], seed=13, dormers=[(13, 12), (63, 12)], chimneys=[(46, 0, 14)], ends='LR')
    return _w(im, i, 2)

def house_crossgable():
    """7칸 폭 처마집 + 가운데 앞으로 솟은 3칸 박공(길 쪽으로 튀어나온 박공), 1층 가게와 문, 2층 화분 창, 다락창 하나."""
    im, i = eave_house(7, [('brick', 'wpsdspw'), ('timber', 'WpWWWpW')], seed=17, gables=[(2, 3)], dormers=[(89, 14)], chimneys=[(20, 0, 14)],
                       awnings=[(34, 46, 0, 'grn'), (66, 78, 0, 'grn')], ends='LR', box_col='red')
    return _w(im, i, 3)

def bakery():
    """빵집: 5칸 처마집, 벽돌 1층 큰 진열창 둘 + 크림·적갈 차양 + 빵 걸이 간판, 목골 2층, 큰 화덕 굴뚝(넓은 벽돌), 다락창."""
    def ex(im, ytop):
        c = RF.chimney(20, 12, 31); im.alpha_composite(c, (58, 2))
    im, i = eave_house(5, [('brick', 'sdsps'), ('timber', 'WpWpW')], seed=19, dormers=[(31, 13)], awnings=[(2, 30, 0, 'crm'), (50, 78, 0, 'crm')],
                       signs=[(31, 0, 'bread', 'L')], ends='L', extra=ex, box_col='yel')
    return _w(im, i, 1)

def smithy():
    """대장간: 5칸 처마집 단층 벽돌 + 반 목골 다락, 1층 왼쪽 2칸 열린 화덕(불빛·모루), 모루 간판, 굵은 굴뚝 둘."""
    def ex(im, ytop):
        for x in (6, 52):
            c = RF.chimney(18, 10, x); im.alpha_composite(c, (x, 0))
    im, i = eave_house(5, [('brick', 'FFpdw'), ('timber', 'pWpWp')], seed=23, signs=[(54, 0, 'anvil', 'R')], ends='R', extra=ex, Rh=40)
    return _w(im, i, 3)

def inn():
    """여관: 7칸 3층 큰 집 — 벽돌 1층(쌍 아치 문·창), 목골 2층 긴 나무 발코니, 3층 덧문 창, 가운데 앞 박공, 침대 간판, 굴뚝 둘."""
    def ex(im, ytop):
        balcony(im, 18, 94, ytop + 64 - 1)
    im, i = eave_house(7, [('brick', 'wpDpwpw'), ('timber', 'pWpWpWp'), ('timber', 'SpSpSpS')], seed=29, gables=[(2, 3)], dormers=[(4, 16), (88, 16)],
                       chimneys=[(22, 0, 16), (82, 0, 14)], signs=[(100, 0, 'bed', 'R'), (10, 1, 'mug', 'L')], ends='LR', extra=ex, Rh=50, box_col='red')
    return _w(im, i, 2)

def guild_hall():
    """길드 홀: 8칸 3층 — 돌 1층 아치 회랑 넷(그늘 속), 목골 2·3층 창 줄, 가운데 앞으로 솟은 큰 박공(다락 창 둘), 양쪽 다락창, 저울 깃발 간판, 굴뚝 둘."""
    def ex(im, ytop):
        px = im.load(); W, Hh = im.size
        for (bx, col) in ((22, 'blu'), (98, 'blu')):                 # 벽에 건 길드 깃발(그림 기호 저울)
            A = AWN[col]
            for yy in range(ytop + 34, ytop + 56):
                for xx in range(bx, bx + 9):
                    if yy > ytop + 52 and abs(xx - bx - 4) < (yy - ytop - 52): continue
                    put(px, W, Hh, xx, yy, A[4] if xx < bx + 7 else A[2])
            for xx in range(bx - 1, bx + 10): put(px, W, Hh, xx, ytop + 33, WD[4])
            sign_icon(px, W, Hh, bx + 1, ytop + 38, 'scale')
    im, i = eave_house(8, [('stone', 'gpgdgpgw'[:8]), ('timber', 'WpWpWpWp'), ('timber', 'SxSpSxSp')], seed=37, gables=[(3, 2)], dormers=[(10, 16), (106, 16)],
                       chimneys=[(30, 0, 16), (90, 0, 16)], ends='LR', extra=ex, Rh=54, box_col='red', shutter='blu')
    return _w(im, i, 3)

def _tower(wc=3, storeys=4, seed=41):
    """종탑: 돌 층(아치 창·마지막 층 종실 열림) + 슬레이트 사각뿔 첨탑(pj.spire 를 슬레이트로)."""
    W = wc * 16; sp = pj.spire('sto', wc, 4).copy(); recolor(sp, lambda r, g, b: not (r > 180 and g > 140 and b < 90), SLATE)
    wall_h = storeys * 32; im = Image.new('RGBA', (W, sp.height + wall_h - 4))
    im.alpha_composite(sp, (0, 0)); ytop = sp.height - 4
    kinds = ['pap'] * (storeys - 1) + ['pbp']
    for s in range(storeys):
        WL.storey(im, 2, ytop + (storeys - 1 - s) * 32, wc, ('pdp' if s == 0 else kinds[s]), 'stone', seed + s, wpx=W - 4, base=(s == 0), eave=(s == storeys - 1))
    px = im.load(); Wd, Hd = im.size; y = ytop + 6
    for xx in range(19, 29):                                    # 종실: 종 실루엣
        for yy in range(y + 2, y + 12):
            if abs(xx - 24) <= (yy - y) * 0.5 + 0.5: put(px, Wd, Hd, xx, yy, GOLD[4] if xx < 24 else GOLD[2])
    return im, ytop

def chapel():
    """작은 성당과 종탑: 왼쪽 3칸 돌 종탑(아치 창·종실·슬레이트 첨탑) + 5칸 돌 신랑(박공에 장미창, 아치 큰 문, 높은 아치 창)."""
    tw, tytop = _tower(3, 4)
    nave, ni = gable_house(5, [('stone', 'paDpa'), ('stone', 'apapa')], run=40, seed=43, gmat='stone', attic='rose')
    W = 8 * 16; Hh = max(tw.height, nave.height)
    im = Image.new('RGBA', (W, Hh)); im.alpha_composite(nave, (3 * 16 - 2, Hh - nave.height)); im.alpha_composite(tw, (0, Hh - tw.height))
    im = fin(im)
    info = dict(wall_h=128, roof_bottom=Hh - 64); g, info = _w(im, info, 5)
    info['brows'] = 4
    return g, info

def cottage_low():
    """뒷골목 낮은 집: 4칸 단층 벽돌·목골 섞은 벽(문·창 하나), 한쪽 끝 박공널, 작은 굴뚝."""
    im, i = eave_house(4, [('timber', 'Wdpw')], seed=47, chimneys=[(40, 0, 10)], ends='R', Rh=36)
    return _w(im, i, 1)

def house_eave_jetty():
    """5칸 3층 처마집: 돌 1층, 목골 2·3층이 한 층씩 내밀어 나온다, 3층 다락창 없는 대신 큰 지붕창 둘, 문 옆 장화 간판(구두장이)."""
    im, i = eave_house(5, [('stone', 'wdpwp'), ('timber', 'SpSpS'), ('timber', 'WnWmW')], seed=53, dormers=[(13, 14), (49, 14)], chimneys=[(62, 0, 12)],
                       signs=[(66, 0, 'boot', 'R')], ends='LR', Rh=48, shutter='red', box_col='wht')
    return _w(im, i, 1)

def archway():
    """골목 위 목골 다리 방(통과 아치): 4칸 — 양쪽 벽돌 기둥, 가운데 2칸 아래는 지나다니는 아치 통로(걷기), 위는 목골 방 + 박공 지붕."""
    im, i = gable_house(4, [('brick', 'pggp'), ('timber', 'WpWp')], run=22, seed=59, attic='o', box_col='red')
    px = im.load(); W, Hh = im.size; y0 = Hh - 32
    for yy in range(y0 + 4, Hh):                                # 아치 안은 투명(통로 바닥이 보인다)
        for xx in range(18, 46):
            dy = yy - (y0 + 10)
            if dy < 0 and abs(xx + 0.5 - 32) > 13 * math.sqrt(max(0, 1 - (dy / 6.5) ** 2)): continue
            px[xx, yy] = (0, 0, 0, 0)
    for xx in range(18, 46):
        for yy in range(y0 + 3, y0 + 11):
            if px[xx, yy][3] and not px[xx, yy + 1][3]: put(px, W, Hh, xx, yy, STN[5])
    g, info = _w(im, i, None)
    info['brows'] = 1; info['note'] = 'arch'
    return g, info

BUILDINGS = {
    'house-gable-tall': (house_gable_tall, '3층 박공 목골집', '4칸 폭 박공이 길을 향한 3층 집: 벽돌 1층, 목골 2·3층(화분 창·녹색 덧문), 다락 둥근 창, 갈색 기와, 굴뚝.'),
    'house-gable-oriel': (house_gable_oriel, '내닫이 탑 박공집', '5칸 폭 박공집 오른쪽 모퉁이에 2층 높이 팔각 내닫이 탑(슬레이트 원뿔). 1층 가게 진열창과 붉은 줄무늬 차양.'),
    'house-gable-narrow': (house_gable_narrow, '좁은 4층 박공집', '3칸 폭 4층 좁은 집: 목골 세 층이 차례로 내밀어 나온다, 청색 덧문·보라 꽃 화분.'),
    'house-gable-wide': (house_gable_wide, '넓은 박공 돌기단 집', '6칸 폭 넓은 박공집: 돌 1층 쌍 아치 문, 목골 2층 화분 창 줄, 3층 엇십자 빗대, 박공 다락 창 둘, 굴뚝 둘.'),
    'house-eave-dormer': (house_eave_dormer, '다락창 처마집', '6칸 폭 처마가 길과 나란한 2층 집(동서 용마루): 앞 경사 다락창 둘, 뒤 굴뚝.'),
    'house-crossgable': (house_crossgable, '앞 박공 가게집', '7칸 폭 처마집 가운데 3칸 박공이 길 쪽으로 솟는다. 1층 진열창 둘(녹색 차양)과 문, 2층 화분 창.'),
    'house-eave-jetty': (house_eave_jetty, '내밀기 3층 처마집', '5칸 3층 처마집: 돌 1층 위로 목골 두 층이 내밀어 나오고 장화 그림 간판(구두 가게), 지붕창 둘.'),
    'bakery': (bakery, '빵집', '5칸 빵집: 벽돌 1층 큰 진열창 둘·크림 줄무늬 차양·빵 그림 걸이 간판, 목골 2층, 넓은 화덕 굴뚝.'),
    'smithy': (smithy, '대장간', '5칸 대장간: 1층 왼쪽 두 칸이 열린 화덕(불빛·모루), 모루 그림 간판, 굵은 굴뚝 둘.'),
    'inn': (inn, '여관', '7칸 3층 여관: 벽돌 1층 쌍 아치 문, 목골 2층 긴 나무 발코니, 가운데 앞 박공, 침대·술잔 그림 간판, 굴뚝 둘.'),
    'guild-hall': (guild_hall, '길드 홀', '8칸 3층 길드 홀: 돌 1층 아치 회랑, 목골 2·3층 창 줄, 가운데 앞 박공, 저울 그림 청색 깃발 둘, 굴뚝 둘.'),
    'chapel': (chapel, '종탑 작은 성당', '8칸: 왼쪽 돌 종탑(아치 창·종실·슬레이트 첨탑) + 오른쪽 돌 신랑(박공 장미창·아치 큰 문·높은 아치 창), 갈색 기와.'),
    'cottage-low': (cottage_low, '뒷골목 낮은 집', '4칸 단층 목골 오두막: 창 둘·문, 작은 굴뚝, 한쪽 박공널. 뒷골목·마당 가.'),
    'archway': (archway, '골목 다리 방 아치', '4칸: 양쪽 벽돌 기둥 사이 아치 통로(가운데 2칸 걷기), 위는 목골 다리 방과 박공 지붕. 골목 입구·거리 끝 문.'),
}
