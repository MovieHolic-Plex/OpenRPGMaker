"""Actor1 담당 다섯 명: 원본 부위 + 1px 관절 저작. 공용 파일에는 쓰지 않는다."""
from pathlib import Path
import sys, math
sys.dont_write_bytecode = True
LIB = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(LIB))
from cb_lib import walk_frame, palette, blank, place, POSES, SRC_DIR
from PIL import Image, ImageDraw

IDS = [f'actor1-{i}' for i in range(5)]
# 무기와 마법에만 쓰는 추가색 여섯. 몸에는 원본 팔레트만 쓴다.
EXTRA = [(89,64,47),(184,139,72),(108,140,165),(217,235,242),(85,214,240),(255,242,169)]
WOOD, GOLD, STEEL, SILVER, CYAN, LIGHT = EXTRA
SEQUENCES = [
 ['walk_a','walk_b','walk_c','walk_b'],
 ['attack_windup','attack_strike','attack','attack_follow'],
 ['cast_charge','cast_raise','cast_release'],
 ['idle','hit','idle'], ['victory','victory_b']]

def dot(im,x,y,c):
    x,y=round(x),round(y)
    if 0<=x<48 and 0<=y<=44: im.putpixel((x,y),tuple(c[:3])+(255,))

def line(im,a,b,c,w=1):
    # 브레젠험 계열 정수 경로: 선분과 굵기를 직접 픽셀에 찍는다.
    n=max(abs(b[0]-a[0]),abs(b[1]-a[1]),1)
    for k in range(n+1):
        x=round(a[0]+(b[0]-a[0])*k/n); y=round(a[1]+(b[1]-a[1])*k/n)
        for dy in range(-(w//2),w-w//2):
            for dx in range(-(w//2),w-w//2): dot(im,x+dx,y+dy,c)

def poly(im,pts,c):
    mask=Image.new('1',(48,48)); ImageDraw.Draw(mask).polygon(pts,fill=1)
    for y in range(45):
        for x in range(48):
            if mask.getpixel((x,y)): dot(im,x,y,c)

def plus(im,x,y,c,rad=2):
    line(im,(x-rad,y),(x+rad,y),c); line(im,(x,y-rad),(x,y+rad),c)

class Painter:
    def __init__(self,cid):
        self.cid=cid; self.idx=int(cid[-1]); self.src=walk_frame(cid,'left',1)
        self.pal=palette(cid); self.outline=min(self.pal,key=lambda c:sum(c))
        self.ox=24-(self.src.getbbox()[0]+self.src.getbbox()[2])//2
        self.mage=self.idx in (1,4); self.knight=self.idx in (2,3)
        self.skin=self.near((249,193,157)); self.shade=self.near((191,100,61))
        self.fabric=self.near((36,75,204) if self.idx in (0,4) else (230,41,49))
        self.fabricdark=self.near((26,25,79) if self.idx in (0,4) else (123,8,24))
        self.fabriclight=self.near((106,197,255) if self.idx==4 else ((29,115,214) if self.idx==0 else (255,82,90)))
        if self.idx==4:
            self.fabric=self.near((65,65,65)); self.fabricdark=self.near((0,8,74)); self.fabriclight=self.near((106,106,106))
        self.head=self.src.crop((0,0,24,19 if self.idx not in (2,) else 18))
        self.torso=self.src.copy()
        # 머리/다리를 떼고 기존 가까운 팔만 지운다. 벨트와 가슴 무늬는 보존한다.
        for y in range(32):
            for x in range(24):
                keep=19<=y<=25 and 7<=x<=14
                if self.idx==2: keep=18<=y<=25 and 6<=x<=13
                if not keep: self.torso.putpixel((x,y),(0,0,0,0))
                elif x>=12 and y>=20:
                    col=self.near((65,65,65)) if self.knight else self.fabricdark
                    if y==23: col=self.near((90,32,0)) if not self.knight else self.fabricdark
                    self.torso.putpixel((x,y),col+(255,))
        self.boot=self.src.crop((8,28,14,31))
        self.cape=Image.new('RGBA',(24,32))
        if self.idx in (1,3,4):
            for y in range(18,31):
                for x in range(15,24): self.cape.putpixel((x,y),self.src.getpixel((x,y)))

    def near(self,c): return min(self.pal,key=lambda p:sum((p[i]-c[i])**2 for i in range(3)))

    def limb(self,im,points,kind='arm',back=False):
        mid=self.fabricdark if back else self.fabric
        hi=self.fabric if back else self.fabriclight
        if self.knight and kind=='leg': mid=self.near((156,156,156)); hi=self.near((213,213,213))
        for a,b in zip(points,points[1:]): line(im,a,b,self.outline,4)
        for a,b in zip(points,points[1:]): line(im,a,b,mid,2)
        for a,b in zip(points,points[1:]): line(im,(a[0],a[1]-1),(b[0],b[1]-1),hi)

    def hand(self,im,p):
        x,y=p
        poly(im,[(x-1,y-1),(x+1,y-1),(x+2,y),(x+1,y+2),(x-1,y+2)],self.outline)
        line(im,(x-1,y),(x+1,y),self.skin)
        line(im,(x,y+1),(x+1,y+1),self.shade)

    def arm(self,im,shoulder,elbow,hand,back=False):
        self.limb(im,[shoulder,elbow,hand],back=back)
        if not back and (self.knight or self.idx==0):
            # 원본의 은빛 어깨 갑옷과 붉은 장갑을 관절 방향에 맞춰 다시 찍는다.
            line(im,shoulder,elbow,self.near((106,106,106)),2)
            dot(im,shoulder[0],shoulder[1]-1,self.near((255,255,255)))
            dot(im,shoulder[0]+1,shoulder[1],self.near((189,189,189)))
            line(im,elbow,(round((elbow[0]+hand[0])/2),round((elbow[1]+hand[1])/2)),self.near((164,24,32)),2)
        self.hand(im,hand)

    def weapon(self,im,h,tip,kind=None):
        kind=kind or ('staff' if self.mage else 'sword')
        if kind=='staff': tip=(max(4,min(43,tip[0])),max(4,min(41,tip[1])))
        dx=tip[0]-h[0]; dy=tip[1]-h[1]; length=math.hypot(dx,dy)
        ux,uy=dx/length,dy/length; nx,ny=-uy,ux
        pt=lambda along,wide=0:(round(h[0]+ux*along+nx*wide),round(h[1]+uy*along+ny*wide))
        if kind=='staff':
            line(im,pt(-6),tip,self.outline,3); line(im,pt(-6),tip,WOOD)
            line(im,pt(-5,1),pt(length-2,1),GOLD)
            poly(im,[(tip[0],tip[1]-3),(tip[0]+3,tip[1]),(tip[0],tip[1]+3),(tip[0]-3,tip[1])],self.outline)
            poly(im,[(tip[0],tip[1]-2),(tip[0]+2,tip[1]),(tip[0],tip[1]+2),(tip[0]-2,tip[1])],CYAN)
            dot(im,tip[0],tip[1]-1,LIGHT)
        else:
            line(im,pt(-3),pt(3),self.outline,3); line(im,pt(-2),pt(2),WOOD)
            poly(im,[pt(3,-2),pt(length-3,-1),tip,pt(length-3,1),pt(3,2)],self.outline)
            line(im,pt(4),pt(length-2),STEEL,2)
            line(im,pt(4,-1),pt(length-2,-1),SILVER)
            line(im,pt(2,-3),pt(2,3),self.outline,3)
            line(im,pt(2,-3),pt(2,3),GOLD)
            dot(im,*pt(-3),GOLD)

    def shield(self,im,x,y,raised=False):
        # 두 기사는 방패 윤곽도 구분한다. 가까운 팔은 검을 계속 쥔다.
        pts=[(x-3,y-5),(x+3,y-5),(x+4,y+1),(x,y+6),(x-4,y+1)]
        if self.idx==3: pts=[(x,y-5),(x+4,y-2),(x+3,y+3),(x,y+5),(x-3,y+3),(x-4,y-2)]
        poly(im,pts,self.outline)
        poly(im,[(x-2,y-4),(x+2,y-4),(x+3,y),(x,y+4),(x-3,y)],SILVER)
        poly(im,[(x-1,y-3),(x+1,y-3),(x+2,y),(x,y+3),(x-2,y)],self.fabricdark)
        line(im,(x,y-2),(x,y+2),self.fabriclight)
        line(im,(x-1,y),(x+1,y),self.fabriclight)

    def body(self,im,dx=0,drop=0,lean=0,stance='normal',closed=False):
        # 머리, 몸통, 망토, 두 다리의 기준점을 독립 배치한다.
        base=24+dx; hip=(base,38+drop)
        if stance=='lunge': legs=[[(base+1,38),(base+5,41),(base+9,43)],[(base-1,38),(base-7,39),(base-8,43)]]
        elif stance=='kneel': legs=[[(base+1,39),(base+5,43),(base+8,43)],[(base-1,39),(base-5,40),(base-5,43)]]
        elif stance=='crouch': legs=[[(base+1,40),(base+5,40),(base+6,43)],[(base-1,40),(base-4,41),(base-5,43)]]
        elif stance=='fall': legs=[[(base,40),(base+4,43),(base+8,43)],[(base-1,40),(base-6,42),(base-7,43)]]
        else: legs=[[(base+1,38),(base+4,40),(base+5,43)],[(base-1,38),(base-3,41),(base-3,43)]]
        for j,points in enumerate(legs):
            self.limb(im,points,'leg',j==0)
            fx,fy=points[-1]
            im.alpha_composite(self.boot,(fx-3,42))
        # 뒤 망토/긴 머리는 원래 도트를 전사하되 자세별로 바깥 끝만 이동한다.
        for y in range(18,31):
            for x in range(15,24):
                c=self.cape.getpixel((x,y))
                if c[3]: dot(im,x+self.ox+dx+round(lean*(30-y)/13),min(43,y+14+drop),c)
        for y in range(18,26):
            shift=round(lean*(26-y)/8)
            for x in range(24):
                c=self.torso.getpixel((x,y))
                if c[3]: dot(im,x+self.ox+dx+shift,y+14+drop-(max(0,y-22) if stance in ('kneel','fall','crouch') else 0),c)
        head=self.head.copy()
        if closed:
            # 각 얼굴의 홍채/흰자만 피부색으로 덮고 닫힌 눈을 두 점으로 찍는다.
            eye_y=15 if self.idx==2 else 16
            ex=[9,9,8,8,9][self.idx]
            for y in (eye_y-1,eye_y):
                for x in (ex,ex+1): head.putpixel((x,y),self.skin+(255,))
            head.putpixel((ex,eye_y),self.outline+(255,)); head.putpixel((ex+1,eye_y),self.outline+(255,))
        im.alpha_composite(head,(self.ox+dx+lean,14+drop))
        return base+lean,34+drop

    def make(self,pose):
        if pose=='front': return place(walk_frame(self.cid,'down',1))
        if pose.startswith('walk_'):
            # 걷기 세 칸은 원본 그대로 유지한다.
            return place(walk_frame(self.cid,'left','abc'.index(pose[-1])))
        if pose=='dead': return self.dead()
        cfg={
          'idle':(0,0,0,'normal'), 'attack_windup':(1,0,2,'normal'),
          'attack_strike':(-1,0,-1,'lunge'), 'attack':(-2,0,-2,'lunge'),
          'attack_follow':(-1,1,-2,'lunge'), 'cast_charge':(0,1,0,'normal'),
          'cast_raise':(0,0,0,'normal'), 'cast_release':(-1,0,-1,'lunge'),
          'defend':(0,4,-1,'crouch'), 'guard_hit':(3,4,0,'crouch'),
          'hit':(2,1,3,'normal'), 'evade':(4,2,3,'crouch'),
          'weak':(0,5,-2,'kneel'), 'dying':(2,6,4,'fall'),
          'revive':(0,3,-1,'kneel'), 'item':(0,0,0,'normal'),
          'victory':(0,0,0,'normal'), 'victory_b':(0,-1,0,'normal'),
          'skill':(-1,1,-2,'lunge')}
        dx,drop,lean,stance=cfg[pose]; im=blank()
        sx,sy=self.body(im,dx,drop,lean,stance,pose in ('hit','guard_hit','weak','dying'))
        sh=(sx+1,sy); far=(sx-4,sy)
        if pose=='idle':
            hand=(sx-6,sy+1); elbow=(sx+1,sy+3); tip=(hand[0]-8,hand[1]-12)
            self.arm(im,far,(sx-6,sy+2),(sx-5,sy+3),True)
            self.weapon(im,hand,tip); self.arm(im,sh,elbow,hand)
        elif pose in ('attack_windup','attack_strike','attack','attack_follow','skill'):
            data={
              'attack_windup':((sx+8,sy-5),(sx+6,sy+1),(sx+15,sy-19)),
              'attack_strike':((sx-3,sy-8),(sx+2,sy-4),(sx-14,sy-22)),
              'attack':((sx-5,sy),(sx-1,sy+1),(sx-23,sy)),
              'attack_follow':((sx-7,sy+3),(sx-2,sy+2),(sx-17,sy+9)),
              'skill':((sx-8,sy-2),(sx-2,sy+1),(sx-22,sy-9))}
            hand,elbow,tip=data[pose]
            tip=(max(3,tip[0]),max(4,tip[1]))
            if self.mage:
                # 두 마법사는 지팡이 타격: 뒤로 당김 → 위에서 내림 → 찌름 → 낮게 회수.
                tip=(max(3,tip[0]),max(4,tip[1]))
            self.arm(im,far,(sx+3,sy+2),(sx+6,sy+1),True)
            self.weapon(im,hand,tip); self.arm(im,sh,elbow,hand)
            if self.knight: self.shield(im,sx+1,sy+3)
            if pose=='skill': plus(im,max(3,tip[0]+1),tip[1]-3,LIGHT,2)
        elif pose.startswith('cast_'):
            if pose=='cast_charge':
                self.arm(im,far,(sx-8,sy+1),(sx-7,sy-1),True)
                self.arm(im,sh,(sx,sy+3),(sx-5,sy))
                for x,y in [(sx-7,sy-2),(sx-6,sy-2),(sx-6,sy-3)]: dot(im,x,y,CYAN)
            elif pose=='cast_raise':
                hand=(sx-7,sy-14)
                self.arm(im,far,(sx+1,sy-7),(sx+3,sy-13),True)
                self.arm(im,sh,(sx-3,sy-6),hand)
                if self.mage: self.weapon(im,hand,(hand[0]-2,hand[1]-9)); self.hand(im,hand)
                else: plus(im,hand[0],hand[1]-4,CYAN,2); dot(im,hand[0],hand[1]-4,LIGHT)
            else:
                hand=(sx-11,sy-1)
                self.arm(im,far,(sx-7,sy-2),(sx-10,sy-2),True)
                self.arm(im,sh,(sx-3,sy+1),hand)
                if self.mage: self.weapon(im,hand,(hand[0]-6,hand[1]-9)); self.hand(im,hand)
                plus(im,hand[0]-4,hand[1],CYAN,3); plus(im,hand[0]-4,hand[1],LIGHT,1)
        elif pose in ('defend','guard_hit'):
            hand=(sx-6,sy-4)
            self.arm(im,far,(sx-6,sy),(sx-7,sy-1),True)
            self.weapon(im,hand,(sx-12,sy-16)); self.arm(im,sh,(sx,sy+2),hand)
            if self.knight: self.shield(im,sx-7,sy-1,True)
        elif pose in ('hit','evade'):
            hand=(sx+5,sy+3)
            self.arm(im,far,(sx-7,sy+2),(sx-7,sy+4),True)
            self.weapon(im,hand,(sx+11,sy-9)); self.arm(im,sh,(sx+7,sy),hand)
        elif pose in ('weak','dying','revive'):
            hand=(sx-7,41)
            self.arm(im,far,(sx-7,sy+2),hand,True)
            self.arm(im,sh,(sx+1,sy+2),(sx-3,sy+2))
            if pose=='revive': self.weapon(im,hand,(hand[0]-2,23)); self.hand(im,hand)
        elif pose=='item':
            hand=(sx-7,sy-8)
            self.arm(im,far,(sx-6,sy+1),(sx-6,sy+4),True)
            self.arm(im,sh,(sx-1,sy-2),hand)
            # 병은 피부색을 늘리지 않고 무기/마법 공용색으로 만든다.
            x,y=hand[0]-1,hand[1]-5
            poly(im,[(x-1,y-1),(x+1,y-1),(x+1,y+1),(x+2,y+2),(x+2,y+5),(x-2,y+5),(x-2,y+2),(x-1,y+1)],self.outline)
            line(im,(x-1,y),(x+1,y),GOLD)
            line(im,(x-1,y+3),(x+1,y+3),CYAN,2); dot(im,x-1,y+2,SILVER)
        elif pose in ('victory','victory_b'):
            # 머리는 그대로, 어깨/팔/무릎으로 환호 두 칸을 구분한다.
            v=pose=='victory_b'; hand=(sx+7,sy-9-(2 if v else 0))
            self.weapon(im,hand,(sx+9-(2 if v else 0),sy-25))
            self.arm(im,sh,(sx+7,sy-4),hand)
            self.arm(im,far,(sx-7,sy-5),(sx-7-(1 if v else 0),sy-10),True)
        if self.knight and pose in ('idle','victory','victory_b'): self.shield(im,sx-5,sy+3)
        return im

    def dead(self):
        im=blank()
        # 눕는 그림도 부위별 구성: 머리 오른쪽, 가슴은 옆면, 두 무릎은 조금 접는다.
        h=self.head.copy(); eye_y=15 if self.idx==2 else 16; ex=[9,9,8,8,9][self.idx]
        for y in (eye_y-1,eye_y):
            for x in (ex,ex+1): h.putpixel((x,y),self.skin+(255,))
        for x in (ex,ex+1): h.putpixel((x,eye_y),self.outline+(255,))
        h=h.crop(h.getbbox()).transpose(Image.Transpose.ROTATE_270)
        torso=self.torso.crop(self.torso.getbbox()).transpose(Image.Transpose.ROTATE_270)
        if self.cape.getbbox():
            cape=self.cape.crop(self.cape.getbbox()).transpose(Image.Transpose.ROTATE_270)
            im.alpha_composite(cape,(20,44-cape.height))
        self.limb(im,[(22,39),(17,37),(12,40)],'leg',True)
        self.limb(im,[(22,40),(17,41),(12,42)],'leg')
        im.alpha_composite(self.boot,(8,42))
        im.alpha_composite(torso,(20,35))
        im.alpha_composite(h,(28,44-h.height))
        self.arm(im,(26,37),(23,41),(19,42))
        self.weapon(im,(15,41 if self.mage else 43),(3,41 if self.mage else 43))
        if self.knight: self.shield(im,9,37)
        return im


def evidence(cid,poses):
    target=Path(SRC_DIR)/cid
    frames=[]; seq=[p for group in SEQUENCES for p in group]
    strip=Image.new('RGB',(192*len(seq),212),(38,42,55)); d=ImageDraw.Draw(strip)
    for i,p in enumerate(seq):
        f=poses[p].resize((192,192),Image.Resampling.NEAREST)
        strip.paste(f,(i*192,20),f); d.text((i*192+5,4),p,fill=(232,232,240))
        d.line((i*192,200,(i+1)*192-1,200),fill=(110,85,85))
        frame=Image.new('RGB',(192,212),(38,42,55)); frame.paste(f,(0,20),f)
        ImageDraw.Draw(frame).text((5,4),p,fill=(232,232,240)); frames.append(frame)
    strip.save(target/'_motion.png')
    frames[0].save(target/'_motion.gif',save_all=True,append_images=frames[1:],duration=120,loop=0,optimize=False,disposal=2)
    # 한 줄 확인판과 같은 픽셀을 다섯 동작 묶음으로 접은 읽기 편한 확인판.
    folded=Image.new('RGB',(768,212*len(SEQUENCES)),(38,42,55)); k=0
    for row,group in enumerate(SEQUENCES):
        folded.paste(strip.crop((k*192,0,(k+len(group))*192,212)),(0,row*212)); k+=len(group)
    folded.save(target/'_motion-review.png')


def main():
    for cid in sys.argv[1:] or IDS:
        assert cid in IDS, '담당 캐릭터 밖에는 쓰지 않는다'
        p=Painter(cid); poses={name:p.make(name) for name,*_ in POSES}
        target=Path(SRC_DIR)/cid; target.mkdir(exist_ok=True)
        for name,im in poses.items():
            assert im.getbbox()[3]==45,(cid,name,im.getbbox())
            assert set(im.getchannel('A').get_flattened_data())<={0,255}
            extra={c[:3] for c in im.get_flattened_data() if c[3]}-set(p.pal)
            assert extra<=set(EXTRA),(cid,name,extra)
            im.save(target/f'{name}.png')
        evidence(cid,poses)
        print(cid,'24칸 저작, 원본 팔레트+허용 6색, 알파/바닥 확인')

if __name__=='__main__': main()
