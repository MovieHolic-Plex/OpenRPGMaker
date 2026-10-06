"""Reproduce the rejected review batch without publishing it to common assets."""
import json
from pathlib import Path
from PIL import Image
from shared_hand_cels import EFFECTS, PALETTES
from hand_pixels import export_grid, load

ROOT = Path(__file__).resolve().parents[3]
SOURCE = Path(__file__).resolve().parent / 'hand-authored'
OUT = ROOT / 'docs/experiments/shared-hand-fx-20261005/rejected-release/public/assets/generated/pixel-fx'

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    load.cache_clear()
    for key, (palette, anchor, cels) in EFFECTS.items():
        assert len(cels) == 8, key
        phases = ['발동', '접근', '접촉', '전개', '분해', '잔상', '소멸', '끝']
        source = dict(version=1, key=key, width=64, height=64, anchor=anchor,
                      frameMs=60, palette=PALETTES[palette], frames=[
            dict(phase=phases[i], pieces=[dict(x=x, y=y, rows=rows.splitlines())
                 for x, y, rows in pieces]) for i, pieces in enumerate(cels)])
        (SOURCE / f'{key}.hand.json').write_text(json.dumps(source,ensure_ascii=False,indent=2)+'\n')
        export_grid(key)
        doc=load(key)
        sheet=Image.new('RGBA',(512,64))
        for i,frame in enumerate(doc['frames']):
            for y,row in enumerate(frame['rows']):
                for x,s in enumerate(row):
                    if s!='.': sheet.putpixel((i*64+x,y),tuple(bytes.fromhex(doc['palette'][s][1:]))+(255,))
        sheet.save(OUT/f'{key}.png')
        print(key)

if __name__=='__main__': build()
