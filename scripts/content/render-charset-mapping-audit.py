#!/usr/bin/env python3
"""Render original pixels next to their current labels, never generate art."""
import argparse
import hashlib
import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser()
parser.add_argument('--out', default='output/charset-mapping-audit')
args = parser.parse_args()
root = Path(args.out).resolve()
manifest = json.loads((root / 'inventory.json').read_text())
sources = {s['id']: s for s in manifest['sources']}
images = {}
font = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumBarunGothic.ttf', 15)
bold = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumBarunGothicBold.ttf', 17)
small = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12)
for source in sources.values():
    assert hashlib.sha256(Path(source['path']).read_bytes()).hexdigest() == source['sha256'], ('changed source', source['id'])
    original = Image.open(source['path']).convert('RGBA')
    assert original.size == (288, 256), (source['id'], original.size)
    # Same colour-key convention as the original RTP. Alpha sheets keep alpha.
    if original.getextrema()[3][0] == 255:
        key = original.getpixel((0, 0))[:3]
        original.putdata([(*p[:3], 0 if p[:3] == key else p[3]) for p in original.getdata()])
    images[source['id']] = original

cells = []
empty = []
coordinates = []
for row in manifest['rows']:
    slot = row['characterIndex']
    # Independent RM2K3 sheet arithmetic, not the production crop helper.
    x, y = slot % 4 * 72, slot // 4 * 128
    expected = {'x': x + 24, 'y': y + 64, 'width': 24, 'height': 32}
    coordinates.append({'key': f"{row['sourceId']}#{slot}", 'ok': row['crop'] == expected and row['frame'] == 25 + slot % 4 * 3 + slot // 4 * 48})
    source = images[row['sourceId']]
    block = source.crop((x, y, x + 72, y + 128))
    # An occupied cell can have an empty still frame; keep it for visual review.
    occupied = block.getchannel('A').getbbox() is not None
    down = source.crop((x + 24, y + 64, x + 48, y + 96))
    row.update(occupied=occupied, stillNonempty=down.getchannel('A').getbbox() is not None,
               rgbaSha256=hashlib.sha256(down.tobytes()).hexdigest(), origin=sources[row['sourceId']]['origin'])
    if occupied or row['semantic']:
        cells.append(row)
    else:
        empty.append(row)

pages = []
for start in range(0, len(cells), 16):
    selected = cells[start:start+16]
    canvas = Image.new('RGB', (1440, 1088), '#202732')
    draw = ImageDraw.Draw(canvas)
    draw.text((16, 8), f'Original charset mapping audit | page {start//16+1} | cells {start+1}-{start+len(selected)}', font=bold, fill='white')
    for n, row in enumerate(selected):
        ox, oy = n % 4 * 360, 36 + n // 4 * 263
        draw.rectangle((ox+3, oy+3, ox+357, oy+259), outline='#667085')
        key = f"{row['sourceId'].replace('tex_easyrpg_charset_', 'rtp:').replace('tex_scarloxy_charset_', 'scarloxy:').replace('shared_charset_actor_', 'shared:')}#{row['characterIndex']}"
        draw.text((ox+10, oy+8), key, font=small, fill='#a4e1f2')
        semantic = row['semantic'] or {'label': '(이름 없음)', 'tags': [], 'appearance': ''}
        draw.text((ox+10, oy+28), semantic['label'], font=bold, fill='#ffd685')
        slot = row['characterIndex']; x, y = slot % 4 * 72, slot // 4 * 128
        source = images[row['sourceId']]
        down = source.crop((x+24,y+64,x+48,y+96)).resize((72,96),Image.Resampling.NEAREST)
        canvas.paste(down, (ox+12,oy+57), down)
        for direction in range(4):
            mini = source.crop((x+24,y+direction*32,x+48,y+direction*32+32)).resize((48,64),Image.Resampling.NEAREST)
            canvas.paste(mini, (ox+96+(direction%2)*58,oy+57+(direction//2)*64),mini)
        metadata = f"frame {row['frame']} / {semantic.get('gender','?')} / {semantic.get('age','?')}"
        draw.text((ox+10,oy+193),metadata,font=small,fill='#ffffff')
        tags = '태그: ' + ', '.join(semantic.get('tags', []))
        for line_no, line in enumerate(textwrap.wrap(tags,width=32)[:3]):
            draw.text((ox+10,oy+210+line_no*15),line,font=font,fill='#e7e8ed')
        # Physical descriptions are also written in the full text manifest.
    file = f'contact-{start//16+1:02}.png'
    canvas.save(root/file)
    pages.append({'file':file,'keys':[f"{r['sourceId']}#{r['characterIndex']}" for r in selected],
                  'sha256':hashlib.sha256((root/file).read_bytes()).hexdigest()})
report = {'physicalSlots':len(manifest['rows']),'occupiedSlots':sum(r['occupied'] for r in manifest['rows']),
          'labeledSlots':sum(bool(r['semantic']) for r in manifest['rows']),
          'occupiedUnlabeled':[f"{r['sourceId']}#{r['characterIndex']}" for r in cells if r['occupied'] and not r['semantic']],
          'labeledEmpty':[f"{r['sourceId']}#{r['characterIndex']}" for r in cells if not r['occupied'] and r['semantic']],
          'coordinateFailures':[r for r in coordinates if not r['ok']], 'pages':pages,'cells':cells,
          'emptySlots':[f"{r['sourceId']}#{r['characterIndex']}" for r in empty]}
(root/'physical-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['cells','pages','emptySlots']},ensure_ascii=False))
print('Visual contact sheets:',len(pages))
