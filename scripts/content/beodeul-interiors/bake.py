#!/usr/bin/env python3
"""버들항 실내(벽면·바닥·벽 윗면 테두리·가구·탁상 물건·빛 무늬)를 공용 버들항 시트의 제 토막 `fable_interior` 에 굽는다.

  python3 scripts/content/beodeul-interiors/prepare.py          # raw/ → pieces/ (그림자·불빛·색 줄 옮기기)
  python3 scripts/content/beodeul-interiors/bake.py --manifest  # 면제 입력(gate-manifest.json)만 쓴다
  python3 scripts/content/beodeul-interiors/bake.py --dry       # 관문 상태와 칸 계획만
  python3 scripts/content/beodeul-interiors/bake.py             # 굽는다
  python3 scripts/content/beodeul-interiors/bake.py --dev       # 관문 없이(커밋하지 않는다)

토막: 칸 48,512 ~ 52,607 (4,096칸 = 32줄, 고정 예약 — 안 쓴 칸은 빈 칸으로 채운다. 다음 토막은 52,608 부터 남의 것). 그 앞 칸과 줄 폭(128)은 건드리지 않는다.
칸 번호는 덧붙이기 전용: 열쇠(«obj/bar counter/0,-1» 따위) → 번호를 tiledata/beodeul-interiors/catalog.json 에 못박고, 새 열쇠는 쓰인 마지막 칸 뒤에 붙인다.
3/4 관문(hard rule): 굽는 그림마다 object-gate 출구 `require_all(context="bundle")`. 이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음**(catalog waiver)으로 지난다 —
면제는 pieces/ 그림의 화소 해시에 묶여 있어 한 화소라도 바꾸면 굽기가 멈춘다. 면제는 통과가 아니다(스토어 출구는 막힌다).

쓰는 것: public/assets/beodeul-city/beodeul-city-chipset.png · src/assets/beodeulCityTileset.json(칸 표 · 킷 bd-in:*) · src/assets/beodeulCitySheet.json ·
src/assets/beodeulInteriorSpec.json(방 짓기 사양 HandInteriorSpec — build_hand_interior_room({tileset:"beodeul_city"})) · tiledata/beodeul-interiors/catalog.json.
방 견본(src/assets/beodeulInteriorRoomTemplates.json)과 사양의 방 표(rooms)는 rooms.mts 가 굽는다 — 이 굽기는 사양에 있던 rooms 를 그대로 둔다.

구조 칸: 바닥 = 무늬 주기(열×줄) × 그림자 4(없음·벽면 밑·서쪽·둘 다), 벽면 = 2줄 × 3열 × 서쪽 그림자, 벽 윗면 테두리 = 천장 띠 32변형(비트 1 남쪽 안 · 2 북쪽 안 · 4 서쪽 안 · 8 동쪽 안 · 16 북쪽 공허)
+ 모서리 조각(ceilingCorners «비트:모서리»). 테두리는 검은 천장이 아니라 위에서 본 벽 두께(8px)다 — 방 쪽 반 칸에 벽 윗면, 바깥 반 칸은 어둠.
"""
import argparse, json, pathlib, re, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
sys.path.insert(0, str(HERE))
import table as TB  # noqa: E402

SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
SPEC_PATH = ROOT / "src/assets/beodeulInteriorSpec.json"
STORE = ROOT / "tiledata/beodeul-interiors"
PIECES = STORE / "pieces"
CATALOG = STORE / "catalog.json"
MANIFEST = STORE / "gate-manifest.json"
T, COLS, BASE, RESERVED = 16, 128, 48512, 4096
END = BASE + RESERVED
KIT = "bd-in:"
LABEL = "버들항 실내"
WAIVER = "fable-interiors-beodeul-2026-11-15"
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."
OPEN = {k: True for k in ("up", "down", "left", "right")}
SHUT = {k: False for k in ("up", "down", "left", "right")}
VOID = (7, 21, 40, 255)
DARK = (26, 16, 34)


def slug(i): return re.sub(r"[^a-z0-9]+", "-", i.lower()).strip("-")
def piece(name): return Image.open(PIECES / f"{name}.png").convert("RGBA")
def cell(im, cx, cy): return im.crop((cx * T, cy * T, cx * T + T, cy * T + T))


def shade(im, top=False, west=False):
    """벽면 밑 접촉 그늘(위 4px 세 단) · 서쪽 벽 곁 그늘(왼쪽 3px) — 어둠을 얹는다."""
    a = np.array(im).astype(float)
    def dark(sl, al): a[sl + (slice(0, 3),)] = a[sl + (slice(0, 3),)] * (1 - al) + np.array(DARK) * al
    if top:
        for y, al in ((0, .5), (1, .36), (2, .22), (3, .1)): dark((slice(y, y + 1), slice(None)), al)
    if west:
        for x, al in ((0, .4), (1, .26), (2, .12)): dark((slice(None), slice(x, x + 1)), al)
    return Image.fromarray(a.round().astype(np.uint8), "RGBA")


def edge_cell(e, b, d):
    """테두리 한 칸. e = 48×48 아홉 조각(가운데 투명). b 비트 1 남 · 2 북 · 4 서 · 8 동 쪽이 방 안, d 모서리 1 남서 · 2 남동 · 4 북서 · 8 북동."""
    out = Image.new("RGBA", (T, T), VOID)
    top, bot = e.crop((16, 8, 32, 16)), e.crop((16, 32, 32, 40))       # 북쪽 벽 윗면(방이 남쪽) · 남쪽 벽 윗면(방이 북쪽)
    left, right = e.crop((8, 16, 16, 32)), e.crop((32, 16, 40, 32))    # 서쪽 벽(방이 동쪽) · 동쪽 벽(방이 서쪽)
    post = {"nw": e.crop((8, 8, 16, 16)), "ne": e.crop((32, 8, 40, 16)), "sw": e.crop((8, 32, 16, 40)), "se": e.crop((32, 32, 40, 40))}
    S, N, W, E = b & 1, b & 2, b & 4, b & 8
    if S: out.paste(top, (0, 8))
    if N: out.paste(bot, (0, 0))
    if E: out.paste(left, (8, 0))
    if W: out.paste(right, (0, 0))
    # 두 띠가 만나는 사분면과 대각선만 닿는 사분면에는 기둥 머리
    for q, (ox, oy), on in (("nw", (8, 8), (S and E) or d & 2), ("ne", (0, 8), (S and W) or d & 1), ("sw", (8, 0), (N and E) or d & 8), ("se", (0, 0), (N and W) or d & 4)):
        if on: out.paste(post[q], (ox, oy))
    return out


def corner_keys():
    """ceilingCorners 열쇠 — 대각선 모서리는 그 대각선을 낀 두 변이 다 막혔을 때만 선다."""
    keys = []
    for b in range(32):
        S, N, W, E = b & 1, b & 2, b & 4, b & 8
        ok = [bit for bit, (p, q) in ((1, (S, W)), (2, (S, E)), (4, (N, W)), (8, (N, E))) if not p and not q]
        for d in range(1, 16):
            if all((d & bit) == 0 or bit in ok for bit in (1, 2, 4, 8)) and d: keys.append((b, d))
    return keys


def plan():
    """굽는 칸 전부: [(열쇠, 그림 16×16, 통행 'solid'|'star'|'walk'|'floor', 이름표, 태그)] 와 사양 뼈대(번호 대신 열쇠)."""
    cells, spec = [], dict(floors={}, walls={}, ceilings={}, ceilingCorners={}, objects={}, goods={}, daises={})
    def add(key, im, passage, label, tags):
        cells.append((key, im, passage, label, tags)); return key
    void = add("void", Image.new("RGBA", (T, T), VOID), "solid", f"{LABEL} · 벽 속(바깥 어둠)", ["구조"])
    for eid, _src, ko in TB.EDGES:
        e = piece(f"edge-{eid}")
        spec["ceilings"][eid] = [add(f"edge/{eid}/{b}", edge_cell(e, b, 0), "solid", f"{LABEL} · {ko}", ["구조", "벽 윗면"]) for b in range(32)]
        spec["ceilingCorners"][eid] = {f"{b}:{d}": add(f"edge/{eid}/{b}:{d}", edge_cell(e, b, d), "solid", f"{LABEL} · {ko} 모서리", ["구조", "벽 윗면"]) for b, d in corner_keys()}
    for wid, _src, ko, _styles in TB.WALLS:
        w = piece(f"wall-{wid}"); tiles = []
        for row in range(2):
            for col in range(3):
                for west in (0, 1):
                    tiles.append(add(f"wall/{wid}/{row}.{col}.{west}", shade(cell(w, col, row), west=bool(west)), "solid", f"{LABEL} 벽면 · {ko}", ["구조", "벽면"]))
        spec["walls"][wid] = dict(ko=ko, cols=3, tiles=tiles)
    for fid, _src, ko, _o in TB.FLOORS:
        f = piece(f"floor-{fid}"); cols, rows = f.width // T, f.height // T; tiles = []
        for y in range(rows):
            for x in range(cols):
                for sh in range(4):
                    tiles.append(add(f"floor/{fid}/{y}.{x}.{sh}", shade(cell(f, x, y), top=bool(sh & 1), west=bool(sh & 2)), "floor", f"{LABEL} 바닥 · {ko}", ["구조", "바닥"]))
        spec["floors"][fid] = dict(ko=ko, cols=cols, rows=rows, tiles=tiles)
    for oid, _src, kind, w, foot, cat, ko, tags, _gate, o in TB.OBJECTS:
        spec["objects"][oid] = obj_entry(oid, piece(slug(oid)), kind, w, foot, cat, ko, tags, o, add)
    for gid, _src, w, h, ko in TB.GLOWS:
        spec["objects"][gid] = obj_entry(gid, piece(slug(gid)), "flat", w, h, "light", ko, ["불빛"], dict(use=["walk"], desc=ko), add)
    for did, _src, ko in TB.DAISES:
        im = piece(f"nine-{slug(did)}"); pieces = {}
        for col in "LMRS":
            for row in "TMBS":
                key = add(f"nine/{did}/{col}{row}", nine_cell(im, col, row), "walk", f"{LABEL} · {ko}", ["깔개", "단"])
                pieces[f"{col}{row}0"] = pieces[f"{col}{row}1"] = key
        spec["daises"][did] = dict(ko=ko, pieces=pieces)
    for gid, _src, ko in TB.GOODS:
        spec["goods"][gid] = add(f"goods/{gid}", piece(f"goods-{slug(gid)}"), "star", f"{LABEL} 탁상 물건 · {ko}", ["탁상 물건"])
    return cells, spec, void


def obj_entry(oid, im, kind, w, foot, cat, ko, tags, o, add):
    rows = im.height // T
    assert im.width == w * T and im.height % T == 0, (oid, im.size)
    top = 0 if kind in ("hang", "flat", "door") else 2 if kind == "sidedoor" else rows - foot
    cs = []
    for y in range(rows):
        for x in range(w):
            c = cell(im, x, y)
            if not c.getchannel("A").getbbox(): continue
            dy = y - top
            sill = kind in ("door", "sidedoor") and y == 2      # 문의 맨 아래 칸(문턱·문설주 밑동)은 바닥 무늬, 위 두 칸은 사람 위에 그린다
            passage = "star" if o.get("over") else "walk" if kind == "flat" or sill else "solid" if kind in ("floor", "wall") and dy >= 0 else "star"
            cs.append([x, dy, add(f"obj/{oid}/{x},{dy}", c, passage, f"{LABEL} · {ko}" + (f" ({x},{dy})" if w * rows > 1 else ""), [TB.CATS[cat], *tags]), 2 if sill else 3 if kind != "flat" or o.get("stairs") or o.get("over") else 2])
    b = im.getchannel("A").getbbox()
    up = 0 if kind in ("hang", "flat", "door", "sidedoor") else max(0, (rows - foot) * T - b[1])
    e = dict(ko=ko, category=cat, category_ko=TB.CATS[cat], kind=kind, w=w, h=0 if kind == "hang" else foot, up=up, cells=cs,
             desc=o.get("desc", ko), tags=tags, place=PLACE[kind], pair=o.get("pair", []), use=o.get("use", ["walk"] if kind in ("flat", "door", "sidedoor") else ["block"]))
    for k in ("stairs", "facing"):
        if o.get(k): e[k] = o[k]
    if kind in ("floor", "wall") and (o.get("surface") or "counter" in e["use"] or "table" in oid or "desk" in oid):
        e["surface"] = [2, 2, w * T - 4, 9]   # 윗면 상자(그림 맨 위 기준) — 탁상 물건이 앉는 줄(surfaceRowOf)
    return e


PLACE = dict(floor="바닥에 세운다.", wall="북쪽 벽 바로 앞 첫 바닥 줄에 벽에 붙여 세운다.", hang="북쪽 벽면 윗줄에 건다.", flat="바닥에 깐다(밟고 지나간다).",
             door="위·아래 방 사이 가로 칸막이의 1칸 틈에 단다(layout 의 connect 가 단다).", sidedoor="왼·오른 방 사이 세로 칸막이 3줄 틈의 통로 칸에 단다(layout 의 connect 가 단다).")


def nine_cell(im, col, row):
    """아홉 조각(48×48)에서 한 칸. col L·M·R·S, row T·M·B·S — S(한 칸 폭·한 줄)는 양쪽 끝 칸의 바깥 반씩을 붙인다."""
    xs = dict(L=[(0, 16)], M=[(16, 32)], R=[(32, 48)], S=[(0, 8), (40, 48)])[col]
    ys = dict(T=[(0, 16)], M=[(16, 32)], B=[(32, 48)], S=[(0, 8), (40, 48)])[row]
    out = Image.new("RGBA", (T, T)); oy = 0
    for y0, y1 in ys:
        ox = 0
        for x0, x1 in xs:
            out.paste(im.crop((x0, y0, x1, y1)), (ox, oy)); ox += x1 - x0
        oy += y1 - y0
    return out


def existing(ts):
    """이미 구워진 바깥 기물(bd-obj-*)을 실내 가구로 — 칸은 그 킷의 칸 그대로(새로 굽지 않는다)."""
    kits = {k["id"]: k for k in ts["structureKits"]}
    blocked = lambda t: t >= 0 and not any(ts["passability"][t].values())   # noqa: E731
    out = {}
    for oid, tail, cat, tags in TB.EXISTING:
        k = kits.get(f"bd-obj-{tail}")
        if not k: sys.exit(f"바깥 기물 킷 bd-obj-{tail} 이 없다")
        H = len(k["rows"]); first = next((y for y, r in enumerate(k["rows"]) if any(blocked(t) for t in r.get("upperTiles") or [])), H - 1)
        cs = [[x, y - first, t, 3] for y, r in enumerate(k["rows"]) for x, t in enumerate(r.get("upperTiles") or []) if t >= 0]
        ko = k["name"].split("·", 1)[1].strip() if "·" in k["name"] else k["name"]
        ko = re.sub(r"\s*\d+×\d+$", "", ko)
        out[oid] = dict(ko=ko, category=cat, category_ko=TB.CATS[cat], kind="floor", w=k["width"], h=H - first, up=first * T, cells=cs, desc=ko, tags=tags, place=PLACE["floor"], pair=[], use=["block"])
    return out


def gate_items():
    """관문에 묻는 그림 = pieces/ 의 굽는 그림 전부. 구조 판(벽면·바닥·테두리)은 terrain, 빛 무늬·깔개는 flat."""
    items = []
    for eid, _s, _k in TB.EDGES: items.append((piece(f"edge-{eid}"), "terrain", f"edge-{eid}"))
    for wid, *_ in TB.WALLS: items.append((piece(f"wall-{wid}"), "terrain", f"wall-{wid}"))
    for fid, *_ in TB.FLOORS: items.append((piece(f"floor-{fid}"), "terrain", f"floor-{fid}"))
    for oid, _src, _kind, _w, _f, _c, _ko, _t, gate, _o in TB.OBJECTS: items.append((piece(slug(oid)), gate, slug(oid)))
    for gid, *_ in TB.GLOWS: items.append((piece(slug(gid)), "flat", slug(gid)))
    for did, *_ in TB.DAISES: items.append((piece(f"nine-{slug(did)}"), "flat", f"nine-{slug(did)}"))
    for gid, *_ in TB.GOODS: items.append((piece(f"goods-{slug(gid)}"), "other", f"goods-{slug(gid)}"))
    return items


def main():
    ap = argparse.ArgumentParser()
    for f in ("dry", "dev", "manifest"): ap.add_argument(f"--{f}", action="store_true")
    a = ap.parse_args()
    items = gate_items()
    if a.manifest:
        MANIFEST.write_text(json.dumps(dict(items=[dict(png=str((PIECES / f"{name}.png").relative_to(ROOT)), kind=kind, id=f"bd-in-{name}", chipset="beodeul_city") for _im, kind, name in items]), ensure_ascii=False, indent=1) + "\n")
        print(f"면제 입력 {len(items)}장 → {MANIFEST.relative_to(ROOT)}"); return
    if a.dev: print("관문 없이(--dev) — 커밋하지 않는다")
    else:
        from object_gate import require_all
        got = require_all([(im, kind, f"beodeul_city/bd-in-{name}") for im, kind, name in items], context="bundle")
        print(f"관문(bundle 출구): {len(got)}/{len(items)} — {GATE_NOTE} 묶음 {WAIVER}")
    cells, spec, void = plan()
    pins = json.loads(CATALOG.read_text())["pins"] if CATALOG.exists() else {}
    nxt = max(pins.values(), default=BASE - 1) + 1
    for key, *_ in cells:
        if key not in pins: pins[key] = nxt; nxt += 1
    if nxt > END: sys.exit(f"토막이 넘친다: {nxt - BASE}칸 > 예약 {RESERVED}칸")
    print(f"칸 {len(cells)}개(못박힌 번호 {len(pins)}개) → {BASE}..{nxt - 1} / 예약 {BASE}..{END - 1} ({END - nxt}칸 남음)")
    if a.dry: return
    ts = json.loads(TS_PATH.read_text())
    count0 = json.loads(SHEET_JSON.read_text())["count"]
    if count0 < BASE: sys.exit(f"시트가 {BASE} 칸보다 짧다({count0}) — 앞 토막부터 굽는다")
    foreign = [n for n in range(BASE, min(END, count0)) if ts["tileMeta"][n].get("label") and not ts["tileMeta"][n]["label"].startswith(LABEL)]
    if foreign: sys.exit(f"내 토막 안에 남의 칸 {foreign[0]}(「{ts['tileMeta'][foreign[0]]['label']}」)이 있다")
    total = max(count0, END)
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    out = Image.new("RGBA", (COLS * T, total // COLS * T), (0, 0, 0, 0)); out.paste(sheet, (0, 0))
    out.paste(Image.new("RGBA", (COLS * T, RESERVED // COLS * T), (0, 0, 0, 0)), (0, BASE // COLS * T))
    after = {k: ts[k][END:] for k in ("passability", "priority", "terrain", "tileMeta")}
    for k in ("passability", "priority", "terrain", "tileMeta"): ts[k] = ts[k][:BASE]
    block = [(dict(OPEN), "lower", 0, dict(label="", description="", source="bundled-default")) for _ in range(RESERVED)]
    for key, im, passage, label, tags in cells:
        n = pins[key]; out.paste(im, ((n % COLS) * T, (n // COLS) * T))
        meta = dict(label=label, description=f"{label}. {GATE_NOTE}", tags=["버들항", "실내", *tags], defaultLayer="lower" if passage in ("floor", "solid") and tags[0] == "구조" else "upper",
                    passage="walk" if passage in ("floor", "walk") else passage, source="bundled-default")
        if tags[0] == "구조": meta["role"] = "terrain"
        block[n - BASE] = (dict(SHUT if passage == "solid" else OPEN), "upper" if passage == "star" else "lower", 0, meta)
    for p, pr, te, me in block:
        ts["passability"].append(p); ts["priority"].append(pr); ts["terrain"].append(te); ts["tileMeta"].append(me)
    for k in after: ts[k] += after[k]
    ts["animationStrips"] = [s for s in ts["animationStrips"] if not BASE <= s["baseTile"] < END]
    n = lambda key: pins[key]   # noqa: E731
    objects = {k: dict(o, cells=[[dx, dy, n(key), layer] for dx, dy, key, layer in o["cells"]]) for k, o in spec["objects"].items()}
    objects.update(existing(ts))
    old = json.loads(SPEC_PATH.read_text()) if SPEC_PATH.exists() else {}
    full = dict(version=1, source="scripts/content/beodeul-interiors/table.py", gate=f"{GATE_NOTE} 묶음 {WAIVER}", tileSize=T, blank=-1, void=n(void),
                floors={k: dict(f, tiles=[n(t) for t in f["tiles"]]) for k, f in spec["floors"].items()},
                walls={k: dict(w, tiles=[n(t) for t in w["tiles"]]) for k, w in spec["walls"].items()},
                ceilings={k: [n(t) for t in c] for k, c in spec["ceilings"].items()},
                ceilingCorners={k: {kk: n(t) for kk, t in c.items()} for k, c in spec["ceilingCorners"].items()},
                objects=objects, tables={}, lines={}, daises={k: dict(d, pieces={kk: n(t) for kk, t in d["pieces"].items()}) for k, d in spec["daises"].items()}, goods={k: n(t) for k, t in spec["goods"].items()},
                looks=dict(_doc="벽면 → 벽 윗면 테두리, style = 바깥 집 양식 → {견본의 집 벽(plaster 그 집의 벽 · rubble 돌 아래층·불 방): 그 양식에서 설 벽면}. 빌더가 읽는다(src/ai/v2/place/builders/interiorExterior.ts).",
                           edge=TB.WALL_EDGE, style=TB.STYLE_WALLS))
    full["personal"] = TB.PERSONAL
    if old.get("rooms"): full["rooms"] = old["rooms"]
    # 킷: 가구마다 한 장(bd-in:<id>) — 덧찍기(stamp_object)·고치기가 쓴다. 바깥 빈 땅 채우기는 «주제 소품» 을 흩지 않는다.
    kits = []
    for oid, o in objects.items():
        if oid in {e[0] for e in TB.EXISTING}: continue
        ys = sorted({c[1] for c in o["cells"]}); y0 = ys[0]
        rows = [dict(tiles=[-1] * o["w"], upperTiles=[next((c[2] for c in o["cells"] if c[0] == x and c[1] == y), -1) for x in range(o["w"])]) for y in range(y0, ys[-1] + 1)]
        kits.append(dict(id=KIT + oid, name=f"{LABEL} · {o['ko']} {o['w']}×{len(rows)}", kind="section", width=o["w"], height=len(rows), tileSize=T, learnedFrom="pack-preset", rows=rows,
                         ai=dict(role="prop", repeatability="fixed", layerHome="upper", tags=[o["kind"], "버들항", "실내", "주제 소품", o["category_ko"], *o["tags"]], themes=["interior", "실내"],
                                 description=f"{o['ko']} — 실내 가구. {o['place']} {GATE_NOTE}", placementRules=f"실내 방에만. {o['place']} build_hand_interior_room 의 objects 로 놓는다.")))
    at = next((i for i, k in enumerate(ts["structureKits"]) if k["id"].startswith(KIT)), len(ts["structureKits"]))
    ts["structureKits"] = [k for k in ts["structureKits"][:at] if not k["id"].startswith(KIT)] + kits + [k for k in ts["structureKits"][at:] if not k["id"].startswith(KIT)]
    ts["count"] = total
    out.save(SHEET_PATH, optimize=True)
    TS_PATH.write_text(json.dumps(ts, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=total, tilesPerRow=COLS)) + "\n")
    SPEC_PATH.write_text(json.dumps(full, ensure_ascii=False, separators=(",", ":")) + "\n")
    CATALOG.write_text(json.dumps(dict(tilesetId="beodeul_city", base=BASE, reserved=RESERVED, used=nxt - BASE, kitPrefix=KIT, waiver=WAIVER, gate="3/4 gate not passed — owner waiver",
                                       source="scripts/content/beodeul-interiors (Claude Fable 5.2 medium one-shot pictures; prepare.py adds floor shadows, light halos and ramp shifts)",
                                       objects=len(objects), reused=len(TB.EXISTING), pins=pins), ensure_ascii=False, indent=0) + "\n")
    print(f"{LABEL}: 시트 {COLS * T}×{total // COLS * T}px · 칸 {total} · 가구 {len(objects)}(새 그림 {len(kits)} + 바깥 기물 {len(TB.EXISTING)}) · 벽면 {len(full['walls'])} · 바닥 {len(full['floors'])} · 테두리 {len(full['ceilings'])} · 탁상 물건 {len(full['goods'])}")


if __name__ == "__main__":
    main()
