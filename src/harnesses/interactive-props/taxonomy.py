#!/usr/bin/env python3
"""
5-Axis Master Taxonomy & Auto-Classifier for `interactive-props`.

Axes aligned directly with OPRN Studio (`world.ts`, `genre.ts`, `placementRules.ts`):
  1. world    (single) : fantasy | modern | joseon | murim | desert | snow | pirate | wasteland | dungeon | scifi | steampunk
  2. genres   (multi)  : horror | puzzle-escape | adventure | romance-daily | monster-collect | life-survival | eastern | cyber-scifi
  3. category (single) : door-pass | container | breakable | machine | light-fire | water-env | gimmick | outdoor-ride
  4. zone / mount      : zone = indoor | outdoor | both ; mount = floor | wall | doorway | counter
  5. roles    (multi)  : loot | passage | hide | puzzle-clue | ambient-light | hazard-trap
"""
from __future__ import annotations

from typing import Any

WORLDS = (
    "fantasy",
    "modern",
    "joseon",
    "murim",
    "desert",
    "snow",
    "pirate",
    "wasteland",
    "dungeon",
    "scifi",
    "steampunk",
)

GENRES = (
    "horror",
    "puzzle-escape",
    "adventure",
    "romance-daily",
    "monster-collect",
    "life-survival",
    "eastern",
    "cyber-scifi",
)

CATEGORIES = (
    "door-pass",
    "container",
    "breakable",
    "machine",
    "light-fire",
    "water-env",
    "gimmick",
    "outdoor-ride",
)

ZONES = ("indoor", "outdoor", "both")
MOUNTS = ("floor", "wall", "doorway", "counter")

ROLES = (
    "loot",
    "passage",
    "hide",
    "puzzle-clue",
    "ambient-light",
    "hazard-trap",
)


def _has(hay: str, *words: str) -> bool:
    return any(w in hay for w in words)


def enrich_taxonomy(item: dict[str, Any]) -> dict[str, Any]:
    """
    Populate the 5-axis taxonomy fields (`world`, `genres`, `category`, `zone`, `mount`, `roles`)
    without overriding any field explicitly specified on the item.
    """
    iid = str(item.get("id", "")).lower()
    name = str(item.get("name", "")).lower()
    era = str(item.get("era", "fantasy")).lower()
    motion = str(item.get("motion", "")).lower()
    playback = str(item.get("playback", "")).lower()
    src = str(item.get("sourcePng", "")).lower()
    tags = [str(t).lower() for t in item.get("tags", [])]
    hay = " ".join([iid, name, src, *tags])

    # 1. World (superset of era)
    if "world" not in item:
        if "desert" in iid or "desert-east" in src or "pyramid" in iid:
            world = "desert"
        elif "ice-" in iid or "snow" in iid:
            world = "snow" if "snow" in iid else era
        elif "horror" in iid and _has(hay, "clinic", "hospital", "worklamp", "blink", "mirror_oval", "mannequin", "wheelchair", "stretcher", "e_waste", "syringe"):
            world = "wasteland" if _has(hay, "wasteland", "ruin") else "modern"
        else:
            world = era if era in WORLDS else "fantasy"
        item["world"] = world
    world = item["world"]

    # 2. Category (functional)
    if "category" not in item:
        if iid.startswith("door-") or _has(hay, "door", "gate", "airlock", "hatch", "curtain", "noren", "tent", "barrier", "elevator", "cell-door", "vault-door", "confessional", "개찰구", "차단바"):
            cat = "door-pass"
        elif playback == "break" or motion in ("smash-break", "untie-open") or _has(hay, "smash", "scatter", "sack", "hay"):
            cat = "breakable"
        elif _has(hay, "vending", "kiosk", "arcade", "claw", "terminal", "server", "cryo", "holo", "reactor", "phone", "ticket", "coin-changer", "bottle-return", "battery-swap", "signal-box", "charger", "regulator", "alarm"):
            cat = "machine"
        elif _has(hay, "fire", "flame", "brazier", "torch", "candle", "lamp", "lantern", "oven", "stove", "hwaro", "hwadeok", "forge", "grill", "fishcake", "ramen", "pot", "hyangro", "candelabra"):
            cat = "light-fire"
        elif _has(hay, "fountain", "well", "vane", "turbine", "mill", "clock", "bell", "drum", "shrine-bell"):
            cat = "water-env"
        elif _has(hay, "bookshelf", "seoga", "sarcophagus", "altar", "pedestal", "valve", "sewer-bars", "tomb", "cage", "skull", "spike", "statue", "portrait", "organ", "mirror", "mannequin", "scarecrow", "wheelchair", "stretcher"):
            cat = "gimmick"
        elif _has(hay, "cart", "wagon", "boat", "bike", "car"):
            cat = "outdoor-ride"
        else:
            cat = "container"
        item["category"] = cat
    cat = item["category"]

    # 3. Zone (indoor / outdoor / both) & Mount (floor / wall / doorway / counter)
    if "zone" not in item:
        if _has(hay, "outdoor", "street", "plaza", "fence", "hedge", "paddock", "picket", "cemetery", "parking", "barrier", "well", "campfire", "windmill", "turbine", "vane", "tent", "scarecrow", "lock-sluice", "yeonja", "fishcake", "grill-cart", "wooden-gate", "stone-gate", "phone-booth", "signal-box"):
            zone = "outdoor"
        elif _has(hay, "wardrobe", "dresser", "nightstand", "vanity", "writing-desk", "china-cabinet", "bookshelf", "fireplace", "confessional", "locker", "fridge", "cabinet", "jangnong", "bandaji", "dwiju", "yakjang", "nong", "mungap", "hwajangdae", "seoga", "wall-clock", "portrait", "organ", "chandelier", "photo-curtain", "clinic", "wheelchair", "stretcher", "mannequin", "mirror", "arcade", "claw"):
            zone = "indoor"
        else:
            zone = "both"
        item["zone"] = zone

    if "mount" not in item:
        if cat == "door-pass" and not _has(hay, "tent", "hatch", "confessional"):
            mount = "doorway"
        elif _has(hay, "wall-clock", "wall-torch", "fireplace", "portrait", "niche-skull", "wall-fountain", "fire-hose", "signal-box", "chandelier", "int-mirror", "wall-lantern"):
            mount = "wall"
        elif _has(hay, "cashbox", "sweet-jar", "hyangro", "med-bin", "medical_waste", "candle_shelf"):
            mount = "counter"
        else:
            mount = "floor"
        item["mount"] = mount

    # 4. Roles (gameplay function, multi)
    if "roles" not in item:
        roles: list[str] = []
        if cat == "door-pass" or _has(hay, "bookshelf", "seoga", "hatch", "sewer-bars", "tomb-slab"):
            roles.append("passage")
        if cat in ("container", "breakable") or _has(hay, "sarcophagus", "vending", "claw", "parcel", "cooler", "cashbox", "strongbox", "chest", "drawer", "sack", "hay"):
            roles.append("loot")
        if _has(hay, "wardrobe", "confessional", "locker", "jangnong", "nong", "phone-booth", "photo-curtain", "tent", "cryo", "cabinet", "cage"):
            roles.append("hide")
        if _has(hay, "vault", "strongbox", "bookshelf", "seoga", "altar", "pedestal", "valve", "terminal", "signal", "regulator", "tomb", "portrait", "mirror", "clock", "organ", "mannequin", "skull", "cell", "ruin-sealed"):
            roles.append("puzzle-clue")
        if playback == "loopAfterOpen" or cat in ("light-fire", "water-env") or _has(hay, "lamp", "lantern", "candle", "brazier", "torch", "campfire", "fountain", "bell", "drum"):
            roles.append("ambient-light")
        if _has(hay, "spike", "cage", "scarecrow", "wheelchair", "stretcher", "blink", "alarm", "reactor", "sewer-valve"):
            roles.append("hazard-trap")
        if not roles:
            roles.append("ambient-light")
        item["roles"] = roles

    # 5. Genres (multi-tag aligned with src/ai/v2/request/genre.ts)
    if "genres" not in item:
        g: list[str] = []
        if iid.startswith("horror-") or _has(hay, "horror", "cell", "confessional", "sarcophagus", "skull", "cemetery", "tomb", "cage", "clinic", "stretcher", "wheelchair", "syringe", "mannequin", "mirror", "portrait", "organ", "chandelier", "scarecrow", "candelabra", "angel", "ossuary", "worklamp", "blink", "wall-clock", "sewer", "candle-stand"):
            g.append("horror")
        if _has(hay, "vault", "strongbox", "bookshelf", "seoga", "altar", "pedestal", "valve", "sewer", "ruin", "cell", "tomb", "terminal", "signal", "lock", "puzzle", "비밀", "봉인", "감옥", "금고") or "puzzle-clue" in item["roles"]:
            g.append("puzzle-escape")
        if world in ("fantasy", "desert", "snow", "pirate", "dungeon"):
            g.append("adventure")
        if world == "modern" and not iid.startswith("horror-"):
            g.append("romance-daily")
        if world == "modern" and _has(hay, "vending", "kiosk", "charger", "parcel", "phone", "subway", "heal", "clinic", "arcade", "claw", "locker"):
            g.append("monster-collect")
        if _has(hay, "campfire", "tent", "pot", "well", "mill", "fountain", "paddock", "picket", "hedge", "sack", "hay", "crate", "barrel", "oven", "stove", "grill", "fishcake", "ramen", "scarecrow", "vane", "turbine"):
            g.append("life-survival")
        if world in ("joseon", "murim") or _has(hay, "noren", "shrine", "izakaya", "ramen", "hanji", "palace"):
            g.append("eastern")
        if world in ("scifi", "steampunk"):
            g.append("cyber-scifi")
        if not g:
            g.append("adventure")
        # deduplicate preserving order
        item["genres"] = list(dict.fromkeys(g))

    return item
