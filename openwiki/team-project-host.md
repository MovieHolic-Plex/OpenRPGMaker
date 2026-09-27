> 저장소 전환 안내(2026-09-21): 아래 옛 원격 DB·설정·명령은 과거 기록이다. 현재 저장·이관 지침은 [프로젝트 저장 전환](storage-retirement.md)과 AGENTS를 따른다.

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
사용하는 HTTP 호스트를 실행한다. 기본은 코드 없이 주소로 바로 접속한다.
**팀 관리 → 접속 설정 → 접속 코드 사용**을 켜면 로그인을 요구한다. **팀 관리**에서 편집자·읽기 전용 초대 링크를 만들거나 접근 권한을 취소할 수 있다.
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
public-origin은 Host/Origin 검증용이며 로그인 강제 여부와 독립적이다.

## 기존 mdc-server 시작 명령의 SQLite 연결 (2026-09-18)

`npm start`와 systemd가 직접 호출하는 `scripts/start-preview.mjs`는 이제
`oprn-serve.mjs`를 실행한다. 예전 Vite preview는 `window.oprn`을 주입하지 않아
SQLite 전환 후 저장 대상이 없는 메모리 어댑터로 열렸다.

- `OPRN_PROJECT_DIR` 또는 `npm start -- --project-dir /path/to/project`로 **기존**
  `project.sqlite` 폴더를 지정한다. 미설정/없는 폴더는 실행을 거절한다. 임의 프로젝트
  선택·빈 프로젝트 생성·LegacyDb 자동 이관은 하지 않는다.
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
- 실제로 팀 병합이 일어난 부분 저장만 병합한 전체 저장본을 응답으로 돌려준다. renderer는 submit
  이후 로컬 편집을 보존하면서 서버가 수락한 baseline과 팀 변경을 반영한다. 예전 로컬 문서를
  응답이라고 꾸미지 않는다. 클라이언트 기준 sha 이후 아무도 쓰지 않았으면(`baseSha` 일치)
  응답에 `serialized` 를 싣지 않고, 전체 저장(`saveSerialized`)은 보낸 문자열을 되돌려 보내지 않는다
  (2026-09-25, 아래 「웹 편집기 저장 경로 경량화」).
- 맵 선택 시 호스트가 90초 lease를 부여하고 20초마다 갱신한다. 다른 세션의 살아 있는
  lease가 있으면 UI와 저장 서비스가 편집을 막는다. 명시적인 「편집 권한 가져오기」는
  같은 팀원의 다른 탭 또는 팀 owner에게만 허용한다. 갱신/재시도는 권한을 강제로 가져오지 않는다.
  DB 레코드는 optimistic conflict 검사를 사용한다. `database` 전체 lease도 서비스에서
  제공하지만 DB 모달이 자동 획득하는 형태는 아니다.
- 팀 상태/정본 revision을 3초마다 조회한다. `PRAGMA data_version`은 같은 연결의 쓰기에
  바뀌지 않으므로 변경 알림 기준으로 쓰지 않는다.
  이 편집기가 방금 저장해 만든 revision(`SaveResult.revision` → `store.isOwnSavedHostRevision`)은
  재로드하지 않는다. 그 내용은 이미 메모리에 있다.
- 깨끗한 편집기만 팀 변경을 재로드한다. I/O 중 mutation/lineage 변화도 검사한다.
  외부 변경을 채택하면 프로젝트 스냅샷 기반 undo를 초기화하고 기존 편집 창은 projectSwitch
  계약에 따라 닫힌다. 동료의 작업을 과거 로컬 스냅샷으로 되돌리는 것을 막는다.
- 접속 코드를 켠 호스트는 로그인 전에 HTML 설정·에셋·RPC를 노출하지 않는다. 쿠키는 HttpOnly,
  SameSite=Strict, HTTPS에서는 Secure. 매 요청에서 회원 취소를 확인한다.
  owner만 초대/취소/이름/백업/미디어 분리를 할 수 있으며 viewer는 쓰기가 거절된다.
- 공유 호스트의 AI는 기본 비활성이다. `OPRN_HOST_OWNER_AI=1`을 명시하면 owner만
  동반 서비스를 사용할 수 있다. 다른 팀원과 진단 미러에는 호스트 AI 자격을 노출하지 않는다.
- 하나의 프로젝트 폴더는 하나의 실행 중인 호스트가 관리한다. 여러 독립 서버 프로세스를
  같은 폴더에 붙이는 다중 호스트 구성은 지원하지 않는다(lease는 호스트 메모리 소유).

## 큰 프로젝트의 HTTP 저장 전송 (2026-09-24)

브라우저 HTTP 브리지의 압축은 프로젝트 문서/CAS 계약을 바꾸지 않는 전송 계층이다.
`electron/browser/bridge.ts`는 호스트 설정 `requestBodyEncoding: "gzip"`이 있을 때만,
UTF-8 JSON 요청이 1MiB를 초과하고 `CompressionStream`이 있으면 gzip을 사용한다.
더 작아지지 않거나 압축 결과가 64MiB를 넘으면 비압축을 사용한다. 압축 기능이 없거나
전송 전 압축이 실패해도 비압축 경로가 있다. HTTP 오류 뒤 저장을 자동 재전송하지 않는다.
구버전 호스트가 capability를 광고하지 않으면 기존 JSON 전송을 유지한다.

새 호스트의 `electron/serve/bridgeRequestBody.ts`는 Origin/회원/브리지 토큰 인증 **이후**,
프로젝트 세션을 열거나 저장 핸들러를 실행하기 **이전**에 요청을 검증한다.
브라우저가 보내는 `x-oprn-channel`과 JSON의 `channel`은 반드시 일치해야 한다.
헤더 없는 기존 소규모 요청은 허용하지만, 확대된 한도를 얻지는 않는다.

| 요청 | 전송 바이트 상한 | 압축 해제 후 상한 |
|---|---:|---:|
| gzip + `oprn:project.save` 명시 헤더 | 64MiB | 256MiB |
| 비압축 + `oprn:project.save` 명시 헤더 | 256MiB | 256MiB |
| 나머지 브리지 RPC (mapPatch 포함) | 64MiB | 64MiB |

새 프로젝트의 `oprn:start.createProject`도 전체 `seed` 안에 공용 자산·AI 문서를 담으므로
`project.save`와 같은 상한을 적용한다(2026-09-24). 음식 자료 추가 뒤 실제 신규 생성에서
64MiB 해제 상한의 413이 발생했다. 생성 채널만 추가 허용하며 헤더/본문 일치 검사와
기존 팀 owner 확인, seed 검증, 폴더 생성·실패 정리는 그대로 유지한다.

`Content-Length`와 실제 수신량을 모두 제한하며 gzip 출력도 스트리밍 중 제한한다.
과대 요청은413, 지원하지 않는 인코딩은415, 잘못된 gzip/JSON/채널 불일치는400이다.
실패한 본문은 핸들러로 전달하지 않는다. gzip 해제는 브리지 POST 전용이며 로그인
본문은 기존4096바이트 그대로다. 브리지 토큰/회원 인증·쓰기 권한·expectedSha 비교·
3-way merge·SQLite 저장은 기존 서비스가 담당한다. `serialized` 원문 문자열을
재직렬화하거나 expectedSha를 변경하지 않는다. 존재하지 않는 저장 채널은 추가하지 않는다.

브라우저 브리지와 호스트를 함께 다시 빌드해야 capability와 해제기가 연결된다.
외부 프록시가 있으면 압축 전송 크기 한도도 별도로 적용된다.
격리 HTTP sink 관찰은 실제 브리지/본문 해제기의 바이트 보존과 거절 동작만 확인하며,
정본 저장·재로드 증거를 대신하지 않는다.

### 헤드리스 대용량 콘텐츠 설치 (2026-09-25)

`scripts/lib/hostBridgeClient.mjs`는 작은 `/__oprn/team` 페이지에서 실제 브리지 설정과
회원 쿠키를 메모리로 얻은 뒤 Chromium을 닫는다. 같은 origin의 공식 HTTP dispatcher를
Node에서 호출하며 토큰/쿠키를 로그나 파일에 기록하지 않는다. 협상된 gzip/채널별 한도와
`expectedSha` CAS를 유지하고 실패한 저장을 자동 재시도하지 않는다. DB 직접 쓰기는 없다.
`read-pixel-art-world-host.mjs`도 같은 클라이언트로 대용량 정본을 읽고 PAW 자산의
ref SHA와 실제 바이트를 대조한 뒤 private portable/읽기 영수증을 만든다.
`install-pixel-art-world-shared-host.mjs`는 설치 전 backup, 저장 후 실제 재로드,
맵/spatial 해시 보존과 모든 대상 자산 바이트 비교를 완료해야 영수증을 작성한다.
PAW의 기존 Chromium 설치는 `Target crashed` 후 저장되지 않았고 이 경로로 revision59에
저장·재로드했다. 렌더러 충돌 원인은 확정하지 않았으며 편집기 UI의 메모리 문제 해결을 뜻하지 않는다.

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

## 호스트 페이지 CSP (2026-09-22)

팀 호스트가 주는 HTML 은 응답마다 nonce 를 붙인 `script-src` 를 가진다. 로그인 실패(401)도
같은 경로다. 인라인 스크립트는 그 nonce 가 있을 때만 실행된다. 에셋 응답의 Content-Type 은
이미지·음성·영상·폰트·SVG 만 허용하고, 그 밖은 `application/octet-stream` 이다. 허용된 타입의
`oprn-asset` 응답은 `public, max-age=31536000, immutable` 이고, 불투명 바이트는 `private, no-cache`
다. 에셋 응답에는 `sandbox` CSP 를 붙인다.
루프백이든 `0.0.0.0` 이든 접속 코드는 기동 때 켜지 않는다. 팀 관리에서 켠 값만 유지된다.

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
  SQLite 문서를 저장하고, 행의 제목으로 성공을 확인한다. 시드 전체를 다시 파싱해 제목을 덮어쓰지
  않는다. 서버가 경로를 정하며 클라이언트의 디스크 경로는 받지 않는다. 실패한 생성 폴더는 정리한다.
  생성 권한은 팀 owner에게 있다.
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

### 새 프로젝트의 공용 기본 자료 보장 (2026-09-24)

부팅은 공용 catalog 로드를 기다렸지만, 동기 `createProjectWithMaps`는 설치된 snapshot을
사용하지 않았고 새 폴더 생성은 정규화를 거치지 않은 seed를 바로 저장했다. 실측에서 같은
9개 라이브러리를 로드한 상태로 기본 타일셋 25개만 생성됐으며, 수동 projection 후 49개가 됐다.
경고가 없었으므로 이 누락을 timeout이나 HMR 문제로 분류하지 않는다.

- `createProjectWithMaps`는 이미 설치된 `projectDefaults` 자료를 `ensureSharedContent`로 적용한다.
  동기 factory는 네트워크를 하지 않으므로 headless 호출자는 먼저 `installSharedContent`를 해야 한다.
- `createProjectFolderWithSeed`는 저장 직전에 공용 catalog를 다시 로드하고 seed에 적용한다.
  HTTP(S) 호스트에서는 네트워크·HTTP(404 포함)·JSON/catalog 오류 시 생성 RPC를 호출하지 않는다.
  기존 새 프로젝트 오류 toast가 이유를 표시하며 기존 폴더는 그대로다.
- 59MB를 넘는 공용 catalog를 고려해 읽기 제한은 60초다. 기존 프로젝트 부팅의 선택적 로딩은
  경고 후 진행하지만, 새 프로젝트는 실패한 로딩이나 오래된 snapshot으로 생성하지 않는다.
- 배포 Electron의 `app://`도 `/__oprn/shared-content` 를 내부 응답으로 준다(`electron/main/protocols.ts`, 2026-09-26 이후). 옵션 로딩은 그대로다.
  이 변경으로 데스크톱 공용 catalog 배포가 구현됐다고 간주하지 않는다.
- 예약 `shared_` ID의 자료와 그림을 함께 적용한다. 사용자 독립 ID, 맵, 시작 장르와 설계 brief는
  유지한다. SQLite 생성/재로드는 기존 호스트 경로가 담당한다.

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

2026-09-26 혼자 쓰는 팀 회수: 팀 구성원이 1명이고 요청자가 lease와 같은 member이면 takeover 없이도
새 세션에 lease를 준다. 이전 탭이 pagehide 없이 죽으면(크래시·강제 종료·절전) 최대 90초 동안
「호스트님이 편집 중입니다」로 칠하기가 막혔다(온보딩 저니 04, 토스트 4개 누적). 이렇게 밀려난 세션은
그 자원을 자동 회수하지 않고 기존처럼 `locked`+`canTakeover`를 받는다(살아 있는 두 탭의 핑퐁 방지).
구성원이 2명 이상이면 계약은 그대로다. 렌더러의 칠하기 거부 안내는 키 토스트 하나로 교체되어 쌓이지 않는다
(`toastMapEditLockNotice`).

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

## 내부 웹 기본 접속 (2026-09-18)

`workspace_settings.access_code_required`는 누락 시 false다. 기존 코드 파일이 있어도
자동 활성화하지 않는다. 꺼져 있으면 접속자는 owner로 작업하며 초대와 로그아웃 UI를 숨긴다.
코드를 켜면 회원/역할 검증이 적용된다. 설정은 기본 프로젝트 DB에 저장되어 추가 프로젝트와
재시작에도 공유된다. `oprn:host.access`는 owner만 호출할 수 있고, 활성화 전에 현재 브라우저의
owner 쿠키를 발급해 설정 변경 직후 접속이 끊기지 않게 한다. 활성화 결과의 소유자 코드는
설정 화면에서만 표시한다. 원문을 로그나 증거에 기록하지 않는다. Host/Origin과 RPC 토큰 검증은
기본 모드에서도 유지한다. AI 운영 허용 설정 `OPRN_HOST_OWNER_AI=1`은 별도로 유지한다.


## Large bridge save requests (2026-09-24)

Browser bridge requests of at least1MiB use gzip when CompressionStream exists. Small/keepalive/unsupported-browser requests remain plain JSON. The host accepts identity or gzip after the existing origin/token/session checks, caps wire bytes at128MiB and decoded bytes at256MiB, and rejects unsupported encodings, truncated/corrupt gzip and aborted requests. Login form limits are unchanged. Compression changes no project/merge semantics; stale-base retries still contain the exact base document. Helpers: `electron/browser/requestBody.ts`, `electron/serve/requestBody.ts`.

Manual wire check used the actual109MB canonical document plus its asset patch: JSON141,499,825bytes → gzip57,205,286bytes, exact parsed object equality across loopback HTTP. Five negative cases cover wire/decoded limits, corrupt/truncated gzip and unsupported encoding; small/keepalive/no-CompressionStream fallbacks also checked. This checks transport, not successful canonical save/reload. No full test suite was run.

## 웹 편집기 저장 경로 경량화 (2026-09-25)

웹(HTTP 브리지)에서 편집 중 몇 초마다 멈추던 원인은 저장 한 번이 전체 문서를 여러 번 오가게 한 것이었다.
참고문서 dataURL 때문에 문서가 수십 MB라 한 번 오갈 때마다 메인 스레드가 멈춘다.

- 자동저장 → revision 증가 → 3초 폴링이 **자기 저장**을 팀 변경으로 보고 `refreshFromHost` 로
  전체 다운로드 + `serializeForComparison` 두 번. 이제 저장 응답의 revision 을 기억해 건너뛴다.
- `saveSerialized` 가 받은 문자열을 응답에 그대로 되돌려 보냈다(웹 저장 바이트 두 배). 제거.
- 병합이 없는 `saveMapPatch` 도 전체 `serialized` 를 돌려줬고, renderer 는 그걸 역직렬화한 뒤
  팀 변경 여부를 보려고 `serializeForComparison` 을 두 번 더 했다. 이제 서버는 `baseSha` 가 그대로면
  문서를 싣지 않고, renderer 는 돌려받은 문서가 없으면(`savedProject === submittedProject`) 비교를 건너뛴다.

남은 비용: 참고문서 이미지가 여전히 프로젝트 문서 안에 있다(`tilesets[].referenceDocuments`).
문서를 가볍게 하려면 에셋으로 분리해야 한다 — 스키마 변경이라 별도 작업이다.

### 저장 경로의 전체 복제·직렬화 제거 (2026-09-26~27)

82MB 문서(타일셋 354칸, 새 폴더 빈 프로젝트는 81MB — 공용 번들 계약으로 복사)에서 자동저장 한 번을 재며 걷어낸 것.

- 저장 영수증 `contentIdentity` 는 처음 읽힐 때 `acceptedBaseline` 으로 계산한다(읽는 곳은 조수 실행의
  저장 증명·체크포인트뿐). 값은 `jsonContentDigest`(저장 보기) — 재로드 검증도 같은 함수를 쓴다.
  정규화에 실패하면 `unavailable:` 표식을 돌려주고 `verifyPersistedRevision` 이 `failed` 로 끝난다.
- 로컬 어댑터(`electronRepository`, `returnsSubmittedCopy`)에는 스토어가 **복제 없는 보기**를 넘긴다.
  어댑터는 옛 기준본 + 와이어 패치 값으로 제출 내용의 사적 사본(`submitted`)을 만든다 — 비용이 변경량에
  비례하고 `serialize` 결과는 호스트 행과 같다. 스토어는 가지를 **교체**만 하므로 보기가 가리키는 내용은
  제출 때 그대로다(세대 없는 제자리 편집도 값 비교라 다음 저장에 잡힌다).
- 맵 패치 비교는 `diffProjectDocumentsSliced` 로 12ms 조각씩 돈다(한 번에 약 1.1s 정지였다). 동기 판과 같은 코드다.
- `projectWireView` 는 버려진 키가 없는 타일셋을 같은 객체로 둔다 — 같은-객체 단축이 살아 비교가 거의 공짜다.
- 호스트: `store.saveMapPatch` 는 `baseSha` 가 저장 행과 같으면 3자 병합을 건너뛴다. 메타만 읽는 쿼리와
  문서 문자열 캐시로 `info()` 가 81MB 를 끌어오지 않는다. 패치 로컬 문서는 저장 행을 새로 파싱해 제자리 복구한다.

실측(새 폴더 · oprn-serve · Playwright, 박스 load 22~35): 칠하기 획의 최장 메인 스레드 정지 12~13s → 0.1~0.46s.
「자동 저장됨」까지는 7~11s 이고 대부분 호스트 쓰기(81MB 직렬화·해시·SQLite)다 — 남은 바닥은 문서 분리다.
두 경로 모두 웹(HTTP 브리지)과 Electron(IPC)이 같은 `electronRepository`·`store` 코드를 탄다.
