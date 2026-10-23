#!/usr/bin/env python3
"""왕도 아스텔(Fallen Star) 새 조각 — 버들항 시트 꼬리 32,768~(256행~) 에 덧붙여 굽는다(bake_wall.py 를 본뜸).

  python3 scripts/content/beodeul-capital/bake_capital.py --gate-export DIR   # 3/4 관문에 낼 조립 그림 + items.jsonl 만 쓴다
  python3 scripts/content/beodeul-capital/bake_capital.py --samples DIR       # 확인용 조립 그림만 쓴다
  python3 scripts/content/beodeul-capital/bake_capital.py --no-gate           # 관문 영수증 확인 없이 굽는다(개발 중 시험용 — 번들 반영 전 반드시 관문)
  python3 scripts/content/beodeul-capital/bake_capital.py                     # 관문을 확인하고 굽는다

입력  capital_art.py (규칙 함수가 찍는 코드 손 도트)
출력  public/assets/beodeul-city/beodeul-city-chipset.png — 앞 256행(32,768칸)은 그대로(던전 gap 꼬리 29,568~ 와 그 뒤 빈 자리 ~32,767 — 짧으면 투명으로 채운다), 뒤에 덧붙인다
      src/assets/beodeulCityTileset.json(표·tileGroups beodeul:capital_*·structureKits bd-capital-*·animationStrips) · beodeulCitySheet.json · beodeulCapitalPieces.json
덧붙이기 전용: 앞 칸 번호·화소는 바뀌지 않는다. 다시 돌려도 같은 결과(멱등).
사슬: bake_wall.py → bake_gap.py → 이 스크립트. 앞 꼬리 스크립트는 시트를 자기 끝에서 자르므로 bake_gap.py 가 끝에서 이 스크립트를 다시 부른다(관문 확인 그대로).
30,848~32,767 은 gap 꼬리가 자랄 자리로 비워 둔다 — gap 이 32,768 을 넘으면 bake_gap.py 가 멈춘다.
"""
import argparse, json, pathlib, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import capital_art as C  # noqa: E402

ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
PIECES_JSON = ROOT / "src/assets/beodeulCapitalPieces.json"
T = 16
COLS = 128
PALETTE_ROWS = 231          # 팔레트 잠금 기준: 시트 앞 231행(29,568칸)
BASE = 32768                # 29,568~ 던전 gap 꼬리(지금 ~30,847) + 자랄 자리 — 256행부터
BASE_ROW = BASE // COLS
FPS = 6


# ---------------------------------------------------------------- 조각
def cut(cv, cx, cy):
    return cv.crop(cx * T, cy * T, T, T)


def blank(img):
    return img.getbbox() is None


def build_pieces():
    """[dict(name, img, pass_, star, layer, desc, frames?)] — 시트 꼬리에 이 순서로 놓는다(움직이는 칸은 프레임이 이어진다)."""
    out = []

    def P(name, cv, pass_, desc, star=False, layer="upper"):
        im = cv.image() if isinstance(cv, C.Canvas) else cv
        out.append(dict(name=name, img=im, pass_=pass_, star=star, layer=layer, desc=desc))

    # 1. 둥근 탑 3×11 (기본 · 불 켠 창)
    for tag, var, lit in (("rtower", 0, False), ("rtowerL", 1, True)):
        tw = C.round_tower(var, lit=lit)
        for cy in range(11):
            for cx in range(3):
                if cy == 4: P(f"{tag}_{cx}_{cy}", cut(tw, cx, cy), "LRD", "둥근 탑 — 성벽 통로가 탑 밑을 지나간다(★, 동서)", star=True)
                elif cy == 5: P(f"{tag}_{cx}_{cy}", cut(tw, cx, cy), "LRUD", "둥근 탑 — 성벽 통로가 탑 밑을 지나간다(★, 동서)", star=True)
                elif cy < 4: P(f"{tag}_{cx}_{cy}", cut(tw, cx, cy), "", "둥근 탑 파란 원뿔 지붕(막힘)")
                else: P(f"{tag}_{cx}_{cy}", cut(tw, cx, cy), "", "둥근 탑 원통 몸(막힘)" + (" — 불 켠 창" if lit else ""))
        # 모서리 탑 바깥 열: 통로 두 줄의 바깥 걸음을 막는다(그림은 같다)
        for cn, cx, drop in (("w", 0, "L"), ("e", 2, "R")):
            for cy, pd in ((4, "LRD"), (5, "LRUD")):
                P(f"{tag}{cn}_{cx}_{cy}", cut(tw, cx, cy), pd.replace(drop, ""), "모서리 둥근 탑 바깥 열 — 성벽 통로가 탑 밑을 지나간다(★, 바깥쪽 막힘)", star=True)
    # 2. 운하 수문 앞면 4×4
    for side in ("N", "S"):
        wg = C.water_gate(side)
        d = "북쪽 성벽 안쪽 면(들어 올린 쇠창살)" if side == "N" else "남쪽 성벽 바깥 면(아스텔 방패)"
        for cy in range(4):
            for cx in range(4):
                P(f"wg{side}_{cx}_{cy}", cut(wg, cx, cy), "", f"운하 수문 쌍아치 앞면 — {d}(막힘)")
    # 3. 분수 4×4 (물결·물줄기 세 프레임)
    fr = [C.fountain(i) for i in range(3)]
    for cy in range(4):
        for cx in range(4):
            ims = [cut(f, cx, cy).image() for f in fr]
            if blank(ims[0]) and all(blank(i) for i in ims): continue
            solid = any(ims[0].getpixel((x, y))[3] > 200 for x in range(16) for y in range(8, 16))
            pass_, star = ("", False) if (cy > 0 or solid) else ("LRUD", True)
            same = all(i.tobytes() == ims[0].tobytes() for i in ims[1:])
            P(f"fountain_{cx}_{cy}", ims[0], pass_, "광장 분수(둥근 돌 수반 · 받침 그릇 두 단 · 금빛 별 꼭지)" + ("" if pass_ == "" else " — 꼭지(★)"), star=star)
            if not same:
                out[-1]["frames"] = 3
                for k in (1, 2): P(f"fountain_{cx}_{cy}@{k}", ims[k], pass_, f"광장 분수 움직임 {k + 1}번째 프레임", star=star)
    # 4. 포고 단 4×2 (바닥 층)
    da = C.dais()
    for cy in range(2):
        for cx in range(4):
            P(f"dais_{cx}_{cy}", cut(da, cx, cy), "UDLR", "포고 단 " + ("윗면(판석 · 가운데 금빛 별)" if cy == 0 else "앞 턱과 디딤돌") + " — 걷는다(바닥 층)", layer="lower")
    # 5. 왕실 깃발 · 방패
    bp = C.banner_pole()
    for cy in range(3):
        P(f"bpole_0_{cy}", cut(bp, 0, cy), "" if cy == 2 else "LRUD", "왕실 깃대(아스텔 파랑 · 금 왕관 · 금 팔방 별)" + (" 돌 굽(막힘)" if cy == 2 else "(★)"), star=cy < 2)
    bw = C.banner_wall()
    for cy in range(2):
        P(f"bwall_0_{cy}", cut(bw, 0, cy), "LRUD", "벽걸이 왕실 깃발(벽 앞면 위에 겹친다, ★)", star=True)
    P("shield", C.shield_plaque(), "LRUD", "벽걸이 아스텔 방패(벽 앞면 위에 겹친다, ★)", star=True)
    # 6. 왕실 가로등
    lp = C.lamp()
    for cy in range(3):
        P(f"lamp_0_{cy}", cut(lp, 0, cy), "" if cy == 2 else "LRUD", "왕실 가로등(왕관 갓 팔각 등롱)" + (" 돌 받침(막힘)" if cy == 2 else "(★)"), star=cy < 2)
    l2 = C.lamp_double()
    for cy in range(3):
        for cx in range(2):
            P(f"lamp2_{cx}_{cy}", cut(l2, cx, cy), "" if cy == 2 else "LRUD", "왕실 쌍등(가로팔 양끝 등롱 둘)" + (" 돌 받침(막힘)" if cy == 2 else "(★)"), star=cy < 2)
    # 7. 선착 계단 1×3 (바닥 층)
    for side in ("W", "E"):
        q = C.quay_steps(side)
        for cy, pd, d in ((0, "UDLR", "둑 높이 디딤판"), (1, "UD", "계단(남쪽으로 내려간다)"), (2, "U", "물에 잠기는 마지막 단")):
            P(f"quay{side}_0_{cy}", cut(q, 0, cy), pd, f"{'서' if side == 'W' else '동'}쪽 둑 선착 계단 — {d}(바닥 층)", layer="lower")
    # 8. 운하 갑문 (가운데 4칸 바닥 층 + 둑 물레)
    lk = C.canal_lock()
    for cy in range(2):
        for cx in range(4):
            P(f"lock_{cx}_{cy}", cut(lk, cx, cy), "LR" if cy == 0 else "", "운하 갑문 " + ("널 다리 윗면(동서로 걷는다)" if cy == 0 else "나무 갑문 앞면·거품 물(막힘)") + "(바닥 층)", layer="lower")
    P("capstan", C.capstan(), "", "갑문 물레(둑 칸, 막힘)")
    for p in out:
        if not isinstance(p["img"], Image.Image): p["img"] = p["img"].image()
    return out


# 시트에 싣는 조각 — 왕도 아스텔 맵이 쓰고 3/4 관문(위임 허용)을 거친 것만. 남쪽 수문·벽걸이 깃발·방패·쌍등·선착 계단·갑문은
# 그림은 capital_art.py 에 남지만 굽지 않는다(선착 계단·갑문은 화풍 FAIL, 쌍등은 REFER — 관문 FAIL 을 덮어쓰지 않는다).
SHIPPED = ("rtower", "wgN_", "fountain_", "dais_", "bpole_", "lamp_0_")
PIECES = [p for p in build_pieces() if p["name"].startswith(SHIPPED)]
INDEX = {p["name"]: i for i, p in enumerate(PIECES)}
ROWS_ADDED = (len(PIECES) + COLS - 1) // COLS
COUNT = BASE + ROWS_ADDED * COLS


def tid(name): return BASE + INDEX[name]


def img(name): return PIECES[INDEX[name]]["img"]


# ---------------------------------------------------------------- 키트(위층 = upperTiles, 바닥 층 = tiles)
def _grid(names, W, H):
    """names: {(x,y): name} → (lower rows, upper rows)."""
    rows = []
    for y in range(H):
        lo = [tid(names[(x, y)]) if (x, y) in names and PIECES[INDEX[names[(x, y)]]]["layer"] == "lower" else -1 for x in range(W)]
        up = [tid(names[(x, y)]) if (x, y) in names and PIECES[INDEX[names[(x, y)]]]["layer"] == "upper" else -1 for x in range(W)]
        rows.append(dict(tiles=lo, upperTiles=up))
    return rows


def tower_cells(tag="rtower", corner=""):
    out = {}
    for cy in range(11):
        for cx in range(3):
            n = f"{tag}_{cx}_{cy}"
            if corner and cy in (4, 5) and cx == (0 if corner == "w" else 2): n = f"{tag}{corner}_{cx}_{cy}"
            out[(cx, cy)] = n
    return out


def fountain_cells():
    return {(cx, cy): f"fountain_{cx}_{cy}" for cy in range(4) for cx in range(4) if f"fountain_{cx}_{cy}" in INDEX}


def lock_cells():
    if "capstan" not in INDEX: return {(0, 0): "lock_0_0"}
    d = {(1 + cx, cy): f"lock_{cx}_{cy}" for cx in range(4) for cy in range(2)}
    d[(0, 1)] = "capstan"; d[(5, 1)] = "capstan"
    return d


TOWER_RULES = ("가로 성벽(북·남) 줄에 넣는다: 탑 0행 = 성벽 윗면 첫 줄(yw)보다 네 줄 위, 4·5행 = 성벽 윗면 두 줄(yw·yw+1, 통로가 탑 밑을 ★로 동서로 지난다), "
               "6~9행 = 성벽 앞면 네 줄, 10행 = 성벽 앞면 아래 땅 줄(탑이 한 줄 앞으로 내민다). 0~3행(원뿔)과 6~10행(원통 몸)은 막힘. "
               "성문루 양옆·모서리(2×2 모서리와 이어진 앞면·세로 성벽 끝을 덮는다, 바깥 열 통로 칸은 -corner-w/-e 키트)·세로 성벽이 가로 성벽에 내려앉는 꺾인 모서리에 쓴다. "
               "모서리 탑은 세로 성벽 통로를 막는다(네모 망루와 같다). 탑 오른쪽 성벽 칸은 성벽 그늘 판(hs_sh_*·hn_sh_*·f_*_shL), 탑 밑 땅 줄 아래·오른쪽에 sh_s·sh_se·sh_e.")


def kits():
    themes = ["city", "castle", "도시", "왕도", "성벽", "광장"]
    out = []

    def kit(kid, name, cells, W, H, desc, rules, tags, home="upper", parts=None):
        if any(n not in INDEX for n in cells.values()): return  # 굽지 않는 조각의 키트는 싣지 않는다
        k = dict(id=kid, kind="section", name=name, width=W, height=H, tileSize=16, rows=_grid(cells, W, H), learnedFrom="db-authored",
                 ai=dict(description=desc, placementRules=rules, tags=["버들항", "왕도", "capital"] + tags, role="prop", repeatability="fixed", layerHome=home, themes=themes))
        if parts: k["parts"] = parts
        out.append(k)

    tdesc = ("파란 원뿔 둥근 성벽 탑 3×11: 비늘 슬레이트 원뿔 지붕(꼭대기 쇠 꼬챙이·금빛 공·아스텔 파랑 삼각기), 원뿔 밑 내민 받침돌 띠, "
             "3판 성벽과 같은 차가운 밝은 회색 마름돌 원통 몸(휘는 켜·가장자리로 좁아지는 돌·원통 명암), 좁은 창 셋, 굽도리.")
    kit("bd-capital-round-tower", "왕도 둥근 성벽 탑 3×11(파란 원뿔)", tower_cells(), 3, 11, tdesc, TOWER_RULES, ["tower", "탑"])
    kit("bd-capital-round-tower-lit", "왕도 둥근 성벽 탑 3×11(불 켠 창)", tower_cells("rtowerL"), 3, 11, tdesc + " 가운데 창 하나에 따뜻한 불빛, 창 자리가 다르다.", TOWER_RULES, ["tower", "탑"])
    kit("bd-capital-round-tower-corner-w", "왕도 둥근 모서리 탑 3×11(서쪽 모서리)", tower_cells(corner="w"), 3, 11, tdesc + " 서쪽 모서리용: 바깥(서) 열 통로 칸은 서쪽 걸음을 막는다.", TOWER_RULES, ["tower", "탑"])
    kit("bd-capital-round-tower-corner-e", "왕도 둥근 모서리 탑 3×11(동쪽 모서리)", tower_cells(corner="e"), 3, 11, tdesc + " 동쪽 모서리용: 바깥(동) 열 통로 칸은 동쪽 걸음을 막는다.", TOWER_RULES, ["tower", "탑"])
    wg_rules = ("운하(4칸 폭)가 성벽 밑을 지나는 곳에서 성벽 앞면 네 줄(yw+2~yw+5) × 운하 네 열을 이 키트로 바꾼다. 위 통로 두 줄은 보통 성벽 조각 그대로, "
                "아래 땅 줄(yw+6)부터 운하 물. 모두 막힘(위층).")
    kit("bd-capital-watergate-n", "왕도 운하 수문 4×4(북쪽 성벽 안쪽 면)", {(cx, cy): f"wgN_{cx}_{cy}" for cx in range(4) for cy in range(4)}, 4, 4,
        "북쪽 성벽 마을 쪽 앞면의 운하 수문: 두 둥근 아치(홍예돌·쐐기돌), 아치 머리에 들어 올린 쇠창살, 아치 안 어두운 물길, 아래 줄은 흘러나오는 물과 물보라.", wg_rules, ["canal", "운하", "수문"])
    kit("bd-capital-watergate-s", "왕도 운하 수문 4×4(남쪽 성벽 바깥 면)", {(cx, cy): f"wgS_{cx}_{cy}" for cx in range(4) for cy in range(4)}, 4, 4,
        "남쪽 성벽 바깥 앞면의 운하 수문: 두 둥근 아치, 가운데 교각 위 아스텔 방패, 아치 안 물길, 흘러나오는 물.", wg_rules, ["canal", "운하", "수문"])
    kit("bd-capital-fountain", "왕도 광장 분수 4×4", fountain_cells(), 4, 4,
        "광장 분수: 둥근 돌 수반(타원 테 윗면·휘는 앞 테), 물결 고리 진 물, 가운데 기둥과 받침 그릇 두 단, 금빛 팔방 별 꼭지, 넘쳐 떨어지는 물줄기(세 프레임 움직임).",
        "광장 바닥 위층에 통째로. 1~3행 막힘, 0행(별 꼭지)은 ★. 둘레 한 칸은 비워 사람이 둘러선다.", ["fountain", "분수", "광장"])
    kit("bd-capital-dais", "왕도 포고 단 4×2", {(cx, cy): f"dais_{cx}_{cy}" for cx in range(4) for cy in range(2)}, 4, 2,
        "포고 단: 밝은 돌 판석 윗면(테 돌 · 가운데 파랑 돌 원에 금빛 별), 앞 턱 한 켜와 디딤돌 한 단. 사람이 윗면에 올라선다.",
        "바닥 층(1층)에 깐다 — 광장 바닥을 바꾼다. 여덟 칸 모두 걷는다. 위층에 아무것도 얹지 않는다(뒤 난간 없음).", ["dais", "단", "광장"], home="lower")
    kit("bd-capital-banner-pole", "왕도 왕실 깃대 1×3", {(0, y): f"bpole_0_{y}" for y in range(3)}, 1, 3,
        "왕실 깃대: 금빛 창끝 꼭지·가로대에 매단 아스텔 깃발(파랑 바탕 · 금 테 · 금 왕관 · 그 밑 금 팔방 별 · 제비꼬리), 돌 굽.", "위층. 2행(굽)만 막힘, 0·1행은 ★.", ["banner", "깃발"])
    kit("bd-capital-banner-wall", "왕도 벽걸이 왕실 깃발 1×2", {(0, y): f"bwall_0_{y}" for y in range(2)}, 1, 2,
        "벽 앞면에 거는 아스텔 깃발(쇠 막대 · 투명 바탕 · 벽에 진 그림자).", "성벽·성문루·건물 앞면 칸 위에 겹친다(겹침 층). 통행은 밑 벽 칸이 정한다(이 칸은 ★).", ["banner", "깃발", "wall_mounted"])
    kit("bd-capital-shield", "왕도 벽걸이 아스텔 방패 1×1", {(0, 0): "shield"}, 1, 1,
        "벽에 거는 아스텔 방패(금 테 · 파랑 바탕 · 금 왕관 · 금 팔방 별).", "앞면 칸 위에 겹친다(★).", ["shield", "방패", "wall_mounted"])
    kit("bd-capital-lamp", "왕도 왕실 가로등 1×3", {(0, y): f"lamp_0_{y}" for y in range(3)}, 1, 3,
        "왕실 가로등: 파랑 판 박은 돌 받침, 금띠 두른 쇠기둥, 말린 쇠 받침대, 금빛 왕관 갓 팔각 등롱(따뜻한 불빛).", "위층. 2행(받침)만 막힘.", ["lamp", "가로등"])
    kit("bd-capital-lamp-double", "왕도 왕실 쌍등 2×3", {(cx, y): f"lamp2_{cx}_{y}" for cx in range(2) for y in range(3)}, 2, 3,
        "왕실 쌍등: 가운데 쇠기둥 위 금빛 별, 말린 가로팔 양끝에 왕관 갓 등롱 둘.", "위층. 2행(받침 두 칸)만 막힘.", ["lamp", "가로등"])
    qr = "운하 둑 쪽 열(서쪽 둑 = 운하 맨 서쪽 열, 동쪽 둑 = 맨 동쪽 열)의 세 줄을 바닥 층에서 바꾼다. 0행은 둑 높이 디딤판(둑 땅과 잇는다), 1행 계단(남북), 2행 물에 잠기는 단(그 아래는 운하 물)."
    kit("bd-capital-quay-steps-w", "왕도 선착 계단 1×3(서쪽 둑)", {(0, y): f"quayW_0_{y}" for y in range(3)}, 1, 3,
        "운하 서쪽 둑에서 물로 내려가는 돌계단(둑 돌 테가 서쪽).", qr, ["canal", "운하", "계단"], home="lower")
    kit("bd-capital-quay-steps-e", "왕도 선착 계단 1×3(동쪽 둑)", {(0, y): f"quayE_0_{y}" for y in range(3)}, 1, 3,
        "운하 동쪽 둑에서 물로 내려가는 돌계단(둑 돌 테가 동쪽).", qr, ["canal", "운하", "계단"], home="lower")
    kit("bd-capital-canal-lock", "왕도 운하 갑문 6×2", lock_cells(), 6, 2,
        "운하 갑문: 위쪽 물 · 쇠 난간 널 다리(동서로 걷는다) · 쇠띠 두른 나무 갑문 두 짝(가운데 맞물림, 수문 구멍에서 새는 물) · 아래쪽 거품 물, 양쪽 둑에 갑문 물레.",
        "가운데 네 열(1~4열) = 운하 네 열을 바닥 층에서 바꾼다. 0행 널 다리는 동서로 걷고 양옆 둑 땅(0열·5열 0행)과 잇는다. 1행은 막힘. 0열·5열 1행은 둑 땅 위층 물레(막힘).",
        ["canal", "운하", "갑문"], home="lower", parts=[dict(id="walk", kind="entrance", dx=1, dy=0, w=4, h=1, note="널 다리(동서 걸음)")])
    return out


# ---------------------------------------------------------------- 관문용 조립 그림
def _bw():
    sys.path.insert(0, str(ROOT / "scripts/content/beodeul-wall"))
    import bake_wall as BW  # noqa: E402
    return BW


def _paste_cells(im, cells, ox, oy, only=None):
    for (x, y), n in cells.items():
        if only and PIECES[INDEX[n]]["layer"] != only: continue
        im.alpha_composite(img(n), ((ox + x) * T, (oy + y) * T))


def _sheet_tile(n):
    sh = _SHEET()
    return sh.crop(((n % COLS) * T, (n // COLS) * T, (n % COLS + 1) * T, (n // COLS + 1) * T))


_SH = []


def _SHEET():
    if not _SH: _SH.append(Image.open(SHEET_PATH).convert("RGBA"))
    return _SH[0]


GRASS = 737
COBBLE = 3221
# 운하 물 오토타일(4칸 폭 남북 운하): 서쪽 열 = 북·동·남으로 이어짐, 가운데 = 몸통, 동쪽 열 = 북·남·서
CANAL_W, CANAL_C, CANAL_E = 23089, 23153, 23137


def _canal(im, x0, y0, y1):
    for y in range(y0, y1):
        for i, n in enumerate((CANAL_W, CANAL_C, CANAL_C, CANAL_E)): im.paste(_sheet_tile(n), ((x0 + i) * T, y * T))


def _grass(W, H):
    im = Image.new("RGBA", (W * T, H * T))
    g = _sheet_tile(GRASS)
    for y in range(H):
        for x in range(W): im.paste(g, (x * T, y * T))
    return im


def wall_with_towers():
    """북쪽 성벽(닫힌 성문루 양옆 둥근 탑 · 모서리 둥근 탑 둘)과 남쪽 성벽(둥근 탑 하나, 불 켠 창)을 두른 둘레 22×27."""
    BW = _bw()
    x0, y0, x1, y1 = 1, 5, 20, 16
    up, lo = BW.plan_ring(x0, y0, x1, y1, gates=[("N", 10, 0)], closed=[("N", 10)])
    towers = [("N", 6, "rtower", ""), ("N", 13, "rtower", ""), ("N", x0, "rtower", "w"), ("N", x1 - 2, "rtower", "e"), ("S", 9, "rtowerL", "")]
    W, H = 22, 27
    im = _grass(W, H)
    rend = BW.render_plan(up, {k: v for k, v in lo.items()}, W, H)
    im.alpha_composite(rend)
    for side, tx, tag, cn in towers:
        yw = y1 if side == "S" else y0
        cells = tower_cells(tag, cn)
        # 탑 칸 밑 성벽 칸을 지우고(땅이 보이게) 탑을 얹는다
        g = _sheet_tile(GRASS)
        for (cx, cy) in cells:
            x, y = tx + cx, yw - 4 + cy
            if (x, y) in up or (x, y) in lo: im.paste(g, (x * T, y * T))
        _paste_cells(im, cells, tx, yw - 4)
    return im


def watergate_scene(side):
    """성벽 한 토막(10칸)에 운하 수문, 운하가 성벽 밑으로 흘러 나와 풀밭 사이로 간다.
    N = 북쪽 성벽(마을 쪽 앞면, 마을 = 아래), S = 남쪽 성벽(바깥 앞면, 바깥 = 아래).
    운하는 성벽 윗면 칸 밑까지 깔아 물이 성벽에 바로 닿는다(성가퀴 틈으로 풀이 비치지 않는다). 성벽은 열 칸 내내 같은 켜로 이어진다."""
    BW = _bw()
    W, H = 10, 12
    im = _grass(W, H)
    yw = 3
    cx0 = 3
    _canal(im, cx0, 0, yw + 2)
    _canal(im, cx0, yw + 6, H)
    k = "hn" if side == "N" else "hs"
    up = {}
    for x in range(W):
        v = BW.hsh(x, yw, 1) % 4
        up[(x, yw)] = f"{k}{v}_a"; up[(x, yw + 1)] = f"{k}{v}_b"
        if not (cx0 <= x < cx0 + 4):
            for i, r in enumerate(BW.FACE_ROWS): up[(x, yw + 2 + i)] = f"f_{r}_{'abefgh'[(x * 5) % 6]}"
    for (x, y), n in up.items():
        if not (cx0 <= x < cx0 + 4) or y < yw + 2: im.alpha_composite(BW.img(n), (x * T, y * T))
    _paste_cells(im, {(cx, cy): f"wg{side}_{cx}_{cy}" for cx in range(4) for cy in range(4)}, cx0, yw + 2)
    for x in range(W):
        if not (cx0 <= x < cx0 + 4): im.alpha_composite(BW.img("sh_s"), (x * T, (yw + 6) * T))
    return im


def quay_scene():
    """운하(4칸 폭) 세 줄 + 양쪽 둑 한 칸(자갈길): 서·동 둑 선착 계단(투명 바탕)."""
    W, H = 8, 3
    im = Image.new("RGBA", (W * T, H * T))
    road = _sheet_tile(COBBLE)
    for y in range(H):
        for x in (0, 1, W - 2, W - 1): im.paste(road, (x * T, y * T))
    _canal(im, 2, 0, H)
    _paste_cells(im, {(0, y): f"quayW_0_{y}" for y in range(3)}, 2, 0)
    _paste_cells(im, {(0, y): f"quayE_0_{y}" for y in range(3)}, 5, 0)
    return im


def lock_scene():
    """갑문 키트 6×2 + 양쪽 둑 자갈길 + 아래 운하 한 줄(투명 바탕)."""
    W, H = 6, 3
    im = Image.new("RGBA", (W * T, H * T))
    road = _sheet_tile(COBBLE)
    for y in range(H):
        for x in (0, W - 1): im.paste(road, (x * T, y * T))
    _canal(im, 1, 2, 3)
    _paste_cells(im, lock_cells(), 0, 0)
    return im


def plaza_scene():
    """광장(자갈길) 위 분수 · 포고 단 · 깃대 · 가로등 둘."""
    W, H = 12, 9
    im = Image.new("RGBA", (W * T, H * T))
    road = _sheet_tile(COBBLE)
    for y in range(H):
        for x in range(W): im.paste(road, (x * T, y * T))
    _paste_cells(im, fountain_cells(), 1, 1)
    _paste_cells(im, {(cx, cy): f"dais_{cx}_{cy}" for cx in range(4) for cy in range(2)}, 7, 4)
    return im


def single(cells, W, H, bg=None, pad=0):
    im = _grass(W + 2 * pad, H + 2 * pad) if bg == "grass" else Image.new("RGBA", ((W + 2 * pad) * T, (H + 2 * pad) * T))
    _paste_cells(im, cells, pad, pad, only="lower")
    _paste_cells(im, cells, pad, pad, only="upper")
    return im


def wall_mounted_scene():
    """성벽 앞면 세 열에 벽걸이 깃발 · 방패를 건 그림(투명 바탕)."""
    BW = _bw()
    W, H = 4, 6
    im = Image.new("RGBA", (W * T, H * T))
    for x in range(W):
        im.alpha_composite(BW.img(f"hs{x % 2}_a"), (x * T, 0)); im.alpha_composite(BW.img(f"hs{x % 2}_b"), (x * T, T))
        for i, r in enumerate(BW.FACE_ROWS): im.alpha_composite(BW.img(f"f_{r}_{'abef'[x]}"), (x * T, (2 + i) * T))
    _paste_cells(im, {(0, 0): "bwall_0_0", (0, 1): "bwall_0_1"}, 0, 2)
    _paste_cells(im, {(0, 0): "shield"}, 1, 2)
    _paste_cells(im, {(0, 0): "bwall_0_0", (0, 1): "bwall_0_1"}, 3, 2)
    return im


def gate_items():
    """(이름, 그림, 종류, 판정자에게 줄 이름, 덮는 조각 집합)."""
    tw = set(p["name"] for p in PIECES if p["name"].startswith("rtower"))
    def has(prefix): return any(p["name"].startswith(prefix) for p in PIECES)
    items = [
        ("capital_wall_towers", lambda: wall_with_towers(), "structure",
         "town wall ring, 3/4 top-down (16px tiles): crenellated wall-walk tops seen from above, ashlar front faces, a closed gatehouse; round drum towers with tall blue-slate "
         "conical shingle roofs (gold finial and small blue pennant), a corbel ring under the cone eave, curved ashlar courses and narrow windows — two flanking the gatehouse, "
         "one on each north corner, one on the south wall with a lit window", tw),
        ("capital_watergate_n", lambda: watergate_scene("N"), "structure",
         "town wall section, 3/4 top-down: wall-walk top seen from above, ashlar front face pierced by a double round-arched canal water gate (voussoirs, keystones, raised iron "
         "portcullis teeth in the arch heads, dark water tunnel), canal water flowing out below", {p["name"] for p in PIECES if p["name"].startswith("wgN")}),
        ("capital_watergate_s", lambda: watergate_scene("S"), "structure",
         "outer town wall section, 3/4 top-down: wall-walk top with front parapet seen from above, ashlar front face pierced by a double round-arched canal water gate "
         "(voussoirs, keystones, a royal blue-and-gold shield on the middle pier), canal entering above and flowing out below", {p["name"] for p in PIECES if p["name"].startswith("wgS")}),
        ("capital_fountain", lambda: single(fountain_cells(), 4, 4), "container",
         "plaza fountain, 3/4 top-down: round stone basin (rim top seen from above as an elliptical ring, curved ashlar front rim face), water surface with ripple rings inside, "
         "central pillar with two tiered bowls (their water seen from above) and a gold eight-point star finial, water streams falling", {p["name"] for p in PIECES if p["name"].startswith("fountain")}),
        ("capital_dais", lambda: single({(cx, cy): f"dais_{cx}_{cy}" for cx in range(4) for cy in range(2)}, 4, 2), "flat",
         "low raised stone proclamation platform on a plaza, 3/4 top-down: a large light flagstone top surface seen from above (rim stones, an inlaid blue disc with a gold star), "
         "a lit front edge, a short dark one-course front riser, and shadowed paving at its foot", {p["name"] for p in PIECES if p["name"].startswith("dais")}),
        ("capital_banner_pole", lambda: single({(0, y): f"bpole_0_{y}" for y in range(3)}, 1, 3), "other",
         "royal banner pole, 3/4 top-down: square stone foot (top face seen from above, front face), wooden pole with iron bands, gold spear-tip finial, crossbar with a hanging "
         "blue banner (gold border, gold crown over a gold eight-point star, swallowtail)", {"bpole_0_0", "bpole_0_1", "bpole_0_2"}),
        ("capital_wall_heraldry", lambda: wall_mounted_scene(), "wall_mounted",
         "blue heraldic banners on iron rods and a blue-and-gold shield hung flat on an ashlar town wall face (gold crown over a gold eight-point star)",
         {"bwall_0_0", "bwall_0_1", "shield"}),
        ("capital_lamp", lambda: single({(0, y): f"lamp_0_{y}" for y in range(3)}, 1, 3), "other",
         "royal street lamp, 3/4 top-down: square stone pedestal (top face seen from above, front face with a small blue plaque), dark iron post with gold bands, "
         "an octagonal lantern with warm lit glass and a gold crown cap", {"lamp_0_0", "lamp_0_1", "lamp_0_2"}),
        ("capital_lamp_double", lambda: single({(cx, y): f"lamp2_{cx}_{y}" for cx in range(2) for y in range(3)}, 2, 3), "other",
         "royal double street lamp, 3/4 top-down: square stone pedestal (top face seen from above), iron post with gold bands and a gold star finial, a curled crossarm with "
         "a crowned lantern hanging at each end (warm lit glass)", {p["name"] for p in PIECES if p["name"].startswith("lamp2")}),
        ("capital_quay_steps", lambda: quay_scene(), "terrain",
         "four-tile-wide stone-edged canal between two cobbled banks, 3/4 top-down: on each bank a narrow flight of stone quay steps cut into the bank, descending south "
         "into the water (landing slabs at bank level, lit treads and dark risers, the last step submerged)", {p["name"] for p in PIECES if p["name"].startswith("quay")}),
        ("capital_canal_lock", lambda: lock_scene(), "structure",
         "canal lock across a four-tile-wide stone-edged canal, 3/4 top-down: upper water, a plank walkway with an iron railing on top of the lock gates (seen from above), "
         "the south face of two heavy timber lock gates with iron straps meeting in the middle, water spilling from two sluices into foam below; a wooden capstan on each bank",
         {p["name"] for p in PIECES if p["name"].startswith(("lock", "capstan"))}),
    ]
    keep = {"capital_wall_towers": has("rtower"), "capital_watergate_n": has("wgN_"), "capital_watergate_s": has("wgS_"), "capital_fountain": has("fountain_"),
            "capital_dais": has("dais_"), "capital_banner_pole": has("bpole_"), "capital_wall_heraldry": has("bwall_"), "capital_lamp": has("lamp_0_"),
            "capital_lamp_double": has("lamp2_"), "capital_quay_steps": has("quay"), "capital_canal_lock": has("lock_")}
    return [(n, make(), kind, label, keys) for n, make, kind, label, keys in items if keep[n]]


# ---------------------------------------------------------------- 표 쓰기
def palette_problems():
    sheet = Image.open(SHEET_PATH).convert("RGBA").crop((0, 0, COLS * T, PALETTE_ROWS * T))
    allowed = {c for _n, c in sheet.getcolors(1 << 24)}
    bad = {}
    for p in PIECES:
        for _n, c in p["img"].getcolors(1 << 16):
            if c[3] and c not in allowed: bad.setdefault(c, []).append(p["name"])
    return bad


def pass_flag(s):
    return {"up": "U" in s, "down": "D" in s, "left": "L" in s, "right": "R" in s}


def group_of(n):
    if n.startswith(("rtower", "wg")): return "wall"
    if n.startswith(("quay", "lock", "capstan")): return "canal"
    return "plaza"


def write_tables():
    TS = json.loads(TS_PATH.read_text())
    empty = dict(label="", description="", source="bundled-default")
    for k in ("passability", "priority", "terrain", "tileMeta"):
        TS[k] = TS[k][:BASE]
        while len(TS[k]) < BASE:      # 앞 꼬리 끝 ~ 32,767(빈 자리)은 빈 칸으로 채운다
            TS[k].append({"passability": pass_flag("UDLR"), "priority": "lower", "terrain": 0, "tileMeta": dict(empty)}[k])
    TS["animationStrips"] = [s for s in TS["animationStrips"] if s["baseTile"] < BASE]
    for i in range(ROWS_ADDED * COLS):
        if i >= len(PIECES):
            TS["passability"].append(pass_flag("UDLR")); TS["priority"].append("lower"); TS["terrain"].append(0); TS["tileMeta"].append(dict(empty)); continue
        p = PIECES[i]
        TS["passability"].append(pass_flag(p["pass_"]))
        TS["priority"].append("upper" if p["star"] else "lower")
        TS["terrain"].append(0)
        passage = "star" if p["star"] else ("solid" if not p["pass_"] else "passable")
        dirs = "".join(n for c, n in (("U", "북"), ("D", "남"), ("L", "서"), ("R", "동")) if c in p["pass_"])
        desc = p["desc"] + (f". 걸음 방향: {dirs}" if p["pass_"] and not p["star"] else (". 사람 위에 그려진다(★)" if p["star"] else ". 막힘")) + f". 조각 `{p['name']}`."
        TS["tileMeta"].append(dict(label=f"버들항 왕도 · {p['name']}", description=desc, tags=["버들항", "왕도", "capital", p["name"].split("_")[0].split("@")[0]],
                                   defaultLayer=p["layer"], passage=passage, source="bundled-default"))
        if p.get("frames"): TS["animationStrips"].append(dict(baseTile=tid(p["name"]), frames=p["frames"], fps=FPS))
    TS["count"] = COUNT
    ids = lambda g: [tid(p["name"]) for p in PIECES if "@" not in p["name"] and group_of(p["name"]) == g]
    groups = [
        dict(id="beodeul:capital_wall", name="왕도 둥근 성벽 탑 · 운하 수문", role="object", source="bundled-default", defaultLayer="upper", confidence="high", tileIds=ids("wall"),
             description="3판 성벽에 끼우는 파란 원뿔 둥근 탑 3×11(rtower_* · 불 켠 창 rtowerL_* · 모서리 바깥 열 rtower{w,e}_*)과 운하 수문 쌍아치 앞면 4×4(wgN_* 북쪽 안쪽 면 · wgS_* 남쪽 바깥 면).",
             placementRules=TOWER_RULES + " 수문은 성벽 앞면 네 줄 × 운하 네 열을 바꾼다. 키트 bd-capital-round-tower* · bd-capital-watergate-n/-s 로 통째로 찍는다."),
        dict(id="beodeul:capital_plaza", name="왕도 광장 분수 · 포고 단 · 왕실 깃발 · 가로등", role="object", source="bundled-default", defaultLayer="upper", confidence="high", tileIds=ids("plaza"),
             description="광장 분수 4×4(움직임 세 프레임), 포고 단 4×2(바닥 층, 걷는다), 아스텔 왕실 깃대 1×3 · 벽걸이 깃발 1×2 · 방패 1×1, 왕실 가로등 1×3 · 쌍등 2×3.",
             placementRules="키트 bd-capital-fountain · -dais · -banner-pole · -banner-wall · -shield · -lamp · -lamp-double 로 통째로 찍는다."),
        dict(id="beodeul:capital_canal", name="왕도 운하 선착 계단 · 갑문", role="object", source="bundled-default", defaultLayer="lower", confidence="high", tileIds=ids("canal"),
             description="운하 둑 선착 계단 1×3(서·동 둑, 바닥 층)과 운하 갑문(가운데 4칸 바닥 층 + 양쪽 둑 물레).",
             placementRules="키트 bd-capital-quay-steps-w/-e · bd-capital-canal-lock 로 통째로 찍는다."),
    ]
    TS["tileGroups"] = [g for g in TS["tileGroups"] if not g["id"].startswith("beodeul:capital")] + [g for g in groups if g["tileIds"]]
    TS["structureKits"] = [k for k in TS["structureKits"] if not k["id"].startswith("bd-capital-") or k["id"].startswith("bd-capital-mansion-")] + kits()
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=COUNT, tilesPerRow=COLS)) + "\n")
    PIECES_JSON.write_text(json.dumps(dict(base=BASE, count=COUNT, tiles={p["name"]: tid(p["name"]) for p in PIECES if "@" not in p["name"]},
                                           lower=[p["name"] for p in PIECES if p["layer"] == "lower"],
                                           kits=[k["id"] for k in kits()]), ensure_ascii=False, indent=0) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-export", help="3/4 관문용 조립 그림 PNG 와 items.jsonl 을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--samples", help="확인용 조립 그림을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--no-gate", action="store_true", help="관문 영수증 확인 없이 굽는다(개발 중 시험용)")
    args = ap.parse_args()

    bad = palette_problems()
    if bad:
        for c, names in bad.items(): print("팔레트 밖 색", "#%02x%02x%02x" % c[:3], c[3], names[:4], len(names), file=sys.stderr)
        sys.exit(3)
    if args.gate_export or args.samples:
        out = pathlib.Path(args.gate_export or args.samples); out.mkdir(parents=True, exist_ok=True)
        lines = []
        for name, im, kind, label, _keys in gate_items():
            p = out / f"{name}.png"; im.save(p)
            lines.append(dict(png=str(p), kind=kind, name=label, label=f"beodeul_city/capital/{name}"))
        if args.gate_export:
            (out / "items.jsonl").write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in lines) + "\n")
        print("gate export" if args.gate_export else "samples", len(lines), "->", out)
        return

    if not args.no_gate:
        import object_gate as OG
        covered, why = set(), {}
        for name, im, kind, _label, keys in gate_items():
            r = OG.refusal(im, kind=kind, context="bundle")
            if r: why[name] = r
            else: covered |= keys
        same = {}
        for p in PIECES: same.setdefault(p["img"].tobytes(), set()).add(p["name"])
        for names in same.values():
            if names & covered: covered |= names
        missing = sorted({n.split("@")[0] for n in INDEX} - covered)
        if missing:
            print("3/4 관문 미통과 — 굽지 않는다:", file=sys.stderr)
            for k, v in why.items(): print("  ", k, "←", v, file=sys.stderr)
            print("   덮이지 않은 조각:", missing[:20], len(missing), file=sys.stderr)
            sys.exit(2)

    sheet = Image.open(SHEET_PATH).convert("RGBA")
    if sheet.height < PALETTE_ROWS * T: sys.exit(f"시트가 {PALETTE_ROWS}행보다 짧다 — 앞 꼬리(성벽·마당)부터 굽는다")
    out_sheet = Image.new("RGBA", (COLS * T, (BASE_ROW + ROWS_ADDED) * T), (0, 0, 0, 0))
    out_sheet.alpha_composite(sheet.crop((0, 0, COLS * T, min(sheet.height, BASE_ROW * T))), (0, 0))
    for i, p in enumerate(PIECES):
        out_sheet.alpha_composite(p["img"], ((i % COLS) * T, (BASE_ROW + i // COLS) * T))
    out_sheet.save(SHEET_PATH, optimize=True)
    _SH.clear()
    write_tables()
    print(json.dumps(dict(base=BASE, count=COUNT, pieces=len(PIECES), rows=ROWS_ADDED, kits=[k["id"] for k in kits()]), ensure_ascii=False))


if __name__ == "__main__":
    main()
