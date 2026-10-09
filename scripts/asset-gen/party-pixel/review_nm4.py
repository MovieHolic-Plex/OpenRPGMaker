"""m4 확인판·검사: 걷기 칩 대기 칸과 전투 시트 idle 비교, actor1-0 과 같은 배율 크기 비교, 새 이펙트 모음.

    python3 scripts/asset-gen/party-pixel/review_nm4.py   → .omo/nm4/size-compare.png · fx-new.png · review.json
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[3]
QA = ROOT / '.omo/nm4'
PP = ROOT / 'public/assets/generated/party-pixel'
FX = ROOT / 'public/assets/generated/pixel-fx'
CS = ROOT / 'public/assets/generated/charsets/Monster4.png'
BG = (40, 56, 72, 255)


def bbox_h(a):
    ys = np.nonzero(a[:, :, 3].any(1))[0]
    return int(ys.max() - ys.min() + 1) if ys.size else 0


def main():
    out = {}
    cs = np.array(Image.open(CS).convert('RGBA'))
    actor = np.array(Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA'))[0:48, 0:48]
    cells = [('actor1-0', actor)]
    for i in range(8):
        sheet = np.array(Image.open(PP / f'monster4-{i}.png').convert('RGBA'))
        idle = sheet[0:48, 0:48]
        bx, by = i % 4 * 72, i // 4 * 128
        stand = cs[by + 96: by + 128, bx + 24: bx + 48]
        # 대기 칸이 칩 서 있는 칸 그대로(칩 × 1)인지: 칩 칸은 x 12..35 · y 14..45(칩 30줄 = 바닥 44)
        placed = idle[14:46, 12:36]
        same = bool((placed == stand).all())
        out[f'monster4-{i}'] = dict(idle_is_chip=same, chip_h=bbox_h(stand), idle_h=bbox_h(idle))
        cells.append((f'monster4-{i}', idle))
    out['actor1-0'] = dict(idle_h=bbox_h(actor))
    s = 4
    w = len(cells) * (48 * s + 6) + 6
    img = Image.new('RGBA', (w, 48 * s + 12), BG)
    d = ImageDraw.Draw(img)
    for k, (name, a) in enumerate(cells):
        x = 6 + k * (48 * s + 6)
        img.alpha_composite(Image.fromarray(a, 'RGBA').resize((48 * s, 48 * s), Image.NEAREST), (x, 6))
        d.line([(x, 6 + 45 * s), (x + 48 * s, 6 + 45 * s)], fill=(90, 110, 130, 255))
    if img.width > 1900:
        img = img.resize((1900, round(img.height * 1900 / img.width)), Image.NEAREST)
    img.save(QA / 'size-compare.png')
    (QA / 'review.json').write_text(json.dumps(out, ensure_ascii=False, indent=1))
    print(json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    main()
