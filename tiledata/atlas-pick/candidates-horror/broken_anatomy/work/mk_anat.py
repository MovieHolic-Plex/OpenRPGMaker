import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'portrait_eyes', 'work'))
from h1_lib import Canvas
NOTES = {
 'A': "A: 과학실 인체 반신 모형 — 왼쪽 반은 살결(bisque), 오른쪽 반은 근육 붉은 덩이와 장기 점(초록·노랑). 오른팔은 어깨 단면(뼈 한 점)만 남고 팔은 받침대 발치에 누웠다. 오른쪽 눈알은 빈 구멍. 받침대는 쇠(tin).",
 'B': "B: 왼쪽 위 빛 — 살결 쪽 이마·어깨·팔이 밝고 근육 쪽은 깊은 그림자에 잠겨 하이라이트만 젖은 듯 반짝. 구멍 눈과 빠진 어깨 단면이 어둠으로 뚜렷. 발치 오른쪽에 반투명 접촉 그림자.",
 'C': "C: 실루엣 재해석 — 머리가 오른쪽으로 갸웃 기울고 남은 왼팔이 지나치게 길어 손끝이 발등까지 닿는다. 빠진 어깨는 크게 벌어진 구멍. 어긋난 곳은 긴 팔과 기운 목.",
}
def half(x, cx=8): return x < cx
def skin(c, x, y, lit, kind):
    s = 4 + lit
    if kind == 'B': s = 5 if x < 5 else 4
    c.px(x, y, f'bisque:{max(0,min(6,s))}')
def musc(c, x, y, kind):
    s = 3 if ((x + y) % 3) else 2
    if kind == 'B': s = 2 if ((x + y) % 3) else 1
    c.px(x, y, f'blood:{s}')
def fill(c, x0, x1, y, kind, cx=8):
    for x in range(x0, x1 + 1):
        (skin(c, x, y, 0, kind) if x < cx else musc(c, x, y, kind))
def build(kind):
    c = Canvas('broken_anatomy', 16, 32)
    tilt = 1 if kind == 'C' else 0
    cx = 8
    # 받침대
    for x in range(2, 13): c.px(x, 29, 'tin:4' if kind != 'B' or x < 6 else 'tin:3'); c.px(x, 30, 'tin:3' if x < 7 else 'tin:2'); c.px(x, 31, 'tin:1')
    for x in range(3, 12): c.px(x, 29, 'tin:5')
    # 다리 y=23..28
    for y in range(23, 29):
        for x in range(5, 8): skin(c, x, y, -1 if y > 26 else 0, kind); 
        for x in range(8, 11): musc(c, x, y, kind)
        c.px(7, y, 'bisque:2'); c.px(8, y, 'blood:1')
    for x in range(4, 8): c.px(x, 28, 'bisque:3')
    for x in range(8, 12): c.px(x, 28, 'blood:1')
    # 골반 y=21..22
    for y in (21, 22): fill(c, 5, 10, y, kind)
    # 몸통 y=12..20
    for y in range(12, 21):
        t = (y - 12)
        x0 = 3 + min(2, t // 3); x1 = 12 - min(2, t // 3)
        fill(c, x0, x1, y, kind)
        c.px(x0, y, 'bisque:2' if x0 < cx else 'blood:1'); c.px(x1, y, 'blood:1')
    # 근육 결 (오른쪽) + 장기 점
    for y in range(13, 20, 2):
        for x in range(9, 12): c.px(x, y, 'blood:4' if kind != 'B' else 'blood:3')
    c.px(10, 14, 'vgreen:3'); c.px(11, 15, 'vgreen:2'); c.px(10, 17, 'vyellow:3'); c.px(9, 18, 'vgreen:3'); c.px(11, 19, 'vyellow:2')
    c.px(9, 15, 'blood:5') 
    # 가운데 세로 이음선
    for y in range(12, 24): c.px(cx - 1 if y < 21 else 7, y, 'bisque:1') if False else None
    # 배꼽/가슴 하이라이트
    c.px(5, 14, f'bisque:{6 if kind=="B" else 5}'); c.px(6, 14, 'bisque:5'); c.px(5, 15, 'bisque:5')
    # 목
    for y in (10, 11):
        for x in range(6 + tilt, 10 + tilt): (skin(c, x, y, -1, kind) if x < cx + tilt else musc(c, x, y, kind))
    # 머리 y=1..9
    hx = cx + tilt
    for y in range(1, 10):
        dy = (y + .5 - 5.5) / 4.6
        w = int(round(3.6 * (1 - dy * dy) ** .5 + .4))
        for x in range(hx - w, hx + w):
            (skin(c, x, y, 0, kind) if x < hx else musc(c, x, y, kind))
    # 머리 윤곽/턱
    for y in range(1, 10):
        pass
    # 눈: 왼쪽 눈(살결 쪽) 있음, 오른쪽 눈 빈 구멍
    ey = 5
    c.px(hx - 3, ey, 'sheet:6'); c.px(hx - 2, ey, 'sheet:6'); c.px(hx - 2, ey, 'void:1'); c.px(hx - 3, ey - 1, 'bisque:2')
    c.px(hx - 3, ey, 'sheet:5'); c.px(hx - 2, ey, 'void:0')
    c.px(hx + 1, ey, 'void:0'); c.px(hx + 2, ey, 'void:0'); c.px(hx + 1, ey - 1, 'blood:0'); c.px(hx + 2, ey + 1, 'blood:1')
    # 입/코
    c.px(hx - 1, 6, 'bisque:2'); c.px(hx - 1, 8, 'blood:0'); c.px(hx, 8, 'blood:0'); c.px(hx - 2, 8, 'bisque:1')
    c.px(hx, 6, 'blood:1'); c.px(hx - 1, 7, 'bisque:3')
    # 왼팔(살결) — 보는 사람 기준 왼쪽
    alen = 12 if kind != 'C' else 17
    for y in range(13, 13 + alen):
        if y > 28: break
        xa = 2 if y < 25 else 1
        for dx in range(2):
            c.px(xa + dx - (1 if y > 16 else 0), y, 'bisque:5' if (dx == 0 and kind == 'B') else ('bisque:4' if dx == 0 else 'bisque:3'))
    yy = min(28, 13 + alen - 1)
    c.px(0 if alen > 3 else 1, yy, 'bisque:2'); c.px(1, yy, 'bisque:2')
    # 오른쪽 어깨 단면
    for y in range(12, 16):
        for x in range(12, 15):
            if kind == 'C' and y in (13, 14) : c.px(x, y, 'void:0')
    if kind != 'C':
        c.px(12, 13, 'blood:1'); c.px(13, 13, 'blood:4'); c.px(13, 14, 'blood:3'); c.px(12, 14, 'blood:5'); c.px(13, 15, 'blood:2')
        c.px(13, 14, 'paper:5'); c.px(13, 13, 'blood:5')
    else:
        c.px(12, 12, 'blood:1'); c.px(12, 15, 'blood:1'); c.px(13, 12, 'blood:2'); c.px(13, 15, 'blood:2'); c.px(14, 13, 'blood:1'); c.px(14, 14, 'blood:1'); c.px(13, 13, 'paper:5'); c.px(13, 14, 'paper:4')
    # 떨어진 오른팔 (받침대 발치, 바닥)
    for x in range(9, 16):
        c.px(x, 30, 'bisque:4' if x > 10 else 'bisque:3'); c.px(x, 31, 'bisque:2')
    for x in range(9, 12): c.px(x, 30, 'blood:3'); c.px(x, 31, 'blood:1')
    c.px(9, 30, 'paper:5'); c.px(15, 30, 'bisque:5'); c.px(15, 31, 'bisque:3'); c.px(14, 29, 'bisque:4'); c.px(15, 29, 'bisque:3')
    # 마무리 윤곽(살결 쪽 진한 언저리, 오른쪽·아래 한 단 어둡게)
    c.px(2, 8, None)
    if kind == 'B':
        for y in range(12, 29):
            if c.get(13, y) is None and y > 15: c.px(13, y, '~')
        for x in range(2, 14):
            if c.get(x, 31) == 'tin:1' and x > 11: pass
        for y in range(16, 29):
            if c.get(12, y) is None: c.px(12, y, '-')
    # 위 모서리·아래 모서리 확인(위쪽은 비어 있음)
    return c
if __name__ == '__main__':
    for k in 'ABC': build(k).save(f'h1-{k}', NOTES[k])
    print('ok')
