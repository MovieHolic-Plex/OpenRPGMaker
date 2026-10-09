"""Four original SNES spell studies, using the existing indexed pixel FX primitives.

Run from any directory: python3 docs/experiments/ff6-battle-fx-20261005/render.py
Writes only to this study folder. The review stages are composites, not player captures.
"""
from pathlib import Path
import json
import math
import random
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / "scripts/asset-gen/pixel-fx"))
from lib_mage import Cel, Pal, FIRE, ICE, BOLT, SMOKE, jag

SIZE = 128
COUNT = 24
STEP = 60
FIRE_PAL = Pal(F=FIRE, S=SMOKE)
ICE_PAL = Pal(I=ICE)
BOLT_PAL = Pal(B=BOLT, A=["#123b78", "#276bb0", "#5bbfff", "#b5f2ff"])
DRAGON_PAL = Pal(D=["#17283a", "#214b61", "#337e89", "#65b6ba", "#b1e3d0", "#f2ffe0",
                   "#513657", "#986185", "#d493ad", "#ffe6d0", "#3271c9", "#78cfff",
                   "#c5f9ff", "#ffffff"])


def crystal(c, x, y, width, height, colors, lean=0):
    tip = (x + lean, y - height)
    left = (x - width, y - height * .32)
    right = (x + width, y - height * .4)
    foot = (x, y)
    c.poly([tip, left, foot, right], colors[0])
    c.poly([tip, left, (x - 1, y - 2), (x - 2, y - height * .3)], colors[1])
    c.poly([tip, (x - 2, y - height * .3), (x, y - 2), right], colors[3])
    c.poly([tip, (x + 2, y - height * .35), right], colors[2])
    c.line([tip, (x - 2, y - height * .3), (x, y - 2)], colors[4])
    c.line([tip, (x - width + 2, y - height * .32)], colors[5])


def living_flame(c, x, y, height, width, ramp, lean, f):
    profile = [1, .88, .95, .65, .73, .40, .30, 0]
    for k, color in enumerate(ramp):
        scale = 1 - k / (len(ramp) + .7)
        h, w = height * scale, width * scale
        left, right = [], []
        for row, spread in enumerate(profile):
            u = row / (len(profile) - 1)
            center = x + lean * u * u + math.sin(f * .65 + u * 7 + x) * 2.5 * u
            half = w * spread
            left.append((center - half, y - h * u))
            right.append((center + half, y - h * u))
        c.poly(left + right[::-1], color)


def fire_column(c, f):
    F, S = FIRE_PAL.F, FIRE_PAL.S
    if f < 5:
        t = (f + 1) / 5
        r = 26 - t * 19
        for i in range(10):
            a = i * math.tau / 10 + f * .24
            x, y = 64 + math.cos(a) * r, 96 + math.sin(a) * r * .25
            c.line([(x, y + 2), (x - math.cos(a) * 3, y - 4)], F[3], 2)
            c.px(x, y - 4, F[6])
        c.ring(64, 99, 20 + f * 2, F[3], 1, 5 + f)
        c.disc(64, 96, 2 + f, F[5])
        return
    if f <= 16:
        u = f - 5
        height = [22, 46, 72, 86, 88, 86, 82, 78, 70, 60, 45, 28][u]
        c.disc(64, 100, 30, F[1], 9)
        c.ring(64, 100, min(48, 25 + u * 3), F[4] if u < 6 else F[2], 2, 10 + u)
        # Separate tongues climb in succession; the outer mass has a dark, broken rim.
        for i, (dx, sc) in enumerate([(-25,.48),(-15,.72),(-4,.95),(10,.81),(24,.57)]):
            sway = math.sin(f * .72 + i * 1.8) * 5
            living_flame(c, 64 + dx, 100 - (i % 2) * 2, height * sc, 10,
                         [F[0],F[1],F[2],F[3],F[4],F[5]], sway, f+i)
        living_flame(c, 63, 99, height, 11, [F[2],F[3],F[4],F[5],F[6]], math.sin(f)*4, f)
        for i in range(12):
            a = i * 2.4
            y = 97 - ((u * 7 + i * 9) % max(22, height))
            x = 64 + math.sin(a + u*.26) * (14 + i % 4 * 4)
            c.line([(x, y), (x + 1, y - 3)], F[5] if i%3 else F[6])
        if u in (2,3,7):
            c.spark(64, 90 - height*.4, 11 if u == 3 else 7, F[6], F[7], True)
        return
    u = f - 17
    for i, (x,y,r) in enumerate([(40,65,9),(61,54,11),(80,66,10),(54,78,7),(75,81,6)]):
        if u > 3 and i % 2 != f % 2:
            continue
        xx, yy = x + (i-2)*u, y - u*4
        c.disc(xx, yy, max(2, r-u*.6), S[0])
        c.disc(xx-2, yy-2, max(1,r-u*.6-3), S[1])
        c.disc(xx-3, yy-3, max(1,r-u*.6-6), S[2])
    for i in range(12-u):
        x = 38 + (i*19 % 56); y = 98 - u*5 - (i*7 % 24)
        c.line([(x,y),(x+1,y-2)],F[4] if u < 4 else F[2])


def ice_shatter(c, f):
    I = ICE_PAL.I
    if f < 5:
        for i in range(8):
            a = i*math.tau/8 + f*.25
            r = 29-f*4
            c.spark(64+math.cos(a)*r, 82+math.sin(a)*r*.55, 2, I[4], I[5])
        c.ring(64,100,15+f*6,I[2],1,4+f)
        return
    if f <= 13:
        u = f-5
        height = [15,28,45,62,78,84,86,86,82][u]
        c.disc(64,102,39,I[0],11)
        c.disc(64,100,34,I[2],8)
        c.ring(64,99,30,I[4],2,7)
        for x,sc,w,lean in [(39,.57,10,-7),(90,.65,10,7),(50,.8,12,-6),(78,.86,13,5),(64,1,15,0)]:
            crystal(c,x,101,w,height*sc,I,lean)
        # Opaque planar facets, sharp seams and cracks; no radial glowing blob.
        if u > 5:
            c.line([(64,25),(62,42),(70,51),(61,61),(66,81)],I[0],2)
            c.line([(62,42),(54,48)],I[5])
            c.line([(61,61),(75,66)],I[0])
        for i in range(6):
            x=31+i*13; y=74 - (i*19+f*7)%60
            c.spark(x,y,3 if i%2 else 2,I[4],I[5])
        return
    u=f-14
    for i in range(16):
        rng=random.Random(400+i)
        a=rng.uniform(-math.pi,0)
        v=rng.uniform(2.0,4.1)
        x=64+math.cos(a)*v*(u+2)*1.5
        y=60+math.sin(a)*v*(u+2)*1.3+u*u*.65
        s=max(2,8-u*.4)
        if 5<x<123 and 7<y<112:
            crystal(c,x,y,s*.45,s*2,I,math.cos(a)*s*.5)
    if u<5:
        c.ring(64,99,37+u*3,I[3],1,10+u)
    for i in range(12-u):
        c.spark(29+i*23%72,35+i*17%61-u*2,2,I[4],I[5])


def thunder_impact(c, f):
    B,A=BOLT_PAL.B,BOLT_PAL.A
    if f<5:
        for i in range(3):
            x=39+i*25; y=48+(i%2)*13
            r=3+f
            c.disc(x,y,r,A[0]);c.disc(x-1,y-1,r-2,A[1]);c.disc(x-2,y-2,max(1,r-4),A[3])
        return
    if f<=17:
        u=f-5
        strike=u//4
        phase=u%4
        x=[45,84,65,65][strike]
        pts=jag(x-12,4,x,101,8,12,random.Random(200+strike))
        if phase<3:
            # Warm jagged bolt against cold blue conductors: two distinct visual motifs.
            c.bolt(pts,[(B[1],8),(B[4],5),(B[5],3),(B[6],1)])
            for k in (2,4,6):
                px,py=pts[k]
                branch=jag(px,py,px+(25 if k%4 else -27),py+15,3,7,random.Random(k+strike*5))
                c.bolt(branch,[(B[4],3),(B[6],1)])
        for i in range(3):
            xx=40+i*25; yy=49+(i%2)*19+math.sin(f*.5+i)*5
            r=9 if phase<2 else 6
            c.disc(xx,yy,r,A[0]);c.disc(xx-1,yy-1,r-2,A[1]);c.disc(xx-2,yy-2,r-4,A[2]);c.disc(xx-3,yy-3,2,A[3])
            c.arc(xx,yy,r+2,f*27,f*27+230,B[5],1)
        if phase<=2:
            c.spark(x,99,16-phase*4,B[4],B[6],True)
            c.ring(x,100,16+phase*7,B[5],2,5+phase*2)
        return
    u=f-18
    for i in range(7-u):
        a=i*math.tau/7+u*.5
        r=16+u*6
        x=64+math.cos(a)*r;y=78+math.sin(a)*r*.7
        c.bolt([(x-4,y-2),(x,y+2),(x+4,y-3)],[(B[2],3),(B[5],1)])


def winged_dragon(c, f):
    D=DRAGON_PAL.D
    if f<4:
        c.ring(72,106,12+f*9,D[10],2,3+f*2)
        for i in range(8):
            a=i*math.tau/8+f*.18
            c.spark(72+math.cos(a)*(12+f*8),99+math.sin(a)*(9+f*5),2,D[12],D[13])
        return
    if f>21:
        for i in range(10):
            c.spark(35+i*9%78,24+i*17%84,2 if f==22 else 1,D[12],D[13])
        return
    bob=round(math.sin((f-4)*.45)*2)
    wing=round(math.sin((f-4)*.6)*10)
    # Wing membranes are silhouettes with ribs, not particle halos.
    far=[(72,72+bob),(87,20+wing),(112,11+wing),(120,42+wing),(110,40+wing),(108,58+wing),(96,52+wing),(95,68+wing),(82,62+wing)]
    c.poly(far,D[0]);c.poly([(75,65+bob),(88,24+wing),(109,17+wing),(115,36+wing),(104,39+wing),(103,51+wing),(94,48+wing),(89,60+wing)],D[6])
    for tip in [(111,15+wing),(118,40+wing),(108,56+wing),(95,65+wing)]:
        c.line([(73,72+bob),tip],D[2],2)
    # Tail bends around the body with a light ridge.
    tail=[(77,91+bob),(93,107),(112,108),(120,99),(117,87),(109,84)]
    c.line(tail,D[0],12);c.line(tail,D[1],9);c.line(tail,D[2],5);c.line([(85,101),(102,109),(113,103)],D[4],2)
    # Body, hind legs and claws.
    c.poly([(58,64+bob),(75,66+bob),(91,87+bob),(82,99+bob),(57,93+bob),(50,79+bob)],D[0])
    c.poly([(60,66+bob),(73,69+bob),(84,88+bob),(77,96+bob),(58,89+bob),(53,78+bob)],D[2])
    c.poly([(55,70+bob),(63,68+bob),(71,85+bob),(66,92+bob),(58,88+bob)],D[4])
    for yy in (75,81,87):c.line([(56,yy+bob),(65,yy+1+bob)],D[2])
    for xx in (61,80):
        c.poly([(xx,86+bob),(xx+8,92+bob),(xx+5,106),(xx-9,110),(xx-14,106),(xx-5,100)],D[0])
        c.poly([(xx+1,90+bob),(xx+4,94+bob),(xx+1,103),(xx-8,107),(xx-10,105),(xx-2,99)],D[2])
        for off in (-9,-5,-1):c.line([(xx+off,106),(xx+off-3,110)],D[5],2)
    # S neck connects the skull to the breast.
    neck=[(61,74+bob),(48,67+bob),(50,54+bob),(38,44+bob)]
    c.line(neck,D[0],18);c.line(neck,D[2],14);c.line([(61,75+bob),(49,67+bob),(53,55+bob),(39,45+bob)],D[4],6)
    near=[(66,74+bob),(58,47+wing),(65,17+wing),(87,5+wing),(101,28+wing),(94,30+wing),(95,43+wing),(85,42+wing),(85,55+wing),(74,53+wing)]
    c.poly(near,D[0]);c.poly([(67,69+bob),(62,46+wing),(68,20+wing),(86,10+wing),(94,26+wing),(88,29+wing),(90,38+wing),(81,39+wing),(79,49+wing),(72,48+wing)],D[7])
    c.poly([(64,45+wing),(69,22+wing),(83,15+wing),(72,47+wing)],D[8])
    for tip in [(85,8+wing),(99,28+wing),(94,42+wing),(84,54+wing)]:c.line([(66,72+bob),tip],D[4],2)
    # Skull: horns, articulated jaw, teeth, bright eye and angular snout.
    c.poly([(43,37+bob),(46,23+bob),(39,28+bob),(35,19+bob),(32,34+bob)],D[0])
    c.poly([(41,36+bob),(43,27+bob),(38,31+bob),(36,24+bob),(35,36+bob)],D[5])
    c.poly([(43,35+bob),(28,33+bob),(17,40+bob),(9,42+bob),(13,49+bob),(29,48+bob),(42,54+bob),(49,46+bob)],D[0])
    c.poly([(41,37+bob),(29,36+bob),(19,43+bob),(13,44+bob),(15,47+bob),(31,45+bob),(43,50+bob),(46,45+bob)],D[3])
    c.line([(19,41+bob),(29,37+bob),(40,39+bob)],D[4],2)
    c.line([(34,40+bob),(40,40+bob)],D[0],3);c.px(36,40+bob,D[13]);c.px(37,40+bob,D[9])
    jaw=5 if 10<=f<=18 else 1
    c.poly([(15,49+bob),(32,48+bob),(41,52+bob),(33,54+bob+jaw),(17,53+bob+jaw)],D[0])
    c.line([(18,52+bob+jaw),(32,52+bob+jaw),(38,51+bob)],D[4],2)
    for xx in (20,26,31):c.line([(xx,47+bob),(xx+1,50+bob)],D[5])
    if 8<=f<=10:
        c.spark(17,50+bob,4+(f-8)*3,D[11],D[13],True)
    if 11<=f<=18:
        u=f-11
        c.poly([(14,47+bob),(0,35-u*.7+bob),(0,69+u*.6+bob),(14,54+bob)],D[10])
        c.poly([(13,48+bob),(0,43-u*.3+bob),(0,60+u*.3+bob),(13,53+bob)],D[11])
        c.poly([(12,49+bob),(0,48+bob),(0,54+bob),(12,52+bob)],D[13])
        c.spark(7,51+bob,4,D[12],D[13])


SPELLS = [
    ("fire-column", "홍염 기둥", "불씨 수렴 → 불기둥 → 잔불", FIRE_PAL, fire_column, "mage_fire_burst"),
    ("ice-shatter", "빙정 파쇄", "결정 성장 → 균열 → 파편", ICE_PAL, ice_shatter, "mage_blizzard"),
    ("thunder-impact", "창뢰 연타", "푸른 전하 → 황색 낙뢰 → 잔전류", BOLT_PAL, thunder_impact, "mage_chain_bolt"),
    ("winged-dragon", "성익룡 소환", "소환진 → 날개·턱 동작 → 브레스", DRAGON_PAL, winged_dragon, "monk_dragon_aura"),
]


def draw_frames(pal, draw):
    lut=[(0,0,0,0)]+[color+(255,) for color in pal.colors]
    result=[]
    for f in range(COUNT):
        cel=Cel(SIZE);draw(cel,f)
        frame=Image.new("RGBA",(SIZE,SIZE))
        pixels = cel.im.get_flattened_data() if hasattr(cel.im, "get_flattened_data") else cel.im.getdata()
        frame.putdata([lut[v] for v in pixels])
        result.append(frame)
    return result


def font(size):
    for path in ["/usr/share/fonts/truetype/nanum/NanumGothic.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if Path(path).exists():return ImageFont.truetype(path,size)
    return ImageFont.load_default()


def stage(frame, summon=False):
    out=Image.new("RGB",(352,268),"#142031")
    d=ImageDraw.Draw(out)
    d.rectangle((0,211,351,267),fill="#24374a")
    d.line((10,211,342,211),fill="#496375")
    center = 98 if summon else 176
    d.ellipse((center-47,207,center+46,219),fill="#172534")
    enemy=Image.open(ROOT/"public/assets/generated/pixel-enemies/golem.png").convert("RGBA")
    cell=enemy.height//3
    enemy=enemy.crop((0,0,cell,cell)).resize((cell*2,cell*2),Image.Resampling.NEAREST)
    out.paste(enemy,(center-cell,211-cell*2),enemy)
    sprite=frame.resize((256,256),Image.Resampling.NEAREST)
    out.paste(sprite,(82 if summon else 48,8),sprite)
    return out


def comparison(spell, frames):
    key,title,subtitle,pal,_,baseline=spell
    old=Image.open(ROOT/f"public/assets/generated/pixel-fx/{baseline}.png").convert("RGBA")
    oldsize=old.height;oldcount=old.width//oldsize
    result=[]
    for tick in range(40):
        out=Image.new("RGB",(744,330),"#101926");d=ImageDraw.Draw(out)
        d.text((18,10),title,font=font(22),fill="#f1e5bf")
        d.text((18,46),f"현재 · {oldsize}px / {oldcount}칸",font=font(14),fill="#9eb0c5")
        d.text((388,46),"시안 · 128px / 24칸",font=font(14),fill="#9eb0c5")
        left=Image.new("RGB",(352,250),"#142031");ld=ImageDraw.Draw(left)
        ld.rectangle((0,199,351,249),fill="#24374a");ld.line((10,199,342,199),fill="#496375")
        if baseline != "monk_dragon_aura":
            enemy=Image.open(ROOT/"public/assets/generated/pixel-enemies/golem.png").convert("RGBA")
            cell=enemy.height//3;enemy=enemy.crop((0,0,cell,cell)).resize((cell*2,cell*2),Image.Resampling.NEAREST)
            left.paste(enemy,(176-cell,199-cell*2),enemy)
        active=tick-4
        if 0<=active<oldcount:
            crop=old.crop((active*oldsize,0,(active+1)*oldsize,oldsize)).resize((oldsize*2,oldsize*2),Image.Resampling.NEAREST)
            left.paste(crop,(176-oldsize,199-oldsize*2+22),crop)
        blank=Image.new("RGBA",(128,128))
        right=stage(frames[active] if 0<=active<COUNT else blank,baseline=="monk_dragon_aura").crop((0,12,352,262))
        out.paste(left,(18,70));out.paste(right,(388,70))
        result.append(out)
    path=HERE/f"{key}-comparison.gif"
    result[0].save(path,save_all=True,append_images=result[1:],duration=STEP,loop=0,disposal=2,optimize=False)


def main():
    (HERE/"sheets").mkdir(exist_ok=True)
    manifest=[];built=[]
    for spell in SPELLS:
        key,title,subtitle,pal,draw,_=spell
        frames=draw_frames(pal,draw);built.append(frames)
        strip=Image.new("RGBA",(SIZE*COUNT,SIZE))
        for i,frame in enumerate(frames):strip.paste(frame,(i*SIZE,0))
        path=HERE/"sheets"/f"{key}.png";strip.save(path,optimize=True)
        pixels = strip.get_flattened_data() if hasattr(strip, "get_flattened_data") else strip.getdata()
        colors=set(pixels);opaque={v[:3] for v in colors if v[3]}
        alpha={v[3] for v in colors}
        if len(opaque)>16 or not alpha<={0,255}:raise ValueError(f"Invalid pixel palette: {key}")
        manifest.append({"key":key,"name":title,"frame":SIZE,"frames":COUNT,"frameMs":STEP,
                         "opaqueColors":len(opaque),"alpha":sorted(alpha),"productRegistered":False,
                         "reviewStatus":"rejected-by-user"})
        comparison(spell,frames)
    animation=[]
    for tick in range(40):
        out=Image.new("RGB",(752,688),"#101926");d=ImageDraw.Draw(out)
        for i,spell in enumerate(SPELLS):
            key,title,subtitle,*_=spell;x=16+(i%2)*376;y=12+(i//2)*338
            d.text((x,y),title,font=font(21),fill="#f1e5bf")
            d.text((x,y+28),subtitle,font=font(13),fill="#9eb0c5")
            active=tick-4
            frame=built[i][active] if 0<=active<COUNT else Image.new("RGBA",(128,128))
            out.paste(stage(frame,i==3),(x,y+52))
        animation.append(out)
    animation[0].save(HERE/"preview.gif",save_all=True,append_images=animation[1:],duration=STEP,
                      loop=0,disposal=2,optimize=False)
    # Each panel picks its own peak; no implication that four attacks happen together.
    board=Image.new("RGB",(752,688),"#101926");d=ImageDraw.Draw(board)
    for i,spell in enumerate(SPELLS):
        x=16+(i%2)*376;y=12+(i//2)*338
        d.text((x,y),spell[1],font=font(21),fill="#f1e5bf")
        d.text((x,y+28),spell[2],font=font(13),fill="#9eb0c5")
        board.paste(stage(built[i][[9,11,13,13][i]],i==3),(x,y+52))
    board.save(HERE/"preview.png")
    (HERE/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps(manifest,ensure_ascii=False))
    print(HERE/"preview.gif")


if __name__=="__main__":main()
