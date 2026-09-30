# 약국 · 생선가게 · 정육점 · 재단사
# ------------------------------------------------------------------ 약국
P=mk(15,14,[(1,1,6,5),(8,1,13,5),(1,7,13,12)],[(3,6)]+door_ns(7,3)+[(7,13),(8,13),(7,12+1),(8,12+1),(7,13),(7,13)])
P=mk(15,15,[(1,1,6,5),(8,1,13,5),(1,7,13,12)],[(3,6)]+door_ns(7,3)+[(6,13),(7,13),(6,14),(7,14)])
B['pharmacy']=dict(name='약국 — 가게·조제실·약사 방(조제실 안쪽)',maps=[dict(key='pharmacy',name='약국',floor='plank',wall='plaster',plan=P,
 rooms=[('조제실',2,4),('약사 방',10,4),('가게',3,11)],
 items=[
  # 조제실: 약재 서랍장 둘, 작업대(증류 플라스크·절구·약초·종이), 가마솥, 약초 건조대
  (o('apothecary drawers'),1,3),(o('apothecary drawers'),2,3),(T('work',2),4,3,[('flask',0.2,1),('mortar',0.55,1),('herbbundle',0.85,0.7)]),(o('herb drying rack'),6,3),
  (o('cauldron'),1,5),(o('basket:herb'),2,5),(o('hang:herb'),4,1),(o('hang:mushroom'),5,1),(o('window'),3,1),
  # 약사 방 (조제실 안쪽 문으로만): 침대·협탁·옷장, 창 아래 책상과 의자
  (o('bed green'),8,3),(o('nightstand'),9,3,[('candle',0.3,1),('book',0.75,1)]),(o('wardrobe'),10,3),(T('desk',2),12,3,[('papers',0.25,1),('inkwell',0.55,0.8),('lamp',0.85,1)]),(o('chair N'),12,4),
  (o('window'),12,1),(o('picture'),9,1),(o('coat rack'),11,3),
  # 가게: 카운터 뒤 벽 약장, 카운터(저울·절구·돈궤·종), 손님 쪽 상담 탁자
  (o('cabinet:potion+potionb+potiong'),1,9),(o('cabinet:vial+flask'),2,9),(o('apothecary drawers'),4,9),(o('cabinet:jar+jarb+jarg'),5,9),
  (o('shelf:potion+potionb+potiong'),6,7),(o('hang:herb'),4,7),(o('window'),11,7),(o('picture'),8,7),
  (C(4),1,11,[('scale',0.12,1),('smallflask',0.4,1),('cashbox',0.66,1),('bell',0.9,1)]),
  (o('display potion'),9,9),(o('display potion'),10,9),(o('potted flowering'),13,9),
  (o('chair E'),10,11),(T('tea',1),11,11,[('teapot',0.35,1),('cup',0.75,1)]),(o('chair W'),12,11),(o('doormat'),6,12),
 ])])
# ------------------------------------------------------------------ 생선가게
P=mk(15,15,[(1,1,5,5),(7,1,13,5),(1,7,10,12)],[(3,6),(10,6),(6,13),(7,13),(6,14),(7,14)])
B['fish']=dict(name='생선가게 — 가게·손질터·찬 창고',maps=[dict(key='fish',name='생선가게',floor='flag',wall='stone',plan=P,
 rooms=[('찬 창고',2,4),('손질터',9,4),('가게',3,11)],
 items=[
  # 찬 창고 (창 없음): 얼음 통·궤짝
  (o('barrel:fish'),1,3),(o('crate:fish+ice'),2,3),(ice_chest(['fish','fishr','fish']),4,3),(o('crate:crab'),1,5),(o('crate:shell'),5,5),
  (o('hang:fish'),1,1),(o('hang:fishr'),4,1),
  # 손질터: 산 물고기 수조, 손질대(도마·칼·생선), 도마 통나무, 물독
  (o('fish tank'),7,3),(T('work',3),10,3,[('board',0.25,1),('knife',0.27,0.5),('fish',0.65,1),('fishr',0.85,0.6)]),(o('chopping block'),13,3),
  (o('water jar'),7,5),(o('barrel'),13,5),(o('fishing net'),9,1),(o('window'),12,1),
  # 가게: 얼음 진열함 둘 + 계산대가 한 줄(주인은 찬 창고 문으로 뒤에 선다), 손님 쪽은 앞줄
  (ice_chest(['fish','fishg','fishr']),1,11),(ice_chest(['squid','crab','shell']),3,11),(C(2),5,11,[('scale',0.3,1),('cashbox',0.8,1)]),
  (o('barrel:fish'),1,9),(o('crate:squid'),2,9),(o('crate:fish'),7,9),(o('crate:fishr'),8,9),(o('barrel:crab'),9,9),(o('notice board'),5,7),(o('window'),8,7),(o('basket:shell'),10,12),
  (o('bench 2'),11,12) if False else (o('doormat'),6,12),
 ])])
# ------------------------------------------------------------------ 정육점
P=mk(13,15,[(1,1,6,5),(8,1,11,5),(1,7,8,12)],[(3,6)]+door_ns(7,3)+[(5,13),(6,13),(5,14),(6,14)])
B['butcher']=dict(name='정육점 — 가게·고기 손질방·찬 창고(손질방 안쪽)',maps=[dict(key='butcher',name='정육점',floor='flag',wall='stone',plan=P,
 rooms=[('손질방',2,4),('찬 창고',10,4),('가게',3,11)],
 items=[
  (T('work',3),1,3,[('board',0.2,1),('knife',0.22,0.5),('steak',0.55,1),('sausage',0.85,0.9)]),(o('chopping block'),5,3),(o('water jar'),6,3),
  (o('hang:sausage'),1,1),(o('hang:ham'),2,1),(o('window'),5,1),(o('sack:grain'),1,5),
  (o('meat hooks'),8,3),(ice_chest(['ham','steak','ham']),10,3),(o('barrel'),11,5),(o('crate'),9,5) if False else (o('hang:ham'),10,1),
  (o('cabinet:cheese'),1,9),(o('shelf:cheese'),2,7),(o('window'),6,7),(o('crate:potato'),6,9),(o('crate:onion'),7,9),(o('basket:egg'),8,9),
  (C(2),1,11,[('scale',0.3,1),('cashbox',0.8,1)]),(ice_chest(['steak','ham','sausage']),3,11),
  (T('display',2),7,11,[('egg',0.25,1),('cheese',0.7,1)]),(o('doormat'),5,12),
 ])])
# ------------------------------------------------------------------ 재단사
P=mk(16,15,[(1,1,7,5),(9,1,14,5),(1,7,14,12)],[(4,6),(11,6),(7,13),(8,13),(7,14),(8,14)])
B['tailor']=dict(name='재단사 — 가게·작업실·탈의실',maps=[dict(key='tailor',name='재단사',floor='plank',wall='plaster',plan=P,
 rooms=[('작업실',2,4),('탈의실',10,4),('가게',3,11)],
 items=[
  # 작업실: 베틀·물레, 재단대(접은 옷감·가위·실패), 양모·실 바구니
  (o('loom'),1,3),(o('spinning wheel'),3,3),(o('fabric bolt rack'),6,3),(o('fabric bolt rack'),7,3),
  (T('work',3),5,5,[('clothfold',0.2,1),('scissors',0.55,1),('spools',0.85,1)]),(o('basket:wool'),1,5),(o('basket:yarn+yarnb+yarny'),2,5),
  (o('shelf:yarn+yarnb+yarny'),4,1),(o('window'),2,1),
  # 탈의실: 전신 거울, 마네킹, 옷걸이, 앉을 긴 의자
  (o('tailor mirror'),9,3),(o('mannequin'),12,3),(o('coat rack'),14,3),(o('bench 2'),13,5),(o('picture'),10,1),
  # 가게: 벽 옷감 선반, 마네킹 진열, 진열 탁자 위 접은 옷감, 문 옆 카운터
  (o('fabric bolt rack'),1,9),(o('cabinet:bolt+boltg+boltr'),2,9),(o('fabric bolt rack'),3,9),(o('mannequin'),5,9),(o('mannequin'),6,9),
  (o('fabric bolt rack'),13,9),(o('fabric bolt rack'),14,9),(o('banner green'),9,7),(o('window'),6,7) if False else (o('window'),12,7),
  (T('display',3),2,11,[('clothfold',0.2,1),('spools',0.5,1),('clothfold',0.82,1)]),(o('mannequin'),13,11),(C(3),9,11,[('clothfold',0.2,1),('scissors',0.5,1),('cashbox',0.85,1)]),(o('doormat'),7,12),
 ])])
