#!/usr/bin/env python3
"""첫 화면 「기본 게임」 그림 굽기.

입력: 출하 플레이어로 찍은 화면(npm run qa:runtime -- --scenario home-builtin, HOME_WHICH=fallen|astra)
      verify-shots/runtime-qa/home-builtin-<which>/0N-*.png (1920×1080).
출력: public/assets/start/builtin/<name>.webp — 960×540(16:9) — 논리 화소 480×270 을 정확히 2배(도트 유지).

폴른 스타는 480×270(16:9) 그대로. 아스트라는 480×320(GBA 비율, 장르 고정)이라 무대(1440×960)에서
가운데 16:9(1440×810)를 자른다.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "verify-shots" / "runtime-qa"
OUT = ROOT / "public" / "assets" / "start" / "builtin"

PLAN = {
    "fallen": {"crop": None, "frames": {"01-title": "fallen-title", "02-op1": "fallen-op1", "04-op3": "fallen-op2", "05-field": "fallen-field"}},
    # 무대 x 240..1680, y 60..1020 → 가운데 16:9 = y 135..945
    "astra": {"crop": (240, 135, 1680, 945), "frames": {"01-title": "astra-title", "02-op1": "astra-op1", "04-op3": "astra-op2", "05-field": "astra-field"}},
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for which, plan in PLAN.items():
        for shot, name in plan["frames"].items():
            src = SHOTS / f"home-builtin-{which}" / f"{shot}.png"
            image = Image.open(src).convert("RGB")
            if plan["crop"]:
                image = image.crop(plan["crop"])
            # 무대 배율(폴른 4배·아스트라 3배)을 먼저 1배(480×270)로 정확히 되돌린 뒤 2배로 — 고르지 않은 배율이면 도트가 들쭉날쭉해진다.
            image = image.resize((480, 270), Image.NEAREST).resize((960, 540), Image.NEAREST)
            dest = OUT / f"{name}.webp"
            image.save(dest, "WEBP", quality=88, method=6)
            print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
