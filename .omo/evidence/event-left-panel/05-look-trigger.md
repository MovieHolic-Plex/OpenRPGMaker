# 이벤트 좌측 패널 `look-talk` / 트리거 / 우선순위 / 애니메이션 런타임 감사

## 범위와 판정 기준

- 기준 소스: 현재 워크트리 `/home/main/z-project/rpg-zzu-event-page-props`.
- `PASS`: 에디터 값이 저장되고 런타임의 해당 동작에 소비된다.
- `ORPHAN`: 저장 값은 있으나 해당 값을 구분하는 런타임 소비/분기가 없다.
- `BROKEN`: 일부 값만 소비되거나, 노출된 의미와 실제 동작이 다르거나, 필요한 컨트롤/저장 필드가 없다.
- `look-talk` 그룹은 실제로 `.presence`와 `event-classic-graphic`만 수집한다(`src/editor/panels/eventEditor/pageProps.ts:774-779`). 트리거·우선순위는 `when`, 애니메이션 유형은 `move` 그룹에 들어간다(`src/editor/panels/eventEditor/pageProps.ts:775-781`).

## 1. 항목별 판정표

| 항목 | 에디터 컨트롤(file:line) | 저장 필드 | 런타임 소비(file:line) | 판정 | 근거 |
|---|---|---|---|---|---|
| 그래픽 스프라이트 | 직접 입력/선택 버튼 `src/editor/panels/eventEditor/pageProps.ts:1057-1066`, `src/editor/panels/eventEditor/pageProps.ts:1078-1083`; 선택 확정 `src/editor/panels/eventEditor/npcGraphicPicker.ts:136-139` | `page.graphic.sprite` | 활성 페이지에서 `sprite`를 뽑음 `src/project/runtimeEventState.ts:83-100`; 텍스처 해석 `src/player/eventSpriteResources.ts:11-30`; 스프라이트 생성 `src/player/playSceneMapRuntime.ts:331-350` | **PASS** | 저장한 sprite id가 런타임 texture로 해석되어 실제 Phaser sprite 생성에 쓰인다. |
| 방향 | 방향 라디오 `src/editor/panels/eventEditor/npcGraphicPicker.ts:90-95`; 확정 시 저장 `src/editor/panels/eventEditor/npcGraphicPicker.ts:197-217` | `page.graphic.direction` 및 방향을 포함한 절대 `page.graphic.pattern` | view 기본 방향 `src/project/runtimeEventState.ts:99-100`; 방향별 idle frame 변환 `src/player/eventSpriteResources.ts:33-42`; 페이지 무버 초기 방향 `src/player/playScenePageMoveRoutes.ts:50-55` | **PASS** | 피커는 방향을 독립 필드와 charset 절대 프레임에 함께 기록한다. 무버와 방향별 프레임 계산이 이를 소비한다. 다만 직접 sprite id만 입력하면 direction/pattern은 새로 만들지 않는다(`src/editor/panels/eventEditor/pageProps.ts:1062-1066`). |
| 패턴/프레임 | 패턴 라디오 `src/editor/panels/eventEditor/npcGraphicPicker.ts:93-95`; 확정 `src/editor/panels/eventEditor/npcGraphicPicker.ts:209-217` | `page.graphic.pattern` | authored pattern 선택 `src/player/playSceneMapRuntime.ts:334-345`; texture frame 기본값 `src/player/eventSpriteResources.ts:11-20`; 자율 이동 base frame `src/player/playSceneAutonomous.ts:43-45` | **PASS** | 슬롯·방향·패턴이 합쳐진 절대 frame index가 초기 렌더와 걷기 frame의 기준값이다. 프로브 왕복 인코딩도 통과했다. |
| 반투명·불투명도 | 이진 `맵에서 숨기기` 체크만 있음 `src/editor/panels/eventEditor/pageProps.ts:1068-1072`, `src/editor/panels/eventEditor/pageProps.ts:1084`; 연속 opacity 컨트롤 없음 | `page.graphic.transparent?: boolean`; `EventPageGraphic`에 opacity 없음 `src/project/types/events.ts:413-418` | transparent이면 sprite 제거 `src/project/runtimeEventState.ts:82-100`; 자율 이동 route opacity는 별도 mover 값으로 적용 `src/player/playSceneAutonomousSprites.ts:37-40` | **BROKEN** | 완전 투명/불투명 전환은 반영되지만 페이지 속성으로 반투명도(0..255)를 저작·저장할 수 없다. 런타임의 mover opacity는 이동 루트 명령 전용이며 페이지 컨트롤과 연결되지 않는다. |
| 얼굴그림 | `look-talk`/페이지 그래픽 컨트롤에 없음 `src/editor/panels/eventEditor/pageProps.ts:774-779`; `facesetPreview`는 명령용 renderer `src/editor/panels/eventEditor/facesetPreview.ts:1-24` | `EventPageGraphic`에 얼굴 필드 없음 `src/project/types/events.ts:413-418`; 얼굴은 text/changeFace 명령 계열 | 페이지 단위 소비 없음; 대화 명령 경로만 얼굴을 소비함(페이지 그래픽 runtime view에는 sprite만 존재 `src/project/runtimeEventState.ts:33-43`) | **BROKEN** | “모습과 대화” 그룹 이름과 달리 페이지 단위 얼굴그림 컨트롤/필드/소비가 없다. 얼굴 변경은 이벤트 명령으로만 가능하다. |
| 이벤트 이름 | 페이지 이름 입력/저장 `src/editor/panels/eventEditor/pageProps.ts:42-51`; 현재 UI 제목줄의 실사용 컨트롤 `src/editor/panels/eventEditor/modal.ts:279-288` | `page.name` | 선물 메뉴 제목 `src/player/playSceneInterpreter.ts:63-66`; 친밀도 피드백 speaker `src/player/playSceneInterpreter.ts:100-112` | **PASS** | 페이지 이름은 저장되며 NPC 선물/친밀도 대화에서 실제 표시명으로 소비된다. 단, `pageProps.ts`의 기존 카드 컨트롤은 숨은 카드에 있고(`src/editor/panels/eventEditor/content.ts:213-217`), 현재 보이는 컨트롤은 제목줄이다. |
| 시작 방식: action | 선택지 정의 `src/editor/panels/eventEditor/options.ts:16-23`; 변경 저장 `src/editor/panels/eventEditor/pageProps.ts:612-616` | `page.trigger={kind:"action"}` | 확인키 정면/발밑 검색 및 실행 `src/player/playSceneMovement.ts:272-301` | **PASS** | `handleAction`이 action view를 찾고 `runEvent`를 호출한다. |
| 시작 방식: playerTouch | 같은 트리거 select `src/editor/panels/eventEditor/pageProps.ts:612-616`; option `src/editor/panels/eventEditor/options.ts:19` | `page.trigger={kind:"playerTouch"}` | 이동 완료 후 발밑 실행 `src/player/playSceneMovement.ts:378-381`; 같은 우선순위 충돌 시 실행 `src/player/playSceneMovement.ts:400-406` | **PASS** | 통과형 이벤트와 blocking 이벤트 양쪽 경로가 있다. 레거시 `touch`도 함께 수용한다. |
| 시작 방식: eventTouch | 같은 트리거 select `src/editor/panels/eventEditor/pageProps.ts:612-616`; option `src/editor/panels/eventEditor/options.ts:20` | `page.trigger={kind:"eventTouch"}` | NPC가 플레이어 칸으로 이동 시 실행 `src/player/playSceneAutonomous.ts:61-67`, `src/player/playSceneAutonomous.ts:167-169`; 플레이어 충돌 경로는 일반 eventTouch를 제외 `src/player/playSceneMovement.ts:400-406` | **BROKEN** | 런타임 분기는 있으므로 ORPHAN은 아니다. 그러나 event가 움직여 player를 만나는 경우만 일반적으로 실행된다. 플레이어가 같은 층 eventTouch 이벤트에 부딪히면 `firePlayerTouchEvent`가 무시하며, fixed 이동은 mover도 등록하지 않는다(`src/player/playScenePageMoveRoutes.ts:78-84`). |
| 시작 방식: autorun (`auto`) | option `src/editor/panels/eventEditor/options.ts:21`; 저장 `src/editor/panels/eventEditor/pageProps.ts:612-616` | `page.trigger={kind:"auto"}` | 활성 auto 목록과 `runEvent` `src/player/playSceneMapRuntime.ts:449-457`; 초기 UI 준비 후 호출 `src/player/PlayScene.ts:509-525` | **PASS** | 활성 페이지별 key로 한 번 시작하고, runtime surface refresh 후 조건/page 변경도 다시 검사한다(`src/player/playSceneMapRuntime.ts:442-446`). |
| 시작 방식: parallel | option `src/editor/panels/eventEditor/options.ts:22`; 저장 `src/editor/panels/eventEditor/pageProps.ts:612-616` | `page.trigger={kind:"parallel"}` | 매 update 호출 `src/player/playSceneMovement.ts:75-78`; active parallel process 생성/재개 `src/player/playSceneSchedulers.ts:59-85` | **PASS** | 활성 페이지의 명령을 별도 interpreter process로 실행하고 page가 비활성화되면 process를 제거한다. |
| 우선순위: below | option `src/editor/panels/eventEditor/options.ts:156-162`; 저장 `src/editor/panels/eventEditor/pageProps.ts:618-623` | `page.priority="below"` | depth base 100k `src/player/characterDepth.ts:5-9`; 통행 차단에서 제외 `src/project/runtimeEventState.ts:229-236` | **PASS** | same보다 아래에 렌더되고 통행을 막지 않는다. |
| 우선순위: same | 같은 priority select `src/editor/panels/eventEditor/pageProps.ts:618-623` | `page.priority="same"` | depth base 200k `src/player/characterDepth.ts:5-9`; `same && overlapForbidden` 차단 `src/project/runtimeEventState.ts:229-236` | **PASS** | player와 y-sort되고 overlapForbidden 기본값 true일 때 통행을 막는다. |
| 우선순위: above | 같은 priority select `src/editor/panels/eventEditor/pageProps.ts:618-623` | `page.priority="above"` | depth base 300k `src/player/characterDepth.ts:5-9`; 통행 차단에서 제외 `src/project/runtimeEventState.ts:229-236` | **PASS** | same보다 위에 렌더되고 통행을 막지 않는다. |
| 애니메이션 유형 | 6종 option `src/editor/panels/eventEditor/options.ts:164-171`; 저장 select `src/editor/panels/eventEditor/pageAnimationType.ts:6-14`; fieldset `src/editor/panels/eventEditor/pageProps.ts:719` | `page.animationType` | view 전달 `src/project/runtimeEventState.ts:96`; walk/idle은 fixedGraphic만 구분 `src/player/playSceneAutonomousSprites.ts:10-35`; action 회전만 fixedDirection 계열 구분 `src/player/playSceneMovement.ts:344-358` | **BROKEN** | normal은 걷기/idle, fixedGraphic은 frame 고정이 반영된다. 그러나 `step`/`fixedDirectionStep`의 정지 애니메이션과 `fourFrame` 전용 frame 선택은 없다. `fixedDirection`도 action 회전만 막고 자율 이동 facing은 페이지 유형이 아니라 mover.directionFix만 본다(`src/player/playSceneAutonomousCommands.ts:188-190`). |

## 2. 트리거 kind별 실제 실행 위치

| kind | 런타임 실행 위치 | 판정/설명 |
|---|---|---|
| `action` | `handleAction`이 정면 `action` 이벤트를 찾아 `scene.runEvent` 호출 `src/player/playSceneMovement.ts:272-286`; 발밑 fallback `src/player/playSceneMovement.ts:290-299` | **PASS** |
| `playerTouch` | 이동 완료 후 현재 칸 검색/실행 `src/player/playSceneMovement.ts:378-381`; same-priority 충돌 시 분기 `src/player/playSceneMovement.ts:400-406` | **PASS** |
| `eventTouch` | 자율 event가 player 목적지와 충돌하면 `fireEventTouch` `src/player/playSceneAutonomous.ts:61-67`; kind 비교와 실행 `src/player/playSceneAutonomous.ts:167-169` | **BROKEN(부분 실행)**: runtime 분기는 존재하지만 플레이어→event 충돌 경로 및 fixed event 경로가 없다. |
| `auto` | `activeRuntimeEvents(scene,"auto")` 순회 후 `scene.runEvent` `src/player/playSceneMapRuntime.ts:449-457` | **PASS** |
| `parallel` | update loop에서 scheduler 호출 `src/player/playSceneMovement.ts:75-78`; `activeRuntimeEvents("parallel")`의 interpreter 실행 `src/player/playSceneSchedulers.ts:59-85` | **PASS** |

**결론:** 저작되지만 런타임 kind 분기 자체가 전혀 없는 트리거는 없다. 따라서 트리거 중 **ORPHAN은 0개**다. `eventTouch`는 분기가 있으나 접촉 방향/이동 유형에 따라 누락되므로 **BROKEN**이다.

## 3. 우선순위가 depth와 통행에 반영되는가

### 스프라이트 depth: PASS

- 세 우선순위는 각각 100,000 / 200,000 / 300,000 base를 갖는다(`src/player/characterDepth.ts:5-9`).
- 실제 이벤트 생성 시 `view.priority`로 `placeCharacterSprite`를 호출한다(`src/player/playSceneMapRuntime.ts:346-350`).
- 이동 중에도 현재 priority로 depth를 갱신한다(`src/player/playSceneAutonomous.ts:70-76`, `src/player/playSceneAutonomous.ts:186-200`).
- 따라서 `below < same < above`, same 내부는 world Y로 정렬된다(`src/player/characterDepth.ts:36-38`).

### 통행 판정: PASS

- 플레이어 차단은 `priority === "same" && overlapForbidden`만 대상으로 한다(`src/project/runtimeEventState.ts:229-236`).
- NPC 상호 충돌도 같은 조건이다(`src/player/playSceneAutonomousMapActions.ts:70-81`).
- 따라서 below/above는 통과 가능, same은 기본 `overlapForbidden=true`일 때 차단된다(`src/project/runtimeEventState.ts:92-95`).

프로브는 세 depth 순서와 same-only 통행 차단을 직접 확인했다.

## 4. 애니메이션 유형이 걷기/정지 frame에 반영되는가

**일부만 반영되므로 BROKEN이다.**

| 값 | 걷기 frame | 정지 frame/방향 | 근거 |
|---|---|---|---|
| `normal` | 0→1→2→1 walk pattern | pattern 1 idle, action 시 player 방향 회전 | `src/player/charsetMotion.ts:11-27`, `src/player/charsetMotion.ts:30-39`, `src/player/playSceneMovement.ts:344-351` |
| `step` | normal과 동일 | 정지 중 cycle 없음; 항상 pattern 1 | animation helper가 fixedGraphic 외 값을 구분하지 않음 `src/player/playSceneAutonomousSprites.ts:10-35` |
| `fixedDirection` | 페이지 유형 자체는 facing 고정에 미연결 | action 회전만 방지 | action 분기 `src/player/playSceneMovement.ts:344-358`; 자율 방향은 mover.directionFix만 확인 `src/player/playSceneAutonomousCommands.ts:188-190` |
| `fixedDirectionStep` | normal과 동일 | action 회전 방지 외 정지 cycle 없음 | 위 두 경로와 동일 |
| `fixedGraphic` | frame 갱신 안 함 | frame 갱신 안 함 | 명시적 early return `src/player/playSceneAutonomousSprites.ts:18-20`, `src/player/playSceneAutonomousSprites.ts:31-34` |
| `fourFrame` | normal의 3개 고유 frame(0,1,2) 반복과 동일 | normal idle과 동일 | walk pattern 상수는 `[0,1,2,1]`뿐 `src/player/charsetMotion.ts:11-27`; fourFrame 전용 분기 없음 |

프로브에서 `step`, `fourFrame`, `fixedDirection`, `fixedDirectionStep`의 walk 결과가 `normal`과 같고, `step` idle은 pattern 1에 고정되며, `fixedGraphic`만 frame 변경이 없음을 확인했다.

## 5. 제안 최소 수정

각 항목은 실제 수정하지 않은 제안이다.

1. **플레이어가 `eventTouch`에 부딪힐 때 실행 누락** — `src/player/playSceneMovement.ts`
   - `firePlayerTouchEvent`에서 일반 `eventTouch`도 `scene.runEvent(eventId)` 대상으로 포함한다.
   - field-spawn 특례는 유지하되 중복 실행되지 않도록 하나의 kind 조건으로 합친다.

2. **`step` / `fixedDirectionStep` 정지 애니메이션 누락** — `src/player/playSceneAutonomousSprites.ts`
   - idle helper에 elapsed/scene animation clock을 전달한다.
   - step 계열이면 정지 중에도 `charsetWalkFrameIndex`로 0→1→2→1을 순환한다.

3. **`fixedDirection` 계열이 자율 이동 방향을 고정하지 않음** — `src/player/playScenePageMoveRoutes.ts`
   - mover 생성/재설정 시 `view.animationType`이 fixedDirection 계열이면 `mover.directionFix=true`로 설정한다.
   - 이동 루트 명령의 명시적 `setDirectionFix` override 규칙을 한 곳에서 정한다.

4. **`fourFrame`이 normal과 동일** — `src/player/charsetMotion.ts`, `src/assets/easyrpgRtp.ts`
   - 실제 4-frame asset layout을 먼저 정의하고 fourFrame 전용 frame index 함수를 추가한다.
   - 현재 charset은 한 방향당 3열이므로 데이터/asset 계약 없이 단순 분기만 추가하면 안 된다.

5. **페이지 반투명도 저작 불가** — `src/project/types/events.ts`, `src/editor/panels/eventEditor/pageProps.ts`, `src/player/playSceneMapRuntime.ts`
   - `EventPageGraphic.opacity?: number`와 0..255 컨트롤을 추가한다.
   - sprite 생성 직후 alpha를 `opacity/255`로 적용하고 transparent=true는 alpha 0 우선으로 둔다.

6. **“모습과 대화”에 얼굴그림이 없음** — `src/project/types/events.ts`, `src/editor/panels/eventEditor/pageProps.ts`, `src/player/playSceneInterpreter.ts`
   - 페이지 기본 얼굴 필드가 제품 요구라면 `defaultFace`를 추가하고 `facesetPreview` picker를 그룹에 배치한다.
   - text 명령에 face가 없을 때만 page default를 대화 UI에 전달한다(명령별 face가 우선).

## 6. 프로브 실행 결과

파일: `test/_probe-look.test.ts`

```text
RUN  v3.2.4 /home/main/z-project/rpg-zzu-event-page-props

✓ test/_probe-look.test.ts (6 tests) 41ms

Test Files  1 passed (1)
Tests       6 passed (6)
Duration    38.57s
```

실행 명령:

```bash
cd /home/main/z-project/rpg-zzu-event-page-props && node scripts/run-vitest.mjs run test/_probe-look.test.ts --configLoader bundle
```
