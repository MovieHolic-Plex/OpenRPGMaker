"""Read exported images and report format/timing; create diagnostic GIF strips.
No source pixel mutation and no inferred art.
"""
from pathlib import Path
import json, hashlib
from PIL import Image, ImageDraw
from render import ROOT, ORDER, MOTIONS, read_frames, PAL

frames = read_frames()
records = {}
for name, im in frames.items():
    p = ROOT / ('poses' if name in ORDER[:9] else 'actions') / f'{name}.pxgrid'
    rows = p.read_text().splitlines()
    ink = [(x,y) for y,row in enumerate(rows) for x,s in enumerate(row) if s != '.']
    border = all(rows[y][x] == '.' for y in range(64) for x in range(64) if x in (0,63) or y in (0,63))
    records[name] = {
        'sha256_pxgrid': hashlib.sha256(p.read_bytes()).hexdigest(),
        'rows': len(rows), 'widths': sorted(set(map(len, rows))),
        'symbols': sorted(set(''.join(rows)) - {'.'}),
        'transparent_border': border,
        'lowest_ink_y': max(y for x,y in ink),
        'bbox': im.getbbox(),
    }
    if len(rows) != 64 or any(len(r) != 64 for r in rows) or not border or max(y for x,y in ink) > 60:
        raise ValueError(name)
    png = Image.open(ROOT/'preview'/'png'/f'{name}.png').convert('RGBA')
    if png.tobytes() != im.tobytes():
        raise ValueError(('PNG differs', name))
if len(frames) != 18 or len(PAL) > 18 or records['idle_a']['lowest_ink_y'] != 60:
    raise ValueError('incomplete contract')
if len({r['sha256_pxgrid'] for r in records.values()}) != 18:
    raise ValueError('identical source frames')

motion_records = {}
(ROOT/'preview'/'gif-strips').mkdir(exist_ok=True)
for motion, seq in MOTIONS.items():
    p = ROOT/'preview'/f'{motion}.gif'
    gif = Image.open(p)
    durations=[]
    strip=Image.new('RGB',(len(seq)*208,236),(34,39,48))
    draw=ImageDraw.Draw(strip)
    for i,(n,ms) in enumerate(seq):
        gif.seek(i)
        actual=gif.convert('RGBA')
        # RGB of transparent pixels is immaterial. Compare exact visible RGB and alpha.
        target=frames[n]
        mismatch=sum(a!=b for a,b in zip(actual.get_flattened_data(),target.get_flattened_data()) if a[3] or b[3])
        alpha_mismatch=sum(a[3]!=b[3] for a,b in zip(actual.get_flattened_data(),target.get_flattened_data()))
        duration=gif.info['duration']
        durations.append(duration)
        if mismatch or alpha_mismatch or duration!=ms:
            raise ValueError((motion,i,n,mismatch,alpha_mismatch,duration))
        draw.text((i*208+6,4),f'{n}  {ms} ms', fill=(235,230,215))
        zoom=actual.resize((192,192),Image.Resampling.NEAREST)
        strip.paste(zoom,(i*208+6,26),zoom)
    if gif.n_frames != len(seq):
        raise ValueError((motion,'frame count'))
    strip.save(ROOT/'preview'/'gif-strips'/f'{motion}.png')
    motion_records[motion]={'sha256_gif': hashlib.sha256(p.read_bytes()).hexdigest(),
                            'decoded_frames': gif.n_frames, 'holds_ms': durations,
                            'visible_rgba_matches_source': True}
report={'purpose':'Native format and export diagnostics; not aesthetic approval or independent review',
        'palette_colors':len(PAL),'frame_count':len(frames),'frames':records,'motions':motion_records}
(ROOT/'preview'/'export-diagnostics.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'native_frames':len(frames),'palette_colors':len(PAL),'unique_frames':len({r['sha256_pxgrid'] for r in records.values()}),
                  'gif_decoding': motion_records},indent=2))
