# 몬스터 수집 종 스프라이트 하네스 (`monster-collect-species`)

몬스터 수집(포켓몬류) 장르 **전용**. 도감 시드의 종마다 상대 앞모습·내 몬스터 뒷모습 전투 스프라이트와
대기·공격·피격 애니메이션 스트립을 만든다.
JRPG 일반 적 그림은 여기서 만들지 않는다(`src/editor/aiDatabaseGeneration.ts` 의 자료집 그림 생성 경로).
구조 규칙은 [README](README.md), 목록은 `src/harnesses/INDEX.md`.

## 빠른 시작

```bash
npm run harness -- monster-collect-species status                       # 시드의 종별 진행
npm run harness -- monster-collect-species front --species sparkit --n 6 # 앞모습 후보 6장 → sheet.html
npm run harness -- monster-collect-species pick --species sparkit --side front --run <run> --candidate 2
npm run harness -- monster-collect-species back --species sparkit --n 3  # 고른 앞모습으로 뒷모습 후보
npm run harness -- monster-collect-species pick --species sparkit --side back --run <run> --candidate 1
npm run harness -- monster-collect-species build                        # 번들 굽기(스프라이트 + 대기 스트립) + 검사
npm run harness -- monster-collect-species action --species sparkit --side front --action attack --n 2  # 큰 동작 한 줄 후보
npm run harness -- monster-collect-species pick --species sparkit --side front --action attack --run <run> --candidate 1
npm run harness -- monster-collect-species build                        # 동작 스트립 + anim.json
npm run harness -- monster-collect-species preview                      # 대기·동작 재생 HTML
```

- 후보 비교 시트는 `qa-runs/harnesses/monster-collect-species/<종>/<front|back>/<run>/sheet.html`. **고르는 건 사람이다.**
  에이전트는 시트를 사용자에게 보여 주고(claude-viz 등) 번호를 받는다. 직접 고르지 않는다.
- 새 종은 `harness-data/monster-collect-species/seed.json` 에 먼저 적는다. 진화형은 `evolvesFrom` 을 적으면 앞 단계 앞모습을 참고로 그린다(앞 단계를 먼저 골라야 한다).
- **시험 실행은 모래상자에서**: `MONSTER_HARNESS_SANDBOX=<폴더>` 를 주면 시드(`<폴더>/data/seed.json`)·기록·격자·번들·산출물이 전부 그 폴더 아래로 간다. 커밋된 `seed.json`·`ledger.json`·번들을 건드리지 않는다. 에이전트가 시험 삼아 고르는 건 여기서만 한다.
- 이미지 서버: god-tibo-imagen `POST /v1/generate/json`, 주소 `OPRN_HARNESS_IMAGE_URL`(기본 `http://mdc-server:8091`). 502 `MISSING_IMAGE_GENERATION_OUTPUT` 이 흔해 한 번 재시도한다.

## 파일

| 경로 | 무엇 |
|---|---|
| `src/harnesses/monster-collect-species/harness.ts` | 매니페스트 (범위 `monster-collect`) |
| `src/harnesses/monster-collect-species/pixel/grid.ts` | 생성 그림 속 픽셀 격자 찾기 → 칸 최빈 색 |
| `src/harnesses/monster-collect-species/pixel/tidy.ts` | 마젠타 번짐·작은 섬 제거, 20색 합치기, 외톨이 점 흡수 |
| `src/harnesses/monster-collect-species/pixel/downscale.ts` · `src/harnesses/monster-collect-species/pixel/fit.ts` | 정수/비정수 최빈 축소(선 우선) → 112 캔버스 바닥 정렬 |
| `src/harnesses/monster-collect-species/pixel/pipeline.ts` | `pixelize` · `toSprite` · `cleanReference` (브라우저·노드 공용 입구) |
| `src/harnesses/monster-collect-species/prompts/prompts.ts` | 앞모습·뒷모습·진화형 프롬프트 |
| `src/harnesses/monster-collect-species/checks/checks.ts` | 자동 검사 |
| `src/harnesses/monster-collect-species/qa/battle-layout.css` | 전투 배치 시안 (엔진 미반영) |
| `src/harnesses/monster-collect-species/node/cli.ts` | CLI 단계 |
| `src/harnesses/monster-collect-species/anim/idle.ts` | 대기: 고른 스프라이트를 정수 픽셀로 움직이는 4프레임 (생성 없음) |
| `src/harnesses/monster-collect-species/anim/row.ts` | 큰 동작: 한 줄 참고 그림, 줄 → 프레임 나누기, 같은 배율·발 맞춤, 스트립 |
| `harness-data/monster-collect-species/seed.json` | 사람이 쓰는 도감 기획 + 화풍 계약 + 애니메이션 계약(`animation`) |
| `harness-data/monster-collect-species/ledger.json` | 하네스가 쓰는 선택 기록 (원본 sha256·프롬프트·블록 크기) |
| `harness-data/monster-collect-species/grids/<종>-<면>.png` | 고른 후보의 격자 도트(칸 하나 = 픽셀 하나). `build` 의 입력 |
| `public/assets/harnesses/monster-collect-species/<종>/<front\|back>.png` | 번들 스프라이트 (112×112) |
| `harness-data/monster-collect-species/grids/<종>-<면>-<동작>.png` | 고른 동작 줄의 격자 도트 (N 프레임이 한 장). `build` 의 입력 |
| `public/assets/harnesses/monster-collect-species/<종>/anim/<면>-<상태>.png` · `anim.json` | 가로 스트립(112×N, `src/assets/battlerIdleAnimations.ts` image-strip 과 같은 모양) + 프레임 수·간격·반복·출처 |

## 왜 이렇게 만드는가 (2026-10-01 실험, `qa-runs/hand-monster/` 시안)

- **손 도트(64·48px)와 「생성 → BOX 축소」(v9) 는 사용자에게 거절됐다**(「허접」, 「못 봐주겠다」). v9 의 잘게 갈라진 색 조각은 그림 탓이 아니라 축소 탓이었다: 생성기는 도트풍을 8~27px 가짜 픽셀 블록으로 그리는데, BOX 축소가 블록 경계와 어긋나 이웃 색을 섞는다. 격자를 찾아 칸마다 최빈 색을 고르면 생성기가 고른 도트가 그대로 남는다.
- **블록 크기 추정**: 색 경계 봉우리 간격이 크기 p 의 정수배에 가까운지 센다(배수 k 가중 1/k). 반올림한 몫에 투표하면 13·14px 간격이 반 크기 7 에 몰려 칸을 둘로 쪼갠다.
- **프롬프트**: 예전 자료집 프롬프트(「front view facing the viewer, white background」)가 정면 마스코트를 만들었다. 포켓몬 BW 상대 스프라이트풍, 왼쪽 3/4, 마스코트·치비·볼터치 금지, 생물 해부, 마젠타 단색 캔버스를 참고 이미지로. 검정 배경·불꽃 후광이 붙으면 배경 제거가 안 된다.
- **뒷모습**: 생성 원본이 아니라 깨끗한 도트를 정수배로 키워 마젠타에 놓은 것을 참고로 넣는다. 원본을 넣으면 어두운 후광이 따라왔다. 네 발 종은 뒷모습도 네 발이어야 한다(두 발로 선 후보가 섞여 나온다 — 사람이 거른다).
- **공식 몬스터 닮은꼴**: 이상해씨·파이리를 그대로 닮은 후보가 나왔다. 프롬프트 `avoid` 로 줄이고, 최종 판정은 사람.
- **크기**: 몸집 = 잉크 상자 넓이의 제곱근. 앞 80·뒤 88 목표 × 진화 단계 배율(1·1.12·1.25), 긴 변 108 이하, 정수배에 0.15 안이면 정수 축소. 긴 변으로만 맞추면 납작한 도롱뇽이 작아 보였다. 단계 배율이 없으면 진화형이 1단계와 같은 크기로 나왔다(2026-10-01 시험). 큰 원본은 긴 변 상한에 먼저 걸려 2·3단계 크기가 같아질 수 있다 — 캔버스를 키우기 전엔 남는 한계.

## 애니메이션 — 대기는 움직이고, 큰 동작은 한 줄로 생성한다 (2026-10-01 비교 시험)

대기 4프레임을 네 방식으로 만들어 비교했다(`qa-runs/anim-lab/`, 연속 프레임 사이 바뀐 칸 비율):
고른 도트를 정수 픽셀만 움직임 **14%** · 프레임마다 따로 생성 98% · 2×2 한 장 생성 89% ·
[sprite-gen](https://github.com/aldegad/sprite-gen)(Apache-2.0) 방식 가로 한 줄 생성 58%. 사용자가 「대기는 A, 큰 동작은 sprite-gen 방식」으로 정했다.

- **대기(`anim/idle.ts`)**: 생성하지 않는다. 윗몸(잉크 높이 위 58%)을 1px 내렸다 올리고, 꼬리 띠(앞모습 오른쪽·뒷모습 왼쪽 28%)를 1px 흔들고,
  `motion.flicker: "flame"` 종은 따뜻하고 밝은 색 덩어리 상자 절반을 번갈아 1px 들어 올린다. 0번 = 원본, 발 줄 고정. 대기를 생성하면 1px 숨쉬기보다 그림 흔들림이 크다.
- **큰 동작(`anim/row.ts`)**: 시드 `animation.actions` 의 동작마다 N 프레임을 **한 장에 가로로** 생성한다. 따로 생성하면 매번 다른 생물이 된다.
  - god-tibo 는 참고 그림을 한 장만 받는다 → 칸 안내 첫 칸에 기준 스프라이트를 넣은 한 장으로 합친다. sprite-gen 기본 화풍 문구(치비·마스코트 친화)는 쓰지 않는다.
  - 참고 그림은 **2172×724(3:1)**. 1536×1024 에 네 칸이면 기준을 3배로밖에 못 넣어 생성 블록이 3px 가 되고 격자 추출이 무너졌다(흰 줄·윤곽 소실).
  - 블록 크기는 짐작해서 고른다: 첫 포즈 폭(px) ÷ 기준 잉크 폭(칸), ±30%(`rowBlockHint`). 짐작 없이 고르면 12장 중 5장이 2배 블록을 골라 몸집이 반이 됐다.
  - 줄 전체를 한 번에 도트화(격자·팔레트 공유) → 큰 성분 N 개를 씨앗으로 묶기 → 0번 잉크 폭을 기준 스프라이트 폭에 맞춘 배율을 N 장에 똑같이 → 발 위치를 0번에 맞춰 바닥 정렬.
  - 포즈가 겹친 후보는 「큰 덩어리가 N 개가 아니다」로 떨어진다. 후보 시트는 CSS 로 스트립을 재생한다. 고르는 건 사람.
- 엔진 배선은 아직 없다 — 스트립과 `anim.json` 만 번들에 있다. 공격 모션(돌진·넉백·히트스톱)은 엔진이 이미 하므로, 붙일 땐 그 위에 프레임만 바꾼다.

### 공격 방향 계약 (`animation.direction`)

| 면 | 화면 자리 | 공격 방향 (x 오른쪽+, y 아래+) | 피격 밀림 |
|---|---|---|---|
| back (내 몬스터) | 왼쪽 아래 | (+1, −1) 오른쪽 위 | 왼쪽 아래 |
| front (상대) | 오른쪽 위 | (−1, +1) 왼쪽 아래 | 오른쪽 위 |

- 프롬프트가 이 값으로 「상대는 그림의 오른쪽 위에 있다, 그쪽으로만 기운다」 문장을 만든다. 그림은 제자리에서 **기울기만** 하고, 실제 이동은 엔진이 같은 방향으로 한다.
- 엔진: `src/styles/runtime/battle/05-poses-motion.css` 포켓몬 스킨 돌진·넉백을 이 방향으로 고쳤다. 예전엔 옆 구도 부호(내 쪽 −x, 상대 +x)를 그대로 써서 돌진이 상대에게서 **멀어졌다**(2026-10-01 녹화 실측: 공격 순간 내 몬스터 x 257→156).
- 방향 검사(`checkDirection`): 공격 자세는 어느 프레임이든 윗몸 가로 무게중심이 0번보다 공격 방향으로 2칸 이상, 피격은 반대로 2칸 이상 옮겨 가야 한다(경고). 발은 0번에 맞춰 두므로 기울기는 윗몸에서 드러난다.

### 스킬별 공격 = 자세 몇 가지 × 스킬 매핑 (`anim/poses.ts`)

스킬마다 그림을 만들지 않는다. 속성 그림(불꽃·물줄기·잎)은 스킬의 전투 효과 애니메이션(`animationId`)이 그리고, 몬스터 그림은 몸의 자세만 맡는다.

| 자세 (`animation.actions`) | kind | 쓰는 스킬 (`poseForSkill` 기본 규칙) |
|---|---|---|
| `tackle` 웅크렸다 덤빔 | attack | 속성 없는 맞닿는 공격 (공격·몸통박치기·물기) |
| `special` 버티고 입을 벌려 내뿜는 자세 (효과 없이) | attack | 속성이 붙은 공격 (화염·물대포·잎날) |
| `buff` 부풀리고 울부짖음 | self | 자기·아군 대상 |
| `hurt` 움찔 밀림 | hurt | 맞을 때 (스킬 무관) |

스킬에 `battlePose` 가 있으면 규칙보다 우선한다(스킬 스키마에는 아직 없다 — 엔진 배선 때 추가). 종 고유기는 시드에 그 종 전용 자세를 더하는 식으로 늘린다(아직 없음).

## 검사 (`build` · `check`)

| 항목 | 기준 | 수준 |
|---|---|---|
| 캔버스 | 112×112, 바닥 정렬 | 오류 |
| 색 수 | `style.maxColors`(20) 이하 | 오류 |
| 마젠타 기운 점 | 0 | 오류 |
| 윤곽 | 실루엣 가장자리 칸의 85% 이상이 어두운 선 | 경고 |
| 외톨이 점 | 12% 이하 | 경고 |
| 몸집 | √(w·h) ≥ 55 | 경고 |
| 앞·뒤 색 일치 | 뒷모습 색의 앞 팔레트 평균 최근접 거리 ≤ 0.06 | 경고 |
| 대기 프레임 | 0번 = 스프라이트, 발(잉크 맨 아래 줄) 고정, 색 수·마젠타 | 오류 |
| 동작 프레임 | 캔버스·색 수·마젠타 | 오류 |
| 동작 크기·색 | 0번 몸집 ≥ 기준의 85%, 프레임마다 기준 팔레트 거리 ≤ 0.06, 캔버스 밖 잘림 0 | 경고 |

닮은꼴·자세·앞뒤가 같은 생물로 보이는지는 **사람 눈**이다. 실제 전투 화면 캡처로 본다.

## 전투 배치 (`src/harnesses/monster-collect-species/qa/battle-layout.css`, 엔진 미반영)

포켓몬 스킨에서 112 캔버스를 내 몬스터 3배(화면 336)·상대 2배(화면 224) 정수 배율로 그리고, 발판을 같은 배율로 줄이고, 발을 발판 중심에 두고,
상대 숨쉬기 찌그러짐(`battler-breathe`)을 끈다. 2026-10-01 실제 플레이어 화면에 주입해 확인했다(명령 선택 화면만 — 공격·피격·기절·포획 모션은 미확인).
엔진 반영 대상은 `src/styles/runtime/battle/20-pokemon-skin.css`. 주입 캡처는 시안 녹화기(qa-runs/monster-viz/record.mjs, gitignore — `INJECT_CSS`·`OVERRIDES` 환경 변수)로 했다 — 하네스 `qa/` 로 옮기는 건 다음 작업.

## 시험

- 단위 시험: `test/harnesses/monsterCollectSpecies.test.ts` — 가짜 생성 그림(격자 흔들림·경계 번짐·잡음, 마젠타/검정 배경)에서 원래 도트 복원, 실제 실패 그림의 경계 간격 고정 자료(`test/fixtures/harnesses/leafling-back-block-gaps.json`, 예전 반올림 투표는 같은 자료에서 반 크기를 고른다는 것까지 단언), 색 합치기·마젠타 정리·선 우선 축소·몸집·단계 배율·112 캔버스, 검사, 시드 검증, 장르 범위, INDEX 일치, 커밋된 번들 검사, 모래상자 CLI(import→pick→build→check, 커밋 기록 불변).
- 애니메이션 시험(같은 파일 「애니메이션」 묶음): 대기 0번=원본·발 고정·변화량, 대기 검사가 0번 변경·발 이동을 잡는지, 한 줄 참고 그림 크기·첫 칸, 생성 그림 흉내 줄 → 4프레임·같은 폭·바닥 정렬·기준 폭 맞춤, 시드 `animation` 검증, 모래상자 CLI 의 `import --action` → `pick --action` → `build`(anim.json) → `check` → `preview`.
- 노드 쪽 타입: `npx tsc -p src/harnesses/tsconfig.node.json`.
- 2026-10-01 실제 생성 시험(모래상자): 2단계 진화형 「스파키론」(`evolvesFrom: sparkit`)을 시드에 넣고 `front --n 4`(약 3분) → pick → `back --n 3`(약 2분) → pick → `build` → 실제 전투 화면 주입 캡처. 진화형이 같은 계통으로 그려졌고 검사 오류 0. 이 시험에서 단계 배율 누락을 찾아 고쳤다.

- 2026-10-01 애니메이션 시험(모래상자 `qa-runs/harness-anim`): 세 스타터 × 앞·뒤 공격 줄 `--n 2`(12장, 약 3분). 처음 1536×1024 참고 그림에서는 12장 중 5장이 몸집 반, 3장이 흰 줄로 갈라졌다 → 3:1 참고 그림·블록 짐작·좁은 칸 표본 수정 뒤 12장 모두 프레임 나누기 통과, 잘림 0. 남은 경고는 색 거리(어둡게 칠한 후보)와 몸집 85% 미만 1장 — 사람이 거른다.

## 아직 없는 것

- 에디터 화면(도감에서 「새 종 만들기」 후보 카드), 조수 도구 — `entrypoints.editorUi/assistantTool = false`. 조수 장르 안내문(`MONSTER_COLLECT_AUTHORING_GUIDE`)에는 도구가 생긴 뒤에 힌트를 넣는다.
- 번들 스프라이트를 몬스터 종 기록(`graphic.monsterResourceId` / `backResourceId`)과 기본 프로젝트에 배선하는 일.
- 파티 아이콘·필드 동행 그림.
- 애니메이션 스트립의 엔진 배선(`battlerIdleAnimations.ts` 카탈로그·전투 명령 단계별 프레임 전환).
