> 수정 전 리뷰 기록입니다. 아래 결함의 처리 결과는 상위 README를 참고하세요.

**몬스터 데이터베이스 적대적 리뷰 — 2026-09-05**

대상은 데이터베이스의 **몬스터·몬스터 종족·적 그룹·진영** 네 탭과 해당 값의 정규화·전투 소비 경로다. 현재 워크트리 코드를 읽고, 전문가 모드 1680×1050 / 1024×768에서 네 탭을 관찰했다. 검증용 임시 세션에서만 입력을 변경했다. 제품 코드와 원격 프로젝트 데이터는 수정하지 않았다. AI 생성의 실제 외부 요청, 전체 내보내기/원격 저장 왕복, 모든 전투 모델의 게임 플레이를 검증한 것은 아니다.

**판정: 외형 통일보다는 저작값의 신뢰성을 먼저 고쳐야 한다.** 화면에서 다른 행을 수정하게 되는 문제, 빈 이벤트가 전투 상태를 바꾸는 문제, 반복 주기·기본값을 잘못 안내하는 문제가 있다. 진영은 네 탭 중 기능 방어가 비교적 충실하지만, 사용처와 결과를 확인하는 흐름이 부족하다.

P1은 의도하지 않은 데이터·전투 동작 또는 주요 편집 방해, P2는 오해·설정 실수·수정 비용, P3는 효율 개선으로 분류했다. 실행 재현과 소스 대조를 구분한다.

**먼저 처리할 결함**

1. **P1 / 종족 / 레벨별 스킬 — 한 행의 레벨 수정이 다른 행까지 바꾼다. [브라우저 재현]**
   - 시작: A 스킬 Lv1, B 스킬 Lv10. 첫 행을 20으로 입력하면 정규화가 B10/A20 순서로 정렬한다. 이어 포커스를 옮길 때 `change`가 여전히 첫 행 인덱스에 20을 저장해서 B까지 Lv20이 된다.
   - 실측: 저장은 A20/B20인데 화면은 A20/B10. 목록·저장값이 서로 다른 상태다. 스킬 변경·삭제도 같은 인덱스 의존 구조를 점검해야 한다.
   - 개선: 편집 중 행을 안정된 키로 식별하고, 정렬은 편집 확정 후 수행한다. 입력/포커스 이탈 이중 반영도 제거한다.
   - 완료 기준: 첫 행을 다른 행 너머 레벨로 이동시킨 뒤 스킬 변경·삭제·탭 왕복·되돌리기를 해도 나머지 행은 보존되어야 한다.
   - 근거: [스킬 행 이벤트](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseMonsterSpeciesView.ts#L623), [저장 시 정렬](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/project/monsterCollection.ts#L625), [실측 JSON](probe.json).

2. **P1 / 적 그룹 / 빈 전투 이벤트 — 명령이 없는데 적에게 상태를 부여한다. [순수 런타임 재현]**
   - 새 페이지는 `conditions: []`, `commands: []`, `span: battle`로 생성된다. 런타임은 명령 0개를 아무 일도 하지 않는 페이지로 취급하지 않고 `applyLegacyTroopPageFallback()`을 실행한다.
   - 이 경로는 살아 있는 첫 적에게 상태 목록의 첫 상태를 추가한다. 실제 전투는 프로젝트의 상태 목록을 전달한다. 독을 첫 상태로 준 최소 재현에서 빈 페이지 하나만으로 적에게 독이 붙었다.
   - 개선: 신규 빈 페이지는 무효 동작이어야 한다. 옛 데이터 호환이 필요하면 명시적 버전/마이그레이션으로 분리하고, 상태 부여는 보이는 명령으로 저작해야 한다.
   - 완료 기준: 새 페이지를 추가하기 전후 전투 상태·피해·보상이 같아야 한다.
   - 근거: [새 페이지](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventPanel.ts#L285), [빈 명령 분기](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/battle/battleEvents.ts#L181), [숨은 상태 부여](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/battle/battleEvents.ts#L952), [재현](runtime-probe.json).

3. **P1 / 적 그룹 / 반복 주기 — ‘매 라운드’가 같은 라운드에서 여러 번 실행될 수 있다. [순수 런타임 재현]**
   - UI는 `span: turn`을 ‘매 라운드’라고 표시한다. 런타임의 라운드 중복 방지는 span이 아니라 라운드 계열 조건이 있는지만 본다.
   - 조건 없는 turn 페이지에 골드 +1을 넣고 같은 라운드로 두 번 평가하면 두 번 발동하고 골드가 2가 된다. 본 런타임에도 전투 이벤트 평가 호출 지점이 여러 곳 있다.
   - 개선: span 자체를 실행 주기 권위로 삼는다. 조건은 ‘실행 자격’, span은 ‘최대 실행 빈도’로 분리한다.
   - 완료 기준: ‘매 라운드’는 같은 라운드에서 재평가해도 한 번, 다음 라운드에서는 다시 한 번 실행되어야 한다.
   - 근거: [표시](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventPanel.ts#L92), [실행 제한](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/battle/battleEvents.ts#L228), [재현](runtime-probe.json).

4. **P1 / 적 그룹 / 페이지 관리 — 중간 페이지 삭제 후 추가하면 ID가 충돌한다. [브라우저 재현]**
   - ID가 `battleEventPages.length + 1`이다. 1·2·3을 만든 뒤 2를 지우고 추가하면 1·3·3이 된다.
   - 수정은 같은 ID의 모든 페이지에 적용되고, 삭제도 같은 ID를 전부 제거한다. 런타임의 1회 발동 기록도 ID를 사용하므로 한 페이지가 다른 페이지의 실행을 막을 수 있다.
   - 개선: 페이지 ID는 고유 ID 생성기로 만들고 화면 번호와 분리한다. 이미 중복된 데이터의 복구도 필요하다.
   - 근거: [ID 생성](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventPanel.ts#L288), [수정](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventActions.ts#L12), [삭제](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventPanel.ts#L331).

5. **P1 / 몬스터 / 상태 유효도 — 같은 ‘보통’ 표시가 서로 다른 실제 값을 뜻한다. [브라우저·런타임 재현]**
   - 저장에 상태 키가 없으면 폼은 C(보통)를 표시한다. 런타임은 키가 없을 때 100을, C를 명시했을 때 60을 반환한다.
   - 즉 보통으로 보이는 설정을 보통으로 다시 선택하는 것만으로 상태 적용 배율이 바뀔 수 있다. 신규 상태 추가·희소 데이터에서 특히 위험하다.
   - 개선: 미지정과 명시값을 구별하고 런타임과 같은 기본값을 표시한다. 상태는 ‘적용 배율 60%’, 속성은 ‘피해 ×1.0’처럼 단위도 분리한다.
   - 근거: [미지정 C 표시](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseEnemyRecordView.ts#L739), [런타임 기본값](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/battle/battleStates.ts#L119), [C=60](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/project/actorModel.ts#L33).

6. **P1 / 적 그룹 / 1024px 배치 — 지원 최소 화면에서 핵심 입력이 겹친다. [브라우저 재현]**
   - 배치 방식 라디오와 참전 인원 입력이 겹친다. 미리보기의 긴 설명이 매우 좁은 열에 들어가 세로로 길어지고 미리보기가 아래로 밀린다.
   - 자동 계측은 clipped 5 / textClip 3을 보고했다. 숨은 리소스 ID 입력의 잘림은 오탐 가능성이 있어 사용자 결함 수로 합산하지 않았다. 미리보기 설명·배치 좌표·리소스 이름의 잘림은 별도로 확인했다.
   - 개선: 창 폭보다 **상세 창 가용 폭**을 기준으로 단일 열 전환. 긴 설명은 무대 위 짧은 요약과 도움말로 분리. 배치 방식과 참전 인원은 좁을 때 세로 배치.
   - 근거: [1024px 화면](troops-1024.png), [계측](conformance-1024.json), [설정 격자](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/styles/database/modern/troops.css#L161).

7. **P1 / 종족 / 타입 — 상성표에서 빠진 타입을 이 폼에서 제거할 수 없다. [브라우저 재현]**
   - 현재 상성표 타입만 체크박스로 만들고, 기존의 미등록 타입은 경고 문장만 만든다. 미등록 타입도 최대 2개 제한에는 포함된다.
   - 기존 두 타입이 모두 상성표에서 빠지면 새 타입은 선택할 수 없고 기존 타입을 해제할 체크박스도 없다.
   - 개선: 미등록 타입도 삭제 가능한 칩으로 유지하고 ‘제거/다른 타입으로 교체’를 제공한다. 상성표 타입 삭제 시 사용 종족을 미리 보여준다.
   - 근거: [타입 선택과 미등록 경고](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseMonsterSpeciesView.ts#L925).

**동작과 안내를 일치시킬 항목**

8. **P2 / 몬스터 / 액션 전투 — 생략된 기본값을 0으로 표시한다.**
   - 생략된 쿨다운·탄 속도는 폼에서 `attack[key] ?? 0`으로 표시하지만 런타임 기본은 각각 1200ms·6타일/초다. 화면의 0을 실제 값이라고 믿으면 잘못된 속도로 설계하게 된다.
   - ‘기본값 사용(1200ms)’처럼 표시하고 명시적 0과 구별한다. 시스템 패키지와 맵의 액션 전투 옵션이 모두 필요한 활성 조건도 바로 보여줘야 한다.
   - 공격 종류를 바꾼 직후에는 관련 입력이 없었으나 800ms 뒤에는 정상 표시됐다. 영구적인 폼 갱신 누락으로 판정하지 않았다.
   - 근거: [폼](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseEnemyRecordView.ts#L1010), [기본 상수](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/project/actionCombat.ts#L88), [런타임 소비](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/player/playSceneActionCombat.ts#L1251), [추가 실측](extra.json).

9. **P2 / 종족 / 기본 능력치 — ‘1레벨 기준값’ 설명이 틀렸다.**
   - 이 값은 최종 Lv1 능력치가 아니라 성장 공식의 입력이다. 최소 재현의 HP 종족값 36은 IV0/Lv1에서 HP11, 공격 종족값 7은 공격5가 됐다.
   - ‘종족값’으로 명명하고 레벨·개체값을 정한 실제 HP/공격 미리보기를 옆에 둔다. ‘몬스터에서 종족 생성’은 전투 스탯을 종족값으로 그대로 복사하므로 변환 결과를 미리 보여줘야 한다.
   - 근거: [설명](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseMonsterSpeciesView.ts#L426), [계산](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/project/monsterCollection.ts#L645), [복사](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseEnemyRecordView.ts#L532), [재현](runtime-probe.json).

10. **P2 / 적 그룹 / 참전 인원 — ‘0이면 제한 없음’은 실제 우선순위와 다르다.**
    - UI의 0은 undefined로 저장된다. 런타임은 그다음 시스템 activeSlots, 그다음 Gen1 기본 1명을 적용한다. 시스템이 1명인 게임에서는 0을 넣어도 전원 참전이 아니다.
    - ‘시스템 설정 사용 / 전원 / 직접 지정’을 구분하고 현재 적용 인원을 표시한다.
    - 근거: [입력 설명](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopRecordView.ts#L693), [0 처리](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopRecordView.ts#L740), [적용 우선순위](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/battle/runtime.ts#L211).

11. **P2 / 적 그룹 / 조건 편집 — 중요한 조건값을 숨기고, 없는 적도 대상으로 고를 수 있다.**
    - 스위치 조건에 ON/OFF 입력이 없고, 변수 조건에 비교 연산자 입력이 없다. 스위치·변수 참조는 이름 피커 대신 ID 문자열이다.
    - 적 HP 대상은 현재 그룹의 슬롯이 아니라 전체 몬스터 카탈로그다. 그룹에 없는 적을 선택하면 발동하지 않고, 같은 몬스터가 여러 슬롯에 있으면 첫 매칭 개체로 해석된다.
    - 개선: 스위치 이름+ON/OFF, 변수 이름+연산자+값, 해당 그룹의 슬롯 피커. HP 범위 0~100과 최소≤최대 검증. 완성된 조건을 자연어로 요약한다. 복수 조건 중 첫 조건의 종류를 바꿀 때 현재 전체 배열을 교체하는 경로도 바꿔, 나머지 AND 조건을 보존하거나 삭제 영향을 명시해야 한다.
    - 근거: [조건 입력](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventConditions.ts#L103), [HP 대상](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventConditions.ts#L140), [첫 매칭](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/battle/battleEvents.ts#L894).

12. **P2 / 적 그룹 / 1회만 발동 — 기본 상태에서 체크를 해제할 수 없다. [브라우저 재현]**
    - span=battle에서 체크 해제는 false 대신 undefined를 저장한다. 표시와 런타임은 undefined를 다시 ‘전투 중 1회’로 해석한다.
    - 독립 체크박스를 없애고 실행 빈도를 하나로 합치거나, false를 명시적으로 저장해야 한다. 서로 모순되는 스팬/체크박스 상태를 만들지 않는다.
    - 근거: [체크박스](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventPanel.ts#L101), [실행 의미](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/battle/battleEvents.ts#L234).

13. **P2 / 종족 / 포획 — 원본 계수를 최종 성공 확률처럼 부른다.**
    - ‘포획률 45%’라는 제목 칩은 실제 만HP 포획 성공률 14%와 다른 수치다. 카드에 HP별 결과가 있더라도 같은 확률 용어는 혼동을 부른다.
    - 개선: 원본은 ‘기본 포획 계수’, 결과는 ‘성공 확률’로 구별. 볼·상태이상·전투 모델 조건을 명시한다.
    - 값 변경 후 미리보기는 정상 갱신됐다. 0.45→0.8 입력 시 만HP/반HP/10% HP가 14/29/42%→24/52/74%로 바뀌었다. 갱신 결함으로 판정하지 않았다.
    - 근거: [입력과 제목](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseMonsterSpeciesView.ts#L413), [미리보기 함수](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseCapturePreview.ts#L11), [화면](monster-species-1680.png), [추가 실측](extra.json).

14. **P2 / 공통 / 경고가 정상 프로젝트를 미완성처럼 보이게 한다.**
    - 몬스터 수집 OFF는 일반 RPG에서 정상인데 몬스터·종족·적 그룹에 상시 경고를 띄운다. 보스의 종족 미설정도 포획 의도가 없으면 오류가 아니다.
    - 적 그룹의 ‘전투 후 보상/후속 연출 없음’은 적 자체의 EXP·돈·드롭 보상과 혼동된다. 전투 중 text/changeGold 존재만으로 ‘전투 후’ 연출이 있다고 판정하는 것도 부정확하다.
    - 개선: 기능 미사용은 중립 안내로 표시. ‘추가 전투 이벤트 없음’으로 기본 보상과 분리. 경고는 포획 명령을 실제 사용하는데 종족 연결이 없는 경우처럼 의도와 설정이 충돌할 때만 낸다.
    - 근거: [수집 경고](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/database.ts#L908), [보상 경고](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseTroopBattleEventPanel.ts#L146).

**진영 탭 개선 제안 — 확인한 범위에서 P1 결함은 제시하지 않는다**

- **P2 / 사용처 부족:** 몬스터·맵 출현·관계 변경 이벤트를 참조 검사로 찾을 수 있지만, 사용자는 삭제가 거절된 후 토스트로 본다. 상세 창에 ‘소속 몬스터 / 출현 맵 / 관계 변경 이벤트’를 클릭 가능한 목록으로 제공한다. 관계만 잘 만들어도 실제 게임에 소속이 연결되지 않으면 효과가 없다. [기존 참조 수집](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseFactionModel.ts#L249).
- **P2 / 평판 결과 예측 부족:** ‘처치당 가중치’만으로 어느 진영이 얼마나 변하는지 알기 어렵다. 피해 진영·처치 횟수를 고르면 플레이어에 대한 태도 변화와 선공 전환을 보여주는 미리보기를 추가한다. 런타임은 피해 진영/우호 진영에는 -가중치, 적대 진영에는 +가중치를 적용한다. [평판 UI](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseFactionView.ts#L326), [실제 규칙](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/project/factionRuntime.ts#L154).
- **P2 / 편집 범위 불분명:** 특정 진영 상세 창 안에 ‘프로젝트 전체 규칙’인 평판 설정이 반복된다. 전역 설정을 목록 상단의 공통 설정으로 옮겨 선택 진영만 바꾼다고 오해하지 않게 한다.
- **P3 / 규모 확장:** 상대 관계는 모든 진영을 나열하며, 고급 표는 접힌 상태여도 N² 셀을 생성한다. 진영이 많아지면 관계 검색·적대/우호 필터·선택 진영 중심 보기가 필요하다. 큰 표는 펼칠 때 생성하고 화면 독자 및 키보드 이동 계약을 유지한다. [관계 목록](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseFactionView.ts#L269), [전체 표 생성](https://github.com/MovieHolic-Plex/rpg-zzu/blob/3ab8ebb5/src/editor/panels/databaseFactionView.ts#L374).
- **유지할 강점:** 예약 ID 보호, 참조가 있는 진영 삭제 차단, ID 변경 시 몬스터·맵 스폰·명령 참조 갱신, 실제 선공 규칙을 이용한 설명, 기본값과 명시값 구분은 유지한다. 이 리뷰에서는 이러한 기존 방어를 ‘없다’고 지적하지 않았다.

**전 섹션 점검표와 추가 개선**

| 탭 | 섹션 | 판정·제안 |
|---|---|---|
| 공통 | 목록·검색·추가·복제·삭제 | 네 탭 모두 기본 탐색은 있음. 종족/몬스터/진영/사용 그룹/출현 맵을 오가는 사용처 탐색을 일관되게 제공. |
| 몬스터 | 기본 정보·레벨·진영 | 진영 안내가 능력치보다 큰 면적을 차지함. 요약+펼치기로 축소하고 레벨이 관여하는 계산 범위를 명시. |
| 몬스터 | 능력치 | 단독 숫자보다 대표 파티에 대한 예상 피해/버티는 턴 비교가 필요. |
| 몬스터 | 그래픽·AI 그림 | 리소스 ID 직접 입력보다 검증된 피커 중심. 투명·비행·색조의 런타임 지원 범위를 필드별로 분명히 표시. 지원 안내는 이미 존재함. |
| 몬스터 | 종족 연결 | 연결/열기/생성/그래픽 복사는 있음. 생성 전 능력치 변환 및 기존 연결 교체 결과를 미리 보여줄 것. |
| 몬스터 | 보상 | 아이템 없음+드롭률 양수, 드롭률 0+아이템 지정에 대한 설명. 드롭률에 % 단위. 복수 드롭/장비 드롭은 후속 기능 제안. |
| 몬스터 | 치명타 | 제목은 %인데 입력은 1/N. N=30 → 3.33%를 함께 표시. 사용 OFF 시 입력 잠금은 이미 구현됨. |
| 몬스터 | 옵션 | ‘일반 공격 빗나감’은 실제로 기본 명중값 100→90에 관여함. 최종 명중률은 다른 보정도 받으므로 ‘기본 명중률’로 설명할 것. |
| 몬스터 | 액션 전투 | 항목 8. 활성 조건, 공격 종류별 필드, 생략 기본값 개선. |
| 몬스터 | 상태·속성 유효도 | 항목 5. 정성적 등급만으로 실제 배율을 알 수 없음. 상태 배율과 속성별 실제 피해 배율 표시. |
| 몬스터 | 공격 패턴·행 편집 | 우선도 계산 도움말과 빈 행동 시 기본 공격 설명은 있음. 선택한 턴/MP에서 사용 가능한 행동과 제외 이유 미리보기 추가. |
| 종족 | 이름·타입 | 항목 7. 미등록 타입 제거 경로 필요. |
| 종족 | 그래픽 | 목록 썸네일과 상세 이미지의 배경 제거·색조 표현을 통일. 실측 리프링 썸네일은 자홍 배경, 상세는 흰 배경으로 다름. |
| 종족 | 포획 | 항목 13. 계수와 성공 확률을 구별하고 계산 조건 명시. 갱신 동작은 확인됨. |
| 종족 | 기본 능력치 | 항목 9. 종족값/레벨별 실제 스탯 구분. |
| 종족 | 레벨별 스킬 | 항목 1. 데이터 보존을 가장 먼저 수정. 중복 스킬/같은 레벨 순서 정책도 명시. |
| 종족 | 진화 | 조건은 AND이며 여러 후보 중 배열 순서가 결과에 영향을 줌. 선택 우선순위·레벨/아이템/친밀도 충족 미리보기 필요. 순환 경고와 아이템 진화 안내는 이미 있음. |
| 종족 | 경험치 곡선 | 요구 경험치 그래프뿐 아니라 대표 적/그룹 보상 기준 레벨업까지 필요한 전투 수를 보여주면 설계에 유용. |
| 종족 | 연결된 몬스터·진화 역참조 | 현재 교차 링크는 유지. 도달 가능한 출현 맵/포획 경로까지 연결 여부 표시. |
| 종족 | 상단 제작 현황 | 링크/출현/드롭 개수는 프로젝트 전체 집계. 선택 종족의 준비 상태로 오해하지 않게 전역 집계라고 명시. |
| 적 그룹 | 이름·전투 테스트·배경 | 전투 테스트는 있음. 현재 파티·장비·레벨·스킨 등 테스트 조건을 시작 전에 표시. 배경 넘기기와 배경 피커의 중복 역할 정리. |
| 적 그룹 | 배치 방식·참전 인원·포획 제한 | 항목 6·10. 시스템 상속과 실제 참전 수를 명시. 트레이너 전투와 포획 불가의 차이도 함께 설명. |
| 적 그룹 | 미리보기·슬롯·적 팔레트 | 항목 6. 현재 적을 교체하는 동작과 새 슬롯 추가를 명확히 구분. 예시 배치는 기존 구성을 덮어쓰므로 적용 결과 안내. |
| 적 그룹 | 지형 배경 | 리소스 선택 결과와 실제 전투 배경의 우선순위를 명확히 표시. |
| 적 그룹 | 밸런스·보상 합계 | 10회 고정 시드 시뮬레이션을 ‘승률’ 단일값만으로 읽지 않게 표본 수/조건 표시. 숨김 적 등장 시 보상 변동과 드롭률 0인 후보를 구분. |
| 적 그룹 | 이벤트 페이지·반복·조건 | 항목 2·3·4·11·12. 가장 많은 기능 위험이 집중된 영역. |
| 적 그룹 | 명령·보상 템플릿 | 공용 명령 편집과 지원 상태 표시는 유지. 항목 14의 부정확한 완료 판정 수정. 페이지 복사/붙여넣기는 현재 미구현 비활성 버튼임을 확인. |
| 진영 | 기본 정보·ID·색 | 참조 보존은 유지. 기술 ID는 고급 설정으로 이동 가능. |
| 진영 | 상대별 관계·전체 관계표 | 실제 선공 결과 설명은 장점. 상대 필터와 규모별 표 표시 개선. |
| 진영 | 행동 규칙·HP1 보호 | 보호 범위 설명은 있음. 선공 여부/오사격 여부/처치 가능 여부를 한 상대에 대해 함께 요약하면 더 명확. |
| 진영 | 처치 평판 | 전역 위치로 이동하고 처치 시 결과 미리보기 제공. |

**권장 작업 순서와 완료 기준**

1. 데이터·전투 의미 보존: 스킬 행 정렬, 빈 이벤트, 반복 주기, 페이지 ID, 상태 기본값을 먼저 고친다. 입력→저장→재로드→전투의 의미가 같다는 행동 테스트를 우선한다.
2. 실제 편집 가능성: 적 그룹 1024px 배치, 미등록 타입 정리, 액션 전투의 실제 기본값 표시.
3. 정확한 설명: 종족값, 참전 인원 상속, 포획 계수, 기본 명중률, 치명타 %, 기본 보상과 이벤트 보상의 구분.
4. 제작 효율: 사용처 링크, 전투/포획/평판 결과 미리보기, 관계 검색과 진화 우선순위.

**검증 결과와 한계**

- 추가 브라우저 확인: 중간 페이지 삭제 후 ID 1·3·3 중복, 미등록 타입 2개 때문에 새 타입 선택 거절, 1회 발동 체크 해제 후 다시 체크됨을 모두 재현했다. [최종 추가 실측](extra-rest.json).

- 네 탭 모두 1680×1050과 1024×768 스크린샷을 확보했다. [계측 1680](conformance-1680.json), [계측 1024](conformance-1024.json).
- 1680에서는 몬스터·종족의 기본 잘림/겹침 계측이 깨끗했다. 진영의 빈 면적 64% 경고는 레코드가 2개인 초기 화면의 기하 지표이며 기능 결함으로 판정하지 않았다.
- 관련 기존 테스트 9파일 55건 실행: **53 통과, 2 실패**. 실패는 `monsterCollection.test.ts`의 포획 완료/시뮬레이션 두 건. 이번에는 원인을 격리하지 않았으므로 곧바로 특정 기능 결함이나 새 회귀로 단정하지 않았다.
- 앱 코드 변경이 없는 리뷰이므로 전체 gates/typecheck를 추가로 실행하지 않았다. 기존 테스트 통과가 위의 연속 편집·빈 페이지 사례까지 보증하지는 않는다.
- 최초 의심한 ‘액션 숫자 연속 편집 시 앞선 값 소실’은 실제 브라우저에서 재현되지 않아 결함 목록에서 제외했다. 공격 종류별 폼과 포획 확률 문장도 지연 후 정상 갱신되어 누락 결함에서 제외했다. [기록](probe.json), [추가 실측](extra.json).
- 핵심 증거: [연속 편집](probe.json), [순수 런타임](runtime-probe.json), [상태·포획 추가 점검](extra.json), [타입·페이지 추가 점검](extra-rest.json), [좁은 적 그룹 화면](troops-1024.png).
