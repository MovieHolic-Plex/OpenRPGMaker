#!/usr/bin/env python3
"""깎아지른 지형(relief.style "sheer") 조각을 렌더러가 읽는 표 하나(src/project/relief/sheerArt.json)로 굽는다.

  uv run --with pillow --with numpy python3 scripts/content/sheer-terrain/bake.py --manifest  # 면제 입력(waive-manifest.json)만 다시 쓴다
  uv run --with pillow --with numpy python3 scripts/content/sheer-terrain/bake.py --dry       # 관문 상태만
  uv run --with pillow --with numpy python3 scripts/content/sheer-terrain/bake.py             # 굽는다(관문을 지나야)
  uv run --with pillow --with numpy python3 scripts/content/sheer-terrain/bake.py --check     # 다시 구워 지금 파일과 같은지만
  uv run --with pillow --with numpy python3 scripts/content/sheer-terrain/bake.py --dev       # 관문 없이 — 저장소 밖(/tmp)에만 쓴다(커밋하지 않는다)

그림 정본: tiledata/sheer-terrain/pieces/<id>.png — Claude Fable 5.2 그림(지형 시범 terrain-pilot/pieces, 규격 PIECES.md). 걷는 땅에 닿는 조각만이다:
앞면 판 · 옆면 · 윗면 테 · 낭떠러지 밑 · 사다리 · 덩굴 · 돌계단 · 굴 입 · 구름다리 · 폭포 · 엽 끝 조각. 원경(하늘 · 먼 산 · 구름바다 · 먼 숲)은 맵 배경(파노라마)이 맡아 굽지 않는다.
이 스크립트는 화소를 그대로 옮긴다(자르지도 칠하지도 않는다) — 렌더러(sheerPaint.ts)가 열마다 읽는다. 칩셋 시트 칸을 쓰지 않는다.

3/4 관문(hard rule): 조각마다 object-gate 출구 `require_all(context="bundle")` — 하나라도 막히면 아무것도 쓰지 않는다.
이 그림들은 **3/4 관문 미통과 — 오너 면제 묶음**(WAIVER)으로 출구를 지난다. 면제 기록은 감독이 `object-gate owner-waive` 로 적는다(이 스크립트는 쓰지 않는다). 면제는 통과가 아니다.
"""
import argparse, base64, hashlib, json, pathlib, sys
import numpy as np
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
STORE = ROOT / "tiledata/sheer-terrain"
MANIFEST = STORE / "waive-manifest.json"
OUT = ROOT / "src/project/relief/sheerArt.json"
DEV_OUT = pathlib.Path("/tmp/sheer-terrain-dev/sheerArt.json")
WAIVER = "fable-terrain-2026-11-16"
GATE_NOTE = "3/4 관문 미통과 — 오너 면제 그림."

# (id, 관문 종류, 표 자리)
PIECES = [
    ("face-48-a", "terrain", ("face48", 0)), ("face-48-b", "terrain", ("face48", 1)),
    ("face-96-a", "terrain", ("face96", 0)), ("face-96-b", "terrain", ("face96", 1)), ("face-96-c", "terrain", ("face96", 2)),
    ("side", "terrain", "side"), ("rim", "terrain", "rim"), ("drop", "terrain", "drop"),
    ("ladder", "other", "ladder"), ("vine", "organic", "vine"),
    ("stairs-1", "terrain", ("stairs", "1")), ("stairs-2", "terrain", ("stairs", "2")),
    ("cave-lower", "terrain", "caveLower"), ("cave-upper", "terrain", "caveUpper"),
    ("bridge", "terrain", "bridge"), ("falls", "terrain", "falls"),
    ("lobe", "terrain", "lobe"), ("lobe-96", "terrain", "lobe96"), ("corner", "terrain", "corner"),
]
SIZES = {"face-48-a": (64, 48), "face-48-b": (64, 48), "face-96-a": (64, 96), "face-96-b": (64, 96), "face-96-c": (64, 96), "side": (32, 96), "rim": (48, 16),
         "drop": (64, 48), "ladder": (32, 64), "vine": (16, 64), "stairs-1": (32, 80), "stairs-2": (32, 160), "cave-lower": (32, 48), "cave-upper": (32, 32),
         "bridge": (80, 48), "falls": (192, 64), "lobe": (64, 96), "lobe-96": (64, 128), "corner": (64, 96)}


def load(pid):
    im = Image.open(STORE / "pieces" / f"{pid}.png").convert("RGBA")
    if im.size != SIZES[pid]: sys.exit(f"{pid}: 크기 {im.size} — 규격 {SIZES[pid]}(PIECES.md)")
    return im


def patch(im):
    a = np.array(im, np.uint8)
    a[a[:, :, 3] == 0] = 0                       # 투명 화소의 색은 버린다(같은 그림 = 같은 바이트)
    return dict(w=im.width, h=im.height, b64=base64.b64encode(a.tobytes()).decode("ascii"))


def main():
    ap = argparse.ArgumentParser()
    for flag in ("--dry", "--check", "--dev", "--manifest"): ap.add_argument(flag, action="store_true")
    a = ap.parse_args()
    if a.manifest:
        MANIFEST.write_text(json.dumps(dict(items=[dict(png=f"tiledata/sheer-terrain/pieces/{pid}.png", kind=kind, label=f"sheer_terrain/{pid}", chipset="beodeul_city") for pid, kind, _ in PIECES]), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
        print(f"면제 입력 {len(PIECES)}장 → {MANIFEST.relative_to(ROOT)} (묶음 {WAIVER})"); return
    imgs = [(load(pid), kind, f"sheer_terrain/{pid}") for pid, kind, _ in PIECES]
    if a.dev:
        got = [hashlib.sha256(im.tobytes()).hexdigest() for im, _, _ in imgs]; gate = "DEV"
    else:
        from object_gate import require_all, ObjectGateRefused
        try: got = require_all(imgs, context="bundle")
        except ObjectGateRefused as e:
            print(f"관문(bundle 출구): 막힘 — 아무것도 쓰지 않는다. 묶음 {WAIVER}\n{e}"); sys.exit(2)
        gate = f"3/4 gate not passed — owner waiver {WAIVER}"
    print(f"관문(bundle 출구): {len(got)}/{len(imgs)} — {'DEV(관문 없음)' if a.dev else GATE_NOTE + ' 묶음 ' + WAIVER}")
    if a.dry: return

    ramps = json.loads((STORE / "ramps.json").read_text(encoding="utf-8"))["ramps"]
    rock = [[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in ramps["rock"]]
    table = dict(_doc="깎아지른 지형 조각 — scripts/content/sheer-terrain/bake.py 가 굽는다(손으로 고치지 않는다). 패치 = {w,h,b64(RGBA)}. 규격: assistant-fable-runs/terrain-pilot/PIECES.md.",
                 version=1, bundle=WAIVER, gate=gate, rock=rock, face48=[], face96=[], stairs={},
                 pieces=[dict(id=pid, kind=kind, sha256=d) for (pid, kind, _), d in zip(PIECES, got)])
    for (pid, _, slot), (im, _, _) in zip(PIECES, imgs):
        p = patch(im)
        if isinstance(slot, tuple):
            key, at = slot
            if isinstance(table[key], list): table[key].append(p)
            else: table[key][at] = p
        else: table[slot] = p
    text = json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n"
    if a.check:
        same = OUT.exists() and OUT.read_text(encoding="utf-8") == text
        print("다시 구운 것과 같다" if same else f"다르다: {OUT.relative_to(ROOT)}"); sys.exit(0 if same else 1)
    out = DEV_OUT if a.dev else OUT
    out.parent.mkdir(parents=True, exist_ok=True); out.write_text(text, encoding="utf-8")
    print(f"조각 {len(PIECES)}장 → {out} ({len(text) // 1024} KB)")


if __name__ == "__main__":
    main()
