# 슈퍼하네싱 — 기물·파생·공간의 한 서비스

사용자 요청(2026-10-04): 기물 파생과 기존 슈퍼하네스를 실제 합친다.
PR #2056의 별도 서버 iframe 연결을 `unified.py`의 한 프로세스·한 서비스로 대체한다.

## 운영 계약

- 정식 입구 **http://mdc-server:18315/** 또는 `/harness`.
- `super-harness.service`가 공간 데몬, 기물 상태, 사용자 선택 API, 공용 게시 요청을 함께 소유한다.
- 18312는 같은 프로세스의 HTTP 307 이동 전용 소켓이다. 그 주소에 기물 실행기/DB 연결/별도 작업 대기열은 없다.
- 탭은 같은 18315 origin의 `/harness/props`, `/spaces`, `/orders`를 연다.
  iframe은 각 화면의 작성 상태를 보존하는 뷰이며 다른 서비스로 연결하지 않는다.
- 상태는 `super_bridge.attach_space(sh.gallery_list)`로 직접 읽는다. 통합 운영 중 loopback HTTP를 사용하지 않는다.
- Python `store` 충돌을 막기 위해 기물 모듈을 `src.harnesses.interior-props` 패키지로 로드한다.
  공간 store와 기물 store가 같은 모듈이면 시작을 거부한다. 기존 CLI도 같은 패키지로 들어간다.
- 후보 제작·공용 게시의 자식 작업자는 기존 프로세스 잠금과 내구성 있는 대기열을 유지한다.
  통합은 유료 그림 제작, 사람 대신 선택, 공간 큐 재개를 발생시키지 않는다.

## 실행과 경로

```bash
python3 src/harnesses/super-harness/unified.py run
# HTTP만 필요한 별도 운영 환경
python3 src/harnesses/super-harness/unified.py serve --port 18315 --legacy-port 0
```

기본은 현재 코드 체크아웃에서 두 실행기를 로드한다. 모든 소켓을 먼저 바인딩한 후 초기화한다.
같은 공간 데이터 폴더의 `unified.lock`으로 통합 프로세스 중복을 거부한다.

| 설정 | 계약 |
|---|---|
| `SUPER_HARNESS_PORT` | 통합 서비스 포트, 기본 18315 |
| `SUPER_HARNESS_LEGACY_PORT` | 이전 주소 이동, 기본 18312; 0은 비활성화 |
| `PROP_HARNESS_CONTENT_ROOT` | 후보·팔레트·v5·new/items·sets·현재 시트의 콘텐츠 체크아웃; 기본 코드 ROOT |
| `SUPER_HARNESS_CODE_ROOT` | 선택적 공간 코드 체크아웃; 기본 통합 코드 ROOT |
| `PROP_HARNESS_DATA`, `HIP_DATA`, `HIP_DB`, `SUPER_HARNESS_DATA` | 기존 정본 SQLite 위치를 유지 |

2026-10-04 운영 코드: `/home/main/z-project/rpg-zzu-super-harness-unified`.
기물 콘텐츠는 `/home/main/z-project/rpg-zzu-interior-v34b`에 유지한다. 미커밋 후보 파일을 옮기거나 버리지 않는다.
전환 초기에 다른 세션의 공간 코드를 `SUPER_HARNESS_CODE_ROOT`로 연결했다.
그 세션의 최신 수정(#2073)이 main에 들어온 뒤 통합 브랜치에 병합했고, 최종 서비스에서는 override를 제거했다.
현재 기물·공간 코드 모두 위 통합 체크아웃에서 실행한다. 기존 공간 체크아웃 소스는 수정하지 않았다.
다른 세션이 서비스를 재시작해도 systemd drop-in의 통합 ExecStart가 유지된다.

공간 DB, 기물 DB, 선택 DB, 공용 DB는 도메인별 기존 파일을 유지한다.
서비스 통합을 이유로 DB 테이블을 합치거나 초기화하지 않는다. paused 값과 선택/이력/판 번호가 그대로 이어져야 한다.
`HIP_PICK`은 선택 내보내기 경로만 바꾼다. 후보 위치는 CONTENT_ROOT의 pick/candidates다.
격리 공간 그림 작업이 설정한 HIP_PICK을 후보 경로로 오해하면 안 된다.

공용 게시 snapshot은 코드 ROOT에서 도구를 복사하고 CONTENT_ROOT에서 그림 입력을 복사한다.
격리 굽기 자식 환경에서는 CONTENT_ROOT와 HIP_PICK을 제거하여 고정 사본만 읽는다.
원래 공용 baseline의 칸 번호 고정 계약도 유지한다.
공간 실행기의 자식 환경에서는 라이브 기물 콘텐츠·선택·하네스 DB 경로를 제거한다.
`art_execution.prepare`도 CONTENT_ROOT/HIP_DB 상속을 지워 격리 후보가 라이브 선택 폴더에 섞이지 않게 한다.

## API

| 경로 | 담당 |
|---|---|
| `/api/harness/*`, `/api/pick`, `/api/revert`, `/c/*`, `/ctx/*`, `/out/*` | 기존 기물/선택 API |
| `/api/list`, `/api/state`, `/api/concept`, `/api/art-choices`, `/api/action`, `/thumb`, `/md/*`, `/data/*` | 기존 공간 API |
| `/api/super-harness/status` | 직접 연결된 공간 상태·기물 공용 게시 상태 |
| `/api/super-harness/materials`, `/materials.zip` | 실제 공용 DB 행의 고정 자료 |
| `/api/super-harness/runtime` | unified, pid, port, 정본 경로; 실행 소유 확인 |

`/api/state`는 공간 디버그 응답이고 기물은 `/api/harness/state`다. 이름을 충돌시키지 않는다.
자료 ZIP에는 library/catalog/tileset/atlas/참고문서/receipt SHA-256이 있고 미선택 후보는 없다.
기물 확정은 같은 picks.sqlite 저장 후 같은 공용 SQLite에 자동 게시한다.

## 공간 제작에서의 공용 재료 사용

서버 통합은 재료 승인을 대신하지 않는다. 현재 공간 gate는 작업 체크아웃 안의 실제 파일·JSON pointer·해시와
시대별 native 재료를 요구한다. 공용 팩 자동 설치와 예제 시공까지 승인한 상태라고 보고하지 않는다.
자료를 해당 작업에 연결한 뒤 survey → 독립 material-review → 예제 저작·렌더 검수를 거친다.
`stamp_object` binding은 `kit:shared_hand_interior_harness/<kit id>`이며
`build_hand_interior_room`의 고정 번들 번호와 혼용하지 않는다.

## 이관·복구와 확인

서비스 전환 전 두 큐의 실제 진행 작업이 0인지 확인하고 SQLite backup API로 선택/기물/공간 DB를 보존한다.
전환 사본은 공간 DATA의 `migrations/<시각>-unified`에 둔다(비밀 환경을 저장소에 커밋하지 않는다).
기물의 기존 후보 폴더와 공용 baseline은 이동하지 않는다. shared-content.sqlite도 새 DB로 대체하지 않는다.

1. `systemctl --user show super-harness.service -p MainPID -p WorkingDirectory`.
2. `/api/super-harness/runtime`의 pid가 서비스 MainPID인지 확인.
3. 18312 응답 Location이 같은 호스트 18315이고, 네 탭의 URL이 모두 같은 origin인지 확인.
4. 기존 개념 수/paused, 기물 판/선택 수, 선택 레코드 해시, 실제 공용 revision을 전환 전후 대조.
5. 후보 그림과 자동 제안이 보이는지 확인한다. 점검 목적으로 draw/derive/decide/resume을 POST하지 않는다.

복구는 통합 서비스를 멈추고 `~/.config/systemd/user/super-harness.service.d/unified.conf`를
이관 사본에 옮겨 비활성화한다. 원래 super-harness.service를 복원하고,
원래 transient prop 유닛 사본은 `~/.config/systemd/user/prop-harness-test.service`로 복원한 뒤 daemon-reload한다.
18312와 18315의 바인딩 충돌이 없도록 원래 두 서비스만 재시작한다.
이미 저장된 새 선택이 있으면 DB backup을 덮어쓰지 말고 현재 DB로 계속 운영한다.
전체 gates/vitest는 이 세션에서 실행하지 않는다. 실제 HTTP·브라우저·정본 읽기 증거는
`verify-shots/super-harness-unified/`에 남긴다.

## 공간의 실시간 진행 표시 (2026-10-05)

`/spaces`는 `/api/activity`를 5초마다 읽고 상세 화면 상단을 갱신한다. 전체 자동 큐의 pause와
별도 실행기의 작업을 분리해 보여 준다. 기존 문서·후보·교정 입력을 자동 재생성하지 않는다.
문서 아래의 자료 갱신은 기존 새로고침 버튼으로 수행한다.

- `activity.py`는 SQLite의 running 작업과 PID를 함께 확인한다. Linux에서는 stdout 로그 inode까지
  비교하므로 재사용된 PID를 실행 중으로 표시하지 않는다. 경과 시간과 마지막 출력 시각은 실제 시작 기록·로그 mtime이다.
- 모델은 로그 맨 앞 CLI 헤더에서 확인된 경우만 표시한다. 작업 로그의 프롬프트·추론·명령 내용은 API에 반환하지 않는다.
- `monitoring/*/latest.json`의 `concepts[].id` 및 20초 이내 heartbeat만 지정 실행기의 대기 근거로 사용한다.
  신선한 heartbeat가 없으면 별도 실행을 예약했다고 단정하지 않는다. 현재 칩 제작 점유·같은 묶음의 진행 공간을 표시한다.
- 단계, 다음 처리, 반려 사유, 수정 횟수/상한, 운영 이벤트와 종료 기록을 표시한다. 프로세스 생존·명령 종료는 합격이나 완성의 증거가 아니다.
- API 실패는 마지막 확인 시각과 함께 표시한다. 3분 이상 출력이 없으면 실행 프로세스가 있어도 주의 표시한다.
  예상 완료 시간·가짜 퍼센트는 만들지 않는다.
- HTTP 서비스 재시작 시 `recover()`는 살아 있는 외부 작업을 lost로 바꾸지 않는다. 실행기는 원래 프로세스 소유를 유지한다.
  배포 전 통합 서비스 cgroup 및 기물 pool의 실행 작업이 없는지 확인하고, 재시작 후 외부 작업 PID/상태를 대조한다.

## 부품 선택의 판단 순서 (2026-10-05)

`art-review`에서는 선택할 부품 수와 체크리스트를 첫 화면에 두고, 실행 상태는 접힌 상세로 옮긴다.
`art-choice.js`는 한 그룹의 A/B를 나란히 표시한다. 고르는 원본 부품은 같은 4배 확대 기준으로
보여 주고 배치 예시를 아래에 붙인다. 문 열림·닫힘 전환은 두 후보의 배치 예시에 함께 적용한다.

- 후보는 자동 선택하지 않는다. 사용자가 누른 기존 choose-art/clear-art API와 fingerprint 계약을 그대로 쓴다.
- 합격 후보가 하나면 그 후보 이름을 명시한다. 불합격 후보는 버튼을 끄고 이유를 펼쳐 읽게 한다.
- 저장 성공 응답 후 다음 미선택 그룹으로 이동한다. 실패하면 같은 그룹에 남는다.
- ‘수정 요청 작성’은 기존 교정 입력란을 펼치고 부품명을 채운다. 기존 초안은 보존하며 자동 제출하지 않는다.
- 선택·공용 등록·맵 완성을 구분한다. 설치 완료 상태에서는 선택 변경 버튼을 비활성화한다.
- 실제 UI 확인은 `verify-shots/super-harness-choices/` 참조. 저장 흐름 확인은 브라우저에서 POST 응답만
  가로채 확인했고, 정본의 사용자 선택은 0/3 그대로 보존했다.

## 공간 예시 평가 (2026-10-05, 부품 선택 화면 개선)

위 부품 우선 비교 화면을 예시 우선으로 바꿨다. 원본 부품·A/B·검수 수치는 접힌 상세에 두고,
공간에 배치한 실제 그림과 용도 설명을 먼저 보여 준다. 지하 감옥의 ‘남쪽 돌계단’은 native h1 brief의
북쪽 낮은 감옥 바닥 → 남쪽 높은 랜딩 의도를 ‘출입구로 올라가는 계단’으로 설명한다.
예시는 기존 검수 방의 배치 표본이며, 실제 전체 감옥 맵이나 통행 승인으로 표시하지 않는다.

- `POST /api/action`, action=`evaluate-art`: group/candidate/fingerprint, imagePath/imageHash,
  rating(like/revise/replace), tags, text(최대 2,000자). 그림/판정 fingerprint와 표시된 상태 이미지를 함께 확인한다.
- 평가는 기존 `sh.sqlite.concepts.feedback`에 `kind=art-example` 레코드로 덧붙인다. 단계·선택·paused를 변경하지 않는다.
  기존 기획 의견과 구분하고, 텍스트 요약과 구조화된 의견, 이미지 경로/해시, 시각을 저장한다.
- GET art-choices는 현재 fingerprint/이미지에 해당하는 최근 평가를 `candidate.evaluations`로 돌려준다.
  열림·닫힘 각각의 평가가 보존된다. 잘못된 후보/그림 해시와 빈 수정 의견은 서버도 거부한다.
- `start_art`와 `start_art_context_review`는 저장한 의견을 다음 작업 프롬프트에 넣는다. 이전 판의
  의견일 수 있음을 표시하고 이미지/해시를 확인하도록 한다. 사용자 호감은 기술 PASS를 대신하지 않는다.
- ‘이 예시로 진행’은 기존 해시 결합 선택 API를 사용한다. 선택 후에도 같은 장면에 남아 평가할 수 있다.
  평가만 저장해도 되며, 평가 저장은 자동 재제작을 시작하지 않는다. 그림이 바뀌면 이전 평가를 새 그림에 덮어 표시하지 않는다.
- 화면 내 장면·열림/닫힘 전환에서 평가 초안을 유지한다. 전체 페이지 재로드 전 미저장 초안은 저장해야 한다.

확인: `verify-shots/super-harness-example-evaluation/`. 원본 DB의 피드백/선택은 변경하지 않고,
SQLite 사본에 저장→재조회와 낡은 해시 거부를 확인했다. 서비스 재시작 전후 별도 작업 689 생존 유지.

## 검수 응답 형식 오류의 복구 (2026-10-05)

공동묘지 작업 688, 교실 작업 690은 실제 FAIL 근거와 수정 지시가 있었으나 `fixes[].type`을
`category`로 읽지 못해 품질 수정으로 넘어가지 못했다. 품질 반려와 응답 형식 오류를 구분한다.

- `art_layout.normalize_fixes`는 알려진 asset/assembly/spec 값의 type→category 별칭만 정규화한다.
  대상·문제·변경·보존 문자열을 만들거나 판정을 통과시키지 않는다. 도면과 조립 검수에서 같은 함수를 쓴다.
- 입력 해시·기준 버전·전체/세부 판정 불일치는 계속 거부한다. 없는 필드·관찰·수정 지시는
  `ReviewFormatError`로 구분하여 `repair_art_layout_response`가 같은 검수자에게 최대 2회 보완 요청한다.
- 보완 단계는 art-layout-review의 format-1/2 작업이다. 원본 판정/기존 관찰/수정 내용을 보존하는지
  `preserve_verdict`로 확인한다. 그림 수정 회차를 올리지 않는다. 끝까지 실패하면 구체 오류와 함께 막힘으로 둔다.
- raw/정규화/보완 응답은 `art-layout-response-errors/`에 보존한다. 성공한 FAIL은 기존 도면 반려→준비 수정 경로로 넘긴다.
  네이티브 그림·합격 관문은 그대로 유지한다. 도면 품질 반복 한도(동일 art_revision에서 3회)는 별도다.
- 검수 프롬프트에 category/target/problem/change/keep을 모두 가진 실제 JSON 형식을 명시했다.
- `review_recovery.recover(sh,cid)`는 아직 이전 모듈을 들고 있는 감독자의 저장된 도면 응답 오류를 복구한다.
  최근 완료 작업·현재 입력 fingerprint·동일 개념 실행 작업 부재를 확인하고 작업별 replay marker로 중복 처리를 막는다.
- 현재 지정 3공간 배치는 기존 감독자 작업을 끊지 않고 `super-harness-review-response-watch.service`가
  호환 복구를 감시한다. 운영 스크립트는 DATA/monitoring/space-batch-20261005/review-response-watch.py.
  같은 배치가 종료됐지만 복구된 queued 작업이 있으면 새 코드로 같은 배치만 다시 시작하며, 전체 큐를 풀지 않는다.
  배치 종료 후 복구/대기 작업이 없으면 감시도 종료한다.
- 화면의 막힘/폐기를 별도 탭으로 분리했다. 형식 보완 작업은 실행 현황에 ‘검수 응답 형식 보완’으로 표시한다.

운영 복구 결과: 공동묘지/교실 모두 art queued로 이동, 원래 FAIL과 각각 4개 수정 지시·art_revision=0 보존.
기존 하수도 작업 691은 서비스 재시작 전후 생존. 근거: `verify-shots/super-harness-review-recovery/`.

## 전체 제작 통합 방향 (2026-10-05)

사용자가 키워드 하나에서 공간·타일·캐릭터·필요한 몬스터/장면을 전문 하네스로 배정하고,
슈퍼하네스 한 화면에서 실제 데모와 Allow/Deny만 보는 방향을 확인했다.
구현 전 계약·현재 결손·이관 순서·완료 근거는
[`docs/superpowers/specs/2026-10-05-unified-harness-production.md`](../../docs/superpowers/specs/2026-10-05-unified-harness-production.md).
공통 registry, 작업 의존 관계, native 선택 영수증, 공용 판본, 정본 설치 증거를 연결한다.
현재 직접 그림 실행 어댑터는 interior-props/modern-chipset 두 종이며 전체 하네스 통합이 끝났다는 뜻은 아니다.


공통 목록의 첫 연결은 구현했다: `npm run harness -- list`가 정본 registry에서
`src/harnesses/catalog.json`도 생성하고, 슈퍼하네스 기획/재료/그림 준비 프롬프트가
같은 목록과 장르 범위를 읽는다. 현재 생성 결과는 등록된 10종이다.
이 변경은 native 실행 어댑터를 추가하거나 기존 작업/선택/공용 등록 상태를 변경하지 않는다.


2026-10-06: 기물 PNG 맥락 미리 굽기 워커가 spawn에서 동적 별칭 `oprn_prop_picker`를 import하지
못해 BrokenProcessPool에 머무는 오류를 수정했다. 통합 로더는 실제 파일에서 import 가능한
`pick_server` 이름으로 로드한다. 해당 모듈이 자신의 폴더를 sys.path에 넣으므로 자식도 같은
파일을 읽으며, 공간/기물 store 분리는 기존 패키지 로딩을 유지한다.
