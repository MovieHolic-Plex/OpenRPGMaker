"""몬스터 수집 야외 건물 — 기준 팩의 집 구조(읽은 것)를 좌표로 다시 그린다.

기준 구조: 지붕은 어긋쌓기 벽돌(3톤, 줄눈·바깥 윤곽), 위 두 줄은 먼 쪽이라 어둡고 그 아래 용마루 띠 양끝에 금빛 마감.
처마는 갈색 보, 벽은 크림 회벽 + 목조 기둥(양끝)·모서리 가새, 아치 문, 4칸 유리창(창 밑 그림자).
박공형은 두 경사면(왼쪽 밝고 오른쪽 어두움, 세로 비늘) + 가운데 금빛 용마루 기둥 + 박공 삼각 벽에 창.
"""
from __future__ import annotations

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib"))
import px  # noqa: E402
from px import T  # noqa: E402

ROOF_KEYS = ("roof_green", "roof_purple", "roof_red", "roof_blue")
# 지붕 높이(px). 통합 I4 W1: 원작 민가는 4칸 높이(지붕 2줄 + 벽 2줄)다 — 옛 49행 지붕은 집을 5칸으로 키웠다.
# 지붕 33 + 벽 31 = 64 = 4칸. 다른 시트(눈·재 덮개)는 49 를 적지 말고 이 상수를 읽는다.
ROOF_H = 33
WALL_H = 31
HOUSE_H = ROOF_H + WALL_H


def _roof_ramp(P, key):
    return P[key]  # [최암, 암, 중, 명, 최명]


def _bricks(cv, x0, y0, x1, y1, ramp, r, dark=False, jx=10):
    """어긋쌓기 벽돌로 [x0,x1)×[y0,y1) 를 채운다. 줄눈은 암, 벽돌 톤은 중/명(먼 쪽이면 암/중)."""
    base, lite = (ramp[3], ramp[4]) if not dark else (ramp[2], ramp[3])
    joint = ramp[2] if not dark else ramp[1]
    bh = 8
    row = 0
    y = y0
    while y < y1:
        x = x0 - (0 if row % 2 == 0 else r.randint(3, 8))
        while x < x1:
            bw = r.randint(jx, jx + 8)
            tone = lite if r.random() < 0.28 else base
            for yy in range(y, min(y1, y + bh)):
                for xx in range(max(x0, x), min(x1, x + bw)):
                    c = tone
                    if yy == y + bh - 1 or xx == x + bw - 1 or yy >= y1 - 0:
                        c = joint
                    cv.putpixel((xx, yy), c)
            x += bw
        y += bh
        row += 1


def roof_flat(P, key, n: int, seed: str, H: int = ROOF_H):
    """정면 지붕 H행 × n칸(기준 집에서 행 단위로 잰 구조, 높이만 원작 비례로 줄였다 — 통합 I4 W1).
    H=33: 행 0 윤곽 | 1~4 위쪽 벽돌(높이 4, 어둡다) | 5~12 용마루 띠(3,3,3,4,4,2,2,1) 양끝 용마루 마개 |
    13 줄눈 | 14~29 아래 기와(밝다) | 30~32 가장자리 띠(1,2,0). 좌우 끝은 x=1·w-2 윤곽.
    H=49(옛 크기): 위쪽 벽돌 두 줄 1~8, 용마루 9~16, 기와 18~45."""
    ramp = _roof_ramp(P, key)
    gold, wd, pl = P["gold"], P["wood"], P["plaster"]
    r = random.Random(seed)
    w = n * T
    cv = px.new(w, H)
    up = 8 if H >= 49 else 4                                                          # 위쪽(먼 쪽) 벽돌 줄 수 × 4
    ry = 1 + up                                                                       # 용마루 띠 첫 행
    L, R = 1, w - 2
    def brick_rows(y0, y1, bh, tones, joint, jx):
        row = 0
        y = y0
        while y < y1:
            x = L + 1 - (0 if row % 2 == 0 else r.randint(3, 8))
            while x < R:
                bw = r.randint(jx, jx + 8)
                tone = r.choice(tones)
                for yy in range(y, min(y1, y + bh)):
                    for xx in range(max(L + 1, x), min(R, x + bw)):
                        c = ramp[tone]
                        if yy == y + bh - 1 or xx == x + bw - 1:
                            c = ramp[joint]
                        cv.putpixel((xx, yy), c)
                x += bw
            y += bh
            row += 1
    def shingle_rows(y0, y1, body, light, shadow):
        """기와 줄(L1 N17 — 엇갈린 벽돌 줄은 돌벽 쌓기로 읽혔다): 줄 높이 5 = 몸 4 + 아래 그림자 1, 기와 한 장 폭 6px 의 밑끝은 둥글게(양 끝 1px 그림자),
        줄마다 3px 엇갈림. 위 줄일수록 한 톤 밝다(아래 줄 몸 = body, 맨 위 두 줄 = light)."""
        rows = list(range(y0, y1, 5))
        for ri, y in enumerate(rows):
            off = 3 * (ri % 2)
            tone = light if ri < len(rows) // 2 else body                       # 위 절반이 한 톤 밝다(옛 6줄 = 3줄)
            for yy in range(y, min(y1, y + 5)):
                k = yy - y
                for xx in range(L + 1, R):
                    u = (xx + off) % 6
                    if k == 4 or (k == 3 and u == 0):
                        c = ramp[shadow]
                    elif k == 0 and u in (1, 2):
                        c = ramp[min(4, tone + 1)]
                    else:
                        c = ramp[tone]
                    cv.putpixel((xx, yy), c)
    brick_rows(1, ry, 4, [2, 2, 2, 1, 3] if H >= 49 else [2, 2, 2, 2, 1, 3], 1, 10)   # 위쪽 벽돌(어두움) — 짧은 지붕은 가장자리 띠 비중이 커서 최암 벽돌을 덜 쓴다
    for x in range(L + 1, R):
        for k, t in enumerate((3, 3, 3, 4, 4, 2, 2, 1)):                               # 용마루 띠
            cv.putpixel((x, ry + k), ramp[t])
    shingle_rows(ry + 9, H - 3, 3, 4, 2)                                              # 아래 기와(밝음)
    px.rect(cv, L + 1, ry + 8, R - 1, ry + 8, ramp[1])
    for x in range(L + 1, R):                                                         # 가장자리 띠
        cv.putpixel((x, H - 5), ramp[4]) if cv.getpixel((x, H - 5))[3] == 0 else None
        cv.putpixel((x, H - 3), ramp[1]); cv.putpixel((x, H - 2), ramp[2]); cv.putpixel((x, H - 1), ramp[0])
    px.rect(cv, L, 1, L, H - 1, ramp[0]); px.rect(cv, R, 1, R, H - 1, ramp[0])       # 옆 윤곽
    px.rect(cv, L + 1, 0, R - 1, 0, ramp[0])
    # 용마루 끝 마개(L2 N38 — 크림·금빛 블록이 무엇인지 안 읽혔다): 지붕 색 그대로의 둥근 용마루 기와 끝. 7px, 한 칸 바깥으로 내민다.
    for side in (0, 1):
        x0 = 1 if side == 0 else w - 8                                         # 지붕 옆 윤곽(x=1·w-2) 안에서 시작 — 밖으로 튀지 않게(L3 N49)
        for k in range(8):
            for i in range(7):
                ii = i if side == 0 else 6 - i                                     # 바깥 = 0
                if (k == 0 and ii == 0) or (k == 7 and ii == 0):
                    continue                                                        # 둥근 끝
                c = ramp[4] if k <= 1 else ramp[3] if k <= 4 else ramp[2] if k == 5 else ramp[1]
                if ii == 0 or k == 7:
                    c = ramp[0]
                elif ii == 1 and k <= 5:
                    c = ramp[4] if side == 0 else ramp[2]                           # 빛은 왼쪽
                cv.putpixel((x0 + i, ry + k), c)
    return cv


def wall_front(P, n: int, plan: list, seed: str, roles: dict | None = None):
    """정면 벽 31px 높이 × n칸. plan 은 [("D", x), ("W", x)] — x 는 칸 왼쪽(px). 창·문은 박공 집과 같은 도우미(기준에서 잰 구조)를 쓴다."""
    import landmarks as lm
    wd, pl = P["wood"], P["plaster"]
    w = n * T
    cv = px.new(w, 31)
    px.rect(cv, 0, 0, w - 1, 30, pl[1])
    px.rect(cv, 2, 0, w - 3, 1, wd[1]); px.rect(cv, 2, 2, w - 3, 2, wd[0])   # 처마 보(기준: 주황 2행 + 짙은 갈색 1행)
    px.rect(cv, 8, 3, w - 9, 4, pl[0])                                         # 보 밑 그림자 2행(기준)
    for yy_, c_ in zip(range(24, 29), (wd[1], wd[3], wd[2], wd[2], wd[0])):                                       # 바닥 보 5행(기준)
        px.rect(cv, 8, yy_, w - 9, yy_, c_)
    for x0 in (3, w - 8):                                                                                       # 기둥(기준 5폭)
        lm._post(cv, wd, x0, 3, 30)
    for y in range(0, 31):
        for x in list(range(0, 2)) + list(range(w - 2, w)) + (list(range(2, 3)) + list(range(w - 3, w - 2)) if y >= 3 else []):
            cv.putpixel((x, y), (0, 0, 0, 0))
    wins, doors = [], []
    for kind, x in plan:
        if kind == "W":
            wins.append(lm._window(cv, wd, P["water"][3], P["glass"][4], x, 6))
        else:
            doors.append(lm._arch_door(cv, wd, P["gold"], pl, lm.door_slot(x), 5))
    keep = [(3, 7), (w - 8, w - 4)] + [(d[0], d[2]) for d in doors]
    for yy_ in (29, 30):                                                                                        # 바닥 보 아래 2행: 기둥·문 다리만 남긴다
        for xx_ in range(w):
            if not any(a <= xx_ <= b for a, b in keep):
                cv.putpixel((xx_, yy_), (0, 0, 0, 0))
    lm._drop_shadow(cv, pl[1], pl[0], set())
    for i in range(5):                                                                                          # 모서리 가새: 속이 찬 계단 삼각형
        for k in range(5 - i):
            px.put(cv, 8 + k, 3 + i, wd[1] if k < 5 - i - 1 else wd[0])
            px.put(cv, w - 9 - k, 3 + i, wd[1] if k < 5 - i - 1 else wd[0])
    for d_ in doors:
        lm._door_knob(cv, wd, P["gold"], pl, d_[0], d_[1])
    if roles is not None:
        roles.update({"windows": [[a, b + ROOF_H, c, d + ROOF_H] for a, b, c, d in wins], "doors": [[a, b + ROOF_H, c, d + ROOF_H] for a, b, c, d in doors]})
    return cv


def house(P, roof_key: str, plan: list, n: int, seed: str, roles: dict | None = None):
    roof = roof_flat(P, roof_key, n, seed)
    wall = wall_front(P, n, plan, seed, roles)
    cv = px.new(n * T, HOUSE_H)
    cv.alpha_composite(roof, (0, 0))
    cv.alpha_composite(wall, (0, ROOF_H))
    # 처마 보 아래 연결(지붕 밑 갈색 띠 2px)
    if roles is not None:
        roles["roof_ramp"] = roof_key
        roles["door_kind"] = "wood"
        roles["shadow_rgb"] = list(P["plaster"][0][:3])
        roles["roof_ymax"] = ROOF_H - 1
        ws, ds = roles["windows"], roles["doors"]
        edges = sorted([(a, c) for a, _, c, _ in ws + ds])
        walls, prev = [], 8
        for a, c in edges:
            if a - 3 - (prev + 2) >= 3:
                walls.append([prev + 2, ROOF_H + 10, a - 3, ROOF_H + 21])
            prev = c
        if n * T - 10 - (prev + 2) >= 3:
            walls.append([prev + 2, ROOF_H + 10, n * T - 10, ROOF_H + 21])
        roles["wall"] = walls
        roles["openings"] = [list(r) for r in ws + ds]
    return cv


def cut(im, prefix: str) -> dict[str, "px.Image.Image"]:
    out = {}
    for ry in range(im.height // T):
        for cx in range(im.width // T):
            out[f"{prefix}.{cx}.{ry}"] = im.crop((cx * T, ry * T, cx * T + T, ry * T + T))
    return out
