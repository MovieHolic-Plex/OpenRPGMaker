# LLM Blueprint 계획 (사용자 요청 → 청사진 → 시공)

> **Status:** 구현 완료 (기록용). 현행 문서는 `openwiki/large-village-generation.md` 및 `docs/README.md` 참조.

> 목적: LLM이 **타일을 직접 찍지 않고**, 사용자 말을 듣고 **블루프린트(중간 표현)** 를 그린 뒤, 코드 시공기가 맵을 만든다.  
> 관련: `docs/village-plan-architecture-easy.md`, `villageRequirements` / `plan_village` / `run_village_pipeline`.

---

## 1. 왜 “LLM이 타일을 놓게” 하면 안 되나 (짧은 배경)

웹·논문·실무에서 반복되는 결론:

| 방식 | 잘함 | 못함 |
|------|------|------|
| LLM이 그리드/타일 id를 직접 생성 | 분위기·스토리 | 연결성, 통행, 오토타일, 재현성 |
| LLM → **중간 표현(IR)** → 솔버/시공 | 의도·다양성 | (IR 설계 품질에 의존) |
| 고전 PCG(WFC, CSP)만 | 로컬 문법 | “강촌 마을 만들어” 자연어 이해 |

참고 방법론(검색 요약):

1. **Plan-and-Solve / Plan-and-Execute**  
   - 먼저 계획, 그다음 실행.  
   - https://arxiv.org/abs/2305.04091  
   - LangChain Plan-and-Execute: https://www.langchain.com/blog/planning-agents  

2. **Agentic PCG (tool-using LLM)**  
   - 원샷 레벨 덤프 대신 Perceive → Plan → Edit 루프, PCG 알고리즘을 **툴**로 호출.  
   - https://zehua-jiang.github.io/AgenticPCG/  

3. **Hierarchical / Semantic layout → tile resolve**  
   - 상위: 의미 구역(강, 마을, 숲). 하위: WFC·오토타일·키트.  
   - Hierarchical Semantic WFC (FDG 2023): https://dl.acm.org/doi/10.1145/3582437.3587209  
   - WFC: https://github.com/mxgmn/WaveFunctionCollapse  

4. **Constraint satisfaction (제약 만족)**  
   - “강은 서쪽, 집은 물 위 금지, 길은 연결”을 **제약**으로 두고 솔버가 채움.  
   - WFC is CSP: https://adamsmith.as/papers/wfc_is_constraint_solving_in_the_wild.pdf  

5. **LLM + 코드/스크립트 IR**  
   - 텍스트 → 실행 가능 스크립트/레이아웃 JSON (SceneCraft 계열 등).  
   - 타일 배열이 아니라 **프로그램·구역 그래프**를 생성.  

6. **PCG+LLM 서베이**  
   - https://arxiv.org/html/2410.15644v1  

**우리 포지션:**  
`사용자 말 → LLM Blueprint(IR) → 코드 시공(+ 상식 스펙·게이트)`  
= Plan-and-Execute + Hierarchical semantic layout + 기존 툴 시공.

---

## 2. Blueprint가 뭐인가

블루프린트 = **맵 타일이 아닌**, 사람이 읽고 LLM이 쓰기 쉬운 **중간 설계 문서**.

### 2.1 레이어 (위에서 아래로)

```text
L0  Intent        사용자 요청 한 줄 + 분위기 키워드
L1  Requirements  상식 계약: 강 있어야 함, 숲 있어야 함…  (코드도 보조 추출)
L2  Regions       구역 배치: river@west, village@center-east, forest@east
L3  Structures    광장, 길 네트워크 스케치, 집 슬롯(대략 위치·키트·마당)
L4  Atmosphere    pathStyle, roadWidth, settlementLayout, NPC 톤
L5  (시공 전용)   타일 id, 오토타일, 문 좌표 — LLM 금지, 코드만
```

### 2.2 스키마 초안 (`VillageBlueprint` v1)

```ts
type VillageBlueprint = {
  version: 1;
  sourceQuery: string;           // "강촌마을 만들어줘"
  intent: {
    theme: string;               // "강촌"
    mood?: string;               // "한적한", "북적이는"
    size?: "small" | "medium" | "large";
  };
  requirements: {
    landmarks: ("river"|"lake"|"forest"|"market"|"harbor"|"farm")[];
    mustExist: string[];         // 사람/게이트용 문장
  };
  // 맵을 상대 좌표 0~1 또는 대략 쪽(side)으로 나눔 — 픽셀/타일 id 금지
  regions: Array<{
    id: string;
    role: "river" | "lake" | "village" | "forest" | "market" | "road" | "farm";
    // 둘 중 하나 이상
    side?: "N"|"S"|"E"|"W"|"center";
    // 정규화 박스 (0~1). 시공기가 맵 크기에 투영
    normRect?: { x: number; y: number; w: number; h: number };
    notes?: string;
  }>;
  settlement: {
    layout: "plaza-ring" | "street-grid" | "clusters" | "riverside";
    plaza?: { side?: string; style: "market"|"garden"|"empty" };
    road: { style: "sand"|"dirt"; width: 2|3; naturalness?: number };
    houses: Array<{
      id: string;
      kitId: "blue-stone"|"bright-plaster"; // 이후 키트 확장
      yard: string[];
      // 선택: 어느 region 안 / 상대 슬롯
      inRegion?: string;
      approx?: { u: number; v: number }; // 0~1
    }>;
  };
  npcs: Array<{ name: string; lines: string[]; near?: string }>;
  openQuestions?: string[];      // LLM이 확정 못 한 것 (사용자에게 1문장)
  rationale?: string;            // 왜 이런 배치인지 한 줄
};
```

**금지:** `tileId`, 칩셋 번호, lower/upper 직접 지정, 오토타일 변 타일.

---

## 3. 엔드투엔드 플로우

```text
[사용자] "강촌마을 만들어줘. 좀 한적하게."
        │
        ▼
┌───────────────────────────────────────┐
│  Step A — LLM: Blueprint 작성          │
│  입력: 쿼리, 맵 크기, 가능 랜드마크 목록  │
│  출력: VillageBlueprint JSON           │
│  (툴: draft_village_blueprint)         │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Step B — 코드: 정규화 + 상식 병합       │
│  · inferRequirementsFromQuery 보강     │
│  · 강촌이면 river+forest 강제          │
│  · normRect 클램프, 겹침 완화          │
│  · VillagePlan + BuildSpec 파생        │
│  (툴: commit_blueprint / plan_village) │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Step C — (옵션) 사용자/UI 미리보기     │
│  · 구역 색칠 스케치 (타일 아님)         │
│  · "강 서쪽, 마을 중앙, 숲 동쪽" 텍스트  │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Step D — 코드: 시공                   │
│  regions → fill_region / place_props   │
│  settlement → build_village 확장       │
│  또는 구역별 시공 툴 체인               │
└───────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────┐
│  Step E — 게이트                       │
│  · requirementsMet (강/숲 존재)        │
│  · critique (도달)                     │
│  · (나중) 비전 LLM 미학                 │
└───────────────────────────────────────┘
        │ 실패
        ▼
┌───────────────────────────────────────┐
│  Step F — 피드백 루프                  │
│  feedbackForLlm → LLM이 Blueprint 패치  │
│  또는 코드 revise → 재시공 (max 2)     │
└───────────────────────────────────────┘
```

---

## 4. LLM이 타일을 놓게 하는 방법론 vs 우리가 택할 것

### 방법 A — 직접 그리드 생성 (비권장)
- 프롬프트: “50×50 타일 문자를 출력해”  
- 실패 모드: 문 없음, 물 위 집, 연결 안 됨, 토큰 폭발  
- **채택 안 함**

### 방법 B — 타일 단위 tool calling (부분 허용)
- `paint_tiles({x,y,tile})` 를 LLM이 수백 번  
- 느리고 thrash, 오토타일 붕괴  
- **소량 수정(장식 1~2개)만** 허용 가능

### 방법 C — Blueprint IR + 시공 툴 (권장)
- LLM → regions/houses/NPC  
- 코드 → fill_region, paint_road, house kit, fence  
- **채택: 메인 경로**

### 방법 D — LLM이 “시공 스크립트” 생성
- LLM이 `run_village_pipeline({...})` 인자 JSON만 생성  
- 사실상 C의 약한 형태 (이미 plan 필드)  
- Blueprint가 더 풍부한 구역 그래프를 주면 C로 승격

### 방법 E — LLM + WFC 제약 주입 (하이브리드로 채택)
- LLM/Blueprint → **제약 마스크** (water / forest / buildable)
- 지금 솔버 = `fill_region` + `place_props` (오토타일)
- 나중 솔버 = 동일 마스크에 WFC만 교체 (`applyTerrainPassFromMasks`)
- **전 맵 WFC 아님** — 집·길·문은 기존 키트/ paint_road 유지

구현: `src/editor/tools/villageTerrainPass.ts`  
`buildTerrainConstraintMasks` → `applyTerrainPassFromMasks` / `runTerrainConstraintPass`

---

## 부록: E 하이브리드 (현재 채택)

```text
query / Blueprint regions
        │
        ▼
  constraint masks   water | forest | buildable | blocked
        │
        ├─ buildable  → 집·광장·길 시공 (C)
        └─ water/forest → terrain pass (E, 지금은 fill/props)
        │
        ▼
  requirementsMet 게이트 (강·숲 칸 수)
```

| 레이어 | 엔진 |
|--------|------|
| 의도·구역 | LLM Blueprint / requirements 코드 추출 |
| 지형 마스크 | `buildTerrainConstraintMasks` |
| 물·숲 채우기 | fill_region / place_props → (나중 WFC) |
| 마을 구조 | house kit, 넓은 길, 울타리 |
| 검증 | evaluate_village_look.requirementsMet |

---

## 5. 툴 설계 (구현 단계별)

### Phase 1 — Blueprint 초안 (1~2일)
| 툴 | 모드 | 역할 |
|----|------|------|
| `draft_village_blueprint` | write(메타만) 또는 read+validate | 입력 query → 검증된 Blueprint JSON (맵 불변) |
| 기존 `plan_village` | write | Blueprint → 현재 VillagePlan으로 컴파일 |

컴파일 규칙:
- `requirements` ← LLM 제안 ∪ `inferRequirementsFromQuery` (**합집합, 상식 쪽 삭제 불가**)
- `regions` → `riverSide` / build area reserve / landmark 시공
- `settlement` → 기존 `build_village` intent

### Phase 2 — 구역 시공 연결
- `regions`의 normRect를 맵 좌표로 투영
- 강/숲/마을 순서로 시공 (buildOrder)
- 길 폭·광장 면 포장·settlementLayout 이미 있는 코드 활용

### Phase 3 — Blueprint 미리보기 UI
- 에디터에 반투명 구역 오버레이 (색: 강=파랑, 숲=녹, 마을=갈)
- “이 청사진으로 시공” 버튼 → pipeline

### Phase 4 — LLM 비전 게이트
- 시공 후 `show_map_region` 전체 썸네일
- 멀티모달: “requirements 충족? 레이아웃 단조로움?” → Blueprint 패치 JSON

---

## 6. 프롬프트 계약 (LLM용 짧은 스펙)

```text
당신은 타일을 찍지 않는다. VillageBlueprint JSON만 작성한다.
- sourceQuery를 반영하라.
- requirements.landmarks는 상식에 맞게 (강촌→river+forest). 빼지 마라.
- regions로 맵을 나눠라. 겹치면 village가 물 위에 올라가지 않게.
- houses는 4~12, kitId와 yard 태그만. 좌표는 approx 0~1 또는 inRegion.
- tile id, lower/upper, 오토타일 금지.
- rationale에 배치 이유를 한 줄.
```

코드가 하는 일:
```text
- 상식 랜드마크 강제 병합
- normRect → 정수 타일 rect
- 물 위 집 슬롯 제거
- build_village / landmarks 시공
- requirementsMet 게이트
```

---

## 7. 다양성이 Blueprint에서 나오는 방식

| 단조로웠던 것 | Blueprint 필드 |
|---------------|----------------|
| 항상 광장 위·아래 집 | `settlement.layout`, `houses[].inRegion` |
| 길 1칸 | `road.width` 2\|3 |
| 광장 빈 링 | 시공 코드(면 포장) + `plaza.style` |
| 강 없는 “강촌” | `requirements` 강제 + 게이트 |
| 전부 비슷 | LLM이 regions/layout/rationale를 쿼리마다 다르게 |

LLM 역할 = **구역 이야기와 슬롯 캐스팅**  
코드 역할 = **법규·시공·검사**

---

## 8. 실패 시 피드백 (Blueprint 루프)

```text
evaluate 실패
  → feedbackForLlm + missing: ["river"]
  → LLM: Blueprint.regions에 river 보강 / forest denser
  → 코드: commit_blueprint → 재시공
  → max 2회
```

구조 실패(도달)와 스펙 실패(강 없음)를 구분해 재진입:
- 스펙 실패 → regions/requirements 쪽 패치
- 도달 실패 → road/house 슬롯만 패치

---

## 9. 우리 코드베이스와의 매핑 (현재 → 목표)

| 현재 | 목표 Blueprint 단계 |
|------|---------------------|
| `inferRequirementsFromQuery` | L1 코드 보조 (유지·강화) |
| `plan_village` / VillagePlan | L3~L4의 **컴파일 결과** |
| `villageLandmarks` | L2 regions 시공 |
| `build_village` | L3 settlement 시공 |
| `evaluate_village_look` | Step E 게이트 |
| `run_village_pipeline` | Step B~F 오케스트레이션 |
| (없음) | **`draft_village_blueprint` LLM 진입점** |

---

## 10. 구현 로드맵 (실행 가능한 순서)

### P0 — 문서·계약 (이 문서)
- [x] 방법론 조사 요약
- [x] Blueprint 스키마 초안
- [x] 플로우·LLM/코드 경계

### P1 — `draft_village_blueprint` + 컴파일
1. 타입 `VillageBlueprint` + `normalizeBlueprint`
2. 툴: 입력 query → 정규화 Blueprint (맵 불변)
3. `blueprintToVillagePlan` → 기존 plan/pipeline 연결
4. 테스트: "강촌마을" → regions에 river·forest·village 포함

### P2 — 시공이 regions를 존중
1. normRect/side → 실제 rect
2. 강/숲/마을 순서 시공
3. 게이트 requirementsMet 유지

### P3 — 다양성·미리보기
1. layout/roadWidth를 Blueprint에서 필수화
2. UI 구역 스케치
3. (옵션) 비전 게이트

### P4 — 에이전트 프롬프트
1. “타일 금지, Blueprint만”
2. run_village_pipeline 인자 대신 draft_blueprint 우선

---

## 11. 성공 기준

1. 「강촌마을」요청 시 Blueprint에 강·숲·주거가 **문서화**되고, 시공 맵에 **실재**.  
2. LLM 출력에 타일 id가 없어도 마을이 완성.  
3. seed/쿼리가 다르면 layout·regions가 달라 보임 (폭 2+ 길, 광장 면 포장 포함).  
4. 게이트 실패 시 Blueprint 패치로 재시도 가능 (max 2).  

---

## 12. 한 줄 요약

> **LLM은 지도를 그리지 않고 청사진(구역·역할·집 슬롯·분위기)을 그린다.  
> 타일을 놓는 방법론의 정석은 ‘직접 생성’이 아니라 ‘IR + 제약 시공’이다.**
