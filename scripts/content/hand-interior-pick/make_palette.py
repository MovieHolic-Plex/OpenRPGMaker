#!/usr/bin/env python3
"""공통 팔레트 tiledata/hand-interior/pick/palette/v5.pal 을 v5 재료 램프(v5/mat.py 의 M)에서 뽑는다.
  python3 scripts/content/hand-interior-pick/make_palette.py
v5 램프는 v5 기물이 실제로 쓰는 색이다(어두운→밝은). 여기에 반투명 그림자 두 단과 실루엣 표시색을 더한다.
검사(check_candidate.py)가 받는 색 = 이 파일의 색 ∪ v5 기물 381개가 쓰는 모든 색."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *  # noqa

def main():
    os.chdir(ROOT); sys.path.insert(0, V5)
    from mat import M
    out = ['// v5 공통 팔레트 — v5/mat.py 재료 램프 그대로(0 = 가장 어두움). 격자에서는 @mat 글자 램프 / @tblock X Y 램프 로 쓴다.',
           '// 이 파일은 make_palette.py 가 만든다. 손으로 색을 더하지 마라(검사가 v5 밖 색을 불합격시킨다).', '']
    for name, ramp in M.items():
        out.append('@rampc %-7s ' % name + ' '.join('#%02x%02x%02x' % tuple(c[:3]) for c in ramp))
    out += ['', '// 반투명 그림자(방향 B 의 접지 그림자용. 발 칸 안에만, 오른쪽 아래로).',
            '~ #1c1418 110   // 그림자 속', '- #1c1418 58    // 그림자 번짐',
            '# #e040c0       // 실루엣 단계 표시색(최종본에 남으면 불합격)']
    os.makedirs(PAL_DIR, exist_ok=True)
    atomic_write(V5_PAL, '\n'.join(out) + '\n')
    print(V5_PAL, len(M), '램프')

if __name__ == '__main__':
    main()
