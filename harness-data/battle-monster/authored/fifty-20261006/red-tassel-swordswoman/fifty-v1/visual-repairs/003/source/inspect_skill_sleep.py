"""Read-only art diagnostics; write panels and measured differences inside source."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib, json

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
names = ['skill_b', 'sleep_b']
sheet = Image.new('RGB', (816, 1120), '#37323f')
label = ImageDraw.Draw(sheet)
for j, (tag, color) in enumerate([('light', '#e7ded1'), ('dark', '#242332'), ('checker', None)]):
    for k, name in enumerate(names):
        for i, state in enumerate(['before', 'after']):
            path = ROOT / 'history' / (name + '-before.png') if state == 'before' else OUT / (name + '.png')
            frame = Image.open(path).convert('RGBA')
            bg = Image.new('RGBA', (64, 64), color or '#c9c5c4')
            if color is None:
                d = ImageDraw.Draw(bg)
                for y in range(0, 64, 8):
                    for x in range(0, 64, 8):
                        if (x // 8 + y // 8) % 2:
                            d.rectangle((x, y, x + 7, y + 7), fill='#99949b')
            bg.alpha_composite(frame)
            x = j * 272 + 8
            y = (k * 2 + i) * 280 + 24
            label.text((x, y - 17), f'{name} / {state} / {tag} / 1x + 3x', fill='white')
            sheet.paste(bg.convert('RGB'), (x, y))
            sheet.paste(bg.resize((192, 192), Image.Resampling.NEAREST).convert('RGB'), (x + 64, y + 64))
sheet.save(OUT / 'skill-sleep-repair-comparison.png')

for filename, motions in [('motions-basic', ['idle', 'attack', 'hit', 'dead']), ('motions-states', ['skill', 'poison', 'stun', 'sleep'])]:
    strips = [Image.open(OUT / (n + '-gif-frames.png')).convert('RGB') for n in motions]
    panel = Image.new('RGB', (max(s.width for s in strips), sum(s.height + 18 for s in strips)), '#dfd7c7')
    d = ImageDraw.Draw(panel)
    y = 0
    for name, strip in zip(motions, strips):
        d.text((4, y + 2), name, fill='#222222')
        panel.paste(strip, (0, y + 18))
        y += strip.height + 18
    panel.save(OUT / (filename + '.png'))

old = json.loads((ROOT / 'history' / 'before-skill-sleep-hashes.json').read_text())
report = {'changed_art_files': [], 'preserved_art_files': [], 'pixel_changes': {}}
for name, digest in old.items():
    same = hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == digest
    report['preserved_art_files' if same else 'changed_art_files'].append(name)
for name in names:
    a = (ROOT / 'history' / (name + '-before.pxgrid')).read_text().splitlines()
    b = (ROOT / 'actions' / (name + '.pxgrid')).read_text().splitlines()
    changed = [(x, y, a[y][x], b[y][x]) for y in range(64) for x in range(64) if a[y][x] != b[y][x]]
    report['pixel_changes'][name] = {'count': len(changed), 'bounds': [min(p[0] for p in changed), min(p[1] for p in changed), max(p[0] for p in changed), max(p[1] for p in changed)], 'coordinates': changed}
(OUT / 'skill-sleep-repair-info.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'pixel_changes'}, indent=2))
print({n: {k: v for k, v in data.items() if k != 'coordinates'} for n, data in report['pixel_changes'].items()})
