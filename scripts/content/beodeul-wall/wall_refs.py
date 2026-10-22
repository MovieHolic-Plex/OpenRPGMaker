#!/usr/bin/env python3
"""버들항 마을 성벽 참고문서 — 번들 소유(용도 `beodeul-town-wall`).

  python3 scripts/content/beodeul-wall/wall_refs.py

쓰는 것: tiledata/beodeul-town-wall/{README.md,EXAMPLE.md,example.json,errors.json}
        public/assets/beodeul-town-wall/*.png (칸 사전 3배 · 조립 예 원본 해상도 · 정상/오류 쌍 3배)
        src/assets/beodeulCityReferences.json 의 용도 `beodeul-town-wall`(문서·그림 id 는 bd-wall- 머리, 그림은 /assets/… 경로)
계약: tiledata/AI-REFERENCE-CONTRACT.md(사전·실행 순서·완전 조립 예제·입력→배열→원본 그림·정상/오류·검사 범위).
그림은 굽힌 시트(beodeul-city-chipset.png)의 칸을 그대로 잘라 붙인다 — 생성 그림 없음.
"""
import json, pathlib, re, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bake_wall as B  # noqa: E402

ROOT = B.ROOT
DATA = ROOT / "tiledata/beodeul-town-wall"
IMG = ROOT / "public/assets/beodeul-town-wall"
REFS = ROOT / "src/assets/beodeulCityReferences.json"
T = 16
GRASS = 737
SHEET = Image.open(B.SHEET_PATH).convert("RGBA")
P = {p["name"]: p for p in B.PIECES}


def tile_img(n):
    return SHEET.crop(((n % B.COLS) * T, (n // B.COLS) * T, (n % B.COLS + 1) * T, (n // B.COLS + 1) * T))


def render(lower, up2, up3, W, H):
    """1층(lower) · 2층(성문 바닥) · 3층(성벽) 을 시트 칸으로 그린다."""
    im = Image.new("RGBA", (W * T, H * T), (0, 0, 0, 255))
    for layer in (lower, up2, up3):
        for y in range(H):
            for x in range(W):
                n = layer[y][x]
                if n >= 0: im.alpha_composite(tile_img(n), (x * T, y * T))
    return im


def arrays(up, lo, W, H, ground):
    lower = [[(B.ROAD_TILE if (x, y) in ground else GRASS) for x in range(W)] for y in range(H)]
    l2 = [[(B.tid(lo[(x, y)]) if (x, y) in lo else -1) for x in range(W)] for y in range(H)]
    l3 = [[(B.tid(up[(x, y)]) if (x, y) in up else -1) for x in range(W)] for y in range(H)]
    return lower, l2, l3


# ---------------------------------------------------------------- 구조 검사
TOP_H = ("hs", "hn", "c_", "cc_", "t_")
def is_top(n): return n.startswith(TOP_H) and not n.startswith("tower")


def check(up, lo, W, H):
    """구조·통행만 본다: wrong-layer · face-missing · wall-gap · gate-blocked. 미적 품질은 보지 않는다."""
    out = []
    for cells, layer in ((up, "upper"), (lo, "lower")):
        for (x, y), n in cells.items():
            if P[n]["layer"] != layer: out.append(dict(code="wrong-layer", x=x, y=y, note=f"{n} 은 {P[n]['layer']} 층 조각인데 {layer} 층에 있다"))
    name = lambda x, y: up.get((x, y)) or lo.get((x, y)) or ""
    for (x, y), n in up.items():
        # 가로 성벽 통로 밑 앞면 두 칸
        if n.startswith(("hs", "hn", "c_sw", "c_se", "c_nw", "c_ne", "t_s", "t_n", "cc_")) and n not in ("hs_endW", "hs_endE", "hn_endW", "hn_endE") or n in ("hs_endW", "hs_endE", "hn_endW", "hn_endE"):
            if n.startswith(("c_nw", "c_ne")) or n.startswith("cc_") or n == "t_n": pass
            below1, below2 = name(x, y + 1), name(x, y + 2)
            needs = n.startswith(("hs", "hn")) and n != "hn_stair" or n in ("c_sw", "c_se", "t_s")
            if needs and not (below1.startswith(("f_u", "stair_u", "gate", "tower")) and below2.startswith(("f_l", "stair_l", "gate", "tower"))):
                out.append(dict(code="face-missing", x=x, y=y + 1, note=f"{n} 밑에 앞면 두 칸(f_u_*, f_l_*)이 없다({below1 or '빈칸'}, {below2 or '빈칸'})"))
        # 통로 잇기: 걸음 방향마다 이웃이 성벽 윗면(또는 성문·망루)이어야 한다
        if is_top(n) or n.startswith(("vw", "ve", "v2")):
            for d, (dx, dy) in (("U", (0, -1)), ("D", (0, 1)), ("L", (-1, 0)), ("R", (1, 0))):
                if d not in P[n]["pass_"]: continue
                if n == "hn_stair" and d == "D": continue
                nb = name(x + dx, y + dy)
                if not (is_top(nb) or nb.startswith(("vw", "ve", "v2", "gate", "tower", "hn_stair"))):
                    out.append(dict(code="wall-gap", x=x + dx, y=y + dy, note=f"{n} 의 통로가 {d} 쪽에서 끊겼다({nb or '빈칸'}) — 끝 마감 조각(_end*)으로 닫아야 한다"))
    # 열린 성문 통로: 가운데 두 열 네 줄이 모두 걸음
    for (x, y), n in lo.items():
        if n == "gate_floor_1":
            for gx in (x, x + 1):
                for gy in range(y, y + 4):
                    for nm in (up.get((gx, gy)), lo.get((gx, gy))):
                        if nm and not P[nm]["pass_"] and not nm.startswith("gatec"):
                            out.append(dict(code="gate-blocked", x=gx, y=gy, note=f"열린 성문 통로 칸에 막힌 조각 {nm}"))
    return out


def main():
    DATA.mkdir(parents=True, exist_ok=True); IMG.mkdir(parents=True, exist_ok=True)
    # ---- 칸 사전 그림: 꼬리 한 행(조각 수만큼), 3배 ----
    n = len(B.PIECES)
    atlas = Image.new("RGBA", (n * T, T), (40, 44, 48, 255))
    for i in range(n): atlas.alpha_composite(tile_img(B.BASE + i), (i * T, 0))
    # 두 줄로 접어 보기 쉽게(44칸씩)
    half = (n + 1) // 2
    a2 = Image.new("RGBA", (half * T, 2 * T), (40, 44, 48, 255))
    a2.alpha_composite(atlas.crop((0, 0, half * T, T)), (0, 0)); a2.alpha_composite(atlas.crop((half * T, 0, n * T, T)), (0, T))
    a2.resize((a2.width * 3, a2.height * 3), Image.NEAREST).save(IMG / "atlas.png")

    # ---- 완전 조립 예: 둘레 18×16 ----
    (up, lo), W, H = B.ring_sample()
    ground = set(B.ring_ground())
    lower, l2, l3 = arrays(up, lo, W, H, ground)
    ring = render(lower, l2, l3, W, H)
    ring.save(IMG / "ring.png")
    defects = check(up, lo, W, H)
    assert not defects, defects
    example = dict(tilesetId="beodeul_city", width=W, height=H, tileSize=16, lowerTiles=lower, lowerOverlayTiles=l2, upperTiles=l3,
                   gates=[dict(side="S", x=7, open=True, passage=[[7, 11], [8, 11], [7, 12], [8, 12], [7, 13], [8, 13], [7, 14], [8, 14]]), dict(side="N", x=11, open=False)],
                   gap=dict(side="W", rows=[7, 8]), towers=[[3, 9], [12, 9], [4, 0]], stairs=[[2, 3], [8, 3]])
    (DATA / "example.json").write_text(json.dumps(example) + "\n")
    pu, pl, PW, PH = B.parts_plan()
    assert not check(pu, pl, PW, PH), check(pu, pl, PW, PH)
    plower, pl2, pl3 = arrays(pu, pl, PW, PH, set())
    render(plower, pl2, pl3, PW, PH).save(IMG / "parts.png")

    # ---- 정상/오류: 조립 예를 실제로 변조해 검사가 잡는지 ----
    tampers = [
        ("face-missing", (5, 13), "남쪽 성벽 앞면 위 칸(f_u_*) 하나를 뺐다", lambda u, l: u.pop((5, 13))),
        ("wall-gap", (16, 6), "동쪽 성벽 통로 한 칸을 뺐다(끝 마감 없이 끊김)", lambda u, l: u.pop((16, 6))),
        ("wrong-layer", (7, 13), "열린 성문 통로 칸(gate_1_2, 아래층 조각)을 위층에 놓았다", lambda u, l: u.__setitem__((7, 13), l.pop((7, 13)))),
        ("gate-blocked", (8, 14), "열린 성문 통로 맨 아래 칸에 앞면 조각을 놓았다", lambda u, l: u.__setitem__((8, 14), "f_l_a")),
    ]
    errors, images = [], []
    for code, (cx, cy), caption, apply in tampers:
        u2, l2b = dict(up), dict(lo); apply(u2, l2b)
        found = [d for d in check(u2, l2b, W, H) if d["code"] == code]
        hit = any(abs(d["x"] - cx) <= 1 and abs(d["y"] - cy) <= 1 for d in found)
        assert hit, (code, found)
        errors.append(dict(id=code, code=code, at=[cx, cy], caption=caption, detected=hit, defects=found))
        bad = render(*arrays(u2, l2b, W, H, ground), W, H)
        R = 3; w = (2 * R + 1) * T; S = 3
        pair = Image.new("RGBA", (w * S * 2 + 12, w * S), (24, 24, 28, 255))
        x0, y0 = (cx - R) * T, (cy - R) * T
        for k, src in enumerate((ring, bad)):
            crop = Image.new("RGBA", (w, w), (24, 24, 28, 255)); crop.alpha_composite(src.crop((x0, y0, x0 + w, y0 + w)) if x0 >= 0 and y0 >= 0 else src.crop((max(0, x0), max(0, y0), x0 + w, y0 + w)), (max(0, -x0), max(0, -y0)))
            pair.alpha_composite(crop.resize((w * S, w * S), Image.NEAREST), (k * (w * S + 12), 0))
        # 빨간 상자
        bx, by = w * S + 12 + R * T * S, R * T * S
        for i in range(T * S):
            for (px, py) in ((bx + i, by), (bx + i, by + T * S - 1), (bx, by + i), (bx + T * S - 1, by + i)): pair.putpixel((px, py), (255, 40, 40, 255))
        pair.save(IMG / f"err-{code}.png")
        images.append(dict(id=f"bd-wall-err-{code}", name=f"정상/오류 · {code}", dataUrl=f"/assets/beodeul-town-wall/err-{code}.png",
                           caption=f"왼쪽 정상 · 오른쪽 오류(빨간 상자 = 맵 칸 ({cx},{cy})). {caption}. 검사 코드 {code} {'검출' if hit else '미검출'}. 실제 시트 칸 조립을 3배 최근접 확대."))
    (DATA / "errors.json").write_text(json.dumps(errors, ensure_ascii=False, indent=1) + "\n")

    # ---- 문서 ----
    tid = B.tid
    def ids(names): return " · ".join(f"`{n}` {tid(n)}" for n in names)
    face = [f"f_{k}_{v}" for k in "ul" for v in ("a", "b", "c", "endL", "endR", "shL", "abR", "col")]
    guide = f"""# 버들항 마을 성벽 — 성벽 통로·흉벽·앞면·성문루·망루·계단 (beodeul_town_wall, 2026-10-22)

타일셋 `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`) · **16px 칸, 한 줄 128칸**.
번호 n 의 칸 = 행 ⌊n/128⌋, 열 n mod 128. 성벽 칸은 시트 꼬리 **{B.BASE}~{B.BASE + len(B.PIECES) - 1}**(행 {B.BASE_ROW}, 열 0~{len(B.PIECES) - 1})이다. 다른 칩셋 번호를 섞지 않는다.
그림은 코드 손 도트(scripts/content/beodeul-wall/wall_art.py, 행 문자열 글리프), 3/4 탑뷰: 성벽 위 통로(판석)는 위에서 본 면, 그 아래 마름돌 앞면 두 칸.
색은 모두 버들항 시트에 있는 값(돌은 따뜻한 회색 램프, 윤곽 #2b203f = 버들항 지붕 윤곽, 망루 기와는 민가 h101 지붕 램프).

## 1. 정확한 사전

층: **3층(upperTiles)** = 성벽 조각, **2층(lowerOverlayTiles)** = 성문 통로 바닥·어둠(아래층 조각), 1층 = 땅(풀 737·길). ★ = 사람 위에 그려지는 걸음 칸(priority upper).
걸음 방향은 tileset passability 그대로(U 북·D 남·L 서·R 동). 막힘 = 네 방향 모두 막힘.

| 무엇 | 조각 `이름` 칸 번호 | 층 | 통행 | 반복 |
|---|---|---|---|---|
| 남쪽 성벽 통로(앞 흉벽, 바깥 앞면이 보인다) | {ids(["hs", "hs_shL", "hs_endW", "hs_endE"])} | 3 | 동서(LR), 끝은 한쪽 | 반복(hs), 고정(끝·그늘) |
| 북쪽 성벽 통로(뒤 흉벽, 마을 쪽 앞면이 보인다) | {ids(["hn", "hn_shL", "hn_endW", "hn_endE", "hn_stair"])} | 3 | 동서, hn_stair 는 동서+남 | 반복(hn) |
| 둘레 모서리(볼록) | {ids(["c_nw", "c_ne", "c_sw", "c_se"])} | 3 | 이어지는 두 방향 | 고정 |
| 오목 모서리 | {ids(["cc_se", "cc_sw", "cc_ne", "cc_nw"])} | 3 | 이어지는 두 방향 | 고정 |
| 갈림목 ┬ ┴ ├ ┤ | {ids(["t_n", "t_s", "t_w", "t_e"])} | 3 | 세 방향 | 고정 |
| 서·동 성벽, 가름벽(위만 보인다) | {ids(["vw", "ve", "v2"])} | 3 | 남북(UD) | 반복 |
| 세로 성벽 끝 마감 | {ids(["vw_endN", "ve_endN", "v2_endN", "vw_endS", "ve_endS", "v2_endS"])} | 3 | 한 방향 | 고정 |
| 앞면(u = 위 칸, l = 아래 칸 굽도리) | {ids(face)} | 3 | 막힘 | 반복(a·b·c 섞기), 끝·그늘·기둥(col) 고정 |
| 계단(북쪽 성벽 안쪽 앞면 자리) | {ids(["stair_u", "stair_l"])} | 3 | 남북 | 고정(키트 bd-wall-stairs) |
| 성문루 4×4 (열림) | `gate_cx_cy` {tid("gate_0_0")}~{tid("gate_3_3")} (cx 0~3, cy 0~3; 아래층 조각은 cy 2·3 의 cx 1·2) · 통로 바닥 {ids(["gate_floor_1", "gate_floor_2"])} · 통로 어둠 {ids(["gate_dark_1", "gate_dark_2"])} | 3 + 2 | cx 1·2 = 남북(cy 0·1 은 ★), cx 0·3 막힘 | 고정(키트 bd-wall-gatehouse) |
| 성문루 닫힘 | `gatec_cx_cy` (cx 1·2, cy 1~3) {tid("gatec_1_1")}~{tid("gatec_2_3")} | 3(cy1)·2(cy2·3) | 막힘 | 고정(키트 bd-wall-gatehouse-closed) |
| 망루 2×7(기와 모임지붕, 성벽 앞으로 6px 내민다) | `tower_cx_cy` {tid("tower_0_0")}~{tid("tower_1_6")} | 3 | 막힘 | 고정(키트 bd-wall-tower) |

- 통로 바닥(1층 땅) 위에 성문 통로 칸(2층)은 **바닥이 투명**하다 — 아치 밑으로 맵의 길이 그대로 보인다. 성문 통로 아래 칸 1층은 반드시 길로 깐다.
- 앞면 `f_*_shL` 은 왼쪽(서쪽)에 세로 성벽·성문루·망루가 있어 그늘이 드는 칸, `f_*_abR` 은 오른쪽 끝이 세로 성벽에 붙는 칸, `f_*_endL/endR` 은 성벽 끝 앞면, `f_*_col` 은 세로 성벽 끝 마감 밑 앞면(양쪽 끝).

## 2. 실행 순서(맵에 성벽을 두를 때)

**먼저: 마을 둘레 성벽은 손으로 줄을 긋지 말고 `author_beodeul_town` 에 `walls:true` 를 준다** — 같은 규칙으로 맵 크기에 맞춰 짓는다(평지·강 없는 마을, theme river·desert·snow). 아래는 손으로 고칠 때·작은 성채를 지을 때의 규칙이다.

1. 통로 사각형을 정한다: 북 y0 · 남 y1 · 서 x0 · 동 x1. 성벽 마을 도구는 x0=1, y0=3, x1=W−2, y1=H−4(바깥 띠는 풀).
2. 가로 성벽: y0 줄에 `c_nw, hn…, c_ne`, 그 아래 두 줄에 북쪽 안쪽 앞면(`f_u_*` · `f_l_*`, 맨 왼쪽 칸은 `_shL`, 맨 오른쪽 칸은 `_abR`). y1 줄에 `c_sw, hs…, c_se`, 그 아래 두 줄에 바깥 앞면(맨 왼쪽 `_endL`, 맨 오른쪽 `_endR`).
3. 세로 성벽: x0 열 y0+1~y1−1 은 `vw`, x1 열은 `ve`. 앞면 없음(3/4 에서 위만 보인다).
4. 길이 가로 성벽을 지나는 곳 = 성문루 4×4: 왼쪽 위 = (gx−1, y−1), y = 그 성벽 통로 줄. 통로 = gx·gx+1 두 열. 성문루 오른쪽 성벽 칸은 그늘 판(`hs_shL`/`hn_shL` + `f_*_shL`).
5. 길이 세로 성벽을 지나는 곳 = 틈: 길 줄 위로 `vw_endS`(또는 `ve_endS`) + `f_u_col` + `f_l_col`, 길 줄 아래로 `vw_endN`. 틈은 끝 마감 사이 길 줄 수만큼.
6. 망루 2×7: 왼쪽 위 = (tx, y−3), y = 가로 성벽 통로 줄. 성문루와 한 칸 이상 떨어뜨린다. 모서리에는 두지 않는다. 남쪽 성벽 망루는 성벽 안쪽 세 줄(지붕)을 비워 둔다.
7. 계단은 북쪽 성벽에만: (sx, y0) = `hn_stair`, (sx, y0+1) = `stair_u`, (sx, y0+2) = `stair_l`. 그 아래 땅 칸(sx, y0+3)은 걸을 수 있어야 한다.
8. 성벽 칸의 2·4층(풀꽃·그림자 덧그림)은 비운다. 성벽 안팎 한 칸에는 나무·집을 붙이지 않는다(성벽 마을 도구는 띠를 비워 둔다).

금지: 바닥 칸(1층)에 돌 줄을 칠해 성벽 흉내 내기(3/4 가 깨진 납작한 선), 앞면 없이 통로만 깔기(face-missing), 끝 마감 없이 통로 끊기(wall-gap), 성문 통로 칸을 위층에 놓기(wrong-layer), 열린 성문 통로에 막힌 조각(gate-blocked).
없는 것: 강·운하가 성벽을 지나는 수문, 성벽 위 경사로, 비스듬한 성벽, 성벽 위 사람(병사는 Actor1 캐릭터 이벤트로).

## 3. 완전 조립 예제
- **둘레 18×16**(키트 `bd-wall-ring-sample`과 같다): 남쪽 열린 성문루(통로 x 7·8), 북쪽 닫힌 성문루(x 11·12), 망루 셋(남 3·12, 북 4), 북쪽 계단 둘(x 2·8), 서쪽 틈(줄 7·8). 전체 1·2·3층 배열은 문서 「성벽 조립 예제 배열」과 tiledata/beodeul-town-wall/example.json, 원본 그림 `/assets/beodeul-town-wall/ring.png`.
- **부품 조립**(오목 모서리·갈림목·끝 마감): `/assets/beodeul-town-wall/parts.png`.
- 키트: {" · ".join(f"`{k['id']}` {k['width']}×{k['height']}" for k in B.kits())}.

## 4. 자동 검사 범위
scripts/content/beodeul-wall/wall_refs.py 의 `check`: wrong-layer · face-missing · wall-gap · gate-blocked. **구조·통행만** 본다 — 미적 품질·밀도·이벤트는 보지 않는다(그림은 사람과 판정자가 본다).
정상/오류 그림 넷은 이 검사가 실제로 변조를 잡는지 보인다(tiledata/beodeul-town-wall/errors.json). 3/4 관문(object-gate)·적대적 VQA 영수증: harness-data/object-gate/vqa/beodeul-town-wall-r*/receipt.json.
"""
    example_md = f"""# 성벽 조립 예제 배열 — 둘레 18×16 (beodeul_city)

입력: 통로 사각형 x0=1 y0=3 x1=16 y1=12 · 성문 S x=7(열림) · N x=11(닫힘) · 틈 W 줄 7·8 · 망루 S 3·S 12·N 4 · 계단 2·8.
-1 은 그 층이 비었다는 뜻이다. lowerTiles = 1층(풀 737·길 {B.ROAD_TILE}), lowerOverlayTiles = 2층(성문 통로), upperTiles = 3층(성벽).

```json
{json.dumps(example)}
```
"""
    (DATA / "README.md").write_text(guide)
    (DATA / "EXAMPLE.md").write_text(example_md)
    category = dict(
        id="beodeul-town-wall", name="버들항 · 마을 성벽(통로·앞면·성문루·망루·계단)",
        description=f"마을 성벽 칸 사전({B.BASE}~), 둘레·성문·틈·망루·계단 조립 순서, 둘레 전체 배열, 정상/오류 그림. 마을 둘레는 author_beodeul_town walls:true.",
        documents=[dict(id="bd-wall-guide", name="성벽 칸 사전·실행 순서·검사 범위", markdown=guide),
                   dict(id="bd-wall-example", name="성벽 조립 예제 배열(둘레 18×16)", markdown=example_md)],
        images=[dict(id="bd-wall-atlas", name=f"성벽 칸 전체(시트 행 {B.BASE_ROW}, 열 0~{len(B.PIECES) - 1})",
                     caption=f"3배 최근접 확대, 두 줄로 접음(위 줄 열 0~{half - 1}, 아래 줄 열 {half}~{len(B.PIECES) - 1}). 순서: 남·북 통로, 모서리, 오목 모서리, 갈림목, 세로 성벽·끝, 앞면, 계단, 성문루, 닫힌 문, 망루.",
                     dataUrl="/assets/beodeul-town-wall/atlas.png"),
                dict(id="bd-wall-ring", name="조립 장면 · 둘레 18×16", caption=f"원본 해상도 {W * T}×{H * T}, 시트 칸 그대로. 구조 검사 결함 0.", dataUrl="/assets/beodeul-town-wall/ring.png"),
                dict(id="bd-wall-parts", name="조립 장면 · 부품(오목 모서리·갈림목·끝 마감)", caption=f"원본 해상도 {PW * T}×{PH * T}. 구조 검사 결함 0.", dataUrl="/assets/beodeul-town-wall/parts.png"),
                *images])
    refs = json.loads(REFS.read_text())
    i = next((k for k, c in enumerate(refs) if c["id"] == category["id"]), -1)
    if i < 0: refs.append(category)
    else: refs[i] = category
    # prepare-beodeul-city-references.py·farm_refs.mts 와 같은 꼴(구조 줄바꿈만, 들여쓰기 없음)
    REFS.write_text(re.sub(r"\n +", "\n", json.dumps(refs, ensure_ascii=False, indent=1)) + "\n")
    print(json.dumps(dict(docs=len(category["documents"]), images=len(category["images"]), errors=[f"{e['id']}:{e['detected']}" for e in errors]), ensure_ascii=False))


if __name__ == "__main__":
    main()
