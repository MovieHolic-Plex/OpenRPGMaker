# RPG ZZU Development Ontology Design

## 목적

RPG ZZU의 온톨로지는 사람이 읽는 용어집만이 아니라, 기능 개발을 돕는 기계 판독 가능한 지식 모델이다. AI와 개발자는 이 모델을 통해 프로젝트의 기능 영역, 데이터 엔티티, 참조 관계, UI/런타임/저장소 표면, 테스트 책임을 빠르게 찾을 수 있어야 한다.

1차 목적은 **RPG Maker 기능 개발 보조**다. 새 기능을 추가하거나 기존 기능을 수정할 때 "어떤 타입, UI, 런타임, 저장 검증, 테스트를 함께 봐야 하는가?"를 답하는 개발 지도 역할을 한다.

2차 목적은 프로젝트 데이터의 검증, 검색, 문서화다. 온톨로지에서 정의한 관계와 계약을 사용해 깨진 참조를 찾고, 기능별 영향 범위를 검색하고, 사람이 읽는 문서를 생성한다.

## 비목표

- RDF/OWL 그래프 DB를 첫 단계에서 도입하지 않는다.
- 모든 프로젝트 데이터를 별도 저장소에 복제하지 않는다.
- 기존 TypeScript 타입 시스템을 대체하지 않는다.
- hook/CI 강제는 첫 산출물이 아니다. 온톨로지 원본과 문서/질의 도구가 안정된 뒤 붙인다.

## 권장 형태

온톨로지의 원본은 TypeScript 데이터 모델이다.

```text
src/project/ontology/
  developmentOntology.ts   # 기능 개발 지도의 source of truth
  ontologyTypes.ts         # Capability, Entity, Relation, Surface, Contract 타입
  ontologyQuery.ts         # 기능/엔티티/파일/테스트 질의
  projectGraph.ts          # 실제 Project 데이터에서 참조 그래프 추출
  validationRules.ts       # 온톨로지 기반 검증 규칙
  ontologyDocs.ts          # Markdown 문서 생성

docs/ontology/
  development-ontology.md  # 생성된 사람용 문서

scripts/
  ontology-query.mjs       # AI/개발자가 쓰는 CLI 질의
  ontology-check.mjs       # 검증 리포트, 이후 hook/CI 연결 가능
```

문서는 온톨로지의 출력물이다. JSON은 CLI, AI, 외부 도구를 위한 export 포맷이다. hook은 온톨로지를 사용하는 실행 장치이며, 온톨로지 자체가 아니다.

## 핵심 모델

### Capability

Capability는 RPG ZZU의 기능 개발 단위다. 새 기능을 추가할 때 가장 먼저 찾는 축이다.

초기 Capability는 다음 7개로 시작한다.

- `MapEditing`: 맵 캔버스, 타일 배치, 레이어, 맵 트리, 시작 위치.
- `EventAuthoring`: 이벤트 페이지, 조건, 그래픽, 이벤트 명령 작성 UI.
- `TilesetSemantics`: 타일셋 메타데이터, 타일 그룹, 통행, 지형 태그, AI 타일 의미.
- `DatabaseRecords`: 액터, 직업, 스킬, 아이템, 장비, 적, 부대, 상태, 애니메이션.
- `BattleRuntime`: 전투 처리, 적/부대, 보상, 애니메이션, 전투 이벤트.
- `ResourcePipeline`: bundled/uploaded 리소스, ResourceProfile, 선택 UI, Phaser 로딩.
- `ProjectPersistence`: 프로젝트 저장/로드, 마이그레이션, shape/guard/reference validation, LegacyDb sync.

Capability는 아래 정보를 가진다.

```typescript
type Capability = {
  id: string;
  label: string;
  purpose: string;
  entities: string[];
  sourceFiles: string[];
  uiSurfaces: string[];
  runtimeSurfaces: string[];
  storageSurfaces: string[];
  testSurfaces: string[];
  commonTasks: DevelopmentRecipe[];
  contracts: string[];
};

type DevelopmentRecipe = {
  id: string;
  label: string;
  taskAliases: string[];
  checkSurfaces: string[];
  implementationOrder: string[];
  requiredTests: string[];
};
```

### Entity

Entity는 프로젝트 의미 단위다. 기존 타입과 1:1로 대응할 수도 있고, 여러 타입을 묶는 개념일 수도 있다.

초기 Entity는 다음을 포함한다.

- `Project`
- `GameMap`
- `MapTreeNode`
- `TilesetDef`
- `Tile`
- `TileAiMetadata`
- `TileGroupMetadata`
- `TerrainTemplateMetadata`
- `GameEvent`
- `EventPage`
- `Command`
- `CommonEvent`
- `SwitchDef`
- `VariableDef`
- `ResourceProfile`
- `AssetRef`
- `UploadedAsset`
- `ActorRecord`
- `SkillRecord`
- `ItemRecord`
- `EquipmentRecord`
- `EnemyRecord`
- `TroopRecord`
- `StateRecord`
- `BattleAnimationRecord`
- `ProjectSession`
- `SaveSlot`

Entity는 아래 정보를 가진다.

```typescript
type OntologyEntity = {
  id: string;
  label: string;
  description: string;
  typeFiles: string[];
  ownerCapabilityIds: string[];
  relationIds: string[];
  validationRuleIds: string[];
};
```

### Relation

Relation은 데이터 참조와 기능 의존을 표현한다.

초기 Relation은 다음을 포함한다.

- `Project contains GameMap`
- `Project contains TilesetDef`
- `Project contains DatabaseRecords`
- `GameMap uses TilesetDef`
- `GameMap contains GameEvent`
- `GameEvent has EventPage`
- `EventPage contains Command`
- `Command references GameMap`
- `Command references ResourceProfile`
- `Command reads SwitchDef`
- `Command writes SwitchDef`
- `Command reads VariableDef`
- `Command writes VariableDef`
- `ItemRecord invokes SkillRecord`
- `SkillRecord toggles SwitchDef`
- `EnemyRecord uses SkillRecord`
- `TroopRecord contains EnemyRecord`
- `TilesetDef contains TileAiMetadata`
- `TilesetDef contains TileGroupMetadata`
- `TileGroupMetadata groups Tile`
- `ResourceProfile describes AssetRef`

Relation은 방향성을 가진다. "A가 B를 참조한다"와 "B가 A에게 참조된다"를 모두 질의할 수 있어야 한다.

Relation은 아래 정보를 가진다.

```typescript
type OntologyRelation = {
  id: string;
  label: string;
  fromEntityId: string;
  toEntityId: string;
  kind: "contains" | "dependsOn" | "reads" | "references" | "uses" | "writes";
  sourceFiles: string[];
  reverseLabel: string;
};
```

### Surface

Surface는 기능 변경 시 확인해야 하는 코드 표면이다.

- `type`: TypeScript 타입과 도메인 모델.
- `ui`: DOM 패널, 모달, picker, toolbar.
- `runtime`: 플레이어, 인터프리터, 전투, 이동, 렌더링.
- `storage`: io shape, guards, migration, reference validation, sync.
- `tests`: unit/e2e/manual QA surface.
- `docs`: 설계 문서와 생성 문서.

AI는 Capability에서 Surface를 따라가며 변경 범위를 잡는다.

### Contract

Contract는 깨지면 안 되는 규칙이다.

초기 Contract 예시는 다음과 같다.

- 모든 `GameMap.tilesetId`는 존재하는 `TilesetDef.id`를 가리켜야 한다.
- `GameMap.lowerTiles`와 `GameMap.upperTiles`의 길이는 `width * height`와 일치해야 한다.
- `TilesetDef.passability`, `priority`, `terrain`의 길이는 `count`와 일치해야 한다.
- `TileGroupMetadata.tileIds`는 `TilesetDef.count` 범위 안에 있어야 한다.
- `Command.kind = "transfer"`의 `mapId`는 존재해야 한다.
- `Command.kind = "playAudio"`와 리소스 표시 명령은 존재하는 resource id를 참조해야 한다.
- `Command`가 참조하는 switch, variable, item, actor, skill, troop, common event는 프로젝트 안에 존재해야 한다.
- `ItemRecord.skillId`, `EquipmentRecord.skillId`, `EnemyRecord.skillIds`, `TroopRecord.enemyIds`는 존재하는 레코드를 가리켜야 한다.
- bundled resource는 삭제 가능 대상으로 취급하지 않는다.

Contract는 아래 정보를 가진다.

```typescript
type OntologyContract = {
  id: string;
  label: string;
  description: string;
  capabilityIds: string[];
  entityIds: string[];
  severity: "error" | "warning" | "info";
  validationRuleId?: string;
};
```

## 개발 시나리오

### 새 이벤트 명령 추가

AI는 `EventAuthoring` Capability를 조회한다.

반환되어야 하는 표면:

- 타입: `src/project/types/events.ts`
- UI: event editor command picker/body/summary files
- 런타임: interpreter command handlers
- 저장: command shape/guard/reference validation
- 테스트: event editor, interpreter, e2e event command specs
- 문서: command catalog 또는 ontology generated docs

온톨로지는 "명령 타입만 추가하고 UI/런타임/저장을 빼먹는" 실수를 줄인다.

### 새 리소스 종류 추가

AI는 `ResourcePipeline` Capability를 조회한다.

반환되어야 하는 표면:

- 타입: `ResourceKind`, `ResourceProfile`, `UploadedAsset`
- UI: resource manager, picker dialogs
- 런타임: Phaser loading and missing-resource display
- 저장: resource shape/reference validation
- 테스트: resource manager, generated asset resolver, missing resource e2e

### 타일 의미 분류 개선

AI는 `TilesetSemantics` Capability를 조회한다.

반환되어야 하는 표면:

- 타입: `TilesetDef`, `TileAiMetadata`, `TileGroupMetadata`, `TerrainTemplateMetadata`
- UI: tileset metadata editor, tileset AI setup, terrain template panel
- 런타임: passability, priority, terrain tag consumers
- 저장: tileset guards, migration, reference validation
- 테스트: tile metadata, tile palette, terrain template, map editor e2e

## 질의 인터페이스

초기 CLI는 단순한 질의를 지원한다.

```text
npm run ontology:query capability EventAuthoring
npm run ontology:query entity Command
npm run ontology:query file src/project/types/events.ts
npm run ontology:query task "add event command"
npm run ontology:check
```

질의 결과는 Markdown과 JSON을 모두 지원한다.

AI에게는 JSON이 유리하고, 개발자에게는 Markdown 요약이 유리하다.

## 단계별 구현

### 1단계: 개발 지도 원본

- `ontologyTypes.ts`를 만든다.
- `developmentOntology.ts`에 Capability, Entity, Relation, Contract seed를 정의한다.
- `ontologyQuery.ts`로 capability/entity/file/task 질의를 지원한다.
- 생성 문서 `docs/ontology/development-ontology.md`를 만든다.

성공 기준:

- "새 이벤트 명령 추가" 질의가 타입/UI/런타임/저장/테스트 표면을 반환한다.
- "타일셋 의미 개선" 질의가 tileset 관련 표면을 반환한다.
- 문서가 원본 데이터에서 생성된다.

1단계가 완료되면 새 기능 개발을 시작할 수 있다. 전체 온톨로지를 완성할 때까지 기능 개발을 멈추지 않는다. 대신 새 기능은 해당 Capability, Entity, Relation, Contract를 함께 갱신하는 방식으로 진행한다.

### 2단계: 프로젝트 데이터 그래프

- 실제 `Project` 객체를 스캔해 맵, 이벤트, 명령, 리소스, DB 레코드 참조 그래프를 만든다.
- reverse reference 질의를 지원한다.

성공 기준:

- 특정 map/resource/switch/skill id를 참조하는 이벤트와 레코드를 찾을 수 있다.
- 삭제 또는 이름 변경 전 영향 범위를 리포트할 수 있다.

### 3단계: 검증 규칙

- Contract를 실행 가능한 validation rule로 연결한다.
- 기존 io/reference validation과 중복되는 규칙은 재사용한다.

성공 기준:

- 깨진 참조, 길이 불일치, 누락 레코드가 `ontology:check`에서 보고된다.
- 검증 결과가 Capability/Entity/Relation id와 함께 표시된다.

### 4단계: hook/CI 연결

- `ontology-check.mjs`를 pre-commit, CI, 또는 Codex 작업 후 검증에 연결할 수 있게 한다.
- 첫 연결은 advisory 모드로 시작한다.

성공 기준:

- 관련 파일 변경 시 영향 Capability를 알려준다.
- 실패를 막기보다 "확인할 표면"을 먼저 제안한다.

## 생명주기와 버전 관리

온톨로지는 고정 문서가 아니라 기능 개발과 함께 변하는 living model이다. 프로젝트가 새로운 RPG Maker 기능을 얻으면 온톨로지도 같은 변경의 일부로 갱신되어야 한다.

변경 원칙:

- 새 기능을 추가할 때 관련 Capability가 없으면 먼저 추가한다.
- 기존 Capability 안에서 해결되는 기능이면 Entity, Relation, Surface, Contract, DevelopmentRecipe만 보강한다.
- 타입 또는 저장 구조가 바뀌면 온톨로지의 Entity와 Contract를 함께 바꾼다.
- UI 또는 런타임 표면이 새로 생기면 해당 Capability의 Surface에 추가한다.
- 테스트가 추가되면 `testSurfaces` 또는 `requiredTests`에 반영한다.
- 문서는 직접 고치지 않고 온톨로지 원본에서 다시 생성한다.

버전 관리:

```typescript
type OntologyMetadata = {
  schemaVersion: number;
  updatedAt: string;
  projectSchemaVersion: number;
  notes: string[];
};
```

`schemaVersion`은 온톨로지 모델 자체의 구조가 바뀔 때 올린다. `projectSchemaVersion`은 RPG ZZU 프로젝트 저장 포맷의 `SCHEMA_VERSION`과 연결한다. Capability나 Relation의 일반 보강은 별도 마이그레이션 없이 데이터 변경으로 처리한다.

기능 개발 흐름:

```text
1. ontology:query task "<하려는 기능>"
2. 관련 Capability/Surface 확인
3. 기능 구현
4. 새 타입/관계/검증/테스트가 생겼으면 ontology 갱신
5. ontology docs 재생성
6. ontology:check와 관련 테스트 실행
```

주기적 정리:

- 큰 기능 묶음이 끝날 때 온톨로지 drift review를 실행한다.
- drift review는 코드에 생긴 새 타입, 새 이벤트 명령, 새 리소스 종류, 새 테스트가 온톨로지에 누락되지 않았는지 확인한다.
- hook/CI 도입 전까지는 수동 명령으로 운영하고, 안정화 후 advisory hook으로 전환한다.

## 설계 원칙

- Source of truth는 하나다. 문서와 JSON은 생성물이다.
- 온톨로지는 기존 타입을 대체하지 않고 연결한다.
- 기능 개발 경로가 데이터 정합성보다 우선이다. 검증은 기능 지도의 자연스러운 파생물이다.
- 모든 항목은 안정적인 id를 가진다.
- 새 Capability는 구체적인 개발 질문에 답할 수 있을 때만 추가한다.
- 초기 범위는 7개 Capability로 제한한다.
- 온톨로지 갱신은 기능 변경의 일부로 취급한다.

## 사용자 리뷰 포인트

검토해야 할 결정은 세 가지다.

- 초기 Capability 7개가 충분한가?
- 첫 산출물을 개발 지도와 생성 문서로 두는 것이 맞는가?
- hook/CI 연결을 4단계로 미루는 것이 맞는가?
- 기능 개발마다 온톨로지를 함께 갱신하는 living model 방식이 맞는가?
