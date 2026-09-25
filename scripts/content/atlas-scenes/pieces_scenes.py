"""Scene pieces for build_vehicles: airship, land vehicles, raft and ferry, justice, festival, arena, gates, sky."""
from __future__ import annotations

from PIL import Image

import scene_art as S
from vehicle_art import Canvas, hull_mask, paint_hull, ship_outline, texture_tile
from rig_art import paint_mast
from ship_parts import paint_bowsprit, paint_deckhouse, paint_stern_lantern
from pieces_ships import texture_image

T = 16


def cells(w, h):
    return {(x, y) for x in range(w) for y in range(h)}


def piece(name, label, w, h, paint, *, rig=None, walk=(), floor=(), block=(), lower_block=(), kind="prop", **extra):
    """paint(c) draws the blocked/solid part; rig(c) the ★ part (walk under)."""
    c = Canvas(w * T, h * T)
    paint(c)
    r = None
    if rig:
        r = Canvas(w * T, h * T)
        rig(r)
    out = {"name": name, "label": label, "w": w, "h": h, "hull": c, "rig": r, "walk": set(walk), "floor": set(floor),
           "block": set(block), "lowerBlock": set(lower_block), "kind": kind}
    out.update(extra)
    return out


def sky_backed(c: Canvas):
    """Fill every transparent pixel with the flat sky colour (pieces that always sit in the sky)."""
    px = c.im.load()
    for y in range(c.h):
        for x in range(c.w):
            if px[x, y][3] == 0:
                px[x, y] = S.SKY[1] + (255,)


def airship(name, label, backed: bool, scheme="canvas"):
    """Airship: brig-like hull (16×5) with deckhouse and a stern propeller, gas envelope above on rigging."""
    L, B = 16, 5
    above = 6
    w, h = L + 4, above + B + 2
    hull, rig = Canvas(w * T, h * T), Canvas(w * T, h * T)
    ox, oy = 2 * T, above * T
    top, bot = ship_outline(L * T, B * T, 4 * T, 3 * T, ox, oy, stern="round", bow_power=1.5)
    paint_hull(hull, hull_mask(w * T, h * T, top, bot, 0, w * T), texture_tile(13))
    mid = oy + (B * T) // 2
    paint_bowsprit(hull, ox + 3, mid, 18)
    mid_row = above + B // 2
    roof_y = (mid_row - 4) * T
    door = ((ox // T) + 11, mid_row - 2)
    paint_deckhouse(hull, ox + 9 * T, ox + 14 * T, roof_y, 2 * T, T, door[0] * T + 3, windows=(ox + 9 * T + 6, ox + 14 * T - 12))
    paint_stern_lantern(hull, ox + L * T - 6, mid - 5)
    # stern propeller on an outrigger (behind the stern, to the right)
    px, py = ox + L * T + 6, mid
    for x in range(ox + L * T - 4, px):
        hull.set(x, py - 1, S.IRON[0])
        hull.set(x, py, S.IRON[1])
    for dy in range(-13, 14):
        for dx in range(-3, 4):
            if (dx / 3.5) ** 2 + (dy / 13.5) ** 2 <= 1:
                hull.set(px + dx, py + dy, (206, 214, 220) if abs(dy) < 11 and dx != 0 else S.IRON[0])
    for dy in range(-2, 3):
        for dx in range(-2, 3):
            hull.set(px + dx, py + dy, S.IRON[1] if abs(dx) + abs(dy) < 3 else S.IRON[0])
    # envelope above, rigging lines down to the rail
    S.paint_envelope(rig, ox + T, 0, L - 2, 5, scheme)
    for (ex, dx) in ((ox + 3 * T, 10), (ox + 7 * T, 0), (ox + 11 * T, 0), (ox + 14 * T, -10)):
        for k in range(0, oy - 4 * T + 12):
            y = 4 * T + 8 + k
            rig.set(ex + int(dx * k / (oy - 4 * T + 12)), y, (90, 70, 50))
    if backed:
        sky_backed(hull)
    deck_keys = {texture_image(13).tobytes(), texture_image(13).transpose(Image.FLIP_LEFT_RIGHT).tobytes()}
    return {"name": name, "label": label, "w": w, "h": h, "hull": hull, "rig": rig, "deck": deck_keys, "walk": {door},
            "block": set(), "doors": [list(door)], "kind": "airship", "skyBacked": backed,
            "meta": {"hullTop": above, "beam": B, "length": L}}


def floating_isle(name, label, w, h, top_rows, seed):
    """Floating rock island baked on sky: flat paved top (walkable), rim, hanging rock underside."""
    c = Canvas(w * T, h * T)
    sky = S.SKY[1]
    tex = texture_tile(367)
    import math
    import random
    rnd = random.Random(seed)
    W, H = w * T, h * T
    cx = W / 2
    top_h = top_rows * T
    for x in range(W):
        u = (x + 0.5 - cx) / (W / 2)
        inset = int(max(0, (abs(u) ** 6) * T))
        depth = int((H - top_h) * (0.25 + 0.75 * (1 - abs(u) ** 1.6)) + rnd.randint(-3, 3))
        for y in range(H):
            col = sky
            if inset <= y < top_h - 3 and x >= 1 and x < W - 1:
                col = tex[y % 16][x % 16][:3]
                if y in (inset, inset + 1) or x in (1, 2, W - 2, W - 3):
                    col = S.STONE[0] if y == inset or x in (1, W - 2) else S.STONE[1]
            elif top_h - 3 <= y < top_h + 2 and x >= 1 and x < W - 1:
                col = S.STONE[2] if y < top_h else S.STONE[3]
            elif top_h + 2 <= y < top_h + 2 + depth and 2 <= x < W - 2:
                v = (y - top_h) / max(depth, 1)
                col = S.STONE[2] if v < 0.2 else (S.STONE[3] if v < 0.65 else S.STONE[4])
                if (x * 3 + y * 5) % 23 == 0:
                    col = S.STONE[1]
                if y == top_h + 1 + depth:
                    col = (40, 40, 52)
            c.set(x, y, col)
    floor = {(x, y) for x in range(1, w - 1) for y in range(0, top_rows - 1)}
    return {"name": name, "label": label, "w": w, "h": h, "hull": c, "rig": None, "floor": floor, "lowerBlock": cells(w, h) - floor,
            "kind": "isle", "meta": {"topRows": top_rows}}


RED_CLOTH = ((236, 110, 96), (214, 70, 58), (170, 44, 40), (90, 20, 20))
GREEN_CLOTH = ((150, 200, 120), (110, 170, 90), (70, 130, 60), (36, 70, 30))


def pieces():
    P = []
    P.append(airship("airship:free", "비공정(하늘 배) · 기구 달린 선체", False))
    P.append(airship("airship:sky", "비공정 · 하늘 위(하늘 바탕 구움)", True))
    P.append(airship("airship:red:sky", "비공정 · 붉은 기구 · 하늘 위", True, "red"))
    P.append(floating_isle("isle:dock", "떠 있는 돌섬 · 부두 자리", 14, 9, 5, 5))
    P.append(floating_isle("isle:small", "떠 있는 작은 돌섬", 8, 6, 3, 9))
    # land vehicles (all blocked)
    P.append(piece("coach:red", "사두 마차(붉은 객차) · 오른쪽", 7, 3, lambda c: S.paint_coach(c, 0, 0, S.RED), kind="vehicle"))
    P.append(piece("coach:blue", "귀족 마차(푸른 객차) · 오른쪽", 7, 3, lambda c: S.paint_coach(c, 0, 0, S.BLUE), kind="vehicle"))
    P.append(piece("coach:red:parked", "객차만(말 풀어 둠) · 붉은", 5, 3, lambda c: S.paint_coach(c, 0, 0, S.RED, with_horses=False), kind="vehicle"))
    P.append(piece("wagon:canvas", "포장마차 · 말 한 필", 6, 3, lambda c: S.paint_wagon(c, 0, 0), kind="vehicle"))
    P.append(piece("wagon:red", "붉은 포장마차 · 말 풀어 둠", 5, 3, lambda c: S.paint_wagon(c, 0, 0, RED_CLOTH, with_horse=False), kind="vehicle"))
    P.append(piece("wagon:green", "초록 포장마차 · 말 한 필", 6, 3, lambda c: S.paint_wagon(c, 0, 0, GREEN_CLOTH), kind="vehicle"))
    for load, ko in (("crates", "궤짝"), ("hay", "건초"), ("pumpkins", "호박")):
        P.append(piece(f"cart:{load}", f"손수레 · {ko}", 3, 2, lambda c, l=load: S.paint_handcart(c, 0, 0, l), kind="vehicle"))
    P.append(piece("horse:right", "말(오른쪽)", 2, 2, lambda c: c.paste(S.horse(True), 0, 0), kind="animal"))
    P.append(piece("horse:left", "말(왼쪽)", 2, 2, lambda c: c.paste(S.horse(False), 0, 0), kind="animal"))
    # water (walkable floors on the upper layer over the water)
    P.append(piece("raft", "통나무 뗏목", 3, 2, lambda c: S.paint_raft(c, 0, 0, 3, 2, pole=False), walk=cells(3, 2), kind="vehicle"))
    P.append(piece("raft:long", "긴 뗏목(나루 줄배)", 4, 3, lambda c: S.paint_raft(c, 0, 0, 4, 3, pole=False), walk=cells(4, 3), kind="vehicle"))
    P.append(piece("plank:h", "건너 판자(가로)", 1, 1, lambda c: S.paint_plank(c, 0, 0, True), walk={(0, 0)}, kind="floor"))
    P.append(piece("plank:v", "건너 판자(세로)", 1, 1, lambda c: S.paint_plank(c, 0, 0, False), walk={(0, 0)}, kind="floor"))
    P.append(piece("ferry", "평저 나룻배(줄배)", 6, 3, lambda c: S.paint_ferry(c, 0, 0), walk=cells(6, 3), kind="vehicle"))
    # justice
    P.append(piece("gallows", "교수대", 4, 5, lambda c: S.paint_gallows(c, 0, 0), kind="landmark"))
    P.append(piece("stocks", "형틀(칼)", 2, 2, lambda c: S.paint_stocks(c, 0, 0), kind="landmark"))
    P.append(piece("block", "처형대 받침과 도끼", 1, 1, lambda c: S.paint_block(c, 0, 0), kind="landmark"))
    # festival
    for colors, ko in ((S.RED, "붉은"), (S.BLUE, "푸른"), (S.GREEN, "초록"), (S.PURPLE, "보라")):
        P.append(piece(f"pavilion:{ko}", f"줄무늬 천막 · {ko}", 3, 3, lambda c, k=colors: S.paint_pavilion(c, 0, 0, k), kind="landmark"))
    for kind, ko in (("left", "왼끝"), ("mid", "가운데"), ("right", "오른끝")):
        P.append(piece(f"list:{kind}", f"마상 창시합 칸막이 · {ko}", 1, 1, lambda c, k=kind: S.paint_list_fence(c, 0, 0, k), kind="fence"))
    P.append(piece("stand:blue", "관람석(푸른 차양)", 6, 4, lambda c: S.paint_stand(c, 0, 0, 6, S.BLUE), kind="landmark"))
    P.append(piece("stand:red", "관람석(붉은 차양)", 6, 4, lambda c: S.paint_stand(c, 0, 0, 6, S.RED), kind="landmark"))
    arch_rig = lambda c: S.paint_arch(c, 0, 0)  # noqa: E731
    P.append(piece("arch:rose", "꽃 아치(결혼식)", 3, 3, lambda c: None, rig=arch_rig, block={(0, 2), (2, 2)}, kind="landmark"))
    for kind, ko in (("v", "세로"), ("h", "가로"), ("end_n", "위끝"), ("end_s", "아래끝")):
        P.append(piece(f"carpet:{kind}", f"붉은 융단 · {ko}", 1, 1, lambda c, k=kind: S.paint_carpet(c, 0, 0, k), walk={(0, 0)}, kind="floor"))
    P.append(piece("garland:lantern", "초롱 줄(머리 위)", 1, 1, lambda c: None, rig=lambda c: S.paint_garland(c, 0, 0, "lantern"), kind="overhead"))
    P.append(piece("garland:bunting", "삼각 깃발 줄(머리 위)", 1, 1, lambda c: None, rig=lambda c: S.paint_garland(c, 0, 0, "bunting"), kind="overhead"))
    P.append(piece("maypole", "오월 기둥(리본)", 1, 3, lambda c: None, rig=lambda c: S.paint_maypole(c, 0, 0), block={(0, 2)}, kind="landmark"))
    P.append(piece("haybale", "짚단", 1, 1, lambda c: S.paint_haybale(c, 0, 0), kind="prop"))
    P.append(piece("pumpkins", "호박 더미", 2, 1, lambda c: S.paint_pumpkins(c, 0, 0), kind="prop"))
    # arena / boss stage
    P.append(piece("brazier", "돌 화로(불)", 1, 2, lambda c: S.paint_brazier(c, 0, 0), kind="prop"))
    P.append(piece("rune:purple", "보랏빛 마법진(3×3)", 3, 3, lambda c: S.paint_rune_circle(c, 0, 0, 3, S.PURPLE), walk=cells(3, 3), kind="floor"))
    P.append(piece("rune:red", "붉은 봉인 마법진(3×3)", 3, 3, lambda c: S.paint_rune_circle(c, 0, 0, 3, S.RED), walk=cells(3, 3), kind="floor"))
    P.append(piece("rune:gold", "금빛 성역 마법진(5×5)", 5, 5, lambda c: S.paint_rune_circle(c, 0, 0, 5, S.GOLD), walk=cells(5, 5), kind="floor"))
    P.append(piece("throne:red", "단 위 옥좌(붉은)", 3, 3, lambda c: S.paint_throne(c, 0, 0, S.RED), kind="landmark"))
    P.append(piece("throne:purple", "단 위 옥좌(보라, 마왕)", 3, 3, lambda c: S.paint_throne(c, 0, 0, S.PURPLE), kind="landmark"))
    # gates, checkpoints
    P.append(piece("barrier", "검문 차단봉", 3, 1, lambda c: S.paint_barrier(c, 0, 0, 3), kind="gate"))
    P.append(piece("booth:red", "초소(붉은 지붕)", 2, 3, lambda c: S.paint_booth(c, 0, 0, S.RED), kind="landmark"))
    P.append(piece("booth:blue", "초소(푸른 지붕)", 2, 3, lambda c: S.paint_booth(c, 0, 0, S.BLUE), kind="landmark"))
    P.append(piece("lighthouse", "줄무늬 등대", 3, 7, lambda c: S.paint_lighthouse(c, 0, -2), walk={(1, 6)}, kind="landmark", doors=[[1, 6]]))
    # sky
    for k in range(3):
        P.append(piece(f"sky:{k}", "하늘", 1, 1, lambda c, v=k: S.paint_sky(c, 0, 0, v), lower_block={(0, 0)}, kind="sky"))
    P.append(piece("cloud:big", "뭉게구름(3×2)", 3, 2, lambda c: None, rig=lambda c: S.paint_cloud(c, 0, 0, 3, 2, 1), kind="sky"))
    P.append(piece("cloud:long", "긴 구름(4×2)", 4, 2, lambda c: None, rig=lambda c: S.paint_cloud(c, 0, 0, 4, 2, 4), kind="sky"))
    P.append(piece("cloud:small", "작은 구름(2×1)", 2, 1, lambda c: None, rig=lambda c: S.paint_cloud(c, 0, 0, 2, 1, 7), kind="sky"))
    return P
