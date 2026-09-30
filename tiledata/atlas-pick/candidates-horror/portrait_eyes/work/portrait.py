import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from h1_lib import Canvas

def frame_rect(c, x0, y0, x1, y1, lit=True):
    """액자: 바깥 윤곽 1 + 띠 1 (왼·위 밝게, 오른·아래 어둡게), 모서리 한 칸 깎음."""
    for x in range(x0, x1 + 1):
        for y in range(y0, y1 + 1):
            edge = x in (x0, x1) or y in (y0, y1)
            if not edge: continue
            c.px(x, y, 'tarn:0')
    for x in range(x0 + 1, x1):
        c.px(x, y0 + 1, 'tarn:5' if lit else 'tarn:4'); c.px(x, y1 - 1, 'tarn:2')
    for y in range(y0 + 1, y1):
        c.px(x0 + 1, y, 'tarn:5' if lit else 'tarn:4'); c.px(x1 - 1, y, 'tarn:2')
    c.px(x1 - 1, y0 + 1, 'tarn:3'); c.px(x0 + 1, y1 - 1, 'tarn:3'); c.px(x1 - 1, y1 - 1, 'tarn:1')
    for (x, y) in ((x0, y0), (x1, y0), (x0, y1), (x1, y1)):
        c.px(x, y, None)
    c.px(x0 + 1, y0, 'tarn:0'); c.px(x0, y0 + 1, 'tarn:0')

def portrait(c, kind):
    """kind: 'A' 낡음 / 'B' 빛 구조 / 'C' 재해석. 캔버스 안쪽 그림을 그린다(액자는 따로)."""
    if kind in 'AB':
        x0, y0, x1, y1 = (2, 2, 13, 29) if kind == 'A' else (2, 2, 11, 27)
        w = x1 - x0 + 1; cx = (x0 + x1 + 1) / 2.0
        c.rect(x0, y0, x1, y1, 'velv:1')
        # 등 뒤 희미한 빛(다마스크 자주)
        c.ell(cx, y0 + 11, w * .5, 9, 'damask:1', pred=lambda x, y: y >= y0)
        c.ell(cx, y0 + 11, w * .33, 6.5, 'damask:2', pred=lambda x, y: y >= y0) if kind == 'A' else None
        # 머리카락
        hy = y0 + 10
        c.ell(cx, hy, 5.3, 8.4, 'void:1', pred=lambda x, y: y >= y0 + 2)
        c.rect(int(cx - 5), hy + 2, int(cx - 4), hy + 12, 'void:1'); c.rect(int(cx + 4), hy + 2, int(cx + 5), hy + 12, 'void:1')
        # 어깨·옷
        for i, y in enumerate(range(y1 - 7, y1 + 1)):
            hw = 3 + i * (w / 2 - 3) / 7.0
            c.hline(int(cx - hw), int(cx + hw - 1), y, 'damask:2')
        for y in range(y1 - 7, y1 + 1):
            for x in range(x0, x1 + 1):
                if c.get(x, y) == 'damask:2' and x >= cx: c.px(x, y, 'damask:1')
        # 목
        c.rect(int(cx - 1), y1 - 9, int(cx), y1 - 6, 'bisque:3')
        c.hline(int(cx - 1), int(cx), y1 - 8, 'bisque:2')
        # 옷깃
        for i in range(3):
            c.px(int(cx - 2 - i + 1), y1 - 6 + i, 'paper:5'); c.px(int(cx + 1 + i - 1), y1 - 6 + i, 'paper:3')
        # 얼굴
        fy = y0 + 11
        c.ell(cx, fy, 3.8, 5.3, 'bisque:4', pred=lambda x, y: True)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if c.get(x, y) in ('bisque:4',):
                    if x >= cx + 2: c.px(x, y, 'bisque:3')
                    elif x <= cx - 3 and y < fy + 2: c.px(x, y, 'bisque:5')
        # 앞머리
        c.hline(int(cx - 3), int(cx + 2), fy - 5, 'void:1'); c.hline(int(cx - 4), int(cx + 3), fy - 4, 'void:1')
        c.px(int(cx - 4), fy - 3, 'void:1'); c.px(int(cx + 3), fy - 3, 'void:1'); c.px(int(cx - 3), fy - 3, 'void:1'); c.px(int(cx + 2), fy - 3, 'void:1')
        c.px(int(cx), fy - 3, 'void:1'); c.px(int(cx - 1), fy - 3, 'void:1') if kind == 'A' else None
        c.px(int(cx - 3), fy - 5, 'void:3'); c.px(int(cx - 2), fy - 5, 'void:3'); c.px(int(cx - 4), fy - 4, 'void:3')
        # 눈: 하얀 흰자 + 어두운 눈동자 (어둠 속에서도 읽히게)
        ex1, ex2, ey = int(cx - 3), int(cx + 1), fy - 1
        for ex, inner in ((ex1, 1), (ex2, 0)):
            c.hline(ex, ex + 1, ey - 1, 'bisque:2')      # 눈두덩 그림자
            c.rect(ex, ey, ex + 1, ey + 1, 'dust:6')
            c.vline(ex + inner, ey, ey + 1, 'void:0')
        c.hline(ex1, ex1 + 1, ey + 2, 'bisque:3'); c.hline(ex2, ex2 + 1, ey + 2, 'bisque:3')  # 눈 밑 그늘
        # 코, 입
        c.px(int(cx), fy + 2, 'bisque:3'); c.px(int(cx), fy + 3, 'bisque:2')
        c.hline(int(cx - 1), int(cx), fy + 4, 'blood:2')
        c.px(int(cx - 1), fy + 5, 'bisque:3')
        if kind == 'A':
            # 낡음: 캔버스 금 + 얼룩 + 먼지 + 도금 벗겨짐
            for (x, y) in ((12, 3), (12, 4), (13, 5), (13, 6), (12, 7)): c.px(x, y, 'paper:2')
            for (x, y) in ((3, 25), (4, 26), (3, 27), (5, 27), (4, 28), (10, 28)): c.px(x, y, 'hmoss:1')
            c.px(2, 20, 'velv:0'); c.px(2, 21, 'velv:0')
            for x in (4, 5, 9, 10, 13): c.px(x, 1, 'dust:3')
            c.px(3, 1, 'dust:5'); c.px(8, 1, 'dust:4')
            for (x, y) in ((1, 9), (1, 10), (14, 22), (1, 23), (6, 30)): c.px(x, y, 'rot:3')
            c.px(14, 6, 'tarn:1'); c.px(2, 29, 'tarn:1')
        return
    # C: 타원 액자에 얼굴이 너무 길고 눈이 너무 크다
    cx = 8.0
    c.ell(cx, 16, 7.3, 15.3, 'velv:1'); c.ell(cx, 15, 5.0, 10, 'damask:1')
    c.ell(cx, 14, 4.6, 11.8, 'void:1', pred=lambda x, y: y < 27)
    c.ell(cx, 15, 3.4, 8.7, 'bisque:4')
    for y in range(32):
        for x in range(16):
            if c.get(x, y) == 'bisque:4':
                if x >= 10: c.px(x, y, 'bisque:3')
                elif x <= 5 and y < 17: c.px(x, y, 'bisque:5')
    c.hline(5, 10, 5, 'void:1'); c.hline(6, 9, 6, 'void:1')
    # 눈이 크고, 하나가 더 아래
    for (ex, ey, big) in ((5, 11, 3), (9, 13, 3)):
        c.rect(ex, ey - 1, ex + 1, ey - 1, 'bisque:2')
        c.rect(ex, ey, ex + 1, ey + 3, 'dust:6')
        c.vline(ex if ex == 9 else ex + 1, ey + 1, ey + 3, 'void:0')
    c.px(8, 17, 'bisque:3'); c.px(8, 18, 'bisque:2')
    c.hline(6, 10, 22, 'blood:1'); c.hline(6, 10, 23, 'void:0')
    for x in (6, 8, 10): c.vline(x, 21, 24, 'wax:5')   # 꿰맨 입
    c.rect(7, 25, 8, 27, 'bisque:3')

def build(kind, slashed=False):
    c = Canvas('portrait_slashed' if slashed else 'portrait_eyes', 16, 32)
    if kind == 'A':
        portrait(c, 'A'); frame_rect(c, 0, 0, 15, 31)
        # 액자는 그림 위에 얹는다: 그림이 액자 칸을 넘지 않으므로 겹침 없음
    elif kind == 'B':
        portrait(c, 'B'); frame_rect(c, 0, 0, 13, 29)
        # 안쪽 캔버스가 x2..11,y2..27 이므로 액자 안쪽 칸과 맞음(액자 띠 1칸 안쪽 = 1)
    else:
        portrait(c, 'C')
        # 타원 액자
        for y in range(32):
            for x in range(16):
                dx = (x + .5 - 8) / 8.0; dy = (y + .5 - 16) / 16.0
                d = dx * dx + dy * dy
                if 0.86 < d <= 1.0:
                    ring = 'tarn:0' if d > .95 else ('tarn:5' if (x < 8 and y < 16) else ('tarn:2' if (x >= 8 and y >= 16) else 'tarn:4'))
                    c.px(x, y, ring)
        c.ell(8, 16, 8, 16, 'tarn:0', pred=lambda x, y: False)
    return c
