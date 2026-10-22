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
def is_walk(n):
    """걸을 수 있는 성벽 윗면 칸(통로·모서리·세로 성벽·쪽문 덮개돌·계단 머리·망루 밑 통로 — 망루 cy 2·3)."""
    n = n.split(":")[-1]
    return n.startswith(("hs", "hn", "c_", "vw", "ve")) or (n.startswith("tower") and int(n.rsplit("_", 1)[1]) in (2, 3))


def check(up, lo, W, H):
    """구조·통행만 본다: wrong-layer · face-missing · wall-gap · gate-blocked. 미적 품질은 보지 않는다."""
    out = []
    for cells, layer in ((up, "upper"), (lo, "lower")):
        for (x, y), n in cells.items():
            if P[n]["layer"] != layer: out.append(dict(code="wrong-layer", x=x, y=y, note=f"{n} 은 {P[n]['layer']} 층 조각인데 {layer} 층에 있다"))
    name = lambda x, y: up.get((x, y)) or lo.get((x, y)) or ""
    for (x, y), n in up.items():
        # 가로 성벽 윗면 아래 줄 밑에는 앞면 네 칸(위·가운데·아래·굽도리) — 또는 계단·성문루·망루
        if (n.startswith(("hs", "hn")) and n.endswith("_b")) or n in ("c_sw_01", "c_sw_11", "c_se_01", "c_se_11"):
            got = [name(x, y + 1 + i) for i in range(B.NF)]
            ok = all(g.startswith((f"f_{k}_", "gate", "tower")) or (g.startswith("stair_") and g.endswith(f"_{k}")) for g, k in zip(got, B.FACE_ROWS))
            if not ok: out.append(dict(code="face-missing", x=x, y=y + 1, note=f"{n} 밑에 앞면 네 칸(f_u_* · f_m_* · f_n_* · f_l_*)이 없다({', '.join(g or '빈칸' for g in got)})"))
        # 통로 잇기: 걸음 방향마다 이웃이 성벽 윗면(또는 성문루·망루)이어야 한다
        if is_walk(n):
            for d, (dx, dy) in (("U", (0, -1)), ("D", (0, 1)), ("L", (-1, 0)), ("R", (1, 0))):
                if d not in P[n]["pass_"]: continue
                if n == "hn_stair" and d == "D": continue
                if "_pt_" in n and d in "LR": continue        # 쪽문 덮개돌의 동서는 터널 밑 길(땅)로 나간다
                nb = name(x + dx, y + dy)
                if not (is_walk(nb) or nb.startswith(("gate", "tower"))):
                    out.append(dict(code="wall-gap", x=x + dx, y=y + dy, note=f"{n} 의 통로가 {d} 쪽에서 끊겼다({nb or '빈칸'}) — 성벽 윗면을 잇거나, 길이 지나면 쪽문 덮개돌(*_pt_*)로 잇는다"))
    # 열린 성문 통로: 가운데 두 열 여덟 줄이 모두 걸음
    for (x, y), n in list(up.items()) + list(lo.items()):
        if re.fullmatch(r"gate\d?_1_0", n):
            for gx in (x, x + 1):
                for gy in range(y, y + B.GH):
                    for nm in (up.get((gx, gy)), lo.get((gx, gy))):
                        if nm and not P[nm]["pass_"] and not nm.startswith("gatec"):
                            out.append(dict(code="gate-blocked", x=gx, y=gy, note=f"열린 성문 통로 칸에 막힌 조각 {nm}"))
    return out


def main():
    DATA.mkdir(parents=True, exist_ok=True); IMG.mkdir(parents=True, exist_ok=True)
    # ---- 칸 사전 그림: 꼬리 한 행(조각 수만큼), 3배 ----
    n = sum(1 for p in B.PIECES if ":" not in p["name"])      # 기본 조각(기후 변형 snow:·desert: 은 같은 순서로 그 뒤에 이어진다)
    per = 64
    rows_ = (n + per - 1) // per
    a2 = Image.new("RGBA", (per * T, rows_ * T), (40, 44, 48, 255))
    for i in range(n): a2.alpha_composite(tile_img(B.BASE + i), ((i % per) * T, (i // per) * T))
    a2.resize((a2.width * 3, a2.height * 3), Image.NEAREST).save(IMG / "atlas.png")
    half = per

    # ---- 완전 조립 예: 둘레 26×23 ----
    (up, lo), W, H = B.ring_sample()
    ground = set(B.ring_ground())
    lower, l2, l3 = arrays(up, lo, W, H, ground)
    ring = render(lower, l2, l3, W, H)
    ring.save(IMG / "ring.png")
    defects = check(up, lo, W, H)
    assert not defects, defects
    example = dict(tilesetId="beodeul_city", width=W, height=H, tileSize=16, lowerTiles=lower, lowerOverlayTiles=l2, upperTiles=l3,
                   gates=[dict(side="S", x=10, open=True, passage=[[x, y] for y in range(13, 21) for x in (10, 11)]), dict(side="N", x=15, open=False)],
                   postern=dict(side="W", cols=[2, 3], rows=[10, 11]), towers=[[2, 12], [17, 12], [6, 1]], stairs=[dict(head=[13, 4], cells=[11, 5, 3, 4], foot=[11, 9])])
    (DATA / "example.json").write_text(json.dumps(example) + "\n")
    pu, pl, PW, PH = B.parts_plan()
    assert not check(pu, pl, PW, PH), check(pu, pl, PW, PH)
    plower, pl2, pl3 = arrays(pu, pl, PW, PH, set(B.PARTS_GROUND))
    render(plower, pl2, pl3, PW, PH).save(IMG / "parts.png")

    # ---- 정상/오류: 조립 예를 실제로 변조해 검사가 잡는지 ----
    tampers = [
        ("face-missing", (7, 16), "남쪽 성벽 앞면 위 칸(f_u_*) 하나를 뺐다", lambda u, l: u.pop((7, 16))),
        ("wall-gap", (23, 8), "동쪽 성벽 통로 한 칸을 뺐다(통로가 끊김)", lambda u, l: u.pop((23, 8))),
        ("wrong-layer", (10, 18), "열린 성문 터널 칸(gate_1_5, 아래층 조각)을 위층에 놓았다", lambda u, l: u.__setitem__((10, 18), l.pop((10, 18)))),
        ("gate-blocked", (11, 20), "열린 성문 통로 맨 아래 칸에 앞면 조각을 놓았다", lambda u, l: u.__setitem__((11, 20), "f_l_a")),
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
    face = [f"f_{k}_{v}" for k in "umnl" for v in ("a", "b", "c", "d", "endL", "endR", "shL")]
    guide = f"""# 버들항 마을 성벽 3판 — 윗면 통로·흉벽·앞면·성문루·망루·계단·그림자 (beodeul_town_wall, 2026-10-22)

타일셋 `beodeul_city` · 그림 `public/assets/beodeul-city/beodeul-city-chipset.png`(텍스처 `tex_beodeul_city`) · **16px 칸, 한 줄 128칸**.
번호 n 의 칸 = 행 ⌊n/128⌋, 열 n mod 128. 성벽 칸은 시트 꼬리 **{B.BASE}~{B.BASE + len(B.PIECES) - 1}**(행 {B.BASE_ROW}~{B.BASE_ROW + (len(B.PIECES) - 1) // 128})이다. 조각 이름 → 칸 번호는 아래 사전과 `src/assets/beodeulTownWallPieces.json`. 다른 칩셋 번호를 섞지 않는다.
그림은 코드 손 도트(scripts/content/beodeul-wall/wall_art.py), 3/4 탑뷰: 성벽 윗면(판석 통로 + 흉벽 톱니)은 위에서 본 면 **두 줄 깊이**, 그 아래 마름돌 앞면 **네 줄**(64px — 단층 민가 벽보다 높다. 고르지 않은 켜·빗물 자국·이끼 낀 굽도리).
세로 성벽은 **두 칸 폭** 윗면만 보인다. 성문루(4×8)는 윗면 플랫폼(사방 흉벽·물레·쇠창살 구덩이)이 보이고 성벽보다 16px 높으며 한 줄 앞으로 내민다.
망루(3×9)는 성벽보다 32px 높아 윗면이 성벽 흉벽보다 한 줄 위에 선다. 망루·성문루 윗면 소품은 자리마다 다르다(망루 tower·tower1·tower2, 성문루 gate·gate1).
색은 모두 버들항 시트에 있는 값(돌 = 왕성 성벽 회색, 통로 = 왕성 안뜰 판석).
**기후 변형:** 모든 성벽 조각에 눈 덮인 판(`snow:이름`)과 사막 사암 판(`desert:이름`)이 있다 — 기본 조각 {sum(1 for p in B.PIECES if ":" not in p["name"])}개 뒤에 같은 순서로 이어진다(번호는 `src/assets/beodeulTownWallPieces.json`). 그림자 `sh_*`·터널 입 그늘 `mo_*` 는 기후와 무관해 하나뿐이다. 설원 마을은 snow:, 사막 마을은 desert: 를 쓴다(walls:true 가 고른다).

## 1. 정확한 사전

층: **3층(upperTiles)** = 성벽 조각, **2층(lowerOverlayTiles)** = 성문 터널(아래층 조각)·땅 그림자(sh_*), 1층 = 땅(풀 737·길). ★ = 사람 위에 그려지는 걸음 칸(priority upper).
걸음 방향은 tileset passability 그대로(U 북·D 남·L 서·R 동). 막힘 = 네 방향 모두 막힘.

| 무엇 | 조각 `이름` 칸 번호 | 층 | 통행 | 반복 |
|---|---|---|---|---|
| 남쪽 성벽 윗면(위 줄 _a 판석 · 아래 줄 _b 판석 + 앞 흉벽) | {ids([f"hs{v}_{r}" for v in range(4) for r in "ab"] + ["hs_sh_a", "hs_sh_b"])} | 3 | 동서 + 두 줄 사이 | 반복(변형 0~3 섞기), _sh = 왼쪽 망루·성문루 그늘 |
| 북쪽 성벽 윗면(위 줄 _a 뒤 흉벽 안쪽 면 + 판석 · 아래 줄 _b 판석 + 앞 턱) | {ids([f"hn{v}_{r}" for v in range(4) for r in "ab"] + ["hn_stair"])} | 3 | 동서 + 두 줄 사이, hn_stair 는 남쪽 계단으로도 | 반복(변형 0~3) |
| 볼록 모서리 2×2 (`c_nw_00`·`c_nw_10`·`c_nw_01`·`c_nw_11` = 열·줄) | {ids([f"c_{k}_{c}" for k in ("nw", "ne", "sw", "se") for c in ("00", "10", "01", "11")])} | 3 | 이어지는 방향 | 고정 |
| 서·동 성벽 두 열(_0 왼쪽 열 · _1 오른쪽 열, 변형 0~7) | {ids([f"{e}{v}_{c}" for e in ("vw", "ve") for v in range(8) for c in (0, 1)])} | 3 | 남북 + 두 열 사이 | 반복 |
| 쪽문 터널 덮개돌(길이 세로 성벽 밑을 지나는 줄, _0 왼쪽 열 · _1 오른쪽 열) | {ids(["vw_pt_0", "vw_pt_1", "ve_pt_0", "ve_pt_1"])} | 3 ★ | 모든 방향(사람은 밑으로 동서) | 길 줄 수만큼 |
| 터널 입 그늘(반투명, 길 위) | {ids(["mo_w", "mo_e", "mo_n"])} | 2 | 걸음 | 쪽문 왼쪽 칸 mo_w · 오른쪽 칸 mo_e · 열린 성문루 뒤 길 두 칸 mo_n |
| (쓰지 않음) 옛 틈 끝 마감 | {ids(sorted(B.RETIRED))} | — | — | 칸 번호만 지킨다. 쪽문 터널을 쓴다 |
| 앞면(u 위 · m 가운데 · n 아래 · l 굽도리) × 변형 a·b·c·d + 끝 endL·endR + 그늘 shL | {ids(face)} | 3 | 막힘 | 반복(a~d 섞기, 북쪽 안쪽 면은 화살 구멍 c 빼고), 끝·그늘 고정 |
| 옆 계단 3×4(북쪽 성벽 안쪽 앞면 네 줄 자리, `stair_cx_k` cx 0~2 · k u/m/n/l) | {ids([f"stair_{c}_{k}" for k in ("u", "m", "n", "l") for c in range(3)])} | 3 | 모든 방향(★ 아님) | 고정(키트 bd-wall-stairs) |
| 성문루 4×8 (열림) | `gate_cx_cy` (cx 0~3, cy 0~7) {tid("gate_0_0")}~{tid("gate_3_6")} + 여덟째 줄 {tid("gate_0_7")}~{tid("gate_3_7")}. cx 1·2 의 cy 0~3 = ★ 걸음, cy 4~7 = 2층 터널. 윗면 변형 `gate1_cx_cy`(cy 0~2) {tid("gate1_0_0")}~{tid("gate1_3_2")} | 3 + 2 | cx 1·2 = 남북, cx 0·3 막힘 | 고정(키트 bd-wall-gatehouse) |
| 성문루 닫힘 | `gatec_cx_cy` (cx 1·2, cy 3~7) {tid("gatec_1_3")}~{tid("gatec_2_6")} + {tid("gatec_1_7")}·{tid("gatec_2_7")} | 3 | 막힘 | 고정(키트 bd-wall-gatehouse-closed) |
| 망루 3×9 | `tower_cx_cy` (cx 0~2, cy 0~8) {tid("tower_0_0")}~{tid("tower_2_6")} + {tid("tower_0_7")}~{tid("tower_2_7")} + {tid("tower_0_8")}~{tid("tower_2_8")} — cy 2·3 = 성벽 통로가 망루 밑을 지나는 ★ 칸. 윗면 변형 `tower1_cx_cy`·`tower2_cx_cy`(cy 0~2) {tid("tower1_0_0")}~{tid("tower2_2_2")} | 3 | cy 2·3 동서, 나머지 막힘 | 고정(키트 bd-wall-tower) |
| 땅 그림자(반투명) | {ids(["sh_s", "sh_e", "sh_se"])} | 2 | 걸음 | 앞면 밑 줄(s) · 세로 성벽·망루 오른쪽(e) · 둘 다(se) |

- 성문 터널 칸(2층)은 **바닥이 투명**하다 — 아치 밑으로 맵의 길이 그대로 보인다. 성문 통로 열의 1층은 반드시 길로 깐다.
- 앞면 `f_*_shL` 은 왼쪽에 세로 성벽·성문루·망루가 있어 그늘이 드는 칸, `f_*_endL/endR` 은 남쪽 성벽 양 끝.

## 2. 실행 순서(맵에 성벽을 두를 때)

**먼저: 마을 둘레 성벽은 손으로 줄을 긋지 말고 `author_beodeul_town` 에 `walls:true` 를 준다** — 같은 규칙으로 맵 크기에 맞춰 짓는다(평지·강 없는 마을, theme river·desert·snow). 아래는 손으로 고칠 때·작은 성채를 지을 때의 규칙이다.

1. 통로 사각형을 정한다: 북 y0 · 남 y1 · 서 x0 · 동 x1. 성벽 마을 도구는 x0=1, y0=2, x1=W−2, y1=H−8(바깥 띠는 풀).
2. 모서리 2×2: (x0, y0) `c_nw_*`, (x1−1, y0) `c_ne_*`, (x0, y1) `c_sw_*`, (x1−1, y1) `c_se_*`.
3. 북쪽 성벽: x0+2..x1−2 의 y0 줄 `hn?_a`, y0+1 줄 `hn?_b`, 그 아래 네 줄 앞면(`f_u_*`·`f_m_*`·`f_n_*`·`f_l_*`, 맨 왼쪽 x0+2 는 `_shL`). 남쪽 성벽: y1 줄 `hs?_a`, y1+1 줄 `hs?_b`, 그 아래 네 줄 앞면은 x0..x1 전체(x0 = `_endL`, x1 = `_endR`).
4. 세로 성벽: x0·x0+1 열 y0+2~y1−1 은 `vw?_0`·`vw?_1`, x1−1·x1 열은 `ve?_0`·`ve?_1`. 앞면 없음(3/4 에서 위만 보인다).
5. 길이 가로 성벽을 지나는 곳 = 성문루 4×8: 왼쪽 위 = (gx−1, yw−1), yw = 그 성벽 윗면 첫 줄. 통로 = gx·gx+1 두 열(위 네 줄 ★, 아래 네 줄 2층 터널). 성문루 오른쪽 성벽 칸은 그늘 판(`hs_sh_*` + `f_*_shL`). 열린 성문루 뒤(yw−2 줄) 길 두 칸에 2층 `mo_n`.
6. 길이 세로 성벽을 지나는 곳 = 쪽문 터널(길 줄마다): 성벽 두 열에 `*_pt_0`·`*_pt_1`(★, 성벽 윗면이 끊기지 않는다), 성벽 왼쪽 땅 칸 2층 `mo_w`, 오른쪽 땅 칸 2층 `mo_e`. 1층은 길.
7. 망루 3×9: 왼쪽 위 = (tx, yw−2). 성문루와 한 칸 이상 떨어뜨린다. 모서리 망루는 tx = x0(서쪽) 또는 x1−2(동쪽) — 모서리 2×2·세로 성벽 끝·앞면 끝을 덮는다. 성벽 통로가 망루 cy 2·3 줄(★) 밑으로 지나간다. 남쪽 망루 윗면 첫 줄(y1−2)은 마을 안 땅 칸이다 — 집·나무를 붙이지 않는다.
8. 계단은 북쪽 성벽에만, 3×4 옆 계단(왼쪽 아래 땅에서 오른쪽 위 통로로 오른다): (sx..sx+2, y0+2..y0+5) = `stair_0_u`…`stair_2_l`(줄 u·m·n·l), 머리 (sx+2, y0+1) = `hn_stair`. 발치 땅 칸(sx, y0+6)은 걸을 수 있어야 한다.
9. 땅 그림자(2층): 북쪽 앞면 밑 줄 y0+6 · 남쪽 앞면 밑 줄 y1+6 에 `sh_s`, 서쪽 성벽 오른쪽 열 x0+2 와 동쪽 성벽 오른쪽 열 x1+1 에 `sh_e`, 겹치는 칸은 `sh_se`. 이미 2·3층에 무엇이 있는 칸에는 두지 않는다.
10. 성벽 칸의 2·4층(풀꽃·그림자 덧그림)은 비운다. 성벽 안팎 한 칸에는 나무·집을 붙이지 않는다(성벽 마을 도구는 띠를 비워 둔다).

금지: 바닥 칸(1층)에 돌 줄을 칠해 성벽 흉내 내기(3/4 가 깨진 납작한 선), 앞면 없이 윗면만 깔기(face-missing), 성벽 통로 끊기(wall-gap — 길이 지나면 쪽문 덮개돌), 성문 터널 칸을 위층에 놓기(wrong-layer), 열린 성문 통로에 막힌 조각(gate-blocked), 기후가 다른 판 섞기(눈 마을에 기본 회색 성벽 일부만 등).
없는 것: 강·운하가 성벽을 지나는 수문, 성벽 위 경사로, 비스듬한 성벽, 오목 모서리·갈림목(2판의 cc_*·t_* 는 3판에 없다), 성벽 위 사람(병사는 Actor1 캐릭터 이벤트로).

## 3. 완전 조립 예제
- **둘레 {W}×{H}**(키트 `bd-wall-ring-sample`과 같다): 남쪽 열린 성문루(통로 x 10·11), 북쪽 닫힌 성문루(x 15·16, 윗면 변형 1), 망루 셋(남서 모서리 2·남 17·북 6 — 윗면 변형 0·1·2), 북쪽 계단 x 11, 서쪽 쪽문 터널(줄 10·11). 전체 1·2·3층 배열은 문서 「성벽 조립 예제 배열」과 tiledata/beodeul-town-wall/example.json, 원본 그림 `/assets/beodeul-town-wall/ring.png`.
- **작은 둘레**(모서리 넷·동쪽 쪽문 터널·계단·망루): `/assets/beodeul-town-wall/parts.png`.
- 키트: {" · ".join(f"`{k['id']}` {k['width']}×{k['height']}" for k in B.kits())}.

## 4. 자동 검사 범위
scripts/content/beodeul-wall/wall_refs.py 의 `check`: wrong-layer · face-missing · wall-gap · gate-blocked. **구조·통행만** 본다 — 미적 품질·밀도·이벤트는 보지 않는다(그림은 사람과 판정자가 본다).
정상/오류 그림 넷은 이 검사가 실제로 변조를 잡는지 보인다(tiledata/beodeul-town-wall/errors.json). 3/4 관문(object-gate) 영수증·적대적 VQA: harness-data/object-gate/vqa/beodeul-town-wall-3-r*/.
"""
    example_md = f"""# 성벽 조립 예제 배열 — 둘레 {W}×{H} (beodeul_city)

입력: 통로 사각형 x0=2 y0=3 x1=23 y1=14 · 성문 S x=10(열림) · N x=15(닫힘) · 쪽문 W 줄 10·11 · 망루 S 2(모서리)·S 17·N 6 · 계단 11.
-1 은 그 층이 비었다는 뜻이다. lowerTiles = 1층(풀 737·길 {B.ROAD_TILE}), lowerOverlayTiles = 2층(성문 터널·그림자), upperTiles = 3층(성벽).

```json
{json.dumps(example)}
```
"""
    (DATA / "README.md").write_text(guide)
    (DATA / "EXAMPLE.md").write_text(example_md)
    category = dict(
        id="beodeul-town-wall", name="버들항 · 마을 성벽(통로·앞면·성문루·망루·계단)",
        description=f"마을 성벽 칸 사전({B.BASE}~, 눈·사막 변형 포함), 둘레·성문·쪽문·망루·계단 조립 순서, 둘레 전체 배열, 정상/오류 그림. 마을 둘레는 author_beodeul_town walls:true.",
        documents=[dict(id="bd-wall-guide", name="성벽 칸 사전·실행 순서·검사 범위", markdown=guide),
                   dict(id="bd-wall-example", name=f"성벽 조립 예제 배열(둘레 {W}×{H})", markdown=example_md)],
        images=[dict(id="bd-wall-atlas", name=f"성벽 기본 칸 {n}개({B.BASE}~{B.BASE + n - 1})",
                     caption=f"3배 최근접 확대, 한 줄 {half}칸씩 접음(칸 번호 = {B.BASE} + 줄×{half} + 열). 순서: 남·북 윗면, 모서리 2×2, 세로 성벽·옛 끝, 앞면, 계단, 성문루, 닫힌 문, 망루, 그림자, 통로 변형, 넷째 줄, 망루 아홉째 줄·윗면 변형, 쪽문, 터널 입 그늘. 눈·사막 변형은 그 뒤 같은 순서.",
                     dataUrl="/assets/beodeul-town-wall/atlas.png"),
                dict(id="bd-wall-ring", name=f"조립 장면 · 둘레 {W}×{H}", caption=f"원본 해상도 {W * T}×{H * T}, 시트 칸 그대로. 구조 검사 결함 0.", dataUrl="/assets/beodeul-town-wall/ring.png"),
                dict(id="bd-wall-parts", name="조립 장면 · 작은 둘레(모서리·동쪽 쪽문·계단·망루)", caption=f"원본 해상도 {PW * T}×{PH * T}. 구조 검사 결함 0.", dataUrl="/assets/beodeul-town-wall/parts.png"),
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
