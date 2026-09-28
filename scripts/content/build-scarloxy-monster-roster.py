#!/usr/bin/env python3
"""몬스터 도감 확장 그림 빌드 — 생성 원본(tiledata/pkmn-monsters/raw) → 96px 전투 그림·아이콘·전투 배경.

원본은 이미지 생성 모델이 그린 큰 그림(약 2000px)이다. 요청 목록은 tiledata/pkmn-monsters/requests.json.
  back-1..5   기존 19종 뒷모습, 한 줄(왼쪽→오른쪽 순서가 BACK_GROUPS)
  new-1..4    새 11종, 2줄 격자(윗줄 정면, 아랫줄 뒷모습; 열 순서가 NEW_GROUPS)
  backdrop-*  전투 배경 1920x1080 → 640x360

출력(public/assets/scarloxy/):
  scarloxy-monster-<key>-back.png   96x96 (30종)
  scarloxy-monster-<key>.png        96x96 (새 11종)
  scarloxy-monster-icon-<key>.png   긴 변 ≤56px (새 11종)
  scarloxy-backdrop-<name>.png      640x360 (cave, gym, beach, route)
검토 시트: tiledata/pkmn-monsters/review/*.png

처리: 배경 제거(투명 알파 또는 테두리에서 번지는 단색 배경, 마젠타 번짐 제거) → 성분 분리 →
기존 정면과 같은 정규화(몸통 긴 축 = 96×0.86, 발밑 = 하단 4%) → 알파 가중 BOX 축소 → 팔레트 축소.

실행: python3 scripts/content/build-scarloxy-monster-roster.py [--raw DIR] [--only back-1,new-2]
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORK = os.path.join(ROOT, "tiledata", "pkmn-monsters")
OUT = os.path.join(ROOT, "public", "assets", "scarloxy")
REVIEW = os.path.join(WORK, "review")

BACK_GROUPS = {
    "back-1": ["atrox", "charmadillo", "cindrill", "cleaf"],
    "back-2": ["draem", "emberkit", "finiette", "finsta"],
    "back-3": ["friolera", "gulfin", "ivieron", "jacana"],
    "back-4": ["larvea", "mossling", "pluma", "plumette"],
    "back-5": ["pouch", "puddlup", "sparchu"],
}
NEW_GROUPS = {
    "new-1": ["pebblit", "bouldurr", "zaplet"],
    "new-2": ["voltail", "wispin", "lanterghast"],
    "new-3": ["hornbeet", "toxtoad", "brawlape"],
    "new-4": ["frostpip", "sandscorp"],
}
BACKDROPS = ["cave", "gym", "beach", "route"]

TARGET = 96
FILL = 0.86
FOOT_PAD = 0.04
ICON_MAX = 56
SPRITE_COLORS = 40
BACKDROP_COLORS = 96


# ---------------------------------------------------------------------------
# 배경 제거


def remove_background(im):
    """RGBA 배열(uint8)을 돌려준다. 알파가 이미 있으면 그대로, 없으면 테두리 단색 배경을 번짐으로 지운다."""
    a = np.array(im.convert("RGBA"))
    alpha = a[..., 3]
    if (alpha < 16).mean() > 0.2:
        a[..., 3] = np.where(alpha >= 128, 255, 0).astype(np.uint8)
        return despill(a)
    rgb = a[..., :3].astype(np.int32)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    bg = np.median(border, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(-1))
    near = dist < 60
    labels, _ = ndimage.label(near)
    edge_ids = set(np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))) - {0}
    bgmask = np.isin(labels, list(edge_ids))
    # 몸 안쪽에 갇힌 배경색(다리 사이 등)도 지운다 — 마젠타일 때만(흰 배경이면 흰 몸통을 지울 수 있다).
    if is_magenta(bg):
        bgmask |= dist < 90
    a[..., 3] = np.where(bgmask, 0, 255).astype(np.uint8)
    return despill(a, bg if is_magenta(bg) else None)


def is_magenta(c):
    r, g, b = [float(v) for v in c]
    return r > 180 and b > 150 and g < 110


def despill(a, key=None):
    """투명 경계에 붙은 마젠타 번짐 픽셀을 지운다(보라색 몸통은 배경색 거리로만 판정해 살린다)."""
    rgb = a[..., :3].astype(np.int32)
    opaque = a[..., 3] > 0
    if key is None:
        key = np.array([255, 0, 255])
    dist = np.sqrt(((rgb - np.asarray(key)) ** 2).sum(-1))
    edge = opaque & ndimage.binary_dilation(~opaque, iterations=3)
    a[..., 3] = np.where(edge & (dist < 120), 0, a[..., 3])
    return a


# ---------------------------------------------------------------------------
# 성분 분리


def components(a, expected, rows=1):
    """알파 마스크를 성분으로 나눠 expected 개를 (행, 열) 순서로 돌려준다."""
    mask = a[..., 3] > 0
    grown = ndimage.binary_dilation(mask, iterations=max(6, a.shape[1] // 160))
    labels, count = ndimage.label(grown)
    boxes = ndimage.find_objects(labels)
    items = []
    for i, sl in enumerate(boxes):
        area = int((mask[sl] & (labels[sl] == i + 1)).sum())
        items.append({"id": i + 1, "sl": sl, "area": area})
    if not items:
        raise SystemExit("성분 없음")
    biggest = max(item["area"] for item in items)
    items = [item for item in items if item["area"] >= biggest * 0.04]
    # 큰 성분 expected 개를 남기고, 작은 조각은 가장 가까운 큰 성분에 붙인다(떨어진 불꽃·반짝이).
    items.sort(key=lambda item: -item["area"])
    main, extra = items[:expected], items[expected:]
    if len(main) < expected:
        raise SystemExit(f"성분 {len(main)}개 — 기대 {expected}개")
    groups = {item["id"]: [item["id"]] for item in main}

    def center(sl):
        return ((sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2)

    for item in extra:
        cy, cx = center(item["sl"])
        nearest = min(main, key=lambda m: (center(m["sl"])[0] - cy) ** 2 + (center(m["sl"])[1] - cx) ** 2)
        groups[nearest["id"]].append(item["id"])
    parts = []
    for item in main:
        sel = np.isin(labels, groups[item["id"]]) & mask
        ys, xs = np.nonzero(sel)
        crop = a[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1].copy()
        crop[..., 3] = np.where(sel[ys.min(): ys.max() + 1, xs.min(): xs.max() + 1], crop[..., 3], 0)
        parts.append({"cy": (ys.min() + ys.max()) / 2, "cx": (xs.min() + xs.max()) / 2, "img": crop})
    parts.sort(key=lambda p: p["cy"])
    per_row = expected // rows
    ordered = []
    for r in range(rows):
        row = parts[r * per_row:(r + 1) * per_row]
        ordered.extend(sorted(row, key=lambda p: p["cx"]))
    return [p["img"] for p in ordered]


# ---------------------------------------------------------------------------
# 축소·정규화


def shrink(arr, w, h):
    """알파 가중 BOX 축소 후 알파 이진화 — 투명 픽셀의 RGB 가 테두리로 번지지 않게 한다."""
    f = arr.astype(np.float32)
    alpha = f[..., 3:4] / 255.0
    pre = np.concatenate([f[..., :3] * alpha, f[..., 3:4]], axis=-1).astype(np.uint8)
    small = np.array(Image.fromarray(pre, "RGBA").resize((w, h), Image.BOX)).astype(np.float32)
    sa = small[..., 3:4] / 255.0
    rgb = np.where(sa > 0, small[..., :3] / np.maximum(sa, 1e-6), 0)
    out = np.concatenate([np.clip(rgb, 0, 255), small[..., 3:4]], axis=-1).astype(np.uint8)
    out[..., 3] = np.where(out[..., 3] >= 120, 255, 0)
    return out


def quantize(arr, colors):
    im = Image.fromarray(arr, "RGBA")
    alpha = arr[..., 3]
    rgb = Image.fromarray(arr[..., :3], "RGB").quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    out = np.dstack([np.array(rgb), alpha]).astype(np.uint8)
    out[alpha == 0] = 0
    return out


def outline(arr):
    """투명과 맞닿은 바깥 테두리 픽셀을 어둡게 — Scarloxy 정면처럼 1px 짙은 외곽선을 되살린다."""
    opaque = arr[..., 3] > 0
    edge = opaque & ~ndimage.binary_erosion(opaque)
    rgb = arr[..., :3].astype(np.float32)
    lum = rgb.mean(-1)
    dark = edge & (lum > 70)
    rgb[dark] = rgb[dark] * 0.35
    arr[..., :3] = rgb.astype(np.uint8)
    return arr


def normalize(crop, target=TARGET, fill=FILL, foot_pad=FOOT_PAD):
    h, w = crop.shape[:2]
    limit = target * fill
    scale = min(limit / w, limit / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    small = outline(quantize(shrink(crop, nw, nh), SPRITE_COLORS))
    canvas = np.zeros((target, target, 4), np.uint8)
    x = (target - nw) // 2
    y = max(0, target - nh - round(target * foot_pad))
    canvas[y:y + nh, x:x + nw] = small
    return Image.fromarray(canvas, "RGBA")


def icon(crop):
    h, w = crop.shape[:2]
    scale = ICON_MAX / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    return Image.fromarray(outline(quantize(shrink(crop, nw, nh), 24)), "RGBA")


def backdrop(im):
    rgb = im.convert("RGB")
    w, h = rgb.size
    # 16:9 가운데 자르기 후 640x360.
    want = w / h
    if abs(want - 16 / 9) > 0.01:
        if want > 16 / 9:
            nw = round(h * 16 / 9)
            rgb = rgb.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
        else:
            nh = round(w * 9 / 16)
            rgb = rgb.crop((0, (h - nh) // 2, w, (h - nh) // 2 + nh))
    small = rgb.resize((640, 360), Image.BOX)
    q = small.quantize(colors=BACKDROP_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return q.convert("RGBA")


# ---------------------------------------------------------------------------
# 검토 시트


def review_sheet(pairs, path, scale=3):
    """[(label, [Image...])] → 한 장. 각 줄: 정면(있으면)·뒷모습을 회색 바탕에 크게."""
    cols = max(len(images) for _, images in pairs)
    cell = TARGET * scale + 16
    sheet = Image.new("RGBA", (cols * cell + 16, len(pairs) * cell + 16), (150, 160, 150, 255))
    for r, (_, images) in enumerate(pairs):
        for c, image in enumerate(images):
            big = image.resize((image.width * scale, image.height * scale), Image.NEAREST)
            sheet.alpha_composite(big, (16 + c * cell, 16 + r * cell))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.save(path)


# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", default=os.path.join(WORK, "raw"))
    parser.add_argument("--out", default=OUT)
    parser.add_argument("--only", default="")
    args = parser.parse_args()
    only = {x for x in args.only.split(",") if x}
    os.makedirs(args.out, exist_ok=True)
    report = {}

    def want(rid):
        return (not only or rid in only) and os.path.exists(os.path.join(args.raw, rid + ".png"))

    pairs = []
    for rid, keys in BACK_GROUPS.items():
        if not want(rid):
            continue
        a = remove_background(Image.open(os.path.join(args.raw, rid + ".png")))
        crops = components(a, len(keys))
        for key, crop in zip(keys, crops):
            back = normalize(crop)
            back.save(os.path.join(args.out, f"scarloxy-monster-{key}-back.png"))
            front_path = os.path.join(OUT, f"scarloxy-monster-{key}.png")
            front = Image.open(front_path).convert("RGBA") if os.path.exists(front_path) else back
            pairs.append((key, [front, back]))
            report[key] = {"back": back.getbbox()}
        print(f"{rid}: {', '.join(keys)}")
    if pairs:
        review_sheet(pairs, os.path.join(REVIEW, "backs.png"))

    pairs = []
    for rid, keys in NEW_GROUPS.items():
        if not want(rid):
            continue
        a = remove_background(Image.open(os.path.join(args.raw, rid + ".png")))
        crops = components(a, len(keys) * 2, rows=2)
        fronts, backs = crops[: len(keys)], crops[len(keys):]
        for key, fc, bc in zip(keys, fronts, backs):
            front = normalize(fc)
            back = normalize(bc)
            ic = icon(fc)
            front.save(os.path.join(args.out, f"scarloxy-monster-{key}.png"))
            back.save(os.path.join(args.out, f"scarloxy-monster-{key}-back.png"))
            ic.save(os.path.join(args.out, f"scarloxy-monster-icon-{key}.png"))
            pairs.append((key, [front, back, ic]))
            report[key] = {"front": front.getbbox(), "back": back.getbbox(), "icon": ic.size}
        print(f"{rid}: {', '.join(keys)}")
    if pairs:
        review_sheet(pairs, os.path.join(REVIEW, "new-species.png"))

    shots = []
    for name in BACKDROPS:
        rid = f"backdrop-{name}"
        if not want(rid):
            continue
        bd = backdrop(Image.open(os.path.join(args.raw, rid + ".png")))
        bd.save(os.path.join(args.out, f"scarloxy-backdrop-{name}.png"))
        shots.append(bd)
        print(f"{rid}: 640x360")
    if shots:
        sheet = Image.new("RGBA", (640 * 2, 360 * ((len(shots) + 1) // 2)))
        for i, s in enumerate(shots):
            sheet.paste(s, ((i % 2) * 640, (i // 2) * 360))
        os.makedirs(REVIEW, exist_ok=True)
        sheet.save(os.path.join(REVIEW, "backdrops.png"))
    json.dump(report, sys.stdout, ensure_ascii=False, default=str)
    print()


if __name__ == "__main__":
    main()

