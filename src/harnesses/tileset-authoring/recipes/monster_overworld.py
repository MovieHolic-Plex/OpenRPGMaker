"""몬스터 수집 야외 레시피 — 기준 팩(Scarloxy)의 화풍을 study 가 잰 수치로 읽고 원본 도트로 그린다.

기준 그림의 문법(측정·눈으로 읽은 것):
- 풀·모래는 2~3px 덩이가 섞인 부드러운 질감(1px 잡음 거의 없음).
- 높이·연못은 직선 턱이 아니라 둥근 돌덩이가 이어진 「바위 고리」 — 돌마다 3톤 + 작은 밝은 점 + 진한 경계.
- 물은 그물처럼 이어진 밝은 선(셀 무늬).
- 나무는 덩어리 여러 개가 겹친 큰 모양에 발밑 풀 자국, 윤곽은 잎의 가장 어두운 톤.
"""
from __future__ import annotations

# 참고문서(lib/refdocs.py)에 머리말(장소 문법)이 실리는 도우미 모듈과 견본 맵 설명
DOC_MODULES = ("outdoor2", "forest", "cave", "interior2", "gym2")
MAP_NOTES = {
    "map": "마을(미로·연두마을 문법): 숲 벽(2×2 덩이 9조각)이 둘레를 막고 남북 출구는 숲 틈 2칸. 걷는 땅은 밝은 공터 풀(clear_at)이고 집·센터·마트·화단은 짙은 풀 섬 위에 선다 — 원작 마을의 동선은 흙길이 아니라 밝은 땅이다. 문 앞 한 칸은 비운다(센터·마트 이중문은 두 칸 다 입구). 모래길(sand_at)·턱·바위 고원은 도로 견본에 있다(마을 견본에는 없다).",
    "route": "도로(101번 도로 문법): 숲 벽 사이로 밝은 공터 풀 길이 지그재그, 남쪽 끝 구간(턱 아래)은 모래길(sand_at)로 바뀐다 — 공터 길과 모래길은 서로 이어진 이웃이라 이음매에 풀 테가 끼지 않는다. 길에 맞닿아 피할 수 없는 키 큰 풀숲(야생 만남, 가장자리 이웃 풀 칸에 잎끝 tall_fringe_s/e/w 를 위층에 얹는다 — 덩이 바깥 귀는 둥글게 깎은 tall<v>rg<귀>, 귀에 닿은 잎끝은 끝을 자른 _a/_b/_ab, 옆 잎끝은 두 벌 _v0/_v1: 야생과 같은 정본 wild_tall), 숲에서 숲까지 걸친 남쪽으로만 뛰어내리는 턱 줄(풀 입술 + 흙 앞면 6px, 길 자리만 끊김), 바위 고원(야생 산 절벽과 같은 두 그룹: 윗면 rock_at = cliffg — 바깥과 같은 풀, 북·동·서 바위 덩이 테 / 앞면 gface_at 두 줄 — 적갈 바위 덩이, 전부 막힘, 가운데 칸은 덩이 변형을 칸 해시로 섞는다. 띠 끝(옆이 열린 앞면 윗칸·아랫칸)은 둥근 어깨·발끝 gface_rnd<마스크>(야생 산·강과 같은 정본 face_round), 앞면 두 줄을 끊은 2×2 회색 돌계단 rock_stairs2 만 오르는 길(계단 양옆 앞면은 두 열씩) — 계단 위 윗면 칸은 남쪽이, 계단 양옆 앞면 칸은 계단 쪽이 이어진 변형으로 바꾼다), 표지판·밀 바위(회색 괴력 바위 — 동굴·체육관과 같은 그림)·길가 꽃·꽃밭(1칸 장식 덤불은 두지 않는다 — 1칸 작은 나무는 곧 자르기 나무). 서쪽 꽃밭 주머니로 드는 1칸 틈은 자르기 나무(cuttree — 야생·체육관과 같은 wild_forest.cut_tree)가 막는다.",
    "cave": "동굴(화강 동굴 문법): 바닥보다 어두운 암반(벽 오토타일 — 윗면 거친 돌 + 남쪽 한 칸 바위 절벽 앞면(그 맵에서 가장 어두운 면) + 동서 사선 옆면. 곧은 앞면 칸은 cave_wall_at155 · cave_wall_face1 · cave_wall_face2 를, 곧은 북쪽 변은 cave_wall_at110 · cave_wall_top110_1/2, 곧은 동서 변은 cave_wall_at55 · cave_wall_side55_1/2 · cave_wall_at205 · cave_wall_side205_1/2 를 칸 위치 해시로 섞는다)이 둘레와 섬을 이루고, 바닥에 모래 덩이·잔돌. 회색 둥근 밀 바위·갈색 X 금 깨는 바위는 이벤트 자리. 사다리는 벽 바로 아래 바닥 칸, 구멍은 바닥 가운데.",
    "room-center": "몬스터 센터 실내: 뒷벽 띠 + 접수대 + 회복 기계, 바닥 가운데 몬스터볼 문양, 아래 가운데 출입 매트.",
    "room-mart": "마트 실내: 2단 체크 바닥, 계산대가 입구 옆, 진열대 줄.",
    "room-house": "민가 실내: 바구니 짜임 바닥, 식탁·의자·책장·화분, 2층 계단.",
    "room-gymspin": "회전 체육관: 화살표 판(slideTiles 화살표)을 따라 미끄러져 관장에게 간다 — 정지 판에서 멈춘다.",
    "room-gymelec": "전기 체육관: 전기 문 기둥 쌍이 길을 막고 스위치(이벤트 자리)를 눌러 연다.",
    "room-gymrock": "바위 체육관: 돌 칸막이(pb_rock 올린 칸막이) 두 줄이 방을 가른다. 아래 줄은 한쪽 끝만 열리고, 위 줄의 유일한 틈은 밀 바위가 막아 북쪽으로 밀어야 관장 단상에 닿는다. 칸막이는 늘 두 칸 두께로 깐다(한 칸짜리 혹은 앞면이 좁게 그려져 계단으로 읽힌다). 트레이너는 아래 줄 열린 끝 앞에 선다.",
}

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import N, E, S, W, NE, SE, SW, NW, T  # noqa: E402
from pokemon_overworld import Sheet, palette, fence_cell, sign  # noqa: E402
import trees  # noqa: E402
import buildings as bd
import kit  # noqa: E402
import props  # noqa: E402
import cave  # noqa: E402
import forest  # noqa: E402
import outdoor2 as o2  # noqa: E402
import interior2 as i2  # noqa: E402
import gym2 as g2  # noqa: E402
import landmarks as lm  # noqa: E402

_GRASS0: dict[tuple[int, int], tuple] = {}
ROCK_SEEDS = px.torus_seeds("rock-boulders-5", 5)


# ---- 질감 ----------------------------------------------------------------------------------
def grass_tex(P, v: int):
    g = P["grass"]
    # 기준 풀(Scarloxy) 은 바탕보다 밝은 두 톤만 쓴다 — 어두운 점(g0·g1)을 빼야 원작처럼 조용하다(적대 검수 2026-10-02 「바닥이 시끄럽다」)
    return px.clumps(f"grass{v}", g[2], [(g[3], 17 + v, 3), (g[4], 6, 2), (g[1], 1 if v == 3 else 0, 2)])


def sand_tex(P, v: int):
    s = P["sand"]
    return px.clumps(f"sand{v}", s[2], [(s[3], 13, 3), (s[1], 11, 3)])


def rock_px(P, x: int, y: int):
    """바위 고리의 한 점: 돌덩이 경계는 진하게, 돌 안은 왼쪽 위가 밝게, 위쪽에 작은 밝은 점."""
    rk = P["rock"]
    d1, d2, idx, (vx, vy) = px.voronoi(ROCK_SEEDS, x + 0.5, y + 0.5)
    if d2 - d1 < 1.1:
        return rk[1]
    light = vx + vy
    if -5.4 < light < -3.0 and abs(vx - vy) < 2.2:
        return rk[4]
    if light < -1.3:
        return rk[3]
    if light > 2.2:
        return rk[1]
    return rk[2]


def water_px(P, x: int, y: int, f: int):
    w = P["water"]
    seeds = [((sx + 1.4 * px_cos(f, i)) % T, (sy + 1.4 * px_sin(f, i)) % T) for i, (sx, sy) in enumerate(WATER_SEEDS)]
    d1, d2, _, _ = px.voronoi(seeds, x + 0.5, y + 0.5)
    b = d2 - d1
    if b < 0.95:
        return w[3]
    if b < 1.7 and (x * 7 + y * 3) % 5 < 2:
        return w[2]
    return w[1] if (x + y * 2) % 11 == 0 else w[0]


WATER_SEEDS = px.torus_seeds("water-net", 5)


def px_cos(f: int, i: int) -> float:
    import math
    return math.cos(math.pi / 2 * f + i * 1.3)


def px_sin(f: int, i: int) -> float:
    import math
    return math.sin(math.pi / 2 * f + i * 1.3)


# ---- 오토타일 -------------------------------------------------------------------------------
AUTOTILE_PARAMS = {
    "sand": ("sand-path", 2, 4, 1),                  # 가장자리 2±1px — 1칸 샛길도 칸 폭 대부분(10~12px)이 모래(적대 검수 L3 N44)
    "rock_outer": ("rock-outer", 0, 8, 0),
    "rock_inner": ("rock-inner", 9, 3, 0),          # 9px: 남쪽 앞면 높이(바위 고원 3/4, 적대 검수 L1 N10) — 북·동·서 돌 테는 바깥 4px 만 그린다
    "water_outer": ("water-outer", 0, 8, 0),
    "water_inner": ("water-inner", 6, 3, 0),
    "clearing": ("clearing", 2, 5, 1),              # 가장자리 2±1px — 1칸 샛길이 6px 실선(도랑)으로 읽혔다(L3 N44). outdoor2.clearing 과 같은 값
}


def autotile_masks(kind: str) -> dict:
    if kind == "cliff_top":                                          # 바위 고원 = 야생 절벽 마스크(L9 N80)
        return {m: wm.top_mask(m) for m in px.ALL47}
    if kind == "cface":
        return {m: wm.face_mask(m) for m in px.ALL47}
    if kind in cave.AUTOTILE_PARAMS:
        return cave.autotile_masks(kind)
    if kind in g2.AUTOTILE_PARAMS:
        return g2.autotile_masks(kind)
    name, depth, radius, amp = AUTOTILE_PARAMS[kind]
    return {m: px.inside_mask(m, name, depth, radius, amp) for m in px.ALL47}


def _mask(kind: str, m: int):
    name, depth, radius, amp = AUTOTILE_PARAMS[kind]
    return px.inside_mask(m, name, depth, radius, amp)


def _nb(inside, x, y, m):
    return px.neighbours4(inside, x, y, m)


def sand_path(P, m: int):
    s, g = P["sand"], P["grass"]
    inside = _mask("sand", m)
    tex = sand_tex(P, 0)
    h = px.rng("sandfringe")
    table = [[h.random() for _ in range(T)] for _ in range(T)]
    im = px.new()
    for y in range(T):
        for x in range(T):
            nb = _nb(inside, x, y, m)
            edge_in = inside[y][x] and not all(nb.values())
            if inside[y][x]:
                c = tex.getpixel((x, y))
                if edge_in:
                    r = table[y][x]
                    c = s[0] if r < 0.5 else g[3] if r < 0.62 else g[0] if r < 0.7 else c
                im.putpixel((x, y), c)
            else:
                c = _GRASS0[(x, y)]
                if any(nb.values()):
                    r = table[y][x]
                    c = g[4] if r < 0.35 else g[0] if r < 0.6 else c
                im.putpixel((x, y), c)
    return im


def rock_ring(P, m: int, inner_kind: str, outer_kind: str, inner_px, outer_px):
    """바깥(outer_px) 위에 돌 고리, 안쪽은 inner_px. 두 마스크의 차이가 고리 띠."""
    rk = P["rock"]
    outer = _mask(outer_kind, m)
    inner = _mask(inner_kind, m)
    im = px.new()
    for y in range(T):
        for x in range(T):
            if inner[y][x]:
                c = inner_px(x, y)
                nb = _nb(inner, x, y, m)
                if not all(nb.values()):
                    c = P["grass"][0] if (x * 5 + y * 3) % 7 == 0 and inner_px is not None and False else c
                im.putpixel((x, y), c)
            elif outer[y][x]:
                c = rock_px(P, x, y)
                nbo = _nb(outer, x, y, m)
                if not all(nbo.values()):
                    c = rk[1]  # 바깥 윤곽
                im.putpixel((x, y), c)
            else:
                im.putpixel((x, y), outer_px(x, y))
    return im


# ---- 바위 고원·돌계단·동굴 입구 = 야생 산 절벽 함수(wild_mountain)를 그대로 쓴다(적대 검수 L3 N43 — 「같은 게임」) ----------------
# 정본: 원작 112·114번 도로 문법을 잰 야생 시트 절벽(금 간 적갈 앞면 · 윗면은 바깥과 같은 풀 · 회색 돌계단 · 앞면에 판 아치 굴).
# 함수는 import 로 받으므로 야생 쪽이 고치면 본 시트도 따라간다. 본 시트 rock_at 은 한 그룹 47변형이라 남쪽이 열린 칸이 곧 한 칸 앞면이다.
import wild_mountain as wm  # noqa: E402
import wild_common as wc  # noqa: E402
import wild_forest as wf  # noqa: E402
import wild_river as wr  # noqa: E402
import wild_tall as wt  # noqa: E402


def _gsh(P):
    g = P["grass"]
    return lambda x, y: g[0]                                          # 앞면 밑 그늘(풀) — 야생 gface 와 같다


def _g0(x, y):
    return _GRASS0[(x % T, y % T)]


def rock_plateau(P, m: int):
    """바위 고원 윗면 한 칸(L9 N80 — 야생 정본과 같은 두 그룹): wm.cliff_top 출력 그대로(= 야생 cliffg_at<m>, 47변형 전부).
    풀 윗면 · 북·동·서 바위 테 · 둥근 바깥 모서리. 남쪽은 앞면 그룹(gface_at)이 이어 받는다(connectGroups)."""
    return wm.cliff_top(P, m, _g0, _g0, _gsh(P))


def rock_face(P, m: int, var: int = 0):
    """바위 고원 앞면 한 칸(L9 N80·N81): wm.face_tile 출력 그대로(= 야생 gface_at<m>, 통행 막힘). 앞면은 두 줄(윗칸 ROW_T·아랫칸 ROW_B),
    var 1..FACE_VARS 는 가운데 칸 덩이 변형(쇼케이스가 칸 해시로 섞는다 — 16px 주기 무늬가 안 보이게)."""
    return wm.face_tile(P, m, _g0, _g0, _gsh(P), var) if var else wm.face_tile(P, m, _g0, _g0, _gsh(P))


WILD_BRANCH = "agent/th-wild"
WILD_COPIES = ("wild_common", "wild_mountain", "wild_forest", "wild_river", "wild_tall")    # 본 시트가 import 하는 야생 정본 사본


def parity_issues(sh, tile, load_seed) -> list[str]:
    """야생 정본과 같은 이름·같은 문법 칸이 바이트로 같은지(L6 N65 — 두 번 갈라졌다). 다르면 굽기 실패.
    1) 사본 파일 recipes/wild_*.py 의 sha1 == 야생 브랜치 HEAD 같은 파일 sha1(브랜치가 없으면 건너뛴다고 알린다).
    2) 야생 시드 팔레트로 정본 함수를 다시 그려 바이트 비교: rock_at<m>·rock_atin0_v == cliffg_at, gface_at<m>·gface_atin* == gface_at,
       rock_stairs/_r == cstairs1, rock_stairs2.x.y == gstairs, bridge_h/v == wild_river.log_bridge(o, "1"), cuttree == cut_tree.
    3) bush<v> 실루엣이 cuttree 와 50% 이상 다르다."""
    import hashlib
    import os
    import subprocess
    out: list[str] = []
    here = Path(__file__).resolve()
    rel = here.parent.relative_to(here.parents[4]) if len(here.parents) > 4 else None
    for mod in WILD_COPIES:
        f = here.parent / f"{mod}.py"
        try:
            head = subprocess.run(["git", "show", f"{WILD_BRANCH}:{(rel / f.name).as_posix()}"], cwd=here.parent,
                                  capture_output=True, check=True).stdout
        except Exception:
            if os.environ.get("ALLOW_NO_WILD") == "1":                 # 명시 스위치가 있을 때만 건너뛴다(L7 N73)
                print(f"   (ALLOW_NO_WILD=1: 사본 검사 건너뜀 — {WILD_BRANCH}:{f.name} 을 읽을 수 없다)")
                continue
            out.append(f"야생 사본 {f.name} 을 {WILD_BRANCH} 에서 읽을 수 없다 — 브랜치를 받거나 ALLOW_NO_WILD=1 로 명시해 건너뛴다")
            continue
        if hashlib.sha1(head).hexdigest() != hashlib.sha1(f.read_bytes()).hexdigest():
            out.append(f"야생 사본 {f.name} 이 {WILD_BRANCH} HEAD 와 다르다 — git merge {WILD_BRANCH} 후 다시 굽는다")
    ws = load_seed("monster-wild")
    Pw = palette(ws)
    gw = wc.tex_px(grass_tex(Pw, 0))
    gsw = lambda x, y: Pw["grass"][0]
    # (본 시트 이름, 야생 정본 같은 그림을 다시 그리는 함수, 야생 이름) — 같은 이름은 같은 그림(L9 N79·N80·N84)
    ref: list[tuple[str, object, str]] = []
    if "rock_at255" in sh.ids:
        for m in px.ALL47:
            ref.append((f"rock_at{m}", lambda m=m: wm.cliff_top(Pw, m, gw, gw, gsw), f"cliffg_at{m}"))
            ref.append((f"gface_at{m}", lambda m=m: wm.face_tile(Pw, m, gw, gw, gsw), f"gface_at{m}"))
        for v in range(3):
            ref.append((f"rock_atin0_{v}", lambda v=v: wm.cliff_top(Pw, 255, wc.tex_px(grass_tex(Pw, v + 1)), gw, gsw), f"cliffg_atin0_{v}"))
        for tier, mm in ((0, wm.ROW_T), (1, wm.ROW_B)):
            for v in range(wm.FACE_VARS):
                ref.append((f"gface_atin{tier}_{v}", lambda mm=mm, v=v: wm.face_tile(Pw, mm, gw, gw, gsw, v + 1), f"gface_atin{tier}_{v}"))
        for nm, im in wm.round_face_set(Pw, "gface", gw, gw, gsw).items():    # 둥근 띠 끝(I4 W3)
            ref.append((nm, lambda im=im: im, nm))
        for x in range(2):
            ref.append((["rock_stairs", "rock_stairs_r"][x], lambda x=x: wm.stairs(Pw, x, 0, gw, gw, 1), f"cstairs1.{x}.0"))
            for y in range(2):
                ref.append((f"rock_stairs2.{x}.{y}", lambda x=x, y=y: wm.stairs(Pw, x, y, gw, gw, 2), f"gstairs.{x}.{y}"))
    if "tall0rg1" in sh.ids:                                         # 둥근 귀 풀숲(I4 W2) = 야생 tall0rg*·tall_fringe_*(같은 정본 함수, 야생 팔레트로 다시 그림)
        tw = [o2.tall_grass(Pw, v) for v in range(2)]
        for row in wt.round_tall_set(Pw["tall"], tw, o2.tall_fringe(Pw, "s"), (("g", gw),), "tall"):
            for nm, im in row:
                ref.append((nm, lambda im=im: im, nm))
    for o in "hv":
        ref.append((f"bridge_{o}", lambda o=o: wr.log_bridge(Pw, o, "1"), f"bridge_{o}(log_bridge 1)"))
    ref.append(("cuttree", lambda: wf.cut_tree(dict(Pw, _leaf_hex=ws["palette"]["leaf"])), "cuttree"))
    if "tree_a.0.0" in sh.ids:                                       # 외톨이 활엽수 = 야생 forest_o(I1 X1)
        lone = wc.forest_singles(dict(Pw, _leaf_hex=ws["palette"]["leaf"]), gw, "forest-crown")
        for y in range(4):
            for x in range(2):
                ref.append((f"tree_a.{x}.{y}", lambda k=f"o.{x}.{y}": lone[k], f"forest_o.{x}.{y}"))
    bad = [(a, b) for a, fn, b in ref if a in sh.ids and tile(a).tobytes() != fn().tobytes()]
    missing = [a for a, _, _ in ref if a not in sh.ids and not a.startswith(("rock_", "gface_"))]
    for a in missing:
        out.append(f"{a} 칸이 시트에 없다(야생 정본 대조 대상)")
    if bad:
        out.append(f"야생 정본과 바이트가 다른 칸 {len(bad)}개: " + ", ".join(f"{a}≠{b}" for a, b in bad[:6]) + ("…" if len(bad) > 6 else ""))
    n_cmp = sum(1 for a, _, _ in ref if a in sh.ids)
    if "cuttree" in sh.ids:                                          # 장식 덤불이 자르기 나무로 읽히지 않게(L7 N69): 실루엣 차 ≥ 50%
        op = lambda im: {(x, y) for y in range(T) for x in range(T) if im.getpixel((x, y))[3] == 255}
        B = op(tile("cuttree"))
        for v in range(2):
            if f"bush{v}" in sh.ids:
                A = op(tile(f"bush{v}"))
                d = len(A ^ B) / max(1, len(A | B))
                if d < 0.5:
                    out.append(f"bush{v} 실루엣이 cuttree 와 {d:.0%} 만 다르다 — 50% 이상 달라야 자르기 나무로 오독되지 않는다")
    print(f"야생 정본 대조: {n_cmp}칸(고원 윗면·앞면·속 변형·돌계단·나무다리·자르기 나무·외톨이 나무) — 다름 {len(out)}건")
    return out


def rock_stairs(P, part: int = 0):
    """돌계단 한 줄 2칸(L5 N60): 야생 wm.stairs(rows=1) 출력 그대로(야생 cstairs1 과 같은 픽셀). part 0 = 왼칸 rock_stairs, 1 = 오른칸 rock_stairs_r."""
    g0 = lambda x, y: _GRASS0[(x % T, y % T)]
    return wm.stairs(P, part, 0, g0, g0, 1)


def cave_mouth(P):
    """야외 동굴 입구 3×3(L3 N43): 야생 산 문법 그대로 — 윗줄은 풀 윗면 단(cliff_top: 북 3px 테·둥근 모서리),
    아래 두 줄은 두 칸 절벽 앞면(face_tile), 가운데 열에 앞면 바닥선까지 뚫린 아치 굴(wild cave_mouth). 입구 칸 = 아래 가운데(1,2)."""
    g0 = lambda x, y: _GRASS0[(x % T, y % T)]
    sh_ = _gsh(P)
    im = px.new(3 * T, 3 * T)
    tops = (E | S | SE, E | W | S | SE | SW, W | S | SW)
    faces = ((E | S | SE, N | E | NE), None, (W | S | SW, N | W | NW))
    for cx in range(3):
        im.alpha_composite(wm.cliff_top(P, tops[cx], g0, g0, sh_), (cx * T, 0))
        for part in range(2):
            t = wm.cave_mouth(P, part, g0, g0, sh_) if cx == 1 else wm.face_tile(P, faces[cx][part], g0, g0, sh_, cx)
            im.alpha_composite(t, (cx * T, (1 + part) * T))
    return im


def water_bank(P, m: int, f: int):
    wt = lambda x, y: water_px(P, x, y, f)
    g0 = lambda x, y: _GRASS0[(x, y)]
    # 바깥 풀 → 돌 고리 → 안쪽 물. 안쪽 물과 고리 사이 한 줄은 밝은 물빛(해안 빛)
    rk = P["rock"]; w = P["water"]
    outer = _mask("water_outer", m)
    inner = _mask("water_inner", m)
    im = px.new()
    for y in range(T):
        for x in range(T):
            if inner[y][x]:
                c = wt(x, y)
                nb = _nb(inner, x, y, m)
                if not all(nb.values()):
                    c = w[3]
                im.putpixel((x, y), c)
            elif outer[y][x]:
                c = rock_px(P, x, y)
                nbo = _nb(outer, x, y, m)
                if not all(nbo.values()):
                    c = rk[1]
                im.putpixel((x, y), c)
            else:
                im.putpixel((x, y), g0(x, y))
    return im


_GRASS1: dict[tuple[int, int], tuple] = {}


# ---- 풀·턱 ---------------------------------------------------------------------------------
def tall_grass(P, v: int):
    t = P["tall"]
    im = px.clumps(f"tall{v}", t[2], [(t[1], 14, 3), (t[3], 6, 2)])
    key = {"t": t[3], "m": t[1], "d": t[0]}
    shapes = ["t.t.t", "mdmdm", ".mdm.", "..d.."]
    for ox, oy in ((0, 0), (8, 1), (3, 8), (11, 9)):
        ox2 = (ox + v * 2) % 12
        px.stamp(im, ox2, oy, shapes, key)
    return im


def ledge_south(P, part: str):
    """점프 턱: 돌덩이가 줄지어 앉은 낮은 둔덕. 위는 둥글게, 아래는 진한 그림자."""
    rk, g = P["rock"], P["grass"]
    im = px.new()
    for y in range(T):
        for x in range(T):
            im.putpixel((x, y), _GRASS0[(x, y)])
    r = px.rng("ledge-m")
    wob = [r.randint(0, 1) for _ in range(T)]
    x0, x1 = 0, T - 1
    if part == "l":
        x0 = 2
    if part == "r":
        x1 = T - 3
    for x in range(x0, x1 + 1):
        end = (part == "l" and x == x0) or (part == "r" and x == x1)
        near = (part == "l" and x == x0 + 1) or (part == "r" and x == x1 - 1)
        top = 2 + wob[x] + (2 if end else 1 if near else 0)
        bot = 12 - (2 if end else 1 if near else 0)
        for y in range(top, bot + 1):
            c = rock_px(P, x, y + 5)
            if y == top or end:
                c = rk[1]
            elif y == bot:
                c = rk[0]
            elif y >= bot - 1 and c in (rk[2], rk[3]):
                c = rk[1]
            im.putpixel((x, y), c)
        for y in range(bot + 1, min(T, bot + 3)):
            im.putpixel((x, y), g[0] if (x + y) % 2 else g[1])  # 아래로 드리운 그림자
    return im


# ---- 조립 -----------------------------------------------------------------------------------
SECTIONS = ("ground", "ledges", "clearing", "sandpath", "plateau", "water", "fence", "trees", "forest", "outdoor_props",
            "route_props", "cave", "houses", "landmarks", "interior", "gym")


def build(seed: dict, parts=None, sh: Sheet | None = None) -> Sheet:
    """parts: 그릴 절(SECTIONS 부분집합). None 이면 seed.sections, 그것도 없으면 전부. 지역 시트 레시피는
    `mo.build(seed, ["ground", "trees", "forest", "houses", "landmarks"])` 로 공통 절을 받고 자기 절을 덧붙인다."""
    P = palette(seed)
    sh = sh or Sheet(seed.get("tilesPerRow", 16))
    parts = set(parts if parts is not None else seed.get("sections", SECTIONS))
    want = parts.__contains__
    P2 = dict(P)
    P2["_leaf_hex"] = seed["palette"]["leaf"]
    P3 = dict(P2)
    LM_ROLES.clear()
    if want("cave"):
        cave.init_granite_floor(P)
    for v in range(4):
        t = grass_tex(P, v)
        if v == 0:
            for y in range(T):
                for x in range(T):
                    _GRASS0[(x, y)] = t.getpixel((x, y))
        if v == 1:
            for y in range(T):
                for x in range(T):
                    _GRASS1[(x, y)] = t.getpixel((x, y))

    if want("ground"):
        sh.section("바닥")
        for v in range(4):
            sh.add(f"grass{v}", grass_tex(P, v))
        sh.add("tall0", o2.tall_grass(P, 0))
        sh.add("tall1", o2.tall_grass(P, 1))
        for side in ("s", "e", "w"):                                     # 풀밭 가장자리 잎끝(위층, 이웃 풀 칸에 얹는다, L2 N35)
            sh.add(f"tall_fringe_{side}", o2.tall_fringe(P, side))
        sh.add("sand0", sand_tex(P, 0))
        sh.add("sand1", sand_tex(P, 1))
        # 풀숲 덩이 둥근 귀·잎끝 한 벌(정본 wild_tall, 감독 결정 I4 W2 — 야생과 같은 문법·같은 바이트). 바닥은 풀(g) 하나:
        # 본 시트 풀숲은 늘 풀 칸 위에 깔리고, 이웃 공터·모래길은 풀숲 쪽으로 풀 테를 그린다. 배치는 node/wild_round.mts roundTall.
        wt.add_round_tall(sh, "tall", P["tall"], (("g", _g0),))
        sh.end_section()

    if want("ledges"):
        sh.section("턱")
        sh.add("ledge_s_mid", o2.ledge(P, "m0"))
        sh.add("ledge_s_mid1", o2.ledge(P, "m1"))
        sh.add("ledge_s_l", o2.ledge(P, "l"))
        sh.add("ledge_s_r", o2.ledge(P, "r"))
        sh.add("ledge_e", o2.ledge_side(P, "e"))
        sh.add("ledge_w", o2.ledge_side(P, "w"))
        sh.end_section()

    if want("clearing"):
        sh.section("밝은 공터 풀 오토타일(47)")
        for k in px.ALL47:
            sh.add(f"clear_at{k}", o2.clearing(P, k))
        sh.end_section()

    if want("sandpath"):
        sh.section("모래길 오토타일(47)")
        for k in px.ALL47:
            sh.add(f"sand_at{k}", sand_path(P, k))
        sh.end_section()

    if want("plateau"):
        sh.section("바위 고원(윗면 47 · 앞면 47 두 줄 · 돌계단) — 야생 cliffg_at·gface_at·gstairs 와 같은 그림")
        for k in px.ALL47:
            sh.add(f"rock_at{k}", rock_plateau(P, k))
        for v in range(3):                                               # 윗면 속 칸: 풀 결 변형(야생 cliffg_atin0_v)
            sh.add(f"rock_atin0_{v}", wm.cliff_top(P, 255, wc.tex_px(grass_tex(P, v + 1)), _g0, _gsh(P)))
        sh.row_start()
        for k in px.ALL47:
            sh.add(f"gface_at{k}", rock_face(P, k))
        for tier, mm in ((0, wm.ROW_T), (1, wm.ROW_B)):
            for v in range(wm.FACE_VARS):
                sh.add(f"gface_atin{tier}_{v}", rock_face(P, mm, v + 1))
        wm.add_round_face(sh, P, "gface", _g0, _g0, _gsh(P))           # 띠 끝 둥근 어깨·발끝 gface_rnd<m>(정본, 감독 결정 I4 W3 — 야생 gface_rnd 와 같은 그림)
        sh.row_start()
        for y in range(2):                                               # 두 줄 앞면을 끊는 돌계단 2×2(야생 gstairs)
            for x in range(2):
                sh.add(f"rock_stairs2.{x}.{y}", wm.stairs(P, x, y, _g0, _g0, 2))
        sh.add("rock_stairs", rock_stairs(P, 0))                         # 앞면을 끊고 들어선 회색 돌계단 2칸(왼칸) — 야생 cstairs1 과 같은 픽셀
        sh.add("rock_stairs_r", rock_stairs(P, 1))                       # 오른칸
        sh.end_section()

    if want("water"):
        sh.section("물(바위 둑) 오토타일(47 × 4프레임)")
        for k in px.ALL47:
            if len(sh.tiles) % 4:
                sh.row_start()
            for f in range(4):
                sh.add(f"water_at{k}_f{f}", water_bank(P, k, f))
            sh.ids[f"water_at{k}"] = sh.ids[f"water_at{k}_f0"]
            sh.anim.append(dict(baseTile=sh.ids[f"water_at{k}_f0"], frames=4, fps=3))
        sh.end_section()

    if want("fence"):
        sh.section("울타리 오토타일")
        for m in range(16):
            sh.add(f"fence_at{m}", fence_cell(P, m))
        sh.end_section()

    if want("trees"):
        sh.section("나무·소품")
        pines, pn_n = pick_by_gate(seed, P2, lambda sd: trees.pine_tiered(P2, seed=sd), "pine", 1)
        print(f"나무 관문 샘플링: 침엽수 {len(pines)}/{pn_n}회 통과")
        # 외톨이 활엽수 = 숲 벽 수관(forest.crown) 한 그루(통합 검수 I1 해안 X1, 감독 결정 — 정본은 숲 수관 쪽).
        # tree_a = 야생 forest_o 와 같은 그림(같은 함수·같은 씨앗), tree_b = 같은 함수 다른 씨앗. 2×4: 위 한 줄은 수관이 솟는 줄,
        # 맨 아래 줄은 줄기 + 옅은 타원 그림자 하나(풀빛 고리 그림자는 없앴다). 찍는 쪽은 야생처럼 그루 칸보다 한 줄 위에 찍는다.
        g0 = lambda x, y: _GRASS0[(x, y)]
        chosen = [("tree_a", forest.forest_canvas(P2, g0, 1, 1, "forest-crown"), 4),
                  ("tree_b", forest.forest_canvas(P2, g0, 1, 1, "forest-crown-d"), 4),
                  ("pine_a", pines[0][1] if pines else trees.pine_tiered(P2, seed="pine-fallback"), 3)]
        for kind, im, rows in chosen:
            for y in range(rows):
                for x in range(2):
                    sh.add(f"{kind}.{x}.{y}", im.crop((x * T, y * T, x * T + T, y * T + T)))
        sh.add("sign", o2.sign(P))
        sh.add("sign_metal", o2.sign(P, metal=True))
        sh.add("mailbox", o2.mailbox(P))
        sh.end_section()

    if want("forest"):
        sh.section("숲 벽(맵 테두리 나무 9조각)")
        for name, t in forest.nine_slice(P2, lambda x, y: _GRASS0[(x, y)]).items():
            sh.add(name, t)
        sh.end_section()

    if want("outdoor_props"):
        sh.section("야외 소품(바위·덤불·꽃·동서 턱·계단·다리)")
        sh.add("item_capsule", o2.item_capsule(P))
        for v in range(2):
            sh.add(f"boulder{v}", g2.boulder(P3, v, outdoor=True))   # 야외 밀 바위 = 체육관·동굴 밀 바위와 같은 그림(L2 N27). 주황 덩이는 o2.boulder(던전·사막 레시피가 직접 부른다)
            sh.add(f"bush{v}", o2.bush(P2, v))
        for k in ("pink", "white", "yellow", "red"):
            sh.add(f"flower_{k}", o2.flowers(P, k))
            sh.add(f"flowerbed_{k}", o2.flowerbed(P2, k))
        for k in ("pink", "white", "yellow", "red"):
            for v in (1, 2):
                sh.add(f"flowerbed_{k}{v}", o2.flowerbed(P2, k, v))
        sh.add("stairs_v", props.stairs(P, "v"))                        # steel 네 톤 — 야생 wm.stairs(rock_stairs·cstairs)와 같은 램프(L5 N60)
        for o in "hv":                                                   # 나무다리 정본 = 야생 통나무 다리 한 줄(L9 N79, REGIONS 2-1) — 야생 river 견본에서 검수받은 그림
            sh.add(f"bridge_{o}", wr.log_bridge(P, o, "1"))
        sh.end_section()

    if want("route_props"):
        # 자르기 나무 = 정본 야생 wild_forest.cut_tree 그대로(L6 N64). 바닥 그늘만 풀 최암(체육관 gy_cuttree 와 같은 방식).
        # 공통 절(outdoor_props)이 아니라 본 시트 전용 절에 둔다 — 야생은 숲 절에서 같은 이름 cuttree 를 직접 굽는다(이름 중복 방지).
        sh.section("도로 장치(자르기 나무)")
        sh.add("cuttree", wf.cut_tree(dict(P2, wfloor=P["cut_shadow"])))   # 발밑 그늘도 정본과 같은 짙은 풀 그늘(L9 N84 — 밝은 연두였다)
        sh.end_section()

    if want("cave"):
        sh.section("동굴 한 벌(바닥·벽·계단·사다리·석순·깨지는 바위·입구)")
        Pg = cave.granite_ramp(P)                                        # 화강 동굴 문법(적대 검수 L1 N3): 벽·소품은 바닥 계열 램프
        for v in range(4):
            sh.add(f"cave_floor{v}", cave.granite_floor(P, v))
        sh.add("cave_floor_s", cave.granite_floor_shadow(P))
        sh.add("cave_void", cave.void_tile(P))
        for k in (38, 76, 19, 137):                                      # 맵 바깥 모서리 — 바깥은 어둠 단색
            sh.add(f"cave_wall_oc{k}", cave.granite_wall(P, k, outside_void=True))
        for v in range(2):
            sh.add(f"cave_pebbles{v}", cave.small_pebbles(P, v))
            sh.add(f"cave_sand{v}", cave.sand_patch(P, v))
        sh.row_start()
        for k in px.ALL47:
            sh.add(f"cave_sand_at{k}", cave.sand_cell(P, k))
        sh.row_start()
        sh.add("hole_down", cave.hole_down(Pg))
        sh.add("ladder_up", cave.granite_ladder(P))
        sh.add("cracked_rock", cave.smash_rock(P))
        sh.add("cave_boulder", cave.push_boulder(P))
        sh.row_start()
        for k in px.ALL47:
            sh.add(f"cave_wall_at{k}", cave.granite_wall(P, k))
        for v in (1, 2):                                                 # 곧은 남쪽 앞면(마스크 155)의 주름 변형 — 칸 위치 해시로 섞는다(L2 N28)
            sh.add(f"cave_wall_face{v}", cave.granite_wall(P, 155, face_v=v))
        for j, tv in ((1, 9), (2, 10)):                                  # 곧은 변(북 110 · 서 55 · 동 205) 윗면 잔돌 배치 교대 칸 — 칸 위치 해시로 섞는다(통합 I3 Z2: 17칸 리벳 점선)
            sh.add(f"cave_wall_top110_{j}", cave.granite_wall(P, 110, top_v=tv))
            sh.add(f"cave_wall_side55_{j}", cave.granite_wall(P, 55, top_v=tv))
            sh.add(f"cave_wall_side205_{j}", cave.granite_wall(P, 205, top_v=tv))
        sh.row_start()
        for v in range(3):
            sh.add(f"cave_wall_mid{v}", cave.granite_wall(P, 255, deep=v, tier=0))
        for v in range(3):
            sh.add(f"cave_wall_deep{v}", cave.granite_wall(P, 255, deep=v, tier=1))
        sh.row_start()
        sh.add("stalag.0.0", cave.stalagmite(Pg, "t"))
        sh.add("stalag.0.1", cave.stalagmite(Pg, "b"))
        sh.add("stalag_b.0.0", cave.stalagmite(Pg, "t", "b"))
        sh.add("stalag_b.0.1", cave.stalagmite(Pg, "b", "b"))
        sh.row_start()
        for name, t in bd.cut(cave_mouth(P), "cave_mouth").items():
            sh.add(name, t)
        sh.end_section()

    if want("houses"):
        sh.section("건물(집)")
        for hid, h in seed["houses"].items():
            LM_ROLES[hid] = {}
            if h.get("kind", "house") == "house":
                img = bd.house(P, h["roof"], h["plan"], h["n"], hid, LM_ROLES[hid])
            else:
                img = kit.build(P, h, hid, LM_ROLES[hid])
            for name, t in bd.cut(img, hid).items():
                sh.add(name, t)
            sh.row_start()
        sh.end_section()

    if want("landmarks"):
        sh.section("랜드마크(센터·마트·체육관·박공 집)")
        def _r(name):
            LM_ROLES[name] = {}
            return LM_ROLES[name]
        marks = {"center": lm.center(P, "roof_red", roles=_r("center")), "mart": lm.center(P, "roof_blue", True, roles=_r("mart")),
                 "gym_leaf": lm.gym(P, "gym_green", roles=_r("gym_leaf")), "gym_fire": lm.gym(P, "gym_fire", roles=_r("gym_fire")), "gym_water": lm.gym(P, "gym_water", roles=_r("gym_water")),
                 "gable_a": lm.gable(P, "roof_green", roles=_r("gable_a")), "gable_b": lm.gable(P, "roof_purple", roles=_r("gable_b"))}
        for mid, img in marks.items():
            for name, t in lm.cut(img, mid).items():
                sh.add(name, t)
            sh.row_start()
        sh.end_section()
    if want("interior"):
        sh.section("실내 2차(방마다 벽·3톤 바닥·외곽선+그림자 가구)")
        for kind in ("center", "mart", "house"):
            for v in range(2):
                sh.add(f"i2_fl_{kind}{v}", i2.floor(P3, kind, v))
            sh.add(f"i2_fl_{kind}_s", i2.under_wall(i2.floor(P3, kind, 0)))
            sh.add(f"i2_mat_{kind}", i2.mat(P3, kind))
            for part in ("up", "dn"):
                sh.add(f"i2_wall_{kind}_{part}", i2.wall(P3, kind, part))
                for side in "lr":
                    sh.add(f"i2_wall_{kind}_{part}_{side}", i2.corner_wall(P3, kind, part, side))
            sh.row_start()
        for sides in ("", "l", "r", "t", "lt", "rt"):
            sh.add(f"i2_edge_{sides or 'v'}", i2.edge(P3, sides))
        sh.add("i2_edge_mat", i2.edge_mat(P3))
        sh.row_start()
        for nm, t in i2.emblem(P3).items():
            sh.add(nm, t)
        sh.row_start()
        for name, (fn, _kind) in i2.FURNITURE.items():
            for nm, t in bd.cut(fn(P3), name).items():
                sh.add(nm, t)
        sh.end_section()

    if want("gym"):
        sh.section("체육관 2차(바닥·뒷벽·장치·올린 칸막이 두 벌)")
        for kind in ("teal", "yel", "dirt", "plank"):
            for v in range(2):
                sh.add(f"g2_fl_{kind}{v}", g2.floor(P3, kind, v))
            sh.add(f"g2_fl_{kind}_s", g2.under_wall(g2.floor(P3, kind, 0)))
            sh.add(f"g2_fl_{kind}_s_w", g2.under_wall(g2.floor(P3, kind, 0), west_gap=2))   # 칸막이 서쪽 끝 밑: 외곽선이 x=2 에서 시작하니 그늘도 x=2 부터(L6 N66)
            sh.add(f"g2_fl_{kind}_e", g2.east_shadow(g2.floor(P3, kind, 0)))
            sh.add(f"g2_fl_{kind}_e_top", g2.east_shadow(g2.floor(P3, kind, 0), start=True))   # 그늘 띠 시작 칸(L4 N51)
            sh.add(f"g2_fl_{kind}_c", g2.corner_shadow(g2.floor(P3, kind, 0)))   # 칸막이 남동 모서리(L5 N61)
            sh.add(f"g2_fl_{kind}_se", g2.east_shadow(g2.floor(P3, kind, 0), top=True))
            sh.add(f"g2_mat_{kind}", g2.gym_mat(P3)(kind))
        sh.add("g2_plank_edge", g2.plank_edge(P3))
        sh.add("g2_edge_mat", g2.edge_mat(P3))
        sh.row_start()
        for style in ("teal", "elec", "rock"):
            for part in ("up", "dn"):
                sh.add(f"g2_wall_{style}_{part}", g2.wall(P3, style, part))
                for side in "lr":
                    sh.add(f"g2_wall_{style}_{part}_{side}", g2.corner_wall(P3, style, part, side))
        sh.row_start()
        for d in "udlr":
            sh.add(f"g2_spin_{d}", g2.spin(P3, d))
        sh.add("g2_spin_stop", g2.spin_stop(P3))
        for d in "udlr":                                                 # 뒷벽 바로 밑 줄의 판: 바닥 _s 와 같은 벽 그늘을 판 위에도(L8 N76 — 판에서만 띠가 끊겼다)
            sh.add(f"g2_spin_{d}_s", g2.under_wall(g2.spin(P3, d)))
        sh.add("g2_spin_stop_s", g2.under_wall(g2.spin_stop(P3)))
        for d in "udlr":                                                 # 칸막이 동쪽 띠 위의 판: 왼쪽 4px 에 같은 그늘(L9 N76b)
            sh.add(f"g2_spin_{d}_e", g2.east_shadow(g2.spin(P3, d)))
        sh.add("g2_spin_stop_e", g2.east_shadow(g2.spin_stop(P3)))
        sh.add("g2_pit", g2.pit(P3))
        sh.add("g2_switch", g2.switch(P3))
        for v in range(2):
            sh.add(f"g2_arc{v}", g2.arc(P3, v))
            sh.add(f"g2_boulder{v}", g2.boulder(P3, v))
        for name, (fn, _k) in g2.FURN.items():
            for nm, t in bd.cut(fn(P3), name).items():
                sh.add(nm, t)
        for theme in g2.BLOCK_THEMES:
            sh.row_start()
            for k in px.ALL47:
                sh.add(f"g2_pb_{theme}_at{k}", g2.block_cell(P3, k, theme))
        sh.end_section()

    return sh


LM_ROLES: dict[str, dict] = {}


def landmark_roles(P) -> dict[str, dict]:
    """건물 관문용 역할 좌표(레시피가 그리면서 내보낸 것). 시트를 만든 같은 실행 안에서만 채워진다."""
    return {k: v for k, v in LM_ROLES.items() if v}


def role_ids(sh) -> dict[str, list[str]]:
    ids = sh.ids
    has = lambda p: any(k.startswith(p) for k in ids)
    return {
        "grass": ["grass0"] if "grass0" in ids else [],
        "tall_grass": ["tall0"] if "tall0" in ids else [],
        "sand": ["sand0"] if "sand0" in ids else [],
        "path_autotile": [f"sand_at{k}" for k in px.ALL47] if has("sand_at") else [],
        "rock_ring_autotile": [f"rock_at{k}" for k in px.ALL47] if has("rock_at") else [],
        "water_autotile": [f"water_at{k}" for k in px.ALL47] if has("water_at") else [],
        "ledge_south": ["ledge_s_mid", "ledge_s_l", "ledge_s_r"] if "ledge_s_mid" in ids else [],
        "tree_big": ["tree_a.0.0"] if "tree_a.0.0" in ids else [],
        "fence": ["fence_at0"] if "fence_at0" in ids else [],
        "sign": ["sign"] if "sign" in ids else [],
    }


# 자동 검사 선언 — harness.py 가 읽는다
FAMILIES = [("동굴 벽", "cave_wall_at", "cave_wall", ""), ("칸막이 상록", "g2_pb_teal_at", "pb_teal", ""), ("칸막이 보라", "g2_pb_elec_at", "pb_elec", ""), ("칸막이 바위", "g2_pb_rock_at", "pb_rock", ""), ("모래길", "sand_at", "sand", ""), ("동굴 모래", "cave_sand_at", "cave_sand", ""), ("밝은 공터", "clear_at", "clearing", ""), ("바위 고원 윗면", "rock_at", "cliff_top", ""), ("바위 고원 앞면", "gface_at", "cface", ""), ("물 둑", "water_at", "water_inner", "_f0")]
EXTRA_MASKS = {"물 둑 바깥": "water_outer"}
OPAQUE = ["i2_fl_center0", "i2_fl_mart0", "i2_fl_house0", "i2_wall_center_up", "i2_edge_v", "g2_fl_teal0", "g2_fl_yel0", "g2_fl_dirt0", "g2_fl_plank0", "g2_spin_u", "g2_pit", "g2_pb_teal_at255", "g2_pb_elec_at255", "cave_floor0", "cave_wall_at255", "grass0", "tall0", "sand0", "sand_at255", "rock_at255", "gface_at255", "water_at255_f0"]


def negatives(P, root):
    """음성 대조 이름 → 그림. 관문이 반드시 불합격시켜야 한다."""
    import controls
    out = {"tree_disc": controls.tree_disc(P), "pine_disc": controls.pine_disc(P)}
    out.update(controls.gen3_tiles(root))
    out["gen3_house"] = controls.gen3_house(P, root)
    return out


def crown_profile_fails(im, h: int = 37) -> list[str]:
    """활엽수 돔 실루엣 검사(적대 검수 L5 N59): 열마다 처음 불투명한 y(윗 프로필)가 이웃 열과 3px 넘게 뛰면(절벽·혹),
    같은 y 가 12px 넘게 이어지면(평평한 상자 윗변) 실패."""
    top = [next((y for y in range(h) if im.getpixel((x, y))[3] == 255), None) for x in range(im.width)]
    cols = [t for t in top if t is not None]
    fails = []
    for a, b in zip(top, top[1:]):
        if a is not None and b is not None and abs(a - b) > 3:
            fails.append(f"윗 프로필 이웃 열 차 {abs(a - b)}px > 3")
            break
    run = best = 1
    for a, b in zip(cols, cols[1:]):
        run = run + 1 if a == b else 1
        best = max(best, run)
    if best > 12:
        fails.append(f"윗 프로필 평평 구간 {best}px > 12")
    return fails


def pick_by_gate(seed: dict, P, make, prefix: str, want: int, tries: int = 40, silhouette: bool = False):
    """관문을 통과하는 씨앗만 모은다(거절 샘플링). 통과작이 want 개에 못 미치면 그만큼만 돌려준다 — 못 채웠다고 불합격작을 섞지 않는다."""
    import gates
    root = Path(__file__).resolve().parents[4]
    ref = Path(root / seed["reference"]["sheets"]["grassland"])
    from PIL import Image
    sc = Image.open(ref).convert("RGBA")
    ramp = [tuple(c[:3]) for c in px.ramp(seed["palette"]["leaf"])]
    g = seed["gates"]["tree"]
    regs = {n: sc.crop((x, y, x + w, y + h)) for n, (sheet, x, y, w, h) in seed["reference"]["regions"].items()}
    spec = gates.derive_object_spec([gates.object_metrics(regs[r], ramp) for r in g["positives"]])
    got, tried = [], 0
    for i in range(tries):
        sd = f"{prefix}-{i}"
        im = make(sd)
        tried += 1
        if not gates.evaluate_object(gates.object_metrics(im, ramp), spec) and not (silhouette and crown_profile_fails(im)):
            got.append((sd, im))
            if len(got) >= want:
                break
    return got, tried
