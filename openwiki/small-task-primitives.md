# 작은 일 동작

「이걸로 작업」 상자는 현재 맵, 이벤트 또는 자료집 레코드를 고정한다. 편집기는 `/v1/agent/run`의 `smallTask` 요청에 대상과 도구 호출 상한을 싣는다. 선택 영역과 대상 맵이 같으면 `selection.rect`에 선택 사각형을 복사한다. Pi 워커의 `runPiSmallTask`가 `list_small_task_primitives`와 `apply_small_task_primitive`를 제공한다. 모델은 현재 대상의 동작 이름, 제목, 입력 형식을 읽고 적용할 `{id, args}`를 넘긴다. 두 도구는 호스트가 보낸 대상과 영역을 사용한다. 동작은 사본을 만들어 범위 검사를 거치며, 실행이 실패하면 워커는 요청 전 프로젝트를 반환한다. 상자는 기존 변경 검증과 편집 기록을 사용해 턴 전체를 한 번에 적용하고 되돌린다.

## 동작 하나 추가하기

1. 담당 `src/editor/smallTask/primitives/units/<유닛>.ts`의 `PRIMITIVES`에 `SmallTaskPrimitive`를 추가한다. `UNIT`은 소유권 표에 있는 이름을 사용한다. 공용 등록 파일은 이미 30개 유닛을 정적으로 가져온다.
2. `covers`에 담당 명령 종류, 전용 목록 번호, 조건 종류, 자료집 컬렉션 또는 도구를 적는다. `targets`에 대상 종류를 적는다. 하나의 자료집 동작이 다루는 컬렉션을 `covers.collections`에 선언하면 목록도 그 컬렉션으로 제한된다.
3. `args`에는 최상위 객체 스키마와 한국어 설명을 넣는다. `scope`는 선택된 대상과 영역에서 작성 가능 범위를 얻는다. 명령에서 참조하는 아이템 등은 인자로 받아 확인할 수 있다. `apply`는 원본을 건드리지 않고 새 프로젝트를 돌려준다. `describe`는 표시 이름을 넣은 80자 이하의 한국어 한 문장이다. 입력이나 참조를 고쳐야 할 때는 한국어 `PrimitiveError`를 던진다.
4. 담당 유닛의 코퍼스 JSON과 테스트를 채운다. 기존 선택 밖의 데이터 보존, 명령 실행 결과, 편집 기록의 복원을 검증한다.

이름은 `cmd.<kind>.insert`, `m2.<세 자리>.insert`, `cond.<kind>.page.set`, `db.<collection>.update`처럼 쓴다. 나머지는 유닛 소유권에 맞는 맵, 이벤트, 대사, 퀘스트, 프로젝트 영역 접두사를 쓴다. 별칭은 다른 유닛의 모듈을 가져오는 대신 `aliasOf`에 등록 이름을 넣는다. 등록표는 별칭의 최종 동작과 입력 형식을 사용한다. 대상이 합류하기 전에는 그 별칭이 목록에서 빠진다. `hidden` 행은 모델 목록에서 빠진다. 등록표가 이름 중복과 별칭 순환을 확인한다.

`core/helpers.ts`의 `scopedPage`는 선택된 페이지를 찾고, 페이지가 지정되지 않았으면 첫 페이지를 쓴다. `updateScopedPage`는 해당 페이지 하나를 교체한다. `insertAtIndex(ctx, command, index?, branchPath?)`에서 줄 위치는 0부터 시작하며 생략하면 해당 명령 목록 끝에 넣는다. `branchPath`는 명령과 분기 위치의 쌍이며, 마지막 줄 번호는 따로 받는다. `eventName`, `mapName`, `recordName`, `koreanSentence`는 표시 문장에 쓴다.

공용 명령은 `cmd.delete`와 `cmd.move`다. 둘 다 `index`, 선택적인 `branchPath`와 `expectedHash`를 받는다. `cmd.move`의 `toIndex`는 같은 목록에서 이동 후의 위치다. `get_event`에서 명령 위치와 해시를 읽을 수 있다. 내용이 있는 분기 명령은 자식과 함께 이동할 수 있다. 분기 삭제는 자식이 남아 있으면 거절된다.

## 편집 범위

| 범위 | 편집 가능한 내용 |
| --- | --- |
| `dialogue` | 선택 페이지에서 대사 본문과 선택지 이름 |
| `eventPage` | 선택 페이지의 명령 목록. `field: "conditions"`를 명시하면 그 페이지의 조건만 허용 |
| `tileEvent` | 선택 칸의 타일과 그 칸의 이벤트, 해당 이벤트의 셀프 스위치 |
| `dbEntries` | 지정된 기존 레코드와 허용된 수의 새 레코드. `remove: true`를 명시하면 지정된 레코드도 삭제 가능 |
| `mapRegion` | 지정 사각형의 네 타일 층, 그림자와 타일 더미. 같은 칩의 통행 변경은 현재 프로젝트 맵에서 그 칩이 선택 영역 밖에 쓰이지 않을 때 허용 |
| `mapMeta` | 해당 맵의 속성, 조우 표, 맵 안의 장소, 그 맵과 연결된 항목, 변경 뒤 해당 맵을 가리키는 시작 위치. 맵 크기와 타일, 이벤트는 범위 밖 |
| `newMap` | 새 맵 한 장과 목록의 항목 하나. 호스트가 지정한 `sourceMapId`가 있으면 그 출발 맵과 새 맵 사이의 새 연결 하나 |
| `projectArea` | `quests`, `switches`, `variables`, `commonEvents`, `endings`에서 `ids`에 지정한 기존 항목과 `create` 한도까지의 새 항목. `system`은 `ids`에 지정한 시스템 필드를 허용하며 `title`, `startGold`, `startParty`로 이름과 시작 상태의 대응 필드를 고를 수 있다 |

범위 밖 변경은 한국어 이유와 「범위 밖」 줄로 반환한다. `runPrimitive(project, target, id, args, selection?)`은 적용한 프로젝트, 동작 문장, 변경 요약을 반환한다. 호출자가 저장 여부를 결정한다. 자료집 대상 타입은 프로젝트 자료집 컬렉션을 사용한다. 각 자료집 화면이 어떤 레코드에서 작은 일 버튼을 제공하는지는 화면이 정한다.

## 코퍼스와 화면 검수

[코퍼스 규격](../harness-data/small-task-corpus/README.md)에 따라 유닛 파일을 작성한다. `test/smallTaskPrimitives/harness.ts`에서 원본 픽스처, 대상, 범위 거절, 문장, 실제 편집 기록 복원, 헤드리스 실행를 쓸 수 있다.

화면 하네스는 `SHOTS_CASES`와 `SHOTS_OUT`이 설정되면 실행된다. 사례는 `{ fixture, setup?, target, primitive, args, label }` 배열이다. `setup`의 선택 필드 `mapName`, `events`, `database`로 화면에 열 시드를 준비하고 `rect: {x,y,w,h}`로 캔버스 영역을 선택한다. 빈 픽스처에 맵 이름, 이벤트, 영역을 제공하면 편집기의 기본 맵이 추가된다. 브라우저는 실제 작은 일 상자를 열고, Pi HTTP 요청을 받아 공용 동작 실행기로 처리한 응답을 돌려준다. 변경과 복원을 확인하며 `NN-before.png`, `NN-after.png`, `NN-summary.png`, `NN-undo.png`를 만든다. `test/piAgentSmallTask.bun.test.ts`는 모델 스트림을 고정해 실제 Pi 워커의 도구 호출과 실패 시 사본 폐기를 검증한다.

```sh
DEV_SERVER_PORT=9900 SHOTS_CASES=artifacts/step2/00-core/shots.json \
  SHOTS_OUT=artifacts/step2/00-core npx playwright test test/e2e/small-task-primitive-shots.spec.ts
```

2단계 병렬 검증에서는 위 명령을 공용 슬롯 제한기로 실행한다. 첫 자료집 증거의 `dbPriceProbe`는 단위 19 합류 전에도 가격 변경을 재현하도록 해당 테스트 브라우저의 유닛 모듈에만 테스트 동작을 넣는다.
