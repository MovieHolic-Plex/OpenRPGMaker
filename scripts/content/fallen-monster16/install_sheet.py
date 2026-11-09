"""폴른 스타 16칸(4×4) 시트 하나를 monsterSheets16.ts 에 넣거나 바꾼다 (monster-motions-v2 레인, 2026-11-09).

그림은 ChatGPT 웹에 글만 넣은 컨셉 → 같은 컨셉을 참조로 16자세를 **한 장**에 그린 시트(털·무늬가 칸마다 같다) →
~/claude-viz/monster-motions-v2/slice_sheet.py 로 코드만 써서 96칸으로 줄인 것이다(팔레트는 그 몬스터 idle_a 에서, 바닥 y=92).
이 스크립트는 그림을 바꾸지 않는다. 칸 규칙만 다시 보고 무손실 팔레트 PNG 로 싸서 표에 쓴다.

  python3 scripts/content/fallen-monster16/install_sheet.py <resourceId> <이름> <sheet-4x4.png> [--missing 13] [--motion dash] [--idle-ms 180] [--note "..."]
"""
import argparse, base64, io, os, re

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
TS = os.path.join(ROOT, "src/project/flagship/fallen/monsterSheets16.ts")
CELL = 96
OPTIONAL = {9, 10, 11, 12, 13, 14}

ap = argparse.ArgumentParser()
ap.add_argument("rid")
ap.add_argument("name")
ap.add_argument("sheet")
ap.add_argument("--missing", default="")
ap.add_argument("--motion", default="dash")
ap.add_argument("--idle-ms", type=int, default=180)
ap.add_argument("--note", default="")
args = ap.parse_args()
missing = sorted(int(v) for v in args.missing.split(",") if v)
assert set(missing) <= OPTIONAL, missing


def palette_png(a):
    flat = a.reshape(-1, 4)
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    assert len(cols) <= 256, len(cols)
    img = Image.fromarray(inv.reshape(a.shape[:2]).astype(np.uint8), "P")
    img.putpalette(cols[:, :3].astype(np.uint8).flatten().tolist())
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True, transparency=bytes(cols[:, 3].astype(np.uint8).tolist()))
    back = np.array(Image.open(io.BytesIO(buf.getvalue())).convert("RGBA"))
    back[back[..., 3] == 0] = 0
    assert np.array_equal(back, a), "palette PNG does not round-trip"
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


sheet = np.array(Image.open(args.sheet).convert("RGBA"))
sheet[sheet[..., 3] == 0] = 0
assert sheet.shape[:2] == (CELL * 4, CELL * 4), sheet.shape
assert set(np.unique(sheet[..., 3])) <= {0, 255}
cell = lambda i: sheet[(i // 4) * CELL:(i // 4 + 1) * CELL, (i % 4) * CELL:(i % 4 + 1) * CELL, 3] > 0
for i in range(16):
    want = i not in missing and i != 15
    assert cell(i).any() == want, f"cell {i} {'empty' if want else 'must be empty'}"

fields = (f'resourceId: "{args.rid}", name: "{args.name}", cell: {CELL}, grid: "4x4", motion: "{args.motion}", '
          f'idleFrameMs: {args.idle_ms}, ' + (f"missingCells: {missing}, " if missing else "")
          + f'portrait: "{palette_png(sheet[:CELL, :CELL].copy())}", sheet: "{palette_png(sheet)}"')
note = f"  // {args.name} {args.rid.replace('generated-enemy-', '')} · {args.note or 'ChatGPT 웹 글만 컨셉 → 16자세 한 장 시트 → 코드 축소 (monster-motions-v2 2026-11-09, install_sheet.py)'}"
src = open(TS).read()
m = re.search(r'(  // [^\n]*\n)?  \{ resourceId: "' + re.escape(args.rid) + r'",[^\n]*\},?\n', src)
line = f"{note}\n  {{ {fields} }},\n"
if m:
    src = src[:m.start()] + line + src[m.end():]
else:
    end = src.index("\n];", src.index("FS_MONSTER_SHEETS_16"))
    src = src[:end + 1] + line + src[end + 1:]
open(TS, "w").write(src)
print("installed" if not m else "replaced", args.rid, "missing", missing)
