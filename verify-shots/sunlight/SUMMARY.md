# 태양과 지형 그림자 — 2026-10-04

## 즉시 확인

- `editor/02-northwest-low-canvas.jpg`: 북서 315° / 고도 24°. 버들항의 서로 다른 집 네 채와 절벽이 남동으로 긴 그림자를 만든다.
- `editor/03-southeast-low-canvas.jpg`: 같은 지도에서 반대 방향인 남동 135°. 그림자가 북서로 바뀐다.
- `editor/04-northwest-high-canvas.jpg`: 북서 315° / 고도 75°. 그림자가 짧아진다.
- `editor/01-off-canvas.jpg`: 그림자 off. 기본 설정이며 타일·높이·집은 유지한다.
- `editor/02-controls.png`: 하단 태양 아이콘으로 여는 실제 맵 설정.
- `player/ramp-e.png`: 출하 player.html에서 그림자를 켠 경사로. 캐릭터 전신과 끊기지 않는 땅 그림자.
- `contracts/assistant-crop.png`: 영역 밖 구조물의 그림자도 유지하는 조수용 지도 이미지.

위 화면은 개념 시뮬레이션이 아니라 패키지 빌드의 실제 에디터/내보낸 플레이어 캡처다.
MP4는 같은 브라우저 세션의 녹화를 2배속으로 인코딩한 로컬 산출물이며 저장소에는 중복 바이너리를 넣지 않았다.

## 확인한 계약

`contracts/observations.json`: 사용자 DB와 분리한 기존 최소 버들항 fixture에서 실제 도구 호출과 공통 계산 20개 항목.

- 예전 맵 기본 off, 잘못된 값 정규화, 부분 수정 및 off/on에서 숫자 보존, clear 후 원본 복원.
- 타일셋 없는 1024×1024 평지는 캐시 재조회까지 오류 없이 그림자 field를 만들지 않음.
- 태양 반대 방향/높은 고도/고지 자체의 수신, native 대각선 높이 16,384점 대조.
- 입구를 가진 원본/조립 집 네 채 및 고지의 집, 조수 inspect caster/설정, 자연어 요청의 세 도구 노출.
- 높이/통행/경사로/집/문/타일/다른 맵 보존, 원본 맵을 참조하는 영역 이미지, 실제 SQLite 저장/다시 읽기 및 플레이어 export.

`editor/observations.json`: 실제 checkbox와 숫자 필드로 off → 북서 24° → 남동 24° → 북서 75° → 북서 35°.
사용한 정본은 **QA 전용** SQLite 폴더 `.vite-cache/sunlight/project`,
project id `142f700d-d861-4955-a766-5b0f4edd7bec`, 최종 revision **15**.
새로고침 후 같은 설정, 다른 콘텐츠 및 다른 맵 보존, off 텍스처 0개, enabled 정착 시 320개, 집 caster 4개,
정지 중 추가 계산 없음, pageerror 0개를 확인했다.

`player/observations.json`: 편집기를 통과하지 않는 출하 player.html. QA 사본의 경사로 지도에 태양 설정만 추가했다.
315°/24°, 135°/24°, 315°/75° 실제 프레임이 서로 다르며, 키보드로 N/S/E/W 경사로 총 **62칸 왕복**.
정지 중 추가 계산 없음, off 지도 이동 후 텍스처 0개, pageerror 0개.
Canvas의 원본 크기 +.5px 확대로 생겼던 가로 틈은 마스크만 정확한 크기로 그려 수정했다.
같은 땅의 12/13/14/15줄 경계 on/off 픽셀에서 네 지점 모두 green 채널이 **48**만큼 어두워져 빈 줄이 없음을 확인했다.
이 검수는 모든 지도/모든 캐릭터 그림에 대한 무결함 보장이 아니다.

## 실행

- `bun scripts/qa/sunlight-audit.mts` — 앞선 terrain QA 전용 SQLite fixture를 읽고 전용 폴더에 저장. 실행 중인 호스트 DB에는 직접 쓰지 않음.
- `node scripts/capture/capture-sunlight-editor.mjs` — QA 전용 127.0.0.1:9855 호스트와 실제 에디터 조작.
- `node scripts/capture/capture-sunlight-player.mjs` — 프로덕션 export preview, 실제 키보드 이동 및 픽셀 비교.
- `npm run build:packaged`, `npm run build:player`, `npm run build:electron` 완료. packaged가 export-player를 지우므로 배포 빌드는 그 순서로 준비.
- `git diff --check` 완료. AGENTS의 실행 제한에 따라 gates/Vitest/전체 typecheck는 실행하지 않음.

## 구현 범위

수신 면은 땅·경사로·절벽. 구조 키트/군집으로 저작된 집·나무는 추정 높이로 그림자를 만든다.
집 지붕끼리의 수신, 수작업 타일 집 자동 인식, 움직이는 인물의 긴 그림자, 시간에 따라 움직이는 태양,
다리 아래의 별도 수신 면은 아직 없다. 설정이 없는 사용자의 기존 지도는 off로 동작한다.
