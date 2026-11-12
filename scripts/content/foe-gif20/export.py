"""현행 몬스터 세트에 더할 새 종(20칸 5×4 전투 시트)을 battle-gen 의 gif20 단계에서 가져와
src/assets/currentMonsterSheets20.ts 와 tiledata/foe-gif20/ 로 쓴다.

그림은 battle-gen 이 만든다(ChatGPT 웹 9포즈 GIF → 좌우 반전 → 16색 이하 → 5×4, docs/gif20.md). 이 스크립트는 그림을 바꾸지 않는다.
  - battle-gen catalog/gif20.json 의 행 중, 지금 화소에 대해 기계 관문(gates.check_motion20)과
    Opus 통과(review.current_pass — 숨긴 불량 표본을 모두 떨어뜨린 묶음, claude-opus-5-5 medium, 늑대급 4 이상)가 둘 다 있는 것만 싣는다.
  - 보정 행(calibration — 이미 『폴른 스타』에 같은 id 의 시트가 있는 종)은 alsoInFlagship 으로 표시한다. 설치 함수는 그 id 에
    『폴른 스타』의 시트를 그대로 쓴다(currentMonsterArt20.ts) — 이 파일의 것은 엄격한 관문을 통과한 판본으로 실려만 있다.
  - 근거(원본 GIF·첨부한 참고 그림·지시문·시트·관문 수치·판정)는 battle-gen `export20` 이 tiledata/foe-gif20/<slug>/ 에 쓴다.
  - PNG 는 무손실 팔레트 PNG 로 다시 싸고 다시 풀어 화소를 비교한다. 초상 = 시트 첫 칸(idle_a).
  - tiledata/foe-gif20/<slug>/battle-640x480.png 는 이 스크립트가 쓰지 않는다 — 그 시트를 출하 플레이어(player.html)의 실제 전투에 세워 찍은 화면이다
    (battle-gen integration/oprn/foe-gif20-battle.capture.mjs, 640×480 = 정확히 2배). 시트를 다시 내보내 화소가 바뀌면 다시 찍는다.
  - 『폴른 스타』 전용 파일(flagship/fallen/monsterSheets16.ts)은 건드리지 않는다.

  python3 scripts/content/foe-gif20/export.py [--battle-gen ~/z-project/battle-gen]
"""
import argparse, base64, io, json, os, sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
OUT = os.path.join(ROOT, "src/assets/currentMonsterSheets20.ts")
EVIDENCE = os.path.join(ROOT, "tiledata/foe-gif20")

ap = argparse.ArgumentParser()
ap.add_argument("--battle-gen", default=os.environ.get("BATTLE_GEN", "~/z-project/battle-gen"))
BG = os.path.abspath(os.path.expanduser(ap.parse_args().battle_gen))
os.environ["BATTLEGEN_ROOT"] = BG
sys.path.insert(0, BG)
from battlegen import export20, gates, gif20, review, stages, state  # noqa: E402
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


items = state.load()
ids = [r["id"] for r in gif20.rows()]
res = export20.run(EVIDENCE, ids, log=lambda *a: None)
manifest = json.load(open(os.path.join(EVIDENCE, "manifest.json")))
for k in [k for k in manifest if k not in res["exported"]]:      # 이번에 통과가 아닌 종은 근거 폴더에서도 뺀다
    manifest.pop(k)
json.dump(dict(sorted(manifest.items())), open(os.path.join(EVIDENCE, "manifest.json"), "w"), ensure_ascii=False, indent=1)
entries, bad = [], []
for r in gif20.rows():
    i = r["id"]
    if i not in manifest:
        continue
    it = items[state.key("motion20", i)]
    sheet = rgba(os.path.join(BG, it["art"]))
    C = r["cell"]
    g = gates.check_motion20(sheet, C, r["hover"])
    ok, why = review.current_pass("motion20", i)
    if not g.ok or not ok or pixel_sha(sheet) != manifest[i]["pixelSha"]:
        bad.append(f"{i}: {'; '.join(g.errors) or why}")
        continue
    url = lambda a: "data:image/png;base64," + base64.b64encode(palette_png(a)).decode()
    m = manifest[i]
    note = (f"{r['ko']} {i} · {r['world']} · ChatGPT 웹 9포즈 GIF → 반전 → {m['sheetColours']}색 → 20칸, 시도 {m['try']} · "
            f"Opus {'·'.join(m['judge']['model'])} {m['judge']['effort']} 늑대급 {m['judge']['wolfLevel']} ({m['judge']['batch']})")
    entries.append({"resourceId": m["resourceId"], "name": r["ko"], "world": r["world"], "cell": C, "motion": r["motion"],
                    "idleFrameMs": int(r["idleFrameMs"]), "note": note, "alsoInFlagship": bool(r.get("calibration")), "portrait": url(np.ascontiguousarray(sheet[:C, :C])), "sheet": url(sheet)})
if bad:
    sys.exit("refused:\n  " + "\n  ".join(bad))
js = lambda v: json.dumps(v, ensure_ascii=False)
with open(OUT, "w") as f:
    f.write("// 생성 파일 — python3 scripts/content/foe-gif20/export.py. 손으로 고치지 말 것.\n")
    f.write("// 현행 몬스터 세트에 더하는 새 종: battle-gen gif20 단계(ChatGPT 웹 GIF → 20칸 5×4 전투 시트)의 통과분과 한 칸 초상(idle_a).\n")
    f.write("// 모양은 flagship/fallen/monsterSheets16.ts 의 FallenMonsterSheet16 과 같다. 설치는 currentMonsterArt20.ts, 근거는 tiledata/foe-gif20/.\n")
    f.write('import type { UploadedPixelEnemySheetMeta } from "@/project/types";\n\n')
    f.write("export interface CurrentMonsterSheet20 {\n")
    f.write("  /** 번들 시트 id(generated-enemy-<slug>) — 기본 DB 적 기록의 monsterResourceId 그대로. */\n")
    f.write("  readonly resourceId: string;\n  readonly name: string;\n  /** 이 종을 바란 세계(그릴 목록의 묶음). 고르기에는 쓰지 않는다. */\n  readonly world: string;\n")
    f.write('  readonly cell: UploadedPixelEnemySheetMeta["cell"];\n  readonly grid: "5x4";\n')
    f.write('  readonly motion: UploadedPixelEnemySheetMeta["motion"];\n  readonly idleFrameMs: number;\n')
    f.write("  /** 같은 id 의 시트가 『폴른 스타』(flagship/fallen/monsterSheets16.ts)에도 있다 — 설치는 그쪽 것을 쓴다. */\n  readonly alsoInFlagship?: true;\n")
    f.write("  readonly portrait: string;\n  readonly sheet: string;\n}\n\n")
    f.write("export const CURRENT_MONSTER_SHEETS_20: readonly CurrentMonsterSheet20[] = [\n")
    for e in entries:
        f.write(f"  // {e['note']}\n")
        f.write(f"  {{ resourceId: {js(e['resourceId'])}, name: {js(e['name'])}, world: {js(e['world'])}, cell: {e['cell']}, grid: \"5x4\", motion: {js(e['motion'])}, "
                f"idleFrameMs: {e['idleFrameMs']}, {'alsoInFlagship: true, ' if e['alsoInFlagship'] else ''}portrait: {js(e['portrait'])}, sheet: {js(e['sheet'])} }},\n")
    f.write("];\n")
print(json.dumps({"out": os.path.relpath(OUT, ROOT), "sheets": [e["resourceId"] for e in entries], "bytes": os.path.getsize(OUT),
                  "evidence": os.path.relpath(EVIDENCE, ROOT), "skipped": res["skipped"]}, ensure_ascii=False, indent=1))
