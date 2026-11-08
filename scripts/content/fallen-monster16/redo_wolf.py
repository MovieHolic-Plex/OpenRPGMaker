"""서리늑대(generated-enemy-wolf-dire) 시트를 처음부터 다시 그린 4×4 로 통째로 바꾼다 (wolf-redo-scratch 레인, 2026-11-08).

오너: 「'약해짐' 이라는 슬롯을 아예 없애버리고, '늑대' 를 기존 이미지 참고하지 말고 아예 첨부터 다시만들어바라」.
그림은 ChatGPT 웹에 글만 넣어 컨셉 3장을 뽑고(참조 그림 없음) 고른 컨셉 B 를 참조로 대기·6포즈 GIF 를 받아
scripts/content/fallen-monster16/wolf_redo/reduce_wolf.py 로 결정적으로 줄였다(팔레트는 새 대기 그림에서, 바닥 y=92, 가로 중심 x=48).

  칸 0~8 + 11(cast_release = 스킬 방출)만 그렸다. 6(recover)은 move 칸 사본(4×4 는 skillCell 이 없어 recover 가 6번을 읽는다).
  9·10·12·13·14 는 비우고 missingCells 에 적는다 — pixelEnemyFrame 이 attack_mid 건너뛰기·cast_charge→windup·guard/weak/intro→idle_a 로 물린다.
  초상(portrait)은 새 idle_a 칸이다. 옛 늑대 화소는 하나도 남지 않는다(칸별 비교는 assemble_wolf.py).

  python3 scripts/content/fallen-monster16/redo_wolf.py <sheet-new-4x4.png>
"""
import base64, io, os, re, sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
TS = os.path.join(ROOT, "src/project/flagship/fallen/monsterSheets16.ts")
RID = "generated-enemy-wolf-dire"
CELL = 96
MISSING = [9, 10, 12, 13, 14]


def palette_png(a):
    flat = a.reshape(-1, 4)
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    img = Image.fromarray(inv.reshape(a.shape[:2]).astype(np.uint8), "P")
    img.putpalette(cols[:, :3].astype(np.uint8).flatten().tolist())
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True, transparency=bytes(cols[:, 3].astype(np.uint8).tolist()))
    back = np.array(Image.open(io.BytesIO(buf.getvalue())).convert("RGBA"))
    back[back[..., 3] == 0] = 0
    assert np.array_equal(back, a), "palette PNG does not round-trip"
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


sheet = np.array(Image.open(sys.argv[1]).convert("RGBA"))
sheet[sheet[..., 3] == 0] = 0
assert sheet.shape[:2] == (CELL * 4, CELL * 4), sheet.shape
assert set(np.unique(sheet[..., 3])) <= {0, 255}
for i in MISSING + [15]:
    assert not (sheet[(i // 4) * CELL:(i // 4 + 1) * CELL, (i % 4) * CELL:(i % 4 + 1) * CELL, 3] > 0).any(), f"cell {i} must be empty"
for i in [0, 1, 2, 3, 4, 5, 6, 7, 8, 11]:
    assert (sheet[(i // 4) * CELL:(i // 4 + 1) * CELL, (i % 4) * CELL:(i % 4 + 1) * CELL, 3] > 0).any(), f"cell {i} empty"
src = open(TS).read()
m = re.search(r'(  \{ resourceId: "' + RID + r'",[^\n]*?idleFrameMs: \d+, )(portrait: ")[^"]+(", sheet: ")[^"]+(" \},?)', src)
assert m, "wolf entry not found"
line = (m.group(1) + f"missingCells: {MISSING}, ".replace("[", "[").replace("]", "]")
        + m.group(2) + palette_png(sheet[:CELL, :CELL].copy()) + m.group(3) + palette_png(sheet) + m.group(4))
line = line.replace("missingCells: [9, 10, 12, 13, 14]", "missingCells: [9, 10, 12, 13, 14]")
src = src[:m.start()] + line + src[m.end():]
src = re.sub(r"(  // 서리늑대 wolf-dire ·)[^\n]*", r"\1 ChatGPT 웹 글만 컨셉→포즈 GIF 결정적 축소 (wolf-redo-scratch 2026-11-08, scripts/content/fallen-monster16/redo_wolf.py) · 칸 9·10·12·13·14 비움", src, count=1)
open(TS, "w").write(src)
print("patched", RID)
