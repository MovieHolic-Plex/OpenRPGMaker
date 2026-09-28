"""Actor2 담당 다섯 명: 원본 부위 보존 + 관절별 수작업 도트 좌표."""
from pathlib import Path
import sys, math
from PIL import Image, ImageDraw
sys.dont_write_bytecode = True
BASE = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BASE))
from cb_lib import walk_frame, palette, blank, place, POSES, SRC_DIR, validate

IDS = ['actor2-3', 'actor2-2', 'actor2-4', 'actor2-5', 'actor2-6']
# 무기/빛에만 쓰는 추가 여섯 색. 몸체는 반드시 해당 캐릭터 팔레트에서 고른다.
EXTRA = [(101, 61, 31), (198, 143, 65), (111, 145, 169), (232, 244, 250), (79, 214, 232), (190, 249, 250)]
SEQUENCES = [
 ('walk', ['walk_a', 'walk_b', 'walk_c', 'walk_b']),
 ('attack', ['attack_windup', 'attack_strike', 'attack', 'attack_follow']),
 ('cast', ['cast_charge', 'cast_raise', 'cast_release']),
 ('hit', ['idle', 'hit', 'idle']),
 ('victory', ['victory', 'victory_b']),
]

def pixel(im, x, y, c):
    x,y = int(round(x)),int(round(y))
    if 0 <= x < 48 and 0 <= y < 48:
        im.putpixel((x,y), tuple(c[:3])+(255,))

def line(im, a, b, color, width=1):
    # 정수 선분: 모든 픽셀을 직접 찍으며 보간/안티앨리어싱은 하지 않는다.
    x,y = a; ex,ey = b
    n=max(abs(ex-x),abs(ey-y),1)
    for i in range(n+1):
        px,py=round(x+(ex-x)*i/n),round(y+(ey-y)*i/n)
        for oy in range(-(width//2), (width+1)//2):
            for ox in range(-(width//2), (width+1)//2): pixel(im,px+ox,py+oy,color)

def polyline(im, pts, color, width=1):
    for a,b in zip(pts,pts[1:]): line(im,a,b,color,width)

class Artist:
    def __init__(self,cid):
        self.cid=cid; self.src=walk_frame(cid,'left',1); self.pal=palette(cid)
        self.kind='sword' if cid=='actor2-4' else 'dagger' if cid=='actor2-5' else 'bow'
        self.dark=min(self.pal,key=lambda c:sum(c))
        self.skin=self.near((231,157,105)); self.skinshade=self.near((148,77,45))
        boots={'actor2-3':((52,36,24),(139,76,47)), 'actor2-2':((52,51,54),(110,108,110)), 'actor2-4':((102,34,10),(195,80,28)), 'actor2-5':((82,35,15),(150,67,27)), 'actor2-6':((59,36,10),(130,69,20))}
        self.boot=self.near(boots[cid][0]); self.bootlight=self.near(boots[cid][1])
        self.cloth=self.near({'actor2-3':(20,117,64),'actor2-2':(9,103,55),'actor2-4':(158,74,22),'actor2-5':(143,17,33),'actor2-6':(30,122,49)}[cid])
        self.clothlight=self.near({'actor2-3':(54,154,77),'actor2-2':(31,140,68),'actor2-4':(222,141,44),'actor2-5':(220,45,66),'actor2-6':(60,174,71)}[cid])
        self.head=self.src.crop((0,0,24,19))
        self.body=self.src.crop((0,19,24,26))
        # 기존 오른쪽에 늘어뜨린 팔을 제거하고 안쪽 옷 무늬를 연장한다.
        for y in range(3,7):
            for x in range(13,17):
                if self.body.getpixel((x,y))[3]:
                    ref=self.body.getpixel((11,y))
                    self.body.putpixel((x,y),ref if ref[3] else self.cloth+(255,))
    def near(self,c): return min(self.pal,key=lambda p:sum((a-b)**2 for a,b in zip(c,p)))
    def hand(self,im,p):
        x,y=p
        for dx,dy,c in [(-1,-1,self.skinshade),(0,-1,self.skin),(1,-1,self.skinshade),(-1,0,self.skin),(0,0,self.skin),(1,0,self.skinshade),(0,1,self.skinshade)]:pixel(im,x+dx,y+dy,c)
    def arm(self,im,shoulder,elbow,hand,back=False):
        polyline(im,[shoulder,elbow,hand],self.dark,4)
        line(im,shoulder,elbow,self.cloth if back else self.clothlight,2)
        line(im,elbow,hand,self.skinshade if back else self.skin,2)
        self.hand(im,hand)
    def leg(self,im,hip,knee,foot,back=False):
        polyline(im,[hip,knee,(foot[0],foot[1]-2)],self.dark,4)
        line(im,hip,knee,self.cloth if back else self.clothlight,2)
        line(im,knee,(foot[0],foot[1]-2),self.boot,3)
        line(im,(foot[0]-3,foot[1]),(foot[0]+1,foot[1]),self.dark,1)
        line(im,(foot[0]-2,foot[1]-1),(foot[0]+1,foot[1]-1),self.bootlight if not back else self.boot,1)
    def core(self,im,hx=0,hy=0,bx=0,by=0,lean=0,closed=False):
        # 머리·얼굴·후드·깃털·머리띠는 원본 픽셀을 그대로 붙인다.
        body=self.body.copy()
        for y in range(body.height):
            strip=body.crop((0,y,24,y+1))
            im.alpha_composite(strip,(12+bx+round(lean*(6-y)/6),33+by+y))
        h=self.head.copy()
        if closed:
            # 얼굴 앞쪽의 원본 눈만 감는다. 머리 장식의 흰색은 건드리지 않는다.
            eye_ranges={'actor2-3':(9,15,12,17),'actor2-2':(8,15,11,17),'actor2-4':(9,14,12,16),'actor2-5':(9,16,12,18),'actor2-6':(8,15,11,18)}
            x0,y0,x1,y1=eye_ranges[self.cid]
            for y in range(y0,y1):
                for x in range(x0,x1):
                    if h.getpixel((x,y))[3]:h.putpixel((x,y),self.skin+(255,))
            for x in range(x0,x1):
                if h.getpixel((x,y0+1))[3]: h.putpixel((x,y0+1),self.dark+(255,))
        im.alpha_composite(h,(12+hx,14+hy))
    def blade(self,im,hand,tip,dagger=False):
        x,y=hand; tx,ty=tip
        length=math.hypot(tx-x,ty-y); ux,uy=(tx-x)/length,(ty-y)/length
        reach=10 if dagger else 16
        tx,ty=round(x+ux*reach),round(y+uy*reach)
        line(im,(round(x-ux*3),round(y-uy*3)),(tx,ty),self.dark,3)
        line(im,(round(x-ux*3),round(y-uy*3)),(x,y),EXTRA[0],1)
        start=(round(x+ux*3),round(y+uy*3))
        line(im,start,(tx,ty),EXTRA[2],2)
        line(im,(start[0]+round(-uy),start[1]+round(ux)),(tx,ty),EXTRA[3])
        g=(round(x+ux*2),round(y+uy*2))
        line(im,(round(g[0]-uy*3),round(g[1]+ux*3)),(round(g[0]+uy*3),round(g[1]-ux*3)),EXTRA[1])
    def bow(self,im,hand,draw=0,arrow=False,tilt=0):
        x,y=hand
        pts=[(x+2+tilt,y-9),(x-1+tilt,y-7),(x-3,y-3),(x-3,y+3),(x-1-tilt,y+7),(x+2-tilt,y+9)]
        polyline(im,pts,self.dark,3);polyline(im,pts,EXTRA[0],2)
        polyline(im,[(p[0]-1,p[1]) for p in pts],EXTRA[1])
        polyline(im,[pts[0],(x+2+draw,y),pts[-1]],EXTRA[3])
        if arrow:
            line(im,(x-12,y),(x+draw+3,y),EXTRA[1]);line(im,(x-12,y),(x-10,y-2),EXTRA[2]);line(im,(x-12,y),(x-10,y+2),EXTRA[2])
            line(im,(x+draw+1,y-1),(x+draw+3,y+1),EXTRA[3])
    def weapon(self,im,hand,tip=None,draw=0,arrow=False,tilt=0):
        if self.kind=='bow':self.bow(im,hand,draw,arrow,tilt)
        else:self.blade(im,hand,tip or (hand[0]-9,hand[1]-12),self.kind=='dagger')
    def glow(self,im,p,small=False):
        x,y=p
        if small:
            for dx,dy in [(0,0),(0,-1),(-1,0)]:pixel(im,x+dx,y+dy,EXTRA[5])
        else:
            for dx,dy in [(0,-3),(-3,0),(3,0),(0,3)]:pixel(im,x+dx,y+dy,EXTRA[4])
            for dx,dy in [(0,-2),(0,-1),(-2,0),(-1,0),(0,0),(1,0),(2,0),(0,1),(0,2)]:pixel(im,x+dx,y+dy,EXTRA[5])
    def make(self,pose):
        im=blank()
        if pose.startswith('walk_') or pose=='front':
            return place(walk_frame(self.cid,'down' if pose=='front' else 'left',1 if pose=='front' else 'abc'.index(pose[-1])))
        if pose=='dead':
            # 부위를 따로 눕히고 무릎을 굽힌다. 머리는 오른쪽, 무기는 몸 아래에 떨어진다.
            self.leg(im,(24,38),(18,40),(12,41),True)
            self.leg(im,(24,40),(19,36),(12,40))
            body=self.body.crop(self.body.getbbox()).transpose(Image.Transpose.ROTATE_270)
            im.alpha_composite(body,(24,34))
            head=self.head.crop(self.head.getbbox()).transpose(Image.Transpose.ROTATE_270)
            im.alpha_composite(head,(29,44-head.height))
            self.arm(im,(28,38),(24,42),(20,42))
            if self.kind=='bow':
                polyline(im,[(6,43),(10,40),(17,40),(22,43)],EXTRA[0],2);line(im,(6,44),(22,44),EXTRA[3])
            else:self.blade(im,(17,44),(3,44),self.kind=='dagger')
            # 떨어진 장비를 포함해 마지막 불투명 행을44에 맞춘다.
            for y in range(45,48):
                for x in range(48):im.putpixel((x,y),(0,0,0,0))
            return im
        # 개별 관절 좌표. 상체만 통째로 옮기는 기준선으로 돌아가지 않는다.
        hx=hy=bx=by=lean=0; closed=False
        front=((23,38),(20,40),(18,44));back=((27,38),(29,40),(30,44))
        shoulder=(26,34);elbow=(22,35);hand=(18,32)
        other=((23,34),(19,36),(17,34));tip=(5,23); draw=0;arrow=False;tilt=0
        useweapon=True; light=None; small=False
        if pose=='idle':
            front=((23,38),(22,41),(20,44));back=((27,38),(27,41),(28,44))
            hx=-1;lean=-1;hand=(17,33);elbow=(23,36);other=((23,34),(21,36),(20,33))
            arrow=self.kind=='bow'
        elif pose in ('attack_windup','attack_strike','attack','attack_follow','skill'):
            if self.kind=='bow':
                data={
                 'attack_windup':(1,1,(19,33),(29,33),2,True,1),
                 'attack_strike':(0,0,(15,31),(28,31),9,True,0),
                 'attack':(-2,-1,(14,31),(29,30),0,False,0),
                 'attack_follow':(-1,1,(16,34),(27,33),0,False,1),
                 'skill':(-2,0,(14,29),(29,29),10,True,0),
                }
                hx,hy,hand,pull,draw,arrow,tilt=data[pose];bx=hx//2;by=hy;lean=-1 if hx<0 else 1
                shoulder=(25+bx,34+by);elbow=(20+bx,hand[1]);other=((25+bx,34+by),(30,36+by),pull)
                front=((23,38+by),(19,40),(16,44));back=((27,38+by),(29,41),(32,44))
            else:
                data={
                 'attack_windup':(2,0,1,0,2,(31,29),(33,25),(35,9)),
                 'attack_strike':(0,-1,0,0,-1,(23,27),(19,23),(6,10)),
                 'attack':(-3,1,-1,1,-2,(21,33),(18,32),(2,32)),
                 'attack_follow':(-2,2,-1,1,-2,(22,36),(18,35),(4,42)),
                 'skill':(-2,0,0,0,-2,(18,30),(13,27),(3,14)),
                }
                hx,hy,bx,by,lean,elbow,hand,tip=data[pose];shoulder=(26+bx,34+by)
                other=((22+bx,34+by),(26,37),(30,34))
                front=((23,38+by),(18,40),(14,44));back=((27,38+by),(30,41),(33,44))
                if pose=='attack_windup':front=((24,38),(23,41),(21,44))
                if self.kind=='dagger' and pose=='attack':elbow=(18,33);hand=(12,32)
                if self.kind=='dagger' and pose=='attack_follow':elbow=(19,36);hand=(14,37)
        elif pose in ('cast_charge','cast_raise','cast_release'):
            useweapon=False
            if pose=='cast_charge':
                hy=1;by=1;hand=(18,34);elbow=(23,37);other=((23,35),(18,37),(16,34));light=(15,33);small=True
            elif pose=='cast_raise':
                hx=1;hy=-1;hand=(18,21);elbow=(23,27);other=((24,33),(16,28),(14,23));light=(16,18)
            else:
                hx=-2;lean=-2;hand=(12,31);elbow=(18,32);other=((22,34),(17,35),(12,34));light=(7,31)
                front=((23,38),(19,40),(16,44));back=((27,38),(29,41),(32,44))
        elif pose in ('defend','guard_hit'):
            hx=1 if pose=='guard_hit' else -1;hy=4;bx=hx;by=3;lean=-1;closed=pose=='guard_hit'
            front=((23+bx,41),(19+bx,40),(18+bx,44));back=((27+bx,41),(29+bx,43),(31+bx,44))
            shoulder=(27+bx,37);elbow=(22+bx,39);hand=(19+bx,33);tip=(17+bx,18)
            other=((23+bx,37),(19+bx,38),(18+bx,35));tilt=0
        elif pose=='hit':
            hx=4;hy=1;bx=2;by=1;lean=2;closed=True
            hand=(34,35);elbow=(32,37);tip=(39,22);shoulder=(29,35);other=((24,35),(20,38),(18,36))
            front=((25,39),(24,41),(22,44));back=((28,39),(30,40),(33,44));tilt=-1
        elif pose=='evade':
            hx=5;hy=1;bx=3;by=1;lean=2;hand=(32,33);elbow=(34,36);tip=(39,23);shoulder=(31,35)
            front=((27,39),(23,41),(19,44));back=((29,39),(32,41),(34,44));other=((25,35),(26,38),(23,39))
        elif pose in ('weak','dying','revive'):
            hy=5 if pose=='dying' else 4 if pose=='weak' else 2
            hx=4 if pose=='dying' else -2;bx=2 if pose=='dying' else -1;by=hy-1;lean=2 if pose=='dying' else -2;closed=pose!='revive'
            front=((23+bx,40+by),(18,41),(17,44));back=((27+bx,40+by),(30,43),(32,44))
            shoulder=(26+bx,34+by);elbow=(23+bx,39+by);hand=(20+bx,42);tip=(5,43)
            other=((23+bx,34+by),(20,39),(19,40));tilt=1
            if self.kind=='bow':hand=(15,35)
        elif pose=='item':
            useweapon=False;hx=-1;hand=(16,25);elbow=(22,29);other=((22,34),(19,37),(18,36))
        elif pose in ('victory','victory_b'):
            hy=-1 if pose=='victory' else -2;by=hy;hx=1
            hand=(29,21 if pose=='victory' else 19);elbow=(31,28 if pose=='victory' else 26);shoulder=(27,34+by);tip=(26,3)
            other=((22,34+by),(18,28+by),(16,24+by));tilt=-1
            front=((23,38+by),(21,41),(20,44));back=((27,38+by),(28,41),(29,44))
        self.leg(im,*back,True);self.leg(im,*front)
        # 당기는 손은 활 팔보다 나중에 그려서 현과 연결한다.
        if self.kind!='bow' or pose not in ('attack_windup','attack_strike','attack','attack_follow','skill'):
            self.arm(im,*other,True)
        self.core(im,hx,hy,bx,by,lean,closed)
        if useweapon:self.weapon(im,hand,tip,draw,arrow,tilt)
        self.arm(im,shoulder,elbow,hand)
        if self.kind=='bow' and pose in ('attack_windup','attack_strike','attack','attack_follow','skill'):
            self.arm(im,*other)
        if light:self.glow(im,light,small)
        if pose=='skill':self.glow(im,(6,23),True)
        if pose=='attack' and self.kind=='bow':
            line(im,(1,31),(8,31),EXTRA[1]);line(im,(1,31),(3,29),EXTRA[2]);line(im,(1,31),(3,33),EXTRA[2])
        if pose=='item':
            # 병 입구/목/몸통을 한 픽셀씩 그린다.
            x,y=hand
            for yy,row in enumerate(['.oo.','.ss.','oddo','oddi','oddo','.oo.']):
                for xx,c in enumerate(row):
                    if c!='.':pixel(im,x+xx-2,y+yy-6,{'o':self.dark,'s':EXTRA[1],'d':EXTRA[4],'i':EXTRA[3]}[c])
            self.hand(im,hand)
        # 무릎·옷자락을 포함해 마지막 불투명 행을 정확히44에 둔다.
        for y in range(45,48):
            for x in range(48):im.putpixel((x,y),(0,0,0,0))
        return im

def motion(cid,poses):
    outdir=Path(SRC_DIR)/cid
    # 사용자 지정 순서 전체를 한 줄로 붙인 4배 최근접 확인판.
    flat=[p for _,seq in SEQUENCES for p in seq]
    out=Image.new('RGB',(192*len(flat),212),(43,47,59));d=ImageDraw.Draw(out)
    frames=[]
    for i,p in enumerate(flat):
        enlarged=poses[p].resize((192,192),Image.Resampling.NEAREST)
        out.paste(enlarged,(i*192,20),enlarged);d.text((i*192+6,4),p,fill=(236,236,240))
        fr=Image.new('RGB',(192,212),(43,47,59));fr.paste(enlarged,(0,20),enlarged)
        ImageDraw.Draw(fr).text((6,4),p,fill=(236,236,240));frames.append(fr)
    out.save(outdir/'_motion.png')
    # 고정 팔레트로 GIF 양자화에 따른 색 흔들림을 피한다.
    colors=sorted(set(c[:3] for im in poses.values() for c in im.getdata() if c[3]))+[(43,47,59),(236,236,240)]
    pimg=Image.new('P',(1,1));pimg.putpalette(sum((list(c) for c in colors),[])+[0]*(768-3*len(colors)))
    frames=[f.quantize(palette=pimg,dither=Image.Dither.NONE) for f in frames]
    frames[0].save(outdir/'_motion.gif',save_all=True,append_images=frames[1:],duration=120,loop=0,disposal=2,optimize=False)
    # 같은 셀을 동작별로 나눈 4배 확대 추가 확인판.
    review=Image.new('RGB',(768,212*5),(43,47,59));dr=ImageDraw.Draw(review)
    for j,(name,seq) in enumerate(SEQUENCES):
        for i,p in enumerate(seq):
            f=poses[p].resize((192,192),Image.Resampling.NEAREST)
            review.paste(f,(i*192,j*212+20),f);dr.text((i*192+5,j*212+3),p,fill=(236,236,240))
    review.save(outdir/'_motion_review.png')

def main():
    ids=sys.argv[1:] or IDS
    for cid in ids:
        if cid not in IDS:raise ValueError('담당하지 않는 캐릭터')
        artist=Artist(cid);poses={p[0]:artist.make(p[0]) for p in POSES}
        outdir=Path(SRC_DIR)/cid;outdir.mkdir(parents=True,exist_ok=True)
        used=set()
        for pid,im in poses.items():
            assert not validate(cid,pid,im),(cid,pid,validate(cid,pid,im))
            assert im.getbbox()[3]==45,(cid,pid,im.getbbox())
            assert set(im.getchannel('A').getdata()) <= {0,255}
            used|={c[:3] for c in im.getdata() if c[3]}
            im.save(outdir/f'{pid}.png')
        extra=used-set(artist.pal);assert extra<=set(EXTRA) and len(extra)<=6
        motion(cid,poses)
        print(cid, '24포즈, 알파/발44/추가색 검증:',len(extra),'색')

if __name__=='__main__':main()
