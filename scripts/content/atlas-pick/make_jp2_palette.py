#!/usr/bin/env python3
"""일본 세트 「새 결(v2)」 팔레트 tiledata/atlas-pick/palette/jp2.pal 을 만든다.
  python3 scripts/content/atlas-pick/make_jp2_palette.py

jp.pal(강남 결 바탕 + 일본 색)은 건드리지 않는다. jp2 는 현대 칩셋 램프를 쓰지 않고 새로 정한 색만 담는다.
근거·규칙 = tiledata/atlas-pick/jp-style-v2.md. 요약: 저채도 보라회색 황혼 바탕 + 검정 아닌 어두운 보라 윤곽 +
채도 높은 색은 간판·자판기·신호 같은 작은 덩이에만. 램프는 어두운 → 밝은, 재료마다 4~8단.
검사(check_candidate.py)가 받는 색 = 이 파일의 색. 작업자는 이 파일에 색을 더하지 않는다."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

JP2 = {
    # ── 바탕(황혼 보라회색) ──
    'yoru':   ['26212f', '322c3d', '40394c', '504a5c', '625b6c', '776f7e'],                       # 아스팔트(차도)
    'hodo':   ['4e4860', '635c76', '78728a', '8e889e', 'a5a0b4', 'bcb8c8'],                       # 보도 블록(차도보다 한 단 밝게)
    'jari':   ['2e2a38', '403a4a', '544e5e', '6a6474', '827c8a'],                                 # 철도 자갈
    'makura': ['201a20', '382c30', '52403e', '6e5850'],                                           # 침목
    'sumi':   ['141020', '1e1830', '2c2440'],                                                     # 윤곽 전용(어두운 보라)
    # ── 벽·지붕 ──
    'usu':    ['4c4560', '655d7c', '80789a', '9c94b4', 'b6b0ca', 'd0cbde', 'e6e2f0'],             # 연보라 회색 벽(그늘 쪽은 더 차가운 보라)
    'conc':   ['3a3648', '4c485c', '605c72', '767288', '908ca2', 'aaa6bc'],                       # 옥상 콘크리트·계단실
    'kinari': ['5c5040', '84785c', 'aa9c78', 'ccc09a', 'e4dab8', 'f6f0d8'],                       # 옥상 가장자리 크림 띠·가드레일
    'renga':  ['2a1418', '46222a', '683440', '8a4a52', 'a66466', 'c08a86'],                       # 붉은 벽돌(이자카야·아파트)
    'momo':   ['5a3440', '7a4a58', '9a6470', 'b8808a', 'd4a4aa', 'e8c8cc'],                       # 분홍 벽돌 띠·발코니 벽
    'kon':    ['0e1024', '181c3c', '242c5c', '34427c', '4c62a0', '7c94c4'],                       # 남색(골함석 띠·발코니 어둠)
    'moku':   ['241612', '3c241a', '5a3626', '7c4e34', 'a06a44', 'c48c5c'],                       # 나무 격자(고시)·문
    'tekko':  ['262634', '3a3a4c', '52526a', '6e6e88', '8e8ea8', 'b0b0c8'],                       # 철골·급수탑·실외기·난간
    'shiro':  ['6c6684', '8e88a4', 'b2accc', 'd2cee2', 'ebe8f4', 'fbfafe'],                       # 흰 난간·흰 간판판·횡단보도
    # ── 창 ──
    'mado':   ['5c4c2c', '8c7440', 'bea45a', 'dcc880', 'f0e4a4', 'fbf4cc'],                       # 불 켜진 창(연노랑)
    'garasu': ['1a3444', '2a4e60', '3e7288', '5c9ab0', '86c0cc', 'b8e0e4'],                       # 청록 유리
    # ── 식물 ──
    'ki':     ['0a1616', '12281f', '1c4030', '2a5c3a', '3c7a44', '5a9a4c', '8cbc5c', 'bcd870'],   # 가로수(짙은 초록 몸통 + 연두 윗빛)
    # ── 간판·자판기·신호(채도 높은 덩이는 여기에만) ──
    'aka':    ['3c0c14', '6a1420', '98202c', 'c4303a', 'e05050', 'f08a80'],
    'sora':   ['0c3444', '146078', '1e8cac', '30b4d4', '66d4ec', 'b4f0f8'],
    'kii':    ['5c4400', '8c6a00', 'c49a08', 'ecc82c', 'f8e458', 'fcf4a0'],
    'midori': ['0c3020', '145a34', '1e8848', '34b060', '66d488', 'b0f0c0'],
    'pinku':  ['4a1038', '802060', 'b8348c', 'e058b4', 'f48cd0', 'fcc8ea'],
    'mura':   ['2a1448', '44246e', '643a98', '8a58c0', 'ac80dc', 'd0acf0'],
    'daidai': ['4c1c08', '7e360e', 'b8541a', 'e87828', 'f8a050', 'fcc888'],
    'lime':   ['1c3c08', '346a10', '5c9c1c', '8cc83c', 'b4e468', 'd8f4a0'],
}

def main():
    out = ['// 일본 세트 새 결(v2) 팔레트 — 저채도 보라회색 황혼 바탕 + 작은 덩이에만 채도 높은 간판색. 근거 tiledata/atlas-pick/jp-style-v2.md',
           '// 이 파일은 scripts/content/atlas-pick/make_jp2_palette.py 가 만든다. 손으로 색을 더하지 마라(검사가 이 밖의 색을 불합격시킨다).',
           '// 격자: @mat 글자 램프 [기본단] → @mblock / @tblock X Y 램프. 0 = 가장 어두움.', '']
    for name, ramp in JP2.items():
        out.append('@rampc %-8s ' % name + ' '.join('#' + h for h in ramp))
    out += ['', '// 반투명 그림자(빛은 왼쪽 위 → 그림자는 오른쪽 아래). 처마 밑·발치·노렌에만.',
            '~ #141218 110   // 그림자 속', '- #141218 58    // 그림자 번짐',
            '% #fff8d0 120   // 불빛 번짐(간판·자판기·창 빛이 바닥에 비친 자리)',
            '# #e040c0       // 실루엣 단계 표시색(최종본에 남으면 불합격)']
    os.makedirs(PAL_DIR, exist_ok=True)
    p = os.path.join(PAL_DIR, 'jp2.pal'); atomic_write(p, '\n'.join(out) + '\n')
    print(p, len(JP2), '램프')

if __name__ == '__main__':
    main()
