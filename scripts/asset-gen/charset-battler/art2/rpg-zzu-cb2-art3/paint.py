"""담당 다섯 명의 무장 보행과 속성별 시전 도트. 원본 부위 + 관절별 정수 좌표 저작."""
from pathlib import Path
import importlib.util
import json
import sys
from PIL import Image, ImageDraw

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
BASE = HERE.parents[1]
sys.path.insert(0, str(BASE))
from cb_lib import CAST_TYPES, POSES, SRC_DIR, walk_frame, palette, blank, place, validate


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


old = module('first_archer_artist', BASE / 'art/rpg-zzu-cb-art3/paint.py')
scout = module('first_scout_artist', BASE / 'art/rpg-zzu-cb-art5/draw.py')
IDS = ['actor4-0', 'actor2-2', 'actor2-3', 'actor2-4', 'actor2-5']
pixel, line, polyline = old.pixel, old.line, old.polyline
# 부족한 속성색만 추가한다. 전투 24칸과 시전 21칸 전체 합집합에서 여섯 색 이하다.
EXTRA = {
    'actor4-0': [(255, 85, 40), (255, 225, 76), (158, 240, 88), (172, 95, 235), (74, 225, 224), (255, 155, 212)],
    'actor2-2': [(255, 85, 40), (158, 240, 88), (172, 95, 235), (74, 225, 224), (255, 155, 212), (215, 183, 255)],
    'actor2-3': [(255, 85, 40), (255, 225, 76), (158, 240, 88), (172, 95, 235), (74, 225, 224), (255, 155, 212)],
    'actor2-4': [(176, 215, 255), (158, 240, 88), (74, 225, 224), (255, 155, 212), (215, 183, 255)],
    'actor2-5': [(255, 225, 76), (158, 240, 88), (74, 225, 224), (215, 183, 255)],
}
# 각 행: 머리(좌우,높이), 몸통(좌우,높이), 앞무릎/발, 뒷무릎/발,
# 빈손 팔꿈치/손끝, 무기손 팔꿈치/손끝. 통짜 이동/회전으로 동작을 대체하지 않는다.
GESTURES = {
 'fire': [
  ((2,1),(1,1),(23,41),(21,44),(30,41),(31,44),(31,38),(32,35),(31,39),(31,37)),
  ((-1,0),(0,0),(21,41),(19,44),(28,41),(30,44),(23,36),(18,32),(20,37),(18,34)),
  ((-2,1),(-1,1),(17,40),(14,44),(29,41),(33,44),(19,33),(12,32),(17,36),(12,35)),
 ],
 'ice': [
  ((0,0),(0,0),(22,41),(20,44),(28,41),(29,44),(19,36),(27,30),(29,35),(19,30)),
  ((0,-1),(0,0),(21,41),(19,44),(29,41),(31,44),(18,27),(15,21),(30,38),(35,33)),
  ((-1,-1),(0,-1),(21,40),(18,44),(29,40),(31,44),(27,26),(25,18),(18,34),(12,30)),
 ],
 'thunder': [
  ((1,3),(1,2),(20,41),(18,44),(30,41),(32,44),(32,34),(36,30),(22,38),(19,35)),
  ((0,-1),(0,-1),(22,40),(20,44),(29,40),(30,44),(27,25),(27,15),(24,37),(19,35)),
  ((-2,3),(-1,2),(17,41),(15,44),(29,42),(32,44),(19,35),(12,39),(28,36),(31,32)),
 ],
 'heal': [
  ((-1,2),(0,1),(23,41),(22,44),(27,41),(28,44),(22,37),(19,34),(19,37),(18,35)),
  ((0,-1),(0,-1),(23,40),(21,44),(28,40),(29,44),(18,29),(13,24),(32,29),(36,24)),
  ((-1,0),(0,0),(22,41),(20,44),(28,41),(29,44),(20,35),(13,34),(28,37),(29,34)),
 ],
 'dark': [
  ((-1,4),(-1,3),(18,42),(16,44),(28,43),(31,44),(18,38),(18,32),(27,40),(30,35)),
  ((2,2),(1,2),(23,42),(21,44),(30,42),(33,44),(32,32),(36,25),(26,39),(29,36)),
  ((-3,3),(-2,2),(17,41),(14,44),(29,41),(33,44),(18,33),(10,31),(27,39),(30,36)),
 ],
 'arcane': [
  ((-1,0),(0,0),(22,41),(20,44),(28,41),(29,44),(21,33),(18,27),(29,37),(30,34)),
  ((0,-1),(0,0),(22,41),(20,44),(29,40),(31,44),(32,25),(29,16),(28,38),(31,35)),
  ((-2,0),(-1,0),(20,40),(17,44),(29,41),(32,44),(19,30),(12,27),(29,37),(31,34)),
 ],
 'support': [
  ((0,0),(0,0),(23,41),(21,44),(28,41),(29,44),(21,32),(18,26),(28,38),(30,35)),
  ((0,1),(0,1),(23,41),(21,44),(29,42),(31,44),(33,34),(39,31),(25,38),(29,36)),
  ((-2,1),(-1,1),(22,41),(20,44),(28,41),(30,44),(19,36),(15,31),(28,38),(29,35)),
 ],
}


class Artist(old.Artist):
    def __init__(self, cid):
        self.is_scout = cid == 'actor4-0'
        if not self.is_scout:
            super().__init__(cid)
        else:
            p = scout.Painter(cid)
            self.scout = p
            self.cid, self.src, self.pal = cid, p.src, palette(cid)
            self.kind, self.dark = 'dagger', p.out
            self.skin, self.skinshade = p.skin, p.skinshade
            self.cloth, self.clothlight = p.s['shade'], p.s['cloth']
            self.boot, self.bootlight = p.s['boot'], p.s['toe']
            self.head, self.body = p.head, p.torso
        self.allowed = self.pal + EXTRA[cid]
        # 1차 무기색은 피부/의복 팔레트의 갈색·금색·회청·흰색으로 대체한다.
        self.weapon_colors = [self.near(c) for c in [(101,61,31),(198,143,65),(111,145,169),(232,244,250)]]
        self.remap = {tuple(c): self.near(c) for c in old.EXTRA + scout.EXTRA}
        self.remap.update({(79,214,232):self.color((74,225,224)), (190,249,250):self.near((255,255,255))})
        self.light_records = {}

    def color(self, wanted):
        return min(self.allowed, key=lambda c:sum((a-b)**2 for a,b in zip(c,wanted)))

    def clean(self, im):
        im = im.copy()
        for y in range(48):
            for x in range(48):
                c = im.getpixel((x,y))
                if c[3] and c[:3] not in self.allowed:
                    im.putpixel((x,y), self.remap.get(c[:3],self.near(c[:3]))+(255,))
        return im

    def core(self, im, hx=0, hy=0, bx=0, by=0, lean=0, closed=False):
        if not self.is_scout:
            return super().core(im,hx,hy,bx,by,lean,closed)
        p = self.scout
        im.alpha_composite(self.body,(12+bx,33+by))
        p.head_at(im,hx,hy,closed)

    def arm(self, im, shoulder, elbow, hand, back=False):
        if not self.is_scout:
            return super().arm(im,shoulder,elbow,hand,back)
        # 정찰병의 어두운 긴소매를 유지한다.
        polyline(im,[shoulder,elbow,hand],self.dark,4)
        polyline(im,[shoulder,elbow,hand],self.cloth if back else self.clothlight,2)
        line(im,(hand[0]+1,hand[1]-1),(hand[0]+1,hand[1]+1),(207,185,165))
        self.hand(im,hand)

    def leg(self, im, hip, knee, foot, back=False):
        if not self.is_scout:
            return super().leg(im,hip,knee,foot,back)
        self.scout.leg(im,hip,knee,foot,back)

    def held_bow(self, im, hand):
        if hand[1] <= 34:
            self.bow(im,hand,arrow=False,tilt=0)
            return
        # 허리 아래에 쥔 활만 가로로 돌린다. 인물 전체의 회전/축소는 없다.
        weapon=blank()
        self.bow(weapon,(24,24),arrow=False,tilt=0)
        for y in range(48):
            for x in range(48):
                c=weapon.getpixel((x,y))
                if c[3]:pixel(im,hand[0]+y-24,hand[1]-(x-24),c)

    def cast(self, kind, step):
        h,t,fk,ff,bk,bf,el,hand,bel,bhand = GESTURES[kind][step-1]
        hx,hy=h; bx,by=t
        im=blank()
        self.leg(im,(27+bx,38+by),bk,bf,True)
        self.leg(im,(23+bx,38+by),fk,ff)
        # 몸통의 중심선/목과 허리 위치가 다르고, 양팔과 양다리는 각각 새로 그린다.
        self.arm(im,(23+bx,34+by),bel,bhand,True)
        self.core(im,hx,hy,bx,by,0,kind=='heal' and step==1)
        # 무기는 후방 손에 계속 쥔다. 활은 세로, 칼은 몸 바깥 위쪽을 향한다.
        if self.kind=='bow':
            self.held_bow(im,bhand)
        else:
            tip=(bhand[0]+3,bhand[1]-15)
            self.blade(im,bhand,tip,self.kind=='dagger')
        self.hand(im,bhand)
        self.arm(im,(26+bx,34+by),el,hand)
        # 몸통을 새 팔에 맞춰 어깨·허리의 의복 도트로 봉합한다.
        line(im,(24+bx,35+by),(24+bx,38+by),self.cloth)
        if kind=='fire' and step==2:
            line(im,(22+bx,38+by),(26+bx,37+by),self.clothlight)
        self.fingers(im,hand,kind,step)
        im=self.clean(im)
        self.spark(im,hand,kind,step)
        self.light_records[f'cast_{kind}_{step}']['hands']=[list(hand),list(bhand)]
        return im

    def fingers(self,im,hand,kind,step):
        x,y=hand
        if (kind=='dark' and step in (1,3)):
            # 갈퀴: 세 손가락이 따로 앞으로 구부러진다.
            for dy in (-2,0,2):
                line(im,(x,y+dy//2),(x-2,y+dy),self.skin)
                pixel(im,x-3,y+dy+1,self.skinshade)
        elif kind in ('ice','heal','fire') and step==3:
            line(im,(x-1,y-2),(x-1,y+1),self.skin)
            pixel(im,x-2,y-2,self.skin)
        elif kind=='arcane':
            line(im,(x-1,y),(x-3,y-1 if step==3 else y-2),self.skin)
        elif kind=='support':
            if step==3:line(im,(x-2,y+1),(x+1,y+1),self.skin)
            else:line(im,(x-1,y-2),(x+1,y-3),self.skin)

    def spark(self,im,hand,kind,step):
        targets={
          'fire':((255,85,40),(196,13,19)), 'ice':((176,215,255),(255,255,255)),
          'thunder':((255,225,76),(255,255,255)), 'heal':((158,240,88),(255,255,255)),
          'dark':((172,95,235),(0,0,0)), 'arcane':((74,225,224),(255,255,255)),
          'support':((255,155,212),(215,183,255)),
        }
        c1,c2=map(self.color,targets[kind])
        patterns={
          'fire':[(0,0),(0,-1),(1,-1),(1,-2),(-1,0),(-1,1),(0,1),(1,0),(0,-2)],
          'ice':[(0,0),(0,-1),(0,1),(-1,0),(1,0),(-1,-1),(1,1),(-1,1),(1,-1)],
          'thunder':[(0,0),(1,-1),(1,-2),(0,-2),(0,-3),(-1,1),(-1,2),(0,1),(1,1)],
          'heal':[(0,0),(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)],
          'dark':[(0,0),(1,0),(1,-1),(0,-2),(-1,-1),(-1,1),(0,1),(1,1),(0,-1)],
          'arcane':[(0,0),(0,-1),(-1,0),(1,0),(0,1),(-1,-1),(1,1),(-1,1),(1,-1)],
          'support':[(0,0),(1,-1),(-1,1),(1,1),(-1,-1),(0,-2),(2,0),(-2,0),(0,2)],
        }
        # 앞으로 날리지 않고 손 주변 몇 픽셀 안으로 제한한다.
        x,y=hand
        cx,cy=(x-3,y-3)
        if kind in ('thunder','arcane') and step==2:cx,cy=x,y-3
        if kind=='support' and step==3:cx,cy=x-3,y-1
        n=(3,6,9)[step-1]
        coords=[]
        for i,(dx,dy) in enumerate(patterns[kind][:n]):
            px,py=cx+dx,cy+dy
            pixel(im,px,py,c2 if i%3==0 else c1)
            coords.append([px,py])
        self.light_records[f'cast_{kind}_{step}']={'pixels':coords,'count':n}

    def walk(self, step):
        im=blank()
        # 원본 보행의 0/1/2 다리와 발은 그대로, 팔은 무기 손잡이에 맞춰 다시 찍는다.
        src=place(walk_frame(self.cid,'left',step))
        im.alpha_composite(src.crop((0,40,48,45)),(0,40))
        self.core(im)
        bx=[30,28,29][step];by=[36,37,35][step]
        self.arm(im,(23,34),(27,37),(bx,by),True)
        hand=(17+[0,1,0][step],33+[0,1,0][step])
        self.weapon(im,hand,(10,22),arrow=False)
        self.arm(im,(26,34),(23,36),hand)
        return self.clean(im)

    def bow_melee(self, pid):
        # 근접 공격은 활몸을 세워 뒤로 준비 → 앞 위 → 앞 타격 → 아래 회수한다.
        data={
          'attack_windup':((2,0),(1,0),(31,30),(32,27),(25,33),(28,33)),
          'attack_strike':((0,-1),(0,0),(22,28),(18,24),(23,33),(19,32)),
          'attack':((-2,1),(-1,1),(18,33),(12,31),(20,36),(14,35)),
          'attack_follow':((-1,2),(-1,1),(20,36),(15,34),(22,38),(17,37)),
        }
        h,t,e,p,be,bp=data[pid];hx,hy=h;bx,by=t
        im=blank()
        self.leg(im,(27+bx,38+by),(29,41),(32,44),True)
        self.leg(im,(23+bx,38+by),(20 if pid=='attack_windup' else 18,40),(19 if pid=='attack_windup' else 15,44))
        self.arm(im,(23+bx,34+by),be,bp,True)
        self.core(im,hx,hy,bx,by)
        self.bow(im,p,arrow=False,tilt=0)
        self.arm(im,(26+bx,34+by),e,p)
        return self.clean(im)

    def combat(self, pid):
        if pid.startswith('walk_'):return self.walk('abc'.index(pid[-1]))
        if pid in ('cast_charge','cast_raise','cast_release'):
            return self.cast('arcane',('cast_charge','cast_raise','cast_release').index(pid)+1)
        if self.kind=='bow' and pid in ('attack_windup','attack_strike','attack','attack_follow'):
            return self.bow_melee(pid)
        if self.is_scout:
            p=self.scout
            p.s=dict(p.s,weapon='dagger')
            if pid=='hit':
                # QA 2026-09-28: 1차 표(art5 'hit')는 머리 y-1·몸 y+1 이라 목 두 줄이 비어 머리가 떠 보였다.
                # 공유 1차 표는 다른 캐릭터도 쓰므로 정찰병 피격에서만 머리를 한 줄 내린다(다른 포즈의 최대 틈 1줄과 같게).
                head_at=p.head_at
                p.head_at=lambda im,dx,dy,closed=False:head_at(im,dx,dy+1,closed)
                try:im=p.pose(pid)
                finally:del p.head_at
            else:im=p.pose(pid)
        else:im=super().make(pid)
        # 아이템 사용과 정면에서도 다른 손에 같은 무기를 둔다.
        if pid in ('item','front'):
            hand=(30,36) if pid=='item' else (32,34)
            self.held_bow(im,hand) if self.kind=='bow' else self.weapon(im,hand,(35,22),arrow=False)
            self.arm(im,(27,35),(30,38),hand,True)
        return self.clean(im)


def gif(path, frames, duration=160):
    # 한 팔레트를 공유하여 GIF 양자화로 원본 도트가 흔들리지 않게 한다.
    colors=sorted(set(c[:3] for f in frames for c in f.getdata()))
    assert len(colors)<=256
    color_index={c:i for i,c in enumerate(colors)}
    color_table=sum(map(list,colors),[])+[0]*(768-len(colors)*3)
    converted=[]
    # 근사 양자화 대신 정확한 RGB → 팔레트 인덱스를 쓴다.
    for frame in frames:
        indexed=Image.new('P',frame.size)
        indexed.putpalette(color_table)
        indexed.putdata([color_index[c] for c in frame.getdata()])
        converted.append(indexed)
    frames=converted
    frames[0].save(path,save_all=True,append_images=frames[1:],duration=duration,loop=0,disposal=2,optimize=False)


def evidence(cid,cast,combat):
    out=Path(SRC_DIR)/cid
    # 7종을 가로 한 줄에 두고 각 속성의 1→2→3칸을 동시에 재생한다.
    frames=[]
    for step in (1,2,3):
        f=Image.new('RGB',(192*7,212),(52,56,72));d=ImageDraw.Draw(f)
        for col,(kind,_) in enumerate(CAST_TYPES):
            im=cast[f'cast_{kind}_{step}'].resize((192,192),Image.Resampling.NEAREST)
            f.paste(im,(col*192,20),im);d.text((col*192+5,3),kind,fill=(255,255,255))
        frames.append(f)
    gif(out/'_cast.gif',frames)
    # 정적인 7행×3열 시트와 별개로 공격/보행 전환을 검토한다.
    order=['walk_a','walk_b','walk_c','walk_b','attack_windup','attack_strike','attack','attack_follow']
    frames=[]
    for pid in order:
        f=Image.new('RGB',(192,212),(52,56,72));im=combat[pid].resize((192,192),Image.Resampling.NEAREST)
        f.paste(im,(0,20),im);ImageDraw.Draw(f).text((5,3),pid,fill='white');frames.append(f)
    gif(out/'_armed_motion.gif',frames)
    # 1차 동작 증거도 현행 원화로 갱신하여 예전 비무장 칸이 남지 않게 한다.
    if cid=='actor4-0':scout.motion(cid,combat)
    else:old.motion(cid,combat)


def main():
    ids=sys.argv[1:] or IDS
    for cid in ids:
        if cid not in IDS:raise ValueError('담당 캐릭터만 쓸 수 있다')
        a=Artist(cid)
        cast={f'cast_{kind}_{step}':a.cast(kind,step) for kind,_ in CAST_TYPES for step in (1,2,3)}
        combat={pid:a.combat(pid) for pid,_,_,_ in POSES}
        used=set()
        for pid,im in {**cast,**combat}.items():
            assert not validate(cid,pid,im),(cid,pid,validate(cid,pid,im))
            assert im.getbbox()[3]==45,(cid,pid,im.getbbox())
            used|={c[:3] for c in im.getdata() if c[3]}
            im.save(Path(SRC_DIR)/cid/f'{pid}.png')
        assert len(used-set(a.pal))<=6,(cid,used-set(a.pal))
        evidence(cid,cast,combat)
        (Path(SRC_DIR)/cid/'_cast_art.json').write_text(json.dumps({'id':cid,'weapon':a.kind,'extraColors':sorted(used-set(a.pal)),'lights':a.light_records},indent=2)+'\n')
        print(cid,'시전 21칸/전투 24칸, 발44/알파/색 통과:',len(used-set(a.pal)))


if __name__=='__main__':main()
