# 고블린 정찰병 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/goblin-scout.py` + 공통 관절·검사 출력기 `pe_rig.py`(도형 도구는 `pe_lib.py`).
시트: `public/assets/generated/pixel-enemies/goblin-scout.png`.
리소스: `generated-enemy-goblin-scout` · motion `dash`(낮게 달려들기) · 권장 idleFrameMs `160`. 등록은 런타임 에이전트가 `retroMonsterPlan.ts` 목록으로 일괄 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·둥근 끝 선·손으로 친 픽셀 격자를 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 쓰지 않았다. 아군 비교 그림(actor1-0)은 검토 보드에만 쓴다(출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 실제 사용 12색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기, 몸 중심 x≈24, 공통 바닥 y=44(move 는 발을 드는 칸이라 바닥 위 허용).
- 광원 왼쪽 위(IK 팔다리의 왼쪽 위 면에 밝은 선, 오른쪽 아래 면에 어두운 선), 1px 외곽선. 고립 픽셀 0.
- 크기: idle_a 몸 24×28px, actor1-0 대기 칸 몸 23×24px 의 높이 1.17배.

초록 피부·긴 귀·매부리코에 가죽 조끼와 짧은 단검. 두 관절 IK 팔다리(pe_rig.ik)로 칸마다 관절을 다시 계산했다.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기는 a→b→c→b 로 1~2px 호흡. 낮게 웅크린 windup(단검을 뒤로 젖힘) → 땅을 박차는 move(몸이 앞, 뒷발이 뒤로 뻗음) → 팔을 끝까지 내뻗은 찌르기 attack.
recover 는 공격을 거두는 중간 자세, hit 는 몸과 머리를 뒤로 젖히고 눈을 감는 칸, dead 는 따로 그린 쓰러진 윤곽.

칸별 경계(bbox): idle_a 24×28, idle_b 24×27, idle_c 23×26, windup 28×25, move 30×24, attack 34×25, recover 23×27, hit 23×26, dead 41×10. 가장 비슷한 두 칸도 141px 다르다(idle_b/idle_c).

## 재생성·직접 검토

```sh
python3 scripts/asset-gen/pixel-enemy/goblin-scout.py
```

생성기가 검사해 한 줄로 출력하고, 어기면 exit 1: 시트 크기 cell×3 정사각, 알파 0/255, 색 수 ≤16, 빈 칸 없음, 칸끼리 모두 다름, 칸 밖 침범 없음, 바닥선(지상형은 move 외 전 칸 y=cell−4, 공중형은 dead 만), 고립 픽셀 0, PNG 재로드 일치, GIF 시간축 대조.
검토 산출물은 `.omo/pixel-enemy-goblin-scout/`(세션 로컬, Git 제외):

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `scale.png`: actor1-0 의 (0,0) 48px 칸과 같은 4배율, 발 기준선 맞춤.
- `validation.json`: 색 수·칸별 경계·바닥·최소 칸 차이.

직접 `view_image`로 본 뒤 고친 기록(수정 전 미리보기는 `round0/`, `round1/`):
1. 발을 IK 끝점에 그리던 것을 바닥선(y44) 기준 신발로 바꿔 모든 칸이 같은 바닥에 서게 함. 쓰러진 칸 머리 위치 수정.
2. 평면이던 조끼를 배가 드러난 열린 조끼로, 쓰러진 칸의 떠 있던 팔을 바닥에 붙임.
