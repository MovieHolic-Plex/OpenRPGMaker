# pixelfx 코드 픽셀 효과 (2026-10-31, 0.3.0 반영 2026-11-07)

[patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)(MIT, Patch · Hugo Duprez)의 코드로 그리는 픽셀 효과 244종(0.3.0)을 편집기와 런타임에 붙였다.
시트 그림이 아니라 효과마다 `draw(p, t, o)`(순수) 또는 `create(o)`(120Hz 시뮬레이션) 코드가 게임 해상도 화소를 직접 찍는다.
색 띠(palette)·좌우 뒤집기·각도·씨앗을 바꿔 같은 효과를 여러 모양으로 쓴다.


## 0.3.0 (2026-11-07) — 「효과에 몸이 붙는다」

업스트림 [a8415968](https://github.com/patch-gg/pixelfx/commit/a84159688af3ca37a4be05a0d422b94451b2e24e)(2026-10-31, `pixelfx 0.3.0: give the effects a body that performs them`)를 가져왔다.
`fe7103c..a8415968` = 100 파일 +3,126/−132. **효과 232 → 244**(새 분류 `moves/` 12종), `actor` 를 쓰는 효과 61 → 73.

### 코어 계약 — 바뀐 것과 그대로인 것

| 계약 | 상태 | 근거 |
|---|---|---|
| `createFrame` / `clearFrame` / `painterFor` | **그대로** | `src/vendor/pixelfx/core/fx.js:12`·`:23` — `git diff fe7103c..a8415968 -- src/core/fx.js` 가 빈 diff |
| `createFx(mod, o)` | **그대로** | `core/fx.js:51` — 옵션(`x`,`y`,`flip`,`angle`,`seed`,`palette`,`light`,`actor`)과 `update`/`draw(frame, layer)`/`stop`/`done` 계약 무변경 |
| `meta.origin` | **그대로** | `core/fx.js:72` `p.place(opts.x, opts.y, flip, angle)`; 우리 `renderer.ts:23` `pixelFxLayout` 이 `mod.meta.origin` 을 그대로 읽는다 |
| 층 `back`/`front` | **그대로** | `core/fx.js:76`·`:80` — `drawBack` 은 `layer !== "front"`, `draw` 는 `layer !== "back"` |
| 팔레트 | **그대로** | `core/fx.js:38` `resolveOptions` — 다른 길이의 띠를 기본 길이로 리샘플. `o.palette` 의미 불변 |
| 빛 버퍼 + `composite` | **그대로** | `core/fx.js:100` `composite(f, out, bg, lightK)` — 시그니처·ABGR 팩킹 불변 |
| `stockActor` / `drawActor` | **모양만 바뀜** | `core/actor.js:104`·`:111` — 2배 캐릭터(HERO2)가 리그의 서기 자세로 다시 그려지고 중립 팔레트(`DUMMY_PAL`, `:35`)를 쓴다. `chest` 가 `y+22` → `:104` `-26` 으로, `eyes` 추가. **함수 계약은 같다**(mask·pixels·x·y·w·h·k + 새 필드) |
| `meta.actor` | 의미 그대로 | 1 = 12×19, 2 = 24×38. `resolveOptions` 가 `stockActor(2)` 를 기본으로 넣는다 |

우리 래퍼는 **한 줄도 고칠 필요가 없었다**: `renderer.ts:118` 이 부르는 `createFx` 의 계약이 바이트 동일하고, 몸·대상은 `createAct` 안에서만 그려진다(우리는 부르지 않는다).
유일한 메타 변화는 `spawn/shatter-death` 크기 `168×96 → 172×96`(리그 몸이 2px 길어짐) — 레이아웃은 `meta.size` 를 매번 읽으므로 자동 반영된다.

### 새로 더해진 것 (전부 덧붙이기 — 기존 호출 경로 무영향)

| API | 파일 | 뜻 |
|---|---|---|
| `createAct(mod, o)` | `core/act.js:208` | 효과 하나를 「연기」로 튼다. `update(dt)`·`draw(frame, {body, target})`·`shake`·`frozen`·`done()` |
| `actBounds(mod)` | `core/act.js:469` | 연기 전체가 들어가는 캔버스 상자(로컬 좌표) |
| `actSpan(mod)` | `core/act.js:198` | 연기 시작(음수 = 준비)·끝 |
| `actTiming(mod)` | `core/act.js:454` | 게임이 자기 캐릭터로 같은 박자를 쓰도록 낸 데이터(`windup`·`recovery`·`hits`·`poses`) |
| `Target` | `core/act.js:111` | 허수아비 대상(휘청·색 번짐·지푸라기) |
| `skeleton` / `posed` / `STAND` / `READY` / `SKINS` | `core/rig.js:490`·`:42` · `core/poses.js` | 3D 뼈대를 도트로 내리는 자세 해석기 |
| `chain(cues)` / `shiftKeys` / `shiftHits` | `core/chain.js:10`·`:44` | 여러 효과를 한 동작으로 잇기(`moves/`) |

`export const act = { poses, hits, targets, dust, onBody, ghost }` 가 붙은 효과는 **73종**(그중 `onBody: true` 37종 — 서리·독·축복처럼 서 있는 몸 위에 직접 그리는 효과).
효과 12종(`moves/*`)는 `act` + `chain` 을 같이 써서 **준비 → 휘두름/발사 → 맞음 정지 → 회복** 을 통째로 담는다.

### 우리 쪽에 실은 것

- `scripts/vendor/sync-pixelfx.mjs` 가 `catalog.json` 에 `act` 를 같이 낸다(`windup`·`recovery`·`onBody`·`hits`·`targets`). 효과 코드를 부르지 않고도 편집기·조수가 박자를 안다. `timing.json` 은 그대로 `[길이 ms, 반복]` — 전투 시퀀서 계약 불변.
- 편집기 고르기 창 카드에 `몸`/`연기` 표시, 오른쪽 정보줄과 자료집 레코드 편집면에 `준비 N초 · 회복 N초 · 타격 N박자`.
- 조수 `list_pixel_fx` 결과에 `act: { windupSec, recoverySec, onBody, hits }`.
- 효과 수 하드코딩(232)을 전부 없애고 `PIXEL_FX_EFFECTS.length` 를 쓴다 — 다음 동기화 때 또 낡지 않는다.

### 아직 우리가 쓰지 않는 것 (의도)

`createAct` 를 전투·필드에 붙이지 않았다. 우리 전투는 **적 스프라이트·아군 배틀러가 이미 무대에 서 있고**, 효과는 그 위에 얹히는 층이다.
`createAct` 는 라이브러리의 중립 캐릭터(`DUMMY_PAL` 24×38)와 허수아비를 **자기가 직접 그린다** — 그대로 켜면 우리 캐릭터 옆에 낯선 인형이 하나 더 서고, 우리 적은 허수아비로 바뀐다.
그래서 0.3.0 은 **(a) 효과 그림 갱신 + 12 신규 + (b) 박자 데이터 노출** 까지만 들였다. 몸을 우리 배틀러로 바꾸는 것은 별도 결정이다(아래 「몸 결정」).

## 파일 지도

| 층 | 파일 | 하는 일 |
|---|---|---|
| vendor | `src/vendor/pixelfx/{core,fx}` · `LICENSE` · `NOTICE.md` · `UPSTREAM.json` | 원본을 바이트 그대로. 손으로 고치지 않는다. 갱신은 `node scripts/vendor/sync-pixelfx.mjs --src <클론>` |
| vendor 파생 | `catalog.json` · `timing.json` (sync 가 생성) · `core/index.d.ts` (손으로 쓴 타입, sync 가 보존) | 편집기 목록 / 전투 길이 / 타입 |
| 데이터 | `src/project/types/database.ts` `PixelFxSpec`, `BattleAnimationRecord.pixelFx` · `events.ts` `EventPage.pixelFx: EventPixelFx` | 효과 지정(effectId·palette·flip·angle(도)·seed·scale·light·speed·offset) |
| 정규화 | `src/project/pixelFxSpec.ts` · `pixelFxAnimationRecords.ts` (`upsertPixelFxAnimationRecord` → `anim_pfx_<분류>_<이름>`) | 칸 검사·같은 지정 레코드 재사용 |
| 렌더러 | `src/pixelfx/renderer.ts` (`PixelFxRenderer`, 층 back/front/all, 색+빛 버퍼) · `modules.ts` (효과별 동적 import) | 런타임·편집기 공용 |
| 전투 | `src/player/battleAnimationDom.ts` `startPixelFxPlayback` · `src/pixelfx/domPlayer.ts` | DOM 캔버스, 무대 2배, 대상이 왼쪽 반이면 자동 뒤집기 |
| 필드 | `src/player/playScenePixelFx.ts` (`updatePixelFx`, `playFieldPixelFx`) · `PlayScene.ts` · `playSceneMapAnimations.ts` | 상시 효과·한 번 효과, y 정렬, 화면 밖 끄기 |
| 편집기 | `src/editor/panels/pixelFxPicker.ts` · `pixelFxRecordEditor.ts` | 고르기 창, 자료집 애니메이션 탭, 기술·아이템 칸, 「애니메이션 표시」 명령, 이벤트 페이지 「상시 효과」 |
| 조수 | `src/editor/tools/pixelFxTools.ts` · `src/pixelfx/previewSheet.ts` | `list_pixel_fx` `preview_pixel_fx` `attach_pixel_fx` `set_event_pixel_fx` `place_pixel_fx`, 능력 색인 `pixel-fx` |
| 목록(편집기만) | `src/pixelfx/catalog.ts` | 검색(한국어 낱말 → 영어 태그), 가까운 id, 한 색 → 6단 띠 |

## 계약

- **원점**: 효과의 `meta.origin` 은 발밑·착탄점이다. 전투는 애니메이션 앵커(`position`, 기본 feet)에, 필드는 대상 칸 **바닥 가운데**에 놓는다(`offsetX/Y` 게임 화소로 밀기 — 벽 횃불은 -8~-16).
- **방향**: 방향 있는 효과는 오른쪽을 본다. 전투에서 `flip` 생략 = 대상이 무대 왼쪽 반이면 뒤집는다(`targetOnLeftHalf`). `angle` 은 도 단위.
- **전투 길이**: 한 번 효과는 효과 길이, 반복 효과는 1.2초(`PIXEL_FX_BATTLE_LOOP_MS`)만 돌고 끈다. 박자 계산은 `pixelFxBattleDurationMs` 가 상한 1.6초(`PIXEL_FX_BATTLE_HOLD_MS`)로 잡는다 — 꼬리는 다음 행동에 잘린다.
- **도트 측면(retro2003)**: 스킨이 기술 연출을 쓰면 `lastAnimation` 을 버리는데, pixelFx 레코드는 `isStoreBattleAnimationId` 가 true 라 그대로 보인다.
- **전투 빛**: `.battle-animation` 이 쌓임 맥락이라 배경과 더하기 섞기를 못 한다. 라이브러리 `composite(frame, out, null)` 로 빛을 색에 합쳐 그린다.
- **필드 빛**: 빛 버퍼를 불투명 검정+RGB 텍스처로 만들어 ADD 섞기로 겹친다.
- **필드 층**: `layer` auto = 효과의 back 층은 대상 깊이 −0.5, front 층은 +0.5(캐릭터 y 정렬 `characterDepth` 사이). back = 99,000(모든 캐릭터 뒤), front = 340,000(모든 캐릭터 위, 이벤트 자리). screen = 효과의 **앞 층만**(날씨 효과의 뒤 층은 하늘·땅 배경 장면이라 화면을 반투명으로 100% 덮는다 — 실측 비·눈·반딧불·벚꽃) 카메라를 따라 시야에 깐다 — 반딧불·비·오로라처럼 상자 전체에 장면 색을 까는 효과는 이벤트 자리에 두면 네모난 색 상자가 된다(2026-10-31 캡처).
- **화면 층 배율 = 칸 배율, 키우지 않고 바둑판**(2026-10-31 수정): 효과 화소 1 = 그 맵 칸 그림 화소 1(`runtimeMapWorldScale`)이다. 효과 캔버스(날씨는 320×180)를 시야에 이어 깐다(`anchorScreen`·`showScreenTiles`). 예전처럼 시야를 덮는 정수배로 키우면 16px 칸 게임(시야 320×240)에서 2배가 되어 눈 결정이 칸 하나만 해지고 오로라가 문·벽을 덮었다(폴른 스타 서리나루).
  - 뒤 층이 있는 효과(눈·비·반딧불·벚꽃·낙엽·안개): 원점 위 8화소(`SCREEN_GROUND_CUT`)부터 아래 땅 띠(빗방울 왕관·웅덩이·쌓인 눈)를 `setCrop` 으로 잘라 내고 남은 하늘을 시야 아래 끝부터 위로 쌓는다. 자르지 않으면 칸 경계마다 물튀김 가로줄이 생긴다.
  - 뒤 층이 없는 하늘 띠(오로라·구름·별똥별): 시야 맨 위에 **한 줄만** 깔고 옆 칸은 좌우 거울로 뒤집어 이음매를 잇는다. 오로라는 그래도 시야 위쪽 180화소를 빛으로 덮는 효과라 걷는 맵 위에는 무겁다 — 하늘이 보이는 맵이나 `light` 를 낮춰 쓴다.
  - 깃털(`PixelFxFeather`): 바둑판은 이음매를 녹이면 빈 띠가 칸칸이 보이므로 끄고("none"), 하늘 띠는 아래 변만("bottom") 녹인다. 전투·이벤트 자리 효과는 그대로 네 변.
  - 계기: `__oprnPixelFxStats.screen = { scale, cols, rows, band }`. 캡처 `node scripts/qa/runtime/pixelfx.capture.mjs --mode screen [--screen-fx …] [--viewport 1280x720] [--resolution 400x225]`.
- **가장자리 깃털**: 빛과 장면 색이 상자 끝까지 번진 효과(횃불·치유 빛)는 상자 끝에서 네모 테두리가 보였다. `renderer.ts` `featherFrame` 이 테두리 안쪽 4~24화소에서 색 알파·빛 밝기를 0 으로 녹인다(전투·필드·미리보기 공통).
- **필드 비용**: 반복 효과(108종, 전부 순수 함수)는 그림 열쇠(효과+색+뒤집기+씨앗+층+속도)마다 렌더러·캔버스 텍스처 한 벌을 모든 이벤트가 나눠 쓴다(SharedLoop) — 같은 횃불 20개도 그리기는 한 번. 효과 프레임이 바뀔 때만 다시 그리고(넓이 128×128 초과는 15fps), 공유 효과 다시 그리기는 틱당 4ms 예산(넘으면 다음 틱). 뒤 층이 없는 효과는 앞 층 한 장만. 작은 효과(한 주기 사본이 24MB 이하, 장면 합계 64MB 까지 — 횃불·촛불·모닥불)는 처음 한 주기를 그리며 화소 사본을 남기고 그 뒤로는 사본만 올린다. 반딧불(12초·320×180)·폭포·날씨처럼 큰 것은 늘 그린다. 같은 열쇠의 이벤트는 같은 위상으로 돈다(어긋나게 하려면 seed 를 다르게). 한 번 효과는 효과 fps(대개 30)로만 다시 그리고, 틱 비용 이동 평균이 6ms 를 넘으면 반 fps 로 내린다. 동시 한 번 효과 상한 12. 화면(카메라 worldView) 밖 상시 효과는 그리지 않는다. 페이지 조건은 300ms 마다 다시 본다. 계측 `window.__oprnPixelFxStats`.
- **명령**: 필드 한 번 효과는 새 명령이 아니라 기존 `showAnimation`(이벤트 명령 「애니메이션 표시」·`script_cutscene` animation 비트)이 pixelFx 레코드를 가리키면 된다. 상시 효과는 `EventPage.pixelFx` — 페이지 전환으로 켜고 끈다.
- **하위 호환**: 두 칸 모두 선택 칸이다. 옛 레코드·이벤트는 바이트가 그대로이고, `pixelFx` 를 지우면 셀 애니메이션으로 돌아간다.

## 실측 (2026-10-31)

노드 벤치(그리기+합성 한 장, 부하 있는 상자): torch 1.35ms · campfire 2.36ms · fireflies 3.2ms · waterfall 3.8ms · rain 5.5ms · fireball 1.2ms · frost-nova 3.4ms · big-explosion 16.4ms · heal 0.43ms.
반복 효과는 구운 뒤 정상 상태 비용이 0에 가깝다. 큰 폭발류는 한 장이 16ms 를 넘으므로 한 화면에 여러 개 겹치지 않는다.
브라우저 실측(출하 플레이어, `scripts/qa/runtime/pixelfx.capture.mjs`)은 PR 본문과 아래 「브라우저 실측」에 적는다.

## 라이선스

MIT 고지: `licenses/MIT-pixelfx.md`, `THIRD_PARTY_NOTICES.md`, 그리고 `scripts/lib/runtimeLicenseBanner.mjs` 가 vendor 모듈을 담은 출하 청크마다 전문을 붙인다.
원본 갤러리의 「Patch Pixel」 글꼴은 MIT 가 아니다 — `gallery/` 는 복사하지 않는다(sync 스크립트도 core·fx 만 본다).
런타임에 편집기 코드가 들어가지 않게 `src/pixelfx/catalog.ts`·`previewSheet.ts` 는 편집기에서만 import 한다(`playerBundleGuard`).
