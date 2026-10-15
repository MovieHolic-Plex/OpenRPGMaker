# battle-trainer-sprites — 전투 트레이너 스프라이트 (생성형 이미지 → 128 부드러운 축소 → 사람이 고름)

포켓몬식 전투 화면의 **상대 트레이너 앞모습**과 **내 트레이너 뒷모습**을 만든다.
진단 정본 `~/claude-viz/poke-battle-diag.html` B4·C5(트레이너 그림 없음)의 후속이다.

## 결정 이력 (2026-10-15, 전부 사용자 지적으로 폐기·교체)
1. p1 — Argon 이 Actor1 을 보고 64×64 를 새로 그림. 폐기(Actor1 과 너무 다름).
2. p2 — Actor1 24×32 프레임을 Argon 이 국소 편집. 폐기(소스가 틀림: 전투 트레이너는 포켓몬/몬스터 수집 전용 그림이어야 한다).
3. p3 — 몬스터 수집 전용 전투 인물 64×64 를 Argon 이 격자로 국소 편집(색만 바꿈). 폐기(「너무 개판」).
5. **p5 비교 → p6~ = 현재 기본(사용자 선택 2026-10-15): 128×128 투명 캔버스·부드러운 고품질 축소·표시 1배.** 격자 도트화·양자화·색 수 제한 없음. 같은 생성 원본에서 `rerender p4 p6` 로 이서(이미지 서버 호출 없음, 옛 격자 검사에서 실패한 원본도 구제), 새 판은 `draw --mode gen128`(기본, 동시 2).
   규격: 몸 높이 112, 발 바닥 줄 126, 가운데 정렬, 알파 가장자리 유지. 거름: 원본 가장자리 닿음·몸이 원본 높이 40% 미만·가로 120 초과·마젠타 번짐 0.5% 초과. 렌더러는 PR #2638(가로 64|128 허용).
   번들 굽기(`bake`)는 `gen128` 판이면 size [128,128], footY 126 으로 index.json 에 기록한다. 사람이 고르기 전에는 굽지 않는다.
4. (이력) **p4 = 몬스터 종 하네스와 같은 경로: 생성형 이미지 → 격자 도트화 → 사람이 고름.** 편집·Argon 격자 모드는 이 용도의 기본 경로가 아니다.

p1·p2·p3 시트와 `qa-runs` 산출은 보존만 한다. `sheet`·`pick`·`bake` 는 gen 판이 아니면 거절한다. 편집 코드(`--mode chip`)는 남겨 두었지만 기본이 아니다.

## 방법
1. **참고 이미지** — 저장소 소유 몬스터 수집 전용 전투 인물(`harness-data/battle-trainer-sprites/source/*.png`, 64×64; 몬스터 수집 캠페인의 `oprn_emerald_trainer_*` 사본)을
   14배 확대해 마젠타 캔버스(1254×1254)에 2장 붙인다. 앞모습 판은 resident·student, 뒷모습 판은 hero_back(손의 볼은 지운 사본)·resident.
   「같은 그림체·같은 비율·새 인물」로 그리게 하며 샘플 복제·샘플 속 볼은 금지한다.
2. **생성** — 이미지 서버 god-tibo-imagen `POST /v1/generate/json`(`OPRN_HARNESS_IMAGE_URL`, 기본 `http://mdc-server:8091`).
   `monster-collect-species/node/imageSource.ts` 의 `generateImage` 를 그대로 import 한다(복사 없음). 502/503 이면 15초·30초… 백오프로 다시 시도하고, 판 단위 병렬은 낮게(`--par`) 둔다.
3. **도트화** — `monster-collect-species/pixel/pipeline.ts` 의 `pixelize`(격자 검출·칸별 최빈 색·정리) → 64×64 정리(`node/gen.ts`):
   원본 잉크 높이로 블록 크기를 추정해 근처 블록 4개를 다 도트화하고, 검사를 통과한 것 중 외톨이 점이 가장 적은 것을 쓴다(자동 탐색은 큰 블록을 골라 얼굴이 뭉개지기 쉬웠다).
   색은 20색 상한(16색으로 줄이면 머리 갈색이 윤곽색에 합쳐진다). 필요하면 정수·비정수 축소(`downscale`) 후 발 줄 62, 가운데 정렬.
4. **검사** — 캔버스 가장자리 닿음 금지, 그림 높이 36~58, 색 ≤20, 마젠타 잔점 0, 불투명 ≥12%. 윤곽·외톨이 점은 경고. 실패하면 새로 생성해 최대 3회.
5. **사람이 고른다** — 시트 `~/claude-viz/trainer-sprites-pick-<판>.html`(역할별 후보 A~E, 참고 샘플 옆에, 2×/4×/8× 도트 확대, 전투 480×320 합성 미리보기).

후보 A~E 는 같은 brief 에 변주 문구(머리·소품·실루엣)만 다르다. 던지기 프레임은 만들지 않는다(소스에도 없음). 뒷모습은 「오른팔을 들어 던지기 직전, 손에 아무것도 없음」으로 그리게 했다.

## 역할
`hero_m`·`hero_f`(뒷모습) + `hero_m_front`·`hero_f_front`(앞모습), `boy` `girl` `fisher` `hiker` `bug_catcher` `gym_rock` `gym_water` `scientist` `punk` `elder`(앞모습).
brief 는 `harness-data/battle-trainer-sprites/seed.json` 의 `gen.roles`. 원작 포켓몬 트레이너·캐릭터 닮은꼴 금지, 몬스터볼 모양 금지.

## 명령
```bash
npm run harness -- battle-trainer-sprites list
npm run harness -- battle-trainer-sprites draw hero_m,hero_f,boy,girl --n 5 --par 6 --plate p4 --background
npm run harness -- battle-trainer-sprites status [판]
npm run harness -- battle-trainer-sprites sheet p4     # ~/claude-viz/trainer-sprites-pick-4.html
npm run harness -- battle-trainer-sprites pick p4 hero_m=B boy=C ...   # 사용자가 고른 것만 기록(그림 해시에 묶임)
npm run harness -- battle-trainer-sprites bake p4      # 고른 기록이 있는 역할만 public/assets/battle-trainers/<역할>/ 에 굽는다
```

## 계약
- 64×64 투명 PNG, 발 바닥 줄 62. **object-gate 영수증 없음, 사람 선택 경로.** 사람 캐릭터라 3/4 윗면 규칙 대상이 아니다. 감독·에이전트는 고르지 않는다.
- `bake` 는 `picks.json`(`harness-data/battle-trainer-sprites/`)에 기록이 있고 현재 그림 해시가 일치할 때만 `public/assets/battle-trainers/<role>/{front|back}.png` 와 `index.json` 으로 굽는다. 고르기 전에는 번들·프로젝트에 아무것도 넣지 않는다.

## 데이터 계약 (전투 화면 쪽)
`public/assets/battle-trainers/index.json`: `{ trainers: { <role>: { role, label, view: "front"|"back", size:[64,64], footY: 62, front|back: "front.png"|"back.png" } } }`.
전투 CSS/DOM 연출은 전투 화면 담당이 맡는다. 이 하네스는 그림만 낸다.

## 출처·라이선스
`public/assets/ATTRIBUTION.md` 「Battle trainer sprites」. 생성형 이미지(독자 디자인) → 도트화이므로 저장소 소유 몬스터 수집 전용 그림이다. OPRN 게임 사용 라이선스(소재 단독 재배포 금지, `openwiki/licensing.md`).

## 파일
`src/harnesses/battle-trainer-sprites/{harness.py,harness.ts,node/cli.ts,node/gen.ts}` · 시드 `harness-data/battle-trainer-sprites/seed.json` · 샘플 `harness-data/battle-trainer-sprites/source/` ·
산출 `qa-runs/harnesses/battle-trainer-sprites/<판>/<역할>/<글자>/{prompt.txt,raw-N.png,sprite.png,meta.json}`.

## 선택 기록과 위임 (2026-10-15)

- 방식은 사용자가 pick-5 에서 「128 부드러움」으로 골랐다.
- 주인공 4역·소년·소녀(pick-6)는 사용자가 「전부 추천대로」로 감독에게 위임했다. `harness-data/battle-trainer-sprites/picks.json` 의 해당 항목에 `by: user-delegated-to-supervisor` 로 남긴다. 바꾸려면 `pick p6 <역=번호> --delegated user-delegated-to-supervisor` 를 다시 하면 되고, 번들에 굽기 전까지는 되돌리기 쉽다.
- 나머지 8역(pick-7 = p7)은 선택된 주인공 앞모습 두 장(남 E·여 A)을 참고 이미지로 붙여 같은 화풍으로 생성(`draw --ref-plate p6`). 시트의 ★ 는 감독 추천이며 최종 확정이 아니다.
