"""object-gate 화풍 보정 표본 — 저장소 증거에서 「얕은 것 / 버들항 수준」 표본을 만든다.

    python3 src/harnesses/object-gate/tools/build_style_calibration.py

산출: harness-data/object-gate/calibration/style/<이름>.png + items.json
표본 출처(라벨은 사람이 이미 내린 판정에서 온다):
  farm-user          농장 2판(사용자 반려, 얕음) → 3판(PR #2541, 사용자 수락) 같은 키트의 전/후
  quality-before     「버들항 결 맞추기」 PR #2544~#2558 의 부모 커밋 시트 조각(PR 이 고치려던 얕은 판)
  quality-after      같은 조각의 병합 후 판. **라벨은 약하다**: 고쳤다고 해서 버들항 수준인지는 PR 이 보증하지 않는다(weak).
  beodeul-heldout    버들항 번들 시트의 다른 조각(판정자에게 보여 주는 기준 그림에는 안 쓴 키트)
  synthetic-shallow  버들항 조각을 4색 양자화 + 근흑 윤곽으로 일부러 얕게 만든 것(통제 표본, 실제 증거 아님)

주의(2026-10-20): 버들항 번들 원본이 표본을 만든 뒤 바뀌어, 지금 다시 돌리면 beodeul__*/synthetic__* 그림 일부가 달라진다.
라벨(weak 등)만 바꿀 때는 items.json 만 남기고 PNG 는 git 으로 되돌린다 — 그림이 바뀌면 답 캐시·이전 보정과 비교가 끊긴다.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from kit_render import REPO, load_commit, render_kit, tile_image, trim  # noqa: E402
from themes import THEMES  # noqa: E402
from PIL import Image  # noqa: E402

OUT = REPO / "harness-data" / "object-gate" / "calibration" / "style"

# 테마 → [(키트 id 접미사 또는 g:<그룹 이름 일부>, 화풍 종류, 3/4 종류)]
PICKS = {
    "farm": [("farm-barn", "building", "structure"), ("farm-coop", "building", "structure"), ("farm-fenced-plot", "prop", "frame"), ("farm-plot-wheat", "ground", "terrain"), ("farm-fence-v-3", "prop", "frame")],
    "gothic": [("dead-tree", "tree", "organic"), ("willow-dead", "tree", "organic"), ("dead-tree-crows", "tree", "organic"), ("bush-dead", "tree", "organic"), ("g:마른 풀밭 A", "ground", "terrain"), ("g:마른 풀밭 B", "ground", "terrain")],
    "campus": [("bld-school-8", "building", "structure"), ("bld-admin", "building", "structure"), ("tree-zelkova", "tree", "organic"), ("tree-pine", "tree", "organic"), ("hedge", "prop", "organic"), ("g:캠퍼스 잔디", "ground", "terrain")],
    "snow": [("cabin-m", "building", "structure"), ("longhouse", "building", "structure"), ("pine-l", "tree", "organic"), ("birch", "tree", "organic"), ("well", "prop", "container"), ("woodpile", "prop", "organic"), ("g:서리 풀", "ground", "terrain")],
    "desert": [("house-adobe-4", "building", "structure"), ("house-dome-4", "building", "structure"), ("palm-date", "tree", "organic"), ("g:잔잔한 모래", "ground", "terrain"), ("g:오아시스 풀밭", "ground", "terrain")],
    "sengoku": [("machiya-a", "building", "structure"), ("shrine", "building", "structure"), ("tree-pine", "tree", "organic"), ("tree-maple", "tree", "organic"), ("chozuya", "prop", "structure"), ("g:풀밭", "ground", "terrain")],
    "sf": [("hab-module", "building", "structure"), ("control-tower", "building", "structure"), ("cargo-crate", "prop", "box"), ("vending", "prop", "tall_furniture"), ("wall-face-hull", "wall", "terrain"), ("g:정거장 복도·광장 기본 바닥", "ground", "terrain")],
    "sky": [("cottage-red", "building", "structure"), ("tower-house", "building", "structure"), ("tree-round", "tree", "organic"), ("tree-blossom", "tree", "organic"), ("g:풀밭", "ground", "terrain")],
    "pirate": [("tavern", "building", "structure"), ("hut-thatch", "building", "structure"), ("palm", "tree", "organic"), ("tree-broad", "tree", "organic"), ("sand", "ground", "terrain"), ("grass", "ground", "terrain")],
    "prehistoric": [("hut-thatch-l", "building", "structure"), ("chief-house", "building", "structure"), ("jungle-tree", "tree", "organic"), ("tree-fern", "tree", "organic"), ("fish-rack", "prop", "frame"), ("g:원시 풀밭", "ground", "terrain")],
    "steampunk": [("row-3", "building", "structure"), ("shop-gears", "building", "structure"), ("factory", "building", "structure"), ("gas-lamp", "prop", "column"), ("crates", "prop", "box"), ("g:자갈 포석(돌 셋트)", "ground", "terrain"), ("g:판석 보도", "ground", "terrain")],
}
# 버들항 홀드아웃(기준 그림에 안 쓴 키트): (키트 id, 화풍 종류, 3/4 종류, 3/4 라벨)
BEODEUL = [
    ("bd-house-h106_1", "building", "structure", "good"), ("bd-house-h111_0", "building", "structure", "good"), ("bd-house-h122_0", "building", "structure", "good"),
    ("bd-house-h124_0", "building", "structure", "good"), ("bd-tree-5844f6", "tree", "organic", None), ("bd-tree-a80c85", "tree", "organic", None),
    ("bd-tree-7ecdb8", "tree", "organic", None), ("bd-prop-stall_herb_flower", "prop", "low_furniture", "good"), ("bd-prop-flower_cart", "prop", "low_furniture", "good"),
    ("bd-prop-goods_pile", "prop", "other", None), ("bd-prop-table_mugs", "prop", "low_furniture", "good"), ("bd-prop-lamp_double", "prop", "column", None),
]
BEODEUL_GROUND = [("plaza", [1509, 1212, 2364, 2366, 1509, 1212, 1509, 2364, 2366, 1212, 1509, 2364]), ("farm-lane", None)]
# 농장 라벨은 판(PR #2541) 단위 사용자 판정이다. 아래 조각은 조각 단위 측정이 판 라벨과 맞지 않아 약한 라벨로 둔다(2026-10-20):
#   farm-plot-wheat  2·3판 구조·명암 단이 같고 색만 다르다(칸당 색 13 vs 13).
#   farm-fenced-plot 3판이 칸당 색 6, 2판 11 — 수락된 판의 조각이 더 얇다(판 라벨과 조각 밀도가 역전).
#   farm-fence-v-3   3판 고유색 6, 2판 8 — 같은 역전.
# 약한 라벨은 v2·v3 양쪽에 붙인다(한쪽만 약하면 다른 쪽이 강한 라벨로 남아 같은 조각의 반대 라벨이 기준에 섞인다).
WEAK_FARM = {"farm-plot-wheat", "farm-fenced-plot", "farm-fence-v-3"}
# 버들항 원본 중 화풍 강한 라벨에서 빼는 것(약한 라벨): 흑철 가로등은 재질 자체가 무채색 검정이라 그 윤곽(측정 무채색 비율 0.99)이
# 「이웃 재질의 어두운 톤」인데도 윤곽 규칙(near_black)에 걸린다. 원본은 정상이지만 윤곽 규칙과 어긋나는 예외라 기준 집계에서 뺀다.
BEODEUL_STYLE_WEAK = {"bd-prop-lamp_double"}
DEGRADE = ["bd-house-h106_1", "bd-house-h122_0", "bd-tree-5844f6", "bd-tree-7ecdb8", "bd-prop-stall_herb_flower", "bd-prop-goods_pile"]


def group_patch(group: dict, sheet, tpr: int) -> Image.Image:
    ids = group["tileIds"]
    out = Image.new("RGBA", (4 * 16, 3 * 16), (0, 0, 0, 0))
    for i in range(12):
        out.alpha_composite(tile_image(sheet, tpr, 16, ids[i % min(len(ids), 6)]), ((i % 4) * 16, (i // 4) * 16))
    return out


def piece(tileset: dict, sheet, spec: str):
    tpr = tileset["tilesPerRow"]
    if spec.startswith("g:"):
        wanted = spec[2:]
        for g in tileset["tileGroups"]:
            if g["name"].startswith(wanted) and g["tileIds"]:
                return group_patch(g, sheet, tpr)
        return None
    for k in tileset["structureKits"]:
        if k["id"] == spec or k["id"].endswith("-" + spec) and k["id"].split("-", 1)[1] == spec:
            return trim(render_kit(k, sheet, tpr))
    return None


def degrade(img: Image.Image) -> Image.Image:
    """4색 양자화 + 근흑 윤곽 — 칸 정보량이 낮은 「얕은」 판을 흉내 낸 통제 표본."""
    alpha = img.getchannel("A")
    rgb = Image.new("RGB", img.size, (255, 0, 255))
    rgb.paste(img.convert("RGB"), mask=alpha)
    q = rgb.quantize(colors=4, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGBA")
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(q, mask=alpha.point(lambda a: 255 if a > 0 else 0))
    px, a = out.load(), alpha.load()
    w, h = img.size
    edge = [(x, y) for y in range(h) for x in range(w) if a[x, y] > 0 and any(0 <= x + dx < w and 0 <= y + dy < h and a[x + dx, y + dy] == 0 or not (0 <= x + dx < w and 0 <= y + dy < h) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in edge:
        px[x, y] = (22, 22, 26, 255)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    items = []

    def add(name, img, kind34, style_kind, view34, style, group, note, weak=False):
        img.save(OUT / f"{name}.png")
        items.append({"name": name, "kind": kind34, "styleKind": style_kind, "view34": view34, "style": style, "group": group, "note": note, **({"weak": True} if weak else {})})

    for theme, (tsj, png, after, before, note) in THEMES.items():
        if theme not in PICKS:
            continue
        tb, sb = load_commit(before, tsj, png)
        ta, sa = load_commit(after, tsj, png)
        for spec, style_kind, kind34 in PICKS[theme]:
            b, a = piece(tb, sb, spec), piece(ta, sa, spec)
            if b is None or a is None:
                print("건너뜀(한쪽 판에 없음):", theme, spec)
                continue
            if b.size == a.size and b.tobytes() == a.tobytes():
                print("건너뜀(그림 같음):", theme, spec)
                continue
            slug = spec.replace("g:", "g-").replace(" ", "_").replace("·", "")
            if theme == "farm":
                # WEAK_FARM 조각은 판 라벨과 조각 측정이 어긋난다(위 WEAK_FARM 주석) — 화풍 라벨이 약하다.
                weak_piece = spec in WEAK_FARM
                add(f"{theme}__{slug}__v2", b, kind34, style_kind, None, "bad", "farm-user", "농장 2판(사용자 반려: 칸 정보량·윤곽·질감이 얕다)" + (" — 조각 단위로는 판 라벨과 맞지 않는다(약한 라벨)" if weak_piece else ""), weak=weak_piece)
                add(f"{theme}__{slug}__v3", a, kind34, style_kind, None, "good", "farm-user", "농장 3판(PR #2541, 사용자 수락)" + (" — 조각 단위로는 판 라벨과 맞지 않는다(약한 라벨)" if weak_piece else ""), weak=weak_piece)
            else:
                add(f"{theme}__{slug}__before", b, kind34, style_kind, None, "bad", "quality-before", f"{note} 부모 커밋 판(이 PR 이 고치려던 얕은 판)", weak=True)
                add(f"{theme}__{slug}__after", a, kind34, style_kind, None, "good", "quality-after", f"{note} 병합 후 판 — 약한 라벨(수준 미달일 수 있음)", weak=True)

    bt, bs = load_commit(None, "src/assets/beodeulCityTileset.json", "public/assets/beodeul-city/beodeul-city-chipset.png")
    kits = {k["id"]: k for k in bt["structureKits"]}
    for kid, style_kind, kind34, view in BEODEUL:
        add(f"beodeul__{kid.replace('bd-', '')}", trim(render_kit(kits[kid], bs, bt["tilesPerRow"])), kind34, style_kind, view, "good", "beodeul-heldout", f"버들항 번들 키트 {kid}(기준 그림 아님)" + (" — 흑철 무채색 윤곽 예외(약한 라벨)" if kid in BEODEUL_STYLE_WEAK else ""), weak=kid in BEODEUL_STYLE_WEAK)
    tpr = bt["tilesPerRow"]
    plaza = Image.new("RGBA", (64, 48), (0, 0, 0, 0))
    for i, tid in enumerate(BEODEUL_GROUND[0][1]):
        plaza.alpha_composite(tile_image(bs, tpr, 16, tid), ((i % 4) * 16, (i // 4) * 16))
    add("beodeul__ground-plaza", plaza, "terrain", "ground", None, "good", "beodeul-heldout", "버들항 광장 판석 그룹(기준 그림 아님)")
    for kid in DEGRADE:
        src = trim(render_kit(kits[kid], bs, tpr))
        sk = next(s for k, s, _, _ in BEODEUL if k == kid)
        k34 = next(k3 for k, _, k3, _ in BEODEUL if k == kid)
        add(f"synthetic__{kid.replace('bd-', '')}", degrade(src), k34, sk, None, "bad", "synthetic-shallow", f"{kid} 를 4색 양자화+근흑 윤곽으로 얕게 만든 통제 표본")

    (OUT / "items.json").write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n")
    from collections import Counter
    print(f"{len(items)}장 → {OUT}", dict(Counter((i['group'], i['style']) for i in items)))


if __name__ == "__main__":
    main()
