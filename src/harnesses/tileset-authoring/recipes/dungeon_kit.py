"""던전 시트 공용 도구 — 동굴 벽 재색 한 벌, 패인 웅덩이(용암·물), 올린 칸막이 2차, 벽 붙박이(사다리·굴 입구), 바닥 구멍·출구 빛, 대각 결 바닥.

여섯 장소가 함께 쓰는 문법(원작 렌더를 눈으로 읽은 것):
- 웅덩이는 바닥보다 **낮다**: 북쪽 변만 둑 앞면(물 바로 위가 가장 어두운 3px + 밝은 윗선 1px), 남·동·서는 1px 선 하나.
  네 변을 같은 두께 돌 띠로 두르면 화단·쿠키 틀로 읽혔다(QA1-11·41). 그룹 kind "water", 속 변형 `<p>_atin<단>_<v>_f<프레임>` 으로
  용암 기포가 2~3칸에 하나꼴. 다른 그룹(껍질 다리)을 connectGroups 로 이어진 이웃 취급하면 그 곁에 둑을 그리지 않는다.
- 올린 칸막이는 **윗면이 칸 대부분**, 남쪽이 빈 칸만 아래 face_h px 앞면, 열린 변 1px 바닥 여백·남·동 1px 그늘 — 높이 있는 상자.
  두 줄 이상 두께로 깔면 앞 줄이 앞면을 맡는다(유적 돌담). 칸막이 오른쪽 바닥은 6px 직사각 그늘 칸을 따로 둔다.
- 사다리·굴 입구는 벽 앞면 칸의 **위층 덧그림**: 벽을 그대로 칠하고 그 칸 위층에 얹으면 3층 통행 O 가 벽의 X 를 덮는다.
  내려가는 사다리는 바닥 칸의 검은 구멍, 맵 아래 출구는 아래 벽 틈 바닥 칸의 밝은 반원.
- 동굴 바닥 결은 대각(↘) 잔결 + 2px 자갈 — 가로 획은 마루·아스팔트로 읽혔다(QA1-14·40).
본 시트 그리기 함수(cave·gym2·interior2·monster_overworld)를 **읽고 import 만** 한다. 램프만 바꾼 P 를 넘겨 같은 화풍의 다른 재료를 얻는다.
cave 의 모듈 상태(_FLOOR·_TOP)는 벌마다 다시 채운다 — _TOP 은 변형 번호로만 캐시하므로 재색 전에 비워야 한다."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402
import cave  # noqa: E402
import gym2 as g2  # noqa: E402
import interior2 as i2  # noqa: E402
import monster_overworld as mo  # noqa: E402

SHADOW = (0, 0, 0, 64)
KEY_FLOOR = (255, 0, 255, 255)      # 투명으로 들어 올릴 바닥 표지색
KEY_SH0 = (254, 1, 254, 255)        # 바닥 그늘 표지(진함)
KEY_SH1 = (253, 2, 253, 255)        # 바닥 그늘 표지(옅음)


def recolor(P, **ramps):
    """램프만 바꾼 P. 값은 P 의 키 이름(문자열) 또는 색 목록."""
    out = dict(P)
    for k, v in ramps.items():
        out[k] = P[v] if isinstance(v, str) else v
    return out


def set_floor(img):
    cave._FLOOR.clear()
    for y in range(T):
        for x in range(T):
            cave._FLOOR[(x, y)] = img.getpixel((x, y))


def over_floor(img, floor_img):
    """정본 함수가 바닥까지 그린 칸 → 바닥과 같은 화소만 투명으로 뺀 덧그림(위층). 정본 화소는 그대로 둔다."""
    out = img.convert("RGBA").copy()
    for y in range(T):
        for x in range(T):
            if out.getpixel((x, y))[:3] == floor_img.getpixel((x, y))[:3]:
                out.putpixel((x, y), (0, 0, 0, 0))
    return out


def on_floor(img, ref_floor, floor_img):
    """정본 칸(정본 바닥 ref_floor 위에 그린 장치)을 다른 바닥 floor_img 로 옮긴다 — ref 와 다른 화소(장치)만 얹는다."""
    out = floor_img.copy()
    for y in range(T):
        for x in range(T):
            c = img.getpixel((x, y))
            if c[:3] != ref_floor.getpixel((x, y))[:3]:
                out.putpixel((x, y), c)
    return out


def smash_rock(P, floor_img, floor_ramp: str):
    """깨는 바위(바위깨기) — 정본 본 시트 `cave.smash_rock`(갈색 각진 바위 + X 금) 을 그대로 부르고, 바닥만 그 동굴 바닥으로(통합 검수 I1 X3).
    바위 색은 본 시트 그대로다(「주황 X = 깬다」를 시트마다 같은 그림으로 배운다). 위층 덧그림으로 돌려준다(밑 그림자 1px 은 남는다)."""
    saved = dict(cave._FLOOR)
    set_floor(floor_img)
    im = cave.smash_rock(dict(P, cave_floor=list(P[floor_ramp])))
    cave._FLOOR.clear(); cave._FLOOR.update(saved)
    return over_floor(im, floor_img)


def lifted(fn, P, wall_key):
    """cave 의 바닥에 박힌 소품(바위·석순·사다리)을 투명 바탕으로 들어 올린다: 표지색 바닥 위에 그리고 표지색은 지우고 바닥 그늘 표지는 반투명 그림자로."""
    saved = dict(cave._FLOOR)
    cave._FLOOR.clear()
    for y in range(T):
        for x in range(T):
            cave._FLOOR[(x, y)] = KEY_FLOOR
    Pc = recolor(P, cave_wall=wall_key, cave_floor=[KEY_SH0, KEY_SH1, KEY_FLOOR, KEY_FLOOR, KEY_FLOOR])
    im = fn(Pc)
    cave._FLOOR.clear(); cave._FLOOR.update(saved)
    out = px.new()
    for y in range(T):
        for x in range(T):
            c = im.getpixel((x, y))
            if c == KEY_FLOOR or c[3] == 0:
                continue
            out.putpixel((x, y), SHADOW if c in (KEY_SH0, KEY_SH1) else c)
    return out


def floor_shadow(img, ramp_dark):
    """벽 앞면 밑 바닥 칸: 앞면 맨 아랫줄(최암 윤곽)이 닿는 첫 줄만 한 단 어둡게 — cave.floor_shadow 와 같은 문법."""
    im = img.copy()
    for x in range(T):
        im.putpixel((x, 0), ramp_dark)
    return im


def cave_walls(sh, P, pre: str, wall_key: str, floor_img, ramp):
    """동굴 벽 한 벌 — 정본 본 시트 `cave.granite_wall`(바위 덩이 앞면 · 덩이 옆면 · 바닥보다 어두운 잔돌 윗면)을 색만 바꿔 부른다
    (REGIONS 2-1 「동굴 벽(모든 동굴) = cave.granite_wall」, 통합 검수 I1 X1 — 옛 cave.wall_cell 의 알약 반복 앞면을 버렸다).
    ramp = 그 동굴 바닥 계열 5톤(본 시트 cave_floor 자리: 윗면 바탕 f0 · 잔돌 f1·f2 · 테 f2 · 빛 f3), wall_key = 맵 밖 어둠 색만.
    만드는 칸: <pre>_void · <pre>_wall_oc{38,76,19,137} · <pre>_wall_at{47} · <pre>_wall_face{1,2}(곧은 앞면 at155 덩이 변형, 본 시트 cave_wall_face1/2 와 같은 방식)
    · <pre>_wall_mid{0..2} · <pre>_wall_deep{0..2} · <pre>_wall_top110_{1,2} · <pre>_wall_side55_{1,2} · <pre>_wall_side205_{1,2}
    (곧은 변 윗면 잔돌 배치 교대 칸 — 본 시트와 같은 변형 묶음, 쇼케이스가 칸 해시로 섞는다).
    cave._GTOP 은 변형 번호로만 캐시하므로 색이 바뀔 때마다 비운다(본 시트 캐시도 남기지 않는다)."""
    Pc = recolor(P, cave_wall=wall_key)
    Pc["cave_floor"] = _ramp(P, ramp)
    set_floor(floor_img)
    cave._GTOP.clear()
    sh.add(f"{pre}_void", cave.void_tile(Pc))
    for k in (38, 76, 19, 137):
        sh.add(f"{pre}_wall_oc{k}", cave.granite_wall(Pc, k, outside_void=True))
    sh.row_start()
    for k in px.ALL47:
        sh.add(f"{pre}_wall_at{k}", cave.granite_wall(Pc, k))
    for v in (1, 2):
        sh.add(f"{pre}_wall_face{v}", cave.granite_wall(Pc, 155, face_v=v))
    sh.row_start()
    for v in range(3):
        sh.add(f"{pre}_wall_mid{v}", cave.granite_wall(Pc, 255, deep=v, tier=0))
    for v in range(3):
        sh.add(f"{pre}_wall_deep{v}", cave.granite_wall(Pc, 255, deep=v, tier=1))
    # 곧은 변(북 110 · 서 55 · 동 205) 윗면 잔돌 배치 교대 칸 — 본 시트 cave_wall_top110_1/2 · side55_1/2 · side205_1/2 와 같은 호출(top_v 9·10),
    # 색만 다르다(통합 I4 W5: 옛 던전 전용 top110_0..2 는 변형 6~8 잔돌이라 본 시트와 44~45px 달랐고 옆 테 변형이 없었다).
    for j, tv in ((1, 9), (2, 10)):
        sh.add(f"{pre}_wall_top110_{j}", cave.granite_wall(Pc, 110, top_v=tv))
        sh.add(f"{pre}_wall_side55_{j}", cave.granite_wall(Pc, 55, top_v=tv))
        sh.add(f"{pre}_wall_side205_{j}", cave.granite_wall(Pc, 205, top_v=tv))
    cave._GTOP.clear()
    sh.row_start()


def _ramp(P, ramp):
    """ramp = 램프 이름 하나(5톤) 또는 [(이름, 단), ...] 5개."""
    if isinstance(ramp, str):
        return list(P[ramp])
    return [P[k][i] for k, i in ramp]


# ---- 웅덩이(용암·물): 바깥 바닥 → 바위 고리 → 안쪽 액체 — 본 시트 물 둑(water_bank)과 같은 두 마스크 문법 ---------------
def pool_cell(P, m: int, f: int, floor_img, rim_key: str, liquid_key: str, shore_i: int = 3):
    rk = P[rim_key]
    Pr = recolor(P, rock=rim_key, water=liquid_key)
    outer = mo._mask("water_outer", m)
    inner = mo._mask("water_inner", m)
    w = P[liquid_key]
    im = px.new()
    for y in range(T):
        for x in range(T):
            if inner[y][x]:
                c = mo.water_px(Pr, x, y, f)
                if not all(px.neighbours4(inner, x, y, m).values()):
                    c = w[shore_i]
                im.putpixel((x, y), c)
            elif outer[y][x]:
                c = mo.rock_px(Pr, x, y)
                if not all(px.neighbours4(outer, x, y, m).values()):
                    c = rk[1]
                im.putpixel((x, y), c)
            else:
                im.putpixel((x, y), floor_img.getpixel((x, y)))
    return im


# ---- 방(탑·발전소·유적): 뒷벽 두 줄 + 검은 여백 띠 ---------------------------------------------------------------
def back_wall(col, part: str):
    """col(x, y) → 색(y 0..31). part up/dn."""
    y0 = 0 if part == "up" else T
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), col(x, y0 + y))
    return im


def room_edges(sh, P, pre: str, ceil, gray, void, ol):
    """여백 칸 6종 + 출구 틈: 본 시트 i2.edge 를 테 색만 바꿔 부른다."""
    Pe = recolor(P, i2_ceil=ceil, i2_gray=gray, i2_void=[void] if not isinstance(void, list) else void, i2_ol=[ol] if not isinstance(ol, list) else ol)
    for sides in ("", "l", "r", "t", "lt", "rt"):
        sh.add(f"{pre}_edge_{sides or 'v'}", i2.edge(Pe, sides))
    sh.add(f"{pre}_edge_mat", i2.edge_mat(Pe))


def under_wall(img):
    return i2.under_wall(img)


def east_shadow(img, top=False):
    return g2.east_shadow(img, top)


# ---- 올린 칸막이(오토타일 47): 본 시트 체육관 칸막이 기하(g2._virtual) 그대로, 바닥·윗면·앞면을 고른다 -------------
def block_cell(P, m: int, floor_img, top, face, ol):
    """top = 윗면 4톤(어둠→밝음), face(x, yy) → 앞면 색(yy = 앞면 본체 안 줄 0..), ol = 외곽선."""
    wall, kind = g2._virtual(m)
    me_face = not (m & S)
    open_n = not (m & N)
    im = px.new()
    for y in range(T):
        for x in range(T):
            X, Y = T + x, T + y
            if not wall[Y][X]:
                c = floor_img.getpixel((x, y))
                im.putpixel((x, y), px.tint(c, 0.84) if me_face and y == T - 1 else c)
                continue
            edge = any(not wall[Y + dy][X + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if me_face:
                yy = y - (1 if open_n else 0)
                if edge or yy <= 0 and open_n:
                    c = ol
                elif yy <= 1:
                    c = top[3] if (open_n and yy == 1) else top[2]
                elif yy == 2:
                    c = top[0]
                elif yy <= 4:
                    c = top[1] if yy == 4 else top[3]
                elif yy == 5:
                    c = top[0]
                elif y <= 12:
                    c = face(x, yy - 6)
                elif y == 13:
                    c = top[1]
                else:
                    c = ol
                if 5 <= yy and y <= 13:
                    for dx in (1, -1):
                        if wall[Y][X + dx] and kind[Y][X + dx] == "top":
                            c = ol
                im.putpixel((x, y), c)
            else:
                if edge:
                    c = ol
                else:
                    hi = (not wall[Y - 2][X]) or (not wall[Y][X - 2])
                    lo = (not wall[Y + 2][X] and kind[Y + 2][X] is None) or (not wall[Y][X + 2])
                    c = top[3] if hi else top[1] if lo else top[2]
                    for dx in (1, -1):
                        if wall[Y][X + dx] and kind[Y][X + dx] == "face" and y >= 5:
                            c = ol
                im.putpixel((x, y), c)
    return im


def bayer(x, y):
    """4×4 순서 디더 문턱(0..15)/16."""
    B = ((0, 8, 2, 10), (12, 4, 14, 6), (3, 11, 1, 9), (15, 7, 13, 5))
    return (B[y % 4][x % 4] + 0.5) / 16


def lobes_inside(lobes):
    def f(x, y):
        return any(((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 for cx, cy, rx, ry in lobes)
    return f


def shade_blob(im, inside, ramp, ol, ox=0, oy=0, w=T, h=T, shadow=True):
    """덩이 소품 한 벌 채색: 아래·오른쪽 외곽선 ramp[0] 대신 ol, 위·왼쪽 테 ramp[1], 속은 왼쪽 위 밝음 4단, 밑 그림자."""
    pts = [(x, y) for y in range(h) for x in range(w) if inside(x, y)]
    if not pts:
        return im
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    rx, ry = max(1, (max(xs) - min(xs)) / 2), max(1, (max(ys) - min(ys)) / 2)
    if shadow:
        for x, y in pts:
            for sx, sy in ((2, 2), (1, 2), (2, 1)):
                X, Y = x + sx, y + sy
                if 0 <= X < w and 0 <= Y < h and not inside(X, Y) and im.getpixel((ox + X, oy + Y))[3] == 0:
                    im.putpixel((ox + X, oy + Y), SHADOW)
    for x, y in pts:
        e = [not inside(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
        light = -((x - cx) / rx + (y - cy) / ry)
        if e[1] or e[2]:
            c = ol
        elif e[0] or e[3]:
            c = ramp[1]
        else:
            c = ramp[3] if light > 0.75 else ramp[2] if light > -0.05 else ramp[1]
        im.putpixel((ox + x, oy + y), c)
    return im


# ==== 2차(적대 검수 QA1 반영) ====================================================================
# ---- 패인 웅덩이(용암·물) 마스크: 북쪽만 둑 앞면(4px), 남·동·서는 1px 선 — 3/4 시점에서 바닥보다 낮은 못으로 읽힌다 -----------------
FILLET = 0                                           # 필렛은 4배에서 갈고리 티끌이 돼 껐다(자체 검수 L2) — 오목 모서리는 원작처럼 직각
POOL = dict(dN=4, dS=1, dW=1, dE=1, rad=7)          # 바깥 모서리 반지름 7 — 4 로는 맵 배율에서 직각으로 보였다(QA-L1 N1·N4)


def pool_mask(m: int, dN=4, dS=1, dW=1, dE=1, rad=4):
    """변마다 깊이가 다른 안쪽 마스크. 바깥 모서리는 반지름 rad 의 사분원, 안쪽 모서리는 두 변 깎임이 겹치는 사각만 판다(이음매 불변)."""
    ins = [[True] * T for _ in range(T)]
    for y in range(T):
        for x in range(T):
            if (not m & N and y < dN) or (not m & S and y > T - 1 - dS) or (not m & W and x < dW) or (not m & E and x > T - 1 - dE):
                ins[y][x] = False
    for bits, cx, cy, side in ((N | W, dW + rad, dN + rad, "nw"), (N | E, T - dE - rad, dN + rad, "ne"),
                               (S | W, dW + rad, T - dS - rad, "sw"), (S | E, T - dE - rad, T - dS - rad, "se")):
        if m & bits:
            continue
        for y in range(T):
            for x in range(T):
                px_, py_ = x + 0.5, y + 0.5
                inx = px_ < cx if "w" in side else px_ > cx
                iny = py_ < cy if "n" in side else py_ > cy
                if inx and iny and (px_ - cx) ** 2 + (py_ - cy) ** 2 > rad * rad:
                    ins[y][x] = False
    for sides, diag, fa, fb in ((N | E, NE, lambda x, y: y < dN, lambda x, y: x > T - 1 - dE), (N | W, NW, lambda x, y: y < dN, lambda x, y: x < dW),
                                (S | E, SE, lambda x, y: y > T - 1 - dS, lambda x, y: x > T - 1 - dE), (S | W, SW, lambda x, y: y > T - 1 - dS, lambda x, y: x < dW)):
        if (m & sides) == sides and not m & diag:
            for y in range(T):
                for x in range(T):
                    if fa(x, y) and fb(x, y):
                        ins[y][x] = False
    # 안쪽 모서리 필렛(반지름 FILLET, 0 이면 끔): 오목한 물 모서리를 둥글게.
    # 깎는 자리는 칸 안쪽(가장자리 줄·열 밖)이라 이웃 칸과의 이음매가 변하지 않는다.
    r = FILLET
    for sides, diag, cx, cy, sx, sy in ((N | E, NE, T - dE - r, dN + r, -1, 1), (N | W, NW, dW + r, dN + r, 1, 1),
                                        (S | E, SE, T - dE - r, T - dS - r, -1, -1), (S | W, SW, dW + r, T - dS - r, 1, -1)):
        if (m & sides) == sides and not m & diag:
            xs = range(T - dE - r, T - dE) if sx < 0 else range(dW, dW + r)
            ys = range(dN, dN + r) if sy > 0 else range(T - dS - r, T - dS)
            for y in ys:
                for x in xs:
                    if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r:
                        ins[y][x] = False
    return ins


def pool_masks() -> dict:
    return {m: pool_mask(m, **POOL) for m in px.ALL47}


def sunken_pool(m: int, floor_img, liquid, bank, edge, lip):
    """패인 웅덩이 한 칸. liquid(x, y) → 액체 색. bank = 둑 앞면 3톤(물 바로 위가 가장 어둡다), edge = 남·동·서 1px 선 색, lip = 둑 윗선(밝음)."""
    ins = pool_mask(m, **POOL)
    def wet(x, y):
        if 0 <= x < T and 0 <= y < T:
            return ins[y][x]
        if y >= T:
            return bool(m & S) and ins[T - 1][min(T - 1, max(0, x))]
        if y < 0:
            return bool(m & N) and ins[0][min(T - 1, max(0, x))]
        if x >= T:
            return bool(m & E) and ins[y][T - 1]
        return bool(m & W) and ins[y][0]
    im = px.new()
    for y in range(T):
        for x in range(T):
            if ins[y][x]:
                im.putpixel((x, y), liquid(x, y))
                continue
            k = next((k for k in range(1, 5) if wet(x, y + k)), 0)
            if k and y < POOL["dN"] + FILLET and all(not wet(x, y + j) for j in range(1, k)):
                c = bank[0] if k == 1 else bank[1] if k == 2 else bank[2] if k == 3 else lip
            elif any(wet(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                c = edge
            else:
                c = floor_img.getpixel((x, y))
            im.putpixel((x, y), c)
    return im


# ---- 올린 칸막이 2차(아지트·유적): 원작처럼 윗면이 칸 대부분, 앞면은 남쪽이 빈 칸 아래쪽 face_h px, 오른쪽 아래 빗면 테 --------------------
def block2_mask(m: int):
    x0 = 0 if m & W else 1
    x1 = T - 1 if m & E else T - 2
    y0 = 0 if m & N else 1
    y1 = T - 1 if m & S else T - 2
    ins = [[x0 <= x <= x1 and y0 <= y <= y1 for x in range(T)] for y in range(T)]
    for sides, diag, (cx, cy) in ((N | E, NE, (T - 1, 0)), (N | W, NW, (0, 0)), (S | E, SE, (T - 1, T - 1)), (S | W, SW, (0, T - 1))):
        if (m & sides) == sides and not m & diag:
            ins[cy][cx] = False
    # 바깥 모서리 반지름 2 깎기(두 이웃 변이 모두 열린 귀): 담·칸막이 끝이 칼로 자른 직각으로 안 보이게(QA-L2 N24)
    for bits, (cx, cy), (sx, sy) in ((N | W, (x0, y0), (1, 1)), (N | E, (x1, y0), (-1, 1)), (S | W, (x0, y1), (1, -1)), (S | E, (x1, y1), (-1, -1))):
        if not m & bits & (N | S) and not m & bits & (E | W):
            for dx, dy in ((0, 0), (1, 0), (0, 1)):
                ins[cy + sy * dy][cx + sx * dx] = False
    return ins


def block2_masks() -> dict:
    return {m: block2_mask(m) for m in px.ALL47}


def block2_cell(m: int, floor_img, top, face, ol, face_h: int, deco=None, shadow=True):
    """top = 윗면 4톤(진→밝), face(x, yy, h) → 앞면 색(yy 0 = 앞면 맨 위). 윗면 왼쪽·위 테는 밝게, 오른쪽 테는 한 단 진하게(빗면).
    deco(im, ins, m) 로 리벳·금을 얹는다. 바닥 쪽 남·동 1px 는 그늘."""
    ins = block2_mask(m)
    im = px.new()
    def blk(x, y):
        if 0 <= x < T and 0 <= y < T:
            return ins[y][x]
        if x >= T: return bool(m & E)
        if x < 0: return bool(m & W)
        if y >= T: return bool(m & S)
        return bool(m & N)
    fy0 = T - 1 - face_h if not m & S else T          # 앞면 시작 줄(남쪽이 빈 칸만)
    for y in range(T):
        for x in range(T):
            if not ins[y][x]:
                c = floor_img.getpixel((x, y))
                if shadow and ((not m & S and y == T - 1) or (not m & E and x == T - 1)) and (blk(x - 1, y) or blk(x, y - 1)):
                    c = px.tint(c, 0.8)
                im.putpixel((x, y), c)
                continue
            out = [not blk(x + dx, y + dy) for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0))]
            if any(out):
                c = ol
            elif y >= fy0:
                c = ol if y == fy0 else face(x, y - fy0 - 1, face_h - 1)
            else:
                if not blk(x, y - 2) or not blk(x - 2, y):
                    c = top[3]
                elif not blk(x + 2, y) or (fy0 < T and y == fy0 - 1):
                    c = top[1]
                else:
                    c = top[2]
            im.putpixel((x, y), c)
    if deco:
        deco(im, ins, m)
    return im


# ---- 벽 붙박이(동굴): 벽 앞면에 기댄 나무 사다리 · 벽에 뚫린 출입구 · 바닥 구멍 사다리 · 바닥 출구 빛 -----------------------------------
FRONT = N | E | W | NE | NW            # 왼쪽·오른쪽·위가 벽인 남쪽 앞면 칸


def wall_ladder(P, wall_key, wood):
    """벽 앞면에 기댄 나무 사다리 — 위층(3층) 덧그림, 바탕 투명. 벽 칸(앞면) 위에 얹으면 3층 통행 O 가 벽 X 를 덮어 밟을 수 있다.
    레일 둘·가로대 넷, 꼭대기는 벽 윗면 테까지 걸치고 밑동은 바닥에 그늘 1px — 원작 얼음폭포 동굴·물보라섬의 「올라가는」 사다리."""
    im = px.new()
    for y in range(1, T):
        for x, c in ((4, wood[0]), (5, wood[3]), (6, wood[1]), (9, wood[0]), (10, wood[3]), (11, wood[1])):
            im.putpixel((x, y), c)
    for x in (5, 10):
        im.putpixel((x, 0), wood[0])
    for y in (3, 7, 11):
        for x in range(7, 9):
            im.putpixel((x, y), wood[2]); im.putpixel((x, y + 1), wood[0])
    for x in (4, 5, 6, 9, 10, 11):
        im.putpixel((x, T - 1), wood[0])
    return im


def wall_door(P, wall_key):
    """벽 앞면에 뚫린 굴 입구 — 위층(3층) 덧그림, 바탕 투명. 둥근 아치 검은 굴 + 테 1px(벽 최암) + 문지방 쪽 2줄은 한 단 밝은 어둠(바닥으로 이어진다).
    원작 해저동굴·마그마 아지트의 굴 입구. 벽 칸(남쪽 앞면) 위에 얹는다."""
    w = P[wall_key]
    dark = px.tint(w[0], 0.4)
    mid = px.tint(w[0], 0.7)
    im = px.new()
    ins = lambda x, y: (3 <= x <= 12 and y >= 7) or ((x + 0.5 - 8) ** 2 / 25.0 + (y + 0.5 - 7.5) ** 2 / 36.0 <= 1 and y < 8)
    for y in range(T):
        for x in range(T):
            if ins(x, y):
                im.putpixel((x, y), mid if y >= 14 else dark)
            elif 0 <= x < T and any(ins(xx, yy) for xx, yy in ((x + 1, y), (x - 1, y), (x, y + 1))):
                im.putpixel((x, y), w[0])
    return im


def floor_hole(floor_img, wood, rim, dark):
    """바닥 구멍(내려가는 사다리): 둥근 검은 구멍 + 위쪽 테 1px(바닥 최암) + 구멍 속 노란 나무 사다리 윗부분."""
    im = floor_img.copy()
    ins = lambda x, y: ((x + 0.5 - 8) / 6.6) ** 2 + ((y + 0.5 - 8.5) / 5.8) ** 2 <= 1.0
    for y in range(T):
        for x in range(T):
            if ins(x, y):
                im.putpixel((x, y), rim if not ins(x, y - 1) else dark)
    for y in range(4, 14):
        for x, c in ((5, wood[3]), (6, wood[1]), (10, wood[3]), (11, wood[1])):
            if ins(x, y) and ins(x, y - 1):
                im.putpixel((x, y), c)
    for y in (5, 8, 11):
        for x in range(7, 10):
            if ins(x, y):
                im.putpixel((x, y), wood[2])
    return im


def floor_exit(floor_img, light, ol=None):
    """바닥 출구 빛(맵 아래 가장자리 칸): 아래 변에 붙은 밝은 반원 2톤 — 원작 불꽃길·마그마 아지트·석실의 출구.
    ol 을 주면 반원 둘레 1px 를 그 색으로(흰 눈 바닥처럼 빛과 바닥이 같은 밝기일 때)."""
    im = floor_img.copy()
    for y in range(T):
        for x in range(T):
            d = ((x + 0.5 - 8) / 7.0) ** 2 + ((y + 0.5 - 17) / 9.0) ** 2
            if ol is not None and 1.0 < d <= 1.32:
                im.putpixel((x, y), ol)
            if d <= 1.0:
                im.putpixel((x, y), light[1] if d < 0.62 else light[0] if d < 0.85 or (x + y) % 2 else floor_img.getpixel((x, y)))
    return im


def cave_floor2(name: str, f, v: int, specks=None):
    """동굴 바닥 2차: 가로 결(나무 마루·아스팔트로 오독) 대신 원작 해저동굴·본 시트 동굴처럼 대각(↘) 잔결 + 2px 자갈 점. f = 5톤(어둠→밝음), 바탕 f[2].
    specks = [(색, 개수)] 1px 점(화산재) — 칸 변형마다 자리가 다르다."""
    r = px.rng(f"{name}-{v}")
    im = px.fill(px.new(), f[2])
    for _ in range(7 + v % 2):
        x, y = r.randrange(T), r.randrange(T)
        ln = r.choice((2, 3))
        col = f[1] if r.random() < 0.55 else f[3]
        for i in range(ln):
            im.putpixel(((x + i) % T, (y + i) % T), col)
    for _ in range(2 + (v == 3)):
        x, y = r.randrange(T), r.randrange(T)
        im.putpixel((x, y), f[3]); im.putpixel(((x + 1) % T, y), f[3]); im.putpixel((x, (y + 1) % T), f[1]); im.putpixel(((x + 1) % T, (y + 1) % T), f[1])
        if f[4:] and r.random() < 0.5:
            im.putpixel((x, y), f[4])
    for col, n in (specks or []):
        for _ in range(n):
            im.putpixel((r.randrange(T), r.randrange(T)), col)
    return im


def fixture_groups(sh, pre: str, names: list[str]):
    """벽 붙박이 칸마다 1칸짜리 그룹 별칭(47 변형이 모두 같은 칸) — 벽 그룹 connectGroups 가 이 칸을 벽으로 본다(편집기에서 벽을 다시 칠해도 홈이 안 생긴다)."""
    for n in names:
        for k in px.ALL47:
            sh.ids[f"{n}_at{k}"] = sh.ids[n]
