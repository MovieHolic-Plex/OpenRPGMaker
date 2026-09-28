# 8차 맵 진입 측정

2026-09-28, baseline `ef5375b2fa234623a39262eb7d92f9e888c05efb`.
사용자가 허용한 프로젝트 폴더를 `/home/main/.cache/a5a8-r8/userproj-src`에 복사한 뒤,
그 사본의 SQLite를 mode=ro로 읽어 `mapload/project.json`을 추출했다. 정본 쓰기 없음.
project id: `ecb700c3-0977-4168-a27a-322c46fc34c9`.
Chromium headless / ANGLE SwiftShader / viewport 1024×768 / player.html / QA instrumentation.
타이틀 Enter → 2.5초 안정화 → JSON 맵 순서대로 teleport(mapId,5,5), 전체 3회 순회.
전후 별도 새 브라우저, 같은 서버 명령. 최초 순회에는 첫 사용 자산/렌더 준비 비용도 포함된다.
서버는 각 실행 뒤 종료했다. 자체 테스트/타입 검사와 최종 측정을 겹치지 않았다.
공유 머신의 단일 전후 실행이므로 부하·GC·프레임 위상 변동이 있다.

최대 프레임은 teleport 직전 rAF부터 완료 후 650ms까지 관측한 **rAF 간격의 최댓값**이다.
renderMs는 teleport 중 scene.renderTiles를 감싸 측정한 합계(Phaser 다음 draw/GPU 제외).
오브젝트 생성 수를 줄이거나 늦추지 않았으므로 프레임 멈춤의 완전 해소/60fps를 주장하지 않는다.

| 맵 | 크기 | 최대 프레임 전 1/2/3회(ms) | 후 1/2/3회(ms) | renderTiles 중앙값 전→후(ms) |
|---|---|---|---|---|
| `map_hill_forest_cave` | 20×16 | 159.9 / 16.8 / 16.8 | 80.0 / 16.8 / 16.8 | 15.1→12.0 |
| `map_peaceful_forest_100` | 100×100 | 181.2 / 98.1 / 81.7 | 129.9 / 81.7 / 80.9 | 97.4→85.1 |
| `map_rebuilt_forest_cave` | 20×16 | 44.2 / 44.7 / 44.3 | 41.7 / 43.3 / 45.7 | 50.2→48.8 |
| `map_retro_hill_variants` | 50×22 | 16.8 / 16.7 / 16.8 | 16.8 / 16.8 / 33.3 | 8.3→4.5 |
| `map_forest_repeat_review` | 42×12 | 16.8 / 16.8 / 16.8 | 16.8 / 16.7 / 16.8 | 6.4→4.6 |
| `map_forest_ceiling_review` | 42×16 | 16.8 / 16.8 / 16.8 | 16.8 / 16.8 / 16.8 | 6.2→5.8 |
| `map_forest_diagonal_review` | 64×26 | 16.8 / 16.8 / 16.8 | 16.8 / 16.8 / 16.8 | 11.9→11.0 |
| `map_forest_great_falls_100` | 100×100 | 97.4 / 81.1 / 81.0 | 96.2 / 64.6 / 80.3 | 91.4→77.1 |
| `map_forest_village_rebuilt` | 64×64 | 94.7 / 77.1 / 61.9 | 76.9 / 61.9 / 86.9 | 73.3→81.9 |
| `map_forest_dark_seam_review` | 64×26 | 16.8 / 66.6 / 16.8 | 16.8 / 16.8 / 16.8 | 14.9→15.9 |
| `map_forest_trunk_assembly_review` | 64×26 | 16.8 / 16.7 / 16.8 | 16.8 / 16.8 / 16.8 | 16.5→10.1 |
| `map_hill_forest_village_20260918` | 64×64 | 30.9 / 30.8 / 30.7 | 30.1 / 16.8 / 29.9 | 35.7→27.3 |

`before.json` / `after.json`은 입력·소스 SHA-256, 개별 프레임 간격과 transfer/render 시간을 포함한다.
72회 전부 요청 맵과 실제 맵 일치, pageerror 전후 0건. 화면 확인: `after.png`(마지막 마을), 대조 `before.png`.

## 재현

```bash
VITE_CACHE_DIR=/home/main/.codex/worktrees/a5a8/rpg-zzu-lvA/.vite-cache/qa npm run dev:worktree -- --port 9961 --strictPort --config vite.player-qa.config.ts
node scripts/qa/runtime/map-entry-cost.mjs /home/main/.cache/a5a8-r8/mapload/project.json /home/main/.cache/a5a8-r8/mapload/run.json
# 끝나면 위 서버를 Ctrl-C로 종료한다.
MAP_ENTRY_PROJECT=/home/main/.cache/a5a8-r8/mapload/project.json timeout 600 node scripts/run-vitest.mjs run --configLoader bundle --maxWorkers=1 --minWorkers=1 test/mapEntryTilePass.test.ts
```

## 테스트

파일별 `timeout 600 node scripts/run-vitest.mjs run --configLoader bundle --maxWorkers=1 --minWorkers=1 <file>` 사용.

- mapEntryTilePass: **8/8**, 사용자 사본 12맵의 동결된 옛 타일 생성 경로와 동등성 포함.
  생성 직후 및 카메라 창 이동/축소 뒤 텍스처·프레임·좌표·depth·visible·부모·삽입 순서,
  애니메이션 키/정지 상태 일치. 이벤트는 별도 eventLayerReuse가 담당한다.
- playSceneTileCulling: **9/9**.
- playSceneExtraLayers: **2/2**.
- eventLayerReuse: **18/18**.
- eventCommandMapRepairs: **30/34**. 기존 weatherRenderPlan particleCount 4개 실패.
  수정 전 소스를 실제 복원한 실행도 같은 4개·동일 assertion 실패(126≠67, 144≠77, 90≠48).
- 수정 전 소스에서 mapEntryTilePass: **1 실패 / 6 통과 / 사본 옵션 1 생략**.
  100×100 비용 회귀가 texture resolver 1회 대신 **20,001회**로 실패한다.
- `NODE_OPTIONS=--max-old-space-size=6144 npm run -s typecheck:app`: **exit 0**.
- 전체 gates/vitest, commit/push/stash 실행 없음.

## 증거 복구 및 남은 범위

첫 측정 직후 `/tmp`가 외부에서 정리돼 원시 로그/PNG와 사본이 사라졌다. 도구 출력에서 복원한
첫 측정 72개 수치는 `console-results.json`에 별도로 남겼다. 이 보고서와 before/after 파일은
사용자가 허용한 새 사본으로 **다시 측정한 완전한 원시 결과**다. 현재 백업/로그 위치:
`/home/main/.cache/a5a8-r8/mapload/`. 최초 테스트 결과는 대화 도구 출력에도 남아 있다.

프레임 분할을 하지 않아 대형 맵 전체 GameObject 생성·파괴와 Phaser add/draw는 여전히 동기다.
첫 사용 자산, 날씨, 오디오 등의 전환 비용과 작은 맵의 일부 변동은 이 캐시로 해결되지 않는다.
서명 스킵/편집기 증분 렌더 계약은 유지한다. 정책 캐시는 동기 패스 밖으로 확장하지 않는다.
