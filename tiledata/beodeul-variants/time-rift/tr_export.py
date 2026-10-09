# 시간의 틈 내보내기: parts/*.png + partmeta.json + parts.md, render-1x/2x, grid.json, compare-ref.png.
import os, json
import numpy as np
from PIL import Image, ImageDraw
from tr_base import *
import tr_isle as I, tr_void as V, tr_auto as A, tr_props as PR

HERE = os.path.dirname(os.path.abspath(__file__))


# ---------------------------------------------------------------- 걷는 구조물(떠 있는 돌 단) 단독 그림
def dais_piece():
    W, H = 224, 240; ctr = (112, 74, 106, 70)
    m = I.ellipse_mask(W, H, *ctr)
    isl = I.Island(m, 'path', body=5, root=12, seed=21)
    isl.region(m, 'dais', body=18, root=58, seed=22, center=ctr, glow='blue')
    im, k = I.render_islands(W, H, [isl]); _KIND[id(im)] = k; return im


def platform_piece(color='blue'):
    W, H = 128, 144; ctr = (64, 42, 56, 38)
    m = I.ellipse_mask(W, H, *ctr, 4, 2.0)
    im, k = I.render_islands(W, H, [I.Island(m, 'plat', body=8, root=30, seed=31, center=ctr, glow=color)]); _KIND[id(im)] = k; return im


def islet_piece():
    W, H = 64, 80; m = I.ellipse_mask(W, H, 32, 22, 30, 19, 9, 1.5)
    im, k = I.render_islands(W, H, [I.Island(m, 'plat', body=6, root=20, seed=33)]); _KIND[id(im)] = k; return im


def walk_rows(im, thr=.72):
    """맨 아래부터 걷는 칸(윗면·두께 띠가 칸의 3/4 이상)이 하나도 없는 줄 수 = 막히는 앞면·뿌리 줄."""
    a = np.array(im)
    top = (a[..., 3] > 0)
    # 뿌리·앞면은 섬 그리기에서 윗면보다 아래에 있다: 열마다 맨 아래 불투명 화소에서 위로 올라가며 윗면 경계를 찾기보다,
    # 같은 그림을 다시 그려 종류 지도를 얻는다(아래 _KIND).
    k = _KIND.get(id(im))
    if k is not None: top = (k == 1) | (k == 2)
    rows = im.height // T; n = 0
    for r in range(rows - 1, -1, -1):
        if any(top[r * T:(r + 1) * T, c * T:(c + 1) * T].mean() >= thr for c in range(im.width // T)): break
        n += 1
    return n


_KIND = {}


META = {}
def M(name, kind, ko, desc, rules, brows=None, layer=None, role=None): META[name] = (kind, ko, desc, rules, brows, layer, role)


M('rift-dais', 'walk', '시간의 틈 중앙 돌 단', '허공에 뜬 큰 둥근 돌 단(14x15): 윗면 동심 고리 판석 + 푸른 빛 상감 고리 둘 + 가운데 낮은 둥근 단, 앞면은 줄눈 없는 매끈한 흰 회색 돌 띠, 밑은 가늘어지는 바위 뿌리.',
  '윗면 칸(타원 안 3/4 이상) 걷기, 앞면 띠·뿌리 칸 막힘(허공). 허공 바닥 한가운데에 하나만. 가운데 둥근 단에 chrono-pedestal, 고리 가장자리에 부러진 기둥 2~4개를 높이·망가짐 다르게 흩는다(대칭 금지). 갈래 길(돌 길·별빛 다리·징검돌)은 동서남북 가장자리에서 뻗는다.', role='terrain')
M('rift-platform-round', 'walk', '떠 있는 둥근 돌 단(포털 단)', '갈래 끝에 뜬 둥근 판석 단(8x9): 버들항 광장 판석 + 포털 색 빛 상감 고리 한 줄, 밑은 바위 뿌리.',
  '윗면 칸 걷기, 아래 앞면·뿌리 줄 막힘. 포털(portal-*)을 단 북쪽 반에 얹고 남쪽 반은 비워 들어가는 자리로. 길·다리는 남쪽이나 옆 가장자리에서 닿게.', role='terrain')
M('rift-islet-small', 'walk', '작은 뜬 섬', '판석이 깔린 작은 떠 있는 섬(4x5): 쉼터·곁방·보물 자리.', '윗면 칸 걷기, 뿌리 줄 막힘. 징검돌이나 별빛 다리로 잇는다. 섬끼리 2칸 이상 띄운다.', role='terrain')
M('stepping-stone', 'walk', '허공 징검돌', '허공에 뜬 납작한 바위 한 덩이(1x2): 윗칸이 걷는 칸, 아랫칸은 짧은 뿌리.',
  '윗칸 걷기, 아랫칸은 허공(막힘)에 겹친다. 상하좌우로 이어지게 3~9개 계단꼴(대각선만으로 잇지 않는다). 양 끝은 섬 가장자리 걷는 칸에 닿게.', brows=1, role='terrain')
for col, ko in (('blue', '파랑'), ('violet', '보라'), ('gold', '금빛'), ('teal', '청록')):
    M('portal-' + col, 'object', '빛 포털(%s)' % ko, '낮은 돌 받침 위 버들항 홈 기둥 한 쌍과 그 사이 세로 타원 빛 소용돌이(4x4), 기둥머리 위 같은 색 빛 조각.',
      '아랫줄: 양 끝 기둥 칸 막힘, 가운데 두 칸(받침 윗면)은 걷기 = 이동 이벤트 칸. 위 세 줄 걷기+가림. 갈래 끝 돌 단 북쪽 반에, 앞(남쪽) 두 칸은 비운다. 한 지도에 색이 다른 포털을 갈래마다 하나씩.', brows=1, role='prop')
M('chrono-pedestal', 'object', '시간의 받침', '두 단 받침과 짧은 기둥 위 둥근 접시에 푸른 빛 구슬이 떠 있고 놋쇠 고리 둘이 엇갈려 감는다(2x3, 글자·눈금 없음).',
  '아랫줄 막힘, 위 두 줄 걷기+가림. 중앙 돌 단 가운데 둥근 단 위에 하나만. 앞(남쪽) 한 칸 비워 조사 자리로.', brows=1, role='prop')
M('pillar-broken-tall', 'object', '부러진 기둥(높음)', '받침 + 홈 기둥, 위가 깨졌고 그 위에 마름돌 조각 둘이 시간에 멈춘 듯 떠 있다(1x3).',
  '아랫줄만 막힘, 위는 걷기+가림. 돌 단·섬 가장자리에 2~4개, 높이(tall/short)와 간격을 다르게(일렬·대칭 금지). 곁에 rubble-rift·drum-fallen.', brows=1, role='prop')
M('pillar-broken-short', 'object', '부러진 기둥(낮음)', '허리에서 부러진 홈 기둥과 그 위 떠 있는 조각 하나(1x2).', '아랫줄만 막힘. 높은 기둥과 섞어 쓴다.', brows=1, role='prop')
M('arch-ruin', 'object', '무너진 아치 문', '기둥 둘 사이 쐐기돌 아치(3x3). 오른쪽 기둥이 부러져 끊긴 아치의 쐐기돌 셋이 허공에 멈춰 떠 있다.',
  '아랫줄 양 끝 기둥 칸만 막힘, 가운데 칸 지나감(아치 밑 통로). 위 줄 걷기+가림. 섬 가장자리 폐허 자리, 곁에 부러진 기둥·돌무더기.', brows=1, role='prop')
M('drum-fallen', 'object', '쓰러진 기둥 토막', '옆으로 누운 홈 기둥 토막, 왼쪽 끝 단면이 보인다(2x1).', '몸통 줄 막힘. 부러진 기둥 곁에 비스듬히 하나.', brows=1, role='prop')
M('rubble-rift', 'object', '돌무더기', '떨어진 마름돌 셋과 잔돌(2x1).', '몸통 줄 막힘. 부러진 기둥·아치 발치에. 길 가운데 금지.', brows=1, role='prop')
M('rift-bench', 'object', '쉼터 돌 벤치', '두 다리돌 위 판판한 돌 판(2x1).', '몸통 줄 막힘. 쉼터 섬 가운데쯤, 앞(남쪽) 한 칸 비운다. 가로등 곁.', brows=1, role='prop')
M('rift-lamp', 'object', '쉼터 가로등', '돌 받침 위 쇠 기둥, 굽은 팔 끝 유리 등에 푸른 불(1x3).', '아랫줄만 막힘, 위 걷기+가림. 벤치 곁에 하나. 발치에 autotile-lightspill 1~2칸.', brows=1, role='prop')
M('light-crystal', 'object', '빛 수정', '작은 바위 받침에서 솟은 푸른 수정 셋, 하나는 떨어져 떠 있다(1x2).', '아랫줄만 막힘. 섬 가장자리·폐허 곁에 1~2개.', brows=1, role='prop')
M('planter-glowflowers', 'object', '빛꽃 돌 화분', '낮은 네모 돌 화분에 푸른 빛을 내는 작은 꽃과 잎(2x1).', '몸통 줄 막힘. 쉼터 섬에 하나, 벤치 곁.', brows=1, role='prop')
M('bridge-post', 'object', '별빛 다리 기둥', '짧은 돌 기둥 꼭대기에 빛 구슬(1x2).', '아랫줄만 막힘. 별빛 다리 양 끝, 다리 칸 바로 북쪽 옆 섬 칸에 하나씩.', brows=1, role='prop')
for nm, ko, desc in (('pillar-drift-a', '떠다니는 기둥 토막 A', '위아래가 깨진 기둥 한 토막과 받침 덩이, 둘레 조각 둘(2x2).'),
                     ('pillar-drift-b', '떠다니는 기둥 토막 B', '조금 오른쪽으로 치우친 다른 기둥 토막(2x2).'),
                     ('arch-drift', '떠다니는 아치 조각', '바위 덩이 위 기둥에서 쐐기돌 아치가 휘다 끊긴 조각(3x3), 떨어진 쐐기돌 둘.'),
                     ('clock-ring', '멈춘 시계 고리', '비스듬히 선 큰 놋쇠 고리(눈금 열둘, 글자 없음)와 멈춘 바늘 둘, 깨진 조각(3x3).'),
                     ('time-shard', '시간 조각 거울', '허공에 뜬 납작한 유리 조각, 가장자리 금빛·속은 푸르다(1x2).'),
                     ('rock-drift-big', '떠 있는 바위(큼)', '다듬지 않은 바위 윗면 + 가늘어지는 뿌리(2x2).'),
                     ('rock-drift-small', '떠 있는 바위(작음)', '작은 바위 덩이(1x1).'),
                     ('far-isles', '먼 섬 그림자', '허공 저 멀리 뜬 작은 섬 둘, 어둡고 흐리다(2x1).')):
    M(nm, 'decal', ko, desc, '허공 칸(막힘) 위에만, 떠 있는 돌보다 아래 층에 그린다. 통행과 무관. 섬 사이 빈 허공에 드문드문(한 화면 2~4개), 같은 것을 나란히 두지 않는다.', brows=0, role='prop')
M('crack-glow', 'decal', '빛 새는 금', '판석 금 사이로 푸른 빛이 새어 나온다(2x1).', '걷기, 사람 아래. 중앙 돌 단·포털 단 판석 위에 드문드문.', brows=0, role='decal')
M('crack-glow-small', 'decal', '빛 새는 금(작음)', '짧은 금(1x1).', '걷기, 사람 아래.', brows=0, role='decal')
M('star-motes', 'decal', '별빛 티끌', '바닥 위 작은 빛 점 몇 개(1x1).', '걷기, 사람 아래. 섬 위 빈 판석 자리에 1칸씩 흩는다.', brows=0, role='decal')
M('ground-void', 'floor', '허공(별)', '어두운 남색에 별 점이 박힌 허공(3x3 표본, 이음새 없음).', '통행 불가 바닥. 지도 바탕 전체에 깔고 그 위에 떠 있는 돌을 얹는다.', brows=0, layer='lower', role='terrain')
M('ground-void-nebula', 'floor', '허공(성운)', '보라·청록 성운 덩이(둥근 덩이, 왼쪽 위 밝은 테, 디더 가장자리)가 번진 허공(3x3 표본).', '통행 불가. ground-void 사이에 섞어 성운 띠를 대각선으로 한두 줄(덩이로, 네모 금지).', brows=0, layer='lower', role='terrain')
M('ground-riftstone', 'floor', '떠 있는 돌 판석', '버들항 광장 판석 결을 허공 빛에 조금 식힌 돌 윗면(3x3 표본).', '걷기. 섬·돌 길 윗면 속칸. 가장자리는 autotile-riftstone.', brows=0, layer='lower', role='terrain')
M('face_rift', 'wall', '떠 있는 돌 앞면·뿌리', '판석 끝 두께 띠 아래 바위 앞면(버들항 절벽 갈빗대 결)과 허공으로 가늘어지는 바위 뿌리(3칸 폭 표본).',
  '떠 있는 돌 남쪽 가장자리 아래 허공 칸에 1~3줄(막힘). 섬이 클수록 길게, 끝은 들쭉날쭉 종유석.', brows=0, role='wall')
M('autotile-riftstone', 'autotile', '허공 ↔ 돌 가장자리', '허공 위 떠 있는 판석 16변형(위1·오른2·아래4·왼8): 이웃 없는 쪽은 둥근 모서리, 북쪽은 빛 받은 모서리, 남쪽은 두께 띠.',
  '걷기. 허공 바닥 위에 칠해 돌 길·섬을 만든다(폭 1~2칸 길은 굽이치게). 남쪽 가장자리 아래 허공 칸에 face_rift 또는 stepping-stone 뿌리를 덧댄다.', brows=0, layer='lower', role='terrain')
M('autotile-starbridge', 'autotile', '별빛 다리', '허공 위 반투명 빛 판 + 빛 난간 + 남쪽 두께선 16변형, 아래로 별이 비친다.',
  '걷기. 섬과 섬 사이 허공에 곧게 한 줄(폭 1칸), 양 끝은 섬 걷는 칸에 이웃으로 닿게. 끝에 bridge-post.', brows=0, layer='lower', role='terrain')
M('autotile-lightspill', 'autotile', '빛 번짐', '돌 위에 번진 푸른 빛 점무늬(디더 알파), 이웃 없는 쪽은 성기게 옅어진다(16변형).',
  '걷기. 포털 앞·가로등 발치·시간의 받침 둘레 1~2칸에만. 넓게 칠하지 않는다.', brows=0, layer='upper', role='decal')


def piece_images():
    return {
        'rift-dais': dais_piece(), 'rift-platform-round': platform_piece('blue'), 'rift-islet-small': islet_piece(), 'stepping-stone': PR.stepping_stone(),
        'portal-blue': PR.portal('blue', 1), 'portal-violet': PR.portal('violet', 2), 'portal-gold': PR.portal('gold', 3), 'portal-teal': PR.portal('teal', 4),
        'chrono-pedestal': PR.chrono_pedestal(), 'pillar-broken-tall': PR.pillar_broken(True, 3), 'pillar-broken-short': PR.pillar_broken(False, 8),
        'arch-ruin': PR.arch_ruin(13), 'drum-fallen': PR.drum_fallen(), 'rubble-rift': PR.rubble(), 'rift-bench': PR.bench_stone(), 'rift-lamp': PR.rift_lamp(),
        'light-crystal': PR.light_crystal(), 'planter-glowflowers': PR.planter_glow(), 'bridge-post': PR.bridge_post('blue'),
        'pillar-drift-a': PR.pillar_drift(5), 'pillar-drift-b': PR.pillar_drift(9, 1), 'arch-drift': PR.arch_drift(7), 'clock-ring': PR.clock_ring(9),
        'time-shard': PR.time_shard(25), 'rock-drift-big': PR.rock_drift(True, 71), 'rock-drift-small': PR.rock_drift(False, 72), 'far-isles': PR.far_isles(27),
        'crack-glow': PR.crack_glow(29, 2), 'crack-glow-small': PR.crack_glow(33, 1), 'star-motes': PR.star_motes(31),
        'ground-void': V.ground_void(), 'ground-void-nebula': V.ground_void_nebula(), 'ground-riftstone': A.ground_riftstone(), 'face_rift': A.face_rift_sample(),
        'autotile-riftstone': A.riftstone_sheet(), 'autotile-starbridge': A.starbridge_sheet(), 'autotile-lightspill': A.lightspill_sheet(),
    }


def compare_ref(img):
    """같은 2배: [버들항 성 앞뜰 판석·석재 | 중앙 돌 단·남쪽 길] / [탑 꼭대기 방 별 허공 | 북쪽 포털 단·다리] /
    [고대 숲 옛 유적(합격선) | 남서 폐허 섬·아치] / [화산 지대 현무암 절벽 | 돌 단 밑 바위 뿌리]."""
    ROOT_ = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
    city = Image.open(os.path.join(ROOT_, 'tiledata/beodeul-city/render/city6_base.png')).convert('RGBA')
    tw = Image.open(os.path.join(ROOT_, 'tiledata/beodeul-variants/tower-interior/render-1x.png')).convert('RGBA')
    af = Image.open(os.path.join(ROOT_, 'tiledata/beodeul-variants/ancient-forest/compare-ref.png')).convert('RGBA')
    vf = Image.open(os.path.join(ROOT_, 'tiledata/beodeul-variants/volcano-field/render-1x.png')).convert('RGBA')
    af1 = af.crop((660, 500, 1140, 860)).resize((240, 180), Image.NEAREST)
    pairs = [('beodeul city6_base: castle court flags + stone', city.crop((40, 200, 280, 380)), 'time-rift: central dais rings + south path', img.crop((216, 160, 456, 340))),
             ('tower-interior: summit room stone + star void', tw.crop((1060, 0, 1300, 180)), 'time-rift: north portal platform + star bridge', img.crop((216, 0, 456, 180))),
             ('ancient-forest: old ruins (pass bar)', af1, 'time-rift: ruin islet + broken arch', img.crop((60, 280, 300, 460))),
             ('volcano-field: basalt cliff face', vf.crop((440, 210, 680, 390)), 'time-rift: dais underside rock root', img.crop((216, 250, 456, 430)))]
    S2 = 2; pw, phh = 240 * S2, 180 * S2
    out = Image.new('RGBA', (pw * 2 + 30, (phh + 22) * len(pairs) + 8), (28, 28, 34, 255)); d = ImageDraw.Draw(out)
    for i, (la, a, lb, b) in enumerate(pairs):
        y = 8 + i * (phh + 22)
        d.text((10, y), la, fill=(230, 230, 230, 255)); d.text((pw + 20, y), lb, fill=(230, 230, 230, 255))
        out.alpha_composite(a.resize((pw, phh), Image.NEAREST), (10, y + 14))
        out.alpha_composite(b.resize((pw, phh), Image.NEAREST), (pw + 20, y + 14))
    out.convert('RGB').save(os.path.join(HERE, 'compare-ref.png'))


def export(s, im, seen, dens):
    Pq = Parts(HERE)
    imgs = piece_images()
    for n, (kind, ko, desc, rules, brows, layer, role) in META.items():
        img = imgs[n]
        if brows is None and kind == 'walk': brows = walk_rows(img)
        pad = not (n.startswith('autotile-') or n.startswith('ground-') or n == 'face_rift')
        Pq.add(n, img, kind, ko, desc, rules, brows if brows is not None else 0, layer, role, pad=pad)
    cnt = Pq.finish('시간의 틈·허공 쉼터 (time-rift)')
    im.convert('RGB').save(os.path.join(HERE, 'render-1x.png'))
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(HERE, 'render-2x.png'))
    g = s.walk_grid()
    json.dump({'w': s.W, 'h': s.H, 'tile': 16, 'rows': [''.join('.' if g[y, x] else '#' for x in range(s.W)) for y in range(s.H)],
               'legend': {'.': 'walkable', '#': 'blocked'}, 'entrance': list(s.marks['arrival_portal']),
               'marks': {k: list(v) for k, v in s.marks.items()}, 'reach': {k: (tuple(v) in seen) for k, v in s.marks.items()},
               'bridge': sorted([list(c) for c in s.bridge]), 'stones': [list(c) for c in s.stones],
               'walkable': int(g.sum()), 'reached': len(seen), 'pruned': [list(c) for c in sorted(s.pruned)],
               'empty_window': [dens[0], list(dens[1]) if dens[1] else None], 'empty_mean': dens[2],
               'count': dict(s.count)}, open(os.path.join(HERE, 'grid.json'), 'w'), ensure_ascii=False)
    compare_ref(im)
    return cnt
