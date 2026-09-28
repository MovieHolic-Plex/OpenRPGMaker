# Scarloxy 몬스터 게임 출연진 변환 스크립트
#
# tiledata/pkmn-characters/raw/ 의 생성 원본(이미지 생성 모델, Scarloxy MPWSP01 화풍 참고)을
# RM2K3 규격 리소스로 바꿔 public/assets/scarloxy/ 에 출력한다.
#   - 걷기 그림: char-<역할>.png (4행 = 아래/왼/오른/위, 3열 = 걸음A/정지/걸음B, 칸 사이 넓은 여백)
#     -> 24x32 칸, 캐릭터당 3패턴 x 4방향, 288x256 시트(scarloxy-charset-people3/4.png)
#   - 얼굴: faces-main.png (가로 5칸) -> 48x48 낱장 scarloxy-face-<역할>.png
# 결과 배치는 tiledata/pkmn-characters/cast-manifest.json 에 기록한다.
#
# 실행: python3 scripts/build-scarloxy-cast.py [--preview]

import json
import os
import sys

import cv2
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "tiledata", "pkmn-characters", "raw")
OUT = os.path.join(ROOT, "public", "assets", "scarloxy")
PREVIEW = os.path.join(ROOT, "tiledata", "pkmn-characters", "preview")
MANIFEST = os.path.join(ROOT, "tiledata", "pkmn-characters", "cast-manifest.json")

FRAME_W, FRAME_H = 24, 32
# 원본 Scarloxy 주민의 몸 높이는 26~29px(발끝이 칸 맨 아래 줄). 아이는 조금 작게.
SHEETS = [
    ("people3", [
        ("professor", 29), ("mom", 28), ("nurse", 28), ("clerk", 28),
        ("champion", 29), ("bug-catcher", 26), ("hiker", 29), ("swimmer", 28),
    ]),
    ("people4", [("camper-girl", 27), ("fisherman", 28), ("gentleman", 29)]),
]
FACES = ["professor", "mom", "nurse", "champion", "clerk"]
FACE_BG = (130, 185, 228)  # 기존 generated-faceset-missing-scarloxy 얼굴 배경색
PALETTE_COLORS = 24
# 원본 행(아래/왼/오른/위) -> RM2K3 행(위/오른/아래/왼)
RM2K3_ROW_FROM_RAW = [3, 2, 0, 1]


def frame_boxes(alpha: np.ndarray) -> list:
    """넓은 여백으로 떨어진 12개 그림의 테두리 상자를 행 우선으로 돌려준다."""
    solid = (alpha > 128).astype(np.uint8)
    grown = cv2.dilate(solid, np.ones((15, 15), np.uint8))
    count, labels, stats, _ = cv2.connectedComponentsWithStats(grown)
    boxes = []
    for label in range(1, count):
        if stats[label, 4] < 2000:
            continue
        ys, xs = np.nonzero((labels == label) & (solid > 0))
        boxes.append((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    if len(boxes) != 12:
        raise SystemExit(f"그림 12개를 기대했지만 {len(boxes)}개를 찾았다")
    boxes.sort(key=lambda b: b[1])
    rows = [sorted(boxes[i * 3:(i + 1) * 3], key=lambda b: b[0]) for i in range(4)]
    return rows


def shrink(img: Image.Image, scale: float) -> Image.Image:
    """면적 평균으로 줄이고 알파를 이진화한다(반투명 가장자리를 남기지 않는다)."""
    w = max(1, round(img.width * scale))
    h = max(1, round(img.height * scale))
    arr = np.array(img.convert("RGBA")).astype(np.float32)
    # 알파 가중 평균: 투명 픽셀의 색이 가장자리에 번지지 않게 한다.
    premul = arr.copy()
    premul[..., :3] *= arr[..., 3:4] / 255.0
    small = cv2.resize(premul, (w, h), interpolation=cv2.INTER_AREA)
    a = small[..., 3]
    rgb = np.where(a[..., None] > 0, small[..., :3] * 255.0 / np.maximum(a[..., None], 1), 0)
    out = np.zeros((h, w, 4), np.uint8)
    out[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    out[..., 3] = np.where(a >= 110, 255, 0).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def quantize_frames(frames: list, colors: int) -> list:
    """캐릭터 12칸을 한 팔레트로 묶는다 — 칸마다 색이 달라 걸을 때 번쩍이지 않게."""
    strip = Image.new("RGBA", (sum(f.width for f in frames), max(f.height for f in frames)), (0, 0, 0, 0))
    x = 0
    for f in frames:
        strip.paste(f, (x, 0))
        x += f.width
    arr = np.array(strip)
    opaque = arr[..., 3] > 0
    rgb = Image.fromarray(np.where(opaque[..., None], arr[..., :3], 0).astype(np.uint8), "RGB")
    pal = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
    q = np.array(pal)
    out = []
    x = 0
    for f in frames:
        block = np.zeros((f.height, f.width, 4), np.uint8)
        block[..., :3] = q[: f.height, x:x + f.width]
        block[..., 3] = arr[: f.height, x:x + f.width, 3]
        out.append(Image.fromarray(block, "RGBA"))
        x += f.width
    return out


def outline(img: Image.Image) -> Image.Image:
    """Scarloxy 식 1px 테두리: 투명과 맞닿은 불투명 픽셀을 제 색의 어두운 톤으로 바꾼다.
    실루엣을 넓히지 않으므로 칸 폭이 그대로다."""
    arr = np.array(img)
    solid = arr[..., 3] > 0
    padded = np.pad(solid, 1)
    inner = padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:]
    edge = solid & ~inner
    rgb = arr[..., :3].astype(np.float32)
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    dark = (rgb * 0.42).astype(np.uint8)
    target = edge & (lum > 70)
    arr[..., :3][target] = dark[target]
    return Image.fromarray(arr, "RGBA")


def place(frame: Image.Image) -> Image.Image:
    """칸 가운데·발끝 정렬(scripts/import-scarloxy-pack.py center_charset_frame 과 같은 기준)."""
    cell = Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))
    arr = np.array(frame)
    ys, xs = np.nonzero(arr[..., 3] > 0)
    body = frame.crop((int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1))
    if body.width > FRAME_W or body.height > FRAME_H:
        raise SystemExit(f"칸을 넘는 그림: {body.size}")
    cx = float((xs - xs.min()).mean())
    x = int(round((FRAME_W - 1) / 2 - cx))
    x = max(0, min(FRAME_W - body.width, x))
    cell.paste(body, (x, FRAME_H - body.height))
    return cell


def build_character(role: str, target_h: int) -> list:
    src = Image.open(os.path.join(RAW, f"char-{role}.png")).convert("RGBA")
    rows = frame_boxes(np.array(src)[..., 3])
    # 정지 자세 네 칸의 높이 중앙값으로 한 캐릭터 전체의 배율을 하나로 정한다(칸마다 배율이 다르면 걸을 때 키가 출렁인다).
    stand_h = sorted(r[1][3] - r[1][1] for r in rows)
    scale = target_h / ((stand_h[1] + stand_h[2]) / 2)
    frames = [shrink(src.crop(box), scale) for row in rows for box in row]
    frames = quantize_frames(frames, PALETTE_COLORS)
    frames = [outline(f) for f in frames]
    cells = [place(f) for f in frames]
    return [cells[r * 3:(r + 1) * 3] for r in range(4)]  # 원본 행 순서


def build_charsets(manifest: dict) -> None:
    manifest["charsets"] = []
    for sheet_name, roles in SHEETS:
        sheet = Image.new("RGBA", (288, 256), (0, 0, 0, 0))
        for index, (role, target_h) in enumerate(roles):
            raw_rows = build_character(role, target_h)
            bx, by = (index % 4) * 3, (index // 4) * 4
            for rm_row, raw_row in enumerate(RM2K3_ROW_FROM_RAW):
                for pattern in range(3):
                    sheet.paste(raw_rows[raw_row][pattern], ((bx + pattern) * FRAME_W, (by + rm_row) * FRAME_H))
        file = f"scarloxy-charset-{sheet_name}.png"
        sheet.save(os.path.join(OUT, file))
        manifest["charsets"].append({"file": file, "characters": [role for role, _ in roles]})


def build_faces(manifest: dict) -> None:
    src = Image.open(os.path.join(RAW, "faces-main.png")).convert("RGBA")
    arr = np.array(src)
    solid = (arr[..., 3] > 200).astype(np.uint8)
    count, _, stats, _ = cv2.connectedComponentsWithStats(solid)
    boxes = sorted([tuple(int(v) for v in stats[i, :4]) for i in range(1, count) if stats[i, 4] > 20000], key=lambda b: b[0])
    if len(boxes) != len(FACES):
        raise SystemExit(f"얼굴 {len(FACES)}칸을 기대했지만 {len(boxes)}칸을 찾았다")
    manifest["faces"] = []
    for role, (x, y, w, h) in zip(FACES, boxes):
        side = min(w, h)
        # 세로가 더 긴 칸이면 머리를 살리고 어깨 아래를 조금 자른다.
        top = y + int((h - side) * 0.35)
        left = x + (w - side) // 2
        crop = src.crop((left + 2, top + 2, left + side - 2, top + side - 2)).convert("RGB")
        small = np.array(crop.resize((48, 48), Image.Resampling.BOX))
        # 가장자리와 이어진 파란 배경만 기존 얼굴 배경색 하나로 맞춘다.
        corner = small[0, 0].astype(int)
        close = (np.abs(small.astype(int) - corner).sum(axis=2) < 60).astype(np.uint8)
        _, lab = cv2.connectedComponents(close, connectivity=4)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        bg = np.isin(lab, list(border))
        q = np.array(Image.fromarray(small).quantize(colors=40, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB"))
        q[bg] = FACE_BG
        out = np.dstack([q, np.full((48, 48), 255, np.uint8)])
        file = f"scarloxy-face-{role}.png"
        Image.fromarray(out, "RGBA").save(os.path.join(OUT, file))
        manifest["faces"].append({"role": role, "file": file})


def write_previews(manifest: dict) -> None:
    os.makedirs(PREVIEW, exist_ok=True)
    ref = Image.open(os.path.join(OUT, "scarloxy-charset-people1.png")).convert("RGBA")
    sheets = [ref] + [Image.open(os.path.join(OUT, s["file"])).convert("RGBA") for s in manifest["charsets"]]
    board = Image.new("RGBA", (288, 256 * len(sheets)), (120, 170, 90, 255))
    for i, s in enumerate(sheets):
        board.alpha_composite(s, (0, 256 * i))
    board.resize((board.width * 3, board.height * 3), Image.Resampling.NEAREST).save(os.path.join(PREVIEW, "charsets.png"))
    faces = [Image.open(os.path.join(ROOT, "public/assets/generated/faceset/missing-scarloxy/00.png")).convert("RGBA")]
    faces += [Image.open(os.path.join(OUT, f["file"])).convert("RGBA") for f in manifest["faces"]]
    strip = Image.new("RGBA", (52 * len(faces), 48), (40, 40, 40, 255))
    for i, f in enumerate(faces):
        strip.alpha_composite(f, (52 * i, 0))
    strip.resize((strip.width * 4, strip.height * 4), Image.Resampling.NEAREST).save(os.path.join(PREVIEW, "faces.png"))


def main() -> None:
    manifest: dict = {}
    build_charsets(manifest)
    build_faces(manifest)
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")
    if "--preview" in sys.argv:
        write_previews(manifest)
    print(json.dumps(manifest, ensure_ascii=False))


if __name__ == "__main__":
    main()

