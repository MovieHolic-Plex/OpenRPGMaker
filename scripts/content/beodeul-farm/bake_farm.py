#!/usr/bin/env python3
"""beodeul_farm — 버들항 시트 꼬리(27,648~)에 농장 그림을 덧붙여 굽는다.

  python3 scripts/content/beodeul-farm/bake_farm.py --gate-export DIR   # 3/4 관문에 낼 투명 PNG + items.jsonl 만 쓴다
  python3 scripts/content/beodeul-farm/bake_farm.py                     # 관문 영수증을 확인하고 굽는다

입력  farm_art.py (행 문자열 손 도트, 3판 화풍 정렬 2026-10-14)
출력  public/assets/beodeul-city/beodeul-city-chipset.png  — 앞 216행(27,648칸)은 그대로, 뒤 6행(768칸)
      src/assets/beodeulCityTileset.json · beodeulCitySheet.json — 칸 표 + 오토타일 farmland / farmland_watered + 키트 bd-farm-* + 칸 묶음
덧붙이기 전용: 앞 칸 번호는 바뀌지 않는다. 1판(2026-10-13)의 칸 번호는 그대로 두고, 새 조각은 꼬리 768칸의 빈 자리에만 넣는다.
bake_picks.py 가 시트를 다시 자르면 꼬리가 사라지므로 그 끝에서 이 스크립트를 다시 부른다. 다시 돌려도 같은 결과(멱등).

3/4 관문(hard rule): 조각마다 현재 판정 프로필의 PASS 영수증(object-gate)이 있어야 굽는다. 프로필이 아직 보정 전이면
PASS 영수증을 「임시 통과」로 센다(jp-city gate_kinds 와 같은 규칙). FAIL·영수증 없음:
  - 1판에 이미 있던 칸(흙·작물 9·울타리 가로/모서리 위)이 막히면 굽지 않고 끝낸다(기존 맵이 쓰는 칸을 비울 수 없다).
  - 새 칸이 막히면 그 칸만 비워 둔다(번호는 예약, 키트·칸 묶음에서 뺀다).
"""
import argparse, json, os, pathlib, re, subprocess, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import farm_art as A  # noqa: E402

ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
T = 16
COLS = 128
BASE = 27648          # 고른 조각 꼬리의 끝 = 농장 시작
BASE_ROW = BASE // COLS
ROWS_ADDED = 6
COUNT = BASE + ROWS_ADDED * COLS

# 배치: (행, 열) — 행은 BASE_ROW 기준 상대. 1판 번호는 그대로.
SOIL_ORDER = [["NW", "N", "NE", "inNW", "inNE"], ["W", "body", "E", "inSW", "inSE"], ["SW", "S", "SE", "iso"]]
WET_COL = 6
CROP_ORDER = ["wheat_sprout", "wheat_young", "wheat_mature", "cabbage_sprout", "cabbage_young", "cabbage_mature",
              "tomato_sprout", "tomato_young", "tomato_mature", "seeded"]          # seeded(28169)는 2판 새 칸
CROP_ROW = 4
FENCE_ORDER = ["h", "v", "cNW", "cNE", "cSW", "cSE", "gate",                         # 1판 번호(28288~28294)
               "endW", "endE", "vN", "vS", "post", "vE"]                             # 2판 새 칸(28295~28300)
FENCE_ROW = 5
# 여러 칸 기물(2판 새 칸): 이름 → (행, 열) 왼쪽 위. 꼬리 6행 안의 빈 자리.
OBJECT_AT = {"barn": (0, 16), "coop": (0, 24)}
# 여러 칸 기물의 통행: 위쪽 몇 줄은 ★(사람 뒤로 지나감, 그림이 사람 위), 나머지는 막힘. 버들항 헛간 키트와 같은 규칙.
OBJECT_STAR_ROWS = {"barn": 3, "coop": 1}
# 3판 새 칸: 흙길 오토타일 16칸(마스크 m → 열 32+m, 행 0) · 풀 무늬 6칸(행 1, 열 32~)
LANE_ROW, LANE_COL = 0, 32
GRASS_ROW, GRASS_COL = 1, 32
GRASS_ORDER = ["tufts", "tufts2", "clover", "flowers_w", "flowers_y", "pebbles"]
OBJECT_DOOR = {"barn": dict(id="door", kind="entrance", dx=2, dy=5, w=2, h=1, note="큰 두 짝 문(문 칸 자체는 막힘, 그 아래 칸이 문 앞 길)"),
               "coop": dict(id="door", kind="entrance", dx=0, dy=2, w=1, h=1, note="닭 드나드는 문·사다리(막힘, 아래 칸이 앞마당)")}

# 1판에 이미 있던 칸 — 관문에 막히면 굽기를 멈춘다.
LEGACY_KEYS = ({f"soil:{n}" for row in SOIL_ORDER for n in row} | {f"wet:{n}" for row in SOIL_ORDER for n in row}
               | {f"crop:{n}" for n in CROP_ORDER[:9]} | {f"fence:{n}" for n in FENCE_ORDER[:7]})

GATE_KIND = {"crop": "organic", "fence": "frame", "object": "structure", "soil": "terrain", "wet": "terrain", "lane": "terrain", "grass": "terrain"}


def tid(row, col): return BASE + row * COLS + col


def object_tiles(name):
    rows, w, h = A.OBJECTS[name]
    im = A.img_of(rows)
    r0, c0 = OBJECT_AT[name]
    return {tid(r0 + y, c0 + x): im.crop((x * T, y * T, x * T + T, y * T + T)) for y in range(h) for x in range(w)}


def build_cells():
    """-> {tile_id: (PIL image, key)}  key = 종류:이름 (여러 칸 기물은 object:이름:dx,dy)"""
    cells = {}
    roles = A.role_rows()
    wet_roles = {k: A.wet(v) for k, v in roles.items()}
    for r, names in enumerate(SOIL_ORDER):
        for c, n in enumerate(names):
            cells[tid(r, c)] = (A.img_of(roles[n]), f"soil:{n}")
            cells[tid(r, WET_COL + c)] = (A.img_of(wet_roles[n]), f"wet:{n}")
    for c, n in enumerate(CROP_ORDER):
        cells[tid(CROP_ROW, c)] = (A.img_of(A.CROPS[n]), f"crop:{n}")
    for c, n in enumerate(FENCE_ORDER):
        cells[tid(FENCE_ROW, c)] = (A.img_of(A.FENCE[n]), f"fence:{n}")
    for m in range(16):
        cells[tid(LANE_ROW, LANE_COL + m)] = (A.img_of(A.LANE_TILES[m]), f"lane:{m}")
    for i, n in enumerate(GRASS_ORDER):
        cells[tid(GRASS_ROW, GRASS_COL + i)] = (A.img_of(A.GRASS_VARS[n]), f"grass:{n}")
    for name in OBJECT_AT:
        r0, c0 = OBJECT_AT[name]
        for t, im in object_tiles(name).items():
            i = t - tid(r0, c0)
            cells[t] = (im, f"object:{name}:{i % COLS},{i // COLS}")
    return cells


# ---------------------------------------------------------------- 3/4 관문 표본
def soil_sample(roles, w=5, h=4):
    """흙 오토타일 표본(볼록 모서리·가장자리·몸통 + 오목 모서리 L자). 칸 하나가 아니라 이어 칠한 밭으로 판정받는다."""
    cells = {(x, y) for x in range(w) for y in range(h)} - {(w - 1, 0), (w - 2, 0), (0, h - 1)}
    im = Image.new("RGBA", (w * T, h * T), (0, 0, 0, 0))
    for (x, y) in cells:
        N, S_, W, E = (x, y - 1) in cells, (x, y + 1) in cells, (x - 1, y) in cells, (x + 1, y) in cells
        n = ("" if N else "N") + ("" if S_ else "S") + ("" if W else "W") + ("" if E else "E")
        n = n or "body"
        if n == "body":
            for d, (dx, dy) in (("inNW", (-1, -1)), ("inNE", (1, -1)), ("inSW", (-1, 1)), ("inSE", (1, 1))):
                if (x + dx, y + dy) not in cells: n = d
        im.alpha_composite(A.img_of(roles[n]), (x * T, y * T))
    return im


def lane_sample():
    """흙길 표본: 가로 줄·세로 줄·T자·끝·굽이가 다 나오는 6×5 판(바탕 풀)."""
    cells = {(x, 2) for x in range(6)} | {(2, y) for y in range(5)} | {(4, 3), (4, 4), (5, 4)}
    grass = A.img_of(A.GRASS)
    im = Image.new("RGBA", (6 * T, 5 * T), (0, 0, 0, 0))
    for y in range(5):
        for x in range(6):
            if (x, y) in cells:
                m = ((x, y - 1) in cells) * 1 + ((x + 1, y) in cells) * 2 + ((x, y + 1) in cells) * 4 + ((x - 1, y) in cells) * 8
                im.paste(A.img_of(A.LANE_TILES[m]), (x * T, y * T))
            else: im.paste(grass, (x * T, y * T))
    return im


def grass_sample():
    """풀 무늬 표본: 무늬 칸 6개를 바탕 잔디 사이에 섞은 4×3 판."""
    grass = A.img_of(A.GRASS)
    lay = [["tufts", None, "clover", None], [None, "flowers_w", None, "tufts2"], ["pebbles", None, "flowers_y", None]]
    im = Image.new("RGBA", (4 * T, 3 * T), (0, 0, 0, 0))
    for y, r in enumerate(lay):
        for x, n in enumerate(r): im.paste(A.img_of(A.GRASS_VARS[n]) if n else grass, (x * T, y * T))
    return im


def fence_sample():
    """울타리 조립 표본(7×7): 문 달린 둘레 6×5 + 홀로 선 가로 줄(서끝·가로·동끝) + 세로 줄(북끝·세로·남끝) + 홀로 선 말뚝.
    울타리 조각은 이웃과 이어져야 뜻이 서는 부품이라(세로 띠는 칸 위아래로 이어진다) 조각 하나보다 조립 그림으로 판정받는다
    (AGENTS 「부품 예외」: 부품을 화소 그대로 품은 조립 그림의 영수증, 같은 판정자·기준)."""
    lay = [["cNW", "h", "h", "h", "cNE", None, "vN"],
           ["v", None, None, None, "vE", None, "v"],
           ["v", None, None, None, "vE", None, "vS"],
           ["cSW", "h", "gate", "h", "cSE", None, None],
           [None, None, None, None, None, None, "post"],
           ["endW", "h", "endE", None, None, None, None]]
    im = Image.new("RGBA", (7 * T, len(lay) * T), (0, 0, 0, 0))
    for y, r in enumerate(lay):
        for x, n in enumerate(r):
            if n: im.alpha_composite(A.img_of(A.FENCE[n]), (x * T, y * T))
    return im


def gate_items():
    """관문에 낼 그림 목록: (이름, 그림, 종류, 판정자에게 줄 이름, 덮는 칸 key 들)."""
    roles = A.role_rows()
    wet_roles = {k: A.wet(v) for k, v in roles.items()}
    items = [
        ("soil_plot", soil_sample(roles), "terrain", "tilled farm soil field autotile (ridged furrows, raised bed edges, grass around)",
         [f"soil:{n}" for row in SOIL_ORDER for n in row]),
        ("soil_plot_wet", soil_sample(wet_roles), "terrain", "watered (darker) tilled farm soil field autotile",
         [f"wet:{n}" for row in SOIL_ORDER for n in row]),
    ]
    items.append(("lane_sample", lane_sample(), "terrain", "packed dirt farm lane autotile (straight edges, wheel ruts, grass verge) on grass",
                  [f"lane:{m}" for m in range(16)]))
    items.append(("grass_variants", grass_sample(), "terrain", "grass ground tiles with small tufts, clover, wild flowers and pebbles",
                  [f"grass:{n}" for n in GRASS_ORDER]))
    for n in CROP_ORDER:
        items.append((f"crop_{n}", A.img_of(A.CROPS[n]), "organic",
                      f"farm crop plants: {n.replace('_', ' ')} (plants only, the soil is a separate tile underneath)", [f"crop:{n}"]))
    for n in FENCE_ORDER:
        items.append((f"fence_{n}", A.img_of(A.FENCE[n]), "frame", f"wooden farm fence piece '{n}' (slim posts with cap tops, two rails)", [f"fence:{n}"]))
    items.append(("fence_assembled", fence_sample(), "frame", "wooden farm fence assembled: a fenced paddock ring with a gate, a short free-standing rail run, a north-south run and a lone post",
                  [f"fence:{n}" for n in FENCE_ORDER]))
    for name in OBJECT_AT:
        rows, w, h = A.OBJECTS[name]
        label = {"barn": "farm barn building (terracotta tiled gable roof with hayloft dormer, half-timbered plaster walls, big plank double door, stone footing)",
                 "coop": "small wooden chicken coop hut on short legs (terracotta tiled roof, plank walls, small door, ramp, nest box)"}[name]
        items.append((f"object_{name}", A.img_of(rows), "structure", label,
                      [f"object:{name}:{x},{y}" for y in range(h) for x in range(w)]))
    return items


_PROFILE = None


def current_profile():
    global _PROFILE
    if _PROFILE: return _PROFILE
    out = subprocess.run(["npm", "run", "-s", "harness", "--", "object-gate", "status"], cwd=ROOT, capture_output=True, text=True).stdout
    m = re.search(r"현재 규칙 프로필 ([0-9a-f]{16})", out)
    if not m: raise RuntimeError("현재 판정 프로필 해시를 못 읽었다(object-gate status)")
    _PROFILE = m.group(1)
    return _PROFILE


def gate_state(img, kind):
    """('pass'|'provisional', None) 또는 (None, 이유) — jp-city gate_kinds.state 와 같은 규칙."""
    import object_gate as OG
    rc = OG.read_receipt(OG.pixel_sha256(img))
    if not rc: return None, "영수증 없음"
    if rc.get("kind") != kind: return None, f"영수증 종류 {rc.get('kind')} ≠ {kind}"
    if rc.get("profileHash") != current_profile() and rc.get("profileHash") not in OG.calibrated_profiles():
        return None, f"옛 프로필 {rc.get('profileHash')} 영수증"
    if rc.get("verdict") != "pass": return None, "불합격(" + " · ".join(rc.get("reasons") or ["fail"]) + ")"
    return ("pass" if rc.get("profileHash") in OG.calibrated_profiles() else "provisional"), None


def meta(label, desc, tags, passage, layer="lower"):
    return dict(label=label, description=desc, tags=["버들항", "농장"] + tags, defaultLayer=layer, passage=passage, source="bundled-default")


def soil_group(col0, gid, name):
    ids = {}
    for r, names in enumerate(SOIL_ORDER):
        for c, n in enumerate(names): ids[n] = tid(r, col0 + c)
    members = [ids[n] for n in ("body", "N", "S", "W", "E", "NW", "NE", "SW", "SE", "iso", "inNW", "inNE", "inSE", "inSW")]
    vm = {}
    for m in range(256):
        N, E, S, W = m & 1, m & 2, m & 4, m & 8
        NE, SE, SW, NW = m & 16, m & 32, m & 64, m & 128
        if not (N or E or S or W): t = "iso"
        elif N and E and S and W:
            t = "body"
            for ok, k in ((NW, "inNW"), (NE, "inNE"), (SE, "inSE"), (SW, "inSW")):
                if not ok: t = k; break
        elif not N and not W: t = "NW"
        elif not N and not E: t = "NE"
        elif not S and not W: t = "SW"
        elif not S and not E: t = "SE"
        elif not N: t = "N"
        elif not S: t = "S"
        elif not W: t = "W"
        else: t = "E"
        vm[str(m)] = ids[t]
    return dict(id=gid, name=name, neighborhood=8, memberTileIds=members, connectTileIds=list(members), variantMap=vm), ids


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-export", help="3/4 관문용 투명 PNG 와 items.jsonl 을 이 폴더에 쓰고 끝낸다")
    args = ap.parse_args()

    if args.gate_export:
        out = pathlib.Path(args.gate_export); out.mkdir(parents=True, exist_ok=True)
        lines = []
        for name, im, kind, label, _keys in gate_items():
            p = out / f"{name}.png"; im.save(p)
            lines.append(dict(png=str(p), kind=kind, name=label, label=f"beodeul_farm/{name}"))
        (out / "items.jsonl").write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in lines) + "\n")
        print("gate export", len(lines), "->", out)
        return

    # ---- 관문 ----
    blocked, provisional, cleared = {}, [], set()
    for name, im, kind, _label, keys in gate_items():
        st, why = gate_state(im, kind)
        if st is None:
            for k in keys: blocked.setdefault(k, f"{name}: {why}")
        else:
            cleared.update(keys)
            if st == "provisional": provisional.append(name)
    # 한 칸은 그것을 화소 그대로 품은 그림(낱개 또는 조립 표본) 중 하나라도 통과하면 덮인다.
    blocked = {k: v for k, v in blocked.items() if k not in cleared}
    legacy_blocked = sorted(k for k in blocked if k in LEGACY_KEYS)
    if legacy_blocked:
        print("3/4 관문 미통과 — 1판 칸을 비울 수 없어 굽지 않는다:", file=sys.stderr)
        for k in legacy_blocked: print("  ", k, "←", blocked[k], file=sys.stderr)
        sys.exit(2)
    cells = {t: v for t, v in build_cells().items() if v[1] not in blocked}
    for k in sorted(set(blocked)): print("  비움(관문 미통과):", k, "←", blocked[k])
    if provisional: print(f"  임시 통과(프로필 {current_profile()} 미보정): {len(provisional)}개")

    dry_group, dry_ids = soil_group(0, "farmland", "버들항 경작지(마른 흙)")
    wet_group, wet_ids = soil_group(WET_COL, "farmland_watered", "버들항 경작지(물 준 흙)")
    present = {key for _, key in cells.values()}
    has = lambda key: key in present

    # ---- 시트 ----
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    out_sheet = Image.new("RGBA", (COLS * T, (BASE_ROW + ROWS_ADDED) * T), (0, 0, 0, 0))
    out_sheet.alpha_composite(sheet.crop((0, 0, COLS * T, BASE_ROW * T)), (0, 0))
    for t, (im, _) in cells.items():
        i = t - BASE
        out_sheet.alpha_composite(im, ((i % COLS) * T, (BASE_ROW + i // COLS) * T))
    out_sheet.save(SHEET_PATH, optimize=True)

    # ---- 칸 표 ----
    TS = json.loads(TS_PATH.read_text())
    for k in ("passability", "priority", "terrain", "tileMeta"): TS[k] = TS[k][:BASE]
    TS["animationStrips"] = [s for s in TS["animationStrips"] if s["baseTile"] < BASE]
    empty = dict(label="", description="", source="bundled-default")
    yes = {d: True for d in ("up", "down", "left", "right")}
    no = {d: False for d in ("up", "down", "left", "right")}
    soil_desc = {"body": "몸통", "N": "위쪽 가장자리(둑 윗테)", "S": "아래쪽 가장자리(둑 앞면)", "W": "왼쪽 가장자리", "E": "오른쪽 가장자리",
                 "NW": "왼쪽 위 모서리", "NE": "오른쪽 위 모서리", "SW": "왼쪽 아래 모서리", "SE": "오른쪽 아래 모서리",
                 "iso": "외딴 한 칸", "inNW": "오목 모서리(왼쪽 위)", "inNE": "오목 모서리(오른쪽 위)", "inSW": "오목 모서리(왼쪽 아래)", "inSE": "오목 모서리(오른쪽 아래)"}
    crop_ko = {"wheat": "밀", "cabbage": "배추", "tomato": "토마토"}
    stage_ko = {"sprout": "싹", "young": "자라는 중", "mature": "익음"}
    fence_ko = {"h": "가로 울타리", "v": "세로 울타리", "cNW": "울타리 모서리(왼쪽 위: 동·남으로 이어짐)", "cNE": "울타리 모서리(오른쪽 위: 서·남)",
                "cSW": "울타리 모서리(왼쪽 아래: 동·북)", "cSE": "울타리 모서리(오른쪽 아래: 서·북)", "gate": "울타리 문(닫힘, 가로 줄 안에 한 칸)",
                "endW": "가로 울타리 서쪽 끝 말뚝(동으로 이어짐)", "endE": "가로 울타리 동쪽 끝 말뚝(서로 이어짐)",
                "vN": "세로 울타리 북쪽 끝 말뚝(남으로 이어짐)", "vS": "세로 울타리 남쪽 끝 말뚝(북으로 이어짐)", "post": "홀로 선 말뚝",
                "vE": "세로 울타리(동쪽 둘레: 가로대가 말뚝 동쪽 옆)"}
    obj_ko = {"barn": "헛간", "coop": "닭장"}
    grass_ko = {"tufts": "풀 포기", "tufts2": "풀 포기 둘", "clover": "토끼풀", "flowers_w": "흰 들꽃", "flowers_y": "노란 들꽃", "pebbles": "잔돌"}
    for i in range(ROWS_ADDED * COLS):
        t = BASE + i
        if t not in cells:
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0); TS["tileMeta"].append(dict(empty)); continue
        _, key = cells[t]; typ, n = key.split(":", 1)
        if typ in ("soil", "wet"):
            wetv = typ == "wet"
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0)
            TS["tileMeta"].append(meta(("물 준 " if wetv else "") + "경작지 " + soil_desc[n], ("물 준(한 단 어두운) " if wetv else "") + f"버들항 경작지 오토타일 {soil_desc[n]}. 걸음. 농사 런타임이 밭 흙을 이 그룹으로 그린다.", ["경작지", "farmland"], "passable"))
        elif typ == "lane":
            m = int(n); dirs = "".join(d for b, d in ((1, "북"), (2, "동"), (4, "남"), (8, "서")) if m & b) or "외딴 한 칸"
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0)
            TS["tileMeta"].append(meta(f"버들항 농장 흙길 · {dirs}" + ("으로 이어짐" if m else ""), f"반듯한 가장자리의 다져진 흙길 오토타일(마스크 {m}). 걸음. 그룹 `beodeul_farm_lane`.", ["흙길", "길", "farm_lane"], "passable"))
        elif typ == "grass":
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0)
            TS["tileMeta"].append(meta(f"버들항 농장 풀밭 · {grass_ko[n]}", f"바탕 잔디(737)와 이음새 없이 섞는 풀 무늬 칸({grass_ko[n]}). 걸음. 넓은 풀밭에 드문드문(10칸에 1~2칸) 섞는다.", ["풀밭", "풀 무늬", "grass"], "passable"))
        elif typ == "crop":
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0)
            if n == "seeded":
                TS["tileMeta"].append(meta("씨 뿌린 이랑", "씨를 막 뿌린 이랑(마루마다 작은 흙무덤) — 경작지 칸 위에 얹는 윗층 한 칸. 걸음. 심는 중인 밭에 쓴다.", ["작물", "seeded"], "passable", "upper"))
            else:
                crop, stage = n.split("_")
                TS["tileMeta"].append(meta(f"{crop_ko[crop]} · {stage_ko[stage]}", f"{crop_ko[crop]} {stage_ko[stage]} 단계 — 경작지 칸 위에 얹는 윗층 한 칸(흙은 따로). 걸음.", ["작물", crop, stage], "passable", "upper"))
        elif typ == "fence":
            TS["passability"].append(dict(no)); TS["priority"].append("lower"); TS["terrain"].append(0)
            TS["tileMeta"].append(meta(fence_ko[n], f"버들항 밭 나무 울타리: {fence_ko[n]}. 윗층 한 칸, 막힘.", ["울타리", "fence"], "solid", "upper"))
        else:
            name, pos = n.split(":"); dx, dy = map(int, pos.split(","))
            star = dy < OBJECT_STAR_ROWS[name]
            TS["passability"].append(dict(yes) if star else dict(no)); TS["priority"].append("upper"); TS["terrain"].append(0)
            TS["tileMeta"].append(meta(f"버들항 농장 · {obj_ko[name]}", f"버들항 농장 {obj_ko[name]} ({dx},{dy}) — " + ("윗부분, 걸음(사람 위에 그려짐)" if star else "막힘"),
                                       [obj_ko[name], name], "star" if star else "solid", "upper"))
    TS["count"] = COUNT

    # ---- 오토타일·칸 묶음 ----
    groups = [dry_group, wet_group]
    if all(has(f"lane:{m}") for m in range(16)):
        lane_ids = [tid(LANE_ROW, LANE_COL + m) for m in range(16)]
        others = [t for g in TS["autotileGroups"] if g["id"] in ("beodeul_road_autotile", "beodeul_sand_autotile") for t in g["memberTileIds"]]
        groups.append(dict(id="beodeul_farm_lane", name="버들항 농장 흙길", neighborhood=4, memberTileIds=lane_ids,
                           connectTileIds=sorted(set(lane_ids + others)), edgeConnects=True, outsideConnects=True,
                           variantMap={str(m): lane_ids[m] for m in range(16)}))
    TS["autotileGroups"] = [g for g in TS["autotileGroups"] if g["id"] not in ("farmland", "farmland_watered", "beodeul_farm_lane")] + groups
    TS["tileGroups"] = [g for g in TS["tileGroups"] if not g["id"].startswith("beodeul:farm")]
    ct = lambda n: tid(CROP_ROW, CROP_ORDER.index(n))
    ft = lambda n: tid(FENCE_ROW, FENCE_ORDER.index(n))
    fence_ids = [ft(n) for n in FENCE_ORDER if has(f"fence:{n}")]
    TS["tileGroups"] += [
        dict(id="beodeul:farmland", name="버들항 경작지", role="path", source="bundled-default", tileIds=sorted(dry_group["memberTileIds"]), defaultLayer="lower", confidence="high",
             description="밭 흙 오토타일(마른 흙, 3/4 시점: 가로 이랑 넷, 둑 윗테·앞면, 둘레 풀 그림자). 그룹 id `farmland` — 농사 런타임이 경작한 칸을 자동으로 이 그림으로 그린다. 대표 몸통 %d." % dry_ids["body"],
             placementRules="밭은 4×3~8×5 직사각형 덩이로 칠하고 덩이 사이에 1칸 흙길·풀 둑을 둔다. 이웃과 이어 칠하면 가장자리·모서리(오목 포함)가 저절로 맞는다. 작물은 윗층에 따로 얹는다. 들판 한 띠를 통째로 밭으로 덮지 않는다."),
        dict(id="beodeul:farmland_watered", name="버들항 경작지(물 준 흙)", role="path", source="bundled-default", tileIds=sorted(wet_group["memberTileIds"]), defaultLayer="lower", confidence="high",
             description="같은 경작지 그림의 물 준 판(흙만 한 단 어둡다). 그룹 id `farmland_watered` — 농사 런타임이 물 준 칸을 이 그림으로 그린다(그룹이 없으면 틴트).",
             placementRules="마른 경작지와 섞어 칠하지 않는다(서로 이웃으로 보지 않는다). 손으로 칠할 땐 밭 한 덩이 통째로."),
        dict(id="beodeul:farm_crops", name="버들항 작물 3종 × 3단계 + 씨 뿌림", role="object", source="bundled-default",
             tileIds=[ct(n) for n in CROP_ORDER if has(f"crop:{n}")], defaultLayer="upper", confidence="high",
             description="밀·배추·토마토의 싹/자라는 중/익음과 씨 뿌린 이랑(각 윗층 한 칸, 투명 바탕). 경작지 칸 위에 얹는다. 밀 익음은 칸을 거의 다 덮는 이삭 띠.",
             placementRules="경작지 칸 위 윗층에 한 칸씩. 한 줄(가로 이랑)은 한 작물·한 단계로 맞추고, 밭 하나에 단계 둘~셋을 줄 단위로 섞으면 자라는 밭이 된다. 경작지 밖(풀·길)에는 얹지 않는다."),
        dict(id="beodeul:farm_fence", name="버들항 밭 나무 울타리", role="object", source="bundled-default", tileIds=fence_ids, defaultLayer="upper", confidence="high",
             description="가는 말뚝(머리 윗면 2행)과 가로대 둘: 가로·세로 둘(서쪽 둘레 v·동쪽 둘레 vE — 세로 가로대는 말뚝 바깥 옆면에 붙는다)·모서리 넷·문·끝 말뚝 넷·홀로 선 말뚝. 윗층, 막힘. 키트 `bd-farm-fence-*`·`bd-farm-fenced-*` 가 조립 예다.",
             placementRules="밭·목장 둘레 한 칸 밖에 빈틈 없이 두른다: 위 줄 = 왼쪽 위 모서리 + 가로… + 오른쪽 위 모서리, 왼쪽 옆 = 세로 v, 오른쪽 옆 = 세로 vE, 아래 줄 = 왼쪽 아래 모서리 + 가로… + 오른쪽 아래 모서리. 문 한 칸은 길 쪽 가로 줄 안에 둔다. 줄이 끝나면 끝 말뚝으로 닫는다(가로대가 허공에서 끊기지 않게)."),
    ]
    if all(has(f"lane:{m}") for m in range(16)):
        TS["tileGroups"].append(dict(id="beodeul:farm_lane", name="버들항 농장 흙길", role="path", source="bundled-default",
                                     tileIds=[tid(LANE_ROW, LANE_COL + m) for m in range(16)], defaultLayer="lower", confidence="high",
                                     description="반듯한 가장자리의 다져진 흙길 오토타일(그룹 `beodeul_farm_lane`, 이웃 4방향). 버들항 모랫길과 같은 흙색, 포석길·모랫길과 이어진다.",
                                     placementRules="농가 마당·밭 사이 길은 이 흙길로 1~2칸 폭 곧게 낸다. 마을 큰길(포석)에서 갈라져 나오게 이어 칠하면 가장자리가 저절로 맞는다. 밭 둑 사이 1칸 길에도 쓴다."))
    grass_ids = [tid(GRASS_ROW, GRASS_COL + i) for i, n in enumerate(GRASS_ORDER) if has(f"grass:{n}")]
    if grass_ids:
        TS["tileGroups"].append(dict(id="beodeul:farm_grass", name="버들항 농장 풀 무늬", role="floor", source="bundled-default",
                                     tileIds=grass_ids, defaultLayer="lower", confidence="high",
                                     description="바탕 잔디 737 과 이음새 없이 섞는 풀 무늬 칸(풀 포기·토끼풀·흰/노란 들꽃·잔돌).",
                                     placementRules="넓은 풀밭이 납작해 보이지 않게 10칸에 1~2칸꼴로 흩어 놓는다. 같은 칸을 줄지어 놓지 않는다. 길·밭 둘레 한 칸 안에 몰지 않는다."))
    objs = [n for n in OBJECT_AT if all(has(f"object:{n}:{x},{y}") for y in range(A.OBJECTS[n][2]) for x in range(A.OBJECTS[n][1]))]
    if objs:
        TS["tileGroups"].append(dict(id="beodeul:farm_buildings", name="버들항 농가 건물", role="object", source="bundled-default",
                                     tileIds=sorted(t for t, (_, k) in cells.items() if k.startswith("object:")), defaultLayer="upper", confidence="high",
                                     description="헛간 6×6(버들항 민가와 같은 테라코타 기와 맞배지붕·건초 다락 박공·회벽과 목재 보·큰 두 짝 널문·돌 기초)과 닭장 3×3(기와 지붕·널벽). 키트 `bd-farm-barn`·`bd-farm-coop` 로 통째로 찍는다.",
                                     placementRules="키트로만 찍는다(칸을 낱개로 섞지 않는다). 농가 마당(흙길·풀) 위, 문 앞에 1칸 이상 길을 둔다. 위쪽 줄은 ★(사람 뒤), 아래쪽 줄은 막힘."))

    # ---- 키트 ----
    def row(lower, upper): return dict(tiles=lower, upperTiles=upper)
    gt = lambda n: dry_ids[n]
    themes = ["village", "field", "farm", "마을", "필드", "농장"]

    def plot_kit(kid, name, crops, W=4, desc=""):
        H = len(crops)
        lower = [[-1] * W for _ in range(H)]; upper = [[-1] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                n = ("N" if y == 0 else "S" if y == H - 1 else "") + ("W" if x == 0 else "E" if x == W - 1 else "")
                lower[y][x] = gt(n or "body")
                if crops[y]: upper[y][x] = ct(crops[y])
        return dict(id=kid, kind="section", name=name, width=W, height=H, tileSize=16, rows=[row(lower[y], upper[y]) for y in range(H)], learnedFrom="db-authored",
                    ai=dict(description=name + ". 경작지 오토타일 + 작물(줄마다 한 작물·한 단계). " + desc,
                            placementRules="땅(풀) 위에 찍는다. 흙은 아래층, 작물은 윗층. 밭 여럿을 붙이지 말고 1칸 흙길·둑을 사이에 둔다.",
                            tags=["버들항", "농장", "밭"], role="prop", repeatability="fixed", layerHome="lower", themes=themes))

    def fence_ring(W, H, gate_x=None):
        """W×H 둘레 울타리(윗층 칸 표). 가운데는 -1."""
        up = [[-1] * W for _ in range(H)]
        for x in range(1, W - 1): up[0][x] = ft("h"); up[H - 1][x] = ft("h")
        for y in range(1, H - 1): up[y][0] = ft("v"); up[y][W - 1] = ft("vE")
        up[0][0], up[0][W - 1], up[H - 1][0], up[H - 1][W - 1] = ft("cNW"), ft("cNE"), ft("cSW"), ft("cSE")
        if gate_x is not None: up[H - 1][gate_x] = ft("gate")
        return up

    kits = [
        plot_kit("bd-farm-plot-soil", "버들항 밭 · 흙만 4×3", [None, None, None]),
        plot_kit("bd-farm-plot-wheat", "버들항 밭 · 밀 4×3", ["wheat_mature", "wheat_young", "wheat_sprout"], desc="뒤 줄부터 익음·자람·싹."),
        plot_kit("bd-farm-plot-mixed", "버들항 밭 · 배추·토마토·밀 4×3", ["cabbage_mature", "tomato_mature", "wheat_mature"]),
    ]
    fence_run = dict(id="bd-farm-fence-run-4", kind="section", name="버들항 밭 울타리 윗줄 4×1", width=4, height=1, tileSize=16,
                     rows=[row([-1] * 4, [ft("cNW"), ft("h"), ft("h"), ft("cNE")])], learnedFrom="db-authored",
                     ai=dict(description="밭 윗변 울타리: 왼쪽 위 모서리 + 가로 둘 + 오른쪽 위 모서리. 막힘. 세로·아래 모서리와 이어 둘레를 닫는다.",
                             placementRules="밭 윗변 바깥 한 줄에 찍는다. 양 끝 모서리에서 세로 울타리(bd-farm-fence-v)로 내려 둘레를 닫는다.",
                             tags=["버들항", "농장", "울타리"], role="prop", repeatability="fixed", layerHome="upper", themes=themes))
    kits.append(fence_run)
    new_fence = all(has(f"fence:{n}") for n in ("v", "cSW", "cSE", "gate"))
    if all(has(f"crop:{n}") for n in ("cabbage_mature", "cabbage_young", "cabbage_sprout", "tomato_mature", "tomato_young", "tomato_sprout", "seeded")):
        kits += [
            plot_kit("bd-farm-plot-cabbage", "버들항 밭 · 배추 5×4", ["cabbage_mature", "cabbage_mature", "cabbage_young", "cabbage_sprout"], W=5, desc="익은 두 줄 + 자람 + 싹."),
            plot_kit("bd-farm-plot-tomato", "버들항 밭 · 토마토 4×3", ["tomato_mature", "tomato_young", "tomato_sprout"]),
            plot_kit("bd-farm-plot-sowing", "버들항 밭 · 심는 중 5×4", [None, "seeded", "seeded", "wheat_sprout"], W=5, desc="뒤 줄은 갓 간 흙, 가운데 씨 뿌림, 앞 줄 싹 — 심는 중인 밭."),
        ]
    if new_fence:
        # 울타리 두른 밭: 둘레 7×6 안에 밭 5×4, 아래 줄 가운데 문.
        W, H = 7, 6
        up = fence_ring(W, H, gate_x=3)
        low = [[-1] * W for _ in range(H)]
        crops = ["wheat_mature", "wheat_young", "cabbage_mature", "cabbage_young"]
        for y in range(1, H - 1):
            for x in range(1, W - 1):
                n = ("N" if y == 1 else "S" if y == H - 2 else "") + ("W" if x == 1 else "E" if x == W - 2 else "")
                low[y][x] = gt(n or "body"); up[y][x] = ct(crops[y - 1])
        kits.append(dict(id="bd-farm-fenced-plot", kind="section", name="버들항 울타리 두른 밭 7×6(문 하나)", width=W, height=H, tileSize=16,
                         rows=[row(low[y], up[y]) for y in range(H)], learnedFrom="db-authored",
                         parts=[dict(id="gate", kind="entrance", dx=3, dy=H - 1, w=1, h=1, note="울타리 문(막힘 칸, 문 앞은 길)")],
                         ai=dict(description="밭 5×4(밀 익음·자람, 배추 익음·자람)를 나무 울타리가 빈틈 없이 두르고 아래 가운데에 문이 있다.",
                                 placementRules="풀 위에 찍고 문 아래 칸에 흙길을 잇는다. 둘레 바깥 1칸은 비운다.",
                                 tags=["버들항", "농장", "밭", "울타리"], role="prop", repeatability="fixed", layerHome="upper", themes=themes)))
        kits.append(dict(id="bd-farm-fence-v-3", kind="section", name="버들항 세로 울타리 1×3", width=1, height=3, tileSize=16,
                         rows=[row([-1], [ft("v")]) for _ in range(3)], learnedFrom="db-authored",
                         ai=dict(description="남북으로 가는 울타리 세 칸(말뚝 + 말뚝 서쪽 옆을 지나는 가로대 띠, 위에서 본 윗면). 막힘. 둘레의 동쪽 변은 같은 모양의 vE 칸(가로대가 동쪽 옆).",
                                 placementRules="가로 울타리의 모서리 칸 아래(또는 위)에 붙여 둘레를 닫는다. 끝은 모서리나 끝 말뚝(vN·vS)으로.",
                                 tags=["버들항", "농장", "울타리"], role="prop", repeatability="fixed", layerHome="upper", themes=themes)))
    for name in objs:
        rows_, w, h = A.OBJECTS[name]
        r0, c0 = OBJECT_AT[name]
        star = OBJECT_STAR_ROWS[name]
        kits.append(dict(id=f"bd-farm-{name}", kind="section", name={"barn": "버들항 농장 헛간 6×6", "coop": "버들항 농장 닭장 3×3"}[name],
                         width=w, height=h, tileSize=16, learnedFrom="db-authored",
                         rows=[row([-1] * w, [tid(r0 + y, c0 + x) for x in range(w)]) for y in range(h)],
                         parts=[OBJECT_DOOR[name]],
                         ai=dict(description={"barn": "버들항 민가 문법의 큰 헛간: 테라코타 기와 맞배지붕·건초 다락 박공·회벽과 목재 보·큰 두 짝 널문·창과 화분·돌 기초.",
                                              "coop": "말뚝 다리 위 작은 닭장(테라코타 기와 지붕, 가로 널벽, 작은 문, 경사 사다리, 알 상자)."}[name],
                                 placementRules=f"땅(풀·흙길) 위에 찍는다. 위 {star}줄은 ★(사람 위에 그려짐), 아래 줄은 막힘. 문 앞 칸에 길을 잇고 막지 않는다. 농가 마당에 밭·울타리·건초·물통과 함께 둔다.",
                                 tags=["버들항", "농장", "건물" if name == "barn" else "물체"], role="prop", repeatability="fixed", layerHome="upper", themes=themes)))

    TS["structureKits"] = [k for k in TS["structureKits"] if not k["id"].startswith("bd-farm-")] + kits
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=COUNT, tilesPerRow=COLS)) + "\n")
    print(json.dumps(dict(count=COUNT, cells=len(cells), blocked=len(blocked), kits=[k["id"] for k in kits]), ensure_ascii=False))


if __name__ == "__main__":
    main()
    # 농장 꼬리 뒤(28,416~)의 던전 천장 테두리 칸은 이 스크립트가 시트를 다시 쓰면 사라진다 — 같은 실행에서 다시 굽는다(멱등).
    if not any(a.startswith("--gate-export") for a in sys.argv[1:]):
        subprocess.run([sys.executable, str(HERE.parent / "beodeul-dungeon" / "bake_dungeon_ceiling.py")], check=True)
