# 기물 파생 — 실행·점검·복구·이관

설계와 한계는 [기물 파생 정본](interior-prop-derivations.md)을 먼저 읽는다.
아래 쓰기 명령은 운영자가 필요하다고 판단한 때만 실행한다. 인수인계 문서 조회를 위해 실행하지 않는다.

## 1. 실제 대상을 먼저 확인한다

2026-10-04 확인한 서비스:

| 항목 | 당시 값 |
|---|---|
| 통합 입구 | `http://mdc-server:18315/harness` |
| 기물 단독 화면 | `http://mdc-server:18315/harness/props` |
| 통합 유닛 | `super-harness.service`; 18312는 같은 프로세스의 이동 전용 |
| 통합 코드 | `/home/main/z-project/rpg-zzu-super-harness-unified` |
| 후보 콘텐츠 체크아웃 | `/home/main/z-project/rpg-zzu-interior-v34b` (`PROP_HARNESS_CONTENT_ROOT`) |
| 기물 데이터 | `/home/main/.local/share/oprn/prop-harness` |
| 선택 정본 | `/home/main/.local/share/oprn/hand-interior-pick/picks.sqlite` |
| 호스트 공용 정본 | `/home/main/.local/share/oprn/shared-content.sqlite` |
| 기존 공간 유닛/체크아웃 | `super-harness.service`, `/home/main/z-project/rpg-zzu-super-harness` |
| 공간 단독 화면 | `http://mdc-server:18315/spaces` |

고정 경로를 믿고 바로 편집하지 말고 다시 확인한다. 서비스의 전체 환경/명령 인자에는 비밀값이 있을 수 있어 출력하지 않는다.

```bash
systemctl --user show super-harness.service -p WorkingDirectory -p MainPID
git worktree list
```

읽기 API:

```bash
curl --fail --silent http://127.0.0.1:18315/api/super-harness/status
curl --fail --silent http://127.0.0.1:18315/api/harness/suggestions
curl --fail --silent --compressed http://127.0.0.1:18315/api/harness/state
```

state는 후보·판·검수·일꾼·공용 반영 상태를 포함한다. 연결 실패와 작업 실패를 구분한다. 통합 서비스·경로·복구 계약은 [통합 문서](super-harness-integration.md)를 따른다.
super status의 shared.revision은 실제 공용 DB 판본, publication.receipt는 마지막 게시 일꾼의 결과다.
둘이 다르면 게시 중이거나 외부에서 공용 행이 바뀌었는지 확인한다. 오래된 receipt만 보고 완료라고 하지 않는다.
기존 공간 `/api/state`는 무거운 디버그 응답이므로 일반 상태 확인에는 `/api/list`를 쓴다.

## 2. API와 쓰기 영향

| 메서드·경로 | 요청/결과 | 영향 |
|---|---|---|
| GET `/api/harness/derive/<원본ID>` | 파생 창 기본값·기존 묶음/크기 | 읽기; ID의 공백 등은 URL 인코딩 |
| GET `/api/harness/suggestions` | items/pending/alreadyOrdered | 읽기; 기존 원본 자동 제안 |
| POST `/api/harness/derive` | 아래 주문 예시 → ok/made | 정의 파일 갱신 + 제작 대기열·유료 모델 작업 |
| POST `/api/harness/draw` | ids/n/note/base/slot/round/rejects | 새 판 제작·재그림; 메모 크기 변경도 가능 |
| POST `/api/harness/decide` | id/round/choice/rejects/note → ok/children | 사용자 선택·자식 분할 저장·공용 게시 요청 |
| POST `/api/harness/publish` | `{}` | 현재 선택판 공용 재게시; 후보 선택 아님 |
| GET `/api/super-harness/materials` | 실제 공용 킷·binding·revision | 읽기 |
| GET `/api/super-harness/materials.zip` | 실제 공용 판본의 그림/정의/지침/receipt | 읽기·다운로드; 공간 실행기에 자동 설치하지 않음 |
| POST `/api/pick`, `/api/revert` | 옛 선택/이벤트 되돌리기 API | 선택 정본 변경 후 같은 공용 게시 대기열 |

**설명용 주문 예시이며 점검 목적으로 보내지 않는다:**

```json
{"id":"chair S","facing":true,"state":"","loop":false,"size":null,"note":"방향마다 같은 나무색"}
```

모션은 `loop:true`, 크기는 `size:[2,2]`, 상태는 `state:"열림"` 등이다. 종류를 함께 요청할 수도 있다.
응답 ok는 요청/정의 준비가 성공했다는 뜻이다. 비동기 후보 제작·선택·공용 게시까지 끝났다는 뜻이 아니다.
400=입력/후보/칸 오류, 409=오래된 판/중복 확정, 500=서버 처리 실패.
공용 자료 읽기 실패는 503이다. HTTP 실패 뒤에도 앞선 파일/자식 저장이 남을 수 있어 상태부터 다시 읽는다.

부분 재그림 예시: `{ids:["chair S #facing"],base:"h<N>-A",slot:"E",note:"등받이만 수정"}`.
실제 후보 이름을 사용하고 고정 칸 S는 요청하지 않는다. 새 판 번호를 읽어 확정한다.

## 3. 설정을 바꿀 때

| 변수 | 기본·역할 |
|---|---|
| `PROP_HARNESS_CONTENT_ROOT` | 후보·v5·new 정의·현재 시트를 가진 콘텐츠 체크아웃; 코드와 분리 가능 |
| `SUPER_HARNESS_CODE_ROOT` | 다른 세션의 최신 공간 코드 유지용 override; 기본 통합 체크아웃 |
| `PROP_HARNESS_DATA` | `~/.local/share/oprn/prop-harness`; 판·작업지시서·대기열·baseline |
| `HIP_DATA`, `HIP_DB` | `~/.local/share/oprn/hand-interior-pick`, 그 아래 picks.sqlite |
| `HIP_PICK` | picks_db의 export/import 폴더; common의 실제 후보 루트를 바꾸는 설정은 아님 |
| `OPRN_SHARED_CONTENT_SQLITE` | 명시하지 않으면 XDG_DATA_HOME 또는 `~/.local/share` 아래 `oprn/shared-content.sqlite` |
| `PROP_HARNESS_ENGINE` | 코드 기본 codex; 이미 기록된 판/유닛 설정도 확인 |
| `PROP_HARNESS_CODEX_MODEL` | 코드 기본 gpt-6.1-sol |
| `PROP_HARNESS_MODEL` | 엔진별 기본 모델을 덮는 값 |
| `PROP_HARNESS_EFFORT` | 기본 medium |
| `PROP_HARNESS_REVIEW_EFFORT` | 기본 codex=medium, claude=high |
| `PROP_HARNESS_REVIEW2_MODEL` | 깊은 기물 둘째 검수, 기본 claude-sonnet-5-5 |
| `PROP_HARNESS_PAR` | 코드 기본 32; 실행 중 유닛과 대기열에 적용된 값을 따로 확인 |
| `PROP_HARNESS_ATTEMPTS` | 기본 3(처음+재시도 2) |
| `PROP_HARNESS_TIMEOUT` | 기본 2400초 |
| `SUPER_HARNESS_ORIGIN` | 서버 조회 기본 http://127.0.0.1:18315; 브라우저는 같은 호스트의 이 포트 사용 |
| `HAND_INTERIOR_PICKS_JSON` | 격리 굽기에 전달하는 선택 스냅샷 파일 |
| `HAND_INTERIOR_PICKS=0` | 굽기에서 선택 적용을 끄는 옵션; 사용자 선택 반영 작업에는 사용하지 않음 |

서버 후보 기본 수는 현재 `harness.N_DEFAULT=2`이며 프런트엔드 `DRAW_N=2`다.
과거 README/로그의 5후보/16동시를 현재 설정으로 복사하지 않는다.
현재 화면은 실행 상태를 표시한다. 모델/동시성 변경을 문서만 보고 임의로 적용하지 않는다.
등록된 판은 rounds.root/brief/model/effort를 보존하므로 서버 설정 변경만으로 기존 판의 출처가 바뀌지는 않는다.

## 4. 읽기 전용으로 선택·공용 판본 확인

다음은 기본 경로 예시다. 사용자 지정 DB는 실제 경로로 바꾼다.
sqlite3 모듈을 `mode=ro`로 열어 현재 행만 읽는다. 실행 중인 저장소를 직접 UPDATE하지 않는다.

```python
from pathlib import Path
import sqlite3

pick_file = Path.home() / '.local/share/oprn/hand-interior-pick/picks.sqlite'
with sqlite3.connect(pick_file.as_uri() + '?mode=ro', uri=True) as db:
    print(db.execute('SELECT item_id,choice FROM current WHERE item_id=?',
                     ('chair S',)).fetchone())
    print(db.execute('SELECT id,kind,choice FROM events WHERE item_id=? ORDER BY id DESC LIMIT 5',
                     ('chair S',)).fetchall())

shared_file = Path.home() / '.local/share/oprn/shared-content.sqlite'
with sqlite3.connect(shared_file.as_uri() + '?mode=ro', uri=True) as db:
    print(db.execute('SELECT id,revision,updated_at FROM content_libraries WHERE id=?',
                     ('oprn-hand-interior-harness',)).fetchone())
```

필요한 라이브러리 한 행만 읽는다. 수 GB의 모든 payload를 한꺼번에 출력하지 않는다.
API에서 ZIP을 받으면 `receipt.json.hashes`를 파일 바이트 SHA-256으로 대조하고,
`library.json`의 바이트 SHA-256이 receipt.revision과 같은지 확인한다.
모션의 `.loop.json.sha256`는 RGBA 원시 화소이므로 계산 대상을 혼동하지 않는다.

## 5. 증상별 복구

| 증상 | 먼저 읽을 근거 | 대응과 피할 행동 |
|---|---|---|
| 제안 없음 | 원본 kind/use, 부모 메타, 선택, 기존 주문 | 새 원본은 선택 전이면 제외. 가족 대표/필터 확인. 추측으로 자동 주문하지 않음 |
| 주문은 ok지만 후보 없음 | state의 drawErrors, harness.sqlite의 rounds/runs, 로그 | 비동기 오류 해결. 재주문 전 기존 정의/부분 생성 확인 |
| lock/empty 실패 | 해당 rounds/h<N>/brief.md·lock.json, seed/base, 검사 이유 | 대상 밖 칸을 원래대로 두도록 하네스로 재제작. 검사 비활성화 금지 |
| 파생 FRONT 판정 이상 | 파생 review와 고정 원본 비교 | 일반 가구 절대 행 수를 묶음 전체에 적용했는지 확인 |
| 확정 409 | 현재 최대 round, 마지막 feedback | 상태 재로드. 옛 round를 속여 강제 확정하지 않음 |
| 확정 500, 자식만 저장됨 | current/feedback, 자식 파일, 응답/로그 | 같은 후보 재시도 가능 단계인지 대조. 여러 DB/파일의 일괄 rollback을 가정하지 않음 |
| 자식이 응답에서 빠짐 | slots.child, 자식 존재·canvas, children 목록 | 칸 건너뛰기 여부 확인. 부모 ok만으로 완료 취급하지 않음 |
| 모션 정지/미반영 | .loop.png/.loop.json/.png, items.animation, baked.json.skipped | 띠 크기·RGBA hash·f0·속도 대조. 모션을 단일 PNG로 대체하지 않음 |
| 공용 반영 실패 | publication.error, shared-publish.log, 실제 DB revision | 선택은 남음. 원인 해결 후 재시도. picks.json을 고쳐 선택을 지우지 않음 |
| 이전 번호 자료 없음 | 실제 DB revision과 baselines/<revision> | 같은 판본의 보존 자료로 복구. 최신 git의 다른 번호로 대체하지 않음 |
| 다른 프로젝트에 안 보임 | 같은 host/DB인지, projectDefaults, 공용 목록 load | 프로젝트 다시 열어 실제 tileset·asset·자료 확인. 다른 host면 이관 필요 |
| 원래 화면은 되는데 새 checkout은 안 됨 | 실제 root, 후보/items/sets, DB/rounds의 절대 path | git만으로 운영 데이터가 모이지 않음. 백업 대응 관계 대조 |
| 공간 서버 연결 대기 | super status, 18315의 /api/list | 공간 서비스 담당 확인. 통합 입구에서 임의로 resume하지 않음 |

공용 재등록이 필요할 때만 실제 기물 서비스 체크아웃에서
`python3 src/harnesses/interior-props/shared_publish.py --force` 또는 화면 재시도를 사용한다.
이 명령은 쓰기와 빌드를 수행한다. 후보 그림이나 선택은 만들지 않는다.
`harness.py bake`는 체크아웃의 산출물을 바꾸는 별도 수동 경로이므로
실행 중인 화면의 검증용으로 사용하지 않는다. 선택을 공용화하는 일반 경로는 격리 publish다.

## 6. 백업·이관

코드 PR은 운영 데이터 전체의 백업이 아니다.
선택과 크기 명세와 그림의 조합이 필요하며, picks.sqlite만 또는 candidates만으로 재현할 수 없다.

보존 대상:

1. 선택 DB(이력 포함), harness.sqlite, shared-publish.sqlite.
2. PROP_HARNESS_DATA의 rounds/logs/baselines, 후보 폴더 전체, items.json·sets.json.
3. 실제 체크아웃의 소스 버전, v5/공통 팔레트/참고 입력, resize.json과 모션 부속 파일.
4. 공용 DB 또는 해당 라이브러리의 판본을 가진 export. 다른 라이브러리까지 포함하는 DB 복구는 별도 작업.

실행 중인 SQLite 본체만 cp하지 않고 backup API로 일관된 사본을 만든다.
picks_db 자동 백업은 시작 시/매일, 보존 14개이며 후보나 다른 DB의 백업은 아니다.
여러 DB와 파일 전체가 같은 시점이라는 보장은 backup API만으로 얻을 수 없다.
쓰기가 멈춘 안정 시점을 확보하되, 중지 범위는 담당자/사용자의 기존 지시에 맞춘다.
데이터 보존을 이유로 다른 세션의 pool이나 공간 service까지 중지하지 않는다.

복구는 독립된 장소에서 시작한다. rounds.root/brief에 옛 절대 path가 있어 그대로 live pool에 연결하지 않는다.
common의 후보 루트는 ROOT에 묶이므로 PROP_HARNESS_DATA만 바꿔서는 격리되지 않는다.
실제 DB revision과 baseline, 각 choice의 후보 일식이 일치하는지 읽는다.
새 서버 start는 export·선택의 공용 누락 소급 등록을 시작하므로 읽기만 하는 복구 확인에 쓰지 않는다.
신구 서버를 같은 선택 DB/정의/후보 대상으로 동시에 운영하지 않는다.
이관 후 같은 대상을 load하여 선택·자식 정의·띠·공용 판본·실제 프로젝트 참조를 확인한다.
옛 데이터는 재로드 확인보다 먼저 삭제하지 않는다.

## 7. 검증과 PR 완료 보고

AGENTS의 테스트 제한을 지킨다. 사용자 명시가 없는 gates/vitest/전체 typecheck/stash는 금지다.
문서 변경은 링크/함수명/설정/스키마와 실제 소스의 대조, 차이·오탈자 확인을 기본으로 한다.
UI 근거는 기존 verify-shots에서 SUMMARY부터 읽는다. 검증을 위해 새 후보 주문·사용자 선택을 만들지 않는다.
순수 코드/문서에는 실제 게임 프로젝트 저장 의무가 없다.
실제 게임/맵/이벤트를 만들면 같은 SQLite 정본에서 save 후 load한다.

PR에 코드/자료 범위, 의존하는 미병합 변경, 기존 저장/브라우저 근거,
이번에 수행한 대조, 미확인 런타임/다른 host/공간 자동 수신을 적는다.
사용 중인 후보와 picks.json 등 대량의 dirty를 git add -A로 섞지 않는다.
다른 작업의 main/워크트리를 checkout/restart하지 않는다. 격리 PR 브랜치에서 충돌을 해결한다.
버전은 손으로 올리지 않는다. 일반 PR merge는 release 작업이 아니다.


## 2026-10-05 화면에서 저장 상태 확인

`/harness#materials`에서 실제 DB 게시 수·마지막 게시 시각·공용 기물 이름을 확인한다.
선택 직후의 5초 전송 대기와 서버 선택 저장, 공용 굽기 완료를 혼동하지 않는다.
영수증 판본과 실제 공용 행 판본이 일치할 때만 완료로 보여 준다.
새/기존 프로젝트 재로드 및 최신 12개 선택 픽셀 대조 근거는
`verify-shots/harness-props-ux/`와 [기물 파생 정본](interior-prop-derivations.md)의 마지막 절.

이번 화면 배포는 `src/harnesses/interior-props/web/index.html`, `super.html` 두 정적 파일이다.
활성 공간 작업을 끊지 않도록 서버를 재시작하지 않고, 원래 파일 해시가 제작 시작 기준과 같음을 확인한 뒤
완성된 파일만 원자적으로 교체했다. 운영 사본은 기물 DATA의 `ui-backups/`에 보관한다.
다른 세션의 공간 실행기 변경은 포함하지 않는다. 이후 코드 갱신 시 이 UI 커밋을 포함해야 한다.


### 그림 우선 UI 후속 배포 (2026-10-05)

기물 화면 후속 개편도 `web/index.html`과 `web/super.html` 두 정적 파일만 원자적으로 교체한다.
공간 실행기의 동시 작업 파일을 합치거나 서비스 재시작으로 큐를 끊을 필요가 없다.
이번 백업 위치·교체 전후 SHA-256은 `verify-shots/props-image-first/deployment.json`에 기록했다.
실서비스 GET의 두 HTML이 작성한 파일과 같은지 비교했고, 18315 통합 화면에서 읽기 전용으로 확인했다.

더블클릭 경로를 확인할 때 실서비스의 결정 API로 가짜 선택을 보내지 않는다.
별도 브라우저 컨텍스트에서 state GET을 고정하고 모든 비-GET 요청을 가로채 모의 성공/실패를 반환한다.
검사 종료 시 pagehide/sendBeacon도 실제 서버에 가지 않도록 차단을 유지한다.
조작 계약과 렌더 경계는 [기물 파생 문서](interior-prop-derivations.md)의 「이름·그림 먼저」 절을 따른다.


### 2026-10-05 제작 풀의 콘텐츠 경로 누락 복구

증상: HTTP 서비스는 `PROP_HARNESS_CONTENT_ROOT`를 가지고 있지만 `systemd-run --user`로 띄운
제작 풀의 `/proc/<MainPID>/environ`에는 없다. transient service는 호출 프로세스가 아닌 user manager
환경을 물려받는다. 후보가 코드 워크트리에 쓰이고, 실제 콘텐츠 워크트리의 v5/resize/기준 그림을
못 읽어 검수 `FileNotFoundError`가 난다. pool alive만으로 정상 제작이라고 판단하지 않는다.

`harness.ensure_pool`은 이제 콘텐츠/DB 경로와 모델·병렬도 등 명시한 비밀이 아닌 설정만
`--setenv=KEY=VALUE` argv로 전달한다. 전체 환경이나 자격 증명은 출력/전달 목록에 넣지 않는다.
HTTP 프로세스는 Python 모듈을 이미 로드했으므로 파일 배포만으로 기존 ensure_pool 함수가 바뀌지 않는다.
실행 중인 공간 업무 때문에 통합 서버를 재시작하지 않는 경우, 임시 서비스 prefix drop-in
`/run/user/<uid>/systemd/user/prop-harness-pool-.service.d/60-content-root.conf`의 `[Service] Environment=...`로
향후 풀에도 현재 콘텐츠 경로를 전달할 수 있다. 통합 서버가 수정 코드를 로드한 뒤 제거할 수 있다.

복구 풀에만 `PROP_HARNESS_RECOVER_ROOT=<잘못 저장된 코드 체크아웃>`을 지정한다.
`_recover_candidate`는 해당 판·후보 파일만 정본 후보 폴더로 복사하고 원본을 남긴다.
이미 있는 대상은 덮지 않고 충돌 시 중단한다. 메인 pxgrid를 마지막에 복사하며,
`technical-file-recovery` feedback에 경로와 pxgrid SHA-256을 기록한다. 사용자 pick을 만들지 않는다.
잘못된 경로로 시작했던 채택 작업도 `_finish`에서 파일을 가져와 기계 검사부터 진행한다.

살아 있는 제작 작업을 유지하며 풀 관리자만 교체한 절차:
1. 기존 풀 유닛에 한정한 runtime drop-in으로 `KillMode=process`를 설정하고 daemon-reload 후 실제 값을 확인한다.
2. 실행 중 run id/pid를 읽고 기존 유닛을 stop한다. 자식 PID 생존을 다시 확인한다.
3. 올바른 content root와 recovery root로 새 풀을 시작한다. pool의 기존 `_Adopted`가 살아 있는 PID를 이어받는다.
4. 기존 기술 오류는 `retry-review-errors <판...> --queue-only`로 실제 기계 검사를 다시 거쳐 검수에 올린다.
   크기/레이어 등 기계 검사가 실패하면 통과로 바꾸지 않는다. 그 경우 현재 크기 명세에 맞는 재제작이 필요하다.
5. API 상태뿐 아니라 새 풀의 경로 환경, 실제 검수 프로세스, 복구 파일을 확인한다.

후보·검수 DB 복구는 하네스 CLI/저장 계층으로 수행하며 SQLite SQL로 사용자 선택을 패치하지 않는다.
이번 인계 근거는 `verify-shots/props-worker-recovery/`이며, 전체 gates/vitest/typecheck는 실행하지 않았다.


이번 복구에서는 크기 검사에 맞는 기존 후보를 검수로 돌리고, 잘못된 경로 탓에 resize.json을
놓친 20종은 기존 판/파일을 보존한 채 최신 크기로 h728~h747 새 판을 만들었다.
복구 인계 당시 살아 있던 자식 13개를 모두 유지했다. 이후 새 풀에서 32작업 동시 진행을 확인했다.
재개는 완성 판정이 아니다. `live.json`은 작업 중 스냅숏이며 사용자가 후보를 고르기 전에는 공용 선택으로 게시하지 않는다.
기술 복구 history에도 `attempt`를 넣어 기존 상태 serializer와 호환한다. 재제작 지시문은
`hard`/`review` 판정만 읽도록 제한해 기술 이력이 마지막에 붙어도 KeyError가 나지 않게 했다.
기술 이력은 DB에 남고 사용자 선택은 바꾸지 않았다.
