# Combined-town chipset LLM tile-placement benchmark — 9문항 트랙

`easyrpg_chipset_combined_town`(프로젝트 **기본** 타일셋)으로 여러 LLM 이 타일을 어떻게
깔는지 채점하는 재현 가능한 벤치마크. 코드는 `src/benchmark/town/`, CLI 는
`scripts/town-bench.mts`, 테스트는 `test/townBench.test.ts`.

같은 리포에 있는 다른 두 벤치마크와의 관계:

| 트랙 | 대상 | 성격 |
|---|---|---|
| `src/benchmark/` (d1~d7) | combined_town | 1세대. 에디터 UI 안에서 돌고 원문을 보관하지 않는다. 재현성 척추 없음 |
| `src/benchmark/interior/` | interior | 2세대. 헤드리스 CLI + 재현성 3층 + 6종 채점 스킴 |
| **`src/benchmark/town/`** | combined_town | 3세대. 2세대 척추를 쓰면서 **감독의 9문항**에 1:1 대응 |

## 9문항 = 9숫자

축 번호는 감독이 준 문항 번호 그대로다. 리포트를 문항표와 나란히 읽을 수 있게.

| # | 축 | 태스크 | 채점 |
|---|---|---|---|
| 1 | `autotile` 오토타일 | `t1-autotile-path` | 칸 단위 정확도. **오목 코너 4칸은 `detail.innerCorner` 로 따로** |
| 2 | `reproducibility` 재현성 | (전 태스크에서 파생) | 반복 답변끼리의 일치율 평균. replay 바이트 일치는 별도 하드 게이트 |
| 3 | `layer` 상·하위 레이어 | `t2-layer-probe`, `t3-tree-layers` | 균형 정확도 + 줄기/캐노피 쌍 규칙 |
| 4 | `road` 길 | `t4-passability-probe`, `t5-road-network` | 균형 정확도 + 구조(연결·오토타일 합법성) |
| 5 | `wallOutline` 벽 외곽 | `t6-wall-probe`, `t7-house-shell` | 균형 정확도 + mean(정본 일치, 구조) |
| 6 | `roofDiagonal` 지붕 대각 | `t8-aframe-roof` | mean(정본 일치, 구조: 계단 인셋·꼭짓점·캡 레이어) |
| 7 | `door` 문 | `t9-door` | mean(정본 일치, 구조: 세로 짝·같은 벌·문 앞 통행) |
| 8 | `fenceEnd` 울타리 끝 | `t10-fence-ends` | 문법 규칙 8개 통과율 |
| 9 | `village` 마을 | `t11-village` | 자동 감사 7항 × 감점 3항 |

축이 여럿인 문항은 "선행 프로브 + 실제 배치" 쌍이다. 프로브만 잘하고 배치를 못하는
모델과 그 반대를 구분하려면 둘을 따로 물어야 한다.

## 정답은 손으로 쓰지 않는다

`groundTruth.ts` 는 **살아있는 엔진을 호출해서** 정답을 만든다:

| 문항 | 정답 출처 |
|---|---|
| 1·4 | `autotileVariantForMask` × `DEFAULT_ROAD_AUTOTILE_GROUP` |
| 5·6·9 | `houseKit.stampRectHouseKit` (나인슬라이스 / A자 피라미드 문법) |
| 7 | `village/houses.ts` 문 규약 — 하위 레이어 상단 116 / 하단 146 |
| 8 | `village/fences.ts` `placeHouseLotFences` (모서리 강등 로직 포함) |
| 3 | `benchmark/groundTruth.deriveTreePairs()` |
| 통행성·레이어 | `defaultTilesets()[easyrpg_chipset_combined_town]` |

엔진 문법이 바뀌면 정답이 같이 바뀌고, `manifestHash` 가 달라져 옛 점수가 자동으로
비교 대상에서 빠진다. 픽스처 기하가 엔진 제약을 어기면(예: A자 지붕의 폭이 짝수)
`buildTownGroundTruth()` 가 즉시 throw 한다.

이 칩셋은 480칸 중 207칸만 라벨돼 있고 타일셋 자체의 `autotileGroups` 는 0 이다. 그래서
오토타일 정답은 `DEFAULT_AUTOTILE_GROUPS` 폴백에서 온다 — 이것이 **실제 런타임 동작**과
같은 경로이므로 정당하다.

## 팔레트는 주고 배치를 측정한다

interior 트랙은 배치 태스크에 그리드 그림만 주고 타일 id 를 알려주지 않는다. 그러면
측정되는 것은 "30열 시트에서 눈으로 480까지 세기"이지 타일 배치 실력이 아니다. 실제
제품도 AI 에게 타일 어휘를 넘긴 뒤 배치를 시킨다.

그래서 이 트랙은 태스크마다 **팔레트**(오름차순·중복 없는 후보 id 집합 + 그 그림)를 준다.

- 허용: 후보 어휘(벽 세트, 흙길 블록, 울타리 8종 …)
- 금지: 역할→id 매핑, 좌표→id 매핑, 프로브의 정답 부분집합

`test/townBench.test.ts` 가 프롬프트에서 정수를 전부 뽑아 해당 태스크의 팔레트/프로브
집합과 **정확히 같은 집합인지** 기계적으로 대조한다(`-1` 은 빈 칸 표기라 예외).

이미지에는 글자를 일절 그리지 않는다(타일 번호도, 범례도). 팔레트 스트립은 오름차순
읽기 순서로만 id 와 대응하고, 테스트가 `inputImages.ts` 에 jimp 의 글자 API 호출이
없음을 검사한다.

## 재현성 설계 — 3층

LLM API 는 비트 단위로 재현되지 않는다. 그래서 재현성을 모델에서 물려받지 않고 제조한다.

- **L1 실험 고정** — `TownRunManifest` 가 프롬프트 버전·정답 digest·입력 PNG 바이트
  sha256·태스크 스위트 digest·채점 버전·샘플링 파라미터를 한 해시로 묶는다.
  `manifestHash` 가 같아야만 두 점수를 비교할 수 있다.
- **L2 보관 후 재생** — 원문(rawAnswer)을 전량 보관하고, 네트워크 없이 다시 채점해
  **직렬화 바이트가 원본과 같은지** 검사한다. 다르면 `replay` 가 exit 1 — 그 런은 무효다.
- **L3 분산 측정** — 반복 3회의 평균/표준편차를 보고하고, 답변끼리의 일치율을 2번 축으로 낸다.

2번 축은 모델 **실력이 아니다**. "같은 질문에 같은 답을 내는가"이며, 그것이 나머지
8축을 믿을 수 있는지의 전제다.

## 채점기가 지키는 두 가지 불변식

1. **정본은 만점이다.** 참조 배치를 답으로 넣으면 9축 전부 1.000 이어야 한다.
   테스트가 태스크별로 이것을 강제한다 — 정답이 만점을 못 받는 기준은 기준이 아니다.
2. **아무것도 안 한 답은 0점이다.** "건물을 침범하지 않았다", "금지 타일을 안 썼다"
   같은 항목은 빈 답에서 자동으로 만점이 된다. 그런 항목을 평균에 같이 넣으면 빈 답이
   0.667 을 받는다(2026-08-21 실측 버그). 그래서 채점은 `combine(일한 항목 평균,
   감점 항목 배수)` 로 계산하고, 한 칸도 놓지 않은 답은 채점 전에 0점으로 못 박는다.

## 실행

```bash
# API 없이 배선·채점기 점검 (정본 답변으로 9축 만점이 나와야 한다)
npx tsx scripts/town-bench.mts demo

# 실제 모델 (키는 .env.local 의 CPENROUTER_API_KEY — 출력·보관하지 않는다)
npx tsx scripts/town-bench.mts run --models <opus,sonnet,haiku> --repeats 3

npx tsx scripts/town-bench.mts replay   --in output/town-bench   # 재현성 게이트
npx tsx scripts/town-bench.mts report   --in output/town-bench   # 9축 리더보드
npx tsx scripts/town-bench.mts evidence --in output/town-bench   # PNG + HTML 증거 시트
```

## 감독용 보고서

```bash
npx tsx scripts/gen-town-bench-report.mts   # -> town-bench-report.html (루트, git 미추적 산출물)
```

칩셋 하네스 보고서(`combined-town-chipset-report.html`)와 같은 시각 언어·같은 규약(칩셋 PNG
하나를 base64 인라인 → `background-position` 으로 잘라 쓰기, 번호에는 항상 그림)을 따른다.
문항마다 **모델이 받는 입력 이미지 + 엔진이 만든 정본 렌더 + 팔레트 + 채점 항목 + 하네스 대응
코드**를 나란히 싣는다.

보고서의 축은 "점수표"가 아니라 **하네스가 대신 지고 있는 짐의 무게**다. 이 저장소의 제1원칙은
"LLM에게 타일 번호를 고르게 하지 않는다"이므로(하네스 보고서 §09), 이 벤치마크의 낮은 점수는
모델 결함이 아니라 **하네스를 걷어내면 안 되는 지점**을 뜻한다.

## 증거 시트

숫자만으로는 6·8·9번을 검수할 수 없다 — 점수가 높아도 그림이 엉망일 수 있다.
`evidence` 는 모델의 답을 **실제 칩셋으로 합성해** PNG 로 굽고, 정본과 나란히 붙인
HTML 을 낸다. 문·울타리 과제는 이미 지어진 집 위에 합성해 완성된 모습을 보여 준다.
0.7 미만 점수는 붉게 표시한다.

## 비용

11 태스크 × 3 반복 = 모델당 33 회 호출. 마을 태스크(20×12 두 레이어 = 480개 정수)가
출력 토큰의 대부분이다. 그리드를 더 키우면 `maxTokens` 8192 에 닿아 절단이 실력이 아닌
이유로 점수를 갈라 버린다 — 크기를 올릴 때는 반드시 절단률을 함께 본다(절단은 계약
오류로 기록되고 0점과 구분된다).
