#!/usr/bin/env python3
"""3/4 시점 계약 검사기 — 조각이 「정면 입면도」인지 「3/4 뷰」인지 윗면/앞면 비율로 잰다.

계약은 tiledata/atlas-pick/modern-style-bible.md 「10. 3/4 시점 계약」. 요약:
  윗면(밝은 단 +1~+2)의 세로 두께 T 는 발자국 깊이에서 나오고, 앞면 높이 F 는 실제 높이에서 나온다.
  T/F 가 종류별 범위 밖이면 경고한다.
    FRONT    T/F 가 너무 작다 — 정면 입면도(윗면이 앞 얼굴 위 가는 띠). 이번 사용자 지적의 본체.
    NOTOP    윗면이 아예 안 보인다(앞면만).
    TOPDOWN  T/F 가 너무 크다 — 위에서 내려다본 그림(앞면이 거의 없음).
    OK       범위 안.  EXEMPT  잴 수 없는 조각(바닥·데칼·벽걸이·얇은 기둥·나무·킷 부품).

잰 방법(열 단위, 팔레트에 의존하지 않는 밝기 기준이라 일본 세트 팔레트에도 쓴다):
  1. 조각의 불투명 영역을 본다. 알파가 없으면 모서리 색을 배경으로 보고 테두리에서 채워 지운다.
  2. 맨 위 짙은 윤곽 최대 2행을 건너뛴다.
  3. 앞면 기준 밝기 = 그 열 아래쪽 60% 의 중앙값. 윗면 = 그 기준보다 δ 이상 밝은 행이 이어진 구간(끊김 1행 허용).
  4. T = 열별 T 의 중앙값, F = 열 높이 − 윤곽 − T 의 중앙값.

차량(택시·버스·트럭): 파일 이름/폭높이로 방향을 가른다. 가로 주행(옆면+윗면 셋)은 지붕·보닛·트렁크 단차(step>=5px)로,
  세로 주행(앞/뒤면+긴 지붕)은 지붕 윗면 길이(T>=20)로 잰다. 정면 입면도 택시는 FRONT 로 걸린다.
건물 입면 깊이(처마·차양·발코니 윗면+그림자, 창 안쪽 그림자·턱, 출입구 들임)는 기계로 재지 못한다 — 눈 검수 전용(bible §10-5).
실내 가구는 interior_view34_audit.py(--wall-tall) 가 §11 표로 잰다.

사용:
  view34_check.py <png>...                 조각 몇 개를 표로
  view34_check.py --audit [--out FILE]     후보 전체(일본·강남·학교)를 재서 JSON 으로
"""
import json
import re
import statistics
import sys
from pathlib import Path

from PIL import Image

try:
    from common import BASE as _B
    BASE = Path(_B)
except Exception:  # 단독 실행
    BASE = Path(__file__).resolve().parents[3] / "tiledata" / "atlas-pick"

SEAM_FRAC = 0.5      # 이음으로 치는 열 비율
DELTA = 6            # 앞면 기준보다 이만큼(0~255 밝기) 밝으면 윗면 후보
BAND_TOL = 6         # 같은 띠로 묶는 행 밝기 허용 오차
FLAT_FRAC = 0.70
BUILDING_KITS = {"kit_bldg", "kit_house", "kit_shopfront", "kit_station", "kit_shrine"}   # 조립 예시 중 「건물」로 재는 것 (문·신호·전봇대·도리이는 소품)
FLAT_FRAC_THICK = 0.45     # 몸통 띠의 단색 비율 하한
THICK = 4            # 두꺼운 띠(윗면 몸통) 최소 행 수

# 종류 → (T/F 하한, 상한, T 최소 px, 설명)
CONTRACT = {
    "building": (0.10, 1.10, 14, "건물: 지붕 윗면 = 발자국 깊이×16px, 앞면 = 층×32px"),
    "prop_box": (0.22, 0.60, 6, "상자형 기물(자판기·부스·우체통·수레): 윗면 6~8px, 앞면 실제 높이"),
    "vehicle": (0.28, 0.95, 7, "탈것(방향 무관 기본값): 지붕 윗면 8~10px, 옆·앞면 12~16px"),
    "vehicle_h": (0, 9, 5, "가로로 달리는 차: 옆면 + 트렁크·지붕·후드 윗면 세 덩이(지붕이 양끝보다 ≥5px 솟는다)"),
    "vehicle_v": (0.90, 3.00, 20, "세로로 달리는 차: 앞/뒷면(F 12~16) + 긴 지붕 윗면(T ≥ 20, 트렁크·유리·지붕·유리·후드 순)"),
    "prop": (0.12, 0.95, 3, "그 밖의 물체: 윗면이 보여야 한다"),
}

ROOF_PART = re.compile(r"(^|_)(rf|roof|rt)(_|$)|house_roof")
FRONT_PART = re.compile(r"^blk_(sh|en|al|fa|gb_(bg|bks|gs|kb|kbb|ks|heli)|sws)")
TREE = re.compile(r"tree|ginkgo|sakura|bush|plant|planter|grove|hedge")
THIN = re.compile(r"pole|signal|sign|lamp|torii|mirror|nameboard|line|wire|arm|mark|manhole|crosswalk|lane|arrow|track|"
                  r"rail|hatch|vent|exit|led|petals|noren|laundry|shimenawa|sando|deck|people|crossing|tomare|diamond|stop")
VEHICLE = re.compile(r"(^|_)(car|taxi|bus|scooter|mamachari|bicycle|bike)(_|$)")
BOX = re.compile(r"vending|machine|booth|mailbox|cart|stall|kiosk|bench|trash|garbage|rack|box|hoarding|bags|cone|hydrant|"
                 r"lantern|statue|komainu|temizuya|hall|sculpture|queue|media|island|bakery")
BUILDING = re.compile(r"building|bldg|house|front|entrance|gate|station|hall$|shrine|zakkyo|mall")


def lum(p):
    return 0.30 * p[0] + 0.59 * p[1] + 0.11 * p[2]


def category(slug: str, layer: str = "object", kind: str = "") -> str:
    s = slug.lower()
    if kind == "kit" or layer in ("kit",):
        return "kitpart"
    if layer in ("ground", "decal", "wall"):
        return "flat"
    if ROOF_PART.search(s) or FRONT_PART.search(s):
        return "kitpart"
    if TREE.search(s):
        return "tree"
    if VEHICLE.search(s):
        return "vehicle"
    if THIN.search(s):
        return "thin"
    if BUILDING.search(s) and layer in ("facade", "object", "over"):
        return "building"
    if BOX.search(s):
        return "prop_box"
    return "prop"


def opaque_mask(im: Image.Image, nobg: bool = False):
    """(픽셀, 마스크) — 알파가 없으면 모서리 색을 테두리에서 채워 지운다."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    mask = [[px[x, y][3] > 0 for x in range(w)] for y in range(h)]
    if not nobg and all(all(r) for r in mask):  # 알파 없음(불투명 배경)
        bg = px[0, 0][:3]
        seen = [[False] * w for _ in range(h)]
        stack = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
        while stack:
            x, y = stack.pop()
            if not (0 <= x < w and 0 <= y < h) or seen[y][x]:
                continue
            if px[x, y][:3] != bg:
                continue
            seen[y][x] = True
            mask[y][x] = False
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return px, mask


def measure(path, nobg: bool = False) -> dict:
    """{T, F, ratio, w, h} — 윗면 두께 T 와 앞면 높이 F(px).

    윗면/앞면 경계 = 위에서 첫 「가로로 긴 이음」: 열의 SEAM_FRAC 이상에서 이웃 행과 밝기가 DELTA 이상 갈리는 행.
    (윗면이 앞면보다 어두운 콘크리트 지붕도, 밝은 지붕도 같은 방식으로 잡는다.)
    """
    im = Image.open(path).convert("RGBA")
    px, mask = opaque_mask(im, nobg)
    w, h = im.size
    rows = [y for y in range(h) if any(mask[y][x] for x in range(w))]
    if not rows:
        return {"T": 0, "F": 0, "ratio": 0.0, "w": w, "h": h}
    y0, y1 = rows[0], rows[-1]
    H = y1 - y0 + 1
    def rowlum(y):
        v = [lum(px[x, y]) for x in range(w) if mask[y][x]]
        return statistics.median(v) if v else 0.0
    # 행 중앙 밝기를 띠(band)로 묶는다(허용 오차 BAND_TOL). 두꺼운 첫 띠(>= THICK 행)가 윗면 몸통이고
    # 그 앞의 얇은 띠(윤곽·립 하이라이트·이음 선)는 윗면에 포함한다. 몸통이 끝나는 행이 윗면/앞면 이음.
    lums = [rowlum(y) for y in range(y0, y1 + 1)]
    bands = []  # [start, end_exclusive, lum]
    for i, v in enumerate(lums):
        if bands and abs(bands[-1][2] - v) <= BAND_TOL:
            bands[-1][1] = i + 1
        else:
            bands.append([i, i + 1, v])
    # 얇은 이음 선(<=2행)이 비슷한 밝기 두 띠 사이에 끼고 **더 어두우면**(타일 줄눈) 한 띠로 합친다. 더 밝으면 지붕 앞 립(윗면/앞면 경계)이라 합치지 않는다.
    merged = True
    while merged:
        merged = False
        for i in range(1, len(bands) - 1):
            a, m_, c = bands[i - 1], bands[i], bands[i + 1]
            if m_[1] - m_[0] <= 2 and m_[2] < a[2] - BAND_TOL and abs(a[2] - c[2]) <= BAND_TOL and (a[1] - a[0]) >= 3 and (c[1] - c[0]) >= 2:
                bands[i - 1:i + 2] = [[a[0], c[1], a[2]]]
                merged = True
                break
    def flat(bd):  # 띠가 가로로 한 색에 가까운가 — 윗면 몸통은 평평, 간판·창 띠는 아니다
        ys = range(y0 + bd[0], y0 + bd[1])
        vals = [round(lum(px[x, y])) for y in ys for x in range(w) if mask[y][x]]
        if not vals:
            return False
        mode = max(set(vals), key=vals.count)
        frac = FLAT_FRAC if (bd[1] - bd[0]) < 10 else FLAT_FRAC_THICK   # 두꺼운 윗면은 실외기·탱크가 얹혀 있어도 윗면이다
        return sum(1 for v in vals if abs(v - mode) <= BAND_TOL) / len(vals) >= frac
    body = next((b for b in bands if b[1] - b[0] >= THICK and b[0] < H * 0.75 and flat(b)), None)
    if body is None:
        # 두꺼운 띠가 없다 = 앞면이 질감으로 촘촘하다. 맨 위 밝은 띠들(윤곽 뺀)만 윗면으로 본다.
        lead = 0
        for bd in bands[1:]:
            if bd[2] > bands[0][2] and bd[0] < 8:
                lead = bd[1] - 1
            else:
                break
        T = max(0, lead)
        F = H - T
        return {"T": T, "F": F, "ratio": round(T / max(1, F), 3), "w": w, "h": h}
    T = body[1] - 1  # 맨 윗 윤곽 1행 뺀 윗면 두께
    F = H - body[1]
    if F <= 0:
        return {"T": T, "F": 0, "ratio": 9.9, "w": w, "h": h}
    return {"T": T, "F": F, "ratio": round(T / F, 3), "w": w, "h": h}


def measure_lip(path, nobg: bool = False):
    """차량용 보조 측정 — 캐빈 지붕은 창(어두운 칸)이 섞여 평탄 띠가 안 잡힌다.
    윗면/옆면 경계 = 몸통 위쪽 15~65% 에 있는 **얇은(<=2행) 밝은 립 행**(양옆 행보다 BAND_TOL 이상 밝음). 없으면 None."""
    im = Image.open(path).convert("RGBA")
    px, mask = opaque_mask(im, nobg)
    w, h = im.size
    rows = [y for y in range(h) if any(mask[y][x] for x in range(w))]
    if not rows:
        return None
    y0, y1 = rows[0], rows[-1]
    H = y1 - y0 + 1
    def rowlum(y):
        v = [lum(px[x, y]) for x in range(w) if mask[y][x]]
        return statistics.median(v) if v else 0.0
    L = [rowlum(y) for y in range(y0, y1 + 1)]
    for i in range(int(H * 0.15), int(H * 0.65)):
        for th in (1, 2):
            if i + th < H and i > 0 and all(L[i + k] > L[i - 1] + BAND_TOL for k in range(th)) and L[i + th] < L[i] - BAND_TOL and abs(L[i + th] - L[i - 1]) <= BAND_TOL * 2:
                T = i - 1
                F = H - (i + th)
                if F > 0 and T > 0:
                    return {"T": T, "F": F, "ratio": round(T / F, 3), "w": w, "h": h}
    return None


def measure_vertical_car(path, nobg: bool = False):
    """세로로 선 차(앞/뒷면이 아래 14px 안팎, 위는 긴 지붕 윗면): 아래쪽 68~88% 구간에서 처음 나오는 「어두운 행 뒤 밝은 앞 모서리」(+40 이상)를
    윗면/앞면 경계로 본다. 없으면 None."""
    im = Image.open(path).convert("RGBA")
    px, mask = opaque_mask(im, nobg)
    w, h = im.size
    rows = [y for y in range(h) if any(mask[y][x] for x in range(w))]
    if not rows:
        return None
    y0, y1 = rows[0], rows[-1]
    H = y1 - y0 + 1
    L = [statistics.median([lum(px[x, y]) for x in range(w) if mask[y][x]] or [0]) for y in range(y0, y1 + 1)]
    for i in range(int(H * 0.68), int(H * 0.88)):
        if L[i] - L[i - 1] >= 40:
            return {"T": i - 1, "F": H - i, "ratio": round((i - 1) / max(1, H - i), 3), "w": w, "h": h}
    return None


def vehicle_profile(path, nobg: bool = False) -> dict:
    """차 전용 측정. 실루엣 가로세로비로 방향을 정한다(가로 ≥1.3 = 옆에서 본 차, 아니면 앞/뒤에서 본 차).
    가로차: 열마다 맨 위 행의 높이(top)를 재서 「지붕(가운데 30~70%)이 양끝(0~25%·75~100%)보다 얼마나 솟는가」= step 이 3/4 뷰의 핵심 증거다.
    옆에서 본 정면 입면도는 윗선이 평평(step≈0), 3/4 는 트렁크·지붕·후드가 계단으로 보인다.
    세로차: 기존 measure(윗면 T·앞면 F)를 쓰되 범위가 다르다(윗면이 길다)."""
    im = Image.open(path).convert("RGBA")
    px, mask = opaque_mask(im, nobg)
    w, h = im.size
    tops = []
    for x in range(w):
        col = [y for y in range(h) if mask[y][x]]
        tops.append(col[0] if col else None)
    live = [t for t in tops if t is not None]
    if not live:
        return {"dir": "?", "step": 0}
    ys = [y for y in range(h) if any(mask[y][x] for x in range(w))]
    H = ys[-1] - ys[0] + 1
    if w >= 1.3 * H:
        mid = [tops[x] for x in range(int(w * .30), int(w * .70)) if tops[x] is not None]
        end = [tops[x] for x in list(range(0, int(w * .25))) + list(range(int(w * .75), w)) if tops[x] is not None]
        step = (statistics.median(end) - statistics.median(mid)) if mid and end else 0
        return {"dir": "h", "step": round(step, 1), "H": H}
    return {"dir": "v", "step": 0, "H": H}


def verdict(cat: str, m: dict) -> tuple[str, str]:
    if cat == "vehicle_h":
        if m.get("step", 0) < 5:
            return "FRONT", f"윗선 단차 {m.get('step', 0)}px < 5 — 옆에서 본 정면 입면도(지붕·후드·트렁크 윗면이 안 보인다)"
        return "OK", ""
    if cat in ("flat", "tree", "thin", "kitpart"):
        return "EXEMPT", {"flat": "바닥·덧칠·벽걸이는 윗면 개념이 없다", "tree": "나무는 수관 윗 하이라이트를 눈으로 본다",
                          "thin": "얇은 기둥·표지는 윗면이 없다", "kitpart": "킷 부품은 조립한 건물로 잰다"}[cat]
    lo, hi, tmin, _ = CONTRACT[cat]
    T, r = m["T"], m["ratio"]
    if T <= 0:
        return "NOTOP", "윗면이 없다(앞면만) — 상자에 윗면이 없다"
    if r > hi:
        return "TOPDOWN", f"T/F={r} > {hi} — 위에서 내려다본 그림, 앞면이 모자란다"
    if r < lo or T < tmin:
        return "FRONT", f"T/F={r} < {lo} 또는 T={T} < {tmin}px — 정면 입면도(윗면이 가는 띠)"
    return "OK", ""


def check_file(path, slug: str, layer: str = "object", kind: str = "", cat: str | None = None, nobg: bool = False) -> dict:
    cat = cat or category(slug, layer, kind)
    m = measure(path, nobg)
    if cat == "vehicle":
        vp = vehicle_profile(path, nobg)         # 방향을 먼저 정한다: 가로차는 단차, 세로차는 긴 윗면
        if vp["dir"] == "h":
            cat = "vehicle_h"
            m = {**m, "step": vp["step"], "T": int(vp["step"]), "F": vp["H"] - int(vp["step"]), "ratio": round(vp["step"] / max(1, vp["H"] - vp["step"]), 3)}
        elif vp["dir"] == "v":
            cat = "vehicle_v"
            m = measure_vertical_car(path, nobg) or m
        else:
            ml = measure_lip(path, nobg)
            if ml and verdict(cat, m)[0] != "OK":
                m = ml
    v, why = verdict(cat, m)
    return {"cat": cat, **m, "verdict": v, "why": why}


def audit_targets():
    """(집합, slug, 대표 png 경로, layer, kind) — 후보 전체."""
    out = []
    picks = {}
    for name in ("jp", "school", "modern"):
        p = BASE / f"picks-{name}.json"
        if p.exists():
            picks[name] = json.loads(p.read_text(encoding="utf-8"))
    for setname, cdir, pat in (("jp", "candidates-jp", None), ("modern", "candidates-modern", "v0.png"), ("school", "candidates-school", None)):
        for d in sorted((BASE / cdir).iterdir()):
            if not d.is_dir():
                continue
            info = {}
            if (d / "info.json").exists():
                info = json.loads((d / "info.json").read_text(encoding="utf-8"))
            layer = info.get("layer", "object")
            kind = info.get("kind", "")
            if pat:
                cands = [d / pat]
            else:
                cands = sorted(p for p in d.glob("*-?.png") if not re.search(r"-x\d|\.ctx|\.ex|\.walk|\.board|\.parts|\.seams", p.name))
                ch = picks.get(setname, {}).get(d.name)
                if isinstance(ch, dict):
                    ch = ch.get("choice")
                # 고른 후보가 있으면 그것, 없으면 A
                pref = [c for c in cands if ch and c.stem.endswith("-" + str(ch))]
                cands = pref[:1] or cands[:1]
            if kind == "kit" or layer == "kit":
                # 킷은 조립 예(ex)로 잰다 — 옥상이 있는 건물 예
                cands = sorted(d.glob("*.ex-*.png"))
            for c in cands:
                if c.exists():
                    out.append((setname, d.name, c, layer, kind))
    return out


def gangnam_example_renders(outdir: Path):
    """강남 건물 문법(bldg.EXAMPLES)의 조립 렌더 — 킷 블록 하나가 아니라 조립한 건물로 잰다."""
    import numpy as np
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "lib" / "modern"))
    import bldg
    outdir.mkdir(parents=True, exist_ok=True)
    res = []
    for name, rows in bldg.EXAMPLES.items():
        p = outdir / f"gnb_{name}.png"
        Image.fromarray(bldg.render(rows), "RGBA").save(p)
        res.append((name, p))
    return res


def main(argv):
    if not argv:
        print(__doc__)
        return 0
    if argv[0] == "--audit":
        outp = None
        if "--out" in argv:
            outp = Path(argv[argv.index("--out") + 1])
        rows = []
        for setname, slug, path, layer, kind in audit_targets():
            assembled = kind == "kit" or layer == "kit"
            r = check_file(path, slug, layer, kind, cat=("building" if slug in BUILDING_KITS else "prop") if assembled else None)
            r["assembled"] = assembled
            r.update({"set": setname, "slug": slug, "file": str(Path(path).relative_to(BASE))})
            rows.append(r)
        for name, p in gangnam_example_renders(BASE / "work" / "view34"):
            r = check_file(p, "building", "object", "", cat="building", nobg=True)
            r.update({"set": "modern", "slug": "gnb_" + name, "file": str(p.relative_to(BASE)), "assembled": True})
            rows.append(r)
        if outp:
            outp.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
        from collections import Counter
        for s in ("jp", "modern", "school"):
            c = Counter(r["verdict"] for r in rows if r["set"] == s)
            print(s, dict(c))
        return 0
    # 파일마다 「경로[:분류]」 로 분류를 강제할 수 있다(building/prop_box/vehicle/prop/tree…). 예: shop3f.png:building
    print(f"{'file':52} {'cat':9} {'T':>5} {'F':>5} {'T/F':>6}  verdict")
    for a in argv:
        a, _, force = a.partition(":")
        p = Path(a)
        slug = p.parent.name
        info = {}
        if (p.parent / "info.json").exists():
            info = json.loads((p.parent / "info.json").read_text(encoding="utf-8"))
        r = check_file(p, slug, info.get("layer", "object"), info.get("kind", ""), cat=force or None)
        print(f"{str(p)[-52:]:52} {r['cat']:9} {r['T']:>5} {r['F']:>5} {r['ratio']:>6}  {r['verdict']} {r['why']}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
