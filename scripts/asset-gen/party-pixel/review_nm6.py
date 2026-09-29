"""m6 확인판 (c): actor1-0 대기 칸과 monster6-0~7 대기 칸을 같은 배율·같은 바닥선으로 한 줄에. 산출 .omo/nm6/lineup-actor1-0.png."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[3]
G = ROOT / 'public/assets/generated'
cells = [Image.open(G / 'charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))]
for i in range(8):
    sh = Image.open(G / f'party-pixel/monster6-{i}.png').convert('RGBA')
    c = sh.width // 3
    cells.append(sh.crop((0, 0, c, c)))
W = sum(c.width for c in cells) + 4 * len(cells)
im = Image.new('RGBA', (W, 64), (32, 40, 64, 255))
x = 0
for c in cells:
    im.alpha_composite(c, (x, 60 - (c.height - 4)))       # 모든 칸 바닥 = 셀 -4 → 틀의 60행
    x += c.width + 4
z = 3                                                      # 1900px 이하
im.resize((W * z, 64 * z), Image.NEAREST).save(ROOT / '.omo/nm6/lineup-actor1-0.png')
print(W * z)
