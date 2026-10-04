from v2core import *
from v2temple import _plinth
from jfont import glyph

def _lit(c, cx, cy, r, ramp, rng, hi_i=1, top_i=None):
    """덩이 3단 명암: 밝은 면은 왼위 반쪽에만, 경계는 2~3px 계단 요철(원판·동심 호 금지). 어두운 초승달은 오른쪽 아래."""
    jit = [rng.choice((-1.6, -.6, .6, 1.6)) for _ in range(9)]                      # 각도 구간별 반경 오차 → 덩이마다 다른 계단
    jit2 = [rng.choice((-1.4, -.4, .4, 1.4)) for _ in range(9)]
    def bump(tab, dx, dy):
        a = (math.atan2(dy, dx) + math.pi) / (2 * math.pi)
        return tab[min(8, int(a * 9))]
    for y in range(int(cy - r - 2), int(cy + r + 3)):
        for x in range(int(cx - r - 2), int(cx + r + 3)):
            dx, dy = x + .5 - cx, y + .5 - cy
            if dx * dx + dy * dy > r * r: continue
            hx, hy = x + .5 - (cx - .30 * r), y + .5 - (cy - .30 * r)
            lx, ly = x + .5 - (cx - .10 * r), y + .5 - (cy - .10 * r)
            t = 0
            if math.hypot(lx, ly) > .90 * r + bump(jit2, lx, ly) and dx + dy > .25 * r: t = -1       # 오른쪽 아래만 어둡게
            elif math.hypot(hx, hy) <= .58 * r + bump(jit, hx, hy) and dx + dy < .15 * r: t = hi_i   # 왼쪽 위만 밝게
            if top_i is not None and t == hi_i and math.hypot(x + .5 - (cx - .42 * r), y + .5 - (cy - .46 * r)) <= .22 * r + bump(jit, dx, dy) * 1.0 and dx + dy < -.45 * r: t = top_i
            c.P(x, y, K(ramp, t))

def tree_street(kind='zelkova', seed=1):
    """가로수 4x6칸 (64x96): 덩이마다 계단 요철 명암(왼위 밝음), 단일 줄기, 식수 틀 윗면."""
    c = Cv(64, 96); rng = random.Random(seed * 7 + 3)
    ramp = {'zelkova': 'midori', 'ginkgo': 'kii', 'sakura': 'pinku'}[kind]
    top_i = None if kind == 'ginkgo' else 2                                          # 은행나무는 노랑 채도를 한 단 낮춰 가장 밝은 단을 쓰지 않는다
    c.R(28, 48, 8, 36, K('ita', -1)); c.VL(28, 48, 36, K('ita', 1)); c.VL(35, 48, 36, K('ita', -3)); c.R(26, 80, 12, 4, K('ita', 0)); c.HL(26, 80, 12, K('ita', 2))
    lobes = [(32, 28, 20), (14, 36, 12), (50, 36, 12), (32, 12, 13), (18, 20, 11), (46, 20, 11)]
    for (cx, cy, r) in lobes[1:] + lobes[:1]:
        _lit(c, cx, cy, r, ramp, rng, 1, top_i if (cx, cy) in ((32, 28), (32, 12)) else None)
    ellipse(c, 32, 86, 17, 5, K('soil', 1), K('soil', 2), K('soil', 0))
    c.R(15, 86, 34, 6, K('conc', 3)); c.HL(15, 91, 34, K('conc', -1)); c.VL(15, 86, 6, K('conc', 4)); c.VL(48, 86, 6, K('conc', 0))
    ellipse(c, 32, 85, 15, 4, K('soil', 1), K('soil', 2), K('soil', 0)); c.R(29, 78, 6, 8, K('ita', 0)); c.VL(29, 78, 8, K('ita', 2)); c.VL(34, 78, 8, K('ita', -2))
    c.HL(15, 86, 34, K('shiro', 3))
    return ink2(c)

def hachiko():
    """앉은 아키타견(오른쪽을 본다) + 대좌. 곧은 삼각 귀(안쪽 밝음), 눈 1개, 말린 꼬리, 세로 가슴선과 앞다리 2줄. 32x48."""
    c = Cv(32, 48)
    c.R(4, 38, 24, 3, K('conc', 4)); c.HL(4, 38, 24, K('shiro', 4))
    c.R(5, 41, 22, 3, K('conc', 2)); c.VL(5, 41, 3, K('conc', 4)); c.VL(26, 41, 3, K('conc', -1))
    c.R(2, 44, 28, 3, K('conc', 3)); c.HL(2, 44, 28, K('shiro', 3)); c.HL(2, 46, 28, K('conc', -2))
    rows = [
      [(13, 13), (18, 18)], [(12, 14), (17, 19)], [(12, 14), (17, 19)],
      [(12, 20)], [(12, 20)], [(12, 21)], [(12, 21)], [(13, 20)], [(13, 19)],
      [(12, 20)], [(4, 5), (11, 20)], [(3, 6), (10, 20)], [(3, 6), (9, 20)], [(4, 20)],
      [(5, 20)], [(5, 20)], [(4, 20)], [(4, 20)],
      [(4, 14), (16, 17), (19, 20)], [(4, 14), (16, 17), (19, 20)], [(4, 14), (16, 17), (19, 20)], [(3, 15), (15, 17), (19, 21)]]
    h, w = len(rows), 22
    m = np.zeros((h, w), bool)
    for j, rr in enumerate(rows):
        for (a, b) in rr: m[j, a:b + 1] = True
    for j in range(h):
        for i in range(w):
            if not m[j, i]: continue
            t = 0
            if i == 0 or not m[j, i - 1] or j == 0 or not m[j - 1, i]: t += 1                     # 왼·위 가장자리 밝게
            if i == w - 1 or not m[j, i + 1] or j == h - 1 or not m[j + 1, i]: t -= 1             # 오른·아래 가장자리 어둡게
            if 1 <= j <= 2 and i in (13, 18): t = 2                                               # 귀 안쪽
            if 10 <= j <= 16 and 17 <= i <= 19 and m[j, i + 1]: t = 1                              # 가슴 하이라이트(세로)
            if 14 <= j <= 17 and 6 <= i <= 8: t = 1                                                # 허벅지 둥근 하이라이트
            if j >= 18 and i in (16, 19): t = 1                                                    # 앞다리 2줄 왼쪽 밝게
            if j >= 18 and i in (13, 14): t = -1                                                   # 뒷다리 아래 그늘
            if 5 <= j <= 7 and 18 <= i <= 21: t = 1                                                # 주둥이 밝게
            c.P(5 + i, 15 + j, K('ita', t))
    c.P(5 + 17, 15 + 4, K('sumi', 1)); c.P(5 + 21, 15 + 5, K('sumi', 1))                           # 눈 1개 + 코
    for k in range(w): c.P(5 + k, 15 + h, K('sumi', 0)) if m[h - 1, k] else None                   # 발 밑 접지선
    return ink2(c)

def metro_entrance(label='出口'):
    """지하철 출입구 4x4칸 (64x64): 캐노피 윗면 + 출구 표지 + 아래로 내려가는 계단(안쪽=위는 좁고 어둡고, 바깥=아래는 넓고 밝다) + 난간."""
    W, H = 64, 64; c = Cv(W, H)
    c.R(3, 3, 58, 4, K('conc', 4)); c.HL(3, 3, 58, K('shiro', 4)); c.R(4, 7, 56, 3, K('conc', 2)); c.HL(4, 9, 56, K('conc', -1))
    c.R(6, 10, 52, 18, K('sora', -1)); c.HL(6, 10, 52, K('sora', 1)); c.VL(6, 10, 18, K('sora', 3)); c.VL(57, 10, 18, K('sora', -2)); c.HL(6, 27, 52, K('sora', -2))
    x = 32 - 16 - 1
    c.R(8, 29, 48, 31, K('tekko', -3))
    def inset(y): return 12 - 8.0 * (y - 30) / 29.0                      # 위(안쪽) 폭 20 → 아래(바깥) 폭 36
    for k in range(8):                                                   # 계단: 아래로 갈수록 넓고 밝다
        y = 31 + k * 3; ins = int(round(inset(y + 1))); w = 44 - 2 * ins; tone = -2 + (k * 5 + 3) // 7
        c.R(10 + ins, y, w, 2, K('hodo', tone)); c.HL(10 + ins, y, w, K('hodo', tone + 2)); c.HL(10 + ins, y + 2, w, K('tekko', -3))
    for y in range(30, 60):                                              # 난간: 같은 방향으로 벌어진다
        ins = int(round(inset(y)))
        c.P(10 + ins - 2, y, K('tekko', 4)); c.P(10 + ins - 1, y, K('tekko', 1))
        c.P(53 - ins + 2, y, K('tekko', 1)); c.P(53 - ins + 1, y, K('tekko', 4))
    c.R(2, 60, 60, 3, K('conc', 3)); c.HL(2, 60, 60, K('shiro', 3)); c.HL(2, 62, 60, K('conc', -1))
    out = ink2(c)
    for k, ch in enumerate(label): gl(out, x + k * 17 + 1, 13, ch, K('sora', -2)); gl(out, x + k * 17, 12, ch, K('shiro', 4))   # 그림자 1px, 패널과 가까운 색 (윤곽 처리 뒤)
    return out

def _gl_bold2(c, x, y, ch, col):
    """획을 2px 로 통일: 원 글자(1px 획)를 오른쪽·아래로 한 번 두껍게. 같은 색 단일 레이어라 흰 잡티가 생기지 않는다."""
    g = glyph(ch)
    for yy, xx in zip(*np.nonzero(g)):
        for dx in (0, 1):
            for dy in (0, 1): c.P(x + xx + dx, y + yy + dy, col)

def arch_gate(text='商店街', w=10):
    """보행자 거리 아치: 폭 w칸 x 5칸. 양 기둥(윤곽 통일) + 간판 상자(윗면+앞+밑). 글자는 일반 상가 거리명, 획 2px·그림자 1px."""
    if text == 'センター街': text = '商店街'                                  # 고유 지명 대신 일반 명칭 (빌드가 옛 인수를 넘겨도 바뀐다)
    W, H = 16 * w, 80; c = Cv(W, H)
    for px in (6, W - 16):
        c.R(px, 30, 10, 48, K('tekko', 2)); c.VL(px, 30, 48, K('tekko', 4)); c.VL(px + 9, 30, 48, K('tekko', 0)); c.R(px - 2, 74, 14, 5, K('hodo', 3)); c.HL(px - 2, 74, 14, K('hodo', 5)); c.HL(px - 2, 78, 14, K('hodo', -1))
    c.R(2, 3, W - 4, 4, K('sora', 4)); c.HL(2, 3, W - 4, K('shiro', 4))                                  # 간판 윗면
    c.R(2, 7, W - 4, 24, K('sora', -1)); c.VL(2, 7, 24, K('sora', 3)); c.VL(W - 3, 7, 24, K('sora', -2)); c.HL(2, 30, W - 4, K('sora', -2))
    c.R(5, 10, W - 10, 18, K('sora', 0)); c.HL(5, 10, W - 10, K('sora', 1))
    step = 22; x = (W - step * (len(text) - 1) - 17) // 2
    for i in range(10, W - 10, 8): c.R(i, 4, 3, 2, K('kii', 3))
    out = ink2(c)                                                                                       # 글자는 윤곽 처리 뒤에 얹는다(내부 잉크가 글자에 흰 잡티를 만든다)
    for k, ch in enumerate(text): _gl_bold2(out, x + k * step + 1, 11 + 1, ch, K('sora', -2))       # 그림자 1px
    for k, ch in enumerate(text): _gl_bold2(out, x + k * step, 11, ch, K('shiro', 4))
    return out

def viaduct(w=6):
    """고가 정면: 윗면(자갈+레일 2선) + 앞면 거더 + 교각 + 아치 개구부(깊이: 위 그림자 단·안쪽 벽·뒤 벽 3단·도로 바닥·중앙선)."""
    W, H = 16 * w, 96; c = Cv(W, H)
    c.R(0, 0, W, 10, K('hodo', 0)); 
    for x in range(0, W, 5): c.R(x, 2, 3, 6, K('ita', -2))
    c.HL(0, 3, W, K('tekko', 4)); c.HL(0, 4, W, K('tekko', 2)); c.HL(0, 7, W, K('tekko', 4)); c.HL(0, 8, W, K('tekko', 2))
    c.HL(0, 0, W, K('conc', 3)); c.HL(0, 9, W, K('conc', 0))
    c.R(0, 10, W, 14, K('conc', 2)); c.HL(0, 10, W, K('conc', 5)); c.HL(0, 11, W, K('conc', 4)); c.HL(0, 23, W, K('conc', -1))
    for x in range(4, W, 12): c.R(x, 15, 2, 2, K('conc', 4)); c.P(x, 15, K('shiro', 3))
    ox0, ox1 = 18, W - 18; FB = 93                                       # 교각은 도로 바닥(FB)까지 내려온다
    for rx in (0, W - 18):
        c.R(rx, 24, 18, FB - 23, K('conc', 2)); c.VL(rx, 24, FB - 23, K('conc', 4)); c.VL(rx + 17, 24, FB - 23, K('conc', -1)); c.VL(rx + 1, 24, FB - 23, K('conc', 3))
        c.R(rx, 87, 18, 7, K('conc', 0)); c.HL(rx, 87, 18, K('conc', 2)); c.HL(rx, FB, 18, K('conc', -2))   # 받침: 기둥보다 한 단 어두운 색, 접지선
    # 개구부: 위 그림자 → 3단 뒤 벽(위가 어둡고 아래로 갈수록 밝다) → 도로
    c.R(ox0, 24, ox1 - ox0, 54, K('yoru', -1))
    c.R(ox0, 24, ox1 - ox0, 3, K('tekko', -3)); c.R(ox0, 27, ox1 - ox0, 3, K('yoru', -3))              # 거더 밑면 그림자 2단
    c.R(ox0, 30, ox1 - ox0, 16, K('yoru', -2)); c.R(ox0, 46, ox1 - ox0, 16, K('yoru', -1)); c.R(ox0, 62, ox1 - ox0, 16, K('yoru', 0))
    for x in range(ox0, ox1): c.P(x, 24, K('conc', 4)); c.P(x, 25, K('conc', 1))                      # 거더 밑 모서리
    c.R(ox0, 78, ox1 - ox0, FB - 77, K('yoru', 1)); c.HL(ox0, 78, ox1 - ox0, K('yoru', -2))           # 도로 바닥(뒤 가장자리 어둡게)
    c.HL(ox0, 79, ox1 - ox0, K('yoru', 2))
    for x in range(ox0 + 3, ox1 - 6, 12): c.R(x, 86, 6, 1, K('shiro', 2))                              # 중앙선(점선)
    c.R(ox0, FB - 2, ox1 - ox0, 3, K('hodo', 0)); c.HL(ox0, FB - 2, ox1 - ox0, K('hodo', 3))          # 앞 연석
    c.VL(ox0, 26, 52, K('conc', -1)); c.VL(ox0 + 1, 26, 52, K('conc', 0))                               # 왼쪽 안쪽 벽(그늘)
    c.VL(ox1 - 1, 26, 52, K('conc', 3)); c.VL(ox1 - 2, 28, 50, K('conc', 1))                            # 오른쪽 안쪽 벽(빛 받음)
    return ink2(c)

def _cart_wheel(c, x, y, r=6):
    """윤곽색을 다른 물체와 같은 DARK() 로 맞춘 속찬 원판 바퀴 + 밝은 허브."""
    for yy in range(-r, r):
        for xx in range(-r, r):
            d = (xx + .5) ** 2 + (yy + .5) ** 2
            if d <= r * r: c.P(x + xx, y + yy, DARK() if d > (r - 1.3) ** 2 else K('conc', 0) if d > (r * .42) ** 2 else K('conc', 3))

def ricksha_cart():
    """인력거 수레 64x32(실제 사용 칸 높이): 지붕 포장(윗면+앞), 좌석(윗면 띠), 바퀴 2개(아랫선이 캔버스 안에서 닫힌다), 바닥 그림자, 앞으로 뻗는 채."""
    c = Cv(64, 32)
    c.HL(18, 30, 44, K('hodo', -2))                                             # 바닥 그림자(오른쪽 아래로 밀림)
    c.R(14, 1, 30, 3, K('aka', 3)); c.HL(14, 1, 30, K('aka', 4)); c.R(12, 4, 34, 5, K('aka', 0)); c.VL(12, 4, 5, K('aka', 2)); c.HL(12, 8, 34, K('aka', -2))   # 지붕: 윗면 + 앞면
    for xx in (14, 43): c.R(xx, 9, 2, 11, K('tekko', 2))                                                           # 포장 기둥
    c.R(14, 10, 30, 9, K('shiro', 1)); c.VL(14, 10, 9, K('shiro', 2))                                              # 등받이
    c.R(16, 14, 26, 3, K('aka', 1)); c.HL(16, 14, 26, K('aka', 2)); c.R(16, 17, 26, 4, K('aka', -1))              # 좌석: 윗면 띠 + 앞면
    c.R(12, 20, 34, 3, K('tekko', 1)); c.HL(12, 20, 34, K('tekko', 3)); c.HL(12, 22, 34, K('tekko', -1))          # 차대 윗면 띠
    c.R(46, 22, 16, 2, K('ita', 0)); c.HL(46, 22, 16, K('ita', 3)); c.R(60, 19, 3, 7, K('ita', 1)); c.VL(60, 19, 7, K('ita', 3))   # 채
    for x in (17, 41): _cart_wheel(c, x, 24, 6)                                                                  # 바퀴 아랫선 y=29, 윤곽 y=30
    out = ink2(c)
    return out
