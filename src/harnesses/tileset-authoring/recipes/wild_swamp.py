"""늪지 — 원작 120번 도로 늪 구역(em Route120, z_r120_swamp)·사파리 북서(em SafariZone_Northwest) 배치도를 그려 잰 장소 문법.

장소 문법(원작에서 잰 것):
- 바닥은 젖은 풀땅. 그 위에 진흙 들판(걷는 땅)이 넓게 퍼지고, 진흙 경계는 흔들리는 둥근 윤곽이다(바깥 모서리 반지름 반 칸,
  4칸 넘는 직선 경계 없음). 한 칸 폭 진흙 목·기둥은 두지 않는다.
- **웅덩이는 크기가 다른 둥근 덩이 하나씩**(2×2~4×3)이다. 칸 오토타일에서 덩이를 이어 붙이면(L 자) 오목 모서리에 윤곽 토막이 남아
  칸 격자로 읽히므로, 한 웅덩이는 한 덩이로 둔다. 둑은 1px 최암 윤곽, 북쪽만 흙 앞면 2px. 물 속은 거의 평면이고 가로 반짝임 2~3개만 있다 — 그물·육각 무늬를 깔면 타일 바닥으로 읽힌다. 2×2 보다 작은 물, 1칸
  물줄기는 두지 않는다.
- 연잎은 웅덩이 속 칸(사방이 물)에만, 부들은 웅덩이 가장자리 물 칸에만(나무 곁 제외) 선다.
- 갈대 덤불(키 큰 풀과 같은 조우 칸)은 덩이로 길목을 막는다. 덩이 맨 윗줄만 이삭이 보이고 속 줄은 이삭이 없다. 줄기 끝 높이가
  흩어져 칸 줄마다 가로 띠가 생기지 않고, 덩이 왼끝·오른끝 칸(reed*_l/_r)은 줄기가 성기게 잦아든다.
- 나무는 2×2 숲벽이 둘레를 막고, 안에는 그루 몇 무리와 **회갈색 마른 나무**가 바닥 칸에 혼자 선다(수관과 겹치지 않는다).

깔기 순서(에디터 조수용): 바닥 swg0~3 → 진흙 mud(오토타일, 속 변형이 칸마다 섞인다) → 웅덩이 swater(둥근 덩이 하나씩) →
그루 swood_<4비트> + 수관 머리 swood_cap0/1 → 갈대 reed0/1(덩이 맨 윗줄)·reedin0/1(속 줄) → 연잎 lily0/1·부들 cattail0/1(위층) →
마른 나무 snag(1×2).
진흙 경계는 4±1px 안쪽에서 바깥 귀는 칸 전체 사분원, 안쪽 귀는 1/4 타원 홈으로 판다 — 한 칸씩 물러나는 경계가 물결로 읽힌다.

타일: swg0~3 젖은 풀땅, mud_at 진흙(오토타일 + 속 변형 4), swater_at 늪 물(4프레임 오토타일 + 속 변형 4), reed0/1·reedin0/1 갈대(조우),
cattail0/1 부들·lily0/1 연잎(위층, 막힘), snag 마른 나무(1×2), swood_0~f 그루 16벌, swood_cap0/1 수관 머리."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T, N, E, S, W, NE, SE, SW, NW  # noqa: E402
import wild_common as wc  # noqa: E402

MUD = ("swamp-mud", 4, -1, 1)         # 경계는 4±1px 안쪽, 바깥 모서리는 칸 전체 사분원(I3 Z6 — 반지름 8·깊이 2 로는 한 칸씩 물러나는 진흙 끝이 칸 계단으로 읽혔다)
SW_SEEDS = px.torus_seeds("swamp-water", 4)


def ground(P, v: int):
    return wc.quiet_floor("swg", P["swamp"], v)


def mud_tex(P, v=0):
    """진흙 바탕: 중간 톤 위에 어두운 젖은 덩이·마른 밝은 덩이가 칸마다 다른 자리에(변형 v). 윤기 점은 덩이 하나에 1~2개만 —
    칸마다 같은 자리에 찍으면 줄자·사다리로 읽힌다(QA1 #23)."""
    md = P["mud"]
    im = px.clumps(f"mud{v}", md[2], [(md[1], 10 + v * 2, 3), (md[3], 7 - v, 3)])
    r = px.rng(f"mud-sheen{v}")
    for _ in range(1 + v % 2):
        x, y = r.randrange(2, T - 3), r.randrange(2, T - 2)
        im.putpixel((x, y), md[4])
    return im


def mud_mask(m):
    """진흙 마스크 = wc.round_patch_mask(MUD) — 바깥 귀 칸 전체 사분원, 안쪽 귀 1/4 타원 홈(I3 Z6)."""
    return wc.round_patch_mask(m, *MUD)


def mud_cell(P, m: int, ground_px, tex_v: int = 0):
    """진흙 오토타일(걷는 땅): 안은 진흙(윤기 점), 경계 안쪽 한 줄은 어두운 진흙, 바깥 풀 한 줄은 젖어 어둡다."""
    md, sw = P["mud"], P["swamp"]
    inside = mud_mask(m)
    tex = mud_tex(P, tex_v)
    h = px.rng("mud-fringe")
    table = [[h.random() for _ in range(T)] for _ in range(T)]
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = px.neighbours4(inside, x, y, m)
            if inside[y][x]:
                c = tex.getpixel((x, y))
                if not all(nb.values()):
                    c = md[1] if table[y][x] < 0.7 else md[0]
                im.putpixel((x, y), c)
            else:
                c = ground_px(x, y)
                if any(nb.values()):
                    c = sw[0] if table[y][x] < 0.65 else c
                im.putpixel((x, y), c)
    return im


def reeds(P, v: int, ground_px, inner: bool = False, side: str = "", below: bool = True):
    """갈대 덤불(조우 칸, 걸을 수 있다): 젖은 풀 위에 가는 잎 줄기가 빽빽이 선다.
    몸통은 세로로 끊김 없이 되풀이되는 무늬(열마다 줄기 끝 자리 위상이 달라, 앞줄 이삭이 칸 안 여기저기서 솟는다)라
    위아래 칸을 이어 깔면 칸 경계에 가로 이음매가 없는 한 덩이가 된다(QA-L3 S2).
    inner = 위 칸도 갈대(위끝까지 몸통 — 이삭 띠가 없다), 아니면 덩이 윗끝: 뒷줄 이삭이 0~6px 로 들쭉날쭉 솟는다.
    below = 아래 칸도 갈대(아래끝까지 몸통), 아니면 덩이 아랫끝: 밑동이 0~4px 로 들쭉날쭉 바닥에 잦아든다(칼로 자른 직선이 아니게).
    side = l/r: 덩이의 왼끝·오른끝 칸 — 그쪽 줄기가 성기고 짧아진다."""
    rd = P["reed"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), ground_px(x, y))
    r = px.rng(f"reeds{v}{side}{inner}{below}")
    ph = px.rng("reed-phase")                                    # 열마다 위상 — 모든 갈대 칸이 같은 값을 써야 위아래가 이어진다
    tips = [ph.randrange(T) for _ in range(T)]
    sv = px.rng(f"reed-shade{v}")
    shade = [sv.choice((1, 2, 2)) for _ in range(T)]                # 변형마다 몸통 명암만 다르다(위상은 같아 이음매가 없다)
    top_edge = [r.randint(0, 6) for _ in range(T)]
    bot_edge = [r.choice((0, 1, 2, 3, 5, 7)) for _ in range(T)]       # 아랫끝 밑동 높이 0~7px — 덩이 아래 끝이 곧은 선이 아니게(QA-L4 S2b)
    for x in range(T):
        fade = (side == "l" and x < 6) or (side == "r" and x > 9)
        if fade and x % 2:
            continue
        t0 = 0 if inner else top_edge[x] + (8 + (6 - x if side == "l" else x - 9) // 2 if fade else 0)
        t1 = T if below else T - bot_edge[x]
        for y in range(t0, t1):
            k = (y - tips[x]) % T                                 # 이 열의 이삭에서 아래로 몇 칸(열마다 이삭 하나)
            c = (rd[3] if x % 2 == 0 else rd[2]) if k == 0 else rd[2] if k <= 4 else (rd[shade[x]] if k <= 9 else rd[1])
            if not inner and y == t0:
                c = rd[3]                                         # 덩이 윗끝 이삭
            if not below and y >= t1 - 2 and (x + y) % 3 == 0:
                c = rd[0]                                         # 덩이 아랫끝 밑동(띄엄띄엄 짙은 잎)
            if x % 4 == 3 and k > 3:
                c = rd[0] if (y + x) % 5 == 0 else rd[1]          # 포기 사이 그늘 틈(세로) — 가로 띠는 없다
            im.putpixel((x, y), c)
    return im


def cattail(P, v: int):
    """부들(투명 바탕, 물가·둑 위 장식, 위층·통행 불가): 키 큰 줄기 셋 끝에 갈색 이삭(2×6, 왼쪽 밝음), 칼 같은 잎 넷,
    밑동마다 물 위 반사 3~4px(반투명 흰). 밑동·반사는 y 11~12 — 물가 칸의 둑 선을 덮지 않는다."""
    rd, tr = P["reed"], P["trunk"]
    im = px.new()
    stems = [(3, 0, 11), (8, 0, 11), (12, 2, 11)] if v == 0 else [(4, 1, 11), (10, 0, 11)]   # 밑동 y 11 — 물가 칸의 아래 둑(13~15줄) 위에서 끝난다(QA-L4 S8)
    for (x0, y0, x1, y1) in ((2, 7, -1, 0), (6, 9, -1, 0), (10, 8, 1, 0), (13, 10, 1, 0)):   # 잎(아래에서 비스듬히)
        for k in range(7):
            px.put(im, x0 + (k // 3) * x1, 11 - k, rd[2] if k > 3 else rd[1])
    for sx, top, bot in stems:
        for y in range(top + 6, bot + 1):
            px.put(im, sx, y, rd[1] if y < bot - 1 else rd[0])
        for y in range(top, top + 6):
            px.put(im, sx, y, tr[2] if top < y < top + 5 else tr[1])
            px.put(im, sx + 1, y, tr[0] if top < y < top + 5 else tr[1])
        px.put(im, sx, top - 1, rd[3])
    for sx, top, bot in stems:                                     # 밑동 물결: 줄기마다 물 위 반사 3px(가로 그늘선이 물을 가로지르지 않게)
        for dx in (-1, 0, 1, 2):
            px.put(im, sx + dx, 12, (255, 255, 255, 70) if dx in (-1, 2) else (255, 255, 255, 40))
    return im


def lily(P, v: int):
    """연잎(투명 바탕, 물 위): 둥근 잎(쐐기 하나 빠짐) — 왼쪽 위 밝음, 오른쪽 아래 최암 윤곽, 잎맥. v=1 은 분홍 꽃 한 송이."""
    lf = P["leaf"]
    pk = P["pink"]
    im = px.new()
    pads = [(7.5, 8.0, 6.6, 0.0)] if v == 0 else [(6.0, 9.5, 5.4, 0.5), (12.0, 4.5, 3.6, 2.2)]
    for cx, cy, r, rot in pads:
        import math
        for y in range(T):
            for x in range(T):
                dx, dy = x + 0.5 - cx, (y + 0.5 - cy) * 1.25
                d = math.hypot(dx, dy)
                if d > r:
                    continue
                a = (math.atan2(dy, dx) - rot) % (2 * math.pi)
                if a < 0.45 and d > 0.8:
                    continue                                 # 쐐기 틈
                light = -(dx + dy) / r
                c = lf[4] if light > 0.6 else lf[3] if light > 0.0 else lf[2]
                if d > r - 1.0:
                    c = lf[0] if (dx + dy) > -1 else lf[1]
                im.putpixel((x, y), c)
    if v == 1:
        for dx, dy, c in ((0, 0, pk[2]), (1, 0, pk[1]), (-1, 0, pk[1]), (0, -1, pk[2]), (0, 1, pk[0]), (1, 1, pk[0])):
            px.put(im, 6 + dx, 9 + dy, c)
        px.put(im, 6, 9, P["gold"][1])
    return im


def snag(P, part: int):
    P = dict(P, trunk=P["snag"])
    """마른 나무(1×2, 투명 바탕, 통행 불가): 잎 없는 굵은 줄기(4px)가 위에서 세 갈래로 갈라지고 끝이 가늘어진다.
    껍질은 줄기 램프 — 왼쪽 밝음·오른쪽 최암, 밑동은 벌어지고 그림자."""
    tr = P["trunk"]
    im = px.new()

    def put(X, Y, c):
        if part * T <= Y < part * T + T:
            px.put(im, X, Y - part * T, c)
    for Y in range(8, 30):
        w = 3 if Y < 18 else 4 if Y < 27 else 6
        x0 = 6 if Y < 27 else 5
        for k in range(w):
            c = tr[3] if k == 0 else tr[2] if k < w - 2 else tr[1] if k < w - 1 else tr[0]
            put(x0 + k, Y, c)
    for (sx, sy, dx, n) in ((6, 12, -1, 6), (8, 9, 1, 6), (7, 8, 0, 6), (9, 17, 1, 4)):
        for k in range(n):
            X, Y = sx + dx * k, sy - (k * 3) // 4 if dx else sy - k
            put(X, Y, tr[2] if k < n - 2 else tr[1]); put(X + (1 if dx <= 0 else 0), Y + 1, tr[0])
    for X in range(3, 14):
        put(X, 30, wc.SHADOW)
        if X % 2:
            put(X, 31, wc.SHADOW)
    for X, Y in ((4, 29), (11, 29), (11, 28), (4, 28)):
        put(X, Y, tr[0])
    return im


def swamp_water(P, m, f, ground_px, masks, glint_set=0):
    """늪 물(4프레임): 탁한 청록 평면 + 띄엄띄엄 가로 반짝임. 둑은 1px 진흙 윤곽 + 북쪽 2px 젖은 흙(앞면). 모서리는 둥글다."""
    w = P["swater"]
    md = P["mud"]
    bank = lambda x, y, north: md[1] if north else md[0]
    return wc.pond(m, f, masks, w, ground_px, bank, md[0], glint_set, lip=md[3])
