# v5 new interiors, part C: opera house, casino, chocobo stable, Narshe miner's house, Zozo dive
CE=tiles5.CEILS
# ------------------------------------------------------------------ 오페라 극장
P=mk(24,18,[(1,1,3,8),(5,1,18,15),(20,1,22,7),(20,9,22,15)],door_ns(4,3)+door_ns(19,3)+door_ns(19,11)+[(11,16),(12,16),(11,17),(12,17)])
B['opera']=dict(name='오페라 극장 — 무대·오케스트라 석·객석, 무대 뒤·분장실·소품 창고',maps=[dict(key='opera',name='오페라 극장',floor='dplank',wall='velvet',plan=P,ceil=CE['velvet'],
 zones=[(5,1,18,6,'stage',None),(1,1,3,8,'plank','plaster'),(20,1,22,7,'dplank','plaster'),(20,9,22,15,'plank','plaster')],
 rooms=[('무대·객석',11,12),('무대 뒤',2,6),('분장실',21,5),('소품 창고',21,14)],
 items=[
  # 무대: 붉은 막(양옆 커튼·날개), 가운데 무대 배경, 앞 가장자리 각광(깜박임)
  (o('stage curtain'),5,1),(o('stage curtain'),18,1),(o('royal banner'),11,1),(o('royal banner'),12,1),
  (o('curtain wing'),6,4),(o('curtain wing'),17,4),(o('scenery flat'),8,3),(o('scenery flat'),13,3),(o('potted sapling'),11,4),
  *[(o('footlights'),x,6) for x in range(6,18)],
  # 오케스트라 석: 지휘대, 보면대, 피아노 대신 하프
  (o('conductor podium'),11,8),(o('music stand'),7,8),(o('music stand'),8,8),(o('music stand'),9,8),(o('music stand'),14,8),(o('music stand'),15,8),(o('elven harp'),16,8),
  # 객석: 가운데 통로 깔개(자동 타일), 좌석 네 줄 × 양쪽 다섯
  rug(line(11,9,11,15)+line(12,9,12,15)+line(6,9,17,9)+line(6,12,17,12),'royal')+(),
  *[(o('theater seat'),x,y) for y in (10,11,13,14) for x in (6,7,8,9,10,13,14,15,16,17)],
  # 무대 뒤: 줄 걸이·궤짝·소품 / 분장실: 화장대·옷장·마네킹 / 소품 창고
  (o('crate'),1,3),(o('fabric bolt rack'),2,3),(o('mannequin'),1,7),(o('chest'),3,8),(o('wall torch'),3,1),
  (o('vanity mirror'),20,3),(o('wardrobe'),22,3),(o('mannequin'),22,5),(o('stool'),20,4),(o('curtained window'),21,1),
  (o('crate'),20,11),(o('barrel'),22,11),(o('mannequin'),20,15),(o('chest'),22,15),(o('picture'),21,9),
 ])])
# ------------------------------------------------------------------ 카지노
P=mk(22,15,[(1,1,15,12),(17,1,20,12)],door_ns(16,8)+[(7,13),(8,13),(7,14),(8,14)])
B['casino']=dict(name='카지노 — 도박장(룰렛·카드·슬롯)·환전 창구·라운지 바',maps=[dict(key='casino',name='카지노',floor='casino',wall='velvet',plan=P,ceil=CE['gold'],
 zones=[(17,1,20,12,'dplank',None)],
 rooms=[('도박장 (창살 우리 환전 창구 포함)',7,11),('라운지 바',19,10)],
 items=[
  # 북쪽 벽 슬롯머신 여섯(불빛), 벽 그림
  *[(o('slot machine'),x,3) for x in range(1,7)],(o('picture'),8,1),(o('curtained window'),10,1),
  # 룰렛 (돌아가는 바퀴) 과 둘레 의자
  (o('roulette table'),3,6,[('chips',0.3,0.35),('chips',0.8,0.4)]),(o('bar stool'),2,6),(o('bar stool'),5,6),(o('bar stool'),3,8),(o('bar stool'),4,8),
  # 카드 탁자 (펠트 자동 타일 3x2) 와 의자
  (T('felt',3,2),8,6,[('cardfan',0.2,0.4),('chips',0.5,0.5),('cards',0.8,0.4),('coins',0.3,0.95),('chips',0.75,0.95)]),
  (o('chair S'),8,5),(o('chair S'),10,5),(o('chair E'),7,6),(o('chair W'),11,7),(o('chair N'),8,8),(o('chair N'),10,8),
  # 환전 창구: 쇠창살 우리 + 계산대, 안에 금궤·동전 선반
  kit5.bars(line(11,3,11,5))+(),(C(3),12,5,[('coins',0.2,1),('scale',0.5,1),('cashbox',0.85,1)]),(o('royal chest'),13,3),(o('treasure pile'),14,3) if False else (o('chest'),14,3),
  (o('shelf:coins'),13,1),(o('shelf:gem+gemr'),14,1),
  # 남쪽: 두 번째 카드 탁자, 화분
  (T('felt',2,1),3,11,[('dice',0.3,1),('chips',0.75,1)]),(o('chair S'),3,10),(o('chair S'),4,10),(o('chair N'),3,12),(o('chair N'),4,12),
  (T('felt',2,1),11,10,[('cardfan',0.3,1),('coins',0.75,1)]),(o('chair S'),11,9),(o('chair S'),12,9),(o('chair N'),11,11),(o('chair N'),12,11),
  (o('potted fern'),1,12),(o('potted fern'),14,12),(o('potted flowering'),7,10),
  # 라운지 바: 뒤 술장, 계산대, 높은 의자, 안락의자와 찻상, 피아노
  (o('cabinet:bottle+bottler+bottley'),17,3),(o('keg rack'),18,3),(o('bottles'),20,1),
  (C(3),17,5,[('wineglass',0.2,1),('bottle',0.5,1),('wineglass',0.8,1)]),(o('bar stool'),17,6),(o('bar stool'),18,6),(o('bar stool'),19,6),
  (o('armchair'),17,11),(T('tea',1),18,11,[('wineglass',0.5,1)]),(o('armchair'),19,11),(o('potted fern'),20,8),
 ])])
# ------------------------------------------------------------------ 초코보 마구간
FC=set(line(1,6,2,6)+line(4,3,4,6)+[(5,6)]+line(7,3,7,6)+[(8,6)]+line(10,3,10,6)+line(11,6,12,6))
P=mk(20,13,[(1,1,13,10),(15,1,18,5),(15,7,18,10)],door_ns(14,3)+door_ns(14,8)+[(6,11),(7,11),(6,12),(7,12)])
B['stable']=dict(name='초코보 마구간 — 칸막이 우리 넷·통로·마구 방·관리인 방',maps=[dict(key='stable',name='초코보 마구간',floor='straw',wall='stablew',plan=P,ceil=CE['wood'],
 zones=[(1,7,13,10,'earth',None),(15,1,18,5,'plank',None),(15,7,18,10,'dplank',None)],
 rooms=[('마구간',6,9),('마구 방',17,4),('관리인 방',15,10)],
 items=[
  # 우리 넷: 나무 칸막이(자동 타일, 앞에 드나드는 틈), 초코보·먹이통·물통·건초
  kit5.fence(sorted(FC))+(),
  (o('feed trough'),1,3),(o('chocobo'),2,4),(o('hay bale'),3,3),
  (o('water trough'),5,3),(o('chocobo'),6,4),
  (o('feed trough'),8,3),(o('chocobo'),8,4),
  (o('water trough'),11,3),(o('chocobo'),12,4),(o('hay bale'),13,3),
  (o('pitchfork'),3,1),(o('hanging lantern'),6,1),(o('pitchfork'),9,1),(o('hanging lantern'),12,1),
  # 통로: 건초 더미, 안장걸이, 채소 바구니(먹이), 물독
  (o('hay bale'),1,10),(o('hay bale'),2,10),(o('saddle rack'),12,9),(o('basket:carrot'),10,10),(o('water jar'),11,10),(o('sack:grain'),9,10),
  # 마구 방
  (o('saddle rack'),15,3),(o('saddle rack'),16,3),(o('tool wall'),17,1),(o('chest'),18,3),(o('bench 2'),17,5) if False else (o('crate'),18,5),
  # 관리인 방
  (o('bed green'),18,9),(o('stove'),15,9),(T('dining',1),16,9,[('soup',0.5,1)]),(o('chair W'),17,9),(o('window'),16,7),
 ])])
# ------------------------------------------------------------------ 나르쉐 광부의 집
P=mk(16,14,[(1,1,5,5),(7,1,14,5),(1,7,10,11),(12,7,14,11)],[(3,6),(9,6)]+door_ns(11,8)+[(12,12),(13,12),(12,13),(13,13)])
B['narshe']=dict(name='눈 덮인 탄광 마을 집 — 거실(난로)·부엌·침실·눈 털이 현관',maps=[dict(key='narshe',name='탄광 마을 집',floor='narshe',wall='logdark',plan=P,ceil=CE['wood'],
 zones=[(12,7,14,11,'snowmat',None),(7,1,14,5,'terra',None)],
 rooms=[('침실',3,4),('부엌',11,4),('거실',6,10),('현관',13,10)],
 items=[
  # 침실
  (o('bed blue'),1,3),(o('nightstand'),2,3,[('candle',0.5,1)]),(o('wardrobe'),5,3),(o('curtained window'),3,1),(o('chest'),5,5),
  # 부엌: 화덕(주전자), 조리대, 물독, 식탁과 의자, 걸린 햄·양파
  (o('stove'),7,3,[]),(T('kcounter',2),8,3,[('board',0.3,1),('potato',0.75,1)]),(o('water jar'),14,5),(o('hang:ham'),12,1),(o('hang:onion'),13,1),(o('window'),11,1),
  (o('chair E'),11,4),(T('dining',2),12,4,[('soup',0.25,1),('breadplate',0.75,1)]),(o('chair W'),14,4),(o('barrel:potato'),14,3) if False else (o('sack:grain'),7,5),
  # 거실: 벽난로, 모피 깔개, 안락의자 둘, 책장, 벽에 광부 곡괭이
  (o('bookshelf 1w'),1,9),(o('fireplace'),5,9),(o('pick rack'),2,7),(o('wall clock'),8,7),(o('firewood bundle'),7,9),
  (o('fur rug'),5,10),(o('armchair'),4,10),(o('armchair'),7,10),(T('tea',1),8,10,[('kettle',0.5,1)]),(o('armchair'),9,10),
  # 현관 (눈 털이 매트): 외투걸이, 석탄 통, 빗자루
  (o('coat rack'),14,9),(o('coal bin'),14,11),(o('lute'),13,7) if False else (o('wall torch'),13,7),
 ])])
# ------------------------------------------------------------------ 조조 뒷골목 선술집
P=mk(16,13,[(1,1,10,10),(12,1,14,5),(12,7,14,10)],door_ns(11,3)+door_ns(11,8)+[(4,11),(5,11),(4,12),(5,12)])
B['zozo']=dict(name='비 오는 뒷골목 선술집 — 술집(카드판)·도둑 소굴·창고',maps=[dict(key='zozo',name='뒷골목 선술집',floor='slum',wall='slumw',plan=P,ceil=CE['dark'],
 zones=[(12,1,14,10,'earth',None)],
 rooms=[('술집',6,9),('도둑 소굴',13,4),('창고',13,9)],
 items=[
  # 바: 술장·술통 선반, 계산대(깨진 잔·술병), 높은 의자
  (o('cabinet:bottle+bottler+bottley'),1,3),(o('keg rack'),2,3),(o('bottles'),4,1),(o('notice board'),6,1),(o('dart board'),8,1),
  (C(4),1,5,[('mug',0.15,1),('bottle',0.45,1),('cup',0.7,1),('cashbox',0.9,1)]),(o('bar stool'),1,6),(o('bar stool'),2,6),(o('bar stool'),4,6),
  # 카드판 (펠트) 과 의자, 흘린 동전·주사위
  (T('felt',2),6,4,[('cards',0.25,1),('dice',0.55,1),('coins',0.85,1)]),(o('chair S'),6,3),(o('chair S'),7,3),(o('chair N'),6,5),(o('chair N'),7,5),
  # 작은 탁자, 새는 천장 아래 양동이와 물웅덩이
  (o('chair E'),7,8),(T('dining',1),8,8,[('mug',0.5,1)]),(o('chair W'),9,8),(o('slop bucket'),10,4),(o('drip puddle'),9,5),(o('drip puddle'),2,9),
  (o('barrel'),1,10),(o('crate'),8,10),
  # 도둑 소굴: 짚 침상, 궤짝(훔친 물건), 촛불
  (o('straw bed'),14,3),(o('chest'),12,3),(o('treasure pile'),12,5) if False else (o('crate'),13,3),
  # 창고
  (o('barrel'),12,9),(o('barrel'),14,9),(o('crate'),14,10),(o('wall torch'),13,7),
 ])])
