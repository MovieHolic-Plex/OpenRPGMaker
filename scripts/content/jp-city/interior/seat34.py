"""seats34 — 일본 실내 의자 3/4 다시 그리기에 쓰는 작은 부품(블록 파일들이 같이 쓴다).

규칙(interior-props-quality-rubric-1): 빛은 왼위 — 수평 윗면이 가장 밝고, 앞면은 가운데 단, 오른쪽·아래 테가 어둡다.
윤곽은 재질의 가장 어두운 단(또는 OL)을 바깥 실루엣에만, 안쪽은 재질 단 1px 이음으로 나눈다. 다리는 2px.
c = ikit Cv(P·R·HL·VL), m = 램프 이름, t = 단.
"""
from ikit import K


def ol(c, x, y, w, h, col):
    c.HL(x, y, w, col); c.HL(x, y + h - 1, w, col); c.VL(x, y, h, col); c.VL(x + w - 1, y, h, col)


def plane(c, x, y, w, h, m, t):
    """수평 윗면: 바탕 t, 맨 윗줄·왼 테 t+1, 오른 테 t-1."""
    c.R(x, y, w, h, K(m, t)); c.HL(x, y, w, K(m, t + 1)); c.VL(x, y, h, K(m, t + 1)); c.VL(x + w - 1, y + 1, h - 1, K(m, t - 1))


def face(c, x, y, w, h, m, t):
    """세로 앞면: 바탕 t, 왼 테 t+1, 오른 테·밑줄 t-1."""
    c.R(x, y, w, h, K(m, t)); c.VL(x, y, h, K(m, t + 1)); c.VL(x + w - 1, y, h, K(m, t - 1)); c.HL(x + 1, y + h - 1, w - 1, K(m, t - 1))


def leg(c, x, y, h, m, t=0):
    """2px 다리: 왼 열 밝게, 오른 열 두 단 어둡게, 발끝 한 단 더."""
    c.VL(x, y, h, K(m, t)); c.VL(x + 1, y, h, K(m, t - 2)); c.P(x, y + h - 1, K(m, t - 1)); c.P(x + 1, y + h - 1, K(m, t - 3))


def ell(cx, cy, rx, ry, W=16, H=48):
    return {(x, y) for y in range(H) for x in range(W) if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1}


def edge_of(S, x, y):
    return any((x + dx, y + dy) not in S for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))


def round_seat(c, cx, cy, rx, ry, side, m, t, olc):
    """둥근 방석: 아래로 side 행 두께 면(t-1, 오른쪽 t-2) + 윗면 타원(t, 왼위 t+1·t+2), 윤곽 olc 는 바깥에만."""
    top = ell(cx, cy, rx, ry)
    body = set(top)
    for (x, y) in top:
        for k in range(1, side + 1): body.add((x, y + k))
    for (x, y) in body:
        if (x, y) in top: continue
        c.P(x, y, K(m, t - 2) if x + .5 > cx + rx * .45 else K(m, t - 1))
    for (x, y) in top:
        d = (x + .5 - cx) / rx * .7 + (y + .5 - cy) / ry * .8
        c.P(x, y, K(m, t + 2) if d < -.75 else K(m, t + 1) if d < -.2 else K(m, t))
    for (x, y) in body:
        if edge_of(body, x, y): c.P(x, y, olc)
    for (x, y) in top:                                                          # 윗면 앞 가장자리 선(두께 면과 갈림)
        if (x, y + 1) not in top and (x, y + 1) in body and not edge_of(body, x, y): c.P(x, y, K(m, t + 1))


def round_base(c, cx, cy, rx, ry, m, t, olc):
    """둥근 받침: 윗면 밝게, 아래 반은 한 단 어둡게, 바깥 윤곽."""
    S = ell(cx, cy, rx, ry)
    for (x, y) in S:
        c.P(x, y, olc if edge_of(S, x, y) else (K(m, t + 1) if y + .5 < cy else K(m, t - 1)))


def silhouette(c, col, x0=0, y0=0, x1=None, y1=None):
    """바깥 윤곽: (x0,y0)~(x1,y1) 안의 불투명 화소 중 투명(또는 캔버스 밖)과 맞닿은 것을 col 로 — 안쪽 부품 사이에는 선을 긋지 않는다."""
    import numpy as np
    a = c.a; H, W = a.shape[:2]
    x1 = W if x1 is None else x1; y1 = H if y1 is None else y1
    op = a[:, :, 3] > 0
    hits = []
    for y in range(y0, y1):
        for x in range(x0, x1):
            if not op[y, x]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if not (0 <= xx < W and 0 <= yy < H) or not op[yy, xx]: hits.append((x, y)); break
    for (x, y) in hits: c.P(x, y, col)
