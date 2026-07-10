# 툴콜링 아키텍처 정리 (리뷰용)

> 작성: 2026-07-10  
> 목적: 현재 AI 툴콜링이 왜 “엉망진창”처럼 보이는지 **구조·경로·함정**을 한 장에 모은다.  
> 범위: 인에디터 `AssistantSession` function calling (채팅 + 영역 작업). MCP headless/dry-run은 별도.  
> 자동 카탈로그(`docs/tool-catalog.md`, ~136툴)와 다름 — 이 문서는 **정책·경로 지도**.

---

## 0. 한 줄 요약

툴이 많은 것보다 문제가 되는 것은:

1. **같은 목적에 툴이 3세대(v1→v2→v3) + 고수준 빌더**로 겹쳐 있고  
2. **노출 집합이 “UI 모드 + 메시지 키워드 + 전역 핀 + 상한 40”** 네 겹 필터를 거치며  
3. **채팅 vs 영역 작업이 서로 다른 프롬프트/의도 시스템을 쓰는데**  
4. **의도 키워드·소품 vocab id·툴 description이 서로 어긋나면** 모델이 가장 안전한 잘못된 도구로 도약한다  

라이브 사고 예: `박스 2개` → `place_props(small-props)` 랜덤 가방 (정답은 `wood-box`).

---

## 1. 전체 파이프라인

```
사용자 입력
   │
   ├─[채팅] aiChatPanel → AssistantSession.sendUserMessage(text)
   │
   └─[영역] openRegionTaskModal → runRegionTask
            └─ buildRegionTaskMessage(instruction, region, tileset)
                 │  (의도 가이드 + 소품 vocab 힌트 + 영역 하드 스코프 footer)
                 ▼
         AssistantSession.sendUserMessage(enrichedText)
                 │
                 ▼
    beginAssistantToolDomainTurn(text)
    computeActiveToolDomains(text)   ← UI 모드 + INTENT_KEYWORDS + recent
                 │
                 ▼
    toOpenAiTools({ domains })
       1) deprecated 제외
       2) domain 교집합
       3) 약한 도메인 통째 드롭 (다도메인 폭주 시)
       4) PINNED 우선 + MAX 40 슬라이스
                 │
                 ▼
    LLM function call(s)
                 │
                 ▼
    toolRunner.runTool → dry-run proposal / soft-confirm / 영역이면 clip + pending apply
```

핵심 파일:

| 역할 | 파일 |
| --- | --- |
| 레지스트리·노출 | `src/editor/tools/toolRegistry.ts` |
| 도메인 의도(키워드) | `src/editor/assistantToolMode.ts` |
| 영역 메시지·vocab 힌트 | `src/editor/regionTask/runRegionTask.ts` |
| 영역 의도 가이드 | `src/editor/regionTask/regionIntentRouter.ts` |
| 세션 루프 | `src/ai/assistantSession.ts` |
| v3 시공 | `src/editor/tools/v3/constructionTools.ts` |
| 이벤트/상자 | `src/editor/tools/eventTools.ts` |
| Combined Town 그룹 | `src/project/tilesetHarness/combinedTownGroups.ts` |
| 자동 카탈로그 | `docs/tool-catalog.md` (생성물) |

---

## 2. 레지스트리 구조 (세대가 쌓인 이유)

### 2.1 등록 순서

`TOOL_REGISTRY` = 패밀리 배열 합치기 + `tagV1()` 로 deprecation 마킹.

대략 순서:

1. **v3** vocabulary + construction (`propose_tile_vocabulary`, `build_wall`…`place_props`, `fill_region`, `tile_erase`)
2. **고수준 빌더** `build_house_kit`, `build_house_lots`, `build_village`, `build_castle`
3. **v2** tile tools (다수 **deprecated**)
4. **map / event / db / world / quest / battle / system / query…**

카탈로그 기준 **총 ~136**, 쓰기 ~98 / 읽기 ~38.  
LLM에 보이는 것은 그중 **deprecated 제외 + 도메인 필터 + 최대 40**.

### 2.2 Supersession 체인 (헷갈림의 원천)

| 옛 이름 | 대체 | 비고 |
| --- | --- | --- |
| `paint_tiles` | `tile_paint` | v1→v2 |
| `clear_region` | `tile_paint` | 이후 v2도 deprec |
| `scatter_object` | `tile_scatter` → **`place_props`** | v3 |
| `stamp_structure` / `build_house` | `tile_structure` → **`build_wall`** (가이드) / **`build_house_kit`** (권장) | 이름이 직관과 안 맞음 |
| `tile_road` | `lay_path` | 그런데 **`paint_road`는 일부러 살아 있음** (흙길 오토타일 본선) |
| `tile_group` / `tile_metadata` 등 | `propose_tile_vocabulary` | “옛 지식 툴” 홍수 차단 |

**예외 정책이 문서화되어 있지 않으면 모델·인간 모두 길을 잃는다.**

- 길: `paint_road` (살아 있음) vs `lay_path` (vocab 승인 필요) vs deprecated `tile_road`
- 집: `build_house_kit` / `build_house_lots` vs deprecated `build_house` / `stamp_structure`
- 지우기: 가이드는 `tile_erase`, 옛 이름은 `clear_region`

### 2.3 Core 상시 5종

항상 도메인에 실림:

`create_map`, `resize_map`, `get_project_summary`, `list_resources`, `tile_query`

---

## 3. 노출 정책 (MAX 40 + PIN)

### 3.1 도메인 집합

`computeActiveToolDomains(userMessage)`:

| 소스 | 내용 |
| --- | --- |
| 항상 | `core` |
| UI | `computeAssistantToolMode()` — DB 모달 / 이벤트 에디터 / 이벤트 레이어 / 타일 팔레트 / 기본 `map` |
| 의도 strong/weak | `INTENT_KEYWORDS` 부분일치 (단음절 `"적"` 등 사고 이력 있음) |
| recent | 직전 1–2턴 사용 도메인 TTL |

### 3.2 상한 알고리즘 (`applyExposureLimit`)

1. 활성 도메인에 안 맞는 툴 제거  
2. 개수 > 40 이고 제거 가능한 **약한 도메인**이 있으면 도메인 통째 드롭  
3. 그래도 넘치면 **핀된 툴 먼저**, 나머지는 레지스트리 순 `slice`  

`MAX_EXPOSED_TOOLS = 40`

### 3.3 전역 PIN (`PINNED_TOOLS_BY_DOMAIN`)

| domain | pin (요약) |
| --- | --- |
| tile | `place_props`, `build_house_kit`, `build_house_lots`, `build_castle`, `fill_region`, `build_wall`, `paint_road`, `lay_path`, `tile_query`, `propose_tile_vocabulary` |
| event | `place_npc`, `make_villager`, … **`place_chest`**, `place_savepoint`, mood/lighting, `create_transfer_pair` |
| map | `get_map_region`, `show_map_region`, … **`mirror_region`**, `set_encounter_table` |

주의 (코드 주석 그대로의 함정):

> 핀 목록은 **전역**이다. region 전용이 아니다.  
> 핀을 늘릴수록 비핀 툴이 40 상한에서 밀린다.

2026-07-10 실측: region 가이드에 적어 둔 도구가 **미노출**이라 모델이 대체 경로로 새던 사고 → pin 추가.

---

## 4. 키워드 시스템이 **두 개**

여기가 구조적으로 가장 지저분한 부분이다.

### 4.1 `INTENT_KEYWORDS` (`assistantToolMode.ts`)

- 역할: **어떤 도메인 툴 묶음을 LLM에 열지**  
- 예: `"나무"`, `"소품"`, `"집"` → tile / `"npc"` → event / `"적"` → battle(과거 오탐)  
- 채팅·영역 **공통** (메시지 전체 문자열 스캔)

### 4.2 `REGION_INTENT_KEYWORDS` (`regionIntentRouter.ts`)

- 역할: **영역 작업 메시지에 붙일 가이드 문장** (툴 노출 자체를 직접 열지 않음 — 의도는 가이드 주입)  
- 카테고리: structure / npc-shop / door-transfer / quest-trigger / battle-trap / mood / transform  
- 과거: bare `"상자"` → quest-trigger → `place_chest` 가이드  
- 2026-07-10 수정: `보물상자` / `상자를 열` 만 quest; 장식 박스는 기본 가이드의 `wood-box`

### 4.3 둘의 관계 (실측 결론)

| 기대 | 실제 |
| --- | --- |
| region 카테고리별로 domain seed를 더 열면 안전 | **A/B상 거의 무효** → domain seed 병합 제거됨 |
| 가이드에 쓴 도구는 반드시 노출 | **아님** → PIN + 상한 40이 진짜 노출 보장 |
| 키워드 하나가 한 의미 | **아님** — `"맵"`(footer) / `"적"` / `"상자"` 오탐 이력 |

---

## 5. 채널 두 갈래: 채팅 vs 영역

| | 채팅 | 영역 (`runRegionTask`) |
| --- | --- | --- |
| 입력 | 사용자 문장 (+ 선택 칩 등) | `buildRegionTaskMessage`로 **장문 시스템 가이드 주입** |
| 스코프 | 프로젝트 전역 (제안 후 커밋) | 사각형 하드 클립 + **승인 게이트** (pending apply) |
| 모델 | supervisor `model` + executor `liteModel` 3-phase | 보통 lite 경로 비중 큼 |
| 소품 힌트 | 시스템 프롬프트/스킬 위주 | `formatApprovedPropVocabHint` + 고정 규칙 줄 |
| 완료 | proposal card | before/after + 적용/버리기 |

영역 메시지 고정 골격 (개념):

```
{instruction}

(영역 작업: 타일 지형 나무 소품 집 npc 이벤트 주민)   ← domain seed 문자열
영역 작업 도구 규칙:
- 집 → build_house_kit
- 산포 → place_props + vocab 목록
- 장식 박스 → wood-box (small-props/place_chest 금지)   ← 2026-07-10 보강
- 보물상자 → place_chest
- 면 → fill_region (원형=shape=circle)
- 길 → paint_road
- … + routeRegionIntent 가이드
- 승인 후에만 반영 / 영역 밖 금지

이 작업은 아래 선택 영역 안에서만…
[컨텍스트] 현재 맵: … 사용자 선택 영역: (x,y) w×h
```

---

## 6. 소품·박스 툴콜 — 왜 틀렸는가

### 6.1 정답 맵 (장식)

| 사용자 말 | 올바른 툴콜 | vocab / 타일 |
| --- | --- | --- |
| 박스 / 나무상자 / 나무박스 | `place_props` | `harness-combined-town-wood-box` 또는 `"237"` |
| 과일박스 | `place_props` | `harness-combined-town-fruit-box` (202\|203) |
| 잡소품 흩뿌리기 | `place_props` | `harness-combined-town-small-props` (**가방**) |
| 보물상자 (열면 아이템) | `place_chest` | 이벤트, 타일 그룹 아님 |

정의 위치: `combinedTownGroups.ts` (`wood-box`, `fruit-box`, `small-props`).

### 6.2 사고 로그 (2026-07-10)

| 지시 | 실제 툴 | 문제 |
| --- | --- | --- |
| `상자 2개` | `place_chest` ×2 | bare 상자 → quest 가이드 오염 (당시) |
| `박스 2개 설치해줘` | `place_props` + **`small-props`** count=2 | 가방 랜덤 2개. AI 멘트만 “박스 형태” |

원인 분해:

1. 힌트 우선순위가 **tree → small-props → path → water** 중심 → wood-box 밀림  
2. `place_props` description에 박스 매핑 부재  
3. 모델은 힌트에 보이는 id만 고름  

조치 (코드, 같은 날):

- `REGION_PROP_VOCAB` + 힌트에 wood/fruit **앞배치**  
- 영역 고정 줄: wood-box 강제 / small-props·place_chest 대체 금지  
- `place_props` / `place_chest` description 보강  
- intent: bare `상자` 제거  

→ **증상 패치**. 근본은 “요청 타입 → 정준 툴콜” 표가 레지스트리/프롬프트에 단일 소스로 없음.

---

## 7. “무엇을 쓸까” 치트시트 (현행 권장)

사람이 리뷰·스킬·가이드를 쓸 때 기준으로 삼을 표.

| 의도 | 1순위 툴 | 비고 |
| --- | --- | --- |
| 원형 호수 | `fill_region` + water vocab + **`shape=circle`** | rect만 쓰면 네모 |
| 흙길/모래길 | `paint_road` | lay_path는 vocab 승인 길 |
| 나무/숲 산포 | `place_props` + conifer-tree | 물 위 금지 |
| 장식 박스 | `place_props` + **wood-box** | small-props 금지 |
| 집 1채 | `build_house_kit` | 벽 직사각 금지 |
| 집+마당 꾸밈 | `build_house_lots` | yard 태그 wood_box 등 |
| 마을 한 방 | `build_village` | bounds 가능 |
| 성채 | `build_castle` | |
| 주민 | `place_npc` / `make_villager` | |
| 보물상자 | `place_chest` | 장식 박스 아님 |
| 세이브 | `place_savepoint` | |
| 인카운터 구역 | `set_encounter_table` / `make_hunting_ground` | |
| 좌우 대칭 | `mirror_region` | |
| 영역 비우기 | `tile_erase` | clear_region deprecated |
| 미승인 타일 재료 | `propose_tile_vocabulary` 후 같은 턴 시공 | region은 “댄스 하지 말 것” 문구 있음 |

---

## 8. 현재 구조의 문제 목록 (정리)

### P0 — 모델이 틀리기 쉬운 구조 결함

1. **정준 툴 표가 코드에 분산**  
   description / region 가이드 / skills / intent / pin 이 각각 다른 진실.  
2. **동음이의**  
   상자=보물 vs 박스=장식; 길=paint_road vs lay_path; 집=kit vs wall.  
3. **노출 비결정성**  
   같은 지시라도 UI 레이어·최근 도메인·핀 경쟁에 따라 툴 셋이 바뀜.  
4. **propVocabId 가방 함정**  
   `small-props` 이름만 보면 “소품 만능”처럼 보임. 실제는 잔여 잡동사니 가방.

### P1 — 유지보수 부채

5. v1/v2 **deprecated지만 실행 가능** → 테스트·구 세션은 편하나 카탈로그/문서에 노이즈.  
6. `tile_paint` → supersededBy `tile_erase` 같은 **의미 어긋난 supersession** 표기.  
7. region intent 가이드에 적힌 도구가 예전에 **미노출** → pin 땜질.  
8. 활동 로그: **preview(`npm start`)는 디스크 미러 없음** (dev 미들웨어 전용). remote fallback만.

### P2 — 스케일

9. 툴 description이 한 줄에 정책 소설 수준 → 토큰·모순 증가.  
10. 상한 40 + 전역 pin → region이 아닌 채팅도 pin 비대화의 피해자.

---

## 9. 정리 방향 (제안 — 아직 미구현)

리뷰 후 골라 가면 됨.

### A. “정준 라우트” 단일 테이블 (추천)

```ts
// 의사코드
CANONICAL_ROUTES = [
  { match: /박스|나무상자/, tool: "place_props", args: { propVocabId: WOOD_BOX } },
  { match: /보물상자|상자를 열/, tool: "place_chest", ... },
  { match: /원형.*호수|둥근.*호수/, tool: "fill_region", args: { shape: "circle", ... } },
]
```

- region 메시지 생성·스킬·테스트 코퍼스가 **같은 표**를 import  
- description에는 “상세”만, 라우팅 진실은 표

### B. 노출 정책 단순화

- region 채널 전용 `toOpenAiTools({ domains, pinProfile: "region" })`  
- 전역 pin 비대화 중단  
- 또는 domain별 페어 슬라이스 (주석에 이미 “별도 과제”)

### C. vocab 노출

- `small-props` 라벨을 “잡소품(잔여)”로 바꾸고  
- wood-box/fruit-box/bench를 **항상** 상위 N에 고정 (부분 적용됨)

### D. 문서/카탈로그

- `docs/tool-catalog.md` = 스키마 덤프 (유지)  
- 이 문서 = 정책 지도 (유지)  
- 변경 시 description 고치면 카탈로그 재생성 스크립트 돌리기

### E. 관측

- preview에서도 activity mirror 가능하게, 또는 “로그 복사”만으로 충분한지 UX 정리

---

## 10. 검증·로그 보는 법

```bash
# 원격 활동 목록 (ai_activity_logs 없으면 ai_analysis_runs 폴백)
node scripts/list-ai-activity.mjs 20

# 헤드리스 툴 목록
node scripts/rpgzzu-tools.mjs --list

# 관련 단위 테스트
npx vitest run test/regionIntentRouter.test.ts test/regionAiPlacementHarness.test.ts test/regionIntentExposure.test.ts --configLoader runner
```

브라우저(dev):

- `window.__rpgzzuAiActivityLog`  
- `window.__rpgzzuListAiActivityLogs()`

영역 팝오버 헤더 **「로그」** → JSON 클립보드.

---

## 11. 파일 내비 (수정 시)

| 바꾸고 싶은 것 | 어디 |
| --- | --- |
| 새 툴 등록 | `*Tools.ts` 배열 + 레지스트리 import |
| LLM에 안 보이게 | `deprecated: true` 또는 supersession 맵 |
| 도메인 태깅 | `withDomain` / `NAME_DOMAIN_OVERRIDES` |
| 항상 노출 보장 | `PINNED_TOOLS_BY_DOMAIN` (전역 부작용 주의) |
| 채팅 의도→도메인 | `INTENT_KEYWORDS` |
| 영역 가이드 문장 | `regionIntentRouter.ts` + `buildRegionTaskMessage` |
| 소품 그룹 id | `combinedTownGroups.ts` + harness ensure |
| 박스/상자 정책 | `runRegionTask.ts` (`REGION_PROP_VOCAB`), `place_props`/`place_chest` description |

---

## 12. 결론 (리뷰어용)

현재 툴콜링은 “툴 개수가 많다”기보다:

> **3세대 시공 스택 + 이중 키워드 시스템 + 40캡 핀 경합 + 채널별 프롬프트**  
> 가 겹친 **정책 분산 시스템**이다.

그래서 모델이 틀린 게 아니라, **시스템이 “그럴듯한 잘못된 툴콜”을 더 잘 보이게 만들어 둔 상태**에 가깝다.  
박스 사고는 그 구조의 전형적인 증상이다, 같은 유형이 길/집/상자/소품에서 반복될 수 있다.

권장 다음 스텝: **§9-A 정준 라우트 표**를 최소 구현(박스·호수·보물상자 3종)하고, 코퍼스 테스트로 고정.

---

### 변경 이력

| 날짜 | 내용 |
| --- | --- |
| 2026-07-10 | 초안. 박스/wood-box 사고·pin/상한·이중 키워드·v1–v3 체인 반영. |
| 2026-07-10 | **스택 단순화 1차:** 구 v2 배치 래퍼(`tile_paint` 등) 레지스트리 제거. `place_props`→`runScatterObject` 엔진 직호출. `toolArgCoerce.ts` 공용화. `tile_query`만 조회 정공법으로 승격. 툴 브라우저는 `activeTools()` 도메인 묶음(deprecated 숨김). 레거시 v1 이름은 getTool 호환용으로만 유지. |
