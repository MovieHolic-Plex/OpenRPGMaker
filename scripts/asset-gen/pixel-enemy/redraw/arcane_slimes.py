"""Native64 hand drawn gelatin anatomy, surface planes and reflections."""
from arcane_core import Pixels,PAL,palette,SWING
SPECIES={
'slime':'청록색 비대칭 젤리 몸에 두꺼운 밝은 반사 띠와 돌출한 눈살, 작은 코와 입이 있다.',
'slime-red':'붉은 젤리의 갈라진 불꽃 볏과 깊은 입 안, 주황색 반사 덩어리가 보인다.',
'slime-blue':'군청색 젤리가 넓은 어깨처럼 두꺼운 윗면과 떠 있는 밝은 기포, 큰 눈살을 갖는다.',
'slime-green':'연두색 젤리에 긴 잎 볏과 뒤쪽 잎 주름, 작은 녹색 기포가 달린다.',
'slime-metal':'넓고 각진 은회색 액체 금속 덩어리에 밝고 어두운 반사 띠와 납작한 큰 코가 있다.',
'king-slime-01':'거대한 파랑 젤리 왕이 세 갈래 금빛 왕관과 붉은 보석, 넓은 턱을 갖는다.',
'slime-king':'큰 보라색 슬라임이 둥근 붉은 왕실 모자와 금빛 띠, 긴 수염 같은 젤리 주름을 갖는다.',
'slime-cube':'초록색 투명 큐브의 세 면에 반사 띠와 갇힌 뼈 조각이 있고 오른쪽 면에서 눈과 입이 보인다.',
'ooze-black':'먹보라색 우즈가 낮은 비대칭 웅덩이로 흐르고 두꺼운 촉수 눈살과 날카로운 입을 갖는다.',
'ooze-acid':'노란 산성 우즈의 솟은 기포 목과 길게 굽은 오른쪽 촉수, 밝은 점액 주름이 보인다.'}
RAMPS={
'slime':('234951','356b71','509597','89c2b2','c7e1be'),
'slime-red':('593244','8e444e','c2695c','e99e7a','f6d39a'),
'slime-blue':('263c63','3e5a91','6588ba','9ebfd4','d8e9d4'),
'slime-green':('38523e','587948','8eac65','b8ce8b','e2e5b1'),
'slime-metal':('2e414f','4d6574','7d96a0','b4c6c3','edead4'),
'king-slime-01':('294066','456699','789bc1','aecfdb','e6edcd'),
'slime-king':('4b3758','754c80','a677a6','d2a4c5','eed6dd'),
'slime-cube':('2f5143','4d7d65','80ad87','b1ceb1','e0e7c6'),
'ooze-black':('202b3c','343b54','575876','8581a1','bab0c0'),
'ooze-acid':('465233','70823e','a8af55','d7d57f','f0e5a9')}
def draw(slug,pose,cell):
    p=Pixels(pose,cell,palette(RAMPS[slug]));p.part='fixed';sw=SWING[pose];king=slug in ('king-slime-01','slime-king');cube=slug=='slime-cube';goo=slug.startswith('ooze');metal=slug=='slime-metal'
    dx={'windup':-2,'move':1,'attack':3,'hit':-3}.get(pose,0);top={'idle_a':24,'idle_b':25,'idle_c':23,'windup':36,'move':19,'attack':29,'recover':30,'hit':37,'dead':53}[pose]
    if king:top={'idle_a':21,'idle_b':22,'idle_c':20,'windup':29,'move':20,'attack':22,'recover':23,'hit':30,'dead':53}[pose]
    if pose=='dead':
        p.poly([(5,58),(10,54),(19,55),(25,52),(33,55),(41,53),(52,55),(58,58),(56,60),(44,59),(34,60),(25,58),(16,60),(7,60)],'s',True)
        p.poly([(9,57),(18,56),(25,54),(34,57),(42,55),(50,56),(55,58),(42,58),(32,59),(22,57),(14,58)],'m');p.line([(11,56),(19,56),(24,55)],'g');p.cluster(29,56,['ghhm','..gm'])
        p.line([(30,56),(33,58),(35,56)],'o');p.line([(42,56),(45,58),(48,55)],'o');p.line([(34,59),(42,59)],'r')
        if king:p.poly([(43,56),(46,50),(52,52),(59,55),(55,59),(48,59)],'y',True);p.cluster(50,54,['Ri','pB'])
        if cube:p.poly([(18,55),(25,50),(32,54),(29,59),(21,58)],'g',True);p.line([(24,52),(24,57)],'h')
        return p.im
    left=7 if not goo else 4;right=57 if not goo else 59
    if pose=='move':left+=5;right-=5
    if pose=='windup':left-=2;right+=1
    crownx=29+dx
    if cube:
        # Native geometry: visible top, left plane, right face and trapped rib bones.
        t=top-2
        p.poly([(8,t+6),(34+dx,t),(56,t+8),(55,52),(34,60),(8,53)],'s',True)
        p.poly([(10,t+7),(34+dx,t+2),(53,t+8),(33,t+16)],'g');p.poly([(10,t+9),(32,t+18),(32,58),(10,52)],'m');p.poly([(34,t+18),(54,t+10),(53,52),(34,58)],'s')
        p.line([(12,t+9),(30,t+17),(30,49)],'h',2);p.line([(38,t+15),(49,t+11)],'h');p.poly([(13,42),(20,39),(27,44),(26,48),(19,50),(15,47)],'g');p.line([(16,43),(23,44),(24,47)],'m');p.cluster(18,44,['hmm','..gh'])
        p.line([(15,34),(18,39),(23,38)],'B',2);p.line([(19,34),(20,37),(24,38)],'t');fx=42;fy=min(42,top+18)
    else:
        peaks=[(left+12,top+4),(crownx-5,top),(crownx+8,top+3)]
        if slug=='slime-red':peaks=[(left+11,top+6),(crownx-9,top-6),(crownx-3,top+2),(crownx+3,top-3),(crownx+9,top+3)]
        if slug=='slime-green':peaks=[(left+11,top+5),(crownx-4,top-3),(crownx+5,top),(crownx+12,top-2)]
        if metal:peaks=[(left+7,top+9),(left+12,top+2),(crownx-4,top+3),(crownx+2,top-3),(crownx+8,top-2),(crownx+12,top+6)]
        if slug=='slime-blue':peaks=[(left+12,top+6),(crownx-9,top+1),(crownx-1,top-1),(crownx+9,top+1),(crownx+15,top+5)]
        pts=[(left,58),(left-1,54),(left+4,48),(left+4,top+15),(left+8,top+9)]+peaks+[(right-6,top+7),(right-2,top+15),(right-1,49),(right+1,55),(right-2,59),(right-9,60),(right-18,58),(left+17,60),(left+5,59)]
        if slug=='slime-red':pts=[(8,58),(10,48),(14,top+10),(17,top+6)]+peaks+[(46,top+6),(48,top+13),(52,49),(58,54),(57,59),(48,60),(36,58),(25,60),(15,59)]
        if slug=='slime-blue':pts=[(5,58),(7,51),(11,top+15),(16,top+8),(21,top+4),(24,top-4),(31,top-6),(36,top-3),(36,top+1),(43,top+4),(48,top+10),(49,40),(55,45),(59,51),(58,58),(51,60),(45,58),(35,60),(21,58),(11,60)]
        if slug=='slime-green':pts=[(7,58),(9,46),(12,top+12),(20,top+4),(29,top),(38,top+3),(43,top+11),(41,42),(48,45),(55,50),(56,58),(49,60),(40,57),(32,60),(20,59),(12,60)]
        if metal:pts=[(5,58),(5,49),(9,45),(10,top+15)]+peaks+[(47,top+8),(49,top+17),(53,45),(59,49),(59,57),(55,60),(42,60),(39,56),(28,57),(22,60),(12,60)]
        if king:pts=[(3,58),(3,49),(7,top+16),(11,top+9),(21,top+3),(32,top),(43,top+4),(52,top+10),(57,top+20),(61,49),(60,57),(55,60),(44,60),(36,58),(24,60),(11,60)]
        if goo:pts=[(4,58),(7,53),(9,top+13),(13,top+7),(20+dx,top+3),(24+dx,top-2),(31+dx,top),(36,top+6),(43,top+6),(47,top+13),(52,top+14),(56,52),(60,58),(57,60),(48,59),(38,60),(29,58),(19,60),(12,58),(7,60)]
        p.poly(pts,'s',True)
        p.poly([(left+4,53),(left+7,top+15),(left+13,top+7),(crownx-3,top+3),(crownx+7,top+5),(right-8,top+12),(right-7,48),(right-3,54),(right-10,57),(right-18,55),(left+18,57),(left+9,56)],'m')
        p.poly([(left+10,top+14),(left+14,top+8),(crownx-5,top+5),(crownx+3,top+7),(crownx-2,top+10),(left+16,top+13),(left+13,top+20)],'g')
        p.line([(left+14,top+10),(left+17,top+7),(crownx-5,top+6)],'h',2)
        p.poly([(left+7,51),(left+13,53),(left+20,53),(left+26,55),(left+18,57),(left+9,56)],'d');p.poly([(right-13,45),(right-9,47),(right-10,51),(right-15,53),(right-17,50)],'g');p.cluster(right-15,47,['hh','gm'])
        p.line([(left+9,56),(left+14,57),(left+18,56)],'g');p.cluster(left+16,top+15,['gm..','hgm.','.msd'])
        if metal:p.poly([(crownx-4,top+7),(crownx,top-5),(crownx+3,top+8),(crownx+1,top+17),(crownx-3,top+15)],'h');p.poly([(crownx+4,top+11),(crownx+7,top+17),(crownx+6,min(56,top+30)),(crownx+3,min(57,top+31))],'d');p.line([(left+13,47),(left+20,44),(left+26,45)],'h')
        fx=(35 if metal else 38 if king else 40 if slug=='slime-blue' else 38 if slug=='slime-red' else 39)+dx;fy=min(44 if metal else 45,top+16)
        if slug=='slime-red':
            for x,y in [(22,top+7),(18,top+16),(42,top+12),(26,48)]:p.line([(x,y),(x+2,y+3),(x,y+6),(x+3,min(59,y+8))],'r');p.line([(x+1,y+1),(x+3,y+3)],'y')
        if metal:p.poly([(9,48),(15,43),(23,45),(24,50),(19,54),(8,54)],'g');p.line([(12,47),(20,47)],'h',2);p.poly([(44,49),(49,44),(56,48),(56,54),(48,56)],'d');p.line([(48,48),(54,50)],'h')
    # Large asymmetrical face is a raised jelly plane, with eyelids/nose/mouth.
    if metal:
        p.poly([(fx-13,fy-4),(fx-7,fy-7),(fx+3,fy-5),(fx+12,fy-3),(fx+14,fy+3),(fx+9,fy+9),(fx-8,fy+9),(fx-13,fy+4)],'g');p.line([(fx-11,fy-4),(fx-5,fy-5),(fx+1,fy-3)],'h',2)
    elif king:
        p.poly([(fx-16,fy-5),(fx-11,fy-9),(fx-4,fy-6),(fx+7,fy-8),(fx+14,fy-4),(fx+17,fy+3),(fx+12,fy+10),(fx-8,fy+11),(fx-16,fy+5)],'g');p.poly([(fx-15,fy),(fx-10,fy-2),(fx-6,fy+3),(fx-8,fy+8),(fx-13,fy+6)],'m')
    else:p.poly([(fx-11,fy-5),(fx-7,fy-8),(fx,fy-6),(fx+5,fy-8),(fx+12,fy-5),(fx+14,fy),(fx+10,fy+7),(fx+5,fy+9),(fx-5,fy+8),(fx-11,fy+3)],'m')
    p.line([(fx-9,fy-5),(fx-5,fy-6),(fx-2,fy-4)],'g',2);p.line([(fx+5,fy-6),(fx+10,fy-5)],'g',2)
    p.eye(fx-6,fy-2,pose in ('hit','idle_c'));p.eye(fx+7,fy-3,pose=='hit')
    if metal:p.poly([(fx-1,fy),(fx+4,fy-2),(fx+8,fy+2),(fx+7,fy+5),(fx,fy+5),(fx-2,fy+3)],'h',True);p.line([(fx+1,fy+1),(fx+5,fy+2)],'g')
    elif king:p.poly([(fx,fy),(fx+4,fy-1),(fx+7,fy+3),(fx+5,fy+5),(fx-1,fy+4)],'h');p.cluster(fx+2,fy+1,['gm','mg'])
    else:p.poly([(fx+1,fy),(fx+4,fy-1),(fx+6,fy+2),(fx+4,fy+4),(fx,fy+3)],'g');p.cluster(fx+2,fy,['hh','gm'])
    if pose=='attack':p.poly([(fx-4,fy+5),(fx+8,fy+4),(fx+10,fy+9),(fx+5,fy+13),(fx-2,fy+12),(fx-5,fy+9)],'r',True);p.line([(fx-2,fy+6),(fx+7,fy+5)],'i');p.poly([(fx,fy+10),(fx+5,fy+10),(fx+6,fy+12),(fx+1,fy+12)],'p')
    else:p.line([(fx-3,fy+6),(fx+1,fy+8),(fx+5,fy+8),(fx+9,fy+5)],'o');p.line([(fx,fy+9),(fx+5,fy+9)],'g')
    if king:
        y=top+3;x=crownx
        if slug=='king-slime-01':
            p.poly([(x-13,y),(x-14,y-11),(x-7,y-6),(x-2,y-16),(x+4,y-7),(x+12,y-13),(x+11,y+1)],'B',True);p.poly([(x-11,y-2),(x-12,y-8),(x-7,y-3),(x-2,y-12),(x+3,y-3),(x+10,y-9),(x+9,y-1)],'y');p.line([(x-10,y),(x+9,y)],'i',2);p.poly([(x-3,y-4),(x-1,y-7),(x+2,y-4),(x+1,y-1)],'R',True);p.cluster(x-1,y-5,['qp','R.'])
        else:p.poly([(x-11,y),(x-10,y-7),(x-6,y-12),(x+3,y-12),(x+9,y-8),(x+11,y-1)],'r',True);p.poly([(x-8,y-5),(x-5,y-10),(x+1,y-10),(x+4,y-7),(x+4,y-2),(x-5,y-2)],'R');p.line([(x-9,y),(x+9,y)],'y',2);p.oval((x-4,y-16,x,y-12),'y','o');p.cluster(x-2,y-15,['i']);p.poly([(fx-9,fy+6),(fx-13,fy+9),(fx-14,fy+13),(fx-6,fy+12)],'g');p.poly([(fx+9,fy+5),(fx+14,fy+8),(fx+14,fy+12),(fx+8,fy+10)],'g')
    if slug=='slime-green':p.poly([(crownx-5,top+4),(crownx-10,top-7),(crownx-7,top-9),(crownx-1,top+2)],'F',True);p.poly([(crownx+1,top+3),(crownx+7,top-7),(crownx+13,top-8),(crownx+10,top-2),(crownx+4,top+5)],'a',True);p.line([(crownx+8,top-5),(crownx+4,top+2)],'A')
    if slug=='slime-blue':
        for x,y in [(15,46),(19,41),(23,49)]:p.oval((x,y,x+3,y+3),'g','s');p.cluster(x+1,y,['hh'])
    if goo:
        p.line([(fx-9,fy),(fx-4,fy+1)],'e',2);p.line([(fx+6,fy),(fx+10,fy-1)],'e',2);p.poly([(14,52),(11,45),(12,40),(16,42),(19,49)],'m',True);p.cluster(13,43,['gh','mm'])
        if slug=='ooze-acid':p.poly([(48,55),(51,47),(50,top+11),(53,top+3),(57,top+1),(59,top+4),(56,top+9),(55,45),(58,52),(56,58)],'m',True);p.line([(56,top+4),(53,top+11),(54,45),(52,52)],'g',2);p.oval((8,top-1,13,top+4),'m','o');p.cluster(9,top,['hh','gm']);p.oval((22,top-6,26,top-2),'g','o')
        else:p.poly([(12,top+12),(9,top+7),(8,top+1),(12,top-2),(16,top+1),(17,top+6),(22,top+9)],'m',True);p.line([(10,top+2),(12,top+5),(15,top+6)],'g')
    return p.im
