"""Original coordinate-drawn pixel FX. No resampling, antialiasing or source art.
64px × 8 frames, binary alpha; five ink colours + transparent per sheet.
Run an individual <name>.py or this module to regenerate the entire set.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import math

ROOT = Path(__file__).resolve().parents[3]
PALETTES = {
    'slash': ['#243454','#587fba','#92d7fa','#e8ffff','#fff9be'],
    'focus': ['#795020','#bf8827','#f5c747','#fff19a','#fffde5'],
    'arcane': ['#403782','#7250bc','#b18bf0','#c2eaff','#ffffff'],
    'heal': ['#195d53','#35a86a','#7ee48a','#c9ffd0','#f2fff1'],
    'sleep': ['#613e76','#a65c9c','#da8fb9','#ffd0de','#fff1ed'],
    'weaken': ['#35244c','#63477b','#a875bd','#d3ace8','#ffe5ff'],
    'poison': ['#284735','#51852c','#87c744','#c6f374','#f4ffbc'],
    'fire': ['#812d38','#d44931','#f47e2e','#ffc459','#fff5b4'],
    'ice': ['#24416c','#347bb0','#65bfe0','#b6edfa','#f0ffff'],
    'thunder': ['#61448d','#a37fba','#ecce59','#fff397','#ffffff'],
    'earth': ['#42312f','#775344','#ad8059','#d5b483','#f0d9ad'],
    'wind': ['#285e66','#4ba58a','#8fddbb','#c9ffda','#effff3'],
    'dark': ['#19142e','#39234e','#643976','#a35ab3','#e6acf2'],
    'holy': ['#815d37','#c2984c','#f2d780','#fff2b6','#ffffff'],
    'water': ['#203f7c','#2e76b3','#4fb9da','#9ce7ed','#e8ffff'],
    'leaf': ['#254a36','#4b7d3e','#84b844','#c5df75','#eff9b2'],
    'knife': ['#293448','#526681','#92b5cd','#dcf3fa','#fff1c3'],
}

def star(d,x,y,r,c):
    d.line((x-r,y,x+r,y),fill=c,width=1)
    d.line((x,y-r,x,y+r),fill=c,width=1)
    if r>2: d.rectangle((x-1,y-1,x+1,y+1),fill=c)

def arrow(d,x,y,up,c):
    s=-1 if up else 1
    d.polygon([(x,y+7*s),(x-5,y+2*s),(x-2,y+2*s),(x-2,y-5*s),(x+2,y-5*s),(x+2,y+2*s),(x+5,y+2*s)],fill=c)

def draw(name,f):
    im=Image.new('RGBA',(64,64)); d=ImageDraw.Draw(im); p=PALETTES[name]
    # All formulas resolve to integer pixel coordinates. Ink is always opaque.
    if name=='slash':
        # Three diagonal crescents, alternating direction; the final stroke fills the cell.
        phase=f%3; r=18 if f<5 else 28
        pts=[(32-r,32+r-4),(32-r+6,32+7),(32+r-5,32-r),(32+8,32-3)]
        if f in (2,3): pts=[(64-x,y) for x,y in pts]
        d.polygon(pts,fill=p[1]); d.line([pts[0],pts[1],pts[2]],fill=p[3],width=2 if phase else 3)
        star(d,32,31,5 if f<6 else 9,p[4])
        for k in range(5): star(d,8+k*11,14+(k*13+f*5)%39,1,p[2])
    elif name=='focus':
        r=[13,19,25,17,14,21,27,22][f]
        d.ellipse((32-r,32-r,32+r,54),outline=p[1],width=2)
        d.arc((34-r,34-r,30+r,51),190,350,fill=p[3],width=2)
        for x in (19,32,45): arrow(d,x,45-(f*4+(x%3)*5)%31,True,p[3 if x==32 else 2])
        for k in range(4): star(d,14+k*12,48-(f*5+k*7)%40,2,p[4])
    elif name=='arcane':
        if f<3:
            r=3+f*3; d.ellipse((32-r,30-r,32+r,30+r),fill=p[1],outline=p[2],width=2)
            d.ellipse((30-r//2,28-r//2,34+r//2,32+r//2),fill=p[4])
        else:
            r=5+(f-3)*5
            for k in range(8):
                a=k*math.pi/4; x=round(32+math.cos(a)*r); y=round(30+math.sin(a)*r)
                star(d,x,y,max(1,7-f),p[3 if k%2 else 2])
            star(d,32,30,max(1,11-f),p[4])
    elif name in ('sleep','weaken'):
        for k in range(6):
            x=12+k*8+round(math.sin(f+k)*3); y=42-((f*3+k*7)%24)
            d.ellipse((x-8,y-4,x+8,y+4),outline=p[1+k%3],width=2)
            d.line((x-5,y+5,x+3,y+5),fill=p[1])
        if name=='sleep':
            for k in range(3):
                x=18+k*13; y=24-((f*2+k*4)%17)
                d.line([(x,y),(x+5,y),(x,y+5),(x+5,y+5)],fill=p[4])
        else:
            for x in (22,42): arrow(d,x,16+(f*4)%31,False,p[3])
    elif name=='poison':
        for k in range(9):
            a=k*math.pi*2/9; r=5+f*3
            x=round(32+math.cos(a)*r); y=round(31+math.sin(a)*r+f*f/7)
            d.ellipse((x-2,y-3,x+2,y+2),fill=p[1+k%3]); d.point((x-1,y-2),fill=p[4])
        if f<4: d.line((49-f*4,24,22-f*2,35),fill=p[4],width=2)
    elif name=='fire':
        for k in range(5):
            x=18+k*7; h=[15,25,38,48,43,33,24,13][f]-(k%2)*9
            d.polygon([(x-6,54),(x-5,39),(x-1,54-h),(x+2,34),(x+5,26+(f+k)%5),(x+6,54)],fill=p[1])
            d.polygon([(x-3,53),(x,54-h+10),(x+4,53)],fill=p[2])
            d.polygon([(x-1,53),(x+1,44),(x+3,53)],fill=p[4])
        for k in range(5): d.rectangle((15+k*8,6+(f*7+k*9)%30,16+k*8,8+(f*7+k*9)%30),fill=p[3])
    elif name=='ice':
        for k in range(3):
            x=18+k*14; h=max(10,[12,20,32,43,43,32,20,12][f]-(k%2)*8)
            pts=[(x-7,49),(x-5,49-h+8),(x,49-h),(x+7,49-h+10),(x+6,52)]
            d.polygon(pts,fill=p[1],outline=p[0]); d.polygon([(x,50),(x,49-h+2),(x+5,49-h+10),(x+4,49)],fill=p[3])
            d.line((x-4,47,x-3,52-h+8),fill=p[2],width=2)
        for k in range(6): star(d,7+k*10,10+(k*9+f*3)%32,2,p[4])
    elif name=='thunder':
        pts=[(37,3),(27,18),(35,18),(22,34),(31,33),(24,53)]
        if f%2: pts=[(x+3 if i%2 else x-2,y) for i,(x,y) in enumerate(pts)]
        d.line(pts,fill=p[1],width=7 if f<6 else 3); d.line(pts,fill=p[2],width=4); d.line(pts,fill=p[4],width=2)
        if f in (2,3,5): d.line([(28,22),(15,27),(20,36),(8,42)],fill=p[3],width=2)
        star(d,25,51,4+(f%3)*3,p[4])
    elif name=='earth':
        for k in range(4):
            x=13+k*12; h=[5,12,26,38,44,36,20,8][f]-(k%2)*6; h=max(11,h)
            d.polygon([(x-7,55),(x-5,55-h+5),(x+1,55-h),(x+7,55-h+10),(x+7,55)],fill=p[1],outline=p[0])
            d.polygon([(x+1,55-h+2),(x+5,55-h+11),(x+3,52),(x-1,52)],fill=p[3])
        for k in range(8):
            x=5+k*7; y=52-(k*7+f*3)%12; d.rectangle((x,y,x+2,y+1),fill=p[2])
    elif name=='wind':
        for k in range(2):
            pts=[(5,44-f%3),(19,28),(55,15),(41,34),(11,48)]
            if k: pts=[(x,64-y) for x,y in pts]
            spread=[.3,.6,.9,1,.9,.7,.45,.2][f]
            pts=[(round(32+(x-32)*spread),round(32+(y-32)*spread)) for x,y in pts]
            d.polygon(pts,fill=p[1]); d.line(pts[:3],fill=p[4],width=2)
        for k in range(4): d.line((9+k*13,7+(f+k)%5,14+k*13,7+(f+k)%5),fill=p[2])
    elif name=='dark':
        r=[8,16,24,27,22,16,9,3][f]
        d.ellipse((32-r,31-r,32+r,31+r),fill=p[0],outline=p[2],width=2)
        d.arc((34-r,33-r,30+r,29+r),20+f*35,140+f*35,fill=p[4],width=2)
        for k in range(6):
            a=k*math.pi/3+f/3; x=round(32+math.cos(a)*min(29,r+6)); y=round(31+math.sin(a)*min(29,r+6))
            star(d,x,y,2,p[3])
    elif name in ('heal','holy','water'):
        w=[3,5,9,12,10,8,5,2][f]; top=[45,31,16,6,4,11,23,39][f]
        d.rectangle((32-w,top,32+w,54),fill=p[1]); d.rectangle((30-w//2,top,32+w//2,54),fill=p[3])
        # Break up the column with moving bright ripples instead of a smooth rectangular beam.
        if name in ('water','heal'):
            for k in range(5):
                y=top+((k*9+f*4)%max(1,54-top))
                d.line((32-w,y,32+w,y),fill=p[2],width=1)
        if name=='holy':
            d.rectangle((12,20,52,27),fill=p[2]); d.rectangle((14,22,50,24),fill=p[4]); d.line((32,5,32,53),fill=p[4],width=2)
        elif name=='water':
            d.ellipse((14,49,50,57),outline=p[2],width=2)
            for k in range(4):
                x=12+k*13; y=18+(f*5+k*8)%27; d.line((x,y,x+2,y+4),fill=p[3],width=2)
        else:
            d.ellipse((15,49,49,56),outline=p[2],width=2)
            for k in range(6): star(d,12+k*8,48-(f*5+k*9)%41,2,p[4])
    elif name=='leaf':
        for k in range(5):
            a=k*1.26+f*.55; r=12+f
            x=round(32+math.cos(a)*r); y=round(31+math.sin(a)*r)
            d.polygon([(x-6,y+4),(x-4,y-2),(x+6,y-5),(x+3,y+3)],fill=p[2],outline=p[0])
            d.line((x-4,y+3,x+4,y-3),fill=p[4])
    elif name=='knife':
        x=51-f*5; y=21+f*2
        d.line((x+5,y-3,x+17,y-9),fill=p[1],width=2)
        d.polygon([(x-12,y+8),(x-4,y-2),(x+1,y),(x-2,y+5)],fill=p[3],outline=p[1])
        d.line((x-11,y+7,x-1,y+1),fill=p[4]); d.line((x-2,y-3,x+3,y+5),fill=p[2],width=2)
        if f>=4: star(d,23,35,8-f+2,p[4])
    return im

def generate(name):
    sheet=Image.new('RGBA',(512,64))
    for f in range(8): sheet.paste(draw(name,f),(f*64,0))
    assert set(sheet.getchannel('A').getdata()) <= {0,255}
    assert len(sheet.getcolors(65536))<=12
    out=ROOT/'public/assets/generated/pixel-fx'/f'{name}.png'
    out.parent.mkdir(parents=True,exist_ok=True); sheet.save(out,optimize=True)
    return out

if __name__=='__main__':
    for name in PALETTES: print(generate(name))
