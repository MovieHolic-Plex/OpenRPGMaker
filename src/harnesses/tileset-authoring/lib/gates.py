"""하네스 관문 — 기준 그림에서 잰 구조 지표로 후보를 통과/불합격 판정한다.

수치 하나가 아니라 「구조 지표 묶음」이고, 관문마다 반드시 **양성 대조(기준 그림 자체는 통과)** 와 **음성 대조(옛 불합격작은 불합격)** 로
검증한다 — 대조를 못 가르는 지표는 관문으로 쓰지 않는다. (실측 2026-10-02: 팔레트 포함·덩이 크기·경계 밀도 같은 평균 지표는
브로콜리 나무도 전부 ok 로 통과시켰다.)
"""
from __future__ import annotations

import math

import numpy as np
from PIL import Image

LIGHT_SIDE = ("l", "u")      # 빛이 오는 쪽(왼쪽·위) — 윤곽 없이 잎색으로 끝나야 한다
SHADE_SIDE = ("r", "d")      # 빛 반대쪽(오른쪽·아래) — 최암 윤곽/틈 선


def classify(im: Image.Image, ramp: list[tuple[int, int, int]], tol: int = 14) -> np.ndarray:
    """픽셀 → 램프 톤 번호(0..n-1), 램프에 없으면 -1, 투명이면 -2."""
    a = np.array(im.convert("RGBA"))
    h, w, _ = a.shape
    out = np.full((h, w), -2, int)
    r = np.array(ramp, int)
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] < 255:
                continue
            d = np.sqrt(((r - a[y, x, :3].astype(int)) ** 2).sum(1))
            i = int(d.argmin())
            out[y, x] = i if d[i] <= tol else -1
    return out


def object_metrics(im: Image.Image, ramp: list[tuple[int, int, int]]) -> dict:
    """나무 같은 단일 물체(잎 램프로 칠한 부분)의 구조 지표."""
    t = classify(im, ramp)
    mask = t >= 0
    h, w = mask.shape
    n = int(mask.sum())
    if n == 0:
        return {"leaf_pixels": 0}
    k = len(ramp)
    shares = [float((t == i).sum()) / n for i in range(k)]
    # 가장자리(4방향 중 하나가 마스크 밖) 분류
    def empty(y, x, dy, dx):
        yy, xx = y + dy, x + dx
        return not (0 <= yy < h and 0 <= xx < w and mask[yy, xx])
    edge_total = 0
    shade_dark = shade_n = light_dark = light_n = 0
    interior_darkest = darkest_total = 0
    for y in range(h):
        for x in range(w):
            if not mask[y, x]:
                continue
            e_r, e_d = empty(y, x, 0, 1), empty(y, x, 1, 0)
            e_l, e_u = empty(y, x, 0, -1), empty(y, x, -1, 0)
            is_edge = e_r or e_d or e_l or e_u
            if t[y, x] == 0:
                darkest_total += 1
                if not is_edge:
                    interior_darkest += 1
            if e_r or e_d:
                shade_n += 1; shade_dark += int(t[y, x] == 0)
            elif e_l or e_u:
                light_n += 1; light_dark += int(t[y, x] <= 1)
            edge_total += int(is_edge)
    # 밝기 무게중심 이동: 빛 쪽(왼쪽 위)이 밝은가
    lum = np.zeros((h, w))
    for i in range(k):
        lum[t == i] = i
    ys, xs = np.mgrid[0:h, 0:w]
    cx = (lum * mask * xs).sum() / max(1e-9, (lum * mask).sum()) - (mask * xs).sum() / n
    cy = (lum * mask * ys).sum() / max(1e-9, (lum * mask).sum()) - (mask * ys).sum() / n
    # 같은 톤 덩이 수·평균 크기
    seen = np.zeros((h, w), bool); comps = []
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or seen[y, x]:
                continue
            tone = t[y, x]; stack = [(y, x)]; seen[y, x] = True; sz = 0
            while stack:
                cy_, cx_ = stack.pop(); sz += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy_ + dy, cx_ + dx
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and mask[ny, nx] and t[ny, nx] == tone:
                        seen[ny, nx] = True; stack.append((ny, nx))
            comps.append(sz)
    # 행별 폭 윤곽(가장 넓은 행의 위치 비율)
    rows = mask.sum(1)
    widest = int(rows.argmax()) / max(1, (np.nonzero(rows)[0].max() - np.nonzero(rows)[0].min()))
    return {
        "leaf_pixels": n,
        "shares": [round(s, 3) for s in shares],
        "shade_edge_dark": round(shade_dark / max(1, shade_n), 3),     # 빛 반대쪽 가장자리 중 최암 비율(높아야)
        "light_edge_dark": round(light_dark / max(1, light_n), 3),     # 빛 쪽 가장자리 중 암 이하 비율(낮아야)
        "interior_darkest": round(interior_darkest / max(1, darkest_total), 3),  # 최암 중 안쪽(틈 선) 비율
        "light_shift_x": round(float(cx), 2),
        "light_shift_y": round(float(cy), 2),
        "patches_per_100px": round(len(comps) / n * 100, 2),
        "patch_mean": round(float(np.mean(comps)), 2),
        "edge_ratio": round(edge_total / n, 3),
    }


# ---- 관문 규칙 ---------------------------------------------------------------------------------
METRIC_RULES = {
    # 지표: (허용 폭 최소값, 설명)
    "shade_edge_dark": (0.12, "빛 반대쪽 가장자리의 최암 비율"),
    "light_edge_dark": (0.15, "빛 쪽 가장자리의 암 이하 비율 — 기준 그림은 빛 쪽에도 윤곽이 있다(0 이면 윤곽 없이 번진 것)"),
    "interior_darkest": (0.15, "최암 중 안쪽(틈 선) 비율"),
    "patches_per_100px": (3.0, "같은 톤 덩이 수(100px 당)"),
    "patch_mean": (2.0, "같은 톤 덩이 평균 크기"),
    "edge_ratio": (0.04, "가장자리 픽셀 비율(울퉁불퉁함)"),
}


def derive_object_spec(positives: list[dict]) -> dict:
    """양성 대조(기준 그림들)의 지표 범위 + 여유 → 관문 규칙. 단일 표본이면 여유를 넉넉히 둔다."""
    spec: dict = {"ranges": {}, "shares": None, "light_shift_y_max": None}
    for m, (amin, _) in METRIC_RULES.items():
        vals = [p[m] for p in positives]
        lo, hi = min(vals), max(vals)
        pad = max(amin, 0.35 * (hi - lo))
        spec["ranges"][m] = [round(lo - pad, 3), round(hi + pad, 3)]
    n = len(positives[0]["shares"])
    spec["shares"] = [round(sum(p["shares"][i] for p in positives) / len(positives), 3) for i in range(n)]
    ys = [p["light_shift_y"] for p in positives]
    spec["light_shift_y_max"] = round(max(ys) + 0.7, 2)   # 밝은 쪽 무게중심이 위쪽(음수)이어야 한다
    spec["shares_l1_max"] = 0.16
    return spec


def evaluate_object(m: dict, spec: dict) -> list[str]:
    fails = []
    if m.get("leaf_pixels", 0) == 0:
        return ["램프 색 픽셀이 없다"]
    for k, (lo, hi) in spec["ranges"].items():
        if not (lo <= m[k] <= hi):
            fails.append(f"{k}={m[k]} 이 기준 범위 [{lo}, {hi}] 밖 — {METRIC_RULES[k][1]}")
    l1 = sum(abs(a - b) for a, b in zip(m["shares"], spec["shares"]))
    if l1 > spec["shares_l1_max"]:
        fails.append(f"톤 비중 거리 {l1:.2f} > {spec['shares_l1_max']} (내 {m['shares']} / 기준 {spec['shares']})")
    if m["light_shift_y"] > spec["light_shift_y_max"]:
        fails.append(f"light_shift_y={m['light_shift_y']} > {spec['light_shift_y_max']} — 밝은 톤이 위쪽(빛 쪽)에 몰려야 한다(윗면이 밝은 3/4 조명)")
    return fails


def tile_metrics(im: Image.Image) -> dict:
    import study
    m = study.measure(im)
    return {"colors": m["colors"], "isolated": m["isolated"], "clump": m["clump"], "boundary": m["boundary"], "ramp": [r["hex"] for r in m["ramp"]]}


def derive_tile_spec(positives: list[dict]) -> dict:
    hexes = sorted({h for p in positives for h in p["ramp"]})
    return {
        "colors_max": max(p["colors"] for p in positives) + 2,
        "isolated_max": round(max(p["isolated"] for p in positives) * 2.5 + 0.015, 3),
        "clump_range": [round(min(p["clump"] for p in positives) * 0.5, 2), round(max(p["clump"] for p in positives) * 2.0, 2)],
        "boundary_range": [round(min(p["boundary"] for p in positives) - 0.2, 2), round(max(p["boundary"] for p in positives) + 0.2, 2)],
        "palette": hexes,
    }


def evaluate_tile(im: Image.Image, spec: dict, ref_palette_tol: int = 22, extra_hex: list[str] | None = None) -> list[str]:
    import study
    m = tile_metrics(im)
    fails = []
    if m["colors"] > spec["colors_max"]:
        fails.append(f"색 수 {m['colors']} > {spec['colors_max']}")
    if m["isolated"] > spec["isolated_max"]:
        fails.append(f"1px 잡음 비율 {m['isolated']} > {spec['isolated_max']}")
    lo, hi = spec["clump_range"]
    if not (lo <= m["clump"] <= hi):
        fails.append(f"같은 색 덩이 크기 {m['clump']} 가 [{lo}, {hi}] 밖")
    lo, hi = spec["boundary_range"]
    if not (lo <= m["boundary"] <= hi):
        fails.append(f"경계 밀도 {m['boundary']} 가 [{lo}, {hi}] 밖")
    pal = {tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) for h in list(spec["palette"]) + list(extra_hex or [])}
    cov = study.coverage(im, pal, ref_palette_tol)
    if cov < 0.9:
        fails.append(f"이 역할의 기준 색 안에 든 픽셀 {cov * 100:.0f}% < 90% (이 역할에 없는 색을 썼다)")
    return fails
