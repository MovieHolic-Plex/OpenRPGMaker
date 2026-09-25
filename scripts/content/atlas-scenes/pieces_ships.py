"""Ship pieces for build_vehicles: galleon / brig / sloop hulls in several rigs, bow-left and bow-right, sails set or
furled, plus the EasyRPG ship-sheet deck props (keyed) so forest-village maps can graft them too."""
from __future__ import annotations

from PIL import Image

from vehicle_art import Canvas, hull_mask, paint_hull, ship_outline, texture_tile, sheet_tile
from rig_art import paint_mast
from ship_parts import paint_bowsprit, paint_deckhouse, paint_gangway, paint_gunports, paint_stern_lantern

T = 16

# length, beam, bow, stern (tiles); masts: (x offset from the bow tip in tiles, height px, [(yard off, half, h)], nest)
CLASSES = {
    "galleon": dict(length=30, beam=8, bow=7, stern=3, house=(22, 27), masts=[
        (9.5, 8 * T + 8, [(10, 26, 20), (34, 34, 28), (66, 42, 34)], False),
        (16.5, 9 * T + 8, [(10, 28, 22), (36, 38, 30), (70, 46, 38)], True),
        (21.0, 7 * T + 8, [(10, 24, 18), (30, 30, 24), (58, 36, 28)], False)]),
    "brig": dict(length=22, beam=7, bow=6, stern=3, house=(15, 19), masts=[
        (7.5, 7 * T + 8, [(10, 24, 20), (32, 32, 26), (60, 38, 30)], False),
        (13.0, 8 * T, [(10, 26, 20), (34, 34, 28), (64, 40, 32)], True)]),
    "sloop": dict(length=12, beam=5, bow=4, stern=2, house=None, masts=[
        (6.0, 5 * T + 8, [(10, 20, 16), (30, 28, 26)], False)]),
}

RIGS = {
    # name: (sail scheme, emblem, torn, flag, deck texture, gun ports)
    "merchant": ("canvas", "sun", False, "gold", 14, False),
    "warship": ("canvas", "cross", False, "red", 14, True),
    "pirate": ("dark", "skull", True, "black", 14, True),
    "liner": ("sky", "stripes", False, "blue", 13, False),
    "royal": ("royal", "sun", False, "gold", 13, True),
    "fishing": ("patched", None, False, "green", 14, False),
}


CLS_KO = {"galleon": "대형 범선(돛대 셋)", "brig": "중형 범선(돛대 둘)", "sloop": "작은 범선(돛대 하나)"}
RIG_KO = {"merchant": "상선", "warship": "군함", "pirate": "해적선", "liner": "여객선", "royal": "왕실 기함", "fishing": "고깃배"}
PROP_KO = {"cannon-left": "갑판 대포(포구 왼쪽)", "cannon-right": "갑판 대포(포구 오른쪽)", "cannon-down": "갑판 대포(포구 아래)",
           "cannon-up": "갑판 대포(포구 위)", "barrel": "작은 통", "tall-barrel": "큰 물통", "crate": "짐 궤짝", "chest": "선원 궤",
           "jar": "항아리", "table": "둥근 탁자", "stool": "나무 걸상", "bucket": "물 양동이", "anchor": "닻", "rope": "감긴 밧줄",
           "swords": "엇갈린 칼", "helm": "키 손잡이(조타륜)", "helm-side": "조타륜(옆모습)", "lantern": "갑판 등불", "potions": "물약 선반",
           "grate": "갑판 격자 뚜껑", "grate-iron": "쇠 격자 뚜껑", "bookshelf": "선실 책장", "bunk": "선실 침상", "bunk-side": "선실 침상(가로)",
           "flag-red": "붉은 깃발", "banner-gold": "금빛 깃발", "ladder": "사다리", "painting": "액자", "aquarium": "물고기 수조"}


def ship_piece(cls: str, rig: str, furled: bool, bow_right: bool, gangway_on: bool = None) -> dict:
    spec = CLASSES[cls]
    scheme, emblem, torn, flag, deck, ports = RIGS[rig]
    L, B = spec["length"], spec["beam"]
    tallest = max(m[1] for m in spec["masts"])
    above = -(-(tallest + 12 - B * T // 2) // T)          # rows of rig above the top rail
    left = 2                                               # bowsprit room
    w, h = L + left + 1, above + B + 2
    hull, rig_c = Canvas(w * T, h * T), Canvas(w * T, h * T)
    ox, oy = left * T, above * T
    top, bot = ship_outline(L * T, B * T, spec["bow"] * T, spec["stern"] * T, ox, oy, stern="round")
    paint_hull(hull, hull_mask(w * T, h * T, top, bot, 0, w * T), texture_tile(deck))
    mid = oy + (B * T) // 2
    paint_bowsprit(hull, ox + 3, mid, 26 if cls != "sloop" else 18)
    walk, block, doors = set(), set(), []
    if spec["house"]:
        x0, x1 = spec["house"]
        # the wall stands two rows north of the mast-collar row, so the row in front of the door is the free walking
        # lane (collars on the centre row, cannons on the south rail); the roof takes the two rows above the wall
        mid_row = above + B // 2
        roof_y = (mid_row - 4) * T
        door_cell = ((ox // T) + (x0 + x1) // 2, mid_row - 2)
        paint_deckhouse(hull, ox + x0 * T, ox + x1 * T, roof_y, 2 * T, T, door_cell[0] * T + 3,
                        windows=(ox + x0 * T + 6, ox + x1 * T - 12))
        walk.add(door_cell)
        doors.append(list(door_cell))
    if ports:
        paint_gunports(hull, [ox + x * T + 5 for x in range(spec["bow"] + 1, L - spec["stern"] - 1, 3)], oy + B * T + 5)
    paint_stern_lantern(hull, ox + L * T - 6, mid - 5)
    gangway = None
    if gangway_on is None:
        gangway_on = furled
    if gangway_on:
        # boarding plank on the near (south) side, midships: deck edge → rail → hull side → the quay row below the piece
        gx = (ox // T) + (spec["bow"] + L - spec["stern"]) // 2
        paint_gangway(hull, gx * T, oy + (B - 1) * T, h * T)
        for gy in range(above + B - 1, h):
            walk.add((gx, gy))
        gangway = [gx, h - 1]
    for mx, height, sails, nest in spec["masts"]:
        x = ox + int(mx * T) + 8
        paint_mast(rig_c, x, mid, height, sails, scheme=scheme, furled=furled, emblem=emblem, torn=torn, flag=flag, nest=nest)
        block.add((x // T, mid // T))
    deck_keys = {texture_image(deck).tobytes(), texture_image(deck).transpose(Image.FLIP_LEFT_RIGHT).tobytes()}
    state = ("docked" if gangway_on else "furled") if furled else "sailing"
    name = f"ship:{cls}:{rig}:{state}:{'right' if bow_right else 'left'}"
    if bow_right:
        hull.im = hull.im.transpose(Image.FLIP_LEFT_RIGHT)
        rig_c.im = rig_c.im.transpose(Image.FLIP_LEFT_RIGHT)
        flip = lambda c: (w - 1 - c[0], c[1])  # noqa: E731
        walk, block, doors = {flip(c) for c in walk}, {flip(c) for c in block}, [list(flip(c)) for c in doors]
        if gangway:
            gangway = list(flip(gangway))
    return {"name": name, "w": w, "h": h, "hull": hull, "rig": rig_c, "deck": deck_keys, "walk": walk, "block": block,
            "doors": doors, "kind": "ship",
            "label": f"{CLS_KO[cls]} · {RIG_KO[rig]} · {('돛 접음·승선 판자(부두 정박)' if gangway_on else '돛 접음(닻 내림)') if furled else '돛 폄(항해)'} · 뱃머리 {'오른쪽' if bow_right else '왼쪽'}",
            "meta": {"class": cls, "rig": rig, "furled": furled, "bowRight": bow_right, "hullTop": above, "beam": B,
                     "length": L, "bowsprit": left, "gangway": gangway}}


_tex_cache = {}


def texture_image(n: int) -> Image.Image:
    if n not in _tex_cache:
        tex = texture_tile(n)
        im = Image.new("RGBA", (T, T))
        for y in range(T):
            for x in range(T):
                p = tex[y][x]
                im.putpixel((x, y), (p[0], p[1], p[2], 255))
        _tex_cache[n] = im
    return _tex_cache[n]


# EasyRPG ship-sheet deck props (upper layer, keyed): name → (w, h, tiles, passage)
SHEET_PROPS = {
    "cannon-left": (2, 1, [324, 325], "X"), "cannon-right": (2, 1, [354, 355], "X"),
    "cannon-down": (1, 2, [326, 356], "X"), "cannon-up": (1, 2, [327, 357], "X"),
    "barrel": (1, 1, [385], "X"), "tall-barrel": (1, 2, [299, 329], "X"), "crate": (1, 1, [379], "X"),
    "chest": (1, 1, [382], "X"), "jar": (1, 1, [386], "X"), "table": (1, 1, [387], "X"), "stool": (1, 1, [417], "X"),
    "bucket": (1, 1, [415], "X"), "anchor": (1, 1, [259], "X"), "rope": (1, 1, [263], "X"), "swords": (1, 1, [295], "X"),
    "helm": (1, 1, [58], "X"), "helm-side": (1, 1, [59], "X"), "lantern": (1, 1, [119], "X"), "potions": (1, 1, [148], "X"),
    "grate": (1, 1, [202], "O"), "grate-iron": (1, 1, [232], "O"), "bookshelf": (1, 2, [384, 414], "X"),
    "bunk": (1, 2, [416, 446], "X"), "bunk-side": (2, 1, [476, 477], "X"), "flag-red": (1, 1, [288], "X"),
    "banner-gold": (1, 1, [318], "X"), "ladder": (1, 1, [328], "X"), "painting": (1, 1, [358], "X"), "aquarium": (2, 1, [388, 389], "X"),
}


def sheet_props():
    out = []
    for name, (w, h, tiles, passage) in SHEET_PROPS.items():
        c = Canvas(w * T, h * T)
        for k, t in enumerate(tiles):
            c.paste(sheet_tile(t), (k % w) * T, (k // w) * T)
        out.append({"name": f"shipprop:{name}", "w": w, "h": h, "hull": c, "rig": None,
                    "walk": {(x, y) for x in range(w) for y in range(h)} if passage == "O" else set(),
                    "kind": "prop", "label": PROP_KO[name]})
    return out


SAILING = [("galleon", "merchant"), ("galleon", "warship"), ("galleon", "pirate"), ("galleon", "royal"),
           ("brig", "merchant"), ("brig", "pirate"), ("brig", "liner"), ("sloop", "fishing"), ("sloop", "merchant")]
ANCHORED = [("galleon", "warship"), ("galleon", "pirate"), ("sloop", "fishing"), ("brig", "merchant")]
FURLED = [("galleon", "merchant"), ("galleon", "warship"), ("galleon", "pirate"), ("brig", "merchant"), ("sloop", "fishing")]


def pieces():
    out = [ship_piece(cls, rig, False, False) for cls, rig in SAILING]
    out.append(ship_piece("brig", "pirate", False, True))
    out += [ship_piece(cls, rig, True, right) for cls, rig in FURLED for right in (False, True)]
    out += [ship_piece(cls, rig, True, right, False) for cls, rig in ANCHORED for right in (False, True)]
    out.extend(sheet_props())
    return out
