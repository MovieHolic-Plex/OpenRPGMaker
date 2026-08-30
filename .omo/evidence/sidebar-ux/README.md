# 좌측 사이드바 UI/UX 개선 — 측정 증거

## `rail-probe-after.json`

실제 dev 서버(초보 모드, `?devProject=1&marketTown=1`)를 띄워 브라우저에서 측정한 값이다.
단위 테스트로는 볼 수 없는 **레이아웃** 사실만 담는다.

| 값 | 1024x600 | 1440x900 | 무엇을 증명하나 |
|---|---|---|---|
| `leftPanelW` / `railWidthVar` / `editorLeftSafe` | 72 / 72px / 72px | 72 / 72px / 72px | 폭 선언이 한 원천이고 `--editor-left-safe` 가 실제 렌더 폭과 일치한다 |
| `mapsToggle.bottom` vs `viewportH` | **592 ≤ 600** | 634 ≤ 900 | 짧은 뷰포트에서도 맵 진입점이 화면 안이다 |
| `railScrollH` / `railClientH` | 550 / 550 | 850 / 850 | 레일이 넘치지 않는다 (스크롤 없이 전부 보인다) |
| `totalButtons` / `tabStops` | 11 / 3 | 11 / 3 | 그룹당 탭 스톱 1개 (이전 11개) |
| `layerIconsDistinct` | 3 | 3 | 레이어 3개가 서로 다른 아이콘을 쓴다 |
| `gapEventToTiles` | 17 | 17 | 타일·맵이 도구/레이어 그룹과 붙어 있다 |

## PNG

- `before-beginner-rail-1440x900.png` — 변경 전 초보 레일. **이미 72x851** 이다:
  레일은 늘 72px 로 **렌더**됐고 인라인 `width: 48px` 선언이 `min-width … !important` 에
  지고 있었다. 즉 이번 폭 작업은 보이는 폭을 바꾼 게 아니라, 모순된 선언을 없애고
  `--editor-left-safe` 가 실측에서 파생되게 고친 것이다(캔버스가 잘못된 여백을 예약하고 있었다).
- `after-beginner-rail-1024x600.png` (72x550) — 도구 6 / 레이어 3 / 타일·맵 2 가 550px 안에 전부 들어온다.
- `after-beginner-rail-1440x900.png` (72x850)
- `after-beginner-shell-*.png` — 같은 상태의 편집기 전체 화면.

재현: `npm run dev:worktree` 로 서버를 띄우고 초보 모드를 `localStorage` 에 심은 뒤
(`oprn:editor-ui-mode=beginner`) 위 두 뷰포트에서 레일을 측정한다. `?devProject=1` 은
**표준 모드**로 부팅하므로 모드를 심지 않으면 `basic-left-rail` 이 없다.
