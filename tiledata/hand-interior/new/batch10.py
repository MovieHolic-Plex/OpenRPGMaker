#!/usr/bin/env python3
"""새 기물 10차 — 판타지 · 중세 · 무림 둘째 묶음 + 대형(2026-10-03, 9차에 이어 사용자 「판타지, 중세, 무림 … 대형 오브젝트들도」).
중세 공방(도자기·유리·염색·활자·구두·무두질)·훈련장, 판타지 종족(오크·고블린·흡혈귀·천사·엘프·드워프), 무림 생활, 대형 10종.
  python3 tiledata/hand-interior/new/batch10.py   # items.json 에 덧붙인다(같은 id 는 건너뛴다)
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import batch2  # noqa: E402
import batch4  # noqa: E402
import batch9  # noqa: E402,F401  (분류 이름표)

BO = batch4.BO

# (id, 이름, 분류, kind, 폭칸, 발밑칸, 캔버스W, H, 맥락 방, use, 설명, 놓는 곳, 짝, refs, 태그[, 밑그림])
I = [
 # ── 중세 공방·훈련장 ──
 ('candle vat', '양초 녹이는 통', 'medieval', 'floor', 1, 1, 16, 32, 'tailor', ['search'],
  '작은 화로 위 쇠 통(14px 솟음) — 통 안 윗면 5행에 녹은 흰 밀랍, 위 막대에 매단 심지 초 줄 셋.', '양초 공방.', ['shelf:candle'], ['cauldron'], ['중세', '공방']),
 ('stone sink trough', '돌 개수통', 'medieval', 'wall', 2, 1, 32, 32, 'bakery', ['search'],
  '벽에 붙인 긴 돌 개수통(2칸, 14px 솟음) — 통 안 윗면 6행에 물과 씻는 그릇 둘, 벽의 쇠 펌프 손잡이, 남쪽 면 돌 받침.', '중세 부엌.', ['kitchen range'], ['kitchen sink'], ['중세', '부엌']),
 ('herb planter box', '약초 상자', 'medieval', 'floor', 2, 1, 32, 32, 'pharmacy', ['search'],
  '긴 나무 상자 화단(2칸, 12px 솟음) — 흙 윗면 7행에 세 가지 약초 무더기(초록·은빛·보라 꽃), 남쪽 면 판자와 이름 막대.', '약방 창가.', ['herb drying rack'], ['potted fern'], ['중세', '약방']),
 ('cobbler bench', '구두장이 작업대', 'medieval', 'floor', 1, 1, 16, 32, 'tailor', ['search'],
  '낮은 작업대와 붙은 의자(14px 솟음) — 판 윗면 5행에 구두 골·망치·가죽 조각·못 상자, 아래 칸에 장화 하나.', '구둣방.', ['shoe display'], ['work 1x1'], ['중세', '공방']),
 ('tanner frame', '가죽 펼침틀', 'medieval', 'floor', 1, 1, 16, 48, 'stable', ['search'],
  '나무 틀에 끈으로 펼쳐 맨 갈색 짐승 가죽(32px 솟음) — 틀 위 가로대 윗면 1행, 가죽 가장자리 끈 구멍.', '무두질 공방·사냥꾼 집.', ['fur rug'], ['deer trophy'], ['중세', '공방', '사냥']),
 ('great wooden bath', '큰 나무 욕조', 'medieval', 'floor', 2, 2, 32, 48, 'inn', ['search'],
  '쇠테 두른 둥근 큰 나무 욕조(2×2칸, 16px 솟음). 남쪽 위에서 내려다본 3/4: 꼭대기 윗면 26행 — 테두리 고리 안의 김 나는 물(옅은 하늘색, 꽃잎 몇), 걸친 수건. 남쪽 면에 판자와 쇠테 둘.',
  '여관·영주관 목욕방.', ['wash stand pitcher'], ['bathtub'], ['중세', '목욕']),
 ('practice sword rack', '목검 꽂이', 'medieval', 'floor', 1, 1, 16, 32, 'smithy', ['search'],
  '통에 꽂은 목검·나무 방패(16px 솟음) — 통 윗면 3행, 손잡이 끝 셋과 방패 둥근 테.', '훈련장·기사단 숙소.', ['archery target'], ['weapon barrel'], ['중세', '훈련']),
 ('archery target', '과녁', 'medieval', 'floor', 1, 1, 16, 32, 'smithy', ['block'],
  '짚 단을 둥글게 묶은 과녁(16px 솟음), 남쪽을 본다 — 빨강·흰 동심원, 박힌 화살 둘, 뒤 나무 받침 다리.', '훈련장·궁수 길드.', ['practice sword rack'], ['dart board'], ['중세', '훈련']),
 ('quintain', '마상 표적', 'medieval', 'floor', 1, 1, 16, 48, 'stable', ['block'],
  '기둥 위 회전 가로대에 방패와 모래 주머니를 단 표적(32px 솟음) — 가로대 윗면 1행, 방패 문장.', '기사 훈련장.', ['lance rack'], ['armor stand'], ['중세', '기사']),
 ('pottery wheel', '도자기 물레', 'medieval', 'floor', 1, 1, 16, 32, 'tailor', ['search'],
  '나무 틀 위 돌림판(14px 솟음) — 판 윗면 5행에 빚던 흙 항아리, 옆 물 그릇, 아래 발로 차는 큰 바퀴.', '도공 공방.', ['pottery kiln'], ['spinning wheel'], ['중세', '공방']),
 ('pottery kiln', '도자기 가마', 'medieval', 'wall', 2, 1, 32, 48, 'bakery', ['light'],
  '벽돌 돔 가마(2칸, 32px 솟음) — 돔 꼭대기 윗면 3행과 굴뚝, 남쪽 면 둥근 아궁이의 주황 불, 앞에 구운 항아리 둘.', '도공 공방 벽.', ['pottery wheel'], ['bread oven'], ['중세', '공방']),
 ('glass furnace', '유리 가마', 'medieval', 'wall', 1, 1, 16, 48, 'smithy', ['light'],
  '둥근 벽돌 유리 가마(32px 솟음) — 꼭대기 윗면 2행, 남쪽 면 작은 구멍 셋의 흰빛, 앞에 꽂힌 긴 대롱.', '유리 공방.', ['pottery kiln'], ['forge'], ['중세', '공방']),
 ('dye vats', '염색 통', 'medieval', 'floor', 2, 1, 32, 32, 'tailor', ['search'],
  '나란한 나무 통 셋(2칸, 12px 솟음) — 통 안 윗면 5행마다 쪽빛·붉은·노란 물감 물과 걸친 천 끝.', '염색 공방.', ['fabric bolt rack'], ['washing tub'], ['중세', '공방']),
 ('type case shelf', '활자 상자장', 'medieval', 'wall', 2, 1, 32, 32, 'scholar', ['search'],
  '작은 칸이 촘촘한 기운 나무 상자 두 층(2칸, 16px 솟음) — 꼭대기 윗면 3행, 칸마다 회색 활자 점, 옆에 조판 막대.', '인쇄소 벽.', ['printing press'], ['scroll rack'], ['중세', '인쇄소']),
 ('knight bed', '기사 침대', 'medieval', 'floor', 1, 2, 16, 48, 'mead', ['sleep'],
  '튼튼한 나무 침대(1×2칸 남북, 16px 솟음). 남쪽 위에서 내려다본 3/4: 꼭대기 윗면 26행 — 북쪽 흰 베개와 가문 문장 붉은 모포, 머리판 윗면 3행에 걸친 검. 남쪽 면에 발판.',
  '기사단 숙소.', ['arming table'], ['bed red'], ['중세', '기사', '침실']),
 ('small stage platform', '작은 무대 단', 'medieval', 'floor', 2, 2, 32, 32, 'tavern', ['walk'],
  '주점 구석의 낮은 나무 무대(2×2칸, 8px 높이). 남쪽 위에서 내려다본 3/4: 꼭대기 윗면 24행 — 판자 마루 윗면, 뒤 가장자리에 의자 하나와 류트, 그 아래 남쪽 면에 판 두께 3행과 계단 하나.',
  '주점·여관 구석.', ['lute'], ['footlights'], ['중세', '주점']),
 # ── 판타지 종족·장소 ──
 ('enchanting table', '마법 부여대', 'fantasy', 'floor', 2, 1, 32, 32, 'tower', ['search'],
  '검은 돌 작업대(2칸, 14px 솟음) — 상판 윗면 6행에 빛나는 룬 원과 그 위 떠 있는 검 하나, 펼친 책, 보석 접시, 남쪽 면 새긴 무늬.', '마법 공방.', ['spellbook stand'], ['alchemy table'], ['판타지', '마법']),
 ('floating crystal shards', '떠 있는 수정 조각', 'fantasy', 'floor', 1, 1, 16, 48, 'mine', ['light'],
  '돌 받침 위에 떠 있는 하늘빛 수정 조각 셋(32px 솟음) — 조각마다 윗면이 밝고, 아래 빛 원, 받침 윗면 2행.', '유적·수정 동굴.', ['crystal pillar'], ['mana crystal'], ['판타지', '유적']),
 ('living vine wardrobe', '덩굴 옷장', 'fantasy', 'wall', 1, 1, 16, 48, 'elf', ['search'],
  '살아 있는 나무줄기가 감싼 옷장(32px 솟음) — 꼭대기 잎 무더기 윗면 3행, 둥근 문 둘에 나뭇결, 덩굴 손잡이.', '엘프 집 벽.', ['vine chair'], ['wardrobe'], ['엘프', '숲']),
 ('orc war drum', '오크 전쟁북', 'fantasy', 'floor', 1, 1, 16, 32, 'dungeon', ['read'],
  '짐승 가죽 메운 큰 북(16px 솟음) — 북 윗면 6행 가죽에 붉은 손바닥 무늬, 옆 뼈 북채 둘, 몸통 줄 묶음.', '오크 막사.', ['orc bone totem'], ['barrel'], ['판타지', '오크']),
 ('orc bone totem', '뼈 토템', 'fantasy', 'floor', 1, 1, 16, 48, 'dungeon', ['read'],
  '나무 기둥에 짐승 두개골과 뿔, 깃털을 묶은 토템(32px 솟음) — 꼭대기 뿔 두개골 윗면 2행, 붉은 칠 줄무늬.', '오크 막사·야만족 천막.', ['orc war drum'], ['statue'], ['판타지', '오크']),
 ('goblin junk pile', '고블린 고물 더미', 'fantasy', 'floor', 1, 1, 16, 32, 'mine', ['search'],
  '부서진 냄비·톱니·나무 판·녹슨 칼을 쌓은 더미(14px 솟음) — 맨 위 냄비 윗면이 밝고 틈은 어둡다.', '고블린 굴.', [], ['ore pile'], ['판타지', '고블린']),
 ('vampire coffin', '흡혈귀 관', 'fantasy', 'floor', 1, 2, 16, 32, 'chapel', ['open'],
  '검은 칠 관(1×2칸 남북, 10px 높이), 뚜껑이 옆으로 비껴 열렸다. 남쪽 위에서 내려다본 3/4: 꼭대기 윗면 22행 — 붉은 비단 안감이 보이는 빈 속과 비껴 놓인 뚜껑의 은 십자 반대 무늬(박쥐 장식). 남쪽 면에 관 옆판.',
  '흡혈귀 성 지하.', ['skull candelabra'], ['coffin'], ['판타지', '공포']),
 ('angel statue', '천사상', 'fantasy', 'floor', 1, 1, 16, 48, 'chapel', ['read'],
  '날개를 편 흰 대리석 천사상(32px 솟음), 남쪽을 본다 — 날개 윗면이 가장 밝고, 두 손에 든 등불, 받침 윗면 2행.', '대성당·묘지 예배당.', ['goddess statue'], ['statue'], ['판타지', '신전']),
 ('holy sword pedestal', '성검 받침', 'fantasy', 'floor', 1, 1, 16, 48, 'chapel', ['open'],
  '이끼 낀 둥근 바위에 꽂힌 빛나는 검(32px 솟음) — 손잡이 윗면 2행의 금빛, 칼날 둘레 빛 점, 바위 윗면 4행.', '성역·숲속 사당.', ['angel statue'], ['rune stone'], ['판타지', '보물']),
 ('guild trophy wall', '길드 전리품 벽', 'fantasy', 'hang', 2, 0, 32, 16, 'tavern', ['read'],
  '벽 윗줄에 건 몬스터 전리품 셋(2칸) — 용의 뿔, 거대 늑대 머리 가죽, 슬라임 젤 병, 아래 작은 명패.', '모험가 길드 홀 벽 윗줄.', ['quest board'], ['deer trophy'], ['판타지', '길드']),
 ('barrier crystal', '결계 수정', 'fantasy', 'floor', 1, 1, 16, 48, 'throne', ['light'],
  '금 받침 위에 선 길쭉한 흰 수정(32px 솟음) — 꼭대기 끝이 가장 밝고 둘레 둥근 빛 고리, 받침 윗면 2행.', '성·마을 결계실.', ['rune stone'], ['mana crystal'], ['판타지', '마법']),
 ('giant mushroom lamp', '큰 버섯 등', 'fantasy', 'floor', 1, 1, 16, 48, 'elf', ['light'],
  '사람 키만 한 푸른 빛 버섯(32px 솟음) — 갓 윗면 4행에 빛나는 점, 갓 아래로 퍼지는 빛, 흰 자루.', '요정 숲 집·동굴.', ['mushroom table'], ['leaf lantern'], ['판타지', '숲']),
 ('cursed idol', '저주받은 신상', 'fantasy', 'floor', 1, 1, 16, 32, 'dungeon', ['read'],
  '돌 단 위 검은 작은 신상(16px 솟음) — 머리 윗면 2행, 붉게 빛나는 눈 둘, 둘레에 흩어진 공물(동전·뼈).', '던전 제단 방.', ['dark obelisk'], ['statue'], ['판타지', '던전']),
 ('dwarf brewing kettle', '드워프 양조 솥', 'fantasy', 'floor', 1, 1, 16, 48, 'dwarf', ['search'],
  '구리 양조 솥과 위로 솟은 관(32px 솟음) — 둥근 뚜껑 윗면 3행, 몸통 리벳, 관 끝에서 오르는 김.', '드워프 양조장.', ['dwarf ale keg'], ['alembic'], ['드워프', '양조장']),
 # ── 무림 생활 ──
 ('cold jade bed', '한옥상', 'murim', 'floor', 1, 2, 16, 32, 'tower', ['sleep'],
  '푸르스름한 옥으로 깎은 차가운 침상(1×2칸 남북, 10px 높이). 남쪽 위에서 내려다본 3/4: 꼭대기 윗면 22행 — 매끈한 옥 면에 서린 하얀 냉기와 반사, 북쪽 끝 둥근 옥 베개. 남쪽 면에 옥 두께.',
  '수련 동굴·폐관실.', ['meditation'], ['straw bed'], ['무림', '수련']),
 ('stone stele', '비문 석판', 'murim', 'floor', 1, 1, 16, 48, 'mine', ['read'],
  '거북 받침 위의 세운 돌 비석(32px 솟음) — 머리 둥근 꼭대기 윗면 2행, 앞면에 새긴 줄(읽히지 않는 획), 거북 등 윗면 3행.', '동굴·문파 뒷산 실내 유적.', ['stone guardian lion'], ['rune stone'], ['무림', '유적']),
 ('teahouse counter', '찻집 계산대', 'murim', 'floor', 2, 1, 32, 32, 'tavern', ['counter'],
  '나무 계산대(2칸, 16px 솟음) — 상판 윗면 6행에 주판·찻주전자·찻잔 줄·붓, 남쪽 면에 칸살 무늬.', '찻집·객잔 입구.', ['eight immortals table'], ['counter 2x1'], ['무림', '찻집']),
 ('sedan chair', '가마', 'murim', 'floor', 2, 2, 32, 48, 'manor', ['sit'],
  '붉은 비단 휘장 가마(2×2칸, 32px 솟음, 앞뒤 메는 장대). 남쪽 위에서 내려다본 3/4: 꼭대기 윗면 22행(지붕) — 위에서 본 지붕(가운데 금 꼭지, 네 귀퉁이 술)과 동서로 뻗은 장대 둘. 그 아래 남쪽 면에 휘장 창과 나무 몸통.',
  '저택 대문 안·혼례.', ['red lacquer pillar'], ['carriage'], ['무림', '동양', '혼례']),
 ('guqin table', '고금 탁자', 'murim', 'floor', 2, 1, 32, 16, 'scholar', ['read'],
  '낮은 탁자 위에 놓인 긴 고금(2칸, 10px 높이) — 윗면 6행에 검은 칠 몸통과 줄 일곱, 흰 휘 점, 옆에 향로.', '정자·서재.', ['drum stool porcelain'], ['lute'], ['무림', '음악']),
 ('incense coil hang', '선향 고리', 'murim', 'hang', 1, 0, 16, 16, 'chapel', ['light'],
  '천장에서 늘어진 나선 선향(벽면 윗줄) — 둥글게 감긴 향, 끝의 붉은 불씨와 가는 연기, 아래 붉은 종이 표.', '사당 윗줄.', ['bronze ding small'], ['hanging lantern'], ['무림', '사당']),
 ('lotus basin', '연꽃 수반', 'murim', 'floor', 1, 1, 16, 32, 'manor', ['read'],
  '넓은 청자 수반(14px 솟음) — 아가리 윗면 6행 물에 뜬 연잎 둘과 분홍 연꽃 하나, 작은 금붕어.', '정원 회랑·대청 앞.', ['bamboo pot'], ['fish tank'], ['무림', '정원']),
 ('bamboo slip shelf', '죽간 선반', 'murim', 'wall', 1, 1, 16, 32, 'scholar', ['read'],
  '나무 선반(16px 솟음) — 꼭대기 윗면 3행, 칸마다 둘둘 만 죽간 묶음(끈으로 묶음), 맨 아래 칸에 붓통.', '서재·장경각.', ['martial manual shelf'], ['scroll rack'], ['무림', '서재']),
 ('wine gourd hang', '호리병 걸이', 'murim', 'hang', 1, 0, 16, 16, 'tavern', ['search'],
  '벽 못에 끈으로 건 호리병 둘(벽면 윗줄) — 누런 박 몸통, 붉은 마개와 술.', '객잔 벽 윗줄.', ['wine jar stack'], ['hang:flower'], ['무림', '객잔']),
 ('light armor stand murim', '경갑 걸이', 'murim', 'floor', 1, 1, 16, 48, 'throne', ['read'],
  '나무 받침에 건 가죽 미늘 경갑과 두건(32px 솟음) — 어깨 윗면 2행, 검은 미늘 줄과 붉은 끈, 받침 아래 신발.', '표국·문파 숙소.', ['eighteen weapons rack'], ['armor stand'], ['무림']),
 ('dice bowl table', '주사위 그릇 탁자', 'murim', 'floor', 1, 1, 16, 32, 'casino', ['read'],
  '작은 네모 탁자(12px 솟음) — 상판 윗면 7행에 뒤집은 사발과 주사위 셋, 엽전 꾸러미, 상판 모서리 붉은 칠.', '도박장·객잔 구석.', ['eight immortals table'], ['felt 2x2'], ['무림', '도박']),
 # ── 대형 ──
 ('dwarf steam drill', '드워프 증기 굴착기', 'big', 'floor', 3, 2, 48, 64, 'mine', ['block'],
  '바퀴 달린 놋쇠 증기 굴착기(3×2칸, 32px 솟음), 북쪽을 향한다. **남쪽 위에서 내려다본 3/4**: 몸체 꼭대기 윗면 14행(밑그림 y=18~31) — 위에서 본 보일러 등판(리벳·압력계 둘·굴뚝)과 북쪽 끝 원뿔 드릴. 그 아래 남쪽 면 밑그림 y=32~63: 옆판 리벳과 큰 쇠바퀴 둘, 운전석 발판. '
  '굴뚝이 위로 솟고 김이 오른다. 옆모습 금지.',
  '드워프 광산 갱도.', ['mine cart'], ['magitek engine'], ['대형', '드워프', '광산'], BO((18, 31), (32, 63), 0.7)),
 ('great hearth', '대형 벽난로', 'big', 'floor', 3, 1, 48, 64, 'mead', ['light'],
  '돌로 쌓은 커다란 벽난로(3칸, 48px 솟음). 위로 굴뚝 몸체가 칸 위까지 솟고, 선반 돌 윗면 3행에 촛대·은 접시, 가운데 넓은 아궁이의 큰 불과 걸린 솥, 양쪽 돌 기둥.',
  '영주관·성 홀 북쪽 벽 앞.', ['lord high chair'], ['fireplace'], ['대형', '중세', '홀']),
 ('tree of life indoor', '생명의 나무', 'big', 'floor', 3, 2, 48, 64, 'elf', ['light'],
  '둥근 돌 화단에서 자란 빛나는 작은 나무(3×2칸, 32px 솟음). **남쪽 위에서 내려다본 3/4**: 화단 꼭대기 윗면 14행(밑그림 y=36~49) — 돌 테두리 고리 안 이끼와 뿌리. 그 아래 남쪽 면 밑그림 y=50~63: 화단 돌 옆면. '
  '화단 위로 흰 줄기와 둥근 금빛 잎 수관이 솟는다(수관 윗면이 가장 밝고 떨어지는 빛 점). 옆모습 금지.',
  '엘프 신전 가운데.', ['glowing flower pot'], ['white tree'], ['대형', '엘프', '신전'], BO((36, 49), (50, 63), 0.7)),
 ('king sarcophagus', '왕의 석관', 'big', 'floor', 2, 3, 32, 64, 'chapel', ['open'],
  '조각한 왕의 누운 모습이 뚜껑인 큰 석관(2×3칸 남북, 16px 솟음). **남쪽 위에서 내려다본 3/4**: 꼭대기 윗면 36행(밑그림 y=8~43) — 위에서 본 뚜껑의 누운 왕(왕관·모은 두 손·검), 둘레 테. 그 아래 남쪽 면 밑그림 y=44~63: 석관 앞면의 문장 새김과 받침. 옆모습 금지.',
  '왕릉·지하묘지 안쪽.', ['sarcophagus'], ['sarcophagus'], ['대형', '지하묘지', '성'], BO((8, 43), (44, 63), 0.85)),
 ('grand fountain', '대형 분수', 'big', 'floor', 3, 2, 48, 48, 'manor', ['search'],
  '둥근 돌 수반과 가운데 두 단 분수(3×2칸, 16px 솟음). **남쪽 위에서 내려다본 3/4**: 꼭대기 윗면 20행(밑그림 y=4~23) — 수반 테두리 고리 안 물 면(동심 물결, 금화 몇)과 가운데 기둥 위 작은 접시에서 떨어지는 물줄기. '
  '그 아래 남쪽 면 밑그림 y=24~47: 수반 돌 옆면 무늬. 옆모습 금지.',
  '저택·궁전 홀 가운데.', ['tall vase blue'], ['indoor fountain'], ['대형', '저택', '궁전'], BO((4, 23), (24, 47), 0.75)),
 ('pagoda shrine', '탑 감실', 'big', 'floor', 3, 2, 48, 64, 'throne', ['read'],
  '돌 기단 위 세 층 처마의 작은 나무 탑 감실(3×2칸, 32px 솟음). **남쪽 위에서 내려다본 3/4**: 기단 꼭대기 윗면 12행(밑그림 y=40~51) — 위에서 본 돌 기단 윗면과 계단 끝. 그 아래 남쪽 면 밑그림 y=52~63: 기단 앞면. '
  '기단 위로 층마다 붉은 기둥과 초록 기와 처마(처마 윗면이 밝다), 꼭대기 금 상륜. 옆모습 금지.',
  '절·문파 사당 안쪽.', ['bronze ding small'], ['reredos'], ['대형', '무림', '절'], BO((40, 51), (52, 63), 0.75)),
 ('giant seated statue', '거대 좌상', 'big', 'floor', 3, 2, 48, 64, 'throne', ['read'],
  '연꽃 받침 위 가부좌한 거대한 돌 수도자 상(3×2칸, 32px 솟음), 남쪽을 본다. **남쪽 위에서 내려다본 3/4**: 받침 꼭대기 윗면 12행(밑그림 y=40~51) — 위에서 본 연꽃잎 받침 윗면과 무릎. 그 아래 남쪽 면 밑그림 y=52~63: 받침 꽃잎 옆면. '
  '받침 위로 몸과 머리(정수리 윗면이 밝다, 감은 눈, 모은 손). 옆모습 금지.',
  '절·무림 성지 대전.', ['bronze ding small', 'great tripod cauldron'], ['statue'], ['대형', '무림', '절'], BO((40, 51), (52, 63), 0.7)),
 ('round library shelf', '원형 대서가', 'big', 'floor', 3, 2, 48, 64, 'tower', ['read'],
  '둥근 기둥 모양 큰 서가(3×2칸, 32px 솟음). **남쪽 위에서 내려다본 3/4**: 꼭대기 윗면 14행(밑그림 y=4~17) — 위에서 본 둥근 위판(금 테, 가운데 떠 있는 책 하나). 그 아래 남쪽 면 밑그림 y=18~63: 둥글게 휜 칸마다 꽂힌 색 책 등 다섯 층과 기댄 사다리. 옆모습 금지.',
  '대도서관·마법사 탑 가운데.', ['bookshelf 3w', 'library ladder'], ['bookshelf 3w'], ['대형', '판타지', '도서관'], BO((4, 17), (18, 63), 0.8)),
 ('great war drum', '대형 전고', 'big', 'floor', 3, 2, 48, 48, 'throne', ['read'],
  '나무 받침에 세워 건 거대한 붉은 북(3×2칸, 16px 솟음). **남쪽 위에서 내려다본 3/4**: 받침 꼭대기 윗면 18행(밑그림 y=6~23) — 위에서 본 받침 틀 가로대와 북 몸통 윗면(붉은 칠, 금 못 줄). '
  '그 아래 남쪽 면 밑그림 y=24~47: 남쪽을 보는 둥근 북면(흰 가죽에 태극 무늬)과 받침 다리, 걸린 북채 둘. 옆모습 금지.',
  '성·문파 대문 안쪽.', ['sect plaque'], ['barrel'], ['대형', '무림', '성'], BO((6, 23), (24, 47), 0.7)),
]
assert len({x[0] for x in I}) == len(I), '같은 id 가 둘'

if __name__ == '__main__':
    import common
    for row in I:
        o = dict(id=row[0], kind=row[3], footprint=dict(w=row[4], h=row[5]), description=row[10], image=dict(w=row[6], h=row[7]), **(row[15] if len(row) > 15 else {}))
        errs = common.spec_top_lint(o)
        if errs: raise SystemExit('\n'.join(errs))
    print('항목', len(I))
    batch2.I = I
    batch2.main()
