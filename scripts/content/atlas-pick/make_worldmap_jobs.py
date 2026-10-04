#!/usr/bin/env python3
"""월드맵 세트 기물 목록·배정표 tiledata/atlas-pick/jobs-worldmap.json 과 기물 폴더(candidates-worldmap/<slug>/info.json·palette.pal)를 만든다.
  python3 scripts/content/atlas-pick/make_worldmap_jobs.py      # 목록 쓰기 + 폴더 준비(있는 후보 파일은 건드리지 않는다)

격자 = 16px (oprn-atlas 생성 계열·강남·손 도트 실내 v5 와 같은 칸). 월드맵 한 칸 = 필드 축척(마을 하나가 1~2칸).
기물 종류(kind):
  bundle  이어짐 조각 묶음 3×4칸(48×64) — 엔진의 월드 지형 오토타일 문법(src/project/defaults/worldTerrainAutotiles.ts
          roles(): 앵커+0 외딴, +2 안쪽 모서리, +30.. 3×3 틀)과 같은 배치. 8px 사분면 합성(terrainQuarterAutotile.ts)으로 이어진다.
          층 decal: 덩이 바깥은 투명 — 고른 바탕(under)을 시트를 구울 때 밑에 깐다.
  base    바탕 몸통 변형 3×1칸 — 칸을 꽉 채운 불투명(ground), 서로 섞어 깔아도 이어진다.
  scatter 흩뿌림 단품 3×1칸 — 바탕 위 한 칸짜리 덧칠(decal) 셋.
  piece   이어 붙는 단품(다리) — decal, 한 축으로 이어진다.
  icon    장소 아이콘 — object(위층, 투명 배경, 칸 아래에 선다).
작업자 wv1…wv8(2판) 에게 겹침 없이, 짝·세트(같은 계열 지형·같은 식구 아이콘)는 한 사람에게. 1판(w1…w5) 배정은 jobs 의 revisions 에 남긴다."""
import json, os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

BUNDLE_LAYOUT = [   # 3×4 칸 배치(행 우선). 역할 id → 한국어
    ['isolated', 'body_alt', 'inner'],
    ['corner_nw', 'edge_n', 'corner_ne'],
    ['edge_w', 'body', 'edge_e'],
    ['corner_sw', 'edge_s', 'corner_se'],
]
ROLE_KO = {'isolated': '외딴 한 칸(이웃 없이 혼자 선 통그림)', 'body_alt': '몸통 변형(몸통과 섞어 까는 두 번째 속)',
           'inner': '안쪽 모서리(네 귀에 바깥이 파고든 오목 모서리 넷)', 'corner_nw': '북서 모서리', 'edge_n': '북쪽 변',
           'corner_ne': '북동 모서리', 'edge_w': '서쪽 변', 'body': '몸통(사방이 같은 땅)', 'edge_e': '동쪽 변',
           'corner_sw': '남서 모서리', 'edge_s': '남쪽 변', 'corner_se': '남동 모서리'}
UNDER = {   # 묶음·다리 밑에 깔릴 바탕(시트를 구울 때 고른 판으로 바뀐다). 맥락 그림은 임시 바탕을 쓴다
    'plains': '평원 풀(plains_base 고른 판)', 'sand': '사막 모래(desert 몸통 고른 판)', 'snow': '설원(snow 몸통 고른 판)',
    'ash': '화산재(ash 몸통 고른 판)', 'sea': '얕은 바다(coast_grass 몸통 고른 판)', 'river': '강물(river 몸통 고른 판)',
}
KIND_LAYER = {'bundle': 'decal', 'base': 'ground', 'scatter': 'decal', 'piece': 'decal', 'icon': 'object'}

R_FIELD, R_FOREST, R_HIGH, R_COLD, R_DRY, R_WATER, R_SITE = '들·길', '숲·늪', '산·화산', '눈', '사막', '물가', '장소'
# 2판(2026-09-30): World.png(EasyRPG RTP) 구조 학습을 반영 — tiledata/atlas-pick/worldmap-reference-study.md.
# 묶음 style: line = 1칸 폭 줄로도 쓰는 지형(해협·강·길·용암 줄기; shore-strait hard) / flat = 평지 덩이 / mass = 숲·산처럼 덩이 무늬.
# (slug, 이름, 지역, 종류, w, h, 밑바탕, 통행, 설명, 팔레트 힌트[, style])
ITEMS = [
    # ── 들·길·강 ──
    ('plains_base', '평원 바탕', R_FIELD, 'base', 3, 1, None, 'walk',
     '월드맵의 맨땅 풀밭. 세 칸 = 몸통 변형 셋(① 민풀 ② 풀 결 몇 가닥 ③ 작은 풀 덩이 하나). World.png 평원은 **3색**뿐이다 — 우리도 3~4단, 명도 차 ~20. 셋을 아무렇게나 섞어 깔아도 칸 경계가 안 보여야 한다(16px 주기, 평균 명도 같게). 이 풀이 모든 묶음의 바깥(밑바탕)이 된다 — 조용할수록 위 지형이 산다.',
     'wgrass 2~4단만, 꽃 점 금지(흩뿌림 몫)'),
    ('plains_scatter', '평원 흩뿌림', R_FIELD, 'scatter', 3, 1, 'plains', 'walk',
     '빈 평원에 한 칸씩 흩뿌리는 덧칠 셋: ① 바위 두어 개 ② 꽃무더기(작은 덤불 + 꽃 점 서너 개) ③ 풀 둔덕. 나무는 trees_scatter 몫. 숲 덩이보다 작고 조용하게, 칸 가운데 10px 안.',
     'wrock 바위, wmead·mwhite·wgold 꽃'),
    ('trees_scatter', '외딴 나무 셋', R_FIELD, 'scatter', 3, 1, 'plains', 'block',
     '한 칸짜리 외딴 나무 셋: ① 둥근 활엽수 한 그루(수관 지름 10~12px, 윗왼 밝은 덩이 셋 + 오른아래 어두운 틈, 줄기 2px, 발치 그림자) ② 잎 없는 고목(갈라진 가지, 줄기 윤곽) ③ 야자수(휘어진 줄기 + 잎 다섯 갈래). World.png 는 이것들을 위층 단품으로 따로 둔다 — 숲 덩이 가장자리에 붙여 숲 끝을 흐트러뜨리는 용도도 있다.',
     'wleaf·wbark, 고목 wbark·wash, 야자 wmead·wbark', None),
    ('meadow', '초원(짙은 풀)', R_FIELD, 'bundle', 3, 4, 'plains', 'walk',
     '평원 위 짙은 풀밭 덩이(World.png 「짙은 풀」 블록). 경계는 기슭 깊이 2~4px 안에서 풀잎 끝이 바깥으로 삐져나온다(높이 1~2px, 폭 섞음 — 같은 간격 톱니 금지). 속은 평원보다 한두 단 어둡고 짧은 세로 풀 획이 드문드문. 모서리 둥글게.',
     'wmead 풀, 가장자리 끝 wgrass 밝은 단', 'flat'),
    ('hills', '언덕', R_FIELD, 'bundle', 3, 4, 'plains', 'walk',
     '풀 덮인 낮은 언덕 무리. World.png 산맥 블록의 **배치 원리**(봉우리를 16px 격자에 두고 8px 엇갈려 겹친다)를 낮고 둥근 둔덕으로: 둔덕 하나 = 폭 12~14px·높이 6~8px 반원, 윗왼 비탈 밝게·오른아래 비탈 어둡게, 앞 둔덕이 뒤 둔덕 밑동을 가린다. 바위 없음. 산맥과 실루엣이 확실히 달라야 한다(뾰족 금지).',
     'whill 비탈, 그늘 wgrass 어두운 단', 'mass'),
    ('road', '흙길', R_FIELD, 'bundle', 3, 4, 'plains', 'walk',
     '장소 사이를 잇는 흙길. 1칸 폭 길이 주 용도 → 기슭(풀 테) 깊이는 칸 바깥 3~4px, 길 속 폭 8~10px. 풀 테는 길 위로 1~2px 불규칙하게 덮는다(World.png 흙 블록처럼 풀 덩이가 흙을 파먹는 모양, 같은 간격 톱니 금지). 속은 흙 결만(바퀴 자국 금지), 대비 낮게.',
     'wdirt 흙, 테 wgrass', 'line'),
    ('river', '강', R_FIELD, 'bundle', 3, 4, 'plains', 'block',
     '평원을 흐르는 강. 1칸 폭 강줄기가 주 용도 → 기슭 깊이 3~4px, 물 폭 8~10px. 물가 = World.png 물가처럼 **어두운 흙 둑 한 줄(1~2px, 혹 진 선)** + 물 쪽 밝은 테 1px. 흰 거품 금지. 속은 흐름 방향 짧은 밝은 획 두어 개. 바다보다 밝고 초록빛 도는 민물.',
     'wriver 물, 둑 wdirt 어두운 단, 테 wriver 밝은 단', 'line'),
    ('bridge_h', '다리(가로)', R_FIELD, 'piece', 1, 1, 'river', 'walk',
     '세로로 흐르는 강을 동서로 건너는 다리 한 칸. World.png 다리는 **돌** 상판에 양쪽 난간 테가 굵게(2px) 서고 상판 가운데가 한 단 밝다 — 월드맵 축척에서는 난간이 다리를 대표한다. 나무·돌 중 하나로, 남쪽 물 위 그림자 한 줄. 좌우 끝이 같은 높이라 여러 칸 이어 붙는다.',
     'wstone 또는 mwood, 그림자 ~'),
    ('bridge_v', '다리(세로)', R_FIELD, 'piece', 1, 1, 'river', 'walk',
     '가로로 흐르는 강을 남북으로 건너는 다리 한 칸. bridge_h 와 같은 재료·같은 난간 두께(동서 난간 2px), 동쪽 물 위 그림자 한 줄. 위아래 끝이 이어 붙는다.',
     'wstone 또는 mwood, 그림자 ~'),
    # ── 숲·늪 ──
    ('forest', '숲(활엽수 덩이)', R_FOREST, 'bundle', 3, 4, 'plains', 'block',
     'World.png 숲 블록의 형태: **둥근 수관(지름 7~9px)이 8px 간격 엇갈린 격자로 겹겹이** 놓이고, 수관마다 윗왼 밝은 덩이·오른아래 짙은 그늘, 수관 사이 틈은 가장 어두운 초록. 가장자리 = 수관 둥근 윤곽이 칸 바깥쪽 8px 안에서 불룩(곧은 테 금지), **남쪽 변만 줄기 2px 가 보이고**(3/4 시점) 동쪽 변엔 줄기 한두 개. 외딴 칸 = 나무 두세 그루 덩이. 몸통은 16px 주기로 수관이 이어진다(칸 경계에서 수관이 잘리지 않게 걸쳐 그린다).',
     'wleaf 4~5단, wbark 줄기, ~ 발치', 'mass'),
    ('conifer', '침엽수림', R_FOREST, 'bundle', 3, 4, 'plains', 'block',
     '뾰족한 전나무 숲. 나무 하나 = 폭 6~8px 세모 두세 층, 활엽수와 같은 **8px 엇갈린 격자**로 겹친다(앞줄이 뒷줄 밑동을 가림). 왼쪽 면 밝게 오른쪽 면 어둡게. 남쪽 변은 밑동 줄기 1~2px. 둥근 덩이 금지.',
     'wpine 잎, wbark 밑동', 'mass'),
    ('snow_conifer', '눈 덮인 침엽수림', R_FOREST, 'bundle', 3, 4, 'snow', 'block',
     'conifer 와 같은 나무 모양·격자에 층 윗변마다 눈(1~2px). World.png 눈 숲처럼 눈 얹힌 윗면이 밝고, 남쪽 줄기 사이로 초록 한두 점. conifer 와 같은 글자끼리 한 식구.',
     'wpine 잎, wsnow 눈 얹힘', 'mass'),
    ('jungle', '밀림', R_FOREST, 'bundle', 3, 4, 'plains', 'block',
     '남쪽 섬의 열대 밀림. 활엽수 숲보다 어둡고 채도 높은 초록, 수관 사이로 **야자 잎 갈래(가는 잎 5갈래 별꼴)** 가 섞여 윤곽이 들쭉날쭉. 숲(forest)과 한눈에 구분되게 — 잎 끝이 뾰족하게 삐져나온다. 남쪽 변 줄기는 가늘고 휜다.',
     'wmead 짙은 단·wleaf, wbark', 'mass'),
    ('dead_forest', '고목 숲', R_FOREST, 'bundle', 3, 4, 'plains', 'block',
     '저주받은 땅·화산 둘레의 잎 없는 고목 숲. 가지가 갈라진 앙상한 나무(줄기 2px, 가지 1px)가 8px 엇갈린 격자로 서고, 발치에 마른 풀·재. 수관이 없으므로 밑바탕이 비친다 — 나무가 촘촘해야 덩이로 읽힌다(한 칸에 두세 그루). 실루엣만으로 가지가 읽혀야 한다.',
     'wbark 줄기, wash 발치 재, wswamp 마른 풀', 'mass'),
    ('swamp', '늪', R_FOREST, 'bundle', 3, 4, 'plains', 'block',
     '검푸른 늪물 웅덩이와 갈대·이끼 둔덕이 섞인 습지(독늪과 다르다 — 보라 없음). 속 = 어두운 물 웅덩이(둥근 덩이 4~6px) 사이로 풀 둔덕, 갈대 세로 획 몇 개. 경계 = 기슭 깊이 2~4px, 풀이 질척하게 어두워지며 녹아든다. 모서리 둥글게.',
     'wbog 물, wswamp 둔덕·갈대', 'flat'),
    ('poison_marsh', '독늪', R_FOREST, 'bundle', 3, 4, 'plains', 'block',
     'World.png 독늪처럼 한눈에 「밟으면 다치는 땅」: 채도 낮춘 보라 물에 **둥근 돌·거품 덩이(지름 4~6px, 윗왼 밝은 테)** 가 자갈처럼 빽빽이, 드문 반짝임 한 점. 가장자리 = 짙은 테 1px(끊긴 선) + 풀이 파먹는 불규칙한 선, 기슭 깊이 2~4px, 모서리 둥글게. 늪(swamp)과 색·결 모두 달라야 한다.',
     'wpoison 물·거품, 테 wpoison:0·wdirt:0', 'flat'),
    ('ruins', '폐허', R_SITE, 'icon', 2, 1, 'plains', 'walk',
     '무너진 옛 도시·신전 터. World.png 폐허처럼 **돌 벽 토막(흉벽 톱니가 부서진)** 두세 개가 높이가 다르게 서고, 무너진 돌 더미. 윤곽 1px(돌 가장 어두운 단), 윗면 밝게. 멀쩡한 건물로 읽히면 실패.',
     'wstone 돌, 이끼 wswamp·wmead 점'),
    ('cave', '동굴 입구', R_SITE, 'icon', 1, 1, 'plains', 'walk',
     '바위 언덕에 뚫린 어두운 동굴 입구. **칸 폭의 60% 넘는 검은 아치**(속 가장 어두운 단, 아치 안쪽 테 한 단 밝게), 아치 위 바위 이마(윗면 밝게), 아래 흙 문턱. 실루엣 한 색으로도 아치가 읽혀야 한다.',
     'wrock 바위, 구멍 mout·wrock:0'),
    # ── 산·화산 ──
    ('mountain', '산맥', R_HIGH, 'bundle', 3, 4, 'plains', 'block',
     'World.png 산맥 블록의 형태: **봉우리 하나 = 폭 14~15px·높이 11~13px 세모(꼭대기 1~2px 뾰족), 16px 격자에 놓고 줄마다 8px 엇갈려** 앞 봉우리가 뒤 봉우리 아랫도리를 가린다 → 겹친 줄기(능선)로 읽힌다. 왼쪽 비탈 밝게(2단), 오른쪽 비탈 어둡게(2단), 가운데 능선 한 줄 가장 어둡게, 비탈에 짧은 골 1~2줄. 가장자리 = 봉우리 발치가 칸 바깥쪽 8px 안에서 풀밭에 앉는다. 외딴 칸 = 봉우리 하나(칸 꽉). 언덕과 확실히 다르게 — 바위·뾰족.',
     'wrock 4~5단, 기슭 whill·wgrass 어두운 단', 'mass'),
    ('snow_mountain', '설산', R_HIGH, 'bundle', 3, 4, 'snow', 'block',
     'mountain 과 같은 봉우리·격자에 꼭대기 1/3 이 눈(눈 경계는 비탈 골을 따라 들쭉날쭉, 왼쪽 비탈 눈이 더 밝다). 밑바탕은 설원. mountain 과 같은 글자끼리 한 식구.',
     'wrock 바위, wsnow 눈', 'mass'),
    ('cliff_plateau', '고원 절벽', R_HIGH, 'bundle', 3, 4, 'plains', 'block',
     '산맥 사이·대륙 가운데 솟은 고원(World.png 위층 고원 블록의 형태). 덩이 안 = 고원 윗면(평원보다 한 단 밝은 풀, 조용하게), **남쪽 변 = 절벽 앞면 6~8px(바위 결 세로 골, 위 밝게 아래 어둡게)**, 동서 변 = 절벽 옆면 2~3px, 북쪽 변 = 윗면 테 1px 만(뒤쪽이라 앞면이 안 보인다). 모서리는 둥글게 휜 절벽. 산맥의 관문 틈 둘레, 성이 선 대지.',
     'whill·wgrass 윗면, wrock 절벽', 'mass'),
    ('big_mountain', '홀로 선 큰 산', R_HIGH, 'icon', 2, 2, 'plains', 'block',
     'World.png 큰 산처럼 **2×2 를 꽉 채운 넓은 원뿔 하나**: 꼭대기에서 발치로 퍼지는 능선 서너 줄(방사형 골), 왼쪽 면 밝게·오른쪽 면 어둡게 큰 면으로 나뉜다. 꼭대기 눈 한 점(선택). 산맥 봉우리와 같은 바위 결.',
     'wrock 바위, 꼭대기 wsnow 조금'),
    ('gate_fort', '관문 요새', R_HIGH, 'icon', 1, 1, 'plains', 'walk',
     '산맥 관문 틈을 막는 작은 요새(outdoor-guide-world 「산맥 줄기 + 관문 틈」). 흉벽 두른 돌 문루 하나 + 가운데 어두운 문 아치, 양옆 벽 토막. 칸 폭 80% 이상. 성보다 작고 낮게, 탑·지붕 없음.',
     'wstone 벽, 문 mout'),
    ('volcano', '화산', R_HIGH, 'icon', 2, 2, 'ash', 'block',
     'World.png 화산처럼 **큰 산과 같은 원뿔 틀**에 꼭대기 분화구(윗면 타원) + 붉은 용암이 한쪽 비탈로 흘러내린 줄기 하나, 비탈은 잿빛 바위(큰 산보다 회색·검게). 연기는 선택(투명 배경 위 회색 두세 단, 작게). 빛나는 용암은 면적 작게 한 덩이로.',
     'wash 비탈, wlava 용암, mconc·mwhite 연기'),
    ('ash', '화산재 벌판', R_HIGH, 'bundle', 3, 4, 'plains', 'walk',
     '화산 둘레의 검은 재 땅. 속 = 어두운 회갈 재 + 굳은 용암 돌 덩이 몇 개 + 가는 금 두어 줄, 대비 낮게. 경계 = 기슭 깊이 2~4px, 풀이 타서 누렇게 사라지며 재로 넘어간다(혹 진 선, 모서리 둥글게).',
     'wash 재, 테 wgrass·wsand 어두운 단', 'flat'),
    ('lava', '용암', R_HIGH, 'bundle', 3, 4, 'ash', 'block',
     '재 벌판 속 용암 강·호수. 1칸 폭 용암 줄기로도 이어진다 → 기슭 깊이 3~4px, 속 폭 8px 이상. 경계 = 검붉은 굳은 테 1~2px(바로 안쪽이 가장 밝다), 속 = 밝은 주황에 검붉은 껍질 조각. World.png 물가처럼 테가 혹 진 한 줄.',
     'wlava 용암, 테 wash', 'line'),
    # ── 눈·사막 ──
    ('snow', '설원', R_COLD, 'bundle', 3, 4, 'plains', 'walk',
     'World.png 설원처럼 **가장 조용한 덩이**: 흰 눈에 옅은 푸른 결(바람 자국 가로 획 드문드문), 경계 = 푸른 그늘 테 1px + 둥근 모서리(반지름 4~6px), 기슭 깊이 2~3px. 새하얀 판 금지(밝은 끝 한 단은 빛 받는 곳만). 7색 이내.',
     'wsnow 눈, 테 wsnow 어두운 단·wgrass', 'flat'),
    ('desert', '사막', R_DRY, 'bundle', 3, 4, 'plains', 'walk',
     'World.png 모래 블록처럼 모래에 **사선 물결 줄(모래 언덕 등성이, 밝은 선 + 바로 아래 그늘 선이 짝)** 두세 줄이 칸 경계를 넘어 이어진다(16px 주기). 경계 = 풀 덩이가 모래를 파먹는 불규칙한 선, 기슭 깊이 2~4px, 모서리 둥글게. 바닥이므로 대비 낮게.',
     'wsand 모래, wdune 등성이, 테 wgrass', 'flat'),
    ('desert_scatter', '사막 흩뿌림', R_DRY, 'scatter', 3, 1, 'sand', 'walk',
     '사막 위 한 칸 덧칠 셋: ① 선인장(팔 둘) ② 바위 무더기 ③ 짐승 뼈·해골. 모래와 대비되게 윤곽 1px, 발치 그림자.',
     'wmead·wleaf 선인장, wrock 바위, mwhite·wsand 뼈', None),
    ('oasis', '오아시스', R_DRY, 'icon', 1, 1, 'sand', 'walk',
     '사막 속 작은 샘: 둥근 물웅덩이(지름 8~10px, 물가 둑 1px) + 곁 야자 한 그루. 칸 폭 80% 이상.',
     'wriver·wsea 물, wmead·wbark 야자'),
    # ── 물가 ──
    ('coast_grass', '바다·해안(풀 해안)', R_WATER, 'bundle', 3, 4, 'plains', 'block',
     '대륙을 두른 바다. 덩이 안 = 얕은 바다, 바깥(투명) = 풀 땅. **기슭 깊이 = 칸 바깥 2~4px(이음 열 0·7·8·15 은 모두 같은 값 J=3 권장)**, 해협(1칸 폭 물) 속 8px 이상. 물가 = 땅 쪽 어두운 흙 둑 한 줄(북쪽 물가는 3/4 시점 둑 앞면 2px) + 물 쪽 밝은 테 1px + 여울 2px, **흰 거품 금지**. 바깥 모서리 큰 원, 안쪽 모서리 홈 반지름 3. 몸통 = 드문 물결 획(무늬 벽지 금지). 기준: candidates-worldmap/coast_grass/pilot-A.',
     'wsea 물, 둑 wdirt·wgrass 어두운 단', 'line'),
    ('coast_sand', '바다·해안(모래 해변)', R_WATER, 'bundle', 3, 4, 'sand', 'block',
     'coast_grass 와 같은 바다·같은 기슭선(깊이 표를 그대로)에 밑바탕이 모래인 판. 물가 = 젖은 모래 한 줄(한 단 어둡게) + 밝은 테. 바다 몸통 화소는 coast_grass 와 같게.',
     'wsea 물, 젖은 모래 wsand 어두운 단', 'line'),
    ('coast_snow', '바다·해안(얼음 해안)', R_WATER, 'bundle', 3, 4, 'snow', 'block',
     'coast_grass 와 같은 바다·같은 기슭선에 밑바탕이 설원인 판. 물가 = 얼음 테(푸른 흰 판 2px, 윗면 밝게) — World.png 눈 해안처럼 테가 굵고 밝다. 바다 몸통 화소는 coast_grass 와 같게.',
     'wsea 물, wice 얼음 테, wsnow', 'line'),
    ('sea_deep', '깊은 바다', R_WATER, 'bundle', 3, 4, 'sea', 'block',
     '얕은 바다 가운데 깔리는 깊은 바다(World.png 는 깊은 물 몸통을 따로 둔다 — 얕은 곳보다 두 단 어둡다). 속 = 얕은 바다보다 두 단 어둡고 푸르게, 물결 더 드물게. 경계 = 얕은 물과 부드럽게 두세 화소 섞인 혹 진 선, 기슭 깊이 2~4px, 모서리 둥글게.',
     'wdeep 물, 경계 wsea', 'flat'),
    ('shoal', '여울·암초', R_WATER, 'bundle', 3, 4, 'sea', 'block',
     '얕은 바다 속 밝은 여울(모래톱)과 암초 덩이 — 깊이 단계 세 번째(깊은 바다 < 얕은 바다 < 여울). 속 = 얕은 바다보다 두 단 밝은 청록 물 아래 모래 비침 + 바위 머리 점 몇 개(배가 못 다닌다). 경계 = 부드럽게 섞인 혹 진 선, 기슭 깊이 2~4px.',
     'wsea 밝은 단, wsand 비침, wrock 바위 머리', 'flat'),
    ('ice_sea', '유빙 바다', R_WATER, 'bundle', 3, 4, 'sea', 'block',
     '북쪽 바다에 떠 있는 얼음판 덩이(World.png 얼음 칸처럼 얼음판 윗면 밝고 앞면 한 단 어둡다). 속 = 얼음판(모서리 깎인 네모·다각 4~8px) 사이로 검푸른 물 틈. 경계 = 얼음판 조각이 물로 흩어진다, 기슭 깊이 2~4px.',
     'wice 얼음, wsea·wdeep 물 틈', 'flat'),
    ('port', '항구', R_WATER, 'icon', 2, 2, 'plains', 'walk',
     '해안 마을의 항구: 위 칸 = 창고·집 지붕 둘, 아래 칸 = 바다로 뻗은 나무 부두 + 돛배 한 척(흰 돛 세모, 선체 갈색). 아래 칸 부두·배 둘레는 투명(바다가 비친다). 마을과 한 식구 지붕.',
     'wroofr 지붕, mwood 부두·선체, mwhite 돛'),
    ('lighthouse', '등대', R_WATER, 'icon', 1, 2, 'plains', 'walk',
     '곶 끝의 등대: 흰 원통 몸통(붉은 띠 한두 줄, 왼쪽 밝게) + 꼭대기 등실(노란 불빛 %) + 바위 받침. 1×2 를 꽉 채워 높이를 과장. 탑(tower)과 색으로 구분.',
     'mwhite·mred 몸통, wgold·% 불빛, wrock 받침'),
    # ── 장소 ──
    ('hamlet', '작은 마을', R_SITE, 'icon', 1, 1, 'plains', 'walk',
     'World.png 마을처럼 **한 칸짜리** 작은 마을: 큰 박공지붕 집 하나 + 곁에 작은 집·탑 하나, 지붕이 칸 폭 절반 이상(지붕이 마을을 대표한다). 윤곽 1px. village(2×1) 보다 작다.',
     'wroofr 지붕, mwhite·mbrick 벽'),
    ('village', '마을', R_SITE, 'icon', 2, 1, 'plains', 'walk',
     '마을: 박공지붕 집 두세 채(지붕이 벽보다 크고 밝게), 문 한 점, 집 사이 나무 한 그루. 집 모양·지붕 색을 섞되 한 식구. 성벽 없음.',
     'wroofr·wroofb 지붕, mwhite·mbrick 벽, mwood 문'),
    ('snow_village', '눈 마을', R_COLD, 'icon', 1, 1, 'snow', 'walk',
     'hamlet 과 같은 틀에 지붕이 눈으로 덮인 판(World.png 눈 마을). 지붕 윗면 흰 눈, 처마 끝 푸른 그늘, 벽은 나무. 밑바탕 설원.',
     'wsnow 눈 지붕, mwood 벽'),
    ('town', '성벽 도시', R_SITE, 'icon', 2, 2, 'plains', 'walk',
     '낮은 성벽이 두른 도시: 성벽 테(윗면 한 줄 밝게, 흉벽 톱니) 안에 지붕 여럿이 빽빽이, 남쪽 가운데 성문(어두운 아치). 마을보다 크고 단단해 보이게, 성보다 낮게.',
     'wstone 성벽, wroofr·wroofb 지붕'),
    ('castle', '성', R_SITE, 'icon', 2, 2, 'plains', 'walk',
     'World.png 성처럼 **네 귀 둥근 탑(흉벽 톱니) + 가운데 본성 + 앞 성문**, 돌 윤곽 1px(가장 어두운 단), 탑마다 왼쪽 밝게 오른쪽 어둡게. 뾰족 지붕 탑 하나 이상으로 도시와 구분, 깃발 한 점.',
     'wstone 벽, wroofb 지붕, wgold·mred 깃발'),
    ('dark_castle', '마왕성', R_SITE, 'icon', 2, 2, 'ash', 'walk',
     '마지막 던전: castle 과 같은 틀을 **검보라 돌 + 뾰족 첨탑 셋 이상**(가운데가 가장 높다)으로, 창에 붉은 불빛 두세 점(%). 성과 실루엣이 달라야 한다(첨탑 수·높이). 밑바탕 재.',
     'wstone 어두운 단·mpurple, 불빛 wlava·%'),
    ('tower', '탑', R_SITE, 'icon', 1, 2, 'plains', 'walk',
     'World.png 탑처럼 1×2 를 꽉 채운 원통(왼쪽 밝게·오른쪽 어둡게 세로 명암), 층마다 흉벽 테, 창 한두 점, 발치 문. 마법사 탑이면 꼭대기 뾰족 지붕.',
     'wstone 몸통, wroofb·wroofr 지붕'),
    ('temple', '신전', R_SITE, 'icon', 2, 2, 'plains', 'walk',
     '흰 돌 신전: 세모 박공 지붕 + 앞 기둥 열(기둥 넷, 기둥 사이 어두운 그늘) + 계단 받침 두세 단. 성·도시와 다르게 — 돌이 밝고 지붕이 낮은 세모.',
     'wstone 밝은 단, 박공 wgold 한 줄'),
    ('shrine', '사당', R_SITE, 'icon', 1, 1, 'plains', 'walk',
     'World.png 작은 돔 사당처럼 한 칸짜리 성소: 둥근 돔 지붕(윗왼 밝게) + 앞 기둥 둘 + 어두운 입구, 돌 받침. 신전(2×2)의 작은 판 — 같은 흰 돌.',
     'wstone 밝은 단, 돔 wroofb 또는 wgold'),
    ('big_tree', '거목', R_FOREST, 'icon', 2, 2, 'plains', 'block',
     '대륙의 이정표 거목(세계수): World.png 큰 나무처럼 2×2 를 꽉 채운 둥근 수관(덩이 여섯~여덟, 윗왼 밝게) + 굵은 줄기와 뿌리. 숲 수관과 같은 잎 결, 크기로 구분.',
     'wleaf 수관, wbark 줄기'),
]
# 2판 배정 = 세트 단위(같은 계열 지형·같은 식구 아이콘은 한 사람). 순서 = 작업 순서(바탕·몸통이 먼저). 한 번에 최대 8명.
WORKERS = {
    'wv1': ['coast_grass', 'coast_sand', 'coast_snow', 'sea_deep', 'shoal'],                                   # 물가: 바다 몸통 공유 + 깊이 단계
    'wv2': ['plains_base', 'plains_scatter', 'meadow', 'hills', 'road', 'river', 'bridge_h', 'bridge_v'],        # 들·길·강
    'wv3': ['mountain', 'snow_mountain', 'cliff_plateau', 'big_mountain', 'gate_fort'],                        # 산·고원·관문
    'wv4': ['ash', 'lava', 'volcano', 'poison_marsh', 'dead_forest'],                                          # 화산·독·저주받은 숲
    'wv5': ['forest', 'conifer', 'snow_conifer', 'jungle', 'trees_scatter', 'big_tree'],                        # 숲
    'wv6': ['snow', 'desert', 'swamp', 'ice_sea', 'desert_scatter', 'oasis'],                                   # 눈·사막·늪 바닥
    'wv7': ['hamlet', 'village', 'snow_village', 'town', 'port', 'lighthouse'],                                 # 마을·항구
    'wv8': ['castle', 'dark_castle', 'tower', 'temple', 'shrine', 'ruins', 'cave'],                             # 성·신전·던전
}
WORKERS_V1 = {   # 1판 배정(후보 파일 w1-A … 이 이 이름으로 남아 있다)
    'w1': ['coast_grass', 'coast_sand', 'coast_snow', 'sea_deep', 'port'],
    'w2': ['plains_base', 'plains_scatter', 'meadow', 'hills', 'road', 'river', 'bridge_h', 'bridge_v'],
    'w3': ['mountain', 'snow_mountain', 'big_mountain', 'ash', 'lava', 'volcano'],
    'w4': ['forest', 'conifer', 'snow_conifer', 'swamp', 'ruins', 'cave'],
    'w5': ['snow', 'desert', 'village', 'town', 'castle', 'tower', 'temple'],
}
FAMILIES = [   # 같은 방향 글자끼리 한 식구로 보여야 하는 묶음(절차서·보고용). 한 식구는 한 작업자 안에 있다
    ('바다 몸통 공유', ['coast_grass', 'coast_sand', 'coast_snow']), ('바다 깊이 단계', ['sea_deep', 'shoal']),
    ('산 봉우리', ['mountain', 'snow_mountain', 'big_mountain']), ('다리 둘', ['bridge_h', 'bridge_v']),
    ('화산 셋', ['ash', 'lava', 'volcano']), ('침엽수 둘', ['conifer', 'snow_conifer']), ('활엽 수관', ['forest', 'trees_scatter', 'big_tree']),
    ('마을 지붕', ['hamlet', 'village', 'snow_village', 'town', 'port']), ('성 돌', ['castle', 'dark_castle', 'tower', 'gate_fort']),
    ('흰 돌 성소', ['temple', 'shrine']), ('던전 아이콘', ['ruins', 'cave']),
]
CROSS_FAMILIES = {'성 돌'}   # gate_fort(wv3) 는 산맥 곁이라 wv3 가 그리되 wv8 의 성 돌을 열어 보고 맞춘다

def cost(it):
    s, kind, w, h = it[0], it[3], it[4], it[5]
    return {'bundle': 12, 'base': 3, 'scatter': 3, 'piece': 1}.get(kind, w * h * 2)   # 아이콘은 칸당 2(세밀함)

def main():
    by = {i[0]: i for i in ITEMS}
    flat = [s for l in WORKERS.values() for s in l]
    assert len(flat) == len(set(flat)), '배정이 겹친다'
    assert set(flat) == set(by), ('배정 누락/초과', set(by) ^ set(flat))
    for name, fam in FAMILIES:
        if name in CROSS_FAMILIES: continue
        assert len({o for o, l in WORKERS.items() for s in fam if s in l}) == 1, fam
    owner = {s: w for w, lst in WORKERS.items() for s in lst}
    items = []
    for row in ITEMS:
        s, name, region, kind, w, h, under, passage, desc, hint = row[:10]; style = row[10] if len(row) > 10 else None
        layer = KIND_LAYER[kind]; assert layer in LAYERS, layer
        if kind == 'bundle': assert (w, h) == (3, 4), s
        it = dict(id=s, slug=s, name=name, scene=region, kind=kind, cells=[w, h], canvas=[w * 16, h * 16], layer=layer,
                  layer_ko=LAYERS[layer][0], under=under, under_ko=UNDER.get(under), passage=passage,
                  description=desc, palette_hint=hint, worker=owner[s])
        if kind == 'bundle':
            assert style in ('line', 'flat', 'mass'), s
            it['style'] = style; it['layout'] = BUNDLE_LAYOUT; it['roles_ko'] = ROLE_KO
        if kind in ('base', 'scatter'):
            it['variants'] = 3
        if kind == 'piece':
            it['joins'] = 'x' if s.endswith('_h') else 'y'
        items.append(it)
    order = {s: i for i, s in enumerate(flat)}
    jobs = dict(version=2, set='worldmap', grid=16,
                note='JRPG 월드맵(필드 축척) 16px 조각 배정표 2판. 작업자별 기물 slug 목록(겹침 없음, 순서 = 작업 순서). 절차는 WORKER-WORLDMAP.md, 형태 근거는 worldmap-reference-study.md. 팔레트 palette/worldmap.pal. 2판 후보 파일은 wvN-A.pxg(1판 w1-A.pxg 는 그대로 남는다).',
                revisions=[dict(version=1, date='2026-09-30', items=32, workers=WORKERS_V1, files='wN-X.pxg'),
                           dict(version=2, date='2026-09-30', items=len(ITEMS), files='wvN-X.pxg',
                                why='사용자: 「월드맵 칩은 World.png(EasyRPG RTP) 보고 많이 수정해라」. 1판 해안이 네모·톱니·해협에 흰 줄 — 기슭 깊이·사분면 이음 규칙과 shore-* 검사 추가, 기물 16개 추가(깊이 단계·독늪·숲 종류·고원·작은 장소).')],
                directions={'A': 'World.png 구조를 우리 팔레트로(덩이 크기·격자·기슭 깊이·테 방식을 참고 연구 표대로)',
                            'B': '명암·깊이 강화(A 구조에 3/4 시점 면·발치 그림자·물 깊이 단 한 단 더)',
                            'C': '다른 해석(같은 기슭·이음 수치 안에서 World.png 와 다른 형태 언어)'},
                styles={'line': '1칸 폭 줄로도 쓰는 지형 — 해협·길·강 속 폭 6px 이상(hard)', 'flat': '평지 덩이 — 기슭 2~4px·이음·톱니 검사', 'mass': '숲·산처럼 덩이 무늬 — 이음 경고만'},
                kinds={'bundle': '이어짐 조각 묶음 3×4칸(외딴·몸통 변형·안쪽 모서리 / 3×3 틀), 바깥 투명',
                       'base': '바탕 몸통 변형 3칸(불투명)', 'scatter': '흩뿌림 단품 3칸', 'piece': '한 축으로 이어지는 단품', 'icon': '장소 아이콘(위층)'},
                bundle_layout=BUNDLE_LAYOUT, under=UNDER, families=[dict(name=n, slugs=l) for n, l in FAMILIES],
                workers=WORKERS, items=sorted(items, key=lambda x: order[x['slug']]))
    atomic_write(os.path.join(BASE, 'jobs-worldmap.json'), json.dumps(jobs, ensure_ascii=False, indent=1) + '\n')
    cd = os.path.join(BASE, 'candidates-worldmap')
    for it in items:
        d = os.path.join(cd, it['slug']); os.makedirs(os.path.join(d, 'work'), exist_ok=True)
        atomic_write(os.path.join(d, 'info.json'), json.dumps(it, ensure_ascii=False, indent=1) + '\n')
        shutil.copyfile(os.path.join(PAL_DIR, 'worldmap.pal'), os.path.join(d, 'palette.pal'))
        keep = os.path.join(d, 'work', '.keep')
        if not os.listdir(os.path.join(d, 'work')): open(keep, 'w').close()
    print(len(items), '기물 (묶음', sum(i['kind'] == 'bundle' for i in items), '· 아이콘', sum(i['kind'] == 'icon' for i in items), ')')
    for w, l in WORKERS.items():
        print(' ', w, len(l), '무게', sum(cost(by[s]) for s in l), ' '.join(l))

if __name__ == '__main__':
    main()
