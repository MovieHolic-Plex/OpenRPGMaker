#!/usr/bin/env python3
"""일본 세트 팔레트 tiledata/atlas-pick/palette/jp.pal 을 만든다.
  python3 scripts/content/atlas-pick/make_jp_palette.py

바탕 = 현대 칩셋 팔레트(scripts/content/lib/modern/pal.py RAMPS — 현대 시트 자기 칸에서 뽑은 색) 그대로.
그 위에 일본 거리 색 램프를 손으로 골라 더한다(어두운 → 밝은, 몸통 채도 낮게, 어두운 끝은 붉은 보라 쪽).
검사(check_candidate.py)가 받는 색 = 이 파일의 색(반투명은 여기 적힌 (색, 알파)만).
작업자는 이 파일에 색을 더하지 않는다. 색이 모자라면 감독자에게 말하고, 감독자가 여기서 램프를 고친 뒤 다시 돌린다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

JP = {   # 일본 색 (이름: 어두운 → 밝은). 이름은 pxgrid 열쇠 「이름:단」 으로 쓴다
    'shu':     ['3a0c0a', '6a1a10', '9c2c16', 'c8401c', 'e05e30', 'ee8656', 'f6b48c'],   # 도리이·신사 주홍(朱)
    'akachin': ['2e080a', '5a0e10', '8e1616', 'c02018', 'dc4028', 'ec7048', 'f6a882'],   # 붉은 등롱·제등(赤提灯)
    'ai':      ['0c1224', '15224a', '1f336c', '2d4a8c', '5270a8', '8498c4', 'bcc6de'],   # 노렌 남색(藍)
    'kawara':  ['16191f', '262b35', '373e4b', '4b5361', '646d7c', '838c99', 'a8b0ba'],   # 기와 은회색(いぶし瓦)
    'hinoki':  ['3a2414', '5c3c20', '82603a', 'a6825a', 'c6a47c', 'e0c6a0', 'f2e2c6'],   # 흰 나무(檜·격자문·에마)
    'sumi':    ['1a120e', '2c2018', '423024', '5a4432', '765a44', '94765c'],               # 짙은 나무·그을린 판자(오래된 목조)
    'washi':   ['6c6252', '9c907a', 'c8bc9e', 'e2d8bc', 'f4eedc', 'fffaf0'],               # 종이(등롱 속·시데·오미쿠지)
    'sakura':  ['5e2a40', '94486a', 'c47492', 'e09cb4', 'f0c2d2', 'fbe2ea'],               # 벚꽃
    'matsu':   ['10200f', '1a3418', '284c22', '3c6630', '5a8446', '82a664'],               # 소나무·이끼·신사 숲
    'moss':    ['2a3018', '424a24', '5c6630', '7a8442', '9ca45c'],                         # 돌 위 이끼
    'ishi':    ['24262a', '3a3d42', '52565c', '6c7076', '8a8e92', 'aaaeb0', 'caccca'],     # 석등·고마이누 화강암
    'lacq':    ['07070a', '121218', '1e1e28', '2e2e3c', '464656', '646478', '8a8aa0'],     # 검정 택시·옻칠·자전거
    'taxi':    ['4a3200', '7a5600', 'b08400', 'e0b010', 'f2cc3a', 'fae47a'],               # 노랑 택시·건널목 노랑
    'neon':    ['3a0a2e', '6e1456', 'a81e82', 'e038aa', 'f478cc', 'fcbce8'],               # 파칭코·노래방 네온 분홍
    'neonc':   ['062a34', '0c4e5e', '12788a', '20a8b8', '5cd4dc', 'b0f2f2'],               # 네온 청록
    'kgreen':  ['0c2a16', '14462a', '1e6a3e', '2c8e52', '4eae6e', '8ad0a0'],               # 콘비니 초록 띠·JR 초록·공중전화
    'korange': ['4a1a00', '7e3406', 'b8540e', 'e8761a', 'f49a48', 'fac690'],               # 콘비니 주황 띠·전봇대 반사띠
    'kblue':   ['061a3a', '0c3066', '15489a', '2466c4', '5690dc', 'a0c4f0'],               # 콘비니 파랑 띠·표지판 파랑
    'pole':    ['3c3a34', '5a5850', '7a776c', '9a968a', 'b8b4a6', 'd6d2c4'],               # 콘크리트 전봇대·블록 담장
    'kasa':    ['1c2a30', '2c4450', '406270', '5a8494', '84aab6'],                         # 청동 녹(구리 지붕·방울)
}

def main():
    sys.path.insert(0, MODERN_LIB)
    import pal
    out = ['// 일본 세트 팔레트 — 바탕은 현대 칩셋 pal.RAMPS(현대 시트 자기 칸에서 뽑은 색), 그 뒤에 일본 거리 색.',
           '// 이 파일은 scripts/content/atlas-pick/make_jp_palette.py 가 만든다. 손으로 색을 더하지 마라(검사가 이 밖의 색을 불합격시킨다).',
           '// 격자: @mat 글자 램프 [기본단] → @mblock / @tblock X Y 램프 / @tadj. 0 = 가장 어두움.', '',
           '// ── 현대 칩셋 바탕(강남 조각과 같은 색) ──']
    for name, ramp in pal.RAMPS.items():
        out.append('@rampc m%-7s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// ── 일본 거리 색 ──']
    for name, ramp in JP.items():
        out.append('@rampc %-8s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// 반투명 그림자(빛은 왼쪽 위 → 그림자는 오른쪽 아래). 물체 발치·차 밑·처마 밑에만.',
            '~ #141218 110   // 그림자 속', '- #141218 58    // 그림자 번짐',
            '% #fff8d0 120   // 불빛 번짐(등롱·자판기·간판 빛이 바닥에 비친 자리)',
            '# #e040c0       // 실루엣 단계 표시색(최종본에 남으면 불합격)']
    os.makedirs(PAL_DIR, exist_ok=True)
    p = os.path.join(PAL_DIR, 'jp.pal'); atomic_write(p, '\n'.join(out) + '\n')
    print(p, len(pal.RAMPS), '현대 램프 +', len(JP), '일본 램프')

if __name__ == '__main__':
    main()
