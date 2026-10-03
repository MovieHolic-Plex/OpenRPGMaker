from organic_core import Pen,pal
DESCRIPTIONS={
'spider-cave':'넓은 자주색 등과 돌기 난 다리, 큰 황금 눈과 독니가 있는 동굴거미다.',
'spider-01':'갈색 보라색의 털배와 두꺼운 관절 다리, 밝은 독니를 가진 큰 거미다.',
'spider-widow':'검푸른 큰 둥근 배와 붉은 모래시계 무늬, 긴 굵은 다리와 붉은 독니가 있는 과부거미다.',
'crab-rock':'회청색 각진 돌갑판과 금빛 바위 조각, 크기가 다른 두 집게가 있는 바위게다.',
'crab-01':'구릿빛 두꺼운 갑판과 긴 눈자루, 큰 분쇄 집게와 넓은 관절 다리를 가진 게다.',
'scorpion-sand':'금갈색 마디 갑옷과 굽은 독침 꼬리, 큰 두 앞집게를 가진 모래전갈이다.',
'scorpion-01':'남청색 각진 등갑판과 높이 말린 굵은 독침 꼬리, 밝은 집게 끝이 있는 전갈이다.',
'mantis-blade':'청녹색 금속성 등날개와 크고 밝은 두 칼날 낫을 가진 사마귀다.',
'mantis-01':'녹색 두꺼운 배판과 긴 목, 톱니 있는 두 앞낫과 긴 관절 다리를 가진 사마귀다.',
'bee-giant':'금빛 털가슴과 검은 줄무늬 배, 넓은 은빛 날개와 침이 있는 거대한 벌이다.',
'beetle-horn':'짙은 남색의 둥근 겹갑판과 곡선 뿔, 밝은 턱집게가 있는 장수풍뎅이다.',
'ant-soldier':'적갈색 단단한 머리와 둥근 배, 가는 허리와 큰 밝은 턱집게를 가진 병정개미다.',
'centipede-01':'보랏빛 두꺼운 마디 갑판과 금빛 관절 다리, 큰 앞턱이 있는 지네다.',
'centipede-fire':'등이 아치형으로 솟은 붉은 갑판과 밝은 불꽃 가시, 수많은 다리를 가진 불지네다.',
'moth-dust':'아이보리색 넓은 네 날개에 보라색 눈무늬와 겹비늘, 긴 더듬이가 있는 나방이다.',
'parasite-01':'분홍색 두꺼운 마디 몸과 갈고리 다리, 이빨이 둘러진 넓은 흡착 입을 가진 기생충이다.'}
PALS={
'spider':pal('8d718d','b89eaa','654f77','383e5a','ccb08e'),
'widow':pal('506479','8ba0a9','34495f','243448','c27180'),
'crab':pal('869da2','c1cbb8','586d82','35495e','c9b189'),
'redcrab':pal('b48369','dab895','845c57','4f414c','cca383'),
'scorpion':pal('b29360','dcc891','796340','4b473c','e5d5a9'),
'darkscorpion':pal('667f95','acbfc1','415b75','293c55','c8bba0'),
'mantis':pal('78996d','bace9d','496d57','304e46','d0d7b0'),
'blade':pal('81a9a0','c8dcd0','527a7a','354e5b','d3e2d1'),
'bee':pal('bfa164','e5d097','806d53','4d4547','9b8eaa'),
'beetle':pal('627a96','a1b5c6','3e5475','2b3b59','cabc9b'),
'ant':pal('ad8065','dfb690','79544f','4c3d44','e1d0a0'),
'centipede':pal('96788e','c8a7b1','674e72','3b3c56','d9bc84'),
'fire':pal('a36a73','d59b8f','69465d','39344d','f0c681'),
'moth':pal('baa990','e4d9b5','847387','504958','ba8390'),
'parasite':pal('ba8a84','e5b9a0','835762','503e53','e4d4a7')}

def jointleg(p,pts,far=False):
 p.poly(pts,'d'if far else's')
 if not far:
  p.line(pts[:3],'m',2);p.cluster(round(pts[1][0]-1),round(pts[1][1]-1),['gm','ms'])

def spider(p,kind):
 widow=kind=='widow';cave=kind=='cave'
 if p.n==8:
  p.poly([(7,54),(12,46),(23,43),(32,46),(36,52),(31,58),(14,60),(7,58)],'s');p.poly([(12,51),(18,47),(25,46),(29,50),(25,55),(15,56)],'m',False)
  for x in(14,23,32,41):p.capsule([(x,55),(x-4,48),(x-1,45)],3,'s')
  p.poly([(35,54),(41,49),(50,51),(57,55),(58,60),(42,60)],'m');p.eye(51,55);p.facets(17,48,2,2);return
 for far in(True,False):
  p.part='far_leg'if far else'near_leg'
  for i in range(4):
   rx=20+i*6;kx=8+i*13;ky=32+i%2*6
   jointleg(p,[(rx,33),(kx,ky),(kx-3,ky+11),(kx-2,58),(kx+2,60),(kx+4,57),(kx+2,ky+10),(kx+3,ky-2),(rx+3,29)],far)
  if far:
   p.part='body';ax=22;top=7 if widow else 14 if cave else 10
   p.poly([(7,24),(10,top+5),(17,top),(27,top+1),(35,top+7),(38,27),(34,35),(25,39),(15,37),(8,32)],'s')
   p.poly([(10,23),(14,top+6),(19,top+3),(27,top+4),(31,top+8),(28,25),(20,29),(12,28)],'m',False)
   p.poly([(14,22),(18,top+7),(23,top+6),(27,top+8),(25,20),(20,23)],'g',False)
   p.poly([(11,31),(20,32),(27,28),(35,24),(34,31),(29,36),(20,37)],'d',False);p.facets(15,22,3,3)
   if widow:p.poly([(20,13),(27,17),(23,23),(28,29),(23,33),(18,28),(21,23),(17,18)],'a');p.line([(22,16),(24,18)],'R')
 p.part='neck';p.poly([(31,28),(39,23),(47,26),(52,34),(48,43),(38,44),(31,38)],'s');p.poly([(35,29),(41,26),(46,29),(47,34),(41,37),(35,34)],'m',False)
 p.head=(45,34);p.part='head';p.poly([(35,31),(39,26),(47,27),(53,32),(55,37),(51,44),(42,45),(35,39)],'m')
 p.poly([(38,32),(42,29),(47,30),(50,34),(46,37),(40,36)],'g',False);p.eye(48,33,True);p.eye(42,34);p.cluster(48,38,['eE','ao']);p.cluster(39,38,['e','o'])
 p.part='jaw'
 for x in(41,49):p.poly([(x,41),(x+4,42),(x+6,47),(x+5,52),(x+2,49),(x+1,45)],'a');p.line([(x+2,43),(x+4,46)],'A')
 if not widow:
  p.part='body'
  for x,y in[(10,20),(17,12),(26,14),(34,24),(34,36)]:p.cluster(x,y,['gm.','mgm','sd.'])

def crusher(p,x,y,big=True):
 p.poly([(x-7,y-3),(x-5,y-10),(x,y-14),(x+5,y-11),(x+9,y-5),(x+7,y-2),(x+3,y-4),(x,y-6),(x-2,y)],'m')
 p.poly([(x-7,y-2),(x-2,y-1),(x+4,y-2),(x+8,y-5),(x+9,y+2),(x+5,y+7),(x-1,y+9),(x-7,y+5)],'s')
 p.poly([(x-4,y-8),(x,y-11),(x+4,y-8),(x+5,y-5),(x+1,y-6)],'g',False);p.line([(x-4,y+2),(x,y+4),(x+5,y+1)],'m',2);p.cluster(x-3,y-3,['hgm','gms','.sd'])

def crab(p,rock):
 if p.n==8:
  p.poly([(9,55),(14,48),(28,46),(40,49),(45,56),(41,60),(15,60)],'s');p.poly([(15,52),(21,49),(30,49),(37,52),(34,57),(21,58)],'m',False);p.facets(19,51,3,2)
  for x in(13,22,32,40):p.capsule([(x,55),(x-4,49),(x-2,46)],3,'s')
  p.poly([(3,53),(8,48),(15,49),(20,54),(17,59),(5,59)],'m');p.line([(5,52),(10,51),(14,54)],'g',2)
  p.capsule([(39,55),(46,55)],4,'m')
  p.poly([(43,54),(49,48),(56,49),(61,54),(60,59),(50,60),(43,57)],'m');p.line([(49,52),(55,52),(58,55)],'g',2);p.eye(38,53);return
 for far in(True,False):
  p.part='far_leg'if far else'near_leg'
  for i,(rx,kx,tx) in enumerate([(15,5,3),(22,11,9),(32,52,55),(40,56,58)]):
   ky=45+i%2*4
   jointleg(p,[(rx,38),(kx,ky),(tx-2,55),(tx-1,60),(tx+2,60),(tx+3,54),(kx+4,ky-1),(rx+4,35)],far)
  if far:
   p.part='body';p.poly([(5,35),(9,27),(18,22),(33,22),(43,26),(48,34),(46,42),(38,48),(16,48),(7,43)],'s')
   p.poly([(9,34),(13,29),(20,26),(31,26),(39,29),(42,33),(36,36),(24,39),(13,38)],'m',False)
   p.poly([(15,32),(21,28),(29,28),(34,31),(29,34),(20,35)],'g',False)
   p.poly([(8,39),(17,40),(27,42),(40,37),(45,35),(43,42),(36,46),(20,46),(11,43)],'d',False)
   p.facets(15,33,4,3);p.line([(29,25),(31,33),(38,38),(39,43)],'d',2)
   if rock:
    for x,y in[(16,29),(27,26),(37,31)]:
     p.poly([(x-4,y),(x-2,y-5),(x+3,y-6),(x+6,y-2),(x+3,y+3),(x-2,y+4)],'a');p.line([(x-1,y-3),(x+2,y-4)],'i',2)
 p.part='head';p.head=(36,29)
 for x in(32,40):
  p.capsule([(x-1,35),(x,24),(x+1,20)],3);p.poly([(x-2,19),(x,16),(x+4,17),(x+5,20),(x+2,23),(x-1,22)],'m');p.eye(x+2,19,True)
 p.part='arm';p.pivot=(15,37);p.capsule([(13,38),(7,35),(9,29)],5);crusher(p,10,29,False)
 p.part='claw';p.pivot=(42,40);p.capsule([(40,40),(44,48),(50,45)],6);crusher(p,53,43)

def scorpion(p,dark):
 if p.n==8:
  p.poly([(7,54),(12,48),(25,46),(36,49),(40,55),(34,60),(12,60)],'s');p.facets(13,49,3,2);p.poly([(38,54),(45,49),(55,51),(60,57),(56,60),(41,60)],'m');p.eye(51,54);p.capsule([(13,54),(7,48),(4,45),(4,52),(8,57)],5);return
 p.part='tail';spine=[(17,35),(9,27),(7,18),(11,8),(24,4),(36,6),(46,14)] if dark else [(17,35),(10,28),(7,18),(12,10),(22,7),(32,9),(39,15)]
 p.capsule(spine,6)
 for x,y in spine[1:-1]:p.poly([(x-3,y-3),(x+2,y-4),(x+4,y),(x+1,y+4),(x-3,y+3)],'s');p.line([(x-2,y-2),(x+1,y-2)],'g',2)
 tx,ty=(7,-1)if dark else(0,0)
 p.poly([(x+tx,y+ty)for x,y in[(37,11),(43,13),(47,18),(46,24),(42,28),(43,21),(40,18),(36,17)]],'a');p.line([(40+tx,14+ty),(43+tx,16+ty)],'i')
 for far in(True,False):
  p.part='far_leg'if far else'near_leg'
  for i in range(4):
   x=16+i*7;k=x-7+i*3
   jointleg(p,[(x,40),(k,47),(k-1,56),(k+1,60),(k+4,59),(k+4,51),(x+3,37)],far)
  if far:
   p.part='body';p.poly([(9,35),(14,28),(22,25),(31,27),(40,31),(45,38),(41,45),(30,49),(17,46),(9,42)],'s')
   p.poly([(13,34),(18,29),(24,29),(33,31),(38,35),(32,38),(22,39),(13,39)],'m',False)
   for x in(17,24,31):p.poly([(x,29),(x+4,31),(x+5,39),(x+2,45),(x-2,42)],'m');p.cluster(x,33,['ghm','gms','.sd'])
 if dark:
  p.part='body';p.poly([(15,32),(18,24),(25,22),(33,25),(36,32),(33,40),(24,43),(17,39)],'s')
  for x,y in[(19,28),(27,27),(31,34)]:
   p.poly([(x-3,y),(x-1,y-4),(x+3,y-3),(x+5,y+2),(x+1,y+5),(x-3,y+3)],'m');p.line([(x-1,y-2),(x+2,y-1)],'g',2)
 p.head=(43,38);p.part='head';p.poly([(33,34),(41,30),(49,33),(53,39),(49,44),(39,46),(33,41)],'m');p.eye(48,37,True);p.cluster(37,35,['ggh','mms'])
 p.part='arm';p.pivot=(39,38);p.capsule([(37,39),(42,31),(48,30)],4);crusher(p,50,29,False)
 p.part='claw';p.pivot=(42,42);p.capsule([(41,42),(46,49),(49,46)],5);crusher(p,53,46)

def mantis(p,blade):
 if p.n==8:
  p.poly([(6,56),(9,49),(20,46),(29,51),(32,57),(25,60),(12,60)],'s');p.facets(11,50,3,2);p.capsule([(29,55),(37,51),(44,53)],5);p.poly([(42,52),(49,47),(56,50),(60,56),(55,60),(47,59)],'m');p.eye(53,54);p.poly([(31,57),(40,56),(51,59),(59,58),(57,60),(36,60)],'a');return
 p.part='body';p.poly([(4,30),(8,20),(17,16),(25,20),(30,28),(27,37),(20,44),(9,42),(4,36)],'s');p.poly([(7,29),(12,22),(18,20),(23,24),(22,30),(16,34),(9,34)],'m',False)
 for x,y in[(10,27),(15,25),(20,27)]:p.cluster(x,y,['ggh','gms','.sd'])
 p.poly([(8,37),(16,38),(24,33),(27,29),(25,37),(18,42),(10,40)],'d',False)
 for far in(True,False):
  p.part='far_leg'if far else'near_leg'
  for x in(17,27):jointleg(p,[(x,32),(x-7,42),(x-6,52),(x-4,60),(x+2,60),(x-1,56),(x-2,47),(x+2,35)],far)
 p.part='neck';p.poly([(23,33),(28,23),(33,14),(38,14),(38,21),(34,29),(31,38),(26,38)],'m');p.poly([(28,28),(32,19),(35,17),(35,22),(31,32)],'g',False)
 p.head=(40,16);p.part='head';p.poly([(32,15),(36,8),(44,7),(51,12),(52,18),(46,24),(38,24),(31,20)],'m');p.poly([(35,14),(39,10),(44,10),(47,14),(42,18),(36,18)],'g',False);p.eye(47,15,True);p.eye(37,16);p.mouth(41,21,7)
 p.line([(35,9),(32,3),(28,2)],'m',2);p.line([(44,9),(49,3),(54,2)],'m',2)
 for far in(True,False):
  p.part='arm'if far else'claw';p.pivot=(36,26);x=38 if far else 44
  p.capsule([(x,25),(x+3,33),(x+1,41)],4,far=far)
  p.poly([(x-2,39),(x+4,43),(x+12,34),(x+13,24),(x+10,20),(x+9,29),(x+4,34)],'d'if far else'a')
  if not far:
   p.line([(x+4,39),(x+10,31),(x+11,25)],'i',2)
   for yy in(30,34,38):p.poly([(x+5,yy),(x+2,yy-2),(x+7,yy-3)],'A',False)
 if blade:
  p.part='body';p.poly([(9,23),(15,15),(23,15),(28,21),(24,29),(18,33),(10,31)],'v');p.line([(13,24),(19,18),(23,21)],'V',2)

def shell_insect(p,ant):
 if p.n==8:
  p.poly([(5,55),(10,47),(21,44),(31,47),(35,55),(28,60),(12,60)],'s');p.poly([(10,51),(17,47),(25,48),(29,51),(23,56),(13,57)],'m',False);p.facets(13,49,3,2)
  for x in(18,27,36):p.capsule([(x,55),(x-3,48),(x+1,45)],3)
  p.poly([(35,54),(42,48),(51,49),(58,54),(60,60),(44,60)],'m');p.eye(53,55);return
 for far in(True,False):
  p.part='far_leg'if far else'near_leg'
  for i in range(3):
   x=15+i*12;k=x-7+i*3
   jointleg(p,[(x,33),(k,44),(k,54),(k+3,60),(k+8,60),(k+5,55),(k+4,46),(x+4,29)],far)
  if far:
   p.part='body'
   if ant:
    p.poly([(4,29),(7,20),(15,14),(25,15),(31,22),(32,32),(28,40),(19,44),(8,40),(4,35)],'s');p.poly([(8,28),(12,20),(18,18),(24,20),(25,26),(18,32),(10,33)],'m',False);p.facets(12,24,3,3)
    p.capsule([(30,31),(36,30)],4);p.poly([(31,25),(35,20),(41,21),(45,28),(42,36),(35,38),(30,32)],'m')
   else:
    p.poly([(5,27),(9,17),(18,10),(29,10),(37,16),(42,27),(39,39),(31,46),(18,46),(9,39),(5,33)],'s')
    p.poly([(9,26),(13,18),(20,14),(25,15),(27,23),(24,33),(17,39),(11,35)],'m',False);p.poly([(14,22),(18,17),(22,17),(23,22),(20,29),(15,32)],'g',False)
    p.poly([(29,14),(34,18),(38,26),(35,36),(29,42),(25,42),(28,32)],'m',False);p.line([(25,12),(28,25),(26,40),(24,44)],'d',2);p.facets(12,26,2,3);p.facets(30,23,1,3)
 p.head=(47,31);p.part='head';p.poly([(37,27),(40,19),(48,18),(56,24),(59,32),(56,40),(48,44),(39,39),(35,33)],'m')
 p.poly([(41,27),(45,22),(50,22),(54,26),(52,31),(46,33),(40,32)],'g',False);p.facets(42,29,2,2);p.eye(53,29,True)
 p.part='jaw'
 for x in(44,53):p.poly([(x,39),(x+5,40),(x+7,46),(x+4,51),(x,48),(x+2,43)],'a');p.line([(x+2,41),(x+4,45)],'i')
 p.part='head'
 if ant:
  p.capsule([(43,21),(41,11),(46,8)],2);p.capsule([(51,21),(55,13),(58,14)],2)
 else:
  p.poly([(45,20),(45,12),(51,5),(57,3),(54,8),(51,12),(52,21)],'a');p.line([(48,15),(50,10),(54,6)],'i',2)
  p.poly([(38,24),(35,16),(37,8),(41,6),(40,13),(42,22)],'a')

def centipede(p,fire):
 if p.n==8:
  for i in range(7):
   x=7+i*7;p.poly([(x-3,53),(x,48),(x+5,49),(x+7,54),(x+6,60),(x-2,60)],'s');p.line([(x,51),(x+3,51),(x+4,54)],'g',2);p.line([(x+5,53),(x+4,58)],'d')
  p.poly([(49,54),(52,49),(59,51),(61,56),(58,60),(50,60)],'m');p.eye(56,55);return
 centers=[]
 for i in range(7):
  x=7+i*6.8;y=35-(4-abs(3-i))*2.5 if fire else 33+i*.6
  centers.append((x,y))
 for far in(True,False):
  p.part='far_leg'if far else'near_leg'
  for x,y in centers:
   jointleg(p,[(x,y+2),(x-3,y+11),(x-3,54),(x,60),(x+4,60),(x+1,54),(x+1,y+12),(x+3,y)],far)
  if far:
   p.part='body'
   for i,(x,y) in enumerate(centers):
    p.poly([(x-5,y-2),(x-3,y-9),(x+3,y-10),(x+7,y-5),(x+7,y+4),(x+2,y+10),(x-4,y+8),(x-6,y+3)],'s');p.poly([(x-2,y-5),(x+2,y-7),(x+5,y-3),(x+3,y+2),(x-2,y+3)],'m',False);p.cluster(round(x),round(y-4),['ghm','gms','.sd']);p.line([(x-3,y+5),(x+2,y+7),(x+5,y+3)],'d')
    p.poly([(x-2,y-7),(x,y-14),(x+2,y-10),(x+4,y-13),(x+4,y-6)],'a'if fire else'd');
    if fire:p.cluster(round(x),round(y-10),['AE','aA'])
 p.head=(52,35);p.part='head';p.poly([(43,31),(47,24),(54,25),(60,30),(61,38),(57,45),(48,44),(43,39)],'m');p.poly([(47,31),(51,28),(55,29),(57,33),(52,36),(47,35)],'g',False);p.eye(56,33,True);p.part='jaw';p.poly([(52,41),(59,40),(61,45),(59,49),(55,47)],'a');p.poly([(46,40),(49,42),(48,48),(44,47)],'a')
 p.part='head';p.capsule([(48,27),(47,18),(51,15)],2);p.capsule([(55,27),(57,20)],2)

def flying(p,moth):
 if p.n==8:
  p.poly([(5,58),(8,47),(19,48),(29,55),(38,47),(54,48),(60,57),(42,60),(17,60)],'s');p.poly([(10,53),(17,51),(24,55),(21,58),(12,57)],'m',False);p.poly([(35,54),(45,50),(53,54),(50,58),(40,58)],'m',False)
  p.poly([(23,54),(28,50),(41,52),(47,56),(44,60),(30,60)],'m');p.eye(42,56);p.facets(12,52,2,1);return
 p.part='wing';p.pivot=(32,32)
 for sign in(-1,1):
  x=32+sign*25
  if moth:
   p.poly([(32,28),(x,6),(x+sign*3,13),(x+sign*1,28),(x-sign*7,35),(32,35)],'s');p.poly([(32,29),(x-sign*3,12),(x,17),(x-sign*2,27),(x-sign*8,31),(34,32)],'m',False);p.poly([(32,35),(x-sign*2,38),(x-sign*5,52),(x-sign*12,55),(32,43)],'s');p.poly([(33,37),(x-sign*5,40),(x-sign*8,49),(x-sign*13,50),(34,42)],'m',False)
   for yy,xx in[(23,x-sign*4),(43,x-sign*9)]:
    p.poly([(xx-4,yy),(xx-2,yy-4),(xx+3,yy-3),(xx+5,yy+1),(xx+2,yy+5),(xx-3,yy+4)],'a');p.poly([(xx-2,yy),(xx,yy-2),(xx+2,yy),(xx+1,yy+2)],'d');p.cluster(xx-1,yy-1,['g','h'])
   p.line([(32,31),(x-sign*5,17),(x,13)],'g');p.line([(32,38),(x-sign*8,46)],'g')
  else:
   p.poly([(30,28),(x,6),(x+sign*2,10),(x,21),(x-sign*6,31),(33,34)],'s');p.poly([(32,29),(x-sign*3,13),(x-sign*1,12),(x-sign*2,20),(x-sign*7,27)],'V',False);p.line([(33,29),(x-sign*5,17)],'v',2)
 if not moth:
  p.part='body';p.poly([(5,30),(8,22),(17,19),(25,24),(30,34),(27,42),(20,47),(10,43),(5,37)],'s');p.poly([(9,28),(13,23),(18,22),(22,26),(23,31),(17,33),(10,33)],'m',False)
  for x in(12,20):p.poly([(x,23),(x+4,24),(x+6,32),(x+3,42),(x-1,43),(x+1,32)],'d');p.line([(x+1,26),(x+2,30)],'g')
  p.poly([(6,37),(2,43),(8,41)],'a')
  for far in(True,False):
   p.part='arm'
   for x in(23,31,39):p.capsule([(x,38),(x+3,46),(x+10,48)],3,far=far)
 p.part='body';p.poly([(25,25),(30,19),(37,19),(43,25),(44,39),(39,48),(33,51),(27,46),(24,36)],'s');p.poly([(28,27),(31,22),(36,23),(39,27),(39,36),(35,41),(29,37)],'m',False);p.cluster(29,28,['ghgm','gmmm','.msd']);p.facets(29,34,2,3)
 p.head=(40,21);p.part='head';p.poly([(32,19),(35,13),(42,12),(49,17),(50,25),(45,31),(36,29),(31,25)],'m');p.poly([(35,19),(38,16),(42,16),(46,20),(43,24),(36,23)],'g',False);p.eye(45,21,True);p.mouth(41,27,7)
 p.capsule([(36,15),(32,7),(27,5)],2);p.capsule([(42,15),(46,7),(52,5)],2)


def parasite(p):
 if p.n==8:
  for i in range(6):
   x=7+i*7;p.poly([(x-3,54),(x-1,48),(x+4,47),(x+7,52),(x+7,58),(x+2,60),(x-3,59)],'s');p.line([(x,50),(x+3,49),(x+5,52)],'g',2)
  p.poly([(48,52),(55,50),(60,54),(60,60),(49,60)],'a');p.eye(56,56);return
 for far in(True,False):
  p.part='far_leg'if far else'near_leg'
  for i in range(5):
   x=9+i*8;jointleg(p,[(x,37),(x+3,47),(x+9,54),(x+9,60),(x+5,60),(x+4,54),(x-1,47)],far)
  if far:
   p.part='body'
   for i in range(6):
    x=8+i*7;y=31-abs(2.5-i)*-1
    p.poly([(x-5,y-3),(x-2,y-12),(x+4,y-13),(x+8,y-5),(x+8,y+7),(x+3,y+13),(x-4,y+11)],'s');p.poly([(x-1,y-7),(x+3,y-9),(x+6,y-4),(x+4,y+1),(x,y+2)],'m',False);p.cluster(x,y-5,['ghm','gms','.sd']);p.line([(x-2,y+7),(x+3,y+10),(x+6,y+5)],'d')
 p.head=(53,31);p.part='head';p.poly([(45,24),(50,18),(57,20),(61,26),(61,37),(56,44),(48,42),(44,35)],'a');p.poly([(49,26),(53,23),(58,26),(59,34),(55,39),(50,36)],'b')
 for x,y in[(50,26),(55,25),(58,29),(57,36),(52,37),(48,32)]:p.poly([(x-1,y),(x+2,y),(54,32)],'i',False)
 p.eye(49,22)
 if p.n==5:
  p.part='jaw';p.poly([(47,24),(53,20),(59,23),(61,31),(59,40),(52,45),(46,39),(44,31)],'a')
  p.poly([(49,27),(54,24),(58,27),(59,34),(54,40),(49,37),(47,32)],'b')
  for x,y in[(49,27),(54,25),(58,30),(55,38),(49,36)]:p.poly([(x-1,y),(x+2,y),(53,32)],'i',False)

def draw_bug(slug,pose):
 key={'spider-cave':'spider','spider-01':'spider','spider-widow':'widow','crab-rock':'crab','crab-01':'redcrab','scorpion-sand':'scorpion','scorpion-01':'darkscorpion','mantis-blade':'blade','mantis-01':'mantis','bee-giant':'bee','beetle-horn':'beetle','ant-soldier':'ant','centipede-01':'centipede','centipede-fire':'fire','moth-dust':'moth','parasite-01':'parasite'}[slug]
 p=Pen(PALS[key],pose,slug)
 if slug.startswith('spider'):spider(p,'widow'if key=='widow'else'cave'if slug=='spider-cave'else'tarantula')
 elif slug.startswith('crab'):crab(p,slug=='crab-rock')
 elif slug.startswith('scorpion'):scorpion(p,key=='darkscorpion')
 elif slug.startswith('mantis'):mantis(p,key=='blade')
 elif slug in('beetle-horn','ant-soldier'):shell_insect(p,key=='ant')
 elif slug.startswith('centipede'):centipede(p,key=='fire')
 elif slug in('bee-giant','moth-dust'):flying(p,key=='moth')
 else:parasite(p)
 return p.im
