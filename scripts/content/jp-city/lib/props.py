"""소품 v2 — 자판기·자전거를 확대해서 직접 설계. modern3 램프만. 윤곽은 재질 최암색."""
import os, sys, math
import jpenv
from modern_style_bible_proof import K, Cv

def vending2(c, x, base, body='aka', alt=None):
    """자판기 20×30: 윗면 T=5 + 앞면 F=25. 상품 창(병 모양 3단), 가격표, 버튼 패널, 취출구, 하단 킥판. 빛은 왼쪽 위."""
    W = 20; T = 5; F = 25; y = base - T - F
    OUT = K(body, 0)
    # 윗면
    c.R(x + 1, y, W - 1, T, K('conc', 1)); c.HL(x + 1, y, W - 2, K('conc', 3)); c.VL(x + 1, y, T, K('conc', 2)); c.R(x + 1, y + T - 2, W - 1, 2, K('conc', 0)); c.R(x + 4, y + 1, 8, 1, K('conc', 2))
    c.HL(x, y - 0, 1, OUT) 
    c.VL(x + W, y + 1, T + F - 1, K('hodo', -1))                                           # 오른쪽 어두운 옆 (허용 1px)
    # 앞면
    fy = y + T
    c.R(x, fy, W, F, K(body, 1)); c.VL(x, fy, F, K(body, 3)); c.VL(x + 1, fy, F, K(body, 2)); c.VL(x + W - 1, fy, F, K(body, -1)); c.VL(x + W - 2, fy, F, K(body, 0))
    c.HL(x, fy, W, K(body, 0)); c.HL(x, fy + 1, W, K(body, 2))                              # 상단 띠
    # 로고 띠
    c.R(x + 3, fy + 2, 11, 3, K('shiro', 3)); c.HL(x + 3, fy + 2, 11, K('shiro', 4)); c.R(x + 5, fy + 3, 3, 1, K(body, 2)); c.R(x + 9, fy + 3, 3, 1, K(body, 2))
    # 상품 창 (14×11) : 어두운 안쪽, 선반 3단, 병
    wx, wy, ww, wh = x + 3, fy + 6, 11, 11
    c.R(wx - 1, wy - 1, ww + 2, wh + 2, K('tekko', -3)); c.R(wx, wy, ww, wh, K('tekko', -1))
    c.R(wx, wy, ww, 1, K('tekko', 1))                                                       # 조명
    cols = ['sora', 'kii', 'midori', 'aka', 'daidai', 'sora', 'kii', 'midori', 'aka', 'daidai', 'sora', 'kii']
    for row in range(3):
        sy = wy + 2 + row * 3
        for k in range(4):
            cx = wx + 1 + k * 3; cc = cols[row * 4 + k]
            c.R(cx, sy, 2, 3, K(cc, 2)); c.VL(cx, sy, 3, K(cc, 4)); c.P(cx + 1, sy + 2, K(cc, 0)); c.P(cx, sy - 1, K('shiro', 3))   # 병: 뚜껑 + 몸통(왼쪽 빛)
        c.HL(wx, sy + 3, ww, K('tekko', 1)) if row < 2 else None                            # 선반
    for k in range(5): c.P(wx + 1 + k * 2, wy + wh - 1, K('shiro', 4)) if False else None
    # 유리 반사 (대각 2줄)
    # 가격표 (병 아래 4개 흰 라벨 + 빨강 점)
    for k in range(4): c.R(wx + 1 + k * 3, wy + wh + 0, 2, 1, K('shiro', 3)) if False else None
    # 오른쪽 패널: 버튼 3개 + 동전구
    px = x + 15
    for k in range(3): c.R(px, wy + 1 + k * 3, 3, 2, K('shiro', 3) if k != 1 else K('kii', 3)); c.HL(px, wy + 2 + k * 3, 3, K('tekko', 1))
    c.R(px, wy + 10, 3, 1, K('tekko', -2))
    # 취출구 + 경첩
    c.R(x + 3, fy + 19, 12, 5, K('tekko', -3)); c.R(x + 4, fy + 20, 10, 3, K('tekko', -1)); c.HL(x + 4, fy + 19, 10, K('tekko', 0)); c.R(x + 5, fy + 18, 8, 1, K(body, 3))
    # 킥판
    c.R(x, fy + F - 2, W, 2, K('tekko', 0)); c.HL(x, fy + F - 1, W, K('tekko', -2))
    # 바닥 그림자 (오른쪽·아래)
    for i in range(W + 3): c.P(x + 1 + i, base, K('hodo', -2)); c.P(x + 2 + i, base + 1, K('hodo', -1)) if i % 1 == 0 else None

def bike2(c, x, base, frame='sora'):
    """자전거 26×16 (마마차리). 닫힌 바퀴(타이어 2px·림·살·허브), 낮은 프레임, 흙받이, 앞바구니(철망), 안장, 핸들, 체인케이스, 스탠드, 바닥 그림자."""
    R = 5.2
    def wheel(cx, cy):
        for j in range(-7, 8):
            for i in range(-7, 8):
                d = math.hypot(i + 0.0, j + 0.0)
                if 4.4 <= d <= 5.6: c.P(cx + i, cy + j, K('tekko', -3))                     # 타이어
                elif 3.2 <= d < 4.4: c.P(cx + i, cy + j, K('tekko', 4) if (i + j) % 2 == 0 else K('shiro', 1))   # 림
        for a in range(0, 8):                                                              # 살
            ang = a * math.pi / 4
            for r in (1, 2, 3): c.P(cx + int(round(r * math.cos(ang))), cy + int(round(r * math.sin(ang))), K('tekko', 3) if a % 2 == 0 else K('tekko', 1))
        c.P(cx, cy, K('tekko', 5)); c.P(cx + 1, cy, K('tekko', 0)); c.P(cx, cy + 1, K('tekko', 0))
    rx, fx, cy = x + 5, x + 20, base - 6
    wheel(rx, cy); wheel(fx, cy)
    FR = lambda t: K(frame, t - 2)
    # 흙받이 (바퀴 위 호)
    for dx in range(-6, 7):
        yy = cy - int(math.sqrt(max(0, 6.6 ** 2 - dx ** 2)))
        c.P(rx + dx, yy, FR(2)); c.P(fx + dx, yy, FR(2))
        if dx in (-6, -5): c.P(rx + dx, yy + 1, FR(0)); 
    # 프레임: 낮은 앞 포크 + 시트튜브 + 낮은 탑튜브(스텝스루) + 체인스테이
    def line(x0, y0, x1, y1, col):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1): c.P(int(round(x0 + (x1 - x0) * k / n)), int(round(y0 + (y1 - y0) * k / n)), col)
    line(rx, cy, x + 10, cy - 6, FR(2)); line(x + 10, cy - 6, fx - 2, cy - 4, FR(2)); line(fx - 2, cy - 4, fx, cy, FR(1)); line(rx, cy, x + 12, cy, FR(1))
    line(x + 12, cy, x + 14, cy - 1, FR(1))
    line(x + 10, cy - 6, x + 10, cy - 9, FR(3))                                            # 안장 기둥
    c.R(x + 8, cy - 11, 5, 2, K('tekko', -3)); c.HL(x + 8, cy - 11, 5, K('tekko', 1))        # 안장
    line(fx - 1, cy - 4, fx - 1, cy - 10, FR(3)); line(fx - 1, cy - 10, fx - 3, cy - 11, K('tekko', 3)); c.R(fx - 5, cy - 12, 4, 1, K('tekko', 4)) # 핸들
    for (px_, py_) in ((x + 10, cy - 9),): c.P(px_ - 1, py_, K('tekko', -3))
    # 바구니 (앞): 철망 사각
    bx = fx + 1
    c.R(bx, cy - 11, 6, 5, K('tekko', -2)); c.HL(bx, cy - 11, 6, K('tekko', 3)); c.R(bx + 1, cy - 10, 4, 3, K('tekko', -1))
    for k in (1, 3, 5): c.VL(bx + k, cy - 10, 4, K('tekko', 2))
    c.HL(bx, cy - 6, 6, K('tekko', 0))
    # 체인케이스 + 짐받이
    c.R(x + 8, cy - 3, 6, 3, FR(0)); c.HL(x + 8, cy - 3, 6, FR(2))
    c.HL(x + 0, cy - 7, 6, K('tekko', 2)); c.P(x + 0, cy - 6, K('tekko', 1))
    # 스탠드
    line(x + 5, cy + 1, x + 3, cy + 5, K('tekko', 1)) if False else None
    # 바닥 그림자
    for i in range(-6, 28): c.P(x + i + 2, base, K('hodo', -2)) if 0 <= i + 2 <= 28 else None
    for i in range(0, 26): c.P(x + i + 2, base + 1, K('hodo', -1)) if i % 2 == 0 else None
