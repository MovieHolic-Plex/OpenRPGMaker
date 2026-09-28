"""담당 여섯 명의 관절별 시전 저작. 원본 칩·1차 부위 분해만 재사용한다."""
from pathlib import Path
import sys, math, importlib.util, json, hashlib
sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
LIB = HERE.parents[1]
sys.path.insert(0, str(LIB))
from cb_lib import walk_frame, palette, blank, place, POSES, CAST_TYPES, SRC_DIR, ROOT, validate
from PIL import Image, ImageDraw


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

old1 = module('first_actor1', LIB/'art/rpg-zzu-cb-art1/paint.py')
old3 = module('first_actor3', LIB/'art/rpg-zzu-cb-art4/draw.py')
IDS = ['actor3-0', 'actor1-0', 'actor1-1', 'actor1-2', 'actor1-3', 'actor1-4']
# 불꽃·흰색은 원본을 쓰고, 없는 속성색 여섯 개만 모든 포즈에서 공유한다.
EXTRA = [(142,235,105), (144,77,200), (246,139,210), (82,220,216), (136,215,255), (255,232,105)]
px, line, poly = old1.dot, old1.line, old1.poly


def near(colors, c):
    return min(colors, key=lambda p:sum((a-b)**2 for a,b in zip(c,p)))


class Equipment:
    def init_equipment(self):
        self.pal = palette(self.cid)
        self.allowed = set(self.pal + EXTRA)
        self.is_mage = self.cid in ['actor3-0','actor1-1','actor1-4']
        self.wood = near(self.pal, (110,67,35))
        self.gold = near(self.pal, (219,166,73))
        self.steel = near(self.pal, (150,163,179))
        self.white = near(self.pal, (255,255,255))
        self.outline = min(self.pal,key=sum)

    def finish(self, im):
        # 기존 도구의 장비색도 원본+공통 여섯 색으로 한 번만 정규화한다.
        for y in range(48):
            for x in range(48):
                c=im.getpixel((x,y))
                if y>44 or not c[3]: im.putpixel((x,y),(0,0,0,0))
                elif c[:3] not in self.allowed: im.putpixel((x,y),near(self.pal,c[:3])+(255,))
        return im

    def gear(self, im, hand, tip, staff=None):
        # Weapon.png의 손잡이/평행 명암/둥근 지팡이 머리를 관절 방향별로 다시 찍는다.
        staff = self.is_mage if staff is None else staff
        x,y=hand; tx,ty=tip
        tx=max(3,min(44,tx));ty=max(4,min(41,ty))
        length=math.hypot(tx-x,ty-y) or 1
        ux,uy=(tx-x)/length,(ty-y)/length
        pt=lambda a,b=0:(round(x+ux*a-uy*b),round(y+uy*a+ux*b))
        if staff:
            tail=pt(-5)
            line(im,tail,(tx,ty),self.outline,3)
            line(im,tail,(tx,ty),self.wood)
            line(im,pt(-4,1),pt(length-2,1),self.gold)
            # 머리 장식은 광원이 아닌 원본 금색 고리. 속성 빛은 별도 손끝 레이어다.
            poly(im,[(tx,ty-3),(tx+2,ty-2),(tx+3,ty),(tx+2,ty+2),(tx,ty+3),(tx-2,ty+2),(tx-3,ty),(tx-2,ty-2)],self.outline)
            poly(im,[(tx,ty-2),(tx+2,ty),(tx,ty+2),(tx-2,ty)],self.gold)
            px(im,tx,ty,self.wood);px(im,tx-1,ty-1,self.white)
        else:
            line(im,pt(-3),pt(3),self.outline,3)
            line(im,pt(-2),pt(2),self.wood)
            poly(im,[pt(3,-2),pt(length-2,-1),(tx,ty),pt(length-2,1),pt(3,2)],self.outline)
            line(im,pt(4),pt(length-2),self.steel,2)
            line(im,pt(4,-1),pt(length-2,-1),self.white)
            line(im,pt(2,-3),pt(2,3),self.outline,3)
            line(im,pt(2,-3),pt(2,3),self.gold)


class Actor1(Equipment, old1.Painter):
    def __init__(self,cid):
        old1.Painter.__init__(self,cid)
        self.init_equipment()

    def weapon(self,im,h,tip,kind=None): self.gear(im,h,tip,kind=='staff' if kind else None)

    def make(self,pose):
        if pose.startswith('walk_'):
            pattern='abc'.index(pose[-1]); im=place(walk_frame(self.cid,'left',pattern))
            # 걷기 발과 머리는 원본 3칸. 앞팔은 무기를 든 상태로 새로 접는다.
            hand=(18,35+(pattern==1));tip=(13,18+(pattern==1)) if self.mage else (8,23+(pattern==1))
            self.weapon(im,hand,tip);self.arm(im,(26,34),(24,38),hand)
            if self.knight:self.shield(im,27,36)
            return self.finish(im)
        if pose.startswith('cast_'):
            return cast(self,'arcane',{'cast_charge':1,'cast_raise':2,'cast_release':3}[pose])
        im=old1.Painter.make(self,pose)
        # 원본 1차의 빈손 포즈에도 역할에 맞는 무기를 이어 붙인다.
        if pose in ('weak','dying'):
            hand=(17,41) if pose=='weak' else (20,42)
            self.weapon(im,hand,(13,23) if self.mage else (5,41));self.hand(im,hand)
        if pose=='item':
            self.weapon(im,(29,37),(33,19));self.arm(im,(26,34),(31,36),(29,37))
        if pose=='front':
            self.weapon(im,(32,36),(34,18));self.hand(im,(32,36))
        return self.finish(im)


class Mage(Equipment, old3.Artist):
    def __init__(self,cid):
        old3.Artist.__init__(self,cid)
        self.p=dict(self.p,kind='staff')
        self.init_equipment()

    def weapon(self,im,hand,direction,length=None):
        dx,dy=direction;m=math.hypot(dx,dy);reach=17
        tip=(round(hand[0]+dx/m*reach),round(hand[1]+dy/m*reach))
        self.gear(im,hand,tip);self.hand(im,hand)

    def corpse(self):
        im=blank()
        head=self.head.crop(self.head.getbbox()).transpose(Image.Transpose.ROTATE_270)
        torso=self.core.crop((7,19,17,28)).transpose(Image.Transpose.ROTATE_270)
        im.alpha_composite(torso,(19,34));im.alpha_composite(head,(27,31))
        self.leg(im,(20,39),(15,37),(10,42),True)
        self.leg(im,(20,40),(15,41),(10,44))
        self.arm(im,(25,37),(21,35),(19,37))
        line(im,(25,42),(29,42),self.dark,2)
        self.gear(im,(20,41),(5,41))
        return self.finish(im)

    def make(self,pose):
        if pose.startswith('cast_'):
            return cast(self,'arcane',{'cast_charge':1,'cast_raise':2,'cast_release':3}[pose])
        if pose.startswith('walk_'):
            pattern='abc'.index(pose[-1]);im=place(walk_frame(self.cid,'left',pattern))
            hand=(18,35+(pattern==1));self.gear(im,hand,(13,18+(pattern==1)))
            self.arm(im,(26,33),(24,37),hand)
            return self.finish(im)
        if pose in ('attack_windup','attack_strike','attack','attack_follow','skill'):
            # 지팡이를 당김 → 머리 위 회전 → 수평 타격 → 낮게 회수. 셀 전체는 이동하지 않는다.
            cfg={
                'attack_windup':(25,0,1,((31,32),(32,27)),((26,35),(29,30)),(36,10)),
                'attack_strike':(24,0,-1,((24,28),(19,24)),((21,33),(19,29)),(7,12)),
                'attack':(24,1,-2,((20,34),(15,33)),((23,35),(21,34)),(3,33)),
                'attack_follow':(24,1,-1,((22,36),(18,37)),((24,36),(23,38)),(5,41)),
                'skill':(24,0,-2,((22,29),(17,26)),((26,34),(29,31)),(6,13)),
            }
            cx,dy,lean,arm,far,tip=cfg[pose];im=blank()
            legs=[((cx+2,38+dy),(30,41),(32,44)),((cx-1,38+dy),(20,40),(17,44))]
            if pose=='attack_windup':legs=[((27,38),(29,40),(30,44)),((24,38),(23,41),(21,44))]
            self.body(im,cx,dy,lean,legs,far=far,near=arm)
            self.gear(im,arm[1],tip);self.hand(im,arm[1]);return self.finish(im)
        im=old3.Artist.make(self,pose)
        if pose=='front':self.gear(im,(32,36),(34,17));self.hand(im,(32,36))
        if pose=='item':self.gear(im,(29,37),(32,18));self.arm(im,(26,33),(31,35),(29,37))
        return self.finish(im)


# (몸 하강, 몸통 비틀림, 발 자세, 가까운 팔꿈치/손, 먼 팔꿈치/손, 시전 도구 끝)
# X교차·위아래 벌림·내려찍기·기도·갈퀴·원그리기·입앞 불기를 각기 다른 관절 좌표로 저작한다.
GESTURES = {
 'fire': [
  (1,1,'crouch',(31,37),(32,35),(28,39),(30,36),(38,20)),
  (0,-1,'normal',(22,36),(17,32),(17,35),(17,31),(12,16)),
  (0,-2,'lunge',(17,33),(10,32),(16,31),(11,30),(4,27))],
 'ice': [
  (1,0,'normal',(17,36),(23,29),(26,35),(16,30),(14,16)),
  (0,1,'normal',(22,26),(17,21),(29,38),(32,41),(41,28)),
  (0,-1,'lunge',(25,24),(23,17),(17,33),(11,33),(4,30))],
 'thunder': [
  (3,1,'crouch',(33,37),(35,30),(20,39),(18,40),(40,16)),
  (0,0,'normal',(29,24),(29,15),(18,35),(17,38),(29,5)),
  (3,-2,'lunge',(18,31),(12,37),(26,38),(28,40),(5,41))],
 'heal': [
  (2,-1,'normal',(23,37),(18,33),(16,36),(18,32),(13,19)),
  (0,0,'normal',(19,29),(14,24),(29,29),(35,24),(40,12)),
  (0,-1,'normal',(19,34),(13,32),(27,37),(29,35),(33,18))],
 'dark': [
  (4,-2,'crouch',(23,39),(17,32),(27,41),(30,38),(34,22)),
  (2,2,'crouch',(33,38),(36,32),(20,40),(19,38),(39,17)),
  (2,-3,'lunge',(17,36),(10,34),(26,39),(30,40),(34,24))],
 'arcane': [
  (0,0,'normal',(22,36),(17,32),(24,38),(18,38),(17,15)),
  (0,1,'normal',(30,25),(23,18),(17,29),(15,25),(10,8)),
  (0,-1,'lunge',(20,32),(13,30),(23,36),(18,33),(3,24))],
 'support': [
  (0,0,'normal',(23,31),(17,25),(29,37),(30,35),(34,18)),
  (0,1,'normal',(34,30),(39,29),(22,37),(19,36),(16,20)),
  (1,-1,'normal',(22,35),(16,30),(28,38),(31,36),(35,20))],
}


def cast(p, ct, step):
    drop,lean,stance,elbow,hand,far_elbow,far_hand,tip=GESTURES[ct][step-1]
    # 검을 든 손이 얼굴을 가로지르지 않게 보조 팔도 관절부터 다시 배치한다.
    if not p.is_mage:
        offhand = {
            ('fire',2):((29,38),(29,35)), ('fire',3):((28,37),(30,34)),
            ('thunder',2):((30,37),(30,38)), ('arcane',1):((29,36),(30,38)),
            ('arcane',3):((28,38),(30,36)),
        }
        far_elbow,far_hand=offhand.get((ct,step),(far_elbow,far_hand))
    im=blank()
    if isinstance(p,Mage):
        legs=[((26,38+drop),(29,41),(30,44)),((23,38+drop),(21,41),(20,44))]
        if stance=='crouch':legs=[((26,40),(31,41),(32,44)),((23,40),(19,41),(17,44))]
        if stance=='lunge':legs=[((26,39),(30,41),(34,44)),((23,39),(18,40),(15,44))]
        sx,sy=p.body(im,24,drop,lean,legs,closed=ct=='heal' and step==1)
        front=(sx,sy);back=(sx-4,sy)
        arm=lambda a,b,c,far=False:p.arm(im,a,b,c,far)
    else:
        sx,sy=p.body(im,0,drop,lean,stance,ct=='heal' and step==1)
        front=(sx+1,sy);back=(sx-4,sy)
        arm=lambda a,b,c,far=False:p.arm(im,a,b,c,far)
    # 지팡이는 시전 손 또는 보조 손에서 계속 보인다. 검은 반대 손에 세워서 유지한다.
    active_staff=p.is_mage and ct in ('thunder','arcane')
    if active_staff:
        gear_hand=hand;gear_tip=tip
    elif p.is_mage:
        gear_hand=far_hand;gear_tip=tip
    else:
        gear_hand=far_hand
        # 불꽃 밀기·얼음 교차도 검을 든 손은 위/뒤로 향해 빈손 손바닥을 가리지 않는다.
        gear_tip=(min(43,gear_hand[0]+8),max(5,gear_hand[1]-15))
        if gear_hand[0]<24:
            gear_tip=(max(4,gear_hand[0]-8),max(5,gear_hand[1]-15))
    arm(back,far_elbow,far_hand,True)
    p.gear(im,gear_hand,gear_tip)
    p.hand(im,far_hand)
    arm(front,elbow,hand)
    if active_staff:p.hand(im,hand)
    if isinstance(p,Actor1) and p.knight:
        # 방패를 등 뒤 끈에 걸어 두 손을 쓸 수 있게 한다.
        line(im,(26,33),(32,37),p.wood,2)
        p.shield(im,32,37)
    if ct=='dark':
        # 갈퀴 손가락 세 갈래. 방출 때 손바닥 실루엣이 일반 내밀기와 다르다.
        skin=p.skin2 if isinstance(p,Mage) else p.skin
        for ox,oy in [(-3,-2),(-4,0),(-3,2)]:
            line(im,(hand[0]-1,hand[1]),(hand[0]+ox,hand[1]+oy),p.outline)
            px(im,hand[0]+ox,hand[1]+oy,skin)
    elif ct in ('ice','heal','support'):
        skin=p.skin2 if isinstance(p,Mage) else p.skin
        # 펴는 손바닥은 손끝의 세 점이 보이도록 별도 저작한다.
        for dx,dy in [(-2,-1),(-2,0),(-2,1)]:px(im,hand[0]+dx,hand[1]+dy,skin)
    # 광점은 도구 끝/손 바로 주변에만 3→5→9픽셀. 투사체는 없다.
    color={
        'fire':near(p.pal,(255,103,32)), 'ice':EXTRA[4], 'thunder':EXTRA[5],
        'heal':EXTRA[0], 'dark':EXTRA[1], 'arcane':EXTRA[3], 'support':EXTRA[2],
    }[ct]
    core=near(p.pal,(174,20,24)) if ct=='fire' else p.outline if ct=='dark' else EXTRA[1] if ct=='support' else p.white
    at=gear_tip if active_staff else (hand[0]-3,hand[1]-2)
    # 지팡이 머리는 빛을 받는 면만 칠하고 빈손은 손등 바깥 한 픽셀에서 시작한다.
    coords=[(0,0),(-1,0),(0,-1),(1,0),(0,1),(-2,0),(0,-2),(2,0),(0,2)]
    glow=[]
    for dx,dy in coords[:[3,5,9][step-1]]:
        xy=(at[0]+dx,at[1]+dy);px(im,*xy,core if dx==0 and dy==0 else color);glow.append(xy)
    im=p.finish(im)
    return im


def evidence(cid, poses, casts):
    out=Path(SRC_DIR)/cid
    # 일곱 마법을 한 행씩 놓고 세 단계가 160ms마다 함께 진행되는 GIF.
    frames=[]
    for step in (1,2,3):
        fr=Image.new('RGB',(192,7*210),(42,46,59));d=ImageDraw.Draw(fr)
        for row,(ct,_) in enumerate(CAST_TYPES):
            cell=casts[f'cast_{ct}_{step}'].resize((192,192),Image.Resampling.NEAREST)
            fr.paste(cell,(0,row*210+18),cell)
            d.text((6,row*210+3),f'{ct} {step}',fill=(235,235,240))
        frames.append(fr)
    colors=sorted(set(c[:3] for im in casts.values() for c in im.get_flattened_data() if c[3]) | {(42,46,59),(235,235,240)})
    pal=Image.new('P',(1,1));pal.putpalette(sum((list(c) for c in colors),[])+[0]*(768-3*len(colors)))
    frames=[im.quantize(palette=pal,dither=Image.Dither.NONE) for im in frames]
    frames[0].save(out/'_cast.gif',save_all=True,append_images=frames[1:],duration=160,loop=0,disposal=2,optimize=False)
    old1.evidence(cid,poses)
    # 예전 증거 파일명이 다른 경우에도 새 그림과 일치시킨다.
    if (out/'_motion-review.png').exists() and (out/'_motion_review.png').exists():
        Image.open(out/'_motion-review.png').save(out/'_motion_review.png')


def main():
    reports={}
    for cid in sys.argv[1:] or IDS:
        assert cid in IDS,'담당 범위 밖'
        p=Mage(cid) if cid=='actor3-0' else Actor1(cid)
        casts={f'cast_{ct}_{step}':cast(p,ct,step) for ct,_ in CAST_TYPES for step in (1,2,3)}
        poses={pid:p.make(pid) for pid,*_ in POSES}
        used=set()
        for name,im in {**poses,**casts}.items():
            assert not validate(cid,name,im),(cid,name,validate(cid,name,im))
            assert im.getbbox()[3]==45,(cid,name,im.getbbox())
            assert set(im.getchannel('A').get_flattened_data())<={0,255}
            used|={c[:3] for c in im.get_flattened_data() if c[3]}
            im.save(Path(SRC_DIR)/cid/f'{name}.png')
        assert used-set(p.pal)<=set(EXTRA)
        evidence(cid,poses,casts)
        # 실루엣은 광점 색 없이도 모든 단계에서 다른 모양이어야 한다.
        hashes={name:hashlib.sha256(im.getchannel('A').tobytes()).hexdigest() for name,im in casts.items()}
        assert len(set(hashes.values()))==21,(cid,'중복 실루엣')
        reports[cid]={'battle_poses':24,'cast_poses':21,'ground_y':44,'extra_colors':sorted(used-set(p.pal)),'unique_cast_silhouettes':21,'weapon':'staff' if p.is_mage else 'sword','alpha':[0,255]}
        print(cid,'24포즈 + 21시전, 발44/알파/추가6색/실루엣21개 통과')
    old=json.loads((HERE/'audit.json').read_text()) if (HERE/'audit.json').exists() else {}
    old.update(reports);(HERE/'audit.json').write_text(json.dumps(old,ensure_ascii=False,indent=2)+'\n')

if __name__=='__main__':main()
