"""Compare existing candidate pixels in the same layout. No new art or game-map installation."""
from PIL import Image


def parking_scene(png, contract, dest, opened=False):
    sheet = Image.open(png).convert('RGBA')
    parts = {}
    for c in contract['components']:
        x, y, w, h = c['box']
        parts[c['id']] = sheet.crop((x, y, x+w, y+h))
    scene = Image.new('RGBA', (512, 384), '#20252e')
    def put(name, x, y): scene.alpha_composite(parts[name], (x*16, y*16))
    for y in range(1, 23):
        for x in range(1, 31): put('floor-a' if (x+y)%2 else 'floor-b', x, y)
    for x in range(2, 30):
        put('wall-n', x, 1); put('wall-s', x, 22)
    for y in range(3, 22):
        put('wall-w', 1, y); put('wall-e', 30, y)
    for name, x, y in [('outer-nw',1,1),('outer-ne',30,1),('outer-sw',1,22),('outer-se',30,22)]: put(name,x,y)
    for x, num in ((3,'P01'), (12,'P02')):
        put('bay-8x4',x,5);put(num,x+3,8)
        put('stopper-left',x+1,5);put('stopper-right',x+6,5)
        put('led-long',x+2,3)
    for x in (2,6,10,14,18,22,26): put('walkway-4wide',x,12)
    put('crossing-2wide',20,10)
    put('arrow-e',12,10);put('arrow-n',20,17)
    put('ramp-up',3,17);put('ramp-down',7,17)
    put('barrier-open' if opened else 'barrier-closed',12,17);put('card-reader',16,18)
    put('lobby-flat',25,7);put('stair-first',25,4)
    put('fire-door-open' if opened else 'fire-door-closed',25,8)
    put('fire-cabinet',22,4);put('vent',19,2)
    for x in (4,6,8): put('duct-ew',x,2)
    put('duct-elbow',10,2);put('duct-ns',10,4)
    put('sign-B1',2,1);put('sign-STAIR',26,2);put('sign-IN',3,16);put('sign-OUT',7,16)
    scene.convert('RGB').resize((1024,768),Image.Resampling.NEAREST).save(dest)


def stair_context(context, png, dest):
    # Native context is a 3x rendering; place the original candidate at the same pixel scale.
    scene = Image.open(context).convert('RGBA')
    chip = Image.open(png).convert('RGBA')
    chip = chip.resize((chip.width*3,chip.height*3),Image.Resampling.NEAREST)
    scene.alpha_composite(chip, (max(0,(scene.width-chip.width)//2), max(0,scene.height-chip.height-102)))
    scene.convert('RGB').save(dest)
