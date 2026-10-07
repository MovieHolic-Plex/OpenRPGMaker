"""기준 팩 연구·비교 — 측정만 한다(픽셀을 복사하지 않는다).

study  : 기준 시트의 구역마다 팔레트 램프·윤곽색·질감(덩이 크기·외톨이 점·경계 밀도)·빛 방향을 잰다.
compare: 내 후보의 같은 역할 구역을 똑같이 재서 기준과 나란히 놓고 어긋남을 표시한다.
숫자는 「닮은 정도의 단서」일 뿐 합격 보증이 아니다 — 화풍은 사람이 비교판을 보고 정한다.
"""
from __future__ import annotations

import colorsys
from collections import Counter

import numpy as np
from PIL import Image


def hexof(c) -> str:
    return "#%02x%02x%02x" % tuple(int(v) for v in c[:3])


def luma(c) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def _arr(im: Image.Image) -> np.ndarray:
    return np.array(im.convert("RGBA"))


def measure(im: Image.Image) -> dict:
    """한 구역(투명 제외)의 측정값."""
    a = _arr(im)
    h, w, _ = a.shape
    opaque = a[..., 3] == 255
    n = int(opaque.sum())
    if n == 0:
        return {"pixels": 0}
    flat = a.reshape(-1, 4)[opaque.reshape(-1)]
    counts = Counter(map(tuple, flat[:, :3]))
    total = sum(counts.values())
    palette = sorted(counts.items(), key=lambda kv: luma(kv[0]))
    ramp = [{"hex": hexof(c), "share": round(k / total, 4)} for c, k in palette if k / total >= 0.012]
    # 윤곽색: 가장 어두운 색 중 비중 0.4% 이상
    dark = [c for c, k in palette if k / total >= 0.004]
    outline = hexof(dark[0]) if dark else hexof(palette[0][0])
    # 인접 픽셀 비교(불투명끼리만)
    rgb = a[..., :3].astype(int)
    same_r = np.zeros((h, w), bool); same_l = np.zeros((h, w), bool); same_d = np.zeros((h, w), bool); same_u = np.zeros((h, w), bool)
    both = lambda m1, m2: m1 & m2
    eq = lambda x, y: np.all(x == y, axis=-1)
    same_r[:, :-1] = eq(rgb[:, :-1], rgb[:, 1:]) & both(opaque[:, :-1], opaque[:, 1:])
    same_l[:, 1:] = same_r[:, :-1]
    same_d[:-1, :] = eq(rgb[:-1, :], rgb[1:, :]) & both(opaque[:-1, :], opaque[1:, :])
    same_u[1:, :] = same_d[:-1, :]
    nb_same = same_r.astype(int) + same_l + same_d + same_u
    isolated = float(((nb_same == 0) & opaque).sum()) / n  # 같은 색 이웃이 하나도 없는 점(1px 잡음)
    boundary = float(((nb_same < 4) & opaque).sum()) / n   # 경계 밀도(질감의 바쁜 정도)
    # 같은 색 덩이 평균 크기(연결 성분)
    comp_sizes = _components(rgb, opaque)
    sat = []
    hue = []
    for c, k in counts.items():
        hh, ss, vv = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
        sat.append((ss, k)); hue.append((hh, k))
    sat_mean = sum(s * k for s, k in sat) / total
    # 색상 평균(원형)
    sx = sum(np.cos(h * 2 * np.pi) * k for h, k in hue); sy = sum(np.sin(h * 2 * np.pi) * k for h, k in hue)
    hue_mean = float((np.arctan2(sy, sx) / (2 * np.pi)) % 1.0)
    # 빛 방향: 밝기 무게중심이 구역 중심에서 어느 쪽인가(오브젝트일 때 의미)
    lum = (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]) * opaque
    ys, xs = np.mgrid[0:h, 0:w]
    tot = lum.sum() or 1
    cx = float((lum * xs).sum() / tot) - float((opaque * xs).sum() / n)
    cy = float((lum * ys).sum() / tot) - float((opaque * ys).sum() / n)
    return {
        "pixels": n,
        "colors": len(counts),
        "ramp": ramp,
        "outline": outline,
        "luma_min": round(luma(palette[0][0]), 1),
        "luma_max": round(luma(palette[-1][0]), 1),
        "saturation": round(sat_mean, 3),
        "hue": round(hue_mean, 3),
        "isolated": round(isolated, 4),
        "boundary": round(boundary, 4),
        "clump": round(float(np.mean(comp_sizes)), 2),
        "light_dx": round(cx, 2),
        "light_dy": round(cy, 2),
    }


def _components(rgb: np.ndarray, opaque: np.ndarray) -> list[int]:
    h, w = opaque.shape
    seen = np.zeros((h, w), bool)
    sizes = []
    for y in range(h):
        for x in range(w):
            if seen[y, x] or not opaque[y, x]:
                continue
            col = tuple(rgb[y, x]); stack = [(y, x)]; seen[y, x] = True; sz = 0
            while stack:
                cy, cx = stack.pop(); sz += 1
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < h and 0 <= nx < w and not seen[ny, nx] and opaque[ny, nx] and tuple(rgb[ny, nx]) == col:
                        seen[ny, nx] = True; stack.append((ny, nx))
            sizes.append(sz)
    return sizes or [0]


def palette_set(im: Image.Image) -> set[tuple[int, int, int]]:
    a = _arr(im)
    flat = a.reshape(-1, 4)
    return {tuple(int(v) for v in p[:3]) for p in flat if p[3] == 255}


def coverage(im: Image.Image, ref: set[tuple[int, int, int]], tol: int = 20) -> float:
    """내 불투명 픽셀 중 기준 팔레트의 어느 색과 RGB 거리 tol 이내인 비율."""
    a = _arr(im).reshape(-1, 4)
    a = a[a[:, 3] == 255][:, :3].astype(int)
    if len(a) == 0:
        return 1.0
    r = np.array(sorted(ref), int)
    d = np.sqrt(((a[:, None, :] - r[None, :, :]) ** 2).sum(-1)).min(axis=1)
    return float((d <= tol).mean())


def judge(ref: dict, mine: dict, cov: float) -> list[tuple[str, str, str]]:
    """(항목, 설명, 상태 ok/warn/bad). 기준 대비 어긋남."""
    out = []
    def rel(name, a, b, lo, hi, text):
        if not b:
            return
        r = a / b
        out.append((name, f"{text}: 내 {a} / 기준 {b}", "ok" if lo <= r <= hi else ("warn" if lo * 0.6 <= r <= hi * 1.6 else "bad")))
    out.append(("팔레트 포함", f"기준 색의 ±20 이내 픽셀 {cov * 100:.0f}%", "ok" if cov >= 0.85 else "warn" if cov >= 0.55 else "bad"))
    rel("색 수", ref["colors"] and mine["colors"], ref["colors"], 0.5, 1.5, "구역 안 색 수")
    out.append(("외톨이 점", f"1px 잡음 비율: 내 {mine['isolated']} / 기준 {ref['isolated']}", "ok" if mine["isolated"] <= ref["isolated"] * 2 + 0.01 else "warn"))
    rel("덩이 크기", mine["clump"], ref["clump"], 0.6, 1.6, "같은 색 덩이 평균 픽셀")
    rel("경계 밀도", mine["boundary"], ref["boundary"], 0.7, 1.4, "질감이 바쁜 정도")
    out.append(("윤곽", f"가장 어두운 색: 내 {mine['outline']} (밝기 {mine['luma_min']}) / 기준 {ref['outline']} (밝기 {ref['luma_min']})", "ok" if mine["luma_min"] >= 20 and abs(mine["luma_min"] - ref["luma_min"]) <= 40 else "warn"))
    out.append(("채도", f"내 {mine['saturation']} / 기준 {ref['saturation']}", "ok" if abs(mine["saturation"] - ref["saturation"]) <= 0.12 else "warn"))
    return out
