# 마을 이벤트 소품: 길 표지판, 게시판, 여관 간판, 가게 간판, 수호 석상.
# 글자 없음 — 그림 기호만(말·검·침대·약병). 버들항 pz.bracket_sign·statue_sage 와 같은 짜임(나무 판 + 쇠 걸이, 마름돌 받침).
import math
from ev_base import *
from ev_base import _hash

# 그림 기호(문자 = 재질·톤). 3/4 정면 판에 찍는다.
ICON = {
    'horse': ([".......oo", "......ooo", "o.oooooo.", ".ooooooo.", ".o.o..o.o", ".o.o..o.o"],
              {'o': ('cream', 5)}),
    'bed':   (["c.......", "c.......", "cww.....", "cwwrrrrr", "crrrrrrc", "cccccccc", "c......c"],
              {'c': ('cream', 5), 'w': ('cream', 6), 'r': ('rug', 4)}),
    'potion': (["..cc..", "..cc..", ".rrrr.", "rRrrrr", "rRrrrr", "rrrrrr", ".rrrr."],
               {'c': ('cream', 5), 'r': ('rug', 4), 'R': ('rug', 6)}),
    'sword': (["..s..", "..S..", "..S..", "..S..", "ggggg", "..w..", "..g.."], {'s': ('iron', 6), 'S': ('iron', 4), 'g': ('gilt', 3), 'w': ('wood', 2)}),
}


def _board(c, x0, y0, w, h, mat='wood'):
    """나무 판(앞면): 테두리 위·왼쪽 빛, 아래·오른쪽 그늘, 세로 결 몇 줄."""
    c.new()
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            t = 4
            if y == y0 or x == x0: t = 5
            elif y == y0 + h - 1 or x == x0 + w - 1: t = 2
            elif (x - x0) % 5 == 3 and _hash(x, y, 3) < .7: t = 3
            c.tone(x, y, mat, t)


def sign_post():
    """길 표지판(1x2): 나무 기둥에 화살 판 둘(왼쪽·오른쪽을 가리킴), 위 판에 말 그림(마구간·역참 길). 밑동 1칸 막힘."""
    c = C(16, 32, seed=4101)
    c.shadow(8, 30.6, 5, 1.3, 90)
    c.group(1); c.new()
    for y in range(4, 31): c.tone(7, y, 'wood', 4); c.tone(8, y, 'wood', 2)
    c.tone(7, 3, 'wood', 5); c.tone(8, 3, 'wood', 3)
    c.group(2); c.new()                                               # 위 판: 오른쪽 화살
    for y in range(5, 12):
        for x in range(1, 15):
            tip = 15 - abs(y - 8)
            if x > tip - 1: continue
            c.tone(x, y, 'wood', 5 if (y == 5 or x == 1) else (2 if y == 11 else 4))
    c.group(3); c.new()                                               # 아래 판: 왼쪽 화살
    for y in range(14, 19):
        for x in range(1, 15):
            tip = abs(y - 16)
            if x < tip + 1: continue
            c.tone(x, y, 'wood', 5 if (y == 14) else (2 if y == 18 or x == 14 else 3))
    c.group(4); c.new()
    rows, key = ICON['horse']; c.lit(rows, 2, 6, key)
    for x in range(5, 12, 3): c.tone(x, 16, 'wood', 1)                # 아래 판 홈(줄 무늬, 글자 아님)
    return F(c)


def notice_board():
    """게시판(2x2): 두 기둥 + 널 지붕 + 테 두른 판에 꽂은 종이 넷(그림만: 검 현상 그림·지도 그림·물방울·빈 쪽지)."""
    W, H = 32, 32
    c = C(W, H, seed=4201)
    c.shadow(16, 30.6, 14, 1.5, 90)
    c.group(1); c.new()
    for x0 in (3, 27):
        for y in range(6, 31): c.tone(x0, y, 'wood', 4); c.tone(x0 + 1, y, 'wood', 2)
    c.group(2); c.new()                                               # 널 지붕(윗면 + 처마)
    for y in range(1, 6):
        for x in range(1, 31):
            if y == 1 and x in (1, 30): continue
            k = (5, 4, 5, 3, 2)[y - 1] - (1 if x > 24 else 0)
            if y in (2, 4) and (x + (y // 2)) % 3 == 0: k -= 1          # 기와 이음(줄마다 엇갈림)
            c.tone(x, y, 'cloth', max(1, k))
    c.group(3); _board(c, 4, 7, 24, 18)
    c.new()
    for y in range(9, 23):                                            # 판 속(코르크 같은 어두운 바탕)
        for x in range(6, 26): c.tone(x, y, 'wood', 3 if _hash(x, y, 9) > .15 else 2)
    c.group(4)
    papers = [(7, 9, 7, 8), (15, 10, 9, 6), (8, 18, 6, 4), (17, 17, 7, 5)]
    for (x0, y0, w, h) in papers:
        c.new()
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w): c.tone(x, y, 'cream', 6 if (y == y0 or x == x0) else 5)
        for x in range(x0, x0 + w): c.tone(x, y0 + h, 'wood', 1)      # 종이 그늘
        c.tone(x0 + w // 2, y0, 'rug', 4)                             # 압정
    c.group(5); c.new()
    rows, key = ICON['sword']; c.lit(rows, 8, 10, key)                # 현상 그림(검)
    for (x, y) in ((16, 12), (17, 13), (18, 13), (19, 12), (20, 13), (21, 14), (22, 13)): c.tone(x, y, 'dark', 2)  # 지도 길
    c.tone(19, 14, 'rug', 4); c.tone(17, 11, 'leaf', 3); c.tone(22, 11, 'leaf', 3)
    for (x, y, t) in ((10, 19, 5), (10, 20, 4), (9, 20, 4), (11, 20, 3), (10, 21, 3)): c.tone(x, y, 'heal', t)  # 물방울
    c.new()
    for x in range(4, 28): c.tone(x, 25, 'wood', 2)
    return F(c)


def hanging_sign(icon='bed', seed=4301):
    """세워 둔 걸이 간판(1x2): 나무 기둥 + 쇠 팔 + 사슬 둘에 매단 12x12 판, 판에 밝은 그림 기호(침대 = 여관, 약병 = 가게).
    버들항 걸이 간판(pz.bracket_sign)과 같은 판 크기·테 명암·밝은 기호."""
    c = C(16, 32, seed=seed)
    c.shadow(2.5, 30.6, 2.6, 1.1, 90)
    c.group(1); c.new()
    for y in range(2, 31): c.tone(1, y, 'wood', 4); c.tone(2, y, 'wood', 2)
    c.tone(1, 1, 'wood', 5); c.tone(2, 1, 'wood', 3)
    c.group(2); c.new()
    for x in range(1, 15): c.tone(x, 3, 'iron', 4 if x < 9 else 3)    # 쇠 팔
    c.line(3, 7, 6, 4, 'iron', 3)                                     # 받침 버팀
    c.tone(14, 2, 'iron', 4)
    c.group(3); c.new()
    for x in (5, 13):
        c.tone(x, 4, 'iron', 4); c.tone(x, 5, 'iron', 2)              # 사슬
    c.group(4); c.box(3, 6, 12, 1, 12, 'wood', front=0.55)
    for y in range(7, 19): c.tone(3, y, 'wood', 4); c.tone(14, y, 'wood', 1)
    for x in range(3, 15): c.tone(x, 6, 'wood', 5); c.tone(x, 18, 'wood', 1)
    c.group(5); c.new()
    rows, key = ICON[icon]; w = max(len(r) for r in rows); h = len(rows)
    c.lit(rows, 9 - w // 2, 12 - h // 2, key)
    return F(c)


def statue_guard():
    """수호 석상(1x2): 마름돌 받침 위 투구·갑옷 기사상 — 앞에 세운 큰 방패(가운데 금 문장 마름모), 오른손 창(창날만 금빛).
    얼굴은 투구 면갑 속 그늘(눈·입 없음). 버들항 현자 석상과 같은 돌 결(왼쪽 빛 5 · 가운데 4 · 오른쪽 2)."""
    c = C(16, 32, seed=4401)
    c.shadow(8, 30.6, 7, 1.5, 90)
    c.group(1); c.box(1, 24, 14, 3, 5, 'stone', front=0.58)
    c.new()
    for x in range(1, 15): c.tone(x, 27, 'stone', 5); None
    c.group(2); c.new()
    def body_w(y):
        if y < 6: return 2.2 + (y - 2) * .45                          # 투구
        if y < 8: return 2.4                                          # 목
        if y < 12: return 4.6                                         # 어깨
        return 4.0 - (y - 12) * .05
    for y in range(2, 25):
        w = body_w(y)
        for x in range(int(7.5 - w), int(7.5 + w) + 1):
            u = (x + .5 - 7.5) / max(1, w)
            t = 5 if u < -.35 else (4 if u < .3 else 2)
            if y in (8, 9) and abs(u) < .5: t = 3                     # 목 그늘
            c.tone(x, y, 'stone', t)
    c.new()
    for x in range(6, 10): c.tone(x, 4, 'stone', 1); c.tone(x, 5, 'stone', 2)   # 면갑 틈(그늘)
    c.tone(7, 1, 'stone', 5); c.tone(8, 1, 'stone', 4); c.tone(7, 0, 'stone', 4)   # 투구 볏
    c.group(3); c.new()                                               # 방패(앞, 아래가 뾰족)
    for y in range(11, 22):
        hw = 4 if y < 18 else 4 - (y - 17)
        for x in range(int(6.5 - hw), int(6.5 + hw) + 1):
            u = x - 6.5
            c.tone(x, y, 'stone', 5 if (u < -1.5 or y == 11) else (3 if u > 2 else 4))
    for (x, y, t) in ((6, 14, 5), (7, 14, 4), (5, 15, 5), (6, 15, 6), (7, 15, 4), (8, 15, 3), (6, 16, 4), (7, 16, 3), (6, 17, 3)):
        c.tone(x, y, 'gilt', t)
    c.group(4); c.new()                                               # 창(오른쪽, 받침까지)
    for y in range(3, 25): c.tone(13, y, 'stone', 3); c.tone(14, y, 'stone', 2)
    for (x, y, t) in ((13, 0, 6), (13, 1, 5), (14, 1, 4), (13, 2, 4), (14, 2, 3), (12, 2, 5)): c.tone(x, y, 'gilt', t)
    for y in range(9, 12): c.tone(12, y, 'stone', 4)                  # 창 쥔 손
    return F(c)
