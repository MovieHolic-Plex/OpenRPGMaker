# RPG 메이커 — RM2K3 도구 세트 전면 개편 설계

- **날짜**: 2026-06-18
- **상태**: 설계 작성 → 사용자 리뷰 게이트 → 구현 계획 → 구현 진행
- **대상**: 기 구현된 RPG 메이커 MVP의 UI/UX + 도구 세트 전면 재설계
- **기준**: RPG메이커 2003(RM2K3)의 도구 세트를 현대적 웹 UI로 재구성
- **선행 스펙**: `2026-06-18-rpg-maker-mvp-design.md`, `2026-06-18-visual-polish-design.md`

---

## 1. 목표와 범위

### 1.1 핵심 문제
현재 MVP는 "맵 그리기(단일 레이어) + 기본 이벤트(text/choices/setFlag/transfer/wait) + 평면 맵 목록 + 고정 내장 에셋"에 불과하다. RM2K3 대비 **도구 자체가 빠져 있다**:
- 맵 에디터: 단일 레이어만(RM2K3는 Lower/Upper/Event 3레이어), Map Tree(맵 계층) 없음
- Database: 아예 없음(Switches/Variables/Common Events/Tilesets/Terms 부재)
- Event Editor: 5개 명령만(RM2K3는 변수연산/fork 조건/move event/타이머/입력 등 풍부)
- Resource Manager: 없음(고정 내장 에셋만, 임포트 불가)

### 1.2 목표 (D 범위)
RM2K3 도구 풀셋을 한 스펙에 묶어 구현한다. 단, **전투-종속적 Database는 명시적 비목표**로 제외한다(전투 시스템 스펙과 함께 미래 추가).

1. **맵 에디터 완성형**: 3레이어(Lower/Upper/Event) + chipset 패널 분리 + Map Tree(부모-자식 맵 계층).
2. **Database**: Switches / Variables / Common Events / Tilesets / Terms (전투-독립적 항목).
3. **Event Editor 강화**: 변수 연산 / fork 조건 / move event / 타이머 / 입력 대기 / 타일 변경 / 공통 이벤트 호출 등 RM2K3 핵심 명령.
4. **Resource Manager**: 타일셋/스프라이트 에셋 임포트. 내장 에셋은 기본 제공.
5. **패널 유연 레이아웃**: 크기 조절 / 접기 / 풀스크린 캔버스.

### 1.3 명시적 비목표 (이번 스펙 제외)
- **전투 시스템** 및 전투-종속 Database: Actors / Enemies / Items / Skills / Classes / Battle Animations. (전투 스펙과 함께 미래 추가)
- 실행취소(Ctrl+Z) 히스토리 — 별도 스펙. (범위 과다 방지)
- 드래그 영역 복사/이동 — 별도 스펙.
- BGM/사운드 — 오디오는 별도.
- 멀티 유저/백엔드 — 여전히 순수 프런트엔드.

### 1.4 핵심 결정 요약

| 결정 | 선택 | 이유 |
|---|---|---|
| 전체 범위 | **D** (RM2K3 풀셋) | "도구 자체가 없다"는 근본 문제 해결 |
| Database 범위 | **A** (전투-독립적만) | 전투 없는 액터/적 데이터는 빈 껍데기 → YAGNI |
| 맵 레이어 | **3레이어** (Lower/Upper/Event) | RM2K3 정석, 합성/오브젝트 표현의 기본 |
| 맵 구조 | **Map Tree** (부모-자식) | RM2K3 정석, 세계 구조화 |
| 패널 | **유연 레이아웃** | 크기조절/접기로 다양한 화면·작업 대응 |
| 에셋 | **임포트 + 내장 기본** | Resource Manager로 사용자 에셋 추가 |

---

## 2. 데이터 모델 확장

`project/types.ts` 핵심 변경. 기존 타입은 하위 호환(마이그레이션은 io.ts에서 처리).

### 2.1 Project (최상위)
```typescript
interface Project {
  version: number;                  // SCHEMA_VERSION 1 → 2 (마이그레이션)
  meta: { title: string; author: string; terms: Terms };
  assets: AssetSet;                 // 스프라이트 + 임포트 에셋 (타일셋 정의는 최상위 tilesets로 이동)
  tilesets: Record<TilesetId, TilesetDef>;  // Database: 분리된 타일셋 정의 (이미지는 assets 참조)
  switches: SwitchDef[];            // Database: 스위치 (id, name)
  variables: VariableDef[];         // Database: 수치 변수 (id, name)
  commonEvents: CommonEvent[];      // Database: 공통 이벤트 (재사용 이벤트)
  maps: Record<MapId, GameMap>;
  mapTree: MapTreeNode;             // 맵 계층 트리 (루트)
  startMapId: MapId;
  startPos: { x: number; y: number };
  flags: Record<string, boolean>;   // 레거시 호환 → switches로 마이그레이션
}
```

### 2.2 Tileset (Database - 분리)
```typescript
type TilesetId = string;
interface TilesetDef {
  id: TilesetId;
  name: string;
  image: AssetRef;                  // 타일셋 이미지
  tileSize: number;
  // 타일별 속성: 통과 가능 여부(방향별 4비트), 우선순위(upper 레이어 배치용)
  passability: PassFlag[];          // length = 타일 수, 각 타일의 4방향 통과 비트
  priority: ("lower" | "upper")[];  // 각 타일이 lower/upper 어디에 배치되는가
  terrain: number[];                // 지형 태그(예: 물=1, 잔디=0) - RM2K3 정석
}
type PassFlag = { up: boolean; down: boolean; left: boolean; right: boolean };
```

### 2.3 GameMap (3레이어)
```typescript
interface GameMap {
  id: MapId;
  name: string;
  width: number;
  height: number;
  tilesetId: TilesetId;             // 이 맵이 쓰는 타일셋 (chipset 분리)
  tileSize: number;
  lowerTiles: number[];             // Lower 레이어: 지형/벽/바닥 (length = w*h, -1=빈)
  upperTiles: number[];             // Upper 레이어: 나무/오브젝트 (length = w*h, -1=빈)
  events: GameEvent[];              // Event 레이어
  // 레거시 tiles/collisions는 마이그레이션 시 lowerTiles + tileset.passability로 변환
}
```

### 2.4 Map Tree
```typescript
interface MapTreeNode {
  mapId: MapId;
  children: MapTreeNode[];          // 부모-자식 (예: 세계맵 → 마을 → 집)
}
```

### 2.5 Database 정의
```typescript
interface SwitchDef { id: string; name: string; }            // RM2K3 "Switches"
interface VariableDef { id: string; name: string; }          // RM2K3 "Variables"
interface CommonEvent {
  id: string;
  name: string;
  trigger: "none" | "auto" | "parallel";  // 공통 이벤트 발동 조건
  conditionSwitchId?: string;
  commands: Command[];                     // 재사용 이벤트 명령 리스트
}
interface Terms {                                 // RM2K3 "Terms" (UI 텍스트)
  gold: string;           // "G" 등
  // 확장 가능 (레벨업 메시지 등은 전투 스펙에서)
}
```

### 2.6 Event (확장)
```typescript
interface GameEvent {
  id: string;
  x: number; y: number;
  sprite?: AssetRef;
  trigger: Trigger;                 // action/touch/auto/parallel
  condition?: Condition;            // fork: 스위치/변수 기반
  moveRoute?: MoveRoute;            // 자율 이동(옵션)
  commands: Command[];
}
type Condition =
  | { kind: "switch"; switchId: string; value: boolean }
  | { kind: "variable"; variableId: string; op: ">=" | "<=" | "==" | "!="; value: number };

interface MoveRoute {
  moves: MoveCommand[];
  repeat: boolean;
}
type MoveCommand =
  | { kind: "move"; dir: Dir }
  | { kind: "turn"; dir: Dir }
  | { kind: "wait" };
```

### 2.7 Command (RM2K3 핵심 명령 확장)
```typescript
type Command =
  // 메시지
  | { kind: "text"; speaker?: string; body: string }
  | { kind: "choices"; prompt?: string; options: { text: string; branch: Command[] }[] }
  // 흐름 제어
  | { kind: "fork"; condition: Condition; then: Command[]; else?: Command[] }
  | { kind: "wait"; ms: number }
  | { kind: "inputWait"; }                       // 키 입력 대기
  | { kind: "label"; name: string }              // 라벨/이동 (RM2K3 정석)
  | { kind: "gotoLabel"; name: string }
  // 상태 변경
  | { kind: "setSwitch"; switchId: string; value: boolean }
  | { kind: "setVariable"; variableId: string; op: "=" | "+=" | "-=" | "*=" | "/="; value: number | { kind: "var"; id: string } }
  | { kind: "timer"; action: "set" | "start" | "stop"; seconds?: number }
  // 월드 조작
  | { kind: "transfer"; mapId: MapId; x: number; y: number }
  | { kind: "moveEvent"; eventId: string; route: MoveRoute }
  | { kind: "changeTile"; mapId: MapId; layer: "lower" | "upper"; x: number; y: number; tile: number }
  | { kind: "callCommonEvent"; commonEventId: string };
```

### 2.8 AssetSet (임포트 지원)
```typescript
interface AssetRef {
  type: "bundled" | "uploaded";     // "uploaded" 추가
  id: string;
}
interface UploadedAsset {
  id: string;
  name: string;
  kind: "tileset" | "sprite";
  dataUrl: string;                  // base64 (IndexedDB 저장, 파일 의존성 회피)
  meta: { tileSize?: number; frames?: number; };
}
interface AssetSet {
  sprites: Record<string, SpriteDef>;         // 스프라이트 정의
  uploaded: Record<string, UploadedAsset>;    // 임포트 에셋(타일셋 이미지 포함)
}
```
> 참고: 타일셋 *정의*(TilesetDef)는 최상위 `project.tilesets`에, 타일셋 *이미지 데이터*(UploadedAsset)는 `project.assets.uploaded`에 둔다. TilesetDef.image가 이를 AssetRef로 참조.

### 2.9 스키마 버전 마이그레이션
- `version: 1 → 2`.
- io.ts에 `migrateV1toV2(old: ProjectV1): Project` 구현:
  - `tiles` → `lowerTiles` (upperTiles는 전부 -1)
  - `collisions` → 기본 TilesetDef.passability로 변환
  - `flags` → `switches` (각 flag 이름을 switch로)
  - `tileset: AssetRef` (맵 단위) → `tilesetId` (Database TilesetDef 참조)
  - 단일 기본 TilesetDef 생성해서 모든 맵이 참조.

---

## 3. 맵 에디터 (3레이어 + chipset 분리 + Map Tree)

### 3.1 레이어 시스템
- **Lower 레이어**: 지형(잔디/물/벽/바닥). 한 칸에 한 타일.
- **Upper 레이어**: 오브젝트(나무/표지판). Lower 위에 겹침. 빈 칸(-1)이면 Lower가 보임.
- **Event 레이어**: 이벤트 배치. Lower+Upper 합성 위에 표시.
- 툴바 레이어 셀렉터(RM2K3 정석): `[Lower] [Upper] [Event]` 3버튼.
- 충돌: TilesetDef.passability(4방향 비트) 기반. 이동 시 다음 칸의 해당 방향 통과 비트 체크.

### 3.2 chipset 패널 분리
- 현재: 고정 타일팔레트(8종). → 변경: **현재 맵의 tilesetId가 가리키는 TilesetDef**에서 타일 목록 표시.
- Lower 레이어 편집 시 → passability/priority="lower"인 타일 표시.
- Upper 레이어 편집 시 → priority="upper"인 타일 표시.
- Database에서 타일셋 교체 시 맵에 반영.

### 3.3 Map Tree 패널
- 좌측에 트리뷰(RM2K3 정석): 부모-자식으로 맵 표시.
  ```
  🌍 세계맵
    🏠 마을
      ⚒ 대장간
      🏪 상점
    🌲 숲
  ```
- 드래그로 맵 이동(부모 변경). 더블클릭으로 편집 맵 전환. 우클릭 메뉴(추가/삭제/이름변경).
- 현재 평면 mapList 패널을 Map Tree로 대체.

### 3.4 EditScene 렌더 (합성)
- Lower → Upper → Event 순으로 합성 렌더.
- 충돌 오버레이: passability 기반 반투과 표시.
- 레이어 토글: 현재 편집 레이어만 강조, 나머지는 반투과.

---

## 4. Database 패널 (새 패널)

탭형 패널(확장 가능 구조). RM2K3 정석 레이아웃.

### 4.1 탭 구성 (이번 스펙)
```
[Switches] [Variables] [Common Events] [Tilesets] [Terms]
```
(전투 관련 탭 Actors/Enemies/Items/Skills는 전투 스펙에서 추가 — 탭 추가형 설계)

### 4.2 Switches 탭
- 스위치 목록(id, name). 추가/삭제/이름변경/검색.
- RM2K3: 스위치는 전역 불리언. Event의 setSwitch/fork에서 id로 참조.

### 4.3 Variables 탭
- 수치 변수 목록(id, name). 추가/삭제/이름변경/검색.
- Event의 setVariable/fork에서 id로 참조.

### 4.4 Common Events 탭
- 공통 이벤트 목록. 각 항목: name, trigger(none/auto/parallel), conditionSwitchId, commands.
- commands 편집은 Event Editor와 동일 컴포넌트 재사용.
- callCommonEvent 명령으로 맵 이벤트에서 호출.

### 4.5 Tilesets 탭
- 타일셋 목록. 각 항목: name, image(AssetRef), tileSize, 타일별 passability/priority/terrain 편집.
- 타일셋 편집기: 이미지 위에 타일 그리드 오버레이 → 각 타일 클릭으로 passability(4방향) 토글, priority(lower/upper) 선택.
- Resource Manager에서 임포트한 타일셋 이미지를 여기서 TilesetDef로 변환.

### 4.6 Terms 탭
- UI 텍스트(gold 통화명 등). 전투 스펙에서 확장.

---

## 5. Event Editor 강화

### 5.1 명령 추가 (RM2K3 핵심)
기존 5개(text/choices/setFlag/transfer/wait)에 추가:
- **fork**: 조건 분기(switch/variable). then/else 중첩.
- **setSwitch**: 스위치 설정(Database 스위치 참조).
- **setVariable**: 변수 연산(=/+=/-=/*=/÷=, 값 또는 다른 변수).
- **timer**: 타이머 설정/시작/정지.
- **inputWait**: 키 입력 대기.
- **label/gotoLabel**: 라벨 점프(루프 구현용).
- **moveEvent**: 이벤트/플레이어 이동 경로 지정.
- **changeTile**: 맵 타일 동적 변경(레이어 지정).
- **callCommonEvent**: 공통 이벤트 호출.

setFlag는 레거시 → setSwitch로 마이그레이션(스펙1 호환).

### 5.2 명령 편집기 (재귀 컴포넌트 재사용 + 확장)
- 기존 재귀 명령 리스트 편집기 유지 + 새 kind별 폼 추가.
- fork: then/else 각각이 중첩 Command[] (choices와 동일 패턴).
- Database 참조 picker: setSwitch/setVariable/fork에서 스위치/변수를 이름으로 선택(드롭다운).

### 5.3 조건(condition) 폼
- switch 모드: 스위치 선택 + true/false.
- variable 모드: 변수 선택 + 연산자(>=/<=/==/!=) + 값.

---

## 6. Resource Manager (새 패널)

### 6.1 기능
- 에셋 임포트: 파일 선택(FileReader) → base64 dataUrl → IndexedDB 저장.
- 종류: 타일셋 PNG / 스프라이트 PNG.
- 임포트 후: 타일셋은 Database > Tilesets에서 TilesetDef로 변환, 스프라이트는 AssetSet.sprites에 등록.
- 내장 에셋(tiles_default/hero/npc)은 "기본 제공"으로 표시, 삭제 불가.

### 6.2 패널 구성
- 타일셋 목록 + 스프라이트 목록.
- 각 항목: 미리보기, 이름, 종류, 출처(내장/임포트).
- "임포트" 버튼 + 삭제(임포트만).
- 에셋 클릭 → 상세(치수/프레임 정보).

---

## 7. 패널 유연 레이아웃

### 7.1 현재 구조의 한계
- 3단 고정(좌220/캔버스/우320). 패널 크기 고정, 접기 불가, 풀스크린 캔버스 불가.

### 7.2 새 레이아웃
- **크기 조절**: 패널 경계에 리사이저(드래그로 폭 변경). 최소/최대 폭.
- **접기/펼치기**: 좌·우 패널 각각 토글 버튼(접으면 캔버스가 넓어짐).
- **풀스크린 캔버스**: 양쪽 다 접으면 캔버스 풀스크린.
- **탭 전환**: 우측 패널은 컨텍스트별 탭 — 맵 속성 / 이벤트 편집 / Database / Resource Manager. (한 번에 하나 표시, 패널 공간 효율)
- 상단바에 메인 모드(Edit/Play) + Database/Resource 빠른 진입 버튼.

### 7.3 반응형
- 좁은 화면(<1024px): 패널 기본 접힘, 필요 시 오버레이로 열림.
- 보통/넓은 화면: 패널 펼침, 리사이즈 가능.

---

## 8. 플레이어 연동 (런타임)

### 8.1 인터프리터 확장 (`player/interpreter.ts`)
새 Command kind 처리:
- **fork**: condition 평가(switch/variable) → then 또는 else 프레임 push.
- **setSwitch/setVariable**: PlaySession.switches/variables 갱신.
- **timer**: 세션 타이머 상태 관리.
- **inputWait**: 키 입력 대기(일시정지).
- **label/gotoLabel**: 명령 리스트에서 라벨 검색 후 점프(같은 레벨 내).
- **moveEvent**: 대상 이벤트의 moveRoute 실행(PlayScene에 이동 요청).
- **changeTile**: 대상 맵의 lowerTiles/upperTiles 갱신(런타임 복사본, Project 아님).
- **callCommonEvent**: 공통 이벤트 commands를 새 프레임 push.

### 8.2 PlaySession 확장
```typescript
interface PlaySession {
  switches: Record<string, boolean>;    // flags → switches
  variables: Record<string, number>;    // 새
  timers: Record<string, number>;       // 새 (타이머 id → 남은 초)
  currentMapId: MapId;
  x: number; y: number;
  // 런타임 맵 상태(타일 변경 반영용)
  mapOverrides: Record<MapId, { lower: number[]; upper: number[] }>;
}
```

### 8.3 충돌 (passability 기반)
- collision.ts: 단일 boolean → 4방향 passability 기반으로 확장.
- `canMoveTo(map, fromX, fromY, toX, toY)`: from의 이동 방향 + to의 진입 방향 양쪽 passability 체크.

### 8.4 moveEvent 런타임
- PlayScene이 이벤트별 moveRoute를 타이머로 실행(자율 이동).

---

## 9. io.ts 마이그레이션

### 9.1 v1 → v2
- `migrateV1toV2`:
  - Project.tiles(단일) → lowerTiles + upperTiles(-1)
  - Project.flags(Record<string,boolean>) → switches([{id,name}]) + 런타임 값은 PlaySession
  - Project.tileset(AssetRef, 맵 단위) → 단일 기본 TilesetDef 생성 + 모든 맵 tilesetId 참조
  - collisions(boolean[]) → TilesetDef.passability(통과=true → 4방향 전부 true, 통과=false → 4방향 전부 false)
- `version: 2` 미만 입력은 자동 마이그레이션 후 version 2로 승격.
- version 2 직렬화/역직렬화 + v1 호환 로드.

### 9.2 검증 (io.ts validate*)
- 새 타입 필드(lowerTiles/upperTiles/switches/variables/mapTree/tilesets) 검증 추가.
- 임포트 파일: v1이면 마이그레이션, v2면 그대로, 알 수 없는 버전은 거부.

---

## 10. 구현 페이즈 (순차)

> D 범위 전부를 한 패스에 끝내되, 의존성 순서로 페이즈 분할. 각 페이즈 끝에 체크포인트(typecheck + 테스트).

**Phase O1 — 데이터 모델 + 마이그레이션** ⭐ 테스트 핵심
- types.ts 확장(version 2). io.ts migrateV1toV2 + v2 검증. defaults.ts v2 기본값.
- 테스트: v1→v2 마이그레이션, v2 왕복 직렬화, 기존 v1 저장 호환.

**Phase O2 — Database 패널**
- Switches/Variables/Common Events/Tilesets/Terms 탭.
- CRUD + 검색. Common Events 명령 편집(Event Editor 컴포넌트 재사용).
- Tileset 편집기(passability/priority).

**Phase O3 — 맵 에디터 3레이어 + chipset 분리 + Map Tree**
- EditScene 3레이어 합성 렌더. chipset 패널(현재 tilesetId 기반).
- Map Tree 패널(드래그/계층). collision.ts passability 확장.
- 테스트: passability 기반 충돌 판정.

**Phase O4 — Event Editor 강화**
- 새 Command kind 폼(fork/setSwitch/setVariable/timer/inputWait/label/gotoLabel/moveEvent/changeTile/callCommonEvent).
- Database 참조 picker.

**Phase O5 — Resource Manager**
- 에셋 임포트(FileReader → dataUrl → IndexedDB). 타일셋/스프라이트 관리.
- Tilesets 탭 연동(임포트 → TilesetDef 변환).

**Phase O6 — 플레이어 연동**
- 인터프리터 새 Command 처리. PlaySession 확장(switches/variables/timers/mapOverrides).
- moveEvent 런타임. changeTile 런타임. passability 충돌.
- 테스트: 인터프리터 fork/변수/timer/label/callCommonEvent 단위 테스트.

**Phase O7 — 패널 유연 레이아웃 + 통합**
- 리사이저/접기/풀스크린. 우측 컨텍스트 탭(맵속성/이벤트/Database/Resource).
- 반응형. 상단바 재구성.

**Phase O8 — 최종 검증**
- typecheck + 전체 테스트 + 빌드 + codex QA(브라우저 자동화).
- 마이그레이션 시나리오(기존 저장 v1 → 로드 → v2).
- RM2K3 기능 패러티 체크리스트 검증.

---

## 11. 에러 처리 / 테스트

### 11.1 에러 처리
- 마이그레이션 실패: 명확한 에러 메시지 + 원본 백업 보존.
- 임포트 에셋: 잘못된 포맷/치수 거부 + 메시지. dataUrl 크기 제한(과대 에셋 경고).
- Database 참조 누락: 스위치/변수/공통이벤트 id가 없으면 fork/setSwitch 등에서 안전 스킵 + 콘솔 경고.
- 인터프리터: 알 수 없는 Command kind 시 해당 이벤트 중단(기존 정책 유지).

### 11.2 테스트 (Vitest, 순수 모듈)
- `migration.test.ts`: v1→v2 변환 정확성, 필드 매핑, 레거시 호환.
- `io.test.ts`: v2 왕복, v1 로드, 버전 불일치 거부.
- `interpreter.test.ts` 확장: fork(then/else), setVariable 연산, timer, label/gotoLabel, callCommonEvent, moveEvent 스텁.
- `collision.test.ts` 확장: 4방향 passability 판정.
- `maptree.test.ts`: 트리 조작(추가/이동/삭제), 고아 노드 처리.
- Phaser 씬/DOM UI: 수동 + codex QA.

---

## 12. 완료 기준 (Definition of Done)

1. **Database**: Switches/Variables/Common Events/Tilesets/Terms 탭 동작. CRUD + 검색.
2. **맵 에디터**: 3레이어(Lower/Upper/Event) 합성 렌더. chipset 분리(맵별 tilesetId). Map Tree(부모-자식, 드래그).
3. **Event Editor**: RM2K3 핵심 명령(fork/변수연산/스위치/타이머/입력/라벨/moveEvent/changeTile/callCommonEvent) 편집 + 실행.
4. **Resource Manager**: 타일셋/스프라이트 임포트 → Database Tilesets 연동.
5. **패널 유연 레이아웃**: 크기조절/접기/풀스크린/컨텍스트 탭.
6. **플레이어**: 변수/fork/타이머/moveEvent/changeTile/공통이벤트 런타임 동작.
7. **마이그레이션**: 기존 v1 저장 로드 시 v2로 자동 변환, 데이터 손실 없음.
8. **검증**: typecheck 통과, 기존+신규 단위 테스트 전부 통과, 빌드 성공, codex QA 패스.
9. **RM2K3 패러티**: 맵(3레이어/Map Tree/chipset) + Database(5탭) + Event(명령 세트) + Resource(임포트) 항목별 체크리스트 충족.

---

## 13. 향후 확장 (이번 스펙 외, 명시적 비목표)

- **전투 시스템** + 전투 Database(Actors/Enemies/Items/Skills/Classes/Battle Animations).
- 실행취소(Ctrl+Z) 히스토리 스택.
- 드래그 영역 복사/이동, 스탬프 도구.
- BGM/사운드/음성.
- 플러그인/스크립트 시스템.
- 백엔드/멀티유저/클라우드 동기화.
- 국제화(Terms 확장).
