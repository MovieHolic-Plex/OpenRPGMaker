# 철 골렘 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/golem-iron.py` + 공통 출력기 `pe_lib.py`, 검사기 `pe_review.py`.
시트: `public/assets/generated/pixel-enemies/golem-iron.png`.
리소스: `generated-enemy-golem-iron` · motion `stomp` · cell 64 · 권장 idleFrameMs `320`
(등록은 런타임 에이전트가 `src/assets/retroMonsterPlan.ts` 목록으로 일괄한다).

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·선·개별 픽셀을 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림은 기존 EasyRPG Actor1-0 유도 시트이며 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 64×64, 3열×3행, 시트 192×192 RGBA, 알파 0/255, 16색 이하(실측은 `validation.json`).
- 오른쪽 보기, 몸 중심 x≈32, 공통 바닥 y=60.
- 화면은 원본의 정수 2배. 광원 왼쪽 위, 그림자는 오른쪽 아래에 면으로 묶고 선택적 외곽선을 쓴다.

리벳 박힌 철판을 쌓은 몸통, 원통 어깨, 가슴 한가운데 주황 코어, 투구 틈새의 빛나는 눈, 녹 줄, 네모 주먹.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기는 무겁게 1px씩 가라앉는다. windup 두 주먹을 머리 위로 치켜듦(코어·눈이 밝아짐) → move 한 걸음(다리 벌어짐) → attack 가까운 주먹을 앞 아래로 내려찍는다(충격선·바닥 줄). hit 뒤로 젖히며 코어가 꺼진다. dead 철판이 흩어지고 투구가 엎어진다.
대기는 a→b→c→b.

## 재생성·직접 검토

```sh
cd scripts/asset-gen/pixel-enemy && python3 golem-iron.py
```

`pe_lib.build` 가 저장 후 재로드 일치·팔레트·알파·칸 밖 침범을 검사하고, `pe_review.review` 가
시트 크기(cell×3 정사각)·알파 0/255·색 수·빈 칸 없음·아홉 칸 서로 다름(최소 차이 픽셀 수)·바닥선을 다시 검사해 한 줄로 출력한다.
미리보기는 `.omo/pixel-enemy-golem-iron/`:

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `gif-keyframes.png`, `scale.png`(actor1-0 의 0,0 48px 칸과 같은 4배율, 발 기준선 맞춤), `validation.json`.

직접 `view_image`로 확인한 뒤 수정한 기록:
1. windup 팔 좌표 순서 오류로 그리기가 멈췄다 → 위아래를 정렬해 그렸다. 가슴 코어가 어깨와 팔에 반쯤 가려졌다 → 가슴 가운데로 옮기고 녹 줄을 비켰다.
2. 키 54px로 아군의 2.3배였다 → 몸을 8px 낮추고 팔 길이를 줄여 키 46px(약 1.9배)로 맞췄다. 한 번 12px 낮췄다가 다리가 가려져 8px로 되돌렸다.

수정 전 미리보기는 같은 폴더 `round0/`(·`round1/`)에 보존했다.
