# OPRN Studio Agent Entry Point

> **AI-log lookup without browser (2026-09-04 incident: prompt hid under oprn-9c35ec902c):** query `rpg_zzu.ai_conversations` with `Accept-Profile: rpg_zzu`, never filter `project_id` first.
> Search `entries_json` for kind user to find the hidden prompt.
> Credentials from `/home/main/z-project/rpg-zzu/.env.local`.
> Browser fallback: IndexedDB `oprn-ai-records`.

This repository uses a project-local OpenWiki layer so coding agents can understand the editor before changing it.

## 처음 온 에이전트는 이 두 쪽만 먼저 읽어라

1. **`openwiki/quickstart.md`** — 환경 보정(워크트리 `node_modules`/`.env.local`), **어떤 명령이 진짜 게이트인지와
   그 기준선 실측값**, 기능→진입 파일 표. 3분이면 읽는다. 이걸 건너뛰면 가짜 오류를 디버깅하게 된다.
2. **`openwiki/INDEX.md`** — 위키 절 좌표(생성 파일, `npm run openwiki:index`). 위키는 41쪽 약 1MB(약 27만 토큰)이고
   7쪽은 읽기 도구 상한 50KB 를 넘어 **통째로 읽으면 조용히 잘린다**. 필요한 절만 줄 번호로 잘라 읽어라.

그다음에 아래 순서로 간다.

1. `openwiki/PROJECT_WIKI.md` - the current project-specific AI map.
2. The focused OpenWiki page for the area you will edit (크기는 INDEX 에서 먼저 확인):
   - Editor pre-edit routing & cautions: `openwiki/editor-pre-edit-routing.md` (read first for any editor change)
   - Editor observability — mutation 계측 초크포인트, 편집 감사 로그, 오류 트랩, 디버깅 레시피: `openwiki/editor-observability.md` (read before adding an editing feature or debugging "방금 뭘 했더니 이렇게 됐다")
   - Editor event authoring: `openwiki/editor-event-authoring.md` + `openwiki/editor-event-commands.md` + `openwiki/editor-event-command-fixes.md`
   - Editor database: `openwiki/editor-database.md`
   - 세계 생성 규칙 (AI 마을 생성의 물·숲·길 수치와 낱말 판정을 DB 「세계 → 생성 규칙」 탭으로 저작): `openwiki/world-generation-rules.md`
   - Editor AI panel & tools: `openwiki/editor-ai-panel.md` + `openwiki/editor-ai-tools.md`
   - Editor misc workflows: `openwiki/editor-workflows-misc.md`
   - Editor validation: `openwiki/editor-validation.md`
   - 타일 레이어·배경 정책 (투명 여부와 홈 레이어·받침·다중 조각 제약의 분리, 커스텀 칩셋 검토 흐름): `openwiki/tile-layer-policy.md`
   - 공통 지연 툴팁 (아이콘 컨트롤 툴팁 동작 계약·명시 롤아웃 목록·문구 규칙): `openwiki/delayed-tooltip.md`
   - Interior room harness: `openwiki/editor-interior-room-harness.md`
   - `openwiki/editor-workflows.md` is now a slim index linking to the above topic pages.
   - `openwiki/large-village-generation.md` for 100×100 river/market village plan → build → road → QA flow.
   - Runtime pre-edit routing & cautions: `openwiki/runtime-pre-edit-routing.md` (read first for any runtime change)
   - Runtime battle: `openwiki/runtime-battle.md`
   - 배틀러 idle 애니메이션을 **새로 추가하는 절차**(표시 상자 실측 → 클립 → 창 탐색 → 패킹 → 검증, 네 계약과 함정): `openwiki/battler-idle-playbook.md`
   - Runtime action combat: `openwiki/runtime-action-combat.md`
   - Runtime sessions & state: `openwiki/runtime-sessions.md`
   - Runtime project schema & persistence: `openwiki/runtime-project-schema.md`
   - Runtime M2 flow controls: `openwiki/runtime-m2-flow-controls.md`
   - State system (authored definition, ontology, runtime application, editor surface): `openwiki/state-system.md`
   - `openwiki/runtime-and-data.md` is now a slim index linking to the above topic pages.
   - `openwiki/architecture.md` for boot flow and ownership boundaries.
   - `openwiki/testing.md` for validation expectations.
   - 릴리스·버전 (네 축 구분, 빌드 라벨, `npm run release` 절차): `openwiki/release-and-version.md`
   - LLM tile-placement benchmark (interior chipset as ground truth, reproducibility spine, 6 scoring schemes): `openwiki/interior-tile-benchmark.md`
   - LLM tile-placement benchmark on the DEFAULT chipset (combined_town, 9 axes matching the art director's questions, engine-derived ground truth, PNG evidence sheet): `openwiki/town-tile-benchmark.md`
   - Coding-agent benchmark (throw the repo + chipset at `claude -p` and score what it actually builds; fixture-independent village detection, quality + scale): `openwiki/agent-tile-benchmark.md`
   - Parallel agent isolation & verification gates: `openwiki/agent-worktrees.md` (read before running more than one coding agent).


## Agent Configuration Map

This repo has multiple agent tooling directories. Here is what each is and whether it is tracked:

| Directory / File | Purpose | Tracked? | Canonical? |
|---|---|---|---|
| `AGENTS.md` | **Canonical agent entry point** — read this first. All agents start here. | Yes | **Yes — source of truth** |
| `.mcp.json` | MCP server config (oprn-assistant bridge). Currently gitignored (session-local). | No (gitignored) | Yes for MCP config |
| `.kiro/` | Kiro CLI workspace config. `agents/` holds tracked custom agent profiles; `settings/cli.json` holds tracked model defaults. Invoke with an explicit model/effort when the task requires a fixed profile. | Yes | Kiro-specific |
| `openwiki/` | Project-local AI wiki (focused pages agents read before editing). | Yes | **Yes — source of truth for codebase knowledge** |
| `.agents/` | Senpi agent skills (project-local skill overrides). | No (gitignored) | Skills only |
| `.claude/` | Claude Code agent config. | No (gitignored) | Claude-specific |
| `.codex/` | Codex agent config + event logs. | No (gitignored) | Codex-specific |
| `.gjc/` | GJC agent state. | No (gitignored) | GJC-specific |
| `.qoder/` | Qoder auto-generated repowiki. **Not tracked — it duplicates `openwiki/` and went stale** (10 files still described the repo as a pnpm monorepo after the npm switch). Use `openwiki/` instead. | No (gitignored) | **No — use `openwiki/`** |
| `.qwen/` | Qwen agent config. | No (gitignored) | Qwen-specific |
| `.senpi/` | Senpi agent session state. | No (gitignored) | Senpi-specific |
| `.superpowers/` | Superpowers agent config + `sdd/qa-shots/` QA screenshots. The QA screenshots **are** tracked as authored evidence; the rest is session-local. | Partial (`sdd/qa-shots/`) | Superpowers-specific |
| `.omo/` | ULW-loop state, evidence, and rules. Partially tracked (`.omo/evidence/` and `.omo/rules/`). | Partial | State + evidence |

이 표는 실측과 일치해야 한다. 실측: 2026-07-31 정리에서 `.qoder/` 75건과 `.codex/` 5건이
"No (gitignored)" 라고 적혀 있었는데도 **tracked** 였다. `.codex/` 는 `.gitignore` 규칙이
있었지만 규칙보다 먼저 커밋돼 규칙이 무력화된 상태였다. 표를 고치는 것만으로는 부족하므로
index 에서 제거하고 `.gitignore` 에 `.qoder/` `.qwen/` `.senpi/` `.agents/` 를 추가했다.
표를 수정할 때는 `git ls-files <dir> | wc -l` 과 `git check-ignore -q <dir>` 로 검증하라.

**For any agent entering this repo:**
1. Read `AGENTS.md` (this file) — it is the canonical entry point.
2. Read `openwiki/quickstart.md` (환경·게이트 기준선·기능→파일) and `openwiki/INDEX.md` (위키 절 좌표).
3. Read `openwiki/PROJECT_WIKI.md` — it is the canonical project-specific AI map.
4. Use `.mcp.json` for MCP server config (oprn-assistant bridge on localhost).
5. Your own agent config dir (`.claude/`, `.codex/`, `.senpi/`, etc.) is session-local and gitignored — do not commit it.
6. `.omo/ulw-loop/` holds durable goal state and evidence; `.omo/evidence/` and `.omo/rules/` are tracked.

**Do not create a new agent config dir.** If your agent isn't listed, add it to this table with its purpose.

## 편집기 QA 와 런타임 QA 는 다른 도구를 쓴다 (hard rule)

**게임(런타임)을 브라우저로 QA 할 때 편집기 셸을 통과하지 마라. 전용 하네스가 있다.**

```bash
npm run qa:runtime          # 반복 작업 (--project <path> --scenario <name> --headed)
npm run qa:runtime:gate     # 게이트: 두 시나리오
```

결과는 `verify-shots/runtime-qa/<시나리오>/SUMMARY.md` 를 **먼저** 읽고, 거기서
"즉시 확인" 으로 표시된 PNG 만 열어라. 전량 열람은 컨텍스트 낭비다. 새 시나리오는
`scripts/qa/runtime/<name>.scenario.mjs`. 설계·근거는
`docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md`, 함정 목록은
`openwiki/testing.md`.

왜 편집기 경로로 하면 안 되는가 (실측):
- `src/app/mode.ts` 의 `enterMode` 는 play 모드에서도 `renderTopbar()` 를 호출한다 —
  톱바가 모든 스크린샷에 남고 편집기 번들·DB 연결·welcome 게이트를 전부 태운다.
- 편집기 play 모드는 실제 `@/project/store`, 출하되는 내보내기 플레이어는
  `exportProjectStoreShim` 을 쓴다. 즉 **편집기 경로로 하는 런타임 QA 는 출하물을
  검증하지 않는다.** 하네스는 `player.html` 을 띄워 shim 경로를 그대로 통과한다.

편집기 자체의 시각 QA(패널·모달·레일)는 기존 `test/e2e/` + `scripts/capture-*` 경로를
그대로 쓴다. 이 하네스는 게임 화면 전용이다.

## Parallel coding agents (hard rule)

**두 개 이상의 에이전트가 코드를 동시에 편집하지 않는다.** 하나의 워킹트리를 공유하면 서로의
미완성 편집을 덮어쓰고, 검증이 움직이는 표적을 쫓게 된다.

1. 병렬이 필요하면 `npm run wt create <name>` 로 **에이전트마다 격리 워크트리**를 만든다.
   절차·함정은 `openwiki/agent-worktrees.md` 참조. 다른 도구가 만든 워크트리(`.herdr/`, `.claude/worktrees/`)는
   `node_modules`·`.env.local` 이 없으므로 `npm run wt -- adopt <이름> --path <경로>` 로 먼저 보정한다(dev 포트는 `npm run dev:worktree` 가 스스로 고정 배정한다; `npm run dev` 는 워크트리에서 거절된다) —
   보정 없이 실행하면 전역 tsc 가 잡혀 **저장소 설정이 깨진 것처럼 보이는 가짜 오류**가 난다 (`openwiki/quickstart.md` 1절).
2. **저작 콘텐츠(맵·이벤트·데모) 작업은 워크트리로 병렬화하지 않는다.** 팀 호스트의 SQLite
   프로젝트 폴더는 공유 싱글턴이라 git 이 충돌을 못 본다 — 직렬화하거나 프로젝트 폴더를 분리한다.
3. 검증은 **감독자가 직접** `npm run gates` 로 한다. 에이전트는 아래 hard rule 을 따른다.
   에이전트의 "테스트 통과했습니다"와 파이프를 거친 종료 코드는 근거로 쓰지 않는다 (실측: 백그라운드 실행기가 exit 0 을 보고했으나 실제로는
   typecheck exit 2 / vitest exit 1 이었다).
4. 기준선이 빨간불이므로 게이트는 **기준선 대비 새 실패**만 회귀로 본다.

## 워크트리·세션 에이전트는 gates / vitest / stash 금지 (hard rule)

**사용자가 이 세션에서 테스트나 게이트를 돌리라고 명시하지 않으면 실행하지 마라.**
검증 습관, `openwiki/testing.md` 표, "완료하려면 테스트" 같은 기본 지시보다 **이 규칙이 이긴다.**

금지 (격리 워크트리·공유 트리 세션 모두. 감독자 역할이 아닌 한):
- `npm run gates`, `gates:*`, `npm test`, `npx vitest`, `node scripts/run-vitest.mjs`, 전체 스위트, 전체 `typecheck`
- dirty 를 치우려고 하는 `git stash` / `stash push` / `stash pop` / `stash apply`
- "검증하려고 잠깐", "게이트 한 축만", "changed 만" 도 사용자가 시키지 않았으면 금지

이유 (실측):
- stash 스택은 저장소에 하나뿐이라 모든 워크트리가 공유한다. pop 이 남의 WIP 를 꺼낸다 — `openwiki/agent-worktrees.md`.
- 여러 세션이 vitest/gates 를 겹치면 부하로 결과가 뒤집히고 공유 `node_modules` 워커가 머신 전체를 먹는다.
- 게이트는 감독자가 직접 돌린다. 에이전트 테스트 통과 보고는 근거가 아니다.

허용:
- 사용자가 **이번 메시지에서** 테스트/게이트를 하라고 적은 경우, 그 명령만.
- dirty 는 `wip:` 커밋 또는 파일 사본. stash 아님.

## SQLite project folder is mandatory (hard rule)

**에이전트는 SQLite 프로젝트 폴더 없이 게임/맵/이벤트 콘텐츠 작업을 끝내지 않는다.**
Supabase 는 퇴역했다. URL, anon key, `current_json` 업서트, `saveProjectToSupabase` 를
완료 조건으로 쓰지 마라. “코드 fixture만 만들고 끝”, “임시 세션에서만 돌려보기”,
“로컬 JSON export만” 은 **완료로 치지 않는다.**

### 반드시 지킬 것

1. **콘텐츠 작업(데모 게임, 마을, 맵, 이벤트, DB 레코드, 예제 어드벤처)을 시작하기 전에**
   - `OPRN_PROJECT_DIR`(또는 `--project-dir`) 아래 기존 `project.sqlite` 가 열리는지 확인한다.
   - 폴더가 없으면 **작업을 중단**하고 사용자에게 프로젝트 폴더를 요청한다. 메모리 어댑터로 때우지 않는다.

2. **작성·수정한 프로젝트 데이터는 그 SQLite 폴더에 저장한 뒤 다시 읽어야 한다.**
   - Electron 브리지 또는 `npm run serve:project` / `npm start` 의 호스트 저장을 탄다.
   - 저장 후 같은 폴더를 다시 열어 존재함을 증명한다.
   - 완료 보고에 **프로젝트 폴더** 와 저장 성공 근거를 남긴다.

3. **금지 — 아래만 하고 끝내지 말 것**
   - `?blankProject=1` / `?freshProject=1` / `dev-showcase` 임시 세션만 사용하고 폴더 저장을 건너뛴다.
   - 레포에 `*.json` fixture / `createSampleAdventureProject` 코드 시드만 추가·교체하고 **SQLite 미저장**.
   - “로컬 메모리·export JSON이면 충분”이라고 판단해 폴더 저장을 생략.
   - `remotePersistenceEnabled` 가 꺼진 상태에서 저장 버튼을 누르고 성공한 것처럼 보고.
   - Supabase 설정, 프록시, 마이그레이션을 다시 살린다.

4. **왜 강제인가**
   - `blankProject` / `freshProject` / 일부 `devProject` 쇼케이스는 의도적으로 `remotePersistenceEnabled = false` (`dev-showcase`) 이다. 이 경로에서는 저장이 폴더로 가지 않는다.
   - 브리지가 없으면 저장소는 메모리 어댑터다. 사용자 작업물의 정본은 **호스트 SQLite 폴더**다.

5. **허용되는 예외 (좁게)**
   - **순수 엔진/에디터 코드** 변경만 (UI, 인터프리터, 스키마 마이그레이션 등) 이고 맵·이벤트·데모 콘텐츠를 새로 저작하지 않는 경우 → 폴더 저장 의무 없음.
   - **단위 테스트용 최소 fixture** (`test/fixtures/...` 계약 테스트) — 앱에 싣는 “예제 게임/데모”가 아닌 경우만.
   - 사용자가 **명시적으로** “DB 없이 fixture만 / 코드만” 이라고 한 경우만 예외. 모호하면 SQLite 폴더 경로를 따른다.

6. **데모·예제 게임 작업 시 권장 순서**
   1. 프로젝트 폴더 확인
   2. 저장이 켜진 호스트에서 저작
   3. SQLite 저장 + 같은 폴더 재로드 검증
   4. (선택) 레포 fixture/코드 시드는 **폴더 저장 성공 후** 보조 산출물로만 추가

## Agent rules

- Treat `openwiki` as working context, not product UI.
- If you change architecture, editor workflows, runtime data shape, persistence, or test strategy, update the matching `openwiki/*.md` page in the same change.
- Keep project-specific knowledge inside this repo's `openwiki` directory. Other projects should have their own `openwiki/PROJECT_WIKI.md` and focused pages.
- Do not store API keys or live credentials in wiki files, scripts, evidence, or commits.
- Prefer focused validation. For UI changes, include browser evidence. For schema/runtime changes, include tests that prove load, migrate, save, and play behavior as relevant.
- **버전을 손으로 올리지 마라.** 릴리스는 `npm run release` 하나로 자르고, 매 머지에 끌려 올리는 것이 아니다.
  커밋 메시지가 릴리스 노트의 원본이다 — `feat:`/`fix:`/`refactor:` 규약을 지켜라. 네 버전 축(앱 · 문서 스키마 · 로컬 스토어 · 발행 게임)의
  구분과 절차는 `openwiki/release-and-version.md`.
- For **authored game content**, validation is incomplete until **SQLite folder load after save** succeeds (see hard rule above). Supabase is retired.
