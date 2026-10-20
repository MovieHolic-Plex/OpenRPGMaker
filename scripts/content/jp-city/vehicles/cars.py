"""jp_city 움직이는 승용·경차·택시·소형 트럭 — 손 도트(numpy). 계약: SPEC.md

옆모습(right/left) 은 L×16 폭 × 56(3/4 깊이판, 2026-10-20), 앞·뒷모습(down/up) 은 32 폭 × (L×16+16).
down = 남쪽으로 달려 차 앞면이 보인다(위부터 트렁크·뒷유리·지붕·앞유리·보닛·앞 얼굴·바닥 그림자).
up   = 북쪽으로 달려 차 뒷면이 보인다(위부터 보닛·앞유리·지붕·뒷유리·트렁크·뒤 얼굴·바닥 그림자).
윗면은 옆·앞 면보다 한 단 밝고, 몸체 왼쪽 끝 1px 밝게·오른쪽 끝 1px 어둡게(빛은 왼쪽 위).
번호판은 글자 없는 작은 직사각형(일반 흰색, 경차 노란색). 상표·실제 회사 도색 없음.
"""
from parts_vehicles import CAR_BODY2, _arch, _wheel
from parts_tokyo import *          # noqa: F401,F403  (Cv, K, RAMPS)
from v2core import ink2

W = 32


# ── 공통 ────────────────────────────────────────────────────────────────

def _tone(ramp, t):
    """차체 색 단: bod(옆·앞 면) top(윗면, 한 단 밝음) topE(가장 밝은 윗면) lo dk."""
    mx = 2 if len(RAMPS[ramp]) == 5 else 3
    t = min(t, mx - 2)                     # 2026-10-20: 옆면을 한 단 낮춰 지붕·보닛·트렁크 윗면(t+1, t+2)이 옆면과 확실히 갈린다
    return dict(bod=K(ramp, t), top=K(ramp, t + 1), topE=K(ramp, t + 2), lo=K(ramp, t - 1), dk=K(ramp, t - 2))


CAR_TONE = dict(CAR_BODY2, black=('tekko', -1), silver=('conc', 0))   # 은색은 흰색보다 어둡고 차갑게
KEI_TONE = {'yellow': ('kii', 1), 'mint': ('lino', 1)}


def _stack(H, segs, foot=2):
    """segs=[(이름, 높이)] 를 아래(H-1-foot)에 맞춰 위로 쌓는다 → {이름: (y0, h)}."""
    y = H - 1 - foot - sum(h for _, h in segs)
    out = {}
    for n, h in segs:
        out[n] = (y, h); y += h
    return out


def _row_edges(c, y, h, x0, x1, light, dark):
    """폭 x0..x1-1 의 띠 왼쪽 끝을 밝게, 오른쪽 끝을 어둡게."""
    c.VL(x0, y, h, light); c.VL(x1 - 1, y, h, dark)


def _trap(c, y, h, top0, top1, bot0, bot1, col_fn):
    """사다리꼴(위 폭 top0..top1, 아래 폭 bot0..bot1). col_fn(j, x0, x1) → 행 색(또는 행 그리기 함수)."""
    for j in range(h):
        f = j / max(1, h - 1)
        x0 = round(top0 + (bot0 - top0) * f); x1 = round(top1 + (bot1 - top1) * f)
        col_fn(j, y + j, x0, x1)


def _glass_rows(c, y, h, x0, x1, sky=2, bright=True):
    """유리 띠: 위 sky 줄은 하늘 반사(밝음), 아래로 갈수록 어둡다."""
    for j in range(h):
        if bright and j < sky: col = K('garasu', 3 if j == 0 else 2)
        elif j >= h - 2: col = K('garasu', -2)
        else: col = K('garasu', -1)
        c.HL(x0, y + j, x1 - x0, col)


def _tires(c, y, h, x0, x1, w=3):
    """아래 모서리 바퀴 끝(2~3px). 바깥 열 어둡게, 안쪽 열 고무 빛."""
    for x in (x0, x1 - w):
        c.R(x, y, w, h, K('sumi', 0))
        c.VL(x + (1 if x == x0 else w - 2), y, max(1, h - 2), K('sumi', 2))


def _side_glass(c, y, h, cx0, cx1, T, pillar=None):
    """객실 양옆 옆창(2px, 어두운 유리) — 지붕을 어깨와 떼어 '차'로 읽히게 한다. 가운데 B 기둥."""
    for x in (cx0 - 2, cx1):
        c.R(x, y, 2, h, K('garasu', -1)); c.VL(x if x < cx0 else x + 1, y, h, K('garasu', 0 if x < cx0 else -2))
        for py in (pillar or (y + h // 2,)): c.R(x, py, 2, 2, T['bod'])


def _chamfer(c, y, x0, x1, down=True):
    """몸체 끝 모서리를 2단 깎아 벽돌이 아니라 둥근 차 끝으로."""
    for j, n in ((0, 2), (1, 1)):
        yy = y + j if down else y - j
        for k in range(n): c.a[yy, x0 + k, 3] = 0; c.a[yy, x1 - 1 - k, 3] = 0


def _cabin_frame(c, y, h, cx0, cx1, T, mirror_y=None):
    """객실(옆창 바깥) 양쪽 1px 어두운 테 + 앞유리 밑동의 사이드 미러(몸체 밖 2px)."""
    c.VL(cx0 - 3, y, h, T['lo']); c.VL(cx1 + 2, y, h, T['dk'])
    if mirror_y is not None:
        c.R(0, mirror_y, 2, 2, T['bod']); c.P(0, mirror_y, T['top']); c.R(30, mirror_y, 2, 2, T['lo'])


def _shadow(c, y, x0, x1):
    c.R(x0, y, x1 - x0, 2, K('sumi', 0))


def _plate(c, x, y, kei=False):
    """글자 없는 번호판 6×3 (흰색 / 경차 노란색). 위 줄 밝게, 둘레는 잉크가 잡는다."""
    if kei: c.R(x, y, 6, 3, K('kii', 1)); c.HL(x, y, 6, K('kii', 2)); c.HL(x + 1, y + 1, 4, K('kii', 2))
    else: c.R(x, y, 6, 3, K('shiro', 1)); c.HL(x, y, 6, K('shiro', 2)); c.HL(x + 1, y + 1, 4, K('shiro', 2))


def _headlights(c, y, x0, x1, w=6, h=3):
    for x in (x0 + 1, x1 - 1 - w):
        c.R(x, y, w, h, K('shiro', 1)); c.HL(x, y, w, K('shiro', 2)); c.R(x + 1, y, 2, 1, K('kii', 2))
        c.HL(x, y + h - 1, w, K('garasu', 1))


def _taillights(c, y, x0, x1, w=5, h=3):
    for x in (x0 + 1, x1 - 1 - w):
        c.R(x, y, w, h, K('aka', 0)); c.HL(x, y, w, K('aka', 1)); c.HL(x, y + h - 1, w, K('aka', -1))
        c.P(x + (1 if x == x0 + 1 else w - 2), y, K('aka', 2))


def _done(c):
    return ink2(c).a


# ── 옆모습 공통(3/4: 위에서 보이는 윗면 띠 + 남쪽 옆면) ─────────────────────
# 행 좌표는 48 높이 캔버스 기준. 보닛·트렁크 윗면 DY..DF-1, 접힘선 DF, 아래 몸체 옆면 BY0..BY1.
DY, DF, BY0, BY1 = 21, 29, 30, 40       # 2026-10-20 깊이: 보닛·트렁크 윗면 7→8줄(지붕은 7→10줄), 보닛은 옆창 가운데보다 낮게


def _lerp(a, b, f):
    return round(a + (b - a) * f)


def _deck(c, x0, x1, y, h, T, fold=True):
    """윗면 띠(x0..x1-1, y..y+h-1): 먼 끝 줄 topE, 왼쪽 위로 밝은 쐐기, 오른쪽 끝 한 단 어둡게, 아래 접힘선 lo."""
    c.R(x0, y, x1 - x0, h, T['top'])
    for j in range(h): c.HL(x0, y + j, max(0, (x1 - x0) // 2 - 3 * j), T['topE'])
    c.HL(x0 + 1, y, x1 - x0 - 2, T['topE'])
    c.VL(x1 - 1, y + 1, h - 1, T['bod'])
    if fold: c.HL(x0, y + h, x1 - x0, T['lo'])
    c.a[y, x0, 3] = 0; c.a[y, x1 - 1, 3] = 0


def _side(c, T, bx0, bx1, rx0, rx1, tx, fx, RY, RF, pillars=(), seams=(), handles=(), trunk=True, bonnet=True, deck_y=None):
    """승용·경차 옆모습 몸체. 지붕 윗면 rx0..rx1 (행 RY..RF-1, 접힘 RF), 옆 유리 띠 RF+1..DF,
    앞유리 = 지붕 앞 끝 rx1 에서 보닛 뒤 끝 fx 로 내려오는 평행사변형, 뒷유리 = rx0 → 트렁크 앞 끝 tx."""
    g1, g2, g0, ghi = K('garasu', -1), K('garasu', -2), K('garasu', 0), K('garasu', 1)
    dy = DY if deck_y is None else deck_y                                       # 보닛 윗면 먼 끝(앞유리 아래 끝이 여기서 만난다)
    # 아래 몸체 옆면
    c.R(bx0, BY0, bx1 - bx0, BY1 - BY0 + 1, T['bod'])
    c.HL(bx0 + 1, BY0 + 1, bx1 - bx0 - 2, T['top'])                              # 어깨선
    c.R(bx0, BY0 + 5, bx1 - bx0, 2, T['lo'])                                     # 허리 띠
    c.HL(bx0, BY1, bx1 - bx0, T['dk'])                                           # 문턱
    c.VL(bx0, BY0 + 1, BY1 - BY0, T['top']); c.VL(bx1 - 1, BY0 + 1, BY1 - BY0, T['lo'])
    for x in seams: c.VL(x, BY0, BY1 - BY0, T['dk'])
    for x in handles: c.HL(x, BY0 + 2, 3, T['dk'])
    # 옆 유리 띠(남쪽 옆면 위쪽): 뒤 기둥·A 기둥이 비스듬하다
    for y in range(RF + 1, DF + 1):
        f = (y - RF) / (DF - RF)
        xl = _lerp(rx0, tx, f); xr = _lerp(rx1, fx, f)
        c.HL(xl, y, xr - xl + 1, T['bod'])
        if RF + 2 <= y <= DF - 1:
            c.HL(xl + 2, y, xr - xl - 3, g2 if y >= DF - 2 else g1)
    for p in pillars: c.R(p, RF + 1, 2, DF - RF, T['bod']); c.VL(p + 1, RF + 2, DF - RF - 2, T['lo'])
    for sx in [_lerp(rx0, tx, 1 / (DF - RF)) + 2] + [p + 2 for p in pillars]:  # 창마다 1~2px 하늘 반사
        c.HL(sx, RF + 2, 2, K('garasu', 3))
        for k in range(min(4, DF - RF - 3)): c.P(sx + 2 + k, RF + 2 + k, K('garasu', 2))
    # 앞유리(위를 향해 기운 면): 먼 끝 → 가까운 끝(A 기둥)
    for x in range(rx1 + 1, fx + 1):
        s = (x - rx1) / max(1, fx - rx1)
        yf = _lerp(RY, dy, s); yn = _lerp(RF, DF, s)
        for y in range(yf, yn + 1):
            k = y - yf
            c.P(x, y, T['bod'] if y == yn else ghi if k == 1 and s < .6 else g0 if k <= 2 else g1)
    # 뒷유리
    for x in range(tx, rx0):
        s = (rx0 - x) / max(1, rx0 - tx)
        yf = _lerp(RY, DY, s); yn = _lerp(RF, DF, s)
        for y in range(yf, yn + 1):
            c.P(x, y, T['bod'] if y == yn else g0 if y - yf == 1 else g1 if y - yf < 3 else g2)
    # 윗면 띠: 지붕·보닛·트렁크
    _deck(c, rx0, rx1 + 1, RY, RF - RY, T)
    if bonnet and bx1 - fx > 3: _deck(c, fx + 1, bx1, dy, DF - dy, T)
    if trunk and tx - bx0 >= 3: _deck(c, bx0, tx, DY, DF - DY, T)
    if bonnet and bx1 - fx > 3: c.a[dy, fx + 1, 3] = 255; c.a[dy, fx + 1, :3] = c.a[dy, fx + 2, :3]   # 앞유리-보닛 이음 틈 메움
    if trunk and tx - bx0 >= 3: c.a[DY, tx - 1, 3] = 255; c.a[DY, tx - 1, :3] = c.a[DY, tx - 2, :3]
    if not trunk:                                                                # 뒤 기둥(D 필러): 바깥 실루엣에 유리가 드러나지 않게
        for y in range(RY + 1, DF + 1):
            for x in range(bx0, bx0 + 2):
                if c.a[y, x, 3]: c.P(x, y, T['top'] if x == bx0 else T['bod'])
    # 등화·그림자
    c.R(bx1 - 3, BY0 + 1, 3, 3, K('kii', 2)); c.P(bx1 - 1, BY0 + 3, K('daidai', 1))
    c.R(bx0, BY0 + 1, 2, 3, K('aka', 1)); c.P(bx0, BY0 + 1, K('aka', 2))
    c.R(bx0 + 2, BY1 + 1, bx1 - bx0 - 4, 2, K('sumi', 0))


def _wheels(c, xs):
    for x in xs: _arch(c, x, BY1 - 1, 6, None); _wheel(c, x, BY1, 5)


# ── 옆모습 3/4 깊이판(2026-10-20 감독: 「옆 입면도」 반려) ───────────────────────
# 56 높이 캔버스(발자국 = 아래 32줄). 행 비율: 지붕 윗면 ≈35% · 보닛/트렁크 윗면 6줄 · 옆면 ≈35%(한 단 어둡다) ·
# 바퀴는 치마 밑으로 아래 절반만. 앞유리·뒷유리는 지붕 끝에서 보닛/트렁크 먼 끝으로 비스듬히 내려오는 면.
H34 = 56
R_Y, R_F = 7, 23            # 지붕 윗면 줄(먼 가장자리 · 가까운 접힘)
D_Y, D_F = 24, 29           # 보닛·트렁크 윗면 줄(6) · 옆창 띠도 이 줄
B_Y0, B_Y1 = 30, 46         # 옆면 17줄
W_Y = 47                    # 바퀴 중심(아래 절반 47..53 만 보인다)


def _roof34(c, x0, x1, y0, y1, T):
    """지붕 윗면: 밝은 면 + 왼쪽 위 부드러운 반사(체커 가장자리) + 먼 가장자리 밝은 테, 가까운 접힘 어둡게, 네 귀 둥글게."""
    c.R(x0, y0, x1 - x0, y1 - y0, T['top'])
    span = (x1 - x0) + 2 * (y1 - y0)
    for y in range(y0, y1):                                                  # 왼쪽 위 → 오른쪽 아래로 옅어지는 반사(가장자리만 체커)
        for x in range(x0, x1):
            d = ((x - x0) + 2 * (y - y0)) / span
            if d < 0.30 or (d < 0.42 and (x + y) % 2 == 0): c.P(x, y, T['topE'])
    c.HL(x0 + 1, y0, x1 - x0 - 2, T['topE'])
    c.VL(x1 - 1, y0 + 1, y1 - y0 - 1, T['bod'])
    c.HL(x0, y1 - 1, x1 - x0, T['bod'])
    for (x, y) in ((x0, y0), (x1 - 1, y0)): c.a[y, x, 3] = 0


def _deck34(c, x0, x1, y0, y1, T, front=True):
    """보닛·트렁크 윗면: 밝은 면, 먼 가장자리 밝은 테, 바깥 끝 둥근 모서리, 가까운 접힘 어둡게."""
    c.R(x0, y0, x1 - x0, y1 - y0, T['top'])
    c.HL(x0, y0, x1 - x0, T['topE'])
    for j in range(y1 - y0 - 1): c.HL(x0, y0 + 1 + j, max(0, (x1 - x0) // 2 - 3 * j), T['topE'])
    c.HL(x0, y1 - 1, x1 - x0, T['lo'])
    ox = x1 - 1 if front else x0
    c.a[y0, ox, 3] = 0
    c.VL(ox, y0 + 1, y1 - y0 - 1, T['bod'] if front else T['top'])


def _side34(c, T, bx0, bx1, rx0, rx1, tx, fx, pillars=(), seams=(), handles=(), trunk=True, bonnet=True, dy=D_Y, ty=D_Y, ry=R_Y, wheels=()):
    g1, g2, g0, ghi = K('garasu', -1), K('garasu', -2), K('garasu', 0), K('garasu', 1)
    # 옆면(한 단 어둡다): 어깨 밝은 줄 · 허리 캐릭터 라인 · 아래 로커 어둡게
    c.R(bx0, B_Y0, bx1 - bx0, B_Y1 - B_Y0 + 1, T['bod'])
    c.HL(bx0 + 1, B_Y0 + 1, bx1 - bx0 - 2, T['top'])
    c.HL(bx0, B_Y0 + 7, bx1 - bx0, T['lo'])
    c.R(bx0, B_Y1 - 3, bx1 - bx0, 3, T['lo']); c.HL(bx0, B_Y1, bx1 - bx0, T['dk'])
    c.VL(bx0, B_Y0 + 1, B_Y1 - B_Y0 - 1, T['top']); c.VL(bx1 - 1, B_Y0 + 1, B_Y1 - B_Y0 - 1, T['lo'])
    for x in seams: c.VL(x, B_Y0 + 1, B_Y1 - B_Y0 - 4, T['dk'])
    for x in handles: c.HL(x, B_Y0 + 4, 3, T['dk'])
    c.R(bx1 - 4, B_Y0 + 2, 3, 3, K('kii', 2)); c.P(bx1 - 2, B_Y0 + 4, K('daidai', 1))       # 전조등(옆에서 보이는 끝)
    c.R(bx0 + 1, B_Y0 + 2, 2, 4, K('aka', 1)); c.P(bx0 + 1, B_Y0 + 2, K('aka', 2))         # 후미등
    c.R(bx1 - 6, B_Y0 + 10, 6, 2, K('tekko', 0)); c.R(bx0, B_Y0 + 10, 5, 2, K('tekko', 0))  # 범퍼 모서리
    for (x, y) in ((bx0, B_Y1), (bx1 - 1, B_Y1)): c.a[y, x, 3] = 0
    # 옆창 띠(남쪽 면 위쪽, D_Y..D_F): 뒤 기둥 → A 기둥이 비스듬하다
    for y in range(R_F + 1, D_F + 1):
        f = (y - R_F) / (D_F - R_F)
        xl = _lerp(rx0, tx, f); xr = _lerp(rx1, fx, f)
        c.HL(xl, y, xr - xl + 1, T['bod'])
        if R_F + 2 <= y <= D_F - 1: c.HL(xl + 2, y, xr - xl - 3, g2 if y >= D_F - 2 else g1)
    for p in pillars: c.R(p, R_F + 1, 2, D_F - R_F, T['bod']); c.VL(p + 1, R_F + 2, D_F - R_F - 2, T['lo'])
    for sx in [_lerp(rx0, tx, 0.2) + 3] + [p + 3 for p in pillars]: c.HL(sx, R_F + 2, 2, K('garasu', 3))
    # 앞유리: 지붕 앞 끝(rx1, ry..R_F) → 보닛 먼 끝(fx, dy..D_F). 비스듬히 본 유리면.
    for x in range(rx1, fx + 1):
        s_ = (x - rx1) / max(1, fx - rx1)
        yf = _lerp(ry, dy, s_); yn = _lerp(R_F, D_F, s_)
        for y in range(yf, yn + 1):
            k = y - yf
            c.P(x, y, T['bod'] if y == yn else ghi if (k == 1 and s_ < .5) else g0 if k <= 2 else g1)
        c.P(x, yf, T['lo'])
    # 뒷유리: 지붕 뒤 끝(rx0) → 트렁크 먼 끝(tx)
    for x in range(tx, rx0 + 1):
        s_ = (rx0 - x) / max(1, rx0 - tx)
        yf = _lerp(ry, ty, s_); yn = _lerp(R_F, D_F, s_)
        for y in range(yf, yn + 1):
            c.P(x, y, T['bod'] if y == yn else g0 if y - yf == 1 else g1 if y - yf < 4 else g2)
        c.P(x, yf, T['lo'])
    if not trunk:                                                            # 뒤 기둥(D 필러): 실루엣에 유리가 드러나지 않게
        for y in range(ry, D_F + 1):
            for x in range(bx0, min(bx0 + 2, rx0)):
                if c.a[y, x, 3]: c.P(x, y, T['top'] if x == bx0 else T['bod'])
    # 윗면들
    _roof34(c, rx0 + 1, rx1, ry, R_F + 1, T)
    if bonnet and bx1 - fx > 2: _deck34(c, fx + 1, bx1, dy, D_F + 1, T, True)
    if trunk and tx - bx0 > 2: _deck34(c, bx0, tx, ty, D_F + 1, T, False)
    # 휠 아치(한 색 어두운 홈) + 바닥 그림자
    for wx in wheels:
        for j in range(-7, 0):
            for i in range(-8, 9):
                if i * i + j * j <= 60: c.P(wx + i, W_Y + j, K('sumi', 1))
    c.R(bx0 + 3, B_Y1 + 1, bx1 - bx0 - 6, 2, K('sumi', 0))


def _done34(c, wheels, r=6):
    """잉크 뒤에 바퀴를 직접: 위 절반은 아치 그늘에 숨고 아래 절반만 치마 밑으로."""
    out = ink2(c)
    for wx in wheels:
        for j in range(-1, r + 1):
            for i in range(-r, r + 1):
                d2 = i * i + j * j
                if d2 > r * r + 1: continue
                col = K('sumi', 0) if d2 > (r - 1.4) ** 2 else K('tekko', -2) if d2 > 6 else K('conc', 1) if d2 > 1 else K('conc', -1)
                if j < 1 and d2 > 6: col = K('sumi', 0)
                out.P(wx + i, W_Y + j, col)
        out.P(wx - 1, W_Y, K('conc', 2))
    return out.a


def _sedan_side(tone, body='sedan', taxi=False):
    """80×56, 오른쪽 진행, 3/4 깊이판. 세단(트렁크 윗면) / 해치백(지붕이 뒤까지, 뒤 기둥)."""
    c = Cv(80, H34); T = _tone(*tone)
    if body == 'hatch':
        wh = (20, 62)
        _side34(c, T, 6, 76, 14, 48, 7, 61, pillars=(32,), seams=(32, 56), handles=(35, 20), trunk=False, wheels=wh)
    else:
        wh = (17, 62)
        _side34(c, T, 4, 76, 27, 48, 15, 61, pillars=(37,), seams=(22, 37, 58), handles=(40, 25), wheels=wh)
    if taxi:                                                                      # 행등: 지붕 위로 솟은 상자(윗면 3 + 남쪽 면 4), 글자 없음
        c.R(32, 3, 11, 3, K('shiro', 2)); c.R(32, 6, 11, 4, K('shiro', 0)); c.VL(32, 3, 7, K('shiro', 2))
        c.R(33, 7, 9, 2, K('aka', 1)); c.VL(42, 4, 6, K('conc', 0)); c.HL(33, 10, 10, K('kii', -1))
    return _done34(c, wh)


def _van_side(tone):
    """80×56 밴(정지 소품용): 지붕이 꽁무니까지 이어진 긴 상자 캐빈, 짧은 보닛."""
    c = Cv(80, H34); T = _tone(*tone)
    wh = (17, 62)
    _side34(c, T, 4, 76, 6, 52, 4, 65, pillars=(23, 38), seams=(23, 38, 63), handles=(41, 26), trunk=False, dy=25, ry=6, wheels=wh)
    return _done34(c, wh)


def _flip(fn):
    def g():
        a = fn().copy(); a[:] = a[:, ::-1]; return a
    return g


# ── 세단·택시 앞/뒤 ──────────────────────────────────────────────────────

def _sedan_down(tone, L=5, taxi=False):
    H = L * 16 + 16; c = Cv(W, H); T = _tone(*tone)
    bx0, bx1 = 2, 30; cx0, cx1 = 6, 26
    S = _stack(H, [('trunk', 8), ('rglass', 7), ('roof', 20), ('wind', 11), ('bonnet', 15), ('front', 14)])
    # 윗면 몸체(트렁크~보닛) 바탕
    y0 = S['trunk'][0]; y1 = S['front'][0]
    c.R(bx0, y0, bx1 - bx0, y1 - y0, T['top'])
    # 트렁크: 뒤 끝 접힘선
    y, h = S['trunk']; c.HL(bx0 + 1, y, bx1 - bx0 - 2, T['topE']); c.HL(bx0, y + h - 1, bx1 - bx0, T['bod'])
    # 뒷유리(어둡게, 지붕 쪽으로 좁아짐)
    y, h = S['rglass']
    _trap(c, y, h, cx0 - 1, cx1 + 1, cx0, cx1, lambda j, yy, a, b: c.HL(a, yy, b - a, K('garasu', -2 if j < h - 2 else -1)))
    # 지붕: 가장 밝은 띠
    y, h = S['roof']; c.R(cx0, y, cx1 - cx0, h, T['topE']); _row_edges(c, y, h, cx0, cx1, T['topE'], T['top'])
    c.HL(cx0, y, cx1 - cx0, T['top'])
    _side_glass(c, S['rglass'][0] + 2, S['wind'][0] + S['wind'][1] - 2 - S['rglass'][0] - 2, cx0, cx1, T)
    if taxi:
        ay = y + 9
        c.R(11, ay, 10, 4, K('shiro', 2)); c.HL(11, ay, 10, K('shiro', 2))
        c.R(11, ay + 4, 10, 3, K('shiro', 1)); c.R(12, ay + 5, 8, 1, K('aka', 1))
    # 앞유리: 위 2줄 하늘 반사, 보닛 쪽으로 넓어짐
    y, h = S['wind']
    _trap(c, y, h, cx0, cx1, cx0 - 2, cx1 + 2, lambda j, yy, a, b: c.HL(a, yy, b - a,
          K('garasu', 3) if j == 0 else K('garasu', 2) if j == 1 else K('garasu', -2) if j >= h - 2 else K('garasu', -1)))
    for j in range(3, 8): c.P(cx0 + 3 + j, y + j, K('garasu', 0))           # 비스듬한 빛줄
    # 보닛: 앞유리 밑 카울(어둡게)·앞 끝 밝게
    y, h = S['bonnet']; c.HL(bx0 + 1, y, bx1 - bx0 - 2, T['bod'])
    c.HL(bx0, y + h - 1, bx1 - bx0, T['topE'])
    for xx in (10, 21): c.VL(xx, y + 2, h - 4, T['topE'])                    # 보닛 주름
    _row_edges(c, S['trunk'][0] + 1, S['front'][0] - S['trunk'][0] - 1, bx0, bx1, T['topE'], T['bod'])
    cy = S['rglass'][0]; _cabin_frame(c, cy, S['bonnet'][0] - cy, cx0, cx1, T, mirror_y=S['wind'][0] + S['wind'][1] - 3)
    _chamfer(c, y0, bx0, bx1)
    # 앞 얼굴
    y, h = S['front']; c.R(bx0, y, bx1 - bx0, h, T['bod'])
    _headlights(c, y + 1, bx0, bx1)
    c.R(11, y + 1, 10, 4, K('tekko', -2)); c.HL(12, y + 2, 8, K('tekko', 0)); c.HL(12, y + 4, 8, K('tekko', -1))
    c.HL(bx0, y + 5, bx1 - bx0, T['lo'])                                       # 범퍼 윗선
    c.R(bx0, y + 6, bx1 - bx0, 4, T['bod']); c.HL(bx0, y + 6, bx1 - bx0, T['top'])
    _plate(c, 13, y + 6)
    for xx in (bx0 + 2, bx1 - 4): c.R(xx, y + 8, 2, 1, K('kii', 2))         # 안개등
    c.R(bx0 + 1, y + 10, bx1 - bx0 - 2, 4, K('tekko', -2)); c.HL(bx0 + 3, y + 11, bx1 - bx0 - 6, K('tekko', -1))
    _row_edges(c, y, 10, bx0, bx1, T['top'], T['dk'])
    _tires(c, y + 10, 5, bx0, bx1)
    _shadow(c, y + h, bx0 + 3, bx1 - 3)
    return _done(c)


def _sedan_up(tone, L=5, taxi=False):
    H = L * 16 + 16; c = Cv(W, H); T = _tone(*tone)
    bx0, bx1 = 2, 30; cx0, cx1 = 6, 26
    S = _stack(H, [('bonnet', 13), ('wind', 6), ('roof', 20), ('rglass', 10), ('trunk', 9), ('rear', 14)])
    y0 = S['bonnet'][0]; y1 = S['rear'][0]
    c.R(bx0, y0, bx1 - bx0, y1 - y0, T['top'])
    y, h = S['bonnet']; c.HL(bx0 + 1, y, bx1 - bx0 - 2, T['topE'])
    for xx in (10, 21): c.VL(xx, y + 2, h - 3, T['topE'])
    c.HL(bx0, y + h - 1, bx1 - bx0, T['bod'])
    y, h = S['wind']                                                             # 북쪽을 보는 앞유리: 얇고 어둡다
    _trap(c, y, h, cx0 - 1, cx1 + 1, cx0, cx1, lambda j, yy, a, b: c.HL(a, yy, b - a, K('garasu', -2)))
    y, h = S['roof']; c.R(cx0, y, cx1 - cx0, h, T['topE']); _row_edges(c, y, h, cx0, cx1, T['topE'], T['top'])
    c.HL(cx0, y + h - 1, cx1 - cx0, T['top'])
    _side_glass(c, S['wind'][0] + 1, S['rglass'][0] + S['rglass'][1] - 2 - S['wind'][0] - 1, cx0, cx1, T)
    if taxi:
        ay = y + 11
        c.R(11, ay, 10, 4, K('shiro', 2))
        c.R(11, ay + 4, 10, 3, K('shiro', 1)); c.R(12, ay + 5, 8, 1, K('aka', 1))
    y, h = S['rglass']                                                           # 남쪽을 보는 뒷유리: 넓고 위 2줄 반사
    _trap(c, y, h, cx0, cx1, cx0 - 1, cx1 + 1, lambda j, yy, a, b: c.HL(a, yy, b - a,
          K('garasu', 3) if j == 0 else K('garasu', 2) if j == 1 else K('garasu', -2) if j >= h - 2 else K('garasu', -1)))
    y, h = S['trunk']; c.HL(bx0 + 1, y, bx1 - bx0 - 2, T['bod']); c.HL(bx0, y + h - 1, bx1 - bx0, T['topE'])
    _row_edges(c, S['bonnet'][0] + 1, S['rear'][0] - S['bonnet'][0] - 1, bx0, bx1, T['topE'], T['bod'])
    cy = S['wind'][0]; _cabin_frame(c, cy, S['trunk'][0] - cy, cx0, cx1, T, mirror_y=S['wind'][0] + 1)
    _chamfer(c, y0, bx0, bx1)
    y, h = S['rear']; c.R(bx0, y, bx1 - bx0, h, T['bod'])
    c.HL(bx0 + 7, y + 4, bx1 - bx0 - 14, T['lo'])                               # 트렁크 뚜껑 선
    _taillights(c, y + 1, bx0, bx1, w=6)
    c.HL(bx0, y + 5, bx1 - bx0, T['lo'])
    c.R(bx0, y + 6, bx1 - bx0, 4, T['bod']); c.HL(bx0, y + 6, bx1 - bx0, T['top'])
    _plate(c, 13, y + 6)
    for xx in (bx0 + 2, bx1 - 4): c.R(xx, y + 8, 2, 1, K('aka', -1))          # 반사판
    c.R(bx0 + 1, y + 10, bx1 - bx0 - 2, 4, K('tekko', -2)); c.HL(bx0 + 3, y + 11, bx1 - bx0 - 6, K('tekko', -1))
    _row_edges(c, y, 10, bx0, bx1, T['top'], T['dk'])
    _tires(c, y + 10, 5, bx0, bx1)
    _shadow(c, y + h, bx0 + 3, bx1 - 3)
    return _done(c)


# ── 경차(하이트 왜건) ───────────────────────────────────────────────────

def _kei_side(color):
    """64×56(L=4), 오른쪽 진행, 3/4 깊이판. 높은 지붕이 꽁무니까지 · 짧고 낮은 보닛(윗면 4줄) · 창 셋 · 슬라이드 문."""
    c = Cv(64, H34); T = _tone(*KEI_TONE[color])
    wh = (14, 51)
    _side34(c, T, 4, 61, 6, 44, 4, 55, pillars=(17, 31), seams=(17, 31, 54), handles=(34, 19), trunk=False, dy=26, ry=5, wheels=wh)
    c.HL(19, B_Y0 + 6, 13, T['dk'])                                              # 슬라이드 레일
    return _done34(c, wh)


def _kei_down(color, L=4):
    H = L * 16 + 16; c = Cv(W, H); T = _tone(*KEI_TONE[color])
    bx0, bx1 = 3, 29
    S = _stack(H, [('roof', 22), ('wind', 14), ('bonnet', 6), ('front', 15)])
    y, h = S['roof']; c.R(bx0, y, bx1 - bx0, h, T['topE']); c.a[y, bx0, 3] = 0; c.a[y, bx1 - 1, 3] = 0
    c.HL(bx0 + 1, y, bx1 - bx0 - 2, T['top']); c.HL(bx0, y + h - 1, bx1 - bx0, T['top'])
    c.R(bx0, y + 3, 3, h - 3, T['bod']); c.R(bx1 - 3, y + 3, 3, h - 3, T['bod'])   # 옆창 두를 몸체 어깨
    _side_glass(c, y + 4, h - 5, bx0 + 4, bx1 - 4, T, pillar=(y + 4 + (h - 5) // 3, y + 4 + 2 * (h - 5) // 3))
    _row_edges(c, y + 1, h - 1, bx0, bx1, T['top'], T['dk'])
    y, h = S['wind']                                                             # 서 있는 큰 앞유리(좌우 기둥)
    c.R(bx0, y, bx1 - bx0, h, T['bod']); _row_edges(c, y, h, bx0, bx1, T['top'], T['dk'])
    _glass_rows(c, y + 1, h - 2, bx0 + 2, bx1 - 2)
    for j in range(4, 10): c.P(bx0 + 2 + j, y + j, K('garasu', 0))
    c.R(bx0 - 1, y + 3, 1, 3, T['lo']); c.R(bx1, y + 3, 1, 3, T['lo'])        # 거울
    y, h = S['bonnet']; c.R(bx0, y, bx1 - bx0, h, T['top']); c.HL(bx0, y + h - 1, bx1 - bx0, T['topE'])
    _row_edges(c, y, h, bx0, bx1, T['topE'], T['bod'])
    y, h = S['front']; c.R(bx0, y, bx1 - bx0, h, T['bod'])
    _headlights(c, y + 1, bx0, bx1, w=6, h=4)
    c.R(12, y + 2, 8, 2, K('tekko', -2)); c.HL(13, y + 2, 6, K('tekko', 0))
    c.HL(bx0, y + 6, bx1 - bx0, T['lo'])
    c.R(bx0, y + 7, bx1 - bx0, 3, T['bod'])
    _plate(c, 13, y + 7, kei=True)
    c.R(bx0 + 1, y + 10, bx1 - bx0 - 2, 5, K('tekko', -2)); c.HL(bx0 + 3, y + 11, bx1 - bx0 - 6, K('tekko', -1))
    _row_edges(c, y, 10, bx0, bx1, T['top'], T['dk'])
    _tires(c, y + 11, 5, bx0, bx1)
    _shadow(c, y + h, bx0 + 3, bx1 - 3)
    return _done(c)


def _kei_up(color, L=4):
    H = L * 16 + 16; c = Cv(W, H); T = _tone(*KEI_TONE[color])
    bx0, bx1 = 3, 29
    S = _stack(H, [('bonnet', 5), ('wind', 4), ('roof', 20), ('rglass', 12), ('rear', 17)])
    y, h = S['bonnet']; c.R(bx0, y, bx1 - bx0, h, T['top']); c.a[y, bx0, 3] = 0; c.a[y, bx1 - 1, 3] = 0
    c.HL(bx0 + 1, y, bx1 - bx0 - 2, T['topE'])
    y, h = S['wind']; c.R(bx0, y, bx1 - bx0, h, T['top']); c.R(bx0 + 2, y, bx1 - bx0 - 4, h, K('garasu', -2))
    y, h = S['roof']; c.R(bx0, y, bx1 - bx0, h, T['topE'])
    c.HL(bx0, y, bx1 - bx0, T['top']); c.HL(bx0, y + h - 1, bx1 - bx0, T['top'])
    c.R(bx0, y, 3, h, T['bod']); c.R(bx1 - 3, y, 3, h, T['bod'])
    _side_glass(c, y + 1, h - 2, bx0 + 4, bx1 - 4, T, pillar=(y + 1 + (h - 2) // 3, y + 1 + 2 * (h - 2) // 3))
    _row_edges(c, S['bonnet'][0] + 1, S['rglass'][0] - S['bonnet'][0] - 1, bx0, bx1, T['top'], T['dk'])
    y, h = S['rglass']                                                           # 뒷문 위 큰 네모 창
    c.R(bx0, y, bx1 - bx0, h, T['bod']); _row_edges(c, y, h, bx0, bx1, T['top'], T['dk'])
    _glass_rows(c, y + 1, h - 2, bx0 + 3, bx1 - 3)
    c.R(14, y, 4, 1, K('aka', 0))                                                # 보조 제동등
    y, h = S['rear']; c.R(bx0, y, bx1 - bx0, h, T['bod']); c.HL(bx0, y, bx1 - bx0, T['top'])
    for xx in (bx0 + 1, bx1 - 4): c.R(xx, y + 1, 3, 6, K('aka', 0)); c.VL(xx + (0 if xx == bx0 + 1 else 2), y + 1, 6, K('aka', 1)); c.HL(xx, y + 1, 3, K('aka', 2))
    c.HL(bx0 + 5, y + 7, bx1 - bx0 - 10, T['lo'])                              # 뒷문 아래 선
    _plate(c, 13, y + 3, kei=True)
    c.R(bx0 + 1, y + 9, bx1 - bx0 - 2, 3, T['lo'])
    c.R(bx0 + 1, y + 12, bx1 - bx0 - 2, 5, K('tekko', -2)); c.HL(bx0 + 3, y + 13, bx1 - bx0 - 6, K('tekko', -1))
    _row_edges(c, y, 12, bx0, bx1, T['top'], T['dk'])
    _tires(c, y + 13, 5, bx0, bx1)
    _shadow(c, y + h, bx0 + 3, bx1 - 3)
    return _done(c)


# ── 경트럭(흰색, 낮은 짐칸 난간) ─────────────────────────────────────────

WHITE = ('shiro', 1)


def _ktruck_side():
    """64×56(L=4), 오른쪽 진행, 3/4 깊이판. 위에서 보이는 짐칸 바닥(난간 셋) + 캡오버 캡(지붕 윗면 크게)."""
    c = Cv(64, H34); T = _tone(*WHITE)
    g1, g2, ghi = K('garasu', -1), K('garasu', -2), K('garasu', 1)
    wh = (13, 50)
    # 짐칸: 먼 난간(윗면) → 바닥 판(위에서 보임, 세로 줄눈) → 가까운 난간 윗면 → 옆 문짝(옆면)
    c.R(4, 13, 32, 2, T['topE']); c.HL(4, 15, 32, T['lo'])                       # 먼 난간 윗면
    c.R(4, 16, 32, 12, K('tekko', 0)); c.HL(4, 16, 32, K('tekko', -2))           # 바닥(먼 난간 그늘 1줄)
    for xx in range(9, 36, 6): c.VL(xx, 17, 11, K('tekko', 1))
    c.R(4, 13, 2, 17, T['top']); c.R(34, 13, 2, 17, T['bod'])                     # 뒤·앞 난간 윗면(세로)
    c.R(4, 28, 32, 2, T['topE']); c.HL(4, 29, 32, T['top'])                       # 가까운 난간 윗면
    c.R(4, B_Y0, 32, B_Y1 - B_Y0 - 2, T['bod']); c.HL(4, B_Y0, 32, T['lo']); c.HL(4, B_Y0 + 1, 32, T['top'])
    for xx in (15, 25): c.VL(xx, B_Y0 + 2, B_Y1 - B_Y0 - 5, T['lo'])
    c.VL(4, B_Y0, B_Y1 - B_Y0 - 2, T['top']); c.R(4, B_Y1 - 2, 33, 3, K('tekko', -2))
    c.R(4, B_Y0 + 2, 2, 4, K('aka', 1))
    # 헤드보드(캡 뒤 보호틀): 얇은 세로 판
    c.R(36, 10, 2, 20, K('tekko', 0)); c.VL(36, 10, 20, K('tekko', 1))
    # 캡: 지붕 윗면(크다) → 앞유리 비스듬 → 캡 옆면(문 창)
    _roof34(c, 38, 58, 7, 22, T)
    for x in range(58, 62):                                                        # 앞유리: 지붕 앞 끝에서 앞 얼굴로 기운 면
        y0 = 8 + (x - 58) * 3
        c.VL(x, y0, 22 - y0 + 4, g1); c.P(x, y0, ghi); c.P(x, y0 - 1, T['lo'])
    c.R(38, 22, 24, B_Y1 - 21, T['bod']); c.HL(38, 22, 24, T['lo'])
    c.VL(38, 22, B_Y1 - 21, T['top']); c.VL(61, 22, B_Y1 - 21, T['lo'])
    c.R(40, 24, 15, 7, g1); c.R(40, 29, 15, 2, g2); c.HL(41, 25, 4, ghi)          # 문 창
    c.VL(55, 23, B_Y1 - 22, T['lo']); c.HL(42, 34, 3, T['dk'])
    c.HL(38, B_Y0 + 7, 24, T['lo']); c.R(38, B_Y1 - 3, 24, 3, T['lo']); c.HL(38, B_Y1, 24, T['dk'])
    c.R(59, 33, 2, 3, K('kii', 2))
    for wx in wh:
        for j in range(-7, 0):
            for i in range(-8, 9):
                if i * i + j * j <= 60: c.P(wx + i, W_Y + j, K('sumi', 1))
    c.R(6, B_Y1 + 1, 54, 2, K('sumi', 0))
    return _done34(c, wh)


def _ktruck_down(L=4):
    H = L * 16 + 16; c = Cv(W, H); T = _tone(*WHITE)
    bx0, bx1 = 3, 29
    S = _stack(H, [('gate', 4), ('bed', 18), ('head', 4), ('roof', 12), ('wind', 13), ('front', 16)])
    # 짐칸: 난간(좌우 흰 띠) + 바닥(어두운 판)
    y0 = S['gate'][0]; y1 = S['head'][0]
    c.R(bx0, y0, bx1 - bx0, y1 - y0, T['top']); c.a[y0, bx0, 3] = 0; c.a[y0, bx1 - 1, 3] = 0
    c.HL(bx0 + 1, y0, bx1 - bx0 - 2, T['topE'])
    by, bh = S['bed']
    c.R(bx0 + 2, by, bx1 - bx0 - 4, bh, K('tekko', 0))
    for j in range(0, bh, 6): c.HL(bx0 + 2, by + j, bx1 - bx0 - 4, K('tekko', -1))   # 바닥 판 이음
    c.HL(bx0 + 2, by, bx1 - bx0 - 4, K('tekko', -2))
    c.VL(bx0 + 2, by, bh, K('tekko', -2))                                        # 왼쪽 난간이 바닥에 드리운 그늘
    _row_edges(c, y0 + 1, y1 - y0 - 1, bx0, bx1, T['topE'], T['bod'])
    # 헤드보드(보호틀 막대)
    y, h = S['head']; c.R(bx0 + 1, y, bx1 - bx0 - 2, h, K('tekko', 0)); c.HL(bx0 + 1, y, bx1 - bx0 - 2, K('tekko', 1))
    for xx in range(bx0 + 4, bx1 - 2, 4): c.VL(xx, y, h, K('tekko', 2))
    # 캡 지붕·앞유리·평평한 앞
    y, h = S['roof']; c.R(bx0, y, bx1 - bx0, h, T['topE']); c.HL(bx0, y, bx1 - bx0, T['top'])
    _row_edges(c, y, h, bx0, bx1, T['topE'], T['top'])
    y, h = S['wind']; c.R(bx0, y, bx1 - bx0, h, T['bod']); _row_edges(c, y, h, bx0, bx1, T['top'], T['dk'])
    _glass_rows(c, y + 1, h - 2, bx0 + 2, bx1 - 2)
    for j in range(4, 9): c.P(bx0 + 3 + j, y + j, K('garasu', 0))
    c.R(bx0 - 1, y + 3, 1, 3, T['lo']); c.R(bx1, y + 3, 1, 3, T['lo'])
    y, h = S['front']; c.R(bx0, y, bx1 - bx0, h, T['bod']); c.HL(bx0, y, bx1 - bx0, T['top'])
    c.R(11, y + 2, 10, 2, K('tekko', -1)); c.HL(11, y + 2, 10, K('tekko', 0))  # 얇은 그릴
    _headlights(c, y + 2, bx0, bx1, w=5, h=3)
    c.HL(bx0, y + 6, bx1 - bx0, T['lo'])
    c.R(bx0, y + 7, bx1 - bx0, 3, K('conc', -1)); c.HL(bx0, y + 7, bx1 - bx0, K('conc', 0))
    _plate(c, 13, y + 7, kei=True)
    c.R(bx0 + 1, y + 10, bx1 - bx0 - 2, 6, K('tekko', -2)); c.HL(bx0 + 3, y + 11, bx1 - bx0 - 6, K('tekko', -1))
    _row_edges(c, y, 10, bx0, bx1, T['top'], T['dk'])
    _tires(c, y + 11, 6, bx0, bx1)
    _shadow(c, y + h, bx0 + 3, bx1 - 3)
    return _done(c)


def _ktruck_up(L=4):
    H = L * 16 + 16; c = Cv(W, H); T = _tone(*WHITE)
    bx0, bx1 = 3, 29
    S = _stack(H, [('wind', 3), ('roof', 12), ('head', 4), ('bed', 22), ('gate', 7), ('rear', 10)])
    y, h = S['wind']; c.R(bx0, y, bx1 - bx0, h, T['top']); c.R(bx0 + 2, y, bx1 - bx0 - 4, h, K('garasu', -2))
    c.a[y, bx0, 3] = 0; c.a[y, bx1 - 1, 3] = 0
    y, h = S['roof']; c.R(bx0, y, bx1 - bx0, h, T['topE']); c.HL(bx0, y + h - 1, bx1 - bx0, T['top'])
    _row_edges(c, y, h, bx0, bx1, T['topE'], T['top'])
    y, h = S['head']; c.R(bx0 + 1, y, bx1 - bx0 - 2, h, K('tekko', 0)); c.HL(bx0 + 1, y, bx1 - bx0 - 2, K('tekko', 1))
    for xx in range(bx0 + 4, bx1 - 2, 4): c.VL(xx, y, h, K('tekko', 2))
    y0, y1 = S['bed'][0], S['gate'][0]
    by, bh = S['bed']
    c.R(bx0, by, bx1 - bx0, bh, T['top'])
    c.R(bx0 + 2, by, bx1 - bx0 - 4, bh, K('tekko', 0))
    for j in range(0, bh, 6): c.HL(bx0 + 2, by + j, bx1 - bx0 - 4, K('tekko', -1))
    c.VL(bx0 + 2, by, bh, K('tekko', -2))
    _row_edges(c, by, bh, bx0, bx1, T['topE'], T['bod'])
    # 뒤 문짝(짐칸 뒤판): 위 끝 밝은 윗면 + 흰 판
    y, h = S['gate']; c.R(bx0, y, bx1 - bx0, h, T['bod']); c.HL(bx0, y, bx1 - bx0, T['topE']); c.HL(bx0, y + 1, bx1 - bx0, T['top'])
    for xx in (bx0 + 6, bx1 - 7): c.VL(xx, y + 2, h - 3, T['lo'])
    c.HL(bx0, y + h - 1, bx1 - bx0, T['lo'])
    _row_edges(c, y, h, bx0, bx1, T['top'], T['dk'])
    # 뒤 범퍼: 후미등·노란 번호판
    y, h = S['rear']; c.R(bx0, y, bx1 - bx0, h, K('tekko', -2))
    for xx in (bx0, bx1 - 5): c.R(xx, y, 5, 3, K('aka', 0)); c.HL(xx, y, 5, K('aka', 1))
    _plate(c, 13, y, kei=True)
    c.HL(bx0 + 3, y + 4, bx1 - bx0 - 6, K('tekko', -1))
    _tires(c, y + 4, 6, bx0, bx1)
    _shadow(c, y + h, bx0 + 3, bx1 - 3)
    return _done(c)


# ── 2t 상자형 트럭(L=6, 흰 화물칸 + 앞 캡) ───────────────────────────────

def _box_side():
    """96×56, 3/4 깊이판. 화물칸 지붕 윗면이 큰 면(16줄), 캡은 화물칸보다 낮다(지붕 윗면 10줄)."""
    c = Cv(96, 56); T = _tone(*WHITE)
    g1, g2, ghi = K('garasu', -1), K('garasu', -2), K('garasu', 1)
    wh = (16, 28, 79)
    # 화물칸: 지붕 윗면 7..22(보강 골은 지붕을 가로지르는 세로선) → 옆면 23..44
    _roof34(c, 4, 65, 7, 23, T)
    for xx in range(14, 64, 10): c.VL(xx, 9, 13, T['top'])
    c.R(4, 23, 61, B_Y1 - 22, T['bod']); c.HL(4, 23, 61, T['lo']); c.HL(4, 24, 61, T['top'])
    c.VL(4, 23, B_Y1 - 22, T['top']); c.VL(64, 23, B_Y1 - 22, T['lo'])
    for xx in range(14, 64, 10): c.VL(xx, 25, 16, T['lo']); c.VL(xx + 1, 25, 16, T['topE'])
    c.R(4, 41, 61, 2, T['lo']); c.HL(4, 43, 61, T['dk'])
    # 캡: 지붕 윗면 17..26 → 앞유리(비스듬) → 옆면 27..46
    _roof34(c, 66, 89, 17, 27, T)
    for x in range(89, 93):
        y0 = 18 + (x - 89) * 3
        c.VL(x, y0, 27 - y0 + 6, g1); c.P(x, y0, ghi); c.P(x, y0 - 1, T['lo'])
    c.R(66, 27, 26, B_Y1 - 26, T['bod']); c.HL(66, 27, 26, T['lo']); c.VL(66, 27, B_Y1 - 26, T['top']); c.VL(91, 27, B_Y1 - 26, T['lo'])
    c.R(69, 29, 13, 6, g1); c.R(69, 34, 13, 1, g2); c.HL(70, 30, 4, ghi)
    c.VL(83, 28, B_Y1 - 28, T['lo']); c.R(71, 37, 3, 1, T['dk'])
    c.HL(66, 39, 26, T['lo']); c.R(66, B_Y1 - 3, 26, 3, T['lo']); c.HL(66, B_Y1, 26, T['dk'])
    c.R(89, 37, 2, 3, K('kii', 2))
    c.R(65, 23, 1, 21, K('tekko', -1))                                           # 캡·화물칸 틈
    c.R(4, 44, 62, 3, K('tekko', -2)); c.R(3, 32, 2, 5, K('aka', 1))
    for wx in wh:
        for j in range(-7, 0):
            for i in range(-8, 9):
                if i * i + j * j <= 60: c.P(wx + i, W_Y + j, K('sumi', 1))
    c.R(6, B_Y1 + 1, 85, 2, K('sumi', 0))
    return _done34(c, wh)


def _box_down(L=6):
    H = L * 16 + 16; c = Cv(W, H); T = _tone(*WHITE); B = _tone('shiro', 0)
    bx0, bx1 = 2, 30; kx0, kx1 = 4, 28
    S = _stack(H, [('box', 60), ('boxf', 10), ('roof', 8), ('wind', 13), ('front', 15)])
    y, h = S['box']; c.R(bx0, y, bx1 - bx0, h, T['topE']); c.a[y, bx0, 3] = 0; c.a[y, bx1 - 1, 3] = 0
    for j in range(5, h, 8): c.HL(bx0 + 1, y + j, bx1 - bx0 - 2, T['lo']); c.HL(bx0 + 1, y + j + 1, bx1 - bx0 - 2, T['top'])     # 지붕 보강 골
    c.HL(bx0, y, bx1 - bx0, T['top'])
    _row_edges(c, y + 1, h - 1, bx0, bx1, T['topE'], T['top'])
    y, h = S['boxf']; c.R(bx0, y, bx1 - bx0, h, T['bod']); c.HL(bx0, y, bx1 - bx0, T['top'])
    c.HL(bx0, y + h - 1, bx1 - bx0, T['lo']); _row_edges(c, y, h, bx0, bx1, T['top'], T['dk'])
    for xx in (bx0 + 1, bx1 - 3): c.R(xx, y + 2, 2, 1, K('daidai', 2))        # 차폭등
    y, h = S['roof']; c.R(kx0, y, kx1 - kx0, h, T['topE']); c.HL(kx0, y, kx1 - kx0, T['top'])
    _row_edges(c, y, h, kx0, kx1, T['topE'], T['top'])
    y, h = S['wind']; c.R(kx0, y, kx1 - kx0, h, T['bod']); _row_edges(c, y, h, kx0, kx1, T['top'], T['dk'])
    _glass_rows(c, y + 1, h - 2, kx0 + 2, kx1 - 2)
    for j in range(3, 8): c.P(kx0 + 3 + j, y + j, K('garasu', 0))
    c.R(kx0 - 2, y + 2, 2, 4, K('tekko', -1)); c.R(kx1, y + 2, 2, 4, K('tekko', -1))   # 큰 거울
    y, h = S['front']; c.R(kx0, y, kx1 - kx0, h, T['bod']); c.HL(kx0, y, kx1 - kx0, T['top'])
    _headlights(c, y + 2, kx0, kx1, w=5, h=3)
    c.R(11, y + 2, 10, 3, K('tekko', -2)); c.HL(11, y + 3, 10, K('tekko', 0))
    c.HL(kx0, y + 6, kx1 - kx0, T['lo'])
    c.R(kx0 - 1, y + 7, kx1 - kx0 + 2, 3, K('conc', -1)); c.HL(kx0 - 1, y + 7, kx1 - kx0 + 2, K('conc', 0))
    _plate(c, 13, y + 7)
    c.R(kx0, y + 10, kx1 - kx0, 5, K('tekko', -2)); c.HL(kx0 + 2, y + 11, kx1 - kx0 - 4, K('tekko', -1))
    _row_edges(c, y, 10, kx0, kx1, T['top'], T['dk'])
    _tires(c, y + 10, 6, bx0, bx1, w=3)
    _shadow(c, y + h, bx0 + 3, bx1 - 3)
    return _done(c)


def _box_up(L=6):
    H = L * 16 + 16; c = Cv(W, H); T = _tone(*WHITE); B = _tone('shiro', 0)
    bx0, bx1 = 2, 30; kx0, kx1 = 4, 28
    S = _stack(H, [('roof', 6), ('box', 62), ('door', 26), ('rear', 6)])
    y, h = S['roof']; c.R(kx0, y, kx1 - kx0, h, T['top']); c.HL(kx0 + 1, y, kx1 - kx0 - 2, T['topE'])
    c.a[y, kx0, 3] = 0; c.a[y, kx1 - 1, 3] = 0
    _row_edges(c, y + 1, h - 1, kx0, kx1, T['topE'], T['bod'])
    y, h = S['box']; c.R(bx0, y, bx1 - bx0, h, T['topE']); c.HL(bx0, y, bx1 - bx0, T['top'])
    for j in range(5, h, 8): c.HL(bx0 + 1, y + j, bx1 - bx0 - 2, T['lo']); c.HL(bx0 + 1, y + j + 1, bx1 - bx0 - 2, T['top'])
    _row_edges(c, y + 1, h - 1, bx0, bx1, T['topE'], T['top'])
    # 뒷문 두 짝: 세로 잠금대·손잡이
    y, h = S['door']; c.R(bx0, y, bx1 - bx0, h, T['bod']); c.HL(bx0, y, bx1 - bx0, T['top'])
    c.HL(bx0, y + h - 1, bx1 - bx0, T['lo']); _row_edges(c, y, h, bx0, bx1, T['top'], T['dk'])
    c.VL(15, y + 1, h - 2, T['dk']); c.VL(16, y + 1, h - 2, T['lo'])          # 두 문 사이
    for xx in (8, 23): c.VL(xx, y + 2, h - 4, K('tekko', 0)); c.VL(xx + 1, y + 2, h - 4, K('tekko', 2))   # 잠금대
    for xx in (12, 19): c.R(xx, y + 12, 2, 3, K('tekko', -1))
    for xx in (bx0 + 1, bx1 - 3): c.R(xx, y + 2, 2, 1, K('aka', 1))
    y, h = S['rear']; c.R(bx0, y, bx1 - bx0, h, K('tekko', -2))
    for xx in (bx0 + 1, bx1 - 6): c.R(xx, y, 5, 3, K('aka', 0)); c.HL(xx, y, 5, K('aka', 1))
    _plate(c, 13, y)
    _tires(c, y + 1, 5, bx0, bx1, w=3)
    _shadow(c, y + h, bx0 + 3, bx1 - 3)
    return _done(c)


# ── 목록 ────────────────────────────────────────────────────────────────

HATCH = {'silver', 'red'}                                                       # 승용 5대 중 해치백 둘


def _sedan_right(color):
    return lambda: _sedan_side(CAR_TONE[color], 'hatch' if color in HATCH else 'sedan')


def _entry(vid, name, kind, L, right, up, down):
    return dict(id=vid, name=name, kind=kind, L=L,
                frames={'right': right, 'left': _flip(right), 'up': up, 'down': down})


SEDANS = (('white', '흰 승용차'), ('silver', '은색 승용차'), ('black', '검은 승용차'),
          ('red', '빨간 승용차'), ('blue', '파란 승용차'))

VEHICLES = []
for _c, _n in SEDANS:
    VEHICLES.append(_entry(f'jp-car-{_c}', _n, 'car', 5, _sedan_right(_c),
                           (lambda c=_c: _sedan_up(CAR_TONE[c])), (lambda c=_c: _sedan_down(CAR_TONE[c]))))
for _c, _n in (('yellow', '노란 경차'), ('mint', '민트 경차')):
    VEHICLES.append(_entry(f'jp-car-kei-{_c}', _n, 'kei', 4, (lambda c=_c: _kei_side(c)),
                           (lambda c=_c: _kei_up(c)), (lambda c=_c: _kei_down(c))))
VEHICLES.append(_entry('jp-car-taxi', '택시', 'taxi', 5, lambda: _sedan_side(CAR_TONE['taxi'], taxi=True),
                       lambda: _sedan_up(CAR_TONE['taxi'], taxi=True), lambda: _sedan_down(CAR_TONE['taxi'], taxi=True)))
VEHICLES.append(_entry('jp-truck-kei', '경트럭', 'truck', 4, _ktruck_side, _ktruck_up, _ktruck_down))
VEHICLES.append(_entry('jp-truck-box', '상자형 트럭', 'truck', 6, _box_side, _box_up, _box_down))
