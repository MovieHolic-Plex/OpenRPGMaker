"""Standing Actor1 battlers; Python + Pillow, integer source pixels only.

Actor1.png: Marina Navarro Travesset (base), VictorSena (edit), CC BY 4.0;
see public/assets/easyrpg/AUTHORS.md. Keep the source head, torso and legs;
replace only the near arm and add the same sword/staff as the attack cell.
Weak translates upper-body rows by 1–2px, leaving both legs standing.
Run this script, then ../build.py actor1-0 ... actor1-7 (no --manifest).
Evidence and the original idle snapshots live in .omo/idle-actor1/.
"""
from pathlib import Path
import math
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from PIL import Image, ImageDraw
from cb_lib import ROOT, blank, place, walk_frame, palette, pose_path, validate

IDS = [f'actor1-{i}' for i in range(8)]
TARGETS = ['idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'guard_hit', 'weak']
EVIDENCE = Path(ROOT) / '.omo/idle-actor1'
# Cloth shadow/mid/high; picked against each source palette, never the old legs.
CLOTH = [(16,33,115), (156,0,24), (99,16,24), (115,8,24),
         (33,33,33), (156,66,0), (0,49,156), (0,49,156)]
LIGHT = [(82,115,214), (255,66,82), (213,213,213), (213,213,213),
         (99,99,99), (239,156,82), (82,156,255), (82,156,255)]
# Source-coordinate old near-forearm boxes. Hair/capes outside remain untouched.
ARM_BOX = [(13,22,17,26), (12,22,16,27), (13,23,16,27), (13,23,16,27),
           (12,22,16,26), (13,22,16,27), (12,23,16,27), (12,23,16,27)]


def rgba(c):
    return tuple(c[:3]) + (255,)


class Artist:
    def __init__(self, cid):
        self.cid = cid
        self.i = int(cid[-1])
        self.colors = palette(cid)
        self.outline = self.near((0, 0, 0))
        self.cloth = self.near(CLOTH[self.i])
        self.light = self.near(LIGHT[self.i])
        self.skin = self.near((249,193,157))
        self.skinshade = self.near((191,100,61))
        self.sword = self.i in (0, 2, 3)
        self.chip = place(walk_frame(cid, 'left', 1))
        self.top = self.chip.getbbox()[1]

    def near(self, c):
        return min(self.colors, key=lambda p: sum((p[k]-c[k])**2 for k in range(3)))

    def line(self, im, points, color, width=1):
        ImageDraw.Draw(im).line(points, fill=rgba(color), width=width)

    def dot(self, im, p, color):
        im.putpixel(p, rgba(color))

    def body(self, pattern=1):
        src = walk_frame(self.cid, 'left', pattern)
        b = src.getbbox()
        ox, oy = 24-(b[0]+b[2])//2, 45-b[3]
        im = place(src)
        # Retire the hanging near forearm; restore the compact torso underneath.
        x0,y0,x1,y1 = ARM_BOX[self.i]
        for y in range(y0,y1):
            for x in range(x0,x1):
                if src.getpixel((x,y))[3]:
                    im.putpixel((x+ox,y+oy), rgba(self.cloth) if x < x0+2 else (0,0,0,0))
        return im

    def hand(self, im, h):
        x,y = h
        d = ImageDraw.Draw(im)
        d.rectangle((x-1,y-1,x+2,y+1),fill=rgba(self.outline))
        # Swordsmen retain the source red gauntlets instead of bare hands.
        hi = self.near((255,82,90)) if self.sword else self.skin
        shade = self.near((164,24,32)) if self.sword else self.skinshade
        d.line((x,y-1,x+1,y-1),fill=rgba(hi))
        d.line((x,y,x+1,y),fill=rgba(shade))

    def arm(self, im, shoulder, elbow, hand):
        self.line(im,[shoulder,elbow,hand],self.outline,4)
        self.line(im,[shoulder,elbow,hand],self.cloth,2)
        self.line(im,[(shoulder[0],shoulder[1]-1),(elbow[0],elbow[1]-1)],self.light)
        if self.sword:
            self.line(im,[shoulder,(shoulder[0]-1,shoulder[1]+1)],self.near((189,189,189)),2)
        if self.i in (6,7):
            self.line(im,[(hand[0]+3,hand[1]-1),(hand[0]+3,hand[1]+1)],self.near((255,255,255)))
        self.hand(im,hand)

    def weapon(self, im, h, tip):
        dx,dy = tip[0]-h[0],tip[1]-h[1]
        length = math.hypot(dx,dy)
        ux,uy = dx/length,dy/length
        def p(t,n=0):
            return round(h[0]+ux*t-uy*n), round(h[1]+uy*t+ux*n)
        d = ImageDraw.Draw(im)
        if self.sword:
            # Match the current attack's straight silver blade and brown grip.
            self.line(im,[p(-3),p(3)],self.outline,3)
            self.line(im,[p(-2),p(2)],(156,82,49))
            d.polygon([p(3,-2),p(length-2,-1),tip,p(length-2,1),p(3,1)],fill=rgba(self.outline))
            self.line(im,[p(4),p(length-1)],(156,156,156),2)
            self.line(im,[p(4,-1),p(length-1,-1)],(255,255,255))
            self.line(im,[p(2,-3),p(2,3)],self.outline,3)
            self.line(im,[p(2,-2),p(2,2)],(189,107,66))
        else:
            self.line(im,[p(-4),tip],self.outline,3)
            self.line(im,[p(-3),tip],(113,69,39))
            self.line(im,[p(0),p(length-1)],(209,158,71) if self.i>=5 else (238,156,123))
            r = 2 if self.i in (1,4,5) else 1
            tx,ty = tip
            d.polygon([(tx-r-1,ty),(tx,ty-r-1),(tx+r+1,ty),(tx,ty+r+1)],fill=rgba(self.outline))
            color = (96,217,232) if self.i>=5 else (238,156,123)
            d.polygon([(tx-r,ty),(tx,ty-r),(tx+r,ty),(tx,ty+r)],fill=rgba(color))
            self.dot(im,(tx,ty-1),(172,248,236) if self.i>=5 else (255,222,189))

    def shield(self, im):
        # The two knights keep their attack-cell red/silver shield motifs.
        # A compact raised shield covers the forearm, not the standing boots.
        x,y = 18,36
        d=ImageDraw.Draw(im)
        shape = [(x-3,y-4),(x+2,y-4),(x+3,y),(x,y+4),(x-3,y)]
        if self.i==3:
            shape=[(x,y-4),(x+3,y-2),(x+2,y+2),(x,y+4),(x-3,y+1),(x-3,y-2)]
        d.polygon(shape,fill=rgba(self.outline))
        d.polygon([(x-2,y-3),(x+1,y-3),(x+2,y),(x,y+3),(x-2,y)],fill=rgba((213,213,213)))
        d.polygon([(x-1,y-2),(x+1,y-1),(x+1,y+1),(x,y+2),(x-1,y)],fill=rgba(self.near((123,8,24))))
        self.line(im,[(x,y-2),(x,y+1)],self.near((255,82,90)))
        self.line(im,[(x-1,y),(x+1,y)],self.near((255,82,90)))

    def closed_eyes(self, im):
        b = walk_frame(self.cid,'left',1).getbbox()
        ox,oy = 24-(b[0]+b[2])//2,45-b[3]
        ex,ey = [(9,15),(9,16),(8,14),(8,15),(9,15),(9,15),(9,15),(9,15)][self.i]
        for dy in range(2):
            for dx in range(2):
                self.dot(im,(ox+ex+dx,oy+ey+dy),self.skin)
        self.line(im,[(ox+ex,oy+ey),(ox+ex+1,oy+ey+1)],self.outline)

    def make(self, pose):
        pattern = 'abc'.index(pose[-1]) if pose.startswith('walk_') else 1
        im = self.body(pattern)
        if pose=='weak':
            bent = blank()
            # A small forward bow above the hips; no resizing or altered knees.
            for y in range(45):
                dx = -2 if y<34 else (-1 if y<39 else 0)
                dy = 2 if y<33 else (1 if y<38 else 0)
                bent.alpha_composite(im.crop((0,y,48,y+1)),(dx,y+dy))
            im=bent
            h=(17,37)
            self.weapon(im,h,(4,33) if self.sword else (13,29))
            self.arm(im,(22,35),(19,38),h)
            self.arm(im,(25,35),(27,38),(24,40))
        elif pose in ('defend','guard_hit'):
            h=(18,33)
            self.weapon(im,h,(11,max(self.top+3,24)))
            self.arm(im,(26,34),(24,36),h)
            if self.i in (2,3):
                self.shield(im)
            if pose=='guard_hit':
                self.closed_eyes(im)
                moved=blank(); moved.alpha_composite(im,(2,0));im=moved
        else:
            h=(18,36)
            self.weapon(im,h,(11,26))
            self.arm(im,(26,35),(25,38),h)
            # Walking hair can swing one pixel into the guard: keep it in front.
            source=place(walk_frame(self.cid,'left',pattern))
            im.alpha_composite(source.crop((0,0,48,33)),(0,0))
        return im


def height(im):
    b=im.getbbox()
    return b[3]-b[1]


def comparison():
    columns=['old idle','idle','walk_a','walk_b','walk_c','defend','weak']
    out=Image.new('RGB',(7*192,8*212),(34,38,48))
    d=ImageDraw.Draw(out)
    for row,cid in enumerate(IDS):
        for col,pose in enumerate(columns):
            x,y=col*192,row*212
            d.text((x+5,y+3),f'{cid} {pose}',fill=(238,238,244))
            for yy in range(0,192,16):
                for xx in range(0,192,16):
                    color=(53,59,72) if (xx//16+yy//16)%2 else (46,51,63)
                    d.rectangle((x+xx,y+20+yy,x+xx+15,y+20+yy+15),fill=color)
            path=EVIDENCE/f'{cid}-old-idle.png' if col==0 else Path(pose_path(cid,pose))
            im=Image.open(path).convert('RGBA').resize((192,192),Image.Resampling.NEAREST)
            out.paste(im,(x,y+20),im)
            d.line((x,y+200,x+191,y+200),fill=(165,87,83))
    out.save(EVIDENCE/'compare.png')


def main():
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    print('character  idle/chip walk_a/chip walk_b/chip walk_c/chip defend/chip weak/chip')
    for cid in IDS:
        old=EVIDENCE/f'{cid}-old-idle.png'
        if not old.exists():
            Image.open(pose_path(cid,'idle')).save(old)
        artist=Artist(cid)
        for pose in TARGETS:
            im=artist.make(pose)
            assert not validate(cid,pose,im),(cid,pose,validate(cid,pose,im))
            assert im.getbbox()[3]==45,(cid,pose,'ground')
            chip=place(walk_frame(cid,'left','abc'.index(pose[-1]) if pose.startswith('walk_') else 1))
            delta=height(im)-height(chip)
            assert (abs(delta)<=1 if pose in TARGETS[:4] else delta>=(-4 if pose=='weak' else -2)),(cid,pose,delta)
            if pose!='guard_hit':
                for y in range(42,45):
                    for x in range(48):
                        if chip.getpixel((x,y))[3]:
                            assert im.getpixel((x,y))==chip.getpixel((x,y)),(cid,pose,'source feet',x,y)
            if pose in TARGETS[:4]:
                # Weapons are outside the face. Every opaque source head pixel stays exact.
                for y in range(33):
                    for x in range(48):
                        if chip.getpixel((x,y))[3]:
                            assert im.getpixel((x,y))==chip.getpixel((x,y)),(cid,pose,'source head',x,y)
            im.save(pose_path(cid,pose),optimize=True)
        values=[]
        for pose in ['idle','walk_a','walk_b','walk_c','defend','weak']:
            pattern='abc'.index(pose[-1]) if pose.startswith('walk_') else 1
            values.append(f'{height(Image.open(pose_path(cid,pose)))}/{height(walk_frame(cid,"left",pattern))}')
        print(cid+'  '+'  '.join(values))
    comparison()


if __name__=='__main__':
    main()
