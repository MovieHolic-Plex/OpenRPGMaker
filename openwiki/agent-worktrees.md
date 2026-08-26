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
npm run wt list               # 워크트리 + 배정 포트 + dirty/unmerged 표시
npm run wt remove <name>      # 제거 (--keep-branch 로 브랜치 보존)
npm run wt snapshot           # 현재 워킹트리를 커밋 객체로 박제(HEAD·인덱스 불변)
```

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

## 시각 판단 작업은 비전 있는 카테고리로 보낸다

**작업이 "그림을 보고 무엇인지 말하기"면, 배분할 카테고리의 1순위 모델이 이미지를 받을 수
있는지 먼저 확인한다.** 이걸 어겨서 2,856칸 데이터가 두 번 틀렸다.

실측(2026-08-26): 6종 EasyRPG 칩셋의 타일 시맨틱 저작을 24 샤드로 쪼개 배분했다. 샤드
`shard-retro_exterior-08-11` 은 카테고리 `unspecified-low` 로 갔고, 그 카테고리의 1순위는
`cliproxy/deepseek-v4-flash-0731` — **비전이 없다**. 그 샤드는 완료 보고에 이렇게 적었다:

> I read the four row images via pixel-level analysis (the model couldn't render them as images)

타일을 본 적 없이 픽셀 통계로 추론해 **4시간 38분 / 404만 토큰 / 툴 53회**를 쓰고 119칸 라벨을
만들었다. 결과물은 고유율 40%(다른 조각 80~100%)에 물건 자체가 틀렸다 — 253 "물"은 청회색 돌,
265 "나무 울타리"는 돌 묘비, 266 "금속 난간"은 석주 주두였다.

### 카테고리 1순위 모델 (2026-08-27 실측, `~/.omo/omo.jsonc`)

| 카테고리 | 1순위 | 비전 |
|---|---|---|
| `ultrabrain` `deep` `architect` `unspecified-high` | kiro/claude-opus-5 | 있음 |
| `visual-engineering` `artistry` `writing` | cliproxy/gemini-3.7-flash-tiered | 있음 |
| `unspecified-low` `quick` | cliproxy/deepseek-v4-flash-0731 | **없음** |

`unspecified-low` 와 `quick` 만 비전 없는 모델이 1순위다. 시각 작업은 `visual-engineering` 으로
보낸다. 폴백 목록에 비전 모델이 들어 있어도 소용없다 — 1순위가 응답하면 폴백은 안 돈다.

### 게이트로는 이 종류를 못 잡는다

`scripts/audit-tile-semantics-grounding.mts` 는 색·통행성 모순만 본다. **가구를 벽이라 불러도
색과 통행성은 맞을 수 있으므로** 물건 정체 오류는 원리적으로 통과한다. 실제로 이 데이터를
"위반 2/2856(0.07%)" 로 통과시켰고, 그 숫자를 데이터 품질로 읽으면 안 된다.

고유 라벨 비율·라벨 길이 같은 지표도 **예측력이 없다**. `retro_exterior rows-04-07` 은 고유율
100%·평균 10.7자로 24조각 중 최고점인데, 라벨 있는 24칸 전부를 가구·깃발인데 벽·문·창문으로
적은 최악의 구역이었다. 자신 있게 구체적으로 쓰인 라벨이 더 정확한 게 아니다.

### 판독 입력은 연속 아틀라스를 포함한다

`scripts/gen-chipset-strips.mts` 는 칩셋 1행(30타일)을 15열 x 2단으로 접는다. 그래서 세로로
이어지는 물건이 끊기고, 가로로 늘어선 물건은 벽처럼 보인다. 이 접힘이 **리드까지 속였다**:
`retro_house` 12-17 을 3x2 크롭으로 보고 2단 침대로 판정해 PR #86 에서 `role=furniture` 로
바꿨는데, 아래 4행까지 붙여 보면 분홍은 42-44/72-74 조석 벽판, 크림은 45-47/75-77 회벽판으로
이어지고 12-17 은 그 벽판들의 **상단 목재 머리보**였다. 침대가 아니다.

그래서 `scripts/gen-chipset-blocks.mts` 가 타일 경계선 없는 연속 아틀라스(4행 블록 + 시트 전체)를
굽는다. 격자선은 여러 칸 물건을 다시 쪼개므로 그리지 않고, 좌표는 아트 바깥 여백에만 찍는다.
판독자는 **인덱스 확실성은 strips 에서, 물건 연속성은 blocks 에서** 얻는다.

### 판독은 독립 2인 + 판정자

실측: 같은 타일을 두고 리드와 비전 자식이 각각 3분의 1쯤 틀렸다. 자식은 12-17(벽)·42-44(벽판)를
맞히고 179 를 "awning" 으로 틀렸고, 리드는 179(깃발)를 맞히고 앞의 둘을 틀렸다. **한 명의 판독은
근거가 아니다.** 샤드당 서로를 못 보는 판독자 2명을 돌리고, 기존 라벨은 판독자에게 주지 않는다
(앵커링). 대조와 판정은 별도 노드에서 하고, 두 판독이 갈리는 칸은 감독자가 직접 확대해 본다.

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
- **`git branch -d` 는 upstream 기준으로 거절한다** — main 에 병합됐어도 upstream 에 push 되지
  않았으면 "not yet merged" 로 막는다. 내용이 main 에 있으면 안전하지만, 거절 자체가
  "아직 push 되지 않았다"는 신호이므로 확인 없이 `-D` 로 밀지 말 것.
