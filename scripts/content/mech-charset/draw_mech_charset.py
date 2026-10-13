#!/usr/bin/env python3
"""전투기계 캐릭터셋(RM2000 규격 288x256: 4x2 인물, 인물당 72x128 = 3열 걷기 x 4방향 24x32)을 코드로 찍는다.
행 순서는 src/assets/easyrpgRtp.ts CHARSET_DIRECTIONS(위·오른·아래·왼)를 따른다.
인물 0 Frost Warden(강청색 중형), 1 Night Bastion(흑철 중장갑·어깨포), 2 Pale Sentinel(백색 경량·방패), 3 Rust Hound(4족)."""
import sys
from PIL import Image
DIR_ROW = {'up': 0, 'right': 1, 'down': 2, 'left': 3}  # CHARSET_DIRECTIONS 순서

def pal(base, light, dark, edge, glow, accent):
    return dict(b=base, l=light, d=dark, e=edge, g=glow, a=accent)

TYPES = [
    dict(name='Frost Warden', p=pal((92, 112, 140), (140, 164, 192), (52, 66, 90), (24, 30, 46), (120, 230, 255), (200, 210, 225)), w=1, kit='antenna'),
    dict(name='Night Bastion', p=pal((60, 62, 74), (104, 108, 124), (30, 32, 42), (12, 12, 20), (255, 150, 60), (140, 60, 50)), w=2, kit='cannon'),
    dict(name='Pale Sentinel', p=pal((190, 198, 210), (236, 240, 246), (126, 136, 156), (60, 68, 88), (150, 255, 210), (90, 150, 190)), w=0, kit='shield'),
    dict(name='Rust Hound', p=pal((120, 84, 60), (170, 126, 90), (70, 46, 34), (30, 20, 16), (255, 90, 70), (90, 90, 96)), w=1, kit='quad'),
]

class Cell:
    def __init__(s): s.px = {}
    def put(s, x, y, c):
        if 0 <= x < 24 and 0 <= y < 32: s.px[(x, y)] = c
    def rect(s, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, c)
    def box(s, x0, y0, x1, y1, P):
        """윤곽+밝은 윗·왼면+어두운 아래·오른면."""
        s.rect(x0, y0, x1, y1, P['e'])
        if x1 - x0 < 2 or y1 - y0 < 2: s.rect(x0, y0, x1, y1, P['d']); return
        s.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, P['b'])
        s.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, P['l'])
        s.rect(x0 + 1, y0 + 1, x0 + 1, y1 - 1, P['l'])
        s.rect(x1 - 1, y0 + 2, x1 - 1, y1 - 1, P['d'])
        s.rect(x0 + 2, y1 - 1, x1 - 1, y1 - 1, P['d'])

def draw_front(c, t, f, back):
    P = t['p']; w = t['w']
    bob = 1 if f != 1 else 0
    lift_l = 2 if f == 0 else 0   # 왼발 들기
    lift_r = 2 if f == 2 else 0
    tw = 4 + w              # 몸통 반폭
    cx = 12
    # 다리
    for side, lift in ((-1, lift_l), (1, lift_r)):
        x0 = cx - 5 if side < 0 else cx + 1
        c.box(x0, 21 - lift + 0, x0 + 3, 26 - lift, P)          # 허벅지
        c.box(x0 - (1 if w == 2 else 0), 26 - lift, x0 + 3 + (1 if w == 2 else 0), 29 - lift + (0 if lift else 0), P)  # 정강이
        c.box(x0 - 1, 29 - lift, x0 + 4, 30 - lift + (1 if lift == 0 else 0) , P)  # 발
    # 골반
    c.box(cx - 4, 19 - bob, cx + 3, 22 - bob, P)
    # 팔(걷기 반대 스윙)
    ay_l = 12 - bob + (1 if f == 2 else 0); ay_r = 12 - bob + (1 if f == 0 else 0)
    c.box(cx - tw - 3, ay_l, cx - tw, ay_l + 7, P)
    c.box(cx + tw - 1, ay_r, cx + tw + 2, ay_r + 7, P)
    c.rect(cx - tw - 2, ay_l + 7, cx - tw - 1, ay_l + 7, P['a']); c.rect(cx + tw, ay_r + 7, cx + tw + 1, ay_r + 7, P['a'])
    # 몸통
    c.box(cx - tw, 10 - bob, cx + tw - 1, 19 - bob, P)
    # 어깨
    c.box(cx - tw - 3, 9 - bob, cx - tw + 1, 12 - bob, P); c.box(cx + tw - 2, 9 - bob, cx + tw + 2, 12 - bob, P)
    if back:
        c.rect(cx - 2, 12 - bob, cx + 1, 17 - bob, P['d'])
        for yy in (13, 15, 17): c.rect(cx - 2, yy - bob, cx + 1, yy - bob, P['e'])
    else:
        c.rect(cx - 2, 13 - bob, cx + 1, 14 - bob, P['g']); c.rect(cx - 1, 16 - bob, cx, 17 - bob, P['a'])
    # 머리
    hx = cx - 3
    c.box(hx, 4 - bob, hx + 5, 9 - bob, P)
    if not back: c.rect(hx + 1, 6 - bob, hx + 4, 7 - bob, P['g'])
    else: c.rect(hx + 1, 7 - bob, hx + 4, 7 - bob, P['d'])
    kit(c, t, 'front', bob, back)

def kit(c, t, view, bob, back):
    P = t['p']; k = t['kit']; cx = 12
    if k == 'antenna':
        c.rect(cx + 2, 1 - bob, cx + 2, 4 - bob, P['e']); c.put(cx + 2, 0 - bob, P['g'])
    elif k == 'cannon':
        if view == 'front':
            c.box(cx + 3, 5 - bob, cx + 6, 9 - bob, P); c.rect(cx + 4, 4 - bob, cx + 5, 5 - bob, P['g'])
        else:
            c.box(cx - 1, 4 - bob, cx + 4, 8 - bob, P)
    elif k == 'shield':
        if view == 'front':
            c.box(cx - 8, 11 - bob, cx - 4, 21 - bob, P); c.rect(cx - 7, 14 - bob, cx - 5, 17 - bob, P['a'])
        else:
            c.box(cx - 5, 11 - bob, cx + 1, 21 - bob, P); c.rect(cx - 3, 14 - bob, cx - 1, 17 - bob, P['a'])

def draw_side(c, t, f, face):  # face: 'left'|'right'
    P = t['p']; w = t['w']
    bob = 1 if f != 1 else 0
    s = 1 if face == 'right' else -1
    def X(x0, x1):  # 오른쪽 기준 좌표를 방향에 맞게 뒤집는다
        a, b = (12 + s * x0, 12 + s * x1)
        return (min(a, b), max(a, b))
    sw = {0: -3, 1: 0, 2: 3}[f]   # 앞다리 스윙
    # 뒷다리
    for lead, off in ((False, -sw), (True, sw)):
        lift = 1 if (lead and f == 0) or (not lead and f == 2) else 0
        x0, x1 = X(-1 + off, 2 + off)
        c.box(x0, 21 - lift, x1, 26 - lift, P)
        x0, x1 = X(-1 + off, 3 + off); c.box(x0, 26 - lift, x1, 29 - lift, P)
        x0, x1 = X(-1 + off + (0), 4 + off); c.box(min(x0, x1), 29 - lift, max(x0, x1), 30 - lift, P)
    x0, x1 = X(-3, 3); c.box(x0, 19 - bob, x1, 22 - bob, P)
    # 몸통
    x0, x1 = X(-3 - w // 2, 3 + w // 2); c.box(x0, 10 - bob, x1, 19 - bob, P)
    # 등 장비
    x0, x1 = X(-6 - w // 2, -3 - w // 2); c.box(min(x0, x1), 10 - bob, max(x0, x1), 17 - bob, P)
    # 팔
    ao = {0: 2, 1: 0, 2: -2}[f]
    x0, x1 = X(-1 + ao, 2 + ao); c.box(x0, 11 - bob, x1, 18 - bob, P)
    c.rect(*(X(0 + ao, 1 + ao)[0], 18 - bob, X(0 + ao, 1 + ao)[1], 18 - bob), P['a'])
    # 머리
    x0, x1 = X(-2, 4); c.box(x0, 4 - bob, x1, 9 - bob, P)
    gx = X(2, 4); c.rect(gx[0], 6 - bob, gx[1], 7 - bob, P['g'])
    # 장비(측면)
    k = t['kit']
    if k == 'antenna':
        px = X(-1, -1)[0]; c.rect(px, 1 - bob, px, 4 - bob, P['e']); c.put(px, 0 - bob, P['g'])
    elif k == 'cannon':
        a, b = X(-4, 3); c.box(min(a, b), 5 - bob, max(a, b), 8 - bob, P)
        gx = X(3, 5); c.rect(gx[0], 6 - bob, gx[1], 7 - bob, P['g'])
    elif k == 'shield':
        a, b = X(1, 3); c.box(min(a, b), 11 - bob, max(a, b), 21 - bob, P)

def draw_hound(c, t, d, f):
    """4족: 앞뒤는 정면/후면 사다리꼴 몸통과 네 발, 옆은 가로 몸통."""
    P = t['p']; bob = 1 if f != 1 else 0
    if d in ('down', 'up'):
        c.box(6, 12 - bob, 17, 21 - bob, P)
        c.box(8, 8 - bob, 15, 13 - bob, P)
        if d == 'down': c.rect(9, 10 - bob, 14, 11 - bob, P['g']); c.rect(10, 12 - bob, 13, 12 - bob, P['e'])
        else: c.rect(9, 15 - bob, 14, 16 - bob, P['d']); c.rect(10, 18 - bob, 13, 18 - bob, P['g'])
        for i, x in enumerate((5, 9, 13, 17)):
            lift = 2 if (f == 0 and i in (0, 3)) or (f == 2 and i in (1, 2)) else 0
            c.box(x, 21 - lift, x + 2, 29 - lift, P)
            c.box(x - 1, 29 - lift, x + 3, 30 - lift, P)
        c.box(3, 12 - bob, 5, 15 - bob, P); c.box(18, 12 - bob, 20, 15 - bob, P)
    else:
        s = 1 if d == 'right' else -1
        def X(a, b):
            p, q = 12 + s * a, 12 + s * b; return min(p, q), max(p, q)
        a, b = X(-8, 6); c.box(a, 12 - bob, b, 20 - bob, P)
        a, b = X(4, 10); c.box(a, 9 - bob, b, 15 - bob, P)
        a, b = X(8, 10); c.rect(a, 11 - bob, b, 12 - bob, P['g'])
        a, b = X(-11, -8); c.box(a, 13 - bob, b, 16 - bob, P)
        for i, xo in enumerate((-8, -4, 1, 5)):
            sw = {0: -2, 1: 0, 2: 2}[f] * (1 if i % 2 == 0 else -1)
            lift = 1 if sw > 0 else 0
            a, b = X(xo + sw, xo + sw + 2); c.box(a, 20 - lift, b, 28 - lift, P)
            a, b = X(xo + sw - 1, xo + sw + 3); c.box(min(a, b), 28 - lift, max(a, b), 30 - lift, P)

def render():
    sheet = Image.new('RGBA', (288, 256), (0, 0, 0, 0))
    for ci, t in enumerate(TYPES):
        ox, oy = (ci % 4) * 72, (ci // 4) * 128
        for d, row in DIR_ROW.items():
            for f in range(3):
                c = Cell()
                if t['kit'] == 'quad': draw_hound(c, t, d, f)
                elif d == 'down': draw_front(c, t, f, False)
                elif d == 'up': draw_front(c, t, f, True)
                else: draw_side(c, t, f, d)
                for (x, y), col in c.px.items():
                    sheet.putpixel((ox + f * 24 + x, oy + row * 32 + y), (*col, 255))
    return sheet

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'mech-charset.png'
    render().save(out)
    print(out)
