"""새 부품 B (아키하바라·신주쿠 맵 보강). register(reg_prop, reg_deco, add, STREET) 로 등록.
고가 개구부 3종·가선 기둥·노선색 열차·袖看板·가챠 벽·네온·소품·LED 빌딩·오모이데 아치·가드 터널."""
import random
from v2core import *
from jfont import glyph
import parts_vehicles as PV
import post as _post


# ───────────────────────── 공통 ─────────────────────────
def _viaduct_base(w=6):
    """v2misc.viaduct 와 같은 고가 정면(윗면 레일·거더·양끝 교각). 개구부 x=18..W-18, y=24..93 은 비워 둔다(윤곽 전)."""
    W, H = 16 * w, 96; c = Cv(W, H)
    c.R(0, 0, W, 10, K('hodo', 0))
    for x in range(0, W, 5): c.R(x, 2, 3, 6, K('ita', -2))
    c.HL(0, 3, W, K('tekko', 4)); c.HL(0, 4, W, K('tekko', 2)); c.HL(0, 7, W, K('tekko', 4)); c.HL(0, 8, W, K('tekko', 2))
    c.HL(0, 0, W, K('conc', 3)); c.HL(0, 9, W, K('conc', 0))
    c.R(0, 10, W, 14, K('conc', 2)); c.HL(0, 10, W, K('conc', 5)); c.HL(0, 11, W, K('conc', 4)); c.HL(0, 23, W, K('conc', -1))
    for x in range(4, W, 12): c.R(x, 15, 2, 2, K('conc', 4)); c.P(x, 15, K('shiro', 3))
    FB = 93
    for rx in (0, W - 18):
        c.R(rx, 24, 18, FB - 23, K('conc', 2)); c.VL(rx, 24, FB - 23, K('conc', 4)); c.VL(rx + 17, 24, FB - 23, K('conc', -1)); c.VL(rx + 1, 24, FB - 23, K('conc', 3))
        c.R(rx, 87, 18, 7, K('conc', 0)); c.HL(rx, 87, 18, K('conc', 2)); c.HL(rx, FB, 18, K('conc', -2))
    return c

OX0, OX1, FB = 18, 78, 93

def _ceiling(c, x0=OX0, x1=OX1):
    """거더 밑면 그림자 2단(원 고가와 같다)."""
    c.R(x0, 24, x1 - x0, 3, K('tekko', -3)); c.R(x0, 27, x1 - x0, 3, K('yoru', -3))
    for x in range(x0, x1): c.P(x, 24, K('conc', 4)); c.P(x, 25, K('conc', 1))

def _paved_floor(c, x0=OX0, x1=OX1, y0=78):
    """보도색(hodo) 바닥 + 앞 연석."""
    c.R(x0, y0, x1 - x0, FB - 2 - y0, K('hodo', 2)); c.HL(x0, y0, x1 - x0, K('hodo', -1)); c.HL(x0, y0 + 1, x1 - x0, K('hodo', 3))
    for yy in (y0 + 7,): c.HL(x0, yy, x1 - x0, K('hodo', 1))
    for xx in range(x0 + 6, x1 - 2, 12): c.VL(xx, y0 + 2, 5, K('hodo', 1)); c.VL(xx + 6, y0 + 8, FB - 2 - y0 - 8, K('hodo', 1))
    c.R(x0, FB - 2, x1 - x0, 3, K('hodo', 0)); c.HL(x0, FB - 2, x1 - x0, K('hodo', 3))

def _tactile_line(c, y, x0=OX0 + 2, x1=OX1 - 2):
    """선형 점자블록 한 줄(노랑, 4px 주기 돌기)."""
    c.R(x0, y, x1 - x0, 3, K('kii', 2)); c.HL(x0, y, x1 - x0, K('kii', 3)); c.HL(x0, y + 2, x1 - x0, K('kii', 0))
    for xx in range(x0 + 1, x1 - 1, 4): c.P(xx, y + 1, K('kii', 4))

def _bulbs(out, x0, x1, y0, sag):
    """전구 줄(후처리: 윤곽 뒤에 얹는다). 포물선 전선 + 6px 마다 노란 알전구."""
    n = x1 - x0
    for i in range(n + 1):
        y = y0 + int(round(sag * (1 - ((2.0 * i / n) - 1) ** 2)))
        out.P(x0 + i, y, K('tekko', 3))
    for i in range(3, n - 2, 6):
        y = y0 + int(round(sag * (1 - ((2.0 * i / n) - 1) ** 2)))
        out.P(x0 + i, y + 1, K('kii', 4)); out.P(x0 + i + 1, y + 1, K('kii', 3)); out.P(x0 + i, y + 2, K('kii', 3)); out.P(x0 + i + 1, y + 2, K('kii', 2))

def _sign_bar(c, x, y, w, col, marks=True):
    """점포 간판 막대: 윗면 1px + 앞면 5px(왼쪽 밝고 오른쪽 어둡다), 글자 없이 흰 짧은 막대 표지."""
    c.R(x, y, w, 6, K(col, 1)); c.HL(x, y, w, K(col, 4)); c.VL(x, y + 1, 5, K(col, 3)); c.VL(x + w - 1, y + 1, 5, K(col, -1)); c.HL(x, y + 5, w, K(col, -2))
    if marks:
        for i in range(x + 3, x + w - 4, 5): c.R(i, y + 2, 3, 2, K('shiro', 3))

def _shop_shutter(c, x, w, y0=44, y1=78, drop=16):
    """셔터 점포: 반쯤 내린 롤 셔터(가로 홈 2px 주기) + 열린 부분은 따뜻한 실내와 진열 선반·상자."""
    c.R(x, y0, w, y1 - y0, K('tekko', -2))
    c.R(x + 1, y0 + drop, w - 2, y1 - y0 - drop - 4, K('mado', 0)); c.R(x + 1, y0 + drop, w - 2, 2, K('mado', -1))       # 불 켜진 실내
    shelf = y1 - 11
    c.HL(x + 1, shelf, w - 2, K('ita', 1)); c.HL(x + 1, shelf + 1, w - 2, K('ita', -1))
    cols = ['sora', 'aka', 'kii', 'midori']
    for k, xx in enumerate(range(x + 2, x + w - 4, 4)):
        c.R(xx, shelf - 5, 3, 5, K(cols[k % 4], 1)); c.HL(xx, shelf - 5, 3, K(cols[k % 4], 3)); c.VL(xx + 2, shelf - 4, 4, K(cols[k % 4], -1))
    c.R(x, y1 - 4, w, 4, K('ita', 0)); c.HL(x, y1 - 4, w, K('ita', 3)); c.HL(x, y1 - 1, w, K('ita', -2))                    # 카운터
    for j in range(drop):                                                                                              # 셔터 판
        c.HL(x, y0 + j, w, K('conc', 2) if j % 4 < 2 else K('conc', 1))
    c.R(x, y0 + drop - 2, w, 2, K('conc', 4)); c.HL(x, y0 + drop - 1, w, K('tekko', 1))
    c.R(x + w // 2 - 2, y0 + drop - 5, 4, 2, K('tekko', 2))                                                           # 손잡이

def _shop_noren(c, x, w, y0=44, y1=78, col='aka'):
    """노렌 점포: 가로대 + 세로로 갈라진 천 4장(아래 끝 한 단 어둡게) + 안쪽 어두운 실내와 카운터."""
    c.R(x, y0, w, y1 - y0, K('tekko', -3))
    c.R(x + 1, y0 + 14, w - 2, y1 - y0 - 18, K('mado', 0)); c.R(x + 1, y0 + 14, w - 2, 2, K('mado', -1))
    for i in range(3, w - 4, 4): c.VL(x + i, y0 + 16, 8, K('ita', -1))                                                 # 안쪽 벽널
    c.R(x, y1 - 7, w, 7, K('ita', 0)); c.HL(x, y1 - 7, w, K('ita', 3)); c.HL(x, y1 - 1, w, K('ita', -2))
    for k, xx in enumerate(range(x + 8, x + w - 2, 4)):
        c.R(xx, y0 + 2, 3, 13, K(col, 1)); c.VL(xx, y0 + 2, 13, K(col, 3)); c.VL(xx + 2, y0 + 2, 13, K(col, -1)); c.HL(xx, y0 + 14, 3, K(col, -2))
    c.R(x, y0, w, 2, K('ita', 2)); c.HL(x, y0, w, K('ita', 4))
    chochin(c, x + 4, y0 + 4, 7, 9, 'aka')

def _shop_glass(c, x, w, y0=44, y1=78):
    """유리 진열창 점포(부품 가게): 철틀 + 밝은 유리 + 선반 3단에 색 상자 + 대각 반사."""
    c.R(x, y0, w, y1 - y0, K('tekko', 1))
    c.R(x + 2, y0 + 2, w - 4, y1 - y0 - 6, K('mado', 1)); c.R(x + 2, y0 + 2, w - 4, 2, K('mado', 0))
    cols = ['aka', 'sora', 'kii', 'midori', 'pinku', 'sora']
    for r, yy in enumerate((y0 + 12, y0 + 22, y0 + 32)):
        c.HL(x + 2, yy, w - 4, K('ita', 2)); c.HL(x + 2, yy + 1, w - 4, K('ita', -2))
        for k, xx in enumerate(range(x + 3, x + w - 6, 5)):
            hh = 5 if (k + r) % 2 == 0 else 7
            col = cols[(k * 2 + r) % 6]
            c.R(xx, yy - hh, 4, hh, K(col, 1)); c.HL(xx, yy - hh, 4, K(col, 3)); c.VL(xx + 3, yy - hh + 1, hh - 1, K(col, -1))
    for q in range(5): c.P(x + w - 7 + q, y0 + 14 - q, K('garasu', 4))
    c.R(x, y1 - 4, w, 4, K('tekko', 2)); c.HL(x, y1 - 4, w, K('tekko', 4))
    c.VL(x + w // 2, y0 + 2, y1 - y0 - 6, K('tekko', 1))

def viaduct6_shops():
    """고가 정면 6x6칸. 개구부 안: 가드 하부 상가(셔터 점포 | 노렌+초롱 점포 | 유리 진열 점포) + 전구 줄 + 보도색 바닥. 막힘열 (0,1,4,5) = 양끝 교각."""
    c = _viaduct_base(6)
    c.R(OX0, 24, OX1 - OX0, 54, K('yoru', -2)); _ceiling(c)
    for x in (OX0, OX1 - 1): c.VL(x, 27, 51, K('conc', -1) if x == OX0 else K('conc', 3))
    for (x, w, col) in [(20, 18, 'aka'), (39, 18, 'sora'), (58, 18, 'kii')]: _sign_bar(c, x, 37, w, col)
    _shop_shutter(c, 20, 18); _shop_noren(c, 39, 18, col='kon'); _shop_glass(c, 58, 18)
    for x in (38, 57): c.R(x, 37, 1, 41, K('conc', 1))                                                                 # 점포 사이 기둥
    _paved_floor(c); _tactile_line(c, 86)
    out = ink2(c)
    _bulbs(out, OX0 + 3, OX1 - 3, 31, 2)
    return out

def viaduct6_pass():
    """고가 정면 6x6칸. 통로형: 밝은 천장 조명 줄 + 정면 사각이 안쪽으로 세 겹(안쪽일수록 어둡다) + 맨 안쪽 출구(바깥 거리가 보인다), 바닥 아스팔트·중앙선. 막힘열 (0,1,4,5)."""
    c = _viaduct_base(6)
    c.R(OX0, 24, OX1 - OX0, 54, K('yoru', -2)); _ceiling(c)
    # 1겹(바깥): 좌우 벽(왼쪽이 한 단 밝다) + 벽 이음 줄
    c.R(OX0, 30, 8, 48, K('conc', -1)); c.VL(OX0, 30, 48, K('conc', 0)); c.VL(OX0 + 7, 30, 48, K('conc', -2))
    c.R(OX1 - 8, 30, 8, 48, K('tekko', 0)); c.VL(OX1 - 8, 30, 48, K('tekko', 1)); c.VL(OX1 - 1, 30, 48, K('tekko', -1))
    for yy in (44, 58, 70): c.HL(OX0 + 1, yy, 6, K('conc', -3)); c.HL(OX1 - 8, yy, 8, K('tekko', -1))
    c.R(OX0 + 8, 30, 44, 6, K('yoru', -1)); c.HL(OX0 + 8, 35, 44, K('yoru', -2))                                       # 천장 띠
    # 2겹: 한 단 어두운 좌우 벽과 천장
    c.R(OX0 + 8, 36, 4, 42, K('tekko', -1)); c.VL(OX0 + 8, 36, 42, K('tekko', 0))
    c.R(OX1 - 12, 36, 4, 42, K('tekko', -3))
    c.R(OX0 + 12, 36, 36, 4, K('yoru', -2))
    # 3겹(맨 안쪽): 가장 어두운 벽 + 출구
    c.R(OX0 + 12, 40, 36, 38, K('yoru', -3))
    ex, ey, ew, eh = OX0 + 16, 46, 28, 26
    c.R(ex, ey, ew, eh, K('kinari', 3)); c.HL(ex, ey, ew, K('shiro', 4)); c.R(ex, ey + 16, ew, eh - 16, K('kinari', 1)); c.HL(ex, ey + 16, ew, K('kinari', 2))   # 출구: 밝은 바깥 빛 + 길
    c.VL(ex, ey, eh, K('conc', 4)); c.VL(ex + ew - 1, ey, eh, K('conc', 0))
    # 바닥: 아스팔트 + 중앙선(앞쪽 크게, 안쪽 작게)
    c.R(OX0, 78, OX1 - OX0, FB - 77, K('yoru', 1)); c.HL(OX0, 78, OX1 - OX0, K('yoru', -2)); c.HL(OX0, 79, OX1 - OX0, K('yoru', 2))
    for x in range(OX0 + 3, OX1 - 6, 12): c.R(x, 86, 6, 1, K('shiro', 2))
    c.R(OX0 + 8, 74, 44, 4, K('yoru', 0)); c.HL(OX0 + 8, 74, 44, K('yoru', -2))
    for x in range(OX0 + 18, OX1 - 22, 8): c.R(x, 76, 4, 1, K('shiro', 1))
    c.R(OX0, FB - 2, OX1 - OX0, 3, K('hodo', 0)); c.HL(OX0, FB - 2, OX1 - OX0, K('hodo', 3))
    out = ink2(c)
    for x in (OX0 + 3, OX0 + 20, OX0 + 37):                                                                           # 천장 조명 줄(밝은 형광등) — 윤곽 뒤
        out.R(x, 30, 12, 2, K('shiro', 4)); out.HL(x + 1, 32, 10, K('garasu', 4))
    for x in (OX0 + 14, OX0 + 30):
        out.R(x, 36, 8, 1, K('shiro', 4)); out.HL(x + 1, 37, 6, K('garasu', 3))
    out.R(OX0 + 18, 41, 3, 1, K('shiro', 3)); out.R(OX0 + 33, 41, 3, 1, K('shiro', 3))
    return out

def _bike(o, x, base, frame='sora'):
    """자전거 24x15 (윤곽 뒤에 얹는다, 알파 0/255). 3/4: 바퀴는 1px 어두운 링 + 밝은 속 + 2px 허브, 안장은 윗면이 밝은 두께 있는 판, 앞바구니, 바닥 접지선.
    x = 왼쪽 끝, base = 접지 행."""
    dk, ln = K('tekko', -3), K(frame, 1)
    cy = base - 5
    def wheel(cx):
        for j in range(-6, 6):
            for i in range(-6, 6):
                d = ((i + .5) / 5.4) ** 2 + ((j + .5) / 5.2) ** 2
                if d <= 1.0: o.P(cx + i, cy + j, dk if d >= 0.66 else K('conc', 3))
    rx, fx = x + 5, x + 18
    wheel(rx); wheel(fx)
    def line(x0, y0, x1, y1, col, t=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for k in range(n + 1):
            px, py = int(round(x0 + (x1 - x0) * k / n)), int(round(y0 + (y1 - y0) * k / n))
            for q in range(t): o.P(px + q, py, col)
    cr = x + 11                                                                       # 페달 축
    line(rx, cy, cr, cy, ln, 2); line(cr, cy, cr - 2, cy - 7, ln, 2); line(cr - 2, cy - 7, fx - 2, cy - 6, K(frame, 2), 2)
    line(cr, cy, fx - 2, cy - 6, K(frame, 0), 2); line(fx - 2, cy - 6, fx, cy, ln, 2)
    o.R(cr - 5, cy - 10, 6, 2, K('tekko', 3)); o.HL(cr - 5, cy - 10, 6, K('shiro', 3)); o.HL(cr - 4, cy - 8, 4, dk)   # 안장(윗면 밝은 줄 + 앞면 어두운 줄)
    line(cr - 2, cy - 7, cr - 2, cy - 8, K('conc', 4))
    for hx in (rx, fx): o.R(hx - 1, cy - 1, 2, 2, K('tekko', 1)); o.P(hx - 1, cy - 1, K('tekko', 4))                    # 허브 2px (프레임 위)
    line(fx - 2, cy - 6, fx - 2, cy - 10, K('tekko', 1), 2); o.R(fx - 5, cy - 11, 5, 1, K('tekko', 4))                # 핸들
    o.R(fx + 1, cy - 12, 6, 6, K('tekko', 2)); o.HL(fx + 1, cy - 12, 6, K('shiro', 3)); o.VL(fx + 6, cy - 11, 5, dk); o.HL(fx + 1, cy - 7, 6, dk)   # 바구니
    for k in (2, 4): o.VL(fx + k, cy - 11, 4, K('tekko', -1))
    for xx in range(x + 1, x + 25): o.P(xx, base + 1, K('hodo', -2))                                                 # 접지선

def viaduct6_shut():
    """고가 정면 6x6칸. 개구부가 막힌 형태: 왼쪽 롤 셔터 / 가운데 콘크리트 벽(환기구 + 배관 + 전기함) / 오른쪽 벽 앞 자전거 주차. 막힘열 (0,1,4,5)."""
    c = _viaduct_base(6)
    c.R(OX0, 24, OX1 - OX0, 54, K('conc', -2)); _ceiling(c)
    # 왼쪽: 셔터 박스 + 셔터
    sw = 20
    c.R(OX0, 30, sw, 6, K('conc', 0)); c.HL(OX0, 30, sw, K('conc', 1)); c.HL(OX0, 35, sw, K('conc', -3))
    for x in range(OX0 + 3, OX0 + sw - 1, 5): c.P(x, 33, K('conc', 1))
    for j in range(36, 77): c.HL(OX0, j, sw, K('conc', 0) if (j // 2) % 2 == 0 else K('conc', -1))
    c.VL(OX0, 36, 40, K('conc', 1)); c.VL(OX0 + sw - 1, 36, 40, K('conc', -2))
    c.R(OX0 + 7, 66, 6, 2, K('tekko', 1)); c.HL(OX0 + 7, 66, 6, K('tekko', 3))                                         # 손잡이
    c.R(OX0, 76, sw, 2, K('tekko', 1)); c.HL(OX0, 76, sw, K('tekko', 3))                                               # 셔터 레일
    # 가운데: 어두운 벽 + 환기구 + 배관 + 전기함
    x0 = OX0 + sw
    c.R(x0, 30, 14, 48, K('conc', -2)); c.VL(x0, 30, 48, K('conc', -1)); c.VL(x0 + 13, 30, 48, K('conc', -3))
    for yy in range(38, 78, 8): c.HL(x0 + 1, yy, 12, K('conc', -3))
    c.R(x0 + 2, 36, 10, 14, K('tekko', 2)); c.HL(x0 + 2, 36, 10, K('tekko', 4)); c.VL(x0 + 2, 37, 13, K('tekko', 3)); c.VL(x0 + 11, 37, 13, K('tekko', 0))
    for j in range(39, 49, 2): c.HL(x0 + 3, j, 8, K('tekko', -2)); c.HL(x0 + 3, j + 1, 8, K('tekko', 1))
    c.R(x0 + 3, 50, 3, 27, K('hodo', 3)); c.VL(x0 + 3, 50, 27, K('hodo', 5)); c.VL(x0 + 5, 50, 27, K('hodo', 0))        # 배관
    c.R(x0 + 8, 58, 5, 9, K('tekko', 1)); c.HL(x0 + 8, 58, 5, K('tekko', 4)); c.R(x0 + 9, 61, 3, 2, K('midori', 3))      # 전기함
    # 오른쪽: 한 단 밝은 벽(가운데 벽과 대비) + 황색 방호 띠
    x1 = x0 + 14
    c.R(x1, 30, OX1 - x1, 48, K('conc', 1)); c.VL(x1, 30, 48, K('conc', 3)); c.VL(OX1 - 1, 30, 48, K('conc', -2))
    for yy in range(38, 78, 8): c.HL(x1 + 1, yy, OX1 - x1 - 2, K('conc', -1))
    c.R(x1 + 2, 56, OX1 - x1 - 4, 2, K('kii', 3)); c.HL(x1 + 2, 56, OX1 - x1 - 4, K('kii', 4))                         # 황색 방호 띠
    _paved_floor(c, y0=78)
    out = ink2(c)
    _bike(out, OX0 + 3, 90, 'sora'); _bike(out, OX0 + 31, 90, 'aka')
    return out


# ───────────────────────── 철도 ─────────────────────────
def catenary_pole():
    """철도 가선 H형 철골 기둥 16x48 (1x3칸): 윗면 있는 가로대(양 팔) + 보강 삼각판 + 애자 + 조가선 + H형 기둥(플랜지 빛 단) + 콘크리트 기초."""
    c = Cv(16, 48)
    # 기초(윗면 + 앞면)
    c.R(4, 40, 8, 2, K('conc', 3)); c.HL(4, 40, 8, K('shiro', 4)); c.R(4, 42, 8, 4, K('conc', 0)); c.VL(4, 42, 4, K('conc', 2)); c.VL(11, 42, 4, K('conc', -2)); c.HL(4, 45, 8, K('conc', -2))
    # H형 기둥: 왼쪽 플랜지(밝음) · 웨브 · 오른쪽 플랜지(그늘) + 리브
    c.R(6, 10, 4, 30, K('tekko', 0)); c.VL(6, 10, 30, K('tekko', 3)); c.VL(7, 10, 30, K('tekko', 1)); c.VL(9, 10, 30, K('tekko', -2))
    for yy in (22, 34): c.HL(6, yy, 4, K('tekko', 4)); c.HL(6, yy + 1, 4, K('tekko', -3))
    # 보강 삼각판(가로대 밑 기둥 양쪽)
    for k in range(3):
        c.R(6 - (3 - k), 9 + k, 3 - k, 1, K('tekko', 0)); c.R(10, 9 + k, 3 - k, 1, K('tekko', -2))
    # 가로대: 윗면 2px + 앞면 2px + 밑 그림자 1px
    c.R(1, 4, 14, 2, K('tekko', 3)); c.HL(1, 4, 14, K('tekko', 5)); c.R(1, 6, 14, 2, K('tekko', 1)); c.VL(1, 6, 2, K('tekko', 3)); c.VL(14, 6, 2, K('tekko', -1)); c.HL(1, 8, 14, K('tekko', -3))
    # 애자: 흰 원통(링 2줄)
    for x in (2, 12):
        c.R(x, 9, 2, 5, K('shiro', 3)); c.VL(x, 9, 5, K('shiro', 4)); c.HL(x, 11, 2, K('conc', 1))
    out = ink2(c)
    out.HL(0, 16, 16, K('tekko', 2))                                                                                    # 조가선 · 전차선 (끊김 없이 칸을 가로지른다)
    out.HL(0, 17, 16, K('tekko', -1))
    return out

def _train_door(cv):
    """맨 오른쪽 끝 칸(x 108..126)에 승강문 한 쌍. 기본 열차(PV.train)의 창 픽셀을 그대로 베껴 쓰므로 새 색·반투명 픽셀이 없다."""
    a = cv.a
    px = lambda x, y: tuple(int(v) for v in a[y, x, :3])
    body, hi, edge_l, edge_r, soft, seam = px(10, 27), px(10, 21), px(5, 27), px(16, 27), px(4, 27), px(106, 27)
    def put(x, y, col): a[y, x, :3] = col; a[y, x, 3] = 255
    for yy in range(17, 38):                                                                                       # 문 틀: 이음선과 같은 어두운 세로선(양끝·중앙) + 안쪽 옅은 선
        put(109, yy, seam); put(125, yy, seam); put(117, yy, seam); put(110, yy, soft); put(124, yy, soft)
    for x0 in (111, 118):                                                                                          # 문 창 2장: 왼쪽 어두운 테두리 · 유리 4px · 오른쪽 어두운 테두리
        for yy in range(19, 36):
            put(x0, yy, edge_l); put(x0 + 5, yy, edge_r)
            for xx in range(x0 + 1, x0 + 5): put(xx, yy, hi if yy < 22 else body)
        for xx in range(x0, x0 + 6): put(xx, 35, edge_r)
    return cv

def _train_line(n, stripe):
    """parts_vehicles.train(R4 합격 열차)를 그대로 부른다 — 지붕 윗면 띠(에어컨 박스) + 옆면 + 대차 + 레일 윗면. 줄 색만 stripe. 후처리 리샘플 없음(알파 0/255)."""
    cv = PV.train(n, stripe)
    return _train_door(cv)

def train8_y():
    """총무선(황색 줄) 8칸 x 4칸 128x64. R4 합격 train() 기반."""
    return _train_line(8, 'kii')
def train8_g():
    """야마노테(녹색 줄)."""
    return _train_line(8, 'midori')
def train8_b():
    """경빈동북(하늘색 줄)."""
    return _train_line(8, 'sora')


# ───────────────────────── 간판·가챠·네온 ─────────────────────────
def _panel(c, x, y, w, h, col):
    c.R(x, y, w, h, K(col, 1)); c.VL(x, y, h, K(col, 3)); c.VL(x + w - 1, y, h, K(col, -1)); c.HL(x, y + h - 1, w, K(col, -2)); c.HL(x, y, w, K(col, 2))

_LIGHT_BG = ('kii', 'daidai', 'pinku', 'shiro', 'mado')
def _fg_for(col): return K('tekko', -3) if col in _LIGHT_BG else K('shiro', 4)

def blade_sign(v=0):
    """袖看板 16x48 (1x3칸): 윗면 + 색 칸 3개 적층. 맨 위 칸은 흰 바탕에 색 한자 1자, 가운데·아래 칸은 색면 + 줄/원 마크. 칸 사이 금속 틀 + 왼쪽 벽 걸이."""
    spec = [('aka', 'kii', 'sora', '光'), ('midori', 'pinku', 'kii', '花'), ('sora', 'aka', 'midori', '茶'), ('murasaki', 'daidai', 'kii', '店')][v % 4]
    ca, cb, cc, ch = spec
    c = Cv(16, 48)
    c.R(0, 0, 16, 3, K('tekko', 2)); c.HL(0, 0, 16, K('tekko', 5)); c.HL(0, 2, 16, K('tekko', -2))                       # 윗면(금속 덮개)
    _panel(c, 0, 3, 16, 19, ca)
    c.R(0, 22, 16, 1, K('tekko', 1)); c.HL(0, 22, 16, K('tekko', 3))
    _panel(c, 0, 23, 16, 11, cb)
    c.R(0, 34, 16, 1, K('tekko', 1)); c.HL(0, 34, 16, K('tekko', 3))
    _panel(c, 0, 35, 16, 11, cc)
    c.R(0, 46, 16, 2, K('tekko', 1)); c.HL(0, 46, 16, K('tekko', 3)); c.HL(0, 47, 16, K('tekko', -3))                   # 아래 마감
    out = ink2(c, ext=False)
    gl(out, 0, 4, ch, _fg_for(ca), bold=True, clip=(1, 15))                                                            # 한자 1자: 단색 흰 획. .0/.1/.3 은 그림자 없음 → 획 사이는 배경색 그대로
    fb, fc = _fg_for(cb), _fg_for(cc)
    for k in range(3): out.R(3, 26 + k * 3, 10, 2, fb)                                                                 # 줄 마크 3개
    disc(out, 8, 40.5, 3.6, fc); disc(out, 8, 40.5, 1.6, K(cc, 1))                                                    # 원 마크
    for yy in (25, 38):                                                                                                 # 벽 걸이(왼쪽 금속 판 + 리벳)
        out.R(0, yy, 3, 5, K('tekko', 0)); out.VL(0, yy, 5, K('tekko', 2)); out.P(1, yy + 2, K('tekko', 4))
    return out

def _gacha_body(c, x0, y0, col):
    c.R(x0, y0, 12, 12, K(col, 1)); c.VL(x0, y0, 12, K(col, 3)); c.VL(x0 + 11, y0, 12, K(col, -1)); c.HL(x0, y0, 12, K(col, 3)); c.HL(x0, y0 + 11, 12, K(col, -2))
    c.R(x0 + 1, y0 + 8, 10, 3, K('tekko', -2)); c.HL(x0 + 1, y0 + 8, 10, K('tekko', 1))

def _gacha_dome(o, x0, y0, caps):
    """반구형 투명 캡슐 창(윤곽 뒤에 얹는다): 돔 + 캡슐 + 반사 + 코인 손잡이 + 배출구."""
    cx, cy = x0 + 6, y0 + 4.2
    for yy in range(y0, y0 + 8):
        for xx in range(x0 + 1, x0 + 11):
            d = ((xx + .5 - cx) / 4.7) ** 2 + ((yy + .5 - cy) / 3.9) ** 2
            if d <= 1: o.P(xx, yy, K('garasu', 4) if d > .62 else K('garasu', 2))
    for k, (dx, dy) in enumerate(((3, 3), (5, 2), (7, 3), (4, 5), (6, 5))):
        cc = caps[k % len(caps)]
        o.R(x0 + dx, y0 + dy, 2, 2, K(cc, 2)); o.P(x0 + dx, y0 + dy, K(cc, 4)); o.P(x0 + dx + 1, y0 + dy + 1, K(cc, 0))
    o.P(x0 + 2, y0 + 2, K('shiro', 4)); o.P(x0 + 3, y0 + 1, K('shiro', 4))
    o.R(x0 + 2, y0 + 9, 3, 1, K('conc', 4)); o.P(x0 + 3, y0 + 10, K('conc', 5)); o.R(x0 + 7, y0 + 9, 3, 2, K('sumi', 0))

def gacha_wall():
    """가챠 자판기 벽 64x32 (4x2칸): 2단 x 5대 = 10대, 본체 색 줄 변주, 윗면, 단 사이 선반. 막힘열 (0,1,2,3)."""
    c = Cv(64, 32)
    c.R(1, 1, 62, 2, K('tekko', 3)); c.HL(1, 1, 62, K('tekko', 5)); c.HL(1, 2, 62, K('tekko', 1))                      # 윗면
    c.R(1, 15, 62, 2, K('tekko', 2)); c.HL(1, 15, 62, K('tekko', 4)); c.HL(1, 16, 62, K('tekko', -2))                   # 선반
    c.R(1, 29, 62, 2, K('tekko', 1)); c.HL(1, 29, 62, K('tekko', 3)); c.HL(1, 30, 62, K('tekko', -3))                   # 받침
    rows = [['aka', 'sora', 'kii', 'midori', 'pinku'], ['sora', 'daidai', 'aka', 'murasaki', 'kii']]
    caps = [['aka', 'kii', 'sora', 'midori'], ['pinku', 'shiro', 'kii', 'sora'], ['aka', 'shiro', 'midori', 'pinku'], ['kii', 'sora', 'aka', 'shiro'], ['midori', 'aka', 'kii', 'pinku']]
    for r, y0 in enumerate((3, 17)):
        for k in range(5): _gacha_body(c, 2 + k * 12, y0, rows[r][k])
    o = ink2(c)
    for r, y0 in enumerate((3, 17)):
        for k in range(5): _gacha_dome(o, 2 + k * 12, y0, caps[(k + r * 2) % 5])
    return o

def _neon_board(c, x, y, w, h, col):
    """네온 간판 판(3/4): 윗면 3px(밝은 단, 오른쪽 옆면 폭까지) + 앞면(틀 + 어두운 안쪽 면) + 오른쪽 옆면 2px(어둡다). 반환: 안쪽 어두운 면의 (x, y, w, h)."""
    c.R(x, y, w + 2, 3, K(col, 1))                                                                                                           # 윗면 자리(그림은 윤곽 뒤 _neon_top 이 얹는다)
    c.R(x, y + 3, w, h - 3, K(col, 1)); c.VL(x, y + 3, h - 3, K(col, 3)); c.VL(x + w - 1, y + 3, h - 3, K(col, -1)); c.HL(x, y + h - 1, w, K(col, -2))
    c.R(x + w, y + 3, 2, h - 3, K(col, -2)); c.VL(x + w + 1, y + 3, h - 3, K(col, -3)); c.HL(x + w, y + h - 1, 2, K(col, -3))                      # 오른쪽 옆면 2px
    ix, iy, iw, ih = x + 3, y + 6, w - 6, h - 9
    c.R(ix, iy, iw, ih, K('sumi', 0)); c.HL(ix, iy, iw, K('sumi', -1)); c.VL(ix, iy, ih, K('sumi', -1))
    for (px, py) in ((x + 1, y + 4), (x + w - 2, y + 4), (x + 1, y + h - 2), (x + w - 2, y + h - 2)): c.P(px, py, K('shiro', 3))
    return ix, iy, iw, ih

def _outline(o):
    """윤곽 뒤에 얹은 조각까지 포함해 바깥 1px 어두운 윤곽을 다시 두른다(알파 0/255 유지)."""
    al = o.a[..., 3] > 0; pad = np.pad(al, 1)
    nb = pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:]
    o.a[nb & ~al] = (*rgb(DARK()), 255)
    return o

def _neon_top(o, x, y, w, col):
    """윗면 3px(밝은 단): 맨 윗줄 가장 밝게, 앞 모서리 쪽 한 단 어둡게, 오른쪽 끝은 옆면으로 접히는 어두운 모서리. 윤곽 뒤에 얹어 잉크가 먹지 않는다."""
    o.R(x, y, w + 2, 1, K(col, 4)); o.R(x, y + 1, w + 2, 1, K(col, 3)); o.R(x, y + 2, w + 2, 1, K(col, 2))
    o.P(x + w, y, K(col, 3)); o.P(x + w + 1, y, K(col, 2)); o.P(x + w + 1, y + 1, K(col, 1)); o.P(x + w + 1, y + 2, K(col, 0))

def akiba_neon(col='aka'):
    """라디오회관식 세로 네온 간판 적층 32x96 (2x6칸): 폭 26 + 옆면 2px, 판 4장(한자판 2 + 마크판 2) 빈틈 없이 적층, 판마다 윗면 3px, 6px 기둥·받침."""
    c = Cv(32, 96); neon = K('aka', 4) if col == 'aka' else K('neonC', 2); neon2 = K('aka', 0) if col == 'aka' else K('sora', -1)
    c.R(13, 70, 6, 21, K('tekko', 2)); c.VL(13, 70, 21, K('tekko', 4)); c.VL(14, 70, 21, K('tekko', 3)); c.VL(18, 70, 21, K('tekko', -1))             # 기둥 6px
    c.R(8, 90, 16, 2, K('conc', 3)); c.HL(8, 90, 16, K('shiro', 4)); c.R(8, 92, 16, 3, K('conc', 0)); c.VL(8, 92, 3, K('conc', 2)); c.VL(23, 92, 3, K('conc', -2)); c.HL(8, 94, 16, K('conc', -2))
    layout = [(1, 27, '秋' if col == 'aka' else '街'), (28, 14, 'circ'), (42, 27, '店' if col == 'aka' else '楽'), (69, 14, 'bar')]
    outs = []
    for (y, h, kind) in layout:
        outs.append((y, h, kind, _neon_board(c, 2, y, 26, h, col)))
    out = ink2(c, ext=False)
    for (y, h, kind, (ix, iy, iw, ih)) in outs:
        _neon_top(out, 2, y, 26, col)
        if kind in ('circ',):                                                                                           # 마크: 링 3개
            for k in range(3):
                cx = ix + 3.5 + k * 6.5
                disc(out, cx, iy + ih / 2, 3.0, neon); disc(out, cx, iy + ih / 2, 1.6, K('sumi', 0))
        elif kind == 'bar':                                                                                             # 마크: 굵은 가로선 2줄
            out.R(ix + 2, iy + 1, iw - 4, 2, neon); out.R(ix + 2, iy + ih - 3, iw - 4, 2, neon)
            out.R(ix + 4, iy + ih // 2 - 1, iw - 8, 2, neon2)
        else:
            gx = ix + (iw - 17) // 2; gy = iy + (ih - 16) // 2
            for yy, xx in zip(*np.nonzero(glyph(kind))):
                out.P(gx + xx + 1, gy + yy + 1, neon2)                                                                  # 네온관 그림자(오른쪽 아래)
            for yy, xx in zip(*np.nonzero(glyph(kind))):
                out.P(gx + xx, gy + yy, neon); out.P(gx + xx + 1, gy + yy, neon)                                       # 굵기 2px 연속선
    return _outline(out)

def akiba_neon_r(): return akiba_neon('aka')
def akiba_neon_b(): return akiba_neon('sora')

def gaado_light():
    """가드 하부 점포 앞 전구 줄 + 간판 한 장 막대 16x32 (1x2칸): 간판 막대(윗면+앞면, 글자 없는 색 막대) + 기둥 + 간판 끝에서 기둥 중간으로 처지는 노란 전구 줄."""
    c = Cv(16, 32)
    c.R(7, 9, 2, 20, K('tekko', 2)); c.VL(7, 9, 20, K('tekko', 4)); c.VL(8, 9, 20, K('tekko', 0))                         # 기둥
    c.R(4, 28, 8, 2, K('hodo', 4)); c.HL(4, 28, 8, K('shiro', 3)); c.HL(4, 29, 8, K('hodo', -1))                           # 받침
    c.R(1, 2, 14, 2, K('kii', 3)); c.HL(1, 2, 14, K('shiro', 4))                                                       # 간판 윗면
    c.R(1, 4, 14, 5, K('aka', 1)); c.VL(1, 4, 5, K('aka', 3)); c.VL(14, 4, 5, K('aka', -1)); c.HL(1, 8, 14, K('aka', -2))
    for xx in (4, 7, 10): c.R(xx, 5, 2, 2, K('shiro', 3))                                                              # 글자 대신 흰 막대 표지
    out = ink2(c)
    for xa, s_ in ((0, 1), (15, -1)):                                                                                   # 간판 바깥 끝 → 기둥 중간 높이로 처지는 줄
        for i in range(8):
            y = 11 + (i * 5) // 7 + (1 if i in (2, 3, 4) else 0)
            out.P(xa + s_ * i, y, K('tekko', 3))
        for i in (1, 4, 7):
            y = 11 + (i * 5) // 7 + (1 if i in (2, 3, 4) else 0)
            out.R(xa + s_ * i, y + 1, 1, 2, K('kii', 4)); out.P(xa + s_ * i, y + 3, K('kii', 2))
    return out

def maid_flyer_stand():
    """메이드 카페 A형 입간판 16x16 (1x1칸): 윗면 3px(밝은 덮개) + 흰 틀 + 분홍 판(아래로 벌어짐) + 흰 하트, 판보다 바깥으로 벌어진 A자 다리 2개 + 접지선. 막힘열 (0,)."""
    c = Cv(16, 16)
    c.R(3, 1, 10, 1, K('shiro', 4)); c.R(2, 2, 12, 1, K('shiro', 3)); c.R(2, 3, 12, 1, K('conc', 2))                       # 윗면 3px (뒤쪽 밝은 줄 → 앞 모서리 한 단 어둡게)
    for j in range(9):                                                                                                     # 판: 위가 한 칸 좁고 아래로 벌어진다
        ins = 1 if j < 2 else 0
        c.R(2 + ins, 4 + j, 12 - 2 * ins, 1, K('shiro', 2))
        c.R(3 + ins, 4 + j, 10 - 2 * ins, 1, K('pinku', 1))
        c.P(2 + ins, 4 + j, K('shiro', 4)); c.P(13 - ins, 4 + j, K('conc', 0)); c.P(12 - ins, 4 + j, K('pinku', -1)); c.P(3 + ins, 4 + j, K('pinku', 3))
    c.HL(2, 12, 12, K('conc', 0)); c.HL(3, 11, 10, K('pinku', -2))
    c.R(2, 13, 2, 1, K('tekko', 2)); c.R(12, 13, 2, 1, K('tekko', -1))                                                     # A자 다리 (판보다 바깥으로)
    for x in range(1, 15): c.P(x, 14, K('hodo', -2))                                                                       # 접지선
    o = ink2(c)
    heart = ('.XX..XX.', 'XXXXXXXX', '.XXXXXX.', '..XXXX..', '...XX...')
    for j, row in enumerate(heart):
        for i, ch in enumerate(row):
            if ch == 'X': o.P(4 + i, 6 + j, K('shiro', 4))
    return o

def smoking_area():
    """흡연소 32x32 (2x2칸): 유리 칸막이 부스(윗면 림 4px + 오른쪽 옆면 2px + 유리 앞면 + 받침대) + 바닥 노란 경계선 + 앞쪽 바닥에 선 기둥형 재떨이(윗면 타원 + 연기 구멍 + 빨간 띠). 막힘열 (0,1)."""
    c = Cv(32, 32)
    c.R(1, 24, 30, 6, K('hodo', 3)); c.HL(1, 24, 30, K('kii', 3)); c.HL(1, 29, 30, K('kii', 2)); c.VL(1, 24, 6, K('kii', 3)); c.VL(30, 24, 6, K('kii', 2))    # 지정 구역 바닥
    # 부스: 윗면 림 4px(뒤쪽 밝은 줄 → 앞 모서리 한 단 어둡게) · 오른쪽 옆면 2px
    c.R(3, 3, 26, 1, K('shiro', 4)); c.R(2, 4, 28, 2, K('conc', 4)); c.R(2, 6, 28, 1, K('conc', 1))
    c.R(2, 7, 28, 14, K('garasu', 1))                                                                                    # 유리 앞면
    for q in range(5): c.P(5 + q, 16 - q, K('garasu', 4)); c.P(19 + q, 16 - q, K('garasu', 4))                            # 대각 반사
    c.R(2, 7, 2, 17, K('tekko', 3)); c.R(14, 7, 2, 14, K('tekko', 2)); c.R(26, 7, 2, 17, K('tekko', 1))                  # 기둥(왼쪽 밝고 오른쪽 어둡다)
    c.VL(2, 7, 17, K('tekko', 5)); c.VL(14, 7, 14, K('tekko', 4)); c.VL(26, 7, 14 + 3, K('tekko', 3))
    c.R(28, 7, 2, 17, K('tekko', -2)); c.VL(29, 7, 17, K('tekko', -3))                                                    # 오른쪽 옆면 2px
    c.R(2, 21, 26, 3, K('tekko', 1)); c.HL(2, 21, 26, K('tekko', 4)); c.HL(2, 23, 26, K('tekko', -2))                     # 받침대
    # 기둥형 재떨이: 바닥 위(앞) — 윗면 타원 + 몸통 + 빨간 띠
    c.R(12, 17, 8, 10, K('conc', 1)); c.VL(12, 17, 10, K('conc', 3)); c.VL(13, 17, 10, K('shiro', 2)); c.VL(19, 17, 10, K('conc', -2))
    c.R(12, 21, 8, 2, K('aka', 1)); c.VL(12, 21, 2, K('aka', 3)); c.VL(19, 21, 2, K('aka', -1))
    c.HL(12, 26, 8, K('conc', -2))
    ellipse(c, 16, 17, 4.5, 2, K('conc', 4), K('shiro', 4), K('conc', 2))
    for x in range(3, 30): c.P(x, 30, K('hodo', -2))                                                                       # 접지 그림자 1줄
    o = ink2(c)
    ellipse(o, 16, 17, 2.6, 1, K('sumi', 0))
    return o

def signal_overhead():
    """신호기 폴 한 쌍 64x48 (4x3칸): 왼 폴 + 가로 팔(차량 신호 3구) / 오른 폴 + 반대 팔(차량 신호 3구), 두 폴 모두 보행 신호함·押ボタン. 막힘열 (0,3)."""
    c = Cv(64, 48)
    def pole(x):                                                                                                       # 4px 폭: 왼쪽 밝은 단 → 오른쪽 어두운 단 (빛은 왼쪽 위)
        for k, t in enumerate((4, 2, 0, -2)): c.VL(x + k, 4, 40, K('tekko', t))
        c.R(x - 2, 44, 8, 2, K('hodo', 4)); c.HL(x - 2, 44, 8, K('shiro', 3)); c.HL(x - 2, 45, 8, K('hodo', -1))
    def arm(x0, x1):
        c.R(x0, 4, x1 - x0, 1, K('tekko', 5)); c.R(x0, 5, x1 - x0, 3, K('tekko', 2)); c.HL(x0, 7, x1 - x0, K('tekko', -2))
    def head(x, lit):
        c.R(x, 9, 18, 8, K('tekko', -3)); c.HL(x, 9, 18, K('tekko', 0)); c.VL(x, 10, 7, K('tekko', -1))
        for i, col in enumerate(('midori', 'kii', 'aka')):
            cx = x + 2 + i * 5
            c.R(cx, 11, 4, 4, K(col, 3) if i == lit else K(col, -2)); 
            if i == lit: c.P(cx, 11, K('shiro', 4))
            c.HL(cx - 1, 10, 6, K('tekko', 1))                                                                         # 차양
        c.R(x + 16, 9, 2, 8, K('tekko', -2))
    def ped(x, red):
        c.R(x, 22, 8, 14, K('tekko', -3)); c.HL(x, 22, 8, K('tekko', 1)); c.VL(x, 23, 13, K('tekko', -1))
        c.R(x + 2, 24, 4, 5, K('aka', 3) if red else K('aka', -2)); c.R(x + 2, 30, 4, 5, K('midori', -1) if red else K('midori', 3))
        if red: c.R(x + 3, 25, 2, 3, K('shiro', 3))
        else: c.R(x + 3, 31, 2, 3, K('shiro', 3))
    pole(3); arm(6, 40); head(14, 2)
    pole(57); arm(24, 61); head(36, 0)
    ped(8, True); ped(48, False)
    c.R(8, 38, 3, 4, K('kii', 2)); c.HL(8, 38, 3, K('kii', 4))                                                          # 押ボタン (왼)
    c.R(53, 38, 3, 4, K('kii', 2)); c.HL(53, 38, 3, K('kii', 4))
    return ink2(c)


# ───────────────────────── 가부키초 LED 빌딩 · 오모이데 아치 · 가드 터널 ─────────────────────────
def _led_mask(w, h, kind):
    """LED 패널 기호 한 개(알파 없는 0/1 마스크). 기호는 하나뿐 — 화살표(0) · 재생 원(1) · 막대 오름차(2) · 번개(3) · 전광판 쉐브론(4)."""
    from PIL import Image as _I, ImageDraw as _D
    m = _I.new('L', (w, h), 0); d = _D.Draw(m); cx, cy = w / 2.0, h / 2.0
    if kind == 0:                                                                                                     # 오른쪽 화살표(머리는 행 단위로 대칭)
        hh = max(3, h // 2 - 3); hl = hh + 1; tip = w - 5; ci = int(cy)
        d.rectangle([5, ci - 1, tip - hl, ci + 1], fill=1)
        for i in range(hl + 1):
            half = (hh * (hl - i) + hl // 2) // hl if False else hh - (hh * i) // hl
            d.rectangle([tip - hl + i, ci - half, tip - hl + i, ci + half], fill=1)
    elif kind == 1:                                                                                                   # 재생 원: 흰 원 + 어두운 삼각(행 단위 대칭)
        r = min(w, h) / 2.0 - 3; d.ellipse([cx - r, cy - r, cx + r - 1, cy + r - 1], fill=1)
        ci = int(cy); th = int(r * .6); x0 = int(cx - r * .3)
        for i in range(th + 1):
            half = th - i
            d.rectangle([x0 + i, ci - half, x0 + i, ci + half], fill=2)
    elif kind == 2:                                                                                                   # 막대 4개 오름차 + 바닥선
        n = 4; bw = max(2, (w - 12) // (n * 2 - 1)); base = h - 4
        for k in range(n):
            x0 = 6 + k * bw * 2; hgt = int((h - 8) * (k + 1) / n)
            d.rectangle([x0, base - hgt, x0 + bw - 1, base - 1], fill=1)
        d.rectangle([4, base, w - 5, base], fill=1)
    elif kind == 3:                                                                                                   # 번개
        sx = h / 24.0 if h < 24 else 1.0; tx = lambda px, py: (cx + px * sx, cy + py * sx)
        d.polygon([tx(3, -10), tx(-5, 1), tx(-1, 1), tx(-4, 10), tx(5, -2), tx(1, -2)], fill=1)
    else:                                                                                                             # 전광판 글줄: 같은 폭 블록 5개
        for k in range(5): d.rectangle([4 + k * 7, cy - 1, 4 + k * 7 + 4, cy], fill=1)
    return np.array(m)

def _led_panel(c, x, y, w, h, col):
    """영상 패널 바탕: 단색 면 + 얇은 밝은 줄(그라데이션 없음). 윗 모서리 1px 빛, 아래 1px 그늘. 기호는 윤곽 뒤 _led_symbol 이 얹는다."""
    c.R(x, y, w, h, K(col, 1)); c.HL(x, y, w, K(col, 3)); c.HL(x, y + h - 1, w, K(col, -1)); c.VL(x, y, h, K(col, 2)); c.VL(x + w - 1, y, h, K(col, 0))

def _led_symbol(o, x, y, w, h, col, kind):
    """패널 위 기호 한 개(윤곽 뒤에 얹어 잉크가 먹지 않는다)."""
    lt = K('shiro', 4) if col not in ('kii', 'daidai', 'pinku') else K('shiro', 3)
    dk = K(col, -2)
    m = _led_mask(w - 4, h - 4, kind)
    for yy, xx in zip(*np.nonzero(m)):
        o.P(x + 2 + xx, y + 2 + yy, lt if m[yy, xx] == 1 else dk)

def led_tower(v=0):
    """가부키초 대형 LED 외벽 빌딩 48x128 (3x8칸): 옥상 광고탑(윗면 3px + 오른쪽 옆면 2px) + 지붕 턱 6px(윗면·해칭 줄·처마선) + 어두운 외벽에 영상 패널 3장 + 1층 캐노피 윗면 4px + 2칸 폭 유리문 입구. 막힘열 (0,1,2)."""
    cols = [('aka', 'sora', 'kii'), ('murasaki', 'midori', 'daidai')][v % 2]
    kinds = [(0, 1, 2), (3, 2, 0)][v % 2]                                                                              # (패널1, 패널2, 옥상 광고탑) 기호
    c = Cv(48, 128)
    t0 = cols[2]
    # 옥상 광고탑: 윗면 3px · 앞면(왼쪽 밝고 오른쪽 어둡다) · 오른쪽 옆면 2px · 다리 2개
    c.R(10, 2, 28, 3, K(t0, 3)); c.HL(10, 2, 28, K('shiro', 4)); c.HL(10, 4, 28, K(t0, 2)); c.P(37, 3, K(t0, 1)); c.P(37, 4, K(t0, 0))
    _led_panel(c, 10, 5, 26, 18, t0); c.VL(10, 5, 18, K(t0, 3)); c.VL(35, 5, 18, K(t0, -1))
    c.R(36, 5, 2, 18, K(t0, -2)); c.VL(37, 5, 18, K(t0, -3)); c.HL(36, 22, 2, K(t0, -3))
    c.R(13, 23, 3, 5, K('tekko', 1)); c.VL(13, 23, 5, K('tekko', 3)); c.R(32, 23, 3, 5, K('tekko', 0))
    # 지붕 턱 6px: 윗면 밝은 띠 + 해칭 줄 + 앞쪽 처마선(어둡게) + 옥상 설비 2개
    c.R(0, 28, 48, 6, K('conc', 3)); c.HL(0, 28, 48, K('shiro', 4)); c.HL(0, 29, 48, K('conc', 4)); c.HL(0, 31, 48, K('conc', 2)); c.HL(0, 32, 48, K('conc', 1)); c.HL(0, 33, 48, K('conc', -1))
    for xx in range(2, 46, 6): c.HL(xx, 30, 3, K('conc', 2))                                                           # 해칭 줄(3px 대시)
    c.R(4, 29, 5, 2, K('conc', 1)); c.HL(4, 29, 5, K('conc', 3)); c.R(39, 29, 6, 2, K('conc', 1)); c.HL(39, 29, 6, K('conc', 3))
    # 어두운 외벽
    c.R(0, 34, 48, 68, K('tekko', -2)); c.VL(0, 34, 68, K('tekko', 0)); c.VL(47, 34, 68, K('tekko', -3))
    c.HL(0, 34, 48, K('tekko', 1))
    # 패널 3장 (층 사이 띠에 걸치지 않게)
    _led_panel(c, 4, 38, 40, 24, cols[0])
    _led_panel(c, 4, 66, 40, 24, cols[1])
    for yy in (63, 91): c.HL(0, yy, 48, K('tekko', 1)); c.HL(0, yy + 1, 48, K('tekko', -3))
    # 1층(높이 30px): 캐노피 윗면 4px + 앞 처마 + 폭 30px 단일 유리문(높이 24px) + 양옆 쇼윈도 + 기단
    c.R(0, 94, 48, 5, K('conc', 3)); c.HL(0, 94, 48, K('shiro', 4)); c.HL(0, 95, 48, K('conc', 4)); c.HL(0, 97, 48, K('conc', 1)); c.HL(0, 98, 48, K('conc', -1))
    c.R(0, 99, 48, 25, K('tekko', -3))
    c.R(9, 100, 30, 24, K('tekko', -1)); c.R(10, 101, 28, 23, K('mado', 0)); c.R(10, 101, 28, 2, K('mado', -1))        # 단일 유리문 (30px 폭 x 24px 높이) + 안 불빛
    c.VL(9, 100, 24, K('tekko', 3)); c.VL(38, 100, 24, K('tekko', -1)); c.HL(9, 100, 30, K('tekko', 2))
    c.R(14, 106, 20, 12, K('mado', 1))                                                                      # 문 유리 반사 면(문 1개)
    for xx in (2, 41): c.R(xx, 104, 5, 14, K('garasu', 1)); c.HL(xx, 104, 5, K('garasu', 3)); c.VL(xx, 104, 14, K('garasu', 2))   # 양옆 창
    c.R(0, 124, 48, 3, K('conc', 1)); c.HL(0, 124, 48, K('conc', 3)); c.HL(0, 126, 48, K('conc', -2))                  # 기단 / 보도
    o = ink2(c)
    _led_symbol(o, 4, 38, 40, 24, cols[0], kinds[0]); _led_symbol(o, 4, 66, 40, 24, cols[1], kinds[1]); _led_symbol(o, 10, 5, 26, 18, t0, kinds[2])
    return o

def led_tower_0(): return led_tower(0)
def led_tower_1(): return led_tower(1)

def omoide_gate():
    """오모이데요코초 입구 아치 96x48 (6x3칸): 함석 지붕(윗면 골판 + 앞 처마) + 보에 걸린 간판 막대(글자 없음) + 적색 초롱 2개 + 양쪽 목조 벽(남색 노렌) + 가운데 좁은 통로(안쪽 불빛). 막힘열 (0,1,4,5)."""
    c = Cv(96, 48)
    # 함석 지붕: 윗면(골이 세로로 3px 주기) 사다리꼴 + 앞 처마 띠
    for j in range(10):
        ins = 3 - j // 4
        for x in range(2 + ins, 94 - ins):
            k = (x - 2) % 4
            c.P(x, 2 + j, K('hodo', 3 if k == 0 else 2 if k < 3 else 1) if j > 0 else K('hodo', 5))
    c.HL(3, 12, 90, K('hodo', 5)); c.R(1, 12, 94, 4, K('hodo', 1)); c.HL(1, 12, 94, K('hodo', 4)); c.HL(1, 15, 94, K('hodo', -1))
    for x in range(2, 94, 4): c.VL(x, 13, 2, K('hodo', 3)); c.VL(x + 1, 13, 2, K('hodo', 0))
    # 보 + 간판 막대
    c.R(4, 16, 88, 3, K('ita', 0)); c.HL(4, 16, 88, K('ita', 3)); c.HL(4, 18, 88, K('ita', -2))
    c.R(26, 19, 44, 9, K('kon', 1)); c.HL(26, 19, 44, K('kon', 3)); c.VL(26, 19, 9, K('kon', 3)); c.VL(69, 19, 9, K('kon', -1)); c.HL(26, 27, 44, K('kon', -2))
    for xx in range(32, 64, 6): c.R(xx, 22, 4, 3, K('shiro', 3)); c.HL(xx, 22, 4, K('shiro', 4))                     # 글자 대신 흰 막대 표지
    # 양쪽 벽 (목조 + 남색 노렌) + 기둥
    for (x0, x1, lit) in ((4, 28, True), (68, 92, False)):
        c.R(x0, 19, x1 - x0, 25, K('ita', -1)); c.HL(x0, 28, x1 - x0, K('ita', -3))
        for xx in range(x0 + 2, x1 - 1, 6): c.VL(xx, 29, 15, K('ita', -2)); c.VL(xx + 1, 29, 15, K('ita', 1))             # 판벽
        c.R(x0 + 2, 29, x1 - x0 - 4, 9, K('kon', 0)); c.HL(x0 + 2, 29, x1 - x0 - 4, K('kon', 2))                          # 노렌
        for xx in range(x0 + 6, x1 - 4, 5): c.VL(xx, 30, 8, K('kon', -1))
        for xx in range(x0 + 4, x1 - 4, 5): c.R(xx, 33, 2, 2, K('shiro', 3))
    for xx in (4, 26, 68, 90): 
        c.R(xx, 19, 2, 27, K('ita', 2)); c.VL(xx, 19, 27, K('ita', 4)); c.VL(xx + 1, 19, 27, K('ita', -2))
    # 통로: 안쪽 어두운 사각 + 더 안쪽 불빛 + 바닥
    c.R(30, 28, 36, 16, K('yoru', -3)); c.R(34, 31, 28, 13, K('yoru', -2)); c.R(40, 33, 16, 11, K('mado', 0)); c.R(40, 33, 16, 2, K('mado', -1)); c.R(44, 35, 8, 9, K('mado', 2))
    c.R(30, 44, 36, 3, K('hodo', 1)); c.HL(30, 44, 36, K('hodo', 4)); c.HL(30, 46, 36, K('hodo', -1)); c.R(4, 44, 26, 3, K('hodo', 2)); c.R(66, 44, 26, 3, K('hodo', 2))
    c.HL(4, 44, 26, K('hodo', 4)); c.HL(66, 44, 26, K('hodo', 4)); c.HL(4, 46, 26, K('hodo', -1)); c.HL(66, 46, 26, K('hodo', -1))
    o = ink2(c)
    for cx in (19, 77): chochin(o, cx, 24, 8, 11, 'aka')                                            # 적색 초롱 2개 (처마 아래에서 늘어짐)
    for cx in (19, 77): o.VL(cx, 19, 5, K('tekko', 3))
    return o

def guard_tunnel():
    """신주쿠 철도 아래 보행자 터널 입구 64x64 (4x4칸): 위 레일 윗면 + 거더 + 고가 벽 + 사각 터널(안쪽으로 세 겹, 조명 점, 보도색 바닥). 막힘열 (0,3)."""
    c = Cv(64, 64)
    c.R(0, 0, 64, 8, K('hodo', 0))
    for x in range(0, 64, 5): c.R(x, 1, 3, 5, K('ita', -2))
    c.HL(0, 2, 64, K('tekko', 4)); c.HL(0, 3, 64, K('tekko', 2)); c.HL(0, 5, 64, K('tekko', 4)); c.HL(0, 6, 64, K('tekko', 2)); c.HL(0, 0, 64, K('conc', 3)); c.HL(0, 7, 64, K('conc', 0))
    c.R(0, 8, 64, 11, K('conc', 2)); c.HL(0, 8, 64, K('conc', 5)); c.HL(0, 9, 64, K('conc', 4)); c.HL(0, 18, 64, K('conc', -1))
    for x in range(4, 64, 12): c.R(x, 12, 2, 2, K('conc', 4)); c.P(x, 12, K('shiro', 3))
    c.R(0, 19, 64, 43, K('conc', 1)); c.VL(0, 19, 43, K('conc', 3)); c.VL(63, 19, 43, K('conc', -2))
    for yy in (30, 41, 52): c.HL(1, yy, 62, K('conc', 0))                                                                # 벽 이음 줄
    # 터널: 바깥 틀 (x 16..48, y 19..62)
    tx0, tx1 = 16, 48
    c.R(tx0 - 2, 19, tx1 - tx0 + 4, 41, K('conc', 4)); c.VL(tx0 - 2, 19, 41, K('shiro', 3)); c.VL(tx1 + 1, 19, 41, K('conc', 0))
    c.R(tx0, 22, tx1 - tx0, 38, K('yoru', -3))
    c.R(tx0, 22, tx1 - tx0, 3, K('tekko', -3)); c.R(tx0 + 4, 25, tx1 - tx0 - 8, 3, K('yoru', -2))                         # 천장 겹
    c.R(tx0 + 4, 28, tx1 - tx0 - 8, 28, K('yoru', -2)); c.R(tx0 + 8, 31, tx1 - tx0 - 16, 22, K('garasu', -2)); c.R(tx0 + 11, 33, tx1 - tx0 - 22, 14, K('kinari', 2))     # 안쪽 출구 불빛
    c.R(tx0, 28, 4, 28, K('tekko', -1)); c.R(tx1 - 4, 28, 4, 28, K('tekko', -3))                                          # 좌우 벽(왼쪽이 밝다)
    c.R(tx0 + 4, 28, 4, 28, K('tekko', -2)); c.R(tx1 - 8, 28, 4, 28, K('tekko', -3))
    c.R(tx0, 56, tx1 - tx0, 4, K('hodo', 2)); c.HL(tx0, 56, tx1 - tx0, K('hodo', 4))                                       # 바닥(보도색)
    c.R(tx0 + 8, 52, tx1 - tx0 - 16, 4, K('hodo', 1)); c.HL(tx0 + 8, 52, tx1 - tx0 - 16, K('hodo', 3))
    c.R(tx0 + 6, 58, tx1 - tx0 - 12, 2, K('kii', 2)); c.HL(tx0 + 6, 58, tx1 - tx0 - 12, K('kii', 3))                       # 점자블록 줄
    # 바깥 바닥: 보도 + 연석
    c.R(0, 60, 64, 4, K('hodo', 2)); c.HL(0, 60, 64, K('hodo', 4)); c.HL(0, 63, 64, K('hodo', -1))
    # 측면 벽 장식: 포스터 판 2장 + 배관
    c.R(4, 28, 8, 12, K('shiro', 2)); c.HL(4, 28, 8, K('aka', 3)); c.VL(4, 29, 11, K('shiro', 3)); c.VL(11, 29, 11, K('shiro', 0))
    c.R(52, 28, 8, 12, K('shiro', 2)); c.HL(52, 28, 8, K('sora', 3)); c.VL(52, 29, 11, K('shiro', 3)); c.VL(59, 29, 11, K('shiro', 0))
    c.R(6, 42, 4, 18, K('hodo', 3)); c.VL(6, 42, 18, K('hodo', 5)); c.VL(9, 42, 18, K('hodo', 0))
    o = ink2(c)
    for (x, y) in ((tx0 + 5, 25), (tx0 + 16, 25), (tx0 + 26, 25), (tx0 + 12, 31), (tx0 + 20, 31)):                       # 안쪽 조명 점
        o.R(x, y, 2, 1, K('shiro', 4)); o.P(x, y + 1, K('kii', 3))
    for x in (tx0 + 5, tx1 - 7): o.R(x, 38, 2, 1, K('kinari', 4))
    return o

# ───────────────────────── 등록 ─────────────────────────
def register(reg_prop, reg_deco, add, STREET):
    reg_prop('viaduct6_shops', viaduct6_shops(), (0, 1, 4, 5), '고가 정면(가드 하부 상가: 셔터·노렌·유리 점포 + 전구 줄)')
    reg_prop('viaduct6_pass', viaduct6_pass(), (0, 1, 4, 5), '고가 정면(통로형: 천장 조명·아스팔트·중앙선)')
    reg_prop('viaduct6_shut', viaduct6_shut(), (0, 1, 4, 5), '고가 정면(막힌 형: 셔터·벽·환기구·자전거 주차)')
    reg_prop('catenary_pole', catenary_pole(), (0,), '철도 가선 H형 기둥')
    reg_prop('train8_y', train8_y(), (), '열차 8칸(총무선 황색 줄)')
    reg_prop('train8_g', train8_g(), (), '열차 8칸(야마노테 녹색 줄)')
    reg_prop('train8_b', train8_b(), (), '열차 8칸(경빈동북 하늘색 줄)')
    for i in range(4): reg_prop(f'blade_sign.{i}', blade_sign(i), (), '袖看板(건물 옆 돌출 세로 간판)')
    reg_prop('gacha_wall', gacha_wall(), (0, 1, 2, 3), '가챠 자판기 벽')
    reg_prop('akiba_neon_r', akiba_neon_r(), (0, 1), '라디오회관식 적색 세로 네온 간판')
    reg_prop('akiba_neon_b', akiba_neon_b(), (0, 1), '라디오회관식 청색 세로 네온 간판')
    reg_prop('gaado_light', gaado_light(), (0,), '가드 하부 점포 앞 전구 줄 + 간판 막대')
    reg_prop('maid_flyer_stand', maid_flyer_stand(), (0,), '메이드 카페 입간판')
    reg_prop('smoking_area', smoking_area(), (0, 1), '흡연소')
    reg_prop('signal_overhead', signal_overhead(), (0, 3), '신호기 폴 한 쌍(가로 팔)')
    reg_prop('led_tower.0', led_tower(0), (0, 1, 2), '가부키초 LED 외벽 빌딩 조각 0')
    reg_prop('led_tower.1', led_tower(1), (0, 1, 2), '가부키초 LED 외벽 빌딩 조각 1')
    reg_prop('omoide_gate', omoide_gate(), (0, 1, 4, 5), '오모이데요코초 입구 아치')
    reg_prop('guard_tunnel', guard_tunnel(), (0, 3), '철도 아래 보행자 터널 입구')

def all_parts():
    """검수 시트용: 이름 → Cv."""
    out = {}
    rec = lambda n, cv, b=(), d='': out.__setitem__(n, cv)
    register(rec, lambda n, c: None, lambda *a, **k: None, {})
    return out
