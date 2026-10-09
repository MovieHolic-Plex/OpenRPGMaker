# 녹청 지붕 크림 석조 저택·타운하우스 조립 — 지붕(vq_roof) + 층(vq_wall.storey) + 다락창·굴뚝·차양·발코니. 결정적.
# 3/4 시점: 지붕 윗면(뒤 경사·앞 경사·양 끝) + 앞벽. 옆벽 없음(측면은 박공 끝·모임지붕 끝 삼각으로 보인다).
# 처마선: 지붕 아래 코니스(4px) 바로 밑이 맨 위층 위(장르 공통 층 32). 1층 맨 아래 8px 는 누른 받침돌.
from vq_base import *
from vq_base import _h
import vq_wall as WL, vq_roof as RF

def house(wc, floors, roof_h=44, ends='LR', dormers=(), chimneys=(), seed=1, awn=None, balc=None, yb=.3,
          quoin=(True, True), gable=None, cornice=True):
    """wc 칸 폭 집. floors = 위층부터 층 문자열 목록(맨 끝이 1층). dormers = [(x 중심 px, kind)], chimneys = [(x, h, kind)].
    awn = (x0, x1) 1층 차양 범위(px). balc = (층 번호(위에서 0), x0, x1) 쇠 발코니. gable = (x0, w, G) 앞 박공(교차 박공)."""
    W = wc * 16; ns = len(floors)
    top_pad = max([h for (_, h, _) in chimneys] + [0])
    Hh = top_pad + roof_h + ns * 32
    pen = Pen(W, Hh)
    ry = top_pad
    wall_top = ry + roof_h
    for i, kinds in enumerate(floors):                                       # 층(위→아래)
        WL.storey(pen, 0, wall_top + i * 32, kinds, seed=seed + i * 17, ground=(i == ns - 1), quoin=quoin)
        if 0 < i: WL.course(pen, 0, W, wall_top + i * 32 - 1)
    if balc:
        fi, bx0, bx1 = balc; WL.balcony(pen, bx0, bx1, wall_top + (fi + 1) * 32 - 3, 8)
    if awn:
        WL.awning(pen, awn[0], awn[1], wall_top + (ns - 1) * 32 + 2, 7, seed)
    roof = RF.roof_hip(W, roof_h, ends=ends, yb=yb, seed=seed)
    pen.paste(roof.im, 0, ry)
    if cornice:                                                              # 처마 코니스(지붕 바로 아래, 벽 위 그늘)
        WL.course(pen, 0, W, wall_top, deep=True)
        WL.wall_shadow(pen, 0, W, wall_top + 4, 3, (.62, .74, .88))
    for (cx, h, kind) in chimneys:                                           # 굴뚝(지붕 뒤 경사에서 솟는다)
        ch = RF.chimney(h + int(roof_h * yb) + 2, 10, kind, seed + cx)
        pen.paste(ch, cx - 6, ry + int(roof_h * yb) + 2 - ch.height + 2)
    if gable:
        gx0, gw, G = gable
        gf = RF.gable_front(gw, 6, G, seed=seed + 3)
        pen.paste(gf.im, gx0, wall_top - G - 6 + 4)
    for (cx, kind) in dormers:                                               # 다락창(앞 경사, 처마선 위)
        d = RF.dormer(kind, 14 if kind != 'wide' else 20, 22 if kind != 'round' else 16, seed + cx)
        pen.paste(d, cx - d.width // 2, wall_top - d.height + 1)
    # 맨 아래 받침 앞모 그늘
    for x in range(W): pen.p(x, Hh - 1, PLIN, 1)
    return fin(pen.im, .66)

def turret(wc=2, floors=3, cone_h=34, seed=1, kinds='w'):
    """둥근 모퉁이 탑: 원통 벽(크림 마름돌을 가로로 눌러 원통 음영 — 왼쪽 빛, 오른쪽 그늘), 층마다 좁은 창, 원뿔 녹청 지붕."""
    W = wc * 16; Hh = cone_h + floors * 32; pen = Pen(W, Hh); cx = W / 2.0
    sub = Pen(W, floors * 32)
    for i in range(floors):
        WL.ashlar(sub, 0, i * 32, W, i * 32 + 32, seed=seed + i * 5, lens=(6, 8, 7))
    for y in range(floors * 32):
        for x in range(W):
            d = (x + .5 - cx) / cx
            c = sub.g(x, y)
            if not c[3]: continue
            k = 1.08 - .12 * (d + .4) - (.25 if abs(d) > .86 else 0)
            pen.c(x, cone_h + y, mul(c, k))
    for i in range(floors):
        yt = cone_h + i * 32
        WL.window(pen, int(cx) - 3, yt + 4, 6, 11, kinds[i % len(kinds)], seed + i)
        if i > 0:
            for x in range(W): pen.p(x, yt - 1, TRIM, 5 if x < cx else 3); pen.p(x, yt, TRIM, 3)
    for x in range(W):
        for j in range(8): pen.c(x, Hh - 8 + j, mul(ramp_fit(PLIN[4], PLIN), 1.0 - .12 * ((x + .5 - cx) / cx + .4)) if j < 7 else PLIN[1])
    c = RF.cone(W + 4, cone_h + 4, seed)
    pen.paste(c.im, -2, 0)
    WL.wall_shadow(pen, 0, W, cone_h + 3, 2, (.62, .8))
    return fin(pen.im, .66)

def compose(*items, size=None):
    """(그림, x, y) 를 아래부터 겹친다."""
    W = max(x + im.width for im, x, y in items); Hh = max(y + im.height for im, x, y in items)
    if size: W, Hh = size
    o = Image.new('RGBA', (W, Hh))
    for im, x, y in items: o.alpha_composite(im, (x, y))
    return o
