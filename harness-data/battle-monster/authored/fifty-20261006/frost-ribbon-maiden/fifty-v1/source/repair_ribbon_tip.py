"""Apply only the explicitly selected move-frame silk-tip pixels."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Native coordinates, y x literal palette symbols. No frame transformations.
PATCH = '''
85 66 ogo
86 67 oo.
87 68 ...
88 67 ...
89 68 ..
'''


def apply_patches(frames):
    rows = frames['move']
    for entry in PATCH.strip().splitlines():
        y, x, pixels = entry.split()
        y, x = int(y), int(x)
        rows[y] = rows[y][:x] + pixels + rows[y][x + len(pixels):]


def save_repair():
    path = ROOT / 'poses' / 'move.pxgrid'
    original = path.read_text()
    checkpoint = ROOT / 'checkpoints' / 'ribbon-tip-before'
    checkpoint.mkdir(exist_ok=True)
    saved = checkpoint / path.name
    if not saved.exists():
        saved.write_text(original)
    frames = {'move': original.splitlines()}
    apply_patches(frames)
    path.write_text('\n'.join(frames['move']) + '\n')


if __name__ == '__main__':
    save_repair()
