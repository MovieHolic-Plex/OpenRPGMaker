"""조선 실내 기물 5(고침 라운드 2): 사람 폭(24px)보다 넓은 이부자리 2×2, 둥근 방석, 무기·농기구 진열대, 문틀(문설주+인방) 벽면 조각.

기존 in_b_ 조각의 이름·번호는 바꾸지 않는다. 시점·톤은 inb_props.py 와 같다(앞면 + 윗면, 왼쪽 위 빛).
"""
from inb_tk import *
import props5 as P5
import inb_kit as K
from inb_props import _top, _front, _panel, BR, IR


# ----------------------------------------------------------------------------------------------------- 이부자리
def ibul_wide(kind='r'):
    """펴 놓은 이부자리 2×2(32×32, 사람 몸 폭보다 넓다): 요 + 베개 둘 + 이불(가장자리 접은 가선, 가운데 무늬)."""
    cv = Cv(32, 32)
    ramp = {'r': RD, 'b': DB, 'g': DG}[kind]
    for y in range(2, 30):                                                       # 요(한지빛 천)
        for x in range(1, 31):
            t = 5 if x < 10 else (4 if x < 22 else 3)
            cv.put(x, y, PL[t])
    for y in range(12, 30):                                                      # 이불
        for x in range(1, 31):
            t = 5 if x < 8 else (4 if x < 22 else 3)
            cv.put(x, y, ramp[t])
    for x in range(1, 31):                                                       # 이불 윗가선(접어 젖힌 흰 단)
        cv.put(x, 12, PL[6]); cv.put(x, 13, PL[5]); cv.put(x, 14, ramp[6] if x < 14 else ramp[5])
    for (cx, cy) in ((9, 21), (22, 21)):                                         # 이불 무늬(마름모 둘)
        for d in range(0, 4):
            cv.hl(cx - d, cx + d, cy - 3 + d, ramp[6] if d % 2 == 0 else ramp[2])
            cv.hl(cx - d, cx + d, cy + 3 - d, ramp[6] if d % 2 == 0 else ramp[2])
    cv.hl(2, 29, 28, ramp[1])
    for x0 in (3, 18):                                                           # 베개 둘
        cv.rect(x0, 3, x0 + 10, 9, PL[6]); cv.hl(x0, x0 + 10, 3, PL[6]); cv.hl(x0, x0 + 10, 9, PL[4])
        cv.rect(x0, 4, x0 + 1, 9, PL[5]); cv.rect(x0 + 9, 4, x0 + 10, 9, PL[3])
        for k in range(3):
            cv.put(x0 + 3 + k * 2, 6, ramp[4])
    cv.hl(1, 31, 30, WD[1])
    B.outline(cv)
    return cv


def banseok_round(kind='r'):
    """둥근 방석 1×1(앉은 방석): 원형 + 가운데 매듭 단추 + 앞 두께 2px."""
    cv = Cv(16, 16)
    ramp = {'r': RD, 'b': DB, 'g': DG}[kind]
    P5.ell(cv, 8, 8.4, 6.4, 3.6, lambda x, y, u, v: ramp[6] if (u < -0.35 and v < 0.1) else (ramp[5] if v < 0.45 else ramp[3]))
    P5.ell(cv, 8, 8.2, 4.4, 2.2, lambda x, y, u, v: ramp[4] if v < 0.1 else ramp[3])
    cv.put(8, 8, ramp[2]); cv.put(7, 8, ramp[3]); cv.put(9, 8, ramp[3])
    for x in range(2, 14):                                                       # 앞 두께 3px(윤곽 안쪽)
        for y, t in ((11, 3), (12, 2), (13, 1)):
            if (x in (2, 13) and y > 11) or (x in (3, 12) and y == 13):
                continue
            cv.put(x, y, ramp[t])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 진열대
def weapon_rack(wc=2):
    """무기 걸이 2×2: 나무 틀 두 기둥 + 가로대 둘, 창 둘을 세우고 칼 둘을 가로로 건 진열대(대장간 완성품·관아 무기고)."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    for x in (2, W_ - 5):                                                         # 기둥
        cv.rect(x, 6, x + 2, 29, WD[4]); cv.vl(x, 6, 29, WD[6]); cv.vl(x + 2, 6, 29, WD[2])
        cv.rect(x - 1, 4, x + 3, 6, WD[5]); cv.hl(x - 1, x + 3, 4, WD[6])
    for y in (11, 20):                                                            # 가로대
        cv.rect(2, y, W_ - 3, y + 2, WD[5]); cv.hl(2, W_ - 3, y, WD[6]); cv.hl(2, W_ - 3, y + 2, WD[2])
    for x in (9, 14):                                                             # 창(자루 + 쇠 날 + 붉은 술)
        for y in range(5, 28):
            cv.put(x, y, WD[5]); cv.put(x + 1, y, WD[3])
        for k in range(5):
            cv.put(x, 4 - k // 2, IR[6 - k // 3]); cv.put(x + 1, 4 - k // 2, IR[3])
        cv.put(x, 0, IR[6]); cv.put(x + 1, 1, IR[4])
        cv.rect(x - 1, 8, x + 2, 9, RD[4])
    for (y, c1) in ((14, IR[5]), (23, IR[4])):                                    # 칼 둘(칼날 가로 + 자루·코등이)
        cv.hl(5, W_ - 8, y, c1); cv.hl(5, W_ - 8, y + 1, IR[3])
        cv.rect(W_ - 8, y - 1, W_ - 7, y + 2, BR[4]); cv.hl(W_ - 6, W_ - 3, y, WD[3]); cv.hl(W_ - 6, W_ - 3, y + 1, RD[3])
    cv.rect(1, 28, W_ - 2, 30, WD[3]); cv.hl(1, W_ - 2, 28, WD[5]); cv.hl(1, W_ - 2, 30, WD[1])
    B.outline(cv)
    return cv


def tool_rack(wc=2):
    """농기구 걸이 2×2: 널벽에 박은 못에 호미·낫·삽을 건 진열대(대장간 완성품)."""
    W_ = wc * 16
    cv = Cv(W_, 32)
    _top(cv, 0, 2, W_, 3)
    _front(cv, 0, 5, W_, 24)
    for y in (12, 21):                                                            # 널 이음
        cv.hl(1, W_ - 1, y, WD[2])
    # 삽: 긴 자루 + 넓은 날
    for y in range(7, 22):
        cv.put(6, y, WD[6]); cv.put(7, y, WD[3])
    cv.rect(4, 22, 9, 27, IR[5]); cv.hl(4, 9, 22, IR[6]); cv.vl(9, 22, 27, IR[2]); cv.rect(5, 27, 8, 28, IR[3])
    # 낫: 가는 자루 + 굽은 날
    for y in range(7, 17):
        cv.put(14, y, WD[5]); cv.put(15, y, WD[3])
    for k, (dx, dy) in enumerate(((1, 0), (2, 0), (3, 1), (4, 2), (5, 4), (5, 5), (4, 6), (3, 7))):
        cv.put(14 + dx, 17 + dy, IR[6 - (k % 3)]); cv.put(14 + dx, 18 + dy, IR[3])
    # 호미: 짧은 자루 + 뾰족한 날
    for y in range(8, 19):
        cv.put(24, y, WD[5]); cv.put(25, y, WD[3])
    cv.rect(21, 19, 27, 20, IR[5]); cv.put(21, 20, IR[3]); cv.put(20, 21, IR[4]); cv.put(21, 21, IR[3]); cv.put(20, 22, IR[5])
    for (x, y) in ((6, 6), (14, 6), (24, 7)):                                     # 못
        cv.put(x, y, IR[6]); cv.put(x + 1, y, IR[3])
    B.outline(cv)
    return cv


# ----------------------------------------------------------------------------------------------------- 문틀 벽면
def doorway(kind='hoe'):
    """문틀 벽면 1×2(칸막이 틈 위): 벽 재질 + 양옆 문설주(3px) + 인방(가로 보) + 그 위 작은 살창 + 아래 어두운 문 안.
    걷는 칸 바로 위에 놓아 「벽 두께를 뚫은 출입구」로 읽히게 한다. 문짝은 없다(열린 문턱)."""
    cv = K.wall_face(kind, 'lr')
    for y in range(2, 32):                                                        # 어두운 문 안(인방 아래)
        for x in range(3, 13):
            if y >= 21:
                cv.put(x, y, GI[1] if y < 28 else GI[2])
    for y in range(7, 19):                                                        # 인방 위 작은 살창(벽 재질 위에 덧댐)
        for x in range(4, 12):
            cv.put(x, y, PL[5] if (x + y) % 5 else PL[4])
    for x in (4, 7, 11):
        cv.vl(x, 7, 18, WD[4])
    for y in (7, 12, 18):
        cv.hl(3, 13, y, WD[3] if y != 7 else WD[5])
    for y in range(19, 25):                                                       # 인방(굵은 가로 보)
        cv.hl(0, 16, y, WD[6] if y == 19 else (WD[5] if y < 22 else (WD[3] if y < 24 else WD[2])))
    for x in (0, 1, 2, 13, 14, 15):                                               # 문설주
        cv.vl(x, 2, 31, WD[6] if x in (0, 13) else (WD[5] if x in (1, 14) else WD[3]))
    cv.vl(3, 25, 31, WD[2]); cv.vl(12, 25, 31, WD[1])
    cv.hl(0, 16, 31, WD[1])
    B.outline(cv)
    return cv


def objects():
    d = {}
    for k in 'rbg':
        d['in_b_ibul_wide_' + k] = ibul_wide(k)
        d['in_b_banseok_round_' + k] = banseok_round(k)
    d['in_b_weapon_rack_2'] = weapon_rack(2)
    d['in_b_tool_rack_2'] = tool_rack(2)
    for k in ('hoe', 'mok', 'heuk', 'dol'):
        d['in_b_doorway_' + k] = doorway(k)
    return d
