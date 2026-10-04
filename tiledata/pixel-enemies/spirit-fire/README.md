# 불의 정령 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/spirit-fire.py` + 공통 출력기 `pe_lib.py`, 검사기 `pe_review.py`.
시트: `public/assets/generated/pixel-enemies/spirit-fire.png`.
리소스: `generated-enemy-spirit-fire` · motion `float` · cell 48 · 권장 idleFrameMs `160`
(등록은 런타임 에이전트가 `src/assets/retroMonsterPlan.ts` 목록으로 일괄한다).

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·선·개별 픽셀을 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림은 기존 EasyRPG Actor1-0 유도 시트이며 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 알파 0/255, 16색 이하(실측은 `validation.json`).
- 오른쪽 보기, 몸 중심 x≈24, 공통 바닥 y=44.
- 화면은 원본의 정수 2배. 광원 왼쪽 위, 그림자는 오른쪽 아래에 면으로 묶고 선택적 외곽선을 쓴다.

불꽃 사람 모양. 흰빛 심장, 뒤로 흩날리는 붉은 불꽃 머리칼과 정수리 불꽃 셋, 다리 대신 흔들리는 불꽃 꼬리.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기 세 칸은 떠오르며 머리칼과 꼬리 모양이 바뀐다. windup 두 손을 머리 위로 들어 불꽃을 키움 → move 앞으로 흘러가며 팔을 뻗음 → attack 팔을 앞으로 내질러 불덩이를 뿜는다. hit 뒤로 밀리며 두 팔을 벌리고 눈을 찡그린다. dead 바닥의 잉걸불과 연기 한 줄.
대기는 a→b→c→b.

## 재생성·직접 검토

```sh
cd scripts/asset-gen/pixel-enemy && python3 spirit-fire.py
```

`pe_lib.build` 가 저장 후 재로드 일치·팔레트·알파·칸 밖 침범을 검사하고, `pe_review.review` 가
시트 크기(cell×3 정사각)·알파 0/255·색 수·빈 칸 없음·아홉 칸 서로 다름(최소 차이 픽셀 수)·바닥선을 다시 검사해 한 줄로 출력한다.
미리보기는 `.omo/pixel-enemy-spirit-fire/`:

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `gif-keyframes.png`, `scale.png`(actor1-0 의 0,0 48px 칸과 같은 4배율, 발 기준선 맞춤), `validation.json`.

직접 `view_image`로 확인한 뒤 수정한 기록:
1. attack 두 팔이 한 막대로 뭉쳤고 머리가 불꽃으로 안 읽혔다 → 두 팔 높이를 나누고, 정수리 불꽃과 몸 옆 불꽃 가시를 더했다.
2. 정수리 불꽃 두 개가 고양이 귀처럼 보였다 → 뒤로 휘는 비대칭 불꽃 셋으로 바꾸고 안쪽에 밝은 심을 넣었다.

수정 전 미리보기는 같은 폴더 `round0/`(·`round1/`)에 보존했다.
