#!/usr/bin/env python3
"""버들항 던전 「주제」 묶음 굽기(2026-10-23 dungeon-themes) — dungeon-chipset 하네스의 theme_* 물결에서 고른 조각을
gap 꼬리(29,568~30,847) 뒤, 공용 버들항 시트(beodeul_city) 꼬리 30,848 부터 덧붙인다.

  python3 scripts/content/beodeul-dungeon/bake_theme.py --dry      # 무엇을 굽는지·관문 상태만
  python3 scripts/content/beodeul-dungeon/bake_theme.py            # ledger 의 현재 theme_* 고름을 굽는다
  python3 scripts/content/beodeul-dungeon/bake_theme.py --from-store   # 고름·관문 없이 저장소대로 시트·칸 표만 다시 쓴다(bake_gap.py 가 끝에서 부른다)

bake_gap.py 의 칸 저장소·관문·칸 표 쓰기를 그대로 쓰고 상수만 바꾼다:
  - 칸 그림 정본 `tiledata/beodeul-dungeon/theme/cells.png` + `cells.json`(덧붙이기 전용, 키 = 화소 해시 + 통행 + 층).
  - 키트 id = `bd-pick-dungeon-theme-<이름>` — 시공기(profiles.ts·dress.ts·dungeonGimmicks.ts)의 `TK(<이름>)` 이 찾는 이름이다(아래 KIT_NAME 표).
  - 오토타일 그룹 = `beodeul_dungeon_theme_*` 와 천장 테두리 `beodeul_dungeon_ceiling_(ice|sand|void)`.
  - 3/4 관문(hard rule): object_gate.refusal(context="bundle") — 서명된 허용(위임 포함) 또는 보정 프로필 PASS 만 굽는다.

시트 순서: 성벽 꼬리(bake_wall) → gap 꼬리(bake_gap) → 주제 꼬리(이것). bake_gap.py 는 시트를 자기 BASE 에서 자르므로 끝에서 이것을 --from-store 로 부른다.
"""
import argparse, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bake_gap as G  # noqa: E402

ROOT = G.ROOT
H = G.H
dot = G.dot
T = G.T

# ---- 상수(gap 것을 바꿔 끼운다: Store·write_out 이 모듈 전역을 읽는다)
G.BASE = 30848
G.BASE_ROW = G.BASE // G.COLS
G.STORE = ROOT / "tiledata/beodeul-dungeon/theme"
G.STORE_PNG = G.STORE / "cells.png"
G.STORE_JSON = G.STORE / "cells.json"
G.KIT_PREFIX = "bd-pick-dungeon-theme-"
G.GROUP_PREFIX = "beodeul_dungeon_theme_"
G.OWN_GROUPS = re.compile(r"^beodeul_dungeon_(theme_|ceiling_(ice|sand|void|tower)$)")
G.TILEGROUP_PREFIX = "beodeul:dungeon_theme"
G.THEMES = ["dungeon", "던전"]
KP = G.KIT_PREFIX

# 하네스 항목 → 시공기 키트 이름(TK). 부품이 여럿이면 첫 부품이 이 이름, 나머지는 「-2」「-3」…(상태·장면 부품은 아래 규칙).
KIT_NAME = {
    # 마법탑
    "arcane.bookshelf": "bookshelf", "arcane.bookshelf_tall": "bookshelf-tall", "arcane.lectern": "lectern",
    "arcane.teleport_circle": "teleport-circle", "arcane.crystal_pedestal": "crystal-pedestal", "arcane.candelabra": "candelabra",
    # 마계
    "other.crystal": "corrupt-crystal", "other.crystal_big": "corrupt-crystal-big", "other.throne": "demon-throne",
    "other.bone_pillar": "bone-pillar", "other.brazier": "void-brazier", "other.portal": "portal-gate",
    # 광산·묘지·성·유적
    "earth.rails": "rails-ew", "earth.timber_frame": "timber-frame", "earth.timber_post": "timber-post", "earth.ore_vein": "ore-vein",
    "earth.ossuary": "ossuary", "earth.sarc_ns": "sarcophagus-ns", "earth.sarc_ew": "sarcophagus-ew", "earth.tomb_slab": "tomb-slab",
    "earth.candelabra": "iron-candelabra", "earth.throne": "throne", "earth.carpet": "carpet-runner", "earth.banner": "royal-banner",
    "earth.armor_stand": "armor-stand", "earth.portcullis": "portcullis", "earth.overgrown": "overgrown", "earth.rubble_heap": "rubble-heap",
    "earth.statue_head": "statue-head",
    # 피라미드
    "tc.pyr_sarcophagus": "pharaoh-sarcophagus", "tc.pyr_obelisk": "obelisk", "tc.pyr_sand_trap": "sand-pit", "tc.pyr_drift": "sand-drift",
    "tc.pyr_statue": "jackal-statue", "tc.pyr_gold": "gold-pile",
    # 얼음
    "tc.ice_icicles": "icicles", "tc.ice_crystal": "ice-crystal", "tc.ice_frozen": "frozen-warrior", "tc.ice_drift": "snow-drift",
    # 늪
    "tc.sw_root_arch": "mangrove-roots", "tc.sw_moss": "swamp-moss", "tc.sw_lily": "lily-pads", "tc.sw_wisp": "will-o-wisp",
    "tc.sw_idol": "sunken-idol", "tc.sw_boardwalk": "boardwalk",
    # 숲
    "tc.fo_ancient_tree": "giant-tree", "tc.fo_ring": "mushroom-ring", "tc.fo_boulder": "mossy-boulder", "tc.fo_bramble": "bramble",
    "tc.fo_waystone": "waystone",
    # 남은 조각(theme_props)
    "prop.minecart": "minecart", "prop.cracked_floor": "cracked-floor", "prop.wisp": "will-o-wisp",
}
# 주제 테마 낱말(키트 ai.themes) — 조수 카탈로그가 고를 때 본다.
THEME_OF = {"arcane": ["tower", "탑", "마법탑"], "other": ["otherworld", "마계"], "earth": ["mine", "catacomb", "castle", "temple", "광산", "묘지", "성", "유적"],
            "wall.other": ["otherworld", "마계"], "wall.tower": ["tower", "탑", "마법탑"], "wall.ice": ["ice", "얼음"],
            "prop.minecart": ["mine", "광산"], "prop.cracked_floor": ["castle", "catacomb", "temple", "성", "묘지", "유적"], "prop.wisp": ["swamp", "늪"],
            "tc.pyr": ["pyramid", "피라미드", "사막"], "tc.ice": ["ice", "얼음"], "tc.sw": ["swamp", "늪"], "tc.fo": ["forest", "숲"]}


def themes_of(item):
    for k, v in THEME_OF.items():
        if item.startswith(k):
            return ["dungeon", "던전"] + v
    return ["dungeon", "던전"]


def walk_for(item_def, name, part):
    """부품 하나의 통행 격자(행 문자열 → 칸 목록). 시드 walk_grid 의 같은 이름 · 크기 맞는 첫 격자 · 기본(윗줄 ★)."""
    w, h = part.w // T, part.h // T
    grids = item_def.get("walk_grid") or {}
    cands = ([grids[name]] if name in grids else []) + list(grids.values())
    for g in cands:
        if len(g) == h and all(len(r) == w for r in g):
            return [list(r) for r in g]
    return G.default_walk(w, h)


# 부품 이름 → 키트 이름(없으면 첫 부품 = KIT_NAME, 나머지 = 「-2」「-3」…).
PART_NAME = {
    "earth.carpet": {"한 칸 폭": "carpet-runner", "세 칸 폭": "carpet-runner-3w"},
    "earth.ossuary": {"3단": "ossuary-3h", "2단": "ossuary-2h"},
    "earth.portcullis": {"닫힘": "portcullis", "올림": "portcullis-open"},
    "earth.sarc_ns": {"닫힘": "sarcophagus-ns", "열림": "sarcophagus-ns-open"},
    "earth.sarc_ew": {"닫힘": "sarcophagus-ew", "열림": "sarcophagus-ew-open"},
    "earth.ore_vein": {"금 2×2": "ore-vein-gold", "쇠 2×2": "ore-vein-iron", "금 1×1": "ore-vein-gold-1", "쇠 1×1": "ore-vein-iron-1"},
    "earth.rails": {"H": "rails-ew", "V": "rails-ns", "NE": "rails-ne", "NW": "rails-nw", "SE": "rails-se", "SW": "rails-sw", "X": "rails-x",
                    "TN": "rails-tn", "TS": "rails-ts", "TE": "rails-te", "TW": "rails-tw", "EN": "rails-end-n", "ES": "rails-end-s", "EE": "rails-end-e", "EW": "rails-end-w"},
    "tc.pyr_sarcophagus": {"닫힘": "pharaoh-sarcophagus", "열림": "pharaoh-sarcophagus-open"},
    "tc.pyr_statue": {"자칼": "jackal-statue", "풍뎅이": "scarab-statue"},
    "tc.sw_boardwalk": {"끝": "boardwalk", "부서짐": "boardwalk-broken"},
    "tc.ice_icicles": {"1칸": "icicles", "2칸": "icicles-2w"},
    "other.portal": {"닫힘": "portal-gate", "움직임": "portal-gate-open"},
}
FRAME_RE = re.compile(r"^(장면|frame|열림)\s*\d+$")
# 걷는 칸뿐인 바닥 그림(투명 데칼)도 위층에 둔다 — 버들항 깔개·모자이크와 같이 upperTiles + 우선순위 lower(사람 밑).
PASS_LAYER = {"o": "lower", "★": "upper", "x": "upper"}


def cells_of(st, part, walk, origin, label, desc, tags, frames=None):
    """part(Cv)(또는 장면 목록) → (아래층 행렬, 위층 행렬). 걷는 칸은 사람 밑(lower 우선순위), ★ 는 사람 위, x 는 막힘.
    불투명하고 전부 걷는 바닥 그림(묘석·판석)은 아래층 칸으로 바닥을 바꿔 깐다."""
    src = frames or [part]
    w, h = src[0].w // T, src[0].h // T
    assert src[0].w % T == 0 and src[0].h % T == 0, (label, src[0].w, src[0].h)
    opaque_floor = all(f.a[:, :, 3].min() == 255 for f in src) and all(c == "o" for r in walk for c in r)
    lo, up = [[-1] * w for _ in range(h)], [[-1] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            cs = [f.crop(x * T, y * T, T, T) for f in src]
            if not any(c.a[:, :, 3].any() for c in cs):
                continue
            wch = walk[y][x]
            passage = {"x": "solid", "o": "passable", "★": "star"}[wch]
            layer = "lower" if opaque_floor else PASS_LAYER[wch]
            meta = G.cm(label + (f" ({x},{y})" if w * h > 1 else ""), desc, tags, passage, layer)
            t = anim_n(st, cs, meta, origin) if frames else st.cell(cs[0], meta, origin)
            (lo if opaque_floor else up)[y][x] = t
    return lo, up, opaque_floor


def bake_objects(st, p, line, meta, origin):
    """기물 항목(부품 dict) → 키트. 「장면N」 부품들은 한 덩이 움직임(N장면, 칸마다 animationStrips), 나머지는 부품마다 키트."""
    item = p["item"]
    idef = H.items_by_id().get(item, {})
    base = KIT_NAME.get(item) or item.split(".", 1)[-1].replace("_", "-")
    names = PART_NAME.get(item, {})
    parts = meta["parts"]
    title = idef.get("title", base)
    tags = ["주제", base] + themes_of(item)[2:]
    groups = []
    frames = [v for k, v in parts.items() if FRAME_RE.match(k)]
    if len(frames) >= 2:
        groups.append(("움직임", frames, frames))
    groups += [(k, v, None) for k, v in parts.items() if not FRAME_RE.match(k)]
    kits = []
    for n, (name, part, fr) in enumerate(groups):
        first = fr[0] if fr else part
        w, h = first.w // T, first.h // T
        walk = walk_for(idef, name if name in (idef.get("walk_grid") or {}) else "기본", first)
        lo, up, floor = cells_of(st, part, walk, origin, f"버들항 던전 · {title} {name}", idef.get("brief", title), tags, frames=fr)
        kid = KP + (names.get(name) or (base if n == 0 else f"{base}-{n + 1}"))
        kits.append(G.kit(kid, f"버들항 던전 · {title} {name} {w}×{h}" + (f"({len(fr)}장면)" if fr else ""), w, h, up, lo,
                          desc=f"{title} — {name}. {idef.get('brief', '')}" + (f" {len(fr)}장면 animationStrips." if fr else ""),
                          rules=f"통행: {idef.get('walk', '')}", tags=tags, themes=themes_of(item),
                          role="floor" if floor else "prop", layer_home="lower" if floor else ("perCell" if any(c == "o" for r in walk for c in r) else "upper")))
    ids = sorted({t for k in kits for r in k["rows"] for t in r["upperTiles"] + r["tiles"] if t >= 0})
    tg = dict(id=f"{G.TILEGROUP_PREFIX}_{item.replace('.', '_')}", name=f"버들항 던전 주제 {title}", role="object", source="bundled-default",
              defaultLayer="upper", confidence="high", tileIds=ids, description=f"{title}(키트 {', '.join(k['id'] for k in kits)}). 하네스 {p['round']} {p['letter']}.",
              placementRules=kits[0]["ai"]["placementRules"] if kits else "")
    return [], [tg], kits


def anim_n(st, cvs, meta, origin):
    """N장면(N ≤ 4) 한 덩이 → 첫 칸 번호. 덩이는 4의 배수 자리에서 시작하고 남는 자리는 빈 칸(행 경계를 넘지 않는다)."""
    n = len(cvs)
    if n == G.FRAMES:
        return st.anim(cvs, meta, origin)
    assert 1 < n < G.FRAMES, n
    arrs = [G.cell_array(c) for c in cvs]
    key = G.cell_key(arrs, meta)
    if key in st.index:
        return st.index[key]
    while len(st.cells) % G.FRAMES:
        st.cells.append(None)
    i = len(st.cells)
    for k, a in enumerate(arrs):
        if k == 0:
            st.cells.append(dict(key=key, origin=origin, anim=dict(frames=n, fps=G.FPS), **meta))
        else:
            st.cells.append(dict(frameOf=G.BASE + i, frame=k, origin=origin, **meta))
        st._put(i + k, a)
    st.index[key] = G.BASE + i
    st.added += n
    return G.BASE + i


def lower_cells(st, part, label, desc, tags, passage, origin):
    w, h = part.w // T, part.h // T
    return [[st.cell(part.crop(x * T, y * T, T, T), G.cm(label + (f" ({x},{y})" if w * h > 1 else ""), desc, tags, passage, "lower"), origin)
             for x in range(w)] for y in range(h)]


def blank(w, h):
    return [[-1] * w for _ in range(h)]


def bake_pyr_floor(st, p, line, meta, origin):
    cv = G.render(p)[1]
    tags = ["주제", "바닥", "floor", "사암", "섞음"] + themes_of(p["item"])[2:]
    lo = lower_cells(st, cv, "버들항 던전 · 피라미드 사암 판석 바닥", "피라미드 실내 사암 판석 바닥 — 2×2 네 칸을 칸마다 아무거나 섞어 깔아도 이음이 맞는다. 걸음.", tags, "passable", origin)
    k = G.kit(f"{KP}sandstone-floor", "버들항 던전 · 피라미드 사암 판석 바닥 2×2(섞음)", 2, 2, blank(2, 2), lo,
              desc="피라미드 실내 판석 바닥. 네 칸을 칸마다 섞어 깐다(시공기 floor mix).", rules="걷는 바닥 전부. 칸마다 네 칸 중 아무거나.",
              tags=tags, role="floor", repeat="repeat", layer_home="lower", themes=themes_of(p["item"]))
    tg = dict(id=f"{G.TILEGROUP_PREFIX}_pyr_floor", name="버들항 던전 주제 피라미드 사암 바닥", role="floor", source="bundled-default", defaultLayer="lower",
              confidence="high", tileIds=sorted({t for r in lo for t in r}), description=f"피라미드 사암 판석 바닥(키트 {k['id']}). 하네스 {p['round']} {p['letter']}.",
              placementRules=k["ai"]["placementRules"])
    return [], [tg], [k]


def bake_pyr_face(st, p, line, meta, origin):
    parts = meta["parts"]
    tags = ["주제", "벽", "앞면", "wall", "face", "사암"] + themes_of(p["item"])[2:]
    desc = "피라미드 사암 벽 앞면(천장 테두리 아래, 바닥 위). 열 0 왼끝 · 1 가운데(가로 반복) · 2 오른끝. 막힘."
    kits, ids = [], set()
    spec = [("face3h", "sandstone-face-3h", "3단"), ("face2h", "sandstone-face-2h", "2단"), ("base3h", "sandstone-face-3h-base", "3단 아랫단 변형"),
            ("glyph3h", "sandstone-face-3h-glyph", "3단 새김 가운데"), ("glyph2h", "sandstone-face-2h-glyph", "2단 새김 가운데"),
            ("alt3h", "sandstone-face-3h-alt", "3단 가운데단 변형(금 간 돌)")]
    for part, name, what in spec:
        cv = parts.get(part)
        if cv is None:
            continue
        w, h = cv.w // T, cv.h // T
        lo = lower_cells(st, cv, f"버들항 던전 · 피라미드 사암 벽 앞면 {what}", desc, tags, "solid", origin)
        ids |= {t for r in lo for t in r}
        kits.append(G.kit(f"{KP}{name}", f"버들항 던전 · 피라미드 사암 벽 앞면 {what} {w}×{h}", w, h, blank(w, h), lo, desc=f"{desc} {what}.",
                          rules="천장 테두리 바로 밑, 바닥 북쪽 변 위. 새김·변형 칸은 가운데 칸 대신 드문드문.", tags=tags, role="wall",
                          repeat="repeat" if w == 3 else "fixed", layer_home="lower", themes=themes_of(p["item"])))
    tg = dict(id=f"{G.TILEGROUP_PREFIX}_pyr_face", name="버들항 던전 주제 피라미드 사암 벽 앞면", role="wall", source="bundled-default", defaultLayer="lower",
              confidence="high", tileIds=sorted(ids), description=f"피라미드 사암 벽 앞면 키트({', '.join(k['id'] for k in kits)}). 하네스 {p['round']} {p['letter']}.",
              placementRules="천장 테두리 아래 벽 앞면. author_dungeon 이 저절로 쓴다.")
    return [], [tg], kits


def bake_pyr_rim(st, p, line, meta, origin):
    at = meta["autotiles"]["rim"]
    gid = "beodeul_dungeon_ceiling_sand"
    def cmeta(m):
        s = G.mask_sides(m)
        return G.cm("버들항 던전 · 피라미드 천장 (사암 테두리)" + (f"({s} 열림)" if s else " 몸통"),
                    f"피라미드 천장 오토타일 47 모양(마스크 {m}). 바닥·벽 앞면과 닿는 쪽에 사암 벽 두께 띠, 안쪽은 어둠. 막힘. 그룹 `{gid}`.",
                    ["천장", "wall", "ceiling", "사암"], "solid", "lower")
    g = G.bake_autotile(st, at, gid, "버들항 던전 피라미드 천장(사암 테두리)", origin, cmeta)
    tg = dict(id=f"{G.TILEGROUP_PREFIX}_pyr_rim", name="버들항 던전 주제 피라미드 천장 테두리", role="wall", source="bundled-default", defaultLayer="lower",
              confidence="high", tileIds=list(g["memberTileIds"]), description=f"피라미드 천장(사암 띠) 오토타일 `{gid}`. 하네스 {p['round']} {p['letter']}.",
              placementRules="방·통로 바깥 칸(천장)을 이 그룹으로 칠한다. author_dungeon 의 pyramid 테마가 저절로 쓴다.")
    return [g], [tg], []


def bake_pyr_sand_trap(st, p, line, meta, origin):
    frames = [meta["parts"][k] for k in sorted(meta["parts"])]
    w, h = frames[0].w // T, frames[0].h // T
    tags = ["주제", "함정", "모래", "바닥"] + themes_of(p["item"])[2:]
    lo = []
    for y in range(h):
        row = []
        for x in range(w):
            cvs = [f.crop(x * T, y * T, T, T) for f in frames]
            row.append(anim_n(st, cvs, G.cm(f"버들항 던전 · 모래 구덩이 함정 ({x},{y})", f"판석 바닥이 꺼져 모래가 소용돌이치는 구덩이({len(frames)}장면). 걸음(함정 이벤트 자리).",
                                            tags, "passable", "lower"), origin))
        lo.append(row)
    k = G.kit(f"{KP}sand-pit", f"버들항 던전 · 모래 구덩이 함정 {w}×{h}(움직임)", w, h, blank(w, h), lo,
              desc=f"모래 구덩이 함정 — 모래만 {len(frames)}장면으로 돈다. 밟으면 떨어지는 이벤트를 단다.", rules="걷는 바닥 위, 피해 갈 길을 남긴다.",
              tags=tags, role="floor", layer_home="lower", themes=themes_of(p["item"]))
    tg = dict(id=f"{G.TILEGROUP_PREFIX}_pyr_sand_trap", name="버들항 던전 주제 모래 구덩이 함정", role="object", source="bundled-default", defaultLayer="lower",
              confidence="high", tileIds=sorted({t for r in lo for t in r}), description=f"모래 구덩이 함정(키트 {k['id']}). 하네스 {p['round']} {p['letter']}.",
              placementRules=k["ai"]["placementRules"])
    return [], [tg], [k]


def bake_auto_floor(gid, kid, title, desc, rune_kid=None):
    def run(st, p, line, meta, origin):
        at = next(iter(meta["autotiles"].values()))
        tags = ["주제", "바닥", "floor"] + ([] if meta.get("fieldCols") else ["섞음"]) + themes_of(p["item"])[2:]
        def cmeta(m):
            s_ = G.mask_sides(m)
            return G.cm(f"버들항 던전 · {title}" + (f"({s_} 열림)" if s_ else " 몸통"), f"{desc} 오토타일(마스크 {m}). 걸음. 그룹 `{gid}`.", tags, "passable", "lower")
        g = G.bake_autotile(st, at, gid, f"버들항 던전 {title}", origin, cmeta)
        bodies = [g["variantMap"]["255"]] + [b for b in (g.get("interiorVariants") or [[]])[0] if b != g["variantMap"]["255"]]
        cols = 6 if len(bodies) >= 12 else len(bodies)
        if meta.get("fieldCols"):
            # 판석 밭(theme-floors-r8 마계 바닥): 몸통 변형 = [본몸통(가장자리용), 밭 조각 0..n-1(밭 자리 순서)].
            # 키트는 밭 조각만 밭 모양(fieldCols × 줄)으로 — 시공기가 칸 위치로 감아 깔면(섞지 않음) 밭이 이음 없이 이어진다.
            allb = list((g.get("interiorVariants") or [[]])[0])
            bodies, cols = allb[1:], int(meta["fieldCols"])
        rows_ = [bodies[i:i + cols] for i in range(0, len(bodies), cols)]
        rows_ = [r for r in rows_ if len(r) == cols]
        kits = [G.kit(f"{KP}{kid}", f"버들항 던전 · {title} 몸통 {cols}×{len(rows_)}(섞음)", cols, len(rows_), blank(cols, len(rows_)), rows_,
                      desc=f"{desc} — 몸통 변형 {len(bodies)}칸. 칸마다 섞어 깐다(시공기 floor mix).", rules="걷는 바닥 전부. 칸마다 아무 칸이나.",
                      tags=tags, role="floor", repeat="repeat", layer_home="lower", themes=themes_of(p["item"]))]
        for nm, t in (meta.get("tiles") or {}).items():
            cv = t if t.w > T or t.h > T else t
            lo = lower_cells(st, cv, f"버들항 던전 · {title} {nm}", f"{desc} — {nm}(몸통 칸 대신 깐다).", tags, "passable", origin)
            w, h = cv.w // T, cv.h // T
            kits.append(G.kit(f"{KP}{rune_kid or kid + '-' + nm}", f"버들항 던전 · {title} {nm} {w}×{h}", w, h, blank(w, h), lo,
                              desc=f"{desc} — {nm}.", rules="바닥 몸통 한가운데에 드문드문.", tags=tags, role="floor", layer_home="lower", themes=themes_of(p["item"])))
        tg = dict(id=f"{G.TILEGROUP_PREFIX}_{p['item'].replace('.', '_')}", name=f"버들항 던전 주제 {title}", role="floor", source="bundled-default",
                  defaultLayer="lower", confidence="high", tileIds=sorted(set(g["memberTileIds"]) | {t for k in kits for r in k["rows"] for t in r["tiles"] if t >= 0}),
                  description=f"{title} 오토타일 `{gid}` + 몸통 섞음 키트 {KP}{kid}. 하네스 {p['round']} {p['letter']}.", placementRules="걷는 바닥 전부.")
        return [g], [tg], kits
    return run


def bake_face(prefix, what, material, item_key):
    """벽 앞면 키트(피라미드 앞면과 같은 부품 배치) — prefix 「otherworld」 → otherworld-face-3h|2h(-glyph|-base|-alt)."""
    def run(st, p, line, meta, origin):
        parts = meta["parts"]
        tags = ["주제", "벽", "앞면", "wall", "face", material] + themes_of(p["item"])[2:]
        desc = f"{what} 벽 앞면(천장 테두리 아래, 바닥 위). 열 0 왼끝 · 1 가운데(가로 반복) · 2 오른끝. 막힘."
        kits, ids = [], set()
        spec = [("face3h", f"{prefix}-face-3h", "3단"), ("face2h", f"{prefix}-face-2h", "2단"), ("base3h", f"{prefix}-face-3h-base", "3단 아랫단 변형"),
                ("glyph3h", f"{prefix}-face-3h-glyph", "3단 새김 가운데"), ("glyph2h", f"{prefix}-face-2h-glyph", "2단 새김 가운데"),
                ("alt3h", f"{prefix}-face-3h-alt", "3단 가운데단 변형"),
                ("mid3h", f"{prefix}-face-3h-mid", "3단 가운데 덩이(3칸 주기)"), ("mid2h", f"{prefix}-face-2h-mid", "2단 가운데 덩이(3칸 주기)")]
        for part, name, w_ in spec:
            cv = parts.get(part)
            if cv is None:
                continue
            w, h = cv.w // T, cv.h // T
            lo = lower_cells(st, cv, f"버들항 던전 · {what} 벽 앞면 {w_}", desc, tags, "solid", origin)
            ids |= {t for r in lo for t in r}
            kits.append(G.kit(f"{KP}{name}", f"버들항 던전 · {what} 벽 앞면 {w_} {w}×{h}", w, h, blank(w, h), lo, desc=f"{desc} {w_}.",
                              rules="천장 테두리 바로 밑, 바닥 북쪽 변 위. 새김·변형 칸은 가운데 칸 대신 드문드문.", tags=tags, role="wall",
                              repeat="repeat" if w == 3 else "fixed", layer_home="lower", themes=themes_of(p["item"])))
        tg = dict(id=f"{G.TILEGROUP_PREFIX}_{item_key}_face", name=f"버들항 던전 주제 {what} 벽 앞면", role="wall", source="bundled-default", defaultLayer="lower",
                  confidence="high", tileIds=sorted(ids), description=f"{what} 벽 앞면 키트({', '.join(k['id'] for k in kits)}). 하네스 {p['round']} {p['letter']}.",
                  placementRules="천장 테두리 아래 벽 앞면. author_dungeon 이 저절로 쓴다.")
        return [], [tg], kits
    return run


def bake_rim(gid, what, material, item_key):
    def run(st, p, line, meta, origin):
        at = meta["autotiles"]["rim"]
        def cmeta(m):
            s_ = G.mask_sides(m)
            return G.cm(f"버들항 던전 · {what} 천장 ({material} 테두리)" + (f"({s_} 열림)" if s_ else " 몸통"),
                        f"{what} 천장 오토타일 47 모양(마스크 {m}). 바닥·벽 앞면과 닿는 쪽에 벽 두께 띠, 안쪽은 어둠. 막힘. 그룹 `{gid}`.",
                        ["천장", "wall", "ceiling", material], "solid", "lower")
        g = G.bake_autotile(st, at, gid, f"버들항 던전 {what} 천장({material} 테두리)", origin, cmeta)
        tg = dict(id=f"{G.TILEGROUP_PREFIX}_{item_key}_rim", name=f"버들항 던전 주제 {what} 천장 테두리", role="wall", source="bundled-default", defaultLayer="lower",
                  confidence="high", tileIds=list(g["memberTileIds"]), description=f"{what} 천장 오토타일 `{gid}`. 하네스 {p['round']} {p['letter']}.",
                  placementRules=f"방·통로 바깥 칸(천장)을 이 그룹으로 칠한다. author_dungeon 의 {item_key} 테마가 저절로 쓴다.")
        return [g], [tg], []
    return run


HANDLERS = {"arcane.tower_floor": bake_auto_floor("beodeul_dungeon_theme_tower_floor", "tower-floor", "마법탑 돌 바닥", "마법탑의 다듬은 돌 바닥", "tower-rune"),
            "other.ground": bake_auto_floor("beodeul_dungeon_theme_otherworld_ground", "otherworld-floor", "마계 검은 돌 바닥", "마계의 갈라진 보라 검은 돌 바닥"),
            "tc.pyr_floor": bake_pyr_floor, "tc.pyr_face": bake_pyr_face, "tc.pyr_rim": bake_pyr_rim, "tc.pyr_sand_trap": bake_pyr_sand_trap,
            "wall.other_face": bake_face("otherworld", "마계", "흑요석", "otherworld"), "wall.tower_face": bake_face("tower", "마법탑", "마름돌", "tower"),
            "wall.other_rim": bake_rim("beodeul_dungeon_ceiling_void", "마계", "흑요석", "otherworld"),
            "wall.tower_rim": bake_rim("beodeul_dungeon_ceiling_tower", "마법탑", "갓돌", "tower"),
            "wall.ice_face": bake_face("ice", "얼음굴", "얼음", "ice")}


# gap 물결이지만 주제 꼬리에 굽는 고름 — 32px 위상 몸통 용암(gap-lava-r2)은 칸이 많아 gap 꼬리(30,848 앞)에 들어가지 않는다.
THEME_TAIL_ROUNDS = {("gap.lava_edge", "gap-lava-r2")}


def bake_lava_r2(st, p, line, meta, origin):
    frames = meta["frames"]["lava"]
    gid = f"beodeul_dungeon_theme_lava_{line}"
    what = f"용암 {line}({G.LINE_NAME[line]})"
    def cmeta(m):
        s_ = G.mask_sides(m)
        return G.cm(f"버들항 던전 · {what}" + (f" 가장자리({s_} 열림)" if s_ else " 몸통"),
                    f"동굴 바닥 ↔ {what} 가장자리 오토타일(마스크 {m}, 4장면 3fps, 32px 위상 몸통). 막힘. 그룹 `{gid}`.",
                    ["lava", "용암", "water"], "solid", "lower")
    g = G.bake_autotile_anim(st, frames, gid, f"버들항 던전 {what}(32px 몸통)", origin, cmeta)
    tg = dict(id=f"{G.TILEGROUP_PREFIX}_lava_{line}", name=f"버들항 던전 {what}", role="water", source="bundled-default", defaultLayer="lower",
              confidence="high", tileIds=list(g["memberTileIds"]),
              description=f"{what} 웅덩이 오토타일 `{gid}` — 32×32 몸통을 칸 위치(2×2 위상)로 골라 16px 반복이 안 보인다. 4장면. 하네스 {p['round']} {p['letter']}.",
              placementRules="용암 칸을 이 그룹으로 칠한다(이웃이 용암이면 연결). 걸을 수 없다.")
    return [g], [tg], []


HANDLERS["gap.lava_edge"] = bake_lava_r2


def bake_void_edge(st, p, line, meta, origin):
    """마계 떠 있는 섬: 바닥+턱 오토타일(이웃 = 바닥, 허공 쪽에 턱) · 허공 몸통(섞음) · 섬 밑 앞면 2단×양 끝 4가지(허공 0번 위에 얹음).
    시공기: 허공 칸 = 허공 몸통, 바닥 바로 남쪽 허공 = 앞면 1단, 그 밑 = 2단 (theme_arcane_r1.VoidEdge.render 와 같은 규칙)."""
    ve = G.mod(p["round"]).void_edge(p["letter"])
    gid = "beodeul_dungeon_theme_void_edge"
    tags = ["주제", "마계", "허공", "바닥", "floor"] + themes_of(p["item"])[2:]
    def cmeta(m):
        s_ = G.mask_sides(m)
        return G.cm("버들항 던전 · 마계 떠 있는 섬 바닥" + (f"({s_} 허공 턱)" if s_ else " 몸통"),
                    f"마계 바닥 ↔ 허공 턱 오토타일(마스크 {m}, 이웃 = 바닥). 걸음. 그룹 `{gid}`.", tags, "passable", "lower")
    g = G.bake_autotile(st, ve.at, gid, "버들항 던전 마계 떠 있는 섬 바닥(허공 턱)", origin, cmeta)
    g["edgeConnects"] = False
    vtags = ["주제", "마계", "허공", "void", "섞음"] + themes_of(p["item"])[2:]
    voids = [st.cell(v, G.cm(f"버들항 던전 · 마계 허공 {i}", "별빛이 도는 보라 검은 허공. 막힘.", vtags, "solid", "lower"), origin) for i, v in enumerate(ve.voids)]
    under = []
    for level in (0, 1):
        row = []
        for lo in (False, True):
            for ro in (False, True):
                t = dot.Cv(T, T)
                t.a[:] = ve.voids[0].a
                t.paste(ve.face_raw.tile(level, lo, ro), 0, 0)
                ends = "·".join(n for n, b in (("왼끝", lo), ("오른끝", ro)) if b) or "가운데"
                row.append(st.cell(t, G.cm(f"버들항 던전 · 마계 섬 밑 바위 {level + 1}단 {ends}", "떠 있는 섬 밑 바위 앞면(허공 위). 막힘.",
                                           ["주제", "마계", "허공", "섬 밑"] + themes_of(p["item"])[2:], "solid", "lower"), origin))
        under.append(row)
    kits = [G.kit(f"{KP}void-body", f"버들항 던전 · 마계 허공 몸통 {len(voids)}×1(섞음)", len(voids), 1, blank(len(voids), 1), [voids],
                  desc="마계 허공 몸통 변형. 칸마다 섞어 깐다.", rules="허공 칸 전부(막힘).", tags=vtags, role="floor", repeat="repeat",
                  layer_home="lower", themes=themes_of(p["item"])),
            G.kit(f"{KP}void-underside", "버들항 던전 · 마계 섬 밑 바위 4×2", 4, 2, blank(4, 2), under,
                  desc="줄 = 단(1단: 바닥 바로 남쪽 허공, 2단: 그 밑), 열 = 양 끝(가운데 · 오른끝 · 왼끝 · 양끝).",
                  rules="섬 바닥 남쪽 허공 두 칸.", tags=["주제", "마계", "허공"], role="floor", layer_home="lower", themes=themes_of(p["item"]))]
    tg = dict(id=f"{G.TILEGROUP_PREFIX}_other_void_edge", name="버들항 던전 주제 마계 허공 가장자리", role="floor", source="bundled-default",
              defaultLayer="lower", confidence="high", tileIds=sorted(set(g["memberTileIds"]) | set(voids) | {t for r in under for t in r}),
              description=f"마계 섬 바닥 턱 오토타일 `{gid}` + 허공 몸통 {KP}void-body + 섬 밑 {KP}void-underside. 하네스 {p['round']} {p['letter']}.",
              placementRules="otherworld 던전의 허공 칸과 그 둘레 바닥. author_dungeon 이 저절로 쓴다.")
    return [g], [tg], kits


HANDLERS["other.void_edge"] = bake_void_edge


def current_picks():
    items = H.items_by_id()
    out, void = [], []
    for (item, line), (p, st) in sorted(H.pick_state().items()):
        if (item, p["round"]) in THEME_TAIL_ROUNDS:
            (out if st == "current" else void).append((p, line))
            continue
        if not str(items.get(item, {}).get("wave", "")).startswith("theme"):
            continue
        (out if st == "current" else void).append((p, line))
    return out, void


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--from-store", action="store_true")
    ap.add_argument("--only", help="쉼표로 항목 id 만")
    a = ap.parse_args()
    if a.from_store:
        st = G.Store()
        if not st.cells:
            print("주제 저장소가 비어 있다 — 쓸 것 없음")
            return
        count = G.write_out(st)
        print(f"주제 꼬리 다시 씀: {G.BASE}..{count - 1}")
        return
    sheet_count = json.loads(G.SHEET_JSON.read_text())["count"]
    st = G.Store()
    if not st.cells and sheet_count != G.BASE:
        sys.exit(f"시트 count {sheet_count} ≠ 주제 꼬리 시작 {G.BASE} — gap 꼬리(bake_gap.py)가 바뀌었다. BASE 를 다시 정해야 한다")
    picks, void = current_picks()
    only = set(a.only.split(",")) if a.only else None
    report, blocked = [], []
    for p, line in void:
        report.append(f"  VOID  {p['item']:24} {p['round']} {p['letter']}")
    for p, line in picks:
        if only and p["item"] not in only:
            continue
        m, cv, meta = G.render(p)
        im = cv.img()
        gst, why = G.gate_state(im, strict=True)
        if not gst:
            import object_gate as OG
            sha = OG.pixel_sha256(im)
            rc = OG.read_receipt(sha) or {}
            blocked.append(f"{p['item']} {p['letter']}: {why}\n    pixelSha256 {sha} · label {rc.get('label')} · kind {rc.get('kind')}")
            report.append(f"  막힘  {p['item']:24} {p['letter']} — {why[:90]}")
            old = st.baked.pop(f"{p['item']}|{line}", None)
            for kind_, ids in ((old or {}).get("defs") or {}).items():
                for i in ids:
                    st.defs[kind_].pop(i, None)
            continue
        origin = f"{p['item']}/{line}/{p['round']}:{p['letter']}@{dot.image_hash(im)[:8]}"
        before = st.added
        handler = HANDLERS.get(p["item"])
        if not handler and "parts" not in meta:
            report.append(f"  건너뜀 {p['item']:24} {p['letter']} — 부품 없는 항목(오토타일·벽)은 HANDLERS 에 손을 달아야 굽는다")
            continue
        prev = st.baked.get(f"{p['item']}|{line}")
        for kind_, ids in ((prev or {}).get("defs") or {}).items():
            for i in ids:
                st.defs[kind_].pop(i, None)
        groups, tgs, kits = (handler or bake_objects)(st, p, line, meta, origin)
        for g in groups:
            st.defs["autotileGroups"][g["id"]] = g
        for g in tgs:
            st.defs["tileGroups"][g["id"]] = g
        for k in kits:
            st.defs["structureKits"][k["id"]] = k
        st.baked[f"{p['item']}|{line}"] = dict(round=p["round"], letter=p["letter"], sha256=dot.image_hash(im), gate=gst,
                                               defs=dict(autotileGroups=[g["id"] for g in groups], tileGroups=[g["id"] for g in tgs],
                                                         structureKits=[k["id"] for k in kits]))
        report.append(f"  굽기  {p['item']:24} {p['round']} {p['letter']} [{gst}] 새 칸 {st.added - before} · 키트 {[k['id'][len(KP):] for k in kits]}")
    print("\n".join(report))
    bad = G.palette_problems(st)
    if bad:
        sys.exit(f"팔레트 밖 색 {len(bad)}개: {sorted(bad)[:6]}")
    rows = st.rows()
    print(f"칸 {len(st.cells)}개(새 {st.added}) → 꼬리 {G.BASE}..{G.BASE + rows * G.COLS - 1} · 키트 {len(st.defs['structureKits'])} · 오토타일 {len(st.defs['autotileGroups'])}")
    if a.dry:
        print("(--dry: 쓰지 않음)")
    else:
        st.save()
        count = G.write_out(st)
        print(f"썼다 (count {count})")
    if blocked:
        print("3/4 관문 미통과 — 굽지 않은 항목:", *blocked, sep="\n  ", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
    # 주제 꼬리 뒤(33,152~)의 마당 바닥 꼬리(beodeul-yard/bake_yard.py)는 이 스크립트가 시트를 다시 쓰면 잘린다 — 이어서 다시 굽는다.
    _yard = HERE.parent / "beodeul-yard" / "bake_yard.py"
    if "--dry" not in sys.argv and _yard.exists() and G.SHEET_PATH == G.ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png":
        import subprocess
        subprocess.run([sys.executable, str(_yard)], cwd=G.ROOT, check=True)
