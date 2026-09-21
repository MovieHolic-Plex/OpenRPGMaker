# OPRN 로컬 SQLite 프로젝트 저장소 설계 — LegacyDb 정본에서 프로젝트 폴더 정본으로, Electron 데스크톱

작성: 2026-09-15. 근거: 같은 날의 코드 조사(저장 경로·미디어·가드), PGlite 대 SQLite 실측, 사용자 결정(Electron, 협업은 후순위, SQLite 전면).
상태: 사용자 검토 대기 → 승인 후 `docs/superpowers/plans/` 에 실행 계획.
이름 규칙: 새 식별자는 전부 `oprn` 계열이다(`src/brand.ts` 의 `PRODUCT_SLUG`). 옛 이름은 데이터(스키마 `rpg_zzu`, 프로젝트 행 id)에만 남는다.

## 0. 한눈에

정본을 "원격 Postgres 의 프로젝트 행" 에서 "사용자가 고른 폴더 안의 `project.sqlite`" 로 옮긴다. 렌더러는 정본을 직접 열지 않고 **저장소 포트** 하나로만 접근하며, 포트 뒤에 LegacyDb 어댑터(이관 기간만)·Electron 어댑터·메모리 어댑터가 선다. 미디어는 base64 문자열로 문서 안에 있던 것을 내용 주소 파일로 꺼내고 `oprn-asset://` 프로토콜로 서빙한다. 앱은 Electron 이고 맥을 먼저 낸다.

| 영역 | 지금 | 이후 |
|---|---|---|
| 정본 | `rpg_zzu.projects.current_json` (PostgREST, anon 키, sha256 CAS) | `<프로젝트 폴더>/project.sqlite` 의 `project` 행, 같은 sha256 CAS |
| 접근 | store → `legacyDbProjectSync.ts` 1,579줄 직접 호출 | store → `ProjectRepository` 포트 → 어댑터 |
| 미디어 | `assets.uploaded[id].dataUrl` base64 (문서 안, 최대 11MB 문자열) | `assets/<sha256>.<ext>` 파일 + 문서에는 `ref` 넷만 |
| 프로세스 | 브라우저 탭 + vite dev/preview 서버 | Electron 메인(로컬 스토어·프로토콜·동반 서비스) + 렌더러(기존 편집기) |
| 협업 | 원격 행 하나를 여럿이 CAS 로 갱신 | 이번 범위 밖. 나중에 정본을 가진 서버로 |
| 웹 빌드 | 제품 | 개발·QA 하네스(Playwright e2e 는 메모리 어댑터로 그대로 돈다) |

## 1. 배경과 문제

조사로 확정한 사실:

- LegacyDb 는 Postgres 로만 쓴다. `/rest/v1` 로 raw `fetch`, 헤더 `apikey`·`Authorization`·`Accept-Profile: rpg_zzu`. legacyDb-js·Storage·Auth·Realtime 은 쓰지 않는다. RLS 는 초안 마이그레이션뿐이고 anon 키로 행 삭제가 된다(메모리 `anon-key-can-delete-projects`).
- 문서 하나가 정본이다. `projects.current_json` 에 프로젝트 전체가 들어가고 sha256 조건부 갱신으로 다중 작성자를 막는다. 맵 미러·커밋 계보·AI 기록 테이블이 곁에 있다.
- 미디어는 문서 안 base64 다. `UploadedAsset.dataUrl` 을 읽는 곳이 30개 파일 58곳, 가져오기 상한은 이미지 4MB·오디오 8MB·영상 32MB. 큰 프로젝트는 문서 문자열이 11MB 를 넘고, 자주 부르는 `structuredClone`(store 안 17곳)과 저장 시 sha256 이 그 크기를 매번 치른다.
- 2026-09-06 의 결정 "로컬 정본 DB 금지" 를 `test/noLocalProjectDb.test.ts` 가 지킨다. 당시 사고 원인은 브라우저 localStorage 의 쿼터, 동기 API, 키 하나를 통째로 재기록하는 구조, 전송 성공과 무관하게 밀어내는 링버퍼였다.
- 동반 서비스(AI 인증·완성·활동 로그 디스크 미러·유료 게이트웨이 프록시)는 `vite.config.ts` 플러그인 넷으로 dev 와 preview 서버에 붙어 있고, `npm start` 는 `vite preview` 9888 이다. 완성 호출은 Bun 워커가 필요하다(pi-ai 가 `bun:sqlite` 를 싣는다).
- 헤드리스 도구(`scripts/oprn-tools.mjs`, MCP 서버, Pi 에이전트)는 이미 JSON 파일이나 `.oprn` 패키지를 직접 읽는다. 원격에 의존하지 않는다.

문제는 LegacyDb 자체가 아니라 셋이다. 정본이 사용자 손 밖에 있어 앱으로 배포할 수 없고, 미디어가 문서 안에 있어 크기와 상한이 묶여 있으며, 저장 경로가 한 구현에 직접 결합돼 있어 갈아 끼울 수 없다.

## 2. 목표 · 비목표

**목표**

- 프로젝트는 사용자가 고른 폴더다. 복사가 백업이고 공유다. 앱이 없어도 폴더 안의 파일은 열어 볼 수 있다.
- 렌더러 코드는 저장 구현을 모른다. store 는 포트 하나만 부른다. 어댑터 셋은 계약 테스트 하나를 같이 통과한다.
- 미디어는 문서 밖 파일이다. 같은 바이트는 한 번만 저장된다. 기존 프로젝트는 열 때 자동으로 옮겨진다.
- 정전·강제 종료에서 마지막 커밋된 저장이 살아남는다.
- 노드 스크립트와 헤드리스 에이전트가 앱과 같은 라이브러리로 같은 폴더를 연다.
- 나중에 배포된 게임(스팀 포함)이 같은 `project.sqlite` 를 읽기 전용 콘텐츠 DB 로 그대로 쓸 수 있다.

**비목표**

- 협업 모드. 잠금·실시간 병합·정본 서버는 이번에 만들지 않는다. 포트는 원격 어댑터를 다시 꽂을 수 있게 남긴다.
- 자동 업데이트, 윈도 패키징, 스팀 빌드 파이프라인. 맥 dmg 와 도그푸딩용 리눅스 AppImage 까지다.
- 커뮤니티 사이트(`community-site/`)의 DB. 플레이어 부트 설정의 이름만 스윕 PR 이 건드린다.
- BGM 카탈로그(1.3GB)의 저장 위치 변경. 지금처럼 앱 수준 설치 위치에 두고 id 로 참조한다.
- 편집기 UI 재설계. 시작 화면과 메뉴만 새로 생긴다.

## 3. 결정 기록과 가드 정책

바뀌는 결정은 한 문장이다. 정본은 "원격 서버의 프로젝트 행" 에서 "프로젝트 폴더 안의 SQLite 파일" 로 옮기고, 렌더러는 정본을 직접 열지 않고 저장소 포트로만 접근한다. 2026-09-06 결정의 근거 넷(쿼터, 동기 API, 통째 재기록, 링버퍼)은 메인 프로세스가 디스크에 여는 SQLite 에는 하나도 해당하지 않고, sha256 조건부 저장이 유지되므로 다중 작성자 보호도 그대로다.

기록 위치 셋:

- 이 문서. `docs/superpowers/specs/` 에 커밋한다.
- 위키 두 페이지. `openwiki/testing.md` 의 "Canonical project storage versus AI history" 절과 `openwiki/runtime-project-schema.md` 의 "DB-is-truth" 항목에 후속 결정을 덧붙인다. 옛 문장은 지우지 않고 날짜와 함께 대체된 것으로 표시한다.
- 가드 테스트의 이름과 주석. 무엇을 지키는지 새 정책으로 말하게 고친다.

가드는 약해지지 않고 **경계 테스트**가 된다.

| 검사 | 범위 | 상태 |
|---|---|---|
| indexedDB·sqlite·sql.js·better-sqlite·옛 폴백 파일 금지 | `src/project`, `src/editor` | 유지. 렌더러는 DB 를 열지 않는다 |
| SQLite 드라이버 import 허용 | `electron/local-store/**` 한 곳 | 신설 |
| `electron/**` 가 `src/` 에서 import 할 수 있는 것 | `src/brand.ts`, `src/project/types/**`, `src/project/persistence/core/**` | 신설 |
| `src/project/persistence/core/**` 는 DOM·fetch·localStorage 토큰 없음 | 해당 디렉터리 | 신설 |
| `src/**` 가 `electron/` 에서 import 할 수 있는 것 | `electron/shared/**` (채널 이름·zod 스키마·타입) | 신설 |
| 렌더러 어댑터 파일 이름에 sqlite 없음 | `src/project/persistence/**` | 기존 문자열 검사에 걸리지 않게 하는 규칙 |

퇴역 항목 셋: 맵 편집 잠금은 로컬 모드에서 "미설정" 으로 꺼지고 편집기는 이미 그 상태를 처리한다. `?project=` 딥링크는 Electron 에서 무시되고 폴더 선택이 대신한다. 호스팅 프리뷰와 LegacyDb 는 8절 이관이 끝날 때까지만 유지한다.

## 4. 프로젝트 저장 형태

프로젝트 하나는 사용자가 위치를 고르는 **평범한 폴더**다. 맥 패키지로 감싸지 않는다. 사용자가 에셋 파일을 직접 보고 넣을 수 있어야 하고, RPG Maker 계열의 관례도 폴더다.

```
마을이야기/
  project.sqlite          정본. 문서·이력·AI 기록·에셋 메타데이터
  assets/
    <sha256>.<확장자>     업로드한 이미지·음악·효과음. 내용 주소, 평평한 한 단계
  backups/                "백업 만들기" 결과. 없어도 됨
```

프로젝트마다 SQLite 파일 하나를 두는 이유: 폴더 복사가 곧 백업이고 공유이며, 프로젝트 간 잠금 간섭이 없고, 이관도 프로젝트 단위로 끊어진다. 최근 프로젝트 목록과 창 상태 같은 앱 수준 설정은 Electron `userData` 에 JSON 으로 둔다. 프로젝트 id 는 UUID 로 `meta` 에 박아 폴더 이름을 바꿔도 커밋 계보와 AI 기록의 범위 키가 유지된다.

스키마는 지금 Postgres 모양을 문서 저장 그대로 옮기되, 로컬에서 의미 없는 것을 뺀다.

| 테이블 | 내용 | 비고 |
|---|---|---|
| `meta` | 스토어 포맷 버전, 프로젝트 UUID, 생성 시각, 마지막 앱 버전 | 키·값 |
| `project` | 단일 행. 제목, 문서 버전, `current_json` 텍스트, sha256, revision, 갱신 시각 | 직렬화 텍스트를 그대로 저장해 바이트 안정 |
| `maps` | 맵별 미러. 이름, 크기, 타일셋, `map_json`, sha256 | 썸네일과 맵 단위 충돌 판정용 |
| `commits`, `changes` | 커밋 계보와 엔티티별 패치 | 현재 컬럼 그대로. 작성자 식별 포함 |
| `ai_activity_logs`, `ai_conversations`, `ai_analysis_runs` | AI 기록 | 현재 컬럼 그대로 |
| `assets` | sha256, MIME, 바이트 수, 확장자, 원래 이름, 종류, 등록 시각 | 실제 바이트는 `assets/` 파일 |

뺀 것: `tilesets`·`terrain_templates` 미러, `map_edit_locks`, `sync_verification_runs`, `user_skills`, `spatial_project_revisions`. 타일셋은 문서에서 바로 읽고, revision 은 `project` 행의 컬럼으로 흡수하며, `user_skills` 는 src 에서 쓰는 곳이 없다.

**저장 규칙.** 저장은 트랜잭션 하나다. 기대 sha256 이 현재 값과 같을 때만 `project` 행을 갱신하고, 바뀐 맵의 미러 행을 교체하고, revision 을 올린다. 다르면 지금처럼 맵 단위로 병합을 시도하고 겹치는 맵만 충돌로 돌려준다. 이 병합은 이미 순수 함수라 메인 프로세스에서 재사용한다. PRAGMA 는 `journal_mode=WAL`, `synchronous=FULL`, `busy_timeout=5000`, `foreign_keys=ON`. 자동 저장 주기는 store 의 현재 debounce 그대로다.

**열기 규칙.** 열 때 쓰지 않는다. 포맷 버전 이관이나 6절의 미디어 분리가 필요할 때만 쓰고, 그때는 먼저 `backups/` 에 사본을 만든다. 읽기 전용 열기를 별도 진입점으로 두어 나중에 배포된 게임이 설치 폴더의 파일을 그대로 읽게 한다. WAL 파일은 읽기만 해도 `-shm` 을 만들므로, 배포용 사본은 `VACUUM INTO` 결과(WAL 아님)를 쓴다.

**바깥 변경 감지.** 노드 스크립트나 헤드리스 에이전트가 앱이 열어 둔 파일에 쓸 수 있다. 메인 프로세스가 창 포커스 시점과 3초 주기로 `PRAGMA data_version` 을 읽어 바뀌었으면 렌더러에 "바깥에서 바뀜" 을 알리고, 편집기는 다시 읽기 여부를 묻는다.

**에셋 규칙.** 파일 이름은 바이트의 sha256 이라 같은 파일을 두 번 넣어도 하나만 남는다. 저장 중에는 절대 지우지 않고, "사용하지 않는 미디어 정리" 를 사용자가 눌렀을 때만 문서가 참조하지 않는 파일을 지운다.

**백업.** "백업 만들기" 는 `VACUUM INTO` 로 `backups/` 에 시각 이름의 사본을 만든다. 자동 주기 백업은 이번 범위에 넣지 않는다.

## 5. 저장소 포트와 어댑터

포트는 `src/project/persistence/` 의 인터페이스 하나다. 지금 sync 모듈이 내보내는 함수 스무 개를 묶음별로 정리한 모양이고, 새 개념은 "대상" 하나뿐이다. 지금은 URL·anon 키·프로젝트 id 묶음이 쓰기 권한의 대상 노릇을 하는데, 이를 불투명한 `ProjectTarget` 으로 바꿔 원격이면 URL 과 프로젝트 id, 로컬이면 폴더 경로와 UUID 를 담는다. 대상 비교는 키 문자열 하나로 한다.

```ts
interface ProjectRepository {
  readonly kind: "remote" | "local" | "memory";
  status(): PersistenceStatus;                        // ready | not-configured | disabled
  probe(): Promise<boolean>;                           // 지금의 projects?limit=0 연결 확인을 대체
  listProjects(): Promise<ProjectListItem[]>;         // 원격: 행 목록 / 로컬: 최근 프로젝트
  loadSnapshot(target): Promise<Snapshot | null>;     // project, sha256, revision, authority
  loadPreview(target): Promise<Preview | null>;
  createProject(project, target): Promise<Snapshot>;   // 저장 후 다시 읽어 돌려줌
  save(project, { expectedSha, authority }): Promise<SaveResult>;
  saveMapPatch({ baseProject, project, changedMapIds, authority }): Promise<SaveResult>;
  recordCommit(input): Promise<CommitId>;  listCommits(limit): Promise<Commit[]>;
  ai: { recordActivity, listActivity, recordConversation, listConversations, loadConversation, recordAnalysisRun };
  assets: { put(bytes, meta): Promise<AssetRef>; url(sha256): string; list(); pruneUnused(referenced) };
  subscribeExternalChange(cb): () => void;            // 로컬만 의미 있음, 원격은 빈 구독
  locks?: MapEditLockApi;                             // 원격만 제공. 없으면 편집기는 지금의 '미설정' 경로
}
```

spatial 발행의 분기는 포트 바깥으로 나오지 않는다. 지금 `routeSpatialSave` 가 RPC 로 갈지 일반 upsert 로 갈지 고르는데, 그 판단은 LegacyDb 어댑터 안으로 들어가고 로컬 어댑터의 `save` 는 CAS 와 미러 갱신을 트랜잭션 하나로 끝낸다. store 는 `save` 하나만 부른다. 맵 병합·충돌 판정·정규 JSON 직렬화(`canonicalJsonString`)·sha256 은 `src/project/persistence/core/` 로 옮겨 두 어댑터와 메인 프로세스가 같은 코드를 쓴다.

**어댑터 셋.**

- LegacyDb 어댑터. 지금 sync 모듈과 spatial persistence 를 그대로 감싼다. 동작 변화 없음이 목표이고, 8절 이관이 끝나면 통째로 지운다. 에셋 `put` 은 지금처럼 데이터 URL 을 돌려줘 옛 경로가 그대로 산다.
- Electron 어댑터. preload 가 contextBridge 로 노출한 `window.oprn` 을 부르고, 브리지는 `ipcRenderer.invoke` 로 메인에 넘긴다. 저장 시 직렬화한 텍스트를 보내 메인이 같은 바이트로 sha256 을 계산한다. 메인은 채널 입력을 zod 로 검증한다(이미 의존성). **동기 호출은 없다** — 2026-09-16 에 마지막 예외(`commits.listSync`/`peekTip`)를 지웠다. 호출자가 0곳이었고(포트에만 있고 아무도 안 부름), AI 도구 `list_project_commits` 의 동기 XHR 은 브리지가 아니라 LegacyDb PostgREST 를 직접 보는 **별개 경로**였다(`src/editor/tools/queryTools.ts`). 그래서 두 껍데기의 브리지 모양이 이제 같다.
- 메모리 어댑터. store 단위 테스트와 브라우저 e2e 하네스용이다. 지금 `__OPRN_E2E_PROJECT__` 시드가 하던 일을 맡고, 저장 상태 표시는 "이 세션에만 저장" 이다. `devProjectPersistence` 의 개발용 덮어쓰기는 P6 에서 정리한다.

**메인 프로세스 로컬 스토어.** `electron/local-store/` 에 Node 전용 라이브러리로 두고 4절의 스키마와 저장 규칙을 구현한다. `electron` 모듈을 import 하지 않아 노드 스크립트와 헤드리스 Pi 에이전트가 같은 라이브러리로 폴더를 직접 연다. 드라이버는 `node:sqlite` 의 `DatabaseSync` 를 40줄 안팎의 `Driver` 인터페이스 뒤에 둔다. 실험 API 표시가 남아 있어 깨지면 `better-sqlite3` 로 갈아 끼울 자리다.

**store 와의 연결.** store 는 자동 저장 debounce, 영수증, 충돌 UI, 초안 금고, 개발 쇼케이스 로직을 그대로 갖고, sync 모듈 직접 import 만 포트 호출로 바꾼다. 부팅 시 `window.oprn` 이 있으면 Electron 어댑터, 없고 LegacyDb 설정이 있으면 LegacyDb 어댑터, 둘 다 없으면 메모리 어댑터다. 원격 실패 큐 `remoteOutbox` 는 원격 어댑터일 때만 감싼다. "온라인 저장" 같은 문구는 어댑터가 주는 라벨로 바꾼다. 프로젝트 고르기 모달과 연결 설정 모달은 Electron 에서 숨기고 7절의 시작 화면이 대신한다.

**계약 테스트 하나.** 저장·충돌·병합·커밋·AI 기록·에셋의 기대 동작을 한 스펙으로 쓰고 메모리·로컬(임시 폴더의 진짜 SQLite)·가짜 전송 LegacyDb 세 어댑터에 같이 돌린다. 어댑터 셋의 의미가 갈라지는 것을 막는 핵심 장치다.

## 6. 미디어를 JSON 밖으로

현재 `UploadedAsset.dataUrl` 을 읽는 곳은 30개 파일 58곳이다. 이 필드를 몰래 URL 로 바꿔 넣는 대신 타입을 바꿔 컴파일러가 58곳을 전부 찍어 주게 한다.

**문서 안 표현.** `dataUrl` 은 선택 필드로 내리고 `ref` 를 더한다. `ref` 는 sha256, MIME, 바이트 수, 확장자 넷이다. 문서에는 URL 을 넣지 않는다. 프로젝트 UUID 나 경로가 문서에 박히면 폴더를 옮기거나 공유할 때 깨지기 때문이다. URL 은 실행 중 어댑터가 만든다. 소비처는 접근자 셋만 쓴다. `uploadedAssetUrl(asset)` 은 `ref` 가 있으면 어댑터 URL, 없으면 옛 `dataUrl` 을 돌려주고, `uploadedAssetMime(asset)` 과 `uploadedAssetBytes(asset)` 이 MIME 판정과 바이트 읽기를 맡는다. 지금 `dataUrl` 접두사를 문자열로 검사하는 자리들, 예를 들어 리소스 해석기의 허용 목록, 영상 판정, 확장자 추출, 내보내기의 base64 디코드가 이 접근자로 모인다.

**커스텀 프로토콜.** 메인 프로세스가 `oprn-asset://<프로젝트UUID>/<sha256>` 을 `protocol.handle` 로 서빙한다. 표준 스킴, 보안 스킴, fetch 지원, 스트리밍, CORS 허용으로 등록해 이미지 태그, Phaser 로더, 오디오 태그의 Range 요청, canvas 의 drawImage 가 모두 통한다. Content-Type 은 `assets` 행에서 읽고, 경로는 sha256 하나뿐이라 경로 탈출이 없다. UUID 를 호스트에 두는 이유는 창 여러 개가 다른 프로젝트를 열 수 있기 때문이다. 스킴 이름은 `PRODUCT_SLUG` 로 조립한다.

**가져오기 흐름.** 렌더러가 File 을 읽어 바이트를 IPC 로 넘기고, 메인이 sha256 을 계산하고 MIME 을 허용 목록으로 검증한 뒤 임시 파일에 쓰고 이름을 바꿔 `assets/<sha256>.<확장자>` 로 넣고, `assets` 행을 추가하고 `ref` 를 돌려준다. 렌더러는 `ref` 만 문서에 넣는다. AI 가 만든 그림, 얼굴 시트를 canvas 로 잘라 만든 조각도 같은 `put` 을 탄다. 상한은 base64 제약이 사라지므로 로컬 모드에서 올린다. 원격 모드는 지금 값을 유지한다.

| 종류 | 지금 | 로컬 모드 |
|---|---|---|
| 이미지 | 4MB | 16MB |
| 음악·효과음 | 8MB | 64MB |
| 영상 | 32MB | 256MB |

**기존 프로젝트 자동 이관.** 로컬 스토어가 프로젝트를 열 때 문서에 base64 `dataUrl` 에셋이 남아 있으면, 렌더러에 넘기기 전에 메인에서 각각을 파일로 꺼내고 `ref` 로 바꾼 뒤 새 revision 으로 저장하고 "미디어 분리" 커밋을 남긴다. 같은 바이트는 같은 sha256 이라 여러 번 열어도 한 번만 일어난다. 8절의 LegacyDb 이관 스크립트도 같은 함수를 부른다.

**내보내기 유지.** 웹 내보내기 ZIP 은 `assets/uploaded/<id>.<확장자>` 를 지금처럼 쓰되 바이트를 `uploadedAssetBytes` 로 얻는다. 스탠드얼론 단일 HTML 은 지금도 모든 에셋을 data URL 로 인라인하므로, 빌드 시점에 `ref` 를 data URL 로 되돌려 넣기만 하면 결과물 모양이 그대로다. 릴리스 의존성 수집의 내장 미디어 검증은 문자열 접두사 대신 바이트와 MIME 을 본다. 헤드리스 노드 내보내기 스크립트는 로컬 스토어 라이브러리로 폴더의 파일을 직접 읽는다.

**함께 정리되는 것.** 업로드 에셋을 브라우저 Cache API 에 복사하던 코드는 로컬 모드에서 건너뛰고 LegacyDb 어댑터와 함께 사라진다. 문서에서 11MB 문자열이 빠지므로 `structuredClone` 과 저장 시 sha256 이 문서 크기만큼만 든다. BGM 카탈로그와 효과음 카탈로그는 id 참조라 영향이 없다.

## 7. Electron 셸

### 7.1 디렉터리와 빌드

```
electron/
  main/           main.ts(수명·창·메뉴), windows.ts(창 ↔ 프로젝트 세션), ipc/(채널별 핸들러),
                  protocol/(app://, oprn-asset://), companion/(루프백 동반 서비스), recent.ts
  preload/        index.ts — contextBridge.exposeInMainWorld("oprn", …)
  shared/         채널 이름·zod 스키마·브리지 타입. DOM·Node 무의존. 렌더러 어댑터가 import
  local-store/    5절의 Node 라이브러리. electron 을 import 하지 않음
```

렌더러는 지금의 `vite build` 결과 `dist/` 그대로다. `base` 가 `/` 라 절대 경로 자산은 `app://oprn/assets/…` 로 풀린다. 메인과 preload 는 `scripts/build-electron.mjs` 가 esbuild 로 `dist-electron/{main,preload}.cjs` 로 묶는다(`electron` 과 `node:*` 는 external). 개발은 `npm run electron:dev` — vite dev 서버를 띄우고 `ELECTRON_RENDERER_URL` 로 그 주소를 Electron 에 넘긴다. 이때도 저장은 Electron 어댑터라 LegacyDb 설정이 필요 없다. 배포는 `app://oprn/index.html` 이다.

### 7.2 프로세스 경계

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`. preload 는 채널 화이트리스트에 있는 `invoke` 래퍼만 노출한다.
- CSP 는 `app://` 응답 헤더로 준다. `default-src 'self' app:`, `img-src`·`media-src` 에 `oprn-asset: data: blob:`, `connect-src` 에 동반 서비스의 루프백 오리진. 인라인 스크립트 없음(현재 `index.html` 은 모듈 스크립트 하나다).
- `will-navigate` 는 막고, `setWindowOpenHandler` 는 https 만 `shell.openExternal` 로 보낸다.
- 스킴 등록은 `app.ready` 전 `registerSchemesAsPrivileged` 로 `app` 과 `oprn-asset` 둘 다 standard·secure·supportFetchAPI·stream·corsEnabled.

### 7.3 창과 프로젝트 세션

창 하나가 프로젝트 하나다. 메인은 `webContents.id` 로 세션(폴더 경로, 열린 DB, UUID, data_version 감시)을 든다. 같은 폴더를 다시 열면 새 창 대신 기존 창을 앞으로 가져온다. 프로젝트가 없는 창은 **시작 화면**을 띄운다: 최근 목록, 새 프로젝트(폴더 위치 선택), 폴더 열기, JSON·`.oprn` 패키지 가져오기. 이 화면이 프로젝트 고르기 모달과 연결 설정 모달을 대신한다. 최근 목록은 `userData/recent-projects.json`(최대 20, 없는 경로는 표시만 남기고 열기 비활성)이다.

메뉴는 맥 관례를 따른다. 파일: 새 프로젝트 ⌘N, 폴더 열기 ⌘O, 최근 열기, 저장 ⌘S(즉시 flush), 백업 만들기, 내보내기(웹 ZIP·단일 HTML·`.oprn` 패키지), 프로젝트 폴더 보기. 편집 롤은 표준으로 두고 편집기가 자체 처리하는 단축키와 겹치는지 P4 에서 확인한다. 보기: 새로고침·개발자 도구(개발 빌드만)·확대. 창, 도움말.

**닫기.** `window.on("close")` 에서 막고 렌더러에 `flush-before-close` 를 보낸다. store 가 flush 를 끝내면 창을 파괴한다. 10초 안에 답이 없거나 저장이 실패하면 "저장하지 않고 닫기 / 취소" 대화상자를 띄운다. 기존 `beforeunload` 경고는 `window.oprn` 이 있을 때 건너뛰어 대화상자가 두 번 뜨지 않게 한다. 앱 종료는 모든 창에 같은 절차를 돈 뒤 진행한다.

**PWA.** `registerPwa()` 는 `window.oprn` 이 있으면 등록하지 않는다. `public/sw.js` 는 웹 하네스용으로 남는다.

### 7.4 동반 서비스

지금 `vite.config.ts` 안에 있는 네 플러그인의 본체를 `scripts/lib/companion/` 으로 꺼내 vite 플러그인과 Electron 이 같은 핸들러를 쓴다. 메인은 시작 시 `127.0.0.1` 임의 포트에 Node `http` 서버를 띄우고 다음을 붙인다.

| 경로 | 지금 | Electron |
|---|---|---|
| `/auth/*`, `/v1/chat/completions` (헤더 `X-Oprn-Provider`) | OAuth 동반 서비스. 완성은 Bun 워커 | 같은 코드. Bun 은 PATH 와 `~/.bun/bin` 에서 찾고 없으면 완성만 503 과 안내 |
| `/__oprn/ai-activity`, 편집 활동 미러 | `output/` 아래 파일 | `userData/activity/` 아래 파일 |
| `/api/ai` | 서버가 유료 게이트웨이 키를 주입하는 프록시 | **제공하지 않는다.** 클라이언트 앱에 키를 실을 수 없다. 사용자는 기존 제공자 로그인(Codex·Antigravity)을 쓴다 |

렌더러는 경로를 손으로 쓰지 않고 `companionUrl(path)` 하나를 거친다. 웹에서는 상대 경로, Electron 에서는 브리지가 준 오리진을 붙인다. 루프백 포트는 같은 기기의 다른 프로세스도 부를 수 있으므로 실행마다 난수 토큰을 만들어 브리지로 주고 헤더 `X-Oprn-Companion-Token` 이 없는 요청은 거절한다. 허용 오리진은 `app://oprn` 과 개발용 localhost 뿐이다.

### 7.5 패키징

`electron-builder`, 맥 먼저(arm64 와 x64 각각 dmg·zip). 개발 기기가 리눅스라 서명이 필요 없는 AppImage 도 같이 만들어 도그푸딩한다. `asar: true`. `node:sqlite` 는 내장이라 네이티브 재빌드가 없다. 앱 id 와 제품명은 `src/brand.ts` 상수에서 만든 설정 파일이 준다. 공증은 Apple Developer ID 자격이 필요하고 저장소 밖 비밀이다. 자격이 없으면 서명 없는 개발 빌드로 도그푸딩한다. 자동 업데이트는 범위 밖이다.

## 8. 이관과 롤아웃 순서

단계마다 PR 하나, 각 단계에서 기존 테스트가 초록이어야 다음으로 간다.

| 단계 | 내용 | 끝났다는 증거 |
|---|---|---|
| P0 | 이름 스윕. PR #832 와 영속 키 호환 PR | 가드가 옛 이름을 막는다 |
| P1 | 포트 도입, 동작 불변. `src/project/persistence/` 에 인터페이스·`core/`·메모리 어댑터·LegacyDb 어댑터(기존 모듈 래핑). store 는 포트만 부른다. 계약 테스트(메모리·가짜 전송 LegacyDb) | `test:changed` 초록, 브라우저 e2e 스모크 초록, 원격 저장 동작 동일 |
| P2 | `electron/local-store/` 와 CLI `scripts/oprn-store.mjs`(`init`·`import-json`·`import-package`·`export-json`·`backup`·`info`). 임시 폴더의 진짜 SQLite 로 단위 테스트. 계약 테스트에 로컬 어댑터 추가. 가드를 3절 표대로 고친다. `oprn-tools.mjs`·MCP 서버에 `--project-dir` | 로컬 어댑터가 계약 테스트 통과, 헤드리스 도구가 폴더를 연다 |
| P3 | 미디어 분리. 타입·접근자·58곳·이관 함수·내보내기 | 웹 모드 동작 동일, 이관 함수가 픽스처 프로젝트를 한 번만 바꾼다 |
| P4 | Electron 셸 개발 모드. 메인·preload·두 프로토콜·Electron 어댑터·시작 화면·메뉴·닫기 절차·동반 서비스·PWA 끄기 | Playwright Electron 스모크 통과 |
| P5 | 맥 패키징과 도그푸딩. `scripts/oprn-store.mjs import-legacyDb --project <id> --out <dir>` 로 남은 원격 프로젝트를 폴더로 옮긴다. 원격 행은 지우지 않는다 | 실제 프로젝트 셋을 앱에서 열고 편집·저장·재시작 |
| P6 | LegacyDb 퇴역. `legacyDbProjectSync.ts`, spatial `persistenceHttp`, `remoteOutbox`, `legacyDbProjectConfig`, `/legacyDb` 프록시, 두 모달, live 테스트, Cache API 복사. 웹 빌드는 메모리 어댑터만 남아 QA 하네스가 된다. 9888 프리뷰는 이때부터 편집 도구가 아니다 | 가드가 `/rest/v1` 문자열을 src 에서 막는다 |

이관 스크립트의 대응: `projects.current_json` → `project.current_json`, `project_commits`·`project_changes` → `commits`·`changes`, AI 세 테이블 → 같은 이름, 미디어는 6절 함수로 추출, `maps` 미러는 복사하지 않고 문서에서 다시 만든다. 스크립트는 멱등이라 같은 프로젝트를 두 번 옮겨도 폴더 하나다.

되돌리기: 각 단계는 PR revert 로 돌아간다. 파일 포맷은 `meta.format_version` 으로 앞으로만 이관하고, 이관 전에 항상 `backups/` 사본을 만든다.

## 9. 검증·가드·위험

**테스트 층.**

- 로컬 스토어 단위: CAS 충돌, 맵 병합, 두 번째 연결이 쓴 뒤 `data_version` 변화 감지, `VACUUM INTO` 사본 복원, 옛 `dataUrl` 추출의 멱등성, 포맷 버전 이관, 읽기 전용 열기가 쓰지 않음.
- 계약 테스트: 어댑터 셋에 같은 스펙.
- IPC 스키마: zod 가 잘못된 입력을 거절한다. 프로토콜 핸들러: 경로 탈출과 모르는 sha256 은 404, Range 요청은 206.
- 렌더러 접근자: `ref` 와 `dataUrl` 양쪽 에셋에서 URL·MIME·바이트.
- Electron 스모크(Playwright `_electron`): 실행 → 시작 화면 → 임시 폴더에 새 프로젝트 → 편집 → 저장 → 재시작 → 같은 sha256. 이미지 가져오기 → `oprn-asset://` 로 그려짐. 바깥에서 파일 수정 → 다시 읽기 안내.
- 패키징: dmg 를 열어 위 스모크를 손으로 한 번. 체크리스트를 계획서에 둔다.

**성능 예산**(3.7MB 픽스처 문서 기준, 실측한 `node:sqlite` 값에서 여유를 둔 것): 열기 300ms 이하, 저장 100ms 이하, 앱 실행에서 시작 화면까지 2초 이하.

**위험과 대응.**

| 위험 | 대응 |
|---|---|
| `node:sqlite` 가 실험 API 표시를 달고 있다 | `Driver` 인터페이스 뒤에 두고 `better-sqlite3` 로 교체 가능하게. Electron 44 의 Node 24.18 과 로컬 Node 24.11 둘 다에서 돈다 |
| AI 완성이 Bun 을 요구한다 | 앱은 Bun 을 싣지 않는다. 없으면 완성만 꺼지고 나머지 편집기는 온전하다. Node 경로 대체는 별도 과제 |
| 유료 게이트웨이 키를 앱에 못 싣는다 | `/api/ai` 를 Electron 에서 제공하지 않는다. 제품 결정으로 기록 |
| 앱과 스크립트가 같은 파일을 동시에 쓴다 | `busy_timeout`, sha256 CAS, `data_version` 감시 셋이 겹친다 |
| 오디오 Range 요청이 `protocol.handle` 스트리밍에서 어긋날 수 있다 | P4 첫 작업으로 스파이크. 안 되면 오디오만 파일 전체 응답 |
| 공증 자격이 없다 | 서명 없는 빌드로 도그푸딩, 배포 전 자격 확보 |
| 브라우저 e2e 수백 개가 웹 하네스에 의존한다 | 웹 빌드와 메모리 어댑터를 유지한다. 없애지 않는다 |
| 배포된 게임이 나중에 같은 파일을 읽어야 한다 | 열기 규칙 "열 때 쓰지 않는다" 와 읽기 전용 진입점을 지금 지킨다 |

## 10. 엔진 선택 기록: SQLite, PGlite 는 쓰지 않는다

2026-09-15 실측(PGlite 0.5.8 = Postgres 18.3 WASM, `node:sqlite` = Node 24.11, 3.7MB 픽스처 문서). PGlite 는 저장소의 마이그레이션 6개를 그대로 적용했다. 즉 호환은 문제가 아니었다.

| 항목 | PGlite | node:sqlite |
|---|---|---|
| 콜드 생성 | 2,717ms | 58ms |
| 재오픈 | 343ms | 0ms |
| 3.7MB 문서 insert / CAS update / select | 274 / 146 / 36ms | 20 / 13 / 15ms |
| 빈 데이터 디렉터리 | 39.9MB (문서 넣은 뒤 41.1MB) | 3.7MB (문서 포함) |
| 엔진 로드 후 RSS | 약 530MB | 별도 비용 없음 |
| jsonb 왕복 바이트 동일 | 아니오 | 예 |

기각 이유는 수치보다 구조다. PGlite 는 연결 하나에 배타적이고 데이터 디렉터리 잠금이 없어(PR #892 미병합) 노드 스크립트와 앱이 같은 프로젝트를 여는 우리 사용 방식과 맞지 않는다. NodeFS 의 fsync 가 no-op 이라(issue #1107) 정전 내구성이 없다. 배포된 게임을 생각하면 더 분명하다. 설치 폴더는 읽기 전용이라 시작마다 클러스터를 복사해야 하고, Steam Cloud 는 파일 단위라 파일 수십 개짜리 데이터 디렉터리가 부분 동기화되면 통째로 깨지며, 스팀 덱에서 DB 엔진에 500MB 를 줄 수 없다. SQLite 는 이 전부의 반대편에 있고, 편집기의 `project.sqlite` 를 게임의 읽기 전용 콘텐츠 DB 로 변환 없이 동봉할 수 있다.

PGlite 가 남을 수 있던 자리는 LegacyDb 어댑터 계약 테스트였으나, 그 어댑터는 P6 에서 사라지므로 가짜 전송으로 충분하다. 의존성에 넣지 않는다.

## 부록 A. 이름

| 대상 | 이름 | 출처 |
|---|---|---|
| preload 브리지 | `window.oprn` | `PRODUCT_SLUG` |
| 앱 프로토콜 | `app://oprn/` | `PRODUCT_SLUG` |
| 에셋 프로토콜 | `oprn-asset://<UUID>/<sha256>` | `PRODUCT_SLUG` |
| IPC 채널 접두사 | `oprn:` | `electron/shared/channels.ts` |
| 동반 서비스 토큰 헤더 | `X-Oprn-Companion-Token` | 7.4 |
| 환경변수 | `OPRN_*` (옛 `RPG_ZZU_*` 는 한 릴리스 동안 별칭) | 영속 키 호환 PR |
| 스토어 CLI | `scripts/oprn-store.mjs` | 8절 |
| 패키지 포맷 | `.oprn` (가져오기는 `.rpgzzu` 도 받음) | `src/project/package.ts` |

## 부록 B. 이번 설계가 건드리는 기존 파일

`src/project/store.ts`(1,807줄, sync import 를 포트로), `src/project/legacyDbProjectSync.ts`(1,579줄, 어댑터 안으로 → P6 삭제), `src/project/spatial/{persistence,persistenceHttp,saveRouting}.ts`, `src/project/remoteOutbox.ts`, `src/project/legacyDbProjectConfig.ts`, `src/project/devProjectPersistence.ts`(메모리 어댑터로 흡수), `src/project/types/base.ts`(`UploadedAsset`), `src/pwa.ts`, `src/main.ts`(`beforeunload`), `src/editor/tools/queryTools.ts`(동기 XHR), `vite.config.ts`(동반 서비스 본체 추출), `test/noLocalProjectDb.test.ts`, `openwiki/testing.md`, `openwiki/runtime-project-schema.md`.
