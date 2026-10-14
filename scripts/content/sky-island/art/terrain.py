#!/usr/bin/env python3
"""sky_island 바닥·섬 가장자리·섬 밑면·구름·길·광장·밭·물·다리·부두 — 16px 칸 조각(대부분 1×1).

섬 짜임(3/4 탑뷰, 남쪽에서 내려다봄):
  하늘(sky, 막힘) 위에 풀밭 섬. 섬 윗면 = 풀 칸(floor). 북·서·동 가장자리 칸은 풀이 하늘에서 끝나는 테(윤곽 + 햇빛 테).
  남쪽 가장자리 칸(gs-s)은 풀 끝 처마 + 흙 띠 — 그 아래 줄부터 «섬 밑면»(바위 절벽, 막힘)이 열마다 깊이 d(2~6)로 내려간다:
    0행 face-top(흙 → 바위 지층) · 1…d-2행 mid · d-1행 tip(뾰족한 바위 끝, 아래는 하늘). 끝 열(섬 서·동 끝)은 face-top-l/r + tip-l*/r*.
  tip 의 좌·우 가장자리 높이는 이웃 열 깊이로 정한다: 이웃이 더 깊으면 full(16, 바위가 이어짐), 같으면 eq(10), 얕으면 open(하늘로 열림).
  지층 무늬는 «섬 남쪽 처마로부터의 깊이 Y»의 함수이고 가로로 16px 주기라 열끼리 이음매가 없다.
구름 바닥(cloud, floor)도 같은 13칸 가장자리 + 남쪽 아래 «뭉게 밑면» 한 줄(billow). 풀↔구름 가장자리 13칸(gc-*)은 둘 다 걷는다.
다리·부두는 위층 덧그림(flat, 걷는다) — 하늘·절벽 위 어디에나 얹는다. 폭포는 위층 덧그림(solid, 막힘, 3프레임).

  python3 terrain.py   → tiledata/sky-island/terrain/_gate/*.png + items.jsonl
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from px import C, rnd, h32, clamp, blob
from kit import Reg, contact, OUT

R = Reg('terrain')
A = R.add
T = 16
SKY_T = 4
M = 3          # 가장자리 테 폭(px) — 하늘이 칸 안으로 들어오는 깊이


# ═══════════════════════ 바탕 무늬 ═══════════════════════
def sky_fill(c):
    c.R(0, 0, c.w, c.h, 'sky', SKY_T)


def tnoise(x, y, g, s):
    """16px 주기 값 잡음(격자 g 는 16 의 약수) — 칸을 이어 붙여도 이음매가 없다."""
    n = 16 // g
    gx, gy = x // g, y // g
    fx, fy = (x % g + 0.5) / g, (y % g + 0.5) / g
    v = lambda i, j: rnd(i % n, j % n, s)
    sx, sy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a, b, c, d = v(gx, gy), v(gx + 1, gy), v(gx, gy + 1), v(gx + 1, gy + 1)
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy


def tuft_at(x, y, s):
    """풀잎(세로 2화소: 밝은 끝 위 + 그늘 밑동) 자리 — 칸마다 4개, 16px 주기."""
    for k in range(3):
        tx = int(rnd(k, 1, s + 50) * 16); ty = int(rnd(k, 2, s + 50) * 16)
        dx, dy = (x - tx) % 16, (y - ty) % 16
        if (dx, dy) == (0, 0): return 2          # 잎 끝(밝음)
        if (dx, dy) == (0, 1): return -1         # 밑동 그늘
        if (dx, dy) == (1, 1) and k % 2: return 1
    return 0


GRASS_BASE_SEED = 1


def grass_px(x, y, s=1, base=4):
    """풀밭 한 화소(칸 안 좌표). 화풍 정렬 2026-10-14: 버들항 풀처럼 넓은 얼룩 3단(짙은·보통·밝은) + 경계 디더 + 드문 짙은 점·풀잎.
    바탕 얼룩은 모든 풀 칸이 같은 씨앗이라 어떤 풀 칸끼리 붙어도 이음매가 없다. 칸마다 다른 것은 풀잎·점 자리(s)뿐이다."""
    # 바탕은 고른 풀(4단) + 2px 알갱이 얼룩(짙은·밝은, 반은 디더). 넓은 명암 덩이는 변형 칸(grass-b 밝은 얼룩·grass-shade 짙은 덩이)이 맡는다.
    t = base
    cv = rnd(x, y, GRASS_BASE_SEED + 5)
    if cv < 0.075: t = base - 1                           # 짙은 풀 알갱이
    elif cv > 0.955: t = base + 1                         # 밝은 풀 알갱이
    q = rnd(x, y, s + 11)
    if q < 0.012: t = base - 2                            # 짙은 점(흙·그늘 알갱이)
    tf = tuft_at(x, y, s)
    if tf == 2: t = base + 2 if t >= base else base + 1
    elif tf == 1: t = base + 1
    elif tf == -1: t = base - 1 if t >= base else base - 2
    return ('grass', clamp(t, 0, 6))


def grass_fill(c, s=1, flowers=0, base=4):
    c.F(0, 0, 16, 16, lambda x, y, i, j: grass_px(x % 16, y % 16, s, base))
    for k in range(flowers):
        x = 2 + int(rnd(k, 1, s + 40) * 12); y = 2 + int(rnd(k, 2, s + 40) * 12)
        col = ('flower', 3) if k % 3 == 0 else ('gold', 4) if k % 3 == 1 else ('cream', 6)
        c.P(x, y, *col); c.P(x, y + 1, 'grass', 2); c.P(x - 1, y, col[0], col[1] - 1)


def grass_light(c, s=1, clumps=()):
    """밝은 풀 얼룩(햇빛 받은 풀): 바탕 위에 밝은 풀(5단, 속은 6단 점) 덩이 — 가장자리는 디더로 바탕에 녹는다. 칸 끝 1화소는 바탕 그대로."""
    grass_fill(c, s)
    for y in range(3, 13):
        for x in range(3, 13):
            v = 0.0
            for (cx, cy, rx, ry) in clumps:
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                v = max(v, 1 - (dx * dx + dy * dy))
            v += (rnd(x, y, s + 41) - 0.5) * 0.45
            if v <= 0.05: continue
            chk = (x + y) % 2
            g = c.get(x, y)[1]
            if v > 0.5: t = 6 if rnd(x, y, s + 43) < 0.07 else 5
            elif v > 0.25: t = 5 if chk or v > 0.38 else max(g, 4)
            else: t = max(g, 5) if chk and rnd(x, y, s + 44) < 0.5 else g
            if g <= 2: t = g                                  # 풀잎 밑동 그늘은 남긴다
            c.P(x, y, 'grass', t)


def grass_shade(c, s=1, clumps=()):
    """짙은 풀 그늘 덩이(평평한 얼룩): 풀 바탕 위에 짙은 풀(2·3단) 덩이 — 가장자리는 한 단씩 디더로 바탕에 녹는다. 칸 끝 1화소는 바탕 그대로(이음매 없음)."""
    grass_fill(c, s)
    for y in range(1, 15):
        for x in range(1, 15):
            v = 0.0
            for (cx, cy, rx, ry) in clumps:
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                v = max(v, 1 - (dx * dx + dy * dy))
            v += (tnoise(x, y, 4, s + 31) - 0.5) * 0.22
            if v <= 0.02: continue
            chk = (x + y) % 2
            g = c.get(x, y)[1]
            if v > 0.55: t = 2 if rnd(x, y, s + 33) > 0.06 else 1
            elif v > 0.33: t = 3 if not (v > 0.45 and chk) else 2
            elif v > 0.15: t = min(g, 3)
            else: t = min(g, 3) if chk else g
            c.P(x, y, 'grass', t)


def grass_tuft(c, s=1, spots=()):
    """풀포기(위에서 비스듬히 본 풀잎 다발): 가운데가 높고 양옆이 낮은 잎 7~9가닥 — 잎마다 밝은 끝·몸·그늘 밑동, 밑은 짙은 그늘 띠. 칸 끝 1화소는 바탕 그대로."""
    grass_fill(c, s)
    for (cx, cy, r) in spots:
        n = int(r * 2) + 1
        x0 = int(cx - r)
        # 밑동 그늘(타원 띠)
        for x in range(x0 - 1, x0 + n + 1):
            if 1 <= x <= 14:
                for yy in (int(cy), int(cy) + 1):
                    if 1 <= yy <= 14: c.P(x, yy, 'grass', 2 if yy == int(cy) else 3)
        for i in range(n):
            x = x0 + i
            if not 1 <= x <= 14: continue
            u = abs(i - (n - 1) / 2) / max(1, (n - 1) / 2)
            hgt = int(round(r * 1.5 * (1 - 0.55 * u))) + (1 if rnd(i, 3, s) < 0.3 else 0)
            lean = 0 if u < 0.3 else (-1 if i < n / 2 else 1)
            for k in range(hgt):
                y = int(cy) - 1 - k
                xx = x + (lean if k >= hgt - 2 else 0)
                if not (1 <= y <= 14 and 1 <= xx <= 14): continue
                t = 6 if k == hgt - 1 else 5 if k >= hgt - 2 else 4 if k >= hgt // 2 else 3
                if i % 2 and k < hgt - 1: t -= 1          # 뒤쪽 잎은 한 단 어둡다
                c.P(xx, y, 'grass', t)


def cloud_px(x, y, s=1):
    """구름 바닥(위에서 본 면): 거의 고른 흰 면(5단). 칸마다 옅은 소용돌이 획 둘(4단, 호)과 그 위 반사(6단)만 — 16px 주기라도 반복이 눈에 덜 띈다."""
    t = 5
    for (cx, cy, r, a0, a1) in ((5, 6, 4.5, 0.15, 0.85), (12, 13, 4.0, 0.1, 0.75)):
        dx = ((x + 0.5 - cx + 8) % 16) - 8
        dy = ((y + 0.5 - cy + 8) % 16) - 8
        d = math.sqrt(dx * dx + (dy * 1.4) ** 2)
        ang = (math.atan2(dy, dx) / math.pi + 1) / 2          # 0..1
        if abs(d - r) < 0.6 and a0 < ang < a1 and dy > 0: t = 4    # 아래쪽 호(그늘 획)
        elif d < r - 1.2 and dy < -1 and dx < 1 and rnd(x, y, 9) < 0.5: t = 6   # 덩이 윗머리 반사
    if rnd(x, y, s + 3) < 0.015 and t == 5: t = 6
    return ('cloud', t)


def cloud_fill(c, s=1):
    c.F(0, 0, 16, 16, lambda x, y, i, j: cloud_px(x % 16, y % 16, s))


# ═══════════════════════ 가장자리 모양 ═══════════════════════
def wob(i, s, amp=1):
    """가장자리 흔들림(칸 양 끝 0 — 이웃 칸과 이음매가 맞는다)."""
    if i <= 1 or i >= 14: return 0
    r = rnd(i // 2, 0, s)
    return -amp if r < 0.22 else amp if r > 0.82 else 0


def inside_fn(kind, s=1, m=M, rad=5):
    """kind ∈ c n s w e nw ne sw se inw ine isw ise → inside(x, y) (풀/구름 쪽인가). s 쪽 가장자리는 «바닥 테»(아래 줄이 밑면)."""
    def n_ok(x, y): return y >= m + wob(x, s)
    def s_ok(x, y): return y <= 15 - m - wob(x, s + 5)
    def w_ok(x, y): return x >= m + wob(y, s + 9)
    def e_ok(x, y): return x <= 15 - m - wob(y, s + 13)

    def corner(x, y, cx, cy, sx, sy):
        # 바깥 모서리 둥글림: (cx,cy) 중심 반지름 rad 사분원 밖은 바깥
        ax, ay = (cx - x) * sx, (cy - y) * sy
        if ax > 0 and ay > 0: return ax * ax + ay * ay <= rad * rad
        return True
    def notch(x, y, ox, oy):
        # 안쪽 모서리: (ox,oy) 모서리 m×m 칸이 바깥, 대각 한 화소 둥글림
        dx = x if ox == 0 else 15 - x
        dy = y if oy == 0 else 15 - y
        if dx < m and dy < m: return (m - 1 - dx) + (m - 1 - dy) < 1
        return True
    k = kind
    if k == 'c': return lambda x, y: True
    if k == 'n': return n_ok
    if k == 's': return s_ok
    if k == 'w': return w_ok
    if k == 'e': return e_ok
    if k == 'nw': return lambda x, y: n_ok(x, y) and w_ok(x, y) and corner(x, y, m + rad, m + rad, 1, 1)
    if k == 'ne': return lambda x, y: n_ok(x, y) and e_ok(x, y) and corner(x, y, 15 - m - rad, m + rad, -1, 1)
    if k == 'sw': return lambda x, y: s_ok(x, y) and w_ok(x, y) and corner(x, y, m + rad, 15 - m - rad, 1, -1)
    if k == 'se': return lambda x, y: s_ok(x, y) and e_ok(x, y) and corner(x, y, 15 - m - rad, 15 - m - rad, -1, -1)
    if k == 'inw': return lambda x, y: notch(x, y, 0, 0)
    if k == 'ine': return lambda x, y: notch(x, y, 1, 0)
    if k == 'isw': return lambda x, y: notch(x, y, 0, 1)
    if k == 'ise': return lambda x, y: notch(x, y, 1, 1)
    raise KeyError(k)


def rim(c, ins, mat, out_t=1, hi_t=None, sh_t=None):
    """inside 경계 화소: 바깥과 맞닿은 화소는 윤곽(out_t), 그 안쪽 한 화소는 북·서향이면 햇빛 테(hi_t), 동향이면 그늘(sh_t)."""
    edge = []
    for y in range(16):
        for x in range(16):
            if not ins(x, y): continue
            nb = {(dx, dy): (0 <= x + dx < 16 and 0 <= y + dy < 16 and not ins(x + dx, y + dy)) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))}
            if any(nb.values()): edge.append((x, y, nb))
    for x, y, nb in edge:
        c.P(x, y, mat, out_t)
        if nb[(0, -1)] and hi_t is not None and ins(x, y + 1): c.P(x, y + 1, mat, hi_t)
        if nb[(-1, 0)] and hi_t is not None and ins(x + 1, y): c.P(x + 1, y, mat, max(hi_t - 1, 0))
        if nb[(1, 0)] and sh_t is not None and ins(x - 1, y): c.P(x - 1, y, mat, sh_t)


# ═══════════════════════ 하늘·풀 ═══════════════════════
@A('sky', '하늘(빈 하늘, 막힘)', 1, 1, 'terrain', ['하늘', '배경'], '섬 밖 모든 칸. 반복 가능. 걸을 수 없다.', pc='solidfloor', gate_name='empty sky background tile')
def _(c): sky_fill(c)


@A('sky-glint', '하늘(반짝임)', 1, 1, 'terrain', ['하늘', '배경'], '하늘 칸 사이에 드물게(20칸에 하나 이하).', pc='solidfloor', gate_name='sky background tile with a tiny sparkle')
def _(c):
    sky_fill(c)
    c.P(8, 7, 'sky', 6); c.P(7, 7, 'sky', 5); c.P(9, 7, 'sky', 5); c.P(8, 6, 'sky', 5); c.P(8, 8, 'sky', 5)
    c.P(3, 12, 'sky', 5); c.P(13, 3, 'sky', 5)


for _id, _nm, _s, _fl, _b in (('grass', '풀밭', 1, 0, 4), ('grass-flower', '풀밭(들꽃)', 3, 4, 4), ('grass-flower-b', '풀밭(들꽃 둘)', 6, 3, 4)):
    A(_id, _nm, 1, 1, 'terrain', ['풀', '섬'], '섬 윗면. grass 를 바탕으로 grass-b 를 섞고 들꽃 칸은 낱칸으로 드물게(10칸에 하나 이하). 모든 풀 칸은 서로 이음매 없이 붙는다.', pc='floor', gate_name='grass ground tile')(
        (lambda s, fl, b: (lambda c: grass_fill(c, s, fl, b)))(_s, _fl, _b))

# 밝은 얼룩은 작고 불규칙하게(칸 경계에서 4화소 이상 떨어짐) 변형 셋 — 2배에서 칸 모양 네모 얼룩이 반복돼 보이던 것(감독 판정 2026-10-14).
for _id, _nm, _s, _cl in (('grass-b', '풀밭(밝은 얼룩)', 2, ((6.5, 7.0, 3.0, 2.2), (9.0, 8.5, 2.2, 1.8))),
                          ('grass-b2', '풀밭(밝은 얼룩 둘)', 25, ((5.0, 9.5, 2.0, 1.6), (10.5, 5.5, 2.6, 1.9))),
                          ('grass-b3', '풀밭(밝은 얼룩 셋)', 26, ((8.5, 10.0, 3.2, 1.8), (6.0, 8.8, 1.6, 1.4), (11.0, 5.0, 1.5, 1.3)))):
    A(_id, _nm, 1, 1, 'terrain', ['풀', '섬'], '풀밭 얼룩. grass 사이에 드문드문(햇빛 받은 풀). 모든 풀 칸은 서로 이음매 없이 붙는다.', pc='floor', gate_name='grass ground tile')(
        (lambda s, cl: (lambda c: grass_light(c, s, cl)))(_s, _cl))
# 화풍 정렬 2026-10-14(D9 풀 결 단조): 짙은 풀 그늘 덩이 둘 + 풀포기 덤불 둘. 구성기가 풀 얼룩 진한 곳에 몰아 깐다.
for _id, _nm, _s, _cl in (('grass-shade-a', '풀밭(짙은 풀 그늘)', 21, ((7.5, 8.0, 6.5, 5.5), (11.0, 11.5, 3.5, 3.0))),
                          ('grass-shade-b', '풀밭(짙은 풀 그늘 둘)', 22, ((5.0, 6.0, 4.0, 3.5), (10.5, 9.5, 4.5, 4.5), (6.0, 12.0, 3.0, 2.0)))):
    A(_id, _nm, 1, 1, 'terrain', ['풀', '섬'], '풀밭 얼룩. 짙은 곳에 몇 칸씩 몰아 깔면 버들항 풀처럼 명암 덩이가 생긴다(넓게 다 덮지 말 것).', pc='floor', gate_name='grass ground tile with darker grass patch')(
        (lambda s, cl: (lambda c: grass_shade(c, s, cl)))(_s, _cl))
for _id, _nm, _s, _sp in (('grass-tuft-a', '풀밭(풀포기)', 23, ((7.5, 11.0, 3.0),)), ('grass-tuft-b', '풀밭(풀포기 둘)', 24, ((4.5, 7.5, 2.5), (10.5, 12.5, 2.5)))):
    A(_id, _nm, 1, 1, 'terrain', ['풀', '섬'], '풀밭 사이 낱칸(20칸에 하나쯤). 걷는다.', pc='floor', gate_name='grass ground tile with a small grass tuft')(
        (lambda s, sp: (lambda c: grass_tuft(c, s, sp)))(_s, _sp))


# ── 풀 ↔ 하늘 가장자리(남쪽 테는 흙 띠로 이어져 아래 줄 밑면과 만난다) ──
LIP = 12          # 남쪽 테: 풀 끝(처마) y


def grass_edge(c, kind, s=1):
    """풀↔하늘 가장자리 한 칸. 남쪽(s·sw·se)은 풀 처마 + 흙 띠(아래 칸 face-top 으로 이어진다)."""
    sky_fill(c)
    south = kind in ('s', 'sw', 'se')
    # 남향은 풀 처마 LIP 행까지, 그 아래(LIP+1…15)는 흙 띠(바깥 하늘과 다른 «앞면»)
    ins = inside_fn(kind if not south else {'s': 'c', 'sw': 'w', 'se': 'e'}[kind], s)
    lip = lambda x: LIP + (1 if rnd(x // 2, 3, s) > 0.7 and 2 < x < 13 else 0)
    def grass_in(x, y):
        if not ins(x, y): return False
        if south:
            if y > lip(x): return False
            if kind == 'sw' and x < M + 5 and y > LIP - 5:          # 둥근 남서 모서리
                ax, ay = M + 5 - x, y - (LIP - 5)
                return ax * ax + ay * ay <= 25
            if kind == 'se' and x > 15 - M - 5 and y > LIP - 5:
                ax, ay = x - (15 - M - 5), y - (LIP - 5)
                return ax * ax + ay * ay <= 25
        return True
    def face_in(x, y):
        if not south or y <= LIP - 3: return False
        if grass_in(x, y): return False
        if kind == 'sw': return x >= face_x0(y)
        if kind == 'se': return x <= 15 - face_x0(y)
        return True
    for y in range(16):
        for x in range(16):
            if grass_in(x, y): c.P(x, y, *grass_px(x, y, s))
            elif face_in(x, y): c.P(x, y, *soil_band(x, y - LIP - 1, s))
    rim(c, grass_in, 'grass', 1, 6, 3)
    if south:
        # 처마: 풀 끝에 늘어진 풀잎(어두운 풀) + 처마 밑 그늘
        for x in range(16):
            yl = None
            for y in range(15, -1, -1):
                if grass_in(x, y): yl = y; break
            if yl is None: continue
            if face_in(x, yl + 1): c.P(x, yl + 1, 'soil', 0)
            if rnd(x, 7, s) < 0.35 and face_in(x, yl + 2):
                c.P(x, yl + 1, 'grass', 1); c.P(x, yl + 2, 'grass', 1 if rnd(x, 8, s) < 0.5 else 2)
        # 모서리 흙 띠 바깥 윤곽
        for y in range(16):
            for x in range(16):
                if face_in(x, y) and ((x > 0 and not face_in(x - 1, y) and not grass_in(x - 1, y)) or (x < 15 and not face_in(x + 1, y) and not grass_in(x + 1, y))):
                    c.P(x, y, 'rock', 0)


def face_x0(y):
    """남서 모서리 흙 띠의 왼쪽 경계(칸 안 y) — face-top-l 의 0행 경계(FACE_L0)로 이어진다."""
    return M + 2 + max(0, (LIP + 1 - y)) // 2


FACE_L0 = M + 2          # face-top-l 맨 윗줄 왼쪽 경계(=face_x0(15) 와 같다)


def soil_band(x, yy, s=1):
    """처마 아래 흙 띠: yy=0(처마 바로 밑) 가장 어둡고 내려갈수록 흙, 뿌리 실선."""
    t = 1 if yy <= 0 else 2 if yy < 3 else 3
    if rnd(x, yy + 40, s) < 0.12: t = clamp(t - 1, 0, 5)
    if (x * 7 + s * 3) % 11 == 0 and yy > 0: return ('wood', 1)      # 늘어진 뿌리
    return ('soil', t)


for _k in ('n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se', 'inw', 'ine', 'isw', 'ise'):
    _nm = {'n': '북', 's': '남(처마·흙 띠)', 'w': '서', 'e': '동', 'nw': '북서 모서리', 'ne': '북동 모서리', 'sw': '남서 모서리', 'se': '남동 모서리',
           'inw': '안쪽 북서', 'ine': '안쪽 북동', 'isw': '안쪽 남서', 'ise': '안쪽 남동'}[_k]
    A('gs-' + _k, f'풀↔하늘 가장자리 {_nm}', 1, 1, 'terrain', ['섬 가장자리', '풀', '하늘'],
      '섬 모양(풀 칸 집합)에서 이웃 마스크로 고른다. 남쪽 가장자리 아래 줄에는 반드시 섬 밑면(face-top…)이 온다.', pc='floor',
      gate_name='grass island edge tile against sky (terrain)')((lambda k: (lambda c: grass_edge(c, k, 1)))(_k))


# ═══════════════════════ 섬 밑면(바위 절벽) ═══════════════════════
# 화풍 정렬 2026-10-14: 세로 기둥 판(D8)을 버리고 «층리 + 바위 덩이»로 다시 그렸다.
# 바위 면은 가로 띠(층) 셋이 16px 주기로 쌓인 것 — 층 경계는 x 에 대해 물결(16px 주기), 층마다 크기 다른 둥근 바위 덩이가 가로로 놓인다.
# 3/4 시점 단서: 층마다 윗면 턱(밝은 1~2행)이 보이고 그 아래 층 밑은 처마 그늘(어두운 1행)이다. 덩이는 왼쪽 위가 밝고 오른쪽 아래가 어둡다.
# x·y 모두 16px 주기라 어느 칸 옆·아래에 어느 칸이 와도 이음매가 없다(face-top 의 바위부 = face-mid 와 같은 함수).
BANDS = [(2, 6), (8, 5), (13, 5)]          # (윗선 y, 높이) — 16px 주기로 감긴다(마지막 층은 다음 칸 맨 위 2행까지)
BAND_BASE = [3, 4, 3]


def band_top(b, x, var=0):
    """층 b 윗선 y(물결). 칸 양 끝(x 0·15)은 모든 변형이 같고, 칸 안쪽 흔들림만 변형마다 다르다 — 어느 변형끼리 붙어도 이어진다."""
    w = 0.8 * math.sin(2 * math.pi * (x + 0.5 + b * 5) / 16)
    bump = math.sin(math.pi * (x + 0.5) / 16) ** 2 * (rnd(b, var, 401) - 0.5) * 3.0
    return BANDS[b][0] + round(w + bump)


def band_of(x, y, var=0):
    """화소 (x, y) 가 속한 층 번호, 층 안 행(0=윗면 턱), 층 높이."""
    y %= 16
    tops = [band_top(b, x, var) for b in range(3)]
    for yy in (y, y + 16):
        for b in (2, 1, 0):
            top = tops[b]; nxt = tops[b + 1] if b < 2 else tops[0] + 16
            if top <= yy < nxt: return b, yy - top, nxt - top
    return 2, 0, 5


def chunk_seeds(b, var):
    """층 b 의 덩이 씨앗(x 중심, 반폭). 칸 끝(x=0)의 덩이는 모든 변형이 같다."""
    cw = (3.5, 5.0, 2.5)[b]
    out = [(0.0, cw)]
    x = cw + 0.5
    k = 0
    while x < 13.0:
        w = 2.5 + rnd(b * 9 + k, var, 403) * 2.5
        out.append((x + w, w)); x += 2 * w; k += 1
    return out


def rock2(x, y, s=1, deep=0, var=0):
    """밑면 바위 한 화소(칸 안 x, y). 층리 + 층 안 덩이(크기 제각각, 윗면 턱 빛 또는 위층 처마 그늘) + 일부만 갈라진 틈 + 큰 얼룩."""
    b, r, h = band_of(x, y, var)
    ds = []
    for k, (sx, hw) in enumerate(chunk_seeds(b, var)):
        dx = ((x + 0.5 - sx + 8) % 16) - 8
        ds.append((abs(dx) / hw, k, dx, hw))
    ds.sort()
    (d1, k, dx, hw), (d2, k2, _, hw2) = ds[0], ds[1]
    ck = k if k else -1
    u = dx / hw
    base = BAND_BASE[b] - deep + (1 if rnd(b * 13 + ck, var, 405) < 0.2 else 0) - (1 if rnd(b * 13 + ck, var, 406) < 0.2 else 0)
    big = tnoise(x, y, 8, 77)
    if big > 0.7: base += 1
    elif big < 0.22: base -= 1
    lit = rnd(b * 13 + ck, var, 407) < 0.65                   # 이 덩이는 윗면 턱이 보인다(아니면 위층 처마 그늘에 묻힌다)
    t = base
    if r == 0: t = base + (2 if u < 0.2 else 1) if lit else base - 1
    elif r == 1: t = base + (1 if u < -0.2 else 0) if lit else base
    elif r == h - 1: t = base - 2
    else:
        if u < -0.6: t = base + 1
        elif u > 0.65: t = base - 1
        if r == h - 2 and u > 0.0: t = min(t, base - 1)
    gap = (d2 - d1) * min(hw, hw2)
    cracked = rnd(b * 13 + ck + k2, var, 409) < 0.55
    if gap < 0.9 and 0 < r < h - 1 and cracked: t = 1
    if 1 < r < h - 1:
        q = rnd(x, y, s + 7 + var)
        if q < 0.06: t -= 1
        elif q > 0.965: t += 1
    return ('rock', clamp(t, 0, 6))


def rock_px(x, y, kind='mid', s=1, deep=0, joints=True, var=0):
    """절벽 앞면 한 화소. kind top 은 위 흙 띠(처마 흙의 연속) → 그늘 1행 → 바위."""
    if kind == 'top':
        head = 3 + (1 if rnd(x // 3, 0, s) < 0.35 else 0)
        if y < head: return soil_band(x, y + 3, s)
        if y == head: return ('rock', 1)                      # 흙 밑 그늘
        if y == head + 1: return ('rock', 2 if rnd(x, 1, s) < 0.5 else 3)
        if y <= head + 4:                                     # 처마 밑 그늘(위 흙·풀이 가린다)
            m, t = rock2(x, y, s, deep, var)
            return (m, max(1, t - 1))
    return rock2(x, y, s, deep, var)


def face_tile(c, kind='mid', s=1, deep=0, xl=None, xr=None, crystal=False, roots=False, fissure=False, var=0):
    """밑면 몸통 칸. xl/xr = fn(y) 왼·오른쪽 경계(끝 열 둥글림) — 밖은 하늘."""
    sky_fill(c)
    for y in range(16):
        for x in range(16):
            if xl and x < xl(y): continue
            if xr and x > xr(y): continue
            c.P(x, y, *rock_px(x, y, kind, s, deep, var=var))
    if fissure:
        # 비스듬한 큰 갈라짐(어두운 틈 + 왼쪽 밝은 날)
        x = 10
        for y in range(1, 15):
            if y % 3 == 0: x -= 1
            c.P(x, y, 'rock', 0); c.P(x - 1, y, 'rock', 5 if y % 2 else 4); c.P(x + 1, y, 'rock', 2)
    for y in range(16):
        if xl and xl(y) > 0:
            x0 = max(0, int(math.ceil(xl(y))))
            c.P(x0, y, 'rock', 1)
            if c.get(x0 + 1, y) and c.get(x0 + 1, y)[0] == 'rock': c.P(x0 + 1, y, 'rock', 5 if y % 5 else 4)
        if xr and xr(y) < 15:
            x1 = min(15, int(math.floor(xr(y))))
            c.P(x1, y, 'rock', 0)
            if c.get(x1 - 1, y) and c.get(x1 - 1, y)[0] == 'rock': c.P(x1 - 1, y, 'rock', 1)
    if crystal:
        for (x, y, h) in ((3, 13, 4), (7, 14, 6), (12, 13, 3)):
            c.HL(x - 1, y + 1, 4, 'rock', 1)
            for k in range(h):
                c.P(x, y - k, 'crystal', 4 if k < h - 1 else 5); c.P(x + 1, y - k, 'crystal', 2 if k < h - 1 else 3)
            c.P(x, y - h, 'crystal', 5); c.P(x - 1, y - h + 2, 'crystal', 1)
    if roots:
        for x, L in ((2, 10), (3, 6), (9, 13), (13, 8)):
            for y in range(L):
                xx = x + (1 if (y > L // 2 and x == 9) else 0)
                c.P(xx, y, 'wood', 1 if y % 3 else 2)
                if y % 3 == 1: c.P(xx + 1, y, 'wood', 0) if c.get(xx + 1, y) and c.get(xx + 1, y)[0] == 'rock' else None
            c.P(x, L, 'wood', 2)


# 끝 칸 아랫선: 양 끝(x=0·15)은 늘 같은 높이(EDGE)라 어떤 끝 칸끼리 붙어도 이어진다. 칸 안에서만 뾰족한 바위 끝이 처진다.
TIP_EDGE = 9
TIP_PROFILES = {
    'a': [(0, 9), (3, 11), (6, 15), (8, 12), (11, 10), (15, 9)],
    'b': [(0, 9), (2, 10), (4, 13), (6, 10), (9, 11), (12, 15), (14, 10), (15, 9)],
    'c': [(0, 9), (5, 10), (8, 11), (11, 14), (13, 10), (15, 9)],
    'd': [(0, 9), (2, 12), (4, 10), (7, 13), (9, 16), (11, 12), (15, 9)],
    'l': [(0, 9), (4, 9), (8, 12), (11, 14), (15, 9)],
    'r': [(0, 9), (4, 14), (7, 12), (11, 9), (15, 9)],
}


def tip_bottom(prof, x):
    for (x0, y0), (x1, y1) in zip(prof, prof[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / max(1, x1 - x0)
    return TIP_EDGE


def tip_tile(c, prof, s=1, xl=None, xr=None, roots=True, deep=1, var=0):
    sky_fill(c)
    bot = [round(tip_bottom(prof, x)) for x in range(16)]
    for x in range(16):
        e = bot[x]
        for y in range(min(e, 16)):
            if xl and x < xl(y): continue
            if xr and x > xr(y): continue
            px_ = rock2(x, y, s, deep, var)
            if e - y <= 2: px_ = ('rock', max(1, px_[1] - 1))          # 끝으로 갈수록 그늘
            c.P(x, y, *px_)
    # 바깥 윤곽: 하늘에 닿는 바위 — 아래·오른쪽은 가장 어두운 단, 왼쪽은 한 단 밝은 테
    for y in range(16):
        for x in range(16):
            g = c.get(x, y)
            if not g or g[0] != 'rock': continue
            below = y < 15 and c.get(x, y + 1)[0] == 'sky'
            lsky = x > 0 and c.get(x - 1, y)[0] == 'sky'
            rsky = x < 15 and c.get(x + 1, y)[0] == 'sky'
            if below or rsky: c.P(x, y, 'rock', 0 if below and y >= 12 else 1)
            elif lsky: c.P(x, y, 'rock', 1)
    for x in range(1, 15):                                              # 뾰족 끝 바로 위 반사 1화소
        e = bot[x]
        if bot[x - 1] < e > bot[x + 1] - 0 and 3 <= e <= 16 and c.get(x - 1, e - 3) and c.get(x - 1, e - 3)[0] == 'rock':
            c.P(x - 1, e - 3, 'rock', 4)
    if roots:
        for k, x in enumerate((3, 9, 13)):
            if rnd(k, 21, s) < 0.4: continue
            e = bot[x]
            if (xl and x <= xl(min(e, 15))) or (xr and x >= xr(min(e, 15))): continue
            L = 2 + int(rnd(k, 22, s) * 4)
            for j in range(L):
                yy = e + j
                if yy < 16: c.P(x + (1 if j > 2 else 0), yy, 'wood', 1 if j < L - 1 else 2)


def xl_end(row):
    """서쪽 끝 열 경계: face-top-l 맨 윗줄 FACE_L0 에서 시작해 안쪽으로 굽는다(row 1 = 그 아래 tip)."""
    return lambda y: FACE_L0 + (row * 16 + y) * 0.3


def xr_end(row):
    return lambda y: 15 - FACE_L0 - (row * 16 + y) * 0.3


A('face-top', '섬 밑면 윗줄(흙→바위)', 1, 1, 'terrain', ['섬 밑면', '절벽'], '남쪽 가장자리(gs-s) 바로 아래 줄. 가로로 반복.', pc='solidfloor', gate_name='rock cliff face tile under a floating island (terrain)')(lambda c: face_tile(c, 'top', 1, var=0))
A('face-top-b', '섬 밑면 윗줄(늘어진 뿌리)', 1, 1, 'terrain', ['섬 밑면', '절벽', '뿌리'], 'face-top 사이에 섞는다(4칸에 하나쯤).', pc='solidfloor', gate_name='rock cliff face tile with hanging roots (terrain)')(lambda c: face_tile(c, 'top', 2, roots=True, var=1))
A('face-top-crystal', '섬 밑면 윗줄(박힌 수정)', 1, 1, 'terrain', ['섬 밑면', '절벽', '수정'], 'face-top 사이에 드물게(섬마다 0~1).', pc='solidfloor', gate_name='rock cliff face tile with small embedded crystals (terrain)')(lambda c: face_tile(c, 'top', 3, crystal=True, var=2))
A('face-top-l', '섬 밑면 윗줄(서쪽 끝)', 1, 1, 'terrain', ['섬 밑면', '절벽'], '남서 모서리(gs-sw) 바로 아래.', pc='solidfloor', gate_name='rock cliff face end tile (terrain)')(lambda c: face_tile(c, 'top', 1, xl=xl_end(0), var=3))
A('face-top-r', '섬 밑면 윗줄(동쪽 끝)', 1, 1, 'terrain', ['섬 밑면', '절벽'], '남동 모서리(gs-se) 바로 아래.', pc='solidfloor', gate_name='rock cliff face end tile (terrain)')(lambda c: face_tile(c, 'top', 1, xr=xr_end(0), var=4))
A('face-mid', '섬 밑면 몸통', 1, 1, 'terrain', ['섬 밑면', '절벽'], 'face-top 과 끝(tip) 사이 줄.', pc='solidfloor', gate_name='rock cliff face tile (terrain)')(lambda c: face_tile(c, 'mid', 4, var=5))
A('face-mid-b', '섬 밑면 몸통(갈라짐)', 1, 1, 'terrain', ['섬 밑면', '절벽'], 'face-mid 사이에 섞는다.', pc='solidfloor', gate_name='rock cliff face tile (terrain)')(lambda c: face_tile(c, 'mid', 5, var=6))

for _k in ('a', 'b', 'c', 'd'):
    A(f'tip-{_k}', f'섬 밑면 끝(바위 끝 {_k})', 1, 1, 'terrain', ['섬 밑면', '종유석'],
      '열의 마지막 줄. 칸 양 끝은 같은 높이, 칸 안에서 뾰족한 바위 끝이 처진다(아래는 하늘). 구성기가 열마다 a~d 를 섞는다.', pc='solidfloor',
      gate_name='bottom tip of a floating island rock underside (terrain)')((lambda k: (lambda c: tip_tile(c, TIP_PROFILES[k], 7 + ord(k), var=ord(k) - 90)))(_k))
A('tip-l', '섬 밑면 끝(서쪽 끝 열)', 1, 1, 'terrain', ['섬 밑면'], '서쪽 끝 열 face-top-l 바로 아래(끝 열 깊이는 2).', pc='solidfloor', gate_name='bottom tip of a floating island rock underside (terrain)')(
    lambda c: tip_tile(c, TIP_PROFILES['l'], 31, xl=xl_end(1), var=11))
A('tip-r', '섬 밑면 끝(동쪽 끝 열)', 1, 1, 'terrain', ['섬 밑면'], '동쪽 끝 열 face-top-r 바로 아래(끝 열 깊이는 2).', pc='solidfloor', gate_name='bottom tip of a floating island rock underside (terrain)')(
    lambda c: tip_tile(c, TIP_PROFILES['r'], 37, xr=xr_end(1), var=12))


# 이웃 열이 이 줄에서 끝나면(이웃은 끝 칸, 양 끝 높이 TIP_EDGE) 이 열의 그 쪽 옆면이 하늘에 드러난다 — 옆면을 비스듬히 깎아 윤곽을 준다(화풍 정렬 2026-10-14).
OPEN_L = lambda y: (y - TIP_EDGE + 1) * 0.75 if y >= TIP_EDGE else -1
OPEN_R = lambda y: 15 - (y - TIP_EDGE + 1) * 0.75 if y >= TIP_EDGE else 16
TIP_OPEN_L = lambda y: 4.0 + y * 0.45
TIP_OPEN_R = lambda y: 11.0 - y * 0.45
for _k, _nm, _xl, _xr in (('ol', '서쪽 열린', OPEN_L, None), ('or', '동쪽 열린', None, OPEN_R), ('olr', '양쪽 열린', OPEN_L, OPEN_R)):
    A(f'face-mid-{_k}', f'섬 밑면 몸통({_nm} 옆면)', 1, 1, 'terrain', ['섬 밑면', '절벽'],
      '이웃 열이 이 줄에서 끝날 때(이웃이 tip) 그 쪽 아래 귀퉁이를 깎은 몸통. 구성기가 고른다.', pc='solidfloor',
      gate_name='rock cliff face tile with a tapered side (terrain)')((lambda xl, xr, k: (lambda c: face_tile(c, 'mid', 4, xl=xl, xr=xr, var=13 + len(k))))(_xl, _xr, _k))
for _k, _nm, _xl, _xr, _p in (('ol', '서쪽 열린', TIP_OPEN_L, None, 'c'), ('or', '동쪽 열린', None, TIP_OPEN_R, 'a'), ('olr', '양쪽 열린', TIP_OPEN_L, TIP_OPEN_R, 'd')):
    A(f'tip-{_k}', f'섬 밑면 끝({_nm})', 1, 1, 'terrain', ['섬 밑면', '종유석'],
      '이웃 열이 한 줄 위에서 끝나 옆이 하늘일 때의 끝 칸. 구성기가 고른다.', pc='solidfloor',
      gate_name='bottom tip of a floating island rock underside (terrain)')((lambda xl, xr, p, k: (lambda c: tip_tile(c, TIP_PROFILES[p], 41 + len(k), xl=xl, xr=xr, var=17 + len(k))))(_xl, _xr, _p, _k))


# ═══════════════════════ 구름 바닥 ═══════════════════════
A('cloud', '구름 바닥(걷는다)', 1, 1, 'terrain', ['구름', '바닥'], '단단한 구름 바닥 — 섬과 섬 사이 구름 길·구름 광장. 반복 가능.', pc='floor', gate_name='walkable cloud floor tile')(lambda c: cloud_fill(c, 1))
A('cloud-b', '구름 바닥(반짝임)', 1, 1, 'terrain', ['구름', '바닥'], 'cloud 사이에 섞는다.', pc='floor', gate_name='walkable cloud floor tile')(lambda c: cloud_fill(c, 2))


def bump(i, s, r=4.0):
    """뭉게 가장자리 솟음(칸 양 끝 0): 반지름 r 반원 둘(가운데 4·12)."""
    best = 0.0
    for cx in (4, 12):
        d = abs(i + 0.5 - cx)
        if d < r: best = max(best, math.sqrt(r * r - d * d))
    return best * 0.55


def cloud_inside(kind, m=M):
    def n_ok(x, y): return y >= m + 1 - bump(x, 0)
    def w_ok(x, y): return x >= m + 1 - bump(y, 0)
    def e_ok(x, y): return x <= 14 - m + bump(y, 0)
    def corner(x, y, cx, cy, sx, sy, rad=5):
        ax, ay = (cx - x) * sx, (cy - y) * sy
        return not (ax > 0 and ay > 0) or ax * ax + ay * ay <= rad * rad
    k = kind
    if k in ('n',): return n_ok
    if k == 'w': return w_ok
    if k == 'e': return e_ok
    if k == 'nw': return lambda x, y: n_ok(x, y) and w_ok(x, y) and corner(x, y, m + 5, m + 5, 1, 1)
    if k == 'ne': return lambda x, y: n_ok(x, y) and e_ok(x, y) and corner(x, y, 15 - m - 5, m + 5, -1, 1)
    return inside_fn(k)


CLIP = 8          # 구름 남쪽 테: 앞면 뭉게가 솟기 시작하는 y(그 위는 윗면)
FRONT_LUMPS = [(8, 17, 9.4), (-1, 12, 6.0), (17, 12, 6.0), (4, 25, 5.0), (12, 26, 5.4)]


def cumulus_front(end=None, s=1):
    """구름 남쪽 앞면(16×32 한 장: 위 16 = cs-s 의 아래 반, 아래 16 = billow). 베개처럼 둥글게 말려 내려가는 앞면:
    윗면에서 흰 테(6) → 아래로 5·4·3·2 단 그늘, 바닥은 폭 8 짜리 뭉게가 처진 물결 실루엣(덩이 사이 세로 틈 어둡게). 빛은 왼쪽 위."""
    out = {}
    LUMPS_B = [(0, 9), (9, 7)] if s % 2 else [(0, 6), (6, 10)]
    def lump_of(x):
        for a, w in LUMPS_B:
            if a <= x < a + w: return a, w
        return 0, 16
    def bottom(x):
        a, w = lump_of(x)
        u = (x - a + 0.5 - w / 2) / (w / 2)
        return 21 + 4.0 * math.sqrt(max(0, 1 - u * u)) ** 0.6 + (1 if w > 8 else 0)
    for x in range(16):
        b = bottom(x)
        if end == 'l': b -= max(0, 6 - x) * 1.2
        if end == 'r': b -= max(0, x - 9) * 1.2
        for y in range(CLIP, 32):
            if y >= b: break
            if end == 'l' and x < 2 + max(0, y - CLIP) * 0.22: continue
            if end == 'r' and x > 13 - max(0, y - CLIP) * 0.22: continue
            v = (y - CLIP) / max(1, b - CLIP)
            t = 6 if y == CLIP else 5 if v < 0.18 else 4 if v < 0.45 else 3 if v < 0.72 else 2
            a_, w_ = lump_of(x); k = x - a_
            if k in (0, w_ - 1) and v > 0.55: t = max(1, t - 1)          # 처진 덩이 사이 틈
            if k in (1, 2) and 0.45 < v < 0.85: t = min(5, t + 1)        # 덩이 왼쪽 빛
            out[(x, y)] = ('cloud', t)
    keys = set(out)
    for (x, y) in list(keys):
        if ((x, y + 1) not in keys and y < 31) or ((x - 1, y) not in keys and x > 0 and y > CLIP) or ((x + 1, y) not in keys and x < 15 and y > CLIP):
            out[(x, y)] = ('cloud', 1)
    return out


def cloud_edge(c, kind, s=1):
    sky_fill(c)
    south = kind in ('s', 'sw', 'se')
    ins = cloud_inside({'s': 'c', 'sw': 'w', 'se': 'e'}.get(kind, kind) if south else kind)
    def top_in(x, y):
        if not ins(x, y): return False
        if south and y >= 15: return False
        return True
    for y in range(16):
        for x in range(16):
            if top_in(x, y): c.P(x, y, *cloud_px(x, y, s))
    rim(c, top_in, 'cloud', 2, 6, 4)
    if south:
        front = cumulus_front({'sw': 'l', 'se': 'r'}.get(kind), s)
        for (x, y), v in front.items():
            if y < 16 and y >= CLIP - 3: c.P(x, y, *v)
        # 앞면이 윗면보다 위로 솟은 곳: 덩이 머리 윗선(밝은 테)
        if kind in ('sw', 'se'):
            for y in range(16):
                for x in range(16):
                    if (x, y) not in front and not top_in(x, y): c.P(x, y, 'sky', SKY_T)


for _k in ('n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se', 'inw', 'ine', 'isw', 'ise'):
    _nm = {'n': '북', 's': '남(앞면 뭉게)', 'w': '서', 'e': '동', 'nw': '북서 모서리', 'ne': '북동 모서리', 'sw': '남서 모서리', 'se': '남동 모서리',
           'inw': '안쪽 북서', 'ine': '안쪽 북동', 'isw': '안쪽 남서', 'ise': '안쪽 남동'}[_k]
    A('cs-' + _k, f'구름↔하늘 가장자리 {_nm}', 1, 1, 'terrain', ['구름 가장자리', '구름', '하늘'],
      '구름 바닥 모양에서 이웃 마스크로 고른다. 남쪽 가장자리 아래 줄에는 뭉게 밑면(billow)이 온다.', pc='floor',
      gate_name='cloud platform edge tile against sky (terrain)')((lambda k: (lambda c: cloud_edge(c, k, 1)))(_k))


def billow_tile(c, s=1, end=None):
    """구름 바닥 남쪽 아래 한 줄 — cumulus_front 의 아래 반(16…31). 아래는 하늘."""
    sky_fill(c)
    for (x, y), v in cumulus_front(end, s).items():
        if y >= 16: c.P(x, y - 16, *v)


A('billow', '구름 밑면(뭉게)', 1, 1, 'terrain', ['구름 밑면'], '구름 남쪽 가장자리(cs-s) 바로 아래 한 줄. 가로로 반복.', pc='solidfloor', gate_name='underside billows of a cloud platform (terrain)')(lambda c: billow_tile(c, 1))
A('billow-b', '구름 밑면(뭉게 둘)', 1, 1, 'terrain', ['구름 밑면'], 'billow 사이에 섞는다.', pc='solidfloor', gate_name='underside billows of a cloud platform (terrain)')(lambda c: billow_tile(c, 2))
A('billow-l', '구름 밑면(서쪽 끝)', 1, 1, 'terrain', ['구름 밑면'], 'cs-sw 바로 아래.', pc='solidfloor', gate_name='underside billows of a cloud platform (terrain)')(lambda c: billow_tile(c, 3, 'l'))
A('billow-r', '구름 밑면(동쪽 끝)', 1, 1, 'terrain', ['구름 밑면'], 'cs-se 바로 아래.', pc='solidfloor', gate_name='underside billows of a cloud platform (terrain)')(lambda c: billow_tile(c, 4, 'r'))


# ═══════════════════════ 풀 ↔ 구름(둘 다 걷는다) ═══════════════════════
def gc_edge(c, kind, s=1):
    """풀밭이 구름 바닥과 만나는 칸. 풀 테 윤곽 + 구름 뭉게가 풀 끝을 살짝 덮는다. 남향은 낮은 흙 둔덕(3px) 뒤 구름."""
    cloud_fill(c, 1)
    south = kind in ('s', 'sw', 'se')
    ins = inside_fn(kind, s + 3)
    for y in range(16):
        for x in range(16):
            if ins(x, y): c.P(x, y, *grass_px(x, y, s))
    rim(c, ins, 'grass', 1, 6, 3)
    # 남향 둔덕: 풀 밖 아래 2~3px 흙 앞면
    for x in range(16):
        for y in range(15, -1, -1):
            if ins(x, y):
                for k in (1, 2):
                    yy = y + k
                    if yy < 16 and not ins(x, yy) and ins(x, y - 2 if y >= 2 else y):
                        # 아래쪽(남향) 경계만: 위가 풀이고 아래가 구름
                        if (kind in ('s', 'sw', 'se', 'isw', 'ise')) or (kind in ('w', 'e', 'c') and False):
                            c.P(x, yy, 'soil', 2 if k == 1 else 1)
                break
    # 구름 뭉게가 풀 가장자리를 덮는다(바깥쪽 두세 곳)
    spots = {'n': [(4, 2), (11, 3)], 's': [(5, 15), (12, 14)], 'w': [(1, 5), (2, 12)], 'e': [(14, 4), (13, 11)],
             'nw': [(2, 3), (7, 1)], 'ne': [(13, 3), (8, 1)], 'sw': [(2, 13), (7, 15)], 'se': [(13, 13), (8, 15)],
             'inw': [(1, 1)], 'ine': [(14, 1)], 'isw': [(1, 14)], 'ise': [(14, 14)]}[kind]
    for (px_, py) in spots:
        c.ell(px_, py, 3.2, 2.2, lambda x, y, dx, dy, d: ('cloud', 6 if dy < -0.3 else 5 if dy < 0.4 else 4))
        c.ell(px_, py + 1.6, 3.0, 0.9, lambda x, y, dx, dy, d: ('cloud', 3) if c.get(x, y) and c.get(x, y)[0] == 'grass' else None)


for _k in ('n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se', 'inw', 'ine', 'isw', 'ise'):
    _nm = {'n': '북', 's': '남', 'w': '서', 'e': '동', 'nw': '북서 모서리', 'ne': '북동 모서리', 'sw': '남서 모서리', 'se': '남동 모서리',
           'inw': '안쪽 북서', 'ine': '안쪽 북동', 'isw': '안쪽 남서', 'ise': '안쪽 남동'}[_k]
    A('gc-' + _k, f'풀↔구름 가장자리 {_nm}', 1, 1, 'terrain', ['풀', '구름', '가장자리'],
      '구름 바닥 위 풀밭(신전 뜰 등)의 가장자리. 풀 칸 모양에서 이웃 마스크로 고른다. 둘 다 걷는다.', pc='floor',
      gate_name='grass to cloud floor transition tile (terrain)')((lambda k: (lambda c: gc_edge(c, k, 1)))(_k))


# ═══════════════════════ 길·광장·밭(풀 위에 박힌 바닥) ═══════════════════════
def flagstones(c, s=1):
    """풀 위 디딤돌 길: 칸 안에 납작한 판석 4~5개(윗면 밝게, 윤곽 어둡게, 아래 1px 접지 그늘)."""
    grass_fill(c, 7 + s)
    stones = {1: [(1, 1, 6, 5), (8, 0, 7, 6), (0, 7, 5, 5), (6, 7, 6, 4), (12, 7, 4, 5), (2, 12, 6, 4), (9, 12, 6, 4)],
              2: [(0, 0, 5, 4), (6, 1, 6, 5), (13, 0, 3, 5), (1, 5, 6, 5), (8, 7, 7, 4), (0, 11, 7, 5), (8, 12, 6, 4)],
              3: [(1, 0, 8, 4), (10, 1, 5, 5), (0, 5, 4, 6), (5, 5, 6, 6), (12, 7, 4, 4), (2, 12, 5, 4), (8, 12, 7, 4)]}[s]
    for k, (x, y, w, h) in enumerate(stones):
        base = 4 + (1 if rnd(k, 1, s) < 0.35 else 0) - (1 if rnd(k, 2, s) < 0.2 else 0)
        for j in range(h):
            for i in range(w):
                corner = (i in (0, w - 1)) and (j in (0, h - 1))
                if corner: continue
                t = base
                if j == 0 or i == 0: t = base + 1
                if j == h - 1 or i == w - 1: t = base - 2
                if rnd(x + i, y + j, s + 4) < 0.08: t -= 1
                c.P(x + i, y + j, 'stone', t)
        c.HL(x + 1, y + h, w - 2, 'grass', 2)


for _s in (1, 2, 3):
    A(f'path-{_s}', f'디딤돌 길({_s})', 1, 1, 'terrain', ['길', '돌'], '집 문 앞 접근칸과 다리 끝·부두를 잇는 길. 1~2칸 폭으로 1·2·3 을 섞는다.', pc='floor', gate_name='flagstone path on grass (terrain)')(
        (lambda s: (lambda c: flagstones(c, s)))(_s))


# ═══════════════════════ 포석 큰길(이웃 마스크 16 + 안쪽 변형) ═══════════════════════
# 화풍 정렬 2026-10-14(감독 판정 2): 디딤돌 길이 섬 위에 점선처럼 떠 보여서, 버들항 포석 큰길처럼 판석이 맞물린 면 + 풀과 닿는 쪽만 연석.
# 안쪽 판석은 16px 토러스 보로노이(돌 14개, 4~5px)라 길 칸끼리 이음매가 없다. 칸 경계에 걸친 돌은 모든 변형이 같은 단을 쓴다.
ROAD_STONES = []
for _j in range(3):
    for _i in range(3):
        ROAD_STONES.append(((_i * 16 / 3 + (2.7 if _j % 2 else 0) + (rnd(_i, _j, 131) - 0.5) * 1.6) % 16, (_j * 16 / 3 + 2.6 + (rnd(_i, _j, 132) - 0.5) * 1.2) % 16))


def road_px(x, y, var=0):
    best = []
    for k, (cx, cy) in enumerate(ROAD_STONES):
        dx = ((x + 0.5 - cx + 8) % 16) - 8; dy = ((y + 0.5 - cy + 8) % 16) - 8
        best.append((dx * dx * 0.9 + dy * dy * 1.15, k, dx, dy))
    best.sort()
    (d1, k, dx, dy), (d2, _, _, _) = best[0], best[1]
    gap = math.sqrt(d2) - math.sqrt(d1)
    if gap < 0.7: return ('stone', 1 if gap < 0.35 else 2)                # 줄눈
    cx, cy = ROAD_STONES[k]
    inner = 2.5 < cx < 13.5 and 2.5 < cy < 13.5
    v = rnd(k, 3 + (var if inner else 0), 141)
    base = 4 if v < 0.55 else 5 if v < 0.75 else 3
    t = base
    if gap < 1.7 and (dy < -0.8 or dx < -1.2): t = base + 1               # 돌 윗·왼 날(빛면)
    elif gap < 1.7 and (dy > 0.8 or dx > 1.2): t = base - 1               # 돌 아래·오른 날(그늘면)
    if rnd(x, y, 143 + var) < 0.04: t -= 1
    return ('stone', clamp(t, 0, 6))


def road_tile(c, sides='', var=0):
    """포석 큰길 칸. sides ⊂ 'nswe' = 풀과 닿는 쪽(연석). 북·서는 어두운 테 + 밝은 연석 윗면, 남은 연석 윗면 + 앞면 두 행(3/4), 동은 그늘 테."""
    for y in range(16):
        for x in range(16): c.P(x, y, *road_px(x, y, var))
    if 'n' in sides:
        c.HL(0, 0, 16, 'stone', 1); c.HL(0, 1, 16, 'stone', 5)
        for x in range(0, 16, 5): c.P(x, 1, 'stone', 3)
    if 's' in sides:
        c.HL(0, 13, 16, 'stone', 5); c.HL(0, 14, 16, 'stone', 3); c.HL(0, 15, 16, 'stone', 1)
        for x in range(2, 16, 5): c.P(x, 13, 'stone', 3); c.P(x, 14, 'stone', 2)
    if 'w' in sides:
        c.VL(0, 0, 16, 'stone', 1); c.VL(1, 0, 16, 'stone', 5)
        for y in range(3, 16, 5): c.P(1, y, 'stone', 3)
    if 'e' in sides:
        c.VL(15, 0, 16, 'stone', 1); c.VL(14, 0, 16, 'stone', 3)
        for y in range(1, 16, 5): c.P(14, y, 'stone', 2)
    # 모서리 다듬기(두 연석이 만나는 곳)
    if 'n' in sides and 'w' in sides: c.P(0, 0, 'grass', 2); c.P(1, 1, 'stone', 6)
    if 'n' in sides and 'e' in sides: c.P(15, 0, 'grass', 2); c.P(14, 1, 'stone', 4)
    if 's' in sides and 'w' in sides: c.P(0, 15, 'grass', 2); c.P(1, 13, 'stone', 6)
    if 's' in sides and 'e' in sides: c.P(15, 15, 'grass', 2); c.P(14, 13, 'stone', 4)
    if 's' in sides:
        if 'w' in sides: c.P(1, 14, 'stone', 4)
        if 'e' in sides: c.P(14, 14, 'stone', 2); c.P(14, 15, 'stone', 1)


ROAD_MASKS = [''.join(ch for ch, b in zip('nswe', (m & 1, m & 2, m & 4, m & 8)) if b) for m in range(16)]
for _sd in ROAD_MASKS:
    _id = 'road' + ('-' + _sd if _sd else '')
    A(_id, f'포석 큰길({_sd or "안쪽"})', 1, 1, 'terrain', ['길', '돌', '포석'],
      '구성기가 길 칸마다 풀과 닿는 쪽(n·s·w·e)을 보고 고른다 — 연석은 그 쪽에만. 길 칸끼리는 이음매 없이 붙는다.', pc='floor',
      gate_name='paved cobblestone road tile with curb (terrain)')((lambda sd: (lambda c: road_tile(c, sd)))(_sd))
A('road-b', '포석 큰길(안쪽, 다른 돌빛)', 1, 1, 'terrain', ['길', '돌', '포석'], 'road 사이에 섞는다.', pc='floor',
  gate_name='paved cobblestone road tile (terrain)')(lambda c: road_tile(c, '', 1))


COBBLES = [(rnd(k, 1, 91) * 16, rnd(k, 2, 91) * 16) for k in range(11)]


def cobble_px(x, y, s=1):
    """광장 판석(토러스 16px 보로노이 — 크기 다른 둥근 돌 11개): 줄눈 어둡게, 돌마다 한 단 차이, 윗·왼 가장자리 밝게."""
    best = []
    for k, (cx, cy) in enumerate(COBBLES):
        dx = ((x + 0.5 - cx + 8) % 16) - 8; dy = ((y + 0.5 - cy + 8) % 16) - 8
        best.append((dx * dx + dy * dy * 1.3, k, dx, dy))
    best.sort()
    (d1, k, dx, dy), (d2, _, _, _) = best[0], best[1]
    if math.sqrt(d2) - math.sqrt(d1) < 0.75: return ('stone', 2)
    v = rnd(k, 3, s)
    base = 4 if v < 0.5 else 5 if v < 0.8 else 3
    t = base
    if dy < -1.2 and math.sqrt(d2) - math.sqrt(d1) < 1.8: t = base + 1
    elif dy > 1.0 and math.sqrt(d2) - math.sqrt(d1) < 1.8: t = base - 1
    if rnd(x, y, s + 5) < 0.06: t -= 1
    return ('stone', clamp(t, 0, 6))


def inset_edge(c, kind, inner, border, s=1):
    """풀밭에 박힌 네모 바닥(광장·밭)의 가장자리 9칸. kind ∈ c n s w e nw ne sw se. border(c, ins) = 테 그리기."""
    m = 2
    ins = {'c': lambda x, y: True, 'n': lambda x, y: y >= m, 's': lambda x, y: y <= 15 - m, 'w': lambda x, y: x >= m, 'e': lambda x, y: x <= 15 - m,
           'nw': lambda x, y: y >= m and x >= m, 'ne': lambda x, y: y >= m and x <= 15 - m, 'sw': lambda x, y: y <= 15 - m and x >= m,
           'se': lambda x, y: y <= 15 - m and x <= 15 - m}[kind]
    grass_fill(c, 9 + s)
    for y in range(16):
        for x in range(16):
            if ins(x, y): c.P(x, y, *inner(x, y))
    border(c, ins, kind)


def curb_border(c, ins, kind):
    """광장 연석: 바깥 한 줄 큰 판석(윗면 밝게) + 그 밖 풀에 접지 그늘."""
    for y in range(16):
        for x in range(16):
            if not ins(x, y): continue
            out = [(dx, dy) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)) if not ins(x + dx, y + dy)]
            if out:
                horiz = any(dy for dx, dy in out)
                seg = (x // 5) if horiz else (y // 5)
                t = 5 if (dy_ := out[0][1]) == -1 or out[0][0] == -1 else 3
                if (x if horiz else y) % 5 == 4: t = 1
                c.P(x, y, 'stone', t)
                inn = (x - out[0][0], y - out[0][1])
                if 0 <= inn[0] < 16 and 0 <= inn[1] < 16 and ins(*inn):
                    c.P(inn[0], inn[1], 'stone', 4 if t != 1 else 1)
                g = (x + out[0][0], y + out[0][1])
                if 0 <= g[0] < 16 and 0 <= g[1] < 16 and out[0] in ((0, 1), (1, 0)): c.P(g[0], g[1], 'grass', 2)


A('plaza', '광장 자갈 포석', 1, 1, 'terrain', ['광장', '돌'], '신전 앞·마을 가운데 광장(네모). 가장자리는 plaza-n…se 로 두른다.', pc='floor', gate_name='cobblestone plaza tile (terrain)')(lambda c: c.F(0, 0, 16, 16, lambda x, y, i, j: cobble_px(x, y, 1)))
for _k in ('n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'):
    A(f'plaza-{_k}', f'광장 가장자리 {_k}', 1, 1, 'terrain', ['광장', '돌', '가장자리'], '광장 네모의 테두리(바깥은 풀).', pc='floor', gate_name='cobblestone plaza edge on grass (terrain)')(
        (lambda k: (lambda c: inset_edge(c, k, lambda x, y: cobble_px(x, y, 1), curb_border)))(_k))


def furrow_px(x, y, s=1):
    """밭 고랑(가로): 4px 주기 — 두둑 윗면 밝게, 고랑 어둡게."""
    yy = y % 4
    t = {0: 4, 1: 3, 2: 2, 3: 1}[yy]
    if yy == 0 and rnd(x, y, s) < 0.25: t = 5
    if rnd(x, y, s + 3) < 0.07: t -= 1
    return ('soil', clamp(t, 0, 5))


def field_border(c, ins, kind):
    """밭 테: 바깥 풀이 흙 위로 늘어진 풀잎 + 흙 쪽 어두운 테."""
    for y in range(16):
        for x in range(16):
            if not ins(x, y): continue
            if any(not ins(x + dx, y + dy) for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0))):
                c.P(x, y, 'soil', 0)
                if rnd(x, y, 5) < 0.4: c.P(x, y, 'grass', 2)


A('field', '밭(고랑)', 1, 1, 'terrain', ['밭', '흙'], '네모난 밭 안쪽. 작물(crop-*)을 위층에 얹는다. 가장자리는 field-n…se.', pc='floor', gate_name='tilled farm soil furrows (terrain)')(lambda c: c.F(0, 0, 16, 16, lambda x, y, i, j: furrow_px(x, y, 1)))
for _k in ('n', 's', 'w', 'e', 'nw', 'ne', 'sw', 'se'):
    A(f'field-{_k}', f'밭 가장자리 {_k}', 1, 1, 'terrain', ['밭', '흙', '가장자리'], '밭 네모의 테두리(바깥은 풀).', pc='floor', gate_name='tilled farm soil edge on grass (terrain)')(
        (lambda k: (lambda c: inset_edge(c, k, lambda x, y: furrow_px(x, y, 1), field_border)))(_k))


# ═══════════════════════ 시내·폭포(움직임 3프레임) ═══════════════════════
def water_px(x, y, f, flow=True):
    """흐르는 물(남쪽으로): 물결 줄이 프레임마다 아래로 내려간다(주기 16 → 프레임당 5~6px)."""
    yy = (y - f * 5) % 16
    t = 3
    if (yy + (x * 3) // 4) % 8 == 0: t = 5
    elif (yy + (x * 3) // 4) % 8 == 1: t = 4
    elif (yy + x // 3) % 11 == 6: t = 2
    return ('water', t)


def stream_tile(c, f=0, lip=False):
    """풀밭 사이 시내(폭 8, x 4…11) — 돌 둑 1px. lip=True 면 섬 남쪽 처마(gs-s)처럼 아래가 흙 띠이고 물이 처마로 넘어간다."""
    if lip: grass_edge(c, 's', 1)
    else: grass_fill(c, 13)
    y1 = 16
    for y in range(y1):
        for x in range(4, 12):
            if lip and y > LIP: continue
            c.P(x, y, *water_px(x, y, f))
        c.P(3, y, 'stone', 3 if y % 5 else 2); c.P(12, y, 'stone', 2 if y % 4 else 1)
        c.P(4, y, 'water', 1); c.P(11, y, 'water', 2)
        if lip and y > LIP: c.P(3, y, 'soil', 1); c.P(12, y, 'soil', 1)
    if lip:
        # 처마에서 물이 넘어가는 흰 거품 띠 + 그 아래 물줄기 시작
        for x in range(4, 12):
            c.P(x, LIP, 'water', 6 if (x + f) % 3 else 5); c.P(x, LIP - 1, 'water', 5)
            for y in range(LIP + 1, 16):
                c.P(x, y, 'water', 4 if (x + y + f * 2) % 4 else 6)


for _id, _nm, _lip in (('stream', '시내(남쪽으로 흐름)', False), ('stream-lip', '시내가 섬 끝으로 넘어가는 처마', True)):
    A(_id, _nm, 1, 1, 'terrain', ['물', '시내', '애니메이션'], '시내는 남북 한 줄로 이어 섬 남쪽 처마(stream-lip)까지 낸다. 처마 아래 밑면 칸마다 폭포(falls-*)를 위층에 얹는다. 물칸은 걷지 못한다.',
      pc='solidfloor', frames=3, gate_name='flowing stream channel on grass (terrain)')((lambda lip: (lambda c, f: stream_tile(c, f, lip)))(_lip))


def falls_tile(c, f=0, part='face'):
    """폭포(위층 덧그림, 투명 바탕): face = 절벽 앞을 흐르는 물줄기(폭 8, x 4…11), air = 섬 아래 허공으로 떨어지는 물(좁아짐), mist = 물보라."""
    if part in ('face', 'air'):
        w0, w1 = (4, 12) if part == 'face' else (5, 11)
        for y in range(16):
            a, b = (w0, w1) if part == 'face' else (w0 + (1 if y > 8 else 0), w1 - (1 if y > 8 else 0))
            for x in range(a, b):
                yy = (y - f * 6) % 16
                t = 4
                if (yy + x * 5) % 9 == 0: t = 6
                elif (yy + x * 5) % 9 in (1, 5): t = 5
                elif (x - a) == 0: t = 3
                elif x == b - 1: t = 2
                c.P(x, y, 'water', t)
            c.P(a - 1, y, 'water', 6 if (y + f) % 3 == 0 else 5) if part == 'face' else None
            c.P(b, y, 'water', 5 if (y + f) % 4 == 0 else 3) if part == 'face' else None
    else:
        # 물보라: 흰 물방울 덩이(아래로 옅어짐)
        for k in range(14):
            x = 3 + int(rnd(k, f, 51) * 10); y = int(rnd(k, f + 7, 51) * 13)
            r = 2.2 - y / 10
            if r <= 0.4: c.P(x, y, 'water', 6); continue
            c.ell(x, y, r, r, lambda xx, yy, dx, dy, d: ('water', 6 if dy < 0 else 5))
        for x in range(5, 11): c.P(x, 0, 'water', 5 if (x + f) % 2 else 6)


for _p, _nm, _gate in (('face', '폭포(절벽 앞 물줄기)', 'waterfall flowing over a rock cliff'), ('air', '폭포(섬 아래 허공)', 'waterfall falling through open sky'),
                       ('mist', '폭포 물보라', 'waterfall spray mist')):
    A(f'falls-{_p}', _nm, 1, 1, 'terrain', ['폭포', '물', '애니메이션'],
      '위층 덧그림. stream-lip 아래 밑면 칸마다 falls-face, 밑면 끝 아래 하늘 1~2칸에 falls-air, 그 아래 한 칸 falls-mist.', pc='solid', frames=3,
      gate_name=_gate + ' (terrain overlay)')((lambda p: (lambda c, f: falls_tile(c, f, p)))(_p))


# ═══════════════════════ 다리(위층 덧그림, 걷는다) ═══════════════════════
def rope(c, x0, x1, y, sag=1.5):
    for x in range(x0, x1):
        u = (x - x0) / max(1, x1 - x0 - 1)
        yy = y + round(sag * math.sin(math.pi * u))
        c.P(x, yy, 'plank', 3); c.P(x, yy + 1, 'plank', 1)


def post(c, x, y0, y1, w=2):
    c.R(x, y0, w, y1 - y0, 'wood', 3); c.VL(x, y0, y1 - y0, 'wood', 4); c.VL(x + w - 1, y0, y1 - y0, 'wood', 2)
    c.HL(x, y0, w, 'wood', 5); c.HL(x, y1 - 1, w, 'wood', 1)


def rope_bridge_h(c, end=None):
    """동서 밧줄 다리: 판자(세로 널, 윗면 7px + 앞 두께 2px) + 뒤 밧줄(위) + 앞 밧줄(아래). end w/e = 섬 쪽 굵은 말뚝."""
    for x in range(16):
        k = x // 3
        base = 4 if k % 2 else 5
        if x % 3 == 2: continue                                  # 널 사이 틈(하늘이 보인다)
        for y in range(5, 12): c.P(x, y, 'plank', base - (1 if y == 11 else 0))
        c.P(x, 5, 'plank', base + (1 if base < 5 else 0)); c.R(x, 12, 1, 2, 'wood', 2); c.P(x, 13, 'wood', 1)
    c.HL(0, 6, 16, 'plank', 2) if False else None
    rope(c, 0, 16, 2, 1.2); rope(c, 0, 16, 12, 1.4)
    for x in (2, 8, 14):
        c.VL(x, 4, 2, 'plank', 2)
    if end in ('w', 'e'):
        px_ = 1 if end == 'w' else 12
        post(c, px_, 0, 7, 3); post(c, px_, 8, 16, 3)
        c.R(px_ - 1, 15, 5, 1, 'grass', 1)


def rope_bridge_v(c, end=None):
    """남북 밧줄 다리: 가로 널(폭 x 3…12, 널 사이 1px 틈) + 양옆 밧줄. end n/s = 말뚝 한 쌍."""
    for y in range(16):
        if y % 4 == 3: continue
        for x in range(3, 13):
            t = 5 if y % 4 == 0 else 4
            if x in (3, 12): t -= 2
            c.P(x, y, 'plank', t)
        c.HL(3, y, 1, 'wood', 2)
    for y in range(16):
        c.P(2, y, 'plank', 3 if y % 5 else 1); c.P(13, y, 'plank', 2 if y % 5 else 1)
        if y % 4 == 1: c.P(1, y, 'plank', 2); c.P(14, y, 'plank', 1)
    if end in ('n', 's'):
        y0 = 0 if end == 'n' else 9
        post(c, 0, y0, y0 + 7, 3); post(c, 13, y0, y0 + 7, 3)


A('bridge-h', '밧줄 다리(동서)', 1, 1, 'flat', ['다리', '밧줄', '나무'], '두 섬 사이 하늘 칸에 동서로 잇는다(위층, 걷는다). 양 끝은 섬 가장자리 칸에 bridge-h-w / bridge-h-e.', pc='flat', gate_name='rope plank bridge seen from above (flat walkway)')(lambda c: rope_bridge_h(c))
A('bridge-h-w', '밧줄 다리 서쪽 끝(말뚝)', 1, 1, 'flat', ['다리', '밧줄'], '서쪽 섬의 동쪽 가장자리 칸.', pc='flat', gate_name='rope bridge end with wooden posts (flat walkway)')(lambda c: rope_bridge_h(c, 'w'))
A('bridge-h-e', '밧줄 다리 동쪽 끝(말뚝)', 1, 1, 'flat', ['다리', '밧줄'], '동쪽 섬의 서쪽 가장자리 칸.', pc='flat', gate_name='rope bridge end with wooden posts (flat walkway)')(lambda c: rope_bridge_h(c, 'e'))
A('bridge-v', '밧줄 다리(남북)', 1, 1, 'flat', ['다리', '밧줄', '나무'], '북쪽 섬 남쪽 가장자리에서 남쪽 섬 북쪽 가장자리까지(밑면·하늘 칸 위, 위층, 걷는다).', pc='flat', gate_name='rope plank bridge seen from above (flat walkway)')(lambda c: rope_bridge_v(c))
A('bridge-v-n', '밧줄 다리 북쪽 끝(말뚝)', 1, 1, 'flat', ['다리', '밧줄'], '북쪽 섬의 남쪽 가장자리 칸.', pc='flat', gate_name='rope bridge end with wooden posts (flat walkway)')(lambda c: rope_bridge_v(c, 'n'))
A('bridge-v-s', '밧줄 다리 남쪽 끝(말뚝)', 1, 1, 'flat', ['다리', '밧줄'], '남쪽 섬의 북쪽 가장자리 칸.', pc='flat', gate_name='rope bridge end with wooden posts (flat walkway)')(lambda c: rope_bridge_v(c, 's'))


def stone_deck(c, end=None):
    """돌다리 상판(동서): 뒤 난간(윗면 3px + 앞면 2px) · 판석 길 · 앞 난간 윗면. end = 끝 기둥."""
    for x in range(16):
        for y in range(5, 13): c.P(x, y, *cobble_px(x, y + 1, 2))
    c.R(0, 0, 16, 3, 'stone', 5); c.HL(0, 0, 16, 'stone', 3); c.R(0, 3, 16, 2, 'stone', 3); c.HL(0, 4, 16, 'stone', 2)
    c.R(0, 13, 16, 2, 'stone', 5); c.HL(0, 13, 16, 'stone', 6); c.HL(0, 15, 16, 'stone', 3)
    for x in range(0, 16, 6): c.VL(x, 0, 5, 'stone', 2); c.VL(x, 13, 3, 'stone', 3)
    if end in ('w', 'e'):
        x0 = 0 if end == 'w' else 11
        for (yy, hh) in ((0, 6), (11, 5)):
            c.R(x0, yy, 5, hh, 'stone', 4); c.HL(x0, yy, 5, 'stone', 6); c.VL(x0, yy, hh, 'stone', 5); c.VL(x0 + 4, yy, hh, 'stone', 2)
            c.HL(x0 + 1, yy + 1, 3, 'glow', 3) if yy == 0 else None


def stone_arch(c, end=None):
    """돌다리 아래 아치 면(위층, 막힘): 다리 상판 바로 아래 줄. 아치 구멍으로 하늘이 보인다."""
    for y in range(16):
        for x in range(16):
            row = y // 4; xx = (x + (row % 2) * 4) % 8
            t = 3 if (y % 4 == 3 or xx == 7) else 4 if rnd(x // 8, row, 3) < 0.6 else 3
            if y % 4 == 0 and xx < 6: t += 1
            c.P(x, y, 'stone', t)
    if end is None:
        c.ell(8, 16, 6.5, 11, lambda x, y, dx, dy, d: (None, 0) if d < 1 else None)
        for y in range(16):
            for x in range(16):
                if c.get(x, y) and ((x > 0 and not c.on(x - 1, y)) or (x < 15 and not c.on(x + 1, y)) or (y > 0 and not c.on(x, y - 1)) or (y < 15 and not c.on(x, y + 1))):
                    c.P(x, y, 'stone', 1)
    else:
        x0, x1 = (0, 6) if end == 'w' else (10, 16)
        for y in range(16):
            for x in range(16):
                if not (x0 <= x < x1) and y > 3 + abs(x - (x1 if end == 'w' else x0)) // 3: c.P(x, y, None, 0)
        c.HL(0, 15, 16, 'stone', 1)
    c.HL(0, 0, 16, 'stone', 2)


A('sbridge', '돌다리 상판(동서)', 1, 1, 'flat', ['다리', '돌'], '두 섬 사이 동서로(걷는다). 바로 아래 줄에 sbridge-arch 를 같이 놓는다.', pc='flat', gate_name='stone bridge deck with parapets seen from above (flat walkway)')(lambda c: stone_deck(c))
A('sbridge-w', '돌다리 상판 서쪽 끝', 1, 1, 'flat', ['다리', '돌'], '서쪽 섬의 동쪽 가장자리 칸.', pc='flat', gate_name='stone bridge deck end with pillar (flat walkway)')(lambda c: stone_deck(c, 'w'))
A('sbridge-e', '돌다리 상판 동쪽 끝', 1, 1, 'flat', ['다리', '돌'], '동쪽 섬의 서쪽 가장자리 칸.', pc='flat', gate_name='stone bridge deck end with pillar (flat walkway)')(lambda c: stone_deck(c, 'e'))
A('sbridge-arch', '돌다리 아치 면', 1, 1, 'terrain', ['다리', '돌'], '돌다리 상판 바로 아래 줄(하늘 칸 위, 막힘).', pc='solid', gate_name='stone bridge arch face (terrain overlay)')(lambda c: stone_arch(c))
A('sbridge-arch-w', '돌다리 아치 서쪽 받침', 1, 1, 'terrain', ['다리', '돌'], '아치 줄의 서쪽 끝.', pc='solid', gate_name='stone bridge abutment (terrain overlay)')(lambda c: stone_arch(c, 'w'))
A('sbridge-arch-e', '돌다리 아치 동쪽 받침', 1, 1, 'terrain', ['다리', '돌'], '아치 줄의 동쪽 끝.', pc='solid', gate_name='stone bridge abutment (terrain overlay)')(lambda c: stone_arch(c, 'e'))


# ═══════════════════════ 부두(하늘 항구 잔교, 위층 덧그림) ═══════════════════════
def pier(c, kind):
    """잔교 상판(가로 널, 위층·걷는다) 9칸 중 w c e sw s se n·nw·ne(섬 처마 위 시작). 남쪽 끝은 앞면 두께 + 테 널."""
    south = kind in ('s', 'sw', 'se')
    yend = 12 if south else 16
    for y in range(0, yend):
        if y % 4 == 3: 
            for x in range(16): c.P(x, y, 'wood', 2)
            continue
        for x in range(16):
            t = 4 if (y // 4 + x // 8) % 2 else 5
            if y % 4 == 0: t += 1 if t < 5 else 0
            if rnd(x, y, 61) < 0.06: t -= 1
            c.P(x, y, 'plank', t)
        if y % 4 == 1:
            for x in (2, 13): c.P(x, y, 'iron', 2)                 # 못
    if south:
        c.R(0, 12, 16, 3, 'wood', 3); c.HL(0, 12, 16, 'wood', 4); c.HL(0, 14, 16, 'wood', 1); c.HL(0, 15, 16, 'sumi', 1)
    if kind in ('w', 'sw', 'nw'):
        c.R(0, 0, 3, yend, 'wood', 3); c.VL(0, 0, yend, 'wood', 1); c.VL(1, 0, yend, 'wood', 4)
    if kind in ('e', 'se', 'ne'):
        c.R(13, 0, 3, yend, 'wood', 3); c.VL(15, 0, yend, 'wood', 1); c.VL(13, 0, yend, 'wood', 4)
    if south and kind != 's':
        x = 0 if kind == 'sw' else 13
        c.R(x, 12, 3, 4, 'wood', 2); c.VL(x, 12, 4, 'wood', 1 if kind == 'se' else 3)


for _k in ('w', 'c', 'e', 'sw', 's', 'se'):
    A(f'pier-{_k}', f'잔교 상판 {_k}', 1, 1, 'flat', ['부두', '잔교', '나무'], '섬 남쪽 처마에서 하늘로 내민 판자 잔교(폭 3칸 이상, 위층, 걷는다). 남쪽 끝 줄 아래에는 pier-struts.', pc='flat',
      gate_name='wooden sky dock plank deck seen from above (flat walkway)')((lambda k: (lambda c: pier(c, k)))(_k))


def struts(c, kind):
    """잔교 끝 아래 버팀대(위층, 막힘): 사선 버팀 보 두 개가 섬 쪽(북)으로 기운다 + 쇠 띠."""
    for (x0, x1) in ((3, 6), (10, 13)):
        for y in range(16):
            xx = x0 + (y // 4)
            if xx + 2 > 16: break
            c.R(xx, y, 2, 1, 'wood', 3); c.P(xx, y, 'wood', 4); c.P(xx + 1, y, 'wood', 1)
        c.HL(x0, 2, 4, 'iron', 3)
    c.R(0, 0, 16, 2, 'wood', 2); c.HL(0, 1, 16, 'wood', 1)
    if kind == 'w': c.R(0, 0, 3, 6, 'wood', 2)
    if kind == 'e': c.R(13, 0, 3, 6, 'wood', 2)


for _k in ('w', 'c', 'e'):
    A(f'pier-struts-{_k}', f'잔교 버팀대 {_k}', 1, 1, 'frame', ['부두', '잔교'], '잔교 남쪽 끝 줄 바로 아래(하늘 위, 막힘).', pc='solid', gate_name='diagonal wooden support struts under a dock (frame)')(
        (lambda k: (lambda c: struts(c, k)))(_k))


if __name__ == '__main__':
    rows = R.export()
    print(len(R.items), 'pieces', len(rows), 'pngs')
