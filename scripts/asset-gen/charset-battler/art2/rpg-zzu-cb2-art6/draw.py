"""담당 여섯 명의 부위별 시전 도트와 무장 걷기를 다시 저작한다."""
from pathlib import Path
import importlib.util
import json
import sys
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
TOOL = HERE.parents[1]
sys.path.insert(0, str(TOOL))
from cb_lib import CAST_TYPES, POSES, SRC_DIR, blank, palette, place, walk_frame, validate
spec = importlib.util.spec_from_file_location('first_art6', TOOL/'art/rpg-zzu-cb-art6/draw.py')
old = importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)

# 여섯 추가색은 캐릭터의 전투·시전 전체를 합친 상한이다. 흰색·금색은 걷기 칩에서 고른다.
LIGHT = {'fire': (255,112,38), 'ice': (107,225,255), 'heal': (146,245,115),
         'dark': (180,106,240), 'arcane': (60,240,202), 'support': (255,156,223)}

# 상체(좌우, 높이, 어깨 비틀기, 허리 굽힘), 다리, 뒤팔(팔꿈치, 손), 앞팔, 무기손, 무기방향.
# 몸통·머리만 제자리에서 관절에 맞추고 다리·팔·손은 매 칸 따로 찍는다.
GESTURES = {
 'fire': [
  ((1,1,1,1),'wind',((32,37),(32,36)),((29,39),(30,38)),'near',(0,-1)),
  ((0,0,-1,0),'ready',((27,36),(19,33)),((20,37),(18,32)),'near',(0,-1)),
  ((-2,1,-2,1),'lunge',((19,33),(15,32)),((16,35),(12,32)),'far',(0,-1)),
 ],
 'ice': [
  ((0,1,0,1),'ready',((29,37),(19,30)),((18,37),(29,30)),'far',(0,-1)),
  ((0,-1,0,0),'wind',((32,37),(34,40)),((20,29),(16,24)),'far',(0,-1)),
  ((-1,0,-1,0),'lunge',((18,33),(14,30)),((26,28),(24,22)),'far',(-.75,-1)),
 ],
 'thunder': [
  ((1,4,1,3),'low',((25,39),(22,36)),((34,36),(37,31)),'far',(0,-1)),
  ((0,-1,0,0),'wind',((31,37),(33,37)),((27,28),(26,21)),'far',(0,-1)),
  ((-2,4,-2,3),'low',((28,39),(31,37)),((17,35),(11,40)),'far',(0,-1)),
 ],
 'heal': [
  ((0,2,-1,1),'cheer',((18,36),(19,32)),((24,37),(21,32)),'far',(0,-1)),
  ((0,-1,0,0),'cheer',((31,30),(34,26)),((20,30),(15,26)),'far',(0,-1)),
  ((-1,0,-1,0),'cheer',((29,39),(32,37)),((19,35),(13,34)),'far',(0,-1)),
 ],
 'dark': [
  ((1,4,-2,3),'low',((30,40),(33,39)),((18,36),(18,30)),'far',(0,-1)),
  ((2,2,2,2),'wind',((28,39),(24,38)),((36,32),(38,25)),'far',(0,-1)),
  ((-2,3,-2,2),'low',((28,40),(31,39)),((18,34),(12,32)),'far',(0,-1)),
 ],
 'arcane': [
  ((0,0,0,0),'ready',((29,38),(30,35)),((21,37),(17,34)),'near',(0,-1)),
  ((0,-1,0,0),'wind',((31,33),(34,29)),((26,26),(23,21)),'near',(1,-.2)),
  ((-1,0,-1,0),'lunge',((28,39),(30,36)),((21,34),(18,32)),'near',(-1,-.12)),
 ],
 'support': [
  ((0,0,0,0),'ready',((30,39),(32,37)),((19,32),(16,27)),'far',(0,-1)),
  ((1,0,1,0),'wind',((28,40),(30,38)),((35,32),(40,31)),'far',(0,-1)),
  ((-1,1,-1,1),'cheer',((29,39),(32,37)),((20,37),(16,32)),'far',(0,-1)),
 ],
}

class Artist(old.Artist):
    def __init__(self, n):
        super().__init__(n)
        self.white = old.nearest(self.colors,(255,255,255))
        self.yellow = old.nearest(self.colors,(255,224,65))

    def native(self, im):
        # 무기 금속·금장식·보석도 원본 캐릭터 팔레트로 묶어 빛 여섯 색의 여유를 확보한다.
        mapping = {rgb:old.nearest(self.colors,rgb) for rgb in
                   {p[:3] for p in im.getdata() if p[3]} if rgb not in self.colors}
        out=im.copy()
        out.putdata([mapping.get(p[:3],p[:3])+(p[3],) for p in im.getdata()])
        return out

    def fingers(self, im, p, style):
        x,y=p
        if style=='claw':
            for dy in (-2,0,2):
                old.stroke(im,[(x,y+dy),(x-3,y+dy),(x-4,y+dy+1)],self.ink)
                old.stroke(im,[(x,y+dy),(x-2,y+dy)],self.c['skin'][2])
        elif style=='palm':
            old.stroke(im,[(x-1,y-2),(x-1,y+1)],self.c['skin'][2],2)
            old.point(im,(x-2,y+1),self.c['skin'][1])
        elif style=='cup':
            old.stroke(im,[(x-3,y),(x-2,y+1),(x+1,y+1)],self.c['skin'][2])

    def cast(self, ct, step):
        upper,legs,far,near,grip,direction=GESTURES[ct][step-1]
        dx,dy,lean,sq=upper
        far_elbow,far_hand=far; elbow,hand=near
        im=blank()
        shoulder_far=(22+dx+lean,35+dy)
        shoulder_near=(27+dx+lean,35+dy)
        self.arm(im,shoulder_far,far_elbow,far_hand)
        self.legs(im,dx,40+dy-sq,legs)
        self.body(im,dx,dy,lean,sq)
        # 고개를 숙인 기도와 움츠린 저주만 얼굴을 한 픽셀 더 내려 관절에 맞춘다.
        bow=1 if ct in ('heal','dark') and step==1 else 0
        head=self.head(ct=='heal' and step==1)
        im.alpha_composite(head,(12+dx+lean,14+dy+bow))
        self.arm(im,shoulder_near,elbow,hand)
        # 교차 팔의 먼 손과 아래팔을 몸통 위에 한 번 더 놓는다.
        self.limb(im,[far_elbow,far_hand],self.c['sleeve'],3)
        self.hand(im,far_hand)
        weapon_hand=hand if grip=='near' else far_hand
        weapon_dir=direction
        if self.c['kind']=='sword':
            # 검은 한 손에 남겨 두고 반대 손으로 시전한다. 검끝은 얼굴 밖으로 뺀다.
            if ct in ('fire','ice','arcane'):
                weapon_hand=far_hand
                weapon_dir=(0,-1) if ct!='arcane' or step!=2 else (.4,-1)
        self.weapon(im,weapon_hand,weapon_dir)
        self.hand(im,weapon_hand)
        # 전사의 방패는 뒤팔에 매단 채 손가락이 손잡이 밖으로 나오게 둔다.
        if self.n==5:
            self.shield(im,(far_elbow[0]+2,min(38,far_elbow[1]+1)))
            self.hand(im,far_hand)
        free_hand=far_hand if weapon_hand==hand else hand
        if ct=='dark':self.fingers(im,free_hand,'claw')
        elif ct in ('fire','ice','heal'):self.fingers(im,free_hand,'palm')
        elif ct=='support' and step==3:self.fingers(im,free_hand,'cup')
        im=self.native(im)
        # 빛은 손 옆 1~3픽셀 범위에서만 점화하며 장거리 궤적은 만들지 않는다.
        glow=Image.new('RGBA',(48,48))
        glow_hand=weapon_hand if ct=='arcane' and self.c['kind']=='staff' else free_hand
        x,y=glow_hand
        color=self.yellow if ct=='thunder' else LIGHT[ct]
        patterns={
          'fire': [[(-2,-2)],[(-2,-2),(-3,-2),(-2,-3),(-1,-3),(-2,-4)],[(-3,-2),(-2,-2),(-2,-3),(-1,-2),(-3,-3),(-2,-4),(-1,-4)]],
          'ice': [[(-2,-2)],[(-3,-2),(-2,-3),(-2,-2),(-2,-1),(-1,-2)],[(-3,-3),(-2,-3),(-1,-3),(-2,-4),(-2,-2),(-3,-4),(-1,-2)]],
          'thunder': [[(-1,-3)],[(-1,-3),(0,-4),(0,-3),(-1,-2),(-2,-2),(-2,-1)],[(-2,2),(-3,2),(-3,3),(-4,3),(-3,1)]],
          'heal': [[(-2,-2)],[(-2,-2),(-3,-2),(-1,-2),(-2,-3),(-2,-1)],[(-3,-1),(-2,-2),(-2,-1),(-2,0),(-1,-1)]],
          'dark': [[(-3,-3)],[(-3,-2),(-2,-3),(-1,-2),(-2,-1)],[(-4,-3),(-3,-3),(-4,-1),(-3,-1),(-4,1),(-3,1)]],
          'arcane': [[(-2,-3)],[(-2,-3),(-3,-2),(-1,-2),(-2,-1)],[(-3,-2),(-2,-3),(-2,-2),(-2,-1),(-1,-2)]],
          'support': [[(-2,-2)],[(-2,-2),(-1,-3),(-3,-3)],[(-3,-2),(-2,-3),(-1,-2),(-3,0),(-2,0)]],
        }
        offsets=patterns[ct][step-1]
        accent={'fire':old.nearest(self.colors,(220,45,32)), 'dark':self.ink,
                'support':LIGHT['dark']}.get(ct,self.white)
        for i,(ox,oy) in enumerate(offsets):
            old.point(glow,(x+ox,y+oy),accent if i==len(offsets)//2 and len(offsets)>1 else color)
        im.alpha_composite(glow)
        # 무기·손 좌표와 빛의 실제 픽셀은 재현 가능한 감사 근거로 남긴다.
        return im,dict(weapon_hand=weapon_hand,free_hand=free_hand,glow_hand=glow_hand,glow_pixels=sum(p[3]>0 for p in glow.getdata()))

    def walking(self, index):
        # 발·골반의 원본 세 걸음은 그대로 두고, 내려놓은 팔만 지우고 무장한 팔을 다시 찍는다.
        im=place(walk_frame(self.cid,'left',index))
        # 원본 뒤팔은 몸통 뒤쪽의 피부색 칸이다. 새 소매가 덮이는 영역만 정리한다.
        for y in range(33,40):
            for x in range(28,35):
                if im.getpixel((x,y))[:3] in self.c['skin']:
                    im.putpixel((x,y),(0,0,0,0))
        hand=[(19,35),(20,34),(21,35)][index]
        elbow=[(25,38),(26,37),(26,39)][index]
        self.arm(im,(27,34),elbow,hand)
        self.weapon(im,hand,(-.2,-1))
        self.hand(im,hand)
        if self.n==5:self.shield(im,(29,37))
        return self.native(im)


def evidence(cid, poses, casts):
    directory=Path(SRC_DIR)/cid
    # 일곱 종류를 가로에 나란히 둔 3프레임 GIF: 모든 동작을 같은 시간축에서 비교한다.
    frames=[]
    for step in (1,2,3):
        frame=Image.new('RGB',(192*7,212),(43,47,60))
        dr=ImageDraw.Draw(frame)
        for col,(ct,_) in enumerate(CAST_TYPES):
            dr.text((col*192+6,3),f'{ct} {step}',fill=(235,237,245))
            cell=casts[f'cast_{ct}_{step}'].resize((192,192),Image.Resampling.NEAREST)
            frame.paste(cell,(col*192,20),cell)
        frames.append(frame)
    frames[0].save(directory/'_cast_parallel.gif',save_all=True,append_images=frames[1:],duration=160,loop=0,disposal=2,optimize=False)
    sequence=[]
    strip=Image.new('RGB',(192*3,212*7),(43,47,60))
    for row,(ct,_) in enumerate(CAST_TYPES):
        for step in (1,2,3):
            frame=Image.new('RGB',(192,212),(43,47,60))
            ImageDraw.Draw(frame).text((6,3),f'{ct} {step}',fill=(235,237,245))
            cell=casts[f'cast_{ct}_{step}'].resize((192,192),Image.Resampling.NEAREST)
            frame.paste(cell,(0,20),cell)
            sequence.append(frame)
            strip.paste(frame,((step-1)*192,row*212))
    strip.save(directory/'_cast_motion.png')
    sequence[0].save(directory/'_cast.gif',save_all=True,append_images=sequence[1:],duration=160,loop=0,disposal=2,optimize=False)
    old.motion(directory,poses)


def main():
    ids=sys.argv[1:] or [f'actor4-{n}' for n in range(2,8)]
    audit={}
    for cid in ids:
        assert cid in [f'actor4-{n}' for n in range(2,8)],cid
        artist=Artist(int(cid[-1]));directory=Path(SRC_DIR)/cid
        casts={};meta={}
        for ct,_ in CAST_TYPES:
            for step in (1,2,3):
                key=f'cast_{ct}_{step}'
                casts[key],meta[key]=artist.cast(ct,step)
        poses={pid:artist.native(artist.pose(pid)) for pid,*_ in POSES}
        for i,suffix in enumerate('abc'):poses[f'walk_{suffix}']=artist.walking(i)
        # 예전 공통 영창도 손에서 무기가 사라지지 않는 비전 동작으로 맞춘다.
        for step,pid in enumerate(('cast_charge','cast_raise','cast_release'),1):poses[pid]=casts[f'cast_arcane_{step}']
        added=set()
        for key,im in {**poses,**casts}.items():
            assert not validate(cid,key,im),(cid,key,validate(cid,key,im))
            assert im.getbbox()[3]==45,(cid,key,im.getbbox())
            added|={p[:3] for p in im.getdata() if p[3]}-set(artist.colors)
            im.save(directory/f'{key}.png')
        assert added<=set(LIGHT.values()) and len(added)<=6,(cid,added)
        assert len({im.tobytes() for im in casts.values()})==21
        assert len({im.getchannel('A').tobytes() for im in casts.values()})==21
        evidence(cid,poses,casts)
        audit[cid]=dict(cast_count=len(casts),extra_colors=sorted(added),poses=meta)
        print(cid,'시전 21칸 / 무장 걷기 3칸 / 추가색',len(added),'통과')
    (HERE/'audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
