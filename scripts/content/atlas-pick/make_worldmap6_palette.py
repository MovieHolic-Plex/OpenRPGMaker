#!/usr/bin/env python3
"""월드맵 6판 팔레트 tiledata/atlas-pick/palette/worldmap6.pal (5판·3판 팔레트는 그대로 둔다).
  python3 scripts/content/atlas-pick/make_worldmap6_palette.py

5판은 FF6 세계지도(어둡고 채도 낮음)를 재서 만들었다. 사용자 판정: 「월드맵이 (핀터레스트 그림) 이 정도 퀄리티는 됐으면」.
그 그림을 16px 칸 단위로 **재어 보니**(worldmap-v6-target.md) 풀은 채도 높은 어두운 올리브(HSL 70~82°/60~90%/명도 7~21),
밝은 풀밭 얼룩은 탈채도 연한 올리브(명도 40~55), 산은 따뜻한 갈색(30~33°) 윗면 + 어두운 절벽 줄, 지붕은 회청색, 물은 청록 하늘색.
아래 색은 **재어 낸 값으로 새로 정한 램프**다(원본 픽셀을 옮기지 않는다). 5판 램프 이름은 그대로 두고 값만 6판 것으로 덮어쓴다.
v6-*.pxg 만 이 팔레트로 검사한다(worldmap_check.py). 램프는 어두운 → 밝은 순.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa
import make_worldmap5_palette as P5

W6 = {
    # ── 땅 ── (재어 낸 올리브: 어두운 아래 #212509 · #2f4606 · #405204 · #405b08 · #555f0e)
    'wgrass': ['1c2106', '2a3a05', '384c06', '465c0a', '55700f', '688418'],   # 기본 풀: 색 4단 + 어두운 줄 + 가장 밝은 잎끝
    'wmead':  ['4e5c16', '5f7024', '728238', '86965a', '9aa96c', 'b0bc88'],   # 밝은 풀밭 얼룩(탈채도) — 큰 덩이 안쪽
    'whill':  ['465c0a', '55700f', '688418', '7c9430', '90a44c', 'a8b872'],   # 언덕 풀
    'wleaf':  ['12160a', '1e2a06', '2b3a0c', '384c0f', '486014', '5f781f'],   # 침엽 잎
    'wpine':  ['0e1408', '182208', '233214', '2f4519', '3e5a20', '507028'],   # 침엽수 몸(살짝 푸른 초록)
    'wbark':  ['1c1208', '30200f', '4a3018', '6a4a29'],
    'wrock':  ['24130a', '3b2210', '52341c', '6a4a29', '7e613b', '937d5f', 'b4a082'],   # 산 갈색: 윗면 4단(6a4a29~937d5f) + 빛 받은 결
    'wcliff': ['14090a', '24130a', '3b2210', '4d2d16'],                                   # 어두운 절벽 줄
    'wsand':  ['78643a', '94804a', 'b09850', 'c0a860', 'd0b870', 'e0c888'],
    'wdune':  ['685838', '887848', 'a89858', 'c8b878'],
    'wsnow':  ['5a6c86', '86a0b8', 'aec4d6', 'cfe0ea', 'eaf3f7', 'ffffff'],
    'wice':   ['284068', '405888', '6888a8', 'a0c0d0', 'd0e4ec'],
    'wdirt':  ['211d08', '39340f', '55501c', '706f36', '8c8a52', 'a7a274'],   # 길: 어두운 테 + 회갈색 바닥
    'wfield': ['5c4a1c', '675521', '786232', '84693b', '93794a', 'a48a5b', 'b49a6b'],   # 밀밭
    'wcrop':  ['46521a', '536121', '617031', '697839', '798849', '8a995a', '98a868'],   # 연두 밭
    'wledge': ['2a1e12', '4a3a24', '6e5a38', '8e784c', 'a89060', 'c4ac7c'],   # 해안 턱 돌(둥근 자갈)
    'wpebble': ['1c2630', '38444f', '586674', '7c8a98', 'a0acb8'],           # 물가 바위
    # ── 물 ── (재어 낸 청록 하늘색 #2c4e65 · #377799 · #427d9d · #5c8ba2)
    'wsea':   ['1a3040', '24405a', '2c4e65', '377799', '427d9d', '5c8ba2'],
    'wdeep':  ['122430', '1a3040', '24405a', '2c4e65', '377799', '427d9d'],
    'wriver': ['24405a', '2c4e65', '377799', '427d9d', '5c8ba2', '86b0c4'],
    'wfoam':  ['5c8ba2', '86b0c4', 'b4d0dc'],
    # ── 건물 ──
    'wstone': ['1e1a10', '332a1a', '4a3c26', '6b664b', '86795a', 'a09385', 'c4bcac'],   # 성벽·돌 (따뜻한 회갈)
    'wroofr': ['2c1c14', '443120', '694930', '886b5a', 'a58472'],
    'wroofb': ['1a2530', '2a3a48', '344149', '516374', '6d829a', '8fa5b8'],           # 파란 지붕(실측 344149 · 516374)
    'wgold':  ['605020', '806c30', 'a08840', 'c0a458', 'd8c078'],
    'wplast': ['3e3430', '5e5048', '8a7a76', 'b7a3a0', 'd6cbc8', 'ece6e4'],           # 회칠 벽·창틀
    'wwoodh': ['1e140c', '35251a', '55402c', '755b3f', '95795c'],                     # 목조 뼈대(반목조)
    'wink':   ['0f0d08'],
}

def main():
    sys.path.insert(0, MODERN_LIB)
    import pal
    world = dict(P5.WORLD); world.update(W6)
    out = ['// 월드맵 6판 팔레트 — 바탕은 현대 칩셋 pal.RAMPS(m…), 그 뒤에 월드맵 6판 색(w…).',
           '// 이 파일은 scripts/content/atlas-pick/make_worldmap6_palette.py 가 만든다. 손으로 색을 더하지 마라.',
           '// 값은 목표 그림을 칸 단위로 재어 새로 정한 것이다(tiledata/atlas-pick/worldmap-v6-target.md). 0 = 가장 어두움.', '',
           '// ── 현대 칩셋 바탕 ──']
    for name, ramp in pal.RAMPS.items():
        out.append('@rampc m%-7s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// ── 월드맵 6판 지형·물·건물 색 ──']
    for name, ramp in world.items():
        out.append('@rampc %-8s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// 반투명(빛은 왼쪽 위 → 그림자는 오른쪽 아래).',
            '~ #141218 110   // 그림자 속', '- #141218 58    // 그림자 번짐',
            '% #fff8d0 120   // 불빛 번짐',
            '# #e040c0       // 실루엣 단계 표시색(최종본에 남으면 불합격)']
    os.makedirs(PAL_DIR, exist_ok=True)
    p = os.path.join(PAL_DIR, 'worldmap6.pal'); atomic_write(p, '\n'.join(out) + '\n')
    print(p, len(world), '월드맵 램프')

if __name__ == '__main__':
    main()
