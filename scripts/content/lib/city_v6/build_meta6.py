import sys, json; sys.path.insert(0,__import__('os').path.dirname(__import__('os').path.abspath(__file__)))
import palette; palette.apply()
from PIL import Image
import pz, roman, kits6, smoke5
m=json.load(open('/home/main/claude-viz/city-beodeul-v4-meta.json'))
props=[p for p in m['props'] if p['id']!='bridge_ew']
def E(iid,ko,en,desc,cat,tags,im,foot,rows,rules,rel=(),frames=None,legend=None,by='/tmp/j8city6/roman.py'):
    return dict(id=iid,name_ko=ko,name_en=en,description_ko=desc,category=cat,tags=tags,footprint_cells=list(foot),image_px=[im.width,im.height],
                overhang_up_px=max(0,im.height-foot[1]*16),role_grid=dict(rows=rows,anchor='맨 아랫줄 왼쪽 칸 = 배치 좌표',**({'legend':legend} if legend else {})),
                placement_rules=list(rules),related=[dict(id=a,why=b) for a,b in rel],variants_group=iid.split('_')[0],animation_frames=frames,status='v6',drawn_by=by)
b=roman.bridge_grand(4)
N=[
 E('bridge_grand','큰 아치 돌다리','Grand stone arch bridge','남북으로 흐르는 4칸 강을 동서로 건너는 돌다리. 먼 난간(물이 비치는 난간살)·판석 상판 2줄·가까운 난간·아치 2개가 뚫린 앞면·가운데 교각의 물가름돌. 양 끝 받침에 가로등, 가운데 받침에 토가 석상, 끝 받침에 공 장식.',
   'street',['river','bridge','roman'],b['back'],(4,2),['OOOO','WWWW','WWWW','OOOO','~~~~'],
   ['강 양쪽 둑에 같은 줄 2칸 폭 길이 있을 때만','뒤(먼 난간+상판)는 땅층, 앞(가까운 난간+앞면+물가름돌)은 물체층으로 정렬','아치 안은 투명: 물 애니메이션이 비치고 그늘 배수 0.42~0.72를 곱함','물가름돌 끝·교각 발치에 거품 점, 앞면은 물에 흔들리는 반사'],
   [('lamp_crook','다리 머리 가로등'),('water_layer','아치 밑 물살·거품')],frames=None,legend={'W':'상판(통행)','O':'난간(겹침)','~':'앞면·물가름돌(물 위)'}),
 E('statue_plinth','받침돌 위 토가 석상','Toga statue on plinth','명문을 새긴 높은 받침돌 위에 토가를 입은 석상. 한 팔을 든 자세 / 두루마리를 든 자세 두 가지.','monument',['forum','garden','roman'],roman.statue_plinth(0),(2,4),['OO','OO','BB','BB'],['광장 분수 둘레·정원 축 양옆','문 앞 2칸 금지'],[('fountain','포룸 분수와 한 벌')]),
 E('cypress','사이프러스','Cypress','칩셋 잎 결을 쓴 가늘고 긴 불꽃 모양 상록수. 3칸/2칸.','tree',['tree','roman'],roman.cypress(3),(1,3),['T','T','T'],['담 안쪽·길가 줄 세우기, 빈 땅 정원 채우기(30%)'],[('umbrella_pine','같은 로마풍 나무')]),
 E('umbrella_pine','우산소나무','Stone (umbrella) pine','긴 줄기 위에 넓고 납작한 수관. 칩셋 잎 결의 덩어리를 층으로 쌓았다.','tree',['tree','roman'],roman.umbrella_pine(0),(4,5),['TTTT']*5,['빈 땅 정원 채우기(22%)'],[('cypress','같은 로마풍 나무')]),
 E('topiary_pot','화분 원뿔 정원수','Topiary cone in pot','테라코타 화분에 원뿔로 다듬은 상록수.','garden',['garden','estate','castle'],roman.topiary(0),(1,2),['O','B'],['정원 화단 모서리, 산울타리 끝'],[('hedge','화단 테두리')]),
 E('stoa','주랑 (스토아)','Stoa colonnade','테라코타 외쪽 지붕, 엔태블러처, 기둥 줄 뒤 그늘진 벽에 가게 문과 항아리, 트래버틴 보도와 계단.','building',['forum','roman'],roman.stoa(5),(5,4),['#####','#####','#####','WWWWW'],['포룸 가장자리, 광장을 바라보게','맨 아랫줄(보도)은 걷기'],[('temple_front','포룸 북쪽 한 벌')]),
 E('temple_front','신전 정면','Temple front','위에서 본 박공 테라코타 지붕, 화환 부조 박공, 명문 띠, 기둥 넷과 그늘 속 청동 문, 가운데 계단의 기단.','building',['forum','roman'],roman.temple_front(5),(5,6),['#####']*5+['##D##'],['포룸 북쪽 가운데, 문 앞 광장 2칸 비움'],[('stoa','양옆 주랑'),('fountain','축 위 분수')]),
 E('portico','주랑 현관','Portico','박공·엔태블러처·기둥 넷·계단 두 단. 집 정면 문 위에 겹쳐 세운다(문 부분은 뚫림).','overlay',['estate','roman'],roman.portico(5),(5,0),['~~~~~'],['좌우 대칭 집의 가운데 문 위','아래 8px는 집 기준선 아래로 내려옴(계단)'],[('manor','저택 정면')]),
 E('aqueduct','수도교','Aqueduct arcade','뚜껑돌 사이로 물이 흐르는 수로를 인 아치 줄. 24px마다 교각, 아치 사이로 뒤 땅이 보인다.','landmark',['roman','north'],roman.aqueduct(12),(12,1),['.'*12,'.'*12,'.'*12,'#'*12],['신전 언덕에서 성문 길 쪽으로 내려오는 방향','맨 아랫줄만 막힘, 위 3줄은 겹침(그 칸에 집을 두지 않음)']),
 E('awning','줄무늬 차양','Striped awning','가게 1층을 덮는 빨강·크림 줄무늬 차양, 물결 테두리와 그 밑 그늘.','overlay',['cafe','shop'],roman.awning(4),(4,0),['~~~~'],['카페·가게 1층 벽 위(겹침층)']),
 E('cafe_table','카페 탁자 (의자·잔)','Bistro table with cups','둥근 나무 탁자, 받침 접시 위 흰 커피잔 1~2개(꽃병 변형), 양옆 쇠 의자.','cafe',['cafe','forum'],roman.cafe_table(0),(2,2),['OO','BB'],['카페 문 앞 테라스, 문 앞 줄은 비움'],[('cafe_parasol','같은 테라스'),('menu_board','문 옆')]),
 E('cafe_parasol','카페 파라솔 탁자','Parasol bistro table','줄무늬 파라솔(초록/빨강) 아래 잔 놓인 탁자와 의자.','cafe',['cafe'],roman.cafe_parasol('leaf',2),(3,3),['OOO','BBB','BBB'],['테라스 안쪽, 길 칸 금지']),
 E('menu_board','메뉴판 (이젤 칠판)','Menu easel','분필 글씨와 잔 그림이 있는 이젤 칠판.','cafe',['cafe'],roman.menu_board(),(1,2),['O','B'],['카페 문 바로 옆 칸']),
 E('planter_box','테라스 화분 상자','Terrace planter','다듬은 관목과 꽃을 심은 나무 상자. 1칸/2칸.','cafe',['cafe','terrace'],roman.planter_box(2),(2,2),['OO','BB'],['테라스 가장자리를 두르는 선']),
 E('sign_cafe','카페 걸이 간판','Hanging sign (cafe)','김 나는 잔 그림 간판.','shop-sign',['cafe'],pz.fin(pz.bracket_sign('inn')),(0,0),[''],['카페 문 오른쪽 벽']),
 E('reeds','갈대','Reeds','부들 이삭이 섞인 갈대 덤불. 조용한 둑에만.','water-edge',['pond','lake','moat'],roman.reeds(0),(1,1),['O'],['연못 둘레, 호수 양끝, 해자 양끝의 둑 칸','흐르는 강에는 안 둠']),
 E('lily_pad','수련 잎·꽃','Lily pads','물 층에 그리는 잎(홈 있는 타원)과 분홍 꽃. 물결 애니메이션 위에 고정.','water-layer',['pond','lake','moat'],Image.new('RGBA',(7,4)),(0,0),[''],['연못 55%, 호수 양끝·해자 서쪽 22% 칸마다']),
 E('carriage','닫힌 마차','Closed carriage','옻칠한 몸체, 금테, 유리창, 마차등, 살바퀴 둘, 끌채.','vehicle',['estate','stable'],roman.carriage(),(4,3),['OOOO','BBBB','BBBB'],['마구간 앞마당'],[('stable','한 벌')]),
 E('stable','마구간','Stable','반목조 긴 집, 반문 칸마다 말 머리가 내다본다(밤색/흑갈/흰).','building',['castle','estate'],roman.stable(6)['im'],(6,5),['######']*4+['D#####'],['문 왼쪽 끝, 앞에 건초·여물통·마차'],[('hay_bales','옆'),('carriage','앞')]),
 E('hay_bales','건초 더미','Hay bales','끈으로 묶은 건초 두 덩이.','farm',['stable'],roman.hay_bales(),(2,2),['OO','BB'],['마구간 옆']),
 E('gate_pier','정문 돌기둥 + 항아리','Gate pier with urn','네모 돌기둥, 갓돌, 돌 항아리.','estate',['estate','gate'],roman.gate_pier(),(1,1),['O','O','B'],['담의 문 칸 양옆']),
 E('iron_gate','철문 (열림)','Wrought-iron gate (open)','두 짝이 기둥 쪽으로 접혀 열린 철문. 통로는 비어 있다.','overlay',['estate','gate'],roman.iron_gate(2),(2,0),['GG'],['돌기둥 사이 2칸']),
 E('banner_hanging','걸개 깃발','Hanging banner','색 천 + 금 테두리 + 문장. 탑·성문루·왕궁 벽에 건다.','overlay',['castle'],roman.banner_hanging('red',32),(0,0),[''],['벽 겹침층']),
 E('windmill','풍차 (몸체 + 도는 날개)','Windmill (rotating sails)','몸체는 바탕에, 날개 4장은 8장면으로 90° 돌아 이음매 없이 반복.','landmark',['meadow'],roman.windmill_body(),(4,6),['####']*6,['서쪽 풀밭'],frames=dict(count=8,loop='seamless (4겹 대칭, 8장면 = 90°)',layer='sails overlay')),
]
for k,ko,desc in (('wisp','가는 실연기','작은 연기 알갱이 22개가 구불구불 한 줄로 오른다.'),('puffy','뭉게 연기','커지며 오르는 둥근 뭉치 5개.'),('drift','바람에 눕는 연기','위로 갈수록 동쪽으로 눕는다.'),('dark','짙은 연기','대장간·빵집 굴뚝. 갈회색, 크고 짙다.')):
    im=smoke5.sprite(k,0,0)
    N.append(E('smoke_'+k,'굴뚝 연기: '+ko,'Chimney smoke ('+k+')',desc+' 굴뚝마다 종류·시작 장면·변형이 다르다.','animation',['smoke'],im,(0,0),[''],['굴뚝 입구 = 그림의 (10,44)'],
               frames=dict(count=12,loop='seamless (알갱이 나이가 1에서 0으로 돌아감)',phase='굴뚝마다 해시 0~11'),by='/tmp/j8city6/smoke5.py'))
N.append(dict(id='water_layer',name_ko='움직이는 물 층',name_en='Animated water layer',description_ko='둑 거리로 깊이 색(가운데 짙게, 둑 가까이 밝게), 북쪽 둑 그늘, 강은 흐름 방향으로 4px/장면 흐르는 물살, 호수·연못은 제자리에서 부풀고 사라지는 잔물결과 느린 흐름, 반짝임, 둑 거품, 교각·물가름돌·잔교 다리 거품, 배 둘레 물결 고리, 다리 앞면·배의 흔들리는 반사, 수련.',
  category='animation',tags=['water'],footprint_cells=[0,0],image_px=[1600,1600],overhang_up_px=0,role_grid=None,placement_rules=['물 칸 표면(둑 테두리·안벽 면 제외) 전부','바탕 그림에서 물 0장면과 같은 화소만 장면마다 바꿔 끼움(그림자 진 물은 같은 배수로)'],
  related=[dict(id='bridge_grand',why='아치 그늘·반사·거품')],variants_group='water',animation_frames=dict(count=8,loop='seamless (물살 주기 32px = 8장면×4px)'),status='v5',drawn_by='/tmp/j8city6/water6.py'))
for t,ko,desc in (('pave_travertine','포룸 트래버틴 판석','32×24 큰 판석 엇갈림, 한 톤 면 + 드문 결. 포룸 전체.'),('pave_opus','오푸스 섹틸레','분수 둘레 회색 띠 + 45° 사각 무늬.'),('pave_flag','회색 판석','신전 마당·성 바깥뜰·항구 광장. v4의 화려한 칩셋 광장 타일 대체.'),('pave_gravel','자갈','저택 정원·성 안뜰.')):
    N.append(dict(id=t,name_ko=ko,name_en=t,description_ko=desc,category='ground',tags=['paving'],footprint_cells=[1,1],image_px=[16,16],overhang_up_px=0,role_grid=dict(rows=['W']),placement_rules=['연석: 풀과 만나는 가장자리 2px 밝은 돌 + 1px 어두운 줄, 길과는 이음'],related=[],variants_group='paving',animation_frames=None,status='v5',drawn_by='/tmp/j8city6/roman.py'))
kits=json.load(open('/tmp/j8city6/city6_kits.json'))
PIE={k:v for k,v in kits6.PIECES.items()}
out=dict(schema=m['schema'],source='버들항 v6 (로마풍) — scripts/content/lib/city_v6/city6.py',coords=m['coords'],
  replaced_in_v5=[dict(id='bridge_ew',by='bridge_grand',why='아치·난간·물가름돌이 있는 큰 다리로 교체'),dict(id='plaza_chipset_240_160',by='pave_flag / pave_travertine',why='화려한 광장 타일 → 차분한 판석')],
  dropped_since_v3=m.get('dropped_since_v3'),props=props+N,
  animations=dict(loop_frames=24,frame_ms=125,parts=[dict(id='water_layer',frames=8),dict(id='windmill',frames=8),dict(id='smoke_*',frames=12,kinds=json.load(open('/tmp/j8city6/city6_stats.json'))['smoke_kinds']),
     dict(id='boats',frames=4),dict(id='fountain',frames=4),dict(id='flag / fsmall / fpool / crane',frames=4),dict(id='festoon',frames=6),dict(id='waterfall',frames=4)],
     note='전체 24장면 = 8·12·4·6의 최소공배수, 모든 부분이 이음매 없이 반복'),
  kits=dict(
    castle=dict(name_ko='왕성 지구',pieces=[v for v in PIE.values() if v['kit']=='castle'],answer=kits['castle']['answer'],roles=kits['castle']['roles'],legend=kits['castle']['legend'],bbox_cells=kits['castle']['bbox'],
       walk_route=['해자 남쪽 길(y26) → 도개교 B (15-16,23-25) → 성문 통로 G (15-16,21-22) → 바깥뜰 P → 큰 계단 S (9-12,14-16) → 안뜰 자갈 P → 왕궁 문 D (10,9)','바깥뜰 → 돌계단 S (5-6,19)/(26-27,19) → 성벽길 W (y20, x32)'],
       interior_link='왕궁·예배당·병영 실내는 실내 v4 작업(방 하네스)의 방 조립기로 이어 붙인다. 문 칸 좌표는 answer의 door.'),
    estate=dict(name_ko='귀족 저택',pieces=[v for v in PIE.values() if v['kit']=='estate'],answer=kits['estate']['answer'],roles=kits['estate']['roles'],legend=kits['estate']['legend'],bbox_cells=kits['estate']['bbox'],
       walk_route=['아래 마을 계단 (44,28) → 남쪽 길 44-45 (y23-27) → 정문 G (44-45,22) → 담 안 길(y21) → 자갈 축 → 저택 문 D (45,11)','문지기 집 D (52,20), 마구간 D (52,11)'],
       interior_link='저택 실내(현관홀·계단·식당·침실)는 실내 v4 작업의 저택 방 세트로 잇는다 — 이 외관의 문 (45,11)이 현관홀 남쪽 문과 짝.'),
    forum=dict(name_ko='포룸 + 카페',answer=kits['forum']['answer'],roles=kits['forum']['roles'],legend=kits['forum']['legend'],bbox_cells=kits['forum']['bbox'])),
  city_placements=json.load(open('/tmp/j8city6/city6_placements.json')))
json.dump(out,open('/home/main/claude-viz/city-beodeul-v6-meta.json','w'),ensure_ascii=False,indent=1)
print('props',len(out['props']),'new',len(N),'kit pieces',len(PIE),'placements',len(out['city_placements']))
