# 고딕 마을 키트 목록 — 조각 이름 → (그리기 함수, 메타). 내보내기(parts/*.png · partmeta.json · parts.md)와 지도가 같이 쓴다.
from gv_props import *
import gv_houses as HS, gv_church as CHU, gv_ground as GR, gv_auto as AU
import rv_props as VP

def _vp(fn, k=0.92): return lambda: G(fn(), k)
def _dim(im, k):
    a = np.array(im).astype(np.float64); a[..., :3] = a[..., :3] * k
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8), 'RGBA')
def _rp(fn, k=1.0): return (lambda: _dim(fn(), k)) if k != 1.0 else fn

ROAD_RULE = "3x3 이어 붙여도 이음새가 없다."
K = {}
def k(name, fn, kind, ko, desc, rules, brows=0, role=None, layer=None):
    m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules, 'brows': brows}
    if role: m['role'] = role
    if layer: m['layer'] = layer
    if kind == 'autotile': m['passable'] = role != 'fence'
    K[name] = (fn, m)

# ---------------------------------------------------------------- 맨 바탕 표본(아래층, 걷기)
k('ground-deadgrass', lambda: GR.ground_sample('ground-deadgrass'), 'floor', '시든 회록 풀밭',
  '버들항 풀 칸들(잔디·초원 점·그늘·닳은 풀)의 결을 그대로 두고 밝기만 시든 회록·회갈로 옮긴 마을 기본 땅, 바랜 이삭 점.',
  '마을 바깥·마당·묘지의 기본 바닥. 맨 먼저 넓게 깐다. ' + ROAD_RULE, 0, 'terrain', 'lower')
k('ground-mudcobble', lambda: GR.ground_sample('ground-mudcobble'), 'floor', '질척한 검은 자갈길',
  '버들항 회색 자갈 결을 청회 석재로 한 단 어둡게, 돌 틈은 흑회 진흙, 틈 몇 곳에 고인 물빛, 진흙 번진 덩이.',
  '큰길·우물 광장 바닥(속). 풀과 만나는 가장자리는 autotile-mudlane 으로 덮어 들쭉날쭉하게 끝낸다. ' + ROAD_RULE, 0, 'terrain', 'lower')
k('ground-mire', lambda: GR.ground_sample('ground-mire'), 'floor', '진흙땅',
  '버들항 흙길 결을 흑회 진흙 램프로, 젖은 윗모 빛 줄, 작은 조약돌. 걷는 질척한 평지.',
  '골목·뒷마당·밭·묘지 흙길. 웅덩이 덩이는 autotile-mire 로 위에 덧그린다. ' + ROAD_RULE, 0, 'terrain', 'lower')
k('ground-churchflag', lambda: GR.ground_sample('ground-churchflag'), 'floor', '교회 앞 청회 판석',
  '한 칸에 두 줄 엇갈린 청회 판석, 위·왼 모 밝음, 줄눈에 이끼.',
  '교회 문 앞 마당·묘지 안 길·묘소 앞. 넓게 깔지 말고 건물 앞 4~8칸 폭으로. ' + ROAD_RULE, 0, 'terrain', 'lower')

# ---------------------------------------------------------------- 16변형 오토타일
k('autotile-dewgrass', AU.autotile_dewgrass, 'autotile', '안개 낀 이슬 풀',
  '시든 풀밭 위 키 큰 이슬 풀 덩이 16변형(위 1·오른 2·아래 4·왼 8): 안개 내린 청회록 바탕, 풀포기와 잎끝 이슬, 가장자리 풀잎이 들쭉날쭉 삐져나온다.',
  '아래층, 걷기. ground-deadgrass 위에 3~10칸 덩이로(사각형·일렬 금지). 우물가·묘지 가장자리·길가 그늘·고목 밑.', 0, 'terrain', 'lower')
k('autotile-mire', AU.autotile_mire, 'autotile', '진창 웅덩이',
  '질척한 진창 덩이 16변형: 속은 검은 물 막이 덮인 진흙(흐린 하늘 빛 가로 줄·거품), 가장자리는 짓이겨진 밝은 진흙 둔덕, 바깥엔 튄 진흙 점.',
  '아래층, 걷기(발 빠지는 연출은 이벤트 몫). 길 가장자리·광장 낮은 곳·밭·우물 둘레에 2~8칸 덩이. 문 앞 칸은 피한다.', 0, 'terrain', 'lower')
k('autotile-leafbone', AU.autotile_leafbone, 'autotile', '낙엽·뼈 흩어진 땅',
  '썩은 갈적·회갈 낙엽이 흙 위에 깔린 덩이 16변형, 가장자리로 갈수록 잎이 성겨지고 외톨이·모서리 칸에 작은 짐승 뼈 토막.',
  '아래층, 걷기. 고목 밑·묘지 비석 사이·담 밑에 3~12칸 덩이. 길 한가운데는 피한다.', 0, 'terrain', 'lower')
k('autotile-mudlane', AU.autotile_mudlane, 'autotile', '진흙 자갈 골목',
  '풀 위로 이어지는 진흙 자갈 길 16변형: 속은 ground-mudcobble 결, 가장자리 2화소는 자갈이 성겨지며 진흙이 드러나고 바깥은 풀이 먹어 든다.',
  '아래층, 걷기. 길 붓(lay_path)으로 폭 2~3칸. 큰길 속은 ground-mudcobble, 그 둘레·샛길·집 앞길을 이 오토타일로.', 0, 'terrain', 'lower')
k('autotile-mudpatch', AU.autotile_mudpatch, 'autotile', '진흙땅 덩이',
  '풀 위 진흙땅 덩이 16변형: 속은 ground-mire 결, 가장자리는 흙이 얇아져 풀이 비치고 바깥엔 흙 튄 점.',
  '아래층, 걷기. 밭·뒷마당·묘지 흙을 풀 위에 덩이로(사각형 금지). 덩이 깊은 속(이웃 8칸 모두 덩이)은 ground-mire 로 깔아도 된다.', 0, 'terrain', 'lower')
k('autotile-ironfence', AU.autotile_ironfence, 'autotile', '창끝 검은 쇠 울타리',
  '돌 받침 위 창끝 쇠살 울타리 16변형(동서는 앞모습 살·가로대 둘, 남북은 3/4 윗면 줄), 모서리·끝은 공 머리 네모 기둥, 녹 얼룩.',
  '위층, 모든 변형 막힘. 묘지·교회 마당·저택 앞 둘레. 출입 틈은 끝 변형으로 끊고 그 자리에 cemetery-gate 를 둔다.', 1, 'fence', 'upper')

# ---------------------------------------------------------------- 건물·랜드마크
k('church-spire', CHU.church_spire, 'object', '첨탑 고딕 교회',
  '왼쪽 가파른 슬레이트 첨탑 종탑(종실·뾰족 창) + 뾰족 박공 신랑(장미창·뾰족 아치 창 둘·붉은 큰 문·버팀벽)의 청회 석조 교회(11x17칸).',
  '마을 북쪽 앵커 하나. 아래 3줄 막힘(위는 걷기+가림). 문은 신랑 가운데(7·8열) — 문 앞 1칸 비우고 ground-churchflag 마당을 4~6칸 둔다.', 3, 'building')
k('house-gable-tall', lambda: HS.gable_house(1), 'object', '뾰족 박공 3층 목골집',
  '박공이 앞을 향한 4칸 폭 3층 집: 가파른 뾰족 박공(검은 세로 널·다락 창), 흑갈 목골·회색 회벽 위층, 돌 1층, 판자 친 창·덧문, 창 하나에 호박빛, 검붉은 문.',
  '아래 2줄 막힘. 문 앞 1칸은 길(autotile-mudlane). 큰길 양쪽에 높이 다른 집과 섞어 줄 세운다(같은 집 연달아 금지).', 2, 'building')
k('house-gable-wide', lambda: HS.gable_house(2, 5, 2, 0.7, plan=('lit', 'board', 'dark', 'board', 'dark')), 'object', '넓은 뾰족 박공 2층집',
  '5칸 폭 2층 박공 정면 집: 검은 널 박공·다락 창, 목골 2층, 돌 1층, 판자 친 창, 검붉은 문.',
  '아래 2줄 막힘. 문 앞 1칸은 길. 광장 둘레·큰길 모퉁이.', 2, 'building')
k('house-gable-small', lambda: HS.gable_house(4, 4, 2, 0.84, plan=('board', 'dark', 'shut', 'lit'), red=False), 'object', '좁은 뾰족 박공 2층집',
  '4칸 폭 2층 집, 더 가파른 박공, 창은 판자·닫힌 덧문, 나무 문.',
  '아래 2줄 막힘. 골목·마을 가장자리. 3층 집 옆에 두어 지붕선이 들쭉날쭉하게.', 2, 'building')
k('house-cross-gable', HS.cross_gable_house, 'object', '교차 박공 긴 집',
  '7칸 폭 2층 긴 집: 가파른 우진각 지붕 가운데 앞으로 튀어나온 뾰족 박공(다락 불빛), 굴뚝, 돌 1층·목골 2층, 판자 친 창, 검붉은 문.',
  '아래 2줄 막힘. 문은 가운데 칸. 광장 남쪽·큰길 끝의 큰 집(촌장·의원 집).', 2, 'building')
k('cottage-gable', HS.cottage, 'object', '뾰족 박공 돌 오두막',
  '4칸 폭 단층 돌 오두막: 가파른 박공(검은 널·다락 창), 창 하나 호박빛·하나 판자.',
  '아래 2줄 막힘. 마을 바깥 밭·묘지지기 집. 둘레에 진흙땅·울타리.', 2, 'building')
k('house-crooked', HS.crooked_house, 'object', '기운 좁은 3층집',
  '3칸 폭 3층 뾰족 박공 집이 오른쪽으로 살짝 기울었다: 창 거의 판자, 다락 창 하나에 불.',
  '아래 2줄 막힘. 문은 가운데 칸. 골목 끝·집 사이 틈에 한 채만(반복 금지).', 2, 'building')
k('house-boarded', HS.boarded_house, 'object', '버려진 판자 집',
  '5칸 폭 2층 돌집: 용마루가 꺼진 슬레이트 지붕 구멍, 판자로 막은 문과 창, 무너진 굴뚝. 불빛 없음.',
  '아래 2줄 막힘. 문 판자 칸은 조사 이벤트. 마을 가장자리·묘지 옆.', 2, 'building')
k('house-stair', HS.stair_house, 'object', '바깥 돌계단 3층집',
  '6칸 폭 3층 집: 1층 벽을 따라 2층 층계참으로 오르는 돌 바깥 계단(쇠 난간), 덧문 창, 창 하나 불빛.',
  '아래 2줄 막힘. 계단 아래 칸이 문 자리. 광장 모퉁이·큰길.', 2, 'building')
k('tavern-house', HS.tavern, 'object', '여관 겸 주점',
  '5칸 폭 2층 가게 집: 1층 나무 셔터와 찢긴 차양, 문 옆 빈 간판 걸이(글자 없음), 2층 창 하나에 불.',
  '아래 2줄 막힘. 문은 왼쪽 둘째 칸. 우물 광장 가에 하나 — 여관·주점 이벤트.', 2, 'building')

# ---------------------------------------------------------------- 묘지
k('cemetery-gate', _rp(RP.iron_gate, 0.74), 'object', '묘지 쇠 대문',
  '돌 기둥 둘(갓돌) 사이 반쯤 열린 녹슨 쇠살문, 한 짝은 경첩이 빠져 기울었다(3x3칸).',
  '3칸 폭, 밑 1줄 막힘(가운데 칸은 문 이벤트로 연다). autotile-ironfence 의 틈 자리에 둔다.', 1, 'prop')
k('crypt-mausoleum', _vp(VP.crypt_entrance, 0.68), 'object', '지하 묘소 입구',
  '박공 갓돌 돌 문간, 아치 속 어둠과 열린 쇠창살로 땅 밑 계단이 내려간다(3x3칸).',
  '묘지 안쪽 끝. 아래 3줄 막힘 — 가운데 계단 칸 앞 1칸에 이동 이벤트(다음 던전).', 3, 'building')
k('grave-wall-long', _vp(VP.grave_wall_long, 0.64), 'object', '이끼 낀 묘지 돌담',
  '이끼·담쟁이 낀 청회 마름돌 낮은 담(6x2칸), 갓돌 몇 개 빠짐.', '아래 1줄 막힘. 묘지 한쪽 경계를 쇠 울타리 대신 돌담으로.', 1, 'wall')
k('grave-wall-broken', _vp(VP.grave_wall_broken, 0.64), 'object', '무너진 묘지 돌담',
  '가운데가 무너져 낮아진 묘지 돌담(5x2칸), 틈으로 넘어갈 수 없다.', '아래 1줄 막힘. 긴 돌담 사이에 끼워 단조로움을 깬다.', 1, 'wall')
k('grave-wall-end', _vp(VP.grave_wall_end, 0.64), 'object', '묘지 돌담 끝',
  '점점 낮아지며 끝나는 돌담 끝(3x2칸).', '아래 1줄 막힘. 돌담이 울타리·길과 만나는 끝에.', 1, 'wall')
k('tomb-obelisk', tomb_obelisk, 'object', '오벨리스크 묘비',
  '두 단 받침 위 가늘어지는 네모 돌기둥과 피라미드 머리(1x3칸), 글자 없는 빈 새김 홈.',
  '밑 1칸 막힘, 위 2칸은 걷기+가림. 묘지 가운데·지체 높은 무덤 자리에 1~2개.', 1, 'prop')
k('tomb-cross-stone', tomb_cross_stone, 'object', '고리 돌 십자 묘비',
  '받침돌 위 고리 두른 돌 십자(1x2칸), 이끼 얼룩.', '밑 1칸 막힘. 비석 줄 사이에 흐트러지게(격자 금지).', 1, 'prop')
k('tomb-cracked', _vp(VP.tomb_cracked, 0.78), 'object', '금 간 비석', '가운데 갈라진 둥근 머리 비석(1칸), 이끼·마른 풀.',
  '1칸 막힘. 묘지에 흐트러진 줄로(격자 금지).', 1, 'prop')
k('tomb-broken', _vp(VP.tomb_broken, 0.78), 'object', '부러진 비석', '윗동이 부러져 옆에 떨어진 비석(1칸).', '1칸 막힘. 오래된 묘지 구석.', 1, 'prop')
k('cross-crooked', _vp(VP.cross_crooked), 'object', '기운 나무 십자', '비스듬히 기운 나무 십자 묘표(1x2칸).', '밑 1칸 막힘. 흙무덤 머리 쪽·가난한 무덤 줄.', 1, 'prop')
k('grave-mound', grave_mound, 'object', '흙무덤', '길쭉한 흙 둔덕과 머리 쪽 기운 나무 말뚝 표식(2x1칸), 시든 풀.',
  '2칸 막힘(한 줄). 새 무덤 줄·묘지기 오두막 옆. 비석과 섞어 흐트러지게.', 1, 'prop')
k('statue-mourner', _rp(RP.statue_weathered, 0.84), 'object', '닳은 두건 석상',
  '두 단 받침 위 두건 쓴 망토 형상(얼굴 없음), 지팡이, 부러진 팔, 이끼(2x3칸).',
  '아래 1줄 막힘, 위는 걷기+가림. 묘지 가운데·교회 마당 모퉁이에 하나.', 1, 'prop')
k('coffin-trestle', coffin_trestle, 'object', '받침대 위 나무 관',
  '두 X 받침 위 어깨 넓은 육각 나무 관(뚜껑 닫힘·쇠 손잡이, 2x2칸).',
  '아래 1줄 막힘. 장의사 집 앞·교회 문 옆·묘지 새 무덤 곁에 하나.', 1, 'prop')

# ---------------------------------------------------------------- 마을 소품
k('well-roofed', well_roofed, 'object', '지붕 덮인 돌 우물',
  '둥근 마름돌 우물통(검은 물), 나무 기둥 위 가파른 널 지붕, 도르래 굴대·밧줄·두레박(2x3칸).',
  '아래 1줄 막힘(우물통), 위 2줄 걷기+가림. 우물 광장 가운데에 하나, 둘레 2칸 비움.', 1, 'prop')
k('well-dry', _vp(VP.well_dry, 0.78), 'object', '마른 우물', '기둥 하나가 부러져 가로대가 떨어진 마른 돌 우물(2x3칸), 거미줄.',
  '아래 1줄 막힘. 마을 가장자리·폐가 마당.', 1, 'prop')
k('lamppost-gas', _rp(RP.lamppost_lit), 'object', '쇠 가로등', '검은 쇠 기둥 꼭대기 사각 등에 흐린 호박빛(1x3칸).',
  '밑 1칸 막힘, 위 2칸 걷기+가림. 큰길·광장 가장자리에 6~10칸 간격(일렬로 촘촘히 금지).', 1, 'prop')
k('lamp-double', _rp(RP.lamp_double_lit), 'object', '두 갈래 가로등', '가운데 쇠 기둥 양팔에 매단 등 둘(2x3칸).',
  '밑 1줄 막힘. 광장 양쪽·교회 마당 입구에 한 쌍.', 1, 'prop')
k('lamp-wall', _rp(RP.lamp_wall), 'decal', '벽 등', '벽에서 나온 쇠 까치발에 매단 등(1x2칸, 위층 덧그림).',
  '집 벽 앞면(문 옆)에 덧그린다. 걷기 칸을 막지 않는다.', 0, 'prop')
k('notice-column', _rp(RP.notice_column, 0.86), 'object', '광고 기둥', '둥근 돌 기둥에 찢긴 빈 종이(글자 없음)가 겹겹이, 쇠 갓(1x3칸).',
  '밑 1칸 막힘. 광장 모퉁이에 하나 — 소문·현상수배 이벤트.', 1, 'prop')
k('bench-iron', _rp(RP.bench_wet), 'object', '쇠 다리 의자', '쇠 다리 나무 의자(2x1칸).', '1줄 막힘. 우물·교회 마당 가.', 1, 'prop')
k('barrels-stack', _rp(RP.barrels_wet), 'object', '술통 더미', '쇠 테 나무 술통 셋(2x2칸).', '아래 1줄 막힘. 주점 옆·골목.', 1, 'prop')
k('crates-tarp', _rp(RP.crates_tarp), 'object', '방수포 상자 더미', '나무 상자 셋을 쌓고 방수포를 밧줄로 묶었다(2x2칸).', '아래 1줄 막힘. 집 옆·마차 곁.', 1, 'prop')
k('rain-barrel', _rp(RP.rain_barrel), 'object', '빗물 통', '빗물 받는 쇠 테 나무 통(1x2칸).', '밑 1칸 막힘. 집 모퉁이 홈통 밑.', 1, 'prop')
k('cart-tarp', _rp(RP.cart_tarp), 'object', '덮개 씌운 수레', '방수포 덮은 짐 수레와 바퀴(2x2칸).', '아래 1줄 막힘. 광장·여관 앞.', 1, 'prop')
k('wayside-shrine', wayside_shrine, 'object', '길가 작은 사당', '나무 기둥 위 지붕 얹은 상자 감실과 촛불, 밑동 시든 꽃(1x3칸).',
  '밑 1칸 막힘, 위 2칸 걷기+가림. 마을 어귀·갈림길에 하나.', 1, 'prop')
k('scarecrow-tattered', _vp(VP.scarecrow_tattered), 'object', '누더기 허수아비', '누더기 옷의 허수아비(1x2칸).', '밑 1칸 막힘. 밭 가운데.', 1, 'prop')
k('crow-post', _vp(VP.crow_post), 'object', '까마귀 앉은 말뚝', '부러진 울타리 말뚝 꼭대기에 까마귀(1x2칸).', '밑 1칸 막힘. 밭·묘지 가장자리.', 1, 'prop')
k('fence-fallen', _vp(VP.fence_fallen), 'decal', '쓰러진 나무 울타리', '땅에 쓰러진 나무 울타리 토막(2x1칸).', '걷는 장식. 밭 둘레 끊긴 자리.', 0, 'prop')

# ---------------------------------------------------------------- 나무
k('dead-tree-crows', dead_tree_crows, 'tree', '까마귀 떼 고목', '가지마다 까마귀 넷이 앉은 잎 없는 큰 고목(3x4칸).',
  '줄기 1줄만 막힘, 위는 걷기+가림. 마을 어귀·묘지에 하나(앵커 표지).', 1, 'prop')
k('dead-tree-large', _vp(VP.dead_tree_large), 'tree', '큰 고목', '굵게 뒤틀린 줄기·옹이 구멍·앙상한 가지의 잎 없는 고목(3x4칸).',
  '줄기 1줄만 막힘. 2~3그루씩 덩이로(일렬 금지), 밑에 autotile-leafbone.', 1, 'prop')
k('dead-tree-crooked', _vp(VP.dead_tree_crooked), 'tree', '기운 고목', '왼쪽으로 기운 부러진 고목, 가지에 까마귀(2x3칸).', '줄기 1줄만 막힘. 큰 고목 곁.', 1, 'prop')
k('dead-sapling', _vp(VP.dead_sapling), 'tree', '마른 어린 나무', '가는 줄기에 잔가지(1x2칸).', '밑 1칸 막힘. 집 마당·담 밑.', 1, 'prop')
k('dead-bush', _vp(VP.dead_bush), 'object', '마른 덤불', '앙상한 마른 덤불(1칸).', '1칸 막힘. 길가·담 밑에 2~3개 덩이.', 1, 'prop')
k('stump-dead', _vp(VP.stump_burnt), 'object', '검은 그루터기', '갈라진 윗면의 검은 그루터기(1칸).', '1칸 막힘. 고목 덩이 곁.', 1, 'prop')

# ---------------------------------------------------------------- 바닥 덧그림(걷기)
k('crows-ground', _vp(VP.crows_ground), 'decal', '땅 위 까마귀', '땅을 쪼는 까마귀와 고개 든 까마귀(1칸).', '걷는 장식(사람 아래). 광장·밭·묘지에 2~4곳.', 0, 'prop')
k('leaves-scatter', leaves_scatter, 'decal', '흩어진 낙엽', '갈적·회갈 낙엽 열 몇 장(1칸).', '걷는 장식. 고목 밑·담 밑·길가에 흩어서.', 0, 'prop')
k('bones-scatter', bones_scatter, 'decal', '흩어진 짐승 뼈', '바랜 작은 짐승 뼈 토막·갈비 조각(1칸, 피 없음).', '걷는 장식. 묘지·고목 밑에 1~2곳만.', 0, 'prop')
k('puddle-mud', puddle_mud, 'decal', '진흙 물웅덩이', '진흙 둔덕 테 + 흐린 하늘 비친 검은 물(2x1칸).', '걷는 장식. 자갈길·진흙땅 위 낮은 곳.', 0, 'prop')
k('fog-bank', _vp(VP.fog_bank), 'decal', '안개 덩이', '낮게 깔린 회백색 반투명 안개(3x2칸).', '덧그림. 묘지·광장 가장자리에 화면당 2~3덩이, 길을 완전히 가리지 않게.', 0, 'prop')
k('fog-small', _vp(VP.fog_small), 'decal', '작은 안개', '작은 안개 자락(2x1칸).', '덧그림. 고목 밑·담 밑.', 0, 'prop')
k('drygrass-tuft', _vp(VP.drygrass_b), 'decal', '마른 풀포기', '바랜 마른 풀포기(2x1칸).', '걷는 장식. 담 밑·울타리 밑·집 모퉁이.', 0, 'prop')
k('weeds-crack', _vp(VP.weeds_crack), 'decal', '돌 틈 잡초', '자갈·판석 틈 잡초(1칸).', '걷는 장식. 자갈길 가장자리·계단 밑.', 0, 'prop')
k('cobweb-big', _vp(VP.cobweb_big), 'decal', '큰 거미줄', '모서리에 거는 반투명 거미줄(1칸).', '덧그림. 문간·창·우물 기둥 모서리.', 0, 'prop')

_CACHE = {}
def img(name):
    if name not in _CACHE: _CACHE[name] = K[name][0]()
    return _CACHE[name]

def pad16(im):
    w = -(-im.width // 16) * 16; h = -(-im.height // 16) * 16
    if (w, h) == im.size: return im
    o = Image.new('RGBA', (w, h)); o.alpha_composite(im, (0, h - im.height)); return o
