# battle-trainer-sprites — 전투 트레이너 스프라이트 (Actor1 변형)

포켓몬식 전투 화면의 **상대 트레이너 앞모습**, **내 트레이너 뒷모습**, 뒷모습의 **볼 던지기 3프레임**을 만든다.
진단 정본 `~/claude-viz/poke-battle-diag.html` B4·C5(트레이너 그림 없음)의 후속이다.

## 결정 (사용자, 2026-10-15)
「트레이너 그림은 Actor1 을 Agy 의 Gemini 4 Argon Medium 으로 변형해서 쓰는 게 베스트 퀄리티다.」
사람 그림 규칙(생성 말고 Actor1)을 지킨다. 출발점은 `public/assets/easyrpg/charset/Actor1.png` 의 정면/뒷면 가운데 걸음 프레임이다.

## 방법 (가능성 실험 2026-10-15)
| 경로 | 결과 |
|---|---|
| 1. agy+Argon 이 image-generator 서브에이전트로 이미지 직접 생성 | 됨(약 2분). 디테일은 좋으나 자세가 격투게임풍이고 생성 픽셀 → 격자 도트화 추가 필요. **쓰지 않는다**(생성 이미지 기피 규칙). |
| 2. Argon 이 Actor1 원본 격자·팔레트를 보고 64×64 행 문자열 격자를 직접 쓴다 | 됨(1회 2~9분). 3세대풍 정면 직립, Actor1 색·윤곽 유지. **채택.** |

하네스는 2번이다. 프롬프트가 이미지 생성 도구·합성 코드를 금지하고, 일꾼은 `grid.txt`(64줄×64글자)와 `palette.json` 을 쓴다.
다른 모델로 몰래 대체하지 않는다(`TRAINER_HARNESS_MODEL` 환경변수는 모델 변경 시험용이며 기록에 남는다).

## 명령
```bash
npm run harness -- battle-trainer-sprites list
npm run harness -- battle-trainer-sprites draw all --n 5 --par 8 --plate p1 --background   # 12역할 × 5안 (+뒷모습 던지기 3장)
npm run harness -- battle-trainer-sprites status [p1]
npm run harness -- battle-trainer-sprites sheet p1     # ~/claude-viz/trainer-sprites-pick-1.html
npm run harness -- battle-trainer-sprites pick p1 hero_m=B boy=C ...   # 사용자가 고른 것만 기록
npm run harness -- battle-trainer-sprites bake p1      # 고른 기록이 있는 역할만 굽는다
```

## 계약
- 캔버스 64×64 투명, 발 바닥 줄 y=62. 하네스가 평행이동으로 발 위치·가운데를 맞추고 이동량을 `meta.json` 에 기록한다.
- 기계 검사(`check_and_normalize`): 그림 높이 36~60, 너비 ≤60, 색 ≤18, 불투명 비율 ≥12%, 가장 큰 덩어리 ≥70%, 가장자리 접촉·윤곽 어두움은 경고. 실패 시 같은 일꾼이 사유와 함께 최대 3회 다시 쓴다(시도 기록 `attempts`).
- 던지기: 뒷모습 통과 후보마다 `throw_1~3.txt`(3프레임) → `throw.png`(192×64 가로 스트립). 공은 엔진이 그린다.
- **object-gate 영수증 없음, 사람 선택 경로.** 사람 캐릭터라 3/4 윗면 규칙 대상이 아니다. 감독·에이전트는 고르지 않는다. 사용자가 시트에서 고른다.
- `bake` 는 `picks.json`(`harness-data/battle-trainer-sprites/`)에 기록이 있고 현재 그림 해시가 일치할 때만 `public/assets/battle-trainers/<role>/{front|back,throw}.png` 와 `index.json` 으로 굽는다. 고르기 전에는 번들·프로젝트에 아무것도 넣지 않는다.

## 데이터 계약 (전투 화면 쪽)
`public/assets/battle-trainers/index.json`: `{ trainers: { <role>: { role, label, view: "front"|"back", size:[64,64], footY: 62, front|back: "front.png"|"back.png", throw?: { file, frames: 3, frameSize:[64,64] } } } }`.
role: `hero_m hero_f`(뒷모습) · `boy girl fisher hiker bug_catcher gym_rock gym_water scientist punk elder`(앞모습). 전투 데이터의 `trainerSprite` 는 이 role 문자열.
전투 CSS/DOM 연출은 전투 화면 담당(poke-battle-1)이 맡는다. 이 하네스는 그림만 낸다.

## 출처·라이선스
Actor1.png = EasyRPG RTP, CC BY 4.0, Marina Navarro Travesset(base) / VictorSena(edit)(`public/assets/easyrpg/AUTHORS.md`). 변형물에도 같은 CC BY 4.0 표기를 `public/assets/ATTRIBUTION.md` 에 남긴다.
OPRN 게임 사용 라이선스와 모순 없음: 번들 자산은 게임 안에서 자유, 소재 단독 재배포 금지(`openwiki/licensing.md`).

## 파일
`src/harnesses/battle-trainer-sprites/{harness.py,harness.ts,node/cli.ts}` · 시드 `harness-data/battle-trainer-sprites/seed.json` · 산출 `qa-runs/harnesses/battle-trainer-sprites/<판>/<역할>/<글자>/` · 실험 `…/exp/`.
