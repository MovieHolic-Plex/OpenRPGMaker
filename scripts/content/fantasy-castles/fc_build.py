#!/usr/bin/env python3
"""fantasy_castles 변환기 — 손 도트 타일맵(스톰베일 절벽 성·헬름 협곡 요새)을 공용 칩셋 하나 + 편집기 맵 JSON 으로 굽는다.

입력(맵마다 한 폴더, building-kit 3판 BRIEF-r3 「타일맵으로 낸다」 계약):
  tileset.png   고유 16px RGBA 칸 시트(열 tilesetColumns)
  map.json      {w,h,tileSize,tilesetColumns,layers:{ground,ground_over,object,object_over}(행 배열, -1 빈칸),
                 walk:["OOXX..."], pieces:[{id,x,y,w,h,layer}]}
  pieces.json   조각 이름 → 층별 칸 배열·크기·통행 (키트 원본; 형식이 다르면 map.json 의 배치로 대신 자른다)
  composite.png 네 층 합성 그림(정답 그림)

출력(대기 구역 — 3/4 관문을 통과하기 전에는 번들·공용 DB·맵·스토어에 넣지 않는다, AGENTS.md):
  <data>/cell-ledger.json            칸 장부(덧붙이기 전용 — 한 번 나간 번호는 다시 매기지 않는다)
  <data>/build/fantasy-castles-chipset.png, fantasyCastlesSheet.json, fantasyCastlesTileset.json
  <data>/maps/<mapId>.json           편집기 GameMap 모양(lowerTiles/lowerOverlayTiles/upperTiles/upperOverlayTiles) + walk
  <data>/build-stats.json

층 → 엔진 층: ground→lowerTiles(1층) · ground_over→lowerOverlayTiles(2층) · object→upperTiles(3층) · object_over→upperOverlayTiles(4층).
칸 통행(엔진 collision.ts: 위에서부터 ★ 를 건너뛴 첫 칸이 정하고, 1층은 그 자체로 정한다):
  object_over 칸 = ★(걸음 + priority upper) — 캐릭터가 그 밑을 지나 뒤로 걷는다.
  그 칸을 「정하는」 층(object → ground_over → ground 중 맨 위)의 칸 = 그 칸 walk 값(O 걸음 / X 막힘), priority lower.
  정하지 않는 아래층 칸은 통행이 무관하다 — 같은 그림의 정하는 쓰임이 있으면 그 값을 따르고, 없으면 바닥 O · 물체 X.
같은 그림이 다른 통행으로 쓰이면 칸을 나눈다(칸 키 = 그림 해시 + 통행 + priority + 홈 층).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from collections import Counter, defaultdict

import numpy as np
from PIL import Image

T = 16
LAYERS = ("ground", "ground_over", "object", "object_over")
ENGINE = {"ground": "lowerTiles", "ground_over": "lowerOverlayTiles", "object": "upperTiles", "object_over": "upperOverlayTiles"}
LAYER_KO = {"ground": "바닥(1층)", "ground_over": "바닥 장식(2층)", "object": "물체(3층)", "object_over": "캐릭터 위(4층)"}
HOME = {"ground": "lower", "ground_over": "upper", "object": "upper", "object_over": "upper"}
GROUP_ROLE = {"ground": "terrain", "ground_over": "terrain", "object": "castle", "object_over": "roof"}
TILESET_ID = "fantasy_castles"
TEXTURE = "tex_fantasy_castles"
FAMILY = "oprn-fantasy-castles"
PREFIX = "fc-"
NAME = "판타지 성채 · 스톰베일·헬름 협곡 (손 도트)"
LEDGER_SCHEMA = "oprn-fantasy-castles-ledger/1"
MAX_SHEET_H = 4096


class BuildError(Exception):
    pass


def load_rgba(path):
    with Image.open(path) as im:
        return np.array(im.convert("RGBA"))


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _grid(v, w, h, what):
    if v is None:
        return [[-1] * w for _ in range(h)]
    if isinstance(v, list) and len(v) == w * h and all(isinstance(q, int) for q in v):
        return [v[y * w:(y + 1) * w] for y in range(h)]
    if isinstance(v, list) and len(v) == h:
        rows = [list(r) for r in v]
        if all(len(r) == w for r in rows):
            return [[int(q) for q in r] for r in rows]
    raise BuildError(f"{what}: {w}x{h} 격자가 아니다")


def _walk(v, w, h):
    rows = []
    for r in v:
        if isinstance(r, str):
            rows.append([c in "Oo1" for c in r])
        else:
            rows.append([bool(q) if not isinstance(q, str) else q in ("O", "o", "1") for q in r])
    if len(rows) != h or any(len(r) != w for r in rows):
        raise BuildError(f"walk: {w}x{h} 가 아니다")
    return rows


def load_source(src_dir: str, map_id: str, name: str) -> dict:
    mj = read_json(os.path.join(src_dir, "map.json"))
    w, h = int(mj.get("w") or mj.get("width")), int(mj.get("h") or mj.get("height"))
    if int(mj.get("tileSize", T)) != T:
        raise BuildError(f"{map_id}: tileSize {mj.get('tileSize')} != 16")
    sheet = load_rgba(os.path.join(src_dir, "tileset.png"))
    cols = int(mj.get("tilesetColumns") or sheet.shape[1] // T)
    layers_in = mj.get("layers") or {}
    alias = {"ground": ("ground", "lower", "layer1"), "ground_over": ("ground_over", "groundOver", "lower_overlay", "layer2"),
             "object": ("object", "objects", "upper", "layer3"), "object_over": ("object_over", "objectOver", "upper_overlay", "layer4")}
    layers = {}
    for L in LAYERS:
        key = next((k for k in alias[L] if k in layers_in), None)
        layers[L] = _grid(layers_in.get(key) if key else None, w, h, f"{map_id}.{L}")
    walk = _walk(mj["walk"], w, h)
    pieces_path = os.path.join(src_dir, "pieces.json")
    pieces = read_json(pieces_path) if os.path.exists(pieces_path) else {}
    comp_path = os.path.join(src_dir, "composite.png")
    composite = load_rgba(comp_path) if os.path.exists(comp_path) else None
    n_cells = (sheet.shape[0] // T) * cols

    def cell(i):
        if i < 0 or i >= n_cells:
            raise BuildError(f"{map_id}: 칸 번호 {i} 가 시트({n_cells}칸) 밖")
        y, x = divmod(i, cols)
        return sheet[y * T:(y + 1) * T, x * T:(x + 1) * T]

    return dict(id=map_id, name=name, dir=src_dir, w=w, h=h, layers=layers, walk=walk, placements=mj.get("pieces") or [],
                pieces=pieces, composite=composite, cell=cell, routes=mj.get("routes"))


def sha_of(px: np.ndarray) -> str:
    a = np.ascontiguousarray(px.astype(np.uint8))
    a = a.copy()
    a[a[..., 3] == 0] = 0          # 완전 투명 화소의 RGB 는 그림이 아니다
    return hashlib.sha256(a.tobytes()).hexdigest()


def key_of(sha, pas, prio, home):
    return f"{sha}|{pas}|{prio}|{home}"


class Ledger:
    def __init__(self, path):
        self.path = path
        if os.path.exists(path):
            d = read_json(path)
            if d.get("schema") != LEDGER_SCHEMA:
                raise BuildError(f"장부 형식이 다르다: {d.get('schema')}")
            self.cells = d["cells"]
            self.frozen = int(d.get("frozen", 0))
        else:
            self.cells, self.frozen = [], 0
        self.index = {key_of(c["sha"], c["pass"], c["prio"], c["home"]): i for i, c in enumerate(self.cells)}
        self.prev_count = len(self.cells)

    def id_for(self, sha, pas, prio, home, origin):
        k = key_of(sha, pas, prio, home)
        if k not in self.index:
            self.index[k] = len(self.cells)
            self.cells.append(dict(sha=sha, **{"pass": pas}, prio=prio, home=home, origin=origin))
        return self.index[k]

    def save(self):
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(dict(schema=LEDGER_SCHEMA, tileSize=T, frozen=self.frozen, count=len(self.cells),
                           note="덧붙이기 전용. 앞 frozen 칸은 번들로 나갔다 — 번호·그림·통행을 바꾸지 않는다. 새 칸은 끝에만 붙는다.",
                           cells=self.cells), f, ensure_ascii=False, indent=0)
            f.write("\n")


def deciding_layer(src, x, y):
    for L in ("object", "ground_over", "ground"):
        if src["layers"][L][y][x] >= 0:
            return L
    return None


def plan_map(src):
    shas = {}
    use = {}
    for y in range(src["h"]):
        for x in range(src["w"]):
            dec = deciding_layer(src, x, y)
            if dec is None:
                raise BuildError(f"{src['id']}: ({x},{y}) 에 바닥 칸이 없다(ground 빈칸)")
            if src["layers"]["ground"][y][x] < 0:
                raise BuildError(f"{src['id']}: ({x},{y}) ground 빈칸 — 1층이 비면 엔진은 막힘으로 본다")
            for L in LAYERS:
                i = src["layers"][L][y][x]
                if i < 0:
                    continue
                if i not in shas:
                    shas[i] = sha_of(src["cell"](i))
                px = src["cell"](i)
                if L == "ground" and (px[..., 3] < 255).any():
                    raise BuildError(f"{src['id']}: ({x},{y}) ground 칸 {i} 이 불투명하지 않다")
                if L == "object_over":
                    need = "S"
                elif L == dec:
                    need = "O" if src["walk"][y][x] else "X"
                else:
                    need = None
                use[(L, x, y)] = (shas[i], need)
    return use, shas


def default_need(L):
    return "X" if L == "object" else "O"


def resolve(srcs, ledger):
    plans = {s["id"]: plan_map(s) for s in srcs}
    # 그림·홈마다 정하는 쓰임의 통행 빈도 — 정하지 않는 쓰임은 가장 흔한 것을 따른다
    seen = defaultdict(Counter)
    for s in srcs:
        for (L, x, y), (sha, need) in plans[s["id"]][0].items():
            if need in ("O", "X"):
                seen[(sha, HOME[L], L == "object_over")][need] += 1
    out = {}
    split = Counter()
    for s in srcs:
        use, _ = plans[s["id"]]
        grids = {L: [[-1] * s["w"] for _ in range(s["h"])] for L in LAYERS}
        for (L, x, y), (sha, need) in sorted(use.items(), key=lambda kv: (kv[0][2], kv[0][1], LAYERS.index(kv[0][0]))):
            if need is None:
                c = seen.get((sha, HOME[L], False))
                need = c.most_common(1)[0][0] if c else default_need(L)
            if need == "S":
                pas, prio = "O", "upper"
            else:
                pas, prio = need, "lower"
            grids[L][y][x] = ledger.id_for(sha, pas, prio, HOME[L], f"{s['id']}:{L}")
        out[s["id"]] = grids
    for (sha, home, _), c in seen.items():
        if len(c) > 1:
            split[home] += 1
    return out, plans, dict(split)


def sheet_cols(n, base=32):
    cols = base
    while ((n + cols - 1) // cols) * T > MAX_SHEET_H:
        cols += 8
    return cols


def build_sheet(ledger, pixel_of_sha, prev_sheet_path, prev_cols):
    n = len(ledger.cells)
    cols = sheet_cols(n)
    rows = max(1, (n + cols - 1) // cols)
    img = np.zeros((rows * T, cols * T, 4), np.uint8)
    prev = load_rgba(prev_sheet_path) if prev_sheet_path and os.path.exists(prev_sheet_path) else None
    orphans = 0
    for i, c in enumerate(ledger.cells):
        px = pixel_of_sha.get(c["sha"])
        if px is None:
            if prev is None or i >= ((prev.shape[0] // T) * prev_cols):
                raise BuildError(f"칸 {i}: 그림을 찾을 수 없다(입력에도 이전 시트에도 없음) — 장부가 이전 시트와 함께 다녀야 한다")
            y0, x0 = divmod(i, prev_cols)
            px = prev[y0 * T:(y0 + 1) * T, x0 * T:(x0 + 1) * T]
            orphans += 1
        if sha_of(px) != c["sha"]:
            raise BuildError(f"칸 {i}: 그림 해시가 장부와 다르다(동결 위반)")
        y, x = divmod(i, cols)
        img[y * T:(y + 1) * T, x * T:(x + 1) * T] = px
    return img, cols, orphans


def cell_px(sheet, cols, i):
    y, x = divmod(i, cols)
    return sheet[y * T:(y + 1) * T, x * T:(x + 1) * T]


def engine_pass(ledger, grids, x, y):
    def star(i):
        c = ledger.cells[i]
        return c["pass"] == "O" and c["prio"] == "upper"
    l1 = grids["ground"][y][x]
    if l1 < 0:
        return False
    for L in ("object_over", "object", "ground_over"):
        i = grids[L][y][x]
        if i < 0 or star(i):
            continue
        return ledger.cells[i]["pass"] == "O"
    return ledger.cells[l1]["pass"] == "O"


def render(grids, sheet, cols, w, h):
    out = np.zeros((h * T, w * T, 4), np.float64)
    for L in LAYERS:
        for y in range(h):
            for x in range(w):
                i = grids[L][y][x]
                if i < 0:
                    continue
                px = cell_px(sheet, cols, i).astype(np.float64)
                a = px[..., 3:4] / 255.0
                dst = out[y * T:(y + 1) * T, x * T:(x + 1) * T]
                dst[..., :3] = np.round(px[..., :3] * a + dst[..., :3] * (1 - a))
                dst[..., 3:4] = np.maximum(dst[..., 3:4], px[..., 3:4])
    return out.astype(np.uint8)


def diff_stats(a, b):
    if a.shape != b.shape:
        return dict(sameSize=False, got=list(a.shape), want=list(b.shape))
    d = np.abs(a[..., :3].astype(int) - b[..., :3].astype(int)).max(axis=2)
    return dict(sameSize=True, pixels=int(d.size), differing=int((d > 0).sum()), maxDelta=int(d.max()))


def _piece_entries(src):
    """pieces.json 을 [(이름, {w,h,layers:{L:격자}, walk:격자|None, desc})] 로. 모르는 모양이면 map.json 배치로 자른다."""
    p = src["pieces"]
    items = []
    if isinstance(p, dict) and isinstance(p.get("pieces"), (dict, list)):
        p = p["pieces"]
    if isinstance(p, list):
        p = {str(q.get("id") or q.get("name")): q for q in p if isinstance(q, dict)}
    for name, q in (p or {}).items():
        if not isinstance(q, dict):
            continue
        size = q.get("size")
        if isinstance(size, dict):
            size = [size.get("w"), size.get("h")]
        w = q.get("w") or (size or [None, None])[0]
        h = q.get("h") or (size or [None, None])[1]
        lay = q.get("layers") or {k: q[k] for k in LAYERS if k in q}
        if not w or not h or not lay:
            continue
        try:
            grids = {L: _grid(lay.get(L), int(w), int(h), f"{src['id']}/{name}.{L}") for L in LAYERS}
            walk = _walk(q["walk"], int(w), int(h)) if q.get("walk") else None
        except BuildError:
            continue
        items.append((name, dict(w=int(w), h=int(h), layers=grids, walk=walk, desc=q.get("desc") or q.get("description") or "")))
    if items:
        return items, "pieces.json"
    seen = set()
    for pl in src["placements"]:
        name = str(pl.get("id"))
        if name in seen:
            continue
        seen.add(name)
        x0, y0, w, h = int(pl["x"]), int(pl["y"]), int(pl["w"]), int(pl["h"])
        grids = {L: [[src["layers"][L][y0 + dy][x0 + dx] for dx in range(w)] for dy in range(h)] for L in LAYERS}
        walk = [[src["walk"][y0 + dy][x0 + dx] for dx in range(w)] for dy in range(h)]
        items.append((name, dict(w=w, h=h, layers=grids, walk=walk, desc="")))
    return items, "map.json 배치"


def build_kits(srcs, ledger, add_cells=True):
    kits, report = [], dict(source={}, lossy=[], count=0)
    for s in srcs:
        entries, origin = _piece_entries(s)
        report["source"][s["id"]] = origin
        for name, q in entries:
            w, h = q["w"], q["h"]
            rows, lossy = [], 0
            for dy in range(h):
                lo, up = [], []
                for dx in range(w):
                    ids = {}
                    for L in LAYERS:
                        i = q["layers"][L][dy][dx]
                        if i < 0:
                            continue
                        sha = sha_of(s["cell"](i))
                        if L == "object_over":
                            pas, prio = "O", "upper"
                        else:
                            walk_o = q["walk"][dy][dx] if q["walk"] is not None else (L != "object")
                            pas, prio = ("O" if walk_o else "X"), "lower"
                        ids[L] = ledger.id_for(sha, pas, prio, HOME[L], f"{s['id']}:kit:{name}") if add_cells else None
                    if "ground" in ids and "ground_over" in ids:
                        lossy += 1
                    if "object" in ids and "object_over" in ids:
                        lossy += 1
                    lo.append(ids.get("ground", ids.get("ground_over", -1)))
                    up.append(ids.get("object", ids.get("object_over", -1)))
                row = {"tiles": lo}
                if any(v >= 0 for v in up):
                    row["upperTiles"] = up
                rows.append(row)
            kid = PREFIX + s["id"].replace("fc_", "").replace("_", "-") + "-" + "".join(ch if ch.isalnum() else "-" for ch in str(name).lower()).strip("-")
            kit = dict(id=kid, kind="section", name=f"{s['name']} · {name}", width=w, height=h, tileSize=T, rows=rows,
                       learnedFrom="pack-preset",
                       ai=dict(description=(q["desc"] or f"{s['name']} 조각 {name}") + f" (칸 {w}×{h}, 3/4 탑뷰)",
                               placementRules="4층 원본 조각의 1층(바닥/바닥 장식)·3층(물체/캐릭터 위) 묶음. 맵 원본은 네 층을 따로 쓴다."))
            if lossy:
                report["lossy"].append([kid, lossy])
            kits.append(kit)
    report["count"] = len(kits)
    return kits, report


def tileset_def(ledger, cols, srcs, grids_by_map, kits):
    n = len(ledger.cells)
    pas = [dict(up=c["pass"] == "O", down=c["pass"] == "O", left=c["pass"] == "O", right=c["pass"] == "O") for c in ledger.cells]
    prio = [c["prio"] for c in ledger.cells]
    uses = defaultdict(set)
    for s in srcs:
        for L in LAYERS:
            for row in grids_by_map[s["id"]][L]:
                for i in row:
                    if i >= 0:
                        uses[i].add((s["id"], L))
    names = {s["id"]: s["name"] for s in srcs}
    meta = []
    for i, c in enumerate(ledger.cells):
        u = sorted(uses.get(i) or [])
        where = " · ".join(f"{names.get(m, m)} {LAYER_KO[L]}" for m, L in u) or f"이전 판 {c.get('origin', '')}"
        passage = "star" if (c["pass"] == "O" and c["prio"] == "upper") else ("passable" if c["pass"] == "O" else "solid")
        meta.append(dict(label=f"성채 칸 {i}", description=f"{where} 칸. 통행 {dict(star='★ 캐릭터 위', passable='걸음', solid='막힘')[passage]}.",
                         defaultLayer=c["home"], passage=passage, source="bundled-default"))
    groups = []
    for s in srcs:
        for L in LAYERS:
            ids = sorted({i for row in grids_by_map[s["id"]][L] for i in row if i >= 0})
            if not ids:
                continue
            groups.append(dict(id=f"fc:{s['id']}-{L}", name=f"{s['name']} · {LAYER_KO[L]}", role=GROUP_ROLE[L], tileIds=ids,
                               description=f"{s['name']} 맵이 {LAYER_KO[L]}에 쓴 칸 {len(ids)}개.",
                               placementRules=f"{LAYER_KO[L]}에 깐다. 통행은 칸에 구워져 있다(★=캐릭터 위, 걸음, 막힘).",
                               defaultLayer=HOME[L], layerHome=HOME[L], source="bundled-default", confidence="high"))
    return dict(id=TILESET_ID, name=NAME, textureKey=TEXTURE, family=FAMILY, tileSize=T, tilesPerRow=cols, count=n,
                passability=pas, priority=prio, terrain=[0] * n, tileMeta=meta, tileGroups=groups,
                autotileGroups=[], animationStrips=[], structureKits=kits)


def map_json(s, grids, ledger):
    flat = {L: [i for row in grids[L] for i in row] for L in LAYERS}
    m = dict(id=s["id"], name=s["name"], width=s["w"], height=s["h"], tilesetId=TILESET_ID, tileSize=T,
             lowerTiles=flat["ground"], upperTiles=flat["object"], events=[])
    if any(v >= 0 for v in flat["ground_over"]):
        m["lowerOverlayTiles"] = flat["ground_over"]
    if any(v >= 0 for v in flat["object_over"]):
        m["upperOverlayTiles"] = flat["object_over"]
    return dict(map=m, walk=["".join("O" if v else "X" for v in row) for row in s["walk"]],
                placements=s["placements"], routes=s.get("routes"))


def run(sources, data_dir, reset_ledger=False, write=True):
    ledger_path = os.path.join(data_dir, "cell-ledger.json")
    build_dir = os.path.join(data_dir, "build")
    prev_sheet = os.path.join(build_dir, "fantasy-castles-chipset.png")
    prev_meta = os.path.join(build_dir, "fantasyCastlesSheet.json")
    prev_cols = read_json(prev_meta)["tilesPerRow"] if os.path.exists(prev_meta) else 32
    if reset_ledger and os.path.exists(ledger_path):
        old = Ledger(ledger_path)
        if old.frozen:
            raise BuildError(f"장부의 앞 {old.frozen}칸은 이미 나갔다 — --reset-ledger 금지")
        os.remove(ledger_path)
    ledger = Ledger(ledger_path)
    srcs = [load_source(d, mid, name) for (d, mid, name) in sources]
    grids, plans, split = resolve(srcs, ledger)
    kits, kit_report = build_kits(srcs, ledger)
    pixel_of_sha = {}
    for s in srcs:
        for i, sha in plans[s["id"]][1].items():
            pixel_of_sha.setdefault(sha, s["cell"](i))
    for s in srcs:
        entries, _ = _piece_entries(s)
        for _, q in entries:
            for L in LAYERS:
                for row in q["layers"][L]:
                    for i in row:
                        if i >= 0:
                            px = s["cell"](i)
                            pixel_of_sha.setdefault(sha_of(px), px)
    sheet, cols, orphans = build_sheet(ledger, pixel_of_sha, prev_sheet, prev_cols)
    stats = dict(tilesetId=TILESET_ID, count=len(ledger.cells), tilesPerRow=cols, previousCount=ledger.prev_count,
                 appended=len(ledger.cells) - ledger.prev_count, frozen=ledger.frozen, orphanCellsFromPreviousSheet=orphans,
                 splitByPassability=split, kits=kit_report, maps={})
    uniq = {s["id"]: set() for s in srcs}
    for s in srcs:
        g = grids[s["id"]]
        mism = []
        for y in range(s["h"]):
            for x in range(s["w"]):
                if engine_pass(ledger, g, x, y) != s["walk"][y][x]:
                    mism.append([x, y])
        for L in LAYERS:
            for row in g[L]:
                uniq[s["id"]].update(i for i in row if i >= 0)
        comp = render(g, sheet, cols, s["w"], s["h"])
        cmp = diff_stats(comp, s["composite"]) if s["composite"] is not None else None
        src_unique = len({sha for sha in plans[s["id"]][1].values()})
        stats["maps"][s["id"]] = dict(name=s["name"], width=s["w"], height=s["h"], cellsUsed=len(uniq[s["id"]]),
                                      sourceUniquePictures=src_unique,
                                      walkable=sum(sum(r) for r in s["walk"]), walkMismatch=len(mism), walkMismatchSamples=mism[:10],
                                      compositeVsSource=cmp, placements=len(s["placements"]))
        if mism:
            raise BuildError(f"{s['id']}: 엔진 통행과 walk 가 {len(mism)}칸 다르다 {mism[:5]}")
        if cmp is not None and (not cmp.get("sameSize") or cmp["differing"]):
            raise BuildError(f"{s['id']}: 다시 합성한 그림이 composite.png 와 다르다 {cmp}")
        s["_render"] = comp
    ids = [set(v) for v in uniq.values()]
    stats["sharedAcrossMaps"] = len(set.intersection(*ids)) if len(ids) > 1 else 0
    ts = tileset_def(ledger, cols, srcs, grids, kits)
    if write:
        os.makedirs(build_dir, exist_ok=True)
        os.makedirs(os.path.join(data_dir, "maps"), exist_ok=True)
        Image.fromarray(sheet).save(prev_sheet, optimize=True)
        with open(prev_meta, "w") as f:
            json.dump(dict(count=len(ledger.cells), tilesPerRow=cols), f)
            f.write("\n")
        with open(os.path.join(build_dir, "fantasyCastlesTileset.json"), "w", encoding="utf-8") as f:
            json.dump(ts, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")
        for s in srcs:
            with open(os.path.join(data_dir, "maps", s["id"] + ".json"), "w", encoding="utf-8") as f:
                json.dump(map_json(s, grids[s["id"]], ledger), f, ensure_ascii=False, separators=(",", ":"))
                f.write("\n")
            Image.fromarray(s["_render"]).save(os.path.join(build_dir, f"render-{s['id']}.png"))
        ledger.save()
        with open(os.path.join(data_dir, "build-stats.json"), "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=1)
            f.write("\n")
    return dict(stats=stats, tileset=ts, grids=grids, ledger=ledger, sheet=sheet, cols=cols)


DEFAULT_RUNS = "qa-runs/harnesses/building-kit/fantasy-kingdom"
DEFAULT_MAPS = [("stormveil", "fc_stormveil", "스톰베일 절벽 성"), ("helms-deep", "fc_helms_deep", "헬름 협곡 요새")]
REQUIRED_FILES = ("tileset.png", "map.json", "pieces.json", "composite.png")


def import_sources(runs_dir, data_dir):
    """그림 판 산출(tilemap/)을 저장소의 출처 사본(<data>/src/<폴더>/)으로 복사한다 — qa-runs 는 gitignore 라 커밋되지 않는다."""
    imported = {}
    for folder, mid, name in DEFAULT_MAPS:
        src = os.path.join(runs_dir, folder, "tilemap")
        missing = [f for f in REQUIRED_FILES if not os.path.exists(os.path.join(src, f))]
        if missing:
            raise BuildError(f"{src}: {', '.join(missing)} 가 없다")
        dst = os.path.join(data_dir, "src", folder)
        os.makedirs(dst, exist_ok=True)
        for f in os.listdir(src):
            if f.lower().endswith((".png", ".json", ".md", ".txt")):
                with open(os.path.join(src, f), "rb") as r, open(os.path.join(dst, f), "wb") as w:
                    w.write(r.read())
        imported[mid] = dict(folder=folder, files=sorted(os.listdir(dst)), bytes=sum(os.path.getsize(os.path.join(dst, f)) for f in os.listdir(dst)))
    with open(os.path.join(data_dir, "source-provenance.json"), "w", encoding="utf-8") as f:
        json.dump(dict(note="building-kit 3판 Opus 5.5 high 산출 tilemap/ 사본(qa-runs 는 gitignore). fc_build.py import 로 복사했다.", maps=imported), f, ensure_ascii=False, indent=1)
        f.write("\n")
    return imported


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--map", action="append", default=[], help="입력폴더:맵id:이름 (반복). 없으면 스톰베일·헬름 협곡 tilemap/")
    ap.add_argument("--data", default="tiledata/fantasy-castles")
    ap.add_argument("--reset-ledger", action="store_true", help="아직 한 칸도 나가지 않은(frozen 0) 장부만 새로 쓴다")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--import", dest="import_from", default=None, help="그림 판 산출 폴더(예: qa-runs/.../fantasy-kingdom)를 <data>/src 로 복사만 한다")
    a = ap.parse_args(argv)
    if a.import_from:
        try:
            print(json.dumps(import_sources(a.import_from, a.data), ensure_ascii=False, indent=1))
        except BuildError as e:
            print("FAIL", e)
            return 1
        return 0
    if a.map:
        sources = []
        for spec in a.map:
            d, mid, name = (spec.split(":", 2) + ["", ""])[:3]
            sources.append((d, mid, name or mid))
    else:
        sources = [(os.path.join(a.data, "src", folder), mid, name) for folder, mid, name in DEFAULT_MAPS]
    try:
        r = run(sources, a.data, reset_ledger=a.reset_ledger, write=not a.dry)
    except BuildError as e:
        print("FAIL", e)
        return 1
    print(json.dumps(r["stats"], ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
