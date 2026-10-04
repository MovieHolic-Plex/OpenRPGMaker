# 정답지 항목 → RGBA 배열. REFMAP 은 로컬 팩에서 읽기만 한다(저장소에 쓰지 않는다).
import os, json
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
GOLDEN = os.path.join(ROOT, 'tiledata/pixel-harness/golden.json')
PACK = os.path.expanduser('~/.local/share/oprn/refmap-downloads/_packs/refmap-interior/')
# 항목의 pack 으로 팩을 고른다(없으면 실내). 바깥 재료(roof·facade·ground)는 마을 바깥 팩(2026-09-29 추가).
PACKS = {'interior': PACK, 'town-outside': os.path.expanduser('~/.local/share/oprn/refmap-downloads/_packs/refmap-town-outside/')}
SCRATCH = os.path.expanduser('~/.local/share/oprn/pixel-harness')   # 저장소 밖 작업 폴더(REFMAP 크롭 가능)

def golden():
    return json.load(open(GOLDEN))

def load_image(entry):
    """entry: golden.json 의 refmap 항목(file) 또는 ours 항목(src). rect 가 있으면 자른다. PIL RGBA 반환."""
    if 'file' in entry:
        im = Image.open(PACKS[entry.get('pack', 'interior')] + entry['file']).convert('RGBA')
    else:
        im = Image.open(os.path.join(ROOT, entry['src'])).convert('RGBA')
    if entry.get('rect'):
        im = im.crop(tuple(entry['rect']))
    return im

def rescale(im, src_tile, dst_tile):
    """칸 크기 환산. 줄일 때는 LANCZOS(알파 곱셈 보정은 Pillow 가 RGBA 에서 한다), 같으면 그대로."""
    if src_tile == dst_tile:
        return im
    k = dst_tile / src_tile
    w, h = max(1, round(im.width * k)), max(1, round(im.height * k))
    return im.resize((w, h), Image.LANCZOS if k < 1 else Image.NEAREST)

def arr(im):
    return np.array(im.convert('RGBA')).astype(np.float64)

def up(im, k=4, bg=(58, 54, 60, 255)):
    b = Image.new('RGBA', im.size, bg); b.alpha_composite(im.convert('RGBA'))
    return b.resize((im.width * k, im.height * k), Image.NEAREST)
