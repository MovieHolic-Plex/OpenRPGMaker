"""사막 — em Route111(사막·바위산 구간) 문법을 본 시트 화풍으로.

원작에서 잰 문법:
- 걷는 땅은 맵 대부분을 덮은 모래(dsand, 아주 조용한 물결 토막). 골짜기 양옆을 사암 벼랑(dcliff)이 막는다.
- 벼랑은 여러 층: 아래층 앞면은 두 칸 높이(남쪽이 열린 dcliff 칸 바로 밑에 앞면 아랫단 dcliff_face_{m,l,r,s}), 아래층 윗면 한 칸 안쪽에 둘째 층(dcliff2, 앞면 한 칸).
  둘째 층은 아래층 가장자리에서 서·북·동 1칸, 남 2칸 이상 띄운다. 폭이 줄어든 행은 2행 이상 유지한다(앞면 아랫단이 놓일 자리).
- 막는 소품은 2×2 바위: 키 큰 바위 무더기 두 변형(dcone·dcone_c — 밑이 넓은 울퉁불퉁한 덩이 + 곁 덩이) + 낮은 둥근 바위(dcone_b)를 섞어 2~3개씩 무리 짓는다.
  옆구리가 곧은 세로선이거나 꼭대기가 뾰족한 오각형이면 천막·짚더미로 읽힌다(L2 N1). 벼랑 위 봉우리도 같은 바위를 둘째 층 윗면에 얹는다(2×2 와 그 아래 한 칸이 둘째 층 — 앞면 칸에 걸치지 않게).
- 깊은 모래는 윤곽선 없이 톤만 진한 둥근 얼룩(경계 체커). 경계가 칸 격자를 따르면 깔개·「+」 표지로 읽힌다(L1 N5) —
  맵에는 여러 칸 한 장 얼룩 `dspatch_a_<i>_<j>`(7×4)·`dspatch_b_<i>_<j>`(4×3)를 칸마다 lo 로 깐다(경계가 칸 안 곡선). 오토타일 deepsand 는 작은 얼룩용.
  개미지옥(sandpit 2×2)은 걸을 수 있는 이벤트 자리.
- 오아시스: 물(oasis)은 반드시 풀 띠 안 — 물 둘레 1칸 이상 풀. 풀 띠는 한 장 `dgpatch_<i>_<j>`(8×7, 물 칸은 oasis 가 덮는다, 벼랑 칸은 건너뛴다)
  또는 오토타일 dgrass. 풀 면은 본 시트 풀과 같은 재료(2톤 밝은 덩이, 어두운 점 없음). 야자 palm_a(정본 = 해안 시트 coast.palm — 같은 게임의 같은 나무) 2~3그루.
- 목적지는 사암 유적 입구(ruin_gate 3×3, 가운데 아래 칸이 입구) — 기둥(ruin_pillar = 정본 던전 유적 기둥 dungeon_rooms.ru_pillar 를 사암 램프로)·쓰러진 기둥 토막(ruin_stub = 정본 던전 dungeon_rooms.ru_rubble 변형 1 을 사암 램프로)·모래 둔덕이 입구를 둘러싼다.
- 다른 시트에 이미 있는 같은 물체(야자·유적 기둥·얼음 판·민가 지붕)는 다시 그리지 않고 그 시트의 정본 함수를 부른다(L4).
- 모래 언덕 턱(dledge)은 벼랑에서 벼랑까지 잇고 2칸 틈을 둔다. 마른 덤불(dbush)·뼈(dbones)·선인장은 띄엄띄엄."""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import climate_common as cc  # noqa: E402

PARAMS = {
    "deepsand": ("deep-sand", 3, -1, 2),
    "oasis": ("oasis-water", 3, -1, 1),
    "dgrass": ("oasis-grass", 3, -1, 2),
}

_SAND0: dict = {}


def sand_tex(P, v: int):
    """사막 모래: 본 시트 모래(바탕 + 밝은 덩이 두 톤) 위에 물결 두 줄 — 그늘 한 단(s1) 줄과 그 위 밝은(s3) 줄. 줄은 끊긴 토막이라 조용하다."""
    s = P["sand"]
    im = px.clumps(f"dsand{v}", s[2], [(s[3], 9, 3), (s[1], 5, 3)])
    r = px.rng(f"dsand-ripple{v}")
    for k in range(2):
        y0 = 3 + 8 * k + (v % 2) * 2
        ph = r.uniform(0, 6.28)
        x = r.randrange(0, 4)
        while x < T:
            ln = r.choice((4, 5, 6))
            for i in range(ln):
                xx = (x + i) % T
                yy = (y0 + round(1.1 * math.sin(2 * math.pi * xx / T + ph))) % T
                im.putpixel((xx, yy), s[1])
                if i not in (0, ln - 1):
                    im.putpixel((xx, (yy - 1) % T), s[3])
            x += ln + r.choice((3, 4, 5))
    return im


def init(P):
    _SAND0.clear(); _SAND0.update(cc.tex_table(sand_tex(P, 0)))
    _GRASS.clear(); _GRASS.update(cc.tex_table(grass_tex(dict(P, grass=P.get("oasis_grass", P["grass"])), 0)))   # 오아시스 풀 면(따뜻한 녹색)


def sand0(x, y):
    return _SAND0[(x, y)]


def deep_sand(P, m: int):
    """깊은 모래 구역: 한 단 진한 주황 면에 짙은 물결 토막, 경계 안쪽 1px 진한 테, 바깥 1px 모래 그늘(둥근 덩이 모서리)."""
    d, s = P["deep_sand"], P["sand"]
    tex = px.clumps("deepsand", d[1], [(d[2], 10, 3), (d[0], 2, 2)])
    def rim_in(x, y, dd):                                           # 윤곽선 없음 — 경계 1px 는 바깥 모래와 체커로 섞는다(원작 111번 도로: 톤만 다른 얼룩)
        return s[1] if dd == 1 and (x + y) % 2 else None
    def rim_out(x, y, dd):
        return d[2] if dd == 1 and (x + y) % 2 == 0 else None
    return cc.blob_tile(m, PARAMS["deepsand"], lambda x, y: tex.getpixel((x, y)), sand0, rim_in, rim_out)


def sand_patch(P, cw: int, ch: int, rx: float, ry: float, rot: float, seed: str) -> dict:
    """깊은 모래 얼룩(여러 칸 한 장, 바닥 칸): 칸 경계가 아니라 칸 안 곡선(흔들린 기울어진 타원 거리장)으로 경계를 정한다 — 원작 111번 도로의
    진한 모래처럼 둥근 물결 경계. 안은 deep_sand 와 같은 면, 경계 안 1px 은 모래와 체커, 바깥 1px 은 진한 모래 체커(윤곽선 없음).
    반환 {(i, j): 칸 그림}. 맵에서는 lo() 로 칸마다 깐다(걷는 땅)."""
    d, s = P["deep_sand"], P["sand"]
    tex = px.clumps("deepsand", d[1], [(d[2], 10, 3), (d[0], 2, 2)])
    sands = [sand_tex(P, v) for v in range(4)]
    W_, H_ = cw * T, ch * T
    cx, cy = W_ / 2, H_ / 2
    ph = px.rng(f"patch-{seed}").uniform(0, 6.28)
    ca, sa = math.cos(rot), math.sin(rot)
    def val(x, y):
        dx, dy = x + 0.5 - cx, y + 0.5 - cy
        u, v = dx * ca + dy * sa, -dx * sa + dy * ca
        a = math.atan2(v / ry, u / rx)
        k = 1 + 0.09 * math.sin(3 * a + ph) + 0.05 * math.sin(5 * a + 2 * ph)
        return math.hypot(u / rx, v / ry) / k
    big = px.new(W_, H_)
    for y in range(H_):
        for x in range(W_):
            e = val(x, y)
            i, j = x // T, y // T
            c = sands[(i + 2 * j) % 4].getpixel((x % T, y % T))
            if e <= 1.0:
                c = tex.getpixel((x % T, y % T))
                if val(x - 1, y) > 1.0 or val(x + 1, y) > 1.0 or val(x, y - 1) > 1.0 or val(x, y + 1) > 1.0:
                    c = s[1] if (x + y) % 2 else c
            elif (val(x - 1, y) <= 1.0 or val(x + 1, y) <= 1.0 or val(x, y - 1) <= 1.0 or val(x, y + 1) <= 1.0) and (x + y) % 2 == 0:
                c = d[2]
            big.putpixel((x, y), c)
    return {(i, j): big.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)) for j in range(ch) for i in range(cw)}


def grass_patch(P, cw: int, ch: int, cx: float, cy: float, rx: float, ry: float, seed: str, avoid=(), margin: float = 5.0) -> dict:
    """오아시스 풀 띠 한 장(여러 칸, 바닥 칸): 물을 감싸는 흔들린 타원 거리장으로 경계를 칸 안 곡선으로 정한다(칸 격자 계단 없음).
    면은 본 시트 풀 질감(grass0 — 오아시스 물 칸의 바깥 바닥과 같은 그림이라 이음매가 없다), 경계 안 1px 은 띄엄띄엄 한 단 어두운 풀,
    바깥 1px 은 풀·모래 체커. 물 칸 자리는 맵에서 oasis 오토타일이 덮는다. avoid = 벼랑이 덮는 칸(i, j) — 풀은 그 칸에서 margin px 떨어진다.
    반환 {(i, j): 칸 그림}."""
    g = P["grass"]
    sands = [sand_tex(P, v) for v in range(4)]
    ph = px.rng(f"gpatch-{seed}").uniform(0, 6.28)
    def val(x, y):
        u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
        a = math.atan2(v, u)
        e = math.hypot(u, v) / (1 + 0.07 * math.sin(3 * a + ph) + 0.05 * math.sin(4 * a + 2 * ph))
        for (ai, aj) in avoid:
            ddx = max(ai * T - (x + 0.5), 0, (x + 0.5) - (ai + 1) * T)
            ddy = max(aj * T - (y + 0.5), 0, (y + 0.5) - (aj + 1) * T)
            if math.hypot(ddx, ddy) < margin:
                return 9.0
        return e
    W_, H_ = cw * T, ch * T
    big = px.new(W_, H_)
    for y in range(H_):
        for x in range(W_):
            e = val(x, y)
            c = sands[(x // T + 2 * (y // T)) % 4].getpixel((x % T, y % T))
            nb = [val(x - 1, y), val(x + 1, y), val(x, y - 1), val(x, y + 1)]
            if e <= 1.0:
                c = grass0(x % T, y % T)
                if max(nb) > 1.0 and (x * 3 + y * 5) % 7 < 3:
                    c = g[1]
            elif min(nb) <= 1.0 and (x + y) % 2 == 0:
                c = g[2]
            big.putpixel((x, y), c)
    return {(i, j): big.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)) for j in range(ch) for i in range(cw)}


def grass_tex(P, v: int = 0):
    """오아시스 풀 면 = 본 시트 풀(grass)과 같은 재료: 바탕 g[2] 에 밝은 두 톤 덩이(g[3]·g[4]) — 어두운 점 없이 조용하다."""
    g = P["grass"]
    return px.clumps(f"dgrass{v}", g[2], [(g[3], 17 + v, 3), (g[4], 6, 2)])


_GRASS: dict = {}


def grass0(x, y):
    return _GRASS[(x, y)]


def oasis_grass(P, m: int):
    """오아시스 풀 띠(걷는 땅): 모래 위 둥근 풀밭 덩이. 면은 본 시트 풀 질감, 경계 안쪽 1px 은 띄엄띄엄 한 단 어두운 풀(g[1]),
    바깥 1px 은 풀과 모래의 체커(삐죽한 1px 줄기 없이 부드럽게 녹는다). 윤곽선은 없다."""
    g, s = P["grass"], P["sand"]
    def rim_in(x, y, dd):
        return g[1] if dd == 1 and (x * 3 + y * 5) % 7 < 3 else None
    def rim_out(x, y, dd):
        return g[2] if dd == 1 and (x + y) % 2 == 0 else None
    return cc.blob_tile(m, PARAMS["dgrass"], lambda x, y: grass0(x, y), sand0, rim_in, rim_out)


def oasis(P, m: int, f: int):
    """오아시스 물(4프레임): 그물 물결 + 물가 1px 밝은 물빛, 바깥은 풀 띠(dgrass) — 물가 1px 은 젖은 흙, 그 밖 풀.
    오아시스는 반드시 dgrass 풀 띠 안에 칠한다(바깥 바닥이 풀이다)."""
    w, g = P["water"], P["grass"]
    wr = [w[0], w[1], w[2], w[3]]
    def rim_in(x, y, dd):
        return w[3] if dd == 1 else None
    def rim_out(x, y, dd):
        return g[0] if dd == 1 else g[0] if dd == 2 and (x + y) % 2 else None
    return cc.blob_tile(m, PARAMS["oasis"], lambda x, y: cc.net_water(wr, x, y, f), grass0, rim_in, rim_out)


def masks(kind: str) -> dict:
    return cc.masks(PARAMS[kind])


def cliff_cells(P, floor=None, prefix: str = "dcliff"):
    """사암 벼랑(47 + 속 변형 6): 본 시트 동굴 벽 그림을 사막 모래 위에 그린다(벽 램프는 본 시트 cave_wall = 주황 사암)."""
    import cave
    cave._FLOOR.clear(); cave._FLOOR.update(floor or _SAND0)
    cave._TOP.clear()
    out = {}
    for k in px.ALL47:
        out[f"{prefix}_at{k}"] = cave.wall_cell(P, k)
    for v in range(3):
        out[f"{prefix}_mid{v}"] = cave.wall_cell(P, 255, deep=v, tier=0)
    for v in range(3):
        out[f"{prefix}_deep{v}"] = cave.wall_cell(P, 255, deep=v, tier=1)
    cave._TOP.clear()
    return out


# ---- 소품 -----------------------------------------------------------------------------------
def _outline_fill(cv, inside, ramp, light_fn):
    W_, H_ = cv.size
    for y in range(H_):
        for x in range(W_):
            if not inside(x, y):
                continue
            e = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            if e[1] or e[2]:
                c = ramp[0]
            elif e[0] or e[3]:
                c = ramp[1]
            else:
                lt = light_fn(x, y)
                c = ramp[4] if lt > 0.75 else ramp[3] if lt > 0.25 else ramp[2] if lt > -0.4 else ramp[1]
            cv.putpixel((x, y), c)


def _shadow(cv, inside, y_from=0):
    W_, H_ = cv.size
    for y in range(y_from, H_):
        for x in range(W_):
            if not inside(x, y) and inside(x - 2, y - 3) and cv.getpixel((x, y))[3] == 0:
                cv.putpixel((x, y), cc.SHADOW)


def cactus_small(P):
    """작은 통선인장(1칸): 둥근 몸통에 세로 골 세 줄, 가시 점, 꼭대기 분홍 꽃 하나."""
    c, s = P["cactus"], P["sand"]
    cv = px.new()
    body = cc.lobes([(8.0, 9.2, 5.0), (8.0, 11.0, 4.6)])
    _shadow(cv, body, 9)
    _outline_fill(cv, body, c, lambda x, y: -((x - 8) * 1.0 + (y - 9)) / 5.0)
    for gx in (6, 10):
        for y in range(6, 15):
            if body(gx, y) and body(gx, y - 1) and body(gx, y + 1):
                cv.putpixel((gx, y), c[1])
    for x, y in ((5, 8), (8, 6), (11, 9), (7, 12), (9, 11), (4, 11), (12, 12)):
        if body(x, y):
            cv.putpixel((x, y), s[3])
    pk = P["pink"]
    for x, y, k in ((7, 3, 1), (8, 3, 2), (9, 3, 1), (8, 2, 2), (8, 4, 0)):
        cv.putpixel((x, y), pk[k])
    return cv


def cactus_tall(P):
    """큰 기둥선인장(1×2): 기둥 하나 + 양쪽으로 꺾여 오른 팔 둘. 세로 골·가시, 밑동 그림자. 위 칸은 위층."""
    c, s = P["cactus"], P["sand"]
    cv = px.new(T, 2 * T)
    def inside(x, y):
        if 5.5 <= x <= 10.5 and 3 <= y <= 30:
            if y < 4 and (x < 6.5 or x > 9.5):
                return False
            return True
        if 1.5 <= x <= 4.5 and 9 <= y <= 19:                       # 왼팔(위로 선 부분)
            return not (y < 10 and (x < 2.5 or x > 3.5))
        if 1.5 <= x <= 6 and 17 <= y <= 20:                        # 왼팔(몸통으로 잇는 부분)
            return True
        if 11.5 <= x <= 14.5 and 6 <= y <= 15:
            return not (y < 7 and (x < 12.5 or x > 13.5))
        if 10 <= x <= 14.5 and 13 <= y <= 16:
            return True
        return False
    _shadow(cv, inside, 26)
    _outline_fill(cv, inside, c, lambda x, y: 0.9 - (x % 16 - (8 if 5 <= x <= 11 else 3 if x < 5 else 13)) * 0.45 - y * 0.012)
    for y in range(5, 30):                                          # 몸통 세로 골
        cv.putpixel((8, y), c[1] if y % 3 else c[2])
    for x, y in ((6, 8), (10, 12), (6, 16), (10, 20), (6, 24), (3, 12), (13, 9), (9, 27)):
        cv.putpixel((x, y), s[3])
    return cv



def _mound(cv, s, cx, cy, rx, ry):
    """모래 무덤(칸 안에서 끝난다): 윗변 1px 밝은 모래, 왼쪽 위 밝음, 오른쪽 아래 그늘 톤, 아랫변·오른변 진한 테."""
    W_, H_ = cv.size
    ins = lambda x, y: ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 and y < H_
    for y in range(H_):
        for x in range(W_):
            if not ins(x, y):
                continue
            top = not ins(x, y - 1)
            bot = not ins(x, y + 1) or not ins(x + 1, y)
            c = s[3] if top else s[0] if bot and (x >= cx - 2) else s[1] if bot else s[3] if x < cx - 2 and y < cy else s[2] if x < cx + 2 else s[1]
            cv.putpixel((x, y), c)


def ruin_wall(P):
    """무너진 유적 담(3×2): 돌덩이 두 단이 쌓였다가 오른쪽으로 갈수록 무너져 낮아지고, 밑은 모래에 묻혔다. 돌마다 윗면 밝음·아랫변 진함."""
    r, s = P["ruin"], P["sand"]
    cv = px.new(48, 32)
    top_at = lambda x: 9 if x < 20 else 14 if x < 34 else 20
    for y in range(20, 32):
        for x in range(48):
            if 2 <= x - 2 <= 44 and top_at(x - 2) <= y - 3 <= 27 and not (2 <= x <= 44 and top_at(x) <= y <= 27):
                cv.putpixel((x, y), cc.SHADOW)
    for y in range(32):
        for x in range(2, 45):
            t0 = top_at(x)
            if not (t0 <= y <= 27):
                continue
            row = (y - 9) // 6
            off = 0 if row % 2 == 0 else 7
            bx = (x + off) % 14
            by = (y - 9) % 6
            c = r[3] if by == 0 else r[2] if x < 30 else r[1]
            if by == 5 or bx == 13:
                c = r[1] if x < 30 else r[0]                        # 줄눈
            if y == t0:
                c = r[4]
            if x == 44 or (x == 2 and y > t0):
                c = r[0] if x == 44 else r[2]
            if x in (19, 33) and y < top_at(x + 1):
                c = r[0]                                            # 무너진 단 옆면
            cv.putpixel((x, y), c)
    for x, y in ((10, 13), (11, 14), (11, 15), (25, 20), (26, 21)):
        cv.putpixel((x, y), r[0])
    _mound(cv, s, 18.0, 28.0, 17.0, 3.8)
    _mound(cv, s, 38.0, 28.6, 9.0, 3.2)
    return cv


def rock_spire(P):
    """뾰족 바위(1칸, 원작 사막의 원뿔 바위): 사암 원뿔, 왼쪽 면 밝고 오른쪽 면 어둡다, 꼭대기 밝은 점, 밑 그림자."""
    w = P["cave_wall"]
    cv = px.new()
    def ins(x, y):
        if not (2 <= y <= 13):
            return False
        half = 0.8 + (y - 2) * 0.55
        return abs(x + 0.5 - 8) <= half
    _shadow(cv, ins, 10)
    for y in range(T):
        for x in range(T):
            if not ins(x, y):
                continue
            u = (x + 0.5 - 8) / (0.8 + (y - 2) * 0.55)
            c = w[4] if u < -0.45 and y < 9 else w[3] if u < -0.05 else w[2] if u < 0.5 else w[1]
            if not ins(x + 1, y) or not ins(x, y + 1):
                c = w[0]
            elif not ins(x - 1, y):
                c = w[2]
            if y in (7, 11) and -0.2 < u < 0.6:
                c = w[1]                                            # 결 두 줄
            cv.putpixel((x, y), c)
    return cv


def dry_rock(P, v: int):
    """마른 바위(1칸): 본 시트 바위 덩이(주황 바위 램프) + 마른 금 두 줄."""
    import outdoor2 as o2
    rk = P["rock"]
    im = o2.boulder(P, v)
    for x, y in ([(6, 6), (7, 7), (7, 8), (8, 9)] if v == 0 else [(9, 5), (8, 6), (8, 7), (5, 9), (6, 10)]):
        if im.getpixel((x, y))[3] == 255:
            im.putpixel((x, y), rk[1])
    return im


def ruin_gate(P):
    """사암 유적 입구(3×3, 48×48 — 사막의 목적지): 두 기둥 벽 위에 상인방, 그 위 부서진 머릿돌. 가운데 아래 칸이 어두운 입구(이동 이벤트 자리).
    사암 램프(ruin), 어긋쌓기 돌 줄눈, 왼쪽 기둥 밝고 오른쪽 기둥 그늘, 아래는 모래 둔덕이 반쯤 묻는다. 밑 그림자 오른쪽 2·아래 3."""
    r, s = P["ruin"], P["sand"]
    cv = px.new(48, 48)
    dark = r[0]
    deep = P["cliff_desert"][0]
    def lint(x, y): return 3 <= x <= 44 and 8 <= y <= 15
    def cap(x, y): return 15 <= x <= 32 and (3 if x < 27 else 5 + (x - 27) // 2) <= y <= 7
    def pier(x, y): return (3 <= x <= 15 or 32 <= x <= 44) and 16 <= y <= 45
    def door(x, y): return 16 <= x <= 31 and 16 <= y <= 47 and not (y < 19 and (x - 23.5) ** 2 / 64 + (y - 19) ** 2 / 9 > 1)
    ins = lambda x, y: lint(x, y) or cap(x, y) or pier(x, y)
    for y in range(20, 48):
        for x in range(48):
            if not ins(x, y) and not door(x, y) and ins(x - 2, y - 3):
                cv.putpixel((x, y), cc.SHADOW)
    for y in range(48):
        for x in range(48):
            if door(x, y) and not lint(x, y):
                c = dark
                if y <= 18 or not door(x, y - 3) or x <= 17:
                    c = deep                                        # 문틀 안쪽 위 3px·왼쪽 2px 최암(상인방·왼 기둥이 드리운 깊이)
                elif y >= 37:
                    c = r[1]                                        # 안쪽 아래는 한 단 밝다(바닥에 비친 빛 — 깊이 그라데이션, L2 N12)
                if y == 44:
                    c = r[3]                                        # 문지방 돌 1px 밝게
                if y >= 45:
                    c = s[3] if y == 45 and 17 <= x <= 30 else s[2] if y > 45 else c   # 문턱에 쌓인 모래(위 1줄 밝은 입술)
                cv.putpixel((x, y), c)
                continue
            if not ins(x, y):
                continue
            if cap(x, y):
                top = 3 if x < 27 else 5 + (x - 27) // 2
                c = r[4] if y == top else r[3] if y < 6 else r[2]
                if x == 32 or (x >= 27 and y == top):
                    c = r[1] if y != top else r[3]
                if x == 15:
                    c = r[2]
            elif lint(x, y):
                c = r[4] if y == 8 else r[3] if y <= 10 else r[2]
                bx = (x + (0 if y < 12 else 6)) % 12
                if y == 11 or (y > 11 and bx == 0):
                    c = r[1]
                if y == 15:
                    c = r[0]
                if x == 44:
                    c = r[0]
                elif x == 3:
                    c = r[2]
            else:
                left = x <= 15
                course = (y - 16) // 6
                bx = (x + (0 if course % 2 == 0 else 5)) % 10
                c = (r[3] if left else r[2]) if (y - 16) % 6 else (r[1] if left else r[0])
                if bx == 0 and (y - 16) % 6:
                    c = r[1] if left else r[0]
                if (left and x == 15) or (not left and x == 32):
                    c = r[1]                                        # 입구 안쪽 모서리 그늘
                if x == 44 or (left and x == 3 and False):
                    c = r[0]
                if x == 3:
                    c = r[2]
                if left and x <= 5 and (y - 16) % 6 and bx:
                    c = r[4] if x == 4 else c                         # 빛 받는 왼쪽 모서리
            cv.putpixel((x, y), c)
    for x, y in ((8, 24), (9, 25), (9, 26), (38, 30), (37, 31), (21, 5), (22, 6)):   # 금
        cv.putpixel((x, y), r[0] if ins(x, y) else cv.getpixel((x, y)))
    _mound(cv, s, 7.0, 44.0, 8.0, 3.6)
    _mound(cv, s, 41.0, 44.6, 7.0, 3.0)
    return cv


def sandpit(P):
    """개미지옥(2×2, 걸을 수 있다 — 빠지는 이벤트 자리): 모래가 깔때기로 꺼진다. 테두리 1px 밝은 모래 입술, 안쪽 북쪽 비탈은 빛을 받아 밝고
    남쪽 비탈은 그늘, 가운데 진한 구멍. 소용돌이 결 두 줄. 바깥은 사막 모래 바탕(불투명)."""
    s, d = P["sand"], P["deep_sand"]
    cv = px.new(32, 32)
    for y in range(32):
        for x in range(32):
            ex, ey = (x + 0.5 - 16) / 13.0, (y + 0.5 - 16.5) / 10.0
            dd = math.hypot(ex, ey)
            c = sand0(x % T, y % T)
            if dd <= 1.0:
                ang = math.atan2(ey, ex)
                swirl = (ang * 2 + dd * 9) % (2 * math.pi) < 0.7
                if dd > 0.9:
                    c = s[3]                                        # 입술
                elif dd < 0.22:
                    c = d[0] if dd > 0.12 else P["wood"][1]          # 구멍
                elif ey < 0:
                    c = d[2] if dd > 0.6 else d[1]                  # 북쪽 비탈(밝음)
                else:
                    c = d[1] if dd > 0.6 else d[0]                  # 남쪽 비탈(그늘)
                if swirl and 0.3 < dd < 0.85:
                    c = d[0] if ey < 0 else P["wood"][2]
            elif dd <= 1.08 and y > 16:
                c = s[0]                                            # 앞쪽 입술 밑 그늘 한 줄
            cv.putpixel((x, y), c)
    return cv


def dry_bush(P):
    """회전초(1칸, 통행 불가): 가는 가지가 엉킨 성긴 공 — 군데군데 끊긴 짙은 둥근 테(실루엣이 공으로 읽힌다) 안을 휘어 도는 1px 잔가지
    여러 개가 테에서 안으로 말려 들어가며 엉킨다(곧은 가로·세로 줄이 서면 바구니·거미줄로 읽혀서 L6 K2, 가지는 걸음마다 같은 쪽으로 휜다).
    가지 사이로 모래가 비친다(2×2 로 꽉 찬 곳은 한 점 비운다). 빛은 왼쪽 위: 위·왼쪽은 ruin[3], 가운데 ruin[2], 아래·오른쪽 ruin[1],
    테는 위 ruin[2]·옆 ruin[1]·아래 오른쪽 ruin[0](부피). 바깥으로 1px 삐져나온 잔가지 끝 몇 개, 밑에 납작한 반투명 그림자.
    속이 찬 갈색 공은 돌·열매로 읽혀서 쓰지 않는다(L5 K7)."""
    rr = P["ruin"]
    im = px.new()
    r = px.rng("tumble-curl3")
    cx, cy, RX, RY = 7.5, 7.5, 6.2, 5.6
    for y in range(T):                                               # 그림자(공 밑, 납작한 타원)
        for x in range(T):
            if ((x + 0.5 - cx - 1.5) / 5.6) ** 2 + ((y + 0.5 - 13.9) / 1.6) ** 2 <= 1:
                im.putpixel((x, y), (0, 0, 0, 56))
    pts = {}
    def light(x, y):
        return -((x - cx) / RX + (y - cy) / RY)
    for k in range(40):                                              # 끊긴 둥근 테
        if k % 10 == 4:
            continue
        a = 2 * math.pi * k / 40
        pts[(round(cx + math.cos(a) * RX), round(cy + math.sin(a) * RY))] = "ring"
    for i in range(9):                                               # 테에서 안으로 말려 드는 휜 잔가지
        a0 = 2 * math.pi * (i + r.uniform(-0.3, 0.3)) / 9
        x, y = cx + math.cos(a0) * (RX - 0.6), cy + math.sin(a0) * (RY - 0.6)
        head = a0 + math.pi + r.uniform(-0.9, 0.9)                   # 대략 안쪽으로
        turn = r.choice((-1, 1)) * r.uniform(0.28, 0.45)             # 한 쪽으로 계속 휜다(곧은 줄이 안 선다)
        for _ in range(r.randint(6, 10)):
            x += math.cos(head) * 0.9; y += math.sin(head) * 0.9
            head += turn + r.uniform(-0.12, 0.12)
            q = (round(x), round(y))
            if ((q[0] + 0.5 - cx) / RX) ** 2 + ((q[1] + 0.5 - cy) / RY) ** 2 > 0.85:
                break
            pts.setdefault(q, "twig")
    for y in range(T - 1):                                           # 2×2 로 꽉 찬 곳은 한 점 비운다(속이 비친다)
        for x in range(T - 1):
            q = [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)]
            if all(c in pts for c in q):
                for c in q[::-1]:
                    if pts[c] == "twig":
                        del pts[c]
                        break
    for (x, y), kind in pts.items():
        if not (0 <= x < T and 0 <= y < T):
            continue
        l = light(x, y)
        if kind == "ring":
            c = rr[2] if l > 0.6 else rr[1] if l > -0.4 else rr[0]
        else:
            c = rr[3] if l > 0.55 else rr[2] if l > -0.3 else rr[1]
        im.putpixel((x, y), c)
    for (x, y) in ((1, 4), (14, 10), (10, 1), (12, 14), (2, 12)):     # 바깥으로 삐져나온 잔가지 끝
        if im.getpixel((x, y))[3] != 255:
            im.putpixel((x, y), rr[0] if x > 7 or y > 9 else rr[2])
    return im


_BONE = [                       # o 윤곽 · W 바랜 흰 몸 · H 빛 · S 그늘 — 양 끝 둥근 마디 둘씩 + 3px 몸통
    "..oo........oo..",
    ".oHWo......oHWo.",
    ".oWWWooooooWWWo.",
    ".oWHHWWWWWWWWSo.",
    ".oWWSooooooWWSo.",
    ".oSSo......oSSo.",
    "..oo........oo..",
]


def bones(P):
    """마른 뼈(1칸, 걸을 수 있다 — 장식): 모래 위 짐승 뼈 하나 — 곧은 몸통 양 끝에 둥근 마디 두 개씩(뼈 모양 실루엣, 손으로 찍은 _BONE).
    몸은 바랜 흰색(sandbath[4]), 왼쪽 위 빛 snow[6], 아래 마디 그늘 sandbath[2], 둘레는 사암 최암 ruin[0](모래 최암보다 짙어 원 크기에서 형태가 선다),
    밑에 반투명 그림자. 가는 막대 둘은 화살표·나뭇가지로 읽혀서 쓰지 않는다(L6 K3)."""
    sb, rr, sn = P["sandbath"], P["ruin"], P["snow"]
    col = {"o": rr[0], "W": sb[4], "H": sn[6], "S": sb[2]}
    im = px.new()
    y0 = 5
    pts = {(x, y0 + j): ch for j, row in enumerate(_BONE) for x, ch in enumerate(row) if ch != "."}
    for (x, y) in pts:                                                   # 그림자(오른쪽 아래)
        for dx, dy in ((1, 1), (0, 1), (1, 2)):
            q = (x + dx, y + dy)
            if q not in pts and 0 <= q[0] < T and q[1] < T:
                im.putpixel(q, (0, 0, 0, 56))
    for (x, y), ch in pts.items():
        im.putpixel((x, y), col[ch])
    return im

