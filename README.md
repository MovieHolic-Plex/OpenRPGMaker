# RPG 메이커 (MVP)

웹 브라우저에서 동작하는 탑뷰 타일 JRPG 제작 도구. 에디터로 맵을 그리고 이벤트를 배치한 뒤, Play 모드로 전환해 직접 플레이할 수 있습니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:9999)
npm run build    # 프로덕션 빌드 (typecheck + bundle)
npm test         # 단위 테스트 실행
npm run typecheck # 타입 검사만
```

### AI 어시스턴트 연결

기본 연결은 API 키 과금 대신 로컬 Codex의 ChatGPT OAuth 로그인을 사용합니다. `npm run dev`만 띄우면 Codex 로그인 상태를 dev 서버와 **같은 포트**(same-origin)로 자동 브릿지합니다 — 별도 터미널이 필요 없습니다.

```bash
npm run dev
```

로그인이 없으면 `AI 설정 → ChatGPT 구독 → 구독 연결` 버튼이 Codex 기기 코드 로그인을 시작합니다.

- **DEV (`npm run dev`)**: vite dev 서버가 `/auth/*`·`/v1/chat/completions`를 로컬 `codex app-server`에 same-origin으로 브릿지합니다 (`vite.config.ts`의 `codexOAuthPlugin`). 별도 프로세스 불필요.
- **PREVIEW / 배포본 (`npm run preview`, `dist/`)**: 동일 포트 브릿지가 없으므로 별도 터미널에서 동반 서비스를 실행해야 합니다.

```bash
npm run ai:oauth # 127.0.0.1:17832, 토큰은 Codex가 로컬에서 보관
npm run preview
```

API 사용이 필요한 경우 `AI 설정 → API / 게이트웨이`로 전환해 OpenAI 호환 엔드포인트·모델·키를 입력할 수 있습니다. OAuth access/refresh token은 브라우저 localStorage나 프로젝트 데이터에 저장하지 않습니다.

## 사용법

### 에디터 (EDIT 모드)

- **좌측 패널**
  - **도구**: 칠하기 / 채우기 / 충돌 / 이벤트 / 지우개 (우클릭 = 지우개 단축)
  - **타일**: 잔디·길·바닥·모래·물·벽·나무·계단
  - **맵 목록**: 맵 추가/삭제, 현재 맵을 시작 맵으로 설정
- **캔버스**: 도구로 드래그하여 편집. 충돌 칸(빨강), 시작 위치(초록), 이벤트(💬) 표시
- **우측 패널**: 맵 속성(이름/크기) + 선택된 이벤트 편집(트리거/스프라이트/조건/명령)
- **상단 메뉴**: 💾 저장 / 📂 불러오기 / ⬆ 내보내기 / ⬇ 가져오기 / ▶ Play

### 이벤트 명령

이벤트는 명령 리스트를 순차 실행합니다(중첩 가능):

- **text** — 대사창 (화자 + 본문)
- **choices** — 선택지 (각 옵션마다 중첩 branch)
- **setFlag** — 전역 플래그 설정 (분기/조건용)
- **transfer** — 다른 맵으로 이동
- **wait** — 대기

트리거 종류: 조사(action) / 닿음(touch) / 자동(auto). 발동 조건(flag)으로 분기 제어.

### 플레이어 (PLAY 모드)

- **이동**: 방향키 또는 WASD
- **조사/확인**: 스페이스/엔터/E
- **대사 진행**: 클릭/엔터 (타이핑 중이면 전문 표시로 스킵)
- **선택지**: 클릭 또는 숫자키 1~9

## 아키텍처 요약

- **단일 진실 원천**: `Project` 데이터(JSON 직렬화)가 유일한 상태. 에디터만 쓰고, 플레이어는 읽기 전용 + 런타임 세션(`PlaySession`) 사용.
- **에디터/플레이어 분리**: 한 번에 한 모드. 전환 시 Phaser 게임 재부팅.
- **Phaser(캔버스) + 바닐라 TS DOM**: 의존성 = `phaser`(런타임) + `vitest`(dev).
- **절차적 기본 에셋**: `Graphics.generateTexture`로 타일/캐릭터 생성 → 바이너리 파일 의존성 0.
- **저장**: IndexedDB(자동 저장 + 수동). 작업물은 JSON으로 내보내기/가져오기.

## 데이터 스키마

스펙 문서 참조: [`docs/specs/2026-06-18-rpg-maker-mvp-design.md`](docs/specs/2026-06-18-rpg-maker-mvp-design.md)

주요 타입은 `src/project/types.ts`. 스키마 버전(`Project.version`)이 바뀌면 `io.ts`에 마이그레이션 추가.

## RM2K3 스타일 도구 세트 (v2 오버홀)

에디터는 RPG메이커 2003의 도구 세트를 현대적 웹 UI로 재구성합니다. 스펙: `docs/specs/2026-06-18-rm2k3-overhaul-design.md`

### 맵 에디터
- **3 레이어**: 바닥(lower) / 오브젝트(upper) / 이벤트 — RM2K3 정석 합성
- **chipset 분리**: 맵별 타일셋 지정, Database에서 통일 관리
- **Map Tree**: 부모-자식 맵 계층(예: 세계맵 → 마을 → 집), 부모 변경 지원
- **패널 유연 레이아웃**: 좌/우 패널 드래그로 크기 조절, 접기/펼치기, 풀스크린 캔버스

### Database (5탭)
- **스위치**: 전역 불리언. fork 조건/setSwitch에서 참조
- **변수**: 수치 변수. 연산(=/+=/-=/*=/÷=) 및 fork 조건
- **공통 이벤트**: 재사용 이벤트(callCommonEvent로 호출)
- **타일셋**: 타일셋 정의(passability/priority/terrain 편집)
- **용어**: UI 텍스트(통화명 등)

### Event Editor (RM2K3 명령 세트)
대사/선택지 외: **fork 조건 분기**(스위치/변수), **변수 연산**, **스위치 설정**, **타이머**, **입력 대기**, **라벨/이동**(루프), **맵 이동**, **이벤트 이동**, **타일 변경**, **공통 이벤트 호출**.

### Resource Manager
타일셋/스프라이트 에셋 임포트(파일 → base64 → IndexedDB). 임포트한 타일셋은 Database에서 TilesetDef로 변환. 내장 에셋(32비트 픽셀, codex 생성)은 기본 제공.

### v1→v2 자동 마이그레이션
기존 v1 저장 파일은 로드 시 자동 변환: `tiles`→`lowerTiles`, `flags`→`switches`, `collisions`→`passability`. 스키마 version 1→2.

### 전투 (RM2K3 사이드뷰)
사이드뷰 ATB 전투가 통합되어 있으며, 모든 능력치가 Database에서 구동됩니다:
- **액터 능력치**: Database 액터의 파라미터 곡선(maxHp/maxMp/공격/방어/정신/민첩)에서 레벨별로 산출.
- **적 능력치**: 적 레코드의 `stats` + `rewards`(경험치/골드/드롭)를 그대로 사용.
- **스킬 효과**: damage/healing/support/switch 효과 분기, 방어력/방어 상태(데미지 반감) 반영.
- **전투 명령**: 공격 / 스킬 / 아이템 / 방어 / 도주(스킬·아이템은 서브메뉴). 액터 전투 캐릭터 스프라이트 렌더링.

## 에셋 교체 (선택)

기본 에셋은 32비트 픽셀 PNG(`public/assets/`, codex 생성). 더 정교한 에셋으로 교체하려면:
1. 타일셋/스프라이트 이미지를 Resource Manager에서 임포트(또는 `public/assets/`에 직접 배치 후 `bundled.ts` 경로 수정).
2. 타일 인덱스 순서가 `defaults.ts`의 `TILE` 상수와 일치하도록 정렬.
3. 에셋 히스토리는 `public/assets/MANIFEST.md`에 기록(codex 정밀수정 워크플로우).

라이선스: 외부 에셋 사용 시 각 에셋의 라이선스를 준수하고 README에 표기하세요.

## 에디터 단축키 (RM2K3 스타일)

| 키 | 동작 |
|----|------|
| `F5` / `F6` / `F7` | 하위 / 상위 / 이벤트 레이어 전환 |
| `1`~`7` | 도구 (연필/채우기/스포이트/이동/선택/통행/이벤트) |
| `+` / `-` | 정수 줌 확대/축소 |
| `Ctrl+S` | 저장 |
| `Ctrl+Z` / `Ctrl+Y` (또는 `Ctrl+Shift+Z`) | 실행취소 / 다시실행 |
| `Ctrl+C` / `Ctrl+V` | 타일 영역 복사 / 붙여넣기 |
| `Space` (누르는 동안) | 임시 맵 이동 |
| 가운데 버튼 드래그 | 맵 이동 |

텍스트 입력/모달이 포커스를 잡고 있으면 단축키는 자동으로 비활성화됩니다.

## 이벤트 명령 편집
이벤트 명령 리스트는 RM2K3처럼 **드래그로 순서 변경**할 수 있습니다(명령 왼쪽 ⠿ 핸들을 드래그). 위/아래(↑↓)/삭제(×) 버튼도 유지됩니다.

## 현재 범위

포함(v3): 3레이어 맵, Map Tree, Database(switches/variables/commonEvents/tilesets/terms + 액터/직업/스킬/아이템/장비/적/적그룹/상태/전투애니메이션/시스템), RM2K3 명령 세트(드래그 재정렬), Resource Manager(임포트), 패널 유연 레이아웃, v1→v3 마이그레이션, **RM2K3 사이드뷰 전투(DB 구동)**, **실행취소/다시실행**, **드래그 영역 복사/붙여넣기**, **에디터 키보드 단축키**.

제외(이후 단계): BGM/사운드, 백엔드/계정.

## 테스트

순수 로직 위주 단위 테스트(`test/`, 368개):
- `interpreter.test.ts` — RM2K3 명령 상태머신(순차/choices/fork/변수연산/스위치/타이머/입력대기/라벨-루프/changeTile/moveEvent/callCommonEvent)
- `migration.test.ts` — v1→v2 변환(tiles→lowerTiles, flags→switches, collisions→passability) + 왕복
- `io.test.ts` — v2 직렬화 왕복 + 잘못된 파일 거부
- `defaults.test.ts` / `collision.test.ts` — v2 프로젝트 무결성, passability 기반 충돌
- `actions.test.ts` / `eventActions.test.ts` — 페인트/채우기, 명령 경로 탐색
- `battleRuntime.test.ts` / `battleRuntimeDb.test.ts` — ATB 전투 런타임, DB 구동 능력치/보상/스킬 효과/방어/도주
- `eventCommandReorder.test.ts` — 이벤트 명령 드래그 재정렬 백엔드
- `editorHotkeys.test.ts` — RM2K3 스타일 에디터 단축키 매핑

Phaser 씬/DOM UI는 `npm run dev` + codex 브라우저 QA로 검증.
