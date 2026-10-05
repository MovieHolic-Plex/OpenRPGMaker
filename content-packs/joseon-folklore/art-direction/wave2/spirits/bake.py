"""Saved ASCII grids -> native RGBA by direct pixel assignment.

Only review views use integer 3x nearest enlargement. No source art resizing.
Run `python bake.py`; run `python source/author.py` to expand authored rows.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json

ROOT = Path(__file__).resolve().parent
NAMES = ['jangseung-spirit', 'earthen-jar-fiend']
POSES = ['idle_a','idle_b','idle_c','windup','move','attack','recover','hit','dead']
for directory in ['sprites', 'portraits', 'review']:
    (ROOT / directory).mkdir(exist_ok=True)
try:
    FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
except OSError:
    FONT = ImageFont.load_default()

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read(slug, pose):
    path = ROOT / 'source' / slug / f'{pose}.pxgrid'
    rows = path.read_text().splitlines()
    assert len(rows) == 64 and all(len(row) == 64 for row in rows), path
    palette = json.loads((ROOT / 'source' / f'{slug}.palette.json').read_text())
    colors = {s: tuple(bytes.fromhex(c[1:])) + (255,) for s, c in palette.items()}
    colors['.'] = (0, 0, 0, 0)
    im = Image.new('RGBA', (64, 64))
    pix = im.load()
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            pix[x, y] = colors[symbol]
    box = im.getbbox()
    assert box and box[0] >= 1 and box[1] >= 1 and box[2] <= 63 and box[3] <= 61, (path, box)
    assert len([c for count, c in im.getcolors(4096) if c[3]]) <= 18
    assert {value for count, value in im.getchannel('A').getcolors(4096)} == {0, 255}
    return im

def label(canvas, x, y, message):
    ImageDraw.Draw(canvas).text((x, y), message, font=FONT, fill='#eee4cc')

def tile(canvas, im, x, y, scale=1, background=None):
    # Review only: source/output sprites are never resized.
    view = im if scale == 1 else im.resize((im.width*scale, im.height*scale), Image.Resampling.NEAREST)
    patch = Image.new('RGBA', view.size)
    pix = patch.load()
    for yy in range(view.height):
        for xx in range(view.width):
            pix[xx, yy] = background or ((91, 96, 85, 255) if (xx//8 + yy//8) % 2 else (101, 105, 94, 255))
    patch.alpha_composite(view)
    canvas.alpha_composite(patch, (x, y))

actor_path = ROOT.parents[1] / 'monsters' / 'refinement' / 'reference' / 'Actor1-original-24x32.png'
actor = Image.open(actor_path).convert('RGBA')
idle = Image.new('RGBA', (840, 560), (31,35,41,255))
label(idle, 16, 12, 'Original Joseon fantasy enemies / native 1x and nearest 3x / idle checkpoint')
for x, message in [(20,'Name'),(220,'1x'),(310,'3x'),(530,'Forest green 3x'),(745,'Actor1')]:
    label(idle, x, 45, message)

metadata = {}
complete = True
for i, slug in enumerate(NAMES):
    frame = read(slug, 'idle_a')
    frame.save(ROOT / 'portraits' / f'{slug}.png')
    yy = 75 + i*230
    label(idle, 20, yy+85, slug)
    tile(idle, frame, 220, yy+64)
    tile(idle, frame, 310, yy, 3)
    tile(idle, frame, 530, yy, 3, (66,82,58,255))
    tile(idle, actor, 745, yy+100)
    tile(idle, actor, 745, yy, 3)
    frames = {}
    sheet = Image.new('RGBA', (192,192))
    contact = Image.new('RGBA', (920,830), (31,35,41,255))
    label(contact, 20, 12, f'{slug} / native64 / facing RIGHT / 1x and nearest 3x')
    for j, pose in enumerate(POSES):
        path = ROOT / 'source' / slug / f'{pose}.pxgrid'
        if not path.exists():
            complete = False
            continue
        frame = read(slug, pose)
        sheet.alpha_composite(frame, ((j%3)*64, (j//3)*64))
        colors = {c for count, c in frame.getcolors(4096) if c[3]}
        frames[pose] = {
            'source': str(path.relative_to(ROOT)), 'source_sha256': sha(path),
            'bbox': list(frame.getbbox()), 'bottom_y': frame.getbbox()[3]-1,
            'opaque_colors': len(colors), 'alpha_values': [0,255],
            'pixel_sha256': hashlib.sha256(frame.tobytes()).hexdigest(),
        }
        xx, yy = 20 + (j%3)*300, 65 + (j//3)*235
        label(contact, xx, yy-22, pose)
        tile(contact, frame, xx, yy+64)
        tile(contact, frame, xx+84, yy, 3)
    metadata[slug] = {'frames':frames, 'motion':'stomp' if i==0 else 'hop'}
    if len(frames) == 9:
        assert len({v['pixel_sha256'] for v in frames.values()}) == 9
        assert [frames[p]['bottom_y'] for p in POSES[:3]] == [60,60,60]
        out = ROOT / 'sprites' / f'{slug}.png'
        sheet.save(out)
        label(contact, 20, 788, 'Pose candidates. No battle playback / contact / final approval claim.')
        tile(contact, actor, 780, 772)
        tile(contact, actor, 835, 728, 3)
        contact.convert('RGB').save(ROOT / 'review' / f'{slug}-poses.png')
        metadata[slug].update(sheet=str(out.relative_to(ROOT)), sheet_sha256=sha(out),
            size=[192,192], mode=sheet.mode,
            opaque_colors=len({c for count, c in sheet.getcolors(36864) if c[3]}),
            unique_frames=9, idle_baselines=[60,60,60])
idle.convert('RGB').save(ROOT / 'review' / 'idle-lineup.png')
result = {'status':'original-candidates-awaiting-director-review',
          'phase':'nine-poses-baked' if complete else 'idle-ready',
          'frame_order':POSES,'cell':[64,64], 'sprites':metadata}
(ROOT / 'result.json').write_text(json.dumps(result,indent=2)+'\n')
# Completion requires actual image inspection, recorded separately by the author.
progress_path = ROOT / 'progress.json'
previous = json.loads(progress_path.read_text()) if progress_path.exists() else {}
progress = {'phase':result['phase'], 'files':[str(ROOT/'review'/'idle-lineup.png')],
            'complete':False, 'result':str(ROOT/'result.json')}
if complete:
    progress['files'] += [str(ROOT/'review'/f'{s}-poses.png') for s in NAMES]
    if previous.get('phase') == 'complete' and previous.get('reviewed_sheet_hashes') == {s:metadata[s]['sheet_sha256'] for s in NAMES}:
        progress = previous
(ROOT / 'progress.json').write_text(json.dumps(progress,indent=2)+'\n')
print(result['phase'])
