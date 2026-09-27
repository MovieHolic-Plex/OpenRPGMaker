"""왼쪽 걷기 칩의 머리·몸통을 보존하고 관절별로 다시 찍는 담당 5인.
실행: python3 scripts/asset-gen/charset-battler/art/rpg-zzu-cb-art4/draw.py [캐릭터...]
공용 도구·매니페스트에는 쓰지 않는다. 원본 출처는 README.md 참조.
"""
from pathlib import Path
import sys, math, json, hashlib
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent.parent))
from cb_lib import walk_frame, palette, place, blank, POSES, SRC_DIR, validate

IDS = ['actor3-0', 'actor2-7', 'actor3-1', 'actor3-2', 'actor3-3']
# 새 색은 금속 3색과 마법 3색뿐이며, 피부·옷·외곽선은 원본 팔레트다.
EXTRA = [(102,129,151),(189,218,227),(248,249,214),(80,205,225),(165,247,238),(255,215,103)]
METAL, EDGE, WHITE, LIGHT, GLOW, GOLD = EXTRA
PROFILES = {
 'actor3-0': dict(kind='sword', cloth=[(61,16,35),(150,0,37),(206,44,37)], skin=[(191,100,61),(231,160,109),(249,193,157)], boot=(52,51,54), trim=(253,199,48), eye=(10,15)),
 'actor2-7': dict(kind='bow', cloth=[(10,31,10),(13,100,15),(70,137,29)], skin=[(191,100,61),(231,160,109),(253,195,156)], boot=(63,63,57), trim=(167,183,180), eye=(10,15)),
 'actor3-1': dict(kind='sword', cloth=[(42,40,45),(67,65,70),(90,87,94)], skin=[(191,100,61),(231,160,109),(249,193,157)], boot=(86,80,68), trim=(166,157,141), eye=(10,15)),
 'actor3-2': dict(kind='dagger', cloth=[(21,22,23),(42,40,45),(67,65,70)], skin=[(129,63,29),(191,100,61),(231,160,109)], boot=(88,42,19), trim=(115,112,102), eye=(9,15)),
 'actor3-3': dict(kind='dagger', cloth=[(97,39,18),(166,66,30),(230,101,35)], skin=[(191,100,61),(231,160,109),(249,193,157)], boot=(97,39,18), trim=(209,205,198), eye=(10,15)),
}

def px(im,x,y,c):
    x,y=round(x),round(y)
    if 0 <= x < 48 and 0 <= y <= 44:
        im.putpixel((x,y),(*c[:3],255))

def points(a,b):
    x,y=a;u,v=b;n=max(abs(u-x),abs(v-y))
    return [(round(x+(u-x)*i/max(1,n)),round(y+(v-y)*i/max(1,n))) for i in range(n+1)]

def line(im,a,b,c,width=1):
    # 정수 격자 위에만 찍는다. 대각선에도 중간 알파가 생기지 않는다.
    for x,y in points(a,b):
        for oy in range(-(width//2),width-width//2):
            for ox in range(-(width//2),width-width//2):
                px(im,x+ox,y+oy,c)

def polyline(im,pts,c,width=1):
    for a,b in zip(pts,pts[1:]):line(im,a,b,c,width)

def patch(im,x,y,rows,colors):
    for j,row in enumerate(rows):
        for i,key in enumerate(row):
            if key!='.':px(im,x+i,y+j,colors[key])

class Artist:
    def __init__(self,cid):
        self.cid=cid;self.p=PROFILES[cid];self.src=walk_frame(cid,'left',1)
        self.outline=min(palette(cid),key=lambda c:sum(c));self.dark,self.mid,self.hi=self.p['cloth']
        self.skin0,self.skin1,self.skin2=self.p['skin'];self.trim=self.p['trim']
        self.head=self.src.crop((0,0,24,19))
        self.core=Image.new('RGBA',(24,32))
        for y in range(19,28 if cid=='actor3-1' else 27):
            for x in range(7,18):
                # 오른쪽에 늘어진 팔을 지워 새 어깨·팔꿈치·손으로 대체한다.
                if x>=14 and 21<=y<=25:continue
                if self.src.getpixel((x,y))[3]:self.core.putpixel((x,y),self.src.getpixel((x,y)))
        # 긴 머리/스카프는 팔과 다른 부위로 보존한다.
        self.tail=Image.new('RGBA',(24,32))
        if cid in ['actor2-7','actor3-3']:
            for y in range(19,24):
                for x in range(16,20):self.tail.putpixel((x,y),self.src.getpixel((x,y)))

    def arm(self,im,shoulder,elbow,hand,far=False,bare=False):
        polyline(im,[shoulder,elbow,hand],self.outline,4)
        polyline(im,[shoulder,elbow,hand],self.dark if far else self.mid,2)
        if not far:
            line(im,(shoulder[0]-1,shoulder[1]-1),(elbow[0]-1,elbow[1]-1),self.hi)
            if self.cid=='actor3-0':
                # 붉은 갑옷의 판금 이음 두 줄과 금색 소매 가장자리.
                px(im,elbow[0],elbow[1],self.dark)
                px(im,elbow[0]-1,elbow[1],self.trim)
            elif self.cid=='actor2-7':
                line(im,elbow,hand,self.trim,2)
            elif self.cid=='actor3-2':
                line(im,shoulder,elbow,(129,63,29),2)
                px(im,shoulder[0]-1,shoulder[1],(198,115,56))
            elif self.cid=='actor3-3':
                line(im,elbow,hand,self.skin1,2)
                px(im,elbow[0]-1,elbow[1],self.trim)
        self.hand(im,hand,far)

    def hand(self,im,h,far=False):
        x,y=h
        patch(im,x-1,y-1,['oo.','slo','.so'],dict(o=self.outline,s=self.skin0,l=self.skin1 if far else self.skin2))

    def leg(self,im,hip,knee,foot,far=False):
        polyline(im,[hip,knee,(foot[0],foot[1]-2)],self.outline,4)
        polyline(im,[hip,knee,(foot[0],foot[1]-2)],self.dark if far else self.mid,2)
        if not far:
            line(im,(hip[0]-1,hip[1]),(knee[0]-1,knee[1]),self.hi)
            if self.cid=='actor3-0':px(im,knee[0]-1,knee[1]+1,self.trim)
            if self.cid=='actor3-1':
                line(im,(hip[0]-1,hip[1]),(knee[0]-1,knee[1]),self.trim,2)
            if self.cid=='actor2-7':line(im,knee,(foot[0],foot[1]-2),self.trim,2)
        x,y=foot
        patch(im,x-3,y-2,['.bbb.','obmbo','ooooo'],dict(o=self.outline,b=self.p['boot'],m=self.mid))

    def body(self,im,cx=24,dy=0,lean=0,legs=None,closed=False,far=None,near=None):
        # 다리·머리·몸통은 독립 부위다. 몸통의 1~2px 비틀림에 관절을 맞춘다.
        hip=(cx,38+dy)
        if self.cid=='actor3-3':
            # 묶은 머리 아래의 보라 스카프가 팔 뒤에서도 보이게 바람 방향으로 잇는다.
            a=(cx+4+lean,32+dy);b=(cx+9+lean,30+dy);c=(cx+13+lean,31+dy)
            polyline(im,[a,b,c],self.outline,3)
            polyline(im,[a,b,c],(100,77,103),2)
            polyline(im,[(a[0],a[1]-1),(b[0],b[1]-1),c],(130,111,132))
        if legs is None:legs=[((cx+2,38+dy),(cx+5,41),(cx+6,44)),((cx-1,38+dy),(cx-4,40),(cx-5,44))]
        for i,(a,b,c) in enumerate(legs):self.leg(im,a,b,c,far=(i==0))
        shoulder=(cx+1+lean,33+dy)
        if far:self.arm(im,(cx-3+lean,33+dy),far[0],far[1],True)
        for y in range(19,28):
            shift=round(lean*(28-y)/9)
            for x in range(24):
                c=self.core.getpixel((x,y))
                if c[3]:px(im,cx-12+x+shift,13+dy+y,c)
        # 뒤로 흐르는 머리와 스카프도 원본 색/무늬를 그대로 쓴다.
        for y in range(19,24):
            for x in range(16,20):
                c=self.tail.getpixel((x,y))
                if c[3]:px(im,cx-12+x+lean,13+dy+y,c)
        h=self.head.copy()
        if closed:
            ex,ey=self.p['eye']
            for y in (ey,ey+1):
                for x in range(ex-1,ex+2):
                    if h.getpixel((x,y))[3]:h.putpixel((x,y),(*self.skin1,255))
            for x,y in [(ex-1,ey),(ex,ey+1),(ex+1,ey)]:h.putpixel((x,y),(*self.dark,255))
        im.alpha_composite(h,(cx-12+lean,13+dy))
        if near:self.arm(im,shoulder,near[0],near[1])
        return shoulder

    def weapon(self,im,hand,direction,length=None):
        if self.p['kind']=='bow':return self.bow(im,hand)
        x,y=hand;dx,dy=direction;m=math.hypot(dx,dy);dx/=m;dy/=m
        length=length or (14 if self.p['kind']=='sword' else 8)
        # 손잡이 3px, 작은 가드, 평행한 명암 두 줄과 뾰족한 칼끝.
        end=(round(x+dx*length),round(y+dy*length));base=(round(x+dx*3),round(y+dy*3))
        line(im,hand,end,self.outline,3)
        line(im,base,end,METAL,2)
        line(im,(base[0]+round(dy),base[1]-round(dx)),end,EDGE)
        px(im,*end,WHITE)
        line(im,(round(x-dy*2+dx*2),round(y+dx*2+dy*2)),(round(x+dy*2+dx*2),round(y-dx*2+dy*2)),self.outline)
        line(im,(round(x-dy+dx*2),round(y+dx+dy*2)),(round(x+dy+dx*2),round(y-dx+dy*2)),self.trim)
        line(im,hand,(round(x-dx*3),round(y-dy*3)),self.dark,2)
        self.hand(im,hand)

    def bow(self,im,grip,draw=0,arrow=False,released=False):
        x,y=grip
        curve=[(x+3,y-9),(x,y-7),(x-2,y-3),(x-2,y+3),(x,y+7),(x+3,y+9)]
        polyline(im,curve,self.outline,3)
        polyline(im,curve,(135,90,51),1)
        for xx,yy in curve[1:-1]:px(im,xx,yy,(216,173,80))
        polyline(im,[(x+3,y-9),(x+3+draw,y),(x+3,y+9)],(126,158,148))
        if arrow:
            end=x-9 if not released else x-12
            line(im,(end,y),(x+5+draw,y),(216,173,80))
            patch(im,end,y-1,['.m','mm','.m'],dict(m=EDGE))
            px(im,x+5+draw,y-1,self.trim)
        self.hand(im,grip)

    def spark(self,im,at,size=1):
        x,y=at
        if size==1:
            for a,b,c in [(0,0,WHITE),(-1,0,LIGHT),(0,-1,GLOW)]:px(im,x+a,y+b,c)
        else:
            for a,b,c in [(0,0,WHITE),(-1,0,GLOW),(1,0,GLOW),(0,-1,GLOW),(0,1,GLOW),(-2,0,LIGHT),(2,0,LIGHT),(0,-2,LIGHT),(0,2,LIGHT)]:px(im,x+a,y+b,c)
            if size==3:
                for a,b in [(-4,-2),(-3,3),(3,-3)]:px(im,x+a,y+b,GOLD)

    def corpse(self):
        im=blank()
        # 머리·몸통은 따로 90도 눕히고, 팔은 배 위로, 다리는 서로 다른 높이로 다시 찍는다.
        h=self.head.crop(self.head.getbbox()).transpose(Image.Transpose.ROTATE_270)
        t=self.core.crop((7,19,17,28)).transpose(Image.Transpose.ROTATE_270)
        im.alpha_composite(t,(19,34));im.alpha_composite(h,(27,31))
        self.leg(im,(20,39),(15,37),(10,42),True)
        self.leg(im,(20,40),(15,41),(10,44))
        self.arm(im,(25,37),(21,35),(19,37))
        # 쓰러진 목·등은 지면 쪽에서 연결하고, 떨어진 무기는 별도 물체로 찍는다.
        line(im,(25,42),(29,42),self.dark,2)
        if self.p['kind']=='bow':
            polyline(im,[(17,44),(20,42),(25,42),(29,44)],self.outline,2)
            polyline(im,[(17,43),(20,41),(25,41),(29,43)],(135,90,51))
            line(im,(17,44),(29,44),EDGE)
        else:
            tip=36 if self.p['kind']=='sword' else 31
            line(im,(22,44),(tip,44),self.outline)
            line(im,(26,43),(tip,43),EDGE)
            line(im,(24,42),(24,44),self.trim)
            line(im,(21,43),(23,43),self.dark)
        return im

    def make(self,pose):
        if pose=='front':return place(walk_frame(self.cid,'down',1))
        if pose.startswith('walk_'):
            im=place(walk_frame(self.cid,'left','abc'.index(pose[-1])))
            # 걷기 세 패턴은 보존하고, 보이는 손만 무기를 쥔 모양으로 보정한다.
            if self.p['kind']=='bow':self.bow(im,(16,34))
            else:self.weapon(im,(19,36),(-1,-1),length=10 if self.p['kind']=='sword' else 7)
            return im
        if pose=='dead':return self.corpse()
        im=blank();kind=self.p['kind'];bow=kind=='bow';ninja=kind=='dagger'
        cx=24;dy=0;lean=0;closed=False;legs=None
        near=((24,36),(20,35));far=((20,36),(20,37));direction=(-1,-1);hand=near[1];weapon=True;light=None
        if pose=='attack_windup':
            cx=26;lean=1;near=((31,33),(32,27));far=((26,34),(29,29));direction=(.6,-1)
            legs=[((27,38),(30,40),(32,44)),((25,38),(23,41),(21,44))]
        elif pose=='attack_strike':
            cx=23;lean=-1;near=((23,29),(18,26));far=((19,32),(17,28));direction=(-1,-1)
            legs=[((25,38),(29,41),(31,44)),((22,38),(19,40),(17,44))]
        elif pose=='attack':
            cx=23;lean=-3;dy=1;near=((18,34),(14,33));far=((23,34),(20,34));direction=(-1,0)
            legs=[((25,39),(30,41),(33,44)),((22,39),(18,41),(15,44))]
        elif pose=='attack_follow':
            cx=23;lean=-2;dy=1;near=((20,36),(16,37));far=((21,37),(18,36));direction=(-1,.4)
            legs=[((25,39),(29,41),(31,44)),((22,39),(18,41),(17,44))]
        elif pose in ['defend','guard_hit']:
            cx=25+(2 if pose=='guard_hit' else 0);dy=4;lean=-1;closed=pose=='guard_hit'
            near=((cx-5,38),(cx-8,33));far=((cx-7,37),(cx-7,34));direction=(0,-1)
            legs=[((cx+1,41),(cx+5,42),(cx+6,44)),((cx-2,41),(cx-5,42),(cx-6,44))]
        elif pose=='hit':
            cx=27;lean=3;dy=1;closed=True;near=((34,36),(36,32));far=((24,33),(20,32));direction=(.6,-1)
            legs=[((28,39),(30,42),(32,44)),((26,39),(24,41),(21,44))]
        elif pose=='evade':
            cx=29;lean=3;dy=2;near=((35,35),(36,30));far=((27,36),(25,38));direction=(.4,-1)
            legs=[((30,40),(34,42),(36,44)),((28,40),(24,41),(21,44))]
        elif pose in ['weak','revive']:
            dy=5 if pose=='weak' else 3;lean=-2 if pose=='weak' else 0
            near=((21,39),(18,40)) if pose=='weak' else ((24,37),(21,35))
            far=((26,40),(28,42));direction=(-.3,-1);closed=pose=='weak'
            legs=[((25,38+dy),(29,43),(30,44)),((22,38+dy),(18,41),(17,44))]
        elif pose=='dying':
            dy=6;cx=26;lean=4;closed=True;near=((31,41),(28,43));far=((26,40),(23,41));direction=(-1,0)
            legs=[((28,42),(23,43),(20,44)),((25,42),(18,42),(15,44))]
        elif pose in ['victory','victory_b']:
            second=pose=='victory_b';dy=-1 if second else 0;lean=-1 if second else 0
            near=((30,30-int(second)),(31,24-int(second)*2));far=((18,31),(17,27-int(second)*2));direction=(0,-1)
            legs=[((26,38+dy),(29,40),(30,44)),((23,38+dy),(21,41),(20,44))]
        elif pose=='cast_charge':
            dy=1;near=((23,36),(19,33));far=((18,35),(18,33));weapon=False;light=((17,31),1)
        elif pose=='cast_raise':
            near=((30,27),(29,21));far=((16,28),(16,23));weapon=False;light=((29,18),2)
        elif pose=='cast_release':
            cx=23;lean=-2;near=((19,33),(13,31));far=((18,35),(15,33));weapon=False;light=((9,30),3)
            legs=[((25,38),(29,40),(31,44)),((22,38),(19,41),(17,44))]
        elif pose=='item':
            near=((22,32),(17,27));far=((23,37),(22,39));weapon=False
        elif pose=='skill':
            cx=23;dy=1;lean=-2;near=((20,29),(16,26));far=((30,33),(34,30));direction=(-1,-1)
            legs=[((25,39),(30,41),(34,44)),((22,39),(17,40),(14,44))]
        # 닌자는 검객의 양손 베기 대신 반대 손을 뒤로 빼며 단검을 내지른다.
        if ninja and pose in ['idle','attack_windup','attack_strike','attack','attack_follow','skill']:
            far=((cx+5,35+dy),(cx+8,33+dy))
            if pose=='idle':near=((24,36),(19,35));direction=(-1,-.3)
            if pose=='attack_strike':near=((20,31),(16,29));direction=(-1,-.5)
            if pose=='attack':near=((17,33),(12,32));direction=(-1,-.15)
            if pose=='attack_follow':near=((18,36),(14,36));direction=(-1,.5)
        # 엘프의 왼손은 활 중심, 오른손은 시위. 당김→조준→발사→여운.
        bow_draw=0;bow_arrow=False;bow_release=False
        if bow:
            if pose in ['idle','attack_windup','attack_strike','attack','attack_follow','skill']:
                cx=24;dy=0;lean=0;legs=None
                grip=(14,32)
                draw={'idle':1,'attack_windup':5,'attack_strike':9,'attack':0,'attack_follow':0,'skill':9}[pose]
                right={'idle':(21,35),'attack_windup':(22,32),'attack_strike':(26,32),'attack':(28,30),'attack_follow':(27,34),'skill':(26,31)}[pose]
                far=((19,33),grip);near=((28,34),right);bow_draw=draw
                bow_arrow=pose in ['attack_windup','attack_strike','attack','skill'];bow_release=pose=='attack'
                if pose=='skill':
                    cx=23;dy=1;lean=-1;grip=(12,31)
                    far=((18,34),grip);near=((29,34),(24,31));light=((4,28),1)
                    legs=[((25,39),(30,41),(34,44)),((22,39),(17,41),(14,44))]
            else:
                if pose=='weak':near=((21,38),(17,35))
                if pose=='dying':weapon=False
                grip=near[1]
        self.body(im,cx,dy,lean,legs,closed,far,near)
        if weapon:
            if bow:
                self.bow(im,grip,bow_draw,bow_arrow,bow_release)
                # 시위 당기는 오른손은 화살 위로 덮어 쥔 느낌을 보존한다.
                self.hand(im,near[1])
            else:
                length=12 if pose=='attack' and kind=='sword' else None
                self.weapon(im,near[1],direction,length)
                if pose=='attack_strike':
                    # 검의 실제 이동과 겹치지 않는 짧은 궤적(항상 불투명).
                    polyline(im,[(9,26),(11,23),(14,21)] if ninja else [(9,22),(11,18),(15,15)],METAL)
                    if kind=='sword':polyline(im,[(11,23),(13,20)],EDGE)
                if pose=='skill':self.spark(im,(8,17),2)
        if bow and pose=='dying':
            polyline(im,[(8,44),(11,41),(17,41),(20,44)],self.outline,2)
            polyline(im,[(8,43),(11,40),(17,40),(20,43)],(135,90,51))
            line(im,(8,44),(20,44),(126,158,148))
        if light:self.spark(im,*light)
        if pose=='item':
            patch(im,15,21,['.oo.','.gg.','oeeo','olle','olgo','.oo.'],dict(o=self.outline,g=METAL,e=EDGE,l=LIGHT))
            self.hand(im,(17,27))
        return im

SEQUENCES=[('walk',['walk_a','walk_b','walk_c','walk_b']),('attack',['attack_windup','attack_strike','attack','attack_follow']),('cast',['cast_charge','cast_raise','cast_release']),('hit',['idle','hit','idle']),('victory',['victory','victory_b'])]

def motion(out,poses):
    order=[p for _,seq in SEQUENCES for p in seq]
    # 요청한 모든 동작을 하나의 가로 띠로 나열한다.
    png=Image.new('RGB',(192*len(order),218),(42,46,59));d=ImageDraw.Draw(png)
    frames=[]
    for i,p in enumerate(order):
        f=poses[p].resize((192,192),Image.Resampling.NEAREST)
        png.paste(f,(i*192,20),f);d.text((i*192+3,3),p,fill=(235,237,244))
        frame=Image.new('RGB',(192,218),(42,46,59));frame.paste(f,(0,20),f)
        ImageDraw.Draw(frame).text((3,3),p,fill=(235,237,244));frames.append(frame)
    png.save(out/'_motion.png')
    frames[0].save(out/'_motion.gif',save_all=True,append_images=frames[1:],duration=120,loop=0,disposal=2,optimize=False)
    # 실제 판독은 4배를 유지하는 개별 행 확인판에서도 한다.
    panel=Image.new('RGB',(768,218*5),(42,46,59));d=ImageDraw.Draw(panel)
    for row,(label,seq) in enumerate(SEQUENCES):
        for col,p in enumerate(seq):
            f=poses[p].resize((192,192),Image.Resampling.NEAREST)
            panel.paste(f,(192*col,row*218+20),f);d.text((192*col+3,row*218+3),p,fill=(235,237,244))
    panel.save(out/'_motion_review.png')

def main():
    for cid in sys.argv[1:] or IDS:
        if cid not in IDS:raise ValueError('담당하지 않는 캐릭터: '+cid)
        a=Artist(cid);out=Path(SRC_DIR)/cid;out.mkdir(exist_ok=True)
        poses={pid:a.make(pid) for pid,*_ in POSES}
        report={};source_colors=set(palette(cid));allowed=source_colors|set(EXTRA)
        for p,im in poses.items():
            problems=validate(cid,p,im)
            assert not problems,(cid,p,problems)
            assert im.getbbox()[3]==45,(cid,p,'발 기준선',im.getbbox())
            colors={c[:3] for c in im.get_flattened_data() if c[3]}
            assert colors<=allowed,(cid,p,colors-allowed)
            im.save(out/(p+'.png'))
            report[p]={'bounds':im.getbbox(),'newColors':len(colors-source_colors),'sha256':hashlib.sha256(im.tobytes()).hexdigest()}
        motion(out,poses)
        (out/'_validation.json').write_text(json.dumps({'character':cid,'poses':report,'extraColors':EXTRA,'source':'public/assets/easyrpg/charset/'+('Actor2.png' if cid=='actor2-7' else 'Actor3.png'),'allGroundY':44,'alpha':[0,255]},indent=2)+'\n')
        print(cid,'24개 원본 포즈 저장; 알파·색·정확한 발 기준선 검증')

if __name__=='__main__':main()
