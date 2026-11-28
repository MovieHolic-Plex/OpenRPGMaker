#!/usr/bin/env python3
"""easyrpg-charset-batch 로 제작·검증되어 사용자가 승인한 판타지 직업·마을 인물 칩을 FantasyPeople<N>.png 로 굽는다.

입력은 harness-data/charset-actor/fantasy-people-picks/<key>/{chip.chr.txt,meta.json} 이며, 이 스크립트는 다시 그리지 않는다:
격자를 구조 검사(chr.structural_errors) + 보행 검사(motion.analyze) 후 RGBA 시트 칸에 그대로 붙이고 화소 해시를 기록한다.

  python3 src/harnesses/charset-actor/install_fantasy_people.py          # 쓰기(시트 PNG + src/assets/fantasyPeopleCharsets.json)
  python3 src/harnesses/charset-actor/install_fantasy_people.py --check  # 현재 번들이 입력과 화소·명단 동일한지 확인(0 이면 일치)

칸 번호는 덧붙이기 전용이다: 이미 설치된 id 의 칸·화소가 바뀌면 --force 없이는 거절한다.
베이스 칩은 EasyRPG RTP(CC BY 4.0)다 — public/assets/ATTRIBUTION.md 「FantasyPeople」 절을 함께 유지한다.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import chr as C     # noqa: E402
import motion as M  # noqa: E402
from PIL import Image  # noqa: E402

SPEC = ROOT / "harness-data/charset-actor/fantasy-people-install.json"
PICKS = ROOT / "harness-data/charset-actor/fantasy-people-picks"
SHEET_DIR = ROOT / "public/assets/generated/charsets"
ROSTER = ROOT / "src/assets/fantasyPeopleCharsets.json"
SLOT_W, SLOT_H, COLS, ROWS = 72, 128, 4, 2


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def render(key: str):
    grid = PICKS / key / "chip.chr.txt"
    pal, _, frames = C.load(grid)
    errors = C.structural_errors(pal, frames)
    if errors:
        raise SystemExit(f"{key}: 구조 오류 {errors}")
    mrep = M.analyze(pal, frames)
    if not mrep["ok"]:
        raise SystemExit(f"{key}: 보행 오류 {mrep['fails']}")
    image = C.sheet_rgba(pal, frames)
    if image.size != (SLOT_W, SLOT_H) or image.mode != "RGBA":
        raise SystemExit(f"{key}: 칩 규격 {image.size} {image.mode}")
    alpha = set(image.getchannel("A").tobytes())
    if not alpha <= {0, 255}:
        raise SystemExit(f"{key}: 반투명 화소 {sorted(alpha)}")
    meta = json.loads((PICKS / key / "meta.json").read_text(encoding="utf-8"))
    if not meta.get("ok"):
        raise SystemExit(f"{key}: meta.ok 가 아니다")
    return image, grid.read_bytes(), meta


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    chars = spec["characters"]
    old = json.loads(ROSTER.read_text(encoding="utf-8")) if ROSTER.exists() else {"characters": []}
    old_by_id = {c["id"]: c for c in old["characters"]}

    max_sheet = max((int(c["sheet"]) for c in chars), default=1)
    sheets = {n: Image.new("RGBA", (COLS * SLOT_W, ROWS * SLOT_H), (0, 0, 0, 0)) for n in range(1, max_sheet + 1)}
    used_slots = set()
    roster = []

    for row in chars:
        s_no = int(row["sheet"])
        idx = int(row["index"])
        if not (1 <= s_no <= max_sheet and 0 <= idx < COLS * ROWS):
            raise SystemExit(f"{row['id']}: 잘못된 시트/칸 ({s_no}, {idx})")
        if (s_no, idx) in used_slots:
            raise SystemExit(f"{row['id']}: 중복 칸 ({s_no}, {idx})")
        used_slots.add((s_no, idx))

        image, grid_bytes, meta = render(row["key"])
        sheets[s_no].paste(image, ((idx % COLS) * SLOT_W, (idx // COLS) * SLOT_H))
        entry = {
            "id": row["id"],
            "name": row["name"],
            "desc": row["desc"],
            "genre": row["genre"],
            "role": row["role"],
            "gender": row.get("gender"),
            "age": row.get("age"),
            "tags": row["tags"],
            "sheet": s_no,
            "index": idx,
            "source": {
                "harnessKey": row["key"],
                "model": meta["model"],
                "baseChip": meta["base"],
                "gridSha256": sha(grid_bytes),
                "slotRgbaSha256": sha(image.tobytes()),
            },
        }
        prev = old_by_id.get(row["id"])
        if prev and not args.force and (prev["sheet"], prev["index"]) != (entry["sheet"], entry["index"]):
            raise SystemExit(f"{row['id']}: 설치된 칸 번호가 바뀐다 ({prev['sheet']},{prev['index']}) -> ({entry['sheet']},{entry['index']})")
        if prev and not args.force and prev["source"]["slotRgbaSha256"] != entry["source"]["slotRgbaSha256"]:
            raise SystemExit(f"{row['id']}: 설치된 그림의 화소가 바뀐다(--force 로만 덮는다)")
        roster.append(entry)

    missing = [c["id"] for c in old["characters"] if c["id"] not in {r["id"] for r in roster}]
    if missing and not args.force:
        raise SystemExit(f"명단에서 빠진 설치 id: {missing}. 기존 칸 번호·id 는 불변(덧붙이기)이다.")

    document = {
        "version": 1,
        "sheets": max_sheet,
        "sheetName": spec["sheet"]["name"],
        "selection": spec["selection"],
        "characters": roster,
    }
    text = json.dumps(document, ensure_ascii=False, indent=1) + "\n"

    if args.check:
        same_pngs = all(
            (SHEET_DIR / f"FantasyPeople{n}.png").exists()
            and Image.open(SHEET_DIR / f"FantasyPeople{n}.png").convert("RGBA").tobytes() == sheets[n].tobytes()
            for n in range(1, max_sheet + 1)
        )
        same_json = ROSTER.exists() and ROSTER.read_text(encoding="utf-8") == text
        print(json.dumps({"sheetPixelsIdentical": same_pngs, "rosterIdentical": same_json}))
        sys.exit(0 if same_pngs and same_json else 1)

    SHEET_DIR.mkdir(parents=True, exist_ok=True)
    for n, im in sheets.items():
        out_png = SHEET_DIR / f"FantasyPeople{n}.png"
        im.save(out_png, "PNG")
        print(out_png.relative_to(ROOT), sha(out_png.read_bytes())[:12])
    ROSTER.write_text(text, encoding="utf-8")
    for e in roster:
        print(e["id"], f"FantasyPeople{e['sheet']}#{e['index']}", e["source"]["slotRgbaSha256"][:8], e["name"])
    print(ROSTER.relative_to(ROOT))


if __name__ == "__main__":
    main()
