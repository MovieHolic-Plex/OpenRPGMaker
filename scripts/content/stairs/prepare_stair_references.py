#!/usr/bin/env python3
"""계단 입구 참고문서(2026-10-22) — 번들이 소유하는 「계단 입구」 용도를 칩셋마다 만든다.

  1) build-stair-contracts.mts --dump 로 계약+키트 칸을 받는다(정본은 src/assets/stairContracts.json).
  2) 키트마다 4배 확대 그림(이동 칸 초록·앞 칸 노랑 화살표·막힌 칸 빨강 X·위 끝 파랑)과
     정상/오류 나란한 그림을 public/assets/stair-references/<칩셋>/ 에 굽는다(긴 변 ≤ 820, 128색).
  3) src/assets/sharedStairReferences.json = { tilesetId: 용도 } — 그림은 /assets/... 경로만(dataURL 금지).
     ensureStairEntranceReferences(src/project/defaults/stairReferences.ts)가 새·기존 프로젝트에 빠진 용도만 덧붙인다.

실행(체크아웃 루트): python3 scripts/content/stairs/prepare_stair_references.py
"""
import json, os, subprocess, sys, tempfile
from PIL import Image, ImageDraw

ROOT = os.getcwd()
OUT_DIR = os.path.join(ROOT, "public/assets/stair-references")
OUT_JSON = os.path.join(ROOT, "src/assets/sharedStairReferences.json")
TEX = {
    "atlas_biome_interior": "atlas-interior/interior-chipset.png", "beodeul_city": "beodeul-city/beodeul-city-chipset.png",
    "gothic_manor": "gothic-manor/gothic-manor-chipset.png", "joseon_baram": "joseon-baram/joseon-baram-chipset.png",
    "jp_city": "jp-city/jp-city-chipset.png", "modern_campus": "modern-campus/modern-campus-chipset.png",
    "modern_city": "modern-city/modern-city-chipset.png", "pirate_isles": "pirate-isles/pirate-isles-chipset.png",
    "sky_island": "sky-island/sky-island-chipset.png", "steampunk_city": "steampunk-city/steampunk-city-chipset.png",
    "wizarding_world": "wizarding-world/wizarding-world-chipset.png",
}
for r in ("dungeon", "overworld", "rooms", "wild", "gyms", "coast", "climate"):
    TEX[f"monster_{r}"] = f"monster-kit/monster-{r}.png"
    TEX[f"emerald_monster_{r}"] = f"emerald-monster/tiles/{r}.png"

SCALE = 4
_sheets = {}
def tile(ts, t):
    if ts not in _sheets: _sheets[ts] = Image.open(os.path.join(ROOT, "public/assets", TEX[ts])).convert("RGBA")
    im = _sheets[ts]; tpr = im.width // 16
    return im.crop(((t % tpr) * 16, (t // tpr) * 16, (t % tpr) * 16 + 16, (t // tpr) * 16 + 16))

def base_art(e, pad=1, approach_wall=False):
    c, rows, ts = e["contract"], e["rows"], e["tileset"]
    w, h = c["w"], c["h"]
    im = Image.new("RGBA", ((w + 2 * pad) * 16, (h + 2 * pad) * 16), (58, 54, 50, 255))
    d = ImageDraw.Draw(im)
    for yy in range(h + 2 * pad):
        for xx in range(w + 2 * pad):
            if (xx + yy) % 2: d.rectangle([xx * 16, yy * 16, xx * 16 + 15, yy * 16 + 15], fill=(66, 62, 58, 255))
    if approach_wall:
        for (x, y) in c["approach"]:
            d.rectangle([(x + pad) * 16, (y + pad) * 16, (x + pad) * 16 + 15, (y + pad) * 16 + 15], fill=(28, 26, 30, 255))
            d.line([(x + pad) * 16, (y + pad) * 16 + 8, (x + pad) * 16 + 15, (y + pad) * 16 + 8], fill=(90, 86, 92, 255))
    for layer in ("tiles", "upperTiles"):
        for y, r in enumerate(rows):
            for x, t in enumerate(r.get(layer) or []):
                if t is not None and t >= 0: im.alpha_composite(tile(ts, t), ((x + pad) * 16, (y + pad) * 16))
    return im.resize((im.width * SCALE, im.height * SCALE), Image.NEAREST)

ARROW = {"N": (0, 1), "S": (0, -1), "E": (-1, 0), "W": (1, 0)}  # 앞 칸 → 계단 쪽
def marks(im, c, pad=1, blocked=False):
    cs = 16 * SCALE
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    box = lambda x, y: [(x + pad) * cs, (y + pad) * cs, (x + pad) * cs + cs - 1, (y + pad) * cs + cs - 1]
    passable = {tuple(p) for p in c["passable"]}
    for y in range(c["h"]):
        for x in range(c["w"]):
            if (x, y) not in passable:
                b = box(x, y); d.line([b[0] + 6, b[1] + 6, b[0] + 18, b[1] + 18], fill=(255, 60, 60, 230), width=3); d.line([b[0] + 18, b[1] + 6, b[0] + 6, b[1] + 18], fill=(255, 60, 60, 230), width=3)
    for (x, y) in c["trigger"]:
        b = box(x, y); d.rectangle([b[0] + 3, b[1] + 3, b[2] - 3, b[3] - 3], outline=(40, 255, 90, 255), width=4)
    for (x, y) in c.get("exit") or []:
        b = box(x, y); d.rectangle([b[0] + 3, b[1] + 3, b[2] - 3, b[3] - 3], outline=(70, 150, 255, 255), width=4)
    for (x, y) in c["approach"]:
        b = box(x, y)
        if blocked:
            d.line([b[0] + 8, b[1] + 8, b[2] - 8, b[3] - 8], fill=(255, 40, 40, 255), width=6); d.line([b[2] - 8, b[1] + 8, b[0] + 8, b[3] - 8], fill=(255, 40, 40, 255), width=6)
            continue
        d.rectangle([b[0] + 2, b[1] + 2, b[2] - 2, b[3] - 2], outline=(255, 215, 0, 255), width=4)
        side = c["side"]
        if side == "any":
            # 1×1 계단: 앞 칸 → 가운데 계단 쪽.
            tx, ty = c["trigger"][0]; dx, dy = tx - x, ty - y
        else:
            dx, dy = ARROW[side]
        cx, cy = (b[0] + b[2]) // 2, (b[1] + b[3]) // 2
        L = cs // 2 - 10
        ex, ey = cx + dx * L, cy + dy * L
        d.line([cx - dx * L // 2, cy - dy * L // 2, ex, ey], fill=(20, 20, 20, 255), width=5)
        d.polygon([(ex + dx * 8, ey + dy * 8), (ex - dy * 9, ey + dx * 9), (ex + dy * 9, ey - dx * 9)], fill=(20, 20, 20, 255))
    im.alpha_composite(ov)
    return im

def fit(im, limit=820):
    s = min(1.0, limit / max(im.width, im.height))
    if s < 1: im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.NEAREST)
    return im.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT)

def caption_cells(cells):
    return " ".join(f"({x},{y})" for x, y in cells) or "-"

LEAD_KO = {"up": "위층으로 오른다", "down": "아래층으로 내려간다", "same": "같은 맵 안의 단(층 이동 없음)"}
SIDE_KO = {"N": "북쪽", "S": "남쪽", "E": "동쪽", "W": "서쪽", "any": "어느 쪽이든(옆 바닥)"}
FACING = {"N": "up", "S": "down", "E": "right", "W": "left"}

def main():
    with tempfile.TemporaryDirectory() as tmp:
        dump = os.path.join(tmp, "dump.json")
        subprocess.run(["npx", "--no-install", "tsx", "scripts/content/stairs/build-stair-contracts.mts", "--dump", dump], check=True)
        entries = json.load(open(dump))
    by_ts = {}
    for e in entries: by_ts.setdefault(e["tileset"], []).append(e)
    out = {}
    for ts, kits in sorted(by_ts.items()):
        if ts not in TEX: print(f"[stair-refs] 그림 없음: {ts}", file=sys.stderr); continue
        os.makedirs(os.path.join(OUT_DIR, ts), exist_ok=True)
        images, dict_rows = [], []
        for i, e in enumerate(kits):
            c = e["contract"]; slug = f"{i:02d}"
            art = marks(base_art(e), c)
            if c["leads"] != "same":
                bad = marks(base_art(e, approach_wall=True), c, blocked=True)
                gap = 24
                both = Image.new("RGBA", (art.width + gap + bad.width, max(art.height, bad.height)), (255, 255, 255, 255))
                both.paste(art, (0, 0)); both.paste(bad, (art.width + gap, 0))
                d = ImageDraw.Draw(both); d.rectangle([art.width + 2, 0, art.width + gap - 3, both.height], fill=(220, 40, 40, 255))
                art = both
            fn = f"{ts}/{slug}.png"
            fit(art).save(os.path.join(OUT_DIR, fn), optimize=True)
            pair = "왼쪽 = 정상(앞 칸 노랑이 빈 바닥) · 오른쪽 = 오류(앞 칸이 벽·가구 — stair-entrance-blocked)" if c["leads"] != "same" else "같은 맵 단: 노랑 앞 칸에서 올라 파랑 위 끝으로 나간다"
            images.append({"id": f"stair-{ts}-{slug}", "name": f"{e['name']} ({e['id']})",
                           "caption": f"4배 확대 · 초록 = 이동 칸(trigger) {caption_cells(c['trigger'])} · 노랑 화살표 = 앞 칸(approach) {caption_cells(c['approach'])} → 계단 쪽 · 빨강 X = 못 밟는 칸 · 파랑 = 위 끝(exit). {pair}. 좌표는 키트 왼쪽 위 기준.",
                           "dataUrl": f"/assets/stair-references/{fn}"})
            rows = [{"lower": r.get("tiles") or [], "upper": r.get("upperTiles") or []} for r in e["rows"]]
            dict_rows.append({"kit": e["id"], "name": e["name"], "size": f"{c['w']}x{c['h']}", "leads": c["leads"], "mode": c["mode"], "side": c["side"],
                              "trigger": c["trigger"], "approach": c["approach"], **({"exit": c["exit"]} if c.get("exit") else {}),
                              "arrivalFacing": FACING.get(c["side"], "앞 칸 → 계단 반대쪽"), "rows": rows, "image": f"stair-{ts}-{slug}"})
        ex = next((k for k in kits if k["contract"]["leads"] != "same" and k["contract"]["side"] == "S"), next((k for k in kits if k["contract"]["leads"] != "same"), kits[0]))
        c = ex["contract"]; ox, oy = 10, 4
        abs_ = lambda cells: [[ox + x, oy + y] for x, y in cells]
        md = f"""# 계단 입구 — {ts}

계단·사다리·에스컬레이터·바닥 구멍을 놓기 전에 읽는다. 정본은 `src/assets/stairContracts.json`(입구 계약)이고 이 문서는 그 사본이다.
칸 크기 16px · 좌표는 0 기준, **키트 왼쪽 위(키트 rows 의 첫 칸)** 기준 상대 좌표다. 그림: `public/assets/{TEX[ts]}`.

## 낱말
- **이동 칸(trigger)**: 층 이동 이벤트를 다는 계단 그림 칸. `walk` 는 밟아서, `bump` 는 막힌 그림이라 앞 칸에서 부딪혀 탄다(이벤트 priority `same`).
- **앞 칸(approach)**: 키트 밖, 들어서는 쪽 바닥 칸. **반드시 걸을 수 있는 바닥이고 방의 다른 바닥과 이어져야 한다** — 벽·가구·맵 끝·다른 키트 금지.
- **들어서는 쪽(side)**: 앞 칸이 있는 쪽. 계단은 이 쪽을 방 안으로 열고, 반대쪽을 벽에 붙인다.
- **leads**: `up` 위층으로 · `down` 아래층으로 · `same` 같은 맵 안의 단(이동 이벤트 없음, 앞 칸 → 위 끝 exit 로 이어진다).
- **도착**: 다른 층에서 이 계단으로 오면 앞 칸에 내리고 계단을 등진다(direction = arrivalFacing).

## 실행 순서
1. 가는 쪽에 맞는 그림을 고른다: 위층(옥상 포함)으로 가면 `leads: up`, 아래층(지하 포함)으로 가면 `leads: down`. 위층에는 내려가는 계단, 아래층에는 오르는 계단이 짝이다.
2. 키트를 원점 (x,y) 에 찍는다. 앞 칸 = (x+ax, y+ay) 가 모두 방 바닥 안에 들어오게 둔다 — 남쪽이 앞 칸인 계단을 남쪽 벽에 붙이면 막힌다.
3. 앞 칸과 그 곁에 가구를 두지 않는다. 걸어서 방 입구/도착 칸에서 앞 칸까지 이어지는지 본다.
4. 층 이동 이벤트를 이동 칸 중 하나에 둔다(`bump` 면 priority same). 앞 바닥에 두면 지나가기만 해도 층이 바뀐다.
5. 반대 층의 짝 계단에서 오는 도착을 그 계단의 앞 칸에 두고 direction 을 arrivalFacing 으로.
6. 검사(validate / 장면 검사)에서 `stair-entrance-blocked` · `stair-misfacing` · `stair-trigger-off` 가 0 이어야 끝이다.

## 계산 예제 — {ex['id']} 를 (10,4) 에
- 키트 {c['w']}×{c['h']}, {LEAD_KO[c['leads']]}, 들어서는 쪽 {SIDE_KO[c['side']]}, mode `{c['mode']}`.
- 이동 칸(맵 좌표) {abs_(c['trigger'])} · 앞 칸(맵 좌표, 비워 둘 바닥) {abs_(c['approach'])}.
- 이벤트: `{{"x": {ox + c['trigger'][0][0] if c['trigger'] else ox}, "y": {oy + c['trigger'][0][1] if c['trigger'] else oy}, "pages": [{{"trigger": "{'touch' if c['mode'] == 'walk' else 'action'}"{', "priority": "same"' if c['mode'] == 'bump' else ''}, "commands": [{{"kind": "transfer", "mapId": "<짝 층>", "x": "<짝 계단 앞 칸 x>", "y": "<짝 계단 앞 칸 y>", "direction": "<짝 계단 arrivalFacing>"}}]}}]}}`
- 짝 층에서 이 계단으로 오는 transfer: `{{"x": {abs_(c['approach'])[0][0] if c['approach'] else ox}, "y": {abs_(c['approach'])[0][1] if c['approach'] else oy}, "direction": "{FACING.get(c['side'], 'down')}"}}`.

## 하위/상위 칸 배열(정답)
키트 rows 의 `lower` = 아래층 칸(tiles), `upper` = 위층 칸(upperTiles), -1 = 비움. 찍으면 이 배열이 그대로 맵에 들어간다.
통행은 칩셋 칸 판정 그대로다(빨강 X 칸은 못 밟음) — 계단 그림 칸을 덮는 바닥·벽을 따로 칠하지 않는다.

## 사전
```json
{json.dumps(dict_rows, ensure_ascii=False, indent=1)}
```

## 정상 / 오류
각 그림의 왼쪽이 정상(노랑 앞 칸이 빈 바닥), 오른쪽이 오류(앞 칸이 벽 — `stair-entrance-blocked`). 오류 셋:
- 앞 칸이 벽·가구·맵 밖 → `stair-entrance-blocked`.
- 앞 칸이 바닥이지만 방에서 걸어서 닿지 않는다(칸막이 뒤) → `stair-entrance-blocked`.
- 오르는 계단으로 지하/아래층에, 내려가는 계단으로 옥상/위층에 간다 · 오름↔오름으로 이었다 · 도착이 계단 칸 위거나 계단을 바라본다 → `stair-misfacing`.
- 이동 이벤트가 계단 그림 칸이 아니라 앞 바닥에 있다 → `stair-trigger-off`.

## 자동 검사 범위
- 확인한다: 맵 네 층의 칸 번호로 계단 키트를 찾아(그림 칸 75% 이상 일치) 앞 칸 통행, 도착/시작 칸에서 걸어서 닿는지, 층 이동 이벤트 위치, 짝 방향(짝 계단 또는 맵 이름의 층·옥상·지하), 도착 칸·방향.
- 확인하지 않는다: 계단 그림이 벽 윗줄과 시각적으로 맞는지, 이벤트가 실제로 실행되는지, 맵 이름에 층이 없을 때의 위/아래.
- `build_hand_interior_room`·`create_transfer_pair` 는 쓰기 직후 이동 칸·도착을 이 계약대로 맞추고(메모를 돌려준다), 키트 찍기(stamp_object)는 앞 칸이 막히면 거절한다.
"""
        out[ts] = {"id": "stair-entrance", "name": "계단 입구",
                   "description": "계단·사다리·에스컬레이터를 어디에 놓고 어느 칸으로 들어서는지 — 앞 칸·이동 칸·도착 방향(입구 계약).",
                   "documents": [{"id": "stair-entrance-guide", "name": f"계단 입구 — {ts}", "markdown": md}],
                   "images": images}
    with open(OUT_JSON, "w") as f: json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    total = sum(len(v["images"]) for v in out.values())
    print(f"[stair-refs] 칩셋 {len(out)} · 그림 {total} → {os.path.relpath(OUT_JSON, ROOT)} ({os.path.getsize(OUT_JSON) // 1024}KB)")

if __name__ == "__main__":
    main()
