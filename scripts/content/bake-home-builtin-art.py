#!/usr/bin/env python3
"""첫 화면 「기본 게임」 그림 굽기.

입력: 출하 플레이어로 찍은 화면(npm run qa:runtime -- --scenario home-builtin, HOME_WHICH=fallen|astra)
      verify-shots/runtime-qa/home-builtin-<which>/0N-*.png (1920×1080).
출력: public/assets/start/builtin/<name>.webp — 논리 화소 480×270(16:9) 1배, 무손실(2026-10-21).
      화면은 image-rendering: pixelated 로 키운다 — 2배 손실 webp 보다 작고(넷 합 약 절반) 화소 경계에 번짐이 없다.

폴른 스타는 480×270(16:9) 그대로. 아스트라는 480×320(GBA 비율, 장르 고정)이라 무대(1440×960)에서
가운데 16:9(1440×810)를 자른다.
"""
import os
import sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
# 다른 체크아웃(데모를 다듬는 브랜치의 스냅숏)에서 찍었으면 HOME_SHOTS_<WHICH> 로 그 runtime-qa 폴더를 준다.
SHOTS = ROOT / "verify-shots" / "runtime-qa"
OUT = ROOT / "public" / "assets" / "start" / "builtin"

PLAN = {
    "fallen": {"crop": None, "frames": {"01-title": "fallen-title", "02-op1": "fallen-op1", "04-op3": "fallen-op2", "05-field": "fallen-field"}},
    # 무대 x 240..1680, y 60..1020 → 가운데 16:9 = y 135..945
    # 첫 필드(내 방)는 맵이 무대보다 작아 둘레가 검다 — 오프닝 연구소 장면(03-op2)을 넷째 장면으로 쓴다(2026-10-21).
    "astra": {"crop": (240, 135, 1680, 945), "frames": {"01-title": "astra-title", "02-op1": "astra-op1", "04-op3": "astra-op2", "03-op2": "astra-lab"}},
    # 첫사랑은 통짜 플레이 시나리오(first-love, FL_PATH=A, 960×540 = 2배)의 샷을 그대로 쓴다: 타이틀 · 오프닝 편지 · 밤 편의점 선택 · 회상 방송실.
    "firstlove": {"crop": None, "dir": "first-love-A", "frames": {"21-konbini-jihu": "firstlove-konbini", "23-flashback-2": "firstlove-flashback"}},
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[1:])  # 예: bake-home-builtin-art.py firstlove — 적은 것만 다시 굽는다.
    for which, plan in PLAN.items():
        if only and which not in only:
            continue
        for shot, name in plan["frames"].items():
            shots = Path(os.environ.get(f"HOME_SHOTS_{which.upper()}", SHOTS))
            src = shots / plan.get("dir", f"home-builtin-{which}") / f"{shot}.png"
            image = Image.open(src).convert("RGB")
            if plan["crop"]:
                image = image.crop(plan["crop"])
            # 무대 배율(폴른 4배·아스트라 3배)을 정확히 1배(480×270)로 되돌린다 — 고르지 않은 배율이면 도트가 들쭉날쭉해진다.
            image = image.resize((480, 270), Image.NEAREST)
            dest = OUT / f"{name}.webp"
            image.save(dest, "WEBP", lossless=True, method=6)
            print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
