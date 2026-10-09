"""Gallery of the undead-magic batch: every sheet at 2x on #202840, labelled,
with the actor1-0 idle cell at the start of each row for scale."""
import sys
sys.dont_write_bytecode = True
from PIL import Image, ImageDraw
from pe_lib import ROOT, BG
SLUGS = ['skeleton-knight', 'ghost-pale', 'lich-frost', 'mummy-bandage', 'spirit-fire',
         'spirit-water', 'golem-iron', 'armor-living', 'mimic-chest', 'eye-floating']
S = 2
sheets = [(s, Image.open(ROOT / f'public/assets/generated/pixel-enemies/{s}.png').convert('RGBA')) for s in SLUGS]
actor = Image.open(ROOT / 'public/assets/generated/charset-battlers/actor1-0.png').convert('RGBA').crop((0, 0, 48, 48))
cols = 2
cw = max(im.width for _, im in sheets) + 48 + 24
rows = (len(sheets) + cols - 1) // cols
rh = [max(im.height for _, im in sheets[r * cols:(r + 1) * cols]) + 16 for r in range(rows)]
board = Image.new('RGBA', (cw * cols, sum(rh)), BG)
d = ImageDraw.Draw(board)
y = 0
for r in range(rows):
    for c, (s, im) in enumerate(sheets[r * cols:(r + 1) * cols]):
        x = c * cw
        cell = im.width // 3
        # actor stands on the same floor line as the idle_a cell
        board.alpha_composite(actor, (x + 4, y + 12 + cell - 48))
        board.alpha_composite(im, (x + 56, y + 12))
        d.text((x + 56, y + 1), f'{s} ({cell})', fill='#d6cddc')
    y += rh[r]
board = board.convert('RGB').resize((board.width * S, board.height * S), Image.Resampling.NEAREST)
out = ROOT / '.omo/pixel-enemy-undead-magic-gallery.png'
board.save(out)
print(out, board.size)

