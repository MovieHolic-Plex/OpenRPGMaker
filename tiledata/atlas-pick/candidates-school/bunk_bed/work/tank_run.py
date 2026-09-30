from tank import *
os.makedirs(ROOT + '/water_tank', exist_ok=True)
c = box_tank('stile', 'locker', 5, 2, 3, 'locker'); fin(c, 'A', '네모 패널 물탱크: 밝은 강판 윗면 띠와 맨홀 뚜껑, 리벳 박은 앞면 패널 이음 3×3, 회색 철제 다리+X 보강, 오른쪽 사다리')
c = box_tank('cream', 'locker', 5, 1, 2, 'locker')
inv = {v: k for k, v in c.m.items()}
for y in range(15, 37):
    for x in range(26, 41):
        ch = c.get(x, y)
        if ch in inv and inv[ch][0] == 'cream':
            c.px(x, y, ('cream', max(0, inv[ch][1] - (2 if x < 34 else 3))))
fin(c, 'B', '센 명암: 크림색 판 탱크, 왼쪽 밝고 오른쪽 세 번째 패널부터 깊은 그늘, 윗면 넓은 띠, 다리 짙음')

import math
c = C(48, 48)
cx, cy_top, rx, ry = 19, 9, 15, 5
R = 'stile'
body_top, body_bot = 9, 34
for y in range(cy_top - ry, body_bot + ry + 1):
    for x in range(cx - rx, cx + rx + 1):
        dx = (x - cx) / rx
        inside_top = (dx * dx + ((y - cy_top) / ry) ** 2) <= 1.0
        inside_bot = (dx * dx + ((y - body_bot) / ry) ** 2) <= 1.0
        inside_mid = body_top <= y <= body_bot
        if inside_top:
            st = 6 if dx < 0.35 else 5
            if ((y - cy_top) / ry) > 0.6: st = 4
            c.px(x, y, (R, st))
        elif inside_mid or inside_bot:
            d = (x - cx) / rx   # -1..1
            st = 5 if d < -0.55 else 4 if d < -0.1 else 3 if d < 0.4 else 2 if d < 0.75 else 1
            c.px(x, y, (R, st))
# 윗면 테두리
for x in range(cx - rx, cx + rx + 1):
    dx = (x - cx) / rx
    yy = int(round(ry * math.sqrt(max(0, 1 - dx * dx))))
    c.px(x, cy_top + yy, (R, 2)) if False else None
# 띠(가로 죔쇠)
for y in (16, 24, 31):
    for x in range(cx - rx, cx + rx + 1):
        ch = c.get(x, y)
        if ch != '.': c.px(x, y, ('locker', 3 if x < cx + 6 else 1))
# 맨홀 뚜껑
c.rect(cx - 4, cy_top - 2, 9, 4, ('locker', 3)); c.hl(cx - 3, cy_top - 2, 7, ('locker', 5)); c.hl(cx - 4, cy_top + 1, 9, ('locker', 1))
c.px(cx, cy_top - 1, ('locker', 6)); c.px(cx + 1, cy_top - 1, ('locker', 6))
# 아래 가장자리 어둡게
for x in range(cx - rx, cx + rx + 1):
    dx = (x - cx) / rx
    yy = body_bot + int(round(ry * math.sqrt(max(0, 1 - dx * dx))))
    c.px(x, yy, (R, 0))
# 다리
legs(c, 'locker', (6, 30), 39, 45, cross=True)
c.rect(8, 39, 23, 1, ('locker', 1))
# 사다리 (몸통 오른쪽)
c.vl(37, 12, 32, ('locker', 4)); c.vl(38, 12, 32, ('locker', 2)); c.vl(41, 12, 32, ('locker', 4)); c.vl(42, 12, 32, ('locker', 2))
for y in range(14, 44, 4): c.hl(39, y, 2, ('locker', 3))
c.hl(35, 12, 3, ('locker', 4))
fin(c, 'C', '실루엣 다르게: 둥근 원통 탱크(타원 윗면·맨홀·가로 죔쇠 띠 셋), 짧은 다리 둘, 사다리 오른쪽')
