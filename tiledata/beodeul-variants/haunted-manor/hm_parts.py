# 폐가 저택 조각 등록(이름·메타·한글 설명). make_haunted_manor.py 가 부른다.
from hm_kit import *
import hm_art1 as A1, hm_art2 as A2, hm_art3 as A3, hm_auto as AU

kit = Kit('haunted-manor', '폐가 저택 내부 던전')
S = {}
SOFT = set()


def obj(name, img, ko, desc, rules, brows=1, kind='object', soft=False, **kw):
    S[name] = img; kit.add(name, img, kind, ko, desc, rules, brows, **kw)
    if soft: SOFT.add(name)
    return img


def register():
    # ---------------- 현관·계단 홀
    obj('grand_stair_broken', A1.grand_stair_broken(), '부서진 큰 계단', '북쪽으로 오르는 넓은 검은 참나무 계단(4×4). 아래 다섯 단은 성하고 낡은 붉은 카펫 띠가 남았지만 위쪽은 무너져 쪼개진 널과 어둠이 드러났다. 양옆 난간 기둥.',
        '4×4칸. 가운데 2열 아래 2줄만 걷기(계단 발치), 나머지 막힘 — 오를 수 없는 막다른 계단. 홀 북쪽 벽 앞면 바로 아래 바닥 위에 놓고 그 위 앞면에 stair_landing_dark 를 같은 열로 붙인다. 카펫은 계단 발치에서 끝낸다.', brows=0, kind='walk')
    obj('stair_landing_dark', A1.stair_landing_dark(), '무너진 층계참(벽 앞면)', '벽 앞면에 뚫린 넓은 아치 너머 어둠과 위층 층계참의 부러진 난간(4×3).',
        '4×3칸 장식(앞면 위, 앞면 3줄 필요). grand_stair_broken 바로 위 앞면에 같은 열로 붙인다. 계단 없이 쓰지 않는다.', brows=0, kind='decal')
    obj('grandfather_clock', A1.grandfather_clock(), '멈춘 괘종시계', '뾰족 머리·멈춘 흰 숫자판(바늘만, 숫자 없음)·유리 속 멈춘 추의 검은 참나무 괘종시계, 먼지와 거미줄(1×3).',
        '1×3칸, 아랫줄만 막힘(위 2줄 걷기+가림). 홀·계단 곁 북쪽 벽에 등을 대고 하나. 조사 이벤트에 좋다.', soft=True)
    obj('coat_rack', A1.coat_rack(), '외투 걸이', '세 다리 검은 참나무 기둥 갈고리에 해진 청회 망토 한 벌(1×2).', '1×2칸, 아랫줄만 막힘. 현관 입구 곁 벽가에 하나.', soft=True)
    obj('candelabra_lit', A1.candelabra(lit=True), '세 갈래 촛대(켜짐)', '바닥에 세우는 녹슨 쇠 촛대와 호박색 불꽃의 초 셋(1×2).', '1×2칸, 아랫줄만 막힘. 계단 발치·식탁 끝·방 모서리에 쌍으로. 빛무리와 함께. 어두운 방의 유일한 빛.', soft=True)
    obj('candelabra_out', A1.candelabra(lit=False), '세 갈래 촛대(꺼짐)', '심지가 검은 꺼진 초 셋의 녹슨 쇠 촛대(1×2).', '1×2칸, 아랫줄만 막힘. 켜진 촛대와 섞어 버려진 느낌을 낸다.', soft=True)
    obj('chandelier_fallen', A1.chandelier_fallen(), '떨어진 샹들리에', '바닥에 내려앉아 찌그러진 흐린 놋쇠 고리 두 겹, 꺾인 팔·흩어진 초와 유리 방울, 끊어진 사슬(3×2).',
        '3×2칸, 아래 2줄 막힘. 큰 홀 한가운데에서 조금 비켜 하나, 둘레에 plaster_debris 를 흩는다. 카펫·통로를 막지 않는다.', brows=2)
    obj('raven_bust', A1.raven_bust(), '까마귀 흉상', '돌 받침 위 얼굴 없는 돌 흉상 머리에 검은 까마귀가 앉았다(1×2).', '1×2칸, 아랫줄만 막힘. 현관·응접실 모서리에 하나. 쌍으로 두지 않는다.', soft=True)
    obj('urn_dead_flowers', A1.urn_dead_flowers(), '마른 꽃 항아리', '청회 돌 항아리에 고개 숙인 시든 꽃대와 떨어진 꽃잎(1×2).', '1×2칸, 아랫줄만 막힘. 문·계단 양옆, 창 아래.', soft=True)
    obj('portrait_empty', A1.portrait_empty(), '빈 액자', '도금 테 속 그림이 빠진 짙은 뒤판, 걸려 있던 자리만 덜 바랜 네모 자국(2×2, 사람 없음).', '2×2칸 장식(앞면 위, 앞면 2줄 이상). 홀·연회장 북쪽 벽에 창 사이로 2~4칸 간격.', brows=0, kind='decal')
    obj('portrait_oval', A1.portrait_oval(), '그을린 타원 액자', '세로 타원 도금 테 속 형체 없는 어두운 붓 자국뿐인 캔버스(1×2, 얼굴 없음).', '1×2칸 장식(앞면 위). 문틀·계단 아치 양옆에 하나씩.', brows=0, kind='decal')
    obj('window_boarded', A1.window_boarded(), '판자 친 아치 창', '검은 참나무 틀 뾰족 아치 창, 밤빛 유리(금 간 칸)에 대각선 판자 셋, 양옆 해진 검붉은 커튼, 창턱(2×3).', '2×3칸 장식(앞면 위, 앞면 3줄 필요). 북쪽 벽에 3칸 이상 간격.', brows=0, kind='decal')
    obj('sconce_lit', A1.sconce_manor(lit=True), '벽 촛대(켜짐)', '녹슨 쇠 팔과 접시 위 짧은 초, 호박색 불꽃(1×1).', '1칸 장식(앞면 위, 가운데 줄). 액자·창 사이 4~6칸 간격. 빛무리와 함께.', brows=0, kind='decal')
    obj('sconce_out', A1.sconce_manor(lit=False), '벽 촛대(꺼짐)', '심지가 검은 꺼진 초의 벽 촛대(1×1).', '1칸 장식(앞면 위). 켜진 촛대 사이에 섞는다.', brows=0, kind='decal')
    obj('doormat_torn', A1.doormat_torn(), '해진 입구 깔개', '바랜 테두리 검붉은 깔개, 한쪽 끝이 뜯겨 올이 풀렸다(2×1).', '2×1칸 바닥 장식(걷기). 출입구 바로 안쪽, 카펫 끝에.', brows=0, kind='decal')
    obj('plaster_debris', A1.plaster_debris(), '회반죽 부스러기', '천장에서 떨어진 회백 덩이와 가루, 쪼개진 몰딩 조각(1×1).', '1칸 바닥 장식(걷기). 떨어진 샹들리에·마루 구멍 둘레, 벽 밑에 2~3개 덩이로.', brows=0, kind='decal')
    obj('floor_hole', A1.floor_hole(), '마루 구멍', '썩어 꺼진 마루 — 줄마다 다르게 부러진 널 끝과 밑 들보·어둠(2×2).', '2×2칸, 전체 막힘(빠지는 구멍). 썩은 마루 위, 통로 곁에. 둘레에 plaster_debris·autotile-dust-drift. 통로 한가운데 금지.', brows=2)
    obj('console_table', A1.console_table(), '벽 탁자', '휜 다리 검은 참나무 벽 탁자 — 흐린 놋쇠 쟁반·꺼진 초 한 쌍·엎어진 작은 액자, 먼지(2×2).', '2×2칸, 아랫줄 막힘(윗줄 걷기+가림). 홀·복도 벽가, 액자 아래.', brows=1)
    obj('hall_bench', A1.hall_bench(), '높은 등받이 긴 의자', '판 등받이·바랜 검붉은 방석·팔걸이의 검은 참나무 긴 의자(2×2).', '2×2칸, 아랫줄 막힘(등받이 줄 걷기+가림). 현관 벽가에 마주 보게 하나씩.', brows=1)
    obj('portrait_fallen', A1.portrait_fallen(), '떨어진 액자', '바닥에 비스듬히 누운 빈 도금 액자, 깨진 유리와 끊어진 끈(2×1).', '2×1칸 바닥 장식(걷기). 빈 액자가 걸린 벽 아래나 계단 발치에 하나.', brows=0, kind='decal')
    obj('vase_broken', A1.vase_broken(), '깨진 꽃병', '깨진 청회 도자기 조각과 시든 꽃잎(1×1).', '1칸 바닥 장식(걷기). 탁자·항아리 곁에.', brows=0, kind='decal')
    # ---------------- 연회장
    obj('fireplace', A1.fireplace(), '돌 벽난로', '벽 앞면에 붙여 지은 청회 돌 벽난로 — 굴뚝 가슴벽, 선반 위 초 둘과 거미줄, 아치 화실 속 식은 재와 꺼져 가는 불씨, 앞 돌판(3×4).',
        '3×4칸. 아랫줄(돌판)만 막힘, 위 3줄은 벽 앞면 위(앞면 3줄 필요). 연회장·응접실 북쪽 벽 가운데. 앞 2칸 비우고 의자 둘을 마주 놓는다.', brows=1)
    obj('banquet_table', A1.banquet_table(), '먼지 쌓인 긴 식탁', '회색 식탁보가 늘어진 검은 참나무 긴 식탁 — 쓰러진 촛대·은 접시·뒤집힌 잔, 가운데 거미줄 친 세 갈래 촛대(5×2).',
        '5×2칸, 아래 2줄 막힘. 연회장 가운데 동서로 길게, 둘레 한 칸에 chair_high·chair_toppled 를 어긋나게. 밑에 autotile-carpet-worn 을 깔면 좋다.', brows=2)
    obj('chair_high', A1.chair_high(), '높은 등받이 의자', '뾰족 기둥 둘·검붉은 천 등받이(해진 속)·앉는 판(1×2).', '1×2칸, 아랫줄만 막힘(등받이 줄은 걷기+가림). 식탁 북쪽에 남향으로 줄 세우되 1~2개는 비우거나 쓰러뜨린다.', soft=True)
    obj('chair_toppled', A1.chair_toppled(), '쓰러진 의자', '뒤로 넘어져 등받이가 바닥에 눕고 앞다리가 하늘로 선 의자(1×1).', '1칸, 막힘 1줄. 식탁 남쪽·끝, 샹들리에 곁에 1~2개.')
    # ---------------- 서재
    obj('bookcase_dusty', A2.bookcase_dusty(), '먼지 책장', '먼지 앉은 갓판, 바랜 책등 선반 4단(빈틈·누운 책), 위 구석 거미줄의 키 큰 책장(2×3).', '2×3칸, 아랫줄 2칸만 막힘(위 2줄 걷기+가림). 서재 북쪽 벽 앞면에 등을 대고 2개씩 잇되 창·액자로 끊는다.', soft=True)
    obj('bookcase_toppled', A2.bookcase_toppled(), '쓰러진 책장', '앞으로 엎어져 등판이 위로 보이는 책장과 쏟아진 책·종이(3×2).', '3×2칸, 아래 2줄 막힘. 서재 가운데에서 비스듬히 하나, 둘레에 book_spill. 통로 2칸은 남긴다.', brows=2)
    obj('book_spill', A2.book_spill(), '흩어진 책', '엎어진 책 둘·누운 책·흩날린 종이(1×1).', '1칸 바닥 장식(걷기). 책장·책상 발치에 1~3개 덩이로.', brows=0, kind='decal')
    obj('desk_cobweb', A2.desk_cobweb(), '거미줄 책상', '펼친 바랜 책·엎어진 잉크병·꺼진 촛대, 의자까지 늘어진 거미줄(2×2).', '2×2칸, 아래 2줄 막힘. 서재 창 아래·책장 앞, 의자 쪽(남)에 통로.', brows=2)
    obj('armchair_torn', A2.armchair_torn(), '해진 날개 의자', '찢어진 자리로 솜이 삐져나온 검붉은 날개 안락의자(1×2).', '1×2칸, 아랫줄만 막힘. 벽난로 앞·책장 앞에 하나.', soft=True)
    obj('globe_stand', A2.globe_stand(), '지구본', '세 다리 받침과 놋쇠 자오환에 끼운 바랜 지구본(이름 없는 대륙 무늬)(1×2).', '1×2칸, 아랫줄만 막힘. 서재 책상 곁에 하나.', soft=True)
    obj('cobweb_wall', A2.cobweb_wall(), '벽 구석 큰 거미줄', '천장 돌림띠 구석에서 뻗은 살과 동심 실, 작은 거미(2×2).', '2×2칸 장식(앞면 위, 방 북쪽 벽 왼쪽 위 구석 = 앞면 첫 줄). 오른쪽 구석은 cobweb_wall_r.', brows=0, kind='decal')
    obj('cobweb_wall_r', A2.cobweb_wall(1), '벽 구석 큰 거미줄(오른쪽)', 'cobweb_wall 좌우 뒤집음(2×2).', '2×2칸 장식(앞면 위, 북쪽 벽 오른쪽 위 구석).', brows=0, kind='decal')
    obj('cobweb_hanging', A2.cobweb_hanging(), '늘어진 거미줄', '천장에서 끊어져 늘어진 실 다발과 먼지 뭉치(1×2).', '1×2칸 장식(앞면 위). 책장·창 사이, 문틀 위.', brows=0, kind='decal')
    # ---------------- 응접실
    obj('rocking_chair', A2.rocking_chair(), '흔들의자', '살 등받이·휜 흔들 굽의 검은 참나무 흔들의자, 걸쳐진 바랜 숄(1×2).', '1×2칸, 아랫줄만 막힘. 응접실 둥근 깔개 위, 창·벽난로를 바라보게 하나. (흔들리는 이벤트에 좋다.)', soft=True)
    obj('mirror_broken', A2.mirror_broken(), '깨진 벽 거울', '둥근 머리 도금 테 속 어두운 거울, 거미줄처럼 퍼진 금과 빠진 조각(2×2).', '2×2칸 장식(앞면 위, 앞면 2줄 이상). 응접실 북쪽 벽에 하나, 아래 바닥에 mirror_shards.', brows=0, kind='decal')
    obj('mirror_shards', A2.mirror_shards(), '거울 조각', '바닥에 흩어진 날카로운 유리 조각과 반짝임(1×1).', '1칸 바닥 장식(걷기). 깨진 거울 바로 아래 1~2개.', brows=0, kind='decal')
    obj('sofa_sheeted', A2.sofa_sheeted(), '덮개 씌운 소파', '먼지 앉은 리넨 덮개로 형체만 남은 소파(3×2).', '3×2칸, 아랫줄만 막힘(등받이 줄은 걷기+가림). 응접실 벽가·깔개 곁. 덮개 의자와 같이.', brows=1)
    obj('chair_sheeted', A2.chair_sheeted(), '덮개 씌운 의자', '리넨 덮개를 씌워 서 있는 형체처럼 보이는 높은 의자(1×2, 얼굴 없음).', '1×2칸, 아랫줄만 막힘. 소파 곁·방 구석에 1~2개. 일렬 금지.', soft=True)
    obj('piano_upright', A2.piano_upright(), '먼지 쌓인 피아노', '열린 뚜껑 아래 바랜 건반(검은 건반 몇 개 빠짐), 윗면에 꺼진 촛대(2×2).', '2×2칸, 아래 2줄 막힘. 응접실 북쪽 벽에 등을 대고.', brows=2)
    obj('side_table', A2.side_table(), '작은 둥근 탁자', '외다리 탁자 위 시든 꽃 유리병과 녹은 초(1×1).', '1칸, 막힘 1줄. 흔들의자·소파 곁에 하나.')
    obj('rug_round', A2.rug_round(), '해진 둥근 깔개', '바랜 검붉은 타원 깔개, 테 무늬 두 겹, 한쪽이 뜯겼다(3×2).', '3×2칸 바닥 장식(걷기). 응접실 가운데, 위에 흔들의자·탁자.', brows=0, kind='decal')
    obj('birdcage', A2.birdcage(), '빈 새장', '녹슨 쇠 받침대 위 둥근 지붕 새장, 열린 문과 깃털 한 개(1×2, 새 없음).', '1×2칸, 아랫줄만 막힘. 응접실 창 곁에 하나.', soft=True)
    obj('trunk_old', A2.trunk_old(), '낡은 궤', '쇠띠 두른 둥근 뚜껑 궤, 녹슨 자물쇠, 먼지(1×1).', '1칸, 막힘 1줄. 방 구석·계단방에. 보물 이벤트에 좋다.')
    # ---------------- 문·계단
    obj('door_locked', A3.door_locked(), '잠긴 문', '벽 앞면 속 뾰족 아치 돌 문틀, 녹슨 쇠띠 쌍여닫이에 X자 쇠사슬과 무거운 자물쇠(2×3).',
        '2×3칸. 앞면 3줄을 뚫은 2칸 폭 통로 자리에 놓는다(통로 칸은 바닥). 아랫줄 2칸 막힘 — 열쇠 이벤트로 연다. 문 앞 1칸 비움.', brows=1)
    obj('doorframe_broken', A3.doorframe_broken(), '부서진 문틀', '벽 앞면 속 아치 돌 문틀과 한쪽 경첩에 매달려 비스듬히 열린 썩은 문짝(2×3) — 지나갈 수 있다.',
        '2×3칸, 걷기(윗줄 걷기+가림). 앞면 2~3줄을 뚫은 2칸 폭 문간 자리에 놓는다.', brows=0, kind='walk')
    obj('cellar_stair_down', A3.cellar_stair_down(), '지하 내림 계단', '바닥에 뚫린 돌 계단 구멍 — 양옆 난간벽과 사슬 손잡이, 북쪽으로 어둠에 잠기는 단(3×3).',
        '3×3칸. 가운데 열 아래 2줄 걷기(맨 아랫줄 바로 위 = 지하 이동 칸), 양옆 막힘. 바닥 위, 북쪽 벽 앞면 아래. 지하실의 cellar_stair_up 과 짝.', brows=0, kind='walk')
    obj('cellar_stair_up', A3.cellar_stair_up(), '지하 오름 계단', '지하실 북쪽 벽으로 오르는 좁은 돌 계단, 위로 갈수록 밝고 꼭대기에 문틈 빛(3×4).',
        '3×4칸. 가운데 열 걷기(맨 윗줄 = 위층 이동 칸), 양옆 막힘. 지하실 북쪽 벽 앞면 바로 아래 바닥 위.', brows=0, kind='walk')
    # ---------------- 지하실
    obj('wine_rack', A3.wine_rack(), '포도주 선반', '마름모 칸마다 누운 녹색 병(빈칸·깨진 병), 위 구석 거미줄의 벽 선반(2×3).', '2×3칸, 아랫줄 2칸만 막힘(위 2줄 걷기+가림). 지하실 북쪽 벽 앞면에 등을 대고 2~3개씩, 사이를 1칸 띄운다.', soft=True)
    obj('cask_cradle', A3.cask_cradle(), '누운 큰 포도주 통', '나무 받침 위 옆으로 누운 큰 통 — 둥근 마구리·쇠테·꼭지(2×2).', '2×2칸, 아랫줄 막힘(위 줄 걷기+가림). 지하실 남쪽 줄에 2~3칸 간격으로, 꼭지 앞(남)은 비운다.', brows=1)
    obj('barrel_stack', A3.barrel_stack(), '통 더미', '누운 작은 통 셋 피라미드(2×2).', '2×2칸, 아래 2줄 막힘. 지하실 구석에.', brows=2)
    obj('barrel_small', A3.barrel_small(), '작은 통', '세워 둔 검은 참나무 통, 쇠테 셋(1×1).', '1칸, 막힘 1줄. 큰 통·선반 곁에 1~3개 덩이로.')
    obj('crate_rotten', A3.crate_rotten(), '썩은 상자', '널이 벌어지고 짚이 삐져나온 상자(1×1).', '1칸, 막힘 1줄. 지하실·계단방 구석에 덩이로.')
    obj('crate_stack', A3.crate_rotten(seed=1, stack=2), '쌓은 썩은 상자', '썩은 상자 둘을 쌓았다(1×2).', '1×2칸, 아랫줄만 막힘. 벽가에.', soft=True)
    obj('cellar_pillar', A3.cellar_pillar(), '지하 돌기둥', '굵은 청회 마름돌 네모 기둥, 아래 곰팡이(1×3).', '1×3칸, 아랫줄만 막힘. 지하실 가운데 줄에 5~8칸 간격, 기둥 사이는 통로.', soft=True)
    obj('bottles_broken', A3.bottles_broken(), '깨진 병', '깨진 녹색 병 둘·유리·마른 포도주 얼룩(1×1).', '1칸 바닥 장식(걷기). 포도주 선반·큰 통 발치에.', brows=0, kind='decal')
    obj('lantern_floor', A3.lantern_floor(), '쇠 등불', '바닥에 놓인 녹슨 쇠 등불, 호박색 불빛(1×1).', '1칸, 막힘 1줄. 지하실·계단방의 빛. 빛무리와 함께.')
    obj('sack_pile', A3.sack_pile(), '자루 더미', '묶은 삼베 자루 둘(곰팡이 핀 아랫단)(1×1).', '1칸, 막힘 1줄. 지하실·계단방 구석.')

    # ---------------- 바닥 표본 (맨 바탕)
    def ground(name, tag, ko, desc, rules):
        kit.add('ground-' + name, SAMPLES[tag].copy(), 'floor', ko, desc, rules, 0, layer='lower', role='terrain')
    ground('manor-boards', 'hm_boards', '저택 마루', '검은 참나무 긴 널(6px 줄)을 줄마다 다른 자리에서 이은 마루, 결·못(3×3 표본).', '응접실·복도·방의 기본 바닥. 3×3 이어 붙여도 이음새가 없다.')
    ground('rotten-boards', 'hm_rotten', '썩은 마루', '같은 널에 부러져 빠진 토막(밑 어둠)·바랜 회색 널·곰팡이 점(3×3 표본).', '서재·계단방·버려진 곁방. 저택 마루와 같은 널 줄이라 칸 단위로 섞어도 된다(변화 바닥).')
    ground('faded-checker', 'hm_checker', '바랜 대리석 바둑판', '흑·회백 대리석 16px 바둑판, 사선 실금·이 빠진 모서리·먼지 낀 줄눈(3×3 표본).', '연회장·큰 홀. 카펫과 함께.')
    ground('foyer-flag', 'hm_foyer', '현관 판석', '청회 정사각 판석(24×16 어긋남)과 검은 줄눈, 닳은 결(3×3 표본).', '현관·계단 홀·문간의 길 바닥. 카펫 띠가 지나는 자리.')
    ground('cellar-flag', 'hm_cellar', '젖은 지하 판석', '젖은 청회 판석, 줄눈에 낀 이끼, 물기 어린 얼룩(3×3 표본).', '지하실·포도주 창고. 곰팡이 얼룩 오토타일과 함께.')
    # ---------------- 벽·천장 표본
    kit.add('face_manor_3h', face_sample('manor', 3, 3), 'wall', '저택 벽 앞면(3줄)', '위 = 바랜 회청록 다마스크 벽지(벗겨진 회벽·물 자국), 의자 높이 나무 띠, 아래 = 검은 참나무 판벽과 걸레받이(3칸 폭 표본).', '방 천장 밑에 3줄. 모든 방 북쪽 벽에 필수. 바닥보다 어둡다.', 0, role='wall')
    kit.add('face_manor_2h', face_sample('manor', 3, 2), 'wall', '저택 벽 앞면(2줄)', '같은 벽, 2줄 높이(문간 위 상인방·복도).', '문간·복도 천장 밑에 2줄.', 0, role='wall')
    kit.add('face_cellar_3h', face_sample('mcellar', 3, 3), 'wall', '지하 석벽 앞면(3줄)', '청회 거친 마름돌, 아래로 젖은 이끼와 물 자국(3칸 폭 표본).', '지하실 천장 밑에 3줄.', 0, role='wall')
    kit.add('ceiling_manor', ceiling_sample('manor'), 'wall', '저택 천장', '어두운 천장 + 검은 참나무 들보 윗면 띠, 모서리 포함 3×3 표본.', '방 바깥(벽 너머). 열린 칸에 닿은 쪽만 들보 띠.', 0, role='wall')
    kit.add('ceiling_cellar', ceiling_sample('cellar'), 'wall', '지하 천장', '어두운 천장 + 청회 돌 윗면 띠, 3×3 표본.', '지하실 바깥(벽 너머).', 0, role='wall')
    # ---------------- 오토타일
    global DS, CW, MD, CP, BN
    DS = AU.autotile_dust(); CW = AU.autotile_cobweb(); MD = AU.autotile_mildew(); CP = AU.autotile_carpet(); BN = AU.autotile_banister()
    kit.add('autotile-dust-drift', DS, 'autotile', '먼지 쌓인 바닥 덩이', '회갈 먼지가 낮게 쌓인 더미 16변형(위 1·오른쪽 2·아래 4·왼쪽 8). 가장자리는 들쭉날쭉 둥글고 성긴 알갱이, 남쪽 둔덕 그늘.',
            '걷기. 벽 밑·구석·가구 둘레에 3~12칸 불규칙 덩이(가로세로 다르게, 코가 튀어나오게). 사람이 다니던 길(카펫·문간)에는 두지 않는다.', 0, layer='lower', role='terrain')
    kit.add('autotile-cobweb', CW, 'autotile', '바닥 거미줄 덩이', '먼지 낀 반투명 거미줄 막과 엉킨 실, 가장자리 밖으로 늘어진 실 끝 16변형.',
            '걷기. 서재·계단방·지하실 구석과 오래 안 쓴 가구 사이에 2~8칸 덩이. 벽 구석(cobweb_wall) 바로 아래에서 시작하면 좋다. 통로 한가운데 금지.', 0, layer='lower', role='terrain')
    kit.add('autotile-mildew', MD, 'autotile', '곰팡이·물 얼룩', '스며든 물이 마르며 남긴 검푸른 얼룩, 밝은 물때 테, 속 곰팡이 점 16변형.',
            '걷기. 창 아래·지하실 벽 밑·포도주 통 둘레에 3~10칸 불규칙 덩이. 젖은 지하 판석과 썩은 마루 위.', 0, layer='lower', role='terrain')
    kit.add('autotile-carpet-worn', CP, 'autotile', '낡은 검붉은 카펫', '바랜 테 무늬·해진 구멍의 검붉은 카펫 띠 16변형, 가장자리는 올이 풀렸고 남쪽 끝은 술.',
            '걷기(길). 폭 2칸 띠로 현관 입구에서 계단 발치까지, 또는 식탁 밑 네모로. 계단·문 앞 한 칸에서 끝낸다.', 0, layer='lower', role='terrain')
    kit.add('autotile-banister', BN, 'autotile', '부서진 나무 난간', '검은 참나무 손잡이 + 난간동자(몇 개 빠짐), 끝·모서리 네모 기둥 16변형.',
            '모든 변형 막힘. 무너진 자리(마루 구멍·계단 곁)를 두르거나 층계참 가장자리. 출입 틈은 한쪽에만.', 1, layer='upper', role='fence')
