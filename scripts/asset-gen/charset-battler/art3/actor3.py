"""Actor3 upright battle poses, authored from EasyRPG Actor3.png (CC BY).

Only the seven requested poses are written. Heads, costumes and standing/walking
legs come directly from the left charset cells, at their native pixel scale.
Equipment painters are the same ones used by the existing attack cells.
Run this script, then build.py actor3-0 ... actor3-7 (without --manifest).
Review artifacts are local to .omo/idle-actor3; no project database is touched.
"""
from pathlib import Path
import importlib.util
import json
import sys

from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
LIB = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(LIB))
from cb_lib import ROOT, SRC_DIR, blank, palette, place, validate, walk_frame

ROOT = Path(ROOT)
EVIDENCE = ROOT / '.omo/idle-actor3'
POSES = ('idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'guard_hit', 'weak')
IDS = tuple(f'actor3-{i}' for i in range(8))


def module(name, relative):
    spec = importlib.util.spec_from_file_location(name, LIB / relative)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


mage = module('upright_mage', 'art2/rpg-zzu-cb2-art1/draw.py')
blade = module('upright_blade', 'art2/rpg-zzu-cb2-art4/draw.py')
nature = module('upright_nature', 'art2/rpg-zzu-cb2-art5/draw.py')
# Sleeve shadow, sleeve light, cuff. All are actual charset palette colours.
CLOTH = (
    ((61,16,35), (150,0,37), (253,199,48)),
    ((42,40,45), (67,65,70), (166,157,141)),
    ((21,22,23), (42,40,45), (115,112,102)),
    ((97,39,18), (166,66,30), (209,205,198)),
    ((19,42,13), (24,122,3), (100,163,14)),
    ((191,100,61), (231,160,109), (216,173,80)),
    ((42,40,45), (67,65,70), (253,199,48)),
    ((97,39,18), (166,66,30), (253,199,48)),
)


def height(im):
    box = im.getbbox()
    return box[3] - box[1]


class Upright:
    def __init__(self, cid):
        self.cid = cid
        self.i = int(cid[-1])
        self.colors = palette(cid)
        self.outline = min(self.colors, key=sum) + (255,)
        self.shade, self.cloth, self.cuff = [self.near(c) for c in CLOTH[self.i]]
        self.skin = self.near((249,193,157))
        self.skinshade = self.near((191,100,61))
        self.artist = (mage.Mage(cid) if self.i == 0 else
                       blade.Artist(cid) if self.i < 4 else nature.Artist(cid))

    def near(self, c):
        return min(self.colors, key=lambda p: sum((a-b)**2 for a,b in zip(c,p))) + (255,)

    def body(self, pattern=1):
        # Exact charset placement; never widen or reconstruct hips/knees/feet.
        return place(walk_frame(self.cid, 'left', pattern))

    def arm(self, im, points):
        draw = ImageDraw.Draw(im)
        draw.line(points, fill=self.outline, width=3)
        draw.line(points, fill=self.shade, width=2)
        draw.line([(x,y-1) for x,y in points], fill=self.cloth, width=1)
        x,y = points[-1]
        draw.point((x+2,y), fill=self.cuff)
        self.hand(im, (x,y))

    def hand(self, im, at):
        x,y = at
        draw = ImageDraw.Draw(im)
        draw.rectangle((x-1,y-1,x+1,y+1), fill=self.skinshade)
        draw.line((x-1,y-1,x,y-1), fill=self.skin)
        draw.point((x-1,y), fill=self.skin)

    def weapon(self, im, hand, tip):
        layer = blank()
        if self.i == 0:
            self.artist.gear(layer, hand, tip)
        elif self.i < 4:
            self.artist.held(layer, hand, (tip[0]-hand[0], tip[1]-hand[1]))
            layer = blade.recolor(layer, self.colors)
        else:
            self.artist.weapon(layer, hand, tip)
        im.alpha_composite(layer)
        self.hand(im, hand)

    def ready(self, pattern=1, guard=False):
        im = self.body(pattern)
        # Arms are held in front of the chest; knees and feet are the chip's.
        shoulder = (23,34)
        hand = (17 if guard else 18,32 if guard else 35)
        elbow = (22,34) if guard else (22,36)
        tip = (11,24) if guard else (12,25)
        if self.i in (0,4):
            tip = (12,24) if guard else (9,25)
        if self.i == 5:
            hand = (17,30) if guard else (18,33)
            elbow = (20,35)
            if guard:
                self.arm(im, ((26,34),(24,35),(22,31)))
        self.arm(im, (shoulder, elbow, hand))
        self.weapon(im, hand, tip)
        return im

    def close_eyes(self, im):
        # Coordinates are in the original 24x32 left standing cell.
        src = walk_frame(self.cid, 'left', 1)
        x0,y0,x1,y1 = src.getbbox()
        ox,oy = 24-(x0+x1)//2,45-y1
        d = ImageDraw.Draw(im)
        if self.i == 0:
            # The mage's visible eye is inside a red visor. Keep its metal rim.
            d.point((10+ox,14+oy), fill=self.cloth)
            d.line([(9+ox,14+oy),(10+ox,13+oy)], fill=self.outline)
            return
        # Only the iris/white (columns 9..10), never adjacent hair or hood.
        for y in range(14,17):
            for x in (9,10):
                if src.getpixel((x,y))[3]:
                    d.point((x+ox,y+oy), fill=self.skin)
        d.line([(8+ox,15+oy),(9+ox,16+oy),(10+ox,15+oy)], fill=self.outline)

    def weak(self):
        src = self.body()
        im = blank()
        # Bend only above the hips: head drops 2px, legs keep every source pixel.
        for y in range(45):
            dx,dy = (-2,2) if y < 36 else (-1,1) if y < 38 else (0,0)
            for x in range(48):
                c = src.getpixel((x,y))
                if c[3]:
                    im.putpixel((x+dx,y+dy), c)
        self.arm(im, ((24,36),(22,39),(23,41)))  # hand resting on knee
        # The other hand still holds the same equipment, lowered beside the leg.
        if self.i == 5:
            self.arm(im, ((21,35),(19,37),(20,38)))
        else:
            self.arm(im, ((20,36),(18,37),(16,37)))
            self.weapon(im, (16,37), (10,29))
        return im

    def poses(self):
        result = {'idle': self.ready()}
        result.update({f'walk_{p}': self.ready(i) for i,p in enumerate('abc')})
        result['defend'] = self.ready(guard=True)
        hit = result['defend'].copy()
        self.close_eyes(hit)
        result['guard_hit'] = blank()
        result['guard_hit'].alpha_composite(hit, (2,0))
        result['weak'] = self.weak()
        return result


def compare():
    columns = ('old idle', 'new idle', 'walk_a', 'walk_b', 'walk_c', 'defend', 'weak')
    cw,rh = 192,212
    out = Image.new('RGB', (cw*7,rh*8), (40,43,53))
    d = ImageDraw.Draw(out)
    for row,cid in enumerate(IDS):
        for col,label in enumerate(columns):
            path = (EVIDENCE/f'{cid}-old-idle.png' if col == 0 else
                    Path(SRC_DIR)/cid/f'{"idle" if col == 1 else label}.png')
            im = Image.open(path).convert('RGBA').resize((cw,cw), Image.Resampling.NEAREST)
            x,y = col*cw,row*rh
            d.rectangle((x,y+20,x+cw-2,y+rh-1), fill=(53,57,69))
            d.text((x+4,y+3), f'{cid} {label}', fill=(235,235,240))
            out.paste(im, (x,y+20), im)
            d.line((x,y+200,x+cw-2,y+200), fill=(118,86,87))
    out.save(EVIDENCE/'compare.png')


def main():
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    reports = {}
    for cid in IDS:
        old = EVIDENCE/f'{cid}-old-idle.png'
        if not old.exists():
            Image.open(Path(SRC_DIR)/cid/'idle.png').save(old)
        artist = Upright(cid)
        poses = artist.poses()
        chip_height = height(walk_frame(cid, 'left', 1))
        measured = {}
        for pid,im in poses.items():
            assert not validate(cid,pid,im), (cid,pid,validate(cid,pid,im))
            assert im.getbbox()[3] == 45, (cid,pid,'ground')
            measured[pid] = height(im)
            if pid == 'idle' or pid.startswith('walk_'):
                pattern = 'abc'.index(pid[-1]) if pid.startswith('walk_') else 1
                source = walk_frame(cid,'left',pattern)
                assert abs(height(im)-height(source)) <= 1, (cid,pid,'height')
                # Weapon arms may change the chest, never the source legs.
                assert im.crop((18,42,32,45)).tobytes() == place(source).crop((18,42,32,45)).tobytes()
            elif pid == 'defend':
                assert height(im) >= chip_height-2
            elif pid == 'weak':
                assert height(im) >= chip_height-4
            im.save(Path(SRC_DIR)/cid/f'{pid}.png')
        reports[cid] = {'chip':chip_height, **measured}
        print(cid, 'chip='+str(chip_height), ' '.join(f'{p}={h}' for p,h in measured.items()))
    (EVIDENCE/'heights.json').write_text(json.dumps(reports,indent=2)+'\n')
    compare()


if __name__ == '__main__':
    main()
