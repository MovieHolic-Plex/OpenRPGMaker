# 살아있는 갑옷 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/armor-living.py` + 공통 출력기 `pe_lib.py`, 검사기 `pe_review.py`.
시트: `public/assets/generated/pixel-enemies/armor-living.png`.
리소스: `generated-enemy-armor-living` · motion `stomp` · cell 48 · 권장 idleFrameMs `300`
(등록은 런타임 에이전트가 `src/assets/retroMonsterPlan.ts` 목록으로 일괄한다).

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·선·개별 픽셀을 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림은 기존 EasyRPG Actor1-0 유도 시트이며 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 알파 0/255, 16색 이하(실측은 `validation.json`).
- 오른쪽 보기, 몸 중심 x≈24, 공통 바닥 y=44.
- 화면은 원본의 정수 2배. 광원 왼쪽 위, 그림자는 오른쪽 아래에 면으로 묶고 선택적 외곽선을 쓴다.

속이 빈 판금 갑옷. 투구 틈·목 틈·팔꿈치·가슴 균열에서 보랏빛이 새고, 두 손으로 큰 도끼를 든다. 보라 깃털 장식.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기는 도끼를 몸 앞에 세우고 1px씩 가라앉는다. windup 도끼를 머리 뒤로 크게 치켜듦 → move 반걸음 → attack 앞 아래로 도끼를 내려찍는다(궤적·바닥 줄). recover 도끼날이 바닥으로 처진다. hit 뒤로 젖히며 도끼가 뒤로 기운다. dead 빈 판금이 흩어지고 빛이 꺼진다.
대기는 a→b→c→b.

## 재생성·직접 검토

```sh
cd scripts/asset-gen/pixel-enemy && python3 armor-living.py
```

`pe_lib.build` 가 저장 후 재로드 일치·팔레트·알파·칸 밖 침범을 검사하고, `pe_review.review` 가
시트 크기(cell×3 정사각)·알파 0/255·색 수·빈 칸 없음·아홉 칸 서로 다름(최소 차이 픽셀 수)·바닥선을 다시 검사해 한 줄로 출력한다.
미리보기는 `.omo/pixel-enemy-armor-living/`:

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `gif-keyframes.png`, `scale.png`(actor1-0 의 0,0 48px 칸과 같은 4배율, 발 기준선 맞춤), `validation.json`.

직접 `view_image`로 확인한 뒤 수정한 기록:
1. 도끼가 몸 뒤에 있어 자루만 보였다 → 대기·이동에서 도끼를 몸 앞(오른쪽)에 세우고 가슴 균열의 보랏빛을 더했다.
2. hit 칸 도끼날이 얼굴을 가렸다 → 도끼를 몸 앞 낮은 쪽으로 옮겼다.

수정 전 미리보기는 같은 폴더 `round0/`(·`round1/`)에 보존했다.
