#!/usr/bin/env python3
"""Scarloxy People 뼈대 → Argon 부분 편집 드라이버(2026-10-16). argon_part 하네스를 재사용하되 베이스는 Scarloxy People1~2 의 10명이다.

  # 8318 CLIProxy 스트리밍(OPRN_LIVE_KEY 환경변수, 모델 gemini-4-argon-high)로 — 한 줄 재실행(10/21 이후 Agy 로도 가능: CHR_ARGON_BACKEND=agy):
  OPRN_LIVE_KEY="$(cat ~/.config/oprn/live-key)" CTFF6_PART_OUT=$HOME/spc-runs python3 src/harnesses/charset-actor/scarloxy_draw.py draw \
      --spec harness-data/charset-actor/scarloxy-people-spec.json --model gemini-4-argon-high --run sp-r1
  # 거르기·설치: install_scarloxy_people.py collect 가 아니라 scarloxy_collect.py(아래) 로 chip.chr.txt·edit.json·meta.json 을 scarloxy-people-chips/ 로 복사한 뒤
  # scarloxy-people-install.json 에 덧붙이기(칸 번호는 덧붙이기 전용) → install_scarloxy_people.py → scarloxy_sheet.py

의복·머리·소품(hip·back 장비)만 바꾼다. 얼굴·피부·손·몸 비율·걷기는 베이스 그대로(partedit 가 12프레임 전부 검증). 손에 든 소품(held)은 베이스 손 칸 정의가 없어 쓰지 않는다.
"""
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import argon_part as A  # noqa: E402

if os.environ.get('CHR_ARGON_BACKEND', 'http') == 'http':
    import argon_http  # noqa: E402
    A.run_agy = argon_http.run_argon_http


def prompt(spec, cand, pal, info, feedback, again):
    free = ' '.join(c for c in A.LETTERS if c not in pal)
    fb = ('\n[지난 시도에서 하네스가 거절한 이유 — 반드시 고쳐라]\n' + '\n'.join('- ' + e for e in feedback) + '\n') if feedback else ''
    redo = 'edit.json 이 이미 있다(네가 쓴 직전 시도). 그것을 고쳐 거절 사유만 해결해라.\n' if again else 'edit.json 이 아직 없다. 새로 쓴다.\n'
    return f'''{A.NO_GEN}

[과제] RPG Maker 2000 CharSet 규격(24×32) 걷기 칩 한 명을 **Scarloxy 몬스터 테이밍 팩 People 칩에서 의복·머리·소품만 고쳐서** 만든다. 몬스터를 모으는 모험 세계의 「{spec['name']}」 인물이다(일반 직업 이름, 원작 이름·상표 없음).
- 인물 설명: {spec['concept']}
- 이번 후보의 방향: {cand['variant']}
- 공통 규칙: {spec['common']}

현재 폴더의 파일: base_*_1.txt(베이스의 서 있는 그림 격자, 글자는 palette.json) · mask_*_1.txt(같은 칸의 부위 마스크) · @base_6x.png(베이스 12프레임 6배: 행=위·오른쪽·아래·왼쪽, 열=걸음 0·1·2) · @masks_4x.png(왼쪽 베이스·오른쪽 마스크 색: 주황 H, 하늘 F 고정, 파랑 T, 보라 B, 갈색 S, 어두운 노랑/남=구역) · @rtp_style_4x.png(참고: 다른 칩셋 그림. 이 작업의 화풍 기준은 **베이스 칩 자신**이다 — Scarloxy 칩은 머리가 크고 윤곽이 검정이 아니라 색 있는 짙은 선이다).
손에 든 소품(gear kind=held)은 쓰지 않는다. 허리(hip)·등(back) 장비와 recolor·paint 만 쓴다. 베이스의 크기·머리 비율·윤곽 톤을 그대로 지켜라 — 베이스보다 크게 부풀리지 마라.

{A.SCHEMA}

{A.RULES}

[변형 요령 — 실루엣이 바뀌어야 새 사람으로 읽힌다]
- 색만 바꾸지 마라. 모자·머리 모양·옷깃·앞치마·가방 같은 **윤곽이 달라지는 요소**를 h 구역(머리 위)·H paint·T paint·back/hip 장비로 만들어라. 단 베이스 모양의 55% 이상을 갈아엎지 마라.
- 정면(down)에서 직업 표식이 한눈에 읽히게 하고, 위(up)·옆(left/right)에서도 같은 사람(같은 팔레트 글자)으로 이어지게 한다. 오른쪽·왼쪽은 서로의 거울이 아니다.
- 소품은 24×32 칸에서 **실제 크기로 보이는 큰 덩어리**만 의미가 있다(1칸 점 장식은 보이지 않는다).

{A.STYLE}

사용 가능한 새 글자: {free}
{fb}
[작업 순서] {redo}답은 edit.json 내용 하나뿐이다.
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
