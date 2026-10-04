# 저택: 1층·2층 두 장의 맵. 계단은 같은 (x,y) 에서 이어진다: 1층 올라가는 계단 (11,3) ↔ 2층 내려가는 계단통 (11,3)
W,H=25,20
# columns: west wing 1..8 | 9 wall | hall 10..14 | 15 wall | east wing 16..23 | 24 wall
# rows: back rooms 1..5 | 6 wall | service corridor 7..9 | 10 wall | front rooms 11..17 | 18-19 street door
P1=mk(W,H,[(1,1,4,5),(6,1,8,5),(10,1,14,17),(16,1,23,5),(1,7,23,9),(1,11,8,17),(16,11,23,17)],
      [(2,6),(7,6),(19,6),(5,10),(19,10)]+door_ns(9,13)+door_ns(15,13)+[(11,18),(12,18),(13,18),(11,19),(12,19),(13,19)])
STAIR=(11,3)
def sconce(x,y): return (o('wall sconce'),x,y)
F1=dict(key='manor_1f',name='저택 1층',floor='dplank',wall='plaster',plan=P1,
 zones=[(16,1,23,5,'ktile','ktile'),(6,1,8,5,'flag',None),(1,1,4,5,'plank',None)],
 rooms=[('하녀 방',1,3),('창고',6,3),('현관 홀',12,8),('부엌',17,4),('뒤 복도(서)',1,9),('뒤 복도(동)',20,9),('응접실',3,16),('식당',20,16)],
 links=[dict(kind='stairs_up',x=STAIR[0],y=STAIR[1],w=3,to='manor_2f',toX=STAIR[0],toY=STAIR[1])],
 items=[
  # 현관 홀: 정문 → 붉은 통로 → 북쪽 벽 큰 계단. 계단 양옆에 갑옷, 벽에 초상화
  (o('stairs up wood'),11,3),(o('armor stand'),10,3),(o('armor stand'),14,3),(o('picture'),10,1),(o('picture'),14,1),
  # 붉은 통로 깔개(자동 타일): 계단 발치 → 정문, 뒤 복도와 응접실·식당 문으로 T자·十자로 갈라진다
  rug(line(12,4,12,19)+line(1,9,23,9)+line(9,14,15,14),'royal')+(),
  (T('dining',1),10,6,[('vase',0.5,1)]),(T('dining',1),14,6,[('candlestick',0.5,1)]),
  (o('potted fern'),10,12),(o('potted fern'),14,12),(o('tall vase red'),10,17),(o('tall vase blue'),14,17),
  # 하녀 방 (서북, 4칸): 침대·세면대·옷장, 문 옆 빗자루와 양동이
  (o('bed blue'),1,3),(o('washbasin'),3,3),(o('wardrobe'),4,3),(o('chest'),1,5),(o('broom and bucket'),4,5),(o('window'),2,1),
  # 창고 (3칸): 선반 둘, 궤짝·자루
  (o('cabinet:candle'),6,3),(o('cabinet:jar+jarb+jarg'),8,3),(o('crate'),6,5),(o('sack:grain'),8,5),
  # 부엌 (동북, 타일): 레인지 위 끓는 냄비·주전자, 조리대, 개수대, 작업대. 문은 복도 건너 식당 문과 일직선
  (o('kitchen range'),16,3,[('stewpot',0.3,1),('kettle_steam',0.78,1)]),
  (T('kcounter',2),18,3,[('board',0.3,1),('knife',0.32,0.5),('bowl',0.75,1)]),(o('kitchen sink'),20,3),(T('kcounter',2),21,3,[('plates',0.3,1),('pot',0.75,1)]),
  (o('firewood rack'),23,3),(o('hanging pans'),18,1),(o('dish rack'),21,1),(o('window'),22,1),
  (T('work',2),16,5,[('breadplate',0.3,1),('flourbowl',0.75,1)]),(o('water jar'),22,5),(o('barrel'),23,5),
  # 복도: 벽등만
  sconce(4,7),sconce(20,7),
  # 응접실 (서남): 벽난로 앞 모피 깔개·안락의자, 찻상, 피아노
  (o('clock'),1,13),(o('fireplace'),3,13),(o('piano'),6,13),(o('stool'),6,14),(o('potted flowering'),8,13),
  (o('curtained window'),2,11),(o('picture'),4,11),(o('curtained window'),7,11),
  (o('fur rug'),3,14),(o('armchair'),5,14),
  (o('sofa'),3,15),(T('tea',2),3,16,[('teapot',0.3,1),('cup',0.7,1)]),(o('armchair'),5,16),(o('tall vase teal'),8,17),
  # 식당 (동남): 긴 식탁(키트 4x1), 양 끝 주인 의자, 찬장 위 촛대와 접시
  (T('sideboard',2),16,13,[('candlestick',0.3,1),('plates',0.75,1)]),(T('sideboard',2),22,13,[('fruitbowl' if 'fruitbowl' in G else 'bowl',0.3,1),('candlestick',0.75,1)]),
  (o('curtained window'),17,11),(o('picture'),20,11),(o('curtained window'),22,11),
  rug(rect(17,14,22,16),'red')+(),(o('chair S'),18,14),(o('chair S'),19,14),(o('chair S'),20,14),(o('chair S'),21,14),
  (T('dining',4),18,15,[('candlestick',0.08,1),('fishplate',0.28,1),('breadplate',0.5,1),('wineglass',0.66,1),('soup',0.86,1)]),
  (o('chair E'),17,15),(o('chair W'),22,15),(o('chair N'),18,16),(o('chair N'),19,16),(o('chair N'),20,16),(o('chair N'),21,16),(o('tall vase yellow'),23,17),
 ])
P2=mk(W,H,[(1,1,4,5),(6,1,8,5),(10,1,14,9),(16,1,18,5),(20,1,23,5),(1,7,23,9),(1,11,8,17),(10,11,14,17),(16,11,23,17)],
      [(2,6),(7,6),(17,6),(21,6),(12,10),(20,10)]+door_ns(9,13))
F2=dict(key='manor_2f',name='저택 2층',floor='dplank',wall='plaster',plan=P2,start=[(12,5)],
 zones=[(16,1,18,5,'ktile','ktile')],
 rooms=[('손님방 1',1,3),('손님방 2',6,3),('계단 복도',12,6),('욕실',16,3),('손님방 3',21,4),('안방',3,16),('안방 거실',12,16),('서재',20,16),('복도(서)',1,9),('복도(동)',22,9)],
 links=[dict(kind='stairs_down',x=STAIR[0],y=STAIR[1],w=3,to='manor_1f',toX=STAIR[0],toY=STAIR[1])],
 items=[
  rug(line(12,5,12,13)+line(1,9,23,9)+line(20,9,20,13),'royal')+(),(o('stairwell down'),11,3),(o('picture'),10,1),(o('picture'),14,1),(o('tall vase red'),10,3),(o('potted fern'),14,3),
  (o('bench 2'),10,7) if False else (o('armchair'),10,6),(T('dining',1),10,7,[('candlestick',0.5,1)]),
  sconce(4,7),sconce(20,7),
  # 손님방 셋
  (o('bed green'),1,3),(o('nightstand'),2,3,[('candle',0.5,1)]),(o('wardrobe'),4,3),(o('chest'),1,5),(o('window'),3,1),
  (o('bed red'),6,3),(o('nightstand'),7,3,[('book',0.5,1)]),(o('wardrobe'),8,3),(o('chest'),8,5),
  (o('bed blue'),20,3),(o('nightstand'),21,3,[('candle',0.3,1),('book',0.75,1)]),(o('wardrobe'),23,3),(T('desk',1),23,5,[('papers',0.5,1)]),(o('window'),22,1),
  # 욕실 (타일): 욕조·세면대·물독, 수건걸이
  (o('bathtub'),16,3),(o('washbasin'),18,3),(o('towel rail'),16,1),(o('water jar'),16,5),(o('potted fern'),18,5),
  # 안방 (크게, 따로): 닫집 침대 양옆 협탁, 발치에 보물 상자, 화장대, 옷장. 거실을 거쳐서만 들어간다
  (o('wardrobe'),1,13),(o('nightstand'),3,13,[('candlestick',0.5,1)]),(o('canopy bed'),4,13),(o('nightstand'),6,13,[('book',0.5,1)]),(o('vanity mirror'),8,13),
  (o('curtained window'),2,11),(o('curtained window'),7,11),(o('royal chest'),4,15),rug(rect(3,16,6,17),'purple')+(),
  (o('armchair'),1,16),(T('tea',1),2,16,[('teapot',0.5,1)]),(o('cradle'),7,16),
  # 안방 거실 (안방 앞 방): 벽난로, 책장, 안락의자
  (o('bookshelf 1w'),10,13),(o('fireplace'),13,13),(o('fur rug'),13,14),(o('armchair'),14,16),(T('tea',1),13,16,[('cup',0.35,1),('teapot',0.75,1)]),(o('armchair'),12,16),
  (o('picture'),11,11),
  # 서재·서고 (동남): 벽 책장, 책상 위 지구의·촛대·종이·깃펜, 책상 남쪽 의자 N, 독서 의자
  (o('bookshelf 3w'),16,13),(o('bookshelf 1w'),19,13),(o('bookshelf 3w'),21,13),
  (T('desk',3),17,15,[('globe_s',0.12,1),('papers',0.45,1),('quill',0.6,0.9),('candlestick',0.9,1)]),(o('chair N'),18,16),
  (o('armchair'),22,15),(T('dining',1),23,15,[('candlestick',0.5,1)]),(o('telescope'),23,17),
 ])
B['manor']=dict(name='저택 — 1층(현관 홀·응접실·식당·부엌·하녀 방·창고) / 2층(안방·안방 거실·서재·손님방 셋·욕실)',maps=[F1,F2])
