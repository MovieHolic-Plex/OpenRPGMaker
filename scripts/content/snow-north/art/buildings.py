#!/usr/bin/env python3
"""snow_north 건물 — 통나무 오두막·긴집·회관·목조 교회·사우나·훈제막·얼음 낚시 오두막·얼음집·망루·창고·물방앗간·헛간·
목책 문·얼음 동굴 입구·얼어붙은 폭포.

통짜 그림이지만 재질 무늬는 캔버스 좌표 결정적이라 같은 재질 칸은 굽기에서 화소 그대로 겹쳐 한 칸을 나눠 쓴다.
3/4 탑뷰: 지붕(눈 덮인 남쪽 경사면 = 위에서 보이는 큰 밝은 면, 뒤 가장자리 먹 선) + 남쪽 앞면 벽 한 겹(어둡게).
한 층 = 2줄(32px), 문 틀 높이 26~27px(사람 24px). 문 칸은 맨 아랫줄, 그 아래 칸이 접근칸.

  python3 buildings.py      # tiledata/snow-north/buildings/_gate/*.png + preview
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, box3, cyl_v, disc
from kit import Reg, contact, OUT
from bparts import (log_wall, plank_wall, stone_plinth, drift_base, window, door, icicles, roof_gable, eave_shadow,
                    finial, chimney, stovepipe, roof_snow_px, door2, lantern_wall, shield, sign_mug, pyramid, leg)

R = Reg('buildings')


def add(id_, name, W, H, door_cells, tags, rules, kind='structure', **meta):
    def deco(fn):
        R.add(id_, name, W, H, kind, tags=tags, rules=rules, entrance=list(door_cells), **meta)(fn)
        return fn
    return deco


# ═══════════════════════ 통나무 오두막 계열 ═══════════════════════
def log_house(c, W, H, door_cx, wins, chim=None, shutter='red', under='shingle', s=0, fin=True, wall='log', paint='log', door_w=13):
    """W×H 칸. 맨 아래 2줄 = 벽(32px), 그 위 = 지붕. door_cx = 문 칸 x(문은 그 칸 가운데). wins = 창 칸 x 목록(칸 가운데)."""
    WP, HP = W * 16, H * 16
    wall_top = HP - 32
    wx0, ww = 3, WP - 6
    if wall == 'log': log_wall(c, wx0, wall_top, ww, 29, s=s)
    else: plank_wall(c, wx0, wall_top, ww, 29, mat=wall, base=3, s=s)
    stone_plinth(c, wx0, HP - 4, ww, 3, s)
    eave_shadow(c, wx0 - 2, wall_top + 5, ww + 4, 3)
    for k, wxc in enumerate(wins):
        window(c, wxc * 16 + 4, wall_top + 11, 8, 9, shutter=shutter, lit=h32(k, s, 3) % 4 != 0)
    dx = door_cx * 16 + (16 - door_w) // 2
    door(c, dx, HP - 2, w=door_w, h=27, paint=paint)
    drift_base(c, wx0, HP - 1, ww, skip=[(dx - 1, dx + door_w + 1)], s=s)
    ry0 = 8
    roof_gable(c, 1, ry0, WP - 2, wall_top - ry0 + 5, s=s, under=under, peeks=max(1, W // 2))
    if chim is not None:
        cx = chim * 16 + 4
        chimney(c, cx, ry0 - 6, 7, 13)
    if fin:
        finial(c, 4, ry0 + 1, 'L'); finial(c, WP - 5, ry0 + 1, 'R')


@add('cabin-s', '작은 통나무 오두막(폭 3, 붉은 덧문·돌 굴뚝)', 3, 4, [1], ['오두막', '집', '통나무'],
     '마을 가장자리·숲가 집. 문 앞(접근칸)부터 눈길을 잇는다. 굴뚝 연기(sn-smoke)는 굴뚝 칸 바로 위에 따로 놓는다.', chim_cell=[2, 0])
def _(c): log_house(c, 3, 4, 1, [0, 2], chim=2, shutter='red', s=1)


@add('cabin-m', '통나무 집(폭 4, 푸른 덧문)', 4, 4, [1], ['오두막', '집', '통나무'],
     '마을 길가 집. 문 앞 눈길. 집 둘레 1칸은 장작더미·썰매 정도만.', chim_cell=[3, 0])
def _(c): log_house(c, 4, 4, 1, [0, 2, 3], chim=3, shutter='blue', s=2)


@add('cabin-l', '큰 통나무 집(폭 5, 너와 지붕 깊음)', 5, 5, [2], ['집', '통나무', '촌장'],
     '마을 가운데 큰 집(촌장·대장장이). 문 앞 2칸 비움.', chim_cell=[0, 0])
def _(c): log_house(c, 5, 5, 2, [0, 1, 3, 4], chim=0, shutter='red', s=3)


@add('cabin-turf', '뗏장 지붕 오두막(폭 3, 회색 판자 벽)', 3, 4, [1], ['오두막', '집', '뗏장'],
     '숲속·호숫가 외딴 집.', chim_cell=[0, 0])
def _(c): log_house(c, 3, 4, 1, [2], chim=0, shutter=None, under='turf', s=4, wall='drift', fin=False)


# ═══════════════════════ 긴집·회관 ═══════════════════════
@add('longhouse', '긴집(폭 7, 뗏장·눈 지붕, 연기 창, 조각 양개문)', 7, 5, [3], ['긴집', '집', '씨족', '통나무'],
     '마을 중심 씨족 집. 문 앞 2칸 광장. 연기는 지붕 가운데 연기 창 위.', smoke_cell=[3, 0])
def _(c):
    W, H = 7, 5; WP, HP = W * 16, H * 16; wall_top = HP - 32
    plank_wall(c, 3, wall_top, WP - 6, 29, mat='log', base=2, s=5, bw=3)
    stone_plinth(c, 3, HP - 4, WP - 6, 3, 5)
    eave_shadow(c, 1, wall_top + 5, WP - 2, 3)
    for X in (16, 80): window(c, X + 4, wall_top + 11, 8, 8, shutter=None, lit=True)
    for X in (36, 92): shield(c, X, wall_top + 15, 'red' if X < 50 else 'wool')
    door2(c, 3 * 16 - 4, HP - 2, w=24, h=27, paint='log')
    drift_base(c, 3, HP - 1, WP - 6, skip=[(3 * 16 - 6, 3 * 16 + 22)], s=5)
    roof_gable(c, 1, 8, WP - 2, wall_top - 8 + 5, s=6, under='turf', peeks=4, inset=5)
    # 연기 창(용마루 가운데 덮개 — 윗면 + 그 아래 검은 틈)
    cx = WP // 2 - 6
    c.R(cx, 7, 12, 3, 'log', 3); c.HL(cx, 7, 12, 'snow', 6); c.HL(cx, 10, 12, 'ink', 0); c.HL(cx + 1, 11, 10, 'log', 1)
    c.VL(cx, 7, 5, 'ink', 1); c.VL(cx + 11, 7, 5, 'ink', 1)
    finial(c, 6, 9, 'L'); finial(c, WP - 7, 9, 'R')


@add('meadhall', '회관 선술집(폭 6, 두 층 높이, 양개문·걸이 간판·등)', 6, 6, [2, 3], ['선술집', '회관', '여관', '통나무'],
     '광장 북쪽 큰 건물. 문 앞 2칸 광장, 양옆 등. 간판에 글자 없음.', chim_cell=[5, 0])
def _(c):
    W, H = 6, 6; WP, HP = W * 16, H * 16; wall_top = HP - 48
    log_wall(c, 3, wall_top, WP - 6, 45, s=7)
    stone_plinth(c, 3, HP - 4, WP - 6, 3, 7)
    eave_shadow(c, 1, wall_top + 5, WP - 2, 3)
    # 위층 창 줄(덧문 붉게) + 아래층 창
    for X in (0, 1, 4, 5): window(c, X * 16 + 4, wall_top + 12, 8, 7, shutter='red', lit=X != 4)
    for X in (0, 5): window(c, X * 16 + 4, wall_top + 29, 8, 8, shutter=None, lit=True)
    # 층 띠(가로 들보 + 눈 한 줄)
    c.R(3, wall_top + 23, WP - 6, 3, 'log', 2); c.HL(3, wall_top + 23, WP - 6, 'log', 5); c.HL(3, wall_top + 22, WP - 6, 'snow', 6)
    door2(c, 2 * 16 + 4, HP - 2, w=24, h=27, paint='red')
    lantern_wall(c, 2 * 16 - 6, wall_top + 26); lantern_wall(c, 4 * 16 + 4, wall_top + 26)
    sign_mug(c, 4 * 16 + 10, wall_top + 10)
    drift_base(c, 3, HP - 1, WP - 6, skip=[(2 * 16 + 2, 4 * 16 + 6)], s=7)
    roof_gable(c, 1, 8, WP - 2, wall_top - 8 + 5, s=8, under='shingle', peeks=3, inset=4)
    chimney(c, 5 * 16 + 1, 2, 7, 13)
    finial(c, 6, 9, 'L'); finial(c, WP - 7, 9, 'R')


# ═══════════════════════ 목조 교회(층층 지붕) ═══════════════════════
@add('stave-church', '목조 교회·전당(층층 너와 지붕, 뾰족탑, 용머리 박공)', 5, 8, [2], ['교회', '전당', '목조', '사원'],
     '마을 북쪽 언덕·광장 끝. 문 앞 2칸 판석 마당. 둘레에 돌 비석·가문비나무.', kind='structure')
def _(c):
    W, H = 5, 8; WP, HP = W * 16, H * 16
    # 1층 회랑 벽(타르 칠 판자) + 회랑 지붕
    wt = HP - 30
    plank_wall(c, 4, wt, WP - 8, 27, mat='log', base=1, s=9, bw=3)
    stone_plinth(c, 4, HP - 4, WP - 8, 3, 9)
    for X in (10, WP - 18): window(c, X, wt + 11, 7, 9, shutter=None, lit=True)
    door(c, WP // 2 - 7, HP - 2, w=14, h=27, paint='log', arch=True)
    # 문 둘레 조각 기둥(엮음 무늬)
    for X in (WP // 2 - 10, WP // 2 + 7):
        for j in range(HP - 28, HP - 3):
            c.P(X, j, 'log', 4 if (j + X) % 3 else 2); c.P(X + 1, j, 'log', 2 if (j + X) % 3 else 4); c.P(X + 2, j, 'log', 1)
    drift_base(c, 4, HP - 1, WP - 8, skip=[(WP // 2 - 11, WP // 2 + 11)], s=9)
    roof_gable(c, 0, HP - 50, WP, 24, s=10, under='shingle', peeks=2, inset=3, ice_len=4)
    # 2층(좁은 벽 + 지붕)
    w2 = WP - 24; x2 = 12; wt2 = HP - 62
    plank_wall(c, x2 + 2, wt2, w2 - 4, 14, mat='log', base=1, s=11, bw=3)
    for X in range(x2 + 6, x2 + w2 - 6, 8): c.R(X, wt2 + 5, 3, 6, 'lit', 2); c.P(X + 1, wt2 + 5, 'lit', 4)
    roof_gable(c, x2 - 2, HP - 84, w2 + 4, 24, s=12, under='shingle', peeks=1, inset=3, ice_len=3)
    # 3층 종탑 + 뾰족탑
    w3 = 20; x3 = WP // 2 - w3 // 2; wt3 = HP - 92
    plank_wall(c, x3 + 3, wt3, w3 - 6, 10, mat='log', base=1, s=13, bw=2)
    c.R(x3 + 6, wt3 + 3, 8, 5, 'ink', 0); c.R(x3 + 8, wt3 + 4, 4, 3, 'brass', 2)
    pyramid(c, WP / 2 - 0.5, 8, wt3 + 1, 11)
    for (X, Y, sd) in ((2, HP - 49, 'L'), (WP - 3, HP - 49, 'R'), (x2, HP - 83, 'L'), (x2 + w2 - 1, HP - 83, 'R')):
        finial(c, X + (2 if sd == 'L' else -2), Y, sd)


# ═══════════════════════ 작은 집들 ═══════════════════════
@add('sauna', '사우나 오두막(뗏장 지붕, 붉은 문, 쇠 연통)', 3, 4, [1], ['사우나', '목욕', '오두막'],
     '호숫가·개울가. 문 앞 판자 길, 옆에 물통·장작. 연기는 연통 위.', smoke_cell=[2, 0])
def _(c):
    W, H = 3, 4; WP, HP = 48, 64; wt = HP - 32
    log_wall(c, 3, wt, WP - 6, 29, s=14)
    stone_plinth(c, 3, HP - 4, WP - 6, 3, 14)
    eave_shadow(c, 1, wt + 5, WP - 2, 3)
    window(c, 32, wt + 12, 6, 6, shutter=None, lit=True)
    door(c, 13, HP - 2, w=13, h=27, paint='red')
    drift_base(c, 3, HP - 1, WP - 6, skip=[(12, 27)], s=14)
    roof_gable(c, 1, 12, WP - 2, wt - 12 + 5, s=15, under='turf', peeks=2, inset=3)
    stovepipe(c, 34, 3, 12)


@add('smokehouse', '훈제막(회색 판자, 연기 새는 지붕 틈)', 2, 3, [0], ['훈제', '생선', '창고'],
     '부두·어부 집 곁. 옆에 생선 건조대(sn-fish-rack).', smoke_cell=[1, 0])
def _(c):
    WP, HP = 32, 48; wt = HP - 30
    plank_wall(c, 2, wt, WP - 4, 27, mat='drift', base=3, s=16)
    stone_plinth(c, 2, HP - 4, WP - 4, 3, 16)
    eave_shadow(c, 1, wt + 4, WP - 2, 3)
    door(c, 3, HP - 2, w=12, h=25, paint='drift', lit_gap=False)
    for y in (wt + 8, wt + 14): c.HL(19, y, 9, 'ink', 0); c.HL(19, y + 1, 9, 'drift', 1)
    drift_base(c, 2, HP - 1, WP - 4, skip=[(2, 16)], s=16)
    roof_gable(c, 0, 8, WP, wt - 8 + 5, s=17, under='drift', peeks=1, inset=2, cornice=4)
    for X in (8, 20): c.HL(X, 9, 5, 'ink', 0)


@add('fishing-hut', '얼음 낚시 오두막(썰매 밑판, 외쪽 지붕, 연통)', 2, 3, [0], ['낚시', '얼음', '호수', '오두막'],
     '얼어붙은 호수 위(얼음 바닥 sn-at-ice 몸통 칸 위). 문 앞 얼음에 낚시 구멍·의자. 둘레 1칸 비움.', smoke_cell=[1, 0])
def _(c):
    WP, HP = 32, 48; wt = HP - 30
    plank_wall(c, 2, wt, WP - 4, 25, mat='drift', base=3, s=18)
    # 썰매 밑판(나무 날 + 앞 말림)
    c.R(1, HP - 5, WP - 2, 2, 'log', 2); c.HL(1, HP - 5, WP - 2, 'log', 4); c.HL(0, HP - 3, WP, 'log', 1)
    c.P(0, HP - 4, 'log', 3); c.P(WP - 1, HP - 4, 'log', 1)
    eave_shadow(c, 1, wt + 3, WP - 2, 2)
    door(c, 3, HP - 4, w=12, h=24, paint='blue', lit_gap=True)
    window(c, 19, wt + 9, 7, 6, shutter=None, lit=True)
    roof_gable(c, 0, 10, WP, wt - 10 + 4, s=19, under='drift', peeks=1, inset=1, cornice=4, ice_len=3)
    stovepipe(c, 22, 1, 12)


@add('ice-house', '얼음집(얼음 벽돌 둥근 집, 아치 입구)', 4, 4, [1, 2], ['얼음집', '얼음', '돔'],
     '얼음 들판·호숫가. 입구 아치 2칸 앞을 비운다. 둘레 눈더미.')
def _(c):
    WP, HP = 64, 64
    cx, cy, rx, ry = 31.5, 33, 30, 25
    tx, ty = 26.0, 21.0                      # 꼭대기(위에서 본 돔의 가장 높은 점 — 왼쪽 위로 치우침)
    # 몸통 = 위에서 본 돔: 꼭대기를 둘러싼 동심 벽돌 고리(가까울수록 밝다) + 고리마다 엇갈린 이음
    def body(X, Y, dx, dy, d):
        if Y > HP - 6: return None
        ddx = (X + 0.5 - tx) / rx; ddy = (Y + 0.5 - ty) / ry
        r = math.sqrt(ddx * ddx + ddy * ddy * 1.15)
        ring = int(r * 7.0)
        ang = math.atan2(ddy, ddx)
        seg = int((ang + math.pi) / (2 * math.pi) * (10 + ring * 4) + (0.5 if ring % 2 else 0))
        fr = (r * 7.0) % 1
        fa = ((ang + math.pi) / (2 * math.pi) * (10 + ring * 4) + (0.5 if ring % 2 else 0)) % 1
        t = 6 if r < 0.18 else 5 if r < 0.42 else 4 if r < 0.7 else 3
        if dx > 0.35 and dy > -0.2: t -= 1
        if dy > 0.55: t -= 1
        if (fr < 0.14 or fa < 0.09) and r > 0.15: return ('ice', max(2, t - 1))
        return ('snow', max(2, min(6, t + (1 if r < 0.7 else 0))))
    c.ell(cx, cy, rx, ry, body)
    c.ell(tx, ty, 7, 4.5, lambda X, Y, dx, dy, d: ('snow', 6 if dx + dy < 0 else 5))
    c.ell(cx, cy, rx, ry, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.9 and Y < HP - 5 else None)
    # 입구 굴(앞으로 튀어나온 작은 반원통) + 어두운 아치
    ex0, ew = 18, 28
    for j in range(HP - 30, HP - 2):
        for i in range(ew):
            u = (i + 0.5) / ew
            top = HP - 30 + int(round(8 * (1 - math.sin(math.pi * u))))
            if j < top: continue
            t = 5 if u < 0.25 else 4 if u < 0.6 else 3 if u < 0.85 else 2
            if (j - top) % 6 == 0 or (i + (3 if ((j - top) // 6) % 2 else 0)) % 7 == 0: t -= 2
            c.P(ex0 + i, j, 'ice', max(1, t))
        c.P(ex0, j, 'ink', 1); c.P(ex0 + ew - 1, j, 'ink', 1)
    for i in range(ew):
        u = (i + 0.5) / ew
        top = HP - 30 + int(round(8 * (1 - math.sin(math.pi * u))))
        c.P(ex0 + i, top, 'snow', 6 if u < 0.6 else 4); c.P(ex0 + i, top - 1, 'ink', 1)
    ax0, aw = 22, 20
    for j in range(HP - 24, HP - 2):
        for i in range(aw):
            u = (i + 0.5) / aw
            top = HP - 24 + int(round(5 * (1 - math.sin(math.pi * u))))
            if j >= top: c.P(ax0 + i, j, 'ink', 0 if (j - top) > 2 else 1)
    for i in range(aw):
        u = (i + 0.5) / aw
        c.P(ax0 + i, HP - 24 + int(round(5 * (1 - math.sin(math.pi * u)))) - 1, 'ice', 6 if u < 0.5 else 5)
    c.R(ax0 + 6, HP - 8, 8, 6, 'fur', 2); c.HL(ax0 + 6, HP - 8, 8, 'fur', 3)            # 안쪽 모피 깔개 빛
    c.HL(ax0 + 2, HP - 18, 4, 'lit', 1); c.HL(ax0 + 13, HP - 15, 3, 'lit', 1)
    drift_base(c, 2, HP - 1, WP - 4, skip=[(ex0 - 1, ex0 + ew + 1)], s=20, hmax=4)


# ═══════════════════════ 망루·창고 ═══════════════════════
@add('watchtower', '망루(통나무 다리·사다리·눈 지붕 감시대)', 3, 6, [], ['망루', '감시탑', '목책'],
     '목책 모퉁이·마을 어귀. 다리 사이로는 못 지나간다(다리 칸 막힘). 사다리 앞 1칸 비움.', kind='structure')
def _(c):
    WP, HP = 48, 96
    # 다리 넷(앞 둘이 굵게 보인다) + X 버팀
    for X in (6, 38):
        leg(c, X, 44, HP - 4, 5)
        c.R(X - 1, HP - 5, 7, 3, 'stone', 4); c.HL(X - 1, HP - 5, 7, 'stone', 5); c.HL(X - 1, HP - 3, 7, 'stone', 2)
    for (x0, y0, x1, y1) in ((10, 50, 38, 74), (38, 50, 10, 74), (10, 74, 38, 90), (38, 74, 10, 90)):
        for k in range(2): c.line(x0, y0 + k, x1, y1 + k, 'log', 3 if k == 0 else 1)
    c.R(10, 73, 28, 3, 'log', 3); c.HL(10, 73, 28, 'log', 5); c.HL(10, 72, 28, 'snow', 6)
    # 사다리(가운데)
    for X in (20, 27): c.VL(X, 44, HP - 48, 'log', 4); c.VL(X + 1, 44, HP - 48, 'log', 2)
    for Y in range(48, HP - 4, 5): c.HL(21, Y, 6, 'log', 5); c.HL(21, Y + 1, 6, 'log', 1)
    # 감시대: 바닥 판 윗면(눈) + 난간 앞면 + 기둥 + 지붕
    c.R(2, 34, WP - 4, 10, 'drift', 3)
    for X in range(2, WP - 2):
        for Y in range(34, 44):
            t = 4 if Y < 36 else 3 if (X % 4) else 1
            if Y > 41: t = 1
            c.P(X, Y, 'log', t)
    for X in range(2, WP - 2, 4): c.VL(X, 35, 6, 'log', 5); c.VL(X + 1, 35, 6, 'log', 2)
    c.HL(2, 34, WP - 4, 'log', 5); c.HL(1, 33, WP - 2, 'snow', 6); c.HL(2, 44, WP - 4, 'ink', 1)
    c.VL(2, 34, 10, 'ink', 1); c.VL(WP - 3, 34, 10, 'ink', 1)
    for X in (4, WP - 8): leg(c, X, 22, 33, 4)
    c.R(8, 24, WP - 16, 10, 'ink', 0)                         # 지붕 밑 어둠
    c.HL(10, 30, 4, 'fire', 3); c.HL(11, 31, 2, 'fire', 4)    # 감시대 안 화로 불빛
    roof_gable(c, 0, 6, WP, 20, s=21, under='shingle', peeks=1, inset=4, cornice=4, ice_len=4)
    finial(c, 6, 7, 'L'); finial(c, WP - 7, 7, 'R')


@add('storehouse', '고상 창고(돌 버섯 기둥 위, 위층이 내민 판자 창고)', 3, 5, [1], ['창고', '곡식', '고상'],
     '집 뒤뜰·마을 가장자리. 계단 앞 1칸 비움.')
def _(c):
    WP, HP = 48, 80
    # 아래: 돌 버섯 기둥 넷(앞 둘) + 그늘 속 바닥
    c.R(6, HP - 22, WP - 12, 18, 'ink', 1)
    for X in (5, 37):
        c.R(X, HP - 22, 6, 18, 'stone', 3); c.VL(X, HP - 22, 18, 'stone', 4); c.VL(X + 5, HP - 22, 18, 'stone', 1)
        c.R(X - 2, HP - 24, 10, 3, 'stone', 5); c.HL(X - 2, HP - 24, 10, 'snow', 6)
    # 계단(나무, 가운데 앞으로)
    for k in range(5):
        c.R(17, HP - 4 - k * 4, 14, 3, 'log', 4 - (k % 2)); c.HL(17, HP - 4 - k * 4, 14, 'snow', 6 if k % 2 == 0 else 5)
    # 아래층 벽(통나무) + 위층 내민 판자 벽
    log_wall(c, 4, HP - 44, WP - 8, 20, s=22)
    c.R(13, HP - 40, 22, 17, 'ink', 0); c.R(14, HP - 39, 20, 16, 'log', 2)
    for X in range(14, 34, 4): c.VL(X, HP - 39, 16, 'log', 1)
    c.R(14, HP - 39, 20, 2, 'iron', 2)
    eave_shadow(c, 2, HP - 44, WP - 4, 2)
    c.R(1, HP - 50, WP - 2, 6, 'log', 2); c.HL(1, HP - 50, WP - 2, 'log', 4); c.HL(1, HP - 45, WP - 2, 'ink', 1)
    plank_wall(c, 2, HP - 62, WP - 4, 12, mat='log', base=3, s=23, bw=3)
    for X in (8, 30): c.R(X, HP - 58, 8, 3, 'red', 2); c.HL(X, HP - 58, 8, 'red', 4)
    roof_gable(c, 0, 6, WP, 24, s=24, under='shingle', peeks=1, inset=3, cornice=4, ice_len=3)
    finial(c, 5, 7, 'L'); finial(c, WP - 6, 7, 'R')
    drift_base(c, 2, HP - 1, WP - 4, skip=[(15, 33)], s=22, hmax=4)


# ═══════════════════════ 일터 ═══════════════════════
@add('mill', '물방앗간(통나무, 얼어붙은 나무 물길·멈춘 물레 덮개)', 5, 5, [1], ['방앗간', '물레', '곡식'],
     '개울(얼음 강) 곁. 물길 끝이 강을 향하게. 문 앞 1칸 비움.', chim_cell=[1, 0])
def _(c):
    WP, HP = 80, 80; wt = HP - 32
    log_wall(c, 3, wt, 54, 29, s=25)
    stone_plinth(c, 3, HP - 4, 54, 3, 25)
    eave_shadow(c, 1, wt + 5, 58, 3)
    window(c, 40, wt + 11, 8, 8, shutter='red', lit=True)
    door(c, 17, HP - 2, w=13, h=27, paint='log')
    drift_base(c, 3, HP - 1, 54, skip=[(16, 31)], s=25)
    roof_gable(c, 1, 8, 58, wt - 8 + 5, s=26, under='shingle', peeks=2, inset=3)
    chimney(c, 20, 2, 7, 13)
    finial(c, 5, 9, 'L'); finial(c, 54, 9, 'R')
    # 물레 덮개(동쪽 벽에 붙은 판자 상자 — 윗면 눈 + 앞면 판자) + 얼어붙은 나무 물길(북→남 기둥 위)
    box_x, box_y = 60, 40
    plank_wall(c, box_x, box_y + 10, 16, 26, mat='drift', base=3, s=27)
    c.R(box_x - 1, box_y, 18, 10, 'snow', 5); c.HL(box_x - 1, box_y, 18, 'snow', 6); c.HL(box_x - 1, box_y + 9, 18, 'snow', 3)
    c.VL(box_x - 1, box_y, 36, 'ink', 1); c.VL(box_x + 16, box_y, 36, 'ink', 1)
    c.R(box_x + 2, box_y + 16, 12, 12, 'ink', 0)
    for k in range(4): c.R(box_x + 3 + k * 3, box_y + 17, 2, 10, 'log', 3 - (k % 2))          # 물레 날개(틈으로 보임)
    c.HL(box_x + 2, box_y + 28, 12, 'ice', 6)
    for k, X in enumerate(range(box_x + 2, box_x + 14, 2)):                       # 덮개 위로 흘러내리다 언 물
        ln = 3 + (k * 5) % 4
        for j in range(ln): c.P(X, box_y + 10 + j, 'ice', 6 if j == 0 else 5)
    drift_base(c, box_x, HP - 1, 16, s=27, hmax=3)


@add('barn', '헛간(회색 판자, 큰 양개문, 건초 다락)', 5, 5, [2], ['헛간', '마구간', '농가'],
     '마을 가장자리 들판 쪽. 문 앞 2칸 진창(sn-at-slush) 마당.')
def _(c):
    WP, HP = 80, 80; wt = HP - 40
    plank_wall(c, 3, wt, WP - 6, 37, mat='drift', base=3, s=28)
    stone_plinth(c, 3, HP - 4, WP - 6, 3, 28)
    eave_shadow(c, 1, wt + 5, WP - 2, 3)
    # 건초 다락 문(위) + 걸린 도르래
    c.R(32, wt + 8, 16, 10, 'ink', 0); c.R(33, wt + 12, 14, 6, 'straw', 2)
    for X in range(33, 47, 2): c.P(X, wt + 12, 'straw', 3)
    c.HL(31, wt + 7, 18, 'log', 3); c.HL(30, wt + 6, 20, 'snow', 6)
    door2(c, 28, HP - 2, w=24, h=27, paint='red')
    for X in (8, 64): window(c, X, wt + 22, 7, 6, shutter=None, lit=False)
    drift_base(c, 3, HP - 1, WP - 6, skip=[(26, 54)], s=28)
    roof_gable(c, 1, 6, WP - 2, wt - 6 + 5, s=29, under='drift', peeks=3, inset=4)


@add('smithy', '대장간(돌 화덕 굴뚝, 열린 앞 차양, 모루 불빛)', 4, 4, [1], ['대장간', '대장장이', '공방'],
     '광장·길가. 문 앞 1칸 비움, 차양 밑 앞은 작업 마당(진창 또는 판석).', chim_cell=[3, 0])
def _(c):
    WP, HP = 64, 64; wt = HP - 32
    log_wall(c, 3, wt, WP - 6, 29, s=30)
    stone_plinth(c, 3, HP - 4, WP - 6, 3, 30)
    eave_shadow(c, 1, wt + 5, WP - 2, 3)
    door(c, 18, HP - 2, w=13, h=27, paint='log')
    # 화덕 창(불빛 아궁이) 동쪽
    c.R(38, wt + 12, 18, 14, 'stone', 3); c.HL(38, wt + 12, 18, 'stone', 5); c.VL(55, wt + 12, 14, 'stone', 1)
    c.R(41, wt + 16, 12, 8, 'ink', 0)
    for X in range(42, 52):
        for Y in range(wt + 18, wt + 24):
            c.P(X, Y, 'fire', 4 if (Y > wt + 21 and 44 < X < 50) else 3 if Y > wt + 19 else 2)
    drift_base(c, 3, HP - 1, WP - 6, skip=[(17, 32), (36, 58)], s=30)
    roof_gable(c, 1, 8, WP - 2, wt - 8 + 5, s=31, under='shingle', peeks=1, inset=3)
    chimney(c, 45, 0, 9, 15)


# ═══════════════════════ 목책 문·자연 지형 구조물 ═══════════════════════
def palisade_log(c, x, ytop, ybot, w=5, s=0):
    """끝을 뾰족하게 깎은 세운 통나무(윗면 = 깎은 단면 밝게 + 눈 모자)."""
    for j in range(ytop + 3, ybot + 1):
        for i in range(w):
            u = (i + 0.5) / w
            t = 5 if u < 0.3 else 4 if u < 0.6 else 3 if u < 0.85 else 2
            if (j + h32(x, s, 3)) % 9 == 0 and 0 < i < w - 1: t -= 1
            c.P(x + i, j, 'log', t)
    for k in range(3):
        for i in range(k, w - k): c.P(x + i, ytop + 2 - k, 'log', 6 if i < w // 2 else 4)
    c.P(x + w // 2, ytop - 1, 'snow', 6); c.P(x + w // 2 - 1, ytop, 'snow', 5); c.P(x + w // 2 + 1, ytop, 'snow', 5)
    c.VL(x - 1, ytop + 2, ybot - ytop - 1, 'ink', 1)


@add('palisade-gate', '목책 문(통나무 기둥 둘·지붕 얹은 문루, 문짝 열림)', 4, 4, [], ['목책', '문', '마을 어귀'],
     '목책(sn-palisade) 줄 가운데. 가운데 2칸은 지나다닌다(기둥 칸만 막힘). 바깥·안 양쪽에 눈길을 잇는다.', solid_cells=[[0, 3], [3, 3], [0, 2], [3, 2]])
def _(c):
    WP, HP = 64, 64
    for X in (1, 6, 51, 56):
        palisade_log(c, X, 16, HP - 3, 6, X)
    # 가로 들보 + 작은 지붕(문루)
    c.R(4, 20, 56, 5, 'log', 3); c.HL(4, 20, 56, 'log', 5); c.HL(4, 24, 56, 'log', 1)
    for X in range(6, 58, 5): c.P(X, 22, 'log', 1)
    roof_gable(c, 0, 4, WP, 18, s=32, under='shingle', peeks=1, inset=3, cornice=4, ice_len=3)
    finial(c, 5, 5, 'L'); finial(c, WP - 6, 5, 'R')
    # 열린 문짝(안쪽으로 젖혀져 양옆 기둥에 붙음)
    for X0 in (13, 44):
        for X in range(X0, X0 + 7):
            for Y in range(30, HP - 3):
                t = 3 if (X - X0) % 3 else 1
                c.P(X, Y, 'log', t - (1 if X0 > 30 else 0))
        c.HL(X0, 35, 7, 'iron', 3); c.HL(X0, HP - 9, 7, 'iron', 3); c.HL(X0, 29, 7, 'snow', 6)
    drift_base(c, 0, HP - 1, 13, s=32, hmax=4); drift_base(c, 51, HP - 1, 13, s=33, hmax=4)


def rock_face(c, x0, y0, w, h, s=0, icy=0.35):
    """바위·얼음 절벽 앞면: 크기 다른 바위 덩이(보로노이 — 씨앗 둘레 가까울수록 밝은 윗면, 덩이 경계 먹 틈) 사이사이 얼음 덩이.
    덩이마다 윗쪽 2~3px 은 밝은 «턱»(위에 눈이 얹힌다), 오른쪽 아래 그늘. 아래로 갈수록 어둡다."""
    seeds = []
    for k in range(max(6, w * h // 110)):
        sx = h32(k, s, 1) % w; sy = h32(k, s, 2) % h
        seeds.append((sx, sy, h32(k, s, 3) % 100 < icy * 100))
    for j in range(h):
        for i in range(w):
            ds = sorted(((i - sx) ** 2 + ((j - sy) * 1.4) ** 2, n) for n, (sx, sy, ic) in enumerate(seeds))
            d0, n0 = ds[0]; d1 = ds[1][0]
            sx, sy, ic = seeds[n0]
            gap = math.sqrt(d1) - math.sqrt(d0)
            if gap < 1.0:
                c.P(x0 + i, y0 + j, 'ink', 1 if j > h * 0.5 else 2); continue
            rel = j - sy; relx = i - sx
            top_ = rel < -2 and gap < 3.5
            if ic:
                t = 5 if top_ else 4 if relx < 0 else 3
                if (i + j) % 9 == 0: t = 6
                c.P(x0 + i, y0 + j, 'ice', t)
            else:
                t = 5 if top_ else 4 if (relx < 0 and rel < 2) else 3 if relx < 3 else 2
                if j > h * 0.75: t -= 1
                if (i * 3 + j * 5 + s) % 23 == 0: t -= 1
                c.P(x0 + i, y0 + j, 'stone', max(1, t))
                if top_ and gap < 1.8 and j > 2: c.P(x0 + i, y0 + j, 'snow', 5)


def snow_cell(i, j, s):
    from terrain import snow_px
    return snow_px(i, j, s)


def snow_top(c, x0, y0, w, h, s=0, rocks=3):
    """절벽 윗면 눈 고원: 뒤 가장자리 울퉁불퉁 먹 선, 뒤쪽 푸른 그늘 → 앞쪽 밝게, 눈에 묻힌 바위 머리 몇 개,
    앞 모서리 밝은 테 + 처진 눈 처마(아래 그늘)."""
    for i in range(w):
        top = y0 + int(round(1.5 + math.sin((i + s) * 0.4) * 1.5 + math.sin((i + s * 3) * 0.13) * 1.5))
        for j in range(top, y0 + h):
            k = (j - top) / max(1, y0 + h - top)
            mat, t = snow_cell(i, j - y0, s)
            if k < 0.12: t = 3
            elif k < 0.35: t = min(t, 4) if h32(i, j, 5) % 9 else 3
            elif k < 0.55: t = min(t, 5) if h32(i, j, 6) % 9 else 4
            if k > 0.82: t = max(t, 6) if (i + j) % 3 else 5
            if i > w * 0.8: t -= 1
            c.P(x0 + i, j, mat, max(2, t))
        c.P(x0 + i, top, 'ink', 1)
        if i in (0, w - 1):
            for j in range(top, y0 + h + 1): c.P(x0 + i, j, 'ink', 1)
        c.P(x0 + i, y0 + h - 1, 'snow', 6); c.P(x0 + i, y0 + h, 'snow', 4)
        if (i + s) % 4 != 0: c.P(x0 + i, y0 + h + 1, 'snow', 3)
    for q in range(rocks):
        rx = x0 + 8 + h32(q, s, 7) % max(1, w - 18); ry = y0 + 6 + h32(q, s, 8) % max(1, h - 14)
        c.ell(rx, ry, 4, 2.6, lambda X, Y, dx, dy, d: ('stone', 4 if dx < 0 else 2) if dy > -0.1 else ('snow', 6 if dx < 0.2 else 5))
        c.ell(rx, ry, 4, 2.6, lambda X, Y, dx, dy, d: ('ink', 1) if d > 0.85 and dy > 0 else None)


@add('ice-cave', '얼음 동굴 입구(눈 덮인 바위 언덕, 고드름 아가리)', 6, 5, [2, 3], ['동굴', '얼음 동굴', '던전 입구'],
     '숲·산 가장자리. 입구 2칸 앞에 눈길, 둘레에 바위·얼음 결정. 입구 칸에 이동 이벤트.')
def _(c):
    WP, HP = 96, 80
    snow_top(c, 0, 0, WP, 32, s=3, rocks=0)
    # 윗면: 눈 사이로 드러난 바위 등(밝은 돌 윗면 덩이 — 위에서 본 바위 언덕이라는 신호) + 바위 틈 그늘
    for (rx, ry, a, b) in ((22, 14, 12, 6), (50, 10, 10, 5), (70, 18, 13, 6), (40, 22, 8, 4), (84, 9, 6, 3)):
        c.ell(rx, ry, a, b, lambda X, Y, dx, dy, d: ('stone', 6 if dx + dy < -0.5 else 5 if dx < 0.3 else 4) if d < 0.82 else ('stone', 2))
        c.ell(rx - a * 0.25, ry - b * 0.35, a * 0.55, b * 0.45, lambda X, Y, dx, dy, d: ('snow', 6 if dx < 0 else 5))
    rock_face(c, 0, 33, WP, HP - 35, s=34)
    # 양옆 둥글게 깎기(언덕 모양)
    for j in range(HP):
        cut = int(max(0, 7 - j * 0.2))
        for i in range(cut): c.P(i, j, None, 0); c.P(WP - 1 - i, j, None, 0)
        if cut: c.P(cut, j, 'ink', 1); c.P(WP - 1 - cut, j, 'ink', 1)
    # 아가리(위 아치, 안쪽 깊어질수록 검게, 가장자리 얼음 테)
    mx0, mw, mtop = 30, 36, 42
    for j in range(mtop, HP - 1):
        for i in range(mw):
            u = (i + 0.5) / mw
            top = mtop + int(round(10 * (1 - math.sin(math.pi * u))))
            if j < top: continue
            depth = j - top
            c.P(mx0 + i, j, 'ink', 0 if depth > 4 and 0.15 < u < 0.85 else 1)
            if j == top: c.P(mx0 + i, j - 1, 'ice', 6 if u < 0.5 else 5)
            if (u < 0.08 or u > 0.92) and j > top: c.P(mx0 + i, j, 'ice', 3 if u < 0.5 else 2)
    for X in range(mx0 + 3, mx0 + mw - 3, 3):
        u = (X - mx0 + 0.5) / mw
        top = mtop + int(round(10 * (1 - math.sin(math.pi * u))))
        ln = 2 + h32(X, 3, 5) % 5
        for k in range(ln): c.P(X, top + k, 'ice', 6 if k == 0 else 5 if k < ln - 1 else 4)
    c.R(mx0 + 10, HP - 6, 16, 4, 'aur', 0); c.HL(mx0 + 12, HP - 5, 12, 'aur', 1)          # 안쪽 푸른 빛
    # 고원 위 작은 가문비 둘(윗면 땅이라는 신호)
    from props import pine
    sub = C(20, 34); pine(sub, 9.5, 4, 33, 9, 3, s=8, trunk_h=3); c.paste(sub, 4, 2)
    sub = C(16, 28); pine(sub, 7.5, 3, 27, 7, 3, s=9, trunk_h=2); c.paste(sub, 74, 4)
    # 얼음 결정 몇 개(앞면에 박힘)
    for (X, Y) in ((12, 46), (80, 52), (20, 66)):
        for k in range(5): c.P(X, Y - k, 'ice', 6 if k < 2 else 5); c.P(X + 1, Y - k + 1, 'ice', 3)
    drift_base(c, 0, HP - 1, mx0 - 2, s=34, hmax=5); drift_base(c, mx0 + mw + 2, HP - 1, WP - mx0 - mw - 2, s=35, hmax=5)


@add('frozen-falls', '얼어붙은 폭포(절벽 + 얼음 기둥 + 얼음 못)', 4, 6, [], ['폭포', '얼음', '절벽'],
     '얼음 강(sn-at-ice)의 북쪽 끝. 맨 아래 줄 얼음 못이 강 얼음과 닿게. 지나갈 수 없다.')
def _(c):
    WP, HP = 64, 96
    snow_top(c, 0, 0, WP, 22, s=5)
    # 윗면 물길(얼음)
    for j in range(2, 22):
        for i in range(20, 44):
            if abs(i - 32 + math.sin(j * 0.4) * 2) < 9: c.P(i, j, 'ice', 4 if (i + j) % 5 else 5)
    rock_face(c, 0, 23, WP, HP - 37, s=36, icy=0.2)
    # 얼음 기둥 폭포(세로 줄무늬, 가운데 밝게, 끝 고드름)
    for i in range(16, 48):
        u = (i - 16) / 32
        ln = HP - 14 - 23 + (h32(i, 1, 3) % 5)
        for j in range(23, 23 + ln):
            col = (i // 3) % 3
            t = 6 if col == 0 and u < 0.6 else 5 if col == 1 else 4
            if u > 0.75: t -= 1
            if (j + i * 2) % 13 == 0: t -= 1
            c.P(i, j, 'ice', max(2, t))
        c.P(i, 22, 'ice', 6)
    c.VL(15, 23, HP - 38, 'ink', 1); c.VL(48, 23, HP - 38, 'ink', 1)
    # 아래 얼음 못(눈 둑에 둘러싸인 낮은 얼음 + 부서진 얼음 덩이)
    c.ell(32, HP - 8, 30, 7, lambda X, Y, dx, dy, d: ('snow', 3) if d > 0.82 else ('ice', 4 if dx + dy < 0 else 3))
    for (X, Y) in ((22, HP - 10), (38, HP - 7), (30, HP - 12)):
        c.R(X, Y, 5, 3, 'ice', 5); c.HL(X, Y, 5, 'ice', 6); c.HL(X, Y + 3, 5, 'ice', 2)


def sheet(path=None, z=3):
    items = [(it['id'], R.render(it).img()) for it in R.items]
    return contact(items, path or os.path.join(OUT, 'buildings', 'preview.png'), z=z, W=2200, bg=(214, 222, 236))


if __name__ == '__main__':
    R.export(); sheet()
    print(len(R.items), 'buildings')
