#!/usr/bin/env python3
"""숲마을 「낮은 돌 우물」(공용 소품 2×2) 색·명암을 숲마을 칩셋 돌에 맞춘다.

    python3 scripts/content/recolor-forest-stone-well.py          # 적용
    python3 scripts/content/recolor-forest-stone-well.py --dry    # 바뀔 파일만

왜 (2026-09-28): AI 조수 숲마을 게임 화면에서 우물만 따로 놀았다. 원본은 Tibo 생성 소품이라
  · 파란 회색(청색 치우침 +20)에 거의 검은 남색 외곽선·물이 불투명 칸의 34% — 칩셋 돌(비석·돌기둥)은 중성 회색이다
  · 앞 입술이 가장 밝고 양옆이 어두운 "베개 음영" — 칩셋은 왼위에서 빛이 온다
  · 발밑 그림자가 없어 잔디 위에 떠 보였다 — 칩셋 나무는 발치에 숲 그늘이 있다
픽셀 모양(외곽·돌 줄눈)은 그대로 두고 색만 바꾼다.
  · 돌: 칩셋 비석·돌기둥(266·296·267·297)의 중성 회색 8단. 원래 밝기 순위를 그대로 옮기고 왼쪽 +, 오른쪽 −, 벽 밑 네 줄 −1단.
  · 외곽선: 램프 맨 아래(짙은 녹회색). 물: 칩셋 물 그늘(13,27,46).
  · 접지 그림자: 투명 픽셀에만, 나무 그림자(bake-forest-harmony-tree-shadows.py)와 같은 숲 그늘색·알파 3단·4×4 디더.

같은 네 칸이 번들 시트 여러 장에 그대로 복사돼 있다(공용 소품 시트·기후/생물군 칩셋·등록 장소 아틀라스). 원본 칸과 픽셀이
똑같은 16px 칸만 찾아 바꾸므로 다시 돌려도 아무것도 바뀌지 않는다. 원본 칸 해시(OLD_CELLS)를 고정해 두어, 이미 바뀐 시트에서
돌려도 새 칸을 다시 칠하지 않는다.

PNG 를 다시 쓰면 참고문서 이미지 목록(src/assets/bundledReferenceImageManifest.json)에 새 내용 요약 키를 더한다(요약 규칙은
src/project/bundledReferenceImagePath.ts referenceImageDigest 와 같다). 옛 키는 지우지 않는다 — 옛 프로젝트에 인라인으로 저장된
이전 그림을 불러올 때 같은 경로로 바꿔 주는 키다(목록에는 이미 한 경로에 여러 키가 있다).
"""
import base64
import hashlib
import glob
import json
import os
import sys
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOURCE = os.path.join(ROOT, "public/assets/shared-village/objects.png")
PREVIEW = os.path.join(ROOT, "public/assets/shared-objects/prop_forest_stone-well-low-cliff-life.png")
MANIFEST = os.path.join(ROOT, "src/assets/bundledReferenceImageManifest.json")
S = 16
CELLS = [40, 41, 46, 47]          # objects.png 6열 시트의 우물 칸(왼위·오른위·왼아래·오른아래)
# 원본(2026-09-21 Tibo 소품) 네 칸의 RGBA 바이트 sha256 — 이 칸만 바꾼다.
OLD_CELLS = [
    "e8f4d6ff0313ac25ca5fed112b9dc38ade4885d207496676cabc60e6b3141b23",
    "092937e52298df77b3e7f81c750099c26775751be4bfb0db4dcfec2a3802620e",
    "95438191fa2535c5a40dc9a267bbca3530d8f0d51f8dd404e63f32e525a5a468",
    "bd30e7fcd2a671b82370e7aa7237fbf58403de49ff2867e285fd555ebe64e4ec",
]
RAMP = [(24, 31, 30), (43, 57, 52), (62, 64, 61), (89, 91, 88), (118, 120, 116), (146, 148, 145), (172, 174, 170), (196, 198, 195)]
APPLIED_CELLS = [
    "1ba0c30fbb1584dbf8795cdc37e085c30d37ce744e3eca677c0b170d5bcc6ba7",
    "fdfd39895bc461db8c8a54e963f1b841860fb8a44b82136fbbd85c64a0dc3dd5",
    "40dd7df82d6e70e02de70cd4b480258a0e3b849c8b1071327b07bf0700daa100",
    "2e7b43f572b38263a30b911ce65ccb984f5984d7826aebe105d4a0ea6711e31f",
]
WATER = (13, 27, 46)
SHADE = (16, 38, 26)
ALPHA = [0, 70, 110, 150]
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def lum(p):
    return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]


def cell(sheet, i, per_row):
    x, y = i % per_row * S, i // per_row * S
    return sheet.crop((x, y, x + S, y + S))


def reference_digest(value):
    """src/project/bundledReferenceImagePath.ts referenceImageDigest 와 같은 두 줄 FNV 요약(UTF-16 코드 단위 = ASCII)."""
    h1, h2 = 2166136261, (0x811C9DC5 ^ len(value)) & 0xFFFFFFFF
    for ch in value:
        code = ord(ch)
        h1 = ((h1 ^ code) * 16777619) & 0xFFFFFFFF
        h2 = ((h2 ^ code) * 2246822519) & 0xFFFFFFFF
    return f"s{len(value)}:{h1}:{h2}"


def data_url(path):
    with open(path, "rb") as handle:
        return "data:image/png;base64," + base64.b64encode(handle.read()).decode("ascii")


def recolor(well):
    px = well.load()
    cols = sorted({px[x, y][:3] for y in range(32) for x in range(32) if px[x, y][3]}, key=lum)
    water, outline, rest = cols[0], cols[1], cols[2:]
    out = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    op = out.load()
    n = len(RAMP)
    for y in range(32):
        for x in range(32):
            p = px[x, y]
            if not p[3]:
                continue
            c = p[:3]
            if c == water:
                op[x, y] = (*WATER, 255)
            elif c == outline:
                op[x, y] = (*RAMP[0], 255)
            else:
                level = 1 + rest.index(c) / max(1, len(rest) - 1) * (n - 2)
                level += (15.5 - x) / 15.5 * 0.9
                if y >= 25:
                    level -= 1.0
                op[x, y] = (*RAMP[max(1, min(n - 1, round(level)))], 255)
    for y in range(22, 32):
        for x in range(32):
            if op[x, y][3]:
                continue
            d = ((x - 17.5) / 16.0) ** 2 + ((y - 29.5) / 3.2) ** 2
            if d >= 1:
                continue
            a = ALPHA[max(0, min(3, round((1 - d) * 3 + (BAYER[y % 4][x % 4] / 16 - 0.5) * 0.9)))]
            if a:
                op[x, y] = (*SHADE, a)
    return out


def main():
    dry = "--dry" in sys.argv
    sheet = Image.open(SOURCE).convert("RGBA")
    old = [cell(sheet, i, 6) for i in CELLS]
    hashes = [hashlib.sha256(tile.tobytes()).hexdigest() for tile in old]
    # The subsequent outline pass owns the final shipped sprite.
    final_path = os.path.join(ROOT, "tiledata/forest-stone-well/stone-well-low.png")
    if os.path.exists(final_path):
        final = Image.open(final_path).convert("RGBA")
        final_hashes = [hashlib.sha256(cell(final, i, 2).tobytes()).hexdigest() for i in range(4)]
        if hashes == final_hashes:
            print("이미 적용됨 — 외곽선 정리까지 반영된 최종 우물이다")
            return 0
    if hashes == APPLIED_CELLS:
        print("이미 적용됨 — objects.png 우물 칸이 결과 해시와 일치한다")
        return 0
    if hashes != OLD_CELLS:
        print("중단: objects.png 우물 칸이 알려진 원본/결과와 다르다", file=sys.stderr)
        return 1
    well = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for k, tile in enumerate(old):
        well.paste(tile, ((k % 2) * S, (k // 2) * S))
    new_well = recolor(well)
    new = [new_well.crop(((k % 2) * S, (k // 2) * S, (k % 2) * S + S, (k // 2) * S + S)) for k in range(4)]
    lookup = {tile.tobytes(): new[k] for k, tile in enumerate(old)}
    with open(MANIFEST, encoding="utf8") as handle:
        manifest = json.load(handle)
    by_path = {path: key for key, path in manifest.items()}
    changed = []
    for path in sorted(glob.glob(os.path.join(ROOT, "public/assets/**/*.png"), recursive=True)):
        try:
            image = Image.open(path)
            if image.width % S or image.height % S or image.width * image.height > 4_000_000:
                continue
            image = image.convert("RGBA")
        except OSError:
            continue
        hits = 0
        for y in range(0, image.height, S):
            for x in range(0, image.width, S):
                replacement = lookup.get(image.crop((x, y, x + S, y + S)).tobytes())
                if replacement is not None:
                    image.paste(replacement, (x, y))
                    hits += 1
        if hits:
            changed.append((os.path.relpath(path, ROOT), hits))
            if not dry:
                image.save(path, optimize=True)
                public = "/" + os.path.relpath(path, os.path.join(ROOT, "public")).replace(os.sep, "/")
                if public in by_path:
                    manifest.setdefault(reference_digest(data_url(path)), public)
    # 오브젝트 카드 미리보기(96×96 = 3배 최근접)는 칸 격자가 아니라 따로 다시 그린다.
    if not dry:
        new_well.resize((96, 96), Image.NEAREST).save(PREVIEW, optimize=True)
        with open(MANIFEST, "w", encoding="utf8") as handle:
            json.dump(manifest, handle, ensure_ascii=False, indent=1)
            handle.write("\n")
    changed.append((os.path.relpath(PREVIEW, ROOT), 1))
    for path, hits in changed:
        print(f"{'(dry) ' if dry else ''}{path}: {hits}칸")
    return 0


if __name__ == "__main__":
    sys.exit(main())

