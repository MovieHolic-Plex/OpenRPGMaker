"""Convert captured production editor frames to GIF; no mock UI or overlays."""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[2] / 'verify-shots/assistant-human-work'
sequences = {
    'scroll': [('01-bottom', 1200), ('02-reading', 1600), ('03-new-response', 2400), ('04-latest', 1600), ('05-following', 1600)],
    'selection': [('01-human-selection', 2000), ('02-settled', 2800)],
    'decision': [('01-waiting', 1600), ('02-human-edit', 2000), ('03-other-task', 2400), ('04-approved', 2200)],
    'protected': [('01-ai-floor', 1500), ('02-human-tile', 2200), ('03-rebase', 2200), ('04-later-checkpoint', 2600), ('05-finished', 2000)],
}
for name, sequence in sequences.items():
    frames = [Image.open(root / f'{name}-{step}.png').convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT) for step, _ in sequence]
    target = root / f'{name}.gif'
    frames[0].save(target, save_all=True, append_images=frames[1:], duration=[duration for _, duration in sequence], loop=0, disposal=2, optimize=True)
    with Image.open(target) as gif:
        assert gif.n_frames == len(sequence), (name, gif.n_frames)
        assert gif.size == (1440, 900), gif.size
    print(f'{name}: {len(sequence)} frames, {target.stat().st_size:,} bytes')
