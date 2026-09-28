"""담당 다섯 명의 관절 시전 도트. 전체 이미지 회전/확대 없이 원본 부위를 쓴다."""
from pathlib import Path
import hashlib
import importlib.util
import json
import math
import sys
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
BASE = HERE.parents[1]
sys.path.insert(0, str(BASE))
from cb_lib import CAST_TYPES, POSES, SRC_DIR, blank, palette, place, validate, walk_frame

spec = importlib.util.spec_from_file_location('first_artist', BASE / 'art/rpg-zzu-cb-art4/draw.py')
old = importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)
spec3 = importlib.util.spec_from_file_location('first_elf_artist', BASE / 'art/rpg-zzu-cb-art3/paint.py')
elf = importlib.util.module_from_spec(spec3)
spec3.loader.exec_module(elf)

IDS = ['actor2-6', 'actor2-7', 'actor3-1', 'actor3-2', 'actor3-3']
# 캐릭터 전체 45칸에서 추가색의 합집합도 여섯 색 이하로 제한한다.
# 무기는 원본 캐릭터의 금속/갈색/흰색, 화염은 원본의 주황/붉은 피부 음영을 쓴다.
EXTRA = [(128, 218, 255), (255, 232, 76), (144, 237, 112),
         (172, 103, 214), (66, 218, 196), (247, 148, 210)]
old.PROFILES['actor2-6'] = dict(kind='bow', cloth=[(0,66,51),(21,121,74),(54,154,77)],
    skin=[(191,100,61),(231,160,109),(249,193,157)], boot=(49,24,0), trim=(209,205,198), eye=(9,16))

# 어깨와 골반은 몸통을 따라가지만 손끝·팔꿈치·무릎·발은 각각 따로 찍는다.
# far는 무기를 쥔 손, near는 마법을 쓰는 손이다. 빛은 near 손의 바로 옆에만 찍는다.
# 각 값: 중심, 내려앉음, 상체 비틀기, 뒤팔(팔꿈치/손), 앞팔, 발 간격, 앞무릎 굽힘.
GESTURES = {
 'fire': [
  (25,1,1, ((30,36),(32,33)), ((29,37),(34,35)), (22,30), 1),
  (24,1,-1,((18,36),(19,32)), ((24,37),(20,33)), (20,30), 2),
  (23,1,-2,((18,34),(13,32)), ((18,36),(12,34)), (14,32), 2)],
 'ice': [
  (24,0,0, ((18,34),(28,29)), ((28,35),(19,30)), (20,28), 0),
  (24,0,0, ((30,33),(33,34)), ((19,28),(15,22)), (18,31), 1),
  (24,0,-1,((18,34),(13,30)), ((25,26),(23,19)), (18,30), 0)],
 'thunder': [
  (25,4,1, ((20,38),(18,34)), ((33,37),(35,30)), (18,32), 3),
  (24,0,0, ((20,35),(17,34)), ((27,26),(28,19)), (20,29), 0),
  (23,3,-3,((29,37),(31,33)), ((18,34),(12,40)), (14,32), 3)],
 'heal': [
  (24,2,-1,((18,36),(19,32)), ((25,37),(20,33)), (22,27), 1),
  (24,0,0, ((30,28),(33,24)), ((19,28),(14,24)), (21,28), 0),
  (24,0,-1,((29,37),(31,33)), ((20,34),(13,30)), (20,28), 0)],
 'dark': [
  (24,4,-2,((30,38),(32,34)), ((20,37),(18,29)), (18,31), 3),
  (25,2,2, ((20,37),(18,34)), ((32,32),(36,25)), (20,33), 2),
  (23,3,-3,((28,38),(32,34)), ((18,33),(11,31)), (14,32), 3)],
 'arcane': [
  (24,0,0, ((28,37),(31,34)), ((19,33),(17,25)), (21,28), 0),
  (24,0,-1,((29,36),(32,34)), ((28,26),(24,20)), (19,30), 1),
  (24,0,-1,((29,37),(32,34)), ((19,33),(11,33)), (18,30), 1)],
 'support': [
  (24,0,0, ((29,37),(32,34)), ((25,31),(22,26)), (22,28), 0),
  (24,1,-1,((29,36),(32,33)), ((18,34),(10,35)), (19,30), 1),
  (24,1,-1,((29,37),(32,34)), ((23,37),(17,31)), (22,28), 1)],
}

def nearest(c, colors):
    return min(colors, key=lambda p: sum((a-b)**2 for a,b in zip(c,p)))

def recolor(im, colors):
    out = im.copy()
    table = {c: (*nearest(c[:3],colors),255) for c in set(im.getdata()) if c[3]}
    out.putdata([table[c] if c[3] else (0,0,0,0) for c in im.getdata()])
    return out

class Artist(old.Artist):
    def __init__(self, cid):
        super().__init__(cid)
        self.pal = palette(cid)

    def arm(self, im, shoulder, elbow, hand, far=False, bare=False):
        super().arm(im,shoulder,elbow,hand,far,bare)
        if self.cid == 'actor2-6':
            old.line(im,elbow,hand,self.skin0 if far else self.skin1,2)
            self.hand(im,hand,far)

    def held(self, im, hand, direction=(0,-1), angle=0):
        if self.p['kind'] != 'bow':
            # 셀 가장자리에서도 칼끝과 외곽선이 잘리지 않도록 단축 투영한다.
            length=14 if self.p['kind']=='sword' else 8
            magnitude=math.hypot(*direction)
            for coord,component,low,high in zip(hand,direction,(2,2),(45,43)):
                component/=magnitude
                if component:
                    limit=(high-coord)/component if component>0 else (low-coord)/component
                    length=min(length,math.floor(limit))
            self.weapon(im,hand,direction,length)
            return
        # 원본 무기 시트의 휜 활 모양. 화살은 만들지 않고 손목에 맞춰 활만 다시 찍는다.
        x,y=hand
        c,s=math.cos(angle),math.sin(angle)
        def at(u,v): return (round(x+u*c-v*s),round(y+u*s+v*c))
        pts=[at(3,-9),at(0,-7),at(-2,-3),at(-2,3),at(0,7),at(3,9)]
        old.polyline(im,pts,self.outline,3)
        old.polyline(im,pts,nearest((135,90,51),self.pal))
        for p in pts[1:-1]: old.px(im,*p,nearest((216,173,80),self.pal))
        old.line(im,pts[0],pts[-1],nearest((209,218,219),self.pal))
        # 활 손잡이를 손바닥과 연결한다.
        old.line(im,at(-2,0),hand,self.dark,2)
        self.hand(im,hand)

    def cast(self, kind, step):
        cx,dy,lean,far,near,feet,bend=GESTURES[kind][step-1]
        # 닌자는 짧은 자세, 검객은 넓은 뒷발로 캐릭터의 무게를 구분한다.
        front,rear=feet
        if self.p['kind']=='dagger' and kind in ('dark','thunder'):
            front-=1
        legs=[((cx+2,38+dy),(cx+4+bend,41),(rear,44)),
              ((cx-1,38+dy),(front+2,40+bend//2),(front,44))]
        im=blank()
        self.body(im,cx,dy,lean,legs,kind=='heal' and step==1,far,near)
        # 한손 무기를 계속 쥔다. 두 손이 모이는 시전은 손등을 포개고 빈 손바닥으로 빛을 낸다.
        direction=(0,-1)
        if kind=='fire' and step==1:direction=(1,-1)
        if kind=='fire' and step==3:direction=(-1,-.4)
        if kind=='ice' and step==2:direction=(1,0)
        if kind=='heal' and step==2:direction=(.3,-1)
        angle=0
        if kind=='ice' and step==2: angle=-.8
        if kind=='fire' and step==1:angle=-.35
        self.held(im,far[1],direction,angle)
        # 교차한 팔과 펼친 손은 가장 앞쪽에 다시 찍는다.
        self.arm(im,(cx+1+lean,33+dy),near[0],near[1])
        hx,hy=near[1]
        if kind=='dark' and step==3:
            for yy in (-2,0,2):
                old.line(im,(hx-1,hy+yy),(hx-3,hy+yy),self.skin1)
                old.px(im,hx-3,hy+yy+1,self.skin0)
        if kind=='ice' and step==3:
            for xx in (-2,0,2):old.line(im,(hx+xx,hy),(hx+xx,hy-2),self.skin2)
        if kind=='support' and step in (1,3):
            old.line(im,(hx-2,hy),(hx+1,hy),self.skin2)
        if kind=='fire' and step==3:
            old.line(im,(hx-1,hy-2),(hx-1,hy+1),self.skin2)
            old.line(im,(hx+1,hy-1),(hx+1,hy+1),self.skin1)
        if kind=='heal' and step==3:
            old.line(im,(hx-3,hy),(hx,hy),self.skin2)
        im=recolor(im,self.pal)
        # 속성 빛은 손 바로 옆의 3~9픽셀. 먼 입자·탄도·잔상은 없다.
        colors={
          'fire':(nearest((230,101,35),self.pal),nearest((175,40,36),self.pal)),
          'ice':(EXTRA[0],(255,255,255)), 'thunder':(EXTRA[1],(255,255,255)),
          'heal':(EXTRA[2],(255,255,255)), 'dark':(EXTRA[3],self.outline),
          'arcane':(EXTRA[4],(255,255,255)), 'support':(EXTRA[5],EXTRA[3]),
        }
        primary,light=colors[kind]
        gx,gy=hx-2,hy-2
        if kind in ('ice','thunder') and step==2:gx,gy=hx,hy-3
        if kind=='ice' and step==3:gx,gy=hx,hy-4
        if kind=='dark' and step==3:gx,gy=hx-4,hy-1
        marks=[(0,0),(-1,0),(0,-1)]
        if step>=2:marks += [(1,0),(0,1)]
        if step==3:marks += [(-2,0),(2,0),(0,-2),(0,2)]
        for i,(x,y) in enumerate(marks):old.px(im,gx+x,gy+y,light if i==0 else primary)
        return im, dict(hand=near[1],light=[(gx+x,gy+y) for x,y in marks],weaponHand=far[1])

    def close_bow_attack(self, pose):
        # 이동은 런타임 소유. 이 칸들은 제자리에서 활 몸체로 앞을 치는 근접 타격이다.
        data={
          'attack_windup':(25,0,1,((30,31),(32,29)),((26,34),(27,32)),(21,32),-.6),
          'attack_strike':(24,0,-1,((22,29),(17,26)),((22,33),(19,29)),(17,32),-.8),
          'attack':(23,1,-2,((17,34),(10,32)),((19,36),(13,34)),(14,32),-.3),
          'attack_follow':(23,2,-2,((19,36),(14,35)),((22,37),(18,36)),(16,31),-1.1),
        }
        cx,dy,lean,near,far,feet,angle=data[pose]
        legs=[((cx+2,38+dy),(cx+6,41),(feet[1],44)),((cx-1,38+dy),(feet[0]+3,41),(feet[0],44))]
        im=blank()
        self.body(im,cx,dy,lean,legs,False,far,near)
        self.held(im,near[1],angle=angle)
        return im

    def battle(self, pose, casts):
        if pose in ('cast_charge','cast_raise','cast_release'):
            return casts[('arcane', ('cast_charge','cast_raise','cast_release').index(pose)+1)]
        if self.p['kind']=='bow' and pose in ('attack_windup','attack_strike','attack','attack_follow'):
            im=self.close_bow_attack(pose)
        elif pose.startswith('walk_'):
            im=place(walk_frame(self.cid,'left','abc'.index(pose[-1])))
            if self.p['kind']=='bow':self.held(im,(17,34))
            else:self.weapon(im,(19,36),(-1,-1),10 if self.p['kind']=='sword' else 7)
        else:
            im=(elf.Artist(self.cid).make(pose) if self.cid=='actor2-6' else super().make(pose))
            # 물건을 쓰는 동안에도 반대 손에는 무기를 남긴다.
            if pose=='item':
                self.arm(im,(27,34),(30,36),(32,34),True)
                self.held(im,(32,34))
        return recolor(im,self.pal)

def cast_gif(out, casts):
    # 일곱 종류를 가로 한 줄에 놓고 각 종류의 세 단계를 동시에 비교한다.
    frames=[]
    for step in (1,2,3):
        fr=Image.new('RGB',(192*7,210),(43,47,59))
        dr=ImageDraw.Draw(fr)
        for col,(kind,_) in enumerate(CAST_TYPES):
            im=casts[kind,step].resize((192,192),Image.Resampling.NEAREST)
            fr.paste(im,(col*192,18),im)
            dr.text((col*192+5,3),f'{kind} {step}',fill=(236,236,240))
        frames.append(fr)
    colors=sorted(set(c for f in frames for c in f.getdata()))
    assert len(colors)<=256
    pal=Image.new('P',(1,1));pal.putpalette(sum((list(c) for c in colors),[])+[0]*(768-3*len(colors)))
    frames=[f.quantize(palette=pal,dither=Image.Dither.NONE) for f in frames]
    frames[0].save(out/'_cast.gif',save_all=True,append_images=frames[1:],duration=160,loop=0,disposal=2,optimize=False)

def main():
    for cid in sys.argv[1:] or IDS:
        assert cid in IDS, '담당 캐릭터만 저작한다'
        artist=Artist(cid);out=Path(SRC_DIR)/cid
        casts={};metadata={}
        for kind,_ in CAST_TYPES:
            for step in (1,2,3):
                im,detail=artist.cast(kind,step)
                casts[kind,step]=im
                metadata[f'cast_{kind}_{step}']=detail
        poses={pid:artist.battle(pid,casts) for pid,*_ in POSES}
        images={**poses,**{f'cast_{kind}_{step}':im for (kind,step),im in casts.items()}}
        used=set();report={}
        for name,im in images.items():
            assert not validate(cid,name,im),(cid,name,validate(cid,name,im))
            assert im.getbbox()[3]==45,(cid,name,im.getbbox())
            colors={c[:3] for c in im.getdata() if c[3]}
            used|=colors
            assert colors <= set(artist.pal)|set(EXTRA),(cid,name,colors-set(artist.pal)-set(EXTRA))
            im.save(out/(name+'.png'))
            report[name]=dict(bounds=im.getbbox(),newColors=len(colors-set(artist.pal)),sha256=hashlib.sha256(im.tobytes()).hexdigest())
        assert len(used-set(artist.pal))<=6
        cast_gif(out,casts)
        old.motion(out,poses)
        (out/'_validation.json').write_text(json.dumps(dict(character=cid,poses=report,extraColors=sorted(used-set(artist.pal)),
            allGroundY=44,alpha=[0,255],castJoints=metadata),ensure_ascii=False,indent=2)+'\n')
        print(cid, '45칸: 알파/발44/추가색 합집합',len(used-set(artist.pal)), '통과')

if __name__=='__main__':main()
