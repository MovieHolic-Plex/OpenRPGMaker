# 부유하는 눈 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/eye-floating.py` + 공통 출력기 `pe_lib.py`, 검사기 `pe_review.py`.
시트: `public/assets/generated/pixel-enemies/eye-floating.png`.
리소스: `generated-enemy-eye-floating` · motion `shoot` · cell 48 · 권장 idleFrameMs `200`
(등록은 런타임 에이전트가 `src/assets/retroMonsterPlan.ts` 목록으로 일괄한다).

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·선·개별 픽셀을 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림은 기존 EasyRPG Actor1-0 유도 시트이며 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 알파 0/255, 16색 이하(실측은 `validation.json`).
- 오른쪽 보기, 몸 중심 x≈24, 공통 바닥 y=44.
- 화면은 원본의 정수 2배. 광원 왼쪽 위, 그림자는 오른쪽 아래에 면으로 묶고 선택적 외곽선을 쓴다.

핏줄 선 큰 눈알, 두꺼운 보라 윗눈꺼풀과 작은 혹 둘, 녹색 홍채, 아래로 늘어진 촉수 넷과 뒤로 끌리는 살 줄기.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기 세 칸은 떠오르며 촉수가 흔들린다. windup 눈을 가늘게 뜨고 촉수를 옆으로 펼치며 빛 알갱이를 모음 → move 동공이 앞으로 쏠리는 칸(제자리 쏘기형) → attack 동공에서 광선을 쏜다. hit 눈꺼풀이 감기고 동공에 X 핏줄. dead 바닥에 떨어져 눈꺼풀이 닫힌다.
대기는 a→b→c→b.

## 재생성·직접 검토

```sh
cd scripts/asset-gen/pixel-enemy && python3 eye-floating.py
```

`pe_lib.build` 가 저장 후 재로드 일치·팔레트·알파·칸 밖 침범을 검사하고, `pe_review.review` 가
시트 크기(cell×3 정사각)·알파 0/255·색 수·빈 칸 없음·아홉 칸 서로 다름(최소 차이 픽셀 수)·바닥선을 다시 검사해 한 줄로 출력한다.
미리보기는 `.omo/pixel-enemy-eye-floating/`:

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `gif-keyframes.png`, `scale.png`(actor1-0 의 0,0 48px 칸과 같은 4배율, 발 기준선 맞춤), `validation.json`.

직접 `view_image`로 확인한 뒤 수정한 기록:
1. 정면 공처럼 보여 어느 쪽을 보는지 약했다 → 뒤로 끌리는 살 줄기를 더하고 눈꺼풀을 뒤쪽이 두껍게 기울였다.
2. dead 촉수·몸이 바닥선 아래로 나가 좌표를 1px 올렸다.

수정 전 미리보기는 같은 폴더 `round0/`(·`round1/`)에 보존했다.
