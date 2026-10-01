import sys
from PIL import Image
SPOTS = {'nw_south': (9,24,25,33), 'nw_corner': (8,14,18,23), 'tundra': (12,17,23,27), 'bad_south': (63,37,76,46),
         'canyon': (76,29,88,42), 'dirt': (25,44,39,58), 'mesa': (11,47,21,58)}
def crop(src, name, k=4):
    x0,y0,x1,y1 = SPOTS[name]
    return Image.open(src).convert('RGB').crop((x0*16,y0*16,x1*16,y1*16)).resize(((x1-x0)*16*k,(y1-y0)*16*k), Image.NEAREST)
if __name__ == '__main__':
    name, k = sys.argv[1], int(sys.argv[2]); which = sys.argv[3]
    src = {'b': '/tmp/w7/before-v7.png', 'a': 'design-1x-v7.png'}[which]
    im = crop(src, name, k); print(im.size); im.save(f'/tmp/w7/c_{which}_{name}.png')

def pair(name, k=3, out=None):
    a = crop('/tmp/w7/before-v7.png', name, k); b = crop('design-1x-v7.png', name, k)
    im = Image.new('RGB', (a.width*2+8, a.height), (255,255,255)); im.paste(a,(0,0)); im.paste(b,(a.width+8,0))
    im.save(out or f'/tmp/w7/p_{name}.png'); return im.size
