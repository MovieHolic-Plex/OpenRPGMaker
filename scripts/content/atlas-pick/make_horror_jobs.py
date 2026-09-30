#!/usr/bin/env python3
"""호러 세트 기물 목록·배정표 (2판: 1단계 기본 FOUNDATION + 1판 ITEMS 는 1단계 옮김/2단계 연출로) tiledata/atlas-pick/jobs-horror.json 과 기물 폴더(candidates-horror/<slug>/info.json·palette.pal·ref-v5-*.png)를 만든다.
  python3 scripts/content/atlas-pick/make_horror_jobs.py            # 목록 쓰기 + 폴더 준비(있는 후보 파일은 건드리지 않는다)
기물 = (slug, 이름, 장면, 칸 w×h(16px), 층, 설명, 팔레트 힌트, v5 원본 id 목록). 작업자 h1…h5 에 겹침 없이, 짝·세트는 한 사람에게.
층: ground 바닥 불투명 · decal 바닥 덧칠(투명) · object 물체 · wall 벽 걸이 · facade 벽면·외관(불투명 허용) · over 공중 덮개(어둠·안개·거미줄).
결 = 16px 손 도트 실내 v5(tiledata/hand-interior/v5) 칩셋 식구. v5 원본이 있는 기물은 「낡은 판」: v5 칸 크기 그대로(갈아 끼울 수 있게),
원본 그림을 폴더에 ref-v5-<k>.png(원 크기)·ref-v5-<k>-x4.png 로 둔다(우리 자산 — 보고 결을 맞춘다).
폐교 기물은 학원(school) 세트 slug 와 겹치지 않게 broken_ 접두. 교실·복도 기본 기물은 학원 세트가 맡고 여기는 망가진·피 묻은 판만."""
import json, os, shutil, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

V5 = os.path.join(ROOT, 'tiledata/hand-interior/v5')
V5_PICK = os.path.join(ROOT, 'tiledata/hand-interior/pick/candidates')
S_MAN, S_HOS, S_SCH, S_GRV, S_FX = '낡은 서양 저택', '폐병원', '폐교 복도', '밤 숲·묘지', '연출'
# (slug, 이름, 장면, w, h, 층, 설명, 팔레트 힌트, v5 원본 id)
ITEMS = [
    # ── 낡은 서양 저택 ──
    ('floor_creaky', '삐걱 마루(낡은 판)', S_MAN, 2, 2, 'ground', 'v5 짙은 마루의 낡은 판: 가로 널 줄(널 폭 4px), 널 사이 틈 한 단 어둡게, 군데군데 들뜬 널 끝(한 줄 밝은 모서리), 옹이·물 얼룩 한두 점, 먼지 낀 틈. 2×2 가 사방으로 이어 붙는다(가장자리 널 줄이 맞게). 무늬가 고르게 반복되면 실패 — 한 칸 안에 들뜬 널은 하나만.', 'rot 널, void 틈, dust 먼지', ['floor:dplank', 'floor:boards']),
    ('floor_creaky_broken', '꺼진 마루(구멍)', S_MAN, 2, 2, 'ground', 'floor_creaky 와 같은 널 줄 위에 가운데가 부서져 내려앉은 구멍 하나(가장자리 널이 부러진 톱니 끝, 구멍 속은 void 로 깊게, 위쪽 가장자리 아래로 널 두께 한 줄 보임). 바깥 테두리는 floor_creaky 와 그대로 이어진다. 밟으면 떨어지는 함정 칸.', 'rot 널, void 구멍, dust', ['floor:dplank']),
    ('wall_paper_torn', '찢긴 벽지 벽', S_MAN, 2, 2, 'facade', 'v5 회벽 벽면(2줄 벽)의 저택 판: 위 1줄 반 = 빛바랜 벽지(세로 줄무늬 또는 다마스크 꽃 무늬, 무늬 반복 8px), 아래 반 줄 = 썩은 나무 징두리 판(가로 테 한 줄 밝게). 벽지 한 곳이 찢겨 너덜한 조각이 아래로 말려 있고 속 회벽(dust)이 드러난다. 칸 전부 불투명. 좌우로 이어 붙는다(무늬·징두리가 맞게).', 'paper 벽지, damask 무늬, rot 징두리, dust 속 회벽', ['wall:plaster']),
    ('wall_paper_stain', '곰팡이·얼룩 벽지 벽', S_MAN, 2, 2, 'facade', 'wall_paper_torn 과 같은 벽지·징두리에 찢김 대신 위에서 흘러내린 물 얼룩(세로 번짐 두 줄)과 구석 곰팡이 점 덩이(hmoss). 두 벽을 섞어 깔 수 있게 무늬·징두리 높이가 같아야 한다. 칸 전부 불투명.', 'paper, damask, rot, hmoss 곰팡이', ['wall:plaster']),
    ('portrait_eyes', '초상화(눈이 따라오는)', S_MAN, 1, 2, 'wall', '금테(녹청 낀 놋쇠) 세로 액자 속 여인 초상: 어두운 배경, 창백한 얼굴 타원, 검은 머리, 두 눈만 또렷한 점(흰자 1px). 액자 테 윗변·왼변 한 단 밝게. v5 그림(1×1)을 1×2 로 키운 판 — 사용자는 큰 것을 원했다.', 'tarn 테, bisque 얼굴, velv/damask 배경, void 머리', ['picture']),
    ('portrait_slashed', '찢긴 초상화', S_MAN, 1, 2, 'wall', 'portrait_eyes 와 같은 액자·같은 크기, 캔버스가 칼로 X 자로 찢겨 속 어둠이 보이고 얼굴 부분이 떨어져 늘어짐. 두 초상을 벽에 나란히 걸면 한 식구로 보이게 액자는 같게.', 'tarn 테, bisque, velv, void 찢긴 속', ['picture']),
    ('mirror_cracked', '금 간 거울', S_MAN, 1, 2, 'object', 'v5 화장대 거울 자리의 낡은 판: 나무 틀 거울(윗부분 둥근 아치), 거울 속은 탁한 청회(murk) + 한가운데서 방사형으로 갈라진 금(1px 밝은 선 + 한 단 어두운 선 짝), 한 조각이 떨어져 비었다. 아래 작은 서랍 받침. 거울 속에 흐릿한 사람 그림자 하나(선택, B·C 에서).', 'mahog 틀, murk 거울, moon 금 반짝임, void 빠진 조각', ['vanity mirror', 'tailor mirror']),
    ('grandfather_clock', '멈춘 괘종시계', S_MAN, 1, 2, 'object', 'v5 괘종시계의 낡은 판(같은 크기): 마호가니 몸통, 윗머리 둥근 박공, 문자판(누런 바탕·바늘 두 개가 한 시각에 멈춤), 아래 유리창 속 멈춘 추(녹청 놋쇠), 유리 한쪽 금. 먼지 쌓인 윗면 한 줄(dust).', 'mahog 몸통, sheet 문자판, tarn 추, murk 유리, dust 윗면', ['clock']),
    ('doll_sitting', '앉은 인형', S_MAN, 1, 1, 'object', '바닥에 다리를 뻗고 앉은 도자기 인형(마녀의 집 결): 창백한 얼굴이 칸 윗부분 절반을 차지할 만큼 크게, 큰 검은 눈 두 점, 금발 또는 검은 머리 덩이, 빛바랜 드레스(velv 또는 바랜 파랑). 목이 살짝 기울어짐. 1×1 에서 「인형」 으로 읽히는 게 먼저 — 머리를 과장.', 'bisque 얼굴, velv/vblue 드레스, vyellow/void 머리, void 눈', ['shelf:toy']),
    ('doll_shelf', '인형 진열장', S_MAN, 1, 2, 'object', 'v5 인형 진열장의 낡은 판(같은 크기): 유리문 진열장 안 선반 세 단에 작은 인형 머리들(창백한 점 덩이 + 눈 점)이 줄지어 이쪽을 봄, 유리 한 장 깨짐, 틀 먼지.', 'mahog 틀, murk 유리, bisque 인형, dust', ['cabinet:toy']),
    ('piano_dusty', '먼지 덮인 피아노', S_MAN, 2, 2, 'object', 'v5 피아노의 낡은 판(같은 칸 2×2, 위 8px 여백): 업라이트 피아노, 뚜껑 열린 건반(흰 건반 줄 사이 검은 건반, 몇 개 빠짐), 윗면 먼지 층(밝은 회백 한 줄 + 손가락 자국), 악보대에 누런 악보 한 장, 촛대 하나. 몸통 앞면이 주인공.', 'mahog 몸통, sheet/dust 건반·먼지, void 검은 건반, tarn 촛대', ['piano']),
    ('sofa_sheet', '흰 천 덮인 소파', S_MAN, 2, 1, 'object', 'v5 소파 자리(2×1)의 폐가 판: 소파 전체를 흰 천이 덮어 윤곽만 보인다(등받이·팔걸이 둥근 덩이), 천 주름 세로 줄 두세 개, 아래 끝이 바닥에 늘어짐, 천 밑으로 다리 끝 하나 보임. 천은 회백 먼지색 — 새하얗게 빛나지 않게.', 'dust 천, rot 다리, ~ 그림자', ['sofa']),
    ('armchair_sheet', '천 덮인 안락의자', S_MAN, 1, 1, 'object', 'sofa_sheet 와 한 식구: v5 안락의자 자리(1×1)에 흰 천을 씌운 판. 등받이가 높은 덩이, 주름 한두 줄. 소파와 같은 천 명암 방식.', 'dust 천, rot 다리', ['armchair']),
    ('canopy_bed_rot', '낡은 닫집 침대', S_MAN, 2, 3, 'object', 'v5 닫집 침대의 낡은 판(같은 칸 2×3): 네 기둥, 윗 닫집 천이 찢겨 한쪽이 늘어짐(너덜한 끝), 침구는 누렇게 바래고 가운데 움푹 꺼짐, 베개 하나 바닥에 떨어짐(선택). 거미줄 한 귀퉁이.', 'mahog 기둥, velv 닫집, sheet 침구, dust 거미줄', ['canopy bed']),
    ('wardrobe_ajar', '반쯤 열린 옷장', S_MAN, 1, 2, 'object', 'v5 옷장의 낡은 판(같은 크기): 두 짝 문 중 오른쪽이 살짝 열려 틈 속이 새까맣다(void 세로 줄 2~3px), 틈 속에 흰 눈 두 점(C 에서만, 선택). 윗면 먼지, 문고리 녹청 놋쇠.', 'mahog 몸통, void 틈, tarn 문고리, dust', ['wardrobe']),
    ('bookshelf_fallen', '쓰러진 책장·흩어진 책', S_MAN, 2, 2, 'object', 'v5 책장 2칸이 앞으로 기울어 넘어진 판: 책장 옆면·윗판이 비스듬히 보이고, 바닥에 쏟아진 책 여러 권(색 다른 작은 네모, 펼쳐진 책 하나). 위에서 약간 내려다본 각을 지켜라 — 누운 책장은 윗판이 아니라 등판이 보인다.', 'mahog 책장, vred/vblue/vgreen 책(한 단 어둡게), sheet 펼친 책장', ['bookshelf 2w']),
    ('candelabra_drip', '촛농 흘린 촛대', S_MAN, 1, 2, 'object', 'v5 큰 촛대의 낡은 판(같은 크기): 녹청 놋쇠 세 가지 촛대, 초 셋 중 하나만 켜짐(작은 불꽃 2~3px + 둘레 빛 번짐 %), 나머지는 녹아 짧아지고 촛농이 줄기를 따라 흘러내림. 받침 둘레 바닥에 촛농 점. 움직임은 없이 한 장.', 'tarn 촛대, wax 초·촛농, flame 불꽃, % 빛 번짐', ['candelabra']),
    ('candle_floor', '바닥 촛불 무리', S_MAN, 1, 1, 'object', '바닥에 직접 세운 짧은 초 셋~넷(높이 다르게), 둘은 켜짐, 촛농이 바닥에 고임, 둘레 바닥에 빛 번짐(%). candelabra_drip 과 같은 불꽃 모양·같은 초 색.', 'wax 초, flame 불꽃, % 빛 번짐', ['candle']),
    ('fireplace_cold', '꺼진 벽난로', S_MAN, 2, 2, 'object', 'v5 벽난로의 낡은 판(같은 칸 2×2): 돌 틀·나무 선반, 아궁이 속 새까만 재와 타다 남은 장작, 아궁이 입구 위 그을음 번짐, 선반 위 먼지와 쓰러진 액자 하나. 불이 없다 — 움직임 없음.', 'vstone 틀, rot 선반, void 아궁이, dust 재·먼지', ['fireplace']),
    ('chandelier_fallen', '떨어진 샹들리에', S_MAN, 2, 2, 'object', '천장에서 떨어져 바닥에 박힌 샹들리에: 휘어진 놋쇠 고리(원이 찌그러진 타원), 흩어진 유리 방울(밝은 점 여럿), 끊어진 사슬 한 줄이 위로 뻗음, 바닥 널이 둘레에 갈라짐(선택). 바닥 기물 — 윗면이 보이는 각.', 'tarn 고리·사슬, moon/murk 유리 방울, void 갈라진 틈', []),
    ('stairs_broken', '부서진 나무 계단', S_MAN, 3, 3, 'object', 'v5 나무 계단(3×3)의 낡은 판: 같은 폭·같은 단 수, 가운데 한두 단이 부러져 구멍(void), 난간 기둥 하나 빠짐, 단 끝 먼지. 올라가는 길이 한쪽으로만 남았다는 게 읽히게.', 'rot 단, mahog 난간, void 구멍, dust', ['stairs up wood']),
    ('door_boarded', '판자로 못질한 문', S_MAN, 1, 2, 'wall', '벽에 붙은 나무 문 위를 판자 두세 장이 X 자·가로로 가로막고 못(1px 밝은 점)이 박힘. 문 틈 아래로 빛이 새지 않고 새까맣다. 벽면(2줄) 앞에 붙는 걸이 — 벽 칸 높이 2줄에 맞춘다.', 'mahog 문, rot 판자, tin 못, void 틈', []),
    ('curtain_torn', '찢긴 커튼 창', S_MAN, 1, 2, 'wall', 'v5 커튼 창(1×1)을 1×2 로 키운 낡은 판: 밤 창(달빛 청회 유리, 창살 십자), 양쪽 벨벳 커튼 중 하나가 찢겨 반쯤 떨어짐, 창 아래 벽에 떨어지는 달빛 번짐(?) 한두 줄.', 'velv 커튼, moon 창빛, rot 창틀, ? 달빛', ['curtained window']),
    ('rug_blood', '핏자국 양탄자', S_MAN, 3, 2, 'decal', 'v5 붉은 양탄자(3×2)의 낡은 판: 가장자리 술 장식, 빛바랜 무늬, 한가운데 오래 마른 검붉은 얼룩 한 덩이(blood 어두운 쪽 + 가장자리 $), 한쪽 모서리가 말려 올라감. 얼룩은 양탄자 면적의 1/6 정도로.', 'velv 바탕, damask 무늬, blood/$ 얼룩', ['rug red']),
    ('music_box', '오르골', S_MAN, 1, 1, 'object', '작은 나무 상자 오르골: 뚜껑이 열려 안쪽 거울·태엽 손잡이(옆), 뚜껑 위 작은 발레리나 인형(한 점 기둥 + 치마 점). 윗면이 보이는 각. 탁자 위에 올려도 되는 크기로 칸 아래쪽 2/3 안에.', 'mahog 상자, murk 거울, tarn 태엽, bisque 인형', []),
    # ── 폐병원 ──
    ('hosp_floor', '병원 바닥 타일(얼룩)', S_HOS, 2, 2, 'ground', '폐병원 바닥: 가로세로 8px 격자 타일(바랜 회녹·누런 회색 두 색이 체크 아닌 한 색 + 줄눈), 군데군데 깨진 타일 하나·물 얼룩·검은 발자국 번짐. 사방으로 이어 붙는다(줄눈 격자가 맞게). 깨진 곳은 한 칸에 하나.', 'ward/sheet 타일, grave 줄눈, void 깨진 틈', ['floor:grey']),
    ('hosp_wall', '병원 벽(벗겨진 페인트)', S_HOS, 2, 2, 'facade', '폐병원 벽면(2줄): 위 = 바랜 회녹 페인트 벽(벗겨져 속 회색이 드러난 얼룩 두세 곳), 아래 1/3 = 짙은 녹 징두리 페인트 + 경계 가로 줄, 발치 걸레받이. 녹물 흐른 자국 한 줄. 칸 전부 불투명, 좌우로 이어 붙는다.', 'ward 페인트, grave 속, rust 녹물', ['wall:plaster']),
    ('hosp_bed', '녹슨 병원 침대', S_HOS, 1, 3, 'object', '위에서 약간 내려다본 쇠 병원 침대(머리 북쪽): 머리판·발판 쇠 파이프 틀(녹 점), 누렇게 바랜 시트가 구겨지고 가운데 검붉은 얼룩 작게, 베개 하나, 다리 끝 바퀴. v5 침대와 같은 칸(1×3 캔버스, 위 10px 여백 = 발 칸 1×2)·같은 시점 — v5 방에 갈아 끼울 수 있게.', 'tin/rust 틀, sheet 시트, blood 얼룩(작게)', ['bed green']),
    ('hosp_screen', '병상 칸막이 커튼', S_HOS, 2, 2, 'object', '병상 사이 칸막이: 가는 쇠 틀(바퀴 달린 받침)에 늘어진 바랜 회녹 커튼 두 폭, 한 폭은 찢겨 아래가 너덜함, 커튼 너머 사람 그림자 실루엣 하나(선택, B·C). hosp_bed 와 한 식구 — 같은 쇠 색.', 'tin 틀, ward/sheet 커튼, void 그림자', []),
    ('iv_stand', '링거 걸이', S_HOS, 1, 2, 'object', '바퀴 다섯 발 받침 위 가는 쇠 기둥, 맨 위 고리에 매단 링거 봉지(반투명 느낌은 밝은 테 + 속 한 단 어둡게, 속 액체는 검붉게 — 수혈 팩), 관이 아래로 늘어짐. 1px 기둥이 먹히지 않게 2px.', 'tin 기둥, murk/sheet 봉지, blood 액체, ~ 그림자', []),
    ('wheelchair', '휠체어', S_HOS, 1, 1, 'object', '빈 휠체어(남쪽을 향해 살짝 비스듬히): 큰 바퀴 두 개가 세로 타원, 앉는 천(바랜 남색 또는 회녹), 등받이 손잡이 두 개, 발판. 한쪽 바퀴가 기울어 녹슮. 1×1 에서 휠체어로 읽혀야 한다 — 안 되면 1×2 로 키우자고 보고.', 'tin/rust 틀, ward/vblue 천, void 바퀴 속', []),
    ('operating_table', '수술대·무영등', S_HOS, 2, 2, 'object', '위에서 약간 내려다본 수술대: 가운데 기둥 받침 위 긴 판(윗면이 주인공), 위에 누런 천이 덮인 사람 윤곽(선택) 또는 검붉은 얼룩 판, 머리 쪽 위에 둥근 무영등(가는 팔로 매단 원판, 전구 점 여러 개 — 꺼짐). 수술 도구 수레(instrument_tray)와 한 식구.', 'tin 대·등, sheet 천, blood 얼룩, murk 등 유리', []),
    ('instrument_tray', '수술 도구 수레', S_HOS, 1, 1, 'object', '바퀴 달린 쇠 수레, 윗판에 쟁반 — 메스·가위·집게(1px 밝은 선 두세 개), 피 묻은 거즈 한 덩이. 윗면이 칸 높이의 절반 이상 보이게.', 'tin 수레·도구, sheet 거즈, blood 얼룩', []),
    ('medicine_cabinet', '약장(깨진 유리)', S_HOS, 1, 2, 'object', '벽 앞에 선 흰 쇠 약장: 윗단 유리문 두 짝(하나 깨져 조각 비었다), 안 선반 세 단에 갈색·초록 약병(작은 세로 네모), 쓰러진 병 하나, 아래단 서랍 둘. 붉은 십자 표시(작게). 키 큰 가구 — 앞면이 주인공, 윗판 1~2px.', 'ward/dust 몸통, murk 유리, vbrown(vwood)/vgreen 약병, blood 십자', ['cupboard']),
    ('morgue_drawer', '영안실 냉동 서랍', S_HOS, 2, 2, 'facade', '벽에 박힌 쇠 냉동 서랍 2×2 칸(네 문, 문마다 손잡이·이름표 판), 그중 하나가 반쯤 열려 흰 천 덮인 발끝이 삐져나옴. 칸 전부 불투명(벽면 블록). 차가운 쇠 광택 = 윗테 한 줄 밝게.', 'tin 문, grave 벽, sheet 천, bisque 발끝(작게)', []),
    ('xray_viewer', '엑스레이 판독기', S_HOS, 1, 1, 'wall', '벽에 붙은 판독 상자: 흰 빛 판(깜빡이다 멈춘 듯 얼룩진 밝기) 위에 흉부 엑스레이 필름 한 장(갈비뼈 곡선 3~4줄, 어두운 바탕에 밝은 선). 상자 테 쇠색.', 'tin 테, moon/dust 빛판, void 필름 바탕', []),
    ('specimen_jar', '표본 병', S_HOS, 1, 1, 'object', '탁한 초록 액체가 든 큰 유리 병(둥근 몸통, 쇠 뚜껑) 속에 흐릿한 무언가(눈 하나 또는 작은 손 실루엣), 병 옆 작은 병 하나. 유리 가장자리 밝은 테 한 줄, 속은 어둡게.', 'murk 유리·액체, tin 뚜껑, bisque 속 표본', []),
    # ── 폐교 복도(학원 세트의 망가진 판 — 기본 기물은 학원 쪽) ──
    ('broken_hall_floor', '폐교 복도 바닥(갈라진)', S_SCH, 2, 2, 'ground', '폐교 복도 나무 바닥(가로 긴 널, 니스 벗겨진 얼룩), 한가운데로 금 간 널 하나와 먼지·종이 쪼가리 한 점. 학원 세트 복도 바닥의 망가진 판으로 쓰일 것 — 널 폭 4px, 사방 이어 붙기.', 'rot 널, dust 먼지, sheet 종이', ['floor:plank']),
    ('broken_desk', '부서진 책상·의자', S_SCH, 1, 1, 'object', '학생 책상 하나(쇠 다리 + 나무 윗판)가 한 다리가 부러져 기울고, 의자가 뒤집혀 옆에 쓰러짐. 윗판에 칼 낙서 줄. 윗면이 칸 높이의 ¾ 가량 보이는 낮은 가구 시점.', 'rot 윗판, tin 다리, void 그늘', []),
    ('broken_blackboard', '핏글씨 칠판', S_SCH, 3, 1, 'wall', '교실 벽 칠판(짙은 녹 판, 나무 테, 아래 분필 받침): 판 위 분필 낙서가 지워지다 만 흰 번짐 + 붉은 글씨 「나가」 두 자(획 2px, blood 밝은 쪽, 끝이 아래로 흘러내림). 칠판 한 귀퉁이 금. 글자 외 가짜 글자 금지.', 'board 판, rot 테, dust 분필, blood 글씨', []),
    ('broken_locker', '찌그러진 사물함', S_SCH, 1, 2, 'object', '복도 쇠 사물함(세로 두 칸 문, 문마다 통풍 가로 줄 세 개), 윗칸 문이 찌그러져 반쯤 열리고 안이 새까맣다, 녹·긁힌 자국. 키 큰 가구 — 앞면 주인공, 윗판 1~2px.', 'tin 문, rust 녹, void 속', []),
    ('broken_window', '깨진 복도 창', S_SCH, 2, 1, 'wall', '복도 벽의 가로 긴 창(창틀 두 짝, 가운데 세로 틀): 왼쪽 유리 한 장이 깨져 뾰족한 구멍 가장자리만 남음, 밖은 밤(짙은 청), 오른쪽 유리엔 금 한 줄. 창 아래 벽에 달빛 번짐(?) 한 줄.', 'tin/rot 창틀, murk 유리, night/void 밖, ? 달빛', []),
    ('broken_anatomy', '반쯤 부서진 인체 모형', S_SCH, 1, 2, 'object', '과학실 인체 반신 모형(받침대 위 서 있는 몸): 왼쪽 반은 살결, 오른쪽 반은 근육·내장 색 덩이, 팔 하나 빠져 발치에 떨어짐, 한쪽 눈알 없음. 실루엣으로 사람 모형이 읽히게 머리·어깨 또렷하게.', 'bisque 살결, blood/velv 근육, vgreen/vyellow 내장 점, tin 받침', []),
    # ── 밤 숲·묘지 ──
    ('night_grass', '밤 풀밭', S_GRV, 2, 2, 'ground', '밤 풀밭: 짙은 푸른 녹 바탕에 풀 포기 짧은 V 획(한 단 밝게) 덩이가 몰리게(고른 점박이 금지), 흙이 드러난 점 한두 곳. 사방 이어 붙기. 어두워도 바닥 명도가 비석·나무보다 한 단 낮게.', 'night 풀, soil 흙', ['floor:earth']),
    ('night_path', '밤 흙길', S_GRV, 2, 2, 'ground', 'night_grass 와 한 식구: 가운데 세로로 지나는 흙길(폭 3/4 칸 정도), 양 가장자리는 풀이 흙을 파고드는 들쭉날쭉 선, 길 위 작은 돌 두세 점. 위아래로 이어 붙는다(길 폭·위치 같게), 좌우 끝 풀은 night_grass 와 맞게.', 'soil 길, night 풀, grave 돌', ['floor:earth']),
    ('grave_open', '파헤친 무덤', S_GRV, 1, 2, 'ground', '풀밭 위에 파헤쳐진 무덤 구덩이(세로 긴 네모, 속 void 로 깊게, 가장자리 흙 더미가 위쪽에 쌓임), 옆에 꽂힌 삽 하나(선택, C). 바깥은 night_grass 와 이어지는 풀 바탕 — 칸 전부 불투명.', 'soil 흙, void 구덩이, night 풀, tin 삽', []),
    ('gravestone_cross', '십자 비석', S_GRV, 1, 2, 'object', '돌 십자 비석: 위 십자(가로 팔이 양끝이 살짝 넓어짐), 아래 두꺼운 받침, 윗면·왼면 한 단 밝게, 금 한 줄, 이끼 점, 발치 풀 한 포기. 살짝 기울어도 좋다(B·C).', 'grave 돌, hmoss 이끼, night 풀, ~ 그림자', []),
    ('gravestone_round', '둥근 비석(금 간)', S_GRV, 1, 1, 'object', 'gravestone_cross 와 한 식구: 위가 둥근 판 비석, 새긴 글씨 자국 가로 줄 두세 개(읽히는 글자 없이), 대각선으로 갈라진 금, 윗면 이끼. 같은 돌 명암 방식.', 'grave 돌, hmoss 이끼', []),
    ('dead_tree', '죽은 나무', S_GRV, 3, 3, 'object', '잎 없는 고목: 굵은 줄기가 아래 가운데 칸에서 올라와 두세 갈래로 비틀려 갈라지고, 가지 끝이 손가락처럼 가늘게 뻗음(1px 끝은 2px 가지에서만), 줄기에 옹이 구멍 하나(void), 매달린 끊어진 밧줄(선택, C). 실루엣이 달빛 하늘 앞에서 읽히게 가지를 겹치지 않게 벌린다. 발치 뿌리 두세 갈래.', 'rot/soil 줄기, void 옹이, ~ 그림자', []),
    ('iron_fence', '녹슨 쇠 울타리(이어 붙이기)', S_GRV, 2, 1, 'object', '묘지 쇠 울타리 한 토막: 세로 창살(끝이 창촉 모양) 여섯~여덟 개, 위아래 가로 띠, 한 창살이 휘어짐, 녹 점. 좌우로 이어 붙는다(양 끝 가로 띠 높이 같게). 사람 가슴 높이.', 'tin/rust 쇠, ~ 그림자', []),
    ('cemetery_gate', '묘지 쇠문', S_GRV, 3, 3, 'object', 'iron_fence 와 한 식구: 돌 기둥 둘(위에 둥근 머리 장식) 사이 두 짝 쇠문, 위 반원 아치에 소용돌이 장식, 한 짝이 안쪽으로 반쯤 열림, 문에 감긴 쇠사슬 끊어져 늘어짐. 가운데 칸이 지나갈 길.', 'grave 기둥, tin/rust 문, tarn 사슬', []),
    ('old_well', '낡은 우물', S_GRV, 2, 2, 'object', '돌을 쌓은 둥근 우물: 위에서 약간 내려다봐서 우물 입이 가로 타원(속 void 로 새까맣게), 돌 둘레 이끼, 썩은 나무 뚜껑 판 하나가 옆에 비스듬히 기대어 있음, 두레박 줄 끊어짐. 둥근 돌 윗면 한 줄 밝게.', 'grave 돌, hmoss 이끼, void 속, rot 뚜껑', []),
    ('mausoleum', '납골당 외관', S_GRV, 4, 4, 'facade', '작은 돌 납골당 앞면: 삼각 박공 지붕(돌 처마), 기둥 둘, 가운데 녹슨 쇠문(반쯤 열려 속 어둠), 문 위 새긴 판(글자 없는 줄), 계단 두 단, 벽 금·이끼·담쟁이 줄기. 칸 맨 아래 줄 = 풀밭과 만나는 발치.', 'grave 돌, tin/rust 문, void 속, hmoss 이끼, night 담쟁이', []),
    ('fog_patch', '안개 덮개', S_GRV, 2, 2, 'over', '바닥 위를 떠도는 안개 덩이: 반투명(+ 옅음 · ! 짙음 둘만) 가로로 긴 구름 덩이 둘셋, 가장자리는 + 로 성기게 흩어짐, 속은 ! 한 덩이. 칸 가장자리에 걸리지 않게 안쪽에서 끝나(여러 장 흩어 놓는다). 불투명 색 금지.', '+ ! 안개', []),
    # ── 연출 ──
    ('blood_pool', '핏자국 웅덩이', S_FX, 1, 1, 'decal', '바닥에 고인 피: 가운데 짙은 덩이(blood 2~3단) + 가장자리 번짐($), 윗 가장자리 반짝임 1px 한두 점, 튄 방울 두세 점. 둥근 도장처럼 대칭이면 실패 — 한쪽으로 흘러 기운 모양.', 'blood, $ 번짐', []),
    ('blood_trail', '끌린 핏자국(이어 붙이기)', S_FX, 2, 1, 'decal', 'blood_pool 과 한 식구: 무언가를 끌고 간 핏자국 — 가로로 긴 붓 끌림 두세 줄(끊겼다 이어짐), 좌우 끝이 같은 높이라 가로로 이어 붙는다. 같은 피 색·같은 번짐.', 'blood, $', []),
    ('handprints_wall', '벽 핏빛 손자국', S_FX, 1, 1, 'wall', '벽에 찍힌 핏빛 손바닥 자국 둘(다섯 손가락이 읽히게, 손바닥 5×5 + 손가락 1px 줄), 하나는 아래로 끌려 내려감. 벽 걸이 — 투명 배경.', 'blood, $', []),
    ('writing_wall', '벽 핏글씨', S_FX, 2, 1, 'wall', '벽에 핏빛 큰 글씨 「살려줘」 가 무리면 「도와」 두 자 또는 「돌아가」 — 2칸 폭에 들어가는 만큼만(획 2px), 획 끝이 아래로 흘러내린 줄. 투명 배경. broken_blackboard 글씨와 같은 피 색.', 'blood, $', []),
    ('footprints', '핏빛 발자국', S_FX, 1, 1, 'decal', '맨발 발자국 두 개(왼발·오른발 엇갈려 위로 걸어감, 발가락 점 다섯), 점점 옅어지게 하나는 $ 만으로. 이어 깔면 발자국 길이 되도록 칸 안에서 끝난다.', 'blood, $', []),
    ('note_paper', '떨어진 쪽지', S_FX, 1, 1, 'decal', '바닥에 떨어진 누런 쪽지 한 장(살짝 접힌 모서리, 글씨 줄 두세 개는 가짜 글자 말고 짧은 가로 획), 조사할 수 있다는 표시로 한쪽 모서리 반짝임 1px. 쪽지 크기 8×7 정도로 또렷하게.', 'sheet 종이, void 글씨 획, dust', []),
    ('broken_glass', '깨진 유리 조각', S_FX, 1, 1, 'decal', '바닥에 흩어진 유리 조각: 뾰족한 삼각 조각 네다섯(가장자리 밝은 1px + 속 탁한 청회), 크기 다르게, 한쪽으로 몰림, 한 조각 끝에 피 한 점(선택).', 'murk 조각, moon 반짝임, blood 한 점', []),
    ('cobweb_corner', '거미줄(모서리)', S_FX, 1, 1, 'over', '방 왼쪽 위 모서리에 친 거미줄: 모서리에서 부채꼴로 뻗은 방사 줄 넷, 그 사이 늘어진 호 줄 두세 겹(1px, dust 밝은 단), 한 줄 끊어져 늘어짐. 투명 배경. 오른쪽 모서리용은 거울로 찍지 말고 따로 그린다(빛 방향 유지) — 여유 있으면 D 로.', 'dust 거미줄', []),
    ('cobweb_hang', '늘어진 거미줄', S_FX, 1, 1, 'over', 'cobweb_corner 와 한 식구: 천장·가구 사이에 늘어진 거미줄 한 덩이(가로로 처진 줄 두세 겹 + 매달린 작은 거미 한 점). 가구 윗모서리에 겹쳐 쓴다.', 'dust, void 거미', []),
    ('dark_edge', '어둠 덮개(가장자리)', S_FX, 1, 1, 'over', '방 가장자리를 어둡게 덮는 반투명 한 칸: 위 줄 = 어둠 가장 짙음(&) → 아래로 * " ^ 순으로 옅어져 맨 아래 줄은 투명. 단 경계는 곧은 가로선 말고 2px 디더(체크)로 부드럽게. 좌우로 이어 붙는다(좌우 끝 모양 같게). 네 방향은 회전해 쓴다. 불투명 색 금지.', '^ " * & 어둠', []),
    ('dark_corner', '어둠 덮개(바깥 모서리)', S_FX, 1, 1, 'over', 'dark_edge 와 한 식구: 왼쪽 위 모서리가 가장 짙고(&) 오른쪽 아래로 부채꼴(1/4 원)로 옅어진다. dark_edge 두 장과 모서리에서 이어지게(위 줄은 dark_edge 위 줄과, 왼 줄은 dark_edge 를 90° 돌린 것과 같은 단).', '^ " * & 어둠', []),
    ('dark_light_hole', '촛불 빛 구멍(어둠 덮개)', S_FX, 3, 3, 'over', 'dark_edge 식구의 3×3 덮개: 가운데가 투명한 둥근 빛 구멍(지름 약 2칸), 바깥으로 ^ " * & 순으로 짙어져 네 모서리는 &. 촛불·손전등을 든 주인공 둘레에 씌운다. 원이 계단져 보이지 않게 단 경계 디더. 바깥 테두리 한 줄은 모두 & — 더 넓은 어둠(& 한 색 칸)과 이어진다.', '^ " * & 어둠', []),
]
# ══ 2판(2026-09-30): 「1단계 기본」 ══════════════════════════════════════════════════════════════════════════════
# 사용자: 「우선은 '기본' 이 되어야 할 타일들을 만들어야 하지 않겠냐 … 이브나 마녀의 집 어떻게 만들었는지 생각해봐」.
# 조사 tiledata/atlas-pick/horror-foundation-study.md. 위 ITEMS(1판 66개)는 지우지 않는다 — 기본에 해당하는 것은 STAGE1_MOVED 로 1단계에 옮기고
# 나머지는 2단계(연출, 기본이 선 뒤)로 미룬다. 1판 후보 파일(h1~h5)·고른 기록은 그대로 둔다.
# 한 벌(kit) = 장면 하나를 까는 기본 조각 묶음. 고르기는 한 벌 단위: 같은 방향 글자 조각으로 방을 깔아 나란히 본다(horror_room_compose.py).
S_GAL, S_CEL, S_COM = '미술관', '지하·돌방', '공통 뼈대'
KITS = {
    'frame':   ('공통 뼈대', '천장 윗면(검정 덮개 + 방 쪽 테)·계단·기둥·어둠 경계 — 모든 방에 쓴다'),
    'manor':   ('저택', '마녀의 집·아오오니 결 저택: 벽지 벽면·마루·카펫·러너·문·창·기본 가구'),
    'gallery': ('미술관', 'Ib 결 미술관: 흰·회색 벽면·밝은 마루·돌판·러너·액자·받침대·줄 울타리'),
    'ward':    ('병원', '폐병원 병실: 페인트·타일 벽면·리놀륨·병실 문·쇠창살 창·병상 가구'),
    'cellar':  ('지하', '지하실·감옥 결: 돌·벽돌 벽면·판석·흙·쇠창살 문·벽 등잔·선반'),
}
# 1판에서 1단계로 옮기는 것: slug → (한 벌, 역할). 후보는 그대로(1판 작업자 파일) — 2판 규칙(3절)에 맞는지 한 벌 방 그림에서 다시 본다.
STAGE1_MOVED = {
    'floor_creaky': ('manor', '마루 변형(낡은 널)'), 'wall_paper_torn': ('manor', '벽지 벽면 변형(찢김)'), 'wall_paper_stain': ('manor', '벽지 벽면 변형(얼룩)'),
    'grandfather_clock': ('manor', '벽 가구(시계)'), 'candelabra_drip': ('manor', '세움 촛대'),
    'hosp_floor': ('ward', '타일 바닥'), 'hosp_wall': ('ward', '페인트 벽면'), 'hosp_bed': ('ward', '병상'), 'hosp_screen': ('ward', '칸막이 커튼'),
    'iv_stand': ('ward', '링거 걸이'), 'medicine_cabinet': ('ward', '약장(벽 가구)'),
    'broken_hall_floor': ('school', '폐교 복도 바닥(학원 세트 몫)'),
    'night_grass': ('outdoor', '밤 풀밭(야외 바닥)'), 'night_path': ('outdoor', '밤 흙길(야외 바닥)'),
    'dark_edge': ('frame', '어둠 가장자리'), 'dark_corner': ('frame', '어둠 모서리'), 'dark_light_hole': ('frame', '빛 구멍 덮개'),
}
# 자동 타일(천장 윗면·카펫 러너) 꼴 — 절차서 3-a 절. 4×3 칸(64×48): 왼쪽 3×3 = 한 덩이(모서리·변·속), (3,0) 칸 = 안쪽 모서리 넷, 나머지 투명.
AUTO = ('자동 타일 4×3(64×48): 왼쪽 3×3 칸 = 덩이 하나(왼위 모서리·위 변·오른위 모서리 / 왼 변·속·오른 변 / 아래 셋), (3,0) 칸 = 안쪽 모서리 네 조각'
        '(8px 사분면마다 그 방향 대각선만 비었을 때의 모양), 나머지 칸은 투명. 조립기가 칸마다 8px 사분면 넷을 이웃에 따라 골라 붙인다(RPG 쯔꾸르 A2 결). '
        '변·모서리 칸의 바깥 테가 이어져 보이게, 속 칸은 사방으로 이어지게(가장자리 무늬가 맞게).')
WALLFACE = ('벽면 2×2(32×32) 칸 전부 불투명, 가로로 32px 마다 이어진다(무늬·징두리 이음이 맞게). 위에서 아래로: y0~2 몰딩(천장 테 밑 그늘은 조립기가 1~2px 더한다) → '
            '넓은 면(방에서 가장 밝은 넓은 면, 바닥보다 두 단 밝게) → 징두리(y22~28 쯤) → y29~31 걸레받이(가장 어두운 단 + 윗줄 밝은 1px). 벽면 두 줄이 한 벽이다.')
FLOOR = '바닥 2×2(32×32) 칸 전부 불투명, 사방 이어짐(@tile). 조용하게 4~5단, 명도 차 ~25. 옹이·이음은 한두 곳만(반복이 띠로 보이지 않게). 벽면보다 두 단 어둡게.'
# (slug, 이름, 장면, w, h, 층, 설명, 팔레트 힌트, v5 원본 id, 작업자, 한 벌, 역할)
FOUNDATION = [
    # ── hf1 공통 뼈대 ──
    ('ceil_black', '천장 윗면(검정·짙은 나무 테)', S_COM, 4, 3, 'facade', '저택·지하 방의 천장/벽 윗면. ' + AUTO + ' 속 = 거의 검정 한두 단(vblack·void, 조용하게 — 무늬 금지), 방 쪽 테 3~4px: 아래 변(벽면 위 끝) = 밝은 입술 줄 + 어두운 밑줄(v5 천장 띠처럼 앞이 가장 또렷), 위·왼 변 = 한 단 밝은 테, 오른 변 = 한 단 어두운 테(빛은 왼쪽 위). 어둠 덮개를 씌워도 방 윤곽이 남아야 한다.', 'vblack/void 속, mahog/rot 테', [], 'hf1', 'frame', '천장 윗면(저택·지하)'),
    ('ceil_plaster', '천장 윗면(검정·밝은 회 테)', S_COM, 4, 3, 'facade', 'ceil_black 과 같은 꼴·같은 테 폭, 테만 밝은 회백(미술관·병원 — 흰 벽 위). 둘을 나란히 깔 수 있게 속 검정은 같게.', 'vblack/void 속, vmarble/grave/dust 테', [], 'hf1', 'frame', '천장 윗면(미술관·병원)'),
    ('exit_dark', '출구 어둠(남쪽 틈)', S_COM, 2, 2, 'over', '방 남쪽 벽 틈(출구·복도 끝)에 까는 어둠: 위 줄은 투명 → 아래로 ^ " * & 순으로 짙어져 맨 아래 줄은 &, 좌우 가장자리 2~3px 도 한 단 짙게. 2칸 폭 틈에 딱, 3칸 틈은 dark_edge 한 장 곁들임. 반투명 어둠 4단만.', '^ " * & 만', [], 'hf1', 'frame', '출구 어둠'),
    ('stairs_up_wood', '오름 나무 계단', S_COM, 3, 3, 'object', 'v5 오름 계단 규칙 그대로: 북쪽 벽 앞, 3칸 폭, 캔버스 아래 1줄 = 첫 바닥 줄, 위 2줄 = 벽면 자리를 덮고 벽 속(검정)으로 오른다. 단 6~8개, 단 윗면 밝게·앞면 어둡게, 양옆 난간 기둥·손잡이. 가장 윗단은 검정으로 사라진다(위층은 어둠 속).', 'rot/mahog 단, void 끝, dust 단 끝 먼지 한 줄', ['stairs up wood'], 'hf1', 'frame', '오름 계단(나무)'),
    ('stairs_up_stone', '오름 돌계단', S_COM, 3, 3, 'object', 'stairs_up_wood 와 같은 칸·같은 단 수, 돌 단(병원·지하·미술관). 난간 없이 양옆 돌 벽 턱.', 'vstone/grave 단, void 끝', ['stairs up stone'], 'hf1', 'frame', '오름 계단(돌)'),
    ('stairs_down', '내림 계단(바닥 구멍)', S_COM, 1, 1, 'decal', 'v5 규칙: 바닥의 1×1 구멍. 위 가장자리 바닥 턱(밝은 1px) 아래로 단 3~4개가 점점 어두워져 검정(void)으로. 둘레 1px 투명(어느 바닥에도 얹힌다).', 'grave/rot 단, void', ['stairwell down'], 'hf1', 'frame', '내림 계단'),
    ('pillar_stone', '돌기둥', S_COM, 1, 3, 'object', 'v5 돌기둥 자리(1×3): 발 칸 = 받침(윗면 보임), 몸통 2칸 위로 벽면 높이까지, 위 끝 머리 장식. 원통 명암(밝은 덩이 왼쪽). 방 가운데 줄로 세워 복도를 나눈다.', 'vstone/grave', ['column stone'], 'hf1', 'frame', '기둥(돌)'),
    ('pillar_marble', '대리석 기둥(미술관)', S_GAL, 1, 3, 'object', 'pillar_stone 과 같은 칸·같은 꼴, 흰 대리석 + 얇은 금(tarn) 띠. 미술관 입구·홀.', 'vmarble, tarn 띠', ['column marble'], 'hf1', 'frame', '기둥(대리석)'),
    ('moonlight_floor', '창 아래 달빛', S_COM, 1, 2, 'decal', '창(벽면 윗줄) 아래 바닥에 비스듬히 떨어진 달빛: ? 만으로(반투명 60), 창살 십자 그림자 한 줄은 비운다, 아래로 갈수록 오른쪽으로 1px 씩 밀림(v5 창 빛처럼). 바닥 첫 줄부터 두 줄.', '? 만', [], 'hf1', 'frame', '달빛(창 빛)'),
    # ── hf2 저택 벽면·바닥 ──
    ('wall_manor_damask', '저택 벽면(다마스크 벽지)', S_MAN, 2, 2, 'facade', WALLFACE + ' 넓은 면 = 빛바랜 벽지 + 다마스크 무늬(반복 16px, 반 칸 엇갈림), 징두리 = 짙은 나무 판(패널 16px), 걸레받이 짙은 나무. 기본판 — 찢김·얼룩 없이(변형은 wall_paper_torn·stain).', 'paper 벽지, damask 무늬, mahog 징두리·걸레받이', ['wall:plaster'], 'hf2', 'manor', '벽면(기본)'),
    ('wall_manor_stripe', '저택 벽면(줄무늬 벽지)', S_MAN, 2, 2, 'facade', 'wall_manor_damask 와 같은 몰딩·징두리·걸레받이 높이(섞어 깔 수 있게), 넓은 면만 세로 줄무늬 벽지(줄 폭 섞음 2·3·5, 색 두 단). 침실·복도용.', 'paper/velv 줄, mahog', ['wall:plaster'], 'hf2', 'manor', '벽면(줄무늬)'),
    ('wall_wood_panel', '저택 벽면(나무 판벽)', S_MAN, 2, 2, 'facade', WALLFACE + ' 넓은 면까지 짙은 나무 판(세로 판자 + 가로 띠 두 줄, 패널 16px). 서재·식당·지하 입구. 벽지 벽보다 한 단 어둡지만 바닥보다는 밝게.', 'mahog/rot 판, tarn 못 한두 점', ['wall:logdark'], 'hf2', 'manor', '벽면(판벽)'),
    ('floor_manor_plank', '저택 마루(기본)', S_MAN, 2, 2, 'ground', FLOOR + ' v5 짙은 마루(널 폭 4px 가로 널) 결, 깨끗한 기본판(들뜬 널·구멍 없이 — 그건 floor_creaky·floor_creaky_broken).', 'rot/vdwood 널', ['floor:dplank'], 'hf2', 'manor', '바닥(마루)'),
    ('floor_manor_carpet', '저택 카펫 바닥(방 전체)', S_MAN, 2, 2, 'ground', FLOOR + ' 방 전체에 깐 짙은 카펫(벨벳 자주 또는 짙은 남청 바탕 + 작은 무늬 반복 16px, 무늬는 한 단만 밝게). 침실·응접실.', 'velv/damask 바탕·무늬', ['floor:casino'], 'hf2', 'manor', '바닥(카펫)'),
    ('floor_checker', '흑백 체크 바닥', S_MAN, 2, 2, 'ground', FLOOR + ' 8px 체크(회백·짙은 회 두 색, 체크끼리 명도 차는 바닥 규칙보다 크게 허용하되 가장 밝은 단은 벽면보다 어둡게), 줄눈 1px 한 단 어둡게, 금 한 곳. 현관·욕실·마녀의 집 결.', 'dust/grave 두 색', ['floor:check'], 'hf2', 'manor', '바닥(체크)'),
    ('carpet_runner', '카펫 러너(자동 타일)', S_MAN, 4, 3, 'decal', '복도·전시실을 가로지르는 긴 카펫. ' + AUTO + ' 바탕 = 짙은 붉은 벨벳, 테 = 2px 금(tarn) 줄 + 바깥 1px 어두운 술, 속 무늬 작게(16px 반복). 바깥 모서리 화소는 둥글게 투명(귀퉁이 투명 규칙). v5 붉은 깔개(line:rug red)와 같은 쓰임.', 'velv/vred 바탕, tarn 테', [], 'hf2', 'manor', '러너(자동 타일)'),
    # ── hf3 문·창(모든 장면) ──
    ('door_wood', '나무 문(기본)', S_COM, 1, 2, 'wall', '북쪽 벽면 두 줄에 붙는 한 칸 문: 위 2px 는 벽면이 보이게 비우고, 문틀(위·양옆 2px) + 문짝(패널 두 개, 위 패널 작게) + 놋쇠 손잡이 한 점, 맨 아래 줄이 바닥에 닿는다. 벽지 벽·판벽 어디에 붙여도 문틀이 벽과 떨어져 보이게(문틀 밝은 테). 문 아래 틈 1px 는 짙게.', 'mahog 문, rot 틀, tarn 손잡이', [], 'hf3', 'manor', '문(기본)'),
    ('door_locked', '잠긴 나무 문', S_COM, 1, 2, 'wall', 'door_wood 와 같은 문(칸·틀·패널 같게) + 손잡이 둘레 쇠 자물쇠·가로 사슬 한 줄. 「잠김」이 한눈에 — 어두운 방에서도 사슬이 읽히게 밝은 단을 쓴다.', 'mahog, tin/viron 사슬·자물쇠', [], 'hf3', 'manor', '문(잠김)'),
    ('door_double', '저택 양문', S_MAN, 2, 2, 'wall', 'door_wood 식구의 두 짝 문(현관·홀): 가운데 맞닿는 선, 짝마다 패널 둘, 손잡이 둘, 위 반원 채광창(짙은 유리) 선택. 벽면 두 줄 높이.', 'mahog, tarn, murk 채광창', [], 'hf3', 'manor', '문(양문)'),
    ('door_gallery', '미술관 문', S_GAL, 1, 2, 'wall', 'door_wood 와 같은 칸·틀 폭, 흰 벽에 붙는 밝은 회백 문틀 + 짙은 회청 문짝, 손잡이 쇠. 흰 벽 위에서 문이 먼저 보이게 문짝을 짙게.', 'vmarble/dust 틀, grave/ward 문', [], 'hf3', 'gallery', '문(미술관)'),
    ('door_hosp', '병실 문', S_HOS, 1, 2, 'wall', 'door_wood 와 같은 칸·틀 폭, 쇠 틀 + 바랜 회녹 문짝, 위쪽에 세로 긴 작은 유리창(속은 어둡게), 가로 밀대 손잡이. 병원 벽면에 붙는다.', 'tin 틀, ward 문, murk 유리', [], 'hf3', 'ward', '문(병실)'),
    ('door_iron', '철문', S_COM, 1, 2, 'wall', 'door_wood 와 같은 칸, 두꺼운 쇠 문(리벳 줄 두 줄, 녹 점 덩이 한두 곳, 가운데 작은 들여다보는 창살 창). 영안실·지하·잠긴 곳.', 'viron/tin 문, rust 녹, void 창 속', [], 'hf3', 'cellar', '문(철문)'),
    ('window_night', '밤 창(기본)', S_COM, 1, 1, 'wall', '벽면 윗줄에 거는 작은 창: 위 2px 비움, 나무 창틀 + 십자 창살, 유리는 짙은 남청(바깥 밤) + 왼위 달빛 반사 1~2 점. v5 창(window)과 같은 크기.', 'rot 틀, murk/moon 유리', ['window'], 'hf3', 'manor', '창(밤)'),
    ('window_curtain', '커튼 닫힌 창', S_COM, 1, 1, 'wall', 'window_night 와 같은 틀, 짙은 벨벳 커튼 두 폭이 닫혀 가운데 1px 틈으로만 달빛. 커튼 주름 세로 줄 두세 개, 위 커튼 봉.', 'velv 커튼, moon 틈, tarn 봉', ['curtained window'], 'hf3', 'manor', '창(커튼)'),
    ('window_barred', '쇠창살 창', S_COM, 1, 1, 'wall', 'window_night 와 같은 크기, 창 앞 세로 쇠창살 셋(유리 위에 2px 쇠), 틀은 흰 칠 쇠 또는 돌. 병원·지하.', 'tin/viron 창살, murk/moon 유리, grave 틀', [], 'hf3', 'ward', '창(쇠창살)'),
    # ── hf4 저택 기본 가구 ──
    ('table_wood', '나무 탁자', S_MAN, 2, 1, 'object', '낮은 가구 시점: 윗면이 높이의 ¾(윗면 밝게·굴린 테), 앞 두께 2px + 앞다리 둘. 윗면에 촛대·책을 얹을 수 있게 비운다. v5 식탁보다 한 단 탁하게.', 'mahog 윗면·다리', ['roundtable'], 'hf4', 'manor', '탁자'),
    ('chair_wood', '나무 의자(앞)', S_MAN, 1, 1, 'object', 'v5 chair S 자리: 남쪽을 보는 의자 — 등받이(위 1/3, 세로 살 둘) + 앉는 판(윗면 보임) + 앞다리 둘. chair_wood_back 과 한 식구(같은 나무·같은 크기).', 'mahog', ['chair S'], 'hf4', 'manor', '의자(남향)'),
    ('chair_wood_back', '나무 의자(뒤)', S_MAN, 1, 1, 'object', 'v5 chair N 자리: 북쪽(탁자)을 보는 의자 — 등받이 뒷면이 앞에 크게, 앉는 판은 등받이 뒤로 조금만. chair_wood 와 같은 나무.', 'mahog', ['chair N'], 'hf4', 'manor', '의자(북향)'),
    ('bookshelf_manor', '책장', S_MAN, 1, 2, 'object', '키 큰 벽 가구(북쪽 벽면 앞): 앞면이 주인공, 윗판 1~2px, 선반 세 단에 책(색 두세 가지, 한 단 탁하게, 높이 섞음, 빈 칸 하나). v5 책장 1칸 크기.', 'mahog 틀, vred/vblue/vgreen 책(탁하게)', ['bookshelf 1w'], 'hf4', 'manor', '책장'),
    ('bed_manor', '저택 침대', S_MAN, 1, 3, 'object', 'v5 침대와 같은 칸(1×3 캔버스, 위 10px 여백 = 발 칸 1×2)·같은 시점: 머리판(나무) + 베개 + 이불(바랜 벨벳/누런 시트, 접힌 윗단) + 발판. 누운 사람 없이.', 'mahog 틀, sheet/velv 침구', ['bed red'], 'hf4', 'manor', '침대'),
    ('dresser', '서랍장', S_MAN, 1, 1, 'object', '낮은 벽 가구: 윗면 보임(윗면에 물건 얹는 자리), 앞면 서랍 셋(손잡이 점 둘씩), 짧은 다리. v5 협탁보다 넓게 칸을 채운다.', 'mahog, tarn 손잡이', [], 'hf4', 'manor', '서랍장'),
    ('side_table', '협탁', S_MAN, 1, 1, 'object', '침대 옆 작은 탁자: 윗면 보임, 서랍 하나, 가는 다리. 칸 아래쪽 2/3 안에(작게) — dresser 와 같은 나무.', 'mahog', [], 'hf4', 'manor', '협탁'),
    ('candle_table', '탁상 촛대', S_MAN, 1, 1, 'object', '탁자·서랍장 윗면에 얹는 작은 놋쇠 촛대 하나(초 한 자루, 켜진 불꽃 2~3px + 둘레 % 번짐 작게). 칸 아래 가운데에 작게 — 얹힐 때 밑변이 가구 윗면 안에 들어오게. candelabra_drip 과 같은 불꽃·초 색.', 'tarn 촛대, wax 초, flame 불꽃, %', ['candle'], 'hf4', 'manor', '탁상 촛대'),
    # ── hf5 미술관 ──
    ('wall_gallery_white', '미술관 벽면(흰 벽)', S_GAL, 2, 2, 'facade', WALLFACE + ' 넓은 면 = 조금 바랜 흰 칠(무늬 없음, 32px 마다 아주 옅은 이음 한 줄), 위 몰딩 얇게, 징두리 없이 걸레받이만 짙은 회(4px). 가장 조용한 벽 — 액자가 주인공.', 'dust/vmarble 벽, grave 걸레받이', ['wall:marblewall'], 'hf5', 'gallery', '벽면(흰)'),
    ('wall_gallery_grey', '미술관 벽면(짙은 회청)', S_GAL, 2, 2, 'facade', 'wall_gallery_white 와 같은 몰딩·걸레받이 높이, 넓은 면만 짙은 회청(또는 짙은 붉은) 칠 — 구역을 색으로 나누는 미술관(한 구역 한 색). 바닥보다는 밝게.', 'grave/ward 벽, void 걸레받이', ['wall:grey'], 'hf5', 'gallery', '벽면(구역 색)'),
    ('floor_gallery_wood', '미술관 마루(밝은)', S_GAL, 2, 2, 'ground', FLOOR + ' 밝은 참나무 긴 널(널 폭 4px, 이음 드물게), 저택 마루보다 두 단 밝지만 흰 벽보다 어둡게. 광택 한 줄(왼위 빛) 드물게.', 'vpine/vwood 널', ['floor:plank'], 'hf5', 'gallery', '바닥(마루)'),
    ('floor_gallery_stone', '미술관 돌판 바닥', S_GAL, 2, 2, 'ground', FLOOR + ' 회색 대리석 판(16px 판, 줄눈 1px, 판마다 한 단 차이), 결 한두 줄. 홀·조각 전시실.', 'vmarble/grave 판', ['floor:marble'], 'hf5', 'gallery', '바닥(돌판)'),
    ('frame_landscape', '풍경화 액자(가로)', S_GAL, 2, 1, 'wall', '벽면 윗줄에 거는 가로 액자: 금테(tarn, 윗·왼 한 단 밝게) + 속 평범한 풍경(하늘·들판 두세 덩이, 탁한 색). 이상한 것 없이 — 연출판은 2단계. 위 2px 비움.', 'tarn 테, vgreen/vblue/paper 그림(탁하게)', ['picture'], 'hf5', 'gallery', '액자(가로)'),
    ('frame_small', '작은 액자', S_GAL, 1, 1, 'wall', 'frame_landscape 와 같은 금테, 1칸 세로 초상/정물(꽃병 하나). 위 2px 비움.', 'tarn, velv/sheet', ['picture'], 'hf5', 'gallery', '액자(작은)'),
    ('plaque', '작품 명패', S_GAL, 1, 1, 'wall', '액자 아래(벽면 아랫줄)에 붙는 작은 명패: 칸 가운데 8×4 쯤 밝은 판 + 글씨 줄 두 개(가짜 글자 말고 짧은 가로 획), 나머지 투명.', 'sheet/vbrass 판, void 획', [], 'hf5', 'gallery', '명패'),
    ('pedestal', '전시 받침대', S_GAL, 1, 1, 'object', '흰 사각 받침대(윗면 보임 — 위에 조각·화병을 얹는 자리), 앞면 한 단 어둡게, 오른쪽 옆면 얇게. 칸 폭의 2/3.', 'vmarble/dust', [], 'hf5', 'gallery', '받침대'),
    ('rope_barrier', '줄 울타리(이어 붙이기)', S_GAL, 2, 1, 'object', '놋쇠 기둥 둘(왼 끝·가운데) + 늘어진 붉은 줄(가운데가 처짐). 가로로 이어 붙이면 기둥 간격이 16px 로 맞게(오른 끝은 다음 토막의 왼 기둥). 작품 앞 1칸.', 'tarn 기둥, vred/velv 줄', [], 'hf5', 'gallery', '줄 울타리'),
    ('bench_gallery', '관람 의자', S_GAL, 2, 1, 'object', '등받이 없는 긴 의자: 윗면(가죽 짙은 색) ¾ + 앞 두께 + 다리 넷 중 둘 보임. 전시실 가운데.', 'velv/rot 가죽, tin 다리', [], 'hf5', 'gallery', '관람 의자'),
    # ── hf6 병원 ──
    ('wall_hosp_tile', '병원 벽면(흰 타일 반벽)', S_HOS, 2, 2, 'facade', WALLFACE + ' 위 절반 = 바랜 회녹 칠(hosp_wall 과 같은 색), 아래 절반 = 흰 사각 타일(8px, 줄눈 1px) + 걸레받이. 수술실·욕실·복도. hosp_wall 과 섞어 깔 수 있게 몰딩·걸레받이 높이 같게.', 'ward 칠, sheet/dust 타일, grave 줄눈', ['wall:ktile'], 'hf6', 'ward', '벽면(타일 반벽)'),
    ('floor_hosp_linoleum', '병원 리놀륨 바닥', S_HOS, 2, 2, 'ground', FLOOR + ' 긴 리놀륨 판(가로 16px 판, 이음 드물게), 바랜 회녹·누런 회 한 색 + 광택 한 줄, 닳은 자리 한 곳. hosp_floor(타일)와 방 단위로 바꿔 깐다.', 'ward/sheet', ['floor:grey'], 'hf6', 'ward', '바닥(리놀륨)'),
    ('bedside_cabinet', '병상 협탁', S_HOS, 1, 1, 'object', '쇠 협탁(흰 칠 벗겨짐): 윗면 보임, 앞 서랍 하나 + 아래 문, 바퀴 둘. hosp_bed 옆.', 'ward/dust 몸통, tin', [], 'hf6', 'ward', '협탁'),
    ('hosp_chair', '병원 쇠 의자', S_HOS, 1, 1, 'object', '가는 쇠 다리 + 바랜 회녹 앉는 판·등받이(남향). 1px 다리가 먹히지 않게 2px.', 'tin 다리, ward 판', ['chair S'], 'hf6', 'ward', '의자'),
    ('ward_sink', '세면대', S_HOS, 1, 1, 'object', '북쪽 벽면 앞 벽 가구: 흰 세면대(윗면 우묵한 대야 — 속 한 단 어둡게) + 수도꼭지 쇠, 아래 받침 기둥, 위 작은 거울은 없이. 녹물 한 줄 선택.', 'sheet/dust 세면대, tin 꼭지, rust', [], 'hf6', 'ward', '세면대'),
    # ── hf7 지하·돌방 ──
    ('wall_stone_block', '돌벽 벽면', S_CEL, 2, 2, 'facade', WALLFACE + ' 넓은 면 = 큰 돌 블록(가로 16·8px 엇갈림, 블록마다 한 단 차이, 윗·왼 테 밝게), 걸레받이 대신 바닥 쪽 돌이 한 단 어둡게·이끼 점 한 곳.', 'vstone/grave 돌, hmoss 이끼', ['wall:stone'], 'hf7', 'cellar', '벽면(돌)'),
    ('wall_cellar_brick', '벽돌 벽면(젖은)', S_CEL, 2, 2, 'facade', 'wall_stone_block 과 같은 높이 규칙, 작은 붉은 갈색 벽돌(8×4 엇갈림), 위에서 흐른 물 얼룩 세로 한 줄. 지하 창고·보일러실.', 'vclay/rust 벽돌, grave 줄눈', ['wall:rubble'], 'hf7', 'cellar', '벽면(벽돌)'),
    ('floor_stone', '판석 바닥', S_CEL, 2, 2, 'ground', FLOOR + ' 불규칙 판석(판 크기 섞음 8·12·16px, 줄눈 한 단 어둡게), 판마다 한 단 차이, 금 한 줄.', 'vstone/grave', ['floor:flag'], 'hf7', 'cellar', '바닥(판석)'),
    ('floor_dirt', '흙바닥', S_CEL, 2, 2, 'ground', FLOOR + ' 짙은 흙(soil) 바탕 + 작은 돌 두세 덩이, 밟혀 다져진 옅은 자리 하나. 지하 굴·창고 바닥.', 'soil, grave 돌', ['floor:earth'], 'hf7', 'cellar', '바닥(흙)'),
    ('door_cell', '쇠창살 문(감옥)', S_CEL, 1, 2, 'wall', 'door_wood 와 같은 칸, 쇠창살 문(세로 창살 넷 + 가로 띠 둘, 창살 사이는 투명 — 뒤 벽면·어둠이 보인다), 자물쇠 한 점.', 'viron/tin, rust', [], 'hf7', 'cellar', '문(창살)'),
    ('torch_wall', '벽 등잔', S_CEL, 1, 1, 'wall', '벽면 윗줄에 거는 쇠 받침 등잔(작은 불꽃 + 둘레 % 번짐, 벽에 비친 빛). 켜진 판 하나.', 'viron 받침, flame, %', [], 'hf7', 'cellar', '벽 등잔'),
    ('shelf_cellar', '지하 선반', S_CEL, 1, 2, 'object', '북쪽 벽 앞 썩은 나무 선반(세 단): 병·단지·상자 몇 개(색 탁하게, 빈 칸 하나), 윗판 먼지 한 줄. 키 큰 가구 — 앞면이 주인공.', 'rot 선반, vclay/murk/vstraw 물건, dust', ['shelf pots'], 'hf7', 'cellar', '선반'),
]
WORKERS2 = ['hf1', 'hf2', 'hf3', 'hf4', 'hf5', 'hf6', 'hf7']   # 한 번에 최대 8명
DIRECTIONS2 = {
    'A': 'v5 식구 기본판 — v5 방(짙은 마루·회벽·검정 천장 띠)과 같은 명도 구조·단 수·윤곽, v 램프 위주. 깨끗하고 정돈된 판(낡음은 먼지·바램 한 단까지)',
    'B': '어둠에서 읽히는 판(Ib 결) — 면을 크게 나누고 명도 폭 최대: 벽면 밝게·바닥 어둡게·천장 검정, 테·걸레받이·문틀 선명, 무늬 적게. 어둠 덮개를 씌워도 방 모양이 남는다',
    'C': '재질·무늬 판(마녀의 집 결) — 호러 램프(paper·damask·rot·ward·grave…)로 무늬·결을 한 단 더(다마스크·줄무늬·널 결·줄눈), 동화처럼 짙은 색. 가까이 보면 재미있는 판',
}

WORKERS = ['h1', 'h2', 'h3', 'h4', 'h5']   # 1판 작업자(배정 기록 workers_v1)
# 짝·세트(한 작업자에게). 같은 방향 글자끼리 한 식구로 보여야 하는 것들.
SETS = [
    ['floor_creaky', 'floor_creaky_broken'], ['wall_paper_torn', 'wall_paper_stain'], ['portrait_eyes', 'portrait_slashed'],
    ['doll_sitting', 'doll_shelf'], ['sofa_sheet', 'armchair_sheet'], ['candelabra_drip', 'candle_floor'],
    ['hosp_floor', 'hosp_wall'], ['hosp_bed', 'hosp_screen'], ['operating_table', 'instrument_tray'],
    ['night_grass', 'night_path', 'grave_open'], ['gravestone_cross', 'gravestone_round'], ['iron_fence', 'cemetery_gate'],
    ['blood_pool', 'blood_trail', 'handprints_wall', 'writing_wall', 'footprints'],
    ['cobweb_corner', 'cobweb_hang'], ['dark_edge', 'dark_corner', 'dark_light_hole'],
]
CAP = 14

def assign():
    """장면이 한 작업자에게 몰리지 않게 무게로 고르게 나누되, 세트는 한 사람에게."""
    by = {i[0]: i for i in ITEMS}; used = {s for g in SETS for s in g}
    assert used <= set(by), used - set(by)
    groups = [list(g) for g in SETS] + [[i[0]] for i in ITEMS if i[0] not in used]
    cost = lambda s: by[s][3] * by[s][4] + (3 if by[s][5] in ('facade', 'ground') else 0) + 2   # 큰 칸·이어 붙는 조각은 무겁다
    groups.sort(key=lambda g: -sum(cost(s) for s in g))
    load = {w: 0 for w in WORKERS}; out = {w: [] for w in WORKERS}
    for g in groups:
        w = min(WORKERS, key=lambda w: (len(out[w]) + len(g) > CAP, load[w], len(out[w])))
        out[w] += g; load[w] += sum(cost(s) for s in g)
    order = {i[0]: k for k, i in enumerate(ITEMS)}
    for w in out: out[w].sort(key=order.get)
    return out, load

_META = None
def v5_meta():
    global _META
    if _META is None:
        m = json.load(open(os.path.join(V5, 'interior-meta.json'), encoding='utf-8'))
        _META = {o['id']: o for k in ('objects', 'floors', 'walls') for o in m[k]}
    return _META

def v5_refs(ids):
    out = []
    for i in ids:
        o = v5_meta()[i]
        r = dict(id=i, name_ko=o.get('name_ko', i), atlas=o['atlas'])
        if 'image' in o: r.update(image=o['image'], kind=o.get('kind'), footprint=o.get('footprint'))
        p = os.path.join(V5_PICK, slug(i))
        if os.path.isdir(p): r['pick_dir'] = os.path.relpath(p, ROOT)   # 16px 실내 고르기 하네스 폴더(v5.pxg·고른 후보 참고)
        out.append(r)
    return out

def write_refs(d, refs):
    atlas = Image.open(os.path.join(V5, 'interior-atlas.png')).convert('RGBA')
    for k, r in enumerate(refs, 1):
        a = r['atlas']; im = atlas.crop((a['x'], a['y'], a['x'] + a['w'], a['y'] + a['h']))
        im.save(os.path.join(d, f'ref-v5-{k}.png'))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(d, f'ref-v5-{k}-x4.png'))
        r['file'] = f'ref-v5-{k}.png'

def main():
    out, load = assign()                                   # 1판 배정(기록으로만 남긴다)
    owner = {s: w for w, lst in out.items() for s in lst}
    setof = {s: g for g in SETS for s in g}
    slugs = [i[0] for i in ITEMS] + [f[0] for f in FOUNDATION]; assert len(slugs) == len(set(slugs)), '중복 slug'
    assert set(STAGE1_MOVED) <= {i[0] for i in ITEMS}
    items = []
    for (s, name, scene, w, h, layer, desc, hint, refs) in ITEMS:
        assert layer in LAYERS, layer
        it = dict(id=s, slug=s, name=name, scene=scene, cells=[w, h], canvas=[w * 16, h * 16], layer=layer, layer_ko=LAYERS[layer][0],
                  description=desc, palette_hint=hint, worker_v1=owner[s])
        if s in STAGE1_MOVED:
            kit, role = STAGE1_MOVED[s]; it.update(stage=1, stage_ko='1단계 기본(1판에서 옮김)', kit=kit, role=role, worker=owner[s])   # worker = 후보 파일 주인(1판). 2판 새 배정 없음
        else:
            it.update(stage=2, stage_ko='2단계 연출(기본이 선 뒤)', worker=owner[s])
        if s in setof: it['set_with'] = [x for x in setof[s] if x != s]
        if refs: it['v5_ref'] = v5_refs(refs)
        items.append(it)
    fset = {}
    for f in FOUNDATION: fset.setdefault((f[9], f[10]), []).append(f[0])
    for (s, name, scene, w, h, layer, desc, hint, refs, wk, kit, role) in FOUNDATION:
        assert layer in LAYERS, layer; assert wk in WORKERS2, wk
        it = dict(id=s, slug=s, name=name, scene=scene, cells=[w, h], canvas=[w * 16, h * 16], layer=layer, layer_ko=LAYERS[layer][0],
                  description=desc, palette_hint=hint, stage=1, stage_ko='1단계 기본(2판 새로)', kit=kit, role=role, worker=wk)
        if w == 4 and h == 3: it['autotile'] = 'quad3x3+inner'
        mates = [x for x in fset[(wk, kit)] if x != s]
        if mates: it['set_with'] = mates                    # 같은 작업자·같은 한 벌 = 한 식구(같은 방향 글자끼리 같게)
        if refs: it['v5_ref'] = v5_refs(refs)
        items.append(it)
    korder = {k: n for n, k in enumerate(list(KITS) + ['school', 'outdoor'])}
    items.sort(key=lambda i: (i['stage'], korder.get(i.get('kit'), 99)))   # 화면 순서: 1단계(한 벌 순) → 2단계
    cd = os.path.join(BASE, 'candidates-horror')
    for it in items:
        d = os.path.join(cd, it['slug']); os.makedirs(d, exist_ok=True)
        if it.get('v5_ref'): write_refs(d, it['v5_ref'])
        atomic_write(os.path.join(d, 'info.json'), json.dumps(it, ensure_ascii=False, indent=1) + '\n')
        shutil.copyfile(os.path.join(PAL_DIR, 'horror.pal'), os.path.join(d, 'palette.pal'))
    workers2 = {w: [f[0] for f in FOUNDATION if f[9] == w] for w in WORKERS2}
    kits = {k: dict(name=v[0], about=v[1], items=[i['slug'] for i in items if i.get('stage') == 1 and i.get('kit') == k]) for k, v in KITS.items()}
    jobs = dict(version=2, edition='2판(2026-09-30) — 1단계 기본 먼저, 연출은 2단계', set='horror',
                note='호러(쯔꾸르 인디 호러) 16px 조각 배정표 2판. 사용자 「우선은 기본이 되어야 할 타일들」 — 1단계 기본(벽면·천장 윗면·바닥·러너·문·창·계단·기둥·어둠 경계·기본 가구)을 '
                     '한 벌(kit) 단위로 먼저 찍고, 1판의 연출 기물은 2단계로 미룬다. 절차 WORKER-HORROR.md(2판), 조사 horror-foundation-study.md, 한 벌 방 조립 horror_room_compose.py. '
                     '팔레트 palette/horror.pal. items 에는 1판 66개(stage 1 옮김 17 · stage 2 연출 49)와 2판 새 기본이 함께 든다 — 후보·고른 기록은 지우지 않는다.',
                directions=DIRECTIONS2,
                directions_v1={'A': 'v5 실내 결을 따른 낡은 판', 'B': '명암·그림자 강화(어둠 속 한쪽 빛)', 'C': '실루엣 재해석(공포 과장)'},
                stages={'1': '기본 — 방을 깔 수 있는 바탕(한 벌 단위로 고른다)', '2': '연출 — 기본 위에 방마다 한두 개(1판 기물 대부분, 기본이 선 뒤)'},
                kits=kits, workers=workers2, workers_v1=out, sets=SETS, items=items)
    atomic_write(os.path.join(BASE, 'jobs-horror.json'), json.dumps(jobs, ensure_ascii=False, indent=1) + '\n')
    st = {1: 0, 2: 0}
    for i in items: st[i['stage']] += 1
    print(len(items), '기물 · 1단계', st[1], '(새', len(FOUNDATION), '· 옮김', len(STAGE1_MOVED), ') · 2단계', st[2])
    for w, l in workers2.items(): print(' ', w, len(l), ' '.join(l))

if __name__ == '__main__':
    main()
