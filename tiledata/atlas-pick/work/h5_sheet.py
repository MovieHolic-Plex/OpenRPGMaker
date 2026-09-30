import sys, os
from PIL import Image
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'candidates-horror')
def sheet(slugs, out, scale=6):
    ims = []
    for sl in slugs:
        for x in 'ABCD':
            p = f'{R}/{sl}/h5-{x}.png'
            if os.path.exists(p): ims.append(Image.open(p).convert('RGBA'))
    W = sum(i.width * scale + 16 for i in ims); H = max(i.height * scale for i in ims) + 16
    s = Image.new('RGBA', (W, H), (90, 90, 96, 255)); x = 8
    for i in ims:
        b = i.resize((i.width * scale, i.height * scale), Image.NEAREST)
        s.alpha_composite(b, (x, 8)); x += b.width + 16
    s.save(out)
if __name__ == '__main__':
    sheet(sys.argv[2:], sys.argv[1], 6)
