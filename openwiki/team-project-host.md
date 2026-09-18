# 팀 프로젝트 호스트 (2026-09-18)

## 소유와 실행 위치

팀은 소유·권한 단위, 프로젝트는 게임 문서, 호스트는 정본을 쓰는 프로세스다.
1인도 자동 생성된 팀의 owner다. 호스트는 기본 프로젝트와 그 아래 `.oprn-projects/<uuid>`에 만든 추가 프로젝트를 연다.
추가 프로젝트는 기본 프로젝트의 팀 권한을 공유한다. 프로젝트 목록 대시보드/계정 서버는 아직 없다.
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
소유자 코드 파일은 프로젝트 폴더의 `.oprn-host-access`(0600)에 쓰며, 재시작해도 같은 값을 유지한다.
공유/커밋하지 않는다. 루프백 전용 실행에는 public-origin을 생략하면 기존 개인용 흐름이다.
루프백 리버스 프록시도 public-origin을 지정하면 인증을 강제한다.

## 기존 mdc-server 시작 명령의 SQLite 연결 (2026-09-18)

`npm start`와 systemd가 직접 호출하는 `scripts/start-preview.mjs`는 이제
`oprn-serve.mjs`를 실행한다. 예전 Vite preview는 `window.oprn`을 주입하지 않아
SQLite 전환 후 저장 대상이 없는 메모리 어댑터로 열렸다.

- `OPRN_PROJECT_DIR` 또는 `npm start -- --project-dir /path/to/project`로 **기존**
  `project.sqlite` 폴더를 지정한다. 미설정/없는 폴더는 실행을 거절한다. 임의 프로젝트
  선택·빈 프로젝트 생성·Supabase 자동 이관은 하지 않는다.
- 폴더와 public origin 설정 우선순위는 CLI > 프로세스 env > `.env.local` > `.env`.
  상대 폴더는 저장소 루트 기준이다. 기본 주소는 기존 `http://mdc-server:9888`이며
  `--host`, `--port`, `--public-origin`, `--dist`, `--bridge`도 전달한다.
- 처음 전환할 때 `npm run build:packaged`와 `npm run build:electron`이 필요하다.
  서비스에 `OPRN_PROJECT_DIR`을 설정하고 재시작한다. 팀 로그인과 소유자 코드 파일은
  위 `serve:project`와 같은 계약이다. 공유 호스트의 AI 제한도 그대로 적용된다.
- `npm run preview`는 저장 브리지 없는 정적 번들 확인용으로 남는다.
- 회귀 계약은 `test/startProjectHost.test.mjs`. 실행 여부는 완료 보고에서 구분한다.

## 저장·협업 계약

- 전체 저장: 클라이언트가 읽은 `expectedSha`와 DB 정본을 트랜잭션 안에서 비교한다.
  null은 빈 프로젝트 최초 저장이며 기존 내용을 강제로 덮어쓰라는 뜻이 아니다.
- 부분 저장: `core/teamMerge.ts`의 3-way merge. 맵 하나·DB 레코드 하나를 원자적으로 취급한다.
  서로 다른 맵/레코드 변경은 병합하고, 같은 항목의 변경·삭제 충돌은 거절한다.
  순서 변경·맵 트리·기타 루트는 보수적으로 충돌한다. changedMapIds는 신뢰하지 않는다.
- 병합한 전체 저장본을 응답으로 돌려준다. renderer는 submit 이후 로컬 편집을 보존하면서
  서버가 수락한 baseline과 팀 변경을 반영한다. 예전 로컬 문서를 응답이라고 꾸미지 않는다.
- 맵 선택 시 호스트가 90초 lease를 부여하고 20초마다 갱신한다. 다른 세션의 살아 있는
  lease가 있으면 UI와 저장 서비스가 편집을 막는다. 명시적인 「편집 권한 가져오기」는
  같은 팀원의 다른 탭 또는 팀 owner에게만 허용한다. 갱신/재시도는 권한을 강제로 가져오지 않는다.
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
- 공유 호스트의 AI는 기본 비활성이다. `OPRN_HOST_OWNER_AI=1`을 명시하면 로그인한 owner만
  동반 서비스를 사용할 수 있다. 다른 팀원과 진단 미러에는 호스트 AI 자격을 노출하지 않는다.
- 하나의 프로젝트 폴더는 하나의 실행 중인 호스트가 관리한다. 여러 독립 서버 프로세스를
  같은 폴더에 붙이는 다중 호스트 구성은 지원하지 않는다(lease는 호스트 메모리 소유).

## 백업과 이전

`store.backup()`은 `backups/<시간-uuid>/project.sqlite`와 `assets/`를 함께 만든다.
DB 스냅샷의 에셋 목록으로 파일을 복사하며 실패 시 불완전 백업 폴더를 제거한다.
복원은 **호스트를 끈 후** 새 폴더에 이 백업 폴더의 DB·assets를 함께 복사하여 연다.
팀 정보와 멤버 토큰 해시도 DB에 포함된다. 호스트 소유자 코드는 `.oprn-host-access`가 없거나 DB의 코드 해시와 다를 때만 새로 발급된다.
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

## 적대적 리뷰 수정 (2026-09-18)

- 로그인 쿠키는 정규화된 프로젝트 폴더의 해시를 이름에 포함한다. 같은 호스트의 여러
  포트에서 서로 다른 프로젝트에 접속해도 로그인/로그아웃이 다른 프로젝트를 끊지 않는다.
- 편집기 부팅 전에 팀 권한을 조회한다. viewer와 권한 미확인 상태는 공통 store의
  update/updateMap/replace/replaceProject/clearAll 및 저장·정규화 쓰기를 차단한다.
  DB 저작 입력은 비활성화하지만 탐색·검색은 유지한다. 서버 권한 검사도 그대로 유지한다.
- 맵 선택 상태와 실제 보유 lease를 분리한다. 전환 시 이전 lease를 갱신하고 저장 성공 후에만
  해제한다. 저장 실패/충돌/disabled 결과에는 전환을 완료하지 않고 20초마다 전체 절차를
  재시도한다. 연속 선택은 직렬화해 이전 응답이 최신 선택을 덮어쓰지 못하게 한다.
- 회귀 계약: `test/team/httpHost.test.ts`, `test/team/readOnlyStore.test.ts`,
  `test/team/lockRecovery.test.ts`. 테스트 실행은 명시 요청 규칙을 따른다.

## 웹 새 프로젝트 생성 (2026-09-18)

- 파일 → 새 프로젝트에서 이름과 장르를 고르면 HTTP `startCreateProject`가 새 UUID 폴더에
  SQLite 문서를 저장하고 다시 읽은 뒤 성공을 반환한다. 서버가 경로를 정하며 클라이언트의
  디스크 경로는 받지 않는다. 실패한 생성 폴더는 정리한다. 생성 권한은 팀 owner에게 있다.
- 브리지는 `?hostProject=<uuid>` 주소를 기록하고 편집기는 새로고침한다. 프로젝트별 RPC 헤더와
  에셋 URL로 기존 탭의 저장 대상을 보존한다. 주소를 북마크하면 서버 재시작 후에도 다시 연다.
  로그인 후에도 해당 프로젝트 주소를 유지한다. 기본 프로젝트는 쿼리 없는 `/`이다.
- 새 프로젝트는 기본 프로젝트의 팀 디렉터리를 빌려 쓰므로 기존 초대·취소·viewer 권한이
  동일하게 적용된다. 추가 프로젝트 세션 종료는 공유 팀 연결을 닫지 않는다.
- 기존 문서에 미저장 변경이 있으면 먼저 저장하고, 저장 실패 시 생성을 중단한다. 정적
  `npm run preview`에는 저장 서버가 없어 생성할 수 없다.
- 호스트 전체 이전 시 기본 폴더의 `.oprn-projects/`도 함께 옮겨야 한다. 기존 `store.backup()`은
  선택한 프로젝트만 백업하며 추가 프로젝트 전체를 재귀 백업하지 않는다. 팀 정보는 기본 DB에 있다.
- 회귀 계약: `test/team/webProjectCreation.test.ts` (독립 저장, 원본 보존, 재시작 후 로드,
  로그인 리다이렉트, 잘못된 경로/시드, viewer 제한). 실행 여부는 완료 보고에서 구분한다.

## 운영 systemd가 Vite preview에 고정된 경우 (2026-09-18)

코드 머지만으로 서비스의 `ExecStart=...vite...preview`는 바뀌지 않는다. 이 상태는 HTTP 200이어도
`window.oprn`이 없고 새 프로젝트/저장이 동작하지 않는다. 실제 운영 주소에서 브리지 존재와
생성→저장→재로드를 확인해야 한다.

기존 사용자 `rpg-zzu.service`를 저장 호스트로 전환하는 명시적 설치 명령:

```bash
npm run build:packaged
npm run build:electron
node scripts/install-project-host-service.mjs --project-dir /home/main/.local/share/oprn/web-workspace --public-origin http://mdc-server:9888 --init-new
```

`--init-new`는 기존 디렉터리를 거절하고 빈 SQLite 작업실만 초기화한다. 기존 프로젝트를
연결하거나 재설치할 때는 이 옵션을 빼라. 설치기는 systemd drop-in으로 실행 명령을
`start-preview.mjs`로 교체하고 서비스를 재시작한다. 기존 unit과 프로젝트는 덮어쓰지 않는다.
기존 drop-in은 타임스탬프 사본으로 남긴다. 로그인 코드는 작업실의 `.oprn-host-access`에서
확인하며 채팅·Git·증거 파일에 복사하지 않는다. 첫 로그인에는 쿼리 없는 운영 주소를 사용한다.

## 맵 편집 권한 가져오기 (2026-09-18)

`team.lock({takeover:true})`는 owner 또는 기존 lease와 같은 member만 허용한다. viewer는
항상 거절하며 다른 editor에게는 `canTakeover:false`를 돌려 버튼을 비활성화한다. 기존
소유 세션은 다음 20초 갱신에서 잠김으로 전환되고, 그 전이라도 서버는 해당 맵 변경 저장을
거절한다. 명시적 클릭의 첫 요청에만 takeover를 보내므로 탭끼리 자동으로 권한을 빼앗지 않는다.
기존 안내만 있고 일반 checkout만 호출하던 버튼을 실제 takeover 요청으로 연결했다.

## 운영 AI와 로그인 유지 (2026-09-18)

설치기의 `--enable-owner-ai`는 서비스에 `OPRN_HOST_OWNER_AI=1`을 설정한다. 인증된 owner의
동일 출처 AI 요청만 companion에 전달하고, 서버 내부에서 companion 토큰을 붙인다. viewer/editor는
403, 설정이 꺼진 owner는 설명을 담은 503을 받는다. 예전에는 POST가 405로 빠졌다.
`oprn-serve.mjs`가 워커 파일의 절대 경로를 지정하고 Bun은 설치된 `~/.bun/bin/bun`도 찾는다.
임시 번들 디렉터리에서 잘못된 워커 경로를 계산하거나 systemd PATH에 Bun이 없어 실패하지 않는다.

소유자 코드는 기존 파일과 DB 해시가 일치하면 재사용한다. 로그인 쿠키의 토큰 해시는
`workspace_sessions`에 12시간 만료와 함께 저장해 재시작 후에도 로그인 상태를 유지한다.
로그아웃은 해당 세션을 삭제하며 매 요청에서 회원 취소 여부를 확인한다. 기존 메모리 세션은
이번 전환 때 한 번 재로그인이 필요하다. 접속 코드·쿠키 원문은 로그/증거/커밋에 남기지 않는다.
