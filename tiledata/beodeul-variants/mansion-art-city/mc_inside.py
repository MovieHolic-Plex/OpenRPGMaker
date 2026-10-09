# 저택 실내 재료: 극장(opera-stage) 실내 기반(os_kit → airship → tower-interior → graveyard-crypt → _lib3 dlib)을 읽기만 하고
# 그 벽 앞면 체계(K.FACES·op_face_tile: 무늬가 칸 x 로 이어진다)·천장(K.hall_ceiling)·바닥 등록(mk_floor)에 이 장소 재료를 덧붙인다.
# 새 재료: 크림 비단 벽(금 몰딩·흰 징두리 판) · 서재 짙은 나무 판벽 · 헤링본 쪽마루 · 장미 대리석 마름모 바닥.
# 가구는 버들항 소품 화가(pz.C)로 그린다(mc_props 와 같은 결). 3/4 시점, 빛 왼쪽 위, 1칸 = 16px. 사람 얼굴·글자 없음.
import os, sys
_ME = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(_ME, '..', 'opera-stage'))
import os_kit as K
import dlib
from mc_base import *
from mc_base import _hash
import mc_props as MP

GLT = K.GLT; MAH = K.MAH


# ------------------------------------------------------------------ 바닥 (48x48 주기 표본)
def herring_px(X, Y):
    """엇갈림 쪽마루: 4px 폭 세로 널이 12px 마다 끊기며 줄마다 반 칸 어긋난다(널 끝 줄눈 1단), 버들항 나무 램프(WD), 널마다 톤 ±1, 칩셋 널판 결."""
    u = (X + Y) % 48; v = (X - Y) % 48
    col = (X // 4) % 2
    if col == 0: a = (Y + X // 4 * 4) % 12; b = X // 4
    else: a = (Y - X // 4 * 4) % 12; b = X // 4 + 100
    lx = X % 4
    if a == 0: return WD[1]
    if lx == 3: return WD[2]
    h = _hash(b % 12, ((Y + (X // 4) * 4 * (1 if col == 0 else -1)) // 12) % 4, 301)
    t = 5 if h < .4 else (4 if h < .85 else 6)
    g = K.grain(lx + b * 3, a + b * 5) - 3
    if g >= 2: t += 1
    elif g <= -2: t -= 1
    if lx == 0: t = min(6, t + 1)
    return WD[clamp(t, 2, 6)]


ROSE = [(60, 30, 40), (130, 82, 86), (170, 118, 116), (196, 150, 142), (214, 176, 164), (230, 200, 188), (244, 226, 216)]
def rosemarble_px(X, Y):
    """대홀 대리석: 대각 마름모(24px) 크림·장미 대리석 번갈아, 맥은 판마다 다르게, 마름모 꼭짓점 금 점."""
    a = (X + Y) // 24; b = (X - Y + 48) // 24
    la = (X + Y) % 24; lb = (X - Y + 48) % 24
    rose = (a + b) % 2 == 1
    Rr = ROSE if rose else MRB
    if la == 23 or lb == 23: return mix(Rr[2], MRB[2], .5)
    c = Rr[4] if not rose else Rr[4]
    if la == 0 or lb == 0: c = Rr[5]
    elif la == 22 or lb == 22: c = Rr[3]
    ph = _hash(a % 4, b % 4, 311) * 6.28
    vv = math.sin((la * .4 + lb * .7) * .5 + ph + 1.5 * math.sin(la * .3))
    if abs(vv) < .09 and 1 < la < 22 and 1 < lb < 22: c = Rr[3]
    if _hash(X, Y, 312) < .03: c = Rr[3]
    if la <= 1 and lb <= 1: c = GOLD[5]
    return c


K.mk_floor('mc_herring', herring_px)
K.mk_floor('mc_rose', rosemarble_px)


# ------------------------------------------------------------------ 벽 앞면
def cream_face(X, Y, H):
    """저택 벽: 위 금 처마 몰딩 → 크림 비단 벽지(옅은 금 마름모 점) → 금 띠 → 흰 징두리 판(금 테 들어간 판) → 걸레받이."""
    if Y < 4: return (GOLD[5], GOLD[4], CRM[5], GOLD[3])[Y] if not (Y == 2 and X % 4 == 0) else GOLD[3]
    rail = H - 15
    if Y < rail:
        lx = X % 12; ly = (Y - 4) % 12
        c = CRM[5] if (X + Y * 3) % 9 else CRM[4]
        if abs(lx - 5.5) + abs(ly - 5.5) < 1.2: c = GOLD[4]
        elif abs(abs(lx - 5.5) + abs(ly - 5.5) - 5) < .6: c = mix(CRM[4], GOLD[4], .35)
        return c
    ly = Y - rail
    if ly == 0: return GOLD[5] if X % 6 else GOLD[4]
    if ly == 1: return GOLD[3]
    if ly == 2: return CRM[3]
    if ly >= 12: return CRM[3] if ly < 13 else CRM[2]
    px_ = X % 24; py = ly - 3
    if px_ < 2 or px_ > 21 or py < 1 or py > 7:
        c = CRM[5]
        if px_ == 0: c = CRM[6]
    else:
        c = CRM[5] if px_ < 12 else CRM[4]
        if px_ == 2 or py == 1: c = GOLD[3]
        elif px_ == 21 or py == 7: c = CRM[6]
    return c


def library_face(X, Y, H):
    """서재 벽: 금 처마 몰딩 → 짙은 마호가니 판벽(세로 판 + 들어간 판 테) → 걸레받이."""
    if Y < 3: return (GOLD[5], GOLD[3], MAH[1])[Y]
    px_ = X % 16; py = (Y - 3) % 20
    if py == 0 or px_ == 0: c = MAH[2]
    elif px_ in (2, 13) or py in (2, 17): c = MAH[5] if (px_ == 2 or py == 2) else MAH[1]
    else: c = MAH[3] if px_ < 8 else mix(MAH[3], MAH[2], .4)
    if Y >= H - 3: c = MAH[1]
    if K.grain(X, Y) >= 5 and c in (MAH[3],): c = MAH[4]
    return c


K.FACES['mc_cream'] = (cream_face, CRM[4]); dlib.FACE_BASE['mc_cream'] = CRM[4]
K.FACES['mc_lib'] = (library_face, MAH[3]); dlib.FACE_BASE['mc_lib'] = MAH[3]
def face_sample(sty, w, h): return K.face_sample(sty, w, h)


# ------------------------------------------------------------------ 가구
def _f(c): return pz.fin(c)


def grand_stair():
    """대홀 큰 계단(4×3): 대리석 디딤판 여섯 단이 북쪽 위층으로 오르며 어두워지고, 가운데 진홍 깔개(금 누름대),
    양옆 금 난간동자 난간과 아래 기둥머리 금 등. 맨 윗줄이 위층 이동 칸."""
    c = C(64, 48, 801)
    c.group(1); c.new()
    for y in range(0, 46):
        step = y // 8; ly = y % 8
        for x in range(6, 58):
            t = 6 - step // 2 if ly < 3 else (4 - step // 2 if ly < 6 else 2)
            m = 'marble'
            if 22 <= x < 42:
                m = 'wine'; t = (5 if ly < 3 else 3) - step // 3
                if ly == 3: m, t = 'gold', 5
            c.tone(x, y, m, clamp(t))
    c.group(2); c.new()
    for side in (0, 1):
        x0 = 1 if side == 0 else 58
        for y in range(0, 46):
            for x in range(x0, x0 + 5):
                c.tone(x, y, 'marble', (6, 5, 5, 4, 2)[x - x0] if side == 0 else (5, 4, 4, 3, 2)[x - x0])
            if y % 4 == 0: c.tone(x0 + 2, y, 'gold', 5 if side == 0 else 3)
        for x in range(x0, x0 + 5): c.tone(x, 0, 'gold', 6 if side == 0 else 4)
    c.group(3)
    for x0 in (0, 57):
        c.box(x0, 34, 7, 2, 11, 'marble', bias=.05)
        c.new()
        for x in range(x0 + 1, x0 + 6): c.tone(x, 37, 'gold', 5)
        c.ellipsoid(x0 + 3.5, 31, 2.6, 2.8, 'gold', amb=.3, bias=.12)
    return _f(c)


def fireplace():
    """대리석 벽난로(3×3): 크림 대리석 선반·기둥, 금 테, 불 피운 아궁이와 쇠 받침, 선반 위 금 촛대 둘·시계, 위 금 거울.
    맨 아랫줄만 바닥(막힘), 위 2줄은 벽 앞면 위."""
    c = C(48, 48, 811)
    c.group(1); c.new()                                                    # 위 금 거울
    for y in range(1, 18):
        for x in range(10, 38):
            e = x in (10, 11, 36, 37) or y in (1, 2, 16, 17)
            if e: c.tone(x, y, 'gold', 6 if (x < 12 or y < 3) else 3)
            else: c.tone(x, y, 'sky', 5 if (x - y) % 11 < 2 else (4 if y < 9 else 3))
    c.tone(23, 0, 'gold', 6); c.tone(24, 0, 'gold', 4)
    c.group(2); c.box(2, 24, 44, 3, 2, 'marble', bias=.06)                 # 선반
    for x in range(2, 46): c.tone(x, 27, 'gold', 5 if x < 24 else 4)
    c.group(3); c.new()
    for y in range(28, 47):
        for x in range(4, 44):
            if 12 <= x < 36 and y >= 32:
                d = (y - 32) / 15
                if y >= 44: c.tone(x, y, 'iron', 2); continue
                fx = abs(x + .5 - 24) / (12 - d * 2)
                if y > 36 and fx < .9 - (46 - y) * .03 and _hash(x, y, 812) < .9: c.tone(x, y, 'fire', 6 if fx < .3 and y > 39 else (5 if fx < .6 else 4))
                else: c.tone(x, y, 'dark', 2 if y < 40 else 3)
                continue
            t = 6 if x < 6 else (5 if x < 12 else (4 if x < 40 else 2))
            if y == 28: t = 6
            c.tone(x, y, 'marble', t)
    for x in range(12, 36): c.tone(x, 31, 'gold', 4); c.tone(x, 32, 'marble', 2)
    c.group(4)
    for cx in (7, 40):                                                     # 금 촛대
        c.new()
        for y in range(17, 24): c.tone(cx, y, 'gold', 5); c.tone(cx + 1, y, 'gold', 3)
        c.tone(cx, 15, 'fire', 6); c.tone(cx, 16, 'cream', 6); c.tone(cx + 1, 16, 'cream', 4)
    c.new()
    for y in range(18, 24):
        for x in range(21, 27): c.tone(x, y, 'gold', 5 if x < 24 else 3)
    c.tone(23, 20, 'cream', 6); c.tone(24, 20, 'cream', 5)
    return _f(c)


def sofa():
    """진홍 벨벳 소파(3×2): 금테 등받이(단추 누빔 점), 방석 셋, 둥근 팔걸이, 금 다리 — 앞을 본다."""
    c = C(48, 32, 821); c.shadow(24, 30, 22, 2)
    c.group(1); c.new()
    for y in range(3, 16):
        for x in range(4, 44):
            top = 3 + int(2 * (1 - abs(x + .5 - 24) / 20))
            if y < top: continue
            t = 5 if y < top + 2 else 4
            if (x - 4) % 8 == 4 and (y - top) % 5 == 3: t = 2
            c.tone(x, y, 'wine', t)
    for x in range(4, 44):
        top = 3 + int(2 * (1 - abs(x + .5 - 24) / 20)); c.tone(x, top, 'gold', 5 if x < 24 else 4)
    c.group(2)
    for i in range(3): c.box(7 + i * 12, 15, 11, 4, 5, 'wine', bias=.08)
    c.group(3)
    for x0 in (1, 41):
        c.box(x0, 12, 6, 3, 10, 'wine', bias=.0)
        c.new()
        for y in range(12, 15): c.tone(x0, y, 'gold', 5)
    c.new()
    for x in range(2, 46): c.tone(x, 25, 'gold', 4 if x < 24 else 3)
    for x in (4, 43):
        for y in range(26, 30): c.tone(x, y, 'gold', 4)
    return _f(c)


def armchair(face='s'):
    """진홍 팔걸이 의자(1×2): 높은 금테 등받이 + 방석 + 팔걸이 + 금 다리. face s = 앞(남)을 본다, n = 뒤에서 본다."""
    c = C(16, 32, 831 + (face == 'n')); c.shadow(8, 30, 7, 1.5)
    c.group(1); c.new()
    for y in range(4, 20 if face == 's' else 24):
        for x in range(2, 14):
            r = abs(x + .5 - 8)
            if y < 7 and r > 6 - (7 - y) * 1.2: continue
            t = (5 if x < 8 else 4) if face == 's' else (4 if x < 8 else 3)
            if face == 's' and y > 6 and (x - 2) % 4 == 2 and (y - 6) % 4 == 2: t = 2
            c.tone(x, y, 'wine', t)
        if y >= 4: c.tone(2, y, 'gold', 5); c.tone(13, y, 'gold', 3)
    for x in range(3, 13): c.tone(x, 4 if abs(x - 7.5) < 3 else 5, 'gold', 6 if x < 8 else 4)
    if face == 's':
        c.group(2); c.box(3, 18, 10, 3, 4, 'wine', bias=.1)
        c.group(3)
        for x0 in (0, 12): c.box(x0, 15, 4, 2, 8, 'wine', bias=-.02)
    c.new()
    for x in (2, 13):
        for y in range(25, 30): c.tone(x, y, 'gold', 4)
    return _f(c)


def tea_table():
    """낮은 찻상(2×1): 대리석 윗면 + 금 테·금 다리, 위에 은 주전자와 잔 둘."""
    c = C(32, 16, 841); c.shadow(16, 15, 14, 1.4)
    c.group(1); c.box(2, 3, 28, 5, 2, 'marble', bias=.05)
    c.new()
    for x in range(2, 30): c.tone(x, 8, 'gold', 5 if x < 16 else 4); c.tone(x, 9, 'gold', 2)
    for x in (4, 27):
        for y in range(10, 15): c.tone(x, y, 'gold', 4); c.tone(x + 1, y, 'gold', 2)
    c.group(2); c.new()
    for y in range(0, 6):
        for x in range(12, 18): c.tone(x, y, 'iron', 6 if x < 14 else 4)
    c.tone(18, 2, 'iron', 4); c.tone(19, 3, 'iron', 4)
    for x in (7, 22): c.tone(x, 5, 'cream', 6); c.tone(x + 1, 5, 'cream', 4)
    return _f(c)


def bookcase(seed=0):
    """서재 책장(2×3): 마호가니 틀·금 갓 장식, 다섯 칸에 색 책등(금 띠), 한 칸에 금 지구본 작은 것. 아래 2줄 막힘."""
    c = C(32, 48, 851 + seed)
    c.group(1); c.new()
    for y in range(2, 48):
        for x in range(0, 32):
            e = x < 2 or x >= 30 or y < 5 or y >= 45
            if e: c.tone(x, y, 'wood', 5 if x < 2 or y < 5 else 2)
            else: c.tone(x, y, 'wood', 1)
    for x in range(0, 32): c.tone(x, 2, 'gold', 6 if x < 16 else 4); c.tone(x, 3, 'gold', 3)
    c.tone(15, 1, 'gold', 6); c.tone(16, 1, 'gold', 4); c.tone(15, 0, 'gold', 5)
    shelves = [(5, 12), (13, 20), (21, 28), (29, 36), (37, 44)]
    cols = ['wine', 'navy', 'boxw', 'ochre', 'red', 'wood', 'sky', 'wine', 'navy']
    for si, (y0, y1) in enumerate(shelves):
        for x in range(2, 30): c.tone(x, y1, 'wood', 4)
        x = 3
        k = seed * 7 + si * 3
        while x < 29:
            w = 2 + int(_hash(k, x, 852) * 2); h = (y1 - y0) - int(_hash(x, k, 853) * 3)
            m = cols[(k + x) % len(cols)]
            if _hash(k, x, 854) < .1 and x < 25:                                   # 기운 책
                for i in range(h - 1): c.tone(x + i // 3, y1 - 1 - i, m, 4)
                x += 4; continue
            for xx in range(x, min(29, x + w)):
                for yy in range(y1 - h, y1):
                    t = 5 if xx == x else (4 if xx < x + w - 1 else 3)
                    if yy == y1 - h + 2: t = 6 if m != 'ochre' else 5
                    c.tone(xx, yy, m, t)
                c.tone(xx, y1 - h + 2, 'gold', 5)
            x += w + (1 if _hash(x, k, 855) < .2 else 0)
    return _f(c)


def reading_desk():
    """서재 책상(3×2): 마호가니 윗면(초록 가죽 판) + 서랍 앞면, 위에 펼친 책·잉크병·깃펜·초록 갓 등."""
    c = C(48, 32, 861); c.shadow(24, 30, 22, 2)
    c.group(1); c.box(2, 6, 44, 8, 13, 'wood', bias=.04)
    c.new()
    for y in range(7, 13):
        for x in range(6, 42): c.tone(x, y, 'boxw', 4 if y < 10 else 3)
    for x in range(2, 46): c.tone(x, 14, 'gold', 4)
    for (x0, x1) in ((5, 19), (29, 43)):
        for y in range(16, 26):
            for x in range(x0, x1):
                if x in (x0, x1 - 1) or y in (16, 25): c.tone(x, y, 'wood', 2)
        c.tone((x0 + x1) // 2, 20, 'gold', 6)
    c.group(2); c.new()
    for y in range(6, 11):                                                   # 펼친 책
        for x in range(16, 30): c.tone(x, y, 'cream', 6 if x < 23 else 5)
    for y in range(6, 11): c.tone(23, y, 'cream', 3)
    for x in range(17, 22, 2): c.tone(x, 8, 'cream', 4)
    c.new(); c.tone(33, 9, 'navy', 3); c.tone(34, 9, 'navy', 2); c.tone(33, 8, 'iron', 5)
    for i in range(5): c.tone(35 + i // 2, 8 - i, 'cream', 6)
    c.group(3); c.new()                                                       # 초록 갓 등
    for y in range(0, 4):
        for x in range(6 - y, 12 + y): c.tone(x, y, 'boxw', 5 if x < 9 else 3)
    for y in range(4, 9): c.tone(8, y, 'gold', 5); c.tone(9, y, 'gold', 3)
    for x in range(6, 12): c.tone(x, 9, 'gold', 4)
    return _f(c)


def globe():
    """지구본(1×2): 금 자오선 고리와 받침 세 다리, 바다 남빛·땅 초록 덩이."""
    c = C(16, 32, 871); c.shadow(8, 30, 6, 1.3)
    c.group(1); c.new()
    for y in range(16, 30):
        t = (y - 16) / 14
        c.tone(int(7 - 4 * t), y, 'wood', 5); c.tone(int(9 + 4 * t), y, 'wood', 3); c.tone(8, y, 'wood', 2)
    c.group(2); c.ellipsoid(8, 10, 5.5, 5.5, 'navy', amb=.3, bias=.15)
    c.new()
    for (x, y) in ((6, 8), (7, 8), (6, 9), (5, 10), (10, 11), (10, 12), (9, 12), (7, 13), (9, 7)):
        c.tone(x, y, 'leaf', 4 if x < 8 else 3)
    c.new()
    for y in range(3, 18):
        dy = (y + .5 - 10) / 7
        if abs(dy) <= 1: c.tone(int(8 + 6.8 * math.sqrt(1 - dy * dy)), y, 'gold', 4); c.tone(int(8 - 6.8 * math.sqrt(1 - dy * dy)), y, 'gold', 5)
    return _f(c)


def dining_table(n=4):
    """식당 긴 식탁(2n+2 × 3): 흰 식탁보(접힌 끝 늘어짐) 위 금 촛대 셋(불), 접시·잔 줄, 가운데 과일 그릇과 꽃. 의자는 따로."""
    W = (2 * n + 2) * 16
    c = C(W, 48, 881); c.shadow(W / 2, 46, W / 2 - 4, 2)
    c.group(1); c.new()
    for y in range(12, 43):
        for x in range(2, W - 2):
            if y < 34: t = 6 if y < 14 or (x + y * 3) % 23 else 5                    # 윗면(흰 천, 잔 주름 점)
            else: t = 5 if y < 37 else 4                                          # 늘어진 앞 자락
            c.tone(x, y, 'cream', t)
    for x in range(2, W - 2):
        c.tone(x, 34, 'cream', 4 if (x % 6) else 3)
        for y in range(35, 43):
            if (x % 12) in (0, 1): c.tone(x, y, 'cream', 3)
    for y in range(12, 34): c.tone(2, y, 'cream', 6)
    for x in range(6, W - 6): c.tone(x, 22, 'wine', 4); c.tone(x, 23, 'wine', 3)      # 가운데 띠(포도주 러너)
    for x in (6, W - 7):
        for y in range(43, 47): c.tone(x, y, 'wood', 3); c.tone(x + 1, y, 'wood', 2)
    c.group(2)
    for i in range(n):                                                        # 접시·잔(위·아래 줄)
        for yy in (15, 28):
            cx = 24 + i * 32
            if cx > W - 16: continue
            c.new()
            for y in range(yy - 2, yy + 2):
                for x in range(cx - 4, cx + 4):
                    if math.hypot((x + .5 - cx) / 4, (y + .5 - yy) / 2) <= 1: c.tone(x, y, 'cream', 6 if math.hypot((x + .5 - cx) / 4, (y + .5 - yy) / 2) > .55 else 5)
            c.tone(cx + 6, yy - 2, 'sky', 6); c.tone(cx + 6, yy - 1, 'sky', 5)
    c.group(3)
    for k, cx in enumerate((W // 4, W // 2, 3 * W // 4)):
        c.new()
        if k == 1:                                                            # 과일 그릇 + 꽃
            c.ellipsoid(cx, 20, 6, 3, 'gold', amb=.3)
            for (x, y, m) in ((cx - 3, 17, 'red'), (cx, 16, 'ochre'), (cx + 3, 17, 'leaf'), (cx - 1, 15, 'red'), (cx + 2, 14, 'pink')):
                c.ellipsoid(x, y, 2, 1.8, m, amb=.35, bias=.1)
            continue
        for y in range(6, 22): c.tone(cx, y, 'gold', 5); c.tone(cx + 1, y, 'gold', 3)
        for x in range(cx - 5, cx + 7): c.tone(x, 10, 'gold', 5 if x < cx else 3)
        for dx in (-5, 0, 6):
            c.tone(cx + dx, 8, 'cream', 6); c.tone(cx + dx, 9, 'cream', 5); c.tone(cx + dx, 6, 'fire', 6); c.tone(cx + dx, 7, 'fire', 5)
        for x in range(cx - 3, cx + 5): c.tone(x, 21, 'gold', 4)
    return _f(c)


def dining_chair(face='s'):
    """식당 의자(1×2): 높은 마호가니 등받이(포도주 방석). s = 식탁 아래쪽에 앉는 자리(등받이가 앞), n = 위쪽(등받이가 뒤)."""
    c = C(16, 32, 891 + (face == 'n')); c.shadow(8, 30, 6, 1.3)
    if face == 'n':
        c.group(1); c.box(3, 18, 10, 4, 3, 'wine', bias=.05)
        c.group(2); c.new()
        for y in range(5, 20):
            for x in range(3, 13):
                e = x in (3, 4, 11, 12) or y < 8
                if e: c.tone(x, y, 'wood', 5 if x < 8 else 3)
                elif y > 9 and x in (6, 9): c.tone(x, y, 'wood', 3)
        for x in range(3, 13): c.tone(x, 5, 'gold', 5)
        for x in (3, 12):
            for y in range(25, 30): c.tone(x, y, 'wood', 3)
    else:
        c.group(1); c.new()
        for y in range(8, 22):
            for x in range(3, 13):
                if x in (3, 12) or y in (8, 9): c.tone(x, y, 'wood', 5 if x < 8 else 3)
                elif y < 20: c.tone(x, y, 'wine', 4 if x < 8 else 3)
        for x in range(3, 13): c.tone(x, 8, 'gold', 5)
        c.group(2); c.box(2, 21, 12, 3, 3, 'wine', bias=.05)
        for x in (3, 12):
            for y in range(27, 30): c.tone(x, y, 'wood', 3)
    return _f(c)


def sideboard():
    """식당 찬장(3×2): 마호가니 서랍장 위 은 쟁반·포도주 병 둘·금 촛대, 앞면 금 손잡이 문 셋. 아래 2줄 막힘."""
    c = C(48, 32, 901); c.shadow(24, 31, 23, 1.5)
    c.group(1); c.box(1, 12, 46, 4, 15, 'wood', bias=.03)
    for x in range(1, 47): c.tone(x, 16, 'gold', 5 if x < 24 else 4)
    c.new()
    for i in range(3):
        x0 = 4 + i * 14
        for y in range(18, 28):
            for x in range(x0, x0 + 12):
                if x in (x0, x0 + 11) or y in (18, 27): c.tone(x, y, 'wood', 2)
        c.tone(x0 + 6, 22, 'gold', 6)
    c.group(2); c.new()
    for x in range(8, 24):
        for y in range(9, 13):
            if math.hypot((x + .5 - 16) / 8, (y + .5 - 11) / 2.2) <= 1: c.tone(x, y, 'iron', 6 if x < 15 else 4)
    for bx in (29, 34):
        c.new()
        for y in range(2, 13):
            hw = 1 if y < 6 else 2
            for x in range(bx - hw, bx + hw): c.tone(x, y, 'wine', 4 if x < bx else 2)
        c.tone(bx - 1, 7, 'wine', 6)
    c.new()
    for y in range(3, 13): c.tone(41, y, 'gold', 5)
    c.tone(41, 1, 'fire', 6); c.tone(41, 2, 'cream', 6)
    return _f(c)


def china_cabinet():
    """그릇장(2×3): 금 갓 장식 마호가니 장, 위 유리문 속 흰 접시·찻잔 줄, 아래 서랍. 아래 2줄 막힘."""
    c = C(32, 48, 911)
    c.group(1); c.new()
    for y in range(3, 47):
        for x in range(1, 31):
            e = x < 3 or x >= 28 or y < 6 or y in (30, 31) or y >= 45
            c.tone(x, y, 'wood', (5 if x < 3 or y < 6 else 3) if e else (2 if y < 30 else 3))
    for x in range(1, 31): c.tone(x, 3, 'gold', 6 if x < 16 else 4); c.tone(x, 4, 'gold', 3)
    c.tone(15, 1, 'gold', 6); c.tone(16, 2, 'gold', 4); c.tone(15, 2, 'gold', 5)
    for y in range(6, 30): c.tone(15, y, 'wood', 4)
    for sy in (13, 21, 29):
        for x in range(3, 28): c.tone(x, sy, 'wood', 4)
    for sy in (13, 21, 29):
        for cx in (6, 11, 19, 24):
            for y in range(sy - 6, sy):
                for x in range(cx - 2, cx + 2):
                    if math.hypot((x + .5 - cx) / 2.4, (y + .5 - (sy - 3)) / 3) <= 1: c.tone(x, y, 'cream', 6 if x < cx else 4)
            c.tone(cx, sy - 3, 'navy', 4)
    for (x0, x1) in ((4, 15), (17, 28)):
        for y in range(33, 43):
            for x in range(x0, x1):
                if x in (x0, x1 - 1) or y in (33, 42): c.tone(x, y, 'wood', 2)
        c.tone((x0 + x1) // 2, 37, 'gold', 6)
    for y in range(6, 30): c.tone(4, y, 'sky', 6) if y % 7 == 0 else None
    return _f(c)


def grandfather_clock():
    """괘종시계(1×3): 마호가니 긴 몸통, 위 금 둘레 시계판(눈금만), 유리창 속 금 추. 아랫줄만 막힘."""
    c = C(16, 48, 921); c.shadow(8, 47, 6, 1.2)
    c.group(1); c.new()
    for y in range(2, 47):
        for x in range(2, 14):
            if y < 6 and abs(x + .5 - 8) > 2 + (y - 2) * 1.5: continue
            c.tone(x, y, 'wood', 5 if x < 4 else (4 if x < 11 else 2))
    c.group(2); c.new()
    for y in range(6, 18):
        for x in range(3, 13):
            r = math.hypot(x + .5 - 8, y + .5 - 12)
            if r <= 5: c.tone(x, y, 'gold' if r > 4 else 'cream', (5 if x < 8 else 3) if r > 4 else (6 if r < 3.5 else 5))
    for a in range(12):
        ang = a / 12 * 6.283; c.tone(int(8 + math.cos(ang) * 3.2), int(12 + math.sin(ang) * 3.2), 'iron', 2)
    c.tone(8, 10, 'iron', 1); c.tone(8, 11, 'iron', 1); c.tone(9, 12, 'iron', 1)
    c.new()
    for y in range(22, 38):
        for x in range(5, 11): c.tone(x, y, 'dark', 3 if y < 30 else 2)
    for y in range(22, 34): c.tone(8, y, 'gold', 4)
    c.ellipsoid(8, 35, 2.2, 2.2, 'gold', amb=.3, bias=.1)
    return _f(c)


def candelabra():
    """서 있는 금 촛대(1×2): 세 갈래 금 팔에 초 셋(불). 아랫줄만 막힘."""
    c = C(16, 32, 931); c.shadow(8, 30.5, 4.5, 1.2)
    c.group(1); c.new()
    for x in range(4, 12): c.tone(x, 29, 'gold', 5 if x < 8 else 3); c.tone(x, 30, 'gold', 2)
    for y in range(8, 29): c.tone(7, y, 'gold', 5); c.tone(8, y, 'gold', 3)
    for x in range(2, 14): c.tone(x, 9, 'gold', 5 if x < 8 else 3)
    for cx in (2, 7, 13):
        c.tone(cx, 6, 'cream', 6); c.tone(cx, 7, 'cream', 5); c.tone(cx, 8, 'cream', 4)
        c.tone(cx, 4, 'fire', 6); c.tone(cx, 5, 'fire', 5)
    return _f(c)


def wall_painting(kind=0, w=2, h=2):
    """벽 큰 그림(w×h, 벽 앞면 위 장식): 두꺼운 금 액자(빛 위·왼), 풍경·바다·정물·추상(얼굴·글자 없음)."""
    c = C(w * 16, h * 16, 941 + kind)
    W, H = w * 16, h * 16
    c.group(1); c.new()
    for y in range(1, H - 1):
        for x in range(1, W - 1):
            e = min(x - 1, y - 1, W - 2 - x, H - 2 - y)
            if e < 3: c.tone(x, y, 'gold', (6 if (x < W // 2 and y < H // 2) else 3) if e == 0 else (5 if e == 1 else 4 if e == 2 else 3))
    MP.paint(c, 4, 4, W - 8, H - 8, kind, kind * 3)
    return _f(c)


def mirror_gilt():
    """금 거울(2×2, 벽 장식): 꼭대기 조개 장식이 있는 둥근 금테 속 은빛 유리와 반짝 줄."""
    c = C(32, 32, 951)
    c.group(1); c.new()
    for y in range(2, 31):
        for x in range(3, 29):
            r = math.hypot((x + .5 - 16) / 12.5, (y + .5 - 17) / 13.5)
            if r > 1: continue
            if r > .82: c.tone(x, y, 'gold', 6 if (x < 16 and y < 17) else 3)
            else: c.tone(x, y, 'sky', 6 if (x - y) % 9 < 2 else (5 if y < 16 else 4))
    for x in range(12, 21): c.tone(x, 1, 'gold', 5); c.tone(x, 2, 'gold', 4)
    c.tone(16, 0, 'gold', 6)
    return _f(c)


def rug_persian():
    """긴 융단(5×3, 바닥 장식 걷기): 포도주 바탕, 남빛·금 테 두 줄, 가운데 금 마름모 메달리온, 양끝 술."""
    W, H = 80, 48; im = new(W, H); p = im.load()
    for y in range(H):
        for x in range(2, W - 2):
            e = min(x - 2, y, W - 3 - x, H - 1 - y)
            if e == 0: c = WINE[1]
            elif e < 3: c = R['navy'][3]
            elif e == 3: c = GOLD[4]
            elif e < 6: c = WINE[3] if (x + y) % 4 else GOLD[3]
            else:
                c = WINE[4] if (x // 3 + y // 3) % 2 else WINE[3]
                d = abs(x + .5 - W / 2) / 22 + abs(y + .5 - H / 2) / 13
                if d < 1: c = GOLD[4] if d > .8 else (R['navy'][4] if d > .45 else (GOLD[5] if d < .18 else WINE[5]))
            p[x, y] = tuple(c) + (255,)
    for y in range(2, H - 2, 2):
        p[0, y] = tuple(CRM[5]) + (255,); p[1, y] = tuple(CRM[4]) + (255,); p[W - 1, y] = tuple(CRM[4]) + (255,); p[W - 2, y] = tuple(CRM[3]) + (255,)
    return im
