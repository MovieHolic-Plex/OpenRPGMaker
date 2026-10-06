"""Read literal artwork and actual GIF frames; produce diagnostic panels only."""
from pathlib import Path
from PIL import Image, ImageDraw
import hashlib
import json

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'preview'
sheet = Image.new('RGB', (816, 560), '#37323f')
label = ImageDraw.Draw(sheet)
for j, (tag, color) in enumerate([
        ('light', '#e7ded1'), ('dark', '#242332'), ('checker', None)]):
    for i, state in enumerate(['before', 'after']):
        path = ROOT / 'history' / 'skill_b-before-contact.png' if state == 'before' else OUT / 'skill_b.png'
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
        y = i * 280 + 24
        label.text((x, y - 17), f'skill_b / {state} / {tag} / 1x + 3x', fill='white')
        sheet.paste(bg.convert('RGB'), (x, y))
        sheet.paste(bg.resize((192, 192), Image.Resampling.NEAREST).convert('RGB'), (x + 64, y + 64))
sheet.save(OUT / 'skill-contact-comparison.png')

for filename, motions in [
        ('motions-basic', ['idle', 'attack', 'hit', 'dead']),
        ('motions-states', ['skill', 'poison', 'stun', 'sleep'])]:
    strips = [Image.open(OUT / (n + '-gif-frames.png')).convert('RGB') for n in motions]
    panel = Image.new('RGB', (max(s.width for s in strips), sum(s.height + 18 for s in strips)), '#dfd7c7')
    d = ImageDraw.Draw(panel)
    y = 0
    for name, strip in zip(motions, strips):
        d.text((4, y + 2), name, fill='#222222')
        panel.paste(strip, (0, y + 18))
        y += strip.height + 18
    panel.save(OUT / (filename + '.png'))

old = json.loads((ROOT / 'history' / 'before-contact-hashes.json').read_text())
report = {'changed_art_files': [], 'preserved_art_files': [], 'current_source_sha256': {}}
for name, digest in old.items():
    current = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
    report['current_source_sha256'][name] = current
    report['preserved_art_files' if current == digest else 'changed_art_files'].append(name)
a = (ROOT / 'history' / 'skill_b-before-contact.pxgrid').read_text().splitlines()
b = (ROOT / 'actions' / 'skill_b.pxgrid').read_text().splitlines()
changed = [(x, y, a[y][x], b[y][x]) for y in range(64) for x in range(64) if a[y][x] != b[y][x]]
report['pixel_changes'] = {'count': len(changed), 'bounds': [
    min(p[0] for p in changed), min(p[1] for p in changed),
    max(p[0] for p in changed), max(p[1] for p in changed)], 'coordinates': changed}
report['preview_sha256'] = {
    p.name: hashlib.sha256(p.read_bytes()).hexdigest()
    for p in sorted(OUT.iterdir()) if p.suffix in {'.png', '.gif'}}
(OUT / 'skill-contact-info.json').write_text(json.dumps(report, indent=2) + '\n')
print('Changed source:', report['changed_art_files'])
print('Preserved art:', len(report['preserved_art_files']), 'files')
print('Explicit pixel differences:', len(changed), 'bounds', report['pixel_changes']['bounds'])
