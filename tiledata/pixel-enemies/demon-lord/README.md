# 마왕 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/demon-lord.py` + 공통 관절·검사 출력기 `pe_rig.py`(도형 도구는 `pe_lib.py`).
시트: `public/assets/generated/pixel-enemies/demon-lord.png`.
리소스: `generated-enemy-demon-lord` · motion `breath`(제자리에서 뿜기) · 권장 idleFrameMs `280`. 등록은 런타임 에이전트가 `retroMonsterPlan.ts` 목록으로 일괄 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·둥근 끝 선·손으로 친 픽셀 격자를 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 쓰지 않았다. 아군 비교 그림(actor1-0)은 검토 보드에만 쓴다(출처: `assets/easyrpg/AUTHORS.md`).

- 셀 96×96, 3열×3행, 시트 288×288 RGBA, 실제 사용 14색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기, 몸 중심 x≈48, 공통 바닥 y=92(move 는 발을 드는 칸이라 바닥 위 허용).
- 광원 왼쪽 위(IK 팔다리의 왼쪽 위 면에 밝은 선, 오른쪽 아래 면에 어두운 선), 1px 외곽선. 고립 픽셀 0.
- 크기: idle_a 몸 50×81px, actor1-0 대기 칸 몸 23×24px 의 높이 3.38배.

최종 보스. 가시 왕관, 옆으로 말린 숫양 뿔, 창백한 보라 얼굴과 붉은 눈, 붉은 안감의 높은 깃 망토, 검은 판금 갑옷.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기는 a→b→c→b 로 1~2px 호흡. 갈퀴 손을 허리 뒤로 당겨 보라 암흑 구슬을 모으는 windup → 구슬이 커지며 망토가 펄럭이는 move(제자리) → 손을 앞으로 뻗어 보라 불꽃을 뿜는 attack.
recover 는 공격을 거두는 중간 자세, hit 는 몸과 머리를 뒤로 젖히고 눈을 감는 칸, dead 는 따로 그린 쓰러진 윤곽.

칸별 경계(bbox): idle_a 50×81, idle_b 52×80, idle_c 54×79, windup 55×80, move 59×81, attack 69×79, recover 51×80, hit 57×80, dead 81×27. 가장 비슷한 두 칸도 789px 다르다(idle_b/idle_c).

## 재생성·직접 검토

```sh
python3 scripts/asset-gen/pixel-enemy/demon-lord.py
```

생성기가 검사해 한 줄로 출력하고, 어기면 exit 1: 시트 크기 cell×3 정사각, 알파 0/255, 색 수 ≤16, 빈 칸 없음, 칸끼리 모두 다름, 칸 밖 침범 없음, 바닥선(지상형은 move 외 전 칸 y=cell−4, 공중형은 dead 만), 고립 픽셀 0, PNG 재로드 일치, GIF 시간축 대조.
검토 산출물은 `.omo/pixel-enemy-demon-lord/`(세션 로컬, Git 제외):

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `scale.png`: actor1-0 의 (0,0) 48px 칸과 같은 4배율, 발 기준선 맞춤.
- `validation.json`: 색 수·칸별 경계·바닥·최소 칸 차이.

직접 `view_image`로 본 뒤 고친 기록(수정 전 미리보기는 `round0/`, `round1/`):
1. 위로 솟아 칸을 넘던 뿔을 옆으로 말리게 줄이고, 기를 모으는 손을 몸 뒤로 옮겨 얼굴을 가리지 않게 함.
2. 앞쪽 망토 자락을 시도했다가 다리를 가려 되돌림. 대신 다리 뼈를 줄여 덜 웅크린 선 자세로. 불꽃 가장자리를 톱니 모양으로.
