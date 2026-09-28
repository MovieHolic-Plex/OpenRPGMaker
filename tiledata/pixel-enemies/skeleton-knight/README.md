# 해골 기사 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/skeleton-knight.py` + 공통 출력기 `pe_lib.py`, 검사기 `pe_review.py`.
시트: `public/assets/generated/pixel-enemies/skeleton-knight.png`.
리소스: `generated-enemy-skeleton-knight` · motion `stomp` · cell 48 · 권장 idleFrameMs `320`
(등록은 런타임 에이전트가 `src/assets/retroMonsterPlan.ts` 목록으로 일괄한다).

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·선·개별 픽셀을 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림은 기존 EasyRPG Actor1-0 유도 시트이며 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 알파 0/255, 16색 이하(실측은 `validation.json`).
- 오른쪽 보기, 몸 중심 x≈24, 공통 바닥 y=44.
- 화면은 원본의 정수 2배. 광원 왼쪽 위, 그림자는 오른쪽 아래에 면으로 묶고 선택적 외곽선을 쓴다.

녹슨 투구와 가슴판 아래 드러난 갈비, 먼 팔의 연 모양 방패, 가까운 팔의 장검.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기는 칼을 세워 들고 1px씩 가라앉는다. windup 칼을 머리 뒤로 높이 치켜들기 → move 반걸음 → attack 앞으로 몸을 실어 칼을 아래로 내려벤다(베기 궤적 두 줄). recover 칼끝이 바닥으로 처지고, hit 방패가 들리며 뒤로 젖힌다. dead 뼈·방패·투구·칼이 바닥에 흩어진다.
대기는 a→b→c→b.

## 재생성·직접 검토

```sh
cd scripts/asset-gen/pixel-enemy && python3 skeleton-knight.py
```

`pe_lib.build` 가 저장 후 재로드 일치·팔레트·알파·칸 밖 침범을 검사하고, `pe_review.review` 가
시트 크기(cell×3 정사각)·알파 0/255·색 수·빈 칸 없음·아홉 칸 서로 다름(최소 차이 픽셀 수)·바닥선을 다시 검사해 한 줄로 출력한다.
미리보기는 `.omo/pixel-enemy-skeleton-knight/`:

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `gif-keyframes.png`, `scale.png`(actor1-0 의 0,0 48px 칸과 같은 4배율, 발 기준선 맞춤), `validation.json`.

직접 `view_image`로 확인한 뒤 수정한 기록:
1. 대기 칼끝이 뒤쪽 위로 누워 있어 어색했다 → 칼을 거의 수직으로 세웠다. 투구 속 얼굴이 묻혀 눈구멍·코구멍을 키우고 두 칸 빛을 넣었다.
2. attack 칼끝이 셀 오른쪽 아래로 박혀 있어 앞으로 뻗은 느낌이 약했다 → 칼을 수평에 가깝게 앞으로 내고 베기 궤적을 위아래로 벌렸다.

수정 전 미리보기는 같은 폴더 `round0/`(·`round1/`)에 보존했다.
