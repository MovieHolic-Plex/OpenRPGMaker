"""강과 다리 — 원작 119번 도로(em Route119, z_r119_fall)·120번 도로·123번 도로 강가를 그려 잰 장소 문법.

장소 문법(원작에서 잰 것):
- 강은 풀밭 사이를 3~5칸 폭으로 굽이쳐 흐르고, 폭이 한두 칸씩 바뀐다. 둑은 본 시트 마을 연못과 같은 **주황 바위 혹 테두리**(5~6px).
  물 속은 평평하고 반짝임만 띄엄띄엄 있다.
- 단이 바뀌는 자리는 절벽 앞면이 강을 가로지르고, 윗단을 흐르는 물도 같은 바위 둑을 두르고 3~4칸 폭으로 굽는다. **폭포는 앞면 두 줄 자리**에
  들어서고, 위 끝이 절벽 끝선과 같은 높이에서 밝은 굽이 띠로 시작해 세로 흐름 줄(3톤)로 떨어지고, 아래 칸 밑에서 흰 물보라로 끓는다.
  폭포 양옆은 앞면 바위가 감싼다.
- 폭포 밑 좁은 물은 물살 칸(흐름 방향의 긴 물결선, 서핑 중 떠밀림 — slideTiles).
- 강을 건너는 길은 **긴 통나무 다리 하나**(2칸 폭). 다리 양 끝은 둑 위 흙 받침 + 말뚝, 난간은 나무 가로대(밝은 나무 + 그늘 2px)이고 두 칸마다 짧은 기둥. 다리를 지우면 건너편에 못 간다.
- 물바위는 물 속 칸(사방이 물)에만, 땅 바위는 풀밭에. 샛강은 맵 끝에서 들어와 둥근 웅덩이를 지나 굽어 본류에 합류하고(곧은 2칸 수로가 아니다), 세로 다리로 건넌다.
- 나무는 강가에 외톨이 그루로 떨어져 서고, 풀 덩이 안에 심지 않는다.

깔기 순서(에디터 조수용): 바닥 grass0~3 → 윗단 cliff_g·앞면 gface(산과 같은 문법, 변형 gface_atin*) → 강물 rwater(오토타일,
gface 를 이웃으로 본다 — 앞면 밑 물은 둑이 없다, 윗단 협곡 물은 둑이 있다) → 폭포 wfall_t(앞면 윗줄)/wfall_b(앞면 아랫줄), 폭포 위아래 물 칸은 폭포 쪽으로
이어지게 → 물살 cur_d/u/l/r → 계단 gstairs(2×2) → 다리 logbr_h_n/s(+_w/_e 끝)·logbr_v_w/e(+_n/_s 끝) → 물바위 rrock(위층) →
풀 덩이(둘레 이웃 칸 위층에 본 시트 잎끝 tall_fringe_s/e/w)·외톨이 그루·들꽃(본 시트 flower_pink/white/yellow/red) →
마감: 앞면 띠 끝·사선 계단의 열린 끝은 gface_rnd<마스크>(산과 같은 둥근 어깨·발끝, I4 W3), 풀 덩이 귀·잎끝은 wild_tall 둥근 귀 한 벌.

타일: rwater_at 강물(4프레임, 마을 연못과 같은 둑·물결), wfall_t/b 폭포(4프레임), wfoot0~2 폭포 발치 물보라(4프레임, 세 칸이 한 무늬), cur_d/u/l/r 물살(4프레임, cur_d1·cur_d2 물결선 변형),
logbr_* 통나무 다리와 끝 받침(logbr_h_np·sp/v_wp·ep = 난간 기둥 칸, 두 칸마다),
rrock0/1 물바위. 풀밭 들꽃은 본 시트 flower_* 를 그대로 쓴다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import wild_common as wc  # noqa: E402

RW_SEEDS = px.torus_seeds("river-water", 5)


def river_water(P, m, f):
    """강물(4프레임) = 본 시트 마을 연못(monster_overworld.water_bank)과 같은 칸 — 주황 바위 혹 둑(6px)·그물 물결·물가 빛 한 줄.
    강과 연못이 같은 재료로 읽힌다(둑 두께·물 질감이 같다)."""
    import monster_overworld as mo
    return mo.water_bank(P, m, f)


CURRENT_LANES = [[(4, 11, 0), (11, 7, 9)], [(3, 8, 5), (10, 12, 2)], [(6, 10, 11), (13, 6, 4)]]


def current(P, d: str, f: int, v: int = 0):
    """물살 칸(4프레임, 서핑 중 떠밀림): 강물과 같은 그물 물결 바탕 위에 흐름 방향으로 긴 물결선 두 줄이 프레임마다 4px 씩 흐른다.
    머리(흐르는 쪽 끝)는 흰 거품, 꼬리는 물빛. d = u d l r, v = 물결선 자리 변형 3벌(물살 칸이 2칸 주기로 반복되지 않게)."""
    import monster_overworld as mo
    w = P["water"]
    foam = P["foam"]
    im = px.new()
    lanes = CURRENT_LANES[v % 3]
    for y in range(T):
        for x in range(T):
            a, b = {"d": (y, x), "u": (T - 1 - y, x), "r": (x, y), "l": (T - 1 - x, y)}[d]
            c = mo.water_px(P, x, y, f)
            for lb, ln, ph0 in lanes:
                if abs(b - lb) > 1:
                    continue
                k = (a - 4 * f - ph0) % T                          # 0 = 머리
                head = (ln - 1) - k                                # 머리부터의 거리(아래로 흐르면 머리가 아래)
                if 0 <= head < ln:
                    if b == lb:
                        c = foam[1] if head == 0 else foam[0] if head <= 2 else w[3]
                    elif head <= 2:
                        c = w[2]
            im.putpixel((x, y), c)
    return im


def waterfall(P, part: str, f: int):
    """폭포(4프레임, 통행 불가, 앞면 두 줄 자리). 원작 119번처럼 세로 흐름 줄(밝음·중간·짙음 3톤 띠, 폭 2~3px)이
    프레임마다 4px 씩 내려간다. t = 위 칸: 맨 위 2px 는 윗강 물이 절벽 끝에서 굽어 넘어가는 밝은 띠.
    b = 아래 칸: 아래 6px 는 떨어진 물이 끓는 흰 물보라. 양 끝 1px 는 짙은 물(앞면 덩이와 경계)."""
    w = P["water"]
    foam = P["foam"]
    im = px.new()
    cols = [3, 2, 1, 2, 3, 3, 2, 1, 1, 2, 3, 2, 2, 1, 2, 3]       # 열마다 띠 톤(3 밝음 … 1 짙음)
    brk = [5, 9, 3, 12, 7, 1, 10, 6, 2, 13, 8, 4, 11, 0, 9, 5]     # 열마다 흐름 끊김 위상
    for y in range(T):
        for x in range(T):
            Y = y + (T if part == "b" else 0)
            ph = (Y - 4 * f + brk[x]) % 12
            tone = cols[x]
            if ph == 0:
                tone = min(3, tone + 1)
            elif ph in (6, 7):
                tone = max(1, tone - 1)
            c = {1: w[1], 2: w[2], 3: w[3]}[tone]
            if tone == 3 and ph in (1, 2):
                c = foam[0]
            if x in (0, T - 1):
                c = w[0]
            if part == "t" and y <= 1:
                c = w[1] if y == 0 else foam[0]
            if part == "t" and y == 2:
                c = w[3]
            if part == "b" and y >= 9:
                # 물보라: 프레임마다 자리를 바꾸는 둥근 거품 덩이(가운데 흰색 → 둘레 물빛)
                dmin = 99.0
                for i in range(7):
                    bx = (i * 5 + 2 + f * 3 + (i % 2) * 2) % T
                    by = 11.5 + ((i * 3 + f) % 4)
                    dd = min(abs(x - bx), T - abs(x - bx)) ** 2 + ((y - by) * 1.4) ** 2
                    dmin = min(dmin, dd)
                c = foam[1] if dmin < 4.5 else foam[0] if dmin < 9 else w[3] if y < 14 else w[2]
                if y == 9:
                    c = foam[0] if x % 3 else foam[1]
            im.putpixel((x, y), c)
    return im


def fall_foot(P, i: int, f: int, n: int = 3):
    """폭포 발치 웅덩이(4프레임, 통행 불가 물): 폭포 아래 칸(n 칸 폭 중 i 번째)에 떨어진 물이 끓다 퍼지는 물보라.
    위쪽 4px 는 폭포 물보라에 이어지는 흰 거품 띠(아래 테가 물결처럼 들쭉날쭉), 그 밑 8px 는 거품 덩이가 점점 성기게
    흩어지고 덩이마다 물빛 고리를 두른다. 세 칸을 이어 한 무늬로 그려(전역 X = 16·i + x) 칸 경계가 보이지 않는다."""
    import monster_overworld as mo
    w, foam = P["water"], P["foam"]
    im = px.new()
    W = T * n
    r = px.rng(f"fall-foot{f}")
    import math
    edge_y = [min(int((min(X, W - 1 - X) + 1) * 0.7),
                  3 + int(1.6 * (1 + math.sin((X + f * 3) * 0.55)) + r.random() * 1.2)) for X in range(W)]   # 양 끝은 낮게 줄어든다
    speck = [[r.random() < 0.12 for _ in range(W)] for _ in range(T)]
    blobs = []
    for _ in range(26):
        by = r.uniform(3, 13)
        blobs.append((r.uniform(0, W), by, max(0.7, 2.2 - (by - 3) * 0.17)))
    for y in range(T):
        for x in range(T):
            X = i * T + x
            c = mo.water_px(P, x, y, f)
            if y < edge_y[X]:
                c = foam[0] if speck[y][X] else foam[1]
            elif y == edge_y[X]:
                c = foam[0]
            else:
                for bx, by, br in blobs:
                    br *= min(1.0, (min(bx, W - 1 - bx) + 0.5) / 6)   # 양 끝으로 갈수록 덩이가 작다
                    d = ((X - bx) ** 2 + ((y - by) * 1.3) ** 2) ** 0.5
                    if d < br * 0.6:
                        c = foam[1]
                        break
                    if d < br:
                        c = foam[0]
                        break
                    if abs(d - br - 1.2) < 0.55:
                        c = w[3]
            im.putpixel((x, y), c)
    return im


def log_bridge(P, orient: str, part: str, post: bool = False):
    """통나무 다리(불투명, 걸을 수 있다, 물 칸을 덮어 1층에 깐다).
    orient h(동서로 건넌다): 통나무가 세로로 서고 2칸 폭. part n(위 줄: 위 테 최암·밝은 끝) s(아래 줄: 아래 테 최암·그늘) 1(한 줄).
    orient v(남북으로 건넌다): 통나무가 가로로 눕고 part w e 1.
    난간은 나무: 가로대 한 줄(밝은 나무 위 · 그늘 아래, 2px) — 줄이나 쇠가 아니다. post 칸은 가로대를 받치는 짧은 기둥(3px, 두 칸마다 하나)."""
    tr = P["trunk"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            a, b = (x, y) if orient == "h" else (y, x)          # a = 통나무가 늘어선 축, b = 통나무 길이 축
            u = a % 4
            c = tr[3] if u == 0 else tr[2] if u == 1 else tr[1] if u == 2 else tr[0]
            if u in (1, 2) and (b + a * 3) % 11 == 0:
                c = tr[1] if u == 1 else tr[0]
            lo_end = part in ("n", "w", "1")
            hi_end = part in ("s", "e", "1")
            if lo_end and b == 0:
                c = tr[0]
            elif lo_end and b == 1:
                c = tr[3] if u < 2 else tr[2]                   # 통나무 끝 밝은 면
            if hi_end and b == T - 1:
                c = tr[0]
            elif hi_end and b == T - 2:
                c = tr[1] if u < 2 else tr[0]
            # 나무 가로대(2px): 위 밝은 나무, 아래 그늘
            for on, b0 in ((lo_end, 3), (hi_end, T - 5)):
                if on and b == b0:
                    c = tr[3]
                elif on and b == b0 + 1:
                    c = tr[1] if (a + b) % 5 else tr[0]
                elif on and b == b0 + 2 and orient == "h":
                    c = tr[0] if u != 0 else c                     # 가로대 밑 그림자 한 줄(통나무 위)
            if post:
                for on, b0 in ((lo_end, 3), (hi_end, T - 5)):
                    if on and 6 <= a <= 8 and b0 - 2 <= b <= b0 + 2:
                        c = tr[3] if a == 6 else tr[2] if a == 7 else tr[0]
                        if b == b0 - 2:
                            c = tr[3]
            im.putpixel((x, y), c)
    return im


def bridge_end(P, orient: str, part: str, side: str, ground_px):
    """다리 끝(둑 위에 놓는 칸): 바깥 반쪽은 흙 받침(둑 흙), 안쪽 반쪽은 통나무. 난간 쪽 모서리에 말뚝(5×7, 위 밝음).
    orient h: side w(서쪽 끝)·e(동쪽 끝), part n·s. orient v: side n·s, part w·e."""
    tr, sd = P["trunk"], P["sand"]
    base = log_bridge(P, orient, part)
    im = px.new()
    for y in range(T):
        for x in range(T):
            a, b = (x, y) if orient == "h" else (y, x)
            outer = (a < 7) if side in ("w", "n") else (a > 8)
            if outer:
                c = sd[1] if (x * 3 + y * 5) % 7 else sd[0]
                if (side in ("w", "n") and a == 6) or (side in ("e", "s") and a == 9):
                    c = tr[0]
            else:
                c = base.getpixel((x, y))
            im.putpixel((x, y), c)
    lo = part in ("n", "w")
    pa = 3 if side in ("w", "n") else 9                             # 말뚝 자리(a 축)
    pb = 1 if lo else T - 9                                         # 난간 쪽(b 축)
    for da in range(5):
        for db in range(8):
            c = tr[3] if db <= 1 else tr[2] if da <= 1 else tr[1] if da <= 3 else tr[0]
            if db == 7:
                c = tr[0]
            X, Y = (pa + da, pb + db) if orient == "h" else (pb + db, pa + da)
            if 0 <= X < T and 0 <= Y < T:
                im.putpixel((X, Y), c)
    return im


def river_rock(P, v: int):
    """강 바위(투명 바탕, 물 위, 통행 불가): 젖은 바위 덩이 + 물에 닿는 자리 흰 물결 띠."""
    rk, foam = P["rock"], P["foam"]
    im = px.new()
    sh = [[(8, 8, 5.6), (5, 10, 3.6), (11.5, 10, 3.6)], [(7, 9, 4.6), (11, 9.5, 3.4)]][v]
    inside = wc.lobes(sh)
    for y in range(T):
        for x in range(T):
            if not inside(x, y) and (inside(x, y - 1) or inside(x, y - 2)) and y >= 10:
                im.putpixel((x, y), foam[0] if (x + y) % 3 else foam[1])
    wc.shade_obj(im, inside, rk[3], rk[2], rk[1], rk[0], 7, 7, 6, rk[4])
    return im
