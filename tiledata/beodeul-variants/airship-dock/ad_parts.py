# 비행선 정박 부두 — 조각 등록(파일 이름·한글 이름·설명·놓는 법·막힘 줄). make_airship_dock.py 가 부른다.
import os, json
from ad_base import *
import ad_ground as G, ad_auto as AU, ad_props as P, ad_ships as SH, ad_build as BD

class Parts:
    """조각 저장 + partmeta.json + parts.md (앞 웨이브와 같은 형식, 오토타일·바닥에는 passable 을 더 적는다)."""
    def __init__(s, outdir):
        s.out = outdir; s.dir = os.path.join(outdir, 'parts'); os.makedirs(s.dir, exist_ok=True)
        for f in os.listdir(s.dir):
            if f.endswith('.png'): os.remove(os.path.join(s.dir, f))
        s.meta = {}; s.imgs = {}; s.order = []
    def add(s, name, im, kind, ko, desc, rules, brows=None, layer=None, role=None, passable=None):
        im = pad16(im.convert('RGBA'))
        assert im.width % 16 == 0 and im.height % 16 == 0, name
        s.imgs[name] = im; s.order.append(name)
        m = {'kind': kind, 'ko': ko, 'desc': desc, 'rules': rules}
        if brows is not None: m['brows'] = brows
        if layer: m['layer'] = layer
        if role: m['role'] = role
        if passable is not None: m['passable'] = passable
        s.meta[name] = m
        im.save(os.path.join(s.dir, name + '.png'))
    def finish(s, title):
        json.dump(s.meta, open(os.path.join(s.out, 'partmeta.json'), 'w'), ensure_ascii=False, indent=1)
        lines = ['# 새로 찍은 조각 — %s\n' % title,
                 '손 도트(Pillow 톤 캔버스, 버들항 7단 램프 + 기계 재질 램프, pz.fin 윤곽). 칸 = 16px. 장르 재질 규격 = tiledata/beodeul-kits/genres/steampunk.md.\n']
        for n in s.order:
            im = s.imgs[n]; m = s.meta[n]
            lines.append('- `parts/%s.png` (%dx%d px) — %s: %s / %dx%d칸' % (n, im.width, im.height, m['ko'], m['desc'], im.width // 16, im.height // 16))
        cnt = {}
        for n in s.order: cnt[s.meta[n]['kind']] = cnt.get(s.meta[n]['kind'], 0) + 1
        lines.append('\n합계: %d 조각 (%s)' % (len(s.order), ', '.join('%s %d' % kv for kv in sorted(cnt.items()))))
        open(os.path.join(s.out, 'parts.md'), 'w').write('\n'.join(lines) + '\n')
        return len(s.order)

DECK = '이 조각은 걷는 판이다 — 얹은 칸은 낭떠러지 위라도 걷기로 바뀐다.'

def register(out):
    PT = Parts(out); I = {}
    def part(name, img, kind, ko, desc, rules, brows=None, **kw):
        PT.add(name, img, kind, ko, desc, rules, brows, **kw); I[name] = PT.imgs[name]
    # ---- 바닥 표본
    for (n, fn, ko, desc, rules) in G.GROUNDS:
        part(n, G.ground_img(fn), 'floor', ko, desc, rules + ' 3×3 이어 붙여도 이음새가 없다.', 0, layer='lower', role='terrain', passable=True)
    # ---- 오토타일
    for (n, sh, ko, desc, rules, layer, role, passable) in AU.AUTOS:
        part(n, sh(), 'autotile', ko, desc, rules, 0 if passable or role == 'terrain' else 1, layer=layer, role=role, passable=passable)
    # ---- 앵커
    part('mooring_mast', SH.mooring_mast(), 'object', '비행선 계류 탑',
         '리벳 강철 받침 위 격자 쇠 탑(가운데 사다리), 놋쇠 난간 두른 작업대, 꼭대기에 동쪽을 향한 놋쇠 계류 원뿔과 호박빛 등, 늘어진 계류 밧줄(3×9).',
         '3×9칸. 맨 아랫줄(받침) 막힘, 위 8줄 걷기+가림. 낭떠러지 턱 가까운 땅(ground-iron-deck 받침 위)에, 원뿔 동쪽 바로 옆 하늘에 airship_moored 기수를 맞춘다.', 1, role='building')
    part('airship_moored', SH.airship_moored(), 'object', '정박한 화물 비행선',
         '기수를 서쪽으로 둔 시가 모양 화물 비행선(12×7): 바랜 아마포 기낭(둘레 띠·이음 줄·덧댄 천 한 장), 놋쇠 기수 덮개, 꼬리 날개 셋, 매단 밧줄, 둥근 창 여덟 개 나무 곤돌라와 놋쇠 테, 뒤쪽 엔진 받침과 프로펠러.',
         '12×7칸. 낭떠러지(하늘) 위에 띄운다 — 기수 끝을 mooring_mast 원뿔에, 곤돌라 밑을 잔교 북쪽 줄 바로 위에. 아래 2줄(곤돌라) 막힘, 위 5줄 걷기+가림. 탑승은 gangway.', 2, role='building')
    part('airship_skiff', SH.airship_skiff(), 'object', '소형 비행정',
         '구리빛 황토 기낭에 붉은 꼬리 날개, 쇠 기수, 열린 나무 배 곤돌라와 조종 기관·뒤 프로펠러의 작은 비행정(7×4).',
         '7×4칸. 짧은 잔교 남쪽 하늘에, 곤돌라 뱃전을 잔교 앞면 바로 아래 줄에. 아래 1줄 막힘. 큰 비행선과 한 화면에 하나씩.', 1, role='building')
    part('gasbag_cradle', SH.gasbag_cradle(), 'object', '기낭 걸이(예비 기낭)',
         '두 A자 강철 틀과 리벳 윗 들보에 밧줄로 매단 반쯤 바람 빠진 예비 기낭(주름·덧댄 천), 땅에 깐 천막 깔개, 오른쪽 다리 사다리(6×5).',
         '6×5칸. 맨 아랫줄의 두 다리 받침(양끝 2칸씩)만 막힘, 가운데 아래 칸과 위 4줄 걷기+가림. 부두 마당 가장자리 넓은 곳에, 앞(남) 1칸 비움.', 1, role='building')
    part('cargo_crane', BD.cargo_crane(), 'object', '증기 짐 기중기',
         '리벳 강철 회전 받침 위 돌 평형추·구리 보일러(압력계·화구 불빛·굴뚝 김)·나무 운전실(놋쇠 테 창), 동쪽 위로 뻗은 격자 붐과 도르래·당김줄·갈고리(4×7).',
         '4×7칸. 아래 2줄(받침·운전실) 중 받침 줄만 막힘, 위 줄 걷기+가림. 낭떠러지 턱 바로 서쪽 땅(ground-iron-deck 위)에 붐이 하늘 쪽으로 가게. 둘레에 crate_stack·cargo_net.', 1, role='building')
    part('control_hut', BD.control_hut(), 'object', '관제 오두막',
         '슬레이트 박공 지붕(놋쇠 용마루·풍향계·굴뚝 관·호박빛 신호등), 위 나무 널 벽에 놋쇠 틀 큰 관제 창 셋, 아래 바랜 벽돌 벽과 나무 문·등, 돌 기초와 디딤돌(5×5).',
         '5×5칸. 아래 3줄(벽) 막힘, 위 2줄(지붕) 걷기+가림. 문(맨 아랫줄 가운데)이 실내 이동 칸 — 앞 1칸은 길로 잇는다. 잔교 뿌리가 보이는 곳에 창을 낭떠러지 쪽으로.', 3, role='building')
    part('coal_shed', BD.coal_shed(), 'object', '석탄 창고',
         '녹 번진 골함석 외쪽 지붕, 그을음 낀 벽돌 벽, 큰 아치 입구 속 석탄 더미, 왼쪽 미닫이 널문, 오른쪽 석탄 깔때기와 홈통, 돌 기초(6×5).',
         '6×5칸. 아래 3줄 막힘(아치 입구 가운데 아랫칸 둘은 이벤트로 열 수 있다), 위 2줄 걷기+가림. ground-cinder-yard 마당 위에, 입구 앞에 autotile-coal-dust 덩이와 coal_cart.', 3, role='building')
    part('water_tank', BD.water_tank(), 'object', '급수탑',
         '원뿔 뚜껑 리벳 강철 물통(녹 번짐)과 네 쇠 다리·X 버팀·사다리·구리 내림 관, 돌 받침(3×5).', '3×5칸, 맨 아랫줄 막힘. 기중기·보일러 곁.', 1, role='building')
    part('boiler_small', BD.boiler_small(), 'object', '작은 보일러', '구리 세운 보일러(놋쇠 띠·압력계·화구 불빛), 굴뚝 관과 김(2×3).', '2×3칸, 아래 2줄 막힘. 석탄 창고·기중기 곁.', 2)
    part('steam_tractor', BD.steam_tractor(), 'object', '증기 견인차', '동쪽을 향한 작은 증기 견인차: 누운 바랜 황토 보일러(놋쇠 띠)·굴뚝, 차양 운전석, 붉은 살 큰 뒷바퀴와 앞바퀴(3×2).',
         '3×2칸, 아랫줄 막힘. 짐 마당·길가에 한 대. 좌우 뒤집어 서쪽을 향하게 써도 된다.', 1)
    # ---- 잔교
    part('pier_root', BD.pier_root(), 'walk', '잔교 돌 받침', '잔교가 절벽에 걸리는 마름돌 받침: 윗면 판석(걷기) + 구름 속으로 사라지는 앞면(2×3).',
         '2×3칸. 낭떠러지 턱 바로 바깥 첫 칸(하늘)에 위 2줄이 잔교 데크 줄과 같게. ' + DECK + ' 셋째 줄은 그림(막힘).', 0, role='prop')
    part('pier_span', BD.pier_span(), 'walk', '잔교(나무·철)', '동서로 누운 바랜 널 데크(64px 주기), 북쪽 강철 테 들보, 남쪽 놋쇠 띠 리벳 들보 앞면, 밑으로 구름 속에 사라지는 쇠 X 버팀(4×3).',
         '4×3칸. 위 2줄이 걷는 데크 — ' + DECK + ' 셋째 줄(버팀)은 하늘 그림(막힘). pier_root 동쪽에 4칸씩 이어 붙이고 끝에 pier_head. 곧게 12칸 넘게 늘이지 않는다.', 0, role='prop')
    part('pier_head', BD.pier_head(), 'walk', '잔교 머리', '잔교 끝 데크: 동쪽 끝 들보와 놋쇠 모, 데크 네 귀 리벳(3×3).',
         '3×3칸, 위 2줄 걷기. pier_span 끝에. 머리 위에 bollard 둘·gas_lamp 하나, 곁 하늘에 비행선.', 0, role='prop')
    part('gangway', BD.gangway(), 'walk', '탑승 사다리 다리', '동쪽으로 올라가는 널 경사 + 밧줄 손잡이 두 가닥과 쇠 기둥(2×2).',
         '2×2칸 걷기. 잔교 데크 북쪽 끝 줄 위에 얹어 곤돌라 밑과 잇는다(이동 이벤트 칸).', 0, role='prop')
    # ---- 소품
    O = [
     ('bollard', P.bollard(), '계류 말뚝', '밧줄 감긴 버섯 머리 무쇠 말뚝(1×1).', '1칸 막힘. 잔교 머리·잔교 가장자리에 2~3칸 간격.', 1),
     ('mooring_winch', P.mooring_winch(), '계류 권양기', '리벳 강철 받침 위 밧줄 감은 북과 양옆 놋쇠 톱니·손잡이(2×2).', '2×2칸, 아랫줄 막힘. 계류 탑 받침 곁·잔교 뿌리에 하나.', 1),
     ('rope_coil', P.rope_coil(), '감은 밧줄', '바닥에 사려 둔 삼 밧줄 더미(1×1).', '1칸 막힘. 말뚝·권양기·잔교 뿌리 곁.', 1),
     ('crate_single', P.crate_single(), '화물 상자', '모서리 쇠 장식 나무 상자(1×1).', '1칸 막힘. 큰 더미 곁에 하나둘.', 1),
     ('crate_pair', P.crate_pair(), '화물 상자 셋', '크기 다른 나무 상자 셋을 쌓은 더미(2×2), 칠한 표시(글자 없음).', '2×2칸, 아랫줄 막힘. 잔교 뿌리·기중기 곁.', 1),
     ('crate_stack', P.crate_stack(), '화물 상자 더미', '큰 상자 둘 위 작은 상자 둘, 밧줄로 묶은 3×3 더미.', '3×3칸, 아래 2줄 막힘. 부두 마당 가장자리에 1~2무리(일렬 금지).', 2),
     ('cargo_net', P.cargo_net(), '그물에 싼 짐', '그물에 싼 상자·통 묶음과 갈고리 고리(2×2).', '2×2칸, 아랫줄 막힘. 기중기 갈고리 아래·잔교 뿌리.', 1),
     ('barrel_single', P.barrel_single(), '나무 통', '쇠테 둘 나무 통(1×1).', '1칸 막힘.', 1),
     ('barrel_pair', P.barrel_pair(), '통 무리', '나무 통 둘·붉은 칠 통 하나(2×2).', '2×2칸, 아랫줄 막힘.', 1),
     ('sack_pile', P.sack_pile(), '자루 더미', '묶은 아마포 자루 셋(2×1).', '2×1칸 막힘. 상자 더미 곁.', 1),
     ('sandbag_ballast', P.sandbag_ballast(), '바닥짐 모래주머니', '비행선 바닥짐으로 쓰는 황토빛 모래주머니 다섯(2×1).', '2×1칸 막힘. 잔교 뿌리·기낭 걸이 곁.', 1),
     ('pallet', P.pallet(), '빈 짐 받침', '바랜 널 짐 받침(2×1, 납작).', '2×1칸 걷기(바닥 장식).', 0),
     ('hand_truck', P.hand_truck(), '짐 손수레', '상자 하나 실은 세운 쇠 손수레(1×2).', '1×2칸, 아랫줄 막힘.', 1),
     ('gas_lamp', P.gas_lamp(), '가스등', '무쇠 기둥(놋쇠 고리) 위 유리 등 속 호박빛 불(1×3).', '1×3칸, 맨 아래 1칸만 막힘(위 2칸 걷기+가림). 길·잔교 머리에 6~9칸 간격.', 1),
     ('signal_lamp', P.signal_lamp(), '착륙 신호등', '돌 받침 강철 기둥 위 놋쇠 갓 둥근 호박빛 신호등(1×3).', '1×3칸, 맨 아래 1칸만 막힘. 낭떠러지 턱 가까이·잔교 뿌리 양옆.', 1),
     ('windsock', P.windsock(), '바람 자루', '쇠 깃대 끝 고리에 동쪽으로 부푼 붉은·흰 띠 바람 자루(2×4).', '2×4칸, 맨 아래 왼쪽 1칸(받침)만 막힘. 낭떠러지 턱 가까운 트인 곳에 하나.', 1),
     ('flag_pole', P.flag_pole(0), '깃발(붉은)', '나무 깃대에 바람에 날리는 바랜 붉은 깃발(흰 띠, 무늬 없음)(2×4).', '2×4칸, 맨 아래 왼쪽 1칸만 막힘. 관제 오두막·잔교 뿌리에.', 1),
     ('flag_pole_drab', P.flag_pole(1), '깃발(황토)', '바랜 황토 깃발(놋쇠빛 모서리 칸)(2×4).', '2×4칸, 맨 아래 왼쪽 1칸만 막힘. 붉은 깃발과 섞어 쓴다.', 1),
     ('pennant_line', P.pennant_line(), '줄 깃발', '처진 밧줄에 매단 작은 삼각기 줄(4×1, 위층 덧그림).', '4×1칸 위층(걷기). 깃대·기둥 사이에.', 0),
     ('pressure_post', P.pressure_post(), '압력계 기둥', '구리 관 위 둥근 압력계(바늘, 숫자 없음)·붉은 밸브(1×2).', '1×2칸, 아랫줄 막힘. 기중기·보일러 곁.', 1),
     ('valve_stand', P.valve_stand(), '밸브 기둥', '구리 세운 관 끝 붉은 손바퀴 밸브(1×2).', '1×2칸, 아랫줄 막힘.', 1),
     ('steam_pipe_h', P.steam_pipe_h(), '증기 관', '쇠 받침 둘 위 구리 관(이음 테), 끝 이음에서 새는 김(3×1).', '3×1칸 막힘. 보일러와 기중기 사이를 잇는다(길을 가로지르지 않는다).', 1),
     ('bench_iron', P.bench_iron(), '무쇠 벤치', '무쇠 다리·널 등받이 벤치(2×2).', '2×2칸, 아랫줄 막힘. 관제 오두막 앞·길가.', 1),
     ('telescope', P.telescope(), '관측 망원경', '나무 세 다리 위 하늘을 향한 놋쇠 망원경(1×2).', '1×2칸, 아랫줄 막힘. 낭떠러지 턱·관제 오두막 곁.', 1),
     ('propeller_spare', P.propeller_spare(), '예비 프로펠러', '나무 받침틀에 눕힌 나무 프로펠러(놋쇠 축)(3×2).', '3×2칸, 아랫줄 막힘. 기낭 걸이·공구 선반 곁.', 1),
     ('tool_rack', P.tool_rack(), '공구 선반', '구멍판에 건 렌치·망치·압력계(2×2).', '2×2칸, 아랫줄 막힘. 벽 앞·기낭 걸이 곁.', 1),
     ('gear_spare', P.gear_spare(), '예비 톱니', '땅에 눕힌 큰 놋쇠 톱니(살 셋)(2×2).', '2×2칸, 아랫줄 막힘.', 1),
     ('coal_heap', P.coal_heap(), '석탄 더미', '윗면 빛 받는 덩이 석탄 더미(2×2).', '2×2칸, 아랫줄 막힘. 석탄 창고 입구·보일러 곁, 둘레에 autotile-coal-dust.', 1),
     ('coal_cart', P.coal_cart(), '석탄 수레', '석탄 실은 리벳 강철 수레, 바퀴 둘·손잡이(2×2).', '2×2칸, 아랫줄 막힘.', 1),
     ('coal_scatter', P.coal_scatter(), '흩어진 석탄', '바닥에 흩어진 석탄 알(1×1, 납작).', '1칸 걷기(바닥 장식). 석탄 가루 덩이 가장자리.', 0),
     ('gas_bottles', P.gas_bottles(), '기낭 가스통 묶음', '쇠 받침에 묶어 세운 붉은·황토 가스통 넷과 놋쇠 꼭지(2×2).', '2×2칸, 아랫줄 막힘. 기낭 걸이·잔교 뿌리 곁(불 곁 금지).', 1),
     ('hose_reel', P.hose_reel(), '가스 호스 감개', '쇠 틀에 감은 고무 호스(1×2).', '1×2칸, 아랫줄 막힘. 가스통 곁.', 1),
     ('searchlight', P.searchlight(), '탐조등', '쇠 세 다리 위 놋쇠 탐조등(호박빛 렌즈가 하늘 쪽)(2×2).', '2×2칸, 아랫줄 막힘. 낭떠러지 턱·관제 오두막 곁.', 1),
     ('rock_small', P.rock_small(), '바위', '회색 바위(1×1).', '1칸 막힘. 풀밭·바위 고원 가장자리에 2~4개 덩이.', 1),
     ('rock_moss', P.rock_small(1), '이끼 낀 바위', '이끼 낀 회색 바위(1×1).', '1칸 막힘.', 1),
     ('rock_large', P.rock_large(), '큰 바위', '윗면 빛 받는 큰 바위와 금·이끼(2×2).', '2×2칸, 아랫줄 막힘. 맵 가장자리·절벽 턱.', 1),
     ('grass_tuft', P.grass_tuft(0), '풀포기 덩이', '잎 덩이 셋 작은 풀포기(윗면 빛, 밑 그늘, 동쪽으로 누운 잎 끝)(1×1).', '1칸 걷기(바닥 장식). 풀밭에 2~4개씩 무리 지어 흩는다(일렬 금지).', 0),
     ('grass_tuft_b', P.grass_tuft(1), '풀포기 덩이(작은)', '잎 덩이 둘 작은 풀포기(1×1).', '1칸 걷기. grass_tuft 와 섞는다.', 0),
     ('shrub_windswept', P.shrub_windswept(), '바람에 휜 덤불', '동쪽으로 밀린 덤불(2×2).', '2×2칸, 맨 아랫줄 가운데 밑동만 막힘(위는 걷기+가림). 덩이로.', 1),
     ('pine_windswept', BD.pine_windswept(), '바람에 휜 소나무', '동쪽으로 휜 줄기와 납작하게 밀린 층층 수관(3×4).', '3×4칸, 맨 아랫줄 줄기 칸만 막힘(위 3줄 걷기+가림). 맵 가장자리·절벽 턱에 덩이로(일렬 금지).', 1),
     ('cloud_puff', P.cloud_puff(3, 2, 5), '떠도는 구름', '덩이 구름(3×2, 위층 덧그림).', '3×2칸 위층(낭떠러지 칸 위). 하늘에 2~5개, 크기 섞어.', 0),
     ('cloud_puff_small', P.cloud_puff(2, 1, 9), '떠도는 구름(작은)', '작은 덩이 구름(2×1).', '2×1칸 위층.', 0),
     ('cloud_puff_wide', P.cloud_puff(4, 2, 13), '떠도는 구름(긴)', '길게 늘어진 덩이 구름(4×2).', '4×2칸 위층. 잔교 밑·절벽 밑에 걸치게.', 0),
    ]
    for (n, im, ko, desc, rules, br) in O:
        if im is None: continue
        kind = 'decal' if br == 0 and n not in ('pallet',) else 'object'
        if n == 'pallet': kind = 'decal'
        part(n, im, kind, ko, desc, rules, br)
    return PT, I
