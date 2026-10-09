#!/usr/bin/env python3
"""장소 팩에 「완성 배치도」를 합친다. build/place-packs/<slug>/layouts-out/<name>.{kit.json,png,steps.json}
(scripts/qa/pack-layout-replay.mts --kit-out 이 만든다)를 tileset.json 에 넣는다: 키트 + 참고문서 절(그림·단계표) + 그림.
   python3 scripts/content/beodeul-picks/merge_pack_layouts.py <slug>...      (build_pack_layouts.sh 가 부른다)"""
import json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OPDESC = {"fill": "바닥 채우기", "rect": "바닥 사각", "line": "길(줄)", "blob": "오토타일 덩이", "stamp": "키트 찍기"}

def step_row(i, s):
    op = s["op"]
    if op in ("fill", "rect"): what = f"`{s.get('ground') or s.get('tile')}`" + (f" ({s['x']},{s['y']}) {s['w']}×{s['h']}" if op == "rect" else " 맵 전체")
    elif op == "line": what = f"`{s.get('ground')}` {s['from']}→{s['to']} 폭 {s.get('width', 1)}"
    elif op == "blob": what = f"붓 `{s['brush']}` 중심({s['cx']},{s['cy']}) 반경 {s['rx']}×{s['ry']}"
    else: what = f"`{s['kit']}` 왼쪽 위 ({s['x']},{s['y']})"
    return f"| {i} | {OPDESC.get(op, op)} | {what} |"

def main(slugs):
    for slug in slugs:
        d = ROOT / "build/place-packs" / slug
        out = d / "layouts-out"
        kits = sorted(out.glob("*.kit.json")) if out.exists() else []
        if not kits:
            continue
        ts = json.loads((d / "tileset.json").read_text())
        doc = ts["referenceDocuments"][0]
        have = {k["id"] for k in ts["structureKits"]}
        parts = []
        for kf in kits:
            name = kf.name[: -len(".kit.json")]
            kit = json.loads(kf.read_text())
            steps = json.loads((out / f"{name}.steps.json").read_text())
            if kit["id"] not in have:
                ts["structureKits"].insert(0, kit)
            shutil.copy(out / f"{name}.png", d / "images" / f"layout-{name}.png")
            doc["images"] = [im for im in doc["images"] if im["id"] != f"bd-layout-img-{name}"]
            doc["images"].insert(0, dict(id=f"bd-layout-img-{name}", name=f"layout-{name}.png", caption=f"완성 배치도 「{steps['title']}」 — 이 팩 칸으로 조수 도구를 실제로 돌려 만든 맵(엔진 출력).", dataUrl=f"/images/layout-{name}.png"))
            W, H = steps["size"]
            rows = "\n".join(step_row(i + 1, s) for i, s in enumerate(steps["steps"]))
            parts.append(
                f"## 완성 배치도 「{steps['title']}」 — 먼저 이것부터 (키트 `{kit['id']}`)\n\n{steps['description']}\n\n"
                f"**가장 쉬운 길:** 맵을 {W}×{H} 이상으로 만들고 `stamp_object` 로 키트 `{kit['id']}` 를 (0,0)에 **한 번** 찍는다. 아래 그림이 통째로 깔린다(바닥·물·길·건물·소품). 그 뒤 바꾸고 싶은 곳만 고친다.\n"
                f"처음부터 낱 키트로 짜지 않는다 — 이 배치도의 비율·동선·바탕 채우기 순서를 따라 하라.\n\n"
                f"그림: 이미지 `layout-{name}.png`(참고문서 그림).\n\n"
                f"이 배치도를 만든 단계(좌표는 맵 칸, 같은 순서로 하면 같은 장면):\n\n| # | 단계 | 내용 |\n|---|---|---|\n{rows}\n")
        for dd in doc["documents"]:
            if dd["id"].endswith("-guide"):
                dd["markdown"] = dd["markdown"].replace("# ", "# ", 1)
                head, _, rest = dd["markdown"].partition("\n\n")
                dd["markdown"] = head + "\n\n" + "\n".join(parts) + "\n" + rest
        (d / "tileset.json").write_text(json.dumps(ts, ensure_ascii=False, separators=(",", ":")))
        meta = json.loads((d / "meta.json").read_text()); meta["layouts"] = [k.name[: -len(".kit.json")] for k in kits]
        meta["images"] = sorted(set(meta["images"]) | {f"layout-{n}.png" for n in meta["layouts"]})
        (d / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        print(f"{slug}: 배치도 {len(kits)}개 합침")

if __name__ == "__main__":
    main(sys.argv[1:])
