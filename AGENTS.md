# RPG ZZU Agent Entry Point

This repository uses a project-local OpenWiki layer so coding agents can understand the editor before changing it.

Before making code changes, read:

1. `openwiki/PROJECT_WIKI.md` - the current project-specific AI map.
2. The focused OpenWiki page for the area you will edit:
   - `openwiki/editor-workflows.md` for editor UI, map editing, events, database, resources, and save/import/export.
   - `openwiki/large-village-generation.md` for 100×100 river/market village plan → build → road → QA flow.
   - `openwiki/runtime-and-data.md` for play mode, interpreter, battles, sessions, persistence, and schema changes.
   - `openwiki/architecture.md` for boot flow and ownership boundaries.
   - `openwiki/testing.md` for validation expectations.
   - `openwiki/cpen-openwiki.md` for refreshing wiki content through CPEN/OpenWiki.

## Supabase DB is mandatory (hard rule)

**에이전트는 Supabase 프로젝트 DB 연결 없이 게임/맵/이벤트 콘텐츠 작업을 끝내지 않는다.**  
“코드 fixture만 만들고 끝”, “임시 세션에서만 돌려보기”, “로컬 JSON export만” 은 **완료로 치지 않는다.**

### 반드시 지킬 것

1. **콘텐츠 작업(데모 게임, 마을, 맵, 이벤트, DB 레코드, 예제 어드벤처)을 시작하기 전에**
   - Supabase URL / anon key / **project id** 가 설정·사용 가능한지 확인한다.
   - 연결이 안 되면 **작업을 중단**하고 사용자에게 DB 연결(또는 env)을 요청한다. DB 없이 대체 구현으로 때우지 않는다.

2. **작성·수정한 프로젝트 데이터는 Supabase에 저장(업서트)까지 완료해야 한다.**
   - `saveProjectToSupabase` / store flush with **remote persistence enabled** / 팀이 쓰는 force-save 스크립트 등 **실제 원격 저장 경로**를 탄다.
   - 저장 후 **재로드(또는 project id로 다시 load)** 로 존재함을 증명한다.
   - 완료 보고에 **project id** 와 저장 성공 근거를 남긴다.

3. **금지 — 아래만 하고 끝내지 말 것**
   - `?blankProject=1` / `?freshProject=1` / `dev-showcase` 임시 세션만 사용하고 원격 저장 스킵.
   - 레포에 `*.json` fixture / `createSampleAdventureProject` 코드 시드만 추가·교체하고 **Supabase 미저장**.
   - “로컬 메모리·export JSON이면 충분”이라고 판단해 DB 단계를 생략.
   - remote 저장이 꺼진 상태에서 저장 버튼을 누르고 성공한 것처럼 보고.

4. **왜 강제인가**
   - `blankProject` / `freshProject` / 일부 `devProject` 쇼케이스는 의도적으로 `remotePersistenceEnabled = false` (`dev-showcase`) 이다. 이 경로에서는 저장이 Supabase로 가지 않는다.
   - 사용자 작업물의 정본(source of truth)은 **Supabase 프로젝트 행**이다. 에이전트 산출물도 동일 기준이다.

5. **허용되는 예외 (좁게)**
   - **순수 엔진/에디터 코드** 변경만 (UI, 인터프리터, 스키마 마이그레이션 등) 이고 맵·이벤트·데모 콘텐츠를 새로 저작하지 않는 경우 → DB 저장 의무 없음. 단 스키마 변경 시 migration·load/save 검증은 기존 규칙대로.
   - **단위 테스트용 최소 fixture** (`test/fixtures/...` 계약 테스트) — 앱에 싣는 “예제 게임/데모”가 아닌 경우만.
   - 사용자가 **명시적으로** “DB 없이 fixture만 / 코드만” 이라고 한 경우만 예외. 모호하면 DB 경로를 따른다.

6. **데모·예제 게임 작업 시 권장 순서**
   1. DB 연결 확인  
   2. 원격 저장이 켜진 상태로 에디터/스크립트에서 저작  
   3. Supabase 저장 + 재로드 검증  
   4. (선택) 레포 fixture/코드 시드는 **원격 저장 성공 후** 보조 산출물로만 추가  

## Agent rules

- Treat `openwiki` as working context, not product UI.
- If you change architecture, editor workflows, runtime data shape, persistence, or test strategy, update the matching `openwiki/*.md` page in the same change.
- Keep project-specific knowledge inside this repo's `openwiki` directory. Other projects should have their own `openwiki/PROJECT_WIKI.md` and focused pages.
- Do not store API keys or live credentials in wiki files, scripts, evidence, or commits.
- Prefer focused validation. For UI changes, include browser evidence. For schema/runtime changes, include tests that prove load, migrate, save, and play behavior as relevant.
- For **authored game content**, validation is incomplete until **Supabase load after save** succeeds (see hard rule above).
