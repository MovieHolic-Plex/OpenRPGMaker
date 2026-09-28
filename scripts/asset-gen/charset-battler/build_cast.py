# 마법 시전 원본(tiledata/charset-battlers/<id>/cast_*.png) → 시전 시트(public/assets/generated/charset-battlers/cast/<id>.png)
# + 확인판(tiledata/charset-battlers/<id>/_cast_board.png). 사용: python3 build_cast.py [actor1-0 ...]
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from cb_lib import ALL_IDS, CAST_DIR, SRC_DIR, build_cast_sheet, cast_board


def main():
    ids = [a for a in sys.argv[1:] if not a.startswith("--")] or ALL_IDS
    os.makedirs(CAST_DIR, exist_ok=True)
    failed = 0
    for cid in ids:
        sheet, report = build_cast_sheet(cid)
        sheet.save(os.path.join(CAST_DIR, f"{cid}.png"), optimize=True)
        cast_board(cid, sheet).save(os.path.join(SRC_DIR, cid, "_cast_board.png"))
        bad = {k: v for k, v in report.items() if v}
        failed += 1 if bad else 0
        print(f"{cid}: {'통과' if not bad else '문제 ' + json.dumps(bad, ensure_ascii=False)}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()

