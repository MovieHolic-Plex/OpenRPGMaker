# 팀 프로젝트 호스트 (2026-09-18)

## 소유와 실행 위치

팀은 소유·권한 단위, 프로젝트는 게임 문서, 호스트는 정본을 쓰는 프로세스다.
1인도 자동 생성된 팀의 owner다. 현재 호스트 인스턴스 하나는 프로젝트 폴더 하나를 연다.
여러 프로젝트를 한 팀으로 묶는 대시보드/계정 서버는 아직 없다.
SQLite 파일 위치와 브라우저 UI 위치는 독립적이다. 원격 접속자는 DB 파일을 직접 열지 않는다.

- 공통 서비스: `electron/main/dispatch.ts`의 `createStoreHandlers`. IPC와 HTTP가 같은
  검증·권한·잠금·저장 처리를 호출한다. 같은 session registry에서는 작업 큐도 공유한다.
- Electron: renderer → preload IPC → 공통 서비스 → SQLite.
- 브라우저: renderer → browser bridge HTTP → 공통 서비스 → SQLite.
- `electron/local-store/team.ts`: `workspace_team`, `workspace_members` 보조 테이블을 기존
  프로젝트 DB에 추가한다. 프로젝트 JSON/내보내기 게임 스키마와 분리된다.
  기존 폴더는 최초 오픈에 1인 팀이 만들어진다. 토큰은 SHA-256 해시만 저장한다.
- 에셋: 기존 `assets/<sha256>.<extension>`. 프로젝트 참조는 해시이며, 서버 디스크 경로를
  클라이언트가 선택하지 않는다. 객체 저장소 구현은 아직 없고 향후 저장소 어댑터의 몫이다.

## 실행

Electron에서 프로젝트를 연 뒤 **파일 → 팀 협업 시작 / 관리**. 앱이 같은 session registry를
사용하는 HTTP 호스트를 실행한다. 소유자 접속 코드는 클립보드로 복사하며 브라우저에서
로그인한다. **팀 관리**에서 편집자·읽기 전용 초대 링크를 만들거나 접근 권한을 취소할 수 있다.
초대 비밀은 URL fragment로 전달하고 로그인 화면에서 주소에서 제거한다.
팀원 목록·권한 선택·팀 이름 변경·백업·초대 복사를 한 관리 화면에서 제공한다.
같은 LAN에서 접속하며 앱 종료/파일 메뉴의 팀 호스트 중지로 종료한다.
인터넷 자동 중계/NAT 우회는 구현하지 않는다. 원격팀은 외부 호스트를 쓴다.

서버 운영자가 쓰는 실행 경로:

```bash
npm run build:packaged
npm run build:electron
npm run serve:project -- --project-dir /srv/oprn/game --host 0.0.0.0 --port 9840 --public-origin https://studio.example.com
```

리버스 프록시는 외부 Host 헤더를 그대로 전달한다. TLS는 프록시에서 종료한다.
LAN은 `--public-origin http://192.168.1.10:9840` 같은 실제 주소를 쓴다.
소유자 코드 파일은 프로젝트 폴더의 `.oprn-host-access`(0600)에 쓰며, 실행마다 갱신된다.
공유/커밋하지 않는다. 루프백 전용 실행에는 public-origin을 생략하면 기존 개인용 흐름이다.
루프백 리버스 프록시도 public-origin을 지정하면 인증을 강제한다.

## 저장·협업 계약

- 전체 저장: 클라이언트가 읽은 `expectedSha`와 DB 정본을 트랜잭션 안에서 비교한다.
  null은 빈 프로젝트 최초 저장이며 기존 내용을 강제로 덮어쓰라는 뜻이 아니다.
- 부분 저장: `core/teamMerge.ts`의 3-way merge. 맵 하나·DB 레코드 하나를 원자적으로 취급한다.
  서로 다른 맵/레코드 변경은 병합하고, 같은 항목의 변경·삭제 충돌은 거절한다.
  순서 변경·맵 트리·기타 루트는 보수적으로 충돌한다. changedMapIds는 신뢰하지 않는다.
- 병합한 전체 저장본을 응답으로 돌려준다. renderer는 submit 이후 로컬 편집을 보존하면서
  서버가 수락한 baseline과 팀 변경을 반영한다. 예전 로컬 문서를 응답이라고 꾸미지 않는다.
- 맵 선택 시 호스트가 90초 lease를 부여하고 20초마다 갱신한다. 다른 세션의 살아 있는
  lease가 있으면 UI와 저장 서비스가 편집을 막는다. 강제 뺏기는 없다.
  DB 레코드는 optimistic conflict 검사를 사용한다. `database` 전체 lease도 서비스에서
  제공하지만 DB 모달이 자동 획득하는 형태는 아니다.
- 팀 상태/정본 revision을 3초마다 조회한다. `PRAGMA data_version`은 같은 연결의 쓰기에
  바뀌지 않으므로 변경 알림 기준으로 쓰지 않는다.
- 깨끗한 편집기만 팀 변경을 재로드한다. I/O 중 mutation/lineage 변화도 검사한다.
  외부 변경을 채택하면 프로젝트 스냅샷 기반 undo를 초기화하고 기존 편집 창은 projectSwitch
  계약에 따라 닫힌다. 동료의 작업을 과거 로컬 스냅샷으로 되돌리는 것을 막는다.
- 공유 호스트는 로그인 전에 HTML 설정·에셋·RPC를 노출하지 않는다. 쿠키는 HttpOnly,
  SameSite=Strict, HTTPS에서는 Secure. 매 요청에서 회원 취소를 확인한다.
  owner만 초대/취소/이름/백업/미디어 분리를 할 수 있으며 viewer는 쓰기가 거절된다.
- 공유 호스트에서는 호스트 PC의 AI 자격증명·동반 서비스·진단 미러를 노출하지 않는다.
  팀별 AI 키/실행 권한은 별도 후속 기능이다.
- 하나의 프로젝트 폴더는 하나의 실행 중인 호스트가 관리한다. 여러 독립 서버 프로세스를
  같은 폴더에 붙이는 다중 호스트 구성은 지원하지 않는다(lease는 호스트 메모리 소유).

## 백업과 이전

`store.backup()`은 `backups/<시간-uuid>/project.sqlite`와 `assets/`를 함께 만든다.
DB 스냅샷의 에셋 목록으로 파일을 복사하며 실패 시 불완전 백업 폴더를 제거한다.
복원은 **호스트를 끈 후** 새 폴더에 이 백업 폴더의 DB·assets를 함께 복사하여 연다.
팀 정보와 멤버 토큰 해시도 DB에 포함된다. 호스트 소유자 코드는 다음 실행에 새로 발급된다.
원격 팀 관리 버튼은 서버 디스크에 백업을 만든다. 브라우저 다운로드는 기존 프로젝트
내보내기를 사용한다. 팀원이 2명 이상이면 보류 중인 에셋 참조 보호를 위해 서비스의 prune을
막는다. 오프라인 공동 편집 후 병합, 실시간 동일 맵 공동 칠하기, S3는 이번 범위가 아니다.

## 검증 근거

- `test/team/projectService.test.ts`: stale full save, 다른 맵/루트 병합, lease, revoke,
  viewer, DB 레코드 충돌, DB+에셋 백업.
- `test/team/httpHost.test.ts`: 로그인/쿠키, 인증 전 리소스 차단, 회원 취소, origin 검사,
  공유 호스트의 AI 경로 비공개.
- `test/localStore/conflict.test.ts`: 변경 맵 힌트로 실제 변경을 숨길 수 없는 계약으로 갱신.
- 테스트 실행은 AGENTS.md의 명시 요청 규칙을 따른다. 작성과 실행을 구분해서 보고한다.
