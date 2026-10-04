# 조선 설화 판타지 콘텐츠 팩

`joseon-folklore`는 기존 Project 데이터와 `retro2003` 전투를 쓰는 선택형 콘텐츠 팩이다.
온라인 기능이나 별도 전투 엔진을 추가하지 않는다. 기본 프로젝트에 강제로 설치하지 않는다.

## 소유권과 등록

- 저작 원본/ID: `content-packs/joseon-folklore/CONTRACT.md`, `ids.json`, 역할별 `data.json`, `design.json`, 원본 도트 코드/해시/검토 그림.
- 배포: `node scripts/content/prepare-joseon-folklore.mjs`로 public PNG와 `src/assets/joseonFolkloreData.json`, `joseonFolkloreAssets.json`을 만든다. JSON에는 이미지 바이트를 넣지 않는다.
- 적용: `src/project/contentPacks/joseonFolklore.ts`의 `applyJoseonFolklorePack(project)`는 누락된 ID만 추가한다. 재적용할 때 저자가 바꾼 레코드를 보존한다.
- 에디터: 데이터베이스 → 개요 → 콘텐츠 팩 → 조선 설화 팩 추가. 기존 store update/undo/SQLite 저장 경로를 쓴다. 저장 실패를 완료로 표시하지 않는다.
- 조수: `list_content_packs`, `apply_content_pack({packId:"joseon-folklore"})`. 상점·이벤트·배우·사냥터 연결은 별도의 콘텐츠 저작이다.
- 그림: 아이콘은 builtin resource resolver, 적은 `pixelEnemySheets` 9pose와 명시적인 `portraitPath`를 통해 등록한다. 웹 내보내기는 같은 리소스 ID의 portrait 및 전체 sheet를 함께 싣는다.

## 게임 적용

`node scripts/content/apply-joseon-folklore-game.mjs --project <SQLite 프로젝트 폴더>`는 현재 버들마을 RPG 대상의 후보만 만든다. `--save`를 추가할 때 같은 SQLite API로 저장한 뒤 닫고 다시 열어 데이터베이스·세션·시스템·맵을 비교한다. 사용자 프로젝트 ID를 고정 검사해 다른 폴더에 이 통합 레시피를 적용하지 않는다. 실행 중인 호스트 DB를 별도 프로세스로 수정하지 않는다.

배우 고유 곡선이 기본 성장값을 소유하고 전직 뒤에만 클래스 곡선을 쓰므로, 처음부터 직업을 가진 동료의 배우 곡선도 해당 클래스 곡선으로 맞춘다. 전직은 기존 promoteActor 권위자를 사용한다. 전직 선물은 실제 소지품 추가 후 changeEquipment로 장착한다. 장비 제한은 기존 canEquip OR 규칙을 따른다. 클래스의 포괄 actorIds/classIds 허용으로 다른 직업 장비를 풀지 않는다.

## 검토

첫 파일럿은 소비품4/재료2, 장비8, 일반3/보스1, 클래스5, 아군기술8/적기술4이다. 감독자가 실제 그림과 역할별 데이터를 직접 확인하고 플레이어에 연결한다. worker status의 ready는 파일 인계 준비를 뜻하며 사용자 시각 승인이나 정본 저장을 뜻하지 않는다. 전체 게이트/테스트 실행은 AGENTS의 세션 제한을 따른다.
