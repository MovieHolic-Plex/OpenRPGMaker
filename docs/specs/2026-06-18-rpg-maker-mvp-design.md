# 웹 기반 RPG 메이커 — MVP 설계

- **날짜**: 2026-06-18
- **상태**: 설계 승인됨 → 구현 계획 단계로 이동
- **작성자**: 사용자 + ZCode

---

## 1. 목표와 범위

### 1.1 목표
탑뷰 타일 JRPG(RPG메이커 스타일)를 **웹 브라우저에서 제작할 수 있는 도구**를 만든다. 제작한 게임은 같은 브라우저에서 즉시 플레이할 수 있다.

### 1.2 MVP 성공 기준
사용자(작성자 본인)가 다음을 **실제로 수행**할 수 있어야 MVP 달성:
1. 에디터에서 타일로 마을 맵을 그린다.
2. 통행 불가 타일(벽·물 등)을 지정한다.
3. NPC 이벤트를 배치하고, 대사·선택지·플래그 분기를 편집한다.
4. 맵 이동 이벤트로 두 번째 맵과 연결한다.
5. **Play 모드로 전환해 캐릭터를 직접 움직이며 NPC와 대화하고 맵을 이동한다.**
6. 작업물을 파일로 내보내고 다시 불러올 수 있다.

### 1.3 비목표 (MVP에서 명시적 제외)
- 전투 시스템 (이벤트/분기만으로 전투 장면 흉내는 가능하나, 전용 시스템 아님)
- 인벤토리·장비·스킬
- 캐릭터 능력치/레벨업
- 수치형 변수 (boolean 플래그만)
- 멀티 레이어 맵 (단일 레이어)
- 맵 전환 연출(페이드 등) — 즉시 전환
- 멀티 프로젝트 관리 (단일 프로젝트 + 내보내기/가져오기)
- 에셋 업로드 (내장 에셋만; 이후 단계)
- 다중 사용자/백엔드/계정

### 1.4 차후 확장 경로 (MVP 이후)
- 에셋 업로드 (`AssetRef.type: "uploaded"` variant 추가)
- 전투 시스템 (Command variant 및 PlayScene 배틀 상태 추가)
- 멀티 레이어 맵
- 백엔드 + DB (저장소 어댑터 교체로 대응)
- 멀티 프로젝트 UI

---

## 2. 핵심 결정 요약

| 결정 | 선택 | 이유 |
|---|---|---|
| RPG 형태 | 탑뷰 타일 JRPG | RPG메이커 정통 스타일, "메이커 도구" 본질 |
| MVP 범위 | 걷기 + 대사 + 이벤트/트리거 (B 등급) | 도구로서의 본질 확보, 전투는 다음 단계 |
| 에디터/플레이어 구조 | **분리형** (편집↔플레이 모드 전환) | 상태 격리, 작업물이 JSON으로 깔끔히 분리 |
| 저장 방식 | **순수 프런트엔드 + 브라우저 저장** | 백엔드 0, "내가 쓰는 MVP"에 최적 |
| 스택 | **Phaser 3 + 바닐라 TypeScript + Vite** | 의존성 최소, Phaser↔DOM 동기화 단순 |
| 에셋 | **기본 에셋 내장** | "그리고 바로 플레이" 체감 확보 |

---

## 3. 전체 아키텍처

### 3.1 단일 진실 원천
**`Project` 데이터(JSON 직렬화 가능)** 가 유일한 진실 원천이다.
- EditScene·PlayScene·DOM 패널 **모두** 이 데이터를 읽는다.
- **에디터만** 이 데이터를 쓴다.

**플레이어와 런타임 상태 분리**: 플레이어는 `Project`를 읽기 전용으로 사용한다. 단, 게임 진행 중 변하는 상태(플래그 값, 현재 위치 등)는 `Project`에 쓰지 않고 **별도의 런타임 세션 상태**(예: `PlaySession { flags, currentMapId, currentPos }`)를 복사하여 사용한다. `Project.flags`는 에디터에서 정의한 *초기값*이고, 플레이어의 `setFlag`는 런타임 복사본만 갱신한다. (Play↔Edit 전환 시 런타임 상태는 폐기·초기화된다.)

### 3.2 단일 SPA, 두 모드 전환
```
┌─────────────────────────────────────────────────────┐
│  App (단일 페이지)                                    │
│                                                       │
│   ┌──────────────┐         ┌──────────────────────┐ │
│   │  EDIT 모드    │  Play↔  │   PLAY 모드           │ │
│   │              │  Edit    │                      │ │
│   │ ┌──────────┐ │ 토글     │  ┌────────────────┐  │ │
│   │ │EditScene │ │         │  │  PlayScene     │  │ │
│   │ │(Phaser)  │ │         │  │  (Phaser)      │  │ │
│   │ └──────────┘ │         │  └────────────────┘  │ │
│   │ + DOM 패널들 │         │  + 대사창/선택지(DOM) │ │
│   └──────────────┘         └──────────────────────┘ │
│                                                       │
│   공유: Project 데이터(JSON) — 단일 진실 원천          │
└─────────────────────────────────────────────────────┘
```

### 3.3 데이터 흐름 (단방향)
```
[사용자 입력]
     ↓
[DOM 패널 또는 EditScene 입력 처리]
     ↓
[Project 데이터 갱신] ← 에디터만 쓰기
     ↓
[store가 변경 알림]
     ↓
[EditScene: 변경분만 다시 그림 / PlayScene: 읽기만]
```

### 3.4 저장
- 단일 프로젝트를 **IndexedDB**에 저장.
- **자동 저장**: 에디터에서 Project 갱신 시점마다 디바운스(예: 1초)하여 자동 저장. Play 모드 진입 직전에도 1회 확정 저장.
- **수동 저장**: 메뉴의 "저장" 버튼으로 즉시 저장.
- 내보내기: `Project` JSON 파일(+ 향후 에셋). 가져오기: 해당 파일 로드.

### 3.5 폴더 구조
```
src/
  main.ts                 # 진입, 모드 전환
  project/
    types.ts              # Project/Map/Event/Command 타입
    store.ts              # Project 저장소(IDB), 단일 원천, 변경 알림
    defaults.ts           # 빈 프로젝트 기본값
    io.ts                 # 내보내기/가져오기(JSON)
  editor/
    EditScene.ts          # Phaser: 맵 그리기, 페인트, 이벤트 표시
    panels/
      tilePalette.ts      # DOM: 타일팔레트 + 도구 선택
      mapList.ts          # DOM: 맵 목록/추가/삭제/시작맵
      eventEditor.ts      # DOM: 이벤트 속성 + 명령 리스트 (재귀)
      menu.ts             # DOM: 저장/불러오기/내보내기/Play
  player/
    PlayScene.ts          # Phaser: 이동, 충돌, 트리거 감지
    interpreter.ts        # 이벤트 명령 인터프리터(상태 머신)
    dialogue.ts           # DOM: 대사창/선택지 오버레이
  assets/
    bundled/              # 기본 내장 에셋 정의
  util/
public/assets/            # 정적 에셋(타일셋/스프라이트 png)
```

---

## 4. 데이터 모델

`project/types.ts` 의 핵심 타입.

```typescript
// ── 최상위: 하나의 게임 프로젝트 ──
interface Project {
  version: number;                // 데이터 스키마 버전 (마이그레이션용)
  meta: { title: string; author: string };
  assets: AssetSet;               // 에셋 정의 (내장 + 향후 업로드)
  maps: Record<MapId, GameMap>;   // 맵들을 id로 인덱싱
  startMapId: MapId;              // 게임 시작 맵
  startPos: { x: number; y: number };  // 시작 타일 좌표
  flags: Record<string, boolean>; // 전역 플래그 (분기용, 진행도)
}

type MapId = string;

// ── 맵 ──
interface GameMap {
  id: MapId;
  name: string;
  width: number;                  // 타일 단위
  height: number;
  tileset: AssetRef;              // 사용할 타일셋
  tileSize: number;               // 보통 16 또는 32
  tiles: number[];                // length = width*height, 타일 인덱스 (-1=빈 칸)
  collisions: boolean[];          // length = width*height, 통과 불가 여부
  events: GameEvent[];            // 이 타일 칸에 배치된 이벤트들
}

// ── 이벤트 ──
interface GameEvent {
  id: string;
  x: number; y: number;           // 맵 상의 타일 좌표
  sprite?: AssetRef;              // NPC/오브젝트 그래픽 (없으면 안 보임)
  trigger: Trigger;               // 발동 시점
  condition?: Condition;          // 발동 조건 (플래그 등, optional)
  commands: Command[];            // 순차 실행 명령 리스트
}

type Trigger =
  | { kind: "action" }            // 조사(스페이스/엔터) 시
  | { kind: "touch" }             // 닿았을 때
  | { kind: "auto" }              // 맵 진입 시 자동
  | { kind: "parallel" };         // 자리만 (MVP엔 미구현)

type Condition =
  | { kind: "flag"; flag: string; value: boolean };

// ── 명령: 이벤트가 하는 일 ──
type Command =
  | { kind: "text"; speaker?: string; body: string }
  | { kind: "choices"; prompt?: string; options: { text: string; branch: Command[] }[] }
  | { kind: "setFlag"; flag: string; value: boolean }
  | { kind: "transfer"; mapId: MapId; x: number; y: number }
  | { kind: "wait"; ms: number };

// ── 에셋 ──
interface AssetSet {
  tilesets: Record<string, TilesetDef>;
  sprites: Record<string, SpriteDef>;
}
interface TilesetDef { image: AssetRef; tileSize: number; }
interface SpriteDef  { image: AssetRef; frames: number; }
interface AssetRef   { type: "bundled"; id: string }   // 향후 "uploaded" variant 예정
```

**설계 포인트**:
1. **`commands: Command[]` 합타입** — RPG메이커 스타일 "이벤트 = 명령 리스트". 새 기능은 variant 추가로 확장.
2. **`choices`가 `Command[]`를 품음** — 대사 분기의 자연스러운 중첩 (재귀 합타입).
3. **`flags` 프로젝트 단위 전역** — 능력치/인벤토리가 없으므로 진행도는 boolean 플래그로 표현.
4. **`AssetRef.type: "bundled"`** — 현재 내장만. 업로드는 `"uploaded"` variant로 확장.
5. **`version`** — 스키마 변경 시 마이그레이션 가능.

---

## 5. 에디터 (EDIT 모드)

에디터는 "게임 데이터를 시각적으로 편집하는 도구".

### 5.1 EditScene (Phaser 씬)
- 현재 맵을 그리드 단위로 렌더링.
- 마우스로 타일 칠하기/지우기 (선택 도구에 따라).
- 충돌 오버레이 (통과 불가 칸 반투명 색 표시).
- 이벤트 마커 표시 (이벤트 있는 칸 아이콘).
- 클릭한 칸 좌표를 DOM 패널로 통지.

### 5.2 DOM 패널 레이아웃
```
┌──────────────────────────────────────────────────────┐
│ [메뉴: 저장·불러오기·내보내기·Play 전환]              │
├────────┬───────────────────────────┬─────────────────┤
│타일팔레│                           │ 현재 편집 패널   │
│트 +    │     EditScene (캔버스)     │ (상황별 전환)    │
│도구    │                           │                 │
│        │                           │ · 맵 속성 폼    │
│        │                           │ · 이벤트 편집기  │
│        │                           │ · 명령 리스트   │
├────────┴───────────────────────────┴─────────────────┤
│ [맵 목록 하단: 맵 추가/삭제/이름변경/시작맵 설정]     │
└──────────────────────────────────────────────────────┘
```

### 5.3 도구 모음
- **페인트** — 선택 타일 드래그 시 칠함.
- **충돌 토글** — 칸 클릭으로 통과 가능/불가 토글.
- **이벤트 배치/선택** — 빈 칸 클릭 시 새 이벤트 추가, 기존 칸 클릭 시 편집기 오픈.
- **지우개** — 타일 제거.

### 5.4 이벤트 편집기 (우측 패널, 핵심 UI)
이벤트 클릭 시 표시. 폼:
- 스프라이트 선택 (드롭다운).
- 트리거 선택 (action / touch / auto).
- 발동 조건 (플래그 선택, optional).
- **명령 리스트** — RPG메이커 스타일:
  - 명령 위/아래 추가·삭제·재정렬.
  - 각 명령: 종류 선택 → 종류별 폼 (text: 대사 입력, choices: 옵션들, transfer: 맵+좌표, setFlag: 플래그+값, wait: ms).
  - choices의 `branch` 안에 또 명령 리스트 중첩 (재귀적 컴포넌트).

### 5.5 에디터 데이터 흐름
```
DOM 패널 입력 → Project 갱신 → store 알림
                                   ↓
                       EditScene: 변경분만 다시 그림
```
EditScene은 사용자 입력(칸 클릭/드래그)을 DOM 패널 쪽 이벤트로 보내 Project를 갱신. 데이터를 직접 쓰지 않음 (단일 진실 원천 유지).

---

## 6. 플레이어 (PLAY 모드)

플레이어는 "Project 데이터를 읽어 게임을 실행하는 머신". **데이터를 쓰지 않고 읽기 전용으로 실행**.

### 6.1 PlayScene (Phaser 씬)
- 현재 맵 타일 렌더링.
- 플레이어 스프라이트 + 부드러운 이동 (방향별 걷기 애니메이션).
- 충돌 체크 (다음 칸 통과 불가면 이동 안 함).
- 카메라가 플레이어 추종.
- 입력 처리 (화살표/WASD 이동, 스페이스/엔터 조사).

### 6.2 인터프리터 (`player/interpreter.ts`)
이벤트의 `commands: Command[]`를 한 줄씩 실행하는 **일시정지 가능 상태 머신**. PlayScene과 분리된 순수 모듈. `Project`는 읽기 전용이며, 가변 상태(`flags`)는 `PlaySession` 복사본을 갱신.

```
입력: Command[] + PlaySession(현재 flags 스냅샷)
출력: 부수효과 요청 (대사창 열기, 맵 이동, 세션 플래그 변경, 대기)

상태: { pc: 명령 카운터, stack: choices 분기용 }
- text     → 대사창 띄우고 일시정지 → 확인 시 다음
- choices  → 대사창에 옵션 띄우고 일시정지 → 사용자 선택 시 branch push
- setFlag  → PlaySession.flags 갱신 (Project 아님)
- transfer → PlayScene에 맵 전환 요청
- wait     → ms 대기
- 끝       → 종료
```

**포인트**: 동기 루프가 아니라 상태를 저장하고 매 프레임 업데이트에서 진행. 이 분리로 테스트 용이.

### 6.3 대사창/선택지 (DOM 오버레이)
- 인터프리터 `text` → 대사창 표시 (스피커 이름, 타이핑 효과, 클릭/엔터로 다음).
- 인터프리터 `choices` → 선택지 버튼들 표시, 클릭 → 인터프리터에 선택 전달.

### 6.4 실행 흐름
```
PlayScene 입장
  ↓
1. 자동(auto) 트리거 감지 → 인터프리터 실행
2. 플레이어 이동 루프 (60fps)
     ├─ 닿음(touch) 트리거 감지 → 인터프리터 실행
     └─ 조사(action) 입력 → 정면 칸 이벤트 → 인터프리터 실행
3. 인터프리터 실행 중엔 플레이어 입력 차단 (대사/선택 끝날 때까지)
4. 인터프리터 transfer 명령 → 새 맵 로드 → 1로
```

### 6.5 입력 차단 규칙
인터프리터 실행 중(대사창 떠 있는 동안) 이동·조사 입력 차단. JRPG 기본 동작.

### 6.6 parallel 트리거
MVP엔 자리만(`type Trigger`에 variant 존재) 두고 구현하지 않는다.

---

## 7. 내보내기 / 가져오기

- **내보내기**: `Project` 객체를 JSON 직렬화하여 `.json` 파일로 다운로드. 에셋은 내장 에셋이므로 에셋 ID만 참조(에셋 번들은 앱 자체에 포함).
- **가져오기**: `.json` 파일 선택 → `version` 체크 → `store`에 로드.
- 스키마 버전 불일치 시: MVP엔 "버전이 다름" 경고 후 거부 (마이그레이션은 추후).

---

## 8. 에셋 (내장)

- MVP엔 기본 타일셋(마을/필드용)과 캐릭터 스프라이트(방향별 걷기 프레임)를 `public/assets/` 에 포함.
- 오픈소스/무료 에셋 사용 (라이선스 명시 필수 — 후보: Kenney, LPC 계열).
- `assets/bundled/` 에 에셋 정의를 코드로 등록 (`AssetSet` 채움).

---

## 9. 에러 처리 / 테스트

### 9.1 에러 처리
- **데이터 무결성**: 가져오기 시 스키마 검증 (Zod 또는 수동 검증). 잘못된 파일은 거부 + 사용자 메시지.
- **누락 참조**: 맵/이벤트가 존재하지 않는 에셋·맵 ID를 참조하면 플레이어에서 안전하게 스킵 + 콘솔 경고.
- **저장 실패**: IndexedDB 쓰기 실패 시 사용자에게 알림.
- **인터프리터 예외**: 알 수 없는 Command kind 도달 시 해당 이벤트 중단 + 콘솔 경고 (전체 멈춤 방지).

### 9.2 테스트
- **순수 모듈 우선 단위 테스트**:
  - `interpreter.ts` — 명령 순차 실행, choices 분기, 조건부 발동, 일시정지/재개 (가짜 클럭으로).
  - `project/defaults.ts`, `project/io.ts` — 직렬화/역직렬화 왕복.
  - 충돌 체크 로직 (타일 좌표 → 통과 가능 여부).
- Phaser 씬/UI는 MVP에선 수동 테스트. (DOM 패널/PlayScene의 시각적 검증.)

---

## 10. MVP 기능 체크리스트 (구현 범위)

**에디터**:
- [ ] E1 타일맵 에디터 (페인트·지우개·채우기)
- [ ] E2 충돌 설정
- [ ] ~~E3 레이어~~ (단일 레이어로 시작)
- [ ] E4 이벤트 배치
- [ ] E5 멀티 맵 + 맵 이동 설정
- [ ] E6 대사/분기 편집
- [ ] E7 프로젝트 저장/불러오기/내보내기/가져오기

**플레이어**:
- [ ] P1 캐릭터 이동 + 충돌
- [ ] P2 이벤트 트리거 실행 (action/touch/auto)
- [ ] P3 대사창 + 선택지
- [ ] ~~P4 전환 효과~~ (즉시 전환)

---

## 11. 향후 확장 (참고용, MVP 범위 아님)

- 에셋 업로드 (`AssetRef` `"uploaded"` variant + 임포트 UI).
- 전투 시스템 (배틀 씬 + Command variant).
- 멀티 레이어 (tiles/collisions를 레이어 배열로).
- 수치형 변수 (`flags` 외에 `variables: Record<string, number>`, 조건/연산 Command).
- parallel 트리거 구현.
- 백엔드 + DB + 멀티 프로젝트 + 계정.
- 맵 전환 페이드 연출.
