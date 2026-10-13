#!/usr/bin/env python3
"""sengoku_edo 건물 — 한 장을 16px 칸에 맞춰 그린다(칸 경계에 문·기둥·창 칸을 맞춰 같은 칸이 재사용되게).

척도: 1층 = 2줄(들보 3 + 개구부 26 + 기단 3), 츠시 2층 = 1줄(회벽 9 + 차양 7), 지붕 = 2~4줄. 문 = 폭 16 × 높이 26(사람 16×24).
entrance = 바닥 줄의 문 칸 x 목록(문 칸은 막힘, 바로 아래 접근칸은 걸을 수 있게 비운다). walk = 지나갈 수 있는 칸(문루·도리이 통로, 머리 위 층).

  python3 buildings.py      # tiledata/sengoku-edo/buildings/_gate/*.png + preview
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32
from arch import (gable_roof, hip_roof, thatch_roof, hisashi, chidori_hafu, onigawara, plaster, post, beam, base_stone, lattice,
                  noren_door, itado, shoji, mushiko, namako, boards, bars_window, chochin, clamp, _tile_px)
from kit import Reg, contact, OUT

R = Reg('buildings')
T = 16


def B(id_, name, w, h, door, tags, rules, kind='structure', walk=()):
    def deco(fn):
        R.add(id_, name, w, h, kind, tags=tags, rules=rules, entrance=list(door) if door is not None else [], walk=[list(c) for c in walk])(fn)
        return fn
    return deco


# ═══════════════ 공통 조각 ═══════════════
def inuyarai(c, x, y, w):
    """견시(이누야라이): 벽 밑 둥글게 휜 대나무 울 6행."""
    for i in range(w):
        for j in range(6):
            arc = 5 - int(round(((i % 16) - 7.5) ** 2 / 14))
            if j < max(0, 5 - arc - 0) - 0: continue
        k = (i % 16)
        top = 1 + int(round(((k - 7.5) / 7.5) ** 2 * 2))
        for j in range(top, 6):
            if i % 2 == 0: c.P(x + i, y + j, 'kaya', 5 if j == top else 3)
            else: c.P(x + i, y + j, 'kaya', 2 if j > top else 4)
        c.P(x + i, y + top - 1, 'kaya', 6) if i % 2 == 0 else None


def lattice_bay(c, x, y1, inu=True):
    """1층 격자창 칸(16×26): 격자 + 밑 견시."""
    lattice(c, x, y1 + 3, 16, 20 if inu else 26)
    if inu:
        c.R(x, y1 + 23, 16, 6, 'kuro', 2); c.HL(x, y1 + 23, 16, 'kuro', 3)
        inuyarai(c, x, y1 + 23, 16)


def first_floor(c, x0, y1, bays, cloth='ai', wall='kuro'):
    """1층 영역(2줄, y1 = 영역 위). bays: 칸마다 'L'(격자) 'N'(노렌 문) 'D'(판자 문) 'S'(장지) 'B'(판자벽) 'W'(회벽) 'O'(열린 가게) 'P'(회벽+살창)."""
    w = len(bays) * 16
    beam(c, x0, y1, w, 'kuro')
    for i, b in enumerate(bays):
        x = x0 + i * 16
        if b == 'L': lattice_bay(c, x, y1)
        elif b == 'l': lattice_bay(c, x, y1, inu=False)
        elif b == 'N': noren_door(c, x, y1 + 3, cloth=cloth)
        elif b == 'D': itado(c, x, y1 + 3, mat='ki')
        elif b == 'K': itado(c, x, y1 + 3, mat='kuro')
        elif b == 'S': shoji(c, x, y1 + 3, 16, 26)
        elif b == 'B': boards(c, x, y1 + 3, 16, 26, 'ki', 3)
        elif b == 'b': boards(c, x, y1 + 3, 16, 26, 'kuro', 3)
        elif b == 'W': plaster(c, x, y1 + 3, 16, 26, 'shikkui', 4)
        elif b == 'T': plaster(c, x, y1 + 3, 16, 26, 'tsuchi', 3)
        elif b == 'P':
            plaster(c, x, y1 + 3, 16, 26, 'shikkui', 4); bars_window(c, x + 3, y1 + 7, 10, 10, 'kuro')
        elif b == 'O': open_shop(c, x, y1 + 3, i)
    for i in range(len(bays) + 1):
        px_ = x0 + i * 16 - (1 if i else 0)
        if 0 < i < len(bays) and bays[i - 1] not in 'NDK' and bays[i] not in 'NDK':
            c.VL(px_, y1 + 3, 26, 'kuro', 2)
    base_stone(c, x0, y1 + 29, w)


def open_shop(c, x, y, k=0):
    """열린 가게 칸(16×26): 안쪽 어둠 + 뒤 선반 2단 물건 덩이(쌀섬·피륙·항아리 — 색 덩이, 글자 없음) + 앞 평상(윗면 밝게)."""
    c.R(x, y, 16, 26, 'kuro', 1)
    goods = [('kaya', 4), ('ai', 3), ('kaki', 3), ('tsuchi', 4), ('shikkui', 4), ('momiji', 3)]
    for row, gy in enumerate((y + 3, y + 10)):
        c.HL(x, gy + 5, 16, 'ki', 3)
        for i in range(1, 15, 4):
            m, t = goods[(h32(x // 16 + i, row, k + 3)) % len(goods)]
            c.R(x + i, gy + 1, 3, 4, m, t); c.HL(x + i, gy + 1, 3, m, clamp(m, t + 1)); c.VL(x + i + 2, gy + 1, 4, m, clamp(m, t - 1))
    # 앞 평상(미세 평대): 윗면 5행 + 앞면 3행
    c.R(x, y + 17, 16, 5, 'ki', 5); c.HL(x, y + 17, 16, 'ki', 3); c.HL(x, y + 21, 16, 'ki', 6)
    for i in range(1, 15, 5):
        m, t = goods[(h32(x // 16, i, k + 9)) % len(goods)]
        c.R(x + i, y + 18, 3, 2, m, t)
    c.R(x, y + 22, 16, 4, 'ki', 2); c.HL(x, y + 22, 16, 'ki', 1)


def upper_floor(c, x0, y, w, wall='shikkui', windows='mushiko', base=4, cols=None):
    """츠시 2층 한 줄(16): 회벽 9 + 차양 7. windows: mushiko | shoji | none."""
    plaster(c, x0, y, w, 9, wall, base)
    c.HL(x0, y, w, 'kuro', 3)
    for i in range(w // 16):
        if cols is not None and i not in cols: continue
        if windows == 'mushiko': mushiko(c, x0 + i * 16 + 3, y + 1, 10, 7)
        elif windows == 'shoji': shoji(c, x0 + i * 16 + 2, y + 1, 12, 8)
    hisashi(c, x0, y + 9, w)


def roof_rows(c, kind, x0, y0, w, h, **kw):
    if kind == 'gable': gable_roof(c, x0, y0, w, h, **kw)
    elif kind == 'hip': hip_roof(c, x0, y0, w, h, **kw)
    elif kind == 'thatch': thatch_roof(c, x0, y0, w, h, **kw)


def sugidama(c, x, y):
    """스기다마(삼나무 공, 술집 표시): 둥근 짙은 초록 공 + 매단 줄."""
    c.VL(x + 4, y, 2, 'kuro', 2)
    c.ell(x + 4.5, y + 7, 4.2, 4.2, lambda X, Y, dx, dy, d: ('matsu', 4 if dx < -0.2 and dy < 0 else 3 if d < 0.6 else 2) if d < 0.8 else ('matsu', 1))


# ═══════════════ 성하마을 상가(마치야) ═══════════════
@B('machiya-a', '마치야(2층, 흰 회벽 무시코창 + 격자, 쪽빛 노렌)', 4, 5, [1], ['마치야', '상가', '성하마을', '집'],
   '큰길 양옆에 처마를 맞춰 줄지어 선다(옆 건물과 붙여도 된다). 문 앞 1칸은 길.')
def _(c):
    gable_roof(c, 0, 0, 64, 32)
    upper_floor(c, 0, 32, 64)
    first_floor(c, 0, 48, 'LNLL')


@B('machiya-b', '마치야(단층, 짙은 판자벽 + 격자, 감물빛 노렌)', 3, 4, [1], ['마치야', '상가', '성하마을', '집'],
   '골목·큰길 양옆. 2층 마치야 사이에 섞어 지붕선을 들쭉날쭉하게.')
def _(c):
    gable_roof(c, 0, 0, 48, 32)
    first_floor(c, 0, 32, 'bNL', cloth='kaki')


@B('machiya-c', '마치야(2층, 황토 회벽 + 격자, 폭 3)', 3, 5, [2], ['마치야', '상가', '성하마을', '집'],
   '마치야 줄의 변주. 황토빛 2층 벽.')
def _(c):
    gable_roof(c, 0, 0, 48, 32)
    upper_floor(c, 0, 32, 48, wall='tsuchi', base=4)
    first_floor(c, 0, 48, 'LLN', cloth='ai')


@B('shop-rice', '쌀가게(2층, 열린 가게 앞 + 쌀섬, 쪽빛 긴 노렌)', 4, 5, [0], ['가게', '상가', '쌀가게', '성하마을'],
   '큰길 상가. 열린 가게 앞(평상)은 막힘 — 들어가는 칸은 왼쪽 노렌 문.')
def _(c):
    gable_roof(c, 0, 0, 64, 32)
    upper_floor(c, 0, 32, 64)
    first_floor(c, 0, 48, 'NOOL', cloth='ai')
    # 가게 앞 긴 노렌(두 칸에 걸친 천 막, 위 9px)
    for i in range(16, 48):
        for j in range(51, 59):
            t = 3 if j < 57 else 2
            if (i - 16) % 8 == 0: t = 1
            if j == 51: t = 4
            c.P(i, j, 'ai', t)


@B('shop-sake', '술도가(2층, 흰 회벽 + 스기다마, 폭 5)', 5, 5, [2], ['가게', '술집', '술도가', '성하마을'],
   '큰길·강가. 처마 밑 삼나무 공(스기다마)이 술집 표시.')
def _(c):
    gable_roof(c, 0, 0, 80, 32)
    upper_floor(c, 0, 32, 80, cols=(0, 1, 3, 4))
    plaster(c, 32 + 2, 33, 12, 7, 'shikkui', 5)
    first_floor(c, 0, 48, 'WLNLW', cloth='shikkui')
    for bx in (0, 64):
        c.R(bx, 51 + 18, 16, 8, 'kawara', 3); namako(c, bx, 51 + 17, 16, 9)
    sugidama(c, 21, 49)


@B('shop-cloth', '포목점(2층, 감물빛 긴 노렌 + 피륙 진열, 폭 5)', 5, 5, [4], ['가게', '포목점', '상가', '성하마을'],
   '큰길 상가 가운데. 열린 가게 칸은 막힘, 오른쪽 끝 노렌 문으로 드나든다.')
def _(c):
    gable_roof(c, 0, 0, 80, 32)
    upper_floor(c, 0, 32, 80)
    first_floor(c, 0, 48, 'LOOON', cloth='kaki')
    for i in range(16, 64):
        for j in range(51, 60):
            t = 3 if j < 58 else 2
            if (i - 16) % 8 == 0: t = 1
            if j == 51: t = 4
            c.P(i, j, 'kaki', t)


@B('chaya', '찻집(단층, 발 드리운 열린 앞 + 붉은 초롱)', 4, 4, [1], ['찻집', '가도', '성하마을', '쉼터'],
   '가도·참배길 옆. 앞에 붉은 천 평상(se-bench-red)을 1~2개 둔다. 문 앞 칸은 비운다.')
def _(c):
    gable_roof(c, 0, 0, 64, 32)
    y1 = 32
    beam(c, 0, y1, 64, 'ki')
    for bx in (0, 32, 48):
        c.R(bx, y1 + 3, 16, 26, 'kuro', 1)
        shoji(c, bx + 2, y1 + 8, 12, 18, lit=True)
        # 발(스다레): 위에서 9행 드리운 대나무 발
        for j in range(9):
            for i in range(16):
                c.P(bx + i, y1 + 3 + j, 'kaya', 5 if j % 2 == 0 else 3)
        c.HL(bx, y1 + 12, 16, 'kaya', 2)
    noren_door(c, 16, y1 + 3, cloth='shu')
    for px_ in (0, 31, 47, 63): c.VL(px_, y1, 29, 'ki', 2)
    base_stone(c, 0, y1 + 29, 64)
    chochin(c, 2, y1 + 3, 'shu', 'kuro', glow=False)
    chochin(c, 57, y1 + 3, 'shu', 'kuro', glow=False)


@B('chaya-thatch', '가도 찻집(초가, 열린 앞 + 발)', 4, 4, [2], ['찻집', '가도', '쉼터', '농촌'],
   '가도(삼나무 길)·고갯길 옆. 앞에 붉은 천 평상. 문 앞 칸은 비운다.')
def _(c):
    thatch_roof(c, 0, 0, 64, 34, inset=7)
    y1 = 32
    for bx in (0, 16, 48):
        c.R(bx, y1 + 3, 16, 26, 'kuro', 1)
        shoji(c, bx + 2, y1 + 10, 12, 16)
        for j in range(8):
            for i in range(16): c.P(bx + i, y1 + 3 + j, 'kaya', 5 if j % 2 == 0 else 3)
        c.HL(bx, y1 + 11, 16, 'kaya', 2)
    itado(c, 32, y1 + 3, mat='ki', open_=True)
    for px_ in (0, 15, 31, 47, 63): c.VL(px_, y1 + 2, 27, 'ki', 3)
    base_stone(c, 0, y1 + 29, 64)
    thatch_roof(c, 0, 0, 64, 34, inset=7)
    chochin(c, 51, y1 + 2, 'shu', 'kuro')


@B('ryokan', '여관·하타고(2층, 난간 + 장지 + 초롱, 폭 7)', 7, 6, [3], ['여관', '하타고', '숙소', '성하마을', '가도'],
   '가도 숙장 큰길. 문 양옆 초롱. 앞 2칸은 비우고 돌길로 잇는다.')
def _(c):
    gable_roof(c, 0, 0, 112, 32)
    # 2층(2줄): 황토 회벽 + 기둥 + 장지 + 툇마루 난간 + 차양
    y = 32
    plaster(c, 0, y, 112, 25, 'tsuchi', 4)
    c.HL(0, y, 112, 'kuro', 3)
    for i in range(7):
        shoji(c, i * 16 + 2, y + 2, 12, 16, lit=True)
    for i in range(8): c.VL(min(111, i * 16), y, 25, 'ki', 2)
    c.HL(0, y + 13, 112, 'ki', 5); c.HL(0, y + 14, 112, 'ki', 3)
    for i in range(0, 112, 4): c.VL(i + 1, y + 15, 5, 'ki', 2); c.VL(i + 2, y + 15, 5, 'ki', 4)
    c.HL(0, y + 20, 112, 'ki', 4); c.HL(0, y + 21, 112, 'ki', 1)
    c.R(0, y + 22, 112, 3, 'tsuchi', 2)
    hisashi(c, 0, y + 25, 112)
    first_floor(c, 0, 64, 'LLSNSLL', cloth='ai')
    chochin(c, 43, 68, 'washi', 'kuro'); chochin(c, 64, 68, 'washi', 'kuro')


@B('onsen', '목욕탕·온천(가라하후 박공 현관, 두 빛 노렌, 폭 6)', 6, 5, [2, 3], ['목욕탕', '온천', '센토', '성하마을'],
   '마을 안쪽·강가. 현관 2칸(남탕·여탕) 앞 2칸은 비운다.')
def _(c):
    hip_roof(c, 0, 0, 96, 40, inset=12, gable_frac=0.3)
    y1 = 48
    plaster(c, 0, 38, 96, 10, 'shikkui', 4)
    for bx in (0, 16, 64, 80): mushiko(c, bx + 3, 39, 10, 7)
    first_floor(c, 0, y1, 'bLNNLb', cloth='ai')
    noren_door(c, 48, y1 + 3, cloth='shu')
    # 가라하후(물결 박공) 현관 지붕: 두 문 위, 가운데가 둥글게 솟은 곡선 지붕
    cx = 48
    for i in range(-22, 22):
        import math
        d = abs(i + 0.5) / 22
        top = int(round(36 + 10 * (1 - math.cos(min(1, d) * math.pi)) / 2 - (4 if d < 0.35 else 0) * (1 - d / 0.35)))
        for j in range(top, 52):
            x = cx + i
            k = j - top
            if k == 0: c.P(x, j, 'sumi', 1)
            elif k <= 2: c.P(x, j, 'kawara', 6 if i < 0 else 5)
            elif j < 49: c.P(x, j, *_tile_px('kawara', i + 40, k, 4))
            elif j == 49: c.P(x, j, 'kawara', 5 if (i + 40) % 4 == 0 else 2)
            elif j == 50: c.P(x, j, 'kuro', 3)
            else: c.P(x, j, 'sumi', 1)
    for i in range(-22, 22):
        c.P(cx + i, 51, 'kin', 3 if abs(i) < 3 else 2) if abs(i) < 3 else None


@B('smithy', '대장간(단층, 판자벽 + 열린 화덕 불빛, 연기창 지붕)', 4, 4, [1], ['대장간', '공방', '성하마을'],
   '마을 변두리·강가. 앞에 숫돌·물통(se-bucket-stack). 문 앞 칸은 비운다.')
def _(c):
    gable_roof(c, 0, 4, 64, 28)
    # 지붕 위 연기창(작은 솟을지붕)
    gable_roof(c, 20, 0, 24, 10, ridge=4, oni=False)
    c.R(22, 9, 20, 3, 'kuro', 1)
    y1 = 32
    beam(c, 0, y1, 64, 'kuro')
    boards(c, 0, y1 + 3, 16, 26, 'kuro', 3)
    itado(c, 16, y1 + 3, mat='kuro', open_=True)
    # 열린 작업장(2칸): 화덕 불빛 + 모루 실루엣
    c.R(32, y1 + 3, 32, 26, 'kuro', 0)
    c.R(36, y1 + 14, 12, 12, 'ishi', 2); c.HL(36, y1 + 14, 12, 'ishi', 4)
    c.R(38, y1 + 16, 8, 5, 'hi', 2); c.R(39, y1 + 17, 6, 3, 'hi', 3); c.P(41, y1 + 17, 'hi', 3)
    for j in range(y1 + 4, y1 + 14):
        for i in range(34, 50):
            d = ((i - 42) ** 2) / 40 + ((j - (y1 + 15)) ** 2) / 60
            if d < 1 and (i + j) % 2: c.P(i, j, 'hi', 0)
    c.R(52, y1 + 20, 8, 3, 'ishi', 3); c.HL(52, y1 + 20, 8, 'ishi', 5); c.R(55, y1 + 23, 3, 4, 'ishi', 1)
    c.VL(31, y1, 29, 'kuro', 2); c.VL(63, y1, 29, 'sumi', 1)
    base_stone(c, 0, y1 + 29, 64)


@B('dojo', '도장(단층 큰 팔작지붕, 판자벽 + 높은 격자창, 폭 7)', 7, 5, [3], ['도장', '무술', '검술', '성하마을', '무가'],
   '무가 마을·성 가까이. 앞 마당은 흙(road) 또는 자갈. 문 앞 2칸 비움.')
def _(c):
    hip_roof(c, 0, 0, 112, 48, inset=16, gable_frac=0.33)
    y1 = 48
    beam(c, 0, y1, 112, 'kuro')
    for i in range(7):
        x = i * 16
        if i == 3: itado(c, x, y1 + 3, mat='kuro'); continue
        boards(c, x, y1 + 3, 16, 26, 'ki', 3)
        lattice(c, x + 2, y1 + 4, 12, 7)
    for i in range(1, 7): c.VL(i * 16 - 1 if i != 3 and i != 4 else i * 16 - 1, y1 + 3, 26, 'kuro', 3)
    c.VL(0, y1, 29, 'sumi', 1); c.VL(111, y1, 29, 'sumi', 1)
    base_stone(c, 0, y1 + 29, 112)
    # 현관 돌계단
    c.R(48, y1 + 29, 16, 3, 'ishi', 5); c.HL(48, y1 + 31, 16, 'ishi', 2)




# ═══════════════ 무가 ═══════════════
def engawa(c, x, y, w):
    """툇마루: 판자 윗면 4 + 앞면 2 + 그늘."""
    for i in range(w):
        c.P(x + i, y, 'ki', 6); c.P(x + i, y + 1, 'ki', 5 if (x + i) % 8 else 4); c.P(x + i, y + 2, 'ki', 5); c.P(x + i, y + 3, 'ki', 4)
        c.P(x + i, y + 4, 'ki', 2); c.P(x + i, y + 5, 'ki', 1)


@B('samurai-house', '무가 저택 본채(팔작 기와, 장지 + 툇마루, 현관 박공, 폭 8)', 8, 5, [3, 4], ['무가', '저택', '사무라이', '무사'],
   '담(se-wall-plaster)으로 두른 마당 북쪽. 대문(se-samurai-gate)에서 현관까지 돌길. 앞마당에 소나무·석등·자갈 정원.')
def _(c):
    hip_roof(c, 0, 0, 128, 46, inset=18, gable_frac=0.32, curl=4)
    y1 = 46
    beam(c, 0, y1, 128, 'ki')
    for i in range(8):
        x = i * 16
        if i in (3, 4): continue
        shoji(c, x + 1, y1 + 3, 14, 20)
    for i in range(9): c.VL(min(127, i * 16), y1, 26, 'ki', 2)
    engawa(c, 0, y1 + 23, 128)
    # 현관: 두 칸 판자 문(안쪽 어둠) + 작은 박공 지붕
    for x in (48, 64): itado(c, x, y1 + 4, h=25, mat='ki', open_=(x == 64))
    c.R(44, y1 + 27, 40, 3, 'ishi', 5); c.HL(44, y1 + 29, 40, 'ishi', 2)
    gable_roof(c, 40, 36, 48, 15, ridge=4, oni=False)
    base_stone(c, 0, y1 + 29, 44); base_stone(c, 84, y1 + 29, 44)
    c.HL(44, y1 + 31, 40, 'sumi', 1)


def wall_cap(c, x, y, w, h=9, mat='kawara'):
    """담 지붕(갓 기와) — 위에서 보이는 윗면: 마루 + 양쪽 경사(앞 경사 넓게)."""
    for i in range(w):
        c.P(x + i, y, 'sumi', 1)
        c.P(x + i, y + 1, mat, 6); c.P(x + i, y + 2, mat, 4); c.P(x + i, y + 3, mat, 2)
        for k in range(4, h - 2): c.P(x + i, y + k, *_tile_px(mat, x + i, k, 4, course=9))
        c.P(x + i, y + h - 2, mat, 5 if (x + i) % 4 == 0 else 2)
        c.P(x + i, y + h - 1, 'sumi', 1)


@B('samurai-gate', '무가 대문(맞배 기와, 열린 두 짝 문, 폭 4)', 4, 4, None, ['무가', '대문', '저택', '사무라이'],
   '무가 저택 담 남쪽 가운데. 가운데 두 칸은 지나간다(머리 위는 문 지붕). 양옆 칸은 막힘. 담(se-wall-plaster)과 밑변을 맞춘다.',
   walk=[(1, 0), (2, 0), (1, 1), (2, 1), (1, 2), (2, 2), (1, 3), (2, 3)])
def _(c):
    # 양옆 담 몸(1칸씩)
    for x in (0, 48):
        plaster(c, x, 24, 16, 34, 'shikkui', 4)
        namako(c, x, 46, 16, 12)
        base_stone(c, x, 58, 16)
    # 기둥(굵게) + 문짝(안쪽으로 열림 — 기둥 옆 짙은 판)
    for x in (13, 47):
        c.R(x, 22, 5, 39, 'ki', 3); c.VL(x, 22, 39, 'ki', 5); c.VL(x + 4, 22, 39, 'ki', 1)
        c.R(x, 58, 5, 3, 'ishi', 4); c.HL(x, 61, 5, 'sumi', 1)
    for x, d in ((18, 1), (40, -1)):
        c.R(x, 26, 6, 32, 'kuro', 2); c.VL(x if d > 0 else x + 5, 26, 32, 'kuro', 4)
        for j in (32, 46): c.HL(x, j, 6, 'ishi', 4)
    # 상인방 + 문 지붕
    beam(c, 8, 20, 48, 'ki', h=4)
    gable_roof(c, 0, 0, 64, 22, ridge=5)


@B('wall-plaster', '흰 담(츠이지베이, 갓 기와 + 줄눈, 1칸)', 1, 2, None, ['담', '무가', '절', '저택'],
   '가로로 이어 저택·절 둘레 남·북 담을 만든다. 옆 담은 se-wall-plaster-v. 대문 양옆에 밑변을 맞춘다.')
def _(c):
    wall_cap(c, 0, 0, 16, 10)
    plaster(c, 0, 10, 16, 18, 'shikkui', 4)
    for y in (14, 17, 20): c.HL(0, y, 16, 'shikkui', 2)
    c.HL(0, 10, 16, 'shikkui', 2)
    base_stone(c, 0, 28, 16); c.HL(0, 31, 16, 'sumi', 1)


@B('wall-plaster-v', '흰 담(세로로 이어지는 갓 기와 윗면, 1칸)', 1, 1, None, ['담', '무가', '절', '저택'],
   '담의 동·서 변(남북으로 이어짐). 위·아래로 이어 칠한다.')
def _(c):
    for j in range(16):
        c.P(3, j, 'sumi', 1); c.P(12, j, 'sumi', 1)
        c.P(4, j, 'kawara', 5); c.P(5, j, *_tile_px('kawara', 0, j, 4, course=4))
        c.P(6, j, 'kawara', 4); c.P(7, j, 'kawara', 6); c.P(8, j, 'kawara', 5)
        c.P(9, j, 'kawara', 3); c.P(10, j, *_tile_px('kawara', 2, j, 3, course=4)); c.P(11, j, 'kawara', 2)
        c.P(13, j, 'kuro', 1)


@B('castle-wall', '성벽(돌 축대 + 흰 토담 + 총구멍, 1칸)', 1, 3, None, ['성', '성벽', '해자'],
   '성 둘레·성문 양옆에 가로로 잇는다. 해자 북쪽 물가 칸 바로 위에 놓으면 축대가 물로 떨어진다.')
def _(c):
    wall_cap(c, 0, 0, 16, 9)
    plaster(c, 0, 9, 16, 15, 'shikkui', 4)
    c.HL(0, 9, 16, 'shikkui', 2)
    # 총구멍(사마): 네모 하나
    c.R(6, 13, 4, 4, 'sumi', 0); c.HL(6, 17, 4, 'shikkui', 5); c.VL(5, 13, 4, 'shikkui', 2)
    c.HL(0, 22, 16, 'kuro', 3); c.HL(0, 23, 16, 'kuro', 1)
    ishigaki(c, 0, 24, 16, 24)


def ishigaki(c, x, y, w, h, batter=0):
    """성 돌 축대: 큰 돌(가로 6~9 · 세로 5~6) 엇갈림, 돌마다 윗·왼 밝게, 줄눈 어둡게. batter>0 이면 위가 좁은 사다리꼴(양옆 투명)."""
    rows = []
    yy = 0
    k = 0
    while yy < h:
        hh = 5 + h32(k, 1, 3) % 2; rows.append((yy, min(h, yy + hh))); yy += hh; k += 1
    for ri, (y0, y1) in enumerate(rows):
        off = h32(ri, 0, 7) % 7
        cuts = [-off]
        q = 0
        while cuts[-1] < w:
            cuts.append(cuts[-1] + 6 + h32(ri, q, 11) % 4); q += 1
        for ci in range(len(cuts) - 1):
            a, b = cuts[ci], cuts[ci + 1]
            base = 3 + (1 if h32(ri, ci, 13) % 3 == 0 else 0) - (1 if h32(ri, ci, 17) % 4 == 0 else 0)
            for j in range(y0, y1):
                for i in range(max(0, a), min(w, b)):
                    if batter:
                        ins = batter * (1 - j / max(1, h - 1))
                        if i < ins - 0.5 or i > w - 1 - ins + 0.5: continue
                    lx, ly = i - a, j - y0
                    if ly == y1 - y0 - 1 or lx == b - a - 1: t = 1
                    elif ly == 0 or lx == 0: t = base + 1
                    elif ly == y1 - y0 - 2: t = base - 1
                    else: t = base
                    c.P(x + i, y + j, 'ishi', clamp('ishi', t))
    if batter:
        for j in range(h):
            ins = batter * (1 - j / max(1, h - 1))
            c.P(x + int(round(ins)), y + j, 'sumi', 1); c.P(x + w - 1 - int(round(ins)), y + j, 'sumi', 1)
    c.HL(x + (batter if batter else 0), y, w - 2 * (batter if batter else 0), 'ishi', 5)


@B('castle-wall-v', '성벽(세로로 이어지는 토담 윗면, 1칸)', 1, 1, None, ['성', '성벽'],
   '성벽의 동·서 변. 위·아래로 이어 칠한다.')
def _(c):
    for j in range(16):
        for i in range(2, 14):
            if i in (2, 13): c.P(i, j, 'sumi', 1); continue
            if i < 5: c.P(i, j, 'ishi', 5 if i == 3 else 4)
            elif i > 10: c.P(i, j, 'ishi', 2 if i == 12 else 3)
            else:
                t = {5: 5, 6: 4, 7: 6, 8: 5, 9: 3, 10: 2}[i]
                if j % 4 == 3 and i in (6, 9): t -= 1
                c.P(i, j, 'kawara', t)
        c.P(14, j, 'kuro', 1)


# ═══════════════ 성 ═══════════════
def castle_wall_band(c, x, y, w, h, windows, kind='bars', board=10):
    """천수 한 층 벽: 흰 회벽 + 아래 검은 판자(시타미) + 창."""
    plaster(c, x, y, w, h, 'shikkui', 4)
    boards(c, x, y + h - board, w, board, 'kuro', 2)
    c.HL(x, y + h - board, w, 'kuro', 4)
    for wx in windows:
        if kind == 'bars': bars_window(c, x + wx, y + 3, 9, max(6, h - board - 6), 'kuro')
        else: katomado(c, x + wx, y + 2, 10, max(8, h - board - 4))
    c.VL(x, y, h, 'sumi', 1); c.VL(x + w - 1, y, h, 'sumi', 1)


def katomado(c, x, y, w, h):
    """화두창(종 모양 아치 창): 짙은 틀 + 안 어둠."""
    for j in range(h):
        for i in range(w):
            cx = (i - (w - 1) / 2) / (w / 2)
            top = int(round(3 * (abs(cx) ** 1.6))) if j < 4 else 0
            if j < top: continue
            edge = j == top or i in (0, w - 1) or j == h - 1
            c.P(x + i, y + j, 'kuro', 4 if edge and i < w / 2 else 2) if edge else c.P(x + i, y + j, 'sumi', 0)
    for i in range(x + 2, x + w - 2, 2): c.VL(i, y + 3, h - 4, 'kuro', 3)


def shachi(c, x, y, flip=False):
    """금 샤치(용마루 끝 물고기 장식) 6×9."""
    sh = ['..##..', '.###..', '####..', '.###..', '..##..', '..###.', '..####', '.##.##', '##....']
    for j, row in enumerate(sh):
        for i, ch in enumerate(row):
            if ch != '#': continue
            X = x + (5 - i if flip else i)
            t = 4 if (i < 3) != flip else 3
            if j in (8,): t = 2
            c.P(X, y + j, 'kin', t)


@B('castle-keep', '천수각(성의 본루, 돌 축대 위 3층 흰 벽 + 팔작 기와 + 금 샤치, 폭 9)', 9, 13, [4], ['성', '천수각', '성곽', '영주'],
   '성 가장 안쪽(혼마루) 북쪽 가운데. 축대 아래 문 앞 2칸은 돌길. 둘레에 성벽·망루, 앞에 넓은 돌 마당.')
def _(c):
    # 벽(위에서부터), 그다음 지붕(아래에서부터) — 아래 지붕이 위층 벽 밑동을 덮는다
    castle_wall_band(c, 40, 46, 64, 36, (11, 43), kind='kato', board=8)
    castle_wall_band(c, 26, 86, 92, 34, (10, 30, 52, 72), board=9)
    castle_wall_band(c, 12, 122, 120, 38, (8, 28, 50, 70, 92, 108), board=11)
    hip_roof(c, 2, 108, 140, 28, inset=14, gable_frac=0.25, curl=5, oni=False)
    chidori_hafu(c, 72, 108, 18)
    hip_roof(c, 16, 74, 112, 26, inset=13, gable_frac=0.25, curl=5, oni=False)
    chidori_hafu(c, 48, 74, 11); chidori_hafu(c, 96, 74, 11)
    hip_roof(c, 28, 20, 88, 32, inset=12, gable_frac=0.45, curl=6, oni=False)
    chidori_hafu(c, 72, 24, 13)
    shachi(c, 40, 11); shachi(c, 98, 11, flip=True)
    # 돌 축대 + 문
    ishigaki(c, 0, 160, 144, 48, batter=8)
    c.R(64, 180, 16, 28, 'sumi', 0)
    c.R(64, 178, 16, 3, 'kuro', 4); c.VL(64, 180, 28, 'kuro', 3); c.VL(79, 180, 28, 'kuro', 3)
    for i in range(65, 79):
        for j in range(182, 207):
            c.P(i, j, 'kuro', 2 if i % 4 else 3)
    for j in (188, 198):
        for i in range(66, 78, 3): c.P(i, j, 'ishi', 5)
    c.HL(64, 207, 16, 'sumi', 1)


@B('castle-turret', '망루(야구라, 2층 흰 벽 + 치도리하후, 폭 5)', 5, 6, None, ['성', '망루', '성곽'],
   '성벽 모서리·성문 옆. 들어가는 문 없음. 성벽(se-castle-wall)과 밑변을 맞춘다.')
def _(c):
    castle_wall_band(c, 16, 22, 48, 26, (6, 33), board=7)
    castle_wall_band(c, 4, 52, 72, 30, (6, 24, 42, 60), board=9)
    hip_roof(c, 0, 40, 80, 24, inset=12, gable_frac=0.2, curl=4, oni=False)
    chidori_hafu(c, 40, 41, 12)
    hip_roof(c, 8, 4, 64, 26, inset=11, gable_frac=0.4, curl=5)
    ishigaki(c, 0, 82, 80, 14, batter=3)


@B('castle-gate', '성문(망루문, 돌 축대 위 흰 문루 + 열린 큰 문, 폭 6)', 6, 5, None, ['성', '성문', '성곽'],
   '성벽 남쪽 가운데. 가운데 두 칸은 지나간다(머리 위 문루). 앞은 해자 위 다리(se-bridge-plain)나 돌길.',
   walk=[(2, 0), (3, 0), (2, 1), (3, 1), (2, 2), (3, 2), (2, 3), (3, 3), (2, 4), (3, 4)])
def _(c):
    ishigaki(c, 0, 40, 30, 40); ishigaki(c, 66, 40, 30, 40)
    castle_wall_band(c, 0, 18, 96, 22, (6, 82), board=6)
    hip_roof(c, 0, 0, 96, 24, inset=12, gable_frac=0.3, curl=4)
    # 문 들보 + 열린 문짝
    beam(c, 28, 36, 40, 'kuro', h=5)
    for x, d in ((30, 1), (60, -1)):
        c.R(x, 41, 6, 37, 'kuro', 2); c.VL(x if d > 0 else x + 5, 41, 37, 'kuro', 4)
        for j in range(45, 76, 8): c.P(x + 2, j, 'ishi', 5); c.P(x + 3, j, 'ishi', 5)
    c.VL(29, 36, 44, 'sumi', 1); c.VL(66, 36, 44, 'sumi', 1)


# ═══════════════ 신사·절 ═══════════════
@B('torii', '도리이(붉은 신사 문, 폭 4)', 4, 3, None, ['신사', '도리이', '참배길'],
   '참배길 입구. 가운데 두 칸으로 지나간다. 기둥 칸(맨 아래 양 끝)만 막힘. 앞뒤로 돌길(cobble).',
   walk=[(0, 0), (1, 0), (2, 0), (3, 0), (1, 1), (2, 1), (1, 2), (2, 2), (0, 1), (3, 1)])
def _(c):
    # 가사기(맨 위 들보): 윗면 검은 갓 4행 + 붉은 앞면 4행, 양끝 들림
    for i in range(64):
        d = min(i, 63 - i)
        lift = 3 if d < 3 else 2 if d < 7 else 1 if d < 12 else 0
        y = 2 - lift + 2
        c.P(i, y - 1, 'sumi', 1)
        c.P(i, y, 'kuro', 5); c.P(i, y + 1, 'kuro', 4); c.P(i, y + 2, 'kuro', 3)
        for k in range(3, 7): c.P(i, y + k, 'shu', 4 if k == 3 else 3 if k < 6 else 2)
        c.P(i, y + 7, 'sumi', 1)
    # 누키(아래 가로대): 윗면 2 + 앞면 3
    for i in range(3, 61):
        c.P(i, 15, 'shu', 5); c.P(i, 16, 'shu', 4); c.P(i, 17, 'shu', 3); c.P(i, 18, 'shu', 3); c.P(i, 19, 'shu', 1)
    c.P(2, 15, 'sumi', 1); c.P(61, 15, 'sumi', 1); c.VL(2, 15, 5, 'sumi', 1); c.VL(61, 15, 5, 'sumi', 1)
    # 가쿠즈카(가운데 짧은 기둥) + 빈 현판(글자 없음)
    c.R(29, 11, 6, 4, 'shu', 3); c.R(28, 12, 8, 3, 'kuro', 2); c.HL(28, 12, 8, 'kuro', 4)
    # 기둥 둘(굵게 6) + 검은 밑동
    for x in (7, 51):
        for j in range(12, 48):
            c.P(x, j, 'sumi', 1); c.P(x + 1, j, 'shu', 5); c.P(x + 2, j, 'shu', 4); c.P(x + 3, j, 'shu', 3); c.P(x + 4, j, 'shu', 2); c.P(x + 5, j, 'sumi', 1)
        c.R(x, 40, 6, 7, 'kuro', 2); c.HL(x, 40, 6, 'kuro', 4); c.HL(x, 47, 6, 'sumi', 1)
        c.R(x - 1, 46, 8, 2, 'ishi', 4); c.HL(x - 1, 47, 8, 'sumi', 1)


@B('shrine', '신사 본전(동판 지붕 + 치기·가쓰오기, 붉은 기둥 + 금줄, 폭 6)', 6, 5, [2, 3], ['신사', '본전', '배전', '참배길'],
   '참배길 북쪽 끝. 앞에 새전함(se-offering-box)·고마이누 한 쌍(se-komainu)·석등. 문 앞 2칸 돌길.')
def _(c):
    hip_roof(c, 0, 4, 96, 42, 'dou', 3, inset=14, gable_frac=0.5, curl=3, oni=False)
    # 치기(박공 끝 X 막대) + 가쓰오기(용마루 위 통나무)
    for x, f in ((13, 1), (82, -1)):
        for k in range(8):
            c.P(x + k * f, 8 - k, 'kuro', 3); c.P(x + k * f + f, 8 - k, 'kuro', 4)
            c.P(x - k * f + 6 * f, 8 - k, 'kuro', 2)
    for x in range(26, 70, 9):
        c.R(x, 1, 5, 4, 'kin', 3); c.HL(x, 1, 5, 'kin', 4); c.HL(x, 4, 5, 'kin', 1); c.VL(x, 1, 4, 'kin', 4)
    y1 = 46
    beam(c, 0, y1 - 2, 96, 'shu', h=4)
    for i in range(6):
        x = i * 16
        if i in (2, 3):
            c.R(x, y1 + 2, 16, 26, 'kuro', 2)
            for j in range(y1 + 3, y1 + 27, 3): c.HL(x + 1, j, 14, 'kuro', 4)
            for k in range(x + 1, x + 15, 3): c.VL(k, y1 + 3, 24, 'kuro', 3)
            continue
        plaster(c, x, y1 + 2, 16, 26, 'shikkui', 5)
        c.HL(x, y1 + 14, 16, 'shu', 3)
    for i in range(7):
        x = min(93, i * 16 - (1 if i else 0))
        c.R(x, y1 + 2, 3, 27, 'shu', 3); c.VL(x, y1 + 2, 27, 'shu', 5); c.VL(x + 2, y1 + 2, 27, 'shu', 1)
    # 금줄(시메나와) + 시데(흰 종이 번개)
    for i in range(6, 90):
        sag = int(round(3 * (1 - ((i - 48) / 42) ** 2)))
        y = y1 + 3 + sag
        c.P(i, y, 'kaya', 5 if i % 3 else 3); c.P(i, y + 1, 'kaya', 3 if i % 3 else 2); c.P(i, y + 2, 'kaya', 1)
    for sx in (22, 40, 56, 74):
        sag = int(round(3 * (1 - ((sx - 48) / 42) ** 2)))
        for k, (dx, dy) in enumerate(((0, 0), (1, 0), (1, 1), (1, 2), (0, 2), (0, 3), (0, 4), (1, 4), (1, 5))):
            c.P(sx + dx, y1 + 6 + sag + dy, 'washi', 3 if dx == 0 else 2)
    # 방울 줄(붉은·흰 꼰 줄) + 방울
    c.R(46, y1 + 4, 4, 3, 'kin', 4); c.HL(46, y1 + 6, 4, 'kin', 2)
    for j in range(y1 + 7, y1 + 20): c.P(47 + (j % 2), j, 'shu' if j % 2 else 'washi', 3)
    ishigaki(c, 0, y1 + 29, 96, 5)
    c.R(40, y1 + 29, 16, 5, 'ishi', 5); c.HL(40, y1 + 31, 16, 'ishi', 3); c.HL(40, y1 + 33, 16, 'sumi', 1)


@B('temple-hall', '절 본당(큰 팔작 기와, 휜 처마 끝, 나무 기둥 + 흰 벽 + 격자문, 폭 9)', 9, 6, [4], ['절', '본당', '사찰'],
   '절 마당 북쪽 가운데. 앞에 향로(se-incense)·석등 둘. 산문에서 돌길(cobble-moss)로 곧게.')
def _(c):
    hip_roof(c, 0, 0, 144, 56, inset=24, gable_frac=0.35, curl=8)
    y1 = 56
    beam(c, 0, y1 - 2, 144, 'ki', h=5)
    c.R(0, y1 + 3, 144, 3, 'kin', 2); c.HL(0, y1 + 3, 144, 'kin', 3)
    for i in range(9):
        x = i * 16
        if 2 <= i <= 6:
            c.R(x, y1 + 6, 16, 22, 'kuro', 2)
            for j in range(y1 + 7, y1 + 27, 3): c.HL(x + 1, j, 14, 'kuro', 4)
            for k in range(x + 2, x + 15, 3): c.VL(k, y1 + 7, 20, 'kuro', 3)
            if i == 4: c.R(x + 2, y1 + 8, 12, 19, 'sumi', 0); c.HL(x + 2, y1 + 25, 12, 'kin', 2)
        else:
            plaster(c, x, y1 + 6, 16, 22, 'shikkui', 4)
            c.HL(x, y1 + 16, 16, 'ki', 3)
    for i in range(10):
        x = min(141, i * 16 - (1 if i else 0))
        c.R(x, y1 + 2, 3, 26, 'ki', 3); c.VL(x, y1 + 2, 26, 'ki', 5); c.VL(x + 2, y1 + 2, 26, 'ki', 1)
    engawa(c, 0, y1 + 26, 144)
    ishigaki(c, 0, y1 + 31, 144, 9)
    c.R(56, y1 + 30, 32, 10, 'ishi', 4)
    for k in range(3):
        c.HL(56, y1 + 30 + k * 3, 32, 'ishi', 6); c.HL(56, y1 + 31 + k * 3, 32, 'ishi', 4); c.HL(56, y1 + 32 + k * 3, 32, 'ishi', 2)
    c.HL(0, y1 + 39, 144, 'sumi', 1)


@B('pagoda', '오층탑(목탑, 겹 지붕 다섯 + 금 상륜, 폭 4)', 4, 10, None, ['절', '탑', '오층탑', '사찰'],
   '절 마당 동쪽·서쪽 구석. 들어가지 않는다. 둘레 1칸 비움.')
def _(c):
    # 상륜(굵은 금 기둥 + 고리 아홉)
    for j in range(2, 30):
        for i in range(29, 35):
            t = 4 if i < 31 else 3 if i < 33 else 2
            if (j % 3) == 0 and j > 6: t += 1 if i < 33 else 0
            c.P(i, j, 'kin', clamp('kin', t))
        c.P(28, j, 'sumi', 1); c.P(35, j, 'sumi', 1)
    c.ell(31.5, 3, 3, 3, lambda X, Y, dx, dy, d: ('kin', 4 if dx < 0 else 2))
    widths = [40, 46, 52, 58, 64]
    y = 26
    for k, w in enumerate(widths):
        x0 = (64 - w) // 2
        ww = w - 14
        wx0 = (64 - ww) // 2
        plaster(c, wx0, y + 14, ww, 12, 'shikkui', 4)
        for px_ in range(wx0, wx0 + ww, 6): c.VL(px_, y + 14, 12, 'shu', 3)
        c.VL(wx0, y + 14, 12, 'sumi', 1); c.VL(wx0 + ww - 1, y + 14, 12, 'sumi', 1)
        if k == 4:
            c.R(26, y + 16, 12, 10, 'kuro', 2)
            for kk in range(27, 37, 3): c.VL(kk, y + 17, 8, 'kuro', 4)
        hip_roof(c, x0, y, w, 18, inset=8, gable_frac=0.0, curl=4, ridge=3, oni=False)
        y += 24
    ishigaki(c, 2, 146, 60, 14)


@B('temple-gate', '산문(절 대문, 큰 우진각 지붕 + 붉은 기둥, 가운데 통로, 폭 6)', 6, 5, None, ['절', '산문', '대문', '사찰'],
   '절 담 남쪽 가운데. 가운데 두 칸으로 지나간다. 양옆 칸은 막힘(격자 안 금강역사 그림자).',
   walk=[(2, 0), (3, 0), (2, 1), (3, 1), (2, 2), (3, 2), (2, 3), (3, 3), (2, 4), (3, 4)])
def _(c):
    for x in (0, 64):
        c.R(x + 2, 36, 28, 40, 'kuro', 1)
        lattice(c, x + 2, 38, 28, 30, 'kuro')
        c.ell(x + 16, 54, 6, 10, lambda X, Y, dx, dy, d: ('shu', 2) if (X + Y) % 2 else None)
        base_stone(c, x, 77, 32)
    for x in (0, 29, 63, 93):
        c.R(x, 32, 4, 47, 'shu', 3); c.VL(x, 32, 47, 'shu', 5); c.VL(x + 3, 32, 47, 'shu', 1)
        c.R(x - 1, 76, 6, 3, 'ishi', 4); c.HL(x - 1, 79, 6, 'sumi', 1)
    beam(c, 0, 30, 96, 'shu', h=5)
    hip_roof(c, 0, 0, 96, 34, inset=16, gable_frac=0.3, curl=6)


@B('bell-tower', '종루(네 기둥 + 범종, 돌 기단, 폭 4)', 4, 5, None, ['절', '종루', '범종', '사찰'],
   '절 마당 구석. 둘레 1칸 비움. 들어가지 않는다.')
def _(c):
    ishigaki(c, 4, 62, 56, 14)
    c.R(6, 60, 52, 4, 'ishi', 5); c.HL(6, 60, 52, 'ishi', 6)
    for x in (10, 49):
        c.R(x, 30, 5, 32, 'ki', 3); c.VL(x, 30, 32, 'ki', 5); c.VL(x + 4, 30, 32, 'ki', 1)
    beam(c, 8, 30, 48, 'ki', h=4)
    # 범종(청동): 둥근 어깨 + 몸통 + 띠
    for j in range(36, 57):
        k = j - 36
        hw = 7 if k < 2 else 9 if k < 4 else 10
        for i in range(32 - hw, 32 + hw):
            dx = (i - 32 + 0.5) / hw
            t = 4 if dx < -0.4 else 3 if dx < 0.2 else 2 if dx < 0.7 else 1
            if j in (44, 52): t = max(0, t - 1)
            c.P(i, j, 'dou', t)
        c.P(32 - hw - 1, j, 'sumi', 1); c.P(32 + hw, j, 'sumi', 1)
    c.HL(22, 57, 20, 'sumi', 1); c.VL(32, 33, 3, 'kuro', 2)
    hip_roof(c, 0, 0, 64, 34, inset=10, gable_frac=0.3, curl=5)


# ═══════════════ 농촌 ═══════════════
@B('minka', '농가(두툼한 초가, 흙벽 + 기둥 + 흙바닥 문, 폭 6)', 6, 5, [2], ['농가', '초가', '농촌', '마을'],
   '논·밭 옆. 앞마당은 흙(road) 2~3줄, 옆에 볏단·장작. 문 앞 2칸 비움.')
def _(c):
    y1 = 48
    for i in range(6):
        x = i * 16
        if i == 2: itado(c, x, y1 + 3, mat='ki', open_=True); continue
        plaster(c, x, y1 + 3, 16, 26, 'tsuchi', 4 if i % 2 else 3)
        if i == 1: shoji(c, x + 2, y1 + 6, 12, 14)
        if i == 4: bars_window(c, x + 3, y1 + 7, 10, 9, 'ki')
    beam(c, 0, y1, 96, 'ki')
    for i in range(7):
        x = min(93, i * 16 - (1 if i else 0))
        c.R(x, y1, 3, 29, 'ki', 3); c.VL(x, y1, 29, 'ki', 5); c.VL(x + 2, y1, 29, 'ki', 1)
    base_stone(c, 0, y1 + 29, 96)
    thatch_roof(c, 0, 0, 96, 52, inset=16, ridge=7, eave=6)


@B('minka-small', '작은 농가(초가, 흙벽, 폭 4)', 4, 4, [1], ['농가', '초가', '농촌', '마을'],
   '농가 줄의 작은 집. 문 앞 2칸 비움.')
def _(c):
    y1 = 32
    for i in range(4):
        x = i * 16
        if i == 1: itado(c, x, y1 + 3, mat='ki'); continue
        plaster(c, x, y1 + 3, 16, 26, 'tsuchi', 4 if i % 2 else 3)
        if i == 2: shoji(c, x + 2, y1 + 6, 12, 14)
    beam(c, 0, y1, 64, 'ki')
    for i in range(5):
        x = min(61, i * 16 - (1 if i else 0))
        c.R(x, y1, 3, 29, 'ki', 3); c.VL(x, y1, 29, 'ki', 5); c.VL(x + 2, y1, 29, 'ki', 1)
    base_stone(c, 0, y1 + 29, 64)
    thatch_roof(c, 0, 0, 64, 36, inset=10, ridge=6, eave=5)


@B('kura', '창고(흰 회벽 2층 + 나마코 벽 + 무거운 문, 폭 3)', 3, 5, [1], ['창고', '쿠라', '상가', '농가', '무가'],
   '상가·부농·무가 저택 뒤편. 문 앞 1칸 비움.')
def _(c):
    gable_roof(c, 0, 0, 48, 30, ridge=9)
    plaster(c, 0, 30, 48, 50, 'shikkui', 5)
    c.HL(0, 30, 48, 'shikkui', 2)
    bars_window(c, 18, 36, 12, 10, 'kuro'); c.R(16, 34, 16, 2, 'shikkui', 3)
    namako(c, 0, 60, 48, 17)
    c.R(14, 54, 20, 23, 'shikkui', 3); c.HL(14, 54, 20, 'shikkui', 5)
    c.R(16, 56, 16, 21, 'kuro', 2)
    for j in range(58, 76, 5): c.HL(17, j, 14, 'kuro', 4)
    c.VL(23, 56, 21, 'sumi', 0); c.P(21, 66, 'kin', 3); c.P(26, 66, 'kin', 3)
    base_stone(c, 0, 77, 48)
    c.VL(0, 30, 47, 'sumi', 1); c.VL(47, 30, 47, 'sumi', 1)


@B('barn', '헛간(초가 + 판자벽, 열린 앞 + 볏단, 폭 4)', 4, 4, None, ['헛간', '농촌', '초가'],
   '농가 옆. 들어가지 않는다. 앞에 볏단·장작.')
def _(c):
    y1 = 32
    boards(c, 0, y1 + 3, 64, 26, 'ki', 3)
    c.R(16, y1 + 5, 32, 24, 'kuro', 1)
    for i, (m, t) in enumerate((('kaya', 4), ('kaya', 5), ('kaya', 3), ('kaya', 4))):
        x = 18 + i * 7
        c.R(x, y1 + 14, 6, 15, m, t); c.HL(x, y1 + 14, 6, m, t + 1); c.VL(x + 5, y1 + 14, 15, m, t - 2)
        c.HL(x, y1 + 20, 6, 'kaya', 1)
    beam(c, 0, y1, 64, 'ki')
    for x in (0, 15, 47, 61): c.R(x, y1, 3, 29, 'ki', 3); c.VL(x, y1, 29, 'ki', 5)
    base_stone(c, 0, y1 + 29, 64)
    thatch_roof(c, 0, 0, 64, 36, inset=9, ridge=6, eave=5)


@B('chashitsu', '다실 초암(작은 초가 + 흙벽 + 둥근 창, 폭 3)', 3, 4, [1], ['다실', '다도', '정원', '무가'],
   '저택·절 정원 안쪽. 디딤돌(se-stepping-stones)로 문까지 잇고 앞에 츠쿠바이(se-tsukubai).')
def _(c):
    y1 = 32
    plaster(c, 0, y1 + 3, 48, 26, 'tsuchi', 4)
    shoji(c, 16, y1 + 3, 16, 26)
    # 둥근 창(시타지마도): 대 격자 원
    c.ell(7.5, y1 + 13, 5, 5, lambda X, Y, dx, dy, d: ('kaya', 3) if (X % 2 == 0 or Y % 3 == 0) else ('kuro', 1))
    c.ell(40.5, y1 + 13, 4, 6, lambda X, Y, dx, dy, d: ('washi', 2) if (X % 3 and Y % 3) else ('ki', 3))
    beam(c, 0, y1, 48, 'ki')
    for x in (0, 15, 31, 45): c.R(x, y1, 3, 29, 'ki', 3); c.VL(x, y1, 29, 'ki', 5)
    base_stone(c, 0, y1 + 29, 48)
    thatch_roof(c, 0, 0, 48, 36, inset=8, ridge=6, eave=5)


if __name__ == '__main__':
    R.export()
    items = [(it['id'], R.render(it).img()) for it in R.items]
    contact(items, os.path.join(OUT, 'buildings', 'preview.png'), z=3, W=2100)
    print(len(R.items), 'buildings')
