"""Native screenshot sequence; equal playback durations, not a speed recording."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[2] / 'verify-shots/right-region-drag'
for label in ('before', 'after'):
    paths = [root / f'{label}-00.png'] + [root / f'{label}-{i:02}.png' for i in range(5, 41, 5)] + [root / f'{label}-final.png']
    frames = [Image.open(path).convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT) for path in paths]
    target = root / f'{label}.gif'
    frames[0].save(target, save_all=True, append_images=frames[1:], duration=[650] + [180] * 8 + [1400], loop=0, disposal=2, optimize=True)
    with Image.open(target) as gif:
        assert gif.n_frames == len(paths)
        assert gif.size == (1440, 900)
    print(f'{label}: {target.stat().st_size:,} bytes')
