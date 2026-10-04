# 첫 샘플 저자 검토

## 실제 이미지 확인

원본 `public/assets/easyrpg/charset/Actor1.png`를 직접 열고, 생성된 `actor1-reference.png`와 `classes-preview.png`도 직접 이미지로 확인했다.

처음 비교 PNG의 청록 배경이 원본 투명색 키임을 확인했다. 최종 검토용 PNG에서는 그 키만 알파 0으로 처리했고, 전경 도트 색은 바꾸지 않았다. 원본 시트 크기 288×256과 24×32 프레임을 보존한다. 3배 확대는 nearest neighbor다. 비교표의 초보/전사/도적/주술사/도사 이름, 기력 용어, 1레벨·20레벨 수치, 한국어 전투 명령, 전직 조건이 잘림 없이 보인다. 이 검토는 **저자 검토이며 사용자 승인이 아니다**.

## 엔진 함수 근거

`JF_CLASSES_PROTOTYPE=<읽기 전용 prototype-database.json> node content-packs/joseon-folklore/classes/run-smoke.mjs` 최종 실행 exit **0**, 결과는 `smoke-proof.json`이다.

- 실제 `normalizeClassRecord`로 5개 레코드를 정규화해 99칸 능력치·습득 목록·장비 허용이 보존됨을 확인.
- `promoteActor`로 초보 하람에서 네 목적지를 각각 명시해 성공. `effectiveActorClassId`, `actorOwnedSkillIds`, `battleCommandsForActor`로 새 직업/첫 기술/명령을 확인.
- 레벨 1~20 각각 전직 후 `actorDerivedStats` 값과 습득 목록을 확인. `computeActorLevelUp`로 다음 레벨과 신규 기술의 정확한 시점, 레벨 20 상한을 확인.
- 전직은 HP를 회복하지 않고 MP를 상한으로만 제한함을 확인. 이미 전직한 뒤 재승급/초보 복귀 요청은 실패하며 세션을 바꾸지 않음.
- 인메모리 세션의 JSON 저장·재로드 후 직업/기술 유지 확인. **SQLite 저장 증거가 아니다.**
- 장비 권한 확인 전용 fixture 8개로 각 소유 직업만 허용, 다른 네 클래스는 거부됨을 `canEquip`로 확인. 실제 equipment 팩의 스탯/그림 테스트로 주장하지 않는다.
- 실제 `applySkillLike`로 레벨 1 미장비 기본 공격/피격 비교 수치를 확인. 적 방어 12·공격 30·기본 power 10, 무상성/분산0/치명0/앞줄 조건. 실제 적·기술·장비 결합 전 설명용 비교다.

## 한계

읽기 전용 현재 게임에는 신규 클래스 기술이 없으므로 24개 참조 모두 아직 미해결이다. skills 샘플 합류 뒤에도 레벨 5/8/12/16의 **16개**는 후속 정의를 기다린다. 데이터는 그 예약 ID를 그대로 보존하며 존재하지 않는 효과를 기술 설명으로 꾸미지 않았다.

하람의 기존 `class_jb_novice`, 동료의 옛 직업/배우 곡선, 기존 선택 이벤트는 실제 저장소에서 바꾸지 않았다. `design.json`에 감독자 적용 항목을 명시하고 깊은 복제본에만 그 변경을 적용해 전직을 확인했다. 실제 직업 체험 NPC·훈련 전투·확정 이벤트·정본 저장과 재로드는 이번 작업 범위가 아니다.

실게임 완성/사용자 승인 판정은 보류다. `ready`는 요청된 **첫 classes 샘플의 파일 준비 완료**만 뜻한다. gates/vitest/npm test/전체 typecheck/stash/push/PR은 실행하지 않았다.
