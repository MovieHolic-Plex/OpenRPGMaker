# material ramps (dark→light, hue-shifted) + small goods sprites drawn into a Pix at a point
import colorsys
from k import *
def ramp(dark,mid,light,n=7):
    # n tones through three anchors; hue shifts come from the anchors themselves
    a,b,c=[tuple(int(s[i:i+2],16) for i in (1,3,5)) for s in (dark,mid,light)]
    out=[]
    for i in range(n):
        t=i/(n-1)
        if t<0.5: u=t/0.5; p,q=a,b
        else: u=(t-0.5)/0.5; p,q=b,c
        out.append(tuple(int(p[j]+(q[j]-p[j])*u) for j in range(3))+(255,))
    return out
M={
 'wood':WOOD,
 'dwood':ramp('#1a0e06','#4a2c16','#8a6038'),     # dark stained wood
 'pine':ramp('#3a2410','#a07448','#f0d098'),
 'iron':ramp('#0e1216','#4a5460','#d0d8e0'),
 'brass':ramp('#3a2600','#a07818','#fff0a0'),
 'stone':ramp('#1d2228','#606878','#c8d0d0'),
 'marble':ramp('#4a4a58','#a8a8b8','#fbfbff'),
 'clay':ramp('#2a1206','#a0522c','#f8c090'),
 'linen':ramp('#3a3530','#b9ab9d','#fff8ea'),
 'red':ramp('#3a0508','#c30014','#ffb0a0'),
 'blue':ramp('#0a1a3a','#1f68b0','#c0e4ff'),
 'green':ramp('#0c2a10','#3a8a30','#c8f09a'),
 'purple':ramp('#1e0c38','#6a38b0','#e0c8ff'),
 'yellow':ramp('#3a2a00','#d0a818','#fff8b0'),
 'orange':ramp('#3a1400','#e06a10','#ffd8a0'),
 'pink':ramp('#3a0a20','#e0608a','#ffe0ec'),
 'teal':ramp('#062a2a','#1a9088','#b8fff0'),
 'bread':ramp('#3a1a04','#b8742a','#ffe2a0'),
 'meat':ramp('#2a0404','#a82830','#ffb8a8'),
 'fish':ramp('#1a2430','#6a8ca0','#eef8ff'),
 'gold':ramp('#3a2400','#c09020','#fff4b8'),
 'glass':ramp('#10283a','#4a90c0','#f0ffff'),
 'ice':ramp('#4a6a80','#a8d8f0','#ffffff'),
 'straw':ramp('#3a2a08','#b09040','#fff0b0'),
 'leaf':ramp('#0c240e','#2e8a2a','#b8f080'),
 'black':ramp('#08080a','#2a2a32','#707080'),
 'white':ramp('#5a5a66','#c8c8d4','#ffffff'),
 'cheese':ramp('#4a3000','#e0b030','#fff4b0'),
 'water':ramp('#0a1a3a','#2a70b8','#b8e8ff'),
}
def P_(p,x,y,c):
    p.set(x,y,c)
def lit(p,x,y,rows,mat,extra=None):
    R=M[mat] if isinstance(mat,str) else mat
    key={str(i):R[i] for i in range(len(R))}
    if extra: key.update(extra)
    p.lit(x,y,rows,key)
# ---- goods: each draws at (x,y) = top-left, returns (w,h) ----
G={}
def good(name,w,h):
    def deco(f): G[name]=(f,w,h); return f
    return deco
@good('fish',7,3)
def g_fish(p,x,y,mat='fish'):
    lit(p,x,y,['0 1234 ','1256651','0 2332 '],mat,{'e':M['black'][0]}); p.set(x+5,y+1,M['black'][0])
@good('fishr',7,3)
def g_fishr(p,x,y): g_fish(p,x,y,'red')
@good('fishg',7,3)
def g_fishg(p,x,y): g_fish(p,x,y,ramp('#1a2a10','#6a9a50','#e8ffd0'))
@good('squid',5,5)
def g_squid(p,x,y): lit(p,x,y,[' 343 ','35553','34443',' 2 2 ','2 2 2'],'pink')
@good('crab',6,4)
def g_crab(p,x,y): lit(p,x,y,['2    2','135531','155551',' 2  2 '],'red')
@good('shell',4,3)
def g_shell(p,x,y): lit(p,x,y,[' 55 ','4646',' 33 '],'linen')
@good('cabbage',5,4)
def g_cab(p,x,y): lit(p,x,y,[' 454 ','45654','34543',' 232 '],'green')
@good('carrot',6,3)
def g_car(p,x,y): lit(p,x,y,['g4553 ','gg4432','g 322 '],'orange',{'g':M['green'][4]})
@good('tomato',3,3)
def g_tom(p,x,y): lit(p,x,y,['4g4','456','343'],'red',{'g':M['green'][4]})
@good('apple',3,3)
def g_app(p,x,y): lit(p,x,y,['3g5','465','232'],'red',{'g':M['green'][4]})
@good('lemon',4,3)
def g_lem(p,x,y): lit(p,x,y,[' 55 ','4565',' 33 '],'yellow')
@good('pumpkin',6,5)
def g_pum(p,x,y): lit(p,x,y,['  gg  ','344543','454654','343543',' 2332 '],'orange',{'g':M['green'][2]})
@good('grape',4,4)
def g_gra(p,x,y): lit(p,x,y,[' g  ','3545','4353',' 32 '],'purple',{'g':M['green'][4]})
@good('potato',4,3)
def g_pot(p,x,y): lit(p,x,y,[' 44 ','4553','233 '],'bread')
@good('onion',4,4)
def g_oni(p,x,y): lit(p,x,y,[' g  ',' 55 ','4665','2332'],'pink',{'g':M['green'][4]})
@good('eggplant',4,4)
def g_egg(p,x,y): lit(p,x,y,['g   ','245 ','2354',' 232'],'purple',{'g':M['green'][4]})
@good('loaf',5,3)
def g_loaf(p,x,y): lit(p,x,y,[' 565 ','45654','23332'],'bread')
@good('baguette',8,2)
def g_bag(p,x,y): lit(p,x,y,[' 5656565','3444443 '],'bread')
@good('bun',3,3)
def g_bun(p,x,y): lit(p,x,y,['454','565','232'],'bread')
@good('pie',6,3)
def g_pie(p,x,y): lit(p,x,y,[' 5555 ','565656','233332'],'bread')
@good('cake',6,5)
def g_cake(p,x,y): lit(p,x,y,['  r   ','166661','155551','1rrrr1','133331'],'pink',{'r':M['red'][4],'1':M['linen'][2],'6':M['linen'][6],'5':M['linen'][5],'3':M['linen'][3]})
@good('cheese',5,3)
def g_che(p,x,y): lit(p,x,y,['  56 ','4556 ','3344 '],'cheese')
@good('ham',5,4)
def g_ham(p,x,y): lit(p,x,y,[' 45  ','45654','34543','w232 '],'meat',{'w':M['linen'][6]})
@good('sausage',7,3)
def g_sau(p,x,y): lit(p,x,y,[' 4 4 4 ','3535353','2 2 2 2'],'meat')
@good('steak',5,3)
def g_ste(p,x,y): lit(p,x,y,[' 454 ','45w54','2333 '],'meat',{'w':M['linen'][6]})
@good('egg',2,3)
def g_egg2(p,x,y): lit(p,x,y,['56','45','33'],'linen')
@good('herb',5,5)
def g_herb(p,x,y): lit(p,x,y,['4 5 4',' 454 ','3 4 3',' 2b2 ',' bbb '],'leaf',{'b':M['straw'][3]})
@good('flower',5,5)
def g_flo(p,x,y): lit(p,x,y,[' 5 5 ','56465',' 5g5 ','  g  ',' ggg '],'pink',{'g':M['green'][3],'6':M['yellow'][5]})
@good('mushroom',4,4)
def g_mush(p,x,y): lit(p,x,y,[' 55 ','4w54',' 66 ',' 55 '],'red',{'w':M['linen'][6],'6':M['linen'][5],'5':M['red'][4]})
@good('potion',3,5)
def g_potion(p,x,y,mat='red'): lit(p,x,y,[' w ',' 2 ','453','463','232'],mat,{'w':M['linen'][4]})
@good('potionb',3,5)
def g_potb(p,x,y): g_potion(p,x,y,'blue')
@good('potiong',3,5)
def g_potg(p,x,y): g_potion(p,x,y,'green')
@good('potionp',3,5)
def g_potp(p,x,y): g_potion(p,x,y,'purple')
@good('flask',5,5)
def g_flask(p,x,y): lit(p,x,y,[' w  ','  2  ',' 353 ','46553','23332'],'teal',{'w':M['linen'][4]})
@good('vial',2,5)
def g_vial(p,x,y): lit(p,x,y,['ww','34','45','45','23'],'yellow',{'w':M['linen'][4]})
@good('jar',4,5)
def g_jar(p,x,y,mat='clay'): lit(p,x,y,['1221','1331','3553','3443','2332'],mat)
@good('jarb',4,5)
def g_jarb(p,x,y): g_jar(p,x,y,'blue')
@good('jarg',4,5)
def g_jarg(p,x,y): g_jar(p,x,y,'green')
@good('book',4,5)
def g_book(p,x,y,mat='red'): lit(p,x,y,['1551','3441','3y41','3441','2221'],mat,{'y':M['gold'][5]})
@good('bookb',4,5)
def g_bookb(p,x,y): g_book(p,x,y,'blue')
@good('bookg',4,5)
def g_bookg(p,x,y): g_book(p,x,y,'green')
@good('scroll',6,3)
def g_scr(p,x,y): lit(p,x,y,['3r666r','456665','2r333r'],'linen',{'r':M['red'][3]})
@good('gem',3,3)
def g_gem(p,x,y,mat='teal'): lit(p,x,y,['565','454',' 2 '],mat)
@good('gemr',3,3)
def g_gemr(p,x,y): g_gem(p,x,y,'red')
@good('coins',5,3)
def g_coin(p,x,y): lit(p,x,y,[' 56  ','45654','23332'],'gold')
@good('candle',3,6)
def g_can(p,x,y): lit(p,x,y,[' f ',' o ','565','454','454','232'],'linen',{'f':M['yellow'][6],'o':M['orange'][4]})
@good('cup',3,3)
def g_cup(p,x,y): lit(p,x,y,['565','44 ','33 '],'white')
@good('mug',4,4)
def g_mug(p,x,y): lit(p,x,y,['666 ','4442','4442','333 '],'wood',{'6':M['linen'][6]})
@good('plate',5,3)
def g_pla(p,x,y): lit(p,x,y,[' 666 ','64446',' 333 '],'white')
@good('bottle',3,6)
def g_bot(p,x,y,mat='green'): lit(p,x,y,[' 1 ',' 3 ','353','353','353','232'],mat)
@good('bottler',3,6)
def g_botr(p,x,y): g_bot(p,x,y,'red')
@good('bottley',3,6)
def g_boty(p,x,y): g_bot(p,x,y,'yellow')
@good('yarn',4,4)
def g_yarn(p,x,y,mat='red'): lit(p,x,y,[' 54 ','5453','4534',' 32 '],mat)
@good('yarnb',4,4)
def g_yarnb(p,x,y): g_yarn(p,x,y,'blue')
@good('yarny',4,4)
def g_yarny(p,x,y): g_yarn(p,x,y,'yellow')
@good('bolt',6,4)
def g_bolt(p,x,y,mat='purple'): lit(p,x,y,['155551','144441','155551','233332'],mat)
@good('boltg',6,4)
def g_boltg(p,x,y): g_bolt(p,x,y,'green')
@good('boltr',6,4)
def g_boltr(p,x,y): g_bolt(p,x,y,'red')
@good('skull',5,5)
def g_sku(p,x,y): lit(p,x,y,[' 666 ','65556','5k5k5',' 545 ',' 333 '],'linen',{'k':M['black'][1]})
@good('crystal',5,6)
def g_cry(p,x,y): lit(p,x,y,['  6  ',' 565 ',' 454 ','34543',' 343 ',' 222 '],'purple')
@good('hammer',6,4)
def g_ham2(p,x,y): lit(p,x,y,['555   ','4441111','222  1 '[:6],'      '],'iron',{'1':M['wood'][5]})
@good('dagger',7,3)
def g_dag(p,x,y): lit(p,x,y,['y      ','3y56666','y      '],'iron',{'y':M['gold'][4]})
@good('horseshoe',5,4)
def g_hs(p,x,y): lit(p,x,y,['54345','4   4','3   3','2   2'],'iron')
@good('ingot',5,3)
def g_ing(p,x,y): lit(p,x,y,[' 666 ','45554','23332'],'iron')
@good('ingotg',5,3)
def g_ingg(p,x,y): lit(p,x,y,[' 666 ','45554','23332'],'gold')
@good('ice',5,3)
def g_ice(p,x,y): lit(p,x,y,['56665','45654','34443'],'ice')
@good('wool',5,4)
def g_wool(p,x,y): lit(p,x,y,[' 656 ','65656','45454',' 343 '],'white')
@good('box',5,4)
def g_box(p,x,y): lit(p,x,y,['17771','16661','13331','10001'],'wood')
@good('toy',5,5)
def g_toy(p,x,y): lit(p,x,y,[' 55  ','5k55 ',' 443 ','4 4 3',' 3 3 '],'bread',{'k':M['black'][0]})
# ---- tabletop things (sit ON a surface; bottom row = where it touches the top) ----
@good('inkwell',5,5)
def g_ink(p,x,y): lit(p,x,y,['   w ','  w  ',' 111 ','13331','11111'],'black',{'w':M['white'][6]})
@good('papers',6,3)
def g_pap(p,x,y): lit(p,x,y,['666665','656565','444443'],'linen')
@good('openbook',7,3)
def g_ob(p,x,y): lit(p,x,y,['1666666'[:7],'1656561','r11r11r'],'linen',{'r':M['red'][3]})
@good('bookstack',5,5)
def g_bs(p,x,y): lit(p,x,y,['bbbb ',' rrrr','ggggg','yyyy ','11111'],'linen',{'b':M['blue'][4],'r':M['red'][4],'g':M['green'][4],'y':M['yellow'][4],'1':M['black'][1]})
@good('teapot',6,4)
def g_tea(p,x,y): lit(p,x,y,['  55  ','1566665'[:6],' 44443','  333 '],'white',{'1':M['white'][3]})
@good('bowl',5,3)
def g_bowl(p,x,y): lit(p,x,y,['1rrr1','14441',' 333 '],'white',{'r':M['orange'][4]})
@good('vase',4,6)
def g_vase(p,x,y): lit(p,x,y,['p5p ',' gg ',' 55 ','5665','4554',' 33 '],'blue',{'p':M['pink'][5],'g':M['green'][4]})
@good('lamp',5,6)
def g_lamp(p,x,y): lit(p,x,y,[' 666 ','65556','f444f'[:5],' 1f1 ','  1  ',' 111 '],'yellow',{'1':M['brass'][2],'f':M['brass'][4]})
@good('bell',3,3)
def g_bell(p,x,y): lit(p,x,y,[' 6 ','454','333'],'gold')
@good('cashbox',5,3)
def g_cash(p,x,y): lit(p,x,y,['16661','1y441','11111'],'iron',{'y':M['gold'][5]})
@good('scissors',5,3)
def g_sci(p,x,y): lit(p,x,y,['6   6',' 5 5 ','r r  '[:5]],'iron',{'r':M['red'][4]})
@good('spools',6,3)
def g_spo(p,x,y): lit(p,x,y,['rr bb ','r4 b4 ','11 11 '],'wood',{'r':M['red'][4],'b':M['blue'][4]})
@good('dice',4,2)
def g_dice(p,x,y): lit(p,x,y,['66 6','1414'[:4]],'white',{'1':M['black'][1]})
@good('cards',5,2)
def g_card(p,x,y): lit(p,x,y,['6r666','33333'],'white',{'r':M['red'][4]})
@good('wineglass',3,4)
def g_wg(p,x,y): lit(p,x,y,['rrr',' r ',' 5 ','555'],'white',{'r':M['red'][3]})
@good('board',7,3)
def g_brd(p,x,y): lit(p,x,y,[' 66666 ','6555566','3333333'],'pine',{'6':M['pine'][6]})
@good('knife',5,2)
def g_knife(p,x,y): lit(p,x,y,['66611','44   '],'iron',{'1':WOOD[3]})
@good('mortar',5,4)
def g_mor(p,x,y): lit(p,x,y,['   w ','1555w'[:5],'14441',' 333 '],'stone',{'w':WOOD[5]})
@good('scale',7,5)
def g_scl(p,x,y): lit(p,x,y,['   5   ','5555555','4  5  4','33 5 33','  333  '],'brass')
@good('pan',6,3)
def g_pan(p,x,y): lit(p,x,y,['1111  ','14441w','1111  '],'iron',{'w':WOOD[4]})
@good('soup',5,3)
def g_soup(p,x,y): lit(p,x,y,['1ooo1','14441',' 333 '],'white',{'o':M['orange'][5]})
@good('breadplate',6,3)
def g_bp(p,x,y): lit(p,x,y,['  55  ',' 5665 ','333333'],'bread',{'3':M['white'][4]})
@good('fishplate',7,3)
def g_fp(p,x,y): lit(p,x,y,[' 35553 ','3556655','4444444'],'fish',{'4':M['white'][4]})
@good('fruitbowl',6,4)
def g_fb(p,x,y): lit(p,x,y,[' ryg  '[:6],'rryggy'[:6],'144441',' 3333 '],'white',{'r':M['red'][4],'y':M['yellow'][5],'g':M['green'][4]})
@good('smallflask',3,4)
def g_sf(p,x,y): lit(p,x,y,[' 4 ','454','565','333'],'teal')
@good('herbbundle',5,3)
def g_hb(p,x,y): lit(p,x,y,['45454','34s43','  s  '],'leaf',{'s':M['straw'][3]})
@good('clothfold',6,3)
def g_cf(p,x,y): lit(p,x,y,['555554','444443','222222'],'purple')
@good('tongs',6,2)
def g_tg(p,x,y): lit(p,x,y,['5    5',' 4444 '],'iron')
@good('beer',4,4)
def g_beer(p,x,y): lit(p,x,y,['666 ','5553','44431'[:4],'333 '],'yellow',{'6':M['white'][6]})
