#!/usr/bin/env python3
"""목업 검사(3단계): 시각 판정자(Opus 5.5 medium)가 목업에서 칩셋 조각과 맞지 않는 물건을 적는다.
  python3 mockup_check.py <mockup.png> <pieces.png> <pieces.txt>  → stdout JSON {unmatched:[…], n, meta}"""
import json, os, sys
S = os.path.expanduser("~/z-project/assistant-whole-game/suite")
sys.path.insert(0, f"{S}/mapvqa"); import mapvqa
mock, sheet, ids = sys.argv[1:4]
names = open(ids).read().strip().splitlines()
PROMPT = f"""Image 1 is a pixel-art room mockup. Image 2 is the COMPLETE chipset sheet the room must be built from; each piece is labelled with its id.
Allowed piece ids: {", ".join(names)}.
List every distinct object, furniture, decoration, effect, floor or wall material visible in image 1 that has NO matching piece in image 2 (a recolour, a different shape, or an invented thing counts as unmatched; the same piece repeated is fine). Doors and doorways in walls are added by the builder — do not list them.
Answer JSON only: {{"unmatched":[{{"what":"short name","where":"rough place in the picture"}}],"matched_examples":["piece id", "..."]}}"""
r = mapvqa.ask(os.environ.get("MOCKUP_JUDGE", "teamclaude/claude-opus-5-5@medium"), PROMPT, [mock, sheet], f"mockcheck-{os.path.basename(os.path.dirname(os.path.abspath(mock)))}")
res = r.get("result") or {}
un = res.get("unmatched") or []
print(json.dumps({"n": len(un), "unmatched": un, "matched": res.get("matched_examples"), "meta": r.get("meta"), "error": r.get("error")}, ensure_ascii=False))
