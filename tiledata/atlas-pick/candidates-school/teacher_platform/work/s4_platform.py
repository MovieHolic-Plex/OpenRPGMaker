import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'school_gate', 'work'))
from s4_lib import C, write_item, shadow

# 결 점선: 16칸 주기(가운데 칸을 되풀이해도 이음이 맞도록 x%16 기준)
GR = {3: (2, 9), 6: (5, 13), 9: (0, 8)}   # 판 줄 y : 결 대시 시작 x들 (16주기)

def deck(c, top_t, seam_t, grain_t, lip, y0=1, planks=(2, 5, 8)):
    # 윗면 3판 (y0..y0+8), 판 사이 어두운 이음 1줄
    for i, py in enumerate(planks):
        pass

def base(hi=0, deep=False, chamfer=False):
    c = C(48, 16)
    # 윗판 3장: y1-3, y5-7, y9-11 (사이 y4, y8 이음)  — 아니, 윗면은 y1..9, 앞 턱 y10..12
    rows = [(1, 3), (5, 6), (8, 9)]      # 판 y 범위
    tones = [5 + hi, 4 + hi, 5 + hi]
    for (ya, yb), t in zip(rows, tones):
        c.rect(0, ya, 48, yb - ya + 1, 'cfloor', t)
    for y in (4, 7):
        c.hl(0, y, 48, 'cfloor', 2)          # 판 이음
    # 결: 대시 (16 주기)
    for (y, xs) in ((2, (2, 10)), (5, (6, 13)), (6, (1, 9)), (8, (4, 12)), (9, (7, 15))):
        for k in range(3):
            for x0 in xs:
                for dx in range(0, 3):
                    c.px(k * 16 + (x0 + dx) % 16, y, 'cfloor', 4 if y in (2, 8) else 3)
    # 앞 턱 (짙은 밝기)
    c.hl(0, 10, 48, 'vdwood', 4); c.hl(0, 11, 48, 'vdwood', 3 - (1 if deep else 0)); c.hl(0, 12, 48, 'vdwood', 2 - (1 if deep else 0))
    for x in (7, 23, 39): c.px(x, 11, 'vdwood', 2); c.px(x + 1, 11, 'vdwood', 4)
    return c

def PA():
    c = base()
    # 끝맺음: 좌우 끝 세로선(가운데 칸은 없음)
    c.vl(0, 1, 9, 'cfloor', 6); c.vl(0, 10, 3, 'vdwood', 5)
    c.vl(47, 1, 12, 'vdwood', 1)
    c.hl(0, 0, 48, 'vdwood', 4)
    shadow(c, 0, 48, 13)
    return c

def PB():
    c = base(hi=1, deep=True)
    c.hl(0, 0, 48, 'vdwood', 4)
    c.hl(0, 1, 48, 'cfloor', 6)
    c.vl(0, 1, 9, 'cfloor', 6); c.vl(1, 2, 8, 'cfloor', 6)
    c.vl(47, 1, 12, 'vdwood', 0); c.vl(46, 1, 9, 'cfloor', 3)
    c.hl(0, 12, 48, 'vdwood', 0)
    for x in range(0, 48): c.px(x, 13, '~'); c.px(x, 14, '~')
    for x in range(2, 46): c.px(x, 15, '-')
    return c

def PC():
    # 왼쪽에 낮은 디딤 한 단이 붙고, 앞 턱에 판넬 홈이 16칸마다 반복
    c = C(48, 16)
    for (ya, yb, t) in ((1, 3, 5), (5, 6, 4), (8, 8, 5)):
        c.rect(6, ya, 42, yb - ya + 1, 'cfloor', t)
    for y in (4, 7): c.hl(6, y, 42, 'cfloor', 2)
    for (y, xs) in ((2, (2, 10)), (5, (6, 13)), (6, (1, 9)), (8, (4, 12))):
        for k in range(3):
            for x0 in xs:
                for dx in range(0, 3): 
                    x = k * 16 + (x0 + dx) % 16
                    if x >= 6: c.px(x, y, 'cfloor', 4 if y in (2, 8) else 3)
    c.hl(6, 0, 42, 'vdwood', 4); c.vl(47, 1, 12, 'vdwood', 1)
    c.hl(6, 9, 42, 'vdwood', 5); c.rect(6, 10, 42, 3, 'vdwood', 3)
    # 앞 턱 판넬 홈 (12폭, 16주기: 안쪽 4칸 남김)
    for k in range(3):
        x0 = k * 16 + 2
        if x0 < 6: continue
        c.box(x0, 10, 12, 3, 'vdwood', 2); c.hl(x0 + 1, 10, 10, 'vdwood', 4)
    # 왼쪽 디딤 단 (낮음)
    c.rect(0, 6, 8, 3, 'cfloor', 5); c.hl(0, 5, 8, 'vdwood', 4); c.hl(0, 6, 8, 'cfloor', 6)
    c.rect(0, 9, 8, 4, 'vdwood', 3); c.hl(0, 9, 8, 'vdwood', 5); c.hl(0, 12, 8, 'vdwood', 2)
    c.vl(0, 6, 7, 'vdwood', 4)
    c.vl(6, 9, 4, 'vdwood', 2)
    shadow(c, 0, 48, 13)
    return c

if __name__ == '__main__':
    write_item(PA(), 'teacher_platform', 'A', '낮은 나무 교단: 윗면 가로 결 널 3장(이음 2줄, 16칸 주기라 가운데 칸 되풀이 가능) + 앞 턱 짙은 갈색 3줄 띠, 발치 그림자 2줄')
    write_item(PB(), 'teacher_platform', 'B', '같은 교단 명암 강화: 윗면 앞쪽 밝게, 앞 턱 더 어둡게(0~3), 좌우 끝 하이라이트/그늘, 접지 그림자 3줄')
    write_item(PC(), 'teacher_platform', 'C', '재해석: 왼쪽 끝에 낮은 디딤 한 단이 붙은 교단, 앞 턱에 16칸 주기 판넬 홈')
