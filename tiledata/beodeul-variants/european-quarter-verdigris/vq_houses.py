# 녹청 지붕 크림 석조 저택·타운하우스 8종 + 조립 조각(지붕 끝·지붕 몸·벽 칸·다락창·굴뚝). 결정적.
# 집마다 폭·층·지붕 끝 모양·문 자리·발코니·차양·다락창 수가 다르다(같은 집 되풀이 금지). 모두 아래 받침 맞춤(층 32, 처마선 공통).
from vq_build import *
import vq_wall as WL, vq_roof as RF

def mansion_grand():
    """녹청 지붕 대저택(8칸): 3층, 가운데 아치 채광창 큰 문 + 2층 쇠 발코니, 다락창 넷(가운데 둘은 둥근 황소눈), 양 끝 굴뚝."""
    return house(8, ['SwSwwSwS', 'wBwBBwBw', 'wFwGxwFw'], roof_h=60,
                 dormers=[(24, 'point'), (52, 'point'), (76, 'point'), (104, 'point')],
                 chimneys=[(12, 12, 'stone'), (116, 12, 'stone')], balc=(1, 44, 84), seed=11)

def townhouse_narrow():
    """좁은 4층 타운하우스(3칸): 덧문 창 줄, 2층 꽃상자, 가운데 쌍문, 가파른 지붕에 다락창 하나 + 오른쪽 벽돌 굴뚝."""
    return house(3, ['SwS', 'wFw', 'HwH', 'wDw'], roof_h=46, dormers=[(24, 'point')],
                 chimneys=[(38, 10, 'brick')], seed=21, yb=.26)

def townhouse_balcony():
    """발코니 타운하우스(4칸): 3층, 2층 전체를 두른 쇠 발코니, 1층 왼쪽 문·오른쪽 가게 진열창, 다락창 둘."""
    return house(4, ['SwwS', 'BwwB', 'Dwsw'], roof_h=52, dormers=[(18, 'point'), (46, 'point')],
                 chimneys=[(56, 10, 'stone')], balc=(0, 4, 60), seed=31)

def shop_awning():
    """줄무늬 차양 가게집(5칸): 2층, 1층 진열창 넷 + 유리문(녹색·크림 줄무늬 차양), 2층 덧문 창, 다락창 둘."""
    return house(5, ['SwHwS', 'sgsss'], roof_h=46, dormers=[(24, 'point'), (56, 'point')],
                 chimneys=[(70, 10, 'brick')], awn=(2, 78), seed=41)

def coach_house():
    """마차 차고(5칸): 2층, 1층 아치 마차 문 + 옆 작은 문, 2층 둥근 창, 오른쪽은 박공 끝(서쪽만 모임지붕), 다락창 둥근 하나."""
    return house(5, ['SwnwS', 'wCxDw'], roof_h=42, ends='L', dormers=[(40, 'round')], chimneys=[(14, 8, 'stone')], seed=51)

def house_gable_end():
    """박공 끝이 길을 향한 집(4칸): 지붕 윗면(남북 용마루 두 경사) + 앞 박공 삼각벽(둥근 다락창) + 2층 앞벽 — 「옆에서 본」 집."""
    W = 64; G = 30; run = 20
    pen = Pen(W, run + G + 64)
    gf = RF.gable_front(W, run, G, seed=61, attic='round')
    for i, kinds in enumerate(['wSw' + 'w', 'FDwF']):
        WL.storey(pen, 0, run + G + i * 32, kinds, seed=61 + i * 9, ground=(i == 1))
        if i: WL.course(pen, 0, W, run + G + i * 32 - 1)
    pen.paste(gf.im, 0, 0)
    WL.course(pen, 0, W, run + G - 1, deep=False)
    WL.wall_shadow(pen, 0, W, run + G + 2, 2, (.66, .82))
    for x in range(W): pen.p(x, pen.H - 1, PLIN, 1)
    return fin(pen.im, .66)

def mansion_turret():
    """탑 저택(7칸): 왼쪽 모퉁이 둥근 탑(3층 + 원뿔 녹청 지붕) + 오른쪽 3층 몸채(덧문 창·쌍문·다락창 둘)."""
    body = house(5, ['wSwSw', 'BwFwB', 'wFDFw'], roof_h=50, ends='R', dormers=[(26, 'point'), (58, 'point')],
                 chimneys=[(66, 10, 'stone')], seed=71, quoin=(False, True))
    tw = turret(2, 3, 38, seed=72, kinds='wSw')
    Wt = 24 + body.width; Hh = max(body.height, tw.height)
    o = Image.new('RGBA', (Wt, Hh))
    o.alpha_composite(body, (24, Hh - body.height)); o.alpha_composite(tw, (0, Hh - tw.height))
    return o

def townhouse_pair():
    """키 다른 두 채 이어진 집(6칸): 왼쪽 3층(다락창 하나) + 오른쪽 4층(덧문·꽃상자), 사이 공용 굴뚝. 거리 줄을 들쭉날쭉하게."""
    a = house(3, ['SwS', 'wBw', 'DwF'], roof_h=44, ends='L', dormers=[(24, 'point')], seed=81, quoin=(True, False))
    b = house(3, ['wSw', 'SwS', 'FwF', 'wDw'], roof_h=48, ends='R', dormers=[(24, 'round')], chimneys=[(2, 12, 'brick')], seed=82, quoin=(False, True))
    Hh = max(a.height, b.height); o = Image.new('RGBA', (96, Hh))
    o.alpha_composite(a, (0, Hh - a.height)); o.alpha_composite(b, (48, Hh - b.height))
    return o

# ---------------------------------------------------------------- 조립 조각(조수가 지붕·벽을 칸 단위로 이어 새 집을 만든다)
_RM = {}
def _roof_mod():
    if 'r' not in _RM:
        W = 96; Rh = 48
        pen = Pen(W, Rh + 4)
        pen.paste(RF.roof_hip(W, Rh, 'LR', .3, e=28, seed=91).im, 0, 0)
        WL.course(pen, 0, W, Rh, deep=True)
        _RM['r'] = fin(pen.im, .66)
    return _RM['r']
def roof_end_left(): return _roof_mod().crop((0, 0, 32, 52))
def roof_span(): return _roof_mod().crop((48, 0, 64, 52))
def roof_end_right(): return _roof_mod().crop((64, 0, 96, 52))

def wall_bay(kind, ground=False, seed=93):
    """벽 한 칸(16x32, 한 층): 크림 마름돌 + kind 창/문. 모서리돌 없음(끝 칸은 wall-bay-corner)."""
    pen = Pen(16, 32)
    WL.storey(pen, 0, 0, kind, seed=seed, ground=ground, quoin=(False, False))
    return pen.im
def wall_corner(side='L', ground=False):
    pen = Pen(16, 32)
    WL.storey(pen, 0, 0, 'p', seed=95, ground=ground, quoin=(side == 'L', side == 'R'))
    return pen.im

def dormer_point(): return RF.dormer('point', 16, 30, 7)
def dormer_round(): return RF.dormer('round', 16, 18, 8)
def chimney_stone(): return RF.chimney(26, 10, 'stone', 3)
def chimney_brick(): return RF.chimney(26, 10, 'brick', 4)

HOUSES = {'mansion-grand': mansion_grand, 'townhouse-narrow': townhouse_narrow, 'townhouse-balcony': townhouse_balcony,
          'shop-awning': shop_awning, 'coach-house': coach_house, 'house-gable-end': house_gable_end,
          'mansion-turret': mansion_turret, 'townhouse-pair': townhouse_pair}
