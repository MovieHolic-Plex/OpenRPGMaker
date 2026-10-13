#!/usr/bin/env python3
"""desert_east 건물 — 평지붕 흙집·사암집·회칠집, 돔 집, 바람탑 집, 가게 집, 2층 집, 첨탑, 둥근 지붕 회당, 궁전, 대상 숙소 문루.

모든 건물: 지붕 윗면 ≥ 2칸(밝은 슬래브 + 난간 테), 앞 벽면 2칸(32px), 아치 문 12~14×24px 은 맨 아랫줄 칸 안(문 칸 = entrance).
문 칸 바로 아래(접근칸)는 구성기가 길로 비워 둔다.
  python3 buildings.py
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32
from kit import Reg, contact, OUT
import bparts as BP

R = Reg('buildings')


def B(id_, name, w, h, entrance, tags=(), rules='', kind='structure', **kw):
    return R.add(id_, name, w, h, kind, tags=tags, rules=rules, entrance=list(entrance), **kw)


def house(c, w, roof, mat, door_cells, win_cells=(), s=1, door_style='wood', win_style='lattice', jars=(), hatch=None, rug=None,
          kind=None, beams=True, frame=None):
    """기본 평지붕 집. roof = 지붕 칸 수(윗면). 벽 2칸."""
    W, Hroof = w * 16, roof * 16
    frame = frame or (('plaster', 5) if mat != 'plaster' else ('stone', 5))
    BP.flat_roof(c, 0, 0, W, Hroof, mat, s=s, jars=jars, hatch=hatch, rug=rug)
    BP.wall(c, 0, Hroof, W, 32, mat, s=s, kind=kind)
    if beams and mat == 'adobe': BP.beams(c, 2, Hroof + 3, W - 4, step=7, off=3)
    for dc in door_cells:
        BP.door(c, dc * 16 + 2, Hroof + 8, 12, 24, style=door_style, frame=frame, s=s)
    for wc in win_cells:
        BP.window(c, wc * 16 + 5, Hroof + 9, 6, 9, style=win_style, frame=frame)
    return Hroof


HOUSE_RULE = ('집 하나를 키트로 찍는다. 문 칸(entrance)은 막힘이고 바로 아래 칸(접근칸)은 길·마당 바닥으로 비워 둔다. '
              '집끼리는 1칸 이상 띄우거나 옆벽을 맞붙인 줄집으로 놓는다. 지붕 위(윗면 칸)는 걸을 수 없다.')


@B('house-adobe-3', '흙벽돌 집(작은)', 3, 4, [1], ['집', '흙벽돌', '평지붕'], HOUSE_RULE)
def _(c): house(c, 3, 2, 'adobe', [1], [], s=3, jars=[(30, 9)])


@B('house-adobe-4', '흙벽돌 집', 4, 4, [1], ['집', '흙벽돌', '평지붕'], HOUSE_RULE)
def _(c): house(c, 4, 2, 'adobe', [1], [3], s=5, hatch=(42, 8), rug=(8, 7, 18, 12, 'red'))


@B('house-adobe-5', '흙벽돌 집(넓은, 마당 지붕)', 5, 5, [2], ['집', '흙벽돌', '평지붕'], HOUSE_RULE)
def _(c): house(c, 5, 3, 'adobe', [2], [0, 4], s=7, jars=[(8, 8), (14, 8)], rug=(40, 22, 22, 14, 'saffron'), win_style='shutter')


@B('house-stone-4', '사암 집', 4, 4, [2], ['집', '사암', '평지붕'], HOUSE_RULE)
def _(c): house(c, 4, 2, 'stone', [2], [0], s=9, kind='stone', jars=[(48, 7)], door_style='turq')


@B('house-plaster-4', '회칠 흰 집', 4, 4, [1], ['집', '회칠', '평지붕'], HOUSE_RULE)
def _(c): house(c, 4, 2, 'plaster', [1], [3], s=11, door_style='turq', win_style='shutter', rug=(32, 6, 22, 12, 'lapis'))


@B('house-plaster-3', '회칠 흰 집(작은)', 3, 4, [1], ['집', '회칠', '평지붕'], HOUSE_RULE)
def _(c): house(c, 3, 2, 'plaster', [1], [], s=19, door_style='wood', jars=[(6, 8)], hatch=(32, 9))


@B('house-stone-5', '사암 집(넓은, 창 둘)', 5, 5, [2], ['집', '사암', '평지붕'], HOUSE_RULE)
def _(c): house(c, 5, 3, 'stone', [2], [0, 4], s=23, kind='stone', door_style='turq', win_style='lattice', jars=[(10, 10), (62, 9)], rug=(30, 14, 20, 14, 'red'))


@B('house-dome-4', '돔 지붕 사암 집', 4, 5, [1], ['집', '돔', '사암'], HOUSE_RULE + ' 돔은 지붕 위 장식이라 막힌다.')
def _(c):
    # 지붕 3칸 중 위 1칸은 돔이 솟는 자리(투명 배경)
    sub = C(64, 64); house(sub, 4, 2, 'stone', [1], [3], s=13, kind='stone', door_style='wood')
    c.paste(sub, 0, 16)
    BP.dome(c, 40, 36, 11, 'turq', ry=13, drum=5, drum_mat='plaster')


@B('house-dome-white', '흰 돔 회칠 집', 3, 5, [1], ['집', '돔', '회칠'], HOUSE_RULE)
def _(c):
    sub = C(48, 64); house(sub, 3, 2, 'plaster', [1], [], s=17, door_style='turq')
    c.paste(sub, 0, 16)
    BP.dome(c, 24, 36, 12, 'plaster', ry=14, drum=4, drum_mat='plaster', ribs=False)


@B('house-2f', '2층 사암 집(나무 격자 발코니)', 4, 6, [1], ['집', '2층', '사암', '마슈라비야'], HOUSE_RULE)
def _(c):
    W = 64
    BP.flat_roof(c, 0, 0, W, 32, 'stone', s=21, jars=[(46, 8)])
    BP.wall(c, 0, 32, W, 64, 'stone', s=21, kind='stone')
    # 층 띠(가운데 돌림띠: 윗면 밝게 + 밑 그늘)
    c.HL(0, 62, W, 'stone', 6); c.HL(0, 63, W, 'stone', 4); c.HL(0, 64, W, 'stone', 1)
    BP.window(c, 5, 40, 6, 10, style='lattice')
    # 나무 격자 돌출 창(마슈라비야): 윗면(작은 지붕) + 격자 앞면 + 받침 까치발 + 벽 그림자
    x0, y0, bw = 28, 36, 22
    c.R(x0 + 1, y0, bw - 2, 3, 'dwood', 4); c.HL(x0, y0 + 3, bw, 'dwood', 3)
    c.HL(x0 + 1, y0, bw - 2, 'dwood', 2)
    for j in range(y0 + 4, y0 + 19):
        for i in range(x0, x0 + bw):
            lx, ly = i - x0, j - y0 - 4
            t = 2 if (lx + ly) % 3 == 0 or (lx - ly) % 3 == 0 else 0
            if lx in (0, bw - 1) or ly in (0, 14): t = 3 if lx == 0 else 1 if lx == bw - 1 else 3
            c.P(i, j, 'dwood' if t else 'void', t if t else 1)
    c.HL(x0, y0 + 19, bw, 'dwood', 3); c.HL(x0 + 1, y0 + 20, bw - 2, 'dwood', 1)
    for k in (x0 + 3, x0 + bw - 5):
        c.R(k, y0 + 21, 2, 3, 'dwood', 2); c.P(k + 1, y0 + 23, 'dwood', 1)
    c.R(x0 + bw, y0 + 5, 1, 18, 'stone', 1)                  # 돌출 창이 벽에 던진 그림자(오른쪽)
    c.HL(x0 + 2, y0 + 24, bw - 2, 'stone', 1)
    BP.door(c, 18, 72, 12, 24, style='wood')
    BP.window(c, 53, 74, 6, 9, style='shutter')


@B('house-shop', '가게 집(줄무늬 차양)', 4, 5, [2], ['집', '가게', '차양', '바자르'], HOUSE_RULE + ' 가게 앞 차양 아래 칸은 문 접근칸과 같은 줄이다.')
def _(c):
    W = 64
    BP.flat_roof(c, 0, 0, W, 32, 'adobe', s=25, hatch=(8, 8))
    BP.wall(c, 0, 32, W, 48, 'adobe', s=25)
    BP.beams(c, 2, 35, 60, step=7)
    # 가게 앞 열린 진열 칸(어두운 안 + 선반 물건)
    c.R(4, 52, 24, 24, 'void', 1); c.HL(4, 52, 24, 'void', 0)
    for sy, items in ((57, ('adobe', 'saffron', 'turq')), (65, ('red', 'adobe', 'gold'))):
        c.HL(5, sy + 4, 22, 'wood', 3); c.HL(5, sy + 5, 22, 'wood', 1)
        for k, ix in enumerate(range(6, 26, 4)):
            m = items[k % 3]
            c.R(ix, sy, 3, 4, m, 3); c.HL(ix, sy, 3, m, 4 if m != 'gold' else 5); c.P(ix + 2, sy + 2, m, 1)
    c.R(3, 72, 26, 4, 'wood', 3); c.HL(3, 72, 26, 'wood', 5); c.HL(3, 75, 26, 'wood', 1)      # 진열대 판
    BP.door(c, 34, 56, 12, 24, style='curtain', s=1)
    BP.window(c, 53, 58, 6, 9, style='lattice')
    BP.awning(c, 1, 44, 47, depth=6, front=4, col='red')
    for j in range(54, 57):
        for i in range(2, 47):
            g = c.get(i, j)
            if g and g[0] != 'red' and g[0] != 'plaster': c.P(i, j, g[0], max(0, g[1] - 1))
    c.R(1, 45, 1, 14, 'wood', 2); c.R(46, 45, 1, 14, 'wood', 1)       # 차양 기둥


@B('house-windtower', '바람탑 집', 4, 6, [1], ['집', '바람탑', '사암'], HOUSE_RULE + ' 바람탑은 지붕 뒤에 솟는다.')
def _(c):
    sub = C(64, 64); house(sub, 4, 2, 'plaster', [1], [3], s=29, door_style='wood', win_style='lattice')
    c.paste(sub, 0, 32)
    # 탑: x 34..58, 꼭대기 윗면 y 0..6, 앞면 y 7..44(지붕 위로)
    x0, x1 = 36, 58
    tw = x1 - x0
    c.R(x0, 0, tw, 6, 'stone', 6); c.HL(x0, 0, tw, 'stone', 2); c.HL(x0, 5, tw, 'stone', 5)
    c.R(x0 + 2, 1, tw - 4, 3, 'stone', 5)
    BP.wall_tex(c, x0, 6, tw, 40, 'stone', 'stone', 31)
    c.VL(x0, 0, 46, 'stone', 1); c.VL(x0 + 1, 6, 40, 'stone', 5); c.VL(x1 - 1, 0, 46, 'stone', 0); c.VL(x1 - 2, 6, 40, 'stone', 2)
    c.HL(x0, 6, tw, 'stone', 2)
    for k in range(4):                         # 바람 구멍(세로 틈) 4개
        vx = x0 + 3 + k * 5
        c.R(vx, 9, 3, 14, 'void', 1); c.HL(vx, 9, 3, 'void', 0); c.VL(vx + 3, 9, 14, 'stone', 5)
        c.HL(vx, 23, 3, 'stone', 6)
    c.HL(x0, 26, tw, 'stone', 6); c.HL(x0, 27, tw, 'stone', 2)
    c.HL(x0 - 1, 46, tw + 2, 'stone', 1)      # 지붕과 만나는 접지 그늘


@B('minaret', '첨탑(미너렛)', 2, 7, [], ['첨탑', '탑', '랜드마크'], '마을 랜드마크. 회당·광장 곁 한 곳에만. 문 없음(장식).', kind='column')
def _(c):
    cx = 16
    # 기단(네모 받침): 윗면 + 앞면
    c.R(2, 82, 28, 5, 'stone', 6); c.HL(2, 82, 28, 'stone', 2); c.HL(2, 86, 28, 'stone', 5)
    BP.wall_tex(c, 2, 87, 28, 25, 'stone', 'stone', 33)
    c.VL(2, 82, 30, 'stone', 1); c.VL(29, 82, 30, 'stone', 0); c.HL(2, 111, 28, 'stone', 1); c.VL(3, 87, 24, 'stone', 5)
    BP.window(c, 13, 94, 6, 9, style='lattice', frame=('stone', 6))
    # 원통 몸: 위로 갈수록 좁게
    def shaft(y0, y1, r0, r1, mat, band=None):
        for y in range(y0, y1):
            u = (y - y0) / max(1, y1 - y0 - 1)
            r = r0 + (r1 - r0) * u
            for i in range(-int(r), int(r) + 1):
                dx = i / (r + 0.5)
                t = 4 if dx < -0.4 else 3 if dx < 0.25 else 2 if dx < 0.7 else 1
                if dx < -0.75: t = 5
                if band and (y - y0) % band == 0: t = max(0, t - 1)
                c.P(cx + i, y, mat, min(6, t))
    shaft(40, 82, 9, 10, 'stone', band=7)
    # 청록 타일 띠(기하 무늬, 글자 없음)
    for y in range(58, 64):
        for i in range(-9, 10):
            t = 3 if (i + y) % 4 < 2 else 2
            if abs(i) > 6: t -= 1
            c.P(cx + i, y, 'turq', t)
    # 발코니(둘레 고리): 윗면 타원 + 난간 앞면
    c.ell(cx, 36, 13, 4, lambda x, y, dx, dy, d: ('stone', 6 if dy < -0.2 else 5))
    c.ell(cx, 36, 10, 2.6, lambda x, y, dx, dy, d: ('stone', 4))
    for y in range(37, 42):
        hw = 13 if y < 41 else 11
        for i in range(-hw, hw + 1):
            dx = i / hw
            t = 4 if dx < -0.3 else 3 if dx < 0.4 else 2
            if y == 41: t = 1
            if (i % 3 == 0) and 37 < y < 40: t = 1
            c.P(cx + i, y, 'stone', t)
    shaft(14, 34, 6, 6, 'plaster')
    for y in (20, 26):
        c.R(cx - 2, y, 2, 5, 'void', 1)
    c.ell(cx, 13, 8, 2.5, lambda x, y, dx, dy, d: ('stone', 6 if dy < 0 else 4))
    BP.onion(c, cx, 12, 7, 11, 'turq', drum=0)


@B('domed-hall', '둥근 지붕 회당(큰 돔·아치 문루)', 6, 6, [2, 3], ['회당', '돔', '목욕탕', '랜드마크'],
   '광장 북쪽 한가운데. 문은 두 칸(entrance 2·3) — 그 아래 두 칸을 광장 포석으로 비운다. 회당·목욕탕(하맘) 외관으로 쓴다.')
def _(c):
    BP.flat_roof(c, 0, 24, 96, 40, 'stone', s=41)
    BP.wall(c, 0, 64, 96, 32, 'stone', s=41, kind='stone')
    for wx in (10, 78): BP.window(c, wx, 72, 7, 11, style='lattice')
    BP.dome(c, 48, 52, 21, 'turq', ry=22, drum=6, drum_mat='stone')
    BP.pishtaq(c, 28, 44, 40, 52, door_w=14, mat='stone', s=41)


@B('palace', '궁전(양파 돔·아치 회랑·모서리 탑)', 10, 8, [4, 5], ['궁전', '양파 돔', '랜드마크'],
   '궁전 마당 북쪽 가운데. 문은 두 칸(entrance 4·5) — 아래 두 칸과 그 앞 마당을 포석으로. 양옆 2칸 이상 띄운다.')
def _(c):
    # 날개(좌우) 지붕·벽: 아치 회랑
    for x0 in (14, 112):
        BP.flat_roof(c, x0, 56, 34, 36, 'plaster', s=43)
        BP.wall(c, x0, 92, 34, 36, 'plaster', s=43)
        for k in range(3):
            ax = x0 + 3 + k * 10
            m = BP.pointed_mask(8, 18, rise=6)
            BP.fill_mask(c, ax, 100, m, lambda i, j, m=m: ('plaster', 5) if BP.mask_border(m, i, j) and i == 0 else ('void', 1 if j < 6 else 2))
            c.VL(ax + 8, 98, 22, 'plaster', 2)
        c.HL(x0, 95, 34, 'turq', 3); c.HL(x0, 96, 34, 'turq', 1)
    # 가운데 본채
    BP.flat_roof(c, 46, 40, 68, 44, 'plaster', s=47)
    BP.wall(c, 46, 84, 68, 44, 'plaster', s=47)
    BP.tile_band(c, 47, 87, 66, 3, 1)
    BP.onion(c, 80, 66, 19, 30, 'gold', drum=8, drum_mat='plaster')
    for sx in (60, 100): BP.onion(c, sx, 54, 6, 12, 'turq', drum=4, drum_mat='plaster')
    BP.pishtaq(c, 62, 68, 36, 60, door_w=14, mat='plaster', s=47)
    # 모서리 탑(좌우): 원통 + 작은 양파 돔
    for cx in (8, 152):
        for y in range(40, 128):
            for i in range(-7, 8):
                dx = i / 7.5
                t = 4 if dx < -0.35 else 3 if dx < 0.3 else 2 if dx < 0.7 else 1
                if dx < -0.75: t = 5
                if y == 127: t = 0
                if (y - 40) % 22 == 0: t = max(0, t - 1)
                c.P(cx + i, y, 'plaster', t)
        for y in (70, 96): c.R(cx - 1, y, 2, 6, 'void', 1)
        c.ell(cx, 40, 9, 3, lambda x, y, dx, dy, d: ('plaster', 5 if dy < 0 else 4))
        for i in range(-9, 10, 3): c.R(cx + i, 35, 2, 3, 'plaster', 5)
        BP.onion(c, cx, 38, 7, 14, 'turq', drum=3, drum_mat='plaster')


# ═════════════ 성벽 조립 부품(대상 숙소·도성·궁전 담) ═════════════
WALL_RULE = ('성벽 조립 부품. 구성기가 사각 둘레로 놓는다: 북·남 벽은 wall-h(가로, 3칸 높이 = 윗길 1 + 벽면 2), 동·서 벽은 wall-v(세로, 위에서 본 성가퀴 길), '
             '네 모서리는 wall-tower, 문은 wall-gate(가운데 두 칸 통로는 걸을 수 있다). 낱칸으로 칠하지 않는다.')


def battlement_top(c, x, y, w, mat='stone', s=0):
    """가로 성벽 윗길(16px): 뒤 성가퀴(작은 이) + 걷는 길 + 앞 성가퀴(이의 윗면 + 앞면)."""
    T = BP.top(mat)
    c.R(x, y, w, 16, mat, 4)
    for i in range(w):
        X = x + i
        c.P(X, y, mat, 1)
        # 뒤 성가퀴 이(4 주기, 높이 3)
        if (X // 4) % 2 == 0: c.P(X, y + 1, mat, T); c.P(X, y + 2, mat, T - 1)
        else: c.P(X, y + 1, mat, 2); c.P(X, y + 2, mat, 3)
        # 걷는 길(사암 판, 결)
        for j in range(3, 9):
            t = 4 if rnd(X, y + j, s) > 0.1 else 3
            if (X + (j // 3) * 3) % 8 == 7: t = 3
            c.P(X, y + j, mat, t)
        c.P(X, y + 3, mat, 3)
        # 앞 성가퀴: 이는 윗면(밝음) 2 + 앞면 4, 틈은 그늘
        if (X // 4) % 2 == 0:
            c.P(X, y + 9, mat, T); c.P(X, y + 10, mat, T - 1)
            for j in range(11, 16): c.P(X, y + j, mat, 3 if (X % 4) else 4)
        else:
            c.P(X, y + 9, mat, 2); c.P(X, y + 10, mat, 2)
            c.P(X, y + 11, mat, T - 1)
            for j in range(12, 16): c.P(X, y + j, mat, 3)
    c.HL(x, y + 15, w, mat, 2)


@B('wall-h', '사암 성벽(가로)', 1, 3, [], ['성벽', '대상 숙소', '도성'], WALL_RULE, kind='structure')
def _(c):
    battlement_top(c, 0, 0, 16, s=51)
    BP.wall_tex(c, 0, 16, 16, 32, 'stone', 'stone', 51)
    c.HL(0, 16, 16, 'stone', 1); c.HL(0, 46, 16, 'stone', 2); c.HL(0, 47, 16, 'stone', 1)


@B('wall-h-slit', '사암 성벽(가로, 활 구멍)', 1, 3, [], ['성벽', '대상 숙소', '도성'], WALL_RULE, kind='structure')
def _(c):
    battlement_top(c, 0, 0, 16, s=53)
    BP.wall_tex(c, 0, 16, 16, 32, 'stone', 'stone', 53)
    c.HL(0, 16, 16, 'stone', 1); c.HL(0, 46, 16, 'stone', 2); c.HL(0, 47, 16, 'stone', 1)
    c.R(7, 24, 2, 9, 'void', 1); c.P(7, 24, 'void', 0); c.VL(9, 24, 9, 'stone', 5); c.HL(6, 33, 4, 'stone', 6)


@B('wall-v', '사암 성벽(세로, 위에서 본 성가퀴 길)', 2, 1, [], ['성벽', '대상 숙소', '도성'], WALL_RULE + ' 세로로 이어 붙는다(폭 2칸 = 모서리 탑과 같다).', kind='structure')
def _(c):
    # 위에서 본 성벽 윗면: 가운데 성가퀴 길(돌판 이음) + 양쪽 성가퀴(솟은 돌 덩이 — 윗면 밝게, 아래 그늘) + 길 양쪽 낮은 턱 그늘
    for y in range(16):
        for x in range(32):
            t = 4 if rnd(x, y, 55) > 0.12 else 3
            if y % 8 == 7 or (x in (12, 20) and y % 8 < 7 and (y // 8) % 2 == 0): t = 3
            c.P(x, y, 'stone', t)
        for x in (6, 25): c.P(x, y, 'stone', 2)            # 성가퀴 안쪽 턱 그늘
        merl = (y // 4) % 2 == 0
        for x0 in (0, 26):
            for x in range(x0, x0 + 6):
                if merl:
                    t = 6 if (y % 4 == 0) else 5
                    if y % 4 == 3: t = 2
                else:
                    t = 3
                if x == x0: t = min(t, 1) if x0 == 26 else max(t - 1, 1)
                if x == x0 + 5: t = 1 if x0 == 26 else t
                c.P(x, y, 'stone', t)
    c.VL(0, 0, 16, 'stone', 0); c.VL(31, 0, 16, 'stone', 0)


@B('wall-tower', '성벽 모서리 탑', 2, 4, [], ['성벽', '탑', '대상 숙소', '도성'], WALL_RULE + ' 모서리마다 하나. 벽보다 한 줄 높다.', kind='structure')
def _(c):
    # 윗면: 성가퀴 테 둘레 + 안 바닥(1.5칸) / 앞면 2.5칸
    W = 32
    c.R(0, 0, W, 24, 'stone', 4)
    for i in range(W):
        merl = (i // 4) % 2 == 0
        c.P(i, 0, 'stone', 1); c.P(i, 1, 'stone', 6 if merl else 2); c.P(i, 2, 'stone', 5 if merl else 3)
        c.P(i, 20, 'stone', 6 if merl else 3); c.P(i, 21, 'stone', 5 if merl else 3)
        for j in (22, 23): c.P(i, j, 'stone', 3 if merl else 2)
    for j in range(24):
        merl = (j // 4) % 2 == 0
        c.P(0, j, 'stone', 1); c.P(1, j, 'stone', 6 if merl else 3); c.P(2, j, 'stone', 5)
        c.P(W - 1, j, 'stone', 0); c.P(W - 2, j, 'stone', 4 if merl else 2); c.P(W - 3, j, 'stone', 3)
    c.HL(3, 3, W - 6, 'stone', 3); c.VL(3, 3, 17, 'stone', 3)
    for j in range(4, 20):
        for i in range(4, W - 3):
            if rnd(i, j, 57) < 0.07: c.P(i, j, 'stone', 3)
    BP.wall_tex(c, 0, 24, W, 40, 'stone', 'stone', 57)
    c.VL(0, 24, 40, 'stone', 1); c.VL(1, 24, 40, 'stone', 5); c.VL(W - 1, 24, 40, 'stone', 0); c.VL(W - 2, 24, 40, 'stone', 2)
    c.HL(0, 24, W, 'stone', 1); c.HL(0, 25, W, 'stone', 2)
    c.HL(0, 60, W, 'stone', 2); c.HL(0, 62, W, 'stone', 2); c.HL(0, 63, W, 'stone', 1)
    c.R(15, 34, 2, 10, 'void', 1); c.VL(17, 34, 10, 'stone', 5); c.HL(14, 44, 5, 'stone', 6)
    c.HL(0, 48, W, 'stone', 5); c.HL(0, 49, W, 'stone', 2)


@B('wall-gate', '성문(아치 통로)', 4, 4, [], ['성벽', '성문', '대상 숙소', '도성'],
   WALL_RULE + ' 가운데 두 칸(x 1·2)은 통로라 걸어 지나간다(위 두 줄은 머리 위로 그려진다). 성문 앞뒤 칸을 길로 잇는다.', kind='structure',
   passable=[(1, 0), (2, 0), (1, 1), (2, 1), (1, 2), (2, 2), (1, 3), (2, 3)])
def _(c):
    W = 64
    # 위 문루(지붕 윗면) 0..20, 앞면 20..64
    c.R(0, 0, W, 20, 'stone', 4)
    for i in range(W):
        merl = (i // 4) % 2 == 0
        c.P(i, 0, 'stone', 1); c.P(i, 1, 'stone', 6 if merl else 2); c.P(i, 2, 'stone', 5 if merl else 3)
        c.P(i, 16, 'stone', 6 if merl else 3); c.P(i, 17, 'stone', 5 if merl else 3); c.P(i, 18, 'stone', 3 if merl else 2); c.P(i, 19, 'stone', 3)
    c.VL(0, 0, 20, 'stone', 1); c.VL(W - 1, 0, 20, 'stone', 0); c.HL(1, 3, W - 2, 'stone', 3)
    for j in range(4, 16):
        for i in range(2, W - 2):
            if rnd(i, j, 59) < 0.07: c.P(i, j, 'stone', 3)
    BP.wall_tex(c, 0, 20, W, 44, 'stone', 'stone', 59)
    c.VL(0, 20, 44, 'stone', 1); c.VL(1, 20, 44, 'stone', 5); c.VL(W - 1, 20, 44, 'stone', 0); c.VL(W - 2, 20, 44, 'stone', 2)
    c.HL(0, 20, W, 'stone', 1)
    BP.tile_band(c, 4, 24, W - 8, 3, 2)
    # 통로 아치 x 16..48(두 칸), 높이 32: 열린 바닥(투명) + 아치 둘레 쐐기돌
    m = BP.arch_mask(32, 34, r=16)
    for (i, j) in m:
        X, Y = 16 + i, 30 + j
        if Y >= 64: continue
        c.P(X, Y, None, 0)
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (-2, 0), (2, 0), (0, -2), (-1, -1), (1, -1)):
            if (i + dx, j + dy) not in m and 30 + j + dy < 64:
                c.P(16 + i + dx, 30 + j + dy, 'stone', 6 if dx <= 0 else 4)
    # 통로 안 천장 그늘(아치 속 위쪽 6줄 = 머리 위 칸에 그려 통로 깊이)
    for (i, j) in m:
        if j < 22 and 30 + j < 48:
            c.P(16 + i, 30 + j, 'void', 1 if j < 18 else 2)
    for k in (8, 52): c.R(k, 36, 4, 22, 'stone', 2); c.VL(k, 36, 22, 'stone', 4)
    c.HL(0, 62, 16, 'stone', 2); c.HL(48, 62, 16, 'stone', 2); c.HL(0, 63, 16, 'stone', 1); c.HL(48, 63, 16, 'stone', 1)


# ═════════════ 고대 유적: 피라미드·지구라트·오벨리스크 ═════════════
def pyramid(c, W, H, s=0, cap=True, worn=0.0, shadow=None):
    """피라미드(3/4 탑뷰, 깊이는 화면 위로): 밑면 앞 모서리 FL·FR, 뒤 모서리 BL·BR(앞 모서리 바로 위 D 화소), 꼭짓점 A.
    보이는 면 = 남쪽 면(FL·FR·A, 돌 단 줄) + 서쪽 면(FL·BL·A, 빛) + 동쪽 면(FR·BR·A, 그늘). 윤곽은 오각형 FL-BL-A-BR-FR.
    shadow = 동쪽에 드리운 땅 그림자 폭(화소, 키트 오른쪽 여백 안)."""
    sw = shadow if shadow is not None else W // 8
    pw = W - sw
    by = H - 1; D = int(H * 0.36); ay = 3
    ax = (pw - 1) / 2
    FL, FR, BL, BR, A = (0, by), (pw - 1, by), (0, by - D), (pw - 1, by - D), (ax, ay)

    def side(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])

    def inside(pt, a, b, c3):
        d1, d2, d3 = side(a, b, pt), side(b, c3, pt), side(c3, a, pt)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))
    # 땅 그림자(동쪽): FR·BR 에서 동쪽으로 쐐기
    top = by - int(D * 0.75)
    for y in range(top, H):
        u = (y - top) / max(1, by - top)
        reach = sw * (0.15 + 0.85 * u ** 0.8)
        for x in range(pw, pw + int(reach) + 1):
            v = (x - pw) / max(1.0, reach)
            if v > 1: continue
            if v > 0.7 and (x + y) % 2: continue                  # 끝 성긴 점
            c.P(x, y, 'sand', 2 if v < 0.55 else 3)
    for y in range(H):
        for x in range(pw):
            pt = (x + 0.5, y + 0.5)
            if inside(pt, FL, FR, A): face = 'S'
            elif inside(pt, FL, BL, A): face = 'W'
            elif inside(pt, FR, BR, A): face = 'E'
            else: continue
            ly = y % 4; course = y // 4
            if face == 'S':
                t = 4 if ly else 5
                if ly == 3: t = 3
                off = 3 if course % 2 else 0
                if (x + off) % 7 == 0 and ly in (1, 2): t -= 1
            elif face == 'W':
                t = 6 if ly == 0 else 5
                if ly == 3: t = 4
            else:
                t = 2 if ly == 0 else 1
                if ly == 3: t = 0
            if worn and rnd(x // 3, y // 3, s) < worn and y > H * 0.3: t -= 1
            c.P(x, y, 'stone', max(0, min(6, t)))
    # 능선(남쪽 면의 두 모서리): 서쪽 능선 밝게, 동쪽 능선 어둡게
    for k in range(200):
        u = k / 199
        for (q, t) in ((FL, 6), (FR, 2)):
            x = A[0] + (q[0] - A[0]) * u; y = A[1] + (q[1] - A[1]) * u
            if c.on(int(x), int(y)): c.P(int(x), int(y), 'stone', t)
    if cap:
        cap_h = max(5, H // 8)
        for y in range(ay, ay + cap_h):
            for x in range(pw):
                pt = (x + 0.5, y + 0.5)
                if inside(pt, FL, FR, A): c.P(x, y, 'gold', 5 if x < ax - 1 else 4)
                elif inside(pt, FL, BL, A): c.P(x, y, 'gold', 5)
                elif inside(pt, FR, BR, A): c.P(x, y, 'gold', 2)
    c.HL(0, by, pw, 'stone', 1)


@B('pyramid-great', '대피라미드(큰)', 14, 9, [], ['피라미드', '유적', '랜드마크'],
   '사막 유적의 중심. 남쪽 면 가운데 아래(밑변 가운데, 그림자 여백 2칸을 뺀 폭 12칸의 가운데)에 «피라미드 입구»(pyramid-door)를 붙여 내부와 잇는다. 오른쪽 2칸은 땅 그림자. 둘레 2칸 비움.')
def _(c): pyramid(c, 224, 144, s=67, shadow=32)


@B('pyramid', '피라미드', 8, 6, [], ['피라미드', '유적', '랜드마크'],
   '대피라미드 곁·작은 유적의 중심. 남쪽 면 가운데 아래에 «피라미드 입구»(pyramid-door)를 붙이면 내부로 잇는다. 오른쪽 1칸은 땅 그림자. 둘레 2칸 비움.')
def _(c): pyramid(c, 128, 96, s=61, shadow=16)


@B('pyramid-small', '작은 피라미드', 4, 3, [], ['피라미드', '유적'], '대피라미드 곁에 한두 개. 둘레 1칸 비움.')
def _(c): pyramid(c, 64, 48, s=63, worn=0.12, shadow=8)


@B('pyramid-door', '피라미드 입구(돌 문틀)', 2, 2, [0, 1], ['피라미드', '입구', '유적'],
   '대피라미드 남쪽 면 가운데 아래(밑변에 맞춰) 겹쳐 찍는다. 문 칸 두 개(entrance) 아래를 포석으로 비우고 내부 맵과 잇는다.')
def _(c):
    # 앞으로 튀어나온 돌 문틀: 윗면 6줄 + 앞면, 가운데 어두운 통로
    c.R(0, 4, 32, 6, 'stone', 6); c.HL(0, 4, 32, 'stone', 2); c.HL(0, 9, 32, 'stone', 5)
    BP.wall_tex(c, 0, 10, 32, 22, 'stone', 'stone', 65)
    c.VL(0, 4, 28, 'stone', 1); c.VL(1, 10, 22, 'stone', 5); c.VL(31, 4, 28, 'stone', 0); c.VL(30, 10, 22, 'stone', 2)
    c.R(8, 12, 16, 20, 'void', 0); c.HL(8, 12, 16, 'void', 0)
    c.VL(7, 12, 20, 'stone', 6); c.VL(24, 12, 20, 'stone', 2); c.HL(7, 11, 18, 'stone', 6)
    for j in range(14, 32): c.P(9, j, 'void', 1)
    c.HL(6, 31, 20, 'stone', 1)


@B('ziggurat', '지구라트(계단 신전)', 7, 6, [3], ['지구라트', '신전', '유적', '랜드마크'],
   '단이 셋인 계단 신전. 가운데 계단 밑 칸(entrance)이 입구이고 그 아래를 길로 비운다. 둘레 2칸 비움.')
def _(c):
    W = 112
    tiers = [(0, 34, 96, 16, 'adobe'), (14, 18, 68, 14, 'adobe'), (28, 4, 40, 12, 'adobe')]
    # 아래 단부터: (들여쓰기 x, 윗면 y, 앞면 y, ...)
    levels = [(4, 50, 104, 46), (18, 30, 76, 20), (32, 12, 48, 18)]   # (x0, top_y, width, ...)
    specs = [(4, 48, 104, 18, 30), (18, 26, 76, 14, 22), (32, 8, 48, 10, 18)]  # x0, top_y, w, top_h, face_h
    for (x0, ty, w, th, fh) in specs:
        # 윗면(테라스)
        for j in range(th):
            for i in range(w):
                t = 5 if rnd(x0 + i, ty + j, 67) > 0.08 else 4
                if j == 0: t = 2
                if j == 1: t = 6
                c.P(x0 + i, ty + j, 'adobe', t)
        c.VL(x0, ty, th, 'adobe', 2); c.VL(x0 + w - 1, ty, th, 'adobe', 1)
        # 앞면(흙벽돌 단, 세로 버팀벽 줄)
        BP.wall_tex(c, x0, ty + th, w, fh, 'adobe', 'stone', 67)
        for k in range(x0 + 6, x0 + w - 4, 10):
            c.VL(k, ty + th, fh, 'adobe', 4); c.VL(k + 1, ty + th, fh, 'adobe', 2)
        c.HL(x0, ty + th, w, 'adobe', 6); c.HL(x0, ty + th + 1, w, 'adobe', 2)
        c.VL(x0, ty + th, fh, 'adobe', 1); c.VL(x0 + w - 1, ty + th, fh, 'adobe', 0); c.HL(x0, ty + th + fh - 1, w, 'adobe', 1)
    # 꼭대기 사당(작은 집 + 청록 문)
    c.R(42, 0, 28, 6, 'adobe', 6); c.HL(42, 0, 28, 'adobe', 2)
    BP.wall_tex(c, 42, 6, 28, 12, 'adobe', None, 69); c.VL(42, 0, 18, 'adobe', 1); c.VL(69, 0, 18, 'adobe', 0)
    c.R(52, 8, 8, 10, 'turq', 2); c.HL(52, 8, 8, 'turq', 4)
    # 가운데 계단(밑에서 꼭대기 단까지): 디딤 윗면 밝음 + 챌판 어둡게, 양옆 난간
    for y in range(18, 96):
        for x in range(46, 66):
            t = 6 if (y % 3 == 0) else 4 if y % 3 == 1 else 2
            if x in (46, 47): t = 3
            if x in (64, 65): t = 1
            c.P(x, y, 'stone', t)
    c.HL(46, 95, 20, 'stone', 1)


@B('obelisk', '오벨리스크', 1, 3, [], ['오벨리스크', '유적', '광장'], '광장·궁전 문 앞·피라미드 길 양옆에 짝으로. 무늬는 글자 아닌 띠.', kind='column')
def _(c):
    # 받침(윗면 + 앞면)
    c.R(1, 38, 14, 4, 'stone', 6); c.HL(1, 38, 14, 'stone', 2)
    BP.wall_tex(c, 1, 42, 14, 6, 'stone', 'stone', 71); c.VL(1, 38, 10, 'stone', 1); c.VL(14, 38, 10, 'stone', 0); c.HL(1, 47, 14, 'stone', 1)
    # 몸통: 위로 좁아짐, 왼쪽 밝음
    for y in range(6, 39):
        u = (y - 6) / 32
        hw = 3 + u * 1.6
        for x in range(int(8 - hw), int(8 + hw + 0.99)):
            dx = (x + 0.5 - 8) / hw
            t = 5 if dx < -0.25 else 4 if dx < 0.35 else 2
            if (y - 6) % 6 == 5 and abs(dx) < 0.6: t -= 1            # 띠 새김(글자 아님)
            c.P(x, y, 'stone', t)
    # 피라미디온(금)
    for y in range(0, 6):
        hw = y * 0.55
        for x in range(int(8 - hw - 0.5), int(8 + hw + 0.5) + 1):
            c.P(x, y, 'gold', 5 if x < 8 else 3)


# ═════════════ 천막 ═════════════
def tent_body(c, x0, y0, w, ridge_h, wall_h, cloth, stripe=None, open_=True, s=0):
    """천막: 윗면(능선에서 앞으로 내려오는 지붕 천, 위에서 비스듬히 보인다) + 앞 처마 술 + 낮은 앞 휘장(가운데 열린 입구).
    천은 세로 솔기 줄(밝음/어두움), 능선 줄 가장 밝다. 바깥 줄(당김줄)·말뚝."""
    T = BP.top(cloth)
    for j in range(ridge_h):
        u = j / max(1, ridge_h - 1)
        for i in range(w):
            t = T - 1 if u < 0.25 else T - 2 if u < 0.7 else T - 3
            if j == 0: t = T
            if stripe and (i // 4) % 2 == 1: m, tt = stripe, max(0, t - (1 if BP.top(stripe) < T else 0))
            else: m, tt = cloth, t
            if i % 8 == 0: tt = max(0, tt - 1)              # 솔기
            if i == 0: tt = max(0, tt - 1)
            if i == w - 1: tt = max(0, tt - 2)
            c.P(x0 + i, y0 + j, m, min(BP.top(m), tt))
    # 처마 술(물결 끝)
    ey = y0 + ridge_h
    for i in range(w):
        c.P(x0 + i, ey, cloth, 1)
        if i % 3 != 1: c.P(x0 + i, ey + 1, cloth, 2)
    # 앞 휘장
    for j in range(wall_h):
        for i in range(1, w - 1):
            t = 2 if (i // 3) % 2 else 3
            if j == 0: t = 1
            c.P(x0 + i, ey + 2 + j, cloth, t)
    c.HL(x0 + 1, ey + 2 + wall_h - 1, w - 2, cloth, 1)
    if open_:
        dw = 12; dx = x0 + (w - dw) // 2
        for j in range(wall_h + 2):
            for i in range(dw):
                if j < 2 and (i in (0, dw - 1)): continue
                c.P(dx + i, ey + j, 'void', 1 if j < 4 else 2)
        # 걷어 올린 휘장 자락
        c.R(dx - 2, ey + 1, 3, 4, cloth, T - 1); c.R(dx + dw - 1, ey + 1, 3, 4, cloth, T - 2)
        c.HL(dx, ey + 2 + wall_h, dw, 'rug' if False else 'red', 3)          # 입구 깔개
    # 기둥 끝·당김줄·말뚝
    for px_ in (x0 + 1, x0 + w - 2):
        c.VL(px_, y0 - 3, 4, 'wood', 3); c.P(px_, y0 - 4, 'wood', 5)


@B('dovecote', '비둘기 탑(흙벽돌)', 2, 4, [], ['비둘기 탑', '오아시스', '밭', '탑'], '과수원·밭 가장자리 모래 위에 하나. 막힘. 집 줄에는 넣지 않는다.', kind='column')
def _(c):
    """이집트·페르시아 들판의 흙벽돌 비둘기 탑: 위로 좁아지는 둥근 탑(앞면 명암) + 층마다 둥지 구멍 줄 + 꽂은 횃대 + 둥근 지붕 윗면."""
    W = 32
    for y in range(8, 63):
        u = (y - 8) / 55
        half = 9 + u * 5.5
        for x in range(W):
            dx = (x + 0.5 - 16) / half
            if abs(dx) > 1: continue
            t = 5 if dx < -0.45 else 4 if dx < 0.2 else 3 if dx < 0.65 else 2
            c.P(x, y, 'adobe', t)
        if y % 11 == 6:                      # 층 띠(얕은 그림자)
            for x in range(W):
                if c.on(x, y): c.P(x, y, 'adobe', max(1, c.get(x, y)[1] - 2))
    for row, y in enumerate((16, 30, 44)):
        half = 9 + (y - 8) / 55 * 5.5
        for k in (-2, -1, 0, 1, 2):
            x = int(16 + k * half / 2.8) + (row % 2)
            if c.on(x, y) and c.on(x, y + 2):
                c.R(x, y, 1, 2, 'void', 1); c.P(x + 1, y, 'adobe', 2)
        c.HL(int(16 - half) + 2, y + 3, int(half * 2) - 4, 'wood', 4)       # 횃대(밝은 막대)
    c.ell(16, 8, 9.2, 4, lambda x, y, dx, dy, d: ('adobe', 6 if dy < -0.2 and dx < 0.3 else 5) if d < 0.85 else ('adobe', 3))
    c.ell(16, 5, 4, 2.2, lambda x, y, dx, dy, d: ('plaster', 5 if dy < 0 else 4))
    c.P(16, 2, 'plaster', 5); c.P(16, 3, 'plaster', 4)
    c.HL(4, 63, 24, 'adobe', 0)
    c.outline(bottom=('adobe', 0))


@B('tent-bedouin', '유목 검은 천막', 3, 2, [1], ['천막', '유목', '오아시스'], '오아시스·대상 야영지. 입구 칸(entrance) 아래를 비운다. 천막끼리 1칸 띄운다.')
def _(c):
    """검은 염소털 천막(바이트 샤르): 기둥 셋이 밀어 올린 물결 지붕(윗면) + 처진 처마 + 가운데 걷어 올린 앞 휘장(안쪽 그늘·깔개) + 양옆 당김줄."""
    import math
    W, POLES = 48, (9, 24, 39)
    def top_y(x):                        # 지붕 윗선: 기둥 끝에서 솟고 사이에서 처진다
        d = min(abs(x + 0.5 - p) for p in POLES)
        return 4 + min(4.0, d * d / 14.0)
    def eave_y(x):                       # 처마선: 기둥 사이에서 한 화소 처짐
        d = min(abs(x + 0.5 - p) for p in POLES)
        return 18 + (1 if d > 5 else 0)
    for x in range(2, W - 2):
        ty, ey = top_y(x), eave_y(x)
        d = min(abs(x + 0.5 - p) for p in POLES)
        for y in range(int(math.ceil(ty)), ey):
            u = (y - ty) / max(1.0, ey - ty)
            t = 4 if d < 2.5 and u < 0.5 else 3 if u < 0.35 else 2 if u < 0.8 else 1   # 기둥 끝 주름 밝게, 처마 쪽 어둡게
            if x < 4 or x > W - 5: t -= 1
            c.P(x, y, 'dwood', max(0, t))
            if y == int(math.ceil(ty)): c.P(x, y, 'dwood', min(4, t + 1))
        # 짜 넣은 밝은 띠 두 줄(지붕을 따라 굽는다)
        for k in (0.38, 0.72):
            yy = int(round(ty + (ey - ty) * k))
            c.P(x, yy, 'hide', 2 if k < 0.5 else 1)
        c.P(x, ey, 'dwood', 0)          # 처마 끝 그늘
    # 기둥 끝(천 위로 살짝)
    for px in POLES: c.VL(px, 2, 3, 'wood', 4); c.P(px, 2, 'wood', 5)
    # 앞 휘장: 양옆 닫힘(세로 줄무늬) · 가운데 열림
    for y in range(19, 31):
        for x in range(4, W - 4):
            if 17 <= x <= 30: continue
            t = 2 if (x // 3) % 2 else 1
            if (x // 6) % 4 == 1: c.P(x, y, 'hide', 1); continue
            c.P(x, y, 'dwood', t)
    # 열린 입구: 안쪽 그늘 + 깔개 + 방석
    c.R(17, 19, 14, 12, 'void', 1); c.R(17, 19, 14, 3, 'void', 0)
    c.R(18, 27, 12, 4, 'red', 2); c.HL(18, 27, 12, 'red', 3); c.HL(19, 29, 10, 'saffron', 2)
    c.R(19, 24, 4, 3, 'indigo', 2); c.HL(19, 24, 4, 'indigo', 3)
    # 걷어 올린 앞 처마(가운데) + 받침 기둥 둘
    for x in range(15, 33):
        c.P(x, 18, 'dwood', 3); c.P(x, 19, 'dwood', 2 if x % 4 else 1)
    for px in (16, 31): c.VL(px, 19, 12, 'wood', 3); c.P(px, 30, 'wood', 1)
    # 양옆 당김줄 + 말뚝
    for (x0, y0, x1, y1) in ((4, 8, 0, 25), (43, 8, 47, 25)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            c.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), 'hide', 1)
    c.R(0, 25, 1, 3, 'wood', 2); c.R(47, 25, 1, 3, 'wood', 2)
    # 아래 바닥선(천 끝 그늘)
    c.HL(4, 31, W - 8, 'dwood', 0)


@B('tent-pavilion', '줄무늬 정자 천막', 3, 3, [1], ['천막', '바자르', '대상', '정자'], '광장·대상 숙소 마당·궁전 정원. 입구 아래를 비운다.')
def _(c):
    # 뾰족 지붕: 위에서 비스듬히 본 사각뿔(앞 면 넓고 옆 면 얇게) + 술 + 낮은 휘장
    W = 48
    for y in range(4, 30):
        u = (y - 4) / 25
        half = 2 + u * 21
        for x in range(W):
            d = abs(x + 0.5 - 24)
            if d > half: continue
            stripe = int((x + 0.5 - 24) / max(1, half) * 4 + 4) % 2 == 0
            m = 'red' if stripe else 'plaster'
            t = (4 if m == 'red' else 5) if x < 24 else (3 if m == 'red' else 4)
            if d > half - 1.5: t -= 1
            if y > 26: t -= 1
            c.P(x, y, m, max(0, t))
    c.VL(24, 0, 5, 'gold', 3); c.P(24, 0, 'gold', 5)
    for x in range(1, W - 1):
        c.P(x, 30, 'red', 1)
        if x % 3 != 1: c.P(x, 31, 'saffron', 3)
    for j in range(32, 46):
        for x in range(2, W - 2):
            t = 3 if (x // 4) % 2 else 2
            c.P(x, j, 'plaster', t)
    c.HL(2, 45, W - 4, 'plaster', 0)
    for j in range(32, 46):
        for x in range(18, 30): c.P(x, j, 'void', 1 if j < 36 else 2)
    c.R(15, 33, 4, 6, 'red', 3); c.R(29, 33, 4, 6, 'red', 2)
    for x in (2, W - 3): c.VL(x, 30, 16, 'wood', 3)


@B('tent-small', '작은 천 천막', 2, 2, [], ['천막', '야영'], '야영지·대상 길가. 막힘.', kind='structure')
def _(c):
    """남북 능선 A자 천막: 위에서 본 두 비탈(서 밝음·동 어둠, 줄무늬 천) + 남쪽 삼각 앞면(닫힌 휘장 틈) + 말뚝 줄."""
    for y in range(3, 31):
        u = (y - 3) / 27
        half = 4 + u * 10.5
        for x in range(32):
            dx = x + 0.5 - 16
            if abs(dx) > half: continue
            stripe = int((y - 3) / 4) % 2 == 0
            if dx < 0: m, t = ('saffron', 4) if stripe else ('plaster', 5)
            else: m, t = ('saffron', 2) if stripe else ('plaster', 3)
            if abs(dx) > half - 1.2: t -= 1
            c.P(x, y, m, max(0, t))
        c.P(16, y, 'plaster', 5 if y < 18 else 4)   # 능선 줄
    # 남쪽 앞면: 삼각 휘장(그늘진 천) + 가운데 닫힌 틈
    for y in range(18, 31):
        half = (y - 17) * 0.95
        for x in range(32):
            dx = x + 0.5 - 16
            if abs(dx) > half: continue
            c.P(x, y, 'plaster', 2 if dx < 0 else 1)
    c.VL(16, 19, 12, 'void', 1); c.VL(15, 24, 7, 'plaster', 0)
    c.HL(3, 31, 26, 'plaster', 0)
    c.VL(16, 1, 3, 'wood', 3); c.P(16, 1, 'wood', 5)
    for (x0, y0, x1, y1) in ((6, 12, 0, 26), (25, 12, 31, 26)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1): c.P(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), 'hide', 1)
    c.R(0, 26, 1, 3, 'wood', 2); c.R(31, 26, 1, 3, 'wood', 2)


# ═════════════ 대상 숙소 문루·폐허 ═════════════
@B('caravanserai-gate', '대상 숙소 문루(이완 통로)', 6, 5, [], ['대상 숙소', '문루', '성벽'],
   '대상 숙소(성벽 사각 둘레)의 남쪽 가운데. 가운데 두 칸(x 2·3)이 통로라 걸어 지나간다 — 앞뒤를 길로 잇는다. 양옆은 wall-h 로 이어진다.',
   passable=[(2, 0), (3, 0), (2, 1), (3, 1), (2, 2), (3, 2), (2, 3), (3, 3), (2, 4), (3, 4)])
def _(c):
    W = 96
    # 양옆 망루(원통 반쯤)
    for cx in (9, 86):
        for y in range(10, 80):
            for i in range(-9, 10):
                dx = i / 9.5
                t = 5 if dx < -0.4 else 4 if dx < 0.3 else 2 if dx < 0.75 else 1
                if (y - 10) % 5 == 4: t -= 1
                if y == 79: t = 0
                c.P(cx + i, y, 'stone', max(0, t))
        c.ell(cx, 10, 10, 4, lambda x, y, dx, dy, d: ('stone', 6 if dy < 0 else 4))
        for i in range(-10, 11, 4): c.R(cx + i, 4, 2, 4, 'stone', 5); c.HL(cx + i, 4, 2, 'stone', 6)
        c.R(cx - 1, 34, 2, 8, 'void', 1)
    BP.pishtaq(c, 18, 8, 60, 72, mat='stone', s=77, no_door=True)
    # 통로: 반원 아치 28×40 — 위쪽은 어두운 굴(머리 위 칸), 아래 16줄은 투명(땅이 보이고 걸어 지나간다)
    m = BP.arch_mask(28, 40, r=14)
    for (i, j) in m:
        X, Y = 34 + i, 40 + j
        if Y >= 64: c.P(X, Y, None, 0)
        else: c.P(X, Y, 'void', 0 if j < 14 else 1 if Y < 58 else 2)
    for (i, j) in m:
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (-2, 0), (2, 0), (-1, -1), (1, -1), (0, -2)):
            if (i + dx, j + dy) not in m and 40 + j + dy < 80:
                c.P(34 + i + dx, 40 + j + dy, 'stone', 6 if dx <= 0 else 3)


@B('ruin-wall', '무너진 사암 벽', 3, 2, [], ['폐허', '유적'], '폐허·피라미드 둘레·모래 속. 2~3개를 어긋나게. 둘레에 돌 부스러기(rubble)를 곁들인다.')
def _(c):
    # 단(5px 줄)마다 남은 돌 수 — 왼쪽은 높게 서 있고 가운데 무너지고 오른쪽 낮게. 벽 두께 = 윗면 5줄.
    heights = [5, 5, 5, 4, 4, 3, 2, 1, 1, 2, 2, 2, 1, 1]      # 3px 폭 기둥마다 남은 줄 수
    base = 30
    for k, hc in enumerate(heights):
        x0 = 2 + k * 3
        topy = base - hc * 5 - 5
        for x in range(x0, x0 + 3):
            for y in range(topy, base):
                if y < topy + 5:
                    t = 6 if y == topy else 5 if y < topy + 4 else 3
                else:
                    row = (y - 1) // 5; ly = (y - 1) % 5; xs = x + (5 if row % 2 else 0)
                    t = 1 if (ly == 4 or xs % 10 == 9) else 3 + (h32(xs // 10, row, 79) % 3 == 0)
                c.P(x, y, 'stone', t)
        # 옆 끊긴 면(어둡게)
        if k + 1 < len(heights) and heights[k + 1] < hc:
            for y in range(topy, base - heights[k + 1] * 5 - 5): c.P(x0 + 2, y, 'stone', 2)
        if k > 0 and heights[k - 1] < hc:
            for y in range(topy, base - heights[k - 1] * 5 - 5): c.P(x0, y, 'stone', 5)
    c.VL(2, 0, base, 'stone', 1)
    for (bx, by, bw) in ((33, 26, 6), (40, 27, 5), (22, 27, 4)):
        c.R(bx, by - 3, bw, 3, 'stone', 6); c.R(bx, by, bw, 3, 'stone', 3); c.HL(bx, by + 2, bw, 'stone', 1)
    c.HL(2, base, 44, 'stone', 1)


@B('ruin-arch', '무너진 아치 문', 3, 3, [], ['폐허', '유적', '아치'], '폐허 마당의 표식. 아치 밑(가운데 아랫칸)은 걸어 지나간다.', passable=[(1, 2)])
def _(c):
    for x0 in (2, 32):
        w = 14
        BP.wall_tex(c, x0, 14, w, 32, 'stone', 'stone', 81)
        c.R(x0 - 1, 9, w + 2, 5, 'stone', 6); c.HL(x0 - 1, 9, w + 2, 'stone', 2); c.HL(x0 - 1, 13, w + 2, 'stone', 3)
        c.VL(x0, 14, 32, 'stone', 1); c.VL(x0 + 1, 14, 32, 'stone', 5); c.VL(x0 + w - 1, 9, 37, 'stone', 0); c.VL(x0 + w - 2, 14, 32, 'stone', 2)
        c.HL(x0, 45, w, 'stone', 1)
    # 아치 쐐기돌: 왼쪽부터 5개만 남음(오른쪽 반은 무너짐)
    cx, cy, R0, R1 = 24, 22, 9, 17
    a_c = C(48, 48)
    for y in range(0, 24):
        for x in range(8, 40):
            dx, dy = x + 0.5 - cx, cy - (y + 0.5)
            r = math.hypot(dx, dy)
            if R0 <= r <= R1 and dy >= -1:
                a = math.degrees(math.atan2(dy, dx))
                if a < 70: continue
                k = int((180 - a) / 22)
                t = 5 if r > R1 - 2 else 4 if r > R0 + 2 else 3
                if int((180 - a) * 10) % 220 < 18: t = 2
                if r < R0 + 1: t = 2
                a_c.P(x, y, 'stone', t)
    a_c.outline(mat='stone', t=1, bottom=('stone', 1))
    c.paste(a_c, 0, 0)
    c.R(36, 40, 7, 5, 'stone', 4); c.HL(36, 40, 7, 'stone', 6); c.HL(36, 44, 7, 'stone', 1)
    c.R(30, 42, 4, 3, 'stone', 5); c.HL(30, 44, 4, 'stone', 1)

if __name__ == '__main__':
    R.export()
    ims = [(it['id'], R.render(it).img()) for it in R.items]
    contact(ims, os.path.join(OUT, 'buildings', 'preview.png'), z=4, W=1800)
    print('buildings', len(R.items))
