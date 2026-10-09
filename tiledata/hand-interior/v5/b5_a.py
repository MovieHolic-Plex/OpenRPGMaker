# v5 new interiors, part A: hobbit hole, Prancing-Pony inn, dwarven hall, elven hall, golden mead hall
CE=tiles5.CEILS
# ------------------------------------------------------------------ 호빗 굴
# 가운데 E-W 굴 복도(둥근 아치 문틀) 에서 북쪽으로 식료품 방·부엌·거실·침실. 입구는 남쪽 둥근 문.
P=mk(24,13,[(1,1,4,5),(6,1,11,5),(13,1,18,5),(20,1,22,5),(1,7,22,10)],[(2,6),(8,6),(15,6),(21,6),(11,11),(12,11),(11,12),(12,12)])
B['hobbit']=dict(name='호빗 굴 — 굴 복도·식료품 방·부엌·거실·침실',maps=[dict(key='hobbit',name='호빗 굴',floor='hobbit',wall='hobbitw',plan=P,ceil=CE['wood'],
 zones=[(1,1,4,5,'terra',None),(6,1,11,5,'terra',None)],
 rooms=[('식료품 방',1,4),('부엌',7,4),('거실',16,4),('침실',21,4),('굴 복도',6,10)],
 items=[
  # 둥근 아치 문틀 넷 (복도 벽 윗줄), 복도 벽에 지도·시계·파이프 걸이
  (o('round arch'),1,7),(o('round arch'),7,7),(o('round arch'),14,7),(o('round arch'),20,7),
  (o('wall map'),5,7),(o('pipe rack'),11,7),(o('picture'),12,7),(o('wall clock'),18,7),
  (o('coat rack'),4,9),(o('bench 2'),16,9),(o('potted flowering'),22,9),(o('basket:mushroom'),1,10),
  (o('doormat'),11,10),(o('doormat'),12,10),
  # 식료품 방: 걸린 햄·양파, 치즈 선반, 바퀴 치즈·사과 통·감자 궤짝·밀가루 자루
  (o('hang:ham'),1,1),(o('shelf:cheese'),2,1),(o('shelf:jar+jarb+jarg'),3,1),(o('hang:onion'),4,1),
  (o('cheese wheels'),1,3),(o('barrel:apple'),2,3),(o('crate:potato'),3,3),(o('sack:flour'),4,3),(o('basket:mushroom'),1,5),(o('barrel'),4,5),
  # 부엌: 레인지 위 냄비·주전자, 조리대, 개수대, 장작, 둥근 창, 두 번째 아침을 차린 작업대
  (o('kitchen range'),6,3,[('stewpot',0.3,1),('kettle_steam',0.78,1)]),(T('kcounter',2),8,3,[('board',0.3,1),('knife',0.32,0.5),('loaf',0.75,1)]),
  (o('kitchen sink'),10,3),(o('firewood rack'),11,3),(o('dish rack'),8,1),(o('round window'),10,1),
  (o('water jar'),6,5),(o('basket:tomato'),7,5),(T('work',2),10,5,[('pie',0.3,1),('teapot',0.75,1)]),
  # 거실: 책장, 벽난로 앞 안락의자 둘·찻상, 둥근 창
  (o('bookshelf 1w'),13,3),(o('fireplace'),14,3),(o('clock'),18,3),(o('round window'),17,1),
  rug(rect(13,4,17,5),'green')+(),(o('armchair'),13,4),(T('tea',1),14,4,[('teapot',0.35,1),('cup',0.75,1)]),(o('armchair'),17,4),
  # 침실: 침대·협탁·옷장·궤짝, 둥근 창
  (o('bed green'),20,3),(o('nightstand'),22,3,[('candle',0.5,1)]),(o('round window'),21,1),(o('chest'),22,5),
 ])])
# ------------------------------------------------------------------ 달리는 조랑말 여관
P=mk(26,17,[(1,1,6,5),(8,1,10,5),(12,1,17,5),(19,1,20,14),(22,1,24,4),(22,6,24,9),(22,11,24,14),(1,7,17,14)],
     [(4,6)]+door_ns(7,3)+[(14,6)]+door_ns(18,12)+door_ns(21,2)+door_ns(21,7)+door_ns(21,12)+[(8,15),(9,15),(8,16),(9,16)])
B['inn']=dict(name='조랑말 여관 — 큰 홀(바·화덕)·부엌·술 창고·작은 응접실·객실 복도와 객실 셋',maps=[dict(key='inn',name='조랑말 여관',floor='plank',wall='log',plan=P,ceil=CE['wood'],
 zones=[(1,1,6,5,'ktile','ktile'),(8,1,10,5,'flag',None),(12,1,17,5,'dplank',None),(22,1,24,14,'dplank',None)],
 rooms=[('부엌',2,4),('술 창고',9,4),('응접실',15,4),('큰 홀',12,14),('객실 복도',19,3),('객실 1',22,3),('객실 2',22,8),('객실 3',22,13)],
 items=[
  # 부엌: 레인지(냄비·주전자), 조리대, 개수대, 걸린 팬, 물독·통
  (o('kitchen range'),1,3,[('stewpot',0.3,1),('kettle_steam',0.78,1)]),(T('kcounter',2),3,3,[('board',0.3,1),('steak',0.7,1)]),(o('kitchen sink'),5,3),(o('firewood rack'),6,3),
  (o('hanging pans'),3,1),(o('dish rack'),4,1),(o('water jar'),1,5),(o('barrel'),2,5),(T('work',1),5,5,[('pie',0.5,1)]),
  # 술 창고 (부엌 안쪽)
  (o('keg rack'),8,3),(o('barrel'),10,3),(o('crate'),9,5),(o('sack:grain'),10,5),
  # 응접실: 벽난로·안락의자·찻상·책장, 깔개(자동 타일)
  (o('bookshelf 1w'),12,3),(o('fireplace'),13,3),(o('curtained window'),13,1),(o('curtained window'),17,1),
  rug(rect(13,4,17,5),'red')+(),(o('armchair'),15,4),(T('tea',1),16,4,[('cup',0.35,1),('teapot',0.75,1)]),
  # 큰 홀: 서쪽은 바 (부엌 문이 바 뒤로 떨어진다), 가운데 화덕, 식탁 셋, 벽에 다트판·게시판·사슴 머리
  (o('keg rack'),1,9),(o('cabinet:bottle+bottler+bottley'),3,9),(o('bottles'),2,7),(o('lute'),6,7),
  (C(4),1,11,[('mug',0.12,1),('beer',0.35,1),('cashbox',0.62,1),('pitcher',0.88,1)]),(o('bar stool'),1,12),(o('bar stool'),2,12),(o('bar stool'),3,12),
  (o('fireplace'),9,9),(o('firewood bundle'),11,9),(o('deer trophy'),12,7),(o('notice board'),15,7),(o('dart board'),17,7),(o('window'),7,7),
  (o('bench 2'),6,11),(T('dining',2),6,12,[('beer',0.25,1),('soup',0.72,1)]),(o('bench 2'),6,13),
  (o('bench 2'),10,11),(T('dining',2),10,12,[('mug',0.2,1),('breadplate',0.5,1),('beer',0.82,1)]),(o('bench 2'),10,13),
  (o('chair S'),14,11),(o('chair S'),15,11),(T('dining',2),14,12,[('pie',0.3,1),('mug',0.75,1)]),(o('chair N'),14,13),(o('chair N'),15,13),
  # 객실 복도·객실 셋
  (o('picture'),20,1),(o('potted fern'),19,3),
  (o('bed red'),24,3),(o('nightstand'),23,3,[('candle',0.5,1)]),(o('window'),23,1),
  (o('bed blue'),24,8),(o('nightstand'),23,8,[('book',0.5,1)]),(o('picture'),23,6),
  (o('bed green'),24,13),(o('nightstand'),23,13,[('candle',0.5,1)]),(o('window'),23,11),
 ])])
# ------------------------------------------------------------------ 드워프 홀
P=mk(22,19,[(1,1,6,5),(8,1,13,5),(15,1,20,5),(1,7,20,16)],[(3,6),(10,6),(17,6),(10,17),(11,17),(10,18),(11,18)])
B['dwarf']=dict(name='드워프 홀 — 큰 홀(기둥·긴 식탁)·대장간·보물 창고·양조실, 광차 선로',maps=[dict(key='dwarf',name='드워프 홀',floor='dwarf',wall='rune',plan=P,ceil=CE['rock'],
 zones=[(1,1,6,5,'soot',None),(15,1,20,5,'flag',None)],
 rooms=[('대장간',2,4),('보물 창고',9,4),('양조실',16,4),('큰 홀',12,12)],
 items=[
  # 광차 선로 (자동 타일): 대장간 화로 앞에서 문을 지나 큰 홀 서쪽 갱도로
  rug(line(10,9,10,16)+line(11,9,11,16),'brown')+(),
  kit5.rail(line(3,3,3,9)+line(1,9,3,9))+(),(o('mine cart'),3,3),
  # 대장간
  (o('forge'),1,3),(o('coal bin'),1,5),(o('anvil'),5,4),(o('quench barrel'),6,4),(o('ore pile'),6,3),(o('tool wall'),5,1),(o('pick rack'),6,1),(o('wall torch'),3,1),
  # 보물 창고
  (o('treasure pile'),8,3),(o('royal chest'),12,3),(o('shelf:gem+gemr'),11,1),(o('shelf:coins'),9,1),(o('royal chest'),8,5),(o('treasure pile'),12,5) if False else (o('chest'),13,5),
  # 양조실
  (o('keg rack'),15,3),(o('barrel'),17,3),(o('keg rack'),19,3),(o('barrel:grape'),15,5),(o('sack:grain'),16,5),(T('work',2),19,5,[('mug',0.3,1),('pitcher',0.75,1)]),
  # 큰 홀: 드워프 기둥 넷, 룬석 둘(빛), 양쪽 긴 식탁과 긴 의자, 벽 횃불·깃발, 문 옆 화로
  (o('column dwarf'),7,10),(o('column dwarf'),14,10),(o('column dwarf'),7,14),(o('column dwarf'),14,14),
  (o('rune stone'),9,9),(o('rune stone'),12,9),
  (o('wall torch'),2,7),(o('royal banner'),5,7),(o('royal banner'),16,7),(o('wall torch'),19,7),(o('shield'),8,7),(o('shield'),13,7),
  (o('bench 2'),2,11),(o('bench 2'),4,11),(T('dining',4),2,12,[('mug',0.1,1),('ham',0.35,1),('breadplate',0.62,1),('beer',0.9,1)]),(o('bench 2'),2,13),(o('bench 2'),4,13),
  (o('bench 2'),16,11),(o('bench 2'),18,11),(T('dining',4),16,12,[('beer',0.1,1),('steak',0.4,1),('mug',0.66,1),('pitcher',0.9,1)]),(o('bench 2'),16,13),(o('bench 2'),18,13),
  (o('brazier'),8,16),(o('brazier'),13,16),(o('weapon barrel'),20,16),(o('powder kegs'),1,16),
 ])])
# ------------------------------------------------------------------ 엘프 궁정
P=mk(22,16,[(1,1,6,5),(8,1,13,13),(15,1,20,5),(1,7,20,13)],[(4,6),(17,6),(10,14),(11,14),(10,15),(11,15)])
B['elf']=dict(name='엘프 궁정 — 불의 전당(달빛 못·하프)·침소·필사실',maps=[dict(key='elf',name='엘프 궁정',floor='elfstone',wall='livewood',plan=P,ceil=CE['leaf'],
 rooms=[('침소',2,4),('필사실',16,4),('불의 전당',10,12)],
 items=[
  # 전당 북쪽 감실: 하프·흰 나무·잎 등, 가운데 달빛 못, 살아 있는 나무 기둥
  (o('leaf lantern'),9,1),(o('leaf lantern'),12,1),(o('tapestry'),10,1),(o('tapestry'),11,1),
  (o('white tree'),8,3),(o('elven harp'),10,4),(o('white tree'),13,3),
  (o('moon pool'),9,8),
  (o('column live'),8,11),(o('column live'),13,11),
  (o('bench 2'),9,5) if False else (o('potted sapling'),11,3),
  # 서쪽 날개: 낮은 찻상과 긴 의자 / 동쪽 날개: 하프와 악보대, 긴 의자
  (o('leaf lantern'),3,7),(o('leaf lantern'),18,7),(o('tapestry'),6,7),(o('tapestry'),15,7),
  (o('bench 2'),2,10),(T('tea',2),2,11,[('teapot',0.3,1),('cup',0.7,1)]),(o('bench 2'),2,12),(o('potted flowering'),6,9),
  (o('elven harp'),18,9),(o('music stand'),18,10),(o('bench 2'),16,10),(T('tea',2),16,11,[('wineglass',0.25,1),('fruitbowl',0.72,1)]),(o('bench 2'),16,12),(o('bench 2'),9,12),(o('bench 2'),11,12) if False else (o('potted sapling'),12,12),(o('potted flowering'),20,9),
  # 침소
  (o('elven bed'),1,3),(o('nightstand'),2,3,[('candle',0.5,1)]),(o('wardrobe'),6,3),(o('leaf lantern'),3,1),(o('curtained window'),5,1),(o('potted sapling'),1,5),(o('elven harp'),6,5),
  # 필사실
  (o('bookshelf 2w'),15,3),(T('desk',2),18,3,[('papers',0.25,1),('quill',0.45,0.9),('inkwell',0.6,0.8),('openbook',0.85,1)]),(o('chair N'),18,4),
  (o('star chart'),18,1),(o('leaf lantern'),20,1),(o('scroll rack'),20,3),(o('potted fern'),15,5),
 ])])
# ------------------------------------------------------------------ 황금 연회장
P=mk(25,20,[(1,1,4,6),(1,8,4,13),(6,1,16,17),(18,1,23,6),(18,8,23,13)],
     door_ns(5,4)+door_ns(5,11)+door_ns(17,4)+door_ns(17,11)+[(10,18),(11,18),(12,18),(10,19),(11,19),(12,19)])
B['mead']=dict(name='황금 연회장 — 긴 화덕 홀·왕좌 단·왕의 방·식료 창고·부엌·무기고',maps=[dict(key='mead',name='황금 연회장',floor='rush',wall='goldwood',plan=P,ceil=CE['gold'],
 zones=[(1,1,4,6,'dplank',None),(18,1,23,6,'earth',None),(1,8,4,13,'flag',None),(18,8,23,13,'plank',None)],
 rooms=[('연회장',11,15),('왕의 방',2,5),('식료 창고',2,12),('부엌',20,5),('무기고',20,12)],
 items=[
  # 북쪽 끝 나무 단 위 왕좌, 양옆 갑옷, 벽에 태피스트리·왕기
  (kit5.dais(5,2,'wood'),9,3),(o('throne'),11,3),(o('armor stand'),8,3),(o('armor stand'),14,3),
  (o('royal banner'),7,1),(o('tapestry'),9,1),(o('tapestry'),13,1),(o('royal banner'),15,1),
  # 가운데 긴 화덕, 기둥 두 줄, 양쪽 긴 식탁(남북) 과 의자
  (o('long hearth 5'),11,8),
  *[(o('column wood'),x,y) for x in (7,15) for y in (6,10,14)],
  (o('brazier'),8,16),(o('brazier'),14,16),(T('dining',1,3),9,7,[('ham',0.5,0.3),('mug',0.5,0.7)]),(T('dining',1,3),9,11,[('breadplate',0.5,0.3),('beer',0.5,0.75)]),
  (T('dining',1,3),13,7,[('beer',0.5,0.3),('steak',0.5,0.7)]),(T('dining',1,3),13,11,[('mug',0.5,0.3),('pitcher',0.5,0.75)]),
  *[(o('chair E'),8,y) for y in (7,8,9,11,12,13)],*[(o('chair W'),14,y) for y in (7,8,9,11,12,13)],
  # 왕의 방
  (o('double bed red'),1,3),(o('royal chest'),3,3),(o('wardrobe'),4,3),(o('tapestry'),3,1),(o('armchair'),1,6),(T('tea',1),2,6,[('wineglass',0.5,1)]),
  # 식료 창고
  (o('keg rack'),1,10),(o('barrel'),3,10),(o('barrel:apple'),4,10),(o('hang:ham'),1,8),(o('hang:sausage'),2,8),(o('sack:grain'),1,12),(o('crate:cabbage'),1,13),(T('work',1),3,13,[('pitcher',0.5,1)]),
  # 부엌 (흙바닥)
  (o('stove'),18,3,[]),(o('cauldron'),19,3),(T('work',2),21,3,[('board',0.3,1),('ham',0.75,1)]),(o('firewood rack'),23,3),(o('hang:onion'),20,1),(o('hanging pans'),21,1),
  (o('water jar'),18,5),(o('basket:cabbage'),19,5),(o('barrel'),23,6),
  # 무기고
  (o('weapon rack'),19,8),(o('shield'),20,8),(o('weapon rack'),22,8),(o('shield'),23,8),
  (o('armor stand'),19,10),(o('armor stand'),20,10),(o('weapon barrel'),23,10),(o('grindstone'),22,12),(o('chest'),23,13),
 ])])
