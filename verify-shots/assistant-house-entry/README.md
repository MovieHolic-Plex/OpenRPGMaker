# 버들항 집 출입 — 실제 AI 조수 저작과 플레이 증거

사용자 요청: “니가 해보고 스크린샷 가져와”. 맵·가구·출입 이벤트는 실제 편집기 AI 조수와 같은 `classifyPlainPiTurn → composePiTask → buildPiRunRequest → runPiAgent` 경로로 저작했다. 확인용 시나리오·저장본 내보내기만 코딩 에이전트가 작성했다.

## 정본

- 프로젝트 id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 폴더: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004` (`project.sqlite` + `assets/`)
- revision: 1
- SHA-256: `ae47b01f490596b37862d480e23cc7fcfa5c1c549b92a0f3a59135230f331c2d`
- 저장 후 닫고 같은 폴더를 다시 열었으며, 다시 한 번 닫고 열어 snapshot 전체의 deep equality를 확인했다. 상세는 `canonical-proof.json`.
- 기존 사용자 프로젝트에 대한 콘텐츠 수정 없음. 별도 시험 프로젝트다.

## 조수 저작

- 모델: `opencodex/gpt-6-astra`, 실제 제공자 호출
- 첫 실행: 이미지 요청의 `offset:0`이 거부되어 중단. 참고문서 도구가 이미지 조회에서 0도 허용하도록 수정 후 재실행.
- 재실행: 18턴, 기록된 도구 호출 59회, 길 시공 선행 읽기 거부 1회 뒤 자료를 더 읽어 성공.
- `stamp_object`: 버들항 살림집 `bd-house-h101_0`, 원점 (8,1), 도구가 반환한 문 (10,6).
- `build_hand_interior_room`: 첫 실내의 막힌 침실을 조수가 재저작하여 경고 0·도달 불가 바닥 0.
- `create_transfer_pair`: 야외 (10,7) ↔ 실내 (4,8), 착지는 각각 야외 (10,8), 실내 (4,7).
- 조수의 `run_scene_test` 10/10과 6/6 이후, 별도로 출하 플레이어 경로를 검증했다.
- 원래 조수 호출 기록: `../assistant-beodeul-village/door-entry-fixed/e7d2-house-entry/trace.json`, `log.txt`, `summary.json`.

## 실제 플레이

```sh
npm run qa:runtime -- --scenario assistant-house-entry --project output/assistant-house-entry/reloaded-project.json --out verify-shots/assistant-house-entry/runtime
```

저장본을 dedicated `player.html`로 실행했다. 디버그 teleport 없이 실제 플레이어 이동 상태기를 통해 걷고 출입 이벤트를 발동했다.

- 시작: 야외 (10,10)
- 위로 3칸 걷기 → 실내 (4,7)
- 40프레임 후에도 실내 유지(출입 칸과 착지 칸 분리)
- 가구를 우회하여 거실 안쪽 (4,3)까지 실제 이동
- 출구까지 걷기 → 야외 (10,8), 40프레임 후에도 야외 유지
- 5개 비트 전부 통과, 런타임 오류 없음. `runtime/SUMMARY.md`, `runtime/manifest.json` 참고.

## 화면 판정

선택한 3장만 직접 확인했다. 버들항 집과 문 앞 길이 맞닿아 있고, 실내 거실·침실·현관이 표시되며, 퇴장 후 같은 문 앞에 플레이어가 서 있다. 검은 영역은 실내 맵 바깥 배경이다. 넓은 마을의 자동 출입·다층 집·모든 키트에 대한 보장은 이 작은 집 왕복 시험의 범위를 넘는다.

- 입장 전: `runtime/02-01-outside.png`
- 입장 후 실내 이동: `runtime/04-03-inside-walk.png`
- 퇴장 후: `runtime/05-04-returned.png`

전체 gates·vitest·typecheck는 실행하지 않았다. 사용자 요청 범위의 실모델 저작·저장 재로드·게임 왕복만 실행했다.
