"""b3 네 명(monster1-4..7) 15칸 시트 검사 + 크기 비교판.
검사: 크기 (cell*3)×(cell*5), 알파 0/255, ≤16색, 빈 칸 없음, 15칸 서로 다름, 바닥선(사신은 dead 만 바닥).
확인판 .omo/pp3/size-compare.png: 모두 대기 칸을 같은 배율(4배)로 한 줄 + 아군 사람 전투 도트 actor1-0 (0,0) 48칸 + 걷기 칩 2배."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pp15_pp3 import ROOT, QA, NAMES, check, chip_frame

CHIPS = [('monster1-4', 4, ('leap',)), ('monster1-5', 5, ('leap',)), ('monster1-6', 6, tuple(n for n in NAMES if n != 'dead')), ('monster1-7', 7, ('leap',))]
bad = 0
for chip, idx, air in CHIPS:
    sh = Image.open(ROOT / f'public/assets/generated/party-pixel/{chip}.png').convert('RGBA')
    cell = sh.width // 3
    rep = check(sh, cell, air)
    fl = {n: f['bottom'] for n, f in rep['frames'].items()}
    print(f"{chip}: size {sh.size} = ({cell}*3)x({cell}*5) {'OK' if sh.size == (cell * 3, cell * 5) else 'BAD'} · colours {rep['colours']} · "
          f"floor(cell-4={cell - 4}) {sorted(set(fl.values()))} · errors {rep['errors'] or 'none'}")
    bad += bool(rep['errors'])
z = 4
BG = (0x28, 0x30, 0x48, 255)
items = []
act = Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))
items.append(('actor1-0 human (48)', act))
for chip, idx, _ in CHIPS:
    sh = Image.open(ROOT / f'public/assets/generated/party-pixel/{chip}.png').convert('RGBA')
    c = sh.width // 3
    items.append((f'{chip} idle ({c})', sh.crop((0, 0, c, c))))
W = sum(im.width * z + 12 for _, im in items) + 12
H = 64 * z + 40
board = Image.new('RGBA', (W, H), (14, 16, 26, 255))
d = ImageDraw.Draw(board)
x = 12
base = 20 + 64 * z   # 모든 칸의 바닥(cell−4)을 한 줄에
for name, im in items:
    c = im.width
    b = Image.new('RGBA', im.size, BG); b.alpha_composite(im)
    y = base - (c - 4) * z
    board.paste(b.resize((c * z, c * z), Image.NEAREST), (x, y))
    d.text((x + 2, 4), name, fill=(220, 220, 230))
    x += c * z + 12
d.line((0, base, W, base), fill=(200, 80, 80))
board.save(QA / 'size-compare.png')
print('board', board.size)
sys.exit(1 if bad else 0)
