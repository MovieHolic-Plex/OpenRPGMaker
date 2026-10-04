# 건물 태양 그림자 형태 수정 (2026-10-04)

## 원인과 수정

기존 모델은 stamp 전체를 동일한 높이의 직사각형으로 취급했다. 저택에 함께 찍힌
석상까지 집의 마지막 줄로 삼았고, 전체 stamp 사각형을 수신에서 제외해 빈 잔디가 잘렸다.

현재 남아 있는 upper art의 실제 알파로 열별 높이 구간을 복원한다. 탑·박공·굴뚝은 서로 다른
윗선, 넓은 처마는 공중에 떠 있는 구간, 본채 아래 석상은 별도 받침을 갖는다.
저택 아래 석상 끝이 본채에 픽셀로 닿아 있는 경우도 몸통 너비가 급격히 줄어드는 지점에서 분리한다.
땅의 수신을 stamp 네모로 제거하지 않는다. 보호하는 영역은 실제 그림의 불투명한 부분이다.
원본 타일 그림/통행/높이/시야는 바꾸지 않았다. 2D 그림에서 추정하는 2.5D 모델이며 실제 3D 자산은 아니다.

## 즉시 확인

- `before/northwest-high.jpg` → `editor/04-northwest-high-canvas.jpg`: 원래 빈 잔디의 네모 컷과 넓은 지붕 아래 그림자.
- `before/northwest-low.jpg` → `editor/02-northwest-low-canvas.jpg`: 탑·본채·작은 석상과 박공의 긴 그림자.
- `editor/03-southeast-low-canvas.jpg`: 반대 방향 태양.
- `player/northwest-high.png`: 실제 출하 player.html, 넓은 처마와 캐릭터 표시.

## 확인 근거

- `contracts/observations.json`: 7개 집중 확인. 본채와 석상 2개 분리, 탑/박공 높이 차,
  15칸 지붕/9칸 벽의 빈 처마, 빈 잔디 alpha 82 / 벽 alpha 0, 삭제 후 유령 caster 0,
  이미지 source 캐시 구분, off 할당 없음. 프로젝트 쓰기 없음.
- `editor/observations.json`: 실제 packaged 에디터, native art 사용, 세 방향/고도, idle 캐시,
  전용 SQLite 저장+재로드, sunlight 외 맵 내용 불변, page error 0.
- `player/observations.json`: 출하 player.html(편집기 셸 없음), native art 사용,
  N/S/E/W 경사로 총 62칸 왕복, 줄 경계 4곳의 녹색 darkening 모두 48,
  idle 재굽기 없음, off 맵 이동 후 텍스처 0, page error 0.
- 코드 빌드: packaged → player → electron 모두 exit 0.
- gates / Vitest / 전체 typecheck는 AGENTS 세션 실행 제한에 따라 실행하지 않았다.

QA SQLite는 `.vite-cache/sunlight/project`, project id `142f700d-d861-4955-a766-5b0f4edd7bec`.
사용자 정본 `/home/main/.local/share/oprn/web-workspace`는 조회만 했다.
작업 시작: project id `c779e278-8cec-4da4-9c2f-df423460b60d`, revision 339, 맵 121개,
map aggregate SHA-256 `f8bfbb0c4e28a394801e0738268524517613eeef413d51b551819a4354628e23`.

## 재현

```bash
bun scripts/qa/building-shadow-audit.mts
OPRN_SUNLIGHT_QA_OUT=verify-shots/building-shadow-shapes/editor node scripts/capture/capture-sunlight-editor.mjs
OPRN_SUNLIGHT_QA_OUT=verify-shots/building-shadow-shapes/player node scripts/capture/capture-sunlight-player.mjs
```

에디터 capture는 기존 QA 전용 127.0.0.1:9855 호스트를 사용한다.
`before/*`는 PR #2085에서 캡처한 동일 화면/동일 태양 수치의 원본 JPEG 사본이다.
