# pixelfx 코드 픽셀 효과 (2026-10-31)

[patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)(MIT, Patch · Hugo Duprez)의 코드로 그리는 픽셀 효과 232종을 편집기와 런타임에 붙였다.
시트 그림이 아니라 효과마다 `draw(p, t, o)`(순수) 또는 `create(o)`(120Hz 시뮬레이션) 코드가 게임 해상도 화소를 직접 찍는다.
색 띠(palette)·좌우 뒤집기·각도·씨앗을 바꿔 같은 효과를 여러 모양으로 쓴다.

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
- **필드 층**: `layer` auto = 효과의 back 층은 대상 깊이 −0.5, front 층은 +0.5(캐릭터 y 정렬 `characterDepth` 사이). back = 99,000(모든 캐릭터 뒤), front = 340,000(모든 캐릭터 위).
- **필드 비용**: 반복 효과(108종, 전부 순수 함수)는 프레임을 처음 볼 때 한 번 구워 렌더 키(효과+색+뒤집기+씨앗)로 공유한다(LoopBank) — 굽기는 틱당 4ms 예산. 한 번 효과는 효과 fps(대개 30)로만 다시 그린다. 동시 한 번 효과 상한 12. 화면(카메라 worldView) 밖 상시 효과는 그리지 않는다. 페이지 조건은 300ms 마다 다시 본다. 계측 `window.__oprnPixelFxStats`.
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
