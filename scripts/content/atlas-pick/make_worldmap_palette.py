#!/usr/bin/env python3
"""월드맵 세트 팔레트 tiledata/atlas-pick/palette/worldmap.pal 을 만든다.
  python3 scripts/content/atlas-pick/make_worldmap_palette.py

바탕 = 현대 칩셋 팔레트(scripts/content/lib/modern/pal.py RAMPS — 현대 시트 자기 칸에서 뽑은 색) 그대로, 이름 앞에 m.
  아이콘(마을·성·탑·신전·항구)의 벽·지붕·나무·쇠는 이것부터 쓴다 — 강남·일본 세트와 같은 식구 색.
그 위에 월드맵 지형 램프(w…)를 손으로 골라 더한다. 끝 색(가장 어두운·가장 밝은 쪽)은 같은 계열(oprn-atlas) 시트의
재칠 스펙 scripts/content/lib/atlas_biome_specs.py 에서 가져와, 필드 시트와 월드맵이 같은 땅색으로 이어지게 했다
(각 램프 옆 주석 = 출처 스펙). 가운데 단은 손으로 넣었다(식으로 보간하지 않는다).
검사(check_candidate.py·worldmap_check.py)가 받는 색 = 이 파일의 색(반투명은 여기 적힌 (색, 알파)만).
작업자는 이 파일에 색을 더하지 않는다. 모자라면 감독자에게 말하고, 감독자가 여기서 고친 뒤 make_worldmap_jobs.py 로 폴더 사본을 갱신한다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

WORLD = {   # 월드맵 지형·아이콘 색 (이름: 어두운 → 밝은). pxgrid 열쇠 「이름:단」
    # ── 땅 ──
    'wgrass': ['163a1e', '225428', '367834', '549c46', '82be64', 'c4e4a0'],               # 평원 풀 = BIOMES.modern.grass (강남 시트 잔디와 같은 풀)
    'wmead':  ['143c1a', '1e5822', '307c28', '4ea032', '7ec446', 'bee66e'],               # 짙은 풀·초원 = BIOMES.jungle.grass
    'whill':  ['1c3a1a', '2e5a2a', '48803a', '6aa04a', '98c46a', 'cce49a'],               # 언덕 풀 비탈(평원보다 누렇게, 윗면 밝게)
    'wleaf':  ['0c2616', '1a4e2a', '2a6c34', '3a8a3e', '6aae58', 'a4d474'],               # 활엽수 수관 = BIOMES.modern.foliage 끝 색
    'wpine':  ['0a1c1c', '12302c', '1c4a42', '2e6256', '527e6e', '88b4a2'],               # 침엽수 = BIOMES.taiga.foliage 끝 색
    'wbark':  ['1e140c', '3a2616', '5a3c22', '7a5632'],                                   # 줄기(수관 아래 1~2px 만)
    'wrock':  ['1e1a16', '332d28', '48403a', '625a52', '7a7066', 'a09888', 'c8c0ae'],     # 산 바위 = BIOMES.dwarf.earth 끝 색
    'wsand':  ['605028', '826c3a', 'a68a50', 'c4a668', 'dec488', 'f4e2b4'],               # 사막 모래 = BIOMES.desert.grass
    'wdune':  ['8a6444', 'b8905e', 'c89c62', 'f0d49e'],                                   # 모래 언덕 그늘·빛 = BIOMES.desert.ground
    'wsnow':  ['4a5470', '6a7f9e', '93a9c6', 'b9cce0', 'd6e2ee', 'e9f1f8', 'ffffff'],     # 설원 = BIOMES.tundra.ground/earth
    'wice':   ['1e4468', '3a6a92', '6a9ec4', 'a8cce4', 'd8ecf8'],                          # 얼음 해안·언 물 = BIOMES.tundra.water/waterFoam
    'wswamp': ['1e2414', '303a1e', '48542a', '646e3a', '8a9056', 'b8ba82'],               # 늪 풀 = BIOMES.swamp.grass
    'wbog':   ['161410', '2c2a20', '4c4e40', '7a8074', 'aab2a4'],                          # 늪 물 = BIOMES.swamp.water
    'wash':   ['12100e', '221e1c', '2e2a26', '423c36', '524c44', '6e665c'],               # 화산재 땅 = BIOMES.gothic.earth
    'wlava':  ['3a0e06', '6a1a08', 'a0400e', 'd8661a', 'ffb040', 'ffe08a'],               # 용암 = BIOMES.dwarf.water(용암 물) 끝 색
    'wdirt':  ['3e2814', '5e3e24', '845c38', 'a87e52', 'cca676'],                          # 흙길 = BIOMES.desert.road
    'wpoison': ['1c1024', '30183a', '482658', '643a74', '84589a', 'ac86c0'],             # 독늪(2판 추가) — 채도 낮춘 보라, 밝은 끝은 거품·반짝임만
    # ── 물 ──
    'wsea':   ['0e3a5a', '14567a', '1e7494', '2c96b0', '5ec0cc', 'a0e4e0'],               # 얕은 바다 = BIOMES.desert/tropical.water 사이
    'wdeep':  ['061430', '0a2248', '10325e', '1a4676', '285c8e', '3e76a6'],               # 깊은 바다(얕은 바다보다 두 단 어둡고 푸르게)
    'wriver': ['1a3442', '24505e', '3a6a7c', '5e94a0', '9cc6cc'],                          # 강 = BIOMES.modern.water (강남 강과 같은 물)
    'wfoam':  ['b8dce0', 'e0f2f0', 'ffffff'],                                             # 물가 거품 = waterFoam
    # ── 아이콘 재료(현대 m 램프에 없는 것만) ──
    'wstone': ['2a2628', '423c3c', '5e5654', '7e7670', 'a09890', 'c4bcb2', 'e2dcd2'],     # 성벽·신전 돌(따뜻한 회색)
    'wroofr': ['3a1210', '6a2018', '9a3424', 'c0503a', 'dc7a5a'],                          # 붉은 지붕(채도 낮춘 벽돌빛)
    'wroofb': ['1a2238', '2c3a5a', '425680', '6a82aa', '9ab0cc'],                          # 푸른 지붕(성·탑)
    'wgold':  ['4a3208', '7a5610', 'b08420', 'e0b848', 'f8e08a'],                          # 깃발 끝·신전 장식(면적 작게)
}

def main():
    sys.path.insert(0, MODERN_LIB)
    import pal
    out = ['// 월드맵 세트 팔레트 — 바탕은 현대 칩셋 pal.RAMPS(현대 시트 자기 칸에서 뽑은 색, 이름 앞 m), 그 뒤에 월드맵 지형·아이콘 색(w…).',
           '// 이 파일은 scripts/content/atlas-pick/make_worldmap_palette.py 가 만든다. 손으로 색을 더하지 마라(검사가 이 밖의 색을 불합격시킨다).',
           '// 격자: @mat 글자 램프 [기본단] → @mblock / @tblock X Y 램프 / @tadj. 0 = 가장 어두움.', '',
           '// ── 현대 칩셋 바탕(강남 조각과 같은 색 — 아이콘의 벽·나무·쇠·유리) ──']
    for name, ramp in pal.RAMPS.items():
        out.append('@rampc m%-7s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// ── 월드맵 지형·물·아이콘 색 ──']
    for name, ramp in WORLD.items():
        out.append('@rampc %-8s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// 반투명(빛은 왼쪽 위 → 그림자는 오른쪽 아래). 산·숲 덩이의 남동쪽 발치, 아이콘 발치에만.',
            '~ #141218 110   // 그림자 속', '- #141218 58    // 그림자 번짐',
            '% #fff8d0 120   // 불빛 번짐(용암 빛·마을 불빛)',
            '# #e040c0       // 실루엣 단계 표시색(최종본에 남으면 불합격)']
    os.makedirs(PAL_DIR, exist_ok=True)
    p = os.path.join(PAL_DIR, 'worldmap.pal'); atomic_write(p, '\n'.join(out) + '\n')
    print(p, len(pal.RAMPS), '현대 램프 +', len(WORLD), '월드맵 램프')

if __name__ == '__main__':
    main()
