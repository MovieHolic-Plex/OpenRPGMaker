"""Hand-pixeled battle trainer sprites for Astra Horizon.
Every pixel is authored as row strings in naru.py / yurim.py / muyeong.py / hero.py.
This script bakes 64x64 natives -> nearest x2 128x128 PNGs and the preview sheets.
Run: python3 draw_trainers.py"""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from pix import Canvas
import naru, yurim, muyeong, hero

def native(mod, *a):
    c = mod.draw(Canvas, *a); return c.image(mod.PAL), c

def x2(im): return im.resize((im.width * 2, im.height * 2), Image.NEAREST)

OUT = {}
def bake():
    for name, mod in (('naru', naru), ('yurim', yurim), ('muyeong', muyeong)):
        im, _ = native(mod); OUT[name] = x2(im)
        os.makedirs(f'{HERE}/{name}', exist_ok=True); OUT[name].save(f'{HERE}/{name}/front.png')
    os.makedirs(f'{HERE}/hero', exist_ok=True)
    im, _ = native(hero, 'back'); OUT['hero_back'] = x2(im); OUT['hero_back'].save(f'{HERE}/hero/back.png')
    sheet = Image.new('RGBA', (512, 128), (0, 0, 0, 0))
    for i, f in enumerate(hero.THROW):
        im, _ = native(hero, f); sheet.alpha_composite(x2(im), (i * 128, 0))
    OUT['hero_throw'] = sheet; sheet.save(f'{HERE}/hero/throw.png')

FOE_XY = (292, 4); HERO_XY = (46, 99)
def scene(foe, hero_img, mon=False):
    bg = Image.open(f'{HERE}/bg_clean.png').convert('RGBA')
    if mon:
        m = Image.open(f'{HERE}/_monster.png'); bg.alpha_composite(m, (296 - 40, 40))
        bg.alpha_composite(foe, (FOE_XY[0] + 60, FOE_XY[1]))
    else:
        bg.alpha_composite(foe, FOE_XY)
    bg.alpha_composite(hero_img, HERO_XY)
    return bg

def previews():
    for name in ('naru', 'yurim', 'muyeong'):
        s = scene(OUT[name], OUT['hero_back'])
        s.save(f'{HERE}/preview-{name}-1x.png'); x3(s).save(f'{HERE}/preview-{name}-3x.png')
    s = scene(OUT['naru'], OUT['hero_back'], mon=True)
    s.save(f'{HERE}/preview-with-monster-1x.png'); x3(s).save(f'{HERE}/preview-with-monster-3x.png')
    for i in range(4):
        fr = OUT['hero_throw'].crop((i * 128, 0, i * 128 + 128, 128))
        s = scene(OUT['naru'], fr, mon=True); x3(s).save(f'{HERE}/preview-throw{i+1}-3x.png')

def x3(im): return im.resize((im.width * 3, im.height * 3), Image.NEAREST)

if __name__ == '__main__':
    bake(); previews(); print('ok')

CHIPS = {  # (sheet, slot) the overworld chip each sprite matches
    'naru': ('scarloxy/scarloxy-charset-people1.png', 3),
    'yurim': ('scarloxy/scarloxy-charset-people2.png', 1),
    'muyeong': ('scarloxy/scarloxy-charset-people2.png', 0),
    'hero': ('generated/charsets/ScarloxyPeople14.png', 2),
}
ASSETS = __import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), '../../../../public/assets/')
def chip(name, row):  # row 0 = back, 2 = front (down)
    f, slot = CHIPS[name]
    im = Image.open(ASSETS + f).convert('RGBA')
    x, y = (slot % 4) * 72 + 24, (slot // 4) * 128 + row * 32
    return im.crop((x, y, x + 24, y + 32))

def sheet():
    from PIL import ImageDraw
    rows = [('naru', [OUT['naru']], 2), ('yurim', [OUT['yurim']], 2), ('muyeong', [OUT['muyeong']], 2),
            ('hero', [OUT['hero_back']] + [OUT['hero_throw'].crop((i*128, 0, i*128+128, 128)) for i in range(4)], 0)]
    W = 20 + 72 + 20 + 5 * 136 + 20 + 384 * 2 + 20
    H = sum(400 for _ in rows) + 20 + 400
    s = Image.new('RGBA', (W, H), (96, 104, 112, 255)); d = ImageDraw.Draw(s)
    y = 10
    for name, ims, crow in rows:
        c = chip(name, crow).resize((72, 96), Image.NEAREST); s.alpha_composite(c, (20, y + 140))
        x = 112
        for im in ims:
            s.alpha_composite(im, (x, y + 130)); x += 136
        big = ims[0].resize((384, 384), Image.NEAREST); s.alpha_composite(big, (112 + 5 * 136 + 20, y))
        if len(ims) > 1:
            big = ims[3].resize((384, 384), Image.NEAREST); s.alpha_composite(big, (112 + 5 * 136 + 20 + 384, y))
        d.text((20, y + 4), name, fill=(255, 255, 255, 255))
        y += 400
    # hero throw frames at 3x along the bottom
    x = 20
    for i in range(1, 5):
        s.alpha_composite(ims[i].resize((384, 384), Image.NEAREST), (x, y)); x += 390
    s.save(f'{HERE}/sheet.png')

if __name__ == '__main__':
    sheet(); print('sheet ok')
