"""scout_afterimage: 잔상 회피. Hollow scan-line afterimages of the scout slide out to both sides behind speed lines and a flash ring.
Run this file to regenerate the strip (python3 + Pillow, coordinates only)."""
import math

from PIL import Image

from lib_scout import *

KEY, SIZE, FRAMES, ANCHOR = 'scout_afterimage', 64, 8, 'user'
PAL = pal(pick(SHADOW, 'd', 'm', 'v', 'l'), pick(FROST, 'i2', 'i3'), WHITE)
FEET = 56
# QA 2026-09-28: 잔상은 막대 인형(머리 원 + 사다리꼴 몸)이라 실제 정찰병 칩과 체형이 달랐다.
# 정찰병 전투 시트(actor4-0, 손도트 원본 출력)의 idle 칸 알파 윤곽만 가져와 같은 몸으로 잔상을 찍는다.
# 색은 쓰지 않는다 — 윤곽선/주사선 규칙은 그대로다. 발 y=44 → 이펙트 발 FEET, 몸 가운데 x=24 → 인자 x.
_SHEET = ROOT / 'public/assets/generated/charset-battlers/actor4-0.png'
_IDLE = Image.open(_SHEET).convert('RGBA').crop((0, 0, 48, 48)).getchannel('A')
_BODY = [(x - 24, y - 44) for y in range(48) for x in range(48) if _IDLE.getpixel((x, y))]


def ghost(c, x, edge, fill, f, dither=False):
    """Scout silhouette (the real idle outline) drawn as an outline with scan-line fill."""
    m = Cel(c.n, {'a': '#ffffff'})
    for dx, dy in _BODY:
        m.px(x + dx, FEET + dy, 'a')
    a = m.im.getchannel('A').load()
    n = c.n
    for yy in range(n):
        for xx in range(n):
            if not a[xx, yy]:
                continue
            edge_px = any(not (0 <= xx + dx < n and 0 <= yy + dy < n and a[xx + dx, yy + dy])
                          for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge_px:
                if not dither or (xx + yy + f) % 2 == 0:
                    c.px(xx, yy, edge)
            elif fill and (yy + f) % 2 == 0 and not dither:
                c.px(xx, yy, fill)


def speed(c, f, xs):
    for i, y in enumerate((24, 30, 36, 42, 48)):
        x = xs[i % len(xs)] + (f * 3) % 5
        c.line([(x, y), (x + 5 + i % 3, y)], 'l' if i % 2 else 'i3')


def draw(c, f):
    if f == 0:
        speed(c, f, (6, 12, 4, 10, 8))
        for i, y in enumerate((26, 34, 44)):
            c.line([(50 + i * 2, y), (58, y)], 'l')
        c.oval(32, FEET, 12, 3, 'v', 1)
    elif f == 1:
        ghost(c, 22, 'i3', 'i2', f)
        speed(c, f, (4, 8, 2))
        c.spark(32, 22, 3, 'w', 'l')
    elif f == 2:
        ghost(c, 19, 'i3', 'i2', f)
        ghost(c, 45, 'v', 'm', f)
        speed(c, f, (2, 6, 4))
    elif f == 3:
        ghost(c, 17, 'i3', 'i2', f)
        ghost(c, 49, 'v', 'm', f)
        ghost(c, 25, 'v', None, f)
    elif f == 4:
        ghost(c, 16, 'i2', 'd', f)
        ghost(c, 51, 'm', 'd', f)
        c.oval(32, 38, 19, 24, 'l', 1)
        for x, y in [(32, 12), (13, 38), (51, 38), (32, 62)]:
            c.spark(x, y, 3, 'w', 'l')
    elif f == 5:
        ghost(c, 15, 'i2', None, f, dither=True)
        ghost(c, 52, 'm', None, f, dither=True)
        c.dring(32, 38, 22, 'l', squash=1.25)
    elif f == 6:
        c.arc(32, 38, 20, 200, 330, 'i3', 1, squash=1.3)
        c.arc(32, 40, 16, 20, 150, 'i2', 1, squash=1.3)
        c.dring(32, 38, 26, 'v', squash=1.2)
        c.spark(14, 26, 2, 'w', 'i3')
        c.spark(50, 48, 2, 'w', 'l')
    elif f == 7:
        for x, y in [(12, 20), (52, 30), (20, 52), (46, 14)]:
            c.spark(x, y, 1, 'l')
        c.arc(32, 38, 23, 250, 300, 'i2', 1, squash=1.3)


if __name__ == '__main__':
    run(globals())

