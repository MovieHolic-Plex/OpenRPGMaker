# 장치 이벤트 소품: 보물상자 셋(닫힘/열림), 돌 레버, 바닥 스위치, 문 셋(철·나무·봉인), 열차 신호기, 착륙장, 밀 수 있는 돌덩이.
# 버들항 px2.C(재질 + 톤 + 자동 색 윤곽) + pz.fin. 기계 재질(강철·경고 도장)은 future-ruins plan.md 「기계 재질 규약」대로
# (판 줄눈 아래·오른쪽 톤 1, 위·왼쪽 +1, 리벳 = 톤 6 점 + 오른쪽 아래 톤 1 점, 경고 띠 사선 폭 4px).
import math
from ev_base import *


# ---------------------------------------------------------------- 7·8·9 보물상자
CHEST = {
    'wood': dict(body='wood', band='iron', lock='gilt', lid_b=0.0),
    'iron': dict(body='steel', band='steel', lock='gilt', lid_b=0.04),
    'gold': dict(body='gilt', band='rug', lock='azure', lid_b=-0.04),
}


def chest(kind='wood', opened=False):
    """보물상자(1x1, 3/4): 둥근 뚜껑 윗면 + 몸통 앞면, 세로 띠 둘, 가운데 자물쇠. 열림 = 뚜껑이 뒤로 젖혀 안쪽 면이 보이고
    상자 속 어둠 위로 보물 반짝임."""
    K = CHEST[kind]; b, bd, lk = K['body'], K['band'], K['lock']
    c = C(16, 16, seed=2100 + len(kind) * 7 + opened)
    c.shadow(8, 14.6, 7, 1.3, 80)
    if not opened:
        c.group(1); c.new()
        for y in range(3, 8):                                     # 둥근 뚜껑(위로 갈수록 밝고, 왼쪽 빛)
            for x in range(2, 14):
                t = (6, 5, 5, 4, 4)[y - 3] - (1 if x >= 12 else 0) + (0 if x > 2 else 0)
                if y == 3 and x in (2, 13): continue               # 모서리 둥글게
                c.tone(x, y, b, max(1, t))
        c.box(2, 8, 12, 0, 6, b, front=0.56, bias=K['lid_b'])      # 몸통 앞면
        c.new()
        for x in range(2, 14): c.tone(x, 8, b, 1)                 # 뚜껑 이음
        for x in range(2, 14): c.tone(x, 13, b, 2)
        c.group(2); c.new()
        for x0 in (4, 11):                                        # 세로 띠(뚜껑 위로 이어진다)
            for y in range(3, 14):
                if y == 3 and x0 == 11: continue
                t = 4 if y < 8 else 3
                if y == 8: t = 1
                c.tone(x0, y, bd, t + (1 if x0 == 4 else 0));
        c.group(3); c.new()
        for (x, y, t) in ((7, 7, 5), (8, 7, 4), (7, 8, 5), (8, 8, 3), (7, 9, 4), (8, 9, 3), (7, 10, 3), (8, 10, 2)):
            c.tone(x, y, lk, t)
        c.tone(7, 9, 'dark', 1) if kind != 'gold' else c.tone(7, 9, lk, 6)
        if kind == 'iron':                                        # 리벳(톤 6 점 + 오른쪽 아래 톤 1)
            for (x, y) in ((3, 10), (12, 10), (3, 12), (12, 12)): c.tone(x, y, 'steel', 6); c.tone(x + 1, y + 1, 'steel', 1) if x < 12 else None
        if kind == 'gold':                                        # 금상자 뚜껑 보석 둘
            for (x, y) in ((5, 5), (10, 5)): c.tone(x, y, 'azure', 5); c.tone(x + 1, y, 'azure', 3)
    else:
        c.group(1); c.new()
        for y in range(0, 5):                                     # 젖혀진 뚜껑 안쪽(앞에서 보이는 안쪽 면, 어둡다)
            for x in range(2, 14):
                if y == 0 and x in (2, 13): continue
                c.tone(x, y, b, (3, 3, 2, 2, 2)[y] - (1 if x >= 12 else 0))
        for x in (4, 11):
            for y in range(0, 5): c.tone(x, y, bd, 3)
        c.group(2); c.new()
        for y in range(5, 8):                                     # 상자 테두리 윗면(두께) + 속
            for x in range(2, 14):
                edge = x in (2, 13) or y == 5
                c.tone(x, y, b, 5 if edge and x < 12 else (4 if edge else 1))
        c.box(2, 8, 12, 0, 6, b, front=0.56, bias=K['lid_b'])
        c.new()
        for x in range(2, 14): c.tone(x, 13, b, 2)
        for x0 in (4, 11):
            for y in range(8, 14): c.tone(x0, y, bd, 3 + (1 if x0 == 4 else 0))
        c.new()
        for (x, y, t) in ((7, 8, 4), (8, 8, 3), (7, 9, 3), (8, 9, 2)): c.tone(x, y, lk, t)
        c.group(3); c.new()                                       # 상자 속 보물(금화 더미 + 반짝임)
        for (x, y, t) in ((5, 6, 5), (6, 6, 4), (7, 7, 5), (8, 6, 6), (9, 7, 4), (10, 6, 5), (6, 7, 3), (9, 6, 5)):
            c.tone(x, y, 'gilt', t)
        if kind == 'iron':
            for (x, y) in ((3, 10), (3, 12)): c.tone(x, y, 'steel', 6)
    im = F(c)
    if opened:
        px = im.load()
        for (x, y) in ((8, 5), (7, 4), (9, 4), (8, 3)): put(px, 16, 16, x, y, rgb('gilt', 6))   # 보물 반짝 십자
    return im


# ---------------------------------------------------------------- 10 돌 레버
def lever(on=False):
    """돌 레버(1x1): 마름돌 받침 윗면 홈에서 쇠 막대 + 붉은 손잡이. 끔 = 왼쪽으로 젖힘 + 앞면 등 꺼짐, 켬 = 오른쪽 + 초록 등."""
    c = C(16, 16, seed=2200 + on)
    c.shadow(8, 14.6, 6.5, 1.3, 80)
    c.group(1); c.box(3, 8, 10, 2, 5, 'stone', top=0.92, front=0.56)
    c.new()
    for x in range(3, 13): c.tone(x, 10, 'stone', 5); c.tone(x, 14, 'stone', 2) if False else None
    for x in range(6, 10): c.tone(x, 8, 'stone', 1); c.tone(x, 9, 'stone', 2)            # 윗면 홈
    c.group(2); c.new()
    ex = 12 if on else 3
    c.line(8, 8, ex, 2, 'steel', 4); c.line(8, 9, ex + (1 if on else 1), 3, 'steel', 2)  # 쇠 막대(빛줄 + 그늘줄)
    c.group(3); c.new()
    for (dx, dy, t) in ((0, 0, 5), (1, 0, 4), (0, 1, 4), (1, 1, 3), (-1, 0, 4), (-1, 1, 3)):
        c.tone(ex + dx, 1 + dy, 'rug', t)
    c.tone(ex - 1, 0, 'rug', 6) if not on else c.tone(ex, 0, 'rug', 6)
    c.group(4); c.new()                                           # 앞면 작은 등
    lm = 'siggrn' if on else 'sigred'
    for (x, y) in ((7, 11), (8, 11), (7, 12), (8, 12)): c.tone(x, y, lm, 5 if on else 2)
    c.tone(7, 11, lm, 6 if on else 3)
    return F(c)


# ---------------------------------------------------------------- 11 바닥 스위치 (걸음 바닥 소품)
def floor_plate(on=False):
    """바닥 스위치(1x1, 납작): 바닥에 박힌 네모 마름돌 테 안의 누름판. 끔 = 1px 솟아 윗면 빛·앞모 그늘이 보이고 홈 무늬가 어둡다,
    켬 = 눌려 테와 같은 높이, 판이 어둡고 홈 무늬에 호박색 빛."""
    W = H = 16
    c = C(W, H, seed=2300 + on)
    c.group(1); c.new()
    for y in range(2, 15):                                        # 바닥 테(어두운 홈 줄)
        for x in range(1, 15):
            ed = x in (1, 14) or y in (2, 14)
            c.tone(x, y, 'stone', 2 if ed else 3)
    c.group(2); c.new()
    if not on:
        for y in range(3, 12):
            for x in range(3, 13): c.tone(x, y, 'stone', 5 if (y == 3 or x == 3) else 4)
        for x in range(3, 13): c.tone(x, 12, 'stone', 2); c.tone(x, 13, 'stone', 1)  # 솟은 판의 앞모 + 그늘
        rune = 'stone'; rt = 2
    else:
        for y in range(4, 14):
            for x in range(3, 13): c.tone(x, y, 'stone', 3 if (y == 4 or x == 3) else 2)
        rune = 'amber'; rt = 5
    oy = 0 if not on else 1
    c.group(3); c.new()
    for (x, y) in ((7, 5), (8, 5), (5, 7), (10, 7), (5, 8), (10, 8), (7, 10), (8, 10), (6, 6), (9, 6), (6, 9), (9, 9)):
        c.tone(x, y + oy, rune, rt)
    if on:
        for (x, y) in ((7, 8), (8, 8), (7, 7), (8, 7)): c.tone(x, y + oy, 'amber', 6)
    return F(c, 0.7)


# ---------------------------------------------------------------- 13·14·15 문 (2x2)
def _door_frame(c, seal=False):
    """돌 문틀: 양쪽 문설주(4px) + 위 인방돌(가운데 이맛돌). 문틀 아래는 문턱 한 줄."""
    c.new()
    for y in range(0, 32):
        for x in list(range(0, 4)) + list(range(28, 32)):
            u = x if x < 4 else x - 28
            t = (5, 5, 4, 3)[u] if x < 4 else (4, 4, 3, 2)[u]
            if y % 8 == 7: t = max(1, t - 2)
            c.tone(x, y, 'stone', t)
    for y in range(0, 6):
        for x in range(0, 32):
            t = 5 if y == 0 else (4 if y < 4 else (2 if y == 5 else 3))
            if x in (9, 22) and y < 5: t = 2                      # 인방 이음
            c.tone(x, y, 'stone', t)
    for y in range(0, 7):
        for x in range(13, 19): c.tone(x, y, 'stone', 5 if x < 16 else 4)   # 이맛돌
    c.tone(13, 6, 'stone', 2); c.tone(18, 6, 'stone', 2)


def door(kind='iron', opened=False, frame=0):
    """문(2x2): 돌 문틀 안 쌍여닫이. 철문 = 강철판 + 리벳 + 쇠고리, 나무 문 = 세로 널 + 쇠 띠 + 고리, 봉인문 = 통돌 문에 보라 문양.
    열림 = 문짝이 안으로 젖혀 양쪽에 얇게 남고 가운데는 어두운 통로(문턱 너머 바닥이 조금 보인다)."""
    W = H = 32
    c = C(W, H, seed=2400 + len(kind) + opened * 3)
    c.group(1); _door_frame(c)
    c.group(2); c.new()
    if opened:
        for y in range(6, 32):
            for x in range(4, 28):
                t = 1 if y < 26 else (2 if y < 30 else 3)          # 안쪽 어둠, 아래로 갈수록 바닥 빛
                c.tone(x, y, 'dark', min(6, t + (2 if y >= 30 else 0)))
        for y in range(29, 32):
            for x in range(6, 26): c.tone(x, y, 'stone', 2 if y == 29 else 3)   # 문턱 너머 바닥 돌
        if kind != 'seal':
            m = 'steel' if kind == 'iron' else 'wood'
            for (x0, x1) in ((4, 7), (25, 28)):                     # 안으로 젖힌 문짝 모서리(얇게)
                for y in range(7, 31):
                    for x in range(x0, x1): c.tone(x, y, m, (3 if x0 == 4 else 2) + (1 if x == x0 else 0))
        else:                                                      # 봉인 풀림: 문틀 안쪽에 남은 흐린 문양 띠
            for y in range(8, 30, 3): c.tone(4, y, 'violet', 2); c.tone(27, y, 'violet', 2)
    else:
        if kind == 'iron':
            for y in range(6, 31):
                for x in range(4, 28):
                    lx = (x - 4) % 12; ly = (y - 6) % 8
                    t = 4 if x < 16 else 3
                    if lx == 0 or ly == 0: t += 1                    # 판 위·왼쪽 빛 모
                    if lx == 11 or ly == 7: t = 1                    # 판 줄눈(아래·오른쪽)
                    c.tone(x, y, 'steel', t)
            for x in (15, 16): [c.tone(x, y, 'steel', 1 if x == 15 else 2) for y in range(6, 31)]  # 두 문짝 사이
            c.new()
            for y in range(8, 31, 8):
                for x in list(range(6, 15, 4)) + list(range(18, 27, 4)):
                    c.tone(x, y, 'steel', 6); c.tone(x + 1, y + 1, 'steel', 1)
            for cx0 in (12, 19):                                   # 쇠고리
                for (dx, dy) in ((0, 0), (-1, 1), (1, 1), (-1, 2), (1, 2), (0, 3)): c.tone(cx0 + dx, 16 + dy, 'iron', 5 if dx <= 0 else 3)
        elif kind == 'wood':
            for y in range(6, 31):
                for x in range(4, 28):
                    lx = (x - 4) % 4
                    t = (5, 4, 4, 2)[lx] - (1 if x >= 16 else 0)
                    if _hash(x, y, 7) < .06: t -= 1
                    c.tone(x, y, 'wood', max(1, t))
            for x in (15, 16): [c.tone(x, y, 'wood', 1) for y in range(6, 31)]
            c.new()
            for yb in (9, 24):                                     # 쇠 띠 둘 + 못
                for x in range(4, 28):
                    if x in (15, 16): continue
                    c.tone(x, yb, 'iron', 5 if x < 16 else 4); c.tone(x, yb + 1, 'iron', 2)
                for x in (6, 13, 18, 25): c.tone(x, yb, 'iron', 6)
            for cx0 in (13, 18):
                for (dx, dy) in ((0, 0), (-1, 1), (1, 1), (0, 2)): c.tone(cx0 + dx, 16 + dy, 'iron', 5 if dx <= 0 else 3)
        else:                                                      # 봉인문: 통돌 두 짝
            for y in range(6, 31):
                for x in range(4, 28):
                    t = 4 if x < 16 else 3
                    if y == 6 or x in (4, 16): t += 1
                    if x in (15, 27): t = 2
                    if _hash(x, y, 11) < .07: t -= 1
                    c.tone(x, y, 'stone', max(1, t))
    c.new()
    for x in range(0, 32): c.tone(x, 31, 'stone', 2)                # 문턱
    im = F(c, 0.66)
    if kind == 'seal' and not opened:
        px = im.load(); f = frame % 4
        cx, cy = 15.5, 18.0
        # 봉인 문양: 바깥 고리 + 안 고리 + 육각 별 + 가운데 눈 없는 꽃잎. 맥동 = 고리가 차례로 밝아지고 빛줄이 문틀 쪽으로 뻗는다
        tone_ring = [(3, 5, 6, 5), (5, 6, 5, 3), (6, 5, 3, 5)]
        for ri, (r, n) in enumerate(((10.0, 120), (6.6, 80))):
            for i in range(n):
                a = 2 * math.pi * i / n
                x = int(round(cx + r * math.cos(a))); y = int(round(cy + r * .95 * math.sin(a)))
                put(px, W, H, x, y, rgb('violet', tone_ring[ri][f]))
        for k in range(6):                                          # 육각 별(두 세모)
            a0 = -math.pi / 2 + k * math.pi / 3; a1 = a0 + 2 * math.pi / 3
            for s in range(18):
                tt = s / 17
                x = cx + 6.6 * ((1 - tt) * math.cos(a0) + tt * math.cos(a1)); y = cy + 6.3 * ((1 - tt) * math.sin(a0) + tt * math.sin(a1))
                put(px, W, H, int(round(x)), int(round(y)), rgb('violet', tone_ring[2][f]))
        g = (4, 5, 6, 5)[f]
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1), (0, -1), (1, -1), (-1, 0), (2, 0), (0, 2), (1, 2)):
            put(px, W, H, int(cx) + dx, int(cy) + dy, rgb('violet', g if abs(dx - .5) + abs(dy - .5) < 1.5 else g - 2))
        # 문 가운데 이음을 따라 위아래로 흐르는 빛(프레임마다 자리)
        for y in range(7, 31):
            if (y + f * 3) % 12 < 2: put(px, W, H, 15, y, rgb('violet', 6)); put(px, W, H, 16, y, rgb('violet', 4))
        # 이맛돌 문장
        for (x, y) in ((15, 2), (16, 2), (15, 3), (16, 3)): put(px, W, H, x, y, rgb('violet', (3, 4, 6, 4)[f]))
    return im


# ---------------------------------------------------------------- 19 열차 신호기
def signal_post(color='red'):
    """열차 신호기(1x2): 콘크리트 밑동 + 경고 띠 + 강철 기둥 위 검은 신호판(차양 둘), 위 빨강·아래 초록 등 중 하나만 켜짐."""
    W, H = 16, 32
    c = C(W, H, seed=2600 + (color == 'green'))
    c.shadow(8, 30.6, 5.5, 1.3, 80)
    c.group(1); c.box(4, 26, 8, 2, 4, 'stone', top=.9, front=.55)
    c.group(2); c.new()
    for y in range(12, 26):
        c.tone(7, y, 'steel', 5); c.tone(8, y, 'steel', 3)
    for y in range(19, 25):                                       # 경고 띠(사선)
        for x in (7, 8): c.tone(x, y, 'warn' if (x + y) % 4 < 2 else 'dark', 5 if (x + y) % 4 < 2 else 1)
    c.group(3); c.new()
    for y in range(1, 14):                                         # 신호판(둥근 위)
        for x in range(4, 12):
            if y == 1 and x in (4, 11): continue
            c.tone(x, y, 'dark', 3 if x < 6 else 2)
    c.group(4); c.new()
    on_r = color == 'red'
    for (cy, mat, on) in ((4, 'sigred', on_r), (10, 'siggrn', not on_r)):
        for (dx, dy) in ((0, 0), (1, 0), (-1, 0), (0, 1), (1, 1), (-1, 1), (0, -1), (1, -1)):
            x, y = 7 + dx + (1 if dx >= 0 else 0) - (1 if dx > 0 else 0), cy + dy
            t = (6 if (dx <= 0 and dy <= 0) else 5) if on else (2 if dx <= 0 else 1)
            c.tone(7 + dx, y, mat, t); c.tone(8 + dx if dx >= 0 else 8, y, mat, t)
        for x in range(5, 11): c.tone(x, cy - 2, 'steel', 4 if x < 8 else 3)   # 차양
    im = F(c)
    px = im.load()
    for (cy, mat, on) in ((4, 'sigred', on_r), (10, 'siggrn', not on_r)):
        if on:                                                      # 켜진 등 빛 점(판 밖 양옆)
            put(px, W, H, 3, cy, rgb(mat, 5)); put(px, W, H, 12, cy, rgb(mat, 5)); put(px, W, H, 7, cy - 1, rgb(mat, 6))
    return im


# ---------------------------------------------------------------- 20·21 착륙장
def landing_pad(frame=None):
    """비행선 착륙장(3x3, 걸음): 낮게 솟은 둥근 강철 갑판(3/4 타원 윗면 + 앞모 3px) — 판 줄눈·리벳, 가운데 경고 노랑 고리와
    네 방향 갈매기 표시(글자 없음), 가장자리 표시등 여덟. frame=None 이면 정지판(등 반쯤 켜짐), 0~3 = 등이 차례로 도는 점멸."""
    W = H = 48
    c = C(W, H, seed=2700)
    cx, cy, rx, ry = 24, 21.5, 22.5, 18.0
    c.group(1); c.new()
    for y in range(1, 47):
        for x in range(0, 48):
            dx = (x + .5 - cx) / rx; dy = (y + .5 - cy) / ry; r = dx * dx + dy * dy
            if r <= 1:
                lx = x % 16; ly = (y - 2) % 12
                t = 4 if (dx + dy) < .4 else 3
                if lx == 15 or ly == 11: t = 1
                elif lx == 0 or ly == 0: t += 1
                c.tone(x, y, 'steel', t)
            else:
                dy2 = (y + .5 - cy - 3.5) / ry
                if dx * dx + dy2 * dy2 <= 1 and y > cy: c.tone(x, y, 'steel', 3 if (y + .5 - cy - 3.5) / ry * ry < ry - 2 and dx < .2 else 2)
    im = F(c, 0.66); px = im.load()
    # 리벳(판 모서리 2px 안)
    for y in range(4, 44, 12):
        for x in range(2, 48, 16):
            for (ox, oy) in ((0, 0), (11, 0)):
                xx, yy = x + ox, y + oy
                dx = (xx + .5 - cx) / rx; dy = (yy + .5 - cy) / ry
                if dx * dx + dy * dy < .82: put(px, W, H, xx, yy, rgb('steel', 6)); put(px, W, H, xx + 1, yy + 1, rgb('steel', 1))
    # 경고 노랑 고리(폭 2) + 네 방향 갈매기
    for i in range(160):
        a = 2 * math.pi * i / 160
        for rr in (.50, .54):
            x = int(round(cx - .5 + rx * rr * math.cos(a))); y = int(round(cy - .5 + ry * rr * math.sin(a)))
            if _hash(i, int(rr * 100), 5) > .1: put(px, W, H, x, y, rgb('warn', 5 if math.sin(a) < 0 else 4))
    for k in range(4):
        a = k * math.pi / 2
        for s in range(-3, 4):
            for d in (0, 1):
                bx = cx - .5 + rx * .28 * math.cos(a); by = cy - .5 + ry * .28 * math.sin(a)
                ux, uy = math.cos(a), math.sin(a); vx, vy = -uy, ux
                x = bx + vx * s * 1.0 - ux * abs(s) * .9 + ux * d; y = by + (vy * s * 1.0 - uy * abs(s) * .9 + uy * d) * .8
                put(px, W, H, int(round(x)), int(round(y)), rgb('warn', 5 if d == 0 else 3))
    # 가장자리 표시등 여덟
    for i in range(8):
        a = -math.pi / 2 + 2 * math.pi * i / 8
        x = int(round(cx - .5 + rx * .86 * math.cos(a))); y = int(round(cy - .5 + ry * .86 * math.sin(a)))
        if frame is None: t = 4
        else: t = 6 if (i % 4) == frame % 4 else (4 if (i % 4) == (frame + 3) % 4 else 1)
        mat = 'amber' if (frame is None or t > 1) else 'steel'
        put(px, W, H, x, y, rgb('steel', 1)); put(px, W, H, x + 1, y, rgb('steel', 1))
        put(px, W, H, x, y - 1, rgb(mat, t)); put(px, W, H, x + 1, y - 1, rgb(mat, max(1, t - 1)))
        if frame is not None and t == 6:                            # 켜진 등 빛 점
            put(px, W, H, x, y - 2, rgb('amber', 5)); put(px, W, H, x - 1, y - 1, rgb('amber', 5)); put(px, W, H, x + 2, y - 1, rgb('amber', 4))
    return im


# ---------------------------------------------------------------- 24 밀 수 있는 돌덩이
def push_block():
    """밀 수 있는 돌덩이(1x1): 거친 네모 마름돌(윗면 5줄 + 앞면), 모서리 깨짐, 윗면 이끼 조금, 아래 끌린 자국."""
    c = C(16, 16, seed=2800)
    c.shadow(8, 14.6, 7, 1.2, 90)
    c.group(1); c.box(2, 1, 12, 5, 8, 'stone', top=0.95, front=0.56)
    c.new()
    for x in range(2, 14): c.tone(x, 6, 'stone', 5)                  # 앞면 위 모
    for (x, y) in ((9, 8), (10, 9), (10, 10), (11, 11)): c.tone(x, y, 'stone', 1)   # 금
    c.tone(13, 1, 'stone', 2); c.tone(2, 13, 'stone', 2)
    c.new()
    for (x, y) in ((3, 2), (4, 2), (3, 3), (5, 2)): c.tone(x, y, 'moss', 4)
    for x in range(3, 13): c.tone(x, 14, 'stone', 1) if x % 3 else None
    return F(c)
