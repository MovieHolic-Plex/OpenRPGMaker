# Agent Worktrees — 병렬 코드 작업 격리

여러 에이전트가 하나의 워킹트리를 공유하면 서로의 미완성 편집을 덮어쓰고, 검증이 움직이는
표적을 쫓게 된다. 이 페이지는 **코드(에디터/엔진) 작업**을 워크트리로 격리하고 감독하는 절차다.

## 적용 범위

| 작업 종류 | 워크트리 | 비고 |
|---|---|---|
| 에디터 UI · 인터프리터 · 스키마 · 런타임 코드 | **사용** | `AGENTS.md` §5 예외 — DB 저장 의무 없음 |
| 맵·이벤트·데모 등 **저작 콘텐츠** | **사용 금지(또는 project id 분리)** | Supabase 프로젝트 행이 공유 싱글턴이라 마지막 저장이 이긴다 |

워크트리는 **파일만** 분리한다. Supabase 행, 포트, `.env`, `node_modules` 는 별도 처리가 필요하며
아래 스크립트가 뒤의 셋을 자동으로 처리한다. Supabase 는 처리하지 않는다.

## 명령

```bash
npm run wt create <name>      # 워크트리 생성 (현재 워킹트리를 스냅샷해서 베이스로 삼음)
npm run wt adopt [name]       # 이 도구 밖에서 만든 기존 워크트리를 같은 규약으로 보정
npm run wt list               # 워크트리 + 배정 포트 확인
npm run wt remove <name>      # 제거 (--keep-branch 로 브랜치 보존)
npm run wt snapshot           # 현재 워킹트리를 커밋 객체로 박제(HEAD·인덱스 불변)
```

`adopt` 는 인자를 생략하면 등록된 모든 워크트리를 훑는다. 손으로 만든 워크트리는 보통
`node_modules` 나 `.env.local` 이 빠져 있고 포트가 겹치므로(전부 9999) 한 번 돌려두면 된다.

생성 시 자동 처리:

1. **베이스 스냅샷** — 미커밋 변경까지 포함한 커밋 객체를 만든다. 임시 인덱스(`GIT_INDEX_FILE`)를
   쓰므로 메인의 HEAD·인덱스·워킹트리를 건드리지 않는다. 다른 에이전트가 작업 중이어도 안전하다.
2. **위치** — 메인의 **형제** 디렉터리 `../rpg-zzu-<name>`. `vite.config.ts` 의 `server.fs.allow`
   가 `../rpg-zzu/node_modules` 를 허용하는데 이 상대 경로가 워크트리 루트 기준으로 풀리기 때문이다.
3. **node_modules 정션** — 윈도우 junction (관리자 권한 불필요). 수 GB 중복 방지.
4. **`.env` / `.env.local` 복사** — gitignored 라 워크트리에 따라오지 않는다.
5. **`DEV_SERVER_PORT` 고유 배정** — 9801부터. 메인이 `--port 9999 --strictPort` 를 점유한다.

워크트리에서 dev 서버는 반드시 **`npm run dev:worktree`** 로 띄운다. `npm run dev` 는 9999를
하드코딩하므로 메인과 충돌한다.

## 검증 게이트

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

## 백그라운드 워커 (qwencloud / qwen3.8-max-preview)

감독자(Claude)의 `Agent` 툴은 Claude 모델만 띄운다. qwen 에 일을 시키려면 툴 루프를 직접
돌려야 하며, 그 구현이 `scripts/qwen-worker.mjs` 다.

```bash
npm run qwen -- --task <task.json>
npm run qwen -- --prompt "..." --cwd ../rpg-zzu-<name> --name <name>
```

`task.json` 형식:

```json
{
  "name": "짧은-작업명",
  "cwd": "C:/Users/USER/Downloads/rpg-zzu-<worktree>",
  "maxSteps": 40,
  "prompt": "무엇을 · 어떻게 검증할지 · 무엇을 건드리지 말지"
}
```

- **엔드포인트**: `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
  (Alibaba Cloud MaaS, OpenAI 호환). 키는 `QWENCLOUD_API_KEY` — env 우선, 없으면
  `<cwd>/.env.local` 에서 읽는다(`wt create` 가 워크트리에 복사해둔다).
- **툴**: `read_file` `write_file` `edit_file` `list_files` `grep` `run_bash`
- **경로 이탈 차단**: 모든 파일 툴이 `--cwd` 밖을 거부한다. 다만 `run_bash` 는 셸이라 완전
  격리가 아니다 — **반드시 워크트리를 `--cwd` 로 준다. 메인 워킹트리를 주지 말 것.**
- **산출물**: `.omo/qwen-tasks/<name>-<stamp>/` 에 `log.jsonl`(툴 호출 전량) ·
  `status.json`(상태·스텝·토큰) · `result.md`(워커의 최종 보고)

### 감독자 사용법

`run_in_background` 로 띄우고 즉시 손을 뗀다. 종료되면 알림이 온다. 그 사이 감독자는 계속
대화 가능하다. 여러 작업을 동시에 던지려면 **워크트리를 작업당 하나씩** 만든다.

### 프롬프트에 반드시 넣을 것

`log.jsonl` 이 툴 호출을 전부 남기므로 워커가 실제로 무엇을 읽고 고쳤는지 사후 검증할 수 있다.
그래도 프롬프트에 아래를 명시해야 결과가 쓸 만해진다:

1. **검증 명령과 기대치** — "npx vitest run <파일> 이 통과해야 한다"
2. **건드리지 말 것** — 인접하지만 손대면 연쇄로 깨지는 영역을 미리 차단한다
3. **막히면 추측 말고 보고** — 반쯤 고친 상태로 끝내는 것이 조용히 틀리는 것보다 낫다

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
- **외부 에이전트 세션** — 워크트리는 *이 도구로 띄운* 에이전트만 격리한다. `.codex/`,
  `.qoder/`, `.senpi/` 등 다른 툴이 메인 트리에 붙어 있으면 그대로 충돌한다. 병렬 작업 전에
  다른 세션이 도는지 확인한다.
- **워크트리는 베이스 시점의 스냅샷** — 생성 후 메인에 들어온 변경은 반영되지 않는다.
  장시간 작업이면 주기적으로 rebase 한다.
