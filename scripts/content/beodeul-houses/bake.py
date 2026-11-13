#!/usr/bin/env python3
"""버들항 «집 벌»(house set) 굽기 — 게임마다 집 그림 가족을 통째로 갈아 끼우는 그림판.

  python3 scripts/content/beodeul-houses/bake.py            # 굽는다(관문 통과분만)
  python3 scripts/content/beodeul-houses/bake.py --check    # 다시 구워 지금 파일과 같은지만 본다
  python3 scripts/content/beodeul-houses/bake.py --dev      # 관문 없이 굽는다 — 시범 그림용(커밋 금지: 표의 gate 가 DEV 라 시험이 막는다)

무엇을 굽나: tiledata/beodeul-houses/<벌>/pictures/<그림 열쇠>[.v1|.v2].png(조립 assemble.py 가 만든, 원본 킷과 같은 칸 크기의 건물 그림 — 킷마다 변형 세 장).
무엇을 쓰나: public/assets/beodeul-houses/chipset.png(128칸 폭) · src/assets/beodeulHouseSets.json — 벌마다 «원본 킷 id → 변형마다 → 칸마다 그림판 칸 번호».
  -1 = 원본도 빈 칸 · -2 = 원본 칸 그대로(문 앞 포석). 통행·위아래·이름표는 표에 없다 — 찍을 때 원본 킷의 같은 자리 칸에서 옮긴다(assets/houseSets.ts).
  버들항 시트·타일셋 정의·킷 목록은 한 글자도 바꾸지 않는다.

계약(어기면 멈춘다): 그림 크기 = 킷 크기 · 원본이 비운 칸에 화소 없음 · 지붕 수치는 조립 보고(report.json)의 ok.
3/4 관문(hard rule): 건물 그림마다 object-gate 출구 `require_all(context="bundle")`(kind structure). **3/4 관문 미통과 — 오너 면제 묶음**(spec.waiver)으로만 지난다.
"""
import argparse, json, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
STORE = ROOT / "tiledata/beodeul-houses"
OUT_PNG = ROOT / "public/assets/beodeul-houses/chipset.png"
OUT_JSON = ROOT / "src/assets/beodeulHouseSets.json"
T, COLS = 16, 128


def load():
    spec = json.loads((STORE / "spec.json").read_text(encoding="utf-8"))
    data = json.loads((STORE / "kits.json").read_text(encoding="utf-8"))
    kits = {k["id"]: k for k in data["kits"]}
    pics = {}
    for sid in spec["sets"]:
        doc = json.loads((STORE / sid / "report.json").read_text(encoding="utf-8"))
        report = {(p["key"], p.get("variant", 0)): p for p in doc["pictures"]}
        for group in data["pictures"]:
            key = group[0]; kit = kits[key]
            for v in range(doc.get("variants", 1)):
                im = Image.open(STORE / sid / "pictures" / (f"{key}.png" if not v else f"{key}.v{v}.png")).convert("RGBA")
                assert im.size == (kit["w"] * T, kit["h"] * T), (sid, key, v, im.size)
                bad = [r for r in report[(key, v)]["roofs"] if not r["ok"]]
                assert not bad, f"{sid}/{key}.v{v}: 직각 지붕 계약 위반 {bad}"
                pics[(sid, key, v)] = im
    return spec, data, kits, pics


def gate(spec, pics):
    from object_gate import require_all
    items = [(im, "structure", f"beodeul_houses/{sid}/{key}" + (f".v{v}" if v else "")) for (sid, key, v), im in pics.items()]
    got = require_all(items, context="bundle")
    print(f"관문(bundle 출구): {len(got)}/{len(items)} — 3/4 관문 미통과 — 오너 면제 묶음 {spec['waiver']}")


def compose(spec, data, kits, pics, dev):
    cells = [np.zeros((T, T, 4), np.uint8)]
    table = {"version": 2, "tilesetId": "beodeul_city", "image": "tex_beodeul_city", "texture": "tex_beodeul_houses", "tileSize": T, "tilesPerRow": COLS,
             "note": "생성 파일 — scripts/content/beodeul-houses/bake.py. sets[벌].kits[원본 킷 id] = 변형마다 줄마다 그림판 칸 번호(-1 빈 칸 · -2 원본 칸 그대로).",
             "gate": "DEV — not gated, do not commit" if dev else f"3/4 gate not passed — owner waiver {spec['waiver']}", "sets": {}}
    for sid, meta in spec["sets"].items():
        out = {}; empty_blocked = 0
        for group in data["pictures"]:
            key = group[0]; kit = kits[key]; variants = []
            for v in sorted(v for (s2, k2, v) in pics if s2 == sid and k2 == key):
                a = np.array(pics[(sid, key, v)]); rows = []
                for j, row in enumerate(kit["cells"]):
                    line = []
                    for i, cell in enumerate(row):
                        px = a[j * T:(j + 1) * T, i * T:(i + 1) * T]
                        if cell is None:
                            assert not (px[:, :, 3] > 0).any(), f"{sid}/{key}.v{v}: 원본이 비운 칸 ({i},{j}) 에 화소"
                            line.append(-1); continue
                        if "포석" in cell["label"]: line.append(-2); continue
                        if not (px[:, :, 3] > 0).any() and not cell["pass"]: empty_blocked += 1
                        # 그림 칸은 그림(킷 묶음 · 변형)마다 따로 둔다 — 화소가 같은 칸도 합치지 않는다: 그림판 칸 하나가 원본 킷의 한 자리만 가리켜야
                        # 벌 칸을 원본 칸으로 되짚을 수 있다(houseSetBaseTiles — 칸 번호로 집을 찾는 옛 도구가 벌 집도 알아본다).
                        line.append(len(cells)); cells.append(px.copy())
                    rows.append(line)
                variants.append(rows)
            for kid in group: out[kid] = variants
        table["sets"][sid] = {"label": meta["label"], "en": meta["en"], "kits": out}
        print(f"벌 {sid}: 킷 {len(out)} · 그림 {sum(1 for k in pics if k[0] == sid)}(킷 묶음 {len(data['pictures'])} × 변형) · 그림 없는 막힌 칸 {empty_blocked}")
    table["count"] = -(-len(cells) // COLS) * COLS
    return cells, table


def sheet_png(cells, count):
    im = np.zeros((count // COLS * T, COLS * T, 4), np.uint8)
    for n, c in enumerate(cells): im[(n // COLS) * T:(n // COLS + 1) * T, (n % COLS) * T:(n % COLS + 1) * T] = c
    return Image.fromarray(im, "RGBA")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true"); ap.add_argument("--dev", action="store_true")
    args = ap.parse_args()
    spec, data, kits, pics = load()
    if not args.dev: gate(spec, pics)
    cells, table = compose(spec, data, kits, pics, args.dev)
    im = sheet_png(cells, table["count"])
    text = json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n"
    print(f"그림판 {im.size[0]}×{im.size[1]} · 칸 {len(cells)}(표 {table['count']})")
    if args.check:
        same = OUT_JSON.exists() and OUT_JSON.read_text(encoding="utf-8") == text and OUT_PNG.exists() and np.array_equal(np.array(Image.open(OUT_PNG).convert("RGBA")), np.array(im))
        print("같다" if same else "다르다 — 다시 구워야 한다"); sys.exit(0 if same else 1)
    OUT_PNG.parent.mkdir(parents=True, exist_ok=True); im.save(OUT_PNG, optimize=True); OUT_JSON.write_text(text, encoding="utf-8")
    print(f"썼다: {OUT_PNG.relative_to(ROOT)} ({OUT_PNG.stat().st_size // 1024} KB) · {OUT_JSON.relative_to(ROOT)} ({len(text) // 1024} KB){' — DEV(관문 없음, 커밋 금지)' if args.dev else ''}")


if __name__ == "__main__":
    main()
