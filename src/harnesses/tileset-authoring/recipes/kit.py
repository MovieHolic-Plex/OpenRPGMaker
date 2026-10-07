"""건물 변주 키트 — 평지붕 집을 뼈대로 부품(지붕색·폭·창/문 배치·2층·차양·판자벽)을 조합해 종류를 늘린다.
부품은 전부 기준에서 잰 구조(landmarks._window/_arch_door/_post, buildings.roof_flat)를 재사용하고, 새로 그리는 것(차양·판자벽·층 보)은
같은 팔레트 램프와 같은 명암 규칙(빛은 왼쪽 위, 최암은 윤곽 전용, 튀어나온 것 밑에 그림자)을 따른다.
plan 항목: ("D", x) 아치 문 · ("W", x) 창 · ("S", x) 쇼윈도(창 둘을 맞붙인 폭 43)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import landmarks as lm  # noqa: E402
import buildings as bd  # noqa: E402


def _awning(cv, P, accent, x0, x1, y0=3):
    """차양: 비스듬히 내려오는 줄무늬 천. 위 두 행은 보에 가려 어둡고, 줄무늬 폭 4, 아랫단은 둥글게(가운데가 한 행 길다), 밑에 그림자 2행."""
    ac, pl = P[accent], P["plaster"]
    for x in range(x0, x1 + 1):
        stripe = ((x - x0) // 4) % 2 == 0
        base = ac[3] if stripe else pl[1]
        shade = ac[2] if stripe else pl[0]
        for k in range(9):
            y = y0 + k
            c = shade if k < 2 else base
            if k == 8:
                continue
            px.put(cv, x, y, c)
        # 아랫단 둥근 가장자리: 줄무늬 가운데 열은 한 행 더
        if (x - x0) % 4 in (1, 2):
            px.put(cv, x, y0 + 8, ac[2] if stripe else pl[0])
        # 줄무늬 사이 윤곽
    for k in range(9):                                                         # 양 끝 윤곽
        px.put(cv, x0, y0 + k, ac[2]); px.put(cv, x1, y0 + k, ac[2])
    for x in range(x0 + 1, x1):                                                 # 천 아래 그림자 2행
        px.put(cv, x, y0 + 9, P["plaster"][0]); px.put(cv, x, y0 + 10, P["plaster"][0])


def wall(P, n, plan, seed, roles, rows=31, ground=True, wall_kind="plaster", awning=None):
    wd, pl = P["wood"], P["plaster"]
    w = n * T
    cv = px.new(w, rows)
    base_y = rows - 7                                             # 바닥 보 5행의 첫 행
    if wall_kind == "plank":
        for y in range(rows):
            for x in range(w):
                c = wd[2]
                if (x % 5) == 4: c = wd[1]
                if y in (3, 4): c = wd[1]
                if (x % 5) == 0 and y > 4: c = wd[3] if (x // 5 + y // 9) % 3 == 0 else wd[2]
                cv.putpixel((x, y), c)
    else:
        px.rect(cv, 0, 0, w - 1, rows - 1, pl[1])
    px.rect(cv, 2, 0, w - 3, 1, wd[1]); px.rect(cv, 2, 2, w - 3, 2, wd[0])
    if wall_kind == "plaster":
        px.rect(cv, 8, 3, w - 9, 4, pl[0])
    for yy_, c_ in zip(range(base_y, base_y + 5), (wd[1], wd[3], wd[2], wd[2], wd[0])):
        px.rect(cv, 8, yy_, w - 9, yy_, c_)
    for x0 in (3, w - 8):
        lm._post(cv, wd, x0, 3, rows - 1)
    for y in range(rows):
        for x in list(range(0, 2)) + list(range(w - 2, w)) + (list(range(2, 3)) + list(range(w - 3, w - 2)) if y >= 3 else []):
            cv.putpixel((x, y), (0, 0, 0, 0))
    if awning:
        sx = [it[1] for it in plan if it[0] == "S"][0]
        _awning(cv, P, awning, sx - 1, sx + 48)
    wins, doors = [], []
    for item in plan:
        kind, x = item[0], item[1]
        if kind == "W":
            wins.append(lm._window(cv, wd, P["water"][3], P["glass"][4], x, 6 if not awning else 14))
        elif kind == "S":
            y = 13
            wins.append(lm._window(cv, wd, P["water"][3], P["glass"][4], x, y, h=16))
            wins.append(lm._window(cv, wd, P["water"][3], P["glass"][4], x + 26, y, h=16))
        else:
            doors.append(lm._arch_door(cv, wd, P["gold"], pl, lm.door_slot(x), 5))
    if ground:
        keep = [(3, 7), (w - 8, w - 4)] + [(d[0], d[2]) for d in doors]
        for yy_ in (rows - 2, rows - 1):
            for xx_ in range(w):
                if not any(a <= xx_ <= b for a, b in keep):
                    cv.putpixel((xx_, yy_), (0, 0, 0, 0))
    if wall_kind == "plaster":
        lm._drop_shadow(cv, pl[1], pl[0], set())
    if not awning:
        for i in range(5):
            for k in range(5 - i):
                px.put(cv, 8 + k, 3 + i, wd[1] if k < 5 - i - 1 else wd[0])
                px.put(cv, w - 9 - k, 3 + i, wd[1] if k < 5 - i - 1 else wd[0])
    for d_ in doors:
        lm._door_knob(cv, wd, P["gold"], pl, d_[0], d_[1])
    roles.setdefault("windows", []); roles.setdefault("doors", [])
    return cv, wins, doors


def build(P, v, seed_name, roles):
    """v: {kind: house|house2|shop|cabin, roof, n, plan, upper(plan), accent}. 반환 이미지."""
    kind = v.get("kind", "house")
    n, roof_key = v["n"], v["roof"]
    roof = bd.roof_flat(P, roof_key, n, seed_name)
    if kind == "house2":
        up, uw, _ = wall(P, n, v["upper"], seed_name + "u", {}, rows=32, ground=False)
        lo, lw, ld = wall(P, n, v["plan"], seed_name + "l", {}, rows=31, ground=True)
        R0, R1 = bd.ROOF_H, bd.ROOF_H + 32
        H = R1 + 31
        cv = px.new(n * T, H)
        cv.alpha_composite(roof, (0, 0)); cv.alpha_composite(up, (0, R0)); cv.alpha_composite(lo, (0, R1))
        wins = [[a, b + R0, c, d + R0] for a, b, c, d in uw] + [[a, b + R1, c, d + R1] for a, b, c, d in lw]
        doors = [[a, b + R1, c, d + R1] for a, b, c, d in ld]
    else:
        awning = v.get("accent") if kind == "shop" else None
        wk = "plank" if kind == "cabin" else "plaster"
        lo, lw, ld = wall(P, n, v["plan"], seed_name, {}, rows=31, ground=True, wall_kind=wk, awning=awning)
        cv = px.new(n * T, bd.HOUSE_H)
        cv.alpha_composite(roof, (0, 0)); cv.alpha_composite(lo, (0, bd.ROOF_H))
        wins = [[a, b + bd.ROOF_H, c, d + bd.ROOF_H] for a, b, c, d in lw]
        doors = [[a, b + bd.ROOF_H, c, d + bd.ROOF_H] for a, b, c, d in ld]
    def _walls(ws, ds, y0, y1):
        edges = sorted([(a, c) for a, _, c, _ in ws + ds]); out, prev = [], 8
        for a, c in edges:
            if a - 3 - (prev + 2) >= 3: out.append([prev + 2, y0, a - 3, y1])
            prev = c
        if n * T - 10 - (prev + 2) >= 3: out.append([prev + 2, y0, n * T - 10, y1])
        return out
    walls = []
    R0 = bd.ROOF_H                                   # 벽 첫 행(옛 49)
    if kind == "house2":
        walls = _walls([w_ for w_ in wins if w_[1] < R0 + 32], [], R0 + 10, R0 + 21) + _walls([w_ for w_ in wins if w_[1] >= R0 + 32], doors, R0 + 42, R0 + 53)
    elif kind == "house":
        walls = _walls(wins, doors, R0 + 10, R0 + 21)
    elif kind == "shop":
        walls = _walls(wins, doors, R0 + 15, R0 + 22)
    roles.update({"door_kind": "wood", "roof_ramp": roof_key, "roof_ymax": R0 - 1, "shadow_rgb": list(P["plaster"][0][:3]),
                  "windows": wins, "doors": doors, "openings": [list(r) for r in wins + doors], "wall": walls,
                  "_cols": n, "_rows": cv.height // T})
    return cv
