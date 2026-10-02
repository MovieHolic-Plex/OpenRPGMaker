"""Render diagnostic contact sheets; this never modifies gameplay artwork."""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--after', type=int)
parser.add_argument('--limit', type=int, default=32)
parser.add_argument('--out', default='output/item-catalog/review-current')
args = parser.parse_args()
manifest = json.loads(Path('assets/item-catalog/generation-manifest.json').read_text())['entries']
review = json.loads(Path('assets/item-catalog/visual-review.json').read_text())['entries']
requests = {r['id']: r for r in json.loads(Path('assets/item-catalog/art-requests.json').read_text())}
entries = list(manifest.items())
if args.after is not None:
    entries = entries[args.after:]
else:
    entries = [(rid, e) for rid, e in entries if review.get(rid, {}).get('sha256') != e['sha256']]
entries = entries[:args.limit]
if not entries:
    print(json.dumps({'entries': 0, 'message': 'No artwork pending visual review'}))
    raise SystemExit()
font_candidates = [Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'), Path('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc')]
font_path = next((p for p in font_candidates if p.exists()), None)
font = ImageFont.truetype(str(font_path), 12) if font_path else ImageFont.load_default()
cols, cell_width, cell_height = 8, 150, 165
sheet = Image.new('RGB', (cols * cell_width, ((len(entries) + cols - 1) // cols) * cell_height), '#181a22')
draw = ImageDraw.Draw(sheet)
for n, (rid, entry) in enumerate(entries):
    x, y = n % cols * cell_width, n // cols * cell_height
    sprite = Image.open(entry['path']).convert('RGBA')
    sheet.paste(sprite, (x + (cell_width - 32) // 2, y + 4), sprite)
    enlarged = sprite.resize((96, 96), Image.Resampling.NEAREST)
    sheet.paste(enlarged, (x + (cell_width - 96) // 2, y + 40), enlarged)
    label = requests[rid]['name'].split(' (')[0]
    if draw.textbbox((0, 0), label, font=font)[2] > cell_width - 8:
        midpoint = len(label) // 2
        split = min((i for i, c in enumerate(label) if c == ' '), key=lambda i: abs(i - midpoint), default=midpoint)
        lines = [label[:split], label[split:].strip()]
    else:
        lines = [label]
    for i, line in enumerate(lines):
        width = draw.textbbox((0, 0), line, font=font)[2]
        draw.text((x + (cell_width - width) // 2, y + 138 + i * 14), line, font=font, fill='#f3f3f5')
out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
sheet.save(str(out) + '.png')
Path(str(out) + '-entries.json').write_text(json.dumps(dict(entries), ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'entries': len(entries), 'image': str(out) + '.png', 'reviewSnapshot': str(out) + '-entries.json'}))
