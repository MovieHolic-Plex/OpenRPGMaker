"""폴른 스타 몬스터 새 그림(16칸 4×4 전투 시트)을 battle-gen 에서 가져와 src/project/flagship/fallen/monsterSheets16.ts 로 쓴다.

그림은 battle-gen 이 만든다(새 초상 → 3x3 → 4x4, 기계 게이트, Opus 검수 통과 = review.PASS_SCORE 이상). 이 스크립트는 그림을 바꾸지 않는다.
  - battle-gen catalog 의 pack "fallen-star" 행 중 4x4 동작 시트에 지금 Opus 통과(review.current_pass)가 있고
    초상이 통과했거나 오너가 고른(stages.owner_picked) 종만 싣는다. 나머지는 번들 3×3 그대로 남는다.
  - "replaces": <id> 가 있는 행(큰 칸으로 다시 그린 새 항목)이 실을 수 있으면 그 <id> 대신 싣는다. 못 실으면 <id> 가 그대로 남는다.
  - PNG 는 무손실 팔레트 PNG 로 다시 싸고(다시 풀어 화소 비교), 칸 규칙을 한 번 더 본다:
    시트 = 4cell 정사각, idle_a = 초상 그대로, 0~14 칸은 채움, 15 칸은 완전 투명, 알파 0/255.

  python3 scripts/content/fallen-monster16/export.py [--battle-gen ~/z-project/battle-gen]
"""
import argparse, base64, io, json, os, sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT = os.path.join(ROOT, "src/project/flagship/fallen/monsterSheets16.ts")

ap = argparse.ArgumentParser()
ap.add_argument("--battle-gen", default=os.environ.get("BATTLE_GEN", "~/z-project/battle-gen"))
BG = os.path.abspath(os.path.expanduser(ap.parse_args().battle_gen))
os.environ["BATTLEGEN_ROOT"] = BG
sys.path.insert(0, BG)
from battlegen import catalog, gates, review, stages, state  # noqa: E402
from battlegen.imageutil import pixel_sha  # noqa: E402


def rgba(path):
    a = np.array(Image.open(path).convert("RGBA"))
    a[a[..., 3] == 0] = 0
    return a


def palette_png(a):
    flat = a.reshape(-1, 4)
    cols, inv = np.unique(flat, axis=0, return_inverse=True)
    if len(cols) > 256:
        raise ValueError(f"{len(cols)} colours")
    img = Image.fromarray(inv.reshape(a.shape[:2]).astype(np.uint8), "P")
    img.putpalette(cols[:, :3].astype(np.uint8).flatten().tolist())
    alpha = bytes(cols[:, 3].astype(np.uint8).tolist())
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True, transparency=alpha)
    data = buf.getvalue()
    back = np.array(Image.open(io.BytesIO(data)).convert("RGBA"))
    back[back[..., 3] == 0] = 0
    if not np.array_equal(back, a):
        raise ValueError("palette PNG does not round-trip")
    return data


def sheet_problems(sheet, portrait, grid=4):
    C = portrait.shape[0]
    if portrait.shape[:2] != (C, C) or C not in gates.ENEMY_CELLS:
        return [f"portrait {portrait.shape[1]}x{portrait.shape[0]} is not a square of {'/'.join(map(str, gates.ENEMY_CELLS))}"]
    if sheet.shape[:2] != (grid * C, grid * C):
        return [f"sheet {sheet.shape[1]}x{sheet.shape[0]} is not {grid * C}x{grid * C}"]
    out = []
    if not set(np.unique(sheet[..., 3]).tolist()) <= {0, 255}:
        out.append("alpha must be 0 or 255")
    for k in range(grid * grid):
        cell = sheet[(k // grid) * C:(k // grid + 1) * C, (k % grid) * C:(k % grid + 1) * C]
        filled = bool((cell[..., 3] > 0).any())
        if grid == 4 and k == 15 and filled:
            out.append("cell 15 must be transparent")
        if k < grid * grid - (grid == 4) and not filled:
            out.append(f"cell {k} is empty")
        if k == 0 and not np.array_equal(cell, portrait):
            out.append("idle_a differs from the portrait")
    return out


items = state.load()


def archived_3x3(i):
    """A redraw row (replaces) whose 4x4 failed its one redo ships its passing 3x3 instead (lead, 2026-11-04: not the old art)."""
    archive = os.path.join(BG, "art", "motion", "3x3", f"{i}.png")
    mit = items.get(state.key("motion", i)) or {}
    if mit.get("status") != "out" or not os.path.exists(archive):
        return None
    return archive if review.current_pass("motion", i, pixels=rgba(archive))[0] else None


def usable(i):
    """(ok, why, sheet path): 4x4 sheet passes now (or a redraw's 3x3 after a failed 4x4 redo), and the portrait passes or is an owner pick."""
    pit, mit = items.get(state.key("portrait", i)), items.get(state.key("motion", i))
    if not pit or not pit.get("art") or not mit or not mit.get("art"):
        return False, "no portrait or motion sheet", None
    if mit.get("grid") != "4x4":
        return False, "no 4x4 motion sheet yet", None
    portrait_ok, portrait_why = review.current_pass("portrait", i)
    picked = stages.owner_picked(pit)
    motion_ok, motion_why = review.current_pass("motion", i)
    sheet = os.path.join(BG, mit["art"])
    if not motion_ok and catalog.enemy(i).get("replaces") and (fallback := archived_3x3(i)):
        motion_ok, sheet = True, fallback
    if not motion_ok or (not portrait_ok and not picked):
        return False, f"portrait {portrait_why if not picked else 'owner pick'} / motion {motion_why}", None
    return True, "", sheet


rows = [r for r in catalog.enemies() if r.get("pack") == "fallen-star"]
replaced = {r["replaces"]: r["id"] for r in rows if r.get("replaces") and usable(r["id"])[0]}
entries, skipped, bad = [], [], []
for row in rows:
    i = row["id"]
    if i in replaced:
        skipped.append(f"{i}: replaced by {replaced[i]}")
        continue
    ok, why, sheet_path = usable(i)
    if not ok:
        skipped.append(f"{i}: {why}" + (f" (keeps {row['replaces']})" if row.get("replaces") else ""))
        continue
    pit = items[state.key("portrait", i)]
    portrait_ok = review.current_pass("portrait", i)[0]
    portrait, sheet = rgba(os.path.join(BG, pit["art"])), rgba(sheet_path)
    grid = 4 if sheet.shape[0] == 4 * portrait.shape[0] else 3
    probs = sheet_problems(sheet, portrait, grid)
    if probs:
        bad.append(f"{i}: {'; '.join(probs)}")
        continue
    verdicts = review.item_verdicts
    pv = [v for v in verdicts("portrait", i) if v.get("pixelSha") == pixel_sha(portrait) and v.get("standard") == review.STANDARD]
    mv = [v for v in verdicts("motion", i) if v.get("pixelSha") == pixel_sha(sheet) and v.get("standard") == review.STANDARD]
    note = f"초상 Opus {pv[-1].get('score')} ({pv[-1]['batch']})"
    if not portrait_ok:
        note += f" · 오너 선택(「{pit['ownerPick']['quote']}」)"
    note += f" · {grid * grid - (grid == 4)}칸 Opus {mv[-1].get('score')} ({mv[-1]['batch']})"
    url = lambda a: "data:image/png;base64," + base64.b64encode(palette_png(a)).decode()
    entries.append({"resourceId": row["fallenStarResourceId"], "name": row["ko"], "cell": int(portrait.shape[0]), "grid": f"{grid}x{grid}",
                    "motion": row["motion"], "idleFrameMs": int(row["idleFrameMs"]), "note": f"{row['ko']} {i[3:]} · {note}",
                    "portrait": url(portrait), "sheet": url(sheet)})

if bad:
    sys.exit("refused (sheet rules):\n  " + "\n  ".join(bad))
js = lambda v: json.dumps(v, ensure_ascii=False)
with open(OUT, "w") as f:
    f.write("// 생성 파일 — python3 scripts/content/fallen-monster16/export.py. 손으로 고치지 말 것.\n")
    f.write("// 『폴른 스타』 몬스터 새 그림: battle-gen 전투 시트(16칸 4×4, 16칸이 두 번 떨어진 새 항목은 통과한 3×3)와 한 칸 초상(idle_a). 설치는 monsterArt16.ts.\n")
    f.write('import type { UploadedPixelEnemySheetMeta } from "@/project/types";\n\n')
    f.write("export interface FallenMonsterSheet16 {\n")
    f.write("  /** 번들 시트 id(generated-enemy-<slug>) — 적 기록의 monsterResourceId 그대로. */\n")
    f.write("  readonly resourceId: string;\n  readonly name: string;\n  readonly cell: UploadedPixelEnemySheetMeta[\"cell\"];\n")
    f.write('  readonly grid: "3x3" | "4x4";\n')
    f.write('  readonly motion: UploadedPixelEnemySheetMeta["motion"];\n  readonly idleFrameMs: number;\n')
    f.write("  /** 4×4 시트에서 그리지 않고 비워 둔 확장 칸(9~14). pixelEnemyFrame 이 대체 칸으로 물린다. */\n  readonly missingCells?: readonly number[];\n")
    f.write("  readonly portrait: string;\n  readonly sheet: string;\n}\n\n")
    f.write("export const FS_MONSTER_SHEETS_16: readonly FallenMonsterSheet16[] = [\n")
    for e in entries:
        f.write(f"  // {e['note']}\n")
        f.write(f"  {{ resourceId: {js(e['resourceId'])}, name: {js(e['name'])}, cell: {e['cell']}, grid: {js(e['grid'])}, motion: {js(e['motion'])}, "
                f"idleFrameMs: {e['idleFrameMs']}, portrait: {js(e['portrait'])}, sheet: {js(e['sheet'])} }},\n")
    f.write("];\n")
print(json.dumps({"out": os.path.relpath(OUT, ROOT), "sheets": len(entries), "bytes": os.path.getsize(OUT), "skipped": skipped}, ensure_ascii=False, indent=1))
