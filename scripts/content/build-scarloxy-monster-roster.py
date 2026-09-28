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
    # back-5 는 안전 필터가 한 장 요청을 막아 종마다 따로 받았다. sparchu 뒷모습은 매번 막혀
    # 정면에서 코드로 만든다(make_sparchu_back).
    "back-5-pouch": ["pouch"],
    "back-5-puddlup": ["puddlup"],
}
# 격자(윗줄 정면, 아랫줄 뒷모습). new-1 은 막혀 종마다 한 쌍(왼쪽 정면, 오른쪽 뒷모습)으로 받았다.
# zaplet(찌릿다람)은 매번 막혀 진화형 voltail 그림에서 코드로 만든다(make_zaplet).
NEW_PAIRS = {
    "new-1-a": "pebblit",
    "new-1-b": "bouldurr",
}
NEW_GROUPS = {
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
    # 팔레트 PNG 로 둔다(RGBA 로 풀면 장당 150~210KB, 팔레트면 그 절반 이하).
    return small.quantize(colors=BACKDROP_COLORS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def shrink_tail(crop, box, anchor_x, factor=0.55):
    """box=(x0, y0, x1, y1) 안의 꼬리를 factor 배로 줄여 아래쪽 뿌리(anchor_x, y1)에 다시 붙인다."""
    x0, y0, x1, y1 = box
    out = crop.copy()
    region = out[y0:y1, x0:x1].copy()
    out[y0:y1, x0:x1] = 0
    h, w = region.shape[:2]
    nw, nh = max(1, round(w * factor)), max(1, round(h * factor))
    small = np.array(Image.fromarray(region, "RGBA").resize((nw, nh), Image.NEAREST))
    px = int(round(anchor_x - (anchor_x - x0) * factor))
    py = y1 - nh
    dst = out[py:py + nh, px:px + nw]
    mask = small[..., 3] > 0
    dst[mask] = small[mask]
    return out


def make_zaplet(front_crop, back_crop):
    """찌릿다람(아기)은 생성이 매번 막혀 번개꼬리 그림에서 만든다: 지그재그 꼬리를 절반 남짓으로 줄이고,
    몸 전체를 작게(몸통 긴 축 96x0.62) 둔다. 생성 원본 기준 좌표(정면 375px, 뒷모습 376px 성분)."""
    fh, fw = front_crop.shape[:2]
    bh, bw = back_crop.shape[:2]
    # 정면: 꼬리는 오른쪽 위(x≥0.61w, y<0.44h), 뿌리 x≈0.79w. 뒷모습: 왼쪽 위(x<0.37w, y<0.43h), 뿌리 x≈0.21w.
    front = shrink_tail(front_crop, (round(fw * 0.61), 0, fw, round(fh * 0.44)), round(fw * 0.79))
    back = shrink_tail(back_crop, (0, 0, round(bw * 0.37), round(bh * 0.43)), round(bw * 0.21))
    return normalize(front, fill=0.64), normalize(back, fill=0.64), icon(front)


def make_sparchu_back():
    """스파르츄 뒷모습은 생성이 매번 막혀 정면 스프라이트에서 만든다.
    좌우 반전(머리가 오른쪽 = 적 쪽)한 뒤 얼굴(주황 피부·눈·이빨)을 등껍질 색으로 다시 칠하고,
    배 쪽 주황은 한 단계 어두운 등 피부색으로 낮춘다. 외곽선(검정)은 실루엣 테두리만 남긴다."""
    src = np.array(Image.open(os.path.join(OUT, "scarloxy-monster-sparchu.png")).convert("RGBA"))
    a = src[:, ::-1].copy()
    rgb = a[..., :3].astype(np.int32)
    opaque = a[..., 3] > 0
    interior = ndimage.binary_erosion(opaque, iterations=2)

    def is_col(c):
        return (np.abs(rgb - np.array(c)).sum(-1) < 12) & opaque

    orange, red, maroon, white, black = (255, 136, 69), (171, 76, 69), (100, 40, 35), (255, 255, 255), (0, 0, 0)
    shell, shell_hi, seam = (196, 143, 86), (255, 202, 96), (171, 76, 69)
    h, w = opaque.shape
    ys, xs = np.mgrid[0:h, 0:w]
    # 반전 후 얼굴 자리(정면 x 22~50 → 반전 x 45~73, y 40~62). 헬멧 아래 주황 얼굴 덩어리.
    face = (xs >= 44) & (xs <= 75) & (ys >= 40) & (ys <= 63)
    face_px = face & interior & (is_col(orange) | is_col(red) | is_col(maroon) | is_col(white) | is_col(black))
    pattern = np.where(((ys // 2) % 3) == 0, 1, 0)
    fill = np.where(pattern[..., None] == 1, np.array(shell_hi), np.array(shell))
    seams = ((xs - 44) % 9 == 0)
    fill = np.where(seams[..., None], np.array(seam), fill)
    rgb = np.where(face_px[..., None], fill, rgb)
    # 몸통 아래쪽 주황(배·팔 안쪽)은 등 피부로 한 단계 어둡게, 흰 이빨·발톱 밝은 칸은 피부색으로.
    body = (ys > 63) & interior
    rgb = np.where((body & is_col(orange))[..., None], np.array(red), rgb)
    rgb = np.where((body & is_col(white))[..., None], np.array(orange), rgb)
    a[..., :3] = rgb.astype(np.uint8)
    return Image.fromarray(a, "RGBA")


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
    if not only or "sparchu" in only:
        back = make_sparchu_back()
        back.save(os.path.join(args.out, "scarloxy-monster-sparchu-back.png"))
        pairs.append(("sparchu", [Image.open(os.path.join(OUT, "scarloxy-monster-sparchu.png")).convert("RGBA"), back]))
        report["sparchu"] = {"back": back.getbbox(), "derived": "front"}
        print("sparchu: 정면에서 유도")
    if pairs:
        review_sheet(pairs, os.path.join(REVIEW, "backs.png"))

    pairs = []
    jobs = []
    for rid, key in NEW_PAIRS.items():
        if want(rid):
            a = remove_background(Image.open(os.path.join(args.raw, rid + ".png")))
            fc, bc = components(a, 2)
            jobs.append((rid, [key], [fc], [bc]))
    for rid, keys in NEW_GROUPS.items():
        if want(rid):
            a = remove_background(Image.open(os.path.join(args.raw, rid + ".png")))
            crops = components(a, len(keys) * 2, rows=2)
            jobs.append((rid, keys, crops[: len(keys)], crops[len(keys):]))
    raw_crops = {}
    for rid, keys, fronts, backs in jobs:
        for key, fc, bc in zip(keys, fronts, backs):
            raw_crops[key] = (fc, bc)
            front = normalize(fc)
            back = normalize(bc)
            ic = icon(fc)
            front.save(os.path.join(args.out, f"scarloxy-monster-{key}.png"))
            back.save(os.path.join(args.out, f"scarloxy-monster-{key}-back.png"))
            ic.save(os.path.join(args.out, f"scarloxy-monster-icon-{key}.png"))
            pairs.append((key, [front, back, ic]))
            report[key] = {"front": front.getbbox(), "back": back.getbbox(), "icon": ic.size}
        print(f"{rid}: {', '.join(keys)}")
    if "voltail" in raw_crops and (not only or "zaplet" in only):
        fc, bc = raw_crops["voltail"]
        front, back, ic = make_zaplet(fc, bc)
        front.save(os.path.join(args.out, "scarloxy-monster-zaplet.png"))
        back.save(os.path.join(args.out, "scarloxy-monster-zaplet-back.png"))
        ic.save(os.path.join(args.out, "scarloxy-monster-icon-zaplet.png"))
        pairs.append(("zaplet", [front, back, ic]))
        report["zaplet"] = {"front": front.getbbox(), "back": back.getbbox(), "icon": ic.size, "derived": "voltail"}
        print("zaplet: voltail 에서 유도")
    if pairs:
        review_sheet(pairs, os.path.join(REVIEW, "new-species.png"))

    shots = []
    for name in BACKDROPS:
        rid = f"backdrop-{name}"
        if not want(rid):
            continue
        bd = backdrop(Image.open(os.path.join(args.raw, rid + ".png")))
        bd.save(os.path.join(args.out, f"scarloxy-backdrop-{name}.png"), optimize=True)
        shots.append(bd.convert("RGBA"))
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

