#!/usr/bin/env python3
"""일본 세트 기물 목록·배정표 tiledata/atlas-pick/jobs-jp.json 과 기물 폴더(candidates-jp/<slug>/info.json·palette.pal)를 만든다.
  python3 scripts/content/atlas-pick/make_jp_jobs.py            # 목록 쓰기 + 폴더 준비(있는 후보 파일은 건드리지 않는다)
기물 = (slug, 이름, 장면, 칸 w×h(16px), 층, 설명, 팔레트 힌트). 작업자 j1…j5 에 겹침 없이 11~12개씩.
층: ground 바닥 불투명 · decal 바닥 덧칠(투명) · object 물체 · wall 벽 걸이 · facade 건물 외관(불투명 허용) · over 공중(전선)."""
import json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

S_ST, S_AL, S_SH = '역 앞 번화가', '주택가 골목', '신사 한 켠'
# (slug, 이름, 장면, w, h, 층, 설명, 팔레트 힌트)
ITEMS = [
    # ── 역 앞 번화가 ──
    ('vending_drink', '음료 자판기(흰)', S_ST, 2, 2, 'object', '2×2 흰 몸통 음료 자판기 한 대(사용자: 2x2 로, 자판기 여러 종류). 윗면 2~3px 밝은 지붕판, 앞면 위 절반 = 밝은 유리칸 속 캔·페트 견본 세 줄(색 점 줄 + 가격 점), 아래 = 돈 넣는 곳·버튼 줄·꺼내는 입구(짙게). 오른 옆면 한 단 어둡게 3~4px. 발치 오른 아래 그림자. 자판기 식구(흰 음료·담배·커피·아이스크림·캡슐토이)는 같은 높이·윗면 두께·그림자 방식.', 'mwhite 몸통, lacq 입구, kblue/akachin/kgreen 캔 점, washi 불빛'),
    ('vending_cig', '담배 자판기', S_ST, 2, 2, 'object', '2×2 짙은 담배 자판기(갈색·검정 몸통). 담배갑 견본 네모 칸이 촘촘히 두세 줄, 가운데 은색 동전·카드 판, 아래 꺼내는 입구. 윗면·옆면은 음료 자판기와 같은 방식(식구).', 'sumi/lacq 몸통, mmetal 판, washi·kblue·akachin 담배갑'),
    ('vending_coffee', '커피 자판기(붉은 몸통)', S_ST, 2, 2, 'object', '2×2 붉은 몸통 캔커피·따뜻한 음료 자판기. 견본 줄 중 아래 줄은 빨간 「あったか」 띠(따뜻함) 한 줄, 위는 파란 「つめた」 띠 느낌(글자 없이 색 띠만). 음료 자판기와 같은 틀, 색만 다른 식구.', 'mred/akachin 몸통, mwhite 견본칸, kblue·akachin 띠, lacq 입구'),
    ('vending_ice', '아이스크림 자판기', S_ST, 2, 2, 'object', '2×2 아이스크림 자판기: 위 절반 = 밝은 하늘색 판에 아이스크림 그림 칸(작은 색 네모 여섯), 아래 = 서리 낀 투입구·버튼. 차가운 흰빛. 자판기 식구 틀.', 'mwhite·kblue 몸통, sakura·taxi·kgreen 아이스크림 점, lacq 입구'),
    ('vending_gacha', '캡슐토이(가샤폰) 두 대', S_ST, 2, 2, 'object', '2×2 칸에 캡슐토이 기계 두 대 위아래 한 단(또는 나란히 두 대): 투명 둥근 창 속 색 캡슐 알(2px 점 여럿), 앞 은색 손잡이 다이얼, 아래 캡슐 나오는 입. 기계 윗면 보이게.', 'mwhite·mred 몸통, mglass 창, taxi·sakura·kblue·kgreen 캡슐, mmetal 다이얼'),
    ('konbini_front', '편의점 외관(콘비니)', S_ST, 4, 3, 'facade', '편의점 1층 앞면. 맨 위 줄 = 초록·주황·파랑 가로 띠 간판(브랜드 로고 금지, 줄무늬만), 가운데 = 큰 유리창(안에 선반·잡지 칸 줄), 아래 = 가운데 유리 자동문(두 짝) + 문 앞 발깔개. 흰 벽 테두리. 폭 4칸 중 문은 가운데 2칸.', 'kgreen·korange·kblue 띠, mwhite 벽, mglass 유리, mmetal 문틀'),
    ('konbini_pole', '콘비니 기둥 간판', S_ST, 1, 3, 'object', '편의점 주차장 앞 높은 기둥 간판. 맨 위에 네모 판(초록·주황·파랑 줄무늬, 글자 없음), 가는 쇠 기둥, 바닥 받침. 밤에도 읽히게 판 가장자리 밝게.', 'kgreen·korange·kblue, mmetal 기둥'),
    ('station_gate', '역 개찰구', S_ST, 3, 2, 'object', '자동 개찰구 세 대(사이에 두 통로). 허리 높이 회색 상자, 윗면에 IC 카드 대는 파란 원판, 통로 쪽 작은 초록/빨강 등, 앞 끝에 둥근 문 날개. 위에서 약간 내려다본 각 — 윗면 밝게, 앞면 한 단 어둡게.', 'mmetal/mconc 몸통, kblue 판, kgreen·akachin 등'),
    ('station_nameboard', '역명판', S_ST, 3, 1, 'wall', '흰 판에 가운데 큰 역 이름 「えき」 가나 세 자(도트로 읽히게, 2px 획), 아래 가는 초록 띠, 양 끝에 앞뒤 역 방향 작은 화살표 ◀ ▶. 한자 한 자 「駅」 을 위 작은 줄에 넣어도 좋다. 벽이나 두 기둥 위에 건다.', 'mwhite 판, lacq 글자, kgreen 띠'),
    ('station_entrance', '역 입구 외관', S_ST, 5, 3, 'facade', '역 건물 입구 앞면. 위 = 긴 차양·띠 간판(초록 줄 + 흰 판에 「駅」), 가운데 = 넓은 열린 입구(안이 어둡게, 안쪽 개찰구가 살짝 보임), 양옆 = 타일 벽·기둥. 한국 지하철 입구와 다르게 지상 역 건물 1층.', 'mconc·mtile 벽, kgreen 띠, mwhite 판, lacq 글자, mdglass 안쪽'),
    ('ticket_machine', '매표기', S_ST, 3, 2, 'object', '3×2 역 매표기 줄(사용자: 3x2 및 공간감을 살려라). 세 대가 벽에 붙어 나란히, 몸통 윗면 비스듬한 조작판(밝은 단 3~4px — 공간감의 핵심), 앞면 화면(청록 빛)·동전·지폐 넣는 곳, 기계 사이 이음 그늘 1px, 오른 끝 옆면 한 단 어둡게, 위쪽에 노선 요금표 판(작은 색 선 여러 줄) 뒤 벽에. 발치 그림자.', 'mmetal·mwhite 몸통, neonc 화면, kblue·akachin·kgreen 노선 선'),
    ('pachinko_sign', '파칭코 세로 네온 간판', S_ST, 1, 4, 'wall', '건물 벽에 붙은 세로로 긴 네온 간판. 분홍·노랑 테두리 전구 점(한 칸 걸러), 속에 굵은 가나 「パチンコ」 를 세로로(획 2px, 네 글자만 넣어도 된다). 빛 번짐은 테두리 밖 한 줄.', 'neon·taxi 전구, lacq 바탕, mwhite 글자'),
    ('zakkyo_building', '세로 간판 잡거빌딩', S_ST, 3, 5, 'facade', '좁고 높은 잡거빌딩 앞면(층마다 다른 가게). 층마다 창 한 줄 + 왼쪽에 층별 세로 간판 판 여러 장(색 다른 네모, 굵은 한자 한 자씩 「酒」「歌」「薬」 같이), 1층은 가게 유리문. 맨 위 평지붕 테두리·물탱크.', 'mconc·mtile 벽, mglass 창, akachin·kblue·taxi·neon 간판, lacq 글자'),
    ('taxi_black', '검정 택시', S_ST, 2, 3, 'object', '위에서 약간 내려다본 세로 택시(남쪽을 향함). 검정 몸통, 지붕 위 작은 표시등(행등, 흰·노랑), 앞유리·뒷유리, 옆 흰 문 테 줄 없이 은색 테. 일본식 둥근 모서리 세단. 차 밑 오른쪽 아래 반투명 그림자.', 'lacq 몸통, mglass 유리, washi·taxi 행등, mmetal 테'),
    ('taxi_yellow', '노랑 택시', S_ST, 2, 3, 'object', '같은 크기·같은 각의 노랑 택시(연두 테 줄 한 줄). 검정 택시와 나란히 두었을 때 한 식구로 보이게.', 'taxi 몸통, kgreen 테 줄, mglass 유리, washi 행등'),
    ('tomare_mark', '「止まれ」 도로 표시', S_ST, 2, 2, 'ground', '아스팔트 위 흰 글자 「止まれ」(세로로 길쭉한 글자, 차가 읽는 방향 = 아래가 가까운 쪽). 두 칸 폭에 세 글자가 위→아래로. 칸을 꽉 채운 아스팔트 바탕 포함(아래층). 페인트는 약간 닳게.', 'masph 바탕, mwhite 글자'),
    ('crosswalk_jp', '일본식 횡단보도', S_ST, 2, 2, 'ground', '일본식 횡단보도: 가장자리 세로선 없이 굵은 흰 띠만 나란히(띠 폭 3px·틈 3px 정도). 세로로 이어 붙이면 끊김 없이 이어지게(위아래 가장자리가 맞게). 아스팔트 바탕 포함.', 'masph 바탕, mwhite 띠'),
    ('diamond_mark', '◇ 횡단보도 예고 표시', S_ST, 1, 1, 'ground', '횡단보도 앞 차로 위 흰 마름모 ◇ 표시(속이 빈 마름모 선). 아스팔트 바탕 포함.', 'masph 바탕, mwhite 선'),
    ('jp_signal', '가로형 신호등', S_ST, 2, 3, 'object', '일본 차량 신호등: 가는 기둥 위에서 옆으로 뻗은 팔에 가로로 긴 신호 상자, 등 셋(파랑(청록)·노랑·빨강) 위에 작은 차양. 한 등만 켜진 판(청신호). 기둥은 왼쪽 칸 아래에 선다.', 'mmetal/pole 기둥, lacq 상자, neonc·taxi·akachin 등'),
    ('ped_signal', '보행 신호기', S_ST, 1, 2, 'object', '기둥에 달린 보행 신호 상자 둘(위 = 빨간 서 있는 사람, 아래 = 파란 걷는 사람, 아래가 켜짐). 사람 모양은 4~6px 로 읽히게.', 'pole 기둥, lacq 상자, akachin·neonc 사람'),
    ('manhole_jp', '그림 맨홀', S_ST, 1, 1, 'ground', '지자체 그림 맨홀 뚜껑: 둥근 쇠 뚜껑 속에 꽃(벚꽃 다섯 잎) 무늬를 부조로. 색은 쇠 한 계열 명암으로만(칠하지 않은 판). 인도 보도블록 바탕 포함.', 'mpave 바탕, mmetal/ishi 뚜껑'),
    ('bicycle_parking', '자전거 주차장', S_ST, 3, 2, 'object', '역 앞 자전거 거치대에 나란히 선 자전거 셋(앞 바구니 달린 마마챠리 포함, 색 셋 다르게), 바닥 쇠 거치 레일. 위에서 약간 내려다봐서 바퀴는 세로 타원, 핸들은 가로 막대.', 'lacq 바퀴, mmetal 레일, akachin·kblue·mwhite 몸체'),
    ('mamachari', '마마챠리 한 대', S_ST, 2, 1, 'object', '옆으로 서 있는 생활 자전거 한 대(앞 바구니·뒷자리 짐받이·흙받이). 두 칸 폭에 바퀴 둘이 또렷하게. 스탠드로 선 모양.', 'lacq 바퀴, mwhite/kblue 몸체, mmetal 바구니'),
    ('neon_karaoke', '「カラオケ」 네온 간판', S_ST, 3, 1, 'wall', '벽에 거는 가로 네온 간판: 가나 「カラオケ」 다섯 자(획 2px, 3칸 폭에 들어가게 좁게), 청록 네온 테 + 분홍 글자. 빛 번짐 한 줄.', 'neon 글자, neonc 테, lacq 바탕'),
    # ── 주택가 골목 ──
    ('utility_pole', '전봇대', S_AL, 1, 4, 'object', '콘크리트 전봇대: 회색 기둥(위로 조금 가늘게), 위쪽 가로 완목 두 줄에 흰 애자, 변압기 통(회색 원통) 하나, 기둥 중간 노랑·검정 반사띠, 번지 표찰(작은 파란 판). 발치에 작은 그림자.', 'pole 기둥, mwhite 애자, mmetal 변압기, taxi·lacq 띠, kblue 표찰'),
    ('power_lines', '전선(이어 붙이기)', S_AL, 2, 1, 'over', '골목 위를 가로지르는 전선 서너 가닥(살짝 처진 곡선, 1px 선, 검정이 아닌 짙은 회색). 좌우 끝이 같은 높이라 가로로 이어 붙인다. 투명 배경, 맨 위층.', 'lacq·masph 선'),
    ('house_roof', '기와 지붕(2층 주택)', S_AL, 4, 2, 'facade', '일본 2층 주택의 은회색 기와 박공 지붕(용마루 가로, 기와 줄이 가로 골로 보이게, 처마 끝 둥근 기와 줄). 아래 가장자리는 외벽 블록 위에 얹힌다. 좌우 끝 박공 삼각 벽 조금.', 'kawara 기와, hinoki/sumi 박공, mconc 처마 밑'),
    ('house_wall', '2층 주택 외벽', S_AL, 4, 3, 'facade', '2층 주택 앞면: 연한 모르타르(베이지) 벽, 2층 = 알루미늄 난간 베란다 + 미닫이 유리창, 1층 = 격자 창 하나 + 현관 미닫이문(나무 격자 유리) + 문 옆 문패·우편함, 발치 좁은 콘크리트 단. 기와 지붕 블록 아래에 붙는다.', 'mtile/washi 벽, mmetal 난간, mglass 창, hinoki 격자문'),
    ('laundry', '베란다 빨래', S_AL, 2, 1, 'wall', '베란다 난간에 걸린 빨래(흰 셔츠·색 수건·양말, 빨래 장대 한 줄). 주택 외벽 2층 베란다 위에 겹쳐 건다(투명 배경).', 'mwhite·kblue·sakura·taxi 천, mmetal 장대'),
    ('ac_unit', '실외기', S_AL, 1, 1, 'object', '벽 밑에 선 흰 에어컨 실외기(오른쪽에 둥근 팬 창살, 왼쪽 판), 위에서 보아 윗면 한 줄 밝게. 뒤쪽 벽으로 가는 관.', 'mwhite 몸통, lacq 팬, mmetal 관'),
    ('potted_plants', '골목 화분 줄', S_AL, 2, 1, 'object', '집 앞 골목에 늘어놓은 화분 네다섯(크기·잎 모양 다르게 — 둥근 잎, 가는 잎, 꽃 한 송이), 토기 화분·플라스틱 화분 섞어. 두 칸 폭.', 'matsu/mgreen 잎, mbrick/korange 화분, sakura 꽃'),
    ('block_wall', '블록 담장(이어 붙이기)', S_AL, 2, 1, 'object', '회색 콘크리트 블록 담장 한 토막: 블록 줄눈 격자, 가운데 구멍 무늬 블록 한 장, 윗면 갓돌 한 줄 밝게. 좌우로 이어 붙인다(양 끝이 맞게). 높이는 사람 허리~가슴.', 'pole/mconc 블록, moss 아래 이끼 조금'),
    ('curve_mirror', '도로 반사경', S_AL, 1, 3, 'object', '골목 모퉁이 주황 기둥 위 둥근 볼록거울(주황 테, 거울 속은 하늘·길 비친 옅은 색 두 덩이). 기둥 가운데 작은 표지 판.', 'korange 기둥·테, mglass 거울, mwhite 반짝임'),
    ('tomare_sign', '「止まれ」 표지판', S_AL, 1, 2, 'object', '일본 멈춤 표지: 빨간 역삼각형 판에 흰 글자 「止まれ」(판 폭 12~14px, 글자는 작게라도 두 줄 획이 읽히게), 가는 회색 기둥.', 'akachin 판, mwhite 글자·테, pole 기둥'),
    ('garbage_station', '쓰레기 집하장', S_AL, 2, 1, 'object', '골목 쓰레기 두는 곳: 초록·파랑 그물(까마귀 막는 그물)을 덮은 쓰레기봉투 더미(반투명 흰 봉투 서너 개), 옆에 접이식 철망 상자.', 'kgreen/kblue 그물, mwhite·washi 봉투, mmetal 철망'),
    ('mailbox_red', '빨간 우체통', S_AL, 1, 2, 'object', '일본 둥근 기둥형(또는 네모 기둥형) 빨간 우체통: 위 둥근 지붕, 앞에 편지 넣는 가로 구멍 두 개, 가운데 흰 〒 표시. 원통이면 밝은 덩이를 왼쪽에.', 'akachin 몸통, lacq 구멍, mwhite 〒'),
    ('phone_booth', '공중전화', S_AL, 1, 2, 'object', '초록 공중전화기가 든 작은 유리 부스(또는 담배가게 앞 초록 전화기 받침대). 유리 너머 초록 전화기, 부스 테는 은색·지붕 한 줄.', 'kgreen 전화기, mglass 유리, mmetal 테'),
    ('railway_crossing', '건널목 차단기', S_AL, 2, 3, 'object', '일본 건널목: 기둥 위 검정·노랑 X자 표지(踏切), 그 아래 좌우로 붉은 경보등 둘(하나 켜짐), 노랑·검정 줄무늬 차단 봉이 옆 칸으로 가로질러 내려온 판. 기둥 아래 노랑·검정 받침.', 'taxi·lacq 줄무늬, akachin 등, pole 기둥'),
    ('rail_track', '선로(세로 이어 붙이기)', S_AL, 2, 1, 'ground', '남북으로 가는 선로 한 토막: 자갈 바탕(회갈 점) 위에 가로 침목(콘크리트 회색) + 세로 레일 두 줄(은색 윗면 한 줄 밝게). 위아래로 이어 붙인다.', 'ishi 자갈, pole 침목, mmetal 레일'),
    ('crossing_deck', '건널목 바닥판', S_AL, 2, 1, 'ground', '선로가 길과 만나는 건널목 바닥: 레일 사이를 메운 고무·콘크리트 판(짙은 회색 판 줄), 레일 두 줄이 그대로 보이고 양옆은 아스팔트. 선로 조각과 위아래로 맞는다.', 'masph, lacq 고무판, mmetal 레일'),
    ('bus_stop_jp', '버스 정류장 표지', S_AL, 1, 2, 'object', '일본 버스 정류장: 둥근 판(흰 바탕에 초록 테·버스 그림 자리) 을 얹은 기둥 + 기둥 아래 둥근 쇳덩이 받침, 기둥 중간에 시간표 네모 판.', 'mwhite 판, kgreen 테, mmetal 기둥, lacq 받침'),
    ('standing_sign', 'A형 입간판(메뉴 칠판)', S_AL, 1, 1, 'object', '가게 앞 A자 나무 입간판에 칠판(짙은 초록 판에 흰 분필 글씨 줄 두세 줄, 색분필 점 하나). 나무 테.', 'hinoki 테, matsu/lacq 칠판, mwhite 분필'),
    # ── 음식점 (번화가·골목) ──
    ('izakaya_front', '이자카야 외관', S_AL, 4, 3, 'facade', '목조 이자카야 1층 앞면: 짙은 나무 판벽, 가운데 나무 격자 미닫이 유리문(격자 틈으로 노란 불빛), 문 위 짧은 노렌, 처마 끝에 붉은 제등 둘, 문 옆 작은 메뉴판. 따뜻한 불빛.', 'sumi 판벽, hinoki 격자, washi 불빛, akachin 제등, ai 노렌'),
    ('ramen_front', '라멘집 외관', S_ST, 4, 3, 'facade', '라멘집 1층 앞면: 문 위 가로 간판(붉은 바탕에 흰 가나 「らーめん」, 획 2px), 남색 노렌 세 폭(흰 글자 한 자 「麺」), 가게 앞 유리창 김서림(밝은 흰 덩이), 문 옆 붉은 등롱 하나. 한국 분식집과 다르게 노렌이 주인공.', 'akachin 간판, ai 노렌, mwhite 글자, mglass 창, hinoki 문틀'),
    ('akachochin', '붉은 등롱(아카초칭)', S_AL, 1, 1, 'wall', '처마에 매단 붉은 종이 등롱 하나: 가로 주름 줄(한 단 어두운 가로선 3~4줄), 위아래 검정 테, 속에 검은 글자 한 자 「酒」 또는 「おでん」 은 무리 — 한 자만. 속에서 빛나는 느낌은 가운데 한 단 밝게.', 'akachin 몸통, lacq 테·글자, washi 속빛'),
    ('noren', '노렌(남색)', S_AL, 2, 1, 'wall', '가게 문 위에 거는 남색 천 노렌 세 폭(폭 사이 틈 1px), 위 가로 장대, 아래 끝이 살짝 흔들린 선. 가운데 폭에 흰 원 속 문양(가문 같은 단순 원·마름모).', 'ai 천, mwhite 문양, hinoki 장대'),
    ('kanji_sign_drug', '「薬」 세로 간판', S_ST, 1, 2, 'wall', '드럭스토어 벽 세로 간판: 노랑 판에 굵은 한자 「薬」 한 자(획 2px, 12×12 안). 판 테 한 줄 어둡게.', 'taxi 판, lacq 글자'),
    # ── 신사 한 켠 ──
    ('torii', '도리이', S_SH, 4, 4, 'object', '주홍 명신형 도리이(明神鳥居): 맨 위 가사기(검정 윗판이 양끝이 살짝 들린 곡선) + 그 아래 주홍 시마기, 한 줄 아래 가로 누키(기둥 밖으로 조금 나옴), 가운데 액자 판(가쿠, 검정 테), 기둥 둘(아래 검정 받침돌 네모). 위에서 약간 내려다본 각 — 가로 부재 윗면 한 줄 밝게.', 'shu 주홍, lacq 가사기·받침, washi 액자 글자'),
    ('stone_lantern', '석등', S_SH, 1, 2, 'object', '화강암 석등(카스가형): 맨 위 보주, 지붕돌(육각 처마가 넓게), 불 켜는 칸(네모 창 둘, 속 어둡거나 불빛), 가운데 받침, 기둥, 바닥 받침돌. 돌 결·이끼 조금.', 'ishi 돌, moss 이끼, washi 불빛'),
    ('komainu_a', '고마이누(아형·입 벌림)', S_SH, 1, 2, 'object', '돌 받침 위에 앉은 사자개(오른쪽을 봄 — 짝과 마주 보게), 입을 벌린 아형. 곱슬 갈기 덩이·앞다리 곧게·꼬리 불꽃 모양. 1×2 에서 사자개로 읽히는 게 먼저 — 머리를 크게.', 'ishi 돌, moss 이끼'),
    ('komainu_un', '고마이누(음형·입 다묾)', S_SH, 1, 2, 'object', '아형의 짝(왼쪽을 봄), 입을 다문 음형. 머리에 작은 뿔 하나. 좌우 거울로 찍지 마라 — 입·뿔이 다르고 빛은 늘 왼쪽 위라 명암이 같은 방향이어야 한다.', 'ishi 돌, moss 이끼'),
    ('omikuji_rack', '오미쿠지 묶는 곳', S_SH, 2, 2, 'object', '나무 틀에 가로 줄(새끼줄 또는 철사) 두세 줄, 줄마다 흰 종이 오미쿠지 매듭이 촘촘히(흰 점 덩이 줄). 틀은 흰 나무, 작은 지붕 없이.', 'hinoki 틀, washi·mwhite 종이 매듭'),
    ('ema_rack', '에마 걸이', S_SH, 2, 2, 'object', '작은 지붕(기와 또는 동판) 아래 가로 걸이 두 줄에 오각형 나무 에마 판이 여러 장 겹쳐 걸림(판마다 글씨 자국 점, 붉은 끈 점). 기둥 둘.', 'hinoki 판, sumi 틀, kasa/kawara 지붕, akachin 끈'),
    ('saisen_box', '새전함·방울', S_SH, 2, 2, 'object', '배전 앞 새전함(나무 상자, 윗면에 가로 살 여러 줄 — 동전 들어가는 틈) + 위에서 늘어진 굵은 방울 줄(紅白 꼰 줄) 끝의 둥근 청동 방울. 상자 앞면에 금색 「奉納」 자리(점 두 덩이).', 'hinoki/sumi 상자, kasa 방울, shu·mwhite 줄, taxi 금'),
    ('temizuya', '데미즈야(손 씻는 곳)', S_SH, 3, 3, 'object', '네 기둥 작은 지붕(동판 녹청 또는 기와) 아래 긴 돌 물통, 물(밝은 청록 한 줄 반짝임), 물통 위 가로 대나무 국자 서너 개, 한쪽 끝 용 모양 물 주둥이(작게). 지붕 윗면이 보이는 각.', 'kasa 지붕, hinoki 기둥, ishi 물통, mglass 물, matsu 대나무'),
    ('shrine_hall', '배전 앞면', S_SH, 5, 4, 'facade', '작은 신사 배전(拝殿) 앞면: 큰 박공 지붕(동판 녹청 또는 짙은 기와, 가운데 곡선 처마 가라하후), 처마 밑 굵은 시메나와 + 흰 시데, 앞 계단 세 단, 격자 문(흰 나무), 양옆 주홍 또는 흰 나무 기둥. 새전함은 따로(saisen_box) — 앞 계단 앞 한 칸을 비워 둔다.', 'kasa/kawara 지붕, hinoki 기둥·격자, shu 난간, washi 시데, hinoki 밝은 단 새끼줄'),
    ('shimenawa', '시메나와(새끼줄·시데)', S_SH, 3, 1, 'wall', '굵게 꼰 새끼줄이 가운데가 살짝 처지게 가로로(꼰 결 사선 줄), 줄에 매단 흰 번개 모양 종이 시데 서너 장. 도리이·배전·신목에 거는 걸이.', 'hinoki 밝은 단 새끼줄, washi 시데'),
    ('sakura_tree', '벚나무(만개)', S_SH, 3, 3, 'object', '꽃이 만개한 벚나무: 분홍 꽃 덩이 수관(연분홍·분홍 두세 덩이, 빛 쪽 위 왼쪽이 가장 밝게, 속은 한 단 어둡게, 가장자리 꽃잎 점), 짙은 갈색 줄기가 아래 가운데 칸에, 발치에 떨어진 꽃잎 몇 점. 숲 나무처럼 수관 아래 줄기 폭 = 받침 폭.', 'sakura 꽃, sumi 줄기, matsu 잎 조금'),
    ('sakura_petals', '벚꽃잎 흩날린 바닥', S_SH, 1, 1, 'decal', '바닥 위에 떨어진 벚꽃잎(1~2px 분홍 점 여섯~열, 한쪽으로 몰리게, 고른 점박이 금지). 투명 배경 — 인도·자갈 위에 덧칠. 여러 칸을 섞어 깔 수 있게 가장자리에 걸리지 않게.', 'sakura'),
    ('sando_path', '참도 판석·자갈', S_SH, 2, 2, 'ground', '신사 참도: 가운데 큰 네모 판석 두 줄(돌 틈 짙게), 양옆 흰 자갈(작은 회백 점 덩이). 위아래로 이어 붙인다(판석 줄이 끊기지 않게).', 'ishi 판석·자갈, moss 틈'),
    ('fox_statue', '여우 석상(이나리)', S_SH, 1, 2, 'object', '이나리 신사 여우 석상: 돌 받침 위 앉은 여우(귀 뾰족·꼬리 위로 말림), 목에 붉은 턱받이(요다레카케). 고마이누와 다른 실루엣 — 가늘고 귀가 크다.', 'ishi 돌, akachin/shu 턱받이, moss 이끼'),
]
WORKERS = ['j1', 'j2', 'j3', 'j4', 'j5']
# 사용자 메모로 크기를 바꾼 기물(2026-09-30 1판 메모) — 새 후보는 재작업 작업자 rN 이 찍는다(jobs-jp-kit.json rework).
# 옛 크기 후보 파일(j3-A.pxg …)은 지우지 않는다: 화면은 캔버스가 다른 후보를 「옛 크기」로 접어 보여 준다.
RESIZED = {
    'vending_drink': dict(frm=[1, 2], why='사용자 메모 「2x2 사이즈로. 자판기를 여러 종류를 할거임.」'),
    'vending_cig': dict(frm=[1, 2], why='사용자 메모 「2x2 사이즈로. 자판기를 여러 종류를 할거임.」'),
    'ticket_machine': dict(frm=[2, 2], why='사용자 메모 「3x2 및, 공간감을 살려라」'),
}
NEW_KINDS = {'vending_coffee', 'vending_ice', 'vending_gacha'}   # 「자판기 여러 종류」 로 새로 넣은 기물
REWORK = {'vending_drink': 'r1', 'vending_cig': 'r1', 'vending_coffee': 'r1', 'vending_ice': 'r2', 'vending_gacha': 'r2', 'ticket_machine': 'r2'}

def assign():
    """장면이 한 작업자에게 몰리지 않게 섞되, 짝(택시 둘·고마이누 둘·선로/건널목판·지붕/외벽)은 한 사람에게."""
    pairs = [('taxi_black', 'taxi_yellow'), ('komainu_a', 'komainu_un'), ('rail_track', 'crossing_deck'), ('house_roof', 'house_wall'),
             ('vending_drink', 'vending_cig'), ('konbini_front', 'konbini_pole'), ('jp_signal', 'ped_signal'), ('tomare_mark', 'crosswalk_jp')]
    by = {i[0]: i for i in ITEMS}; groups = []; used = set()
    for a, b in pairs: groups.append([a, b]); used |= {a, b}
    groups += [[i[0]] for i in ITEMS if i[0] not in used]
    cost = lambda s: by[s][3] * by[s][4] + (4 if by[s][5] == 'facade' else 0)   # 큰 칸·외관은 무겁다
    groups.sort(key=lambda g: -sum(cost(s) for s in g))
    load = {w: 0 for w in WORKERS}; out = {w: [] for w in WORKERS}
    for g in groups:
        w = min(WORKERS, key=lambda w: (len(out[w]) + len(g) > 12, load[w], len(out[w])))
        out[w] += g; load[w] += sum(cost(s) for s in g)
    return out, load

def main():
    # 이미 배정된 목록이 있으면 그 배정(1판 j1~j5)을 그대로 둔다 — 다시 나누면 화면의 「담당」이 바뀐다.
    old = read_json(os.path.join(BASE, 'jobs-jp.json'), None)
    if old and old.get('workers'):
        out = {w: [s for s in lst] for w, lst in old['workers'].items()}; load = {w: 0 for w in out}
    else:
        out, load = assign()
    owner = {s: w for w, lst in out.items() for s in lst}
    owner.update(REWORK)
    items = []
    for (s, name, scene, w, h, layer, desc, hint) in ITEMS:
        assert layer in LAYERS, layer
        items.append(dict(id=s, slug=s, name=name, scene=scene, cells=[w, h], canvas=[w * 16, h * 16], layer=layer, layer_ko=LAYERS[layer][0],
                          description=desc, palette_hint=hint, worker=owner[s]))
        if s in RESIZED:
            items[-1]['resized'] = dict(**{'from': RESIZED[s]['frm']}, why=RESIZED[s]['why'])
        if s in NEW_KINDS:
            items[-1]['added'] = '2026-09-30 자판기 여러 종류(사용자 메모)'
    jobs = dict(version=1, set='jp', note='일본 도시 에셋 배정표. 작업자별 기물 slug 목록(겹침 없음). 절차는 WORKER-JP.md. 팔레트 palette/jp.pal.',
                directions={'A': '강남 조각 결을 따른 판', 'B': '명암·그림자 강화', 'C': '실루엣 재해석'},
                workers=out, items=items)
    atomic_write(os.path.join(BASE, 'jobs-jp.json'), json.dumps(jobs, ensure_ascii=False, indent=1) + '\n')
    cd = os.path.join(BASE, 'candidates-jp')
    for it in items:
        d = os.path.join(cd, it['slug']); os.makedirs(d, exist_ok=True)
        atomic_write(os.path.join(d, 'info.json'), json.dumps(it, ensure_ascii=False, indent=1) + '\n')
        shutil.copyfile(os.path.join(PAL_DIR, 'jp.pal'), os.path.join(d, 'palette.pal'))
    print(len(items), '기물'); [print(' ', w, len(l), '무게', load[w], ' '.join(l)) for w, l in out.items()]

if __name__ == '__main__':
    main()
