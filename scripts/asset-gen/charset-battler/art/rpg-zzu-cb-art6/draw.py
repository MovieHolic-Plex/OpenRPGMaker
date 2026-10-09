"""Actor4 담당 여섯 명: 원본 부위 보존 + 정수 좌표 도트 저작. 실행 경로와 무관하게 재현한다."""
from pathlib import Path
import sys, math
from PIL import Image, ImageDraw
sys.dont_write_bytecode = True
TOOL = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(TOOL))
from cb_lib import walk_frame, palette, blank, place, POSES, SRC_DIR, validate

# 그림 외부의 추가색은 금속 2색·빛 3색·금장식 1색뿐이다.
EXTRA = [(211,225,229), (112,141,151), (197,250,255), (74,203,228), (47,111,165), (233,179,66)]
CONFIG = {
 2: dict(kind='sword', skin=[(123,79,63),(187,136,118),(214,157,135)], sleeve=[(54,54,54),(110,110,110),(188,188,188)], pants=[(8,67,9),(13,100,15),(70,137,29)], boot=[(45,16,11),(95,54,17),(160,146,151)], torso=(9,15), hair=19),
 3: dict(kind='staff', skin=[(120,90,73),(198,126,94),(219,194,183)], sleeve=[(10,35,63),(66,100,119),(125,160,175)], pants=[(34,24,34),(54,54,54),(75,75,75)], boot=[(34,24,34),(150,101,23),(169,152,142)], torso=(8,15), hair=22),
 4: dict(kind='staff', skin=[(191,100,61),(231,160,109),(249,193,157)], sleeve=[(52,51,54),(90,87,94),(209,205,198)], pants=[(49,10,13),(71,25,34),(109,42,57)], boot=[(49,10,13),(109,42,57),(179,108,122)], torso=(8,15), hair=20),
 5: dict(kind='sword', skin=[(191,100,61),(231,160,109),(249,193,157)], sleeve=[(98,19,0),(147,85,36),(231,160,109)], pants=[(11,30,13),(20,117,64),(54,154,77)], boot=[(34,34,34),(115,112,102),(167,162,151)], torso=(8,15), hair=19),
 6: dict(kind='staff', skin=[(191,100,61),(231,160,109),(249,193,157)], sleeve=[(39,53,108),(68,90,148),(100,113,162)], pants=[(39,53,108),(68,90,148),(100,113,162)], boot=[(49,24,0),(141,82,35),(184,122,43)], torso=(8,16), hair=21),
 7: dict(kind='staff', skin=[(191,100,61),(231,160,109),(249,193,157)], sleeve=[(84,82,95),(169,152,142),(209,205,198)], pants=[(149,96,39),(202,140,51),(255,178,63)], boot=[(65,27,51),(149,39,53),(255,63,73)], torso=(9,16), hair=22),
}

def point(im, xy, color):
    x,y=map(int,xy)
    if 0<=x<im.width and 0<=y<im.height:
        im.putpixel((x,y),tuple(color[:3])+(255,))

def pixels(a,b):
    # 정수 Bresenham: 브러시와 무기 모두 1:1 픽셀로만 찍는다.
    x,y=a; X,Y=b; dx=abs(X-x); sx=1 if x<X else -1; dy=-abs(Y-y); sy=1 if y<Y else -1; err=dx+dy
    while True:
        yield x,y
        if (x,y)==(X,Y):break
        e=2*err
        if e>=dy:err+=dy;x+=sx
        if e<=dx:err+=dx;y+=sy

def stroke(im, points, color, width=1):
    lo=-(width//2);hi=lo+width
    for a,b in zip(points,points[1:]):
        for x,y in pixels(a,b):
            for oy in range(lo,hi):
                for ox in range(lo,hi):point(im,(x+ox,y+oy),color)

def polygon(im, vertices, color):
    # 픽셀 중심을 스캔하여 외곽선과 면을 저작한다. 보간은 쓰지 않는다.
    for y in range(min(p[1] for p in vertices),max(p[1] for p in vertices)+1):
        for x in range(min(p[0] for p in vertices),max(p[0] for p in vertices)+1):
            inside=False
            for a,b in zip(vertices,vertices[1:]+vertices[:1]):
                if (a[1]>y+.5)!=(b[1]>y+.5) and x+.5 < (b[0]-a[0])*(y+.5-a[1])/(b[1]-a[1])+a[0]:inside=not inside
            if inside:point(im,(x,y),color)
    stroke(im,vertices+[vertices[0]],color)

def add(a,b):return (a[0]+b[0],a[1]+b[1])

def nearest(colors,target):return min(colors,key=lambda c:sum((a-b)**2 for a,b in zip(c,target)))

class Artist:
    def __init__(self,n):
        self.n=n;self.cid=f'actor4-{n}';self.c=CONFIG[n];self.src=walk_frame(self.cid,'left',1);self.colors=palette(self.cid)
        self.ink=min(self.colors,key=lambda c:(max(c),sum(c)))
        self.wood=nearest(self.colors,(105,65,28));self.wood_hi=nearest(self.colors,(185,130,58))
        self.gem={3:EXTRA[3],4:(253,199,48),6:(170,115,177),7:(255,63,73)}.get(n,EXTRA[3])

    def head(self,closed=False):
        out=Image.new('RGBA',(24,32))
        for y in range(5,self.c['hair']):
            for x in range(24):
                # 후두부의 긴 머리도 보존하지만 원본의 내려놓은 팔은 가져오지 않는다.
                if y<19 or x>=16:
                    color=self.src.getpixel((x,y))
                    if color[3]:out.putpixel((x,y),color)
        if closed:
            # 흰자와 홍채 2열만 닫는다. 옆의 머리카락/볼 하이라이트는 원본 그대로 둔다.
            for yy in (14,15,16):
                for xx in (9,10):
                    point(out,(xx,yy),self.c['skin'][1 if xx==10 else 2])
            stroke(out,[(9,14),(10,15),(9,16)],self.ink)
        return out

    def body(self,im,dx=0,dy=0,lean=0,squeeze=0):
        lo,hi=self.c['torso']
        for y in range(19,28):
            for x in range(lo,hi):
                # 소매 아래 원래 손 2픽셀은 몸통 천으로 정리한다.
                col=self.src.getpixel((x,y))
                if col[3]:
                    xx=x+12+dx+round(lean*(27-y)/8)
                    yy=y+14+dy-round(squeeze*(y-19)/8)
                    im.putpixel((xx,yy),col)
        if self.n==5:
            # 갑옷 전사의 녹색 망토 어깨 원본을 유지한다.
            for y in range(19,22):
                for x in range(15,18):
                    col=self.src.getpixel((x,y))
                    if col[3]:im.putpixel((x+12+dx+lean,y+14+dy),col)
        if self.n==6:
            # 치마의 원래 체크 무늬와 회색 단을 보존한다.
            for y in range(26,30):
                for x in range(9,18):
                    col=self.src.getpixel((x,y))
                    if col[3]:im.putpixel((x+12+dx,y+14+dy-squeeze-1),col)

    def limb(self,im,pts,colors,width=4):
        stroke(im,pts,self.ink,width)
        stroke(im,pts,colors[0],max(1,width-1))
        stroke(im,[(x-1,y-1) for x,y in pts],colors[1],max(1,width-2))
        if len(pts)>1:
            a,b=pts[:2];mid=((a[0]+b[0])//2,(a[1]+b[1])//2)
            stroke(im,[add(a,(-1,-1)),add(mid,(-1,-1))],colors[2])

    def hand(self,im,p):
        x,y=p
        for ox,oy in [(-1,-1),(0,-1),(1,0),(1,1),(0,2),(-1,1),(-2,0)]:point(im,(x+ox,y+oy),self.ink)
        point(im,(x-1,y),self.c['skin'][2]);point(im,(x,y),self.c['skin'][1]);point(im,(x,y+1),self.c['skin'][0]);point(im,(x-1,y+1),self.c['skin'][1])

    def arm(self,im,shoulder,elbow,hand):
        self.limb(im,[shoulder,elbow,hand],self.c['sleeve'],4)
        self.hand(im,hand)

    def legs(self,im,dx,hip_y,style):
        # 무릎과 발목을 별도로 저작해 상체 이동과 독립된 지지발을 만든다.
        h=(24+dx,hip_y)
        table={
          'ready':([(h[0]+2,h[1]-1),(29+dx,42),(29+dx,43)],[(h[0]-1,h[1]-1),(21+dx,41),(20+dx,43)]),
          'wind':([(h[0]+2,h[1]-1),(30,41),(30,43)],[(h[0]-1,h[1]-1),(25,42),(21,43)]),
          'lunge':([(h[0]+2,h[1]-1),(29,41),(31,43)],[(h[0]-1,h[1]-1),(17,40),(16,43)]),
          'low':([(h[0]+2,h[1]-1),(30+dx,43),(28+dx,43)],[(h[0]-1,h[1]-1),(19+dx,41),(17+dx,43)]),
          'kneel':([(h[0]+2,h[1]-1),(29+dx,43),(32+dx,43)],[(h[0]-1,h[1]-1),(18+dx,40),(18+dx,43)]),
          'back':([(h[0]+2,h[1]-1),(31+dx,41),(31+dx,43)],[(h[0]-1,h[1]-1),(22+dx,42),(18+dx,43)]),
          'rise':([(h[0]+2,h[1]-1),(29+dx,43),(30+dx,43)],[(h[0]-1,h[1]-1),(20+dx,40),(18+dx,43)]),
          'cheer':([(h[0]+2,h[1]-1),(27,41),(28,43)],[(h[0]-1,h[1]-1),(22,41),(21,43)]),
        }
        back,front=table[style]
        for leg in (back,front):
            self.limb(im,leg,self.c['pants'],4)
            x,y=leg[-1]
            polygon(im,[(x-3,43),(x+1,42),(x+2,44),(x-3,44)],self.ink)
            stroke(im,[(x-2,43),(x,43)],self.c['boot'][1])
            point(im,(x-2,43),self.c['boot'][2])

    def weapon(self,im,hand,direction,kind=None,length=None):
        kind=kind or self.c['kind'];vx,vy=direction;mag=math.hypot(vx,vy);vx/=mag;vy/=mag
        def p(t,w=0):return (round(hand[0]+t*vx-w*vy),round(hand[1]+t*vy+w*vx))
        if kind=='sword':
            length=length or 15
            polygon(im,[p(3,-1),p(length-3,-1),p(length),p(length-3,1),p(3,1)],self.ink)
            stroke(im,[p(4),p(length-1)],EXTRA[0])
            stroke(im,[p(4,1),p(length-4,1)],EXTRA[1])
            stroke(im,[p(-2),p(2)],self.ink,3);stroke(im,[p(-2),p(2)],self.wood_hi)
            stroke(im,[p(3,-3),p(3,3)],self.ink,2);stroke(im,[p(3,-2),p(3,2)],EXTRA[5])
        else:
            length=length or 14
            # 무릎 자세에서는 같은 길이 지팡이의 아래쪽을 잡아 바닥 관통을 막는다.
            butt=min(7,max(1,math.floor((43-hand[1])/(-vy)))) if vy<0 else 7
            length+=7-butt
            stroke(im,[p(-butt),p(length)],self.ink,3)
            stroke(im,[p(-butt),p(length)],self.wood)
            stroke(im,[p(-max(1,butt-2),-1),p(length-2,-1)],self.wood_hi)
            tip=p(length)
            if self.n==3:
                polygon(im,[(tip[0],tip[1]-3),(tip[0]+2,tip[1]),(tip[0],tip[1]+3),(tip[0]-2,tip[1])],self.ink)
                stroke(im,[(tip[0],tip[1]-2),(tip[0],tip[1]+1)],self.gem)
                point(im,tip,EXTRA[2])
            else:
                for ox,oy in [(0,-2),(-1,-1),(0,-1),(1,-1),(-2,0),(-1,0),(0,0),(1,0),(2,0),(-1,1),(0,1),(1,1),(0,2)]:
                    point(im,(tip[0]+ox,tip[1]+oy),self.ink if abs(ox)+abs(oy)==2 else self.gem)
                point(im,(tip[0]-1,tip[1]-1),EXTRA[2]);point(im,tip,self.gem)
                stroke(im,[p(length-3,-2),p(length-4),p(length-3,2)],EXTRA[5])

    def shield(self,im,center):
        x,y=center
        polygon(im,[(x-3,y-5),(x+2,y-5),(x+3,y+1),(x,y+5),(x-3,y+2)],self.ink)
        polygon(im,[(x-2,y-4),(x+1,y-4),(x+2,y+1),(x,y+3),(x-2,y+1)],self.c['pants'][1])
        stroke(im,[(x-2,y-4),(x-2,y+1),(x,y+3)],EXTRA[5])
        stroke(im,[(x,y-3),(x,y+1)],EXTRA[0]);stroke(im,[(x-1,y-1),(x+1,y-1)],EXTRA[0])

    def spark(self,im,p,big=False):
        x,y=p
        point(im,(x,y),EXTRA[2]);point(im,(x-1,y),self.gem);point(im,(x,y-1),self.gem)
        if big:
            stroke(im,[(x-3,y),(x+3,y)],self.gem)
            stroke(im,[(x,y-3),(x,y+3)],self.gem)
            point(im,(x,y),EXTRA[2]);point(im,(x+1,y-1),EXTRA[2])
            for dx,dy in [(-5,-3),(-4,4),(3,-5)]:point(im,(x+dx,y+dy),EXTRA[3])

    def dead(self):
        im=blank()
        # 머리와 흉부를 각각 눕히고 팔·굽힌 무릎·떨어진 무기를 새로 조립한다.
        head=self.head(True);head=head.crop(head.getbbox()).transpose(Image.Transpose.ROTATE_270)
        hx=43-head.width;hy=44-head.height+1
        # 가로로 구부린 양쪽 다리와 바닥을 딛던 부츠.
        for pts in [[(23,39),(18,36),(13,39)],[(24,41),(19,42),(13,42)]]:
            self.limb(im,pts,self.c['pants'],4)
            self.limb(im,[pts[-1],(pts[-1][0]-2,pts[-1][1]+1)],self.c['boot'],4)
        torso=blank();self.body(torso)
        body=torso.crop(torso.getbbox()).transpose(Image.Transpose.ROTATE_270)
        im.alpha_composite(body,(hx-body.width+2,35))
        im.alpha_composite(head,(hx,hy))
        self.arm(im,(29,37),(26,40),(23,38))
        # 무기는 신체와 겹치지 않는 앞쪽 바닥에 놓는다.
        self.weapon(im,(11,41),(1,0),length=12)
        point(im,(17,44),self.c['boot'][0])
        return im

    def pose(self,pid):
        if pid.startswith('walk_'):return place(walk_frame(self.cid,'left','abc'.index(pid[-1])))
        if pid=='front':return place(walk_frame(self.cid,'down',1))
        if pid=='dead':return self.dead()
        # (몸 이동, 기울기, 허리 압축, 다리, 팔꿈치, 무기 손, 무기 방향, 반대 팔꿈치, 반대 손)
        poses={
         'idle':(0,0,0,0,'ready',(26,38),(21,35),(-.4,-1),(22,37),(19,37)),
         'attack_windup':(2,0,2,0,'wind',(35,32),(32,26),(.7,-1),(26,36),(24,33)),
         'attack_strike':(-1,0,-1,0,'lunge',(21,29),(17,26),(-.8,-1),(23,37),(21,33)),
         'attack':(-2,1,-2,1,'lunge',(20,35),(17,34),(-1,0),(23,38),(20,36)),
         'attack_follow':(-1,1,-1,1,'lunge',(22,38),(18,39),(-1,.12),(25,39),(23,37)),
         'hit':(2,1,3,1,'back',(36,38),(37,34),(.4,-1),(24,39),(21,36)),
         'defend':(0,4,-2,3,'low',(23,39),(19,34),(-.2,-1),(20,39),(18,36)),
         'guard_hit':(3,4,0,3,'low',(28,39),(23,35),(-.2,-1),(25,39),(21,36)),
         'cast_charge':(0,0,-1,0,'ready',(26,38),(21,35),None,(18,37),(18,34)),
         'cast_raise':(0,-1,0,0,'ready',(21,28),(18,21),(0,-1),(31,28),(31,22)),
         'cast_release':(-1,0,-1,0,'lunge',(20,34),(16,32),None,(30,39),(32,36)),
         'item':(0,0,0,0,'ready',(22,32),(18,27),None,(28,39),(29,37)),
         'weak':(0,6,-3,4,'kneel',(23,41),(20,38),(-.1,-1),(19,40),(18,39)),
         'evade':(4,1,4,1,'back',(36,40),(33,38),(.5,-1),(27,38),(25,35)),
         'skill':(-1,0,-2,0,'lunge',(21,33),(16,29),(-1,-.5),(31,35),(33,29)),
         'victory':(0,0,0,0,'cheer',(21,29),(18,24),(0,-1),(31,31),(33,27)),
         'victory_b':(0,-1,0,0,'cheer',(23,27),(20,22),(.1,-1),(31,29),(34,25)),
         'dying':(1,7,4,5,'kneel',(34,42),(37,41),(.6,-1),(28,42),(26,42)),
         'revive':(0,3,-1,2,'rise',(23,36),(19,32),(0,-1),(28,40),(26,38)),
        }
        dx,dy,lean,sq,legs,elbow,hand,angle,far_elbow,far_hand=poses[pid]
        if pid=='dying' and self.c['kind']=='staff':angle=(0,-1)
        im=blank();hip=40+dy-sq
        # 뒤쪽 팔→다리→몸통→머리→무기→앞쪽 팔의 겹침 순서를 고정한다.
        self.arm(im,(22+dx+lean,35+dy),far_elbow,far_hand)
        self.legs(im,dx,hip,legs)
        self.body(im,dx,dy,lean,sq)
        if angle is None:
            # 양손 영창 중 무기는 등/옆에 두고 방출 때는 반대 손으로 받친다.
            if pid=='cast_release':self.weapon(im,far_hand,(.1,-1))
            else:self.weapon(im,(33,37),(.25,-1))
        self.arm(im,(27+dx+lean,35+dy),elbow,hand)
        h=self.head(pid in ('hit','guard_hit','weak','dying'))
        im.alpha_composite(h,(12+dx+lean,14+dy))
        # 손과 팔뚝이 얼굴을 가로지르는 자세는 머리보다 앞에 그린다.
        self.limb(im,[elbow,hand],self.c['sleeve'],3)
        if angle is not None:self.weapon(im,hand,angle)
        self.hand(im,hand)
        if self.n==5 and pid not in ('cast_charge','cast_raise','cast_release','item','dying'):
            self.shield(im,far_hand if pid in ('defend','guard_hit','weak') else (far_hand[0]+1,far_hand[1]+1))
        if pid=='cast_charge':
            self.hand(im,far_hand);self.spark(im,(18,32))
        if pid=='cast_raise':
            self.hand(im,far_hand);self.spark(im,(31,19))
        if pid=='cast_release':self.spark(im,(12,31),True)
        if pid=='skill' and self.c['kind']=='staff':self.spark(im,(33,26),True)
        if pid=='item':
            x,y=hand
            polygon(im,[(x-1,y-6),(x+1,y-6),(x+1,y-4),(x+2,y-3),(x+2,y-1),(x-2,y-1),(x-2,y-3),(x-1,y-4)],self.ink)
            stroke(im,[(x-1,y-2),(x+1,y-2)],EXTRA[3]);point(im,(x,y-3),EXTRA[2]);stroke(im,[(x-1,y-6),(x+1,y-6)],self.wood_hi)
        return im

SEQUENCES=[('walk',['walk_a','walk_b','walk_c','walk_b']),('attack',['attack_windup','attack_strike','attack','attack_follow']),('cast',['cast_charge','cast_raise','cast_release']),('hit',['idle','hit','idle']),('victory',['victory','victory_b'])]

def motion(directory,poses):
    # 요청 순서의 한 줄 PNG와 같은 순서의 120ms GIF, 확대 검토용 구분별 PNG를 저장한다.
    sequence=[p for _,frames in SEQUENCES for p in frames]
    frames=[]
    for pid in sequence:
        canvas=Image.new('RGB',(192,212),(43,47,60));d=ImageDraw.Draw(canvas)
        d.text((6,3),pid,fill=(235,237,245))
        cell=poses[pid].resize((192,192),Image.Resampling.NEAREST)
        canvas.paste(cell,(0,20),cell)
        frames.append(canvas)
    out=Image.new('RGB',(192*len(frames),212))
    for i,frame in enumerate(frames):out.paste(frame,(192*i,0))
    out.save(directory/'_motion.png')
    frames[0].save(directory/'_motion.gif',save_all=True,append_images=frames[1:],duration=120,loop=0,disposal=2,optimize=False)
    contact=Image.new('RGB',(192*4,212*5),(43,47,60));i=0
    for row,(_,seq) in enumerate(SEQUENCES):
        for col in range(len(seq)):
            contact.paste(frames[i],(col*192,row*212));i+=1
    contact.save(directory/'_motion_detail.png')

def main():
    numbers=[int(s.split('-')[-1]) for s in sys.argv[1:]] or list(CONFIG)
    for n in numbers:
        a=Artist(n);directory=Path(SRC_DIR)/a.cid;directory.mkdir(exist_ok=True)
        poses={pid:a.pose(pid) for pid,*_ in POSES}
        for pid,im in poses.items():im.save(directory/f'{pid}.png')
        motion(directory,poses)
        issues={pid:validate(a.cid,pid,im) for pid,im in poses.items() if validate(a.cid,pid,im)}
        actual={im.getpixel((x,y))[:3] for im in poses.values() for y in range(48) for x in range(48) if im.getpixel((x,y))[3]}
        added=actual-set(a.colors)
        assert added<=set(EXTRA),(a.cid,added)
        assert len(added)<=6
        print(a.cid,'추가색',len(added),'issues',issues)

if __name__=='__main__':main()
