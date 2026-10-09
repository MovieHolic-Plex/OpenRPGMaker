# 포즈 원본(tiledata/charset-battlers/<id>/*.png) → 전투 시트(public/assets/generated/charset-battlers/<id>.png)
# + 확인판(tiledata/charset-battlers/<id>/_board.png) + 검사 보고. 사용: python3 build.py [actor1-0 ...] [--manifest]
# manifest.json 은 --manifest 일 때만 쓴다(병렬 작업자가 같은 파일을 덮지 않게 — 통합 때 한 번 쓴다).
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from cb_lib import ALL_IDS, OUT_DIR, POSES, SRC_DIR, board, build_sheet


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith("--")] or [d for d in ALL_IDS if os.path.isdir(os.path.join(SRC_DIR, d))]
    os.makedirs(OUT_DIR, exist_ok=True)
    failed = 0
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for cid in ids:
        sheet, report = build_sheet(cid)
        sheet.save(os.path.join(OUT_DIR, f"{cid}.png"), optimize=True)
        board(cid, sheet).save(os.path.join(SRC_DIR, cid, "_board.png"))
        bad = {k: v for k, v in report.items() if v}
        failed += 1 if bad else 0
        manifest[cid] = {"poses": [p[0] for p in POSES], "issues": bad}
        print(f"{cid}: {'통과' if not bad else '문제 ' + json.dumps(bad, ensure_ascii=False)}")
    if "--manifest" in sys.argv:
        manifest = dict(sorted(manifest.items()))
        json.dump(manifest, open(manifest_path, "w"), ensure_ascii=False, indent=1)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

