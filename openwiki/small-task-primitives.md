# 작은 일 동작

「이걸로 작업」 상자는 현재 맵, 이벤트 또는 자료집 레코드를 고정한다. 편집기는 `/v1/agent/run`의 `smallTask` 요청에 대상과 도구 호출 상한을 싣는다. 선택 영역과 대상 맵이 같으면 `selection.rect`에 선택 사각형을 복사한다. Pi 워커의 `runPiSmallTask`가 `list_small_task_primitives`와 `apply_small_task_primitive`를 제공한다. 모델은 현재 대상의 동작 이름, 제목, 입력 형식을 읽고 적용할 `{id, args}`를 넘긴다. 두 도구는 호스트가 보낸 대상과 영역을 사용한다. 동작은 사본을 만들어 범위 검사를 거치며, 실행이 실패하면 워커는 요청 전 프로젝트를 반환한다. 상자는 기존 변경 검증과 편집 기록을 사용해 턴 전체를 한 번에 적용하고 되돌린다.

## 동작 하나 추가하기

1. 담당 `src/editor/smallTask/primitives/units/<유닛>.ts`의 `PRIMITIVES`에 `SmallTaskPrimitive`를 추가한다. `UNIT`은 소유권 표에 있는 이름을 사용한다. 공용 등록 파일은 이미 30개 유닛을 정적으로 가져온다.
2. `covers`에 담당 명령 종류, 전용 목록 번호, 조건 종류, 자료집 컬렉션 또는 도구를 적는다. `targets`에 대상 종류를 적는다. 하나의 자료집 동작이 다루는 컬렉션을 `covers.collections`에 선언하면 목록도 그 컬렉션으로 제한된다.
3. `args`에는 최상위 객체 스키마와 한국어 설명을 넣는다. `scope`는 선택된 대상과 영역에서 작성 가능 범위를 얻는다. 명령에서 참조하는 아이템 등은 인자로 받아 확인할 수 있다. `apply`는 원본을 건드리지 않고 새 프로젝트를 돌려준다. `describe`는 표시 이름을 넣은 80자 이하의 한국어 한 문장이다. 입력이나 참조를 고쳐야 할 때는 한국어 `PrimitiveError`를 던진다.
4. 담당 유닛의 코퍼스 JSON과 테스트를 채운다. 기존 선택 밖의 데이터 보존, 명령 실행 결과, 편집 기록의 복원을 검증한다.

이름은 `cmd.<kind>.insert`, `m2.<세 자리>.insert`, `cond.<kind>.page.set`, `db.<collection>.update`처럼 쓴다. 나머지는 유닛 소유권에 맞는 맵, 이벤트, 대사, 퀘스트, 프로젝트 영역 접두사를 쓴다. 별칭은 다른 유닛의 모듈을 가져오는 대신 `aliasOf`에 등록 이름을 넣는다. 등록표는 별칭의 최종 동작과 입력 형식을 사용한다. 대상이 합류하기 전에는 그 별칭이 목록에서 빠진다. `hidden` 행은 모델 목록에서 빠진다. 등록표가 이름 중복과 별칭 순환을 확인한다.

`core/helpers.ts`의 `scopedPage`는 선택된 페이지를 찾는다. 페이지를 생략하면 페이지가 하나뿐인 이벤트에서 그 페이지를 쓴다. `updateScopedPage`는 해당 페이지 하나를 교체한다. `insertAtIndex(ctx, command, index?, branchPath?)`에서 줄 위치는 0부터 시작하며 생략하면 해당 명령 목록 끝에 넣는다. `branchPath`는 명령과 분기 위치의 쌍이며, 마지막 줄 번호는 따로 받는다. `eventName`, `mapName`, `recordName`, `koreanSentence`는 표시 문장에 쓴다.

공용 명령 `cmd.delete`와 `cmd.move`는 `index`와 `expectedHash`를 필수로 받고 분기 안의 줄에는 `branchPath`를 받는다. `cmd.move`의 `toIndex`는 같은 목록에서 이동 후의 위치다. `get_event`에서 `includeCommandHashes`를 켜고 명령 위치와 해시를 읽는다. 줄의 해시가 달라졌으면 이벤트를 다시 읽으라는 안내를 돌려준다. 내용이 있는 분기 명령은 자식과 함께 이동할 수 있다. 자식이 남은 분기, 하위 분기에서 참조하는 위치 표시, 다른 이벤트에서 제거하는 출현 대상을 삭제하면 한국어 사유로 거절한다.

페이지가 없는 기존 이벤트에는 두 명령을 제안하지 않는다. 퀘스트 그래프의 완료 조건이 읽는 스위치를 설정하는 명령이 하나뿐이면 삭제를 거절한다.

`dialogue.line.remove`는 `get_event({includeCommandHashes:true})`의 `pageHashes`에서 선택 페이지의 `pageHash`를 받아야 한다. 같은 페이지에서 명령을 추가하거나 위치를 바꿨으면 삭제 전에 페이지를 다시 읽는다. `dialogue.firstTimeOnly`가 만든 셀프 스위치는 대사를 끝낸 뒤 기록하며 컷신 빨리 감기 중에는 기록하지 않는다. `dialogue.speaker.set`에 빈 문자열을 주면 인물 프로필이 연결된 경우에도 이름표를 숨긴다.

유닛 30은 명령 수정·삭제와 위치를 지정한 삽입에서 `get_database_records`의 `collection: "commonEvents"`, `include: "full"`로 읽은 `commandListHash`를 `expectedListHash`로 받는다. 목록 해시가 달라지면 명령을 다시 읽도록 안내한다. 한 요청은 작업 시작 때 있던 공용 이벤트만 수정할 수 있고 새 이벤트는 한 건만 만들 수 있다. 맵에 사각형이 선택돼 있으면 영역을 해제한 뒤 공용 이벤트를 편집한다. 공용 이벤트 삭제는 적용 직전에 편집기의 열린 맵 이벤트 초안도 확인한다.

공용 이벤트에서 맵 이벤트를 부르는 명령은 실행 시 현재 맵에서 ID를 찾으므로 프로젝트의 모든 맵에 해당 ID가 저장돼 있어야 한다. 호출을 추가하거나 대상을 바꿀 때, 또는 공용 이벤트를 자동 실행·병렬 처리로 전환할 때에는 각 맵에서 하위 호출을 따라가며 이동 명령에 필요한 라벨을 확인한다.

대화 명령을 수정하거나 삽입 위치를 지정할 때는 `get_event`의 `commandHashTarget: { pageId, index?, branchPath? }`으로 이벤트 본문 없이 페이지 해시를 읽을 수 있다. 반환된 `expectedPageHash`는 기존의 순서대로 나열한 `expectedPageHashes`를 대신한다. 수정할 때는 줄 번호를 함께 조회해 반환된 `expectedHash`도 전달한다.

## 편집 범위

| 범위 | 편집 가능한 내용 |
| --- | --- |
| `dialogue` | 선택 페이지에서 대사 본문과 선택지 이름 |
| `eventPage` | 선택 페이지의 명령 목록. `field: "conditions"`를 명시하면 그 페이지의 조건만 허용 |
| `tileEvent` | 선택 칸의 타일과 그 칸의 이벤트, 해당 이벤트의 셀프 스위치 |
| `dbEntries` | 선택한 레코드의 `fields`와 `create`로 허용된 새 레코드. 기본 장비 칸 편집 중 만들 수 있는 장비 칸은 선택한 ID로 한정 |
| `dbRemove` | 선택한 자료집 레코드 삭제. 기존 유닛의 `dbEntries.remove`도 같은 삭제 범위로 해석 |
| `mapRegion` | 지정 사각형의 네 타일 층, 그림자와 타일 더미. 같은 칩의 통행 변경은 현재 프로젝트 맵에서 그 칩이 선택 영역 밖에 쓰이지 않을 때 허용 |
| `mapMeta` | 해당 맵의 `fields`에 나열한 속성. `worldmapSource` 같은 구조 필드는 보호한다. `connections`는 연결 변경을 금지하거나 출발 연결만 또는 양방향을 허용한다. 시작 위치는 `startPosition`으로 지정 |
| `mapResize`, `mapRemove` | 선택 맵의 크기와 타일 배열을 조정하거나 선택 맵과 그 맵의 트리 항목을 삭제 |
| `newMap` | 새 맵 한 장과 목록의 항목 하나. 호스트가 지정한 `sourceMapId`가 있으면 그 출발 맵과 새 맵 사이의 새 연결 하나 |
| `projectArea` | `quests`, `switches`, `variables`, `commonEvents`, `endings`에서 `ids`에 지정한 기존 항목과 `create` 한도까지의 새 항목. `system`은 `ids`에 지정한 시스템 필드를 허용하며 `title`, `startGold`, `startParty`로 이름과 시작 상태의 대응 필드를 고를 수 있다 |

자료집 삭제 검사에서 `itemId`는 아이템과 장비, `skillId`는 전투 스킬과 생활 스킬의 참조를 보호한다.

범위 밖 변경은 한국어 이유와 「범위 밖」 줄로 반환한다. `runPrimitive(project, target, id, args, selection?)`은 적용한 프로젝트, 동작 문장, 변경 요약을 반환한다. 호출자가 저장 여부를 결정한다. 자료집 대상 타입은 프로젝트 자료집 컬렉션을 사용한다. 각 자료집 화면이 어떤 레코드에서 작은 일 버튼을 제공하는지는 화면이 정한다.

Pi는 맵 대상에 선택 사각형이 있으면 기존 `paint_tiles`를 비롯한 도구의 변경을 호출마다 `mapRegion` 범위로 검사한다. 유닛 28의 프로젝트 자료 동작에는 `projectArea` 범위를 쓴다. 턴 마지막에는 요청 시작 시점의 프로젝트에 검사된 프로젝트 자료 변경과 아래의 이벤트 추가를 반영한 기준본으로 `mapRegion` 검사를 다시 한다. 범위 위반이 생기면 그 턴의 변경을 모두 폐기한다. 개발 및 테스트에서 `runPrimitive`는 기준 프로젝트의 중첩 데이터를 동결해 제자리 수정을 즉시 검출한다. 배포 실행에서는 동작이 바꾸는 경로만 복사한다.

편집기는 `smallTask.draftSource`에 시작 시점의 열린 이벤트와 초안 원본을 싣는다. Pi 워커는 이 정보를 `runPrimitive(project, target, id, args, selection, live)`의 범위 및 참조 검사에 전달한다. 검사에 사용한 초안은 동작 결과에 추가되지 않는다.

유닛 24의 `event.tile.create`가 선택한 한 칸에 이벤트를 추가하면 Pi는 `tileEvent` 검사를 통과한 추가분을 최종 `mapRegion` 검사의 기준에 반영한다. 최종 검사는 타일 변경의 범위와 새 이벤트의 보존을 확인한다. 읽기 전용 Pi 실행에는 쓰기 도구가 노출되지 않는다. 이벤트 삭제는 열린 초안이 참조하거나 진행 스위치로 의존하는 이벤트를 보호한다.

주인공·직업·캐릭터 외형의 경우 `commitSmallTask`는 삭제할 항목이나 새 ID를 열린 이벤트가 이미 참조하는지 적용 직전에 확인한다. 주인공 추가·삭제는 대사의 주인공 번호를, 주인공·외형의 삭제와 이름 변경은 화자 이름을 확인한다.

`27-quests`에서 범위 검사를 통과한 의뢰 정의 변경은 타일 선택 영역이 있어도 적용할 수 있다. 단계형 퀘스트의 보상 편집은 저장된 정의에 적용되며 플레이 지급 이벤트를 갱신하려면 별도 컴파일이 필요하다. 단계형 목표를 추가하거나 교체할 때는 열린 초안에 있는 진행 스위치·변수 참조도 확인한다. 퀘스트 삭제 시에는 열린 초안의 명령도 확인하고, 그래프 완료 조건을 추가하거나 바꿀 때는 초안을 취소해도 남는 스위치 쓰기를 확인한다.

## 코퍼스와 화면 검수

[코퍼스 규격](../harness-data/small-task-corpus/README.md)에 따라 유닛 파일을 작성한다. `test/smallTaskPrimitives/harness.ts`에서 원본 픽스처, 대상, 범위 거절, 문장, 실제 편집 기록 복원, 헤드리스 실행를 쓸 수 있다.

화면 하네스는 `SHOTS_CASES`와 `SHOTS_OUT`이 설정되면 실행된다. 사례는 `{ fixture, setup?, target, primitive, args, label }` 배열이다. `setup`의 선택 필드 `mapName`, `events`, `database`로 화면에 열 시드를 준비하고 `rect: {x,y,w,h}`로 캔버스 영역을 선택한다. 빈 픽스처에 맵 이름, 이벤트, 영역을 제공하면 편집기의 기본 맵이 추가된다. 브라우저는 실제 작은 일 상자를 열고, Pi HTTP 요청을 받아 공용 동작 실행기로 처리한 응답을 돌려준다. 변경과 복원을 확인하며 `NN-before.png`, `NN-after.png`, `NN-summary.png`, `NN-undo.png`를 만든다. `test/piAgentSmallTask.bun.test.ts`는 모델 스트림을 고정해 실제 Pi 워커의 도구 호출과 실패 시 사본 폐기를 검증한다.

GitHub Actions의 기본 E2E 실행은 `parity.yml`의 `e2e` 작업에서 Chromium을 설치하고 `npm run test:e2e`를 호출한다. 그 작업에는 `SHOTS_CASES`와 `SHOTS_OUT` 설정이 없어 화면 촬영 스펙은 건너뛴다. CI에서 촬영하려면 사례 JSON을 준비한 뒤 Playwright 단계에서 아래처럼 스펙을 지정한다. 로컬 촬영은 현재 요청에서 사용자가 명시한 경우에만 `OPRN_LOCAL_TESTS=1`로 실행할 수 있다.

```sh
SHOTS_CASES=artifacts/step2/00-core/shots.json \
  SHOTS_OUT=artifacts/step2/00-core npm run test:e2e -- test/e2e/small-task-primitive-shots.spec.ts
```

첫 자료집 증거의 `dbPriceProbe`는 단위 19 합류 전에도 가격 변경을 재현하도록 해당 테스트 브라우저의 유닛 모듈에만 테스트 동작을 넣는다.
