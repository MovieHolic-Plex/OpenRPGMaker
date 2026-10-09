import sys, os; sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from eq_facade import *
f = Facade(8, 4, seed=3)
f.fill_wall()
for x in (16*2-2, 16*6-2): f.pilaster(x)
for k in (1,2,3):
    for b in range(8):
        f.window(b, k, 'french' if k in (1,2) and 1<=b<=6 else 'sash')
f.balcony(1, 3, 1); f.balcony(4, 6, 1); f.balcony(1,3,2); f.balcony(4,6,2)
f.cornice(); f.mansard(dormers=(1,2,5,6), chimneys=((0,4),(7,4)))
f.window(0,0,'sash'); f.window(7,0,'sash')
f.shopfront(2,5); f.awning(2,5); f.door(1); f.door(6); f.sign(6*16+6, f.y_gf+2, 'bed')
f.lamp(1*16-4, f.y_gf+6)
im=f.done()
bg=Image.new('RGBA',(im.width+32,im.height+16),(60,60,64,255)); bg.alpha_composite(im,(16,8))
bg.resize((bg.width*4,bg.height*4),Image.NEAREST).save('/tmp/euq/t_hotel.png'); print(im.size)
