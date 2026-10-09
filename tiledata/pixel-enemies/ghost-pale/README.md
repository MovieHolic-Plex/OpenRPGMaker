# 창백한 유령 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/ghost-pale.py` + 공통 출력기 `pe_lib.py`, 검사기 `pe_review.py`.
시트: `public/assets/generated/pixel-enemies/ghost-pale.png`.
리소스: `generated-enemy-ghost-pale` · motion `float` · cell 48 · 권장 idleFrameMs `200`
(등록은 런타임 에이전트가 `src/assets/retroMonsterPlan.ts` 목록으로 일괄한다).

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·선·개별 픽셀을 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림은 기존 EasyRPG Actor1-0 유도 시트이며 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 알파 0/255, 16색 이하(실측은 `validation.json`).
- 오른쪽 보기, 몸 중심 x≈24, 공통 바닥 y=44.
- 화면은 원본의 정수 2배. 광원 왼쪽 위, 그림자는 오른쪽 아래에 면으로 묶고 선택적 외곽선을 쓴다.

하얀 천을 뒤집어쓴 몸, 검게 뚫린 두 눈과 입, 바람에 뒤로 끌리는 해진 꼬리, 뼈 같은 세 손톱.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기 세 칸은 1px씩 떠오르며 꼬리가 흔들린다. windup 손을 머리 위로 치켜들고 입을 크게 벌림 → move 앞으로 스르르 → attack 팔을 앞 아래로 쭉 뻗어 할퀴기(청백 궤적 셋). hit 뒤로 밀리며 팔을 움츠린다. dead 천만 바닥에 납작하게 남고 한 줄기 연기가 오른다. 공중형이라 dead 만 바닥 y=44 에 닿는다.
대기는 a→b→c→b.

## 재생성·직접 검토

```sh
cd scripts/asset-gen/pixel-enemy && python3 ghost-pale.py
```

`pe_lib.build` 가 저장 후 재로드 일치·팔레트·알파·칸 밖 침범을 검사하고, `pe_review.review` 가
시트 크기(cell×3 정사각)·알파 0/255·색 수·빈 칸 없음·아홉 칸 서로 다름(최소 차이 픽셀 수)·바닥선을 다시 검사해 한 줄로 출력한다.
미리보기는 `.omo/pixel-enemy-ghost-pale/`:

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `gif-keyframes.png`, `scale.png`(actor1-0 의 0,0 48px 칸과 같은 4배율, 발 기준선 맞춤), `validation.json`.

직접 `view_image`로 확인한 뒤 수정한 기록:
1. 팔이 가늘어 천 소매로 안 읽혔다 → 두께 5px 소매와 윗면 밝은 줄, 끝의 해진 천 두 픽셀을 넣고 팔 시작점을 몸 가운데로 내렸다.
2. windup 손이 셀 위쪽에 닿을 만큼 올라가 몸과 떨어져 보였다 → 팔을 짧게 하고 손톱 방향을 위로 모았다.

수정 전 미리보기는 같은 폴더 `round0/`(·`round1/`)에 보존했다.
