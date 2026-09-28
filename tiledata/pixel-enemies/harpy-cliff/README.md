# 하피 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/harpy-cliff.py` + 공통 관절·검사 출력기 `pe_rig.py`(도형 도구는 `pe_lib.py`).
시트: `public/assets/generated/pixel-enemies/harpy-cliff.png`.
리소스: `generated-enemy-harpy-cliff` · motion `swoop`(치켜들었다 급강하) · 권장 idleFrameMs `120`. 등록은 런타임 에이전트가 `retroMonsterPlan.ts` 목록으로 일괄 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·둥근 끝 선·손으로 친 픽셀 격자를 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 쓰지 않았다. 아군 비교 그림(actor1-0)은 검토 보드에만 쓴다(출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 실제 사용 11색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기, 몸 중심 x≈24, 공중형: dead 만 바닥 y=44, 나머지 칸은 바닥 위에 뜬다.
- 광원 왼쪽 위(IK 팔다리의 왼쪽 위 면에 밝은 선, 오른쪽 아래 면에 어두운 선), 1px 외곽선. 고립 픽셀 0.
- 크기: idle_a 몸 24×34px, actor1-0 대기 칸 몸 23×24px 의 높이 1.42배.

보라 머리칼의 여인 얼굴, 톱니 모양 깃털 날개, 새 다리와 노란 발톱. 공중형: dead 만 바닥에 닿는다.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기는 a→b→c→b 로 1~2px 호흡. idle a·b·c 가 날갯짓 위·가운데·아래. 날개를 높이 치켜든 windup → 날개를 뒤로 접고 급강하하는 move → 발톱을 앞으로 뻗어 할퀴는 attack.
recover 는 공격을 거두는 중간 자세, hit 는 몸과 머리를 뒤로 젖히고 눈을 감는 칸, dead 는 따로 그린 쓰러진 윤곽.

칸별 경계(bbox): idle_a 24×34, idle_b 28×28, idle_c 31×28, windup 19×34, move 37×27, attack 33×32, recover 26×28, hit 21×31, dead 34×16. 가장 비슷한 두 칸도 379px 다르다(idle_a/windup).

## 재생성·직접 검토

```sh
python3 scripts/asset-gen/pixel-enemy/harpy-cliff.py
```

생성기가 검사해 한 줄로 출력하고, 어기면 exit 1: 시트 크기 cell×3 정사각, 알파 0/255, 색 수 ≤16, 빈 칸 없음, 칸끼리 모두 다름, 칸 밖 침범 없음, 바닥선(지상형은 move 외 전 칸 y=cell−4, 공중형은 dead 만), 고립 픽셀 0, PNG 재로드 일치, GIF 시간축 대조.
검토 산출물은 `.omo/pixel-enemy-harpy-cliff/`(세션 로컬, Git 제외):

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `scale.png`: actor1-0 의 (0,0) 48px 칸과 같은 4배율, 발 기준선 맞춤.
- `validation.json`: 색 수·칸별 경계·바닥·최소 칸 차이.

직접 `view_image`로 본 뒤 고친 기록(수정 전 미리보기는 `round0/`, `round1/`):
1. 선 몇 개로 된 날개를 톱니 가장자리가 있는 다각형 날개로 다시 짬. 공중에 뜨도록 전체를 올림.
2. 다리를 짧게 굽히고 날개를 키움. 떨어진 발톱 점(고립 픽셀)을 없애고 전 칸 고립 픽셀 0.
