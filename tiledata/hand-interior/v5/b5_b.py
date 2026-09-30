# v5 new interiors, part B: royal throne room, wizard's round tower, castle dungeon, mine, magitek engine room
CE=tiles5.CEILS
def carve(W,H,rects,opens=(),solid=()):
    P=[list(r) for r in mk(W,H,rects,opens)]
    for x,y in solid: P[y][x]='#'
    return [''.join(r) for r in P]
# ------------------------------------------------------------------ 왕의 알현실
P=mk(23,22,[(6,1,16,13),(6,15,16,19),(1,1,4,8),(18,1,21,8)],
     [(10,14),(11,14),(12,14)]+door_ns(5,6)+door_ns(17,6)+[(10,20),(11,20),(12,20),(10,21),(11,21),(12,21)])
B['throne']=dict(name='왕의 알현실 — 알현실(기둥·단·왕좌)·대기실·근위대 방·왕의 서재',maps=[dict(key='throne',name='왕의 알현실',floor='marble',wall='marblewall',plan=P,ceil=CE['gold'],
 zones=[(1,1,4,8,'flag','stone'),(18,1,21,8,'dplank',None)],
 rooms=[('알현실 + 대기실 (3칸 대문으로 이어짐)',8,10),('근위대 방',2,5),('왕의 서재',19,5)],
 items=[
  # 단(두 계단) 위 왕좌, 단 양옆 화로, 북쪽 벽 왕기·스테인드글라스·태피스트리
  (kit5.dais(5,3,'marble'),9,3),(o('throne'),11,4),(o('brazier'),8,4),(o('brazier'),14,4),
  (o('stained glass'),7,1),(o('royal banner'),9,1),(o('tapestry'),11,1),(o('royal banner'),13,1),(o('stained glass'),15,1),
  # 문에서 왕좌까지 3칸 폭 붉은 깔개(자동 타일), 대리석 기둥 두 줄, 깔개 곁 갑옷 근위
  rug(rect(10,6,12,19),'royal')+(),
  *[(o('column marble'),x,y) for x in (7,15) for y in (6,9,12)],
  (o('armor stand'),9,8),(o('armor stand'),13,8),(o('armor stand'),9,11),(o('armor stand'),13,11),
  # 대기실: 긴 의자, 화분, 문 곁 창 든 근위, 벽 시계·그림
  (o('bench 2'),6,17),(o('bench 2'),15,17) if False else (o('bench 2'),14,17),(o('potted fern'),6,19),(o('potted fern'),16,19),
  (o('armor stand'),9,18),(o('armor stand'),13,18),(o('picture'),7,15),(o('wall clock'),11,15) if False else (o('royal banner'),9,15),(o('royal banner'),13,15),(o('picture'),15,15),
  # 근위대 방: 성으로 오르는 돌계단? 아니, 근위 탁자(주사위·카드·열쇠)·의자, 무기 걸이, 침상
  (o('weapon rack'),1,1),(o('shield'),2,1),(o('weapon rack'),3,1),(o('bed red'),4,3),(o('chest'),1,3),
  (o('stool'),1,6),(T('dining',2),2,6,[('dice',0.25,1),('cards',0.55,1),('keys',0.85,1)]),(o('stool'),2,7),(o('weapon barrel'),3,3),
  # 왕의 서재: 책장, 책상(지구의·봉인 상자·깃펜), 의자, 왕의 궤짝, 벽 지도
  (o('bookshelf 2w'),18,3),(o('wall map'),21,1),(o('scroll rack'),21,3),
  (T('desk',2),19,6,[('globe_s',0.2,1),('sealbox',0.5,1),('quill',0.72,0.9),('candlestick',0.92,1)]),(o('chair N'),19,7),(o('royal chest'),21,8),
 ])])
# ------------------------------------------------------------------ 마법사의 둥근 탑
def round_plan():
    W,H=18,18; g=[['#']*W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            if ((x-8.5)/7.6)**2+((y-8.2)/7.9)**2<=1 and 1<=x<=16 and 1<=y<=16: g[y][x]='.'
    for x in range(W): g[9][x]='#'
    for y in range(9,H): g[y][9]='#'
    g[16][8]='#'
    for x,y in [(13,9),(9,10),(9,11),(9,12),(12,16),(13,16),(12,17),(13,17)]: g[y][x]='.'
    return [''.join(r) for r in g]
B['tower']=dict(name='마법사의 둥근 탑 — 서재(나선 계단)·연금술 방·입구 홀',maps=[dict(key='tower',name='마법사의 탑',floor='flag',wall='stone',plan=round_plan(),ceil=CE['dark'],
 zones=[(1,10,8,16,'earth',None),(1,1,16,8,'dplank',None)],
 rooms=[('서재',6,7),('연금술 방',5,13),('입구 홀',11,13)],
 items=[
  # 서재: 가운데 나선 계단(위층 천문대), 벽 책장·두루마리, 별자리표, 부엉이 횃대, 천체 모형, 책상과 수정구, 바닥의 마법진
  (o('spiral stair'),8,5),(o('bookshelf 2w'),6,3),(o('window'),8,1),(o('star chart'),9,1),(o('window'),10,1),(o('scroll rack'),11,3),
  (o('scroll rack'),4,4),(o('bookshelf 1w'),5,4),(o('cabinet:book+bookb+bookg'),13,4),(o('owl perch'),3,5),(o('telescope'),14,5),
  (T('desk',2),4,7,[('crystal',0.25,1),('openbook',0.6,1),('candlestick',0.9,1)]),(o('chair N'),4,8),(o('orrery'),7,8),(o('magic circle'),10,7),(o('spellbook stand'),15,7),
  # 연금술 방: 약초 걸이·물약 선반, 가마솥, 건조대, 물약장, 작업대(플라스크·절구), 증류기
  (o('hang:herb'),3,10),(o('shelf:potion+potionb+potiong'),5,10),(o('bottles'),7,10),
  (o('cauldron'),2,12),(o('herb drying rack'),4,12),(o('cabinet:potion+potionb+potiong'),6,12),(o('apothecary drawers'),7,12),
  (T('work',2),4,14,[('flask',0.25,1),('mortar',0.72,1)]),(o('alembic'),6,14),(o('basket:herb'),8,15),
  # 입구 홀: 빗자루·외투걸이·궤짝·화분
  (o('wall torch'),11,10),(o('wall map'),14,10),(o('broom and bucket'),15,12),(o('coat rack'),14,12) if False else (o('potted fern'),14,13),(o('chest'),10,14),
 ])])
# ------------------------------------------------------------------ 성 지하 감옥
P=[list(r) for r in mk(22,11,[(1,1,5,8),(7,1,20,8)],door_ns(6,6))]
for y in range(0,6): P[y][11]='#'; P[y][16]='#'
P=[''.join(r) for r in P]
B['dungeon']=dict(name='성 지하 감옥 — 간수실(성으로 오르는 계단)·복도·감방 셋(쇠창살)',maps=[dict(key='dungeon',name='지하 감옥',floor='dungeon',wall='dungeonw',plan=P,ceil=CE['dark'],start=[(2,4)],
 zones=[(1,1,5,8,'flag',None)],
 rooms=[('간수실',3,7),('감옥 복도',13,7),('감방 1',8,3),('감방 2',13,3),('감방 3',18,3)],
 links=[dict(kind='stairs_up',x=1,y=3,w=3,to='castle')],
 items=[
  # 간수실: 성으로 오르는 돌계단, 무기 걸이, 탁자(주사위·카드·열쇠 꾸러미)와 의자, 침상, 통
  (o('stairs up stone'),1,3),(o('weapon rack'),4,1),(o('shield'),5,1),(o('straw bed'),5,3),
  (o('stool'),1,6),(T('dining',2),2,6,[('dice',0.2,1),('keys',0.55,1),('mug',0.85,1)]),(o('stool'),4,6),(o('barrel'),1,8),
  # 감방 셋: 앞은 쇠창살(자동 타일, 문 한 칸이 열려 있다), 안에 짚 침상·오물통·족쇄, 천장에서 물이 떨어진다
  kit5.bars(line(7,5,8,5)+[(10,5)])+(),kit5.bars([(12,5)]+line(14,5,15,5))+(),kit5.bars(line(17,5,18,5)+[(20,5)])+(),
  (o('straw bed'),7,3),(o('slop bucket'),10,3),(o('shackles'),8,1),(o('shackles'),9,1),(o('drip puddle'),9,4),
  (o('straw bed'),15,3),(o('slop bucket'),12,3),(o('shackles'),13,1),
  (o('straw bed'),20,3),(o('slop bucket'),17,3),(o('shackles'),18,1),(o('drip puddle'),18,4),
  # 복도: 칸막이 끝 벽의 횃불, 물웅덩이, 화로
  (o('wall torch'),11,6),(o('wall torch'),16,6),(o('drip puddle'),13,7),(o('brazier'),20,8),(o('crate'),20,6),
 ])])
# ------------------------------------------------------------------ 광산
P=carve(22,14,[(1,1,5,4),(1,6,5,11),(7,1,20,11)],door_ns(6,2)+door_ns(6,8)+[(12,12),(13,12),(12,13),(13,13)],
        solid=[(20,1),(20,2),(20,3),(19,1),(7,11),(8,11),(20,10),(20,11),(19,11),(14,1),(15,1)])
B['mine']=dict(name='광산 — 갱도(광차 선로)·채굴 막장·화약고·광부 쉼터',maps=[dict(key='mine',name='광산',floor='cave',wall='mine',plan=P,ceil=CE['rock'],
 zones=[(1,6,5,11,'earth','rock')],
 rooms=[('갱도·막장',12,8),('화약고',2,4),('광부 쉼터',3,10)],
 items=[
  # 선로: 입구에서 북으로, 막장 앞에서 동으로 꺾인다. 광차 둘, 광석 더미, 버팀목
  kit5.rail(line(12,4,12,11)+line(12,4,18,4))+(),(o('mine cart'),16,4),(o('mine cart'),12,9),
  (o('ore vein'),16,2) if False else (o('ore vein'),16,1),(o('ore vein'),17,1),(o('ore vein'),13,2) if False else (o('ore vein'),18,1),(o('pick rack'),11,1),(o('hanging lantern'),9,1),
  (o('ore pile'),18,3),(o('ore pile'),18,5),(o('timber prop'),8,5),(o('timber prop'),16,7),(o('timber prop'),10,8),(o('timber prop'),19,8),
  (o('crate'),8,3),(o('barrel'),9,3),(o('sack:grain'),14,10),(o('water jar'),18,10),
  # 화약고: 화약 통·궤짝, 등 하나
  (o('powder kegs'),1,3),(o('powder kegs'),2,3),(o('crate'),4,3),(o('hanging lantern'),3,1),
  # 광부 쉼터: 식탁(빵·맥주·등), 긴 의자, 짚 침상, 물독
  (o('hanging lantern'),2,6),(o('pick rack'),4,6),(o('straw bed'),1,8),(o('water jar'),5,8),
  (T('dining',2),3,10,[('breadplate',0.3,1),('lamp',0.75,1)]),(o('bench 2'),3,11),
 ])])
# ------------------------------------------------------------------ 마도 기관실
P=mk(22,13,[(1,1,14,10),(16,1,20,5),(16,7,20,10)],door_ns(15,3)+door_ns(15,8)+[(6,11),(7,11),(6,12),(7,12)])
B['magitek']=dict(name='마도 기관실 — 기관 홀(증기 기관·톱니벽·계기판)·제어실·마도 갑옷 정비소',maps=[dict(key='magitek',name='마도 기관실',floor='grate',wall='riveted',plan=P,ceil=CE['steel'],
 zones=[(16,1,20,5,'dungeon',None)],
 rooms=[('기관 홀',4,9),('제어실',18,4),('정비소',17,10)],
 items=[
  # 기관 홀: 가운데 마도 기관, 톱니벽 둘, 계기판, 증기 구멍, 벽을 따라 도는 증기관(자동 타일)
  (o('gear wall'),2,1),(o('gauge panel'),5,1),(o('gauge panel'),9,1),(o('gear wall'),11,1),
  (o('magitek engine'),6,4),
  kit5.pipe(line(1,3,1,9)+line(9,4,13,4)+line(13,5,13,9))+(),
  (o('steam vent'),3,7),(o('steam vent'),11,7),(o('crate'),3,10),(o('crate'),4,10),(o('barrel'),10,10),(o('powder kegs'),11,10),
  # 제어실: 제어반, 계기판, 책상(도면·등), 의자
  (o('control console'),17,3),(o('gauge panel'),17,1),(o('gauge panel'),18,1),(o('wall map'),20,1),
  (T('desk',2),19,3,[('papers',0.3,1),('lamp',0.8,1)]),(o('chair N'),19,4),
  # 정비소: 마도 갑옷, 공구벽, 작업대(집게·망치·주괴)
  (o('magitek armor'),19,9),(o('tool wall'),17,7),(o('tool wall'),20,7),(T('work',1),16,9,[('tongs',0.5,1)]),
 ])])
