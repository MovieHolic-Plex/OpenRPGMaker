"""지역 시트 참고문서(tiledata/AI-REFERENCE-CONTRACT.md) — 굽기 결과에서 기계적으로 만든다(사람이 번호를 옮겨 적지 않는다).

용도 하나(id `mk-<테마>`)에 문서 넷 + 그림:
1. `<테마>-guide`   읽는 순서·장소 문법(레시피 머리말)·칠하는 법(오토타일·층·입구)·견본 맵 목록과 도달 검사·정상/오류 쌍
2. `<테마>-dict`    정확한 칸 사전: 0기준 번호·이름·라벨·통행·홈 층·지형 태그, 오토타일 그룹(꽉 찬 변형 번호), 물체(크기·입구)
3. `<테마>-kits`    물체마다 하위/상위 전체 배열(json)
4. `<테마>-ex-<맵>` 견본 맵마다 하위/상위 전체 배열(json) + 원본 해상도 그림(1배, 확대 없음)
그림: public/assets/monster-kit/references/<테마>/*.png (견본·오류 맵). 오류 그림은 엔진 도달 검사가 실제로 잡은 것(kitlib.negative).
"""
from __future__ import annotations

import importlib
import json
from pathlib import Path

from PIL import Image

T = 16
ROOT = Path(__file__).resolve().parents[4]
REF_DIR = ROOT / "public" / "assets" / "monster-kit" / "references"


def _render(bake: Path, mapfile: str) -> Image.Image:
    m = json.loads((bake / mapfile).read_text())
    ts = json.loads((bake / "tileset.json").read_text())
    sheet = Image.open(bake / "sheet.png").convert("RGBA")
    cols = ts["tilesPerRow"]
    im = Image.new("RGBA", (m["width"] * T, m["height"] * T), (0, 0, 0, 255))
    for layer in ("lower", "upper"):
        for i, t in enumerate(m[layer]):
            if t < 0:
                continue
            r, c = divmod(t, cols)
            im.alpha_composite(sheet.crop((c * T, r * T, c * T + T, r * T + T)), ((i % m["width"]) * T, (i // m["width"]) * T))
    return im


def _mod_docs(theme: str) -> str:
    """테마 레시피와 그 레시피가 import 한 도우미 모듈의 머리말(장소 문법)."""
    mod = importlib.import_module(theme.replace("-", "_"))
    out = [mod.__doc__ or ""]
    for name in getattr(mod, "DOC_MODULES", ()):
        out.append(importlib.import_module(name).__doc__ or "")
    return "\n\n".join(d.strip() for d in out if d.strip())


def build(theme: str, run_dir: Path, seed: dict, title: str) -> dict:
    bake = run_dir / "bake"
    tiles = json.loads((run_dir / "tiles.json").read_text())
    ts = json.loads((bake / "tileset.json").read_text())
    objects = json.loads((bake / "objects.json").read_text())
    if (bake / "maps.json").exists():
        maps = json.loads((bake / "maps.json").read_text())
    else:                                                   # 본 시트는 kitlib 이전 쇼케이스라 maps.json 이 없다 — verify-*.json 을 그대로 쓴다
        maps = []
        for p in sorted(bake.glob("verify-*.json")):
            mm = json.loads(p.read_text())
            maps.append({"file": p.name, "w": mm["width"], "h": mm["height"]})
    show = json.loads((bake / "showcase.json").read_text()) if (bake / "showcase.json").exists() else {"descriptions": {}, "negatives": [], "checks": []}
    notes = getattr(importlib.import_module(theme.replace("-", "_")), "MAP_NOTES", {})
    show["descriptions"] = {**notes, **show.get("descriptions", {})}
    tid, cols, count = seed["tilesetId"], ts["tilesPerRow"], ts["count"]
    out_dir = REF_DIR / theme
    out_dir.mkdir(parents=True, exist_ok=True)
    head = (f"tilesetId `{tid}` · 그림 `public/assets/monster-kit/{theme}.png`(텍스처 `tex_{tid}`, {count}칸, {T}px 칸, 한 줄 {cols}칸 — "
            f"번호 n 의 칸은 행 n÷{cols}, 열 n%{cols}). 칸 번호는 모두 이 시트의 0기준 번호다. 다른 칩셋 번호를 섞지 않는다.")
    meta = ts["tileMeta"]
    pas = lambda i: "막힘" if meta[i]["passage"] == "solid" else "통행"
    names = {v: k for k, v in tiles["ids"].items()}
    member_of = {}
    for g in ts["autotileGroups"]:
        for i in g["memberTileIds"]:
            member_of[i] = g["id"]
    obj_cells = {}
    for o in objects:
        for row in o["rowsLower"] + o["rowsUpper"]:
            for i in row:
                if i >= 0:
                    obj_cells[i] = o["name"]

    # ---- 그림(견본 + 오류) ----
    images = []
    neg_files = {n["file"]: n for n in show.get("negatives", [])}
    for m in maps:
        name = m["file"][len("verify-"):-len(".json")]
        im = _render(bake, m["file"])
        p = out_dir / f"{name}.png"
        im.save(p, optimize=True)
        neg = neg_files.get(m["file"])
        cap = (f"오류 예시 `{neg['code']}` — {neg['what']}. 엔진 도달 검사가 잡은 칸: {', '.join(f'({x},{y})' for x, y in neg['cells'])}. 원본 해상도(1칸 16px)."
               if neg else f"견본 맵 `{name}` {m['w']}×{m['h']} 완성 그림(하위+상위, 원본 해상도 1칸 16px). " + show["descriptions"].get(name, ""))
        images.append({"id": f"mk-{theme}-img-{name}", "name": f"{name}.png", "caption": cap,
                       "dataUrl": f"/assets/monster-kit/references/{theme}/{name}.png"})

    # ---- 1. 안내 ----
    ex = [m for m in maps if m["file"] not in neg_files]
    guide = [f"# {title} — 읽는 순서\n", head, "",
             f"읽는 순서: 이 문서 → `{theme}-dict`(칸 사전) → `{theme}-kits`(물체 배열) → 견본 `{theme}-ex-*`(전체 배열 + 그림). 번호를 지어내지 말고 사전에서 고른다.", "",
             "## 장소 문법(원작에서 잰 것)", "", _mod_docs(theme), "",
             "## 칠하는 법", "",
             "- **오토타일**: 그룹의 꽉 찬 변형(사전의 `full`)을 칠하면 엔진이 이웃으로 47변형을 고른다(`autotile_paint`/오토타일 칠). 변형 번호를 손으로 고르지 않는다.",
             "  `edgeConnects` 그룹(바다·항구 물 등)은 맵 밖을 이어진 것으로 본다 — 맵 끝에 테두리가 생기지 않는다. `connectGroups` 가 있는 그룹은 그 그룹 칸도 이웃으로 본다.",
             "- **층**: 사전의 「홈 층」이 upper 인 칸(투명 바탕 소품·물체 윗부분)은 3층에, 그 밑 1층에는 바닥을 깐다. 물체는 kits 배열의 lower/upper 를 그대로 찍는다(-1 = 그 층 비움).",
             "- **입구**: 건물 물체의 `entrance`(dx,dy) 칸이 통행 칸이고 그 바로 아래(dy+1) 칸이 문 앞 접근 칸이다. `w` 가 있으면(센터·마트 이중문) dx 부터 w 칸이 모두 입구다. 이동 이벤트는 문 칸에, 접근 칸은 비워 둔다.",
             "- **막힘 의미**: 막힌 소품(바위·덤불·통·상자)은 밀기·자르기·조사 이벤트를 올릴 자리다. 이벤트는 이 시트가 심지 않는다.",
             "- **확인 범위**: 견본의 도달 검사는 엔진 canMove·턱·미끄럼(slideTiles)으로 구조와 통행만 확인한다. 이벤트 실행·미적 품질은 보증하지 않는다.", "",
             "## 견본 맵", ""]
    for m in ex:
        name = m["file"][len("verify-"):-len(".json")]
        guide.append(f"- `{theme}-ex-{name}` {m['w']}×{m['h']} — {show['descriptions'].get(name, '')}")
    if show.get("checks"):
        guide += ["", "도달 검사(이 시트를 구울 때 통과한 것):", ""] + [f"- {c}" for c in show["checks"] if "오류 쌍" not in c]
    if neg_files:
        guide += ["", "## 정상/오류 쌍(엔진 검사가 실제로 잡은 결함)", ""]
        for n in neg_files.values():
            guide.append(f"- `{n['code']}` ({n['map']}): {n['what']} → 못 가는 칸 {', '.join(f'({x},{y})' for x, y in n['cells'])}. 그림 `{n['file'][len('verify-'):-len('.json')]}.png`")
    docs = [{"id": f"{theme}-guide", "name": f"{title} · 읽는 순서·문법", "markdown": "\n".join(guide)}]

    # ---- 2. 사전 ----
    d = [f"# {title} — 칸 사전\n", head, "",
         "형식: `번호 이름 — 라벨 · 통행 · 홈 층 · 지형 태그(0 보통·1 물·2 모래·3 눈·4 돌·5 풀숲)`. 투명 여부·홈 층·통행은 서로 다른 정보다.", ""]
    for title_, a, b in tiles["sections"]:
        rows = []
        for i in range(a, b):
            n = names.get(i)
            if not n or i in member_of or i in obj_cells:
                continue
            m_ = meta[i]
            rows.append(f"{i} {n} — {m_['label']} · {pas(i)} · {m_.get('defaultLayer', 'lower')} · {ts['terrain'][i]}")
        if rows:
            d += [f"## {title_}", "", "```", *rows, "```", ""]
    d += ["## 오토타일 그룹", "", "```"]
    for g in ts["autotileGroups"]:
        full = g["variantMap"]["255"]
        extra = [k for k in ("edgeConnects",) if g.get(k)]
        d.append(f"{g['id']} 「{g['name']}」 full={full} 변형 {len(g['memberTileIds'])}칸({min(g['memberTileIds'])}~{max(g['memberTileIds'])}) · {pas(full)}" + (f" · {', '.join(extra)}" if extra else ""))
    d += ["```", "", "## 물체(구조 킷 `mk-" + theme + "-<이름>`)", "", "```"]
    for o in objects:
        e = f" 입구({o['entrance']['dx']},{o['entrance']['dy']})" if o.get("entrance") else ""
        d.append(f"{o['name']} {o['width']}×{o['height']} {o['kind']}{e}")
    d.append("```")
    docs.append({"id": f"{theme}-dict", "name": f"{title} · 칸 사전", "markdown": "\n".join(d)})

    # ---- 3. 물체 배열 ----
    k = [f"# {title} — 물체 전체 배열\n", head, "", "물체마다 lower(1층)·upper(3층) 행렬. -1 은 그 층을 비운다. 왼쪽 위가 찍는 원점.", ""]
    for o in objects:
        k += [f"## {o['name']} ({o['width']}×{o['height']}, {o['kind']})", "", "```json",
              json.dumps({"lower": o["rowsLower"], "upper": o["rowsUpper"], **({"entrance": o["entrance"]} if o.get("entrance") else {})}), "```", ""]
    docs.append({"id": f"{theme}-kits", "name": f"{title} · 물체 배열", "markdown": "\n".join(k)})

    # ---- 4. 견본 배열 ----
    for m in ex:
        name = m["file"][len("verify-"):-len(".json")]
        mm = json.loads((bake / m["file"]).read_text())
        md = [f"# {title} — 견본 `{name}` {m['w']}×{m['h']}\n", head, "", show["descriptions"].get(name, ""), "",
              f"그림: `{name}.png`(이 용도의 그림). 아래는 그 그림을 만든 전체 배열이다(행 우선, 길이 {m['w']}×{m['h']}).", "",
              "```json", json.dumps({"width": mm["width"], "height": mm["height"], "lower": mm["lower"], "upper": mm["upper"]}), "```"]
        docs.append({"id": f"{theme}-ex-{name}", "name": f"견본 · {name}", "markdown": "\n".join(md)})

    cat = {"id": f"mk-{theme}", "name": f"{title} · 조립 안내",
           "description": f"{title} 시트로 장소를 까는 순서: 장소 문법·칠하는 법·칸 사전·물체 배열·견본 맵 {len(ex)}장(전체 배열 + 그림)·정상/오류 쌍 {len(neg_files)}개. 먼저 `{theme}-guide` 를 읽는다.",
             "documents": docs, "images": images}
    too_long = [x["id"] for x in docs if len(x["markdown"]) > 120_000]
    if too_long:
        raise SystemExit(f"참고문서가 120,000자를 넘는다: {too_long}")
    return cat
