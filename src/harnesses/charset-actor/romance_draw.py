#!/usr/bin/env python3
"""현대 연애물 인물 칩 — argon_part 하네스 재사용 드라이버(의복·머리만, gear 없음).
  python3 romance_draw.py draw --spec ../../../harness-data/charset-actor/romance-modern.json --model gemini-4-argon-high --run r1 [--label ro-uni-boy-a]
  python3 romance_draw.py sheet r1 --spec ... --out ~/claude-viz/chips-modern-romance-1.html
저작 모델은 gemini-4-argon-high/medium 만(argon_part 의 허용 목록). 키는 읽지 않는다(agy 경로). 고르는 것은 사용자뿐, 설치 없음.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import romance_specs  # noqa: E402,F401
import argon_part as A  # noqa: E402

_orig_prompt = A.prompt


def prompt(spec, cand, pal, info, feedback, again):
    free = ' '.join(c for c in A.LETTERS if c not in pal)
    fb = ('\n[지난 시도에서 하네스가 거절한 이유 — 반드시 고쳐라]\n' + '\n'.join('- ' + e for e in feedback) + '\n') if feedback else ''
    redo = 'edit.json 이 이미 있다(네가 쓴 직전 시도). 그것을 고쳐 거절 사유만 해결해라.\n' if again else 'edit.json 이 아직 없다. 새로 쓴다.\n'
    return f'''{A.NO_GEN}

[과제] RPG Maker 2000 CharSet 규격(24×32) 걷기 칩 한 명을 **베이스 칩에서 의복·머리만 고쳐서** 만든다. 현대 연애 시뮬레이션(학교·카페·회사 배경)의 「{spec['name']}」 인물이다. 판타지 RPG 직업 표식이 아니라 **현대 일상복**으로 읽혀야 한다.
- 인물 설명: {spec['concept']}
- 이번 후보의 방향: {cand['variant']}
- 공통 규칙: {spec['common']}

현재 폴더: base_down_1.txt · base_up_1.txt · base_right_1.txt · base_left_1.txt (베이스의 서 있는 그림 격자, 글자는 palette.json), mask_*_1.txt (같은 칸의 부위 마스크), @base_6x.png(베이스 12프레임 6배: 행=위·오른쪽·아래·왼쪽, 열=걸음 0·1·2), @masks_4x.png(왼쪽 베이스·오른쪽 마스크 색: 주황 H, 하늘 F 고정, 파랑 T, 보라 B, 갈색 S, 어두운 노랑/남=구역), @rtp_style_4x.png(같은 칩셋의 다른 캐릭터들).
anchors.txt·anchors_6x.png 는 장비용이라 **이번에는 무시한다(gear 를 쓰지 않는다. edit.json 에 gear 키를 넣지 마라)**.
먼저 그림들을 직접 열어 베이스의 모양을 파악해라. **격자 전체를 새로 쓰지 않는다.** 아래 형식의 **edit.json** 한 파일만 쓴다.

{A.SCHEMA}

{A.RULES}

[현대 의복 만들기 요령]
- 대부분의 변화는 recolor 로 만들고(상의 색·하의 색·신발 색·머리색), 옷의 **모양 신호**(교복 칼라·넥타이/리본·셔츠 카라·앞치마·조끼·재킷 라펠·치마 주름·무릎 양말 등)는 T 부위 paint 로 서 있는 그림 네 방향에 짧게 올려라. 모든 모양 신호는 베이스의 상의 칸 안에서만 가능하다.
- 정면(down)에서는 목 밑 칼라/넥타이/단추 줄이 읽히게, 뒷면(up)은 칼라 라인과 같은 옷색이 이어지게, 옆면(left/right)은 같은 색 조합으로 앞섶 줄만 보이게 해라. 네 방향은 같은 사람(같은 팔레트 글자)이다.
- 머리는 색을 바꾸고(리컬러), 필요하면 앞머리/묶음 모양을 H 부위·구역 안에서 조금만 고친다(베이스 모양을 55% 이상 바꾸지 마라). 현대 인물의 머리색은 흑·갈·밤색 계열 위주(눈에 띄는 염색은 지시가 있을 때만).
- 판타지 요소(갑옷·망토·마법 장식·번쩍이는 금속 장식)를 넣지 마라. 맨손·맨얼굴은 베이스 그대로 둔다.

{A.STYLE}

사용 가능한 새 글자: {free}
{fb}
[작업 순서] {redo}edit.json 을 쓴 뒤 `python3 {HERE / 'romance_apply.py'} apply .` 를 실행하면 하네스와 같은 검증을 하고 preview.png(12프레임 6배)를 쓴다. 오류가 없을 때까지 고치고, preview.png 를 **직접 열어** 얼굴·옷 신호가 읽히는지·네 방향이 같은 사람인지·잡티·튀어나온 한 칸을 눈으로 확인한 뒤 끝내라. 끝나면 'done' 한 단어만 답하라.
'''


A.prompt = prompt
_orig_make = A.make_candidate


def make_candidate(spec, cand, key, run_dir, model):
    try:
        return _orig_make(spec, cand, key, run_dir, model)
    except Exception as e:  # noqa: BLE001 — 한 후보의 예외가 전체 실행을 죽이지 않게
        import traceback
        traceback.print_exc()
        return dict(key=key, ok=False, attempts=[dict(errors=[repr(e)])])


A.make_candidate = make_candidate

if __name__ == '__main__':
    A.main()
