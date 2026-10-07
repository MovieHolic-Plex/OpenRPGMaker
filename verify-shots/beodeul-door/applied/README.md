# 버들항 공용 문 적용 — 실제 게임 재생

공용 `beodeul_door` 자산과 `apply_beodeul_door_animation` 조수 도구를 등록했다.
이번 살림집 `bd-house-h101_0`의 원본 문 5743/2333을 지원한다. 다른 모양의 문은 거부한다.
집 배치와 양방향 출입 연결 뒤 이 도구로 열림·닫힘을 붙일 수 있다.

## 정본 저장·재로드

- project id: `3dd2427f-38dc-46e5-925b-a717dbe5bb03`
- 저장 대상: `/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004/project.sqlite`
- SQLite 저장 API 사용 후 닫고 같은 폴더에서 다시 load: 맵과 이벤트 동일.
- revision: 4
- SHA-256: `3624eb288dbc1ff938c9c35e3674c71bb45b2e6fb8c91cc5b52d2b10a7e489fd`
- 반복 적용 후 맵·이벤트 불변. 이식 타일 재사용, 보조 이벤트 2개·스위치 2개.
- 세부 결과: `canonical-proof.json`. 새/기존 프로젝트 자산 등록은 상위 `storage-proof.json`.

## 실제 플레이

`scripts/qa/runtime/beodeul-door-observe.mjs`가 전용 `player.html`과 SQLite 재로드 후 export를 사용했다.
시작점부터 실제 걷기로 입장·실내 이동·퇴장했다. 에디터 플레이나 디버그 순간이동은 사용하지 않았다.
5비트 통과, 런타임 오류 없음. Firefox에서 렌더 완료 시점의 실제 문 두 칸과 캔버스를 관측했다.
실제 단계는 0→1→2→3→4→5→6→7→6→5→4→3→2→1→0, 마지막은 닫힘이다.
`runtime/SUMMARY.md`를 먼저 읽고 즉시 확인으로 지정한 열림 중간/귀환 닫힘 2장을 확인했다.
문틀이 유지되고 귀환한 캐릭터는 문 앞 길에 있다. 이 근거는 이번 집 하나에 대한 실제 재생 검사다.

초기 초안에서는 transfer 뒤 명령이 실행되지 않아 열린 상태가 남았다(`transfer-tail-failure.json`).
일반 맵 이벤트의 transfer 종료 계약을 유지하고, 조건부 목적 맵 auto 이벤트에 복원·닫힘을 맡겨 수정했다.
각 보조 이벤트는 먼저 자기 스위치를 내린다. 전체 테스트·게이트는 실행하지 않았다.

## 잔디 개선 제안

잔디 737과 같은 집/나무 그림으로 비교 시안만 만들었다. 바닥 변경은 정본에 적용하지 않았다.
잔디 톤을 누르는 안과 접지 그림자·흙 경계를 함께 넣는 안을 비교한다.
출력: `output/beodeul-ground-proposal/variant-{0,1,2}.png`.
대화용 비교: `/home/main/.codex/visualizations/2026/10/04/01a104a8-00f1-7540-876e-f965d2ebbda1/beodeul-ground-contact.html`.
