> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

# Agent Worktrees — 병렬 코드 작업 격리

여러 에이전트가 하나의 워킹트리를 공유하면 서로의 미완성 편집을 덮어쓰고, 검증이 움직이는
표적을 쫓게 된다. 이 페이지는 **코드(에디터/엔진) 작업**을 워크트리로 격리하고 감독하는 절차다.

## hard rule — gates / vitest / stash 금지 (2026-09-17)

워크트리 에이전트는 `npm run gates`, `npm test`, `npx vitest`, `scripts/run-vitest.mjs`,
전체 typecheck, `git stash`(push/pop/apply) 를 **실행하지 마라.** 사용자가 **이 세션에서**
테스트/게이트를 돌리라고 명시한 때만 그 명령만 돌린다. "검증하려고 잠깐",
"changed 만", "한 축만" 도 시키지 않았으면 금지. dirty 는 `wip:` 커밋 또는 파일 사본.
게이트는 감독자가 돌린다. 정본: `AGENTS.md` «워크트리·세션 에이전트는 gates / vitest / stash 금지».

## 적용 범위

| 작업 종류 | 워크트리 | 비고 |
|---|---|---|
| 에디터 UI · 인터프리터 · 스키마 · 런타임 코드 | **사용** | `AGENTS.md` §5 예외 — DB 저장 의무 없음 |
| 맵·이벤트·데모 등 **저작 콘텐츠** | **사용 금지(또는 project id 분리)** | LegacyDb 프로젝트 행이 공유 싱글턴이라 마지막 저장이 이긴다 |

워크트리는 **파일만** 분리한다. LegacyDb 행, 포트, `.env`, `node_modules` 는 별도 처리가 필요하며
아래 스크립트가 뒤의 셋을 자동으로 처리한다. LegacyDb 는 처리하지 않는다.

## 명령

```bash
npm run wt create             # 이름 생략 가능 — wt-MMDD-HHMM 자동 부여
npm run wt create <name>      # 워크트리 생성 (현재 워킹트리를 스냅샷해서 베이스로 삼음)
npm run wt create <name> --base origin/main   # 깨끗한 최신 main 기반으로 만들 때
npm run wt adopt [name]       # 이 도구 밖에서 만든 기존 워크트리를 같은 규약으로 보정
npm run wt list               # 워크트리 + 배정 포트 + dirty/unmerged 표시
npm run wt remove <name>      # 제거 (--keep-branch 로 브랜치 보존)
npm run wt snapshot           # 현재 워킹트리를 커밋 객체로 박제(HEAD·인덱스 불변)
```

## `git stash` 를 쓰지 마라 (실측 2026-09-10, 남의 작업을 꺼내 버렸다)

**stash 목록은 저장소 하나에 하나뿐이고 모든 워크트리가 공유한다.** 워크트리마다 따로가 아니다.

실측: `agent/uievidence` 워크트리에서 「고친 코드를 되돌려 캡처 스크립트가 정말 잡는지」
음성 대조를 하려고 `git stash push <파일 둘>` → 스크립트 실행 → `git stash pop` 을 했다.
그 사이에 다른 세션이 stash 를 하나 더 밀어 넣어 `stash@{0}` 이 바뀌었고, 내 pop 은
**그 세션의 stash** 를 꺼냈다. 결과:

- 내 수정은 파일에서 사라진 채 stash 항목도 소비됐다(손으로 다시 썼다).
- 남의 추적 파일 변경 2개 + 미추적 테스트 6개가 내 워킹트리에 쏟아졌다.
- 그 상태로 돌린 음성 대조는 **가짜 초록**이었다 — 되돌렸다고 믿은 코드가 실은 그대로였다.

대신 이렇게 한다. 파일 단위로, 사본으로:

```bash
cp src/x.ts /tmp/x.fixed.ts            # 내 수정을 사본으로 뜬다
git show HEAD:src/x.ts > src/x.ts      # 기준선으로 되돌린다 (stash 아님)
node scripts/qa/<capture>.mjs          # 음성 대조 — 여기서 FAIL 이 나와야 단언이 살아 있다
cp /tmp/x.fixed.ts src/x.ts            # 사본에서 복원
grep -c <표식> src/x.ts                # 복원됐는지 눈으로 확인한다
```

되돌린 뒤에는 **dev 서버가 정말 그 코드를 서빙하는지** 확인하라 —
`curl -s http://127.0.0.1:<포트>/src/x.ts | grep -c <표식>`. HMR 이 물고 있으면
음성 대조가 조용히 통과한다.

## 회수 규칙 (커밋이 유일한 안전망)

**미커밋 작업은 git 이 지켜주지 않는다.** 브랜치를 지워도 커밋 객체는 reflog·`git fsck` 로
회수되지만, 커밋되지 않은 편집은 되돌릴 방법이 없다. 그래서 `remove` 는 기본적으로 거부한다:

- 워크트리에 미커밋 변경이 있으면 → 목록을 보여주고 중단. 정말 버릴 때만 `--force-dirty`.
- 브랜치에 `main` 으로 안 들어간 커밋이 있으면 → 중단. `--keep-branch` 로 브랜치만 보존 가능.

실측(2026-08-21): 워크트리 10개 중 5개에 미커밋 작업이 8~34개 파일씩 방치돼 있었다. 브랜치는
전부 `main` 에 병합돼 있어 `git branch -vv` 로는 정상처럼 보였다 — dirty 는 워크트리 안에만
드러나기 때문이다. `wt list` 가 `dirty=` / `unmerged=` 를 함께 찍는 이유다.

### 에이전트에게 줄 지시

```
- 논리 단위가 끝날 때마다 커밋하라. 각 커밋은 혼자 성립해야 한다(빌드가 깨진 중간 상태 금지).
- 손을 뗄 때(완료·중단·막힘 무관) 남은 변경은 `wip:` 로 커밋하라.
- 배정된 워크트리 브랜치에만 커밋하라. main 체크아웃·병합·push 금지.
- PR 은 만들지 말라. 게이트와 병합은 감독자가 한다.
- `npm run gates` / `npm test` / vitest / `git stash` 금지. 사용자가 이 세션에서 시키기 전에는 실행하지 마라.
```

트리거는 "작업이 끝나면"이 아니라 **"손을 뗄 때"**다. 컨텍스트 소진·툴 실패·사용자 중단으로
끊긴 세션은 "끝"에 도달하지 못하므로, 종료를 트리거로 삼은 지시는 실행되지 않는다.

워크트리는 파일만 격리하고 **git 디렉터리와 브랜치 네임스페이스는 공유**한다. 에이전트가
`main` 을 체크아웃하거나 병합하면 다른 워크트리가 함께 흔들린다.

인위적 분할은 금지다. 작은 커밋의 조건은 "작다"가 아니라 **"각 커밋이 성립한다"** 다 —
깨진 중간 상태를 커밋하면 `git bisect` 가 오히려 못 쓰게 된다. 얽혀서 못 쪼개면 한 커밋으로
두고 커밋 메시지에 이유를 남긴다.

`adopt` 는 인자를 생략하면 등록된 모든 워크트리를 훑는다. 손으로 만든 워크트리는 보통
`node_modules` 나 `.env.local` 이 빠져 있고 포트가 겹치므로(전부 9999) 한 번 돌려두면 된다.
Herd New worktree 훅은 `npm run wt adopt -- --path <checkout>` (또는 `WT_WORKTREE_PATH`) 로
그 체크아웃만 보정한다.

생성 시 자동 처리:

1. **베이스 스냅샷** — 미커밋 변경까지 포함한 커밋 객체를 만든다. 임시 인덱스(`GIT_INDEX_FILE`)를
   쓰므로 메인의 HEAD·인덱스·워킹트리를 건드리지 않는다. 다른 에이전트가 작업 중이어도 안전하다.
2. **위치** — 메인의 **형제** 디렉터리 `../rpg-zzu-<name>`. `vite.config.ts` 의 `server.fs.allow`
   가 `../rpg-zzu/node_modules` 를 허용하는데 이 상대 경로가 워크트리 루트 기준으로 풀리기 때문이다.
3. **node_modules 정션** — 윈도우 junction (관리자 권한 불필요). 수 GB 중복 방지.
4. **`.env` / `.env.local` 복사** — gitignored 라 워크트리에 따라오지 않는다.
5. **`DEV_SERVER_PORT` 고유 배정** — 9801부터(9888 preview·9999 메인 dev 는 예약). 메인이 `--port 9999 --strictPort` 를 점유한다.

워크트리에서 dev 서버는 반드시 **`npm run dev:worktree`** 로 띄운다. 두 스크립트는 `scripts/dev-server.mjs`
를 지나며(2026-09-17), 거기서 포트가 고정된다:

- `npm run dev` 는 **링크된 워크트리에서 거절**된다(`.git` 이 gitfile 이면 워크트리). 명시 `--port`(예약 아닌 값)
  가 있을 때만 통과 — playwright 의 `webServer` 가 그렇게 부른다.
- `npm run dev:worktree` 는 포트를 **스스로 배정·기록**한다. `.env.local` 의 값이 없거나, 다른 체크아웃과
  겹치거나, 예약 포트면 미배정으로 보고 새 값을 `.env.local` 에 쓴다. 한 번 기록되면 같은 워크트리 = 같은 포트.
  `.env.local` 이 없으면 메인 것을 복사(원본 배정 줄은 지움)한 뒤 기록한다. 명시 `-- --port N` 은 임시 우회다.
- 실측(2026-09-17): 체크아웃 21개 중 9개가 메인의 `.env.local` 을 손으로 복사해 **전부 9841** 이었다.
  `wt adopt` 도 「값이 있으면 그대로」 라 이 겹침을 못 고쳤다 — 지금은 `adopt` 도 같은 규칙으로 다시 배정한다.

### 동시 생성 (에이전트 수십 개)

`wt create` 는 포트 스캔→기록 구간을 `.git/wt-port.lock` (mkdir 락, 60초 경과 락은 회수)로
직렬화하므로 병렬로 실행해도 포트가 겹치지 않는다 (2026-09-12, 3개 동시 생성 실측).
`snapshot()` 도 임시 `GIT_INDEX_FILE` 을 쓰므로 동시 실행에 안전하다.

```bash
for t in task-a task-b task-c; do npm run wt create "$t" & done; wait
```

다만 병렬로 늘리면서 공유되는 것들:

- **node_modules 는 메인 것의 심링크 하나** — 어느 워크트리든 `npm install` 로 버전을 바꾸면
  전부에 적용된다. 의존성 변경은 직렬화하거나 메인에서 먼저 한다.
- **브랜치 네임스페이스·`.git` 은 공유** — 에이전트의 main 체크아웃·병합·push 금지 규칙이
  그대로 적용된다.
- **LegacyDb 프로젝트 행은 싱글턴** — 저작 콘텐츠 작업은 병렬화 금지(AGENTS.md hard rule).
- **dev 서버/e2e 는 리소스가 크다** — 수십 개가 동시에 vite·playwright 를 띄우면 CPU/메모리가
  먼저 한계에 간다. 생성 자체는 가볍고, 서버는 필요한 것만 띄운다.

### e2e 는 `DEV_SERVER_PORT` 없이 돌리면 **남의 코드를 검증한다** (실측 2026-08-29)

`playwright.config.ts` 의 기본 포트는 9173 이고 `webServer.reuseExistingServer` 가 `true` 다.
다른 워크트리가 9173 을 이미 점유하고 있으면 playwright 는 **서버를 새로 띄우지 않고 그것을
재사용한다**. 실측: `.claude/worktrees/db-structures-editor` 에서 돌린 구조물 편집기 e2e 3케이스가
전부 실패했는데, 실패 스냅샷의 도구줄에는 그 브랜치가 지운 옛 힌트칩이 그대로 있었다 —
브라우저가 보던 것은 `/home/main/.herdr/worktrees/rpg-zzu/worktree`(다른 브랜치)의 dev 서버였다.
`DEV_SERVER_PORT=<고유 포트>` 를 주고 다시 돌리자 3/3 통과했다.

- `playwright.config.ts` 의 기본 포트는 이제 **이 체크아웃의 고정 포트**(`.env.local` DEV_SERVER_PORT)다
  (2026-09-17). 9173 으로 떨어지는 것은 `.env.local` 에 배정이 없을 때뿐이다 — `npm run dev:worktree` 를 한 번
  띄우면 배정이 생긴다. 명시 `DEV_SERVER_PORT` env 는 여전히 이긴다.
- `npm run wt create` 로 만든 워크트리는 9801부터 고유 포트를 받으므로 이 함정에 걸리지 않는다.
- **손으로 만든 워크트리**(`.claude/worktrees/*`, Paseo, codex, `git worktree add` 직접 호출 등)도
  `npm run dev:worktree` 가 첫 실행에서 배정한다. `node_modules` 정션·env 복사까지 필요하면
  `npm run wt adopt -- --path <checkout>`.
- 이 실패 모드는 **조용하다**. 운이 나쁘면 실패가 아니라 "통과"로 보인다 — 남의 워크트리가
  같은 기능을 이미 갖고 있으면 내 변경을 검증하지 않고 초록이 뜬다. 확인 방법:
  `ss -tlnp | grep <port>` 로 pid 를 얻고 `ls -l /proc/<pid>/cwd` 로 그 서버의 워크트리를 본다.

## 검증 게이트

### 통합 작업의 검증 대상 고정 (2026-09-06)

- 공유 트리에 미커밋 작업이 있으면 최신 `origin/main` 기반 격리 트리에서 병합·검증·빌드한다.
  원격 PR 목록만 확인하고 오래된 공유 `main`을 재빌드하는 것은 통합이 아니다.
  배포 결과에는 빌드한 커밋과 미반영 PR을 구분해 기록한다.
- 여러 병합 동안 개발 서버를 계속 켜 두면 실제 앱이 `store.ts?t=...`를 사용하고 테스트의
  `import('/src/project/store.ts')`는 다른 인스턴스를 읽을 수 있다. 실측: UI와 실제 store는
  X=23·셀 2개인데 테스트 import는 X=0을 반환했다. 최종 코드가 정해지면 자기 QA 서버를
  재시작하고 `E2E_FREEZE_DEV_SERVER=1`로 검증한다. 기대값이나 제품 코드를 바꿀 문제가 아니다.
- `npm run wt`의 배정 포트도 실행 중인 프로세스와 충돌할 수 있다. `ss`로 확인하고 자기 서버에만
  명시적 포트를 준다. 남의 서버를 종료하거나 다른 워크트리의 서버를 재사용하지 않는다.

```bash
npm run gates                    # 실행 + 기준선 대비 회귀 판정
npm run gates -- --save-baseline # 현재 상태를 기준선으로 기록
npm run gates -- --json          # 기계 판독용
npm run gates -- --only typecheck
```

### 왜 기준선 방식인가

이 저장소의 테스트 기준선은 **이미 빨간불**이다(기록 시점: `typecheck:app` 초록, `vitest`
205 failed / 5600 passed / 5809 total / 90 failed files (captured 2026-08-19, `.omo/gates-baseline.json`). "전부 초록"을 요구하면 게이트가 무용지물이 되므로,
기준선 대비 **새로 생긴** 실패만 회귀로 취급한다.

- typecheck: 파일별 오류 수가 기준선보다 **늘어난** 파일만 회귀
- vitest: 기준선에 없던 **새 실패 파일**만 회귀

기준선은 `.omo/gates-baseline.json` (gitignored). 기준선이 바뀔 만한 작업 뒤에는 갱신한다.

### 왜 별도 스크립트인가

에이전트의 자기보고와 파이프를 거친 종료 코드를 **믿을 수 없다**. 실측 사례:

- 백그라운드 실행기가 `exit 0` 을 보고했지만 실제로는 `typecheck:app` exit 2, `vitest` exit 1
- `tsc ... | tail` 처럼 파이프를 태우면 `$?` 가 `tail` 의 코드가 되어 항상 0

`verify-gates.mjs` 는 `spawnSync().status` 로 **진짜 종료 코드**를 읽는다.

## 감독 절차

1. `npm run wt create <name>` — 에이전트마다 하나
2. 에이전트에게 `cwd` 와 배정 포트를 명시해서 지시
3. 작업 종료 후 **감독자가 직접** 해당 워크트리에서 `npm run gates` 실행
   — 에이전트의 "통과했습니다"를 근거로 쓰지 않는다
4. `git -C ../rpg-zzu-<name> diff <base>..HEAD` 로 실제 변경분 검토
5. 병합 후 메인에서 **다시** `npm run gates`
   — 개별 워크트리가 각각 초록이어도 합치면 깨진다. 실측: 매니페스트 엔트리 하나가
   30여 개 테스트를 연쇄로 깬 사례가 있다.

## 알려진 함정

- **`nul` 파일** — 셸에서 `> nul` 오타로 생기는 Windows 예약 장치명. git 이 인덱싱에 실패해
  `git add -A` 가 통째로 죽고 스냅샷이 차단된다. `.gitignore` 에 등록돼 있으나, 다른 형태의
  예약명(`con`, `aux`, `prn`)이 생기면 같은 증상이 난다.
- **Herd New worktree** — 브랜치+체크아웃만 만든다. `worktree-hooks` 플러그인이 create/open 때
  `wt adopt --path` 를 돌린다. 업스트림 플러그인은 Linux/macOS·`python3` 전제라 Windows 에서는
  Git bash + `python.exe` 로 링크한 로컬 사본을 쓴다.
  `.qoder/`, `.senpi/` 등 다른 툴이 메인 트리에 붙어 있으면 그대로 충돌한다. 병렬 작업 전에
  다른 세션이 도는지 확인한다.
- **워크트리는 베이스 시점의 스냅샷** — 생성 후 메인에 들어온 변경은 반영되지 않는다.
  장시간 작업이면 주기적으로 rebase 한다.
- **병합 후 revert 는 가드가 못 잡는다** — `git rev-list main..<branch>` 도 `git cherry` 도
  ancestry 기반이라, 병합한 뒤 그 머지를 revert 하면 커밋은 여전히 main 의 조상이므로 둘 다 0 을
  보고한다. 내용은 main 에 없는데 `wt list` 는 `clean` 으로 보인다. 실측(2026-08-21):
  `agent/db-collection-tabs-hardening` 이 이 상태다. revert 한 브랜치는 **손으로 기록**하고
  지우지 말 것.
- **윈도우 정션은 `unlink` 로 안 지워진다** — `node_modules` 정션에 `unlinkSync` 를 쓰면
  `EPERM`, `rmSync({recursive:false})` 는 `ERR_FS_EISDIR` 이다. `rmdirSync` 가 정답이다
  (정션이므로 링크 대상은 따라 들어가지 않는다). 이 지점에서 던지면 워크트리가 등록된 채 남아
  다음 실행이 같은 곳에 계속 걸리므로 `remove` 는 경고만 하고 진행한다.
- **디렉터리 껍데기는 외부 프로세스가 잡는다** — Herd·파일 워처가 핸들을 쥐고 있으면
  `git worktree remove` 가 등록은 풀어도 디렉터리 삭제는 `Permission denied` 로 실패한다.
  `git worktree list` 가 정본이다. 껍데기는 프로세스가 놓은 뒤 지우면 된다.
- **커밋 이후에 생긴 미추적 파일** — `git add -A` 는 그 시점에 없던 파일을 담지 못한다.
  워크트리를 지우기 전에 `ls` 로 남은 파일을 직접 확인할 것. 실측: 커밋 후 생성된 831줄 스크립트
  (`scripts/gen-combined-town-chipset-report.mts`)가 정리 중에 발견돼 회수됐다.
- **tmpfs 워크트리는 재부팅에 통째로 증발한다** — `/dev/shm`, `/tmp` 아래에 둔 워크트리는
  디렉터리가 사라진 채 등록만 남는다. 이 상태에서 `wt list` 가 `spawnSync git ENOENT` 로
  죽었는데, 원인은 git 부재가 아니라 `dirtyFiles()` 가 **없는 `cwd` 로 spawn** 하기 때문이었다
  (2026-09-12 실측). 사라진 등록은 `.git/worktrees/<id>/locked` 를 지우고
  `git worktree prune` 하면 정리된다. 스크립트는 이제 missing 경로를 `missing(prune 대상)`
  으로 표시하고 죽지 않는다.
- **원본 `.env.local` 의 `DEV_SERVER_PORT` 가 복사돼 고유 배정이 무력화됐었다** — 원본에
  `DEV_SERVER_PORT=9841` 이 있으면 provision 이 그대로 복사해 "이미 배정됨" 으로 건너뛰고,
  최근 생성분 전부가 9841 을 공유하게 됐다(2026-09-12 실측). 같은 포트를 공유하는 두
  워크트리에서 e2e 를 돌리면 위의 `reuseExistingServer` 함정에 걸린다. 스크립트는 이제
  새로 복사하는 `.env.local` 에서 `DEV_SERVER_PORT` 줄을 지우고 새로 배정한다.
- **`git branch -d` 는 upstream 기준으로 거절한다** — main 에 병합됐어도 upstream 에 push 되지
  않았으면 "not yet merged" 로 막는다. 내용이 main 에 있으면 안전하지만, 거절 자체가
  "아직 push 되지 않았다"는 신호이므로 확인 없이 `-D` 로 밀지 말 것.
