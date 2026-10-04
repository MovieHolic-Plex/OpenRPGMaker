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

전체 팩은 소비품20/재료12, 장비36, 일반12/보스3, 클래스5, 아군기술24/적기술12와 아이템 전용 효과4이다. 아이콘104장(아이템32·장비36·기술36), 몬스터15장의9포즈/초상을 배포한다. 기술 아이콘은 재사용 가능한 picture 소재다. 현재 네이티브 SkillRecord에는 아이콘 필드가 없으므로 전투 기술 목록에 강제로 새 필드를 추가하지 않는다.

원본 몬스터4종의 기력0은 기술비용과 맞지 않아 들쥐6/멧돼지9/볏짚도깨비9/박쥐8로 원본 데이터와 재생성 코드를 함께 수정했다. 배포 생성기가 적의 기술 존재·기력 비용을 검사한다. 원래 worker 보고서의 수치는 인계 당시 기록이다. 기술/소비품의 동일 슬러그는 `jf-skill-icon-*`/`jf-icon-*`로 분리한다.

통합 레시피는 기존6맵의 지형을 바꾸지 않고, 입구부터 깊은 곳 순으로12종 일반 적을 배치한다. 박쥐는 살아 있는 동료 조건을 쓰므로2마리 조우다. 청동 도깨비는 기존 굴 보스, 신부 원귀/산군은 산길 안내자(78,41)의 선택 시련이다. 이 선택 시련은 해당 장소의 완성된 스토리 던전을 뜻하지 않는다. 마을 상점56종/약방20종, pixel 상점은 확인키로1개씩 구입한다. 배우는 기존 Actor1을 사용한다.

검토 명령: `node scripts/content/inspect-joseon-folklore.mjs <프로젝트 폴더>`, `node scripts/content/probe-joseon-folklore-battles.mjs`. 후자는 저장 후 읽은 게임의 실제6/12/19레벨·2/3/4등급 장비로 보스3종의 예고/발동과 승리·확정 재료 보상을 strict/gauge 양쪽에서 검사한다. 전리품 확률이나 장시간 진행 전체의 밸런스 판정은 아니다.

`npm run build:player` 후 `node scripts/content/export-joseon-folklore-game.mjs`로 재로드된 게임을 내보낸다. 런타임 시나리오는 `scripts/qa/runtime/joseon-folklore.scenario.mjs`이고 출하 player.html에 직접 연결한다. 전투 승리 화면 비트는 F 디버그 종료를 쓰며, 실제 피해/승리/보상 근거는 별도 전투 프로브다. `waitForFieldReady`가 보상·대사 종료 전에 다음 맵으로 이동하는 오류를 막는다.

환생부는 필드 전용이다. 전투 중 부활은8레벨 도사 기술 되살림을 쓴다. 저작 코드는 역할별 폴더에서 재생성할 수 있다. worker status의 ready는 파일 인계 준비를 뜻하며 사용자 시각 승인이나 정본 저장을 뜻하지 않는다. 전체 게이트/테스트 실행은 AGENTS의 세션 제한을 따른다.
