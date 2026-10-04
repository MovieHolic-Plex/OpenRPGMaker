"""조선 번들 참고문서 7~9 용도의 본문(마크다운)·예제·사전 — newrefs.py 가 만든 변조 사례·지도 자료를 받아 문서와 그림을 쓴다."""
import collections
import json

from PIL import Image, ImageDraw


def canon(m):
    out = m & 15
    for bit, a, b in ((16, 1, 2), (32, 4, 2), (64, 4, 8), (128, 1, 8)):
        if (m & bit) and (m & a) and (m & b):
            out |= bit
    return out


def make_categories(x):
    c, M, GROUPS, SYM, SYM_KO, ROOM_KO = x["c"], x["M"], x["GROUPS"], x["SYM"], x["SYM_KO"], x["ROOM_KO"]
    FIELD_CAVE, INTERIOR, PALACE = x["FIELD_CAVE"], x["INTERIOR"], x["PALACE"]
    mdraw, walkable, reach, qa_images, qa_rows, tamper, members, cell_walk = (x[k] for k in ("mdraw", "walkable", "reach", "qa_images", "qa_rows", "tamper", "members", "cell_walk"))
    ROOT, DATA, TS, PW, KITS, STATS, TID, PFX, T, HEAD, WALKTXT = (c[k] for k in ("ROOT", "DATA", "TS", "PW", "KITS", "STATS", "TID", "PFX", "T", "HEAD", "WALKTXT"))
    NEW_PFX, NEW_AT, up, save, piece_docs, grid_image, array_text, ko, add_doc, tile = (c[k] for k in ("NEW_PFX", "NEW_AT", "up", "save", "piece_docs", "grid_image", "array_text", "ko", "add_doc", "tile"))
    OV = json.loads((DATA / "piece-walk-overrides.json").read_text())["terrain"]
    AT = {a["id"]: a for a in TS["autotileGroups"]}
    KIT_TILES = {n: [t for r in KITS[PFX + n]["rows"] for t in r["upperTiles"]] for n in PW}

    # ------------------------------------------------------------------ 공통 조각
    def reach_stats(mid):
        m = M[mid]
        w = walkable(m, m["lo"], m["up"])
        seen = reach(m, m["lo"], m["up"], m["start"])
        return len(w), len(seen)

    def piece_list(m):
        return collections.Counter(p["name"] for p in m["placed"])

    def sym_grid(m, x0, y0, x1, y1):
        rows, kinds = [], set()
        for y in range(y0, y1):
            row = ""
            for xx in range(x0, x1):
                k = m["kind"][y][xx] if 0 <= y < m["H"] and 0 <= xx < m["W"] else None
                if k is None:
                    row += " "
                else:
                    kinds.add(k)
                    row += SYM.get(k, "?")
            rows.append(row)
        legend = " · ".join(f"`{SYM.get(k, '?')}` {SYM_KO.get(k, k)}" for k in sorted(kinds, key=lambda k: SYM.get(k, "?")))
        return "\n".join(rows), legend

    def example(docs, images, mid, did, title, x0, y0, x1, y1, what, steps, zoom=2, group_note=""):
        m = M[mid]
        x1, y1 = min(x1, m["W"]), min(y1, m["H"])
        w, h = x1 - x0, y1 - y0
        im, lo, upv = mdraw(m, x0, y0, x1, y1)
        images.append(save(f"ex-{did}", up(im, zoom), f"조립 예제 「{title}」 맵 `{mid}` 칸 ({x0},{y0})~({x1 - 1},{y1 - 1}) {w}×{h} — 아래 두 배열을 그대로 찍은 완성 그림(원본 해상도의 {zoom}배, nearest)."))
        gk, legend = sym_grid(m, x0, y0, x1, y1)
        pcs = [p for p in m["placed"] if p["x"] < x1 and p["x"] + p["w"] > x0 and p["y"] < y1 and p["y"] + p["h"] > y0]
        plist = "\n".join(f"- `{p['name']}` {p['w']}×{p['h']} 왼쪽 위 ({p['x']},{p['y']})" for p in pcs[:70]) + (f"\n- … 외 {len(pcs) - 70}개" if len(pcs) > 70 else "")
        gw = reach_stats(mid)
        md = f"""# 조립 예제 — {title}

{HEAD}

{what}

## 입력 → 정답 배열 → 완성 그림
맵 id `{mid}`({m['name']}, {m['W']}×{m['H']}), 칸 ({x0},{y0}) 부터 {w}×{h}칸. 이 맵은 번들 시트로 만든 정본이고 {gw[1]}/{gw[0]} 걸을 수 있는 칸이 들어오는 칸 {m['start']} 에서 닿는다(엔진 canMove 너비 우선, `tiledata/joseon-village/storage-proof.json`).{group_note}

**아래층(lowerTiles)** — 땅·천장·바닥 칸 번호, 행 위→아래:
```
{array_text(lo, w)}
```
**윗층(upperTiles)** — 조각 그림 칸 번호(-1 = 비움):
```
{array_text(upv, w)}
```
**땅 종류**({legend}):
```
{gk}
```
**놓은 조각**(찍은 순서, 왼쪽 위 칸, 이 구획에 걸친 것):
{plist}

## 실행 순서
{steps}
"""
        add_doc(docs, f"ex-{did}", f"조립 예제 · {title}", md)

    def room_example(docs, images, mid, steps, what, zoom=3):
        m = M[mid]
        example(docs, images, mid, mid.replace("joseon_", "").replace("_", "-"), f"{ROOM_KO[mid]} 한 방(전체)", 0, 0, m["W"], m["H"], what, steps, zoom=zoom,
                group_note=f" 사람(NPC) {len(m['people'])}명, 문 {len(m['doors'])}곳({', '.join(sorted({d['piece'] + ':' + d.get('kind', '') for d in m['doors']}))}).")

    # ------------------------------------------------------------------ 지형 묶음 사전(공통)
    def terrain_rows(prefixes):
        rows = []
        for a in TS["autotileGroups"]:
            if not a["id"].startswith(prefixes):
                continue
            mem = a["memberTileIds"]
            n = len(a["connectTileIds"])
            kind = "블롭 47(깊이 변형 포함)" if len(mem) % 47 == 0 and len(mem) >= 47 else "마스크 16(변형)"
            rows.append(f"| `{a['id']}` | {a['name']} | {kind} | {mem[0]}~{mem[-1]} ({len(mem)}칸) | {'맵 밖 = 이어짐' if a.get('edgeConnects') else '맵 가장자리 = 가장자리 모양'} | {n}칸 |")
        return "\n".join(rows)

    def flat_rows(prefixes):
        rows = []
        for g in TS["tileGroups"]:
            if g["id"].startswith(prefixes) and g["defaultLayer"] == "lower" and "오토타일" not in g["name"]:
                rows.append(f"| `{g['id']}` | {g['name']} | {g['tileIds'][0]}~{g['tileIds'][-1]} ({len(g['tileIds'])}칸) |")
        return "\n".join(rows)

    def autotile_json(prefixes):
        out = []
        for a in TS["autotileGroups"]:
            if not a["id"].startswith(prefixes):
                continue
            mem = a["memberTileIds"]
            if len(mem) % 47 == 0 and len(mem) >= 47 and a["id"] not in ("jb_cav_roof47_autotile",) or a["id"] == "jb_cav_roof47_autotile":
                canons = sorted({canon(mk) for mk in range(256)})
                entry = {"id": a["id"], "name": a["name"], "kind": "blob47", "neighborhood": 8, "edgeConnects": bool(a.get("edgeConnects")),
                         "tileByCanonMask": {str(mk): a["variantMap"][str(mk)] for mk in canons}, "memberTileIds": f"{mem[0]}..{mem[-1]} ({len(mem)}칸: 47칸 × 변형 {len(mem) // 47})"}
            else:
                entry = {"id": a["id"], "name": a["name"], "kind": "mask16", "neighborhood": 8, "edgeConnects": bool(a.get("edgeConnects")),
                         "tileByMask(mask&15)": [a["variantMap"][str(mk)] for mk in range(16)], "memberTileIds": f"{mem[0]}..{mem[-1]} ({len(mem)}칸)"}
            out.append(entry)
        return out

    def terrain_images(prefixes, images):
        for a in TS["autotileGroups"]:
            if not a["id"].startswith(prefixes):
                continue
            if len(a["memberTileIds"]) % 47 == 0 and len(a["memberTileIds"]) >= 47:
                canons = sorted({canon(mk) for mk in range(256)})
                tl = [a["variantMap"][str(mk)] for mk in canons]
                images.append(save("at-" + a["id"].replace("jb_", "").replace("_autotile", ""), grid_image(tl, 8, [str(mk) for mk in canons], 2),
                                   f"`{a['id']}` ({a['name']}) 블롭 47종 — 위 글자 = 그 칸을 고르는 정규 마스크(canon). 둑·윤곽이 이웃에 따라 이어진다."))
            else:
                tl = [a["variantMap"][str(mk)] for mk in range(16)]
                images.append(save("at-" + a["id"].replace("jb_", "").replace("_autotile", ""), grid_image(tl, 8, [f"m{mk}" for mk in range(16)], 3),
                                   f"`{a['id']}` ({a['name']}) 마스크 16변형 — 위 글자 = 마스크(N=1 E=2 S=4 W=8, 이어진 방향의 합). m15 = 사방이 이어진 몸통, m0 = 외딴 한 칸."))

    def flat_images(gids, prefix, caption, images, cols=10, zoom=3):
        tiles, labels = [], []
        for gid in gids:
            g = GROUPS[gid]
            for k, t in enumerate(g["tileIds"]):
                tiles.append(t)
                labels.append(f"{gid.split(':')[1][:7]}{k}")
        images.append(save(prefix, grid_image(tiles, cols, labels, zoom), caption))

    def piece_sheet(names, bg, per_row_px=800, zoom=2):
        items = [(n, c["piece_image"](n, True, bg)) for n in names]
        xx = yy = rowh = 0
        pos = []
        for n, im in items:
            w, h = im.width * zoom + 6, im.height * zoom + 14
            if xx + w > per_row_px and xx > 0:
                xx = 0
                yy += rowh
                rowh = 0
            pos.append((xx, yy))
            xx += w
            rowh = max(rowh, h)
        out = Image.new("RGBA", (per_row_px, yy + rowh + 2), (46, 46, 54, 255))
        d = ImageDraw.Draw(out)
        for k, ((n, im), (px, py)) in enumerate(zip(items, pos)):
            d.text((px + 2, py + 1), str(k + 1), fill=(255, 255, 255, 255))      # 조각이 1칸 폭이라 이름 글자가 겹친다 — 번호를 쓰고 이름은 설명에 적는다
            out.alpha_composite(up(im, zoom), (px, py + 12))
        return out

    def piece_images(names, prefix, caption, bg, per_sheet=28):
        out = []
        for n0 in range(0, len(names), per_sheet):
            chunk = names[n0:n0 + per_sheet]
            zoom = 2 if max(KITS[PFX + n]["width"] for n in chunk) <= 6 else 1
            legend = ", ".join(f"{k + 1}={n}" for k, n in enumerate(chunk))
            out.append(save(f"{prefix}-{n0 // per_sheet + 1}", piece_sheet(chunk, bg, zoom=zoom),
                            f"{caption} {n0 // per_sheet + 1}. 칸 통행 색: 빨강 X 막힘 · 파랑 C 걸음★(사람 위) · 초록 F 걸음. 그림 위 번호 = 조각(kit id 는 `{PFX}` 를 붙인다): {legend}."[:3990]))
        return out

    def qa_doc(docs, group, title, intro, extra=""):
        rows = "\n".join(qa_rows[group])
        add_doc(docs, f"{group}-qa", title, f"""# {title}

{HEAD}

{intro}
아래 사례는 정본 지도를 **실제로 변조**해 만든 그림이고, 저작 검사(`newrefs.py` 의 `detect`)가 같은 좌표를 잡는다. 기록: `tiledata/joseon-village/qa-tamper-checks-new.json`.
정상 지도 11장은 마스크 불일치(알려진 칸)를 뺀 모든 코드가 **0 건**이다.

| 코드 | 맵 좌표 | 변조 | 검출 좌표(앞 3개) |
|---|---|---|---|
{rows}

## 코드 뜻
| 코드 | 뜻 | 고치는 법 |
|---|---|---|
| `door-unreachable` | 문 앞·출구 칸에 들어오는 칸에서 닿지 못한다 | 문 앞 3칸은 비운다. 소품·나무를 치운다 |
| `region-unreachable` | 걸을 수 있는 칸이 입구에서 닿지 못하는 섬이 된다 | 길목(복도·문 틈)에 막힘 조각을 놓지 않는다. 지도 어디도 갇힌 칸이 없다 |
| `entry-blocked` | 들어오는 칸 자체가 막혔다 | 출구 깔개 바로 북쪽 칸은 비운다 |
| `object-tile-in-lower-layer` | 조각 그림 칸이 아래층(lowerTiles)에 칠해졌다 | 조각은 `stamp_object` 로 윗층에 찍는다 |
| `autotile-mask-mismatch` | 오토타일 칸 번호가 이웃 8칸이 정하는 변형과 다르다 | 손으로 번호를 고르지 않고 칠하는 도구(fill_region·lay_path)로 다시 칠한다 |
| `wall-missing-under-ceiling` | 천장(어둠) 바로 아래 칸에 벽(앞면)이 없다 | 천장 밑 두 줄은 벽 조각(실내·궁) 또는 앞면 두 줄(동굴)이다 |
| `same-prop-three-in-row` | 같은 기물 그림 셋이 일렬이다 | 기물은 서로 다른 변형으로, 용도 곁에 묶어 놓는다 |
| `aisle-blocked` | 입구에서 어좌 단 계단까지 카펫(어도)만 밟아 가는 길이 끊겼다 | 어도 위에는 아무것도 놓지 않는다 |

## 검사가 주장하는 것·주장하지 않는 것 (item 7)
이 검사는 **구조와 통행**만이다(칸 번호가 정답 배열과 같은가, 엔진 규칙으로 닿는가, 위 코드). 이벤트 실행(문 이동·대화), 미적 품질(자연스러움·밀도), 저가 모델 성공률은 구조 검사 통과로 대신 주장하지 않는다.
저장 전에 위 검사가 실패하면 부분 배치를 남기지 않는다(도구가 되돌린다).
{extra}
## 기존 문서·칸 메타의 레이어 정정 (item 8)
이 용도의 조각·지형은 신규다 — 정정할 이전 문서·before/after 가 없다. 칸 메타(`tileMeta`)는 처음부터 투명 여부·홈 레이어(`defaultLayer`)·통행(`passage`)·렌더 우선순위(`priority`)를 따로 적는다: 조각 칸은 `upper`, X=`solid`/C=`star`/F=`passable`, 땅·천장 칸은 `lower`.
""")

    cats = []
    NM = {mid: M[mid] for mid in M}
    wf, rf = reach_stats("joseon_field"), reach_stats("joseon_cave")

    # ================================================================== 7. 사냥터·동굴
    docs, images = [], []
    mf, mc = M["joseon_field"], M["joseon_cave"]
    zones = mf["ex"].get("spawnZones", {})
    n_spawn_f, n_spawn_c = len(mf["ex"].get("spawns", [])), len(mc["ex"].get("spawns", []))
    guide = f"""# 사냥터·동굴 — 한 장 조립 (읽는 순서 · 작업 순서 · 규칙)

{HEAD}

몬스터가 배회하는 **사냥터 `joseon_field`(96×96)** 와 그 서쪽 바위산 굴로 이어지는 **동굴 `joseon_cave`(48×48)** 를 짓는 문서다. 두 정본 맵은 이 시트의 조각·지형으로 만든 **한 가지 예시이지 정답 좌표가 아니다**.
같은 재료로 다른 사냥터·동굴을 짓는 것이 목적이다. 계열은 `{TS['family']}` — 버들항·숲마을 칸 번호와 섞지 않는다. 마을·국내성 조각(소나무 `pine_*`·성벽 `fort_wall_*`·갈대 `reeds` 등)은 같은 시트에서 그대로 함께 쓴다(사냥터 맵이 실제로 쓴다).
조각은 접두 `fld_`(사냥터) · `cav_`(동굴)이고 지형 묶음 이름도 같다(`fld_trail32` · `cav_roof47` …).

## 읽는 순서
1. 이 문서 → 「지형 묶음 사전」(오토타일 마스크·변형·전체 배열) → 「조각 사전」(칸 배열·통행) → 「조립 예제」(구획별 아래·윗층 전체 배열 + 완성 그림) → 「오류 교훈」.
2. 마을 규칙(한 장 조립 용도의 「읽는 순서·통행 기호 X/C/F·문/디딤돌/접근칸」)은 그대로 적용된다.

## 사냥터 구역 계획 (정본 맵의 실측)
빈 바닥을 물체로 메우지 않는다. **구역마다 용도·앵커·동선을 먼저 정하고** 그대로만 깐다(공간이 남으면 맵이 너무 큰 것 — 땅 질감(키 큰 풀·숲 바닥·짐승길)을 달리 깔고, 그래도 남으면 줄인다). 좌표는 칸, 끝 포함.
| 구역 | 범위 | 용도 | 앵커 |
|---|---|---|---|
| Z1 어귀 | 문루 통로 석판 x47..48 y0..8 · 큰길 흙길 x46..49 y9..16 · 마당 x42..53 y17..22 | 국내성 남문에서 나와 사냥 채비를 갖추는 곳 | 북쪽 가장자리 성벽(y4..8) + 문루 `fort_gate`(10×9, x43..52) · 장승 한 쌍(x44·x51, y17) · 이정표 |
| Z2 중앙 초원 | x26..66 y24..60 | 초식·소형 몬스터가 배회하는 열린 사냥터 | 키 큰 풀 덩이 · 짐승길 그물 · 바위·들꽃·뼈·짐승굴(자리마다 이유: 굴 = 스폰, 뼈 = 위험 표지) |
| Z3 동쪽 숲 | x68..95 y8..64 | 나무 많고 시야가 막힌 숲 | 숲 바닥(낙엽) 군락 · 가운데 나무꾼 쉼터(천막·모닥불·통나무) |
| Z4 서쪽 바위산 | 3단 비대칭 덩이 x2..26 y26..45(앞면 2줄이 단마다: y30..31·y36..37·맨 아래 y44..45) | 동굴 사냥터로 가는 산(막힘) | 굴 입구 3(홍예 `fld_cave_a`(6,43) 5×3 · 갱도 `fld_cave_b`(13,43) 4×3 · 짐승굴 `fld_cave_c`(19,43) 3×3) · 앞마당 y46..49 · 광석 노두 |
| Z5 남쪽 야영지 | 마당 x38..58 y64..80 | 사냥꾼 야영 | 모닥불 · 천막 둘 · 건조대 · 통나무 의자 |
| Z6 폐허·무덤 | x8..30 y62..88 | 오래된 폐허 석탑과 무덤(언데드 스폰) | 폐허 석탑 · 무덤 4기 · 묘비 · 고목 |
| Z7 늪 | x64..92 y74..92 | 늪지 몬스터 | 늪 못(블롭) · 늪가 길 · 갈대 |
| Z8 남쪽 숲띠·출구 | y86..95 전폭 | 지도 가장자리 막이 + 다음 필드 출구 x47..48 y95 | 이정표 · 나무 줄 |
동선: 어귀 마당 → (서) 짐승길 → 바위산 앞마당 → 굴 셋 / (동) 짐승길 → 숲 쉼터 / (남) 짐승길 → 초원 가운데를 지나 야영지 → (서) 폐허 / (동) 늪가 → 남쪽 출구.
정본 맵 실측: 걸을 수 있는 칸 {wf[0]}, 시작 칸 {tuple(mf['start'])}(북쪽 출구)에서 **{wf[1]}칸 모두 도달**(갇힌 칸 0). 굴 입구 문 앞 칸 {len(mf['doors'])}곳·주민 {len(mf['people'])}명·출구 {len(mf['exits'])}곳 모두 닿는다.

## 사냥터 작업 순서
1. **맵 가장자리 막이**: 북쪽 가장자리 = 성 뒷벽(바닥 종류 `cityback`, y0..8, 속 8변형 `fld_rock_in8` 을 섞어 깖) 위에 성벽 조각 `fort_wall_h/_h1/_h2`(4×5) 줄(y4..8)과 가운데 문루 `fort_gate`(10×9, 왼쪽 위 (43,0), 통로 2칸 x47..48 = 석판) — 국내성 남문이다. 남쪽은 나무 줄 숲띠, 출구 칸(x47..48 y95)만 남긴다.
2. **땅**: 기본은 풀 8변형(`jb:grass8` 평면 섞어 깔기). 그 위에 키 큰 풀(`fld_tall32` 오토타일)을 **불규칙 군집**으로(직사각 도장 금지), 숲 바닥(`fld_forest32`)을 숲 군락 아래에, 늪(`fld_bog94` 블롭)을 못 모양으로, 바위산 윗면(`fld_rock32` 오토타일 + 속 `fld_rock_in8`)과 앞면 2줄(`fld_face32` 윗줄·아랫줄, 막힘).
3. **길**: 큰길은 `road64`(폭 4, y9..16)·마당 `yard64`(y17..22)로, 마당 아래부터는 **짐승길 `fld_trail32`**(폭 1~2, 흙길·마당·석판과 이어짐)로 갈라진다. 길은 **직선 + 모서리**로 꺾고 한 칸씩 어긋나는 계단·톱니를 만들지 않는다. 모든 길은 목적지(굴·쉼터·야영지·표지·마당)로 이어지고 **막다른 끝에는 목적지**가 있다.
4. **앵커**: 굴 입구 3개는 바위산 맨 아래 앞면(y44..45)에 겹쳐 `fld_cave_*`(3행, 왼쪽 위 y43)를 찍고, 맨 아래 줄(y45)의 걷는 칸이 통로, 그 아래 y46 한 줄이 문 앞 접근칸(extra `doors`)이다. 앞마당(y46..49)을 3줄 이상 비운다. 야영지(천막 `fld_tent_*`·모닥불 `fld_campfire`·건조대 `fld_rack`), 폐허(`fld_ruin_pagoda`·`fld_grave_*`·`fld_tombstone`), 쉼터(통나무 `fld_log_*`·그루터기).
5. **숲·바위·소품**: 나무는 군락으로(`fld_pine_a..d`·`fld_zelkova_a..d` + 마을 나무), **같은 종 3개 일렬·균등 간격·같은 줄 금지**, 바위 `fld_rock_s/m/l_*`·`fld_boulder_mass`는 변형을 섞는다. 풀·들꽃·고사리(`fld_flowers_*`·`fld_fern`)·뼈(`fld_bones_*`)는 자리마다 이유(짐승 흔적·덫·위험 표지)를 둔다.
6. **스폰 자리 기록**: 몬스터는 칸에 그리지 않는다. 스폰은 `extra.spawns`(좌표 + zone)로 남긴다 — 정본 맵 {n_spawn_f}곳, 구역 {dict(zones)}. 게임에서 몬스터 출현을 배선할 때 이 좌표를 읽는다.
7. **검사**: 모든 걸을 칸이 시작 칸에서 닿는가 · 굴 입구 앞 걸을 칸 · 같은 소품 3개 일렬 · 10×10 칸 전체가 평범한 바닥인 빈 광장 금지 · 오토타일 마스크 대 엔진 · 출구 칸 도달.

## 동굴 규칙 (3단 구조)
**방·복도(걸을 칸 집합)만 정하면 벽은 규칙으로 나온다**: 걸을 칸 바로 위의 비(非)바닥 칸 = 앞면 **아랫줄**(`cav_face24`), 그 위 = 앞면 **윗줄**(`cav_face24`), 그 위 = **천장**(`cav_roof47`, 이웃 8칸 블롭). 바닥은 `cav_floor`, 북·서쪽이 벽이면 그림자 변형 `cav_floor_sh`.
- 천장(윗면 암반 질감 + 림) → 벽 앞면 2줄 → 바닥 그림자의 **3단**이 항상 이어져야 한다. 1칸 폭 널판·한 칸씩 어긋난 단차·톱니 계단 금지(윤곽은 둥글고 불규칙하게). 검출: `wall-missing-under-ceiling`.
- 바닥은 어느 쪽으로도 **암반 여백 4칸** 이상 안쪽, 입구만 아래 가장자리로 뚫린다. 입구 문턱 햇빛 바닥(`cav_floor_lit`) 6칸 폭.
- 방마다 **용도(앵커)** 하나: 입구 방(화로 기둥 한 쌍 + 햇빛 문턱) · 광장(지하 못 + 석주 + 횃불) · 서방 = 광산(수레·광석·수정) · 동방 = 짐승 소굴(뼈 둥지·해골) · 북쪽 보물방(보물 상자 단상) · 동남 막다른 수정 굴. 고리(입구 → 서방 → 광장, 입구 → 동방 → 광장)로 막다른 길이 없고, 막다른 곳은 목적(보물방·수정 굴)뿐이다.
- 소품: 석순 `cav_stalagmite*`·수정 `cav_crystal*`·버섯·바위·잔해·이끼는 벽에 붙이거나 군집으로, 복도 길목에는 두지 않는다. 같은 소품을 복제해 줄 세우지 않는다(변형을 섞는다). 대리석 기둥 금지(암석 기둥).
정본 동굴 실측: 걸을 수 있는 칸 {rf[0]}, 입구 칸 {tuple(mc['start'])}에서 **{rf[1]}칸 모두 도달**. 출구는 아래 가장자리 x21..26 y47(→ `joseon_field` 굴 입구), 스폰 {n_spawn_c}곳(박쥐·거미 등 `kind`).

## 반복할 수 있는 조각 · 고정 조각
| 반복 | 고정 |
|---|---|
| 땅 평면 변형(풀 8·숲 바닥·바위 속 8·동굴 바닥 10·그림자 40): 섞어 깐다 | 굴 입구 `fld_cave_a/b/c`(자리마다 하나) · 폐허 석탑 · 보물 상자 단상 · 광산 수레 · 뼈 둥지 |
| 오토타일(짐승길·키 큰 풀·숲 바닥·늪·바위산·동굴 천장·지하 못): 칠한 모양대로 | 모닥불·천막·건조대 세트(야영지 하나에 한 벌) |
| 바위·들꽃·고사리·뼈·수정·석순·이끼(변형을 섞어 군집으로) | 장승·이정표 |

## 문 · 출구 · 접근칸 · 이벤트 (섞지 않는다)
- **굴 입구 그림**(`fld_cave_*` 3행): 바위산 앞면에 박힌 입구 — 몸채는 막힘(`X`)이고 **맨 아래 줄의 가운데 칸이 걷는 통로(F)** 다(홍예 `XXFXX` · 갱도 `XFFX` · 짐승굴 `XFX`). **조각 바로 아래 한 칸(y46)이 문 앞 접근칸**이다(extra `doors`, 정본 {len(mf['doors'])}칸 — 통로 칸 y45 는 `exits` 에 기록).
- **출구**(`extra.exits`): `to` 가 목적 지도, 칸/줄 좌표가 지도 가장자리·굴 입구 문 앞이다. **이것은 기록이지 이벤트가 아니다.** 지도 이동 이벤트는 저작자가 출구 칸에 따로 심고 도착 칸을 정한다(이 번들 맵에는 이벤트가 없다).
- **스폰**(`extra.spawns`): 몬스터가 나타날 자리의 좌표 기록. 스프라이트가 아니다.
- **들어오는 칸**(`start`): 사냥터는 북쪽 큰길 끝 (47,0), 동굴은 입구 문턱 (23,47).

## 통행·구조 검사의 범위 (item 7)
저장 스크립트(`scripts/content/save-joseon-baram.mjs`)가 **구조·통행만** 센다: 엔진 `isPassable` 대 구운 정답 불일치 0, 들어오는 칸에서 걸을 수 있는 칸 전부(사냥터 {wf[0]}·동굴 {rf[0]}) 도달, 문 앞·출구 칸 도달, 오토타일 마스크 대 엔진(알려진 사냥터 바위산 110칸 제외). 이벤트 실행·몬스터 배치 품질·미적 품질은 이 검사로 주장하지 않는다.

## 금지
- 정본 맵을 그대로 옮겨 깔지 않는다(요청이 「다른 사냥터」이면 실패). 칸 번호를 추측해 한 칸씩 칠하지 않는다(재료 이름·조각 키트로).
- 몬스터·캐릭터를 칸 그림으로 그리지 않는다(스폰 좌표만). 길 끝에 목적지 없이 풀밭에서 끝내지 않는다. 같은 조각을 3개 일렬로 두지 않는다.
- 조각 윗부분 칸을 아래층에 칠하지 않는다(오류 교훈).
"""
    add_doc(docs, "fc-guide", "사냥터·동굴 · 한 장 조립 · 읽는 순서", guide)
    FC_AT = ("jb_fld_", "jb_cav_")
    FC_GR = ("jb:fld_", "jb:cav_")
    terr_md = f"""# 사냥터·동굴 지형 묶음 사전 — 오토타일(마스크·변형)과 평면 묶음

{HEAD}

## 비트 정의 (엔진 `AUTOTILE_DIR` 와 같다)
`N=1 E=2 S=4 W=8 NE=16 SE=32 SW=64 NW=128`, 값 = **그 방향 이웃이 같은 재료(이어짐)**. 모든 묶음은 `neighborhood: 8`, `variantMap`(마스크 0~255 → 칸 번호).
- **마스크 16**: 하위 4비트(`mask & 15`)로 정한다. 칸 번호 = 묶음 첫 칸 + (mask & 15), 변형이 여러 벌이면 16칸씩 이어 붙고 엔진은 변형 0 을 고른다(나머지는 같은 모양의 다른 무늬).
- **블롭 47**: 대각 비트는 양쪽 변이 모두 이어질 때만 의미가 있다(`canon(m)` = 하위 4비트 + 양쪽 변이 모두 켜진 대각 비트). 서로 다른 값 47종, 칸 번호 = 묶음 첫 칸 + 정규 마스크 오름차순 순번(아래 JSON 의 `tileByCanonMask` 가 전체 사전).
- 맵 가장자리 밖: `edgeConnects: true` 면 이어진 것으로, 아니면 가장자리 모양이 붙는다.

## 오토타일 그룹 표
| 그룹 id | 이름 | 종류 | 멤버 칸 번호 | 맵 가장자리 | 이웃으로 세는 칸 |
|---|---|---|---|---|---|
{terrain_rows(FC_AT)}

평면 바닥(오토타일 아님, 여러 변형을 섞어 깐다):
| 묶음 | 이름 | 칸 |
|---|---|---|
{flat_rows(FC_GR)}

## 재료별 규칙 (정본 맵 실측)
- **짐승길 `fld_trail32`**(마스크 16 × 변형 2, 걸음): 폭 1~2칸. 이웃으로 `road64`·`yard64`·석판(`slab`, `slab_edge16`)도 센다 → 큰길·마당과 끊김 없이 이어진다. 맵 가장자리는 **끝막음**(출구 칸의 길도 가장자리 모양). 직선 + 모서리로 꺾는다.
- **키 큰 풀·억새 `fld_tall32`**(마스크 16, 걸음): 이삭 덩이. 불규칙 군집으로 깔고 가장자리 전이 모양은 오토타일이 만든다(직사각 도장 금지). 맵 밖은 이어짐.
- **숲 바닥 `fld_forest32`**(마스크 16, 걸음): 낙엽 숲 바닥. 숲 군락 아래에만, 맵 밖은 이어짐.
- **늪 `fld_bog94`**(블롭 47 × 2, **막힘** role water): 못 윤곽. 기슭에 갈대(`reeds`)·바위를 띠로 둔다.
- **바위산 `fld_rock32`**(마스크 16, **막힘**) + 속 8변형 `fld_rock_in8`(몸통 대용, 같은 칸으로 봄) + **앞면 `fld_face32`**(2단 줄: 윗줄 `tface0`·아랫줄 `tface1`, 막힘): 산 윗면은 오토타일, 남쪽 면에 앞면 두 줄이 붙는다. 굴 입구 조각은 앞면 줄 위에 찍는다. 정본에서 성 뒷벽(맨 위 9줄)은 속 8변형으로 통째 구웠다(알려진 마스크 불일치 110칸).
- **동굴 바닥 `cav_floor`(평면 10) · `cav_floor_sh`(벽 그림자 40) · `cav_floor_lit`(입구 햇빛 8)**: 걸음. 그림자 변형은 북·서쪽이 벽인 칸에 붙는다.
- **동굴 천장 `cav_roof47`**(블롭 47 × 10: 이웃 8칸으로 윤곽, 깊이·이끼·광맥 변형 10벌, **막힘**) + **벽 앞면 `cav_face24`**(평면 24, 막힘, 횃불이 걸린다). 천장 가장자리는 맵 밖을 이어진 것으로 본다.
- **지하 못 `cav_pool94`**(블롭 47 × 2, 막힘): 광장의 샘.
- 마을 흙길·마당·석판·풀(`road64`·`yard64`·`slab_edge16`·`grass8`)도 사냥터에서 그대로 쓴다.

## 전체 사전 (JSON — 마스크 → 칸 번호)
```json
{json.dumps(autotile_json(FC_AT), ensure_ascii=False, separators=(',', ':'))}
```
"""
    add_doc(docs, "fc-terrain", "사냥터·동굴 · 지형 묶음 사전(오토타일 마스크·전체 배열)", terr_md)
    terrain_images(FC_AT, images)
    flat_images(["jb:fld_face32", "jb:fld_rock_in8"], "fc-flat-rock", "사냥터 바위산 앞면 `fld_face32`(윗줄 `tface0`·아랫줄 `tface1` 한 쌍씩 변형) 와 속 8변형 `fld_rock_in8` — 칸 번호 순서 그대로.", images, cols=12)
    flat_images(["jb:cav_floor", "jb:cav_floor_sh", "jb:cav_floor_lit", "jb:cav_face24"], "fc-flat-cave", "동굴 평면 묶음 — `cav_floor`·`cav_floor_sh`(벽 그림자)·`cav_floor_lit`(입구 햇빛)·`cav_face24`(벽 앞면) 칸 번호 순서 그대로.", images, cols=14, zoom=2)
    fcn = sorted([n for n in PW if n.startswith(("fld_", "cav_"))], key=lambda n: (n.startswith("cav_"), PW[n]["cls"] != "tree", n))
    docs += piece_docs(fcn, "fc-pieces", "사냥터·동굴 조각 사전", "사냥터(`fld_*`: 굴 입구·천막·모닥불·건조대·폐허·무덤·바위·들꽃·뼈·고목·소나무·느티나무)와 동굴(`cav_*`: 화로·석순·수정·상자 단상·수레·둥지·횃불·버섯·이끼·웅덩이) 조각. 나무는 수관 `C`·줄기 `X`, 소품은 단단한 칸 `X`.", per_doc=22)
    images += piece_images(fcn, "fc-pieces", "사냥터·동굴 조각 통행 그림", (88, 120, 70, 255))
    # 조립 예제: 사냥터 6구역 + 동굴 3구역
    ex_f = [
        ("field-gate", "어귀(성문·큰길·마당·장승)", 36, 0, 62, 26, "국내성 남문(북쪽 가장자리 성벽 2줄 + 문루)에서 큰길이 내려와 마당에서 갈라지는 어귀. 길은 위쪽 석판·아래 흙길, 마당 양쪽에 장승 한 쌍.",
         "1. 성 뒷벽(`fld_rock_in8` 속 변형)을 y0..8 전폭에 깔고, 그 위에 성벽 조각 `fort_wall_h/_h1/_h2`(4×5)를 y4..8 에 번갈아 이어 붙이고, 가운데에 문루 `fort_gate`(10×9, 왼쪽 위 (43,0), 통로 x47..48).\n2. 문루 통로 석판(`slab`) x47..48 y0..8, 큰길 `road64` x46..49 y9..16, 마당 `yard64` x42..53 y17..22.\n3. 장승 한 쌍(x44·x51, y17), 흙길 양옆 낮은 나무 줄(간격 불규칙).\n4. 검사: 출구 칸 (47,0)·(48,0) 이 시작 칸."),
        ("field-mountain", "바위산과 굴 입구 셋", 0, 24, 36, 52, "서쪽 바위산: 윗면(`fld_rock32` + 속 8변형)은 막힘, 남쪽 앞면 2줄(`fld_face32`) 위에 굴 입구 `fld_cave_a`(홍예 5폭)·`fld_cave_b`(갱도 4폭)·`fld_cave_c`(짐승굴 3폭), 아래 한 줄이 문 앞 접근칸, 그 아래 앞마당.",
         "1. 윗면: `fld_rock32` 오토타일로 산 윤곽(3단 비대칭 덩이)을 칠하고 안쪽에 속 변형 `fld_rock_in8` 을 섞는다.\n2. 앞면 2줄: `fld_face32` 를 산 단마다(y30..31·y36..37·맨 아래 y44..45) 윗줄·아랫줄로.\n3. 굴 입구 조각을 맨 아래 앞면에 겹쳐 찍는다(`fld_cave_a`(6,43)·`fld_cave_b`(13,43)·`fld_cave_c`(19,43), 맨 아래 줄 y45 의 걷는 칸이 통로, 문 앞 접근칸 = 조각 바로 아래 y46).\n4. 앞마당 y46..49 를 `yard64`/`fld_trail32` 로 이어 짐승길로 중앙 초원과 잇는다. 광석 노두·돌탑을 곁들인다."),
        ("field-camp", "남쪽 야영지(모닥불·천막·건조대)", 34, 62, 62, 84, "큰길 남쪽 끝 마당의 사냥꾼 야영: 모닥불을 가운데에 두고 천막 둘, 건조대, 통나무 의자. 마당은 불규칙 가장자리, 초원에서 짐승길 하나로 닿는다.",
         "1. 마당 `yard64` 를 불규칙 윤곽으로(직각 계단 금지). 2. 모닥불 `fld_campfire` 가운데, 천막 `fld_tent_a/b` 둘을 흙 안쪽에, 건조대 `fld_rack`, 통나무 `fld_log_a/b`·그루터기.\n3. 마당 둘레에 나무 군락. 4. 검사: 마당 어디든 짐승길로 시작 칸에서 닿는다."),
        ("field-ruin", "폐허 석탑과 무덤", 0, 62, 30, 92, "서남쪽 으스스한 구역: 숲 바닥(`fld_forest32`)을 깔고 무덤(`fld_grave_a/b`) 4기·묘비·고목을 불규칙하게, 폐허 석탑(`fld_ruin_pagoda`)이 정체성이다.",
         "1. 어두운 숲 바닥 군락. 2. 무덤은 조선식 봉분 변형 둘을 섞어 십자·격자가 되지 않게. 3. 고목 `fld_dead_a/b`·묘비·키 큰 풀. 4. 짐승길이 구역 안 목적(무덤)에서 끝난다."),
        ("field-swamp", "늪 못과 갈대", 58, 70, 96, 96, "남동쪽 늪: 블롭 윤곽의 못(`fld_bog94`, 막힘)과 늪가 길, 기슭의 갈대(`reeds`)·바위, 마을 나무로 숲띠.",
         "1. 못 윤곽을 `fld_bog94` 로 칠한다(오토타일이 둑을 맞춘다). 2. 늪가 짐승길을 못 둘레에 한 줄. 3. 갈대·바위는 물가 한 칸 안쪽에 띠로. 4. 출구 x47..48 y95 는 남쪽 가장자리."),
        ("field-rest", "나무꾼 쉼터(숲 복판)", 64, 26, 96, 52, "동쪽 숲 한가운데 나무꾼 쉼터: 숲 바닥 군락 안에 마당, 천막·모닥불·통나무. 큰길에서 짐승길 하나가 닿는다.",
         "1. 숲 바닥 `fld_forest32` 군락을 직사각이 아닌 윤곽으로. 2. 쉼터 마당 + 천막 둘 + 모닥불 + 장작·통나무. 3. 가장자리 고목·큰 나무로 시야를 가린다. 4. 짐승길이 쉼터에서 끝난다(목적지)."),
    ]
    for did, title, x0, y0, x1, y1, what, steps in ex_f:
        example(docs, images, "joseon_field", did, title, x0, y0, x1, y1, what, steps, zoom=2)
    ex_c = [
        ("cave-entrance", "입구 방과 햇빛 문턱", 12, 34, 36, 48, "동굴 입구 방: 화로 기둥 한 쌍, 아래 가장자리로 뚫린 햇빛 문턱 6칸(`cav_floor_lit`, 양쪽은 암벽 문설주). 위로 좁은 복도가 광장으로 올라간다.",
         "1. 방 윤곽(둥글고 불규칙)만 걸을 칸으로 정하면 벽은 규칙으로 나온다: 바닥 위 비바닥 칸 = 앞면 아랫줄, 그 위 = 앞면 윗줄, 그 위 = `cav_roof47` 천장.\n2. 바닥 `cav_floor`, 북·서쪽이 벽인 칸은 `cav_floor_sh`, 문턱은 `cav_floor_lit`. 3. 벽 앞면에 횃불 `cav_torch_a/b`, 방 가운데 화로 `cav_brazier` 한 쌍.\n4. 검사: 문턱 x21..26 y47 이 시작 칸(23,47)."),
        ("cave-plaza", "광장(못·석순·횃불)", 8, 12, 40, 34, "동굴의 큰 광장: 지하 못(`cav_pool94`)과 석순·수정 군집, 벽에 횃불. 서쪽·동쪽 곁방과 복도로 이어지는 고리의 중심이다.",
         "1. 방·복도 걸을 칸 집합을 정한다(광장은 북서쪽이 불룩한 둥근 윤곽). 2. 못은 `cav_pool94` 블롭(막힘) — 둘레는 걷는 바닥.\n3. 석순 `cav_stalagmite*`·수정 `cav_crystal*`·버섯·바위는 군집으로, 복도 길목에는 두지 않는다. 4. 곁방 문 앞 복도는 폭 2~3칸."),
        ("cave-treasure", "보물방(상자 단상)", 14, 0, 34, 16, "광장 북쪽 막다른 보물방: 상자 단상(`cav_chest_dais`)이 앵커. 막다른 길은 목적이 있는 이 방과 동남 수정 굴뿐이다.",
         "1. 광장에서 위로 폭 3칸 복도(`TR`) → 방 윤곽. 2. 방 북쪽 벽 앞면에 횃불, 가운데 `cav_chest_dais`(3×2, 막힘). 3. 상자 앞 한 줄은 비운다(사용 칸)."),
    ]
    for did, title, x0, y0, x1, y1, what, steps in ex_c:
        example(docs, images, "joseon_cave", did, title, x0, y0, x1, y1, what, steps, zoom=2)
    qa_doc(docs, "fc", "사냥터·동굴 · 오류 교훈(실제 변조 그림 + 검출 코드·좌표)", "굴 입구 막힘·동굴 길목 끊김·수관 아래층·늪 둑 반대·같은 바위 일렬·동굴 벽 앞면 누락을 사냥터·동굴 정본에 실제로 넣고 검출했다.")
    images += qa_images["fc"]
    cats.append(dict(id="joseon-baram-field-cave", name="조선 · 사냥터·동굴 지형(지형 묶음 사전·조립 예제·오류 교훈)",
                     description=f"사냥터(96×96)와 동굴(48×48): 구역 계획·작업 순서·규칙(길은 직선+모서리, 막다른 끝엔 목적지, 일렬 금지, 동굴 천장 3단), 오토타일 마스크·전체 배열 사전, 조각 {len(fcn)}종, 구획별 조립 예제 {len(ex_f) + len(ex_c)}개(아래·윗층 전체 배열 + 완성 그림), 오류 교훈(실제 변조·검출 좌표).",
                     documents=docs, images=images))

    # ================================================================== 8. 조선 실내 키트
    docs, images = [], []
    inb = sorted([n for n in PW if n.startswith("in_b_")])
    struct_names = [n for n in inb if n.startswith(("in_b_wall", "in_b_win", "in_b_door", "in_b_pillar", "in_b_beam", "in_b_stair", "in_b_ladder", "in_b_dais", "in_b_exit"))]
    furn_names = [n for n in inb if n not in struct_names]
    rooms = [M[mid] for mid in INTERIOR]
    room_rows = "\n".join(f"| `{m['id']}` | {ROOM_KO[m['id']]} | {m['W']}×{m['H']} | {reach_stats(m['id'])[0]} | 출입구 {m['start']} 앞 · 문 {len(m['doors'])}곳 | 사람 {len(m['people'])}명 |" for m in rooms)
    guide = f"""# 조선 실내 키트 — 방 조립법 (읽는 순서 · 벽·바닥·문·가구 · 입구와 동선)

{HEAD}

조선(바람의나라풍) 집 안쪽 방을 짓는 키트다. 정본 방 6장(민가·주막·대장간·약방·서당·관아 동헌)은 이 시트의 조각 접두 `in_b_`(실내 키트 {len(inb)}종) 와 바닥·천장 지형으로 만든 **한 가지 예시이지 정답 좌표가 아니다**.
방의 평면(어디가 바닥이고 어디가 천장·어둠인가)만 정하면 벽면·그늘·천장 띠가 **규칙으로 나온다** — 손으로 한 칸씩 벽을 칠하지 않는다. 궁 안쪽(정전·회랑·침전)은 이 키트에 `pal_` 조각을 덧붙인 용도 「궁 내부」를 본다.
계열 `{TS['family']}`. 집 바깥(마을·국내성) 조각은 한 장 조립 용도를 본다 — 집 문 앞 접근칸·디딤돌에 문 이동 이벤트를 심으면 이 방으로 들어온다.

## 읽는 순서
1. 이 문서 → 「바닥·천장 지형 사전」 → 「구조 조각 사전(벽·문·기둥·보·단)」 → 「기물 사전」 → 「조립 예제」(방 6장 전체 아래·윗층 배열 + 완성 그림) → 「오류 교훈」.

## 방 조립 순서 (정본 6방 공통)
1. **평면**: 바닥 칸(걷는 칸)과 천장·어둠 칸(`void`)을 정한다. 방은 목적으로 깐다 — **공간이 남으면 방이 너무 큰 것이라 줄인다**(맨바닥 판 < 10칸). 정본 크기: 15×11 ~ 22×14.
2. **천장 띠**(아래층): 바닥이 아닌 칸 전부 `in_b_ceil47`(블롭 47, **막힘**, 가장자리는 맵 밖도 이어짐). 방 둘레와 방 사이 칸막이 안쪽이 천장 덩어리다.
3. **바닥**(아래층): 방 용도로 고른다 — 온돌 장판 `in_b_ondol`(안방·침소) · 마루 `in_b_maru`(마루·대청·술청) · 흙바닥 `in_b_dirt`(부엌·작업장) · 돌바닥 `in_b_stone`(관아 박석 대청). 같은 바닥 평면 변형을 **무작위로 섞는다**(이음 없는 변형이 대부분). 벽 바로 아래 줄에는 **그늘 변형**(`*_sh`: 위·왼쪽·위+왼쪽 3종)을 붙인다.
4. **벽면 2줄**(윗층): **천장 바로 아래 걷는 칸 두 줄은 벽 조각**이다(천장 밑 벽 규칙) — 1×2 벽 조각 `in_b_wall_{{hoe 회벽·mok 목재·heuk 흙벽·dol 돌·changho 창호}}_{{l·m·r·lr}}`(왼끝·가운데·오른끝·양끝 외톨이)을 이어 붙인다. 벽 재질은 방 용도(부엌 = 황토·회벽, 마루 = 창호, 대장간 = 돌, 약방 = 목재). 창 `in_b_win_*`·문틀 `in_b_doorway_*` 는 벽면을 대신해 박는다. 검출: `wall-missing-under-ceiling`.
5. **입구**: 남쪽 벽 틈 한 칸 = **출구 깔개 `in_b_exit_mat`**(걸음 F), 그 한 칸 북쪽 = **들어오는 칸**(extra `entry`/`start`). 입구 앞 3×3 과 출구 깔개는 비운다. 방 사이 문은 막힌 칸 사이 틈 **3줄**(벽면 2 + 걷는 줄 1)이라 걷는 줄은 한 칸 — 문 조각(`in_b_door_*`·문틀)을 박는다.
6. **기물**: 용도 앵커(부뚜막·약장·모루·교자상·서안 …)를 먼저, 곁들이를 나중에. 벽걸이(`in_b_hang_*`·족자 `in_b_jokja_*`)는 벽면 윗줄에만. 깔개(`in_b_mat_*`·이부자리·방석)는 아래에 깔고 위에 가구를 얹는다(겹침 칸으로 합쳐 구움). **사용 칸**(앞 한 칸)을 비운다.
7. **검사**: 아래 규칙 C1~C8 + 들어오는 칸에서 모든 걸을 칸 도달.

## 규칙 (C1~C8 — 빌더가 단언하는 값)
| 코드 | 규칙 | 검출 |
|---|---|---|
| C1 | 구조: 천장 밑 두 줄은 벽 조각(천장 밑 벽 규칙) | `wall-missing-under-ceiling` |
| C2 | 출입구 앞 칸에서 걷는 바닥 전부 도달 | `region-unreachable`·`door-unreachable` |
| C3 | 입구 앞 3×3 과 문 칸 비움 | `entry-blocked` |
| C4 | 모든 가구가 닿는 사용 칸을 가진다 | (빌더 단언) |
| C5 | 같은 가구 셋 일렬 금지 | `same-prop-three-in-row` |
| C6 | 벽걸이는 벽면 윗줄에만 | (빌더 단언) |
| C7 | 맨바닥 판(2×2 이상 빈 바닥 덩어리) < 10칸 | (빌더 단언) |
| C8 | 가구 겹침 0 | (빌더 단언) |

## 정본 방 6장
| 맵 id | 용도 | 크기 | 걸을 칸 | 입구·문 | 사람 |
|---|---|---|---|---|---|
{room_rows}
- 민가 15×11: 부엌(흙·황토벽) · 안방(온돌·회벽) · 마루(마루·창호벽, 길쌈). 동선: 출입구 → 마루 → 문 → 안방 → 문 → 부엌.
- 주막 22×14: 술청(마루) 한가운데 + 서쪽 부엌·곳간 + 동쪽 객실 둘. 평상 셋·술독·부뚜막.
- 대장간 16×9: 흙바닥·돌벽 작업장(화덕·풀무·모루·숫돌·담금질 통) + 동쪽 장인 방.
- 약방 14×10: 목재벽 약방(약장·약 짓는 상·약연·작두·약탕) + 의원 방.
- 서당 18×13: 강당(훈장 단 + 학동 서안 두 줄) + 훈장 방 + 서고. 목재 단·계단.
- 관아 동헌 21×15: 사또 단(병풍·의자·책상) + 곤장 틀·북 + 서기방·곳간. 박석 대청.

## 반복할 수 있는 조각 · 고정 조각
| 반복 | 고정 |
|---|---|
| 바닥 평면 변형(온돌·마루·흙·돌 + 그늘): 섞어 깐다 | 출구 깔개 `in_b_exit_mat`(방마다 하나) · 병풍 · 이불장 · 부뚜막 · 모루 · 단 |
| 벽 조각(l·m·r): 가운데 `_m` 을 이어 붙이고 끝에 `_l`·`_r` | 문 조각·문틀(틈마다 하나) · 계단 · 사다리 |
| 방석·소쿠리·항아리(변형을 섞어 군집으로) | 용도 앵커(약장·서가·곤장 틀 …) |

## 문 · 출입구 · 접근칸 · 이벤트 (섞지 않는다)
- **방 사이 문**(문틀·미닫이·널문): 걷는 줄 한 칸의 **통로**다. 이벤트 없음. 문 앞 칸에 가구를 두지 않는다.
- **출입구**(`in_b_exit_mat` 칸, extra `doors` 의 `kind: exit`): 바깥 지도로 나가는 자리. 이 칸에 **지도 이동 이벤트를 저작자가 심는다**(도착 지도 = 집 문 앞 접근칸). 이 번들 맵에는 이벤트가 없다.
- **들어오는 칸**(`entry`/`start`): 출구 깔개 바로 북쪽 한 칸 — 방에 들어와 처음 서는 자리.

## 통행·구조 검사의 범위 (item 7)
저장 스크립트가 **구조·통행만** 센다: 엔진 `isPassable` 대 구운 정답 불일치 0, 방마다 들어오는 칸에서 걸을 수 있는 칸 전부 도달(6방 합계 {sum(reach_stats(m['id'])[0] for m in rooms)}칸 중 {sum(reach_stats(m['id'])[1] for m in rooms)}칸), 문 앞·출구 칸 도달, 오토타일 마스크 대 엔진. 이벤트 실행·미적 품질·저가 모델 성공률은 이 검사로 주장하지 않는다.

## 금지
- 정본 방을 그대로 옮겨 깔지 않는다(요청이 「다른 방」이면 실패). 벽을 손으로 한 칸씩 칠하지 않는다(벽 조각 키트). 조각 윗부분 칸을 아래층에 칠하지 않는다.
- 같은 기물 셋을 일렬로 놓지 않는다. 입구 앞 3×3 에 가구를 두지 않는다. 가구를 문 틈·복도 길목에 놓아 방을 막지 않는다.
"""
    add_doc(docs, "in-guide", "조선 실내 키트 · 방 조립법 · 읽는 순서", guide)
    IN_AT, IN_GR = ("jb_in_b_",), ("jb:in_b_",)
    ceil_json = autotile_json(IN_AT)
    in_terr = f"""# 조선 실내 바닥·천장 지형 사전

{HEAD}

방의 아래층은 **바닥 평면 묶음 4종 + 벽 밑 그늘 변형**과 **천장 블롭 `in_b_ceil47`** 뿐이다. 바닥은 여러 변형을 섞어 깐다(오토타일 아님). 천장(벽 덩어리·어둠)은 오토타일이다 — 칠하면 가장자리·모서리가 이웃으로 맞는다.

## 평면 바닥 묶음 (걸음, 아래층)
| 묶음 | 이름 | 칸 |
|---|---|---|
{flat_rows(IN_GR)}

- **그늘 변형 `*_sh`**: 벽 바로 아래 줄에 쓴다 — 3종(위쪽이 벽 · 왼쪽이 벽 · 위+왼쪽이 벽)이 번호 순서대로 들어 있다.
- 방마다 바닥 묶음이 다르다(민가: 부엌 흙 + 안방 온돌 + 마루, 서당: 마루 + 온돌, 관아: 박석(돌) + 마루 + 온돌). 같은 이름 묶음이 방마다 변형 수가 다를 수 있다 — 칸 번호는 이 사전이 정답이다.

## 천장 `in_b_ceil47` (블롭 47, **막힘**)
{terrain_rows(IN_AT)}

바닥이 아닌 칸(방 바깥·칸막이 안쪽·벽 덩어리)을 전부 채운다. 맵 가장자리 밖은 천장으로 본다(`edgeConnects: true`) — 맵 가장자리에서 끝나는 천장도 테두리가 안 생긴다.
천장 바로 아래 걷는 칸 두 줄은 **벽 조각**이다(아래층이 바닥이어도 윗층이 벽 그림을 덮는다).

## 전체 사전 (JSON — 마스크 → 칸 번호)
```json
{json.dumps(ceil_json, ensure_ascii=False, separators=(',', ':'))}
```
"""
    add_doc(docs, "in-terrain", "조선 실내 · 바닥·천장 지형 사전", in_terr)
    terrain_images(IN_AT, images)
    flat_images(["jb:in_b_ondol", "jb:in_b_maru", "jb:in_b_dirt", "jb:in_b_stone", "jb:in_b_ondol_sh", "jb:in_b_maru_sh", "jb:in_b_dirt_sh", "jb:in_b_stone_sh"], "in-flat-floors",
                "실내 평면 바닥 — 온돌·마루·흙·돌 묶음과 벽 밑 그늘 변형(`*_sh`) 칸 번호 순서 그대로.", images, cols=12, zoom=3)
    docs += piece_docs(struct_names, "in-structure", "실내 구조 조각 사전(벽·창·문·기둥·보·단·계단)", "벽면 2줄 조각(`wall_*` 1×2, 끝 l·m·r·lr)·창·문틀·미닫이·기둥·보·계단·사다리·단·출구 깔개. 벽·문은 윗부분 `C`(천장 위로 걸침) 아랫부분 `X`, 문 칸·출구 깔개는 걸음.", per_doc=22)
    images += piece_images(struct_names, "in-structure", "실내 구조 조각 통행 그림", (60, 56, 64, 255))
    docs += piece_docs(furn_names, "in-furniture", "실내 기물 사전(가구·깔개·벽걸이·그릇)", "병풍·이불장·농·상·화로·방석·이부자리·족자·벽걸이·평상·부뚜막·항아리·작업 도구(풀무·모루·약장 등). 깔개·이부자리는 걸음, 가구는 막힘.", per_doc=22)
    images += piece_images(furn_names, "in-furniture", "실내 기물 통행 그림", (60, 56, 64, 255))
    room_info = {
        "joseon_in_house_b": ("한 가족이 사는 온돌 민가 — 부엌 · 안방 · 마루. 부뚜막 (1,2) 북벽 · 이불장+병풍 안방 북벽 · 베틀 마루 북벽 · 안방 가운데 돗자리+앉은뱅이 상.",
                              "1. 평면: 마루(오른쪽 아래)·안방(가운데)·부엌(왼쪽) 세 칸으로 칸막이. 2. 바닥: 마루 `in_b_maru`·온돌 `in_b_ondol`·흙 `in_b_dirt`, 벽 밑 줄은 `_sh`. 3. 벽: 부엌 회벽(`wall_hoe_*`)·마루 창호(`wall_changho_*`)·칸막이 문틀. 4. 입구 (11,9)=출구 깔개, 들어오는 칸 (11,8).\n5. 기물: 부뚜막·항아리, 이불장+병풍+돗자리, 베틀. 마루 앞 3×3 비움."),
        "joseon_in_inn_b": ("술청(마루) 한가운데 + 서쪽 부엌·곳간 + 동쪽 객실 둘. 평상 셋·주모 자리(술독·주가)·객실 이불장.",
                            "1. 평면 22×14: 술청 중앙 + 곳간·부엌(서) + 객실 둘(동). 2. 바닥 마루 위주, 부엌 흙, 객실 온돌. 3. 벽: 창호·돌벽·회벽을 구역마다. 4. 입구 (11,12), 들어오는 칸 (11,11).\n5. 기물: 평상 `in_b_pyeongsang_*`을 변형으로 어긋나게, 객실은 붉은·푸른 이부자리로 다르게."),
        "joseon_in_smith_b": ("흙바닥·돌벽 작업장 + 장인의 작은 온돌방. 화덕·풀무·모루·숫돌·담금질 통, 북벽 무기·농기구 걸이.",
                              "1. 평면 16×9 작업장 + 동쪽 방. 2. 바닥 흙 `in_b_dirt`, 방 온돌. 3. 벽 돌벽(`wall_dol_*`). 4. 입구 (8,7), 앞 3×3 비움.\n5. 모루를 작업장 가운데에 두고 담금질 통·망치 틀·숫돌을 곁에, 화덕·풀무는 북벽 곁."),
        "joseon_in_pharmacy_b": ("목재벽 약방(약장 벽 + 약 짓는 상) + 의원의 방. 약장·약선반·약연·작두·약탕.",
                                 "1. 평면 14×10 약방 + 동쪽 방. 2. 바닥 마루, 방 온돌. 3. 벽 목재(`wall_mok_*`). 4. 입구 (5,8).\n5. 약장 벽을 북벽에, 약 짓는 상 앞 걷는 줄 확보, 의원 방은 농+반닫이+이부자리."),
        "joseon_in_school_b": ("강당(훈장 단 + 학동 서안 두 줄) + 훈장 방 + 서고. 목재 단·계단, 병풍.",
                               "1. 평면 18×13: 강당 + 동쪽 훈장 방·서고. 2. 바닥 마루 + 단은 목재(`in_b_dais_wood_*`·`in_b_stair_dais_wood_*`). 3. 벽 창호. 4. 입구 (5,11), 짚자리 길.\n5. 학동 서안 둘씩 마주 두 줄(어긋나게), 훈장 서안 + 병풍."),
        "joseon_in_office_b": ("사또의 동헌(병풍·의자·책상) + 곤장 틀·북 + 서기방·곳간. 박석 대청 + 목재 단 + 붉은 기둥 두 쌍.",
                               "1. 평면 21×15: 대청 + 서기방·곳간. 2. 바닥 돌(박석 `in_b_stone`) 대청 + 목재 단, 서기방 온돌. 3. 벽 돌·회벽, 붉은 기둥(`in_b_pillar_red_*`). 4. 입구 (6,12).\n5. 단 위 병풍·의자(`in_b_throne`)·책상, 앞 계단, 붉은 길 깔개, 곤장 틀·북."),
    }
    for mid in INTERIOR:
        what, steps = room_info[mid]
        room_example(docs, images, mid, steps, f"{ROOM_KO[mid]} 한 방 전체. {what}")
    qa_doc(docs, "in", "조선 실내 키트 · 오류 교훈(실제 변조 그림 + 검출 코드·좌표)", "입구 막힘·방 사이 문 막힘·천장 밑 벽 누락·벽 조각 아래층·같은 걸상 일렬·천장 가장자리 반대를 실내 정본 방에 실제로 넣고 검출했다.")
    images += qa_images["in"]
    cats.append(dict(id="joseon-baram-interior", name="조선 · 실내 키트(방 6장: 벽·바닥·문·기둥·기물 사전, 방 조립법, 입구·동선 규칙)",
                     description=f"조선 집 안쪽 방(민가·주막·대장간·약방·서당·관아): 평면→천장 띠→바닥·그늘→벽면 2줄→입구→기물 조립 순서와 규칙 C1~C8, 바닥·천장 지형 사전(전체 배열), 구조 조각 {len(struct_names)}종·기물 {len(furn_names)}종 사전, 방 6장 전체 아래·윗층 배열 + 완성 그림, 오류 교훈(실제 변조·검출).",
                     documents=docs, images=images))

    # ================================================================== 9. 궁 내부
    docs, images = [], []
    pal = sorted([n for n in PW if n.startswith("pal_")])
    pal_struct = [n for n in pal if n.startswith(("pal_wall", "pal_door", "pal_pillar", "pal_beam", "pal_dais", "pal_nangan", "pal_step", "pal_mat_carpet", "pal_mat_run"))]
    pal_furn = [n for n in pal if n not in pal_struct]
    prooms = [M[mid] for mid in PALACE]
    prow = "\n".join(f"| `{m['id']}` | {ROOM_KO[m['id']]} | {m['W']}×{m['H']} | {reach_stats(m['id'])[0]} | 출입구 {m['start']} 앞 · 문 {len(m['doors'])}곳 | 사람 {len(m['people'])}명 |" for m in prooms)
    pguide = f"""# 조선 궁 내부 — 정전·회랑·침전 조립법 (어좌 단 · 어도 · 단청 기둥)

{HEAD}

국내성 궁·정전(`palace_hall_*`·궁문) 안쪽으로 들어가는 방 3장 — **정전 어좌 홀 · 회랑(행각) · 침전(왕의 침소)** — 을 짓는 문서다. 실내 키트(`in_b_*`: 벽·바닥·문·가구, 용도 「조선 실내 키트」)의 구조와 규칙을 **그대로 확장**하고, 궁 전용 조각 `pal_*`({len(pal)}종)을 덧붙였다.
정본 방은 한 가지 예시이지 정답 좌표가 아니다. 고증보다 **바람의나라 국내성 정전·궁문 안으로 들어가는 방**이 목적이다.

## 읽는 순서
1. 이 문서 → 실내 키트의 「방 조립 순서·규칙 C1~C8」(공통) → 「궁 지형 사전」 → 「궁 조각 사전」 → 「조립 예제」(방 3장 전체 배열) → 「오류 교훈」.

## 방 조립 순서 (실내 키트와 같고, 아래만 다르다)
1. **평면·천장 띠**: 천장은 `pal_ceil47`(단청 띠·벽 덩어리·어둠, 블롭 47, 막힘)이다. 바닥이 아닌 칸 전부.
2. **바닥**: 전돌 `pal_jeon`(가운데 길) · 거친 박석 `pal_slab`(양 곁 마당) · 온돌 `pal_ondol`(침소) · 마루 `in_b_maru`(실내 키트, 회랑·접객 칸) — 각각 벽 밑 그늘 변형 `_sh`.
3. **벽면 2줄**: 궁 벽 조각 `pal_wall_gung_{{l·m·r·lr}}`(창호 벽)·`pal_wall_gungho_*`(회벽) 교대, 쌍문 `pal_door_gung_{{l·r}}`(닫힘)·`pal_door_gung_open_{{l·r}}`(열림). **천장 바로 아래 두 줄은 벽 조각**(천장 밑 벽 규칙).
4. **입구**: 남쪽 벽 틈 한 칸 = `in_b_exit_mat`(출구 깔개), 그 북쪽 = 들어오는 칸. 입구 앞 3×3 비움. 방 사이·협문 앞은 깔개·디딤돌(`pal_step_stone`)로 문 앞을 표시.
5. **어좌 단·어도(정전)**: 북쪽 높은 단(윗면 3줄 `pal_dais_top_*` 왼·가운데·오른 × 뒷줄/가운데줄 + 앞면 `pal_dais_face_*` + 돌계단 `pal_dais_stair_3` 3칸), 단 위 일월오봉 병풍(`pal_ilwol_byeongpung` 7×3)과 용상(`pal_yongsang` 3×3). **어도**: 입구에서 단 계단까지 가운데 붉은 카펫 3칸 폭(`pal_mat_carpet_{{l·m·r}}_{{a·b·s}}`, 걸음 F; 단 계단 아래 y8 에서 `_a`·`_b` 를 번갈아 입구 쪽으로 이어 붙이고, 맨 아래 한 줄은 끝 마감 `_s`) — **어도 위에는 아무것도 놓지 않는다**. 검출: `aisle-blocked`.
6. **단청 기둥**: `pal_pillar_dan_{{2·3}}{{a·b·c}}`(2~3칸, 머리 두공이 보 노릇, 걸음 C 위쪽은 사람 위) 두 줄을 어도 양옆에, **같은 기둥 변형을 섞고**, 회랑처럼 긴 줄은 **간격을 불규칙하게**(4·6·5·6·4칸 식). 바닥에 누운 보 띠(`pal_beam_dan_*`)는 쓰지 않는다.
7. **기물 묶음**: 구역을 기능으로 묶는다 — 정전 서쪽 = 문신 자리(서안·방석·서가·화로), 동쪽 = 의례 도구(향로 둘·종 걸이·큰 북); 침전 서쪽 옷·함 / 동쪽 글 자리; 마루 서쪽 차 자리 / 동쪽 글 자리. **좌우 복제 금지**(소품 반 이상이 거울 위치에 같은 이름이면 실패). 서안·방석·병풍은 변형을 섞는다.
8. **회랑**: 가로 전폭 띠를 쓰지 않는다. 북벽에 방으로 드는 쌍문 5곳(닫힘 4·열림 1, 문 앞 깔개·디딤돌), 남쪽은 기둥과 난간(`pal_nangan_*`, 틈 3칸). 마루 폭 2줄로 동서로 걷는다.

## 정본 방 3장
| 맵 id | 용도 | 크기 | 걸을 칸 | 입구·문 | 사람 |
|---|---|---|---|---|---|
{prow}
- 정전 어좌 홀 21×23: 북쪽 높은 단 위 어좌, 가운데 붉은 어도, 양쪽 단청 기둥 줄 사이 문신(서)·무신(동). 북벽 좌우 협문(창호 쌍문, 문 앞 칸은 extra `doors` 의 `kind: side`).
- 회랑 32×10: 정전과 침전·관청을 잇는 긴 행각. 북쪽 벽에 방으로 드는 창호문 5곳(`kind: room`), 남쪽은 기둥·난간으로 마당에 열려 있다. 마루 `in_b_maru`.
- 침전 20×15: 침소(온돌, 병풍 앞 침구·용 문양 장·서안·화로·촛대)와 마루 접객 칸(방석·교자상), 칸막이 틈 2칸 폭 3줄.

## 규칙 (실내 C1~C8 + 궁 전용)
C1~C8 은 「조선 실내 키트」와 같다. 궁 전용: **P1** 문 앞·협문 앞 칸 도달 · **P2** 어좌 앞 칸까지 어도(깔개·계단)만 밟아 걸어갈 수 있음(`aisle-blocked`) · **P3** 기물이 어도를 막지 않음 · **P4** 좌우 복제 금지 · **P5** 천장 밑 벽 규칙.

## 반복할 수 있는 조각 · 고정 조각
| 반복 | 고정 |
|---|---|
| 바닥 평면 변형(전돌·박석·온돌·마루 + 그늘): 섞어 깐다 | 어좌 단 세트(윗면·앞면·계단 한 벌) · 용상 · 일월오봉 병풍 · 닫집 |
| 어도 카펫 줄(가운데 열 `_m` 반복, 양 끝 `_l`·`_r`, 변형 `a`·`b` 번갈아) | 종 걸이 · 큰 북 · 향로 · 드므(자리마다 하나) |
| 궁 벽 조각(l·m·r) · 단청 기둥(2·3칸 변형) | 쌍문(문 틈마다 하나) |

## 문 · 출입구 · 접근칸 · 이벤트 (섞지 않는다)
- **출입구**(`in_b_exit_mat`, `kind: exit`): 바깥(정전 앞 마당·궁문)으로 나가는 자리. 지도 이동 이벤트를 저작자가 심는다(번들 맵에는 없음).
- **협문·방 문**(`pal_door_gung_*`, `kind: side`/`room`): 닫힌 쌍문 앞 칸은 문 앞 접근칸이고, 문 이동 이벤트를 심을 자리다. 열린 쌍문(`pal_door_gung_open_*`)은 통로다.
- **들어오는 칸**(`entry`): 출구 깔개 북쪽 한 칸.

## 통행·구조 검사의 범위 (item 7)
저장 스크립트가 **구조·통행만** 센다: 엔진 `isPassable` 대 구운 정정 불일치 0, 방마다 들어오는 칸에서 걸을 수 있는 칸 전부 도달(3방 {sum(reach_stats(m['id'])[0] for m in prooms)}칸 중 {sum(reach_stats(m['id'])[1] for m in prooms)}칸), 문 앞·협문 앞 칸 도달, 오토타일 마스크 대 엔진. 어도 카펫 연속성은 참고문서 검사(`aisle-blocked`)가 센다. 이벤트 실행·미적 품질·저가 모델 성공률은 이 검사로 주장하지 않는다.

## 금지
- 정본 방을 그대로 옮겨 깔지 않는다. 어도 위에 기물을 놓지 않는다. 좌우를 거울로 복제하지 않는다. 바닥에 누운 보 띠를 쓰지 않는다. 궁 벽을 손으로 칠하지 않는다.
""".replace("구운 정정 불일치", "구운 정답 불일치")
    add_doc(docs, "pal-guide", "조선 궁 내부 · 정전·회랑·침전 조립법", pguide)
    PL_AT, PL_GR = ("jb_pal_",), ("jb:pal_",)
    pal_terr = f"""# 조선 궁 지형 사전

{HEAD}

궁 내부의 아래층은 평면 바닥 3종(+ 그늘 변형)과 천장 블롭 `pal_ceil47`(단청 띠가 섞인 천장)이다. 마루는 실내 키트 `in_b_maru` 를 같이 쓴다(회랑·침전 접객 칸).

## 평면 바닥 묶음 (걸음, 아래층)
| 묶음 | 이름 | 칸 |
|---|---|---|
{flat_rows(PL_GR)}

- 전돌 `pal_jeon` = 정전 가운데·단 앞 바닥, 박석 `pal_slab` = 어도 양 곁(거친 석판), 온돌 `pal_ondol` = 침소. 그늘 변형 `*_sh` 는 벽 바로 아래 줄에.
- 같은 이름의 실내 묶음(`in_b_maru`·`in_b_ondol` 등)이 궁 방 시트에서 칸 수가 다른 **변형**(`…__s<N>`)으로 들어 있다 — 아래 사전이 정답 번호다.

## 천장 `pal_ceil47` (블롭 47, **막힘**)
{terrain_rows(PL_AT)}

## 전체 사전 (JSON — 마스크 → 칸 번호)
```json
{json.dumps(autotile_json(PL_AT), ensure_ascii=False, separators=(',', ':'))}
```
"""
    add_doc(docs, "pal-terrain", "조선 궁 · 지형 사전(바닥·천장 전체 배열)", pal_terr)
    terrain_images(PL_AT, images)
    flat_images(["jb:pal_jeon", "jb:pal_slab", "jb:pal_ondol", "jb:pal_jeon_sh", "jb:pal_slab_sh", "jb:pal_ondol_sh"], "pal-flat-floors", "궁 평면 바닥 — 전돌·박석·온돌과 벽 밑 그늘 변형 칸 번호 순서 그대로.", images, cols=12, zoom=3)
    docs += piece_docs(pal_struct, "pal-structure", "궁 구조 조각 사전(벽·문·기둥·보·단·카펫·난간)", "궁 벽(창호·회벽)·쌍문·단청 기둥·보·어좌 단(윗면·앞면·계단)·어도 카펫·난간·디딤돌. 단 계단·카펫·디딤돌은 걸음(F), 기둥 몸은 막힘, 머리는 걸음★.", per_doc=22)
    images += piece_images(pal_struct, "pal-structure", "궁 구조 조각 통행 그림", (60, 44, 44, 255))
    docs += piece_docs(pal_furn, "pal-furniture", "궁 기물 사전(병풍·용상·향로·북·종·방석·침구·서안)", "일월오봉 병풍·용상·향로·큰 북·종 걸이·등롱·드므·방석·신하 깔개·침구·용 문양 장·서안·화로·촛대·족자. 깔개는 걸음, 가구는 막힘.", per_doc=22)
    images += piece_images(pal_furn, "pal-furniture", "궁 기물 통행 그림", (60, 44, 44, 255))
    pinfo = {
        "joseon_in_throne": ("국내성 왕이 신하들을 마주하는 정전: 북쪽 높은 단 위 어좌, 가운데 붉은 어도, 양쪽 단청 기둥 줄 사이에 문신(서)·무신(동).",
                             "1. 평면 21×23(출입구 (10,21), 들어오는 칸 (10,20)): 천장 `pal_ceil47` 둘레, 바닥은 가운데 전돌 `pal_jeon` + 양 곁(x1~4·16~19) 박석 `pal_slab`.\n2. 북벽: 궁 벽 `pal_wall_gung*`(창호·회벽 교대) 2줄 + 협문 쌍문(2,1)·(17,1), 일월오봉 병풍 (7,1) 7×3.\n3. 단: 윗면 `pal_dais_top_*` (6..14,3..6) + 앞면 `pal_dais_face_*` y7 + 돌계단 `pal_dais_stair_3` (9..11,7) — 용상 `pal_yongsang` (9,4).\n4. 어도: 카펫 `pal_mat_carpet_*` x9..11 y8..20(y8..19 `_a`·`_b` 번갈아, 맨 아래 y20 은 끝 마감 `_s`).\n5. 단청 기둥 두 줄(x4·x16, 줄마다 3칸 높이 기둥 셋 y9·13·17 — 같은 변형 `a·b·c` 를 섞음), 신하 자리 서쪽 서안·방석 3벌·동쪽 의례 도구(향로·종·북), 모퉁이 등롱·드므."),
        "joseon_in_corridor": ("정전과 침전·관청을 잇는 긴 행각: 북벽 방문 5곳, 남쪽은 기둥과 난간으로 마당에 열림.",
                               "1. 평면 32×10: 마루 `in_b_maru` 폭 2줄(y5·y6) 동서로. 2. 북벽 궁 벽(창호·회벽 교대) + 쌍문 5(닫힘 4·열림 1).\n3. 남쪽 단청 기둥 간격 4·6·5·6·4(x=3,7,13,18,24,28), 난간 틈 3칸(x14..16). 4. 문 앞 깔개·디딤돌 섞음, 깔개 둘(붉은 x4~11·푸른 x19~23), 서쪽 끝 당직 자리, 가운데 전시 병풍, 동쪽 향로."),
        "joseon_in_bedchamber": ("왕이 쉬는 안쪽 방: 침소(온돌·병풍 앞 침구·용 문양 장·서안·화로·촛대)와 마루 접객 칸(방석·교자상).",
                                 "1. 평면 20×15: 침소 온돌 `pal_ondol` + 마루 `in_b_maru`, 칸막이 틈 2칸 폭 3줄. 2. 벽 궁 벽·쌍문, 병풍 앞 침구 `pal_chimgu` 2×2.\n3. 기능 묶음: 침소 서쪽 옷·함(용 문양 장 `pal_yong_jang`) / 동쪽 글 자리(서안·방석·촛대), 마루 서쪽 차 자리 / 동쪽 글 자리. 4. 마루 병풍은 산수(`pal_byeongpung_gung2`)로 침소 모란 병풍과 다르게."),
    }
    for mid in PALACE:
        what, steps = pinfo[mid]
        room_example(docs, images, mid, steps, f"{ROOM_KO[mid]} 한 방 전체. {what}", zoom=3 if M[mid]["W"] <= 24 else 2)
    qa_doc(docs, "pal", "조선 궁 내부 · 오류 교훈(실제 변조 그림 + 검출 코드·좌표)", "어도 막힘·회랑 벽 누락·침전 문 앞 막힘·침전 칸막이 틈 막힘·어좌 단 아래층·궁 천장 가장자리 반대를 궁 정본 방에 실제로 넣고 검출했다.")
    images += qa_images["pal"]
    cats.append(dict(id="joseon-baram-palace", name="조선 · 궁 내부(정전·회랑·침전 조립법: 어좌 단·어도·단청 기둥)",
                     description=f"궁 안쪽 방 3장: 실내 키트를 확장한 조립 순서(천장 띠·바닥·벽면·입구·어좌 단·어도·단청 기둥·기능 묶음)와 궁 전용 규칙 P1~P5, 바닥·천장 지형 사전(전체 배열), 구조 조각 {len(pal_struct)}종·기물 {len(pal_furn)}종 사전, 방 3장 전체 아래·윗층 배열 + 완성 그림, 오류 교훈(실제 변조·검출).",
                     documents=docs, images=images))
    return cats
