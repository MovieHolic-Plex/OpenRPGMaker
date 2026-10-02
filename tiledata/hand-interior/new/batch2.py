#!/usr/bin/env python3
"""새 기물 2차(2026-10-01, 사용자 「전체 데이터베이스에서 필요한 것들로 100개쯤」) — items.json 에 덧붙인다(같은 id 는 건너뛴다).
근거: 예제 방 48종·건물 25종에 없는 JRPG 실내(여관 접수·무기점·성 장식·모험가 길드·마왕성·비공정)와
장르 묶음 6개(adventure-jrpg·monster-collect·horror-chase·farm-life·story-cutscene·action-rpg)가 쓰는 실내 물건.
설명은 그림 명세다 — 넓적한 물건은 전체 높이와 윗면 행 수를 적는다(큰 보물상자 h14 교훈).
  python3 tiledata/hand-interior/new/batch2.py   # items.json 갱신
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'scripts', 'content', 'hand-interior-pick'))

CAT = {'inn': '여관', 'smith': '대장간', 'castle': '성', 'guild': '모험가 길드', 'tower': '마법사의 탑', 'study': '서재',
       'demon': '마왕성', 'gimmick': 'JRPG 장치', 'home': '가구·살림', 'ship': '배 선실', 'monster': '몬스터 센터',
       'horror': '폐가', 'farm': '농가', 'story': '추억', 'shop': '상점', 'crypt': '지하묘지'}

# (id, 이름, 분류, kind, 폭칸, 발밑칸, 캔버스W, H, 맥락 방, use, 설명, 놓는 곳, 짝, refs, 태그)
I = [
 # ── 둘째 상태(고른 그림에서 출발) ── base 는 「후보@기물」
 ('treasure chest open', '열린 보물상자', 'gimmick', 'floor', 1, 1, 16, 16, 'dungeon', ['open'],
  '열린 보물상자 — 닫힌 보물상자(h13-D)와 같은 상자, 뚜껑이 뒤로 젖혀져 위에 서 있고 안의 어두운 속(빈 바닥)이 위에서 보인다. 높이·폭은 닫힌 것과 같다.',
  '닫힌 보물상자 자리 그대로(이벤트 2쪽 그림).', ['treasure chest'], ['chest'], ['던전', '보물고'], dict(base='h13-D@treasure chest', states=('treasure chest', '열림', {'닫힘': 'treasure chest'}))),
 ('treasure chest big open', '열린 큰 보물상자', 'gimmick', 'floor', 2, 1, 32, 32, 'throne', ['open'],
  '열린 큰 보물상자(2칸) — 닫힌 큰 보물상자(h24-D)와 같은 상자, 둥근 뚜껑이 뒤로 젖혀져 섰고 안쪽 붉은 천 바닥이 위에서 보인다(속 6~8행). 높이·폭은 닫힌 것과 같다.',
  '닫힌 큰 보물상자 자리 그대로.', ['treasure chest big'], ['royal chest'], ['보스 방', '보물고'], dict(base='h24-D@treasure chest big', states=('treasure chest big', '열림', {'닫힘': 'treasure chest big'}))),
 ('wall lever on', '벽 레버(켬)', 'gimmick', 'hang', 1, 0, 16, 16, 'dungeon', ['switch'],
  '벽 레버(켬) — 꺼진 벽 레버(h17-A)와 같은 쇠판·축, 손잡이만 위로 올라갔다. 축 옆에 작은 초록 불빛 한 점.',
  '꺼진 레버 자리 그대로.', ['wall lever'], ['wall lever'], ['던전', '퍼즐'], dict(base='h17-A@wall lever', states=('wall lever', '켬', {'끔': 'wall lever'}))),
 ('pressure plate down', '눌린 압력판', 'gimmick', 'flat', 1, 1, 16, 16, 'dungeon', ['switch'],
  '눌린 압력판 — 압력판(h18-B)과 같은 돌판이 바닥 높이로 가라앉아 둘레 홈이 어둡게 넓어졌다. 판 위 밝은 테두리가 사라진다.',
  '압력판 자리 그대로.', ['pressure plate'], ['pressure plate'], ['던전', '퍼즐'], dict(base='h18-B@pressure plate', states=('pressure plate', '눌림', {'올라옴': 'pressure plate'}))),
 ('iron gate open', '열린 쇠창살 문', 'gimmick', 'floor', 1, 1, 16, 32, 'dungeon', ['gate'],
  '열린 쇠창살 문 — 쇠창살 문(h20-A)이 위로 올라가 칸 위쪽 문틀 속에 걸렸다. 아래 바닥 칸은 비어 지나갈 수 있고 창살 끝만 위에 보인다.',
  '쇠창살 문 자리 그대로(열린 뒤 통행 가능).', ['iron gate'], ['iron gate'], ['던전', '감옥'], dict(base='h20-A@iron gate', states=('iron gate', '열림', {'닫힘': 'iron gate'}))),
 ('spike trap down', '숨은 가시 함정', 'gimmick', 'flat', 1, 1, 16, 16, 'dungeon', ['trap'],
  '숨은 가시 함정 — 가시 함정(h21-B)의 구멍 뚫린 쇠판만 보이고 가시는 구멍 속으로 들어갔다(구멍마다 어두운 점).',
  '가시 함정 자리 그대로.', ['spike trap'], ['spike trap'], ['던전', '함정'], dict(base='h21-B@spike trap', states=('spike trap', '숨음', {'솟음': 'spike trap'}))),
 ('coffin open', '열린 관', 'crypt', 'floor', 1, 2, 16, 32, 'chapel', ['open'],
  '열린 관(남북 1×2) — 관(w103-A)과 같은 관, 뚜껑이 비스듬히 옆으로 밀려 안의 붉은 천과 빈 속이 위에서 보인다. 높이·폭은 닫힌 관과 같다.',
  '관 자리 그대로.', ['coffin'], ['coffin'], ['지하묘지', '예배당'], dict(base='w103-A@coffin', states=('coffin', '열림', {'닫힘': 'coffin'}))),
 # ── 여관 ──
 ('inn reception', '여관 접수대', 'inn', 'floor', 2, 1, 32, 32, 'inn', ['counter'],
  '여관 접수대(2칸) — 짙은 나무 카운터 상판(윗면 6행)에 펼친 숙박부와 놋쇠 종, 앞판에 판자 무늬. 전체 높이 24~26px. 주인은 북쪽 뒤에 선다.',
  '여관 1층 현관 맞은편. 뒤 북쪽 벽에 열쇠판.', ['room key board', 'inn sign'], ['counter 2x1'], ['여관', '현관']),
 ('room key board', '객실 열쇠판', 'inn', 'hang', 2, 0, 32, 16, 'inn', ['block'],
  '객실 열쇠판(벽면 윗줄 2칸) — 나무 판에 놋쇠 열쇠 다섯 개가 고리에 걸리고 밑에 번호 패.', '여관 접수대 뒤 북쪽 벽.', ['inn reception'], ['tool wall'], ['여관']),
 ('bunk bed', '2층 침대', 'inn', 'wall', 2, 1, 32, 48, 'inn', ['sleep'],
  '나무 2층 침대(가로 2×1, 32px 솟음) — 긴 쪽을 북쪽 벽에 붙여 가로로 놓는다: 머리판은 서쪽, 발치판은 동쪽, 동쪽 끝에 사다리. 아래 침상과 위 침상에 흰 이불, 두 이불의 윗면이 각각 위에서 보인다(위 침상 윗면 3행 이상).', '여관 싼 객실·병영·선원 숙소 북쪽 벽.', ['luggage trunk'], ['bed blue', 'prison cot'], ['여관', '병영', '배']),
 ('menu board', '메뉴판', 'inn', 'hang', 1, 0, 16, 16, 'tavern', ['read'],
  '분필로 쓴 작은 메뉴판(벽면 윗줄) — 검은 판에 흰 글 줄과 그림(잔·빵).', '선술집·여관 바 뒤 벽.', ['counter 4x1'], ['notice board'], ['선술집', '여관']),
 ('luggage trunk', '여행 가방', 'inn', 'floor', 1, 1, 16, 16, 'inn', ['search'],
  '가죽 띠 두른 여행 트렁크 — 납작하고 넓다(높이 11~12px), 뚜껑 윗면 4행이 위에서 보이고 앞에 쇠 장식.', '객실 침대 발치.', ['bunk bed'], ['chest'], ['여관', '객실']),
 ('inn sign', '여관 간판(실내)', 'inn', 'hang', 2, 0, 32, 16, 'inn', ['read'],
  '실내 벽에 건 나무 간판(2칸) — 침대와 별 그림, 쇠사슬로 매달림.', '여관 홀 북쪽 벽 윗줄.', ['inn reception'], ['tapestry'], ['여관']),
 # ── 무기·방어구점 ──
 ('leather armor stand', '가죽 갑옷 거치대', 'smith', 'floor', 1, 1, 16, 32, 'smithy', ['block'],
  '나무 십자 거치대에 건 갈색 가죽 갑옷(16px 솟음) — 어깨 윗면·받침 윗면이 위에서 보인다.', '방어구점 바닥, 카운터 옆 줄로.', ['helmet shelf'], ['armor stand', 'mannequin'], ['방어구점', '대장간']),
 ('helmet shelf', '투구 진열 선반', 'smith', 'wall', 2, 1, 32, 32, 'tailor', ['search'],
  '투구 세 개(쇠·뿔 달린·깃 장식)를 얹은 2단 나무 선반(2칸) — 꼭대기 윗판 윗면 3~4행, 선반판마다 윗면 2~3행 + 앞 모서리, 투구 정수리가 위에서 보인다. 전체 높이 28~30px.', '방어구점 북쪽 벽.', ['leather armor stand'], ['sideboard 2x1', 'shield wall'], ['방어구점']),
 ('arrow barrel', '화살 통', 'smith', 'floor', 1, 1, 16, 32, 'smithy', ['search'],
  '깃이 위로 삐죽 꽂힌 화살 다발이 든 나무 통(16px 솟음) — 통 입구 타원 윗면이 보인다.', '무기점 바닥, 활 걸이 아래.', ['bow rack'], ['weapon barrel'], ['무기점']),
 ('staff rack', '지팡이 걸이', 'smith', 'wall', 1, 1, 16, 32, 'tower', ['block'],
  '마법 지팡이 세 개(보석 머리)가 꽂힌 나무 걸이(16px 솟음).', '마법 상점·탑 북쪽 벽.', ['wand stand'], ['spear rack'], ['마법 상점', '마법사의 탑']),
 ('weapon crate', '무기 상자', 'smith', 'floor', 1, 1, 16, 16, 'smithy', ['search'],
  '뚜껑이 반쯤 열린 나무 상자에 칼자루·도끼 손잡이가 보인다 — 입구 윗면 5~6행.', '무기점·무기고 구석.', ['weapon barrel'], ['crate'], ['무기점', '무기고']),
 ('axe mace wall', '도끼·철퇴 벽걸이', 'smith', 'hang', 2, 0, 32, 16, 'smithy', ['block'],
  '벽에 건 전투 도끼 하나와 철퇴 하나(2칸), 나무 걸쇠.', '무기점 벽 윗줄.', ['sword rack'], ['tool wall', 'shield wall'], ['무기점']),
 ('accessory case', '장신구 진열장', 'shop', 'floor', 1, 1, 16, 32, 'pharmacy', ['search'],
  '유리 덮개 진열장(16px 솟음) — 유리 윗면 너머로 반지·목걸이·부적이 위에서 보인다(윗면 7~8행), 나무 다리.', '잡화점·보석상 카운터 옆.', ['item shop shelf'], ['cake display case', 'cabinet:gem+gemr'], ['상점', '보석상']),
 ('item shop shelf', '잡화점 진열 선반', 'shop', 'wall', 2, 1, 32, 32, 'pharmacy', ['search'],
  '물약 병·약초 묶음·밧줄·횃불을 섞어 얹은 2단 선반(2칸) — 꼭대기 윗판 윗면 3~4행, 선반판마다 윗면 2~3행 + 앞 모서리, 병 입구·묶음 윗면이 위에서 보인다. 전체 높이 28~30px.', 'JRPG 도구점 북쪽 벽.', ['accessory case', 'counter 3x1'], ['shelf:potion+potionb+potiong'], ['도구점', '상점']),
 # ── 성 ──
 ('knight armor', '기사 갑옷 장식', 'castle', 'floor', 1, 1, 16, 48, 'throne', ['block'],
  '창을 세워 든 판금 기사 갑옷(32px 솟음) — 투구 윗면·어깨 윗면, 받침 돌판 윗면 2행.', '성 복도·알현실 양옆에 한 쌍.', ['heraldic shield'], ['statue', 'armor stand'], ['성', '알현실', '복도']),
 ('crown pedestal', '왕관 받침', 'castle', 'floor', 1, 1, 16, 32, 'throne', ['key'],
  '돌 받침대 위 붉은 방석에 금관(16px 솟음) — 방석 윗면과 왕관 둥근 테가 위에서 보인다.', '보물고·왕의 방 가운데.', ['royal chest'], ['spellbook stand'], ['성', '보물고']),
 ('heraldic shield', '문장 방패', 'castle', 'hang', 1, 0, 16, 16, 'throne', ['block'],
  '벽에 건 문장 방패 — 파랑·금 사분 문장에 사자 무늬.', '성 홀 벽 윗줄, 깃발 사이.', ['knight armor'], ['shield'], ['성']),
 ('war map table', '작전 지도 탁자', 'castle', 'floor', 2, 2, 32, 32, 'throne', ['read'],
  '작전 지도 탁자(2×2) — 넓은 상판(윗면 14~16행)에 펼친 지도와 말 조각·단검, 짧은 다리.', '근위대 방·왕의 서재 가운데.', ['knight armor'], ['desk 2x2', 'wall map'], ['성', '근위대']),
 ('crossed swords', '교차한 검 장식', 'castle', 'hang', 2, 0, 32, 16, 'mead', ['block'],
  '방패 뒤로 X 자로 교차한 두 검(2칸).', '알현실·연회장 벽 윗줄.', ['heraldic shield'], ['shield wall'], ['성', '연회장']),
 ('marble bust', '대리석 흉상', 'castle', 'floor', 1, 1, 16, 32, 'manor', ['read'],
  '네모 대리석 받침 위 흰 흉상(16px 솟음) — 받침 윗면 2~3행.', '복도·서재·홀 구석.', ['knight armor'], ['statue', 'column marble'], ['성', '저택']),
 ('indoor fountain', '실내 분수', 'castle', 'floor', 2, 2, 32, 48, 'throne', ['heal'],
  '둥근 돌 분수(2×2, 16px 솟음) — 넓은 물그릇 윗면(물 표면 12~14행)과 가운데 기둥에서 떨어지는 물줄기.', '성 홀·궁정 정원 방 가운데.', ['marble bust'], ['moon pool', 'healing spring'], ['성', '궁정']),
 ('gilded wardrobe', '금장 옷장', 'castle', 'wall', 2, 1, 32, 48, 'throne', ['search'],
  '흰 칠에 금 장식 두 문 옷장(2칸, 32px 솟음) — 윗면 처마 4~5행.', '왕·왕비 침소 북쪽 벽.', ['canopy bed'], ['wardrobe'], ['성', '침소']),
 # ── 모험가 길드 ──
 ('quest board', '의뢰 게시판', 'guild', 'hang', 2, 0, 32, 16, 'tavern', ['read'],
  '쪽지가 빼곡히 꽂힌 나무 게시판(2칸) — 종이마다 붉은 핀·글 줄.', '길드 홀 북쪽 벽 윗줄. 앞에 서서 조사.', ['guild counter', 'wanted poster'], ['notice board'], ['모험가 길드', '선술집']),
 ('wanted poster', '현상수배 벽보', 'guild', 'hang', 1, 0, 16, 16, 'zozo', ['read'],
  '얼굴 그림과 금화 표시가 있는 누런 수배지.', '길드·초소·뒷골목 벽.', ['quest board'], ['notice board'], ['모험가 길드', '초소']),
 ('guild counter', '길드 접수 창구', 'guild', 'floor', 3, 1, 48, 32, 'tavern', ['counter'],
  '길드 접수 창구(3칸) — 나무 카운터 상판(윗면 6행)에 서류 더미·잉크병·도장, 가운데 낮은 칸막이. 전체 높이 24~26px.', '길드 홀 북쪽. 뒤 벽에 의뢰 게시판.', ['quest board'], ['counter 3x1'], ['모험가 길드']),
 ('monster trophy', '몬스터 머리 박제', 'guild', 'hang', 2, 0, 32, 16, 'tavern', ['block'],
  '방패꼴 판에 단 뿔 달린 초록 용 머리 박제(2칸).', '길드 홀 벽 윗줄 가운데.', ['quest board'], ['deer trophy'], ['모험가 길드', '선술집']),
 ('loot sacks', '전리품 자루', 'guild', 'floor', 1, 1, 16, 16, 'tavern', ['search'],
  '불룩한 자루 둘과 금화가 삐져나온 작은 자루 — 묶은 입구가 위에서 보인다.', '길드 창고·도적 소굴 구석.', ['guild lockers'], ['sack', 'coin pile'], ['모험가 길드', '도적 소굴']),
 ('guild lockers', '개인 보관함', 'guild', 'wall', 2, 1, 32, 32, 'tavern', ['search'],
  '번호 붙은 나무 칸 여섯 개 보관함(2칸) — 윗면 처마 3~4행, 칸마다 쇠 손잡이. 전체 높이 28~30px.', '길드 창고 북쪽 벽.', ['loot sacks'], ['apothecary drawers', 'cupboard'], ['모험가 길드']),
 ('map rolls', '지도 두루마리 통', 'guild', 'floor', 1, 1, 16, 32, 'scholar', ['read'],
  '말린 지도 여러 개가 꽂힌 나무 통(16px 솟음) — 통 입구 타원과 두루마리 끝이 위에서 보인다.', '길드·서재·선장실 구석.', ['war map table'], ['scroll rack', 'weapon barrel'], ['모험가 길드', '서재']),
 # ── 마법사의 탑·연금술 ──
 ('alchemy table', '연금술 실험대', 'tower', 'floor', 2, 1, 32, 32, 'tower', ['search'],
  '연금술 실험대(2칸) — 나무 상판(윗면 8행)에 불 켠 버너·둥근 플라스크·관, 아래 서랍. 전체 높이 26~28px.', '연금술 방 가운데·벽 앞.', ['specimen shelf'], ['work 2x1', 'alembic'], ['연금술 방', '마법사의 탑']),
 ('specimen shelf', '표본 병 선반', 'tower', 'wall', 1, 1, 16, 32, 'tower', ['search'],
  '눈알·뿔·버섯이 든 유리 병을 늘어놓은 좁은 선반(16px 솟음) — 꼭대기 윗판 윗면 3행, 선반판 윗면 2~3행, 병 입구(뚜껑)가 위에서 보인다.', '연금술 방·약국 안방 벽.', ['alchemy table'], ['shelf:vial+flask'], ['연금술 방', '마법사의 탑']),
 ('mana crystal', '마나 결정', 'tower', 'floor', 1, 1, 16, 32, 'tower', ['light'],
  '바닥에서 솟은 하늘색 결정 덩이(16px 솟음) — 결정 면마다 밝은 윗면, 둘레에 빛 점.', '탑·동굴 신전 바닥.', ['save crystal'], ['ore pile', 'rune stone'], ['마법사의 탑', '동굴']),
 ('floating book', '떠 있는 마법책', 'tower', 'floor', 1, 1, 16, 32, 'tower', ['read'],
  '펼친 채 공중에 뜬 마법책과 그 아래 바닥의 둥근 빛 그림자 — 책장 두 쪽이 위에서 보인다.', '서재·탑 꼭대기.', ['spellbook stand'], ['spellbook stand'], ['마법사의 탑', '서고']),
 ('summoning circle', '소환진', 'tower', 'flat', 3, 3, 48, 48, 'tower', ['walk'],
  '바닥에 그린 붉은 오망성 소환진(3×3, 밟을 수 있음) — 원 둘레에 룬 글자, 꼭짓점마다 초.', '탑·마왕성 의식실 한가운데.', ['dark altar'], ['magic circle'], ['마법사의 탑', '마왕성']),
 ('magic mirror', '마법 거울', 'tower', 'wall', 1, 1, 16, 48, 'tower', ['read'],
  '은테 두른 키 큰 거울(32px 솟음) — 거울 면에 보랏빛 소용돌이.', '탑·저택 침실 북쪽 벽.', ['floating book'], ['tailor mirror'], ['마법사의 탑', '저택']),
 ('wand stand', '지팡이 받침', 'tower', 'floor', 1, 1, 16, 32, 'tower', ['key'],
  '작은 돌 받침에 꽂힌 빛나는 마법 지팡이 하나(16px 솟음) — 받침 윗면 2~3행.', '탑 꼭대기·보물고.', ['staff rack'], ['key pedestal'], ['마법사의 탑']),
 # ── 서고 ──
 ('book pile', '쌓인 책 더미', 'study', 'floor', 1, 1, 16, 16, 'scholar', ['read'],
  '색색 책 다섯 권이 비뚤게 쌓인 더미 — 맨 위 책 표지 윗면이 보인다.', '서고 바닥·책상 옆.', ['bookshelf 1w'], ['shelf:book+bookb+bookg'], ['서고', '서재']),
 ('chained bookcase', '금서 책장', 'study', 'wall', 1, 1, 16, 48, 'scholar', ['search'],
  '쇠사슬을 X 로 두르고 자물쇠 채운 검은 책장(32px 솟음) — 윗면 처마 3~4행.', '서고 깊은 곳·마법사의 탑.', ['book pile'], ['bookshelf 1w'], ['서고', '마법사의 탑']),
 ('scroll pile', '두루마리 더미', 'study', 'floor', 1, 1, 16, 16, 'scholar', ['read'],
  '끈 묶은 양피지 두루마리 여러 개가 쌓인 더미 — 두루마리 끝 동그라미가 보인다.', '필사실·서고 바닥.', ['book pile'], ['scroll rack'], ['서고', '필사실']),
 ('catalog drawers', '목록 서랍장', 'study', 'wall', 1, 1, 16, 32, 'scholar', ['search'],
  '작은 서랍 아홉 칸 목록함(16px 솟음) — 윗면 3행, 서랍마다 놋쇠 이름표.', '서고 입구 벽.', ['chained bookcase'], ['apothecary drawers'], ['서고']),
 # ── 마왕성 ──
 ('demon throne', '마왕 옥좌', 'demon', 'floor', 2, 2, 32, 48, 'throne', ['sit'],
  '검은 돌 마왕 옥좌(2×2, 16px 솟음) — 뿔 달린 높은 등받이, 팔걸이에 해골, 붉은 방석 윗면이 위에서 보인다.', '마왕성 알현실 북쪽 단 위 가운데.', ['demon statue', 'lava brazier'], ['stone throne', 'throne'], ['마왕성']),
 ('bone pillar', '뼈 기둥', 'demon', 'floor', 1, 1, 16, 48, 'dungeon', ['block'],
  '뼈와 해골을 쌓아 묶은 기둥(32px 솟음) — 머리에 해골 둘레 윗면.', '마왕성·사교 신전 통로 양옆.', ['demon throne'], ['column stone', 'skull pile'], ['마왕성', '지하묘지']),
 ('lava brazier', '용암 화로', 'demon', 'floor', 1, 1, 16, 32, 'dungeon', ['light'],
  '검은 쇠 화로에 끓는 주황 용암(16px 솟음) — 화로 입구의 용암 윗면이 위에서 보인다.', '마왕성 홀 양옆·화산 신전.', ['demon throne'], ['brazier'], ['마왕성', '화산']),
 ('demon statue', '마족 석상', 'demon', 'floor', 1, 1, 16, 48, 'throne', ['block'],
  '날개 접은 뿔 달린 마족 석상(32px 솟음) — 받침 윗면 2행, 눈에 붉은 점.', '마왕성 입구·복도 양옆.', ['bone pillar'], ['statue'], ['마왕성']),
 ('cursed mirror', '저주받은 거울', 'demon', 'wall', 1, 1, 16, 48, 'manor', ['read'],
  '금 간 검은 테 거울(32px 솟음) — 거울 면에 금이 가고 붉은 눈 하나가 비친다.', '마왕성·폐가 침실 벽.', ['torn portrait'], ['tailor mirror'], ['마왕성', '폐가']),
 ('dark altar', '검은 제단', 'demon', 'floor', 2, 1, 32, 32, 'chapel', ['search'],
  '검은 돌 제단(2칸) — 윗면 8행에 보라 불꽃 촛대 둘과 해골 잔, 앞면에 붉은 문양. 전체 높이 24~26px.', '사교 신전·마왕성 의식실 북쪽.', ['summoning circle'], ['altar'], ['마왕성', '사교 신전']),
 ('hanging cage', '쇠 우리', 'demon', 'floor', 1, 1, 16, 48, 'dungeon', ['open'],
  '천장 사슬에 매달린 둥근 쇠 우리(32px 솟음) — 바닥에 그림자, 우리 바닥판 윗면이 보인다.', '마왕성 감옥·괴물 둥지.', ['shackles'], ['birdcage'], ['마왕성', '감옥']),
 ('dark orb pedestal', '어둠 구슬 받침', 'demon', 'floor', 1, 1, 16, 32, 'throne', ['seal'],
  '돌 받침 위 검보라 구슬(16px 솟음) — 구슬 둘레 보랏빛, 받침 윗면 2~3행.', '마왕성 봉인실 가운데.', ['seal stone'], ['crystal ball', 'key pedestal'], ['마왕성', '봉인실']),
 # ── JRPG 장치 ──
 ('teleport pad', '순간이동 진', 'gimmick', 'flat', 2, 2, 32, 32, 'tower', ['travel'],
  '바닥의 둥근 푸른 빛 원판(2×2, 밟을 수 있음) — 가운데 별 무늬, 둘레 돌 테.', '던전·탑의 층 사이 이동.', ['save crystal'], ['magic circle'], ['던전', '마법사의 탑']),
 ('crystal switch', '수정 스위치', 'gimmick', 'floor', 1, 1, 16, 32, 'dungeon', ['switch'],
  '돌 받침 위 둥근 파란 수정 구슬(16px 솟음) — 때리면 색이 바뀐다. 받침 윗면 2~3행.', '던전 퍼즐 방.', ['iron gate'], ['crystal ball'], ['던전', '퍼즐']),
 ('locked door', '잠긴 나무 문', 'gimmick', 'floor', 1, 1, 16, 32, 'dungeon', ['gate'],
  '쇠띠와 큰 자물쇠를 채운 나무 문(16px 솟음) — 문 위 돌 문틀 윗면 2행.', '던전·성 통로 칸. 열쇠로 연다.', ['key pedestal'], ['iron gate'], ['던전', '성']),
 ('mimic', '미믹', 'gimmick', 'floor', 1, 1, 16, 16, 'dungeon', ['trap'],
  '보물상자 꼴 괴물 — 열린 보물상자(h26-D)와 같은 상자·크기·색. 뚜껑은 뒤로 벌어져 위에 서고(뚜껑 안쪽 면이 보임), 상자 입구가 위에서 보여 그 속이 어두운 입이다: 입구 둘레를 따라 위·아래 이빨, 속에서 혀가 앞판 위로 늘어진다. 상자 앞판(남쪽 면)과 쇠테는 열린 보물상자 그대로. 이빨은 입구 테두리 위(윗면)에 박힌다 — 앞면에 이빨 띠를 그리지 않는다.', '보물상자 사이 함정.', ['treasure chest'], ['treasure chest open', 'treasure chest'], ['던전', '함정']),
 ('cracked wall', '금 간 벽', 'gimmick', 'hang', 1, 0, 16, 16, 'mine', ['gate'],
  '벽면 윗줄의 큰 금 — 돌이 금 가 부서질 듯하다(폭탄으로 뚫는 벽).', '던전·광산 벽면.', ['push boulder'], ['ore vein'], ['던전', '광산']),
 ('hint tablet', '힌트 석판', 'gimmick', 'floor', 1, 1, 16, 32, 'dungeon', ['read'],
  '글자가 새겨진 비스듬한 돌 석판(16px 솟음) — 윗면 기운 판에 글 줄이 보인다.', '퍼즐 방 입구.', ['seal stone'], ['rune stone'], ['던전', '유적']),
 ('pitfall', '구멍 함정', 'gimmick', 'flat', 1, 1, 16, 16, 'dungeon', ['trap', 'travel'],
  '바닥에 뚫린 깊은 검은 구멍 — 가장자리 돌이 부서져 있다. 빠지면 아래층.', '던전 바닥.', ['spike trap'], ['drain grate'], ['던전', '함정']),
 ('arrow floor', '화살표 바닥', 'gimmick', 'flat', 1, 1, 16, 16, 'dungeon', ['trap'],
  '화살표가 새겨진 밀어내는 바닥 판 — 밝은 파란 화살표(북쪽).', '던전 퍼즐 통로.', ['pressure plate'], ['pressure plate'], ['던전', '퍼즐']),
 ('hot spring', '온천탕', 'gimmick', 'floor', 3, 2, 48, 32, 'elf', ['heal'],
  '돌로 두른 온천탕(3×2) — 김 오르는 하늘색 물 표면(윗면 20행 이상), 둘레 바위 윗면.', '여관 목욕탕·산 마을.', ['healing spring'], ['moon pool', 'bathtub'], ['여관', '온천']),
 # ── 민가 ──
 ('wooden toilet', '나무 변기', 'home', 'floor', 1, 1, 16, 16, 'manor', ['block'],
  '뚜껑 달린 나무 변기 의자 — 둥근 뚜껑 윗면 5~6행.', '욕실·뒷방 구석.', ['washbasin'], ['stool'], ['욕실', '민가']),
 ('toy box', '장난감 상자', 'home', 'floor', 1, 1, 16, 16, 'manor', ['search'],
  '뚜껑 열린 색칠 상자에 공·인형·나무칼 — 입구 윗면 5~6행.', '아이 방 구석.', ['rocking horse'], ['chest'], ['아이 방', '민가']),
 ('rocking horse', '흔들 목마', 'home', 'floor', 1, 1, 16, 32, 'manor', ['block'],
  '흰 칠 나무 흔들 목마(16px 솟음) — 등 안장 윗면이 보이고 아래 휜 받침.', '아이 방.', ['toy box'], ['stool'], ['아이 방']),
 ('indoor well', '실내 우물', 'home', 'floor', 1, 1, 16, 32, 'narshe', ['search'],
  '둥근 돌 우물과 나무 도르래 지붕(16px 솟음) — 우물 입구의 어두운 물 윗면이 보인다.', '부엌·광장 실내 구석.', ['water jar'], ['quench barrel'], ['부엌', '민가']),
 ('washing tub', '빨래 통', 'home', 'floor', 1, 1, 16, 16, 'manor', ['block'],
  '물 찬 나무 통에 빨래판이 기대 있다 — 통 입구 물 윗면 5행.', '부엌·뒷마당 실내.', ['laundry line'], ['quench barrel'], ['부엌', '민가']),
 ('laundry line', '빨랫줄', 'home', 'hang', 2, 0, 32, 16, 'manor', ['block'],
  '벽 사이 줄에 널린 흰 셔츠와 양말(2칸).', '부엌·하녀 방 벽 윗줄.', ['washing tub'], ['hang:herb'], ['민가']),
 ('child bed', '아이 침대', 'home', 'wall', 1, 1, 16, 32, 'manor', ['sleep'],
  '작은 나무 침대(16px 솟음) — 이불 윗면과 베개, 머리판에 별 무늬.', '아이 방 북쪽 벽.', ['toy box'], ['bed blue', 'cradle'], ['아이 방']),
 # ── 배·비공정 ──
 ('chart table', '선장 해도 탁자', 'ship', 'floor', 2, 1, 32, 32, 'fish', ['read'],
  '해도 탁자(2칸) — 상판(윗면 8행)에 펼친 바다 지도·컴퍼스·망원경. 전체 높이 24~26px.', '선장실 가운데.', ['ship wheel'], ['desk 2x1', 'wall map'], ['배', '선장실']),
 ('ship cannon', '함포', 'ship', 'floor', 1, 1, 16, 32, 'fish', ['block'],
  '나무 바퀴 받침에 얹은 검은 함포(16px 솟음) — 포신이 남쪽을 본다, 포신 윗면이 보인다.', '배 포갑판 벽 앞 줄로.', ['sea chest'], ['anchor'], ['배', '포갑판']),
 ('cargo netted', '그물 덮은 화물', 'ship', 'floor', 2, 1, 32, 32, 'fish', ['search'],
  '그물로 덮어 묶은 나무 상자 더미(2칸) — 상자 윗면·그물 매듭이 보인다. 전체 높이 24~26px.', '배 화물칸·항구 창고.', ['sea chest'], ['crate', 'fishing net'], ['배', '항구']),
 ('airship helm', '비공정 조종석', 'ship', 'floor', 2, 1, 32, 32, 'magitek', ['switch'],
  '놋쇠 조종석(2칸) — 가운데 키와 양옆 계기판·레버, 계기판 윗면이 기울어 위에서 보인다.', '비공정 조타실 북쪽.', ['gauge panel'], ['ship wheel', 'control console'], ['비공정']),
 ('ship bell', '배 종', 'ship', 'hang', 1, 0, 16, 16, 'fish', ['block'],
  '쇠걸이에 매단 놋쇠 종과 줄.', '갑판·선실 벽 윗줄.', ['ship wheel'], ['bell rope'], ['배']),
 ('sea chest', '선원 궤짝', 'ship', 'floor', 1, 1, 16, 16, 'fish', ['open'],
  '밧줄 손잡이 달린 파란 칠 궤짝 — 뚜껑 윗면 5행, 앞에 쇠 장식.', '선원 숙소 해먹 아래.', ['hammock'], ['chest'], ['배']),
 # ── 몬스터 수집 ──
 ('healing machine', '몬스터 회복 장치', 'monster', 'wall', 2, 1, 32, 32, 'pharmacy', ['heal'],
  '흰 기계 회복 장치(2칸) — 윗면(7~8행)에 둥근 홈 여섯 개와 그 속 붉은·흰 구슬, 앞면 초록 화면. 전체 높이 26~28px.', '몬스터 센터 카운터 뒤 북쪽 벽.', ['counter 3x1', 'storage terminal'], ['counter 2x1'], ['몬스터 센터']),
 ('orb pedestal', '포획 구슬 받침', 'monster', 'floor', 1, 1, 16, 32, 'scholar', ['key'],
  '하얀 받침대 위 붉은·흰 포획 구슬 하나(16px 솟음) — 받침 윗면에 구슬이 놓여 보인다.', '연구소 탁자 옆에 세 개 나란히(첫 동료 고르기).', ['lab bench'], ['crystal ball'], ['연구소', '몬스터 센터']),
 ('storage terminal', '보관 단말기', 'monster', 'wall', 1, 1, 16, 32, 'pharmacy', ['read'],
  '파란 화면의 보관함 단말기(16px 솟음) — 기운 화면 윗면과 자판이 보인다.', '몬스터 센터 구석 벽.', ['healing machine'], ['gauge panel'], ['몬스터 센터']),
 ('gym statue', '체육관 석상', 'monster', 'floor', 1, 1, 16, 48, 'throne', ['read'],
  '받침 위 날개 편 몬스터 석상(32px 솟음) — 받침 앞면에 명판, 받침 윗면 2행.', '체육관 입구 양옆.', ['orb pedestal'], ['statue'], ['체육관']),
 ('lab bench', '연구소 실험대', 'monster', 'floor', 2, 1, 32, 32, 'scholar', ['search'],
  '흰 상판 실험대(2칸) — 윗면 8행에 현미경·서류·포획 구슬, 앞에 서랍. 전체 높이 24~26px.', '연구소 가운데.', ['orb pedestal'], ['work 2x1'], ['연구소']),
 ('egg incubator', '알 부화기', 'monster', 'floor', 1, 1, 16, 32, 'scholar', ['search'],
  '유리 돔 속 점박이 알 하나(16px 솟음) — 돔 윗면 반사광, 아래 놋쇠 받침.', '연구소·몬스터 센터 구석.', ['lab bench'], ['crystal ball'], ['연구소']),
 # ── 폐가(호러) ──
 ('old doll', '낡은 인형', 'horror', 'floor', 1, 1, 16, 16, 'manor', ['read'],
  '바닥에 주저앉은 금 간 도자기 인형 — 드레스 자락이 위에서 보이고 한쪽 눈이 비었다.', '폐가 아이 방·복도 구석.', ['torn portrait'], ['sleeping cat'], ['폐가', '저택']),
 ('torn portrait', '찢긴 초상화', 'horror', 'hang', 2, 0, 32, 32, 'manor', ['read'],
  '칼로 찢긴 귀부인 초상화(2칸, 금테) — 얼굴 부분이 X 로 찢겼다.', '폐가 홀 벽.', ['cursed mirror'], ['portrait large'], ['폐가', '저택']),
 ('covered furniture', '천 덮인 가구', 'horror', 'floor', 2, 1, 32, 32, 'manor', ['search'],
  '흰 천을 덮은 소파꼴 가구(2칸) — 천 주름 윗면이 위에서 보인다. 전체 높이 22~24px.', '버려진 저택 거실.', ['old doll'], ['sofa'], ['폐가', '저택']),
 ('candle stubs', '녹은 촛불 무더기', 'horror', 'floor', 1, 1, 16, 16, 'manor', ['light'],
  '바닥에 녹아 붙은 초 여러 개와 작은 불꽃 — 촛농 웅덩이 윗면.', '폐가·지하실 바닥.', ['old doll'], ['candle'], ['폐가', '지하실']),
 ('boarded window', '판자로 막은 창', 'horror', 'hang', 1, 0, 16, 16, 'manor', ['block'],
  '판자 세 장을 비스듬히 못 박아 막은 창.', '폐가 벽 윗줄.', ['cobweb'], ['window'], ['폐가']),
 ('cobweb', '거미줄', 'horror', 'hang', 1, 0, 16, 16, 'manor', ['block'],
  '벽 모서리의 흰 거미줄과 작은 거미.', '폐가·지하실 벽 윗줄 구석.', ['boarded window'], ['picture'], ['폐가', '지하실']),
 ('music box', '오르골', 'story', 'floor', 1, 1, 16, 16, 'manor', ['read'],
  '뚜껑 열린 작은 나무 오르골 — 뚜껑 안쪽 거울과 춤추는 인형, 상자 윗면 5행.', '아이 방·추억의 방 협탁 옆.', ['diary stand'], ['chest'], ['추억', '폐가']),
 # ── 농가 ──
 ('shipping bin', '출하 상자', 'farm', 'floor', 2, 1, 32, 32, 'hobbit', ['search'],
  '나무 출하 상자(2칸) — 넓은 경첩 뚜껑 윗면 8~10행, 앞에 판자. 전체 높이 22~24px.', '농가 문 옆.', ['seed sacks'], ['crate', 'royal chest'], ['농가']),
 ('seed sacks', '씨앗 자루', 'farm', 'floor', 1, 1, 16, 16, 'hobbit', ['search'],
  '그림 표 붙은 작은 씨앗 자루 셋 — 묶은 입구가 위에서 보인다.', '농가 창고 선반 아래.', ['shipping bin'], ['sack:grain'], ['농가', '창고']),
 ('butter churn', '버터 교반기', 'farm', 'floor', 1, 1, 16, 32, 'hobbit', ['block'],
  '나무 테 두른 높은 통과 막대(16px 솟음) — 통 뚜껑 윗면.', '농가 부엌.', ['milk cans'], ['barrel'], ['농가', '부엌']),
 ('cheese press', '치즈 압착기', 'farm', 'floor', 1, 1, 16, 32, 'hobbit', ['block'],
  '나무 틀 나사 압착기에 치즈 덩이(16px 솟음).', '농가 부엌·식료품 방.', ['cheese wheels'], ['grindstone'], ['농가']),
 ('farm tool rack', '농기구 걸이', 'farm', 'hang', 2, 0, 32, 16, 'stable', ['block'],
  '괭이·낫·물뿌리개를 건 나무 걸이(2칸).', '농가 헛간 벽 윗줄.', ['seed sacks'], ['tool wall', 'pitchfork'], ['농가', '헛간']),
 ('milk cans', '우유 통', 'farm', 'floor', 1, 1, 16, 16, 'stable', ['search'],
  '은빛 우유 통 둘 — 둥근 뚜껑 윗면이 보인다.', '마구간·농가 부엌.', ['butter churn'], ['powder kegs'], ['농가', '마구간']),
 ('seedling shelf', '모종 선반', 'farm', 'wall', 2, 1, 32, 32, 'hobbit', ['block'],
  '흙 상자에 새싹이 줄지은 2단 선반(2칸) — 꼭대기 윗판 윗면 3행, 단마다 상자 윗면 흙과 새싹이 위에서 보인다. 전체 높이 26~28px.', '농가 볕 드는 창 아래 북쪽 벽.', ['seed sacks'], ['potted sapling', 'proofing rack'], ['농가']),
 # ── 추억·이야기 ──
 ('diary stand', '일기장 받침', 'story', 'floor', 1, 1, 16, 32, 'manor', ['read'],
  '작은 나무 받침에 펼친 일기장과 깃펜(16px 솟음) — 펼친 두 쪽이 위에서 보인다.', '침실 협탁 옆·추억의 방.', ['music box'], ['lectern'], ['추억', '침실']),
 ('mailbox', '우편함', 'story', 'hang', 1, 0, 16, 16, 'manor', ['read'],
  '벽에 붙인 나무 우편함, 편지 한 통이 삐져나왔다.', '현관 벽 윗줄.', ['diary stand'], ['hymn board'], ['민가', '여관']),
 ('hourglass', '큰 모래시계', 'story', 'floor', 1, 1, 16, 32, 'tower', ['read'],
  '나무 틀 큰 모래시계(16px 솟음) — 위아래 유리 둥근 윗면과 흐르는 금모래.', '탑·추억의 방·시간 신전.', ['diary stand'], ['clock'], ['추억', '마법사의 탑']),
 ('photo frames', '액자 탁자', 'story', 'floor', 1, 1, 16, 32, 'manor', ['read'],
  '작은 협탁(16px 솟음) 위 사진·초상 액자 셋 — 협탁 윗면 5행에 액자가 기대 선다.', '거실·침실 구석.', ['music box'], ['nightstand'], ['추억', '거실']),
 ('grave bouquet', '꽃다발 묘비(실내)', 'story', 'floor', 1, 1, 16, 32, 'chapel', ['read'],
  '작은 돌 묘비 앞에 놓인 흰 꽃다발(16px 솟음) — 묘비 윗면 2행.', '예배당 지하·추모실.', ['candle stubs'], ['rune stone'], ['추억', '예배당']),
]
assert len({x[0] for x in I}) == len(I), '같은 id 가 둘'


def main():
    from common import objects_by_id, KIND_KO
    by = objects_by_id(); p = os.path.join(HERE, 'items.json'); d = json.load(open(p, encoding='utf-8'))
    have = {it['id'] for it in d['items']}; added = 0; warn = []
    for row in I:
        i, ko, cat, kind, fw, fh, W, H, ctx, use, desc, place, pair, refs, tags = row[:15]; ex = row[15] if len(row) > 15 else {}
        if i in have: continue
        if i in by: raise SystemExit(f'{i}: v5 기물과 겹친다')
        new_ids = {x[0] for x in I} | have
        pair = [x for x in pair if x in by or x in new_ids] or []
        bad = [x for x in refs if x not in by]
        if bad: warn.append(f'{i}: refs 없음 {bad}')
        it = dict(id=i, name_ko=ko, name_en=i, category=cat, category_ko=CAT[cat], kind=kind, footprint={'w': fw, 'h': fh}, canvas=[W, H],
                  description=desc, contextRoom=ctx, tags=tags, use=use, place=place, pair=pair, refs=[x for x in refs if x in by])
        if ex.get('states'):
            g, st, others = ex['states']; it['states'] = dict(group=g, state=st, others=others)
        if ex.get('base'): it['drawBase'] = ex['base']
        d['items'].append(it); added += 1
    # 첫 상태 쪽에도 짝을 단다
    rev = {}
    for it in d['items']:
        s = it.get('states')
        if s:
            for st, oid in s['others'].items(): rev.setdefault(oid, (s['group'], st, {}))[2][s['state']] = it['id']
    for it in d['items']:
        if it['id'] in rev and not it.get('states'):
            g, st, others = rev[it['id']]; it['states'] = dict(group=g, state=st, others=others)
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(p, 'a').write('\n')
    print(f'덧붙임 {added} · 전체 {len(d["items"])}')
    for w in warn: print('  !', w)


if __name__ == '__main__':
    main()
