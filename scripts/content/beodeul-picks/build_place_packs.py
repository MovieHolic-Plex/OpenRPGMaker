#!/usr/bin/env python3
"""장소 팩 빌더 — 공용 버들항 시트(꼬리 칸)에서 장소 하나의 칸만 뽑아 「스스로 닫힌」 작은 타일셋으로 묶는다.

스토어에서 받은 사람의 조수가 이 팩 하나만으로 그 장소를 깔 수 있어야 한다. 그래서 한 폴더에 다음을 낸다.
  tileset.json      — TilesetDef(칸 번호 새로 매김: 0부터 빽빽이, 애니메이션 띠는 한 줄 안에 연속)
  sheet.png         — 이 장소 칸만 모은 시트(한 줄 32칸)
  battle-bg.png     — (있으면) 640×360 전투 배경
  images/*.png      — 참고문서 그림(맵 렌더·조각 판)
  meta.json         — 제목·소개·설명·태그·미리보기 목록 (store-server/scripts/placePacks.ts 가 읽는다)

번호를 새로 매기므로 참고문서 속 칸 번호(23936~42879)도 같은 표로 바꾼다. 표에 없는 번호가 문서에 남으면 빌드를 멈춘다
(다른 장소 칸을 가리키는 문서는 조수를 틀린 칸으로 이끈다).

사용: python3 scripts/content/beodeul-picks/build_place_packs.py <slug>... | --all  [--out build/place-packs]
"""
from __future__ import annotations
import argparse, json, re, shutil, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
VAR = ROOT / "tiledata/beodeul-variants"
TS_JSON = ROOT / "src/assets/beodeulCityTileset.json"
REF_JSON = ROOT / "src/assets/beodeulCityReferences.json"
SHEET = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
PUBLIC = ROOT / "public"
SCRATCH = None  # --scratch 가 정하는 팩 전용 굽기 폴더(bake_pack_only.sh 가 만든다)
BASE = 23936
T = 16
TPR = 32
NUM = re.compile(r"(?<![\d.])(2[3-9]\d{3}|3\d{4}|4\d{4})(?![\d])")
EMPTY_META = {"label": "빈 칸", "description": "", "tags": [], "defaultLayer": "upper", "passage": "passable", "source": "bundled-default"}
OPEN = {"up": True, "down": True, "left": True, "right": True}


def load():
    global TS_JSON, REF_JSON, SHEET
    if SCRATCH:
        TS_JSON, REF_JSON, SHEET = SCRATCH / "beodeulCityTileset.json", SCRATCH / "beodeulCityReferences.json", SCRATCH / "beodeul-city-chipset.png"
    ts = json.loads(TS_JSON.read_text())
    refs = json.loads(REF_JSON.read_text())
    waves = json.loads((VAR / "waves.json").read_text())
    sheet = Image.open(SHEET).convert("RGBA")
    return ts, refs, waves, sheet


# 장소 자체에 일반 바닥(맨땅) 표본이 없는 곳에 이웃 장소의 바탕 키트를 빌려 준다(실측: 사막 성 팩만 받은 조수가 맨땅을 못 깔아 맵이 빈 갈색이 됐다).
EXTRA_KITS = {
    "desert-castle": [("desert-pyramid", "ground-sand"), ("desert-pyramid", "ground-dune")],
}

PACK_STEP2 = (
    "2. 땅(맨 먼저, 건너뛰지 않는다): 이 팩에는 버들항 도시의 풀밭·길 포석·광장 판석 칸이 **없다**. 이 팩의 `바닥 표본`(`ground-*`) 키트로 맵 **전체 아래층**을 채운다 — "
    "아래 「바탕 칸」 표의 대표 칸 하나를 `paint_tiles`(mode fill 또는 rect, layer 1)로 맵 전체에 먼저 칠하고, 다른 `ground-*` 표본을 덩이로 찍어 변화를 준다. 바탕이 빈 칸으로 남으면 맵이 단색 갈색·검정으로 보인다.\n"
    "   연못·풀 덩이·눈 덩이·모래 언덕처럼 **불규칙한 덩이는 키트를 찍지 않고** 문서의 「오토타일 덩이 붓」 표의 붓 칸을 `paint_tiles` 로 칠한다(엔진이 가장자리를 자동 성형). 사각형 채우기로 호수·풀밭을 만들지 않는다.\n")


def tile_blocked(p):
    return not all(p.values())


def kit_cells(kit):
    out = []
    for row in kit["rows"]:
        out += [t for t in row.get("tiles", []) if t >= 0]
        out += [t for t in row.get("upperTiles", []) if t >= 0]
    return out


def build(slug, ts, refs, waves, sheet, out_root: Path):
    ko, cats = waves["places"][slug]
    var = str(waves["var"][slug])
    group_id = waves["groups"][var][0]
    cat_id = f"beodeul-picks-{group_id}"

    kits = [k for k in ts["structureKits"] if k["id"].startswith("bd-pick-") and ko in (k.get("ai", {}).get("tags") or [])]
    if not kits:
        raise SystemExit(f"{slug}: 키트가 없다(태그 {ko!r})")
    by_id = {k["id"]: k for k in ts["structureKits"]}
    borrowed = []
    for other, name in EXTRA_KITS.get(slug, []):
        kk = by_id.get(f"bd-pick-{other}-{name}")
        if not kk:
            raise SystemExit(f"{slug}: 빌릴 키트 없음 {other}/{name}")
        kits.append(kk)
        borrowed.append(kk["id"])
    keep = set()
    for k in kits:
        keep |= set(kit_cells(k))
    groups = [g for g in ts["autotileGroups"] if g["id"].startswith(f"beodeul_wave_{slug}_")]
    for g in groups:
        keep |= set(g["memberTileIds"]) | set(g["connectTileIds"]) | set(g["variantMap"].values())
    strips = {s["baseTile"]: s for s in ts["animationStrips"]}
    # 띠의 장면들은 한 덩이로 가져간다
    for base, s in list(strips.items()):
        if any(c in keep for c in range(base, base + s["frames"])):
            keep |= set(range(base, base + s["frames"]))
    keep = sorted(c for c in keep if c >= BASE)

    # 새 번호: 오름차순, 띠는 한 줄 안에 연속(줄을 넘으면 빈 칸으로 다음 줄 앞으로)
    mapping, filler = {}, 0
    cur = 0
    i = 0
    while i < len(keep):
        c = keep[i]
        n = strips[c]["frames"] if c in strips else 1
        if n > 1 and (cur % TPR) + n > TPR:
            filler += TPR - (cur % TPR)
            cur += TPR - (cur % TPR)
        for k in range(n):
            mapping[c + k] = cur + k
        cur += n
        i += n
    count = cur
    rows = (count + TPR - 1) // TPR
    count = rows * TPR  # 마지막 줄을 채운다

    # 시트
    out = Image.new("RGBA", (TPR * T, rows * T), (0, 0, 0, 0))
    for old, new in mapping.items():
        x, y = (old % 128) * T, (old // 128) * T
        out.alpha_composite(sheet.crop((x, y, x + T, y + T)), ((new % TPR) * T, (new // TPR) * T))

    # 칸 표
    passability = [dict(OPEN)] * count
    priority = ["upper"] * count
    terrain = [0] * count
    tile_meta = [dict(EMPTY_META) for _ in range(count)]
    for old, new in mapping.items():
        passability[new] = ts["passability"][old]
        priority[new] = ts["priority"][old]
        terrain[new] = ts["terrain"][old]
        tile_meta[new] = ts["tileMeta"][old]

    def rm(n):
        return mapping[n] if n >= 0 else n

    new_kits = []
    for k in kits:
        k2 = json.loads(json.dumps(k))
        for row in k2["rows"]:
            row["tiles"] = [rm(t) for t in row.get("tiles", [])]
            row["upperTiles"] = [rm(t) for t in row.get("upperTiles", [])]
        new_kits.append(k2)
    # 오토타일 표본판 키트는 찍는 물건이 아니다(실측: 조수가 4×4 변형판을 그대로 찍어 연못이 변형판 무늬가 됐다). 그룹 붓으로만 칠하게 키트에서 뺀다.
    def is_sheet_kit(k):
        return re.sub(r"^bd-pick-[a-z0-9-]+?-(?=autotile-)", "", k["id"]).startswith("autotile-")
    new_kits = [k for k in new_kits if not is_sheet_kit(k)]
    new_groups = []
    for g in groups:
        g2 = json.loads(json.dumps(g))
        g2["memberTileIds"] = [rm(t) for t in g["memberTileIds"]]
        g2["connectTileIds"] = [rm(t) for t in g["connectTileIds"]]
        g2["variantMap"] = {kk: rm(v) for kk, v in g["variantMap"].items()}
        new_groups.append(g2)
    new_tile_groups = []
    for g in ts["tileGroups"]:
        ids = [t for t in g.get("tileIds", []) if t in mapping]
        if ids and g["id"].startswith("beodeul_wave:") and g["id"].startswith(f"beodeul_wave:{slug}-"):
            g2 = json.loads(json.dumps(g)); g2["tileIds"] = [mapping[t] for t in ids]; new_tile_groups.append(g2)
    new_strips = [dict(baseTile=mapping[b], frames=s["frames"], fps=s["fps"]) for b, s in sorted(strips.items()) if b in mapping]
    foot = sorted(mapping[c] for c in ts.get("footprintOpened", []) if c in mapping)

    # 참고문서: 이 장소 문서 + 이 묶음 안내 + 그림
    cat = next(c for c in refs if c["id"] == cat_id)
    doc_ids = {f"bd-pick-doc-{slug}", f"bd-pick-doc-{group_id}-guide"}
    docs = [d for d in cat["documents"] if d["id"] in doc_ids]
    img_ids = {f"bd-pick-img-{slug}-map", f"bd-pick-img-{slug}-parts"}
    imgs = [im for im in cat["images"] if im["id"] in img_ids]
    unmapped = set()

    def rewrite(text):
        def sub(m):
            n = int(m.group(1))
            if n in mapping:
                return str(mapping[n])
            unmapped.add(n)
            return m.group(0)
        return NUM.sub(sub, text)

    brush_rows = []
    for g2 in new_groups:
        full = g2["variantMap"].get("15")
        if full is None:
            continue
        gslug = g2["id"].split("_autotile_")[-1].replace("_", "-")
        walk = "걷기" if not tile_blocked(passability[full]) else "막힘"
        layer = "3 (위층)" if g2.get("layer") == "upper" else "**2 (덧그림 층)**"
        brush_rows.append(f"| `{g2['id']}` | {g2['name'].split(' · ')[-1]} | {full} | {layer} | {walk} |")
    brush_md = ("\n## 오토타일 덩이 붓 (연못·풀 덩이·눈 덩이·모래 언덕… — 불규칙한 덩이는 이것으로만)\n\n"
                "`autotile-*` 표본판은 이 팩에서 **찍는 키트가 아니다**(변형판 무늬가 그대로 찍힌다). 덩이는 `paint_tiles`(rect/line/cells)로 아래 「붓 칸」을 **표에 적힌 층**에 칠하면 엔진이 둘레를 보고 16변형 가장자리로 자동 성형한다. "
                "덩이 하나를 직사각형이 아니라 둥글고 울퉁불퉁한 외곽(여러 번 나눠 칠하기)으로 만들고, 칠한 뒤 `show_map_region` 으로 가장자리를 확인한다. 층이 2(덧그림 층)인 붓(걷는 덩이)은 반드시 layer \"2\" 로 칠한다 — 1층에 칠하면 투명 가장자리가 검게 뚫린다. 층이 3인 붓(막힘 덩이)은 layer \"3\". 둘 다 아래층 바탕 위에 겹치므로 바탕을 먼저 채운다.\n\n"
                "| 그룹 id | 이름 | 붓 칸 | 칠할 층 | 통행 |\n|---|---|---|---|---|\n" + "\n".join(brush_rows) + "\n") if brush_rows else ""

    # 바탕 칸 표: ground-/floor- 표본 키트의 대표(가운데) 칸
    ground_rows = []
    for k in new_kits:
        tail = re.sub(r"^bd-pick-[a-z0-9-]+?-(?=(ground|floor)-)", "", k["id"])
        if not tail.startswith(("ground-", "floor-")):
            continue
        w, h = k["width"], k["height"]
        center = k["rows"][h // 2]["tiles"][w // 2]
        if center < 0:
            continue
        passable = "걷기" if not tile_blocked(passability[center]) else "막힘"
        ground_rows.append(f"| `{tail}` | {w}×{h} | {center} | {passable} |")
    ground_md = ("\n## 바탕 칸 (맵 바탕 채우기용 — 이 팩 번호)\n\n| 바닥 표본 키트 | 크기 | 대표 칸 번호 | 통행 |\n|---|---|---|---|\n" + "\n".join(ground_rows) + "\n") if ground_rows else ""

    new_docs = []
    for d in docs:
        md = d["markdown"]
        if d["id"].endswith("-guide"):
            step2 = ("2. 이 팩은 **이벤트 소품 전용**이다 — 바닥·건물은 없다. 다른 장소 팩(또는 버들항)으로 깐 맵 위에 목적 있는 자리(저장 수정·문·상자·장치 방)에 찍는다. "
                     "`evfloor_*` 바닥 장식(워프 패드 등)은 걷기 칸이다.\n") if slug == "event-props" else PACK_STEP2
            md = re.sub(r"2\. 땅: .*\n", lambda m: step2, md, count=1)
        else:
            md = md.rstrip("\n") + "\n" + ground_md + brush_md
        md = md.replace("kit:beodeul_city/", "kit:<이 팩의 타일셋 id>/")
        # 시트 머리글은 이 팩 기준으로 다시 쓴다(번호 범위 설명이 거기 있다)
        md = re.sub(r"tilesetId `beodeul_city` · 그림 .*\n", (
            f"이 팩의 타일셋(이름 '버들항 · {ko}')은 이 장소의 칸 {count}개를 0번부터 빽빽이 모은 시트다(16px 칸, 한 줄 {TPR}칸 — 번호 n 의 칸은 행 n÷{TPR}, 열 n%{TPR}). "
            "다른 타일셋의 번호를 섞지 않는다. 키트 id 는 `list_spatial_designs`·`tile_query` 로 확인한다.\n"), md, count=1)
        md = rewrite(md)
        new_docs.append(dict(id=d["id"], name=d["name"], markdown=md))
    if unmapped:
        raise SystemExit(f"{slug}: 문서에 표에 없는 칸 번호가 있다: {sorted(unmapped)[:12]} … ({len(unmapped)}개)")

    name = f"버들항 · {ko}"
    tileset = dict(
        id=f"beodeul_{slug.replace('-', '_')}", name=name, textureKey=f"tex_beodeul_{slug.replace('-', '_')}", image=dict(type="uploaded", id=f"beodeul_{slug.replace('-', '_')}_sheet"),
        kind="custom", family="oprn-atlas", tileSize=T, tilesPerRow=TPR, count=count,
        passability=passability, priority=priority, terrain=terrain, tileMeta=tile_meta,
        tileGroups=new_tile_groups, animationStrips=new_strips, structureKits=new_kits, autotileGroups=new_groups,
        footprintOpened=foot,
        referenceDocuments=[dict(id=cat_id, name=f"{name} (장소 팩)", description=f"{ko} — 키트 {len(new_kits)}종과 조립 순서.", documents=new_docs,
                                 images=[dict(im, dataUrl="/images/" + Path(im["dataUrl"]).name) for im in imgs])],
    )

    d = out_root / slug
    if d.exists():
        shutil.rmtree(d)
    (d / "images").mkdir(parents=True)
    out.save(d / "sheet.png", optimize=True)
    for im in imgs:
        src = (SCRATCH / "references/picks" / Path(im["dataUrl"]).name) if SCRATCH else PUBLIC / im["dataUrl"].lstrip("/")
        shutil.copy(src, d / "images" / Path(im["dataUrl"]).name)
    bg = next((p for p in [VAR / slug / "battle-bg.png", *VAR.glob(f"battle-bg-*/{slug}.png")] if p.exists()), None)
    if bg:
        shutil.copy(bg, d / "battle-bg.png")
    plan = (VAR / slug / "plan.md")
    use = ""
    if plan.exists():
        m = re.search(r"##\s*용도\s*\n+(.+?)(?:\n##|\Z)", plan.read_text(), re.S)
        use = " ".join(m.group(1).split()) if m else ""
    (d / "tileset.json").write_text(json.dumps(tileset, ensure_ascii=False, separators=(",", ":")))
    meta = dict(slug=slug, ko=ko, cats=cats, kits=len(new_kits), autotiles=len(new_groups), strips=len(new_strips), cells=len(mapping), count=count, filler=filler,
                use=use, hasBattleBg=bool(bg), images=[Path(im["dataUrl"]).name for im in imgs], battleBgName=f"버들항 전투 배경 · {ko}")
    (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    return meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slugs", nargs="*")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default=str(ROOT / "build/place-packs"))
    ap.add_argument("--scratch", help="팩 전용 굽기 폴더(BEODEUL_PACK_SCRATCH 로 bake_picks.py 를 돌린 곳)")
    a = ap.parse_args()
    global SCRATCH
    if a.scratch:
        SCRATCH = Path(a.scratch).resolve()
    ts, refs, waves, sheet = load()
    pack_only = set(waves.get("packOnly", []))
    todo = ([s for s in waves["places"] if (s in pack_only) == bool(SCRATCH)]) if a.all else a.slugs
    if not todo:
        print(__doc__); return 1
    out = Path(a.out)
    for slug in todo:
        m = build(slug, ts, refs, waves, sheet, out)
        sz = (out / slug / "tileset.json").stat().st_size
        print(f"{slug:22s} 키트 {m['kits']:3d} 오토타일 {m['autotiles']:2d} 띠 {m['strips']:2d} 칸 {m['cells']:4d}→{m['count']:4d} (채움 {m['filler']}) tileset {sz/1024:.0f}KB 전투배경 {'O' if m['hasBattleBg'] else '-'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
