# Interior chipset LLM tile-placement benchmark

`easyrpg_chipset_interior` 를 정답지로 두고, 여러 LLM 이 타일을 어떻게 고르고 어떻게
집을 짓는지 채점하는 재현 가능한 벤치마크. 코드는 `src/benchmark/interior/`, CLI 는
`scripts/interior-bench.mts`, 테스트는 `test/interiorBench.test.ts`.

기존 `src/benchmark/` (combined_town 7차원, d1~d7, 브라우저 캔버스 기반)와 **별개**다.
그쪽은 에디터 UI 안에서 돌고 원문을 저장하지 않는다. 이쪽은 헤드리스 CLI 이고 원문을
보관해 재채점한다.

## Floor contract correction (2026-09-08)

The legacy `deck` metadata-group ID now denotes solid wooden tabletops. Floor
canonical answers therefore use only `floor`, `floor-stone`, and `floor-mat`;
tabletops are excluded from both canonical and generous answers and retained as
traps. This changes the derived ground-truth digest, not scoring weights or pass
thresholds. The canonical floor answer scores 1.0 through the real module entry
point; evidence is under `output/evidence/event-command-completion/legacy-terrain/`.

## 왜 interior 를 정답지로 쓰는가

번들된 칩셋 13종 중 메타데이터 계약이 완결된 것은 interior 와 dungeon 뿐이다
(2026-08-20 `defaultTilesets()` 실측):

| 타일셋 | 라벨 | 하네스 그룹 | 오토타일 | 통행불가 | upper |
|---|---|---|---|---|---|
| `easyrpg_chipset_interior` | **480/480** | 23 | 10 | 282 | 139 |
| `easyrpg_chipset_dungeon` | 478/480 | 51 | 13 | 203 | 115 |
| `easyrpg_chipset_combined_town` | 207/480 | 44 | 0 | 341 | 143 |
| retro_* / world / ship / modern | 0 | 0 | 0 | 0 | 0 |

interior 만이 라벨 + 그룹 + 오토타일 + **타일별 큐레이션 통행성** 네 가지를 다 갖췄고,
게다가 `planInteriorHouseWalls()` 라는 **정본 주택 문법 생성기**가 있다. "집을 어떻게
짓는가"를 채점할 기준선이 코드로 존재하는 유일한 칩셋이다.

## 재현성 설계 — 3층

LLM API 는 비트 단위로 재현되지 않는다. 그래서 재현성을 모델에서 물려받지 않고 제조한다.

**L1 실험 고정.** `RunManifest` 가 프롬프트 버전 · 정답 digest · 입력 PNG 바이트 sha256 ·
태스크 스위트 digest · 채점 코드 버전 · 가중치 · 샘플링 파라미터를 하나의 `manifestHash`
로 묶는다. **manifestHash 가 같아야만 두 점수를 비교할 수 있다.** 정답 테이블을 건드리면
digest 가 바뀌고 옛 점수와의 비교가 자동으로 차단된다.

**L2 보관 후 재생 (실제 보증).** 모든 시도가 모델 원문 바이트를 그대로 `RunRecord` 에
담는다. `replay` 는 네트워크 없이 그 원문을 다시 채점하고 직렬화 바이트가 원본과
같은지 검사한다. 다르면 종료 코드 1. 이것이 이 벤치마크가 실제로 보증할 수 있는
재현성이다 — 모델 응답이 아니라 **채점이** 재현된다.

**L3 분산 측정.** `--repeats N` + temperature 0 / top_p 1 / seed 고정. 모델의 비결정성을
숨기지 않고 태스크별 평균 · 모집단 표준편차 · pass@k 로 **측정해서 보고**한다.

## 채점 방안 6종

한 숫자로는 모델이 왜 틀렸는지 알 수 없다. 집합형 답변에 4개, 배치형에 2개를 쓴다.

집합형 (`scoringSets.ts`) — "어떤 타일이 X인가":

| 스킴 | 무엇을 재는가 |
|---|---|
| `setF1` | canonical 기준 정밀도/재현율/F1 — 정확히 맞췄는가 |
| `semantic` | canonical 1.0 / generous 0.5 부분점수. 분모 = max(정답 크기, 답변 길이) 라 답을 길게 늘여도 점수가 오르지 않는다 |
| `trapPenalty` | 재현율 − 밟은 함정 비율. rawScore 는 음수 가능, score 는 0..1 로 절단 |
| `rolePurity` | 고른 것들이 정답의 다수 역할과 같은 종류인가. **레이어로 정의된 카테고리(propUpper/distractor)에는 쓰지 않는다** — 정답 자체가 여러 역할에 걸쳐 있어 만점이 불가능하다 |

배치형 (`scoringStructure.ts`) — "이 그리드에 집을 지어라":

| 스킴 | 무엇을 재는가 |
|---|---|
| `gridIdentity` | 정본 플랜과 칸 단위 일치 + 좌표 IoU. 시트를 외웠는가 |
| `structural` | **타일 id 를 완전히 무시**하고 지은 것이 집으로 성립하는가. 5항 평균: ringClosed · doorReachable · interiorWalkable · layerDiscipline · noForbidden |

두 스킴을 함께 내는 것이 핵심이다. 정본과 다른 타일로 멀쩡한 집을 지은 모델은
`gridIdentity` 가 낮고 `structural` 이 1.0 이다. 정본 타일을 흩뿌리기만 한 모델은
그 반대다. 한 숫자로는 이 둘을 구분할 수 없다.

## 헤드라인 지표 — wallAny vs houseShellWall

이 칩셋에는 "벽으로 보이는" 타일이 102칸 있지만 정본 주택 셸은 **16칸**뿐이다
(`74,75,76,77,104,105,106,107,396,397,398,426,428,456,457,458`). 그래서 벽 질문을
두 개로 나눈다:

- `t1-wall-any` — 벽 전부 (정답 102, 함정 19)
- `t2-wall-house-shell` — 정본 셸만 (정답 16, **함정 79** = wall-brick/stone/panel/dark-zone)

t1 은 높고 t2 는 낮은 모델은 "벽 그림은 알아보지만 정본 문법은 모른다". 이 격차가
벤치마크가 측정하려고 만들어진 바로 그 값이다.

## 태스크 12종

`t1-wall-any` `t2-wall-house-shell` `t3-floor` `t4-ceiling` `t5-window`
`t6-furniture-solid` `t7-prop-upper` `t8-carpet` `t9-water` `t10-outdoor-distractor`
(이상 tileSet, 입력 = 아틀라스 1장) / `t11-build-house` `t12-build-two-rooms`
(placement, 입력 = 마킹된 그리드).

## 정답 카테고리 파생 (`groundTruth.ts`)

`src/benchmark/groundTruth.ts` 와 같은 계약이다: **파생 함수가 근본 진실**이고 소스
테이블이 바뀌면 digest 가 바뀐다. 소스는 `tileSemanticsInterior.ts`(480칸 라벨/역할/
통행성) · `themePacks.ts`(23 하네스 그룹) · `interiorHouseWallTiles.ts`(정본 셸) ·
`interiorHouseWallGrammar.ts`(플래너/천장) · `defaultTilesets()`(시드된 passability/priority).

카테고리마다 `canonical` / `generous` / `traps` 세 집합을 낸다. **traps 는 canonical·
generous 와 절대 겹치지 않는다** — 겹치면 같은 픽이 가점이자 감점이 된다.

### 함정 두 개 (실측으로 발견, 재발 방지용 기록)

**`door` 카테고리는 존재하지 않는다.** 이 칩셋에 문 아트가 없다. 플래너는 남쪽 벽에
바닥 칸을 뚫어 출입구를 만든다. 라벨 스캔으로 `door` 를 만들려 하면 "흰 창**문**"(54)
"커튼 창**문**"(56) 같은 **창문**과 금지 타일 257 이 잡힌다. 정답 집합을 파생할 수 없는
질문은 물을 수 없는 질문이다.

**`distractor` 를 "시맨틱과 런타임 통행성이 어긋나는 타일"로 정의하면 공집합이다.**
`themePacks` 가 passability 를 시맨틱에서 시드하므로 480칸 전부 일치한다(실측). 그래서
"실내 칩셋 안에 실려 있는 **실외 지형**"(grass + outdoor-ground, 71칸)으로 재정의했다 —
실내 바닥을 물었을 때 모델이 실제로 빠지는 함정이다.

**바닥 마스크는 방 사각형이 아니라 플랜이 실제로 바닥(72)을 깐 칸이다.**
`planInteriorHouseWalls` 는 두 방이 맞닿는 공유 변을 **칸막이 벽으로 전환**한다
(두 방 플랜에서 6,3→77 / 6,4→107 / 6,6→430). 사각형 마스크를 그대로 쓰면 정본 답변
자신이 "바닥인데 통행 불가"로 감점된다(실측 structural 0.95). **정답이 만점을 받지
못하는 채점 기준은 기준이 아니다** — `test/interiorBench.test.ts` 가 이것을 강제한다.

## 실행

```bash
# 라이브 실행 (키는 .env.local CPENROUTER_API_KEY, 출력·보관본에 절대 안 남는다)
npx tsx scripts/interior-bench.mts run --models cpen/gpt-5-4-mini,cpen/zen/mimo-v2.5-free --repeats 2

# 재현성 게이트 — 네트워크 없이 재채점, 바이트 다르면 exit 1
npx tsx scripts/interior-bench.mts replay --in output/interior-bench

# 리더보드
npx tsx scripts/interior-bench.mts report --in output/interior-bench

# 계약 테스트 39개
npx vitest run test/interiorBench.test.ts --config vitest.config.ts
```

게이트웨이가 죽어 있으면(실측: `provider_5xx` / `upstream_cooldown` 503) 시도가
`error` 로 기록되고 점수는 **null** 이다 — 0점이 아니다. "채점 불가"와 "0점"은 다른
사실이므로 섞지 않는다. 모델 가용성은 `GET https://cpenrouter.space/v1/models` 로 먼저 확인할 것.

## 안티-게이밍 규칙

- 프롬프트에 0..479 범위의 독립 숫자가 하나도 없다(테스트가 정규식으로 검사).
- 프롬프트에 `easyrpg` / `chipset` / `tileSemantics` / `harness` / `tilesPerRow` / `tileSize` 금지.
- 모든 프롬프트 빌더는 **인자 없는 순수 함수**다. 인자가 없으면 정답이 보간될 길도 없다.
- 입력 이미지에 글자·캡션·타일 id·범례를 그리지 않는다. jimp 텍스트 API 미사용을
  테스트가 소스 스캔으로 강제한다. 모델은 캡션이 아니라 그림을 읽어야 한다.
- 프롬프트 문구를 바꾸면 `INTERIOR_PROMPT_VERSION` 을 올린다 → manifestHash 변경 →
  옛 점수와 섞이지 않는다.

## 이 페이지를 갱신해야 하는 변경

정답 카테고리 추가/삭제, 채점 스킴 추가/가중치 변경, 태스크 추가, 프롬프트 문구 변경,
`planInteriorHouseWalls` 의 셸 문법 변경. 스킴 계산이 바뀌면 `SCORING_VERSION` 도 올린다.
