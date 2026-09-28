"""Restore upright Actor2 battlers from EasyRPG CC-BY Actor2.png.

Python 3 + Pillow only. Run from any directory; writes seven poses per actor.
The 24x32 left walking pixels remain 1:1: only the near arm and held weapon
are repainted. Weak bends the upper body by integer row offsets, keeping feet.
Existing attack/cast/victory/dead poses and the manifest are never generated.
Build sheets separately with ../build.py actor2-0 ... actor2-7 (no --manifest).
Evidence lives in .omo/idle-actor2; --review writes the requested 4x comparison.
"""
from pathlib import Path
import argparse
import math
import sys
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
LIB = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(LIB))
from cb_lib import ROOT, SRC_DIR, blank, palette, place, validate, walk_frame

IDS = [f'actor2-{i}' for i in range(8)]
POSES = ('idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'guard_hit', 'weak')
EVIDENCE = Path(ROOT) / '.omo/idle-actor2'
# Weapon kinds match the shipped attack frames, not a guessed class loadout.
KINDS = ('dagger', 'dagger', 'bow', 'bow', 'sword', 'dagger', 'bow', 'bow')
# Source-coordinate eyes and sleeve swatches, read from the walking atlas.
EYES = ((8, 14), (8, 15), (9, 15), (9, 15), (9, 14), (9, 16), (9, 16), (9, 15))
CLOTH = ((64, 65, 64), (55, 109, 115), (9, 103, 55), (21, 121, 74),
         (158, 74, 22), (143, 17, 33), (90, 87, 94), (95, 132, 117))
LIGHT = ((113, 111, 109), (120, 192, 191), (31, 140, 68), (167, 183, 180),
         (222, 141, 44), (220, 45, 66), (209, 205, 198), (167, 183, 180))


def rgba(c):
    return tuple(c[:3]) + (255,)


def stroke(im, pts, color, width=1):
    """Integer pixels, square nib, no resampling or antialiasing."""
    for a, b in zip(pts, pts[1:]):
        count = max(abs(b[0]-a[0]), abs(b[1]-a[1]), 1)
        for step in range(count+1):
            x = round(a[0]+(b[0]-a[0])*step/count)
            y = round(a[1]+(b[1]-a[1])*step/count)
            for oy in range(-(width//2), width-width//2):
                for ox in range(-(width//2), width-width//2):
                    assert 0 <= x+ox < 48 and 0 <= y+oy < 48
                    im.putpixel((x+ox, y+oy), rgba(color))


def height(im):
    b = im.getbbox()
    return b[3]-b[1]


class Artist:
    def __init__(self, cid):
        self.cid = cid
        self.idx = int(cid[-1])
        self.kind = KINDS[self.idx]
        self.colors = palette(cid)
        self.outline = min(self.colors, key=sum)
        self.cloth = self.near(CLOTH[self.idx])
        self.light = self.near(LIGHT[self.idx])
        self.skin = self.near((231, 160, 109))
        self.skinshade = self.near((191, 100, 61))
        # Keep the original attack weapon's color family. Later art revisions
        # remapped 2..7 weapons into the actor palette; 0/1 use these metal colors.
        self.wood, self.gold, self.metal, self.edge = (
            ((113,69,39), (209,158,71), (190,213,223), (242,250,246))
            if self.idx < 2 else tuple(self.near(c) for c in
                ((101,61,31), (198,143,65), (111,145,169), (232,244,250))))

    def near(self, color):
        return min(self.colors, key=lambda p: sum((a-b)**2 for a,b in zip(p,color)))

    def source(self, pattern):
        f = walk_frame(self.cid, 'left', pattern)
        b = f.getbbox()
        return f, (24-(b[0]+b[2])//2, 45-b[3])

    def body(self, pattern, weak=False, closed=False):
        f, (ox, oy) = self.source(pattern)
        # Replace only the lowered near arm. The coat, hair/scarf behind it,
        # hips and complete walking legs remain source pixels.
        bob = 0 if pattern == 1 else 1
        for y in range(21+bob, 26):
            for x in range(13, 17):
                if f.getpixel((x,y))[3]:
                    sample = f.getpixel((12,y))
                    f.putpixel((x,y), sample if x < 15 else (0,0,0,0))
        # Visual revision: pattern 0 swings the old wrist behind the body;
        # keep hair pixels above it but remove the duplicate exposed hand.
        if pattern == 0 and self.idx in (0,1,5):
            for y in range(23,26):
                for x in range(15,18):
                    f.putpixel((x,y),(0,0,0,0))
        if pattern == 2 and self.idx == 4:
            for y in range(22,26):
                f.putpixel((17,y),(0,0,0,0))
        if closed:
            ex, ey = EYES[self.idx]
            for y in range(ey, ey+3):
                for x in range(ex, ex+3):
                    if f.getpixel((x,y))[3]:
                        f.putpixel((x,y), rgba(self.skin))
            for x,y in ((ex,ey+1),(ex+1,ey+2),(ex+2,ey+1)):
                f.putpixel((x,y), rgba(self.outline))
        if not weak:
            out = blank()
            out.alpha_composite(f, (ox,oy))
            return out
        # Slight forward bow from the waist. No leg shortening, spreading or
        # kneeling: rows 26..31 (knees/boots) remain in their original locations.
        out = blank()
        for y in range(32):
            dx = -2 if y < 20 else -1 if y < 24 else 0
            dy = 2 if y < 20 else 1 if y < 24 else 0
            out.alpha_composite(f.crop((0,y,24,y+1)), (ox+dx,oy+y+dy))
        return out

    def hand(self, im, p):
        x,y = p
        for dx,dy,c in ((-1,-1,self.outline),(0,-1,self.skin),
                        (1,-1,self.skinshade),(-1,0,self.skinshade),
                        (0,0,self.skin),(1,0,self.skinshade),(0,1,self.outline)):
            im.putpixel((x+dx,y+dy), rgba(c))

    def arm(self, im, shoulder, elbow, hand):
        stroke(im, [shoulder,elbow,hand], self.outline, 3)
        stroke(im, [shoulder,elbow], self.cloth, 2)
        stroke(im, [(shoulder[0]-1,shoulder[1]),(elbow[0]-1,elbow[1])], self.light)
        # Long sleeves on 0/1/7; others have exposed forearms.
        stroke(im, [elbow,hand], self.cloth if self.idx in (0,1,7) else self.skinshade, 2)
        stroke(im, [(elbow[0],elbow[1]-1),(hand[0],hand[1]-1)],
               self.light if self.idx in (0,1,7) else self.skin)

    def weapon(self, im, grip, guarding=False, lowered=False):
        x,y = grip
        if self.kind == 'bow':
            # Grip is ON the wood, with the string behind (right of) the fist.
            # Same recurved wooden bow as attack, with no nocked arrow at rest.
            slope = -0.35 if guarding else 0.5
            def at(u,v): return (round(x+u+slope*v),y+v)
            pts = [at(5,-9),at(2,-7),at(0,-3),at(0,3),at(2,7),at(5,9)]
            stroke(im, pts, self.outline, 3)
            stroke(im, pts, self.wood, 2)
            stroke(im, [(a-1,b) for a,b in pts], self.gold)
            stroke(im, [pts[0],pts[-1]], self.edge)
            stroke(im, [at(0,-2),at(0,2)], self.wood, 2)
            return
        dx,dy = (-0.55,-1) if guarding else (-1,0.18) if lowered else (-1,-0.65)
        length = 16 if self.kind == 'sword' else 10
        norm = math.hypot(dx,dy)
        ux,uy = dx/norm,dy/norm
        def at(t,n=0):return (round(x+ux*t-uy*n),round(y+uy*t+ux*n))
        stroke(im,[at(-3),at(length)],self.outline,3)
        stroke(im,[at(-2),at(0)],self.wood)
        stroke(im,[at(3),at(length-1)],self.metal,2)
        stroke(im,[at(3,-1),at(length)],self.edge)
        stroke(im,[at(2,-2),at(2,2)],self.gold)

    def make(self, pose):
        if pose == 'guard_hit':
            im = self.make('defend')
            # Same guard pixels plus precisely 2px horizontal recoil; only the
            # eye patch differs, using the original atlas eye coordinates.
            _, (ox,oy) = self.source(1)
            ex,ey = EYES[self.idx]
            for y in range(ey,ey+3):
                for x in range(ex,ex+3):
                    if im.getpixel((ox+x,oy+y))[3]:
                        im.putpixel((ox+x,oy+y),rgba(self.skin))
            for x,y in ((ex,ey+1),(ex+1,ey+2),(ex+2,ey+1)):
                im.putpixel((ox+x,oy+y),rgba(self.outline))
            out=blank();out.alpha_composite(im,(2,0));return out
        pattern = 'abc'.index(pose[-1]) if pose.startswith('walk_') else 1
        _, (ox,oy) = self.source(pattern)
        bob = 0 if pattern == 1 else 1
        weak = pose == 'weak'
        im = self.body(pattern,weak=weak)
        if weak:
            # Lower hand lies on the front knee. Weapon is held by the far arm.
            grip=(ox+(5 if self.kind=='sword' else 0 if self.kind=='bow' else 3),oy+(20 if self.kind=='bow' else 22))
            self.arm(im,(ox+8,oy+21),(ox+6,oy+23),grip)
            self.weapon(im,grip,lowered=True)
            self.hand(im,grip)
            knee=(ox+10,oy+27)
            self.arm(im,(ox+12,oy+22),(ox+12,oy+25),knee)
            self.hand(im,knee)
        else:
            guarding = pose == 'defend'
            grip=(ox+(2 if guarding else 1),oy+(19 if guarding else 20)) if self.kind=='bow' else (ox+5,oy+(21 if guarding else 22)+bob)
            self.arm(im,(ox+14,oy+20+bob),(ox+13,oy+23+bob),grip)
            self.weapon(im,grip,guarding=guarding)
            self.hand(im,grip)
        return im


def review():
    names=('old idle','idle','walk_a','walk_b','walk_c','defend','weak')
    out=Image.new('RGB',(7*192,8*212),(42,46,57))
    d=ImageDraw.Draw(out)
    for i,cid in enumerate(IDS):
        for j,name in enumerate(names):
            p=EVIDENCE/f'{cid}-old-idle.png' if j==0 else Path(SRC_DIR)/cid/f'{name}.png'
            im=Image.open(p).convert('RGBA').resize((192,192),Image.Resampling.NEAREST)
            x,y=j*192,i*212
            d.rectangle((x,y+20,x+191,y+211),fill=(58,62,74) if j%2 else (48,52,64))
            out.paste(im,(x,y+20),im)
            d.text((x+4,y+3),f'{cid} {name}',fill=(236,236,242))
            d.line((x,y+200,x+191,y+200),fill=(115,76,72))
    out.save(EVIDENCE/'compare.png')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review',action='store_true')
    args=parser.parse_args()
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    print('character   chip  idle walk_a walk_b walk_c defend weak (opaque bbox height px)')
    for cid in IDS:
        a=Artist(cid)
        old=EVIDENCE/f'{cid}-old-idle.png'
        if not old.exists():
            Image.open(Path(SRC_DIR)/cid/'idle.png').save(old)
        frames={p:a.make(p) for p in POSES}
        chip_height=height(walk_frame(cid,'left',1))
        for pose,im in frames.items():
            assert not validate(cid,pose,im), (cid,pose,validate(cid,pose,im))
            assert im.getbbox()[3]-1==44, (cid,pose,'ground')
            if pose in ('idle','walk_b'):assert abs(height(im)-chip_height)<=1
            if pose.startswith('walk_'):
                source=place(walk_frame(cid,'left','abc'.index(pose[-1])))
                # Whole lower body, including foot separation, is untouched.
                body=a.body('abc'.index(pose[-1]))
                assert body.crop((0,40,48,48)).tobytes()==source.crop((0,40,48,48)).tobytes()
            if pose in ('defend','guard_hit'):assert height(im)>=chip_height-2
            if pose=='weak':assert height(im)>=chip_height-4
            im.save(Path(SRC_DIR)/cid/f'{pose}.png',optimize=True)
        print(f'{cid:10} {chip_height:4}',*(f'{height(frames[p]):6}' for p in
              ('idle','walk_a','walk_b','walk_c','defend','weak')))
    if args.review:review()


if __name__=='__main__':main()
