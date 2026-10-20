"""적대적 VQA 판: 우리 장면(캐릭터를 세운 480×270 기본 화면)과 버들항 같은 크기 조각을 1배·3배로 나란히.

    python3 scripts/content/modern-tiles/vqa_boards.py <probe_dir> <out_dir>

probe_dir 은 scale_probe.py 출력(<id>-480.png). 버들항 조각은 tiledata/beodeul-city/render-full/city6.png(100×100칸 1배)에서 자른다.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
BEO = Image.open(ROOT / "tiledata/beodeul-city/render-full/city6.png").convert("RGBA")
# 장면 → 버들항 비교 조각(x0, y0) — 같은 480×270 창
REF = {
    "mc-city": (880, 540),
    "mc-street": (880, 540),
    "campus-roofs": (880, 540),
    "jp-harbor": (560, 1330),
    "jp-coast": (560, 1330),
    "jp-gorge": (560, 930),
}


def main() -> None:
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for f in sorted(src.glob("*-480.png")):
        sid = f.name[: -len("-480.png")]
        ours = Image.open(f).convert("RGBA")
        x0, y0 = REF.get(sid, (880, 540))
        ref = BEO.crop((x0, y0, x0 + 480, y0 + 270))
        board = Image.new("RGBA", (480 * 2 + 8, 270), (255, 255, 255, 255))
        board.alpha_composite(ours, (0, 0))
        board.alpha_composite(ref, (488, 0))
        board.save(out / f"{sid}-vs-beodeul-1x.png")
        board.resize((board.width * 3, board.height * 3), Image.NEAREST).save(out / f"{sid}-vs-beodeul-3x.png")
        print(sid)


if __name__ == "__main__":
    main()
