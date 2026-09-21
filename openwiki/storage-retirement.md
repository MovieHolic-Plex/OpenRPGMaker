# 프로젝트 저장 전환 (2026-09-21)

## 현재 저장 경로

프로젝트 정본은 `project.sqlite` + `assets/`다. Electron IPC와 팀 호스트 HTTP는 같은
`electron/main/dispatch.ts` 서비스를 사용한다. 브리지 없는 웹 preview는 메모리 세션이다.
외부 DB URL·anon key·REST 게이트웨이를 설정하는 실행 경로는 제거했다.

- 개인 실행: `npm run mac:launch` 또는 `Start RPG Maker.command`. 폴더를 선택하고,
  SQLite 호스트가 시작된 뒤 브라우저를 연다. 개인 경로는 `.oprn-local.json`(0600).
- 팀 실행·백업: [team-project-host.md](team-project-host.md).
- 오프라인 관리: `node scripts/oprn-store.mjs init|info|import-json|import-package|export-json|backup`.
- 기록 조회: `node scripts/list-ai-activity.mjs --project-dir <folder>` 및
  `node scripts/list-project-commits.mjs --project-dir <folder> --json`.
- 과거 보존본: `node scripts/import-project-archive.mjs <archive.sqlite> <new-folder>`.
  네트워크에 연결하지 않고, 새 폴더에만 쓴다. 기존 프로젝트는 덮어쓰지 않는다.

## 제거와 대체

외부 REST 관리·저작 스크립트와 SQL 마이그레이션, 사용하지 않는 클라이언트 env 정의를
제거했다. 기존 저장 API 별칭·로그·온톨로지는 현재 저장소를 설명한다. E2E의 프로젝트 시드
모듈은 `test/e2e/projectSeed.ts`로 옮겼고, 메모리 주입 계약은 유지한다.
범용 브라우저 관측·네트워크 차단 하네스는 보존했다. 폐기된 외부 저장 전용 테스트만 제거했다.

`LocalProjectStore.importHistory`는 다섯 이력 계열을 같은 이름의 입력 필드에서 가져오고,
객체 JSON을 문자열 강제 변환으로 훼손하지 않는다. 한 배치의 실패는 트랜잭션 전체를 되돌린다.
이관 도구는 새 프로젝트의 대화 범위로 기록을 연결하며 원본 귀속은 보존본에 남긴다.
이관 후 저장 해시·이력 건수를 비교하고 폴더를 닫았다가 다시 열어 확인한다.

## 실제 데이터 보존

개인 보존본과 이관 결과는 저장소 밖의 사용자 데이터 폴더에 있다. 상세 경로·건수는
[reports/storage-transition-20260921.md](../reports/storage-transition-20260921.md)를 따른다.
권한으로 읽을 수 있는 프로젝트·이력 전체를 project id 제한 없이 보존했다.
현재 형식에 맞지 않는 원본은 `unopened/`에 원문과 거부 사유를 함께 남긴다.
이를 정상 프로젝트로 열었다고 보고하지 않는다.

원본 서비스에서는 이관 중에도 다른 작성자가 프로젝트를 생성했다. 보존본은 테이블별
건수·키를 확인한 읽기 결과이며, 서버 전체의 동일 시점 트랜잭션 스냅샷은 아니다.
이 변경은 공유 서비스의 종료나 원본 데이터 삭제를 포함하지 않는다.
별도 커뮤니티 사이트의 데이터 이전·운영 변경은 사용자 지시로 제외했다.

## 역사 자료와 검증

과거 문서·증거의 제품별 저장소 명칭과 파일 경로를 일반적인 `LegacyDb`/`legacy-db` 표기로
정리했다. 해당 자료의 과거 결과가 새 저장소에서 재검증됐다는 뜻이 아니다. 원본 문구는
Git 이력과 비공개 데이터 보존본에 남아 있다. 현재 작업 지침은 AGENTS와 이 페이지를 따른다.

검증 범위는 코드 빌드, 파일·참조 검사, 실제 데이터 저장 및 재오픈이다.
테스트는 사용자 명시 실행 요청이 없으므로 실행하지 않았다. 실행기·이력 이관의 관련
계약 테스트는 새 동작으로 갱신했다.
