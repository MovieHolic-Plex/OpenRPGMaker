from __future__ import annotations

import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('.tmp/me/Modern_Exteriors_RPG_Maker_MV')
OUT = Path('output/evidence/modern-exteriors-rpg/research')
OUT.mkdir(parents=True, exist_ok=True)

files = sorted((p for p in ROOT.rglob('*') if p.is_file()), key=lambda p: p.as_posix())
entries: list[dict[str, object]] = []
for path in files:
    entry: dict[str, object] = {
        'path': path.relative_to(ROOT).as_posix(),
        'bytes': path.stat().st_size,
        'suffix': path.suffix.lower(),
    }
    if path.suffix.lower() == '.png':
        with Image.open(path) as image:
            entry['width'], entry['height'] = image.size
            entry['mode'] = image.mode
    entries.append(entry)

(OUT / 'catalog.json').write_text(json.dumps({
    'archive': 'Modern_Exteriors_RPG_Maker_MV_v42.3.zip',
    'root': ROOT.as_posix(),
    'entryCount': len(entries),
    'pngCount': sum(1 for entry in entries if entry['suffix'] == '.png'),
    'entries': entries,
}, indent=2), encoding='utf-8')

sheet_paths = [
    path for path in files
    if path.parent == ROOT and path.name.startswith('Tileset_') and path.suffix.lower() == '.png'
]
thumb = 192
label_h = 26
cols = 8
font = ImageFont.load_default()
for page_index in range((len(sheet_paths) + 31) // 32):
    batch = sheet_paths[page_index * 32:(page_index + 1) * 32]
    rows = (len(batch) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * thumb, rows * (thumb + label_h)), '#111318')
    draw = ImageDraw.Draw(canvas)
    for index, path in enumerate(batch):
        x = (index % cols) * thumb
        y = (index // cols) * (thumb + label_h)
        with Image.open(path) as image:
            rgba = image.convert('RGBA')
            background = Image.new('RGBA', rgba.size, '#20242b')
            background.alpha_composite(rgba)
            background.thumbnail((thumb, thumb), Image.Resampling.NEAREST)
            canvas.paste(background.convert('RGB'), (x, y))
        draw.rectangle((x, y + thumb, x + thumb, y + thumb + label_h), fill='#090a0d')
        draw.text((x + 5, y + thumb + 7), path.stem, fill='#e8ecf2', font=font)
    canvas.save(OUT / f'tileset-contact-{page_index + 1:02d}.png')

print(json.dumps({
    'entryCount': len(entries),
    'pngCount': sum(1 for entry in entries if entry['suffix'] == '.png'),
    'tilesetSheets': len(sheet_paths),
    'contactSheets': (len(sheet_paths) + 31) // 32,
    'output': OUT.as_posix(),
}))
