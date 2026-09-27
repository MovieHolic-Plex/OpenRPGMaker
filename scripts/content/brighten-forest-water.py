# 숲마을·기후 시트의 움직이는 물(0~212, 수로 3~95) 단색 수면에 시트 자신의 호수 물결(1563)을 입힌다.
# 왜 (2026-09-27 사용자): 움직이는 물은 몸통 120 이 단색 남색이라 넓은 호수가 멈춘 판처럼 보였고,
# 1517~1563 「숲마을 호수 · 자연 물가」는 밝은 물결이지만 프레임이 한 장이라 움직이지 않았다.
# 물가·석축·폭포 그림은 건드리지 않는다 — 각 칸에서 몸통 단색(120 의 색)과 깊은 물 단색(210 의 색) 픽셀만 바꾼다.
# 프레임마다 물결을 대각선으로 한 칸씩 밀어(SHIFTS) 3fps 스트립이 흐르는 물이 된다. 물결 무늬는 16px 주기라
# 이웃 칸·쿼터 합성 사이 이음매가 없다.
# 멱등: 바꿀 색은 시트마다 원본의 단색(아래 SOLID)으로 고정한다. 바꾼 뒤에는 그 색이 남지 않아 다시 돌려도 그대로다.
#   (칸의 첫 픽셀을 읽어 색을 정하면 두 번째 실행이 이미 입힌 물결 색을 단색으로 잘못 읽는다.)
# 사용: python3 scripts/content/brighten-forest-water.py [--dry]
#   build-climate-chipsets.py 로 기후 시트를 다시 구운 뒤에도 이 스크립트를 다시 돌린다.
import pathlib, sys
import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[2]
# 시트 → (몸통 120 의 단색, 깊은 물 210 의 단색). 원본 시트에서 잰 값이다.
SHEETS = {
    "public/assets/forest-harmony/chipset.png": ((46, 43, 102), (32, 30, 69)),
    "public/assets/climate-villages/snow-chipset.png": ((46, 43, 102), (32, 30, 69)),
    "public/assets/climate-villages/volcano-chipset.png": ((140, 22, 8), (90, 18, 8)),
    "public/assets/climate-villages/desert-chipset.png": ((46, 62, 102), (32, 47, 69)),
    "public/assets/climate-villages/autumn-chipset.png": ((46, 43, 102), (32, 30, 69)),
}
TEXTURE_TILE = 1563          # 숲마을 호수 · 자연 물가의 완전 연결(마스크 255) 칸 = 가장자리 없는 물결
# chipsetAnimation.HORIZONTAL_WATER_BASE_TILES — 가로 3프레임 base, base+1, base+2
BASES = [0, 30, 60, 90, 120, 150, 180, 210, 93, 3, 33, 63]
SHIFTS = [(0, 0), (5, 5), (11, 11)]  # 프레임별 (dx, dy). 16px 주기에서 5·6·5 칸씩 고르게 흐른다
DEEP_SHADE = 0.72

def tile_at(a, t):
    y, x = (t // 30) * 16, (t % 30) * 16
    return a[y:y + 16, x:x + 16]

def brighten(path, solid, dry):
    img = Image.open(ROOT / path).convert("RGBA")
    a = np.array(img)
    body = np.array([*solid[0], 255], np.uint8)
    deep = np.array([*solid[1], 255], np.uint8)
    tex = tile_at(a, TEXTURE_TILE).copy()
    dark = tex.copy(); dark[..., :3] = (dark[..., :3].astype(np.float32) * DEEP_SHADE).astype(np.uint8)
    changed = 0
    for base in BASES:
        for frame, (dx, dy) in enumerate(SHIFTS):
            blk = tile_at(a, base + frame)
            t = np.roll(np.roll(tex, dy, 0), dx, 1); d = np.roll(np.roll(dark, dy, 0), dx, 1)
            m1 = np.all(blk == body, -1); m2 = np.all(blk == deep, -1)
            blk[m1] = t[m1]; blk[m2] = d[m2]
            changed += int(m1.sum() + m2.sum())
    print(f"{path}: {changed} px")
    if not dry and changed:
        Image.fromarray(a).save(ROOT / path, optimize=True)

dry = "--dry" in sys.argv
for sheet, solid in SHEETS.items():
    brighten(sheet, solid, dry)

