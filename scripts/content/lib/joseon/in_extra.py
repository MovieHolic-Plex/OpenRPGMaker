"""조선 실내 추가 기물(보강): 일월오봉도 병풍·호피·보료·안석·서안·소쿠리·반짇고리·벽 걸이·사다리·약방 작업 상 등.

props_in*.py(정본 기물)에 없는 것만 더한다. 그리는 도구는 in_tk.py(팔레트 잠금 램프·3/4 블록 도우미).
시점·명암 규칙은 props_in 과 같다: 정면-위 3/4, 빛 왼쪽 위, 가구 목재는 마루 바닥보다 밝게.
"""
from in_tk import *
import props5 as P5
BR = RGB['persimmon']      # 놋쇠 장석
IR = RGB['giwa']           # 쇠
WT = RGB['water']


def _top(cv, x0, y0, w, d, ramp=WD):
    """윗면 d 줄: 맨 윗줄·왼쪽 끝이 가장 밝다. 아랫줄은 앞 모서리 하이라이트."""
    for r in range(d):
        for c in range(w):
            t = 6 if (r == 0 or c == 0) else 5
            if r == d - 1 and d > 2:
                t = 4
            cv.put(x0 + c, y0 + r, ramp[t])


def _front(cv, x0, y0, w, h, ramp=WD, seed=0, grain_=True):
    """앞면: 왼쪽 밝음 → 오른쪽 어두움, 맨 아랫줄 그림자, 드문 결."""
    for r in range(h):
        for c in range(w):
            f = c / max(1, w - 1)
            t = 5 if f < 0.28 else (4 if f < 0.72 else 3)
            if r == h - 1: t = 2
            cv.put(x0 + c, y0 + r, ramp[t])
    if grain_:
        grain(cv, x0 + 1, y0 + 1, x0 + w - 1, y0 + h - 2, ramp, 3, 80 + seed, 0.10)


def _panel(cv, x0, y0, x1, y1, ramp=WD):
    """들어간 판문: 1px 어두운 틀 + 안쪽 한 단 밝은 면(왼쪽 위 빛)."""
    rim(cv, x0, y0, x1, y1, ramp[2])
    cv.hl(x0 + 1, x1 - 1, y0 + 1, ramp[6]); cv.vl(x0 + 1, y0 + 1, y1 - 1, ramp[5])
    cv.hl(x0 + 1, x1 - 1, y1 - 2, ramp[3]); cv.vl(x1 - 2, y0 + 1, y1 - 1, ramp[3])


def _pull(cv, x, y, w=2, h=2):
    """놋쇠 손잡이(장석)."""
    cv.rect(x, y, x + w, y + h, BR[4]); cv.put(x, y, BR[6]); cv.put(x + w - 1, y + h - 1, BR[2])


def _plate(cv, x, y, w, h):
    """놋쇠 자물쇠판."""
    cv.rect(x, y, x + w, y + h, BR[5]); cv.hl(x, x + w, y, BR[6]); cv.hl(x, x + w, y + h - 1, BR[3])
    cv.put(x + w // 2, y + h // 2, IR[1])


def _legs(cv, x0, x1, y, h=2):
    for x in (x0, x1 - 2):
        cv.rect(x, y, x + 2, y + h, WD[2]); cv.put(x, y, WD[3])


def byeongpung_royal():
    """일월오봉도 병풍(관아 동헌 용): 해와 달, 다섯 봉우리, 소나무와 물결, 청색 바탕."""
    cv = Cv(48, 32)
    for i in range(4):
        pass
    cv.rect(1, 3, 47, 29, WD[3])
    cv.hl(1, 47, 3, WD[6]); cv.hl(1, 47, 4, WD[5]); cv.hl(1, 47, 27, WD[3]); cv.hl(1, 47, 28, WD[1])
    for y in range(7, 25):
        for x in range(3, 45):
            q = rnd(x, y, 540)
            cv.put(x, y, DB[2] if q > 0.1 else DB[1])
    disc(cv, 12, 11, 3.2, RD[5]); disc(cv, 11, 10, 1.4, PS[6])               # 해
    disc(cv, 36, 11, 3.0, PL[6]); disc(cv, 37, 10, 1.2, PL[4])               # 달
    for k, (cx, hh) in enumerate(((8, 6), (16, 9), (24, 12), (32, 9), (40, 6))):          # 오봉
        for y in range(24 - hh, 24):
            hw = int((24 - y) * 0.0 + (hh - (24 - y)) * 0.55 + 2)
            for x in range(cx - hw, cx + hw + 1):
                cv.put(x, y, DG[4] if x < cx else DG[3])
        cv.hl(cx - 1, cx + 1, 24 - hh, DG[5])
    for x in range(3, 45):                                                   # 물결
        cv.put(x, 24, DB[5] if x % 4 < 2 else DB[4]); cv.put(x, 25, DB[4] if x % 4 < 2 else DB[3])
    for x in (4, 5, 42, 43):                                                # 양 끝 소나무 줄기
        cv.vl(x, 13, 24, WD[3])
    for cx in (4, 43):
        for y in range(8, 14):
            for x in range(cx - 3, cx + 4):
                if abs(x - cx) < 4 - (y - 8) // 2:
                    cv.put(x, y, LF[2] if (x + y) % 2 else LF[3])
    for x in (1, 2, 46, 47):
        pass
    for x in range(1, 47, 12):                                              # 판 사이 이음
        cv.vl(x, 4, 28, WD[2])
    B.outline(cv)
    return cv


def ibul_folded():
    """개어 쌓은 이불 1×1."""
    cv = Cv(16, 16)
    for k, (y0, ramp) in enumerate(((9, DB), (5, RD), (1, DG))):
        h = 4 if k < 2 else 4
        for y in range(y0, y0 + h + 1):
            for x in range(2 + k, 14 - k):
                t = 6 if y == y0 else (5 if x < 6 else 4)
                if y >= y0 + h: t = 2
                cv.put(x, y, ramp[t])
    for x in range(2, 14):
        cv.put(x, 14, WD[2]); cv.put(x, 15, WD[1])
    B.outline(cv)
    return cv


def boryo(wc=2):
    """보료 wc×1: 두툼한 비단 요(훈장·사또가 앉는 자리). 붉은 바탕 + 청색 가선."""
    W_ = wc * 16
    cv = Cv(W_, 16)
    for y in range(3, 12):
        for x in range(1, W_ - 1):
            t = 5 if (y < 7 and x < W_ // 2) else 4
            cv.put(x, y, RD[t])
    cv.rect(1, 3, W_ - 1, 4, RD[6])
    for x in range(1, W_ - 1):
        cv.put(x, 12, RD[2]); cv.put(x, 13, RD[1])
    cv.rect(1, 3, W_ - 1, 5, DB[4]) if False else None
    for y in (5, 10):
        cv.hl(3, W_ - 3, y, DB[4]); cv.hl(3, W_ - 3, y + 1, DB[3])
    for x in range(5, W_ - 5, 6):                                                       # 수 문양
        cv.put(x, 8, PS[5]); cv.put(x + 1, 7, PS[5]); cv.put(x + 1, 9, PS[4])
    B.outline(cv)
    return cv


def ansuk():
    """안석 1×1: 보료 위에 기대는 나무 안석(팔걸이 판)."""
    cv = Cv(16, 16)
    _top(cv, 2, 5, 12, 4)
    cv.hl(2, 14, 8, WD[6])
    _front(cv, 2, 9, 12, 3)
    for x in (3, 10):
        cv.rect(x, 12, x + 3, 15, WD[2]); cv.rect(x, 12, x + 1, 13, WD[4])
    cv.hl(3, 13, 15, WD[1])
    B.outline(cv)
    return cv


def seoan():
    """서안 1×1: 낮은 책상 위에 펼친 책·벼루·붓통."""
    cv = Cv(16, 16)
    _top(cv, 1, 5, 14, 4)
    _front(cv, 1, 8, 14, 3)
    for x in (2, 11):
        cv.rect(x, 11, x + 3, 15, WD[2]); cv.rect(x, 11, x + 1, 12, WD[4])
    cv.hl(2, 14, 15, WD[1])
    cv.rect(3, 3, 9, 7, PL[6]); cv.hl(3, 9, 3, PL[5]); cv.vl(6, 3, 7, PL[3]); cv.hl(3, 9, 7, WD[3])      # 펼친 책
    cv.rect(11, 5, 14, 7, IR[2]); cv.hl(11, 14, 5, IR[4])                                              # 벼루
    cv.rect(12, 1, 14, 5, WD[3]); cv.put(12, 0, IR[1]); cv.put(13, 0, RD[4])                             # 붓통
    B.outline(cv)
    return cv


def seoan_2():
    """서안 둘 2×1: 학동 둘이 나란히 앉는 책상."""
    cv = Cv(32, 16)
    for k in range(2):
        s = seoan()
        cv.paste(s, k * 16, 0)
    return cv


def hopi():
    """호피 깔개 2×2(호랑이 가죽 펼침): 몸통 + 네 다리 + 머리(귀·눈·코) + 꼬리, 등에서 옆구리로 뻗는 검은 줄무늬. 걷는 바닥 장식."""
    cv = Cv(32, 32)
    def blob(x0, y0, x1, y1, r, col):
        for y in range(y0, y1):
            for x in range(x0, x1):
                dx = max(x0 + r - x, 0, x - (x1 - 1 - r)); dy = max(y0 + r - y, 0, y - (y1 - 1 - r))
                if dx * dx + dy * dy <= r * r + 1:
                    cv.put(x, y, col)
    blob(7, 8, 25, 25, 4, PS[3])                       # 몸통(가장자리 어두운 주황)
    blob(9, 10, 23, 23, 3, PS[4])                      # 몸통 안쪽
    for (x, y) in ((3, 8), (24, 8), (3, 21), (24, 21)):    # 네 다리(벌린 발)
        blob(x, y, x + 5, y + 5, 2, PS[3])
    blob(11, 2, 21, 10, 3, PS[4])                      # 머리
    cv.rect(10, 1, 13, 4, PS[3]); cv.rect(19, 1, 22, 4, PS[3])      # 귀
    cv.put(11, 2, GI[2]); cv.put(20, 2, GI[2])
    cv.put(13, 5, GI[0]); cv.put(14, 5, GI[0]); cv.put(17, 5, GI[0]); cv.put(18, 5, GI[0])     # 눈
    cv.rect(15, 7, 17, 9, PS[5]); cv.put(15, 7, GI[1]); cv.put(16, 7, GI[1])                  # 코
    cv.rect(14, 25, 18, 30, PS[3]); cv.hl(14, 18, 28, GI[1])                                    # 꼬리
    for k, y in enumerate((12, 15, 18, 21)):          # 줄무늬: 등줄기에서 양옆으로
        for sgn in (-1, 1):
            for j in range(5):
                x = 16 + sgn * (3 + j) - (1 if sgn < 0 else 0)
                cv.put(x, y + (j // 3), GI[1])
                if j < 3:
                    cv.put(x, y + (j // 3) + 1, GI[2])
    for (x, y) in ((4, 10), (4, 23), (26, 10), (26, 23)):   # 발 줄무늬
        cv.hl(x, x + 3, y, GI[1])
    B.outline(cv)
    return cv


def chaekdemi():
    """책더미 1×1: 바닥에 쌓은 실로 맨 책 네 권."""
    cv = Cv(16, 16)
    for k, (y, w_, col) in enumerate(((10, 12, PL[5]), (7, 11, PL[6]), (4, 10, DB[4]), (1, 9, PL[5]))):
        x0 = 2 + (k % 2) * 2
        cv.rect(x0, y, x0 + w_, y + 3, col); cv.hl(x0, x0 + w_, y, PL[6] if col != PL[6] else PL[5])
        cv.hl(x0, x0 + w_, y + 2, SW[3]); cv.vl(x0 + w_ - 1, y, y + 3, SW[2])
        for xx in (x0 + 2, x0 + w_ - 3):
            cv.vl(xx, y, y + 2, GI[3]) if False else cv.put(xx, y + 1, GI[2])
    cv.hl(2, 15, 13, WD[2]); cv.hl(2, 15, 14, WD[1])
    B.outline(cv)
    return cv


def yak_table():
    """약방 작업 상 2×1: 위에 대저울과 약 봉지."""
    cv = Cv(32, 16)
    _top(cv, 0, 3, 32, 5)
    _front(cv, 0, 8, 32, 6)
    cv.hl(1, 31, 4, WD[6])
    cv.vl(9, 0, 3, IR[3]); cv.hl(5, 14, 0, IR[4]); cv.vl(5, 0, 2, IR[2]); cv.vl(13, 0, 2, IR[2])        # 저울대와 저울접시
    cv.hl(4, 7, 2, IR[5]); cv.hl(12, 15, 2, IR[5])
    for x0, col in ((19, PL[6]), (24, SW[6])):                                                          # 약봉지
        cv.rect(x0, 1, x0 + 4, 5, col); cv.hl(x0, x0 + 4, 1, PL[6]); cv.vl(x0 + 3, 1, 5, PL[3])
        cv.put(x0 + 2, 3, RD[4])
    cv.rect(2, 12, 2, 12, WD[2]); _pull(cv, 14, 9, 2, 1); _pull(cv, 22, 9, 2, 1)
    cv.vl(15, 8, 14, WD[2]) if False else None
    for x in (3, 28):
        cv.rect(x, 13, x + 2, 16, WD[2])
    B.outline(cv)
    return cv


def sokuri(kind='veg'):
    """소쿠리·광주리 1×1: 엮은 짚 바구니 + 담긴 것. veg=푸성귀 grain=곡식 fruit=감."""
    cv = Cv(16, 16)
    for y in range(7, 15):
        hw = 6 - (y - 7) * 0.12
        for x in range(int(8 - hw), int(8 + hw) + 1):
            row = (y - 7)
            c = SW[4] if (x + row * 2) % 4 < 2 else SW[3]
            if y == 14: c = SW[1]
            cv.put(x, y, c)
    P5.ell(cv, 8, 7, 7, 2.6, lambda x, y, u, v: SW[6] if (v < -0.2) else SW[4])
    if kind == 'veg':
        P5.ell(cv, 8, 5.5, 5.4, 2.4, lambda x, y, u, v: LF[5] if (u + v) < 0.2 else LF[3])
        cv.put(6, 4, LF[6]); cv.put(9, 5, LF[6]); cv.put(10, 4, RD[5])
    elif kind == 'grain':
        P5.ell(cv, 8, 5.5, 5.4, 2.4, lambda x, y, u, v: SW[6] if (u + v) < 0.3 else SW[5])
        cv.put(7, 4, PL[6]); cv.put(10, 5, SW[6])
    else:
        for (x, y) in ((5, 4), (8, 3), (11, 4), (7, 6), (10, 6)):
            disc(cv, x, y, 1.7, PS[4]); cv.put(x - 1, y - 1, PS[6])
    B.outline(cv)
    return cv


def sewing():
    """바느질 상자 1×1(반짇고리): 둥근 모서리 작은 상자 + 뚜껑 위 천 조각과 실패."""
    cv = Cv(16, 16)
    _top(cv, 2, 6, 12, 4)
    _front(cv, 2, 10, 12, 4)
    cv.hl(2, 14, 11, WD[6])
    cv.rect(3, 4, 7, 7, RD[4]); cv.hl(3, 7, 4, RD[6]); cv.rect(8, 3, 11, 7, DB[4]); cv.hl(8, 11, 3, DB[6])
    cv.rect(11, 5, 13, 7, PL[6]); cv.put(11, 5, SW[6])
    _plate(cv, 7, 11, 2, 2)
    B.outline(cv)
    return cv


def dameum():
    """담금질통 1×1: 나무 통 + 위 검은 물 표면 + 김."""
    cv = Cv(16, 16)
    P5.cyl(cv, 8, 6, 6.2, 7, WD, top=(6, 5), body=(5, 4, 3, 2))
    P5.ell(cv, 8, 6, 5, 2.2, lambda x, y, u, v: WT[2] if (u + v) > -0.3 else WT[4])
    cv.put(6, 5, WT[5]); cv.put(7, 5, WT[5])
    for y in range(8, 14):
        if y % 3 == 0:
            cv.hl(2, 14, y, IR[3]) if False else None
    cv.hl(3, 13, 9, IR[2]); cv.hl(3, 13, 12, IR[2])
    cv.put(9, 2, PL[5]); cv.put(8, 3, PL[4]); cv.put(10, 3, PL[5]); cv.put(8, 1, PL[6])    # 김
    B.outline(cv)
    return cv


def hang(kind='sirae'):
    """벽 걸이 1×1(벽면 윗줄): sirae 시래기 두름 · gochu 고추 두름 · yakcho 약초 다발 · meju 메주 · bagaji 바가지."""
    cv = Cv(16, 16)
    if kind == 'sirae':
        cv.hl(2, 14, 1, WD[3]); cv.hl(2, 14, 2, WD[2])
        for k, x in enumerate((3, 6, 9, 12)):
            for y in range(3, 12 + (k % 2) * 2):
                cv.put(x, y, DG[3] if y % 3 else DG[4]); cv.put(x + 1, y, DG[2])
            cv.put(x, 12 + (k % 2) * 2, SW[3])
    elif kind == 'gochu':
        cv.hl(2, 14, 1, WD[3]); cv.hl(2, 14, 2, WD[2])
        for x in (3, 7, 11):
            for y in range(3, 13):
                cv.put(x, y, SW[3] if y % 3 == 0 else RD[4]); cv.put(x + 1, y, RD[3] if y % 3 else RD[5]); cv.put(x + 2, y, RD[2])
    elif kind == 'yakcho':
        cv.hl(4, 12, 1, WD[3])
        for x0, col in ((4, LF[3]), (8, SW[4]), (12, DG[3])):
            for y in range(2, 11):
                w_ = 3 - (y - 2) // 4
                for x in range(x0 - w_, x0 + w_ + 1):
                    cv.put(x, y, col if (x + y) % 3 else col)
            cv.hl(x0 - 1, x0 + 2, 2, WD[2])
    elif kind == 'meju':
        cv.hl(2, 14, 2, SW[2]); cv.hl(2, 14, 3, SW[1])
        for x0 in (3, 9):
            for y in range(4, 12):
                cv.put(x0 + 1, y, SW[3]); cv.put(x0 + 2, y, SW[2])
            cv.rect(x0 - 1, 7, x0 + 4, 14, SW[5]); cv.hl(x0 - 1, x0 + 4, 7, SW[6]); cv.hl(x0 - 1, x0 + 4, 13, SW[2])
            cv.put(x0 + 1, 10, SW[3]); cv.put(x0 + 2, 9, SW[3])
    else:                                              # 바가지
        P5.ell(cv, 8, 9, 5.5, 4.5, lambda x, y, u, v: PL[6] if (u + v) < -0.5 else (PL[5] if (u + v) < 0.3 else PL[3]))
        cv.hl(3, 13, 5, PL[4]); cv.put(8, 2, WD[3]); cv.vl(8, 2, 5, WD[3])
    B.outline(cv)
    return cv


def mat(kind='jip', w=2, h=2, seed=0):
    """깔개 w×h칸(걷는 바닥 장식): jip=짚자리(촘촘히 엮은 짚) dot=돗자리(왕골 무늬, 붉은 가선)."""
    cv = Cv(w * 16, h * 16)
    for y in range(h * 16):
        for x in range(w * 16):
            if kind == 'jip':
                row = y // 2
                ph = (x + row * 3 + (seed * 5)) % 11
                base = SW[3] if ph < 6 else SW[2]
                q = rnd(x, y, 550 + seed)
                if q < 0.08: base = SW[4]
                elif q > 0.95: base = SW[1]
                if y % 2 == 1 and ph in (0, 1): base = SW[1]
                cv.put(x, y, base)
            else:
                base = SW[5] if ((x // 2 + y // 2) % 2 == 0) else SW[4]
                cv.put(x, y, base)
    c1 = SW[1] if kind == 'jip' else RD[3]
    c2 = SW[2] if kind == 'jip' else RD[2]
    cv.rect(0, 0, w * 16, 2, c1); cv.rect(0, h * 16 - 2, w * 16, h * 16, c2)
    cv.rect(0, 0, 2, h * 16, c1); cv.rect(w * 16 - 2, 0, w * 16, h * 16, c2)
    if kind == 'dot':
        cv.rect(4, 4, w * 16 - 4, 5, RD[4]); cv.rect(4, h * 16 - 5, w * 16 - 4, h * 16 - 4, RD[4])
        cv.rect(4, 4, 5, h * 16 - 4, RD[4]); cv.rect(w * 16 - 5, 4, w * 16 - 4, h * 16 - 4, RD[4])
    return cv


def _stair_rails(cv, w, h, x0=0):
    for y in range(h):
        cv.put(x0, y, WD[1]); cv.put(x0 + 1, y, WD[5]); cv.put(x0 + 2, y, WD[3])
        cv.put(x0 + w - 3, y, WD[5]); cv.put(x0 + w - 2, y, WD[3]); cv.put(x0 + w - 1, y, WD[1])


def ladder_up(cols=3, ladder=False):
    """위로 오르는 계단(북벽 쪽): 벽면 두 줄 + 바닥 한 줄 = cols×3. 위는 어두운 다락 입구, 디딤판은 밝고 챌판은 어둡다."""
    W_, H_ = cols * T, 3 * T
    cv = Cv(W_, H_)
    for y in range(0, 8):                                             # 다락 입구(어둠)
        for x in range(W_):
            cv.put(x, y, GI[0] if ((x // 2 + y // 2) % 2 == 0) else GI[1])
    cv.hl(0, W_, 0, WD[1]); cv.hl(3, W_ - 3, 7, WD[2])
    if not ladder:
        n = (H_ - 8) // 5
        for i in range(n):
            y0 = 8 + i * 5
            tread = (WD[6], WD[5]) if i % 2 == 0 else (WD[5], WD[4])
            for x in range(3, W_ - 3):
                cv.put(x, y0, tread[0]); cv.put(x, y0 + 1, tread[1])
                for k, tcol in ((2, WD[3]), (3, WD[2]), (4, WD[2])):
                    cv.put(x, y0 + k, tcol if rnd(x, y0 + k, 60) > 0.15 else WD[1])
            cv.hl(3, W_ - 3, y0 + 4, WD[1])
        _stair_rails(cv, W_, H_)
    else:                                                              # 사다리: 두 짝 기둥 + 가로 디딤
        for y in range(8, H_):
            for x in (4, 5, W_ - 6, W_ - 5):
                cv.put(x, y, WD[5] if x in (4, W_ - 6) else WD[3])
            cv.put(3, y, WD[1]); cv.put(6, y, WD[2]) if False else None
        for y in range(11, H_ - 2, 7):
            cv.hl(4, W_ - 4, y, WD[6]); cv.hl(4, W_ - 4, y + 1, WD[4]); cv.hl(4, W_ - 4, y + 2, WD[2])
    cv.hl(0, W_, H_ - 1, WD[1])
    B.outline(cv)
    return cv


def objects():
    d = {}
    d['in_byeongpung_royal'] = byeongpung_royal()
    d['in_ibul_folded'] = ibul_folded()
    d['in_boryo_2'] = boryo(2)
    d['in_ansuk'] = ansuk()
    d['in_seoan'] = seoan()
    d['in_seoan_2'] = seoan_2()
    d['in_mat_hopi'] = hopi()
    d['in_chaekdemi'] = chaekdemi()
    d['in_yak_table'] = yak_table()
    for k in ('veg', 'grain', 'fruit'):
        d['in_sokuri_' + k] = sokuri(k)
    d['in_sewing'] = sewing()
    d['in_dameum'] = dameum()
    for k in ('sirae', 'gochu', 'meju', 'bagaji'):
        d['in_hang_' + k] = hang(k)
    d['in_mat_dot_2x2'] = mat('dot', 2, 2)
    d['in_ladder_loft'] = ladder_up(1, ladder=True)
    return d
