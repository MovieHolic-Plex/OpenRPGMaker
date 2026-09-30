#!/usr/bin/env python3
"""월드맵 3판 결 팔레트 tiledata/atlas-pick/palette/worldmap3.pal 을 만든다 (2판 worldmap.pal 은 그대로 둔다).
  python3 scripts/content/atlas-pick/make_worldmap3_palette.py

바탕 = 현대 칩셋 팔레트(m…) 그대로 + 월드맵 3판 램프. 램프 이름·단 수는 2판과 같아 생성기를 그대로 포크할 수 있다.
값은 바람들 v3(scripts/content/lib/gen_grassland/pal_v3_proposal.py)에서 온다 — worldmap-v3-style.md 2절 표.
2판(worldmap.pal)과 다른 점: 채도 높은 6단 램프, 어두운 끝은 푸른 초록·보라 갈색으로, 밝은 끝은 노란 초록으로 돈다 / 윤곽용 먹 #16110d(wink) 추가 /
회벽(wplast) 추가 / 순수 검정 없음. v3-*.pxg 만 이 팔레트로 검사한다(worldmap_check.py). 작업자는 여기에 색을 더하지 않는다.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

WORLD = {   # 월드맵 3판 색 (이름: 어두운 → 밝은). 이름·단 수는 2판과 같다 — 2판 생성기·검사·문맥 도구가 그대로 돈다.
    # 색 값은 바람들 v3(gen-grassland pal_v3_proposal.py)에서 가져왔다. 어두운 끝은 푸른 초록·보라 갈색쪽, 밝은 끝은 노란 초록쪽으로 색상이 돈다.
    # ── 땅 ──
    'wgrass': ['1d3b24', '2b5a2d', '3d7a34', '57983f', '77b14c', 'a2cb62'],               # 풀밭 (v3 GRASS) — 6단 채도 있는 풀
    'wmead':  ['142c1d', '1f4526', '2c5e2c', '3b7833', '4f913c', '6fab47'],               # 짙은 풀·키 큰 풀 (v3 TALL)
    'whill':  ['26502a', '3d7a34', '57983f', '77b14c', 'a2cb62', 'c9df82'],               # 언덕 풀: 풀밭 위쪽 단에 노란 초록 한 단 더
    'wleaf':  ['0f2a1c', '1a4526', '2a6230', '3f8037', '5c9c40', '86ba55'],               # 활엽수 수관 (v3 LEAF)
    'wpine':  ['0d2620', '123a2c', '1b5236', '286b3d', '3a8546', '5ea15a'],               # 침엽수: 잎 램프를 푸른 쪽으로 돌림
    'wbark':  ['2a130c', '472314', '653a21', '86552e'],                                   # 줄기 (v3 BARK 아래 4단)
    'wrock':  ['231a1a', '3a2c2a', '574238', '765a48', '98785a', 'b89a76', 'd6bc98'],     # 산 바위: 흙절벽(v3 CLIFF)보다 한 단 길게, 밝은 끝은 모래빛
    'wsand':  ['6b4a1c', '8f6a2a', 'b58b3c', 'd4ab52', 'e8c874', 'f6e3a4'],               # 사막 모래 (v3 밀 램프 계열)
    'wdune':  ['8a5a34', 'b58448', 'd4a45c', 'f0d08a'],                                   # 모래 언덕 그늘·빛
    'wsnow':  ['46507a', '6478a8', '8ea4cc', 'b4c8e4', 'd2e0f2', 'e8f1fa', 'ffffff'],     # 설원: 그늘을 푸른 보라로
    'wice':   ['1f3d78', '34609e', '5e90c8', '9cc2e6', 'd6ecf8'],                          # 얼음
    'wswamp': ['1a2a1a', '2c4022', '425a2c', '5e7434', '82903f', 'a8ae5a'],               # 늪 풀
    'wbog':   ['142222', '213a36', '335a52', '4e8074', '7aab98'],                          # 늪 물
    'wash':   ['16120f', '2a2220', '3c322e', '52463e', '6c5c50', '8a7864'],               # 화산재 땅
    'wlava':  ['3a0e06', '6a1a08', 'a0400e', 'd8661a', 'ffb040', 'ffe08a'],               # 용암 (2판과 같음)
    'wdirt':  ['44301f', '664a2d', '8a693f', 'b08d55', 'd8b982'],                          # 흙길 (v3 DIRT: 5단으로 줄임)
    'wpoison': ['20102e', '3a1a4a', '58286a', '7a3c8a', '9c58ac', 'c488cc'],             # 독늪
    # ── 물 ──
    'wsea':   ['1b3159', '254a86', '335eae', '4a80cc', '78a9e0', 'c6e1f5'],               # 얕은 바다 = v3 WATER 여섯 단 (채도 높은 파랑)
    'wdeep':  ['0c1832', '12244c', '1a3868', '22497f', '2c5a98', '3868b0'],               # 깊은 바다: WATER 보다 두 단 어둡게
    'wriver': ['24508c', '3868b8', '5088d0', '82b0e6', 'cce4f6'],                          # 강: 바다보다 한 톤 밝다
    'wfoam':  ['dbeefa', 'eef8fd', 'ffffff'],                                             # 물가 거품
    # ── 아이콘 재료 ──
    'wstone': ['24222d', '3c3a48', '585666', '777587', '9896a6', 'bdbcc8', 'e0dfe8'],     # 돌 (v3 STONE)
    'wroofr': ['3a0f10', '661a17', '902a20', 'b5432d', 'd26744'],                          # 붉은 기와 (v3 RED)
    'wroofb': ['141a38', '212c5a', '314482', '4662a8', '6887c6'],                          # 푸른 기와 (v3 BLUE)
    'wgold':  ['7f5f1d', 'a5812c', 'c6a13f', 'dfbe5a', 'f1da86'],                          # 초가·깃발 (v3 WHEAT)
    'wplast': ['5c4632', '8a7156', 'b39b7a', 'd2bf9b', 'e9dcbf', 'f7f0dc'],               # 회벽 (v3 PLASTER) — 3판 새 램프
    'wink':   ['16110d'],                                                                 # 먹 — 모든 윤곽 (순수 검정 없음)
}

def main():
    sys.path.insert(0, MODERN_LIB)
    import pal
    out = ['// 월드맵 세트 팔레트 — 바탕은 현대 칩셋 pal.RAMPS(현대 시트 자기 칸에서 뽑은 색, 이름 앞 m), 그 뒤에 월드맵 지형·아이콘 색(w…).',
           '// 이 파일은 scripts/content/atlas-pick/make_worldmap3_palette.py 가 만든다. 손으로 색을 더하지 마라(검사가 이 밖의 색을 불합격시킨다).',
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
    p = os.path.join(PAL_DIR, 'worldmap3.pal'); atomic_write(p, '\n'.join(out) + '\n')
    print(p, len(pal.RAMPS), '현대 램프 +', len(WORLD), '월드맵 램프')

if __name__ == '__main__':
    main()
