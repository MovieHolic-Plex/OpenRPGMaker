# 캐릭터별 전투 동작 (2026-10-03)

## 공용 적용과 우선순위

`src/assets/characterMotionCatalog.ts`가 공용 배우 136종의 직업을 11개 동작 계열에 명시적으로 연결한다.
새 프로젝트와 기존 프로젝트가 같은 카탈로그를 읽는다. 배우 ID를 해시하거나 이름에서 무기 종류를 추측하지 않는다.

| 계열 | 표현 |
|---|---|
| balanced | 표준 준비, 보행 복귀 |
| heavy | 긴 준비·이동·회수, 낮은 도약·피격 반동 |
| agile | 짧은 준비·이동, 도약 복귀 |
| lancer | 창을 뻗는 공격 칸, 그림의 실제 끝으로 접촉 |
| martial | 짧은 준비·회수, 가까운 타격 |
| ranged | 통상 공격과 기본 사격의 제자리 발사 |
| caster | 마법의 charge→raise→release 자세 |
| beast | 빠른 도약과 도약 복귀 |
| floating | 이동·복귀의 연속 활공 |
| vehicle | 느린 가속·회수, 지면 이동 |
| soft | 탄성 있는 도약 복귀, 큰 피격 반동 |

`resolveCharacterMotion`은 현재 직업 → 무기의 명시적 `battleMotionStyle` → 배우 `battleMotion` 순으로 합친다.
동물·탈것·몬스터의 기본 신체 계열은 직업/장비 교체로 사람 보행이 되지 않는다. 배우가 직접 정한 스타일은 최우선이다.
기본 무기 6종의 준비/회수 가중치도 적용한다. 그림의 무기는 시트에 그려져 있으며 장비 교체가 무기 그림을 다시 그리지는 않는다.

## 런타임과 편집기

- `src/battle/characterMotion.ts`: 배율 정규화, 프로그램 시간 조정, 자세/복귀 경로. 접촉 시각을 계산하기 **전에** 배율을 적용해 피해·소리·이동이 같은 시계를 쓴다.
- `src/player/battleMotionContext.ts`: 필드별 `BattleSnapshot`에서 `classOverrides`와 `actorEquipment`를 읽는다. 명시적인 빈 장비 `{}`는 무장 해제다. 전투 인스턴스 ID도 배우 레코드로 해석한다.
- `src/player/battleRetroMotion.ts`: 통상 공격의 준비/접근/복귀와 사격, 종별 파티 도트 이동.
- `src/player/retroSkillChoreography.ts`: 스킬 시작 시 프로필을 고정하고 공유 타임라인에 전달한다. 마법은 영창 자세를 유지한다.
- `actorRecordBattlePanels.ts`: 배우의 전투 동작, 준비·이동·회수·도약·반동 배율, 접촉 위치 보정. 기존 `updateDatabaseRecord`와 이력 경로를 쓴다.
- `databaseEquipmentRecordView.ts`: 무기 동작 계열. 기본은 캐릭터 계열 상속이다.
- `databaseSkillRetroStage.ts`: 실제 프로젝트 배우/무기를 선택해 같은 연출을 비교한다. 공용 연출과 기존 스킬 양쪽에 적용한다.

직접 저작한 `movement.tracks`는 절대 시각·경로 계약이므로 프로필로 다시 늘리거나 접촉 앵커를 변경하지 않는다.
일반 피격 반동은 대상 프로필을 쓰며, 던지기·끌기 같은 명시적인 대상 경로는 안무가 소유한다. 반동 배율이 전투 규칙의 면역/피해를 바꾸지는 않는다.

## 그림의 접촉점

`scripts/content/measure-battle-contact-bounds.py`는 278개 배포 시트(사람 74, 비인간 파티 64, 적 140)의
idle/strike/attack 알파 경계와 SHA-256을 `src/assets/battleContactBounds.json`에 기록한다.
그림을 바꾸면 이 스크립트로 다시 측정한다. 실제 PNG는 수정하지 않는다.
독립 원화 `charset-battler-silver-swordswoman`(2026-10-03)도 이 접촉 경계 표에 등록되어 있다.

`battleContactGeometry.ts`는 그 메타데이터를 동기 조회한다. 일반 스킬은 strike, 창 계열과 통상 공격은
실제로 펼쳐진 attack 칸을 사용한다. 알려진 시트에서는 무기 길이가 이미 경계에 포함되어 있으므로
스타일의 추정 reach를 중복 적용하지 않고 배우의 명시적인 접촉 보정만 더한다.
업로드 그림에는 기존 추정값을 사용한다. 독립 HTML의 data/blob URL은 `inlineAssetStore`의 역참조로 원래 경계를 찾는다.

## 저장과 증거

선택 필드이므로 기존 배우/장비는 수정 없이 상속한다. 정규화는 유한값만 받아들이며 시간/높이 배율 .4~2,
반동 0~2, 접촉 보정 -20~24px로 제한한다. `normalizeActorRecord`/`normalizeActorPatch`와
`normalizeEquipmentRecord`, 조수 DB 입력 스키마에 연결되어 JSON 로드·저장·재로드를 통과한다.

증거와 재현 명령은 [캐릭터 동작 확인](../verify-shots/character-motion/SUMMARY.md)을 본다.
공용 코드와 QA fixture 작업이며 사용자 프로젝트 SQLite에 콘텐츠를 작성한 작업이 아니다.
