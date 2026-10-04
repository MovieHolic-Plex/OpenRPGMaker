# classes full 인계

## 결과

5클래스 완성 데이터와 full 디자인을 classes 폴더에 저장했다. 초보→4직업 전직과 한국어 명령, 성장 1~20·습득 1/3/5/8/12/16은 첫 샘플 계약을 유지한다. 네 직업의 `equipmentIds`를 자기 무기/의복 `_1.._4` 8개씩 총32개로 확장했다. 초보는 빈 장비 목록, 모든 `permissions.actorIds/classIds=[]`. 고급직업과 새 배우 그림은 0개다. 커밋 결과/해시는 최종 stdout을 참조한다.

## root가 연결할 원래 계약

| 기능 | 원래 이름/계약 | 인계 |
|---|---|---|
| 직업 데이터 | `ClassRecord`, `normalizeClassRecord(record)` | `data.json.classes` 5개 합치기 |
| 전직 | `promoteActor(session, project, actorId, toClassId)` | `actor_hero` 초보에서 선택한 목적지를 반드시 명시 |
| 이벤트 | `{kind:"promoteActor", actorId:"actor_hero", toClassId:"class_jf_warrior"}` | 목적지를 warrior/rogue/shaman/taoist 계약 ID로 각각 변경 |
| 실제 직업 조회 | `effectiveActorClassId(project, session, actorId)` | 확정 후 session `classOverrides` 확인 |
| 장비 허용 | `canEquip(project, actor, equipment, classId)` | 클래스의 정확한 ID 허용과 장비 측 직업 허용은 OR |
| 클래스 권한 | `equipmentPermissions.{actorIds,classIds,equipmentIds}` | 앞의 두 목록은 계속 비우기 |
| 공유 장비 | `EquipmentRecord.equippableClassIds` | 공유 대상 직업만 장비 측에 지정. 초보 허용 여부도 여기서 명시 |
| 장비형 아이템 | `ItemRecord.equipmentProfile.equippableClassIds` | 아이템 배열 경로에서는 이 원래 필드 사용 |
| 초기 곡선 | `actor.parameterCurves`, `actor.expCurve`, `actor.maxLevel` | root가 클래스 곡선 복사와 20레벨 상한 설정 |

초보는 Lv1 무료 전직 경로4개, 네 직업에는 추가 promotions가 없다. `toClassId` 생략 시 전사가 먼저 선택되므로 네 선택지 모두 목적지를 명시한다. 전직은 회복/장비 자동 해제를 보장하지 않는다. root가 기존 장비 반환·해제 및 해당 직업 초급 `_weapon_1`/`_body_1` 지급·장착을 처리한다. 초보나 다른 직업에 해당 초급 장비를 포괄 actor/class 허용으로 열지 않는다.

공유 장비는 클래스를 넓게 허용하지 않고 장비 측 `equippableClassIds`만 지정하면 된다. 1/5/10/15는 등급별 권장 레벨이며 `canEquip`에 새 레벨 제한 필드를 만들지 않았다.

## 근거와 한계

개별 순수 엔진 script exit0: 5개 정규화, 초보→네 전직, 직업마다20레벨 성장/습득, 명령, 32개 자기 장비 허용·직업간/초보 불허, 장비 측 공유 허용. `smoke-proof.json`·`REVIEW.md` 참조. 첫 샘플 대비 실제 레코드에서 장비ID 목록 외 값은 동일하다.

전체 기술24개·장비32개·몬스터 그림과 실제 게임은 root의 동일 원본에서 결합한다. 읽기 전용 pilot prototype의 누락을 full 원본 누락으로 단정하지 않는다. full `ready:true`는 classes 담당 파일 완료이며 실게임 통합/SQLite 저장 또는 사용자 승인이 아니다. 그림 출처·SHA-256·재생성 명령은 README/provenance에 유지했다. 소유 classes 폴더 외 변경, DB 쓰기, 공용 코드, 전체 suite, stash, push는 없다.
