"""건물 변주 키트 — 평지붕 집을 뼈대로 부품(지붕색·폭·창/문 배치·2층·차양·판자벽)을 조합해 종류를 늘린다.
부품은 전부 기준에서 잰 구조(landmarks._window/_arch_door/_post, buildings.roof_flat)를 재사용하고, 새로 그리는 것(차양·판자벽·층 보)은
같은 팔레트 램프와 같은 명암 규칙(빛은 왼쪽 위, 최암은 윤곽 전용, 튀어나온 것 밑에 그림자)을 따른다.
plan 항목: ("D", x) 문 · ("W", x) 창 · ("S", x) 쇼윈도(창 둘을 맞붙인 폭 43)."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402
import landmarks as lm  # noqa: E402
import buildings as bd  # noqa: E402


def wall(P, n, plan, seed, roles, rows=31, ground=True, wall_kind="plaster", awning=None):
    """벽 한 층 — 몬스터 마을 건물 문법(buildings.wall_kit: 윤곽·크림 회벽·돌 기초·흰 틀 창·나무 문, 2026-10-07)."""
    cv, wins, doors = bd.wall_kit(P, n, plan, rows=rows, ground=ground, wall_kind=wall_kind, accent=awning)
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
