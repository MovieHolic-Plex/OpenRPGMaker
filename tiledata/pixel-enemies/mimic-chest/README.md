# 미믹 상자 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/mimic-chest.py` + 공통 출력기 `pe_lib.py`, 검사기 `pe_review.py`.
시트: `public/assets/generated/pixel-enemies/mimic-chest.png`.
리소스: `generated-enemy-mimic-chest` · motion `hop` · cell 48 · 권장 idleFrameMs `200`
(등록은 런타임 에이전트가 `src/assets/retroMonsterPlan.ts` 목록으로 일괄한다).

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·선·개별 픽셀을 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림은 기존 EasyRPG Actor1-0 유도 시트이며 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 알파 0/255, 16색 이하(실측은 `validation.json`).
- 오른쪽 보기, 몸 중심 x≈24, 공통 바닥 y=44.
- 화면은 원본의 정수 2배. 광원 왼쪽 위, 그림자는 오른쪽 아래에 면으로 묶고 선택적 외곽선을 쓴다.

금 띠를 두른 나무 보물상자. 뚜껑이 윗턱이 되어 벌어지고, 흰 이빨·분홍 혀, 자물쇠 판 안의 붉은 눈 하나.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기는 뚜껑이 1~2px 들썩인다. windup 뚜껑을 꽉 닫고 몸을 눌러 웅크림(눈이 가늘게 빛남) → move 입을 벌리고 공중으로 뛰어오름 → attack 입을 크게 벌려 앞으로 달려들며 문다(혀·충격선). hit 혀가 튀어나오고 눈이 감긴다. dead 뒤로 벌렁 넘어져 혀가 늘어진다. move·attack 은 도약 칸이라 바닥 위를 허용한다.
대기는 a→b→c→b.

## 재생성·직접 검토

```sh
cd scripts/asset-gen/pixel-enemy && python3 mimic-chest.py
```

`pe_lib.build` 가 저장 후 재로드 일치·팔레트·알파·칸 밖 침범을 검사하고, `pe_review.review` 가
시트 크기(cell×3 정사각)·알파 0/255·색 수·빈 칸 없음·아홉 칸 서로 다름(최소 차이 픽셀 수)·바닥선을 다시 검사해 한 줄로 출력한다.
미리보기는 `.omo/pixel-enemy-mimic-chest/`:

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `gif-keyframes.png`, `scale.png`(actor1-0 의 0,0 48px 칸과 같은 4배율, 발 기준선 맞춤), `validation.json`.

직접 `view_image`로 확인한 뒤 수정한 기록:
1. idle_b 가 입을 크게 벌려 대기 호흡이 튀었고, 좁은 입의 이빨이 흰 울타리처럼 빽빽했다 → 대기는 뚜껑만 1px 들썩이게, 이빨 간격을 3→4px로 넓혔다.
2. 공격 칸이 셀 오른쪽 끝을 넘어서 도약 높이와 몸 이동을 줄였다.

수정 전 미리보기는 같은 폴더 `round0/`(·`round1/`)에 보존했다.
