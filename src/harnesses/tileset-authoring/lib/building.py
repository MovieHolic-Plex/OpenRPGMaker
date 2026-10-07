"""건물 관문 — 역할별(벽·처마·지붕·창·문) 구조 지표.

기준 그림과 후보 모두 「역할 좌표」(roles)를 가진다. 기준은 seed.json 의 building_roles 에 손으로 단, 후보는 레시피가 그리면서 내보낸다.
지표는 기준 그림에서 잰 값으로 허용 범위를 만들고, 양성 대조(기준)는 통과·음성 대조(사람이 불합격시킨 옛 그림)는 불합격이어야 관문이 유효하다.

roles = {
  "roof_ramp": [(r,g,b)...],         # 지붕 램프(처마 아래 그림자를 찾는 기준)
  "wall":      [(x0,y0,x1,y1)...],   # 벽 면(깨끗해야 하는 평면). 열린 구멍은 openings 로 뺀다
  "openings":  [(x0,y0,x1,y1)...],   # 창·문 바깥 틀 포함 — 벽 지표에서 제외
  "windows":   [(x0,y0,x1,y1)...],   # 틀 포함, 맨 아래 한 줄은 턱 그림자 가능
  "doors":     [(x0,y0,x1,y1)...],
}
좌표는 모두 포함(inclusive).
"""
from __future__ import annotations

import numpy as np
from PIL import Image


def _arr(im: Image.Image) -> np.ndarray:
    return np.array(im.convert("RGBA"))


def luma(c) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def _mask_of(shape, rects, minus=()) -> np.ndarray:
    h, w = shape
    m = np.zeros((h, w), bool)
    for x0, y0, x1, y1 in rects:
        m[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = True
    for x0, y0, x1, y1 in minus:
        m[max(0, y0):y1 + 1, max(0, x0):x1 + 1] = False
    return m


def _roof_mask(a: np.ndarray, ramp, tol: int = 14) -> np.ndarray:
    rgb = a[..., :3].astype(int)
    r = np.array(ramp, int)
    d = np.sqrt(((rgb[:, :, None, :] - r[None, None, :, :]) ** 2).sum(-1)).min(-1)
    return (d <= tol) & (a[..., 3] == 255)


def region_stats(a: np.ndarray, m: np.ndarray) -> dict:
    """마스크 안 픽셀의 색 수·외톨이 비율·경계 밀도(마스크 안 이웃끼리만 비교)."""
    h, w, _ = a.shape
    rgb = a[..., :3].astype(int)
    n = int(m.sum())
    if n == 0:
        return {"n": 0, "colors": 0, "isolated": 0.0, "boundary": 0.0}
    cols = {tuple(c) for c in rgb[m]}
    iso = bnd = 0
    for y, x in zip(*np.nonzero(m)):
        same = diff = 0
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and m[yy, xx]:
                if (rgb[yy, xx] == rgb[y, x]).all():
                    same += 1
                else:
                    diff += 1
        iso += int(same == 0 and diff > 0)
        bnd += int(diff > 0)
    return {"n": n, "colors": len(cols), "isolated": iso / n, "boundary": bnd / n}


def _mode_color(a: np.ndarray, m: np.ndarray):
    from collections import Counter
    cnt = Counter(tuple(int(v) for v in c) for c in a[..., :3][m])
    return cnt.most_common(1)[0][0] if cnt else (255, 255, 255)


def measure(im: Image.Image, roles: dict) -> dict:
    a = _arr(im)
    h, w, _ = a.shape
    op = a[..., 3] == 255
    out: dict = {}
    openings = roles.get("openings", [])
    wm = _mask_of((h, w), roles.get("wall", []), openings) & op
    ws = region_stats(a, wm)
    out["wall_colors"] = ws["colors"]
    out["wall_isolated"] = round(ws["isolated"], 4)
    out["wall_boundary"] = round(ws["boundary"], 4)
    base = _mode_color(a, wm) if ws["n"] else (255, 255, 255)
    bl = luma(base)
    out["wall_luma"] = round(bl, 1)
    # 처마 그림자: 지붕 마지막 줄 바로 아래 1~3 칸에 벽 기본색보다 뚜렷이 어두운 줄이 이어지는 열의 비율
    if roles.get("roof_ramp"):
        rm = _roof_mask(a, roles["roof_ramp"])
        if roles.get("roof_ymax") is not None:        # 지붕 아래(유리문 등)에 같은 램프 색이 있어도 지붕으로 세지 않는다
            rm[roles["roof_ymax"] + 1:] = False
        cols = hit = 0
        for x in range(w):
            ys = np.nonzero(rm[:, x])[0]
            if len(ys) == 0:
                continue
            yb = int(ys.max())
            if yb >= h - 4:
                continue
            below = [(yb + k) for k in (1, 2, 3) if yb + k < h and op[yb + k, x] and not rm[yb + k, x]]
            if not below:
                continue
            cols += 1
            if any(bl - luma(a[y, x, :3]) >= 18 for y in below):
                hit += 1
        out["eave_shadow"] = round(hit / cols, 3) if cols else 0.0
        out["roof_cols"] = cols
        # 지붕 면 깨끗함: 지붕 마스크 안 외톨이·경계 밀도·색 수
        rs = region_stats(a, rm)
        out["roof_isolated"] = round(rs["isolated"], 4)
        out["roof_boundary"] = round(rs["boundary"], 4)
        out["roof_colors"] = rs["colors"]
        # 가로 이음선: 지붕 폭 전체가 한 줄에서 한꺼번에 색이 바뀌면(블록 줄눈) 세로 줄·비늘의 결이 아니라 칸막이로 읽힌다
        rgbr = a[..., :3].astype(int)
        best = 0.0
        for y in range(1, h - 8):
            both = rm[y] & rm[y - 1]
            nb = int(both.sum())
            if nb >= 20:
                ch = (np.abs(rgbr[y] - rgbr[y - 1]).sum(-1) > 0) & both
                best = max(best, float(ch.sum()) / nb)
        out["roof_hband"] = round(best, 3)
        # 지붕 명암 분포: 암(톤 0·1) / 명(톤 3·4) 비중 — 한쪽으로 쏠린 지붕(검은 덩이·번들거리는 면)을 거른다
        ramp_a = np.array(roles["roof_ramp"], int)
        dd = np.sqrt(((rgbr[:, :, None, :] - ramp_a[None, None]) ** 2).sum(-1))
        tn = dd.argmin(-1)
        nroof = max(1, int(rm.sum()))
        out["roof_dark_share"] = round(float((rm & (tn <= 1)).sum()) / nroof, 3)
        out["roof_light_share"] = round(float((rm & (tn >= 3)).sum()) / nroof, 3)
    # 떨어지는 그림자: 벽 위에 튀어나온 것(보·창틀·문틀)의 바로 아래 한 칸은 벽 기본색이 아니라 한 단 어두운 그림자색이어야 한다.
    rgbi = a[..., :3].astype(int)
    lum = 0.299 * rgbi[..., 0] + 0.587 * rgbi[..., 1] + 0.114 * rgbi[..., 2]
    dark = op & (lum < bl - 80)
    if roles.get("roof_ramp"):
        _rm = _roof_mask(a, roles["roof_ramp"])
        if roles.get("roof_ymax") is not None:
            _rm[roles["roof_ymax"] + 1:] = False
        dark &= ~_rm
    miss = hit = 0
    for y in range(h - 1):
        for x in range(w):
            if not dark[y, x] or not op[y + 1, x]:
                continue
            c = tuple(rgbi[y + 1, x])
            if c == base:
                miss += 1
            elif bl - 80 <= lum[y + 1, x] <= bl - 12 and abs(rgbi[y + 1, x] - np.array(base)).max() <= 90:
                hit += 1
    out["drop_shadow_miss"] = round(miss / (miss + hit), 3) if miss + hit else 0.0
    out["drop_shadow_n"] = miss + hit
    # 처마 그림자 두께: 지붕 맨 아래 픽셀 바로 밑에서 그림자색이 이어지는 칸 수의 중앙값(기준은 2칸)
    sc = roles.get("shadow_rgb")
    if sc and roles.get("roof_ramp"):
        rm2 = _roof_mask(a, roles["roof_ramp"])
        if roles.get("roof_ymax") is not None:
            rm2[roles["roof_ymax"] + 1:] = False
        runs = []
        for x in range(w):
            ys = np.nonzero(rm2[:, x])[0]
            if len(ys) == 0:
                continue
            y = int(ys.max()) + 1
            n = 0
            while y < h and op[y, x] and tuple(int(v) for v in a[y, x, :3]) == tuple(sc):
                n += 1; y += 1
            runs.append(n)
        out["eave_depth"] = float(np.median(runs)) if runs else 0.0
    # 틀(강철 지지대·기둥) 비중 / 유리 비중 — 체육관처럼 틀이 큰 몫을 하는 건물용
    fz = roles.get("frame_zone")
    if fz:
        x0, y0, x1, y1 = fz
        sub = a[y0:y1 + 1, x0:x1 + 1, :3].astype(int)
        n = sub.shape[0] * sub.shape[1]
        for name, key in (("frame_share", "frame_ramp"), ("glass_share", "glass_ramp")):
            if key not in roles:
                continue
            cs = np.array(roles[key], int)
            d = np.sqrt(((sub[:, :, None, :] - cs[None, None]) ** 2).sum(-1)).min(-1)
            out[name] = round(float((d <= 10).sum()) / n, 3)
    # 창
    wins = roles.get("windows", [])
    if wins:
        tones, contrast, glass_luma, ring_c, stripes, sill = [], [], [], [], [], []
        for x0, y0, x1, y1 in wins:
            sub = a[y0:y1 + 1, x0:x1 + 1]
            inner = sub[2:-2, 2:-2]
            rgb = inner[..., :3].reshape(-1, 3)
            lu = np.array([luma(c) for c in rgb])
            tones.append(len({tuple(c) for c in rgb}))
            contrast.append(float(lu.max() - lu.min()))
            # 유리(틀 색이 아닌 밝은 쪽 절반): 밝기 상위 25% 평균
            glass_luma.append(float(np.sort(lu)[int(len(lu) * 0.75):].mean()))
            ring = np.concatenate([sub[0, :, :3], sub[-2, :, :3], sub[:, 0, :3], sub[:, -1, :3]])
            ring_c.append(bl - float(np.mean([luma(c) for c in ring])))
            # 세로 한 줄(유리 가운데 왼쪽 1/4)에서 밝기가 바뀌는 횟수
            col = sub[:, max(2, (x1 - x0) // 4), :3]
            ls = [luma(c) for c in col]
            stripes.append(sum(1 for i in range(1, len(ls)) if abs(ls[i] - ls[i - 1]) >= 25))
            # 턱 그림자: 창 아래 한 줄이 벽 기본색보다 어두운가
            yb = y1
            sill.append(float(np.mean([bl - luma(c) for c in a[yb, x0 + 1:x1, :3]])))
        sil = []
        for x0, y0, x1, y1 in wins:
            inner = a[y0 + 2:y1 - 1, x0 + 2:x1 - 1, :3]
            sil.append(int(((inner[..., 0] == 0xdb) & (inner[..., 1] == 0x91) & (inner[..., 2] == 0x38)).sum()))
        out["win_sill_px"] = float(np.mean(sil))
        out["win_tones"] = int(np.mean(tones))
        out["win_contrast"] = round(float(np.mean(contrast)), 1)
        out["win_glass_luma"] = round(float(np.mean(glass_luma)), 1)
        out["win_frame_contrast"] = round(float(np.mean(ring_c)), 1)
        out["win_stripes"] = round(float(np.mean(stripes)), 2)
        out["win_sill_shadow"] = round(float(np.mean(sill)), 1)
    # 나무 문 개념(틀 안에 들어앉은 문짝): 위 그림자 · 걷어차기 판 · 다리 사이 빈 틈
    if roles.get("door_kind") == "wood" and roles.get("doors"):
        x0, y0, x1, y1 = roles["doors"][0]
        lum_ = lambda c: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]
        # 표본 열은 기준 문(22px) 기준으로 잰 자리 — 문 폭에 비례해 옮긴다(1칸 폭 16px 문, 적대 검수 L1 N8). 22px 문은 예전과 같은 열이다.
        sc = (x1 - x0 + 1 - 7) / 15.0                       # 문짝 안쪽 폭(틀 3+4 를 뺀 것) 비율, 열 3 을 축으로
        cs = lambda cols: sorted({3 + round((c - 3) * sc) for c in cols})
        body = [lum_(a[y0 + r, x0 + c, :3]) for r in range(10, 19) for c in cs((4, 5, 7, 8, 9, 11, 12, 13))]
        bl_ = float(np.median(body))
        sh = [lum_(a[y0 + r, x0 + c, :3]) for r in (5, 6, 7) for c in cs((4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17))]
        out["door_lintel_dark"] = round(float(np.mean([v < bl_ - 12 for v in sh])), 3)
        kick = [lum_(a[y0 + r, x0 + c, :3]) for r in (21, 22) for c in cs((4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17))]
        out["door_kick_light"] = round(float(np.mean([v > bl_ + 8 for v in kick])), 3)
        gap = [a[y0 + r, x0 + c, 3] == 0 for r in (24, 25) for c in range(3 + round(2 * sc), 3 + round(14 * sc))]
        out["door_gap"] = round(float(np.mean(gap)), 3)
    # 문
    doors = roles.get("doors", [])
    if doors:
        x0, y0, x1, y1 = doors[0]
        sub = a[y0:y1 + 1, x0:x1 + 1]
        o = sub[..., 3] == 255
        out["door_tones"] = len({tuple(c) for c in sub[..., :3][o]})
        dk = (0.299 * sub[..., 0] + 0.587 * sub[..., 1] + 0.114 * sub[..., 2]) < bl - 60
        wd = lambda row: int((dk[row] & o[row]).sum())
        top, bot = wd(2), wd(12)
        out["door_taper"] = round((bot - top) / max(1, bot), 2)   # 아치·어깨가 좁으면 +
    return out


# ---- 관문 규칙 ---------------------------------------------------------------------------------
# 지표 → (방향, 절대 여유, 상대 여유). 방향: "max" 는 기준보다 크면 불합격, "min" 은 작으면 불합격, "band" 는 범위.
RULES = {
    "wall_colors": ("max", 1, 0.0, "벽 면에 쓴 색 수 — 깨끗한 벽은 두세 톤이다"),
    "wall_isolated": ("max", 0.004, 0.0, "벽 면의 1px 외톨이(얼룩) 비율"),
    "wall_boundary": ("max", 0.03, 0.4, "벽 면의 경계 밀도(결·균열이 많으면 높다)"),
    "eave_depth": ("band", 0.5, 0.0, "처마(지붕 끝) 밑 그림자 두께 — 기준은 2칸"),
    "win_sill_px": ("min", 2.0, 0.0, "유리창 칸 아래의 주황 턱 줄(창 안쪽 주황 픽셀 수)"),
    "drop_shadow_miss": ("max", 0.12, 0.0, "튀어나온 것 바로 아래가 그림자색이 아니라 벽 기본색인 비율"),
    "eave_shadow": ("min", 0.0, 0.35, "처마 밑 그림자가 이어지는 열의 비율"),
    "roof_isolated": ("max", 0.004, 0.0, "지붕 면의 1px 외톨이 비율"),
    "roof_boundary": ("band", 0.0, 0.35, "지붕 면의 경계 밀도(너무 바쁘면 지저분하다)"),
    "roof_hband": ("max", 0.12, 0.0, "지붕에서 한 줄 전체가 한꺼번에 색이 바뀌는 정도(블록 이음선)"),
    "roof_dark_share": ("band", 0.12, 0.0, "지붕에서 어두운 톤(0·1)이 차지하는 비중"),
    "roof_light_share": ("band", 0.12, 0.0, "지붕에서 밝은 톤(3·4)이 차지하는 비중"),
    "roof_colors": ("max", 1, 0.0, "지붕 면의 색 수"),
    "win_tones": ("min", 1, 0.0, "창 안쪽 색 수"),
    "win_contrast": ("min", 0.0, 0.3, "창 안쪽 밝기 폭"),
    "win_glass_luma": ("band", 18.0, 0.0, "유리의 밝은 쪽 밝기 — 기준은 하늘빛이다"),
    "win_frame_contrast": ("band", 28.0, 0.0, "벽과 창틀의 밝기 차"),
    "win_stripes": ("min", 0.0, 0.4, "유리 안 밝기 줄무늬 수"),
    "win_sill_shadow": ("min", 0.0, 0.4, "창 아래 턱 그림자의 어두운 정도"),
    "frame_share": ("band", 0.08, 0.0, "강철 틀(지지대·기둥)이 차지하는 비중 — 기준 체육관은 틀이 크다"),
    "glass_share": ("band", 0.08, 0.0, "유리가 차지하는 비중"),
    "door_lintel_dark": ("min", 0.1, 0.0, "문짝 윗부분이 아치 그림자로 어두운 비율"),
    "door_kick_light": ("min", 0.1, 0.0, "문짝 아래 걷어차기 판(밝은 줄) 비율"),
    "door_gap": ("min", 0.1, 0.0, "문 다리 사이 아래 2행의 빈 틈 — 문이 바닥에 놓인 모양"),
    "door_tones": ("max", 2, 0.0, "문에 쓴 색 수"),
    "door_taper": ("band", 0.35, 0.0, "문 위쪽이 좁아지는 정도(아치·어깨)"),
}


def derive_spec(positives: list[dict]) -> dict:
    spec = {}
    for k, (kind, ab, rel, _) in RULES.items():
        vals = [p[k] for p in positives if k in p]
        if not vals:
            continue
        lo, hi = min(vals), max(vals)
        pad = ab + rel * max(abs(lo), abs(hi))
        if kind == "max":
            spec[k] = [None, round(hi + pad, 4)]
        elif kind == "min":
            spec[k] = [round(lo - pad, 4), None]
        else:
            spec[k] = [round(lo - pad, 4), round(hi + pad, 4)]
    return spec


def evaluate(m: dict, spec: dict) -> list[str]:
    fails = []
    for k, (lo, hi) in spec.items():
        if k not in m:
            fails.append(f"{k}: 후보에 이 역할이 없다(기준은 있다)")
            continue
        v = m[k]
        if lo is not None and v < lo:
            fails.append(f"{k}={v} < {lo} — {RULES[k][3]}")
        if hi is not None and v > hi:
            fails.append(f"{k}={v} > {hi} — {RULES[k][3]}")
    return fails
