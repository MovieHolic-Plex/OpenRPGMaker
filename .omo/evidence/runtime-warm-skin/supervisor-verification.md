# 감독 검증 — Neo둥근모 + 갈색 윈도우스킨 (agent/runtime-warm-skin)

이 문서의 숫자는 **감독이 직접** 실행한 명령과, 그 명령이 쓴 JSON 을 직접 파싱해서 얻은 값이다.
하위 레인의 `verify-report.md` 는 참고용으로 남겼지만 이 문서가 판정 근거다.

## 0. 하위 레인 보고에서 실제로 틀렸던 것

- `_warm-skin-qa.spec.ts` 의 반복이 `status-menu-command-party` 를 찾고 있었다. 도크의 파티 항목은
  접힌 그룹이라 실제 testid 는 `status-menu-command-party-menu` 다. `count() === 0` 이면 `continue`
  였으므로 **파티·상태 서피스가 조용히 측정되지 않은 채** "6개 서피스 전부 통과"로 보고됐다.
  실측 덤프 라벨은 `main, items, equipment, skills` 4개뿐이었다.
  → 두 서피스를 실제로 열도록 고치고, 라벨 배열 자체를 단정해 다시 조용히 건너뛸 수 없게 만들었다.
- 기본 윈도우스킨 id 를 갈색으로 옮기면서 **기본값을 박아 둔 테스트 3곳**(`systemGraphics`,
  `titleScreen`, `koreanLocalizationDefaults`)이 깨졌다. 하위 레인이 돌린 vitest 7개 파일에는
  그 세 파일이 없어서 초록으로 보였다. → 기대값을 갈색으로 옮기고 재실행해 통과 확인.
- `_warm-battle-surface.spec.ts` 는 전투 HUD 모든 노드에 Neo둥근모를 요구해 구조적으로 실패했다.
  전투 HUD 는 지점 기준에서도 본문 스택(Malgun Gothic)이다. → "교승이 새 잘림을 만들지 않았다"
  라는 검증 가능한 계약으로 다시 썼다.

## 1. RED → GREEN (같은 스펙, 같은 뷰포트 1280x900, 스테이지 배율 3.417)

RED 는 지점(`24c0a450`)의 `src` 로 되돌린 뒤 같은 스펙을 돌려 받았다(`git checkout HEAD~1 -- src`).

| 항목 | RED (지점) | GREEN (레인) |
|---|---|---|
| 첫 글꼴 | `Galmuri11` (전 노드) | `NeoDunggeunmo` (전 노드) |
| 윈도우스킨 | `windowskin-default.png` | `windowskin-warm.png` |
| 요청 상태 | default.png 200, neodgm 요청 없음 | warm.png 200, **neodgm.woff2 200** |
| 화면 픽셀 | 따뜻함 59,870 / 차가움 **654,838** | 따뜻함 **716,167** / 차가움 5,439 |
| 잘린 텍스트 | **8** | **0** |
| 측정 서피스 | 6 | 6 |

RED 잘림 8건(증거: `red-clipped.txt`) — 도크 라벨 `clipY=2` 6건 + 상세 설명문 `clipX=19` 2건.
GREEN 은 같은 노드에서 0이다(`green-clipped.txt` 는 빈 파일).

## 2. W1~W4 판정 (감독이 파싱한 값)

- **W1 폰트** PASS — ESC 6개 서피스 214개 텍스트 노드 전부 `NeoDunggeunmo` 1순위,
  `neodgm.woff2` 200, 화면 렌더 최솟값 **27.33px** (CSS 8px x 배율 3.417) ≥ 10px.
  글꼴 자체 검증: woff2 안에 한글 음절 **11,172자** + 자모 51자 + ASCII 95자가 있어
  한국어가 대체 글꼴로 떨어지지 않는다(fontTools cmap). 스크린샷 `green-02-esc-main.png`.
- **W2 갈색 크롬** PASS — 파티 카드·상세 패널·명령 도크의 `border-image-source` 가
  `windowskin-warm.png`(200), 화면 표본 따뜻함 716,167 대 차가움 5,439.
  자산 자체도 96x96 8bit RGBA PNG 이고 붉은 채널 > 파란 채널이다(`windowSkinAsset.test.ts`).
- **W3 잘림 0** PASS — main / items / equipment / skills / **party** / **status** 6개 서피스,
  214개 노드에서 `scrollWidth-clientWidth > 1` 또는 `scrollHeight-clientHeight > 1` 이 0건.
  메뉴 경계 밖으로 밀린 노드(outTop/outBottom/outLeft/outRight)도 0건.
  증거: `green-warm-dump.json`, `green-clipped.txt`, `green-03-esc-*.png`.
- **W4 인접 서피스** PASS(전투는 지점 대비 무변화로 판정) —
  - 타이틀: 7 노드, 비-Neo 0, 잘림 0, 자산·스크립트 오류 0 (`title-surface.json`).
  - 대사창: 9 노드, 비-Neo 0, 잘림 0, 자산·스크립트 오류 0 (`dialogue-surface.json`).
  - 전투: 47 노드, 잘림 28 — **지점에서도 똑같이 47 노드 / 잘림 28** 이고 47개 전부
    `"Malgun Gothic", ...` 스택이다(`basepoint-battle-surface.json` 대 `battle-surface.json`).
    즉 이 3~5px 세로 모자람은 전투 HUD 의 기존 결함이며 글꼴·스킨 교승과 무관하다.
  - 남은 콘솔 오류는 전부 AI 활동 로그 배관이다: `/__oprn/ai-activity`,
    `dbserver:8100/rest/v1/ai_activity_logs`, `127.0.0.1:17831/v1/browser/hello`.
    폰트·윈도우스킨 요청 실패는 0건이다.

## 3. W5 게이트

- `npx tsc --noEmit -p tsconfig.app.json` → **exit 0, error TS 0건** (`.omo/tsc-app.log`).
- 바뀐 모듈을 참조하는 vitest 전수 통과: `systemGraphics`, `titleScreen`, `system2Sheet`,
  `windowSkinAsset`(신규 2케이스 포함), `playerRuntimeCss`, `touchPadModalVisibility`,
  `playerStatusMenuEntryIcons`, `playerStatusMenuPortrait`.
- 지점에서 재현된 **기존 실패 4건**(내 변경과 무관, `basepoint-vitest.log`):
  `defaultDatabase` 2건(스타팅 파티 2 vs 4), `koreanLocalizationDefaults` 1건(적 220 vs 29),
  `detsukuruBrandStrings` 1건(금지 표현 1건). 레인에서도 같은 4건, 그 이상은 없다.
- 저장소 전체 게이트는 기준선이 이미 빨간불이다(`.omo/gates-baseline.json`, 2026-08-13).
  main 에서 재현한 회귀 16건은 전부 다른 레인 커밋(스토리지 접두사 이관, DB 개요 개편,
  P0/P1/P2 스키마)이며 이 레인이 건드린 파일은 그 목록에 없다.

## 4. 재현 명령

```
DEV_SERVER_PORT=9803 WARM_LABEL=green npx playwright test test/e2e/_warm-skin-qa.spec.ts --timeout=300000
DEV_SERVER_PORT=9803 npx playwright test test/e2e/_warm-title-surface.spec.ts test/e2e/_warm-dialogue-surface.spec.ts --workers=1 --timeout=300000
DEV_SERVER_PORT=9803 npx playwright test test/e2e/_warm-battle-surface.spec.ts --timeout=300000
npx tsc --noEmit -p tsconfig.app.json
npx vitest run test/systemGraphics.test.ts test/titleScreen.test.ts test/koreanLocalizationDefaults.test.ts test/windowSkinAsset.test.ts test/system2Sheet.test.ts
```

RED 재현은 `git checkout <branch-point> -- src` 후 `WARM_LABEL=red` 로 같은 스펙을 돌리고,
끝나면 `git checkout HEAD -- src` 로 되돌린다.
