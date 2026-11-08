"""폴른 스타 16칸 시트의 일부 동작 칸만 웹GPT 6포즈 칸으로 바꾼다(monster-poses-web 레인, 2026-11-08).

입력: --poses <dir>/<slug>/sheet-new.png (3×3, 같은 cell, 대기 팔레트로 고정·바닥선 맞춤 완료)
      --accept accept.json  {slug: {pose: "new" | "keep: 이유"}}
칸 번호는 pixelEnemySheets.ts 계약 그대로(0~8 은 3×3 과 같은 이름·순서, 4×4 는 4열 행 우선 배치).
4×4 시트는 skillCell 이 꺼져 있어 스킬 방출 자세는 cast_release(11) 칸이다. 나머지 칸은 건드리지 않는다.
결과는 monsterSheets16.ts 의 해당 항목 sheet 데이터 URL 만 바꾼다(초상·다른 항목은 그대로).

  python3 scripts/content/fallen-monster16/patch_poses.py --poses ~/claude-viz/monster-poses-web/out --accept accept.json
"""
import argparse, base64, io, json, os, re

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
TS = os.path.join(ROOT, "src/project/flagship/fallen/monsterSheets16.ts")
SRC3 = {"windup": 3, "move": 4, "attack": 5, "skill": 6, "hit": 7, "dead": 8}


DST4 = {"windup": 3, "move": 4, "attack": 5, "skill": 11, "hit": 7, "dead": 8}


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
    return buf.getvalue()


ap = argparse.ArgumentParser()
ap.add_argument("--poses", required=True)
ap.add_argument("--accept", required=True)
args = ap.parse_args()
accept = json.load(open(args.accept))
src = open(TS).read()
report = {}
for slug, verdict in accept.items():
    take = [p for p, v in verdict.items() if v == "new"]
    if not take:
        continue
    rid = f"generated-enemy-{slug}"
    m = re.search(r'(\{ resourceId: "' + re.escape(rid) + r'".*?sheet: ")(data:image/png;base64,)([A-Za-z0-9+/=]+)(")', src)
    if not m:
        report[slug] = "not in monsterSheets16.ts — skipped"
        continue
    meta = re.search(r'resourceId: "' + re.escape(rid) + r'".*?cell: (\d+), grid: "(\dx\d)"', src)
    cell, grid = int(meta.group(1)), meta.group(2)
    size = 4 if grid == "4x4" else 3
    if size == 3 and "skill" in take:
        take = [p for p in take if p != "skill"]
    sheet = np.array(Image.open(io.BytesIO(base64.b64decode(m.group(3)))).convert("RGBA"))
    sheet[sheet[..., 3] == 0] = 0
    new = np.array(Image.open(os.path.join(args.poses, slug, "sheet-new.png")).convert("RGBA"))
    new[new[..., 3] == 0] = 0
    assert new.shape[:2] == (cell * 3, cell * 3), f"{slug}: new sheet {new.shape} != {cell * 3}"
    assert np.array_equal(new[:cell, :cell], sheet[:cell, :cell]), f"{slug}: idle_a differs — poses were not reduced against this sheet"
    for pose in take:
        s, d = SRC3[pose], (DST4[pose] if size == 4 else SRC3[pose])
        c = new[(s // 3) * cell:(s // 3 + 1) * cell, (s % 3) * cell:(s % 3 + 1) * cell]
        assert (c[..., 3] > 0).any(), f"{slug} {pose} empty"
        sheet[(d // size) * cell:(d // size + 1) * cell, (d % size) * cell:(d % size + 1) * cell] = c
    if size == 4:
        assert not (sheet[3 * cell:, 3 * cell:, 3] > 0).any(), "cell 15 must stay transparent"
    data = base64.b64encode(palette_png(sheet)).decode()
    src = src[:m.start(3)] + data + src[m.end(3):]
    report[slug] = {"replaced": take, "kept": {p: v for p, v in verdict.items() if v != "new"}}
open(TS, "w").write(src)
print(json.dumps(report, ensure_ascii=False, indent=1))
