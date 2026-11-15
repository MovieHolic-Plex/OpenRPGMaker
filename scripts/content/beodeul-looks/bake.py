#!/usr/bin/env python3
"""버들항 «게임마다 다른 겉모습» 그림판 굽기 — 바닥·길·광장 재질과 나무 수종.

  python3 scripts/content/beodeul-looks/bake.py            # 굽는다(관문 통과분만)
  python3 scripts/content/beodeul-looks/bake.py --check    # 다시 구워 지금 파일과 같은지만 본다(아무것도 쓰지 않는다)

무엇을 굽나
- 재질(tiledata/beodeul-looks/textures, 16×16 이음매 없는 칸): 버들항 시트는 풀밭(737)·길 포석 몸통(3221)·광장 판석(1509)·모랫길 몸통(23175)을
  «같은 자리 같은 화소» 로 되풀이해 그렸다(시트 35,200칸 가운데 풀 화소가 실린 칸이 3천여). 그래서 겉모습 하나는 «그 화소 자리에 새 재질의
  같은 자리 화소» 를 넣은 칸 묶음이다 — 가장자리·연석·집 밑동·물가는 원래 그림 그대로 남고 재질만 바뀐다(가장자리는 코드, 재질만 그림).
  흙길·자갈길은 연석 없이 모랫길 오토타일의 들쭉날쭉한 가장자리 꼴을 빌리고, 널길은 연석 자리를 널로 덮고 바깥 줄만 어둡게 한다.
- 나무(tiledata/beodeul-looks/trees): 수종마다 4×5·3×4·3×3·2×2 칸 그림 둘씩. 같은 크기의 옛 나무 킷 칸에 번갈아 덮는다(칸 번호·통행 그대로).

무엇을 쓰나
- public/assets/beodeul-looks/chipset.png — 그림판(128칸 폭). src/assets/beodeulLooks.json — 겉모습마다 «어느 칸을 그림판 어느 칸으로» 표.
- 버들항 시트·타일셋 정의는 한 글자도 바꾸지 않는다. 맵의 칸 번호도 그대로다(그림만 겹쳐 그린다 — src/assets/tilesetLooks.ts).

3/4 관문(hard rule): 새로 그린 그림(재질 칸·나무)마다 object-gate 출구 `require_all(context="bundle")` — 하나라도 막히면 아무것도 쓰지 않는다.
이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음**(spec.waiver, harness-data/object-gate/waivers)으로 출구를 지난다. 한 화소라도 바꾸면 면제가 풀린다.
"""
import argparse, json, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
STORE = ROOT / "tiledata/beodeul-looks"
OUT_PNG = ROOT / "public/assets/beodeul-looks/chipset.png"
OUT_JSON = ROOT / "src/assets/beodeulLooks.json"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
T, COLS = 16, 128
REF = {"ground": 737, "road": 3221, "plaza": 1509, "track": 23175}
# 재질 화소가 실린 다른 그림판(이식 원본) — 물가 풀 가장자리·짙은 풀 가장자리 같은 덧그림
SOURCES = {
    "tex_beodeul_city": ("public/assets/beodeul-city/beodeul-city-chipset.png", 128),
    "tex_beodeul_nature": ("public/assets/beodeul-nature/chipset.png", 16),
    "tex_beodeul_ground": ("public/assets/beodeul-ground/chipset.png", 8),
}
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."


def tiles_of(path, cols):
    a = np.array(Image.open(ROOT / path).convert("RGBA"))
    rows = a.shape[0] // T
    assert a.shape[1] == cols * T, (path, a.shape)
    return a[: rows * T].reshape(rows, T, cols, T, 4).swapaxes(1, 2).reshape(-1, T, T, 4).copy()


def solid(eq):
    """재질 화소로 볼 자리: 2×2 가 통째로 같거나, 가로·세로로 넷 이상 이어 같은 화소. 한두 점 우연히 같은 색(집 벽·그늘진 풀)은 건드리지 않는다."""
    keep = np.zeros_like(eq)
    b = eq[:, :-1, :-1] & eq[:, 1:, :-1] & eq[:, :-1, 1:] & eq[:, 1:, 1:]
    keep[:, :-1, :-1] |= b; keep[:, 1:, :-1] |= b; keep[:, :-1, 1:] |= b; keep[:, 1:, 1:] |= b
    for axis in (1, 2):
        e = eq if axis == 2 else eq.swapaxes(1, 2)
        run = e[:, :, :-3] & e[:, :, 1:-2] & e[:, :, 2:-1] & e[:, :, 3:]
        k = np.zeros_like(e)
        for d in range(4):
            k[:, :, d: d + run.shape[2]] |= run
        keep |= k if axis == 2 else k.swapaxes(1, 2)
    keep &= eq
    keep[keep.sum((1, 2)) < 4] = False
    return keep


def darker(tex):
    """재질 칸의 «한 단 어두운» 판 — 그 칸이 쓰는 색 안에서 밝기 순으로 한 칸 내린다(새 색 0)."""
    cols = sorted({tuple(int(v) for v in p) for p in tex[:, :, :3].reshape(-1, 3)}, key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
    step = {c: cols[max(0, i - 1)] for i, c in enumerate(cols)}
    out = tex.copy()
    for y in range(T):
        for x in range(T):
            out[y, x, :3] = step[tuple(int(v) for v in tex[y, x, :3])]
    return out


def darkest(tex):
    cols = sorted({tuple(int(v) for v in p) for p in tex[:, :, :3].reshape(-1, 3)}, key=lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2])
    return np.array([*cols[0], 255], np.uint8)


def near(mask):
    """4이웃에 mask 가 있는 자리(칸 안에서만)."""
    p = np.pad(mask, 1)
    return p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]


def load():
    spec = json.loads((STORE / "spec.json").read_text(encoding="utf-8"))
    tex = {}
    for it in spec["textures"]:
        im = Image.open(STORE / "textures" / it["src"]).convert("RGBA")
        assert im.size == (T, T) and np.array(im)[:, :, 3].min() == 255, it["id"]
        tex[it["id"]] = np.array(im)
    trees = {}
    for it in spec["trees"]:
        w, h = (int(v) * T for v in it["slot"].split("x"))
        im = Image.open(STORE / "trees" / it["src"]).convert("RGBA")
        assert im.size == (w, h), (it["id"], im.size)
        trees[it["id"]] = im
    return spec, tex, trees


def gate(spec, tex, trees):
    from object_gate import require_all
    items = [(Image.fromarray(tex[it["id"]], "RGBA"), it["kind"], f"beodeul_looks/{it['id']}") for it in spec["textures"]]
    items += [(trees[it["id"]], it["kind"], f"beodeul_looks/{it['id']}") for it in spec["trees"]]
    got = require_all(items, context="bundle")
    print(f"관문(bundle 출구): {len(got)}/{len(items)} — {GATE_NOTE} 묶음 {spec['waiver']}")


def compose(spec, tex, trees):
    """→ (그림판 칸 목록, 표). 그림판 칸 0 은 비워 둔다(투명)."""
    ts = json.loads(TS_PATH.read_text(encoding="utf-8"))
    groups = {g["id"]: g for g in ts["autotileGroups"]}
    road_of = {k: groups["beodeul_road_autotile"]["variantMap"][str(k)] for k in range(16)}
    sand_of = {k: groups["beodeul_sand_autotile"]["variantMap"][str(k)] for k in range(16)}
    sheets = {key: tiles_of(path, cols) for key, (path, cols) in SOURCES.items()}
    city = sheets["tex_beodeul_city"]
    refs = {part: city[t].copy() for part, t in REF.items()}
    masks = {key: {part: solid((tl == refs[part][None]).all(-1)) for part in REF} for key, tl in sheets.items()}
    cells = [np.zeros((T, T, 4), np.uint8)]
    table = {"version": 1, "tilesetId": "beodeul_city", "image": "tex_beodeul_city", "texture": "tex_beodeul_looks", "tileSize": T, "tilesPerRow": COLS,
             "note": "생성 파일 — scripts/content/beodeul-looks/bake.py. targets.ground[i] 칸의 그림 = 그림판 (grounds[바닥].base + i), targets.paved[i] 칸의 그림 = 그림판 (겉모습 base + i). sources·pairs 는 [원본 칸, 그림판 칸] 쌍을 편 목록.",
             "gate": f"3/4 gate not passed — owner waiver {spec['waiver']}", "parts": {"surface": {"options": {}}, "trees": {"options": {}}, "woods": {"options": spec["woods"]},
                                                                                             "houses": {"options": spec["houses"]}, "plaza": {"options": spec["plaza"]}}}
    built = {}
    for sid, s in spec["surfaces"].items():
        new = {part: (tex[s[part]] if s.get(part) else None) for part in REF}
        out = {key: tl.copy() for key, tl in sheets.items()}
        # 1) 재질 화소 바꾸기(모든 그림판)
        for key in sheets:
            for part in REF:
                if new[part] is None: continue
                m = masks[key][part]
                out[key][m] = np.broadcast_to(new[part][None], out[key].shape)[m]
        # 2) 길 오토타일 16칸 — 가장자리 꼴
        ground = new["ground"] if new["ground"] is not None else refs["ground"]
        edge = s.get("roadEdge", "kerb")
        if new["road"] is not None and edge in ("soft", "plank"):
            body = new["road"]
            for k in range(16):
                r, sd = road_of[k], sand_of[k]
                if edge == "soft":
                    outside = masks["tex_beodeul_city"]["ground"][sd]
                    pic = np.where(outside[:, :, None], ground, body)
                    rim = ~outside & near(outside)
                    pic[rim] = darker(body)[rim]
                else:
                    kerb = ~masks["tex_beodeul_city"]["road"][r]
                    pic = body.copy()
                    line = kerb & ~near(~kerb)
                    pic[line] = darkest(body)
                out["tex_beodeul_city"][r] = pic
        # 3) 모랫길 오토타일 16칸 — 몸통·가장자리 그늘을 새 재질로(바깥 풀 화소는 1)에서 이미 바뀜)
        if new["track"] is not None:
            body = new["track"]
            for k in range(16):
                sd = sand_of[k]
                outside = masks["tex_beodeul_city"]["ground"][sd]
                pic = np.where(outside[:, :, None], ground, body)
                rim = ~outside & ~masks["tex_beodeul_city"]["track"][sd] & near(outside)
                pic[rim] = darker(body)[rim]
                out["tex_beodeul_city"][sd] = pic
        built[sid] = out
    # 바닥 재질만 실린 칸은 바닥 재질마다 한 벌(같은 바닥을 쓰는 겉모습이 나눠 쓴다), 길·광장 화소가 섞인 칸은 겉모습마다 한 벌.
    members = set(road_of.values()) | set(sand_of.values())
    city_m = masks["tex_beodeul_city"]
    has_ground = city_m["ground"].any((1, 2))
    has_paved = city_m["road"].any((1, 2)) | city_m["plaza"].any((1, 2)) | city_m["track"].any((1, 2))
    for t in members: has_paved[t] = True
    ground_targets = [int(t) for t in np.nonzero(has_ground & ~has_paved)[0]]
    paved_targets = [int(t) for t in np.nonzero(has_paved)[0]]
    table["targets"] = {"ground": ground_targets, "paved": paved_targets}
    grounds = {}
    for sid, s in spec["surfaces"].items():
        gid = s.get("ground")
        if gid and gid not in grounds:
            base = len(cells)
            cells.extend(built[sid]["tex_beodeul_city"][ground_targets])
            sources = {}
            for key in sheets:
                if key == "tex_beodeul_city": continue
                pairs = []
                for t in np.nonzero((built[sid][key] != sheets[key]).any((1, 2, 3)))[0]:
                    pairs += [int(t), len(cells)]
                    cells.append(built[sid][key][t])
                if pairs: sources[key] = pairs
            grounds[gid] = {"base": base, **({"sources": sources} if sources else {})}
        base = len(cells)
        cells.extend(built[sid]["tex_beodeul_city"][paved_targets])
        table["parts"]["surface"]["options"][sid] = {"label": s["label"], "en": s["en"], **({"ground": gid} if gid else {}), "base": base}
    table["grounds"] = grounds
    # 표가 덮지 않는 바뀐 칸이 없어야 한다
    covered = np.zeros(len(city), bool); covered[ground_targets] = True; covered[paved_targets] = True
    for sid, out in built.items():
        miss = np.nonzero((out["tex_beodeul_city"] != city).any((1, 2, 3)) & ~covered)[0]
        assert not len(miss), (sid, miss[:8])
    # 나무
    kits = {k["id"]: k for k in ts["structureKits"]}
    used = {}
    nature = json.loads((ROOT / "src/assets/beodeulNatureCatalog.json").read_text(encoding="utf-8"))
    canopy_tiles = sorted({t for row in nature["forestCanopy"]["leaf"] for t in row if t >= 0})
    cp = sheets["tex_beodeul_nature"][canopy_tiles]; crgb = cp[:, :, :, :3].astype(int)
    cleaf = (cp[:, :, :, 3] == 255) & (crgb[..., 1] >= crgb[..., 0]) & (crgb[..., 1] >= crgb[..., 2])
    clum = (0.299 * crgb[..., 0] + 0.587 * crgb[..., 1] + 0.114 * crgb[..., 2])[cleaf]
    canopy_cuts = np.quantile(clum, [0.08, 0.25, 0.45, 0.65, 0.82, 0.95])  # 밝기 일곱 단 경계
    for sp, info in spec["species"].items():
        pairs, cover = [], {}
        for slot, kit_ids in spec["treeSlots"].items():
            pics = [it for it in spec["trees"] if it["species"] == sp and it["slot"] == slot]
            if not pics: continue
            for n, kid in enumerate(kit_ids):
                kit = kits[kid]; im = np.array(trees[pics[n % len(pics)]["id"]])
                # 덮개 값(칸마다 불투명 몫 0~100): 숲길의 나무 composer 가 «이 칸이 뒤 나무를 다 가리는가» 를 이 값으로 본다 — 원래 나무의 값으로 겹치면 수종 그림이 조각난다
                cover[kid] = [int(round(100 * (im[y * T:(y + 1) * T, x * T:(x + 1) * T, 3] > 127).mean())) for y in range(kit["height"]) for x in range(kit["width"])]
                assert (kit["width"], kit["height"]) == tuple(int(v) for v in slot.split("x")), kid
                for y, row in enumerate(kit["rows"]):
                    for x in range(kit["width"]):
                        up = (row.get("upperTiles") or [-1] * kit["width"])[x]
                        t = up if up >= 0 else row["tiles"][x]
                        assert t >= 0, (kid, x, y)
                        assert used.setdefault((sp, t), kid) == kid, f"칸 {t} 을 두 나무가 쓴다: {kid}"
                        pairs += [int(t), len(cells)]
                        cells.append(im[y * T:(y + 1) * T, x * T:(x + 1) * T])
        # 숲 수관(이어진 숲 덩이 오토타일, 버들항 자연 덧그림)도 그 수종 색으로 — 잎 화소만 밝기 순으로 수종 색 줄에 옮긴다(그림은 그대로, 새 색 0)
        sources = {}
        if info.get("canopy"):
            ramp = np.array([[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in info["canopy"]], np.uint8)
            src = sheets["tex_beodeul_nature"]; spairs = []
            for t in canopy_tiles:
                pic = src[t].copy(); rgb = pic[:, :, :3].astype(int)
                leaf = (pic[:, :, 3] == 255) & (rgb[:, :, 1] >= rgb[:, :, 0]) & (rgb[:, :, 1] >= rgb[:, :, 2])
                if not leaf.any(): continue
                lum = 0.299 * rgb[:, :, 0] + 0.587 * rgb[:, :, 1] + 0.114 * rgb[:, :, 2]
                pic[:, :, :3][leaf] = ramp[np.clip(np.searchsorted(canopy_cuts, lum[leaf]), 0, len(ramp) - 1)]
                spairs += [int(t), len(cells)]; cells.append(pic)
            if spairs: sources["tex_beodeul_nature"] = spairs
        if pairs:
            table["parts"]["trees"]["options"][sp] = {"label": info["label"], "en": info["en"], "pairs": pairs, "cover": cover, **({"sources": sources} if sources else {})}
    table["count"] = -(-len(cells) // COLS) * COLS
    return cells, table


def sheet_png(cells, count):
    a = np.zeros((count // COLS * T, COLS * T, 4), np.uint8)
    for i, c in enumerate(cells):
        y, x = divmod(i, COLS)
        a[y * T:(y + 1) * T, x * T:(x + 1) * T] = c
    return Image.fromarray(a, "RGBA")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    spec, tex, trees = load()
    gate(spec, tex, trees)
    cells, table = compose(spec, tex, trees)
    im = sheet_png(cells, table["count"])
    text = json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n"
    surf = table["parts"]["surface"]["options"]; tr = table["parts"]["trees"]["options"]
    print(f"그림판 {im.size[0]}×{im.size[1]} · 칸 {len(cells)}(표 {table['count']}) · 바닥 겉모습 {len(surf)}(바닥 칸 {len(table['targets']['ground'])} · 길·광장 칸 {len(table['targets']['paved'])}) · 나무 수종 {len(tr)}")
    if args.check:
        same = OUT_JSON.exists() and OUT_JSON.read_text(encoding="utf-8") == text and OUT_PNG.exists() and np.array_equal(np.array(Image.open(OUT_PNG).convert("RGBA")), np.array(im))
        print("같다" if same else "다르다 — 다시 구워야 한다")
        sys.exit(0 if same else 1)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True)
    im.save(OUT_PNG, optimize=True)
    OUT_JSON.write_text(text, encoding="utf-8")
    print(f"썼다: {OUT_PNG.relative_to(ROOT)} ({OUT_PNG.stat().st_size // 1024} KB) · {OUT_JSON.relative_to(ROOT)} ({len(text) // 1024} KB)")


if __name__ == "__main__":
    main()
