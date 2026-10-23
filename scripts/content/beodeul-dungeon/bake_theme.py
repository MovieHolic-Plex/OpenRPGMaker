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
G.OWN_GROUPS = re.compile(r"^beodeul_dungeon_(theme_|ceiling_(ice|sand|void)$)")
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
}
# 주제 테마 낱말(키트 ai.themes) — 조수 카탈로그가 고를 때 본다.
THEME_OF = {"arcane": ["tower", "탑", "마법탑"], "other": ["otherworld", "마계"], "earth": ["mine", "catacomb", "castle", "temple", "광산", "묘지", "성", "유적"],
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


def bake_objects(st, p, line, meta, origin):
    """기물 항목(부품 dict) → 키트. 장면N 부품은 4장면 한 덩이(1칸짜리만), 나머지는 부품마다 키트."""
    item = p["item"]
    idef = H.items_by_id().get(item, {})
    base = KIT_NAME.get(item) or item.split(".", 1)[-1].replace("_", "-")
    parts = meta["parts"]
    title = idef.get("title", base)
    tags = ["주제", base] + themes_of(item)[2:]
    kits = []
    frames = [v for k, v in parts.items() if re.match(r"^(장면|frame)\s*\d+$", k)]
    if frames and len(frames) == G.FRAMES and all(f.w == T and f.h == T for f in frames):
        walk = walk_for(idef, "기본", frames[0])[0][0]
        passage = {"x": "solid", "o": "passable", "★": "star"}[walk]
        head = st.anim(frames, G.cm(f"버들항 던전 · {title}", f"{title} — 4장면 3fps.", tags, passage, "upper"), origin)
        kits.append(G.kit(f"{KP}{base}", f"버들항 던전 · {title}(움직임)", 1, 1, [[head]], desc=f"{title}. 칸 하나가 4장면 animationStrips 로 움직인다.",
                          rules="걷는 바닥 위에.", tags=tags, themes=themes_of(item)))
        rest = {k: v for k, v in parts.items() if v not in frames}
    else:
        rest = parts
    for n, (name, part) in enumerate(rest.items()):
        w, h = part.w // T, part.h // T
        up = G.object_cells(st, part, walk_for(idef, name, part), origin, f"버들항 던전 · {title} {name}", idef.get("brief", title), tags)
        kid = f"{KP}{base}" if n == 0 and not kits else f"{KP}{base}-{len(kits) + 1}"
        kits.append(G.kit(kid, f"버들항 던전 · {title} {name} {w}×{h}", w, h, up, desc=f"{title} — {name}. {idef.get('brief', '')}",
                          rules=f"통행: {idef.get('walk', '')}", tags=tags, themes=themes_of(item)))
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
    tags = ["주제", "바닥", "floor", "사암"] + themes_of(p["item"])[2:]
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


HANDLERS = {"tc.pyr_floor": bake_pyr_floor, "tc.pyr_face": bake_pyr_face, "tc.pyr_rim": bake_pyr_rim, "tc.pyr_sand_trap": bake_pyr_sand_trap}


def current_picks():
    items = H.items_by_id()
    out, void = [], []
    for (item, line), (p, st) in sorted(H.pick_state().items()):
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
