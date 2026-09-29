"""b4 전투 시트 확인판: 인원 전원의 대기·시전(windup)·공격·피격·쓰러짐 칸을 원본 걷기 칩 옆에 놓는다(≤1900px로 쪼갠다)."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / '.omo/r2w8/b4'
CELLS = {'idle_a': (0, 0), 'idle_c': (2, 0), 'windup': (0, 1), 'attack': (2, 1), 'hit': (1, 2), 'dead': (2, 2)}
BG = (32, 40, 64, 255)
CHIPS = [f'monster2-{i}' for i in range(8)]
SIZE = {i: 64 for i in (1, 4, 5, 6, 7)}


def chip_ref(i, scale):
    sheet = Image.open(ROOT / 'public/assets/easyrpg/charset/Monster2.png').convert('RGBA')
    cx, cy = i % 4, i // 4
    x0, y0 = cx * 72 + 24, cy * 128 + 3 * 32   # middle frame, left-facing row
    return sheet.crop((x0, y0, x0 + 24, y0 + 32)).resize((24 * scale, 32 * scale), Image.NEAREST)


def build(scale=3, groups=((0, 4), (4, 8))):
    for gi, (a, b) in enumerate(groups):
        cell64 = 64 * scale
        W = 24 * scale + 6 + 6 * (cell64 + 4)
        H = (b - a) * (cell64 + 4)
        im = Image.new('RGBA', (W, H), BG)
        d = ImageDraw.Draw(im)
        for r, i in enumerate(range(a, b)):
            chip = f'monster2-{i}'
            cell = 64 if i in SIZE else 48
            y = r * (cell64 + 4)
            im.alpha_composite(chip_ref(i, scale), (0, y + cell64 - 32 * scale))
            sheet = Image.open(ROOT / f'public/assets/generated/party-pixel/{chip}.png').convert('RGBA')
            for k, (name, (cx, cy)) in enumerate(CELLS.items()):
                fr = sheet.crop((cx * cell, cy * cell, cx * cell + cell, cy * cell + cell)).resize((cell * scale, cell * scale), Image.NEAREST)
                x = 24 * scale + 6 + k * (cell64 + 4)
                im.alpha_composite(fr, (x, y + cell64 - cell * scale))
                d.text((x + 2, y + 2), f'{chip} {name}', fill=(240, 240, 160, 255))
                d.line((x, y + (cell64 - 4 * scale), x + cell64, y + (cell64 - 4 * scale)), fill=(60, 74, 104, 255))
        assert im.width <= 1900 and im.height <= 1900, im.size
        im.convert('RGB').save(OUT / f'roster-sheets-{gi + 1}.png')
        print('saved', OUT / f'roster-sheets-{gi + 1}.png', im.size)


if __name__ == '__main__':
    build()
