# 저택·예술 도시 새 조각 등록표(이름 → 그림·메타). make_mansion-art-city.py 와 지도 모듈이 같이 쓴다.
# kind: object|tree|floor|wall|liquid|decal|walk|autotile · brows: 막히는 아랫줄 수(키 큰 부드러운 물체 1, 건물은 앞면 줄 수).
from mc_base import *
import mc_build as B, mc_props as P, mc_ground as G, mc_inside as MI, mc_imap as IM

PARTS = {}; META = {}; ORDER = []; SOFT = set()


def add(name, img, kind, ko, desc, rules, brows=1, soft=False, layer=None, role=None, keep=None):
    im = I(img)
    if im.width % T or im.height % T: im = pad16(im)
    PARTS[name] = im; ORDER.append(name)
    m = dict(kind=kind, ko=ko, desc=desc, rules=rules, brows=brows)
    if layer: m['layer'] = layer
    if role: m['role'] = role
    META[name] = m
    if soft: SOFT.add(name)
    if keep is not None: KEEP[name] = keep
    return im


KEEP = {}     # 지도에 쓰는 원본(dict: door·below 정보)


def build_all():
    # ================= 건물 =================
    h = B.mansion(); KEEP['mansion'] = h
    add('mansion', h, 'object', '귀족 저택', '17칸 대칭 회벽 저택: 짙은 붉은 기와 모임지붕, 가운데 3층(2층 아치 창·금 쐐기돌·불 켠 창), 정면 박공(크림 박공판·금 해살 원판·금 꼭지), '
        '기둥 넷 현관 위 발코니 난간과 금 항아리, 날개 2층 지붕 난간, 굴뚝 둘, 포도주빛 덧문.',
        '17×11칸. 앞면 아래 4줄 막힘(가운데 9칸은 6줄), 지붕·처마 칸은 걷기+가림. 문 = 왼쪽에서 9번째 칸 맨 아랫줄(현관 계단이 아래 칸으로 8px 내려온다). '
        '앞에 자갈 앞마당 4칸 이상, 문 앞 축에 분수·길. 영지 담 안 북쪽 가운데에 하나.', brows=4, role='building')
    h = B.gallery(); KEEP['gallery'] = h
    add('gallery', h, 'object', '화랑', '9칸 2층 전시관: 짙은 붉은 기와 위 유리 천창, 1층 큰 아치 진열창 넷(금 액자 그림 — 풍경·노을·정물·색면), 금 문틀 큰 문 + 진홍 걸개 둘, '
        '2층 금 원형 팔레트 간판(글자 없음).', '9×8칸. 앞면 아래 4줄 막힘, 문 = 가운데 칸. 앞에 대리석 광장, 문 양옆 꽃 항아리. 예술 거리 광장 북쪽에 하나.', brows=4, role='building')
    for nm, args, ko, d in (('shop_house', (5, 2, 2, 3, 'shop'), '화방 집', '1층 진열창에 금 액자 그림, 포도주·크림 줄무늬 차양, 쇠 팔 금 액자 간판.'),
                            ('shop_house_b', (6, 2, 2, 8, 'shop'), '화방 집(넓은)', '6칸 화방: 진열창 다섯·차양·금 액자 간판.'),
                            ('cafe_house', (6, 2, 2, 4, 'cafe'), '카페 집', '1층 불 켠 진열창과 차양, 김 나는 잔 간판(포도주 판).'),
                            ('atelier_house', (4, 3, 1, 2, 'atelier'), '화가 작업실 집', '3층 좁은 집: 맨 위층 전체가 쇠 살 큰 북향 창(작업실).'),
                            ('atelier_low', (5, 2, 1, 6, 'atelier'), '화가 작업실 집(2층)', '2층 집: 위층 큰 북향 창.'),
                            ('house_a', (5, 2, 2, 1, 'house'), '귀족풍 거리 집', '2층 회벽 집: 짙은 붉은 기와, 포도주 덧문, 꽃 상자, 아치 창 1층(무작위).'),
                            ('house_b', (5, 2, 2, 11, 'house'), '귀족풍 거리 집 둘', '같은 규칙, 다른 창·꽃 배치.'),
                            ('house_c', (4, 2, 1, 5, 'house'), '귀족풍 좁은 집', '4칸 2층 집.')):
        h = B.townhouse(*args); KEEP[nm] = h
        add(nm, h, 'object', ko, d, '%d칸 폭. 앞면 아래 %d줄 막힘, 지붕 칸 걷기+가림, 문 = 왼쪽에서 %d번째 칸 맨 아랫줄. 문 앞 1칸은 길. 줄지어 둘 때 폭·종류를 섞는다.' % (args[0], args[1] * 2, args[2] + 1),
            brows=args[1] * 2, role='building')
    add('gate_pier', B.gate_pier(), 'object', '귀족 문기둥', '회벽 + 모서리 돌 + 짙은 붉은 기와 갓 + 금 공 꼭지 문기둥(1×4).', '1×4칸, 아랫줄만 막힘. 대문(gate_iron) 양옆에 하나씩, 담 끝과 붙인다.', soft=True)
    add('gate_iron', P.gate_iron(), 'walk', '금 꼭지 쇠 대문', '안쪽으로 활짝 연 쇠 대문 두 짝과 위 둥근 금 아치 장식(3×2).', '3×2칸, 걷기(짝은 문기둥에 붙어 있다). 문기둥 둘 사이, 담 줄에. 앞뒤 1칸 비움.', brows=0)
    # ================= 소품 =================
    O = [
        ('easel_landscape', P.easel(0), '이젤(풍경)', '세 다리 나무 이젤 위 풍경 캔버스(1×2).', '1×2칸, 아랫줄만 막힘. 광장 가장자리·노점 곁에 1~3개(방향·그림을 섞어 덩이로).', 1, True),
        ('easel_flowers', P.easel(2, 1), '이젤(꽃 정물)', '이젤 위 꽃병 정물 캔버스(1×2).', '1×2칸, 아랫줄만 막힘. easel_landscape 와 섞어 쓴다.', 1, True),
        ('easel_sea', P.easel(1, 2), '이젤(노을 바다)', '이젤 위 노을 바다 캔버스(1×2).', '1×2칸, 아랫줄만 막힘. 물가·광장 동쪽에.', 1, True),
        ('easel_set', P.easel_set(), '화가 자리', '이젤 + 둥근 의자 + 팔레트·붓 통(2×2).', '2×2칸, 아랫줄 막힘. 광장 가장자리에 하나, 앞 1칸 비움.', 1, True),
        ('canvas_stack', P.canvas_stack(0), '캔버스 더미', '기대 세운 캔버스 넷(1×2, 위 4px).', '1칸, 막힘. 노점·작업실 문 곁에 1~2개.', 1, False),
        ('canvas_stack_b', P.canvas_stack(3), '캔버스 더미 둘', '다른 그림 조합(1×2).', '1칸, 막힘. canvas_stack 과 섞는다.', 1, False),
        ('painter_stall', P.painter_stall(0), '그림 노점', '포도주·크림 줄무늬 차양 노점: 탁자 위 작은 금 액자 셋, 앞에 기대 세운 캔버스 둘(3×3).', '3×3칸, 아래 2줄 막힘(차양 줄 걷기+가림). 광장·거리 가장자리에, 앞 1칸 비움. 2개 이상은 1칸 띄워 엇갈리게.', 2, False),
        ('art_screen', P.art_screen(0), '그림 진열판', '두 폭 접이식 포도주 천 판에 금 액자 넷(2×2).', '2×2칸, 아랫줄 막힘. 노점 곁·화랑 앞에.', 1, True),
        ('poster_column', P.poster_column(), '광고 기둥', '공연·전시 포스터(색면만, 글자 없음)를 두른 둥근 기둥과 초록 돔 갓·금 꼭지(1×3).', '1×3칸, 아랫줄만 막힘. 거리 모퉁이·광장 끝에 하나.', 1, True),
        ('sculpture_spiral', P.sculpture_spiral(), '나선 조각', '대리석 받침 위 대리석 나선 띠(1×2).', '1×2칸, 아랫줄만 막힘. 조각 광장 가장자리에 다른 조각과 섞어.', 1, True),
        ('sculpture_ring', P.sculpture_ring(), '금 고리 조각', '대리석 받침 위 기울어진 금 고리(1×2).', '1×2칸, 아랫줄만 막힘. 조각 광장.', 1, True),
        ('bust_pedestal', P.bust_pedestal(), '흉상 받침', '가는 대리석 받침 위 얼굴 없는 흉상과 월계관(1×2).', '1×2칸, 아랫줄만 막힘. 광장·저택 복도에 2~3개 간격을 두고.', 1, True),
        ('statue_muse', P.statue_muse(), '월계관 조각상', '계단 받침(금 띠) 위 옷자락 형상이 한 팔로 금 월계관을 든다(2×4, 얼굴 없음).', '2×4칸, 아랫줄만 막힘(받침). 광장 큰 분수 곁·축 끝에 하나.', 1, True),
        ('statue_winged', P.statue_winged(), '날개 조각상', '둥근 받침 위 크게 편 두 날개 형상(2×3, 얼굴 없음).', '2×3칸, 아랫줄만 막힘. 광장·정원 축 끝에.', 1, True),
        ('fountain_grand', P.fountain_grand(), '대리석 큰 분수', '금 띠 큰 수반 + 두 단 접시 + 금 솔방울, 떨어지는 물줄기(4×4).', '4×4칸, 아래 3줄 막힘(맨 윗줄 걷기+가림). 광장 한가운데 축 위에, 둘레 2칸 비움.', 3, False),
        ('fountain_garden', P.fountain_garden(), '정원 금 물고기 분수', '대리석 테 낮은 연못 가운데 금 물고기 조각이 물을 뿜는다(3×3).', '3×3칸, 아래 2줄 막힘. 저택 앞마당 문 축 위에.', 2, False),
        ('lamp_gilt', P.lamp_gilt(), '금 가로등', '검은 쇠 기둥(금 테) + 금 등롱(1×3).', '1×3칸, 아랫줄만 막힘. 길가 6~9칸 간격, 저택 현관 양옆.', 1, True),
        ('lamp_gilt_double', P.lamp_gilt_double(), '쌍등 금 가로등', '금 팔 둘에 등롱 둘(2×3).', '2×3칸, 기둥 칸 하나만 막힘. 광장 모서리.', 1, True),
        ('cafe_table', P.cafe_table(0), '카페 탁자', '포도주 식탁보 둥근 탁자 + 비스트로 쇠 의자 둘 + 잔·꽃(2×2).', '2×2칸, 아랫줄 막힘. 카페 앞 테라스에 2~4개 엇갈려.', 1, True),
        ('cafe_parasol', P.cafe_parasol(0), '카페 파라솔', '포도주·크림 파라솔 아래 탁자와 의자(3×3).', '3×3칸, 아랫줄 막힘(위 2줄 걷기+가림). 카페 테라스.', 1, True),
        ('cafe_parasol_b', P.cafe_parasol(5), '카페 파라솔 둘', '같은 파라솔, 다른 탁자 배치(3×3).', '3×3칸, cafe_parasol 과 섞는다.', 1, True),
        ('terrace_planter', P.terrace_planter(), '테라스 꽃 상자', '긴 나무 상자 위 붉은·분홍 꽃(2×1).', '2×1칸, 막힘. 카페 테라스 가장자리를 1칸 틈 두고 잇는다.', 1, False),
        ('bench_marble', P.bench_marble(), '대리석 긴 의자', '받침 둘 위 대리석 판(2×1).', '2×1칸, 막힘. 분수·정원 길가에, 분수를 향해.', 1, False),
        ('urn_flowers', P.urn_flowers(), '꽃 항아리', '대리석 받침 위 금 테 돌 항아리에 붉은 꽃(1×2).', '1×2칸, 아랫줄만 막힘. 문·계단 양옆 쌍으로.', 1, True),
        ('topiary_spiral', P.topiary('spiral'), '나선 회양목', '금 테 포도주 화분 속 네 단 공 다듬기(1×2).', '1×2칸, 아랫줄만 막힘. 앞마당 모서리·현관 곁 쌍으로.', 1, True),
        ('topiary_cone', P.topiary('cone'), '원뿔 회양목', '금 테 화분 속 원뿔 다듬기(1×2).', '1×2칸, 아랫줄만 막힘. 정원 길 모퉁이.', 1, True),
        ('topiary_ball', P.topiary('ball'), '공 회양목', '작은 포도주 화분 속 공 다듬기(1×1).', '1칸, 막힘. 길 양옆 쌍으로.', 1, False),
        ('parterre_bed', P.parterre_bed(0), '회양목 장미 화단', '낮게 다듬은 회양목 테 안 장미 덩이(3×2).', '3×2칸, 2줄 막힘. 정원 길 양옆에 대칭 쌍으로, 화단끼리 1칸 띄운다.', 2, False),
        ('parterre_bed_b', P.parterre_bed(4), '회양목 장미 화단 둘', '다른 장미 배치(3×2).', '3×2칸, parterre_bed 와 번갈아.', 2, False),
        ('rose_arch', P.rose_arch(), '장미 아치', '쇠 아치를 덮은 장미 넝쿨(3×3).', '3×3칸, 기둥 두 칸만 막힘(가운데 걷는 길, 위는 걷기+가림). 정원 길 위에 걸친다.', 1, True),
        ('sundial', P.sundial(), '해시계', '대리석 기둥 위 금 원판 해시계(1×2).', '1×2칸, 아랫줄만 막힘. 정원 길 교차점·축 끝.', 1, True),
        ('carriage_noble', P.carriage_noble(), '귀족 마차', '검은 남빛 옻칠 몸통·금 테·바퀴 둘(4×3).', '4×3칸, 아랫줄 막힘. 저택 앞마당 한쪽.', 1, False),
    ]
    for (n, im, ko, d, r, br, sf) in O: add(n, im, 'object', ko, d, r, br, soft=sf)
    # ================= 바닥·오토타일 =================
    add('ground-marble-plaza', G.ground_marble(), 'floor', '조각 광장 대리석', '크림 대리석 큰 판(표본은 24px 판, 지도는 32px 판), 판 네 귀 몇 곳에 포도주 마름모 상감 + 금 점(3×3 표본).', '광장·화랑 앞. 큰 분수 둘레. 3×3 이어 붙여도 이음새 없음(표본 주기 48).', 0, layer='lower')
    add('ground-brick-basket', G.ground_brick(), 'floor', '예술 거리 벽돌', '테라코타 벽돌 바구니 짜임(3×3 표본).', '예술 거리 골목·광장 사이 길. 폭 3~4칸.', 0, layer='lower')
    add('autotile-gravel-path', G.autotile_gravel(), 'autotile', '자갈 정원길', '잔디 위 자갈 길, 이웃 없는 쪽은 들쭉날쭉한 풀 가장자리 16변형.', '정원 길·화단 사이(폭 1~3칸). 걷기.', 0, layer='lower', role='terrain')
    add('autotile-gilt-fence', G.autotile_fence(), 'autotile', '금 꼭지 쇠 울타리', '쇠 창살 + 금 창끝, 기둥 금 공 머리 16변형.', '영지 경계·광장 화단 둘레. 모든 변형 막힘. 문 자리에서 끊는다.', 1, layer='upper', role='fence')
    add('autotile-box-hedge', G.autotile_hedge(), 'autotile', '다듬은 회양목 생울타리', '윗면 밝음 + 남쪽 앞면 16변형(끝은 둥글게).', '정원 길 양옆·화단 둘레. 모든 변형 막힘. 교차로에서 끊는다.', 1, layer='upper', role='fence')
    # ================= 실내 =================
    add('ground-parquet-staggered', K_sample('mc_herring'), 'floor', '엇갈림 쪽마루', '4px 세로 널이 12px 마다 엇갈린 꿀빛 쪽마루(3×3 표본).', '응접실·서재 바닥. 융단과 함께.', 0, layer='lower')
    add('ground-marble-rose', K_sample('mc_rose'), 'floor', '장미 대리석 마름모', '크림·장미 대리석 대각 마름모, 꼭짓점 금 점(3×3 표본).', '대홀·복도 바닥. 진홍 깔개와 함께.', 0, layer='lower')
    add('face_cream_3h', MI.face_sample('mc_cream', 3, 3), 'wall', '저택 크림 비단 벽(3줄)', '금 처마 몰딩·크림 비단 벽지(금 마름모 점)·금 띠·흰 징두리 판·걸레받이(3칸 폭 표본).', '대홀·응접실·복도 천장 밑 3줄. 무늬는 칸 x 로 이어진다.', 0, role='wall')
    add('face_library_3h', MI.face_sample('mc_lib', 3, 3), 'wall', '서재 마호가니 판벽(3줄)', '금 처마 몰딩 + 짙은 마호가니 들어간 판벽(3칸 폭 표본).', '서재 천장 밑 3줄. 책장을 벽에 붙여 세운다.', 0, role='wall')
    I_ = [
        ('grand_stair', MI.grand_stair(), 'walk', '대홀 큰 계단', '대리석 여섯 단 + 진홍 깔개(금 누름대), 양옆 금 난간동자 난간과 기둥머리 금 공(4×3).', '4×3칸, 걷기(맨 윗줄 = 위층 이동 칸). 대홀 북쪽 벽 앞면 바로 아래 바닥 위에, 그 위 앞면에 stair_arch_wide.', 0, False),
        ('stair_arch_wide', IM.stair_arch_wide(), 'decal', '큰 계단 벽 구멍', '크림 아치 테 + 금 쐐기돌, 안쪽으로 위층 계단이 어둠 속에 이어진다(4×3).', '4×3칸 장식(벽 앞면 3줄 위). grand_stair 바로 위 같은 열.', 0, False),
        ('fireplace', MI.fireplace(), 'object', '대리석 벽난로', '크림 대리석 선반·기둥, 불 피운 아궁이, 선반 위 금 촛대·시계, 위 금 거울(3×3).', '3×3칸, 맨 아랫줄만 막힘(위 2줄은 벽 앞면 위). 방 북쪽 벽 바로 아래 줄에 x 를 맞춘다. 앞에 융단·소파.', 1, False),
        ('sofa', MI.sofa(), 'object', '진홍 벨벳 소파', '금테 등받이(단추 누빔), 방석 셋, 둥근 팔걸이(3×2).', '3×2칸, 2줄 막힘. 벽난로를 향해 융단 위에, 찻상과 팔걸이 의자로 둘러 묶음.', 2, False),
        ('armchair', MI.armchair('s'), '팔걸이 의자(앞)', '높은 금테 등받이 진홍 의자, 앞을 본다(1×2).', '1×2칸, 아랫줄만 막힘. 소파·책상 곁에.', 1, True),
        ('armchair_back', MI.armchair('n'), '팔걸이 의자(뒤)', '같은 의자를 뒤에서 본 모습(1×2).', '1×2칸, 아랫줄만 막힘. 북쪽(벽난로·책상)을 향해 앉는 자리.', 1, True),
        ('tea_table', MI.tea_table(), '낮은 찻상', '대리석 윗면·금 다리, 은 주전자와 잔(2×1).', '2×1칸, 막힘. 소파 앞.', 1, False),
        ('bookcase', MI.bookcase(0), '서재 책장', '금 갓 장식 마호가니 책장, 다섯 칸 색 책등(2×3).', '2×3칸, 아랫줄 막힘(위 2줄은 벽 앞면 위). 서재 북쪽 벽을 따라 1칸 틈 섞어 늘어놓는다.', 1, False),
        ('bookcase_b', MI.bookcase(1), '서재 책장 둘', '다른 책 배치(2×3).', '2×3칸, bookcase 와 번갈아.', 1, False),
        ('reading_desk', MI.reading_desk(), '서재 책상', '초록 가죽 판 마호가니 책상 위 펼친 책·잉크병·깃펜·초록 갓 등(3×2).', '3×2칸, 2줄 막힘. 서재 가운데 융단 위, 뒤(남)에 팔걸이 의자.', 2, False),
        ('globe', MI.globe(), '지구본', '금 자오선 고리와 세 다리 받침의 지구본(1×2).', '1×2칸, 아랫줄만 막힘. 서재 책상 곁.', 1, True),
        ('dining_table', MI.dining_table(4), 'object', '긴 식탁', '흰 식탁보·포도주 러너 위 금 촛대 둘·과일 그릇·접시 줄(10×3).', '10×3칸, 3줄 막힘. 식당 가운데, 위(북)에 dining_chair_n, 아래(남)에 dining_chair_s, 양 끝에 하나씩.', 3, False),
        ('dining_chair_n', MI.dining_chair('n'), '식당 의자(위쪽)', '식탁 북쪽에 놓는 높은 등받이 의자(1×2).', '1×2칸, 식탁 위 줄에 겹쳐 놓는다(식탁이 막는다). 2칸 간격.', 0, False),
        ('dining_chair_s', MI.dining_chair('s'), '식당 의자(아래쪽)', '식탁 남쪽, 등받이가 앞으로 보이는 의자(1×2).', '1×2칸, 아랫줄만 막힘. 식탁 바로 아래 줄, 2칸 간격.', 1, True),
        ('sideboard', MI.sideboard(), '식당 찬장', '서랍장 위 은 쟁반·포도주 병·금 촛대(3×2).', '3×2칸, 아랫줄 막힘(위 줄은 벽 앞면 위). 식당 북쪽 벽 아래.', 1, False),
        ('china_cabinet', MI.china_cabinet(), '그릇장', '유리문 속 흰 접시·찻잔, 금 갓 장식(2×3).', '2×3칸, 아랫줄 막힘. 식당 벽가 양 끝.', 1, False),
        ('grandfather_clock', MI.grandfather_clock(), '괘종시계', '마호가니 긴 몸통, 금 테 시계판(눈금만), 금 추(1×3).', '1×3칸, 아랫줄만 막힘. 대홀·복도 벽가 하나.', 1, True),
        ('candelabra', MI.candelabra(), '서 있는 금 촛대', '세 갈래 금 팔에 초 셋(1×2).', '1×2칸, 아랫줄만 막힘. 방 모서리·식탁 곁. 빛무리와 함께.', 1, True),
        ('wall_painting_landscape', MI.wall_painting(0), 'decal', '벽 그림(풍경)', '두꺼운 금 액자 속 풍경(2×2).', '2×2칸 장식(벽 앞면 위). 방마다 1~3개, 벽등 사이.', 0, False),
        ('wall_painting_sea', MI.wall_painting(1), 'decal', '벽 그림(노을 바다)', '금 액자 속 노을 바다(2×2).', '2×2칸 장식(벽 앞면 위).', 0, False),
        ('wall_painting_still', MI.wall_painting(2), 'decal', '벽 그림(꽃 정물)', '금 액자 속 꽃병 정물(2×2).', '2×2칸 장식(벽 앞면 위).', 0, False),
        ('wall_painting_abstract', MI.wall_painting(3), 'decal', '벽 그림(색면)', '금 액자 속 색면 추상(2×2).', '2×2칸 장식(벽 앞면 위). 화랑·서재.', 0, False),
        ('wall_painting_night', MI.wall_painting(4), 'decal', '벽 그림(밤하늘)', '금 액자 속 별과 달 밤하늘(2×2).', '2×2칸 장식(벽 앞면 위).', 0, False),
        ('mirror_gilt', MI.mirror_gilt(), 'decal', '금 거울', '조개 장식 둥근 금테 은빛 거울(2×2).', '2×2칸 장식(벽 앞면 위). 응접실·현관.', 0, False),
        ('rug_persian', MI.rug_persian(), 'decal', '긴 융단', '포도주 바탕, 남빛·금 테, 가운데 금 마름모 메달리온, 양끝 술(5×3).', '5×3칸 바닥 장식(걷기). 소파·책상 묶음 아래.', 0, False),
    ]
    for e in I_:
        if len(e) == 7: e = (e[0], e[1], 'object') + tuple(e[2:])
        n, im, kind, ko, d, r, br, sf = e; add(n, im, kind, ko, d, r, br, soft=sf)
    return PARTS


def K_sample(tag):
    return MI.K.SAMPLES[tag].copy()
