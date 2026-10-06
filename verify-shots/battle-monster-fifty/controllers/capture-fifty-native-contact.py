"""Read-only inspection of actual published native frames; never edits artwork."""
from pathlib import Path
import argparse
import hashlib
import json
from datetime import datetime, timezone
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('monsters', nargs='+')
parser.add_argument('--repo', type=Path, default=Path.cwd())
parser.add_argument('--source-root', type=Path)
parser.add_argument('--theme', choices=['light', 'dark'], default='light')
args = parser.parse_args()
repo = args.repo.resolve()
source_root = (args.source_root or repo / 'qa-runs/harnesses/battle-monster').resolve()
plan = json.loads((repo / 'harness-data/battle-monster/fifty-monsters-plan.json').read_text())
roster = {r['id']: r for r in plan['roster']}
names = ['idle_a', 'idle_b', 'idle_c', 'windup', 'move', 'attack',
         'recover', 'hit', 'dead', 'skill_a', 'skill_b', 'skill_c',
         'poison_a', 'poison_b', 'stun_a', 'stun_b', 'sleep_a', 'sleep_b']
out = repo / 'verify-shots/battle-monster-fifty'
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
for ident in args.monsters:
    row = roster[ident]
    cell = row['cell']
    candidate = source_root / ident / plan['candidate']
    check = json.loads((candidate / 'check-suite.json').read_text())
    palette = json.loads((candidate / 'source/palette.json').read_text())
    colors = {k: tuple(bytes.fromhex(v[1:])) + (255,) for k, v in palette.items()}
    colors['.'] = (0, 0, 0, 0)
    tw, th = 2 * cell + 16, 3 * cell + 40
    background = '#e5e2d7' if args.theme == 'light' else '#20222c'
    foreground = '#263a34' if args.theme == 'light' else '#f4e6ce'
    board = Image.new('RGB', (6 * tw, 3 * th), background)
    draw = ImageDraw.Draw(board)
    proof = []
    for i, name in enumerate(names):
        png = candidate / 'preview/suite' / (name + '.png')
        image = Image.open(png).convert('RGBA')
        assert image.size == (cell, cell), (ident, name, image.size)
        folder = 'poses' if i < 9 else 'actions'
        grid = candidate / 'source' / folder / (name + '.pxgrid')
        rows = grid.read_text().splitlines()
        assert len(rows) == cell and all(len(r) == cell for r in rows)
        expected = bytes(c for r in rows for symbol in r for c in colors[symbol])
        assert image.tobytes() == expected, (ident, name, 'native PNG/source mismatch')
        x, y = (i % 6) * tw, (i // 6) * th
        draw.text((x + 8, y + 4), name + ' / 1x + 2x', font=font, fill=foreground)
        board.paste(image, (x + 8, y + 24), image)
        doubled = image.resize((2 * cell, 2 * cell), Image.Resampling.NEAREST)
        board.paste(doubled, (x + 8, y + cell + 32), doubled)
        proof.append({'pose': name, 'nativePngSha256': hashlib.sha256(png.read_bytes()).hexdigest(),
                      'sourceSha256': hashlib.sha256(grid.read_bytes()).hexdigest(),
                      'rgbaMatchesNativeSource': True})
    assert max(board.size) <= 2048, board.size
    theme_suffix = '' if args.theme == 'light' else '-dark'
    target = out / ('native-contact-' + ident + theme_suffix + '.png')
    board.save(target)
    receipt = {'at': datetime.now(timezone.utc).isoformat(), 'key': ident + '/' + plan['candidate'],
               'binding': check['binding'], 'nativeCell': cell, 'nativePoses': len(proof),
               'displayScales': [1, 2], 'boardSize': list(board.size), 'background': background,
               'noSourceWrites': True, 'approvalClaim': False, 'sourceRoot': str(source_root),
               'pngSha256': hashlib.sha256(target.read_bytes()).hexdigest(), 'frames': proof}
    target.with_suffix('.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(target.relative_to(repo))
