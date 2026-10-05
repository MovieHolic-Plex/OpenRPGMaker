# 조선 설화 판타지 콘텐츠 팩

`joseon-folklore`는 기존 Project 데이터와 `retro2003` 전투를 쓰는 선택형 콘텐츠 팩이다.
온라인 기능이나 별도 전투 엔진을 추가하지 않는다. 기본 프로젝트에 강제로 설치하지 않는다.

## 멧돼지 재저작·몬스터 확장 (2026-10-05)

산멧돼지의 부풀어 오른 털 몸체를 낮고 긴 몸통·긴 주둥이·짧은 네 다리로 다시 그렸다.
독두꺼비(`shoot`)·방아토끼(`hop`)·장승귀(`stomp`)·옹기귀(`hop`)를 추가했다.
공용 팩은 **일반16/보스3, 총19종·171자세·초상19장**, 기술44·프로젝트 연출7이다.
Actor1, 기존 도깨비/처녀귀신을 포함한 나머지14종 PNG와 숲·지형은 보존한다.
새 그림은 사용자 검토 후보이며 등록/플레이 확인을 그림 승인으로 확대하지 않는다.

격리 작업자 GPT 6.1 sol high 둘의 저작 원본·실측·시각 결함은
`art-direction/wave2/{beasts,spirits}/REVIEW.md`에 있다. 배포 격자는
`monsters/source/refined-grids/`이며 `draw.py`가 같은 3×3 native64 소스로 재생성한다.
새 능력치/행동/기술/연출은 `source/expansion.py` → `monsters/expansion.json`으로 만든다.
`prepare-joseon-folklore.mjs`가 기존 역할 자료와 합쳐 공용 등록을 생성한다.
원래15종의 역할별 `data.json`과 행동 패치 경로는 보존한다.

독침뱉기는 정신14·MP3·독45%, 공이찍기는 물리20·MP3·실제 도약 접근,
장승울림은 전체 물리18·MP4·땅 균열, 뚜껑닫기는 자기 쇠숨100%·MP4이다.
기본 공격과 MP 부족 시 기본 공격 복귀도 네이티브 적 행동표를 쓴다.
독/쇠숨은 기존 상태를 사용하고 수치와 시각 효과를 구별한다.

`extend-joseon-monsters.mjs --save`는 예제 ID를 확인한 뒤 누락된4종·4트룹·4기술·4연출만
추가하고 기존 필드 스폰4곳의 troopId만 바꾼다(들판 jb_hunt_8/9, 굴 jb_cave_2/7).
출현 좌표·수·이동 그래픽·기존 DB 레코드·맵 지형/이벤트·세션은 보존한다.
SQLite revision11으로 저장·닫기·재로드했으며 참조 오류0이다.
새4종의 공용 소재 선택기/조수용 resourceProfiles 이름도 같은 설치 경로로 등록했다.
`prepare-joseon-folklore-starter.mjs <정본 폴더>`로 새 게임 프리셋의 출현 지점도 갱신했다.
조선 하네스 `validate`는 FAIL0/WARN0이며 타일/지도 재굽기는 수행하지 않았다.

`joseon-enemy-motion.capture.mjs --variety`는 신규4종 검토 편성으로 실제 출하 렌더러와
키보드 방어를 쓴다. 편성만 달라지며 적/아군 수치를 낮추거나 기술을 강제하지 않는다.
`--shipped`의 기존 실제2종 조우와 구별한다. 화면/정본/공용 팩 근거는
`verify-shots/joseon-monster-variety/`에 모은다. 모든19종의 장시간 난이도 승인은 아니다.

## 몬스터 실제 행동·기술 연출 (2026-10-05)

교정한 3종을 실제 전투에서 구분한다. 산멧돼지는 첫 전투 차례부터 1+3n에 엄니돌진을
준비하고 다음 자기 차례에 흙먼지와 가속 돌격으로 표적 앞까지 이동한다. 볏짚 도깨비는
기존 2+2n의 짚방망이에서 접근·내려치기·피격 반동·복귀를 쓴다. 처녀귀신은 첫 차례부터
1+4n에 한의울음을 준비하고 제자리 영창·전체 파동·귀봉 상태를 쓴다. 귀봉은 HP 피해가 없다.
나머지 12종의 행동과 모든 능력치·비용·상태 확률은 이번 변경에서 보존했다.

`skills/enemy-choreographies.json`의 프로젝트 연출 3종과 skillBindings를 공용 팩 생성기가
함께 묶는다. `joseonFolklore.ts`는 선택형 `skillChoreographies` 컬렉션도 정상화해 누락만
추가한다. 기존 ID의 저자 수정값을 덮지 않는다. 새 프리셋·기존 프로젝트·반복 설치를 각각
확인했다. 살아 있는 게임의 기존 기술/행동은 누락 추가로 갱신되지 않으므로 해당 SQLite
정본에 필요한 필드만 별도로 적용했다. 현재 정본 revision9, 재로드 참조 오류0.

기본 공격의 9포즈와 기술 연출은 기존 런타임을 쓴다. 돌진/강타는 저장 가능한 motion program
`dash`/`walk`, 피해에 맞춘 무게와 작은 흔들림을 쓰며 원래 전투 위치로 돌아온다. 상태 전용
한의울음은 기존 `cast` 타임라인을 쓴다. 물리 접촉용 movement의 preparing 필터가 대상 FX를
지우므로 이를 붙이지 않고, 화면 울음과 대상 파동을 같은 620ms에 재생한다.

`scripts/qa/runtime/joseon-enemy-motion.capture.mjs`는 출하 `player.html`에서 키보드 방어를
입력해 실제 기술·이동 좌표·준비 띠·FX·피해/상태 문장과 영상을 기록한다. 기본 실행은
검토용 3종 편성이며 능력치는 게임 그대로다. `--shipped`는 서버의 원본 `project.json`과
2종 조우를 쓰고 마지막에 F 자동 전투로 실제 승리까지 진행한다. F는 강제 승리가 아니다.
`--server`, `--project`, `--out`으로 대상을 지정한다. 근거는 `verify-shots/joseon-enemy-motion/`.
현재 숲·맵·세션은 그대로이며 이 결과를 다른 12종의 연출/전체 난이도 승인으로 확대하지 않는다.

## 그래픽 교정 상태 (2026-10-05)

사용자가 비교 뒤 **숲은 현재 그림 유지, 적은 새 후보 방향으로 추가 교정**을 선택했다.
이전 플레이 비트 통과를 그림 합격으로 확대하지 않는다. 앞서 수정한 Joseon pilot 나무·기와집은
별도 후보에 남아 있고 실제 프리셋은 공용 그림을 사용한다. 저작 원본과 선택/배포 상태를 함께 추적한다.

`content-packs/joseon-folklore/art-direction/README.md`에 새 조용한 풀 칸, 보존한 수정 나무,
새 몬스터3종과 남은 작업이 있다. 풀·나무 후보는 선택되지 않았고 현재 숲을 교체하지 않는다.
적은 후보3종의 비례·도트 방향을 유지하며 세부 표현과9개 전투 자세를 교정했고 공용 팩에 배포했다.
숲 후보 비교는 하네스 조립 그림이다. 다른12종·전체 그래픽의 최종 승인으로 확대하지 않는다.
동일 배치 비교와 브라우저 근거는 `verify-shots/joseon-art-correction/`.

추가 교정 원본은 `art-direction/monsters/refinement/`, 배포용 격자는
`monsters/source/refined-grids/`, 로더는 `refined.py`다. `draw.py` 재생성 경로에도 배선해
교정3종이 옛 도형 함수로 돌아가지 않게 했다. 기존 ID·수치·행동·나머지12종·숲 파일112개가 같다.
SQLite 정본은 revision6으로 저장/재로드했고 문서 SHA는 revision5와 같다. builtin 그림 경로가
공용 PNG를 소유한다. 내보낸 player.html의 실제 조우와 비교용3종 편성은
`verify-shots/joseon-enemy-refinement/`에서 구분해 확인한다.

## 소유권과 등록

- 저작 원본/ID: `content-packs/joseon-folklore/CONTRACT.md`, `ids.json`, 역할별 `data.json`, `design.json`, 원본 도트 코드/해시/검토 그림.
- 배포: `node scripts/content/prepare-joseon-folklore.mjs`로 public PNG와 `src/assets/joseonFolkloreData.json`, `joseonFolkloreAssets.json`을 만든다. JSON에는 이미지 바이트를 넣지 않는다.
- 적용: `src/project/contentPacks/joseonFolklore.ts`의 `applyJoseonFolklorePack(project)`는 누락된 ID만 추가한다. 재적용할 때 저자가 바꾼 레코드를 보존한다.
- 에디터: 데이터베이스 → 개요 → 콘텐츠 팩 → 조선 설화 팩 추가. 기존 store update/undo/SQLite 저장 경로를 쓴다. 저장 실패를 완료로 표시하지 않는다.
- 조수: `list_content_packs`, `apply_content_pack({packId:"joseon-folklore"})`. 상점·이벤트·배우·사냥터 연결은 별도의 콘텐츠 저작이다.
- 그림: 아이콘은 builtin resource resolver, 적은 `pixelEnemySheets` 9pose와 명시적인 `portraitPath`를 통해 등록한다. 웹 내보내기는 같은 리소스 ID의 portrait 및 전체 sheet를 함께 싣는다.

## 새 게임 기본 프리셋

새 게임 → 시작 방식 다시 고르기 → **조선 설화**. 런처 「장면에서 시작」에도 같은 선택지가 있다.
버들마을·사냥터·청석굴·주막·서당·약방과 전직/의뢰/상점/시련이 있는 새 프로젝트를 만든다.
클래스5(초보+4직업), 소비품20/재료12, 장비36, 적19, 기술44를 넣고 옛 장비/직업은 제외한다.
기존 Actor1과 얼굴, 조선 용어·Galmuri9·대화창·종이색 RM2003 측면 전투·세계관을 함께 설정한다.
기존 `adventure-jrpg` 위의 선택형 세계 프리셋이다.

배포 원본은 `content-packs/joseon-folklore/starter/{data,provenance}.json`.
`prepare-joseon-folklore-starter.mjs <정본 폴더>`는 SQLite API로 이벤트·세션을 읽고 현재
`src/project/regionReferences/joseon-village.json`의 공용 하네스 지도와 결합한다.
옛 프로젝트의 사냥터 지형 칸13645는 최신 칩셋에서 늪이다. 옛 칸을 최신 정의에 그대로 붙이지 않는다.
현재 공용 맵의 짐승길13503과 맞춘다. 새 그림/지형을 손으로 저작하지 않는다.
생성기는 `src/project/contentPacks/joseonFolkloreStarter.ts`, 시작 UI 정본은 `src/start/projectStart.ts`.
지도/칩셋 count·열 수가 바뀌면 프리셋을 함께 재생성한다.
실내 NPC/출입문/전송 시작점도 현재 공용 지도 앵커에 맞춘다. 옛 약방 (5,7)은 벽이라 (6,6)으로 진입한다.

`save-joseon-folklore-starter.mjs --project <새 폴더>`는 새 예제를 native SQLite에 저장/재로드한다.
기존 대상은 거절한다. 조선 예제의 명시적 갱신만 `--refresh-example`로 허용하고 이전 사본을 남긴다.
`export-joseon-folklore-game.mjs --starter`는 그 재로드본을 내보낸다.
생성 예제 ID `f84dfa19-5b71-43f1-8523-b10910d23be7`, 폴더
`/home/main/z-project/rpg-zzu/.oprn-projects/joseon-starter-preset-20261004`.
저장·실제 화면은 `verify-shots/joseon-folklore-starter/SUMMARY.md`.
시작 UI 폴더 브리지는 fixture로 관찰했고 정본 저장은 별도 native API로 확인했다.
분기 `then`/`else`까지 통합 순회해 의뢰 보상은 쑥단이다. 이후 이야기 던전의 완성을 뜻하지 않는다.

## 기존 버들마을 게임 적용

`node scripts/content/apply-joseon-folklore-game.mjs --project <SQLite 프로젝트 폴더>`는 현재 버들마을 RPG 대상의 후보만 만든다. `--save`를 추가할 때 같은 SQLite API로 저장한 뒤 닫고 다시 열어 데이터베이스·세션·시스템·맵을 비교한다. 사용자 프로젝트 ID를 고정 검사해 다른 폴더에 이 통합 레시피를 적용하지 않는다. 실행 중인 호스트 DB를 별도 프로세스로 수정하지 않는다.

배우 고유 곡선이 기본 성장값을 소유하고 전직 뒤에만 클래스 곡선을 쓰므로, 처음부터 직업을 가진 동료의 배우 곡선도 해당 클래스 곡선으로 맞춘다. 전직은 기존 promoteActor 권위자를 사용한다. 전직 선물은 실제 소지품 추가 후 changeEquipment로 장착한다. 장비 제한은 기존 canEquip OR 규칙을 따른다. 클래스의 포괄 actorIds/classIds 허용으로 다른 직업 장비를 풀지 않는다.

## 검토

전체 팩은 소비품20/재료12, 장비36, 일반16/보스3, 클래스5, 아군기술24/적기술16과 아이템 전용 효과4이다. 아이콘104장(아이템32·장비36·기술36), 몬스터19장의9포즈/초상을 배포한다. 기술 아이콘은 재사용 가능한 picture 소재다. 현재 네이티브 SkillRecord에는 아이콘 필드가 없으므로 전투 기술 목록에 강제로 새 필드를 추가하지 않는다.

원본 몬스터4종의 기력0은 기술비용과 맞지 않아 들쥐6/멧돼지9/볏짚도깨비9/박쥐8로 원본 데이터와 재생성 코드를 함께 수정했다. 배포 생성기가 적의 기술 존재·기력 비용을 검사한다. 원래 worker 보고서의 수치는 인계 당시 기록이다. 기술/소비품의 동일 슬러그는 `jf-skill-icon-*`/`jf-icon-*`로 분리한다.

통합 레시피는 기존6맵의 지형을 바꾸지 않고, 입구부터 깊은 곳 순으로12종 일반 적을 배치한다. 박쥐는 살아 있는 동료 조건을 쓰므로2마리 조우다. 청동 도깨비는 기존 굴 보스, 신부 원귀/산군은 산길 안내자(78,41)의 선택 시련이다. 이 선택 시련은 해당 장소의 완성된 스토리 던전을 뜻하지 않는다. 마을 상점56종/약방20종, pixel 상점은 확인키로1개씩 구입한다. 배우는 기존 Actor1을 사용한다.

검토 명령: `node scripts/content/inspect-joseon-folklore.mjs <프로젝트 폴더>`, `node scripts/content/probe-joseon-folklore-battles.mjs`. 후자는 저장 후 읽은 게임의 실제6/12/19레벨·2/3/4등급 장비로 보스3종의 예고/발동과 승리·확정 재료 보상을 strict/gauge 양쪽에서 검사한다. 전리품 확률이나 장시간 진행 전체의 밸런스 판정은 아니다.

`npm run build:player` 후 `node scripts/content/export-joseon-folklore-game.mjs`로 재로드된 게임을 내보낸다. 런타임 시나리오는 `scripts/qa/runtime/joseon-folklore.scenario.mjs`이고 출하 player.html에 직접 연결한다. 전투 승리 화면 비트는 F 자동 전투를 쓰며, 실제 피해/승리/보상 근거는 별도 전투 프로브다. `waitForFieldReady`가 보상·대사 종료 전에 다음 맵으로 이동하는 오류를 막는다.

환생부는 필드 전용이다. 전투 중 부활은8레벨 도사 기술 되살림을 쓴다. 저작 코드는 역할별 폴더에서 재생성할 수 있다. worker status의 ready는 파일 인계 준비를 뜻하며 사용자 시각 승인이나 정본 저장을 뜻하지 않는다. 전체 게이트/테스트 실행은 AGENTS의 세션 제한을 따른다.
