# full 직업 저자 검토

## 유지한 계약

초보·전사·도적·주술사·도사 5개 클래스 ID, 레벨 1~20 성장곡선, 공통 경험치 곡선, 습득 1/3/5/8/12/16, 한국어 전투 명령을 첫 샘플과 동일하게 유지한다. 변경한 실제 레코드 값은 네 직업의 `equipmentPermissions.equipmentIds`뿐이다. 각 직업은 자기 무기/의복 `_1.._4` 8개씩, 총 32개를 가진다. 포괄 `actorIds/classIds`와 초보의 신규 장비 목록은 모두 비어 있다.

## 실제 이미지 확인

첫 샘플에서 원본 Actor1과 참조 PNG를 직접 검토했다. full에서는 제목과 장비 인계 설명만 갱신한 `classes-preview.png`를 직접 열었다. 기존 하람 원본의 24×32 전경 RGB를 바꾸지 않고 배경색 키만 알파 0으로 처리한 사본을 3배 nearest neighbor로 표시한다. 새로운 배우 그림은 없으며 원본 해시·저작자·CC BY 4.0 출처와 재생성 명령을 보존했다. 저자 검토는 사용자 승인이 아니다.

## 개별 엔진 script 근거

`JF_CLASSES_PROTOTYPE=<읽기 전용 prototype-database.json> node content-packs/joseon-folklore/classes/run-smoke.mjs` 실행 exit **0**. 결과는 `smoke-proof.json`이다.

- `normalizeClassRecord`: 5개 레코드의 99칸 곡선과 습득 목록 보존. 21~99는 20레벨 값을 반복하고 실제 배우의 `maxLevel:20`은 root가 설정한다.
- `promoteActor(session, project, actorId, toClassId)`: 초보 하람에서 네 목적지를 명시해 성공. `effectiveActorClassId`, `actorOwnedSkillIds`, `battleCommandsForActor`로 직업·습득·한국어 명령을 확인.
- 각 직업×레벨 1~20: `actorDerivedStats`와 자동 습득 목록 확인. `computeActorLevelUp`로 신규 습득 시점과 20레벨 상한 확인.
- HP/기력은 전직으로 회복하지 않으며 새 상한으로만 제한한다. 전직 이후 다른 직업/초보로 승급할 경로가 없고 실패 요청은 진행을 바꾸지 않는다.
- `canEquip`: 권한 fixture 32개에서 자기 직업만 허용하고 초보와 다른 3직업을 거부한다. 별도의 공유 fixture는 장비 측 `equippableClassIds`에 네 직업을 넣어 네 직업만 허용한다. 실제 장비 수치·그림은 root 소유다.
- 기존 `applySkillLike`의 레벨 1 미장비 공격/피격 비교와 인메모리 세션 JSON 재로드도 확인했다. 실게임 전투나 SQLite 저장·재로드 증거로 주장하지 않는다.

## 인계 범위

이번 smoke의 입력은 변하지 않은 pilot prototype이므로 신규 기술24개가 없다. root가 전체 skills·몬스터 그림을 같은 원본에서 관리하며 실제 배우 곡선과 선택 이벤트를 교체한다. classes의 full 준비 상태는 그 통합 전투 밸런스·public 등록·정본 저장 또는 사용자 승인을 뜻하지 않는다. 고급 직업/새 Actor/공용 코드/DB는 수정하지 않았다. 전체 suite·stash·push는 실행하지 않았다.
