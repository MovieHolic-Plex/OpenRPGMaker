import sys; sys.path.insert(0, '../../blackboard/work')
from s2lib import *
from s2geo import *

def LEG():
    L = {}
    for i in range(8): L[chr(ord('a') + i)] = ('mmetal', i)    # a..h  rack
    for i in range(7): L[chr(ord('0') + i)] = ('vblack', i)    # 0..6  tires/saddle
    for i in range(7): L[chr(ord('p') + i)] = ('vblue', i)     # p..v  bike 1
    for i in range(7): L[chr(ord('A') + i)] = ('vred', i)      # A..G  bike 2
    for i in range(7): L[chr(ord('i') + i)] = ('viron', i)     # i..o  basket wire / hub
    return L

def wheel(c, cx, cy, tire, hi, spoke, hub, thick=1.0, big=4.0):
    ring(c, cx, cy, big - 0.6, big + 0.65 + (thick - 1) * 1.0, tire)
    c.put(cx - 3, cy - 2, hi) if False else None
    # 왼쪽 위 빛
    for dx, dy in ((-3, -2), (-2, -3), (-3, -1)):
        if c.get(cx + dx, cy + dy) == tire: c.put(cx + dx, cy + dy, hi)
    for d in (-2, -1, 1, 2):
        c.put(cx + d, cy, spoke); c.put(cx, cy + d, spoke)
    c.put(cx, cy, hub)

def bike(c, x0, pal, tire, tire_hi, spoke, hub, wire, wire_hi, basket=True, thick=False):
    b_hi, b_mid, b_dk = pal
    ax, ay = x0 + 4, 24
    fx = x0 + 17
    wheel(c, ax, ay, tire, tire_hi, spoke, hub)
    wheel(c, fx, ay, tire, tire_hi, spoke, hub)
    bbx, bby = x0 + 9, 24
    sx, sy = x0 + 7, 16
    hx, hy = x0 + 15, 16
    # 프레임(다이아몬드)
    t = 2 if thick else 1
    def bar(xa, ya, xb, yb):
        line(c, xa, ya, xb, yb, b_mid)
        if thick: line(c, xa + 1, ya, xb + 1, yb, b_dk) if abs(xb - xa) < abs(yb - ya) else line(c, xa, ya + 1, xb, yb + 1, b_dk)
    bar(ax, ay, sx, sy)            # 뒷삼각 위
    bar(ax, ay, bbx, bby)          # 체인스테이
    bar(bbx, bby, sx, sy)          # 좌석관
    bar(sx, sy, hx, hy)            # 윗관
    bar(bbx, bby, hx, hy)          # 아랫관
    bar(hx, hy, fx, ay)            # 포크
    line(c, sx, sy, sx - 1, sy - 1, b_hi)
    line(c, sx, sy, hx, hy, b_hi) if False else None
    # 안장, 핸들, 페달
    c.rect(sx - 3, sy - 3, 5, 2, tire_hi if False else '3'); c.hl(sx - 3, sy - 3, 5, '4'); c.hl(sx - 2, sy - 1, 3, '1')
    c.vl(sx, sy - 1, 2, b_mid)
    c.hl(hx - 1, hy - 3, 3, '2'); c.vl(hx, hy - 2, 2, b_mid); c.put(hx + 2, hy - 2, '2')
    c.rect(bbx - 1, bby + 1, 2, 1, '2')
    # 학교 바구니(핸들 앞)
    if basket:
        bx, by = hx + 2, hy - 3
        c.rect(bx, by, 5, 4, wire); c.hl(bx, by, 5, wire_hi); c.vl(bx, by, 4, wire_hi)
        for k in range(1, 4, 2): c.vl(bx + k + 1, by + 1, 3, '.')
        c.hl(bx, by + 3, 5, wire)
    return

def rack(c, tone_hi, tone_mid, tone_dk, x_end=47):
    # 뒤 레일 + 발판 + 기둥
    c.hl(0, 20, x_end + 1, tone_mid); c.hl(0, 19, x_end + 1, tone_hi)
    for px in (0, 23, 24, x_end):
        c.vl(px, 19, 11, tone_mid)
    c.hl(0, 29, x_end + 1, tone_dk)
    c.hl(0, 28, 1, tone_dk)

def scene(tag):
    c = C(48, 32); L = LEG(); B = tag == 'B'
    rack(c, 'e', 'd' if not B else 'c', 'a' if B else 'b')
    if not B:
        bike(c, 2, ('t', 's', 'q'), '1', '4', '5', 'l', 'k', 'n')
        bike(c, 26, ('E', 'D', 'B'), '1', '4', '5', 'l', 'k', 'n')
    else:
        bike(c, 2, ('s', 'r', 'p'), '0', '3', '4', 'k', 'j', 'm', thick=True)
        bike(c, 26, ('D', 'C', 'A'), '0', '3', '4', 'k', 'j', 'm', thick=True)
    for x in range(1, 47): c.put(x, 30, '~') if c.get(x, 30) == '.' else None
    if B:
        for x in range(2, 48):
            if c.get(x, 31) == '.': c.put(x, 31, '-')
    return c, L

def scene_C():
    """실루엣: 굵은 이중 타이어, 굵은 프레임, 큰 바구니, 물결 모양 거치대(사인파 레일)"""
    c = C(48, 32); L = LEG()
    # 물결 레일: 바닥 가까이 사인파 (각 자전거 바퀴가 들어가는 홈)
    for x0 in (2, 26):
        for k in range(0, 22):
            y = 27 + (1 if (k // 3) % 2 == 0 else 0)
            c.put(x0 + k, y, 'd')
            c.put(x0 + k, y + 1, 'b') if (k // 3) % 2 == 0 else None
    c.hl(0, 29, 48, 'b')
    bike(c, 2, ('t', 's', 'q'), '1', '4', '5', 'l', 'k', 'n', thick=True)
    bike(c, 26, ('E', 'D', 'B'), '1', '4', '5', 'l', 'k', 'n', thick=True)
    for x in range(1, 47):
        if c.get(x, 30) == '.': c.put(x, 30, '~')
    return c, L

NOTE = {
 'A': '자전거 거치대 A: 지붕 없는 쇠(mmetal) 뒷레일과 기둥 사이에 학교 자전거 두 대(파랑·빨강, vblue/vred). 바퀴는 1px 원(지름 9, vblack)에 허브와 십자 살, 안장·핸들·앞 바구니(viron). 빛은 왼쪽 위.',
 'B': '명암 강조: 타이어를 가장 어두운 검정으로, 프레임을 두 겹으로 굵게, 몸체 색을 한 단 눌러 어둡게, 바닥에 그림자 두 줄. 레일은 한 단 어둡게.',
 'C': '실루엣 재해석: 뒷레일 대신 바닥의 물결 홈 거치대에 바퀴를 세우고 프레임을 굵게, 바구니를 크게 — 한 색 실루엣이 자전거 둘로 갈라져 보임.',
}
if __name__ == '__main__':
    out = []
    for tag in 'AB':
        c, L = scene(tag); out.append(save('bike_rack', tag, c, L, NOTE[tag]))
    c, L = scene_C(); out.append(save('bike_rack', 'C', c, L, NOTE['C']))
    check(out)
