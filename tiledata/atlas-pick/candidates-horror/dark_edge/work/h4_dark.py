import sys, math, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'wall_paper_torn', 'work'))
from h4lib import Cv
CH = ' ^"*&'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')

def q(v, x, y, dither=True):
    if v <= 0: return None
    v = min(v, 4.0)
    b = int(v); f = v - b
    if dither:
        chk = (x + y) % 2
        if f > (0.72 if chk == 0 else 0.28): b += 1
    else:
        if f > 0.5: b += 1
    b = min(b, 4)
    return CH[b] if b > 0 else None

# ---- 가장자리 v(x,y): 위가 가장 짙다
def edge_A(x, y):   # 부드러운 세로 그라데이션(2px 디더)
    return 4.6 - y * 0.34
def edge_B(x, y):   # 굳센 띠: 짙은 덩어리 뒤 갑자기 옅어짐
    return 4.0 if y < 5 else (3.0 if y < 7 else (2.0 if y < 9 else (1.0 if y < 11 else 0)))
LEN = [7,7,9,13,9,7,6,6,8,11,8,6,6,7,9,14]  # C: 아래로 늘어진 손가락(좌우로 이어지게 15→0 끊김 없음)
def edge_C(x, y):
    L = LEN[x % 16]
    return 4.6 - y * (4.6 / L) if y < L else 0

def mk(fn, dith, corner=False, label=''):
    c = Cv(16, 16)
    for y in range(16):
        for x in range(16):
            v = fn(x, y)
            if corner:
                v = max(v, fn(y, x) if fn is not edge_C else fn(15 - y, x))
                # 네 분의 일 원 번짐(안쪽으로 조금 더)
                r = math.hypot(x + .5, y + .5)
                v = max(v, 4.6 - r * 0.30)
            if y == 15 and not corner: v = 0
            ch = q(v, x, y, dith)
            if ch: c.set(x, y, ch)
    if not corner:
        for x in range(16): c.set(x, 0, '&')
    else:
        for x in range(16): c.set(x, 0, '&')
        for y in range(14): c.set(0, y, '&')
        c.set(0, 14, '*'); c.set(0, 15, None)   # 검사(귀퉁이 셋 이상 불투명 금지) 때문에 왼쪽 열 맨 아래 두 칸만 옅게 뗀다
    return c

for name, cn in (('dark_edge', False), ('dark_corner', True)):
    for k, (fn, dith, note) in {
        'A': (edge_A, True, '위 &→아래로 * " ^ 부드러운 그라데이션, 경계는 2px 체크 디더, 맨 아랫줄 투명'),
        'B': (edge_B, False, '디더 없이 굳센 띠: & 5줄→*→"→^ 두 줄씩 딱 끊어 어두운 방에서도 경계가 또렷'),
        'C': (edge_C, True, '어둠이 아래로 손가락처럼 늘어져 내림(길이 6~14, 좌우 이음 매끈) — 윤곽이 갈퀴'),
    }.items():
        c = mk(fn, dith, cn)
        if cn:
            note = note.replace('맨 아랫줄 투명', '윗줄·왼쪽 열 &, 모서리 원호로 더 번짐') + ' — 모서리: 가장자리 두 장(위+왼쪽 회전)의 겹침 + 안쪽 원호'
        c.emit(f'{ROOT}/{name}/h4-{k}.pxg', f'{name} h4-{k}')
        open(f'{ROOT}/{name}/h4-{k}.note', 'w', encoding='utf-8').write(note + '\n')
