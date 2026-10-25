#!/usr/bin/env python3
"""버들항 던전 천장 테두리 — 버들항 시트 꼬리(28,416~, 한 행 128칸)에 47 모양 × 2 결 + 허공 결 2칸을 덧붙여 굽는다.

  python3 scripts/content/beodeul-dungeon/bake_dungeon_ceiling.py --gate-export DIR   # 3/4 관문에 낼 조립 표본 + items.jsonl
  python3 scripts/content/beodeul-dungeon/bake_dungeon_ceiling.py                     # 관문 영수증을 확인하고 굽는다

왜(2026-10-14 적대 QA): author_beodeul_dungeon 이 천장을 3×3 견본 키트의 가운데 칸(테두리 없는 허공) 하나로만 깔아서
바닥이 검은 허공에 그대로 잘리고(앞 턱·옆벽 없음) 높이가 다른 벽 조각이 이음 없이 만났다. 변형 던전 렌더
(tiledata/beodeul-variants/castle-catacombs 등)는 천장이 바닥·벽과 닿는 쪽마다 벽 두께 띠를 그린다 — 그 함수(dlib.ceiling)를
그대로 47 모양으로 잘라 오토타일 그룹 `beodeul_dungeon_ceiling`(+ 결 변형 `beodeul_dungeon_ceiling_b`)으로 굽는다.

덧붙이기 전용: 앞 칸 번호는 바뀌지 않는다. bake_farm.py 가 시트를 다시 쓰면 이 꼬리를 보존한다(그 끝에서 이 스크립트를 다시 불러도 같다, 멱등).
3/4 관문(hard rule): 조립 표본마다 현재 판정 프로필의 PASS 영수증이 있어야 굽는다(미보정 프로필이면 임시 통과). 한 모양이라도 덮이지 않으면 굽지 않는다.
"""
import argparse, json, os, pathlib, random, re, subprocess, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ceiling_art as C  # noqa: E402

ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
T = 16
COLS = 128
BASE = 28416          # 농장 꼬리(27,648~28,415) 끝 = 던전 천장 시작
BASE_ROW = BASE // COLS
ROWS_ADDED = 1
COUNT = BASE + ROWS_ADDED * COLS
SEEDS = (0, 2)        # 결 두 가지(dlib.ceiling seed%4 = 돌 결 오프셋)
VOID_EXTRA = (1, 3)   # 사방이 천장인 칸(검은 허공)의 결 둘 더
GROUP_IDS = ("beodeul_dungeon_ceiling", "beodeul_dungeon_ceiling_b")


def tid(col): return BASE + col


def cell_table():
    """-> {tile_id: (img, key)}"""
    cells = {}
    for v, seed in enumerate(SEEDS):
        for i, m in enumerate(C.SHAPES):
            cells[tid(v * 47 + i)] = (C.tile(m, seed), f"ceil:{seed}:{m}")
    for j, seed in enumerate(VOID_EXTRA):
        cells[tid(2 * 47 + j)] = (C.tile(255, seed), f"ceil:{seed}:255")
    return cells


# ---------------------------------------------------------------- 조립 표본(관문)
# 표본은 시공기(compose.ts)가 실제로 낸 층이다 — beodeul-dungeon-samples.mts 가 쓴 JSON 을 천장 칸만 이 그림으로 덮어 그린다.
# 결 두 가지(SEEDS)를 각각 따로 그려 낸다(한 장 = 한 결). 표본이 쓰지 않는 모양은 실제 배치에서도 안 나오므로 굽지 않고 nearest 로 접는다.
def _renderer():
    import importlib.util
    spec = importlib.util.spec_from_file_location("render_dungeon", str(ROOT / "scripts/content/render-beodeul-dungeon-samples.py"))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


def gate_items(samples_dir):
    R = _renderer()
    docs = [json.loads(p.read_text()) for p in sorted(pathlib.Path(samples_dir).glob("*.json"))]
    docs = [d for d in docs if "picture" in d]
    if not docs: sys.exit(f"표본 JSON 이 없다: {samples_dir} (bun scripts/content/beodeul-dungeon-samples.mts {samples_dir})")
    # 모양을 가장 많이 덮는 표본부터 골라 다 덮을 때까지
    used_of = {d["name"]: {C.canonical(m) for m in R.rim_masks(d).values()} for d in docs}
    want = set().union(*used_of.values())
    chosen, covered = [], set()
    for d in sorted(docs, key=lambda d: -len(used_of[d["name"]])):
        if used_of[d["name"]] - covered:
            chosen.append(d); covered |= used_of[d["name"]]
        if covered == want: break
    items = []
    for d in chosen:
        for seed in SEEDS:
            items.append((f"dungeon_{d['name']}_s{seed}", R.render(d, rim=seed), used_of[d["name"]], seed))
    return items


def nearest(m, have):
    """굽지 않은 모양은 열린 대각선을 닫아 가며(작은 모서리 점을 빼며) 가장 가까운 구운 모양으로."""
    if m in have: return m
    diag = [b for b in (16, 32, 64, 128) if not (m & b) and (m & 15) == 15]
    best = None
    for k in range(1 << len(diag)):
        c = m
        for i, b in enumerate(diag):
            if k >> i & 1: c |= b
        if c in have and (best is None or bin(c ^ m).count("1") < bin(best ^ m).count("1")): best = c
    return best if best is not None else 255


_PROFILE = None


def current_profile():
    global _PROFILE
    if _PROFILE: return _PROFILE
    out = subprocess.run(["npm", "run", "-s", "harness", "--", "object-gate", "status"], cwd=ROOT, capture_output=True, text=True).stdout
    m = re.search(r"현재 규칙 프로필 ([0-9a-f]{16})", out)
    if not m: raise RuntimeError("현재 판정 프로필 해시를 못 읽었다(object-gate status)")
    _PROFILE = m.group(1)
    return _PROFILE


def gate_state(img, kind="terrain"):
    import object_gate as OG
    rc = OG.read_receipt(OG.pixel_sha256(img))
    if not rc: return None, "영수증 없음"
    if rc.get("kind") != kind: return None, f"영수증 종류 {rc.get('kind')} ≠ {kind}"
    if rc.get("profileHash") != current_profile() and rc.get("profileHash") not in OG.calibrated_profiles():
        return None, f"옛 프로필 {rc.get('profileHash')} 영수증"
    if rc.get("verdict") != "pass": return None, "불합격(" + " · ".join(rc.get("reasons") or ["fail"]) + ")"
    return ("pass" if rc.get("profileHash") in OG.calibrated_profiles() else "provisional"), None


GATE_NAME = ("16px top-down 3/4 dungeon floor plan (whole map): grey flagstone floors, dark stone wall faces standing on the north edge of each floor, "
             "the black ceiling mass between rooms with a light stone wall-top band (wall thickness) wherever it meets floor or a wall face, "
             "and dungeon dressing: wall torches, banners, niches, columns, coffins, crates, barrels, altar, stairs")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-export", help="3/4 관문용 조립 표본 PNG 와 items.jsonl 을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--samples", default=str(ROOT / "tiledata/beodeul-dungeon/gate-samples"),
                    help="시공 표본 JSON 폴더(beodeul-dungeon-samples.mts 가 쓴 것 중 천장 모양을 다 덮는 표본만 남긴 사본)")
    args = ap.parse_args()
    TS = json.loads(TS_PATH.read_text())
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    items = gate_items(args.samples)
    all_used = set().union(*(u for _, _, u, _ in items))

    if args.gate_export:
        out = pathlib.Path(args.gate_export); out.mkdir(parents=True, exist_ok=True)
        lines = []
        for name, im, _, _ in items:
            p = out / f"{name}.png"; im.save(p)
            lines.append(dict(png=str(p), kind="terrain", name=GATE_NAME, label=f"beodeul_dungeon/{name}"))
        (out / "items.jsonl").write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in lines) + "\n")
        print("gate export", len(lines), "->", out)
        return

    # ---- 관문: (결, 모양)마다 그것을 화소 그대로 품은 조립 표본 하나라도 통과해야 한다 ----
    cleared_by_seed, provisional, why = {s: set() for s in SEEDS}, [], {}
    for name, im, used, seed in items:
        st, reason = gate_state(im)
        if st is None: why[name] = reason; continue
        cleared_by_seed[seed] |= used
        if st == "provisional": provisional.append(name)
    cleared = set.intersection(*cleared_by_seed.values())
    missing = sorted(all_used - cleared)
    if missing:
        print("3/4 관문 미통과 — 굽지 않는다:", file=sys.stderr)
        for k, v in why.items(): print("  ", k, "←", v, file=sys.stderr)
        print("   덮이지 않은 모양:", missing, file=sys.stderr)
        sys.exit(2)
    if provisional: print(f"  임시 통과(프로필 {current_profile()} 미보정): {len(provisional)}장")

    cells = {t: v for t, v in cell_table().items() if int(v[1].split(":")[2]) in cleared}
    # ---- 시트: 앞 BASE_ROW 행은 그대로, 뒤 한 행 ----
    out_sheet = Image.new("RGBA", (COLS * T, (BASE_ROW + ROWS_ADDED) * T), (0, 0, 0, 0))
    out_sheet.alpha_composite(sheet.crop((0, 0, COLS * T, BASE_ROW * T)), (0, 0))
    for t, (im, _) in cells.items():
        i = t - BASE
        out_sheet.alpha_composite(im, ((i % COLS) * T, (BASE_ROW + i // COLS) * T))
    out_sheet.save(SHEET_PATH, optimize=True)

    # ---- 칸 표 ----
    for k in ("passability", "priority", "terrain", "tileMeta"): TS[k] = TS[k][:BASE]
    TS["animationStrips"] = [s for s in TS["animationStrips"] if s["baseTile"] < BASE]
    no = {d: False for d in ("up", "down", "left", "right")}
    yes = {d: True for d in ("up", "down", "left", "right")}
    empty = dict(label="", description="", source="bundled-default")
    for i in range(ROWS_ADDED * COLS):
        t = BASE + i
        if t not in cells:
            TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0); TS["tileMeta"].append(dict(empty)); continue
        _, key = cells[t]; _, seed, m = key.split(":"); m = int(m)
        sides = "".join(n for b, n in ((1, "북"), (2, "동"), (4, "남"), (8, "서")) if not (m & b))
        TS["passability"].append(dict(no)); TS["priority"].append("lower"); TS["terrain"].append(0)
        TS["tileMeta"].append(dict(
            label="버들항 던전 · 천장" + (f" 테두리({sides} 열림)" if sides else (" (허공)" if m == 255 else " 테두리(안쪽 모서리)")),
            description=f"던전 천장(검은 허공) 오토타일 47 모양(마스크 {m}, 결 {seed}). 바닥·벽 앞면과 닿는 쪽에 밝은 벽 두께 띠. 막힘. 그룹 `{GROUP_IDS[SEEDS.index(int(seed))] if int(seed) in SEEDS else GROUP_IDS[0]}`.",
            tags=["버들항", "던전", "천장", "wall", "ceiling", "dungeon"], defaultLayer="lower", passage="solid", source="bundled-default"))
    TS["count"] = COUNT

    # ---- 오토타일 그룹(47 → 256 마스크) ----
    ids_all = sorted(cells)
    groups = []
    for v, seed in enumerate(SEEDS):
        by_shape = {m: tid(v * 47 + i) for i, m in enumerate(C.SHAPES) if m in cleared}
        members = [by_shape[m] for m in C.SHAPES if m in by_shape]
        groups.append(dict(id=GROUP_IDS[v], name="버들항 던전 천장" + (" (결 2)" if v else ""), neighborhood=8, edgeConnects=True,
                           memberTileIds=members, connectTileIds=ids_all,
                           variantMap={str(m): by_shape[nearest(C.canonical(m), by_shape)] for m in range(256)}))
    TS["autotileGroups"] = [g for g in TS["autotileGroups"] if g["id"] not in GROUP_IDS] + groups
    TS["tileGroups"] = [g for g in TS["tileGroups"] if g["id"] != "beodeul:dungeon_ceiling"] + [dict(
        id="beodeul:dungeon_ceiling", name="버들항 던전 천장 테두리", role="wall", source="bundled-default", tileIds=ids_all, defaultLayer="lower", confidence="high",
        description="던전 천장(검은 허공) 오토타일. 천장 칸이 바닥·벽 앞면과 닿는 쪽에 밝은 벽 두께 띠가 생겨 방 둘레·벽 윗면·통로 양옆이 이어진다. 그룹 `beodeul_dungeon_ceiling`(결 2: `_b`).",
        placementRules="방·통로 바깥의 모든 빈 칸을 이 그룹으로 칠한다(이웃이 천장이면 연결). author_beodeul_dungeon 이 저절로 쓴다. 바닥 칸과 벽 앞면 칸은 연결로 보지 않는다.")]
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=COUNT, tilesPerRow=COLS)) + "\n")
    print(f"baked {len(cells)} cells in {BASE}..{COUNT - 1} (모양 {len(cleared)}개 × 결 {len(SEEDS)} + 허공 결), count {COUNT}")


if __name__ == "__main__":
    main()
    # 천장 꼬리 뒤(28,544~)의 마을 성벽 칸은 이 스크립트가 시트를 다시 쓰면 사라진다 — 같은 실행에서 다시 굽는다(멱등).
    if not any(a.startswith(("--gate-export", "--samples")) for a in sys.argv[1:]):
        subprocess.run([sys.executable, str(HERE.parent / "beodeul-wall" / "bake_wall.py")], check=True)
