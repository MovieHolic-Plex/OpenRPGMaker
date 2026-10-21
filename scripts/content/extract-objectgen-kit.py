#!/usr/bin/env python3
"""object-gen 원문 상수·견본 묶음을 공방이 읽는 사본으로 뽑는다(손으로 고치지 않는다).

    python3 scripts/content/extract-objectgen-kit.py <object-gen 체크아웃> [--set oprn-interior-v5-large]

- src/harnesses/_core/workshop/objectGenKit.json : objectgen/*.py 의 모듈 수준 리터럴(문자열·수·dict·list)과 set.json
- public/assets/gen-kits/object-gen/anchors/<set>/ : 견본·반려 PNG

유료 경로 상수(PAID_*)는 옮기지 않는다. 공용 gen-kits 동기화(`npm run gen-kits:sync`)가 들어오면 그 모듈로 바꾸고 이 스크립트는 지운다.
"""
from __future__ import annotations

import ast
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODULES = {
    "prompts": ["DIRECTIONS", "ANCHOR_TEXT", "VIEW", "RECIPE", "LARGE", "LARGE_CELLS", "ANSWER", "JUDGE"],
    "reference": ["VIEW", "NEGATIVE", "STYLE_NOTE", "VIEW_LOW", "NEGATIVE_LOW", "STYLE_NOTE_LOW", "TOP_WORDS", "IP_TERMS",
                  "REFCOPY_LIMIT", "VIEW_PROMPT", "VIEW_PROMPT_LOW"],
    "picker": ["PICKER", "PROMPT", "RUNS"],
    "vqa": ["PER_BOARD", "SCALE"],
    "drawer": ["WORKFLOW"],
    "exemplars": ["MARGIN_MAX", "SLACK", "FILL_SLACK"],
}


def literals(path: Path, names: list[str]) -> dict:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) and node.targets[0].id in names:
            try:
                out[node.targets[0].id] = ast.literal_eval(node.value)
            except ValueError:
                # RUNS = int(os.environ.get(..., "3")) 같은 꼴: 기본값 글자를 쓴다
                consts = [c.value for c in ast.walk(node.value) if isinstance(c, ast.Constant) and isinstance(c.value, str) and c.value.isdigit()]
                if consts:
                    out[node.targets[0].id] = int(consts[-1])
    missing = [n for n in names if n not in out]
    if missing:
        raise SystemExit(f"{path.name}: 상수 {missing} 를 찾지 못했다 - 원본이 바뀌었다")
    return out


def main() -> None:
    src = Path(sys.argv[1]).resolve()
    style = sys.argv[sys.argv.index("--set") + 1] if "--set" in sys.argv else "oprn-interior-v5-large"
    pkg = src / "objectgen"
    commit = subprocess.run(["git", "-C", str(src), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
    kit = {
        "kit": "object-gen", "repo": "MovieHolic-Plex/object-gen", "commit": commit,
        "note": "object-gen 원문 상수(objectgen/*.py 모듈 수준 리터럴)와 기준 그림 묶음 set.json. 손으로 고치지 않는다 - "
                "scripts/content/extract-objectgen-kit.py 로 다시 뽑는다(gen-kits:sync 가 들어오면 그 모듈로 바꾼다).",
        "constants": {mod: literals(pkg / f"{mod}.py", names) for mod, names in MODULES.items()},
        "anchors": {},
    }
    anchors = pkg / "anchors" / style
    kit["anchors"][style] = json.loads((anchors / "set.json").read_text(encoding="utf-8"))
    (ROOT / "src/harnesses/_core/workshop/objectGenKit.json").write_text(json.dumps(kit, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    dest = ROOT / "public/assets/gen-kits/object-gen/anchors" / style
    dest.mkdir(parents=True, exist_ok=True)
    for png in sorted(anchors.glob("*.png")):
        shutil.copy(png, dest / png.name)
    print(f"object-gen {commit[:7]} -> objectGenKit.json, {len(list(anchors.glob('*.png')))} PNG -> {dest.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
