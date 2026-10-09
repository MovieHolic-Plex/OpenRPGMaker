# 저택 1층 실내 지도(46×24): 대홀(큰 계단 → 위층) · 응접실 · 서재 · 식당 · 그림 복도. 극장 실내 렌더 규칙(벽 앞면 3줄,
# 칸 x 로 이어지는 앞면 무늬, 크림 몰딩 천장)을 따른다. 방은 모두 문 구멍으로 대홀과 이어진다(ㅁ자 고립 방 없음).
from mc_inside import *
import mc_inside as MI
from mc_base import _hash
import os_hall as A2, os_stage as A1, os_auto as AU

T_ = 16


class IMap(K.KMap):
    def __init__(s, *a):
        super().__init__(*a); s.under_decals = []; s.lights = []; s.under = []
    def render(s):
        s.compute_faces()
        im = Image.new('RGBA', (s.W * T, s.H * T), (0, 0, 0, 255))
        for y in range(s.H):
            for x in range(s.W):
                P = (x * T, y * T)
                if s.fl[y][x]:
                    im.alpha_composite(dlib.floor_tile(s.fl[y][x], x, y), P)
                elif (x, y) in s.face:
                    sty, k, n = s.face[(x, y)]
                    capL = (x - 1, y) not in s.face and not s.open(x - 1, y)
                    capR = (x + 1, y) not in s.face and not s.open(x + 1, y)
                    im.alpha_composite(K.op_face_tile(sty, x, n - k, capL, capR, n * T), P)
                else:
                    def op(dx, dy):
                        xx, yy = x + dx, y + dy
                        return s.inb(xx, yy) and (s.open(xx, yy) or (xx, yy) in s.face)
                    o8 = (op(0, -1), op(1, 0), op(0, 1), op(-1, 0), op(1, -1), op(1, 1), op(-1, 1), op(-1, -1))
                    im.alpha_composite(K.hall_ceiling(o8, int(_hash(x, y, 4) * 4)), P)
        for (x, y, img) in s.under_decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for cells, sheet in s.under:
            for (x, y) in cells: im.alpha_composite(K.atile_img(sheet, K.autotile_mask(cells, x, y)), (x * T, y * T))
        for (x, y, img) in s.decals: im.alpha_composite(img, (int(x * T), int(y * T)))
        for (x, y, img, w, h, layer) in sorted(s.props, key=lambda p: (p[5], p[1], p[0])):
            im.alpha_composite(img, (x * T, (y + 1) * T - img.height))
        for (px_, py_, img) in s.overlays: im.alpha_composite(img, (int(px_), int(py_)))
        s.img = im
        return im


def stair_arch_wide():
    """큰 계단 위 벽 구멍(4×3, 벽 앞면 위 장식): 크림 아치 테 + 금 쐐기돌, 안쪽은 위층으로 오르는 계단이 어둠 속에 이어진다."""
    W, H = 64, 48; im = new(W, H); p = im.load()
    for y in range(H):
        for x in range(W):
            r = math.hypot((x + .5 - 32) / 26, (H - (y + .5)) / 44)
            if r > 1: continue
            if r > .86: c = CRM[6] if x < 32 else CRM[4]
            elif r > .8: c = CRM[3]
            else:
                st = (H - y) // 6
                c = mix(MRB[4], (30, 22, 34), min(1, .25 + st * .1)) if (H - y) % 6 > 1 else mix(MRB[2], (20, 14, 26), min(1, .35 + st * .1))
                if 22 <= x < 42: c = mix(WINE[3], (24, 12, 22), min(1, .2 + st * .1))
            p[x, y] = tuple(c) + (255,)
    for x in (31, 32):
        for y in range(1, 5): p[x, y] = tuple(GOLD[5 if x == 31 else 3]) + (255,)
    return pz.fin(im)


def build(parts):
    """parts: 이름 → 그림(make 스크립트가 등록한 새 조각). 반환: (지도, 이름 붙은 지점, 문제 목록)."""
    S = parts
    m = IMap(46, 24, 'mansion-art-city-interior')
    BAD = []
    def R(x0, y0, x1, y1, kind, sty, wh=3): m.floor(x0, y0, x1 - x0 + 1, y1 - y0 + 1, kind, wh, sty)
    R(15, 3, 30, 20, 'mc_rose', 'mc_cream')                       # 대홀
    R(21, 21, 24, 23, 'mc_rose', 'mc_cream')                      # 현관 통로(남쪽 입구)
    R(1, 3, 13, 10, 'mc_herring', 'mc_cream')                     # 응접실
    R(1, 14, 13, 20, 'mc_herring', 'mc_lib')                      # 서재
    R(32, 3, 44, 11, 'op_parquet', 'op_hall')                     # 식당
    R(32, 17, 44, 20, 'mc_rose', 'mc_cream')                      # 그림 복도
    for (x, y) in ((14, 7), (14, 8), (14, 17), (14, 18), (31, 8), (31, 9), (31, 18), (31, 19)):
        m.floor(x, y, 1, 1, 'mc_rose', 3, 'mc_cream')             # 문 구멍
    def P(img, x, y, rows=1, soft=True, block=None):
        if block is None: block = K.foot(img, rows, 10, soft)
        for (bx, by) in block:
            c = (x + bx, y + by)
            if not (m.inb(*c) and m.fl[c[1]][c[0]] is not None and c not in m.blocked): BAD.append(('blk', x + bx, y + by))
        m.props_add(x, y, img, block, 1)
    def ROW(img, x, y): P(img, x, y, block=[(i, 0) for i in range(img.width // T)])
    def DEC(img, x, y): m.decal(x, y, img)
    def UP(img, x, y): m.props_add(x, y, img, [], 2)                # 천장 걸개(막힘 없음, 맨 위)
    def glowc(cx, cy, col=(255, 200, 120), size=56, a=55): m.glow_at(cx + .5, cy + .5, K.glow(size, col, a))

    # ---------------- 대홀
    m.under.append(({(x, y) for x in (22, 23) for y in range(6, 24)}, AU.carpet_sheet()))
    P(S['grand_stair'], 21, 5, block=[])
    for x in range(21, 25):
        for y in (3, 4, 5): pass
    DEC(S['stair_arch_wide'], 21, 0)
    for x in (20, 25): P(A2.urn_pedestal(), x, 5)
    for x in (17, 28):
        P(A2.marble_column(), x, 9); P(A2.marble_column(1), x, 15)
    P(A2.potted_palm(), 15, 4); P(A2.potted_palm(1), 29, 4)
    P(S['bust_pedestal_in'], 15, 12); P(S['bust_pedestal_in'], 30, 12)
    P(S['grandfather_clock'], 30, 19)
    P(S['candelabra'], 15, 19)
    P(A2.lobby_bench(2), 15, 16, block=[(0, 0), (1, 0)]); P(A2.lobby_bench(3), 29, 16, block=[(0, 0), (1, 0)])
    P(S['urn_flowers'], 19, 20); P(S['urn_flowers'], 26, 20)
    for (x, y) in ((19, 12), (26, 12)): P(S['urn_flowers'], x, y)
    P(S['armchair'], 19, 17); P(S['armchair'], 26, 17)
    DEC(S['rug_persian'], 15, 6) if False else None
    DEC(S['wall_painting_landscape'], 16, 0); DEC(S['wall_painting_sea'], 28, 0)
    DEC(A2.sconce_gold(), 19, 1); DEC(A2.sconce_gold(1), 26, 1)
    UP(A2.chandelier(), 21, 14); glowc(23, 12, size=90, a=50)
    glowc(19.5, 1.5, size=40, a=60); glowc(26.5, 1.5, size=40, a=60)
    # ---------------- 응접실
    DEC(S['rug_persian'], 3, 6)
    P(S['fireplace'], 5, 3, block=[(0, 0), (1, 0), (2, 0)]); glowc(6, 3, (255, 150, 70), 60, 70)
    P(S['armchair'], 3, 6); P(S['armchair'], 9, 6)
    P(S['tea_table'], 5, 7, block=[(0, 0), (1, 0)])
    P(S['sofa'], 4, 10, rows=1, soft=False)
    P(S['china_cabinet'], 1, 6, block=[(0, 0), (1, 0)])
    P(A1.grand_piano(), 10, 5, rows=2, soft=False)
    P(A2.potted_palm(2), 1, 3); P(S['candelabra'], 12, 10); P(S['candelabra'], 1, 10)
    DEC(S['mirror_gilt'], 10, 0); DEC(S['wall_painting_still'], 1, 0)
    DEC(A2.sconce_gold(2), 4, 1); DEC(A2.sconce_gold(3), 9, 1)
    glowc(1.5, 9.5, size=36); glowc(12.5, 9.5, size=36)
    # ---------------- 서재
    for x, sd in ((1, 0), (3, 1), (7, 2), (9, 3), (11, 4)): ROW(S['bookcase'] if sd % 2 == 0 else S['bookcase_b'], x, 14)
    DEC(S['wall_painting_abstract'], 5, 11)
    DEC(S['rug_persian'], 4, 16)
    P(S['reading_desk'], 5, 17, rows=2, soft=False)
    P(S['armchair_back'], 6, 19)
    P(S['globe'], 11, 18); P(S['armchair'], 1, 19); P(S['candelabra'], 12, 20)
    P(S['armchair'], 10, 20); P(S['tea_table'], 1, 17, block=[(0, 0), (1, 0)])
    glowc(5.5, 16.5, (190, 230, 160), 40, 50)
    # ---------------- 식당
    P(S['dining_table'], 33, 9, block=[(i, -j) for i in range(10) for j in range(3)])
    for x in (34, 36, 38, 40): P(S['dining_chair_n'], x, 7, block=[])
    for x in (34, 36, 38, 40): P(S['dining_chair_s'], x, 10)
    P(S['dining_chair_n'], 32, 8); P(S['dining_chair_n'], 43, 8)
    ROW(S['sideboard'], 36, 3)
    ROW(S['china_cabinet'], 32, 3); ROW(S['china_cabinet'], 43, 3)
    P(S['candelabra'], 39, 3); P(S['candelabra'], 35, 3)
    P(S['candelabra'], 32, 11); P(A2.potted_palm(4), 43, 11)
    DEC(S['wall_painting_landscape'], 34, 0); DEC(S['wall_painting_sea'], 40, 0)
    UP(A2.chandelier_small(), 35, 8); UP(A2.chandelier_small(1), 40, 8)
    glowc(36, 7, size=60, a=45); glowc(41, 7, size=60, a=45)
    # ---------------- 그림 복도
    for x, k in ((33, 'wall_painting_still'), (36, 'wall_painting_abstract'), (39, 'wall_painting_night'), (42, 'wall_painting_landscape')): DEC(S[k], x, 14)
    for x in (35, 38, 41): P(S['bust_pedestal_in'], x, 17)
    P(A2.lobby_bench(), 36, 20, block=[(0, 0), (1, 0)]); P(A2.lobby_bench(1), 40, 20, block=[(0, 0), (1, 0)])
    P(A2.potted_palm(5), 43, 18); P(S['grandfather_clock'], 32, 19)
    marks = dict(entrance=(22, 23), stair_top=(22, 3), drawing=(6, 9), fireplace=(6, 4), library_desk=(6, 20), globe=(11, 19),
                 dining_head=(32, 9), dining_far=(44, 9), sideboard=(37, 4), corridor_end=(44, 20))
    return m, marks, BAD
