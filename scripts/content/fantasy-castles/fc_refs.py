#!/usr/bin/env python3
"""fantasy_castles 참고문서(번들 소유, AI-REFERENCE-CONTRACT) — fc_build.py 산출을 읽어 세 용도를 만든다.

  fc-layers  층·통행 규칙(먼저 읽는다) + 실제 맵을 변조해 검출한 오류 4종(코드·좌표)
  fc-pieces  조각 사전(키트마다 1층/3층 칸 배열·칸 통행) + 조각 도감 그림
  fc-maps    두 맵의 조립 예제(배치 목록·경로·구역별 네 층 정답 배열 + 원본 해상도 그림)

산출(대기 구역 — 관문 통과 뒤 fc_gate.py publish 가 public/·src/assets 로 옮긴다):
  tiledata/fantasy-castles/build/fantasyCastlesReferences.json  (그림은 /assets/fantasy-castles/references/*.png 경로만)
  tiledata/fantasy-castles/build/references/*.png               (긴 변 ≤820px, ≤128색)
  tiledata/fantasy-castles/references/*.md                      (출처 사본)
  python3 scripts/content/fantasy-castles/fc_refs.py [--route-paths /tmp/fc-route-paths.json]
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
import fc_build as FB  # noqa: E402

DATA = os.environ.get("FC_DATA") or os.path.join(REPO, "tiledata", "fantasy-castles")
BUILD = os.path.join(DATA, "build")
IMG_DIR = os.path.join(BUILD, "references")
MD_DIR = os.path.join(DATA, "references")
URL = "/assets/fantasy-castles/references/"
T = 16
LMAX = 820
LAYER_ENGINE = [("ground", "lowerTiles", "1층"), ("ground_over", "lowerOverlayTiles", "2층"), ("object", "upperTiles", "3층"), ("object_over", "upperOverlayTiles", "4층")]


def save_img(img: np.ndarray, name: str, scale: int = 1) -> str:
    im = Image.fromarray(img)
    if scale > 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    if max(im.size) > LMAX:
        k = LMAX / max(im.size)
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.NEAREST)
    rgb = im.convert("RGBA")
    q = rgb.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    os.makedirs(IMG_DIR, exist_ok=True)
    q.save(os.path.join(IMG_DIR, name), optimize=True)
    return URL + name


class Ctx:
    def __init__(self):
        self.ts = FB.read_json(os.path.join(BUILD, "fantasyCastlesTileset.json"))
        self.sheet = FB.load_rgba(os.path.join(BUILD, "fantasy-castles-chipset.png"))
        self.cols = self.ts["tilesPerRow"]
        self.maps = {}
        for f in sorted(os.listdir(os.path.join(DATA, "maps"))):
            if f.endswith(".json"):
                m = FB.read_json(os.path.join(DATA, "maps", f))
                self.maps[m["map"]["id"]] = m
        self.passes = ["O" if p["up"] else "X" for p in self.ts["passability"]]
        self.prio = self.ts["priority"]

    def grids(self, mid):
        m = self.maps[mid]["map"]
        w, h = m["width"], m["height"]
        out = {}
        for L, key, _ in LAYER_ENGINE:
            flat = m.get(key) or [-1] * (w * h)
            out[L] = [flat[y * w:(y + 1) * w] for y in range(h)]
        return out

    def mark(self, i):
        if i < 0:
            return "."
        return "*" if self.passes[i] == "O" and self.prio[i] == "upper" else self.passes[i]

    def engine_pass(self, g, x, y):
        if g["ground"][y][x] < 0:
            return False
        for L in ("object_over", "object", "ground_over"):
            i = g[L][y][x]
            if i < 0 or self.mark(i) == "*":
                continue
            return self.passes[i] == "O"
        return self.passes[g["ground"][y][x]] == "O"

    def render(self, g, x0=0, y0=0, w=None, h=None):
        w = w or len(g["ground"][0]) - x0
        h = h or len(g["ground"]) - y0
        part = {L: [row[x0:x0 + w] for row in g[L][y0:y0 + h]] for L in FB.LAYERS}
        return FB.render(part, self.sheet, self.cols, w, h)


def bfs(ctx, g, start, goal=None):
    h, w = len(g["ground"]), len(g["ground"][0])
    ok = [[ctx.engine_pass(g, x, y) for x in range(w)] for y in range(h)]
    seen = {tuple(start)}
    q = deque([tuple(start)])
    while q:
        x, y = q.popleft()
        if goal and (x, y) == tuple(goal):
            return True
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen and ok[y][x] and ok[ny][nx]:
                seen.add((nx, ny))
                q.append((nx, ny))
    return False if goal else seen


def walk_errors(ctx, g, walk):
    return [[x, y, walk[y][x]] for y in range(len(walk)) for x in range(len(walk[0])) if ctx.engine_pass(g, x, y) != (walk[y][x] == "O")]


def overlay(ctx, mid):
    g = ctx.grids(mid)
    img = ctx.render(g).astype(np.float64)
    walk = ctx.maps[mid]["walk"]
    for y, row in enumerate(walk):
        for x, c in enumerate(row):
            if c == "X":
                cell = img[y * T:(y + 1) * T, x * T:(x + 1) * T, :3]
                cell[:] = cell * 0.55 + np.array([200, 30, 30]) * 0.45
    return img.astype(np.uint8)


def arrays_md(ctx, g, x0, y0, w, h):
    lines = []
    for L, key, num in LAYER_ENGINE:
        rows = [row[x0:x0 + w] for row in g[L][y0:y0 + h]]
        if not any(v >= 0 for r in rows for v in r):
            lines.append(f"- {num} `{key}`: 이 구역에 칸 없음(전부 -1)")
            continue
        lines.append(f"- {num} `{key}` (행마다 x={x0}..{x0 + w - 1}):")
        lines.append("```json")
        lines.append("[" + ",\n ".join(json.dumps(r) for r in rows) + "]")
        lines.append("```")
    marks = ["".join("O" if ctx.engine_pass(g, x, y) else "X" for x in range(x0, x0 + w)) for y in range(y0, y0 + h)]
    lines.append("- 엔진 통행(O 걸음 / X 막힘, 위 배열로 엔진 규칙을 적용한 결과):")
    lines.append("```\n" + "\n".join(marks) + "\n```")
    return "\n".join(lines)


def pick_regions(ctx, mid, route_paths):
    m = ctx.maps[mid]["map"]
    w, h = m["width"], m["height"]
    rw, rh = min(14, w), min(12, h)
    regions = []
    for r in (route_paths or {}).get(mid, [])[:3]:
        p = r["path"]
        if not p:
            continue
        cx, cy = p[len(p) // 2]
        regions.append((r["name"], max(0, min(w - rw, cx - rw // 2)), max(0, min(h - rh, cy - rh // 2))))
    if not regions:
        regions = [("가운데", (w - rw) // 2, (h - rh) // 2)]
    return regions, rw, rh


def tamper_examples(ctx, mid, route_spec):
    g0 = ctx.grids(mid)
    walk = ctx.maps[mid]["walk"]
    h, w = len(walk), len(walk[0])
    found = []

    def clone():
        return {L: [list(r) for r in g0[L]] for L in FB.LAYERS}

    def first(pred):
        for y in range(h):
            for x in range(w):
                if pred(x, y):
                    return x, y
        return None

    star = next((i for i in range(len(ctx.passes)) if ctx.mark(i) == "*"), None)
    at = first(lambda x, y: g0["object"][y][x] >= 0 and ctx.mark(g0["object"][y][x]) == "X" and g0["object_over"][y][x] < 0)
    if at and star is not None:
        g = clone()
        g["object"][at[1]][at[0]] = star
        errs = walk_errors(ctx, g, walk)
        found.append(dict(code="wall-open", what="물체(3층) 막힘 칸 자리에 ★ 칸(4층용 수관·처마)을 깔았다 — ★ 는 통행 판정에서 건너뛰므로 벽이 뚫린다",
                          at=at, detected=[e[:2] for e in errs[:5]], count=len(errs), g=g))
    at = first(lambda x, y: walk[y][x] == "O" and g0["object"][y][x] < 0 and g0["ground_over"][y][x] >= 0
               and ctx.passes[g0["ground"][y][x]] == "X")
    if at:
        g = clone()
        g["ground_over"][at[1]][at[0]] = -1
        errs = walk_errors(ctx, g, walk)
        found.append(dict(code="overlay-removed", what="2층(바닥 장식)이 통행을 정하던 칸(물 위 다리·물가 디딤)에서 2층을 지웠다 — 아래 1층(막힘)이 정해 길이 끊긴다",
                          at=at, detected=[e[:2] for e in errs[:5]], count=len(errs), g=g))
    at = first(lambda x, y: g0["object"][y][x] >= 0 and (ctx.sheet is not None))
    if at:
        g = clone()
        g["ground"][at[1]][at[0]] = g0["object"][at[1]][at[0]]
        g["object"][at[1]][at[0]] = -1
        i = g["ground"][at[1]][at[0]]
        y0, x0 = divmod(i, ctx.cols)
        holes = int((ctx.sheet[y0 * T:(y0 + 1) * T, x0 * T:(x0 + 1) * T, 3] < 255).sum())
        found.append(dict(code="ground-transparent", what="물체 칸을 1층(바닥)에 깔았다 — 1층은 불투명해야 한다(투명 화소가 검게 뚫린다)",
                          at=at, detected=[list(at)] if holes else [], count=holes, g=g, unit="투명 화소"))
    if route_spec:
        r = route_spec[0]
        path = r.get("path") or []
        for (x, y) in path[1:-1]:
            g = clone()
            g["object"][y][x] = next((i for i in range(len(ctx.passes)) if ctx.mark(i) == "X" and ctx.ts["tileMeta"][i]["defaultLayer"] == "upper"), -1)
            if g["object"][y][x] < 0:
                break
            if not bfs(ctx, g, path[0], path[-1]) and bfs(ctx, g0, path[0], path[-1]):
                found.append(dict(code="route-blocked", what=f"경로 「{r['name']}」 위 칸에 막힘 물체를 놓았다 — 엔진 너비 우선 탐색이 끝점에 못 닿는다",
                                  at=(x, y), detected=[[x, y]], count=1, g=g, route=[path[0], path[-1]]))
                break
    return found


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--route-paths", default="/tmp/fc-route-paths.json")
    a = ap.parse_args(argv)
    ctx = Ctx()
    stats = FB.read_json(os.path.join(DATA, "build-stats.json"))
    route_paths = FB.read_json(a.route_paths) if os.path.exists(a.route_paths) else {}
    routes = FB.read_json(os.path.join(DATA, "routes.json")) if os.path.exists(os.path.join(DATA, "routes.json")) else {}
    ts, n, cols = ctx.ts, ctx.ts["count"], ctx.cols
    head = (f"tilesetId `fantasy_castles` · 그림 `public/assets/fantasy-castles/fantasy-castles-chipset.png`(텍스처 `tex_fantasy_castles`, **{n}칸**, 16px 칸, "
            f"한 줄 **{cols}칸** — 번호 n 의 칸은 열 n%{cols}, 행 n÷{cols}(내림), 픽셀 (열×16, 행×16), 모두 0 기준). 계열 `oprn-fantasy-castles` — "
            "다른 칩셋(버들항·조선·성채 Castle2 등)의 칸 번호와 섞지 않는다. 칸 번호는 장부(`tiledata/fantasy-castles/cell-ledger.json`)가 고정하는 덧붙이기 전용이다.")
    docs_layers, imgs_layers = [], []
    howto = [f"# fantasy_castles · 층·통행 규칙 (먼저 읽는다)\n\n{head}\n",
             "## 네 층 ↔ 맵 칸", "| 원본 층 | 맵 칸(`GameMap`) | 엔진 층 | 무엇 | 칸 통행·priority |", "|---|---|---|---|---|",
             "| ground | `lowerTiles` | 1층 | 풀·흙·포석·물·모래·단 윗면(모든 칸 불투명) | 그 칸 walk(O 걸음/X 막힘), lower |",
             "| ground_over | `lowerOverlayTiles` | 2층 | 절벽 가장자리 풀 띠·길·물가·그림자·작은 돌 | 통행을 정하는 칸이면 그 칸 walk, lower |",
             "| object | `upperTiles` | 3층 | 몸채·벽 앞면·절벽 앞면·성벽·나무 밑동·바위 | 그 칸 walk(대부분 X, 문·계단·아치 통로는 O), lower → 캐릭터와 y 정렬 |",
             "| object_over | `upperOverlayTiles` | 4층 | 지붕 윗부분·처마·수관·아치 윗부분·난간 윗부분 | 늘 ★(걸음 + upper) — 캐릭터 위에 그려지고 통행 판정에서 건너뛴다 |",
             "",
             "## 엔진 통행 규칙 (`src/project/collision.ts`)",
             "칸마다 위에서부터(4층→3층→2층) 빈칸과 ★ 를 건너뛰고 **처음 만난 칸의 통행**이 그 칸을 정한다. 모두 건너뛰면 1층이 정한다. 1층이 비면 막힘.",
             "그래서 같은 그림이라도 정하는 자리에서 걸음과 막힘으로 다르게 쓰이면 **칸을 둘로 나눴다**(예: 물가 장식이 모래 위에선 O, 물 위에선 X). "
             f"이번 굽기에서 나뉜 그림: {json.dumps(stats.get('splitByPassability', {}), ensure_ascii=False)}(홈 층별).",
             "",
             "## 깔 때 순서",
             "1. 1층을 모두 채운다(빈칸 금지). 2. 2층 장식을 1층 위에. 3. 3층 물체를 조각 단위로(조각 사전의 칸 배열 그대로, 칸 경계에만). 4. 4층(★)을 그 조각의 윗부분에.",
             "5. 저장 전에 통행 덧칠(이 용도의 walk 그림)과 같은지 본다 — 문·성문 통로·계단 칸은 3층에 있어도 O 다.",
             "- 키트(structureKits)는 편집기 형식상 두 칸(1층 `tiles` · 3층 `upperTiles`)만 담는다. 한 칸에 1층과 2층이 함께 있으면 키트는 1층만, 3층과 4층이 함께 있으면 3층만 싣는다 "
             f"(이번 굽기에서 그런 키트 {len(stats.get('kits', {}).get('lossy', []))}개). 2층·4층은 조립 예제의 배열을 그대로 `layer: \"2\"`·`\"4\"` 로 깐다.",
             "",
             "## 금지",
             "- ★ 칸(4층용)을 3층에 깔지 않는다 — 막혀야 할 칸이 뚫린다(오류 `wall-open`).",
             "- 물체 칸을 1층에 깔지 않는다 — 투명 화소가 뚫린다(`ground-transparent`).",
             "- 통행을 정하던 2층 칸(물 위 디딤·다리 갑판)을 지우지 않는다(`overlay-removed`).",
             "- 경로 위에 막힘 물체를 놓지 않는다(`route-blocked`).",
             "",
             "## 자동 검사 범위",
             "변환기(`fc_build.py`)와 저장 증명(`save-fantasy-castles.mjs`)이 확인하는 것: 칸마다 엔진 통행 = 원본 walk(불일치 0), 맵마다 지정 경로를 엔진 `canMove` 너비 우선 탐색으로 잇기, "
             "다시 합성한 그림 = 원본 composite.png(화소 동일), SQLite 저장→재로드 동일. 이벤트(문 전이·NPC)·미적 품질·저가 모델의 성공률은 이 검사가 말하지 않는다.",
             ]
    docs_layers.append(dict(id="fc-howto", name="fantasy_castles · 층·통행 규칙(먼저 읽는다)", markdown="\n".join(howto) + "\n"))
    err_md = ["# fantasy_castles · 변조 오류 (실제 맵을 바꿔 검출기를 돌린 결과)\n",
              "정상 맵 한 칸을 바꾸고 검출기(엔진 통행 규칙·너비 우선 탐색·1층 불투명 검사)를 돌렸다. 좌표는 0 기준 (x, y).\n"]
    for mid in ctx.maps:
        name = ctx.maps[mid]["map"]["name"]
        imgs_layers.append(dict(id=f"fc-img-walk-{mid}", name=f"walk-{mid}.png", caption=f"{name} 통행 덧칠(빨강 = 막힘 X). 원본 walk 그대로이고 엔진 통행과 불일치 0.",
                                dataUrl=save_img(overlay(ctx, mid), f"walk-{mid}.png")))
        for ex in tamper_examples(ctx, mid, route_paths.get(mid, [])):
            x, y = ex["at"]
            mw, mh = ctx.maps[mid]["map"]["width"], ctx.maps[mid]["map"]["height"]
            x0, y0 = max(0, min(mw - 8, x - 4)), max(0, min(mh - 6, y - 3))
            good = ctx.render(ctx.grids(mid), x0, y0, min(8, mw), min(6, mh))
            bad = ctx.render(ex["g"], x0, y0, min(8, mw), min(6, mh))
            pair = np.concatenate([good, np.zeros((good.shape[0], 8, 4), np.uint8), bad], axis=1)
            im = Image.fromarray(pair)
            d = ImageDraw.Draw(im)
            bx = good.shape[1] + 8 + (x - x0) * T
            d.rectangle([bx, (y - y0) * T, bx + T - 1, (y - y0) * T + T - 1], outline=(255, 0, 0, 255))
            fn = f"err-{ex['code']}-{mid}.png"
            imgs_layers.append(dict(id=f"fc-img-err-{ex['code']}-{mid}", name=fn,
                                    caption=f"{name} · 왼쪽 정상 / 오른쪽 `{ex['code']}` 변조 (빨간 칸 ({x},{y})).", dataUrl=save_img(np.array(im), fn, 2)))
            err_md.append(f"## `{ex['code']}` — {name} ({x},{y})\n{ex['what']}.\n검출: {ex['count']}{ex.get('unit', '칸')} — 좌표 {ex['detected']}"
                          + (f", 경로 {ex['route'][0]}→{ex['route'][1]} 끊김" if ex.get("route") else "") + f". 그림 `{fn}`.\n")
    docs_layers.append(dict(id="fc-errors", name="fantasy_castles · 변조 오류 4종(코드·좌표)", markdown="\n".join(err_md)))

    docs_pieces, imgs_pieces = [], []
    kits_by_map = {}
    for k in ts["structureKits"]:
        mid = next((m for m in ctx.maps if k["id"].startswith(FB.PREFIX + m.replace("fc_", "").replace("_", "-") + "-")), "기타")
        kits_by_map.setdefault(mid, []).append(k)
    for mid, kits in kits_by_map.items():
        name = ctx.maps[mid]["map"]["name"] if mid in ctx.maps else mid
        md = [f"# fantasy_castles · {name} 조각 사전 ({len(kits)}개)\n", head + "\n",
              "칸마다 기호: `O` 걸음 · `X` 막힘 · `*` ★(캐릭터 위, 통행 건너뜀) · `.` 빈칸. 1층 = `tiles`, 3층 = `upperTiles`.\n"]
        thumbs = []
        for idx, k in enumerate(kits):
            lo = [r["tiles"] for r in k["rows"]]
            up = [r.get("upperTiles", [-1] * k["width"]) for r in k["rows"]]
            marks = ["".join(ctx.mark(u if u >= 0 else l) for l, u in zip(lr, ur)) for lr, ur in zip(lo, up)]
            md.append(f"## [{idx}] `{k['id']}` — {k['name']} ({k['width']}×{k['height']})\n```json\n"
                      + json.dumps(dict(tiles=lo, upperTiles=up), separators=(",", ":")) + "\n```\n통행 `" + " / ".join(marks) + "`\n")
            g = {"ground": [[v for v in r] for r in lo], "ground_over": [[-1] * k["width"] for _ in lo],
                 "object": [[v for v in r] for r in up], "object_over": [[-1] * k["width"] for _ in lo]}
            thumbs.append((idx, FB.render(g, ctx.sheet, ctx.cols, k["width"], k["height"])))
        docs_pieces.append(dict(id=f"fc-pieces-{mid}", name=f"fantasy_castles · {name} 조각 사전", markdown="\n".join(md)))
        per_sheet = 40
        for s0 in range(0, len(thumbs), per_sheet):
            chunk = thumbs[s0:s0 + per_sheet]
            cw = max(t.shape[1] for _, t in chunk) + 8
            ch = max(t.shape[0] for _, t in chunk) + 18
            ncol = max(1, min(len(chunk), 1200 // cw))
            nrow = (len(chunk) + ncol - 1) // ncol
            board = Image.new("RGBA", (ncol * cw, nrow * ch), (40, 40, 48, 255))
            d = ImageDraw.Draw(board)
            for j, (idx, t) in enumerate(chunk):
                cx, cy = (j % ncol) * cw, (j // ncol) * ch
                d.text((cx + 2, cy + 2), str(idx), fill=(255, 255, 255, 255))
                board.alpha_composite(Image.fromarray(t), (cx + 4, cy + 14))
            fn = f"pieces-{mid}-{s0 // per_sheet}.png"
            imgs_pieces.append(dict(id=f"fc-img-pieces-{mid}-{s0 // per_sheet}", name=fn,
                                    caption=f"{name} 조각 도감 [{chunk[0][0]}..{chunk[-1][0]}] — 번호는 사전의 [번호]. 키트 1층+3층을 그린 것.",
                                    dataUrl=save_img(np.array(board), fn)))

    docs_maps, imgs_maps = [], []
    for mid, m in ctx.maps.items():
        mm = m["map"]
        g = ctx.grids(mid)
        regions, rw, rh = pick_regions(ctx, mid, route_paths)
        md = [f"# fantasy_castles · {mm['name']} 조립 예제 ({mm['width']}×{mm['height']})\n", head + "\n",
              f"맵 id `{mid}` · 원본 타일맵 `tiledata/fantasy-castles/src/` · 맵 JSON `tiledata/fantasy-castles/maps/{mid}.json`(네 층 전체 배열이 정답).",
              f"걸을 수 있는 칸 {sum(r.count('O') for r in m['walk'])} / {mm['width'] * mm['height']}.\n",
              "## 경로(엔진 canMove 너비 우선 탐색으로 확인)"]
        for r in (routes.get(mid) or {}).get("routes", []):
            md.append(f"- {r['name']}: " + " → ".join(f"({p[0]},{p[1]})" for p in r["points"]) + (f" · 피함 {r['avoid']}" if r.get("avoid") else ""))
        md.append("\n## 조각 배치(원본 map.json pieces)")
        md.append("```json\n" + json.dumps(m.get("placements") or [], ensure_ascii=False, separators=(",", ":"))[:30000] + "\n```")
        imgs_maps.append(dict(id=f"fc-img-map-{mid}", name=f"map-{mid}.png", caption=f"{mm['name']} 전체(축소). 원본 해상도는 맵 JSON 을 그리면 composite.png 와 화소 동일.",
                              dataUrl=save_img(ctx.render(g), f"map-{mid}.png")))
        for ri, (rname, x0, y0) in enumerate(regions):
            md.append(f"\n## 구역 {ri + 1} — {rname} (x {x0}..{x0 + rw - 1}, y {y0}..{y0 + rh - 1})")
            md.append(arrays_md(ctx, g, x0, y0, rw, rh))
            fn = f"region-{mid}-{ri + 1}.png"
            md.append(f"그림 `{fn}`(원본 ×2, 확대는 nearest).")
            imgs_maps.append(dict(id=f"fc-img-region-{mid}-{ri + 1}", name=fn, caption=f"{mm['name']} 구역 {ri + 1} — {rname} 네 층 합성(원본 ×2).",
                                  dataUrl=save_img(ctx.render(g, x0, y0, rw, rh), fn, 2)))
        docs_maps.append(dict(id=f"fc-map-{mid}", name=f"fantasy_castles · {mm['name']} 조립 예제", markdown="\n".join(md) + "\n"))

    cats = [
        dict(id="fc-layers", name="fantasy_castles · 층·통행 규칙과 변조 오류(먼저 읽는다)",
             description="네 층(ground·ground_over·object·object_over)을 편집기 1~4층에 까는 법, 칸 통행·★ 규칙, 실제 맵을 변조해 검출한 오류 4종.",
             documents=docs_layers, images=imgs_layers),
        dict(id="fc-pieces", name="fantasy_castles · 조각 사전",
             description="스톰베일·헬름 협곡 조각(키트)마다 1층/3층 칸 배열과 칸 통행, 조각 도감 그림.", documents=docs_pieces, images=imgs_pieces),
        dict(id="fc-maps", name="fantasy_castles · 조립 예제(두 맵)",
             description="스톰베일 절벽 성·헬름 협곡 요새 전체 그림, 경로, 조각 배치, 구역별 네 층 정답 배열과 원본 해상도 그림.", documents=docs_maps, images=imgs_maps),
    ]
    for c in cats:
        assert len(c["documents"]) <= 64 and len(c["images"]) <= 256
        for d in c["documents"]:
            assert len(d["markdown"]) <= 120_000, (d["id"], len(d["markdown"]))
    os.makedirs(MD_DIR, exist_ok=True)
    for c in cats:
        for d in c["documents"]:
            with open(os.path.join(MD_DIR, d["id"] + ".md"), "w", encoding="utf-8") as f:
                f.write(d["markdown"])
    with open(os.path.join(BUILD, "fantasyCastlesReferences.json"), "w", encoding="utf-8") as f:
        json.dump(cats, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(json.dumps({c["id"]: dict(documents=len(c["documents"]), images=len(c["images"])) for c in cats}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
