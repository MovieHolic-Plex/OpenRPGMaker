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
