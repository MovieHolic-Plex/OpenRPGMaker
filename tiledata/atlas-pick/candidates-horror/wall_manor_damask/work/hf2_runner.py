#!/usr/bin/env python3
"""hf2 carpet_runner A/B/C — 4x3 오토타일. prof(side,d,along)->(mat,tone) 를 손으로 정한다."""
import sys
sys.path.insert(0, '.')
from hf2_lib import Cv

def mk(prof, inside, note, name):
    cv = Cv(64, 48)
    def cell(cx, cy, sides, inner=None):
        for y in range(16):
            for x in range(16):
                cand = []
                if 'N' in sides and y < 4: cand.append((y, prof('N', y, x)))
                if 'S' in sides and y > 11: cand.append((15 - y, prof('S', 15 - y, x)))
                if 'W' in sides and x < 4: cand.append((x, prof('W', x, y)))
                if 'E' in sides and x > 11: cand.append((15 - x, prof('E', 15 - x, y)))
                if inner:
                    for (vx, vy) in inner:
                        dx = x if vx == 'W' else 15 - x; dy = y if vy == 'N' else 15 - y
                        if dx < 4 and dy < 4:
                            pv = prof(vx, dx, y); ph = prof(vy, dy, x)
                            if dx > dy: cand.append((dx, pv))
                            elif dy > dx: cand.append((dy, ph))
                            else: cand.append((dx, min(pv, ph, key=lambda c: c[1])))
                corner = sum(1 for sd, ok in (('N', y == 0), ('S', y == 15), ('W', x == 0), ('E', x == 15)) if sd in sides and ok) >= 2
                if corner: continue
                if cand:
                    d0 = min(c[0] for c in cand); mt = min((c[1] for c in cand if c[0] == d0), key=lambda c: c[1])
                else:
                    mt = inside(x, y)
                cv.put(cx * 16 + x, cy * 16 + y, *mt)
    grid = {(0, 0): 'NW', (1, 0): 'N', (2, 0): 'NE', (0, 1): 'W', (1, 1): '', (2, 1): 'E', (0, 2): 'SW', (1, 2): 'S', (2, 2): 'SE'}
    for (cx, cy), sd in grid.items(): cell(cx, cy, sd)
    cell(3, 0, '', inner=[('W', 'N'), ('E', 'N'), ('W', 'S'), ('E', 'S')])
    cv.emit('carpet_runner', name, {'v': 'velv', 't': 'tarn'}, note)

lit = lambda s: s in 'NW'

# ── A: 파일럿 계열 — 술1 · 금(밝5/3, 어둠3/2) 두 줄 · 그늘2, 속 작은 마름모
def profA(s, d, a):
    return [('v', '1'), ('t', '5' if lit(s) else '3'), ('t', '3' if lit(s) else '2'), ('v', '2')][d]
MA = {(8, 6): '5', (7, 7): '4', (8, 7): '5', (9, 7): '4', (6, 8): '4', (7, 8): '5', (9, 8): '5', (10, 8): '4', (7, 9): '4', (8, 9): '5', (9, 9): '4',
      (8, 10): '5', (2, 2): '4', (13, 13): '4', (2, 13): '4', (13, 2): '4'}
mk(profA, lambda x, y: ('v', MA.get((x, y), '3')),
   'A 기본: 파일럿 계열. 짙은 벨벳(3) 바탕, 칸 가운데 작은 마름모(4·5)+귀퉁이 점, 테 4px = 바깥 술 1 · 금 두 줄(위·왼 밝게 5/3, 아래·오른 어둡게 3/2) · 안 그늘 2. 바깥 모서리 화소 투명, 안쪽 모서리는 두 변 테가 꺾여 만남', 'hf2-A')

# ── B: 어둠에서 읽힘 — 술 0(거의 검정) · 밝은 금 한 줄 굵게 · 그늘, 속은 큰 마름모 윤곽 하나(칸당)
def profB(s, d, a):
    if lit(s): return [('v', '0'), ('t', '5'), ('t', '4'), ('v', '1')][d]
    return [('v', '0'), ('t', '3'), ('t', '2'), ('v', '1')][d]
def insB(x, y):
    dd = abs(x - 7.5) + abs(y - 7.5)
    if 5.4 < dd < 6.6: return ('t', '5')
    if dd <= 5.4 and dd > 4.4: return ('v', '4')
    if dd <= 4.4: return ('v', '2')
    return ('v', '3')
mk(profB, insB,
   'B 어둠에서 읽힘: 바깥 술 0(검정에 가까움)과 밝은 금 줄(위·왼 5·4)의 폭 차를 최대로, 그늘 1. 속은 칸 가운데 큰 마름모 윤곽(금 4 + 벨벳 4) + 속 평면 2, 바탕 3. 멀리서도 길이 띠로 읽힌다', 'hf2-B')

# ── C: 재료·무늬 — 술 엇갈림 · 금 점선/열쇠무늬 · 안쪽 격자와 꽃
def profC(s, d, a):
    if d == 0: return ('v', '1' if a % 2 == 0 else '3')            # 술: 한 화소씩 엇갈림
    if d == 1: return ('t', ('5' if lit(s) else '3') if (a // 2) % 2 == 0 else ('3' if lit(s) else '2'))   # 금 점선(2px 마디)
    if d == 2: return ('t', '3' if lit(s) else '2') if (a % 8) not in (3, 4) else ('t', '5' if lit(s) else '3')  # 금 줄에 열쇠 틈
    return ('v', '2')
FL = {(8, 6): '5', (8, 7): '5', (7, 7): '4', (9, 7): '4', (6, 8): '4', (7, 8): '5', (8, 8): '5', (9, 8): '5', (10, 8): '4', (7, 9): '4', (9, 9): '4', (8, 9): '5', (8, 10): '5'}
def insC(x, y):
    if (x, y) in FL: return ('v', FL[(x, y)])
    if (x + y) % 8 == 0 or (x - y) % 8 == 0: return ('v', '4')      # 8px 대각 격자(16 주기와 맞음)
    return ('v', '3')
mk(profC, insC,
   'C 무늬: 술이 한 화소씩 엇갈림(1/3), 금 첫 줄은 2px 마디 점선(5/3), 둘째 줄은 8px마다 열쇠 틈, 그늘 2. 속은 8px 대각 격자(4)+칸 가운데 십자 꽃 5, 바탕 3. 위·왼 밝게 아래·오른 어둡게', 'hf2-C')
print('ok')
