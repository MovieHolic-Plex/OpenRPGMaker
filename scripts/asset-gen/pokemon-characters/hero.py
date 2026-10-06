"""Lossless adoption of Emerald Brendan, explicitly requested by user.
Original game artwork, NOT independently authored Python pixel art.
"""
from pathlib import Path
from hashlib import sha256
from PIL import Image
REFERENCE=Path(__file__).resolve().parent/'references/brendan-walking.png'
REFERENCE_SHA='f33ec07a5fd17f4422455f8bc55cd3d3522fa65c3bf740ecbdc00da705eaa0d1'
assert sha256(REFERENCE.read_bytes()).hexdigest()==REFERENCE_SHA, 'Reference source changed'
source=Image.open(REFERENCE)
assert source.mode=='P' and source.size==(144,32) and source.getpixel((0,0))==0
source.info['transparency']=0
rgba=source.convert('RGBA')
rgba.putdata([p if p[3] else (0,0,0,0) for p in rgba.get_flattened_data()])
PALETTE={str(i):''.join(f'{v:02x}' for v in source.getpalette()[i*3:i*3+3]) for i in range(1,16)}
MAPPING={'up':[5,1,6], 'right':[7,2,8], 'down':[3,0,4], 'left':[7,2,8]}
def render(direction,phase):
 assert direction in MAPPING and phase in [0,1,2]
 index=MAPPING[direction][phase]
 frame=rgba.crop((index*16,0,(index+1)*16,32))
 return frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if direction=='right' else frame
