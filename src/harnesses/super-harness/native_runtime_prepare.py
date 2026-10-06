"""Lossless, hash-frozen POTIONS draft authoring. Never approve, publish, or save.

Freeze takes explicit native recipe/contract/actor paths. Pack reads only the frozen
bytes, then rechecks every original before emitting a prepared-not-approved packet.
All raster operations are unmasked crop/copy and transparent padding, never paint.
"""
import argparse
import base64
import hashlib
import io
import json
import math
from pathlib import Path

from PIL import Image

STATES = ("open-stand", "closed-action-1", "locked-action-2", "open-action-3")
MAP_ID = "map_native_potions_classroom"
LIBRARY_ID = "native_potions_classroom"
STATE_SWITCHES = ["hp_class_state_" + str(i) for i in range(1, 4)]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def wire(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def freeze(root, recipes, contract, actors, destination):
    require(not destination.exists(), "Freeze destination must be new")
    files = {}

    def add(path, expected=None):
        path = path.resolve()
        require(path.is_relative_to(root), "Source escaped artwork root: " + str(path))
        data = path.read_bytes()
        digest = sha(data)
        require(expected is None or digest == expected, "Native hash changed: " + str(path))
        previous = files.get(str(path))
        require(previous is None or previous["sha256"] == digest, "Source changed while freezing")
        files[str(path)] = {"sha256": digest, "bytes": len(data)}
        return json.loads(data) if path.suffix == ".json" else None

    recipe_paths = [recipes / (name + ".recipe.json") for name in STATES]
    for path in recipe_paths:
        recipe = add(path)
        for source in recipe["sources"]:
            add(root / source["path"], source["sha256"])
    scene = add(contract)
    add(contract.parent / "scene_recipe_adapter.py")
    actor_pack = add(actors)
    actor_receipt = add(root / actor_pack["receipt"]["path"], actor_pack["receipt"]["sha256"])
    for actor in actor_receipt["actors"]:
        for source in actor["sources"]:
            add(root / source["path"], source["sha256"])
    for asset in actor_pack["assets"].values():
        add(root / asset["file"]["path"], asset["file"]["sha256"])
    add(root / scene["actorActionsManifest"]["path"], scene["actorActionsManifest"]["sha256"])
    # Native slot definitions supply frame order/timing, not a guessed atlas layout.
    slot_paths = {
        "props": root / "art-output/repair-r4-actors-vault/content/tiledata/hand-interior/new/sets.json",
        "effects": root / "art-output/repair-r5-missing-production/content/tiledata/hand-interior/new/sets.json",
        "door": root / "art-output/repair-r9-jamb-projection-prep/content/tiledata/hand-interior/new/sets.json",
    }
    for path in slot_paths.values():
        add(path)
    manifest = {"version": 1, "status": "prepared-not-approved", "artworkRoot": str(root),
                "recipes": [str(p.resolve()) for p in recipe_paths], "contract": str(contract.resolve()),
                "actors": str(actors.resolve()), "slotDefinitions": {k: str(v.resolve()) for k, v in slot_paths.items()},
                "files": files, "approval": None, "runtimePassed": False}
    manifest["inputFingerprint"] = sha(wire(manifest))
    destination.parent.mkdir(parents=True, exist_ok=True)
    write_json(destination, manifest)
    return manifest


class Frozen:
    def __init__(self, manifest):
        self.manifest = manifest
        unsigned = {k: v for k, v in manifest.items() if k != "inputFingerprint"}
        require(sha(wire(unsigned)) == manifest["inputFingerprint"], "Input manifest was edited")
        self.bytes = {}
        for path, record in manifest["files"].items():
            data = Path(path).read_bytes()
            require(sha(data) == record["sha256"], "Frozen source changed: " + path)
            self.bytes[path] = data
        self.images = {}
        self.crops = {}

    def read(self, path):
        return json.loads(self.bytes[str(Path(path).resolve())])

    def source(self, reference):
        path = str((Path(self.manifest["artworkRoot"]) / reference["path"]).resolve())
        require(sha(self.bytes[path]) == reference["sha256"], "Recipe source hash differs")
        return path

    def crop(self, path, rect):
        path = str(Path(path).resolve())
        if path not in self.images:
            self.images[path] = Image.open(io.BytesIO(self.bytes[path])).convert("RGBA")
        image = self.images[path]
        x, y, w, h = rect
        require(all(isinstance(n, int) for n in rect) and min(x, y) >= 0 and min(w, h) > 0
                and x + w <= image.width and y + h <= image.height, "Invalid native crop")
        result = image.crop((x, y, x + w, y + h))
        key = sha(wire([sha(self.bytes[path]), rect]))
        self.crops[key] = {"source": path, "sourceSha256": sha(self.bytes[path]), "rect": rect,
                           "rgbaSha256": sha(result.tobytes()), "size": [w, h]}
        return result, key

    def recheck(self):
        for path, data in self.bytes.items():
            require(sha(Path(path).read_bytes()) == sha(data), "Source changed during preparation: " + path)


def text(body, speaker=None):
    return {"kind": "text", "body": body, **({"speaker": speaker} if speaker else {})}


def switch(id, value):
    return {"kind": "setSwitch", "switchId": id, "value": value}


def choice(options, prompt):
    return {"kind": "choices", "prompt": prompt, "options": [{"text": title, "branch": branch} for title, branch in options],
            "cancelBehavior": "branch", "cancelBranch": []}


def condition(id):
    return {"kind": "switch", "switchId": id, "value": True}


def page(id, graphic=None, commands=None, conditions=None, priority="below", solid=False, trigger="action"):
    return {"id": id, "name": id, "conditions": conditions or [], "graphic": graphic or {"transparent": True},
            "trigger": {"kind": trigger}, "priority": priority, "overlapForbidden": solid,
            "animationType": "fixedGraphic", "movement": {"type": "fixed", "speed": 3, "frequency": 3},
            "commands": commands or []}


def event(id, cell, pages, name=None):
    return {"id": id, "name": name or id, "x": cell[0], "y": cell[1], "trigger": {"kind": "action"},
            "commands": [], "pages": pages}


def graphic(id, pattern=0):
    return {"sprite": {"type": "uploaded", "id": id}, "pattern": pattern, "scale": 1, "scaleMode": "manual"}


class Pack:
    def __init__(self, frozen, out):
        self.frozen, self.out = frozen, out
        self.assets, self.sprites, self.asset_proofs, self.placements = {}, {}, {}, []
        self.tiles, self.tile_defs, self.tile_lookup = [], [], {}
        self.events, self.switch_names = [], {}
        self.out.mkdir(parents=True, exist_ok=False)
        (self.out / "assets").mkdir()

    def asset(self, id, image, kind, meta, proof, name=None):
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        data = buffer.getvalue()
        self.assets[id] = {"id": id, "name": name or id, "kind": kind,
                           "dataUrl": "data:image/png;base64," + base64.b64encode(data).decode(), "meta": meta}
        file = "assets/" + id + ".png"
        (self.out / file).write_bytes(data)
        self.asset_proofs[id] = {"file": file, "sha256": sha(data), "rgbaSha256": sha(image.tobytes()), **proof}

    def sheet(self, name, frames, cell, at, native_anchor=None):
        """Copy unchanged frames into a padded sheet with an instance contact anchor."""
        sizes = {image.size for image, _ in frames}
        require(len(sizes) == 1, "Native animation frame geometry changed")
        w, h = frames[0][0].size
        pivot = [cell[0] * 16 + 8, (cell[1] + 1) * 16]
        ax, ay = pivot[0] - at[0], pivot[1] - at[1]
        left, top = max(0, -ax), max(0, -ay)
        fw, fh = max(w + left, ax + left), max(h + top, ay + top)
        anchor = {"x": ax + left, "y": ay + top}
        signature = {"frames": [key for _, key in frames], "padding": [left, top, fw - w - left, fh - h - top], "anchor": anchor}
        id = "shared_native_potions_" + sha(wire(signature))[:24]
        if id not in self.assets:
            sheet = Image.new("RGBA", (fw * len(frames), fh), (0, 0, 0, 0))
            for index, (image, key) in enumerate(frames):
                sheet.paste(image, (index * fw + left, top))
                actual = sheet.crop((index * fw + left, top, index * fw + left + w, top + h))
                require(actual.tobytes() == image.tobytes(), "Lossless frame copy failed")
            self.asset(id, sheet, "sprite", {"width": sheet.width, "height": sheet.height,
                       "frames": len(frames), "frameWidth": fw, "frameHeight": fh},
                       {**signature, "nativeAnchor": native_anchor, "nativeSize": [w, h], "operation": "unmasked-copy-and-transparent-padding"}, name)
            self.sprites[id] = {"id": id, "image": {"type": "uploaded", "id": id},
                                "frames": len(frames), "frameWidth": fw, "frameHeight": fh, "anchor": anchor}
        self.placements.append({"assetId": id, "cell": cell, "worldTopLeft": at, "runtimePivot": pivot,
                                "nativeAnchor": native_anchor, "runtimeAnchor": anchor, "purpose": name})
        return id

    def tile(self, crop, solid=False, role="native"):
        image, key = crop
        require(image.size == (16, 16), "Tile must be a native16x16 crop")
        lookup = (key, solid)
        if lookup not in self.tile_lookup:
            self.tile_lookup[lookup] = len(self.tiles)
            self.tiles.append(image)
            self.tile_defs.append({"crop": key, "blocked": solid, "role": role})
        return self.tile_lookup[lookup]

    def add_switch(self, id, name=None):
        self.switch_names[id] = name or id
        return id


def pack(manifest, out, stair_destination=None):
    frozen = Frozen(manifest)
    recipes = [frozen.read(path) for path in manifest["recipes"]]
    scene = frozen.read(manifest["contract"])
    actor_pack = frozen.read(manifest["actors"])
    require(scene["viewport"]["groundOffset"] == [0, 32] and scene["viewport"]["grid"] == [23, 14], "Unexpected projection contract")
    require(len(scene["students"]) == 12 and all(len(r["actorInstances"]) == 14 for r in recipes), "All12students/adults are required")
    require(all(r["viewport"] == scene["viewport"] for r in recipes), "Recipe viewport mismatch")
    p = Pack(frozen, out)
    for id in STATE_SWITCHES + ["hp_door_closed", "hp_door_locked", "hp_class_working", "hp_rinsing"]:
        p.add_switch(id)
    offset = scene["viewport"]["groundOffset"]
    sources = [[frozen.source(s) for s in r["sources"]] for r in recipes]
    grid = scene["grid"]
    require(len(grid) == 14 and all(len(row) == 23 for row in grid), "Collision grid must remain23x14")
    blocked = lambda x, y: grid[y][x] in "WvBTDG"
    blank = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    blank_key = sha(blank.tobytes())
    lower = [p.tile((blank, blank_key), blocked(x, y), "transparent-collision-cell") for y in range(14) for x in range(23)]
    wall_layer = [-1] * len(lower)
    other_wall_layer = [-1] * len(lower)

    # Original base actor assets/anchors remain intact; scene instances are separate.
    for id, asset in actor_pack["assets"].items():
        data = frozen.bytes[frozen.source(asset["file"])]
        image = Image.open(io.BytesIO(data)).convert("RGBA")
        (out / "assets" / (id + ".png")).write_bytes(data)
        p.assets[id] = {k: v for k, v in asset.items() if k != "file"}
        p.assets[id]["dataUrl"] = "data:image/png;base64," + base64.b64encode(data).decode()
        p.asset_proofs[id] = {"file": "assets/" + id + ".png", "sha256": sha(data), "source": asset["file"],
                              "operation": "unchanged-verified-native-runtime-pack", "rgbaSha256": sha(image.tobytes())}
    p.sprites.update(actor_pack["sprites"])

    def family(path):
        return Path(path).parent.name

    def is_dynamic(path, op):
        return "/native-actors/" in path or any(key in path for key in ("potion_response", "stair_transition")) \
            or ("arched_prep_door" in path and op["rect"][2:] == [32, 60]) \
            or ("stone_wash" in path and op["rect"][0] < 80)

    static = [[(sources[j][o["source"]], o) for o in r["placements"]
               if not is_dynamic(sources[j][o["source"]], o)] for j, r in enumerate(recipes)]
    require(len({len(s) for s in static}) == 1, "Static recipe operation count changed; explicit refresh required")
    for i, (path, op) in enumerate(static[0]):
        variants = [s[i] for s in static]
        require(all(q[0] == path and q[1]["at"] == op["at"] and q[1]["rect"][2:] == op["rect"][2:] for q in variants),
                "State geometry changed outside native state slots")
        at = [op["at"][a] - offset[a] for a in range(2)]
        rect = op["rect"]
        immutable = all(q[1]["rect"] == rect for q in variants)
        if "stone_floor" in path and rect[2:] == [16, 16] and at[0] % 16 == at[1] % 16 == 0:
            x, y = at[0] // 16, at[1] // 16
            require(immutable and 0 <= x < 23 and 0 <= y < 14, "Native floor lies outside ground")
            lower[y * 23 + x] = p.tile(frozen.crop(path, rect), blocked(x, y), "native-floor")
            p.placements.append({"kind": "tile", "layer": "lower", "cell": [x, y], "source": path, "rect": rect})
            continue
        # Masonry16px cells remain editable wall tiles. Complex tall/offgrid modules
        # retain their complete native alpha as independent sprite events.
        if "stone_wall" in path and rect[2:] == [16, 16] and at[0] % 16 == at[1] % 16 == 0 and immutable:
            x, y = at[0] // 16, at[1] // 16
            if 0 <= x < 23 and 0 <= y < 14:
                layer = wall_layer if wall_layer[y * 23 + x] < 0 else other_wall_layer
                require(layer[y * 23 + x] < 0, "More than two wall cells overlap")
                # The diagram owns collision. A wall's visual tile is also blocked;
                # this cannot accidentally reopen a structural cell.
                require(blocked(x, y), "Masonry placed in a walking cell")
                layer[y * 23 + x] = p.tile(frozen.crop(path, rect), True, "native-wall")
                p.placements.append({"kind": "tile", "layer": "wall", "cell": [x, y], "source": path, "rect": rect})
                continue
        cell = [max(0, min(22, (at[0] + rect[2] // 2) // 16)), max(0, min(13, (at[1] + rect[3] - 1) // 16))]
        support = next((s for s in scene["resolvedTabletopPlacements"]
                        if s["rect"] == [at[0], at[1], at[0] + rect[2], at[1] + rect[3]]), None)
        if support:
            cell = support["groundCell"]
        # Tabletop children share their supporting bench's ground row, so
        # runtime Y-depth preserves bench→utensil→effect ordering.
        cauldron = next((s for s in scene["cauldronAssemblies"]
                         if s["cauldronRect"] == [at[0], at[1], at[0] + rect[2], at[1] + rect[3]]), None)
        if cauldron and "iron_cauldrons" in path:
            cell = cauldron["groundCell"]
        furniture = any(key in path for key in ("work_benches", "prep_bench", "ingredient_storage", "teaching_kit", "iron_cauldrons", "mixing_tools", "botanical_ingredients", "glass_reagents"))
        priority = "same" if furniture else "below"
        frames = [frozen.crop(qpath, qop["rect"]) for qpath, qop in variants]
        sprite = p.sheet(family(path), frames if not immutable else frames[:1], cell, at)
        pages = [page("static_" + str(i) + "_" + str(s), graphic(sprite, s if not immutable else 0),
                      conditions=[] if s == 0 else [condition(STATE_SWITCHES[s - 1])], priority=priority)
                 for s in range(4 if not immutable else 1)]
        p.events.append(event("hp_piece_" + str(i), cell, pages, family(path)))

    # State menus change the full existing native scene, including door/light/pose.
    def set_scene(state):
        return [switch(id, state == i) for i, id in enumerate(STATE_SWITCHES, 1)] + [
            switch("hp_class_working", state > 0), switch("hp_door_closed", state == 1), switch("hp_door_locked", state == 2)]

    scene_menu = choice([(name, set_scene(i)) for i, name in enumerate(STATES)], "교실 상태")
    actor_animations = []
    for i, actor in enumerate(recipes[0]["actorInstances"]):
        actors = [r["actorInstances"][i] for r in recipes]
        require(all(a["role"] == actor["role"] and a["sole"] == actor["sole"] for a in actors), "Actor contact socket moved")
        # Authored collision cells and source soles intentionally differ by16px
        # for students. Padding/instance anchors correct this; originals stay intact.
        cell = scene["teacher"] if actor["role"] == "master" else scene["students"][i - 2] if actor["role"] == "student" else [20, 7]
        frame_images = []
        frame_sources = []
        for j, a in enumerate(actors):
            tl = [a["sole"][k] - a["anchor"][k] for k in range(2)]
            matches = [o for o in recipes[j]["placements"] if o["at"] == tl and o["rect"] == a["rect"] and "/native-actors/" in sources[j][o["source"]]]
            require(len(matches) == 1, "Actor recipe crop did not uniquely resolve")
            path = sources[j][matches[0]["source"]]
            image, crop_id = frozen.crop(path, a["rect"])
            # Align stand/action native anchors in a common48x40 canvas without
            # changing a source pixel. The runtime correction is applied afterward.
            padded = Image.new("RGBA", (48, 40), (0, 0, 0, 0))
            dx, dy = 24 - a["anchor"][0], 31 - a["anchor"][1]
            padded.paste(image, (dx, dy))
            require(padded.crop((dx, dy, dx + image.width, dy + image.height)).tobytes() == image.tobytes(), "Actor copy failed")
            if j == 0:
                frame_images.append((padded, crop_id))
            frame_sources.append({"path": path, "rect": a["rect"], "nativeAnchor": a["anchor"], "padding": [dx, dy], "durationMs": a["durationMs"]})
        at = [actor["sole"][0] - offset[0] - 24, actor["sole"][1] - offset[1] - 31]
        id = "hp_teacher" if actor["role"] == "master" else "hp_assistant" if actor["role"] == "assistant" else "hp_student_" + str(i - 1)
        native_actor = next(a for a in actor_pack["actors"] if a["id"] == "potions-" + actor["role"])
        action_path = frozen.source(actor_pack["assets"][native_actor["action"]]["file"])
        # The actual recipe contact action and shared action delivery must be the
        # same pixels, not two historical versions of one actor.
        require(sha(frozen.bytes[action_path]) == sha(frozen.bytes[frame_sources[1]["path"]]), "Recipe/shared actor action source mismatch")
        raw_receipt_path = Path(frame_sources[1]["path"]).parent.parent / "receipt.json"
        raw_receipt = frozen.read(raw_receipt_path)
        require(raw_receipt["sheet"]["sha256"] == sha(frozen.bytes[action_path]), "Action receipt sheet hash mismatch")
        action_frames = native_actor["actions"]
        require(len(action_frames) == 48 and len(raw_receipt["frames"]) == 48, "Commissioned native action frames missing")
        for delivery, receipt_frame in zip(action_frames, raw_receipt["frames"]):
            require(all(delivery[key] == receipt_frame[key] for key in ("id", "anchor", "durationMs", "direction")), "Native action receipt metadata mismatch")
            require(delivery["anchor"] == [24, 31] and delivery["durationMs"] > 0, "Native action anchor/timing invalid")
            frame_images.append(frozen.crop(action_path, delivery["rect"]))
        sprite = p.sheet(actor["role"] + "-native-instance", frame_images, cell, at, [24, 31])
        busy = p.add_switch(id + "_demonstrating")
        not_busy = {"kind": "switch", "switchId": busy, "value": False}
        pose_options = []
        for action in ("stir", "weigh", "carry", "rinse"):
            directions = []
            for direction in ("up", "right", "down", "left"):
                ordered = [(j + 1, f) for j, f in enumerate(action_frames) if f["id"].startswith(action + "-" + direction + "-")]
                require(len(ordered) == 3, "Native pose does not contain its3ordered frames")
                branch = [switch(busy, True)]
                for pattern, frame in ordered:
                    branch += [{"kind": "setEventGraphicPattern", "eventId": id, "pattern": pattern}, {"kind": "wait", "ms": frame["durationMs"]}]
                branch += [{"kind": "setEventGraphicPattern", "eventId": id, "pattern": 0}, switch(busy, False)]
                directions.append((direction, branch))
            pose_options.append((action, [choice(directions, "원본 행동 방향")]))
        action_menu = choice(pose_options, "원본 행동 시연")
        commands = [text("용액의 변화와 도구 접촉을 관찰하세요.", "마법약 교사"),
                    choice([("교실 상태", [scene_menu]), ("행동 시연", [action_menu])], "마법약 수업")] if actor["role"] == "master" else [action_menu]
        recipe_patterns = [0] + [next(j + 1 for j, f in enumerate(action_frames) if f["id"] == a["pose"] + "-" + str(a["frame"])) for a in actors[1:]]
        pages = [page(id + "_" + str(s), graphic(sprite, recipe_patterns[s]), commands,
                      [] if s == 0 else [condition(STATE_SWITCHES[s - 1])], "same", True) for s in range(4)]
        p.events.append(event(id, cell, pages, actor["role"]))
        pose = actors[1]["pose"]
        ordered = [(j + 1, f) for j, f in enumerate(action_frames) if f["id"].startswith(pose + "-")]
        actor_loop = []
        for pattern, frame in ordered:
            actor_loop += [{"kind": "fork", "condition": not_busy, "then": [{"kind": "setEventGraphicPattern", "eventId": id, "pattern": pattern}]},
                           {"kind": "wait", "ms": frame["durationMs"]}]
        idle = [{"kind": "fork", "condition": not_busy, "then": [{"kind": "setEventGraphicPattern", "eventId": id, "pattern": 0}]},
                {"kind": "wait", "ms": ordered[0][1]["durationMs"]}]
        p.events.append(event(id + "_clock", [1, 2], [page(id + "_idle", commands=idle, trigger="parallel"),
                        page(id + "_work", commands=actor_loop, conditions=[condition("hp_class_working")], trigger="parallel")]))
        actor_animations.append({"eventId": id, "sourceFrames": frame_sources, "nativeActionSource": action_path,
                                 "nativeActionSourceSha256": sha(frozen.bytes[action_path]), "actionReceipt": str(raw_receipt_path),
                                 "commissionedFrames": action_frames, "recipePatterns": recipe_patterns,
                                 "classroomPose": pose, "classroomLoop": True, "actionMenu": "4poses ×4directions ×3nativeframes; once per choice"})

    # Native E/W door geometry, grounded to its authored one-cell threshold.
    door_cell = scene["eventBindings"]["prepDoor"]["origin"]
    door_frames, door_states = [], []
    for state in ("open", "closed", "locked"):
        j = next(i for i, r in enumerate(recipes) if r["doorState"] == state)
        op = next(o for o in recipes[j]["placements"] if "arched_prep_door" in sources[j][o["source"]] and o["rect"][2:] == [32, 60])
        door_frames.append(frozen.crop(sources[j][op["source"]], op["rect"]))
        door_states.append({"state": state, "rect": op["rect"], "source": sources[j][op["source"]], "at": op["at"]})
    door_sprite = p.sheet("E/W preparation door", door_frames, door_cell, [256, 72], [0, 40])
    door_options = [("열기", [switch("hp_door_closed", False), switch("hp_door_locked", False)]),
                    ("닫기", [switch("hp_door_locked", False), switch("hp_door_closed", True)]),
                    ("잠그기", [switch("hp_door_closed", False), switch("hp_door_locked", True)])]
    p.events.append(event("hp_preparation_door", door_cell,
                         [page("door_open", graphic(door_sprite, 0), [choice(door_options, "준비실 문")], priority="same"),
                          page("door_closed", graphic(door_sprite, 1), [choice(door_options, "닫힌 문")], [condition("hp_door_closed")], "same", True),
                          page("door_locked", graphic(door_sprite, 2), [text("문이 잠겨 있습니다."), choice([( "잠금 풀기", [switch("hp_door_locked", False), switch("hp_door_closed", True)])], "문 잠금")], [condition("hp_door_locked")], "same", True)]))

    slot_sets = {name: frozen.read(path)["sets"] for name, path in manifest["slotDefinitions"].items()}
    effect_set = next(s for s in slot_sets["effects"] if s["id"].endswith("potion-response"))
    effect_source = next(path for path in sources[0] if "potion_response" in path)
    response_names = scene["eventBindings"]["potions"]["states"]
    animations = []
    for i, (cell, contact) in enumerate(zip(scene["eventBindings"]["potions"]["origins"], scene["eventBindings"]["potions"]["pixelAnchors"])):
        id = "hp_potion_" + str(i)
        done = p.add_switch(id + "_bottled")
        state_switches = [p.add_switch(id + "_" + name) for name in response_names]
        frames = []
        for name in response_names:
            for key in scene["eventBindings"]["potions"]["slotSequences"][name]:
                slot = next(s for s in effect_set["slots"] if s["key"] == key)
                require(slot["ms"] == 150 and slot["origin"] == [8, 15], "Native potion timing/contact changed")
                frames.append(frozen.crop(effect_source, [slot[k] for k in ("x", "y", "w", "h")]))
        at = [contact[0] - 8, contact[1] - 15]
        sprite = p.sheet("potion-rim-response", frames, cell, at, [8, 15])
        select = lambda state: [switch(done, False)] + [switch(s, j == state) for j, s in enumerate(state_switches)]
        menu = choice([(name, select(j)) for j, name in enumerate(response_names)], "마법약 반응")
        pages, clocks = [], []
        bases = []
        for state, r in enumerate(recipes):
            op = next(o for o in r["placements"] if "potion_response" in sources[state][o["source"]]
                      and o["at"] == [at[0] + offset[0], at[1] + offset[1]])
            base = op["rect"][1] // 16 * 6 + op["rect"][0] // 16
            bases.append(base)
            conds = [] if state == 0 else [condition(STATE_SWITCHES[state - 1])]
            pages.append(page(id + "_scene_" + str(state), graphic(sprite, base), [menu], conds, "same"))
            sequence = [{"kind": "setEventGraphicPattern", "eventId": id, "pattern": base // 6 * 6 + j} for j in range(6)]
            loop = [command for command in sequence for command in (command, {"kind": "wait", "ms": 150})]
            clocks.append(page(id + "_default_clock_" + str(state), commands=loop, conditions=conds, trigger="parallel"))
        for state, name in enumerate(response_names):
            conds = [condition(state_switches[state])]
            pages.append(page(id + "_selected_" + name, graphic(sprite, state * 6), [menu], conds, "same"))
            commands = []
            for frame in range(6):
                commands += [{"kind": "setEventGraphicPattern", "eventId": id, "pattern": state * 6 + frame}, {"kind": "wait", "ms": 150}]
            if name == "bottle":
                commands.append(switch(done, True))
            clocks.append(page(id + "_clock_" + name, commands=commands, conditions=conds, trigger="parallel"))
        pages.append(page(id + "_bottle_hold", graphic(sprite, 35), [menu], [condition(state_switches[-1]), condition(done)], "same"))
        clocks.append(page(id + "_clock_hold", commands=[{"kind": "wait", "ms": 150}], conditions=[condition(state_switches[-1]), condition(done)], trigger="parallel"))
        p.events += [event(id, cell, pages, "마법약 반응"), event(id + "_clock", [1, 2], clocks)]
        animations.append({"eventId": id, "states": response_names, "framesPerState": 6, "durationMs": 150,
                           "loop": scene["eventBindings"]["potions"]["loops"], "bottleEnd": "hold-frame6", "recipePatterns": bases})

    wash_set = next(s for s in slot_sets["props"] if s["id"].endswith("stone-wash"))
    wash_source = next(path for path in sources[0] if "stone_wash" in path)
    wash_frames = [frozen.crop(wash_source, [s[k] for k in ("x", "y", "w", "h")]) for s in wash_set["slots"] if s["key"] in ("idle", "rinse0", "rinse1", "rinse2", "rinse3")]
    require(len(wash_frames) == 5, "Native rinse frames missing")
    wash_cell = scene["eventBindings"]["rinse"]["origin"]
    wash_sprite = p.sheet("stone-wash", wash_frames, wash_cell, [272, 64], [0, 16])
    rinse_menu = [text("돌 세척대에서 도구를 헹굽니다."), switch("hp_rinsing", True)]
    p.events.append(event("hp_rinse", wash_cell, [page("wash_idle", graphic(wash_sprite), rinse_menu, priority="same"),
                      page("wash_rinse", graphic(wash_sprite, 1), conditions=[condition("hp_rinsing")], priority="same")]))
    rinse_loop = []
    for frame in range(1, 5):
        rinse_loop += [{"kind": "setEventGraphicPattern", "eventId": "hp_rinse", "pattern": frame}, {"kind": "wait", "ms": 150}]
    rinse_loop += [switch("hp_rinsing", False), {"kind": "setEventGraphicPattern", "eventId": "hp_rinse", "pattern": 0}]
    p.events.append(event("hp_rinse_clock", [1, 2], [page("rinse_idle_clock", commands=[{"kind": "wait", "ms": 150}], trigger="parallel"),
                    page("rinse_active_clock", commands=rinse_loop, conditions=[condition("hp_rinsing")], trigger="parallel")]))
    animations.append({"eventId": "hp_rinse", "patterns": [1, 2, 3, 4], "durationMs": 150, "loop": False, "end": "idle"})

    # Destination is an explicit external binding, never a pretend local stair.
    stair_set = next(s for s in slot_sets["effects"] if s["id"].endswith("stair-transition"))
    stair_source = next(path for path in sources[0] if "stair_transition" in path)
    stair_frames = [frozen.crop(stair_source, [s[k] for k in ("x", "y", "w", "h")]) for s in stair_set["slots"]]
    stair = scene["eventBindings"]["stairs"]
    stair_sprite = p.sheet("south-stair-transition", stair_frames, stair["origin"], [128, 208], [8, 15])
    stair_commands = [text("연결될 하부 계단실을 기다리고 있습니다. 이 초안의 계단 목적지는 미결정입니다.")]
    if stair_destination is not None:
        require(set(stair_destination) >= {"mapId", "x", "y"}, "Stair destination needs mapId/x/y")
        stair_commands = [{"kind": "transfer", **stair_destination}]
    stair_pages = [page("stairs_" + str(state), graphic(stair_sprite, (0, 1, 2, 0)[state]), stair_commands,
                        [] if state == 0 else [condition(STATE_SWITCHES[state - 1])]) for state in range(4)]
    p.events.append(event("hp_south_stairs", stair["origin"], stair_pages, "하부 계단"))

    atlas = Image.new("RGBA", (16 * 16, math.ceil(len(p.tiles) / 16) * 16), (0, 0, 0, 0))
    for index, image in enumerate(p.tiles):
        atlas.paste(image, ((index % 16) * 16, (index // 16) * 16))
        require(atlas.crop(((index % 16) * 16, (index // 16) * 16, (index % 16 + 1) * 16, (index // 16 + 1) * 16)).tobytes() == image.tobytes(), "Tile copy failed")
    atlas_id = "shared_native_potions_atlas_" + sha(atlas.tobytes())[:24]
    p.asset(atlas_id, atlas, "tileset", {"tileSize": 16, "width": atlas.width, "height": atlas.height},
            {"operation": "lossless-native-floor-wall-tile-packing", "tiles": p.tile_defs})
    tileset_id = "native_potions_floor_wall"
    tileset = {"id": tileset_id, "name": "마법약 교실 원본 바닥·벽", "image": {"type": "uploaded", "id": atlas_id},
               "kind": "custom", "tileSize": 16, "tilesPerRow": 16, "count": len(p.tiles),
               "passability": [{d: not t["blocked"] for d in ("up", "down", "left", "right")} for t in p.tile_defs],
               "priority": ["lower"] * len(p.tiles), "terrain": [0] * len(p.tiles)}
    game_map = {"id": MAP_ID, "name": "마법약 교실", "width": 23, "height": 14, "tileSize": 16,
                "tilesetId": tileset_id, "lowerTiles": lower, "lowerOverlayTiles": [-1] * len(lower),
                "upperTiles": wall_layer, "upperOverlayTiles": other_wall_layer, "events": p.events,
                "visualTopOverhangPx": 32, "encounterRate": 0, "climate": {"mode": "indoor"}}
    library = {"version": 1, "projectDefaults": True, "roots": [], "places": {}, "tilesets": {tileset_id: tileset},
               "assets": p.assets, "sprites": p.sprites, "maps": {MAP_ID: game_map}, "sourceProjectId": "native-potions-draft", "previews": {}}
    player = next(a for a in actor_pack["actors"] if a["id"] == "potions-student")["walk"]
    authored = {"title": "마법약 교실 · 원본 소재 초안", "library": library, "maps": [game_map], "startMapId": MAP_ID,
                "startPos": {"x": 8, "y": 10}, "switches": [{"id": id, "name": name} for id, name in p.switch_names.items()],
                "playerSprite": {"type": "uploaded", "id": player}}
    stair_binding = {"eventId": "hp_south_stairs", "origin": stair["origin"], "destination": stair_destination,
                     "returnDestination": {"mapId": MAP_ID, "x": 8, "y": 12}, "reciprocalRequired": True,
                     "status": "unresolved" if stair_destination is None else "binding-only-external-map-not-in-packet"}
    report = {"version": 1, "status": "prepared-not-approved", "runtimePassed": False, "canonicalReload": False,
              "publicRegistered": False, "libraryId": LIBRARY_ID, "inputFingerprint": manifest["inputFingerprint"],
              "groundGrid": [23, 14], "viewport": scene["viewport"], "states": list(STATES), "actors": actor_animations,
              "animations": animations, "door": door_states, "stairs": stair_binding, "crops": frozen.crops,
              "assets": p.asset_proofs, "placements": p.placements, "collisionDiagram": grid,
              "limitations": ["Current full-scene wall/vault review failed; this is not an approved image pack.",
                              "Stair destination/reciprocal landing remain unresolved; stairs are not complete.",
                              "Y-depth uses runtime cells; eight source assembly bands have no direct schema equivalent.",
                              "Tall wall/duct modules are below actors; furniture uses Y-depth. Exact moving-player occlusion requires runtime visual QA.",
                              "Native contact crops and all12student slots preserved. Padding corrects cell-top soles without modifying common actor definitions.",
                              "Camera requires visualTopOverhangPx support. No added ground rows or flattened scene image."]}
    frozen.recheck()
    write_json(out / "authoring-input.json", authored)
    write_json(out / "library.json", library)
    write_json(out / "preparation-proof.json", report)
    write_json(out / "input-manifest.json", manifest)
    write_json(out / "stair-binding.json", stair_binding)
    return {"packetDir": str(out), "status": report["status"], "inputFingerprint": manifest["inputFingerprint"],
            "maps": [MAP_ID], "assets": len(p.assets), "events": len(p.events), "runtimePassed": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    command = commands.add_parser("freeze")
    for name in ("artwork-root", "recipes", "contract", "actors", "out"):
        command.add_argument("--" + name, type=Path, required=True)
    command = commands.add_parser("pack")
    command.add_argument("--manifest", type=Path, required=True)
    command.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "freeze":
        manifest = freeze(args.artwork_root.resolve(), args.recipes.resolve(), args.contract.resolve(), args.actors.resolve(), args.out.resolve())
        print(json.dumps({"manifest": str(args.out.resolve()), "inputFingerprint": manifest["inputFingerprint"]}))
    else:
        print(json.dumps(pack(json.loads(args.manifest.read_text()), args.out.resolve()), ensure_ascii=False))


if __name__ == "__main__":
    main()
