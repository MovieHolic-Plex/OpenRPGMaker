# 비행선 16변형 오토타일 셋 (칸 번호 = 위 1 + 오른쪽 2 + 아래 4 + 왼쪽 8, 왼쪽 위 칸이 0):
#   deck_edge — 하늘 위에 칠하는 갑판 널 + 가장자리(북: 밝은 턱, 서: 빛 받는 모, 동: 그늘 모, 남: 놋쇠 띠 두른 갑판 두께). 바깥은 투명.
#   rail      — 갑판 난간(위층, 막힘): 놋쇠 손잡이 띠 + 나무 난간동자, 끝·모서리 놋쇠 머리 기둥.
#   pipe      — 기관실 놋쇠 관(위층, 막힘): 곧은 관·꺾인 관·세 갈래·네 갈래 이음, 끝은 손바퀴 밸브.
from as_kit import *
from as_kit import _hash

def fin_nb(im, N, E, S, W, k=.62):
    """pz.fin 과 같은 윤곽이지만 이웃이 이어지는 쪽 칸 경계는 윤곽으로 치지 않는다(이음매에 검은 줄이 안 생기게)."""
    p = im.load(); W_, H_ = im.size; edge = []
    for y in range(H_):
        for x in range(W_):
            if p[x, y][3] < 200: continue
            for dx, dy in ((0, 1), (1, 0), (-1, 0), (0, -1)):
                xx, yy = x + dx, y + dy
                if xx < 0 and W or xx >= W_ and E or yy < 0 and N or yy >= H_ and S: continue
                if not (0 <= xx < W_ and 0 <= yy < H_) or p[xx, yy][3] < 200: edge.append((x, y)); break
    for x, y in edge:
        r, g, b, a = p[x, y]; p[x, y] = (int(r * k), int(g * k), min(255, int(b * k * 1.1)), a)
    return im

def deck_edge_cell(m, N, E, S, W, tex=None, X0=0, Y0=0):
    """tex(X, Y) = 널 화소(전역 좌표). 지도에서는 칸 전역 좌표로, 시트에서는 시트 좌표로 부른다."""
    tex = tex or (lambda X, Y: deck_px(X % 48, Y % 48))
    im = new(); p = im.load()
    for y in range(T):
        for x in range(T):
            # 둥근 바깥 모서리
            if not N and not W and x + y < 2: continue
            if not N and not E and (15 - x) + y < 2: continue
            if not S and not W and x + (15 - y) < 1: continue
            if not S and not E and (15 - x) + (15 - y) < 1: continue
            c = tex(X0 + x, Y0 + y)
            if not N:
                if y == 0: c = WD[6]
                elif y == 1: c = mix(c, WD[6], .35)
            if not W:
                if x == 0: c = WD[5] if y > 0 or N else c
                elif x == 1: c = mix(c, WD[6], .25)
            if not E:
                if x == 15: c = WD[1]
                elif x == 14: c = mul(c, .8)
            if not S:                                                               # 갑판 두께: 놋쇠 띠 + 나무 앞면
                if y == 12: c = BR[6] if x < 12 or E else BR[5]
                elif y == 13: c = BR[4]
                elif y == 14: c = WD[3]
                elif y == 15: c = WD[1]
                if y >= 12 and not E and x == 15: c = WD[1]
            p[x, y] = tuple(c[:3]) + (255,)
    return im

def deck_edge_sheet():
    sh = new(64, 64)
    for n in range(16):
        N, E, S, W = bool(n & 1), bool(n & 2), bool(n & 4), bool(n & 8)
        X0, Y0 = n % 4 * T, n // 4 * T
        sh.alpha_composite(deck_edge_cell(n, N, E, S, W, None, X0, Y0), (X0, Y0))
    return sh

def rail_cell(m, N, E, S, W):
    """갑판 난간(위층, 막힘). 가로 = 놋쇠 손잡이 띠(윗면 2행) + 나무 띠 + 4px 마다 깎은 난간동자 + 아래 띠, 세로 = 위에서 본 손잡이 띠,
    끝·모서리·외톨이 = 놋쇠 머리 단 네모 기둥."""
    cv = Cv(16, 16)
    hz = E or W; vt = N or S
    if hz:
        xa = 0 if W else 6; xb = 16 if E else 10
        for x in range(xa, xb):
            lx = x % 4
            for y in range(7, 13):
                hw = {7: 0, 8: 1, 9: 1, 10: 0, 11: 1, 12: 1}[y]
                if abs(lx - 1.5) <= hw + .5: cv.px(x, y, WD[6] if lx < 1 else (WD[4] if lx < 3 else WD[2]))
            cv.px(x, 13, WD[4]); cv.px(x, 14, WD[2])
            cv.px(x, 2, BR[6]); cv.px(x, 3, BR[5]); cv.px(x, 4, BR[3])
            cv.px(x, 5, WD[5]); cv.px(x, 6, WD[2])
    if vt:
        ya = 0 if N else 5; yb = 16 if S else 10
        for y in range(ya, yb):
            cv.px(6, y, BR[6]); cv.px(7, y, BR[5]); cv.px(8, y, BR[4]); cv.px(9, y, WD[3]); cv.px(10, y, WD[1])
            if y % 6 == 3: cv.px(7, y, BR[6]); cv.px(8, y, BR[6])
    straight = (m == 10) or (m == 5)
    if not straight:
        for y in range(1, 15):
            for x in range(5, 11):
                if y < 4: c = BR[6] if (y == 1 or x == 5) else (BR[5] if x < 9 else BR[3])
                else: c = WD[5] if x < 7 else (WD[4] if x < 9 else WD[2])
                if y == 14: c = WD[1]
                cv.px(x, y, c)
        cv.px(6, 0, BR[5]); cv.px(7, 0, BR[6]); cv.px(8, 0, BR[4])
    return fin_nb(cv.im, N, E, S, W, .62)

def rail_sheet(): return autotile_sheet(rail_cell)

def pipe_cell(m, N, E, S, W):
    """놋쇠 관(바닥 위·벽 따라). 가로 관 = 행마다 명암(위 밝음), 세로 관 = 열마다 명암(왼쪽 밝음), 이음 칸 = 쇠 볼트 박은 네모 이음쇠,
    끝(이웃 하나) = 붉은 손바퀴 밸브, 외톨이 = 세운 밸브 기둥."""
    cv = Cv(16, 16)
    def hseg(x0, x1):
        for x in range(x0, x1):
            for y in range(5, 12):
                k = {5: 4, 6: 6, 7: 5, 8: 5, 9: 4, 10: 3, 11: 2}[y]
                cv.px(x, y, BR[k])
            cv.px(x, 12, (40, 28, 20))
    def vseg(y0, y1):
        for y in range(y0, y1):
            for x in range(5, 12):
                k = {5: 4, 6: 6, 7: 5, 8: 5, 9: 4, 10: 3, 11: 2}[x]
                cv.px(x, y, BR[k])
    if W: hseg(0, 9)
    if E: hseg(7, 16)
    if N: vseg(0, 9)
    if S: vseg(7, 16)
    for (has, xs) in ((W, (0, 1)), (E, (14, 15))):                                   # 칸 이음 테(가로)
        if has:
            for x in xs:
                for y in range(4, 13): cv.px(x, y, BR[5] if x == xs[0] else BR[2])
    for (has, ys) in ((N, (0, 1)), (S, (14, 15))):
        if has:
            for y in ys:
                for x in range(4, 13): cv.px(x, y, BR[5] if y == ys[0] else BR[2])
    n_nb = sum((N, E, S, W)); straight = m in (5, 10)
    if n_nb >= 2 and not straight:                                                  # 이음쇠
        for y in range(4, 13):
            for x in range(4, 13):
                k = 6 if (y == 4 or x == 4) else (5 if x < 10 else 3)
                if y == 12: k = 2
                cv.px(x, y, BR[k])
        for (x, y) in ((5, 5), (11, 5), (5, 11), (11, 11)): cv.px(x, y, I7[2])
    if n_nb == 1:                                                                   # 끝 밸브
        cx, cy = 8, 8
        ring(cv, cx, cy, 5.5, 4.6, 1.5, lambda x, y, dx, dy: RD[4] if dx + dy < 0 else RD[2])
        line(cv, cx - 4, cy, cx + 4, cy, RD[3]); line(cv, cx, cy - 4, cx, cy + 4, RD[3])
        cv.px(cx, cy, BR[6])
    if n_nb == 0:
        for y in range(4, 15):
            for x in range(6, 11): cv.px(x, y, BR[clamp(cyl_k(x, 6, 11), 1, 6)])
        ring(cv, 8, 5, 5.5, 3, 1.4, lambda x, y, dx, dy: RD[4] if dx < 0 else RD[2])
        cv.px(8, 5, BR[6])
    return fin_nb(cv.im, N, E, S, W, .65)

def pipe_sheet(): return autotile_sheet(pipe_cell)
