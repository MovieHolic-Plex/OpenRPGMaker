# 코딩 에이전트 벤치마크 — "이 칩셋으로 마을 만들어라"

코딩 에이전트(claude CLI)에게 이 저장소와 칩셋을 던져 주고 **얼마나·어떻게** 만드는지 재는 트랙.
코드는 `src/benchmark/agent/`, CLI 는 `scripts/agent-bench.mts`, 테스트는 `test/agentBench.test.ts`.

## town 트랙과 무엇이 다른가

| | `town/` 트랙 | `agent/` 트랙 |
|---|---|---|
| 재는 단위 | 단발 API 호출 1회 | **코딩 에이전트 실행**(`claude -p`, 도구·반복 허용) |
| 지시 | 문항별 고정 프롬프트 + 팔레트 | **생짜** — "이 칩셋으로 마을을 만들어라" |
| 하네스를 쓰면 | 불가능(도구가 없다) | **그게 실력이다** |
| 채점 | 9축 | `quality`(감사 통과율) + `scale`(규모). 합치지 않는다 |
| 1.000 의 뜻 | 하네스를 재현했다 | **하네스 수준** |

`quality` 와 `scale` 을 한 숫자로 합치지 않는 이유: "작지만 완벽한 마을"과 "크지만 엉망인 마을"은
서로 다른 실패이고, 합치면 그 둘이 같은 칸에 들어간다.

## 지시서는 생짜다

```
이 저장소의 기본 타일셋(EasyRPG RTP Combined Town ChipSet)으로 마을 맵 하나를 만들어라.
크기·구성·방법은 전부 네가 판단한다.

완성된 맵을 output/agent-bench/submission.json 에 아래 형식으로 저장해라:
{"width": 정수, "height": 정수, "lowerTiles": [정수...], "upperTiles": [정수...]}
lowerTiles·upperTiles 는 행 우선(row-major) 배열이고 길이는 width*height 여야 한다.
빈 칸은 -1 이다. 이 파일 하나가 제출물이다.
```

**도구 이름을 흘리지 않는다.** `build_village`·`stampRectHouseKit`·오토타일 엔진이 저장소에
있다는 사실을 알려주지 않는다 — 그것을 찾아내는 것까지가 실력이기 때문이다.
`test/agentBench.test.ts` 가 지시서에 그 이름들이 없는지, 그리고 크기·집 수를 지정하는 숫자가
없는지(제출 형식의 `-1` 제외) 기계적으로 검사한다.

지정하는 것은 **제출 경로와 형식뿐**이다. 시험지를 어디에 내라는 말은 풀이 방법을 알려주는 것이
아니고, 그것마저 없으면 산출물을 찾을 수 없어 채점이 성립하지 않는다.

## 채점은 픽스처에서 독립한다

생짜 지시는 맵 크기도 집 위치도 정하지 않으므로 채점 전에 **탐지**가 온다(`agent/detect.ts`):

- **건물** = 벽·지붕 계열 타일의 **8방향** 연결 성분(4방향만 쓰면 사선 지붕 캡이 본체와 떨어져 한 집이 여러 채로 세진다)
- **집** = 문이 하나 이상 난 건물. 문 타일은 벽 계열이 아니므로 "문 칸이 건물에 속하는가"로 물으면
  어느 집도 자기 문을 못 찾는다 — 문은 벽을 뚫고 난 구멍이라 **주위 8칸에 그 건물의 벽이 있는가**로 묶는다
- **길** = `ROAD_TILES`(흙길 ∪ 모래 ∪ 포석) 4방향 성분
- **울타리** = 상위 레이어의 `FENCE_TILES`. 런의 양끝 마감·모서리 연결·고아 조각을 본다
- **조각난 나무** = 캐노피가 있는데 그 칸 하위에 짝이 되는 줄기가 없는 칸

### quality 항목

일한 항목의 평균 × 감점 배수. 감점 항목을 평균에 같이 넣으면 아무것도 안 한 답이 높은 점수를 받는다.

- 일한 항목: `housesWithDoor` · `doorsWithRoad` · `roadOneNetwork` · `doorsReachable` ·
  `fenceGrammar` · `roadAutotileLegality` · `doorFamilies`
- 감점 배수: `layerDiscipline` · `noBanned` · `treesIntact`

`roadAutotileLegality` 는 흙길과 **포석 두 그룹 다** 채점한다 — 한쪽만 보면 "포석 몸통 타일로만
도배"가 검사를 통째로 빠져나간다. 문이 하나도 없으면 문 관련 항목은 "해당 없음"이 아니라 **0**이다:
들어갈 수 없는 건물만 세워 놓은 것은 마을이 아니다.

### scale

정본 마을 대비 (집 수 · 면적 · 길 칸수)의 평균. 기준선은 손으로 적지 않고 **정본을 실제로
탐지해서** 뽑으므로 하네스 출력이 정확히 1.000 이 된다. clamp 하지 않는다 — 더 크게 만들었으면
1.0 을 넘겨 그대로 보고한다. 셋 중 면적이 가장 부풀리기 쉬우므로 `detail` 의 내역을 함께 본다.

## 실행

```bash
npx tsx scripts/agent-bench.mts baseline                          # 하네스 정본 = 1.000/1.000 확인
npx tsx scripts/agent-bench.mts run --models opus,sonnet,haiku --turns 40
npx tsx scripts/agent-bench.mts score  --in output/agent-bench    # 보관 제출물 재채점
npx tsx scripts/agent-bench.mts report --in output/agent-bench
npx tsx scripts/agent-bench.mts evidence --in output/agent-bench  # 제출물을 칩셋으로 합성한 PNG
```

격리: 모델마다 detached 워크트리를 새로 만들어 그 안에서만 돌린다(`.herdr/worktrees/agent-bench-<model>-<n>`).
에이전트가 본 리포나 다른 워크트리를 건드리지 못한다. `node_modules` 는 정션으로 빌려 주므로
에이전트가 타입체크·테스트를 돌릴 수 있다.

## 첫 실측 (2026-08-21)

| 실행 | quality | scale | 집/건물 | 문 | 턴 | 비용 | 분 |
|---|---|---|---|---|---|---|---|
| 하네스 정본 | 1.000 | 1.00 | 3/3 | 3 | — | — | — |
| haiku-1 | **0.238** | 0.92 | **0/3** | **0** | 20 | $0.35 | 3.3 |

haiku 는 잔디를 깔고 십자 길을 내고 나무를 심었지만 길을 **몸통 타일로만** 깔았고(오토타일 성형
없음), 벽 조각 3개에 지붕도 문도 울타리도 없다 — 들어갈 수 있는 집이 0채다. `evidence` 로 구운
PNG 가 그 사실을 숫자보다 먼저 보여 준다.

## 비용 주의

에이전트 실행은 단발 호출보다 훨씬 비싸다. haiku 20턴이 $0.35 · 3.3분이었고, opus 는 턴당 비용이
크게 높다. `--turns` 로 상한을 걸고, 모델 하나씩 돌려 결과를 확인한 뒤 다음을 돌리는 것이 안전하다.
