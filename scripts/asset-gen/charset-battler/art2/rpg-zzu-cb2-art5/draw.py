"""담당 5명의 관절별 시전 원화와 무기를 든 걷기 칸을 재현한다."""
import importlib.util
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
LIB = HERE.parent.parent
sys.path.insert(0, str(LIB))
from cb_lib import CAST_TYPES, POSES, SRC_DIR, blank, cast_path, palette, place, walk_frame

spec = importlib.util.spec_from_file_location('first_artist', LIB / 'art/rpg-zzu-cb-art5/draw.py')
old = importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)
IDS = ['actor3-4', 'actor3-5', 'actor3-6', 'actor3-7', 'actor4-1']
# 모든 시전/전투 칸을 합쳐 추가색 여섯 개만 허용한다. 흰색·불꽃·금색은 원본 팔레트에 있다.
EXTRA = [(112, 203, 255), (147, 234, 98), (165, 88, 224), (74, 233, 208), (255, 144, 199), (206, 169, 255)]

def nearest(colors, color):
    return min(colors, key=lambda c: sum((a-b)**2 for a,b in zip(c,color)))


def localize(im, colors):
    out = im.copy()
    mapping = {c: nearest(colors, c[:3])+(255,) for c in set(im.getdata()) if c[3] and c[:3] not in colors}
    out.putdata([mapping.get(c,c) for c in im.getdata()])
    return out


# 각 항목은 머리 오프셋/몸통 중심/앞팔의 팔꿈치·손/뒷팔의 팔꿈치·손/무릎·발이다.
# 몸 전체를 이동/회전하지 않는다. 팔·몸통·다리는 아래 관절에서 매번 다시 그린다.
def plan(ct, step):
    key = (ct, step)
    plans = {
      ('fire',1): dict(h=(1,1), c=(26,37), a=((31,37),(32,35)), b=((29,38),(30,36)), feet=(21,29)),
      ('fire',2): dict(h=(-1,0),c=(24,36), a=((23,37),(18,33)),b=((18,36),(17,32)),feet=(19,30)),
      ('fire',3): dict(h=(-3,1),c=(23,37), a=((18,33),(11,31)),b=((17,36),(12,33)),feet=(14,33)),
      ('ice',1): dict(h=(0,0),c=(24,36),a=((24,35),(17,28)),b=((20,36),(29,29)),feet=(21,28)),
      ('ice',2): dict(h=(0,-1),c=(24,35),a=((16,29),(12,22)),b=((32,38),(35,41)),feet=(18,31)),
      ('ice',3): dict(h=(-1,-1),c=(24,35),a=((20,23),(20,15)),b=((17,33),(10,33)),feet=(17,31)),
      ('thunder',1): dict(h=(1,4),c=(25,39),a=((34,38),(37,33)),b=((20,38),(17,34)),feet=(18,32),knees=(19,31)),
      ('thunder',2): dict(h=(1,-2),c=(25,35),a=((30,24),(30,13)),b=((21,38),(21,39)),feet=(21,29)),
      ('thunder',3): dict(h=(-3,4),c=(22,39),a=((16,32),(10,39)),b=((28,37),(30,33)),feet=(14,33),knees=(16,30)),
      ('heal',1): dict(h=(-1,2),c=(24,37),a=((23,38),(19,33)),b=((17,37),(18,32)),feet=(23,28),closed=True),
      ('heal',2): dict(h=(0,-1),c=(24,35),a=((32,27),(35,21)),b=((16,27),(12,21)),feet=(21,29)),
      ('heal',3): dict(h=(-1,0),c=(24,36),a=((20,36),(12,33)),b=((29,37),(29,39)),feet=(20,30)),
      ('dark',1): dict(h=(-2,4),c=(23,39),a=((20,37),(15,30)),b=((28,40),(30,40)),feet=(20,30),knees=(18,29)),
      ('dark',2): dict(h=(2,2),c=(26,38),a=((35,33),(37,25)),b=((24,39),(23,40)),feet=(20,32)),
      ('dark',3): dict(h=(-3,3),c=(22,38),a=((17,30),(9,28)),b=((28,39),(32,37)),feet=(15,34),claw=True),
      ('arcane',1): dict(h=(-1,0),c=(24,36),a=((23,35),(17,31)),b=((20,37),(15,34)),feet=(21,29)),
      ('arcane',2): dict(h=(0,-1),c=(24,35),a=((31,25),(34,18)),b=((18,26),(17,19)),feet=(20,30)),
      ('arcane',3): dict(h=(-2,0),c=(23,36),a=((19,31),(12,27)),b=((20,36),(17,31)),feet=(17,32)),
      ('support',1): dict(h=(0,0),c=(24,36),a=((22,33),(16,25)),b=((29,38),(30,38)),feet=(22,29)),
      ('support',2): dict(h=(-1,0),c=(24,36),a=((18,36),(8,35)),b=((31,37),(33,35)),feet=(19,31)),
      ('support',3): dict(h=(-2,1),c=(23,37),a=((19,35),(13,30)),b=((29,38),(31,37)),feet=(20,29)),
    }
    return plans[key]


class Artist(old.Painter):
    def weapon(self, im, hand, tip, kind=None):
        # 기존 무기 윤곽/길이는 그대로 쓰고 금속·나무색만 캐릭터 팔레트로 제한한다.
        layer = blank()
        super().weapon(layer, hand, tip, kind)
        im.alpha_composite(localize(layer, self.colors))

    def arm(self, im, points):
        layer = blank()
        super().arm(layer, points)
        im.alpha_composite(localize(layer, self.colors))

    def torso_at(self, im, center, ct, step):
        x,y = center
        # 자세에 따라 허리와 어깨의 폭/축이 달라진다. 원본의 옷깃·띠 색을 보존한다.
        twist = 2 if (ct,step) in [('fire',1),('dark',2)] else -1 if step==3 else 0
        d=ImageDraw.Draw(im)
        d.polygon([(x-4+twist,y-4),(x+3+twist,y-4),(x+5,y+2),(x+3,y+4),(x-4,y+4),(x-6,y+1)],fill=self.out+(255,))
        d.polygon([(x-3+twist,y-3),(x+2+twist,y-3),(x+3,y+2),(x-3,y+2)],fill=self.s['cloth']+(255,))
        old.line(im,(x+2+twist,y-2),(x+3,y+2),self.s['shade'],2)
        old.line(im,(x-3+twist,y-3),(x+1+twist,y-3),self.s['trim'])
        old.line(im,(x-3,y+2),(x+2,y+2),self.s['shade'],2)
        old.pixel(im,(x-2,y+2),self.s['trim'])

    def spark(self, im, ct, step, hand):
        # 최대 9도트, 손에 붙은 5×5 범위만 사용한다. 투사체나 궤적은 없다.
        x,y=hand
        color = {'fire':nearest(self.colors,(235,75,20)), 'ice':EXTRA[0],
                 'thunder':nearest(self.colors,(255,225,90)), 'heal':EXTRA[1],
                 'dark':EXTRA[2], 'arcane':EXTRA[3], 'support':EXTRA[4]}[ct]
        secondary = nearest(self.colors,(246,145,20)) if ct=='fire' else EXTRA[5] if ct=='support' else (0,0,0) if ct=='dark' else (255,255,255)
        coords=[(-2,-1),(-2,-2),(-1,-2)]
        if step>=2:coords += [(-3,-2),(-2,-3)]
        if step==3:coords += [(-3,-1),(-1,-3),(-3,-3),(-2,0)]
        for i,(dx,dy) in enumerate(coords):old.pixel(im,(x+dx,y+dy),secondary if i==1 else color)
        return len(coords)

    def cast(self,ct,step):
        q=plan(ct,step);im=blank();cx,cy=q['c'];hx,hy=q['h']
        left,right=q['feet'];kl,kr=q.get('knees',(left+2,right-2))
        self.leg(im,(cx+2,cy+2),(kr,41),(right,44),True)
        self.leg(im,(cx-2,cy+2),(kl,41),(left,44))
        back=[(cx-3,cy-2),*q['b']];arm=[(cx+3,cy-2),*q['a']]
        self.arm(im,back)
        self.torso_at(im,(cx,cy),ct,step)
        # 머리 조각만 옮기며 어깨/무릎은 독립적으로 다시 찍는다.
        if self.cid in ('actor3-4','actor3-6'):
            im.alpha_composite(self.src.crop((17,19,21,25)),(cx+5,cy-3))
        self.head_at(im,hx,hy,q.get('closed',False))
        # 교차 팔·높이 벌린 팔도 머리 앞에서 연결이 끊어지지 않게 전경 팔을 다시 찍는다.
        self.arm(im,back)
        self.arm(im,arm)
        hand=arm[-1]
        held=back[-1]
        if self.s['weapon']=='staff':
            # 비전은 주손 지팡이를 실제로 세움→머리 위 회전→앞으로 겨누는 세 자세다.
            if ct=='arcane':
                held=hand
                tip=[(17,17),(25,7),(1,21)][step-1]
            elif ct=='thunder' and step==2:
                held=hand;tip=(30,3)
            else:
                tip=(held[0],held[1]-12)
            self.weapon(im,held,tip)
            self.hand(im,held)
        elif self.s['weapon']!='fist':
            # 단검/검은 반대 손으로 세워 쥐고 빈손으로 시전한다.
            self.weapon(im,held,(held[0]+2,held[1]-13))
            self.hand(im,held)
        if q.get('claw'):
            # 손가락 세 갈래를 별도 도트로 뻗는다.
            for off in (-2,0,2):old.line(im,(hand[0]-1,hand[1]+off),(hand[0]-4,hand[1]+off),self.skin)
        self.spark(im,ct,step,hand)
        return im

    def walk(self,pid):
        pattern={'walk_a':0,'walk_b':1,'walk_c':2}[pid]
        im=place(walk_frame(self.cid,'left',pattern))
        if self.s['weapon']=='fist':return im
        # 원본 걸음의 상체/손을 팔레트로 봉합하고 앞으로 굽힌 팔에 무기를 연결한다.
        bounce=1 if pattern!=1 else 0
        self.arm(im,[(27,34+bounce),(23,36+bounce),(20,33+bounce)])
        self.weapon(im,(20,33+bounce),(14+pattern,20+bounce))
        self.hand(im,(20,33+bounce))
        return im


def gifs(cid, casts, poses):
    target=Path(SRC_DIR)/cid
    # 7종을 한 줄에 나란히 두어 3단계가 동시에 재생된다(칸당 160ms, 4배).
    frames=[]
    for step in (1,2,3):
        frame=Image.new('RGB',(7*192,212),(42,46,58));d=ImageDraw.Draw(frame)
        for col,(ct,_) in enumerate(CAST_TYPES):
            sprite=casts[(ct,step)].resize((192,192),Image.Resampling.NEAREST)
            frame.paste(sprite,(col*192,20),sprite);d.text((col*192+5,3),f'{ct} {step}',fill='white')
        frames.append(frame)
    frames[0].save(target/'_cast.gif',save_all=True,append_images=frames[1:],duration=160,loop=0,disposal=2,optimize=False)
    old.motion(cid,poses)


def main():
    audit={}
    for cid in sys.argv[1:] or IDS:
        assert cid in IDS
        p=Artist(cid)
        casts={(ct,step):p.cast(ct,step) for ct,_ in CAST_TYPES for step in (1,2,3)}
        poses={pid:localize(p.pose(pid),p.colors) for pid,_,_,_ in POSES}
        for pid in ('walk_a','walk_b','walk_c'):poses[pid]=p.walk(pid)
        for i,pid in enumerate(('cast_charge','cast_raise','cast_release'),1):poses[pid]=casts[('arcane',i)]
        if cid in ('actor3-6','actor3-7'):poses['skill']=casts[('support',3)]
        # 아이템 사용 중에도 반대 손에 무기를 유지한다.
        if p.s['weapon']!='fist':
            p.weapon(poses['item'],(25,38),(32,26));p.hand(poses['item'],(25,38))
        used=set()
        for name,im in [(f'cast_{ct}_{step}',im) for (ct,step),im in casts.items()]+list(poses.items()):
            assert im.size==(48,48)
            assert im.getbbox()[3]==45,(cid,name,im.getbbox())
            assert {c[3] for c in im.getdata()}<={0,255}
            used.update(c[:3] for c in im.getdata() if c[3])
            im.save(Path(SRC_DIR)/cid/f'{name}.png')
        assert len(used-p.colors)<=6,(cid,used-p.colors)
        assert len({im.tobytes() for im in casts.values()})==21
        gifs(cid,casts,poses)
        audit[cid]={'cast_frames':21,'battle_frames':24,'extra_colors':sorted(used-p.colors),'ground_y':44,'alpha':[0,255],'glow_pixels':[3,5,9],'weapon':p.s['weapon']}
        print(cid,'21 cast + 24 battle; extra colors:',len(used-p.colors))
    (HERE/'audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
