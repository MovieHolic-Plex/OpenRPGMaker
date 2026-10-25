#!/usr/bin/env python3
"""버들항 마당 바닥 — 버들항 시트 꼬리(33,152~, 두 행 256칸)에 마당 오토타일 세 벌(자갈·다진 흙·판석)을 덧붙여 굽는다.

  python3 scripts/content/beodeul-yard/bake_yard.py --gate-export DIR   # 3/4 관문에 낼 표본 PNG + items.jsonl 만 쓴다
  python3 scripts/content/beodeul-yard/bake_yard.py --samples DIR       # 확인용 표본(1배·3배) + 비교판만 쓴다
  python3 scripts/content/beodeul-yard/bake_yard.py                     # 관문을 확인하고 굽는다(막히면 exit 2)
  python3 scripts/content/beodeul-yard/bake_yard.py --dev               # 관문이 막혀도 굽는다(크게 경고) — 감독 로컬 개발 전용, 번들 커밋 금지

입력  yard_art.py (행 문자열 손 도트)
출력  public/assets/beodeul-city/beodeul-city-chipset.png — 앞 259행(33,152칸)은 그대로, 뒤 1행(128칸)
      src/assets/beodeulCityTileset.json · beodeulCitySheet.json — 칸 표 + 오토타일 beodeul_yard_* + 칸 묶음 beodeul:yard_* + 키트 bd-yard-*
덧붙이기 전용: 앞 칸 번호는 바뀌지 않는다. 다시 돌려도 같은 결과(멱등).
bake_wall.py(28,544~)가 시트를 다시 쓰면 이 꼬리가 사라지므로 그 끝에서 이 스크립트를 다시 부른다.

3/4 관문(hard rule): 표면마다 표본 덩이 그림이 object_gate.refusal(img, kind="terrain", context="bundle") 가 None 이어야 굽는다
(서명된 사람·위임 허용 또는 보정된 프로필의 pass). 이 스크립트는 허용 파일을 쓰지 않는다.
"""
import argparse, json, pathlib, sys

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import yard_art as A  # noqa: E402
import vine_art as V  # noqa: E402
import flag_dirt_art as FD  # noqa: E402

ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "src/harnesses/_core"))
SHEET_PATH = ROOT / "public/assets/beodeul-city/beodeul-city-chipset.png"
TS_PATH = ROOT / "src/assets/beodeulCityTileset.json"
SHEET_JSON = ROOT / "src/assets/beodeulCitySheet.json"
T = 16
COLS = 128
BASE = 33152          # 던전 주제 꼬리(bake_theme.py, 30,848~33,151) 끝 = 마당 시작. 2026-10-24 main 의 gap·주제 꼬리가 29,568~ 를 먼저 차지해 옮겼고, 2026-10-25 주제 꼬리가 한 행 늘어 33,024 → 33,152
BASE_ROW = BASE // COLS
ROWS_ADDED = 2         # 2026-10-23: 판석→흙 가장자리(129칸)를 덧붙이며 한 행 더(BASE+128~BASE+255). 이식 칸은 localTailRelocation 이 민다.
COUNT = BASE + ROWS_ADDED * COLS
GATE_KIND = "terrain"
SURFACES = ["cobble", "dirt", "flag"]
ORDER = A.ORDER       # body, body2..body8, N, S, W, E, NW, NE, SW, SE, iso, inNW, inNE, inSE, inSW
PER = len(ORDER)
assert PER == 21 and PER * len(SURFACES) <= COLS

KO = {"cobble": "자갈", "dirt": "다진 흙", "flag": "판석"}
ROLE_KO = {"body": "몸통", "body2": "몸통 변형 2", "body3": "몸통 변형 3", "body4": "몸통 변형 4", "body5": "몸통 변형 5", "body6": "몸통 변형 6", "body7": "몸통 변형 7", "body8": "몸통 변형 8",
           "N": "위쪽 가장자리", "S": "아래쪽 가장자리(앞면)", "W": "왼쪽 가장자리", "E": "오른쪽 가장자리",
           "NW": "왼쪽 위 모서리", "NE": "오른쪽 위 모서리", "SW": "왼쪽 아래 모서리", "SE": "오른쪽 아래 모서리",
           "iso": "외딴 한 칸", "inNW": "오목 모서리(왼쪽 위)", "inNE": "오목 모서리(오른쪽 위)", "inSE": "오목 모서리(오른쪽 아래)",
           "inSW": "오목 모서리(왼쪽 아래)",
           "N2": "위쪽 가장자리 둘째 벌", "S2": "아래쪽 가장자리(앞면) 둘째 벌", "W2": "왼쪽 가장자리 둘째 벌", "E2": "오른쪽 가장자리 둘째 벌"}
GROUP_ID = {s: f"beodeul_yard_{s}" for s in SURFACES}
DESC = {
    "cobble": "시골 작업 마당 강자갈(둥글고 따뜻한 돌, 흙 줄눈, 낮은 다듬은 연석 테와 남쪽 2px 앞면). 시장·대장간·광산 마당.",
    "dirt": "다진 흙 마당(붉은 갈색 다진 흙, 희미한 바퀴 자국·발자국·잔돌·지푸라기, 남쪽 흙둑 그늘). 광산·포도밭·농가 마당. 버들항 모랫길·농장 흙길과 다른 색.",
    "flag": "판석 뜰(크고 들쭉날쭉한 옅은 석회암 판석, 줄눈 이끼, 금 간·내려앉은 판석, 낮은 연석 테와 남쪽 앞면). 신전 폐허 뜰. 버들항 광장 판석과 다른 결.",
}
RULES = {
    "cobble": "쓰임 조각(제련소·갱구·대장간·시장 노점)을 둘 마당 한 덩이로 칠한다. 이어 칠하면 가장자리·모서리(오목 포함)가 저절로 맞는다. 몸통은 변형 여덟이 위치 해시로 섞인다. 큰길(포석)·모랫길·흙길과 이어진다. 1칸 폭 줄로 칠하지 않는다(양쪽 가장자리를 함께 그릴 칸이 없다).",
    "dirt": "광산·포도밭·농가의 일하는 마당 한 덩이로 칠한다(건물·쓰임 조각 앞 3~6칸 깊이). 밭(경작지)과 섞지 않는다. 1칸 폭 줄로 칠하지 않는다 — 1~2칸 길은 농장 흙길·모랫길 오토타일을 쓴다.",
    "flag": "신전·폐허 앞뜰을 한 덩이로 칠하고 기둥·무너진 벽·사당을 그 위에 둔다. 마을 광장에는 버들항 광장 판석을 쓴다. 1칸 폭 줄로 칠하지 않는다.",
}


ALT_BASE = BASE + PER * len(SURFACES)   # 곧은 가장자리 둘째 벌(자갈·판석)은 세 표면 뒤에 덧붙인다: 자갈 N2 S2 W2 E2, 판석 N2 S2 W2 E2
assert ALT_BASE + len(A.ALT_ORDER) * len(A.EDGE_ALT_SURFACES) <= BASE + COLS
VINE_BASE = ALT_BASE + len(A.ALT_ORDER) * len(A.EDGE_ALT_SURFACES)   # BASE+71 — 포도나무 줄(vine_art.py 2판, 두 칸 높이) 열여섯 칸
# 29,639~29,646 = 위 칸 줄(잎 지붕 윗면) 왼쪽 끝 · 가운데 여섯 · 오른쪽 끝, 29,647~29,654 = 아래 칸 줄(앞면·줄기·그늘) 같은 순서.
# (1판 한 칸 높이 줄이 29,639~29,646 을 썼으나 게시 전이라 2판이 같은 번호를 이어 쓴다.)
assert VINE_BASE == BASE + 71 and VINE_BASE + len(V.PARTS) * len(V.ORDER) <= BASE + COLS
# 판석→다진 흙 가장자리(flag_dirt_art.py r7): 포도나무 줄 뒤 129칸. 몸통 여덟은 판석 몸통 칸을 그대로 쓴다.
FD_BASE = VINE_BASE + len(V.PARTS) * len(V.ORDER)   # BASE+87
FD_GROUP = "beodeul_yard_flag_dirt"
assert FD_BASE == BASE + 87 and FD_BASE + len(FD.NEW_ROLES) <= BASE + ROWS_ADDED * COLS
FD_GATE_NAME = FD.GATE_NAME
VINE_GATE_KIND = "organic"
VINE_GROUP = "beodeul:vine_row"
VINE_KO = {"left": "왼쪽 끝(끝 기둥·버팀 철사)", "right": "오른쪽 끝(끝 기둥·버팀 철사)", "mid": "가운데", "mid-post": "가운데(중간 기둥)"}
VINE_PART_KO = {"top": "위 칸(잎 지붕 윗면)", "front": "아래 칸(잎 앞면·포도송이·철사·줄기·흙 그늘)"}
VINE_DESC = ("철사에 올려 가꾼 포도나무 한 줄, 두 칸 높이(3/4 탑뷰: 위 칸은 위에서 내려다본 넓고 밝은 잎 지붕, 칸 경계에서 둥근 잎 덩이 턱으로 "
             "말려 앞으로 꺾이고, 아래 칸은 짙은 잎 앞면에 높이가 다른 포도송이 · 철사 · 굵은 줄기와 기둥 · 흙에 진 그늘). "
             "다진 흙 마당 위에 위층으로 얹는다.")
VINE_RULES = ("한 줄 = 두 칸 높이. 위 칸 줄은 왼쪽 끝 " f"{VINE_BASE}" " + 가운데 여럿 + 오른쪽 끝 " f"{VINE_BASE + 7}" ", 바로 아래 칸 줄은 같은 순서로 +8 번호"
              f"(위 칸 t 밑에는 반드시 t+8). 가운데({VINE_BASE + 1}~{VINE_BASE + 6})는 어떤 순서로 이어도 이음새가 없다 — 같은 칸을 둘 잇지 말고, "
              f"중간 기둥 칸({VINE_BASE + 2}·{VINE_BASE + 5})은 두세 칸에 하나만. 줄 사이는 흙 한 칸 길을 둔다(줄 간격 3칸). 아래층은 다진 흙 마당(beodeul_yard_dirt) 몸통. "
              "위 칸은 지나가며 가려지는 잎(☆), 아래 칸은 줄기·철사라 막힌다.")


def tid(surface, role):
    if role in A.ALT_ORDER:
        return ALT_BASE + A.EDGE_ALT_SURFACES.index(surface) * len(A.ALT_ORDER) + A.ALT_ORDER.index(role)
    return BASE + SURFACES.index(surface) * PER + ORDER.index(role)


def roles_of(surface):
    return ORDER + (A.ALT_ORDER if surface in A.EDGE_ALT_SURFACES else [])


def cells():
    S = A.surfaces()
    return {tid(s, r): (A.img_of(S[s][r]), s, r) for s in SURFACES for r in roles_of(s)}


def fd_tid(role):
    if role in FD.NEW_ROLES: return FD_BASE + FD.NEW_ROLES.index(role)
    return tid("flag", role)     # 몸통 여덟 = 판석 몸통


def fd_cells():
    t = FD.tiles()
    return {fd_tid(r): (t[r], r) for r in FD.NEW_ROLES}


def fd_variant_map():
    return {str(m): fd_tid(mask_role(m)) for m in range(256)}


def vine_tid(name, part="top"):
    return VINE_BASE + V.PARTS.index(part) * len(V.ORDER) + V.ORDER.index(name)


def vine_cells():
    t = V.tiles()
    return {vine_tid(k, p): (V.img_of(t[(k, p)]), k, V.ROLE_OF[k], p) for p in V.PARTS for k in V.ORDER}


VINE_GATE_NAME = ("vineyard vine rows on packed-earth yard: trained grapevines on a low wire trellis, each row two tiles tall, seen 3/4 top-down — "
                  "the upper tile is the broad leafy canopy top plane seen from above (low round leaf clumps, lit from the upper left, lighter at the back) "
                  "that rolls over into a lip of brighter round clumps across the tile boundary; the lower tile is the darker front face with hanging purple grape bunches (light glint pixel), "
                  "a wire, thick short trunks and posts, and a shadow on the ground; thick end posts at each row end with their caps above the canopy; dirt paths between rows")


def vine_gate_image():
    return V.sample()


def vine_kit():
    seq = V.row_strip(6, 0)
    W = len(seq)
    return dict(id="bd-yard-vine-row-sample", kind="section", name=f"버들항 포도나무 줄 표본 {W}×2", width=W, height=2, tileSize=16,
                rows=[dict(tiles=[-1] * W, upperTiles=[vine_tid(k, p) for k in seq]) for p in V.PARTS], learnedFrom="db-authored",
                ai=dict(description="포도나무 한 줄(두 칸 높이: 왼쪽 끝 · 가운데 · 오른쪽 끝) 표본. " + VINE_DESC,
                        placementRules=VINE_RULES, tags=["버들항", "포도밭", "vineyard", "vine"], role="prop", repeatability="repeatable",
                        layerHome="upper", themes=["village", "vineyard", "마을"]))


def mask_role(m):
    N, E, S, W = m & 1, m & 2, m & 4, m & 8
    NE, SE, SW, NW = m & 16, m & 32, m & 64, m & 128
    if not (N or E or S or W): return "iso"
    if N and E and S and W:
        for ok, k in ((NW, "inNW"), (NE, "inNE"), (SE, "inSE"), (SW, "inSW")):
            if not ok: return k
        return "body"
    if not N and not W: return "NW"
    if not N and not E: return "NE"
    if not S and not W: return "SW"
    if not S and not E: return "SE"
    if not N: return "N"
    if not S: return "S"
    if not W: return "W"
    return "E"


def phase_variants(surface):
    """2×2 위치 위상: maps[py*2+px] = 마스크 → 곧은 가장자리 둘째 벌. 없는 키는 variantMap 으로 내려간다."""
    maps = []
    for py in range(2):
        for px in range(2):
            table = {}
            for m in range(256):
                r = mask_role(m)
                alt = A.phase_role(surface, r, px, py)
                if alt != r: table[str(m)] = tid(surface, alt)
            maps.append(table)
    return dict(w=2, h=2, maps=maps)


def variant_map(surface):
    vm = {}
    for m in range(256):
        N, E, S, W = m & 1, m & 2, m & 4, m & 8
        NE, SE, SW, NW = m & 16, m & 32, m & 64, m & 128
        if not (N or E or S or W): t = "iso"
        elif N and E and S and W:
            t = "body"
            for ok, k in ((NW, "inNW"), (NE, "inNE"), (SE, "inSE"), (SW, "inSW")):
                if not ok: t = k; break
        elif not N and not W: t = "NW"
        elif not N and not E: t = "NE"
        elif not S and not W: t = "SW"
        elif not S and not E: t = "SE"
        elif not N: t = "N"
        elif not S: t = "S"
        elif not W: t = "W"
        else: t = "E"
        vm[str(m)] = tid(surface, t)
    return vm


def gate_items():
    return [(f"yard_{s}", A.sample(s, A.SAMPLE_GRID), A.GATE_NAME[s], s) for s in SURFACES]


def sample_kit(surface):
    G = A.SAMPLE_GRID
    on = {(x, y) for y, r in enumerate(G) for x, c in enumerate(r) if c == "#"}
    xs = [x for x, _ in on]; ys = [y for _, y in on]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    W, H = x1 - x0 + 1, y1 - y0 + 1
    rows = []
    for y in range(y0, y1 + 1):
        lower = []
        for x in range(x0, x1 + 1):
            if (x, y) not in on: lower.append(-1); continue
            r = A.phase_role(surface, A.role_for(on, x, y), x, y)
            if r == "body": r = (["body"] + A.VARIANTS)[A._h(x, y) % (1 + len(A.VARIANTS))]
            lower.append(tid(surface, r))
        rows.append(dict(tiles=lower, upperTiles=[-1] * W))
    return dict(id=f"bd-yard-{surface}-sample", kind="section", name=f"버들항 마당 · {KO[surface]} 표본 {W}×{H}",
                width=W, height=H, tileSize=16, rows=rows, learnedFrom="db-authored",
                ai=dict(description=f"{KO[surface]} 마당 오토타일을 이어 칠한 표본 덩이(볼록·오목 모서리, 풀 구멍, 외딴 칸, 남쪽 목). " + DESC[surface],
                        placementRules="풀 위에 아래층으로 찍는다(바깥 칸은 비어 있어 바탕이 보인다). 보통은 그룹 " + GROUP_ID[surface] + " 로 원하는 모양을 직접 칠한다. " + RULES[surface],
                        tags=["버들항", "마당", "yard", surface], role="terrain", repeatability="fixed", layerHome="lower",
                        themes=["village", "town", "마을"]))


def write_samples(out):
    out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
    for name, im, _label, _s in gate_items():
        im.save(out / f"{name}.png")
        im.resize((im.width * 3, im.height * 3), Image.NEAREST).save(out / f"{name}-3x.png")
    A.compare(str(out / "compare-3x.png"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gate-export", help="3/4 관문용 표본 PNG 와 items.jsonl 을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--samples", help="확인용 표본(1배·3배)과 비교판을 이 폴더에 쓰고 끝낸다")
    ap.add_argument("--dev", action="store_true", help="관문이 막혀도 굽는다(경고) — 감독 로컬 개발 전용, 이 결과를 커밋하지 않는다")
    args = ap.parse_args()

    if args.gate_export:
        lines = A.gate_export(args.gate_export)
        d = pathlib.Path(args.gate_export)
        vp = d / "vine_rows.png"
        vine_gate_image().save(vp)
        lines.append(dict(png=str(vp.resolve()), kind=VINE_GATE_KIND, name=VINE_GATE_NAME, label="beodeul_yard/vine_rows"))
        (d / "items.jsonl").write_text("\n".join(json.dumps(l, ensure_ascii=False) for l in lines) + "\n")
        for l in lines: print(l["png"])
        return
    if args.samples:
        write_samples(args.samples); print("samples ->", args.samples)
        return

    ok, miss = A.palette_check()
    if not ok: sys.exit(f"팔레트 검사 실패: {miss}")

    # ---- 관문 ----
    import object_gate as OG
    why = {}
    for name, im, _label, s in gate_items():
        r = OG.refusal(im, kind=GATE_KIND, context="bundle")
        if r: why[s] = r
    vr = OG.refusal(vine_gate_image(), kind=VINE_GATE_KIND, context="bundle")
    if vr: why["vine_rows"] = vr
    fr = OG.refusal(FD.gate_image(), kind=FD.GATE_KIND, context="bundle")
    if fr: why["flag_dirt"] = fr
    if why:
        print("3/4 관문 미통과:", file=sys.stderr)
        for k, v in why.items(): print("  ", k, "←", v, file=sys.stderr)
        if not args.dev: sys.exit(2)
        bar = "!" * 78
        print(f"\n{bar}\n!! --dev: 관문 미통과 표면({', '.join(why)})을 그래도 굽는다. 로컬 개발 전용 — 이 시트·JSON 을 커밋하지 말 것.\n{bar}\n", file=sys.stderr)

    # ---- 시트 ----
    sheet = Image.open(SHEET_PATH).convert("RGBA")
    if sheet.width != COLS * T: sys.exit(f"시트 폭 {sheet.width} ≠ {COLS * T}")
    if sheet.height < BASE_ROW * T: sys.exit(f"시트가 {BASE_ROW}행보다 짧다({sheet.height // T}행) — 성벽 꼬리(bake_wall.py)부터 굽는다")
    out_sheet = Image.new("RGBA", (COLS * T, (BASE_ROW + ROWS_ADDED) * T), (0, 0, 0, 0))
    out_sheet.alpha_composite(sheet.crop((0, 0, COLS * T, BASE_ROW * T)), (0, 0))
    C = cells()
    VC = vine_cells()
    FC = fd_cells()
    for t, im in [(t, v[0]) for t, v in C.items()] + [(t, v[0]) for t, v in VC.items()] + [(t, v[0]) for t, v in FC.items()]:
        i = t - BASE
        out_sheet.alpha_composite(im, ((i % COLS) * T, (BASE_ROW + i // COLS) * T))
    out_sheet.save(SHEET_PATH, optimize=True)

    # ---- 칸 표 ----
    TS = json.loads(TS_PATH.read_text())
    for k in ("passability", "priority", "terrain", "tileMeta"):
        assert len(TS[k]) >= BASE, (k, len(TS[k]))
        TS[k] = TS[k][:BASE]
    TS["animationStrips"] = [s for s in TS.get("animationStrips", []) if s["baseTile"] < BASE]
    yes = {d: True for d in ("up", "down", "left", "right")}
    empty = dict(label="", description="", source="bundled-default")
    for i in range(ROWS_ADDED * COLS):
        t = BASE + i
        TS["passability"].append(dict(yes)); TS["priority"].append("lower"); TS["terrain"].append(0)
        if t in VC:
            _im, k, role, part = VC[t]
            if part == "front": TS["passability"][-1] = {d: False for d in yes}
            else: TS["priority"][-1] = "upper"
            TS["tileMeta"].append(dict(label=f"버들항 포도나무 줄 · {VINE_PART_KO[part]} · {VINE_KO[role]}",
                                       description=f"{VINE_DESC} {VINE_PART_KO[part]}의 {VINE_KO[role]} 칸({k}). "
                                                   + ("지나가며 가려지는 잎." if part == "top" else f"막힘. 바로 위에는 {vine_tid(k, 'top')}."),
                                       tags=["버들항", "포도밭", "vineyard", "vine", role, part], defaultLayer="upper",
                                       passage="star" if part == "top" else "solid", source="bundled-default"))
            continue
        if t in FC:
            role = FC[t][1]
            TS["tileMeta"].append(dict(label=f"버들항 마당 · 무너진 판석→흙 · {role}",
                                       description=f"신전 폐허 판석이 다진 흙 마당으로 무너지는 가장자리(연석 없음, 판 단위로 깨지고 빠짐). 오토타일 `{FD_GROUP}` 의 {role}. 걸음.",
                                       tags=["버들항", "마당", "yard", "flag", "ruin"], defaultLayer="lower", passage="passable", source="bundled-default"))
            continue
        if t not in C: TS["tileMeta"].append(dict(empty)); continue
        _im, s, r = C[t]
        TS["tileMeta"].append(dict(label=f"버들항 마당 · {KO[s]} · {r}",
                                   description=f"{DESC[s]} 오토타일 `{GROUP_ID[s]}` 의 {ROLE_KO[r]}. 걸음.",
                                   tags=["버들항", "마당", "yard", s], defaultLayer="lower", passage="passable", source="bundled-default"))
    TS["count"] = COUNT

    # ---- 오토타일·칸 묶음·키트 ----
    others = sorted({t for g in TS["autotileGroups"] if g["id"] in ("beodeul_road_autotile", "beodeul_sand_autotile", "beodeul_farm_lane")
                     for t in g["memberTileIds"]})
    groups = []
    for s in SURFACES:
        members = [tid(s, r) for r in roles_of(s)]
        groups.append(dict(id=GROUP_ID[s], name="버들항 마당 — 자갈 / 다진 흙 / 판석", neighborhood=8, memberTileIds=members,
                           connectTileIds=sorted(set(members + others)), variantMap=variant_map(s),
                           interiorVariants=[[tid(s, v) for v in ["body"] + A.VARIANTS]],
                           **(dict(phaseVariants=phase_variants(s)) if s in A.EDGE_ALT_SURFACES else {})))
    # 판석→흙 가장자리: 판석 섬은 이 그룹끼리만 이어지고(바깥은 흙 그림), 흙 마당은 이 칸들을 마당으로 친다(흙 가장자리가 판석 쪽에 잔디 테를 그리지 않게).
    fd_members = [fd_tid(r) for r in FD.ORDER]
    for g in groups:
        if g["id"] == GROUP_ID["dirt"]: g["connectTileIds"] = sorted(set(g["connectTileIds"]) | set(fd_members))
    groups.append(dict(id=FD_GROUP, name="버들항 마당 — 무너진 판석(흙 마당 안)", neighborhood=8, memberTileIds=fd_members,
                       connectTileIds=sorted(set(fd_members)), variantMap=fd_variant_map(),
                       interiorVariants=[[tid("flag", v) for v in ["body"] + A.VARIANTS]]))
    TS["autotileGroups"] = [g for g in TS["autotileGroups"] if g["id"] not in GROUP_ID.values() and g["id"] != FD_GROUP] + groups
    TS["tileGroups"] = [g for g in TS["tileGroups"] if not g["id"].startswith("beodeul:yard_") and g["id"] != VINE_GROUP] + [
        dict(id=f"beodeul:yard_{s}", name=f"버들항 마당 · {KO[s]}", role="ground", source="bundled-default",
             tileIds=[tid(s, r) for r in roles_of(s)], defaultLayer="lower", confidence="high",
             description=f"{DESC[s]} 8이웃 오토타일 `{GROUP_ID[s]}`(가장자리 바깥은 잔디 737 화소, 몸통 변형 여덟). 대표 몸통 {tid(s, 'body')}.",
             placementRules=RULES[s])
        for s in SURFACES] + [
        dict(id=VINE_GROUP, name="버들항 포도나무 줄", role="prop", source="bundled-default",
             tileIds=[vine_tid(k, p) for p in V.PARTS for k in V.ORDER], defaultLayer="upper", confidence="high",
             description=f"{VINE_DESC} 위 칸 줄: 왼쪽 끝 {vine_tid('left')} · 가운데 {', '.join(str(vine_tid(k)) for k in V.ORDER[1:-1])}"
                         f"(중간 기둥 {', '.join(str(vine_tid(k)) for k in V.ORDER if V.ROLE_OF[k] == 'mid-post')}) · 오른쪽 끝 {vine_tid('right')}. "
                         f"아래 칸 줄: 각 위 칸 번호 +8({vine_tid('left', 'front')}~{vine_tid('right', 'front')}).",
             placementRules=VINE_RULES)]
    TS["structureKits"] = [k for k in TS["structureKits"] if not k["id"].startswith("bd-yard-")] + [sample_kit(s) for s in SURFACES] + [vine_kit()]
    TS_PATH.write_text(json.dumps(TS, ensure_ascii=False, separators=(",", ":")) + "\n")
    SHEET_JSON.write_text(json.dumps(dict(count=COUNT, tilesPerRow=COLS)) + "\n")
    print(json.dumps(dict(count=COUNT, cells=len(C), groups=list(GROUP_ID.values()), gateBlocked=sorted(why), dev=args.dev), ensure_ascii=False))


if __name__ == "__main__":
    main()
