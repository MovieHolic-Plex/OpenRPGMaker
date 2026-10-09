# 자연 숲 마당(natural-forest-clearing, 자연 숲·절벽 장르 · 장소 팩 전용) — 64x48 숲 빈터. 다시 돌리면 같은 그림이 나온다.
#   python3 make_natural_forest_clearing.py      조각(parts/·partmeta.json·parts.md) + check-autotile.png + 데모 맵(render-1x/2x·grid.json)
#                                                 + 전투 배경(battle-bg.png·check-overlay.png) + compare-ref.png
# 동선: 네 방향 출구(북·남·동·서)에서 맨땅 길이 가운데 교차점으로 모인다 → (북서) 큰 나무가 선 숲 마당 → (북동) 통나무 오두막과
#       울타리 친 채소밭 → (남동) 돌 둘레 연못 → (남서) 바위 풀숲. 맵 둘레는 어두운 수관 벽(바깥은 검정), 북쪽은 붉은 줄기 벽.
import sys, os, json, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from nfc_base import *
import nfc_ground as G, nfc_auto as A, nfc_veg as V, nfc_struct as T

ROLE = {'tree': 'tree', 'object': 'prop', 'wall': 'wall', 'building': 'building', 'decal': 'decal', 'walk': 'terrain'}
TALLR = '키 큰 부드러운 물체: 맨 아랫줄(줄기·밑동)만 막히고 위 칸은 걷기+가림. '

VEG = [
    ('big-tree-a', V.big_tree, 'tree', '큰 나무(검은 수관)', '4x5칸 숲 마당의 큰 나무: 회록 잎 송이 테 안쪽이 검게 가라앉는 둥근 수관, 붉은 갈색 줄기 셋이 붙은 줄기 다발, 땅 위로 길게 뻗은 뿌리.',
     TALLR + '줄기 칸 둘(아래 가운데 2칸)만 막힘. 빈터 한가운데·마당 중심에 한 그루(앵커). 수관 밑 바닥은 ground-grass-shade, 둘레 2칸은 비워 둔다.', 1),
    ('big-tree-b', lambda: V.big_tree(1111, True), 'tree', '큰 나무(검은 수관) 변형', '4x5칸 큰 나무의 좌우·잎 송이 변형.',
     TALLR + 'big-tree-a 와 같은 규칙. 두 그루를 둘 때 a·b 를 섞고 6칸 이상 띄운다.', 1),
    ('face-trunk-wall', V.trunk_wall, 'wall', '붉은 줄기 벽', '3x3칸(가로로 이어 찍는다, 48px 주기): 빽빽이 선 붉은 갈색 줄기 열 — 위 줄은 수관 그늘 속 줄기 윗부분, 아래 두 줄은 줄기와 벌어진 밑동.',
     '숲 빈터 북쪽 가장자리. 위 줄은 수관 벽 칸(autotile-canopy-wall 을 같이 칠한다), 아래 두 줄은 막힘. 끝은 trunk-wall-end-l/r 로 맺는다. 남·동·서쪽 가장자리에는 쓰지 않는다(수관 테만).', 2),
    ('trunk-wall-end-l', lambda: V.trunk_wall_end(1301, False), 'wall', '줄기 벽 왼쪽 끝', '1x3칸: 굵은 줄기 하나가 뿌리를 뻗으며 줄기 벽이 끝난다(왼쪽 끝).',
     'face-trunk-wall 줄의 왼쪽 끝 칸. 아래 두 줄 막힘. 왼쪽 이웃은 수관 벽.', 2),
    ('trunk-wall-end-r', lambda: V.trunk_wall_end(1302, True), 'wall', '줄기 벽 오른쪽 끝', '1x3칸: 줄기 벽 오른쪽 끝(좌우 반대).',
     'face-trunk-wall 줄의 오른쪽 끝 칸. 아래 두 줄 막힘.', 2),
    ('pine-young-a', V.pine_young, 'tree', '어린 전나무', '1x2칸 누런 회록 잎 가지가 층층이 삐죽한 어린 전나무.', TALLR + '줄기 벽 앞·숲 가장자리에 2~4칸 띄워 듬성듬성(일렬 금지).', 1),
    ('pine-young-b', lambda: V.pine_young(1411, 26), 'tree', '어린 전나무(작은)', '1x2칸 조금 작은 어린 전나무.', TALLR + 'pine-young-a 와 섞어 크기를 흩는다.', 1),
    ('pine-mid', V.pine_mid, 'tree', '전나무', '2x3칸 짙은 회록 층 원뿔 전나무.', TALLR + '숲 가장자리·바위 풀숲 뒤쪽에 하나둘.', 1),
    ('sapling', V.sapling, 'tree', '어린 활엽수', '1x2칸 가는 줄기 위 둥근 잎 덩이.', TALLR + '빈터 가장자리·오두막 곁에 하나씩.', 1),
    ('thin-fern-tree', V.thin_fern_tree, 'tree', '가는 고사리 나무', '1x3칸 곧은 가는 줄기에 고사리처럼 마주 난 깃털 잎.', TALLR + '줄기 벽 앞에 띄엄띄엄. 같은 나무를 나란히 두지 않는다.', 1),
    ('bush-round', V.bush_round, 'object', '둥근 덤불', '2x2칸 잎 송이 덩이가 겹친 둥근 덤불.', '아랫줄 막힘. 숲 가장자리 수관 테 바로 앞에 덩이로.', 1),
    ('autumn-shrub-l', V.autumn_shrub_l, 'object', '주황 낙엽 덤불', '2x2칸 주황 낙엽이 덮인 덤불(참고: 오두막 곁·숲 가장자리의 주황 덤불).', '아랫줄 막힘. 숲 가장자리·오두막 곁에 1~2개. 연달아 세 개 이상 두지 않는다.', 1),
    ('autumn-shrub-s', V.autumn_shrub_s, 'object', '작은 낙엽 덤불', '1x1칸 주황 낙엽 덤불.', '막힘(칸 하나). 큰 낙엽 덤불 곁·줄기 벽 앞에 흩는다.', 1),
    ('rock-l', V.rock_l, 'object', '큰 바위', '2x2칸 둥근 회색 바위(윗면 밝음·앞면 그늘).', '아랫줄 막힘. 바위 풀숲·연못 둘레에 작은 바위와 섞어 덩이로.', 1),
    ('rock-s', V.rock_s, 'object', '작은 바위', '1x1칸 회색 바위.', '막힘. 큰 바위 곁에 흩는다.', 1),
    ('rock-mossy', V.rock_mossy, 'object', '이�� 바위', '2x2칸 윗면에 풀 이끼가 덮인 낮은 바위.', '아랫줄 막힘. 그늘진 숲 가장자리.', 1),
    ('pebbles', V.pebbles, 'decal', '자갈', '1x1칸 땅 위 작은 돌 넷.', '걷기(땅 장식). 길가·바위 둘레.', 0),
    ('grass-tuft-l', V.grass_tuft_l, 'decal', '큰 풀 포기', '2x2칸 크게 퍼진 짙은 풀 포기(바닥 풀 포기와 같은 붓, 한 단 짙게).', '걷기(땅 장식). 빈 풀밭에 덩이로 몇 개 — 빈 바닥 채우기용이 아니라 풀밭 결을 바꾸는 점.', 0),
    ('grass-tuft-s', V.grass_tuft_s, 'decal', '작은 풀 포기', '1x1칸 작은 풀 포기.', '걷기(땅 장식).', 0),
    ('starflower', V.starflower, 'decal', '흰 별꽃', '1x1칸 다섯 잎 흰 꽃 한 송이(가운데 노랑) + 잎.', '걷기(땅 장식). 마당·오두막 앞에 두세 송이씩 덩이로.', 0),
    ('starflowers-small', lambda: V.starflower(1822, False), 'decal', '작은 별꽃 무리', '1x1칸 작은 흰 별꽃 세 송이.', '걷기(땅 장식).', 0),
    ('fern', V.fern, 'decal', '고사리 포기', '1x1칸 낮은 고사리 포기.', '걷기(땅 장식). 그늘 풀·줄기 벽 앞.', 0),
    ('mushrooms', V.mushrooms, 'decal', '버섯', '1x1칸 붉은 주황 갓 버섯 셋.', '걷기(땅 장식). 그루터기·통나무 곁 그늘.', 0),
    ('stump', V.stump, 'object', '그루터기', '1x1칸 나이테가 보이는 그루터기.', '막힘. 빈터 가장자리.', 1),
    ('log-fallen', V.log_fallen, 'object', '쓰러진 통나무', '2x1칸 옆으로 누운 통나무(왼쪽 단면 나이테, 위에 풀).', '막힘. 바위 풀숲·숲 가장자리.', 1),
    ('reeds', V.reeds, 'object', '갈대', '1x2칸 가늘고 긴 잎과 갈색 이삭.', TALLR + '연못 둘레 둑 칸(물 바로 밖)에 듬성듬성.', 1),
    ('lily-pads', V.lily_pads, 'decal', '연잎', '1x1칸 물 위 둥근 연잎 셋과 흰 꽃 한 송이.', '연못 물 칸 위 장식(물은 여전히 막힘). 물가에서 한 칸 이상 안쪽에 두세 개.', 0),
]
STRUCT = [
    ('log-cabin', T.cabin, 'building', '통나무 오두막', '7x6칸: 위 3줄 = 회색 세로 널 지붕(용마루·처마 그늘), 아래 3줄 = 가로 통나무 회색 판벽, 모서리 기둥, 네 칸 유리 창 둘, 가운데(왼쪽에서 4째 칸) 검은 문간과 돌 문턱, 주춧돌, 담쟁이.',
     '벽 3줄 막힘(지붕 칸은 걷기+가림). 문은 맨 아랫줄 왼쪽에서 4째 칸 — 문 앞 한 칸을 비우고 맨땅 길로 잇는다. 줄기 벽 앞에 지붕이 겹치게 두면 숲 속 집이 된다.', 3),
    ('crate', T.crate, 'object', '나무 상자', '1x1칸 바랜 나무 상자(Z 버팀대).', '막힘. 오두막 곁 벽에 붙여.', 1),
    ('crate-stack', T.crate_stack, 'object', '상자 더미', '2x2칸 상자 둘 위에 하나.', '아랫줄 막힘. 오두막 벽 곁.', 1),
    ('barrel', T.barrel, 'object', '나무 통', '1x1칸 쇠테 두른 세운 통.', '막힘. 오두막 곁·상자 곁.', 1),
    ('barrel-stack', T.barrel_stack, 'object', '통 더미', '2x2칸 통 둘 위에 하나.', '아랫줄 막힘. 오두막 문 곁(문 앞 칸은 비운다).', 1),
    ('woodpile', T.woodpile, 'object', '장작 더미', '2x1칸 단면이 보이게 세 단 쌓은 장작, 양끝 말뚝.', '막힘. 오두막 옆·뒤.', 1),
    ('chop-block', T.chop_block, 'object', '도끼 그루터기', '1x1칸 도끼가 박힌 그루터기.', '막힘. 장작 더미 곁.', 1),
    ('planter-box', T.planter, 'object', '꽃 상자', '1x1칸 나무 상자에 자줏빛 꽃.', '막힘. 오두막 문 곁·창 밑.', 1),
    ('sign-post', T.sign_post, 'object', '표지판 말뚝', '1x2칸 말뚝에 박은 네모 판자(글자 없음).', TALLR + '길가·갈림길·밭 문 곁.', 1),
    ('sign-arrow', lambda: T.sign_post(2611, True), 'object', '화살 표지판', '1x2칸 말뚝에 박은 화살 모양 판자(글자 없음, 오른쪽을 가리킴).', TALLR + '교차로 모퉁이. 길을 막지 않게 길 밖 칸.', 1),
    ('crop-carrot', lambda: T.crop('carrot'), 'decal', '당근', '1x1칸 깃털 잎 + 흙 위로 비친 주황 머리.', '밭 이랑(ground-garden-soil) 칸 가운데 한 포기. 한 이랑은 같은 작물로.', 0),
    ('crop-cabbage', lambda: T.crop('cabbage'), 'decal', '양배추', '1x1칸 둥근 연녹 결구.', '밭 이랑 칸. 한 칸 걸러 두면 덜 빽빽하다.', 0),
    ('crop-turnip', lambda: T.crop('turnip'), 'decal', '순무', '1x1칸 흰 뿌리 + 잎.', '밭 이랑 칸.', 0),
    ('crop-sprout', lambda: T.crop('sprout'), 'decal', '새싹', '1x1칸 갓 난 새싹 셋.', '밭 이랑 칸(막 심은 이랑).', 0),
]


# ================================================================ 1. 조각
def export_parts():
    pp = Parts(HERE)
    for (n, fn, ko, desc, rules) in G.GROUNDS:
        pp.add(n, fn(), 'floor', ko, desc, rules, brows=0, role='terrain', passable=True)
    AUT = [
        ('autotile-canopy-wall', A.canopy_sheet(), '수관 벽(테)', '숲 가장자리 수관 벽 16변형(위 1·오른 2·아래 4·왼 8): 이웃 없는 쪽은 둥근 잎 덩이(반원)가 이어진 봉우리 테 — 밝은 회록 잎끝 → 중간 잎 → 짙은 잎, 덩이 사이 홈은 그늘. 칸 끝은 덩이 한가운데라 이웃 칸과 높이가 맞는다. 속 칸(15)은 짙은 잎 결.',
         '막힘·위층(캐릭터를 덮는다). 맵 둘레와 빈터 사이를 두껍게(3칸 이상) 붓으로 칠한다 — 사각형 채우기 금지, 혹·만·코가 있는 덩이로. 속은 autotile-canopy-core 를 1~2칸 줄여 겹친다. 밑 바닥은 ground-grass-shade(덩이 홈으로 비친다). 북쪽 가장자리는 face-trunk-wall 위 줄까지 칠한다.', False, 'upper', 'wall'),
        ('autotile-canopy-core', A.core_sheet(), '수관 속 어둠', '수관 벽 안쪽 어둠 16변형: 짙은 잎 끝 테가 성기게 검정으로 녹아든다(맵 바깥·미탐색 어둠).',
         '막힘·위층. autotile-canopy-wall 덩이 안쪽, 빈터에서 2칸 이상 떨어진 칸에만 칠한다 → 「밝은 잎 → 중간 → 짙은 → 검정」 4겹 깊이. 맵 가장자리까지 이어 칠한다.', False, 'upper', 'wall'),
        ('autotile-dirt-path', A.dirt_sheet(), '맨땅 길 얼룩', '맨땅 길 16변형: 속은 다져진 흙(ground-dirt 와 같은 결), 가장자리는 얼룩지게 흩어져 풀이 비치고 풀 위로 흙 점이 튄다.',
         '걷기·아래층. 2칸 폭으로 굽이치게 lay_path 로 이어 칠한다(직선 금지). 교차점·문 앞 마당은 덩이로 넓히고, 숲 마당 곳곳에 작은 얼룩 덩이(2~4칸)로 흙이 드러나게 한다.', True, 'lower', 'terrain'),
        ('autotile-pond', A.pond_sheet(), '돌 둘레 연못', '짙은 청록 못물 ↔ 갈색 돌 띠(엇갈린 둥근 돌) ↔ 풀 술 16변형. 북쪽 둑은 3/4 로 돌 윗면 + 그늘진 돌 앞면이 보이고 물에 그늘이 진다. 물 속은 두 톤 + 굽이치는 잔물결 줄.',
         '막힘·아래층. 붓으로 불규칙한 덩이(혹·만·코, 3칸 이상)를 칠한다 — 사각형·1칸 폭 띠 금지. 둘레 1칸은 풀로 두고 reeds·바위·별꽃, 물 위에 lily-pads.', False, 'lower', 'terrain'),
        ('autotile-tallgrass', A.tall_sheet(), '짙은 풀숲', '빽빽한 짙은 풀 포기 덩이 16변형: 속은 세로 잎 획(밑동 짙고 끝 밝음), 가장자리는 잎끝이 삐죽 나오고 남쪽은 두께 그늘.',
         '걷기·아래층. 숲 가장자리·바위 풀숲·연못 둘레에 불규칙한 덩이로(사각형·일렬 금지). 길과 겹치지 않게.', True, 'lower', 'terrain'),
        ('autotile-garden-fence', A.fence_sheet(), '말뚝 울타리', '채소밭 말뚝 울타리 16변형: 동서 줄 = 가로대 두 줄 + 2px 널 말뚝, 남북 줄 = 위에서 본 말뚝 머리 줄, 끝·모서리·갈림은 굵은 기둥.',
         '막힘·위층(곧은 것이 맞는 구조물). 밭(ground-garden-soil) 둘레를 네모로 두르고 한 변에 2칸 문 틈을 남긴다. 문 틈 앞은 맨땅 길로 잇는다.', False, 'upper', 'fence'),
    ]
    for (n, sh, ko, desc, rules, passable, layer, role) in AUT:
        pp.add(n, sh, 'autotile', ko, desc, rules, brows=0, layer=layer, role=role, passable=passable, pad=False)
    for lst in (VEG, STRUCT):
        for (n, fn, kind, ko, desc, rules, brows) in lst:
            pp.add(n, fn(), kind, ko, desc, rules, brows=brows, role=ROLE[kind], passable=(brows == 0))
    return pp


# ================================================================ 2. 데모 맵
def build_map(pp):
    import nfc_map as M
    s, RY, CX = M.build(pp.imgs)
    samples = {n: pp.imgs[n] for (n, *_r) in G.GROUNDS}
    sheets = {'dirt': pp.imgs['autotile-dirt-path'], 'tall': pp.imgs['autotile-tallgrass'], 'pond': pp.imgs['autotile-pond'],
              'fence': pp.imgs['autotile-garden-fence'], 'canopy': pp.imgs['autotile-canopy-wall'], 'core': pp.imgs['autotile-canopy-core']}
    img = s.render(samples, sheets)
    img.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    img.resize((img.width * 2, img.height * 2), Image.NEAREST).convert('RGB').save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    start = (CX[47], 47)
    seen = s.bfs(start)
    rep = {k: (v in seen) for k, v in s.marks.items()}
    rep['exit_north'] = (CX[0], 0) in seen or (CX[0] + 1, 0) in seen
    rep['exit_west'] = (0, RY[0]) in seen; rep['exit_east'] = (63, RY[63]) in seen; rep['exit_south'] = True
    walk_cells = int(g.sum()); iso = walk_cells - len(seen)
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'legend': {'.': 'walkable', '#': 'blocked'},
               'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'marks': {k: list(v) for k, v in s.marks.items()}, 'start': list(start), 'reach': rep,
               'isolated_walk_cells': iso, 'empty_window': list(s.empty_ratio()), 'count': dict(s.count)},
              open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False, indent=0)
    return s, rep, iso


if __name__ == '__main__':
    pp = export_parts()
    n = pp.finish('자연 숲 마당(natural-forest-clearing) — 자연 숲·절벽 장르 장소 팩')
    A.check_sheet(os.path.join(HERE, 'check-autotile.png'))
    print('parts', n)
    s, rep, iso = build_map(pp)
    print('reach', rep); print('isolated', iso); print('warn', s.warn); print('empty(20x15 worst)', s.empty_ratio())
    if '--map-only' not in sys.argv:
        try:
            import nfc_battle, nfc_compare
            bg = nfc_battle.build(); bg.save(os.path.join(HERE, 'battle-bg.png')); nfc_battle.overlay(bg).save(os.path.join(HERE, 'check-overlay.png'))
            nfc_compare.build()
            print('battle-bg + compare-ref ok')
        except ImportError as e:
            print('skip', e)
