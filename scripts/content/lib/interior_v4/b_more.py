# 대장간 · 예배당 · 학자의 집 · 선술집
# ------------------------------------------------------------------ 대장간
# 작업장(서): 화로-모루-담금 통 삼각형을 좁게. 가게(동남): 문 옆 카운터. 대장장이 방(동북): 가게에서 들어간다
P=mk(15,13,[(1,1,6,9),(8,1,13,4),(8,6,13,10)],[(11,5)]+door_ns(7,6)+[(10,11),(11,11),(10,12),(11,12)])
B['smithy']=dict(name='대장간 — 작업장(흙바닥·그을린 화덕 자리)·가게·대장장이 방',maps=[dict(key='smithy',name='대장간',floor='earth',wall='rubble',plan=P,
 zones=[(1,3,6,5,'soot',None),(8,1,13,4,'plank','plaster')],
 rooms=[('작업장',2,8),('대장장이 방',9,4),('가게',9,9)],
 items=[
  # 화로 앞 1칸에 모루, 모루 곁에 담금 통, 화로 옆 숯 통 — 가열·망치질·담금이 세 걸음 안
  (o('coal bin'),1,3),(o('forge'),2,3),(o('firewood rack'),5,3) if False else (o('barrel'),5,3),(o('tool wall'),4,1),(o('tool wall'),5,1),(o('window'),6,1),
  (o('anvil'),3,5),(o('quench barrel'),4,5),(o('weapon barrel'),6,5),
  (T('work',3),1,7,[('tongs',0.15,1),('horseshoe',0.45,1),('hammer',0.8,1)]),(o('grindstone'),5,7),
  (o('crate'),1,9),(o('crate'),2,9),(o('sack:grain'),6,9),
  # 대장장이 방 (판자·회벽, 칸막이 뒤)
  (o('bed green'),8,3),(o('nightstand'),9,3,[('candle',0.5,1)]),(o('coat rack'),10,3),(o('chest'),13,3),(T('dining',1),13,4,[('beer',0.35,1),('breadplate',0.75,1)]),(o('window'),12,1),
  # 가게: 벽에 무기·방패, 카운터(손님 = 남쪽, 대장장이 = 작업장 문으로 뒤)
  (o('weapon rack'),8,6),(o('shield'),9,6),(o('weapon rack'),12,6),(o('shield'),13,6),
  (o('armor stand'),13,8),(o('armor stand'),12,8),(C(3),9,9,[('dagger',0.2,1),('cashbox',0.6,1),('bell',0.9,1)]),
 ])])
# ------------------------------------------------------------------ 예배당
# 좌우 대칭: 제단부(북) 뒤 벽 가운데 큰 색유리창, 회중석 어깨 벽에 창 둘씩 같은 간격, 깃발은 제단부 벽, 오르간은 제단부 동쪽 끝.
P=mk(20,19,[(5,1,14,4),(1,5,18,11),(5,12,14,16),(1,13,3,16),(16,13,18,16)],[(2,12),(17,12),(9,17),(10,17),(9,18),(10,18)])
B['chapel']=dict(name='예배당 — 제단부·회중석·세례실·제의실',maps=[dict(key='chapel',name='예배당',floor='check',wall='stone',plan=P,
 rooms=[('제단부·회중석',9,9),('세례실',2,15),('제의실',17,15)],
 items=[
  (o('tall stained window'),9,1),(o('banner red'),7,1),(o('banner red'),12,1),
  (altar(),9,3,[('candle',0.1,1),('openbook',0.5,0.9),('candle',0.9,1)]),(o('candelabra'),8,3),(o('candelabra'),11,3),
  (o('pipe organ'),13,3),(o('stool'),13,4) if False else (o('lectern'),6,4),(o('tall vase red'),5,3),
  # 회중석 어깨 벽: 창 x2,x4 / 대칭 x15,x17
  (o('stained glass'),2,5),(o('stained glass'),4,5),(o('stained glass'),15,5),(o('stained glass'),17,5),
  (o('candelabra'),1,7),(o('candelabra'),18,7),
  (o('aisle runner'),9,5),(o('aisle runner'),9,8),(o('aisle runner'),9,11),(o('aisle runner'),9,14),
  (o('pew'),5,7),(o('pew'),7,7),(o('pew'),11,7),(o('pew'),13,7),(o('pew'),5,9),(o('pew'),7,9),(o('pew'),11,9),(o('pew'),13,9),
  (o('pew'),5,12),(o('pew'),7,12),(o('pew'),11,12),(o('pew'),13,12),(o('pew'),5,14) if False else (o('holy water font'),7,15),(o('holy water font'),12,15),
  (o('potted fern'),1,11),(o('potted fern'),18,11),
  # 세례실 / 제의실 (양쪽 대칭 방)
  (o('stained glass'),1,13),(o('stained glass'),18,13),
  (o('holy water font'),3,15),(o('candelabra'),1,15),
  (o('wardrobe'),16,15),(o('chest'),18,15),
 ])])
# ------------------------------------------------------------------ 학자의 집
# 뒷줄: 작은 부엌(타일) · 침실 · 서재. 앞: 현관을 겸한 서고(벽 책장, 열람 탁자, 독서 자리)
P=mk(18,14,[(1,1,5,5),(7,1,11,5),(13,1,16,5),(1,7,16,11)],[(3,6),(9,6),(14,6),(8,12),(9,12),(8,13),(9,13)])
B['scholar']=dict(name='학자의 집 — 서고·서재·침실·작은 부엌',maps=[dict(key='scholar',name='학자의 집',floor='dplank',wall='plaster',plan=P,
 zones=[(1,1,5,5,'ktile','ktile')],
 rooms=[('부엌',2,4),('침실',8,4),('서재',15,4),('서고',3,11)],
 items=[
  # 부엌: 레인지 위 냄비, 조리대, 개수대 — 혼자 사는 사람의 작은 식탁
  (o('kitchen range'),1,3,[('stewpot',0.5,1)]),(o('kitchen sink'),3,3),(T('kcounter',2),4,3,[('board',0.3,1),('bowl',0.75,1)]),
  (o('hanging pans'),4,1),(o('dish rack'),5,1),(T('dining',1),1,5,[('breadplate',0.35,1),('cup',0.8,1)]),(o('chair W'),2,5),(o('water jar'),5,5),
  # 침실
  (o('bed blue'),7,3),(o('nightstand'),8,3,[('candle',0.3,1),('book',0.75,1)]),(o('washbasin'),10,3),(o('wardrobe'),11,3),(o('chest'),7,5),(o('window'),9,1),
  # 서재: 책상 위 지구의·촛대·종이·깃펜, 의자는 책상 남쪽(N), 곁에 두루마리 선반과 망원경
  (o('bookshelf 1w'),13,3),(T('desk',2),14,3,[('globe_s',0.18,1),('papers',0.5,1),('quill',0.62,0.9),('candlestick',0.9,1)]),(o('scroll rack'),16,3),(o('chair N'),15,4),
  (o('window'),15,1),(o('telescope'),13,5),
  # 서고: 벽 책장, 가운데 열람 탁자(책·등), 벽난로 앞 독서 자리
  (o('bookshelf 2w'),1,9),(o('bookshelf 3w'),4,9),(o('fireplace'),10,9),(o('bookshelf 2w'),12,9),(o('bookshelf 2w'),15,9),
  (o('wall map'),8,7),
  (o('chair E'),4,11),(T('dining',2),5,11,[('openbook',0.25,1),('lamp',0.75,1)]),(o('chair W'),7,11),(o('chest'),1,11),
  (o('round rug'),10,10),(o('armchair'),12,10),(T('dining',1),13,10,[('candlestick',0.35,1),('book',0.8,1)]),(o('potted fern'),16,11),(o('doormat'),8,11),
 ])])
# ------------------------------------------------------------------ 선술집
# 부엌(타일, 서북) → 문 → 바 뒤. 바 카운터 앞 바 의자. 홀(동): 벽난로·피아노·식탁 셋. 창고는 부엌 곁 좁은 칸
P=mk(18,16,[(1,1,6,5),(8,1,10,5),(1,7,16,13),(12,1,16,13)],[(3,6)]+door_ns(7,3)+[(8,14),(9,14),(8,15),(9,15)])
B['tavern']=dict(name='선술집 — 홀·바·부엌·술 창고',maps=[dict(key='tavern',name='선술집',floor='plank',wall='log',plan=P,
 zones=[(1,1,6,5,'ktile','ktile'),(8,1,10,5,'flag',None)],
 rooms=[('부엌',2,4),('술 창고',9,4),('홀',14,8),('바',2,10)],
 items=[
  # 부엌: 레인지(끓는 냄비·주전자), 조리대, 개수대, 작업대 위 빵·접시
  (o('kitchen range'),1,3,[('stewpot',0.3,1),('kettle_steam',0.78,1)]),(T('kcounter',2),3,3,[('board',0.3,1),('knife',0.32,0.5),('soup',0.75,1)]),(o('kitchen sink'),5,3),(o('firewood rack'),6,3),
  (o('hanging pans'),3,1),(o('dish rack'),4,1),(T('work',2),4,5,[('breadplate',0.3,1),('plates',0.75,1)]),(o('sack:grain'),1,5),
  # 술 창고 (좁게 3칸): 술통
  (o('barrel'),8,3),(o('barrel'),9,3),(o('barrel'),10,3),(o('crate'),10,5),(o('sack:grain'),9,5),
  # 바
  (o('keg rack'),1,9),(o('bottles'),4,7),(o('shelf:bottle+bottler+bottley'),5,7),(o('cabinet:bottle+bottler+bottley'),6,9),
  (C(4),1,11,[('beer',0.1,1),('wineglass',0.35,1),('mug',0.6,1),('cashbox',0.9,1)]),(o('bar stool'),1,12),(o('bar stool'),3,12),
  # 홀 (위층 방 없이 1층만): 벽난로 곁 안락의자, 피아노, 다트, 식탁
  (o('piano'),12,3),(o('stool'),12,4),(o('fireplace'),14,3),(o('firewood bundle'),16,3),(o('fur rug'),14,4),(o('armchair'),16,5),
  (o('dart board'),13,1) if False else (o('deer trophy'),13,1),(o('window'),16,1),(o('lute'),12,1),
  (o('dart board'),10,7),(o('notice board'),8,7),(o('window'),6,7) if False else (o('window'),13,1) if False else (o('picture'),9,7),
  (o('chair S'),8,9) if False else (o('chair E'),10,10),(T('dining',1),11,10,[('beer',0.3,1),('cards',0.75,1)]),(o('chair W'),12,10),
  (o('chair S'),8,9),(o('chair S'),9,9),(T('dining',2),8,10,[('beer',0.2,1),('fishplate',0.5,1),('mug',0.85,1)]),(o('chair N'),8,11),(o('chair N'),9,11),
  (o('chair E'),13,7),(T('dining',1),14,7,[('candlestick',0.3,1),('beer',0.75,1)]),(o('chair W'),15,7),
  (o('bench 2'),13,9),(T('dining',2),13,10,[('soup',0.25,1),('beer',0.55,1),('breadplate',0.85,1)]),(o('bench 2'),13,11),
  (o('chair S'),9,11) if False else (o('chair E'),13,13) if False else (o('barrel'),16,13),(o('barrel'),16,12),
  (o('chair E'),10,13),(T('dining',1),11,13,[('mug',0.3,1),('dice',0.75,1)]),(o('chair W'),12,13),
 ])])
