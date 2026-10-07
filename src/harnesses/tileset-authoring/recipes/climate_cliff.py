"""기후 벼랑(층진 바위 고원) — 사암 벼랑(111번 도로)·화산 바위 벼랑(용암마을·꽃잎마을)·얼음 벼랑(바다 동굴 얼음방).

원작에서 잰 문법(em Route111 · LavaridgeTown · FallarborTown · ShoalCave_LowTideIceRoom):
- 벼랑은 위에서 본 **윗면**(바닥보다 밝은 한 톤 면, 결 없는 칸과 결 1~3개 칸이 섞인다) + 남쪽으로 드러난 **앞면**.
  **바위 벼랑(사암·화산)은 정본 야생 고원 두 그룹(plateau_set — wild_mountain.cliff_top·face_tile·stairs, 야생 cliffg·gface·gstairs 와 같은 함수)을
  색 인자만 바꿔 부른다**(감독 정본 결정, L6 K5·I1 X1): 윗면 <접두>cliff(북·동·서 덩이 테, 걷는 단) + 남쪽 끝 두 줄 앞면 <접두>face(바위 덩이, 막힘) +
  앞면을 끊은 2×2 돌계단(유일한 오르는 길). 이 파일은 윗면 결(rock_top)만 정한다. 둘째 층도 같은 두 그룹이다.
  눈 벼랑(icecliff 윗면 + iceface 앞면)도 같은 두 그룹을 눈 램프로 부르고 윗면 결만 흰 눈(snow_top), 고드름은 앞면 윗입술 덧칠뿐이다(I2 Y8).
- 111번 도로처럼 벼랑은 **여러 층**(테라스)이다: 아래층 윗면 한 칸 안쪽에서 둘째 층이 다시 앞면을 드러낸다.
- 윗면 가장자리(북·서·동)는 3톤 띠, 빛은 왼쪽 위 — 서쪽 면은 밝고 동쪽 면은 어둡다(좌우 거울 금지).
- 벼랑 위 봉우리·골짜기 막는 바위는 2×2 바위 무더기 `rock_pile`(밑이 가장 넓고 위로 볼록하게 좁아지는 울퉁불퉁한 덩이 + 곁 작은 덩이,
  왼쪽 절반 밝은 면 · 오른쪽 3분의 1 그늘 · 2px 얼룩 결 · 둘레 최암 윤곽, 벼랑 윗면보다 한 단 어둡다, 높이 1.2칸 안쪽)와 낮은 둥근 바위(정본 야생 big_rock 을 사암 램프로, monster_climate 가 부른다).
  곧은 삼각뿔은 피라미드(L1 N4), 곧은 세로 옆구리 + 뾰족 머리는 천막·짚더미(L2 N1)로 읽힌다. 윗면 위에 얹을 때는 2×2 와 그 아래 한 칸이 모두 같은 층 윗면이어야 한다(앞면 칸에 걸치면 앞면 위에 뜬다, L1 N2).

칠하는 법(에디터 조수용):
- 바위 벼랑은 본 시트 바위 고원·야생 절벽과 같은 순서: 윗면 그룹 `dcliff`·`vcliff` 를 칠하고, 그 남쪽 끝 바로 아래 **두 줄**을 앞면 그룹
  `dface`·`vface` 로 칠한다(막힘, 윗면은 앞면을 이웃으로 본다 — connectGroups). 앞면 가운데 칸은 덩이 변형 `<접두>face_atin{0,1}_v` 를
  열 해시로 섞는다(한 열의 윗칸·아랫칸은 같은 번호). 오르는 길은 앞면 두 줄을 끊은 2×2 돌계단 `dstairs_x_y`·`vstairs_x_y` 하나 —
  계단 위 윗면 칸은 남쪽이, 계단 양옆 앞면 칸은 계단 쪽이 이어진 변형으로 바꾼다.
- 둘째 층은 `dcliff2`·`dface2`·`dstairs2`(화산은 v…)를 아래층 윗면 안쪽에 같은 방법으로(아래층 가장자리에서 서·북·동 1칸, 남 2칸 이상 안쪽).
- 눈 벼랑은 같은 순서로 `icecliff`(윗면) + `iceface`(남쪽 끝 두 줄 앞면). 얼음 판을 바로 감싸는 둔덕이라 돌계단이 없다(오를 수 없다).
  윗면은 흰 눈 — 조용한 눈 · 눈 둔덕(청회 반달 그늘) · 바람결 「~」(속 변형) · 드러난 얼음 바위 조각(깊은 속 변형). 넓으면 눈더미(snow_pile)를 위층에 얹는다 — 넓은 빈 흰 판은 탁자처럼 읽힌다(L1 N7).
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402
import wild_mountain as wm  # noqa: E402  (정본: 바위 벼랑 = 야생 산 절벽 함수 cliff_top·face_tile, L6 K5)

def rock_top(w, v: int, seed: str):
    """윗면: 밝은 한 톤(w[3]) + 조용한 밝은 덩이(w[4]) + 변형마다 다른 바위 결(짧은 금·자갈·판 줄눈·혹). 격자 반복을 깨려고 칸마다 결의 자리·모양이 다르다."""
    im = px.clumps(f"{seed}-top{v}", w[3], [(w[4], 3 + v % 3, 2)])    # 밝은 덩이는 2px 이하(3px 덩이는 「T」 글자처럼 칸마다 찍힌다)
    r = px.rng(f"{seed}-grain{v}")
    kind = v % 6
    def crack(pts):
        for (x, y) in pts:
            if 0 <= y < T:
                im.putpixel((x % T, y), w[2])
                if y + 1 < T and im.getpixel((x % T, y + 1))[:3] == w[3][:3]:
                    im.putpixel((x % T, y + 1), w[4])
    x0, y0 = r.randrange(1, 6), r.randrange(3, 12)
    if kind == 0:                                                   # 짧은 가로 금(살짝 꺾인다)
        crack([(x0 + i, y0 + (1 if i > 3 else 0)) for i in range(r.randint(5, 7))])
    elif kind == 1:                                                 # 아무 결 없음(밝은 덩이만)
        pass
    elif kind == 2:                                                 # 긴 물결 금 + 짧은 금(결 둘)
        crack([(x0 + i, y0 + (1 if (i // 3) % 2 else 0)) for i in range(r.randint(8, 10))])
        y1 = (y0 + 6) % 12 + 2
        crack([(x0 + 7 + i, y1 + (1 if i > 1 else 0)) for i in range(4)])
    elif kind == 3:                                                 # 비스듬한 금
        crack([(x0 + i, y0 - 3 + i // 2) for i in range(7)])
    elif kind == 4:                                                 # 끊긴 금 셋(흩어진 자리)
        crack([(x0 + i, y0) for i in range(3)] + [(x0 + 5 + i, y0 + 2) for i in range(4)] + [(x0 + 9 + i, (y0 + 7) % 13 + 1) for i in range(3)])
    else:                                                           # 갈라진 금
        crack([(x0 + i, y0 - (i // 3)) for i in range(6)] + [(x0 + 3 + i, y0 + 1 + i // 2) for i in range(4)])
    return im


def _shade(floor, w):
    """앞면 밑 땅 그림자: 바깥 바닥 색을 최암 쪽으로 반."""
    return lambda x, y: tuple((a + b) // 2 for a, b in zip(floor(x, y)[:3], w[0][:3])) + (255,)


def snow_top(w, ir, v: int, seed: str):
    """눈 벼랑 윗면(눈 덮인 바위 고원): 바탕 눈 w[3] + 밝은 덩이, 변형마다 다른 높이 단서.
    0 = 조용한 눈(덩이만) · 1 = 눈 둔덕 하나(왼쪽 위 흰 빛 + 오른쪽 아래 청회 반달 그늘) · 2 = 눈 밖으로 드러난 얼음 바위 조각(ir 램프)
    · 3 = 바람결 「~」 하나(6px, 칸 경계에 걸친다) · 4 = 작은 둔덕 둘 + 짧은 「~」(4px, 다른 높이) · 5 = 드러난 바위 + 둔덕 · 6·7·8 = 조용한 눈(다른 덩이 자리) · 9 = 작은 둔덕(왼쪽 아래) · 10 = 작은 둔덕(칸 위쪽).
    「~」 는 깊은 속 두 변형에만, 길이·자리를 달리 — 칸마다 같은 표시가 줄지어 격자로 읽히지 않게."""
    im = px.clumps(f"{seed}-stop{v}", w[3], [(w[4], 2, 2)] if v >= 7 else [(w[4], 3 + v % 3, 3)])   # 7·8 = 가장자리용: 작은 덩이 둘(같은 마스크 칸은 같은 그림이라 눈에 띄는 자국을 두지 않는다)
    r = px.rng(f"{seed}-stopf{v}")
    def mound(cx, cy, rx, ry):
        for y in range(T):
            for x in range(T):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                d = dx * dx + dy * dy
                if d > 1.0:
                    sd = ((x + 0.5 - cx - 1.2) / rx) ** 2 + ((y + 0.5 - cy - 1.9) / ry) ** 2
                    if sd <= 1.0 and y + 0.5 > cy:
                        im.putpixel((x % T, y % T), w[2])               # 반달 그늘(오른쪽 아래)
                    continue
                if dx + dy < -0.55:
                    im.putpixel((x % T, y % T), w[4])                   # 빛 받는 왼쪽 위
    def rock(cx, cy, big):                                          # 눈 밖으로 드러난 얼음 바위(3/4: 위 2줄 윗면 + 아래 앞면), 위는 눈 입술, 밑은 눈 그늘
        wd, ht = (8, 7) if big else (6, 6)
        sp = {(dx, dy) for dy in range(ht) for dx in range(wd) if not ((dy in (0, ht - 1)) and dx in (0, wd - 1))}
        for dx, dy in sp:
            for ox, oy in ((1, 1), (1, 0), (0, 1)):
                if (dx + ox, dy + oy) not in sp:
                    im.putpixel(((cx + dx + ox) % T, (cy + dy + oy) % T), w[2])
        for dx, dy in sp:
            right, bottom = (dx + 1, dy) not in sp, (dx, dy + 1) not in sp
            left, top = (dx - 1, dy) not in sp, (dx, dy - 1) not in sp
            if right or bottom:
                c = ir[0]
            elif dy <= 2:                                           # 윗면(밝은 얼음)
                c = w[4] if top else ir[3] if dx < wd * 0.6 else ir[2]
            elif left:
                c = ir[1]
            else:                                                   # 앞면: 왼쪽은 한 단 밝고 오른쪽은 그늘, 가운데 금 하나
                c = ir[2] if dx < wd * 0.45 else ir[1]
                if dx == wd // 2 and dy == 4:
                    c = ir[0]
            im.putpixel(((cx + dx) % T, (cy + dy) % T), c)
    def wind(x0, y0, n):                                            # 바람결 「~」(n px, 두 점마다 한 줄 오르내림)
        for i in range(n):
            x, y = (x0 + i) % T, y0 + (1 if (i // 2) % 2 else 0)
            im.putpixel((x, y), w[2]); im.putpixel((x, y + 1), w[4])
    if v == 1:
        mound(r.uniform(5, 11), r.uniform(4, 11), 4.8, 2.8)
    elif v == 2:
        rock(r.randrange(2, 7), r.randrange(2, 7), True)
    elif v == 3:
        wind(r.randrange(10, 14), r.randrange(4, 12), 6)
    elif v == 4:                                                    # 둔덕 둘 사이 짧은 「~」 — 변형 3 과 길이·높이가 다르다(같은 자국이 줄지어 서지 않게, L5 K2)
        mound(4.5, 5.0, 3.2, 2.0); mound(11.0, 11.0, 3.6, 2.2)
        wind(2, 11, 4)
    elif v == 5:
        rock(r.randrange(7, 9), r.randrange(7, 9), False); mound(4.5, 4.0, 3.6, 2.3)
    elif v == 9:                                                    # 작은 둔덕(변형 1 과 자리·크기가 다르다 — 얕은 속 칸이 같은 자국으로 줄짓지 않게, L5 K2)
        mound(3.5, 11.5, 3.4, 2.0)
    elif v == 10:                                                   # 칸 위쪽 작은 둔덕(얕은 속 셋 중 자국 있는 하나 — 고원 한 줄에서 자국 높이가 칸 아래 줄과 엇갈린다, L6 K1)
        mound(10.5, 3.2, 3.2, 1.8)
    return im


def plateau_set(w, floor, top: str, face: str, seed: str, top_seed: str | None = None, stairs: str | None = None, top_fn=None, face_fn=None, shade=None) -> dict:
    """정본 바위 고원 두 그룹(야생 cliffg_at·gface_at·gstairs 와 같은 함수, 색 인자만 — 감독 정본 결정·통합 검수 I1 X1).
    윗면 <top>_at<m> = wm.cliff_top 47(북·동·서 덩이 테 · 둥근 바깥 모서리, 남쪽은 앞면 그룹이 이어 받는다) + 속 결 <top>_atin0_v·atin1_v,
    앞면 <face>_at<m> = wm.face_tile 47(두 줄 — 윗칸 ROW_T·아랫칸 ROW_B) + 덩이 변형 <face>_atin{0,1}_v(wm.FACE_VARS 벌, 쇼케이스가 열 해시로 섞는다),
    돌계단 <stairs>_x_y = wm.stairs 2×2(앞면 두 줄을 끊고 들어선다). 윗면 결(rock_top)만 이 파일 것이다.
    top_fn(v) 를 주면 윗면 결을 그것으로(눈 고원 = snow_top — 가장자리 7·8, 속 6·10·0 / 4·5·9),
    face_fn(name, m, im) 을 주면 앞면 칸마다 위 덧칠만 한다(눈 벼랑 고드름 — 모양은 정본 그대로, I2 Y8). shade 는 테 밑·앞면 밑 그늘 색(기본 = 바닥을 최암 쪽으로 반).
    띠 끝 둥근 어깨·발끝 <face>_rnd<m> 10칸 = 정본 wm.round_face_set(face_tile 과 같은 인자, 감독 결정 I4 W3) — 앞면 칸 뒤에 이어 굽는다."""
    ts = top_seed or seed
    Pw = {"cliff": w}
    sh_ = shade or _shade(floor, w)
    tex = lambda im: (lambda x, y: im.getpixel((x % T, y % T)))
    edge_tops = [top_fn(v) for v in (7, 8, 7)] if top_fn else [rock_top(w, 1 + 6 * i, ts) for i in range(3)]
    out = {}
    for k in px.ALL47:
        out[f"{top}_at{k}"] = wm.cliff_top(Pw, k, tex(edge_tops[(k * 7) % 3]), floor, sh_)
    inner = [top_fn(v) for v in (6, 10, 0, 4, 5, 9)] if top_fn else [rock_top(w, v, ts) for v in (1, 7, 13, 2, 4, 0)]          # 얕은 속은 결 없음 셋(L2 N10), 깊은 속은 결 1~3개
    for v in range(3):
        out[f"{top}_atin0_{v}"] = wm.cliff_top(Pw, 255, tex(inner[v]), floor, sh_)
        out[f"{top}_atin1_{v}"] = wm.cliff_top(Pw, 255, tex(inner[3 + v]), floor, sh_)
    t0 = tex(edge_tops[0])
    for k in px.ALL47:
        out[f"{face}_at{k}"] = wm.face_tile(Pw, k, t0, floor, sh_)
    for tier, mm in ((0, wm.ROW_T), (1, wm.ROW_B)):
        for v in range(wm.FACE_VARS):
            out[f"{face}_atin{tier}_{v}"] = wm.face_tile(Pw, mm, t0, floor, sh_, v + 1)
    rnd = wm.round_face_set(Pw, face, t0, floor, sh_)                # 띠 끝 둥근 어깨·발끝 <face>_rnd<m>(정본 — 감독 결정 I4 W3, 쇼케이스는 wild_round.roundFace)
    out.update(rnd)
    if face_fn:
        for k in px.ALL47:
            face_fn(f"{face}_at{k}", k, out[f"{face}_at{k}"])
        for v in range(wm.FACE_VARS):
            face_fn(f"{face}_atin0_{v}", wm.ROW_T, out[f"{face}_atin0_{v}"])
        for name in rnd:
            face_fn(name, int(name.rsplit("_rnd", 1)[1]), out[name])
    if stairs:
        for y in range(2):
            for x in range(2):
                out[f"{stairs}_{x}_{y}"] = wm.stairs(Pw, x, y, t0, floor, 2)
    return out


def top_table(w, seed: str) -> dict:
    """둘째 층의 바깥 바닥 = 아래층 윗면(변형 0)."""
    im = rock_top(w, 1, seed)
    return {(x, y): im.getpixel((x, y)) for y in range(T) for x in range(T)}


# ---- 바위 무더기(2×2, 111번 도로 바위 문법을 한 덩이 + 곁 덩이로) ---------------------------------------
_PILES = {
    # (cx, 밑변 y, 반폭, 높이) — 뒤 덩이부터. 앞 덩이가 뒤 덩이를 윤곽째 덮는다.
    "a": [(15.5, 28.0, 10.0, 19.0), (25.0, 29.5, 4.6, 8.0)],
    "b": [(17.5, 28.0, 9.0, 17.0), (7.5, 29.0, 5.4, 10.0)],
}


def rock_pile(w, seed: str, kind: str = "a", shadow=True):
    """2×2 바위 무더기(키 큰 바위): 밑이 가장 넓고 위로 갈수록 볼록하게 좁아지는 울퉁불퉁한 덩이(옆구리가 곧은 세로선이 아니다) +
    곁 작은 덩이 하나. 덩이마다 왼쪽 절반 밝은 면(w[3], 머리 곁 w[4]) · 가운데 몸(w[2]) · 오른쪽 3분의 1 그늘(w[1]),
    2px 얼룩 결(한 단 어두운 점무리), 둘레 최암 윤곽, 오른쪽 아래로 비낀 반투명 그림자. 높이는 1.2칸 안쪽(19px).
    kind a = 큰 덩이 오른쪽에 작은 덩이, b = 왼쪽에 작은 덩이 — 같은 그림이 줄지어 반복되지 않게 섞어 놓는다."""
    cv = px.new(32, 32)
    lumps = _PILES[kind]
    rnd = px.rng(f"pile-{seed}-{kind}")
    phs = [rnd.uniform(0, 6.28) for _ in lumps]
    def half(i, yf):
        cx, base, rx, h = lumps[i]
        t = (base - yf) / h
        if t < 0 or t > 1:
            return -1.0
        hh = rx * (1 - t) ** 0.36 * (1 - 0.18 * t) * (1 + 0.08 * math.sin(yf * 0.9 + phs[i]) + 0.05 * math.sin(yf * 2.1 + 2 * phs[i]))
        if t < 0.08:
            hh *= 0.93 + t                                          # 밑 모서리를 살짝 둥글게(땅에 앉는다)
        return hh
    def ins(i, x, y):
        if not (0 <= x < 32 and 0 <= y < 32):
            return False
        h = half(i, y + 0.5)
        return h >= 0 and abs(x + 0.5 - lumps[i][0]) <= h
    def any_in(x, y):
        return any(ins(i, x, y) for i in range(len(lumps)))
    if shadow:
        for y in range(32):
            for x in range(32):
                if any_in(x, y):
                    continue
                if any(ins(i, x - 2, y - 2) for i in range(len(lumps))) and y >= 22:
                    cv.putpixel((x, y), (0, 0, 0, 64))
    for i, (cx, base, rx, h) in enumerate(lumps):
        for y in range(32):
            for x in range(32):
                if not ins(i, x, y):
                    continue
                hh = max(1.0, half(i, y + 0.5))
                u = (x + 0.5 - cx) / hh
                t = (base - (y + 0.5)) / h
                if u < -0.05:
                    c = w[3]
                    if t > 0.62 and u < -0.15:
                        c = w[4]
                elif u < 0.38:
                    c = w[2]
                else:
                    c = w[1]
                n = ((x // 2) * 73 + (y // 2) * 151 + i * 37 + len(seed)) % 11          # 2px 얼룩 결
                if n in (0, 4) and c != w[4]:
                    c = w[max(0, w.index(c) - 1)]
                edge = any(not ins(i, x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge:
                    c = w[0]
                cv.putpixel((x, y), c)
    return cv                                                       # 발치 부스러기는 넣지 않는다(떠 있는 1~2px 잡음점으로 읽혔다, L3 N3)
