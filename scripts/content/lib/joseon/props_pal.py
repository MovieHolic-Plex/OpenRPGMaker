"""조선 궁 내부 기물(`pal_` 접두): 어좌 · 일월오봉도 병풍 · 향로 · 촛대·등 · 방석·교의 · 서안·문서함 · 큰 북·종 · 침전(금침·장롱·화장대·경대) · 수라상 · 약탕 · 서고 서가 · 궁녀·관리 자리 · 창 거치대.

그리는 도구는 in_draw.py(3/4 블록·틀·놋쇠·천·사발) — 실내 기물과 같은 시점·명암 규칙이다: 정면-위 3/4, 빛 왼쪽 위, 윗면 3~6px, 앞면 전체 높이,
바닥 가구는 윤곽을 안쪽 0.62배(build.outline). 궁 기물의 차이는 재료다: 붉은 옻칠 + 금(persimmon) 장식 + 청·녹 단청. 색은 tk.RGB 램프(잠긴 팔레트 91색)에서만 고른다.
"""
import math
from in_draw import *


def gold(c, x, y, w=2, h=2):
    """금 장식 한 점(밝은 금 + 아랫줄 어두운 금)."""
    for j in range(h):
        for i in range(w):
            c.put(x + i, y + j, Pe[5] if j == 0 else Pe[3])


def lacquer(c, x0, y0, x1, y1, ramp=None, hi=5):
    """옻칠 면: 왼쪽 밝고 오른쪽 어둡다, 드문 윤 얼룩."""
    r = ramp or Rd
    for y in range(y0, y1):
        for x in range(x0, x1):
            f = (x - x0) / max(1, x1 - x0 - 1)
            t = hi if f < 0.15 else (hi - 1 if f < 0.6 else (hi - 2 if f < 0.9 else hi - 3))
            if rnd(x, y, 140) > 0.96: t = min(6, t + 1)
            c.put(x, y, r[max(1, t)])


# ------------------------------------------------------------------ 어좌 · 병풍
def throne():
    """어좌(용상) 32×48: 높은 붉은 옻칠 등받이(금테 + 금 원문, 위에 금 관) · 두 팔걸이 · 금 띠 두른 앉는 자리 · 발받침."""
    c = new(2, 3)
    for x in range(5, 27):                                   # 등받이 금테
        c.put(x, 3, Pe[5]); c.put(x, 4, Pe[4]); c.put(x, 26, Pe[2]); c.put(x, 25, Pe[3])
    for y in range(3, 27):
        c.put(5, y, Pe[5]); c.put(6, y, Pe[4]); c.put(26, y, Pe[2]); c.put(25, y, Pe[3])
    lacquer(c, 7, 5, 25, 25)                                 # 붉은 판
    for (cx, cy, r, col) in ((16, 14, 5.6, Pe), (16, 14, 3.4, Rd)):   # 금 원문(둥근 용 무늬 자리)
        for y in range(-7, 8):
            for x in range(-7, 8):
                d = x * x + y * y
                if d <= r * r:
                    if col is Pe:
                        c.put(cx + x, cy + y, Pe[5] if (x < 0 and y < 0) else (Pe[4] if d > 20 else Pe[3]))
                    else:
                        c.put(cx + x, cy + y, Rd[2] if x > 0 else Rd[3])
    for (x, y) in ((14, 12), (15, 13), (16, 14), (17, 15), (18, 14), (17, 13)):          # 원 속 금 소용돌이
        c.put(x, y, Pe[5])
    for (x, y) in ((9, 7), (22, 7), (9, 22), (22, 22)):
        gold(c, x, y)
    for (y, x0, x1, col) in ((0, 12, 20, 5), (1, 10, 22, 4), (2, 8, 24, 3)):             # 금 관(위 장식)
        c.hl(x0, x1, y, Pe[col])
    c.put(15, 1, Rd[5]); c.put(16, 1, Rd[4])
    for x0 in (2, 25):                                       # 팔걸이: 기둥 + 위 받침
        for y in range(21, 34):
            for k in range(3):
                c.put(x0 + k + (1 if x0 == 25 else 0) - (0 if x0 == 2 else 0), y, Rd[(5, 4, 2)[k]] if x0 == 2 else Rd[(4, 3, 1)[k]])
        c.hl(x0 - 1, x0 + 5, 20, Pe[5]); c.hl(x0 - 1, x0 + 5, 21, Pe[3])
    for y in range(27, 31):                                  # 앉는 자리(윗면 방석)
        for x in range(5, 27):
            c.put(x, y, Rd[6] if (y == 27 or x == 5) else (Rd[5] if y < 30 else Pe[4]))
    for y in range(31, 39):                                  # 앞 널(금띠 둘)
        for x in range(5, 27):
            f = (x - 5) / 21.0
            c.put(x, y, Rd[(4 if f < 0.3 else (3 if f < 0.8 else 2)) if y < 38 else 1])
    c.hl(5, 27, 33, Pe[4]); c.hl(5, 27, 36, Pe[3])
    for x in range(8, 26, 4):
        gold(c, x, 34, 2, 1)
    for x0 in (6, 22):                                       # 다리
        for y in range(39, 42):
            c.put(x0, y, Rd[3]); c.put(x0 + 1, y, Rd[2]); c.put(x0 + 2, y, Rd[1])
    for y in range(42, 48):                                  # 발받침
        for x in range(9, 23):
            if y < 44: c.put(x, y, Pe[5] if y == 42 else Rd[5])
            elif y < 47: c.put(x, y, Rd[4] if x < 14 else (Rd[3] if x < 20 else Rd[2]))
            else: c.put(x, y, Rd[1])
    c.hl(9, 23, 45, Pe[4])
    outline(c)
    contact(c, 4, 27, 47, 1)
    return c


def byeongpung_ilwol(cells=6):
    """일월오봉도 병풍 96×48: 여섯 폭 — 청색 바탕에 해(붉음)와 달(흰), 오봉 다섯 봉우리, 양끝 소나무, 밑에 물결. 붉은 옻칠 틀에 금테."""
    c = new(cells, 3)
    W, H = cells * 16, 48
    c.rect(1, 3, W - 1, 42, Rd[3])                                   # 틀
    c.hl(1, W - 1, 3, Pe[5]); c.hl(1, W - 1, 4, Pe[4]); c.hl(1, W - 1, 40, Pe[3]); c.hl(1, W - 1, 41, Pe[2])
    c.vl(1, 3, 42, Pe[5]); c.vl(2, 3, 42, Pe[4]); c.vl(W - 2, 3, 42, Pe[2]); c.vl(W - 3, 3, 42, Pe[3])
    for y in range(6, 39):                                           # 청색 바탕(위 → 아래 약간 밝아짐)
        for x in range(4, W - 4):
            q = rnd(x, y, 141)
            c.put(x, y, Db[1] if (y < 10 and q < 0.5) or (10 <= y < 16 and q < 0.15) else Db[2])
    for (cx, cy, r, ramp) in ((20, 13, 5, Rd), (W - 20, 13, 5, Pl)):     # 해와 달
        for y in range(-r - 1, r + 2):
            for x in range(-r - 1, r + 2):
                if x * x + y * y <= r * r:
                    c.put(cx + x, cy + y, ramp[6] if (x < 0 and y < 0) else (ramp[5] if x < 1 else ramp[4]))
    unit = (W - 24) // 4
    for k, hh in enumerate((9, 14, 21, 14, 9)):                      # 오봉: 가운데가 가장 높다
        cx = 12 + k * unit
        for y in range(38 - hh, 38):
            hw = int((y - (38 - hh)) * 0.62) + 2
            for x in range(cx - hw, cx + hw + 1):
                if 4 <= x < W - 4:
                    lit = x < cx - hw // 3
                    c.put(x, y, Dg[5] if (lit and (x + y) % 4) else (Dg[4] if x < cx + hw // 3 else Dg[3]))
        c.hl(cx - 1, cx + 2, 38 - hh, Dg[6])
        for yy in range(38 - hh + 3, 38, 4):                         # 봉우리 결
            c.put(cx - 2, yy, Dg[6]); c.put(cx + 1, yy + 1, Dg[2])
    for x0 in (8, W - 9):                                            # 양끝 소나무
        c.vl(x0, 22, 38, Wd[3]); c.vl(x0 + 1, 22, 38, Wd[2])
        for (dy, w) in ((12, 5), (16, 7), (20, 5)):
            c.hl(x0 - w // 2, x0 + w // 2 + 2, dy, Le_[4]); c.hl(x0 - w // 2 + 1, x0 + w // 2 + 1, dy + 1, Le_[3])
    for x in range(4, W - 4):                                        # 물결
        c.put(x, 35, Db[6] if x % 6 < 3 else Db[5]); c.put(x, 36, Db[5] if x % 6 < 3 else Db[4]); c.put(x, 37, Db[4])
    pw = (W - 8) / cells
    for k in range(1, cells):                                        # 폭 이음(접힌 선)
        c.vl(int(4 + k * pw), 6, 39, Db[3] if k % 2 else Db[1])
    for x0 in (4, W // 2 - 3, W - 10):                               # 받침 발
        c.hl(x0, x0 + 6, 42, Wd[3]); c.hl(x0, x0 + 6, 43, Wd[1])
    outline(c)
    contact(c, 3, W - 3, 44, 2)
    return c


Le_ = RGB['leaf']


# ------------------------------------------------------------------ 향로 · 촛대 · 등
def hyangro():
    """향로 16×32: 청동 세발 향로 — 둥근 몸통(밝은 청동 + 그늘) · 양옆 귀 손잡이 · 도톰한 뚜껑 + 꼭지 · 뚜껑 구멍에서 흰 연기가 한 줄기로 오른다. 받침 석대 위에 선다."""
    c = new(1, 2)
    for y in range(26, 31):                                   # 석대(받침)
        w = 12 if y > 27 else 10
        for x in range(8 - w // 2, 8 + w // 2):
            c.put(x, y, St[5] if x < 8 - w // 4 else (St[4] if x < 8 + w // 4 else St[3]))
    c.hl(3, 13, 31, St[2])
    for (x, y) in ((4, 22), (11, 22)):                        # 세 다리
        for j in range(4): c.put(x, y + j, Pe[3]); c.put(x + 1, y + j, Pe[2])
    c.put(8, 23, Pe[3]); c.put(8, 24, Pe[2])
    ell(c, 8, 19, 6.6, 4.4, lambda x, y, u, v: Pe[5] if (u < -0.3 and v < 0) else (Pe[4] if u < 0.5 else Pe[3]))
    c.put(1, 18, Pe[4]); c.put(1, 19, Pe[3]); c.put(14, 18, Pe[3]); c.put(14, 19, Pe[2])    # 귀 손잡이
    ell(c, 8, 15, 5.0, 3.4, lambda x, y, u, v: Pe[6] if (u < -0.3 and v < -0.2) else (Pe[5] if u < 0.4 else Pe[4]))
    c.hl(3, 13, 17, Pe[2])                                    # 뚜껑 이음
    c.put(7, 11, Pe[5]); c.put(8, 11, Pe[4]); c.put(7, 12, Pe[5]); c.put(8, 12, Pe[3]); c.put(8, 10, Pe[4])   # 꼭지
    for k, (x, y) in enumerate(((11, 14), (12, 12), (11, 10), (12, 8), (11, 6), (12, 4), (11, 2))):          # 연기 한 줄기
        c.put(x, y, Pl[5]); c.put(x + (1 if k % 2 == 0 else -1), y + 1, Pl[4]); c.put(x, y + 1, Pl[3])
    outline(c)
    contact(c, 3, 13, 30, 2)
    return c


def chotdae_tall():
    """큰 촛대 16×32: 황동 받침(둥근 발) + 가는 기둥 + 접시 + 굵은 붉은 초(불꽃 크게). 어좌 양옆에 한 쌍으로 선다."""
    c = new(1, 2)
    for x in range(3, 13):                                  # 받침 발
        c.put(x, 28, Pe[3]); c.put(x, 29, Pe[2])
    for x in range(4, 12):
        c.put(x, 27, Pe[5] if x < 7 else Pe[4])
    for y in range(14, 27):                                 # 기둥(2px)
        c.put(7, y, Pe[5]); c.put(8, y, Pe[3])
    for y in (18, 22):                                      # 마디
        c.hl(6, 10, y, Pe[4]); c.hl(6, 10, y + 1, Pe[2])
    c.hl(4, 12, 13, Pe[5]); c.hl(4, 12, 14, Pe[3])          # 접시
    for y in range(6, 13):                                  # 초
        c.put(7, y, Rd[5]); c.put(8, y, Rd[4]); c.put(9, y, Rd[2])
    flame(c, 8, 4, True); c.put(8, 3, Pe[6])
    c.put(8, 2, Pl[5]); c.put(9, 1, Pl[4])
    outline(c)
    contact(c, 3, 13, 30, 2)
    return c


def deungrong():
    """회랑 등롱 16×32: 돌 받침 + 붉은 기둥 위의 육각 붉은 등(밝은 한지 창) + 금 술. 정면 3/4 라 몸통 폭은 12px."""
    c = new(1, 2)
    for y in range(26, 31):                                 # 돌 받침
        w = 12 if y > 27 else 10
        for x in range(8 - w // 2, 8 + w // 2):
            c.put(x, y, St[5] if x < 8 - w // 4 else (St[4] if x < 8 + w // 4 else St[3]))
    c.hl(3, 13, 31, St[2])
    for y in range(15, 26):                                 # 붉은 기둥
        c.put(7, y, Rd[5]); c.put(8, y, Rd[4]); c.put(9, y, Rd[2])
    c.hl(5, 11, 14, Pe[4]); c.hl(5, 11, 15, Pe[2])
    for y in range(4, 14):                                  # 등 몸통
        for x in range(3, 13):
            f = (x - 3) / 9.0
            c.put(x, y, Rd[5] if f < 0.15 else (Rd[4] if f < 0.65 else (Rd[3] if f < 0.9 else Rd[2])))
    for y in range(6, 12):                                  # 불 밝은 한지 창
        for x in range(5, 11):
            c.put(x, y, Pe[6] if (x < 7 and y < 9) else (Pe[5] if x < 9 else Pe[4]))
    c.vl(7, 6, 12, Rd[3]); c.vl(9, 6, 12, Rd[3])
    c.hl(2, 14, 3, Gi[5]); c.hl(3, 13, 2, Gi[4]); c.hl(5, 11, 1, Gi[5]); c.hl(7, 9, 0, Gi[6])   # 지붕 갓
    c.hl(3, 13, 13, Pe[3])
    outline(c)
    contact(c, 3, 13, 31, 1)
    return c


def deung_hang():
    """매단 등 16×32(걸어 지나는 C): 대들보에서 늘어진 쇠사슬 + 붉은 등 + 금 술. 사람 위에 그려진다."""
    c = new(1, 2)
    for y in range(0, 8):
        c.put(7, y, Gi[4] if y % 2 else Gi[3]); c.put(8, y, Gi[2])
    for y in range(8, 21):
        for x in range(3, 13):
            f = (x - 3) / 9.0
            c.put(x, y, Rd[5] if f < 0.15 else (Rd[4] if f < 0.65 else (Rd[3] if f < 0.9 else Rd[2])))
    for y in range(11, 18):
        for x in range(5, 11):
            c.put(x, y, Pe[6] if (x < 7 and y < 14) else (Pe[5] if x < 9 else Pe[4]))
    c.vl(7, 11, 18, Rd[3]); c.vl(9, 11, 18, Rd[3])
    c.hl(3, 13, 8, Pe[5]); c.hl(3, 13, 9, Pe[3]); c.hl(3, 13, 20, Pe[3])
    c.hl(4, 12, 7, Gi[5]); c.hl(6, 10, 6, Gi[6])
    for y in range(21, 28):                                 # 술
        c.put(7, y, Pe[4]); c.put(8, y, Pe[3])
    c.hl(5, 11, 28, Pe[5]); c.hl(5, 11, 29, Pe[3])
    outline(c)
    return c


# ------------------------------------------------------------------ 방석 · 의자
def bangseok_pal(ramp=None):
    """비단 방석 16×16(걷는 바닥 장식 F): 12×7 두툼한 방석, 가장자리 금실 띠, 가운데 작은 금 점."""
    r = ramp or Rd
    c = new(1, 1)
    for y in range(5, 12):
        for x in range(2, 14):
            e = min(x - 2, 13 - x, y - 5, 11 - y)
            t = 5 if (y == 5 or x == 2) else (4 if e >= 1 else 3)
            c.put(x, y, r[t])
    c.hl(2, 14, 11, r[2])
    for x in range(3, 13):
        c.put(x, 6, Pe[4] if x % 2 else Pe[5])
    c.put(7, 8, Pe[5]); c.put(8, 8, Pe[5]); c.put(7, 9, Pe[3]); c.put(8, 9, Pe[3])
    outline(c)
    contact(c, 3, 13, 12, 2)
    return c


def uija():
    """교의(관리 의자) 16×32: 높은 나무 등받이(푸른 비단 판 + 금 장식) · 앉는 널 · 두 팔걸이."""
    c = new(1, 2)
    for y in range(3, 17):
        for x in range(3, 13):
            c.put(x, y, Db[4] if 5 <= x <= 10 and 5 <= y <= 14 else Wd[4])
    c.hl(2, 14, 2, Wd[6]); c.hl(2, 14, 3, Wd[5]); c.vl(3, 3, 18, Wd[6]); c.vl(12, 3, 18, Wd[2])
    c.vl(5, 5, 15, Db[5]); c.hl(5, 11, 5, Db[5]); c.hl(5, 11, 14, Db[2])
    gold(c, 7, 8, 2, 2)
    block(c, 2, 18, 12, 3, 4, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for y in range(14, 22):
        c.put(1, y, Wd[5]); c.put(14, y, Wd[3])
    for x in (3, 11):
        for y in range(25, 30):
            c.put(x, y, Wd[3]); c.put(x + 1, y, Wd[2])
    outline(c)
    contact(c, 3, 13, 30, 2)
    return c


# ------------------------------------------------------------------ 서안 · 문서함
def seoan_gwan():
    """관리 서안 32×16: 붉은 옻칠 다리의 긴 서안 — 윗면에 펼친 두루마리·벼루·붓통, 앞 상판 가장자리 금 띠."""
    c = new(2, 1)
    for lx in (3, 25):                                      # 안으로 굽은 다리
        for y in range(10, 15):
            c.put(lx, y, Rd[4]); c.put(lx + 1, y, Rd[3]); c.put(lx + 2, y, Rd[2])
    block(c, 1, 3, 30, 6, 3, Wd, top=(6, 5), face=(5, 4, 3, 2))
    c.hl(1, 31, 9, Pe[4]); c.hl(1, 31, 10, Pe[3])
    for x in range(4, 14):                                  # 펼친 두루마리(종이 + 양끝 축)
        c.put(x, 4, Pl[6]); c.put(x, 5, Pl[5]); c.put(x, 6, Pl[4])
    c.vl(3, 3, 7, Wd[3]); c.vl(14, 3, 7, Wd[3])
    c.hl(6, 12, 5, Gi[2]); c.hl(5, 10, 6, Gi[2])           # 글자 줄
    c.hl(17, 21, 5, Gi[1]); c.hl(17, 21, 6, Gi[2])        # 벼루
    for k in range(3):                                      # 붓통 + 붓
        c.vl(25 + k, 2, 6, Wd[(5, 4, 3)[k]])
    c.put(26, 1, Gi[2]); c.put(27, 0, Gi[3])
    outline(c)
    contact(c, 3, 30, 15, 1)
    return c


def munseo_ham():
    """문서함 16×16: 붉은 옻칠 궤 — 놋 자물쇠판과 네 귀 놋 모서리, 위에 두루마리 두 통."""
    c = new(1, 1)
    block(c, 2, 6, 12, 3, 7, Wd, top=(6, 5), face=(5, 4, 3, 2))
    lacquer(c, 2, 9, 14, 14)
    c.hl(2, 14, 9, Pe[4]); c.hl(2, 14, 14, Rd[1])
    brass(c, 7, 10, 2, 3)
    for (x, y) in ((2, 9), (12, 9), (2, 13), (12, 13)):
        gold(c, x, y, 2, 1)
    for k, x in enumerate((3, 8)):                          # 두루마리 통(누운 원통)
        for xx in range(x, x + 5):
            c.put(xx, 3, Pl[6]); c.put(xx, 4, Pl[5]); c.put(xx, 5, Pl[3])
        c.vl(x, 3, 6, Rd[4]); c.vl(x + 4, 3, 6, Rd[3])
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


# ------------------------------------------------------------------ 북 · 종
def buk_big():
    """큰 북(조회 북) 32×32: 두 기둥 틀에 걸린 붉은 큰 북 — 가죽 면(밝음) + 붉은 테 + 금 징 둘레, 아래 받침, 북채 둘."""
    c = new(2, 2)
    for x0 in (2, 26):                                      # 틀 기둥
        for y in range(8, 29):
            for k in range(3):
                c.put(x0 + k, y, Wd[(5, 4, 2)[k]] if x0 == 2 else Wd[(4, 3, 1)[k]])
    c.hl(1, 6, 7, Wd[6]); c.hl(25, 30, 7, Wd[5])
    for y in range(26, 30):                                 # 받침 널
        for x in range(1, 31):
            c.put(x, y, Wd[5] if y == 26 else (Wd[3] if y < 29 else Wd[1]))
    ell(c, 16, 16, 12, 11, lambda x, y, u, v: Rd[3] if (u * u + v * v) > 0.70 else (Rd[4] if u < 0 else Rd[2]))
    ell(c, 16, 16, 9.6, 8.6, lambda x, y, u, v: Pl[6] if (u < -0.25 and v < -0.25) else (Pl[5] if u < 0.35 else Pl[4]))
    for a in range(0, 360, 24):                             # 금 징
        r = math.radians(a)
        gold(c, int(round(16 + 10.6 * math.cos(r))), int(round(16 + 9.6 * math.sin(r))), 1, 1)
    for (x, y) in ((16, 15), (15, 16), (17, 16), (16, 17), (16, 16)):   # 태극 점
        c.put(x, y, Rd[4] if (x + y) % 2 else Db[4])
    c.vl(5, 4, 9, Wd[6]); c.put(4, 3, Wd[5]); c.vl(28, 5, 10, Wd[3])    # 북채
    outline(c)
    contact(c, 3, 29, 30, 2)
    return c


def jong():
    """종(범종) 32×32: 붉은 틀 두 기둥 대들보에 걸린 청동 종 — 둥근 어깨 · 곧은 몸 · 입이 살짝 퍼진 모양, 띠 두 줄, 몸의 젖꼭지 무늬."""
    c = new(2, 2)
    for x0 in (2, 26):
        for y in range(6, 29):
            for k in range(3):
                c.put(x0 + k, y, Rd[(5, 4, 2)[k]] if x0 == 2 else Rd[(4, 3, 1)[k]])
    for x in range(1, 31):                                  # 대들보
        c.put(x, 4, Pe[5]); c.put(x, 5, Rd[5]); c.put(x, 6, Rd[4]); c.put(x, 7, Rd[2]); c.put(x, 8, Rd[1])
    for y in range(26, 30):
        for x in range(1, 31):
            c.put(x, y, Wd[5] if y == 26 else (Wd[3] if y < 29 else Wd[1]))
    for y in range(10, 26):                                 # 종 몸통(둥근 어깨 → 곧은 몸 → 퍼진 입)
        hw = (3, 5, 6, 7, 7, 8, 8, 8, 8, 9, 9, 9, 9, 10, 10, 11)[y - 10]
        for x in range(16 - hw, 16 + hw + 1):
            f = (x - (16 - hw)) / max(1.0, 2.0 * hw)
            c.put(x, y, Pe[6] if f < 0.12 else (Pe[5] if f < 0.38 else (Pe[4] if f < 0.7 else (Pe[3] if f < 0.9 else Pe[2]))))
    for y in (14, 22):                                      # 띠(어두운 청동) 두 줄
        for x in range(5, 28):
            if c.a[y, x, 3] == 255: c.put(x, y, Pe[2]); c.put(x, y + 1, Pe[3]) if c.a[y + 1, x, 3] == 255 and False else None
    for (x, y) in ((12, 17), (15, 17), (18, 17), (12, 19), (15, 19), (18, 19)):        # 젖꼭지 무늬
        c.put(x, y, Pe[5]); c.put(x + 1, y, Pe[3])
    c.put(15, 9, Pe[5]); c.put(16, 9, Pe[4]); c.put(15, 8, Pe[4]); c.put(16, 8, Pe[3])  # 고리
    outline(c)
    contact(c, 3, 29, 30, 2)
    return c


# ------------------------------------------------------------------ 침전
def chimsang():
    """침전 침상(금침) 48×32: 낮은 붉은 옻칠 평상 위에 금빛 비단 이불을 펴고, 왼쪽에 푸른 베개 둘. 앞면은 옻칠 널 + 금 띠."""
    c = new(3, 2)
    block(c, 1, 5, 46, 16, 8, Wd, top=(6, 5), face=(5, 4, 3, 2))
    lacquer(c, 1, 21, 47, 28)
    c.hl(1, 47, 21, Pe[5]); c.hl(1, 47, 22, Pe[4]); c.hl(1, 47, 27, Pe[2])
    for x in range(4, 46, 8):
        gold(c, x, 24, 2, 1)
    for y in range(6, 20):                                  # 금침(이불): 금빛 바탕 + 붉은 능문
        for x in range(2, 46):
            q = rnd(x, y, 142)
            diag = ((x + y) % 8 == 0) or ((x - y) % 8 == 0)
            c.put(x, y, Rd[4] if (diag and x > 15) else (Pe[5] if y < 8 else (Pe[4] if q > 0.1 else Pe[3])))
    c.hl(2, 46, 6, Pe[6]); c.vl(2, 6, 20, Pe[6])
    c.hl(2, 46, 19, Pe[2]); c.hl(14, 46, 18, Rd[3])         # 이불 아랫단 + 붉은 안감
    for k, y0 in enumerate((6, 12)):                        # 푸른 베개(둥근 통)
        for y in range(y0, y0 + 5):
            for x in range(3, 14):
                c.put(x, y, Db[6] if y == y0 else (Db[5] if y < y0 + 3 else Db[4]))
        c.vl(3, y0, y0 + 5, Pe[4]); c.vl(13, y0, y0 + 5, Pe[3])
    outline(c)
    contact(c, 3, 46, 30, 2)
    return c


def jangnong():
    """장롱 32×48: 붉은 옻칠 이층 농 — 위 두 짝 여닫이(금 문양 판 · 놋 자물쇠판) + 아래 서랍 둘, 네 귀 금 장식과 짧은 발."""
    c = new(2, 3)
    block(c, 1, 6, 30, 5, 34, Wd, top=(6, 5), face=(5, 4, 3, 2))
    lacquer(c, 1, 11, 31, 42)
    c.hl(1, 31, 11, Pe[5]); c.hl(1, 31, 41, Rd[1])
    for x0 in (3, 17):                                      # 문짝(들어간 판 + 금 테)
        for y in range(14, 30):
            for x in range(x0, x0 + 12):
                c.put(x, y, Rd[5] if (x == x0 or y == 14) else (Rd[2] if (x == x0 + 11 or y == 29) else Rd[4]))
        for (x, y) in ((x0 + 3, 17), (x0 + 7, 17), (x0 + 5, 21), (x0 + 3, 25), (x0 + 7, 25)):
            gold(c, x, y, 2, 2)
    brass(c, 14, 20, 2, 4); brass(c, 17, 20, 2, 4)
    for x0 in (3, 17):                                      # 서랍
        for y in range(32, 40):
            for x in range(x0, x0 + 12):
                c.put(x, y, Rd[5] if (x == x0 or y == 32) else (Rd[2] if (x == x0 + 11 or y == 39) else Rd[4]))
        brass(c, x0 + 5, 35, 2, 2)
    for (x, y) in ((1, 11), (29, 11), (1, 38), (29, 38)):
        gold(c, x, y, 2, 3)
    for x in (3, 26):
        for y in range(42, 46):
            c.put(x, y, Wd[3]); c.put(x + 1, y, Wd[2]); c.put(x + 2, y, Wd[1])
    outline(c)
    contact(c, 3, 29, 46, 2)
    return c


def hwajangdae():
    """화장대 32×32: 낮은 나무 상(서랍 둘 + 놋 손잡이) 위에 둥근 청동 거울을 세운 거울걸이, 곁에 연지 합 둘."""
    c = new(2, 2)
    for y in range(9, 18):                                  # 거울 받침 기둥
        c.put(15, y, Wd[3]); c.put(16, y, Wd[2])
    c.hl(11, 21, 17, Wd[4])
    ell(c, 16, 7, 7.6, 7.0, lambda x, y, u, v: Pe[4] if (u * u + v * v) > 0.78 else (Pl[6] if (u < -0.2 and v < -0.2) else (Pl[5] if u < 0.3 else Pl[4])))
    c.put(11, 5, Pl[6]); c.put(12, 4, Pl[6])
    block(c, 2, 14, 28, 5, 12, Wd, top=(6, 5), face=(5, 4, 3, 2))
    lacquer(c, 2, 19, 30, 28)
    for x0 in (4, 17):
        frame(c, x0, 20, 11, 7, Rd, fill=Rd[4], hl=5, sh=2)
        brass(c, x0 + 4, 22, 2, 2)
    for k, x in enumerate((4, 24)):                          # 연지 합
        for y in range(11, 14):
            for xx in range(x, x + 4):
                c.put(xx, y, (Pl[5], Rd[4], Db[4])[k] if k < 2 else Pl[5])
        c.hl(x, x + 4, 10, Pl[6])
    c.hl(2, 30, 28, Rd[1]); c.hl(2, 30, 29, Wd[1])
    outline(c)
    contact(c, 3, 29, 30, 1)
    return c


def gyeongdae():
    """경대 16×16: 서랍 달린 작은 목함 위에 거울판을 비스듬히 세운 것 — 거울(밝은 은빛)과 금 테."""
    c = new(1, 1)
    block(c, 2, 8, 12, 3, 5, Wd, top=(6, 5), face=(5, 4, 3, 2))
    frame(c, 4, 11, 8, 3, Wd, fill=Wd[5], hl=6, sh=2)
    brass(c, 7, 12, 2, 1)
    for y in range(1, 8):
        for x in range(4, 12):
            c.put(x, y, Pl[6] if (x < 7 and y < 4) else (Pl[5] if x < 10 else Pl[4]))
    for x in range(3, 13): c.put(x, 0, Pe[5]); c.put(x, 8, Pe[3]) if False else None
    c.hl(3, 13, 0, Pe[5]); c.vl(3, 0, 8, Pe[5]); c.vl(12, 0, 8, Pe[3])
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


# ------------------------------------------------------------------ 수라상 · 약탕
def surasang():
    """수라상 32×16: 붉은 옻칠 둥근 다리 소반 위에 반상 — 가운데 뚜껑 덮은 밥·국, 둘레에 작은 반찬 접시 여섯, 놋그릇 반짝임."""
    c = new(2, 1)
    for lx in (4, 25):
        for y in range(11, 15):
            c.put(lx, y, Rd[3]); c.put(lx + 1, y, Rd[2]); c.put(lx + 2, y, Rd[1])
    block(c, 1, 4, 30, 6, 4, Rd, top=(6, 5), face=(5, 4, 3, 2))
    c.hl(1, 31, 9, Pe[4]); c.hl(1, 31, 10, Pe[3])
    for (x, y, col) in ((4, 4, Pl), (10, 5, Pe), (16, 4, Pl), (22, 5, Dg), (27, 4, Pl)):
        bowl(c, x, y - 3, col, soup=(col is Pe), rice=(col is Pl and x == 16))
    for (x, y) in ((5, 8), (12, 8), (19, 8), (25, 8)):      # 작은 반찬 접시
        c.hl(x, x + 4, y, Pl[5]); c.hl(x, x + 4, y - 1, Gi[5]) if False else None
        c.put(x + 1, y - 1, Rd[5]); c.put(x + 2, y - 1, Dg[5]); c.put(x + 3, y - 1, Pe[5])
    outline(c)
    contact(c, 3, 30, 15, 1)
    return c


def yaktang():
    """약탕 16×16: 작은 숯 화로 위의 약탕관(질그릇, 주둥이 + 손잡이) — 화로 불구멍의 붉은 숯과 뚜껑 틈의 김."""
    c = new(1, 1)
    block(c, 2, 9, 12, 2, 4, Gi, top=(5, 4), face=(4, 3, 2, 1))
    for x in range(5, 11): c.put(x, 11, Rd[5] if x % 2 else Pe[4])
    ell(c, 8, 6, 5.4, 4.6, lambda x, y, u, v: Ea[6] if (u < -0.35 and v < -0.1) else (Ea[5] if u < 0.2 else Ea[4]))
    c.hl(4, 12, 4, Ea[3]); c.put(8, 1, Ea[2]); c.put(7, 2, Ea[5]); c.put(9, 2, Ea[3])    # 뚜껑 + 꼭지
    for (x, y) in ((13, 5), (14, 5), (14, 6)): c.put(x, y, Ea[4])                         # 주둥이
    for (x, y) in ((1, 4), (2, 4), (1, 5), (2, 5), (2, 6), (1, 6)): c.put(x, y, Wd[3])      # 손잡이
    c.put(9, 0, Pl[5]); c.put(10, 0, Pl[4]); c.put(9, 1, Pl[4]); c.put(10, 1, Pl[3])           # 뚜껑 틈 김(2px)
    outline(c)
    contact(c, 3, 13, 14, 2)
    return c


# ------------------------------------------------------------------ 서고
def seoga_tall():
    """서고 서가 32×48: 붉은 갈색 틀 네 칸 — 칸마다 색 천으로 싼 책갑(청·백·적·녹)이 세로로 꽂혀 있고 칸 사이 널 윗면이 밝다."""
    c = new(2, 3)
    block(c, 1, 2, 30, 6, 40, Wd, top=(6, 5), face=(5, 4, 3, 2))
    for y in range(8, 44):
        for x in range(3, 29):
            c.put(x, y, Wd[1] if x > 21 else Wd[2])
    cols = (Db, Pl, Rd, Dg)
    for k, yb in enumerate((9, 19, 29, 39)):
        x, i = 4, 0
        while x < 27:
            ramp = cols[(i + k) % 4]
            wdt = 3 if (i + k) % 3 else 4
            for xx in range(x, min(27, x + wdt)):
                for y in range(yb, yb + 8):
                    c.put(xx, y, ramp[5 if xx == x else (4 if xx < x + wdt - 1 else 3)] if ramp is not Pl else Pl[(5, 4, 3)[0 if xx == x else (1 if xx < x + wdt - 1 else 2)]])
                c.put(xx, yb + 1, Pe[4]) if xx == x + 1 else None
            x += wdt + 0
            i += 1
        c.hl(3, 29, yb + 8, Wd[6]); c.hl(3, 29, yb + 9, Wd[3]) if yb < 39 else None
    outline(c)
    contact(c, 3, 29, 47, 1)
    return c


def chaekgap():
    """책갑 더미 16×16: 비단 책갑 네 개를 가로로 쌓은 것 — 청·백·적, 위 한 켜에 금 매듭 끈."""
    c = new(1, 1)
    for k, (ramp, y0, x0, w) in enumerate(((Db, 9, 2, 12), (Pl, 6, 3, 11), (Rd, 3, 3, 10))):
        for y in range(y0, y0 + 4):
            for x in range(x0, x0 + w):
                t = 6 if y == y0 else (5 if x < x0 + 3 else (4 if y < y0 + 3 else 3))
                c.put(x, y, ramp[t] if ramp is not Pl else Pl[min(6, t)])
        c.vl(x0 + 2, y0, y0 + 4, Pe[4]); c.vl(x0 + 3, y0, y0 + 4, Pe[3])
    outline(c)
    contact(c, 3, 14, 13, 2)
    return c


# ------------------------------------------------------------------ 자리
def gwan_seat():
    """관리 자리 32×16: 낮은 붉은 서안(두루마리 한 통, 벼루) 곁에 푸른 방석 — 서안 왼쪽 · 방석 오른쪽을 한 덩어리로."""
    c = new(2, 1)
    for lx in (3, 14):
        for y in range(10, 15):
            c.put(lx, y, Rd[4]); c.put(lx + 1, y, Rd[3]); c.put(lx + 2, y, Rd[2])
    block(c, 1, 4, 17, 5, 3, Wd, top=(6, 5), face=(5, 4, 3, 2))
    c.hl(1, 18, 9, Pe[4]); c.hl(1, 18, 10, Pe[3])
    for x in range(3, 11): c.put(x, 3, Pl[6]); c.put(x, 4, Pl[5])
    c.hl(12, 16, 4, Gi[1])
    for y in range(7, 14):                                  # 푸른 방석
        for x in range(20, 31):
            e = min(x - 20, 30 - x, y - 7, 13 - y)
            c.put(x, y, Db[6] if (y == 7 or x == 20) else (Db[4] if e >= 1 else Db[3]))
    c.hl(20, 31, 14, Db[2])
    for x in range(21, 30): c.put(x, 8, Pe[4] if x % 2 else Pe[5])
    outline(c)
    contact(c, 3, 30, 15, 1)
    return c


def gungnyeo_jari():
    """궁녀 자리 16×16(걷는 바닥 장식 F): 쟁반(찻주전자·찻잔) 곁에 붉은 방석. 어좌전 곁 시중드는 자리."""
    c = new(1, 1)
    for x in range(1, 8):                                   # 쟁반
        c.put(x, 10, Wd[6]); c.put(x, 11, Wd[4]); c.put(x, 12, Wd[2])
    ell(c, 3, 8, 2.4, 2.0, lambda x, y, u, v: Pl[5] if u < 0 else Pl[4])
    c.put(5, 5, Pl[5]); c.put(5, 6, Pl[4]); c.put(6, 6, Pl[4])                          # 주전자 주둥이
    c.put(6, 8, Pl[6]); c.put(7, 8, Pl[4]); c.put(6, 9, Pl[4]); c.put(7, 9, Pl[3])      # 찻잔
    for y in range(8, 14):                                  # 붉은 방석
        for x in range(8, 16):
            e = min(x - 8, 15 - x, y - 8, 13 - y)
            c.put(x, y, Rd[6] if (y == 8 or x == 8) else (Rd[4] if e >= 1 else Rd[3]))
    c.hl(8, 16, 14, Rd[2])
    c.put(11, 10, Pe[5]); c.put(12, 10, Pe[5]); c.put(11, 11, Pe[3]); c.put(12, 11, Pe[3])
    outline(c)
    contact(c, 3, 15, 14, 2)
    return c


def changgeori():
    """호위 창 거치대 32×32: 두 단 나무 받침틀에 창 넷을 세워 둔 것 — 굵은 창대(2px) + 위 끝에 뾰족한 은빛 창날(3px 폭 마름모)과 붉은 술."""
    c = new(2, 2)
    for k, x in enumerate((6, 12, 18, 24)):
        for y in range(9, 24):                              # 창대
            c.put(x, y, Wd[5]); c.put(x + 1, y, Wd[3])
        for (j, w) in ((0, 1), (1, 2), (2, 3), (3, 3), (4, 2), (5, 1)):    # 창날: 위로 뾰족한 마름모(폭 w px, x..x+1 중심)
            x0 = x + 1 - w // 2 - (1 if w % 2 == 0 else 0) + (0 if w % 2 else 1) - 1 + (1 if w == 1 else 0)
            for xx in range(x + 1 - (w - 1) // 2 - (w % 2 == 0), x + 1 + w // 2 + 1 - (w % 2 == 0)):
                c.put(xx, 1 + j, Gi[6] if xx <= x else Gi[5])
        c.put(x, 7, Gi[3]); c.put(x + 1, 7, Gi[2]); c.put(x, 8, Gi[3]); c.put(x + 1, 8, Gi[2])           # 창날 목
        c.put(x - 1, 9, Rd[5]); c.put(x, 9, Rd[4]); c.put(x + 1, 9, Rd[4]); c.put(x + 2, 9, Rd[3])       # 붉은 술
        c.put(x, 10, Rd[4]); c.put(x + 1, 10, Rd[3]); c.put(x, 11, Rd[3])
    block(c, 2, 20, 28, 3, 7, Wd, top=(6, 5), face=(5, 4, 3, 2))
    frame(c, 3, 24, 26, 5, Wd, fill=Wd[4], hl=6, sh=2)
    gold(c, 14, 25, 3, 2)
    outline(c)
    contact(c, 3, 29, 30, 2)
    return c


def objects():
    d = {}
    d['pal_throne'] = throne()
    d['pal_byeongpung_ilwol'] = byeongpung_ilwol()
    d['pal_hyangro'] = hyangro()
    d['pal_chotdae_tall'] = chotdae_tall()
    d['pal_deungrong'] = deungrong()
    d['pal_deung_hang'] = deung_hang()
    d['pal_bangseok_red'] = bangseok_pal(Rd)
    d['pal_bangseok_blue'] = bangseok_pal(Db)
    d['pal_uija'] = uija()
    d['pal_seoan_gwan'] = seoan_gwan()
    d['pal_munseo_ham'] = munseo_ham()
    d['pal_buk_big'] = buk_big()
    d['pal_jong'] = jong()
    d['pal_chimsang'] = chimsang()
    d['pal_jangnong'] = jangnong()
    d['pal_hwajangdae'] = hwajangdae()
    d['pal_gyeongdae'] = gyeongdae()
    d['pal_surasang'] = surasang()
    d['pal_yaktang'] = yaktang()
    d['pal_seoga_tall'] = seoga_tall()
    d['pal_chaekgap'] = chaekgap()
    d['pal_gwan_seat'] = gwan_seat()
    d['pal_gungnyeo_jari'] = gungnyeo_jari()
    d['pal_changgeori'] = changgeori()
    return d


if __name__ == '__main__':
    o = objects()
    print(len(o), 'violations', len(VIOLATIONS))
