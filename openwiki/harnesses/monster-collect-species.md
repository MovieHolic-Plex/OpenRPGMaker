# 몬스터 수집 종 스프라이트 하네스 (`monster-collect-species`)

몬스터 수집(포켓몬류) 장르 **전용**. 도감 시드의 종마다 상대 앞모습·내 몬스터 뒷모습 전투 스프라이트를 만든다.
JRPG 일반 적 그림은 여기서 만들지 않는다(`src/editor/aiDatabaseGeneration.ts` 의 자료집 그림 생성 경로).
구조 규칙은 [README](README.md), 목록은 `src/harnesses/INDEX.md`.

## 빠른 시작

```bash
npm run harness -- monster-collect-species status                       # 시드의 종별 진행
npm run harness -- monster-collect-species front --species sparkit --n 6 # 앞모습 후보 6장 → sheet.html
npm run harness -- monster-collect-species pick --species sparkit --side front --run <run> --candidate 2
npm run harness -- monster-collect-species back --species sparkit --n 3  # 고른 앞모습으로 뒷모습 후보
npm run harness -- monster-collect-species pick --species sparkit --side back --run <run> --candidate 1
npm run harness -- monster-collect-species build                        # 번들 굽기 + 검사
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
| `harness-data/monster-collect-species/seed.json` | 사람이 쓰는 도감 기획 + 화풍 계약 |
| `harness-data/monster-collect-species/ledger.json` | 하네스가 쓰는 선택 기록 (원본 sha256·프롬프트·블록 크기) |
| `harness-data/monster-collect-species/grids/<종>-<면>.png` | 고른 후보의 격자 도트(칸 하나 = 픽셀 하나). `build` 의 입력 |
| `public/assets/harnesses/monster-collect-species/<종>/<front\|back>.png` | 번들 스프라이트 (112×112) |

## 왜 이렇게 만드는가 (2026-10-01 실험, `qa-runs/hand-monster/` 시안)

- **손 도트(64·48px)와 「생성 → BOX 축소」(v9) 는 사용자에게 거절됐다**(「허접」, 「못 봐주겠다」). v9 의 잘게 갈라진 색 조각은 그림 탓이 아니라 축소 탓이었다: 생성기는 도트풍을 8~27px 가짜 픽셀 블록으로 그리는데, BOX 축소가 블록 경계와 어긋나 이웃 색을 섞는다. 격자를 찾아 칸마다 최빈 색을 고르면 생성기가 고른 도트가 그대로 남는다.
- **블록 크기 추정**: 색 경계 봉우리 간격이 크기 p 의 정수배에 가까운지 센다(배수 k 가중 1/k). 반올림한 몫에 투표하면 13·14px 간격이 반 크기 7 에 몰려 칸을 둘로 쪼갠다.
- **프롬프트**: 예전 자료집 프롬프트(「front view facing the viewer, white background」)가 정면 마스코트를 만들었다. 포켓몬 BW 상대 스프라이트풍, 왼쪽 3/4, 마스코트·치비·볼터치 금지, 생물 해부, 마젠타 단색 캔버스를 참고 이미지로. 검정 배경·불꽃 후광이 붙으면 배경 제거가 안 된다.
- **뒷모습**: 생성 원본이 아니라 깨끗한 도트를 정수배로 키워 마젠타에 놓은 것을 참고로 넣는다. 원본을 넣으면 어두운 후광이 따라왔다. 네 발 종은 뒷모습도 네 발이어야 한다(두 발로 선 후보가 섞여 나온다 — 사람이 거른다).
- **공식 몬스터 닮은꼴**: 이상해씨·파이리를 그대로 닮은 후보가 나왔다. 프롬프트 `avoid` 로 줄이고, 최종 판정은 사람.
- **크기**: 몸집 = 잉크 상자 넓이의 제곱근. 앞 80·뒤 88 목표 × 진화 단계 배율(1·1.12·1.25), 긴 변 108 이하, 정수배에 0.15 안이면 정수 축소. 긴 변으로만 맞추면 납작한 도롱뇽이 작아 보였다. 단계 배율이 없으면 진화형이 1단계와 같은 크기로 나왔다(2026-10-01 시험). 큰 원본은 긴 변 상한에 먼저 걸려 2·3단계 크기가 같아질 수 있다 — 캔버스를 키우기 전엔 남는 한계.

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

닮은꼴·자세·앞뒤가 같은 생물로 보이는지는 **사람 눈**이다. 실제 전투 화면 캡처로 본다.

## 전투 배치 (`src/harnesses/monster-collect-species/qa/battle-layout.css`, 엔진 미반영)

포켓몬 스킨에서 112 캔버스를 내 몬스터 3배(화면 336)·상대 2배(화면 224) 정수 배율로 그리고, 발판을 같은 배율로 줄이고, 발을 발판 중심에 두고,
상대 숨쉬기 찌그러짐(`battler-breathe`)을 끈다. 2026-10-01 실제 플레이어 화면에 주입해 확인했다(명령 선택 화면만 — 공격·피격·기절·포획 모션은 미확인).
엔진 반영 대상은 `src/styles/runtime/battle/20-pokemon-skin.css`. 주입 캡처는 시안 녹화기(qa-runs/monster-viz/record.mjs, gitignore — `INJECT_CSS`·`OVERRIDES` 환경 변수)로 했다 — 하네스 `qa/` 로 옮기는 건 다음 작업.

## 시험

- 단위 시험: `test/harnesses/monsterCollectSpecies.test.ts` — 가짜 생성 그림(격자 흔들림·경계 번짐·잡음, 마젠타/검정 배경)에서 원래 도트 복원, 실제 실패 그림의 경계 간격 고정 자료(`test/fixtures/harnesses/leafling-back-block-gaps.json`, 예전 반올림 투표는 같은 자료에서 반 크기를 고른다는 것까지 단언), 색 합치기·마젠타 정리·선 우선 축소·몸집·단계 배율·112 캔버스, 검사, 시드 검증, 장르 범위, INDEX 일치, 커밋된 번들 검사, 모래상자 CLI(import→pick→build→check, 커밋 기록 불변).
- 노드 쪽 타입: `npx tsc -p src/harnesses/tsconfig.node.json`.
- 2026-10-01 실제 생성 시험(모래상자): 2단계 진화형 「스파키론」(`evolvesFrom: sparkit`)을 시드에 넣고 `front --n 4`(약 3분) → pick → `back --n 3`(약 2분) → pick → `build` → 실제 전투 화면 주입 캡처. 진화형이 같은 계통으로 그려졌고 검사 오류 0. 이 시험에서 단계 배율 누락을 찾아 고쳤다.

## 아직 없는 것

- 에디터 화면(도감에서 「새 종 만들기」 후보 카드), 조수 도구 — `entrypoints.editorUi/assistantTool = false`. 조수 장르 안내문(`MONSTER_COLLECT_AUTHORING_GUIDE`)에는 도구가 생긴 뒤에 힌트를 넣는다.
- 번들 스프라이트를 몬스터 종 기록(`graphic.monsterResourceId` / `backResourceId`)과 기본 프로젝트에 배선하는 일.
- 파티 아이콘·필드 동행 그림.
