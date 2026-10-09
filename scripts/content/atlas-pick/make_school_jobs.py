#!/usr/bin/env python3
"""학원 세트 기물 목록·배정표 tiledata/atlas-pick/jobs-school.json 과 기물 폴더(candidates-school/<slug>/info.json·palette.pal)를 만든다.
  python3 scripts/content/atlas-pick/make_school_jobs.py            # 목록 쓰기 + 폴더 준비(있는 후보 파일은 건드리지 않는다)
기물 = (slug, 이름, 장면, 칸 w×h(16px), 층, 설명, 팔레트 힌트). 작업자 s1…s5 에 겹침 없이 12~14개씩.
층: ground 바닥 불투명 · decal 바닥 덧칠(투명) · object 물체 · wall 벽 걸이 · facade 벽면·건물 외관(불투명 허용) · over 공중.
한국·일본 학원물 공용 — 글자는 숫자·기호·「2-1」 같은 반 번호만(한글·가나 낱말 금지: 두 나라에 다 써야 한다).
호러 세트는 이 목록의 기물을 부순 판을 broken_<slug> 로 따로 만든다. 여기 slug 에는 broken_ 을 쓰지 않는다."""
import json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

C, H, SP, GY, OUT, CAF, DORM = '교실', '복도·현관', '특별실', '체육관', '옥상·운동장·교문', '급식실·매점', '기숙사'
OUTDOOR = {OUT}   # 맥락 그림: 밖이면 현대 시트 보도·아스팔트, 안이면 v5 밝은 널마루·회벽 (school_context.py)
# (slug, 이름, 장면, w, h, 층, 설명, 팔레트 힌트)
ITEMS = [
    # ── 교실 ──
    ('desk_set', '학생 책상·의자', C, 1, 2, 'object', '1인용 학생 책상(윗칸)과 그 앞 의자(아랫칸)를 한 벌로. 책상 = 밝은 합판 상판(윗면이 높이의 ¾ 가까이 보이게) + 가는 쇠 다리 넷 + 상판 밑 서랍칸 어두운 틈. 의자 = 등받이가 책상 쪽(위)을 향해 학생이 칠판(위)을 보고 앉는 방향 — 합판 좌판·등판, 쇠 다리. 교실에 5×6 으로 줄지어 깐다: 좌우로 붙여 놓아도 옆 책상과 겹치지 않게 좌우 1px 여백.', 'vpine/cfloor 상판·좌판, locker/mmetal 다리, 그림자 ~ -'),
    ('desk_pair', '두 사람 책상(짝꿍)', C, 2, 2, 'object', '둘이 나란히 앉는 긴 책상 하나 + 의자 둘(한국 옛 교실·일본 특별실). 상판 가운데 이음 선 한 줄, 의자 둘은 같은 높이. desk_set 과 같은 재료·명암 방식.', 'vpine 상판, locker 다리'),
    ('lectern', '교탁', C, 2, 2, 'object', '칠판 앞 교사용 교탁. 허리 높이 나무 상자 — 윗면(경사진 판 + 출석부·분필 상자 한 점)과 학생 쪽 앞면(판자 두 칸, 가운데 세로 이음)이 명도로 확실히 나뉜다. 상자형이니 윗면 띠가 반드시 보여야 한다.', 'vwood/vdwood 몸통, washi 출석부, vwhite 분필'),
    ('teacher_platform', '교단', C, 3, 1, 'object', '칠판 앞 한 뼘 높이 나무 단(교단). 윗면 = 널 세 장 가로 결, 앞 턱 = 2~3px 어두운 띠. 좌우로 이어 붙일 수 있게 양 끝 모양 같게(가운데 칸 반복 가능).', 'cfloor 윗면, vdwood 앞 턱'),
    ('blackboard', '녹색 칠판', C, 4, 2, 'wall', '벽에 붙는 녹색 칠판. 알루미늄 틀(윗줄·양옆 1~2px), 아래에 분필 받침 턱(분필 두세 토막·지우개 하나). 판 면에 분필로 쓴 흐린 줄 두세 개·숫자 「1 2 3」 정도 — 판 명도는 두 단 이내로 잔잔하게, 지운 자국 옅게.', 'kokuban 판, mmetal/tray 틀, vwhite·washi·vyellow 분필'),
    ('whiteboard', '화이트보드', C, 3, 2, 'wall', '벽걸이 화이트보드. 은색 틀, 아래 펜 받침(검정·빨강·파랑 펜 점), 판 면에 마커 선 한두 줄과 붙은 자석 하나. blackboard 와 같은 높이 규칙(틀 두께·받침 위치 같게) — 짝.', 'wboard 판, mmetal 틀, vblack·vred·vblue 펜'),
    ('bulletin_board', '게시판', C, 2, 2, 'wall', '교실 뒤 코르크 게시판. 나무 틀, 코르크 면에 종이 네다섯 장(흰색·연노랑·연분홍, 크기 다르게, 살짝 기울게)과 빨강·파랑 압정 점. 종이 위 글줄은 1px 흐린 줄.', 'cork 면, vdwood 틀, washi·vyellow·sakura 종이'),
    ('locker_row', '교실 뒤 사물함', C, 2, 2, 'object', '교실 뒤 벽에 붙은 칸 사물함 2단×4열(한 칸 = 8px 폭). 칸마다 문 손잡이 점·번호표 흰 점, 한두 칸은 가방·체육복 끝이 삐져나옴. 윗면 띠 1~2px, 앞면이 주인공. 좌우로 이어 붙게 양 끝 같게.', 'locker 쇠 또는 vpine 나무, uniform 가방, jersey 체육복'),
    ('class_clock', '교실 둥근 시계', C, 1, 1, 'wall', '칠판 위 둥근 벽시계. 흰 판·검은 테, 굵은 시침·분침(2px, 10시 10분쯤), 12·3·6·9 자리 점. 16px 안에서 원이 찌그러지지 않게.', 'vwhite 판, vblack 테·바늘'),
    ('class_speaker', '교실 스피커·TV', C, 2, 1, 'wall', '칠판 옆 위 벽에 달린 벽걸이 TV(짙은 화면 + 은색 테) 와 옆 작은 방송 스피커(격자 구멍). 화면에 창 빛 반사 사선 한 줄.', 'mdglass 화면, mmetal 테, cream 스피커'),
    ('class_window', '교실 창(커튼)', C, 2, 2, 'wall', '교실 바깥벽 창 한 칸. 알루미늄 미닫이 두 짝(가운데 세로 겹침 틀), 유리에 하늘·반사 사선, 한쪽에 묶은 크림색 커튼, 아래 창턱. 좌우로 여러 칸 이어 붙게(양 끝 틀 반쪽씩). 창가 자리 분위기.', 'mglass 유리, mmetal 틀, cream/vlinen 커튼, & 유리 반사'),
    ('cleaning_locker', '청소도구함', C, 1, 2, 'object', '교실 구석 쇠 청소도구함. 키 큰 좁은 상자 — 앞면 문 하나(환기 가로 틈 서너 줄·손잡이), 윗면 띠 1px, 문 위에 빗자루 끝이 삐죽 보여도 좋다. 옆에 둘 양동이 없이 상자만.', 'locker 몸통, mmetal 손잡이'),
    ('classroom_floor', '교실 마루', C, 1, 1, 'ground', '교실 바닥 널마루 한 칸 — 세로 또는 가로 널 결, 널 이음 어두운 선, 사방으로 이어 붙여도 무늬가 튀지 않게(가장자리 이음 맞춤). v5 밝은 널마루보다 조금 노란 꿀빛, 명도는 가구와 분리되게 한 단 낮게.', 'cfloor'),
    ('classroom_wall', '교실 벽면', C, 1, 2, 'facade', '교실 안쪽 벽 한 칸(윗칸 크림 회벽 + 아랫칸 나무 징두리판·걸레받이). 좌우로 이어 붙는다. 맨 아래 줄 = 바닥과 만나는 걸레받이 어두운 줄. 칠판·게시판·창이 이 위에 걸린다.', 'cream 벽, vpine/vdwood 징두리'),
    # ── 복도·현관 ──
    ('shoe_locker', '신발장(실내화장)', H, 2, 2, 'object', '현관 신발장 — 작은 칸 3단×4열, 칸마다 실내화(흰 몸통·색 코 부분 점) 또는 운동화가 앞코만 보이게, 빈 칸 한두 개. 나무 또는 쇠, 윗면 띠 1~2px. 좌우로 이어 붙게.', 'hinoki/vpine 또는 locker, vwhite 실내화, vgreen·vblue·vred 코'),
    ('slippers', '실내화 한 켤레', H, 1, 1, 'object', '바닥에 놓인 실내화 한 켤레(흰 몸통·학년색 고무 코·뒤꿈치). 16px 안 가운데 아래, 발치 그림자 1줄.', 'vwhite, vgreen/vblue/vred 코'),
    ('genkan_step', '현관 발판(스노코)', H, 2, 1, 'object', '현관 신발 벗는 자리의 나무 발판(가로 널 네 장, 틈 사이 어두운 줄, 낮은 다리). 윗면이 거의 전부, 앞 턱 1~2px. 좌우 이어 붙게.', 'hinoki 널, vdwood 틈'),
    ('hall_floor', '복도 리놀륨', H, 1, 1, 'ground', '복도 바닥 리놀륨 한 칸 — 회녹색 면에 옅은 반사 얼룩, 이음 선 한 줄(가로). 사방 이음 맞춤. 광택은 작게, 두세 단만.', 'lino'),
    ('hall_wall', '복도 벽면', H, 1, 2, 'facade', '복도 쪽 벽 한 칸(윗칸 크림 벽, 아랫칸 허리 높이까지 연녹색 또는 회색 페인트 징두리 + 걸레받이). classroom_wall 과 높이 규칙 같게(이어 붙여 교실 벽→복도 벽). 좌우 이어 붙는다.', 'cream 윗벽, lino/locker 징두리'),
    ('hall_window', '복도 창', H, 2, 2, 'wall', '복도 쪽 교실 벽의 가로로 긴 창(허리 위). 미닫이 유리 두 짝, 안쪽 교실이 흐리게 비친다(책상 윗면 줄 흐릿). class_window 보다 창턱이 낮고 커튼 없음.', 'mglass/mdglass, mmetal 틀, & 반사'),
    ('hall_door', '교실 미닫이 문', H, 2, 2, 'facade', '복도에서 교실로 드는 나무 미닫이 문 한 짝 + 문틀. 위쪽에 작은 유리창(세로 긴 네모), 손잡이 홈. hall_wall 과 같은 높이·걸레받이 줄로 이어진다.', 'vpine/hinoki 문, mglass 창, cream 틀벽'),
    ('class_plate', '학급 표찰', H, 1, 1, 'wall', '교실 문 위 복도로 튀어나온 반 이름 표찰 — 흰 판 옆모습이 아니라 앞에서 본 가로판에 「2-1」(숫자 2px 획). 받침 쇠 1px.', 'vwhite 판, vblack 글자, mmetal 받침'),
    ('exit_sign', '비상구 표지', H, 1, 1, 'wall', '초록 비상구 유도등 — 초록 판에 흰 달리는 사람과 문 모양(실루엣으로 읽히게 과장), 테두리 밝게(불 켜진 느낌).', 'vgreen 또는 mgreen 판, vwhite 사람'),
    ('fire_hydrant', '소화전함', H, 1, 2, 'wall', '복도 벽에 박힌 빨간 옥내 소화전함 — 윗칸 빨간 표시등(둥근 점) + 아랫칸 빨간 문(손잡이, 가운데 흰 가로 띠). 벽에 붙은 그늘 한 줄.', 'mred/vred 몸통, vwhite 띠, vyellow 표시등 빛'),
    ('water_fountain', '복도 세면대', H, 2, 2, 'object', '복도 끝 긴 세면대 — 스테인리스 개수대에 수도꼭지 세 개(작은 은색 T), 뒤 벽 타일 한 줄, 개수대 안 어두운 물 고임. 윗면이 넓게 보이는 각.', 'tray 개수대, stile 타일, mglass 물'),
    ('tile_floor', '타일 바닥', H, 1, 1, 'ground', '화장실·과학실·급식실 흰 타일 바닥 한 칸 — 8px 네모 넷, 줄눈 회색 1px, 한 장만 살짝 어둡게(단조로움 깨기). 사방 이음 맞춤.', 'stile'),
    # ── 특별실 ──
    ('lab_bench', '과학실 실험대', SP, 3, 2, 'object', '검은 상판 실험대 — 가운데 작은 개수대·수도꼭지, 가스 꼭지 두 개, 비커·플라스크 한두 점(유리 반사 1px). 몸통은 흰 나무 서랍장, 윗면이 높이의 ¾.', 'vblack 상판, vwhite/cream 몸통, mglass 비커'),
    ('lab_cabinet', '약품장', SP, 2, 2, 'object', '과학실 유리문 약품장(키 큰 장) — 유리 두 짝 뒤에 갈색·투명 병이 두 선반, 아래 나무 문 서랍. 앞면이 주인공, 윗판 1~2px.', 'vwood 틀, mglass 유리, & 반사, vbrass 병'),
    ('skeleton_model', '인체 골격 모형', SP, 1, 2, 'object', '받침대 위에 매달린 골격 모형. 실루엣으로 읽혀야 한다 — 큰 두개골(과장), 갈비 3~4줄, 골반, 팔다리 뼈 1px. 쇠 받침대·바퀴 다리. 섬뜩하지 않게 교과서 모형처럼 흰 뼈 + 연한 그늘.', 'vlinen/vwhite 뼈, mmetal 받침'),
    ('grand_piano', '음악실 그랜드 피아노', SP, 3, 2, 'object', '뚜껑을 연 검정 그랜드 피아노(위에서 약간 내려다본 각) — 날개 모양 몸통, 열린 뚜껑 받침대, 앞쪽 흰 건반 줄(검은 건반 점), 의자 하나. 광택은 빛 쪽 가장자리 한 줄로만.', 'vblack 몸통, vwhite 건반'),
    ('music_stand', '보면대', SP, 1, 1, 'object', '가는 쇠 보면대 — 기울어진 검은 받침판(악보 흰 종이 한 장), 가는 기둥, 세 발. 16px 안에서 판이 읽히게.', 'vblack/mmetal, washi 악보'),
    ('composer_frames', '음악가 초상 액자 줄', SP, 3, 1, 'wall', '음악실 벽 위 초상 액자 세 개(금·나무 틀). 얼굴은 알아볼 수 없어도 된다 — 흰 가발 머리 덩이·어두운 옷 덩이 두 단. 세 액자 머리 모양을 다르게.', 'vbrass/vwood 틀, vlinen 얼굴, vwhite 머리'),
    ('easel', '미술실 이젤', SP, 1, 2, 'object', '나무 이젤(세 다리 A자) 위 캔버스 — 캔버스에 풍경 붓 자국(하늘색·초록 덩이 두세 개), 받침 턱에 붓 하나. 다리 2px.', 'vpine 이젤, vwhite 캔버스, vblue·vgreen·vyellow 물감'),
    ('plaster_bust', '석고상', SP, 1, 2, 'object', '미술실 받침대 위 흰 석고 흉상 — 곱슬머리 덩이, 코·턱 그늘 한 단, 어깨 끝 잘린 면. 받침대 = 네모 기둥(윗면 띠). 흰색 3~4단으로 입체감.', 'vwhite/vlinen 석고, vstone 받침 또는 vpine'),
    ('library_shelf', '도서실 책장', SP, 2, 2, 'object', '키 큰 도서실 책장(3단) — 단마다 색 다른 책등(빨·파·초·노 낮은 채도, 높이 들쭉날쭉, 기울어진 책 하나), 번호 라벨 흰 점 줄. 앞면이 주인공, 윗판 1px. 좌우 이어 붙게.', 'vpine/vwood 장, vred vblue vgreen vyellow 책등'),
    ('library_counter', '대출 데스크', SP, 3, 2, 'object', '도서실 대출 카운터 — 긴 나무 카운터(윗면에 도장·반납 책 더미·작은 모니터), 앞면 판자와 「반납」 대신 책 아이콘 표지. 윗면 ¾.', 'vpine 카운터, mdglass 모니터, washi 책'),
    ('nurse_bed', '보건실 침대', SP, 1, 2, 'object', '보건실 쇠 침대 — 흰 시트, 베개(윗칸), 발치 쇠 난간, 접힌 담요 한 장. 높이 낮은 가구라 윗면(시트)이 높이의 ¾.', 'vwhite/vlinen 시트, locker/mmetal 틀, jersey 담요'),
    ('privacy_screen', '보건실 칸막이 커튼', SP, 2, 2, 'object', '침대 옆 바퀴 달린 칸막이(쇠 틀에 연한 커튼 천) — 천 주름 세로 결 3~4줄, 아래 바퀴 발 넷. nurse_bed 옆에 세운다(짝, 같은 흰 색 계열).', 'vlinen/cream 천, mmetal 틀'),
    ('height_scale', '신장계', SP, 1, 2, 'object', '보건실 신장계 — 세로 눈금 기둥(1px 눈금 줄), 위 가로 누름판, 아래 발판(윗면 보이게). 기둥이 캔버스 위까지 길게.', 'vwhite 기둥, vblack 눈금, mmetal 판'),
    ('staff_desks', '교무실 책상 섬', SP, 2, 2, 'object', '교무실 쇠 책상 두 개를 마주 붙인 섬 — 윗면에 서류 더미·머그컵·모니터 뒷면, 사이 칸막이 낮은 판. 윗면 ¾, 회색 쇠 몸통.', 'locker 책상, cream 칸막이, washi 서류, mdglass 모니터'),
    ('copier', '복사기', SP, 1, 2, 'object', '교무실 복사기 — 윗면 유리판 뚜껑·조작판(작은 초록 불 점), 몸통 앞 종이 서랍 두 칸, 옆 배출 받침에 종이 한 장. 상자형이니 윗면이 보여야 한다.', 'mwhite/cream 몸통, locker 서랍, vgreen 불'),
    ('broadcast_desk', '방송실 조정대', SP, 3, 2, 'object', '방송실 조정 책상 — 믹서(슬라이더 줄 1px·노브 점), 목이 휜 마이크 하나, 작은 모니터 둘, 헤드폰. 윗면 ¾, 불빛 점은 작고 한두 색만.', 'vblack/locker 믹서, mmetal 마이크, mdglass 모니터, vred·vgreen 불'),
    # ── 체육관 ──
    ('basketball_hoop', '농구 골대', GY, 2, 3, 'object', '체육관 이동식 농구 골대 — 흰 백보드(빨간 네모 테), 주황 링·흰 그물(1px 엇갈림), 굵은 받침 기둥과 뒤로 뻗은 바닥 받침(바퀴). 실루엣으로 링·보드가 또렷해야 한다.', 'vwhite 보드, vred 테, vred·vyellow 링, locker 기둥'),
    ('gym_mat', '체육 매트', GY, 2, 2, 'object', '바닥에 깐 두툼한 체육 매트 — 파랑 비닐, 가장자리 두께 2~3px(앞면 어둡게), 윗면에 누빔 선 두세 줄, 손잡이 끈. 겹쳐 쌓은 두 장이어도 좋다.', 'gmat'),
    ('vaulting_box', '뜀틀', GY, 2, 2, 'object', '뜀틀 — 나무 단 네다섯 층(층마다 이음 어두운 줄, 옆 손잡이 구멍), 맨 위 흰 가죽 쿠션. 위에서 약간 내려다본 각으로 윗면 쿠션이 보이게.', 'hinoki/vpine 단, vwhite/vlinen 쿠션'),
    ('ball_basket', '공 바구니', GY, 1, 1, 'object', '쇠 바구니 수레에 담긴 공(농구공 주황 점·배구공 흰 점) — 바구니 격자 1px, 바퀴 점.', 'mmetal 바구니, vred·vyellow·vwhite 공'),
    ('gym_floor', '체육관 마루', GY, 1, 1, 'ground', '체육관 바닥 한 칸 — 밝은 단풍나무 널(가로 결, 가는 이음), 바니시 광 한 줄. 사방 이음 맞춤. classroom_floor 보다 밝고 노랗다.', 'gym'),
    ('gym_line', '코트 선', GY, 1, 1, 'decal', '체육관 마루 위 코트 선 덧칠 — 가로 2px 흰 선(또는 초록·빨강 선) 한 칸. 좌우로 이어 붙게 선 높이 가운데 고정. 투명 배경.', 'vwhite, vgreen, vred'),
    # ── 옥상·운동장·교문 ──
    ('roof_fence', '옥상 펜스', OUT, 1, 2, 'object', '옥상 가장자리 녹색 철망 펜스 한 칸 — 기둥(왼쪽 2px), 위·아래 가로대, 사이 마름모 철망(1px 사선 엇갈림, 뒤가 비친다 — 철망 사이는 투명). 좌우로 이어 붙는다(오른쪽은 다음 칸 기둥이 닫는다).', 'fence'),
    ('roof_floor', '옥상 바닥', OUT, 1, 1, 'ground', '옥상 녹색 방수 페인트 콘크리트 바닥 한 칸 — 칠 벗겨진 회색 얼룩 한두 점, 배수 줄눈. 사방 이음 맞춤.', 'fence/lino 녹색 면, mconc 벗겨진 곳'),
    ('water_tank', '옥상 물탱크', OUT, 3, 3, 'object', '옥상 물탱크 — 쇠 받침 다리 위 원통 또는 네모 FRP 탱크(패널 이음 줄), 윗면 맨홀 뚜껑, 옆 사다리. 3×3 안에 크게, 위에서 약간 내려다본 각(윗면 띠 넓게).', 'stile/cream 탱크, locker 다리·사다리'),
    ('roof_stairhouse', '옥상 계단실 문', OUT, 2, 3, 'facade', '옥상으로 나오는 계단실 벽 — 콘크리트 벽에 쇠 문 한 짝(작은 유리창·손잡이), 위 처마 턱, 문 위 작은 등. 맨 아래 줄 = 옥상 바닥과 만나는 줄.', 'mconc 벽, locker 문, mglass 창'),
    ('school_gate', '교문', OUT, 4, 3, 'object', '학교 정문 — 양쪽 돌/콘크리트 문기둥(왼쪽 기둥에 교명판 = 글자 대신 가로 줄 두 개의 판), 사이에 낮은 쇠 미닫이 문(세로 살), 기둥 머리 등. 4칸 폭 중 가운데 2칸이 문.', 'mgran/mconc 기둥, mmetal 문, vbrass 교명판'),
    ('bike_rack', '자전거 거치대', OUT, 3, 2, 'object', '지붕 없는 쇠 거치대에 세운 자전거 두 대(바퀴 원 두 개·안장·핸들, 등교용 바구니). 바퀴는 1px 원이 찌그러지지 않게, 거치대 쇠틀 줄.', 'mmetal 거치대, vblack 바퀴, vblue·vred 몸통'),
    ('schoolyard', '운동장 흙', OUT, 1, 1, 'ground', '운동장 마사토 한 칸 — 옅은 흙에 모래알 점 두세 단, 발자국 흔적 하나. 사방 이음 맞춤. 보도·아스팔트와 명도 분리.', 'undo'),
    ('track_line', '트랙 흰 선', OUT, 1, 1, 'decal', '운동장 흙 위 석회 흰 선 — 2px 가로 선, 가장자리 가루 번짐 점. 좌우 이어 붙게, 투명 배경.', 'vwhite, washi'),
    ('soccer_goal', '축구 골대', OUT, 4, 2, 'object', '운동장 축구 골대 — 흰 쇠 기둥·가로대(2px), 뒤로 처진 그물(1px 격자, 사이 투명), 바닥 뒤 받침대. 폭 4칸 전부.', 'vwhite 기둥, vlinen 그물'),
    ('assembly_podium', '조회대', OUT, 3, 2, 'object', '운동장 앞 조회대(구령대) — 콘크리트 단(앞 계단 두 줄), 위 작은 쇠 난간, 가운데 마이크 스탠드. 윗면이 보이는 각.', 'mconc 단, mmetal 난간'),
    # ── 급식실·매점 ──
    ('cafeteria_table', '급식 식탁', CAF, 3, 2, 'object', '급식실 긴 식탁 + 양옆 긴 의자(또는 둥근 의자 넷) — 흰 상판(윗면 ¾), 쇠 다리. 식판을 올려놓을 자리를 비워 둔다.', 'vwhite/cream 상판, locker 다리'),
    ('meal_tray', '식판', CAF, 1, 1, 'object', '스테인리스 식판 한 개 — 칸 다섯(밥 흰색·국 주황·반찬 초록·빨강 점), 옆 숟가락. 탁상 물건이라 16px 안에 작게(발치 그림자 없이 받침 그늘 1px).', 'tray 식판, vwhite 밥, vred·vgreen·vyellow 반찬'),
    ('serving_counter', '배식대', CAF, 3, 2, 'object', '급식 배식대 — 스테인리스 긴 대에 뚜껑 연 배식통 셋(밥·국·반찬, 김 1px 흰 점 약간), 국자 하나, 앞 유리 가림막. 윗면 ¾.', 'tray 대·통, & 가림막 유리, vwhite 밥'),
    ('kiosk_counter', '매점 판매대', CAF, 3, 2, 'object', '매점 판매대 — 유리 진열장 안 빵 봉지·삼각김밥 흰 삼각 점, 위에 과자 상자, 옆 작은 계산대. 봉지 색은 작고 낮은 채도.', 'vpine/cream 대, mglass 진열, vyellow·vred 봉지'),
    ('milk_crate', '우유 상자', CAF, 1, 1, 'object', '플라스틱 우유 상자(파랑 또는 빨강 격자 옆면)에 흰 우유갑 줄 윗면. 윗면이 보이는 각, 모서리 둥글게.', 'vblue/vred 상자, vwhite 우유갑'),
    ('vending_school', '급식실 음료 자판기', CAF, 1, 2, 'object', '매점 옆 작은 음료 자판기(학교형: 우유·주스 견본 두 줄) — 흰 몸통, 윗면 띠, 견본창 밝게, 꺼내는 입구 어둡게. 일본 세트 음료 자판기와 같은 높이 규칙.', 'mwhite 몸통, mglass 창, vblue·vyellow 견본'),
    # ── 기숙사 ──
    ('bunk_bed', '이층 침대', DORM, 2, 3, 'object', '나무 또는 쇠 이층 침대 — 위 칸·아래 칸 매트리스·베개·이불(색 다르게), 옆 사다리, 기둥 2px. 키 큰 가구라 앞면이 주인공, 위 칸 이불 윗면 띠.', 'vpine/locker 틀, vlinen 매트리스, vblue·sakura 이불'),
    ('dorm_desk', '기숙사 책상', DORM, 2, 2, 'object', '기숙사 책상 + 위 책꽂이 선반 — 선반에 책 네다섯, 상판에 스탠드(휜 목·불빛 점)·노트, 의자 등받이가 앞에 보인다. 윗면 ¾.', 'vpine 책상, vred vblue 책, vyellow 불빛, % 번짐 금지(탁상)'),
    ('dorm_closet', '기숙사 옷장', DORM, 1, 2, 'object', '좁은 붙박이 옷장 — 두 짝 문(가운데 틈·손잡이 둘), 위 선반 문, 문 한쪽에 교복 걸이가 비친다면 틈으로 감색 한 줄. 앞면 주인공, 윗판 1px.', 'vpine/cream 문, uniform 교복'),
    ('dorm_rug', '기숙사 깔개', DORM, 2, 2, 'decal', '침대 사이 바닥 깔개 — 연한 줄무늬 면 깔개, 가장자리 술 1px. 투명 배경(마루 위 덧칠). 채도 낮게.', 'vlinen, sakura, vblue'),
]

PAIRS = [   # 짝·세트 = 한 작업자. (같은 방향 글자끼리 한 식구로 보여야 하는 것)
    ('blackboard', 'whiteboard'),
    ('desk_set', 'desk_pair'),
    ('lectern', 'teacher_platform'),
    ('classroom_floor', 'classroom_wall'),
    ('hall_floor', 'hall_wall', 'hall_door'),
    ('class_window', 'hall_window'),
    ('shoe_locker', 'slippers', 'genkan_step'),
    ('class_plate', 'exit_sign'),
    ('lab_bench', 'lab_cabinet'),
    ('grand_piano', 'music_stand'),
    ('easel', 'plaster_bust'),
    ('library_shelf', 'library_counter'),
    ('nurse_bed', 'privacy_screen'),
    ('staff_desks', 'copier'),
    ('gym_floor', 'gym_line'),
    ('schoolyard', 'track_line'),
    ('roof_fence', 'roof_floor'),
    ('cafeteria_table', 'meal_tray'),
    ('bunk_bed', 'dorm_desk', 'dorm_closet'),
]
WORKERS = ['s1', 's2', 's3', 's4', 's5']
CAP = 14

def cost(it):
    w, h, layer = it[3], it[4], it[5]
    return w * h + (3 if layer == 'facade' else 0) + (2 if layer == 'ground' else 0)   # 큰 칸·이음 맞춤(바닥·벽면)은 무겁다

def assign():
    by = {i[0]: i for i in ITEMS}; groups = []; used = set()
    for g in PAIRS:
        for s in g: assert s in by and s not in used, s
        groups.append(list(g)); used |= set(g)
    groups += [[i[0]] for i in ITEMS if i[0] not in used]
    groups.sort(key=lambda g: (-sum(cost(by[s]) for s in g), g[0]))
    load = {w: 0 for w in WORKERS}; out = {w: [] for w in WORKERS}; scenes = {w: {} for w in WORKERS}
    for g in groups:
        sc = by[g[0]][2]
        # 넘치지 않게 → 무게 적은 쪽 → 같은 장면이 이미 많은 쪽은 피한다(장면이 한 사람에게 몰리지 않게)
        w = min(WORKERS, key=lambda w: (len(out[w]) + len(g) > CAP, load[w] + 2 * scenes[w].get(sc, 0), len(out[w])))
        out[w] += g; load[w] += sum(cost(by[s]) for s in g); scenes[w][sc] = scenes[w].get(sc, 0) + len(g)
    return out, load

def main():
    slugs = [i[0] for i in ITEMS]
    assert len(slugs) == len(set(slugs)), '중복 slug'
    assert not any(s.startswith('broken_') for s in slugs), 'broken_ 은 호러 세트 몫'
    out, load = assign()
    owner = {s: w for w, lst in out.items() for s in lst}
    pair_of = {s: [x for x in g if x != s] for g in PAIRS for s in g}
    items = []
    for (s, name, scene, w, h, layer, desc, hint) in ITEMS:
        assert layer in LAYERS, layer
        items.append(dict(id=s, slug=s, name=name, scene=scene, place='out' if scene in OUTDOOR else 'in',
                          cells=[w, h], canvas=[w * 16, h * 16], layer=layer, layer_ko=LAYERS[layer][0],
                          description=desc, palette_hint=hint, pair=pair_of.get(s, []), worker=owner[s]))
    jobs = dict(version=1, set='school',
                note='학원(한국·일본 학원물 공용) 16px 조각 배정표. 작업자별 기물 slug 목록(겹침 없음, 짝은 한 사람). 절차 WORKER-SCHOOL.md. 팔레트 palette/school.pal. '
                     '호러 세트의 broken_<slug> 는 이 목록 밖(candidates-horror).',
                directions={'A': 'v5 실내·강남 조각 결을 따른 판', 'B': '명암·그림자 강화', 'C': '실루엣 재해석'},
                workers=out, items=items)
    atomic_write(os.path.join(BASE, 'jobs-school.json'), json.dumps(jobs, ensure_ascii=False, indent=1) + '\n')
    cd = os.path.join(BASE, 'candidates-school')
    for it in items:
        d = os.path.join(cd, it['slug']); os.makedirs(d, exist_ok=True)
        atomic_write(os.path.join(d, 'info.json'), json.dumps(it, ensure_ascii=False, indent=1) + '\n')
        shutil.copyfile(os.path.join(PAL_DIR, 'school.pal'), os.path.join(d, 'palette.pal'))
    print(len(items), '기물')
    for w, l in out.items():
        print(' ', w, len(l), '무게', load[w], ' '.join(l))

if __name__ == '__main__':
    main()
