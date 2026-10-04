# Editor Event Commands & Tools

## 장면 · 그림 갤러리 표시 · 줄 음성 (2026-09-25)

빈 이벤트 템플릿 「장면」(`event-template-scene`, `src/editor/panels/eventEditor/sceneTemplate.ts`)은
화면 숨기기 → 그림 표시(`recordInGallery`) → 화면 보이기 → 문장 → 다시 숨긴 뒤 그림을 지우고
스위치 `sw_scene_seen`(이름 「장면을 봄」, 없을 때만 추가)를 켠다.

그림 표시 폼의 「남기기」는 `showPicture.recordInGallery`. 문장 폼의 「이 줄의 음성」은
`text.voiceResourceId`. 메뉴에 모이는 조건과 이름 변경은 자료집 → 시스템 → 시작 설정의 갤러리 칸.
런타임 계약은 `openwiki/runtime-sessions.md` 의 갤러리 절.

## 게임 오버 선택 (2026-09-23)

`gameOver`와 `killPlayer` 폼은 `gameOverCommandBody.ts`에서 이름별 항목을 고른다.
ID 생략은 프로젝트 기본값이며, 목록/스키마 요약도 선택한 이름을 표시한다.
항목 저작은 데이터베이스의 게임 오버 탭에서 하고, 여러 결말의 판정은 기존 조건 분기를 사용한다.
`killPlayer.message` 편집은 선택한 ID를 보존한다. 없는 항목은 저장 참조 검증 및 이벤트 초안 검사에서 드러난다.


> **Encoding note:** Some Korean descriptive text has EUC-KR→UTF-8 mojibake from the original source commit. English terms, file paths, and code references are intact. For accurate Korean, consult the referenced source files. Partial automated restoration applied; remaining garbled CJK is irreversibly corrupted.

Event command edit dialogs, cutscene/horror/puzzle authoring tools, place_npc/make_villager, AI event tools, and 2026-07-15 hostile-review command fixes.

## Move-route target repair (PR716, 2026-09-09)

- `project/eventTargetCatalog.ts` is shared by the manual picker and assistant validation.
  Resolution order is canonical sentinels, exact current-map ID, exact foreign-map ID,
  aliases, then local display names. A foreign ID such as `self` or `player` must be
  rejected as `foreignMap`, not rewritten to the executing event or player. Exact
  current-map IDs still win; opening a legacy command never rewrites its stored target.
- `moveRouteTargetPicker.ts` keeps input focus on option `mousedown` so native
  change/blur cannot remove the option before `click`. Click alone commits selection;
  cancelled/outside presses do not. Blur and direct-ID change close synchronously.
- The open list registers with `modalStack`, whose capture-phase Escape handling runs
  before input keydown. Escape closes only the list and retains input focus; closing
  by selection, Tab, blur or outside pointer unregisters it so the next Escape belongs
  to the parent command dialog. Do not restore a delayed blur-close timer.
- Regression seams: `moveRouteEventTarget.test.ts`, `moveRouteEventTargetPicker.test.ts`.
  Local-only Chromium acceptance: `PR716_QA_URL=http://127.0.0.1:<owned-port> node scripts/qa/pr716-repair.mjs`.
  Use a fresh owned dev server with a unique `VITE_CACHE_DIR`. The driver blocks remote
  requests and all writes, uses `freshProject=1`, and checks disabled persistence.
  It exercises the production command dialog and toolbar, not production game content.
## 좌표로 이동 — 고정/변수 좌표와 실패 정책 (OPRN-OUT-013, 2026-09-10)

`m2-205-pathfind-move`(카탈로그 라벨 「경로 탐색 이동」, 폼 제목 「좌표로 이동」)의 저작 표면.
전용 폼은 `eventEditor/commandBodyM2Coordinate.ts` 이고 `commandBodyM2.ts` 가 Page3 폼 다음,
제네릭 폼 앞에서 라우팅한다.

- **저장 형태(정본)와 기본값**은 `project/eventCommands/coordinateDestination.ts` 하나가 갖는다.
  `xSource`/`ySource` = `fixed`(기본) | `variable`, 고정값은 기존 `x`/`y` 그대로, 변수는
  `xVariableId`/`yVariableId`, `onFailure` = `continue`(기본) | `stop`, `fallback` =
  `none`(기본) | `nearest`, 선택적 `resultVariableId`/`resultSwitchId`.
  **없는 키는 전부 기본값으로 읽힌다 — 그것이 곧 마이그레이션이다.** 옛 고정 좌표 명령은
  저장본을 다시 쓰지 않고 예전과 같은 런타임 단계를 낸다(계약 테스트가 `toEqual` 로 잰다).
  소스 키가 없어도 변수 id 만 저장돼 있으면 변수 의도로 읽어 부분 저장본을 구제한다.
- **재사용할 것**(어기면 두 번째 엔진이 생긴다): 대상은
  `createMoveRouteTargetPicker` + `project/eventTargetCatalog`(OPRN-OUT-012 계약, 정본 값은
  `@player` / `this-event` / 이 맵 이벤트 id), 좌표 변수·결과 변수·도착 스위치는 표준
  레코드 픽커 `databasePicker("variable"|"switch", …)`, 경로는 런타임 `playScenePathfinding`.
  폼은 좌표를 **계산하지 않는다**.
- **폼을 여는 것만으로 저장값이 바뀌지 않는다.** 옛 프로젝트를 여는 것이 편집이 되면
  사용자가 알아채기 전에 의도가 사라진다(이동 대상 픽커와 같은 규칙).
- **미리보기**(`coordinate-move-preview`)는 목적지·속도·대기·실패 정책과 결과 코드 표를
  글자로 말한다. 변수를 골랐는데 정하지 않았거나 고정값이 정수·양수가 아니면
  `coordinate-move-preview-warning` 이 「주의:」 접두어 + `--danger` 로 뜬다 — 색만으로
  상태를 구분하지 않는다.
- **저작 시점 진단**(`eventDraftValidator`): 두 축이 **모두 고정**일 때만 지도 범위를 단정한다
  (`map.position.out-of-bounds`). 한 축이라도 변수면 목적지가 런타임에만 정해지므로 단정하지
  않는다. 고정값의 소수·음수는 런타임과 **같은 해석기**로 `m2.coordinate.fixed.invalid`,
  「변수」인데 미선택은 `m2.coordinate.variable.unselected`, 없는 변수는 기존
  `reference.variable.missing`. 결과 기록처는 비워 두는 것이 정상이고 값이 있을 때만 실재를 따진다.
  `xVariableId`/`yVariableId` 참조 규칙은 **소스 키를 선언한 명령에만** 축 조건을 적용한다 —
  「변수 위치로 이동」(소스 키 없음)은 예전대로 항상 필수 참조다.
- **요약**은 전용 경로다. 제네릭 폴백은 필드 앞 세 개만 내보내므로 새 소스 키가 정작
  목적지를 가렸다. 지금은 `대상 → (X, Y) · 대기 · 실패시 중단` 을 말한다.
- **CSS 함정 두 개(실측, 2026-09-10 브라우저 QA):**
  (1) `.actor-m2-field { display: grid }` 는 `[hidden]` 의 UA `display:none` 을 이긴다.
  `.actor-m2-field[hidden] { display: none }` 이 없으면 배타 필드(숫자/변수)가 둘 다 보여
  **눌러도 아무 일 없는 죽은 입력**이 남는다. Page3 `valueSourceControls` 도 같은 계약이다.
  (2) 이동 대상 픽커 CSS 는 전부 `.move-route-editor` 스코프다. 다른 폼에서 재사용하려면
  규칙을 복제하지 말고 선택자에 스코프를 **하나 더 붙인다**(`event-editor.part-1.css`).
- 회귀: `test/coordinateMoveCommandBody.test.ts`(폼 22건 — 대상 3종·축별 소스·정책·진단),
  M2 표면 기준선은 `m2-205` 만 갱신했다. 브라우저 증거:
  `node scripts/capture-coordinate-move-form.mjs` → `verify-shots/oprn-013/`
  (스크린샷 + 숨긴 칸의 **계산된** display + 「확인」으로 커밋된 실제 필드).

## 장소 이동의 목적지 원복과 설정 보존 (2026-09-06)

- `transferPlayerDialog.ts`는 창을 열 때의 값이 아니라 마지막으로 반영한 명령과 현재 선택을 비교한다. A → B → A로 고르면 초안도 다시 A가 된다.
- 실시간 반영과 독립 창의 확인 모두 기존 명령에 수정 필드만 덧씌운다. `transition`과 다른 미수정 필드는 유지한다. 전환값은 `fade`·`mosaic`·`blinds`이며 별도의 이동 시간 필드는 없다.
- 이벤트 명령 창의 확인이 초안을 확정하고 맵 이벤트 적용이 실제 프로젝트에 반영한다. 취소는 실시간 선택 변경을 버린다. `U03.test.ts`와 `transferCommandBody.test.ts`, 실제 편집기 재열기·파일 가져오기 및 출하 플레이어 이동 근거는 `.omo/evidence/event-command-remediation/U03/`에 있다.

## 확률로 결과 뽑기 / 가중 분기 (2026-09-06)

- Integration onto `647b000e`: the staged-state regression uses the shipped percent control (75/25 replaces equivalent raw weights 3/1) and still requires the preceding name edit and unrelated staged field to survive. The CSS live-class manifest refresh is restricted to `weighted-branch-*`: 12 retired guide/legend/raw-weight classes are replaced by 10 worksheet classes, with 18 current weighted classes protected. All unrelated manifest entries and gate logic remain unchanged; this accepts the requested worksheet snapshot, not later CSS inventory phases.

- Intentional surface snapshot update: only `m2-211-weighted-branch` is recaptured in the M2 baseline and floor. Test IDs 25→20, labels 6→5 and text entries 2→1 reflect removal of the requested prose guide, duplicate legend/summary and raw-weight presentation, not executable functionality. Control count stays protected at 9 and variable select options at 21; the new percent inputs, row meters and numeric output mapping are captured (classes 29→31). The 19 `weightedBranchUx` behavior tests protect editing, validation, persistence and result-index contracts independently of these surface counts. Unrelated M2 entries are not regenerated or accepted.

- `commandBodyWeightedBranch.ts` is the dedicated worksheet routed by `commandBodyM2.ts`. Command ID `m2-211-weighted-branch`, `table`, and `resultVariableId` are unchanged. The catalog retains `가중 분기`; the form title is `확률로 결과 뽑기`.
- Outcome rows come first: name, labelled editable percent, a monochrome proportional meter, and an arrow to the numeric `저장값`. The destination variable picker follows the rows; its empty trigger explicitly asks for a variable. No paragraph guide, rainbow legend, duplicated summary or action-branch creation. Runtime only writes the zero-based index of the selected positive-weight row, not its name and not an executable branch.
- Editing a percentage reserves that chance for the edited row and distributes the remainder proportionally across the others. If other rows are all zero, divide the remainder equally. A lone row is fixed at 100%; add gives the new row an equal share while retaining old relative odds; deletion redisplays normalized chances. Named zero rows remain in the persisted table and reopen in place, but have no stored result value. Runtime/summary parsing still filters strictly positive rows, preserving zero-based result indexing. Removing the last positive row is disabled rather than silently enabling zero rows. Authored all-zero tables remain zero and block Confirm with an inline error; a lone zero row can be repaired by setting 100%.
- The original table string is retained on open and variable-only edits, including whitespace, malformed/zero rows, blank names and extra separators. `weightedBranchTable.ts` mirrors runtime numeric parsing (`line.split("=")[1]`) so visible positive-row order agrees with runtime. Name/table edits serialize finite nonnegative weights without truncating numeric precision; names replace `=` with `＝` and CR/LF with spaces to prevent accidental row or numeric-field injection. This is editor-side encoding, not a runtime parser change.
- Percentages are unrounded internally; controls/summary use two decimal places or three significant digits for values below 0.01%, so tiny positive odds are not presented as zero. Near-100% counterparts retain enough decimals to represent the small remainder instead of false certainty; only differences within `Number.EPSILON * 100` may display 100%. Invalid/incomplete/out-of-range percent input displays a local error and leaves the last committed table unchanged. `commandEditDialog.ts` calls the scoped `validateWeightedBranchForm` before Confirm: invalid visible inputs retain the dialog and receive focus. There is no native form-submit validation in this button-based dialog; other command bodies are unaffected. Input nodes stay mounted; IME names commit at composition end. Add focuses the new name; removal focuses the nearest remaining name. All mutations use the existing `replaceFields` staged draft path; unrelated fields remain intact.
- Styles remain in `src/styles/editor/event-editor.part-2.css`, using cream-form tokens and shared `editorIcons`. Regression suites: `npm test -- test/weightedBranchUx.test.ts test/commandEditModalPreview.test.ts` (parser/storage, initial meters, percent redistribution, positive-only mapping, actual modal Confirm/reopen with zero rows, blocked invalid/all-zero Confirm, variable-only preservation, precision, IME and structural focus). Browser validation and broad gates are lead-owned; fake DOM is not a visual approval.

## 상점: 진열 상품과 상품 상세 중심 편집 (2026-09-05)

- 2026-09-06 저장 계약: `shapeCommandFields.ts`는 피커와 런타임의 정본인 `SHOP_MESSAGE_TYPES`를 그대로 검증한다. `festival`·`closingSale`·`vip`도 다른 세 유형처럼 프로젝트 재로드를 통과하며, 목록 밖 값은 계속 거부한다. `eventCommandRemediationShopMessages.test.ts`가 여섯 유형의 전체 프로젝트 serialize/deserialize와 인접 상점 설정 보존을 검증한다.
- 소유자: `commandBodyShop.ts`(탭·거래 규칙·대사·분기), `shopEditorGoods.ts`(진열 목록·상품 추가·가격/계절), `shopEditorModel.ts`(아이템/장비 자료집과 순서 보존), `commandBodyShopEconomy.ts`(경제 설정). `commandBodyCommerce.ts`는 여관 본문과 상점 재수출만 남긴다. 스타일은 `event-editor.shop.css`.
- 상점 창은 기존 full 모달을 유지한다. 첫 화면은 **진열 상품 목록 + 선택한 상품의 상세**다. 전체 자료집은 `shop-add-goods` → `shop-catalog-dialog`에서 검색/종류 필터/복수 선택 → `shop-catalog-add`로 한 번에 추가한다. 선택 중에는 명령을 바꾸지 않으며 취소/Escape는 선택을 폐기한다. `shop-item-check-{id}`는 이 추가창에만 존재한다. 진열 행은 선택 버튼이며 삭제는 상세의 `shop-remove-goods`다. 예전 `shop-stock-pool`과 모든 설정을 함께 담던 `shop-options-rail`은 없다.
- 탭은 상품/거래 규칙/상인 대사/거래 후 행동이다. 활성 탭만 마운트하며 방향키/Home/End로 탭을 이동한다. view 상태는 `CommandListActions`에 대한 WeakMap으로 보관해 분기 명령 추가에 따른 호스트 재렌더에서도 탭·선택 상품을 보존한다. 일반 상품/필드 편집은 `shouldRerenderCommandForm`에서 shop을 재렌더하지 않는다. 상품 본문이 목록/상세만 갱신하고 최신 `getCurrentCommand`를 바탕으로 변경한다.
- 가격은 기본 가격 사용/직접 지정을 구분한다. 기본으로 돌리면 `priceOverride`만 제거하고 `priceBySeason`·판매 계절·다른 상품의 재고 설정을 보존한다. 사계절 선택은 계절 제한 없음이며 시간 시스템이 꺼졌으면 계절 조건이 적용되지 않는다는 안내를 표시한다. 정렬/제거는 `itemIds` 순서에 맞춰 남은 stock을 유지한다. 추가창의 빠른 선택은 기존 상품을 교체하지 않고 추가할 상품만 고르며 거래 방식을 변경하지 않는다.
- 거래 규칙의 구매 전용에서는 매입 예산을 숨기되 값을 지우지 않는다. 기존 기본값(매입 예산 100G, 한 번에 1개)을 변경하지 않는다. 흥정 세부 입력은 사용 중일 때만 마운트한다. 할인/과도한 제안 기준은 %로 보여 주고 저장 시 기존 0..1 비율로 환산한다. 흥정을 꺼도 세부 설정은 보존하며 숫자 편집이 흥정을 자동 활성화하지 않는다.
- 대사 탭은 `shopMessages.ts`의 6가지 메시지 유형과 실제 인사/목록/구매 문구를 사용한다. 거래 후 행동 탭은 기존 성공/거래 없음 분기와 명령 추가 경로를 유지한다. 상점 설정 적용 전까지 모달 초안이며 이벤트의 기존 적용/감사 로그 경로를 따른다.
- 미리보기는 기존 footer 토글로 **상품 상세 자리를 교체**한다. 세 번째 열을 추가하지 않는다. `commandPreview.shopStage`는 아이템과 장비 이름, 지정 가격, 실제 인사 문구를 읽는다. 이는 진열 구성과 기본 판매 가격 미리보기이며 계절/세션 할인까지 계산하는 게임 실행은 아니다.
- 검증: `shopCommandBodyUx`, `shopCommandFullscreenUi`, `commandEditModalPreview`, `eventEditorStagedState` 단위 테스트. 브라우저 `test/e2e/shop-command-fullscreen.spec.ts`는 실제 피커 경로, 추가창의 마지막 상품 도달, 추가 취소, 연속 수정/재열기, 거래 없음 분기, 키보드/Escape, 1440×900·1280×800·1024×768의 행/버튼 기하를 확인한다. 공용 `subdialog.focusableControls`는 숨긴 컨트롤을 Tab 순환에 포함하지 않는다.

## Roguelike run control (2026-08-24)

- Native command `runControl` is map/common runtime-full and troop runtime-partial (troop execution logs unsupported). Actions are `start { seed?, runId?, startFloor? }`, `advance { amount? }`, `end { result }`, `setFlag { flag, value }`, and `resetRoom { roomId? }`.
- Native condition `run` can query `active`, compare `floor`, query a named boolean `flag`, or match a terminal `result` (`completed`, `failed`, `abandoned`). It is valid in forks and event-page conditions.
- Event Command AI Assist derives the command's default from `newCommand` and explicitly lists every run action/query field shape, so natural-language event generation is not limited to the default `start` variant.
- `src/project/roguelikeRun.ts` is the state-transition authority; the interpreter must call it rather than mutating the session shape inline. Through Phase 3 the field runtime consumes `resetRoom` and other run-generation changes, rebuilding deterministic room field encounters and resetting eligible one-shot authored events instead of leaving the counter as an unused signal.
- AI map tool `configure_roguelike_room` configures or clears deterministic weighted encounter slots after the referenced field spawns exist. `resetEventState` defaults to true for generation-scoped self switches/`Erase Event`; false preserves story-event state. Slots may be omitted for an event-reset-only room. Coverage is pinned by `test/roguelikeRun.test.ts`, `test/roguelikeRooms.test.ts`, and `test/commandContracts/runControl.contract.test.ts`, including inactive-run no-ops, actual field/event respawn, save/load generation stability, deterministic rerolls, opt-out, import validation, and serialize/deserialize equality.

- **Command edit dialogs (shop / text / commerce / inputNumber / setEventGraphicPattern):** 상점은 위 2026-09-05 절을 따른다. `commandBodyCore.ts` `textBody` owns 문장 ?쒖떆 inline editor + control-char palette; `commandPreview.messageWindowMock` must render resolved examples on the right: variable/actor/color substitutions appear in the message body, non-printing controls appear as high-contrast Korean effect badges (label + glyph, e.g. ???낅젰 ?湲?!), and raw escape syntax must never leak into the mock. When speaker is set, the preview/runtime nameplate floats on the window rim (.ecp-message-speaker-nameplate / .speaker-nameplate) instead of sitting as body text. `displayTextSettingsBody` groups ?뺤떇/?꾩튂/?듭뀡 fieldsets with hints; format/position use `segmentedSelect` (visible segment buttons + hidden native select for Playwright `selectOption` / testids `event-command-message-format` / `event-command-message-position` / segment-`key`). Picker-path text entry uses the same shared `commandEditDialog` body — the standalone `textCommandDialog.ts` / `messageCommandDialogs.ts` / `messageDialogControls.ts` / `choicesDialog.ts` subdialogs had no production call site and are deleted (there is no `event-command-text-dialog` / `-faceset-dialog` / `-display-options-dialog` in the DOM). The format/position native select is `hidden`, so Playwright `selectOption` fails its actionability check — drive the segment buttons. **changeFace form** (`commandBodyCore.changeFaceBody`): selected-face card on top + **standalone face picker** (one 48×48 face file per entry; the 4x4 index grid and `facesetPreview.renderFacesetIndexGrid` are deleted) + position/flip options; **그래???좏깮??* opens `openDatabaseResourcePickerDialog({ kind:"faceset" })`; selected face drawn whole by `renderFacesetPreview` (`faceImage` for chip mode, no crop math).  Bust mode: resource ids with  or  (preset ) draw a large portrait above the dialogue window; form button **bust preset**.  Bust mode: resource ids with `-bust` or `generated-face-*` (preset `generated-face-actor1-bust`) draw a large portrait above the dialogue window; form button ?됱긽 ?꾨━?? **Right play mock** (`faceStage` / text `messageWindowMock`) uses crop-only `renderFacesetCrop` (~96px) in taller `.ecp-message-window.with-face` ??never put editor resource-id chrome inside the window; position goes in `.ecp-face-caption`. Exclude `.event-command-face-editor` from the part-3 auto-fit grid. Styles: `event-editor.commerce.css` + previews in `event-editor.command-preview.css`. **Message/choice/shop command previews must not call `applySystemGraphic` with EasyRPG System.png border-image fill** ??the 160횞80 system sheet palette strip (0123456789) pollutes the mock. **?レ옄 ?낅젰** (commandBodyInputNumber.ts + commandPreview.inputNumberStage): 蹂??/ ?먮┸??移?1?? only, no free number input) / 李??쒕ぉ / ?곗튂 ?ㅽ뙣???좉?. Exclude `.input-number-command-body` from part-3 auto-fit grid so fields stay a vertical label+control stack. **蹂??조작** (`commandBodyVariable.ts`): labeled fields (???蹂???곗궛/媛??뚯뒪/媛?, op+source segmented controls, live formula strip, `event-command-variable-form` stack; preview `variableStage` formula card. Runtime: integer ops, `/=` floors, divide-by-zero keeps current. **?꾨뱶 몬�뒪???쒗뵆由?* (event toolbar  /  ??): one-click fight page + cleared transparent page using battleProcessing then fork(battleResult=victory) then setSwitch + Erase Event (). Shared builder:  (also used by ). **조건 분기** (forkBody + conditionForm): RM2003 rhythm ??dialog is condition + else checkbox only; then/else bodies edit in main list markers ( /  / ). Condition vocabulary includes leaf kinds plus composite all/any/not. Live TRUE/FALSE preview via conditionEvalPreview. AI/text compile helper: conditionCompile.compileConditionFromText. Exclude  /  from auto-fit grid. Message windows use CSS 9-slice `.ecp-message-window` (`/assets/ui/windowskin-default.png`); shop uses `.ecp-shop-window-clean` solid mock with item name/price rows + merchant gold. `displayTextSettings` preview shows sample dialogue, position stage, player pawn, and option badges. **?대깽???꾨젅??蹂寃?(`setEventGraphicPattern`) ??RM2003 Change Appearance shell:** reuses page graphic picker chrome (`event-graphic-rm-picker` / `event-graphic-picker-frame`): left charset file list (`renderGraphicResourceList`) + right **4횞2 character chips**, **Direction** radios (????????, **Pattern** radios (?쇱そ/媛?대뜲/?ㅻⅨ履?, frame probe + walk preview (`npcGraphicPickerControls`). Target event select above. Object1 door preset chips ?꾨옒?믪삤瑜몄そ?믪쐞 (pattern col 0). Stored absolute frame via `charsetFrameIndex`. Runtime overrides `eventGraphicPatternOverrides` survive wait refresh; house doors `animationType:"fixedGraphic"`. Exclude `.event-command-frame-editor` from the part-3 auto-fit grid. **Do not** let the generic auto-fit grid style `.commerce-command-body` / `.shop-processing-command-body` / `.event-command-text-editor` / `.event-command-face-editor` / `.event-command-frame-editor` / **`.move-route-editor`** / **`.event-command-choices-inline`** / **`.input-number-command-body`**. **?좏깮吏 ?쒖떆 (`choices`, RM2003-style):** `commandBodyChoices.ts` dialog is **option texts + cancel only** (no inline branch command editors). Branch bodies are edited in the main event command list under `: ?좏깮吏 ?? / `: 취�냼???? markers (`commandList.ts`). Rows: `index | input | ??젣`. CSS: `event-editor.part-2/3.css` + `command-preview.css` (dialog ~920px; cancel stacks under options below 920px). Tests: `test/choicesCommandBody.test.ts`. **?μ냼 ?대룞 (`transfer`):** map/tile picker is **inline** in the command edit modal (no nested `?μ냼 ?대룞...` button). Seeds empty mapId from current/start map; live-applies map/coords/direction/fade. Tests: `test/transferCommandBody.test.ts`. **?湲?(`wait`):** RM-style form ???쒓컙(珥?+?꾨━???먮뒗 蹂??媛?ms). Optional `variableId` on wait command; runtime resolves session variable to ms. Default editor layer/tool is **event** for QA. **주석 (Comment m2-088):** dedicated form with color (green/yellow/cyan/pink/gray/white), list tint + italic, summary . Insert via command picker or **Ctrl+/** / context menu . Editor-only (no runtime effect). Tests: . **?ш? 泥섎━ ():** richer form ??price presets (free/10/20/50/100), stay dialog mock (???꾨땲??, recovery note; right preview is inn stay window. Summary:  / . Tests: . Tests: `test/waitCommandBody.test.ts`, `test/editorDefaultLayer.test.ts`, `test/commandContracts/wait.contract.test.ts`. **?대룞 경로 ?ㅼ젙 (`moveEvent`):** `commandBodyRoute.ts` ??toolbar + labeled parameters + 2-col main. Dialog widens (`:has(.move-route-editor)` ~1120px) and hides generic right preview. Page-level custom routes still use `moveRouteDialog.ts`. `commandEditDialog.shouldRerenderCommandForm` rebuilds choices cancel structure; shop owns its list and conditional updates without rebuilding the whole form. Tests: `test/commandEditModalPreview.test.ts`, `test/houseKit.test.ts`. 상점의 최신 추가/가격/계절 편집 계약은 위 2026-09-05 절을 따른다.

**알려진 함정 — `<details>` 안에서 flex/grid 스크롤러를 만들지 마라.** Chromium 131+ 는 `<summary>` 외의 자식을 UA `::details-content`(`display:block`, 콘텐츠 높이) 로 감싼다. 그래서 자식에 준 `flex:1 1 auto; min-height:0; overflow:auto` 가 레이아웃에 참여하지 못하고, 스크롤바가 그려져도 `scrollTop` 이 0 에 못 박힌다. 예전 상점 자료집(`shop-item-catalog-fold`)이 정확히 이 함정이었다: DB 179행 중 1600×1000 에서 4행 / 1440×900 3행 / 1280×720 **0행**만 닿고 휠 12회에도 모든 조상의 `scrollTop` 이 0. `::details-content` 를 스타일링해 우회하지 말 것(Chromium 전용) — 접기가 필요하면 `button[aria-expanded]` + `div[hidden]` 로 만든다. 함께 고친 격자 아사(starvation): `grid-template-rows` 의 `1fr` 행만 줄어들어 판매 목록이 54px(분기 켜면 0px)까지 눌렸으므로 `minmax(160px, 1fr)` + 상세 스트립 `clamp()` 상한으로 바닥을 깔았다. 현재 회귀 게이트 `test/e2e/shop-command-fullscreen.spec.ts`는 분리된 상품 추가창의 휠/마지막 행 도달과 본문 1024×768 행/버튼 기하를 검증한다. 위 사례는 과거 단일 자료집의 실패 기록이다. **Shared pickers (1·3페이지 공통):** `src/editor/panels/eventEditor/sharedPickers.ts` owns `mapPicker` / `mapSelectElement` / `actorPicker` / `itemPicker` / `eventPicker` (카드+testid select). Do not reintroduce local picker implementations in command bodies.
- **Text preview control placement:** `commandPreview.renderPreviewDialogueBody` inserts each effect badge inline at the exact zero-width control position carried by `DialogueTextSegment.controlsBefore`; never collect controls into a detached badge row below the dialogue. `\_` keeps its rendered half-space and an inline `반각 공백` badge at that authored position.
- **Text authoring surface (2026-08-24):** `commandBodyCore.textBody` owns the same integrated live message-window preview in both the inline inspector and the edit modal. The default surface keeps the speaker field visible and offers selection-aware semantic tools for newline, hero name, variable value, emphasis, and pause. Raw control-character insertion remains available under a closed `details` disclosure (`event-command-text-control-details`) for advanced authors. `CommandEditContext.previewFace` carries the active face into that preview; the text modal hides its now-redundant generic right preview at wide widths.
- **`emotion` 은 「말투·연출」이고 상시 노출이다 (2026-08-30):** `text` 커맨드의 `emotion` 필드는 스키마·저작 UI·전달 경로가 전부 예전부터 있었지만 `dialogue.showText()` 경계에서 조용히 버려지고 있었다(요청 타입에 필드가 없었다). 이제 이 값이 **연출 프로파일 선택자**다 — 창 등장 곡선, 이름표·초상화 진입, 글자 타이핑 배율, 스크림·흔들림·플래시를 한 번에 고른다(매핑은 `src/player/dialoguePresentation.ts`, 계약은 `openwiki/runtime-pre-edit-routing.md`). 값 5종(`neutral`/`happy`/`sad`/`angry`/`surprised`)과 저장 형식은 그대로다: `readDraft()` 는 `neutral` 일 때 필드를 아예 남기지 않으므로 기존 프로젝트·세이브 호환성 작업이 없다. 저작 UI 는 접힌 `event-command-text-advanced` **밖으로 승격**됐다(`event-command-text-presentation`, 라벨 「말투·연출」, 힌트 "창이 뜨는 모습과 글자 속도가 함께 바뀝니다"); 그 `details` 에는 이제 자동 넘김만 남는다. 승격이 기능의 절반이다 — 접힌 자리에 있던 동안은 아무도 쓰지 않았고, 되접히면 다시 안 보이게 죽는다. **프리뷰 재생은 「연출이 바뀐 순간」에만 한다.** `renderCommandPreview(cmd, { replayPresentation })` → `messageWindowMock` → `applyPreviewPresentation` 이 `.ecp-message-window` 에 `data-dialogue-emotion` / `-motion` 과 `--dialogue-*` 변수를 심고, `replayPresentation` 일 때만 `data-dialogue-phase="enter"` 를 붙인다. 늘 붙이면 프리뷰가 본문 한 글자마다 통째로 다시 그려지므로 창이 **타자마다 튀어 글을 쓸 수 없다** — 그래서 `textBody` 가 `previewedEmotion` 을 들고 값이 실제로 바뀐 호출에만 켠다. 프리뷰 CSS 는 런타임 keyframes(`dialogue-box-enter*`)를 그대로 부르고 규칙만 `.ecp-message-window` 로 다시 적는다(`event-editor.command-preview/01-event-editor-modern-import.css`); 감정→keyframe 짝이 어긋나면 프리뷰가 "게임에서 이렇게 보인다"를 거짓말하므로 `test/dialoguePreviewPresentationCss.test.ts` 가 두 선택자 집합을 텍스트로 대조해 잠근다. Tests: `test/dialoguePresentationAuthoring.test.ts`(승격 + 재생 시점), `test/dialoguePreviewPresentationCss.test.ts`(드리프트), `test/advancedDialogueMerge.test.ts`(레거시 `m2-209` 재작성이 `emotion` 을 보존).
- **`changeFactionStance` operands are faction selects (2026-08-29):** `commandBodyCore.changeFactionStanceBody` renders 진영 A / 진영 B as labeled `<select>` controls (`event-command-faction-a` / `event-command-faction-b`) built from `resolveFactionTable(store.getCurrent().factions).ids`, so the reserved `player` / `enemy` lead the list and every option reads `이름 (id)`. The old free-text inputs fell back to `player` / `enemy` on a blank or trimmed value, and an unknown id resolves to the reserved `enemy` slot at runtime — so a typo silently shifted the player's standing with the wrong faction instead of failing visibly. A stored id that names no existing faction is **not** rewritten by rendering: it is prepended as a `disabled` option labeled `<id> · 존재하지 않는 진영` and stays selected, which keeps "reference a faction I have not created yet" and "a faction was just deleted" both inspectable. The commit handler writes `select.value` verbatim. Operator and value keep their contract (`event-command-faction-op`, `event-command-faction-value`; `=` accepts -2..2, `+=` / `-=` accept 0..4, step 0.25). Renaming a faction in the Database 진영 tab rewrites both operands through `renameFaction`, and `commandReferenceValidation` fails closed on an operand that names no faction, so the disabled-missing option marks a real authoring gap rather than rename debris. Tests: `test/eventEditorFactionPicker.test.ts`.
- Event markers are rendered by `src/editor/editSceneEventMarkers.ts`, while cross-layer marker affordances live in `src/editor/eventMarkerUx.ts` and `src/editor/EditScene.ts`: lower/upper layer double-click can offer to switch to the event layer. Hovering a map event tile shows a floating summary (name, coords, trigger, first commands) via `buildEventMarkerTooltipModel` / `renderEventMarkerTooltipElement` (`event-marker-tooltip` CSS). The card is a speech bubble anchored at the tile's top-right: `computeEventMarkerTooltipPlacement` (`src/editor/eventMarkerTooltipPlacement.ts`) is the pure placement math (flips to `top-left` / `bottom-*` near host edges, emits a `tip-anchor-<anchor>` class that draws the tail) and `EditScene.positionEventMarkerTooltip` feeds it a tile rect derived from `camera.worldView` — `camera.scrollX/Y` does NOT map to the screen's top-left under Phaser 3.60+ zoom and pushed the card into the host's bottom-right corner (실측 2026-08-27). The native canvas `title` is deliberately NOT set: the browser tooltip overlapped the card. The left map event list uses a richer hover card (`buildEventListTooltipModel` / `eventListHoverTooltip.ts`, testid `event-list-tooltip`) with per-page trigger/priority/conditions and more command lines. Open event drafts keep working bodies in the project (autosave-durable) plus draft metadata for Cancel; vault/localStorage recovery must keep the modal from ever going blank mid-edit. Full project switches use `store.replaceProject` so vaults do not leak across projects.
- **Event list click pans camera to the event (2026-07-20):** Clicking a row in the left map event list (`renderMapEventList` in `src/editor/panels/eventEditor.ts`) now selects the event **and** pans the editor camera to center on its tile. Selection (`selectEvent`) is unchanged; the camera pan rides a separate one-way pub/sub `src/editor/editorCameraFocus.ts` (`requestEditorCameraFocus({ mapId, tileX, tileY })` → `subscribeEditorCameraFocus`) so DOM-side panels can drive the Phaser camera without touching editorState. `EditScene.panCameraToTile` ignores requests whose `mapId` differs from the current map, validates tile bounds, then calls `cam.pan(...)` (300ms `Cubic.easeOut`, `force:true`). Double-click still opens the event editor modal. Test: `test/eventListCameraFocus.test.ts`. Evidence: `output/evidence/event-list-camera-focus/`.
- `src/editor/eventCommandPaths.ts` is the shared owner for nested command paths. Use it for choices cancel branches, fork then/else branches, loop bodies, shop transaction branches, and branch creation when a mutation path needs to create a missing optional branch.
- Event-page command toolbar history/clipboard behavior is split from rendering: `src/editor/panels/eventEditor/commandToolbarHistory.ts` owns page-command undo/redo plus toolbar copy/cut, and `src/editor/panels/eventEditor/commandClipboard.ts` is shared with the command context menu.
- Event page overlap, movement route skippable, and route Help controls persist through `src/editor/panels/eventEditor/pageProps.ts`, `src/editor/panels/eventEditor/pageMovement.ts`, and the `moveRouteDialog*` modules.
- Move-route command buttons live once in `MOVE_ROUTE_COMMAND_ROWS` (`moveRouteCommandCatalog.ts`) and are rendered by **both** authoring surfaces — `commandBodyRoute.ts` (the 이동 경로 설정 command editor) and `moveRouteDialog.ts` (page custom-route dialog) — so a new primitive is one catalog entry. The `⤴ 점프` / `⤓ 위에서 낙하` buttons are **context buttons** that read the "이 단계 값" panel like `setSwitch`/`changeGraphic` do, so hop authoring needs no new dialog: `hopDx`/`hopDy` (signed, no `min`, so 왼쪽·위로 뛰기 works) plus `hopHeightPx`/`hopDurationMs` on `MoveRouteCommandContext`. **`0` means "not authored"** — `hopOptions` omits the field entirely so `characterHop.ts` defaults apply (jump 12px/300ms, dropIn 128px/620ms) and old projects follow future default changes instead of carrying a copied value. `inferHopParameters(moves)` reads the values back when either surface reopens (dx/dy from the last `jump`, height/duration from the last `jump`-or-`dropIn`); in `commandBodyRoute.inferRouteParameters` it is called **outside** the backwards loop because that loop returns early on `npcTransfer`. `moveCommandLabel` appends ` 48px 1200ms` only when authored, keeping default-jump labels byte-identical for the existing e2e text assertions. `se` remains schema-only. Testids: page dialog `event-page-move-route-hop-{dx,dy,height,duration}`, command editor `move-route-hop-{dx,dy,height,duration}-input`. **「이 단계 값」 패널의 기본값은 반드시 실재하는 id 여야 한다** — `defaultRouteSoundId()` 는 `seCatalogResourceIds()[0]` 을, 스위치는 `store.getCurrent().switches[0]?.id` 를 쓴다(둘 다 `?? ""` 로 폴백하고, 빈 값이면 `createCommand` 가 `null` 을 반환해 버튼이 무동작한다). 예전 하드코딩 `"se_route_chime"` / `"sw_route_seen"` 은 어느 카탈로그에도 없는 문자열이었고, 효과음 칸을 손대지 않고 「효과음 재생」만 누르면 `playSe` 가 없는 리소스를 가리켰다. 그러면 `eventDraftValidator.validateMoveRoute` 의 `reference.resource.missing` **오류 하나가 이벤트 전체 커밋을 거부**한다(`validateForModalAction` → `canCommit === false` → `saveEventDraft` 미실행). 새 이벤트는 `draft:{kind:"new"}` 인 채로 남아 `projectWithoutEventDrafts` 가 걷어내므로 **통째로 사라진다**. 조용하지는 않지만 알려 주는 방식이 약하다: 토스트는 `적용할 수 없습니다. 오류 1개를 먼저 해결하세요.` 로 개수만 말하고, 경로 오류의 `field` 는 `event-page-custom-route` 버튼뿐이라 어느 단계가 범인인지 지목하지 않는다. 참조 실재는 저장 스키마가 보지 않으므로(`shapeCommandFields` 는 형태만) 이 오류는 편집기 게이트에서만 드러난다 — 그래서 `test/moveRouteCatalogPersistence.test.ts` 가 기본 효과음 id 를 `collectResourceIds` 집합에 대고 잠근다. Two CSS rules did change with this: `.event-page-move-route-parameters` is now an **explicit 11-track grid** (3 wide + NPC map + 2 narrow coords + direction + the four hop tracks 60/60/68/76px) because letting the hop fields wrap to a second implicit row grew the top bar ~40px and shortened the command grid below it by the same amount — that is why the hop labels are terse (`점프 dx` / `dy` / `높이px` / `시간ms`) with the explanation moved into `title`. And `.event-page-move-route-grid` was `overflow: hidden`, which clipped 44 buttons over 14 rows inside a fixed-height dialog and left the bottom half of the palette (대기 · 속도 · 효과음 재생 · NPC 맵 이동 …) permanently unclickable — a bug that predates hops; it is now `overflow: auto` + `align-content: start`. Route command labels are duplicated in **three** places that must stay in sync — `moveCommandLabel` (catalog), `pageMovement.ts` summary, and `previewMoveRoute.ts` `chipLabel`; all three switches are exhaustive without a `default`, so the compiler flags a new `MoveCommand` kind. `previewMoveRoute.step` deliberately returns `null` for `dropIn` (no tile displacement to draw on the route preview path).
- Destructive event deletion is routed through `requestEditorEventDeletion` so modal Delete-key and visible delete controls require explicit confirmation before `deleteEditorEvent` mutates project data. **?ㅽ뻾 ?댁슜(cmd-list) ?ъ빱??以?Delete/Backspace ??紐낅졊留???젣**?섍퀬 모�떖濡??꾪뙆?섏? ?딅뒗??`commandListContextMenu.handleCommandShortcut` stopPropagation + `modal.isCommandListSurface` 媛??. ?대깽????젣 ??`recordProjectSnapshot` ???좎뒪??**복구** 버튼(`toast-event-delete-restore`) / Ctrl+Z 濡??섎룎由곕떎. ?뚯뒪?? `test/eventCommandDeleteSafety.test.ts`, `test/eventEditorModal.test.ts`.
- AI event tools compile `graphic` input through `src/editor/tools/eventCompile.ts`; direct `{textureKey, characterIndex}` charset graphics must be canonicalized to bundled EasyRPG texture keys before commit-time resource validation. `graphic.query` uses `src/assets/charsetQuery.ts` so legacy aliases and free-form NPC queries such as `?좊㉧??, `old woman`, and `?몄씤 ?⑥꽦` resolve through explicit charset gender/age metadata; use `list_npc_graphics` to inspect candidates.
- One-scene cutscene authoring lives in `src/editor/cutscene/`. `compileCutscene(beats, { skippable, context })` turns declarative beats into event commands with automatic `cutsceneControl begin/end` and `cutscene_end` cleanup label. The write tool `script_cutscene` in `src/editor/tools/eventTools.ts` adds a transparent cutscene page to an existing event or creates a new event, then validates event/resource references, duplicate live picture ids, and negative durations before the normal proposal commit.
- Horror-loop authoring uses native event commands `checkpointSave`, `killPlayer`, and `triggerEnding`. The event command picker exposes them as 체크?ъ씤????? 즉사, and ?붾뵫 ?몃━嫄? command previews/summaries should stay terse because the runtime semantics live in the interpreter.
- `place_trap` in `src/editor/tools/eventTools.ts` creates transparent touch/action events whose page runs `killPlayer { message? }`. It accepts either `at` or `cells`; when `respawnCheckpoint:true`, it also adds a map-entry auto event using the self-switch-A-once convention and `checkpointSave` so retry restores to the entry checkpoint rather than adding a checkpoint to each trap.
- `make_chase_scene` in `src/editor/tools/eventTools.ts` creates an `eventTouch` chase mover with A* pathfinding, optional `killPlayer` on touch, optional map `safeZones`, optional activate switch page condition, and the same map-entry checkpoint helper used by `place_trap`.
- Horror lighting authoring uses native event commands `setLighting`, `addLight`, and `removeLight`; the event editor exposes them as 조명 ?ㅼ젙/광원 異붽?/광원 ?쒓굅 and treats them as `runtime-full`. Bulk room lighting lives in `src/editor/tools/lightingTools.ts` as `set_lighting_volume`: `applyMode:"map"` writes `map.defaultLighting`, while `applyMode:"event"` creates transparent `playerTouch` volume events over the supplied `area`.
- Phase 6b atmosphere authoring adds native event commands `setWeather` and `showAnimation`; the picker exposes them under ?붾㈃/?곗텧 with command summaries, previews, validation, and `runtime-full` support. `setWeather` writes the runtime weather state, and `showAnimation` targets the player, another event, or fixed tile coordinates with optional wait semantics.
- Combined weather/lighting authoring lives in `src/editor/tools/lightingTools.ts` as `set_scene_mood`. It reuses the `set_lighting_volume` lighting argument shape, adds optional weather, writes `map.defaultLighting` plus a map-entry weather event for `applyMode:"map"`, or creates transparent `playerTouch` volume events containing weather and lighting commands for `applyMode:"event"`.
- Calendar authoring uses optional `system.timeSystem` configured by the write tool `configure_time_system`. The event editor exposes `advanceTime`, `setTime`, and `sleepUntilMorning` as runtime-full commands, and page-condition UIs include `timePhase`, `season`, and `npcActivity` alongside switch/variable-style conditions. Encounter-table tools may also author `timePhase` and `season`; keep provider schemas as plain object/array/string/number/boolean shapes.
- NPC daily schedule authoring lives on `GameEvent.schedule?: NpcScheduleEntry[]` and the event editor's schedule JSON section. Schedule `when` supports `timePhase`, `hourRange`, `season`, and `dayRange`; do not add weekday fields because `GameTime` has only day 1~28/season/time. AI write tools are `set_npc_schedule` for existing events and `make_villager` for home+optional schedule/dialogue creation, with coordinate validation against target map bounds and passability. `make_villager` reuses an existing same-map event when its exact event id or `characterId` matches, and a schedule-only update must preserve the original position and dialogue pages. Low-level `upsert_event` also patches only supplied top-level keys for an existing id; omitted pages/commands/graphics/identity must survive.
- Friendship/gift authoring keeps relationship state out of authored project data. The event editor exposes `changeFriendship`, `getFriendship`, and `friendshipAtLeast` with the same condition UI conventions as switch/variable rows; empty `npcKey` means "this event" at runtime. Gift preferences/responses live on `GameEvent.giftPrefs` and `GameEvent.giftResponses`, while `system.giftSystem` gates whether action interactions show the gift menu. **Character ID editor UX:** optional `characterId` lives next to the event name in the top identity row (`renderEventNameControl` + inline `renderEventCharacterIdField`; empty means one-shot NPC with no shared friendship/gift key). Free-text attaches only (unknown ids do **not** auto-create profiles); `...` (`event-character-id-picker-open`) opens `characterIdPickerDialog.ts`. The dialog lists the union from `listCharacterIdIndex` (`project.characters` keys + every map-event `characterId`) with search, displayName, and usage/map counts; selecting attaches; create requires unique id + displayName, registers `project.characters[id] = { displayName }`, then attaches. Talk-friendship / profile display-name extras (`renderEventCharacterSocialExtras`) appear in the left settings column only when a characterId is linked. There is **no** characterId rename/rewrite. **Database catalog:** tab `罹먮┃?? (`db-tab-characters`, `databaseCharacterView.ts`) shows the same union, edits full `CharacterProfile` fields (displayName/birthday/giftPrefs/giftResponses), allows profile delete only (event refs remain), surfaces orphan ids with profile creation, and jumps to using map events via map select + event editor.
- Seasonal shop authoring extends the existing `shop` command with optional `stock` rows. Use `set_shop_stock { mapId, eventId, stock }` to update the first shop command or add one to the first page, and `make_villager` may receive `giftPrefs`, `giftResponses`, plus `shop:{ stock }` when creating shopkeeper villagers. Keep tool schemas provider-compatible and regenerate the tool catalog after changing these shapes.
- Dense investigation and room puzzle authoring lives in `src/editor/tools/investigationTools.ts`. `place_examine_hotspots` batch-creates transparent/action 조사 events, skips only invalid overlapping/out-of-bounds entries with warnings, and uses self-switch A for `once:true`. `compile_puzzle` declaratively compiles `switch-sequence`, `password`, `item-gate`, and `push-switches` into existing event commands (`fork`, `setVariable`, `inputNumber`, `changeItem`, `setSelfSwitch`, `setSwitch`) without adding project schema or runtime command kinds. Keep solvability checks deterministic and reject impossible puzzle definitions before mutating the draft.
- Ending registry tools live in `src/editor/tools/endingTools.ts`. `define_ending` upserts project `endings`, validates switch/variable conditions and optional cutscene epilogue beats, and reports warnings for impossible conditions or lower-priority endings shadowed by the same condition set. `list_endings` returns the registry plus the same warning pass.
- Story flag tools live in `src/editor/tools/storyTools.ts`. `declare_story_flag` adds metadata for existing switch/variable targets or auto-allocates an unused slot; `get_story_state` returns one-line registry state with current session/default values and read/write counts; `find_flag_usage` lists static read/write sites; `explain_event` evaluates each event page condition against the live play session when available or editor defaults when not. These tools add meaning and static analysis only; they must not introduce a new runtime state machine.
- Quest graph tools live in `src/editor/tools/questTools.ts`. Keep existing `create_quest` step compilation compatible, and use `define_quest` for authored narrative graphs with DAG nodes/edges over storyFlag or switch/variable completion conditions. `lint_quest`, `generate_walkthrough`, and `verify_quest` are read tools; generated walkthrough JSON must stay directly compatible with `run_scene_test`, using `manualHint` + `set` only when a real play step cannot be inferred.
- `place_npc` SimplePage compilation is intentionally tolerant for common in-editor AI malformed shapes: `conditions` may be omitted, null, an array, or a single condition object; `commands` may be omitted, null, an array, or a single command object; and obvious command-kind aliases such as `command: "text"` or `kind: { command: "text" }` are normalized. Every normalization must emit a tool warning, while unrecoverable shapes should fail with a short `field / expected type / actual type / minimal example` ToolError instead of a raw TypeError.

## 런타임 규격 무대 — 대사·선택지 미리보기는 게임 창을 축소해 그린다 (2026-09-17)

- **무엇이 문제였나(실측).** 문장 표시 LIVE 미리보기·인스펙터 미리보기·「미리보기」 뷰가 각자
  폰트(13px Malgun)·패딩(10/12px)·폭으로 창을 그려서 같은 대사가 **게임 3줄 / 다이얼로그 4줄 /
  인스펙터 5줄**로 갈렸다. 「최대 4줄 / 50자 권장」 안내가 잘못된 폭을 기준으로 판정됐고,
  빈 본문 샘플은 이 명령에 없는 얼굴(파티 첫 배우)을 빌려 와 절대 나올 수 없는 창을 보였다.
  「미리보기」 뷰의 무대는 4:3 이 아닌 빈 판(1047×357)이었고 「취소 → 선택지 N」 캡션이 창
  테두리를 타고 겹쳤다. 비교 근거: `docs/2026-09-17-event-editor-authoring-adversarial-review.md`
  뒤의 preview-vs-game 캡처(이 세션 `.playwright-mcp/`).
- **구조.** `commandPreview.ts` 의 `runtimeStage()` 가 `.ecp-runtime-frame > .ecp-stage.ecp-stage-runtime >
  .ecp-runtime-viewport(320×240) > .dialogue-overlay.position-bottom` 을 만들고, `messageWindowMock` /
  `choicesMock` 은 그 안에 **런타임과 같은 클래스**(`.dialogue-box.has-speaker.page-ready`,
  `.dialogue-content > [.dialogue-face] + .dialogue-text-column > .body`, `.speaker.speaker-nameplate`,
  `.dialogue-page-cursor`; 선택지는 `.dialogue-box.choices > .choice-list > .choice-prompt-row + .choice-btn.selected`)
  를 단다. 테스트 계약용 `ecp-*` 클래스·testid(`ecp-message-window`·`ecp-message-body`·`ecp-message-speaker`·
  `ecp-choice-window`·`ecp-choice`·`ecp-message-sample-note`)는 같은 요소에 함께 남긴다.
  `applySystemWindowSkinVariable(win)` 도 게임처럼 호출한다. 얼굴은 `.dialogue-face` 안에 48 논리 px
  (`RUNTIME_FACE_SIZE`)로 넣는다.
- **축소 규칙(JS 없음).** `.ecp-stage-runtime { container-type: inline-size; aspect-ratio: 4/3 }`,
  `.ecp-runtime-viewport { transform: scale(tan(atan2(100cqw, 320px))); transform-origin: 0 100% }`.
  CSS 는 길이끼리 나눌 수 없어 `tan(atan2(y, x))` 로 단위 없는 비율을 얻는다. 배율 = 무대 폭 / 320.
  다이얼로그(열 ≈460px) 1.4배 → 게임 9px 글자가 12.6px, 「미리보기」 뷰는 남은 높이에 맞춰
  (`.event-page-preview .ecp-stage-runtime { flex: 1 1 auto; width: auto }`) 1.5~1.7배, 인스펙터(≈285px)는
  0.9배다. 인스펙터 글자가 작은 것은 의도다 — 폭을 속이면 줄바꿈이 다시 틀어진다.
- **캐스케이드 함정.** event 표면 CSS 는 dialogue.css 보다 뒤에 실려 같은 특이도면 이긴다. 그래서 옛
  `.ecp-message-window` 시각 규칙은 `:not(.dialogue-box)` 로 좁혀 얼굴 바꾸기·문장 설정 목업만 받게 했고
  (`command-preview.css`), `.event-command-text-preview-canvas .ecp-message-window { background }` 처럼
  유리를 덮던 규칙은 지웠다(`command-preview-3.css`). 새 규칙은 `command-preview-4.css` 끝의
  «런타임 규격 무대» 블록 하나다. `.ecp-message-text` 는 얼굴 바꾸기·문장 설정 목업이 아직 쓴다 — 지우지 마라.
- **문장 다이얼로그 열 비율**은 `forms-3.css` 에서 미리보기 쪽을 넓혔다(`minmax(320px, 1.05fr) minmax(360px, 1fr)`).
  무대가 폭으로 축소되므로 열이 좁을수록 글자가 작아진다.
- **남긴 것.** 「미리보기」 탭 이름은 위키의 「스크립트 둘러보기」 계약과 여전히 다르다(뷰 토글 테스트가
  이름을 잡고 있어 이번엔 두었다). 흉상/전신(`bust`/`full`) 얼굴은 48px 칸으로만 그린다. 게임 대사창이
  반투명이라 창 뒤 NPC 가 검은 얼룩으로 비치는 런타임 현상은 미리보기가 아니라 dialogue.css 의 문제다.
- 표면 기준선 `test/fixtures/eventEditor{Form,Interaction,Portal}Surface.baseline.json` 은 클래스 목록이
  바뀌어 **의도된 차이**가 난다. 갱신은 각 테스트 머리말의 `*_UPDATE=1` 절차.

## 얼굴 상자(faceset-crop-box) 페인트 계약 (2026-08-28)

- 얼굴 한 장은 `facesetPreview.faceImage()` 가 **상자(`.faceset-crop-box`) + 진짜 `<img>`
  (`.faceset-crop-sheet`)** 로 그린다. 상자의 `--face-url` CSS 배경은 **로드 실패 폴백 전용**이다
  (`faceImage` 가 `error` 에서 `<img>` 를 떼기 때문). 그래서 계약은 두 줄이다:
  `<img>` 가 붙어 있으면 `.faceset-crop-box:has(> .faceset-crop-sheet)` 가 배경을 끄고,
  `<img>` 는 `position:absolute; inset:0; width/height:100%; object-fit:contain` 으로 상자를 채운다.
- **배경 폴백을 두 곳 이상에서 재선언하지 말 것.** 실측 사고 2건:
  (1) 그 두 규칙을 담은 `07-identifiable-previews.css` 가 어떤 배럴에도 @import 되지 않은 고아로
  남았다 — `<img>` 가 원본 크기(48×48) 정적 배치로 흘러가고 배경은 96×96 상자 전체에
  `contain` 으로 깔려 **얼굴이 두 장 겹쳐 보이고** 있었다(상자 115개 중 114개).
  (2) `02-changeface-play-mock-larger.css` 의 `.ecp-message-window .event-command-face-crop` 이
  `background-image` 를 다시 선언해 가드와 특이도가 (0,2,0) 으로 같아졌고, 나중에 로드되는 쪽이
  이기므로 재생 목업에서만 겹침이 남았다. 지금은 공용 `.event-command-face-crop` 한 곳만 배경을
  소유하고, 목업 규칙은 테두리만 다룬다.
- 배경과 `<img>` 를 같은 크기로 맞추는 것으로는 부족하다. nearest-neighbour 래스터화 결과가
  미묘하게 달라 배경이 테두리에서 1px 새어나온다. 반드시 `:has()` 가드로 막는다.
- 통짜 모드(흉상/전신) 감지는 `facesetPreview.faceDisplayModeOf()` 하나만 쓴다.
  `commandPreview.faceStage` 가 정규식으로 모드를 다시 판정하던 사본은 `…/bust` `…/full`
  접미사를 `chip` 으로 떨어뜨렸다. 지금은 미리보기가 폼과 런타임(`player/dialogue.ts`)에
  맞는다. 현재 저장소에 그 접미사를 쓰는 id 는 없어 잠재 결함이었다.
- 전신 프리셋(`generated-face-actor1-full`)은 `actor1-bust.png` 를 공유한다
  (`generatedAssetResourceResolver` 의 기존 관례). 그림은 흉상, 다른 것은 레이아웃뿐이므로
  폼 문구가 "통짜 전신 이미지"라고 말하지 않게 고쳤다.
- **하단 대사창의 전신(`-full`) 초상은 대사창 뒤 입상이다 (2026-10-01):** `player/dialogue.ts` 가 화면 높이로 크기를
  정한다(`fullPortraitMetrics`: 기본 높이 125% · 폭 9:16 · 아래 20% 는 화면 밖). 해상도가 달라도 존재감이 같다.
  - **크기는 저자가 정한다.** 프로젝트 기본은 `system.dialogueFullPortrait {height, drop}`(%, 높이 40~200 · 내림 0~60,
    기본값과 같은 칸은 저장하지 않음) — 자료집 → 시스템 → 대화창 「전신 초상」 슬라이더. 장면마다는 `changeFace.fullScale`
    (%, 40~200, 100 은 저장 안 함)이 한 번 더 곱해진다 — 얼굴 표시 명령에서 전신 그림일 때만 「전신 크기」 칸이 보인다.
    계산은 `project/dialogueStyles.ts` 의 `resolveDialogueFullPortraitLayout` 하나가 런타임·에디터 무대 견본
    (`editor/panels/fullPortraitStagePreview.ts`, 게임 해상도 비율)에 같이 답한다. 조수는 `set_project_settings` 의
    `dialogue.fullPortraitHeight/fullPortraitDrop`. 상단·중앙 위치의 92×164 전신은 이 설정을 받지 않는다.
    QA: `npm run qa:runtime -- --scenario dialogue-full-size --project <픽스처>`, e2e `test/e2e/dialogue-full-portrait-size.spec.ts`.
  초상은 상자 안이 아니라 **오버레이의 상자 뒤 형제**(`.dialogue-face-behind`, z-index 0 / 상자 1)다 — 상자는
  `backdrop-filter` 로 자기 쌓임 맥락을 만들어 안의 자식은 상자 배경 뒤로 못 간다. 퇴장 연출은 `~` 선택자로 같이 걷힌다.
  글 여백은 0(왼쪽 끝부터). 상단·중앙 위치는 예전 92×164 상자 위 방식 그대로다. 그림은 9:16 세로여야 틀이 찬다
  (정사각 `actor1-bust` 를 공유하면 92×92 로만 그려진다). QA: `npm run qa:runtime -- --scenario dialogue-full-portrait --project <전신 업로드가 든 픽스처>`.
- **대사창 한 페이지는 최대 3줄, 본문 줄간격 1.5 (2026-10-01):** `dialogueMaxLines` 가 상자에서 유도한 줄 수를
  `DIALOGUE_VISIBLE_LINES = 3` 으로 자른다(RPG 만들기식). 「기록」 버튼은 평소 숨기고(상자 호버·포커스 때만 보임, 키 L),
  진행 표시는 마름모/네모 대신 ▼ 삼각형이다(다음 장은 위아래 깜박임, 마지막 장은 제자리 점멸).
- **공용 표정 세트의 흉상·전신 (2026-10-01):** 76세트마다 흉상·전신 × 16표정(얼굴 16칸과 같은 표정) 2432장이
  `public/assets/shared/portraits/<줄기>/<모양>-<표정>.png` 에 있다. 목록·id 규칙은 `src/assets/sharedPortraitAssets.ts`
  (id `shared-<줄기>-expressions-<bust|full>-<표정>`, id 안의 `-bust`/`-full` 이 표시 방식을 정한다). 내장 리소스 표
  (`BUILTIN_GENERATED_RESOURCE_URLS`)에 실려 저장 검증·AI 검증을 통과한다.
  - **표정은 대사의 emotion 이 고른다.** `dialogue.ts` 가 바탕 얼굴이 공용 초상이면 `dialogueFaceForEmotion` 으로
    같은 모양의 표정 그림을 쓴다(본문 태그 `[표정:기쁨]` 도 같다). 화자 프로필의 표정 얼굴이 48px 낱장이어도
    흉상이 낱장으로 떨어지지 않는다 — 프로필 표정 얼굴이 따로 흉상·전신일 때만 그것이 이긴다.
    대사 emotion 은 4개(happy·sad·angry·surprised)뿐이라 자동 전환도 base 포함 5표정이다. 나머지 11표정
    (smile·content·embarrassed·doubtful·serious·annoyed·crying·worried·determined·shy·wink)은 직접 고른다.
  - 얼굴 바꾸기 폼: 「흉상」「전신」 버튼은 고른 얼굴이 공용 세트(낱장·초상)면 **그 인물의** 그림으로, 아니면 Actor1 프리셋으로 간다.
    공용 초상이면 「얼굴」 버튼(낱장 00 으로 복귀)과 16표정 줄(표정 없는 대사의 그림)이 보인다.
  - 외형: 흉상·**전신** 칸(전신은 2026-10-01 추가, `CharacterAppearanceRecord.full`). 얼굴이 공용 세트면 「이 얼굴의 공용 흉상/전신 연결」.
    얼굴 바꾸기의 「공유 외형 표시」에 전신(없으면 흉상·얼굴)이 생겼고 `presentation: "full"` 이 저장 형식에 추가됐다.
    그림 피커(`picture`)에는 세트당 `bust-base`·`full-base` 만 나온다. 조수 `list_resources(faceset)` 는 「흉상」「전신」·이름으로 찾을 때만 base 한 장씩 준다.
  - 웹 내보내기는 참조된 공용 초상의 같은 모양 대사 표정 5장을 함께 싣는다(`webExportAssets.ts`) — 그 표정은 런타임에서 파생되기 때문.
    나머지 11표정은 직접 참조될 때만 실린다.
  - 생성·검수 파이프라인과 계약(칩이 정답, 정수리 메모, 등신 고정): `scripts/content/portraits/README.md`.
- 표시 옵션 줄(`.event-command-face-options`)은 필드 수만큼만 열을 만들어야 한다. 얼굴 칸 번호
  컨트롤이 삭제된 뒤에도 3열 선언이 남아 오른쪽에 죽은 열이 있었다.
- (2026-09-17 이후) 대사·선택지 미리보기 창은 자기 유리를 갖지 않는다 — 게임과 같은
  `.dialogue-box` 클래스로 320×240 논리 무대 안에 그려지고 dialogue.css 가 표면을 소유한다.
  아래 «런타임 규격 무대» 절 참조. 얼굴 바꾸기·문장 설정 목업만 옛 `.ecp-message-window:not(.dialogue-box)`
  규칙을 쓴다. 그 규칙에서 반투명 유리는 불투명 밑판 **위에** 와야 한다 — 순서가 뒤집히면
  `--bg-surface`(#F7F8F8) 가 유리를 덮어 `--runtime-window-text`(#FFF6E2) 글자가 1.0:1 로
  사라진다. computed 색은 17.8:1 로 거짓말을 하므로 렌더된 픽셀로 검사한다.
- 게이트: `test/e2e/event-face-command-visual.spec.ts` + `npm run gates:css`(고아 CSS 0건).

## Staged edit, history, and nested drag invariants (2026-07-30)
- Command edit bodies must patch the latest dialog draft through `CommandEditContext.getCurrentCommand?.()`. Never merge a change into the render-time `cmd` closure; consecutive edits in shop, choices, fork conditions, composite all/any conditions, generic M2 fields, and Page 3 rich forms must accumulate in one `stagedCommand`. The dialog OK path does not synthesize `change` events over every control.
- Event-page command histories use keys shaped as `mapId:eventId:pageId`. `modal.ts` clears every `${mapId}:${eventId}:` history at edit-session start and on every close path through `clearCommandToolbarHistories`; cancelled drafts must never return after reopen + Undo. History wrappers must forward and snapshot `moveCommandAcross` as well as same-container moves.
- A rendered command row derives its parent container from `path.slice(0, -1)`. Empty choice/cancel, fork, loop, shop, inn, and battle-result branches expose `event-command-branch-drop-zone` with the exact `data-container-path`; row/list drop handlers stop propagation so nested and root zones cannot both move one command.
- Command editing is subdialog-based, not inline `.editing`: **single-click** (or double-click) `.cmd-head`, or click a storyboard command card, operate inside `event-command-edit-dialog`, commit with `event-command-edit-ok`, then apply the parent event modal. A command click never opens a separate browser window and never edits inline in the right inspector column.


## Command picker, validation, and preview trust (2026-07-30)
- **Context-specific support repair (2026-09-06):** `commandRuntimeSupportDescriptor` in `project/eventCommands/runtimeSupport.ts` is the single picker/list explanation source. Both list renderers and insert/append pickers use `pickerContext`; the old grade-only callback is removed because it discarded the context needed for an honest reason. Picker aliases describe the native kind they insert, not a persisted M2 payload. Existing grades and eligibility remain separate contracts; no new picker entries or styles are introduced.
- Player audit plus location/audio repair evidence promotes only M2 022, 040–045, 078, 093, 205, 206, 210 in map/common. Troop text is a battle message, face/settings are metadata, inputWait does not await input, and wait does not suspend subsequent event commands. Skipped troop commands explicitly say they are not executed there. System BGM/SE (027/028) remain metadata-only; explanations point to native playAudio with the correct loop flag, or Sound Layer for gain/fade. Unknown coverage is labeled unverified, not a claimed missing effect. `eventCommandSupportRepairs.test.ts` exercises descriptors, real renderer wiring, common/troop nested-list context, and the battle execution boundaries; `commandContracts/m2Command.contract.test.ts` covers the promoted interpreter effects in both direct and common-event execution.
- `commandPicker.ts` keeps four text-labelled tabs with a strict roving-tab contract: only the selected tab has `tabindex="0"`; Arrow keys/Home/End select and focus the destination. Favorites retain authored preference order, recents remain newest-first, and preference rerenders restore focus to the same command/favorite control. Preferences are best-effort localStorage data owned by `commandPickerPreferences.ts` and never project content.
- Audio aliases are intent-bearing: choosing `BGM 재생` creates `playAudio { loop:true }`, while `SE 재생` creates `playAudio { loop:false }`. The runtime `audio-indicator` banner is **loop-only** (`playSceneInterpreter`/`playSceneSchedulers`): the only clear path is `stopAudio`, so a one-shot SE used to paint its resource id across the game screen and leave it there (browser QA, 2026-08-30). Coverage: `test/runtimeAudioIndicator.test.ts`. The move-route `playSe` path still shows it (`test/runtimeMoveRouteCommands.test.ts` pins that). The shared edit-dialog title stays channel-neutral (`소리 재생`) because the channel can be changed inside the form. `commandBodyAdvanced.ts` must use the exported `listDatabaseResourceOptions()` catalog shared with the database picker, including search terms and catalog order; do not reintroduce a local BGM/SE asset list. Focused coverage: `test/eventCommandPickerAudio.test.ts` and `test/playAudioCommandBody.test.ts`.
- Command rows and page tabs receive aggregate issue badges from `eventDraftValidator.ts`. Issue buttons navigate to the affected page and nested command path (or a known field testid). Apply, OK, and selected-event Test all share the same fatal-error gate; warnings are visible but non-blocking.
- The auxiliary surface is deliberately labelled `스크립트 둘러보기`, not runtime preview. It expands loops once, lists all choice branches, and does not execute label/goto jumps; those limits must remain visible in `event-script-preview-disclaimer`. Actual behavior is verified only through `이 이벤트 테스트`, which enters the real player/interpreter path.
- Focused coverage: `test/eventDraftValidator.test.ts`, `test/eventEditorTrustLoop.test.ts`, `test/eventBeginnerTemplates.test.ts`, and `test/selectedEventTestModal.test.ts`.

## 회상 스틸과 AI 그림 (2026-09-03)

- `script_cutscene_preset` `memory_opening` 은 카메라 팬만이 아니다. `recollectionBeats` 가
  페이드 아웃 → 회상 BGM(`cc0-bgm-rtp-emo-001`) → 틴트 → `showPicture` → 대사 → 그림 지우기 →
  틴트/페이드 복원 → BGM 정지로 컴파일한다. 새 Command.kind 는 없다.
- 빈 이벤트 「회상 오프닝」 CTA 가 그 프리셋을 현재 페이지에 심는다.
- `showPicture` 폼에 `AI로 만들기` 가 있다. Google Antigravity OAuth 로 그림을 만들고
  `project.assets.uploaded` 그림 리소스 id 를 `resourceId` 에 넣는다.
- 커버: `test/recollectionBeats.test.ts`, `test/showPictureForm.test.ts`,
  `test/eventEditorMemoryOpeningTemplate.test.ts`, `test/scriptCutsceneIntegration.test.ts`.

## Recovered native emote command (2026-09-05)

`showEmote` displays one of the 12 `src/project/emotes.ts` icons above the player or an event, then immediately continues. An empty eventId means the executing event. The native picker places it under tab 3 「화면 연출」. The picker/schema/factory, `showEmoteBody` pictorial radio grid, command summary, draft validator and interpreter share that contract. Duration defaults to 1200ms and clamps to 200–10000ms. Invalid named event references warn during authoring; load repair converts removed targets to the current-event sentinel without making the project unloadable. Troop context explicitly reports unsupported.

## 패배·엔딩 저작 (2026-09-22)

DB → 게임 오버에서 클래식/공포/회복 귀환을 고른다. 귀환 지점은 맵과 타일 좌표다.
`set_game_over`도 같은 presentation/recovery 레코드를 변경하며 나머지 시퀀스를 보존한다.
`ending` 명령 폼은 분위기(warm/dark)와 크레딧을 편집하고 기존 배경/음악 참조를 유지한다.
엔딩 레지스트리의 `define_ending`은 `presentation`으로 엔딩별 분위기·배경·음악·크레딧을 받는다.
연출 순서와 진행 유지 계약은 `runtime-sessions.md`의 장르별 패배와 엔딩 흐름 절을 따른다.

2026-10-04 native QA: 명령 툴바 `details`의 overflow를 숨기면 절대 위치 편집 팝오버가 잘려, 이동 단추 자리에 옆 undo/redo가 hit-test 된다. 메뉴 자체는 overflow visible 및 flex-shrink 0을 유지한다. 긴 버튼 라벨은 기존 버튼 계층에서 축약한다.
