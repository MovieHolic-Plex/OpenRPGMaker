#!/usr/bin/env python3
"""beodeul_farm — 버들항 시트 꼬리(27,648~)에 농장 그림을 덧붙여 굽는다.

  python3 scripts/content/beodeul-farm/bake_farm.py [--gate-export DIR]

입력  farm_art.py (행 문자열 손 도트)
출력  public/assets/beodeul-city/beodeul-city-chipset.png  — 앞 216행(27,648칸)은 그대로, 뒤에 6행(768칸)
      src/assets/beodeulCityTileset.json · beodeulCitySheet.json — 칸 표 + 오토타일 farmland / farmland_watered + 키트 bd-farm-* + 칸 묶음
덧붙이기 전용: 앞 칸 번호는 바뀌지 않는다. bake_picks.py 가 시트를 다시 자르면 꼬리가 사라지므로 그 끝에서 이 스크립트를 다시 부른다.
다시 돌려도 같은 결과(멱등) — 이미 꼬리가 있으면 지우고 다시 쓴다.
"""
import argparse, json, pathlib, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import farm_art as A  # noqa: E402

ROOT = HERE.parents[2]
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
T = 16
COLS = 128
BASE = 27648          # 고른 조각 꼬리의 끝 = 농장 시작
BASE_ROW = BASE // COLS
ROWS_ADDED = 6
COUNT = BASE + ROWS_ADDED * COLS

# 배치: (행, 열) — 행은 BASE_ROW 기준 상대
SOIL_ORDER = [["NW", "N", "NE", "inNW", "inNE"], ["W", "body", "E", "inSW", "inSE"], ["SW", "S", "SE", "iso"]]
WET_COL = 6
CROP_ORDER = ["wheat_sprout", "wheat_young", "wheat_mature", "cabbage_sprout", "cabbage_young", "cabbage_mature",
              "tomato_sprout", "tomato_young", "tomato_mature"]
CROP_ROW = 4
FENCE_ORDER = ["h", "v", "cNW", "cNE", "cSW", "cSE", "gate"]
FENCE_ROW = 5
# 3/4 관문(object-gate)을 통과하지 못한 울타리 조각은 시트에 굽지 않는다(칸 번호는 예약만 — 비워 둔다).
# 2026-10-13 6판 실측: h·cNW·cNE PASS, v·cSW·cSE·gate FAIL. 다시 그려 통과하면 여기서 빼면 된다(번호는 그대로).
PENDING_FENCE = {"v", "cSW", "cSE", "gate"}


def tid(row, col): return BASE + row * COLS + col


def build_cells(include_pending=False):
    """-> {tile_id: (PIL image, key)}"""
    cells = {}
    roles = A.role_rows()
    wet_roles = {k: A.wet(v) for k, v in roles.items()}
    for r, names in enumerate(SOIL_ORDER):
        for c, n in enumerate(names):
            cells[tid(r, c)] = (A.img_of(roles[n]), f"soil:{n}")
            cells[tid(r, WET_COL + c)] = (A.img_of(wet_roles[n]), f"wet:{n}")
    for c, n in enumerate(CROP_ORDER):
        cells[tid(CROP_ROW, c)] = (A.img_of(A.CROPS[n]), f"crop:{n}")
    fence = {k: A.img_of(v) for k, v in A.FENCE.items()}
    fence["cNE"] = fence["cNW"].transpose(Image.FLIP_LEFT_RIGHT)
    fence["cSE"] = fence["cSW"].transpose(Image.FLIP_LEFT_RIGHT)
    for c, n in enumerate(FENCE_ORDER):
        if n in PENDING_FENCE and not include_pending: continue
        cells[tid(FENCE_ROW, c)] = (fence[n], f"fence:{n}")
    return cells


def soil_group(prefix, col0, gid, name):
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


def meta(label, desc, tags, passage, layer="lower"):
    return dict(label=label, description=desc, tags=["버들항", "농장"] + tags, defaultLayer=layer, passage=passage, source="bundled-default")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-export", help="3/4 관문용 투명 PNG 와 jsonl 을 이 폴더에 쓴다")
    args = ap.parse_args()

    cells = build_cells()
    dry_group, dry_ids = soil_group("soil", 0, "farmland", "버들항 경작지(마른 흙)")
    wet_group, wet_ids = soil_group("wet", WET_COL, "farmland_watered", "버들항 경작지(물 준 흙)")

    if args.gate_export:
        out = pathlib.Path(args.gate_export); out.mkdir(parents=True, exist_ok=True)
        lines = []
        def emit(name, im, kind, label):
            p = out / f"{name}.png"; im.save(p); lines.append(dict(png=str(p), kind=kind, name=label, label=f"beodeul_farm/{name}"))
        for tidv, (im, key) in build_cells(include_pending=True).items():
            typ, n = key.split(":")
            if typ == "crop": emit(f"crop_{n}", im, "organic", f"farm crop {n.replace('_', ' ')} growing in tilled soil (plant only, soil is a separate tile)")
            if typ == "fence": emit(f"fence_{n}", im, "frame", f"wooden farm fence piece {n} (posts and two rails, 16px tile)")
        # 마른 흙 3×3 표본 + 모든 변형(터레인)
        roles = A.role_rows()
        plot = Image.new("RGBA", (16 * 5, 16 * 5), (0, 0, 0, 0))
        grid = [["NW", "N", "N", "NE"], ["W", "body", "body", "E"], ["SW", "S", "S", "SE"]]
        for y, row in enumerate(grid):
            for x, n in enumerate(row): plot.alpha_composite(A.img_of(roles[n]), (x * 16, y * 16))
        emit("soil_plot", plot.crop((0, 0, 64, 48)), "terrain", "tilled soil field autotile 4x3 plot with edges and corners")
        (out / "items.jsonl").write_text("\n".join(json.dumps(l) for l in lines) + "\n")
        print("gate export", len(lines), "->", out)

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
    soil_desc = {"body": "몸통", "N": "위쪽 가장자리", "S": "아래쪽 가장자리(흙 앞면)", "W": "왼쪽 가장자리", "E": "오른쪽 가장자리",
                 "NW": "왼쪽 위 모서리", "NE": "오른쪽 위 모서리", "SW": "왼쪽 아래 모서리", "SE": "오른쪽 아래 모서리",
                 "iso": "외딴 한 칸", "inNW": "오목 모서리(왼쪽 위)", "inNE": "오목 모서리(오른쪽 위)", "inSW": "오목 모서리(왼쪽 아래)", "inSE": "오목 모서리(오른쪽 아래)"}
    crop_ko = {"wheat": "밀", "cabbage": "배추", "tomato": "토마토"}
    stage_ko = {"sprout": "싹", "young": "자라는 중", "mature": "익음"}
    fence_ko = {"h": "가로 울타리", "v": "세로 울타리", "cNW": "울타리 모서리(왼쪽 위: 동·남으로 이어짐)", "cNE": "울타리 모서리(오른쪽 위: 서·남)",
                "cSW": "울타리 모서리(왼쪽 아래: 동·북)", "cSE": "울타리 모서리(오른쪽 아래: 서·북)", "gate": "울타리 문(닫힘)"}
    for i in range(ROWS_ADDED * COLS):
        t = BASE + i
        if t not in cells:
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0); TS["tileMeta"].append(dict(empty)); continue
        _, key = cells[t]; typ, n = key.split(":")
        if typ in ("soil", "wet"):
            wetv = typ == "wet"
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0)
            TS["tileMeta"].append(meta(("물 준 " if wetv else "") + "경작지 " + soil_desc[n], ("물 준(한 단 어두운) " if wetv else "") + f"버들항 경작지 오토타일 {soil_desc[n]}. 걸음. 농사 런타임이 밭 흙을 이 그룹으로 그린다.", ["경작지", "farmland"], "passable"))
        elif typ == "crop":
            crop, stage = n.split("_")
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0)
            TS["tileMeta"].append(meta(f"{crop_ko[crop]} · {stage_ko[stage]}", f"{crop_ko[crop]} {stage_ko[stage]} 단계 — 경작지 칸 위에 얹는 윗층 한 칸(흙은 따로). 걸음.", ["작물", crop, stage], "passable", "upper"))
        else:
            TS["passability"].append(dict(no)); TS["priority"].append("lower"); TS["terrain"].append(0)
            TS["tileMeta"].append(meta(fence_ko[n], f"버들항 밭 나무 울타리: {fence_ko[n]}. 윗층 한 칸, 막힘.", ["울타리", "fence"], "solid", "upper"))
    TS["count"] = COUNT

    # ---- 오토타일·칸 묶음 ----
    TS["autotileGroups"] = [g for g in TS["autotileGroups"] if g["id"] not in ("farmland", "farmland_watered")] + [dry_group, wet_group]
    TS["tileGroups"] = [g for g in TS["tileGroups"] if not g["id"].startswith("beodeul:farm")]
    TS["tileGroups"] += [
        dict(id="beodeul:farmland", name="버들항 경작지", role="path", source="bundled-default", tileIds=sorted(dry_group["memberTileIds"]), defaultLayer="lower", confidence="high",
             description="밭 흙 오토타일(마른 흙, 이랑 가로 3/4 시점). 그룹 id `farmland` — 농사 런타임이 경작한 칸을 자동으로 이 그림으로 그린다. 대표 몸통 %d." % dry_ids["body"],
             placementRules="직사각형 밭 4×3 안팎, 이웃과 이어 칠하면 가장자리·모서리가 저절로 맞는다. 작물은 윗층에 따로 얹는다."),
        dict(id="beodeul:farmland_watered", name="버들항 경작지(물 준 흙)", role="path", source="bundled-default", tileIds=sorted(wet_group["memberTileIds"]), defaultLayer="lower", confidence="high",
             description="같은 경작지 그림의 물 준 판(한 단 어둡다). 농사 런타임은 물 준 칸에 틴트만 얹으므로 이 그룹은 손으로 칠할 때 쓴다.",
             placementRules="마른 경작지와 섞어 칠하지 않는다(서로 이웃으로 보지 않는다)."),
        dict(id="beodeul:farm_crops", name="버들항 작물 3종 × 3단계", role="object", source="bundled-default", tileIds=[tid(CROP_ROW, c) for c in range(len(CROP_ORDER))], defaultLayer="upper", confidence="high",
             description="밀·배추·토마토의 싹/자라는 중/익음 (각 윗층 한 칸, 투명 바탕). 경작지 칸 위에 얹는다.", placementRules="경작지 몸통·가장자리 칸 위 윗층에 한 칸씩. 같은 줄은 한 작물·한 단계로 맞춘다."),
        dict(id="beodeul:farm_fence", name="버들항 밭 나무 울타리", role="object", source="bundled-default", tileIds=[tid(FENCE_ROW, c) for c, n in enumerate(FENCE_ORDER) if n not in PENDING_FENCE], defaultLayer="upper", confidence="high",
             description="가로 + 위쪽 모서리 둘(3/4 관문 통과분). 세로·아래 모서리·문은 관문 미통과로 아직 없다(칸 번호 28289·28292·28293·28294 예약). 윗층, 막힘.", placementRules="밭 둘레 한 칸 밖에 두른다. 문 한 칸은 길 쪽에."),
    ]

    # ---- 키트 ----
    def row(lower, upper): return dict(tiles=lower, upperTiles=upper)
    gt = lambda n: dry_ids[n]
    ct = lambda n: tid(CROP_ROW, CROP_ORDER.index(n))
    ft = lambda n: tid(FENCE_ROW, FENCE_ORDER.index(n))
    def plot_kit(kid, name, crops):
        # 흙 4×3. 작물은 줄마다 한 종류.
        W, H = 4, 3
        lower = [[-1] * W for _ in range(H)]; upper = [[-1] * W for _ in range(H)]
        names = [["NW", "N", "N", "NE"], ["W", "body", "body", "E"], ["SW", "S", "S", "SE"]]
        for y in range(3):
            for x in range(4):
                lower[y][x] = gt(names[y][x])
                if crops[y]: upper[y][x] = ct(crops[y])
        return dict(id=kid, kind="section", name=name, width=W, height=H, tileSize=16, rows=[row(lower[y], upper[y]) for y in range(H)], learnedFrom="db-authored",
                    ai=dict(description=name + ". 경작지 오토타일 + 작물.", placementRules="땅(풀) 위에 찍는다. 흙은 아래층, 작물은 윗층.",
                            tags=["버들항", "농장", "밭"], role="prop", repeatability="fixed", layerHome="lower", themes=["village", "field", "마을", "필드"]))
    fence_run = dict(id="bd-farm-fence-run-4", kind="section", name="버들항 밭 울타리 윗줄 4×1", width=4, height=1, tileSize=16,
                     rows=[row([-1] * 4, [ft("cNW"), ft("h"), ft("h"), ft("cNE")])], learnedFrom="db-authored",
                     ai=dict(description="밭 윗변 울타리: 왼쪽 위 모서리 + 가로 둘 + 오른쪽 위 모서리. 막힘.",
                             placementRules="밭 윗변 바깥 한 줄에 찍는다. 세로·아래 모서리·문 조각은 3/4 관문 미통과라 아직 시트에 없다.",
                             tags=["버들항", "농장", "울타리"], role="prop", repeatability="fixed", layerHome="upper", themes=["village", "field", "마을", "필드"]))
    kits = [
        plot_kit("bd-farm-plot-soil", "버들항 밭 · 흙만 4×3", [None, None, None]),
        plot_kit("bd-farm-plot-wheat", "버들항 밭 · 밀 4×3", ["wheat_mature", "wheat_young", "wheat_sprout"]),
        plot_kit("bd-farm-plot-mixed", "버들항 밭 · 배추·토마토·밀 4×3", ["cabbage_mature", "tomato_mature", "wheat_mature"]),
        fence_run,
    ]
    TS["structureKits"] = [k for k in TS["structureKits"] if not k["id"].startswith("bd-farm-")] + kits
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=COUNT, tilesPerRow=COLS)) + "\n")
    print(json.dumps(dict(count=COUNT, farmCells=[BASE, COUNT - 1], soilDry=[min(dry_group["memberTileIds"]), max(dry_group["memberTileIds"])],
                          crops=[tid(CROP_ROW, 0), tid(CROP_ROW, len(CROP_ORDER) - 1)], fence=[tid(FENCE_ROW, 0), tid(FENCE_ROW, len(FENCE_ORDER) - 1)], kits=[k["id"] for k in kits])))


if __name__ == "__main__":
    main()
