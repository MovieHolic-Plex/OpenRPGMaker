"""현대 타일 장면에 실제 캐릭터 칩을 세워 크기 비율을 보는 탐침.

    python3 scripts/content/modern-tiles/scale_probe.py <spec.json> <out_dir>

spec = {"scenes": [{"id", "png", "center": [px, py], "chars": [[tx, ty, "scarloxy1|scarloxy2|actor1", idx], ...]}]}
- png 은 출하 player.html 1배 촬영(modern-tiles.capture.mjs) 또는 같은 화소의 파이썬 렌더.
- 캐릭터는 엔진과 같은 놓기: 24×32 걷기 칸 가운데 프레임·아래 방향, 발이 칸 아래 변, 가로 가운데.
- 출력: <id>-480.png(기본 해상도 480×270 줌 1 화면), <id>-480x3.png(3배).
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
SHEETS = {
    "scarloxy1": ROOT / "public/assets/scarloxy/scarloxy-charset-people1.png",
    "scarloxy2": ROOT / "public/assets/scarloxy/scarloxy-charset-people2.png",
    "actor1": ROOT / "public/assets/easyrpg/charset/Actor1.png",
}
_cache: dict = {}


def frame(sheet: str, idx: int) -> Image.Image:
    if sheet not in _cache:
        im = Image.open(SHEETS[sheet]).convert("RGBA")
        if sheet == "actor1":  # RM2000 색 키: 왼쪽 위 화소
            key = im.getpixel((0, 0))
            px = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    if px[x, y][:3] == key[:3]:
                        px[x, y] = (0, 0, 0, 0)
        _cache[sheet] = im
    im = _cache[sheet]
    bx, by = (idx % 4) * 72, (idx // 4) * 128
    return im.crop((bx + 24, by + 64, bx + 48, by + 96))  # 아래 방향(줄 2), 가운데 프레임


def compose(scene: dict) -> Image.Image:
    base = Image.open(scene["png"]).convert("RGBA")
    out = base.copy()
    for tx, ty, sheet, idx in sorted(scene.get("chars", []), key=lambda c: c[1]):
        fr = frame(sheet, idx)
        out.alpha_composite(fr, (round(tx * 16 - 4), round(ty * 16 + 16 - 32)))
    return out


def main() -> None:
    spec = json.loads(Path(sys.argv[1]).read_text())
    out_dir = Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    for sc in spec["scenes"]:
        im = compose(sc)
        cx, cy = sc.get("center", [im.width // 2, im.height // 2])
        x0 = max(0, min(im.width - 480, cx - 240))
        y0 = max(0, min(im.height - 270, cy - 135))
        view = Image.new("RGBA", (480, 270), (0, 0, 0, 255))
        view.alpha_composite(im.crop((x0, y0, min(im.width, x0 + 480), min(im.height, y0 + 270))), (0, 0))
        view.save(out_dir / f"{sc['id']}-480.png")
        view.resize((1440, 810), Image.NEAREST).save(out_dir / f"{sc['id']}-480x3.png")
        print(sc["id"], (x0, y0))


if __name__ == "__main__":
    main()
