"""Explicit hash-bound wandshop draft. Crops/copies only; no approval or save."""
import argparse
import base64
import json
import math
from pathlib import Path

from PIL import Image
from native_runtime_prepare import Frozen, Pack, choice, condition, event, graphic, page, require, sha, switch, text, wire, write_json

MAP = "map_native_wandshop"
LIBRARY = "native_wandshop"
STATE = ["wand_scene_" + str(i) for i in range(1, 4)]


def scene_panel(recipe, state):
    """Review contact sheets contain other times beside the actual room panel."""
    if not recipe.get('panels'):
        require(recipe['canvas'] == [176, 224], 'Unexpected room canvas without panel declarations')
        return recipe
    panels = [p for p in recipe['panels'] if p.get('state') == state and 'responseFrame' not in p]
    require(len(panels) == 1, 'One primary room panel per scene state is required')
    x, y, w, h = panels[0]['bounds']
    require([w, h] == [176, 224], 'Primary room panel dimensions changed')
    placements = []
    for op in recipe['placements']:
        ox, oy = op['at']; ow, oh = op['rect'][2:]
        if ox >= x + w or ox + ow <= x or oy >= y + h or oy + oh <= y:
            continue
        require(x <= ox and y <= oy and ox + ow <= x + w and oy + oh <= y + h,
                'Native placement crosses review panel boundary')
        placements.append({**op, 'at': [ox - x, oy - y]})
    require(bool(placements), 'Room panel has no native placements')
    return {**recipe, 'canvas': [w, h], 'placements': placements, 'runtimePanel': panels[0]}


def response_sheet(pack, frozen, response):
    """Place each unchanged response crop at its authored world anchor."""
    frames, positions = [], []
    for step in response['sequence']:
        crop = frozen.crop(frozen.source(step['nativeSource']), response['slotSourceRects'][step['slot']])
        at = step.get('at', response.get('sheetTopLeftScreen'))
        require(at is not None and len(at) == 2, 'Response frame position missing')
        if 'anchorLocal' in step:
            require([at[i] + step['anchorLocal'][i] for i in range(2)] == step['anchorScreen'],
                    'Response native anchor does not meet its screen contact')
        if 'opaqueBoundsLocal' in step:
            bounds = crop[0].getchannel('A').getbbox()
            require((list(bounds) if bounds else None) == step['opaqueBoundsLocal'], 'Response opaque bounds changed')
        frames.append(crop)
        positions.append([at[0], at[1] - 32])
    left, top = min(p[0] for p in positions), min(p[1] for p in positions)
    width = max(at[0] + frame[0].width for at, frame in zip(positions, frames)) - left
    height = max(at[1] + frame[0].height for at, frame in zip(positions, frames)) - top
    padded = []
    for frame, at in zip(frames, positions):
        offset = [at[0] - left, at[1] - top]
        canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
        canvas.paste(frame[0], offset)
        require(canvas.crop((offset[0], offset[1], offset[0] + frame[0].width, offset[1] + frame[0].height)).tobytes()
                == frame[0].tobytes(), 'Response alignment changed source pixels')
        padded.append((canvas, sha(wire({'crop': frame[1], 'offset': offset, 'size': [width, height]}))))
    require(padded[-1][0].getchannel('A').getbbox() is None, 'Response final frame must be transparent')
    sprite = pack.sheet('wand-native-response', padded, [5, 7], [left, top])
    return sprite, {'frameWorldTopLeft': positions, 'sheetWorldTopLeft': [left, top],
                    'paddedFrameSize': [width, height], 'enabledStateIndices': response.get('enabledStateIndices', [3])}


def freeze(root, recipes, layout, actors, out):
    require(not out.exists(), "Manifest destination must be new")
    files = {}

    def add(path, expected=None):
        path = path.resolve()
        require(path.is_relative_to(root), "Source outside native root")
        data = path.read_bytes()
        require(expected is None or sha(data) == expected, "Native source hash changed: " + str(path))
        require(str(path) not in files or files[str(path)]["sha256"] == sha(data), "Source changed during freeze")
        files[str(path)] = {"sha256": sha(data), "bytes": len(data)}
        return json.loads(data) if path.suffix == ".json" else None

    def references(value):
        if isinstance(value, dict):
            if isinstance(value.get("path"), str) and isinstance(value.get("sha256"), str):
                add(root / value["path"], value["sha256"])
            for child in value.values():
                references(child)
        elif isinstance(value, list):
            for child in value:
                references(child)

    scene_layout = add(layout)
    contract = root / scene_layout["runtimeContract"]
    runtime = add(contract)
    add(contract.parent / "assembly_contract.py")
    # Recursively bind preserved native sources/old recipes and all response slots.
    references(runtime)
    # Assemblers emit either zero-based or one-based four-state filenames.
    start = 0 if (recipes / "space-state-0.recipe.json").exists() else 1
    recipe_paths = [recipes / f"space-state-{i}.recipe.json" for i in range(start, start + 4)]
    require(all(path.is_file() for path in recipe_paths), "Four complete ordered scene recipes required")
    for path in recipe_paths:
        references(add(path))
    actor_pack = add(actors)
    receipt = add(root / actor_pack["receipt"]["path"], actor_pack["receipt"]["sha256"])
    references(receipt)
    for asset in actor_pack["assets"].values():
        references(asset["file"])
    manifest = {"version": 1, "status": "prepared-not-approved", "artworkRoot": str(root),
                "recipes": [str(p.resolve()) for p in recipe_paths], "layout": str(layout), "contract": str(contract),
                "actors": str(actors), "files": files, "approval": None, "runtimePassed": False}
    manifest["inputFingerprint"] = sha(wire(manifest))
    out.parent.mkdir(parents=True, exist_ok=True)
    write_json(out, manifest)
    return manifest


def pack(manifest, out, vacancy_receipt=None):
    if vacancy_receipt:
        from wand_shelf_runtime import bind_manifest
        manifest = bind_manifest(manifest, vacancy_receipt)
    f = Frozen(manifest)
    layout, rt = f.read(manifest["layout"]), f.read(manifest["contract"])
    actors = f.read(manifest["actors"])
    recipes = [scene_panel(f.read(path), i) for i, path in enumerate(manifest["recipes"])]
    require(layout["floorGridSize"] == [11, 12], "Expected11x12ground")
    grid = layout["floorGrid"]
    require(len(grid) == 12 and all(len(row) == 11 for row in grid), "Ground diagram changed")
    p = Pack(f, out)
    for id in STATE + ["wand_response_busy", "wand_actor_busy"]:
        p.add_switch(id)
    blocked = lambda x, y: grid[y][x] in "#BLCsRD"
    empty = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    lower = [p.tile((empty, sha(empty.tobytes())), blocked(x, y), "native-ground-collision") for y in range(12) for x in range(11)]
    upper, overlay = [-1] * 132, [-1] * 132
    operations = []
    sources = [[f.source(s) for s in r["sources"]] for r in recipes]
    excluded = lambda path: "/native-actors/" in path or any(k in path for k in ("wandtrial_response", "wand_response_extra", "wood_shop_doors"))
    statics = [[(sources[j][o["source"]], o) for o in r["placements"] if not excluded(sources[j][o["source"]])] for j, r in enumerate(recipes)]
    # Preserve state-specific native placements, including contact/lift pieces.
    # Align by source + destination geometry, not list index or rectangle count.
    keyed = []
    keys = []
    for entries in statics:
        counts, mapping = {}, {}
        for path, op in entries:
            base = (path, tuple(op["at"]), tuple(op["rect"][2:]))
            occurrence = counts.get(base, 0)
            counts[base] = occurrence + 1
            key = (*base, occurrence)
            mapping[key] = (path, op)
            if key not in keys:
                keys.append(key)
        keyed.append(mapping)
    aligned = [(key, [mapping.get(key) for mapping in keyed]) for key in keys]


    def sprite_piece(name, frames, at, cell, priority="same", patterns=None):
        asset = p.sheet(name, frames, cell, at)
        patterns = patterns or [0] * 4
        pages = [page(name + "_" + str(s), graphic(asset, patterns[s]), conditions=[] if s == 0 else [condition(STATE[s - 1])], priority=priority) for s in range(4)]
        id = "wand_piece_" + str(len(p.events))
        p.events.append(event(id, cell, pages, name))
        return id, asset

    for i, (_, variants) in enumerate(aligned):
        path, op = next(q for q in variants if q is not None)
        at = [op["at"][0], op["at"][1] - 32]
        rect = op["rect"]
        immutable = all(q is not None and q[1]["rect"] == rect for q in variants)
        crop = f.crop(path, rect)
        x, y = at[0] // 16, at[1] // 16
        if rect[2:] == [16, 16] and at[0] % 16 == at[1] % 16 == 0 and 0 <= x < 11 and 0 <= y < 12 and immutable:
            if "aged_dark_boards" in path:
                lower[y * 11 + x] = p.tile(crop, blocked(x, y), "native-floor")
                continue
            if "dark_timber_wall" in path:
                require(blocked(x, y), "Wall crop in walking floor")
                layer = upper if upper[y * 11 + x] < 0 else overlay
                require(layer[y * 11 + x] < 0, "Four layers cannot hold wall overlap")
                layer[y * 11 + x] = p.tile(crop, True, "native-wall")
                continue
        cell = [max(0, min(10, (at[0] + rect[2] // 2) // 16)), max(0, min(11, (at[1] + rect[3] - 1) // 16))]
        priority = "below" if any(k in path for k in ("wall", "ceiling", "lights", "window", "traces")) else "same"
        if any(k in path for k in ("measure_and_record", "third_and_rack")) or ("boxes" in path and op["at"][1] == 73):
            cell[1] = 3
        if any(k in path for k in ("wandtrial_wands", "wandtrial_boxes")) and op["at"][1] == 162:
            cell[1] = 8
        if "wandtrial_shelves" in path and rect[2] == 16:
            # Six depth bands of a connected source: actual ground south edge.
            cell = [1 if at[0] == 16 else 9, max(4, min(9, (op["at"][1] + rect[3]) // 16 - 3))]
        piece_id, _ = sprite_piece(Path(path).parent.name + "_" + str(i), [crop] if immutable else [f.crop(q[0], q[1]["rect"]) if q is not None else
                (Image.new("RGBA", (rect[2], rect[3]), (0, 0, 0, 0)), "absent-native-piece") for q in variants], at, cell, priority,
                     [0] * 4 if immutable else list(range(4)))
        operations.append({"eventId": piece_id, "source": path, "rect": rect, "screenTL": op["at"], "worldTL": at, "cell": cell, "allStates": immutable, "presentStates": [i for i, v in enumerate(variants) if v is not None]})

    # Recover north inventory from its explicit preserved native source, never
    # from a whole room screenshot. Old recipes omitted it; contract binds it.
    north = rt["shelves"]["northPreserved"][0]
    north_rect = rt["shelves"]["northCropXYWH"]
    north_path = f.source(north)
    if not any(path == north_path and o["rect"] == north_rect for path, o in statics[0]):
        sprite_piece("north-preserved-inventory", [f.crop(north_path, north_rect)], [16, -16], [3, 1])

    # Full native common actor byte delivery and anchors travel unchanged.
    for id, asset in actors["assets"].items():
        data = f.bytes[f.source(asset["file"])]
        (out / "assets" / (id + ".png")).write_bytes(data)
        p.assets[id] = {k: v for k, v in asset.items() if k != "file"}
        p.assets[id]["dataUrl"] = "data:image/png;base64," + base64.b64encode(data).decode()
        p.asset_proofs[id] = {"file": "assets/" + id + ".png", "sha256": sha(data), "source": asset["file"], "operation": "unchanged-native-delivery"}
    p.sprites.update(actors["sprites"])
    actor_proofs = []
    actor_events = []
    scene_branches, trial_branches = [], []
    for ai, delivered in enumerate(actors["actors"]):
        require(len(delivered["actions"]) == 18, "All18native actor frames required")
        role = "elder" if ai == 0 else "student"
        id = "wand_" + role
        action_path = f.source(actors["assets"][delivered["action"]]["file"])
        frames = [f.crop(action_path, a["rect"]) for a in delivered["actions"]]
        require(all(a["anchor"] == [24, 31] for a in delivered["actions"]), "Native actor anchor changed")
        old = [next(o for o in r["placements"] if "/native-actors/" in sources[j][o["source"]]
                    and ("elder-wandmaker" if ai == 0 else "trial-student") in sources[j][o["source"]]) for j, r in enumerate(recipes)]
        state_sprites, states = [], []
        for j, op in enumerate(old):
            source = sources[j][op["source"]]
            native_anchor = [12, 31] if op["rect"][2] == 24 else [24, 31]
            sole = [op["at"][0] + native_anchor[0], op["at"][1] + native_anchor[1] - 32]
            cell = [sole[0] // 16, max(0, min(11, sole[1] // 16))]
            native = f.crop(source, op["rect"])
            if native_anchor == [24, 31]:
                preserved = f.crop(action_path, op["rect"])
                require(preserved[0].tobytes() == native[0].tobytes(), "Original12actor frames changed in18frame delivery")
            padded = Image.new("RGBA", (48, 40), (0, 0, 0, 0))
            dx = 24 - native_anchor[0]
            padded.paste(native[0], (dx, 0))
            require(padded.crop((dx, 0, dx + native[0].width, native[0].height)).tobytes() == native[0].tobytes(), "Actor padding changed pixels")
            # Keep an exact recipe frame plus the full18frames at this sole.
            sprite = p.sheet(role + "-state-" + str(j), [(padded, native[1])] + frames, cell, [sole[0] - 24, sole[1] - 31], [24, 31])
            state_sprites.append(sprite)
            states.append({"cell": cell, "sole": sole, "source": source, "rect": op["rect"], "nativeAnchor": native_anchor})
        # Schema pages cannot change event positions; state changes explicitly
        # transfer the same actor to the native new cell and swap instance sheet.
        cell = states[0]["cell"]
        poses = {}
        for j, frame in enumerate(delivered["actions"]):
            poses.setdefault(frame["id"].rsplit("-", 1)[0], []).append((j + 1, frame))
        menus = []
        for pose, ordered in poses.items():
            branch = [switch("wand_actor_busy", True)]
            for pattern, frame in ordered:
                branch += [{"kind": "setEventGraphicPattern", "eventId": id, "pattern": pattern}, {"kind": "wait", "ms": frame["durationMs"]}]
            branch += [{"kind": "setEventGraphicPattern", "eventId": id, "pattern": 0}, switch("wand_actor_busy", False)]
            # Shelf-lift preview at current actor location is explicitly isolated
            # from shelf stock; contextual removal requires a native vacant bed.
            direction = {"up": "뒤쪽", "right": "오른쪽", "down": "앞쪽", "left": "왼쪽"}[pose.rsplit("-", 1)[-1]]
            action = "치수 재기" if pose.startswith("measure-") else "지팡이 들어보기" if pose.startswith("wand-raise-") else "상자 들기 동작"
            menus.append((action + " · " + direction, branch))
        action_menu = choice(menus, "행동 미리보기 · 상자 꺼내기는 선반에서" if manifest.get("vacancy") else "행동 미리보기 · 상자 꺼내기는 준비 중")
        scene_options = []
        for s in range(4):
            commands = []  # Filled after both native actor placements are known.
            scene_branches.append((s, commands))
            scene_options.append((("상담 준비", "상자 잡기", "상자 들어 올리기", "지팡이 시험 준비")[s], commands))
        trial_commands = []
        trial_branches.append(trial_commands)
        commands = [choice([("행동 보기", [action_menu]), ("가게 장면 바꾸기", [choice(scene_options, "가게 장면")]),
                           ("지팡이 시험", trial_commands)], "지팡이 상점")]
        pages = [page(id + "_" + str(s), graphic(sprite), commands,
                      [] if s == 0 else [condition(STATE[s - 1])], "same", True) for s, sprite in enumerate(state_sprites)]
        p.events.append(event(id, cell, pages, delivered["title"]))
        actor_events.append((id, states))
        actor_proofs.append({"eventId": id, "source": action_path, "actions": delivered["actions"], "nativeStatePlacements": states,
                             "limitation": "State2/3 sole changes use the authored dispatcher; contextual shelf availability is recorded separately in shelfBindings."})

    def enter_scene(state):
        # Foreground choices await the real transfers. Mark the dispatcher first
        # so it cannot replace these routes while the menu interpreter waits.
        commands = [switch('wand_response_busy', False)]
        commands += [switch('wand_state_applied_' + str(i), i == state) for i in range(4)]
        commands += [switch(key, state == i) for i, key in enumerate(STATE, 1)]
        for door, status in zip(('entry', 'staff'), rt['fourStates'][state][:2]):
            commands += [switch('wand_' + door + '_closed', status == 'closed'),
                         switch('wand_' + door + '_locked', status == 'locked')]
        for actor_id, states in actor_events:
            cell = states[state]['cell']
            commands.append({'kind': 'moveEvent', 'eventId': actor_id, 'route': {'moves': [
                {'kind': 'npcTransfer', 'mapId': MAP, 'x': cell[0], 'y': cell[1]}], 'repeat': False, 'wait': True}})
            commands.append({'kind': 'setEventGraphicPattern', 'eventId': actor_id, 'pattern': 0})
        return commands

    for state, branch in scene_branches:
        branch[:] = enter_scene(state)
    response_commands = []
    for index, step in enumerate(rt['response']['sequence']):
        response_commands += [{'kind': 'setEventGraphicPattern', 'eventId': 'wand_response', 'pattern': index},
                              {'kind': 'wait', 'ms': step['durationMs']}]
    response_commands += [switch('wand_response_busy', False)]
    for branch in trial_branches:
        # Parallel clocks pause during a foreground interaction. Keep placement
        # and every response frame in this same awaited action interpreter.
        branch[:] = enter_scene(3) + [switch('wand_response_busy', True)] + response_commands

    # A fallback parallel dispatcher responds to external state switch changes. Each page
    # selects actual recipe collision cell; instance anchor retains exact sole.
    for state in range(4):
        applied = p.add_switch("wand_state_applied_" + str(state))
        commands = []
        # Select each native scene's initial door state once; manual door
        # interactions remain live until the next scene state selection.
        for door, status in zip(("entry", "staff"), rt["fourStates"][state][:2]):
            commands += [switch("wand_" + door + "_closed", status == "closed"), switch("wand_" + door + "_locked", status == "locked")]
        for id, states in actor_events:
            cell = states[state]["cell"]
            commands.append({"kind": "moveEvent", "eventId": id, "route": {"moves": [{"kind": "npcTransfer", "mapId": MAP, "x": cell[0], "y": cell[1]}], "repeat": False, "wait": True}})
        commands += [switch("wand_state_applied_" + str(s), s == state) for s in range(4)]
        conds = ([] if state == 0 else [condition(STATE[state - 1])]) + [{"kind": "switch", "switchId": applied, "value": False}]
        # Statezero must additionally exclude all3state switches.
        if state == 0:
            conds += [{"kind": "switch", "switchId": key, "value": False} for key in STATE]
        p.events.append(event("wand_state_dispatch_" + str(state), [2, 4], [page("dispatch_idle", commands=[{"kind": "wait", "ms": 100}], trigger="parallel"),
                        page("dispatch_active", commands=commands, conditions=conds, trigger="parallel")]))

    door_proofs = []
    door_path = next(path for path in sources[0] if "wood_shop_doors" in path)
    for name in ("entry", "staff"):
        door = rt["doors"][name]
        for state in ("closed", "locked"):
            p.add_switch("wand_" + name + "_" + state)
        slots = [0, 32, 64] if name == "entry" else [96, 128, 160]
        door_frames = [f.crop(door_path, [x, 0, 32, 48]) for x in slots]
        sprite = p.sheet(name + "-door", door_frames, door["cell"], [door["sheetTopLeft"][0], door["sheetTopLeft"][1] - 32], [16, 40])
        options = [(label, [switch("wand_" + name + "_closed", state == "closed"), switch("wand_" + name + "_locked", state == "locked")]) for state, label in (("open", "열기"), ("closed", "닫기"), ("locked", "잠그기"))]
        pages = [page(name + "_open", graphic(sprite), [choice(options, "문")], priority="same"),
                 page(name + "_closed", graphic(sprite, 1), [choice(options, "닫힌 문")], [condition("wand_" + name + "_closed")], "same", True),
                 page(name + "_locked", graphic(sprite, 2), [text("잠겨 있습니다."), choice([( "잠금 해제", [switch("wand_" + name + "_locked", False), switch("wand_" + name + "_closed", True)])], "잠금")], [condition("wand_" + name + "_locked")], "same", True)]
        p.events.append(event("wand_" + name + "_door", door["cell"], pages))
        door_proofs.append({"door": name, "source": door_path, "slots": slots, "cell": door["cell"], "externalDestination": None if name == "entry" else "staff area in same map"})

    response = rt["response"]
    require(len(response["sequence"]) == 8, "All8responseframesrequired")
    sprite, response_binding = response_sheet(p, f, response)
    require(response_binding['enabledStateIndices'] == [3], 'Response must be restricted to the trial scene')
    p.events.append(event("wand_response", [5, 7], [page("response_hidden", graphic(sprite, 7), priority="same"),
        page("response_active", graphic(sprite, 0), conditions=[condition(STATE[2]), condition('wand_response_busy')], priority="same")]))
    shelf_bindings = {"status": "blocked-native-vacancy-required", "contacts": rt["shelves"]["boxContacts"],
                      "reason": "Current shelf stock is baked into sheet. No native empty-bed crop exists to remove the held box without drawing/duplicate stock.",
                      "required": "hash-bound vacant native shelf slot or layered native shelf+box originals; then contextual actor contact/lift can bind its same18frame delivery"}
    for side, cell in (("west", [2, 6]), ("east", [8, 6])):
        p.events.append(event("wand_shelf_" + side, cell, [page(side + "_shelf", commands=[text("길쭉한 지팡이 상자들이 놓여 있습니다. 상자를 꺼내는 동작은 아직 준비 중입니다.")])]))
    if manifest.get("vacancy"):
        from wand_shelf_runtime import attach
        shelf_bindings = attach(p, f, actors, actor_proofs, operations, MAP)
    atlas = Image.new("RGBA", (256, math.ceil(len(p.tiles) / 16) * 16), (0, 0, 0, 0))
    for i, image in enumerate(p.tiles):
        atlas.paste(image, (i % 16 * 16, i // 16 * 16))
    atlas_id = "shared_wand_native_atlas_" + sha(atlas.tobytes())[:24]
    p.asset(atlas_id, atlas, "tileset", {"tileSize": 16, "width": atlas.width, "height": atlas.height}, {"tiles": p.tile_defs, "operation": "lossless-native-crop-atlas"})
    tileset = {"id": "native_wandshop_floor_wall", "name": "지팡이 상점 원본 바닥·벽", "image": {"type": "uploaded", "id": atlas_id},
               "kind": "custom", "tileSize": 16, "tilesPerRow": 16, "count": len(p.tiles),
               "passability": [{d: not q["blocked"] for d in ("up", "down", "left", "right")} for q in p.tile_defs],
               "priority": ["lower"] * len(p.tiles), "terrain": [0] * len(p.tiles)}
    game_map = {"id": MAP, "name": "올리밴더 지팡이 상점", "width": 11, "height": 12, "tileSize": 16,
                "tilesetId": tileset["id"], "lowerTiles": lower, "upperTiles": upper, "lowerOverlayTiles": [-1] * 132,
                "upperOverlayTiles": overlay, "events": p.events, "visualTopOverhangPx": 32, "encounterRate": 0, "climate": {"mode": "indoor"}}
    library = {"version": 1, "projectDefaults": True, "roots": [], "places": {}, "tilesets": {tileset["id"]: tileset}, "assets": p.assets,
               "sprites": p.sprites, "maps": {MAP: game_map}, "sourceProjectId": "native-wand-draft", "previews": {}}
    authored = {"title": "올리밴더 지팡이 상점 · 원본 초안", "library": library, "maps": [game_map], "startMapId": MAP,
                "startPos": {"x": 6, "y": 10}, "switches": [{"id": key, "name": name} for key, name in p.switch_names.items()],
                "fieldHud": {"theme": "minimal", "vitals": False, "clock": False, "tools": False, "objective": False, "hideEmpty": True, "widgets": []},
                "playerSprite": {"type": "uploaded", "id": next(a for a in actors["actors"] if a["id"] == "trial-student")["walk"]}}
    report = {"version": 1, "status": "prepared-not-approved", "libraryId": LIBRARY, "inputFingerprint": manifest["inputFingerprint"],
              "runtimePassed": False, "canonicalReload": False, "publicRegistered": False, "groundGrid": [11, 12], "groundOffset": [0, 32],
              "actors": actor_proofs, "doors": door_proofs, "response": response, "responseBinding": response_binding, "shelfBindings": shelf_bindings,
              "roomPanels": [r.get('runtimePanel', {'bounds': [0, 0, 176, 224], 'state': i}) for i, r in enumerate(recipes)],
              "sources": manifest["files"], "crops": f.crops, "assets": p.asset_proofs, "placements": p.placements,
              "limitations": ["Frozen four-state source recipes bound; whole-scene approval is separate from runtime preparation.",
                              ("Reviewed native shelf removal bound; actual runtime QA still required." if manifest.get('vacancy') else "Contextual shelf removal blocked: native vacant-bed slot absent."),
                              "Entry external destination remains unbound; staff door opens actual same-map northern area.",
                              "Camera north headroom supported; source entry threshold extends to188worldpx within192mapheight.",
                              "Y-depth and offgrid actor sole/cell corrections require actual runtime visual QA."]}
    f.recheck()
    for name, value in (("input-manifest.json", manifest), ("authoring-input.json", authored), ("library.json", library),
                        ("preparation-proof.json", report), ("shelf-binding.json", shelf_bindings)):
        write_json(out / name, value)
    return {"packetDir": str(out), "assets": len(p.assets), "events": len(p.events), "inputFingerprint": manifest["inputFingerprint"], "runtimePassed": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    freeze_parser = commands.add_parser("freeze")
    for name in ("artwork-root", "recipes", "layout", "actors", "out"):
        freeze_parser.add_argument("--" + name, required=True, type=Path)
    pack_parser = commands.add_parser("pack")
    for name in ("manifest", "out"):
        pack_parser.add_argument("--" + name, required=True, type=Path)
    pack_parser.add_argument("--vacancy-receipt", type=Path)
    args = parser.parse_args()
    if args.command == "freeze":
        result = freeze(args.artwork_root.resolve(), args.recipes.resolve(), args.layout.resolve(), args.actors.resolve(), args.out.resolve())
        print(json.dumps({"manifest": str(args.out.resolve()), "inputFingerprint": result["inputFingerprint"]}))
    else:
        print(json.dumps(pack(json.loads(args.manifest.read_text()), args.out.resolve(), args.vacancy_receipt)))


if __name__ == "__main__":
    main()
