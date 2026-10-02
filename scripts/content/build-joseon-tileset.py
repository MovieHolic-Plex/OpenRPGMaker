# 조선 칩셋(바람의나라풍 손 도트) → 에디터 번들 타일셋 일반 변환기.
#
# 입력만 바꿔 같은 명령으로 돌린다 — 마을 20호(demo20.py)도, 국내성 맵(demo_gungnae.py)도 같은 시트 위에 합친다.
#   python3 scripts/content/build-joseon-tileset.py                         # 기본 = 마을 20호 산출물
#   python3 scripts/content/build-joseon-tileset.py \
#       --sheet X-chipset.png --pieces X-pieces.json \
#       --map joseon_v20:tiledata/joseon-village20/map.json:tiledata/joseon-village20/extra.json:"조선 마을 20호" \
#       --map gungnae:tiledata/joseon-gungnae/map.json:tiledata/joseon-gungnae/extra.json:"국내성"
#
# 입력 계약
#   --sheet    조각 시트 PNG(16px 칸, 칸 번호 = 행*열수+열).  --pieces  시트의 pieces.json({tile,cols,rows,pieces,overlapTiles}).
#   --map      ID:map.json[:extra.json[:이름]] (여러 번). map.json = {width,height,ground[H][W],object[H][W]} 칸 번호 격자(-1=빈칸).
#              extra.json = {width,height,placed[{name,x,y,w,h}],groundKind[H][W],doors[{x,y,piece}],people[{x,y,char,dir,frame}]}.
#   --meta     조각 분류(harness/pieces_meta.json).  --overrides  통행 보정·지형 묶음 정의(piece-walk-overrides.json).
# 출력
#   public/assets/joseon-baram/joseon-baram-chipset.png      번들 시트(열 수는 높이 4096px 안에 들게 자동, 칸 번호는 그대로)
#   src/assets/joseonBaramSheet.json                         {count, tilesPerRow}
#   src/assets/joseonBaramTileset.json                       타일셋 정의(통행·레이어·오토타일·조각 묶음·조립 부품)
#   <out-dir>/piece-walk.json                                조각별 칸 통행 격자(정본, 손으로 검수)
#   <out-dir>/maps/<id>.json                                 맵(lowerTiles/upperTiles 새 칸 번호) + 정답 통행 격자 + NPC·문·시작칸
#   <out-dir>/autotile-equiv.json · build-stats.json · piece-walk-overlay.png · walk-overlay-<id>.png
#
# 통행 규칙 요약(scripts/content/lib/joseon_tileset/walk.py): X 막힘(priority upper, 사람과 y 정렬) / C 걸음★(upper, 사람 위) /
# F 걸음(lower, 사람 아래). 같은 그림이 맵에서 다른 통행으로 쓰이면 시트 꼬리에 복사본을 덧붙인다(앞 칸 번호 불변).
# 오토타일: 이웃 8비트(N1 E2 S4 W8 NE16 SE32 SW64 NW128 = 엔진 AUTOTILE_DIR). 마스크 16종은 하위 4비트, 물은 47종 블롭(water_blob.py 와 같은 정규화).
import argparse, json, os, pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts/content/lib"))
from joseon_tileset import walk as W            # noqa: E402
from joseon_tileset import names as NM          # noqa: E402

T = 16
OPEN = dict(up=True, down=True, left=True, right=True)
SHUT = dict(up=False, down=False, left=False, right=False)
MAX_SHEET_H = 4096        # GPU 텍스처 한계에 닿지 않게 시트 세로 픽셀 상한

ap = argparse.ArgumentParser()
ap.add_argument("--sheet", default="tiledata/joseon-village20/joseon-village20-chipset.png")
ap.add_argument("--pieces", default="tiledata/joseon-village20/pieces.json")
ap.add_argument("--map", action="append", dest="maps", default=None)
ap.add_argument("--meta", default="scripts/content/lib/joseon/harness/pieces_meta.json")
ap.add_argument("--overrides", default="tiledata/joseon-village/piece-walk-overrides.json")
ap.add_argument("--out-dir", default="tiledata/joseon-village")
ap.add_argument("--id", default="joseon_baram")
ap.add_argument("--texture", default="tex_joseon_baram")
ap.add_argument("--prefix", default="jb-")
ap.add_argument("--name", default="조선 · 바람의나라풍 (손 도트)")
ap.add_argument("--family", default="oprn-joseon")
ap.add_argument("--cols", default="auto", help="번들 시트 열 수. auto = 원본 열 수로 4096px 안에 들면 그대로, 아니면 64")
ap.add_argument("--public-png", default="public/assets/joseon-baram/joseon-baram-chipset.png")
ap.add_argument("--def-json", default="src/assets/joseonBaramTileset.json")
ap.add_argument("--sheet-json", default="src/assets/joseonBaramSheet.json")
args = ap.parse_args()
if not args.maps:
    args.maps = ["joseon_v20:tiledata/joseon-village20/map.json:tiledata/joseon-village20/extra.json:조선 마을 20호"]


def P(p):
    p = pathlib.Path(p)
    return p if p.is_absolute() else ROOT / p


OUT = P(args.out_dir)
(OUT / "maps").mkdir(parents=True, exist_ok=True)
warnings = []


def warn(msg):
    warnings.append(msg)
    print("경고:", msg)


# ---------------------------------------------------------------- 입력
sheet = np.array(Image.open(P(args.sheet)).convert("RGBA"))
pj = json.loads(P(args.pieces).read_text())
COLS0 = pj["cols"]
count0 = (sheet.shape[0] // T) * COLS0
assert sheet.shape[1] == COLS0 * T, f"시트 폭 {sheet.shape[1]} != cols {COLS0}*16"
assert pj["tileCount"] <= count0
meta = json.loads(P(args.meta).read_text()) if P(args.meta).exists() else {}
overrides = json.loads(P(args.overrides).read_text()) if P(args.overrides).exists() else {}
OV_TERRAIN = overrides.get("terrain", {})
ov_range = pj.get("overlapTiles") or {"start": count0, "count": 0}
OVL0, OVL1 = ov_range["start"], ov_range["start"] + ov_range["count"]


def cell(i):
    x, y = (i % COLS0) * T, (i // COLS0) * T
    return sheet[y:y + T, x:x + T]


pieces = pj["pieces"]
groups = {n: v for n, v in pieces.items() if "count" in v and "w" not in v}     # 지형 묶음(평면 줄)
objects = {n: v for n, v in pieces.items() if "w" in v}                         # 물체 조각(칸 격자)

# ---------------------------------------------------------------- 지형 묶음
ALL47 = None


def canon(m):
    out = m & 15
    for bit, a, b in ((16, 1, 2), (32, 4, 2), (64, 4, 8), (128, 1, 8)):
        if (m & bit) and (m & a) and (m & b):
            out |= bit
    return out


ALL47 = sorted({canon(m) for m in range(256)})
INDEX47 = {m: i for i, m in enumerate(ALL47)}
assert len(ALL47) == 47

terrain_spec = {}       # 묶음 이름 → 정의
tile_terrain = {}       # 칸 번호 → (묶음 이름, 묶음 안 순번)
for gname, g in groups.items():
    spec = dict(OV_TERRAIN.get(gname, {}))
    spec.setdefault("name", gname)
    spec.setdefault("walk", True)
    spec.setdefault("kind", "flat")
    spec["tiles"] = g["tiles"]
    terrain_spec[gname] = spec
    for k, t in enumerate(g["tiles"]):
        tile_terrain[t] = (gname, k)
    if spec["kind"] == "mask16" and len(g["tiles"]) != 16:
        raise SystemExit(f"{gname}: mask16 인데 칸이 {len(g['tiles'])}개")
    if spec["kind"] == "blob47" and len(g["tiles"]) % 47:
        raise SystemExit(f"{gname}: blob47 인데 칸이 {len(g['tiles'])}개")

# ---------------------------------------------------------------- 조각 통행 격자
walk = W.build_piece_walk(objects, cell, meta, overrides)
piece_cell_class = {}    # 조각 칸 번호 → X/C/F
piece_cell_owner = {}
for name, p in objects.items():
    for j in range(p["h"]):
        for i in range(p["w"]):
            t = p["tiles"][j][i]
            ch = walk[name]["rows"][j][i]
            if ch != ".":
                piece_cell_class[t] = ch
                piece_cell_owner[t] = (name, j, i)

# ---------------------------------------------------------------- 맵 → 칸 분리(통행이 다른 같은 그림은 꼬리 복사)
tail = []                # [(원본 칸 번호, 클래스)]
tail_index = {}
overlap_class = {}       # 겹침 칸 번호 → 첫 사용 클래스


def resolve(t, need):
    """맵의 물체 칸 t 가 need 통행으로 쓰일 때의 최종 칸 번호."""
    base = piece_cell_class.get(t)
    if base is None and OVL0 <= t < OVL1:
        base = overlap_class.setdefault(t, need)
    if base == need:
        return t
    key = (t, need)
    if key not in tail_index:
        tail_index[key] = count0 + len(tail)
        tail.append(key)
    return tail_index[key]


maps_out = []
for spec in args.maps:
    parts = spec.split(":")
    mid, mpath = parts[0], parts[1]
    epath = parts[2] if len(parts) > 2 and parts[2] else None
    mname = parts[3] if len(parts) > 3 else mid
    mj = json.loads(P(mpath).read_text())
    ex = json.loads(P(epath).read_text()) if epath and P(epath).exists() else None
    Wd, Ht = mj["width"], mj["height"]
    cover = {}
    if ex:
        assert ex["width"] == Wd and ex["height"] == Ht, f"{mid}: extra 크기가 map 과 다르다"
        for pl in ex["placed"]:
            wk = walk.get(pl["name"])
            if wk is None:
                warn(f"{mid}: placed 의 조각 {pl['name']} 이 pieces.json 에 없다")
                continue
            for j in range(wk["h"]):
                for i in range(wk["w"]):
                    ch = wk["rows"][j][i]
                    if ch != ".":
                        cover.setdefault((pl["x"] + i, pl["y"] + j), []).append(ch)
    else:
        warn(f"{mid}: extra.json 이 없어 겹침 칸 통행을 짐작(F)한다")
    ground = mj["ground"]
    obj = mj["object"]
    lower = []
    upper = []
    cls_grid = [[None] * Wd for _ in range(Ht)]
    shadow_only = 0
    for y in range(Ht):
        for x in range(Wd):
            g = ground[y][x]
            if g not in tile_terrain:
                warn(f"{mid}: ({x},{y}) 바닥 칸 {g} 이 지형 묶음에 없다")
            lower.append(g)
            t = obj[y][x]
            if t < 0:
                upper.append(-1)
                continue
            need = W.merge_chars(cover.get((x, y), []))
            if need is None:
                if ex and t not in piece_cell_class:
                    shadow_only += 1
                need = piece_cell_class.get(t) or "F"
            nt = resolve(t, need)
            upper.append(nt)
            cls_grid[y][x] = need
    maps_out.append(dict(id=mid, name=mname, extra_path=epath, map_path=mpath, width=Wd, height=Ht, lower=lower, upper=upper, cls=cls_grid, ex=ex,
                         shadow_only=shadow_only))

# 사용되지 않은 겹침 칸의 클래스
for t in range(OVL0, OVL1):
    overlap_class.setdefault(t, "F")
    piece_cell_class.setdefault(t, overlap_class[t])

# ---------------------------------------------------------------- 최종 칸 표
count_raw = count0 + len(tail)
if args.cols == "auto":
    rows_try = -(-count_raw // COLS0)
    cols_out = COLS0 if rows_try * T <= MAX_SHEET_H else 64
else:
    cols_out = int(args.cols)
rows_out = -(-count_raw // cols_out)
count = rows_out * cols_out
assert rows_out * T <= MAX_SHEET_H, f"시트 높이 {rows_out * T}px > {MAX_SHEET_H}"

tile_img = [None] * count
for i in range(count0):
    tile_img[i] = cell(i)
for k, (src, need) in enumerate(tail):
    tile_img[count0 + k] = cell(src)
blank = np.zeros((T, T, 4), np.uint8)
out_sheet = np.zeros((rows_out * T, cols_out * T, 4), np.uint8)
for i in range(count):
    im = tile_img[i] if tile_img[i] is not None else blank
    out_sheet[(i // cols_out) * T:(i // cols_out + 1) * T, (i % cols_out) * T:(i % cols_out + 1) * T] = im
pub = P(args.public_png)
pub.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(out_sheet, "RGBA").save(pub, optimize=True)

passability, priority, terrain_arr, tile_meta = [], [], [], []
tail_info = {count0 + k: (src, need) for k, (src, need) in enumerate(tail)}
TAGS_BASE = ["조선"]
CH_KO = {"X": "막힘", "C": "걸음(사람 위에 그려짐 ★)", "F": "걸음(바닥)"}
PASSAGE = {"X": "solid", "C": "star", "F": "passable"}


def terrain_label(gname, k):
    sp = terrain_spec[gname]
    n = len(sp["tiles"])
    if sp["kind"] == "mask16":
        return f"{sp['name']} · 이웃 마스크 {k}"
    if sp["kind"] == "blob47":
        return f"{sp['name']} · 블롭 {k % 47}" + (f" 변형 {k // 47}" if n > 47 else "")
    return f"{sp['name']} {k}" if n > 1 else sp["name"]


for t in range(count):
    cls_ch = None
    if t in tail_info:
        src, cls_ch = tail_info[t]
    elif t in piece_cell_class:
        cls_ch = piece_cell_class[t]
    if t in tile_terrain and t not in tail_info:
        gname, k = tile_terrain[t]
        sp = terrain_spec[gname]
        walkable = bool(sp["walk"])
        passability.append(dict(OPEN) if walkable else dict(SHUT))
        priority.append("lower")
        terrain_arr.append(0)
        tile_meta.append(dict(label=f"조선 · {terrain_label(gname, k)}",
                              description=f"조선 지형 {sp['name']} ({'걸음' if walkable else '막힘'}), 아래층 전용",
                              tags=TAGS_BASE + ["terrain", gname], defaultLayer="lower",
                              passage="passable" if walkable else "solid", source="bundled-default"))
        continue
    img = tile_img[t]
    if cls_ch is None or img is None or not img[..., 3].any():
        passability.append(dict(OPEN)); priority.append("lower"); terrain_arr.append(0)
        tile_meta.append(dict(label="", description="", source="bundled-default"))
        continue
    passability.append(dict(SHUT) if cls_ch == "X" else dict(OPEN))
    priority.append("lower" if cls_ch == "F" else "upper")
    terrain_arr.append(0)
    s = src if t in tail_info else t
    owner = piece_cell_owner.get(s)
    if owner:
        pname, j, i = owner
        label = f"조선 · {NM.ko_name(pname)} ({j},{i})"
        tags = TAGS_BASE + [walk[pname]["cls"], pname]
        extra_txt = f"조각 {pname} 칸 ({j},{i})"
    else:
        label = "조선 · 겹침 칸"
        tags = TAGS_BASE + ["overlap"]
        extra_txt = f"여러 조각이 겹친 칸 {s}"
    if t in tail_info:
        extra_txt += f", 칸 {s} 의 통행 복사본"
    tile_meta.append(dict(label=label, description=f"{extra_txt}: {CH_KO[cls_ch]}", tags=tags, defaultLayer="upper",
                          passage=PASSAGE[cls_ch], source="bundled-default"))

assert len(passability) == len(priority) == len(terrain_arr) == len(tile_meta) == count

# ---------------------------------------------------------------- 오토타일·묶음
autotiles = []
equiv = {}
tile_groups = []


def ids_of(gname):
    return terrain_spec[gname]["tiles"]


for gname, sp in terrain_spec.items():
    tiles = sp["tiles"]
    role = sp.get("role") or ("water" if not sp["walk"] and sp["kind"] == "blob47" else "terrain")
    kind = sp["kind"]
    gid = f"{args.prefix.rstrip('-')}:{gname}"
    if kind == "flat":
        tile_groups.append(dict(id=gid, name=sp["name"], role=role, source="bundled-default", tileIds=list(tiles),
                                defaultLayer="lower", confidence="high",
                                description=f"{sp['name']} — 평면 바닥 {len(tiles)}종(칸 번호 {tiles[0]}~{tiles[-1]}). 여러 변형을 섞어 깔면 무늬가 반복되지 않는다.",
                                placementRules="아래층 한 칸 채우기. " + ("걸어 다닐 수 있다." if sp["walk"] else "지나갈 수 없다.")))
        continue
    if kind == "mask16":
        vmap = {str(m): tiles[m & 15] for m in range(256)}
        order = [tiles[15]] + [tiles[m] for m in range(15)]
        members = list(tiles)
        eq = {t: t for t in tiles}
    elif kind == "blob47":
        base = tiles[:47]
        vmap = {str(m): base[INDEX47[canon(m)]] for m in range(256)}
        order = [base[INDEX47[255]]] + [t for t in base if t != base[INDEX47[255]]]
        members = list(tiles)
        eq = {t: base[k % 47] for k, t in enumerate(tiles)}
    else:
        raise SystemExit(f"{gname}: 알 수 없는 kind {kind}")
    connect = sorted({t for c in sp.get("connect", [gname]) if c in terrain_spec for t in terrain_spec[c]["tiles"]})
    aid = f"{args.prefix.rstrip('-').replace('-', '_')}_{gname}_autotile"
    autotiles.append(dict(id=aid, name=sp["name"], neighborhood=8, memberTileIds=sorted(members), connectTileIds=connect,
                          variantMap=vmap, edgeConnects=bool(sp.get("edgeConnects")), outsideConnects=bool(sp.get("edgeConnects"))))
    equiv[aid] = {str(a): b for a, b in eq.items()}
    tile_groups.append(dict(id=gid, name=sp["name"] + " (오토타일)", role=role, source="bundled-default", tileIds=order, defaultLayer="lower",
                            confidence="high",
                            description=f"{sp['name']} **오토타일** — 이웃 8칸 마스크로 가장자리·모서리가 저절로 맞는다"
                                        + ("(47종 블롭, 변형 2종은 같은 모양의 물결 차이)" if kind == "blob47" else "(16종: 이어진 변 N1 E2 S4 W8)")
                                        + f". 대표 몸통 {order[0]}. " + ("지나갈 수 없다." if not sp["walk"] else "걸어 다닐 수 있다."),
                            placementRules=("fill_region·lay_path 로 칠하면 둑·가장자리가 자동으로 맞는다. " if True else "")
                                           + (f"맵 가장자리 밖은 이어진 것으로 본다." if sp.get("edgeConnects") else "맵 가장자리에서는 가장자리 모양이 붙는다.")))

# 조각 묶음(조각마다 한 묶음) + 조립 부품(structureKits)
KITS = []
for name, p in objects.items():
    wk = walk[name]
    cls = wk["cls"]
    tids = [t for j in range(p["h"]) for i, t in enumerate(p["tiles"][j]) if wk["rows"][j][i] != "."]
    if not tids:
        continue
    kname = NM.ko_name(name)
    grid_txt = "/".join(wk["rows"])
    counts = {c: sum(r.count(c) for r in wk["rows"]) for c in "XCF"}
    summary = f"막힘 {counts['X']}·걸음★ {counts['C']}·걸음 {counts['F']}칸"
    tile_groups.append(dict(id=f"{args.prefix.rstrip('-')}:{name}", name=f"조선 {kname} {p['w']}×{p['h']}", role=NM.ROLE.get(cls, "prop"),
                            source="bundled-default", tileIds=tids, defaultLayer="upper", confidence="high",
                            description=f"조선 {kname}({name}) {p['w']}×{p['h']}칸 조각. 칸 통행 {summary}.",
                            placementRules="조립 부품(structureKits) " + args.prefix + name + " 로 한 번에 찍는다."))
    door = None
    if wk["steps"]:
        steps = sorted(wk["steps"], key=lambda s: abs(s[1] - (p["w"] - 1) / 2))
        door = steps[0]
    parts = []
    if door:
        parts.append(dict(id="door", kind="entrance", dx=door[1], dy=door[0], w=1, h=1,
                          note="문 앞 디딤돌 칸(걸음) — 문 칸 자체는 막힘, 그 아래 칸이 문 앞 길"))
    ovr = overrides.get("pieces", {}).get(name, {})
    if "passage" in ovr:
        pa = ovr["passage"]
        parts.append(dict(id="passage", kind="entrance", dx=min(pa["cols"]), dy=pa["from"], w=len(pa["cols"]), h=p["h"] - pa["from"],
                          note="통로(걸음) — 이 칸들을 지나 건물 반대편으로 걸어 나간다. 위쪽 같은 열은 처마·누각(★)"))
    ai_rule = {
        "built": "땅 위에. 문 칸(parts.door) 바로 아래 칸이 길이어야 한다. 이웃 건물과 1칸 이상 띄우거나 벽을 맞댄다. 지붕 좌우 처마 열은 걸을 수 있다(★).",
        "tree": "풀 위. 길·문 앞 2칸에는 두지 않는다. 수관(★)은 사람 위에 그려지고 줄기 폭 칸만 막힌다.",
        "bush": "풀 위. 아래 줄만 막히고 위 줄(★)은 사람 위에 그려진다.",
        "sapling": "풀 위. 줄기 칸만 막힌다.",
        "tuft": "풀 위 장식. 칸이 막힌다.",
        "wall": "집·마당 둘레에 이어 놓는다. 전부 막힌다.",
        "prop": "땅 위. 그림이 있는 칸이 막힌다(다리·선착장·돌계단 같은 바닥 조각은 걸을 수 있다).",
    }[cls if cls in ("built", "tree", "bush", "sapling", "tuft", "wall") else "prop"]
    kit = dict(id=f"{args.prefix}{name}", kind="section", name=f"조선 {kname} {p['w']}×{p['h']}", width=p["w"], height=p["h"], tileSize=T,
               rows=[dict(tiles=[-1] * p["w"], upperTiles=[(p["tiles"][j][i] if wk["rows"][j][i] != "." else -1) for i in range(p["w"])])
                     for j in range(p["h"])],
               learnedFrom="db-authored",
               ai=dict(description=f"조선(바람의나라풍) {kname}. 칸 통행 격자(위→아래, X 막힘/C 걸음★/F 걸음/. 없음): {grid_txt}. 윗부분 그림만 — 찍는 자리의 땅(아래층)은 그대로 둔다.",
                       placementRules=ai_rule, tags=TAGS_BASE + [NM.CLS_KO.get(cls, cls), name], role=NM.ROLE.get(cls, "prop")))
    if parts:
        kit["parts"] = parts
    if cls == "wall" and p["w"] == 1 and p["h"] <= 2:
        kit["ai"]["repeatability"] = "repeat"
        kit["ai"]["growthAxis"] = "vertical" if "_v" in name else "horizontal"
    KITS.append(kit)

# ---------------------------------------------------------------- 정의 JSON
tile_def = dict(id=args.id, name=args.name, textureKey=args.texture,
                image=str(pub.relative_to(ROOT)).replace("public/", "", 1), tileSize=T, tilesPerRow=cols_out, count=count,
                baseCount=count0, passability=passability, priority=priority, terrain=terrain_arr, tileMeta=tile_meta,
                tileGroups=tile_groups, animationStrips=[], structureKits=KITS, autotileGroups=autotiles, family=args.family)
P(args.def_json).write_text(json.dumps(tile_def, ensure_ascii=False, separators=(",", ":")))
P(args.sheet_json).write_text(json.dumps(dict(count=count, tilesPerRow=cols_out)) + "\n")

# 자기 검증
for a in autotiles:
    ms = set(a["memberTileIds"])
    assert all(v in ms for v in a["variantMap"].values()), f"{a['id']}: variantMap 값이 멤버가 아니다"
    assert all(0 <= t < count for t in ms | set(a["connectTileIds"]))

# ---------------------------------------------------------------- 맵·정답 통행
stats_maps = {}
for m in maps_out:
    Wd, Ht = m["width"], m["height"]
    ex = m["ex"]
    # 정답 통행(규칙에서 직접): 물체 클래스 X 막힘 / F 걸음 / C·없음 바닥 따라
    exp = []
    bad_ground = []
    for y in range(Ht):
        row = ""
        for x in range(Wd):
            g = tile_terrain.get(m["lower"][y * Wd + x])
            gw = bool(terrain_spec[g[0]]["walk"]) if g else False
            c = m["cls"][y][x]
            if c == "X":
                w_ = False
            elif c == "F":
                w_ = True
            else:
                w_ = gw
            row += "1" if w_ else "0"
            if ex and g:
                gk = ex["groundKind"][y][x]
                want = gk not in ("water", "paddy")
                if gw != want:
                    bad_ground.append([x, y, gk, g[0]])
        exp.append(row)
    people = ex["people"] if ex else []
    doors = []
    if ex:
        placed_by = {}
        for pl in ex["placed"]:
            placed_by.setdefault(pl["name"], []).append(pl)
        for d in ex["doors"]:
            step = None
            for pl in placed_by.get(d["piece"], []):
                if pl["y"] + pl["h"] == d["y"] and pl["x"] <= d["x"] < pl["x"] + pl["w"]:
                    st = sorted(walk[pl["name"]]["steps"], key=lambda s: abs(pl["x"] + s[1] - d["x"]))
                    if st:
                        step = [pl["x"] + st[0][1], pl["y"] + st[0][0]]
                    break
            doors.append(dict(x=d["x"], y=d["y"], piece=d["piece"], step=step))
    passages = []
    if ex:
        for pl in ex["placed"]:
            ovr = overrides.get("pieces", {}).get(pl["name"], {})
            if "passage" in ovr:
                for c in ovr["passage"]["cols"][:1]:
                    passages.append(dict(piece=pl["name"], x=pl["x"] + c, front=pl["y"] + pl["h"], behind=pl["y"] - 1,
                                         cols=[pl["x"] + cc for cc in ovr["passage"]["cols"]]))
    # 시작 칸: 지도 가운데에서 가장 가까운 길 칸(없으면 첫 문 앞)
    start = None
    if ex:
        roads = [(x, y) for y in range(Ht) for x in range(Wd) if ex["groundKind"][y][x] in ("road", "slab", "paving") and exp[y][x] == "1"]
        if roads:
            cx, cy = Wd / 2, Ht / 2
            start = list(min(roads, key=lambda c: (c[0] - cx) ** 2 + (c[1] - cy) ** 2))
    if start is None:
        start = [Wd // 2, Ht // 2]
    out = dict(id=m["id"], name=m["name"], width=Wd, height=Ht, tilesetId=args.id, lowerTiles=m["lower"], upperTiles=m["upper"],
               walk=exp, doors=doors, passages=passages, people=people, start=start)
    (OUT / "maps" / f"{m['id']}.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    stats_maps[m["id"]] = dict(source=m["map_path"], extra=m["extra_path"], size=[Wd, Ht], objectCells=sum(1 for t in m["upper"] if t >= 0),
                               walkable=sum(r.count("1") for r in exp), doors=len(doors), passages=len(passages), people=len(people),
                               start=start, shadowOnlyCells=m["shadow_only"], groundKindMismatch=len(bad_ground),
                               groundKindMismatchSamples=bad_ground[:10])

# 겹침 보고용: 클래스 분포
dist = {c: sum(1 for t in range(count) if t in piece_cell_class and piece_cell_class[t] == c and tile_meta[t].get("label")) for c in "XCF"}
(OUT / "autotile-equiv.json").write_text(json.dumps(equiv, separators=(",", ":")))
(OUT / "piece-walk.json").write_text(json.dumps(dict(
    _doc="조각별 칸 통행 격자 — 자동 규칙(lib/joseon_tileset/walk.py) + piece-walk-overrides.json. X 막힘 / C 걸음★(사람 위) / F 걸음(바닥) / . 그림 없음. build-joseon-tileset.py 가 매번 다시 쓴다(손 수정은 overrides 에).",
    pieces=walk), ensure_ascii=False, indent=0))

stats = dict(tileset=args.id, textureKey=args.texture, sourceSheet=str(P(args.sheet).relative_to(ROOT)), sourceCells=count0,
             tailCopies=len(tail), tailByClass={c: sum(1 for _, n in tail if n == c) for c in "XCF"}, count=count, tilesPerRow=cols_out,
             sheetPx=[cols_out * T, rows_out * T], pieces=len(objects), terrainGroups=len(groups), autotileGroups=len(autotiles),
             structureKits=len(KITS), tileGroups=len(tile_groups), overlapCells=ov_range["count"], overlapByClass=dict(
                 (c, sum(1 for t in range(OVL0, OVL1) if overlap_class[t] == c)) for c in "XCF"),
             pieceWalkSource=dict((s, sum(1 for v in walk.values() if v["source"] == s)) for s in ("auto", "override")),
             maps=stats_maps, warnings=warnings)
(OUT / "build-stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=1) + "\n")

# ---------------------------------------------------------------- 검토용 그림
Z = 2
names = list(objects)
Wd_img = 1800
x = y = rowh = 0
pos = []
for n in names:
    p = walk[n]
    w, h = p["w"] * T * Z + 8, p["h"] * T * Z + 6
    if x + w > Wd_img:
        x = 0; y += rowh; rowh = 0
    pos.append((x, y)); x += w; rowh = max(rowh, h)
sheet_img = np.full((y + rowh + 4, Wd_img, 4), (60, 60, 70, 255), np.uint8)
for n, (px, py) in zip(names, pos):
    p = walk[n]
    for j in range(p["h"]):
        for i in range(p["w"]):
            c = Image.fromarray(cell(objects[n]["tiles"][j][i])).resize((T * Z, T * Z), Image.NEAREST)
            bg = Image.new("RGBA", c.size, (90, 90, 100, 255)); bg.alpha_composite(c)
            a = np.array(bg)
            W.tint_cell(a, p["rows"][j][i], 0, 0, T * Z, 90)
            sheet_img[py + j * T * Z:py + (j + 1) * T * Z, px + i * T * Z:px + (i + 1) * T * Z] = a
Image.fromarray(sheet_img).convert("RGB").save(OUT / "piece-walk-overlay.png", optimize=True)

for m in maps_out:
    Wd, Ht = m["width"], m["height"]
    img = np.zeros((Ht * T, Wd * T, 4), np.uint8)
    for y in range(Ht):
        for x in range(Wd):
            for layer in (m["lower"][y * Wd + x], m["upper"][y * Wd + x]):
                if layer < 0:
                    continue
                tile = tile_img[layer] if tile_img[layer] is not None else blank
                a = tile[..., 3:4].astype(np.float32) / 255
                dst = img[y * T:(y + 1) * T, x * T:(x + 1) * T]
                dst[..., :3] = (dst[..., :3] * (1 - a) + tile[..., :3] * a).astype(np.uint8)
                dst[..., 3] = 255
    out = json.loads((OUT / "maps" / f"{m['id']}.json").read_text())
    for y in range(Ht):
        for x in range(Wd):
            if out["walk"][y][x] == "0":
                W.tint_cell(img, "X", x * T, y * T, T, 70)
    Image.fromarray(img).convert("RGB").resize((Wd * T * 1, Ht * T * 1), Image.NEAREST).save(OUT / f"walk-overlay-{m['id']}.png", optimize=True)

print(json.dumps({k: v for k, v in stats.items() if k not in ("maps", "warnings")}, ensure_ascii=False))
print(json.dumps(stats["maps"], ensure_ascii=False))
