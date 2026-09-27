"""Actor4 standing battle poses, authored from EasyRPG CC-BY walking pixels.

Run with Python 3 + Pillow. Only seven named pose PNGs per actor are written;
run ../build.py separately to pack sheets/boards (no manifest). The source body
is never scaled: idle/walk keep the chipset head, torso, and straight legs.
Existing first-pass weapon painters retain the attack weapons' silhouettes;
weapon colors are matched to each actor's current, unchanged attack frame.
Review evidence and the first old idle snapshots live under .omo/idle-actor4.
"""
from pathlib import Path
import importlib.util
import json
import sys
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
TOOL = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOL))
from cb_lib import ROOT, SRC_DIR, blank, place, walk_frame, validate

ROOT = Path(ROOT)
EVIDENCE = ROOT / '.omo/idle-actor4'
POSES = ('idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'guard_hit', 'weak')


def load_artist(name, relative):
    spec = importlib.util.spec_from_file_location(name, TOOL / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


FIRST5 = load_artist('actor4_standing_weapons5', 'art/rpg-zzu-cb-art5/draw.py')
FIRST6 = load_artist('actor4_standing_weapons6', 'art/rpg-zzu-cb-art6/draw.py')


def nearest(colors, wanted):
    return min(sorted(colors), key=lambda c: sum((a-b)**2 for a,b in zip(c, wanted)))


def height(image):
    b = image.getbbox()
    return b[3] - b[1]


class Standing:
    def __init__(self, n):
        self.n = n
        self.cid = f'actor4-{n}'
        self.directory = Path(SRC_DIR) / self.cid
        self.artist = FIRST5.Painter(self.cid) if n < 2 else FIRST6.Artist(n)
        source = walk_frame(self.cid, 'left', 1)
        colors = {color[:3] for _, color in source.getcolors(1152) if color[3]}
        self.ink = min(colors, key=sum)
        self.skin = [nearest(colors, c) for c in ((191,100,61),(231,160,109),(249,193,157))]
        if n < 2:
            s = self.artist.s
            self.sleeve = [s['shade'], s['cloth'], s['trim']]
        else:
            self.skin = self.artist.c['skin']
            self.sleeve = self.artist.c['sleeve']
        attack = Image.open(self.directory / 'attack.png').convert('RGBA')
        self.weapon_colors = {color[:3] for _, color in attack.getcolors(2304) if color[3]}

    def hand(self, im, p):
        x, y = p
        d = ImageDraw.Draw(im)
        d.rectangle((x-1,y-1,x+1,y+1), fill=self.ink)
        d.rectangle((x-1,y-1,x,y), fill=self.skin[1])
        d.point((x-1,y-1), fill=self.skin[2])
        d.point((x,y+1), fill=self.skin[0])

    def arm(self, im, points):
        d = ImageDraw.Draw(im)
        d.line(points, fill=self.ink, width=3)
        d.line(points, fill=self.sleeve[0], width=2)
        d.line([(x,y-1) for x,y in points], fill=self.sleeve[1], width=1)
        self.hand(im, points[-1])

    def body(self, pattern=1, weak=False, closed=False):
        source = walk_frame(self.cid, 'left', pattern)
        b = source.getbbox()
        ox, oy = 24-(b[0]+b[2])//2, 45-b[3]
        # Replace just the hanging near forearm, preserving the source torso,
        # cape, hair, hip and every leg pixel. Its shoulder stays in place.
        arm_x0, arm_x1, arm_y1, seam_x, body_x1 = {
            0: (14,20,26,12,15),
            1: (13,18,26,12,14),
            2: (11,16,27,10,14),
        }[pattern]
        for y in range(22,arm_y1):
            for x in range(arm_x0,arm_x1):
                color = source.getpixel((x,y))
                if not color[3]:
                    continue
                source.putpixel((x,y), source.getpixel((seam_x,y)) if x <= body_x1 else (0,0,0,0))
        if closed:
            # Visible eye is chipset x8..10, y14..16. Keep nose/hair intact.
            d = ImageDraw.Draw(source)
            d.rectangle((8,14,10,16), fill=self.skin[1])
            d.line([(8,14),(10,15),(8,16)], fill=self.ink)
        im = blank()
        im.alpha_composite(source, (ox,oy))
        if weak:
            bent = blank()
            for y in range(48):
                dx, dy = (-2,2) if y < 33 else ((-1,1) if y < 39 else (0,0))
                for x in range(48):
                    c = im.getpixel((x,y))
                    if c[3]:
                        bent.putpixel((x+dx,y+dy), c)
            im = bent
        return im, (ox+14,oy+20)

    def weapon(self, im, hand, defend=False):
        layer = blank()
        if self.n < 2:
            tip = (hand[0]-8,hand[1]-11) if not defend else (hand[0]-5,hand[1]-13)
            self.artist.weapon(layer,hand,tip,kind='dagger' if self.n == 0 else 'sword')
        else:
            direction = ((-.55,-1) if self.n in (2,5) else (-.30,-1)) if not defend else (-.75,-1)
            length = 13 if self.n in (2,5) else 11
            self.artist.weapon(layer,hand,direction,length=length)
        for y in range(48):
            for x in range(48):
                c = layer.getpixel((x,y))
                if c[3]:
                    layer.putpixel((x,y), nearest(self.weapon_colors,c[:3])+(255,))
        im.alpha_composite(layer)
        self.hand(im,hand)

    def ready(self, pattern=1, defend=False, closed=False):
        im, shoulder = self.body(pattern, closed=closed)
        original = im.copy()
        hand = (16,32) if defend else (16,35)
        elbow = (24,35) if defend else (25,37)
        self.arm(im,[shoulder,elbow,hand])
        self.weapon(im,hand,defend)
        if self.n == 5:
            # Keep the attack's green shield, on the far arm in front of torso.
            layer = blank()
            self.artist.shield(layer,(16,37))
            im.alpha_composite(layer)
        # Keep the source face/scarf in front of the hilt, and feet in
        # front of the resting staff butt during walking.
        source_feet = place(walk_frame(self.cid,'left',pattern))
        for y in list(range(33)) + list(range(40,45)):
            for x in range(48):
                c = (source_feet if y >= 40 else original).getpixel((x,y))
                if c[3]:
                    im.putpixel((x,y),c)
        return im

    def weak(self):
        im, shoulder = self.body(weak=True,closed=True)
        self.arm(im,[(19,35),(17,37),(16,37)])
        self.weapon(im,(16,37))
        self.arm(im,[(shoulder[0]-1,shoulder[1]+1),(25,38),(22,40)])
        return im

    def poses(self):
        defend = self.ready(defend=True)
        guard = blank()
        guard.alpha_composite(self.ready(defend=True,closed=True),(2,0))
        return dict(idle=self.ready(),walk_a=self.ready(0),walk_b=self.ready(1),
                    walk_c=self.ready(2),defend=defend,guard_hit=guard,weak=self.weak())


def comparison(actors):
    names = ('old idle','new idle','walk_a','walk_b','walk_c','defend','weak')
    out = Image.new('RGB',(192*7,206*8),(43,47,59))
    draw = ImageDraw.Draw(out)
    for row,(cid,poses) in enumerate(actors.items()):
        old = Image.open(EVIDENCE/f'{cid}-old.png').convert('RGBA')
        cells = [old]+[poses[k] for k in ('idle','walk_a','walk_b','walk_c','defend','weak')]
        for col,(name,im) in enumerate(zip(names,cells)):
            x,y=col*192,row*206
            draw.text((x+4,y+1),f'{cid} {name}',fill=(235,236,242))
            draw.line((x,y+14+180,x+191,y+14+180),fill=(105,83,79))
            big=im.resize((192,192),Image.Resampling.NEAREST)
            out.paste(big,(x,y+14),big)
    out.save(EVIDENCE/'compare.png')


def main():
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    actors, report = {}, {}
    for n in range(8):
        artist = Standing(n)
        cid = artist.cid
        old = EVIDENCE/f'{cid}-old.png'
        if not old.exists():
            Image.open(artist.directory/'idle.png').save(old)
        poses = artist.poses()
        chip_height=height(walk_frame(cid,'left',1))
        report[cid]={'chip':chip_height,'poses':{p:height(im) for p,im in poses.items()}}
        for p, im in poses.items():
            assert not validate(cid,p,im),(cid,p,validate(cid,p,im))
            assert im.getbbox()[3] == 45,(cid,p,'ground')
            if p in ('idle','walk_a','walk_b','walk_c'):
                assert abs(height(im)-chip_height)<=1,(cid,p,'height')
            elif p in ('defend','guard_hit'):
                assert height(im)>=chip_height-2,(cid,p,'height')
            else:
                assert height(im)>=chip_height-4,(cid,p,'height')
            im.save(artist.directory/f'{p}.png',optimize=True)
        # Compare exact feet/legs with each corresponding walking source.
        for p,pattern in (('idle',1),('walk_a',0),('walk_b',1),('walk_c',2)):
            original = place(walk_frame(cid,'left',pattern))
            assert all(poses[p].getpixel((x,y))==original.getpixel((x,y)) for y in range(40,45) for x in range(48) if original.getpixel((x,y))[3]),(cid,p,'legs')
        actors[cid]=poses
        print(f"{cid}: chip={chip_height}px | " + ' | '.join(f'{p}={height(im)}/{chip_height}' for p,im in poses.items()))
    comparison(actors)
    (EVIDENCE/'heights.json').write_text(json.dumps(report,indent=2)+'\n')


if __name__ == '__main__':
    main()
