# v5 메타 보강(2026-09-29): 짧거나 돌려쓴 설명을 그림을 보고 다시 쓰고, 소품마다 태그·놓는 곳·짝 소품을 붙이고,
# 예제 26맵을 방 단위로 나눠 「방 종류 → 자주 쓰는 가구」 표를 만든다.
#
#  - meta5.py 가 apply_meta(objs, buildings) 로 interior-meta.json 의 description·tags·summary·where 를 채운다.
#  - build_tileset.py 가 spec_notes(meta) 로 handInteriorSpec.json 의 objects[].desc/tags/place/pair 와 rooms 를 싣는다.
#
# 설명 = 무엇인지(summary, 60자 안팎) + 어느 방의 어디에, 무엇 옆에, 몇 개(where). 그림은 interior-atlas.png 좌표로 잘라 확인했다.
import re
from collections import Counter, defaultdict

# 상품 이름 빠진 것(원래 'grain 자루'·'해골·crystal 벽 선반'으로 나왔다)
GK_FIX = {'grain': '곡식', 'flour': '밀가루', 'crystal': '수정'}

# ---------------------------------------------------------------- 다시 쓴 설명 (무엇, 어디에·옆에·몇 개)
D6 = {
 'dart board': ('둥근 다트판(흑백 과녁, 가운데 붉은 원).', '선술집·여관 홀 벽면 윗줄에 1개. 밑에 2인 식탁이나 벤치를 두고 걸이끼리 붙이지 않는다.'),
 'stained glass': ('색유리를 끼운 1칸 아치 창(빨강·파랑·초록·노랑).', '예배당 측랑·알현실 벽면 윗줄에 1~2개, 기둥 사이 베이마다 하나씩 대칭으로.'),
 'holy water font': ('은빛 받침 위 파란 물이 담긴 성수반(1칸).', '예배당 입구 안쪽, 문 양옆에 1~2개. 통로 칸은 비워 둔다.'),
 'telescope': ('나무 삼각대에 놋쇠 경통을 비스듬히 올린 망원경.', '서재·탑 꼭대기 창 밑 구석에 1개. 책상·별자리표와 같은 방.'),
 'vanity mirror': ('타원 거울을 올린 분홍 화장대(서랍 둘, 병·꽃).', '안방·분장실 북쪽 벽 앞에 1개. 침대·옷장 옆, 앞 칸은 비운다.'),
 'washbasin': ('나무 받침장 위 파란 물 대야와 흰 수건.', '침실·욕실·제의실 북쪽 벽 앞에 1개. 침대나 욕조 옆.'),
 'cradle': ('흰 이불을 깐 나무 아기 요람(1칸).', '안방 닫집 침대 옆 바닥에 1개. 협탁 맞은편.'),
 'straw bed': ('짚을 깐 1×2 거친 잠자리(머리 쪽 흰 베개 천).', '감방·광부 쉼터·도둑 소굴 바닥 구석에 1개씩. 벽에 붙이지 않아도 된다.'),
 'dish rack': ('흰 접시·찻잔을 두 단에 얹은 벽 선반.', '부엌 벽면 윗줄에 1개. 조리대·개수대 바로 위, 냄비 걸이와 한 칸 띄운다.'),
 'hanging pans': ('검은 냄비·프라이팬을 매단 막대 걸이.', '부엌 벽면 윗줄에 1개. 화덕(레인지·스토브) 위나 옆.'),
 'spellbook stand': ('펼친 마법서를 올린 키 큰 나무 받침.', '마법사의 탑 서재 마법진 곁 바닥에 1개. 수정구·천체 모형과 같은 방.'),
 'tall vase blue': ('파란 유약을 입힌 키 큰 목긴 꽃병(8px 솟음).', '저택 현관 홀·복도 벽 곁에 1개. 다른 색 꽃병과 번갈아 대칭으로.'),
 'tall vase red': ('붉은 유약 목긴 꽃병(8px 솟음).', '저택 현관 홀·계단 곁·복도에 1개. 문 양옆에 짝으로 둔다.'),
 'tall vase teal': ('청록 유약 목긴 꽃병(8px 솟음).', '저택 거실·응접실 구석에 1개. 안락의자·피아노 곁.'),
 'tall vase yellow': ('금빛 유약 목긴 꽃병(8px 솟음).', '저택 식당 구석에 1개. 찬장(sideboard) 끝이나 창 밑.'),
 'potted fern': ('테라코타 화분에 심은 고사리 덤불.', '거실·복도·카지노 구석에 1~2개. 창 밑이나 문 양옆, 통로는 막지 않는다.'),
 'potted flowering': ('분홍 꽃이 핀 테라코타 화분.', '가게 창가·거실·엘프 궁정 벽 곁에 1~2개. 발깔개 옆이나 의자 곁.'),
 'potted sapling': ('둥근 수관의 작은 묘목 화분.', '엘프 궁정·극장 로비 기둥 사이에 1~3개. 흰 나무·하프와 같은 방.'),
 'potted cactus': ('뾰족한 초록 선인장 화분(예제에는 없음).', '사막 마을 집·잡화점 창가 구석에 1개.'),
 'runner': ('금테 두른 붉은 체크 긴 양탄자(1×3, 밟음).', '복도·현관에서 방 안쪽으로 남북 방향에 1장. 길면 깔개 줄 자동 타일(rug)을 쓴다.'),
 'banner red': ('금 봉에 매단 붉은 제비꼬리 깃발(금 문장).', '성 홀·길드·무기 가게 벽면 윗줄에 1~2개, 좌우 짝으로.'),
 'banner blue': ('금 봉에 매단 파란 제비꼬리 깃발(금 문장).', '성 홀·기사단 방 벽면 윗줄에 1~2개, 좌우 짝으로.'),
 'banner green': ('금 봉에 매단 초록 제비꼬리 깃발(금 문장).', '재단사·엘프 가게 벽면 윗줄에 1개. 진열장 사이.'),
 'wall clock': ('나무 테 둥근 벽시계(흰 문자판, 추 없음).', '거실·현관 복도 벽면 윗줄에 1개. 벽난로나 책장 위를 피해 건다.'),
 'wall map': ('흰 종이에 그린 대륙 지도 액자.', '서재·알현실 서재·제어실 벽면 윗줄에 1개. 책상 바로 위.'),
 'curtained window': ('붉은 커튼을 양옆에 묶은 나무 창.', '저택 방·여관 응접실·침실 벽면 윗줄에 1~2개, 방 가운데 대칭으로.'),
 'spinning wheel': ('나무 물레 바퀴와 붉은 실뭉치가 달린 받침.', '재단 작업실 베틀 옆 바닥에 1개. 양모 바구니와 같은 방.'),
 'tailor mirror': ('금테 두른 키 큰 전신 거울(16px 솟음).', '탈의실·재단사 가게 벽 곁에 1개. 마네킹 옆, 앞 칸은 비운다.'),
 'chair S': ('남쪽(화면 아래)을 보는 나무 의자 — 등받이가 위.', '식탁 북쪽 줄에 1칸마다 1개. 식탁 폭만큼 나란히, 뒤로 걸을 줄을 남긴다.'),
 'chair N': ('북쪽(화면 위)을 보는 나무 의자 — 뒤에서 본 앉는 판.', '식탁 남쪽 줄·책상 바로 남쪽에 1개. 책상 하나에 의자 하나.'),
 'chair E': ('동쪽을 보는 나무 의자 — 서쪽에 등받이.', '식탁·탁자 서쪽 끝에 1개. 긴 식탁 양옆 줄은 칸마다.'),
 'chair W': ('서쪽을 보는 나무 의자 — 동쪽에 등받이.', '식탁·탁자 동쪽 끝에 1개. chair E 와 마주 보게.'),
 'stool': ('등받이 없는 둥근 나무 스툴.', '피아노 앞·간수실 탁자 곁·분장실 화장대 앞에 1~2개.'),
 'bed green': ('초록 이불 1인 침대(1×2, 머리판 위).', '침실·여관 객실·관리인 방 북쪽 벽 앞에 1개. 옆에 협탁, 발치에 상자.'),
 'double bed green': ('초록 이불 2인 침대(2×2, 베개 둘).', '부부 침실 북쪽 벽 가운데에 1개. 양옆에 협탁 둘.'),
 'bed red': ('붉은 이불 1인 침대(1×2).', '손님방·여관 객실·근위대 방 북쪽 벽 앞에 1개. 옆에 협탁.'),
 'double bed red': ('붉은 이불 2인 침대(2×2, 베개 둘).', '왕의 방·안방 북쪽 벽 가운데에 1개. 곁에 왕실 상자·옷장.'),
 'bed blue': ('파란 이불 1인 침대(1×2).', '하녀 방·학자 침실·여관 객실 북쪽 벽 앞에 1개. 옆에 협탁이나 세면대.'),
 'double bed blue': ('파란 이불 2인 침대(2×2, 베개 둘).', '부부 침실 북쪽 벽 가운데에 1개. 양옆 협탁, 발치에 깔개.'),
 'bookshelf 1w': ('책·단지를 꽂은 1칸 폭 키 큰 책장(22px 솟음).', '침실·거실·여관 응접실 북쪽 벽 끝에 1개. 벽난로 옆.'),
 'bookshelf 2w': ('책을 빽빽이 꽂은 2칸 폭 키 큰 책장.', '서고·서재 북쪽 벽에 1~3개 이어 붙인다. 앞에 책상.'),
 'bookshelf 3w': ('책을 빽빽이 꽂은 3칸 폭 키 큰 책장.', '서고·저택 서재 북쪽 벽을 채우는 데 1~2개. 벽 한 면을 통째로.'),
 'barrel': ('쇠테 두른 빈 나무 통(뚜껑 닫힘).', '창고·술 창고·부엌 구석에 1~3개 모아 둔다. 궤짝·자루와 섞는다.'),
 'sack': ('끈으로 묶은 빈 삼베 자루(예제는 sack:grain 을 쓴다).', '창고·곳간 바닥 구석에 1~3개.'),
 'plant': ('테라코타 화분에 덤불처럼 자란 초록 식물.', '거실·가게 창가 구석에 1개. 문 양옆에 짝으로도.'),
 'pot': ('구리빛 둥근 항아리(주둥이 좁음).', '부엌·식료품 방·창고 구석에 1~2개. 물독 옆.'),
 'window': ('격자 나무 창(파란 유리 넷).', '거의 모든 방 벽면 윗줄에 1~3개. 방 가운데나 2~4칸 간격, 걸이·키 큰 가구와 겹치지 않게.'),
 'picture': ('금테 액자에 든 초록 들판 풍경화.', '거실·가게·복도 벽면 윗줄에 1~2개. 소파·식탁 위 가운데.'),
 'shelf pots': ('구리 단지·파란 병을 얹은 1칸 벽 선반.', '부엌·약국 조제실 벽면 윗줄에 1개. 작업대 위.'),
 'bottles': ('빨강·초록·노랑 술병을 줄지어 얹은 벽 선반.', '선술집·카지노 바 뒤 벽면 윗줄에 1개. 술통 선반·진열장 옆.'),
 'roundtable': ('외다리 둥근 탁자(윗면에 종이·잔).', '거실·서재 구석에 1개. 안락의자 곁, 찻상 대신.'),
 'weapon rack': ('칼·도끼를 세워 건 벽 무기 걸이.', '무기 가게·근위대 방·무기고 벽면 윗줄에 1~2개. 방패와 번갈아.'),
 'shield': ('붉은 바탕에 금 십자 문장 방패.', '무기 가게·드워프 홀·무기고 벽면 윗줄에 1~2개, 무기 걸이 사이.'),
 'rug red': ('금테 두른 붉은 마름모 무늬 양탄자(3×2, 밟음).', '예배당·저택 식당·여관 응접실 가운데 바닥에 1장. 식탁·찻상 밑.'),
 'stairs up stone': ('돌 계단(3칸 폭, 벽면 두 줄을 덮고 위로 오른다).', '간수실·지하 북쪽 벽에 1개 → 위층 이동 이벤트(links). 계단 밑 칸은 비운다.'),
 'stairs up wood': ('나무 계단(3칸 폭, 벽면 두 줄을 덮고 위로 오른다).', '저택·집 현관 홀 북쪽 벽에 1개. 2층 같은 (x,y)에 stairwell down.'),
 'bench 2': ('등받이 없는 2칸 나무 벤치.', '긴 식탁 위·아래 줄(드워프 홀 8개), 예배당·복도 벽 곁에 1~2개.'),
 'bench 3': ('등받이 없는 3칸 나무 벤치.', '3칸 이상 긴 식탁 위·아래 줄에 1개씩. 대기실 벽 곁.'),
 'display potion': ('물약 세 병을 얹은 작은 나무 진열대(1칸).', '약국 가게 카운터 앞·가운데에 1~2개. 천 진열 탁자와 다르다.'),
 'display apple': ('사과를 쌓은 작은 나무 진열대(1칸).', '채소·과일 가게 문 곁 바닥에 1~2개. 궤짝 줄 끝.'),
 'display bread': ('둥근빵을 쌓은 작은 나무 진열대(1칸).', '빵집 가게 문 곁·카운터 앞에 1개. 빵 선반 맞은편.'),
 'nightstand': ('서랍 하나 달린 작은 협탁(윗면에 촛대·책).', '모든 침실·객실 침대 바로 옆에 1개(닫집 침대는 양옆 2개).'),
 'dining 1x1': ('1칸 나무 식탁(자동 타일).', '좁은 부엌·관리인 방·선술집 구석에 1개. 의자 1~2개(E/W).'),
 'dining 2x1': ('2칸 나무 식탁(자동 타일).', '선술집·여관 홀에 2~3개, 부엌·쉼터에 1개. 위아래 chair S/N 이나 벤치.'),
 'dining 3x1': ('3칸 나무 식탁(자동 타일).', '가족 식당·선술집에 1개. 위아래 줄에 의자 3개씩.'),
 'dining 4x1': ('4칸 긴 나무 식탁(자동 타일).', '저택 식당 1개, 드워프 홀 2개. 위아래 의자 4개씩 또는 벤치 2개씩.'),
 'dining 2x2': ('2×2 네모 나무 식탁(자동 타일).', '부엌·식당 가운데에 1개. 네 변에 의자 1개씩.'),
 'dining 3x2': ('3×2 넓은 나무 식탁(자동 타일).', '식당 가운데 1개. 위아래 의자 3개씩, 양 끝 E/W.'),
 'dining 4x2': ('4×2 큰 나무 식탁(자동 타일).', '연회장·큰 식당 가운데 1개. 둘레 의자 10개 안팎.'),
 'work 1x1': ('1칸 밝은 소나무 작업대(자동 타일).', '부엌·곳간·정비소 구석에 1개. 윗면에 도마·그릇·공구.'),
 'work 2x1': ('2칸 소나무 작업대(자동 타일).', '부엌·조제실·양조실에 1개. 화덕·가마솥 옆, 윗면에 도구.'),
 'work 3x1': ('3칸 소나무 작업대(자동 타일).', '빵 굽는 방·손질터·대장간·재단 작업실에 1개. 업종 도구를 윗면에.'),
 'work 4x1': ('4칸 긴 소나무 작업대(자동 타일).', '큰 작업장·공방 벽 따라 1개.'),
 'work 2x2': ('2×2 소나무 작업대(자동 타일).', '부엌·공방 한가운데 섬으로 1개. 둘레를 걸을 수 있게.'),
 'work 3x2': ('3×2 넓은 소나무 작업대(자동 타일).', '큰 빵 굽는 방·연금술 방 가운데 1개.'),
 'work 4x2': ('4×2 큰 소나무 작업대(자동 타일).', '성 부엌·큰 공방 가운데 1개.'),
 'desk 1x1': ('1칸 짙은 나무 책상(서랍 받침).', '손님방·작은 침실 구석에 1개. 남쪽에 chair N.'),
 'desk 2x1': ('2칸 짙은 나무 책상(서랍 받침).', '서재·약사 방·제어실에 1개. 책장 앞, 남쪽에 chair N 1개.'),
 'desk 3x1': ('3칸 짙은 나무 책상.', '저택 서재 가운데 1개. 뒤 북쪽 벽에 책장 줄, 남쪽에 의자.'),
 'desk 4x1': ('4칸 긴 책상.', '필사실·관청 사무실에 1개. 남쪽 줄에 의자 2개.'),
 'desk 2x2': ('2×2 넓은 책상.', '집무실 가운데 1개. 남쪽에 의자, 둘레에 책장.'),
 'desk 3x2': ('3×2 큰 책상.', '영주·학자 집무실 가운데 1개. 위에 지도·종이.'),
 'desk 4x2': ('4×2 회의 책상.', '길드·회의실 가운데 1개. 둘레에 의자.'),
 'display 1x1': ('흰 천을 덮은 1칸 진열 탁자(자동 타일).', '작은 가게 문 곁에 1개. 윗면에 상품 1개.'),
 'display 2x1': ('흰 천을 덮은 2칸 진열 탁자(자동 타일).', '빵집·정육점 가게 가운데에 1개. 윗면에 빵 바구니·고기.'),
 'display 3x1': ('흰 천을 덮은 3칸 진열 탁자(자동 타일).', '빵집·재단사 가게 가운데 섬으로 1개. 둘레로 손님이 돈다.'),
 'display 4x1': ('흰 천을 덮은 4칸 긴 진열 탁자.', '큰 가게 가운데 1개. 양쪽 통로를 남긴다.'),
 'display 2x2': ('흰 천을 덮은 2×2 진열 탁자.', '가게 한가운데 섬으로 1개. 네 변을 걸을 수 있게.'),
 'display 3x2': ('흰 천을 덮은 3×2 진열 탁자.', '시장 가게·잡화점 가운데 1개.'),
 'display 4x2': ('흰 천을 덮은 4×2 큰 진열 탁자.', '큰 상점 홀 가운데 1개.'),
 'counter 1x1': ('붉은 판자 앞면의 1칸 가게 카운터.', '노점·작은 창구에 1개. 북쪽=주인, 남쪽=손님.'),
 'counter 2x1': ('2칸 가게 카운터(붉은 판자 앞면).', '생선가게·정육점 문 가까이 1개. 북쪽 주인 칸, 남쪽 손님 칸 비움.'),
 'counter 3x1': ('3칸 가게 카운터.', '빵집·대장간·재단사·카지노 창구에 1개. 뒤 벽에 선반·진열장.'),
 'counter 4x1': ('4칸 긴 카운터(바).', '약국·선술집·여관 바에 1개. 남쪽에 바 의자 2~3개.'),
 'kcounter 1x1': ('돌 상판+소나무 찬장 문 1칸 부엌 조리대.', '작은 부엌 북쪽 벽 끝에 1개. 개수대 옆.'),
 'kcounter 2x1': ('돌 상판 2칸 부엌 조리대.', '부엌 북쪽 벽에 1~2개. 레인지와 개수대 사이, 위 벽면에 그릇 선반.'),
 'kcounter 3x1': ('돌 상판 3칸 부엌 조리대.', '큰 부엌 북쪽 벽에 1개. 화덕 옆.'),
 'kcounter 4x1': ('돌 상판 4칸 긴 조리대.', '성·여관 큰 부엌 북쪽 벽에 1개.'),
 'sideboard 1x1': ('짙은 나무 1칸 낮은 찬장(문 하나).', '식당·복도 북쪽 벽 끝에 1개. 위에 촛대.'),
 'sideboard 2x1': ('짙은 나무 2칸 낮은 찬장(문 둘).', '저택 식당 북쪽 벽에 2개, 식탁을 가운데 두고 대칭으로.'),
 'sideboard 3x1': ('짙은 나무 3칸 낮은 찬장.', '식당 북쪽 벽 가운데 1개. 위에 접시·촛대.'),
 'sideboard 4x1': ('짙은 나무 4칸 긴 찬장.', '연회장·큰 식당 북쪽 벽에 1개.'),
 'tea 1x1': ('붉은 천 1칸 찻상(자동 타일).', '안락의자 1~2개 곁에 1개. 거실·응접실·라운지 구석.'),
 'tea 2x1': ('붉은 천 2칸 찻상(자동 타일).', '소파 앞·엘프 전당 벤치 사이에 1~2개.'),
 'tea 3x1': ('붉은 천 3칸 긴 찻상.', '응접실 소파 앞 가운데 1개.'),
 'tea 4x1': ('붉은 천 4칸 긴 찻상.', '큰 응접실 가운데 1개. 양옆 벤치.'),
 'tea 2x2': ('붉은 천 2×2 찻상.', '거실 한가운데 1개. 네 변에 안락의자.'),
 'tea 3x2': ('붉은 천 3×2 찻상.', '살롱 가운데 1개. 둘레 소파·안락의자.'),
 'tea 4x2': ('붉은 천 4×2 큰 찻상.', '귀족 응접실 가운데 1개.'),
 'firewood rack': ('둥근 단면이 보이게 장작을 쌓은 1칸 선반(16px 솟음).', '빵 화덕·레인지·벽난로 바로 옆 북쪽 벽 앞에 1개.'),
 'firewood rack 2w': ('장작을 쌓은 2칸 폭 선반(16px 솟음).', '큰 부엌·연회장 화덕 옆 북쪽 벽 앞에 1개.'),
 'towel rail': ('흰·파란 수건을 건 놋쇠 걸이.', '욕실 벽면 윗줄에 1개. 욕조나 세면대 바로 위.'),
 'bread shelf': ('둥근빵·식빵을 3단에 늘어놓은 벽 빵 선반.', '빵집 가게 북쪽 벽 앞에 1~2개. 파이·바게트 선반과 번갈아 줄지어.'),
 'bread shelf pie': ('파이·케이크 조각을 3단에 얹은 빵 선반.', '빵집 가게 북쪽 벽 앞, 빵 선반 줄 사이에 1~2개.'),
 'bread shelf baguette': ('바게트를 눕혀 3단에 얹은 빵 선반.', '빵집 가게 북쪽 벽 앞, 빵 선반 줄 끝에 1~2개.'),
 'column marble': ('흰 대리석 기둥(1칸, 24px 솟음).', '예배당·알현실 홀을 나누는 두 줄, 3~4칸 간격(예배당 12개·알현실 6개). 베이마다 북쪽 벽에 창.'),
 'column stone': ('회색 돌 기둥(1칸, 24px 솟음).', '성 홀·지하·신전 복도에 3~4칸 간격 두 줄. 대리석보다 소박한 건물.'),
 'column steel': ('리벳 박은 검은 강철 기둥(24px 솟음).', '마도 기관실·공장 홀에 3~4칸 간격 두 줄. 증기관 곁.'),
 'round window': ('나무 테 둥근 창(파란 유리 십자).', '호빗 굴 방마다 벽면 윗줄에 1개. 방 가운데.'),
 'ore pile': ('회색 바위에 청록 광석이 박힌 더미.', '광산 막장·드워프 대장간 바닥에 1~2개. 광차·곡괭이 걸이 곁.'),
 'stone throne': ('등받이 높은 검은 돌 왕좌(금 띠, 16px 솟음).', '드워프 왕의 홀·지하 왕좌 단 가운데에 1개. 양옆 화로.'),
 'leaf lantern': ('잎 모양 쇠틀에 담긴 초록빛 등(움직임).', '엘프 궁정 벽면 윗줄에 방마다 1~4개, 태피스트리 사이.'),
 'elven bed': ('잎 덩굴 머리판의 파란 이불 1인 침대(1×2).', '엘프 침소 북쪽 벽 앞에 1개. 옆에 협탁·하프.'),
 'long hearth 3': ('잉걸불이 반짝이는 남북 3칸 긴 화덕(바닥).', '작은 연회장 가운데 1개. 양옆에 1×3 식탁·의자 줄.'),
 'long hearth 4': ('남북 4칸 긴 화덕(바닥, 잉걸불 움직임).', '연회장 가운데 1개. 양옆 식탁 줄, 기둥 두 줄.'),
 'long hearth 5': ('남북 5칸 긴 화덕(바닥, 잉걸불 움직임).', '황금 연회장 가운데 1개. 양옆 식탁 넷·의자 12개, 나무 기둥 6개.'),
 'long hearth 6': ('남북 6칸 긴 화덕(바닥, 잉걸불 움직임).', '큰 왕의 홀 가운데 1개. 양옆 긴 식탁 줄.'),
 'owl perch': ('나무 횃대에 앉은 부엉이(눈을 깜박인다).', '마법사의 탑 서재 창가에 1개. 책장·천체 모형 곁.'),
 'star chart': ('남색 바탕에 별자리를 그린 액자.', '탑 서재·엘프 필사실 벽면 윗줄에 1개. 망원경·책상 위.'),
 'orrery': ('놋쇠 받침 위 행성이 도는 천체 모형.', '마법사의 탑 서재 바닥에 1개. 책상·마법진 곁.'),
 'shackles': ('벽에 박은 쇠사슬 족쇄 한 쌍.', '감방마다 벽면 윗줄에 1~2개. 짚 침대 위쪽.'),
 'slop bucket': ('쇠테 두른 작은 나무 오물통.', '감방마다 구석 바닥에 1개. 뒷골목 선술집 구석.'),
 'pick rack': ('곡괭이 두 자루를 건 나무 가로대.', '광산 갱도·광부 쉼터·드워프 대장간 벽면 윗줄에 1개.'),
 'powder kegs': ('붉은 화약 통 셋을 삼각으로 쌓은 더미.', '화약고·광산 창고·기관실 구석에 1~2개. 등불·화로에서 떨어뜨린다.'),
 'steam vent': ('김이 피어오르는 바닥 쇠 격자 구멍(움직임).', '마도 기관실 기관 둘레 바닥에 2개. 증기관 끝.'),
 'magitek armor': ('두 다리로 선 둥근 몸통 마도 갑옷(2×2, 16px 솟음).', '마도 갑옷 정비소 가운데 1개. 공구 걸이·작업대 곁.'),
 'music stand': ('흰 악보를 올린 검은 쇠 보면대.', '극장 오케스트라 석에 5개 안팎 반원으로. 지휘대를 향해.'),
 'scenery flat': ('성과 들판을 그린 무대 배경판(3칸, 북쪽 벽 앞).', '극장 무대 뒤 북쪽 벽에 1~2개. 무대 막 사이.'),
 'conductor podium': ('지휘봉을 얹은 작은 나무 지휘대.', '오케스트라 석 가운데 1개. 보면대들이 둘러싼다.'),
 'felt 1x1': ('초록 펠트 1칸 도박 탁자(자동 타일).', '카지노·뒷골목 선술집 구석에 1개. 의자 1~2개.'),
 'felt 2x1': ('초록 펠트 2칸 카드 탁자(자동 타일).', '카지노에 2개, 뒷골목 술집에 1개. 위아래 chair S/N.'),
 'felt 3x1': ('초록 펠트 3칸 카드 탁자.', '카지노 홀에 1개. 위아래 의자 3개씩.'),
 'felt 2x2': ('초록 펠트 2×2 카드 탁자.', '카지노 홀 가운데 1개. 네 변에 의자.'),
 'felt 3x2': ('초록 펠트 3×2 큰 도박 탁자.', '카지노 홀 가운데 1개. 둘레 의자 6~8개.'),
 'slot machine': ('붉은 몸통에 불빛이 깜박이는 슬롯머신(16px 솟음).', '카지노 북쪽 벽 앞에 3~6개 나란히. 앞 칸에 바 의자를 두지 않는다.'),
 'hay bale': ('끈 두 줄로 묶은 네모 건초 더미.', '마구간 우리마다 구석에 1개. 먹이통 곁.'),
 'feed trough': ('초록 풀이 담긴 2칸 나무 먹이통.', '마구간 우리 벽 쪽에 1개씩. 물통과 짝.'),
 'water trough': ('파란 물이 담긴 2칸 나무 물통.', '마구간 우리 벽 쪽에 1개씩. 먹이통 옆.'),
 'saddle rack': ('붉은 안장을 걸친 나무 받침(8px 솟음).', '마구 방에 2개, 마구간 통로 끝에 1개.'),
 'pitchfork': ('벽에 기대 건 쇠스랑.', '마구간 벽면 윗줄에 1~2개. 건초 더미 위.'),
 'pew E2': ('동쪽을 보는 2칸 회중석(서쪽 등판, 붉은 방석).', '동향 예배당 신랑에 기둥 칸을 피해 남북 두 줄로 10개 안팎. 가운데 통로를 비운다.'),
 'pew E3': ('동쪽을 보는 3칸 회중석(서쪽 등판).', '넓은 동향 예배당 신랑에 두 줄. 가운데 통로·기둥 칸을 피한다.'),
}


# 설명은 20자 이상이었지만 「어디에」가 비었거나 한 단어뿐이던 것(그림 확인 후 보강)
D6.update({
 'stairs down': ('바닥에 뚫린 1칸 내려가는 계단(밟음).', '집·가게 구석 바닥에 1개 → 지하로 이동 이벤트(links). 둘레 칸은 비운다.'),
 'column live': ('꼭대기에 잎이 돋은 살아 있는 나무 기둥(24px 솟음).', '엘프 전당 달빛 못 양옆에 2개씩, 3~4칸 간격.'),
 'round door': ('호빗 굴 둥근 초록 문(2칸, 벽면 두 줄을 덮는다).', '호빗 굴 복도 북쪽 벽면에 1~2개. 문 앞 칸은 비운다(장식 문).'),
 'drip puddle': ('물방울이 떨어져 동심원이 퍼지는 웅덩이(밟음, 움직임).', '감방·지하·뒷골목 젖은 바닥에 방마다 1~2개.'),
 'gear wall': ('맞물려 도는 청동·강철 톱니 벽(2칸, 벽면 두 줄).', '마도 기관 홀 북쪽 벽면에 1~2개. 계기판과 번갈아.'),
 'gauge panel': ('바늘 두 개가 흔들리는 계기판(벽면 윗줄).', '기관 홀·제어실 벽면 윗줄에 방마다 2개. 제어반 위.'),
 'control console': ('버튼 불빛이 깜박이는 2칸 제어반(북쪽 벽 앞).', '제어실 북쪽 벽 앞에 1개. 위 벽면에 계기판 둘.'),
 'curtain wing': ('비스듬히 드리운 붉은 무대 날개 막(바닥, 24px 솟음).', '극장 무대 앞 양끝 바닥에 1개씩(좌우 짝).'),
 'bell rope': ('붉은·흰 손잡이가 달린 종 줄(벽면 두 줄 걸이).', '예배당 종탑 벽면에 1개. 나선 계단 곁.'),
 'mine cart': ('광석을 실은 쇠 광차(1칸, 막힘).', '광산 갱도·드워프 대장간의 선로(rail) 위에 1~2개.'),
 'anvil': ('검은 쇠모루(1칸).', '대장간 작업장 용광로 앞 1~2칸에 1개. 옆에 담금질 통.'),
 'quench barrel': ('물이 찬 쇠테 담금질 통.', '대장간 작업장 모루 바로 옆에 1개.'),
 'lectern': ('펼친 성경을 올린 나무 설교대.', '예배당 제단 앞 한쪽에 1개. 설교단 맞은편.'),
 'crate': ('X 띠를 두른 빈 나무 궤짝.', '창고·대장간·기관실 구석에 1~3개 쌓는다. 통·자루와 섞는다.'),
 'chest': ('쇠띠 두른 나무 상자(뚜껑 닫힘).', '침대 발치·창고·무기고 구석에 1개. 방마다 하나면 충분.'),
 'cupboard': ('서랍 셋 달린 나무 서랍장(윗면에 꽃병·병).', '침실·거실 북쪽 벽 앞에 1개. 옷장 옆.'),
 'clock': ('추가 보이는 키 큰 괘종시계.', '저택 거실·여관 홀 북쪽 벽 앞 구석에 1개.'),
 'mortar and pestle': ('공이가 꽂힌 바닥용 큰 돌 절구.', '약국 조제실 작업대 옆 바닥에 1개. 탁상용은 goods:mortar.'),
 'fishing net': ('주황 부표가 달린 그물(벽 걸이).', '생선가게 손질터·어부 집 벽면 윗줄에 1개.'),
 'wall torch': ('불꽃이 흔들리는 벽 횃불(벽면 윗줄, 움직임).', '지하·드워프 홀·감옥·종탑 복도 벽면에 3~4칸 간격.'),
 'hanging lantern': ('쇠 등갓 안에 불이 켜진 매단 등(벽면 윗줄).', '광산 갱도·마구간·예배당 현관 벽면에 방마다 1~2개.'),
 'brazier': ('불꽃 셋이 이는 쇠 바닥 화로(1칸).', '왕좌 단 양옆·드워프 홀 문 양옆에 2개씩 짝으로.'),
 'royal banner': ('금 문장이 달린 붉은 왕기(벽면 두 줄 걸이).', '알현실 왕좌 뒤·연회장 벽에 2개씩 좌우 대칭.'),
 'throne': ('금테 두른 붉은 왕좌(키가 크다).', '알현실·연회장 단(dais) 위 북쪽 가운데에 1개. 양옆 화로·왕기.'),
 'cheese wheels': ('노란 바퀴 치즈를 쌓은 더미(바닥).', '호빗 굴·성 식료품 방 바닥에 1개. 햄 걸이 밑.'),
 'notice board': ('쪽지가 붙은 나무 게시판(벽면 윗줄).', '선술집·여관 홀·가게·예배당 현관 벽면에 1개. 문 가까이.'),
 'deer trophy': ('사슴 머리 박제(벽면 윗줄).', '선술집·여관 홀 벽난로 위 벽면에 1개.'),
})

# ---------------------------------------------------------------- 재고 변형(그릇 × 상품)
CONT = {  # 그릇 모양, 어디에·몇 개
 'crate': ('나무 궤짝', '바닥에 2~3개 붙여 줄지어'),
 'basket': ('엮은 바구니', '바닥·진열 탁자 곁에 1~2개'),
 'barrel': ('뚜껑 연 나무 통', '구석 바닥에 1~2개'),
 'shelf': ('2단 벽 선반', '벽면 윗줄에 1~2개 나란히'),
 'cabinet': ('키 큰 3단 진열장', '북쪽 벽 앞, 카운터 뒤에 1~2개'),
 'hang': ('줄에 매단 걸이', '벽면 윗줄, 작업대·카운터 위에 1~2개'),
 'table': ('천 덮은 2칸 진열 탁자', '가게 가운데 바닥에 1개'),
 'sack': ('삼베 자루', '바닥 구석에 1~3개'),
 'ice chest': ('얼음 깐 2칸 진열함', '카운터 줄 옆에 1~2개'),
}
GOODS_PLACE = [  # 상품 → 쓰는 곳(첫 맞는 것)
 (('cabbage', 'carrot', 'tomato', 'pumpkin', 'potato', 'onion', 'eggplant'), '채소가게·시장·부엌·식료품 방'),
 (('apple', 'lemon'), '과일 가게·시장·식료품 방'),
 (('grape',), '과일 가게·술 창고(포도주)'),
 (('fish', 'fishr', 'fishg', 'squid', 'crab', 'shell'), '생선가게·항구 창고'),
 (('loaf', 'baguette', 'bun', 'pie', 'cake'), '빵집 가게'),
 (('potion', 'herb', 'vial', 'flask', 'jar'), '약국·조제실·연금술 방'),
 (('mushroom',), '식료품 방·호빗 굴·약국'),
 (('flower',), '꽃집·잡화점·엘프 궁정'),
 (('book', 'scroll'), '서재·서점·탑 서재'),
 (('gem', 'coins'), '보석상·보물 창고·카지노 환전 창구'),
 (('yarn', 'bolt', 'wool'), '재단사 가게·작업실'),
 (('bottle', 'mug'), '선술집·카지노 바 뒤'),
 (('candle',), '예배당 제의실·잡화점'),
 (('cheese', 'egg'), '정육점·식료품 방'),
 (('ingot',), '대장간·드워프 보물 창고'),
 (('toy',), '잡화점·장난감 가게'),
 (('skull', 'crystal'), '마법사의 탑·점술가 방'),
 (('grain',), '빵집 창고·부엌·곳간'),
 (('flour',), '빵 굽는 방·빵집 창고'),
 (('sausage', 'ham', 'steak'), '정육점·식료품 방'),
 (('plate', 'cup'), '부엌·식당·잡화점'),
]
def goods_place(goods):
    for keys, where in GOODS_PLACE:
        if any(g in keys for g in goods): return where
    return '가게·창고'
def variant_note(oid, name_ko):
    c, g = oid.split(':'); goods = g.split('+')
    look, where = CONT[c]
    return (f'{name_ko} — {look}, 담긴 상품만 다른 변형.', f'{goods_place(goods)}의 {where}.')

# 짝 소품을 직접 정한 것(예제 공존만으로는 바 의자·창 같은 흔한 것이 먼저 잡힌다)
PAIR6 = {'chair S': ['dining 2x1', 'chair N', 'bench 2'], 'chair N': ['dining 2x1', 'desk 2x1', 'chair S'], 'chair E': ['chair W', 'dining 1x1', 'dining 1x3'],
         'chair W': ['chair E', 'dining 1x1', 'dining 1x3'], 'stool': ['piano', 'dining 2x1', 'vanity mirror'], 'bench 2': ['dining 4x1', 'dining 2x1'], 'bench 3': ['dining 3x1', 'dining 4x1'],
         'window': ['curtained window', 'picture'], 'picture': ['sofa', 'dining 2x1', 'window'], 'barrel': ['crate', 'sack:grain', 'keg rack'],
         'potted fern': ['potted flowering', 'tall vase red'], 'bar stool': ['counter 4x1', 'keg rack', 'bottles'], 'counter 4x1': ['bar stool', 'keg rack', 'goods:beer'],
         'dining 2x1': ['chair S', 'chair N', 'bench 2'], 'dining 1x1': ['chair E', 'chair W'], 'dining 4x1': ['chair S', 'chair N', 'bench 2'], 'desk 2x1': ['chair N', 'bookshelf 2w', 'goods:papers'],
         **{b: ['nightstand', 'wardrobe', 'chest'] for b in ('bed green', 'bed red', 'bed blue', 'elven bed')},
         **{b: ['nightstand', 'wardrobe', 'royal chest'] for b in ('double bed green', 'double bed red', 'double bed blue')},
         'straw bed': ['slop bucket', 'shackles', 'chest']}

# 태그가 비었던 분류(v5 새 건물)와 예제에 안 쓰인 소품
CAT_TAGS = {'casino': ['카지노'], 'dungeon': ['지하 감옥', '감방'], 'elf': ['엘프 궁정'], 'hall': ['연회장', '알현실'],
            'hobbit': ['호빗 굴'], 'magitek': ['마도 기관실'], 'mine': ['광산'], 'opera': ['극장'], 'stable': ['마구간'], 'tower': ['마법사의 탑']}
TAG6 = {'potted cactus': ['사막', '잡화점'], 'stone throne': ['드워프 홀', '알현실'], 'column steel': ['마도 기관실', '공장'], 'column stone': ['성', '신전', '지하'],
        'sack': ['창고'], 'plant': ['거실', '가게'], 'pot': ['부엌', '창고'], 'shelf pots': ['부엌', '약국'], 'roundtable': ['거실', '서재'],
        'runner': ['복도', '현관'], 'banner red': ['성', '무기점'], 'banner blue': ['성'], 'double bed green': ['침실'], 'double bed blue': ['침실'],
        'long hearth 3': ['연회장'], 'long hearth 4': ['연회장'], 'long hearth 6': ['연회장']}

# ---------------------------------------------------------------- 방 종류
ROOMS = {  # key: (이름, 찾는 말)
 'bakery_oven': ('빵 굽는 방', ['빵집', '제빵실', '굽는 방']),
 'bakery_shop': ('빵집 가게', ['빵집', '빵가게']),
 'storeroom': ('창고', ['창고', '곳간', '헛간', '화약고', '소품 창고']),
 'alchemy': ('조제실·연금술 방', ['약국', '조제실', '연금술', '마녀']),
 'pharmacy_shop': ('약국 가게', ['약국', '약방', '약재상']),
 'prep': ('손질터(생선·고기)', ['손질방', '손질터']),
 'cold_store': ('찬 창고', ['찬 창고', '얼음 창고', '냉장']),
 'fish_shop': ('생선가게', ['생선가게', '어물전']),
 'butcher_shop': ('정육점 가게', ['정육점', '고깃간']),
 'forge': ('대장간 작업장', ['대장간', '용광로', '작업장']),
 'weapon_shop': ('무기 가게', ['무기점', '무기 가게', '방어구']),
 'tailor_work': ('재단 작업실', ['재단사', '작업실', '베틀']),
 'fitting': ('탈의실', ['탈의실', '의상실']),
 'tailor_shop': ('옷가게', ['재단사', '옷가게', '양복점']),
 'bell_tower': ('종탑', ['종탑']),
 'chapel': ('예배당 본당', ['예배당', '교회', '성당', '신전']),
 'entrance': ('현관·입구 홀', ['현관', '입구', '로비']),
 'vestry': ('제의실', ['제의실', '사제 방']),
 'kitchen': ('부엌', ['부엌', '주방', '조리실']),
 'bedroom': ('침실', ['침실', '하녀 방', '관리인 방', '손님방']),
 'master_bedroom': ('안방·왕의 침소', ['안방', '침소', '왕의 방']),
 'inn_room': ('여관 객실', ['여관', '객실', '숙소']),
 'bathroom': ('욕실', ['욕실', '목욕탕']),
 'living': ('거실·응접실', ['거실', '응접실', '라운지']),
 'dining': ('식당', ['식당']),
 'study': ('서재', ['서재', '집무실', '필사실']),
 'library': ('서고', ['서고', '도서관']),
 'tavern': ('선술집 홀·바', ['선술집', '술집', '주점', '주막', '바', '여관']),
 'cellar': ('술 창고·양조실', ['술 창고', '양조실', '저장고']),
 'pantry': ('식료품 방', ['식료품', '식품 창고']),
 'corridor': ('복도', ['복도', '통로']),
 'treasury': ('보물 창고', ['보물고', '보물 창고', '금고']),
 'great_hall': ('큰 홀·연회장', ['연회장', '큰 홀', '전당']),
 'armory': ('무기고', ['무기고', '병기고']),
 'guard_room': ('근위대 방·간수실', ['근위대', '경비실', '간수실']),
 'throne_room': ('알현실', ['알현실', '왕좌']),
 'waiting_room': ('대기실', ['대기실']),
 'cell': ('감방', ['감옥', '감방']),
 'mine': ('갱도·막장', ['광산', '갱도', '막장']),
 'rest': ('쉼터', ['쉼터', '광부 쉼터']),
 'engine_hall': ('기관 홀', ['기관실', '기관 홀']),
 'control_room': ('제어실', ['제어실', '조종실']),
 'workshop': ('정비소', ['정비소', '공방']),
 'theater': ('극장 무대·객석', ['극장', '무대', '객석']),
 'dressing': ('분장실', ['분장실']),
 'casino': ('도박장', ['카지노', '도박장']),
 'stable': ('마구간 우리', ['마구간', '외양간']),
 'tack_room': ('마구 방', ['마구 방']),
}
# 예제 맵의 방(분할 결과의 첫 칸 x,y) → 방 종류
LABELS = {
 'bakery': {'1,1': 'bakery_oven', '10,1': 'storeroom', '1,7': 'bakery_shop'},
 'pharmacy': {'1,1': 'alchemy', '8,1': 'bedroom', '1,7': 'pharmacy_shop'},
 'fish': {'1,1': 'cold_store', '7,1': 'prep', '1,7': 'fish_shop'},
 'butcher': {'1,1': 'prep', '8,1': 'cold_store', '1,7': 'butcher_shop'},
 'smithy': {'1,1': 'forge', '8,1': 'bedroom', '8,6': 'weapon_shop'},
 'chapel': {'1,1': 'bell_tower', '6,1': 'chapel', '10,15': 'entrance', '23,15': 'vestry'},
 'scholar': {'1,1': 'kitchen', '7,1': 'bedroom', '13,1': 'study', '1,7': 'library'},
 'tailor': {'1,1': 'tailor_work', '9,1': 'fitting', '1,7': 'tailor_shop'},
 'tavern': {'1,1': 'kitchen', '8,1': 'cellar', '12,1': 'tavern'},
 'manor_1f': {'1,1': 'bedroom', '6,1': 'storeroom', '10,1': 'entrance', '16,1': 'kitchen', '1,11': 'living', '16,11': 'dining'},
 'manor_2f': {'1,1': 'bedroom', '6,1': 'bedroom', '10,1': 'corridor', '16,1': 'bathroom', '20,1': 'bedroom', '1,11': 'master_bedroom', '10,11': 'living', '16,11': 'study'},
 'hobbit': {'1,1': 'pantry', '6,1': 'kitchen', '13,1': 'living', '20,1': 'bedroom', '1,7': 'corridor'},
 'inn': {'1,1': 'kitchen', '8,1': 'cellar', '12,1': 'living', '19,1': 'corridor', '22,1': 'inn_room', '22,6': 'inn_room', '1,7': 'tavern', '22,11': 'inn_room'},
 'dwarf': {'1,1': 'forge', '8,1': 'treasury', '15,1': 'cellar', '1,7': 'great_hall'},
 'elf': {'1,1': 'bedroom', '8,1': 'great_hall', '15,1': 'study'},
 'mead': {'1,1': 'master_bedroom', '6,1': 'great_hall', '18,1': 'kitchen', '1,8': 'pantry', '18,8': 'armory'},
 'throne': {'1,1': 'guard_room', '6,1': 'throne_room', '18,1': 'study', '6,15': 'waiting_room'},
 'tower': {'6,1': 'study', '2,10': 'alchemy', '10,10': 'entrance'},
 'dungeon': {'1,1': 'guard_room', '7,1': 'cell', '12,1': 'cell', '17,1': 'cell'},
 'mine': {'1,1': 'storeroom', '7,1': 'mine', '1,6': 'rest'},
 'magitek': {'1,1': 'engine_hall', '16,1': 'control_room', '16,7': 'workshop'},
 'opera': {'1,1': 'storeroom', '5,1': 'theater', '20,1': 'dressing', '20,9': 'storeroom'},
 'casino': {'1,1': 'casino', '17,1': 'tavern'},
 'stable': {'1,1': 'stable', '15,1': 'tack_room', '15,7': 'bedroom'},
 'narshe': {'1,1': 'bedroom', '7,1': 'kitchen', '1,7': 'living', '12,7': 'entrance'},
 'zozo': {'1,1': 'tavern', '12,1': 'bedroom', '12,7': 'storeroom'},
}

def segment(plan):
    """'#' 로 나뉜 방 분할. 문 틈 칸(얇은 칸막이의 1~3칸 틈)을 잘라 4방 연결 성분을 방으로 본다. {칸: 방 번호}, 방 수, 방별 첫 칸."""
    H = len(plan); W = len(plan[0])
    op = lambda x, y: 0 <= x < W and 0 <= y < H and plan[y][x] != '#'
    gap = set()
    for y in range(H):
        x = 0
        while x < W:
            if not op(x, y): x += 1; continue
            x0 = x
            while x < W and op(x, y): x += 1
            if x - x0 <= 3 and x0 > 0 and x < W and all(op(i, y - 1) and op(i, y + 1) for i in range(x0, x)) \
               and ((op(x0 - 1, y - 1) and op(x0 - 1, y + 1)) or (op(x, y - 1) and op(x, y + 1))):
                gap.update((i, y) for i in range(x0, x))
    for x in range(W):
        y = 0
        while y < H:
            if not op(x, y): y += 1; continue
            y0 = y
            while y < H and op(x, y): y += 1
            if y - y0 <= 3 and y0 > 0 and y < H and all(op(x - 1, j) and op(x + 1, j) for j in range(y0, y)) \
               and ((op(x - 1, y0 - 1) and op(x + 1, y0 - 1)) or (op(x - 1, y) and op(x + 1, y))):
                gap.update((x, j) for j in range(y0, y))
    comp = {}; seeds = []
    for y in range(H):
        for x in range(W):
            if op(x, y) and (x, y) not in gap and (x, y) not in comp:
                n = len(seeds); seeds.append(f'{x},{y}'); st = [(x, y)]; comp[(x, y)] = n
                while st:
                    a, b = st.pop()
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        c = (a + dx, b + dy)
                        if op(*c) and c not in gap and c not in comp: comp[c] = n; st.append(c)
    return comp, seeds

def example_rooms(buildings):
    """예제 맵마다 방 종류별 가구 사용 수. [(map_id, building_id, room_key, Counter(id))]"""
    out = []
    for b in buildings:
        for m in b['maps']:
            comp, seeds = segment(m['plan']); lab = LABELS.get(m['id'], {})
            per = defaultdict(Counter)
            for it in m['items']:
                k = None
                for dy in (0, 1, 2, -1):
                    k = comp.get((it['x'], it['y'] + dy))
                    if k is not None: break
                if k is None or seeds[k] not in lab: continue
                per[seeds[k]][it['id']] += 1
            for seed, key in lab.items():
                assert seed in seeds, (m['id'], seed)
                out.append((m['id'], b['id'], key, per.get(seed, Counter())))
    return out

def split_desc(desc):
    """옛 설명 → (무엇, 어디에). 첫 문장을 앞, 나머지를 뒤."""
    m = re.match(r'^(.+?\.)\s+(.*)$', desc)
    return (m.group(1), m.group(2)) if m else (desc, '')

def apply_meta(objs, buildings):
    rooms = example_rooms(buildings)
    room_tags = defaultdict(list)
    for _mid, _bid, key, cnt in rooms:
        for oid in cnt:
            t = ROOMS[key][0]
            if t not in room_tags[oid]: room_tags[oid].append(t)
    # 예제에 안 쓰인 크기 변형(탁자 4×2 등)은 같은 묶음(variantGroup)이 쓰인 방을 물려받는다
    group_tags = defaultdict(list)
    for o in objs:
        for t in room_tags.get(o['id'], []):
            if t not in group_tags[o.get('variantGroup')]: group_tags[o.get('variantGroup')].append(t)
    for o in objs:
        if o['id'] not in room_tags and group_tags.get(o.get('variantGroup')): room_tags[o['id']] = group_tags[o['variantGroup']]
    for o in objs:
        oid = o['id']
        if oid in D6: what, where = D6[oid]
        elif ':' in oid: what, where = variant_note(oid, o['name_ko'])
        else: what, where = split_desc(o['description'])
        o['summary'] = what; o['where'] = where
        o['description'] = (what + ' ' + where).strip()
        base = list(o.get('tags') or []) + CAT_TAGS.get(o['category'], [])
        if o['category'] in GENERIC_CATS and room_tags.get(oid): base = []  # '집·침실·거실' 같은 분류 태그 대신 실제 쓰인 방
        tags = TAG6.get(oid, []) + base + room_tags.get(oid, [])
        seen = []
        for t in tags:
            if t not in seen: seen.append(t)
        o['tags'] = seen[:7]
    return objs

GENERIC_CATS = {'home', 'decor', 'shop', 'misc'}
KIND_RULE = {'wall': '북쪽 벽면 바로 아래 첫 바닥 줄', 'hang': '벽면 윗줄', 'flat': '밟는 바닥 무늬'}
def short(s, n):
    s = s.strip()
    return s if len(s) <= n else s[:n - 1].rstrip(' ,·') + '…'

def spec_notes(meta, objects_in_spec, tables, lines, daises):
    """handInteriorSpec 에 싣는 소품별 notes 와 방 표."""
    buildings = meta['buildings']; objs = {o['id']: o for o in meta['objects']}
    rooms = example_rooms(buildings)
    co = defaultdict(Counter); nroom = Counter()  # 같은 방에 함께 놓인 방 수
    for _mid, _bid, _key, cnt in rooms:
        ids = [i for i in cnt if i in objects_in_spec]
        for a in ids:
            nroom[a] += 1
            for b in ids:
                if a != b: co[a][b] += 1
    notes = {}
    for oid in objects_in_spec:
        o = objs[oid]
        pair = [p for p in PAIR6.get(oid, []) if p in objects_in_spec or p.startswith('goods:') or p.split(' ')[0] in tables]
        for r in o.get('related', []):
            rid = r['id']
            if rid in objects_in_spec or rid.startswith('goods:') or rid.split(' ')[0] in tables or rid in lines:
                if rid not in pair: pair.append(rid)
        # 모자라면 예제 방에서 함께 놓인 정도(자카드)로 채운다 — 흔한 창·통보다 늘 붙어 다니는 짝이 먼저
        jac = sorted(((co[oid][b] / (nroom[oid] + nroom[b] - co[oid][b]), b) for b in co[oid] if co[oid][b] >= min(2, nroom[oid])), reverse=True)
        for _j, rid in jac:
            if len(pair) >= 3: break
            if rid not in pair and objs[rid].get('variantGroup') != o.get('variantGroup'): pair.append(rid)
        notes[oid] = {'desc': short(o.get('summary') or o['description'], 60), 'tags': o['tags'][:4], 'place': short(o.get('where') or '', 60), 'pair': pair[:3]}
    # 예제 방 목록: [맵 id, 건물 id, 방 종류, [[가구 id, 개수], ...]] — 방 종류·건물별 모음은 도구가 이것으로 센다
    examples = [[mid, bid, key, [[i, n] for i, n in sorted(cnt.items(), key=lambda t: (-t[1], t[0]))]] for mid, bid, key, cnt in rooms]
    names = {b['id']: b['name_ko'] for b in buildings}
    room_kinds = {k: {'ko': ko, 'alias': al} for k, (ko, al) in ROOMS.items()}
    building_names = {bid: names[bid] for bid in dict.fromkeys(e[1] for e in examples)}
    return notes, {'kinds': room_kinds, 'buildings': building_names, 'examples': examples}
