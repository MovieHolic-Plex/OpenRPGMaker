#!/usr/bin/env python3
"""버들항 던전 「gap」 묶음 굽기 — dungeon-chipset 하네스에서 고른 조각을 공용 버들항 시트(beodeul_city) 꼬리에 덧붙인다.

  python3 scripts/content/beodeul-dungeon/bake_gap.py                 # ledger 의 현재 고름을 굽는다
  python3 scripts/content/beodeul-dungeon/bake_gap.py --dry           # 무엇을 굽는지·관문 상태만(파일을 쓰지 않는다)
  python3 scripts/content/beodeul-dungeon/bake_gap.py --assume-picks picks.json --dry
        # ledger 대신 [{"round","item","letter"}...] 를 고른 것으로 본다(해시는 지금 그림) — 파이프라인 시험용. --dry 없이는 쓰지 않는다.

무엇을(하네스 ledger `harness-data/dungeon-chipset/ledger.json` 의 gap 묶음 고름 중 그림 해시가 지금과 같은 것만 — VOID 는 건너뛴다):
  gap.rock_fill (줄 A/B/C)  → 오토타일 `beodeul_dungeon_rock_<줄>`(47 + 몸통 변형) + 앞면 키트 `bd-dg-rock-<줄>-face`(3×2)·`-face-single`(1×2)
  gap.water_edge (줄)       → 오토타일 `beodeul_dungeon_water_<줄>` — 칸마다 4장면 animationStrips(3fps)
  gap.lava_edge (줄 B/C)    → 오토타일 `beodeul_dungeon_lava_<줄>` — 4장면
  gap.ice_floor (공통)      → 오토타일 `beodeul_dungeon_ice` (얼음, 걸음) + `beodeul_dungeon_ice_ground` (얼음굴 바닥) + 키트 `bd-dg-ice-frozen-1|2`
  gap.ice_rock (공통)       → 오토타일 `beodeul_dungeon_ice_rock` + 앞면 키트 `bd-dg-ice-rock-face`·`-face-single`
  gap.door (공통)           → 키트 `bd-dg-door-closed` · `bd-dg-door-open` (1×2, 위 칸 ★)
  gap.lever (공통)          → 키트 `bd-dg-lever-up` · `bd-dg-lever-down` (벽걸이 1×1)
  gap.goblin_tent (공통)    → 키트 `bd-dg-goblin-tent` (3×3, 윗줄 ★)
  gap.bone_pile (공통)      → 키트 `bd-dg-goblin-bones` · `bd-dg-goblin-loot`
  gap.palisade (공통)       → 키트 `bd-dg-palisade-<w-end|mid|mid2|mid3|e-end>` (1×2, 위 칸 ★; 동서 한 줄만 — 세로·모서리 부품은 있어도 굽지 않는다)
  gap.campfire (공통)       → 키트 `bd-dg-goblin-campfire` (1×1, 4장면)
  gap.tower_window (공통)   → 키트 `bd-dg-tower-window-dark` · `-lit` (벽걸이 1×2)
  gap.tower_wall (공통)     → 키트 `bd-dg-tower-ring-<12|10|8>`(통째) · `bd-dg-tower-<12|10|8>-<nw|ne|sw|se>`(사분면) ·
                              `bd-dg-tower-seam-<n|s|w|e>` · `bd-dg-tower-door-n` · `bd-dg-tower-pass-s` (+A1 이면 `bd-dg-tower-roof-8-*`)
  gap.tower_stair (공통)    → 키트 `bd-dg-tower-ring-12-stair` (계단을 덧그린 12칸 링 통째 — 위층이 한 층이라 따로 못 얹는다)

칸 번호 규칙(덧붙이기 전용, 테마 담당이 기대는 계약):
  - 꼬리는 `BASE`(29,568 = 마을 성벽 꼬리 끝)부터. 칸 그림의 정본은 저장소의 `tiledata/beodeul-dungeon/gap/cells.png` + `cells.json` 이다 —
    한 번 받은 칸 번호는 다시 쓰지 않는다(그림·통행이 같으면 같은 칸을 다시 쓴다: 키 = 화소 해시 + 통행 + 층).
  - 같은 고름으로 다시 돌리면 출력이 바이트까지 같다(멱등). 고름이 늘면 새 칸만 끝에 붙는다.
  - **다시 고른 조각(같은 항목·줄에 새 후보)은 새 칸을 받는다** — 옛 칸은 시트에 그대로 남고(옛 맵이 그 번호를 칠했을 수 있다),
    키트·오토타일 id 는 새 칸을 가리키도록 바뀐다. 고른 뒤 그림이 바뀌어 VOID 가 된 항목은 굽지 않고, 전에 구운 정의를 그대로 둔다.
  - 4장면 조각은 4칸이 이어진 덩이(4의 배수 자리, 한 행 안)로 받는다. animationStrips `{baseTile, frames: 4, fps: 3}`.

3/4 관문(hard rule): 고른 후보 그림(시트·관문에 낸 그 화소)마다 object_gate.refusal(context="bundle") 이 통과(서명된 사람·위임 허용, Opus 최종 pass)하거나,
통과해야 한다(서명된 사람·위임 허용, Opus 최종 pass, 보정 프로필 pass). 미보정 프로필의 PASS 영수증은 조언일 뿐이라 막는다
(`--provisional --dry` 로만 시험). 막힌 항목은 굽지 않고, 전에 구운 그 항목의 정의도 뺀다(칸은 남는다). 나머지는 굽고 종료코드 2.
막힌 항목마다 refusal 이 보는 pixelSha256(정규화 화소 해시)·영수증 label·kind 를 출력한다 — 허용 기록은 그 해시에 남긴다.
영수증 자료는 OBJECT_GATE_DATA(없으면 저장소 harness-data/object-gate) — 검토 서버 자료는 OBJECT_GATE_DATA=…/rpg-zzu-object-gate-holds/harness-data/object-gate.

bake_wall.py 가 시트를 다시 자르면 이 꼬리가 사라지므로 그 끝에서 이 스크립트를 다시 부른다(같은 결과).
"""
import argparse, hashlib, importlib.util, json, os, pathlib, re, subprocess, sys

import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
HARNESS = ROOT / "src/harnesses/dungeon-chipset"
sys.path.insert(0, str(HARNESS))
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
import dot  # noqa: E402
import harness as H  # noqa: E402

SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
STORE = ROOT / "tiledata/beodeul-dungeon/gap"
STORE_PNG = STORE / "cells.png"
STORE_JSON = STORE / "cells.json"
T = 16
COLS = 128
BASE = 29568          # 마을 성벽 꼬리(28,544~29,567) 끝 = gap 꼬리 시작
BASE_ROW = BASE // COLS
FPS = 3
FRAMES = 4
KIT_PREFIX = "bd-dg-"
GROUP_PREFIX = "beodeul_dungeon_"
OWN_GROUPS = re.compile(r"^beodeul_dungeon_(rock|water|lava|ice)")   # 천장(beodeul_dungeon_ceiling*)은 bake_dungeon_ceiling 것
TILEGROUP_PREFIX = "beodeul:dungeon_gap"
NO = {d: False for d in ("up", "down", "left", "right")}
YES = {d: True for d in ("up", "down", "left", "right")}
LINE_NAME = {"A": "해안 흙굴", "B": "산속 바위굴", "C": "검푸른 심층굴", "*": "줄 공통"}
DUNGEON_TAGS = ["버들항", "던전", "dungeon"]
THEMES = ["dungeon", "던전", "cave", "동굴"]


# ================================================================================================ 칸 저장소(덧붙이기 전용)
class Store:
    def __init__(s):
        if STORE_JSON.exists():
            d = json.loads(STORE_JSON.read_text())
            assert d["base"] == BASE, f"저장소 base {d['base']} ≠ {BASE}"
            s.cells = d["cells"]
            s.defs = d["defs"]
            s.baked = d.get("baked", {})
            s.img = np.array(Image.open(STORE_PNG).convert("RGBA")) if STORE_PNG.exists() else np.zeros((0, COLS * T, 4), np.uint8)
        else:
            s.cells, s.defs, s.baked = [], {"autotileGroups": {}, "tileGroups": {}, "structureKits": {}}, {}
            s.img = np.zeros((0, COLS * T, 4), np.uint8)
        s.index = {}
        for i, c in enumerate(s.cells):
            if c and "key" in c:
                s.index[c["key"]] = BASE + i
        s.added = 0

    def _grow(s, n):
        rows = -(-n // COLS)
        if s.img.shape[0] < rows * T:
            pad = np.zeros((rows * T - s.img.shape[0], COLS * T, 4), np.uint8)
            s.img = np.concatenate([s.img, pad], 0)

    def _put(s, i, a):
        s._grow(i + 1)
        y, x = (i // COLS) * T, (i % COLS) * T
        s.img[y:y + T, x:x + T] = a

    def cell(s, cv, meta, origin):
        """그림 한 칸 → 칸 번호(같은 키면 그 번호)."""
        a = cell_array(cv)
        key = cell_key([a], meta)
        if key in s.index:
            return s.index[key]
        i = len(s.cells)
        s.cells.append(dict(key=key, origin=origin, **meta))
        s._put(i, a)
        s.index[key] = BASE + i
        s.added += 1
        return BASE + i

    def anim(s, cvs, meta, origin):
        """4장면 한 덩이 → 첫 칸 번호. 4의 배수 자리(한 행 안)에서 시작한다."""
        arrs = [cell_array(c) for c in cvs]
        key = cell_key(arrs, meta)
        if key in s.index:
            return s.index[key]
        while len(s.cells) % FRAMES:
            s.cells.append(None)          # 빈 칸(덩이를 행 경계에 맞춘다)
        i = len(s.cells)
        for k, a in enumerate(arrs):
            m = dict(meta)
            if k == 0:
                s.cells.append(dict(key=key, origin=origin, anim=dict(frames=FRAMES, fps=FPS), **m))
            else:
                s.cells.append(dict(frameOf=BASE + i, frame=k, origin=origin, **m))
            s._put(i + k, a)
        s.index[key] = BASE + i
        s.added += FRAMES
        return BASE + i

    def save(s):
        STORE.mkdir(parents=True, exist_ok=True)
        s._grow(max(1, len(s.cells)))
        rows = max(1, -(-len(s.cells) // COLS))
        Image.fromarray(np.ascontiguousarray(s.img[:rows * T]), "RGBA").save(STORE_PNG, optimize=True)
        STORE_JSON.write_text(json.dumps(dict(base=BASE, cells=s.cells, defs=s.defs, baked=s.baked), ensure_ascii=False, indent=0) + "\n")

    def rows(s):
        return max(1, -(-len(s.cells) // COLS))


def cell_array(cv):
    a = (cv.a if isinstance(cv, dot.Cv) else np.array(cv.convert("RGBA"))).copy()
    assert a.shape == (T, T, 4), a.shape
    a[a[:, :, 3] == 0] = 0
    return a


def cell_key(arrs, meta):
    h = hashlib.sha256()
    for a in arrs:
        h.update(a.tobytes())
    h.update(json.dumps([meta.get("passage"), meta.get("layer")]).encode())
    return h.hexdigest()[:24]


def cm(label, desc, tags, passage, layer):
    """칸 메타(저장소에 그대로 남는다)."""
    return dict(label=label, description=desc, tags=DUNGEON_TAGS + tags, passage=passage, layer=layer)


# ================================================================================================ 관문
_PROFILE = None


def current_profile():
    global _PROFILE
    if _PROFILE:
        return _PROFILE
    out = subprocess.run(["npm", "run", "-s", "harness", "--", "object-gate", "status"], cwd=ROOT, capture_output=True, text=True).stdout
    m = re.search(r"현재 규칙 프로필 ([0-9a-f]{16})", out)
    if not m:
        raise RuntimeError("현재 판정 프로필 해시를 못 읽었다(object-gate status)")
    _PROFILE = m.group(1)
    return _PROFILE


def gate_state(img, strict=True):
    """('pass'|'provisional', 영수증 요약) 또는 (None, 이유). pass = object_gate.refusal 통과(서명 허용·최종 판정·보정 프로필)."""
    import object_gate as OG
    why = OG.refusal(img, kind=None, context="bundle")
    sha = OG.pixel_sha256(img)
    rc = OG.read_receipt(sha)
    if why is None:
        held = OG.read_hold_decision(sha)
        via = f"{held.get('by')} allow" if held and OG.human_decision(held, rc) == "allow" else "receipt"
        return "pass", f"{(rc or {}).get('kind')} {via}"
    if strict or not rc:
        return None, why
    held = OG.read_hold_decision(sha)
    if OG.human_decision(held, rc) == "reject" or OG.final_applies(OG.read_final(sha), sha):
        return None, why
    if rc.get("profileHash") == current_profile() and rc.get("verdict") == "pass":
        return "provisional", f"{rc.get('kind')} pass(프로필 {rc.get('profileHash')} 미보정)"
    return None, why


# ================================================================================================ 고름
def current_picks(assume=None):
    """[(pick, line)] — gap 묶음, 그림 해시가 지금과 같은 것만. assume = 시험용 고름 목록."""
    items = H.items_by_id()
    if assume:
        out = []
        for p in json.load(open(assume)):
            line = H.COMMON if H.common(p["item"]) else H.line_of(p["letter"])
            out.append((dict(p, line=line, sha256=None, by="assumed"), line))
        return out, []
    out, void = [], []
    for (item, line), (p, st) in sorted(H.pick_state().items()):
        if items.get(item, {}).get("wave") != "gap":
            continue
        (out if st == "current" else void).append((p, line))
    return out, void


_MODS = {}


def mod(rid):
    if rid not in _MODS:
        _MODS[rid] = H.load_round(rid)
    return _MODS[rid]


def render(p):
    m = mod(p["round"])
    cv, meta = m.CANDIDATES[p["item"]][p["letter"]]()
    return m, cv, meta


# ================================================================================================ 굽는 손
def bake_autotile(st, at, gid, name, origin, cmeta, connect_extra=()):
    """정적 오토타일 → 그룹 정의. 47 모양(정규 마스크) + 몸통 변형(interiorVariants 한 단, 엔진 cellHash 로 고른다 = dot.tile_at)."""
    by = {}
    for m in sorted(set(dot.canon(k) for k in range(256))):
        by[m] = st.cell(at.tile(m), cmeta(m), origin)
    bodies = [by[255]] + [st.cell(b, cmeta(255), origin) for b in at.bodies[1:]]
    members = sorted(set(by.values()) | set(bodies))
    g = dict(id=gid, name=name, neighborhood=8, edgeConnects=True, memberTileIds=members,
             connectTileIds=sorted(set(members) | set(connect_extra)),
             variantMap={str(k): by[dot.canon(k)] for k in range(256)})
    if len(bodies) > 1:
        g["interiorVariants"] = [bodies]
    return g


def bake_autotile_anim(st, frames, gid, name, origin, cmeta):
    """4장면 오토타일: 모양·몸통마다 4칸 덩이. variantMap 은 첫 장면 칸."""
    assert len(frames) == FRAMES, len(frames)
    by = {}
    for m in sorted(set(dot.canon(k) for k in range(256))):
        by[m] = st.anim([f.tile(m) for f in frames], cmeta(m), origin)
    nb = len(frames[0].bodies)
    bodies = [by[255]] + [st.anim([f.bodies[j] for f in frames], cmeta(255), origin) for j in range(1, nb)]
    members = sorted(set(by.values()) | set(bodies))
    g = dict(id=gid, name=name, neighborhood=8, edgeConnects=True, memberTileIds=members, connectTileIds=list(members),
             variantMap={str(k): by[dot.canon(k)] for k in range(256)})
    if len(bodies) > 1:
        g["interiorVariants"] = [bodies]
    return g


def mask_sides(m):
    return "".join(n for b, n in ((1, "북"), (2, "동"), (4, "남"), (8, "서")) if not (m & b))


def kit(kid, name, w, h, upper, lower=None, desc="", rules="", tags=(), role="prop", repeat="fixed", layer_home="upper", themes=THEMES, parts=None):
    rows = []
    for y in range(h):
        rows.append(dict(tiles=[(lower[y][x] if lower else -1) for x in range(w)], upperTiles=[upper[y][x] for x in range(w)]))
    k = dict(id=kid, kind="section" if repeat == "repeat" else "object", name=name, width=w, height=h, tileSize=T, rows=rows, learnedFrom="db-authored",
             ai=dict(description=desc, placementRules=rules, tags=["버들항", "던전"] + list(tags), role=role, repeatability=repeat,
                     layerHome=layer_home, themes=list(themes)))
    if parts:
        k["parts"] = parts
    return k


def object_cells(st, part, walk, origin, label, desc, tags, drop_alpha=False):
    """part(Cv) → 칸 번호 행렬(투명 칸 -1). walk[y][x] ∈ 'x'(막힘) 'o'(걸음) '★'(위 칸, 사람 위에 그림)."""
    w, h = part.w // T, part.h // T
    assert part.w % T == 0 and part.h % T == 0, (label, part.w, part.h)
    out = []
    for y in range(h):
        row = []
        for x in range(w):
            c = part.crop(x * T, y * T, T, T)
            if drop_alpha:
                c.a[c.a[:, :, 3] < 255] = 0
            if not c.a[:, :, 3].any():
                row.append(-1)
                continue
            wch = walk[y][x]
            passage = {"x": "solid", "o": "passable", "★": "star"}[wch]
            row.append(st.cell(c, cm(label + (f" ({x},{y})" if w * h > 1 else ""), desc, tags, passage, "upper"), origin))
        out.append(row)
    return out


def default_walk(w, h, top_star=True):
    """윗줄만 ★(h > 1), 나머지 막힘."""
    return [["★" if (top_star and h > 1 and y == 0) else "x" for _ in range(w)] for y in range(h)]


# ---------------------------------------------------------------------------------------------- 항목별
def bake_rock(st, p, line, meta, origin):
    at = meta["autotiles"].get("rock") or meta["autotiles"].get("ceil")
    face = meta["faces"]["face"]
    ice = p["item"] == "gap.ice_rock"
    gid = f"{GROUP_PREFIX}ice_rock" if ice else f"{GROUP_PREFIX}rock_{line}"
    what = "얼음 바위(서리 윗면)" if ice else f"바위 채움 {line}({LINE_NAME[line]})"
    def cmeta(m):
        s = mask_sides(m)
        return cm(f"버들항 던전 · {what} 천장 윗면" + (f"({s} 열림)" if s else " 몸통"),
                  f"방 사이를 채우는 {what} 윗면 오토타일(마스크 {m}). 막힘. 그룹 `{gid}`. 바닥·벽 앞면과 닿는 쪽에 불규칙한 바위 윤곽.",
                  ["천장", "wall", "ceiling", "rock"], "solid", "lower")
    g = bake_autotile(st, at, gid, f"버들항 던전 {what}", origin, cmeta)
    fk = "ice-rock" if ice else f"rock-{line}"
    cells = {}
    for lv in (0, 1):
        for lo, ro, nm in ((True, False, "서끝"), (False, False, "가운데"), (False, True, "동끝"), (True, True, "홑칸")):
            cells[(lv, nm)] = st.cell(face.tile(lv, lo, ro), cm(f"버들항 던전 · {what} 앞면 {'윗단' if lv == 0 else '아랫단'} {nm}",
                                                               f"{what} 의 남쪽 벽 앞면 2단(윗단 = 천장 바로 밑, 아랫단 = 바닥에 닿음). 막힘.",
                                                               ["벽", "wall", "face", "rock"], "solid", "lower"), origin)
    nms = ("서끝", "가운데", "동끝")
    lower = [[cells[(lv, n)] for n in nms] for lv in (0, 1)]
    kits = [
        kit(f"{KIT_PREFIX}{fk}-face", f"버들항 던전 · {what} 벽 앞면 3×2", 3, 2, [[-1] * 3] * 2, lower,
            desc=f"{what} 아래 남쪽 벽 앞면 2단 — 열 0 서끝(왼쪽 마구리) · 1 가운데(가로 반복) · 2 동끝. 윗면 오토타일 `{gid}` 바로 밑에 놓는다.",
            rules="바닥 북쪽 변 바로 위 두 줄. 가로로 늘릴 때는 가운데 열을 반복하고 양 끝에 서끝·동끝. 한 칸 폭 벽은 face-single.",
            tags=["벽", "앞면", "rock"], role="wall", repeat="repeat", layer_home="lower"),
        kit(f"{KIT_PREFIX}{fk}-face-single", f"버들항 던전 · {what} 벽 앞면 한 칸 1×2", 1, 2, [[-1]] * 2,
            [[cells[(0, "홑칸")]], [cells[(1, "홑칸")]]],
            desc=f"{what} 앞면 2단의 홑칸(양쪽 마구리).", rules="양옆에 같은 줄 앞면이 없는 한 칸 폭 벽.", tags=["벽", "앞면", "rock"],
            role="wall", layer_home="lower"),
    ]
    tg = dict(id=f"{TILEGROUP_PREFIX}_{fk}", name=f"버들항 던전 {what}", role="wall", source="bundled-default", defaultLayer="lower", confidence="high",
              tileIds=sorted(set(g["memberTileIds"]) | set(cells.values())),
              description=f"검은 허공 대신 결 있는 {what} 윗면 오토타일 `{gid}` + 남쪽 앞면 2단(키트 `{KIT_PREFIX}{fk}-face`). 하네스 dungeon-chipset {p['round']} {p['letter']}.",
              placementRules="방·통로 바깥 칸을 오토타일로 칠하고(이웃이 같은 윗면이면 연결), 바닥 북쪽 변 위 두 줄은 앞면 키트. author_dungeon 이 저절로 쓴다.")
    return [g], [tg], kits


def bake_liquid(st, p, line, meta, origin):
    lava = p["item"] == "gap.lava_edge"
    kind = "lava" if lava else "water"
    frames = meta["frames"][kind]
    gid = f"{GROUP_PREFIX}{kind}_{line}"
    what = ("용암" if lava else "물") + f" {line}({LINE_NAME[line]})"
    def cmeta(m):
        s = mask_sides(m)
        return cm(f"버들항 던전 · {what}" + (f" 가장자리({s} 열림)" if s else " 몸통"),
                  f"동굴 바닥 ↔ {what} 가장자리 오토타일(마스크 {m}, 4장면 3fps). 막힘. 그룹 `{gid}`.",
                  ["lava" if lava else "water", "용암" if lava else "물"] + (["water"] if lava else []), "solid", "lower")
    g = bake_autotile_anim(st, frames, gid, f"버들항 던전 {what}", origin, cmeta)
    tg = dict(id=f"{TILEGROUP_PREFIX}_{kind}_{line}", name=f"버들항 던전 {what}", role="water", source="bundled-default", defaultLayer="lower",
              confidence="high", tileIds=list(g["memberTileIds"]),
              description=f"{what} 웅덩이 오토타일 `{gid}` — 둥근 물가·식은 껍질 가장자리, 몸통만 4장면으로 움직인다(animationStrips). 하네스 {p['round']} {p['letter']}.",
              placementRules="물·용암 칸을 이 그룹으로 칠한다(이웃이 같은 액체면 연결). 걸을 수 없다. 다리는 위층 키트로 얹는다.")
    return [g], [tg], []


def bake_ice_floor(st, p, line, meta, origin):
    ice, ground = meta["autotiles"]["ice"], meta["autotiles"]["ground"]
    gid_i, gid_g = f"{GROUP_PREFIX}ice", f"{GROUP_PREFIX}ice_ground"
    def mi(m):
        s = mask_sides(m)
        return cm("버들항 던전 · 얼음 바닥" + (f"({s} 열림)" if s else " 몸통"), f"얼음 동굴의 걷는 얼음 바닥 오토타일(마스크 {m}). 걸음(미끄럼 이벤트 자리). 그룹 `{gid_i}`.",
                  ["얼음", "ice", "floor"], "passable", "lower")
    def mg(m):
        s = mask_sides(m)
        return cm("버들항 던전 · 얼음굴 바닥" + (f"({s} 열림)" if s else " 몸통"), f"얼음 동굴의 다진 눈·바위 바닥 오토타일(마스크 {m}). 걸음. 그룹 `{gid_g}`.",
                  ["얼음", "눈", "floor"], "passable", "lower")
    gi = bake_autotile(st, ice, gid_i, "버들항 던전 얼음 바닥", origin, mi)
    gg = bake_autotile(st, ground, gid_g, "버들항 던전 얼음굴 바닥", origin, mg)
    kits = []
    for i, (nm, t) in enumerate((meta.get("tiles") or {}).items()):
        tid = st.cell(t, cm(f"버들항 던전 · {nm}", "얼음 바닥 몸통 칸 대신 깔 수 있는 얼음 속에 갇힌 돌.", ["얼음", "ice"], "passable", "lower"), origin)
        kits.append(kit(f"{KIT_PREFIX}ice-frozen-{i + 1}", f"버들항 던전 · {nm}", 1, 1, [[-1]], [[tid]],
                        desc=f"{nm} — 얼음 바닥(`{gid_i}`) 몸통 칸(8방이 다 얼음) 하나를 바꿔 깐다.", rules="얼음 바닥 한가운데 칸에만, 드문드문.",
                        tags=["얼음", "바닥"], role="floor", layer_home="lower"))
    tg = dict(id=f"{TILEGROUP_PREFIX}_ice_floor", name="버들항 던전 얼음 바닥·얼음굴 바닥", role="floor", source="bundled-default", defaultLayer="lower",
              confidence="high", tileIds=sorted(set(gi["memberTileIds"]) | set(gg["memberTileIds"])),
              description=f"얼음 동굴 바닥: 얼음굴 바닥 `{gid_g}`(벽과 만나는 쪽 서리 가장자리) 위에 얼음 웅덩이 `{gid_i}`. 하네스 {p['round']} {p['letter']}.",
              placementRules="걷는 칸 전부를 얼음굴 바닥으로, 그 안 덩이를 얼음으로 칠한다. 얼음 칸은 미끄럼 이벤트 자리.")
    return [gi, gg], [tg], kits


WALK_DOOR = {"닫힘": ["★", "x"], "열림": ["★", "o"]}
# 2026-10-23 씨앗: 동서 한 줄만(size [5,2]). 옛 8부품 모듈(세로·서모서리·동모서리)이 와도 이 다섯만 굽는다.
PALISADE_IDS = {"서끝": "w-end", "가운데": "mid", "가운데2": "mid2", "가운데3": "mid3", "동끝": "e-end"}


def bake_props(st, p, line, meta, origin):
    item, parts = p["item"], meta["parts"]
    kits, ids = [], set()
    def add(k):
        kits.append(k)
        for r in k["rows"]:
            ids.update(t for t in r["upperTiles"] + r["tiles"] if t >= 0)
    if item == "gap.door":
        for nm, kid in (("닫힘", "closed"), ("열림", "open")):
            up = object_cells(st, parts[nm], [list(r) for r in WALK_DOOR[nm]], origin, f"버들항 던전 · 문 {nm}",
                              f"돌 문틀 + 쇠띠 나무 문({nm}). 아래 칸 {'막힘' if nm == '닫힘' else '걸음'}, 위 칸 ★.", ["문", "door"])
            add(kit(f"{KIT_PREFIX}door-{kid}", f"버들항 던전 · 문 {nm} 1×2", 1, 2, up,
                    desc=f"벽 앞면 2단에 박는 던전 문({nm}). 상태 짝: `{KIT_PREFIX}door-closed` ↔ `{KIT_PREFIX}door-open` — 이벤트가 문을 열 때 같은 칸에 바꿔 찍는다.",
                    rules="벽 앞면 두 줄(윗단·아랫단)에 맞춰 걸고 바로 남쪽 칸은 걷는 바닥으로 비운다. 이동 이벤트는 아래 칸.", tags=["문", "door", "퍼즐"]))
    elif item == "gap.lever":
        for nm, kid in (("올림", "up"), ("내림", "down")):
            up = object_cells(st, parts[nm], [["x"]], origin, f"버들항 던전 · 레버 {nm}", f"벽 앞면에 박힌 쇠 판 + 자루({nm}).", ["레버", "lever"])
            add(kit(f"{KIT_PREFIX}lever-{kid}", f"버들항 던전 · 벽 레버 {nm}", 1, 1, up,
                    desc=f"벽 레버({nm}). 상태 짝 `{KIT_PREFIX}lever-up` ↔ `{KIT_PREFIX}lever-down` — 조사 이벤트가 바꿔 찍는다.",
                    rules="벽 앞면 아랫단(바닥 바로 위 줄)에 건다. 바로 남쪽 바닥 칸에서 조사한다.", tags=["레버", "lever", "퍼즐"]))
    elif item == "gap.goblin_tent":
        part = next(iter(parts.values()))
        w, h = part.w // T, part.h // T
        up = object_cells(st, part, default_walk(w, h, top_star=True) if h > 1 else default_walk(w, h), origin, "버들항 던전 · 고블린 천막",
                          "막대에 꿰맨 가죽을 덮은 너덜너덜한 천막. 윗줄 ★, 나머지 막힘.", ["고블린", "천막", "goblin"])
        add(kit(f"{KIT_PREFIX}goblin-tent", f"버들항 던전 · 고블린 가죽 천막 {w}×{h}", w, h, up,
                desc="고블린 야영지의 가죽 천막.", rules="걷는 바닥 위에. 아래 줄들 막힘, 윗줄 ★. 모닥불 곁에 하나.", tags=["고블린", "천막", "야영"]))
    elif item == "gap.bone_pile":
        for nm, kid in (("뼈", "bones"), ("약탈품", "loot")):
            up = object_cells(st, parts[nm], [["x"]], origin, f"버들항 던전 · 고블린 {nm} 더미", f"갉아먹은 {nm} 더미.", ["고블린", "goblin", nm])
            add(kit(f"{KIT_PREFIX}goblin-{kid}", f"버들항 던전 · {nm} 더미", 1, 1, up, desc=f"고블린 야영지의 {nm} 더미.",
                    rules="걷는 바닥 위, 벽가·구석에. 막힘.", tags=["고블린", nm]))
    elif item == "gap.palisade":
        missing = [nm for nm in PALISADE_IDS if nm not in parts]
        if missing:
            raise SystemExit(f"gap.palisade: 부품 {missing} 이 없다 — 동서 한 줄 다섯 부품(서끝·가운데·가운데2·가운데3·동끝)이 필요하다. 받은 부품: {list(parts)}")
        skipped = [nm for nm in parts if nm not in PALISADE_IDS]
        if skipped:
            print(f"  gap.palisade: 동서 한 줄 밖 부품 {skipped} 는 굽지 않는다")
        for nm, kid in PALISADE_IDS.items():
            part = parts[nm]
            up = object_cells(st, part, default_walk(1, part.h // T), origin, f"버들항 던전 · 말뚝 울 {nm}", "끝을 깎은 말뚝을 밧줄로 엮은 울. 아래 칸 막힘, 위 칸 ★.",
                              ["고블린", "울타리", "palisade"])
            add(kit(f"{KIT_PREFIX}palisade-{kid}", f"버들항 던전 · 말뚝 울 {nm} 1×2", 1, part.h // T, up,
                    desc=f"고블린 말뚝 울 조각 「{nm}」. 동서 한 줄 = 서끝 + 가운데(가운데·가운데2·가운데3 섞어 반복) + 동끝. 세로 줄·모서리는 없다.",
                    rules="걷는 바닥 위 한 줄로. 아래 칸 막힘 — 야영지 입구 한 칸은 비운다.", tags=["고블린", "울타리"], repeat="repeat" if "가운데" in nm else "fixed"))
    elif item == "gap.campfire":
        frames = list(parts.values())
        assert len(frames) == FRAMES, len(frames)
        head = st.anim(frames, cm("버들항 던전 · 고블린 모닥불", "돌 고리 + 장작 + 꼬챙이 고기, 불꽃 4장면 3fps. 막힘.", ["고블린", "모닥불", "fire"], "solid", "upper"), origin)
        add(kit(f"{KIT_PREFIX}goblin-campfire", "버들항 던전 · 고블린 모닥불(움직임)", 1, 1, [[head]],
                desc="고블린 야영지 모닥불. 칸 하나가 4장면 animationStrips 로 움직인다.", rules="걷는 바닥 한가운데 쪽, 둘레 한 칸은 비운다. 막힘.",
                tags=["고블린", "모닥불", "야영"]))
    elif item == "gap.tower_window":
        for nm, kid in (("어두운 구멍", "dark"), ("빛 드는 구멍", "lit")):
            part = parts[nm]
            up = object_cells(st, part, [["x"]] * (part.h // T), origin, f"버들항 던전 · 화살 구멍 창({nm})", "탑 안벽 앞면에 파 넣은 화살 구멍.", ["탑", "창", "window"])
            add(kit(f"{KIT_PREFIX}tower-window-{kid}", f"버들항 던전 · 화살 구멍 창 {nm} 1×{part.h // T}", 1, part.h // T, up,
                    desc=f"벽 앞면 2단에 박는 좁은 화살 구멍({nm}).", rules="벽 앞면 윗단·아랫단 두 줄에 걸친다(벽걸이). 같은 벽에 두세 칸 간격으로.",
                    tags=["탑", "창", "window"]))
    else:
        raise ValueError(item)
    tg = dict(id=f"{TILEGROUP_PREFIX}_{item.split('.')[1]}", name=f"버들항 던전 {H.items_by_id()[item]['title']}", role="object", source="bundled-default",
              defaultLayer="upper", confidence="high", tileIds=sorted(ids),
              description=f"{H.items_by_id()[item]['title']} — 키트 {', '.join(k['id'] for k in kits)}. 하네스 {p['round']} {p['letter']}.",
              placementRules=kits[0]["ai"]["placementRules"])
    return [], [tg], kits


TOWER_CELL_HALF = T * T // 2
TOWER_THEMES = ["tower", "탑", "castle", "성", "dungeon", "던전"]


def tower_assembler(st, m, c, origin):
    """둥근 탑 조립 손: (링 그림, 화소 종류) 의 한 구역 → (아래층 칸 행렬, 위층 칸 행렬).
    통행 = 칸 안 화소 종류: 안벽 앞면(face) 화소가 있으면 막힘, 바닥·둘레 판석이 반 이상이면 걸음(위 그림은 ★), 그 밖은 막힘.
    아래층 = 판 모듈 under(바닥 타일 또는 어둠). overlay(같은 좌표 투명 그림, 예: 계단)가 있으면 위층에 덧그리고 그 칸은 걸음(passable)."""
    void_id = st.cell(m.VOID, cm("버들항 던전 · 탑 바깥 어둠", "둥근 탑 링 바깥의 어둠. 막힘.", ["천장", "wall", "ceiling", "탑"], "solid", "lower"), origin)
    floor_ids = {}

    def lower_id(t):
        k = cell_array(t).tobytes()
        if k not in floor_ids:
            floor_ids[k] = st.cell(t, cm("버들항 던전 · 탑 바닥", "둥근 탑 방 바닥(널·판돌·둘레 판석). 걸음.", ["탑", "floor", "바닥"], "passable", "lower"), origin)
        return floor_ids[k]

    def assemble(rv, kind, x0, y0, w, h, force_walk=False, label="", overlay=None):
        und = m.under(kind, rv.w, rv.h, c)
        cnt = {}
        for (x, y), k in kind.items():
            d = cnt.setdefault((int(x) // T, int(y) // T), {})
            d[k] = d.get(k, 0) + 1
        cells_floor = m.floor_cells(kind)
        lo, up = [], []
        for j in range(h // T):
            lr, ur = [], []
            for i in range(w // T):
                ci, cj = x0 // T + i, y0 // T + j
                cc = cnt.get((ci, cj), {})
                is_floor = force_walk or cells_floor.get((ci, cj)) == "floor"
                walk = force_walk or (cc.get("face", 0) == 0 and cc.get("floor", 0) + cc.get("course", 0) >= TOWER_CELL_HALF)
                t = und.crop(ci * T, cj * T, T, T)
                if is_floor and not t.a[:, :, 3].all():
                    t = m.grid(c["floor"], c["leg"])
                lr.append(lower_id(t) if is_floor else void_id)
                cut = rv.crop(ci * T, cj * T, T, T)
                cut.a[cut.a[:, :, 3] < 255] = 0
                over = False
                if overlay is not None:
                    o = overlay.crop(ci * T, cj * T, T, T)
                    o.a[o.a[:, :, 3] < 255] = 0
                    if o.a[:, :, 3].any():
                        over = True
                        cut.paste(o, 0, 0)
                if cut.a[:, :, 3].any():
                    passage = "passable" if over else ("star" if (walk and is_floor) else "solid")
                    ur.append(st.cell(cut, cm(f"버들항 던전 · 탑 {label}", "둥근 탑 방(윗면 띠·안벽 앞면·둘레 판석" + (" + 계단" if over else "") + ").",
                                              ["탑", "wall", "tower"] + (["계단", "stairs"] if over else []), passage, "upper"), origin))
                else:
                    ur.append(-1)
            lo.append(lr)
            up.append(ur)
        return lo, up
    return assemble


def kit_ids(kits):
    ids = set()
    for k in kits:
        for r in k["rows"]:
            ids.update(t for t in r["tiles"] + r["upperTiles"] if t >= 0)
    return sorted(ids)


def bake_tower_stair(st, p, line, meta, origin):
    """계단은 12칸 링 좌표의 그림(판 모듈 stair_layer)이다 — 위층이 한 층뿐이라 링 위 그림과 같은 칸에 따로 못 얹는다.
    그래서 계단을 덧그린 12칸 링 통째 키트 `bd-dg-tower-ring-12-stair` 로 굽는다(링 결 = 같은 후보). 계단 칸은 걸음."""
    m = mod(p["round"])
    c = getattr(m, p["letter"])
    assemble = tower_assembler(st, m, c, origin)
    rv, kind, geo, top = m.ring(c, m.STAIR_RO)
    lay = m.stair_layer(p["letter"], c)
    lo, up = assemble(rv, kind, 0, 0, rv.w, rv.h, label="12칸 계단 링", overlay=lay)
    N = rv.w // T
    kits = [kit(f"{KIT_PREFIX}tower-ring-12-stair", f"버들항 던전 · 둥근 탑 방 12칸 + 벽 계단 {N}×{N}", N, N, up, lo,
                desc="12칸 둥근 탑 방 한 층 + 안벽을 따라 오르는 돌계단(계단참·아치). 계단 칸은 걸음, 계단 끝(아치) 칸에 다음 층 이동 이벤트.",
                rules="bd-dg-tower-ring-12 대신 통째로 찍는다(같은 링 + 계단). 위층이 한 층이라 계단만 따로 링 위에 얹을 수 없다.",
                tags=["탑", "계단", "tower", "stairs"], role="structure", layer_home="lower", themes=TOWER_THEMES)]
    tg = dict(id=f"{TILEGROUP_PREFIX}_tower_stair", name="버들항 던전 탑 벽 계단", role="object", source="bundled-default", defaultLayer="upper", confidence="high",
              tileIds=kit_ids(kits), description=f"12칸 탑 링 + 벽 계단(키트 {kits[0]['id']}). 하네스 {p['round']} {p['letter']}.",
              placementRules=kits[0]["ai"]["placementRules"])
    return [], [tg], kits


def bake_tower_wall(st, p, line, meta, origin):
    """둥근 탑 키트: 판 모듈의 ring/under(같은 후보 결 표)로 링 통째·사분면·이음·문·통로를 다시 조립한다.
    고른 그림(칸 나눔 판)은 이 조각들을 떼어 늘어놓은 것이라 해시가 같으면 조각도 같다."""
    m = mod(p["round"])
    c = getattr(m, p["letter"])
    assemble = tower_assembler(st, m, c, origin)
    kits = []
    sizes = {96: "12", 80: "10", 64: "8"}
    for Ro, lab in m.SIZES:
        n = sizes[Ro]
        rv, kind, geo, top = m.ring(c, Ro)
        N = 2 * Ro // T
        lo, up = assemble(rv, kind, 0, 0, rv.w, rv.h, label=f"{n}칸")
        kits.append(kit(f"{KIT_PREFIX}tower-ring-{n}", f"버들항 던전 · 둥근 탑 방 {n}칸 링 {N}×{N}", N, N, up, lo,
                        desc=f"지름 {n}칸 둥근 탑 방 한 층(위에서 본 3/4: 북쪽 호 = 벽 윗면 띠 + 안벽 앞면 2단, 남쪽 호 = 띠만). 아래층 = 바닥·바깥 어둠, 위층 = 둘레 벽.",
                        rules="빈 맵(또는 천장으로 채운 자리)에 통째로 찍는다. 들어오는 문은 bd-dg-tower-door-n(10칸 북쪽), 나가는 통로는 bd-dg-tower-pass-s 를 같은 자리 칸에 덮어 찍는다.",
                        tags=["탑", "tower", "방"], role="structure", layer_home="lower", themes=TOWER_THEMES))
        q = Ro // T
        for qn, (qx, qy) in (("nw", (0, 0)), ("ne", (Ro, 0)), ("sw", (0, Ro)), ("se", (Ro, Ro))):
            lo, up = assemble(rv, kind, qx, qy, Ro, Ro, label=f"{n}칸 {qn}")
            kits.append(kit(f"{KIT_PREFIX}tower-{n}-{qn}", f"버들항 던전 · 탑 {n}칸 링 사분면 {qn.upper()} {q}×{q}", q, q, up, lo,
                            desc=f"{n}칸 링을 가운데 열·행에서 자른 사분면 {qn.upper()}. 넷을 붙이면 둥근 방, 사이에 이음(seam)을 끼우면 긴 방.",
                            rules="사분면 넷을 붙여 찍는다. 가로로 늘리려면 북·남 사분면 사이에 seam-n(위)·seam-s(아래), 세로로 늘리려면 서·동 사이에 seam-w·seam-e.",
                            tags=["탑", "tower"], role="structure", layer_home="lower", themes=TOWER_THEMES))
    L2 = 2 * T
    rx, kx, _, _ = m.ring(c, 64, Lx=L2)
    ry, ky, _, _ = m.ring(c, 64, Ly=L2)
    for nm, (rv, kind, x, y, w, h), what in (
            ("seam-n", (rx, kx, 64, 0, L2, 64), "북 이음(가로 반복) 2×4"), ("seam-s", (rx, kx, 64, rx.h - 32, L2, 32), "남 이음(가로 반복) 2×2"),
            ("seam-w", (ry, ky, 0, 64, 32, L2), "서 이음(세로 반복) 2×2"), ("seam-e", (ry, ky, ry.w - 32, 64, 32, L2), "동 이음(세로 반복) 2×2")):
        lo, up = assemble(rv, kind, x, y, w, h, label=what)
        kits.append(kit(f"{KIT_PREFIX}tower-{nm}", f"버들항 던전 · 탑 {what}", w // T, h // T, up, lo,
                        desc=f"탑 링 {what} — 세 크기 링이 같이 쓴다.", rules="사분면 사이에 끼워 링을 늘린다(같은 줄 맞춤).",
                        tags=["탑", "tower", "이음"], role="structure", repeat="repeat", layer_home="lower", themes=TOWER_THEMES))
    r10, k10, g10, _ = m.ring(c, 80)
    m.cut_door(r10, k10, g10, 80, c)
    lo, up = assemble(r10, k10, 80 - T, 0, 2 * T, 64, label="북 문")
    kits.append(kit(f"{KIT_PREFIX}tower-door-n", "버들항 던전 · 탑 북쪽 아치 문 2×4", 2, 4, up, lo,
                    desc="10칸 링 북쪽 가운데 안벽에 뚫린 아치 문(문틀 + 문 안 어둠). 링 위 같은 자리에 덮어 찍는다.",
                    rules="10칸 링이면 링 원점 +(4,0). 이동 이벤트는 문 아래 칸(앞면 아랫단).", tags=["탑", "문", "tower"], role="structure", layer_home="lower",
                    themes=TOWER_THEMES))
    r8, k8, g8, _ = m.ring(c, 64)
    m.cut_passage(r8, k8, g8, 64, c)
    lo, up = assemble(r8, k8, 64 - T, 128 - 32, 2 * T, 32, force_walk=True, label="남 통로")
    kits.append(kit(f"{KIT_PREFIX}tower-pass-s", "버들항 던전 · 탑 남쪽 통로 2×2", 2, 2, up, lo,
                    desc="8칸 링 남쪽 띠를 끊은 통로(문턱 판석 + 솟은 문설주). 걸음.", rules="8칸 링이면 링 원점 +(3,6). 남쪽으로 복도를 잇는다.",
                    tags=["탑", "통로", "tower"], role="structure", layer_home="lower", themes=TOWER_THEMES))
    if hasattr(m, "roof_parts") and any(k.startswith("지붕층") for k in meta["parts"]):
        rv, kind, _, top = m.ring(c, 64, roof=True)
        mid = top + 64
        for qn, (qx, qy, w, h) in (("nw", (0, 0, 64, mid)), ("ne", (64, 0, 64, mid)), ("sw", (0, mid, 64, rv.h - mid)), ("se", (64, mid, 64, rv.h - mid))):
            lo, up = assemble(rv, kind, qx, qy, w, h, label=f"지붕층 {qn}")
            kits.append(kit(f"{KIT_PREFIX}tower-roof-8-{qn}", f"버들항 던전 · 탑 지붕층 8칸 {qn.upper()}", w // T, h // T, up, lo,
                            desc="탑 꼭대기 층 성가퀴(8칸 링 사분면).", rules="사분면 넷을 붙여 찍는다.", tags=["탑", "지붕", "tower"], role="structure",
                            layer_home="lower", themes=TOWER_THEMES))
    ids = kit_ids(kits)
    tg = dict(id=f"{TILEGROUP_PREFIX}_tower_wall", name="버들항 던전 둥근 탑 둘레 벽", role="wall", source="bundled-default", defaultLayer="upper", confidence="high",
              tileIds=sorted(ids), description=f"둥근 탑 방 키트(링 12·10·8칸 통째·사분면·이음·문·통로). 하네스 {p['round']} {p['letter']}.",
              placementRules="탑 한 층 = 링 키트 하나(또는 사분면 + 이음). 문·통로 키트를 같은 자리에 덮어 찍는다.")
    return [], [tg], kits


HANDLERS = {
    "gap.rock_fill": bake_rock, "gap.ice_rock": bake_rock,
    "gap.water_edge": bake_liquid, "gap.lava_edge": bake_liquid,
    "gap.ice_floor": bake_ice_floor,
    "gap.tower_wall": bake_tower_wall, "gap.tower_stair": bake_tower_stair,
}


# ================================================================================================ 시트·칸 표 쓰기
def palette_problems(st):
    ok = dot.ALLOWED
    bad = set()
    a = st.img.reshape(-1, 4)
    for px in {tuple(x) for x in a[a[:, 3] > 0].tolist()}:
        if px[3] == 255 and px[:3] not in ok:
            bad.add(px)
        elif px[3] != 255 and (px[:3] != dot.SHADOW or px[3] != dot.SHADOW_A):
            bad.add(px)
    return bad


def write_out(st):
    rows = st.rows()
    count = BASE + rows * COLS
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    if sheet.height < BASE_ROW * T:
        sys.exit(f"시트가 {BASE_ROW}행보다 짧다 — 성벽 꼬리(bake_wall.py)부터 굽는다")
    out = Image.new("RGBA", (COLS * T, (BASE_ROW + rows) * T), (0, 0, 0, 0))
    out.alpha_composite(sheet.crop((0, 0, COLS * T, BASE_ROW * T)), (0, 0))
    strip = np.zeros((rows * T, COLS * T, 4), np.uint8)
    strip[:min(st.img.shape[0], rows * T)] = st.img[:rows * T]
    out.alpha_composite(Image.fromarray(strip, "RGBA"), (0, BASE_ROW * T))
    out.save(SHEET_PATH, optimize=True)

    TS = json.loads(TS_PATH.read_text())
    for k in ("passability", "priority", "terrain", "tileMeta"):
        TS[k] = TS[k][:BASE]
    TS["animationStrips"] = [s for s in TS["animationStrips"] if s["baseTile"] < BASE]
    empty = dict(label="", description="", source="bundled-default")
    strips = []
    for i in range(rows * COLS):
        c = st.cells[i] if i < len(st.cells) else None
        if not c:
            TS["passability"].append(dict(YES)); TS["priority"].append("lower"); TS["terrain"].append(0); TS["tileMeta"].append(dict(empty)); continue
        passage, layer = c["passage"], c["layer"]
        TS["passability"].append(dict(NO if passage == "solid" else YES))
        TS["priority"].append("upper" if layer == "upper" else "lower")
        TS["terrain"].append(0)
        label = c["label"] + (f" · 장면 {c['frame'] + 1}" if "frame" in c else "")
        TS["tileMeta"].append(dict(label=label, description=c["description"], tags=c["tags"], defaultLayer=layer, passage=passage, source="bundled-default"))
        if c.get("anim"):
            strips.append(dict(baseTile=BASE + i, frames=c["anim"]["frames"], fps=c["anim"]["fps"]))
    TS["animationStrips"] += strips
    TS["count"] = count
    TS["autotileGroups"] = [g for g in TS["autotileGroups"] if not OWN_GROUPS.match(g["id"])] + [st.defs["autotileGroups"][k] for k in sorted(st.defs["autotileGroups"])]
    TS["tileGroups"] = [g for g in TS["tileGroups"] if not g["id"].startswith(TILEGROUP_PREFIX)] + [st.defs["tileGroups"][k] for k in sorted(st.defs["tileGroups"])]
    TS["structureKits"] = [k for k in TS["structureKits"] if not k["id"].startswith(KIT_PREFIX)] + [st.defs["structureKits"][k] for k in sorted(st.defs["structureKits"])]
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=count, tilesPerRow=COLS)) + "\n")
    return count


# ================================================================================================ 본체
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="쓰지 않고 무엇을 굽는지·관문 상태만")
    ap.add_argument("--assume-picks", help="ledger 대신 이 JSON 의 [{round,item,letter}] 를 고른 것으로(시험용, --dry 와 함께)")
    ap.add_argument("--provisional", action="store_true", help="미보정 프로필의 PASS 영수증도 통과로 본다(시험용, --dry 와 함께만 — 번들에는 굽지 않는다)")
    ap.add_argument("--no-gate", action="store_true", help="관문 확인 없이(개발 시험용, --dry 와 함께만)")
    ap.add_argument("--from-store", action="store_true", help="고름·관문을 보지 않고 저장소(tiledata/beodeul-dungeon/gap)대로 시트·칸 표만 다시 쓴다(bake_wall.py 가 부른다)")
    ap.add_argument("--test-out", help="저장소 밖 시험 폴더: 시트·칸 표·gap 저장소 사본을 여기에 쓴다(번들은 건드리지 않는다). --provisional·--assume-picks 를 --dry 없이 쓸 수 있다")
    a = ap.parse_args()
    if a.test_out:
        global SHEET_PATH, TS_PATH, SHEET_JSON, STORE, STORE_PNG, STORE_JSON
        out = pathlib.Path(a.test_out).resolve()
        if str(out).startswith(str(ROOT) + "/") and not str(out).startswith(str(ROOT / "verify-shots")):
            sys.exit("--test-out 은 저장소 밖(또는 verify-shots/ 아래)이어야 한다")
        out.mkdir(parents=True, exist_ok=True)
        import shutil
        for src in (SHEET_PATH, TS_PATH, SHEET_JSON):
            if not (out / src.name).exists():
                shutil.copy(src, out / src.name)
        SHEET_PATH, TS_PATH, SHEET_JSON = out / SHEET_PATH.name, out / TS_PATH.name, out / SHEET_JSON.name
        STORE = out / "gap"
        STORE_PNG, STORE_JSON = STORE / "cells.png", STORE / "cells.json"
    if a.from_store:
        st = Store()
        if not st.cells:
            print("gap 저장소가 비어 있다 — 쓸 것 없음")
            return
        count = write_out(st)
        print(f"gap 꼬리 다시 씀: {BASE}..{count - 1} (칸 {len(st.cells)}, 키트 {len(st.defs['structureKits'])})")
        return
    if (a.assume_picks or a.no_gate or a.provisional) and not (a.dry or a.test_out):
        sys.exit("--assume-picks · --no-gate · --provisional 은 --dry 와 함께만 쓴다(시험 결과를 번들에 굽지 않는다)")
    picks, void = current_picks(a.assume_picks)
    st = Store()
    report, blocked = [], []
    for p, line in void:
        report.append(f"  VOID  {p['item']:20} 줄 {line} {p['round']} {p['letter']} — 굽지 않음(전에 구운 정의는 그대로)")
    for p, line in picks:
        m, cv, meta = render(p)
        im = cv.img()
        if p.get("sha256") and dot.image_hash(im) != p["sha256"]:
            report.append(f"  VOID  {p['item']:20} 줄 {line} — 그림이 바뀌었다")
            continue
        if a.no_gate:
            gst, why = "skipped", "관문 생략(--no-gate)"
        else:
            gst, why = gate_state(im, strict=not a.provisional)
        if not gst:
            import object_gate as OG
            sha = OG.pixel_sha256(im)
            rc = OG.read_receipt(sha) or {}
            blocked.append(f"{p['item']} 줄 {line} {p['letter']}: {why}\n    pixelSha256 {sha} · label {rc.get('label')} · kind {rc.get('kind')}")
            report.append(f"  막힘  {p['item']:20} 줄 {line} {p['letter']} — {why}")
            # 관문이 막은 항목은 전에 구운 정의(키트·오토타일·칸 묶음)를 뺀다 — 칸 그림은 남는다(덧붙이기 전용)
            old = st.baked.pop(f"{p['item']}|{line}", None)
            for kind_, ids in ((old or {}).get("defs") or {}).items():
                for i in ids:
                    st.defs[kind_].pop(i, None)
            continue
        origin = f"{p['item']}/{line}/{p['round']}:{p['letter']}@{dot.image_hash(im)[:8]}"
        before = st.added
        handler = HANDLERS.get(p["item"], bake_props)
        groups, tgs, kits = handler(st, p, line, meta, origin)
        for g in groups:
            st.defs["autotileGroups"][g["id"]] = g
        for g in tgs:
            st.defs["tileGroups"][g["id"]] = g
        for k in kits:
            st.defs["structureKits"][k["id"]] = k
        st.baked[f"{p['item']}|{line}"] = dict(round=p["round"], letter=p["letter"], sha256=dot.image_hash(im), gate=gst,
                                               defs=dict(autotileGroups=[g["id"] for g in groups], tileGroups=[g["id"] for g in tgs],
                                                         structureKits=[k["id"] for k in kits]))
        report.append(f"  굽기  {p['item']:20} 줄 {line} {p['round']} {p['letter']} [{gst}: {why}] 새 칸 {st.added - before} · "
                      f"오토타일 {[g['id'] for g in groups]} · 키트 {len(kits)}")
    print("\n".join(report))
    bad = palette_problems(st)
    if bad:
        sys.exit(f"팔레트 밖 색 {len(bad)}개: {sorted(bad)[:6]}")
    rows = st.rows()
    print(f"칸 {len(st.cells)}개(새 {st.added}) → 꼬리 {BASE}..{BASE + rows * COLS - 1} ({rows}행) · 오토타일 {len(st.defs['autotileGroups'])} · "
          f"키트 {len(st.defs['structureKits'])} · 칸 묶음 {len(st.defs['tileGroups'])}")
    if a.dry:
        print("(--dry: 쓰지 않음)")
    else:
        st.save()
        count = write_out(st)
        print(f"썼다: {SHEET_PATH} · {TS_PATH} (count {count}) · {STORE}/")
    if blocked:
        print("3/4 관문 미통과 — 굽지 않은 항목:", *blocked, sep="\n  ", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
